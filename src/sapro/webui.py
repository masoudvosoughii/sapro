from __future__ import annotations

from .algebra import Constraint, Expression, Variable
from .error import (
    Boundless,
    Cycle,
    InvalidBase,
    IterationLimit,
    LPError,
    NumericalFailure,
    Unsolvable,
)
from .simplex import LPStep, Simplex
from http import HTTPStatus
from math import isfinite
from wsgiref.simple_server import make_server
from wsgiref.util import FileWrapper
import json
import os

from .resources import index_html_path, static_asset_path

MAX_DIMENSION = 20
VALID_OPERATORS = {'<=', '>=', '=='}
STATIC_CONTENT_TYPES = {
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
}

INTERNAL_ERROR_RESPONSE = {
    'ok': False,
    'status': 'internal_error',
    'error_type': 'InternalError',
    'message': 'An unexpected internal error occurred while solving the problem.',
}


class WebUIValidationError(ValueError):
    'Raised when the coefficient-table request payload is invalid.'


def _http_status_line(status: HTTPStatus) -> str:
    return '{} {}'.format(int(status), status.phrase)


def _json_response(start_response, status: HTTPStatus, payload: dict) -> list[bytes]:
    body = json.dumps(payload).encode('utf-8')
    start_response(_http_status_line(status), [
        ('Content-Type', 'application/json; charset=utf-8'),
        ('Content-Length', str(len(body))),
    ])
    return [body]


def _file_response(start_response, path: str, content_type: str) -> list[bytes]:
    with open(path, 'rb') as handle:
        body = handle.read()
    start_response(_http_status_line(HTTPStatus.OK), [
        ('Content-Type', content_type),
        ('Content-Length', str(len(body))),
    ])
    return [body]


def _parse_number(value, label: str) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise WebUIValidationError(f'{label} must be a number')
    number = float(value)
    if not isfinite(number):
        raise WebUIValidationError(f'{label} must be finite')
    return number


def _validate_dimensions(num_vars: int, num_constraints: int) -> None:
    if num_vars < 1 or num_vars > MAX_DIMENSION:
        raise WebUIValidationError(
            f'objective must contain between 1 and {MAX_DIMENSION} coefficients'
        )
    if num_constraints < 1 or num_constraints > MAX_DIMENSION:
        raise WebUIValidationError(
            f'constraints must contain between 1 and {MAX_DIMENSION} rows'
        )


def parse_coefficient_request(body: bytes) -> dict:
    '''
    Validate and normalize a coefficient-table solve request.
    '''
    try:
        payload = json.loads(body.decode('utf-8'))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise WebUIValidationError('request body must be valid JSON') from exc

    if not isinstance(payload, dict):
        raise WebUIValidationError('request body must be a JSON object')

    optimization = payload.get('optimization')
    if optimization not in {'max', 'min'}:
        raise WebUIValidationError('optimization must be "max" or "min"')

    objective = payload.get('objective')
    if not isinstance(objective, list) or not objective:
        raise WebUIValidationError('objective must be a non-empty array')

    constraints = payload.get('constraints')
    if not isinstance(constraints, list) or not constraints:
        raise WebUIValidationError('constraints must be a non-empty array')

    num_vars = len(objective)
    num_constraints = len(constraints)
    _validate_dimensions(num_vars, num_constraints)

    parsed_objective = [
        _parse_number(value, f'objective[{index}]')
        for index, value in enumerate(objective)
    ]

    parsed_constraints = []
    for row_index, row in enumerate(constraints):
        if not isinstance(row, dict):
            raise WebUIValidationError(f'constraints[{row_index}] must be an object')

        coefficients = row.get('coefficients')
        if not isinstance(coefficients, list):
            raise WebUIValidationError(
                f'constraints[{row_index}].coefficients must be an array'
            )
        if len(coefficients) != num_vars:
            raise WebUIValidationError(
                f'constraints[{row_index}] must contain {num_vars} coefficients'
            )

        operator = row.get('operator')
        if operator not in VALID_OPERATORS:
            raise WebUIValidationError(
                f'constraints[{row_index}].operator must be one of <=, >=, =='
            )

        if 'rhs' not in row:
            raise WebUIValidationError(f'constraints[{row_index}].rhs is required')

        parsed_constraints.append({
            'coefficients': [
                _parse_number(value, f'constraints[{row_index}].coefficients[{col_index}]')
                for col_index, value in enumerate(coefficients)
            ],
            'operator': operator,
            'rhs': _parse_number(row['rhs'], f'constraints[{row_index}].rhs'),
        })

    return {
        'optimization': optimization,
        'objective': parsed_objective,
        'constraints': parsed_constraints,
    }


def _slack_var_generator(num_decision_vars: int):
    '''
    Return a fresh infinite slack/surplus generator that cannot collide with
    decision variables named x1..xn.
    '''
    return Variable.sequence('s', start=num_decision_vars + 1)


def build_simplex_problem(request: dict) -> Simplex:
    variables = [Variable(f'x{index}') for index in range(1, len(request['objective']) + 1)]
    var_map = {f'x{index}': variables[index - 1] for index in range(1, len(variables) + 1)}
    objective = Expression({
        var_map[f'x{index}']: coef
        for index, coef in enumerate(request['objective'], start=1)
    })

    constraints = []
    for row in request['constraints']:
        coef_map = {
            var_map[f'x{index}']: value
            for index, value in enumerate(row['coefficients'], start=1)
        }
        constraints.append(Constraint(coef_map, row['rhs'], row['operator']))

    slack_gen = _slack_var_generator(len(variables))
    return Simplex(
        objective,
        *constraints,
        vs=variables,
        maximize=(request['optimization'] == 'max'),
        slack_var_generator=slack_gen,
    )


def map_lp_error(error: LPError) -> tuple[str, str, str]:
    if isinstance(error, Unsolvable):
        return 'infeasible', 'Unsolvable', 'The problem has no feasible solution.'
    if isinstance(error, Boundless):
        return 'unbounded', 'Boundless', 'The problem is unbounded.'
    if isinstance(error, Cycle):
        return 'cycle', 'Cycle', 'The simplex algorithm encountered a cycling basis.'
    if isinstance(error, NumericalFailure):
        return 'numerical_failure', 'NumericalFailure', 'The solver encountered a numerical failure.'
    if isinstance(error, IterationLimit):
        return 'iteration_limit', 'IterationLimit', str(error)
    if isinstance(error, InvalidBase):
        return 'invalid_input', 'InvalidBase', 'A valid initial basis is not available.'
    return 'error', type(error).__name__, str(error)


def _is_pivot_step(step: LPStep) -> bool:
    return step.enter is not None


def collect_tagged_steps(problem: Simplex) -> tuple[list[tuple[LPStep, str, int]], dict[str, int]]:
    '''
    Run the solver and tag each yielded pivot step with its phase.

    Phase boundaries follow the same orchestration as ``Simplex.solve()`` with
    ``auto_two_phase`` enabled, without inferring phase from variable names.
    '''
    tagged: list[tuple[LPStep, str, int]] = []
    phase_one_count = 0
    phase_two_count = 0

    def append_step(step: LPStep, phase: str) -> None:
        nonlocal phase_one_count, phase_two_count
        if phase == 'phase_one':
            if _is_pivot_step(step):
                phase_one_count += 1
                phase_iteration = phase_one_count
            else:
                phase_iteration = 0
        elif _is_pivot_step(step):
            phase_two_count += 1
            phase_iteration = phase_two_count
        else:
            phase_iteration = 0
        tagged.append((step, phase, phase_iteration))

    if problem.auto_two_phase and problem._requires_phase_one():
        for step in problem.two_phase():
            append_step(step, 'phase_one')
        for step in problem.solve():
            append_step(step, 'phase_two')
    else:
        for step in problem.solve():
            append_step(step, 'phase_two')

    total = phase_one_count + phase_two_count
    phase_counts = {
        'phase_one': phase_one_count,
        'phase_two': phase_two_count,
        'total': total,
    }
    return tagged, phase_counts


def encode_step(index: int, step: LPStep, phase: str, phase_iteration: int) -> dict:
    payload = {
        'index': index,
        'enter': None if step.enter is None else step.enter.name,
        'leave': None if step.leave is None else step.leave.name,
        'tableau': step.tableau.to_frame(),
        'phase': phase,
    }
    if phase_iteration > 0:
        payload['phase_iteration'] = phase_iteration
    return payload


def solve_coefficient_request(request: dict) -> dict:
    try:
        problem = build_simplex_problem(request)
        tagged_steps: list[tuple[LPStep, str, int]] = []
        phase_counts = {'phase_one': 0, 'phase_two': 0, 'total': 0}
        try:
            tagged_steps, phase_counts = collect_tagged_steps(problem)
        except LPError as error:
            status, error_type, message = map_lp_error(error)
            return {
                'ok': False,
                'status': status,
                'error_type': error_type,
                'message': message,
            }

        result = problem.result
        if result is None:
            return {
                'ok': False,
                'status': 'error',
                'error_type': 'SolverError',
                'message': 'The solver did not produce a result.',
            }

        decision_values = {
            variable.name: value
            for variable, value in result.variable_values.items()
            if variable.name.startswith('x')
        }

        return {
            'ok': True,
            'status': 'optimal',
            'status_label': 'Optimal solution found.',
            'objective_value': result.target_value,
            'variable_values': decision_values,
            'step_count': phase_counts['total'],
            'phase_counts': phase_counts,
            'steps': [
                encode_step(index, step, phase, phase_iteration)
                for index, (step, phase, phase_iteration) in enumerate(tagged_steps, start=1)
            ],
        }
    except LPError as error:
        status, error_type, message = map_lp_error(error)
        return {
            'ok': False,
            'status': status,
            'error_type': error_type,
            'message': message,
        }
    except Exception:
        return dict(INTERNAL_ERROR_RESPONSE)


def application(environ, start_response):
    method = environ.get('REQUEST_METHOD', 'GET')
    path = environ.get('PATH_INFO', '/')

    if method == 'GET' and path == '/':
        return _file_response(
            start_response,
            str(index_html_path()),
            'text/html; charset=utf-8',
        )

    if method == 'GET' and path.startswith('/static/'):
        filename = os.path.basename(path)
        extension = os.path.splitext(filename)[1].lower()
        if extension not in STATIC_CONTENT_TYPES:
            start_response(_http_status_line(HTTPStatus.NOT_FOUND), [])
            return []
        asset_path = static_asset_path(filename)
        if not asset_path.is_file():
            start_response(_http_status_line(HTTPStatus.NOT_FOUND), [])
            return []
        return _file_response(start_response, str(asset_path), STATIC_CONTENT_TYPES[extension])

    if method == 'POST' and path == '/api/solve':
        try:
            body_size = int(environ.get('CONTENT_LENGTH', '0'))
        except ValueError:
            body_size = 0
        body = environ['wsgi.input'].read(body_size)
        try:
            request = parse_coefficient_request(body)
            payload = solve_coefficient_request(request)
        except WebUIValidationError as error:
            payload = {
                'ok': False,
                'status': 'invalid_input',
                'error_type': 'ValidationError',
                'message': str(error),
            }
        except Exception:
            payload = dict(INTERNAL_ERROR_RESPONSE)
        return _json_response(start_response, HTTPStatus.OK, payload)

    start_response(_http_status_line(HTTPStatus.NOT_FOUND), [])
    return []


def run_app(host: str = '127.0.0.1', port: int = 5678):
    server = make_server(host, port, application)
    server.serve_forever()
