<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# 为什么选择 IHUI-AI · 与同类项目对比 · 谁在使用 · 5 个典型场景 · 联系方式

> 本文件是从根 `README.md` 拆出的**原文收纳件**(2026-09-30,台账票 G-814434「README 重写收编重做」)。
> 来源:重写前工作树 `README.md`(6,476 行)以下所注行号区间,逐字搬入,未改写任何一句;整理仅限本文头尾的标题与来源注记。
> 索引层与九份主题文档的总入口见根 [`README.md`](../../README.md)。

---

## 为什么选择 IHUI-AI

| 维度                 | 能力                                                                                                                                                                                                                                                                                                                                                                                                                            | 行业定位                                                        |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| **端覆盖**           | Web / API / AI 服务 / CLI / 桌面 / 扩展 / 移动 RN / 小程序 Taro                                                                                                                                                                                                                                                                                                                                                                 | 行业首个 8 端全覆盖 AI 全栈平台                                 |
| **模型接入**         | LiteLLM 网关统一 176 模型(国际 30+ / 国产 15+ / 云厂商 10+)                                                                                                                                                                                                                                                                                                                                                                     | 一站式接入,智能路由 + 60% 缓存                                  |
| **AI 编排三栈**      | LangGraph(工作流)+ MCP(工具协议)+ A2A(Agent 互通)                                                                                                                                                                                                                                                                                                                                                                               | 工作流、工具、智能体协同一体化                                  |
| **自研 CLI**         | 50 命令 + 36 工具 + ACP Server,对标 Claude Code                                                                                                                                                                                                                                                                                                                                                                                 | 命令行原生 AI 编程体验                                          |
| **CLI 配置无缝导入** | 24 源一键导入(cc-switch / codex++ / Claude / Codex / Gemini / Hermes / Cursor / Windsurf / Cline / Aider / .env / Qoder / Codex Desktop / Claude Code Desktop / GitHub Copilot / Amazon Q / Continue / Tabnine / Cody / Zed / Google Antigravity)+ providerCode/apiFormat 智能推断(modelId 前缀优先,URL 兜底)                                                                                                                   | 跨 CLI 工具配置零迁移成本                                       |
| **会话历史无缝导入** | Claude Code(JSONL + ai-title 标题 + 工具调用骨架)+ Codex CLI(rollout JSONL,权威源优先)+ Cursor(composer JSON / state.vscdb SQLite)+ Aider(chat history Markdown / record JSON)四源导出文件解析后保留原始时间戳,落库即出现在聊天侧栏;入库边界自动密钥脱敏 + 体积收口。两个落点:web `/settings/import` 上传,或 CLI `ihui import sessions discover / parse / commit / history`(可扫本机 `~/.claude/projects`、`~/.codex/sessions`) | 换工具不丢历史,迁入即用                                         |
| **企业级安全**       | RBAC + 工作空间 3 模式权限 + 7 端点运行时拦截 + 60s 审计超时 + 1h 高风险自动撤销 + 首启确认弹窗 + 键盘导航 + 5s 切换撤销                                                                                                                                                                                                                                                                                                        | 决策者级风险控制 + Codex CLI safety guard                       |
| **数据加密**         | AES-256-GCM(credentials 加密)+ JWT token-family 旋转 + refresh 黑名单                                                                                                                                                                                                                                                                                                                                                           | 金融级数据保护                                                  |
| **可观测性**         | Prometheus + Grafana(**3 仪表盘**)+ Loki + Promtail + Jaeger + OpenTelemetry + Alertmanager                                                                                                                                                                                                                                                                                                                                     | 全链路指标 / 日志 / 追踪 / 告警                                 |
| **工程守门**         | 56+10 pre-commit + post-commit 自动 push + git-push-guard + drizzle-kit push 模式                                                                                                                                                                                                                                                                                                                                               | 杜绝协作事故,99.9% SLA                                          |
| **国际化**           | zh-CN / zh-TW / en / ko / ja 5 语言 parity + 21 i18n 工具链 + AI 翻译流水线(零 LLM API)                                                                                                                                                                                                                                                                                                                                         | 5 语言键集合 100% parity(AI agent 自主翻译补齐,开发成本降 70%+) |
| **数据库**           | **542 表 + drizzle-kit push** + 205 schema 文件 + Drizzle ORM + RLS + 租户路由 + pgvector                                                                                                                                                                                                                                                                                                                                       | 单库 PostgreSQL 15,schema 隔离                                  |
| **API 规模**         | 4393 路由(api 4393 + ai-service 55)+ 12 WebSocket + 288 路由文件                                                                                                                                                                                                                                                                                                                                                                | 远超源项目 331 端点                                             |
| **业务覆盖**         | 15 大模块 / 50+ 子功能 / **250+ Web 页面**                                                                                                                                                                                                                                                                                                                                                                                      | 一个平台覆盖所有 AI 应用场景                                    |
| **共享包**           | 16 packages(auth/database/types/ui/sdk/api-client/context-compaction/dom-actions/browser-platform/i18n 等)                                                                                                                                                                                                                                                                                                                      | 跨端类型安全 + 复用                                             |
| **微服务工程模式**   | Outbox 事务发件箱 + Refund DLQ 死信队列 + Circuit Breaker 断路器 + IDOR 防护 + WS Dedup + Hot Config                                                                                                                                                                                                                                                                                                                            | 生产级微服务模式                                                |
| **性能保障**         | Knip 未使用代码 + Lighthouse CI + Locust 压测                                                                                                                                                                                                                                                                                                                                                                                   | 性能预算 + 容量预估                                             |
| **部署成熟度**       | Docker Compose(14 服务)+ 蓝绿 + Nginx upstream + 证书续期 cron                                                                                                                                                                                                                                                                                                                                                                  | 生产级运维                                                      |

---

## 与同类项目对比

### 对标矩阵 · 12 列横向对比(覆盖国际/国内 40+ 大牌产品)

> 因表格列数较多,建议在桌面端横向滚动查看。移动端可只看"IHUI-AI"列和"关键结论"小节。

| 维度               | IHUI-AI                                                          | OpenAI ChatGPT | Dify        | LangChain        | RAGFlow    | Coze(扣子)     | Claude Code | Cursor      | GitHub Copilot | Khan Academy   | Stripe+Auth0  |
| ------------------ | ---------------------------------------------------------------- | -------------- | ----------- | ---------------- | ---------- | -------------- | ----------- | ----------- | -------------- | -------------- | ------------- |
| **对标类别**       | 6 大类整合(应用+CLI+多端+商业+教育+内容)                         | 通用 AI 对话   | AI 应用开发 | AI Agent 框架    | RAG 知识库 | AI 智能体 SaaS | AI 编程 CLI | AI 编程 IDE | AI 编程助手    | AI 教育平台    | 支付+认证基座 |
| **License**        | **Apache 2.0**                                                   | **闭源**       | Apache 2.0  | MIT              | Apache 2.0 | **闭源**       | **闭源**    | **闭源**    | **闭源**       | **闭源**(免费) | **闭源 SaaS** |
| **自托管**         | **完全自托管**                                                   | 不支持         | Docker      | 库               | Docker     | 不支持         | N/A         | N/A         | N/A            | 不支持         | N/A           |
| **端覆盖**         | **8 端**                                                         | 2 端(Web/APP)  | 2 端        | 0 端(库)         | 2 端       | 2 端           | 1 端(CLI)   | 1 端(IDE)   | 1 端(IDE)      | 2 端           | 0 端(库)      |
| **模型接入**       | **176 模型** + LiteLLM                                           | OpenAI 系      | 50+ 模型    | LangChain 适配器 | 30+ 模型   | 字节系         | Anthropic   | 多模型      | OpenAI         | 无             | N/A           |
| **工作流引擎**     | **LangGraph + MCP + A2A 三栈**                                   | 无             | 自研工作流  | LangGraph        | 无         | 自研工作流     | 无          | 无          | 无             | 无             | N/A           |
| **自研 CLI**       | **50 命令 + 36 工具 + ACP Server**                               | 无             | 无          | 无               | 无         | 无             | 原生 CLI    | 无          | 无             | 无             | N/A           |
| **多租户 + RBAC**  | **完整**(5 级 + RLS)                                             | 单用户         | 基础        | 无               | 基础       | SaaS 内        | 无          | 无          | 无             | 学校账号       | 基础          |
| **计费订阅**       | **完整**(VIP/钱包/积分/退款/10 支付网关(含海外 Stripe + PayPal)) | 订阅($20-200)  | 无          | 无               | 无         | SaaS 内        | 无          | 订阅($20)   | 订阅($10-39)   | 免费           | 核心(支付)    |
| **AI 教育**        | **全栈**(课程/题库/考试/直播流媒体(SRS)/45 表)                   | 无             | 无          | 无               | 无         | 无             | 无          | 无          | 无             | 核心(教育)     | 无            |
| **内容发布**       | **38 平台 + 38 adapter**                                         | 无             | 无          | 无               | 无         | 无             | 无          | 无          | 无             | 无             | 无            |
| **可观测性**       | **三支柱 + 3 仪表盘**                                            | -              | 基础        | 无               | 基础       | -              | 无          | 无          | 无             | -              | -             |
| **工程守门**       | **88 守门脚本 + drizzle-kit push 模式 + 自动 push**              | -              | 基础        | 基础             | 基础       | -              | 无          | 无          | 无             | -              | -             |
| **i18n**           | **5 语言 parity + 8 守门(4+4)**                                  | 多语言         | 中英文      | 英文             | 中英文     | 多语言         | 英文        | 多语言      | 多语言         | 多语言         | N/A           |
| **数据库**         | **542 表 + drizzle-kit push + RLS + pgvector**                   | SaaS 内        | 基础        | 无               | pgvector   | SaaS 内        | 无          | 无          | 无             | SaaS 内        | SaaS 内       |
| **共享包**         | **16 packages**                                                  | 无             | 无          | 1 库             | 无         | -              | 无          | 无          | 无             | 无             | 1 SDK         |
| **月度成本(5 人)** | **$0**(自托管,仅服务器)                                          | $125+          | $59+        | $0(自集成)       | $0(自集成) | SaaS 内        | $100        | $100        | $95            | 免费(教育)     | $149+         |

### 关键结论

**IHUI-AI 不是要替代谁,而是把"搭建一个完整 AI 应用"所需的 6 大类基础设施都开源出来。**

- 比 **OpenAI ChatGPT**:IHUI-AI 完全自托管,数据 100% 主权,带计费/教育/发布等完整业务,ChatGPT 是闭源 SaaS
- 比 **Dify / FastGPT / Langflow / RAGFlow**:IHUI-AI 多了 6 端、自研 CLI、完整商业闭环、AI 教育全栈、38 平台发布、企业级安全栈、SRE 可观测性
- 比 **LangChain / LlamaIndex / AutoGen**:那些是开发框架("造车零件"),IHUI-AI 是产品化基座("整车下线"),非技术团队也能用
- 比 **Claude Code / Cursor / GitHub Copilot / Windsurf / Amazon Q**:IHUI-AI 的 CLI 不仅做编程,还整合了 AI 应用平台能力(对话/RAG/Agent/计费),且整个仓库 Apache 2.0 开源,其他都是闭源
- 比 **Coze(扣子)**:IHUI-AI 完全自托管,数据主权 100%,License 商用友好,而 Coze 是闭源 SaaS,数据上交字节
- 比 **Khan Academy / Coursera**:IHUI-AI 的 AI 教育是开源全栈(课程/题库/考试/直播流媒体(SRS)/证书),可二次定制,那两个是闭源 SaaS
- 比 **Stripe + Auth0 + Mailgun + Mixpanel**:IHUI-AI 把支付/认证/邮件/分析全部预置,一站式集成 4-6 类 SaaS 能力,月省 $300+

**核心差异化**:在全球开源 AI 生态里,你能找到比 IHUI-AI **更专**的项目(如 RAGFlow 在 RAG 维度更深、Claude Code 在 CLI 维度更成熟、LangChain 在框架层更灵活、Khan Academy 在教育内容更丰富),但找不到比 IHUI-AI **更全**的开源基座。

**一句话总结**:IHUI-AI 是 OpenAI ChatGPT(对话)+ Dify(应用编排)+ Claude Code(CLI)+ Khan Academy(教育)+ Stripe(支付)+ 蚁客(发布)的**开源一体化集成方案**。

---

## 谁在使用 IHUI-AI

本项目由**吉林省爱智汇人工智能科技有限公司**发起并主导开发,用于支撑公司商业化 AI 平台。我们欢迎更多企业、团队、个人提交使用案例(请编辑此章节提 PR):

| 角色       | 场景                                        | 状态     |
| ---------- | ------------------------------------------- | -------- |
| 爱智汇 AI  | 公司主商业化平台(智汇 AI 集团)              | 生产使用 |
| AI 服务商  | 多模型代理 + 计费 + 订阅一站式上线          | 适配中   |
| 教育机构   | AI 教育全栈(课程 / 题库 / 考试 / 直播(SRS)) | 适配中   |
| 内容创作者 | 38 平台一键发布                             | 适配中   |
| 个人开发者 | 私有 AI 助手 + 知识库                       | 等你来填 |

> 你的公司或项目正在用 IHUI-AI 吗?欢迎提交 PR 加入此列表。

---

## 5 个典型场景

### 场景 1:个人开发者搭建私有 AI 助手

```bash
git clone https://github.com/IHUI-INF-AI/IHUI-AI.git
cd IHUI-AI && docker compose up -d
# 5 分钟后,你拥有(替代 ChatGPT Team + Claude Code + Notion AI 3 个订阅,月省 $60+):
# - 一个支持 176 模型的对话界面(替代 ChatGPT Team $25/人)
# - 私有知识库 RAG + pgvector 向量库(替代 ChatGPT Plus 知识库)
# - 跨端同步(Web + 桌面 + 移动 + 小程序)
# - 自研 CLI 编程助手(替代 Claude Code $20/月)
# - 数据完全自托管,不被任何大厂窥探
```

### 场景 2:中小企业构建 AI 中台

- 用 RBAC 给 200 个员工开账号,按部门隔离工作空间
- 接入 7 个 LLM 厂商,智能路由选最便宜的模型
- 用计费系统按部门收费,生成发票
- 用 BI 仪表盘看哪些部门用得最多
- 用审计日志满足合规要求

### 场景 3:AI 服务商上线商业产品

- 复用多模型代理 + 计费 + 订阅 + VIP + 钱包 + 积分
- 用智能体市场让开发者入驻,抽取 30% 佣金
- 用 API Keys + SDK 让客户接入你的平台
- 用 38 平台发布做内容营销
- 一周上线,而不是一年

### 场景 4:教育机构改造教学

- 用 AI 教育全栈导入课程 + 题库
- 学生用直播(SRS)回放复习
- 老师用 AI 批改试卷 + 生成学习报告
- 直播 + 签到 + 互动 + 回放
- 学习行为分析 + 个性化建议
- 证书自动发放

### 场景 5:内容创作者解放生产力

- 在自媒体工作台写公众号文章 + 口播稿
- 一键发布到 38 平台(公众号 / 知乎 / CSDN / 掘金 / 小红书 / B 站 / YouTube / 抖音 / 百度知道 / 贴吧 / 豆瓣 / 头条号 / 一点资讯 / 美拍 等)
- 凭证 AES-256-GCM 加密存储,平台不泄露
- 发布完成 WebSocket 实时通知

---

## 💬 联系我们(看完了?聊两句?)

> 如果你看完上面 5 个场景觉得"这玩意儿有点意思" —— 别停在 README 里,直接来找作者。
> 一个人做的项目,你扫码加好友,和你聊的就是写代码的那个人,不是客服,不是运营,不是 Bot。

<p align="center">
  <strong>微信号 <code>ok502319984</code></strong> · <strong>公众号「智汇AI」</strong> · <strong>企微社群扫码进群</strong>
</p>

<details>
<summary>📍 扫码联系(点击展开三个二维码)</summary>

<table align="center">
  <tr>
    <td align="center" width="33%">
      <img src="apps/web/public/footer/erweima/wechat-vx.png" width="160" alt="作者微信二维码" /><br/>
      <sub><strong>👤 作者微信</strong></sub><br/>
      <sub>扫码或搜索 <code>ok502319984</code></sub>
    </td>
    <td align="center" width="33%">
      <img src="apps/web/public/footer/erweima/footer-icon-2.png" width="160" alt="公众号二维码" /><br/>
      <sub><strong>📢 官方公众号</strong></sub><br/>
      <sub>关注「智汇AI」</sub>
    </td>
    <td align="center" width="33%">
      <img src="apps/web/public/footer/erweima/community-group.jpg" width="160" alt="企微社群二维码" /><br/>
      <sub><strong>💬 企微社群</strong></sub><br/>
      <sub>扫码进群,和开发者直接聊</sub>
    </td>
  </tr>
</table>

</details>

> 想看完整的「加入我们」说明?跳到 [文末加入我们章节](#-加入我们join-us)。

---

<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
