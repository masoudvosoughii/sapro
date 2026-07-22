"""Unit tests for constraint RHS normalization."""

from __future__ import annotations

import math

import pytest

from sapro.algebra import Constraint, Variable, normalize_constraint_rhs


def test_positive_le_constraint_unchanged():
    x1 = Variable("x1")
    original = x1 <= 4
    assert normalize_constraint_rhs(original) is original


def test_negative_le_flips_to_ge():
    x1 = Variable("x1")
    original = x1 <= -2
    normalized = normalize_constraint_rhs(original)

    assert normalized is not original
    assert normalized.operator == ">="
    assert normalized.rhs == 2
    assert normalized.coefficients[x1] == -1


def test_negative_ge_flips_to_le():
    x1 = Variable("x1")
    original = x1 >= -5
    normalized = normalize_constraint_rhs(original)

    assert normalized is not original
    assert normalized.operator == "<="
    assert normalized.rhs == 5
    assert normalized.coefficients[x1] == -1


def test_negative_equality_scales_both_sides():
    x1 = Variable("x1")
    original = Constraint({x1: 2}, -6, "==")
    normalized = normalize_constraint_rhs(original)

    assert normalized is not original
    assert normalized.operator == "=="
    assert normalized.rhs == 6
    assert normalized.coefficients[x1] == -2


def test_double_normalization_is_idempotent():
    x1 = Variable("x1")
    original = x1 <= -2
    once = normalize_constraint_rhs(original)
    twice = normalize_constraint_rhs(once)

    assert twice is once
    assert twice.rhs == 2


def test_feasible_negative_rhs_ge_with_upper_bound(var_gen):
    """
    max x1 s.t. x1 >= -5, x1 <= 3  =>  z = 3.
    """
    from sapro.simplex import Simplex

    x1 = next(var_gen)
    problem = Simplex(
        1 * x1,
        x1 >= -5,
        x1 <= 3,
        maximize=True,
        slack_var_generator=var_gen,
    )

    list(problem.two_phase())
    list(problem.solve())

    assert problem.result is not None
    assert math.isclose(problem.result.target_value, 3.0)


def test_feasible_flipped_negative_le(var_gen):
    """
    max x1 s.t. -x1 <= -2, x1 <= 5  =>  z = 5.
    """
    from sapro.simplex import Simplex

    x1 = next(var_gen)
    problem = Simplex(
        1 * x1,
        (-1) * x1 <= -2,
        x1 <= 5,
        maximize=True,
        slack_var_generator=var_gen,
    )

    list(problem.two_phase())
    list(problem.solve())

    assert problem.result is not None
    assert math.isclose(problem.result.target_value, 5.0)


def test_negative_rhs_equality_with_two_phase(var_gen):
    """
    max x1 s.t. x1 == -4 is infeasible with x1 >= 0, but x1 == 4 is feasible.
    Use x1 == 4 via -x1 == -4 before normalization.
    """
    from sapro.simplex import Simplex

    x1 = next(var_gen)
    problem = Simplex(
        1 * x1,
        (-1) * x1 == -4,
        maximize=True,
        slack_var_generator=var_gen,
    )

    list(problem.two_phase())
    list(problem.solve())

    assert problem.result is not None
    assert math.isclose(problem.result.target_value, 4.0)
