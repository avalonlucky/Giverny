# Agent 领域地图

## 为什么需要它

Agent 原本只有一条认路的办法：把用户提到的名词当成一个**具名对象**，用 `resolve_workspace_subject`
去任务标题、附件名和会话里模糊搜索。

这条路对「汇联易改版那一版」是对的——那确实是一个要检索才知道存不存在的对象。
但对「结算回单」是错的。「结算」是站内七大导航之一，是网站的**一等业务概念**，
不是要搜的东西，是要知道的东西。真实故障就长这样：Agent 手里明明有
`query_settlement_exports`，却因为决定路由的那一层不知道有「结算」这个域，
先去搜任务标题，绕一大圈才碰对工具。

> 有些东西是要理解的，因为有些东西它肯定搜索不到。

领域地图补的是这块常识，不是新能力。

## 三层结构

| 层 | 内容 | 位置 |
| --- | --- | --- |
| 定义 | 八个领域、别名、对象字段、归口工具 | `src/agentDomainMap.ts` |
| 下发 | OpenAPI 的 `x-giverny-domains` 扩展 | `src/worker.ts` |
| 使用 | 解析、命中、渲染、落成专家可见性 | `agent-runtime/app/domain.py` |

## 八个领域

| 领域 | 一等对象 | 归口 |
| --- | --- | --- |
| 工作台 | 聚合视图，数据来自任务、结算与日程本身 | 工作区分析 |
| 任务 | 任务、工时记录、等待记录 | 工作区分析 |
| 文件库 | 附件、附件分析 | 工作区分析 |
| 洞察 | 洞察诊断（无读取工具） | 工作区分析 |
| 结算 | 结算回单 | 工作区分析 |
| 收入 | 月度收入 | 工作区分析 |
| 知识库 | 知识笔记（无专用读取工具） | 工作区分析 |
| 设置 | Giverny 自身的配置 | 产品支持 |

领域集合由 `AppView` 穷尽，不在这里手工维护——上表是给人读的，不是数据源。

## 一轮问答里它出现在哪

1. **对象判断阶段**拿到全量地图（烘进 instruction，随 Runner 缓存，每轮不重复序列化），
   外加 `<domain_hits>`——问题里字面命中的领域。
2. 模型输出 `domain` 字段。`_apply_domain_routing` 校验它确实存在，并把该域的
   归口专家加进 `allowed_specialists`。
3. 模型编了一个不存在的领域名 → 丢掉。模型漏了定域但字面**唯一命中** → 补上。
   命中多个说明问题跨域，交回语义判断，字面匹配没资格覆盖它。
4. **协调阶段**只拿到这一个域展开后的 `<domain_playbook>`：字段叫什么、该用哪个工具、
   读取边界是什么。全量地图对它是噪音。

## 读不到也是知识

洞察页面自己生成的诊断记录、知识库里的笔记，都没有对应的 Agent 读取工具。
地图里的 `unreadable` 字段写明这一点，playbook 会把它渲染成「读取边界」。

知道"读不到"和知道"读得到"同等重要：否则它会一直换关键词搜下去直到超时，
或者干脆编一个看起来合理的答案。

## 防漂移

这份地图最大的风险不是写错，是**三个月后和代码各说各话**。
所以它不是一份手抄清单，每一项都有强制核对：

| 约束 | 谁强制 | 漂移时的表现 |
| --- | --- | --- |
| 每个导航都被描述 | `Record<AppView, …>` + guard 解析 `navItems` | 编译失败 / guard 失败 |
| 工具名真实存在 | `AgentCapabilityName` | 编译失败 |
| 字段名真实存在 | guard 回源核对 `src/types/domain.ts`、`src/worker.ts` 的符号体 | guard 失败 |
| 工具文案不重抄 | manifest 现取 `agentCapabilityRegistry[name].title/description` | 不存在第二份副本 |
| 只读工具全部归口 | guard 反向核对；例外必须在 `agentUndomainedOperations` 里写明理由 | guard 失败 |
| 地图只指向只读工具 | guard 校验 `policy.risk === 'read'` | guard 失败 |
| 别名不跨域重复 | guard 校验唯一性 | guard 失败 |
| 跨语言键名对齐 | guard 比对 manifest 的键与 `domain.py` 读取的键 | guard 失败 |
| 两端确实接上 | guard 钉住 Worker/Runtime 的接线源码 | guard 失败 |

守卫在 `scripts/check-agent-domain-map.mjs`，已接入 `npm run architecture:guard`。

## 加一个领域时怎么做

1. 在 `src/types/domain.ts` 的 `AppView` 里加导航——这一步之后 TypeScript 会强制你继续。
2. 在 `agentDomainMap` 里补齐 summary / aliases / objects / operations / specialist。
   没有可用工具时必须写 `unreadable`，说明 Agent 读不到什么。
3. `node scripts/check-agent-domain-map.mjs`，按报错补齐。
4. `npm run agent:adk:test`——Runtime 侧的解析、命中与注入用例都在
   `agent-runtime/tests/test_domain_map.py`。

## 契约版本

Runtime 的 `/health` 返回 `contract: "domain-map-1"` 和 `domains: [...]`。
`domains` 为空说明 Runtime 拿到的是不带 `x-giverny-domains` 的旧版 OpenAPI——
两端还没对齐。这是唯一能从外部看到的信号，部署顺序仍然是 **Runtime 先于 Worker**。
