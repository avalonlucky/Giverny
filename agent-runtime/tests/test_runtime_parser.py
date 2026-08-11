import unittest
from types import SimpleNamespace

from app.evidence import EvidenceStore
from app.runtime import AgentRuntime, _apply_grounded_scope, _merge_stream_text, _parse_structured_text
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

    def test_normalizes_production_disambiguation_claim_labels(self):
        value = {
            **VALID,
            "claims": [{
                "text": "匹配到多个候选任务，需要确认目标对象。",
                "kind": "disambiguation",
                "evidence_refs": ["ev-1"],
                "dimension": "subject_identity",
            }],
        }
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


class StructuredCollectorTest(unittest.IsolatedAsyncioTestCase):
    async def test_named_agent_valid_content_survives_invalid_transient_output(self):
        import json

        class FakeEvent:
            author = "giverny_coordinator"
            output = {"temporary": "not-the-final-contract"}
            content = SimpleNamespace(parts=[SimpleNamespace(
                text=json.dumps(VALID, ensure_ascii=False),
                thought=False,
            )])

            @staticmethod
            def get_function_calls():
                return []

        class FakeRunner:
            async def run_async(self, **kwargs):
                yield FakeEvent()

        runtime = AgentRuntime.__new__(AgentRuntime)
        parsed, _ = await runtime._run_structured(
            FakeRunner(),
            user_id="admin",
            session_id="conv-1",
            prompt="question",
            schema=AgentTurnOutput,
            max_llm_calls=4,
            result_author="giverny_coordinator",
        )
        self.assertEqual(parsed.status, "needs_clarification")

    async def test_specialist_content_cannot_publish_coordinator_contract(self):
        import json

        class FakeEvent:
            def __init__(self, author, payload):
                self.author = author
                self.output = None
                self.content = SimpleNamespace(parts=[SimpleNamespace(
                    text=json.dumps(payload, ensure_ascii=False),
                    thought=False,
                )])

            @staticmethod
            def get_function_calls():
                return []

        specialist = {**VALID, "answer": "不应发布的专家草稿"}
        coordinator = {**VALID, "answer": "请确认具体对象。"}

        class FakeRunner:
            async def run_async(self, **kwargs):
                yield FakeEvent("workspace_analyst", specialist)
                yield FakeEvent("giverny_coordinator", coordinator)

        runtime = AgentRuntime.__new__(AgentRuntime)
        parsed, _ = await runtime._run_structured(
            FakeRunner(),
            user_id="admin",
            session_id="conv-1",
            prompt="question",
            schema=AgentTurnOutput,
            max_llm_calls=4,
            result_author="giverny_coordinator",
        )
        self.assertEqual(parsed.answer, "请确认具体对象。")


if __name__ == "__main__":
    unittest.main()
