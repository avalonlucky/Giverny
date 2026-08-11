from __future__ import annotations

import hashlib
import json
import re
import unicodedata
from dataclasses import dataclass, field
from typing import Any

from .schemas import AgentTurnOutput, AuditOutput, EvidenceRecord


# 只认真正的版本前缀。此前是任意 1–4 个字母加数字，于是 "Logo 3"、"AS 2"、"KV 1"
# 都会被当成版本号：回答里出现、证据里没有原样字符串，就会误判成"版本结论缺少证据"
# 并把一个正确答案拦下来。
VERSION_PATTERN = re.compile(r"(?<![A-Za-z0-9])(v|ver|rev|rc|b)[\s._-]?(\d{1,4})(?!\d)", re.IGNORECASE)


def normalize_text(value: str) -> str:
    normalized = unicodedata.normalize("NFKC", value).lower()
    return re.sub(r"[\s\W_]+", "", normalized, flags=re.UNICODE)


def extract_versions(value: str) -> set[str]:
    return {f"{prefix.upper()}{int(number)}" for prefix, number in VERSION_PATTERN.findall(value)}


def compact_result(value: Any, max_chars: int = 12000) -> dict[str, Any]:
    if isinstance(value, dict):
        result = value
    else:
        result = {"value": value}
    encoded = json.dumps(result, ensure_ascii=False, default=str)
    if len(encoded) <= max_chars:
        return result
    return {"truncated": True, "preview": encoded[:max_chars]}


@dataclass
class EvidenceStore:
    records: dict[str, EvidenceRecord] = field(default_factory=dict)

    def add(self, tool_name: str, arguments: dict[str, Any], result: Any) -> EvidenceRecord:
        compact = compact_result(result)
        raw = json.dumps(
            {"tool": tool_name, "arguments": arguments, "result": compact},
            ensure_ascii=False,
            sort_keys=True,
            default=str,
        )
        evidence_id = f"ev-{hashlib.sha256(raw.encode('utf-8')).hexdigest()[:16]}"
        record = EvidenceRecord(
            evidenceId=evidence_id,
            toolName=tool_name,
            arguments=arguments,
            result=compact,
        )
        self.records[evidence_id] = record
        return record

    def as_prompt_data(self) -> list[dict[str, Any]]:
        values: list[dict[str, Any]] = []
        for record in self.records.values():
            value = record.model_dump(by_alias=True)
            value["result"] = {key: item for key, item in record.result.items() if key != "confirmationToken"}
            values.append(value)
        return values

    def ready_preview(self) -> tuple[EvidenceRecord, dict[str, Any]] | None:
        """Return the newest ready write preview for the deterministic confirmation layer."""
        for record in reversed(list(self.records.values())):
            result = record.result
            if (
                result.get("mode") == "preview"
                and result.get("ready") is True
                and isinstance(result.get("confirmationToken"), str)
                and result.get("confirmationToken")
                and isinstance(result.get("draft"), dict)
            ):
                return record, result
        return None


def deterministic_verify(question: str, output: AgentTurnOutput, evidence: EvidenceStore) -> AuditOutput:
    issues: list[str] = []
    evidence_ids = set(evidence.records)

    if output.status == "answered" and not output.answer.strip():
        issues.append("缺少最终回答")

    for claim in output.claims:
        unknown_refs = [ref for ref in claim.evidence_refs if ref not in evidence_ids]
        if unknown_refs:
            issues.append(f"声明引用了不存在的证据：{', '.join(unknown_refs)}")
        if output.status == "answered" and claim.kind != "interpretation" and not claim.evidence_refs:
            issues.append(f"事实声明没有证据：{claim.text[:80]}")

    evidence_text = json.dumps(evidence.as_prompt_data(), ensure_ascii=False, default=str)
    answer_versions = extract_versions(output.answer)
    evidence_versions = extract_versions(evidence_text)
    unsupported_versions = sorted(answer_versions - evidence_versions)
    if unsupported_versions:
        issues.append(f"版本结论缺少证据：{', '.join(unsupported_versions)}")

    subject_key = normalize_text(output.subject.name) if output.subject and output.subject.name else ""

    # 主体绑定只在这一轮确实在陈述业务事实时才检查。既没有工具证据也没有事实声明的
    # 请求（闲聊、写文案、纯语言任务）本来就不该被当成"证据没绑上主体"拦下来，
    # 否则用户会收到一句"我已查到相关资料，但未通过校验"——而系统根本没查过任何资料。
    asserts_workspace_facts = bool(evidence.records) or bool(output.claims)
    if output.status == "answered" and asserts_workspace_facts and subject_key:
        if subject_key not in normalize_text(evidence_text):
            issues.append(f"证据未能绑定主体“{output.subject.name}”")

    if output.status == "answered" and output.claims and not evidence.records:
        issues.append("存在事实结论，但本轮没有工具证据")

    question_key = normalize_text(question)
    answer_key = normalize_text(output.answer)
    # 这条不负责判断"回答得好不好"——语义是否真正回应问题由独立的证据审核员判定。
    # 它只拦一种确定性错误：模型报了一个问题和回答里都不存在的主体，即主体是凭空造的。
    subject_exists_in_dialogue = not subject_key or subject_key in answer_key or subject_key in question_key
    question_addressed = bool(answer_key) and subject_exists_in_dialogue
    if output.status == "answered" and not subject_exists_in_dialogue:
        issues.append(f"回答主体“{output.subject.name}”在问题和回答里都不存在")

    passed = not issues
    return AuditOutput(
        passed=passed,
        issues=issues,
        question_addressed=question_addressed,
        subject_aligned=not any("绑定主体" in issue for issue in issues),
        evidence_sufficient=not any("证据" in issue for issue in issues),
        recommendation="publish" if passed else ("clarify" if output.status == "needs_clarification" else "refuse"),
    )
