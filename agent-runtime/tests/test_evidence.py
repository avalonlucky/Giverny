import unittest
import inspect

from app.evidence import EvidenceStore, deterministic_verify, extract_versions
from app.schemas import AgentTurnOutput
from app.tooling import capture_tool_evidence


class EvidenceTest(unittest.TestCase):
    def test_adk_callback_uses_framework_parameter_names(self):
        self.assertEqual(
            list(inspect.signature(capture_tool_evidence).parameters),
            ["tool", "args", "tool_context", "tool_response"],
        )

    def test_version_normalization_is_not_intent_routing(self):
        self.assertEqual(extract_versions("已上传 b-10，上一稿是 B09"), {"B9", "B10"})

    def test_rejects_unsupported_version(self):
        evidence = EvidenceStore()
        record = evidence.add("get_task_detail", {"title": "昂楷之道"}, {"task": {"title": "昂楷之道"}, "files": ["昂楷之道_B09.pdf"]})
        output = AgentTurnOutput.model_validate(
            {
                "status": "answered",
                "intent_summary": "确认《昂楷之道》的当前上传版本",
                "subject": {"entity_type": "publication", "name": "昂楷之道", "confidence": 1},
                "answer": "当前上传的是 B10。",
                "claims": [{"text": "当前上传版本是 B10", "kind": "version", "dimension": "uploaded", "evidence_refs": [record.evidence_id]}],
                "used_specialists": ["workspace_analyst"],
            }
        )
        audit = deterministic_verify("《昂楷之道》现在是 B09 还是 B10？", output, evidence)
        self.assertFalse(audit.passed)
        self.assertTrue(any("B10" in issue for issue in audit.issues))

    def test_accepts_supported_dimensioned_version(self):
        evidence = EvidenceStore()
        record = evidence.add("get_task_detail", {"title": "昂楷之道"}, {"task": {"title": "昂楷之道"}, "files": ["昂楷之道_B10.pdf"]})
        output = AgentTurnOutput.model_validate(
            {
                "status": "answered",
                "intent_summary": "确认正式上传稿",
                "subject": {"entity_type": "publication", "name": "昂楷之道", "confidence": 1},
                "answer": "最近正式上传的是 B10。",
                "claims": [{"text": "正式上传稿是 B10", "kind": "version", "dimension": "uploaded", "evidence_refs": [record.evidence_id]}],
                "used_specialists": ["workspace_analyst"],
            }
        )
        self.assertTrue(deterministic_verify("《昂楷之道》最近上传了哪稿？", output, evidence).passed)

    def test_ordinary_words_followed_by_digits_are_not_versions(self):
        """任意字母加数字都当版本号时，"Logo 3" 会让一个正确答案被误拦。"""
        self.assertEqual(extract_versions("Logo 3 已定稿，AS 2 和 KV 1 一起交付"), set())
        self.assertEqual(extract_versions("已上传 V3，另有 rc2 和 rev 4"), {"V3", "RC2", "REV4"})

    def _general_output(self, **overrides):
        payload = {
            "status": "answered",
            "intent_summary": "帮用户写一段文案",
            "subject": {"entity_type": "task", "name": "开屏文案", "confidence": 0.6},
            "answer": "开屏文案可以这样写：让创作在自己的花园里生长。",
            "claims": [],
            "used_specialists": [],
        }
        return AgentTurnOutput.model_validate({**payload, **overrides})

    def test_request_without_evidence_or_claims_is_not_blocked_for_subject_binding(self):
        """既没查工具也没陈述事实的请求（写文案、闲聊）不该被判成"证据没绑上主体"。"""
        audit = deterministic_verify("帮我写一段开屏文案", self._general_output(), EvidenceStore())
        self.assertTrue(audit.passed, audit.issues)

    def test_factual_claims_without_evidence_are_still_blocked(self):
        """放宽只针对无事实断言的请求，一旦陈述事实，缺证据照样拦。"""
        output = self._general_output(
            answer="开屏文案已经在上周定稿。",
            claims=[{"text": "开屏文案上周定稿", "kind": "date", "dimension": "produced", "evidence_refs": []}],
        )
        audit = deterministic_verify("开屏文案定稿了吗", output, EvidenceStore())
        self.assertFalse(audit.passed)

    def test_subject_absent_from_both_question_and_answer_is_blocked(self):
        """这条只拦一种确定性错误：主体是模型凭空造的。"""
        evidence = EvidenceStore()
        record = evidence.add("get_task_detail", {"title": "昂楷之道"}, {"task": {"title": "昂楷之道"}})
        output = AgentTurnOutput.model_validate({
            "status": "answered",
            "intent_summary": "查进展",
            "subject": {"entity_type": "task", "name": "从未提到的项目", "confidence": 0.9},
            "answer": "已确认相关进展。",
            "claims": [{"text": "存在该任务", "kind": "fact", "evidence_refs": [record.evidence_id]}],
            "used_specialists": ["workspace_analyst"],
        })
        audit = deterministic_verify("《昂楷之道》现在什么进展？", output, evidence)
        self.assertFalse(audit.passed)
        self.assertTrue(any("在问题和回答里都不存在" in issue for issue in audit.issues))

    def test_ready_preview_is_kept_for_deterministic_confirmation(self):
        store = EvidenceStore()
        store.add("create_task_preview", {"title": "A"}, {
            "mode": "preview", "ready": True, "draft": {"title": "A"}, "confirmationToken": "secret",
        })
        preview = store.ready_preview()
        self.assertIsNotNone(preview)
        self.assertEqual(preview[0].tool_name, "create_task_preview")


if __name__ == "__main__":
    unittest.main()
