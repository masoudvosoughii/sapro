"""
Iteration limit tests (R7).
"""

from __future__ import annotations

import math
import warnings

import numpy as np
import pytest

from sapro.algebra import Variable
from sapro.error import Boundless, IterationLimit, NumericalFailure
from sapro.simplex import DEFAULT_MAX_ITERATIONS, Simplex


def _consume_solve(problem: Simplex, **kwargs):
    return list(problem.solve(**kwargs))


def _consume_two_phase(problem: Simplex, **kwargs):
    return list(problem.two_phase(**kwargs))


def _pivot_steps(steps) -> list:
    return [step for step in steps if step.enter is not None]


# ---------------------------------------------------------------------------
# max_iterations validation
# ---------------------------------------------------------------------------


def test_default_max_iterations_accepted(var_gen):
    x1 = next(var_gen)
    problem = Simplex(x1, x1 <= 1, slack_var_generator=var_gen)
    assert problem.max_iterations == DEFAULT_MAX_ITERATIONS
    assert problem.max_iterations == 10_000


def test_custom_positive_integer_max_iterations_accepted(var_gen):
    x1 = next(var_gen)
    problem = Simplex(x1, x1 <= 1, max_iterations=500, slack_var_generator=var_gen)
    assert problem.max_iterations == 500


@pytest.mark.parametrize(
    "bad_limit",
    [
        0,
        -1,
        True,
        False,
        1.0,
        float("nan"),
        float("inf"),
        "100",
        None,
    ],
    ids=["zero", "negative", "true", "false", "float", "nan", "inf", "string", "none"],
)
def test_invalid_max_iterations_rejected(var_gen, bad_limit):
    x1 = next(var_gen)
    with pytest.raises(ValueError, match="max_iterations"):
        Simplex(x1, x1 <= 1, max_iterations=bad_limit, slack_var_generator=var_gen)


# ---------------------------------------------------------------------------
# Pivot counting semantics
#
# Under the current first-improving entering rule:
# - max 0*x1 s.t. x1 <= 4  => 0 pivots (slack basis is optimal)
# - max x1   s.t. x1 <= 3  => 1 pivot
# - README bounded max     => 3 primal pivots
# - min x1+x2, x1>=1,x2>=2 => 2 Phase I pivots in two_phase()
# - same min problem in solve() without two_phase => 2 dual-repair pivots
# ---------------------------------------------------------------------------


def test_zero_pivot_solution_succeeds_with_small_limit(var_gen):
    x1 = next(var_gen)
    problem = Simplex(
        0 * x1,
        x1 <= 4,
        maximize=True,
        max_iterations=1,
        slack_var_generator=var_gen,
    )
    steps = _consume_solve(problem)
    assert len(_pivot_steps(steps)) == 0
    assert problem.result is not None


def test_one_pivot_solution_succeeds_with_limit_one(var_gen):
    x1 = next(var_gen)
    problem = Simplex(
        1 * x1,
        x1 <= 3,
        maximize=True,
        max_iterations=1,
        slack_var_generator=var_gen,
    )
    steps = _consume_solve(problem)
    assert len(_pivot_steps(steps)) == 1
    assert math.isclose(problem.result.target_value, 3.0)


def test_insufficient_limit_raises_iteration_limit(var_gen):
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
    with pytest.raises(IterationLimit, match="Phase II") as exc:
        _consume_solve(problem)
    assert "after 2 pivots" in str(exc.value)
    assert "max_iterations=2" in str(exc.value)


def test_iteration_limit_message_identifies_phase(var_gen):
    x1, x2 = next(var_gen), next(var_gen)
    phase_one = Simplex(
        x1 + x2,
        x1 >= 1,
        x2 >= 2,
        maximize=False,
        max_iterations=1,
        slack_var_generator=var_gen,
    )
    with pytest.raises(IterationLimit, match="Phase I"):
        _consume_two_phase(phase_one)

    x1, x2 = next(var_gen), next(var_gen)
    phase_two = Simplex(
        x1 + 2 * x2,
        x1 + x2 <= 4,
        -2 * x1 + x2 <= 1,
        x1 <= 3,
        maximize=True,
        max_iterations=2,
        slack_var_generator=var_gen,
    )
    with pytest.raises(IterationLimit, match="Phase II exceeded"):
        _consume_solve(phase_two)


def test_phase_one_limit_enforced(var_gen):
    x1, x2 = next(var_gen), next(var_gen)
    problem = Simplex(
        x1 + x2,
        x1 >= 1,
        x2 >= 2,
        maximize=False,
        max_iterations=1,
        slack_var_generator=var_gen,
    )
    with pytest.raises(IterationLimit, match="Phase I"):
        _consume_two_phase(problem)


def test_phase_two_primal_limit_enforced(var_gen):
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
    with pytest.raises(IterationLimit, match="Phase II exceeded"):
        _consume_solve(problem)


def test_dual_repair_limit_enforced(var_gen):
    """
    min x1+x2 s.t. x1>=1, x2>=2 needs 2 dual-repair pivots in solve() when
    two_phase() is not used (0 primal pivots, 2 dual pivots).
    """
    x1, x2 = next(var_gen), next(var_gen)
    problem = Simplex(
        x1 + x2,
        x1 >= 1,
        x2 >= 2,
        maximize=False,
        max_iterations=1,
        slack_var_generator=var_gen,
    )
    with pytest.raises(IterationLimit, match="Phase II dual repair"):
        _consume_solve(problem)


def test_counters_reset_between_two_phase_and_solve(var_gen):
    x1, x2 = next(var_gen), next(var_gen)
    problem = Simplex(
        x1 + x2,
        x1 >= 1,
        x2 >= 2,
        maximize=False,
        max_iterations=2,
        slack_var_generator=var_gen,
    )
    _consume_two_phase(problem)
    steps = _consume_solve(problem)
    assert len(_pivot_steps(steps)) == 0


def test_counters_reset_between_independent_solve_invocations(var_gen):
    x1 = next(var_gen)
    problem = Simplex(
        1 * x1,
        x1 <= 3,
        maximize=True,
        max_iterations=1,
        slack_var_generator=var_gen,
    )
    first = _consume_solve(problem)
    assert len(_pivot_steps(first)) == 1
    second = _consume_solve(problem)
    assert len(_pivot_steps(second)) == 0
    assert math.isclose(problem.result.target_value, 3.0)

    x1 = next(var_gen)
    for _ in range(2):
        fresh = Simplex(
            1 * x1,
            x1 <= 3,
            maximize=True,
            max_iterations=1,
            slack_var_generator=var_gen,
        )
        steps = _consume_solve(fresh)
        assert len(_pivot_steps(steps)) == 1


def test_snapshots_unchanged_after_iteration_limit(var_gen):
    x1, x2 = next(var_gen), next(var_gen)
    problem = Simplex(
        x1 + 2 * x2,
        x1 + x2 <= 4,
        -2 * x1 + x2 <= 1,
        x1 <= 3,
        maximize=True,
        max_iterations=1,
        slack_var_generator=var_gen,
    )
    steps = []
    with pytest.raises(IterationLimit):
        for step in problem.solve(yield_initial_tableau=True):
            steps.append(step)

    assert len(steps) >= 2
    first_pivot = steps[1]
    saved_data = first_pivot.tableau.data.copy()
    saved_sigma = first_pivot.tableau.sigma.copy()
    saved_rhs = first_pivot.tableau.rhs.copy()
    saved_z = first_pivot.tableau.z

    assert np.array_equal(first_pivot.tableau.data, saved_data)
    assert np.array_equal(first_pivot.tableau.sigma, saved_sigma)
    assert np.array_equal(first_pivot.tableau.rhs, saved_rhs)
    assert first_pivot.tableau.z == saved_z


# ---------------------------------------------------------------------------
# Regression with default limit
# ---------------------------------------------------------------------------


def test_readme_bounded_maximization_with_default_limit(var_gen):
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
    assert math.isclose(problem.result.target_value, 7.0)


def test_regressions_remain_green_with_default_limit(var_gen):
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

    x1 = next(var_gen)
    negative_rhs = Simplex(
        1 * x1,
        x1 >= -5,
        x1 <= 3,
        maximize=True,
        slack_var_generator=var_gen,
    )
    _consume_two_phase(negative_rhs)
    _consume_solve(negative_rhs)
    assert math.isclose(negative_rhs.result.target_value, 3.0)

    x1, x2 = next(var_gen), next(var_gen)
    phase_handoff = Simplex(
        x1 + x2,
        x1 >= 1,
        x2 >= 2,
        x1 <= 1,
        x2 <= 2,
        maximize=True,
        slack_var_generator=var_gen,
    )
    _consume_two_phase(phase_handoff)
    _consume_solve(phase_handoff)
    assert math.isclose(phase_handoff.result.target_value, 3.0)

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
    data = np.array([[1e-12, 1.0]])
    sigma = np.array([1.0, 0.0])
    rhs = np.array([1.0])
    with pytest.raises(NumericalFailure):
        numerical._apply_pivot(data, sigma, rhs, enter_index=0, leave_index=0, M=1)


def test_solver_runs_emit_no_runtime_warnings(var_gen):
    x1, x2 = next(var_gen), next(var_gen)

    def run_with_limit():
        p = Simplex(
            x1 + 2 * x2,
            x1 + x2 <= 4,
            -2 * x1 + x2 <= 1,
            x1 <= 3,
            maximize=True,
            max_iterations=10_000,
            slack_var_generator=var_gen,
        )
        _consume_solve(p)

    def run_limit_failure():
        xa, xb = next(var_gen), next(var_gen)
        p = Simplex(
            xa + xb,
            xa >= 1,
            xb >= 2,
            maximize=False,
            max_iterations=1,
            slack_var_generator=var_gen,
        )
        with pytest.raises(IterationLimit):
            _consume_solve(p)

    with warnings.catch_warnings():
        warnings.simplefilter("error", RuntimeWarning)
        run_with_limit()
        run_limit_failure()
