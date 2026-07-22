# 守门规则详解(Gatekeepers)

> IHUI-AI pre-commit / commit-msg / post-commit / pre-push 四阶段守门体系全解:25 个守门脚本的工作原理、失败排查与跳过策略。守门脚本速查表见 [AGENTS.md 守门脚本速查](../AGENTS.md),本文档聚焦每个脚本的检测逻辑与实操,不重复速查表。

---

## 1. 总览

IHUI-AI 通过 Husky git hooks 在 4 个阶段部署自动守门,从 commit 到 push 全链路防止问题进仓库或上远端。

| 阶段 | 钩子文件 | 职责 | 守门数 |
|------|----------|------|--------|
| pre-commit | `.husky/pre-commit` | 25 个 `.mjs` 脚本 + lint-staged + 条件 typecheck/build | 25 项 |
| commit-msg | `.husky/commit-msg` | commit message 规范 + `Verified-DOM:` trailer 校验 | 2 项 |
| post-commit | `.husky/post-commit` | 自动 push + 验证 local == remote(§21) | 1 项 |
| pre-push | `.husky/pre-push` | 全量 typecheck 闸门(清 `.tsbuildinfo` 缓存) | 1 项 |

**设计哲学**:把 [AGENTS.md](../AGENTS.md) 的强制规则从人工自觉变成机制守门,agent 单端改动时强制显式声明,否则 warn 提醒或阻塞 commit。

---

## 2. 钩子架构

### 2.1 pre-commit 流程

`.husky/pre-commit` 是跨平台 Node.js 脚本(Windows 兼容),按编号顺序执行 25 项检查。任一**阻塞项**(exit 1)即终止提交;**warn-only / info-only** 项只打印不阻塞。

```
git commit
  └─ .husky/pre-commit
       ├─ 1  check-api-key-leak        (阻塞)
       ├─ 2  check-i18n-keys           (阻塞)
       ├─ 2b scan-i18n-zh-residue zh-TW (阻塞)
       ├─ 2c scan-i18n-zh-residue ko   (阻塞)
       ├─ 2d scan-i18n-zh-residue ja   (warn-only)
       ├─ 2e check-i18n-broken-en      (阻塞)
       ├─ 3  check-db-schema-drift     (阻塞)
       ├─ 4  check-stale-dist          (阻塞)
       ├─ 4b check-dist-encoding       (阻塞)
       ├─ 4c check-api-client-utf8     (阻塞)
       ├─ 5  lint-staged               (阻塞,eslint+prettier)
       ├─ 6  check-sanitizer-bypass    (阻塞)
       ├─ 7  check-dedupe              (阻塞)
       ├─ 8  check-api-routes          (阻塞)
       ├─ 9  check-safe-parse          (warn-only)
       ├─ 10 openapi-check             (informational)
       ├─ 11 check-rounded-full        (阻塞)
       ├─ 12 check-delivery-report     (阻塞)
       ├─ 13b check-project-plan-size  (阻塞,<50KB)
       ├─ 13c check-project-plan-archive (阻塞,防误删)
       ├─ 15 check-api-migration       (阻塞)
       ├─ 17 check-input-border-var    (阻塞)
       ├─ 18 check-native-title-tooltip (阻塞)
       ├─ 19 check-staged-pollution    (warn-only)
       ├─ 20 check-tailwind-class-conflict (阻塞)
       ├─ 21 check-multi-end-sync      (warn-only)
       ├─ 22 check-readme-sync         (warn-only)
       ├─ 24 check-sidebar-width       (阻塞)
       ├─ 23 check-staged-files        (info-only)
       ├─ 24 check-port-registry       (warn-only)
       ├─ 16 条件 typecheck (apps/web staged)
       └─ 16b 条件 database build (packages/database/src staged)
```

### 2.2 commit-msg 流程

`.husky/commit-msg` 校验:
- commit message 规范(`feat`/`fix`/`docs`/`chore`/`test`/`refactor` 前缀,见 [AGENTS.md §1](../AGENTS.md))
- `Verified-DOM:` trailer:若 staged 含 `apps/web/**/*.css` 改动,必须附 `Verified-DOM: http://localhost:3000/<path> (<DOM 属性=数值> ...)` trailer(由 commit-msg hook 自动守门,见 [AGENTS.md §17](../AGENTS.md))

### 2.3 post-commit 流程

`.husky/post-commit` 在 Git LFS post-commit 之后调用 `node scripts/git-push-guard.mjs`:
- 检测本地 ahead → 自动 push → 验证 local == remote
- 跳过:`HUSKY_SKIP_PUSH=1 git commit`(紧急本地暂存,不推荐)

### 2.4 pre-push 流程

`.husky/pre-push` 在 Git LFS pre-push 之后跑全量 typecheck:
- 清 `.tsbuildinfo` 缓存后跑 `pnpm typecheck:full`(防止缓存假象)
- 工作区有未提交改动时打印明确指引(3 个选项)
- 跳过:`HUSKY_SKIP_TYPECHECK=1 git push`(紧急 push,不推荐)

---

## 3. 守门脚本分类详解

> 编号对应 `.husky/pre-commit` 中的执行顺序。每项说明:用途 / 检测什么 / 失败原因 / 修复方法 / 跳过方式 / 阻塞 vs warn。

### 第 1 项 check-api-key-leak.mjs(阻塞)

| 维度 | 说明 |
|------|------|
| 用途 | 防止 API key / secret 泄露进仓库 |
| 检测 | staged 文件中匹配常见 key 模式(`sk-`、`AKIA`、`ghp_`、`xoxb-`、`Bearer ` 等) |
| 失败原因 | 检测到疑似密钥字符串 |
| 修复 | 从代码移除密钥,改用环境变量;若为误报,在文件顶部加 `// allow-key-mention` 注释 |
| 跳过 | `--no-verify`(不推荐) |
| 模式 | `--staged`(pre-commit)/ 全量扫描 |

### 第 2 项 check-i18n-keys.mjs(阻塞)

详见 [I18N.md §5.3](./I18N.md)。以 zh-CN 为基准检测 5 语言 key parity,`--staged` 模式 exit 1 阻塞。

### 第 2b 项 scan-i18n-zh-residue.mjs zh-TW(阻塞)

详见 [I18N.md §5.1](./I18N.md)。opencc-js 简→繁字形转换检测 zh-TW.json 简体字残留,`converted !== value` 即 exit 1。

### 第 2c 项 scan-i18n-zh-residue.mjs ko(阻塞)

详见 [I18N.md §5.1](./I18N.md)。字符范围检测 ko.json 中文残留(value 含汉字且不含 Hangul → exit 1)。

### 第 2d 项 scan-i18n-zh-residue.mjs ja(warn-only)

详见 [I18N.md §5.1](./I18N.md)。日文汉字词假阳性海量,所有汉字只 warn 不阻塞,始终 exit 0。

### 第 2e 项 check-i18n-broken-en.mjs(阻塞)

详见 [I18N.md §5.2](./I18N.md)。检测 en.json 破碎机翻英文(`no-space-concat`/`case-chaos`/`possible-pinyin`/`zh-residue`)。

### 第 3 项 check-db-schema-drift.mjs(阻塞)

| 维度 | 说明 |
|------|------|
| 用途 | 防止 Drizzle TS schema 表名与 migration SQL 表名漂移 |
| 检测 | 对比 `packages/database/src/schema/*.ts` 的表名与 `packages/database/drizzle/*.sql` 的 `CREATE TABLE` 表名 |
| 失败原因 | schema 新增表但未生成 migration,或 migration 改表名但 schema 未同步 |
| 修复 | `pnpm --filter @ihui/database drizzle-kit generate` 生成新 migration |
| 跳过 | `--no-verify`(不推荐) |

### 第 4 项 check-stale-dist.mjs(阻塞)

| 维度 | 说明 |
|------|------|
| 用途 | 防止 `packages/*/dist` 陈旧导致 `module not found` |
| 检测 | 对比 `packages/*/src` 的 export 与 `packages/*/dist` 的实际 export |
| 失败原因 | src 新增 export 但 dist 未重建 |
| 修复 | `pnpm --filter <package> build` 重建 dist |
| 跳过 | `--no-verify`(不推荐) |

### 第 4b 项 check-dist-encoding.mjs(阻塞)

| 维度 | 说明 |
|------|------|
| 用途 | 防止 `packages/*/dist` 文件含 UTF-16 LE BOM 导致 Turbopack 解析失败 |
| 检测 | 扫描 `packages/*/dist/**` 下 `.js/.mjs/.cjs/.ts/.map` 文件前 3 字节 |
| 失败原因 | PowerShell `WriteAllText` 默认 UTF-16 LE BOM 编码(2026-07-19 admin-auth.js 踩坑) |
| 修复 | 用 `fs.writeFileSync(path, content, 'utf8')` 重写,或 `pnpm --filter <package> build` 重建 |
| 立规依据 | 2026-07-19 admin-auth.js 踩坑落地 |

### 第 4c 项 check-api-client-utf8.mjs(阻塞)

| 维度 | 说明 |
|------|------|
| 用途 | 防止 `packages/api-client/src/endpoints/*.ts` 字节级 UTF-8 损坏 |
| 检测 | 扫描 `src/endpoints/*.ts` 字节序列,检测非法 UTF-8 continuation bytes |
| 失败原因 | 中文注释字符级丢失(如"内容 *"丢失换行符导致 source map vlq 异常,Turbopack rope 合并时 `invalid utf-8 sequence` build 失败) |
| 修复 | 重新从 git 历史恢复文件,或手动修复损坏字节 |
| 立规依据 | 2026-07-19 share.ts 损坏踩坑落地 |

### 第 5 项 lint-staged(阻塞)

| 维度 | 说明 |
|------|------|
| 用途 | 对暂存文件运行 eslint --fix 和 prettier --write |
| 检测 | ESLint 规则违规 + Prettier 格式不一致 |
| 失败原因 | 代码风格 / lint 错误 |
| 修复 | 按 eslint 输出修复,或 `npx eslint --fix <file>` |
| 配置 | `lint-staged` 字段在根 `package.json` |

### 第 6 项 check-sanitizer-bypass.mjs(阻塞)

| 维度 | 说明 |
|------|------|
| 用途 | 防止 `skipResponseSanitization` 被滥用导致 token 被脱敏为 `***` |
| 检测 | staged 文件中 `skipResponseSanitization: true` 的使用 |
| 失败原因 | 新增 `skipResponseSanitization` 未在白名单 |
| 修复 | 移除不必要的 sanitizer bypass,或加白名单(需 review) |

### 第 7 项 check-dedupe.mjs(阻塞)

| 维度 | 说明 |
|------|------|
| 用途 | 防止依赖版本碎片化(同一依赖多个版本) |
| 检测 | `pnpm-lock.yaml` 变更时检查重复依赖 |
| 失败原因 | 新增依赖引入与现有版本不兼容的重复 |
| 修复 | `pnpm dedupe` 或统一版本 |
| 模式 | `--staged`(仅 `pnpm-lock.yaml` 变更时触发) |

### 第 8 项 check-api-routes.mjs(阻塞)

| 维度 | 说明 |
|------|------|
| 用途 | 前端 ↔ 后端路由一致性(strict,0 缺失) |
| 检测 | 前端 `src/lib/*-api.ts` 调用的端点必须在后端 `apps/api/src/routes/*.ts` 注册 |
| 失败原因 | 前端调用了后端不存在的端点 |
| 修复 | 在后端补注册路由,或修正前端调用路径 |

### 第 9 项 check-safe-parse.mjs(warn-only)

| 维度 | 说明 |
|------|------|
| 用途 | 巡检 `safeParse` 静默忽略错误(Zod `.safeParse()` 后 `if (!success) return null`) |
| 检测 | 全量扫描 `safeParse` 调用,标记静默忽略的风险点 |
| 失败原因 | 无(始终 exit 0,只打印风险点) |
| 修复 | 建议:静默忽略改为 `throw new AppError()` 或日志记录 |

### 第 10 项 openapi-check.mjs(informational)

| 维度 | 说明 |
|------|------|
| 用途 | OpenAPI spec 存在性检查 |
| 检测 | `apps/api` 的 OpenAPI spec 文件是否存在 |
| 失败原因 | 无(始终 exit 0,info-only) |

### 第 11 项 check-rounded-full.mjs(阻塞)

| 维度 | 说明 |
|------|------|
| 用途 | 容器圆角守门,禁止 `rounded-full`/`rounded-pill`/`9999px`/`50%` 用于容器 |
| 检测 | staged 的 `.ts/.tsx/.js/.jsx/.css/.scss` 文件匹配违规模式 |
| 失败原因 | 容器(卡片/面板/按钮/输入框等)用了纯圆 / 胶囊圆角 |
| 修复 | 改用规范圆角档位:`rounded-sm`(2px)/`rounded`(4px)/`rounded-md`(6px)/`rounded-lg`(8px)/`rounded-xl`(12px)/`rounded-2xl`(16px) |
| 豁免 | `<img>` 头像 / Switch Thumb / Radio / `<=14px` 装饰点 / 红点底 / `animate-spin` |
| 详见 | [UI_GUIDELINES.md §3](./UI_GUIDELINES.md) |

### 第 12 项 check-delivery-report-consistency.mjs(阻塞)

| 维度 | 说明 |
|------|------|
| 用途 | 交付报告一致性,防止"无后续建议"与"P1-P5/TODO"在同一份 `.md` 报告同时出现 |
| 检测 | staged 的 `.md` 文件含新增行(+)的章节,检查矛盾措辞 |
| 失败原因 | 报告同时声明"完整收尾"和"后续任务" |
| 修复 | 统一结论:要么"完整收尾无后续",要么列出 P1-P5 |
| 豁免 | 讨论 AGENTS.md §11 本身的章节 / 本守门脚本章节 |
| 立规依据 | [AGENTS.md §10](../AGENTS.md) |

### 第 13b 项 check-project-plan-size.mjs(阻塞)

| 维度 | 说明 |
|------|------|
| 用途 | 防止 `PROJECT_PLAN.md` 膨胀超过 50KB 导致 AI 上下文窗口撑爆 |
| 检测 | `PROJECT_PLAN.md` 文件体积 |
| 失败原因 | 体积 > 50KB(约 1250 行) |
| 修复 | 按 [AGENTS.md §1 归档精简规则](../AGENTS.md) 把已完成任务条目移到 `.trae-cn/archive/PROJECT_PLAN_YYYY-MM-DD.md` + 留 `<!-- 已归档 -->` 占位注释 |
| 阈值 | 50KB |

### 第 13c 项 check-project-plan-archive.mjs(阻塞)

| 维度 | 说明 |
|------|------|
| 用途 | 防止归档精简操作误删已完成任务条目 |
| 检测 | `### XXX(已完成 ✅ ...)` 标题行被删除时,diff 中必须有 `<!-- 已归档` 占位注释 |
| 失败原因 | 删除已完成任务条目但未留归档占位注释 |
| 修复 | 在原位置留 `<!-- 已归档(YYYY-MM-DD):XXX 任务,完整内容在 .trae-cn/archive/PROJECT_PLAN_*.md -->` |
| 立规依据 | [AGENTS.md §1 归档精简强制规则](../AGENTS.md),CLI 配置导入任务条目历史上被两次误删 |

### 第 15 项 check-api-migration-completeness.mjs(阻塞)

| 维度 | 说明 |
|------|------|
| 用途 | 迁移完整性守门(M-63 落地,7 大类 29 子项) |
| 检测 | `--staged` 模式:仅当 `PROJECT_PLAN.md` 被 staged 时强制审计报告存在性 |
| 失败原因 | oauth_private_keys/agent_billings 表回退 / agents.ts 8 端点回退 / 25 处 100% 声明无证据 |
| 修复 | 补齐迁移证据,或确认无需迁移 |

### 第 17 项 check-input-border-var.mjs(阻塞)

| 维度 | 说明 |
|------|------|
| 用途 | CSS 颜色 token 嵌套守门,防止 `hsl(var(--xxx))` / `rgb(var(--xxx))` 嵌套 |
| 检测 | staged 的 CSS/TSX 文件匹配嵌套模式 |
| 失败原因 | Tailwind v4 `@theme` 把 `--color-*` 序列化为 `hsl()`,外层包裹变成 `hsl(hsl(...))` 非法,被浏览器静默丢弃 |
| 修复 | 直接 `var(--color-*)` 引用;需要透明度用 `color-mix(in srgb, var(--xxx) 60%, transparent)` |
| 立规依据 | 2026-07-19 登录框描边样式回归落地 |

### 第 18 项 check-native-title-tooltip.mjs(阻塞)

| 维度 | 说明 |
|------|------|
| 用途 | 原生 title tooltip 守门,防止 HTML `title` 属性用于 hover 提示 |
| 检测 | `<Button title="...">` / `<button title="...">` / `<td|div|span|p|a|img title="...">` |
| 失败原因 | 用了原生 `title` 属性(浏览器原生样式与项目 `<Tooltip>` 不一致) |
| 修复 | 用 `packages/ui` 的 `<Tooltip>` 包裹 |
| 豁免 | `<Modal/Alert/StatCard>` 自带 title prop / `<Button asChild title>`(透传) / `<iframe title>`(a11y) |
| 立规依据 | 2026-07-20 hover 提示统一项目样式落地 |

### 第 19 项 check-staged-pollution.mjs(warn-only)

| 维度 | 说明 |
|------|------|
| 用途 | Staged 污染预警,防止多 agent 并行时误把其他 agent 改动一起 commit |
| 检测 | 启发式:staged > 10 文件 + 跨 ≥ 3 个一级子目录 → warn |
| 失败原因 | 无(始终 exit 0,只 warn) |
| 修复 | `git reset HEAD <file>` 取消暂存其他 agent 文件 |
| 配套 | `scripts/guard-push-other-agent-changes.mjs`(白名单模式,阻塞) |
| 立规依据 | [AGENTS.md §16](../AGENTS.md) 污染事故 |

### 第 20 项 check-tailwind-class-conflict.mjs(阻塞)

| 维度 | 说明 |
|------|------|
| 用途 | Tailwind class 冲突守门,防止 className 模板字面量 BASE/BRANCH 出现多套 size 类 |
| 检测 | `className={`base ${cond ? '' : 'other'}`}` 形式 + BASE/BRANCH `h-X`/`w-Y` 不一致 |
| 失败原因 | 后值覆盖前值,UI 实际渲染与设计意图脱节 |
| 修复 | 用 `cn()` 合并,或确保 BASE/BRANCH 不冲突 |
| 豁免 | 行内/上方一行 `// tailwind-class-conflict-allow` / 纯三元 / 纯字符串 / `cn()` 调用 |
| 立规依据 | 2026-07-21 M-64 修复同步立,PageIndicator `h-4/h-2` + `w-1.5/w-2` 冲突教训 |

### 第 21 项 check-multi-end-sync.mjs(warn-only)

| 维度 | 说明 |
|------|------|
| 用途 | 多端同步开发守门,检测 staged 文件跨端分布 |
| 检测 | 4 场景:纯豁免目录 pass / `packages/*` 未标注 warn / ≥2 端 pass / 1 端未标注 warn |
| 失败原因 | 无(始终 exit 0,只 warn) |
| 修复 | 在 `PROJECT_PLAN.md` 任务条目标注"平台独占"或"跨端:仅 X 端" |
| 立规依据 | [AGENTS.md §9](../AGENTS.md) 多端同步开发强制规则 |
| 详见 | [MULTI_END.md](./MULTI_END.md) |

### 第 22 项 check-readme-sync.mjs(warn-only)

| 维度 | 说明 |
|------|------|
| 用途 | README 同步守门,检测功能代码改动但 README 未更新 |
| 检测 | staged 中 `apps/*/src` 或 `packages/*/src` 功能代码改动但 `README.md` 未在 staged 中 |
| 失败原因 | 无(始终 exit 0,只 warn) |
| 修复 | 按 [AGENTS.md §22](../AGENTS.md) 同步更新 `README.md`,与本任务代码同 commit |
| 豁免 | bug 修复 / 重构 / 测试 / 配置 / 单端内部优化 / 文档 / 守门脚本本身 |
| 立规依据 | 2026-07-22 P3 深度层交付后 README 未同步教训 |

### 第 23 项 check-staged-files.mjs(info-only)

| 维度 | 说明 |
|------|------|
| 用途 | 打印 staged 文件清单,commit 前最后看一眼 |
| 检测 | 无检测,始终 exit 0 |
| 立规依据 | 与第 19 项互补:19 是跨端超阈值 warn,23 是无条件打印清单 |

### 第 24 项 check-sidebar-width-consistency.mjs(阻塞)

| 维度 | 说明 |
|------|------|
| 用途 | 侧边栏宽度一致性守门,防止 `design-tokens.css` 的 `--sidebar-width` 与 `sidebar.tsx` 的 `SIDEBAR_WIDTH` 不一致 |
| 检测 | 对比 CSS 变量值与 TS 常量值 |
| 失败原因 | 二者不一致,导致首屏 CSS 预设值 → JS useEffect 覆盖值的宽度跳变闪烁 |
| 修复 | 统一两者值 |
| 立规依据 | 2026-07-22 立,design-tokens.css 200px vs sidebar.tsx SIDEBAR_WIDTH=130 跳变教训 |

### 第 24 项(端口)check-port-registry.mjs(warn-only)

| 维度 | 说明 |
|------|------|
| 用途 | 端口注册表守门,检测 staged 文件中 `localhost:PORT` 引用 |
| 检测 | PORT 非 `88xx` → warn |
| 失败原因 | 无(始终 exit 0,只 warn) |
| 修复 | 按 [docs/port-management.md §3](./port-management.md) 端口分配规则使用 `88xx` |
| 豁免 | CI workflows / 测试默认值 / Docker 容器内部端口 / healthcheck / 第三方端口 |

### 第 16 项 条件 typecheck(阻塞,条件触发)

| 维度 | 说明 |
|------|------|
| 用途 | 防止"commit 通过但 push 失败"的循环 |
| 检测 | staged 文件涉及 `apps/web/` 时跑 `pnpm --filter @ihui/web run typecheck` |
| 失败原因 | apps/web typecheck 错误 |
| 修复 | 修复 TS 错误后再 commit |
| 立规依据 | f21dc473 commit 漏掉 import 的教训 |

### 第 16b 项 条件 database build(阻塞,条件触发)

| 维度 | 说明 |
|------|------|
| 用途 | 防止"schema 加字段但 dist 未重建导致运行时字段缺失" |
| 检测 | staged 文件涉及 `packages/database/src/` 时跑 `pnpm --filter @ihui/database build` |
| 失败原因 | database 包 build 失败(注意:typecheck 用 src 不报错,但 api 运行时用 dist 会字段缺失) |
| 修复 | 修复 schema 编译错误后 `pnpm --filter @ihui/database build` |
| 立规依据 | 0108 icon_svg 字段踩坑 |

---

## 4. post-commit git-push-guard.mjs

`scripts/git-push-guard.mjs` 是 [AGENTS.md §21](../AGENTS.md) 任务完成硬定义的核心防线,解决"commit 后忘记 push"协作事故。

### 工作原理

```
git commit 成功
  └─ .husky/post-commit
       ├─ git lfs post-commit
       └─ node scripts/git-push-guard.mjs
            ├─ 检测本地 ahead(git rev-list --count origin/<branch>..HEAD)
            ├─ 有 ahead → git push origin <branch>
            ├─ 验证 local HEAD == remote HEAD
            └─ 完全对齐 → exit 0 / 失败 → exit 1 阻断
```

### 跳过

```bash
HUSKY_SKIP_PUSH=1 git commit -m "..."   # 紧急本地暂存,不推荐,需手动 git push
```

### 手动验证(兜底)

```bash
node scripts/git-push-guard.mjs          # 任何时候手跑,打印 local vs remote HEAD
```

---

## 5. pre-push typecheck 闸门

`.husky/pre-push` 在 push 前跑全量 typecheck,防止 subagent 靠 `.tsbuildinfo` 缓存假象报"全绿"。

### 工作原理

```bash
# 清 .tsbuildinfo 缓存
# 串行全量 typecheck
pnpm typecheck:full
```

### 工作区检测优化

检测工作区是否干净,不干净时打印 3 个选项指引:
1. 先 commit/stash 工作区改动,再 push
2. `HUSKY_SKIP_TYPECHECK=1 git push` 跳过 typecheck(不推荐)
3. 修复 typecheck 错误后正常 push

> 不用 `git stash` 隔离方案:stash pop 在工作区被 lint-staged/IDE 修改后会冲突,风险高于收益。

### 跳过

```bash
HUSKY_SKIP_TYPECHECK=1 git push   # 紧急 push,不推荐
```

---

## 6. 跳过场景

### 6.1 `--no-verify` 合法 vs 非法

**合法场景**(见 [AGENTS.md §12/§16](../AGENTS.md)):
- pre-push / pre-commit hook 失败原因是**其他 agent 代码**(schema drift / 其他模块 TS/lint 错误 / 其他 agent 未完成 migration),不在本任务范围
- 本任务改动文件已通过 typecheck + lint + build 验证

**非法场景**:
- hook 失败原因是**本任务自己代码** → 必须修复后正常 commit,**禁止** `--no-verify` 跳过

### 6.2 各钩子跳过方式

| 钩子 | 跳过方式 | 说明 |
|------|----------|------|
| pre-commit | `git commit --no-verify` | 跳过全部 25 项守门 |
| commit-msg | `git commit --no-verify` | 跳过 message 校验 + Verified-DOM |
| post-commit | `HUSKY_SKIP_PUSH=1 git commit` | 跳过自动 push,commit 仅落地本地 |
| pre-push | `HUSKY_SKIP_TYPECHECK=1 git push` | 跳过全量 typecheck |

> `--no-verify` 不是流程事故,前提是本任务改动文件已通过 typecheck + lint + build 验证(见 [AGENTS.md §16](../AGENTS.md))。

---

## 7. 添加新守门脚本流程

新增守门脚本(如 `check-xxx.mjs`)需 3 步:

1. **写脚本**:`scripts/check-xxx.mjs`,遵循现有脚本风格(`#!/usr/bin/env node` + JSDoc 注释 + `--staged` 模式 + exit 0/1)

2. **注册到 `.husky/pre-commit`**:在对应编号位置插入:
```javascript
// NN. xxx 守门(YYYY-MM-DD 立)
// 用途说明
if (!run('🔍 检查 xxx...', 'node scripts/check-xxx.mjs --staged')) {
  process.exit(1)
}
```

3. **更新 [AGENTS.md 守门脚本速查表](../AGENTS.md)**:在表格中加一行,说明脚本用途

**约定**:
- 阻塞项用 `if (!run(...)) { process.exit(1) }`
- warn-only / info-only 项用 `run(...)`(不检查返回值)
- 编号沿用现有顺序,新增项追加末尾或填补空缺编号(如 14 已移除)

---

## 8. 常见失败排查

### 8.1 i18n 守门失败

| 症状 | 守门项 | 修复命令 |
|------|--------|----------|
| zh-TW 简体字残留 | 2b | `node scripts/fix-zh-tw-simp.mjs` |
| ko 中文残留 | 2c | `node scripts/translate-i18n-batch.mjs` + `apply-i18n-translations.mjs` |
| en 破碎机翻 | 2e | `node scripts/check-i18n-broken-en.mjs --fix`(看建议手动改) |
| key parity 缺失 | 2 | `node scripts/sync-i18n-fixes.mjs` 或手动补 key |

详见 [I18N.md §10 常见问题](./I18N.md)。

### 8.2 schema / dist 守门失败

| 症状 | 守门项 | 修复命令 |
|------|--------|----------|
| schema drift | 3 | `pnpm --filter @ihui/database drizzle-kit generate` |
| dist 陈旧 | 4 | `pnpm --filter <package> build` |
| dist UTF-16 BOM | 4b | `pnpm --filter <package> build`(重建) |
| api-client UTF-8 损坏 | 4c | `git checkout -- packages/api-client/src/endpoints/<file>` 恢复 |

### 8.3 UI 守门失败

| 症状 | 守门项 | 修复命令 |
|------|--------|----------|
| rounded-full 违规 | 11 | 改用规范圆角档位,详见 [UI_GUIDELINES.md §3](./UI_GUIDELINES.md) |
| 原生 title tooltip | 18 | 用 `<Tooltip>` 包裹替代 |
| CSS token 嵌套 | 17 | `hsl(var(--xxx))` → `var(--color-xxx)` |
| Tailwind class 冲突 | 20 | 用 `cn()` 合并或加 `// tailwind-class-conflict-allow` |

### 8.4 PROJECT_PLAN.md 守门失败

| 症状 | 守门项 | 修复命令 |
|------|--------|----------|
| 体积 > 50KB | 13b | 归档已完成任务到 `.trae-cn/archive/PROJECT_PLAN_YYYY-MM-DD.md` + 留占位注释 |
| 已完成任务被误删 | 13c | 在原位置留 `<!-- 已归档(YYYY-MM-DD):XXX 任务 -->` |

### 8.5 push 失败

| 症状 | 阶段 | 修复 |
|------|------|------|
| post-commit push 失败 | post-commit | `git push origin <branch>` 手动重推 |
| pre-push typecheck 失败 | pre-push | 修复 TS 错误后重 push,或 `HUSKY_SKIP_TYPECHECK=1 git push`(其他 agent 代码) |
| local != remote | git-push-guard | `node scripts/git-push-guard.mjs` 核查,`git pull --rebase` 后重 push |

---

## 相关文档

- [AGENTS.md 守门脚本速查](../AGENTS.md) — 23 项守门脚本速查表(本文档的索引)
- [AGENTS.md §21](../AGENTS.md) — 任务完成硬定义 / git-push-guard 5 条标准
- [AGENTS.md §12/§16](../AGENTS.md) — `--no-verify` 合法性边界
- [I18N.md](./I18N.md) — i18n 守门脚本(第 2/2b/2c/2d/2e 项)详解
- [UI_GUIDELINES.md](./UI_GUIDELINES.md) — UI 守门(第 11/17/18/20 项)详解
- [MULTI_END.md](./MULTI_END.md) — 多端同步守门(第 21 项)详解
