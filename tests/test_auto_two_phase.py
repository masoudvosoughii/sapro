"""
Automatic Phase I orchestration tests (R8).
"""

from __future__ import annotations

import math
import warnings

import numpy as np
import pytest

from sapro.algebra import Variable
from sapro.error import Boundless, InvalidBase, IterationLimit, NumericalFailure, Unsolvable
from sapro.simplex import Simplex


def _consume_solve(problem: Simplex, **kwargs):
    return list(problem.solve(**kwargs))


def _pivot_steps(steps) -> list:
    return [step for step in steps if step.enter is not None]


# ---------------------------------------------------------------------------
# auto_two_phase validation
# ---------------------------------------------------------------------------


def test_default_auto_two_phase_is_enabled(var_gen):
    x1 = next(var_gen)
    problem = Simplex(x1, x1 <= 1, slack_var_generator=var_gen)
    assert problem.auto_two_phase is True


def test_explicit_auto_two_phase_true_accepted(var_gen):
    x1 = next(var_gen)
    problem = Simplex(x1, x1 <= 1, auto_two_phase=True, slack_var_generator=var_gen)
    assert problem.auto_two_phase is True


def test_explicit_auto_two_phase_false_accepted(var_gen):
    x1 = next(var_gen)
    problem = Simplex(x1, x1 <= 1, auto_two_phase=False, slack_var_generator=var_gen)
    assert problem.auto_two_phase is False


@pytest.mark.parametrize(
    "bad_value",
    [0, 1, "true", None],
    ids=["zero", "one", "string", "none"],
)
def test_non_boolean_auto_two_phase_rejected(var_gen, bad_value):
    x1 = next(var_gen)
    with pytest.raises(ValueError, match="auto_two_phase"):
        Simplex(x1, x1 <= 1, auto_two_phase=bad_value, slack_var_generator=var_gen)


# ---------------------------------------------------------------------------
# Automatic solve paths
# ---------------------------------------------------------------------------


def test_all_le_problem_skips_phase_one(var_gen):
    x1, x2 = next(var_gen), next(var_gen)
    problem = Simplex(
        x1 + 2 * x2,
        x1 + x2 <= 4,
        -2 * x1 + x2 <= 1,
        x1 <= 3,
        maximize=True,
        slack_var_generator=var_gen,
    )
    steps = _consume_solve(problem, yield_initial_tableau=True)
    assert not problem._phase_one_done
    assert math.isclose(problem.result.target_value, 7.0)
    assert len(_pivot_steps(steps)) == 3


def test_ge_problem_solves_with_one_solve_call(var_gen):
    x1 = next(var_gen)
    problem = Simplex(
        1 * x1,
        x1 >= 1,
        x1 <= 5,
        maximize=True,
        slack_var_generator=var_gen,
    )
    _consume_solve(problem)
    assert math.isclose(problem.result.target_value, 5.0)


def test_equality_problem_solves_with_one_solve_call(var_gen):
    x1, x2 = next(var_gen), next(var_gen)
    problem = Simplex(
        x1 + x2,
        x1 + x2 == 4,
        maximize=True,
        slack_var_generator=var_gen,
    )
    _consume_solve(problem)
    assert problem._phase_one_done
    assert math.isclose(problem.result.target_value, 4.0)


def test_mixed_operators_solve_with_one_solve_call(var_gen):
    x1, x2 = next(var_gen), next(var_gen)
    problem = Simplex(
        x1 + 2 * x2,
        x1 <= 4,
        x2 >= 1,
        x1 + x2 == 3,
        maximize=True,
        slack_var_generator=var_gen,
    )
    _consume_solve(problem)
    assert problem._phase_one_done
    by_name = {v.name: val for v, val in problem.result.variable_values.items()}
    assert math.isclose(problem.result.target_value, 6.0)
    assert math.isclose(by_name["x1"], 0.0)
    assert math.isclose(by_name["x2"], 3.0)


def test_minimization_with_phase_one_solves_with_one_call(var_gen):
    x1, x2 = next(var_gen), next(var_gen)
    problem = Simplex(
        x1 + x2,
        x1 + x2 == 4,
        maximize=False,
        slack_var_generator=var_gen,
    )
    _consume_solve(problem)
    assert math.isclose(problem.result.target_value, 4.0)


def test_bounded_maximization_with_phase_one_solves_with_one_call(var_gen):
    x1, x2 = next(var_gen), next(var_gen)
    problem = Simplex(
        x1 + x2,
        x1 >= 1,
        x2 >= 2,
        x1 <= 1,
        x2 <= 2,
        maximize=True,
        slack_var_generator=var_gen,
    )
    _consume_solve(problem)
    assert math.isclose(problem.result.target_value, 3.0)


def test_negative_rhs_solves_with_one_solve_call(var_gen):
    x1 = next(var_gen)
    problem = Simplex(
        1 * x1,
        x1 >= -5,
        x1 <= 3,
        maximize=True,
        slack_var_generator=var_gen,
    )
    _consume_solve(problem)
    assert math.isclose(problem.result.target_value, 3.0)


def test_infeasible_problem_raises_unsolvable_through_solve(var_gen):
    x1, x2 = next(var_gen), next(var_gen)
    problem = Simplex(
        x1 + x2,
        x1 >= 5,
        x2 >= 5,
        x1 + x2 <= 1,
        maximize=True,
        slack_var_generator=var_gen,
    )
    with pytest.raises(Unsolvable):
        _consume_solve(problem)


def test_unbounded_problem_still_raises_boundless(var_gen):
    x1, x2 = next(var_gen), next(var_gen)
    problem = Simplex(
        x1 + x2,
        x1 >= 1,
        x2 >= 2,
        maximize=True,
        slack_var_generator=var_gen,
    )
    with pytest.raises(Boundless, match="unbounded"):
        _consume_solve(problem)


def test_explicit_two_phase_then_solve_does_not_rerun_phase_one(var_gen):
    x1, x2 = next(var_gen), next(var_gen)
    problem = Simplex(
        x1 + x2,
        x1 + x2 == 4,
        maximize=True,
        slack_var_generator=var_gen,
    )
    phase_one = list(problem.two_phase())
    vars_after_phase_one = problem.variables.copy()
    phase_two = list(problem.solve())
    assert len(_pivot_steps(phase_one)) == 1
    assert problem.variables == vars_after_phase_one
    assert math.isclose(problem.result.target_value, 4.0)
    assert len(_pivot_steps(phase_two)) == 0


def test_automatic_solve_yields_phase_one_steps_before_phase_two(var_gen):
    x1, x2 = next(var_gen), next(var_gen)
    problem = Simplex(
        x1 + 2 * x2,
        x1 <= 4,
        x2 >= 1,
        x1 + x2 == 3,
        maximize=True,
        slack_var_generator=var_gen,
    )
    steps = _consume_solve(problem)
    pivot_steps = _pivot_steps(steps)
    assert len(pivot_steps) == 4
    assert any(
        step.leave is not None and step.leave.name.startswith("u")
        for step in pivot_steps[:3]
    )
    assert pivot_steps[-1].leave is not None
    assert not pivot_steps[-1].leave.name.startswith("u")


def test_no_duplicate_slack_variables_after_automatic_solve(var_gen):
    x1, x2 = next(var_gen), next(var_gen)
    problem = Simplex(
        x1 + x2,
        x1 + x2 == 4,
        maximize=True,
        slack_var_generator=var_gen,
    )
    _consume_solve(problem)
    names = [var.name for var in problem.variables]
    assert len(names) == len(set(names))
    assert sum(1 for name in names if name.startswith("x")) == 2


def test_artificial_variables_not_in_phase_two_variable_set(var_gen):
    x1, x2 = next(var_gen), next(var_gen)
    problem = Simplex(
        x1 + x2,
        x1 + x2 == 4,
        maximize=True,
        slack_var_generator=var_gen,
    )
    _consume_solve(problem)
    assert all(not var.name.startswith("u") for var in problem.variables)
    assert all(
        not var.name.startswith("u")
        for var in problem.result.variable_values
    )


def test_phase_one_snapshots_unchanged_after_automatic_phase_two(var_gen):
    x1, x2 = next(var_gen), next(var_gen)
    problem = Simplex(
        x1 + x2,
        x1 + x2 == 4,
        maximize=True,
        slack_var_generator=var_gen,
    )
    steps = _consume_solve(problem, yield_initial_tableau=True)
    first_pivot = _pivot_steps(steps)[0]
    saved_data = first_pivot.tableau.data.copy()
    saved_sigma = first_pivot.tableau.sigma.copy()
    saved_rhs = first_pivot.tableau.rhs.copy()
    saved_z = first_pivot.tableau.z

    assert np.array_equal(first_pivot.tableau.data, saved_data)
    assert np.array_equal(first_pivot.tableau.sigma, saved_sigma)
    assert np.array_equal(first_pivot.tableau.rhs, saved_rhs)
    assert first_pivot.tableau.z == saved_z


def test_phase_one_iteration_limit_during_automatic_solve(var_gen):
    x1, x2 = next(var_gen), next(var_gen)
    problem = Simplex(
        x1 + 2 * x2,
        x1 + x2 == 4,
        x1 <= 3,
        maximize=True,
        max_iterations=1,
        slack_var_generator=var_gen,
    )
    with pytest.raises(IterationLimit, match="Phase I"):
        _consume_solve(problem)


def test_phase_two_iteration_budget_resets_after_automatic_phase_one(var_gen):
    """
    eq+le needs 2 Phase I pivots and 1 Phase II pivot. With max_iterations=2,
    Phase I consumes its full allowance and Phase II still completes because
    solve() resets the pivot counter after automatic Phase I.
    """
    x1, x2 = next(var_gen), next(var_gen)
    problem = Simplex(
        x1 + 2 * x2,
        x1 + x2 == 4,
        x1 <= 3,
        maximize=True,
        max_iterations=2,
        slack_var_generator=var_gen,
    )
    steps = _consume_solve(problem)
    assert problem._phase_one_done
    assert math.isclose(problem.result.target_value, 8.0)
    assert len(_pivot_steps(steps)) == 3


def test_automatic_solve_phase_two_raises_iteration_limit(var_gen):
    x1, x2 = next(var_gen), next(var_gen)
    problem = Simplex(
        x1 + 2 * x2,
        x1 + x2 <= 4,
        -2 * x1 + x2 <= 1,
        x1 <= 3,
        maximize=True,
        max_iterations=2,
        slack_var_generator=var_gen,
    )
    with pytest.raises(IterationLimit, match="Phase II"):
        _consume_solve(problem)


def test_auto_two_phase_false_does_not_run_phase_one(var_gen):
    x1, x2 = next(var_gen), next(var_gen)
    problem = Simplex(
        x1 + x2,
        x1 + x2 == 4,
        maximize=True,
        auto_two_phase=False,
        slack_var_generator=var_gen,
    )
    with pytest.raises(InvalidBase, match="cannot determine base variables"):
        _consume_solve(problem)


def test_readme_example_still_correct_with_automatic_solve(var_gen):
    x1, x2 = next(var_gen), next(var_gen)
    problem = Simplex(
        x1 + 2 * x2,
        x1 + x2 <= 4,
        -2 * x1 + x2 <= 1,
        x1 <= 3,
        maximize=True,
        slack_var_generator=var_gen,
    )
    _consume_solve(problem)
    by_name = {v.name: val for v, val in problem.result.variable_values.items()}
    assert math.isclose(problem.result.target_value, 7.0)
    assert math.isclose(by_name["x1"], 1.0)
    assert math.isclose(by_name["x2"], 3.0)


def test_regressions_remain_green_with_automatic_solve(var_gen):
    x1, x2 = next(var_gen), next(var_gen)
    decimal_problem = Simplex(
        2.5 * x1 + 1.5 * x2,
        1.5 * x1 + x2 <= 4,
        x1 <= 2,
        maximize=True,
        slack_var_generator=var_gen,
    )
    _consume_solve(decimal_problem)
    assert math.isclose(decimal_problem.result.target_value, 6.5, abs_tol=1e-6)

    x1, x2 = next(var_gen), next(var_gen)
    unbounded = Simplex(
        x1 + x2,
        x1 - x2 <= 1,
        maximize=True,
        slack_var_generator=var_gen,
    )
    with pytest.raises(Boundless):
        _consume_solve(unbounded)

    x1 = next(var_gen)
    numerical = Simplex(x1, x1 <= 1, epsilon=1e-9, slack_var_generator=var_gen)
    with pytest.raises(NumericalFailure):
        numerical._apply_pivot(
            np.array([[1e-12, 1.0]]),
            np.array([1.0, 0.0]),
            np.array([1.0]),
            0,
            0,
            1,
        )


def test_automatic_solve_emits_no_runtime_warnings(var_gen):
    x1, x2 = next(var_gen), next(var_gen)

    def run():
        p = Simplex(
            x1 + x2,
            x1 + x2 == 4,
            maximize=True,
            slack_var_generator=var_gen,
        )
        _consume_solve(p)

    with warnings.catch_warnings():
        warnings.simplefilter("error", RuntimeWarning)
        run()
