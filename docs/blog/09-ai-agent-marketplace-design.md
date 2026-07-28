---
title: "AI Agent 市场设计:让 Agent 像 App 一样被交易与编排"
date: "2026-07-27"
tags: ["AI Agent", "Agent 市场", "Agent 交易", "Agent 编排", "LangGraph Agent"]
category: "AI 产品"
description: "AI Agent 不再是写死在某个产品里的功能,而是可以被定价、上架、订阅、编排的数字商品。本文拆解 Agent 市场的产品设计与 IHUI-AI 的市场架构。"
---

# AI Agent 市场设计:让 Agent 像 App 一样被交易与编排

> App Store 把「软件」变成了可被一键购买、安装、评分的商品,AI 时代对应的实体是「Agent」。一个 Agent = 一段可被复用的提示词 + 工具集 + 知识库 + 模型路由配置。本文讲清楚一个 Agent 市场需要哪些核心机制,以及 IHUI-AI 的实现路径。

---

## 一、Agent 市场的产品定义

### 什么是「可上架的 Agent」

不是所有对话 prompt 都能成为商品。一个可上架的 Agent 必须满足:

1. **可独立运行**:用户购买后能立刻用,不需要再写代码。
2. **可复用**:不同用户用同一个 Agent 都能得到稳定结果。
3. **可定价**:有明确的使用边界(次数 / 时长 / 调用规模)。
4. **可评估**:有客观的质量指标(成功率 / 满意度 / 失败率)。

### Agent 定义格式

IHUI-AI 用一份 schema 描述可上架的 Agent:

```typescript
const MarketplaceAgentSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string(),
  // 核心能力
  systemPrompt: z.string(),
  tools: z.array(z.string()),         // 引用工具/MCP server
  knowledgeBases: z.array(z.string()),// 绑定 RAG 知识库
  modelRouting: z.object({
    default: z.string(),               // 默认模型
    fallback: z.string().optional(),   // 降级模型
  }),
  // 定价
  pricing: z.object({
    model: z.enum(["free", "subscription", "per_call", "revenue_share"]),
    price: z.number(),
    currency: z.string().default("CNY"),
    trialQuota: z.number().default(0),
  }),
  // 评估
  metrics: z.object({
    successRate: z.number(),
    avgLatencyMs: z.number(),
    rating: z.number().min(0).max(5),
    usageCount: z.number(),
  }),
});
```

---

## 二、四种定价模型

| 模型 | 适用 | 优点 | 缺点 |
| --- | --- | --- | --- |
| **免费(Free)** | 引流、品牌 Agent | 易扩散 | 无直接收入 |
| **订阅(Subscription)** | 高频工具型 Agent | 收入稳定 | 流失需运营 |
| **按调用计费(Per Call)** | 低频高价值 Agent | 与成本对齐 | 用户预算焦虑 |
| **分成(Revenue Share)** | 内容生成型 Agent | 创作者激励 | 结算复杂 |

IHUI-AI 默认采用 **订阅 + 按调用混合**:基础功能订阅包月,超出额度按调用计费,创作者拿 70% 分成。

---

## 三、Agent 质量评估:四维评分

简单的「5 星好评」不够,因为容易被刷分。IHUI 用四维加权:

1. **任务成功率(40%)**:Agent 完成用户原始任务的比率,由 LLM-as-Judge 自动评估。
2. **用户评分(25%)**:真实用户打分,过滤异常分布(全是 5 星或 1 星)。
3. **响应延迟(15%)**:首 token 时延 + 总时长,归一化到 [0,1]。
4. **稳定性(20%)**:错误率 + 重试率,错误越少分越高。

```python
def agent_score(metrics) -> float:
    return (
        0.40 * min(metrics.success_rate, 1.0) +
        0.25 * metrics.user_rating / 5 +
        0.15 * (1 - min(metrics.p95_latency / 30_000, 1)) +
        0.20 * (1 - min(metrics.error_rate / 0.1, 1))
    )
```

这个分数实时更新,作为市场搜索排序的依据。

---

## 四、Agent 编排:从单个 Agent 到 Agent 工作流

单个 Agent 的能力有上限。Agent 市场的真正价值在于「让用户像搭积木一样编排多个 Agent」。

### 编排模式 1:链式(Sequential)

```
[需求分析 Agent] → [代码生成 Agent] → [代码审查 Agent] → [部署 Agent]
```

每个 Agent 处理上一步的输出,适合流程明确的任务。

### 编排模式 2:并行(Parallel)

```
[市场调研 Agent] ─┐
[竞品分析 Agent] ─┼→ [综合决策 Agent]
[财务分析 Agent] ─┘
```

适合需要多视角汇聚的任务。

### 编排模式 3:循环(Looping / ReAct)

```
[规划 Agent] ⇄ [执行 Agent] ⇄ [评估 Agent]
       └───────────┴───────────┘
```

评估不通过就回到规划阶段,适合开放式探索任务。

IHUI-AI 用 **LangGraph** 实现这三种编排,把每个节点定义成一个可被市场交易的 Agent,用户可以在画布上拖拽组合:

```python
from langgraph.graph import StateGraph

graph = StateGraph(state_schema=WorkflowState)
graph.add_node("planner", market_agent_node("planner-agent-id"))
graph.add_node("executor", market_agent_node("executor-agent-id"))
graph.add_node("reviewer", market_agent_node("reviewer-agent-id"))
graph.add_edge("planner", "executor")
graph.add_conditional_edges("reviewer", lambda s:
    "executor" if s.needs_revision else END
)
```

---

## 五、IHUI-AI Agent 市场架构

```
[Creator Studio]  →  [Agent Registry]  →  [Marketplace UI]
       ↓                    ↓                      ↓
[定价配置]          [质量评估引擎]         [购买/订阅]
       ↓                    ↓                      ↓
[沙箱测试]          [版本管理]             [调用编排]
       ↓                    ↓                      ↓
[Creator Dashboard] ← [Revenue Settlement] ← [Usage Tracking]
```

- **Creator Studio**:创作者用低代码方式定义 Agent(prompt + 工具 + KB)。
- **沙箱测试**:发布前强制跑 50 条评估用例,达标才能上架。
- **Revenue Settlement**:每天结算创作者收益,7 天账期。
- **Usage Tracking**:基于事件流,实时反哺评估指标。

---

## 六、Agent 市场的三大风险与对策

1. **恶意 Agent**:prompt injection 偷用户数据。对策:工具调用沙箱 + 输出审计。
2. **同质化**:一堆「翻译 Agent」没差异。对策:搜索排序按质量分,不只按热度。
3. **创作者维权困难**:被刷差评没渠道申诉。对策:提供评分分布审计 + 申诉工单。

---

## 七、为什么现在做 Agent 市场

- **底层模型成熟**:GPT-4o / Claude / GLM 都能稳定产出可用 Agent。
- **协议统一**:MCP 让 Agent 工具调用可标准化。
- **用户教育完成**:ChatGPT 用户已习惯「切换 GPTs」,市场心智成熟。

剩下要做的就是:把 Agent 变成「可发现、可定价、可编排、可结算」的商品。IHUI-AI 正在做这件事。

---

**相关链接**

- 项目仓库:<https://github.com/IHUI-INF-AI/IHUI-AI>
- 官网体验 Agent 市场:<https://aizhs.top>
- LangGraph 文档:<https://langchain-ai.github.io/langgraph/>

如果你也在做 AI Agent 产品或想成为创作者,欢迎到 GitHub 给 IHUI-AI 点 Star ⭐,也欢迎来官网注册成为第一批 Agent 创作者。

---

**SEO 关键词**:`AI Agent`、`Agent 市场`、`Agent 交易`、`Agent 编排`、`LangGraph Agent`、`Agent 定价`、`Agent 评估`、`Creator Economy`
