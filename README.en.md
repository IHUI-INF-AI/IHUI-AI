<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

> ⚠️ **Copyright & Commercial Licensing Notice**
>
> © 2026 **IHUI AI (智汇AI)** · Copyright owner: **Li Chunchuan (李春川)** · https://aizhs.top
>
> - Dual licensing: open-source use under **Apache-2.0** (copyright notice and NOTICE must be retained); **closed-source commercial use, rebranding, or SaaS resale** requires a separate commercial license.
> - All source files in this repository are embedded with provenance watermarks (visible banners + invisible zero-width steganography; verify with `node scripts/watermark.mjs decode <file>`). Removing watermarks does not change copyright ownership; unauthorized commercial use is technically traceable and legally actionable.
> - CI enforces watermark verification (`pnpm watermark:check`); any change that strips watermarks fails the build.

# IHUI-AI

<p align="center">
  <img src="apps/web/public/images/logo.png" width="140" alt="IHUI-AI Logo" />
</p>

<p align="center">
  <strong>Online Demo</strong> · <a href="https://aizhs.top">https://aizhs.top</a> &nbsp;|&nbsp; <strong>GitHub</strong> · <a href="https://github.com/IHUI-INF-AI/IHUI-AI">Star this repo</a><br/>
  <sub><strong>Self-hosted full-stack AI platform</strong>: model gateway + Agent orchestration + multi-tenant business backend + 8 frontend ends · Apache 2.0 · Fork to production in 5 minutes</sub>
</p>

<p align="center">
  <sub>
    <a href="README.md">简体中文</a> · <a href="README.en.md">English</a> · <a href="README.ko.md">한국어</a> · <a href="README.ja.md">日本語</a>
    &nbsp;&nbsp;|&nbsp;&nbsp;
    <strong>Mirrors</strong> · <a href="https://gitee.com/JLSLSSZWHYXGS_0/IHUI-AI">Gitee</a> · <a href="https://gitcode.com/IHUI-AI/IHUI-AI">GitCode</a>
  </sub>
</p>

---

> **This file is an index only.** As of 2026-09-30 the root README is an index layer: positioning,
> live-computed numbers, quick start, and entry points into nine topic documents. Every capability's
> full rationale and evidence lives, verbatim, in the nine archive files under
> [`docs/engineering/`](./docs/engineering); the authoritative engineering rulebook is
> [`AGENTS.md`](./AGENTS.md).

## What it is

| Dimension   | Description                                                                                                                                                     |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| In one line | Self-hosted full-stack AI platform: model gateway + Agent orchestration + multi-tenant backend + 8 frontend ends                                                |
| Backend     | `apps/api` — Fastify 5 + Drizzle ORM + PostgreSQL + Zod (TypeScript)                                                                                            |
| AI service  | `apps/ai-service` — FastAPI + LangGraph + LiteLLM + MCP (Python)                                                                                                |
| Frontends   | Next.js 16 + React 19 + Tailwind 4 + shadcn/ui (web), Taro 4 (mini-program), React Native + NativeWind (app), Tauri 2 (desktop), WXT (extension), Node.js (CLI) |
| Data        | PostgreSQL (row-level security, multi-tenant) + pgvector vector search + Redis                                                                                  |
| License     | Apache-2.0 (copyright notice and NOTICE must be retained; source files carry provenance watermarks)                                                             |

Full positioning narrative (value pyramid, cost comparison, differentiation, benchmark categories):
[`docs/engineering/readme-01-positioning.md`](./docs/engineering/readme-01-positioning.md).

## Key numbers (live-computed)

**These numbers are not hand-copied.** The single algorithm lives in
[`scripts/gen-doc-numbers.mjs`](./scripts/gen-doc-numbers.mjs), which counts from real sources
(schema code, route registrations, locale directories, compose manifests...). The gate
[`scripts/check-doc-numbers.mjs`](./scripts/check-doc-numbers.mjs) re-computes them for this file and
the Chinese README, and blocks any stale value.

Headline claims (same source as the table below, all live-computed): **599 tables · 4,451 API routes ·
25 WebSocket endpoints · 118 catalogued LLMs · 38 platforms auto-publishing · 3,019 test files ·
267 engineering gates · 49 CI workflows · 5-language i18n parity · 9 app packages · 16 shared packages ·
14 compose services**.

<!-- BEGIN GENERATED NUMBERS (node scripts/gen-doc-numbers.mjs --markdown) -->
| 指标 | 现值 | 取数键 |
| ---- | ---- | ------ |
| 数据库表 | 599 | `dbTables` |
| schema 文件 | 232 | `dbSchemaFiles` |
| API 路由 | 4451 | `apiRoutes` |
| 路由文件 | 609 | `apiRouteFiles` |
| AI 服务路由 | 576 | `aiServiceRoutes` |
| WebSocket 端点 | 25 | `wsEndpoints` |
| 入库模型清单 | 118 | `llmModels` |
| 发布平台 | 38 | `publishPlatforms` |
| 端应用包 | 9 | `appPackages` |
| 共享包 | 16 | `sharedPackages` |
| CLI 命令文件 | 66 | `cliCommandFiles` |
| CLI 工具文件 | 72 | `cliToolFiles` |
| 语言 | 5 | `i18nLanguages` |
| i18n 作用域 | 7 | `i18nScopes` |
| 语言包 JSON | 35 | `i18nMessageFiles` |
| 测试文件 | 3019 | `testFiles` |
| CI 工作流 | 49 | `ciWorkflows` |
| Compose 服务 | 14 | `composeServices` |
| 工程守门 | 267 | `guardianGates` |
| — blocking | 243 | `guardianBlocking` |
| — warn | 27 | `guardianWarn` |
| 跟踪文件 | 15603 | `trackedFiles` |

上表由 `node scripts/gen-doc-numbers.mjs --markdown` 生成,最后核对日期 2026-10-21。
每个数的来源就写在取数键旁边的实现里(`scripts/gen-doc-numbers.mjs` 的 `SOURCES`),**不得手抄、不得另立第二份**。

<!-- END GENERATED NUMBERS -->


## Recent updates (auto-maintained)

<!-- BEGIN RECENT UPDATES (auto-maintained; do not hand-edit between markers) -->
**2026-10-22**
- ♻️ Refactor:任务认领判据单源化 —— check-task-claims 改用 plan-task-index 的 claimMarkOf/codeSpanRangesOf (09e13e0eda)

**2026-10-21**
- 🐞 Fix:删除 web 词条两枚无引用死 key(detail.duration/detail.objectives) (a7806c96b7)

**2026-10-21**
- 📚 Docs:补 16b 推送协议与 16c 钩子装载位对账 (88160bab99)

**2026-10-21**
- 🐞 Fix:删除 learn.detail 死 key duration/objectives(五语言同批,解除死 key 门全局阻塞) (b35c22d2e6)

**2026-10-21**
- 🐞 Fix:README 测试文件计数同步为 3019(门 173 现算口径)并收口最近更新窗口 (0e715fe6c9)

**2026-10-21**
- 🔧 Chore/Other:收口 README 最近更新(补 d9bb3a70bb 条目并推进增量基线) (2fbe5a2fe1)

**2026-10-21**
- 🔧 Chore/Other:收口 README 最近更新窗口与自动更新指针(H3 判据落地后) (d9bb3a70bb)

**2026-10-21**
- 🚀 Feature/Improvement:守门 226 增 H3 装载位判据——core.hooksPath 指向空目录时自动推送/备份整链静默停摆,补镜像 M8 (cc6bd20c75)
- 🐞 Fix:补齐 AI 数据/文章与 SaaS 备份三个被忽略目录的 lint-staged 出口件 (4e92b12806)
- 🐞 Fix:可见性同步用例改用默认允许集内的 href,修复用例与允许集脱节导致的红 (4d4a761ef2)

**2026-10-21**
- 🔧 Chore/Other:收口 README 最近更新窗口与自动更新指针 (ff90a8c33b)

**2026-10-21**
- 🔧 Chore/Other:重钉四端 ui-routes 自述钉(remote-icons 引用清理后) (0904dc3e66)

**2026-10-21**
- 🔧 Chore/Other:再生成 README 数字与更新日志、四端 ui-routes 自述钉,推进文档自动更新指针 (e4e7aedae7)

**2026-10-21**
- 📚 Docs:恢复被撤销裁决删除的 agent.md/spec 与 lint-staged 空壳,归档 Discord 频道文案 (737bd5f90f)
- 🚀 Feature/Improvement:RN 旋转自适应与 EAS 打包链路修正,补商店素材及桌面依赖 (837c920b25)
- 🚀 Feature/Improvement:课程章节播放与进度真实数据源,修复自定义导航同步并清除 NUL 污染 (8ae6fe73a1)
- 🚀 Feature/Improvement:接入重放水位守卫与小程序 CI 上传工具,补 pnpm 锁 (91d998fb86)
- 🐞 Fix:移除未使用的系统 Chrome 查找死代码并重锁依赖 (37dc144105)

**2026-10-21**
- 🐞 Fix:删除 PROJECT_PLAN 错误入库的冲突标记 3 行 + 收尾报告补溯源水印 (32dde7723b)
- 🔧 Chore/Other:复删被合并复活的 6 枚死图标 —— 机主裁决枚 504f86371720 已删 20 枚,triangle-alert.svg 不在删除名单故保留; §22 门 168 不许删除被合并静默复活 (64a306b786)
- 📚 Docs:补 2026-10-21 收口报告缺失的溯源载荷(远端带入时未注入,水印全量预检「未覆盖」;§5c 注入幂等) (804b5348bd)
- 🐞 Fix:归并 merge 冲突标记 —— 取 theirs 侧 55 行漂移副本注释(ours 侧仅空行,零内容损失); 冲突标记门 79 已 rc=0 (f75d0b3491)

**2026-10-21**
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (1edf32225cd)
- 🐞 Fix:未合并检出 72h 打标保活后回收 + 备份链路 fail-closed (24f0d51a23d)
- 📚 Docs:归档本会话正式规格 spec.md(与 tasks.md 同批,避免再被工作区清理抹掉) (e7483f27609)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (6129fc84b76)
- 🚀 Feature/Improvement:机主指令收编本机纯新增在飞件 —— plugins-data 14 枚市场插件数据、FenLeiOverlay/TabBar/NativePanelFrame 组件与镜像测试、归档工具链 6 枚新器与镜像测试、db provider 审计 3 枚、dup-declaration 归档件 (bcc72af873e)
- 🐞 Fix:汇总行解析正则去双转义 —— 轮次正证 total/failed/timedOut 恢复有值,422 轮 null 留痕收口 (9608d09fa9c)
- 🔧 Chore/Other:门168 补登 2 条活跃临时流水 allowlist (6e1b81f8f73)
- 🐞 Fix:根治 worktree 完毕不清理/不合并/不提交 —— 新增生命周期回收器 + S4U 计划任务每 10 分钟无人值守执行 (c1de468ff94)
- 🐞 Fix:G-924 六条线上取不到的图标 URL 改走本仓 lucide SVG —— 补 LineIcon 注册表 3 键 + 远程图标注册表换引用 + ui-routes 自述钉随提交面刷新 (5828ca478c0)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (22245c83f22)
- ♻️ Refactor:落地 back-chevron 组件核心 —— 一份平台无关组件源 + 两端 adapter(O81 票③第一例) (eec42a55eb6)
- 🐞 Fix:修两处 HEAD 存量 lint 红(react/display-name + consistent-type-imports) + 归档 spec 执行清单 (fd87d8c97bd)
- 🔧 Chore/Other:门168 历史欠账裁决 —— 84 条路径登记 allowlist(HEAD 已全不存在,后续删除已生效) (ad17d1546f6)

**2026-10-21**
- 🐞 Fix:镜像测试红数清零(基线31+基线后新增第32枚)—— A族4文件改钉(接线随生产者换形:signal-exit迁executor/safe-gc gitRaw/typecheck-scope三钉/desktop-dev-identifier双参正控) + B族环境感知未判定闸16枚(prod-bundle 6+venv 4+B3族9枚中6文件+c-disk-breakdown T6独立探针闸) + C族真债(AGENTS.md归档瘦身94674B/direct-backend-calls补status.ts单源出口实修/sync-prometheus T5同票双写避让承接他席规则推导版);判据方向零放宽,缺失一律可见未判定;本地199用例0红+双门绿复验 (3bb7f44e828)
- 🔧 Chore/Other:摘除 3 条已勾滞留行(完成即删;G-922/924/927 撞号消解) (82807bca081)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (11f54b8d07e)
- 🔧 Chore/Other:刷新派生产物(README 数字块/最近更新/FA 数字 + ui-routes pin) (874e675890d)
- 🚀 Feature/Improvement:落地 spec 项16/项18 两道 apiOrThrow 迁移验收门(混用 0 / 待验解包 0) (22c07dced5f)
- 🐞 Fix:根目录白名单登记 .spec-mode(外部 spec 工作流在根自建) (03976f4f63c)
- 🐞 Fix:Publish 三屏门83 存量清零 + 门39 白名单补登 (b7d7a151c70)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (4493f94b4d4)
- 🐞 Fix:12 屏批次三道门收口 —— 门150 角色档 21 族归零 + 门83 R2/R3/R8 存量清零 + 门39 十三条 RN 独占白名单 (e17289f18c3)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (5d1c5ca1ab8)
- 📚 Docs:归并 O 族 7 组重复小节标题 + 翻勾 G-927/G-922/G-865 三枚已交付票 (6bc77bd8026)
- 🐞 Fix:WebView2 创建失败出口先提示用户再自动退出 —— 双击无反应时给出可操作提示 (ccbc9924a5d)
<!-- END RECENT UPDATES -->

## Nine topic documents (verbatim archives from the old root README)

| File                                                                                                     | Domain                           | Archived sections                                                                                                                                                                                                              |
| -------------------------------------------------------------------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [`readme-01-positioning`](./docs/engineering/readme-01-positioning.md)                                   | Positioning & claims             | Header banners & manifesto · one-click deploy · tech-stack overview · project manifesto · GEO optimization · TOC · positioning · feature matrix                                                                                |
| [`readme-02-ux-and-ai-control`](./docs/engineering/readme-02-ux-and-ai-control.md)                       | UX & AI control                  | Streaming AI UX (Phase 19) · full AI-control bridge · GlobalTopBar + Plus popover · use cases · AI conversation decision surface & runtime facts                                                                               |
| [`readme-03-why-comparison-scenarios`](./docs/engineering/readme-03-why-comparison-scenarios.md)         | Selling points & scenarios       | Why IHUI-AI · benchmark matrix · who uses it · 5 typical scenarios · contact                                                                                                                                                   |
| [`readme-04-architecture-and-modules`](./docs/engineering/readme-04-architecture-and-modules.md)         | Architecture & modules           | Tech stack · 8-end architecture · cross-end sharing · maintenance ratio · app hierarchy diagrams · project structure · 15 module deep-dive                                                                                     |
| [`readme-05-quickstart-api-data`](./docs/engineering/readme-05-quickstart-api-data.md)                   | Quick start / API / data         | Quick start · REST/WebSocket API & capability catalog · model auto-sync · IM multi-platform control · database                                                                                                                 |
| [`readme-06-security-observability-gates`](./docs/engineering/readme-06-security-observability-gates.md) | Security / observability / gates | Observability · security design · root guardian service · full gate table · commit-loss protection · quality evidence · AI collaboration statement · testing · deployment · CI · i18n · LLM dictionary · gate registry addenda |
| [`readme-07-faq-roadmap-commerce`](./docs/engineering/readme-07-faq-roadmap-commerce.md)                 | FAQ / roadmap / commerce         | FAQ · contributing · doc navigation · roadmap (delivered / recent updates / capability list) · monetization · star history · translated READMEs · contact                                                                      |
| [`readme-08-seo-keywords-story`](./docs/engineering/readme-08-seo-keywords-story.md)                     | SEO & brand story                | AI-engine exposure · our story · open-source vision · license · join us · acknowledgements · quick FAQ · full keywords                                                                                                         |
| [`readme-09-ops-tools`](./docs/engineering/readme-09-ops-tools.md)                                       | Ops tooling & archives           | Release-line closure capabilities & ops entries · production monitoring tools · gate registry addenda · dangling table rows archive                                                                                            |

## The 8 ends (plus one shell)

The workspace holds **9 app packages** (the last row is a Capacitor shell reusing the web static export)
and **16 shared packages**.

| End               | Directory           | Stack                                          | Notes                                                        |
| ----------------- | ------------------- | ---------------------------------------------- | ------------------------------------------------------------ |
| Web               | `apps/web`          | Next.js 16 + React 19 + Tailwind 4 + shadcn/ui | Main site + admin console + IDE panel                        |
| API               | `apps/api`          | Fastify 5 + Drizzle ORM + PostgreSQL + Zod     | Business backend: auth/tenants/billing/content/WebSocket     |
| AI service        | `apps/ai-service`   | FastAPI + LangGraph + LiteLLM + MCP            | Model gateway, agent engine, RAG, workflows                  |
| Mini-program      | `apps/miniapp-taro` | Taro 4 + React + NativeWind                    | WeChat, native WeChat Pay                                    |
| Mobile app        | `apps/mobile-rn`    | React Native + Expo + NativeWind               | Shares screen layer `packages/app`                           |
| Desktop           | `apps/desktop`      | Tauri 2 (thin Rust shell) + web frontend       | No bundled frontend in release builds; tray + auto-update    |
| Browser extension | `apps/extension`    | WXT + Chrome MV3                               | Side Panel toolset                                           |
| CLI               | `apps/cli`          | Node.js + TypeScript                           | Terminal assistant, tools, drift checks, agent-engine client |
| Capacitor shell   | `apps/mobile-cap`   | Capacitor 7                                    | Packages `apps/web` `out/` export for Android/iOS            |

## 🚀 Quick start

```bash
git clone https://github.com/IHUI-INF-AI/IHUI-AI.git
cd IHUI-AI
cp .env.example .env           # fill JWT_SECRET / DB_PASSWORD / CREDENTIALS_ENCRYPTION_KEY
docker compose up -d           # business + migrations; add --profile observability as needed
```

If something does not come up: `docs/DEPLOYMENT_RUNBOOK.md` · `docs/TROUBLESHOOTING.md` · port registry `docs/port-management.md`.

Local development:

```bash
pnpm install                   # full install, --filter is forbidden (AGENTS §12e)
docker compose up -d db redis
pnpm --filter @ihui/database run db:migrate
pnpm dev                       # web :8801 + api :8802 (+ ai-service :8803)
pnpm turbo build typecheck lint test
```

Model keys are never in the repo: bootstrap with `node scripts/env-backfill-model-keys.mjs --verify`
(see [`AGENTS.md` §5d](./AGENTS.md)). Windows one-click launch scripts, full env-var table, REST/WebSocket
API, model sync and IM multi-platform control: [`readme-05`](./docs/engineering/readme-05-quickstart-api-data.md).

## Deployment

| Topic                                            | Where                                                                               |
| ------------------------------------------------ | ----------------------------------------------------------------------------------- |
| Production runbook (blue-green, rollback, certs) | [`docs/DEPLOYMENT_RUNBOOK.md`](./docs/DEPLOYMENT_RUNBOOK.md)                        |
| Compose / IaC decisions                          | [`docs/INFRASTRUCTURE_DECISION.md`](./docs/INFRASTRUCTURE_DECISION.md)              |
| Monitoring & alerting (email single channel)     | [`docs/MONITORING.md`](./docs/MONITORING.md)                                        |
| Database backups & read-only backup role         | [`docs/DATABASE.md`](./docs/DATABASE.md)                                            |
| Credential rotation                              | [`docs/CREDENTIAL_ROTATION_RUNBOOK.md`](./docs/CREDENTIAL_ROTATION_RUNBOOK.md)      |
| CI workflow inventory                            | [`.github/workflows/`](./.github/workflows) + the workflow count in the table above |

## Development constraints (excerpt)

**The rules in this repo are code, not verbal agreements.** The single authoritative text is
[`AGENTS.md`](./AGENTS.md). The ones you hit on day one:

1. Task plans live only in `PROJECT_PLAN.md`; claims use the lease format `（进行中@日期/持有者）`.
2. Commits go through `node scripts/safe-commit.mjs`; `git add .` / `-A` / `-u` are forbidden; live docs
   require `node scripts/merge-live-doc.mjs --file README.md` first.
3. `git stash`, `git pull --rebase` and hand-written `git push` are forbidden; pushes go through the
   post-commit `git-push-guard`.
4. Single-branch development: no branches except `goal/*`.
5. Shared layer first: check `packages/` before writing any hook/util/type/api-client twice.
6. UI hard rules: single source of truth for radii/geometry; vector icons only; no emoji as icons.
7. Auth: authentication is not authorization; identity comes from the carrying layer, never from the
   request body; batch writes report the DB-confirmed set (`.returning({id})`).
8. i18n: key parity across five languages (en/zh-CN/zh-TW/ja/ko) is a gate.
9. Temp files only under `.ihui-agent/tmp/<task>/`.
10. New files must be watermarked: `node scripts/watermark.mjs inject <file>`.

## License & copyright

- **License**: Apache-2.0 (see [`LICENSE`](./LICENSE)); contributor terms in [`CONTRIBUTING.md`](./CONTRIBUTING.md).
- **NOTICE**: must be retained with every copy.
- **Provenance watermarks**: three-layer watermark on source files, maintained by `scripts/watermark.mjs`;
  they do not alter the rights granted by Apache-2.0.
- **Trademarks**: "智汇AI / IHUI-AI" and its logos belong to the project; Apache-2.0 grants no trademark rights.

## Contact

- Site / docs: <https://aizhs.top>
- Issues: <https://github.com/IHUI-INF-AI/IHUI-AI/issues>
- Security disclosures (please do not post publicly): [`SECURITY.md`](./SECURITY.md)
- Code of conduct: [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md)

<div align="center">

If this project is useful to you, a ⭐ is the most direct contribution.

</div>
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
