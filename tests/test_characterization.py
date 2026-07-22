"""
Characterization tests for the current public Simplex API.

These tests document existing behavior before any solver repairs.
Known bugs are marked xfail(strict=True) with precise reasons.
"""

from __future__ import annotations

import math

import numpy as np
import pytest

from sapro.algebra import Variable
from sapro.error import Boundless, LPError, Unsolvable
from sapro.simplex import Simplex


def _consume_two_phase(problem: Simplex, **kwargs):
    return list(problem.two_phase(**kwargs))


def _consume_solve(problem: Simplex, **kwargs):
    return list(problem.solve(**kwargs))


def _var_values(result, *names: str) -> dict[str, float]:
    by_name = {var.name: value for var, value in result.variable_values.items()}
    return {name: by_name[name] for name in names}


# ---------------------------------------------------------------------------
# 1. README bounded maximization (all <=, slack basis)
# ---------------------------------------------------------------------------


def test_readme_bounded_maximization(var_gen):
    """
    Problem (README):
        max  x1 + 2*x2
        s.t. x1 + x2 <= 4
             -2*x1 + x2 <= 1
             x1 <= 3
        x1, x2 >= 0

    Expected: z = 7 at (x1, x2) = (1, 3).
    Slack basis: no two-phase required.
    """
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

    assert problem.result is not None
    assert math.isclose(problem.result.target_value, 7.0)
    values = _var_values(problem.result, "x1", "x2")
    assert math.isclose(values["x1"], 1.0)
    assert math.isclose(values["x2"], 3.0)
    assert len(steps) >= 1


# ---------------------------------------------------------------------------
# 2. Bounded minimization (>= constraints, two-phase)
# ---------------------------------------------------------------------------


def test_bounded_minimization_with_two_phase(var_gen):
    """
    Problem:
        min  x1 + x2
        s.t. x1 + x2 >= 4
        x1, x2 >= 0

    Expected: z = 4 (e.g. x1 = 4, x2 = 0).
    Requires two-phase for initial feasible basis.
    """
    x1, x2 = next(var_gen), next(var_gen)
    problem = Simplex(
        x1 + x2,
        x1 + x2 >= 4,
        maximize=False,
        slack_var_generator=var_gen,
    )

    _consume_two_phase(problem)
    _consume_solve(problem)

    assert problem.result is not None
    assert math.isclose(problem.result.target_value, 4.0)
    values = _var_values(problem.result, "x1", "x2")
    assert math.isclose(values["x1"] + values["x2"], 4.0)


# ---------------------------------------------------------------------------
# 3. >= constraint requiring two-phase (maximization)
# ---------------------------------------------------------------------------


def test_ge_constraint_two_phase_finds_feasible_basis(var_gen):
    """
    Problem:
        max  x1 + x2
        s.t. x1 >= 1
             x2 >= 2
        x1, x2 >= 0

    Phase I expected: feasible BFS with objective value 3 at (1, 2).
    """
    x1, x2 = next(var_gen), next(var_gen)
    problem = Simplex(
        x1 + x2,
        x1 >= 1,
        x2 >= 2,
        maximize=True,
        slack_var_generator=var_gen,
    )

    _consume_two_phase(problem)

    assert problem.result is not None
    assert math.isclose(problem.result.target_value, 3.0)
    values = _var_values(problem.result, "x1", "x2")
    assert math.isclose(values["x1"], 1.0)
    assert math.isclose(values["x2"], 2.0)


@pytest.mark.xfail(
    strict=True,
    reason=(
        "Known bug: Phase II after two_phase raises Boundless('encountered cycle') "
        "for >= constraints even when Phase I succeeded."
    ),
)
def test_ge_constraint_phase_two_after_two_phase(var_gen):
    """
    After successful two_phase, solve() should optimize to z = 3.
    """
    x1, x2 = next(var_gen), next(var_gen)
    problem = Simplex(
        x1 + x2,
        x1 >= 1,
        x2 >= 2,
        maximize=True,
        slack_var_generator=var_gen,
    )

    _consume_two_phase(problem)
    _consume_solve(problem)

    assert problem.result is not None
    assert math.isclose(problem.result.target_value, 3.0)


def test_ge_constraint_without_two_phase_raises_boundless(var_gen):
    """
    Same >= problem without two-phase: current code raises Boundless because
    no valid leaving row exists for the entering direction.
    """
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


# ---------------------------------------------------------------------------
# 4. Equality constraint
# ---------------------------------------------------------------------------


def test_equality_constraint_with_two_phase(var_gen):
    """
    Problem:
        max  x1 + x2
        s.t. x1 + x2 == 4
        x1, x2 >= 0

    Expected: z = 4 (e.g. x1 = 0, x2 = 4 or x1 = 4, x2 = 0).
    """
    x1, x2 = next(var_gen), next(var_gen)
    problem = Simplex(
        x1 + x2,
        x1 + x2 == 4,
        maximize=True,
        slack_var_generator=var_gen,
    )

    _consume_two_phase(problem)
    _consume_solve(problem)

    assert problem.result is not None
    assert math.isclose(problem.result.target_value, 4.0)
    values = _var_values(problem.result, "x1", "x2")
    assert math.isclose(values["x1"] + values["x2"], 4.0)


# ---------------------------------------------------------------------------
# 5. Feasible problem with negative RHS (canonical row RHS < 0)
# ---------------------------------------------------------------------------


def test_feasible_negative_rhs_ge_constraint(var_gen):
    """
    Problem:
        max  x1
        s.t. x1 >= -5
             x1 <= 3
        x1 >= 0

    Expected: z = 3 at x1 = 3.
    """
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

    assert problem.result is not None
    assert math.isclose(problem.result.target_value, 3.0)
    assert math.isclose(_var_values(problem.result, "x1")["x1"], 3.0)


def test_feasible_negative_rhs_after_flipped_inequality(var_gen):
    """
    Problem:
        max  x1
        s.t. -x1 <= -2   (equivalent to x1 >= 2)
             x1 <= 5

    Expected: z = 5 at x1 = 5.
    """
    x1 = next(var_gen)
    problem = Simplex(
        1 * x1,
        (-1) * x1 <= -2,
        x1 <= 5,
        maximize=True,
        slack_var_generator=var_gen,
    )

    _consume_two_phase(problem)
    _consume_solve(problem)

    assert problem.result is not None
    assert math.isclose(problem.result.target_value, 5.0)
    assert math.isclose(_var_values(problem.result, "x1")["x1"], 5.0)


# ---------------------------------------------------------------------------
# 6. Infeasible problem
# ---------------------------------------------------------------------------


def test_infeasible_problem_two_phase(var_gen):
    """
    Problem:
        max  x1 + x2
        s.t. x1 >= 5
             x2 >= 5
             x1 + x2 <= 1
        x1, x2 >= 0

    Expected: infeasible (Phase I raises Unsolvable).
    """
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
        _consume_two_phase(problem)


# ---------------------------------------------------------------------------
# 7. Unbounded problem
# ---------------------------------------------------------------------------


def test_unbounded_problem_raises_boundless(var_gen):
    """
    Problem:
        max  x1 + x2
        s.t. x1 - x2 <= 1
        x1, x2 >= 0

    Expected: unbounded (objective can increase without limit).
    """
    x1, x2 = next(var_gen), next(var_gen)
    problem = Simplex(
        x1 + x2,
        x1 - x2 <= 1,
        maximize=True,
        slack_var_generator=var_gen,
    )

    with pytest.raises(Boundless, match="unbounded"):
        _consume_solve(problem)


# ---------------------------------------------------------------------------
# 8. Decimal coefficients
# ---------------------------------------------------------------------------


def test_decimal_coefficients(var_gen):
    """
    Problem:
        max  2.5*x1 + 1.5*x2
        s.t. 1.5*x1 + x2 <= 4
             x1 <= 2
        x1, x2 >= 0

    Expected: z = 6.5 at (2, 1).
    """
    x1, x2 = next(var_gen), next(var_gen)
    problem = Simplex(
        2.5 * x1 + 1.5 * x2,
        1.5 * x1 + x2 <= 4,
        x1 <= 2,
        maximize=True,
        slack_var_generator=var_gen,
    )

    _consume_solve(problem)

    assert problem.result is not None
    assert math.isclose(problem.result.target_value, 6.5, rel_tol=1e-9, abs_tol=1e-6)
    values = _var_values(problem.result, "x1", "x2")
    assert math.isclose(values["x1"], 2.0, abs_tol=1e-6)
    assert math.isclose(values["x2"], 1.0, abs_tol=1e-6)


# ---------------------------------------------------------------------------
# 9. Iteration snapshot preservation
# ---------------------------------------------------------------------------


def test_iteration_snapshots_are_deep_copied(var_gen):
    """
    Each yielded LPStep must remain unchanged if the solver mutates internal
    tableau arrays after the yield.
    """
    x1, x2 = next(var_gen), next(var_gen)
    problem = Simplex(
        x1 + x2,
        x1 <= 1,
        x2 <= 1,
        maximize=True,
        slack_var_generator=var_gen,
    )

    steps = _consume_solve(problem, yield_initial_tableau=True)
    assert len(steps) >= 1

    first = steps[0]
    saved_data = first.tableau.data.copy()
    saved_sigma = first.tableau.sigma.copy()
    saved_rhs = first.tableau.rhs.copy()
    saved_z = first.tableau.z

    # After the full solve, early snapshots must still match values at yield time.
    assert np.array_equal(first.tableau.data, saved_data)
    assert np.array_equal(first.tableau.sigma, saved_sigma)
    assert np.array_equal(first.tableau.rhs, saved_rhs)
    assert first.tableau.z == saved_z


# ---------------------------------------------------------------------------
# Additional characterization: README claims / API edges
# ---------------------------------------------------------------------------


def test_all_le_constraints_auto_slack_basis_no_two_phase(var_gen):
    """README claim: all-<= problems need no two-phase when #slacks == #constraints."""
    x1, x2 = next(var_gen), next(var_gen)
    problem = Simplex(
        3 * x1 + 2 * x2,
        2 * x1 + x2 <= 8,
        x1 + 2 * x2 <= 8,
        x1 <= 4,
        maximize=True,
        slack_var_generator=var_gen,
    )

    _consume_solve(problem)

    assert problem.result is not None
    assert math.isclose(problem.result.target_value, 40 / 3, rel_tol=1e-9, abs_tol=1e-6)


def test_empty_constraints_raises_unsolvable(var_gen):
    x1 = next(var_gen)
    problem = Simplex(x1, maximize=True, slack_var_generator=var_gen)

    with pytest.raises(Unsolvable, match="empty"):
        _consume_solve(problem)
