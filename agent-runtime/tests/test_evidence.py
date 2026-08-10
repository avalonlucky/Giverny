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
