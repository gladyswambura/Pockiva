from pydantic import BaseModel, EmailStr, field_validator
import re


class OtpRequestIn(BaseModel):
    identifier: str  # phone (E.164) or email

    @field_validator("identifier")
    @classmethod
    def validate_identifier(cls, v: str) -> str:
        v = v.strip()
        if re.match(r"^\+\d{7,15}$", v):
            return v
        if re.match(r"^[^@]+@[^@]+\.[^@]+$", v):
            return v.lower()
        raise ValueError("Must be a phone number (+254...) or email address.")


class OtpVerifyIn(BaseModel):
    identifier: str
    code: str


class TokenOut(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshIn(BaseModel):
    refresh_token: str


class UserOut(BaseModel):
    id: str
    phone_e164: str | None
    email: str | None
    display_name: str | None = None
    locale: str
    currency: str
    plan_tier: str

    model_config = {"from_attributes": True}


class UserPatchIn(BaseModel):
    display_name: str | None = None
    locale: str | None = None
    currency: str | None = None
