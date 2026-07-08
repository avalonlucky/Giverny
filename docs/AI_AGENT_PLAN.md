# AI Agent 规划：需求润色与设计类型推荐

更新时间：2026-06-15 11:31

## 当前落地状态

- 自 `v0.10.26` 起已接入第一阶段 DeepSeek Tool Calls；`DEEPSEEK_API_KEY` 已写入 Cloudflare 正式环境 Worker Secret。
- Worker 新增 `/api/ai/task-assistant`，由后端读取 `DEEPSEEK_API_KEY` 并调用 DeepSeek，前端不接触密钥。
- 新建任务弹窗在「任务具体需求」右上角提供 AI 图标按钮。
- AI 返回后只展示建议；采用文案、采用已有分类、创建缺失分类都需要管理员点击确认。
- 未配置 `DEEPSEEK_API_KEY` 时，接口返回明确提示，不影响手动创建任务；完整线上验收还需要有效管理员登录凭证。

## 目标

- 在新建任务时，管理员先输入原始「任务具体需求」。
- AI Agent 自动润色为更清晰、适合写入月报和结算单的任务需求。
- AI Agent 根据需求建议「设计类型」的大类和子类。
- 如果建议的分类不存在，必须先展示确认项；管理员确认后，才写入设计类型库。

## 技术判断

- DeepSeek API 支持 OpenAI 兼容调用，适合接入 Cloudflare Worker 后端。
- DeepSeek 官方文档明确支持 Function Calling / Tool Calls，可让模型调用外部工具来增强能力。
- Vercel AI SDK 提供 `@ai-sdk/deepseek` Provider，适合 React / TypeScript 体系内快速接入 DeepSeek。
- Mastra 是 TypeScript Agent 框架，提供 agents、tools、workflows、memory 等能力；如果后续 Agent 不止一个，可以作为大版本架构候选。
- 下一版建议采用 Tool Calls 方式，不做纯 Prompt 文本解析：
  - `rewriteRequirement(rawText)`：润色需求。
  - `suggestDesignType(rawText, designTypeGroups)`：从现有分类中选择或提出新增分类。
  - `createDesignTypeGroup(name)` / `createDesignTypeItem(groupName, item)`：必须经过前端确认后调用。
- 前端不直接暴露 DeepSeek API Key，Key 只放在 Cloudflare Worker Secret 中。
- 管理员登录采用账号密码制：邮箱 `bh141425@gmail.com` + 平台内部管理员密码。测试 `/api/ai/task-assistant` 时需要使用这组管理员凭证。

## 产品约束

- AI 只能给建议，不能绕过确认直接修改设计类型库。
- 分类新增属于后台数据变更，需要展示差异：新增大类、新增子类、原因。
- AI 建议失败时，新建任务流程必须仍可手动完成。
- Agent 入口建议放在「任务具体需求」输入框右上角的小图标按钮中，不额外占表单空间。

## 后续实施步骤

1. 在设置页增加 AI Provider 状态，只显示是否已配置，不显示密钥。
2. 增加 AI 请求日志摘要，便于排查失败原因，但不记录完整密钥或敏感信息。
3. 根据实际使用反馈，决定是否引入 Vercel AI SDK 或 Mastra；当前单一表单场景暂不引入外部编排平台，避免系统变重。
4. 若后续出现知识库、复杂工作流、多 Agent 编排，优先扩展自建 OpenAI Agents SDK Runtime，再评估是否需要其他框架。

## 参考来源

- DeepSeek Function Calling：`https://api-docs.deepseek.com/guides/function_calling`
- DeepSeek OpenAI 兼容 API：`https://api-docs.deepseek.com/`
- Vercel AI SDK DeepSeek Provider：`https://ai-sdk.dev/providers/ai-sdk-providers/deepseek`
- Mastra TypeScript Agent Framework：`https://mastra.ai/`
- Mastra GitHub：`https://github.com/mastra-ai/mastra`
