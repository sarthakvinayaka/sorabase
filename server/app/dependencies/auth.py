from dataclasses import dataclass


@dataclass(frozen=True)
class MockPrincipal:
    subject: str = "user_mock_001"
    email: str = "recruiter@example.com"
    roles: tuple[str, ...] = ("recruiter",)


def get_mock_principal() -> MockPrincipal:
    return MockPrincipal()
