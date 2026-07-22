"""
Numerical tolerance and pivot-safety tests (R5/R6).
"""

from __future__ import annotations

import math
import warnings

import numpy as np
import pytest

from sapro.algebra import Variable
from sapro.error import Boundless, Cycle, NumericalFailure, Unsolvable
from sapro.simplex import DEFAULT_EPSILON, Simplex


def _consume_solve(problem: Simplex, **kwargs):
    return list(problem.solve(**kwargs))


def _consume_two_phase(problem: Simplex, **kwargs):
    return list(problem.two_phase(**kwargs))


def _var_values(result, *names: str) -> dict[str, float]:
    by_name = {var.name: value for var, value in result.variable_values.items()}
    return {name: by_name[name] for name in names}


# ---------------------------------------------------------------------------
# Epsilon configuration
# ---------------------------------------------------------------------------


def test_default_epsilon_when_omitted(var_gen):
    x1 = next(var_gen)
    problem = Simplex(x1, x1 <= 1, slack_var_generator=var_gen)
    assert problem.epsilon == DEFAULT_EPSILON
    assert problem.epsilon == pytest.approx(1e-9)


def test_custom_valid_epsilon_accepted(var_gen):
    x1 = next(var_gen)
    problem = Simplex(x1, x1 <= 1, epsilon=1e-6, slack_var_generator=var_gen)
    assert problem.epsilon == pytest.approx(1e-6)


@pytest.mark.parametrize(
    "bad_epsilon",
    [0, -1e-9, float("nan"), float("inf"), float("-inf")],
    ids=["zero", "negative", "nan", "inf", "neg_inf"],
)
def test_invalid_epsilon_rejected(var_gen, bad_epsilon):
    x1 = next(var_gen)
    with pytest.raises(ValueError, match="epsilon"):
        Simplex(x1, x1 <= 1, epsilon=bad_epsilon, slack_var_generator=var_gen)


# ---------------------------------------------------------------------------
# Pivot safety (_apply_pivot is the single validated pivot path)
# ---------------------------------------------------------------------------


def test_near_zero_pivot_raises_numerical_failure(var_gen):
    x1 = next(var_gen)
    problem = Simplex(x1, x1 <= 1, epsilon=1e-9, slack_var_generator=var_gen)
    data = np.array([[1e-12, 1.0]])
    sigma = np.array([1.0, 0.0])
    rhs = np.array([1.0])
    with pytest.raises(NumericalFailure, match="too close to zero"):
        problem._apply_pivot(data, sigma, rhs, enter_index=0, leave_index=0, M=1)


def test_valid_pivot_larger_than_epsilon_allowed(var_gen):
    x1 = next(var_gen)
    problem = Simplex(x1, x1 <= 1, epsilon=1e-9, slack_var_generator=var_gen)
    data = np.array([[2.0, 1.0]])
    sigma = np.array([1.0, 0.0])
    rhs = np.array([4.0])
    ratio = problem._apply_pivot(data, sigma, rhs, enter_index=0, leave_index=0, M=1)
    assert math.isfinite(ratio)
    assert data[0, 0] == pytest.approx(1.0)
    assert rhs[0] == pytest.approx(2.0)


# ---------------------------------------------------------------------------
# Reduced-cost / entering-variable tolerance
# ---------------------------------------------------------------------------


def test_near_zero_reduced_cost_treated_as_zero(var_gen):
    x1 = next(var_gen)
    problem = Simplex(x1, x1 <= 1, epsilon=1e-6, slack_var_generator=var_gen)
    sigma = np.array([5e-7, 0.0])
    assert problem._select_entering_var(sigma, maximize=True) is None


def test_improving_reduced_cost_still_selected(var_gen):
    x1 = next(var_gen)
    problem = Simplex(x1, x1 <= 1, epsilon=1e-9, slack_var_generator=var_gen)
    sigma = np.array([0.5, 0.0])
    assert problem._select_entering_var(sigma, maximize=True) == 0


# ---------------------------------------------------------------------------
# Phase I termination tolerance
# ---------------------------------------------------------------------------


def test_phase_one_objective_within_epsilon_accepted_as_zero(var_gen):
    x1, x2 = next(var_gen), next(var_gen)
    problem = Simplex(
        x1 + x2,
        x1 >= 1,
        x2 >= 2,
        maximize=False,
        epsilon=1e-6,
        slack_var_generator=var_gen,
    )
    assert problem._is_zero(5e-7)
    assert not problem._is_zero(5e-5)
    _consume_two_phase(problem)
    assert problem._phase_one_done


def test_phase_one_objective_outside_epsilon_not_accepted_as_zero(var_gen):
    x1, x2 = next(var_gen), next(var_gen)
    problem = Simplex(
        x1 + x2,
        x1 >= 5,
        x2 >= 5,
        x1 + x2 <= 1,
        maximize=True,
        epsilon=1e-9,
        slack_var_generator=var_gen,
    )
    with pytest.raises(Unsolvable):
        _consume_two_phase(problem)


# ---------------------------------------------------------------------------
# Residual cleaning
# ---------------------------------------------------------------------------


def test_tiny_residual_tableau_values_cleaned_to_zero(var_gen):
    x1 = next(var_gen)
    problem = Simplex(x1, x1 <= 1, epsilon=1e-9, slack_var_generator=var_gen)
    arr = np.array([1e-12, -1e-12, 1.0])
    problem._clean_near_zero(arr)
    assert arr[0] == 0.0
    assert arr[1] == 0.0
    assert arr[2] == pytest.approx(1.0)


# ---------------------------------------------------------------------------
# Regression: prior characterization cases remain correct
# ---------------------------------------------------------------------------


def test_decimal_coefficients_still_correct(var_gen):
    x1, x2 = next(var_gen), next(var_gen)
    problem = Simplex(
        2.5 * x1 + 1.5 * x2,
        1.5 * x1 + x2 <= 4,
        x1 <= 2,
        maximize=True,
        slack_var_generator=var_gen,
    )
    _consume_solve(problem)
    assert math.isclose(problem.result.target_value, 6.5, rel_tol=1e-9, abs_tol=1e-6)
    values = _var_values(problem.result, "x1", "x2")
    assert math.isclose(values["x1"], 2.0, abs_tol=1e-6)
    assert math.isclose(values["x2"], 1.0, abs_tol=1e-6)


def test_readme_example_still_returns_expected_solution(var_gen):
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
    values = _var_values(problem.result, "x1", "x2")
    assert math.isclose(values["x1"], 1.0)
    assert math.isclose(values["x2"], 3.0)


def test_negative_rhs_cases_still_pass(var_gen):
    x1 = next(var_gen)
    problem = Simplex(
        1 * x1,
        x1 >= -5,
        x1 <= 3,
        maximize=True,
        slack_var_generator=var_gen,
    )
    _consume_two_phase(problem)
    _consume_solve(problem)
    assert math.isclose(problem.result.target_value, 3.0)


def test_phase_one_to_phase_two_still_passes(var_gen):
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
    _consume_two_phase(problem)
    _consume_solve(problem)
    assert math.isclose(problem.result.target_value, 3.0)


def test_unbounded_problem_raises_boundless(var_gen):
    x1, x2 = next(var_gen), next(var_gen)
    problem = Simplex(
        x1 + x2,
        x1 - x2 <= 1,
        maximize=True,
        slack_var_generator=var_gen,
    )
    with pytest.raises(Boundless, match="unbounded"):
        _consume_solve(problem)


def test_repeated_basis_raises_cycle(var_gen):
    """
    _check_cycle is private, but it is the only Cycle raise site and has no
    stable public trigger without a constructed degenerate tableau sequence.
    """
    x1, x2 = next(var_gen), next(var_gen)
    problem = Simplex(
        x1 + x2,
        x1 <= 1,
        x2 <= 1,
        maximize=True,
        slack_var_generator=var_gen,
    )
    problem.canonicalize()
    s1, s2 = problem.variables[-2:]
    memo = {frozenset([s1, s2])}
    with pytest.raises(Cycle, match="cycle"):
        problem._check_cycle([s1, s2], memo)


def test_solver_runs_emit_no_runtime_warnings(var_gen):
    """Broad smoke test: common solve paths must not warn at runtime."""
    x1, x2 = next(var_gen), next(var_gen)

    def run_readme():
        p = Simplex(
            x1 + 2 * x2,
            x1 + x2 <= 4,
            -2 * x1 + x2 <= 1,
            x1 <= 3,
            maximize=True,
            slack_var_generator=var_gen,
        )
        _consume_solve(p)

    def run_two_phase():
        xa, xb = next(var_gen), next(var_gen)
        p = Simplex(
            xa + xb,
            xa >= 1,
            xb >= 2,
            xa <= 1,
            xb <= 2,
            maximize=True,
            slack_var_generator=var_gen,
        )
        _consume_two_phase(p)
        _consume_solve(p)

    def run_unbounded():
        xc, xd = next(var_gen), next(var_gen)
        p = Simplex(
            xc + xd,
            xc - xd <= 1,
            maximize=True,
            slack_var_generator=var_gen,
        )
        with pytest.raises(Boundless):
            _consume_solve(p)

    with warnings.catch_warnings():
        warnings.simplefilter("error", RuntimeWarning)
        run_readme()
        run_two_phase()
        run_unbounded()
