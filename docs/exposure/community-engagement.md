# Community Engagement Report

> 对外可见的社区运营报告。记录 IHUI-AI 在 GitHub、搜索引擎、技术社区的曝光与互动。
> 最后更新:2026-07-27

---

## 📅 2026-07-27 社区运营纪要

本次运营聚焦三条线:GitHub 社区互动(回应存量反馈 + 发起议题)→ 搜索引擎收录加速(IndexNow)→ 技术社区曝光准备(HackerNews Show HN 草稿)。

### 1. GitHub 社区互动

#### 已回复的 Issue

| Issue | 作者 | 内容 | 回复 |
|-------|------|------|------|
| [#9 加油](https://github.com/IHUI-INF-AI/IHUI-AI/issues/9) | @v18268185209 | 社区鼓励留言 | [comment-5090777874](https://github.com/IHUI-INF-AI/IHUI-AI/issues/9#issuecomment-5090777874) — 致谢 + 指向最新 release |

回复语气友好专业,避免模板化 spam 感,引导用户继续在 Discussion/Issue 互动。

#### 跳过回复的项(遵循约束)

- **#19 / #16 / #15** — `github-actions[bot]` 自动生成的 Star 感谢 Issue,非社区反馈,回复会显得 spammy。
- **#14 / #13 / #12 / #5 / #4 / #3 / #2 / #1** — 维护者(@IHUI-INF-AI)自己创建的议题,按"不回复自己创建的"约束跳过。
- **Discussion #21 / #20 / #18 / #17 / #11 / #10** — 全部由 @IHUI-INF-AI 创建,跳过。

#### 新创建的 Discussion

| # | 标题 | 分类 | 链接 |
|---|------|------|------|
| 23 | 🎙️ Roadmap feedback: What features do you want next? | Ideas | [discussions/23](https://github.com/IHUI-INF-AI/IHUI-AI/discussions/23) |

Discussion #23 列出 v0.2.0 已发布功能 + 7 个 P1 候选功能(多 agent 协作 / 可视化 workflow / MCP marketplace / 模型路由 / 企业部署 / 分析面板 / 语音模式),邀请社区用 👍 投票,计划 2026-08-10 汇总并发布 v0.3.0 路线图。

#### 新创建的 Issue

| # | 标题 | 标签 | 链接 |
|---|------|------|------|
| 22 | 🌟 Welcome new contributors! 5 good-first-issues ready | `good-first-issue` `help wanted` `community` | [issues/22](https://github.com/IHUI-INF-AI/IHUI-AI/issues/22) |

Issue #22 列出 5 个 good-first-issue 候选:文档改进 / 测试补全 / UI 优化 / i18n 翻译 / Demo 完善,每个标注难度与涉及目录,降低新人贡献门槛。

### 2. IndexNow 批量提交

新增脚本 [`scripts/indexnow-submit.mjs`](../../scripts/indexnow-submit.mjs),从 `apps/web/app/sitemap.ts` 自动解析全部公开路由(92 条),批量提交到 IndexNow API(Bing / Yandex / Naver 共用)。

- **覆盖 URL 数**:92(产品页 / 内容社区 / SEO 对比页 / 用例页 / 文档 / 法律页)
- **本次验证**:`node scripts/indexnow-submit.mjs --dry-run` 通过,exit 0,无副作用(示例密钥不写盘)
- **实际提交**:待密钥文件 `https://aizhs.top/{key}.txt` 部署到生产后,运行 `node scripts/indexnow-submit.mjs` 完成首次提交
- **用法**:
  ```bash
  node scripts/indexnow-submit.mjs --dry-run        # 预览
  node scripts/indexnow-submit.mjs                  # 实际提交(自动生成并放置密钥文件)
  node scripts/indexnow-submit.mjs --key <key>      # 自定义密钥
  ```

IndexNow 预期在提交后 24 小时内加速 Bing / Yandex / Naver 对新页面的抓取。

### 3. HackerNews "Show HN" 草稿

- **草稿位置**:`.trae-cn/tmp/show-hn-post.md`(内部草稿,待人工 review 后提交)
- **标题**:`Show HN: IHUI-AI — Open-source 8-platform AI OS with 176 LLMs (LangGraph + MCP + A2A)`
- **正文**:~290 字英文,涵盖痛点(多端重复造轮子)→ 创新(8 端 + 176 LLM + 三协议栈)→ 技术栈(Next.js 15 / Fastify 5 / FastAPI / Tauri / WXT)→ 差异化(vs LangChain / Dify / OpenWebUI)→ 结尾抛具体问题引导技术讨论
- **遵循 HN 规范**:标题以 `Show HN:` 开头、无营销话术、主动暴露 trade-off、首小时互动计划

### 4. 下一步社区运营计划

| 优先级 | 动作 | 截止 |
|--------|------|------|
| P0 | 部署 IndexNow 密钥文件到生产 + 执行首次实际提交 | 2026-07-28 |
| P0 | 人工 review Show HN 草稿 + 选择 PST 流量低谷对应北京时间窗口提交 | 2026-07-28 |
| P1 | 监控 Discussion #23 投票,首条社区回复后 24h 内跟进 | 2026-07-30 |
| P1 | Issue #22 收到首个 "I'd like to work on" 评论后,细化任务并派给贡献者 | 2026-07-30 |
| P2 | 提交到 Awesome-XXX 列表(已在 v1.1.0 规划,跟进 PR 状态) | 2026-08-03 |
| P2 | 2026-08-10 汇总 Discussion #23 投票,发布 v0.3.0 路线图 | 2026-08-10 |

---

## 指标快照(2026-07-27)

| 指标 | 数值 |
|------|------|
| GitHub Issues(全部状态) | 16(#22 新增后) |
| GitHub Discussions | 7(#23 新增后) |
| 本轮回复 Issue | 1 |
| 本轮新建 Discussion | 1 |
| 本轮新建 Issue | 1 |
| IndexNow 待提交 URL | 92 |
| Show HN 草稿 | 1(待提交) |

---

## 📅 2026-08-01 社区运营纪要(自动化批次)

本批次由 GitHub API 自动化完成,聚焦社区活跃度提升:验证仓库元数据 → 新建高质量 Discussion 引发技术讨论 → 新建 good-first-issue / help wanted Issue 吸引贡献者 → 复核 9 个 awesome PR 状态。

### 1. 仓库元数据验证(API 自动化)

| 字段 | 数值 | 状态 |
|------|------|------|
| topics | 20 个(ai-platform/fastify/langgraph/mcp/nextjs/open-source/rag/self-hosted/agent-marketplace/ai-agent/chatgpt-alternative/fastapi/litellm/llm-gateway/monorepo/multi-tenant/react-native/taro/tauri/wxt) | ✅ 已达上限 |
| description | 222 字符(≤350) | ✅ 合规 |
| homepage | https://ihui.ai | ✅ 已设置 |
| has_discussions | true | ✅ 已开启 |
| stars / forks | 14 / 4 | — |

### 2. 新创建的 Discussion(3 条)

| # | 标题 | 分类 | 链接 |
|---|------|------|------|
| 26 | 8 端 monorepo 共享层设计:我们如何把 70.3% 代码复用率做到位 | Show and tell | [discussions/26](https://github.com/IHUI-INF-AI/IHUI-AI/discussions/26) |
| 27 | v1.3 Roadmap 征集:你最想看到的 8 端 AI 平台新功能? | Ideas | [discussions/27](https://github.com/IHUI-INF-AI/IHUI-AI/discussions/27) |
| 28 | 踩坑分享:Tauri 2 + React 19 桌面端集成遇到的问题与解决方案 | Show and tell | [discussions/28](https://github.com/IHUI-INF-AI/IHUI-AI/discussions/28) |

- **#26** 拆解共享层设计(工厂模式 + 依赖注入 / 端内 re-export / 类型单一来源 / 守门机制),展示 70.3% 复用率实现路径,吸引架构向技术讨论。
- **#27** 列出 v1.3 候选方向(AI OS 体验 / 模型与协议 / 企业能力 / 开发者体验),邀请社区用表情投票 + 评论展开,延续 #23 路线图征集思路。
- **#28** 整理 Tauri 2 + React 19 集成 5 个踩坑(IPC 类型 / 中文字体对齐 / 圆角溢出 / Next.js 组件复用 / 端口冲突)及解决方案,针对桌面端开发者群体。

### 3. 新创建的 Issue(3 条)

| # | 标题 | 标签 | 链接 |
|---|------|------|------|
| 29 | good-first-issue: 为 CLI 端添加 --version 和 --help 输出测试 | `good-first-issue` `documentation` | [issues/29](https://github.com/IHUI-INF-AI/IHUI-AI/issues/29) |
| 30 | good-first-issue: 文档改进 - 补充 8 端架构图的中文注释 | `good-first-issue` `documentation` `community` | [issues/30](https://github.com/IHUI-INF-AI/IHUI-AI/issues/30) |
| 31 | help wanted: 寻求 v2.0 AI 操作系统愿景的社区反馈 | `help wanted` `community` | [issues/31](https://github.com/IHUI-INF-AI/IHUI-AI/issues/31) |

- **#29 / #30** 为 good-first-issue,降低新人贡献门槛,附验收标准 + 入门指引,适合首次贡献者认领。
- **#31** 为 help wanted 讨论性 Issue,收集 v2.0 AI OS 愿景反馈(Agent 进程模型 / AI 文件系统 / 全局调度器 / Plugin 机制),为 RFC 蓄力。

### 4. Awesome PR 状态复核(9 个)

| 仓库 | PR | 状态 | 评论数 | 最近更新 |
|------|-----|------|--------|----------|
| punkpeye/awesome-mcp-servers | [#11005](https://github.com/punkpeye/awesome-mcp-servers/pull/11005) | 🟢 open | 3(有维护者互动) | 2026-08-01 |
| Hannibal046/Awesome-LLM | [#759](https://github.com/Hannibal046/Awesome-LLM/pull/759) | 🟢 open | 0 | 2026-07-27 |
| mahmoud/awesome-python-applications | [#235](https://github.com/mahmoud/awesome-python-applications/pull/235) | 🟢 open | 0 | 2026-07-27 |
| steven2358/awesome-generative-ai | [#1128](https://github.com/steven2358/awesome-generative-ai/pull/1128) | 🟢 open | 0 | 2026-07-27 |
| punkpeye/awesome-mcp-clients | [#258](https://github.com/punkpeye/awesome-mcp-clients/pull/258) | 🟢 open | 0 | 2026-07-27 |
| svcvit/Awesome-Dify-Workflow | [#54](https://github.com/svcvit/Awesome-Dify-Workflow/pull/54) | 🟢 open | 0 | 2026-07-27 |
| awesome-rag/awesome-rag | [#10](https://github.com/awesome-rag/awesome-rag/pull/10) | 🟢 open | 0 | 2026-07-27 |
| jondot/awesome-react-native | [#1227](https://github.com/jondot/awesome-react-native/pull/1227) | 🟢 open | 0 | 2026-08-01 |
| tauri-apps/awesome-tauri | [#831](https://github.com/tauri-apps/awesome-tauri/pull/831) | 🟢 open | 0 | 2026-08-01 |

9 个 PR 全部 open,无合并/关闭。awesome-mcp-servers #11005 有 3 条维护者互动(最活跃),react-native #1227 与 tauri #831 今日有更新。

### 5. Releases 验证

共 7 个 release,最新为 v1.2.0(2026-07-28 发布),release notes 6774 字符,内容完整。本批次无新 tag,不创建新 release。

### 6. 指标快照(2026-08-01)

| 指标 | 数值 |
|------|------|
| GitHub Issues(open) | 14 → 17(+3) |
| GitHub Discussions | 25 → 28(+3) |
| 本轮新建 Discussion | 3 |
| 本轮新建 Issue | 3 |
| Awesome PR(全部 open) | 9 |
| Releases | 7(最新 v1.2.0) |
