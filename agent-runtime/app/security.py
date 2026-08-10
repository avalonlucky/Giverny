from __future__ import annotations

import base64
import hashlib
import hmac
import time

from .schemas import Principal


def canonical_scope(principal: Principal, timestamp_ms: int) -> str:
    return "\n".join(
        [
            principal.workspace_id,
            principal.principal_id,
            principal.role,
            principal.run_id,
            str(timestamp_ms),
        ]
    )


def sign_scope(secret: str, principal: Principal, timestamp_ms: int) -> str:
    digest = hmac.new(
        secret.encode("utf-8"),
        canonical_scope(principal, timestamp_ms).encode("utf-8"),
        hashlib.sha256,
    ).digest()
    return base64.urlsafe_b64encode(digest).decode("ascii").rstrip("=")


def scope_headers(secret: str, principal: Principal) -> dict[str, str]:
    timestamp_ms = int(time.time() * 1000)
    return {
        "authorization": f"Bearer {secret}",
        "x-agent-workspace-id": principal.workspace_id,
        "x-agent-principal-id": principal.principal_id,
        "x-agent-role": principal.role,
        "x-agent-run-id": principal.run_id,
        "x-agent-scope-timestamp": str(timestamp_ms),
        "x-agent-scope-signature": sign_scope(secret, principal, timestamp_ms),
    }


def runtime_key_matches(expected: str, supplied: str | None) -> bool:
    return bool(expected and supplied and hmac.compare_digest(expected, supplied))
