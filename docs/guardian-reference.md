# 守门体系参考文档（自动生成）

> 本文档由 `scripts/generate-guardian-docs.mjs` 从 `scripts/guardian-runner.mjs` 动态提取生成。
> 修改 guardian-runner.mjs 后请运行 `pnpm guardian:docs` 重新生成。
> **禁止手工编辑**——下次生成会覆盖。
>
> 最后生成：2026-07-28（共 59 项：blocking 41 / warn 16 / info 2）

## 目录

- [1. 守门项完整清单](#1-守门项完整清单)
- [2. P2-G: warn→blocking 升级时间表](#2-p2-g-warnblocking-升级时间表)
- [3. P2-H: id 命名空间重构建议](#3-p2-h-id-命名空间重构建议)
- [4. P3-C: 文档自动化机制说明](#4-p3-c-文档自动化机制说明)

---

## 1. 守门项完整清单

按 mode 分组，每组按 guardian-runner.mjs 中的出现顺序排列。

### 1.1 blocking 项（41 项）

| ID | Label | Script | Args | onFailHint |
|----|-------|--------|------|------------|
| 1 | 🔐 API key 泄露 | check-api-key-leak.mjs | — | — |
| 2 | 🌐 i18n 键完整性 | check-i18n-keys.mjs | — | — |
| 2b | 🔍 zh-TW 简体字残留 | scan-i18n-zh-residue.mjs | zh-TW | — |
| 2c | 🔍 ko.json 中文残留 | scan-i18n-zh-residue.mjs | ko | — |
| 2e | 🔍 en.json 破碎英文 | check-i18n-broken-en.mjs | — | — |
| 2f-web | 🌐 i18n AI 翻译流水线(blocking) | i18n-diff.mjs | — | 有 |
| 2f-miniapp-taro | 🌐 [miniapp-taro] i18n AI 翻译流水线(blocking) | i18n-diff.mjs | --target=miniapp-taro | 有 |
| 3 | 🗄️ schema drift | check-db-schema-drift.mjs | — | — |
| 4 | 📦 packages 陈旧 dist | check-stale-dist.mjs | — | — |
| 4b | 🔤 dist UTF-8 BOM | check-dist-encoding.mjs | — | — |
| 4c | 🔤 api-client UTF-8 完整性 | check-api-client-utf8.mjs | — | — |
| 6 | 🛡️ skipResponseSanitization | check-sanitizer-bypass.mjs | — | — |
| 7 | 📦 依赖碎片化 | check-dedupe.mjs | — | — |
| 8 | 🔗 前端↔后端路由一致性 | check-api-routes.mjs | — | — |
| 11 | ⭕ 容器圆角违规 | check-rounded-full.mjs | — | — |
| 12 | 📋 交付报告一致性 | check-delivery-report-consistency.mjs | — | — |
| 13c | 🗂️  PROJECT_PLAN.md 已完成任务防误删 | check-project-plan-archive.mjs | — | — |
| 15 | 📊 迁移完整性(7 大类 29 子项) | check-api-migration-completeness.mjs | — | — |
| 17 | 🎨 CSS 颜色 token 嵌套 | check-input-border-var.mjs | — | — |
| 18 | 🖱️  原生 title tooltip 违规 | check-native-title-tooltip.mjs | — | — |
| 20 | 🎯 Tailwind class 冲突 | check-tailwind-class-conflict.mjs | — | — |
| 24a | 📏 侧边栏宽度一致性 | check-sidebar-width-consistency.mjs | — | — |
| 25 | 🧹 项目外路径违规(blocking) | check-workspace-hygiene.mjs | — | — |
| 26 | 🛡️  项目父目录污染巡查(blocking) | check-parent-pollution.mjs | — | — |
| 27 | 🛡️  z-index 层叠防护(防 TRAE 注入 + 遮罩 fade-in 回归) | check-z-index-guard.mjs | — | — |
| 28 | 🛡️  全屏遮罩 z-index 层级(防 fixed inset-0 + z-50 复发) | check-overlay-zindex.mjs | — | 有 |
| 29 | 🚀 Push 同步兜底(防"commit 后忘记 push"复发,AGENTS.md §21 第三道防线) | check-push-sync.mjs | — | 有 |
| 30 | 🛡️ i18n 文件完整性(防 prettier 截断事故复发) | validate-i18n-integrity.mjs | — | 有 |
| 30a | 🛡️  Commit 丢失防护(blocking,AGENTS.md §22,防 reset / drop stash 误丢 commit) | check-commit-loss-guard.mjs | --blocking --filter-stash | — |
| 35 | 🐍 mypy 类型检查(防 ai-service Python 类型回退) | check-mypy.mjs | — | 有 |
| 36 | 🎨 [miniapp-taro] design-tokens 同步(防 app.css 漂移) | check-miniapp-tokens-sync.mjs | — | 有 |
| 37 | 🎨 [web] design-tokens 同步(防 globals.css 漂移) | check-web-tokens-sync.mjs | — | 有 |
| 38 | 🛡️  solito 幽灵依赖回归守门(blocking,防 P0 优化被回退) | check-solito-residue.mjs | — | 有 |
| 2f-shared | 🌐 [shared] i18n 键完整性(blocking,零变更验证通过) | check-i18n-keys.mjs | --target=shared | — |
| 2j-shared | 🔍 [shared] zh-TW 简体字残留(blocking) | scan-i18n-zh-residue.mjs | zh-TW --target=shared | — |
| 2k-shared | 🔍 [shared] ko.json 中文残留(blocking) | scan-i18n-zh-residue.mjs | ko --target=shared | — |
| 2m-shared | 🔍 [shared] en.json 破碎英文(blocking) | check-i18n-broken-en.mjs | --target=shared | — |
| 2f-shared-diff | 🌐 [shared] i18n AI 翻译流水线(blocking) | i18n-diff.mjs | --target=shared | 有 |
| 2n-web | 🌐 [web] 5 语言 i18n parity 强制校验 (blocking,2026-08-02 升级,兜底 item 2 漏检场景) | check-i18n-keys.mjs | --parity-only | — |
| 9 | 🔍 safeParse 静默忽略(blocking,2026-07-26 升级) | check-safe-parse.mjs | — | 有 |
| 33 | 🛡️  LLM provider schema 守门 (blocking,阶段 3 主体已落地) | check-llm-provider-schema.mjs | — | 有 |

### 1.2 warn 项（16 项）

| ID | Label | Script | Args | onFailHint |
|----|-------|--------|------|------------|
| 2g-web | 🔍 i18n 命名空间传递(web→共享组件) | check-i18n-namespace-passing.mjs | — | — |
| 2d | 🔍 ja.json 中文残留(warn-only) | scan-i18n-zh-residue.mjs | ja | — |
| 2f-ext | 🌐 [extension] i18n 键完整性(warn-only) | check-i18n-keys.mjs | --target=extension | — |
| 2g-ext | 🔍 [extension] zh-TW 简体字残留(warn-only) | scan-i18n-zh-residue.mjs | zh-TW --target=extension | — |
| 2h-ext | 🔍 [extension] ko.json 中文残留(warn-only) | scan-i18n-zh-residue.mjs | ko --target=extension | — |
| 2i-ext | 🔍 [extension] en.json 破碎英文(warn-only) | check-i18n-broken-en.mjs | --target=extension | — |
| 2l-shared | 🔍 [shared] ja.json 中文残留(warn-only) | scan-i18n-zh-residue.mjs | ja --target=shared | — |
| 2f-mobile-rn | 🌐 mobile-rn i18n parity 守门(warn-only 起步,2026-07-28 立) | check-i18n-keys.mjs | --target=mobile-rn --parity-only | 有 |
| 2f-cli | 🌐 cli i18n parity 守门(warn-only,2026-07-28 立) | check-cli-i18n-parity.mjs | — | 有 |
| 13b | 📐 PROJECT_PLAN.md 体积(warn-only) | check-project-plan-size.mjs | — | — |
| 19 | ⚠️  staged 污染预警(warn-only) | check-staged-pollution.mjs | — | — |
| 21 | 🌐 多端同步开发守门(warn-only) | check-multi-end-sync.mjs | — | — |
| 22 | 📖 README 同步守门(warn-only) | check-readme-sync.mjs | — | — |
| 24b | 🔌 端口注册表守门(warn-only) | check-port-registry.mjs | — | — |
| 31 | 🛡️  AuthShell 共享实现静态守门(warn-only,防 web/extension 视觉漂移) | verify-auth-shell.mjs | — | — |
| 34 | 🔍 @ts-ignore 新增检测(warn-only,防 215 处历史遗留复发) | check-ts-ignore.mjs | — | 有 |

### 1.3 info 项（2 项）

| ID | Label | Script | Args |
|----|-------|--------|------|
| 10 | 📋 OpenAPI spec(informational) | openapi-check.mjs | — |
| 23 | 📋 staged 文件清单(info) | check-staged-files.mjs | — |

### 1.4 失败提示详情（onFailHint）

仅展示有 onFailHint 的守门项（共 15 项），按 guardian-runner.mjs 出现顺序排列。

#### [2f-web] 🌐 i18n AI 翻译流水线(blocking)

```

  💡 zh-CN.json 有改动但 i18n pending 非空,请先跑翻译流水线:
     1. node scripts/i18n-diff.mjs          (检测差异,生成 pending 清单)
     2. AI agent 翻译 → .trae-cn/tmp/i18n-translations.json
     3. node scripts/i18n-apply.mjs         (应用翻译)
     4. node scripts/check-i18n-keys.mjs    (验证 parity)
     5. git add apps/web/messages/{en,ja,ko,zh-TW}.json 重新 commit

```

#### [2f-miniapp-taro] 🌐 [miniapp-taro] i18n AI 翻译流水线(blocking)

```

  💡 miniapp-taro zh-CN.ts 有改动但 i18n pending 非空,请先跑翻译流水线:
     1. node scripts/i18n-diff.mjs --target=miniapp-taro  (检测差异,生成 pending 清单)
     2. AI agent 翻译 → .trae-cn/tmp/i18n-translations.json
     3. node scripts/i18n-apply.mjs --target=miniapp-taro  (应用翻译)
     4. node scripts/i18n-diff.mjs --target=miniapp-taro   (复验 parity,应无 pending)
     5. git add apps/miniapp-taro/src/i18n/{en,ja,ko,zh-TW}.ts 重新 commit

```

#### [28] 🛡️  全屏遮罩 z-index 层级(防 fixed inset-0 + z-50 复发)

```

  💡 fixed inset-0 全屏遮罩用了 z-50/z-40/z-30 等低数字 Tailwind 类(值 < 100),
     低于 AISidePanel 的 z-sticky=990,会被压在下面 = AI 面板露在遮罩之上。
     修复:把 z-50 改为 z-modal(=2000, 引用 --z-modal CSS 变量)。
     透明点击捕获层(无 bg-black)不在本守门范围。

```

#### [29] 🚀 Push 同步兜底(防"commit 后忘记 push"复发,AGENTS.md §21 第三道防线)

```

  💡 本地有未 push 的 commit,本次 commit 已阻止。
     post-commit 钩子(git-push-guard.mjs)本应自动 push,但可能因以下原因失败:
       - HUSKY_SKIP_PUSH=1 跳过 / push 网络失败 / 凭据失效
       - agent 用 --no-verify 跳过所有钩子
       - pre-push typecheck 阻塞 / RunCommand 工具失联

  修复方法(任选其一):
     ① 自动 push: node scripts/git-push-guard.mjs
     ② 手动 push: git push origin main
     ③ 紧急跳过(不推荐): HUSKY_SKIP_PUSH_SYNC=1 git commit ...

```

#### [30] 🛡️ i18n 文件完整性(防 prettier 截断事故复发)

```

  💡 staged 的 i18n JSON 文件行数异常减少(>50% 且 >100 行),
     通常是 lint-staged 的 prettier --write 解析大 JSON 失败导致截断事故。
     修复:git restore --staged --worktree <file> 后重新编辑/格式化。

```

#### [35] 🐍 mypy 类型检查(防 ai-service Python 类型回退)

```

  💡 apps/ai-service 的 Python 代码有 mypy 类型错误,
     修复:cd apps/ai-service && mypy app --ignore-missing-imports
     紧急跳过(不推荐):HUSKY_SKIP_MYPY=1 git commit ...

```

#### [36] 🎨 [miniapp-taro] design-tokens 同步(防 app.css 漂移)

```

  💡 apps/miniapp-taro/src/app.css 的 --color-* 变量与 packages/design-tokens/src/styles/tokens.css 不一致,
     修复:pnpm --filter @ihui/miniapp-taro sync-tokens
     然后重新 git add apps/miniapp-taro/src/app.css 并 commit

```

#### [37] 🎨 [web] design-tokens 同步(防 globals.css 漂移)

```

  💡 apps/web/app/globals.css 未 @import tokens.css 或顶层手抄 :root/.dark 变量,
     修复:确认 globals.css 含 @import "../../../packages/design-tokens/src/styles/tokens.css";
     删除顶层 :root/.dark 块中与 tokens.css @theme 重复的变量

```

#### [38] 🛡️  solito 幽灵依赖回归守门(blocking,防 P0 优化被回退)

```

  💡 检测到 solito 依赖被重新引入,本仓库已于 2026-07-28 移除 solito(commit f8c9a6630c)。
     packages/app 已改用纯 props 注入式跨端共享组件(无外部导航库依赖)。
     修复:从 package.json 删除 solito 依赖,从 pnpm-workspace.yaml 删除 *solito* hoist,
     删除 patches/solito@*.patch,删除 packages/app 源码中 import from "solito/..." 语句。

```

#### [2f-shared-diff] 🌐 [shared] i18n AI 翻译流水线(blocking)

```

  💡 shared/zh-CN.json 有改动但 i18n pending 非空,请先跑翻译流水线:
     1. node scripts/i18n-diff.mjs --target=shared  (检测差异,生成 pending 清单)
     2. AI agent 翻译 → .trae-cn/tmp/i18n-translations.json
     3. node scripts/i18n-apply.mjs --target=shared  (应用翻译)
     4. node scripts/check-i18n-keys.mjs --target=shared  (验证 parity)
     5. git add packages/i18n/messages/shared/{en,ja,ko,zh-TW}.json 重新 commit

```

#### [2f-mobile-rn] 🌐 mobile-rn i18n parity 守门(warn-only 起步,2026-07-28 立)

```

  💡 mobile-rn 端 5 语言 i18n key 集合不一致。
     修复:node scripts/check-i18n-keys.mjs --target=mobile-rn 查看详情,
     补齐缺失 key 或删除多余 key,确保 zh-CN/zh-TW/en/ja/ko 5 语言 key 集合完全一致。
     1 周后(2026-08-04)评估升级 blocking。

```

#### [2f-cli] 🌐 cli i18n parity 守门(warn-only,2026-07-28 立)

```

  💡 cli 端 5 语言 i18n key 集合不一致。
     修复:node scripts/check-cli-i18n-parity.mjs 查看详情,
     补齐缺失 key 或删除多余 key,确保 zh-CN/zh-TW/en/ja/ko 5 语言 key 集合完全一致。
     cli 端 i18n 体量小(63 行),warn-only 起步,后续按需升级 blocking。

```

#### [9] 🔍 safeParse 静默忽略(blocking,2026-07-26 升级)

```

  💡 Fastify 路由存在 safeParse 静默忽略反模式(result.success === false 不返回/不日志)。
     修复:对 parse 失败明确返回 400 + 错误信息,或记日志后返回,禁止 silent-ignore。
     详见 AGENTS.md §5 后端约束(Zod 校验请求参数)。

```

#### [34] 🔍 @ts-ignore 新增检测(warn-only,防 215 处历史遗留复发)

```

  💡 @ts-ignore 是类型安全压制,本仓库刚清理 215 处历史遗留
     请审视是否真的需要,或改用 e2e/tsconfig.json 独立配置
     跳过白名单:e2e/ / node_modules/ / dist/ / .next/ / build/

```

#### [33] 🛡️  LLM provider schema 守门 (blocking,阶段 3 主体已落地)

```

  💡 apps/ai-service/.env 的 LLM_PROVIDERS 字段不符合 ProviderConfig schema。
     常见错误:JSON 解析失败 / 字段类型错(api_key 必须是字符串、enabled 必须是布尔值) / 未知 provider。
     修复方法:
       ① 跑迁移脚本生成标准 JSON: node scripts/migrate-llm-providers.mjs --input apps/ai-service/.env --output apps/ai-service/.env.migrated --apply --backup
       ② 用 --strict 模式定位具体错误: node scripts/check-llm-provider-schema.mjs --strict --json
     详见 docs/llm-provider-stage3-changelog.md §4 用户升级指南

```

---

## 2. P2-G: warn→blocking 升级时间表

按升级优先级分 4 档：**短期**（1-2 周）/ **中长期**（1-3 个月）/ **待评估** / **永久 warn**。
分类依据：guardian-runner.mjs 源码注释 + AGENTS.md §"守门脚本速查" + 实际依赖评估。

### 2.1 短期升级（1-2 周）

已有明确"观察期无误报即升级"评估结论。

| ID | Label | 建议升级时间 | 前置条件 | 风险点 |
|----|-------|--------------|----------|--------|
| 2g-web | 🔍 i18n 命名空间传递(web→共享组件) | 2026-08-03 | 1 周观察期(2026-07-27 立)无误报 | 共享登录组件命名空间 bug 模式可能漏报(检测目标 8 个组件) |
| 31 | 🛡️  AuthShell 共享实现静态守门(warn-only,防 web/extension 视觉漂移) | ~2026-08-02 | 1 周观察期(2026-07-26 立)无误报 | 7 项静态扫描可能不覆盖所有视觉漂移场景 |

### 2.2 中长期升级（1-3 个月）

依赖外部条件（脚本修复、子模块稳定）才能升级。

| ID | Label | 建议升级时间 | 前置条件 | 风险点 |
|----|-------|--------------|----------|--------|
| 2f-ext | 🌐 [extension] i18n 键完整性(warn-only) | ~2026-09-01 | extension i18n 体量稳定(≥ web 端 50%) | extension 端 i18n 刚起步,误报率未知 |
| 2g-ext | 🔍 [extension] zh-TW 简体字残留(warn-only) | ~2026-09-01 | 同 2f-ext,extension i18n 稳定后同步升级 | 同 2f-ext |
| 2h-ext | 🔍 [extension] ko.json 中文残留(warn-only) | ~2026-09-01 | 同 2f-ext | 同 2f-ext |
| 2i-ext | 🔍 [extension] en.json 破碎英文(warn-only) | ~2026-09-01 | 同 2f-ext | 同 2f-ext |
| 2f-mobile-rn | 🌐 mobile-rn i18n parity 守门(warn-only 起步,2026-07-28 立) | 待定 | check-i18n-keys.mjs 补 mobile-rn 分支(当前 fall through 到 web 分支,无实际防护) | 修复前为占位项,升级无意义 |

### 2.3 待评估

warn-only 起步，无明确升级计划，需触发条件。

| ID | Label | 评估时间点 | 触发条件 | 风险点 |
|----|-------|------------|----------|--------|
| 2f-cli | 🌐 cli i18n parity 守门(warn-only,2026-07-28 立) | 按需 | cli 端 i18n 体量增长后评估(当前 63 行) | 体量过小,升级收益低 |

### 2.4 永久 warn（不升级）

设计上选择 warn 而非 blocking，原因明确，无升级计划。

| ID | Label | 永久 warn 原因 |
|----|-------|----------------|
| 2d | 🔍 ja.json 中文残留(warn-only) | 日文汉字词(登録/確認/削除)易误报,AGENTS.md §19 明确标注 ja warn-only |
| 2l-shared | 🔍 [shared] ja.json 中文残留(warn-only) | 同 2d,日文汉字词易误报 |
| 13b | 📐 PROJECT_PLAN.md 体积(warn-only) | PLAN 体积超限不应阻塞 commit,仅提醒(脚本名已标 warn-only) |
| 19 | ⚠️  staged 污染预警(warn-only) | 跨 agent 协作场景复杂,机械阻塞会误伤正常 commit |
| 21 | 🌐 多端同步开发守门(warn-only) | 平台独占豁免需人工判断,无法机械阻塞(AGENTS.md §9 明确 warn-only) |
| 22 | 📖 README 同步守门(warn-only) | bug 修复/重构场景合理不更新 README(AGENTS.md §21 豁免场景) |
| 24b | 🔌 端口注册表守门(warn-only) | 端口冲突可后期修复,不应阻塞 commit |
| 34 | 🔍 @ts-ignore 新增检测(warn-only,防 215 处历史遗留复发) | @ts-ignore 有合理压制场景(第三方库类型缺陷),不强制阻塞 |

### 2.5 未分类 warn 项

以下 warn 项未在 UPGRADE_TIMELINE 配置中，需补充评估。

（无）

---

## 3. P2-H: id 命名空间重构建议

### 3.1 现状问题

- ID 是数字 1-38 + 字母后缀（2b/2c/2d/2e/2f/4b/4c/13b/13c/24a/24b/30a 等）
- 数字无语义，新增项需查表找下一个可用编号（源码注释显示 35/36/37/38 都因编号冲突而改用其他数字）
- 字母后缀规则不统一（2b/2c 表示同主题子项，但 4b/4c/13b/13c 含义不同）
- ID 与脚本名无映射关系（id=2 → check-i18n-keys.mjs，需查文档）

### 3.2 重构方案：分层命名空间

格式：`<category>/<topic>[-<subtopic>]`

| 分类 | 范围 | 示例 |
|------|------|------|
| `security/` | 安全相关 | `security/api-key-leak` |
| `i18n/` | 国际化（parity / 残留检测 / 流水线 / 完整性） | `i18n/parity-web`、`i18n/zh-tw-residue` |
| `code-quality/` | 代码质量（schema / dist / 路由 / 类型） | `code-quality/schema-drift` |
| `ui/` | UI 样式（圆角 / z-index / token / tooltip） | `ui/rounded-full`、`ui/z-index` |
| `engineering/` | 工程约束（PLAN / 多端同步 / README） | `engineering/multi-end-sync` |
| `workspace/` | 工作区卫生 | `workspace/external-paths` |
| `commit-loss/` | 防提交丢失 | `commit-loss/guard` |
| `push/` | Push 同步 | `push/sync` |
| `dependencies/` | 依赖治理 | `dependencies/solito-residue` |
| `llm/` | LLM 配置 | `llm/provider-schema` |

### 3.3 完整映射表（数字 ID → 语义化 ID）

按 guardian-runner.mjs 出现顺序排列。

| 数字 ID | 语义化 ID | Label | Script |
|---------|-----------|-------|--------|
| 1 | `security/api-key-leak` | 🔐 API key 泄露 | check-api-key-leak.mjs |
| 2 | `i18n/parity-web` | 🌐 i18n 键完整性 | check-i18n-keys.mjs |
| 2b | `i18n/zh-tw-residue-web` | 🔍 zh-TW 简体字残留 | scan-i18n-zh-residue.mjs |
| 2c | `i18n/ko-residue-web` | 🔍 ko.json 中文残留 | scan-i18n-zh-residue.mjs |
| 2e | `i18n/en-broken-web` | 🔍 en.json 破碎英文 | check-i18n-broken-en.mjs |
| 2f-web | `i18n/pipeline-web` | 🌐 i18n AI 翻译流水线(blocking) | i18n-diff.mjs |
| 2f-miniapp-taro | `i18n/pipeline-miniapp-taro` | 🌐 [miniapp-taro] i18n AI 翻译流水线(blocking) | i18n-diff.mjs |
| 2g-web | `i18n/namespace-passing-web` | 🔍 i18n 命名空间传递(web→共享组件) | check-i18n-namespace-passing.mjs |
| 3 | `code-quality/schema-drift` | 🗄️ schema drift | check-db-schema-drift.mjs |
| 4 | `code-quality/stale-dist` | 📦 packages 陈旧 dist | check-stale-dist.mjs |
| 4b | `code-quality/dist-utf8` | 🔤 dist UTF-8 BOM | check-dist-encoding.mjs |
| 4c | `code-quality/api-client-utf8` | 🔤 api-client UTF-8 完整性 | check-api-client-utf8.mjs |
| 6 | `code-quality/sanitizer-bypass` | 🛡️ skipResponseSanitization | check-sanitizer-bypass.mjs |
| 7 | `code-quality/dedupe` | 📦 依赖碎片化 | check-dedupe.mjs |
| 8 | `code-quality/api-routes` | 🔗 前端↔后端路由一致性 | check-api-routes.mjs |
| 11 | `ui/rounded-full` | ⭕ 容器圆角违规 | check-rounded-full.mjs |
| 12 | `engineering/delivery-report` | 📋 交付报告一致性 | check-delivery-report-consistency.mjs |
| 13c | `engineering/project-plan-archive` | 🗂️  PROJECT_PLAN.md 已完成任务防误删 | check-project-plan-archive.mjs |
| 15 | `engineering/migration-completeness` | 📊 迁移完整性(7 大类 29 子项) | check-api-migration-completeness.mjs |
| 17 | `ui/css-token-nesting` | 🎨 CSS 颜色 token 嵌套 | check-input-border-var.mjs |
| 18 | `ui/native-title-tooltip` | 🖱️  原生 title tooltip 违规 | check-native-title-tooltip.mjs |
| 20 | `ui/tailwind-class-conflict` | 🎯 Tailwind class 冲突 | check-tailwind-class-conflict.mjs |
| 24a | `ui/sidebar-width` | 📏 侧边栏宽度一致性 | check-sidebar-width-consistency.mjs |
| 25 | `workspace/external-paths` | 🧹 项目外路径违规(blocking) | check-workspace-hygiene.mjs |
| 26 | `workspace/parent-pollution` | 🛡️  项目父目录污染巡查(blocking) | check-parent-pollution.mjs |
| 27 | `ui/z-index` | 🛡️  z-index 层叠防护(防 TRAE 注入 + 遮罩 fade-in 回归) | check-z-index-guard.mjs |
| 28 | `ui/overlay-zindex` | 🛡️  全屏遮罩 z-index 层级(防 fixed inset-0 + z-50 复发) | check-overlay-zindex.mjs |
| 29 | `push/sync` | 🚀 Push 同步兜底(防"commit 后忘记 push"复发,AGENTS.md §21 第三道防线) | check-push-sync.mjs |
| 30 | `i18n/integrity` | 🛡️ i18n 文件完整性(防 prettier 截断事故复发) | validate-i18n-integrity.mjs |
| 30a | `commit-loss/guard` | 🛡️  Commit 丢失防护(blocking,AGENTS.md §22,防 reset / drop stash 误丢 commit) | check-commit-loss-guard.mjs |
| 35 | `code-quality/mypy` | 🐍 mypy 类型检查(防 ai-service Python 类型回退) | check-mypy.mjs |
| 36 | `ui/design-tokens-miniapp-taro` | 🎨 [miniapp-taro] design-tokens 同步(防 app.css 漂移) | check-miniapp-tokens-sync.mjs |
| 37 | `ui/design-tokens-web` | 🎨 [web] design-tokens 同步(防 globals.css 漂移) | check-web-tokens-sync.mjs |
| 38 | `dependencies/solito-residue` | 🛡️  solito 幽灵依赖回归守门(blocking,防 P0 优化被回退) | check-solito-residue.mjs |
| 2d | `i18n/ja-residue-web` | 🔍 ja.json 中文残留(warn-only) | scan-i18n-zh-residue.mjs |
| 2f-ext | `i18n/parity-extension` | 🌐 [extension] i18n 键完整性(warn-only) | check-i18n-keys.mjs |
| 2f-shared | `i18n/parity-shared` | 🌐 [shared] i18n 键完整性(blocking,零变更验证通过) | check-i18n-keys.mjs |
| 2g-ext | `i18n/zh-tw-residue-extension` | 🔍 [extension] zh-TW 简体字残留(warn-only) | scan-i18n-zh-residue.mjs |
| 2h-ext | `i18n/ko-residue-extension` | 🔍 [extension] ko.json 中文残留(warn-only) | scan-i18n-zh-residue.mjs |
| 2i-ext | `i18n/en-broken-extension` | 🔍 [extension] en.json 破碎英文(warn-only) | check-i18n-broken-en.mjs |
| 2j-shared | `i18n/zh-tw-residue-shared` | 🔍 [shared] zh-TW 简体字残留(blocking) | scan-i18n-zh-residue.mjs |
| 2k-shared | `i18n/ko-residue-shared` | 🔍 [shared] ko.json 中文残留(blocking) | scan-i18n-zh-residue.mjs |
| 2l-shared | `i18n/ja-residue-shared` | 🔍 [shared] ja.json 中文残留(warn-only) | scan-i18n-zh-residue.mjs |
| 2m-shared | `i18n/en-broken-shared` | 🔍 [shared] en.json 破碎英文(blocking) | check-i18n-broken-en.mjs |
| 2f-shared-diff | `i18n/pipeline-shared` | 🌐 [shared] i18n AI 翻译流水线(blocking) | i18n-diff.mjs |
| 2n-web | `i18n/parity-web-strict` | 🌐 [web] 5 语言 i18n parity 强制校验 (blocking,2026-08-02 升级,兜底 item 2 漏检场景) | check-i18n-keys.mjs |
| 2f-mobile-rn | `i18n/parity-mobile-rn` | 🌐 mobile-rn i18n parity 守门(warn-only 起步,2026-07-28 立) | check-i18n-keys.mjs |
| 2f-cli | `i18n/parity-cli` | 🌐 cli i18n parity 守门(warn-only,2026-07-28 立) | check-cli-i18n-parity.mjs |
| 9 | `code-quality/safe-parse` | 🔍 safeParse 静默忽略(blocking,2026-07-26 升级) | check-safe-parse.mjs |
| 13b | `engineering/project-plan-size` | 📐 PROJECT_PLAN.md 体积(warn-only) | check-project-plan-size.mjs |
| 19 | `engineering/staged-pollution` | ⚠️  staged 污染预警(warn-only) | check-staged-pollution.mjs |
| 21 | `engineering/multi-end-sync` | 🌐 多端同步开发守门(warn-only) | check-multi-end-sync.mjs |
| 22 | `engineering/readme-sync` | 📖 README 同步守门(warn-only) | check-readme-sync.mjs |
| 24b | `engineering/port-registry` | 🔌 端口注册表守门(warn-only) | check-port-registry.mjs |
| 31 | `ui/auth-shell-shared` | 🛡️  AuthShell 共享实现静态守门(warn-only,防 web/extension 视觉漂移) | verify-auth-shell.mjs |
| 34 | `code-quality/ts-ignore` | 🔍 @ts-ignore 新增检测(warn-only,防 215 处历史遗留复发) | check-ts-ignore.mjs |
| 33 | `llm/provider-schema` | 🛡️  LLM provider schema 守门 (blocking,阶段 3 主体已落地) | check-llm-provider-schema.mjs |
| 10 | `code-quality/openapi-info` | 📋 OpenAPI spec(informational) | openapi-check.mjs |
| 23 | `engineering/staged-files-info` | 📋 staged 文件清单(info) | check-staged-files.mjs |

### 3.4 迁移建议

1. **过渡期（1-2 个月）**：guardian-runner.mjs 增加 `semanticId` 字段，与 `id` 并存；日志/onFailHint 同时输出两个 ID
2. **文档同步**：AGENTS.md §"守门脚本速查" / docs/GATEKEEPERS.md / 各 check-*.mjs 输出全部改用 semanticId
3. **完成迁移**：删除数字 `id` 字段，所有引用改为 `semanticId`
4. **影响范围**：guardian-runner.mjs / .husky/pre-commit / AGENTS.md / docs/GATEKEEPERS.md / 各 check-*.mjs 脚本输出

### 3.5 重构收益

- 新增守门项无需查表找编号，直接按主题命名
- 日志/CI 输出更易读（`[i18n/parity-web]` 比 `[2n-web]` 直观）
- 与 AGENTS.md §"守门脚本速查"分类完全对齐
- 便于按分类过滤执行（如 `guardian-runner --filter 'i18n/*'`）

---

## 4. P3-C: 文档自动化机制说明

### 4.1 脚本用法

```bash
# 生成（覆盖）docs/guardian-reference.md
pnpm guardian:docs

# 等价于
node scripts/generate-guardian-docs.mjs

# 仅校验文档是否最新（CI 用，过期则 exit 1）
node scripts/generate-guardian-docs.mjs --check

# 打印帮助
node scripts/generate-guardian-docs.mjs --help
```

### 4.2 工作原理

1. 读取 `scripts/guardian-runner.mjs` 源码
2. 字符级解析 `const checks = [...]` 数组（字符串/注释感知，避免误匹配）
3. 对每个 check 对象提取 `id` / `label` / `script` / `args` / `mode` / `onFailHint`
4. 同时提取对象前的 `//` 注释块（包含升级评估、设计原因等上下文）
5. 与内置的 `UPGRADE_TIMELINE`（升级时间表）和 `NAMESPACE_MAP`（命名空间映射）合并
6. 渲染 Markdown 模板，写入 `docs/guardian-reference.md`

### 4.3 CI 集成建议

| 场景 | 命令 | 失败行为 |
|------|------|----------|
| PR 检查 | `pnpm guardian:docs -- --check` | 文档过期则 CI fail，提示重新生成 |
| Pre-commit（可选） | `node scripts/generate-guardian-docs.mjs --check` | staged 含 guardian-runner.mjs 但 docs 未更新时 warn |
| 文档生成 | `pnpm guardian:docs` | 自动覆盖，无需人工编辑 |

**推荐集成位置**：CI 流水线在 lint/typecheck 之后加一步 `pnpm guardian:docs -- --check`，确保文档与代码同步。

### 4.4 维护规则

- **禁止手工编辑** `docs/guardian-reference.md`（会被下次生成覆盖）
- **修改 guardian-runner.mjs** 后必须运行 `pnpm guardian:docs` 重新生成
- **新增守门项** 时同步在脚本的 `UPGRADE_TIMELINE` 和 `NAMESPACE_MAP` 配置中添加条目
- **升级 mode**（warn → blocking）后需同步更新 `UPGRADE_TIMELINE` 配置（删除该 ID 条目，因它已不在 warn 列表）

### 4.5 局限性

- 升级时间表（`UPGRADE_TIMELINE`）和命名空间映射（`NAMESPACE_MAP`）是手工维护的配置表，无法从代码自动推导
- 解析器是字符级状态机，假设 guardian-runner.mjs 的 checks 数组语法规范（无嵌套对象、无 spread 操作符、无动态字段）
- 字符串内转义引号场景未处理（当前 guardian-runner.mjs 无此情况，未来如有需更新解析器）
- onFailHint 中的多行字符串在 §1 表格中只显示"有/无"，完整内容在 §1.4

---

*本文档由 `scripts/generate-guardian-docs.mjs` 自动生成，禁止手工编辑。*
