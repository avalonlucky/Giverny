"""chat() 端到端编排：委派归属、审核跳过与本轮总预算。

用 ADK 的事件形状驱动真实 chat()，不启动 session service、不调用任何模型。
"""

import asyncio
import json
import unittest
from types import SimpleNamespace

from app.config import Settings
from app.runtime import AgentRuntime
from app.schemas import ChatRequest


SPEC = {
    "paths": {
        "/api/agent/tools/search-attachments": {
            "get": {"operationId": "search_attachments", "summary": "搜索任务附件"},
        },
    }
}

ROUTING = {
    "intent_summary": "用户在问这个项目的最新进展",
    "subject": None,
    "allowed_specialists": ["workspace_analyst"],
    "requires_evidence": True,
    "rationale": "需要工作区证据",
}

ANSWERED = {
    "status": "answered",
    "intent_summary": "查最新进展",
    "subject": None,
    "answer": "已确认这一版由设计组在上周完成。",
    "claims": [],
    "used_specialists": [],
}

CLARIFY = {
    "status": "needs_clarification",
    "intent_summary": "对象不唯一",
    "subject": None,
    "answer": "请补充任务名称。",
    "claims": [],
    "used_specialists": [],
}

AUDIT_PUBLISH = {
    "passed": True,
    "issues": [],
    "question_addressed": True,
    "subject_aligned": True,
    "evidence_sufficient": True,
    "recommendation": "publish",
}


def event(author, *, text="", thought="", calls=(), partial=False):
    parts = []
    if thought:
        parts.append(SimpleNamespace(text=thought, thought=True))
    if text:
        parts.append(SimpleNamespace(text=text, thought=False))
    return SimpleNamespace(
        author=author,
        partial=partial,
        output=None,
        content=SimpleNamespace(parts=parts, role="model"),
        get_function_calls=lambda: list(calls),
    )


class _Runner:
    def __init__(self, events, *, delay=0.0):
        self._events = events
        self.delay = delay
        self.calls = 0

    async def run_async(self, **_kwargs):
        self.calls += 1
        if self.delay:
            await asyncio.sleep(self.delay)
        for item in self._events:
            yield item


def build_request(question="这个项目最新进展是什么？"):
    return ChatRequest.model_validate({
        "question": question,
        "conversationId": "conv-1",
        "principal": {"workspaceId": "default", "principalId": "admin", "role": "admin", "runId": "run-1"},
        "selectedModel": {
            "provider": "deepseek",
            "model": "deepseek-v4-pro",
            "baseUrl": "https://api.deepseek.com",
            "apiKey": "test-only-key",
        },
    })


def build_runtime(supervisor, coordinator, auditor, *, turn_budget=240.0, request_timeout=30.0):
    runtime = object.__new__(AgentRuntime)
    runtime.settings = Settings(
        runtime_key="k",
        tool_base_url="http://127.0.0.1",
        tool_token="t",
        session_db_url="sqlite+aiosqlite:///:memory:",
        max_history_messages=4,
        request_timeout_seconds=request_timeout,
        turn_budget_seconds=turn_budget,
    )
    runtime.spec = SPEC
    runtime._conversation_locks = {}
    runtime.tool_factory = SimpleNamespace(pending_action=lambda *_a, **_kw: None)
    runtime._supervisor = lambda _model, _role: supervisor
    runtime._runners = lambda _model, _role, _allowed: (coordinator, auditor)
    return runtime


class DelegationAttributionTest(unittest.IsolatedAsyncioTestCase):
    """ADK 的委派工具就叫 transfer_to_agent，专家名只在 args 里。"""

    async def test_used_specialists_come_from_the_transfer_target(self):
        transfer = SimpleNamespace(name="transfer_to_agent", args={"agent_name": "workspace_analyst"})
        runtime = build_runtime(
            _Runner([event("scope_supervisor", text=json.dumps(ROUTING, ensure_ascii=False))]),
            _Runner([
                event("giverny_coordinator", calls=[transfer]),
                event("workspace_analyst", text="附件里最新的是上周那版"),
                event("giverny_coordinator", text=json.dumps(ANSWERED, ensure_ascii=False)),
            ]),
            _Runner([event("evidence_auditor", text=json.dumps(AUDIT_PUBLISH, ensure_ascii=False))]),
        )
        response = await runtime.chat(build_request())
        self.assertEqual(response.orchestration["specialists"], ["workspace_analyst"])
        self.assertEqual(response.productivity["path"], ["workspace_analyst"])
        self.assertEqual(response.answer, ANSWERED["answer"])

    async def test_transfer_target_never_reaches_the_user_visible_detail(self):
        """专家代号只能留在审计字段里，不能变成界面上的 detail。"""
        transfer = SimpleNamespace(name="transfer_to_agent", args={"agent_name": "workspace_analyst"})
        runtime = build_runtime(
            _Runner([event("scope_supervisor", text=json.dumps(ROUTING, ensure_ascii=False))]),
            _Runner([
                event("giverny_coordinator", calls=[transfer]),
                event("giverny_coordinator", text=json.dumps(ANSWERED, ensure_ascii=False)),
            ]),
            _Runner([event("evidence_auditor", text=json.dumps(AUDIT_PUBLISH, ensure_ascii=False))]),
        )
        response = await runtime.chat(build_request())
        details = [str(item.get("detail", "")) for item in response.trace]
        self.assertNotIn("workspace_analyst", details)
        self.assertIn("transfer_to_agent", details)


class AuditorSkipTest(unittest.IsolatedAsyncioTestCase):
    """结论不是 answered 时，审核结论改变不了任何输出——那次调用是纯浪费。"""

    async def test_auditor_is_skipped_when_no_publishable_conclusion_exists(self):
        auditor = _Runner([event("evidence_auditor", text=json.dumps(AUDIT_PUBLISH, ensure_ascii=False))])
        runtime = build_runtime(
            _Runner([event("scope_supervisor", text=json.dumps(ROUTING, ensure_ascii=False))]),
            _Runner([event("giverny_coordinator", text=json.dumps(CLARIFY, ensure_ascii=False))]),
            auditor,
        )
        response = await runtime.chat(build_request())
        self.assertEqual(auditor.calls, 0)
        self.assertIn("请补充任务 ID", response.answer)
        self.assertIn(
            "结论未成形，未进入复核",
            [str(item.get("detail", "")) for item in response.trace],
        )
        self.assertFalse(response.fact_verification["passed"])

    async def test_auditor_still_runs_for_an_answered_conclusion(self):
        auditor = _Runner([event("evidence_auditor", text=json.dumps(AUDIT_PUBLISH, ensure_ascii=False))])
        runtime = build_runtime(
            _Runner([event("scope_supervisor", text=json.dumps(ROUTING, ensure_ascii=False))]),
            _Runner([event("giverny_coordinator", text=json.dumps(ANSWERED, ensure_ascii=False))]),
            auditor,
        )
        response = await runtime.chat(build_request())
        self.assertEqual(auditor.calls, 1)
        self.assertTrue(response.fact_verification["passed"])

    async def test_auditor_reasoning_never_reaches_the_thinking_channel(self):
        """审核员的推理里带着还没过闸的草稿，展示它等于绕过这道闸门。"""
        thoughts: list[str] = []

        async def on_thought(text):
            thoughts.append(text)

        runtime = build_runtime(
            _Runner([event("scope_supervisor", thought="先确认对象", text=json.dumps(ROUTING, ensure_ascii=False))]),
            _Runner([event("giverny_coordinator", text=json.dumps(ANSWERED, ensure_ascii=False))]),
            _Runner([event(
                "evidence_auditor",
                thought="候选答案写着上周完成，但证据里没有对应记录",
                text=json.dumps(AUDIT_PUBLISH, ensure_ascii=False),
            )]),
        )
        await runtime.chat(build_request(), on_thought=on_thought)
        self.assertTrue(thoughts)
        for chunk in thoughts:
            self.assertNotIn("候选答案", chunk)
        self.assertIn("先确认对象", thoughts[-1])


AUDIT_REFUSE = {
    "passed": False,
    "issues": ["Claim '三个版本的附件分析均处于 dead_letter 状态' 无法由证据支持"],
    "advisory": [],
    "question_addressed": True,
    "subject_aligned": True,
    "evidence_sufficient": True,
    "recommendation": "refuse",
}

# 夹具里没有工具证据，所以答案不能出现版本号——确定性校验会正确地判它"版本结论缺少证据"。
# 这里要测的是"拒绝→修复→重新过审→发布"这条路径本身。
REPAIRED = {**ANSWERED, "answer": "最新上传的一版由设计组在上周完成，没有其他维度的更新。"}


class _SequenceRunner:
    """按调用次序返回不同事件序列，用来区分首轮与修复轮。"""

    def __init__(self, *rounds):
        self.rounds = list(rounds)
        self.calls = 0

    async def run_async(self, **_kwargs):
        events = self.rounds[min(self.calls, len(self.rounds) - 1)]
        self.calls += 1
        for item in events:
            yield item


def coordinator_rounds(first, second):
    return _SequenceRunner(
        [event("giverny_coordinator", text=json.dumps(first, ensure_ascii=False))],
        [event("giverny_coordinator", text=json.dumps(second, ensure_ascii=False))],
    )


def auditor_rounds(first, second):
    return _SequenceRunner(
        [event("evidence_auditor", text=json.dumps(first, ensure_ascii=False))],
        [event("evidence_auditor", text=json.dumps(second, ensure_ascii=False))],
    )


class RepairRoundTest(unittest.IsolatedAsyncioTestCase):
    """审核不通过时不要把整段正确答案扔掉，但也绝不能因此降低发布标准。"""

    def _runtime(self, coordinator, auditor):
        return build_runtime(
            _Runner([event("scope_supervisor", text=json.dumps(ROUTING, ensure_ascii=False))]),
            coordinator,
            auditor,
        )

    async def test_repaired_draft_is_published_after_passing_the_audit_again(self):
        coordinator = coordinator_rounds(ANSWERED, REPAIRED)
        auditor = auditor_rounds(AUDIT_REFUSE, AUDIT_PUBLISH)
        response = await self._runtime(coordinator, auditor).chat(build_request())
        self.assertEqual(response.answer, REPAIRED["answer"])
        self.assertTrue(response.fact_verification["passed"])
        self.assertEqual(coordinator.calls, 2)
        self.assertEqual(auditor.calls, 2)
        self.assertIn(
            "按复核意见修正后通过",
            [str(item.get("detail", "")) for item in response.trace],
        )

    async def test_repair_runs_at_most_once(self):
        """重写稿又被拒时维持原判，不得继续重试——那会变成无上限的费用与等待。"""
        coordinator = coordinator_rounds(ANSWERED, REPAIRED)
        auditor = auditor_rounds(AUDIT_REFUSE, AUDIT_REFUSE)
        response = await self._runtime(coordinator, auditor).chat(build_request())
        self.assertEqual(coordinator.calls, 2)
        self.assertEqual(auditor.calls, 2)
        self.assertFalse(response.fact_verification["passed"])
        self.assertIn("没有通过", response.answer)

    async def test_repaired_draft_that_fails_the_audit_is_never_published(self):
        coordinator = coordinator_rounds(ANSWERED, REPAIRED)
        auditor = auditor_rounds(AUDIT_REFUSE, AUDIT_REFUSE)
        response = await self._runtime(coordinator, auditor).chat(build_request())
        self.assertNotIn(REPAIRED["answer"], response.answer)

    async def test_deterministic_failure_gets_no_repair_round(self):
        """引用不存在的证据是硬伤，靠重写掩盖等于绕过闸门。"""
        forged = {
            **ANSWERED,
            "claims": [{"text": "最新上传的是 V1.0B10", "kind": "version", "evidence_refs": ["ev-does-not-exist"]}],
        }
        coordinator = coordinator_rounds(forged, REPAIRED)
        auditor = auditor_rounds(AUDIT_REFUSE, AUDIT_PUBLISH)
        response = await self._runtime(coordinator, auditor).chat(build_request())
        self.assertEqual(coordinator.calls, 1)
        self.assertFalse(response.fact_verification["passed"])

    async def test_wording_advice_alone_never_blocks_the_answer(self):
        """措辞建议进 advisory，不参与是否发布的判断。"""
        advisory_only = {**AUDIT_PUBLISH, "advisory": ["可以补充说明其他维度的最新情况"]}
        coordinator = coordinator_rounds(ANSWERED, REPAIRED)
        auditor = auditor_rounds(advisory_only, AUDIT_PUBLISH)
        response = await self._runtime(coordinator, auditor).chat(build_request())
        self.assertEqual(response.answer, ANSWERED["answer"])
        self.assertEqual(coordinator.calls, 1)
        self.assertEqual(auditor.calls, 1)


class CacheBoundTest(unittest.IsolatedAsyncioTestCase):
    """Runtime 的 systemd 单元设了 MemoryMax=1200M，无界字典就是慢性 OOM。"""

    async def test_conversation_gate_is_released_after_the_turn(self):
        runtime = build_runtime(
            _Runner([event("scope_supervisor", text=json.dumps(ROUTING, ensure_ascii=False))]),
            _Runner([event("giverny_coordinator", text=json.dumps(CLARIFY, ensure_ascii=False))]),
            _Runner([]),
        )
        for _ in range(3):
            await runtime.chat(build_request())
        self.assertEqual(runtime._conversation_locks, {})

    async def test_conversation_gate_survives_a_failing_turn(self):
        runtime = build_runtime(
            _Runner([event("scope_supervisor", text="不是 JSON")]),
            _Runner([]),
            _Runner([]),
        )
        with self.assertRaises(RuntimeError):
            await runtime.chat(build_request())
        self.assertEqual(runtime._conversation_locks, {})

    def test_adapter_caches_evict_the_least_recently_used_entry(self):
        from app.runtime import _ADAPTER_CACHE_LIMIT, _cache_get, _cache_put

        cache: dict[str, int] = {}
        for index in range(_ADAPTER_CACHE_LIMIT):
            _cache_put(cache, f"key-{index}", index)
        self.assertEqual(len(cache), _ADAPTER_CACHE_LIMIT)
        # 让第 0 个重新变成最近使用，再插入一个新的：淘汰的应该是第 1 个。
        _cache_get(cache, "key-0")
        _cache_put(cache, "overflow", -1)
        self.assertEqual(len(cache), _ADAPTER_CACHE_LIMIT)
        self.assertIn("key-0", cache)
        self.assertNotIn("key-1", cache)


class TurnBudgetTest(unittest.IsolatedAsyncioTestCase):
    """各阶段各拿一份单阶段超时的话，最坏会跑到 Worker 的 280 秒之外。"""

    async def test_total_budget_wins_over_a_larger_per_stage_timeout(self):
        runtime = build_runtime(
            _Runner([event("scope_supervisor", text=json.dumps(ROUTING, ensure_ascii=False))], delay=5.0),
            _Runner([event("giverny_coordinator", text=json.dumps(ANSWERED, ensure_ascii=False))]),
            _Runner([event("evidence_auditor", text=json.dumps(AUDIT_PUBLISH, ensure_ascii=False))]),
            turn_budget=0.2,
            request_timeout=120.0,
        )
        started = asyncio.get_running_loop().time()
        with self.assertRaises(TimeoutError):
            await runtime.chat(build_request())
        elapsed = asyncio.get_running_loop().time() - started
        # 单阶段超时是 120 秒；只有总预算生效才会在 0.2 秒左右就放弃。
        self.assertLess(elapsed, 2.0)

    async def test_budget_stays_inside_the_worker_subrequest_bound(self):
        settings = Settings.from_env()
        self.assertLess(settings.turn_budget_seconds, 280.0)


if __name__ == "__main__":
    unittest.main()
