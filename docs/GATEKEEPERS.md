<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# 守门规则详解(Gatekeepers)

> IHUI-AI pre-commit / commit-msg / post-commit / pre-push 四阶段守门体系全解:各守门脚本的工作原理、失败排查与跳过策略。**门数与编号一律现读** —— `node scripts/guardian-runner.mjs --help` 的末行即权威现值(本文档刻意不钉数字 —— 连"今天有多少项"都不写:2026-09-21 那版写 29 项,当天晚些时候现读已是别的数,任何读数落地即开始腐烂,与本仓 §4 圆角门、§26 门编号漂移同型)。守门脚本速查表见 [AGENTS.md 守门脚本速查](../AGENTS.md),本文档聚焦每个脚本的检测逻辑与实操,不重复速查表。

---

## 1. 总览

IHUI-AI 通过 Husky git hooks 在 4 个阶段部署自动守门,从 commit 到 push 全链路防止问题进仓库或上远端。

| 阶段 | 钩子文件 | 职责 | 守门数 |
|------|----------|------|--------|
| pre-commit | `.husky/pre-commit` | 由 `scripts/guardian-runner.mjs` 调度 + lint-staged + 条件 typecheck/build | 现读 `--help` |
| commit-msg | `.husky/commit-msg` | commit message 规范 + `Verified-DOM:` trailer 校验 | 现读钩子文件 |
| post-commit | `.husky/post-commit` | 自动 push + 验证 local == remote(AGENTS §20) | 现读钩子文件 |
| pre-push | `.husky/pre-push` | 全量 typecheck 闸门(清 `.tsbuildinfo` 缓存)+ `guardian-runner --push-gate` | 现读 `--push-gate` |

**设计哲学**:把 [AGENTS.md](../AGENTS.md) 的强制规则从人工自觉变成机制守门,agent 单端改动时强制显式声明,否则 warn 提醒或阻塞 commit。

---

## 2. 钩子架构

### 2.1 pre-commit 流程

`.husky/pre-commit` 是跨平台 Node.js 脚本(Windows 兼容),按 runner 清单执行全部登记项(项数以 `node scripts/guardian-runner.mjs --help` 现读为准;本节旧版写死 "29 项",那是 2026-09-21 的读数,早已失真)。执行语义(2026-09-22 起):**跑完再汇总**,任一 blocking 失败不再中断本轮,末尾列失败门清单 + 单独复现命令后 exit 1(逃生舱 `GUARDIAN_STOP_ON_FIRST=1` 恢复旧的 fail-fast);**warn-only / info-only** 项只打印不阻塞。

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
       ├─ 11d check-no-divider         (阻塞,§4 分割线 divide-y/divide-x)
       ├─ 12 check-delivery-report     (阻塞)
       ├─ 13b check-project-plan-size  (warn-only,<50KB;runner mode:'warn' 现读)
       ├─ 13c (已退役 2026-10-16,2026-10-29 摘净:门体与镜像测试均已移除,本行不提供可跑命令)
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
- `Verified-DOM:` trailer:若 staged 含 `apps/web/**/*.css` 改动,必须附 `Verified-DOM: http://localhost:8801/<path> (<DOM 属性=数值> ...)` trailer(由 commit-msg hook 自动守门,见 [AGENTS.md §17](../AGENTS.md))

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

### 第 13b 项 check-project-plan-size.mjs(warn-only)

| 维度 | 说明 |
|------|------|
| 用途 | 防止 `PROJECT_PLAN.md` 膨胀超过 50KB 导致 AI 上下文窗口撑爆 |
| 检测 | `PROJECT_PLAN.md` 文件体积 |
| 失败原因 | 体积 > 50KB(约 1250 行) |
| 修复 | 按 [AGENTS.md §1「完成即删」](../AGENTS.md) 把已结清的登记行整行删除(不留档、不写归档件、不留 `<!-- 已归档 -->` 占位注释);出口器 `scripts/live-doc-edit.mjs` 的写盘闸默认把翻勾转成删行(回退档 `LIVE_KEEP_CLOSED_ROW=1`),同题重复行归并走 `node scripts/plan-tasks-merge.mjs --heal --commit` |
| 阈值 | 50KB |

### 第 13c 项 check-project-plan-archive.mjs(已退役 2026-10-16,2026-10-29 摘净)

| 维度 | 说明 |
|------|------|
| 用途 | 曾判"归档精简操作误删已完成任务条目";归档机制已于 2026-10-16 退役、2026-10-29 从 HEAD 摘净(门体、其镜像测试与自动归档器一并移除),不得恢复 |
| 检测 | 无检测面:`scripts/guardian-runner.mjs` 只有 13b 注册条目,13c 条目已随机制删除;本节因此不再列出任何可执行命令 |
| 失败原因 | 不适用 —— 未接线的门不可能判红;若提交链上再出现 13c,说明退役件被当"本机纯新增"回流,按 [AGENTS.md §1「归档机制(2026-10-16 退役,此行为留痕)」](../AGENTS.md) 处置(删除回流件,不恢复旧命令) |
| 修复 | 无修复动作可执行。现行口径 = 结清即整行删除,不留档、不归档、不写占位注释;防误删那一维由守门 71 `scripts/check-plan-line-loss.mjs` 承接(未勾登记行照旧拦,已勾行出保护集、删之合法) |
| 立规依据 | [AGENTS.md §1「完成即删」](../AGENTS.md);历史残余见 tag `backup/archive-removal-2026-10-16`,旧口径逐字底稿见 `.ihui-agent/archive/AGENTS_trim-2026-10-28.md` |

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
| 用途 | README 对外能力同步守门:窗口内新增的对外能力,逐条问 `README.md` 有没有描述 |
| 检测 | 窗口起点 = 「`README.md` 最后一次被提交」与「滚动回看点(默认 -7d)」里**更旧**的一枚 ⇒ 取该窗口内新增的对外能力(后端端点走守门 8 的唯一提取式 `lib/route-registration-extract.mjs`;web 页面走 App Router `page.tsx`),逐条在 README 面找**路径身份**;三态:已覆盖 / 未判定(别称·写法不同)/ 未描述。2026-10-23 重做——旧判据只看 `git diff --cached` 且"README 在改动集里就 return 0",历史欠账结构上审不到 |
| 失败原因 | 现测「未描述」**超出棘轮额度**(`scripts/readme-sync-baseline.json`,现 125 枚)⇒ exit 1;基线件读不懂 / 取不到被审面 / 锚点解不出 ⇒ exit 2 未判定。warn 档,**不阻塞提交**(§12e:存量未清不许上 blocking) |
| 修复 | 按 `--json` 的 `gaps[]` 在 README 对应能力段补路径身份(如 `/api/goods/select`);清一批后跑 `--update-baseline` 把额度压下去(**只许降,抬不动**),额度归零才谈升 blocking |
| 豁免 | 纯内部重构 / 修复 / 测试 / 配置 / 文档 / 守门脚本本身。本门只验"路径身份出现过",§21 要求的功能说明 / 使用方式 / 所属端仍需人写,不得据本门全绿断言 README 已达标 |
| 立规依据 | [AGENTS.md §21](../AGENTS.md) 功能开发同步更新 README 规则 |

### 第 23 项 check-staged-files.mjs(info-only)

| 维度 | 说明 |
|------|------|
| 用途 | 打印 staged 文件清单,commit 前最后看一眼 |
| 检测 | 无检测,始终 exit 0 |
| 立规依据 | 与第 19 项互补:19 是跨端超阈值 warn,23 是无条件打印清单 |

### 第 24a 项 check-sidebar-width-consistency.mjs(阻塞)

| 维度 | 说明 |
|------|------|
| 用途 | 侧边栏宽度一致性守门,三源 × 双宽度:① `tokens.css` 的 `--sidebar-width` ↔ `sidebar.tsx` 的 `SIDEBAR_WIDTH`;② `tokens.css` 的 `--sidebar-collapsed-width` ↔ `sidebar.tsx` 的 `SIDEBAR_COLLAPSED_WIDTH`;③ `token-registry.ts` 注册表 defaultValue ↔ `tokens.css`(须从仓库根运行) |
| 检测 | 正则提取三源数值并交叉对比,任一不一致即 exit 1 |
| 失败原因 | 多源漂移:展开宽度不一致导致首屏 CSS 预设值 → JS useEffect 覆盖值的宽度跳变闪烁;折叠宽度/注册表漂移虽可能暂无 `var()` 引用点,但一旦被引用即引入错误尺寸 |
| 修复 | 统一三源值;改 `token-registry.ts` 后需 `npm run build`(packages/design-tokens)同步 dist |
| 立规依据 | 2026-07-22 立(design-tokens.css 200px vs sidebar.tsx 130px 跳变教训);2026-09-09 扩展(--sidebar-collapsed-width 漂移 54px vs 60 长期未被发现,旧守门只查展开宽度单源单值) |

### 第 24b 项 check-port-registry.mjs(warn-only)

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
| pre-commit | `git commit --no-verify` | 跳过提交链上**全部**登记门(项数现读;这就是本仓反复写"一道恒红门 = 全部守门作废"的原因) |
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
| 体积 > 50KB | 13b(warn-only) | 按 [AGENTS.md §1「完成即删」](../AGENTS.md) 把已结清登记行整行删除(默认出口器 `scripts/live-doc-edit.mjs`;归并走 `node scripts/plan-tasks-merge.mjs --heal --commit`)。归档机制已于 2026-10-16 退役 ⇒ 不再写 `.ihui-agent/archive/`、不留占位注释 |
| 已完成任务被误删 | 13c(已退役 2026-10-16,2026-10-29 摘净) | 该档已无守门(门体与镜像测试均已移除,不得恢复)。防误删现由 §1「完成即删」+ 门 71 `check-plan-line-loss.mjs`(未勾行保护)+ 门 229 `check-plan-closed-stock.mjs`(跨枚滞留)承担 |

### 8.5 push 失败

| 症状 | 阶段 | 修复 |
|------|------|------|
| post-commit push 失败 | post-commit | `git push origin <branch>` 手动重推 |
| pre-push typecheck 失败 | pre-push | 修复 TS 错误后重 push,或 `HUSKY_SKIP_TYPECHECK=1 git push`(其他 agent 代码) |
| local != remote | git-push-guard | 先 `node scripts/git-push-converge.mjs`(只读六态);真分叉再 `node scripts/git-sync-converge.mjs`(索引层合并,零触碰他人未提交文件;禁止 rebase) |

---

## 9. 巡检腿与常驻器物(不进提交链,§12e)

这些器物判的是**机器状态**或**派生产物新旧**,提交者结构上满足不了 ⇒ 一律不进 pre-commit / CI,挂在 `scripts/git-guardian.mjs` 的巡检轮或根 `package.json`。节流与超时以 guardian 里的常量现值为准。

| 器物 | 干什么 | 怎么手动跑 |
| --- | --- | --- |
| `scripts/heal-derived-in-checkout.mjs` | 派生产物(小程序离线语言包 / 四端 ui-routes)陈旧时**按被审面重生成并复量后才落 HEAD**(唯一落地接缝:blob 走对象空间 CAS,不写工作树) | `--family i18n|ui-routes [--json] [--dry-run|--check]` |
| `scripts/lib/derived-copy-state.mjs` | 判"盘上那份派生件能不能覆盖"的四态尺(equal / 滞后副本 / 未入库生成物 / 在飞),取不到凭据一律算在飞 | 被上面那枚 import |
| `scripts/lib/land-derived-blobs.mjs` | 派生件落地契约:`LAND_PATHS` 用 `;` 分隔、`LAND_BLOBS` 是 40 位 oid 清单、成功判据是"CAS 成功/回读"而非退出码 | 被上面那枚 import |
| `scripts/lib/push-divergence-watch.mjs` | 本地↔origin/main 真分叉的到人报警(三态 ok/breach/unjudged,身份 = 分档+持续档,不塞会抖的计数) | `--status` |
| `scripts/lib/i18n-bundle-inputs.mjs` | 离线包钉输入清单的**唯一构造规则**(生成器与守门 105 共用;加/减一层只改这一处) | 被两侧 import |
| `scripts/check-mirror-purge-intact.mjs --fix` | 守门 238 的修复出口(在飞副本闸 + 量级闸;拒绝时不猜) | `--fix [--staged] [--dry-run]` |

四个巡检腿(全在 `git-guardian.mjs`,全部判机器状态 ⇒ 不进提交链):

- `healI18nBundleLeg` / `healUiRoutesLeg` —— 上面那枚自愈器的调度器。离线包一族在主仓按面生成(实测整轮 2m51s,其中生成 12s),ui-routes 一族才建检出。
- `auditPushDivergenceLeg` —— 分叉到人。
- `healMirrorPurgeLeg` —— 守门 238 回潮通道的兜底。

**为什么生成器能跑进秒级**(2026-10-27 实测):闭包解析对每条说明符按 TS 惯例探 9 个候选路径,绝大多数**本来就不存在**;此前每个不存在的候选都起一个 git 进程(一轮约 8 万次 ⇒ 59 分 23 秒),现在一次 `ls-tree` 读满被审面整棵树 + 存在性全集短路,同一轮 **11.756s**。判据:`node scripts/gen-i18n-compressed.mjs --head` 的输出末行与守门 105 的「离线包自述钉:matched」要同时成立。

---

## 相关文档

- [AGENTS.md 守门脚本速查](../AGENTS.md) — 守门脚本速查表(本文档的索引;项数与编号同样以 runner 现值为准)
- [AGENTS.md §21](../AGENTS.md) — 任务完成硬定义 / git-push-guard 5 条标准
- [AGENTS.md §12/§16](../AGENTS.md) — `--no-verify` 合法性边界
- [I18N.md](./I18N.md) — i18n 守门脚本(第 2/2b/2c/2d/2e 项)详解
- [UI_GUIDELINES.md](./UI_GUIDELINES.md) — UI 守门(第 11/17/18/20 项)详解
- [MULTI_END.md](./MULTI_END.md) — 多端同步守门(第 21 项)详解
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->

## 10. 守门脚本速查(自 AGENTS.md 迁入 2026-11-04)

> **出处与效力**:本节逐字迁自 `AGENTS.md` 的「## 守门脚本速查(压缩索引)」整节(2026-11-04,门 207 体积 96000B 硬顶;迁出不是删除,原文一字未改)。
> AGENTS.md 该节只留指针 + 三条不迁的硬约束(门 89 R4 / runner 现值唯一源 / immutable-exempt trailer);两处若有出入,**以本节原文为准**。
> `mode/blocking/skipEnv/编号` 仍以 `scripts/guardian-runner.mjs` 现值为准(§0.1),本文不复制第二份。

## 守门脚本速查(压缩索引)
- **横向口径**(适用于绝大多数内容门,勿逐门重抄):全量判 HEAD blob / `--staged` 判索引 blob / `--worktree` 仅人工;两面旗同给 exit 2;取不到判「无法判定」不回落;枚举到 0 判死;棘轮锚点 = 该文件 HEAD 自身违规数;行内豁免须带原因且多登记守门 108 存活期表;取证 = `--self-test` + §22c 镜像测试,例数现读;遮罩统一引 `scripts/lib/code-mask.mjs`,方向分两档(判字面量的门只遮注释,判代码结构的门注释与字符串都遮)。
- **门名点名索引 + 常驻工具清单**:整体迁 `README.md` 同名节与末段(R4 文档面含 README,不重复抄;原文 `.ihui-agent/archive/AGENTS_trim-2026-10-25b.md`)。
- tracked-but-ignored: `check-tracked-ignored.mjs`(236,blocking,只拦本次**新增**的 gitignored 路径;存量只报数;跳过 `HUSKY_SKIP_TRACKED_IGNORED`)
- **判据面不可变护栏(2026-10-30 接线)**:`check-immutable-guard.mjs` 判「判据面(门体 / `scripts/lib` / 豁免台账 / guardian-runner / AGENTS.md)被改动而提交信息无 `immutable-exempt: <≥10 字理由>`」;判据顺序单源 = `scripts/lib/immutable-guard.mjs` 的 `decide`,清单单源 = `scripts/data/immutable-guard.json`(坏/空/取不到 ⇒ exit 2,`reviewBy` 到期 ⇒ 红)。唯一调度器 = `git-guardian.mjs` 的 `auditImmutableGuardNewCommits()`;不进**守门批**(执行器无条件追加 `--staged`,那里结构上拿不到提交信息 ⇒ exit 2 ⇒ 恒堵门,§12e),但 `.husky/commit-msg` 2026-11-04 起另挂一档 `--staged --message-file "$1"` **只报不拦**的预警——目的是在"还改得动"时报,而非等 push 门才发现(那时只能由持钥方追认台账),判红经到人通道按稳定身份去重(§5e-3)。
- **教训候选稿合法性尺子**:`check-lesson-draft.mjs` 判 `lesson-draft.mjs` 候选稿形态(frontmatter 必填键齐 ∧ `writeBack` 恒 `immutable-exempt-required` ∧ kind 在策略白名单 ∧ 三段标题各恰一次 ∧ rule 不超上限 ∧ 不许自称「写回已完成」);判据源单量 = `scripts/data/lesson-writeback-policy.json`;0 合法/1 违规/2 未判定。用法 `node scripts/check-lesson-draft.mjs <稿路径>|--self-test`。
- **服务运行配置入库真相源对账尺** `check-service-inventory.mjs`(如实:未进提交链/CI/守护派发 ⇒ 只在门 89 的 R3 报数集,不属 R4 射程;问责 = 手动):注册表实际值 ↔ 仓内 `scripts/data/service-inventory.json` 四键逐字节对账,三态 ok/drift/unjudged 绝不并桶;**枚举到 0 个候选服务 ⇒ exit 2 未判定**(§0.3,不用 0 冒充「没有」);清单只存脱敏形态,原始秘密不出仓不出 stdout。
<!-- 2026-11-03 守门 207 体积清偿留痕逐字在 .ihui-agent/archive/AGENTS_trim-2026-11-03.md;§0–§29 条款一条未减。 -->
- **暴露凭据主动轮换器(2026-10-30 立)**:`scripts/rotate-exposed-upstream-credentials.mjs` 按「已知暴露值」的 sha256 前缀走既有 refresh 通道轮换,并**验证旧值不再被接受**(只换不验 = 没做);登记面 `scripts/data/exposed-credentials.jsonl` 只住 fp 与出处、**绝不含凭据原文**;节律面 = `git-guardian.mjs` 的 `sweepExposedCredentialRotation()`(有未结清条目才动,空转零写零推零派生);取不到旧值/库不在线 ⇒ exit 2 未判定(§0.3)。用法 `--dry-run`/`--json`/`--list`/`--register`/`--retire`。
- **待拍板条目一律禁止(2026-10-23 机主强制令,凌驾本仓一切"呈批等人"惯例)**:台账与计划文档里**不允许存在或新增**任何"待拍板/等人拍板/需拍板/待用户确认"的任务条目——存量逐条由 agent 深度分析后按最优推荐方案直接执行结清(决策与依据写进结清注记或 commit message);增量由守门 130 F11 差值棘轮当场判红拦截。§24 的"暂停→确认"流程对本仓**不再适用**。
- `pnpm check:all` = `scripts/all-checks-runner.mjs`(子步骤跑完再汇总、不短路,条数现读)+ `pnpm check:dep-links:strict`。**牙有三态**:`--strict` 下「判不出」「台账腐烂」「文档与代码仍脱节且无有效豁免」⇒ exit 2 顶红。合法暂态唯一出口 = 登记表挂 `exemptUntil`(会到期)+ `exemptReason`(≥10 字):缺一半/过短/形态坏/已到期 ⇒ 视同无豁免顶红;豁免粘连(挂在非「仍存在」条上)判腐烂顶红(§0.7/§0.10)。
### 读数不得断行(强制)
- 「一格一读数」格子的**读数必须整条单行**;放不下只能减列/减栏,禁折行、禁截断、禁缩字号。只补 `nowrap` 会把折行变成溢出压邻格,列宽下限与栏阈值须与它同批改(算式与量法见 `docs/UI_GUIDELINES.md` §13)。守门 `check-readout-no-break.mjs`(240,blocking,含"摘掉即翻红"成对夹具);像素够不够本门不判,另用只读尺 `verify-wallboard-readout.mjs --locale <五语言>` 逐格量。
- **守门接线层对账**(89):`scripts/check-gate-wiring.mjs`(blocking,跳过 `HUSKY_SKIP_GATE_WIRING=1`)...**R1/R2** 头注或文档声称已接而五处权威点(`guardian-runner` ∪ `scripts/lib/pre-commit-hook.js` ∪ `.husky/*` ∪ 根 `package.json` ∪ `.github/workflows`+cert)零命中 ⇒ 拦;**R4** 已接线而 AGENTS.md/README.md 通篇未点名 ⇒ 拦(去后缀同名即算,文档面按 HEAD∪索引判,绝不读工作区);**R5** 同 id 登记两门 ⇒ 拦;**R7** dispatcher 依据文件不存在 ⇒ 拦;**R8** `stagedTriggers` 会让 `guardian-triggers.mjs` 当场抛错 ⇒ 拦;**R13** 一个注册对象里出现两个 `id:`/`script:` ⇒ 拦(插号器少写一个 `},` 或字段平铺,后写字段覆盖前写,被吞的那道门从注册表静默消失,R5 看不见它——两个 id 各出现一次,只是同处一个 `{}`)。R3/R6/弱接线只报数。台账 `scripts/gate-wiring-allowlist.json` 只救 R3;**R9** 判据与各条修法详解见归档 `.ihui-agent/archive/AGENTS_trim-2026-10-23c.md`。
- 端侧(RN / 共享源)同一约束,按宿主分五档:**等分格**行加 `flexWrap: 'wrap'` + 格加 `minWidth`(=`最坏读数单行宽`,两条缺一不可,只给 minWidth 是溢出压邻格、只给 flexWrap 时 `flex:1` 的 `flexBasis` 是 0 永不触发);**`space-between` 行 / `absolute` 容器**内的读数加 `flexShrink: 0`(否则行宽不够时先压读数、标签反而完整);**定宽格(`width:NN%` / `flexBasis`)**只能靠 `minWidth`(`flexShrink` 是纵向主轴属性,对横向定宽无效)。守门 `check-rn-readout-cell.mjs`(241,blocking,AST 判 JSX 父子关系,存量 23→69 处均已归零),写法见 `docs/UI_GUIDELINES.md` §13.4。
- **短信通道只读哨兵** `check-sms-channel-health.mjs`(2026-10-27 立,判机器状态不进提交链):吃本地投递审计表判短信通道健康(欠费停机型,如 OUT_OF_SERVICE 悬而无人喊),不碰云端接口、不引新凭据;判据/自检/派发面见门体头注。
- **跨端造页闭环腿(2026-10-26 立,巡检轮)**:`scripts/git-guardian.mjs` 的 `sweepCrossEndShellPages()` 把 `scripts/land-cross-end-shell-pages.mjs` 从"只能人工敲"变成 30 分钟自跑一轮:blob = `git show HEAD:<file> ⊕ 本批行`(盘上未提交字节一字节不读),结论走 `--json` 的 summary(形状由 `scripts/tests/cross-end-shell-sweep-dispatch.test.mjs` C1 钉住,不手抄);clean 即零写零推,blocked/pending 只写日志不喊人(§5e-1),结论取不到记未判定不记绿。判机器状态 ⇒ 不进提交链(§12e)。**容量上限**:单分包 2 MiB;判据 `scripts/lib/cross-end-subpackage-capacity.mjs`,门 110 **AB3** 兜底。
- **等条件条目同型禁止(2026-10-25 机主令,与待拍板禁令同族)**:台账里**不允许存在或新增**任何挂"等条件/等环境"桶的条目——出路只有三条:**agent 侧能当场做的当场做完**;真卡在机主动作面(供值/凭据/资质/控制台/真机扫码)的**改归属为「归:机主X面」出桶**(归他人桶,不是等条件桶);两者都不是的按观察类结清摘行(事实进 commit message)。机器级时序依赖的出路 = 把执行**器物化**(探测器自动找窗口),不是挂账等条件。增量由守门 130 F12 差值棘轮拦(基线 F12 键集,存量清偿后收窄为 `[]` 永久地板);派单统计里等条件桶应读 0;不得改措辞绕 v2 尺(§12f)。**兜底清扫器 `strip-banned-buckets.mjs`**(2026-10-25 立,与待拍板 F11 同射程):union 收敛器/复翻席不走提交链 ⇒ 棘轮拦不到"主动写回",由 guardian 巡检轮 `sweepBannedBuckets` 派发(5min 节流)自动摘 HEAD 面两桶未勾行并留痕 f12-purge;判据 import 单源(plan-task-index v2 尺 + readFieldsFace),结论行三态;镜像 `scripts/tests/strip-banned-buckets.test.mjs` 7 例(留痕在落地之后、落地不自带 CAS、已勾行不进射程)。复翻 union 带回行**必须同步摘禁令形态**(翻勾或改归属),否则本器 5 分钟内再摘。
- **git 网络与推送**:同步一律 `git fetch <remote> main` + `git merge --ff-only FETCH_HEAD`,**禁止 `git pull --rebase`**;rebase 由 `.husky/pre-rebase` 钩子机器硬拦(2026-10-24 立,凌晨 stash+rebase 烂尾事故根治;逃生口 = `IHUI_ALLOW_REBASE=1` + `IHUI_ALLOW_REBASE_REASON="<≥10字定向说明>"`,stderr 留痕)。**agent 禁止手写 `git push`**:origin 由 post-commit `git-push-guard.mjs` 自动异步推送(ahead 检测+后台 worker+回读验证,状态 `.ihui-agent/state/push-state.json`);**仓库只有 `origin` 一个远端**:国内代码镜像(Gitee/GitCode)与 `mirror-to-cn.yml` 作业已于 2026-10-23 整体弃用并删除,见到残留远端或跟踪引用应删掉而不是修。收尾核验只跑 `node scripts/git-push-converge.mjs`(只读六态);遇 non-FF 跑 `node scripts/git-sync-converge.mjs`(索引层合并,零触碰他人未提交文件),禁止手工 fetch/merge/push 循环。
- **238 镜像 purge 内容完好**:`check-mirror-purge-intact.mjs`(blocking,2026-10-23 立,射程 10 文档 = 4 版 README + AGENTS.md + 5 个 purge 覆盖文档;判据 M1–M4 全文见门体头注与 runner onFailHint,**此处不重抄** —— 判据字面量恰是本门的禁语,点名行写全会被本门当场判红;一行多条只计最先;绝对零容忍非差值棘轮;自检 19/镜像 10 例;跳过 `HUSKY_SKIP_MIRROR_PURGE_INTACT=1`)
- agent 跑 PowerShell 必须用 `pwsh.exe`(7+),禁 `powershell -File`/`powershell -Command`(5.1 的 UTF8→UTF16LE BOM bug、代码页截断);项目内 `.ps1` 第一行 `#requires -Version 7`;**例外**:`deploy/**` 的 `.ps1` 不吃该 pragma(守门 `check-pwsh-version.mjs` 对该面只报名,真判据在调用侧:调 `deploy/**.ps1` 必须显式 `pwsh` 或经 `.vbs` 包装);路径统一正斜杠;`.ps1` 用 UTF-8 with BOM 写。**根治@2026-10-29 实测**:嵌套 `pwsh -Command "…"` 双引号被外层(pwsh7)展开吃 $变量⇒ParserError;`-EncodedCommand` 编码必须是 UTF-16LE base64(UTF-8 字节错位=“CJK 乱码”假命令名);Bash 工具的 pwsh 恒带 -NoProfile 可绕用户 profile。正解=点源 `C:/Users/Public/Documents/PowerShell/ihui-shell-fix.ps1`(纯ASCII+BOM;pwshx 走 -EncodedCommand 零引号暴露、ihui-ps1 跑前自动补 BOM),真相源与三装载点登记见注记。〔取证细节逐字归档 `.ihui-agent/archive/AGENTS_powershell-shellfix-2026-10-29.md`〕
- 原速查整区归档于 `.ihui-agent/archive/AGENTS_full-pre-compact-2026-10-14.md`;本区只留门 89 + 横向口径 + 点名索引(R4:每道已接线门须在本文或 README 可见)。**mode/blocking、skipEnv、编号以 `scripts/guardian-runner.mjs` 现值为准**(§0.1)。
- **手动全量**:`node scripts/guardian-runner.mjs --staged`(pre-commit 模式)/不带为全量;失败不中断,跑完汇总再 exit 1(子门 exit 75 中断仍立即传播;`GUARDIAN_STOP_ON_FIRST=1` 恢复 fail-fast)。
- **207 体积对账**:`check-agents-doc-size.mjs`(blocking,预算 96,000 字节,跳过 `HUSKY_SKIP_AGENTS_DOC_SIZE=1`);阈值锚点 = 1,261,607B⇒ratio 1.000、96KB≈7.6%,非拍整数;阈值/定级以门体头注与 runner 现值为准。
- **非色档三族同源(2026-10-28 立)**:间距 `SPACING_STEPS` / 字号 `TYPE_STEPS`+`FONT_WEIGHTS` / 阴影 `ELEVATION_CSS` 是唯一真源,由 `scripts/sync-css-tokens.mjs` 生成到 tokens.css 的 `css-tokens:managed` 受管块(`@theme` 内末尾,47 档),web 由此获得 `p-md` / `text-body` / `shadow-elevation-md` 这类工具类(写进 `:root` 则 v4 一条工具类都不产出,见脚本头注 §二实测)。受管块是**派生态禁止手改**:改值改 TS 源后跑 `node scripts/sync-css-tokens.mjs --write`;守门 93 的 R9/R10/R11 判受管块与 TS 源逐值同源(缺档/漂移/多档三方向都红),`pnpm check:tokens-css` 可单跑。圆角仍走 `radius.js` 单源,不重复生成(同值两名生产者 = 漂移)。
- **结构与守护**:活 gitdir **按当次实测**(§0:`.git` 可能是 gitfile 指仓外 gitdir,判据现问 `git rev-parse --git-dir`/`--git-path <件>`,本文不存现状);仓外 gitdir 与 `.git-backup-*` 遗留形态**均禁删清**(§5b)。守护 = `git-guardian.mjs`(daemon + 计划任务 `IHUI-AI git-guardian` 每 2 分钟),分层自愈 `指针→环境→HEAD→嵌套 ref→本地备份→远端`,破坏性覆盖前先归档到 `gitArchiveDir()`,**手工抢修也不得把 `.git*` 归档 mv 到工作区根**。诊断 `node scripts/git-guardian.mjs --status|--check`;日志 `.ihui-agent/state/git-guardian.log`。〔原行(含 10-31 现读值)在 `.ihui-agent/archive/AGENTS_trim-2026-11-04d.md`〕
- **监控告警词表单一真相源**(275):canonical = `packages/types/src/monitor-vocabulary.ts` 的 `MONITOR_ALERT_SEVERITIES/STATUSES`(库列 severity/status 真值),web 只 re-export + 展示元数据;`check-monitor-alert-vocabulary.mjs` 按差值棘轮只拦新增同值副本(锚点=文件 HEAD 面自身,存量只报数)。
- **只读对账尺子不进提交链**(判机器状态/票面文本,提交者结构上满足不了 ⇒ 挂成提交门即 §12e 恒红门):`check-temp-landing.mjs`、`check-landed-reverts.mjs`(调度器 = guardian `auditLandedReverts()` 30min 轮)、`check-dispatch-premise.mjs`(需 `--ticket`)、`check-alertmanager-live-config.mjs`、`check-monitor-runtime-parity.mjs`、`check-cross-end-parity-drift.mjs`(调度器 = `auditCrossEndParityDrift()` 60min 轮)。**会写盘的那格** = `repair-cross-end-mirror.mjs` 的 `healCrossEndMirror()` 30min 轮(只补登记表已有的声明缺口、他席在飞拒落、只留日志不喊人)。各尺判据见门体头注。〔原索引在 `.ihui-agent/archive/AGENTS_trim-2026-11-04d.md`〕
- **R4 点名补登记(2026-11-01/04,四条折一条)**:`check-redirect-target-origin-pinned.mjs`、`check-like-wildcard-escape.mjs`、`check-pool-isolation.mjs`、`check-autonomy-leg-health.mjs` 与 `check-dev-db-rotation-window.mjs`(判机器状态⇒**不进提交链**,调度=guardian 巡检轮,判据 import `auto-evolve.mjs` 零复算)、`check-plan-row-length.mjs`、`check-panel-metric-exists.mjs`、`check-hairline-separator.mjs`、`check-retry-aliases.mjs`、`check-permission-lease-bounded.mjs`(编号 293–297 均 blocking;**293 属元门档、本地 pre-commit 可跑,294–297 不是元门 ⇒ 真执行点在 CI 或 `IHUI_GATE_SCOPE=full`,别读成"本地已拦"**)、A8 黑腿维判据 `scripts/lib/autonomy-leg-liveness.mjs` + 清单 `scripts/data/autonomy-leg-liveness.json`(A1-A7 在位已量、时长未量)。各维判据见门体头注。另:门 222 `check-panel-datasource-wiring.mjs`(blocking,A 面板 uid 必须在 provisioning 中、B 声明了零面板使用只报数、C gridPos 相交/越界;自检 `--self-test` + 镜像 `scripts/tests/check-panel-datasource-wiring.test.mjs`;跳过 `HUSKY_SKIP_PANEL_DATASOURCE_WIRING=1`)。〔原四条逐字在 `.ihui-agent/archive/AGENTS_trim-2026-11-04c.md`〕
- **改判据面/守门脚本一律带豁免 trailer(2026-11-02 机主定档)**:凡本次提交触及受保护面(清单现读 `scripts/data/immutable-guard.json`:`scripts/check-*.mjs`、`scripts/lib/**`、`scripts/data/*-exemptions.json`、`scripts/guardian-runner.mjs`、`AGENTS.md`、清单自身),提交信息正文必须带一行 `immutable-exempt: <≥10 字理由>`;无 trailer 即 `undeclared`,`--audit-new` 事后判红,**且提交者自己改不了这一格**(`--record` 只对已声明项留痕);"先提交、后补声明"的唯一合法出路 = 持钥方追认台账 `scripts/data/immutable-guard-acks.jsonl`(`--ack <40位sha> --reason --by --expires`:逐枚具名、必到期、验不过即不生效,台账自身也登记在受保护面上)——自治会话手里没有这把钥匙 ⇒ 判据面那一格结构上只能由人结清,所以 `auto-evolve` 落账腿对命中判据面的产物整批拒收。多席并行改 `check-ops-patrol.mjs` / `check-typecheck.mjs` 同此。
- **本票新增只读哨兵点名(R4 义务,2026-11-04)**:`check-git-probe-headroom.mjs` 量「`git status` 到宿主 5000ms 探测预算之间的余量」(此前无尺子量余量本身 = 安静失效型)。五维定级 `status-latency`/`collector-tailers`/`monitor-trust`/`accel-live`/`app-probe-stall`(量宿主卡死重放,它不自愈),另 `untracked-walk-share` 只归因;阈值一律标出处不自拍,算式见门体头注。两要点:① `accel-live` = 活 gitdir config 说 fsmonitor+untrackedCache 开着而索引尾区缺 FSMN/UNTR ⇒ drift(整份替换索引会抹掉扩展,实测 `git status` 连跑 5 次不自愈 ⇒ 账面启用≠真生效;出路 `git update-index --untracked-cache`,反复掉就关回);② 判机器状态 ⇒ **刻意不进提交链**(§12e;反向锁钉「注册进 guardian-runner 即红」)。调度 = `git-guardian.mjs` 的 `sweepGitProbeHeadroom()`,main 单轮 + daemon tick 双挂点共用节流戳,判过 30min / 未判定 10min(先写戳后判定 = 哨兵自己成静默源)。两路读数(块面 + git 自测)不一致 ⇒ 未判定,不挑一个信;例数一律现读(§0.1)。〔立因与实测账原文在 `.ihui-agent/archive/AGENTS_trim-2026-11-04c.md`〕
- **`deferred@` 到期由门 292 判**(`check-plan-deferred-expiry.mjs`):`deferred@YYYY-MM-DD(到期复评)` 到期即红,不再靠人记。
- **工作流/部署脚本死引用(298,blocking,跳过 `HUSKY_SKIP_DEAD_SCRIPT_REFS=1`)**:`check-dead-script-refs.mjs` 判 `deploy/**` 与 `.github/workflows/**` 引用的 `scripts/*.ts|mjs` 是否存在:cwd 按 `working-directory`(步骤级>job 级 defaults)、`pnpm --filter` exec、shell `cd`、Dockerfile `WORKDIR`、相对/祖先路径解析;能定 cwd 判真死 exit 1,定不了 exit 2 不折绿;回滚态(HEAD 有、工作树缺)只报数。`--staged` 复验、`--self-test` 自检。
- **新增共享屏必须壳或台账二选一**:`packages/app/src/features/**` 新增 `*Screen.tsx` 时,同一提交内必须给 `apps/mobile-rn/src/screens/` 落对应薄壳(可先 `node scripts/gen-rn-shell-scaffold.mjs --screen <spec> --write` 生成骨架再人工补数据源),或在 `scripts/data/rn-host-shell-manual.json` 登记 owner/expires/evidence;两者都没有 ⇒ `check-rn-host-shell-coverage.mjs` 判红并打印造壳命令。
