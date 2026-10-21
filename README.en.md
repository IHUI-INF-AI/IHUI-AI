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
| 跟踪文件 | 15615 | `trackedFiles` |

上表由 `node scripts/gen-doc-numbers.mjs --markdown` 生成,最后核对日期 2026-10-21。
每个数的来源就写在取数键旁边的实现里(`scripts/gen-doc-numbers.mjs` 的 `SOURCES`),**不得手抄、不得另立第二份**。

<!-- END GENERATED NUMBERS -->


## Recent updates (auto-maintained)

<!-- BEGIN RECENT UPDATES (auto-maintained; do not hand-edit between markers) -->
**2026-10-22**
- 🐞 Fix:活文档归并补认无需归并短路径(真丢失=0),修 PROJECT_PLAN 被 fail-closed 误悬挂 (c85a82e4d1)

**2026-10-22**
- 🐞 Fix:更正 O88 行的失效出路 —— 票面写的 plan-tasks-merge --dedupe-done-twins 不在归并器旗标白名单内,照抄必 rc=2,换成实测 RC=0 的 check-plan-task-duplicates --json 并带上现读读数;裁与不裁的判定权仍归人,其余一字未动(§0.8 文档不许写跑不通的出路) (3c36f0efc7)

**2026-10-22**
- 🐞 Fix:摘牌器补落地后复验与新枚 sha 取源 —— 实测本器上一轮用 git rev-parse HEAD 取 landedSha,并发下取到的是别席刚顶上那枚(信息是「清偿重复登记存量」),于是报了「留痕 57 条」而 HEAD 面上一枚牌都没少:留痕指向不存在的改写、成功是自述的。现改为①从落地器自己输出解 40 位 sha,解不到就不写留痕不报成功;②落地后回读 HEAD 面复验(被摘原行残留数必须为 0 且挂牌数等于本轮跳过数),不过则判未生效。测试先行:两臂先跑 ReferenceError 再实现,器物自检廿三例全过。那 57 条假凭据已逐条校验提交信息后作废并留读数。 (52ba2968b3)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (ef64532a32)

**2026-10-22**
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (03d90ef001)

**2026-10-22**
- 🐞 Fix:活文档收编前先归并(lost=0 才提交),README 生成数字发令前对齐;清空并行席位悬挂改动 (08d9add06e)

**2026-10-22**
- ⚡ Perf:safe-commit 发令前对齐 README 生成数字,根治门173滞后竞态;sync 增 --files 限定处理面与声明面同源 (b02793d354)
- 🚀 Feature/Improvement:摘牌器补三格 —— 留痕键集单一清单(LEDGER_KEYS 导出,自产与补写同形状,缺字段抛错不落半形)、backfillEntry 收敛器补写口、注记日期改本地日(上一轮用 UTC 日写注记,当天上午摘的牌全落在前一天,按日期收敛时整批六十三枚被漏掉)。测试先行:键集一致性臂先跑 ReferenceError 再实现;器物自检廿一例全过。 (098aa44d30)
- 🐞 Fix:把本席上一轮漏收敛的 63 枚摘牌注记收敛成指针(原牌信息已无损回填留痕,seq 前缀 bfmviq9p9d)。上一轮我只按 @2026-10-22 匹配就报了「收敛完」——器物当时用 UTC 日写注记,当天上午的摘牌全落在 @2026-10-21,整批被我漏掉,那是交付不实;本轮同时把日期口径改成本地日,并给留痕补写口与键集一致性自检(防两种形状)。历史他人席位的注记一枚未动。校验:注记 #seq 六十三/六十三可在留痕解到、lease 三十五/三十五带原牌三要素、前后整行双全。 (7488b9cd66)

**2026-10-22**
- ♻️ Refactor:摘牌可追责性搬到仓外留痕 —— 行内注记只留 #seq 指针(实测最长五十二字,注记本身会被活文档归并洗掉:一轮六十四枚只剩六枚),原牌日期/持有者/超龄量/摘除前后整行/基线与落地枚 sha 逐条落 .workbuddy/stale-claim-strip.jsonl,九十天窗口老化且裁掉条数必须报出,取不到判未判定不用零冒充没摘过。测试先行:新臂先跑出红再实现;两次变异(去指针 / 留痕不存整行)分别使三四臂翻红,还原后逐字节核对基线指纹一致。器物自检十九例、镜像十例(含真写盘与老化)全过,门一零三/五二/一九九/一九四/一七六/十五/廿五各 RC=零。 (de551d1755)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (c21ed373c9)
- 🚀 Feature/Improvement:守门一零九新增 CL4 拦新增裸「（进行中）」(机主定档),与 CL1/CL3 共用 HEAD 存量棘轮只拦本次带进来的;超龄牌器物默认档改为代摘裸标记,依据是同批 CL4 已在提交链拦住新增、而器物只读 HEAD 面。测试先行:先写 S21 与 S1 更新跑出新红再实现,自检廿二例、镜像廿一例、器物镜像七例(第二遍复跑证幂等)、器物自检十一例全过;runner 标签同批改到四档名。取证:真仓 --check-gate 现读零红且 CL4 存量廿七处逐条点名、新增零处判红。 (cde5d204f2)
- 📚 Docs:§1 同步 CL4 定档与器物默认档改写 —— 裸「（进行中）」新增即拦、存量只报数;器物代摘裸标记的依据是同批 CL4(不是口头状态) (18fc90a789)

**2026-10-22**
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (d6fb50905f)

**2026-10-22**
- 🐞 Fix:3e 活文档对账同时豁免两片派生区(RECENT UPDATES 归 auto-update-readme-recent、GENERATED NUMBERS 归 gen-doc-numbers;后者正确性由门 173 守),块外仍要求工作树⊇HEAD (1d1ed2680b)

**2026-10-22**
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (980c5f92b2)

**2026-10-22**
- 🔧 Chore/Other:收口四语 README 最近更新与跟踪文件计数(15610) —— 派生区按 MAX_GROUPS 封顶主动裁旧属设计,块外仅 trackedFiles 一行变更,已按文档口径 IHUI_SKIP_LIVE_DOC_CHECK=1 留痕 (16c2dc4f56)

**2026-10-22**
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (0165022242)
- ⚡ Perf:按改动性质分档(元门档 31 门)+ README 自动同步移出 pre-commit(消除 O43 窗口冲突) (c930087e84)
- 🐞 Fix:storeDir 指向已不存在的 G 盘 —— 全仓 install 恒失败(净面/主仓同因),改 D 盘 (8d81ef1995)

**2026-10-22**
- ⚡ Perf:纯内容门指纹缓存 + 快档重型门真补跑 (010e3cb1a8)
- ♻️ Refactor:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (c647b44ade)
- 🐞 Fix:自动收编器的 git helper 显式接管 stdio —— 门一零三在 HEAD 面点名该处裸奔(本机不写 stdio 稳定 EBUSY,§十二g)。上一笔只补了 windowsHide 就交,等于修一处漏一处,这次同批补全并复跑门一零三/五二/一九九 索引面各 RC=零。 (7606579655)
- 📚 Docs:§1 登记超龄认领牌兜底器物与授权口径 —— 门在提交链上仍不代摘,超龄牌由 strip-stale-claim-marks 周期代摘并把旧形态写进 removed 抗 union 回潮 (ae9bc35767)

**2026-10-22**
- 🐞 Fix:自动收编器两处派生补 windowsHide —— 门五十二 HEAD 面存量红,它会挡住任何会话的提交。取证:改动后 --staged 面复跑该门 RC=0(扫描一枚文件,生产代码零违规);该门判 HEAD blob,故修完必入库才算数。 (51131b0e93)

**2026-10-22**
- 🔧 Chore/Other:收编停留≥3分钟的未提交改动 (0c65211263)
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
