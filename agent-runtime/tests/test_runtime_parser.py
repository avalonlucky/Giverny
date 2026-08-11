import unittest

from app.evidence import EvidenceStore
from app.runtime import _apply_grounded_scope, _merge_stream_text, _parse_structured_text
from app.schemas import AgentTurnOutput, RoutingDecision


VALID = {
    "status": "needs_clarification",
    "intent_summary": "确认主体",
    "subject": None,
    "answer": "请说明具体期刊名称。",
    "claims": [],
    "used_specialists": ["workspace_analyst"],
}


class RuntimeParserTest(unittest.TestCase):
    def test_accepts_fenced_json(self):
        import json
        parsed = _parse_structured_text(f"```json\n{json.dumps(VALID, ensure_ascii=False)}\n```", AgentTurnOutput)
        self.assertEqual(parsed.status, "needs_clarification")

    def test_extracts_json_after_short_preface(self):
        import json
        parsed = _parse_structured_text(f"结果如下：\n{json.dumps(VALID, ensure_ascii=False)}", AgentTurnOutput)
        self.assertEqual(parsed.answer, "请说明具体期刊名称。")

    def test_normalizes_equivalent_model_claim_labels(self):
        value = {**VALID, "claims": [{"statement": "未找到记录", "kind": "missing_info", "evidence_ids": ["ev-1"], "dimension": "existence"}]}
        parsed = AgentTurnOutput.model_validate(value)
        self.assertEqual(parsed.claims[0].kind, "fact")
        self.assertEqual(parsed.claims[0].dimension, "not_applicable")

    def test_normalizes_string_subject_from_openai_compatible_provider(self):
        parsed = RoutingDecision.model_validate({
            "intent_summary": "查公司刊物版本",
            "subject": "公司产品分套",
            "allowed_specialists": ["product_support"],
            "requires_evidence": True,
            "rationale": "需要确认对象",
        })
        self.assertEqual(parsed.subject.name, "公司产品分套")

    def test_grounded_workspace_entity_overrides_ungrounded_product_guess(self):
        evidence = EvidenceStore()
        evidence.add("resolve_workspace_subject", {"subject": "公司产品分套"}, {
            "resolutionStatus": "resolved",
            "task": {"id": 23, "title": "公司产品分套"},
        })
        routing = RoutingDecision.model_validate({
            "intent_summary": "查版本",
            "subject": "公司产品分套",
            "allowed_specialists": ["product_support"],
            "requires_evidence": True,
            "rationale": "初步判断",
        })
        result = _apply_grounded_scope(routing, evidence)
        self.assertEqual(result.allowed_specialists, ["workspace_analyst"])
        self.assertEqual(result.subject.entity_type, "task")
        self.assertEqual(result.subject.entity_id, "23")

    def test_stream_merge_accepts_delta_and_cumulative_chunks(self):
        text = _merge_stream_text("", "先确认")
        text = _merge_stream_text(text, "确认对象")
        text = _merge_stream_text(text, "先确认对象，再查证据")
        self.assertEqual(text, "先确认对象，再查证据")


if __name__ == "__main__":
    unittest.main()
