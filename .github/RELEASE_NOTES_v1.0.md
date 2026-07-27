# v1.0.0 — 全栈 AI 操作系统正式发布

> 🚀 一个仓库,干翻 40+ 商业产品 — 开源 AI 商业级一体化超级平台

**发布日期**:2026-07-26
**License**:Apache-2.0(商业可用)
**在线 Demo**:https://ihui.ai
**GitHub**:https://github.com/IHUI-INF-AI/IHUI-AI

---

## 一句话介绍

IHUI-AI 是一个 Apache 2.0 开源的全栈 AI 操作系统,把 AI 编程 / AI 应用平台 / Agent 框架 / SaaS 商业栈 / AI 教育 / 多端框架 6 大类商业产品的能力整合进一个仓库。8 端同源,176 模型,LangGraph + MCP + A2A 三栈,340 张表,1300+ API,5346 测试,63 e2e spec — 不是 PPT,不是 demo,是真正可生产、可商用、可自托管的 AI 超级平台。

---

## 核心数据(每一个都能在代码里 grep 到)

| 维度         | 数据                                              | 验证方式                                    |
| ------------ | ------------------------------------------------- | ------------------------------------------- |
| 仓库规模     | 8 端 + 12 共享包                                  | `apps/` + `packages/`                       |
| 数据库       | 340 表 · 144 迁移 · 100 schema 文件 · 30+ 业务域  | `packages/database/src/schema/`             |
| API 端点     | 1300+                                             | `apps/api/src/routes/`                      |
| 测试覆盖     | 5346 API 测试 · 63 e2e spec · 32+ pre-commit 守门 | `apps/api/tests/` + `apps/web/e2e/`         |
| 大模型       | 176 模型统一调度                                  | `apps/ai-service/`                          |
| Agent 框架   | LangGraph + MCP + A2A 三栈                        | `apps/ai-service/`                          |
| i18n         | 5 语言 100% parity(zh-CN / zh-TW / en / ko / ja)  | `apps/web/messages/`                        |
| 端覆盖       | 8 端独立代码 + 12 共享包                          | `apps/`                                     |
| 平台自动发布 | 14 平台                                           | `.github/workflows/`                        |
| 工程治理     | 32+ pre-commit 守门脚本                           | `.husky/pre-commit` + `scripts/check-*.mjs` |

---

## 8 端全覆盖清单

| 端             | 技术栈                                         | 路径                |
| -------------- | ---------------------------------------------- | ------------------- |
| **API**        | Fastify 5 + Drizzle ORM 0.38 + PostgreSQL      | `apps/api`          |
| **Web**        | Next.js 15 + React 19 + Tailwind 4 + shadcn/ui | `apps/web`          |
| **AI Service** | FastAPI + LangGraph + LiteLLM + MCP            | `apps/ai-service`   |
| **Miniapp**    | Taro 4 + React                                 | `apps/miniapp-taro` |
| **Desktop**    | Tauri                                          | `apps/desktop`      |
| **Extension**  | WXT(浏览器扩展)                                | `apps/extension`    |
| **Mobile**     | React Native + Expo + Solito                   | `apps/mobile-rn`    |
| **CLI**        | Node.js + Commander                            | `apps/cli`          |

**12 共享包**:`packages/database` / `packages/auth` / `packages/types` / `packages/ui` / `packages/config` / `packages/eslint-config` / `packages/tsconfig` / `packages/app` / `packages/api-client` / `packages/i18n` / `packages/ai-sdk` / `packages/design-tokens`

---

## 6 大类能力对标(功能覆盖度对标,非精度对标)

### 1. AI 编程 CLI

Claude Code · OpenAI Codex · Gemini CLI · Trae SOLO · Cursor · Windsurf · GitHub Copilot · Amazon Q · Cline · Aider · Cody · Tabnine · Continue · Zed AI · JetBrains AI

### 2. AI 应用平台

Dify · FastGPT · Langflow · RAGFlow · Coze(扣子)· OpenAI ChatGPT · Anthropic Claude · Google Gemini · Microsoft Copilot · 字节豆包 · 百度文心 · 阿里通义 · 腾讯混元 · DeepSeek · 月之暗面 Kimi · 智谱清言

### 3. Agent 框架

LangChain · LangGraph · LlamaIndex · AutoGen · CrewAI · AutoGPT · MetaGPT · OpenAI Agents SDK · Microsoft Copilot Studio · AWS Bedrock Agents

### 4. 商业 SaaS

Stripe · PayPal · Auth0 · Clerk · Supabase · Mailgun · SendGrid · Mixpanel · Amplitude · PostHog

### 5. AI 教育

Khan Academy · Coursera · Udemy · Duolingo

### 6. 多端框架

Tauri · Electron · Expo · React Native · Taro · WXT · Next.js · Remix · Nuxt · SvelteKit

---

## 核心差异化

- **Dify / FastGPT / Langflow** 只做 AI 应用编排 → **IHUI-AI** 多了 8 端 + CLI + 商业闭环 + AI 教育 + 14 平台发布
- **Claude Code / Cursor / Copilot** 只做 AI 编程 → **IHUI-AI** 多了完整 SaaS 商业栈 + 多端 + 教育全栈
- **Stripe / Auth0 / Clerk** 只做单一 SaaS 能力 → **IHUI-AI** 把支付+认证+邮件+分析+AI 全预置
- **LangChain / AutoGen / CrewAI** 只是开发框架 → **IHUI-AI** 是"整车下线",非技术团队也能用
- **Tauri / Expo / Taro / WXT** 只做多端框架 → **IHUI-AI** 8 端独立代码 + 12 共享包预置好
- **Khan Academy / Coursera** 是闭源 SaaS → **IHUI-AI** AI 教育全栈 Apache 2.0 开源

> 在全球开源 AI 生态里,你找得到比 IHUI-AI 更专的项目,但找不到比 IHUI-AI 更全的开源平台。

---

## 5 分钟快速开始

```bash
# 1. Clone(国内用户用 Gitee/GitCode 镜像更快)
git clone https://github.com/IHUI-INF-AI/IHUI-AI.git
cd IHUI-AI

# 2. 安装依赖
pnpm install

# 3. 配置环境变量
cp .env.example .env
# 编辑 .env 填入数据库 / Redis / AI API key

# 4. 启动数据库 + Redis(可选,docker-compose)
docker compose up -d postgres redis

# 5. 启动全栈(web + api + ai-service)
pnpm dev
# web: http://localhost:3000
# api: http://localhost:8802
# ai-service: http://localhost:8000
```

国内镜像:

- Gitee:https://gitee.com/JLSLSSZWHYXGS_0/IHUI-AI
- GitCode:https://gitcode.com/IHUI-AI/IHUI-AI

---

## 完整功能矩阵

详见 [README.md](https://github.com/IHUI-INF-AI/IHUI-AI#readme) 的 "功能特性" 章节。核心模块:

- **AI Agent**:Agent 市场 / Agent 看板 / Agent Runtime / Agent Workbench
- **AI 编排**:工作流(Workflows)· MCP 项目 · A2A 协议 · AI 技能 · AI 生成
- **AI 知识**:知识库(Knowledge Base)· RAG · 知识图谱
- **AI 模型**:176 模型统一调度 · 多模型路由 · 模型对比
- **AI 内容**:文章 / 资讯 / AI 新闻 / AI 世界 / 广场 / 问答 / 圈子
- **AI 教育**:课程 / 学习路径 / 作业 / 评测
- **商业 SaaS**:支付(Stripe + 微信)/ 认证(Auth0 风格)/ 邮件 / 分析 / 钱包 / 订单
- **多端发布**:14 平台自动发布(desktop/extension/mobile/miniapp)
- **企业级**:权限 / 审计 / 多租户 / SSO / 安全审计

---

## 工程治理(32+ pre-commit 守门)

- **i18n 治理**:5 语言 100% parity + 10 守门脚本 + AI 翻译流水线(零 LLM API 调用)
- **代码质量**:API key 泄露 / schema drift / 陈旧 dist / UTF-8 完整性 / sanitizer / dedupe
- **UI/样式**:圆角守门 / CSS token / Tailwind 冲突 / z-index / 端口注册表
- **工程约束**:交付报告一致性 / PLAN 体积 / 迁移完整性 / 多端同步 / README 同步
- **Push/工作区**:项目外路径 / 父目录污染 / Push 同步 / 防提交丢失
- **CI/CD**:CI / Build / E2E / Knip / Lighthouse / 周安全审计 / 迁移测试 / 视觉回归

---

## 文档导航

- [README(简体中文)](https://github.com/IHUI-INF-AI/IHUI-AI#readme)
- [README(English)](https://github.com/IHUI-INF-AI/IHUI-AI/blob/main/README.en.md)
- [README(日本語)](https://github.com/IHUI-INF-AI/IHUI-AI/blob/main/README.ja.md)
- [README(한국어)](https://github.com/IHUI-INF-AI/IHUI-AI/blob/main/README.ko.md)
- [系统架构](https://github.com/IHUI-INF-AI/IHUI-AI/blob/main/docs/architecture.md)
- [端口管理](https://github.com/IHUI-INF-AI/IHUI-AI/blob/main/docs/port-management.md)
- [SEO/GEO 站长平台提交清单](https://github.com/IHUI-INF-AI/IHUI-AI/blob/main/docs/seo-submit-guide.md)
- [在线 Demo](https://ihui.ai)

---

## AI 引擎 GEO 入口

IHUI-AI 为 11+ 主流 AI 引擎提供专属 GEO 入口(https://ihui.ai/<engine>.txt 或 .md):

| 引擎              | 入口                          | 格式                |
| ----------------- | ----------------------------- | ------------------- |
| ChatGPT / GPTBot  | https://ihui.ai/gpt.txt       | Q&A 问答对          |
| Claude            | https://ihui.ai/claude.md     | 长篇叙述            |
| Perplexity        | https://ihui.ai/perplexity.md | 引用就绪事实卡片    |
| Google Gemini     | https://ihui.ai/gemini.txt    | 实体中心知识库      |
| Microsoft Copilot | https://ihui.ai/copilot.txt   | 英文 Bing 索引      |
| 字节豆包          | https://ihui.ai/doubao.txt    | 对话场景 Q&A        |
| Kimi              | https://ihui.ai/kimi.txt      | 长文本+学术风       |
| DeepSeek          | https://ihui.ai/deepseek.txt  | 技术细节+开源友好   |
| 通义 Qwen         | https://ihui.ai/qwen.txt      | 阿里云生态集成      |
| 文心 ERNIE        | https://ihui.ai/wenxin.txt    | 百度 SEO + 百科化   |
| 智谱 GLM          | https://ihui.ai/zhipu.txt     | 学术机构 + 政企信创 |
| 腾讯混元          | https://ihui.ai/hunyuan.txt   | 微信生态 + 腾讯云   |

通用 LLM 索引:[llms.txt](https://ihui.ai/llms.txt) · [llms-full.txt](https://ihui.ai/llms-full.txt)

---

## 联系我们

- **公司**:吉林省爱智汇人工智能科技有限公司 · 智汇 AI 集团
- **地址**:吉林省长春市高新区越达路 107 号 · 人工智能人才孵化基地
- **邮箱**:502319984@qq.com
- **微信客服**:`ok502319984`
- **电话**:`18643389808`
- **官网**:https://ihui.ai

合作咨询 · 企业接入 · 技术交流 · 投资对接 — 24 小时内回复。

---

## License

Apache License 2.0 — 商业可用,可修改,可分发,可闭源衍生。

---

**如果 IHUI-AI 帮到了你,欢迎 Star ⭐ 支持。你的 Star 是我们持续迭代的最大动力。**

https://github.com/IHUI-INF-AI/IHUI-AI
