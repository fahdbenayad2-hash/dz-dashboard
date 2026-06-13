from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field


def _parse_int_list(v: str) -> list[int]:
    if not v:
        return []
    return [int(x.strip()) for x in v.split(",") if x.strip()]


def _parse_str_list(v: str) -> list[str]:
    if not v:
        return []
    return [x.strip() for x in v.split(",") if x.strip()]


class Settings(BaseSettings):
    telegram_bot_token: str = ""

    allowed_chat_ids_raw: str = Field(default="", validation_alias="ALLOWED_CHAT_IDS")

    octomatic_base_url: str = "https://app.octomatic.dz/api"
    octomatic_api_key: str = ""
    octomatic_store_slug: str = "femmesoir"

    noest_base_url: str = "https://api.noest-express.com"
    noest_username: str = ""
    noest_password: str = ""

    database_url: str = "sqlite+aiosqlite:///./dz_bot.db"
    sync_interval_minutes: int = 15

    cors_origins_raw: str = Field(
        default="http://localhost:5173,https://dz-dashboard.vercel.app",
        validation_alias="CORS_ORIGINS",
    )

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        populate_by_name=True,
    )

    @property
    def allowed_chat_ids(self) -> list[int]:
        return _parse_int_list(self.allowed_chat_ids_raw)

    @property
    def cors_origins(self) -> list[str]:
        return _parse_str_list(self.cors_origins_raw)

    @property
    def is_sqlite(self) -> bool:
        return self.database_url.startswith("sqlite")

    @property
    def is_postgres(self) -> bool:
        return self.database_url.startswith("postgresql")


settings = Settings()
