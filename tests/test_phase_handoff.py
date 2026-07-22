"""
Phase I → Phase II handoff tests (R4).
"""

from __future__ import annotations

import math

import numpy as np
import pytest

from sapro.algebra import Variable
from sapro.error import Boundless
from sapro.simplex import Simplex


def _two_phase_then_solve(problem: Simplex):
    phase_one = list(problem.two_phase(yield_initial_tableau=True))
    phase_two = list(problem.solve(yield_initial_tableau=True))
    return phase_one, phase_two


def test_minimization_ge_phase_one_to_phase_two(var_gen):
    """
    min x1 + x2  s.t. x1 >= 1, x2 >= 2  =>  z = 3 at (1, 2).
    """
    x1, x2 = next(var_gen), next(var_gen)
    problem = Simplex(
        x1 + x2,
        x1 >= 1,
        x2 >= 2,
        maximize=False,
        slack_var_generator=var_gen,
    )

    _two_phase_then_solve(problem)

    assert math.isclose(problem.result.target_value, 3.0)


def test_equality_artificial_variable_phase_two(var_gen):
    """
    max x1 + x2  s.t. x1 + x2 == 4  =>  z = 4.
    """
    x1, x2 = next(var_gen), next(var_gen)
    problem = Simplex(
        x1 + x2,
        x1 + x2 == 4,
        maximize=True,
        slack_var_generator=var_gen,
    )

    _two_phase_then_solve(problem)

    assert math.isclose(problem.result.target_value, 4.0)


def test_mixed_le_ge_eq_phase_two(var_gen):
    """
    max x1 + 2*x2
    s.t. x1 <= 4
         x2 >= 1
         x1 + x2 == 3
    Expected: z = 6 at (0, 3).
    """
    x1, x2 = next(var_gen), next(var_gen)
    problem = Simplex(
        x1 + 2 * x2,
        x1 <= 4,
        x2 >= 1,
        x1 + x2 == 3,
        maximize=True,
        slack_var_generator=var_gen,
    )

    _two_phase_then_solve(problem)

    assert math.isclose(problem.result.target_value, 6.0)
    by_name = {v.name: val for v, val in problem.result.variable_values.items()}
    assert math.isclose(by_name["x1"], 0.0)
    assert math.isclose(by_name["x2"], 3.0)


def test_phase_two_after_negative_rhs_normalization(var_gen):
    """
    max x1  s.t. x1 >= -5, x1 <= 3  =>  z = 3.
    """
    x1 = next(var_gen)
    problem = Simplex(
        1 * x1,
        x1 >= -5,
        x1 <= 3,
        maximize=True,
        slack_var_generator=var_gen,
    )

    _two_phase_then_solve(problem)

    assert math.isclose(problem.result.target_value, 3.0)


def test_solve_after_two_phase_does_not_duplicate_slacks(var_gen):
    x1, x2 = next(var_gen), next(var_gen)
    problem = Simplex(
        x1 + x2,
        x1 >= 1,
        x2 >= 2,
        x1 <= 3,
        x2 <= 3,
        maximize=True,
        slack_var_generator=var_gen,
    )

    list(problem.two_phase())
    slack_before = problem._num_slack_vars
    vars_before = len(problem.variables)

    list(problem.solve())

    assert problem._num_slack_vars == slack_before
    assert len(problem.variables) == vars_before


def test_artificial_variables_not_in_phase_two_variables(var_gen):
    x1, x2 = next(var_gen), next(var_gen)
    problem = Simplex(
        x1 + x2,
        x1 >= 1,
        x2 >= 1,
        maximize=True,
        slack_var_generator=var_gen,
    )

    list(problem.two_phase())

    assert all(not v.name.startswith("u") for v in problem.variables)
    assert all(not v.name.startswith("u") for v in problem.base_vars)


def test_phase_one_snapshots_not_mutated_by_phase_two(var_gen):
    x1, x2 = next(var_gen), next(var_gen)
    problem = Simplex(
        x1 + x2,
        x1 >= 1,
        x2 >= 2,
        x1 <= 3,
        x2 <= 3,
        maximize=True,
        slack_var_generator=var_gen,
    )

    phase_one_steps = list(problem.two_phase(yield_initial_tableau=True))
    assert phase_one_steps

    first = phase_one_steps[0]
    saved = first.tableau.data.copy()

    list(problem.solve())

    assert np.array_equal(first.tableau.data, saved)


def test_readme_example_after_handoff_changes(var_gen):
    x1, x2 = next(var_gen), next(var_gen)
    problem = Simplex(
        x1 + 2 * x2,
        x1 + x2 <= 4,
        -2 * x1 + x2 <= 1,
        x1 <= 3,
        maximize=True,
        slack_var_generator=var_gen,
    )

    list(problem.solve())

    assert math.isclose(problem.result.target_value, 7.0)
    by_name = {v.name: val for v, val in problem.result.variable_values.items()}
    assert math.isclose(by_name["x1"], 1.0)
    assert math.isclose(by_name["x2"], 3.0)


def test_unbounded_still_raises_boundless_after_two_phase(var_gen):
    """
    max x1 + x2  s.t. x1 >= 1, x2 >= 2  is unbounded above; Phase II must
    raise Boundless once an improving direction has no finite leaving ratio.
    """
    x1, x2 = next(var_gen), next(var_gen)
    problem = Simplex(
        x1 + x2,
        x1 >= 1,
        x2 >= 2,
        maximize=True,
        slack_var_generator=var_gen,
    )

    list(problem.two_phase())

    with pytest.raises(Boundless, match="unbounded"):
        list(problem.solve())


def test_unbounded_without_two_phase_still_boundless(var_gen):
    x1, x2 = next(var_gen), next(var_gen)
    problem = Simplex(
        x1 + x2,
        x1 - x2 <= 1,
        maximize=True,
        slack_var_generator=var_gen,
    )

    with pytest.raises(Boundless, match="unbounded"):
        list(problem.solve())
