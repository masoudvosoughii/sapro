"""Regression tests for utility helpers (no solver logic)."""

from __future__ import annotations

import re
import warnings

from sapro.utils import parse_variable


def test_parse_variable_regex_is_raw_string_no_syntax_warning():
    """
    Regression: parse_variable used '^(.+?)(\\d+)$' without a raw string,
    triggering SyntaxWarning for invalid escape sequences.
    """
    with warnings.catch_warnings():
        warnings.simplefilter("error", SyntaxWarning)
        prefix, index = parse_variable("x3", default=None)

    assert prefix == "x"
    assert index == 3


def test_parse_variable_pattern_matches_trailing_digits():
    pattern = r"^(.+?)(\d+)$"
    assert re.match(pattern, "slack12").groups() == ("slack", "12")
