import re
from typing import Literal
from pydantic import BaseModel, EmailStr, field_validator


class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    # Which portal the login was attempted from. The server rejects a
    # mismatch (e.g. a client account logging in on the internal portal),
    # so access control does not rely on the frontend alone.
    portal: Literal["internal", "client"]


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str

    @field_validator("password")
    @classmethod
    def password_complexity(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if not re.search(r"\d", v):
            raise ValueError("Password must contain at least one digit")
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least one uppercase letter")
        return v


class RefreshRequest(BaseModel):
    pass  # Token comes from httpOnly cookie


class TokenResponse(BaseModel):
    message: str = "OK"


class MeResponse(BaseModel):
    id: str
    email: str
    full_name: str
    role: str
    team_id: str | None
    is_active: bool
    notify_email: bool

    model_config = {"from_attributes": True}


# Frontend-compatible user shape returned by /auth/login and /auth/me
class UserAuthResponse(BaseModel):
    id: str
    email: str
    name: str        # full_name alias
    role: str
    team: str        # team name (empty string if no team)
    avatar: str      # initials derived from name
    color: str       # deterministic color from user id
