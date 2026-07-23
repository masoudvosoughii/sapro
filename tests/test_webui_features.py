"""
Tests for web UI usability features: preview, i18n, phase metadata, visualization hooks.
"""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path

import pytest

from sapro.webui import (
    build_simplex_problem,
    collect_tagged_steps,
    solve_coefficient_request,
)

sys.path.insert(0, str(Path(__file__).parent))
from test_webui import BUILTIN_EXAMPLES, _call_wsgi, _post_solve, _solve_payload

PACKAGE_DIR = Path(__file__).resolve().parents[1] / 'src' / 'sapro'
APP_JS = PACKAGE_DIR / 'static' / 'app.js'
INDEX_HTML = PACKAGE_DIR / 'index.html'


def _read(path: Path) -> str:
    return path.read_text(encoding='utf-8')


def _html() -> str:
    _, _, body = _call_wsgi('GET', '/')
    return body.decode('utf-8')


def _app_js() -> str:
    _, _, body = _call_wsgi('GET', '/static/app.js')
    return body.decode('utf-8')


# ---------------------------------------------------------------------------
# Preview helpers mirroring app.js formatting contract
# ---------------------------------------------------------------------------

EPS = 1e-9


def _format_number(value: float) -> str:
    if float(value).is_integer():
        return str(int(value))
    return f'{value:.6f}'.rstrip('0').rstrip('.')


def _format_term(coef: float, var_name: str, is_first: bool) -> str:
    if abs(coef) < EPS:
        return ''
    abs_coef = abs(coef)
    coef_part = '' if abs_coef == 1 else _format_number(abs_coef)
    term = f'{coef_part}{var_name}'
    if is_first:
        return f'-{term}' if coef < 0 else term
    return f' - {term}' if coef < 0 else f' + {term}'


def _format_objective_expression(objective: list[float]) -> str:
    expr = ''
    first = True
    for index, coef in enumerate(objective):
        part = _format_term(coef, f'x{index + 1}', first)
        if part:
            expr += part
            first = False
    return expr or '0'


def _build_preview(payload: dict) -> str:
    direction = 'Max' if payload['optimization'] == 'max' else 'Min'
    lines = [f'{direction} Z = {_format_objective_expression(payload["objective"])}', '', 'Subject to:']
    for row in payload['constraints']:
        lhs = _format_objective_expression(row['coefficients'])
        op = '=' if row['operator'] == '==' else row['operator']
        lines.append(f'{lhs} {op} {_format_number(row["rhs"])}')
    var_names = ', '.join(f'x{i + 1}' for i in range(len(payload['objective'])))
    lines.extend(['', f'{var_names} >= 0'])
    return '\n'.join(lines)


# ---------------------------------------------------------------------------
# Visualization helpers mirroring app.js geometry contract
# ---------------------------------------------------------------------------


def _clip_polygon(polygon, a, b, rhs, op):
    if not polygon:
        return []
    output = []
    for i in range(len(polygon)):
        current = polygon[i]
        previous = polygon[(i - 1) % len(polygon)]
        curr_inside = (
            a * current['x'] + b * current['y'] <= rhs + EPS
            if op == '<='
            else a * current['x'] + b * current['y'] >= rhs - EPS
        )
        prev_inside = (
            a * previous['x'] + b * previous['y'] <= rhs + EPS
            if op == '<='
            else a * previous['x'] + b * previous['y'] >= rhs - EPS
        )
        if curr_inside:
            if not prev_inside:
                f1 = a * previous['x'] + b * previous['y'] - rhs
                f2 = a * current['x'] + b * current['y'] - rhs
                if abs(f2 - f1) >= EPS:
                    t = f1 / (f1 - f2)
                    output.append({
                        'x': previous['x'] + t * (current['x'] - previous['x']),
                        'y': previous['y'] + t * (current['y'] - previous['y']),
                    })
            output.append(current)
        elif prev_inside:
            f1 = a * previous['x'] + b * previous['y'] - rhs
            f2 = a * current['x'] + b * current['y'] - rhs
            if abs(f2 - f1) >= EPS:
                t = f1 / (f1 - f2)
                output.append({
                    'x': previous['x'] + t * (current['x'] - previous['x']),
                    'y': previous['y'] + t * (current['y'] - previous['y']),
                })
    return output


def _build_feasible_polygon(payload: dict, viewport: dict) -> list[dict]:
    polygon = [
        {'x': viewport['minX'], 'y': viewport['minY']},
        {'x': viewport['maxX'], 'y': viewport['minY']},
        {'x': viewport['maxX'], 'y': viewport['maxY']},
        {'x': viewport['minX'], 'y': viewport['maxY']},
    ]
    polygon = _clip_polygon(polygon, 1, 0, 0, '>=')
    polygon = _clip_polygon(polygon, 0, 1, 0, '>=')
    for row in payload['constraints']:
        if row['operator'] == '==':
            continue
        a, b = row['coefficients']
        polygon = _clip_polygon(polygon, a, b, row['rhs'], row['operator'])
    return polygon


def _polygon_area(polygon: list[dict]) -> float:
    if len(polygon) < 3:
        return 0.0
    area = 0.0
    for i in range(len(polygon)):
        p1 = polygon[i]
        p2 = polygon[(i + 1) % len(polygon)]
        area += p1['x'] * p2['y'] - p2['x'] * p1['y']
    return abs(area) / 2


# ---------------------------------------------------------------------------
# Problem Preview
# ---------------------------------------------------------------------------


def test_preview_section_exists():
    html = _html()
    assert 'id="problem-preview-section"' in html
    assert 'Problem Preview' in html


def test_preview_objective_signs_render_correctly():
    preview = _build_preview({
        'optimization': 'max',
        'objective': [3, -2],
        'constraints': [{'coefficients': [1, 0], 'operator': '<=', 'rhs': 4}],
    })
    assert preview.startswith('Max Z = 3x1 - 2x2')
    assert '+ -' not in preview


def test_preview_zero_coefficients_hidden():
    preview = _build_preview({
        'optimization': 'max',
        'objective': [0, 2],
        'constraints': [{'coefficients': [0, 1], 'operator': '<=', 'rhs': 3}],
    })
    assert '0x1' not in preview
    assert '2x2' in preview


def test_preview_shows_non_negativity():
    preview = _build_preview(_solve_payload())
    assert '>= 0' in preview


def test_preview_updates_after_example_loading_contract():
    script = _app_js()
    assert 'updateProblemPreview' in script
    assert 'loadExample("readme")' in script or "loadExample('readme')" in script


# ---------------------------------------------------------------------------
# New Problem
# ---------------------------------------------------------------------------


def test_new_problem_control_exists():
    assert 'id="new-problem-btn"' in _html()
    assert 'New Problem' in _html()
    assert 'resetNewProblem' in _app_js()


def test_new_problem_resets_dimensions_to_2x2():
    script = _app_js()
    assert 'els.numVars.value = "2"' in script
    assert 'els.numConstraints.value = "2"' in script


def test_new_problem_resets_coefficients_and_rhs_to_zero():
    script = _app_js()
    assert 'renderObjectiveGrid(2, [0, 0])' in script


def test_new_problem_clears_results_and_visualization():
    script = _app_js()
    assert 'clearResults' in script
    assert 'renderFeasibleRegion(null, collectPayload())' in script


def test_new_problem_preserves_language():
    script = _app_js()
    assert 'setLanguage' not in script.split('function resetNewProblem')[1].split('}')[0]


# ---------------------------------------------------------------------------
# Iteration controls
# ---------------------------------------------------------------------------


def test_expand_and_collapse_controls_exist():
    html = _html()
    assert 'id="expand-all-btn"' in html
    assert 'id="collapse-all-btn"' in html
    assert 'Expand All' in html
    assert 'Collapse All' in html


def test_expand_all_opens_every_step():
    assert 'panel.open = true' in _app_js()


def test_collapse_all_closes_every_step():
    assert 'panel.open = false' in _app_js()


def test_iteration_controls_hidden_when_no_steps():
    assert 'setIterationControlsVisible(false)' in _app_js()
    assert 'els.iterationControls.hidden = true' in _app_js()


# ---------------------------------------------------------------------------
# Phase metadata
# ---------------------------------------------------------------------------


def test_all_leq_problem_reports_zero_phase_one():
    result = _post_solve(_solve_payload())
    assert result['phase_counts']['phase_one'] == 0
    assert result['phase_counts']['phase_two'] >= 1


def test_mixed_problem_reports_nonzero_phase_one():
    result = _post_solve(BUILTIN_EXAMPLES['mixed'])
    assert result['phase_counts']['phase_one'] > 0


def test_phase_counts_sum_to_total():
    for example in BUILTIN_EXAMPLES.values():
        result = _post_solve(example)
        if not result['ok']:
            continue
        counts = result['phase_counts']
        assert counts['phase_one'] + counts['phase_two'] == counts['total']
        assert counts['total'] == result['step_count']


def test_each_step_has_reliable_phase_metadata():
    result = _post_solve(BUILTIN_EXAMPLES['mixed'])
    assert result['ok']
    for step in result['steps']:
        assert step['phase'] in {'phase_one', 'phase_two'}
        assert step['phase_iteration'] >= 1


def test_total_step_count_remains_compatible():
    result = _post_solve(_solve_payload())
    assert result['step_count'] == len(result['steps'])
    assert result['step_count'] == result['phase_counts']['total']


def test_collect_tagged_steps_matches_solve_orchestration():
    problem = build_simplex_problem(BUILTIN_EXAMPLES['mixed'])
    tagged, counts = collect_tagged_steps(problem)
    assert counts['phase_one'] > 0
    assert len(tagged) == counts['total']


# ---------------------------------------------------------------------------
# Localization
# ---------------------------------------------------------------------------


def test_english_is_default_in_html():
    html = _html()
    assert '<html lang="en"' in html
    assert 'dir="ltr"' in html


def test_persian_mode_support_present():
    script = _app_js()
    html = _html()
    assert 'setLanguage("fa")' in script or "setLanguage('fa')" in script
    assert 'document.documentElement.dir = lang === "fa" ? "rtl" : "ltr"' in script
    assert 'فارسی' in html


def test_mathematical_sections_remain_ltr():
    html = _html()
    assert 'math-ltr' in html
    assert 'class="table-wrap math-ltr"' in html


def test_required_interface_labels_translated():
    script = _app_js()
    for key in [
        'problemPreview',
        'newProblem',
        'expandAll',
        'collapseAll',
        'feasibleRegion',
        'phaseOneIterations',
        'phaseTwoIterations',
    ]:
        assert key in script


def test_builtin_example_names_translated():
    script = _app_js()
    assert 'exampleReadme' in script
    assert 'بیشینه‌سازی کران‌دار پایه' in script


def test_solver_error_messages_translated():
    script = _app_js()
    assert 'infeasible' in script
    assert 'مسئله جواب شدنی ندارد' in script


def test_english_project_identity_exact():
    html = _html()
    assert 'Simplex Method Solver' in html
    assert 'Advanced Optimization Course Project' in html
    assert 'Developed by Masoud Vosoughi' in html
    assert 'Instructor: Mohsen Rostami Mal Khalife' in html


def test_persian_project_identity_present():
    script = _app_js()
    assert 'حل‌گر روش سیمپلکس' in script
    assert 'دانشگاه آزاد اسلامی، واحد علوم و تحقیقات' in script


# ---------------------------------------------------------------------------
# Visualization
# ---------------------------------------------------------------------------


def test_two_variable_bounded_example_produces_visualization_data():
    payload = _solve_payload()
    viewport = {'minX': 0, 'minY': 0, 'maxX': 5, 'maxY': 5}
    polygon = _build_feasible_polygon(payload, viewport)
    assert _polygon_area(polygon) > 0


def test_primary_example_optimum_from_server():
    result = _post_solve(_solve_payload())
    assert result['ok']
    assert math.isclose(result['variable_values']['x1'], 1.0)
    assert math.isclose(result['variable_values']['x2'], 3.0)


def test_three_variable_problem_shows_unavailable_message():
    script = _app_js()
    assert 'vizUnavailable' in script
    assert 'Two-dimensional visualization is available only' in script


def test_infeasible_problems_have_zero_area_polygon():
    viewport = {'minX': 0, 'minY': 0, 'maxX': 8, 'maxY': 8}
    polygon = _build_feasible_polygon(BUILTIN_EXAMPLES['infeasible'], viewport)
    assert _polygon_area(polygon) == 0.0


def test_unbounded_notice_present():
    assert 'unboundedNotice' in _app_js()


def test_equality_constraints_rendered_as_lines_in_js():
    script = _app_js()
    assert 'row.operator === "=="' in script
    assert 'stroke-dasharray' in script


def test_visualization_uses_no_external_assets():
    script = _app_js()
    html = _html()
    assert 'https://' not in script
    assert 'https://' not in html
    assert 'unpkg.com' not in script
    assert 'cdn.' not in script.lower()
    assert 'fetch("/api/solve"' in script


def test_visualization_does_not_alter_solver_results():
    before = _post_solve(_solve_payload())
    after = _post_solve(_solve_payload())
    assert before['objective_value'] == after['objective_value']
    assert before['variable_values'] == after['variable_values']


def test_visualization_has_accessible_label():
    html = _html()
    script = _app_js()
    assert 'aria-label' in html or 'aria-label' in script
    assert 'chartAriaLabel' in script


# ---------------------------------------------------------------------------
# Regression
# ---------------------------------------------------------------------------


def test_primary_example_still_returns_expected_solution():
    result = _post_solve(_solve_payload())
    assert result['ok']
    assert math.isclose(result['objective_value'], 7.0)
    assert math.isclose(result['variable_values']['x1'], 1.0)
    assert math.isclose(result['variable_values']['x2'], 3.0)


def test_minimization_regression():
    result = _post_solve(BUILTIN_EXAMPLES['minimization'])
    assert result['ok']
    assert math.isclose(result['objective_value'], 4.0)


def test_equality_and_mixed_regression():
    eq = _post_solve(BUILTIN_EXAMPLES['equality'])
    mixed = _post_solve(BUILTIN_EXAMPLES['mixed'])
    assert eq['ok'] and math.isclose(eq['objective_value'], 4.0)
    assert mixed['ok'] and math.isclose(mixed['objective_value'], 6.0)


def test_infeasible_and_unbounded_regression():
    infeasible = _post_solve(BUILTIN_EXAMPLES['infeasible'])
    unbounded = _post_solve(BUILTIN_EXAMPLES['unbounded'])
    assert infeasible['ok'] is False and infeasible['status'] == 'infeasible'
    assert unbounded['ok'] is False and unbounded['status'] == 'unbounded'


def test_no_remote_dependencies_in_static_files():
    css = (PACKAGE_DIR / 'static' / 'style.css').read_text(encoding='utf-8')
    assert 'https://' not in css
    assert '@import' not in css


def test_readme_documents_offline_bilingual_webui():
    readme = (Path(__file__).resolve().parents[1] / 'README.md').read_text(encoding='utf-8')
    assert 'source .venv/bin/activate' in readme
    assert 'http://127.0.0.1:5678' in readme
    assert 'English and Persian' in readme
    assert 'Two-variable feasible-region visualization' in readme
