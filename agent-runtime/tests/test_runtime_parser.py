import unittest

from app.runtime import _parse_structured_text
from app.schemas import AgentTurnOutput


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


if __name__ == "__main__":
    unittest.main()
