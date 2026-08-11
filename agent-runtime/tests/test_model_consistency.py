import unittest
from types import SimpleNamespace

from pydantic import ValidationError

from app.agents import _model
from app.runtime import AgentRuntime, COORDINATOR_LLM_CALL_LIMIT, SUPERVISOR_LLM_CALL_LIMIT, TOTAL_LLM_CALL_LIMIT
from app.schemas import ChatRequest, RoutingDecision, SelectedModelConfig


REQUEST = {
    "question": "《昂楷之道》的最新版本是什么？",
    "conversationId": "conv-1",
    "principal": {
        "workspaceId": "default",
        "principalId": "admin",
        "role": "admin",
        "runId": "run-1",
    },
}


class SelectedModelContractTest(unittest.TestCase):
    def test_chat_rejects_missing_selected_model(self):
        with self.assertRaises(ValidationError):
            ChatRequest.model_validate(REQUEST)

    def test_selected_model_is_exact_and_secret_is_not_serialized(self):
        request = ChatRequest.model_validate({
            **REQUEST,
            "selectedModel": {
                "provider": "deepseek",
                "model": "deepseek-v4-pro",
                "baseUrl": "https://api.deepseek.com",
                "apiKey": "secret-value",
            },
        })
        self.assertEqual(request.selected_model.provider, "deepseek")
        self.assertEqual(request.selected_model.model, "deepseek-v4-pro")
        self.assertNotIn("api_key", request.selected_model.model_dump())
        self.assertNotIn("secret-value", repr(request.selected_model))

    def test_cache_identity_changes_when_key_rotates_without_exposing_key(self):
        first = SelectedModelConfig(provider="deepseek", model="deepseek-v4-pro", baseUrl="https://api.deepseek.com", apiKey="first-secret")
        second = SelectedModelConfig(provider="deepseek", model="deepseek-v4-pro", baseUrl="https://api.deepseek.com", apiKey="second-secret")
        first_key = AgentRuntime._model_key(first)
        second_key = AgentRuntime._model_key(second)
        self.assertNotEqual(first_key, second_key)
        self.assertNotIn("first-secret", repr(first_key))
        self.assertNotIn("second-secret", repr(second_key))

    def test_deepseek_selection_builds_deepseek_adapter_not_gemini(self):
        selected = SelectedModelConfig(
            provider="deepseek",
            model="deepseek-v4-pro",
            baseUrl="https://api.deepseek.com",
            apiKey="test-only-key",
        )
        adapter = _model(selected)
        self.assertEqual(getattr(adapter, "model", ""), "openai/deepseek-v4-pro")
        self.assertNotIn("gemini", getattr(adapter, "model", "").lower())

    def test_vertex_gemini_uses_exact_selected_identifier(self):
        selected = SelectedModelConfig(
            provider="gemini",
            model="gemini-3.1-pro-preview",
            baseUrl="https://aiplatform.googleapis.com",
        )
        self.assertEqual(_model(selected), "gemini-3.1-pro-preview")


class _FakeRunner:
    def __init__(self, output):
        self.output = output
        self.run_config = None

    async def run_async(self, **kwargs):
        self.run_config = kwargs.get("run_config")
        yield SimpleNamespace(
            author="test",
            content=SimpleNamespace(parts=[SimpleNamespace(text=self.output, thought=False)]),
            output=None,
        )


class ModelCallBudgetTest(unittest.IsolatedAsyncioTestCase):
    async def test_coordinator_receives_hard_four_call_limit(self):
        runner = _FakeRunner("done")
        runtime = object.__new__(AgentRuntime)
        await runtime._run_text(
            runner,
            user_id="user",
            session_id="session",
            prompt="question",
            max_llm_calls=COORDINATOR_LLM_CALL_LIMIT,
        )
        self.assertEqual(runner.run_config.max_llm_calls, 4)
        self.assertEqual(TOTAL_LLM_CALL_LIMIT, 7)

    async def test_structured_stage_receives_one_call_limit(self):
        runner = _FakeRunner('{"intent_summary":"查项目版本","subject":null,"allowed_specialists":["workspace_analyst"],"requires_evidence":true,"rationale":"需要工作区证据"}')
        runtime = object.__new__(AgentRuntime)
        parsed, _ = await runtime._run_structured(
            runner,
            user_id="user",
            session_id="session",
            prompt="question",
            schema=RoutingDecision,
            max_llm_calls=SUPERVISOR_LLM_CALL_LIMIT,
        )
        self.assertEqual(parsed.allowed_specialists, ["workspace_analyst"])
        self.assertEqual(runner.run_config.max_llm_calls, 1)


if __name__ == "__main__":
    unittest.main()
