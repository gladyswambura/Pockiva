from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "sqlite+aiosqlite:///./pockiva_local.db"
    redis_url: str = "redis://localhost:6379/0"

    jwt_secret: str = "change-me"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 30

    otp_expire_minutes: int = 10
    otp_max_attempts: int = 5

    app_env: str = "local"
    app_name: str = "Pockiva"
    allowed_origins: list[str] = ["http://localhost:5173"]

    sentry_dsn: str = ""

    at_api_key: str = ""
    at_username: str = "sandbox"
    at_sender_id: str = "Pockiva"

    mpesa_consumer_key: str = ""
    mpesa_consumer_secret: str = ""
    mpesa_shortcode: str = ""
    mpesa_passkey: str = ""
    mpesa_callback_url: str = ""

    # Web Push (VAPID)
    vapid_private_key: str = ""
    vapid_public_key: str = ""
    vapid_contact_email: str = "admin@pockiva.com"

    # SMTP (for email OTP, notifications)
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_from_email: str = "noreply@pockiva.com"
    smtp_from_name: str = "Pockiva"

    # Admin alerts
    admin_alert_phone: str = ""
    # Comma-separated user IDs permitted to use the admin API.
    admin_user_ids: str = ""


settings = Settings()
