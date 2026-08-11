import asyncio
import json
import unittest
import unittest.mock

from app.runtime import AgentRuntime, _content_text, _sanitize_step, _thought_text


SPEC = {
    "paths": {
        "/api/agent/tools/search-attachments": {
            "get": {"operationId": "search_attachments", "summary": "搜索任务附件"},
            "post": {"operationId": "search_attachments_post", "summary": "搜索任务附件"},
        },
        "/api/agent/tools/task-detail": {
            "get": {"operationId": "get_task_detail", "summary": "读取任务详情"},
        },
        "/api/agent/tools/no-summary": {
            "get": {"operationId": "mystery_tool"},
        },
    }
}


class StepPhraseTest(unittest.TestCase):
    def setUp(self):
        # 只需要 _tool_phrase 的派生能力，不启动 session service 与 Runner。
        self.runtime = AgentRuntime.__new__(AgentRuntime)
        self.runtime.spec = SPEC

    def test_derives_natural_language_from_openapi_summary(self):
        self.assertEqual(self.runtime._tool_phrase("search_attachments"), "正在搜索任务附件")
        self.assertEqual(self.runtime._tool_phrase("get_task_detail"), "正在读取任务详情")

    def test_post_variant_falls_back_to_base_operation_summary(self):
        self.assertEqual(self.runtime._tool_phrase("search_attachments_post"), "正在搜索任务附件")

    def test_never_leaks_raw_operation_id(self):
        for name in ("mystery_tool", "", "totally_unknown_tool"):
            phrase = self.runtime._tool_phrase(name)
            self.assertEqual(phrase, "正在查阅业务数据")
            self.assertNotIn("_", phrase)

    def test_step_text_is_normalized_and_bounded(self):
        self.assertEqual(_sanitize_step("  多余   空白\n换行 "), "多余 空白 换行")
        self.assertEqual(len(_sanitize_step("长" * 400)), 120)
        self.assertEqual(_sanitize_step(None), "")


class _Part:
    def __init__(self, text, thought=False):
        self.text = text
        self.thought = thought


class _Event:
    def __init__(self, parts):
        self.content = type("C", (), {"parts": parts})()


class ThoughtSeparationTest(unittest.TestCase):
    """推理内容可以实时展示，但绝不能混进答案草稿——草稿要先过证据审核。"""

    def test_answer_text_excludes_thought_parts(self):
        event = _Event([_Part("先查一下附件版本", thought=True), _Part("最新版本是 V1.0B01。")])
        self.assertEqual(_content_text(event), "最新版本是 V1.0B01。")

    def test_thought_text_only_collects_thought_parts(self):
        event = _Event([_Part("先查一下附件版本", thought=True), _Part("最新版本是 V1.0B01。")])
        self.assertEqual(_thought_text(event), "先查一下附件版本")

    def test_parts_without_thought_flag_are_treated_as_answer(self):
        event = _Event([_Part("普通输出")])
        self.assertEqual(_content_text(event), "普通输出")
        self.assertEqual(_thought_text(event), "")


class _StreamRuntimeStub:
    """端点会问 runtime 本轮有没有申请推理输出，替身也必须回答。"""

    reasoning_expected = True

    @classmethod
    def reasoning_stream_expected(cls, _payload):
        return cls.reasoning_expected


class ChatStreamEndpointTest(unittest.TestCase):
    def _frames(self, runtime_chat, *, heartbeat=60.0):
        from app import main

        original = main._HEARTBEAT_SECONDS
        main._HEARTBEAT_SECONDS = heartbeat
        try:
            request = type("Req", (), {"app": type("App", (), {"state": type("S", (), {"runtime": runtime_chat})()})()})()
            payload = type("Payload", (), {"conversation_id": "conv-1"})()
            response = asyncio.run(self._collect(main, payload, request))
            return response
        finally:
            main._HEARTBEAT_SECONDS = original

    async def _collect(self, main, payload, request):
        streaming = await main.chat_stream(payload, request)
        chunks = []
        async for chunk in streaming.body_iterator:
            chunks.append(chunk if isinstance(chunk, bytes) else chunk.encode())
        return chunks

    def test_streams_accepted_steps_then_result(self):
        class FakeRuntime(_StreamRuntimeStub):
            async def chat(self, payload, on_step=None, on_thought=None):
                await on_step("正在判断这个问题问的是哪个对象、哪个维度")
                await on_step("正在搜索任务附件")
                return type("Resp", (), {"model_dump": lambda self, **kw: {"answer": "V1.0B01"}})()

        # 端点用 isinstance(runtime, AgentRuntime) 守门，替换掉这个符号即可放行替身。
        with unittest.mock.patch("app.main.AgentRuntime", FakeRuntime):
            frames = self._frames(FakeRuntime())

        text = b"".join(frames).decode()
        self.assertIn('"type": "accepted"', text)
        self.assertIn("正在搜索任务附件", text)
        self.assertIn('"type": "result"', text)
        self.assertIn("V1.0B01", text)
        self.assertLess(text.index("正在搜索任务附件"), text.index('"type": "result"'))

    def test_streams_reasoning_as_thinking_frames(self):
        class ThinkingRuntime(_StreamRuntimeStub):
            async def chat(self, payload, on_step=None, on_thought=None):
                await on_thought("用户问的是最新那一版")
                await on_step("正在搜索任务附件")
                return type("Resp", (), {"model_dump": lambda self, **kw: {"answer": "V1.0B01"}})()

        with unittest.mock.patch("app.main.AgentRuntime", ThinkingRuntime):
            frames = self._frames(ThinkingRuntime())

        text = b"".join(frames).decode()
        self.assertIn('"type": "thinking"', text)
        self.assertIn("用户问的是最新那一版", text)
        # 推理帧必须早于步骤帧和结果帧，否则等于又变成事后补发。
        self.assertLess(text.index('"type": "thinking"'), text.index('"type": "step"'))
        self.assertLess(text.index('"type": "step"'), text.index('"type": "result"'))

    def test_emits_heartbeat_while_orchestration_is_silent(self):
        class SlowRuntime(_StreamRuntimeStub):
            async def chat(self, payload, on_step=None, on_thought=None):
                await asyncio.sleep(0.25)
                return type("Resp", (), {"model_dump": lambda self, **kw: {"answer": "ok"}})()

        with unittest.mock.patch("app.main.AgentRuntime", SlowRuntime):
            frames = self._frames(SlowRuntime(), heartbeat=0.05)

        text = b"".join(frames).decode()
        self.assertIn(": keep-alive", text)
        self.assertIn('"type": "result"', text)

    def test_reports_failure_as_stream_error_instead_of_dropping_connection(self):
        class BrokenRuntime(_StreamRuntimeStub):
            async def chat(self, payload, on_step=None, on_thought=None):
                raise RuntimeError("证据链断了")

        with unittest.mock.patch("app.main.AgentRuntime", BrokenRuntime):
            frames = self._frames(BrokenRuntime())

        payloads = [
            json.loads(line[len("data: "):])
            for line in b"".join(frames).decode().split("\n\n")
            if line.startswith("data: ")
        ]
        error = next(item for item in payloads if item.get("type") == "error")
        self.assertEqual(error["status"], 502)
        # detail 会一路渲染到聊天气泡里，不能放框架异常原文
        # （用户曾因此看到「Max number of llm calls limit of 4 exceeded」）。
        self.assertNotIn("证据链断了", error["detail"])
        self.assertIn("没能完成", error["detail"])
        # 技术细节单独字段留给审计与日志。
        self.assertIn("证据链断了", error["technical"])
        self.assertIn("RuntimeError", error["technical"])

    def test_accepted_frame_declares_whether_reasoning_was_requested(self):
        class QuietRuntime(_StreamRuntimeStub):
            reasoning_expected = False

            async def chat(self, payload, on_step=None, on_thought=None):
                return type("Resp", (), {"model_dump": lambda self, **kw: {"answer": "ok"}})()

        with unittest.mock.patch("app.main.AgentRuntime", QuietRuntime):
            frames = self._frames(QuietRuntime())

        accepted = json.loads(b"".join(frames).decode().split("\n\n")[0][len("data: "):])
        self.assertEqual(accepted["type"], "accepted")
        # 没申请推理就必须说清楚，前端不能一直挂着"等待模型返回推理内容"。
        self.assertIs(accepted["reasoning"], False)


class ReasoningEnablementTest(unittest.TestCase):
    """混合推理模型不显式打开开关就不返回 reasoning_content，思考链只能是空的。"""

    def _config(self, provider, model, api_key="sk-test"):
        from app.schemas import SelectedModelConfig

        return SelectedModelConfig(provider=provider, model=model, baseUrl="https://api.example.com/v1", apiKey=api_key)

    def test_deepseek_v4_requests_provider_native_thinking(self):
        from app.agents import reasoning_extra_body, reasoning_is_requested

        for model in ("deepseek-v4-pro", "deepseek-v4-flash", "DeepSeek-V4"):
            config = self._config("deepseek", model)
            self.assertEqual(reasoning_extra_body(config), {"thinking": {"type": "enabled"}})
            self.assertTrue(reasoning_is_requested(config))

    def test_unverified_providers_get_no_speculative_body_fields(self):
        """没验证过的字段塞进请求体可能让每个请求都 400，代价大于少一段推理。"""
        from app.agents import reasoning_extra_body

        for provider, model in (("deepseek", "deepseek-chat"), ("kimi", "kimi-k2"), ("qwen", "qwen3.7-plus"), ("openai", "gpt-5")):
            self.assertEqual(reasoning_extra_body(self._config(provider, model)), {})

    def test_reasoning_switch_travels_as_extra_body(self):
        """litellm 把 deepseek 归到 openai 兼容路由，该路由的 thinking 参数会直接抛错。"""
        from app.agents import _model

        adapter = _model(self._config("deepseek", "deepseek-v4-pro"), reasoning=True)
        self.assertEqual(adapter._additional_args.get("extra_body"), {"thinking": {"type": "enabled"}})
        self.assertNotIn("thinking", adapter._additional_args)

        quiet = _model(self._config("deepseek", "deepseek-v4-pro"), reasoning=False)
        self.assertNotIn("extra_body", quiet._additional_args)

    def test_native_gemini_route_uses_a_thinking_planner(self):
        from app.agents import _thinking_planner

        self.assertIsNotNone(_thinking_planner(self._config("gemini", "gemini-3-pro", api_key="")))
        # 带 Key 的 Gemini 走 litellm，planner 的 thinking_config 在那条路上不适用。
        self.assertIsNone(_thinking_planner(self._config("gemini", "gemini-3-pro")))
        self.assertIsNone(_thinking_planner(self._config("gemini", "gemini-1.5-flash", api_key="")))


class InternalNameScrubTest(unittest.TestCase):
    """推理内容与 intent_summary 都是模型自由文本，会照着提示词念出内部名词。"""

    def setUp(self):
        self.runtime = AgentRuntime.__new__(AgentRuntime)
        self.runtime.spec = SPEC

    def test_tool_operation_ids_become_natural_language(self):
        scrubbed = self.runtime._scrub_internal("我需要先调用 search_attachments 看看附件，再 get_task_detail")
        self.assertNotIn("search_attachments", scrubbed)
        self.assertNotIn("get_task_detail", scrubbed)
        self.assertIn("搜索任务附件", scrubbed)
        self.assertIn("读取任务详情", scrubbed)

    def test_tool_without_summary_never_leaks_its_operation_id(self):
        self.assertNotIn("mystery_tool", self.runtime._scrub_internal("先用 mystery_tool 试试"))

    def test_specialist_and_transfer_names_are_replaced(self):
        scrubbed = self.runtime._scrub_internal("我打算 transfer_to_agent 给 workspace_analyst，让 evidence_auditor 复核")
        for leaked in ("transfer_to_agent", "workspace_analyst", "evidence_auditor"):
            self.assertNotIn(leaked, scrubbed)

    def test_framework_names_are_replaced(self):
        for jargon in ("Google ADK", "已交由 Google ADK 语义编排与证据审核主链", "Root Coordinator", "LiteLLM"):
            scrubbed = self.runtime._scrub_internal(f"由 {jargon} 处理")
            self.assertNotIn("ADK", scrubbed)
            self.assertNotIn("LiteLLM", scrubbed)
            self.assertNotIn("Coordinator", scrubbed)

    def test_protocol_field_names_are_replaced(self):
        scrubbed = self.runtime._scrub_internal("我要把 evidence_refs 填上，并设置 intent_summary")
        self.assertNotIn("evidence_refs", scrubbed)
        self.assertNotIn("intent_summary", scrubbed)

    def test_bare_role_words_are_replaced(self):
        """模型在推理里用裸词称呼自己：「因为 coordinator 自己没调用」。"""
        scrubbed = self.runtime._scrub_internal("因为 coordinator 自己没调用，auditor 也没要求，supervisor 已给出结论")
        for leaked in ("coordinator", "auditor", "supervisor"):
            self.assertNotIn(leaked, scrubbed.lower())
        self.assertIn("主协调", scrubbed)
        self.assertIn("结论复核", scrubbed)

    def test_evidence_hashes_are_not_shown_to_the_user(self):
        scrubbed = self.runtime._scrub_internal("证据编号 应该引用 ev-b940ffd36e705c5f")
        self.assertNotIn("ev-b940ffd36e705c5f", scrubbed)
        self.assertIn("某条证据", scrubbed)

    def test_protocol_field_names_get_distinct_readable_names(self):
        """两个不同字段不能替换成同一个词，否则 JSON 片段会变成两个同名字段。"""
        scrubbed = self.runtime._scrub_internal('{"entity_type": "task", "entity_id": "1"}')
        self.assertIn("对象类型", scrubbed)
        self.assertIn("对象编号", scrubbed)
        self.assertNotIn("entity_", scrubbed)

    def test_ordinary_text_survives_untouched(self):
        for text in ("硬封套最新是 V3 打样稿", "任务标题叫 hard_cover 封面", ""):
            self.assertEqual(self.runtime._scrub_internal(text), text)


class StructuredStreamCollectorTest(unittest.IsolatedAsyncioTestCase):
    """用 ADK 真实事件形状驱动 _run_structured：增量 + 段末聚合帧。"""

    def setUp(self):
        self.runtime = AgentRuntime.__new__(AgentRuntime)
        self.runtime.spec = SPEC

    def _runner(self, events):
        class FakeRunner:
            async def run_async(self, **_kwargs):
                for event in events:
                    yield event

        return FakeRunner()

    def _event(self, *, author="giverny_coordinator", text="", thought="", partial=False, calls=()):
        parts = []
        if thought:
            parts.append(_Part(thought, thought=True))
        if text:
            parts.append(_Part(text))
        event = _Event(parts)
        event.author = author
        event.partial = partial
        event.output = None
        event.get_function_calls = lambda: list(calls)
        return event

    async def test_repeated_delta_chunks_do_not_break_structured_parsing(self):
        from app.schemas import AgentTurnOutput

        payload = {
            "status": "answered",
            "intent_summary": "查最新版本",
            "subject": {"entity_type": "task", "name": "硬封套", "entity_id": "", "confidence": 1.0},
            "answer": "最新是 V3 打样稿。",
            "claims": [],
            "used_specialists": [],
        }
        full = json.dumps(payload, ensure_ascii=False)
        # 逐字符切片必然产生"和上一片相同"的分片（"" 与 }}），这正是旧合并逻辑的死穴。
        events = [self._event(text=chunk, partial=True) for chunk in full]
        events.append(self._event(text=full))

        parsed, _trace = await AgentRuntime._run_structured(
            self.runtime,
            self._runner(events),
            user_id="u",
            session_id="s",
            prompt="p",
            schema=AgentTurnOutput,
            max_llm_calls=4,
            result_author="giverny_coordinator",
        )
        self.assertEqual(parsed.answer, "最新是 V3 打样稿。")

    async def test_thinking_stream_is_scrubbed_before_it_leaves_the_runtime(self):
        from app.schemas import AgentTurnOutput

        payload = {
            "status": "needs_clarification",
            "intent_summary": "需要澄清",
            "subject": None,
            "answer": "请补充任务名称。",
            "claims": [],
            "used_specialists": [],
        }
        events = [
            self._event(thought="用户问的是最新那一版，", partial=True),
            self._event(thought="我先用 search_attachments 查附件", partial=True),
            self._event(thought="用户问的是最新那一版，我先用 search_attachments 查附件"),
            self._event(text=json.dumps(payload, ensure_ascii=False)),
        ]
        thoughts: list[str] = []

        async def on_thought(text):
            thoughts.append(text)

        await AgentRuntime._run_structured(
            self.runtime,
            self._runner(events),
            user_id="u",
            session_id="s",
            prompt="p",
            schema=AgentTurnOutput,
            on_thought=on_thought,
            max_llm_calls=4,
            result_author="giverny_coordinator",
        )
        self.assertTrue(thoughts)
        for chunk in thoughts:
            self.assertNotIn("search_attachments", chunk)
        # 聚合帧取代同段增量，不能把同一句话拼成两遍。
        self.assertEqual(thoughts[-1], "用户问的是最新那一版，我先用 「搜索任务附件」 查附件")


if __name__ == "__main__":
    unittest.main()
