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


# 内容对账：直接拿答案里的高辨识度事实值去证据里对，而不是相信模型自己声明的 evidenceId。
#
# 为什么换掉编号对账：原设计要求模型把 `ev-cc1f894753e14a63` 这种哈希准确抄进每条 claim，
# 然后把整个闸门押在这件事上——这是能让 LLM 做的最不可靠的事之一。线上真实案例：答案里
# 07/28 23:09、¥3,293.75、14 个任务全都真实存在于证据中，却因为抄错了哈希被整段拦下。
#
# 只对账"模型编不出来"的高辨识度值：日期、时间、金额、版本号、文件名、编号。
# 刻意不对账派生值（"14 天"是 07/28 到 08/11 算出来的，证据里根本不会有这个数），
# 也不对账小整数——那样会把正确答案大量误拦，比现在更糟。
_DATE_PATTERNS = (
    re.compile(r"(20\d{2})\s*[-/年]\s*(\d{1,2})\s*[-/月]\s*(\d{1,2})"),
)
_MONTH_DAY_PATTERN = re.compile(r"(?<!\d)(\d{1,2})\s*[/月]\s*(\d{1,2})\s*日?(?!\d)")
_TIME_PATTERN = re.compile(r"(?<!\d)([01]?\d|2[0-3])\s*[:：]\s*([0-5]\d)(?!\d)")
# 金额与小时只取带千分位或小数的写法：整数太容易和计数、天数混在一起。
_DECIMAL_PATTERN = re.compile(r"(?<![\d.])(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+\.\d+)(?![\d.])")
_FILENAME_PATTERN = re.compile(r"[\w一-鿿][\w一-鿿.\-]*\.(?:pdf|png|jpg|jpeg|xlsx|xls|docx|doc|pptx|ppt|ai|psd|zip|svg|webp)", re.IGNORECASE)
_ENTITY_ID_PATTERN = re.compile(r"#(\d{4,})")


def salient_values(value: str) -> set[str]:
    """抽取高辨识度事实值，归一化后用于对账。"""
    text = unicodedata.normalize("NFKC", str(value or ""))
    values: set[str] = set()
    for pattern in _DATE_PATTERNS:
        for year, month, day in pattern.findall(text):
            values.add(f"d{int(year):04d}{int(month):02d}{int(day):02d}")
    for month, day in _MONTH_DAY_PATTERN.findall(text):
        if 1 <= int(month) <= 12 and 1 <= int(day) <= 31:
            values.add(f"md{int(month):02d}{int(day):02d}")
    for hour, minute in _TIME_PATTERN.findall(text):
        values.add(f"t{int(hour):02d}{int(minute):02d}")
    for number in _DECIMAL_PATTERN.findall(text):
        cleaned = number.replace(",", "").rstrip("0").rstrip(".")
        values.add(f"n{cleaned}")
    for name in _FILENAME_PATTERN.findall(text):
        values.add(f"f{normalize_text(name)}")
    for entity_id in _ENTITY_ID_PATTERN.findall(text):
        values.add(f"i{entity_id}")
    values.update(f"v{version}" for version in extract_versions(text))
    return values


def unsupported_values(answer: str, evidence_text: str) -> list[str]:
    """答案里出现、证据里找不到的事实值。这才是真正的编造。"""
    grounded = salient_values(evidence_text)
    # 日期在证据里常以完整形式出现，答案里可能只写月日；两种形态互相认账。
    grounded |= {f"md{item[5:9]}" for item in grounded if item.startswith("d")}
    claimed = salient_values(answer)
    claimed |= {f"md{item[5:9]}" for item in claimed if item.startswith("d")}
    return sorted(claimed - grounded)


def describe_value(token: str) -> str:
    """把归一化的值还原成人能读的说法，用于审计说明。"""
    if token.startswith("d") and len(token) == 9:
        return f"{token[1:5]}/{token[5:7]}/{token[7:9]}"
    if token.startswith("md"):
        return f"{token[2:4]}/{token[4:6]}"
    if token.startswith("t"):
        return f"{token[1:3]}:{token[3:5]}"
    if token.startswith("n"):
        return token[1:]
    if token.startswith("v"):
        return token[1:]
    if token.startswith("i"):
        return f"#{token[1:]}"
    return token[1:] if len(token) > 1 else token


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


def _subject_is_grounded(subject_key: str, corpus_key: str) -> bool:
    """主体是否出现在问题或回答里。

    不能用子串匹配：模型给主体起的概括标签常和用户的措辞词序不同
    （"结算回单导出记录" vs 用户问的"导出结算回单"），子串一比就判"不存在"，
    把完全正确的答案拦掉。改成字符覆盖率——凭空造的主体覆盖率会很低。
    """
    if not subject_key:
        return True
    chars = set(subject_key)
    if not chars:
        return True
    covered = sum(1 for char in chars if char in corpus_key)
    return covered / len(chars) >= 0.6


def deterministic_verify(
    question: str,
    output: AgentTurnOutput,
    evidence: EvidenceStore,
    context: str = "",
) -> AuditOutput:
    """确定性核对。判断依据是**答案里的事实值在不在证据里**，不是模型自己声明的证据编号。

    编号对账已经废弃：它要求模型手抄哈希，而线上真实案例是答案里每个数值都真实存在于
    证据中、只因为抄错哈希被整段拦下。编号现在只用于审计展示。
    """
    issues: list[str] = []
    advisory: list[str] = []
    evidence_ids = set(evidence.records)
    # 只有工具证据和本轮上下文（当前月份、今天日期）算已知事实。今天的日期永远
    # 不会出现在工具证据里，所以必须单列。
    #
    # 刻意不把用户问题算进来：用户问"是 B09 还是 B10"时，B10 只是待核对的候选，
    # 不是事实。把问题算成已知，模型就能不带证据地把用户的猜测复述成结论。
    evidence_text = json.dumps(evidence.as_prompt_data(), ensure_ascii=False, default=str)
    grounded_corpus = f"{evidence_text}\n{context}"

    if output.status == "answered" and not output.answer.strip():
        issues.append("缺少最终回答")

    # 核心检查：答案里的日期、时间、金额、版本、文件名、编号必须能在证据里找到。
    # 编造的事实值根本不会出现在证据里，躲不过这一条；而抄错编号不再影响判定。
    for token in unsupported_values(output.answer, grounded_corpus):
        issues.append(f"答案里的「{describe_value(token)}」在证据中找不到")

    # 编号写错不再阻断，但要记进审计，方便排查模型的记账质量。
    for claim in output.claims:
        unknown_refs = [ref for ref in claim.evidence_refs if ref not in evidence_ids]
        if unknown_refs:
            advisory.append(f"声明引用了不存在的证据编号：{', '.join(unknown_refs)}")
        if output.status == "answered" and claim.kind != "interpretation" and not claim.evidence_refs:
            advisory.append(f"事实声明没有填写证据编号：{claim.text[:60]}")

    if output.status == "answered" and output.claims and not evidence.records:
        issues.append("存在事实结论，但本轮没有工具证据")

    subject_key = normalize_text(output.subject.name) if output.subject and output.subject.name else ""
    question_key = normalize_text(question)
    answer_key = normalize_text(output.answer)
    # 主体只要在问题或回答里出现过就算成立。要求它出现在证据文本里是错的：
    # 模型常给主体起一个概括性标签（"结算回单导出记录"），证据里当然没有这个短语，
    # 而答案本身完全正确——线上就是这样被拦掉的。
    subject_grounded = _subject_is_grounded(subject_key, f"{question_key}{answer_key}")
    if output.status == "answered" and not subject_grounded:
        issues.append(f"回答主体“{output.subject.name}”在问题和回答里都不存在")
    elif subject_key and subject_key not in normalize_text(evidence_text):
        advisory.append(f"主体“{output.subject.name}”是概括标签，证据里没有同名条目")

    passed = not issues
    return AuditOutput(
        passed=passed,
        issues=issues,
        advisory=advisory,
        question_addressed=bool(answer_key) and subject_grounded,
        subject_aligned=subject_grounded,
        evidence_sufficient=not any("找不到" in issue or "没有工具证据" in issue for issue in issues),
        recommendation="publish" if passed else ("clarify" if output.status == "needs_clarification" else "refuse"),
    )
