from typing import Annotated

from fastapi import APIRouter, Depends

from app.dependencies.auth import MockPrincipal, get_mock_principal

router = APIRouter()


@router.get("/auth/whoami")
def whoami(user: Annotated[MockPrincipal, Depends(get_mock_principal)]) -> dict[str, object]:
    """Returns the fixed mock principal (replace with real auth later)."""
    return {"subject": user.subject, "email": user.email, "roles": list(user.roles)}
