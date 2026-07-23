# P3 深度层技术方案调研归档(2026-07-23)

> **来源**:深度对标 40+ 竞品(Claude Code/Cursor/Dify/Khan Academy/Stripe/Auth0/Mixpanel 等)后发现 9 个 P0 能力缺口。
> **本文档**:LangGraph 升级(5 个 P0)+ AI 教育引擎(4 个 P0)两份立项技术方案归档。
> **后续**:用户确认立项后,从本文档提取任务条目登记到 `PROJECT_PLAN.md`。
> **关联**:README.md 同步修正 SRS 误判 + 定位话术(认知纠偏,commit 同批次)。

---

## 一、背景:对标竞品 9 个 P0 缺口

### 1.1 LangGraph 维度(对标 Claude Code/Cursor/Dify/LangChain)

| # | P0 缺陷 | 竞品现状 | IHUI-AI 现状 |
|---|---|---|---|
| L1 | 无节点级 checkpointer | LangGraph PostgresSaver 节点级持久化 | 手写 AgentCheckpointManager 粗粒度 |
| L2 | 无 interrupt HITL | LangGraph interrupt() 节点暂停 + Command(resume=) | 无人工介入断点 |
| L3 | 无 5 模式 streaming | stream_mode=["updates","messages","events"] | 单模式 token stream |
| L4 | 无 subgraphs | LangGraph 嵌套子图 + 独立状态 | 扁平 DAG |
| L5 | 无 Time Travel | get_state_history 回溯任意节点 | 无历史回放 |

### 1.2 AI 教育维度(对标 Khan Academy/Coursera/学而思 AI)

| # | P0 缺陷 | 竞品现状 | IHUI-AI 现状 |
|---|---|---|---|
| E1 | 无 AI 助教 | Khan Academy Khanmigo 全程陪伴 | 仅聊天机器人 |
| E2 | 无真 SRS | Anki SM-2 算法 | **误判**:srs.ts 是流媒体,非间隔重复 |
| E3 | 无 AI 批改主观题 | Grammarly/学而思 AI 批改 | 仅 gradeSubjectiveAnswers 人工 |
| E4 | 无 AI 出题 | Khan Academy/学而思 AI 出题 | 仅 i18n 营销文案 |

---

## 二、方案一:LangGraph 升级(5 个 P0)

### 2.1 新增依赖

```
langgraph>=0.5.0
langgraph-checkpoint-postgres>=2.0.0
psycopg[binary]>=3.2.0
```

### 2.2 Q1 任务清单(11 任务,~12.5 工时)

| # | 任务 | 文件 | 验收 |
|---|---|---|---|
| Q1.1 | PostgresSaver 接入 | `apps/ai-service/app/services/agent_checkpoint.py` | 替换 AgentCheckpointManager |
| Q1.2 | checkpointer schema migration | `packages/database/src/migrations/` | checkpoints + writes 表 |
| Q1.3 | thread_id 路由隔离 | `apps/ai-service/app/routers/agent.py` | 每会话独立 thread_id |
| Q1.4 | interrupt() 节点暂停 | `apps/ai-service/app/services/agent_loop.py` | 节点内 interrupt() 触发暂停 |
| Q1.5 | Command(resume=) 恢复 | `apps/api/src/routes/agent-resume.ts` | POST /resume 恢复执行 |
| Q1.6 | 5 模式 streaming | `apps/ai-service/app/services/agent_stream.py` | stream_mode 组合输出 |
| Q1.7 | SSE 12 类事件 | `apps/api/src/routes/agent-stream.ts` | session/token/node_start/node_end/tool_call/tool_result/state_update/plan/interrupt/done/error |
| Q1.8 | 4 端点 | `apps/api/src/routes/agent-*.ts` | /{thread_id}/interrupt, /resume, /state, /history |
| Q1.9 | TS 类型契约 | `packages/types/src/agent-runtime.ts` | LangGraphState/InterruptEvent/ResumeCommand |
| Q1.10 | Web SSE 消费 | `apps/web/src/hooks/use-agent-stream.ts` | 12 类事件 hook |
| Q1.11 | HITL UI | `apps/web/src/components/chat/interrupt-panel.tsx` | 暂停/恢复/编辑/批准 |

**Q1 共存策略**:AgentCheckpointManager 与 PostgresSaver Q1 共存(Q1.1 用 feature flag 切换),Q2 退役 AgentCheckpointManager。

### 2.3 Q2 任务清单(11 任务,~20 工时)

| # | 任务 | 文件 | 验收 |
|---|---|---|---|
| Q2.1 | subgraphs 嵌套 | `apps/ai-service/app/services/agent_subgraph.py` | 父子图状态隔离 |
| Q2.2 | subgraph 状态映射 | `apps/ai-service/app/services/agent_state.py` | Channel 写入策略 |
| Q2.3 | Time Travel get_state_history | `apps/ai-service/app/services/agent_history.py` | 任意节点回溯 |
| Q2.4 | Time Travel UI | `apps/web/src/components/chat/timeline-panel.tsx` | 历史节点可视化 |
| Q2.5 | AgentLoopV2 改造 | `apps/ai-service/app/services/agent_loop_v2.py` | 基于 LangGraph compiled graph |
| Q2.6 | DAG 迁移 | `apps/ai-service/app/services/dag_scheduler.py` | DAG 节点 → LangGraph node |
| Q2.7 | 旧 AgentCheckpointManager 退役 | `apps/ai-service/app/services/agent_checkpoint.py` | 删除 + 迁移测试 |
| Q2.8 | OpenAPI spec 更新 | `apps/api/openapi.json` | 4 端点 + SSE schema |
| Q2.9 | e2e 测试 | `apps/web/e2e/agent-hitl.spec.ts` | interrupt → resume 全链路 |
| Q2.10 | 性能基线 | `apps/ai-service/tests/test_langgraph_perf.py` | checkpoint 延迟 < 50ms |
| Q2.11 | 文档 + README 同步 | `README.md` | LangGraph 能力清单更新 |

### 2.4 跨端范围(§9 多端同步)

| 端 | 改动 | 验证 |
|---|---|---|
| ai-service | PostgresSaver + interrupt + streaming + subgraph | pytest |
| api | 4 端点 + SSE 路由 | typecheck + test |
| web | SSE hook + HITL UI + Time Travel UI | typecheck + e2e |
| packages/types | LangGraphState/InterruptEvent/ResumeCommand 类型 | typecheck |

### 2.5 风险

- **R1**:LangGraph 0.5+ API 2026 年可能变动,需二次校验 5 个 API 点(interrupt/Command/PostgresSaver/stream_mode/get_state_history)
- **R2**:PostgresSaver 与现有 AgentCheckpointManager 共存期数据一致性
- **R3**:SSE 12 类事件前端消费复杂度高,需状态机管理

---

## 三、方案二:AI 教育引擎(4 个 P0)

### 3.1 SM-2 算法核心(SRS 间隔重复,真实现)

```python
def sm2_update(quality: int, ease_factor: float, interval: int, repetition: int):
    """quality: 0-5(0-2 失败,3-5 成功)
    ease_factor: 初始 2.5,最低 1.3
    interval: 天数,repetition=0 → 1, repetition=1 → 6, 否则 interval * ease_factor
    repetition: 成功 +1,失败(quality<3)重置为 0
    """
    if quality < 3:
        return 1, 0, max(1.3, ease_factor - 0.2)  # 重置
    if repetition == 0:
        interval = 1
    elif repetition == 1:
        interval = 6
    else:
        interval = round(interval * ease_factor)
    ease_factor = max(1.3, ease_factor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)))
    return interval, repetition + 1, ease_factor
```

### 3.2 Phase 1 任务清单(2 周)

| # | 任务 | 文件 | 验收 |
|---|---|---|---|
| P1.1 | SM-2 算法引擎 | `apps/api/src/services/spaced-repetition.ts` | sm2_update 单元测试 10 case |
| P1.2 | exam_wrong_question 表加 SRS 字段 | `packages/database/src/schema/` | easeFactor/interval/repetition/dueDate/lastReviewAt |
| P1.3 | SRS 复习 API | `apps/api/src/routes/srs-review.ts` | GET /api/srs-review/due + POST /api/srs-review/review |
| P1.4 | AI 助教 prompt 工程 | `apps/ai-service/app/services/ai_tutor.py` | 学科 persona + 知识点拆解 |
| P1.5 | AI 助教 API | `apps/ai-service/app/routers/ai_tutor.py` | POST /api/ai-tutor/explain + /hint + /quiz |
| P1.6 | Web 复习页面 | `apps/web/app/(main)/learn/review/page.tsx` | 错题本 → SRS 复习 → 难度评分 |
| P1.7 | Web AI 助教侧栏 | `apps/web/src/components/chat/ai-tutor-panel.tsx` | 学科切换 + 知识点引导 |
| P1.8 | i18n(5 语言) | `apps/web/messages/*.json` | srsReview + aiTutor 命名空间 |

**命名避冲突**:新文件 `spaced-repetition.ts`(非 srs.ts),API 前缀 `/api/srs-review`(避开流媒体 `/api/srs/*`)。

### 3.3 Phase 2 任务清单(2 周)

| # | 任务 | 文件 | 验收 |
|---|---|---|---|
| P2.1 | ai_grading_record 表 | `packages/database/src/schema/` | studentId/questionId/score/feedback/rubric |
| P2.2 | exam_questions 表加字段 | `packages/database/src/schema/` | rubric(JSON)+ source(manual/ai) |
| P2.3 | knowledge_points 表 | `packages/database/src/schema/` | subject/chapter/difficulty/prerequisites |
| P2.4 | AI 批改引擎 | `apps/ai-service/app/services/ai_grading.py` | 主观题 rubric 评分 + 反馈生成 |
| P2.5 | AI 批改 API | `apps/ai-service/app/routers/ai_grading.py` | POST /api/ai-grading/grade |
| P2.6 | AI 出题引擎 | `apps/ai-service/app/services/ai_question_gen.py` | 知识点 → 题目(选择/填空/主观) |
| P2.7 | AI 出题 API | `apps/ai-service/app/routers/ai_question_gen.py` | POST /api/ai-question/generate |
| P2.8 | ai_generated_question 表 | `packages/database/src/schema/` | prompt/model/output/quality/humanReview |
| P2.9 | Web 批改结果页 | `apps/web/app/(main)/learn/grading/page.tsx` | 批改进度 + 反馈展示 |
| P2.10 | Web 出题工作台 | `apps/web/app/(main)/learn/question-gen/page.tsx` | 知识点选择 + 题目预览 + 入库 |
| P2.11 | i18n(5 语言) | `apps/web/messages/*.json` | aiGrading + aiQuestionGen 命名空间 |

### 3.4 跨端范围(§9 多端同步)

| 端 | 改动 | 验证 |
|---|---|---|
| api | SM-2 引擎 + SRS 复习 API + 3 张新表 | typecheck + test |
| web | 复习页 + AI 助教 + 批改页 + 出题工作台 + i18n | typecheck + e2e |
| ai-service | AI 助教 + AI 批改 + AI 出题 prompt 工程 | pytest |
| database | 3 张新表 + 2 处字段扩展 | migration + schema drift |

### 3.5 风险

- **R1**:SM-2 算法 quality 评分来源(学生自评 vs AI 评分),需 UX 设计
- **R2**:AI 批改 rubric 设计复杂,需按学科+题型建模板
- **R3**:AI 出题质量保障,需人工审核环节(ai_generated_question.humanReview 字段)

---

## 四、优先级建议

| 优先级 | 方案 | 理由 |
|---|---|---|
| P0-1 | AI 教育引擎 Phase 1 | 对标 Khan Academy 最直接差距,SM-2 是教育核心 |
| P0-2 | LangGraph Q1 | HITL + streaming 是 Agent 竞争力核心 |
| P1-1 | AI 教育引擎 Phase 2 | AI 批改 + 出题补齐教育闭环 |
| P1-2 | LangGraph Q2 | subgraph + Time Travel 是进阶能力 |

---

## 五、验收标准(立项后)

- 9 个 P0 缺陷全部消除(对照表)
- 跨 4 端 typecheck + build + test 全绿
- e2e 覆盖 HITL interrupt/resume + SRS 复习 + AI 批改 + AI 出题
- README.md 同步更新(§22)
- 性能基线:checkpoint 延迟 < 50ms / SM-2 计算 < 1ms / AI 批改 < 10s

---

**归档说明**:本调研文档不替代 PROJECT_PLAN.md 任务条目,立项后需提取 Q1/Q2/Phase1/Phase2 任务登记到 PROJECT_PLAN.md 对应优先级区。
