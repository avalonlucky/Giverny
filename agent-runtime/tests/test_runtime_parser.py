import unittest
from types import SimpleNamespace

from app.evidence import EvidenceStore
from app.runtime import AgentRuntime, _apply_grounded_scope, _parse_structured_text, _StreamText
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

    def test_ambiguous_resolution_keeps_product_support_available(self):
        """取证没定论时剥掉产品支持，会让真正问产品的问题再也回不去。"""
        evidence = EvidenceStore()
        evidence.add("resolve_workspace_subject", {"subject": "封套"}, {
            "resolutionStatus": "ambiguous",
            "candidates": [{"id": 1, "title": "封套 A"}, {"id": 2, "title": "封套 B"}],
        })
        routing = RoutingDecision.model_validate({
            "intent_summary": "查版本",
            "subject": "封套",
            "allowed_specialists": ["product_support"],
            "requires_evidence": True,
            "rationale": "初步判断",
        })
        result = _apply_grounded_scope(routing, evidence)
        self.assertIn("product_support", result.allowed_specialists)
        self.assertIn("workspace_analyst", result.allowed_specialists)

    def test_delta_chunks_are_concatenated_without_loss(self):
        stream = _StreamText()
        for chunk in ("先确认", "对象，", "再查证据"):
            stream.feed(chunk, partial=True)
        self.assertEqual(stream.text(), "先确认对象，再查证据")

    def test_repeated_delta_chunks_are_never_swallowed(self):
        """靠 endswith 猜增量会吞掉重复分片，丢一次整轮 JSON 就废了。"""
        cases = [
            ['{"entity_id": ', '"', '"', ', "n": 1}'],
            ['{"a": {"b": 1', '}', '}'],
            ["结论是", "好", "好"],
            ['{"a":1,', "\n", "\n", '"b":2}'],
        ]
        for deltas in cases:
            stream = _StreamText()
            for chunk in deltas:
                stream.feed(chunk, partial=True)
            self.assertEqual(stream.text(), "".join(deltas), f"丢字符：{deltas}")

    def test_aggregated_frame_replaces_its_own_segment(self):
        """段末聚合帧是权威全文，不能追加成两段拼接的垃圾 JSON。"""
        stream = _StreamText()
        stream.feed('{"a":', partial=True)
        stream.feed('1}', partial=True)
        stream.feed('{"a":1}', partial=False)
        self.assertEqual(stream.text(), '{"a":1}')

    def test_multiple_segments_are_preserved(self):
        """工具调用会把输出切成多段，每段各有自己的聚合帧。"""
        stream = _StreamText()
        stream.feed("让我查一下。", partial=False)
        stream.feed('{"done":', partial=True)
        stream.feed('true}', partial=True)
        stream.feed('{"done":true}', partial=False)
        self.assertEqual(stream.text(), '让我查一下。{"done":true}')


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
