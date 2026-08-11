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
        class FakeRuntime:
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
        class ThinkingRuntime:
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
        class SlowRuntime:
            async def chat(self, payload, on_step=None, on_thought=None):
                await asyncio.sleep(0.25)
                return type("Resp", (), {"model_dump": lambda self, **kw: {"answer": "ok"}})()

        with unittest.mock.patch("app.main.AgentRuntime", SlowRuntime):
            frames = self._frames(SlowRuntime(), heartbeat=0.05)

        text = b"".join(frames).decode()
        self.assertIn(": keep-alive", text)
        self.assertIn('"type": "result"', text)

    def test_reports_failure_as_stream_error_instead_of_dropping_connection(self):
        class BrokenRuntime:
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
        self.assertIn("证据链断了", error["detail"])


if __name__ == "__main__":
    unittest.main()
