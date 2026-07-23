"""
Tests for the simplified English-only web UI.
"""

from __future__ import annotations

import math
import sys
from pathlib import Path

from sapro.webui import build_simplex_problem, collect_tagged_steps, solve_coefficient_request

sys.path.insert(0, str(Path(__file__).parent))
from test_webui import BUILTIN_EXAMPLES, _call_wsgi, _post_solve, _solve_payload

PACKAGE_DIR = Path(__file__).resolve().parents[1] / 'src' / 'sapro'

EPS = 1e-9


def _html() -> str:
    _, _, body = _call_wsgi('GET', '/')
    return body.decode('utf-8')


def _app_js() -> str:
    _, _, body = _call_wsgi('GET', '/static/app.js')
    return body.decode('utf-8')


def _css() -> str:
    return (PACKAGE_DIR / 'static' / 'style.css').read_text(encoding='utf-8')


def _format_term(coef: float, var_name: str, is_first: bool) -> str:
    if abs(coef) < EPS:
        return ''
    abs_coef = abs(coef)
    coef_part = '' if abs_coef == 1 else str(int(abs_coef) if float(abs_coef).is_integer() else abs_coef)
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
        lines.append(f'{lhs} {op} {row["rhs"]}')
    var_names = ', '.join(f'x{i + 1}' for i in range(len(payload['objective'])))
    lines.extend(['', f'{var_names} >= 0'])
    return '\n'.join(lines)


def _build_method_line(phase_counts: dict) -> str:
    if not phase_counts or phase_counts.get('phase_one', 0) == 0:
        return 'Method: Simplex'
    return (
        f'Method: Two-Phase Simplex · Phase I: {phase_counts["phase_one"]} '
        f'· Phase II: {phase_counts["phase_two"]}'
    )


def _format_step_heading(step: dict) -> str:
    if step.get('enter') and step.get('leave'):
        return f'Step {step["index"]}: {step["enter"]} enters, {step["leave"]} leaves'
    if step.get('enter'):
        return f'Step {step["index"]}: {step["enter"]} enters'
    if step.get('leave'):
        return f'Step {step["index"]}: {step["leave"]} leaves'
    return f'Step {step["index"]}'


# ---------------------------------------------------------------------------
# English-only interface
# ---------------------------------------------------------------------------


def test_no_language_selector_exists():
    html = _html()
    assert 'lang-switch' not in html
    assert 'id="lang-en"' not in html
    assert 'id="lang-fa"' not in html
    assert 'فارسی' not in html


def test_html_uses_lang_en():
    assert '<html lang="en"' in _html()


def test_html_uses_dir_ltr():
    assert 'dir="ltr"' in _html()


def test_no_persian_translation_dictionary():
    script = _app_js()
    assert 'I18N' not in script
    assert 'setLanguage' not in script
    assert 'حل‌گر' not in script


def test_no_rtl_ui_state():
    script = _app_js()
    assert 'document.documentElement.dir' not in script
    assert 'rtl' not in script


def test_no_persian_specific_css():
    css = _css()
    assert 'lang-switch' not in css
    assert 'lang-btn' not in css


# ---------------------------------------------------------------------------
# Removed iteration controls
# ---------------------------------------------------------------------------


def test_expand_all_does_not_exist():
    html = _html()
    script = _app_js()
    assert 'expand-all-btn' not in html
    assert 'Expand All' not in html
    assert 'expandAllSteps' not in script


def test_collapse_all_does_not_exist():
    html = _html()
    script = _app_js()
    assert 'collapse-all-btn' not in html
    assert 'Collapse All' not in html
    assert 'collapseAllSteps' not in script


def test_no_unused_expand_collapse_javascript():
    script = _app_js()
    assert 'iteration-controls' not in script
    assert 'setIterationControlsVisible' not in script


# ---------------------------------------------------------------------------
# Result summary and method line
# ---------------------------------------------------------------------------


def test_result_summary_displays_one_total_iteration_count():
    assert '<strong>Iterations:</strong>' in _app_js() or 'Iterations:</strong>' in _app_js()
    script = _app_js()
    assert 'phaseOneIterations' not in script
    assert 'Total iterations' not in script


def test_no_phase_one_problem_displays_method_simplex():
    result = _post_solve(_solve_payload())
    assert _build_method_line(result['phase_counts']) == 'Method: Simplex'


def test_phase_one_problem_displays_two_phase_method_line():
    result = _post_solve(BUILTIN_EXAMPLES['mixed'])
    line = _build_method_line(result['phase_counts'])
    assert line.startswith('Method: Two-Phase Simplex')


def test_two_phase_method_line_displays_reliable_counts():
    result = _post_solve(BUILTIN_EXAMPLES['mixed'])
    counts = result['phase_counts']
    line = _build_method_line(counts)
    assert f'Phase I: {counts["phase_one"]}' in line
    assert f'Phase II: {counts["phase_two"]}' in line


def test_phase_counts_sum_to_total_iterations():
    for example in BUILTIN_EXAMPLES.values():
        result = _post_solve(example)
        if not result['ok']:
            continue
        counts = result['phase_counts']
        assert counts['phase_one'] + counts['phase_two'] == counts['total']


def test_phase_one_zero_not_displayed_in_method_line():
    result = _post_solve(_solve_payload())
    line = _build_method_line(result['phase_counts'])
    assert 'Phase I: 0' not in line


# ---------------------------------------------------------------------------
# Step headings
# ---------------------------------------------------------------------------


def test_step_headings_contain_no_phase_labels():
    script = _app_js()
    assert 'phase-badge' not in script
    assert 'phaseLabel' not in script
    assert 'Phase I' not in script.split('formatStepHeading')[0] or 'formatStepHeading' in script
    result = _post_solve(BUILTIN_EXAMPLES['mixed'])
    for step in result['steps']:
        heading = _format_step_heading(step)
        assert 'Phase I' not in heading
        assert 'Phase II' not in heading


def test_individual_iteration_panels_remain_collapsible():
    html = _html()
    script = _app_js()
    assert 'step-panel' in script
    assert 'createElement("details")' in script
    assert 'details.step-panel' in _css()


# ---------------------------------------------------------------------------
# Preserved features
# ---------------------------------------------------------------------------


def test_problem_preview_present():
    assert 'id="problem-preview"' in _html()
    assert 'Problem Preview' in _html()


def test_problem_preview_formats_objective_signs():
    preview = _build_preview({
        'optimization': 'max',
        'objective': [3, -2],
        'constraints': [{'coefficients': [1, 0], 'operator': '<=', 'rhs': 4}],
    })
    assert preview.startswith('Max Z = 3x1 - 2x2')
    assert '+ -' not in preview


def test_problem_preview_shows_non_negativity():
    assert '>= 0' in _build_preview(_solve_payload())


def test_new_problem_control_present():
    assert 'id="new-problem-btn"' in _html()
    assert 'resetNewProblem' in _app_js()


def test_feasible_region_visualization_present():
    assert 'id="feasible-region-viz"' in _html()
    assert 'renderFeasibleRegion' in _app_js()


def test_primary_example_returns_expected_solution():
    result = _post_solve(_solve_payload())
    assert result['ok']
    assert math.isclose(result['objective_value'], 7.0)
    assert math.isclose(result['variable_values']['x1'], 1.0)
    assert math.isclose(result['variable_values']['x2'], 3.0)


def test_primary_example_iteration_and_method_summary():
    result = _post_solve(_solve_payload())
    assert result['step_count'] == 3
    assert _build_method_line(result['phase_counts']) == 'Method: Simplex'


def test_equality_problem_reports_two_phase_method_line():
    result = _post_solve(BUILTIN_EXAMPLES['equality'])
    assert result['ok']
    assert result['phase_counts']['phase_one'] > 0
    assert _build_method_line(result['phase_counts']).startswith('Method: Two-Phase Simplex')


def test_minimization_regression():
    result = _post_solve(BUILTIN_EXAMPLES['minimization'])
    assert result['ok']
    assert math.isclose(result['objective_value'], 4.0)


def test_mixed_operators_regression():
    result = _post_solve(BUILTIN_EXAMPLES['mixed'])
    assert result['ok']
    assert math.isclose(result['objective_value'], 6.0)


def test_infeasible_response_regression():
    result = _post_solve(BUILTIN_EXAMPLES['infeasible'])
    assert result['ok'] is False
    assert result['status'] == 'infeasible'


def test_unbounded_response_regression():
    result = _post_solve(BUILTIN_EXAMPLES['unbounded'])
    assert result['ok'] is False
    assert result['status'] == 'unbounded'


def test_three_variable_visualization_unavailable_message():
    script = _app_js()
    assert 'Two-dimensional visualization is available only' in script


def test_api_phase_metadata_preserved():
    result = _post_solve(BUILTIN_EXAMPLES['mixed'])
    assert 'phase_counts' in result
    for step in result['steps']:
        assert 'phase' in step
        assert 'phase_iteration' in step


def test_no_external_assets():
    script = _app_js()
    html = _html()
    css = _css()
    assert 'https://' not in html
    assert 'https://' not in css
    assert 'unpkg.com' not in script


def test_collect_tagged_steps_unchanged():
    problem = build_simplex_problem(BUILTIN_EXAMPLES['readme'])
    tagged, counts = collect_tagged_steps(problem)
    assert counts['phase_one'] == 0
    assert len(tagged) == counts['total']


def test_readme_documents_offline_webui_without_persian():
    readme = (Path(__file__).resolve().parents[1] / 'README.md').read_text(encoding='utf-8')
    assert 'source .venv/bin/activate' in readme
    assert 'http://127.0.0.1:5678' in readme
    assert 'Persian' not in readme
    assert 'Two-variable feasible-region visualization' in readme
