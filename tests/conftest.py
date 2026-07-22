"""Shared fixtures for sapro characterization tests."""

from __future__ import annotations

import pytest

from sapro.algebra import Variable


@pytest.fixture
def var_gen():
    """Fresh x1, x2, ... generator for each test."""
    return Variable.sequence("x")
