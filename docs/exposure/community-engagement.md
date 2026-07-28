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
