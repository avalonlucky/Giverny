from __future__ import annotations

from typing import Any, Literal

from pydantic import AliasChoices, BaseModel, Field, field_validator, model_validator


AgentRole = Literal["admin", "demo", "collaborator", "viewer", "client", "guest", "mcp-read", "system"]


class Principal(BaseModel):
    workspace_id: str = Field(alias="workspaceId", min_length=1, max_length=80)
    principal_id: str = Field(alias="principalId", min_length=1, max_length=160)
    role: AgentRole
    run_id: str = Field(alias="runId", min_length=1, max_length=160)

    model_config = {"populate_by_name": True}


class HistoryMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=12000)


class ChatRequest(BaseModel):
    question: str = Field(min_length=1, max_length=12000)
    conversation_id: str = Field(alias="conversationId", min_length=1, max_length=160)
    current_month: str = Field(default="", alias="currentMonth", max_length=7)
    context: str = Field(default="", max_length=24000)
    history: list[HistoryMessage] = Field(default_factory=list, max_length=30)
    principal: Principal

    model_config = {"populate_by_name": True}


class EntityReference(BaseModel):
    entity_type: str = Field(default="unknown", max_length=60)
    name: str = Field(default="", max_length=240)
    entity_id: str | None = Field(default=None, max_length=160)
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)


class Claim(BaseModel):
    text: str = Field(validation_alias=AliasChoices("text", "statement"), min_length=1, max_length=1200)
    kind: Literal["fact", "version", "status", "date", "money", "hours", "count", "interpretation"] = "fact"
    evidence_refs: list[str] = Field(validation_alias=AliasChoices("evidence_refs", "evidence_ids"), default_factory=list, max_length=20)
    dimension: Literal["discussed", "produced", "uploaded", "submitted", "feedback", "approved", "overall", "not_applicable"] = "not_applicable"

    @field_validator("kind", mode="before")
    @classmethod
    def normalize_kind(cls, value: Any) -> str:
        normalized = str(value or "fact").strip().lower()
        aliases = {"factual": "fact", "missing_info": "fact", "numeric": "count", "analysis": "interpretation"}
        return aliases.get(normalized, normalized if normalized in {"fact", "version", "status", "date", "money", "hours", "count", "interpretation"} else "fact")

    @field_validator("dimension", mode="before")
    @classmethod
    def normalize_dimension(cls, value: Any) -> str:
        normalized = str(value or "not_applicable").strip().lower()
        aliases = {"progress": "overall", "existence": "not_applicable", "related_entity": "not_applicable"}
        allowed = {"discussed", "produced", "uploaded", "submitted", "feedback", "approved", "overall", "not_applicable"}
        return aliases.get(normalized, normalized if normalized in allowed else "not_applicable")


class AgentTurnOutput(BaseModel):
    status: Literal["answered", "needs_clarification", "refused"]
    intent_summary: str = Field(min_length=1, max_length=600)
    subject: EntityReference | None = None
    answer: str = Field(min_length=1, max_length=12000)
    claims: list[Claim] = Field(default_factory=list, max_length=40)
    used_specialists: list[str] = Field(default_factory=list, max_length=12)

    @model_validator(mode="before")
    @classmethod
    def normalize_subject_shape(cls, value: Any) -> Any:
        if isinstance(value, dict) and isinstance(value.get("subject"), str):
            return {**value, "subject": {"entity_type": "unknown", "name": value["subject"], "confidence": 0.7}}
        return value

    @field_validator("answer")
    @classmethod
    def no_internal_protocol_language(cls, value: str) -> str:
        forbidden = ("LangGraph", "applyAgentGroundingPolicy", "hidden chain of thought")
        if any(marker.lower() in value.lower() for marker in forbidden):
            raise ValueError("回答不得暴露内部编排实现")
        return value.strip()


class AuditOutput(BaseModel):
    passed: bool
    issues: list[str] = Field(default_factory=list, max_length=20)
    question_addressed: bool
    subject_aligned: bool
    evidence_sufficient: bool
    recommendation: Literal["publish", "clarify", "refuse"]


class RoutingDecision(BaseModel):
    intent_summary: str = Field(min_length=1, max_length=600)
    subject: EntityReference | None = None
    allowed_specialists: list[Literal["workspace_analyst", "product_support", "web_researcher", "transaction_specialist"]] = Field(default_factory=list, max_length=4)
    requires_evidence: bool = True
    rationale: str = Field(min_length=1, max_length=800)


class EvidenceRecord(BaseModel):
    evidence_id: str = Field(alias="evidenceId")
    tool_name: str = Field(alias="toolName")
    arguments: dict[str, Any]
    result: dict[str, Any]

    model_config = {"populate_by_name": True}


class ChatResponse(BaseModel):
    answer: str
    conversation_id: str = Field(alias="conversationId")
    model: str
    trace: list[dict[str, str]]
    fact_verification: dict[str, Any] = Field(alias="factVerification")
    orchestration: dict[str, Any]
    productivity: dict[str, Any]
    approval: dict[str, Any] | None = None
    selection: dict[str, Any] | None = None
    pending_action: dict[str, Any] | None = Field(default=None, alias="pendingAction")

    model_config = {"populate_by_name": True}
