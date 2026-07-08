# Giverny Agent Runtime

This is the code-owned agent runtime for Giverny. It is separate from the existing BAML `ai-runtime/` and replaces the retired Dify verification workflow.

The runtime uses the OpenAI Agents SDK to combine:

- an LLM
- Giverny tool calls
- a stable `/v1/chat` API
- a compact trace that the website can render as a folded "thinking / tool steps" timeline

## Local Setup

```bash
cd agent-runtime
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Fill `.env`:

```bash
OPENAI_API_KEY=...
OPENAI_AGENT_MODEL=gpt-4.1-mini
GIVERNY_API_BASE_URL=https://mayeai.com
GIVERNY_AGENT_TOOL_TOKEN=...
AGENT_RUNTIME_KEY=optional-local-runtime-key
```

Then run:

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8789
```

Health check:

```bash
curl http://127.0.0.1:8789/health
```

Chat test:

```bash
curl -X POST http://127.0.0.1:8789/v1/chat \
  -H "content-type: application/json" \
  -d '{"message":"帮我统计6月和7月的总金额","currentMonth":"2026-07"}'
```

## Notes

- Do not commit `.env`.
- Do not hardcode model keys or Giverny tool tokens.
- If a token was pasted into screenshots or chat, rotate it before using this runtime in production.

## Worker Integration

The Cloudflare Worker now has an optional Agent Runtime path for plain-text assistant requests.

Set Worker variables/secrets before enabling it in production:

```bash
AGENT_RUNTIME_URL=https://your-agent-runtime.example.com
AGENT_RUNTIME_KEY=the-same-runtime-key
```

`AI_RUNTIME_URL` is still reserved for the BAML runtime and should not be reused for this service.

In production, this runtime is deployed as a Cloudflare Container behind the main Worker. `/api/ai/chat` tries the `AGENT_RUNTIME_CONTAINER` binding first, then falls back to `AGENT_RUNTIME_URL` if configured, and finally falls back to the existing local assistant logic.

Cloudflare Container deployment requires:

```bash
npx wrangler secret put OPENAI_API_KEY
npx wrangler secret put AGENT_TOOL_TOKEN
npx wrangler secret put AGENT_RUNTIME_KEY
npx wrangler deploy
```
