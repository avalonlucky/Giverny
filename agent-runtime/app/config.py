from __future__ import annotations

import os
from dataclasses import dataclass


def _env(name: str, default: str = "") -> str:
    return os.getenv(name, default).strip()


@dataclass(frozen=True)
class Settings:
    runtime_key: str
    tool_base_url: str
    tool_token: str
    session_db_url: str
    max_history_messages: int
    request_timeout_seconds: float
    # 本轮编排的总预算。必须小于 Worker 的 280 秒子请求上限：否则各阶段各拿一份
    # 单阶段超时，最坏能跑到 450 秒，Worker 先掐断，用户白等四分多钟才看到失败。
    turn_budget_seconds: float

    @classmethod
    def from_env(cls) -> "Settings":
        return cls(
            runtime_key=_env("ADK_RUNTIME_KEY"),
            tool_base_url=_env("GIVERNY_TOOL_BASE_URL", "https://mayeai.com").rstrip("/"),
            tool_token=_env("GIVERNY_TOOL_TOKEN"),
            session_db_url=_env("ADK_SESSION_DB_URL", "sqlite+aiosqlite:////data/adk-sessions.db"),
            max_history_messages=max(2, min(30, int(_env("ADK_MAX_HISTORY_MESSAGES", "16")))),
            request_timeout_seconds=max(15.0, min(300.0, float(_env("ADK_REQUEST_TIMEOUT_SECONDS", "150")))),
            turn_budget_seconds=max(30.0, min(270.0, float(_env("ADK_TURN_BUDGET_SECONDS", "240")))),
        )

    @property
    def ready(self) -> bool:
        return bool(self.runtime_key and self.tool_token)

    def missing(self) -> list[str]:
        required = {
            "ADK_RUNTIME_KEY": self.runtime_key,
            "GIVERNY_TOOL_TOKEN": self.tool_token,
        }
        return [name for name, value in required.items() if not value]
