"""Unit tests for deterministic normalization — no DB, no OpenAI required."""

import pytest
from app.services.normalization import (
    normalize_email,
    normalize_field,
    normalize_notice_period_days,
    normalize_phone,
    normalize_salary_bound,
    normalize_years_experience,
)


class TestNormalizeEmail:
    def test_valid_email_lowercased(self):
        assert normalize_email("John.Smith@Example.COM") == "john.smith@example.com"

    def test_strips_whitespace(self):
        assert normalize_email("  alice@corp.io  ") == "alice@corp.io"

    def test_invalid_email_returns_none(self):
        assert normalize_email("not-an-email") is None

    def test_missing_tld_returns_none(self):
        assert normalize_email("user@domain") is None

    def test_none_input(self):
        assert normalize_email(None) is None

    def test_empty_string(self):
        assert normalize_email("") is None


class TestNormalizePhone:
    def test_ten_digit_us_number(self):
        assert normalize_phone("4155551234") == "(415) 555-1234"

    def test_formatted_us_number(self):
        assert normalize_phone("(415) 555-1234") == "(415) 555-1234"

    def test_dashes_format(self):
        assert normalize_phone("415-555-1234") == "(415) 555-1234"

    def test_eleven_digit_with_country_code(self):
        assert normalize_phone("14155551234") == "+1 (415) 555-1234"

    def test_none_input(self):
        assert normalize_phone(None) is None

    def test_unrecognized_format_returned_unchanged(self):
        result = normalize_phone("+44 20 7946 0958")
        assert result == "+44 20 7946 0958"


class TestNormalizeYearsExperience:
    def test_positive_float_rounded(self):
        assert normalize_years_experience(8.0) == 8.0
        assert normalize_years_experience(4.567) == 4.6

    def test_negative_clamped_to_zero(self):
        assert normalize_years_experience(-2.0) == 0.0

    def test_integer_input(self):
        assert normalize_years_experience(10) == 10.0

    def test_none_input(self):
        assert normalize_years_experience(None) is None

    def test_zero(self):
        assert normalize_years_experience(0) == 0.0


class TestNormalizeNoticePeriodDays:
    def test_standard_values(self):
        assert normalize_notice_period_days(0) == 0
        assert normalize_notice_period_days(14) == 14
        assert normalize_notice_period_days(90) == 90

    def test_negative_clamped_to_zero(self):
        assert normalize_notice_period_days(-5) == 0

    def test_none_input(self):
        assert normalize_notice_period_days(None) is None


class TestNormalizeSalaryBound:
    def test_valid_positive(self):
        assert normalize_salary_bound(150000) == 150000
        assert normalize_salary_bound(85) == 85  # hourly rate

    def test_zero_returns_none(self):
        assert normalize_salary_bound(0) is None

    def test_negative_returns_none(self):
        assert normalize_salary_bound(-1000) is None

    def test_none_input(self):
        assert normalize_salary_bound(None) is None


class TestNormalizeField:
    def test_email_dispatched(self):
        assert normalize_field("email", "BOB@EXAMPLE.COM") == "bob@example.com"

    def test_phone_dispatched(self):
        assert normalize_field("phone", "4155551234") == "(415) 555-1234"

    def test_years_experience_years_dispatched(self):
        assert normalize_field("years_experience_years", 8.567) == 8.6

    def test_years_experience_years_negative_clamped(self):
        assert normalize_field("years_experience_years", -1.0) == 0.0

    def test_notice_period_days_dispatched(self):
        assert normalize_field("notice_period_days", -1) == 0
        assert normalize_field("notice_period_days", 14) == 14

    def test_target_salary_min_dispatched(self):
        assert normalize_field("target_salary_min", 0) is None
        assert normalize_field("target_salary_min", 150000) == 150000

    def test_target_salary_max_dispatched(self):
        assert normalize_field("target_salary_max", 180000) == 180000
        assert normalize_field("target_salary_max", -500) is None

    def test_generic_text_field_strips_whitespace(self):
        assert normalize_field("current_title", "  Senior Engineer  ") == "Senior Engineer"

    def test_empty_string_returns_none(self):
        assert normalize_field("current_title", "") is None

    def test_none_returns_none(self):
        assert normalize_field("current_title", None) is None

    def test_bool_passes_through(self):
        assert normalize_field("willing_to_relocate", True) is True
        assert normalize_field("willing_to_relocate", False) is False

    def test_list_passes_through(self):
        result = normalize_field("primary_skills", ["Python", "Go"])
        assert result == ["Python", "Go"]

    def test_compensation_period_passes_through(self):
        assert normalize_field("compensation_period", "annual") == "annual"
        assert normalize_field("compensation_period", "hourly") == "hourly"
