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

    def _settlement_store(self):
        store = EvidenceStore()
        store.add("query_settlement_exports", {}, {"exports": [{
            "exportedAt": "2026-07-28T23:09:00", "startDate": "2026-07-01", "endDate": "2026-07-31",
            "taskCount": 14, "hours": 38.75, "amount": 3293.75,
        }]})
        return store

    def _settlement_output(self, answer):
        return AgentTurnOutput.model_validate({
            "status": "answered",
            "intent_summary": "查上次导出时间",
            # 模型给主体起的概括标签，和用户措辞词序不同；证据里也没有这个短语。
            "subject": {"entity_type": "record", "name": "结算回单导出记录", "confidence": 0.9},
            "answer": answer,
            # 故意抄错哈希：线上就是这样把一个完全正确的答案毁掉的。
            "claims": [{"text": "最后一次导出在 2026/07/28 23:09", "kind": "date", "evidence_refs": ["ev-does-not-exist"]}],
            "used_specialists": ["workspace_analyst"],
        })

    def test_correct_answer_survives_wrong_evidence_ids_and_a_paraphrased_subject(self):
        """线上真实案例：每个数值都真实存在于证据中，却因为抄错编号被整段拦下。"""
        output = self._settlement_output(
            "最新一次导出结算回单是 **2026/07/28 23:09**，覆盖 2026/07/01 至 2026/07/31，"
            "共 14 个任务、38.75 小时、¥3,293.75。距离今天（2026/08/11）已过去 14 天。"
        )
        audit = deterministic_verify(
            "你帮我查看一下上一次导出结算回单是什么时候？距离今天多久了？",
            output, self._settlement_store(), "2026-08 2026/08/11",
        )
        self.assertTrue(audit.passed, audit.issues)
        # 记账问题降级为审计记录，不再阻断发布。
        self.assertTrue(any("证据编号" in item for item in audit.advisory))

    def test_fabricated_values_are_still_blocked(self):
        output = self._settlement_output("最新一次导出结算回单是 **2026/07/29 10:00**，金额 ¥9,999.99。")
        audit = deterministic_verify("上次导出结算回单是什么时候？", output, self._settlement_store(), "2026-08 2026/08/11")
        self.assertFalse(audit.passed)
        for fabricated in ("07/29", "9999.99", "10:00"):
            self.assertTrue(any(fabricated in issue for issue in audit.issues), fabricated)

    def test_a_value_the_user_guessed_is_not_treated_as_grounded(self):
        """用户问"是 B09 还是 B10"时，B10 只是候选，不是事实。"""
        store = EvidenceStore()
        record = store.add("get_task_detail", {}, {"files": ["昂楷之道_B09.pdf"]})
        output = AgentTurnOutput.model_validate({
            "status": "answered", "intent_summary": "确认版本",
            "subject": {"entity_type": "publication", "name": "昂楷之道", "confidence": 1},
            "answer": "当前上传的是 B10。",
            "claims": [{"text": "当前上传版本是 B10", "kind": "version", "evidence_refs": [record.evidence_id]}],
            "used_specialists": ["workspace_analyst"],
        })
        audit = deterministic_verify("《昂楷之道》现在是 B09 还是 B10？", output, store, "2026-08")
        self.assertFalse(audit.passed)

    def test_todays_date_is_grounded_by_context_not_by_tool_evidence(self):
        """今天的日期来自系统时钟，永远不会出现在工具证据里。"""
        store = self._settlement_store()
        output = self._settlement_output("上一次导出结算回单在 **2026/07/28 23:09**，今天是 2026/08/11。")
        self.assertTrue(deterministic_verify("上次导出？", output, store, "2026-08 2026/08/11").passed)
        blocked = deterministic_verify("上次导出？", output, store, "")
        self.assertFalse(blocked.passed)

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
