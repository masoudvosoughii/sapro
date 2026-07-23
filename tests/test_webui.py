"""
Tests for the offline coefficient-table web UI and JSON API.
"""

from __future__ import annotations

import json
import math
from io import BytesIO
from unittest.mock import patch

import pytest

from sapro.webui import (
    WebUIValidationError,
    application,
    build_simplex_problem,
    parse_coefficient_request,
    solve_coefficient_request,
)


BUILTIN_EXAMPLES = {
    'readme': {
        'optimization': 'max',
        'objective': [1, 2],
        'constraints': [
            {'coefficients': [1, 1], 'operator': '<=', 'rhs': 4},
            {'coefficients': [-2, 1], 'operator': '<=', 'rhs': 1},
            {'coefficients': [1, 0], 'operator': '<=', 'rhs': 3},
        ],
    },
    'minimization': {
        'optimization': 'min',
        'objective': [1, 1],
        'constraints': [{'coefficients': [1, 1], 'operator': '>=', 'rhs': 4}],
    },
    'ge': {
        'optimization': 'max',
        'objective': [1],
        'constraints': [
            {'coefficients': [1], 'operator': '>=', 'rhs': 1},
            {'coefficients': [1], 'operator': '<=', 'rhs': 5},
        ],
    },
    'equality': {
        'optimization': 'max',
        'objective': [1, 1],
        'constraints': [{'coefficients': [1, 1], 'operator': '==', 'rhs': 4}],
    },
    'mixed': {
        'optimization': 'max',
        'objective': [1, 2],
        'constraints': [
            {'coefficients': [1, 0], 'operator': '<=', 'rhs': 4},
            {'coefficients': [0, 1], 'operator': '>=', 'rhs': 1},
            {'coefficients': [1, 1], 'operator': '==', 'rhs': 3},
        ],
    },
    'negative_rhs': {
        'optimization': 'max',
        'objective': [1],
        'constraints': [
            {'coefficients': [1], 'operator': '>=', 'rhs': -5},
            {'coefficients': [1], 'operator': '<=', 'rhs': 3},
        ],
    },
    'infeasible': {
        'optimization': 'max',
        'objective': [1, 1],
        'constraints': [
            {'coefficients': [1, 0], 'operator': '>=', 'rhs': 5},
            {'coefficients': [0, 1], 'operator': '>=', 'rhs': 5},
            {'coefficients': [1, 1], 'operator': '<=', 'rhs': 1},
        ],
    },
    'unbounded': {
        'optimization': 'max',
        'objective': [1, 1],
        'constraints': [
            {'coefficients': [1, 0], 'operator': '>=', 'rhs': 1},
            {'coefficients': [0, 1], 'operator': '>=', 'rhs': 2},
        ],
    },
    'decimal': {
        'optimization': 'max',
        'objective': [2.5, 1.5],
        'constraints': [
            {'coefficients': [1.5, 1], 'operator': '<=', 'rhs': 4},
            {'coefficients': [1, 0], 'operator': '<=', 'rhs': 2},
        ],
    },
}


def _call_wsgi(method: str, path: str, body: bytes | None = None) -> tuple[int, dict[str, str], bytes]:
    payload = body or b''
    environ = {
        'REQUEST_METHOD': method,
        'PATH_INFO': path,
        'CONTENT_LENGTH': str(len(payload)),
        'wsgi.input': BytesIO(payload),
    }
    status_holder: dict[str, object] = {}
    headers_holder: dict[str, str] = {}

    def start_response(status, headers, exc_info=None):
        status_holder['status'] = status
        headers_holder.update(dict(headers))

    response_body = b''.join(application(environ, start_response))
    status_code = int(str(status_holder['status']).split()[0])
    return status_code, headers_holder, response_body


def _solve_payload(**overrides) -> dict:
    payload = {
        'optimization': 'max',
        'objective': [1, 2],
        'constraints': [
            {'coefficients': [1, 1], 'operator': '<=', 'rhs': 4},
            {'coefficients': [-2, 1], 'operator': '<=', 'rhs': 1},
            {'coefficients': [1, 0], 'operator': '<=', 'rhs': 3},
        ],
    }
    payload.update(overrides)
    return payload


def _post_solve(payload: dict) -> dict:
    status, _, body = _call_wsgi('POST', '/api/solve', json.dumps(payload).encode('utf-8'))
    assert status == 200
    return json.loads(body.decode('utf-8'))


# ---------------------------------------------------------------------------
# API solve cases
# ---------------------------------------------------------------------------


def test_primary_bounded_example_returns_expected_solution():
    result = _post_solve(_solve_payload())
    assert result['ok'] is True
    assert math.isclose(result['objective_value'], 7.0)
    assert math.isclose(result['variable_values']['x1'], 1.0)
    assert math.isclose(result['variable_values']['x2'], 3.0)
    assert result['step_count'] >= 1


def test_minimization_via_api():
    result = _post_solve({
        'optimization': 'min',
        'objective': [1, 1],
        'constraints': [{'coefficients': [1, 1], 'operator': '>=', 'rhs': 4}],
    })
    assert result['ok'] is True
    assert math.isclose(result['objective_value'], 4.0)


def test_equality_via_api():
    result = _post_solve({
        'optimization': 'max',
        'objective': [1, 1],
        'constraints': [{'coefficients': [1, 1], 'operator': '==', 'rhs': 4}],
    })
    assert result['ok'] is True
    assert math.isclose(result['objective_value'], 4.0)


def test_mixed_operators_via_api():
    result = _post_solve({
        'optimization': 'max',
        'objective': [1, 2],
        'constraints': [
            {'coefficients': [1, 0], 'operator': '<=', 'rhs': 4},
            {'coefficients': [0, 1], 'operator': '>=', 'rhs': 1},
            {'coefficients': [1, 1], 'operator': '==', 'rhs': 3},
        ],
    })
    assert result['ok'] is True
    assert math.isclose(result['objective_value'], 6.0)


def test_negative_rhs_via_api():
    result = _post_solve({
        'optimization': 'max',
        'objective': [1],
        'constraints': [
            {'coefficients': [1], 'operator': '>=', 'rhs': -5},
            {'coefficients': [1], 'operator': '<=', 'rhs': 3},
        ],
    })
    assert result['ok'] is True
    assert math.isclose(result['objective_value'], 3.0)


def test_infeasible_via_api():
    result = _post_solve({
        'optimization': 'max',
        'objective': [1, 1],
        'constraints': [
            {'coefficients': [1, 0], 'operator': '>=', 'rhs': 5},
            {'coefficients': [0, 1], 'operator': '>=', 'rhs': 5},
            {'coefficients': [1, 1], 'operator': '<=', 'rhs': 1},
        ],
    })
    assert result['ok'] is False
    assert result['status'] == 'infeasible'
    assert result['error_type'] == 'Unsolvable'


def test_unbounded_via_api():
    result = _post_solve({
        'optimization': 'max',
        'objective': [1, 1],
        'constraints': [
            {'coefficients': [1, 0], 'operator': '>=', 'rhs': 1},
            {'coefficients': [0, 1], 'operator': '>=', 'rhs': 2},
        ],
    })
    assert result['ok'] is False
    assert result['status'] == 'unbounded'
    assert result['error_type'] == 'Boundless'


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------


def test_malformed_json_rejected():
    with pytest.raises(WebUIValidationError, match='valid JSON'):
        parse_coefficient_request(b'{')


def test_missing_fields_rejected():
    with pytest.raises(WebUIValidationError, match='optimization'):
        parse_coefficient_request(json.dumps({'objective': [1]}).encode('utf-8'))


def test_invalid_dimensions_rejected():
    with pytest.raises(WebUIValidationError, match='coefficients'):
        parse_coefficient_request(json.dumps({
            'optimization': 'max',
            'objective': [1, 2],
            'constraints': [
                {'coefficients': [1], 'operator': '<=', 'rhs': 1},
            ],
        }).encode('utf-8'))


def test_invalid_operator_rejected():
    with pytest.raises(WebUIValidationError, match='operator'):
        parse_coefficient_request(json.dumps({
            'optimization': 'max',
            'objective': [1],
            'constraints': [
                {'coefficients': [1], 'operator': '<', 'rhs': 1},
            ],
        }).encode('utf-8'))


@pytest.mark.parametrize('bad_value', [float('nan'), float('inf'), float('-inf')])
def test_non_finite_values_rejected(bad_value):
    with pytest.raises(WebUIValidationError, match='finite'):
        parse_coefficient_request(json.dumps({
            'optimization': 'max',
            'objective': [bad_value],
            'constraints': [
                {'coefficients': [1], 'operator': '<=', 'rhs': 1},
            ],
        }).encode('utf-8'))


def test_excessive_dimensions_rejected():
    with pytest.raises(WebUIValidationError, match='between 1 and 20'):
        parse_coefficient_request(json.dumps({
            'optimization': 'max',
            'objective': [0] * 21,
            'constraints': [
                {'coefficients': [0] * 21, 'operator': '<=', 'rhs': 1},
            ],
        }).encode('utf-8'))


def test_validation_error_mapping():
    status, _, body = _call_wsgi('POST', '/api/solve', b'{"optimization":"max"}')
    assert status == 200
    payload = json.loads(body.decode('utf-8'))
    assert payload['ok'] is False
    assert payload['status'] == 'invalid_input'
    assert payload['error_type'] == 'ValidationError'


# ---------------------------------------------------------------------------
# Static assets and HTML
# ---------------------------------------------------------------------------


def test_html_has_no_remote_assets():
    status, _, body = _call_wsgi('GET', '/')
    assert status == 200
    html = body.decode('utf-8')
    assert 'https://' not in html
    assert 'http://' not in html
    assert '{{' not in html
    assert 'v-scope' not in html
    assert 'petite-vue' not in html.lower()


def test_html_contains_required_controls_and_identity():
    _, _, body = _call_wsgi('GET', '/')
    html = body.decode('utf-8')
    for token in [
        'id="solve-btn"',
        'id="new-problem-btn"',
        'id="load-example-btn"',
        'id="num-vars"',
        'id="num-constraints"',
        'id="problem-preview"',
        'id="feasible-region-viz"',
        'Simplex Method Solver',
        'Advanced Optimization Course Project',
        'Developed by Masoud Vosoughi',
        'Mohsen Rostami Mal Khalife',
        'Islamic Azad University, Science and Research Branch',
        'Faculty of Converging Sciences and Technologies',
    ]:
        assert token in html


def test_local_static_assets_are_served():
    for asset, content_type in [
        ('/static/style.css', 'text/css'),
        ('/static/app.js', 'application/javascript'),
    ]:
        status, headers, body = _call_wsgi('GET', asset)
        assert status == 200
        assert content_type in headers['Content-Type']
        assert len(body) > 0


def test_static_assets_exist_on_disk():
    from pathlib import Path

    package_dir = Path(__file__).resolve().parents[1] / 'src' / 'sapro'
    assert (package_dir / 'static' / 'style.css').is_file()
    assert (package_dir / 'static' / 'app.js').is_file()


def test_example_definitions_present_in_app_js():
    _, _, body = _call_wsgi('GET', '/static/app.js')
    script = body.decode('utf-8')
    for key in [
        'readme',
        'minimization',
        'ge',
        'equality',
        'mixed',
        'negative_rhs',
        'infeasible',
        'unbounded',
        'decimal',
    ]:
        assert key in script


def test_solve_coefficient_request_direct_helper():
    result = solve_coefficient_request(parse_coefficient_request(
        json.dumps(_solve_payload()).encode('utf-8')
    ))
    assert result['ok'] is True
    assert math.isclose(result['objective_value'], 7.0)


# ---------------------------------------------------------------------------
# Variable-generator regression
# ---------------------------------------------------------------------------


def test_slack_generator_starts_after_decision_variables():
    problem = build_simplex_problem(BUILTIN_EXAMPLES['readme'])
    first_slack = next(problem.slack_var_generator)
    assert first_slack.name == 's3'


def test_more_constraints_than_old_generator_limit_succeeds():
    payload = {
        'optimization': 'max',
        'objective': [1, 2],
        'constraints': [
            {'coefficients': [1, 0], 'operator': '<=', 'rhs': 1},
            {'coefficients': [0, 1], 'operator': '<=', 'rhs': 1},
            {'coefficients': [1, 1], 'operator': '<=', 'rhs': 2},
            {'coefficients': [1, -1], 'operator': '<=', 'rhs': 1},
        ],
    }
    status, _, body = _call_wsgi('POST', '/api/solve', json.dumps(payload).encode('utf-8'))
    assert status == 200
    result = json.loads(body.decode('utf-8'))
    assert result['ok'] is True


@pytest.mark.parametrize('example_name', list(BUILTIN_EXAMPLES))
def test_all_builtin_examples_return_http_200_via_wsgi(example_name):
    status, _, body = _call_wsgi(
        'POST',
        '/api/solve',
        json.dumps(BUILTIN_EXAMPLES[example_name]).encode('utf-8'),
    )
    assert status == 200
    result = json.loads(body.decode('utf-8'))
    assert 'ok' in result
    assert 'status' in result


def test_all_builtin_examples_run_sequentially_in_one_process():
    for _round in range(2):
        for example in BUILTIN_EXAMPLES.values():
            result = _post_solve(example)
            assert 'ok' in result


def test_equality_example_can_be_repeated():
    payload = BUILTIN_EXAMPLES['equality']
    for _ in range(3):
        result = _post_solve(payload)
        assert result['ok'] is True
        assert math.isclose(result['objective_value'], 4.0)


def test_mixed_example_can_be_repeated():
    payload = BUILTIN_EXAMPLES['mixed']
    for _ in range(3):
        result = _post_solve(payload)
        assert result['ok'] is True
        assert math.isclose(result['objective_value'], 6.0)


def test_each_request_gets_fresh_slack_generator():
    first = build_simplex_problem(BUILTIN_EXAMPLES['equality'])
    second = build_simplex_problem(BUILTIN_EXAMPLES['equality'])
    assert first.slack_var_generator is not second.slack_var_generator
    assert next(first.slack_var_generator).name == 's3'
    assert next(second.slack_var_generator).name == 's3'


def test_automatic_phase_one_via_web_api():
    result = _post_solve(BUILTIN_EXAMPLES['mixed'])
    assert result['ok'] is True
    assert result['step_count'] >= 1


def test_unexpected_internal_error_returns_controlled_json():
    payload = _solve_payload()

    def explode(_self):
        raise RuntimeError('boom')

    with patch('sapro.webui.Simplex.solve', explode):
        status, _, body = _call_wsgi('POST', '/api/solve', json.dumps(payload).encode('utf-8'))

    assert status == 200
    result = json.loads(body.decode('utf-8'))
    assert result['ok'] is False
    assert result['status'] == 'internal_error'
    assert result['error_type'] == 'InternalError'
    assert 'unexpected internal error' in result['message'].lower()
    assert 'Traceback' not in json.dumps(result)
    assert 'webui.py' not in json.dumps(result)
    assert 'src/' not in json.dumps(result)
