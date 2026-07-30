#!/usr/bin/env python3
"""
Export Python simplex solver responses as JSON parity fixtures for the TS PWA.

Reads solver behavior from the installed ``sapro`` package without modifying
runtime code. Run from the repository root:

    python tools/export_parity_fixtures.py
"""

from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Any

from sapro.webui import solve_coefficient_request

REPO_ROOT = Path(__file__).resolve().parents[1]
FIXTURES_DIR = REPO_ROOT / 'web' / 'fixtures'

BUILTIN_EXAMPLES: dict[str, dict[str, Any]] = {
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


def _jsonify(value: Any) -> Any:
    if isinstance(value, dict):
        return {key: _jsonify(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_jsonify(item) for item in value]
    if isinstance(value, float):
        if math.isnan(value) or math.isinf(value):
            raise ValueError(f'non-finite float in fixture export: {value!r}')
        return value
    if hasattr(value, 'item'):
        return _jsonify(value.item())
    return value


def export_fixture(name: str, request: dict[str, Any], output_dir: Path) -> Path:
    response = _jsonify(solve_coefficient_request(request))
    payload = {
        'name': name,
        'request': request,
        'response': response,
    }
    output_path = output_dir / f'{name}.json'
    output_path.write_text(
        json.dumps(payload, indent=2, sort_keys=True) + '\n',
        encoding='utf-8',
    )
    return output_path


def main() -> None:
    FIXTURES_DIR.mkdir(parents=True, exist_ok=True)
    exported: list[str] = []
    for name, request in BUILTIN_EXAMPLES.items():
        export_fixture(name, request, FIXTURES_DIR)
        exported.append(name)

    readme_request = BUILTIN_EXAMPLES['readme']
    first = _jsonify(solve_coefficient_request(readme_request))
    second = _jsonify(solve_coefficient_request(readme_request))
    repeated_path = FIXTURES_DIR / 'repeated_solve_readme.json'
    repeated_path.write_text(
        json.dumps(
            {
                'name': 'repeated_solve_readme',
                'request': readme_request,
                'response_first': first,
                'response_second': second,
            },
            indent=2,
            sort_keys=True,
        )
        + '\n',
        encoding='utf-8',
    )
    exported.append('repeated_solve_readme')

    print(f'Exported {len(exported)} fixtures to {FIXTURES_DIR}:')
    for name in exported:
        print(f'  - {name}.json')


if __name__ == '__main__':
    main()
