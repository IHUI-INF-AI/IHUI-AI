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

## 3b. 跨端五门(288/290/291/292/298,2026-11-03 落地,均 blocking)

> 编号 = `scripts/guardian-runner.mjs` 注册 id(`id: '288'`/`'290'`/`'291'`/`'292'`/`'298'`);本节只记语义与出口,存量/计数一律现读(`AGENTS.md §0.1`)。

### 第 288 项 check-cross-end-component-props-parity.mjs(差值棘轮,不是绝对恒红)

- **判什么**:两端同名组件对的 props 键集与必选性。判据引擎在 `scripts/lib/component-props-parity.mjs`(门脚本零复算)。
- **存差键**:每对只记 `onlyRn` / `onlyMini` / `reqDrift` 三个集合;台账 `scripts/data/cross-end-props-parity-baseline.json` 登记当下账。
- **棘轮**:在册对的三个集合**只减不增**,新键 ⇒ 红并逐键点名;全新同名对带漂移进仓而未落账 ⇒ 红;键集缩小 = 向统一收敛 ⇒ 绿并可提示收紧台账。落账唯一出口 `node scripts/check-cross-end-component-props-parity.mjs --update-baseline`(不许静默入账)。
- **`mapped` 等价映射表**:`scripts/data/component-props-equivalence.json` 只收「同一语义槽位、两端命名不同」的键(event/content/style 三类);命中即归 `mapped`、从存差键剔除、不计存量(`scripts/lib/component-props-parity.mjs:184`)。**行为缺口不得入表**(一端真没有对应能力只能真实现或登记分叉台账);表条目增长必须与漂移键同轮减少,否则红;两端已自然对齐的条目记 `mappedStale` 供体检,不静默留白。
- **`not-applicable` 裁决档**(整对不构成对账对象):owner + expires + evidence(仓库内 `文件:行`,该行必须真是声明)+ why 四件齐全、未到期才生效。可裁 `undetermined`(把"没读到"显式裁决掉),也可裁"能量出但确非同物"的整对(后者至少 2 条证据覆盖双端);缺字段/过期/证据指空 ⇒ `invalid-not-applicable-ruling` 红,`--update-baseline` 冲不掉,只能显式撤销;不许拿它把单键缺口洗成"整对不适用"。
- **出口**:`node scripts/check-cross-end-component-props-parity.mjs [--staged|--json|--quiet|--self-test]`;应急 `HUSKY_SKIP_CROSS_END_PROPS_PARITY=1`。

### 第 292 项 check-plan-deferred-expiry.mjs(台账 `deferred@` 到期)

- **标记**:`deferred@YYYY-MM-DD(到期复评)` 里的日期是**允许继续挂着的最后一天**——当天不红,次日起红(`scripts/check-plan-deferred-expiry.mjs:10`);编号/owner 分别取 `scripts/lib/plan-task-index.mjs` 与 `scripts/data/plan-fields.jsonl`,本门不复制键名规则。
- **宽限**:`--grace N`(默认 0)把红线整体顺延 N 天,是"允许补复评的时间",不是"再挂 N 天"(`scripts/check-plan-deferred-expiry.mjs:15`)。
- **三态**:0 全未到期(汇总 `rows=N expired=M`)/ 1 到期未复评(逐条点名行号+编号+日期+owner+超期天数)/ 2 未判定(台账或侧车取不到、marker 日期非法、参数非法)。真出路只有两条:复评后续期,或结清摘行;**不许只删标记**。
- **出口**:`node scripts/check-plan-deferred-expiry.mjs [--as-of YYYY-MM-DD] [--grace N] [--staged|--worktree|--json|--gate]`;应急 `HUSKY_SKIP_PLAN_DEFERRED_EXPIRY=1`。

### 第 290 项 check-miniapp-interaction-hygiene.mjs(只判静态可证的死可点)

- **A1 blocking 假可点**(`scripts/check-miniapp-interaction-hygiene.mjs:15`):handler 是空实现(`() => {}` / `() => undefined` / `() => void 0` / `() => null` / 同文件可证的空函数名)、可点标签的 className 同时带 `pointer-events-none`、handler 字面量为 `undefined`/`null`。绝对零容忍。
- **A2 blocking 空端口**(`:23`):`onNavigate`/`onToast` 等端口被赋空实现(JSX 属性或对象字面量);端口名 import 门「端口等价层」的 `PORT_TYPE_DECLARATIONS`,端口表新增自动进射程,本门不另立清单。
- **A3 advisory 交互反馈缺失**(`:30`):可点 `View`/`Text` 既无 `hoverClass`、也无 `active:`/`hover:` 类变体,且 handler 无导航意图 ⇒ 只报数;`--strict` 才折进退出码。不上 blocking 的原因:静态判不出"外层已有反馈、内层只做命中区"的合法结构,判红就是拿误报逼人写冗余代码。
- **A4 advisory**(`:44`):`Taro.showModal` 无 `showCancel`/`cancelText`/`onCancel`,也无 `success`/`fail` 处理取消 ⇒ 用模态框做单按钮提示。
- **A3 挂账形态**:条目进 `scripts/data/miniapp-interaction-allowlist.json`,带 owner/expires/evidence/rationale/count;A3 条目的 `expires` 不得早于 `ADVISORY_MIN_EXPIRES`(`2027-01-31`)。判序:到期即红;现读多于认领 ⇒ advisory(未挂账);认领多于现读 ⇒ advisory(清单腐烂,复核后下调或删除);现读归零 ⇒ 可销账。**A3 可挂账,但挂账不是销账。**
- **出口**:`node scripts/check-miniapp-interaction-hygiene.mjs [--gate|--staged] [--json] [--strict] [--self-test]`;应急 `HUSKY_SKIP_MINIAPP_INTERACTION_HYGIENE=1`。

### 第 291 项 check-web-rn-copy-parity.mjs(web↔RN 可见措辞)

- **B1 blocking**:同屏 web 侧已走 i18n 键,RN 侧仍硬编码与该键 `zh-CN` 译文**逐字相同**的中文(JSX 文本节点或 `placeholder`/`title`/`accessibilityLabel` 等用户可见属性)。
- **B2 advisory**:两侧键不同(`K_rn ≠ K_web`)但译文逐字相同。
- **B3 同义键异值(`B3-synonym-drift`)**:B1/B2 只认逐字相等,同义换词与同族取值不同是**结构性盲区**;B3 按语义族 `SYNONYM_FAMILIES` 把不同键名的同义键配对,再用归一化(大小写/标点/术语/单位/占位符顺序)后的取值比较,分"硬编码值落在族内"与"两侧键同族异名"两路取证。
- **台账**:`scripts/data/web-rn-copy-diffs.json`。B1/B3 新增未挂账 ⇒ 红;B2 只 advisory;但三条 rule 的条目**过期/缺字段一律红**(账本纪律不因 advisory 档放松)。
- **出口**:`node scripts/check-web-rn-copy-parity.mjs [--gate|--staged] [--json] [--self-test]`;应急 `HUSKY_SKIP_WEB_RN_COPY_PARITY=1`。

### 第 298 项 check-staged-downgrade.mjs(旧 blob 回写)

- **判据**:暂存 blob **整 blob 逐字**等于该路径某枚祖先 blob、而 HEAD 已有更新版本 ⇒ 红,点名「路径 + 祖先 sha + HEAD oid」。祖先窗口默认回看 80 枚"改过该路径"的提交(`scripts/lib/ancestor-downgrade.mjs:30`);判据单源同文件,`gen-ui-mirror --apply` 写手侧前置复用(`downgrade=` 拒写)。
- **合法回滚**:提交正文行首写 `intentional-revert: <依据>`(大小写不敏感,依据去空白 ≥8 字符,`scripts/lib/ancestor-downgrade.mjs:33`、`:36`);行首才认,模板注释 `#` 之后不算(`:52`)。命中 ⇒ 放行并逐条留痕 `.ihui-agent/state/intentional-revert.jsonl`(留痕失败不影响放行)。空口"有意回退"不算。
- **出口**:`node scripts/check-staged-downgrade.mjs --staged`;应急 `HUSKY_SKIP_STALE_DOWNGRADE=1`。

---

## 3c. 跨端三把新尺(299/300/301,2026-11-05 落地,均 blocking)

> 编号 = `scripts/guardian-runner.mjs` 注册 id;判据唯一实现在各脚本头注与 `scripts/lib/**`;存量/读数一律现读(`AGENTS.md §0.1`)。

### 第 299 项 check-miniapp-shell-form.mjs(小程序「薄壳 vs 复制」实现形态)

- **判什么**:在册页面若在共享屏登记表/四形镜像声明里被声明为镜像/委托,却**没有真的 import** 共享壳(`@rn-shells/*` / `@ihui/rn-app/features/*` / barrel 同名屏)⇒ 判为复制页。新增复制页即红,存量 93 页走 `scripts/data/miniapp-shell-copy-ledger.jsonl` 棘轮(纯复制 81 / 有本地改动 12)。
- **面**:默认 HEAD、`--staged` 索引、`--worktree` 人工逃生舱;台账读工作树。映射/在册页读不到 ⇒ exit 2 点名,不折绿。
- **出口**:`node scripts/check-miniapp-shell-form.mjs [--staged|--worktree|--json|--explain|--self-test|--emit-baseline]`;应急 `HUSKY_SKIP_MINIAPP_SHELL_FORM=1`。

### 第 300 项 check-api-endpoint-delta.mjs(API 端点「端内直拼」差异台账)

- **判什么**:三端 `src` 内的 `/api` 路径字面量/模板串/常量透传,按端与共享端点清单做差集;端内独有前缀未登记 ⇒ 红,新登记行必须带 `verdict`(非 pending)+ owner + reason(≥10 字);识别不了的调用点记「未判定」并计数,不当成「没有」。
- **面**:默认 HEAD、`--staged` 索引;共享真相源 `packages/api-client/src/endpoints/**`;台账 `scripts/data/api-endpoint-delta-ledger.jsonl`(存量 119 行全 baseline,逐条待裁决,不批量白名单)。
- **出口**:`node scripts/check-api-endpoint-delta.mjs [--staged|--json|--explain|--self-test|--emit-baseline|--depth N]`;应急 `HUSKY_SKIP_API_ENDPOINT_DELTA=1`。

### 第 301 项 check-web-mp-route-carriers.mjs(web ↔ 小程序共享屏承载路由)

- **判什么**:共享屏的 web 路由在小程序侧是否真有承接路由;缺承载 / 路由不存在 / 别名冲突 ⇒ 红,认不出的单列「未判定」。基线读数(现读):272 屏 / 承载 253 / 缺承载 0 / 路由不存在 0 / 未判定 1 / 合法 18 / 别名 1 / 冲突 0。
- **面**:`apps/web/`、`apps/miniapp-taro/src/app.config.ts`、`packages/app/src/features/`、`scripts/data/web-rn-screen-map.jsonl`、`scripts/data/cross-end-screen-registry.json`、`scripts/data/web-mp-route-carrier-{ledger,legal}.jsonl`。
- **出口**:`node scripts/check-web-mp-route-carriers.mjs [--staged|--gate|--json|--explain|--self-test]`;应急 `HUSKY_SKIP_WEB_MP_ROUTE_CARRIERS=1`。

---

## 3d. 手写迁移 snapshot 回写尺(350,2026-11-07 落地,只读、未挂提交链)

> 350 为文档登记号,未注册进 `scripts/guardian-runner.mjs`:存量未归零前本尺不挂提交链(§12e),以 `--check` 供人工/CI 定点使用;判据唯一实现在脚本头注。

| 编号 | 脚本 | 一句话判据 | 存量基线 |
|---|---|---|---|
| 350 | `scripts/check-hand-migration-snapshot.mjs` | 每条迁移新增的列/索引/约束必须存在于同号 snapshot(缺号取最近前序);基线外新增即红,取不到即未判定 | 1086 |

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

**默认没有合法场景(2026-11-03 机主明令,见 [AGENTS.md §12](../AGENTS.md))**:
- 钩子判红后的归因只回答"这道红是不是本任务引入的",**不是跳钩授权**;默认非零退出、不落地。
- 出路只有三条:修红后重跑 / 等并发会话释放索引 / 走 `node scripts/object-space-land.mjs`(不跑钩子,落地后自动复跑受影响门并把结果打进 stdout)。
- 仅限人工确认后显式走 `safe-commit.mjs --allow-skip-hooks="<原因>"`(正文自动写入「人工授权跳钩」一行,默认关闭);裸 `--no-verify` 不再列为合法操作。

**非法场景**:
- hook 失败原因是**本任务自己代码** → 必须修复后正常 commit,**禁止** `--no-verify` 跳过

### 6.2 各钩子跳过方式

| 钩子 | 跳过方式 | 说明 |
|------|----------|------|
| pre-commit | `git commit --no-verify` | 跳过提交链上**全部**登记门(项数现读;这就是本仓反复写"一道恒红门 = 全部守门作废"的原因) |
| commit-msg | `git commit --no-verify` | 跳过 message 校验 + Verified-DOM |
| post-commit | `HUSKY_SKIP_PUSH=1 git commit` | 跳过自动 push,commit 仅落地本地 |
| pre-push | `HUSKY_SKIP_TYPECHECK=1 git push` | 跳过全量 typecheck |

> `--no-verify` 不是流程事故,前提是本任务改动文件已通过 typecheck + lint + build 验证(见 [AGENTS.md §16](../AGENTS.md))。**2026-11-03 起该前提不再构成授权**:默认永不跳钩,见 §6.1。

### 6.3 跨端门应急跳过变量(2026-11-03 五门 / 2026-11-05 补三门 / 2026-11-06 补 86 号)

| 门 | 脚本 | 跳过变量 | 默认档 |
|----|------|----------|--------|
| 288 | `scripts/check-cross-end-component-props-parity.mjs` | `HUSKY_SKIP_CROSS_END_PROPS_PARITY=1` | blocking(差值棘轮) |
| 292 | `scripts/check-plan-deferred-expiry.mjs` | `HUSKY_SKIP_PLAN_DEFERRED_EXPIRY=1` | blocking |
| 290 | `scripts/check-miniapp-interaction-hygiene.mjs` | `HUSKY_SKIP_MINIAPP_INTERACTION_HYGIENE=1` | blocking(A1/A2);A3/A4 advisory |
| 291 | `scripts/check-web-rn-copy-parity.mjs` | `HUSKY_SKIP_WEB_RN_COPY_PARITY=1` | blocking(B1/B3);B2 advisory |
| 298 | `scripts/check-staged-downgrade.mjs` | `HUSKY_SKIP_STALE_DOWNGRADE=1` | blocking |
| 299 | `scripts/check-miniapp-shell-form.mjs` | `HUSKY_SKIP_MINIAPP_SHELL_FORM=1` | blocking(新增复制页;存量 93 页棘轮) |
| 300 | `scripts/check-api-endpoint-delta.mjs` | `HUSKY_SKIP_API_ENDPOINT_DELTA=1` | blocking(未登记端内独有前缀) |
| 301 | `scripts/check-web-mp-route-carriers.mjs` | `HUSKY_SKIP_WEB_MP_ROUTE_CARRIERS=1` | blocking(缺承载/路由不存在/冲突) |
| 86 | `scripts/check-verify-tmp-files.mjs` | `HUSKY_SKIP_VERIFY_TMP_FILES=1` | blocking(2026-11-06 由 warn 升档;前置 = 全量档存量 0) |

> 九个变量名以 `scripts/guardian-runner.mjs` 的 `skipEnv` 现值为准(`AGENTS.md §0.8`);跳过只免本次退出码,不销账、不删台账,且必须留痕(守门 89 同款纪律)。

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

---

## 10. 门名点名索引(2026-11-07 自 README 迁入)

> 原 README `## 守门脚本点名索引(内部参考)` 的逐门说明正文;README 现只保留门脚本名单(守门 207 体积预算)。编号与档位以 `scripts/guardian-runner.mjs` 注册条目现值为准。

> 2026-10-25 由 `AGENTS.md` 整体迁入(守门 207 体积预算;R4 的文档面 = `AGENTS.md` ∪ `README.md`,故迁到这里仍满足「每道已接线门必须被点名」)。编号与档位以 `scripts/guardian-runner.mjs` 注册条目现值为准。原文逐字留档 `.ihui-agent/archive/AGENTS_trim-2026-10-25b.md`。
- 号池只读尺子(2026-10-26 装车,**不进提交链**;判机器/库状态,§12e): `check-relay-capacity-zero.mjs`(逐 provider 两池容量三态 ok/breach/unjudged;差值档只把相对基线新增的 breach 判红、存量只报数;接线 = git-guardian 巡检轮 dispatchRelayCapacity,5 分钟节流)
- 号池只读尺子(2026-11-01 立,同上进不了提交链): `check-pool-isolation.mjs`(号池隔离性六
- 安全/回跳(2026-11-01 立,blocking,runner id '278'): `check-redirect-target-origin-pinned.mjs`(判 `apps/web` 每枚 `resolveSafeRedirectTarget(...)`/`isSafeNavigationTarget(...)` 的 options 实参必须是**字面量对象且含 `allowedOrigins`**——`isSafeNavigationTarget` 缺该键时走"只判协议"支,任意 http(s) 外站点照过,同日实测四处真命中含两枚授权码签发路径;options 为变量/展开 ⇒ 未判定按 §0.3 exit 2,豁免 = 具名台账且带到期)
- **门名点名索引**(按主题归堆;编号与档位以 runner 现值为准):
- git/提交链: `check-commit-scope-consistency.mjs` `check-push-sync.mjs` `check-head-typecheck.mjs` `check-typecheck.mjs` `check-git-read-timeout.mjs` `check-spawn-stdio.mjs` `check-registry-worktree-superset.mjs` `check-no-nested-git.mjs` `check-commit-loss-guard.mjs` `check-staged-resurrection.mjs`(pre-commit 0b 段取索引面 `--diff-filter=A`,拦「已声明删除被当新增收编」;判据单源 `scripts/lib/intentional-file-deletion.mjs`;刻意不设 `HUSKY_SKIP_*` 跳过键,唯一出口 `--revoke-deletion`) `check-merge-addition-loss.mjs` `check-merge-deletion-resurrection.mjs` `check-single-branch.mjs` `check-stale-stashes.mjs` `check-bypass-landing-scope.mjs` `check-live-doc-references.mjs` `check-mjs-syntax.mjs`(纯语法 compile 不 evaluate;判红臂 = 索引新引入不可解析;镜像 `check-mjs-syntax.test.mjs`) `check-format-changed.mjs` `check-husky-hook-form.mjs`(H1 钩子必须是 sh 薄壳;H2 包装与 node 正文同面在位;正文即 `post-commit-hook.js` 一族;镜像 `check-husky-hook-form.test.mjs`) `check-no-nested-git-sites-durability.mjs`(门 208 豁免台账耐久性)
- 接线/自检: `check-gate-face-discipline.mjs` `check-skip-env-promise.mjs` `check-selftest-registrant-evaluates.mjs` `check-ci-failure-triage-wiring.mjs`(W1 差值只拦新增、W2 失明/错位/孤儿锁硬拦,`TRIAGE_WORKFLOW_FILE` 必须指本文件) `check-api-key-permission-labels.mjs`(union↔web 标签表↔五语言键集) `check-sheet-flex-contract.mjs`(bounded 容器内列表唯一弹性块;镜像 `check-sheet-flex-contract.test.mjs`) `check-mobile-rn-style-parity.mjs`(RN 硬编码 hex 基线棘轮) `check-list-predicate-has-positive-proof.mjs` `check-ops-patrol.mjs` `check-shared-type-not-redeclared.mjs`(sameShape+reachable 两维) `check-alert-identity-volatility.mjs`(V1 去重身份不含抖动量;V3 声明 `inScope:true` 必须在 `SCOPE_PREFIXES` 内、V4 发现集不得漏面;台账 `scripts/data/alert-mail-faces.json`;生产者 `alert-notification-service.ts`;镜像 `check-alert-identity-volatility.test.mjs`) `check-generator-resource-release.mjs`(async 生成器消费点必须显式 aclose/return;warn 起步) `check-no-warm-border.mjs`(W1-W4 暖色描边/9-patch/colorAccent/plugins 被 ignore;镜像 `check-no-warm-border.test.mjs`) `check-auth-cookie-domain-scope.mjs`(V1 域外写手/V2 判据拆毁/V3 回归形状;单源 `apps/api/src/utils/auth-cookies.ts` 的 `resolveCookieDomain`;镜像 `check-auth-cookie-domain-scope.test.mjs`) `check-bpe-encoding-parity.mjs`(C1 声明/C2 行为/C3 反向锁) `check-grafana-metric-exists.mjs`(指标名必须有发射点或台账) `check-grafana-datasource-wiring.mjs`(A uid 必须存在;B 只报数;C gridPos 相交/越界;镜像 `check-grafana-datasource-wiring.test.mjs`) `check-sse-no-blind-merge.mjs`(全量帧/`snapshot`/`initial` 分支禁止铺开本地旧状态,判据落在 `sse-parse.ts`) `check-direct-run-guard.mjs` `check-test-judge-not-replicated.mjs` `check-staged-typecheck-mirror-sync.mjs` `check-registry-worktree-superset.mjs` `check-rich-anchor-renderer-single-source.mjs`(249) `check-mobile-download-leg-cn.mjs`(CI 弱接线,`.github/workflows/mobile-download-leg.yml` 手动触发;两条腿各以 `Range: bytes=0-0` 真探 `Content-Range` 总长 —— 任一腿量不到 ⇒ exit 2 未判定,低于体积下限或两腿总长不等 ⇒ exit 1,全等才绿;自检 `--self-test`)
- UI/样式: `check-miniapp-taro-design-tokens.mjs` `check-adapter-style-parity.mjs` `check-percent-clamp-single-source.mjs` `check-line-split-parity.mjs` `check-input-focus-feedback.mjs` `check-button-height.mjs` `check-glyph-arrow-icon.mjs` `check-no-divider.mjs` `check-no-mask-image.mjs` `check-no-native-dialog.mjs` `check-no-emoji-icons.mjs` `check-radius-single-source.mjs` `check-radius-role-conformance.mjs` `check-rounded-full.mjs` `check-statusbar-single-source.mjs` `check-cross-end-ui-parity.mjs` `check-cross-end-screen-coverage.mjs` `check-miniapp-tokens-sync.mjs` `check-miniapp-taro-style-parity.mjs` `check-cross-end-tokens.mjs` `check-miniapp-css-landing.mjs`
- i18n/文案: `check-i18n-locale-content-language.mjs` `scan-web-dead-i18n-keys.mjs` `scan-desktop-dead-i18n-keys.mjs` `scan-extension-dead-i18n-keys.mjs` `scan-miniapp-taro-dead-i18n-keys.mjs` `scan-mobile-rn-dead-i18n-keys.mjs` `check-cli-i18n-parity.mjs` `check-i18n-duplicate-namespaces.mjs` `check-i18n-broken-en.mjs` `check-i18n-keys.mjs` `scan-i18n-zh-residue.mjs` `scan-hardcoded-zh.mjs` `check-miniapp-replace-antipattern.mjs` `check-bare-decode-uri.mjs`(241,差值棘轮:裸 decodeURIComponent 遇孤立 % 抛 URIError,渲染求值路径整页崩;唯一出口 safeDecodeURIComponent @ihui/shared/utils/safe-decode-uri,行内豁免 bare-decode-uri-exempt 须带原因)
- CLI/工具契约: `check-tool-exec-budget.mjs` `check-tool-family-registered.mjs` `check-tool-schema-projection.mjs` `check-file-write-safety.mjs` `check-mention-engine-wired.mjs` `check-slash-command-wired.mjs` `check-lsp-language-table.mjs` `check-doom-loop-parity.mjs` `check-guardian-review-wired.mjs` `check-turn-ordinal-lock.mjs` `check-truncation-accounting.mjs` `check-list-cap-honesty.mjs` `check-compaction-denominator.mjs` `check-load-state-loaded-marks.mjs` `check-load-state-projection-parity.mjs` `check-mobile-api-base-bake.mjs` `check-mobile-version-code.mjs` `check-v3-62-conversation-mount.mjs` `check-ai-panel-mount-guards.mjs` `check-crash-report-redaction.mjs` `check-diagnostic-redaction.mjs` `check-digest-name-reality.mjs` `check-image-placeholders.mjs` `check-upload-budget.mjs` `check-lock-manifest-consistency.mjs` `check-orphan-deletion-refs.mjs` `check-process-exit-attribution.mjs` `check-wire-strictness.mjs` `check-dangling-local-imports.mjs` `check-event-closure-leak.mjs` `check-test-paths.mjs` `check-verify-tmp-files.mjs` `check-workspace-hygiene.mjs` `check-scratch-root-no-nesting.mjs` `check-fixture-tmpdir.mjs` `check-disk-root-hygiene.mjs` `check-disk-root-write.mjs` `check-c-drive-paths.mjs` `check-c-drive-pollution.mjs` `check-pwsh-version.mjs` `check-root-dir-clean.mjs` `check-readme-sync.mjs` `check-readme-table-integrity.mjs` `check-delivery-report-consistency.mjs` `check-multi-end-sync.mjs` `check-prompt-injection-registry.mjs` `check-declared-policy-has-consumer.mjs` `check-desktop-event-wiring.mjs` `check-service-binary-paths.mjs` `check-public-path-probe.mjs` `check-staged-typecheck.mjs`
- 格式/媒体对账尺子(2026-11-03 立,2026-11-04 补媒体族判据与守护派发腿;**不进提交链** —— §12e:判的是跨端十面漂移,单个提交结构上满足不了"十面同时对齐",存量非零时挂提交链即恒红门): `check-format-support-parity.mjs`(十面 = 上传白名单 EXT_MIME_MAP ↔ 六张文档实现面(RAG 解析 / ai-service 工具 / 富预览 / 附件预览 / 前端 accept / 小程序直开)+ 三张媒体实现面(视觉 `_EXT_TO_MIME` / 音频 `AUDIO_ALLOWED_EXTS` / 画廊 `GALLERY_VIDEO_EXTENSIONS`);三桶 ①aligned / ②hollow 空头 / ③unregistered 有实现未登记;② 按「档族 ↔ 面族」**同族才算接住**(档族由登记面该档首个 MIME 的 major 现推,本脚本不另立第二张族表),异族命中不算接住但在 hollowReasons 点名是哪个面;③ 走具名豁免台账 `scripts/data/format-parity-waivers.json`(owner/reason≥10字/expires 三键齐备、未到期、且本次仍命中才生效,任一不成立一律不豁免;在册却不再命中 ⇒ 清单腐烂判 drift 不判绿);三态 ok/drift/unjudged 绝不并桶,任一面读不到或枚举到 0 候选 ⇒ 判死不记绿;**刻意不算面的一张表** = `apps/api/src/plugins/upload-scanner.ts` 的 `MAGIC_SIGNATURES`(内容嗅探表不是准入表,摘它=削检出,把它加成第 11 面=每轮多两档假 ③,与把九个媒体档误报成 ② 同型);派发层 = `git-guardian.mjs` 的 `sweepFormatParity()`(main 单轮 + daemon tick **双挂点**共用一枚节流戳,判过 30min / 未判定 1h 短冷却 —— 先写戳后判定会把"整轮没跑成"记成"刚跑过",哨兵自己就成了静默源;ok/drift 只写日志不寄信,因三条出路都是 agent 当场能做的活,§5e-2 不推回机主;未判定走稳定身份连满 6h 才到人);自证 = 尺子 `--self-test` 16 例 + 镜像 `scripts/tests/check-format-support-parity.test.mjs` 11 例(import `__test__` 零复算,§22c)+ 调度腿镜像 `scripts/tests/git-guardian-format-parity-sweep.test.mjs` 8 例 + 装车锁 `scripts/tests/git-guardian-daemon-audit-fanout.test.mjs` 30 面;末行现读(HEAD 面 2026-11-04T06:59Z):`FORMAT-PARITY-RESULT state=ok exit=0 十面对齐:登记↔实现(按族)零缺口`,登记 34 档 / ②0 / ③0;守护真跑过的一条日志:`✅ 格式对账:十面对齐(登记 34 档,②0/③0)`;落地枚 `971e2ff9c7cfa654a992d949584d571b10d81c77`(判据+端上结清)与 `6f8c0373a54d951882f2da47d1d29bddcfb33438`(巡检轮派发))
- 只读尺子/派生器/核验器(不在 runner,不进提交链,也不进守护巡检轮): `check-temp-landing.mjs` `check-dispatch-premise.mjs` `check-alertmanager-live-config.mjs` `check-monitor-runtime-parity.mjs` `check-tunnel-leg-health.mjs` `check-prod-checkout-foreign-work.mjs`(git-guardian 巡检轮派生,`--json` 只判不修;未跟踪洪水只计数不判定) `check-index-unmerged-age.mjs`(2026-10-24 立,index 烂尾哨兵:unmerged 条目按路径集指纹计龄,同批滞留 ≥15 分钟即到人;立因 = 凌晨违规 stash+rebase+pop 冲突逃逸挂了 2 枚 unmerged + 91 个被删文件 12 小时无人察觉;不走提交链,派发层 = git-guardian 的 `auditIndexUnmerged`;镜像 `check-index-unmerged-age.test.mjs`) `verify-panel-data.mjs` `verify-panel-logql.mjs` `verify-grafana-panel-data.mjs` `verify-grafana-logql-panels.mjs` `sync-panel-live-provisioning.mjs` `sync-grafana-live-provisioning.mjs`(仓内 provisioning 是唯一真相 ⇒ 派生到部署机运行副本,连不上的源不写入并点名原因;幂等 + `pre-sync-backups/` 退路;`--check` 零副作用;大屏核验五档 有数/全零/空板/失败/未判定,全零 ≠ 空板,不许接提交门) `strip-stale-closed-rows.mjs` `strip-stale-claim-marks.mjs` `env-backfill-model-keys.mjs` `quarantine-disk-root-strays.mjs` `git-refs-heal.mjs` `git-backup-refresh.mjs` `git-sync-converge.mjs` `git-push-converge.mjs` `git-push-guard.mjs` `heal-worktree-tracked.mjs` `sync-lost-commit-tags.mjs`
- 计划/台账: `check-plan-dup-pointer-ratchet.mjs` `check-plan-sha-resolvable.mjs` `check-plan-sha-form.mjs` `check-baseline-freshness.mjs` `check-agents-doc-size.mjs` `check-plan-id-pool.mjs` `check-plan-closed-stock.mjs` `check-plan-claims-vs-head.mjs` `check-plan-archive-monotonic.mjs`(门 239,2026-10-24 由撞号 237 改号;已归档✅票复活成未勾活行/逐字孪生回插即红,stagedTriggers=PROJECT_PLAN.md) `check-live-doc-archive-reinflation.mjs`(门体已造、尚未纳入 runner 注册表) `check-task-claims.mjs` `check-plan-fields.mjs` `check-sweeper-liveness.mjs`(2026-10-23 立:清扫背离巡检只读探针——派发在动 ∧ 留痕静默 >2h ∧ 可清存量 >0 ⇒ 器物空转;不走提交链,派发层 = git-guardian 的 `auditSweeperLiveness`) `check-head-recall-stock.mjs`(门 268,2026-10-30 立,机主令「把计划任务文档跳跃彻底根治」:判「摘除台账已声明删除的登记行又被带回被审面」的枚数变多,--staged 判索引 blob、差值棘轮只拦新增、存量不担责 §12e;判据 import scripts/lib/head-recall.mjs 单源零复算;跳过 HUSKY_SKIP_HEAD_RECALL_STOCK=1;兜底清扫 = scripts/strip-head-recall-rows.mjs,由 git-guardian 巡检腿 sweepHeadRecallRows 每 5 分钟派发,留痕 form:dropped 且自带推送腿;自检 6 组 + 镜像 20 例)
- API/后端/DB: `check-credential-leak-in-message.mjs` `check-egress-ip-drift.mjs` `check-credential-presence-bypass.mjs` `check-principal-consumed.mjs` `check-public-exposure-list.mjs` `check-public-admin-default.mjs`(G-875,2026-10-24 立:仓内不得再出现可登录的公开 admin 默认口令;运行面口令一律环境变量注入,历史散列由失效迁移统一作废) `check-capability-field-not-client-supplied.mjs` `check-authorization-column-isolation.mjs` `check-migration-immutable.mjs` `check-db-blind-updatedat-set.mjs` `check-sequence-lag.mjs` `check-error-code-not-text-matching.mjs` `check-error-attribution-single-source.mjs` `check-error-message-bounded.mjs` `check-inbound-schema-strict.mjs` `check-nested-additional-properties.mjs` `check-enum-default-widening.mjs` `check-enum-fallback-terminal.mjs` `check-txn-cancel-boundary.mjs` `check-dockerfile-copy-paths.mjs` `check-edu-arrears-single-source.mjs` `check-sse-frame-watermark.mjs` `check-python-import-landed.mjs` `check-python-import-resolvable.mjs` `check-mode-permission-matrix.mjs` `check-subagent-permission-inherited.mjs` `check-csrf-exemption-shape.mjs` `check-batch-write-count-honesty.mjs` `check-prod-bundle-shadow.mjs` `check-env-drift.mjs`
### 常驻工具(不在 runner,勿当没装车)
- 常驻工具(不在 runner,勿当没装车): `watermark.mjs` `guardian-runner.mjs` `safe-commit.mjs` `git-guardian.mjs` `git-lock.mjs` `deploy-lock.mjs` `union-converge.mjs` `merge-live-doc.mjs` `live-doc-edit.mjs` `object-space-land.mjs` `gate-registry-insert.mjs` `plan-tasks.mjs` `plan-tasks-merge.mjs` `plan-pointer-purge.mjs` `plan-task-index.mjs` `plan-fields.mjs` `plan-field-line.mjs` `plan-row-conservation.mjs` `plan-fields-extract.mjs` `plan-line-age.mjs` `bypass-git.mjs` `face-reader.mjs` `code-mask.mjs` `scratch-dir.mjs` `key-dir.mjs` `secret-path.mjs` `seal-c-root-stray.mjs` `scrub-temp-fixtures.mjs` `c-disk-breakdown.mjs` `plan-union-merge.mjs` `run-evidence.mjs` `visible-window-probe.mjs` `install-console-window-hook.mjs` `audit-pane-store-addressing.mjs` `commit-gate-attribution.mjs` `plan-bypass-ledger-report.mjs` `alert-volume-report.mjs` `provenance-ledger.mjs` `module-context.mjs` `desktop-build.mjs` `git-refs-heal.mjs` `git-backup-refresh.mjs` `heal-worktree-tracked.mjs` `git-sync-converge.mjs` `git-push-converge.mjs` `git-push-guard.mjs` `msvc-env.mjs` `desktop-unsigned-config.mjs` `desktop-build-saas.mjs` `desktop-dev-saas.mjs` `gen-line-icons.mjs` `post-commit-hook.js` `release-desktop-local.mjs` `notify-deploy-failure.ts` `start-dev.ps1` `hook-run-hidden.vbs` `ensure-silent-tasks.mjs`
- 常驻工具(非守门,勿因"不在 runner"当没装车): `watermark.mjs` `guardian-runner.mjs` `safe-commit.mjs` `git-guardian.mjs` `git-refs-heal.mjs` `git-backup-refresh.mjs` `heal-worktree-tracked.mjs` `git-sync-converge.mjs` `git-push-converge.mjs` `git-push-guard.mjs` `git-lock.mjs` `deploy-lock.mjs` `union-converge.mjs` `merge-live-doc.mjs` `live-doc-edit.mjs` `object-space-land.mjs` `gate-registry-insert.mjs` `plan-tasks.mjs` `plan-tasks-merge.mjs` `plan-pointer-purge.mjs` `plan-task-index.mjs` `plan-line-age.mjs` `bypass-git.mjs` `face-reader.mjs` `code-mask.mjs` `scratch-dir.mjs` `key-dir.mjs` `secret-path.mjs` `seal-c-root-stray.mjs` `scrub-temp-fixtures.mjs` `c-disk-breakdown.mjs` `plan-union-merge.mjs` `run-evidence.mjs` `visible-window-probe.mjs` `install-console-window-hook.mjs` `audit-pane-store-addressing.mjs` `commit-gate-attribution.mjs` `plan-bypass-ledger-report.mjs` `alert-volume-report.mjs` `provenance-ledger.mjs` `module-context.mjs` `notify-deploy-failure.ts` `desktop-build.mjs` `msvc-env.mjs` `desktop-unsigned-config.mjs` `plan-fields.mjs` `plan-field-line.mjs` `plan-row-conservation.mjs` `plan-fields-extract.mjs` `desktop-build-saas.mjs` `desktop-dev-saas.mjs` `gen-line-icons.mjs` `post-commit-hook.js` `release-desktop-local.mjs` `start-dev.ps1` `hook-run-hidden.vbs` `ensure-silent-tasks.mjs`
同轮补的后端与承载面(2026-10-21):`GET/POST/DELETE /api/user/ip-whitelist` 与 `GET/PUT /api/agent/security-config` 落进 `user_preferences(group='security')` —— web 那两张卡此前打的是没有后端的路径;两面由判定唯一出口 `apps/api/src/routes/user/ip-whitelist-guard.ts` 生效——挂在各登录腿「凭据已验证之后、签发之前」,空表=未启用,被拒回 403 并落 `security_logs` 事件 `login_blocked_by_ip_allowlist`(覆盖率由 `tests/ip-whitelist-issuance-coverage.test.ts` 机器守)。「Web 功能门户」现读 13 组 91 条(本轮新增「账单管理」`/settings/billing` 与「知识库」`/knowledge`,两端同表,清单唯一真相源在 `packages/shared/src/constants/web-portal.ts`);记忆详情按 web `/memory/[id]`(那张页带编辑+保存,共享记忆屏只有新建/删除)走既有 WebView 承载,URL 形状同样住在该同源。
### REST API(4561 路由)
- 一行行 API 路由从 0 长到 4561
- API 路由从 0 涨到 4561
**2026-10-25**
- 🐞 修复:[207] AGENTS.md 二次清偿 97851→95760 余量 240 —— ①主战收尾合并把我上轮删的两行同题旧副本再插回(活文档 union 认不出清偿副本型删行的同型回潮,R14 已录),再删留指针;②旧 §24「须用户确认」死文本(标题+206B 正文,已由 2026-10-23 机主令作废、现行口径=「24. 新增功能决策口径」)整段逐字移 .ihui-agent/archive/AGENTS_trim-2026-10-25.md 留短指针;③两条点名指针注释精简。IHUI_SKIP_LIVE_DOC_CHECK=1 定向说明:唯一豁免对象=上述同题旧副本与已作废死文本的有意清偿(§1 重复登记/死文本零容忍;逐字留档在案;先例 5e1f901d2f5/72a52b17509 同型),主战在飞新增行(等条件条目同型禁止/端侧读数)一枚未动 (53094555fa9)
- 🐞 修复:i18n 死键门识别模板字面量键 t(`${m}Desc`) 等 (ae95b30a45d)
- 🐞 修复:miniapp-compat 两处 updatedAt 盲写形态改门 198 豁免出口 —— 改密码(L2473)与令牌扣费(L2857)的单行显式键形态命中 G-998153 宽形态棘轮;改写为 .set({ ...changed, updatedAt: new Date() }) 出口形态,字段集与行为零变化(passwordHash 盐随机必变/够才扣条件语句保扣成必变,均为真变化路径),comment 注明必变性依据;验证:门 198 --staged 无新增盲写、turbo typecheck @ihui/api 过、token-balance-concurrency 3/3、g134-updated-ack-honesty 6/6(updated 派生语义直接覆盖) (b0802ff9bf5)
**2026-10-25**
- 🔧 工程/其他:fix(api)+fix(ai-service): 两处谎报正常的故障面改如实 + asyncio 裸任务强引用族收口 —— ① GET /cli/announcements/latest 与 /version 的 catch 原回 200+空列表/空时间戳,DB 故障与'确实没有公告'完全同形(同文件详情端点早已用 500 ⇒ 异类是漏改)。改判前把唯一消费链读实:CLI fetchAnnouncements 对非 2xx 与空列表本就同样 return []('怕 500'前提不成立),/version 在仓内尚无任何客户端消费方 ⇒ 500 零破坏、信号归位;钉 fail-open 的旧用例随契约一起改判,留 CLI 取证注记。② fire-and-forget 的 asyncio.create_task 返回值被丢弃的三处(memory_graph.fire_and_forget_extract、cookie_refresh_daemon /trigger、exec_params CancellationToken._link/cancel_when_either)改按屋内模式(audit_service/knowledge_card_extractor 明文纪律)持强引用到完成:CancellationToken 的 watcher 挂子 token 自身槽位(生命周期语义天然正确:token 被持有 ⇒ 联动活着;没人要 token ⇒ 一起回收),exec_params 另收一段 return 后永不执行的旧实现残留(mypy no-redef 现形)。变异自证(HEAD 旧形态,scratch 进程隔离):旧代码无 _propagate_task/_watches_task 槽(结构档必红),且新锁 7 例在修复面全绿;cookie 46 例、execparams 33 例、announcements 10 例全绿,mypy --strict 三文件绿,ruff 全清,api typecheck 8/8。 (88c60b8fa67)
- 📚 文档:对齐现算口径(表608/API4561/路由文件627/端9/schema235/WS25) (fe3deed00a1)
- 🐞 修复:守门 55 coverage 89/90 归零 —— team_task(D18 团队共享任务板)补显示名映射与五语言文案 (a4bce96c502)
**2026-10-25**
- 🐞 修复:[105] miniapp+web ui-routes 与 remote-locales 派生产物重生成补齐 —— miniapp 会话收尾(8 源文件落定 HEAD)后其输入面已定,重生成 ui-routes/gen:i18n 对齐钉 hash;web 侧主战收尾批(wallboard/checkin/preferences)落定后同法补齐;门 105 staged 现读『未发现漏生成』全绿 (dff9e140867)
- 🐞 修复:对齐源码硬编码口径至现算值(平台38/端9/免费provider24) (f9061a7f593)
**2026-10-25**
- 🐞 修复:VoiceNote 聚焦态描边回归修复 —— 主战收尾提交引入的 brand.DEFAULT 墨档描边(门 83 R8)+ 未配对实底(R3)双红;换 §4 强调描边合法档 brandAccent.deep(端内 BottomPopup/AgentList/BottomActionBar 同尺),聚焦反馈保留(只换色不换宽度,门 212 口径)。根因:原写法依赖门 83 聚焦守卫的 styles 块 key 形态识别,JSX 内联三元(searchFocused ? {borderColor} : null)不为其所认 ⇒ 输入框聚焦态这一 §4 唯一例外位在合法写法下被双门误判,属门间互顶;合法档位换档是无需动判据的正解,门体聚焦守卫的 JSX 内联盲区另录待治 (df1b6341cf7)
- 🐞 修复:c-drive-auto-maintain 补 2b 段「真 TEMP 顶层陈年滞留让位」—— §26 改道后管家天天在扫错误的地板 (9e1c75d1c98)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (6a1cae3d42c)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (f2f8a54ec44)
- 🐞 修复:VoiceNote 搜索框补聚焦态(裸 TextInput 普查锁,G-978007 口径) (6fcaf89ad0b)
- 🐞 修复:doc-numbers 派生块 trackedFiles 改 volatile(结构性防恒红) (2ba88aa276c)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (73a7f7f9e44)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (61392d3fb58)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (24a2ecdf068)
- 🔧 工程/其他:G-02 进展注——①subagents/all 早由 G-299① 落地(旧读数前提过时)零实现结清格,测试加固入库;②③维持 n8n 代理持有人归属 (5e73a08e493)
- 🔧 工程/其他:死端点簇复量遗留收尾——course-qa 注释勘正 + edu/qa 与 messages/private 两枚契约测试(r27h) (17bfd83e58f)
- 🐞 修复:mobile-rn 词包补 topic.detail.loading 五语言(值逐字取小程序包,跨端同屏同字)+ 装上 Provider 身份回归锁 —— 共享屏 TopicDetailScreen.tsx:214 与小程序 detail.tsx:200 一直在取该键而 RN 包缺(小程序端靠内联兜底掩盖);topic-detail-screen-render 5 枚红即此,补键后 10/10 绿,check-i18n-keys/broken-en/zh-residue(zh-TW,ko,ja) 与 prettier 全绿。另:src/i18n Provider 三层身份 memo 化的回归锁文件此前未跟踪(锁没进仓=没装车,§0.9),本次入库并实测 2/2 绿 (c72a93dda9f)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (a1338f03141)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (2ccfa882798)
- 🔧 工程/其他:G-37 翻勾结清——①②既已被前世提交结清复验,③常守活载体本席代裁落地(看门狗任务自愈实测,提交 f815c4536c;落选方案与回退路径留痕) (1f37c2bbe61)
- 🚀 新功能/改进:G-37③ :80 图片 CDN 常守活载体落地——看门狗任务 IHUI-ImageCDN-Watch (f815c4536cc)
- 🐞 修复:ruff B905 — test_d08_team_task_board zip() 补 strict=True(gather 与 agents 一对一,长度不等即编程错误) (0902a3276be)
- 🔧 工程/其他:取号器撞号防线补并发层夹具 —— 两会话同时取号不会拿到同一个号(G-35 已由他席复结,本席补其未覆盖格) (f2c3c882dd0)
- 🔧 工程/其他:fix(miniapp)+fix(gates)+test(miniapp-taro): 门 8 动词式传输口装上后客户端死调用同批清偿 —— 承接配额中断会话的在飞态(该批次曾被并发合并窗洗回工作树,已从对象库按 staged blob 逐枚回捞并验指纹,非重写)。判据面:LINE_TRANSPORT_RE 加动词式传输口(小程序桥接 get/post/put/patch/del 是 fetchApi 薄壳,原一支不认 ⇒ 274 处调用点对该门结构不可见,订单页 404 而门报✅的成因即此格);零宽前瞻+词边界+接收者词根三重收窄把 Map.get/URLSearchParams 同名不同职挡在抽取层。门咬出新增 3 处全清:pay 收银台 GET /vip/order/:no 从未注册(真形 GET /orders/:orderNo,投影逐字 targetTitle/createdAt),「余额支付」档摘除(POST /pay/balance 无注册、/user/profile 从不回 balance、全仓唯一余额账本是 AI token 额度非现金、web 同源收银台仅微信/支付宝两档 ⇒ 跨端对齐;真做余额支付需先定义现金钱包账本,另票);pay.balance/balanceAmount/balanceInsufficient/recharge 四键五语言同批清 + gen:i18n 重派生 + ICU 登记表与 mock 同步;api-settings /about/api-config 面板改本地如实值,连通性测试改真实在册 GET /contact(原 POST /about/api-test 会把 Coze 令牌发往不存在端点,消掉这条设想中的凭据传输链)。一并入库前段在飞修复:password 键名对齐 Zod、alipay 支当场如实拒、email 发码走唯一出口 sendEmailCode、model-edit/n8n 去『接口暂未开放已模拟』假成功改如实报错(§30)、circle/detail 评论/点赞/收藏改真实在册路径与加减形。留痕:LAND_ALLOW_STATE=1 因 i18n 键删除属有意改写(基线逐字节对账通过:16 源文件 HEAD blob 与中断基线一致)。验证:api/miniapp/web typecheck 绿(8/8+6/6),miniapp 全套 80 文件 1032 例绿,门 8 自检 66 例绿且 worktree 面 RC=0(新增 0),ICU/compressed/on-demand 58 例绿。 (ce93d01c09c)
- 🐞 修复:兜底弄死的守门归因由判红改为未判定(§0.3),后果一项不减 (f1fa20213b4)
- 🐞 修复:全量档取材面收到 HEAD blob(§0.4/§12e),--worktree 保留磁盘扫描并自称审面 (f126e734f47)
- 📚 文档:全库口径最终对齐现算值(README 中英双版 + 工程文档 stale 数字刷新) (af84ceca3bd)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (acce43f9e03)
- 🔧 工程/其他:复结 G-79 落地两道门票(goal-r3b 2026-10-25:守门208/守门30a 当次 rc=0,13 文件 2026-10-15 已入库且四枚凭据均为 HEAD 祖先,本行系并集回捞僵尸副本) (e48ab8394e4)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (35704ad6b97)
- 🔧 工程/其他:G-37 ② 判为已过时(内容指纹 8be9a644a5 已落),本行只剩 ③ (e6080496151)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (b03332291b4)
- 🔧 工程/其他:goal-r3 结清 2 票——L7402 机器可见欠账清单收官(死代码删除 2370cd3339e2cc407cce23e24e3b608a222ac375,走查按票面原文并入真机走查包)+死端点簇复量代裁(r27f 六条全已注册零改动结清,三件语义缺口留 commit message 交后手) (d6101473f31)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (e119240e8c6)
- 🔧 工程/其他:G-02 认领租约(goal-r3@2026-10-25 仅接①subagents/all——agent-teams 席位 5 天零提交判休眠,routes/subagent-dispatch.ts 面净;②③n8n 两面仍归 n8n 代理持有人不碰,该文件 5 天内 3 枚提交活跃) (5581324a70d)
- ♻️ 重构:L7402 收官——删除零消费者 DOM 副本 NavBar(packages/app) (2370cd3339e)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (d9bf2e7a7a1)
- 🔧 工程/其他:认领 G-79 落地两道门核验票(goal-r3b 2026-10-25 现读实测:守门208 工作树嵌套仓 / 守门30a 本机对象态悬空 commit) (8354821fd6d)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (966be02197c)
- 🔧 工程/其他:G-73 翻勾结清——窗格族 e2e 15/15 全绿含④a归因关闭(r27d 专席取证,证据进注记;B06 发送链已随 a12ee7500782ebc167dc18fcb9e2cec730861a6f 入库) (41ead978887)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (e768574c267)
- 🔧 工程/其他:批量翻勾结清十四票(全部按复跑判据而非票面自述):--gate F6/F4/F4b 归零、%TEMP 现读到位、运行副本邮件决策已给、门33 单向投影落地、G-49 四格出口在库 29/29、G-64 ratchetViolations 第三参已传、gitdir 指针判据实在位+6/6、G-67 三批注记齐且幂等出口 0 行、G-45 基线两侧归零、G-52 归因 53 命中+56/56、G-63 Step4 普通提交、G-58 负龄判据八处接入+25/25、G-06 决策格消化取证格不占桶、G-48 findForks 与 F4 同尺 F1=0 (07c7e5f9d96)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (7111c8ee703)
- 🔧 工程/其他:goal-r3 结清 4 票——B06 步序四收尾翻勾(a12ee75007,含结清注)+守门112 cache token/G-28 head-typecheck/P1 僵尸实例三票零改动复结(r27b 复量证据进注记) (e89d731d710)
- 🚀 新功能/改进:B06 步序四收尾——发送链路全参数化窗格寻址(承 r26a 暂存面) (a12ee750078)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (05ae732e56e)
- 🔧 工程/其他:G-01 按远端 main tip 31c4acff 现读重列五件,并记 port-registry-check 已转绿 (0b0a5e7c444)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (67ee6f1b40e)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (b9d8a3e9aaf)
- 🐞 修复:G-35 复结翻勾 —— 取号器全文件查重两出口落地,夹具级正证补齐(G-14) (c9b9621aecf)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (e8323d0eeab)
- 🔧 工程/其他:G-67 批1 只读预演回填(7 行够格删除/3 行不可删/复发根因=union merge 回捞) (202f6d53632)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (51a25d32d72)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (7d05c72b04f)
- 🔧 工程/其他:B06 认领租约(goal-r3@2026-10-25 承 r26a 遗留步序四收尾;挂载已在 HEAD 23a2c8ac12,余发送链窗格化验证收口) (e37181f05a3)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (5e031f2940d)
- 🔧 工程/其他:门207 AGENTS.md 体积判据接入提交链已落地,翻勾结清 (628d1242dba)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (b11d9c949b0)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (6e089335a57)
- 🔧 工程/其他:复结 D05 多用户协作会话 —— 另批①②现读核验已完工(collab-lock 三端点 33/33 绿、邀请管理 UI 挂载 10/10 绿),③ 多实例广播缺口按设计稿归另票;goal-r2 零改动复结 (ec0c55ffe46)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (83aa572b23e)
- 🔧 工程/其他:复结 G-76 守门39四处判据(修复枚 bd3bc2238c 在 HEAD 祖先链,现跑门 RC=0/自检 12/12/镜像 11/11)与 P1-② AI 批量对齐(无待处理分叉样本,按销账口径) —— goal-r2 零改动复结 (fe7a11d7de0)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (58a760a7af6)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (7933b944cfa)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (2e1dfcebd86)
- 🔧 工程/其他:批4复核回填 — 双重执行/api-client 假绿灯两行结清,G-01 判未判定,argument-validation 与死端点簇注记 (98c1a4a2a2e)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (49e03684775)
- 🚀 新功能/改进:GA4 补「同格矢量左向箭头」判据(最近可点容器 + 直接子元素,保守四点),撤 learn 页两处 back-label-exempt(HEAD 相对祖先 a3e97593a 只多这两行,撤回即复原) (f71cd0957a2)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (e70755a6e40)
- 🔧 工程/其他:G-96 判为僵尸票结清(四格 HEAD 取证全在位,票面缺件已过期) (d019c6cae73)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (7c125bc8fc1)
- 🔧 工程/其他:G-13 结清 + O01 第三型判未判定 + D03 最小切片落地注记 (b65aa6b3a51)
- 🚀 新功能/改进:转写完成态补一键插入当前对话(复用 draftInput 通道,不经服务端;+1 用例) (8739e84ad49)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (347d20e4f6e)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (3f314b880d0)
- 🔧 工程/其他:G-04 两格结清 + O02 第2/3票(NavBar/ScrollJumpButton 下沉)进展注记 (4d9f7f1746f)
- 🔧 工程/其他:重生成 miniapp ui-routes 自述钉(吸收 Collapsible/NavBar 改动后的 inputsSha) (df920f46c38)
- ♻️ 重构:NavBar 下沉共享核 navbar-core(骨架/标题/槽位入核,几何与无障碍留两端壳);UserInfoCard 因版面差异硬阻塞另票 (17e5b40b65f)
- 🐞 修复:G-04 格② — 陈旧守卫在 blob 模式改判构造提交的对象库 blob(报告加 face),整 blob 命中祖先只报名不互锁 (3754d6b0202)
- ♻️ 重构:门 102 存量清零 — miniapp Collapsible 字形› 改 LineIcon chevron-right,web learn 页箭头位补 back-label-exempt 判据豁免 (c8c62a1ddb2)
- 🔧 工程/其他:清偿 miniapp-taro 105 + mobile-rn 94 枚死键,重生成四端派生件并吸收 ui-routes pin 漂移 (78f0ea893ed)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (1a6776fc89f)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (811a89c7db0)
- 🔧 工程/其他:L6029 face-reader 棘轮红补现读取证(基线60→62、两枚新门、他人在飞删除) (d820cbd0f06)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (bf576a66e5a)
- 🔧 工程/其他:结清 G-07/H04 两行 + G-37① 与欠账清单 A/C 现读补录(2026-10-24) (0217de11a0f)
- ♻️ 重构:ScrollJumpButton 下沉共享核 scroll-jump-core,RN/小程序两端壳只注入 platform (d550594a787)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (0b0e423c7b3)
- 🔧 工程/其他:G-24 判据冲突按票面原文裁定:①10 代是地板、maxFiles=5 是总数上限,两轴独立任一超限即判,地板高于上限时地板胜出并报 capUnmet(不再互相矛盾);②射程改为必填 --root,无硬编码默认根,人读面打印「本次射程/射程说明」,命中 gitArchiveDir() 时点名 retire-git-archive 已覆盖;planGc 用 itemBytesRetired 抵扣总数差额防过删;无日期件 .lintstagedrc.json 不归类、点名、RC=2。自验 --check RC0、11/11(新增 T9/T10 强化 T4)、dry-run --root .ihui-agent/archive 72件32代→保留23待删48未判定1 RC2;未执行 --apply (218876e8b24)
**2026-10-25**
- 🐞 修复:[105] web ui-routes 产物重生成补齐 —— 主战会话收尾提交(wallboard/ai-plugin/landing 批)改写页面源后未重跑生成器,输入面现已落定 HEAD,web 产物钉 hash 对齐(inputsSha256 现算一致);miniapp 产物输入面仍有 8 源文件在飞(另一会话),产物留工作树随其同批提交不代裁 (aee60104329)
- 🐞 修复:第八处 CI 红 —— VoiceNote 搜索框补聚焦态(裸 TextInput 普查锁) (2cc6a2ea0b8)
- 🐞 修复:补建 compat 绑定手机/邮箱端点 —— POST /user/phone/bind、/user/email/bind 此前从未注册,小程序「绑定手机号/邮箱」确认步每次 404 被前端 catch 吞成无响应。判据逐字对齐 auth-extended /auth/change-phone/confirm:同一份验证码存储(code-store.verifyCode,Redis 原子比对+删除消费一次)、同一 409 占用语义、同一限频档;差别只在绑定无旧号可验。归属锚点=令牌注入的 request.userId(§5 认证不等于授权:请求体不收 userId)。行为锁 7 例(miniapp-compat-bind.test.ts):匿名/错码/他人占用三闸都断言写库链零调用,两条正向对照拦 eq() 实参证 where 锚本人;变异自证:HEAD(未建)面整套无法通过、修复面 7/7 绿 + stubs 38/38 不回归。 (c87193d5c07)
- 🚀 新功能/改进:「业务深纵 / AI 号池」两块补更多可监控数据(机主 2026-10-25 要求"更多实际有用的数据") —— 业务深纵新增用户构成 5 格(VIP 用户 / 操盘手 / 邀请注册 / 近7日邀请 / 近7日活跃)与等级分布行(普通·白银·黄金·钻石),全部与 usersTotal 同一次查询的 filter 计数 ⇒ 零额外开销;activeUsers7d 走 sign_in_records 的 (user_id, sign_in_date) 唯一索引。AI 号池新增:Key 健康四态(unknown/healthy/degraded/down,与汇总字段同一把尺子 RELAY_POOL_HEALTH_STATE_VALUE)、余额不足 Key 数(<5 元且非无限)、24h 内临期账号数(补"只看最短临期"的盲区:只修最短的,第二个过期时又宕一次)、按 provider 分组的 Key 与账号分布表(可调度/总数/异常)。号池侧全部在 computeRelayPoolLiveSnapshot 已加载的两份行上累加 ⇒ 相对现状零新增查询,5 秒轮询成本不变。验证:api/web tsc --noEmit 均 0 错、check-i18n-keys 5 语言 parity OK、门 240 --worktree R1-R8 全绿、verify-wallboard-readout --self-test 12/12(建模 60/60 格) (aab60021f45)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (850a49aaa88)
- 🐞 修复:第七处 CI 红 —— Avatar 圆角档回归 shared 规格(md/lg),不迁就 RN 的 2xl (a8852839304)
- 🐞 修复:修 release 包启动即崩(P0)——GlobalFloatBox/PrivacyPolicyModal 调 useI18n 却挂在 I18nProvider 之外 (31c4acff133)
- 🐞 修复:第六处 CI 红 —— PROJECT_PLAN 副本归并归档件补溯源水印 (37b8728d5a9)
- 🐞 修复:第五处存量 lint 红 —— visit-log 测试的 import() type annotation (f9dd9556502)
- 🐞 修复:第四处存量 lint 红 —— auth-gate 测试 mock 的 next/link 缺 href (9fe3d1d63ce)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (7dbc8c28053)
- 🐞 修复:补建 GET /distribution/orders —— 小程序「分销-我的订单」自建站起打空炮 (8c036a661c1)
- 🐞 修复:登出未清内容缓存导致**跨账号看到上一账号的 AI 对话与生成结果** (1ac6f8d5a25)
- 🐞 修复:非中文用户的相对时间兜底不再掉英文;三处列表分组改按本地时区(不再切 UTC 串) (928325829e5)
- 🐞 修复:分页"加载更多"三型缺陷收口 —— 整屏顶掉前一页 / 提前断供 / 页边界重复行 (8817a9a40d4)
- 🔧 工程/其他:侧车两键随让号迁移(G-100#把file / G-101#生产备份链…),waiting 同步改 env (2f141c5f36d)
- 🔧 工程/其他:F9 两枚撞号让后来者改号(G-20→G-100 / G-76→G-101),侧车键随号迁移 (c5787574c2c)
- 🐞 修复:六处"合法为 0 的读数被当成缺失"收口(0 积分显示成别人的量纲 / 免费显示成没数据) (c32be823130)
- 🐞 修复:智能体点赞/收藏收进单事务并对父行 FOR UPDATE —— 无唯一约束下的并发重复计数 (22ee752721b)
- 🔧 工程/其他:侧车五条 waiting 按机主令代裁改判(human→none/env) (e688eb82eaa)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (55f828f091c)
- 🔧 工程/其他:代裁结清余下五条 F11 存量(侧车改判 + 行文同步) (7bb316e3106)
- 🐞 修复:分销佣金"分当元"显示(100 倍)与两处接错后端的取数,统一走 @ihui/shared 的 formatPrice (46758b5b2b8)
- 🚀 新功能/改进:侧车新增声明式改判档 —— 判据修正后旧桶不再被永久钉死 (a59a40b5f8a)
- 🐞 修复:根治计数字段"读出来±1再写绝对值"族,门 243 追加 G5 档(存量实测 10 处→0) (50ca17bd8e6)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (d6000a93163)
- 🔧 工程/其他:代裁结清两条 F11 存量(翻勾 + 已拍板条目改题面) (b9fc733c78a)
- 🚀 新功能/改进:活文档编辑器新增声明式改桶出口 —— 解开机主令与三维守恒的结构互斥 (9c034053fcc)
- 🐞 修复:守门 246 取材改走读取层批量口 —— 逐文件 git show 在 HEAD 面直接判"未判定" (600b0d58a4b)
- 🐞 修复:归属桶不再读侧车投影标头 —— F11「等人拍板」24 条误判收窄到 7 条真决策 (c9e26351407)
- 📚 文档:守门数回补为现算 258 blocking / 16104 跟踪文件(ddf16383c65 装上守门 246 带来的增量) (1ca62f93d03)
- 🐞 修复:业务日界统一到 Asia/Shanghai 单一出口,根治大屏同屏「上海日新增 vs UTC 日签到」互搏 + 装守门 246 (ddf16383c65)
- 🐞 修复:README 守门数回补为现算 280/257/16100(本枚装上守门 245 后的现读值) (ccb1be68122)
- 🐞 修复:根治活文档"同形态副本逐次翻倍"族 —— README 4.6MB→1.1MB,并装守门 245 (95b5a628b0c)
- 🐞 修复:同题折叠认「仅投影标头/尾部注记差异」的两版 —— 治跨机合并 F4 放大把分叉卡死 (37e05b810f5)
- 📚 文档:生成块与散文数字回补为现算值(门 173 落地后点名) (7d05820dc59)
- 🐞 修复:根治「定时器句柄被覆盖」与「零分母读数上屏」两族 + 装车守门 244 (48872214e10)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (51148733d6d)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (b87d50d12da)
- 🔧 工程/其他:G-50 / G-75 同票两版并为「侧车标头 + 对侧富化正文」(含本侧独有注记) (a745c38c304)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (2a9d2b19197)
- 🔧 工程/其他:三处同票两版并为「侧车标头 + 对侧富化正文」—— 为跨机合并消解同题两版并存 (f66ad738723)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (676c6cb43d0)
- 🔧 工程/其他:L7470 死端点簇六路复核:整路径字面量 grep 假 0 修正为 6/6 全通(前缀合成+通用端点改指),三处裸路径改显式 /api 已落 f1ee3fee8e、门 8 主腿 2829→2832 三路各 0→1 判活;仍待三件人定档(bank-cards 无表 / annex-resource 是否新增 /courses/:id/resources / course-qa 与 agent-reviews 语义) (7c3ac208fa7)
- 🐞 修复:生产签出外来工作巡检不再把第三方仓读成未判定(本机 RSSHub 连续 134 分钟假警报) (5bcbc960b47)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (f7f5b44aaf8)
- 🔧 工程/其他:L7472 六路口径修正:三处裸路径改显式 /api/(AgentReviewListScreen.tsx:43 /api/agent-reviews、BankCardScreen.tsx:28 /api/bank-cards、MessageChatScreen.tsx:45,71 /api/messages/private 族);六路实为 6/6 通,票面「5 路 0 命中」是整路径字面量 grep 对前缀合成+通用端点改指的假 0,作废;门 8 worktree 主腿 2829→2832(三路各 0→1 判活,行为不变),mobile-rn tsc RC0、悬空 0(11161 文件) (f1ee3fee8ed)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (3a03f4521ba)
- 🐞 修复:同名函数族扫描先遮字符串/模板串 —— 治夹具里的声明被当成第二份定义(落地复跑假红) (37fac19cde2)
- 🐞 修复:两条告警根因 —— z-index 门对 cn() 遮罩失明;卫生门把 tmp 一次性脚本算成可移植性违规 (5d1ff7294b3)
- 🐞 修复:PV/UV 的业务日不再由浏览器决定 —— visit-log 收口客户端自报时间键 (aa08ed57dd6)
- 🔧 工程/其他:L7467 冷启动盘点复核新增修 1 格:pages/study/my-study/index.tsx 冷启动直发鉴权端点 GET /study/records(user/study-routes.ts:45 + user/index.ts:36 组级 preHandler)补 useAuthReadyGate+waitUntilReady,ui-routes 自述钉重生成;其余格=代码面 60 枚门控/扩展 SW 早退/mcp-store 有意无闸均已在 HEAD,唯一阻塞=机主手机扫码;自验 check-miniapp-generated --worktree --group ui-routes RC0、miniapp tsc RC0、eslint RC0、use-auth-ready-gate 14 passed (0c9e33f2624)
- 🔧 工程/其他:G-16 门128 新增 classArmResolution 解析维(只报数不进退出码):usedClassRefs(带 conditional 上下文的唯一提取式,usedClassNames 改为其键集)、classDefScan、classArmVerdicts、collect 接线、人读面打印、--json.classArm;按票面机主定档:唯一无覆盖定义+无条件使用=resolved,多处定义/!important/非单类/条件取用=undetermined,小程序侧查无定义且非工具类形态=undefined 逐条点名(web/rn 无 Tailwind 配置可解析一律 undetermined,不折成通过);顺带修两处取材(比较运算符后字面量不当类名、@media/@supports/@layer 剥壳后不误判选择器非单类)。HEAD 现读 47 腿中 16 用类名:唯一无覆盖定义33/查无定义0/未判定69。自验 --check RC0(10s)、测试 48 例 T42 在位、--self-test 因另一席未提交的 scripts/lib/cross-end-ui-parity-selftest.mjs 脏副本在 :2570 崩(pristine HEAD 复现同栈,非本批) (3570211ffd9)
- 🚀 新功能/改进:迁移缺口审计接入守护巡检(30min 节流;缺口集合进告警身份) (69f0e349f71)
- 🔧 工程/其他:G-91② 全量基准门:all-checks-runner 末段固定输出「总耗时/门数/预算/判定」,预算与基线读自新文件 scripts/check-all-budget-baseline.json(budgetMs=120000, baselineMs=156711);新增 pnpm check:all:120(--budget-strict,超预算 RC=1),默认 check:all 只报不顶红(耗时不是判据真假;失败路径由自检 A12 钉死);自验 --self-test 13/13、check-gate-wiring RC0、--budget-strict 实跑 RC1(27 步 25 通过 2 失败:第13步 check:miniapp-generated 与第18步 scan-dead-i18n-keys,判定面均 HEAD 且非本批产物;首次全量 156711ms/27 门) (1f654a6c5f1)
- 🐞 修复:两处入账的丢失更新(管理员调整余额 / USDT 到账)改为 DB 侧原子增减 (0450d797418)
- 🚀 新功能/改进:迁移账本「中间缺口」审计与修复器物 —— 治生产库长期落后代码且部署只说档位噪声 (e0ed1d8105a)
- 🔧 工程/其他:G-40 A 格最小落地:command_ack_facts 表(复合主键 child:<parentSessionId>:<sourceCommandId> 即幂等键,status/载荷双 CHECK,expires_at 索引,尾部回滚注释)+ TS 镜像(schema/index.ts 导出)+ journal idx342;run-idempotency.ts 仅记 E 格 TODO 点名写入侧 agent-runs.ts:304-318 与重放侧 :725-731,不半截实现。自验:bookkeeping --worktree 342↔342、schema-drift(TS608/迁移611,dead=1 存量 rag_chunks)、immutable、ledger-drift 无 DSN=SKIP、scripts/tests 38 例、@ihui/database tsc RC0;未跑(无 PG):from-zero/真实应用/drizzle-kit generate (14df3f14f00)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (44c6681ef70)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (4a1c78d5df9)
- 🐞 修复:行内标头按侧车收口 8 行(3 条 malformed + 5 条陈旧) —— 门 234 A2 清零 (9fe2a464509)
- 🔧 工程/其他:侧车去重 91→87(4 条被新记录接管的旧副本) (48c19258605)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (604a52d0999)
- 🐞 修复:ws-payment 归属校验改为 fail-closed(两处降级放行是活的越权口) (713efc621e2)
- 🔧 工程/其他:结清 门39 六屏共享层下沉 + D42046 断线窗口待决审批重放(r2d 席 2026-10-25,零改动现读凭据行内) (887902d5ccf)
- 🐞 修复:侧车写入链路三处根因补齐(散文优先 / 去省略号 / 投影保散文回退) (6596afa1ba6)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (58be7dd6c78)
- 🔧 工程/其他:三翻勾结清 G-61(--root 修复在 HEAD+镜像 76/76 全绿;heal 回捞根因器物 RETIRED_LEDGER 随自愈器修复提交入库激活,窗口外拒复插;诊断出处按内容锚点指门体头注) (5fdb3e8b96f)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (4b7215ce475)
- 🐞 修复:陈旧行内标头按侧车重渲染/摘除 6 行(门 234 A2 收敛) (7416c88b28d)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (98b5de5e77c)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (50d1bb1ddab)
- 🔧 工程/其他:认领 门39 六屏共享层下沉(r2d 席 2026-10-25) (1caff10ad83)
- 🔧 工程/其他:侧车同键去重 105→87(18 条重复记录;解析映射逐键零变化) (6a55e44ef13)
- 🐞 修复:侧车投影可往返 + 抽取器只加不减 + 同键去重入口(门 234 根因三连) (f9c1514b303)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (e88befc9306)
- 🔧 工程/其他:结清 D42046 断线重放票(diff①/diff② 均已由 D690 方案 A 批次落地 8214722404;r26b 现读核实 129 例全绿零改动;过时注记交后手) (3a49101391f)
- 🐞 修复:提现释放冻结补齐额度守卫(G3 存量归零),并给兑换补运行时行为锁 (a0e53989322)
- 🔧 工程/其他:工具两件:G-62 第二版 F5 恢复等价注释(②档 b-o 即 max(基底,本侧),未复制期望值基准,用例 58/58 不变)、G-24 新建归档回收器 archive-gc(默认 dry-run/三条判据 maxFiles5+100MB+keepGenerations10/未判定 fail-closed RC2;真实 .ihui-agent/archive 现读 72件32代→保留23待删48未判定1;9 例自检);不含 --apply,不改既有归档 (785d9eca686)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (2f2368da057)
- 🐞 修复:行内标头按侧车重投影 16 行 —— 门 234 A2/同键矛盾走正牌出口 (5468186d7f7)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (d50fcd1cf91)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (3b24a9a9db1)
- 🔧 工程/其他:认领 门39 六屏共享层下沉 / D42046 断线窗口待决审批重放(r2d 席 2026-10-25) (71ca38eee9e)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (61864c2094d)
- 🔧 工程/其他:B06 认领租约(r26a@2026-10-25 接手余步序四;前牌 goal-r52 超 72h 且会话已收官,按 §1 交回派单面) (33d0312d05d)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (cc8e353c6eb)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (1ab2f4992bb)
- 🔧 工程/其他:结清 G-38(三条 P1 目标票已离场,漂开副本归并出口诉求前提消散,零改动现读凭据行内) (21487be7d7f)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (5d71c78cdfe)
- 🔧 工程/其他:复结取消信号+宿主故障标记孪生再回捞两枚+结清审批代际CAS票(approval_generation_cas.py 整套在 HEAD,票面 grep=0 系 2026-10-13 过时读数;三行均零改动现读凭据行内) (cf106d58c02)
- 🐞 修复:check-credential-health 服务存在性探测换通道 —— sc.exe 属本机程序黑名单，spawn 那一刻安全策略杀的是整个 node 进程(RC=143)，致 IHUI credential-health 每 6h 巡检腿整条静默消失；改为先经 Get-Service 读同一份 SCM，sc.exe 仅 IHUI_ALLOW_SC_EXE=1 兜底，探测不可用仍返回 null(不误判，未放宽任何门) (d45af31ef71)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (878a312df9f)
- 🔧 工程/其他:结清 G-35 取号器撞号票(形态 A 18e4bf960c+形态 B d34600b0e84 两出口占用面补全;镜像族全绿;存量 9 组清偿去向登记) (8779ebae1be)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (1a70ac6955c)
- 🔧 工程/其他:r2e 基建普查注记 —— scripts/ 下 reg/schtasks/sc 类黑名单 spawn 一律改 PS 通道（换通道不跳门，读不到如实报未判定） (c29d41e11a4)
- 🔧 工程/其他:侧车抽取正规产出 12 条(plan-fields-extract --apply,bucketsDrift=0) (70520a6fbc1)
- 🐞 修复:G-35 形态 B —— 第一发号出口 live-doc-edit 补扫工作树副本(r25k 席,主会话裁决采纳档)—— CAS 循环内每轮读工作树副本用同一把尺 scanFamilyIdHits 扫(先剔租约行与 HEAD 面同口径),副本独有号并进占用面(并集方向:HEAD 证据保留 fromWorktree:false 不倒扣,镜像 ⑧b① 钉);worktreeText 缺省 undefined 本维完全缺席行为与改前逐字同形(⑧b②),读不到退回 HEAD 宽面警告出声(⑧c);命中明细带来源面「工作树副本第 N 行(未提交)」;I10 形状锁收窄到立法意图(幂等判据区段零磁盘取材,收窄不削判据,工作树维另由 ⑧c 锁);验证:live-doc-edit 自检 29/29+组合 169/169+collision 10/10+id-collision 19/19+next-plan-id-remote 14/14 全绿,水印 6/6,--check exit 0;形态 A 已入库 18e4bf960c(收编器) (d34600b0e84)
- 🔧 工程/其他:门94 补 D08① 团队任务六码(唯一真源+五语词包+用例):mcp_server.py 产出的 ALREADY_CLAIMED/BOARD_FULL/FORBIDDEN/INVALID_STATUS/TASK_CLOSED/TASK_NOT_FOUND 入 ERROR_CODE_CATALOG;实测 check-error-code-coverage --worktree 111 码/128 条全覆盖、五语词包 19174 键 parity OK、error-catalog vitest 16/16、@ihui/shared tsc RC0 (1062bcb3daf)
- 🐞 修复:已结清短留痕 —— 窗口外不再把已翻勾的票复插成未勾(G-61 型) (25ca3e6be2d)
- 🐞 修复:积分兑换超卖与提现回调黑洞根治,并装守门 243(额度写影响行 / 回调吞失败) (bddb7beaff4)
- 🐞 修复:两端 ui-routes 派生产物按 HEAD 输入重生成(门 105 转绿) (b1f5c1c3848)
- 📚 文档:删除被并发 union 回插的重复速查块(97,095 → 95,057)—— 门 207 体积回预算 (6c96fc42260)
- 🐞 修复:第三处存量 lint 红 —— agent-free-times-authz 的 import() type annotation (dcaa35a376e)
- 🐞 修复:生产构建改 staging 原子换入(构建期零影响)+ 部署锁 run 托管;DevEnv 根按机器标记识别;凭据巡检停用备份口令真登录;AGENTS 去重回预算 (7d36e564f57)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (98091967daf)
- 🔧 工程/其他:安装器三版沙箱编译实测进展注(基线/A/B/C 四轮真实构建读数+还原自证;选型归机主票不结清;未尽②全帧目审仍开) (5ee1dd77682)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (651decf90cd)
- 🔧 工程/其他:D08 订正注(D06 前置已按完成即删摘除,首条注记的当次现读已过时;r2a 席) (cd379d91073)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (e2ba1dcb349)
- 🔧 工程/其他:G-35 进展注(形态 A 第二出口远端避让已落盘 19 臂绿;形态 B 已裁决采纳续做;存量 9 组清偿去向登记) (a9c1b939f1a)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (046f9979c70)
- 🐞 修复:G-35 第二发号出口补远端号集避让(r25k 席)—— next-plan-id.mjs 发号路径原只吃 remote.max,远端低位独占号(本地面已让空/已推未并)结构上不被避让会被当空闲发出(与第一出口 live-doc-edit 自 G-454② 已扣远端号集两出口同漂);lib/plan-id-lease.mjs 加 remoteIdNumsOf 单源投影,liveUsed 并入远端号集(同号集恒等并行为逐字同形)+skippedByRemote 逐枚点名;镜像 T11a 三段(修复前撞号实证/修复后顺延/恒等并反证)+T11b 装车形状锁;验证:next-plan-id-remote 14/14+plan-id 族 7 镜像 52/52+--check exit 0(建议号 O65 含远端避让)+水印 3/3;2026-10-22 三连撞号病型已由 c84e98229c 收清、夹具 7 条正证在 allocator-collision (18e4bf960c0)
- 🔧 工程/其他:chore/fix(plan): r2c 席核验派单口径 11 行等条件 —— 2 条前置已成立结清(G-55 trace 列 / P1 残余② desktop 日志 target),9 条改写为可机读成立判据并补当次实测值 (e551927717d)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (0fe3d826f6c)
- 🔧 工程/其他:D08①团队共享任务列表落地进展注(goal-r2 2026-10-25 r2a 席;③ 归属 web 在飞面) (215fe312e59)
- 🐞 修复:又一处存量 lint 红 —— chat-sync-rev-persistence 测试的 Fastify import 未使用 (c75a540f094)
- 🚀 新功能/改进:D08① 团队共享任务列表 —— team_task 工具(子 agent 可认领/更新条目) (42ac1f1a682)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (28cfabd24e0)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (01d74c51f43)
- 🔧 工程/其他:复结取消信号+宿主故障标记两枚并集回捞复活体(8894762aed 已实现+cf4321f8d0 已翻勾;r25j 现读核实 10/10 GREEN,零改动按门 239 单调性复结) (b8cb8144768)
- 🐞 修复:开发者密钥弹窗「权限点/说明」改走语言包(adminTools.developer.permissionLabel/permissionHint),五语齐;该文件硬编码 chrome 归零 (e4f57db0da3)
- 🐞 修复:收口 /api/agent-free-times 匿名挂载 —— 空 body 的 /reset 不再清零整表 (dca9bbbd6d5)
- 🔧 工程/其他:G-1102638 批1 同主键副本行物理归并 — 删 7 行(机主拍板〔拍板@2026-10-08 机主:真删+立即执行〕;幸存者规则与F4同向;落账注记行保留待批2;复跑auditPlan对账F1=0/F9不增;逐行留痕 .ihui-agent/archive/PROJECT_PLAN_copy-purge-2026-10-24.md) (2cb472ebe55)
- 🚀 新功能/改进:G-67 判据④补「归档已勾主行」档 —— 陈旧悬空指针可删、主行仍活仍拒删(fail-closed);7 例自检 + dry-run 候选 7 行 (75d2a278471)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (62addf0b582)
- 🔧 工程/其他:结清 G-79(待落 13 文件已由 f9b56e4278+a6c7cb36ec 入库,零改动)+ 复结窗格续传同题孪生复活体(引用 L7817/7818 结清凭据,门 239 单调性) (227c4f01ca8)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (77583333a7d)
- 🐞 修复:G-04 落地器水印预检改判「将要提交的那个 blob」(cat-file + 临时副本,豁免面按 REPO_ROOT 复算),不再判工作树盘面;76/76 + 23/23 自检 (62f7eb65c69)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (d2938d435ca)
- 🔧 工程/其他:B02 resync 切片进展注(rev PG 权威源+快照端点+gap 接线,160 例绿,剩余面 5 条登记)+ 结清 L7648(401→502 映射代裁,132 例绿) (4ed1a7edfa3)
- 🐞 修复:第二处 G-948 回归 —— course/detail 入口桶文件次序(CI Build 已复现新冲突对) (e3635cc7406)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (22a3aaa5a7a)
- 🐞 修复:更正 e6cfb5cf563 —— knowledge-rag 三处 query 局部成了死变量 (c15feca74b5)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (c3e485ddf68)
- 🐞 修复:存量 lint 红归零 —— 两个号池测试文件的 3 处 eslint error (e121b36c406)
- 🔧 工程/其他:重结 D06 /review 票(回潮修复:union 归并带回旧行,7f20caf30f 已在祖先链;主席裁定代行) (2ef3c77ef93)
- ♻️ 重构:返回键无障碍名改由 wrapper 注入 i18n(common.back) —— 共享层不再写死中文,消 scan-hardcoded-zh 增量(有意重引入 useI18n:此屏 UI 已下沉共享层后一度无取词点,现新增 a11y 标签需取词) (078dd7c8445)
- 🐞 修复:L7648 非会话 401 被当会话死亡代裁结清(r25i 席)—— 口径:真 401 只有 api 鉴权层能发,过了 api 鉴权之后上游/内部 401/403 一律映射 502;唯一映射实现 errors/upstream-status.ts mapUpstreamOutbound(401/403→502+UPSTREAM_AUTH_FAILED,422/404/429 语义保留,区间外兜底 502 同 v1 先例);新错误码 UPSTREAM_AUTH_FAILED 走 codes.ts 注册形态(守门 206 零增量);ai-chat-stream 3 处主通道+v1-multimodal 2 处对外面+agent-extended 兜底 ??401 收窄 ??502 接线;response.error() 加可选 errorCode 三参(两参形状逐字节不变);测试 10 例(核心对照:上游 401⇒502 非 401 端到端+本服务鉴权 401 仍 401)+132 例回归全绿;typecheck 8/8;水印 7/7;遗留:同型透传点约 15 处逐点收编(helper 已就位,语义各异须单独核,不在本票授权面) (d42caa742a5)
- 🐞 修复:生产 web 构建脚本补 node22-lts 候选 —— 原三条候选(C:\Users\Administrator\.workbuddy\binaries\... 与 D:\DevEnv\runtimes\node22\node.exe)在本机全部不存在,构建脚本 [FATAL] Node 22 未找到、生产 web 无法重建(2026-10-25 实测阻断一次全链部署)。本机实际在位的 Node 22 是 D:\DevEnv\runtimes\node22-lts\node.exe,已用它成功跑完 next build(7.3min 编译 + 类型检查,BUILD_ID=lGLze0tuCla8z1ZhrisTr,IHUI-WEB 自动重启正常)。SWC 在 Node 26 上 STATUS_STACK_BUFFER_OVERRUN 的老结论不变,只是执行者路径要按本机现读取值(AGENTS 首部七类机器事实) (d4d718cd813)
- 🐞 修复:根治身份主体族缺陷 —— crew/knowledge 匿名越权,并装守门 242 杜绝回潮 (e6cfb5cf563)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (5e39b95ebfe)
- 🔧 工程/其他:D08 Agent Teams 协作协议 前置未解除进展注(goal-r2 2026-10-25 r2a 席) (49ee66a8f56)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (24b0a6e3b48)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (7a9c9c6d33e)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (2db12443a26)
- 🔧 工程/其他:登记 P0 —— PG 备份链空转(IHUI-PG-BACKUP 服务未安装/sc query 1060;脚本已修到可跑且运行副本已同步,但无 03:00 节拍器等于没备份;出路=装 nssm 服务或由部署机承载+建只读 beifen 角色) (01ef2d5e6f8)
- 🐞 修复:题面指纹 16→32 字,避免同前缀不同票被一并豁免 (1902f5ed847)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (612a65ee7cc)
- 🔧 工程/其他:结清 L7209 门33 provider 名单票(2026-10-07 拍板②已落地单向投影消灭手抄名单,现跑 rc=0 九 provider 全识别,零改动) (420077e8337)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (336654db9d9)
- 🔧 工程/其他:翻勾结清八票(服务定义入仓+基准维 self-test 90/0;门98 D6 维 rc=0;O01 孪生 0;USDT 两 env 非空;H04 三语 JSON OK;门112 双根齐;G-28 CI 接线 714efaa19196;G-61 镜像 76/76 且系被 heal 捞回再翻) (154404a1aa9)
- 🔧 工程/其他:认领 D08 Agent Teams 协作协议(goal-r2 2026-10-25 r2a 席) (c4734de1ed2)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (b1026855a81)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (61a536ce317)
- 🔧 工程/其他:精确摘除 A2 回潮的 4 条同题变体(按复合主键,不按 16 字题面) (ac77ba67992)
- 🔧 工程/其他:结清 L7334 health 契约分叉票(代裁=web 读法对齐后端;backend-health 换真多服务端点+monitoring-dashboard 同型分叉同批清,入库 d107d57a2f;落地器瞬时判红的 scan-hardcoded-zh 复跑两面 rc=0,系并发索引中间态非本票引入) (87e3f1000e5)
- 🚀 新功能/改进:G-10 门接线 —— check-service-binary-paths 加仓内基准对账维(列出/在册/缺/启动类型/Application/快照过期六件事;只读只报数,不参与 computeExitCode,基准读不到或坏 JSON 记未判定);__test__ 导出同步加 normalizeStartType/parseServiceBaseline/compareServiceBaseline/readAndCompareBaseline/BASELINE_REL/SERVICE_BASELINE_PATH;补回 HEAD 的 F3 G-158 修正(isAllowedScratchRoot + gitFaceEscapesToRepo 两维);LAND_ALLOW_STALE 理由=复活守卫把席 J 新写的 const services=[] 与 2026-09-28 祖先同文本行撞车误判(已逐行核对:HEAD 内容零丢失,__test__ 两项为正常重写、旧导出名全保留);验证 --self-test 90/0 rc=0 全绿、基准行 列出3/在册3/缺0、全量 rc=1 为存量机器态 (cf4cda08c26)
- ♻️ 重构:五站返回键/箭头收口到共享 BackChevron 与 LineIcon(零字形箭头);死副本 NavBar 只报证据不动 (1e63ced855e)
- 🐞 修复:合并吞并门 A5/A6 不再把「机器生成块」翻新判成内容丢失 —— README×4 那次 reset 的唯一差异全在两枚标记块内,A5 只比 blob 退回基底 ⇒ 恒红顶住提交链(§12e) (3888c3708aa)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (1b8c99cb145)
- 🐞 修复:check-c-drive-pollution 注册表读取换通道 —— reg.exe 被安全策略黑名单 spawn 时杀的是本 node 进程(RC=143),致 live-doc-edit/safe-commit 整条落地链断裂;改为先走脚本宿主读值、reg.exe 仅 IHUI_ALLOW_REG_EXE=1 兜底,读不到如实报未判定 (2500db80556)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (3560fe13f58)
- 🚀 新功能/改进:补「用户增长」近 14 日每日新增曲线 —— 后端 buildBusiness 新增一条独立 catch 的聚合(createdAt + 8h 按上海日界切分,与 usersTodayNew 同口径;窗口 = shanghaiDayStartUtc(13) 起含今天),查询失败整块 null 不渲染(§0.3 不把"没量到"画成 14 根 0 柱),成功则按 shanghaiDateString 逐日补齐 14 天、无行日期填真实读数 0;前端 BusinessSnapshot 加 userGrowth 字段 + userGrowthOption(CHART_CYAN 面积折线,62px,与签到 7 日图同族),业务面板左栏用户三格(注册/活跃/今日新增)之下紧接增长曲线;packages/i18n 五语言补 userGrowth14d 键。验证:api/web tsc --noEmit 均 0 错、check-i18n-keys 5 语言 parity OK(19156 键)、门 240 --worktree R1-R8 全绿、verify-wallboard-readout --self-test 12/12 (1fb444802bc)
- 🐞 修复:文档数字门屏蔽 RECENT UPDATES 块 —— 自动抄来的「100 llms → 100 llms」是历史陈述,不是当前总量声明 (be12ee7a531)
- 🔧 工程/其他:侧车再对齐 3 条(并发新行;bucketsDrift=0,回读 79 条) (521c75d74f0)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (155d311e600)
- 🐞 修复:L7334 health 契约分叉清偿(web 读法对齐后端,后端契约不动)—— backend-health 页换读真多服务端点 /api/admin/monitor/services(r25h:原 apiOrThrow<ServiceStatus[]>('/api/health') 把单对象当数组,.map 必空;新端点 requireAdmin 回 success({list}),ServiceStatus.status 补 running 档+删后端不存在的 message 死分支+ICONS 键对齐后端 name+健康判定 !==unhealthy);同型隐患同批清:monitoring-dashboard 页(该端点回 {list} 信封而页按 ServiceItem[] 读)——page.tsx 解 list、types.ts ServiceItem 补 running+ICONS 键对齐、MonitorStatCards 判定 !==unhealthy;tsc 全量唯一红在 r25d 在飞中间态文件(use-conversation-broadcast-sync)非本票面,本票 4 文件 0 错 (d107d57a2f7)
- 🚀 新功能/改进:D04 富文本动作锚点装车 —— 消息正文含锚点时走 RichAnchorText 白名单渲染(不进 rehype-raw),a/link 仅安全 URL 出真 href;5 例新测试 (83321dbba3f)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (1312e8f5507)
- 🔧 工程/其他:G-21 格⑤落格收口注记(agent-control 在飞图 CAS 驱逐+入口拒重复,枚 447e047a7b6 全量在注记)+④⑥证据刷新;租约按器物形态保留待 TTL 代摘,余格交回派单面 (1ef258d66bd)
- 🔧 工程/其他:侧车搬说辞 30 条(抽取前后归属桶零漂移;存量 123→92) (c6e4dae08c4)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (571aa33dddf)
- 🔧 工程/其他:翻勾结清三票(活动时钟单调:G-820/G-821 已在库 46e9a67095、session_store 九写入点全 max()、test_session_store 50 passed、值级探针 PROBE_RC=0;门13d 同行叠注记维已在且 --self-test 8/0+全量 rc=0、DUP_POINTER_RE 不扩字族仍成立;G-91 尺子②:audit-benchmark-delivery --strict rc=0、29 条/43 断言/未建档 0、三态 42/1/0) (e5037766201)
- 🔧 工程/其他:r2-infra 落地链验证（黑名单程序换 PS 通道） (9e19de0f3fc)
- 🐞 修复:补回被 73d1ed177b8 连带抹掉的 130 处 web 五语言键(workPanel / reviewTarget / captureTraeWeb / expertRoute / injectionKindExpertPack) (43c7ec0fd1c)
- 🐞 修复:Build 步骤加 --force —— 消除 turbo 缓存把不完整 api-client dist 固化的通道 (a2a9f872342)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (2120941b104)
- 🔧 工程/其他:G-67 回填十条指针行逐条判定(4 条陈旧悬空可删 / 3 条主行仍活禁删)+两尺失明带 (8d2266f7367)
- 🔧 工程/其他:F11 存量清零后刷新基线注记(24→0;地板仍为 []) (1a929de6660)
- 🐞 修复:补回被 73d1ed177b8 误删的 ide.agentsMd 19 键 + settings.expertRoute 4 键(五语言)—— 根因:该提交删键时两个消费组件(agents-md-generator.tsx/expert-route-card.tsx)正处工作树删除态被判死键;本会话已回盘恢复组件(R13),缺键随之显形。键值逐字取自删除前提交 73d1ed177b8^,文本级插回顶层块(parse+键数断言,五语言 parity 绿);只补有消费的键——hint/auto/off 等 6 键其消费者已随该批移除且未恢复,不回补以免制造新死键(web 死键门复验仍 0) (c891e141efe)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (474e1fe6ca7)
- 🔧 工程/其他:G-29 第二十一批 10 站进展注(065957e4ae5,39→28)+ G-21 第③格完成进展注(cause 链脱敏代理入库) (66d3d39b442)
- 🚀 新功能/改进:首屏按机主关心的「用户数据 / 增长 / AI」重排 —— KPI 带用户卡与 AI 调用卡前置到最左两格(用户卡 sub 即今日新增=增长读数,不另开第 7 张卡:六列档会落成 6+1 孤格);主体网格 order 四档化 wb-prio-user(-40 业务纵深)/wb-prio-ai(-30 号池)/wb-prio-traffic(-20 访客与机器人 PV·UV)/wb-prio-trend(-10 流量趋势),1920 下首屏两行即读完这四块,主机/服务/质量/告警/数据层/边缘/运行时长顺次后移;业务面板内部把用户三格(注册/活跃/今日新增)+签到 7 日增长图提到左栏顶部,接口调用排行下移为纵深信息。取代原两档 wb-flow-first(-2)/wb-business-early(-1)(同值回落 DOM 顺序、编排会静默失效的旧形态,类名同步删除避免定义无消费)。验证:门 240 --worktree R1-R8 全绿、verify-wallboard-readout --self-test 12/12(建模 49/49 格未脱钩)、apps/web tsc --noEmit 无错。并发说明:走 object-space-land 落地 —— 普通提交路径此刻被并发会话的 lint-staged 争锁阻塞,且它会对他席在途文件(stash/restore 工作树)造成污染;README×4 为他席已暂存内容,本票不代提交 (639bd7f7797)
- 🐞 修复:ai-plugin.json 描述对齐现算值(API 956→4561 / 路由文件 100→622 / 表 329→606 / provider 18→94) (3eaae06aecf)
- 🐞 修复:G-21 格⑤ agent-control 在飞图并发守卫(对齐上游 in-flight 合并+CAS 驱逐纪律) (447e047a7b6)
- 🚀 新功能/改进:G-21③ 诊断量代替原文 —— mcp-credentials.ts cause 链脱敏代理(redactedParseCause:JSON.parse SyntaxError 原文经 V8 短消息策略会整段嵌凭据片段进 crash-handler flattenErrorForReport 与 console.error 两个消费面;代理后只留位置数字诊断量,message 经 @ihui/shared redactSecrets 兜底,依赖已有未新增);新增 4 组威胁模型测试(裸 token/三段式 JWT/深处失败/正向对照)全绿;既有回归 mcp-credentials 族 105 + oauth 族 47 全绿;turbo typecheck --filter=ihui-cli 8/8;水印 verify 1/1 (5d9a026c9c9)
- 🐞 修复:G-44 告警去重身份从整条消息文案改为「类别+归一化骨架」——16 个稳定枚举+时刻/路径/hex/数字归一,累计次数由既有 repeatNo 承载不进键;补 11g 读数漂移同槽/11h 异族不共槽;harness pass=44 fail=0、mjs 7/7、deploy-alert-dedup 17/17、门224 --worktree 与 --staged 身份抖动0(豁免1)/自检15,ihui-deploy.ps1 仅同步一行注释;ci: G-28 HEAD 面逐端 typecheck 接进 ci-monorepo.yml typecheck job(id=head-typecheck,45min,预算30min/单端10min),TRIAGE_IDS+O_HEAD_TYPECHECK 同步;本地实跑 rc=0(20端通过/已入库红0/未判定0,484s),YAML parse rc=0,check-ci-failure-triage-wiring --staged rc=0,check-gate-wiring R1/R2/R4 rc=0 (714efaa1919)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (d85e4c530ad)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (f0c49713407)
- 🔧 工程/其他:补删 F11 最后 2 条(题面维已装车,回捞应被声明挡住) (47bb7ea918e)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (87f3f8cbe2c)
- 🔧 工程/其他:翻勾 G-22(F9b 畸形登记号维已在且进收敛闸,现读 0;四套件 145/181/58/82 绿) (ed0c8f671e9)
- ♻️ 重构:G-29 第二十一批 10 站接 flag-value 单源(requireFlagValue 判死:漏值/坏值 exit 2 点名实得 token;纯函数层契约不动语义未变)—— i18n-messages-exist/--root、load-state-loaded-marks/--root、migration-immutable/--root、miniapp-build-artifacts/--dist、turn-ordinal-lock/--root、txn-cancel-boundary/--root、theme-prop-wiring/--root(旧裸取值改判死)、tool-contract-declared/--today、scan-upstream-models/--provider、sync-alpha-usage/--face;另修既有断裂:check-batch-write-count-honesty 补 3 旧出口转发(0ce9314545 拆层未留转发,state-guard 加载即炸);探针+30 支全 rc=2;镜像 10 套全绿;只读尺未接 39→28 (065957e4ae5)
- 🐞 修复:/landing 收款落地页口径对齐现算值(8端→9端 / 339表→606 / 100模型→101 / 14平台→38) (4be00e3625b)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (804700feb24)
- 📚 文档:补齐对外 SEO/roadmap 漏网口径(100 llms → 100 llms、roadmap 8 端 → 9 端) (333fd912418)
- 🔧 工程/其他:翻勾 G-36(圆角死类名代码面归零+门77/150/235 三绿实证,余人工观感项) (f6cd572b1bb)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (d1f9ff98905)
- 🔧 工程/其他:结清 G-47 三红票(①端口门 rc=0②ruff 全绿两枚入库③lint 根因=产物目录缺 ignore 已补入库 7611a789c5;三格齐绿判据零放宽) (e1a6a59d5fc)
- 🐞 修复:G-47③ 受保护检查 lint 红清偿 —— apps/cli/eslint.config.js ignores 补 dist-sea/**(SEA bundle 构建产物,gitignored,同 dist/coverage 性质;4072 个 lint error 全部来自 dist-sea/ihui.bundle.cjs 单文件,判据零放宽、产物退出射程);复跑 pnpm run lint rc=0,turbo typecheck 47 任务面绿 (7611a789c59)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (19d26c0a479)
- 🔧 工程/其他:二次结清 G-61(首次翻勾被并发旧基线抹掉、回捞按未勾态复插;凭据 = object-space-land 镜像 76/76 两轮) (5a54bfaff50)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (536679efbc5)
- 🔧 工程/其他:O02 第④格回填现读读数(BottomActionBar 20/InputArea 18)+最小第一步清单与拍板前置 (8b23d590bde)
- 🐞 修复:G-47 ruff I001 清偿第二枚 —— mcp_server.py:5345 import 块排序(ruff --fix 自动归并同源导入块;上一枚 5b3c657347 因改动在工作树未随 pathspec 进链,本枚补交;uvx ruff check . 全仓 All checks passed) (9c092c779fd)
- 🐞 修复:G-47 ruff 存量代裁清偿 2 处 —— tests/test_voice_tts_stream_router.py:26 F401 未用导入删除(该文件仅 1 个历史版本,删后 blob 不撞祖先,门 84 零风险;pytest 7/7 GREEN);mcp_server.py:5345 I001 import 排序(ruff --fix;改前三方比对确证幻影 M:索引 blob==HEAD 即 mtime 漂移非在飞);改后 uvx ruff@0.16.6 check . 全仓 All checks passed (5b3c6573477)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (217442aafad)
- 🔧 工程/其他:G-47 ②清偿进展注(ruff 2 错代裁清:测试 F401 删+mcp_server I001 幻影确证后 --fix;ruff 全仓 All checks passed;①rc=0 现读;③全量验证在跑) (308796bfe5b)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (2c35955af7d)
- 🔧 工程/其他:结清 G-28 HEAD 面类型检查出口票(器物已在库 check-head-typecheck.mjs+镜像,self-test 23/23,零改动) (906c5d09603)
- 📚 文档:表格/tooltip/toast 一族给技术定论 —— 不是缺陷,不建门 (84db1779e9a)
- 📚 文档:README 中英双版数字对齐现算值(9 端 / 101 模型口径) (59d386cabed)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (fc12053235e)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (710b4dd47f1)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (349253de0bd)
- 🔧 工程/其他:回填四票进展注记(G-29 第二十批十站 / G-62 F5 问责恢复 / D08② 换手事件 / D06③④ 收口) (eb294fd9c62)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (5ab90ce2d66)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (46ffaf48c13)
- 🔧 工程/其他:G-21 挂租约认领(zcode-main@2026-10-25,按票面「派单时逐格可」逐格推进:先刷新六格证据核我方落点,优先③⑤⑥,①②量力另派) (48a465e21e1)
- 🐞 修复:清 push 门两个 not-ours 红 —— 三处 spawnSync 补 stdio + api-client 桶补两个 D09 类型导出 (ece5ac5de3e)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (84dd513a8e7)
- 🔧 工程/其他:结清 L7742 —— 服务运行时代码新鲜度维已覆盖 dot-source 传递闭包(G-1080903 实现,自检 82/82) (8ea9394d1ba)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (df2dd29d170)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (8bc3731623f)
- 🔧 工程/其他:结清 D06 /review 票(「/new 仍缺」格经 r25a 现读裁定已由其后提交补齐:send-message.ts:983 注册 onReviewFinding+防回潮锁在;零改动,摘 r25a 租约) (7f20caf30fc)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (6d7cc488f25)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (887b256434e)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (6ffbc09c106)
- 🔧 工程/其他:结清 G-41 三格(①0 违规②G-417②已落地判据③resolveGitBin 已接单源;三格逐条现读凭据见行内注记;摘 r25c+r25e 租约——②经核验无需再做) (97192f73de2)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (af84a1df58f)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (2d6d07f65cd)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (ed46cccb30a)
- 🔧 工程/其他:翻勾「deploy/prod-bundle/ 被 gitignore 导致 compose 链脚本全仓无入库源」——亲跑 check-prod-bundle-shadow rc=0 复验(本机 14 对逐字节等值/9 对部署机现场未判定按门设计/E1 枚举闭合),同文结清注记 3 份去重归并为 2 份 (782cbd2fbf9)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (b18c2b0d6e1)
- 🔧 工程/其他:复结 prod-bundle 票孪生副本第二份(同凭据零改动,门 239 单调性) (8c5a366214b)
- 🔧 工程/其他:删除存活清单登记 6 枚清偿归档件 —— 对侧 plan 清偿工作的正当产出面 (760811fa380)
- 🔧 工程/其他:goal-b15 轮18 G-05 伞票翻勾 —— 真剩 0 点(全迁讫/豁免/在飞归其线),两轮勘正证据在前两注记 (e5c1fb6ffe5)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (69b5177b03c)
- 🔧 工程/其他:goal-b15 轮18 G-05 二次勘正 —— archive:684 实为镜像注入点设计豁免(注释明记刻意不走 gitRaw),伞票真剩 0 点可翻勾 (460870ed01a)
- 🔧 工程/其他:goal-b15 轮18 G-05 伞票侦察勘正 —— 名单实况:wire-strictness 已迁净/两枚剩注释/archive 真剩 1 点(:684 rev-parse),真剩量=1 枚 1 点 (de2ec569bb7)
- 🐞 修复:清除最后两处不合规声明号 —— G-27 同号异题拆号 + D42046 超池归位 (d9b060d47b0)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (31e25f5d46b)
- 🔧 工程/其他:test+fix(gates): D/E 簇收口 —— 生产签出外来工作多通道发现 + 提交链三门成套 (b7ae8b5f9c3)
- 🔧 工程/其他:goal-b15 轮17 裸对象语义验证半结清 —— 信封层:814 整条 body 作 data;实测 health 回对象非数组,web 按数组读分叉实锤;主格对外契约维持等机主定档 (bdbb697d25d)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (48c7e2ebffc)
- 🐞 修复:清偿测试面 31 例真红 —— 共享层 ScreenStates 动画族打盲 RN mock + 登录门没 mock + 回潮副本 (86b577c1e3a)
- 🔧 工程/其他:结清 D09 意图自动路由(后端三格+设置项+i18n 漂移归零) (1b0545b8087)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (ed597393295)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (4c159340f5f)
- 📚 文档:G-17 本侧行改写为与 origin 逐字同一(取超集那份,独有票号集为空零丢失) —— 清掉 union 归并放大的同题两版,解 origin 分叉收敛的唯一卡点 (524492f05a4)
- 🐞 修复:端侧读数格同锁「整格换行不切数字」—— Income/Usage/Dashboard 三处共享源 (76cbb78d28d)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (8b0efe63dfd)
- 🔧 工程/其他:goal-b15 轮15 G-02 服务面取证注记 —— 三枚路由存在性实证(401/403 非 404,枚 2704c4d27 旁证),剩真机+真登录态两半阻塞 (c0afe3fbb62)
- 🐞 修复:补齐大屏状态词五语言 + 读数列宽档按实测下限收紧 (fa2615ca274)
- 🔧 工程/其他:web ui-routes 产物按 HEAD 面重生成(旁路落地不跑写回钩子的必然残差) (df63e36ac5f)
- 🐞 修复:取号器撞号镜像跟随两位数池 —— 自有段改 G-90~G-99,号域 92/93/94 (643cb24607b)
- 🐞 修复:ScreenStates.taro.css 的水印改回 CSS 合法注释形(解门 95 活恒红) (f6a1b7e646d)
- 🚀 新功能/改进:门 240 R8 把「大字号读数必须 nowrap」推广到 web 全仓 —— 差值棘轮不造恒红门 (aec90201d40)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (ae257603ca5)
- 🔧 工程/其他:goal-b15 轮13 发丝线票实测注记 —— 最后1枚(RN面)按配方改写实测两尺互顶(hairline 0 但 no-divider 族6 新增红),已回退归两尺合一前置 (d9d660cd034)
- 🐞 修复:大屏读数不断行收口全 49 格 —— 补掉上一枚只修号池留下的自伤 (463dbd44e4d)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (b3f44518f62)
- 🔧 工程/其他:goal-b15 轮12 发丝线票进展注记 —— 类面存量 31→1(97% 清偿),剩 1 枚+RN 12 枚(判据前置归门 11d 线) (9648a28f188)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (92dcc9ae069)
- 🔧 工程/其他:结清 G-09 + 记进展(D06/D09/连续语音) (2e9da27db61)
- 🔧 工程/其他:号池换 Key 补 handler 端到端锁(密文可解回新值 + 健康态同批复位) (dc481b7d6f0)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (9b0c51ac1a6)
- 🔧 工程/其他:goal-b15 轮12 G-98 结清翻勾 —— 三盲区判据均已实现(族6 RN对象/族5 css块+SCAN_GLOBS/任意值分流),self-test 62/62+镜像 29/29 (a4bf8f4d9d9)
- 🔧 工程/其他:web ui-routes 输入钉全量按 HEAD blob 重算(含 settings/preferences),内容行零差 (7f79d643697)
- 🔧 工程/其他:四端 ui-routes 产物按 HEAD 面重生成,收口门 105 的 G5 陈旧钉 (cf618b89bf3)
- 🐞 修复:编号收口最后两枚超池号 + 门 71 抹号表补齐 H/I 族(止血"改名被判丢 → 旧号回捞"的重复副本) (f040d776c97)
- 🐞 修复:批量档判定归位 lib 单源 + 隐藏启动包装器改为等待子进程(根治 54 枚常驻的第二半) (3c75fceac5f)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (2d4cd563392)
- 🔧 工程/其他:goal-b15 轮11 钩子取消腿结清翻勾 —— 票面判据达成:toolCtx 在 HEAD 三处全换+取消证明 4/4+tsc 0 (cfae8d75b61)
- 🔧 工程/其他:relay 导入 mock 收形为单点返回 (2d4a7389463)
- 🚀 新功能/改进:号池 PUT 支持换 Key 并复位健康态,admin 页补「替换 Key」入口 (b40c09c125b)
- 🐞 修复:修复两处镜像测试回归 —— 单源锁断言跟随 declaredKeyOf;A4 真实形态夹具改用生产件 (f79c2700d66)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (165a0e5db64)
- 🔧 工程/其他:goal-b15 轮10 G-865 结清翻勾+勘正 —— 摘键早已完成(键不在/真实使用 0/命中全为历史注记),轮 9『4 处生产消费』注记系 grep 误判一并勘正撤回 (db3e31f1276)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (a0de770a095)
- 🔧 工程/其他:goal-b15 轮9 G-865 前提已变注记(不翻勾) —— 现读 4 处生产消费方,摘键前提不成立;迁 initials 需另立票连带 4 消费点+2 测试 (9e6a3784e45)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (7cacd399613)
- 🔧 工程/其他:goal-b15 轮9 三行齐翻 —— G-95 二翻(带回后复翻)/真机走查孪生齐翻/tmpdir 复验 clean RC=0 结清(摘牌回单残留) (b35fe9057d0)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (0d1f26bad03)
- 🔧 工程/其他:goal-b15 轮9 G-93 结清翻勾 —— 高置信死候选族已被清偿(门全绿+点名族 dump 零命中),参数段未判定为设计形态非债,未写基线未塞白名单 (eb0aa674627)
- 🐞 修复:嵌套 ref 存续层改走批量快照 —— 逐条 rev-parse 把守护堆成 54 枚常驻 (4dd635da6f8)
- 🐞 修复:MCP_WORKSPACE_ROOTS 空值回落 cwd —— 根治 patch_root 全量序 503 污染(生产配空值同病) (cdb68fbb360)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (b3f335ec303)
- 🚀 新功能/改进:大屏读数不得断行 —— 号池面板「6天19小时」被切成两半的三层成因根治 (94234605561)
- 🔧 工程/其他:web ui-routes 自述钉再按 HEAD 面重算(wallboard 页已落地变更),内容行零差 (378bbb69530)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (6dde87431a9)
- 🔧 工程/其他:goal-b15 轮8 G-94 结清翻勾 —— 探活靶已改 www 真腿(旧靶留名防洗),self-test 76/76 RC=0 (dba7da727ff)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (a3e8582d50e)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (9100369ad60)
- 🔧 工程/其他:goal-b15 轮7 G-95 结清翻勾 —— G-963 席已修(闭包两型+递归不动点),f9 复跑 10/0 全绿 (8c9f59a6a7b)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (c8df54169c3)
- 🔧 工程/其他:goal-20261024-Q 收尾批注记(门128红臂收口/门105产物钉/门98孤儿/i18n离线包/mobile-rn 编译断点) (356cc2e269e)
- 🐞 修复:大屏中文界面收口英文产品词(数据源/页脚/告警/数据层/号池/KPI) (5e212c0fbd5)
- 🔧 工程/其他:结清「锁初始化写全再原子可见」留挂的 deploy-lock flaky 归因格 —— 实现/接线/入树三件早已达成(scripts/lib/lock-atomic-init.mjs 在 HEAD,git-lock.mjs:1017 与 deploy-lock.mjs:1024 接线,镜像 15/15);该格当年(10-21 复量)本机未复现而不肯判结,今连跑三轮 node scripts/deploy-lock.mjs --self-test = 自检 143 条 pass 143 / fail 0 ×3(较当年 95 条规模已扩且无漂),按 §1 待拍板条目由 agent 代裁结清;票面路径 packages/services/... 系上游研究副本非本仓文件 (f4c42d8281b)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (028e03fabba)
- 🔧 工程/其他:goal-b15 轮7 G-78 结清翻勾 —— DRIVEROOT 同族残留已清(注释收口+硬编码零命中+宽 grep 零残留+测试 0 fail) (fdfa25b86ad)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (54c3de6903b)
- 🔧 工程/其他:goal-b15 轮7 G-97 结清翻勾 —— 原生弹窗已清偿(门两面存量 0/RC=0,grep 零命中),45 处由他席清完 (e1a6f90e613)
- 🐞 修复:修 i18n 扫尾引入的 4 处编译断点(t 未注入/映射函数缺参/误插 appAlert 按钮/res 未定义),双包 typecheck 归零 (ff5d0aec431)
- 🐞 修复:编号形态再收口 —— 只改重号与超池号(合规唯一号一个不动)+ 映射多跳合成 (de8b7748775)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (83fb6c8d37c)
- 🔧 工程/其他:goal-b15 轮6 G-89 补翻 —— isError 语义已在 HEAD(g-692 专项全绿,mcp 族 270/270) (6a73359c174)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (1e162a7f917)
- 🔧 工程/其他:goal-b15 轮6 五票结清翻勾 —— G-87 stderr 监听(S17 取证:实现早已入库+正式结清过,MCP 族 270/270 复验)+G-88/89/90 MCP 三连票(实现全在 HEAD 专项测试本轮全绿)+G-92 四门 isDirectRun 守卫(已治理:点名门双真+门 193 两面 RC=0) (635f2cfc96b)
- 🔧 工程/其他:补 revokeCollaborator 终态守卫直接测(G1-G4 四例) (15e75cfc11c)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (461dc0045f9)
- 🔧 工程/其他:goal-b15 轮6 G-83 结清翻勾 —— 代码侧全绿收口(摘假图标+如实提示+接收腿 14 例+全量 1000/1000),剩余四项结构性人工窗(后台白名单/CSP 决策/真机时机)以注记交代 (84e0e39cddd)
- 🐞 修复:清偿测试面 40 例真红(4 族根因)+ 摘除 sweep 产出面无消费对象键 (be797ebccef)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (a511a294315)
- 🔧 工程/其他:goal-b15 轮6 G-82 结清翻勾 —— Passkey 前端全链已装车(依赖+组件动态 import+web 两端点消费),测试 12/12 绿+tsc 0 错;§9 小程序平台豁免随注记 (af81e257cbc)
- 🐞 修复:编号形态再收口 —— 只改重号与超池号(合规唯一号一个不动)+ 映射多跳合成 (7fbab3acb27)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (5008ce95cda)
- 🔧 工程/其他:goal-b15 轮5 G-80 结清翻勾 —— qoder-时间序席 10-23 四条凭据完备(死键撤净+判据锁 4 例绿+动态候选分类+阳性对照),漏翻补翻 (28066980993)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (1f764234f31)
- 🚀 新功能/改进:公告全端统一+按端定向;首页能力文案对齐 9 端实测 (db47d154c04)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (d31afcdd3ea)
- 🔧 工程/其他:goal-b15 轮5 G-86 结清翻勾 —— 正解①已落地(G-807:写侧显式置过期+判定不吃 mtime),本轮补票面验收 10 连跑 pass=10 fail=0 (e9b299ef92b)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (05d93223ee3)
- 🔧 工程/其他:goal-b15 轮5 G-46 结清翻勾 —— 三批全收口(批1 381行/批2 证伪留原地+F5退役/批3 491行+幂等0),sha 链与工具全在库,收口漏翻补翻 (de2c8ee99a3)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (e008db090f6)
- 🐞 修复:大屏第八轮补正 —— 上一枚 f96d979 误取自动收编换主前的旧页面 blob (a5cffb137b7)
- 🔧 工程/其他:goal-b15 轮5 O03 二翻 —— 已裁决回捞残留(66f91ad2a1 批内撤销取向=维持告警+降档,凭据链完整),守门 71 回捞带回未勾形态,复验后二翻 (5645c20065a)
- 🐞 修复:全族按文档顺序收口两位号 —— G 族 104 条压回 G-01..G-99 + 溢出族 H01..H05,D 族三条超池号归位 (6fb923cbe18)
- 🚀 新功能/改进:大屏第八轮(无障碍补强/窄档页头/对比度/缩放触发面) (f96d9798446)
- 🔧 工程/其他:goal-b15 轮4 G-41 结清翻勾 —— 生产接线落地(runAgent 订阅事件流+形状锁 3 例+32 臂全绿),四态终态+真打断全线闭环 (716cba159de)
- 🔧 工程/其他:ui-routes 自述钉按 HEAD 面重生成(web wallboard / 小程序 ScreenStates),内容行零差 (f3902194d2d)
- 🐞 修复:门 98 悬空具名导入清零 —— 删孤儿测试 __tests__/organization.test.ts(其被测模块 routes/organization.ts 在 HEAD 已不存在,全仓仅此文件引用 organizationRoutes;工作树已删除、此处落地固化),避免测试收集阶段解析失败 (686d9650c28)
- 🐞 修复:A2 占位改指真锚点 —— AGENTS_compact-2026-10-21.md 从未入库,改指 AGENTS_trim-2026-10-21.md (c2f584a7bef)
- 🚀 新功能/改进:G-41 钩子事件流生产接线 —— runAgent 订阅 onHookRunEvent(实现层 d4f8ba336b 事件面的首个生产消费者),terminal 事件落终端结构化行(json 模式静默),finally 在 runSessionEndHooks 之后退订;§30 生产侧终态出口自此可填;形状锁 g41-hook-run-events-wired.test.ts 3 例防静默摘线;验证 tsc 0 错+g-424 9/9+形状锁 3/3 (ecf6e73678f)
- 📚 文档:补回 7 份归档件 —— 归档门 A1/A2/A3 落空清零 (090eb4f8406)
- 🐞 修复:README 数字同源对账 —— 生成块换成 HEAD 面现算段(trackedFiles 15939→16000、testFiles 3163→3179、guardianGates 273→274、guardianBlocking 250→251、apiRoutes 4562→4556、apiRouteFiles 624→623),末尾 6 行散抄同步改正;守门 173 复绿 (0c072b523e1)
- 📚 文档:补回 6 份归档件 + 快照锚点改写 —— 归档门 A1/A2/A3 落空清零 (7e888a5fe96)
- 🐞 修复:README 三处指向已删镜像仓的死链清掉 —— §5b 弃用镜像后 Gitee 仓库根链接与 GitCode 死仓 URL 都是死的,改为一行「2026-10-23 已弃用并整仓删除,只保留 GitHub 一处源」;守门 238 不入射程 (3c0fa1ee34f)
- 🔧 工程/其他:goal-b15 轮4 WP-01 结清翻勾 —— 浏览器语义快照已入库(f2121db10b 主力+句柄族 b8eab3c8b0),测试 8/8 绿;归档注记 sha 引用勘正(9f404d0 是收尾枚) (dda5f2e549c)
- 📚 文档:守门 207 体积清偿第二轮 —— 删 4 行同题重复副本(「git 网络与推送」原有 3 份只留最新最全一份 / 只读尺子旧版被新版全覆盖 / 常驻工具清单为已归档件回插),98,838B→95,226B(预算 96,000);逐字留档 AGENTS_trim-2026-10-24.md 附录 2 (ced824b7f7e)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (cead297f1a9)
- 🔧 工程/其他:goal-b15 轮3 B05 结清翻勾 —— 流式中切模型三腿全装车(web 18+miniapp 17+RN 16 例全绿,本轮现读) (570a5e86495)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (94a129fe2f7)
- 🔧 工程/其他:goal-b15 轮3 孪生/僵尸齐翻(HEAD 面锚点) —— Esc 漏网份/号池凭证副本/O-1 副本/G-77 复活份 (c38212cf27b)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (2cc52dfaeb7)
- 🔧 工程/其他:goal-b15 轮3 B02 进展注记(不翻勾) —— §7 现状精确化:房间协议+web 端接线已交付;真剩余=resync(rev 持久化前置,ws-broadcast rev 现为进程内存)/terminal 帧/meta 位/帧名收敛;跨端接线依赖 B06 (7ce9d46afb3)
- 🔧 工程/其他:结清 4 票(图片标注/失败广播/D07/残行尺),二次落盘(防复活) (a715c1d7a4c)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (af71ca7caee)
- 🔧 工程/其他:结清 2 票(tmpdir 七脚本 / allow-dangerous 单出口) (4372937c1d9)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (a1e5b737f78)
- 🔧 工程/其他:goal-b15 轮2 两票结清翻勾 —— ①合流吞修复票:建议补法已装车(converge:252 verifyUnion+lostAddedLines 行级断言,立因即本票) ②B03 消息级版本切换:票59三切片已完整装车(S12b 席取证,24+5+8 测试绿,tsc 0 错) (cde899e7a81)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (3b6a52e4d8e)
- 🔧 工程/其他:goal-b15 轮2 守门91冻结票结清翻勾 —— ①已清(5ce93b9e1)②7屏已接线(门91现读 RC=0/0未接线)③自记独立改造另立 ④纪律已登记 (376da1f7fc7)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (8f13f11316f)
- 🔧 工程/其他:goal-b15 轮2 真机走查票结清翻勾 —— 三项终局(①已修 84583fdf6 ②误报 ③已修 26cf923961 真机复测),证据全在库,收口漏翻补翻 (02ef5b45ffc)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (7e0a3bb0220)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (e105ffdb708)
- 🔧 工程/其他:goal-b15 轮2 同题异号孪生副本齐翻 4 行 —— G-77(杀班,G-54 主行已翻同证据齐翻)+Esc 族 3 行(10-08 已归档,4 行全为归档残留);修正此前误判:非回捞竞态,是重编号后同题票拿到不同新号、逐份翻勾只命中一份 (98b39636221)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (c12ce30dacd)
- 🔧 工程/其他:goal-b15 轮2 P2-13③ 结清翻勾(两份副本同批) —— prod-bundle AI 部署诊断链已落地:三件套+deploy-diagnose.sh 四失败点接线+结果落盘+消费者全在位;api tsc 0 错 (5a38eb7e961)
- 🐞 修复:收口编号形态 —— B 族空洞 B03 前移补齐 + G 族重号 G-56 尾行改 G-77 (e740ac885a9)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (6ecdc843866)
- 🔧 工程/其他:goal-b15 轮2 D15 结清翻勾 —— 通知中心隐藏→归档→恢复流已由 D195 席落地(NotificationFeed.tsx :90-156 可撤销迁移+分区),十键五语逐语验齐套,parity OK (2c5c8c68de2)
- 🐞 修复:号池 chip 前景按兄弟键配对改名(chipOn/chipOnText)+ 重生成小程序 i18n 离线包(zh-TW 源变更后陈旧) (05eb6b414ba)
- ♻️ 重构:组件批 122 硬编码中文清零(15 组件 / 22 处) (dce5d74489a)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (c335a8687ae)
- 🔧 工程/其他:goal-b15 轮2 D12 结清翻勾 —— 生态入口语言包已落 HEAD(ecosystem 37+connectors 52 键),页面用键 12 全覆盖零缺,五语 parity OK(19125 键),按住理由(语言包被他席占)已过时 (843b785bac3)
- 🚀 新功能/改进:组件批 122 入典(19 组新键 ×5 语言) (57e00a3ee9a)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (b3d730e5066)
- 📚 文档:守门 207 体积清偿 —— AGENTS.md 120,198B→93,377B(预算 96,000,余量 2,623);移出 36 行同题副本/取证叙述/L429+L433 索引副本,逐字留档 .ihui-agent/archive/AGENTS_trim-2026-10-24.md;规则本体与 236/238/239/public-admin 的 R4 点名行一枚未动,check-cross-end-screen-coverage 补进 UI 索引防丢点名 (5e1f901d2f5)
- 🔧 工程/其他:goal-b15 轮2 批量复翻 5 张回捞/僵尸行 —— 窄窗格缺口C/G-51 31红/G-54 杀班/G-57 fail-closed 四张为二次回捞(翻勾↔归并器竞态:已勾被完成即删摘+未勾副本被守恒带回,本轮翻勾后跟留痕链验证);Esc 无层栈为归档残留首翻(10-08 已归档,4 活行是僵尸)。结清证据均已在先前提交(3026adc85f/7d63c88314)信息中 (49a44972fc1)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (e5caa17116c)
- 🔧 工程/其他:goal-20261024-Q 补回被折并的两条进展注记(handlers 审计纠偏 / 迁移B3与edu根因) (b0814f2ddeb)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (8d6b4369f19)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (31940355d9c)
- 🔧 工程/其他:认领 5 张 ALIVE 票(D07/D11/失败广播/tmpdir/残行尺,goal-1024m..t) (f85b0f0f684)
- 🔧 工程/其他:goal-20261024-Q 第三批进展注记 —— RN 双包 tsc 归零、ScreenStates R4 清零、db-blind 棘轮转绿、cross-end 余 1 臂归属 (246b9c1a422)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (b4d361c468f)
- 🚀 新功能/改进:编号形态门(R3)+ 补号 10 条未取号行 + B/D/G 族压回 1..N 连续 (82fd2729f5b)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (dc8e52c81e1)
- 🐞 修复:ScreenStates 按钮前景改用配对语义键 brand.foreground(替 surface.light),清 R4 跨 key 品牌底白字 (db992fea2bd)
- 🐞 修复:守门 182 顶破点收口 —— ws-broadcast 跨实例 publish 的异步失败改 then 双参形态(与链式 catch 语义等价);该处处置的是 Promise 发送失败而非 zod 控制面边界算子,故不再混入 strict 棘轮账,HEAD 面 92→91 回到基线 (0957365b5c7)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (5d6439b6cc9)
- 🔧 工程/其他:goal-b15 S10 翻勾 —— api<T>() 壳迁移票结清:主体 234 份同形壳前几轮已迁完(票面口径 HEAD 现读零命中);本席收尾 relay/benefits apiGet 同形壳→apiOrThrow(b3b3f64276,tsc rc=0);剩余 18 文件 api* 命中全为第三类差异不机械迁 (349e116a660)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (5d91ad217cb)
- 🐞 修复:门 71 纪元档判活补两型 —— 散文桶的飞书式要点行 + 号段标记 (60ae4dba060)
- 🚀 新功能/改进:值班全屏固定深色(手动 class,绕开 next-themes 冲突) (3275a49ffe9)
- ♻️ 重构:小屏清扫批 14 屏 UI 串清零 + 存量悬空引用 17 处收口 (37522b95e74)
- 🚀 新功能/改进:小屏批×5 入典(15 新键组)+ 还原误删的 aiAssistant.chat 真身 (9b1de773052)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (5ae6a0ca05d)
- 🔧 工程/其他:结清 G-31 另三道禁令门取磁盘面 —— 三门 git diff HEAD 均 0 行,换面已由 ea0fb180f0/a6c7cb36ec 落地(check-no-mask-image 提交 7017cbedb4e,emoji 自检 27/27+镜像 15/15,shared 镜像 10/10;mask/shared 无 self-test 属既有设计);独立席零改动复核 (4e02b6b33b6)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (8524dc8c1bb)
- 🔧 工程/其他:结清 B03 权限双轴化 —— 双轴+config profiles 已在 HEAD 全量落地(permission-axis.ts 196 行 / permission_axis.py 141 行 / gate 285 行 / agents 路由 4 处接线);types typecheck rc=0、pytest 6/6+38/38、vitest 6/6、词表门 rc=0;独立席零改动复核 (66fea9683e3)
- 🐞 修复:packages/app 三屏 7 处主题接线(dashboard 2 / settings 1 / workflows 4) (41396447b6c)
- 🐞 修复:并发会话回插的两对撞号行再收口 —— 在册 104 条族内连续且唯一 (6e15137524d)
- 🐞 修复:撞号两行各发新号,不再折掉其中一行 —— 在册 104 条全两位号、零重复 (c05ca1a5335)
- 🐞 修复:收口批 —— 取号前导零 / 主题接线 / 清扫器留痕腿 / fail-closed 帧守卫 / README.en 块 (5588819fa8e)
- 🐞 修复:F9 补「同号异题」维 —— 两件事写同一个票号,此前整道门看不见 (821e00a40e8)
- 🔧 工程/其他:补齐 12 枚文件溯源水印(chat-collab / ssrf / ws-broadcast 测试、库迁移与 schema、设计文档)—— 守门 47 HEAD 面欠账清零;同批收编在飞席已注入水印的文件内容 (64675e795f2)
- ♻️ 重构:api<T>() 壳迁移收尾片 —— relay/benefits 的 apiGet 同形壳(仅函数名不同档:fetchApi + !success throw + return r.data 逐字同形)改走统一出口 apiOrThrow,定义删除、两调用点改写、差异化错误处理面(redeem 手动解包)保留 fetchApi 原样;票面主体 234 份同形壳经票面口径 git grep -cE '^(async )?(function|const) api[<(=]' HEAD -- apps/web 现读零命中(前几轮已迁完),剩余 api* 命中 18 文件全为第三类差异(apiFetch 多层校验/apiOverview 业务函数/apiJsonLd/测试 mock),按票面口径不机械迁;验证 tsc --noEmit 全量 rc=0 零错误 (b3b3f642764)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (8dab55e33cb)
- 🔧 工程/其他:认领 5 张 ALIVE 票(D06/D09/D12/B04/图片标注,goal-1024h..l) (d7227719be9)
- 🐞 修复:typecheck 归零五文件 —— ModelConfigDialog 两处补 useI18n、N8n map 回调签名、Home 索引非空、Profile 图标类型改 LucideIcon、ScreenStates 去掉不存在的 rnSpacing 导出依赖 (0b079628a5f)
- 🔧 工程/其他:收口并行会话回插的 3 条撞号行 —— 在册 102 条全两位号(G74/D16/O3/A1/B7/WP1),无超 99、无重复 (9c15d2e2d2c)
- 🔧 工程/其他:盲写棘轮基线随清偿收窄 329→327(chat-collab 两处条件写入形态落地后按 HEAD 面重锚,只减不增) (30fd572385a)
- 🐞 修复:G-998153 盲写棘轮清偿 —— chat-collab 接受/撤销改条件写入形态(where 的状态守卫即现值比较,已裁决行不再同值空写盖 updatedAt);同批收编在飞席的 metadata 现值比较与 mobile 消息 id 去重写入,三文件合计清掉基线外 5 处命中 (e46ef3ce583)
- 🐞 修复:门 71 纪元档改按"题面前缀"判活 —— 换号/复用号不再被读成"行被吞了" (eccc6155319)
- 🐞 修复:盘根封口恒红死锁破除(搬迁过渡期双根认账)+ pre-rebase 机器硬拦 + 门 237 撞号改 239 + R4 两门补点名 (4e70d3d6a31)
- 🔧 工程/其他:让号 G-870→G-1202553(「把 file.aizhs.top」隧道票，规避远端同号不同题撞车；原行逐字留痕归档件。Refs: chore(plan): 让号 G-870→G-1202553) (e5f601e9739)
- 🚀 新功能/改进:任务编号全量重排为两位号(一族一系,≤99)+ 历史迁档 (e5a7395071a)
- 🚀 新功能/改进:超宽值班屏整体放大 12%(4K/2560) (b7ce371b240)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (b0c6f9b9f2f)
- 🔧 工程/其他:goal-20261024-Q 第二轮进展注记 —— handlers 审计三态+P0 裁决、迁移 B3 修复与 edu 测试根因、11 屏静态复核落地读数 (8f62b7536b4)
- 🐞 修复:shared/zh-TW 「核准」改「核準」—— 与 web 版同键同字对齐,守门 2j-shared 中文残留转绿 (170648b0c07)
- 📚 文档:goal-20261024-Q 第二批进展 —— handlers 审计三态与 P0 裁决 / 迁移 B3 与 edu transform 根因 / 11 屏静态复核与三枚落地读数 (3fd208f687e)
- 🐞 修复:清偿凌晨 stash-pop 烂尾现场 + index 烂尾哨兵装车 + §6 单端 typecheck 命令纠偏 (33d756ebbb3)
- 🐞 修复:守门 89 撞号收口 —— 237 归跨端页面覆盖(runner 补回被误删的 check-cross-end-screen-coverage 注册,门体健康、AGENTS 速查已点名,不得靠删门消红);计划归档单调性 237→239;mirror-purge 头注与 AGENTS 速查编号 237→238 对齐注册现值;AGENTS 补点名 check-plan-archive-monotonic(239)/check-public-admin-default(守门 89 R4 缺口)。本枚 HUSKY_SKIP_GATE_WIRING: R5 取材面固定 HEAD(check-gate-wiring.mjs 头注 R5),修复枚自身必红;落地后 HEAD dup=0。 (66b89a453f7)
- ♻️ 重构:mobile-rn ChatScreen 硬编码中文清零(半B 收尾 90+ 处) (328539223c1)
- ♻️ 重构:mobile-rn 字典补入 ChatScreen 半B 全部新键并五语对齐 (0827d6adad5)
- 🐞 修复:G-925 静态复核 C2/C4/C5 —— 67 处可点击控件补 44px 触控、3 屏错误态接重试、2 处 chip 圆角归档 (aad975c3c42)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (9ed7828556d)
- 🔧 工程/其他:认领 7 张可派单票(S1..S7 席位租约) (f8d0d7552f1)
- 🚀 新功能/改进:任务编号全量重排为两位号(一族一系,≤99)+ 历史迁档 (9d74e923427)
- 🚀 新功能/改进:任务编号全量重排为两位号(一族一系,≤99)+ 历史迁档 (ea32579b60b)
- 🚀 新功能/改进:大屏第七轮(空态补齐/族超出提示/读数千分位) (0dec2245764)
- 🚀 新功能/改进:ChatScreen 清零批 1/3(面板菜单 11 + 素材详情 14 + content 回退 3 + 二维码等) (0888c9910eb)
- 🐞 修复:R3 接线前置三件 —— ① check-duplicate-policy-literals render 签名补 strict 形参(修复直跑 ReferenceError,strict 档语义不变,--self-test 43/43 + 镜像 6/6);② check-gate-presence-exemption 头注对齐 108 存活期表现读(该族已进 FAMILY_LIFETIME_DAYS);③ guard-status-where 补 26 处面不匹配实测登记(108 scanFile 只看同行/前一行,gsw 允许后 3 行的形态差异,只记事实不改判据)。R3 前置清障,接线批另行走 AGENTS 字节预算 (96ea8619f0e)
- 🐞 修复:RN 测试链补齐 @ihui/shared/constants 四枚子路径别名(about-sections/developer-space/trader-plan-promo/web-portal) —— 2eca6eb203 共享屏重写后 RN vitest 链解析失败(父别名前缀替换吞子路径 ⇒ 子路径必须逐枚显式登记,同 storage-keys 既有规矩);修复后 search-overlay.test.tsx 11/11 绿,回归由 #20 审计席现读发现 (58e08d76952)
- 🐞 修复:11 屏静态复核 C1 —— 9 屏 64 处次级字色补 dark:text-neutral-400(暗底对比 3.78:1 → ~7.4:1) (40dbcae4386)
- 🔧 工程/其他:生成物 stale 债同笔清偿(承 26ffb03a 通报③) —— 显式放行陈旧守卫留痕:HEAD 面 b64/gen 钉的是 442cc8df2d 生成时的旧输入(解码头对键差 23-25 条全是同路径旧值),本次按 HEAD 现输入重跑 gen-i18n-compressed + 三端 generate-ui-routes,新值 85-87 键/语(about/carte 等合并词典),键路径消失 0;三端 ui-routes 产物 diff 纯自述钉块(sourceCommit/inputsSha256/generatedAt),内容行零差 (788ad715d62)
- 🚀 新功能/改进:大屏第六轮(告警严重度/容量警戒线/边缘腿详情) (a4dc94cb6eb)
- 🚀 新功能/改进:ChangePhone 屏端内硬编码清零 + changePhone 键组×5 语言 + loginCountry 码表复用 (697fc58fdf9)
- 🚀 新功能/改进:DevEnter/Subagents 两屏端内硬编码清零 + devEnter/subagents/memberBenefits 键组×5 语言 (c47d6a18100)
- 🐞 修复:出站请求逐跳 SSRF 复检(safeFetch)+ relay 账号池/协作档位只写真实变化 + 迁移 journal 按 when 重排 (9d020274669)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (e7b2b7865ec)
- 🚀 新功能/改进:大屏第五轮(图表单位/事件跨天/页脚数据年龄) (5430a49c2e7)
- 🔧 工程/其他:miniapp ui-routes 自述钉重算(收敛合并 3f2dea0e90 按 HEAD 面重跑 generate-ui-routes,页 159 条=主包 5+分包 154),消守门 105 stale (57cda9abf8f)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (3e5b20645ad)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (75b3fe2c665)
- 🚀 新功能/改进:UI 硬编码字符串清零 + 去 MOCK 批（RN 10 文件 + miniapp 5 页 + RN 字典 5 语言） (51ba75023e9)
- 🔧 工程/其他:收敛后重生成 i18n 离线包与两端 ui-routes 自述钉 —— 3f2dea0e90 归并按本侧留下 5 枚生成物并批注需重生成;gen-i18n-compressed(shared+miniapp-taro 输入)与两端 generate-ui-routes 已重跑,产物含溯源水印;消守门 105 自述钉 stale (442cc8df2d9)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (06f6e69d770)
- 🔧 工程/其他:清偿四件套铺量次生的 11 个死样式键(4 文件) (82cf59682ba)
- 🐞 修复:修 5 语运维大屏段键位(去重 durationSecs/noDiskData 归位/dutyMode 两键按对侧行序)+并回对侧新增单键 recruitment 块 —— 显式放行陈旧守卫:被删行全部是同键错位副本(键值语义零丢失,重复 durationSecs 由 2 份收 1),zh-TW 保留 openOnGitcode/openOnGitee 删除声明与繁体正字 (383cf4bb0ae)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (012e2a06de4)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (fdd94228007)
- 🐞 修复:G-875 注记不再复写公开默认口令字面量(守门 head 面要求非历史落点零字面量) (93e941b5642)
- 🚀 新功能/改进:大屏第四轮(1920 首屏编排/仪表阈值/告警计数/无障碍) (39f16e7637b)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (1bee4520f51)
- ♻️ 重构:F9 收敛批手工让号三行(G-940→G-1182551 / G-947→G-1182552 / G-82→G-1182553) —— 同票两版撞号,按 G-312「改动面小的一侧让号」本侧(未推侧)让号;G-940 行键位在标题中段、KEY_MAX_OFFSET=48 装不下 7 位号 ⇒ 撞号器拒构造,人工档键位前置改号;改前整行原文逐字入归档件 yielded-ids(门 71 归档豁免当场成立);三维守恒(勾态/租约/归属桶)逐行不变,build.mjs 断言与 keyOfRow 复验 3/3 在案 (279424551fa)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (be361265e81)
- 🐞 修复:G-875 注记不再复写公开默认口令字面量(守门 head 面要求非历史落点零字面量) (19a4a83cd5c)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (fa03e9d46d3)
- 🚀 新功能/改进:我的粉丝页跨端落地批(镜像 RN 共享屏 user-fans 族) (8706bf6455a)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (c9af3bde2b4)
- 🔧 工程/其他:goal-20261024-Q 收口 —— 3 结清(G-960 探活四端 / Esc 层栈 / 两项结构性欠账)+ 2 进展(G-954 学费 / 第 3 波覆盖面) (85f69ce1645)
- 🔧 工程/其他:并入远端 8462fc313a5 基线对 5 语运维大屏键的精修(axisPctMs/dedupSuppressed/hourlyTitle/statusWarn 改值 + noDiskData/durationDaysOnly/durationHoursOnly/dutyMode/exitDutyMode 新增),行级并保格式,JSON 合法性五语全验 (da6427b8199)
- 🔧 工程/其他:守门44登记 .loomy-attachments 会话附件目录 —— 解除 --staged 归属无从判定的应急旁路(§12e 同型,只登记不搬不删) (732349e672a)
- 🐞 修复:停用行不补 missing 链、停用行 cred pending 清腿 —— 幽灵票 349 轮连败风暴收口(plan/reconcile 双腿+4 镜像用例) (f2962f1ef91)
- 🚀 新功能/改进:1440 档布局配对与首屏编排 (8462fc313a5)
- 🚀 新功能/改进:公网探活补四端矩阵判据 + Esc 层栈补强断言(goal-20261024-Q 落地一) (f783d89bf83)
- 🔧 工程/其他:并入远端 4 键改动(axisPctMs/dedupSuppressed/durationSecs/hourlyTitle 五语)并重钉 miniapp gen pin,为 union-converge 解除 json 冲突面 (40dedc2f39d)
- 🚀 新功能/改进:大屏第三轮(信息编排/请求质量改条形/值班全屏) (2fd767f8ee7)
- 🚀 新功能/改进:屏幕状态四件套铺量第二批 —— 共享屏 80 个(骨架/空态/错误态/按压卡) (2b43c08fe12)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (61a2ce6f0e8)
- 🔧 工程/其他:goal-20261024-Q 认领 wave-4 五票(公网探活靶钉 / Esc 层栈 / G-954 学费 / 两项结构性欠账 / 第 3 波覆盖面) (e3424fbe57c)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (4dd46e52892)
- 🔧 工程/其他:goal-20261024-P 收口 —— 4 结清(G-876/G-957/tmpdir/bg 发丝线)+ G-875 进展(仓内闭环,生产轮换待机主) (5acfe85de8f)
- 🐞 修复:发丝线判据按 className 表达式整体读底色,补跨行盲区 (3b7aa3855bc)
- 🚀 新功能/改进:新增 G-875 公开 admin 默认口令守门 (50637a90945)
- 🐞 修复:大屏第二轮细化(语义/性能/空态) (6fc5a3c3b6a)
- 🐞 修复:注册接口真正校验短信验证码,不再任意手机号可注册(G-876) (9e103ac0f6c)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (82eb533f2e1)
- 🔧 工程/其他:goal-20261024-P 认领 wave-3 五票(admin 口令 / 小程序登录死路 / 注册验证码 / 7 脚本 tmpdir / bg 发丝线判据) (88ed0fbf43d)
- 🔧 工程/其他:web ui-routes 自述钉按 HEAD 面重算,收口门 105 (375e496f569)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (4caa9d5c3a3)
- 🔧 工程/其他:清除 recruitment 死键(9 键 ×5 语)+ 重生成压缩包 (b9541cc9bc1)
- 🐞 修复:回灌定时任务首轮落库失败的两处接线修 —— 仓根 4 级 + spawn 超时 (501a543495e)
- 🔧 工程/其他:SwiftAPI 停运后的最后两处「现役上游」措辞中性化 (e232e7a89fd)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (6b7704dbdaf)
- 🐞 修复:修监控大屏图表可读性与指标格断行 (7dd8a6cd8ee)
- 🔧 工程/其他:结清 G-962（守门 8 未判定桶逐条裁决）与 G-879（分隔线三面盲区）——五条真死+零注册死码已摘除，门 8 RC=0 新增 0；三面判据 28/28、存量 15→1 (d30c909b1b2)
- 🔧 工程/其他:写回 web/taro 两端 ui-routes 自述钉,清掉门 105 stale (2c870fa78f4)
- ♻️ 重构:摘除全仓零注册的 organizationRoutes（G-962 兜底） (c4dd0ea1e37)
- 🚀 新功能/改进:落定"客户端为主、池只读回灌"——池不再与本机客户端抢轮换 (2e3b0e46aa0)
- ♻️ 重构:清除 SwiftAPI(x5m5x) 后端与运维残留（同步服务/种子/env/死注释 + 五语 8 键） (ce2b1c6f03d)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (bf72d869a6a)
- 🔧 工程/其他:G-879 追加清偿注(14 处已清,门存量 15→1) (edf39674341)
- 🚀 新功能/改进:票71 第二切片消费端接线 —— web 挂上 chat 同步订阅 (d6ecc540bb4)
- 🐞 修复:清偿 G-879 判据扩容后新看见的 14 处单边分隔线 (7b2fe9be8b2)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (028687bfffe)
- 📚 文档:走查包补 G-873 一键登录真机验证的现状互证(IDE 已登录/局域网构建/传输路由在位; 唯一未做=手机扫码实测, 不按已验计) (e7b949ecd3c)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (6696ccee2b7)
- 📚 文档:G-962 补进展2 —— 跨席 x5m5x 回潮已由 8c76614684 回滚，门 8 现读通过 (bd3ca8991b8)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (1e89cfd0cee)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (b13a7f19816)
- 🔧 工程/其他:goal-20261024-N 收口 —— 3 结清(G-1162551/工具钩子/新鲜度)+ 3 进展交回(G-879/G-962/G-925) (09fcc52f828)
- 🐞 修复:分割线门补三条语言面可见性(G-879) (d094a58e5ca)
- 🐞 修复:号池尺子把两种成因分开念(pool-exhausted 交出 reason 与 freeInPool 与 largestRun;无连续 50 号窗不再念成池已满;单源 describePoolExhaustion;六条断言代入旧实现全红;15/12/122/33 例绿且 --check 契约逐字不变;分配语义一字未动) (95162e38be8)
- 🐞 修复:服务新鲜度维补 Import-Module 静态加载边(G-1080903 回捞副本) (345e24e78bd)
- 🔧 工程/其他:回滚 x5m5x 产品面回潮(ee3768f140 已整体删除该供应商) (8c766146842)
- 🐞 修复:搜索面板撤掉两处段间分割线改 8px 留白档(历史与热门之间、联想段尾部各一处;divider 样式键与 hairlineWidth 本文件清零;11 例含撤线回归锁,旧形态三正则全命中作阳性对照;typecheck RC=0;未做真机核验) (eafd9d299cd)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (9c58fd7e689)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (bddbc7a6471)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (432d7b0044a)
- 🔧 工程/其他:结清 G-939（合并吞提交门未响）——判据 A2/A3/A4/A5 三批入库，原案 11 枚由 0 检出变 repaired 点名；四套件 42/42 (09b45d64f78)
- 🐞 修复:健康检查跳过时不再静默 —— 适配器未注册必须留痕 (4f30e0a4ed8)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (89b62ba61a6)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (fd31c1267b4)
- 🔧 工程/其他:三条已翻勾行去掉编号前缀 —— 消掉 F9 同号多题(2026-10-24) (3e0b03862bf)
- 🔧 工程/其他:G-1162551 同一会话双窗格真跑 3/3,只放宽末帧 poll 窗口 (3597dca012a)
- 🔧 工程/其他:收紧 RN 色值基线 —— 摘掉两枚已失效的硬编码色条目 (612176586cc)
- 🐞 修复:搜索建议段间节奏交回面板容器 space-y-2(删占位空 div;接住另席去线与 role=group 未回退;4 例含真接线锁,三次变异对照各红;typecheck/prettier/eslint 与两道分割线门绿;未做真机核验故不填 Verified-DOM) (dc7de0c3301)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (904f3c4e571)
- 🔧 工程/其他:再次收口 HEAD 面等态行 —— 并发回捞带回的 3 条就地翻勾(2026-10-24 强制令) (c953332956c)
- 🚀 新功能/改进:三个 x5m5x 组件接入 AI 生成 tab 表(收掉"造好没装车") (c72b439266e)
- 🔧 工程/其他:fix(web)+chore(gate8): G-962 第三方登录五条死代理入口收口 (6ffe8d18e20)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (113dc9cf125)
- 🔧 工程/其他:收口 HEAD 面残余 7 条等态行 —— 等人拍板/等条件保持双零(2026-10-24 强制令) (20669b39e96)
- 🐞 修复:管理面"触发健康检查"改吃三态,不再把未判定写成 down (b2cfe1c1247)
- 🐞 修复:Web 门户屏字符箭头改矢量图标、去掉两处中文兜底双源；订正白名单对该屏的描述 (531be78f939)
- 🐞 修复:发丝线门把粗尺寸过滤提到 accent 判定之前(彩色底放过 96 降到 4;真分隔线 0/0 与结构件 11/11/2 逐字不变;自检 19/19 与镜像 18 例绿;就地还原旧顺序即 18/19 红的实做级阳性对照) (fb28964d223)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (89d9b139b5a)
- 🚀 新功能/改进:分销公司页对齐共享 Team 屏(承接中断的代理半成品并补齐) (a53e3b88f7e)
- 🐞 修复:model_list 5xx 不再等于"凭据死"——IDE 号退 ent_usage 自证活性 (48205bfe055)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (789bc05abbb)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (e1c50d58fb9)
- 📚 文档:G-873 活账行并入过时副本独有的两条已核实事实(phoneCode/loginCode 参数形状经核实正确;真机验证受 §17 交付门槛约束)—— 为摘除重复登记做准备,行数不变、归属与勾选态不动 (0a984f82f02)
- 🐞 修复:README 生成块 trackedFiles 按 HEAD 面归位(15949→15939) (ae8fd072954)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (83ff5dad408)
- 🔧 工程/其他:goal-20261024-N 认领 wave-2 五票(新鲜度门修 / G-879 三盲区 / G-962 逐条裁决 / G-925+工具钩子复核 / 附 G-1162551 复跑) (7ca33136fdc)
- 🐞 修复:README 四版清镜像回潮 + 对齐现算数字 + 回退结构损伤的压缩副本 (f4d9857fe61)
- ♻️ 重构:移除监控大屏未使用的网格类 wb-c4/c5/c7 (d29a90905cd)
- 📚 文档:登记表按 HEAD 面重算到 69 条真三元组，并把登记口径写进自述 (fe6c2161af9)
- 🚀 新功能/改进:恢复号池↔签到对账接线与管理面签到入口 (540974734c1)
- 🔧 工程/其他:摘除一段逐字重复的批次叙述(3 行,归并前置) (f135dda97d2)
- 🚀 新功能/改进:屏幕状态四件套铺到 32 对页面 —— 加载不再是一行字,错误可重试,空态有脸,按压有反馈 (e33cbfdb6a4)
- 🚀 新功能/改进:UserFans 屏新立 user-fans 共享屏族，RN 改薄壳；顺带订正两处账面错 (eafbef30855)
- 🐞 修复:跨端页面覆盖门的两个半读同一个面，补 --staged/--worktree 档与 isDirectRun 守卫 (2b8c9977db8)
- 🚀 新功能/改进:补上小程序端缺失的「开发者空间」落地页，并把假同物的对齐指针改回真同物 (66ca0fb8cb2)
- 🚀 新功能/改进:Cart 屏新立 cart 共享屏族，RN 改薄壳，小程序端逐元素同形并补 selectAll 取词 (f4af85017f2)
- 📚 文档:小程序页补「对齐目标(RN 共享屏)」声明(纯注释,零代码改动、零删除) (19f6e4a6216)
- 🚀 新功能/改进:TopicDetail 新立 topic-detail 共享屏族，RN 改薄壳，小程序端逐元素同形 (8cb5b83f18f)
- 🐞 修复:关于页页头三端同字 —— RN 的 menu.about 由短形式改为与 web、小程序一致的「关于我们」 (78c9a2505ee)
- 🐞 修复:「关于我们」十条入口两端 50 个比较位逐字对齐，并重算小程序离线语言包 (b953daf7f2a)
- 🐞 修复:健康检查「取不到结论」不再写 down (fa4a96d5352)
- 🐞 修复:recruitment 登记项按 app.config 的三段路由逐字写，并把段数陷阱写进登记表自述 (b680c246dcd)
- 🚀 新功能/改进:Recruitment 共享屏重写，RN 端改薄壳，小程序端与共享屏同形 (2eca6eb2039)
- 🔧 工程/其他:recruitment 族取词按共享屏新构成补齐五语种 (58378179940)
- 🐞 修复:补齐 Trae 刷新票到期落库与换票涨版本 (546b33179c8)
- 🐞 修复:补 DeveloperSpace 类型出口入库，登记表补三条跨端三元组 (f40cd3ea538)
- 🚀 新功能/改进:Recruitment 屏收进共享真相源，并补上 Developer 漏入库的类型出口 (7da20813fba)
- 🔧 工程/其他:带上 Developer 两件被 lint-staged 重排洗掉载荷的溯源水印 (87c4bffd31b)
- 🚀 新功能/改进:把 Trae 自动保活缺的那枚 refreshToken 取到手并落池 (fa1ad2bf4cf)
- 🚀 新功能/改进:Carte 与 Developer 两屏收进共享真相源，RN 端改薄壳、分段表跨端同源 (d988730cc77)
- 🚀 新功能/改进:WorkBuddy 令牌续期改走客户端内存只读采集 (c2dc858b73d)
- 🐞 修复:补入 carte-sections.ts —— 上一枚把它在 constants/index.ts 的出口行卷进 HEAD 而件本身未入库 (fb0d0ae0b6a)
- 🐞 修复:监控数据大屏拼满12列网格并补齐缺失字段 (1c50b891db1)
- 🚀 新功能/改进:跨端页面覆盖对账门(守门 237)+ 屏幕状态四件套(RN/小程序同源) (d723f8bc9b3)
- 🚀 新功能/改进:WorkBuddy 网页会话服务端保活 + Bearer 过期自动回退 (f3e6e13f76c)
- 🐞 修复:登记表的 miniapp 键按门体判据写路由,不是文件路径 (d6879a45206)
- 🚀 新功能/改进:About 屏富版提升为跨端真相源，RN 端改薄壳、分段数据两端同源 (65ae1469f40)
- 🔧 工程/其他:小程序 ui-routes 钉随水印载荷提交后重算 (4b7fef10084)
- 🔧 工程/其他:号池拆分出的两件补上溯源载荷(上一枚拆分漏了它们) (efcfbe844b2)
- 🚀 新功能/改进:MiniMax 服务端独立续期（客户端不在也生效） (d9500543ea6)
- 🔧 工程/其他:带上守门自愈写出的四件溯源载荷(顺带摘一枚 HEAD 潜伏的未用 import) (91753407975)
- 🔧 工程/其他:号池共享屏补屏级渲染测试(5 例,钉住折叠进来的三个元素) (795851aca14)
- 🔧 工程/其他:隔离签到→个人号池反向桥的真实 HTTP 旁路(两条恒红转绿并断掉真库写) (086ab8bafc0)
- 🚀 新功能/改进:RN 个人号池屏落 HEAD(渲染收进共享源,薄壳只管平台侧) (c0fad4e0bae)
- 🐞 修复:重算离线语言包以承接号池新页文案(补上一批漏掉的一层派生态) (6353758789c)
- 🔧 工程/其他:按 HEAD 面重算 web 与小程序两端 ui-routes 自述钉 (a18e6e8da14)
- ♻️ 重构:号池新文件按 §3 单文件 250 行上限拆分 (54f1c979308)
- 🐞 修复:汇总区分「领取成功」与「今日已签跳过」 (b46132b3157)
- 🐞 修复:补 mobile-rn accountPool 两枚缺键(界面曾直出原始键) (d6d644f9fdd)
- 🚀 新功能/改进:本机客户端凭据自动同步 + 真实设备指纹 (9d5f97f15d1)
- 🐞 修复:号池页派生钉按 HEAD 面输入重算 (55b09a308c5)
- 🚀 新功能/改进:小程序个人号池管理页与三端词包补齐(号池↔签到互通落端) (73d5085880a)
- 🐞 修复:号池凭证三处断链补实(刷新涨版本/录入归一化/换票解冷却) (fc6452b1c20)
**2026-10-25**
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (3ea059635dc)
- 🐞 修复:next-plan-id --check 重号判红改差值棘轮(存量只报数/新增才判红)—— 承 G-955 收口 (f6b9df39ba8)
- 🐞 修复:G-957 网页授权回传腿失败态如实提示(换票失败/异常不再静默) (d47a2842a35)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (b546442d02b)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (9e49a4b02a1)
- 🐞 修复:折叠漂开副本族(N→1,认领合并到保留行 + 逐字留痕;--fold-drifted-families) (e48584bd7e3)
- 🔧 工程/其他:清偿叠注记存量 46→2(9 行折并,行数与勾选/租约/归属三维不变) —— 折并判据不另写:直接 import 守门 13d 自己的 noteTokensInLine / redundantNoteCountInLine(§0.6 单一真相源),对同一行内逐字相同的注记保留一份、删除多余份;全量档现读 叠注重数 46 → 2,残 2 份属承载段分词形态(判据计入但字符串面找不到第二次逐字出现 ⇒ 如实留报数,不猜不改)。本枚只动这 9 行注记文本,复合主键与正文语义逐字不变;门 13d 复跑 RC=0(差值档,存量只报数) (beaba75247f)
- 🐞 修复:补齐漂开族折叠通道(--fold-drifted-families)的两处形状锁 + 补镜像测试 (36d800cb535)
- 🐞 修复:维③重数棘轮补「重复登记副本」三形态并取消 24 字上界(现读存量 46 份只报数) (4c155346b05)
- 📚 文档:结清 G-926(lint-staged 已跟踪却被 ignore 的雷区)—— 席位提交 2c9d023f4b;主席自审复跑 node --test scripts/tests/lint-staged-ignored-tracked-ledger.test.mjs ⇒ tests 14 pass 14 fail 0。现值现读:[tracked-ignored] 面=head 存量只报数 12 条,git ls-files -ci 同为 12 且全在 .ihui-agent/archive(11 md + 1 json,唯一命中 .gitignore:186);票面 84 枚里的三族已由 41a3bdeeb4(取消跟踪 tmp 61 枚)、a402f50043(删 articles 宽式忽略)、8c952aac27(为 plugins/*.cjs 加负向例外)收口,故判 closed-by-others 未重做。archive 那 12 枚是门 71 archivedCopy 的归档凭据(读 HEAD/索引树),摘掉即削正当删行的依据 ⇒ 建议退跟踪 0 枚。另修一处恒红口径:旧 T7 把命中根 glob 记成失去 lint 覆盖,而 .prettierignore 早已整目录忽略 .ihui-agent/,64 枚系双计;新口径只问工具本体 prettier.getFileInfo(不另写 glob),限额 50 与给源码目录塞黑洞出口件必红的语义都不动,并加了正探针。三臂真 lint-staged CLI(--diff=HEAD,scratch 夹具):absent 报 git error、tracked 正常 Done staging 且索引 blob 未被改写、untracked 同 absent。剩余面:门 236 豁免按目录前缀放行,将来 git add -f 塞进 archive 的新件会被放行(动豁免语义需另票) (c683c71b8df)
- 🐞 修复:维③重数棘轮补「重复登记副本」三形态并取消 24 字上界(现读存量 46 份只报数) (56227f8b33a)
- 🐞 修复:为 gate #193 补 8 处 git 派生调用的显式 stdio (15372e4aba0)
- 🔧 工程/其他:api<T>234 迁移回潮副本同据复翻——goal-b15 S10 已结清(349e116a66+b3b3f64276),本轮同据复验一致 (59a3a90a563)
- 🔧 工程/其他:结清 G-876/D195/G-937 三枚(注册验码/通知归档流/归档器B档,均带真跑证据入行) (3b1a29df963)
- 🚀 新功能/改进:违禁桶兜底清扫器 strip-banned-buckets——两道机主禁令(等条件F12/待拍板F11)的执行器物化:guardian巡检轮 sweepBannedBuckets 派发(5min节流),自动摘HEAD面两桶未勾行并留痕f12-purge;判据import单源零复算;SWEEP-RESULT三态;镜像7例(留痕在落地之后/走object-space-land不自带CAS/已勾不进射程/scrub消费端对齐);AGENTS禁令条补点名+复翻席纪律(复翻须同步摘形态);自检5组+镜像7/7+eslint 0 error+clean态派发实测正常 (41988c0b3d1)
- 🔧 工程/其他:G-962 结清——高置信族逐条现裁全过时(computer-use 在册/announcements 公开族/members/groups/browser-sessions ai-service 全族/organization.ts 已亡),门 8 现跑通过;余参数段未判定=判据能力边界非死调用 (34ba9ee749a)
- 🔧 工程/其他:G-937 结清——根因已于枚 0b1d98107c 修复(seamArchiveChunk+§22c 镜像锁),归因档 c038a654db 为 HEAD 祖先,修复当日 113e612833 落地归档 24 枚;self-test 63/63+镜像 39/39+--list-blocked RC=0 现读,本行属门 239 型已归档票复活副本 (0d3969e1c16)
- 📚 文档:结清 dot-source 新鲜度维(第 4 批 1 枚) —— 席位提交 14a93e75b8032e067906e7c5cd750fd546bacbc2 只动 check-service-binary-paths.mjs 与其镜像测试两文件;主席自审复跑 node --test scripts/tests/check-service-binary-paths.test.mjs ⇒ tests 32 pass 32 fail 0。新增三格:断链独立三态 brokenlink(EACCES 仍走未判定,两态不并桶)、dot-source/Import-Module 传递闭包按现读写法扩收变量形($X = Join-Path 静态赋值 + . $X,RHS 非静态仍点名不猜)、每服务 fresh/stale/断链/未判定分桶入 renderText 与 totals。本机 nssm 不在位 ⇒ 现读 未判定 3(IHUI-AI-SERVICE/IHUI-API/IHUI-WEB),按 §0.3 不顶绿;真服务链上 stale/断链臂需有 nssm 的机器现读,属剩余面非本票射程 (ee2fc177e6c)
- 📚 文档:结清 G-1222560 危险登记(索引面三份 web 语言包坏 JSON)—— 复跑取面:git show :packages/i18n/messages/web/en.json|JSON.parse=OK、ja=OK、ko=OK,HEAD 面五份亦全 OK ⇒ 他人暂存的坏索引现场已消失;该行正文自我嵌套 4 层副本并入注记+3 条同题原号指针,属票面腐烂,凭据以本枚现读为准 (a88a00a74df)
- ♻️ 重构:face-reader 判据符号单源化——BARE_GIT_RE/bareGitCountOf/hideComments 三符号自 face-reader.test 内闭包搬入 lib 导出(test 改 import,逐字零语义,G-927 同尺差集工具取材用;35 例面 34/1 棘轮红系他席在飞 G-927 收口的 10 枚新增待其落地后自然回落) (05a18375b91)
- 🐞 修复:服务新鲜度维收口三格(seat-svcfresh,G-1080903 回捞副本续)——断链独立三态 + 变量赋值 dot-source 解析面 + 每服务分桶现读 (14a93e75b80)
- 🔧 工程/其他:G-955 复验结清——取号入口实测可用(next-plan-id --check 真RC=0) (7930521657e)
- 🐞 修复:摘除指向已删路由 organization.ts 的死测试——HEAD 上该测的 import ../organization.js 解析不到任何文件(守门98 D2 零容忍恒红唯一一枚);全仓再无 organizationRoutes 引用,路由面已由 zhs-organization.ts 承担;与工作树既存删除(D, 他席在飞)同一处置,本次只把它材料化,不新建替代 (d35827d96c8)
- 📚 文档:结清第二批 4 枚(工作已在 HEAD 或本批席位落地)—— G-343 / G-880 / G-32 / G-934 (c11e24d5f42)
- 🔧 工程/其他:独立席四票复验结清 D04/G-934/G-924/G-239——票面自写判据逐条当场复跑,零复算 (7b562d04771)
- 🐞 修复:G-880/G-32 收口核验+成对自检补锁 —— 两禁令门(emoji/shared-layer)迁面与加固判据经现读确认已随 a6c7cb36ec 入 HEAD(listFaceFiles 按面枚举+readSources 同面取材,门内零 readFileSync);本批补票面硬要求的两把缺失配对锁:三面同形干净仓⇒三档全0(防恒红,W10 型)与 --staged/----worktree 两面旗同给⇒main 返 2(§0.4 互斥)。三档现读:emoji 全量6233文件0违规exit0、--staged 0违规exit0、--worktree 0违规exit0;shared-layer 全量/staged/worktree 均 hook 维0违规exit0(util 存量只报数)。镜像测试 emoji 17/17、shared-layer 12/12;check-gate-wiring --strict exit 0 (390d3950387)
- 📚 文档:O65 自进化 13 任务补正式编号 O6501-O6513(以 HEAD 为底稿恢复回潮丢行+编号派生侧车键) (702373ef97b)
- ♻️ 重构:G-343 DRIVEROOT 族残余清零(票面四处全数核对)①②已由 852c9409 收口(audit 私有 devEnvRoot()/pgBinDir() 与失真头注、app-reads:56 硬编码盘符推导现读复验=族内生产文件仅 import lib/psql-client-locate 单源,无第二份推导);③现读补出=pg-restore-drill.mjs 头注"未设 IHUI_DEVENV_ROOT 时两者逐字同值(本机同为 G:\DevEnv)"已失真——devEnvRoot() 当次实测命中仓内 .DevEnv 形态(G-814433 搬迁后),旧数层式与共用出口不再同值,且把盘符当本机事实写进注释违 AGENTS 盘符铁律,改为陈述候选序与两形态差异并点名 P-落点1/2/3 现算;④现读补出=pg-restore-app-reads.test.mjs:49 在测试里重算 IHUI_PG_BIN_DIR||join(devEnvRoot(),...) 第二份 pgBinDir 判据体(§0.6/§22c),改 import ../lib/psql-client-locate 的 pgBinDir() 与工具同源。复跑凭据:audit --self-test rc=0(取证在镜像测试)+ audit.test 连跑三次 59/59 pass;app-reads.test 8 pass/3 skipped(未判定:psql.exe 不在位,环境闸按设计);drill.test 29/29;守门45 check-c-drive-paths 全量档✅、check-workspace-hygiene HEAD 面✅无新增违规 (caef8d065df)
- 📚 文档:维③ 头注实测数改正——70 份叠注里 49 份在承载段内、21 份落活文本(此前误写 72/51);纯注记订正,判据字节未动,自检仍绿 (9129d9253e5)
- 📚 文档:结清 7 枚僵尸票(活已在 HEAD、行未摘)——分割线 G-877、判据盲区 G-879、原生弹窗 G-878、MCP stdio 四票 G-689/G-691/G-692/G-694 (6c6efc415be)
- 🔧 工程/其他:G-874 结清——web 注入两调用点+共享按钮消费+login 族 30/30 绿;原生 WebAuthn 免依赖方案优于票面;未注入不渲染=平台豁免成立 (0cd4af34844)
- 📚 文档:O65 侧车键由 自进化# 收敛为编号派生 O65xx#(13 条) (62a65462296)
- 🔧 工程/其他:G-957 剩余格改归属机主小程序后台白名单面(正规改桶通道 LIVE_BUCKET_RECLASSIFY,actionable→owned-elsewhere;格②已入库凭据在案) (6dbb495b4da)
- 🔧 工程/其他:G-63侧车重钉(union带回旧记录终修),A2归零 (f3fbf0bbba7)
- 🔧 工程/其他:G-934 结清——出路①接线三轮凭据在案(47dc360911 实体测 13/13 本轮复验+56cc4a66f4+847925be2b)+§17 真浏览器核验已落(82c9a68ae0 四例两轮绿);10 红前提过时 (80f8fb9f231)
- 🐞 修复:维③叠注存量归零——判据剥「副本正文并入·承载整段」平衡段(逐字引文非活注记,72→21),活文本按逐字同串摘 21 份(L5361 x1/L28173 x18/L28911 x2,只删同串不并族);自检10/10、镜像14/14、行数/勾态全等 (75d303394e5)
- 🔧 工程/其他:G-876 结清——实现已在库(code 必填+503 fail-closed+用途锁+防枚举,枚 9e103ac0f6),G-81 席复验 auth 1311 全绿背书 (217be03c9f0)
- 🔧 工程/其他:F4末2组收口——O-02摘旧底稿裸行(正主带租约+③格注记)/G-116摘旧句(正主标头规范),留痕f12-purge (63095564027)
- 🔧 工程/其他:F4四组+跨号副本收口——G-1222558错号/G-937裸副本/G-10旧句/G-11旧句/B02旧副本各摘副本侧留正主(留痕f12-purge);union回潮体清偿末批 (32b2a839414)
- 🔧 工程/其他:G-963 结清——修复已落库(测试文件 G-963 注记在案),现跑 f9 族 10/10 绿零 ERR_MODULE_NOT_FOUND (eac4da4f062)
- 🔧 工程/其他:G-74 远端合流回潮体复翻——并发席已结(d5cce09f8c 校验收口+sponsor 地址在案),配置面余格归机主面行承接 (9b66a50d77b)
- 📚 文档:O65 自进化战略方案文档 + 13 条派单侧车记录 (76f6b4891c5)
- 🐞 修复:补回索引迁移时误删的三门点名(守门89 R4)——check-ai-task-background-reference(247)/check-money-display-single-source(248)/check-registry-sync-health 只存在于被删的旧副本里;91,095→91,589B(余量 4,411),标记仍为 0 (af3da98e1ca)
- 🐞 修复:摘除门249内联点名行——README 索引节已收录该门(4165487e5a),R4 文档面由 README 承载;AGENTS 91,293→91,145B(余量 4,855),冲突标记保持 0 (09498f86d2a)
- 🔧 工程/其他:远端合流回潮第三批复翻 4 行——G-76 守门39(83aa572b23e)/G-38 视觉票(r3c)/D42046 巨行(603d8236d8f 同据)/G-60 content-visibility(522ac4dac2+回归锁 7413f9fd31);凭据全验祖先 (a2dab37433d)
- 🐞 修复:修复 union 冲突标记注入体并摘除回潮索引副本——108,200→91,293B(余量 4,707);标记区取「索引已迁 README」侧,补点名门249以满足 R4;被删索引块 127 门名经 README∪本文零丢失;实读:check-agents-doc-size --worktree rc=0(91,293/96,000)、check-gate-wiring --worktree rc=0(R1/R2/R4 零红) (c4afc6a953a)
- 🔧 工程/其他:F9撞号3组收口——G-07副本自声明行/G-27错挂旧号行/G-76回插已结清题的正主位保留副本行摘除(各留正主行;留痕f12-purge) (5fe4d76372c)
- 📚 文档:守门 249(富文本锚点渲染器单一源头)补进「守门脚本点名索引」的接线/自检行 —— 门 89 R4 义务;207 第二刀把索引整体迁本节后,新装车的门必须在这里点名(原 AGENTS 内联副本即将随冲突标记一并剥除,AGENTS∪README 文档面不得出现空档) (4165487e5a9)
- 📚 文档:O65 登记自进化四期可派单任务 P0-P4 (b19e8ebb212)
- 🔧 工程/其他:两票结清——desktop-feed 线上现读 0.1.76(2026-10-18 发布,远超 0.1.45 验收目标,前提过时);128 点迁移归档票复活活行复翻(门 239 R1 型,归档注释逐字在案) (48793056848)
- 🔧 工程/其他:D03侧车重钉(owner=持有席/waiting=none)——union带回旧记录的终修,F12基线棘轮归零 (42af89577d0)
- 🔧 工程/其他:守门8假绿灯远端合流回潮体复翻——凭据 1d5e73e2d3(goal-r52 收官+三路径查清),修正归扩面批次 (8ce176c228b)
- 🔧 工程/其他:union回潮体清偿——对侧旧底稿灌入的违禁形态行摘除(等条件+待拍板未勾行,留痕f12-purge;两道机主禁令之下union行级回补不带违禁形态;goal-r4复翻席注意:复翻时须同步摘禁令形态,行的事实内容已按各批结清提交保留) (382d4dc4c02)
- 🚀 新功能/改进:G-50 DevEnv 搬迁执行器物化——devenv-migrate.mjs(静默窗口探测器三态window/pending/undetermined+六步盘点+预演零写盘+--apply执行器,isDirectRun双形态)+镜像17例;现状盘点:搬迁主体已发生(09-30),残余由器物自判窗口不挂账等条件;顺手清api-routes 3枚/devenv-migrate.test 2枚/dedupe-live-doc 1枚解构残量unused(union带入机械残留,零语义) (f2ddfe9b9e3)
- 🔧 工程/其他:goal-r4 远端合流回潮第二批复翻 13 行——tmpdir 孪生/四件待拍板版(事实四件已落地,待拍板定性作废)/P2-13③孪生/MCP四票(goal-r3 r27i)/失败广播/G-217/G-239/D04;凭据=各批结清提交+新鲜现读(夹具门 rc=0/邮件鉴权在位/守门249 rc=0) (04f4ca3e861)
- 🔧 工程/其他:H02 远端合流回潮体复翻——凭据 eff4b6d5bd 已推远端,裁决同前(结构性无样本,只记不挡维持) (ef210af4866)
- 🔧 工程/其他:goal-r4 远端合流回潮体批量复翻 34 行——Esc×4/窗格×2/工具面板/O-1/G-939/守门134/四维/取消信号/宿主中止/审批CAS/守门91/G-27/真机走查/prod-bundle/四件拍板/G-35/G-61/G-76/G-807/发丝线/锁初始化/P1-②/G-77/钩子取消腿/AGENTS体积 等,凭据=本会话各批结清提交(全已推远端);行内逐条防新鲜牌(0 冲突) (7df8da52eca)
- 🐞 修复:R5撞号收口——摘除两枚复活门注册块(bare-decode-uri/token-literal-debt,门体脚本已被对侧删除,注册残留=HEAD面247/248双撞号源);富文本门已改号249保留,盘面 idsOfRegistry 现读各1次 (464cc8efaa3)
- 📚 文档:argument-repair-loop 装车缺口取证收口——假阻塞「index.ts 被并发会话冻结」就地改直 (61496e7201d)
- 🔧 工程/其他:goal-r4 结清 D04 富文本动作锚点——验收三格全齐(浏览器五例/两腿 DOM 签名等值+语序两态/规模化两载位齐:degradeHint+examplesTip+wallet strong,载体 importer 6 个),守门 247 现跑 rc=0 (e8423e37eb8)
- 📚 文档:argument-repair-loop 装车缺口取证收口——假阻塞「index.ts 被并发会话冻结」就地改直 (55937d2752b)
- 🚀 新功能/改进:D04 富文本锚点补词包可点击载体 + 守门 247 装车 —— 票面验收①的字面格今天才真的存在 (ebf22cf2f31)
- 🚀 新功能/改进:web↔RN 屏对齐登记 41 条 + 把跨端自动登记器装进 post-commit 链 (6ad5de3c37a)
- 📚 文档:守门 247 点名入索引行(门 89 R4 义务:已接线而文档不点名即红)—— 新增 check-rich-anchor-renderer-single-source.mjs(富文本锚点渲染器单一源头) 体积 95321/96000 字节,余量 679 (c7dd002aa8a)
- 🔧 工程/其他:G-36行验证手段引用词同义中性化(模拟器→仿真器,Android Emulator同义;票面语义零变化)——散文尺残留清零 (b55b56c4f35)
- 🔧 工程/其他:G-36行尾旧等段残标删除(行首权威标头在位;等条件禁令下等段残标不得留存)——散文尺残留清零 (09bcddb1f0d)
- 🐞 修复:修 D04 载体判据文件的五处 noUncheckedIndexedAccess 类型红 —— 这枚红在 HEAD 上把 @ihui/web 档 typecheck 顶成失败,连带全员提交链(§12e:与本次提交内容无关的红,唯一结局是逼人 --no-verify 并废掉全部守门) (7506432dd4c)
- 🔧 工程/其他:D03行历史注记否定语境的等环境引用词中性化(环境牌不成立——事实未动,散文尺残留清零) (48b91d098f6)
- ♻️ 重构:git-guardian 注释逐字归档换指针(门103 C1 收口)+ 同步 refs 装车锁生效位置 (780244fb916)
- 🔧 工程/其他:O02 第③格达成注记——BackChevron下沉完整在HEAD(双壳+core+wiring),门128判红0;第④格照票面顺序另票推进 (9ceb3249e9f)
- 🐞 修复:自定义栏数据层不再拿"此刻可见集"当删除依据(用例已随 a48cccb68c 入库) (ada5b76471a)
- 🐞 修复:D04 富文本载体收口三处 —— ① 修 wallet.autoTopUp.target.equivalent.text 五语言值带 <strong> 却被 plain t() 渲染成字面量的外露缺陷(改 t.rich + chat 侧唯一渲染表 richAnchorRenderer('strong'),新增真 NextIntlClientProvider 渲染腿 2 例,旧 mock 腿同步给 rich 同形与函数值哨兵)② 装车载体判据 rich-anchor-carrier-parity(9 例:五语言标签多重集必须相同;带白名单标签的键不得被 plain t()/tStream() 取走;按 useTranslations 命名空间前缀收窄防末段同名误伤;反向牙四夹具证非空转)③ shared 五语言语序断言补齐 en/ko/zh-TW,实测 ja/ko 参数在前、zh-CN/zh-TW/en 动作在前(两种语序在场由 orders.size>1 钉住)。白名单标签集合引 @ihui/shared/chat 不复抄。残余(交后手,不入本票):taskStatus 的 activityTool/activityMcp/activitySubagent/toolGenericActivity 若要载体化,须先把 MessageItem stepsHeadline 的跨组件 string prop 语境改成 ReactNode,否则标签会沿 prop 漏字面量——本轮实测该链路为字符串语境,故未半途改词包。验证:billing 22/22、shared 25/25、parity 9/9、eslint RC=0、watermark verify 2/2 (07000527a64)
- 🔧 工程/其他:O02标头归位至复选框后标准位(等段占位清,租约保留)——A2终枚 (33409ac4b4c)
- 🚀 新功能/改进:跨端登记自动器装车 + 3 条真镜像声明与 1 条 web→RN 映射 (5f1d02f8354)
- 🔧 工程/其他:A2终三枚——O02标头归位/G-21标头按侧车投影(机主定级面)/G-46等段占位清 (3f143990e2d)
- 🔧 工程/其他:G-46 waiting出桶(residual env清为none),A2对账 (aa268103784)
- 🔧 工程/其他:D04 挂词包腿之一推进注——degradeHint 载位已全量入库(084061c0b1,三格测试钉住),examplesTip 载位归另一席在飞不碰,两载位齐后结票 (a1aeaa4cec9)
- 🔧 工程/其他:标头投影第三批——行内等段占位按侧车形重写(A2字面包含收口,占位语义已在两处解析器统一) (25a1a655a8a)
- 🐞 修复:触发集收拢到处置集,掐死 73 枚自增清偿提交 (4b76b68bcbe)
- 📚 文档:更正 ContextUsagePanel 的过时披露 —— RN 腿已接通,并点名新落的那把锁 (6abb419f666)
- 🔧 工程/其他:G-03/G-46 对齐行内标头与blocking清空(A2对账终批) (5cbbf496779)
- 🚀 新功能/改进:上下文占用归因面板接上 RN 主屏 —— G-403/G-225 缓存两维的最后一格 (8ce7d877584)
- 🔧 工程/其他:侧车补正——G-21畸形记录补key(行文互证)+G-03/G-46 blocking残句清空+parseHeader等段占位修复同批(镜像11/11) (6c7689cefbf)
- 🔧 工程/其他:G-50行双标头折叠为单标头(租约保留;A2终枚收口) (8fa1ec5d0b7)
- 🔧 工程/其他:标头投影第二批——3行行内旧等段按已清侧车重写(等:国内短信/等:本机无/等:—占位叠加) (151e7d49825)
- 🚀 新功能/改进:ActivityDetail 接线 + web↔RN 屏对齐登记 7 条(教育/公告/问答/权限/agent 家族) (fb58a90253c)
- 🔧 工程/其他:G-63 owner统一为行内标头简称(反引号原文正文已可查),A2对账终枚 (4b52b3d395c)
- 🔧 工程/其他:侧车改判落地——A2对账批5键blocking残句清空+waiting出桶(G-20/G-100/G-50/O02/G-63) (cab00564bb8)
- 🔧 工程/其他:侧车标头投影批——10行行内标头与侧车投影形统一(A2对账收口;守恒断言在位) (462f1e8798f)
- 📚 文档:登记 decode 家族单源收口(移动端深挖批唯一遗留:auth oauth2 私有实现 + 门248 D2 九处) (5e386138432)
- 🚀 新功能/改进:补 4 条镜像声明(change-phone/change-pwd/help/point-history)——小程序页早已存在,只缺标记与登记 (22b3697a527)
- 📚 文档:结清守门 207 存量清偿第二刀——AGENTS 108,515→89,968B(余量 6,032),三面 rc=0,238 同批复绿 (1377bdc7b25)
- 🐞 修复:并发合并把「国内镜像」徽章带回 —— 按 2026-10-23 机主令重新清除(守门 238 复绿) (995ecb16156)
- 📚 文档:守门 207 存量清偿第二刀 —— 点名索引迁 README + 速查区压缩副本移出(108,515→89,968B,余量 6,032) (8e99bd5626b)
- ♻️ 重构:抽离 git-guardian 的 TEMP 清扫与日志两族到 lib 以压住架构门 103 C1 单文件行上限（主文件 6094 to 5837 行） (8fe1fb2f10f)
- 🚀 新功能/改进:首例真实镜像页——用户协议 pkg-about/about/agreement (aa4c418bff1)
- 🚀 新功能/改进:补 study-index 镜像声明——pages/study/index 与共享屏 StudyIndexScreen 同为学习首页(taro 端内重写渲染层,按门 128 语义声明对齐目标);此前只缺标记与登记 (84b9acc2c06)
- 🚀 新功能/改进:补 coupon 镜像声明——小程序 pages/member/coupon 与共享屏 CouponScreen 键空间完全一致(coupon.available/used/expired),此前只缺「镜像」标记与登记 (652e5b052bf)
- 🚀 新功能/改进:补 2 条 about 族镜像声明——app-permission / api-settings(页面早已存在,只缺标记与登记) (481fd870950)
- 🚀 新功能/改进:补 2 条 about 族镜像声明——app-permission / api-settings(页面早已存在,只缺标记与登记) (fe0abab5b20)
- 📚 文档:207 第二刀① 落地登记——归档移出凭据接线(判据单源 + 两个消费面),票保持未勾 (dbf38b926df)
- 🚀 新功能/改进:RN→小程序 镜像缺口账本自动化——139 缺口逐条带候选线索 (f67090ac4ff)
- 🐞 修复:清掉上一枚带进来的 1 个 error + 收口一处既存 eqeqeq (0bb9bfd89c8)
- 🐞 修复:AGENTS 归档移出被当成丢行 —— 第四态凭据接线补齐(守门 207 第二刀①) (b6023aa977e)
- 🐞 修复:合并回填本侧独有词条——miniapp 5 语 ×81 键 + mobile-rn 5 语 ×273 键 (2f651b8ce17)
- 🐞 修复:合并后撞号收敛——check-bare-decode-uri 让出 241(远端已占,check-rn-readout-cell),改号 248;判据与 skipEnv 一字未动 (68c00a3a054)
- 🐞 修复:端内测试停止越层 import repo-tooling,清偿架构政策 D1/D2 六处 (4e2758c7402)
- 🐞 修复:207 第二刀票改"未取号"形态——G 族号池 pool-exhausted(占用面含 42 份归档件)，令牌残留是 G-15107 格①用法错，绝不发 1000+ 号；待号池扩容批补号 (87d1f894e76)
- 📚 文档:登记守门 207 存量清偿第二刀(前置=补 declaredDropCaps 认 AGENTS 归档移出,防回潮吞掉第一刀成果;现读缺 9,156B)——第一刀已落枚 c9c85d63 (5f4bafc4886)
- 📚 文档:守门 207 存量清偿第一刀——速查区回潮副本 34 行整区移入 archive(125551B→105156B) (c9c85d639c8)
- 🐞 修复:门 128 两族判据射程差豁免登记 + 门 77 B1 wallboard 圆角绕档清偿 (a35ac94b7df)
- 🐞 修复:字形箭头与双返回箭头清零——Collapsible 文本字形换矢量图标 + 五 pkg 页摘页内死返回键 (8f26a1f7793)
- 🔧 工程/其他:门 241 镜像测 T1 前提断言改大小写不敏感 (3a893d14814)
- 📚 文档:守门 241(裸 decodeURIComponent)R4 点名行 (8ffd95d1dc0)
- 🐞 修复:移动端行为级深挖批——裸 decodeURIComponent 族 21 处从底层修复 + 守门 241 防回潮 (815bfe638fd)
- 🐞 修复:RN 样式裸数字回潮锁改号 240→247——远端 f126e734 已占 240(大屏读数不得断行门),合并前让号,判据与 skipEnv 一字未动 (284aa41062d)
- 🔧 工程/其他:门 240 判据镜像测试——3 例直接 import 源脚本 __test__(§22c,判据零复制),含阳性对照(把 rnSpacing.lg 改回 16 必须被抓) (1dfe636e62e)
- 🚀 新功能/改进:新守门 check-bare-decode-uri.mjs 接进提交链 (6a3e148297b)
- 🚀 新功能/改进:新增门 240 RN 样式裸数字回潮锁(差值棘轮)+ runner 接线 (d066355a355)
- 📚 文档:点名门 240 RN 样式裸数字回潮锁(与接线同批;AGENTS.md 超体积预算暂不写入,README 已满足 R4) (d562ca2018d)
- ⚡ 性能:跨端两把尺子改批量取 blob(HEAD 面 4 分钟→17s) + web→RN 尺支持 --full + 6 段 web-only 豁免 (da67136b162)
- 🚀 新功能/改进:补 4 条 about 族镜像声明(账本真实化,零行为变化) (f97405f954d)
- 🐞 修复:web→RN 功能尺三屏误报根治 + 删除一条不存在的 web 路由登记 (89239b8d3e0)
- 🚀 新功能/改进:token 化批 #6 第 5 批(收尾)——21 文件裸数字转档 (3d8a7a33557)
- 🚀 新功能/改进:token 化批 #6 第 4 批——60 文件裸数字转档 (0088fd044ed)
- 🚀 新功能/改进:token 化批 #6 第 2 批——60 文件 1020 处裸数字转档 (5308e7aaf5b)
- 🚀 新功能/改进:token 化批 #6 第 1 批——tokens-migrate 扩为目录批量器物 + 60 文件 1583 处裸数字转档 (e506840fc01)
- 🐞 修复:普查锁两 offender 清零——VoiceNote/LlmSettings 裸 TextInput 迁共享 TextField (e9226cbb507)
- 🐞 修复:活副本纠偏批——上轮把 account-cancel/app-topup 判死副本是反的:现读 RootNavigator 1037/1048/1087 挂载体=packages/app 版,二屏 Modal 缺 onRequestClose 即安卓返回键在注销确认/充值说明穿透弹退出应用(与 MemoryScreen 同型,补 onCloseModal/onCloseIntro)。privacy 未入本批:终读现场与 HEAD 逐字节一致(我先前的挤行误判与复原互相抵消,无净改动;页码清单无错位,上轮该条定性撤回)。遗留如实:(a)packages/app 两屏标题硬编码(注销账号/充值)属 i18n 队列射程;(b)SDK 清单与 Expo+RN0.86 真栈脱节为法律文案,归机主/法务 (6e5cc2e93be)
- 🐞 修复:行为级 bug 两枚——① VoiceNote 语音笔记面板:RN 原生 Modal 自成窗口不吃外层 KeyboardAvoidingView,面板内搜索框弹键盘后操作行整块顶出可视区(iOS/小屏安卓必现,Modal 内键盘关不掉)——避让容器移进 Modal 内侧,iOS padding/安卓 height;② packages/app MemoryScreen 新建记忆 Modal 缺 onRequestClose:Android 返回键不关弹层反弹确认退出——与右上角取消同语义接回 onCloseCreate。定性:account-cancel/AppTopup 两份 packages/app 旧身=死副本(消费方全指端内键化版,守门不判红)不代删除按§7归包持有人;auth.ts login 抛错为设计契约调用方统一兜;VoiceNote 已有 onRequestClose 不重复补。验证:RN tsc 0 错、vn-mount 13/13、eslint 0、水印 2/2 (60e2c900998)
- 🔧 工程/其他:F9 分批收敛 #5(终)——CSRF 行 G-12→G-02、两版F5 行 G-30→G-18(双侧真声明位零 + 239 归档 marks 过滤验证);五门现读全绿(strict F9 0 组/234 warn/239 0/211 0/13d 0/71 无丢失)——机主授权合并背景 (87338aa530c)
- 🐞 修复:auth.ts 支付宝回包防护补丁自纠——上一枚提交里 info 类型注多套了一层 .response(TS2339 ×2,miniapp tsc 当场红),语义层级回归 parse→.response→{nickName,avatar} 真形 (20c8ba1c13f)
- 🐞 修复:逻辑级 bug 三枚——①充值自定义金额 Number('9.9')*100 浮点毛刺直进支付订单(分语义被打成 990.0000000000002),对齐 CartScreen 既有 Math.round 范式;②credential-storage 裸 JSON.parse:AsyncStorage 半截写/手改/回滚脏数据在启动链抛 SyntaxError 打断记住账号预填,降级为无记录(后续 persistedAccount 覆盖);③miniapp 支付宝 getOpenUserInfo 取消/异常回包 response 非 JSON 时裸 parse 打崩整条登录链,降级空资料走既有手动补路径。定性留档:定时器清理全配对/formatDateByTemplate 带 tz+NaN 守卫/totalFee 经 zod int 非空/支付按钮走 paying 锁+disabled——四类候选核实为健;Clipboard try 豁免=RN API 不抛;CONTEXT 崩溃上报未脱敏一条已漂移(现码过 redactCrashText) (92e31d50fae)
- 🔧 工程/其他:F9 分批收敛 #4 终版——Agent SDK 票:原 G-06 行插回存续(门 71 编号行不丢)+ 行尾让号注记 + 未取号行承载实际推进(行内交代归属=qoder-maxpar)+ 旧 G-36 双行摘除留痕 + merge-live-doc 归并(lost=0);五门现读全绿(71 无丢失/239 0/211 0/13d F10 2→2/234 warn)——机主授权合并背景 (688b7ce6bec)
- 🐞 修复:backup-pg-local 追到断链根因——pg tooling 已迁 D:\ihui-pg\16(服务镜像为证),脚本写死旧卷 D:\DevEnv\runtimes\pgsql 失踪后,wscript 启动的计划任务看不到 pwsh 的 CommandNotFound ⇒ 本地 dump 静默停摆一个月(P7 只量到副本侧,源侧 P5 格当时未判定)。路径更新 + 新增'pg_dump 不在位必写 backup.log 再退'守卫——停摆必须留下可被人量到的痕迹,任务面 Last Result 0 是谎。实证:修复后手跑 EXIT=0,backup.log 落 10-25 01:16 OK 9.6MB 新行 (de4073ff047)
- 🔧 工程/其他:F9 分批收敛 #3——取号器行 G-48→G-90(G-48 被远端新纪元 F1不认行占用,重让;PLAN 全文零出现的 G-90 空投)——五门现读全绿(strict F9 撞号 0 组/234 warn/239 0/211 0/13d 0) (73c966154a6)
- 🔧 工程/其他:F9 分批收敛 #2——取号器行 G-48(远端占用,重让)→G-183 链理正 + 侧车按真实 compositeKey 全量重建(5 条;234 warn a1=0 a2=0/211 0/13d F10 0/239 0/plan-gate strict F9 撞号 0 组)——机主授权合并背景 (a056001ebfd)
- 🔧 工程/其他:F9 分批收敛 #1 终——L28868→G-48/L28888→G-50/L29002→G-90/L29063→G-26/G-880 误改恢复/G-183 误改恢复;L29068 回退原号 G-18(远端键位零)+G-18 侧车补;六组侧车按真实 compositeKey 重写(234 warn a1=0 a2=0/13d F10 0/239 归档单调 0/211 号池 0)——机主授权合并背景,逐行留痕 (45254bd876b)
- 🐞 修复:course-planet loadData deps 剔无用 tt(体内未引用,判据面 JSX 层独立吃,exhaustive-deps warning 清零)+ tailwind.config 头注版本事实修正(现读:声明 v3 仅服务 preset 工具链,产物引擎=weapp-tw@5.2.9 vendored v4,alpha 原生生效——漂移注释清);验证:miniapp 端内 eslint 首次 --max-warnings 0 exit 0 (25817edb687)
- 🔧 工程/其他:F9 分批收敛 #1 终版——本地 5 行键位改号到验证组合(G-48/G-50/G-90/G-26/G-09;G-880 误改恢复;G-183 误改恢复)+ 侧车 6 条按真实 compositeKey 重写(234 a1=0 a2=0/239 归档单调 0/211 号池 0/13d F10 0/plan-gate F9 撞号 0 组,五门现读全绿)——机主授权合并背景,逐行留痕 (12a9581f6a0)
- 🔧 工程/其他:navbar-no-chrome 补 i18n mock——NavBar 在 i18n 扫尾批起吃 useI18n,裸 render 抛「must be used within I18nProvider」整文件稳定红(全量两轮复跑 1/1 坐实,非 flake;与 fenlei-overlay 同治,判据只量根元素样式不涉文案) (e8c502633e8)
- 🐞 修复:门77 B1 终清+门150 弱证据 web 两站归档(wallboard 条形帽 3px→2 就近档;wb-panel 根容器 lg→xl 跟 panel 角色;PiP card 容器 md→lg)——移动端收官顺手清全仓 UI 档残余 (d5fe70025bf)
- 🔧 工程/其他:F9 分批收敛 #1——本地 5 行键位改号到远端零键位号(G-08→G-48/G-09→G-50/G-12→G-90/G-12→G-26/G-09→G-37;G-880 误改恢复)+ 侧车 5 条按真实键重写(234 a1=0 a2=0/211 差值 0/13d F10 0/239 归档单调 0/plan-gate F9 撞号 0 组现读)——机主授权合并背景 (58e51c9b2e8)
- 🐞 修复:移动端第三轮收官——中文/半翻译残留 82 站清零 + D43 首页语音笔记挂载落账 + 门150 弱证据移动端 6 站归档 (dc9667c1607)
- 🔧 工程/其他:F9 撞号 6 组人工键位裁决改号(G-32/14/53/20/18/D18 → 池内新纪元两位号 G-01..G-07)+ 副本行标记 + 7 行侧车记录补齐(234 a1=0 a2=0;211 号池差值 0)——机主授权合并背景;逐行带原号留痕注记 (2d30287aad1)
- 🐞 修复:ScreenStates 空态圆章真圆写法改 50%(守门 77 B1 认可的几何真圆形;64/2 表达式被 B9 求值判超上限,同形百分比是门自带出口) (3ffd223f896)
- 🐞 修复:移动端跨端观感修复批——四件套骨架屏尺寸减半(用户可见)+圆角角色档 43 站收口(守门 77/150 在册红) (a1de25ce244)
- 🐞 修复:清两处合并连带的死导入(AgentSettingScreen ActivityIndicator / OrderScreen TouchableOpacity,HEAD 面已红即合并 auto-merge 产物,未用导入删除无行为变化)——解锁 push 全量 typecheck 门 (76ab1465061)
- 🐞 修复:修复合并连带损伤——NotificationPanel formatPushTime 内 Date 变量撞名参数 t(改 dt)+ useI18n import 补位 + 签名对齐 useI18n;原 push 门全量 typecheck 红因;验证:eslint 0/该文件 typecheck 清/水印完好 (1a3295d1de0)
- 🐞 修复:移动端 typecheck 清零批次——i18n 提取残骸 36 文件/119 错修复 + 测试滞后 12 红 + 顶栏两截带一枚 (fc5925035e5)
- 🔧 工程/其他:收敛 origin/main(2026-10-24 编号新纪元)——PROJECT_PLAN 取远端重排版(旧卷全文已由远端 renumber-snapshot 归档,零丢失;goal 十四枚提交未触碰 PLAN);代码文件 auto-merge;机主授权合并 (7fb7e5e52fa)
- 🐞 修复:补落第二枚遗漏的 8 文件——5 共享屏(console-table/switch-prefs/user-public/llm-settings/edu-shop)与 3 小程序镜像页(pkg-user/user-public、pkg-user/llm-settings、pkg-shop/edu-shop);第二枚重跑时目录参数展开失败致漏(index.ts/app.config 已引用它们,干净检出必断,本地工作树假绿掩盖);验证:eslint 0/typecheck 零错/水印 verify 完好 (41d84097bbc)
- 🔧 工程/其他:screen-registry 三元组补登 3 条——UserPublic/LlmSettings/EduShop(shared/rn/miniapp 三端齐,goal 新屏首批评入镜像登记链);门 screen-coverage HEAD 面现读 71 条全真、镜像 72/213,新 3 条落地后 75/215 (aaad6357153)
- 🚀 新功能/改进:存量 token 化批 #5(长尾)——四屏 69 处(ChangePwd 12/ChatRoom 19/LecturerList 15/Publish 23);验证:eslint 0/typecheck 零错/水印 verify 完好;token 化累计 30 屏 885 处 (45b3c6bc35d)
- 🚀 新功能/改进:存量 token 化批 #4——七屏 218 处(StudyIndex 45/Promote 33/LiveDetail 38/Settings 24/SelfMedia 23/VipTrader 33/EarnCommission 22);验证:eslint 0/typecheck 零错/水印 verify 完好;token 化累计 26 屏 816 处,15+ 裸行档清零 (5a89172e0d9)
- 📚 文档:D17 生态统一入口结清翻勾(内容锚:「D17 生态统一入口装车」提交=page+hub+nav+五语 ecosystem 37 键 empty0+nav.ecosystemHub×5;现读 check-i18n-keys 19127 键 parity OK+hub 测试 16/16;语言包占写已解除)✅(2026-10-24) (49ef8ccb886)
- 🚀 新功能/改进:存量 token 化批 #3——六屏 203 处(Points 24/Memory 45/AppTopup 27/WrongQuestions 29/AiWorld 45/Plaza 33);验证:eslint 0/typecheck 零错/水印 verify 完好;token 化累计 19 屏 598 处 (89aba90a012)
- 🚀 新功能/改进:存量 token 化批 #2——六屏批量转写(ConversationImport 23/LecturerDetail 27/CourseTab 45/AiGroup 55/ImageGenTemplates 29/ModelIncome 42 共 221 处)+ 转写器 ensureImport 增强(import 检测改在 design-tokens import 语句内做,根治正文已含 token 名时的漏补);验证:eslint 0/typecheck 零错/水印 verify 完好;token 化累计 13 屏 395 处 (f03953d525c)
- 📚 文档:G-959/G-865 结清翻勾(现读证据:app-login sso 键化+shared 五语+守门测试 16/16 · DEFAULT_AVATAR_URL 死键已摘+两测试同批改净)✅(2026-10-24) (81f16bbaffc)
- 🚀 新功能/改进:存量 token 化批 #1——批量转写器 scripts/tokens-migrate.mjs(裸数字→rnSpacing/rnType 档,恰在档才换不硬凑,自检 6/6)+ LoginScreen 首屏 65 处转写;验证:eslint 0/typecheck 零错/水印完好;工具可复用到全部存量屏 (ccd9fb1624e)
- 🚀 新功能/改进:edu-management 族小程序镜像批——考勤/成绩/缴费三页(pkg-user/edu-mgmt-*,复用 edu-child/records-page 共享渲染件)+ app.config 注册 + miniapp 五语言(eduMgmt 3 + eduFinance 9 含状态枚举 + eduGrades 正名);验证:eslint 0×3/miniapp typecheck 零错/水印完好;镜像累计 14 页 (26fc056da64)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (92f382ef86b)
- 🚀 新功能/改进:children 六子页小程序镜像批——共享渲染件 records-page(列驱动卡片列表,对齐 RN ConsoleTable 模式)+ 六薄壳(课表/考勤/成绩/餐食/账单/学习计划,参数 childId)+ app.config 注册 + miniapp 五语言 edu 族键组(eduChildAttendance/eduGrades/eduAttendance 等 4 组 + statusTitle/empty);家长端小程序闭环(首页→六子页);验证:eslint 0×7/miniapp typecheck 全零/水印完好;镜像累计 11 页 (01bb3b47a8f)
- 🚀 新功能/改进:小程序镜像批 #2——家长端首页(pkg-user/edu-parent,孩子卡片列表+状态徽章,对齐 RN EduParentScreen;children 子页镜像排后续)+ app.config 注册 + miniapp 五语言 eduParent 10 键;验证:eslint 0/typecheck 零错/水印完好;镜像累计 5 页 (2ceb517ea6e)
- 🔧 工程/其他:对账尺登记批——edu 族 18 条 aligned 入账(edu-management 7 + parent/children 9 + user/[id]/settings/llm/edu/shop 落地补登);worktree 面现读 aligned 142/缺口 355/零腐烂 (4b5234a9081)
- 🚀 新功能/改进:goal 教育域批——edu-management 可列表承载面全落地(考勤/成绩/班级/缴费/餐次模板/校园课表/教师排班 7 页)+ 家长端闭环(首页/绑定 CRUD/children 六子页)+ EduParent 六键导航;全部 ConsoleTable 杠杆薄壳 + 五语言 i18n(edu 族 12 键组);验证:eslint 0×18/typecheck 本轮零错/水印 verify 完好 (c1712deb254)
- 🔧 工程/其他:vip/success 时长三连裸串接 tt('vip.success.daysUnit') + 词包五语 {n} 天键 (73dae30a4ee)
- ♻️ 重构:批131 · AgentShopList emptyText 默认参拆雷(全仓可接面清零收口枚) (c51ca43ae95)
- ♻️ 重构:批130 尾修 4 处 appAlert 第一参变体(AccountCancel/ChangePwd) (a9d478aa0de)
- ♻️ 重构:批130 硬编码中文清零(6 文件 / 90+ 处) (80ec061080a)
- 🚀 新功能/改进:批130 入典(88 组新键 ×5 · chat.msg/toolbar/topup/confirm/sr/dist 族) (f2673153bd8)
- ♻️ 重构:批129 硬编码中文清零(5 文件 / 90+ 处) (3ff73743771)
- 🚀 新功能/改进:批129 入典(74 组新键 ×5 · need/news/iaa/bab/vip 族+common.known) (a2f2edbfa26)
- ♻️ 重构:批128 硬编码中文清零(6 文件 / 80+ 处) (3694083f708)
- 🚀 新功能/改进:批128 入典(65+ 组新键 ×5 · subPkg/account/share/lp/annot/aigcList 族+补 courseDesc) (fd6316a81a4)
- ♻️ 重构:批127 硬编码中文清零(11 文件 / 90+ 处) (36398ccb1ae)
- 🚀 新功能/改进:批127 入典(110+ 组新键 ×5) (9af71a11bc5)
- 🚀 新功能/改进:批127 W1 入典(23 组新键 ×5) (5926d858a3e)
- 🚀 新功能/改进:goal 应用批——RN 六屏 token 化(109 处 rnSpacing/rnType/rnRadius 档)+ 9 张 RN 屏四件套(他人主页/BYOK/教育商城/控制台六页,ConsoleTable/SwitchPrefs 两杠杆屏)+ 小程序镜像三页(三新屏三端闭合)+ 小程序提现页语义档 + RootNavigator 九路由 + miniapp 五语言键组;验证:eslint 0/typecheck 本轮零错/水印完好/i18n parity OK (47e3b46cc51)
- ♻️ 重构:批 126 硬编码中文清零(Menu 8 项表转键/Notification 时间族/PushBanner 回落/VoiceInput 全组) (3785cb014f6)
- 🚀 新功能/改进:批 126 入典(22 组新键 ×5) (62378825a29)
- ♻️ 重构:批 125 硬编码中文清零(9 文件 / 60+ 处,组件批收官) (593cb4ec619)
- 🚀 新功能/改进:批 125 入典(29 组新键 ×5) (ad22965d3cd)
- ♻️ 重构:批 124 硬编码中文清零(13 文件 / 55 处 · RN 端 UI 串清零收官批) (bd0dfe0c8b7)
- 🚀 新功能/改进:批 124 入典(37 组新键 ×5) (cda81d5afee)
- ♻️ 重构:批 123 硬编码中文清零(13 文件 / 40+ 处,含 3 张顶层表转键) (aecd7c7a30f)
- 🚀 新功能/改进:批 123 入典(35 组新键 ×5,含工具三态状态词五语同批) (a43b9ae9895)
**2026-10-25**
- 🚀 新功能/改进:auto-evolve 起会话通路端到端打通(O65 第 0 期收尾:JWT 现签 + --probe 自检 + 真派验证) (87a7713ccd1)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (1081dca6e13)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (194de047081)
- 🚀 新功能/改进:O65 第 0 期翻勾(调度器+四道闸随批完成,验收证据入注记;代码枚 0e4bd3628db);1-3 期补立档日期交代(三选一:新鲜日期,按依赖序排队) (b1ffbc4b23c)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (ab3bc7beb43)
**2026-10-25**
- 🚀 新功能/改进:auto-evolve 自进化调度器第 0 期落地(总纲 O65·调度层+四道闸) (0e4bd3628db)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (0166713afdc)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (7faaebcc512)
**2026-10-25**
- 🚀 新功能/改进:登记 AI 自进化调度系统 auto-evolve 四期系列总纲(O65;第 0 期调度器+四道闸随批施工,感知/部署/回流三期按依赖序排队) (164b973cfe7)
- 🚀 新功能/改进:G-217a 点赞/收藏两表唯一键迁移 —— zhs_agent_thumbs/zhs_agent_collect 加 (uuid,bot_id) UNIQUE,把上一批(22ee752721b)靠事务 FOR UPDATE 父行的防重底线放进库层:2026-10-25 实测该族缺陷正是『一次点赞计数+2、取消只减一次』,应用层锁管住今天的写口,管不住未来绕事务的批量导入/人工修数(无约束=漂移只在计数与明细分叉后暴露,而全仓无 count(*) 对账)。线上两表 0 行,零回填成本。手写迁移口径(sql+journal,idx 343)+水印,同 20261026100000_command_ack_facts 批形制;旧普通索引保留不删(一次提交一件事,删索引是另一票)。验证:check-migration-immutable 绿(存量基线报警为门内只报数项,非本枚引入)、database tsc 0 错、likes-routes 回归 8/8 绿。 (c92836e7e78)
**2026-10-25**
- 🔧 工程/其他:refactor(web,mobile-rn,miniapp)+feat(gates): 显示层分→元格式化同形副本 20 处收口 formatPrice 唯一出口 + 装守门 248 —— fmtYuan=¥\.toFixed(2) 一族在 HEAD 逐字复制(web12+app2+enterprise×2+formatYuan+toYuan 共 20 处):改一处单位口径须 20 处手改,漏一处=那端页 100 倍显示事故(分销族 46758b5b2b8 批修的同型受害者)。全量委托 @ihui/shared/utils formatPrice(非有限回 0.00,定长两位,¥ 前缀归调用面维持版式)。刻意出射程(行为不同非复制):ai-pricing maximumFractionDigits:4 定价展示、purchase/helpers 动态位数 formatCents、局部常量行(M2 只报数)、返回 number 的数字换算。守门 248(blocking,stagedTriggers=显示层四端):M1 展示型自算定义绝对零容忍(存量本波清零;委托转发合法,定罪看实现,与日界闸 246 同口径)/M2 行内定长格式化按文件 HEAD 差值棘轮/M3 装车(importer 20);self-test 10 例成对夹具+镜像 3 例(全显示层 0 违规扫),门体先经 eslint 定责一轮(死常量/eqeqeq 两错已修)。AGENTS 点名 248(R4),并顺手为别席在飞的 registry 哨兵闸补 R4 点名行(照 runner/guardian 接线原样,该闸文档隐形会挡所有提交链)。AGENTS 先过 merge-live-doc 归并(lost=0)。验证:eslint 涉改文件预跑 0 问题,gate worktree 三面绿,miniapp 1032+mobile-rn 1185 例全绿,web/miniapp/rn typecheck 我文件 0 错(web 余 openDockedTab 三文件红=别席 work-panel 在飞面)。 (0d2a23f9701)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (1d8116c1b96)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (dd997d68b7f)
- 🐞 修复:收敛预解第二轮 —— G-55 就地翻为对侧结算行(四项已在库,本席==基底旧态由本行承让),删除尾部 dump 区的守门 89 R9 重复块(首份完整保留) —— 为 union-converge 预解 F1 最后一组与 F6 最后一块;两侧独有行零损失由 union 模拟 REG=[] 现证 (07ea442ded4)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (2f39e473afd)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (23eadba0af1)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (4ecb0c164b4)
- 🔧 工程/其他:结清 USDT TRC20 收款地址票(两行同题)——根 .env 与 apps/api/.env 现读均已按票面决策填入 sponsor 页同值,TRON 正则与 assertUsdtAddressFormat 两调用点在位;ERC20 并存不收敛为已裁结论。凭据:脱敏比对逐字相等(长度三十四/前缀 TMtT/后缀 MnbG)。 (2dffc2434db)
- 🐞 修复:teardown 默认翻为跳过 cleanup——共享库测试用户被并发裸跑删除当日两次复发;E2E_AUTO_CLEANUP=1 显式启用才清理(CI 本就显式 '0' 于 e2e.yml:225,零消费方依赖默认清理);交错型并发(对方跑完清理的瞬间本席浏览器未起)是 hasConcurrentPlaywright 拦不住的形态,故默认不删;手动清理出口 node apps/api/scripts/cleanup-test-users.mjs 不变 (886eae6992d)
- 🐞 修复:OpenAPI 契约产物同步今日补建的两条绑定路由 (462044fe47a)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (2110948b96b)
- 📚 文档:D04 登记验收面进展(浏览器级五例已入库,枚 4c80bf75db418f70d1b3fcf374efc2d845594cdd)—— 取证与剩余格按 §1 只进那枚提交信息,本行不翻勾(票面③规模化未动) (47b9db9f93e)
- 🔧 工程/其他:侧车reclassify终批——7键出等条件桶(G-03/G-20/G-100/G-46归他席与机主面,O02/G-50/G-74出桶),v2尺等条件归零 (8e681cfb073)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (1614f18a56b)
- 🔧 工程/其他:等条件禁令清偿收尾——末批摘行5枚(④/需真机副本/D19/H01/冷启动盘点,f12-purge留痕;union带回尾巴清零)⇒散文尺等条件全清 (9b53fd05d0b)
- 🔧 工程/其他:goal-r4 结清长会话滚动四维活账——r3e 判据三件齐:四维权名(映射 spec 断言)+可跑自验命令(supply 入口)+实测 rc=0(真浏览器 9 passed 2.3m);副本 L7663 已由他席结为指针 (12391049ef8)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (b5d3110debb)
- 🔧 工程/其他:去重 机器可见的欠账清单(三路并行审计产出)2026-10-24 逐条核账 副本行改为指向主行短指针(禁手写归并注记) (5fdb7afd772)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (6fc06bf1bbd)
- 🔧 工程/其他:goal-r4 结清 TEMP 等环境票——分叉已消(HKCU 现读标准值 D:/DevEnv/Temp)+夹具门现跑 rc=0 红线 0;LocalSystem 面按 §26 显式指定目录既有口径 (ef98e4083ec)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (24f139c94f9)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (95f05275536)
- 🔧 工程/其他:D04 消息串内富文本锚点补浏览器级验收面(五例真跑全绿) (4c80bf75db4)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (d3aeebebc76)
- 🔧 工程/其他:goal-r4 结清 AGENTS 体积判据接链票——前提过时:门 207 已 blocking 装车(runner:4891 现读,stagedTriggers=AGENTS.md),注册表按域拆分条件随装车消散 (b4b7f052980)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (74ddef1c3d0)
- 🔧 工程/其他:G-1102638 批1 同主键副本行物理归并 — 删 7 行(机主拍板〔拍板@2026-10-08 机主:真删+立即执行〕;幸存者规则与F4同向;落账注记行保留待批2;复跑auditPlan对账F1=0/F9不增;逐行留痕 .ihui-agent/archive/PROJECT_PLAN_copy-purge-2026-10-25.md) (6426b6134e9)
- 🔧 工程/其他:G-1102638 批1 同主键副本行物理归并 — 删 7 行(机主拍板〔拍板@2026-10-08 机主:真删+立即执行〕;幸存者规则与F4同向;落账注记行保留待批2;复跑auditPlan对账F1=0/F9不增;逐行留痕 .ihui-agent/archive/PROJECT_PLAN_copy-purge-2026-10-25.md) (606f93a250c)
- 🔧 工程/其他:等条件禁令清偿——散文尺清零批(摘行12留痕f12-purge+改写出桶+dispositionOf等段占位修复'—'=无等待);门245复跑器exit2为枚举0份的未判定假红,手动全量档rc=0绿,按AGENTS§16显式说明提交;G-74 env已落地确认、G-96微信IDE CLI预览出码结清 (5f92e70b33d)
- 🐞 修复:ui-routes 派生产物写回 + relay 脚本错误文案有界化 (3e4bbfc3c07)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (7f3497e3621)
- 🔧 工程/其他:r4c 给 D04 加现读证据注记(租约保留,未翻勾) (5fa5190a358)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (f15d53dd3bb)
- 🔧 工程/其他:r4c 认领 D04 富文本动作锚点(qoder-claimfix 释放票,加租约) (9612eb02196)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (b88a7e4e023)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (ba8a12ea2a2)
- 🔧 工程/其他:r4b 结清 G-29 带值旗标普查票(翻勾 + 证据注记) (70bf04ae5c6)
- 🐞 修复:收编器加滞后副本守卫,防把旁路落地成果按滞后工作树副本写回旧版 —— 判据:工作树 blob != HEAD 且 == 该路径某祖先 blob ⇒ 跳过并点名(取不到探针一律 fail-open);立因=2026-10-25 实测 16576ffa0d 在同一文件回退绑定手机/邮箱端点 88 行与门 198 updatedAt 出口形态两处,HEAD 面行为锁 7/7 全红;纯判据 partitionStaleCopies + 镜像测试 6/6(含 fail-open/混批/装车锁),node --check 与 --dry-run RC=0 (508cb8c11ff)
- 🔧 工程/其他:G-29 旗标单源收口第四批两站(站点 31→29) (179fc770b5a)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (387b2abaace)
- 🔧 工程/其他:零改动结清 4 票(键名对齐保全/上游两票本仓已落/门13d判据已立)——凭据:e09d866222f8151a6b78278fb8bef3371872907d(apiKeyPerms 63 键五语言 parity OK)、8894762aed0a025e668e3714728528a1667abc2b(HostTurnFault)、aefe7b14c6119a18da52f608eeb563767c1123c3(ApprovalGenerationCas 双 reasonCode)、check-plan-dup-pointer-ratchet 维③ NOTE_TOKEN_SRC+redundantNoteCountInLine 已立(--self-test 8/8);门13d 存量 6 份均在折并引文内属观察不占票;取消信号行已由他席同日翻勾故不在本批 (0acb63b0a88)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (bd163622b33)
- 🔧 工程/其他:goal-r4 结清取消信号穿压缩票——压缩/钩子/session_start 三件均已 _wait_interruptible 包裹(G-815970 主刀+10-24 补刀,现读 4+ 包裹点),机制=轮询+task.cancel 真实退出强于内部检查型;MCP init 在本架构无对应等待点;行面前提读数过时 (f924df03b4d)
- 🔧 工程/其他:G-29 旗标单源收口第三批两站(站点 33→31) (8d9de275cc6)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (5397d6febcc)
- 🔧 工程/其他:goal-r4 结清守门8假绿灯票——前持席已收官约束失效,三条产生路径全部查清(①路由从未注册+alias 过近似 ②在册但运行面 404 部署态 ③cozeZhsApi 前缀归一+边缘改写派生),修正按票面归扩面批次,本票不改判据 (1d5e73e2d34)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (9b8c758945a)
- 🔧 工程/其他:零改动结清 --allow-dangerous 确认旁路票——前提被 danger-gate 收口推翻:策略唯一出口=tools/danger-gate.ts(调用方只注入 prompt/观察口),三宿主均经 buildAgentDangerGate/createAuditedDangerGate 构造;apps/cli 危险门三条接线锁本轮 33/33 绿,W1 棘轮就地旁路现值仅 config-cmd.ts 的配置键 getter 1 处(非放行决策);票面行号已漂按内容锚点改判 (eaba6379cd9)
- 🔧 工程/其他:G-29 旗标单源收口第二批两站(站点 36→33) (10a28983111)
- ♻️ 重构:再摘十四枚 plugins-data 死副本(曾被批量提交整批带回) (f2402b15035)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (b0e66070762)
- 🔧 工程/其他:goal-r4 结清合流吞没票——两层建议已有更强实现:union-converge 落地前吞并判红(三型夹具)+门100/168 提交时拦(现跑 rc=0,--move 11/11)+证据案例族被守门91钉死(现跑 0 违规) (ed6067dde4c)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (0f44f58f420)
- 🔧 工程/其他:零改动结清 3 票(窗格续传×2 孪生/工具面板开关窗格化)——凭据=56735273286b5f258bed90a714ca228bf6c3561a 与 5978933ee6bf06620e317439353efc33ac961a86 均在 HEAD 祖先链,本轮现读内容锚点仍在:pane-split.ts 的 PANE_SPLIT_PERSIST_KEY/rehydratePaneSplitLayout、chat-pane-body.tsx 的 shouldPrefillRecentMessages、usePaneAiToolsPanelStore 禁回落根单例;三行零改动,孪生副本同据结清;工具面板'独立 split 叶'观察不占票 (7eaa8a1f649)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (0f3a333e8a8)
- 🔧 工程/其他:goal-r4 结清 P2-13③ 孪生两行——prod-bundle 诊断链已全额交付且影子门三对逐字节等值(采集库补齐三输入+失败点接线+结果落盘三形态),现读凭据入行内注记 (094181c956a)
- 🔧 工程/其他:G-29 旗标单源收口三站(吞值判死,站点 39→36) (f2b549a2ea2)
- 🐞 修复:恢复被 auto 收编按滞留工作树副本回退的两处已入库修复 —— ① compat 绑定手机/邮箱端点整块 88 行(c87193d5c0;恢复前 HEAD 面行为锁 7/7 全 404 红,恢复后 7/7 绿)② 门 198 updatedAt 出口形态两处(b0802ff9bf);内容取回退前 16576ffa0d^,行级声明 removed=2/added=88 逐行对账;api typecheck RC=0 (bb883c8c4eb)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (5620df43a2f)
- 🐞 修复:墙板页提交树内 Git 冲突标记清零并补回合并吞掉的 userGrowthOption (57d95110fdc)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (17d9b20c463)
- 🔧 工程/其他:守门134第二格整票零改动结清(①触发条件未达 ②updated/created 已入键族) (a648e79f913)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (a27f73951fa)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (2b3ff5b11b6)
- 🔧 工程/其他:号池凭证到期字段票的旧未勾副本零改动复结 (4019b32c69c)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (a710d0c6367)
- 🔧 工程/其他:goal-r4 结清 G-24——重定范围核验:三页+知识库登录态门已在 HEAD(现读各 4 处 authGate,同型 215 页),sidebar-chat-history 已消失前提过时;先前查空系行内路径带陈旧 src/ 前缀 (69b778e669a)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (8f1987a1364)
- 🔧 工程/其他:服务运行时代码新鲜度 dot-source 维零改动结清(7801) (e563aa2c853)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (34e204d9852)
- 🔧 工程/其他:goal-r4 第三波结清 6 行——Esc 三副本(10-23 四要件结清,凭据 30db9bd97b 祖先+双 spec 在库)/真机走查(两修一误报,凭据 84583fdf6+26cf923961)/prod-bundle(S9 结清,影子门现读 14 对等值)/四件拍板(r27 波结清,mail 鉴权与版式消亡现读在位) (3247fd2355e)
- 🔧 工程/其他:relay-reencrypt-keys 补 §22d 入口守卫(门194 存量 1→0) (392ea7625c5)
- 🐞 修复:小程序/扩展两端 I18nProvider context value 定身 + 各装回归锁(母型缺陷跨端同步收口) (30565b6f8e3)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (cb981dd52cb)
- 🔧 工程/其他:goal-r4 结清 3 票(守门91债/G-27盘点/allow-dangerous观察)——证据均本轮现读:守门91与守门12现跑0违规、gitdir硬编码0命中、旁路事实在位;G-24票面三页已从HEAD消失需重定范围故不结 (c9a13dad884)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (8223205b06c)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (8e6f8ec1424)
- 🔧 工程/其他:清偿 miniapp 死键 deventerModeledit.q7(提交收费配置,五语言各删 1 行,按守门 KR 口径登记 5 条移除声明) —— DEPARTMENTS 只取 q1-q5、q6 由 :99 错误日志消费,q7 零引用;重生成 3 gen.ts + 4 b64 与 ui-routes pin 元数据 (8e030dea7b4)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (3d4b8cebcab)
- 🔧 工程/其他:goal-r4 复翻 8 枚今日回潮复活体(G-35/G-61/G-76/G-807/G-939/发丝线/锁初始化/O-1)——凭据逐条核验:8 枚结清提交均为 HEAD 祖先,锁初始化另现跑 15/15 绿;读取数与凭据见各行复翻注记 (136f2cab0d1)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (b39c7b9ed7e)
- 🔧 工程/其他:chore/fix(plan): r3e 核验等条件桶-补现读实测值/修正stale判据(0结清6改写) (c54fba94d5d)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (2a0af4e0b1e)
- 🔧 工程/其他:H02 复翻——回潮体复结(auto-collector union 滞后工作树副本曾把 a6c3c036be 的翻勾写回未勾态;三面已刷齐疗法落地);裁决同前:全仓零声明⇒结构性无样本,闸门不开,只记不挡维持 (eff4b6d5bd4)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (b907745ef12)
- 🔧 工程/其他:G-01 远端 CI 现读对账(53094555 上 4红/2进行中/9绿:i18n 两枚判清、OpenAPI 已被并发删除解、ruff/RN 已修、Knip 另席);O02 门128 两格判据补齐+SC1转绿+T8两项取证(待裁 LoginPopUp 40/44 与 RD 16 档) (b7cdf9c74df)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (41baa72b164)
- 🔧 工程/其他:为 mobile-rn 端登记 topic.detail.loading 形状键契约(c72a93dda9 跨端同屏同字补键;本端由 topic-detail-screen-render.test USED 清单钉住 15 键,单删即 5 红) —— 三条 evidence 按 HEAD 面可核验 (a49c6b729b0)
**2026-10-25**
- 🐞 修复:在途请求覆盖新态四格根治(前端清单收尾批)+形状锁 —— ① TrendChartDialog:弹窗重开/换 itemId/换窗口连发,慢的旧窗口响应覆盖新曲线且旧 finally 提前熄灭 loading;② learn/topic 付费课:切课时旧列表迟到响应串进新页;③ ide/mcp-pane DetailPanel:常驻不重挂载,切换选中项时迟到详情张冠李戴;④ ModelDetailDialog 行过滤 .filter((r)=>r.value) 把合法 0(免费模型 inputPrice/outputPrice=0)当缺失吞整行,读作『无此项』——改判 !=null && !==''。竞态窗口在微任务时序,jsdom 行为锁必 flaky ⇒ 按 race 家族既定口径钉形状:fetch-sequence-guards.node-test.mjs 四真组件逐一体检(序号自增+写前复核+ModelDetail 两向)+成对夹具(摘守卫翻红 6/6 绿);形状搬家 assert fail 报『锁要跟着搬家』防静默失配。验证:apps/web tsc 我文件 0 错(仓内余 3 红=checkin/GlobalTopBar/web-work-panel 属别席 ca6995 收编批残留,非本批),node --test 6/6。 (5e1978b98af)
**2026-10-25**
- 🐞 修复:三方归并预解——增长图取对侧 57d951 柱形新形态,本席重排保留,并全文件格式归位 —— 别席线形图(1fb44)与对侧柱形图(57d9=14 根太密⇒interval:2/纯柱形/柱顶不标数)是同功能两种写法,取新者;重排四档(wb-prio-user/ai/traffic/trend)+KPI 双卡前置+业务面板用户三格提首/接口排行下移,均在对侧底版上三方重放(merge-file,唯一冲突=图定义二选一,已按裁决留柱形)。验证:prettier --check RC=0(本席 3083b39 未走钩子的格式存量一并归零)、水印零宽链完好 verify 绿、门 240 --worktree R1-R8 全绿、vitest wallboard 2 文件 11 例全绿、tsc 墙板 0 错(仅存三枚别席在飞红点名不代治)、KPI 卡序 users>ai>qps>err>p95>turnover 现读。为 git-sync-converge 的 --resolve 页面路径预解:本面已含两侧全部独有行(对侧逐字打底),收敛无需人工 (584041c957e)
- 🐞 修复:重锚机主 2026-10-25 定档首屏重排 + 补回被连带洗掉的增长曲线定义 —— 别席 ca6995ca20b(自动收编在飞副本)把 page.tsx 从「639bd 重排 + 1fb44 增长图」形态写回旧两档编排,并丢了 userGrowthOption 的 useMemo 定义(2219 行用法仍在 => tsc TS2304)。本枚按 639bd7f7797 底稿在现 HEAD 上重落:KPI 带「用户/AI调用」两卡前置到最左(用户卡 sub 今日新增=增长读数);面板业务纵深 wb-prio-user(-40)、AI 号池 wb-prio-ai(-30)、访客与机器人 wb-prio-traffic(-20)、流量趋势 wb-prio-trend(-10),四档两两不等防同值静默回落;业务面板内用户三格提为第一眼读数、接口调用排行下移至签到块之后(14 日增长曲线随位保留);WALLBOARD_CSS 四档定义与编排注释同批,其余面板 order-1 形态不动;userGrowthOption 定义块从 1fb444802bc 逐字恢复(复活行=本票有意重落,走 LAND_ALLOW_STALE 留痕,非滞后副本误带)。验证:门 240 --worktree R1-R8 全绿、verify-wallboard-readout --self-test 12/12(建模 60/60 格)、apps/web vitest wallboard 2 文件 11 例全绿、watermark verify 载荷完整、check-i18n-keys 19187 键 5 语言 parity OK(本批零新键)、apps/web tsc 墙板 0 错(仅存错=checkin/GlobalTopBar/web-work-panel 的 openDockedTab/onHome 三枚,系别席 work-panel.ts 在飞未落,本票不代交点名在此)。并发说明:普通提交路径仍被别席在途文件占用,走 object-space-land 只交本票一文件 (3083b390c9c)
**2026-10-25**
- 🐞 修复:union-converge 冲突标记闸补接 import —— 2026-10-25 头注的闸只写调用未引 lib/conflict-marker-guard 的 assertNoConflictMarkers ⇒ 本器任何带 <<<<<<< 的树内容在 writeBlob 处 ReferenceError 崩(实测 dry-run base=a6c3c036be ours=本地线 theirs=179fc770b5a 即崩,RC=2 未判定),收敛器全程瘫;补一行 import 后同输入 dry-run 正常出闸(CHECK ONLY 正常走完,落地闸 3 处为真实内容裁决)。修复凭据=§1「能当场修的当场修」+本席收敛作业被此 bug 挡住的直接受害现场 (df25853257b)
- 🐞 修复:墙板页剥回成对冲突标记 —— 11:18 手工收敛把 merge-file 原始标记带进 main 的清偿(零内容变化) (3363928c6ef)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (cc7389109eb)
- 🐞 修复:三族小面根治+一批测量基建纠错 —— ① packages/shared usePaginatedList 补序号守卫(末发定案:后发请求落地前,先发的任何迟到响应不写数据/不写错误/不翻加载位),此前筛选切档与在途页互盖:旧结果 setItems 替换新第1页、把页游标偷换成旧页号(下次加载更多直接跳页缺页);web/RN/miniapp 三端共用该 hook,守卫随源生效。② CouponScreen 摘除 setStatusTab+setTimeout(refresh,0) 手工重发:hook 的 effect 本就按 fetcher 身份自动重拉,那发 setTimeout 捕获**渲染前旧闭包**且宏任务落在 effect 后 ⇒ 序号更大后来居上,旧档列表可覆盖新档 —— 手动那一发就是竞态源本身。③ 侧栏会话日期分桶改真日历边界(原实现滚动7天/其余全部,标签却写今天/本周/本月 ⇒ 数年前会话被标「本月」、缺 lastMessageAt(t=0) 同桶冒领):今/周(周一起)/月(1号起)/更早,缺时间戳归更早;aiChat.earlier 键五语言同批(web messages x5),groupByDate 按同文件 SearchableConversation 先例导出供纯函数单测(新套件 6 例含成对正向)。④ 测量基建纠错:apps/mobile-rn/tests/use-paginated-list.test.ts 原 import 经 RN wrapper → @ihui/shared/hooks **父别名指 tests/__mocks__ 手写平行件**(§22c 反模式活例)⇒ 9 例一直在验替身;改走配置内 exact 子路径别名直连真实源,9 例(含新守卫例)在对 shipped 实现上全绿 —— 替身漂移本身另行登记。⑤ 上一枚 history-page-hydration.node-test.mjs 水印载荷修复(手写头行截短致残迹,verify --staged 现形;clean+重注入 0 不合格)。验证:shared tsc RC=0,web tsc 我文件 0 错(仓内 4 红文件=wallboard/checkin/GlobalTopBar/web-work-panel 全部出自别席 ca6995ca20b 自动收编批的在飞残留,见交付报告),RN 全套 129 文件 1185 例、miniapp 1032 例、web sidebar/pane 相关 94 例、shape lock 5 例全绿。 (0d036f99091)
- 🐞 修复:旁路落地器补「成对冲突标记拒绝进树」闸 —— 79 看不见不走钩子的通道,牙装在写口上 (a844588db0e)
- 🐞 修复:AI 侧栏历史翻页双缺陷根治(判高两条,前端清单回源仍活) —— ① 根窗格 handleLoadMoreHistory 原 res.data.messages.map 手工造行只留 id/role/content/createdAt,绕开水合出口 ⇒ 翻上来的旧消息丢 toolCalls/planSteps/citations/pinnedAt/parentMessageId+siblingIndex(版本族判不出⇒点一次编辑出两个气泡);改为与首屏(:676/:732)及非根窗格(chat-pane-body:222)同一出口 hydrateHistoryMessages。② 两处翻页回调 await getMessages 后都不复验会话:切会话时旧会话的一页被 prepend 进新会话、resetPager 把旧游标装进新会话、patch*Cache 把串会话列表写进旧会话缓存桶(LRU 持久污染);统一补 store.getState().conversationId 复验且先于一切写入(window 窗格体与根窗格同修)。竞态窗口依赖微任务时序,jsdom 行为用例会 flaky ⇒ 按 api-no-double-unwrap 先例钉形状:history-page-hydration.node-test.mjs 抽函数体+三判据(水合出口/复验存在/复验先于写入),2 文件×(正向+三型变异夹具)+良性对照 5 例全绿,摘任一判据即翻红。回归:13 套 88 例全绿;apps/web tsc 我改文件 0 错(仓内 62 错全部来自别席 ca6995ca20b 自动收编进 HEAD 的 wallboard 未决冲突标记,非本批引入,见交付报告)。 (dd56090e923)
- 📚 文档:对外文档数字/端数口径收尾 —— README 瘦身版尾部旧版碎屑整段清除(7082→6007 行:八端清单/176 models SEO 段/两行矛盾结尾/孤立表行,主体均有现算版);L183 IP 白名单『只存不拦』过时表述改实链事实(ip-whitelist-guard.ts 在位);散文 testFiles 追齐现算值(3211→提交瞬间现算,活水竞态以门判绿为准);blog 四篇现在时套话更新(01 尾部 8 端/176、02 对标表与 footer 176、05 定价 all 176×3→101、08 邀请语 8→9);ja/ko 正文区 118→101、8平台→9 两形态 109 处、339 声明→608。保留:教程/历史内容(01/08/15 篇主题正文、成长叙事列表、日志区历史行、legal-8 下载矩阵);AI_CHAT_BENCHMARK_ANALYSIS_V4 六端为技术门范围不动。IHUI_SKIP_LIVE_DOC_CHECK=1 定向说明:README.md 系有意整档重写(15384 行大文件→6007 行摘要+九份收纳件索引形态),merge-live-doc 的 1596 行『真丢失』样例全为 8 端旧版声明与旧数字重复副本(--apply 会把它们 union 回来毁掉瘦身,故走有意重写通道);重写凭据=机主批准的 118 模型陈旧引用清偿+8→9 端口径任务,主体九端清单/关键数字生成块已逐段核验为现算版。验证:watermark verify 8 文件绿、check-doc-numbers --worktree 绿、现在时陈旧声明清零 (e7014684cf7)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (a6c3c036bee)
- 🔧 工程/其他:H02 结清——allowed-tools 闸门代裁落定(全仓零声明⇒结构性无样本,只记不挡维持,首声明技能出现时按新票评估) (353b8b4b905)
- 🔧 工程/其他:live-doc-edit 补一条镜像锁 —— 改桶与新增完整租约同批必拒(条件③逐字节),钉住「分两次定向改写」的既有口径 (3b8caa24fc0)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (8f7efe9cf87)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (50a9ea73973)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (7ef91d4c414)
- 🚀 新功能/改进:资源目录同步停更哨兵三件套 —— 760 条全军只有一行 WARN 的静默型,自此当轮即红、恢复即绿 (0dd89c37e99)
- 🔧 工程/其他:端内套件三枚红的两条根因分头收口 —— 冷装载搬出计时阶段 + 串行等待窗并到终点 (9c8f66c4728)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (4df4137ee2f)
- 🔧 工程/其他:G-24 同题孪生复翻——G-18 行已按同证据零改动结清(前提消散+AuthGate 在位),本行同判 (564eac5011d)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (ae1c98d35d4)
- 🔧 工程/其他:守门91冻结9处票结清——四格全闭(study-publish 5ce93b9e1/基线归零 907c6568d4/spread 三态升级/阳性对照制度化),r27q 现读全绿 (dfc90410565)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (25f10e867eb)
- 🔧 工程/其他:认领 G-61 旁路落地器镜像套件红 26 例(核验席 r3d 2026-10-25 收口轮:镜像套件四件现读 101/101 全绿 + line-loss 第三形态已判活,票面前置满足) (eeed12179f0)
- 🐞 修复:同名函数族判据只数带 body 的声明 —— TS 函数重载(多签名+单实现)不再被判成重复族;tauri-bridge.ts withTimeout 2 签名+1 实现曾致落地复跑假红,现读 0 命中;补重载/真重复两枚用例 (bd350cd6bf6)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (b2be520d744)
- 🚀 新功能/改进:出口代理闸 IHUI_REGISTRY_EGRESS_PROXY —— marketplace 直连抖段的运维旋钮(默认关=行为零变化) (7fe57853cf1)
- 🔧 工程/其他:G-27 零改动结清——守门[12]现读违规 0(互斥措辞已修正),并发副作用登记票面自记已处置 (14d6ad950fc)
- 🔧 工程/其他:补 test_wb_sync_expiring_triggers_extraction 漏掉的 save_device_map/clear_open_cooldowns 两处 monkeypatch 桩 —— CI 红形似缺 env,真因是 checkin_scheduler.py:702-703 真调 checkin_store 写库⇒db_pool.py:103 fail-closed 抛 RuntimeError: DATABASE_URL 未配置;同族三条用例(alive_skips/extract_failure/throttles)各有桩,只这条漏,补桩即与家族同口径(零改断言、零改 workflow);本机空 DATABASE_URL 单用例 100% 复现 CI 那一红,带 DATABASE_URL 则会真写开发库 id=7 行(违 §5)⇒ 修复方向是让测试不碰库,而非给 CI 塞 service container(现 job 自述离线子集,且空库上 UPDATE checkin_accounts 会改判 UndefinedTableError,红换形态不消);验证 单用例 GREEN passed=1 failed=0、整文件 CI 条件 passed=22 failed=0、ruff All checks passed、check-ci-failure-triage-wiring RC=0、水印 verify RC=0 (f648ba8385a)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (3531e7a0ef1)
- 🔧 工程/其他:L7688 --allow-dangerous 旁路确认零改动结清(调用方健在;同题带 goal-1024t 租约行归该席不碰) (552630f18bb)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (f8f4698e36b)
- 🔧 工程/其他:结清三票——G-13 孪生号同判(量面已亡)、合流吞修复票(两站点已 resolvedTheme+门100 A5/A6 覆盖)、--allow-dangerous 旁路确认(调用方健在) (2b0a82a0b36)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (d5e70130c5d)
- 🔧 工程/其他:键名对齐票四复翻(第六轮复核)——四文件早由 02e3474c932/a00983523bc 覆盖,五语 parity RC0+233 例+tsc 8/8;注记载明后续见此票即零改动复翻勿空烧 (628e22f3180)
- 🐞 修复:registry 批量 upsert 批内复合键去重 —— 上游 offset 分页重叠让整批 760 条全军(PG 21000) (33cf83062e1)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (084843ab6ef)
- 🔧 工程/其他:10 行进展注记(取证席 HEAD 证据:6060 AASA 半开/7635 富文本余语序/7652 守门91 ①闭/7653 union-converge 断言缺/7657+7694+7695 Esc 三份并指针/7662 G-27 ①③闭/7705 缺键名清单/7727 副本指针) (e77a9cd6fba)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (c7e949ff401)
- 🔧 工程/其他:结清 12 行(取证席逐行 HEAD 证据:7599 api-routes 棘轮/7640+7666 prod-bundle diagnose/7654 BOOL_ACK 键集/7661 resolvedTheme/7668 requireFlagValue 四门/7672 取号器全文件集/7684 prod-bundle 门 exit0/7697+7698 窗格续传三件/7737 dup-pointer 棘轮/7513 无样本) (4c95362c713)
- 🔧 工程/其他:E/F/G 三票(取消信号穿延长回合/宿主中止身份标记/审批代际 CAS)复翻——8894762aed 一枚全落地,r25j 席 10/10 GREEN 核实在案,三枚皆再次回捞的回潮体 (c63b6bba9d4)
- 🐞 修复:补齐 SSO 停靠浏览器伴生改动(rememberSsoDockedWindow 改名 + destroyDockedBrowser 收尾 + ihui:close-docked-browser 广播) —— 与 48b8f4be 的 tauri-bridge 导出配套,修复 HEAD 门 98 第二处悬空(LoginDialog.tsx:20) (4ef788126c5)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (22ea1082a64)
- 🔧 工程/其他:号池到期字段票零改动结清——三路径已由 aa8d575f7c+99db9d2412 闭环,r27o 现读 78/78+typecheck 8/8 核验,存量脏数据收敛属运行时事件 (416ff11d9d3)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (089873b0aa2)
- 🔧 工程/其他:G-38 补落 r3c 结清注记(首版注记引指针字面被 purge 剥掉,改写述材重落;只动本行) (32274fafd1f)
- 🔧 工程/其他:治四处存量"代码对、锁旧"的源码漂移锁 —— 锚句跟着判据形态搬家,同时补变异自证 (91272a063be)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (6c4bf2c87eb)
- 🔧 工程/其他:结清两票——O-1 工件四件全在 HEAD(曾由批次7 S4 复核结清,重复登记形态)与工具面板开关窗格化(mode-switcher:62 已读写窗格实例+域测试 2/2+e2e ① 绿) (e03a6bd968e)
- 🐞 修复:门 103 C1 二次超限收口 —— git-guardian 六块 141 行注释逐字归档换指针(零行为变化) (1f9a9a6fa6f)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (aaf840ab5f5)
- 🔧 工程/其他:G-60 结清——r27n 取证代裁:三根因并列无指纹,维持移除(收益已由 windowing 承接+原位收益归零),防回潮锁随提交落库,10-07 口径闭环 (522ac4dac2a)
- 🔧 工程/其他:G-60 取证收口——content-visibility 维持移除裁定+防回潮回归锁(r27n) (7413f9fd31f)
- 🐞 修复:G-865 行补接 theirs 侧独有票号标记 —— 收敛人工裁定预备(信息守恒) (74d9bf7f301)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (d946f111a4f)
- 🔧 工程/其他:结清 G-38 无编号 P1 视觉票漂开副本归并出口票(归并席 r3c 2026-10-25:出口在库复验绿+三票离场前提消散,逐份裁定与凭据见行内注) (8665cf45ae2)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (01defdb0945)
- 🔧 工程/其他:L7714 四件已拍板事项零改动结清——env键在/邮件鉴权073de24a52/手搓渲染单源化消亡/alertmanager改tmpl真注入,四项实测全过 (0f292dbdc3e)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (1d12801672a)
- 🔧 工程/其他:L7798 发丝线复翻——三余格已由后续会话清偿(存量 31→0/指纹单源合一),原翻勾 38f0580dfc 被 G-32 回捞带回,现读双尺全绿同据复翻 (7be1d6baff8)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (603d8236d8f)
- 🔧 工程/其他:D42046 同题孪生复翻——D14 行已按同判据结清(D690 落地+r27k 核验),孪生行随判 (dd36db8bbef)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (dc89f8a3f2e)
- 🔧 工程/其他:G-939 结清——r27l 取证:裸 update-ref 跳链吞没(先于推送,票面更正),门未响=射程外+当时盲区;修法 A2~A6 已全落地,现门 --move 复现 11/11 检出 RC=0;两条加固建议交后手 (9c725319eeb)
- 🐞 修复:补齐被 ca6995ca20 自动收编遗漏的停靠浏览器伴生导出(318 行全为新增,零删除) —— HEAD 的 web-work-panel.tsx 早已 import 这 9 个符号,单侧收编导致门 98 在 HEAD 恒红;本次只补导出面,不改消费方 (48b8f4be761)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (722d29a0dba)
- 🐞 修复:守门 52 的三枚脚本自己漏了 windowsHide —— 判弹窗的门本身会弹窗(5 处 spawnSync) (1d0c597d696)
- 🔧 工程/其他:结清 git-guardian 陈旧副本挂号(按重贴完整实现+fail-closed 处置,落 3718485996);G-16 两格判据注记进展(暂存待收口,SC1/T8 待复裁) (750050c352e)
- 🔧 工程/其他:G-01③/票面点名的 OpenAPI 契约漂移收口 —— 按代码面离线重生成 apps/api/openapi.json(pnpm openapi:export 全离线,buildServer+swagger,ESM 桩不连 PG8810/Redis8811、不起端口);三条差异逐条对上现读:sync-snapshot 0→1、/api/distribution/orders 0→1、visitDate 2→0(入参通道已摘);diff 仅 163 行且生成器 stabilizeDocument 全排序稳定 ⇒ 非重排噪声;openapi-check.mjs [A]-[D] RC=0,[E] 需 --fresh 档在 CI 判 (f76f07ef396)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (f48b3b677b7)
- 🔧 工程/其他:D14 断线审批重放结清——主席代裁 A 案,主对话流腿已由 D690 全量落地(r27k 核验 30 测绿+mypy 零错+契约两侧同值闭环),零改动 (e7d44de1748)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (46c5de8ac91)
- 🔧 工程/其他:G-807 恢复器用例稳定性零改动结清——正解①(copyNeedsRefresh 写侧显式置过期)已在 HEAD,本席 10 连跑全绿(每轮 34/34)过票面验收口径 (c4721a8a39b)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (d0c6b114b2c)
- 🔧 工程/其他:认领 G-38 无编号 P1 视觉票漂开副本归并出口票(归并席 r3c 2026-10-25) (f59fbbf6a03)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (a1fe1044758)
- 🔧 工程/其他:L7800 RF 族 dot-source 盲区零改动结清——G-1080903(10-13)已落传递闭包比较,票面系旧读数 (9ae52737832)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (9cb23e8bce9)
- 🔧 工程/其他:结清两票——锁初始化(lock-atomic-init 在 HEAD 实测接线)零改动;G-77 值守班量面已亡体系换代前提消散(26 天无复发) (2865ff9baa6)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (91a961ed052)
- 🔧 工程/其他:L7806 工具钩子取消腿结清——toolCtx 接线在 HEAD(结清判据满足),r27j 补有意不接点名+形状锁 5/5,随 cli 提交落库 (964f9db7cf8)
- 🔧 工程/其他:L7806 工具钩子取消腿收尾——补两处有意不接点名+形状锁用例(r27j) (973ad61db4b)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (746327ce2b7)
- 🔧 工程/其他:重生成 ui-routes 产物以吸收已入库的 19 处输入 sha(门105 G5 陈旧清偿;路由 159 条与 pin 结构不变,仅自述钉更新) (fdb8be50b0e)
- 🐞 修复:解开 main required 检查 lint-typecheck-test 的三枚红 —— VoiceNote.tsx:24-35/53/360 裸 <TextInput> 换共享唯一出口 TextField(@ihui/rn-app,colorScheme 取 currentRnTheme(),与 ModelConfigDialog 既有范式同形)⇒ text-field 普查锁(G-978007)三条判据从源头退场,零豁免零空函数;ChatScreen.tsx:831 loadDrawerConversations deps []→[t](t 由 Provider useCallback([locale]) 供给,消费侧有 drawerConversationsConversation 门闩,无重渲染回归);HomeScreen.tsx:1038/1078 localizePlaceholderGroups 提为模块作用域纯函数、t 改第二参数传入(同 ChatScreen:3579 mapConversationToDrawer(c,t) 口径),useMemo deps 摘掉该函数;验证 eslint --max-warnings 0 RC=0(改前 2 warnings)、turbo typecheck --filter=@ihui/mobile-rn RC=0(6/6)、voice-note-mount 13/13、check-input-focus-feedback --worktree RC=0、check-rn-readout-cell --worktree RC=0、水印 verify 3/3;RN 聚焦墨档观感 H5 验不了,需真机目检(代码形与 89 站点既有范式同构) (fd6c54fbc1b)
- 🔧 工程/其他:goal-r3 结清两票——G-217(benchmark-delivery 已装车+覆盖面未建档 0 条)与 G-960(探活腿已钉真腿分档,裸域降级自测夹具)均零改动,前提过时复翻 (d82007c89cd)
- 🔧 工程/其他:L7811 真机走查两项欠账零改动结清——①守门83跨兄弟键已由 b15/S10 修复(self-test 全过),②colorScheme 默认值 108 修+9 冻基线系设计终态 (ac91bb4a91e)
- 🐞 修复:取号器活状态测试族补并发窗口分诊 —— 58/59 假红根因根治(G-35 交后手项收口) (3f10d328cf4)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (c2249b30f30)
- 🔧 工程/其他:G-955 零改动结清——next-plan-id --check 现读 rc=0,取号入口可用;7 组孪生在归档面只报数归并线自管 (89ee03fe053)
- 🐞 修复:墙板 scrape-target 小按钮按角色档 control 取 sm(4px,门150 锚点归位);git-guardian 任务形态改 PowerShell Get-ScheduledTask 主通道+schtasks 默认关兜底(缺 __test__ 的陈旧副本 fail-closed 报副本陈旧),新增形态通道回归锁 5 例 (3718485996c)
- 🐞 修复:live-doc-edit 声明式改桶出口收窄到归属桶单维 —— 不再充当三维守恒的全维总闸 (6f2b92c7c4b)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (218fdf6ed29)
- 🔧 工程/其他:goal-r3 结清五票——MCP stdio 缺陷族四票(G-689/691/692/694,r27i 现读 67/67+74/74+typecheck 8/8 全绿零改动)+G-239(四门守卫早已补齐,严判口径归零) (bf49b3702ad)
- 🐞 修复:补"未判定"批次的非零出口(同票回归自纠,f1fa20213b 把后果一起改了) (5fc069c18ef)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (596ab903fe3)
- 🔧 工程/其他:G-18 僵尸票零改动结清——工作树待落前提消散,HEAD 四页 AuthGate 门在位(38d41f1cd0 同型),早已随收编入库 (64f4c990272)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (1100081916d)
- 🔧 工程/其他:L7807(7 脚本 self-test tmpdir)回潮体复翻——10-23 两度零改动结清后再次被 union 带回;本日现读 check-fixture-tmpdir rc=0 零红线,复翻结清 (264c7289483)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (1438d2fc902)
- 🔧 工程/其他:G-865 回潮体复翻——死键早于 9410970ece45ddc00be11886f7d607ea2399f1f3 摘除(README 记账在案),现读 external-urls.ts 无此键,零改动结清 (9d307bed64e)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (6dc9438f9a9)
- 🔧 工程/其他:goal-r3 第四波认领——MCP stdio 缺陷族四票(G-689/691/692/694)落租约派 r27i;B06/G-73 回潮体复翻(原结清证据链在注记,勿再派工) (0aae1881901)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (00bca54a631)
- 🐞 修复:复结 L7759 门39六红票 —— 六屏共享层下沉已完工(零改动翻勾) (99c758fa3a6)
**2026-10-22**
- 📚 文档:G-960 公网入口断流旧副本转注释归并(正主为已撤回误判的修订版),清 F4 同题两版以过收敛落地闸 (004f9b4e4d)
- 🐞 修复:净面去 git 化(read-tree+checkout-index),根治 worktree 登记四类故障 (5038b8b0ca)
- 🚀 新功能/改进:验证码按场景分模板 —— 注册/登录/找回密码/改绑各走自己已过审的模板 (765d4621e6)
- 🔧 工程/其他:清 tests/ 第三批 8 处模块内死代码 + 级联的 2 处 import(删 HERE 后 dirname/fileURLToPath 随之无用) —— 只删 eslint 点名且确认零引用的绑定;8 个文件 lint 0 error、测试全过(注:check-redundant 的 T12 是存量红,HEAD 原版同样失败,与本批无关) (6cc7f536b4)
- 🐞 修复:阿里云验证码这条腿从入库那天起就没通过 —— 修构造函数互操作 + 补响应体业务码判定 + 接通两条发码端点 (d2c3ba781a)
- 🔧 工程/其他:清 tests/ 第二批 10 处 unused(多具名 import 删单符号 4 处 + 形参加 _ 前缀 6 处)—— 只动 eslint 点名的那一个符号,同行其余绑定与调用方一律不碰;5 个文件 100 个测试全过。scripts/tests/ error 35 → 17 (e8f8389fc6)
- 🔧 工程/其他:清 tests/ 首批 8 处未使用 import(整体行 5 处 + 多具名里的 rmScratch 3 处)—— 只删 eslint 点名的那一个符号,保留同行其余绑定;改后 5 个文件 lint 0 error、58 个测试全过 (d9f6746207)
- 🔧 工程/其他:清 scripts/lib/ 最后 3 处存量 lint error —— plan-tasks-merge-selftest 删未使用的 titleOf 导入与 rewritePointer 解构绑定;stale-lock-claim 的 observedAt 参数加 _ 前缀。eslint scripts/lib/ 现为 0 error (e3e940a046)
- 📚 文档:readme-06 守门结构描述与实现对齐 —— "56+10 pre-commit 项"改为 269 道 runner 门 + 本地元门档 27 道 + 全量归 CI;两处"pre-commit 第 N 项"改为 guardian-runner 注册门 (ba6898c15d)
- 🐞 修复:node-version 与根 package.json engines 对齐(>=22.13.0)—— 写死 '22' 可能装到 22.0.0,而本仓用了 22.13 之后的特性 (17e6aaf4c1)
- 📚 文档:收口三处 —— ① AGENTS.md 那句"guardian 每 30 分钟派发"与实现不符(guardian 对该脚本 0 引用),按实录改为"派发层已补建";② JUDGEMENT_LIBS 从两份重复定义合并为单一真相源 scripts/lib/judgement-libs.json(CJS/ESM 共读);③ 补收 14 个漏册高频公共库(flag-value 59 门/code-mask 47 门/selftest-registrant 36 门等),改错会让几十道门静默失效 (d61206d615)
- 🐞 修复:补建缺失的派发层 sweepStaleClaimMarks + 清两条存量 lint error(tmpdir/DAY_MS 未使用)—— 门 98 的悬空导入(测试引用了从未实现的函数);按测试断言实现:30 分钟节流闸 + 注入式 runner + 结论行解析,拿不到结论行落 undetermined 不记绿 (fd1aaa8ee8)
- 🐞 修复:补 workflow 溯源水印头 —— 门 47 检出的 HEAD 面欠账(inject 已写工作区,本次提交销账) (52d59c3a62)
- 🔧 工程/其他:全量守门 workflow 开自动触发(push/PR),先以记录模式跑(continue-on-error) —— 本地无法可靠预测 CI 结果,存量修完后再转拦截模式 (54190217ce)
- 🐞 修复:本席三票让号(原 G-924/G-926/G-929 全部撞上别席已占号) (bd758ca8f8)
- 📚 文档:登记取号器把已占号当空闲发出的缺陷(G-14),并列存量 3 组同号多题的让号出口 (2198a4f2ed)
- 🔧 工程/其他:撤回"部署承载者没查清"那票——前提是本席自己的误判(已按现号处理) (bb0e9a835a)
- 🚀 新功能/改进:把"改写整行须断言三维不变"做成共享器物,AGENTS §1 那条不再是话 (a4ba22a7ac)
- 🚀 新功能/改进:标头投影层:渲染与解析同一份实现,超预算只截 owner 不牺牲等段 (c362cda2d8)
- 📚 文档:另立门 8 未判定桶 237 条裁决票(O87g 结清遗留,禁消音) (cca1767d1a)
- 📚 文档:G-734 复验注记+释放认领(51/51 绿,A/E 保持开放)+结清 G-934(接线与 e2e 已在 HEAD 闭环) (c64335e857)
- 📚 文档:补认领 G-24(归因层注入口已落待接线,与 G-420 同批) (d2b5793c10)
- 📚 文档:补认领 G-962/G-957/G-958/G-959/G-924(登录屏批次) 加发4席 (56002665ad)
- 📚 文档:结清 G-956(影子件删除三面实证,防复发归 G-32) (ef6f3f7e27)
- 📚 文档:结清 G-420/G-24(接线已入 HEAD 枚 5e42fb5139+9e5d56cf20,镜像 56/56)+释放 G-957(剩余面留人工窗口) (c387a9b98e)
- 📚 文档:结清 G-956(重落)/G-958(引导拆除已在 HEAD)/G-420 翻勾补正 (b363b35626)
- 📚 文档:结清 G-955(取号器声明位两档,--check RC=0 主会话复跑实证) (3cd980434f)
- 📚 文档:守门134①复验释放(hops=18命中0,未达即不做)+认领 G-922 (f70fc1ef78)
**2026-10-23**
**2026-10-23**
**2026-10-23**
- 🐞 修复:摘除被收编捞回的 plugins-data 残留副本 —— 解 HEAD 面 12 处 TS2307 悬空引用 (75ba36d703)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (2ac0f9c6b2)
- 📚 文档:号池可观测票两格收满并纠票面错述 — ①「fusion judge 腿无主体不写行」经现读与代码不符(gateway 触发 combo 处已显式下传 billing_user_id,两处 judge 经 kwargs 拿到同一主体,3 枚用例钉住);②config_id 取既有 bigint 列零新迁移。同批记入号池上游余额按需点查两枚(trae 与 qoder getQuota;过期票先走调度器同一把 refreshOne)。翻勾仍差票面验收第 3 条(真跑一次网关调用后 llm_call_logs 命中腿字段可查),该行保持未勾。 (9c0cdc5c67)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (8d7d6440af)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (10f12f561d)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (1dbaa32547)
- 📚 文档:结清「另有 7 个脚本的 self-test 仍走 os.tmpdir()」滞留行 3 枚(含 1 枚 F4 指针行) (1c947c216f)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (80ec7a548b)
- 🔧 工程/其他:Esc 无层栈协议补上真机档,并量出它判得到与判不到的两维 (edc008bf94)
- 📚 文档:摘除收敛期回潮的旧口径压缩说明行,体积 89,544→89,057 (b4a9496821)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (4b9fb09999)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (94e6292b83)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (7feef45a4f)
- 🔧 工程/其他:翻勾「锁初始化写全再原子可见」(lib 入树 + 两锁各 2 处接线 + 54/54 含真进程并发对照) (f7d3a945c2)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (425cb2c503)
- 📚 文档:Esc 无层栈协议 —— 真机档交付两格并写明余下一格的判据边界(附变异矩阵读数) (ff6181c4fc)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (9b9bc1ab26)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (1287fefa94)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (865a55d6ce)
- 🔧 工程/其他:G-343 翻勾(盘根/PG 落点私有推导四处残余现读已闭环,镜像 59/59 反向锁在场) (8d2ac1a574)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (f748dc87f4)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (e78e341fc9)
- 🔧 工程/其他:G-929 翻勾(旁路落地器镜像套件现读 76/76 全绿,他席已修本席复核) (a1959b4d3a)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (3352407e2b)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (ce1b8cf95b)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (dbfe3aa4e0)
- 🔧 工程/其他:G-239 翻勾(门 194 存量清零,第 5 枚 auto-commit-quiet 补守卫) (de5dcdb6f0)
- 📚 文档:压缩 AGENTS.md 96,531→88,993 字节,清偿门 207 超预算红 (0f9d7af1ce)
- 🐞 修复:auto-commit-quiet 补 §22d isDirectRun 守卫与 __test__ 判据导出(门 194 存量清零) (cbf84dc055)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (3e792853fa)
- 🐞 修复:漂开副本归并(--merge-drifted,人工点名持有行后 N→1) (81e91aa2c5)
- 🐞 修复:漂开副本归并(--merge-drifted,人工点名持有行后 N→1) (fe5b3b23c4)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (1363080ec9)
- 📚 文档:结清三票——恢复器用例 10 连跑全绿 / 小程序远程图标死键 / 无编号漂开行归并出口 (5d9c161869)
- 🔧 工程/其他:alipay 配置判据用例跟上"私钥真读得到才算配好"——假路径改判 false,补真实可读文件正向例(反向锁不许修成一律红) (1a50193483)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (dc1e29551a)
- 🚀 新功能/改进:派单入口新增「时间序档 order=late」,出单顺序改问仓库 (b40fb20c3e)
- 🔧 工程/其他:V3 #52 RAG 真重排补 tests/test_reranker.py(46 例:RRF 手算断言/去重聚合/关键词单路降级/LLM mock 失败降级链) (42aeb1d040)
- 🐞 修复:readme-sync 镜像补溯源水印(HEAD 缺载荷,CI 水印红第 3 次复现) (76bf5cabf9)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (c04a01c3a5)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (d56ce2b511)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (62c289f65e)
- 🔧 工程/其他:重生成 ui-routes 派生自述钉(union 合并后输入面已取对侧) (df8e576f68)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (609106eac9)
- 🚀 新功能/改进:大屏补 Relay 号池健康组(deep-pipeline 11 板 + overview 头条行) (4c3c012fdd)
- 🔧 工程/其他:G-926 收口:articles/ 不再整体忽略(宽式规则无挡之物) (a402f50043)
- 🚀 新功能/改进:中转号池健康 gauge(key/账号两表四档健康态 + 显式丢失 + 失败不写空) (6bda68dcae)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (c468db756e)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (20fe4e4dd9)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (a71e95072e)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (08ef43589d)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (a703a69a8e)
- 📚 文档:修本席刚写错的一处证据指针,改判留痕改指全 40 位可取回的那枚 (e7fb235acb)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (da9bd67811)
- 📚 文档:更正本席 13:34 写进 G-14 的错读数并补 O 族有空号这一实测事实(本票不翻勾,差的格子写明) (901f21bb30)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (eef5d3dc41)
- 📚 文档:把同号多题存量今日重测就地并进持有行 (ca44c32ee3)
- 🐞 修复:漂开副本归并(--merge-drifted,人工点名持有行后 N→1) (1a15e4841a)
- 🐞 修复:网关流水带上命中的 provider 配置行 id,并把 fusion judge 腿的主体传递钉成用例 (8368505b62)
- 🐞 修复:挂牌判据补第四型口径漂移——半角括号里的租约不再隐身 (f13bfd0db1)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (203cdbbcfb)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (3f1ec1e02d)
- 🔧 工程/其他:结清 G-79 的 31 枚内容红——所在 15 个文件现读 389/389 绿 (7b86a39b3d)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (aefb0b62b2)
- 📚 文档:把 G-322 两站被镜像反向锁钉住的前置格就地并进持有行 (ddff78a208)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (bf3783fca2)
- 📚 文档:§5b 自愈行点名"删除意图到期档"——先问留痕账再决定让路还是回盘 (89763f6d21)
- 🔧 工程/其他:摘除根目录一次性扫描草稿 candidates2.txt,按门 99 通道登记具名豁免(带 reason) (ba517478df)
- ♻️ 重构:格式棘轮门的带值旗标改接单源判据,不再自算 argv 下一位(G-322 warn 档一站;自检 30 例、探针 26 例、eslint 零 error 全绿) (5b9c8058f7)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (9b63a78b6b)
- 🔧 工程/其他:写回四端 ui-routes 派生钉 —— 生成器输入面现读全部与 HEAD 同形，重生成只清陈旧钉不改语义 (ab7c343a12)
- 🐞 修复:存续自愈的删除意图保护只看该路径最新一条留痕——陈旧那档不得永久护着 (edef1bce7e)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (7646bc4b3c)
- 📚 文档:给侧边栏收敛批次补进展注记(六大域第二批已入库,余跨端对齐) (f7910fb15d)
- 🔧 工程/其他:侧边栏档位对账锁 —— 逐条钉住 HEAD 直标 31 枚在收敛后仍为 27 枚直标加 4 枚经继承,有效可见集逐字相等 (7de6d11fe4)
- 🐞 修复:工作区存续自愈加"删除意图到期档"——摘标超两小时仍缺的文件回盘,意图逐字转进同一本账 (09a647d761)
| **账号池调度巡检**          | `POST /admin/relay/account-pool/sweep`                        | `apps/api/src/workers/relay-account-pool-worker.ts` 的 BullMQ repeat job(cron `*/5 * * * *`,每 5 分钟一轮 sweepAccountPool):①access token 距过期 <15 分钟且有 refreshToken → 刷新回写;②healthStatus=unknown → checkHealth 定级;③down 且可续期且刷新失败未超限 → 再试一次后回 unknown 等下轮复检;单轮 ≤50 号、并发 5、Redis 分布式锁(租约 10 分钟),连续刷新失败 3 次自动 tempUnschedulable(原因 admin 可见);admin 可手动触发同一轮并透传 scheduler 结果                                                                                            |
- ♻️ 重构:G-927 第五席复核——票面 10 枚已由 0ff78d7fda 迁完(求差 0),本轮收口两枚镜像测试读真仓的裸 git (8d7cbb701e)
- 🚀 新功能/改进:签到设备号 9074 自愈——换新设备号重签一次并持久化 rotated 标记 (529b9879d6)
- 🚀 新功能/改进:安全停机状态机与 haltctl(自进化票:安全停机而非硬失败) (94751a0845)
- 🔧 工程/其他:5 枚结清行被并集收敛回捞,按原凭据再结一次(G-62/G-01/G-03/G-07/O88)——回捞根因=declaredDropCaps 只认整行逐字而翻勾会追加注记,已记入项目记忆 (047f746b15)
- 🚀 新功能/改进:金丝雀观察窗上线——源站直探量错误率/P95 与滚动基线比对,异常自动回滚 (9add3a32fe)
- ♻️ 重构:G-54 第4轮 —— 4 枚守门裸 git 派生收编 face-reader.gitRaw(按钮高度自检夹具/事件闭包/staged 取材/单分支 6 处) (cca944cc6a)
- 🚀 新功能/改进:Trae 设备证明通道对齐并超越开源——产品线组合兜底(IDE_PC→SOLO_PC)+设备展示字段可覆盖+端点可覆写联调 (adf5ebc6d9)
- 🐞 修复:更正 G-962 参数段覆盖注记的转档计数——三轮转档实为 8 条(7 alive + 1 dead),13 条是笔误 (7feaa2d0a4)
- 🔧 工程/其他:登记三端 ui-routes 自述钉与离线包钉重钉(承 G-1142551 复量) (3c281d1983)
- 🔧 工程/其他:参数段覆盖 last-mile——4 条转 alive,最终 21 alive / 54 dead / 7 human-review(82/82) (9723b0c004)
- 📚 文档:第 3 期进化回流三副本收敛(两份同题副本结清,主行保留余面) (c458c8350b)
- 🔧 工程/其他:参数段覆盖 human-review 二轮转档 5 条 + 记一条双端契约缺口(82/82 结论更新为 18 alive / 54 dead / 10 human-review) (8d9e7ff12a)
- 🐞 修复:补齐四处"消费方已入库、被 import 的模块却缺失"的断链(门 98 五处清零) (6b167b2a9f)
- 🔧 工程/其他:G-54 型 A 基线 53→49(紧贴入库后现读,不留余量)—— 4 枚枚举面迁移已入库 7634c0cbb7b,HEAD 面现读 49 与钉数齐 (6f130e29e5)
- 🚀 新功能/改进:旁路落地器对新建路径注入溯源水印(G-04) (247ca68459)
- ♻️ 重构:G-54 批次第 3 轮 4 枚枚举面裸 git 进 face-reader 层(check-i18n-namespace-passing / check-input-border-var / check-permission-mode-vocabulary / check-portal-fixed)—— argv/stdio/timeout/status 语义由 gitRaw 统一,判据零变化 (7634c0cbb7)
- 🚀 新功能/改进:判据面不可变护栏(自进化票:不可变护栏) (62fc34e0a9)
- 📚 文档:结清 G-964 P1 与 decode 家族单源;G-1142551 记进展保留未勾 (5128ce1fd5)
- 🚀 新功能/改进:人工阀清单与安全停机判据(自进化票:人工阀清单/安全停机而非硬失败) (1b22f3bb9b)
- 🚀 新功能/改进:web→RN 缺口分诊探针 + 小程序镜像还原度门(两枚只读尺子,均不进提交链) (45dd89e4e4)
- ♻️ 重构:decode 家族 D2 9→0 折到共享 safe-decode-uri(9 处调用点)+miniapp ui-routes 产物重钉 (899f8c8871)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (4f81fc23bd)
- 🔧 工程/其他:G-54 型 A 基线 57→53(紧贴入库后现读,不留余量)—— 4 枚枚举面迁移已入库 3e8b864094,HEAD 面现读 53 与钉数齐 (12d2573ca2)
- 🐞 修复:access 过期不再 307 打回登录页，守卫认 refresh 并自动续种回跳 (c8815af713)
- ♻️ 重构:G-54 批次续迁 4 枚枚举面裸 git 进 face-reader 层(check-i18n-keys / check-i18n-messages-exist / check-z-index-guard / check-rounded-overflow)—— argv/stdio/timeout 由 gitRaw 统一,判据零变化 (3e8b864094)
- 🐞 修复:补入 D01 人设选择器整条依赖链 5 文件——修 HEAD 断链(干净检出 TS2307) (d5a27ded0f)
- 🐞 修复:收编 agent-picker/agent-notice-bar 两模块——修 HEAD 断链(干净检出无法构建) (442f00dad7)
- 🚀 新功能/改进:大屏新增交互热度面板(事件分布/平均停留/热门点击) (578e038dcb)
- 🐞 修复:收编 agent-picker/agent-notice-bar 两模块——修 HEAD 断链(干净检出无法构建) (f07c4c0d40)
- 🐞 修复:折叠漂开副本族(N→1,认领合并到保留行 + 逐字留痕;--fold-drifted-families) (29cb1e9aef)
- 🔧 工程/其他:守门 8 参数段覆盖 82/82 逐条定性——余 49 条 = 7 alive / 30 dead / 10 human-review (27b860b725)
- 📚 文档:L28120 失败广播票结清(落点与双镜像在 HEAD,5/5 绿) (07a4f28cc9)
- 🔧 工程/其他:G-54 型 A 基线 60→57(紧贴入库后现读,不留余量)—— 3 枚枚举面迁移已入库 9b7439eee1,HEAD 面现读 57 与钉数齐 (77e7e6d7aa)
- 🔧 工程/其他:G-1222559 结清——索引面 PROJECT_PLAN.md 无暂存改动(git diff --cached 空),推送收敛 origin=PUSHED,滞台副本形态消失 (98967f3831)
- 🔧 工程/其他:票→提交环读侧 round-trip 镜像(正证可选绑票键,缺席不写空串) (6adfb2909b)
- 🔧 工程/其他:G-1222556 结清——CSRF 的 Gemini ?key= 载体已由存在性豁免改为 hasVerifiedApiKeyCarrier 验真(三载体逐个交 isRegisteredUsableApiKey,fail-closed),票面三选一的『实证验真』已由更前置一档满足 (cf50864de4)
- 🐞 修复:G-54 批次 3 枚裸 git 枚举迁 gitRaw(check-brand-foreground / check-rounded-full / check-capability-catalog)—— 型 A 存量 60→57,自检与全量行为面等值 (9b7439eee1)
- 🚀 新功能/改进:大屏新增页面访问热度面板(TOP 页面 + 前台/后台/登录页使用量) (344cda7701)
- 🔧 工程/其他:G-858 结清——union-converge 镜像 58/58 全绿(登记时 10 红→接手 1 红→0),根因两套口径相反已由 0a3defae5a 收口,三套镜像+端到端探针作证 (a2f356e63d)
- 🐞 修复:通配归档占位不构成移出凭据——修 union-converge 唯一那条镜像红 (0a3defae5a)
- 🚀 新功能/改进:全站页面埋点补齐后台/登录页 + 访问统计前后台口径与页面使用排行 (9cde533655)
- 🚀 新功能/改进:收编失败席半成品——G-395 配置分层出处标签(source + sourceRevisions) —— 该席撞今日用量上限停摆;主席自审:apps/cli 跑 subagent-precedence + subagent-precedence-flag ⇒ Tests 83 passed。落点 precedence.ts(+140)与 types.ts(新增 RevisionUnavailable='no-file-source'|'stat-failed' 与 SourceRevisions=Record<PrecedenceLayer,LayerRevision>):每个生效配置对象带 source 标签、快照带 sourceRevisions,四层短路优先级与生效值零变化。未完成面:sourceRevisions 的生产消费者与'取不到⇒null 不冒充'夹具,该席未及交付,已记入残余清单 (de2f6504dd)
- 🚀 新功能/改进:O6505 三源适配器(api-logs/grafana-alerts/user-feedback)+签名归一+聚类阈值+dry-run (58d7f4fcee)
- 🚀 新功能/改进:Trae 上游服务器自续票(设备证明)——桌面渠道签发的票由池自续,不再依赖本机客户端 (3f5fd52be7)
- 🐞 修复:收编失败席半成品——归因层差分面按提交面取材(commit-gate-attribution +70/−?) —— 该席撞今日用量上限停摆,主席自审:node --test scripts/tests/commit-payload-attribution.test.mjs ⇒ tests 18 pass 18 fail 0。改动面=归因层差分复跑不再读'还原后的索引',避免并发共享索引里的历史 blob 把无关提交钉红;未完成面:该席未及补'取不到面⇒未判定'的第三条夹具,已记录在残余清单 (fba4ed7968)
- 🔧 工程/其他:r5 认领自进化两票(金丝雀发布/需求与异常自动发现器)——牌插在复选框后,正文一字未动 (4277abb873)
- 📚 文档:G-964 更正注记重新落账(上一步为消 union 双行先对齐成远端同文本,事实一条不丢)——三件载体现读全在仓,残余改为存量迁移 101 枚+72 条孤儿 (bdb6bef481)
- 🔧 工程/其他:登记 Trae 服务器自续票(设备证明)已完成(未取号:号池满) (79cb796af5)
- 🔧 工程/其他:撤回 G-962 批15 的 20 条参数段覆盖裁决(按陈旧守卫出口②显式放行,删的是本席上一枚自己加的条目) (29dd4876f8)
- 📚 文档:r5 自进化四票进展注——代码已交付(56855eb75f:自治决策模型/决策链审计/E2E 补测器/经验写回腿),未接线格逐条点名,租约保留不翻勾 (85788c457e)
- 🔧 工程/其他:G-964 行文本对齐远端同文本(消除活文档 union 双行:F4 0→1 的机械成因)——更正注记随后单独落一次,事实不丢 (489ce34618)
**2026-10-23**
- 📚 文档:登记一条可派单票 —— 号池凭证到期字段与上游接受态背离(库里记未来时刻而上游当场回 401),出路是换票被拒时收敛该列并让巡检按同判据降级;余额档已改为不依赖该字段 (049f177588)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (b926b99b36)
- 📚 文档:就地更正号池可观测行里"按到期时刻触发刷新"那句 —— 真号实测该字段不可信(上游已回 401 code 1001 而库里记的是未来时刻),现行判据是上游当场判鉴权失效才换票重试一次 (a9215ca573)
- 守门 251 `check-ps1-bom.mjs`(runner id 251,**blocking**,跳过变量 `HUSKY_SKIP_PS1_BOM=1`):判 `.ps1` / `.psm1` 必须以 **UTF-8 with BOM**(`EF BB BF`)写入。立因是实证不是假想——`AGENTS.md` §27 早规定这条,但全仓曾没有任何尺子校验它,76 个 `.ps1` 里 40 个没 BOM 而无人知;真害在 Windows 自带的 5.1 引擎按系统代码页(zh-CN=GBK)解码满篇中文的无 BOM 脚本,当场报「表达式或语句中包含意外的标记」并连累整模块「缺少右 }」,而受害模块被 `alert-dedup.ps1` 与 `ihui-monitor.ps1` dot-source ⇒ 生产上只要走一次 5.1,部署窗口控制与告警去重整条功能就是坏的(同批自带的 harness T2 专门断言「5.1 也要能加载」,因此在 main 上恒红)。取证:`node scripts/check-ps1-bom.mjs --self-test` 末行「自检通过(判据六例 + 端到端三例,正反两向都真跑)」;`deploy/**` 的 `.ps1` 不吃 `#requires` pragma 那条口径见 `check-pwsh-version.mjs`。
> ⚠️ 未判定 1 项:`aiServiceRoutes`(apps/ai-service/app 有 1 个 .py 取不到内容)
| **账号池管理页 admin**      | `/admin/relay/account-pool`                                   | 页面源文件 `apps/web/app/(main)/admin/relay/account-pool/page.tsx`:单页三栏(账号池 / 代理池 / 模型目录),账号列表 + 平台与健康度筛选 + 分页 + 导入对话框 + 启停 + 真实探活 + 按需查余额 + 认领释放 + 手动巡检 + 单账号用量抽屉                                                                                                                                                                                                                                                                                                                     |
- **登录方式优先级按访客来源 IP 的地区判**(2026-10-27,web 主站 + 桌面壳同一份产物):国内 IP ⇒ 扫码登录 tab 排第一 + 微信整行主推大按钮;海外 IP ⇒ 邮箱验证码第一、手机号不开放 + Google 主推、GitHub 紧随图标网格首位。判据产出侧唯一出口 `apps/api/src/services/login-region.ts`(Cloudflare 边缘国家头 → GeoLite2/ip-api 兜底 → 判不出显式返回未判定),排序侧唯一出口 `packages/ui-react/src/components/login-form/region-policy.ts`(IP 判不出才回落界面语言)。地区经 `GET /api/auth/oauth-status` 的 `loginRegion` 字段下发,该端点同时显式 `Cache-Control: no-store` —— 实测这条响应此前默认 `max-age=14400` 且边缘可缓存,不关掉就会把首个访客的地区发给后面所有人。**该字段只影响呈现顺序,不参与任何鉴权/限流/风控判定**(国家头可被客户端自带伪造)。
**2026-10-26**
| **第三方 IDE 账号池 admin** | `/api/admin/relay/accounts` + `ai_relay_account_pool` 表      | 第三方 AI IDE 平台(trae / workbuddy / codearts / qoder)「完整账号会话凭证」号池,与 ai_relay_key_pool(只存上游 API Key)分表:tokenEnc/refreshTokenEnc/cookiesEnc/secretsEnc 走 encryptField AES-256-GCM 字段级加密,响应面永不回传密文与明文;`POST /admin/relay/accounts/import` 直接吃账号导出 JSON({accounts:[...]} 单批 1–500 条,同 provider 按 uid 唯一去重)、GET list 分页 + provider/enabled/health 筛选、GET `:id` 脱敏详情、PUT `:id` 改调度参数(name/priority/weight/tempUnschedulable/proxyUrl)、POST `:id/toggle` 启停、DELETE `:id` 删除 |
| **账号上游余额点查**        | `POST /admin/relay/accounts/:id/quota`                        | 按需点查上游余额/积分(2026-10-23 立),**不进调度轮询**——只在 admin 点击时发一次上游请求,回包带 queriedAt;仅已实证余额端点的平台可用(现 trae / qoder 适配器实现 getQuota),workbuddy / codearts 无实证端点 ⇒ 400 未支持,适配器未注册同样 400;取不到的一律留 null,不拿 0 冒充(0 在面板读成积分耗尽)                                                                                                                                                                                                                                                   |
- **登录方式优先级按访客来源 IP 的地区判**(2026-10-27,web 主站 + 桌面壳同一份产物):国内 IP ⇒ 扫码登录 tab 排第一 + 微信整行主推大按钮;海外 IP ⇒ 邮箱验证码第一、手机号不开放 + Google 主推、GitHub 紧随图标网格首位。判据产出侧唯一出口 `apps/api/src/services/login-region.ts`(Cloudflare 边缘国家头 → GeoLite2/ip-api 兜底 → 判不出显式返回未判定),排序侧唯一出口 `packages/ui-react/src/components/login-form/region-policy.ts`(IP 判不出才回落界面语言)。地区经 `GET /api/auth/oauth-status` 的 `loginRegion` 字段下发,该端点同时显式 `Cache-Control: no-store` —— 实测这条响应此前默认 `max-age=14400` 且边缘可缓存,不关掉就会把首个访客的地区发给后面所有人。**该字段只影响呈现顺序,不参与任何鉴权/限流/风控判定**(国家头可被客户端自带伪造)。 **RN 端同判据接入(2026-10-27)**:`apps/mobile-rn/src/lib/login-region.ts` 用同一出口取 `loginRegion`(请求失败/缺键/脏值恒 `null` ⇒ 回落设备语言),排序与剔除委托 `@ihui/shared/auth/login-region-policy`(web / 扩展 / RN 共用同一张表,端内零复算),`LoginScreen` 的 tab 顺序、默认选中项与第三方选项随地区走(海外整档隐藏手机号 —— 后端 `^1[3-9]\d{9}$` 只收中国大陆号码)。小程序端不接:登录弹窗即微信一键身份,没有「哪种方式排第一」的面,属平台独占差异。
| **账号上游余额点查**        | `POST /admin/relay/accounts/:id/quota`                        | 按需点查上游余额/积分(2026-10-23 立),**不进调度轮询**——只在 admin 点击时发一次上游请求,回包带 queriedAt;仅已实证余额端点的平台可用(现 trae / qoder / workbuddy 适配器实现 getQuota——workbuddy 2026-10-27 真号实弹闭环 billing summary;codearts 套餐/积分余额**无接口**(官方明细只在控制台 personal-usage 页,免费额度按月重置),适配器只挂了限时福利 balance 端点(opengw.developer…/api/v1/user/tokens/balance,2026-10-27 取证),其响应形状未实证 ⇒ 面板点查如实回未判定并带响应键名清单),未注册平台同样 400;取不到的一律留 null,不拿 0 冒充(0 在面板读成积分耗尽)                                                                                                                                                                                                                                                   |
| **会话库备份** | `pnpm relay:sessions:backup --apply` | 源只读,快照到 `~/.wb-switch/backups/sessions/<ts>/` 并带逐文件 sha256 manifest;默认 dry-run |
| **会话归属台账** | `pnpm relay:session-links rebuild --auto --apply` | 从登录态快照库自动推账号时间线段(最早快照前的存量默认未归属,`--trust-earliest` 才归);`assign` / `unassign` 人工标注 |
| **本机账号一键切换** | `pnpm relay:switch-account` / `pnpm relay:ide-switch --ide <平台>` | WorkBuddy 登录态按快照切换(切换前自动备份当前态);trae / trae-solo / qoder 三 profile |
- UI/样式: `check-miniapp-taro-design-tokens.mjs` `check-adapter-style-parity.mjs` `check-percent-clamp-single-source.mjs` `check-line-split-parity.mjs` `check-input-focus-feedback.mjs` `check-button-height.mjs` `check-glyph-arrow-icon.mjs` `check-no-divider.mjs` `check-no-mask-image.mjs` `check-no-native-dialog.mjs` `check-no-emoji-icons.mjs` `check-radius-single-source.mjs` `check-radius-role-conformance.mjs` `check-rounded-full.mjs` `check-statusbar-single-source.mjs` `check-cross-end-ui-parity.mjs` `check-cross-end-screen-coverage.mjs` `check-miniapp-tokens-sync.mjs` `check-miniapp-taro-style-parity.mjs` `check-cross-end-tokens.mjs` `check-miniapp-css-landing.mjs` `check-web-rn-parity.mjs`(web↔RN 跨端对账,warn;自检 `node scripts/check-web-rn-parity.mjs`;跳过 `HUSKY_SKIP_WEB_RN_PARITY`) `check-web-rn-style-tiers.mjs`(2026-10-31 立;**web↔RN 非色档档位对账尺**:257 头注自述样式维只调颜色令牌、128 的 `SIDES` 只有 miniapp/rn,两处叠出字号/间距/圆角**零判据格**;判两端取值相对唯一档表 SPACING_STEPS/TYPE_STEPS/RADIUS_STEPS(档表 import `sync-css-tokens.mjs` 出口零复算)落 inTier / missingTier(表外但对端同值在用 = 档表缺位,出路=补表,零端内改动) / fork(表外且对端零同值 = 真分叉)三桶;只读报告器**刻意不进提交链**(RN 存量 2231 处与本次提交无关, 挂 blocking = §12e 恒红门),唯一调度器 = `parity-auto.mjs` 的 `gate-style-tiers` 腿(**不标 slow**,否则 `--fast` 档重开这一格盲区);取值集枚举到 0 落 exit 2 未判定不记绿;自检 `--self-test` 12 例 + 镜像 `scripts/tests/check-web-rn-style-tiers.test.mjs` 4 例) `check-ui-spec-mirror.mjs`(259,blocking;同名配对组件的 RN 壳↔小程序壳 spec **消费面**必须相等,差集逐条点名;例外走具名台账 `scripts/data/ui-mirror-waivers.json`,判序单源 `scripts/lib/ui-mirror-waivers.mjs`——到期回队列、被审面不再命中判清单腐烂、行形态不合格免不了任何东西;取证 = 门体 `--self-test` 13 例。**配套派生器 `gen-ui-mirror.mjs` 判另一半:同档位的「档→类」映射两端逐字相等(取值漂移本门看不见),它是写盘器物、恒读工作树,刻意不入提交链**)
| 凭据                | `Authorization: Bearer ihui_xxx`(+ `X-Api-Secret` 双因子)                                                                                                                                         | 用户自助签发:`POST /api/developer/api-keys`(已开 2FA 的账号须先调 `POST /api/auth/2fa/step-up` 验一次,窗 5 分钟);可按 scope/IP/模型/时段收紧                                                                                                                                                                                                                               |
| 号池网关单机档(一条命令 + API key 门) | [`deploy/relay-standalone/`](./deploy/relay-standalone/)                |
| 99         | check-staged-deletions.mjs                                               | **暂存删除存续性对账(blocking,2026-09-24 立)**:堵守门 65(只看删除规模)与 `heal-worktree-tracked`(对暂存删除"只报数、不代裁")之间的空档 —— 删除规模不大、但仓库仍在引用它的暂存删除(`D `),任何人跑一次不带 pathspec 的普通 commit 就把已入库功能与测试从版本树里删掉,一次静默回滚且 `git status`/diff/守门 65 全看不见。判"误删"须**E1 引用仍在**(索引 blob 里的相对 import / require / 动态 import / barrel / 别名路径含父目录名 / 路径字面量;`.md` 叙述、夹具、产物、记账 JSON、生成物不算)∧ **E2 无替代路径**(同名同后缀不在索引其他目录,有 = 已迁移放行)两条同时成立;只一条 → 不计红但如实报数;**E3 删测试须有意声明**(2026-10-29 立):测试文件天然不被任何文件 import ⇒ E1 恒不成立,所以"整批删测试"这一型此前结构性看不见(实证 b44ab834609 把 a3facca58f3 早 4 分钟入库的 relay 守卫②连实现带锁一起写回旧版,三门全绿)。判红须三条同时成立:被删测试的 import 指向**源模块仍在索引面** ∧ 本笔**没有**同时删/改名该源 ∧ 没有同内容新副本接管;放过通道 = git 判为改名 / 提交信息带 `intentional-delete:` / 豁免台账条目在有效期内。引用方自己也一起删 = 正当删除形态放行。护栏:名字 <4 字符 / 候选 >2000 / 删除面 >400 一律 `undetermined` 只报数;豁免清单 `scripts/staged-deletions-allowlist.json`(坏 JSON 显式报错)。**不加 stagedTriggers**(暂存删除可触及任意路径,任何提交都不得跳过);口径判索引 blob、全程只读。取证 `--self-test` 51 例(正反成对)+ 镜像测试 21 例(含装车前置断言);紧急跳过 `HUSKY_SKIP_STAGED_DELETIONS=1`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
**2026-10-29**
- 🐞 修复:复洁器补"未勾形态被加表头改写后回潮"这一维 —— 四道维此前结构上全够不着 (37de95181b5)
- 🔧 工程/其他:同步本地未提交改动——新增 keepalive REST router 与 Python SDK，收紧键盘快捷键类型，清理 G-44 监控腿冗余，README 数据更新 (b41b9fdce8c)
**2026-10-29**
- 🐞 修复:预算基线换成同 command 同 pass 态的实测值 147067ms —— 旧基线把两步判红的时间算进来了 (702d476c8d5)
**2026-10-29**
- 🐞 修复:补回被 45dd89e4e45 吞掉的 pnpm check:all:120 —— 预算档此前根本没有可执行的出路 (d92a968ec68)
**2026-10-29**
- 🐞 修复:GitHub App webhook 豁免 sqli-guard —— 实测 59 条 400 正在把提供方投递判死 (d1e739d9fc0)
**2026-10-29**
- 📚 文档:登记一张可派单票 —— App 内更新卡取不到安卓包(app_versions 无 latest 安卓行) (c4dd4ae894a)
- 🐞 修复:回收站存续腿补上第三格 —— 删除弹「回收站」错误框的真因是 SID 目录上的显式 Deny (329073ee006)
- 📚 文档:登记两张可派单票(Y 族第三、四枚) —— api 公网腿 p95 8.3 秒 与 webhook 对 CI 事件返 400/500 (8d46643e473)
**2026-10-29**
- 🐞 修复:下载按钮不得被 GitHub nightly 资产劫持 —— 现读线上按钮指向 releases/download/nightly-40425910619/ihui-ai-latest.apk (dbf1d8ac4a7)
**2026-10-29**
- 🐞 修复:门 98 D7 的排除格改成"点名不静默" —— 展开式命名空间不判,但必须登记未判定 (0105cb2b0ad)
- 🐞 修复:web 蓝绿换色自 03:03 起每轮静默蒸发 —— 健康探测读满 4096 就掐流,Promise 永悬后 Node 静默 exit 0 (2dd65414250)
**2026-10-29**
- 🐞 修复:门 98 D7 自身崩整道门 —— test 走原文、exec 走遮噪面,注释里的形状让 m 为 null (4a695e663a8)
**2026-10-29**
- 🔧 工程/其他:侧车补两条归属记录 —— 把 O68/Z-1 从"靠散文报数"搬进机读面(抽取器唯一出口) (81a2f9872dc)
- 🚀 新功能/改进:守门 98 加 D7 维 —— 动态 import 拼出来的扁平命名空间,成员悬空此前三层全盲 (c65caf91e1c)
- 🐞 修复:workbuddy「一键切号」写回端此前是死路 —— 扁平命名空间里 5 个成员在 lib 根本不存在 (d5b136ee427)
**2026-10-29**
- 🔧 工程/其他:写回 apps/web 端派生钉 —— 收编器把别席路由源改动带进 HEAD 时没跑钩子,G5 在干净 HEAD 上红 (c02aaffcab1)
**2026-10-29**
- 🐞 修复:回收站清理装载器补「写走 schtasks/XML + 读走 COM」回落腿 —— 本机 5.1 系统模块目录已不存在,只认 cmdlet 的装载器结构上装不上任务 (72092781dd6)
- 📚 文档:APK 分发地址三处遗留出口归一 —— 出包链已改站点 CDN 腿,文档与部署机模板不得再指向 public/apk (0e2e3c81c35)
**2026-10-29**
- 🐞 修复:G16 汇总有未判定腿时不得写成 ok —— 用词改 partial 并自证覆盖面 (a22b2f25ae8)
**2026-10-29**
- 🐞 修复:根治"重启后 web 入口不自启"三层缺口,并补完上一轮被额度掐断的 env 形态尺子 (8e9e0f53e18)
- 🐞 修复:根治"重启后 web 入口不自启"三层缺口,并补完上一轮被额度掐断的 env 形态尺子 (3dee3fe7540)
**2026-10-29**
- 📚 文档:GitHub 回调腿位不变量写进入口路由头注 —— 裸域/www 经 web 蓝绿 router,换流瞬间对本入口连发 ECONNRESET(2026-10-28 19:47-21:23Z 实测 svc-web-router.log 10 条),GitHub 侧读成 522/超时并 1-3 分钟一次重试;api 腿由 IHUI-API-ROUTER 单点接管、换流不断流。仓内无任何脚本写这个 url,故把不变量钉在下一个改址的人一定会读到的位置,并写明"取现值/用真实事件核对投递腿"两个动作。 (bd66dab8579)
- 🔧 工程/其他:复结 Z-1 号池饱和票并摘除回捞带回的两份形态 —— 上枚 d5be75da91 摘后被并发席的守门 71 回捞腿按未勾旧形态补回(两份形态与留痕 rowBefore 不同字 ⇒ declaredExempt 认不出,故按当下逐字重入账再摘);凭据不变:出路三开新字母族已实测 Z 族令牌可发,出路二放宽扫描面被取号器判据源明文禁止,出路一扩池属既有拍板 (a23a42a3fb5)
**2026-10-29**
- 🚀 新功能/改进:APK 固定地址改走站点 CDN 腿并加 no-cache 302 指针 —— CF 橙云腿实测只剩 3-6KB/s (8afd5986ca2)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (5f85b6a6639)
- 🔧 工程/其他:补 G-86 仓内侧装车证明 —— WebSocket 有界重连、SSE 降级兜底、可见失败终态与终态唯一性四条臂十例真跑绿;变异取证三条(摘上限判断七红、摘兜底腿五红、摘终态门仅终态唯一性一红)均还原并 sha 复验回基线;测试根因是工厂构造写在 render 回调内致每轮新标识符拆建 effect,与真实消费方 helpers.ts 模块级单次构造相反,已全部外提 (a0693d9feb6)
- 🐞 修复:把 O93 号池选号八钮登记进 .env.example —— CI Test 步唯一红的根因是模板没登记 (2b415a4e5ff)
- 🐞 修复:补回 playwright.stream-lifecycle.config.ts 的溯源载荷 —— HEAD 面欠账清零 (9960c239c4d)
- 🚀 新功能/改进:分诊留账补齐 + --status 分桶读数 —— registered 面此前只打印不落账,导致三次矛盾归因都无从判死 (49b1a67a8eb)
- 📚 文档:§1 侧车出口措辞跟上现实 —— 归属改判的声明式出口入册(票 O68 结清批) (5d6cc2d5582)
- 🔧 工程/其他:结清 O68 侧车改判出口 —— plan-fields-reclassify.mjs 已交付(声明档逐条给 before/after 桶 + why,复用 dispositionOfV2 复算,11 例镜像测试),O02 已改判并吃出派单面 (0faf6809192)
- 📚 文档:需求发现器第三源生产者已落并更正票面 —— export-user-feedback 自检 10/10、guardian 已派发,旧注记『仓内无生产者』过期 (fd426cdb345)
- 🐞 修复:补上 plan-fields-extract --reclassify 旧腿的禁桶守卫 —— 它此前是 F11/F12 的后门 (f9ecc8879b6)
- 📚 文档:凭据交付面空键读数更正 —— 实测 48 空键,真需供值约 20 枚(其余设计默认或代码自生成),票面 35/74/79 三个旧读数过期 (aa53c467432)
- 🚀 新功能/改进:补 pnpm check:public-exposure 入口 —— G-329 ④ 的 pnpm 面此前只有 node 直调,门已接线而脚本位缺失 (f85e1f55dee)
- 🔧 工程/其他:结清 G-329 与 O66 + G-957 卡点定位更正 (5016a012223)
- 📚 文档:体积清偿第 29 日批 —— §5c 一条改判留痕整段逐字迁 archive,净省 944 字节回到预算内 (535029dfeaf)
- 🐞 修复:文档数字门屏蔽 RECENT UPDATES 块 —— 自动抄来的「176 llms → 101 llms」是历史陈述,不是当前总量声明 (be12ee7a531) <!-- doc-num-exempt: 自动判定为历史叙述（口径迁移叙述(数字→数字:"176 llms → 101")、changelog 列表项(项目符行带提交号括注)），非当前总量声明 -->
- 📚 文档:补齐对外 SEO/roadmap 漏网口径(176 llms → 101 llms、roadmap 8 端 → 9 端) (333fd912418) <!-- doc-num-exempt: 自动判定为历史叙述（口径迁移叙述(数字→数字:"176 llms → 101")、回顾词(漏网口径)、changelog 列表项(项目符行带提交号括注)），非当前总量声明 -->
- UI/样式: `check-miniapp-taro-design-tokens.mjs` `check-adapter-style-parity.mjs` `check-percent-clamp-single-source.mjs` `check-line-split-parity.mjs` `check-input-focus-feedback.mjs` `check-button-height.mjs` `check-glyph-arrow-icon.mjs` `check-no-divider.mjs` `check-no-mask-image.mjs` `check-no-native-dialog.mjs` `check-no-emoji-icons.mjs` `check-radius-single-source.mjs` `check-radius-role-conformance.mjs` `check-rounded-full.mjs` `check-statusbar-single-source.mjs` `check-cross-end-ui-parity.mjs` `check-cross-end-screen-coverage.mjs` `check-miniapp-tokens-sync.mjs` `check-miniapp-taro-style-parity.mjs` `check-cross-end-tokens.mjs` `check-miniapp-css-landing.mjs` `check-style-key-consumption.mjs`
- i18n/文案: `check-i18n-locale-content-language.mjs` `scan-web-dead-i18n-keys.mjs` `scan-desktop-dead-i18n-keys.mjs` `scan-extension-dead-i18n-keys.mjs` `scan-miniapp-taro-dead-i18n-keys.mjs` `scan-mobile-rn-dead-i18n-keys.mjs` `check-cli-i18n-parity.mjs` `check-i18n-duplicate-namespaces.mjs` `check-i18n-broken-en.mjs` `check-i18n-keys.mjs` `scan-i18n-zh-residue.mjs` `scan-hardcoded-zh.mjs` `check-miniapp-replace-antipattern.mjs` `check-bare-decode-uri.mjs`(241,差值棘轮:裸 decodeURIComponent 遇孤立 % 抛 URIError,渲染求值路径整页崩;唯一出口 safeDecodeURIComponent @ihui/shared/utils/safe-decode-uri,行内豁免 bare-decode-uri-exempt 须带原因) `check-i18n-cross-end-wording.mjs`
- 只读尺子/派生器/核验器(不在 runner,不进提交链,也不进守护巡检轮): `check-temp-landing.mjs` `check-dispatch-premise.mjs` `check-alertmanager-live-config.mjs` `check-monitor-runtime-parity.mjs` `check-tunnel-leg-health.mjs` `check-prod-checkout-foreign-work.mjs`(git-guardian 巡检轮派生,`--json` 只判不修;未跟踪洪水只计数不判定) `check-index-unmerged-age.mjs`(2026-10-24 立,index 烂尾哨兵:unmerged 条目按路径集指纹计龄,同批滞留 ≥15 分钟即到人;立因 = 凌晨违规 stash+rebase+pop 冲突逃逸挂了 2 枚 unmerged + 91 个被删文件 12 小时无人察觉;不走提交链,派发层 = git-guardian 的 `auditIndexUnmerged`;镜像 `check-index-unmerged-age.test.mjs`) `verify-panel-data.mjs` `verify-panel-logql.mjs` `verify-grafana-panel-data.mjs` `verify-grafana-logql-panels.mjs` `sync-panel-live-provisioning.mjs` `sync-grafana-live-provisioning.mjs`(仓内 provisioning 是唯一真相 ⇒ 派生到部署机运行副本,连不上的源不写入并点名原因;幂等 + `pre-sync-backups/` 退路;`--check` 零副作用;大屏核验五档 有数/全零/空板/失败/未判定,全零 ≠ 空板,不许接提交门) `strip-stale-closed-rows.mjs` `strip-stale-claim-marks.mjs` `env-backfill-model-keys.mjs` `quarantine-disk-root-strays.mjs` `git-refs-heal.mjs` `git-backup-refresh.mjs` `git-sync-converge.mjs` `git-push-converge.mjs` `git-push-guard.mjs` `heal-worktree-tracked.mjs` `sync-lost-commit-tags.mjs` `check-app-version-latest.mjs`(2026-10-29 立 / 2026-10-30 接线,Y-14:App 内更新卡的 **latest 行只读对账** —— 判 `GET /api/app-version/latest?platform=android` 的 `data.latest` 在位、`downloadUrl` 指向自有站点腿、apk 真能取到;红项正文直接给登记器物 `register-app-version-latest.mjs`(OWNER-ONLY:requireAdmin 只认人用 JWT 或生产机 `--via db`);**不进提交链**(§12e,判公网与线上数据,提交者改不了那一格),派发层 = `git-guardian` 的 `auditAppVersionLatest`(6h 节流、未判定只写日志不喊人),手工入口 `node scripts/check-app-version-latest.mjs`(加 `--json` 出机器可读结论))
**工具目录 seed(2026-10-30 立,补 `/tools` 页的数据面):**`GET /api/tools` 与 `tools` 表、web `/tools` 页三向都齐,但此前**全仓无 seed、也无运营建工具的页面** ⇒ 新库这张表恒空,页面三个分类各显示「暂无工具」。`packages/database/seed/tools-seed.ts` 落 9 条基线,每条对应一个本仓真实存在、点得动的 web 路由(`tools/pdf/{merge,split,watermark,convert}`、`tools/voice-stt`、`models`、`knowledge-base`、`mcp-store`、`web-tools`),按 name 幂等、已注册进 seed 主流程。因三端工具页(web `/tools`、RN `ToolsScreen`、小程序 `pkg-user/tools`)同取这一个端点,一份 seed 三端同时有内容。
**2026-10-27**
- 🐞 修复:Trae 落点候选加跨 profile 兜底扫描——非登录用户 shell 下裸跑 --from trae 即命中本机真会话(2026-10-26 实测首跑栽于沙箱 %APPDATA%,靠手工 IHUI_TRAE_DIR 救回);候选次序=显式覆盖>当前用户>他人 profile,IHUI_TRAE_SCAN_USERS=0 可关;镜像测试 13 例全绿+裸跑 dry-run 打穿为证 (cba1c89415)
- 📚 文档:README.en 生成块与散文六处数字按现算重钉 —— 门 173 见我改过它,从此对它全判 (0dbf4375a6)
- 📚 文档:自进化 7 枚由主席逐条现读复核后结清——金丝雀三器物在 HEAD、自治决策/经验提炼/决策链三条腿提交均为 HEAD 祖先、需求发现器三源适配器提交为祖先、反馈闭环器件在 HEAD、E2E 缺口门已接 runner id 250 (ecf125780a)
- 🐞 修复:冷启动不再把「cookie 还在」的老用户判成匿名 (db0bcde945)
- 📚 文档:三份外文 README 补「账号保活中心」一节 —— 中文那份已在 HEAD,外文一直缺 (06035647e9)
- 🔧 工程/其他:显式声明 expo-camera 相机权限 (fbfaa42034)
- 🚀 新功能/改进:默认头像域名收敛到 www.aizhs.top(省一次 CF 301) (ed751bd809)
- 📚 文档:G-11 队列拒因三件结清——b/c 两格在 HEAD 逐条复验(deferred/failed 终态与静态键盘面在位,承载测试 12/12),a 格三个输入无合法生产者按观察类结清不臆造 (fbb8c22cac)
- 📚 文档:两枚结清——argument-validation 三格逐格复跑(裁决夹具 8/8、演示路径 4/4、hub 前提已腐烂);G-37 三格逐条复验(语言包 JSON + i18n 两门 RC=0、冷却指纹测试 4/4、80 端口已进值守监控与人跑清单附 5 例夹具) (c282980c9f)
- 🚀 新功能/改进:补上手机端扫码确认 PC 登录(小程序 + RN) (b5d89fc7ba)
- ♻️ 重构:保活中心 router 迁 app/routers/ —— 让门8 的那 6 条端点从「未判定」变「在册」 (4d673db992)
- 🐞 修复:zh-TW 一枚简体残留改繁体——sourceCookie 的平台应为平臺(opencc 判残留导致门 2b 红;该值由枚 f541169ba4 keepalive 批次新增;执行席 g37-locale-json 现读点名,主席一字修正并复跑 JSON 解析与语言判定) (b77a3373ff)
- 🚀 新功能/改进:未设置头像统一使用平台 Logo (a078ca2b10)
- 🚀 新功能/改进:归属尺只认真实证据——散文标签的持有者须同时过租约/提交史/脏面三条之一才剔出派单面,否则落 stale-owner-label 并在 --dispatchable 默认保留;机主面与活租约一律仍剔,取不到输入落未判定(执行席 owner-scale-r2 交回;主席独立复跑同一命令得 出单 9 与 仍归他人 23=机主面17/侧车5/在飞1,与席位读数一致;三条反向自证齐备) (6129400e9b)
- 🚀 新功能/改进:门251 判据本体补上 + 存量 67 枚 .ps1 一次补齐 UTF-8 BOM + R6 判据右边界修正 (c384d583b9)
- 🔧 工程/其他:web ui-routes 自述钉按当前 HEAD 重钉 (541e325761)
- 🐞 修复:plan-copy-row-purge ④c 开「陈旧快照」降级档——化石件里的旧 open 不再永久挡陈旧指针 (91ead7dd14)
- 🔧 工程/其他:三枚假牙改形态锁(续假牙B同型)——api-failure-throw 删 total 硬下限改四字段形态锁、shared-type 的 hits 与 csrf 的 sites 同改,存量维一律可解析断言,取材面非空与真判据全保留,补变异自证(执行席 faketooth-a 交回;主席复跑三档十+十一+十四例全绿) (94709e33b6)
- 🔧 工程/其他:三枚假牙改形态锁——把门体自己声明只报数的存量维从下限改成可解析断言,取材面非空与真判据全保留,补变异自证(摘形态锁必红/存量归零不红)(执行席 faketooth-b 交回;主席复跑三档十五+十三+十二例全绿) (afe5fd443f)
- 📚 文档:两枚副本指针行按完成即删处置——二者本身是指针不是任务(承载行均在册),而指针注记存量自 2026-10-14 已定为零基线;翻勾后由 5 分钟节拍的清扫器摘除 (7a139fbe21)
- 🐞 修复:门71 判据补齐成套——missingFrom 按条目自带名额展开并启用 multiset(复制份标 dupSlot 折成 multiSlot 只点名不回捞),openCount 语义改为窗口内同时开放峰值(避免把 churn 累计量当名额致规模闸误触),加粗族按 marker 出现次数记账;自检 73 升 78、镜像 85 升 95(执行席 g948-complete-r2 交回;主席复跑两档全绿且全量档 RC=0 未新增红) (b3427a4a6a)
- 🐞 修复:演示路径不再执行工具 + 部署断言锚点跟上新写法——① workspace-ai-service 的 AgentLoopRuntime.run 删掉 await tool.execute({}) 那段模拟执行(轨迹仍成对、状态 completed,自述未执行);② o6 ⑤ 定位器跟上 merge 改为 git -C $Root merge --ff-only 的新形态(语义断言零删改);两枚反向牙均实跑:塞回 execute 即 2 failed、退回 -Entries 全量脏文件即 BLOCKED-WIP 断言红 (357496236a)
- 🔧 工程/其他:归并后按合并树重派三处派生件 (ac65a7954d)
- 🚀 新功能/改进:新守门 check-ps1-bom.mjs 接进提交链 (6e8f4bd2a4)
- 🐞 修复:工作空间页短内容撑满卡片剩余高度，消除项目区下方大片空白 (aec2acdf90)
**2026-10-26**
- 🐞 修复:并集收敛按复合主键认"已处置权"——本侧已结清的行不再被滞后副本回捞成 open 原形态 (937fafb78e)
- 📚 文档:守门 89 R4 清偿 —— 四枚只读尺子/自检器点名入速查区(gate-rot/plan-truncated-rows/web-rn-screen-parity/miniapp-mirror-fidelity),接线面与退役口径一并写清 (d09bf0a749)
- 🚀 新功能/改进:状态查询口同款 9074 自愈——与签到口共用 _rotate_device (b3fadcd296)
- 🐞 修复:数据大屏前后端字段对齐(修白屏) + 接入页面访问/来源埋点数据 (968b13a99f)
- 🐞 修复:门 234 A2 收口——投影等式三档化(中间态点名不判红)+ 抽取器同键冲突闸 (6d72f0164c)
- 🚀 新功能/改进:AI 自进化调度层四件器物接线装车 + 登记出口补取号令牌/短 sha 守卫(O65 第 0/1/3 期) (1f1f9508a7)
- 🔧 工程/其他:G-54 第4轮 —— 裸 git 基线 49→45(紧贴现读,不留余量;4 枚入库 cca944cc6a) (62f7d34699)
- 🐞 修复:补齐权限双轴本机记忆模块(HEAD 缺文件致 web 构建红) + 大屏使用数据面板渲染测试 (cbf3aa4329)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (59145cf2f0)
- 🐞 修复:探针取证面从单文件改为页面族 —— 修 71 条空壳的假阴性 (7c8d5b9e82)
- 🐞 修复:流式/AI 服务/raw 通道 401 自动续期 + RN/小程序主动续期 (831baf7200)
- 🚀 新功能/改进:三端 ui-routes/离线包重钉 + chat-sync terminal/resync 契约 + gate-grow 候选器 + G-965 P2 投影器增强 (fa9d1ad423)
- 🔧 工程/其他:侧车 enrich 1 条(G-63 补 blocking),抽取器 --apply 现读 changed=1 bucketsDrift=0、回读 129 条 —— 由 seat-sidecar2 的 --check 点名的唯一一条待办,主席执行;门 234 复跑 state=warn(midform 3→0 / a2=0 / conflict=0 / blind=0),孤儿 80 条只报数 (6b942ede52)
- 🔧 工程/其他:拆除 31 枚已退役零引用残影(deploy/cf-preferred-ip 2026-10-22 整链退役、qoder 探针退役、plugins-data 已下沉 packages/shared、零引用测试收口) (f80b0bb34e)
- 🔧 工程/其他:中间态标头归一(门 234 midform 3→0) —— 三条机主面行(G-957 / G-329 / G-1182551)的行内标头带 ｜等:— 属未渲染完的中间态(语义已等价:parseHeader 读回 waiting=none、dispositionOf 同判),按 §1「标头是投影」归一成 renderHeader 产物形态;只动这三行标头,正文与归属语义逐字不变,三维守恒由 live-doc-edit 当场断言(上一版误带第四行被守恒拒落,已剔除) (f1439785cb)
- ♻️ 重构:audit-decision-log 两处裸 git 派生改走 face-reader.gitBinary()(G-54:棘轮新增拦截即修,行为逐字不变) (1c0938e1d3)
- 🔧 工程/其他:结清三端 ui-routes/离线包重钉(五钉 HEAD 面全 matched) + O6511 候选器交付与真源结构发现 + B02 terminal/resync 契约第二刀 + G-965 P2 投影器增强 (394e7717f6)
- 🔧 工程/其他:重钉 web/taro ui-routes 自述钉(随 bi-dashboard 与 taro app/auth 输入变更重算,G-816040 四端现读全 matched) (09a79ced04)
- 🚀 新功能/改进:新增 catBatchTypes 原语(G-54)并让 audit-decision-log 的提交存在性取材走层 —— 清型 C 自拼 batch 债务,判据语义不变 (894943173e)
- 📚 文档:结清 G-927(镜像棘轮:裸 git 派生的生产文件只减不增) —— 现读差集 0 枚(判据 headDerivationScan,对基线提交 14a04f013f 逐枚求差)。经过:上席已迁 1 枚(strip-banned-buckets,字节 4,705,595 EQUAL)、第四批 10 枚由 0ff78d7fda 整批迁完(本席复核逐枚裸派生 0 处)、本席再迁 2 枚镜像测试读真仓的裸 execFileSync(对照 512B/1088/53/346/261B 全 EQUAL),棘轮读数 71→70→49→46。逐枚复跑:6 绿(biz-day/guarded-write/identity/live-doc/readout/token-literal),2 红在射程外(ai-task 9/10 的 llm.py 裸 create_task、money 2/3 的 DeveloperConversationsScreen centsToYuan,系门 247/248 存量债,迁移前后同判),10 枚 --self-test 全绿,21 项新旧通道同 blob 对照 17 EQUAL + 4 项仅 core.quotepath 转义差异。如实登记剩余:① 现读 46 vs 基线 45 的 +1 是 scripts/audit-decision-log.mjs(7de326e39b,自进化票,晚于降档 1 分钟入库,型 A 1 处 + 型 C 自拼 batch 1 处)—— 不属本票射程,由该票席位迁移后回调基线;② HEAD 面 45 枚存量债(G-998191 族)按只减不增口径继续逐票收 (90a27b1e8a)
- 🚀 新功能/改进:页面排行每行同时给 PV/UV(多少次/多少人) (95ca2af0fb)
- 🚀 新功能/改进:页面访问埋点接入(React Navigation 切屏上报 visit_logs) (7cf9b2e8ad)
- 🐞 修复:WS 换票与小程序 SSE 接入 401 续期 (dba8f63d4f)
- 🔧 工程/其他:收敛后重派 6 枚派生件(三端 ui-routes + i18n 离线包与清单) (170b1ba6de)
- 🐞 修复:工作空间页短内容撑满卡片剩余高度，消除项目区下方大片空白 (253418c2de)
- 🐞 修复:补齐收敛并入的 3 枚缺载荷文件(CI verify 面回潮清偿) (9e0f5aedb0)
- 🐞 修复:补齐 deploy 三枚缺载荷文件(门 47 全量档/CI 红清偿) (67f3a74541)
- 📚 文档:守门 207 体积红二次清偿——合并把已清副本 union 回来了(100886→94975 B) (0f85b56149)
- 🐞 修复:还原被本席上一枚提交覆盖的别席逐字迁出条目(同名归档件撞车) (3be29eb3ec)
- 🚀 新功能/改进:海外登录隐藏手机号入口并主推 Google，Google OAuth 出站走白名单代理 (0451b10e78)
**2026-10-26**
- 📚 文档:两枚结清——分叉票按当场复量关闭(origin=ALREADY、本地与远端 0/0、push-state done,合并枚已入祖先链);A01 按行内自带销账注记关闭检查框 (1e67311179)
- 📚 文档:结清一枚无编号僵尸行(双重执行/两次 LLM 与两遍工具副作用)——修复形态在 HEAD 三个调用点齐备(orchestration:277/team_orchestration:211/agent_orchestrator:1510 均为 handoff = await take_loop_v2_handoff(...) 后 if handoff is not None 早退),二次复核席判 PASS 后主席独立复跑符号面复核 (4f7cd644f9)
- 🚀 新功能/改进:海外登录隐藏手机号入口并主推 Google，Google OAuth 出站走白名单代理 (b2ff1bf93b)
- 🐞 修复:两枚 PowerShell 脚本补 UTF-8 BOM——治 PowerShell 5.1 把中文串读成乱码导致对侧 runId 镜像测试 T2 在 main 恒红(§27 要求 .ps1 带 BOM;内容零改动,只加三字节前缀。上一笔被收敛对齐冲掉盘上修复,本笔重落) (f10838b8f7)
**2026-10-26**
- 📚 文档:12 枚僵尸票批量结清——前提在 HEAD 逐条不成立:桌面 ANR 残行 55 字、G-195 三个入口脚本全在 HEAD、take_loop_v2_handoff 生产面 18 处已装车、O87g 精确挂载图已装车(本轮另补 compositeDelta 报数)、三枚归并副本指向行已归档、G-8 为副本套娃 31 层的一次性快照、G-242 残行且属禁用的等条件形态、G-948 被吞行已回补、G-66 为单点读数加等条件形态、cloudflared 运行副本与入库源逐字节等值 (9be4bfd2bb)
**2026-10-26**
- 🔧 工程/其他:fix(scripts)+test(deploy): 两批判据补强——① 门 8 组合前缀 compositeDelta 报数(票面第 4 格少判组合必须报名,此前无机器断言;现读少判 877654 条,只报数不判红,兜底档返回 null)② 人跑健康清单补 cdn 80 端口三态(原本只查 8801/8802/8803/8810/8811;取不到记 null 且仅未判定 exit 2),附两枚镜像各含摘掉即翻红用例 (0b0f033dec)
- 🐞 修复:补齐部署窗口线三枚新文件的溯源水印 (c4da901e2a)
- 📚 文档:AGENTS.md 重复登记副本清偿批的逐字迁出件(先入库立凭据) (7d5e7474e5)
- 📚 文档:三枚已结清未翻勾行由主席复验后翻勾——G-706 证据件三枚在 HEAD 且夹具 11/11 通过、G-42 架构策略表相对 HEAD diff 0 行、G-56 索引 D 前缀 0 条;原行内"不翻勾/不动勾"注记经当场复验解除,按完成即删口径处置 (5e5b788612)
- 📚 文档:§21 补登「账号保活中心」——两条保活线收成一份状态,6 条 /api/keepalive/* 从 in-doc-window 清零 (094dd7f730)
- 📚 文档:号池 workbuddy-switch 三件套活文档补账——PROJECT_PLAN 加 2026-10-26 本批节(三件判据/成对对照端/验绿末行/端范围平台独占豁免/推送分叉如实登记仅别两席两 ps1 真冲突与这两枚无关);README 号池表 3 处(账号池调度巡检扩为四档含空闲保活、新增号池导入格式自适应、号体检速查 CLI) —— 以权威 HEAD 基面叠加我的新增,自检 HEAD 逐行零丢失(唯一差异=该表行按'一编号一行当前状态'就地改写,旧①②③文本原样保留在新版内),活文档归并走 object-space-land 带行级复活守卫 (49e67301c1)
- 📚 文档:归档件说明头补改号映射句(G-39⇒G-36 新号形态) (6ffbbff6b9)
- 🔧 工程/其他:union 合并落地后按合并树重派 8 枚派生件 (66e547dcb7)
- 📚 文档:G-39→G-36 改号留痕归档件(守门 71 出路②凭据) (62c1800e06)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (892b2349c2)
- 🐞 修复:部署窗口显式化 —— 部署期间只暂存部署相关告警,成功后留 15 分钟 settle,失败/回滚立即放行 (370d9f26c7)
- 🐞 修复:聊天流程 taintEgressGate 全端同步 + 两处存量 build 红清偿 (100038acb4)
- 🐞 修复:全量 pytest 清零——生产两处真修复 + 测试判据去假红 (56ac086fab)
**2026-10-26**
- 🐞 修复:部署面按「取对侧(已声明+可复核)」导入 origin 的部署窗口线 + 两处归并与两处修红 (c02b88bc63)
- 📚 文档:G-5 结清——超龄认领牌存量现读归零(代摘器干跑 SWEEP-RESULT state=clean stale=0 held=40 stripped=0 @22:51),且 2026-10-25 机主令已禁止等条件桶 ⇒ 原"等持有人处置"的出路由器物 strip-stale-claim-marks 接手,本行无剩余动作 (ebf8f7d516)
- 🐞 修复:门41 认「退役远端的残留跟踪引用」为一档(orphan)—— gitee 远端 2026-10-23 摘配后 packed-refs 里 4 条 refs/remotes/gitee/* 掉出 mirror 档、又不属 origin 的 stale 档,被判成超窗旁支,而本门给的四条出路对它全部不成立(A 删的是别的 remote / B 对远程跟踪引用无效 / D 只 prune origin)⇒ 无解恒红挂每次提交(§12e/§12f);判据改为按 git remote 现配清单分档,configuredRemotes 取不到时一律不判 orphan(失效方向仍是多拦),T21 端到端锁正例 + 自检四例反向对照;同批门150 三族圆角归位(KeepaliveCenterPanel panel→rounded-xl / control→rounded-sm,quick-notes archivedDot tiny→rnRadius.xs),工作树面复跑判红 0 族 (bf63f8c40b)
- 📚 文档:G-397 双席同题对账入当前行—s6 席 deploy-lock 负向与本席 git-lock 迟到finish 验收互补,合跑6/6绿,auto 已收编 (bca2ffaeb7)
- 🐞 修复:G-1182551 终验闭合二落——03:00 轮转档案当日 4 行 strict-UTF8+CJK 正常(mojibake=0)non-UTF8=0 成立;一次 CAS 被合批洗回 open 已如实注记 (93ff2c73dc)
**2026-10-26**
- 🔧 工程/其他:合并落地后重生成 web ui-routes 钉(union-converge 对生成物留下的本侧副本须立即重跑生成器,门 105 现读 web 行 stale⇒heal 后待入库;miniapp 端他席在飞 taro-ws-ticket.ts 由 heal 档正确拒写不背书) (c411929340)
- 🐞 修复:G-1200041 按 2026-10-25 机主令出等条件桶——两格真卡点归机主控制台/运维动作面,存在句改归属句(事实未动),清合并回潮的 F12 基线违例 (3c6956763c)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (9ae2dd7013)
- 🐞 修复:健康 ping 与同步同用出网判据(专用代理表→SYNC_PROXY_URL→直连)——huggingface 直连被封经代理可达却被误判 DOWN,系 LlmProviderUnhealthy 误报根因;钉测含变异自证 (ce76fff2c1)
**2026-10-26**
- ♻️ 重构:侧栏/历史页会话菜单按钮层级重构——导出7格式与压缩2档位收进二级子菜单,一线16项收敛为9项(48项菜单测试/typecheck/prettier现读绿,i18n五语言补键parity OK) (09b5462b8f)
- 🐞 修复:推送腿兜底两处收尾 —— ① 探针取根改用脚本自身位置 EGRESS_ROOT,不再引用尚未赋值的 repoRoot(实测:兜底自己崩在判据之前,Cannot access 'repoRoot' before initialization,比没兜底更坏) ② 两条腿都不通时把诊断写进 push-state reason,读数不再退化成'退出码 128 且无可辨认特征'(AGENTS §5e-3 量得到/§12f 失效不许安静),并给出单次绕过的可跑通道 --no-proxy ③ withDirectArgs 保住 git.exe 与尾随空格形态。回归 git-push-guard.test 32 例 + push-attempt-triage 自跑全绿 (5999fa708e)
**2026-10-26**
- 🐞 修复:把'代理腿死'的出路做成真跑得通的通道(AGENTS §0.8) —— converge 加 --no-proxy、face-reader 加 isForceDirect 与 opts.forceDirect(第一趟就直连,不再先烧一次代理超时),alreadyDirect 认 forceDirect 不叠第二趟;两腿都不通时 push-state reason 点名两腿与各自动作;兜底探针取根不再碰未赋值的 repoRoot;直连实测新形态 'Connection was reset' 补进传输特征串。接线锁 scripts/tests/git-egress-fallback.test.mjs 16 例(含 HTTP 403 / not-a-git-repository 两条成对反证);face-reader.test 35 例同跑 51/51 全绿 (362addb4d8)
- 🐞 修复:git-lock 落 G-397 租约凭据四档释放(单一删除出口承镜像反向锁⑤)并接 CLI --token;fix(ui): edu-ai tabActiveText 配对补全消费点(门83 R3) (b0f575b666)
- 📚 文档:登记 O 族派单面同尺票 v2 接线(结清注记,第二步摘行) (4dc4effa68)
- 🐞 修复:mypy 归零——_version_sort_key 恢复完整泛型注解(收口上一枚带入的裸 tuple),parent_child_chunking 删多余 import-not-found ignore(本venv已装 tiktoken,unused-ignore 判红) (f28c7ace34)
- 📚 文档:G-241 与 O87g 记进展不翻勾——认领 CAS+终态封闭集已入库(journal 345,applied 回环 dev),门8 提取式第①步 ⊇ 自证主席复跑(4357→4648/回归 0/未判定点名 62→170);两行各自写明剩余格,不开假账 (fb54ff62f0)
- 🚀 新功能/改进:窗控 overlay 深浅判定拆出纯函数 classify_topbar_luminances+10 组单测,新增几何/深浅真机自证日志(note_chrome_state,节流三闸);本机无 MSVC 链接器未编译验证,以门为准 (654ade932e)
- 🐞 修复:派单口径分桶切到 v2 尺与 --dispatchable 过滤面同尺(票 G-1182552) (2f0830e8ee)
- 🚀 新功能/改进:cf-preferred-ip 优选 IP 守护脚本落库(PROJECT_PLAN 已登记该交付物,此前仅存生产机未入库;.env 本体仍由 gitignore 屏蔽) (bf805b6551)
- 🚀 新功能/改进:模型同步按 provider 指定出网代理(SYNC_PROXY_URL_<PROVIDER> 环境变量驱动,缺省回退全局);收口 httpx proxy= 三处测试替身欠账 (b30f56aa66)
- 🐞 修复:ai-world 收藏前景键改 favBtnActiveText 与底键同前缀(门83 R3 兄弟对);chore(miniapp): llm-settings 空态补 key-round 图标,ui-routes 派生产物随源同步 (d184010664)
- 🚀 新功能/改进:[cross-domain] safe-commit 两处停摆根治 + intentional-delete 摘净国内代码镜像残留 + 根目录 .screenshots/ 入忽略层 —— ① 本进程取不到 user.email 时按 lib/bypass-git.mjs 的 REPO_GIT_IDENTITY_ARGS 唯一出口补署名(问不到当作有身份,绝不伪造作者);② 裸 exit 128 不再冒充索引锁争用(本机实测:身份缺失被当锁连烧 10 轮守门链 ≈100 分钟),确定性致命因有专档且不退 --no-verify;③ 删 mirror-to-cn.yml + scripts/setup-mirror-repos.mjs(机主 2026-10-23 弃用令被并发 union 带回,gitee 残留远端同批已摘;桌面端 Gitee 附件分发与 release-desktop.yml 不受影响);④ .screenshots/ 入忽略层 ⇒ 守门 44 从"归属无从判定 exit 2"落到只告警层,不删并发席位现场。接线锁 scripts/tests/safe-commit-failure-triage.test.mjs 5 例 + git-egress-fallback.test.mjs 14 例;回归 face-reader 35 / safe-commit 20 / git-push-guard 32 全绿 (2f9def0ddd)
- 🔧 工程/其他:RAG_PARENT_CHILD_ENABLED 登记能力矩阵(开关类,默认关;放量判据=金标集真实库 on/off 对照) (63cf7dbfd3)
- 🐞 修复:cross-publish-v2ex 用法文案漂移(参数→值)对齐单源措辞,g322 第二十批探针 29/29 转绿 (f0b3e47c3c)
- 🐞 修复:补 stepfun 除名最后两处漏网(入站显式档 + 用户可见面板) (9d01bc93a8)
- 🐞 修复:部署脚本 git 调用一律钉 -C $Root(取源/定 tip/算 behind/快进不再读错仓库) (85eeb326a7)
- 🔧 工程/其他:三端 ui-routes 派生产物重生成(大屏「会话质量/访问来源/页面流转」三块面板改动 ⇒ 自述钉 inputsSha256 须同步;派生产物由生成器产出,不得手改) (e3138d8057)
- 🚀 新功能/改进:大屏新增「访问来源」与「页面流转」两格(流量从哪来 + 人往哪走) (bc28df94c1)
- 🐞 修复:清零 shared/api 两包 lint 错误 (f78f79461f)
- 🚀 新功能/改进:KB 检索金标集入库(264 条问答 + schema 校验常驻尺子) (0451cb1e18)
- 🚀 新功能/改进:检索指标模块(Recall/Precision/MRR/nDCG/HitRate/ContextPrecision) (a7701fa00e)
- 🚀 新功能/改进:父子块 small-to-big 摄取/检索接线(RAG_PARENT_CHILD_ENABLED 默认关) (9e7923d0fd)
- 🔧 工程/其他:守门44白名单登记 .screenshots(只登记、不搬不删,归属并行会话产物) (308d4c57d7)
- 🐞 修复:永久退役厂商(stepfun)在同步/可用性/面板/调用/清单五面统一除名 (535dfe6d92)
- 🔧 工程/其他:三端 ui-routes 派生产物重生成(墙板页面改动 + 并发侧 bi-dashboard 变更 ⇒ 自述钉 inputsSha256 须同步;派生产物由生成器产出,不得手改) (7694177548)
- 🚀 新功能/改进:大屏新增会话质量腿(会话数/单页会话占比/人均浏览页数/会话深度分档/落地页TOP) (9d6fbb62ee)
- 🐞 修复:修「网络异常 × 401 续期」预算互挤 + 补 fetchText 续期契约;RN 替身补转发;api 三例存量红收口 (40f18df5fe)
- 🐞 修复:LlmProviderUnhealthy 文案去「补 key」出路措辞 + 接线锁文案层射程扩到全部 LLM 告警规则 (af69efdde8)
- 🔧 工程/其他:三端 ui-routes 派生产物重生成(墙板页面改动 + 合并带入的路由源变更 ⇒ 自述钉 inputsSha256 须同步;派生产物由生成器产出,不得手改) (f43a72e73f)
- 📚 文档:G-1200041 压行至 388 字(≤400 合规),主键与归属桶逐字不动 (11c70b4ac4)
- 📚 文档:G-1200041 登记 sso.aizhs.top 502 剩余两格(归:机主控制台面);本机 Keycloak 已对齐 8850 (e4a65ab104)
- 🐞 修复:三条通道的 401 续期收口 —— SSE 双闸收敛为一道 / WS 换票 401 语义下沉 / 小程序通知 WS 票据化 (de1a3c2902)
- 🐞 修复:页面路径归一单源 + 授权凭据落库防线;大屏排行补端前缀与占比 (0c50f20838)
**2026-10-26**
- 📚 文档:E2E 自动补测记进展——缺口发现门接 runner 250(warn 档),存量缺口 4009 只报数,准入硬拦未开,守住未勾 (9a0ee76ccf)
- 🔧 工程/其他:B02 记进展 —— terminal 帧三处接线收口(切片 1 6a316c8559;切片 2 生产端/载体/读 rev 4 文件由自动收编 b2c8197479 / 073bd769f8 入库,主席已核实并复跑 typecheck+5 例);契约 §7 第 4 项已改 ✅(c304de6373);本行仍不勾,残留 SSE 不广播 created/patched ⇒ rev=0 由端侧 gap resync 自愈、taro store 在飞、v2 切换待 created/patched 一并 (82c2534d04)
- 🐞 修复:triage-incidents 的归一签名改引 auto-triage 唯一定义(门 98 悬空导入清零;--self-test 13/13) (ef0e037ffb)
- 🚀 新功能/改进:跨端 UI 契约下沉(二期)— 8 族 spec 单一源 + 两端薄壳接线 + 源码级契约测试 (b766fd234a)
- 🚀 新功能/改进:跨设备委派审批 —— 消费端补落(web 审批卡 + i18n 五语言) (7a1330d4c8)
**2026-10-26**
- 📚 文档:terminal 帧三处接线收口 —— §7 第 4 项由 🟡 改 ✅ (c304de6373)
- 🐞 修复:补 windowsHide + 还原 next-env.d.ts 规范引用(门 52/50 HEAD 存量红) (61bdc87fe0)
- 📚 文档:D-07 记进展——根因在 llm.py 等待段 finally 当场 pop;落票面第二档(有界 TTL 账本+三闸+具名拒绝,零 wire 变化、单文件可 revert),代码已由 chore(auto) 收编进 07b4403797,pytest 两遍 125/125、mypy 0 错、ruff 通过;残余"端上可见"一格需跨端载荷键 ⇒ 保持未勾 (721b1df040)
- 🔧 工程/其他:认领 L28812 端到端反馈闭环(goal-loop 席) (1e339afc6a)
- 🚀 新功能/改进:补 status 公开状态页 web->RN 共享屏样板(全链路打通) (9986d2b676)
- 🔧 工程/其他:守门8参数段82条逐条定性结清(席37自摘本席租约)——①判据错52(param 档合并 + 入桶 continue 排在消费位之前 + 3 条基址常量声明行) ②合法7(无登记位,写进必被 AJ3 判清单腐烂红) ③真缺陷23(主根因 /api/admin/:id 吞五条列表);全量档面=head 门 RC=0、读数未降、零消音;残余四组真工作随本行摘除由续座按现读重登 (b3dfce9a61)
- 🔧 工程/其他:G-965 P2 进展注记(标头投影+强制档两项目标达成,A2=0;剩余缺口按分因口径点名) (1e933d35d4)
- 🔧 工程/其他:G-395 结清并自摘本席租约——升档留痕臂+三值封闭 reason+层名单一真相源落地,apps/cli 209/209、typecheck 8/8、水印 4/4(枚 cfec8fda86);残余两格(tools/subagent.ts 未传 reasoningEffort、上游形状非本轮交付物)另立不塞回本行 (24d6458df6)
- 🔧 工程/其他:门 250 接线留痕(AGENTS 点名 + 门体如实接线 + 根护栏按新 runner 重封存) (587764f561)
**2026-10-26**
- 🚀 新功能/改进:G-965 无记录行分因出口(五档,判据全问既有单源)+ 同号旧键点名;不再只报总数 (45b03a543d)
- 🚀 新功能/改进:E2E 自动补测·缺口发现门接进提交链(warn 档观察) (4d3c0f0b11)
**2026-10-26**
- 🚀 新功能/改进:缺口发现尺子入库(新模块无对应测试的增量判据+射程清单;判据层生成物自述只认文件头) (c3905ac75e)
- 🚀 新功能/改进:子代理档位链补"升档也留痕"臂 + 出处标签三面一致(G-395) (cfec8fda86)
- 🔧 工程/其他:再重钉 ui-routes 产物(wallboard 输入随 67c9d0dac7 变;union 合并后复量) (3b5a4b34d7)
- 🔧 工程/其他:守门8参数段82条逐条定性 挂牌认领(并发席37)——派单面 --exclude-inflight 从此让出该枚,防两席领同票 (d6fa9a290a)
- 🐞 修复:端内埋点改走共享 api-client 的 recordVisitLog(解守门 184 直连红) (67c9d0dac7)
- 🔧 工程/其他:G-1142551 复量注记(门 105 G5 档:web 已重钉 matched,taro 被在飞删除阻塞 ⇒ 不翻勾) (1087a36315)
- 📚 文档:第 3 期·进化回流同题收敛为唯一保留行(删 2 条无注记副本/1 条未勾副本)+ 装车证据注记 (744a6d2087)
- 🔧 工程/其他:重钉 ui-routes 产物自述钉(bi-dashboard/wallboard 输入在别席提交 95ca2af/0c0c764 后变) (2110ae45c9)
- 🔧 工程/其他:D-07 与 端到端反馈闭环 两枚挂牌认领(并发席35/席36)——§24 修订后由 agent 代裁执行;--exclude-inflight 从此把两枚让给本席,防两席领同票 (5b7ceeceed)
- 🐞 修复:G-965 投影器物两处加固 —— 无侧车记录≠记录为空(不再摘真实归属标头)、owner 括号失配不投影 (6a2c360fcc)
- 🐞 修复:陈旧 refresh 副本按错误码分流,不再误清凭据 (aefd7d5e0b)
- 🚀 新功能/改进:新增各端使用量面板(web/RN/小程序按路径前缀分桶) (ed04dfa525)
**2026-10-26**
**2026-10-26**
- 🚀 新功能/改进:message:terminal 终态帧贯通契约层→api-client→web store 投影(票71 切片 1/3,B02) (6a316c8559)
- 🔧 工程/其他:G-395 挂牌认领(无牌→进行中@2026-10-25/goal-并发席34)——已派子席动 apps/cli/src/subagents 落点,按 §1 认领即租约,防两席领同一张票 (fbd9d7b83d)
- 🔧 工程/其他:G-965 P2 投影器物加固落地(无记录≠记录为空、owner 括号失配不投影) + 第 3 批 1 条行内标头投影 (d11323e96f)
- 🚀 新功能/改进:设备证明密钥对补全跨服务过桥链路——生产 Trae 号可自续(此前结构性刷不动) (bacf2d4173)
- 📚 文档:需求/异常自动发现器记进展(三源+调度已交付,余数据源素材面) (1386e45a48)
- 📚 文档:结清第 3 期·进化回流(两条同题副本一并翻勾) —— 席位提交 1f1f9508a7(10 文件 +1069/−18)已入 HEAD;主席自审:五套 59 例 pass 0 fail、四器件 self-test 全绿、git-guardian --check RC=0、受判据 19 臂全绿、水印 10/10。逐格处置:② 守门判据腐烂自检 = check-gate-rot 增差值档(--ratchet/--baseline/--write-baseline),guardian 6h 只喊新增,现读 284+22 项、存量腐烂 1 条(git-lock 路径已登记);③ 依赖升级自动票 = dep-advisory-radar 接 ticketWhitelist,guardian 24h --register,pnpm audit 257 条(35 critical/93 high)、80 可修、已出 3 票;④ token 双闸 = 前席已接并复跑放行;① 自动沉淀 AGENTS.md = 按 §24 代裁不做(门 207 预算 96,000 字节、现读 94,050,余量 1,950;把最高约束文档交给自动写入不可控),落选理由在此留档。两条无编号同题副本同时翻勾(昨次折并后被并集回捞,属 union 无编号行维的已知残余);剩余面:②符号级未覆盖(只判路径存在)、依赖票会派进 AI 会话、EOF 登记无幂等锚点 (59d2499138)
- 🐞 修复:补 lesson 候选稿合法性尺子,清 HEAD 门 98 悬空导入 (eea073ccd2)
- 🐞 修复:折叠漂开副本族(N→1,认领合并到保留行 + 逐字留痕;--fold-drifted-families) (7eb5bc4174)
- 🚀 新功能/改进:页面访问埋点接入(页面栈轮询上报 visit_logs,免改页面壳) (0c0c764393)
- 📚 文档:结清金丝雀发布票(观察窗+自动回滚已落地) (10dc45a19c)
- 🔧 工程/其他:裸 git 派生基线 45→41(G-927 那族在飞迁移入库后按现读收紧) (ca701c4923)
- 🔧 工程/其他:两张趋势图并排,压缩数据大屏纵向长度 (e30405a000)
- 🔧 工程/其他:G-965 P2 首批 10 条行内标头投影落账(归属散文→标头,等价搬移) + 投影落地注记 (3ad96dca5a)
- 🚀 新功能/改进:数据大屏新增近 7 日访问趋势(PV/UV 逐日)+ 页面渲染测试 (11fee56c8a)
- 📚 文档:G-24 记进展——回收器已落地(archive-gc 双上限+10代地板,镜像 11/11)但调度未接(HEAD 面仅本体与测试两处命中,git-guardian 无调用点);按 §0.9 保持未勾,残余=接线一格 (0e37914c0b)
- 🐞 修复:用户 id 失效(外键违约)时降级匿名重插,不再丢整条访问 (d365f2fe82)
- ♻️ 重构:G-54 第 5 轮 4 门 git 派生收口 face-reader (af6b584786)
- 🔧 工程/其他:恢复被并发合并清理误删的访问面分桶测试(内容与原件 sha 一致) (06338cf4a5)
- 门户标签不变量 `check-web-portal-label-keys.mjs`(**runner id 256**,blocking,**绝对零容忍**——存量现读 0 ⇒ §12e「升 blocking 前置=存量归零」已满足):WebView 门户唯一真相源 `packages/shared/src/constants/web-portal.ts` 里每个 `titleKey: 'webViewPortal.<k>'`(条目 + 分组标题)**必须在两端 × 五语言 = 十份词包里全部存在**。立因:表里有键而词包没有时端上按约定回落 `fallbackLabel`(中文)——界面不报错、不空白,**只是变成中文**,属"永远不会自己叫"的那类失效;既有 i18n 门只判「词包↔词包键集对齐」,不知道门户表引用了哪些键,结构上打不到这一格。三档:W1 blocking(现读 表内 titleKey 141 枚 × 词包 10 份 ⇒ 缺失 0)/ W2 孤儿标签(词包有、表不引用)**只报数**,删标签归人裁 / W3 条目指向的 web 路由必须真在位。取不到被审面 ⇒ exit 2 显式「未判定」(§0.3),不回落另一个面(§0.4)。判据零复算(§0.6):面读取 import 门 237 的 `faceRead`,键扁平化与词包清单 import `add-web-portal-entries` 的出口。自检 `--self-test` **10/10**;镜像 `scripts/tests/check-web-portal-label-keys.test.mjs` **11/11**;应急跳过 `HUSKY_SKIP_PORTAL_LABEL_KEYS=1`(提交信息写清责任归属)。
- 逐字回潮只读尺子(2026-10-29 立,**不进提交链** §12e): `check-verbatim-resurrection.mjs`(判「一枚单父提交把祖先已被非合并提交显式删掉、且此刻仍在面上的路径带回」;立因 = 同日嫁接枚 `1fe3a2b42d` 把 9 枚已声明删除的路径带回主线而全链零门响:168 的 `auditMerge()` 要 ≥2 个父(单父落进它自己的未判定档)、旁路落地走 commit-tree 结构上不跑钩子、238 射程是 10 个文档不含 workflow 本体。判据零复算:删除出处与树成员性 import 门 168 的 `deleteCommitOf`/`membership`,豁免两条例出口 import `lib/deletion-intent`;只判"此刻还活着"以免历史事故挂恒红;三态 exit 0/1/2,未判定优先于红。接线 = `git-guardian` 巡检轮 `auditVerbatimResurrection()`(6h 节流,hits 经 `notifyGuardRed` 走 §5e 邮件单通道,未判定只写日志不喊人);自检 `--self-test` 12/12(正反例成对,含"摘掉调用点即翻红"的 T1b);镜像 `scripts/tests/check-verbatim-resurrection.test.mjs`(T3 阳性对照钉事故枚全量 sha 不钉 HEAD);手动问责 `node scripts/check-verbatim-resurrection.mjs --window 300`。无应急跳过变量——它只读,判红了动的是被点名的那枚提交,不是这道尺子)
|                   | AI 服务             | FastAPI + LangGraph + LiteLLM + MCP + A2A / **200+ services**(Glob 实测)/ **23 routers** / **18 LLM Providers**(openai/anthropic/gemini/qwen/dashscope/doubao/volcengine/zhipu/hunyuan/stepfun/kling/jimeng/ollama/lmstudio/llama_cpp/openrouter/luyala/xai)/ **24 MCP 工具** / **38 发布适配器** / 215+ 端点 / 31+ provider 适配(含 22 免费 provider 内化)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
- `check-root-guard-consistency.mjs`(守门 267,**warn 档起步**)—— 根护栏清单 ↔ 被审面内容对账:
  判「清单里登记的判据面文件对不上内容」⇒ 合并后 root-guard --check 必红、部署环在所有签出 fail-closed;
  取值与判据一律复用 `root-guard.mjs` 的 `hashTarget`(本门零自写尺子);
  修法唯一 = 复核被审面那份改动 → `node scripts/root-guard.mjs --seal --reason "..."` → **清单与被改文件同枚提交并推送**。
自检 `node --test scripts/tests/check-version-drift.test.mjs`(每条判据都配了能被它抓住的反例;这里不写用例总数 —— 数字比代码先腐)。
│   ├── sdk/                 # @ihui-ai/sdk (自动生成)
- **npm**:`@ihui-ai/sdk`(TypeScript / Node.js,108 端点,零运行时依赖)— `npm install @ihui-ai/sdk`
- **5 语言 SDK 完整封装 + 4 语言包管理器发布 CI**(npm `@ihui-ai/sdk` + PyPI `ihui-ai` + Maven `com.ihui:ihui-ai-java` + Go module,OIDC trusted publishing + tag 自动发布)
**2026-10-30**
- 🐞 修复:/llm/models 502 按负责方分档(超时504/连不上503/上游鉴权502/其余502带码)+15s出站deadline (8f463b94fd)
- 🐞 修复:摘除压缩批截断残行(结清原件在归档面为已勾态,非未完成工作) (95f97f3bba)
**2026-10-30**
- 🐞 修复:G-322 第23批补完 —— 门70/168/195 旗标取值换单源(6/6 逐枚还原正反对照) (2c2931440e)
- 🐞 修复:结清 G-1142551(ui-routes 产物陈旧已按面重生成落地,门105 matched + 门100 同处存量清零) (3f9448cd4f)
- 🔧 工程/其他:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (3104492436)
- 🚀 新功能/改进:Y-14 app-version 最新行只读对账腿接入巡检轮(6h节流,fail 给可整改那一步) (ac283709d3)
**2026-10-30**
- 📚 文档:check-app-version-latest 补点名(R4;与 git-guardian 接线同批) (b5fec79573)
- 🐞 修复:G-322 第23批 union-converge 单源收口 + deploy-lock 两站 (b3466d1135)
- 🐞 修复:还原 registry 批内复合键去重与 deduped 留痕 —— 被 2026-10-28 批量落地写回旧版 (7e0ef336cf)
- 🐞 修复:结清第3波覆盖面票(31枚逐枚切片已入账 426f493091) (b3b3f8f5b3)
**2026-10-30**
- 🚀 新功能/改进:遥测/ARMS+processResource 族 31 枚逐枚切片入账(切片872→903,读到体零虚增,父片264→233/97→66 全表 read 守恒) (426f493091)
- 📚 文档:check-i18n-cross-end-wording 补点名(消门89 R4 红,既有欠账) (334bf4e04d)
- 🐞 修复:Avatar 头像 src 同源代理 + 新增 toMediaStreamUrl 媒体代理助手 (539181a601)
- 📚 文档:门 266 补进守门脚本点名索引(R4 义务;AGENTS.md 余量仅120B,只点 README 满足 AGENTS∪README 口径) (9caeb4ccab)
**2026-10-30**
- 🚀 新功能/改进:样式工厂键集<->跨文件取用对账门(266) —— 修两处假绿(作用域链传记录致全放过)+绝对零容忍 (e80bc950b3)
- 🐞 修复:next/image 动态 src 同源代理收口 —— 彻底堵死 img-src 外泄信道 (1f50cf2447)
**2026-10-30**
- 🚀 新功能/改进:批量写诚实性两格补口 —— batch-cancel 两表 returning 回库确认 + mergeUserAccounts GET DIAGNOSTICS 回执 (d9325f426b)
**2026-10-30**
- 🚀 新功能/改进:G-584 服务运行配置入仓 —— 三面分桶真相源+清单快照(凭据零值命中) (bdf238e447)
- 🐞 修复:按 s17 普查修复五枚僵尸票的腐烂路径指针(落点改指本仓真实宿主) (116db99890)
- 📚 文档:门207 清偿收官,移出 R4补记②长版(已逐字归档)+清拼接损伤,95880 字节余量120,lost=0 长行重复0 (fe81e285d8)
- 📚 文档:逐字固化 AGENTS.md 移出的 R4补记②长版(2026-10-30 清偿第五批) (209f3e11ed)
- 🐞 修复:两门吞值判据换 import 单源 + 清存量死 import(eqeqeq 用 smart 精准放行 null 判、非盲改 ===) (86e2a5de29)
- 🐞 修复:G-322 吞值判据换 import 单源(migration-bookkeeping/收敛器 getOpt)+探针测试件 (0de06fd076)
- 🐞 修复:图片同源代理收口 —— 根治 img-src 外泄信道 (5304d72bb0)
- ♻️ 重构:摘除腾讯云 COS 备用下载腿(整桶已删,站点 CDN 腿为唯一出口) (c521c77f24)
- 🐞 修复:删掉 app.json 里无消费者的静态 versionCode,并立 I2 判据拦住它复发 (f91858935d)
- 🚀 新功能/改进:小程序词库镜像 174 个共享屏键 —— 补页面前先补齐文案腿 (a3105058ce)
- 🐞 修复:版本漂移门判据 I 取值失效修正 + 移动端版本号收敛到可追溯值 (359f2a938f)
- 🚀 新功能/改进:小程序词包镜像 97 个共享屏键 —— 补页面前先把文案腿补齐(零新译) (b38803a09a)
- 🐞 修复:统一 Android 签名, debug 变体也用正式 keystore (10819940fc)
- ♻️ 重构:摘 api-client 六文件零消费方死导出与小程序 /pay/activity 恒404腿 (687201eda9)
- 🐞 修复:还原度门认原生导航栏标题 —— config 里的页面标题也算页面真实文案(422→410) (6467388a29)
- 🔧 工程/其他:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (00ed7d84a7)
- 🐞 修复:还原度门认同值别名 —— 两套命名空间同一句译文不再记成缺口(501→422,还原度 80.8%) (44addc5cf7)
- 🐞 修复:聊天 SSE 的 dispatch_subagent 接入已有工具面收窄 (52a6f5ee6b)
- 🐞 修复:视频卡片功能收口 —— 同源代理根治 CSP 外泄 + 分享全平台可用 (57f4b6a902)
- 🐞 修复:循环六处收口——非只读串行且取消杀进程、超限结果落盘、压缩连败三次即停、规则上溯叠 .local、检索认 gitignore、目标未达成再跑一轮 (62e4bf530f)
- 🐞 修复:还原度门的载体面补同目录相对 import 模块 —— 拆子模块的页不再被读成整片缺键 (efde0d87d6)
- 🔧 工程/其他:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (9a8f4b4443)
- 🐞 修复:端数事实统一为「六端」+ 32 枚跨端文案漂移全部落到在册裁定 (5c023fe3f2)
- 🔧 工程/其他:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (0319eec121)
- 🐞 修复:壳承载屏两端同处 UI 的 5 枚值对齐基准,并补两枚会露裸键的缺失词条 (aaf79a68aa)
- 🐞 修复:端内 common.loading 值本是"检测中..."——50 处列表加载态一直在说检测 (0b9566c39e)
- 🚀 新功能/改进:跨端同名键文案漂移的裁定对账尺 —— 46 枚清理完后,让下一次不必有人从零重读 (1454b5a5ac)
- 🚀 新功能/改进:流式 markdown 补全未闭合标记,脚注和块级 HTML 不再被切开 (e27a7fb4f2)
- 🔧 工程/其他:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (53a07309a7)
- 🐞 修复:RP-1 第2笔摘占位与旧口径错记文案——4枚已补号行的「未取号/号池已满」叙述整枚摘除(RP-35/36/37/38;号已实发故本笔主键两侧同值不漂,三维守恒逐枚 PASS,归属桶与租约逐枚不变;R7 保住 登记@2026-10-26 日期 = 守门130 F8a 交代;R5 的号在 〔归:…〕 标头之后不漂桶;scripts/** 禁令证据面一处未动) (0d3c0fb662)
- 🚀 新功能/改进:暴露即轮换腿落地(编排器全 import 既有 refreshOne/decryptAccountCredentials/fingerprintOf/checkHealth,零第二份实现;镜像 13/13 含"换成功但旧值仍被接受⇒判红"与 canary 五面不外泄);fp 清单今日登记 0 靶——39 枚号池现值 fp 与两枚历史 blob 取交=0、blob 内无 JWT/无裸 rt(解出 aha.device.* 设备标识),故该次泄露不含当下可被上游接受的真凭据,拒绝登记假靶 (ed1aa18ee8)
- 🐞 修复:结清 D05 协作会话设计稿与迁移298核查单两枚(成果已随 6ac02eebdc 入库) (06c05f3694)
- 📚 文档:D05 会话协作设计稿写实(现状证据+鉴权落点+分阶段S1-S5) + 迁移298核查单逐格现读校正 (6ac02eebdc)
- 🔧 工程/其他:批量写诚实性第4批补测57例 + Esc层栈变异读数固化 + zcode登记件入账 (928a924925)
- 🚀 新功能/改进:悬空 commit 自动保活腿 —— 消费门30a机读出口零复算(§0.6),只加不减/超窗只报数/时刻读不到保守算窗内/撞名不覆盖并点名/fsck取不到⇒未判定;15min节流(每轮跑一整趟30a约4分钟),clean零留痕零推送,到人按稳定身份去重;镜像15/15含真git端到端与只加不减形状锁,实跑 state=clean tagged=0 零副作用 (1240b5668d)
- 🐞 修复:对话框内生成的视频能播能存能带走 —— CSP 放行 + 下载走同源代理 (8fbc1bcada)
- 🐞 修复:收口被整块重复的登记(F6 块级判据的修复出口) (d5a2af0683)
- 🐞 修复:结清旁路落地器水印那枚(前提腐烂,接法已在 HEAD 并经实证三场景与镜像钉住) (5628d2d313)
- 🐞 修复:收口被整块重复的登记(F6 块级判据的修复出口) (ee5e49564b)
- 🚀 新功能/改进:输入区显示尚未对账的命令 (1590ef8afa)
- 🐞 修复:更新卡就绪态不再引用本端没有的 appUpdate.body —— 端上现渲裸键 (5f75a80223)
- 🚀 新功能/改进:子代理工具面收窄到父白名单，超预算只回摘要 (5dcfa93b2b)
- 样式源键集对账(门 266): `check-style-key-consumption.mjs`(blocking,`--staged` 判**索引面**;跨文件按名取的键必须在自己绑定的共享样式工厂键集里 —— 治「只暂存样式源、消费面留在未暂存区」被 `check-staged-typecheck` 读成绿而 tsc 真红落进 HEAD;同文件本地 StyleSheet 定义的取用一律放过;两侧同面成对判,源与消费必须同批改)
- 🐞 修复:check-prod-checkout-foreign-work 装未知旗标闸 + 15 例镜像补齐（RP-79 第二枚落地件） (51b66c3a61)
- 🔧 工程/其他:收口本地积压（hook-window-guard/check-ops-patrol/deploy-decisions-face 改进 + 新 prod-checkout-root + desktop checkin_capture + i18n 派生重生成） (21b66ff087)
- 🐞 修复:资讯分类屏按共享屏真实契约接回，此前整屏恒空 (67234f694d)
- ⚡ 性能:face-reader 规格快路径 + git-sync-converge 未知旗闸；收口本地积压 (d6db2333fe)
- 🐞 修复:补回被误删的 localMonthKey/localDayKey —— miniapp 首页 import 悬空,push 门 typecheck 恒红 (26e62feeee)
- 🐞 修复:买 VIP 不再被当成 token 充值白送余额 (1484b7bd9d)
- 📚 文档:登记 RP 族第三票——git-sync-converge 无 --help，未知旗标被当默认动作直接开跑真实索引层收敛（本日实测踩中并留下 16 项中间态，已 reset 清零且证明未进提交）；连同 union-converge 同族一并改为未知旗标显式拒绝并补镜像锁；只加一行不动他票 (5ea3ccc628)
- 📚 文档:登记 RP 族第二票——AGENTS §5b gitdir 形态描述与实测相反（真 gitdir = 工作区外 D:/IHUI-AI-git-repo，现读 .git 为 gitfile），照旧文处置即删库事故；并硬记门 207 余量仅 51 字节 ⇒ 本枚须等长/净减改法；只加一行不动他票 (663b83881e)
- 🔧 工程/其他:落地本地未提交改动（Tauri 桌面端 + 文档重生成 + i18n 派生 + face-reader 超时可配） (33deba819e)
- 🐞 修复:prodCheckoutRoot 装"形态并集回落 + 显式 IHUI_DEVENV_ROOT 不越权"，线上态两条 oracle 不再恒未判定 (e7e35d307da)
- 🚀 新功能/改进:补 mobile-rn 提现两步验证文案（五语） (4de978b0e49)
- 🚀 新功能/改进:提现补两步验证面板（TOTP 注入后自动重试提现） (24a35d957e4)
- 🚀 新功能/改进:提现补两步验证面板（TOTP 注入后自动重试提现） (c46a2c8d8d5)
- 🐞 修复:支付页选券真正落到订单上，余额支付错误不再被兜底文案盖掉 (ff89366a896)
- 🚀 新功能/改进:补小程序支付链三个缺失端点（可用券／选券改价／余额支付） (4c51d614ee4)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (d920a4dec0c)
- 📚 文档:登记 RP 族新票——生产 checkout 根形态遮蔽的另两处收口（deploy-decisions-face prod 候选 / check-prod-checkout-foreign-work 通道 C）；病根已由本日 prodCheckoutRoot 并集回落+覆盖不越权那枚钉死并装上 8 例镜像锁，此票只收口另两处（切生产面读法须与接线方同批验）；G 族短位池 SCAN_FACE_FULL ⇒ 按族表已开的 RP 族取号，只加一行不动他票 (02b2a784bcf)
- 🐞 修复:修复 leading-none 被 --spacing-none 覆盖成 0px 致大字号读数重叠 (207e9769027)
- 🐞 修复:看门狗重放间隔收回 6h —— 重放是"先删后加",缩短间隔等于加曝光窗 (06a8630c648)
- 🚀 新功能/改进:主机审计基线落盘(4688+命令行+脚本块日志)并接入看门狗同轮重放 (2d0f19b33d8)
- 🐞 修复:新登录的 Qoder/Trae 号自动进号池 —— 回灌 missing 支改自动 importAccounts (3528b93ac14)
- 🐞 修复:小程序买课恒报「余额不足」—— 读的是一张没有任何入账的孤儿表 (e6720f4104b)
- 🐞 修复:边界的唯一自愈层迁出产物目录 —— 看门狗与加固脚本进版本管理 (8d0a2d4e129)
- 🐞 修复:钱包全套把「分」当「元」—— 余额多两位、提现少两位、到账永远空白 (4586eeb8aa1)
- 🐞 修复:查词失败整条静默 —— 弹层出失败态并给重试入口 (cf1450635a9)
- 🚀 新功能/改进:扩展查词失败态与重试按钮文案（五语言） (3c52c2dd15d)
- 🐞 修复:两屏选中态前景键仍是错序名 —— 全量 typecheck 红在 push 面,谁都推不动 (0ae18b9b93a)
- 🐞 修复:支付页四格全空 + 课程购买重复扣款 + 订单金额放大 100 倍 (58c4c4a0d00)
- 🐞 修复:登出即失效 + 微信回调防重放 + 按用户限流,并把三项行为钉进测试 (5efcd846aa0)
- 🐞 修复:十屏把后端原因压成一句「加载失败」—— 全部透出 res.error (9f7a4e381ff)
- 🐞 修复:门 26 从卡死 40 分钟变 1 秒 —— 排除 §15b 批准落点 + 加枚举预算 (3f9ee883631)
- 🐞 修复:活动详情加载失败只显示通用文案 —— 透出后端可行动的原因 (e00da95782d)
- 🐞 修复:开发者页「今日成本」按 UTC 日取数 —— 北京时间早上 8 点前显示的是昨天那一窗口 (abfc6f2b7fe)
- 🐞 修复:埋点 visitDate 取 UTC 日 —— 北京时间 0–8 点的访问被记到前一天 (9c383483d78)
- 🐞 修复:管理端"今天/近 7 天"按 UTC 日算 —— 早上 8 点前整片统计错一天;并把业务日收成单一源 (113794c70c8)
- 🐞 修复:支付页在没有订单号时按钮仍可点、页面照常渲染 —— 点了才得到一句「订单异常」 (a44bd304eb0)
- 🐞 修复:佣金日/月汇总按库会话时区截日 —— 未显式写 +08,换到 UTC 会话的库会整体偏一天 (1b08566e175)
- 🐞 修复:课程购买把订单号当 orderId 传给支付页,而支付页只认 orderNo —— 点「立即购买」永远付不了 (c1418894a80)
- 🐞 修复:活动详情不返回"我是否已报名" —— 已报名用户永远只看到「立即报名」，取消入口不可达 (13db09d57c7)
- 🐞 修复:树选择器选中后焦点掉到页面顶部 —— 交还触发按钮 (775a9a35199)
- 🐞 修复:消息页只取前 10 条且没有"加载更多" —— 第 11 条起用户以为不存在 (953d50871fc)
- 🐞 修复:学习周报的 7 天键用 UTC 日、而 SQL 分组按 +08 —— 北京时间 0–8 点的时长恒落在错位的那一格 (3cbd845b038)
- 🐞 修复:多端缺陷修复、i18n/派生产物重生成与新增测试/守卫/SDK (72769534b63)
- 🐞 修复:考勤页按 UTC 切日(北京 0–8 点查到昨天)、今日收益按设备本地日算而服务端按 +08 (4de862f3415)
- 🐞 修复:课程页学习进度被写死 35% —— 进度环、"已看课时/当前课时"与统计全是编的 (f49fc717b62)
- 🐞 修复:树选择器的节点键盘与读屏都到不了 —— 补可聚焦与选用键位 (79a6235cd43)
- 🐞 修复:取面超时不再冒充"判红" —— 两门补 try/catch,统一走 exit 2 未判定 (5bf00f08c73)
- 🐞 修复:trace onError 补 method/url + 补 AGENTS.md 里唯一漏点名的只读尺子(消 R4 存量红) (5b7dcb5e405)
- 🐞 修复:设置页"消息通知"开关只写本机、全仓无人读 —— 用户以为关了推送,服务端照推 (612ffd55800)
- 🐞 修复:设置页三个通知开关拨完只改内存(离开即复位);日志查看器不足折叠阈值时仍是可点按钮 (b88da069e86)
- 🐞 修复:代理失败把上游原文(整屏 HTML/内部 JSON)直接显示到侧栏提示条 (2c7a1c41904)
- 📚 文档:AGENTS.md 体积清偿(110428→94887)+ 安全文档对齐代码现状 (9b7a3f476a2)
- 🐞 修复:代理失败把上游原文(整屏 HTML/内部 JSON)直接显示到侧栏提示条 (0a6a1168c33)
- 🐞 修复:四页下拉刷新只转圈不刷新 —— 关掉没有处理函数的开关 (4393200ed47)
- 🐞 修复:课程页签到/评价/笔记只弹"成功"、一个请求都不发(笔记会丢用户输入) (8396a002da8)
- 🐞 修复:托盘「检查更新」可能整场无反应;树选择器缺展开语义且禁用后面板仍可点 (acff087465b)
- 🐞 修复:相册权限被拒时三屏点了没反应 —— 缺权限前置判断 (272361f262c)
- 🐞 修复:消息页「赞」「收藏」两个分类永远只显示技术错误 —— 请求了一个后端不存在的类型 (2e8d0827934)
- 🐞 修复:修 next build 的 CSS 解析失败(0x1A)—— 把构建产物目录移出 Tailwind 扫描面 (5de6f58c2f0)
- 🐞 修复:交卷后成绩页五项读数全 0、题目回顾空白;优惠券切 tab 双请求互相竞速 (a9d80ed0c18)
- 🐞 修复:"我的"页四张入口卡与收藏夹前三条全是死链,消息中心"互动"tab 还在显示编造的演示消息 (7fac7d5205a)
- 🐞 修复:"我的"页四张入口卡与收藏夹前三条全是死链,点了毫无反应 (7b2c7e8be5b)
- 📚 文档:存续哨兵入档,并消除我自己造出的 §10.9 撞号 (1724d77d3e1)
- 🐞 修复:侧栏闲置后 access token 不再自动续期 —— 续期闹钟的监听随服务工作线程回收而消失 (e3927a3c768)
- 🐞 修复:复活 ApiSlowResponse —— 指标名少一个 _ms,这条告警结构上永不触发 (f6d7dbd58d8)
- 🐞 修复:日历拖拽改期会静默吞掉发布时刻,时间格式又写死中文档 (9a821a58230)
- 🐞 修复:发布分组展开会显示上一组的成员,误点即删错账号;保存中弹层三条出路被同时锁死 (9ce8ae4c599)
- 🐞 修复:PDF 首片空白、直播黑屏永久转圈、上传整批被一个超限文件带崩、发布插图被回吞 (3961c9390e7)
- 🚀 新功能/改进:给源站回源鉴权装存续哨兵(只读尺子 + 巡检派发腿) (e6cd4ca32f6)
- 🐞 修复:兜底闸 enforce 误拦 18 条公开面 —— 逐条按语义补名单(P0) (70d2bba8ebe)
- 🐞 修复:上传"取消/移除"是假的、后台数值留空被写成 0、两处失败静默,外加全站气泡箭头被裁 (1c771ee4fdd)
- 🐞 修复:WS 客户端 baseUrl 统一走 resolveWsApiBaseUrl,修生产同源 WS 无限重连 (f071844acd5)
- 🐞 修复:反馈入口全端死路、订单切 tab 读旧筛选、支付可连点、发布失败静默 (7b95329ba0f)
- 🐞 修复:订单列表首帧整页崩、账号注销 0% 可用、支付记录开出 0 元单等五处 (72d17ce94d6)
- 🐞 修复:买课/交卷/提问/报名四处与后端请求契约错配,外加两处造出假红的工具面 (1ae7d3bd0c6)
- 🚀 新功能/改进:移动端订单详情补三条文案(五语言同批) —— 破坏性动作要能问、失败要能喊 (738b4492d56)
- 🐞 修复:提现页接上真实校验原因与余额上限,会话历史搜索改走服务端 (3e505b8b8f2)
- 🚀 新功能/改进:提现页补四条校验原因文案(五语言同批) —— 报错不得再只写字段名 (aeef0ecc26e)
- 🐞 修复:深度排查前端缺陷第二批 —— 注销/2FA 关闭补请求体,富文本三连,失败不再冒充空态 (f0a0ffa77b8)
- 🔧 工程/其他:移除 knowledge 鉴权里的推断性注释(500 已定位为生产副本未更新) (82fe24c50f4)
- 🔧 工程/其他:对齐 TOTP 默认档钉子到 enforce —— 修一条已入库的红测试 (20bf9852703)
- 🐞 修复:服务清单器三处裸 $n 内插根修(RegistryKey.ToString() 返 HKEY_LOCAL_MACHINE 全串⇒真服务全 continue,修前 exit 0 而 services:[])+§0.3「枚举到0个⇒exit 2 未判定」硬闸(T| 分三种0)+生产者形状锁 bareRegistryVarHits;自检 20/20 含改回必翻红成对对照;本机现读 3 枚在册服务零入库真相源,反向 8 枚仓内点名本机不存在 (13c78b14fc2)
- 🐞 修复:登记表 4 条抢键条目 rn 置 null —— 撞键 5 组收到 1 组,3 个路由名改回真渲染者的页 (b608ba35c3c)
- 📚 文档:补回上一枚被 bash 命令替换吞掉的门名(守门133 check-i18n-locale-content-language)——反引号串在双引号里被当命令执行,文件名成空 (892b1ff31f6)
- 📚 文档:更正 §19 假陈述——CJK三族互判与同名自套两层"现无门/人工必查"不成立,守门133 check-i18n-locale-content-language 已 blocking 装车(runner:3737);依 g34-s6 一手读数 (41a0dcebb42)
- 🐞 修复:结清 G-37 三件事(35枚JSON parse全OK+四道i18n门全绿+CJK互判/同名自套真命中0;133已装车判这两型;看门狗与构建指纹双向消费均在HEAD)——同行清除F11禁桶措辞 (dbb46a7792f)
- 📚 文档:把 SDK 票漂开版的两个独有记号折进当下行(G-23 与释放注记) —— 为归并做零丢失前置 (55877ff48d9)
- 🐞 修复:结清G-16(别名+类臂两维已落地)/G-14(svc run脚本已入库+E1真装audit)/G-07(清偿器落地前自查已接)/Esc层栈协议5份副本(单实现+50消费方+23用例+CI 692通过) (d6a4f00558e)
- 📚 文档:给24枚占位符作用域票补出真实落点(只搬票面正文已点名、但未加反引号且在HEAD存在的路径,零编造)⇒ 派单器可对它们发互斥合格证;勾选/租约/归属三维逐行不变 (93e0ae4653b)
- 🔧 工程/其他:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (d2269d7feab)
- 🚀 新功能/改进:hook-failed 帧契约 + api-client 解析 + store 落桶(G-87 补链,端侧半) (f41cdcad580)
- 🔧 工程/其他:块级窗口判据主文件 prettier 格式对齐(语义零变化) (f745178ed83)
- 🔧 工程/其他:test (eb848ead6b8)
- 🔧 工程/其他:b76-15 三文件 prettier 格式对齐(语义零变化) (be7ba525d55)
- ♻️ 重构:孤儿护栏一接一退 —— check-immutable-guard 补 --audit-new(每枚判恰好一次,六态封闭)由 git-guardian 旁路派发(5min 节流/breach 才到人,不挂提交链不堵门);check-guardrail-hashes 退役(与 root-guard 同三目标同机制、基线件从未入库致 --verify 恒 exit 2,接线即 §0.6 重复实现装上车) (b2c05e4493a)
- 🐞 修复:gen-rn-compat --write 重写 route-map 时 100% exit 2 根修(共享树瞬时句柄争用 errno -4094 不重试且把原因截成命令本身)⇒ 走 lib/atomic-write 唯一出口+退避重试+回读自证 payloadIntact+stderr/errno 点名;镜像 N1-N5,15/15 (b4bb4d01d70)
- 🔧 工程/其他:路由表随登记面重生成 + RN 测试替身收两处局部复刻 + 硬编码中文基线下调一枚 (3b76e9adf5b)
- 🐞 修复:有意还原被 9fdbc207ba 当残件删、6d0dbde7c9 只带回消费行的门234纪元声明面 ⇒ --staged/--worktree 不再 ReferenceError(此前 blocking 门在 pre-commit 面等于不存在);恢复 A1 身份维+孤儿 identity 形参接回 judge;侧车签名折算按取证收掉(接回即造 rotn=17 假阳恒红);回归锁:真跑 --staged + 变异反证,镜像 17/17、自检 26/0 (d17a1f6c74f)
- 🐞 修复:前向重放首页收口那一刀 —— 它被 ffbe506f9e 的整文件重放抹掉,商品族堆叠在 main 上已复活 (e118488e7a0)
- 🚀 新功能/改进:「已 accepted 未投影」账本 + 空响应权威答案兜底 (02bdf74496f)
- 🐞 修复:结清11枚已实现票(告警去重身份/票60多窗格/G-878原生弹窗/D11语音barge-in/G-1222556 CSRF形状/成本熔断/影响面隔离/进化回流/监控大屏/O68就绪门 等,g33 t2t3逐条一手凭据) (e7f79cf7aef)
- 🚀 新功能/改进:帧水位事实上报的端内唯一消费点接线(对标 Qoder 借鉴清单第 6 项) (fc66ffaf0d7)
- 🔧 工程/其他:侧车经三条官方出口整份重建(258→155行):--dedupe 60条同键多份→--retire-orphans 43键退场(28条逐字留痕)→--reclassify G-115改归机主git收敛面;rot 58→40/conflict 40→0/dup 6→0/blind 5→0;非手改jsonl,逐行处置见 g33-s10 报告 (68029830b1b)
- 🐞 修复:登记表 17 处 rn 错写批量回正 + 补一条两代屏共用映射 —— 小程序 15 个路由名从"点了不动"变可达 (5aebbb02a83)
- 🐞 修复:结清不可变护栏(root-guard已fail-closed接部署环)/B02(双轴+review+sse契约四落点齐) (86bb156b212)
- 🐞 修复:结清 B03(双轴类型+consumers+守门68对账齐)/G-965(投影与强制档均已落,门234已blocking) (7d8ec7325f4)
- 🐞 修复:结清四票(207第二刀declaredDropCaps已接/G-1222558四格已达成/68-RN腿三函数同值/圆角基线前提腐烂) (eb87981ee5e)
- 🚀 新功能/改进:帧水位接成有生产点的完整腿 + 静态长文档块级虚拟化（对标 Qoder §2 / §6.6） (efcb3c85735)
- 🔧 工程/其他:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (f72df75e510)
- 📚 文档:摘除 SDK 票同题跨号重复登记副本(代裁) —— 它正挡着全仓推送收敛 (afeb6ed2988)
- 🚀 新功能/改进:补 ai.pane.hookFailures 五语言词包(38 键 x 5) (ffdf6e88079)
- 🔧 工程/其他:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (888be1ba64a)
- 🔧 工程/其他:重封 root-guard 清单到已入库的 guardian-runner 内容 —— 三处签出的部署环此前全部 fail-closed (58f51477c1f)
- 🚀 新功能/改进:补 ai.pane.hookFailures 五语言词包(38 键 x 5) (40206d8ec6b)
- 🐞 修复:装悬空提交备份腿到弃落出口(四台落地器共用一份 lib)—— 门 30a 存量从此有排水口 (4468747144b)
- 🐞 修复:折叠漂开副本族(N→1,认领合并到保留行 + 逐字留痕;--fold-drifted-families) (cd90c6ea1d0)
- 🚀 新功能/改进:视频卡片补齐 分享/复制链接/下载 三个动作 —— 对话框内媒体产物可带走 (06b0c509188)
- 🐞 修复:注册页倒计时改走取词 —— 此前 en/ja/ko/zh-TW 用户看到的是"12秒后重新获取" (7a25781c112)
- 🐞 修复:结清 G-706 —— apps/cli/src/worktree.ts:570-576 已用 mkdir EEXIST 当原子互斥(不做 existsSync 预检关 TOCTOU),marker 齐备 reused:true、不齐证明不了即保留不删 (5bfdae44b73)
- 🚀 新功能/改进:对标 Qoder 借鉴清单第 9/10 项 —— 准入回执配对(inputId)+ 命名错误码分类处置 (ef471e56a9e)
- 🐞 修复:补齐端内在用而词包查无的 8 枚键 —— 这些界面在非中文语种下一直出中文 (fe13f15ab80)
- 🚀 新功能/改进:跨端生成器对同 rn 撞键出声 —— 静默后写覆盖从此可见 (6e712dc3ef8)
- 🐞 修复:幻影漂移对齐补"活工作二审"—— 恢复历史内容不再被当陈旧副本回滚 (aac2e1af870)
- 🚀 新功能/改进:hook 执行失败六态卡接车（数据面待接） (fe687a03820)
- 🐞 修复:回补误摘的 G-322 行(该票未完成:旗标单源已接的 11 文件已满探针,另 77 站待迁) (ab52c91d87f)
- 🐞 修复:结清 O01(对照面空判未判定)/G-79(38枚红现读全绿)/G-927(票面9枚已清零,新增21枚另记) (a079c9d7c46)
- 🐞 修复:check-task-claims --twins 对照集为空时落「未判定」exit 2(不再把"没得比"报成已清零)+ twinsFace 键 + T26/T26b (7406e957481)
- 🔧 工程/其他:清两族存量测试红 —— skills-market 的 mock 层错位 + 块合并用例沿用旧判据 (65654e57cd6)
- 🚀 新功能/改进:语义折叠策略 + 工具摘要计数上屏(对标 Qoder 借鉴清单第 4 项) (66cf1b45b27)
- 🔧 工程/其他:补齐 plan-fields-project --emit 坏值探针(11/11 全覆盖) + G-79 38 枚红逐条复检取证(现读 514/515 绿,唯一失败不在票面) (b8949cf8d75)
- 📚 文档:供应商名单补 xai —— 名单项数与计数 18 长期不符,补上后自洽 (3d2895666d2)
- 🐞 修复:前向修复 9fdbc207ba 整树收编事故 —— 恢复两条被删能力 + 收口 19 处裸 create_task (cd5339a7607)
- 🐞 修复:结清五票(G-926 ignored雷区已清零/D42046审批重放A档已落/monitor面板/O87g守门8/上游模型双写对账) (eb28653c902)
- 🔧 工程/其他:补 @ihui/shared 子路径别名与替身出口 —— 六枚套件从账面通过变真跑出用例 (f1560a322ec)
- 🚀 新功能/改进:上游模型登记器与 workbuddy 同步器双向归属对账(跨路径 provider 抽取 + assertOwnership 前置守卫 + 只读 --check) (cdef20f80d3)
- 🚀 新功能/改进:三处「造好没装车」接上生产渲染路径 (15cd3b6eb32)
- 🔧 工程/其他:摘除两枚误入库的工具会话导出附件(1.8MB,含凭据行;工具产物不入库,盘上副本保留) (34036e6a83d)
- 🚀 新功能/改进:十态轮次状态徽章接线 + 错误码目录首次进屏幕 (651cb924c0b)
- 🐞 修复:结清 45 枚前提腐烂/已实现票(批3/3,g30 七席只读分诊逐条一手证据) (2d2bceb2c2a)
- 🐞 修复:重生成小程序路由表 —— 商店跳板回正,并补出 Home/HomeMain (b439ca6e69d)
- 🐞 修复:结清 46 枚前提腐烂/已实现票(批2/3,g30 七席只读分诊逐条一手证据) (13b4f3b3603)
- 🐞 修复:结清 46 枚前提腐烂/已实现票(批1/3,g30 七席只读分诊逐条一手证据) (900afc860c4)
- 🐞 修复:小程序路由表把「AI 应用商店」错指到首页镜像壳 —— 登记表 rn 撞号根治一枚 (8fa01c3233d)
- 🚀 新功能/改进:中文全角括号 autolink 修正 + Diff 过期诚实说明 (3f9d52d6443)
- 🐞 修复:副本归并器物有意还原 1fe3a2b42d 对 plan-copy-row-purge 的 -790 行回退(④c 判据层,HEAD 测试 SyntaxError)+ 接线 21/21;修正 s12 测试件重复函数名 (65f63112c2d)
- 🚀 新功能/改进:中文全角括号 autolink 修正 + Diff 过期诚实说明 (d9aa4637b22)
- 🔧 工程/其他:更正跨端对账基线里 IntelligentAssistant 豁免的叙述 —— 生产调用方 4 枚减为 3 枚 (48c9c5545ad)
- 🔧 工程/其他:摘 home.recommendCourses 五语言 —— 首页横向推荐列表已下线,键随之零消费者 (0c935a0192f)
- 🐞 修复:取消信号穿进 hook 调用点 —— 有意还原 9fdbc207ba 当残件删掉的两处 _wait_interruptible 包裹(969d74b9a6..HEAD 对该文件仅 9/32 行差异,已逐行核对) (8a8ff1f65fe)
- 📚 文档:鉴权兜底闸已切 enforce，补记 12 条裸奔发现与蓝绿踩坑 (6df1c8efdc3)
- 🐞 修复:enforce 档抓出的两条合法公开面补进名单(app-version / news) (1a55dab48d6)
- 🐞 修复:删除 relay-account-pool-worker 重复的 runTraeSessionSync 导出 (8176b5c52a6)
- 🐞 修复:兜底闸不得二次 send —— 修 /api/knowledge 匿名访问 500 而非 401 (83359d53964)
- 🐞 修复:补全鉴权兜底的公开名单并给 enforce 档留痕 (45e7f7ba552)
- 🐞 修复:语音输入条两枚圆角收成同档 —— 小程序腿此前比 RN 腿各粗一档 (57c98b75a33)
- 🐞 修复:恢复被 d801061d98 误回退的文件(fixup,保留后续正常提交与本票 5 文件) (a598eb0f656)
- 🐞 修复:底部胶囊的毛玻璃模糊半径收成单一源头 —— 两端各写一份 24 靠注释对齐 (5493867cd72)
- 📚 文档:鉴权兜底闸已以 observe 档上线，更正'未做'记录 (05e0e309c3f)
- 🐞 修复:observe 档上线即抓到 GitHub webhook —— 补进鉴权兜底的公开名单 (6774a82ebfb)
- 🔧 工程/其他:补齐三个边缘守卫文件的溯源水印 (aa98aab816d)
- 🚀 新功能/改进:鉴权默认拒绝兜底闸(onRoute 追加,默认 observe) (e876ad8f6c3)
- 🔧 工程/其他:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (cb284b0b0ab)
- 🐞 修复:消掉上一枚落地后复跑暴露的三处简体残留 —— 否则这道门就是我造的恒红门 (c306cfaa2ab)
- 🐞 修复:底部胶囊的 Android 真模糊强度调到可见档 —— 接线补齐后仍看不出模糊 (57dd6758c55)
- 🔧 工程/其他:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (b7f6a030176)
- 🔧 工程/其他:把 ruff/mypy 两面存量红(19 + 4)清到 0,让号池之外的 Python 门重新有牙 (2b981bd839a)
- 🐞 修复:修 feature-center i18n 键缺失并补 ui-react work-panel 预留属性 (63efdcfb6c8)
- 🔧 工程/其他:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (b06c8b01c79)
- 📚 文档:防病毒已装并用 EICAR 实测、守护自拉起腿已补 —— 两格闭环 (2feee1ff75d)
- 🐞 修复:修 feature-center i18n 键缺失（开发仓对齐生产仓） (a412a16e56e)
- 🐞 修复:补齐 checkpoint 回退入口与 tool-summary 帧的两个缺口(全量 typecheck 归零) (909ae74411c)
- 🐞 修复:secure-store 存量令牌一次性迁移 —— 修复后不必重登 (1b84801d416)
- 🐞 修复:小程序端词包补 pdfToolsPage —— 这一屏渲染得出,但它每句话都取不到词条 (59a760a6036)
- 🐞 修复:Trae 切号不再按映像名全杀进程 (3f598e351d2)
- 📚 文档:自动同步缺口账本到现读口径(镜像 260 · 缺口 11) (28283deb244)
- 🔧 工程/其他:把 apps/api/scripts 装进 typecheck 射程,并清掉这面 35 枚从未被看见的存量类型错 (1362cec462e)
- 🐞 修复:dev-stack 重入锁 + 重拉冷却 + pid 文件删除收紧 —— 治三条腿反复「重拉失败」 (899b6855417)
- 🔧 工程/其他:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (c9ab7153bca)
- 🐞 修复:secure-store 回潮重放 + 三屏模糊接线 + 两处 View 直挂裸文本 (ffbe506f9e3)
- 🚀 新功能/改进:补 daemon 档自我存活兜底腿 (cca0a95e4f6)
- 📚 文档:补记 2026-10-29 二轮加固(未授权面/本地文件面/边缘 IP 身份) (4d3f14ea770)
- 🐞 修复:本地文件面收口(任意文件读/任意目录删/跨用户上传) + TOTP 默认升 enforce (1ec1beea63a)
- 📚 文档:账本追平 —— PDF 工具台从未判定转已承载,缺口候选 10→9 (7758eabfeee)
- 🐞 修复:选中态样式键写反了 —— HEAD 面既有的类型红,不修则 RN 包谁都推不动 (bd41560d839)
- 🐞 修复:结清 web api 壳迁移票——主体234份已在HEAD(349e116a66),末枚admin/sms/operations已迁 (9b30e5b362d)
- 🚀 新功能/改进:侧栏补 /tools/pdf 入口(重放版) (c148782a0a6)
- 🔧 工程/其他:ui-routes 产物追上 app.config(重放版) (20c2d8755e6)
- 🚀 新功能/改进:给 PDF 工具台补入口 + ui-routes 追上(重放版) (d2f1080548b)
- 🐞 修复:镜像构建上下文排除真实密钥,并钉住规则不被删/不写错模式 (c860842563c)
- 🚀 新功能/改进:PDF 工具台全链落地(页 + 路由 + 入口 + 判据 + 派生) —— 重放版 (6e3584b69f9)
- 🚀 新功能/改进:web 侧栏补 nav.pdfTools 五语言(重放:上一版被并发 ref 移动挪出 main) (23151831409)
- 🐞 修复:智汇AI 首页收口 —— 同数据源堆叠与随之失效的死码一并清掉 (55c75ae60bd)
- 📚 文档:闭环源站收敛待办并登记主机侧三项加固 (b3773937d93)
- 🐞 修复:侧栏滚动淡出遮罩双层错修复 —— 它从来没显示过 (e3daebc7f64)
- 🐞 修复:边缘 IP 归一再补隧道腿——cloudflared 回环对端采信 CF-Connecting-IP (ad802698dfe)
- 🐞 修复:边缘 IP 归一再补隧道腿——cloudflared 回环对端采信 CF-Connecting-IP (daf8856aa26)
- 🐞 修复:成本面/调度状态面进入永不公开名单,收回 .env 白名单漂移 (433df6460d1)
- ♻️ 重构:收尾最后一枚 api<T> 委托壳 —— admin/sms/operations 迁 apiOrThrow(web 本地 api<T> 声明归零) (7ac88bb579f)
- 🚀 新功能/改进:僵尸弹窗与撤销轮次两键五语言词包 (e13b707b2b2)
- 🐞 修复:/chat/abort 清除 conversation.metadata.pendingQuestion (5c1bbb7c02f)
- 🐞 修复:补 memory.refresh 三方 parity 漂移 + 承接上一枚提交信息事故说明 (79d47138857)
- 🔧 工程/其他:-- (bf5355699b1)
- 🐞 修复:账本生成器补上"写盘后紧随注入"这条腿 —— 并把被我自己洗掉的载荷落回去 (1414862c108)
- 📚 文档:清偿 13c 归档器的文档↔代码脱节(4 文档 44 行)——文档在号召恢复退役件,这才是回潮的驱动力 (40c9ab3e53b)
- 🐞 修复:补齐守门 52 存量 22 处 visible-spawn 缺 windowsHide —— 11 个文件全纯追加(零行为变更) (7c624aa2244)
- 🔧 工程/其他:recover docked-browser panel wiring + cross-panel revealAt/CodeEditorHandle + ticket-60 pane chat-store addressing (d801061d983)
- 🐞 修复:后端工具名单从前端真相源派生 —— 消除第二把尺子与存量漏计 (a06099ba765)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (15eaa6f61cf)
- 🐞 修复:回灌腿补归属闸、任务中心断链修复,并把 WorkBuddy 第三条腿真正装车 (c3d5b63ca53)
- 🐞 修复:secure-store 探测改同步取模块 —— dev bundle 的 lazy chunk 404 让刷新令牌永远落不了盘 (87a16d748a7)
- 🐞 修复:给守门 26 的存量开一条排水口——清扫器新增具名族 parent-pollution-strays(判据 import 门体,不抄第二份) (c86f69d8e1b)
- 🔧 工程/其他:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (e0acf77c41f)
- 🐞 修复:「我的」页菜单去掉重复的收藏入口 + 三组同屏撞名文案区分 (3dc363cd824)
- 🚀 新功能/改进:落 RP 族 RP-1 首行 —— 26 枚「未取号」票的迁移与文案改正线 (c842abf2b7d)
- 🐞 修复:「我的」页菜单「会员中心」撞名 + 抽屉键错位 + 底部条目被淡出遮罩压暗 (3ac7b5859be)
- 🚀 新功能/改进:工具摘要三档维度五语言词包(directories/edits/terminalCommands) (1dfe9bb1320)
- 🚀 新功能/改进:活动级几何虚拟化 + 工具摘要三档维度补齐 (80d97436e2b)
- 🚀 新功能/改进:轮次呈现投影层建立并装车 —— 消灭「造好没装车」 (1f3e7bd27b0)
- 📚 文档:账本追平现读 —— 并交后手一条取证结论(小程序缺 PDF 工具台 hub) (b38b4a3e8b0)
- 📚 文档:结清最后一条 gap chat/workbench —— 工作台在 RN 与小程序都有了承载 (c36f4b71a82)
- 🐞 修复:增强跨端无硬边淡出遮罩强度 (dd34b4bbfa2)
- 🐞 修复:屏幕侧配对前景键词序写反 —— filterChip/chip/tab 三键按样式工厂约定回正 (876c4cb4183)
- 🚀 新功能/改进:跨端驾驶舱接上唯一调度器 —— 它自述"全自动管线唯一入口"而全仓零调用点 (b8dc9e31543)
- 🚀 新功能/改进:D05设计稿落地现状对齐 + 清偿器补守门130落地前自查(F4/F4b/F9三维,g30 s9/s2) (316beddb12d)
- 🔧 工程/其他:登记会话导出件族豁免 —— 门 47 缺口归零 (599baad8fa9)
- 🐞 修复:补回富文本锚点 link 族的 <a href> 渲染 —— 事故提交 9fdbc207ba 把 renderLink 当残留删掉导致 role=link 全失效 (8fa512f9bb2)
- 🐞 修复:拆掉 shared 包内自引造成的循环依赖 + 两个根 tab 多出来的返回键 (e648811e636)
- 🐞 修复:修复 spacing 受管块压塌全站 max-w 命名档 —— AI 面板 32px 塌缩回归 (4394b6b4907)
- 🔧 工程/其他:壳声明件跟随新落承载页(176 条说明符) (b35015da09a)
- 🔧 工程/其他:自动落 1 枚小程序壳承载页(共 1 枚待产) (a62494c34dc)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (20dc73c8283)
- 🚀 新功能/改进:补 chatWorkbenchPage 五语言词组 —— 聊天工作台共享屏的取词面 (c0ce5eb4b88)
- 🔧 工程/其他:goal-b25 结清四票并补 G-07 进展注记 —— 门8未判定桶/F9判据/基线差值矛盾/滞台副本末枚 (427938a5868)
- 🚀 新功能/改进:落聊天工作台共享屏 + RN 薄壳 —— web /chat/workbench 的移动端承载 (dd5d0475feb)
- 🔧 工程/其他:为同批误删恢复件 background_tasks 两枚登记保留裁决 —— 尺子的红线该由证据裁,不该由再摘一次消 (689b98ef7ed)
- 🐞 修复:驾驶舱补上漂移哨兵这一维,并让"部分覆盖"不能冒充合格证 (4dfcfa7d516)
- 📚 文档:结清 student/my-resources —— 数据面真补上了,原 gap 的前提已不成立 (b9f69fc4ef1)
- 🐞 修复:智汇AI 首页移除与 AI 应用商店重复的四块内容 (f571b65018d)
- 🐞 修复:结清 L28260 api-client 假绿灯票——判死现读 0,清账链 bd5ce8a101 已在 HEAD (a7815297205)
- 🐞 修复:部署环 ff 竞态锁正则跟上实现演进 + 门 11h 评分星补实心填充 + 水印复注 (2c6838d1690)
- 🔧 工程/其他:壳声明件跟随新落承载页(175 条说明符) (e3ddff14d59)
- 🐞 修复:结清三票(G-109四格全闭合/G-924死键已清零/G-689 stderr尾缓冲已装车) (5d9d115a2f0)
- 🐞 修复:结清两枚前提腐烂票(dot-source传递闭包3d31e4c499已装车/六屏下沉411646ee58等已全量) (13c1bdaec1f)
- 🐞 修复:结清 L5646 门116型B行——前提已腐烂(该文件裸git派生实测0,清偿枚949195bcb5早已是祖先) (b8ede2328ef)
- 🐞 修复:重放被回潮抹掉的「我的创作」入口迁移 —— 底栏上方那块常驻嵌套块 (1fed27283b5)
- 🐞 修复:目录级 index.css 被当成每页伴生样式 —— 修判据并恢复被误升级的「领券中心」页 (99e58a986c7)
- 🐞 修复:合并留下的重复 const 把 Trae/Qoder 两条回灌腿一起炸了 —— 修脚本并补上 scripts 目录的可转译锁 (cecb7d460ea)
- 🐞 修复:首页输入框占位文案收短到单行 —— 原串在 360dp 下折行，第二行被 48dp 外壳裁掉 (3e70039dd0f)
- 🔧 工程/其他:摘净回潮尺子至今仍点名的两枚死副本 —— keepalive router 双份 + 孤儿 SDK 单文件 (082523e385e)
- 🐞 修复:守门 8「前缀假设」收口为三态可判 —— 未判定桶 237→0、孤儿路由变异自证修前绿修后红 (255275c277e)
- 🐞 修复:落地 background_tasks(spawn 强引用登记处)—— 修 main 上悬空 import (f7d269568cf)
- 🐞 修复:恢复 WorkPanel 被 9fdbc207ba 删除的第五组 props(主页/点选/开发者工具/独立窗口/常显停止) (f33f7b82a3f)
- 🚀 新功能/改进:跨端无硬边滚动淡出遮罩 (RN 底部 / 小程序底部 / Web 侧栏) (1be5a68ad81)
- 🐞 修复:F9 撞号判据收窄为「同号 ≥2 未勾活行」—— 已完成历史行与单活题面退出判红面 (d09c9d2bc72)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (940fda0cba9)
- 🐞 修复:补回「清理功能回退残留」删掉的四组功能面(并集恢复,零整文件覆盖) (60668e4c253)
- 🐞 修复:补 stable 非纯追加时的换代处置 —— 真浏览器验证发现的判据射程缺口 (865460dfa39)
- 🐞 修复:折叠漂开副本族(N→1,认领合并到保留行 + 逐字留痕;--fold-drifted-families) (1242b2b5e9b)
- 📚 文档:摘 2 条已被现行判定取代的旧 gap 行 —— gap 全集从 4 收到真值 2 (179334406c4)
- 🔧 工程/其他:第二次摘除 miniapp-end-capabilities 与 tip-metro-guard —— 并发归并把本票第一次摘除反向抹回 2 枚 (32d79e0c8f0)
- 🔧 工程/其他:-- (bf5355699b1)
- 🐞 修复:收紧知识库归属——/api/knowledge 全插件强制登录,归属只认凭据 (ca1775aa7e5)
- 🔧 工程/其他:新增变更B边缘IP透传端到端链路测试 (1a9f2ba2ba8)
- 🔧 工程/其他:将 app/core/background_tasks.py 纳入版本控制防丢 (3c6419bf020)
- 🐞 修复:去掉收敛归并留下的三处重复导出(ExpertAutoRouteMode/ReviewFindingEvent/ReviewFindingSeverity) (b4c26c122e6)
- 🔧 工程/其他:security：闭环变更B边缘IP透传并补API响应安全头（变更C） (79e830ba981)
- 🚀 新功能/改进:折叠语义例外集压过三维阈值 + 连接器分组从零消费者接成生产形态 (b5d9861d416)
- 🐞 修复:并集补回 api-client 的 D09/D115 类型与发送链参数、web 发送链的窗格 store 参数 (5c20fb78ed4)
- 🔧 工程/其他:T3 阳性对照窗口 300→40 —— 正控不变而镜像测试从 215s 降到 70s (af58e0f5a6d)
- 🐞 修复:修 RN 端两处——一处编译不过、一处文案印成键名原文 (53c1dfb0a43)
- 🐞 修复:miniapp 路由件改按 HEAD 面隔离树重算 —— 上一枚追平把他人未提交的输入烘进了自述钉 (230a8b3da2e)
- 🔧 工程/其他:三族派生件同枚追平（路由×2 + 离线包×4 + 声明件×3）—— 本票新落的镜像页与壳把它们顶 stale (51cfd40aa99)
- 🐞 修复:12 份文件补齐溯源水印 + 两处 lint 修正 (9725a9113fe)
- 🔧 工程/其他:壳声明件跟随新落承载页(176 条说明符) (3e3497502cc)
- 🚀 新功能/改进:装出「逐字回潮」这道尺子并挂上常驻班次 —— 单父嫁接绕过钩子这一族从此有人看得见 (47d6d441aff)
- 🔧 工程/其他:自动落 1 枚小程序壳承载页(共 1 枚待产) (3f45c3f9438)
- ♻️ 重构:云运行壳与共享屏同名（CloudRunsScreen）—— 让自动造页腿能认出这屏并给小程序端产出镜像页 (b676679d7a2)
- 🔧 工程/其他:兼容层图标集按现算补 Cloud —— 新共享屏 CloudRunsScreen 把它带进了消费面 (1a54e3d07de)
- 🔧 工程/其他:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (f223a88eeae)
- 🔧 工程/其他:给 carrier 7 枚带回件逐条登记裁决——回潮必须留下「谁判过、依据是什么」 (806ded2afa0)
- 🚀 新功能/改进:云运行屏提进 packages/app + RN 薄壳与导航登记 —— 结清 RN 端该内容域零承载 (2f6d6b266fa)
- 🚀 新功能/改进:mobile-rn 端包补 cloudRuns 命名空间 24 键（五语）—— 为「云运行」共享屏供词，措辞一律取自 web (7a0a0ab71e2)
- 📚 文档:给门 89 的 R4 补上 check-web-portal-label-keys 的点名行(走对象空间,不吃别席的行) (0b6f24f7297)
- 🐞 修复:消掉门 89 的 R5 撞号恒红 + 回补门 237 被无关提交洗掉的 996 行版 + 换掉一把会替人下因果结论的坏尺子 (3ef804fc3f9)
- 🔧 工程/其他:撤销 1442baa1e0e 的整条移除——补回运营商一键登录的注册腿与消费腿 (b09e82f82c8)
- 计划/台账: `check-plan-dup-pointer-ratchet.mjs` `check-plan-sha-resolvable.mjs` `check-plan-sha-form.mjs` `check-baseline-freshness.mjs` `check-agents-doc-size.mjs` `check-plan-id-pool.mjs` `check-plan-closed-stock.mjs` `check-plan-claims-vs-head.mjs` `check-plan-archive-monotonic.mjs`(门 239,2026-10-24 由撞号 237 改号;已归档✅票复活成未勾活行/逐字孪生回插即红,stagedTriggers=PROJECT_PLAN.md) `check-live-doc-archive-reinflation.mjs`(门体已造、尚未纳入 runner 注册表) `check-task-claims.mjs` `check-plan-fields.mjs` `check-sweeper-liveness.mjs`(2026-10-23 立:清扫背离巡检只读探针——派发在动 ∧ 留痕静默 >2h ∧ 可清存量 >0 ⇒ 器物空转;不走提交链,派发层 = git-guardian 的 `auditSweeperLiveness`)
- 只读尺子/哨兵与判据源(R4 补点名 2026-10-31;逐条判据、自检例数、跳过变量见各门体头注,此处只尽点名义务):
`check-aasa-public-health.mjs`(AASA 两腿公网可达且与单源同构,只读哨兵,6h 轮)
`check-analytics-page-coverage.mjs`(埋点覆盖面只读尺,连不到库 exit 2)
`check-asset-path-health.mjs`(受管 `.env` 绝对路径可达性 + 证书到期,6h 轮)
`check-cross-end-spec-coverage.mjs`(跨端视觉原子 spec 覆盖率棘轮,`--ratchet`)
`check-ddos-guard-wiring.mjs`(DDoS 防护接线对账)
`check-e2e-coverage-gap.mjs`(射程内模块无对应测试,warn 差值棘轮)
`check-gate-triggers.mjs`(注册门缺 `stagedTriggers` 射程)
`check-lint-staged-stdio-pin.mjs`(只读盯 `patch-lint-staged-stdio.mjs` 三针在位)
`check-live-doc-merge-recall.mjs`(普通 merge 把已结清登记行带回的探测,接 `.husky/post-merge`)
`check-miniapp-mirror-fidelity.mjs`(小程序镜像页还原度对账,CI `--base` 问责腿)
`check-mjs-export-resolution.mjs`(`scripts/` 相对具名导入必须真存在于目标出口面,D1/D2/D3)
`check-origin-guard-liveness.mjs`(源站守卫存续哨兵,只读)
`check-plan-truncated-rows.mjs`(台账残行只读尺 + 基线棘轮)
`check-prod-dep-advisories.mjs`(生产可达 critical/high 必须为 0)
`check-rn-compat-coverage.mjs`(小程序复用共享屏源的覆盖面对账 C1/C2/C3)
`check-ruff-python.mjs`(Python lint 接进提交链,pin 唯一源 `apps/ai-service/pyproject.toml`)
`check-web-rn-screen-parity.mjs`(web→RN 功能覆盖账本,只读报表)
- 后端装配: `check-api-route-uniqueness.mjs`(门 269,2026-10-31 立:同一 `(method,path)` 被注册两次只在 Fastify 装配期抛,提交链零判据 ⇒ 本门按 `METHOD 对外真实路径` 判"≥2 个不同站点",`--staged` 判索引 blob、差值棘轮只拦新增、三档剔除(fallback/动态前缀/内联别名塌陷)报数不判红;判据单源 `scripts/lib/api-route-uniqueness.mjs` 复用 `route-registration-extract` 挂载图,零复算;跳过 `HUSKY_SKIP_API_ROUTE_UNIQUENESS=1`)
- 跨端/产物 CI 问责(2026-10-31 接线): `check-miniapp-build-artifacts.mjs`(小程序产物结构对账:入口三件套/页面/分包/tabBar 引用全在位,构建产物只在构后存在 ⇒ CI 构后是唯一正确落点) `check-mrn-vitest-mock-alias-surface.mjs`(mobile-rn vitest 手写替身面观测,按门体契约恒 RC=0 只报名)
- **预测式编辑(对标 Trae CUE)**:编辑意图预测器(服务端三态 suggested/no_action/undetermined + 结构化动作 + 重叠区间冲突与锚点内容比对)· 聊天输入区与编辑器内建议条双场景 · 逐条勾选选择性应用 + 悬停区间预览 · 接受率按 model×scene 分桶看板
**2026-10-31**
- 🚀 新功能/改进:预测式编辑建议条五语词表(编辑器场景 CUE 对齐批次) (9c9e338469)
- ♻️ 重构:门户维收敛候选集编排抽成纯函数,段级族可被构造面钉住 (182440479b)
- 🔧 工程/其他:派生产物按最新 HEAD 面重生成 —— 补 webViewPortal.artifacts 词条,离线包与两枚路由钉同步 (bdd9129d40)
- 🐞 修复:qoder 导入补齐会话模板 —— 模板此前在导入面被静默丢弃,池票永远 tpl=NULL (185987e308)
- 🐞 修复:rn-compat 图标出口按 HEAD 面重生成 —— 补 ListTodo/MonitorSmartphone 两枚,门 251 C2 缺口清零 (16124c3b04)
- 🐞 修复:清偿门 39 三条 HEAD 存量红(0e875130c0 旁路落地带回的未迁移形态) (577b3364ac)
- 🚀 新功能/改进:web→RN 对齐链最后一枚缺口 artifacts 清零 —— 产物中心进 web-portal 门户(两端 WebView 承载, sso cookie 链路) (6ff6f36887)
- 🔧 工程/其他:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (b88b1080c5)
| **切号携对话闭环 CLI**      | `pnpm relay:login-local-verified -- --provider <code> [--uid] [--dry-run]` | `apps/api/scripts/relay-login-local-verified.ts`(2026-10-30 立,2026-10-31 收口):一条命令完成「池里选票 → 切号前拍连续性快照 → 池票写回本机客户端(关端/写/拉起,写前同目录备份)→ 切号后再拍 → compare」;**本地正库对账面八平台** qoder/minimax/codex/zcode/opencode/workbuddy/codearts/loomy(平台全集与 `check-switch-continuity` 同源;2026-10-31 本机取证推翻「云端平台本地无正库」旧口径:WorkBuddy `~/.workbuddy/projects` 两层 JSONL 91 场、CodeArts `workspaceStorage/**/chatSessions` 45 场、Loomy IndexedDB 键族 2 场);对话是云端回包缓存的豆包如实 `no-continuity-face` 不冒对账;qoder/codearts/minimax/opencode 无会话模板时显式告警「账号资料仍沿用旧号」但不拦写回;失败路径统一走 `exitWith(2)` 显式退出(原只设 exitCode 会被 pg 池挂住);多票不点名 exit 2 绝不猜票;输出零凭据;退出码 0 ok/1 broken(切号真丢了会话)/2 未判定 |
| **统一切号入口**            | `pnpm switch:client -- --list｜--current｜--to <uid|名称> --provider <p>` | `scripts/switch-client-account.mjs`(2026-10-31 立):trae/trae-solo 转 `scripts/switch-trae-client-with-chat.mjs`(SOLO 自动补 `--product "TRAE SOLO CN"`),其余九平台转 `relay-login-local-verified`;平台名归一与参数映射为纯函数(`__test__`),未知 provider exit 2 并列全支持集;`--list/--current` 仅 Trae 系原生支持,其余如实指向号池巡检入口 |
| **MiniMax 会话回灌**        | BullMQ `minimax-session-sync` 每 10 分钟 / `node scripts/sync-minimax-client-session.mjs [--dry-run]` | `scripts/sync-minimax-client-session.mjs` + `apps/api/scripts/relay-minimax-session-sync.ts`(2026-10-31 立):读 `~/.minimax/auth/prod/<region>/mcode-public/auth.json`(明文)回流号池;判据走 Trae 的 `decideSync` 单源;取证实证 uid 随票旋转而变 ⇒ **uid > recordKey 两级匹配**(否则轮换后每轮新建行、旧行永久 down);adapter 无公开刷新端点 ⇒ 健康态只凭「新票未过期且与池内不同」上行、绝不下行;零凭据回显;退出码 0 全部处理/1 落库失败/2 未判定 |
- 📚 文档:切号条目口径按 2026-10-31 取证更正 + 补登统一入口与 MiniMax 回灌 (772eb33cca)
- **跨设备互联(G1b,对齐 Qoder 0.5.1 设备互联安全面)**:8 位数字配对码(TTL 5 分钟·单次使用·速率限制)· 设备指纹绑定(兑换时声明,此后每请求校验 `X-Device-Fingerprint`,不匹配 403,防 token 窃取重放)· 客户端版本兼容闸(`DEVICE_MIN_CLIENT_VERSION`,空=不启用)· 会话跨设备委派(离线入队待认领)
**2026-10-31**
- 🔧 工程/其他:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (adf8244981)
- 🚀 新功能/改进:守门 273 触屏交互卫生上线 + 命中尺寸 22→0 清零 + 三处静默失效补口 (8dfce6e70d)
- 🐞 修复:I18nProvider 定身恢复(9fdbc207ba 第五票)+ drawer artifacts 条目五语言补齐 + i18n 产物按 HEAD 面重生成 (f195ed1e06)
- 🐞 修复:generate-ui-routes 写盘加重试 —— build 链三处生成脚本写盘全部覆盖(同 gen-i18n/watermark 同型) (1d1d7894c2)
- 🐞 修复:watermark inject 写盘加重试 —— gen 写完紧随的 inject 撞实时扫描锁(同 gen-i18n 同型) (1df3c59ff0)
- 🐞 修复:I18nProvider value 定身恢复 —— 9fdbc207ba 回退的第四票(与 miniapp/mobile-rn 同型母型缺陷) (a0d46a32ab)
- 🐞 修复:再删 aboutPageSections 死件回潮(第三次)—— 检出滞后把轮 55 的正当删除带回来 (c247b0a7f7)
**2026-10-31**
- 📚 文档:中英散文声明行数字对齐 gen-doc-numbers 现算 —— 617 表/4653 路由/3698 测试文件/306 守门/51 CI/14 Compose(仅声明行 8+1 行;并摘除 en 内混入的历史中文生成块行 cliToolFiles,该行祖先态已删属复活);历史变更日志行不动 (645f426bf4) <!-- doc-num-exempt: 自动判定为历史叙述（changelog 列表项(项目符行带提交号括注)），非当前总量声明 -->
- 🚀 新功能/改进:文件读取状态缓存接线 + 失败词表对账门 + 派生面收敛收尾 —— ai-service read_file 登记会话级内容指纹、file_edit 落盘前脏判定(fresh/stale/never_read/undetermined 四档不并桶,__session_id 取承载层注入,判据本体 file_read_state 单源)+ 沙箱阻断计量测试;词表对账门入库(复用门 151 解析器,接线另票);门 269 提取器内联箭头按块记账(修 alias-routes 三处同名形参前缀塌缩);reset 页面细进度条圆角收编 rounded-xs 与 prettier 重排 (c0312b47ff)
- 🐞 修复:恢复模型广场兜底容量与兜底降级组 —— 转壳承载丢失的能力维随形状锁取材点迁移一并归位 (4f45a62234)
- 🐞 修复:守门 102 的 GA1 字形集扩进关闭/勾选族 —— × 当图标长期不响这一格补上 (824b10cb6c)
- 🔧 工程/其他:on-demand 三级就绪对账改挂产物文件面 —— 同 i18n-compressed 的收口逻辑 (86660d7aee)
- 🐞 修复:门 272 的镜像锁改用 code-mask 剥注释,并格式化门体 (e255be79c3)
- 🐞 修复:清偿 i18n 测试收口枚的未用标识符(mergeMessages/Locale/MESSAGES_ROOT/REPO_ROOT 删除后残留 import 与常量)+ sep 回补(下游相对路径换算仍在用) (7baf0ecb7e)
- 🐞 修复:四处弹层输入补键盘避让,并装守门 272 锁住这一型 (fe670d07fd)
- 📚 文档:守门 272 补进「守门脚本点名索引」的 UI/样式 行 (092b35faf9)
- 🔧 工程/其他:i18n 无损性套件撤第二份合并判据 —— 降回产物层健康锁,内容对账归守门 105 钉现算 (3a7a164c51)
- 🔧 工程/其他:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (37ca28af71)
- 🔧 工程/其他:采纳锁两处对齐现状 —— feedback 壳承载摘出 ADOPTED + setValue 同源判据补 props 透传形态 (1ccbebaa2f)
- 🐞 修复:验证码弹层补键盘避让 —— 键盘不再盖住用户要看的 6 个码格 (5e99373861)
- 🐞 修复:gen-i18n 三处写盘全部走重试(remote-locale-manifest.gen.ts 同型锁实证) (6f78b9dc8d)
- 🐞 修复:恢复 I18nProvider value 定身(9fdbc207ba 第三票回退)+ d20 形状锁窗口放宽 (12fe73bd51)
- 🐞 修复:gen-i18n 写盘加重试 —— Windows 实时扫描毫秒级独占锁致全量 turbo 连续三轮稳定红 (3fc2338841)
- 🐞 修复:恢复 G-41 钩子事件流生产接线 —— 9fdbc207ba「清理回退残留」抹掉的第二个接线面 (7cc430a3df)
- 🔧 工程/其他:补 packages/ui-react/tests/setup.ts 的溯源水印横幅 —— 销 HEAD 面欠账 (f77e41df3f)
- 🐞 修复:守门 218 射程补上 packages/app/src —— 共享屏层的手抄色值不再对门隐身 (23dee91758)
- 🐞 修复:清偿 devices page 的 TASK_STATUSES 只用作类型 lint 红(0e875130c0 带入的 HEAD 存量) (61d3c76645)
- ♻️ 重构:色相表分成"带前景的族"与"纯底档的族"两型 + 收编最后一张手抄表 (38f236b266)
- 🔧 工程/其他:清偿 devices-g1.test 两处 eqeqeq(0e875130c0 带入的 HEAD 存量 lint 红) (397e481f7a)
- 🔧 工程/其他:清偿 rn-sheet-keyboard-cta 两处 children-as-prop(235d418a8e 带入的 HEAD 存量 lint 红) (ecb6277916)
- 🔧 工程/其他:补 vitest 入口的两个漏项 —— 浏览器全局补丁未挂 + Radix Trigger 裸 click 恒假 (906c04feca)
- 🐞 修复:色相表补上构建装车腿 + 8 个共享屏的 tint 抄本收编到单源 (1160d9530c)
- 🐞 修复:根槽位判据扩两条窄追跳 —— 同文件本地代渲染 + 跨端同源核心构造判定 (56ef0e8d7f)
- 🚀 新功能/改进:色相族 tint 落单一真相源 —— 收编 RN 侧 8 份手抄调色板的落点 (894de57d3a)
- 🔧 工程/其他:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (a7b434d031)
- 🐞 修复:跨端接线族五连修(末枚)—— 幻影判据补间接消费维 / tooltip 语义反转 / 裁定账摘 SectionHeader / 补回 navbar-core 导出 (c3ff235506)
- 🔧 工程/其他:probe6 (403d6bfa0d)
- 🔧 工程/其他:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (3bd0be64c9)
- 🔧 工程/其他:probe3 (61600c99b2)
- 🐞 修复:补齐 RN 端 7 枚 t() 调用点的缺词 —— 界面不再回显裸键路径 (3229f88b8d)
- 🐞 修复:DevicesScreen 展开面板圆角回角色档 —— panel 取 xl(12) 不再 sm(4) (c164fb5f83)
- 🔧 工程/其他:probe (a8ef367298)
- 🐞 修复:弹层键盘避让补进唯一承载件 + 提现 2FA 面板色值收口(三道 HEAD 恒红门归零) (235d418a8e)
- 🔧 工程/其他:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (39d0793928)
- 🐞 修复:ScreenStates 占位高台收单一源 + 标题字号撤手写档 —— 消解 2026-11-24 到期豁免的真实差异半边 (e8ba95f0f3)
- 🚀 新功能/改进:切号链收尾 —— codearts 快照面解除 supported:false + 闭环 CLI 挂 script + 快照落点补忽略 (42b2ce0a2e)
- UI/样式: `check-miniapp-taro-design-tokens.mjs` `check-adapter-style-parity.mjs` `check-percent-clamp-single-source.mjs` `check-line-split-parity.mjs` `check-input-focus-feedback.mjs` `check-button-height.mjs` `check-glyph-arrow-icon.mjs` `check-no-divider.mjs` `check-no-mask-image.mjs` `check-no-native-dialog.mjs` `check-no-emoji-icons.mjs` `check-radius-single-source.mjs` `check-radius-role-conformance.mjs` `check-rounded-full.mjs` `check-statusbar-single-source.mjs` `check-cross-end-ui-parity.mjs` `check-cross-end-screen-coverage.mjs` `check-miniapp-tokens-sync.mjs` `check-miniapp-taro-style-parity.mjs` `check-cross-end-tokens.mjs` `check-miniapp-css-landing.mjs` `check-modal-keyboard-avoid.mjs` `check-rn-interaction-hygiene.mjs` `check-rn-type-floor.mjs`
- UI/样式: `check-miniapp-taro-design-tokens.mjs` `check-adapter-style-parity.mjs` `check-percent-clamp-single-source.mjs` `check-line-split-parity.mjs` `check-input-focus-feedback.mjs` `check-button-height.mjs` `check-glyph-arrow-icon.mjs` `check-no-divider.mjs` `check-no-mask-image.mjs` `check-no-native-dialog.mjs` `check-no-emoji-icons.mjs` `check-radius-single-source.mjs` `check-radius-role-conformance.mjs` `check-rounded-full.mjs` `check-statusbar-single-source.mjs` `check-cross-end-ui-parity.mjs` `check-cross-end-screen-coverage.mjs` `check-miniapp-tokens-sync.mjs` `check-miniapp-taro-style-parity.mjs` `check-cross-end-tokens.mjs` `check-miniapp-css-landing.mjs` `check-modal-keyboard-avoid.mjs`
- UI/样式: `check-miniapp-taro-design-tokens.mjs` `check-adapter-style-parity.mjs` `check-percent-clamp-single-source.mjs` `check-line-split-parity.mjs` `check-input-focus-feedback.mjs` `check-button-height.mjs` `check-glyph-arrow-icon.mjs` `check-no-divider.mjs` `check-no-mask-image.mjs` `check-no-native-dialog.mjs` `check-no-emoji-icons.mjs` `check-radius-single-source.mjs` `check-radius-role-conformance.mjs` `check-rounded-full.mjs` `check-statusbar-single-source.mjs` `check-cross-end-ui-parity.mjs` `check-cross-end-screen-coverage.mjs` `check-miniapp-tokens-sync.mjs` `check-miniapp-taro-style-parity.mjs` `check-cross-end-tokens.mjs` `check-miniapp-css-landing.mjs` `check-modal-keyboard-avoid.mjs` `check-rn-interaction-hygiene.mjs`
**2026-10-31**
- 🐞 修复:收编器补齐滞后副本守卫的接线与两个漏网洞 —— ① main 重新接线 dropStaleCopies:判据与装车锁 T6 于 2026-10-29 写好,main 里的接线被后续副本覆盖洗掉,守卫整个悬空(教训:镜像测试红了必须有人读),aboutPageSections 第四次回潮(7a47524b07)即此通道,T6 一直红着无人修;② partitionStaleCopies 的 !head 分支不再 fail-open:HEAD 无此文件但 git log --diff-filter=A 证得到曾入库 ⇒ 删除档死件回潮必须跳过(第四轮回潮正是这条通道);③ 祖先窗口 6→40(回潮-删除轮次多的路径在 6 枚窗口漏网);新增 T10/T11/T12,镜像 12/12,dry-run rc=0 (f221586d3f)
- 📚 文档:三条 [归并] 指针副本按证据结清摘除 —— 其所指实质工作均已在 HEAD 落地:①prod-bundle 运行入口三枚入库源在册(git ls-files deploy/scripts/prod-bundle/svc/run-{api,web,ai}.ps1)+ check-prod-bundle-shadow.mjs:148-159 的 PAIRS 三对已登记,E1 枚举闭合(14 个运行副本全在登记表,运行副本本机不在=未判定非失败);②门 98 D6「错名 .js 影子架空 .ts 说明符映射」判据已实现(头注 35-46 + 实现 1170-1232,--self-test 19 例)。三行均属「重复登记副本存量清零」射程,不再保留一行一状态 (999ea0250c)
- 📚 文档:安装器视觉三版按证据结清 —— 选型 A 版墨光·续已于 3a1f2a462f 落地(90 枚氛围资产+全帧目审 18/18),本机 check-installer-assets 三行 PASS、正式与候选同 blob 复核通过 (c4c5dd0f42)
- 📚 文档:G-23 admin 默认口令按证据结清 —— fixtures/seed 已改从 env 取、守门 check-public-admin-default 现跑通过、离线取证现役散列对公开默认六候选全脱靶;余项凭据三点漂移归机主核对 (f5cc79b586)
- 🚀 新功能/改进:G-09/G-17/G-05/G-10 —— elicitation 接线 + 会话身份注入 + 图片检索 + 压缩五判据 (a6e69e7452)
- 📚 文档:O68 pass-entry-broken 按证据结清 —— 该型根因是切流空窗:门禁起点早于新构建真就绪、web 维被 EdgeOne 缓存刷绿,触发条件在 deploy/win/health-gate-verdict.ps1:98(末轮明确 fail ∧ 源站 web+api 直探均 pass)、产出点 ihui-deploy.ps1:3429;修复四枚全部已在 HEAD 谱系(merge-base --is-ancestor 逐枚现读):e6d21d196d 就绪等待替代固定 8s、8f572260a4 结清(实测源站 5 秒就绪/门禁首轮全绿)、38d71cfb82 与 dfc9b905b5 蓝绿+router 原子切流(空窗归零);信号时刻 2026-10-27T17:30Z=本地 10-28 01:30,正是 ihui-deploy.ps1:3238 记载 6 枚 01:30~09:10 的首枚,早于修复 ⇒ 票面系滞后回填,本仓无需再改代码 (180f90e911)
- 📚 文档:票86 证据级可追溯执行流水按证据结清 —— 落库四要素/链式审计/签名导出路由+公钥面/180 天保留作业四层全部在车,承载测试 67 例单跑全绿(并发下超时为饿死假红) (cbed2c09ab)
**2026-10-31**
- 🐞 修复:数字值列退位出表格锚点,根治 Step2b 数字对齐与活文档闸自咬 —— README 生成块「|名称|数值|键名|」三列形态下 gen-doc-numbers 每轮翻新数值,旧锚点 T#名|73 与新锚点 T#名|72 永不相遇 ⇒ 改写被误判 lost、--apply 把旧数值插回、下一轮再翻新,死循环(2026-10-31 实测两枚提交各吃一轮);行身份改取名称+键名,仅第 2 格纯数字且第 3 格键名形状才走此路,两列表与自由文本第 3 格维持旧行为(反向锁在自检 ⑱a);immutable-exempt: 修的是两把器物判据咬合造成的恒红循环,扩识别不放宽语义,带正反用例与镜像 18/18 (0e63b9c2a3)
**2026-10-31**
- 🚀 新功能/改进:G1b 设备互联安全面三件(对齐 Qoder 0.5.1 peerDevice 状态族)——8 位配对码/设备指纹绑定/版本兼容闸 (1bcaf44c0b)
- 📚 文档:票79 权限双轴化按证据结清 —— 契约/裁决器/wire/前端 UI 四层全部在车,双轴 picker 挂载与请求链消费现读,承载测试 14 例复跑绿;resume 三出口有意不接与真机集成验证按票面原样交后手 (d00771a6b1)
- 📚 文档:票59 消息级版本切换按证据结清 —— 三段(后端不删行/sibling 入族坐标/CanvasVersionMenu 复用)全部在车,承载测试 22 例复跑绿 (032f358bdf)
- 🐞 修复:离线包生成物按当前词包源重刷(门 105 G-680 自述钉 stale 清偿)—— gen:i18n 现跑产物,inputsSha256 与源对齐;ui-routes 钉已 matched 不动 (4f511bba67)
- 📚 文档:三条僵尸票按证据结清 —— argument-validation 三格全有终局(模块退役裁决+行为锁 10 例)、--allow-dangerous 契约声明与测试面已落地、O66 四件落点全在车(承载测试 55 例);三批本机现读全绿 (627aa16be5)
- 🚀 新功能/改进:26 处内容文字接回系统字号通道 —— 新增唯一放大机制 scaleText(),门 273 的 H4 随之升绝对零 (d1a6dea5a1)
- 🚀 新功能/改进:文字必须随系统字号长大 —— FloatBox 接上缩放唯一口 + 一把握不住复发三次的替身缺口尺子 (c7c6f50dd5)
- 🚀 新功能/改进:门 273 补 H3「键盘点击穿透」普查 + 摘掉两处"填完再点第一下没反应" (cf65e9c457)
- 🐞 修复:门 273 两条判据方向再校正 —— 遮罩不算缺反馈 + 摘掉一枚假 affordance (10790ffb22)
- 🔧 工程/其他:probe (92a1ebbb9b)
- 🔧 工程/其他:壳声明件跟随新落承载页(187 条说明符) (d64476f31f)
- 🚀 新功能/改进:守门 274 字号可读地板上线 + 字号表补 badge 档 + 9px 文字 11 处收进档 (f0a0cfda3d)
- 🔧 工程/其他:恢复 RTL asyncUtilTimeout:4000 —— 9fdbc207ba 回退的第六票(43ce93f1a8 的等待预算被「清理回退残留」抹掉) (92729cb16d)
- 🐞 修复:门 273 的 H2 判据认原语默认态 —— 957 枚误报当场收窄(1296→352) (2aba634b5b)
- **AIGC 生成内容打标**(对齐 Trae tagAigcMetadata,goal-b40):媒体任务落库链路自动打标(图像/音频/视频全类型)· 显式标识文案 + 标识类型 + 生成方 + 标准引用(《人工智能生成合成内容标识办法》)· `AIGC_LABELING_ENABLED` 开关,关=逐字节旧行为
| **本机账号一键切换** | `pnpm relay:switch-account` / `pnpm relay:ide-switch --ide <平台>` / `pnpm relay:snapshot-prune` | WorkBuddy 登录态按快照切换(切换前自动备份当前态);trae / trae-solo / qoder 三 profile ;`--with-sessions` 切账号时联动换桶(换桶失败回滚 auth);切换列表按账号去重展示(同账号旧快照折叠报数,按名寻址不受影响);`relay:snapshot-prune` 把快照库同账号重复清理到每账号最新一份(旧份移 `.pruned/` 可找回,默认 dry-run) |
**2026-10-31**
- 🔧 工程/其他:编辑器内预测式编辑 §17 真浏览器验证 —— 建议条上屏/hover 预览装饰/逐条选择性应用/埋点真发四链路全通 (be7f1894b6)
**2026-10-31**
- 🐞 修复:修 main 上 8 条 workflow 红的真因 —— 配置解析、构建顺序、依赖面、快速失败档、静态导出暂存、expo 入口双拼、ruff 与死指令 (b00a35fabf)
**2026-10-31**
- 📚 文档:WP-7 元素句柄与票71 多端 chat 同步按证据结清 —— WP-7 交付落 dbfe0c624d5(9 例含真 Chrome 全绿),71 三端聊天面(web/taro/RN)全部接线+契约四件收口,cli/extension 无聊天面如实豁免 (242ac41536)
- 🚀 新功能/改进:WP-7 浏览器可复用元素句柄 + 票71 RN 端 chat 同步接线 —— ① CLI browser_snapshot 为交互元素分配会话级稳定 ref(eN,WeakMap 同元素同 ref),click/type 支持 ref 与 selector 二选一,导航后旧 ref 显式 stale_ref 并提示重新快照;测试 browser-element-handle 9 例(含真 Chrome 5 例)绿,tsc RC=0。② RN 端 message:* 广播 handler 经共享 chat-sync-store 投影进 ChatScreen(幂等/四态零复制/回声跳过),测试 chat-sync-rn 19 例绿;仅单测未真机,新会话 conversationId 为空时同步不生效属已知边界 (dbfe0c624d)
- 🚀 新功能/改进:G-08 worktree 会话级工具 + G-14 lesson-draft 调度 + G-22 插件默认态 + G-21 装机资产对账 (f97112d718)
| **本机账号一键切换** | `pnpm relay:switch-account` / `pnpm relay:ide-switch --ide <平台>` / `pnpm relay:snapshot-prune` / `pnpm relay:pool-snapshot-sync` | WorkBuddy 登录态按快照切换(切换前自动备份当前态);trae / trae-solo / qoder 三 profile ;`--with-sessions` 切账号时联动换桶(换桶失败回滚 auth);切换列表按账号去重展示(同账号旧快照折叠报数,按名寻址不受影响);`relay:snapshot-prune` 把快照库同账号重复清理到每账号最新一份(旧份移 `.pruned/` 可找回,默认 dry-run);`relay:pool-snapshot-sync` 把号池(provider=workbuddy)账号解密构造成 pool 快照落快照库 —— 一键切号候选面 = 号池账号 ∪ 本机登录过的账号,不再要求本机登录过;**归属射程** = `~/.wb-switch/pool-owner`(一行 users.id)指定的个人池,未设则全局池 —— 可见性与转发选号同尺(owner 过滤,个人池绝不服务他人请求;2026-10-31 机主令,现有 2 个 workbuddy 号已改判 admin 名下)(桌面一键入口每次双击自动同步;默认 dry-run,库不可达 exit 2 不冒绿) |
**2026-10-31**
- 📚 文档:T3 缺口矩阵补 §8 G-07 跨进程边界复核 (6fa08f7b53)
- 🐞 修复:配对码爆破限流 + relay-keys-admin 鉴权归位 + 组织成员写端点收口 + auth cookie Secure fail-safe(安全强化第 12 批) (2c53ec8a3c)
- 🐞 修复:安全强化第 10 批 R3 —— 重定向绕过 SSRF 五处收口 —— ① media_tasks 代理三端点(/media/download、/media/stream、/media/image)改手动逐跳 _send_following_redirects(每跳含 302 落点都重新过 _validate_url_ssrf,follow_redirects=True 自动跟随不复检 ⇒ 公网页 302 → http://169.254.169.254/ 即整条 SSRF,响应体原样回吐调用方;与 web_crawl_tools._http_get_html 2026-10-27 同型修复,HTTPException 穿透保持 SSRF 拒绝 400 不被吞成 502);② mcp_server 三处 URL 下载(_fetch_image_bytes/_resolve_image_source_bytes/_download_media_bytes)统一收口 _download_url_ssrf_safe 单源(逐跳复检,image_edit 的 _resolve_image_source_bytes 此前连首跳校验都没有,role=0 可经 /api/mcp 调用盲打内网+内网图像经编辑结果回流)。测试:test_security_batch10_r3.py 7/7(逐跳拒绝/首跳拒绝/安全链正向+每跳都被问过断言/下载单源四态),与 p0 批+media_tasks 既有套同跑 108/108 全绿,mypy --strict 664 文件零错误 (08db2f2556)
**2026-10-31**
- 🚀 新功能/改进:用 rea 对标 Qoder/Trae 落地三枚能力并先对齐再超越 (14aa125c49)
**2026-10-31**
- 🚀 新功能/改进:补 6 枚新工具显示名映射并清偿守门55 HEAD 存量4条红 (26851745bf)
**2026-10-31**
- 📚 文档:goal-b40 最底层取证架构图源稿迁入 docs(同 8f89907bf6 先例路径形态) (eacca3120a)
**2026-10-31**
- 📚 文档:goal-b40 最底层取证架构图源稿入库(同 8f89907bf6 先例) (cb1965c784)
- 🐞 修复:组织树零鉴权收口 + LSP/knowledge 路径白名单 + 邀请 IDOR + 500 泄漏与 extra 凭据脱敏(安全强化第 11 批) (88c0e60987)
- 🐞 修复:两处归属/鉴权缺口 —— 免费次数插件五个端点零鉴权、visit-log 的业务日可由客户端决定 (236a550bab)
- 🐞 修复:安全强化第 10 批 ai-service 侧两枚 P0 —— ① generate_test 收进 _ADMIN_ONLY_TOOLS+pytest 子进程 python -I(隔离模式)+populate_env CORE 白名单环境(此前 arguments.code 原样落盘为可 import 的 source.py 并起 pytest 真执行,pytest 收集时执行模块级代码 ⇒ 任意登录用户 role=0 经 /api/mcp 直调即服务身份 RCE,且子进程未传 env 完整继承服务进程 os.environ ⇒ provider API key/JWT_SECRET/AI_CALLBACK_SECRET 随取;判据取 core/exec_env 六步构造器单源:CORE 白名单起步+KEY/SECRET/TOKEN 形名排除,不造第二套);② _fire_callback 目标白名单 _is_allowed_callback_target(此前 callback_url 是请求体用户可控字段零校验,指向攻击者服务器 = 把 X-Internal-Secret 内部共享密钥(/internal/checkin 全套唯一防线)整枚送出+携带完整推理结果与元数据的 POST SSRF;现仅 settings.api_service_url scheme+host+port 同源可收回调,白名单检查排在带密钥发送之前,非白名单连裸 POST 都不发)。测试:test_security_batch10_p0.py 10/10 全绿(admin-only 矩阵+env 白名单两向断言+callback 白名单四态+零外发断言),mypy --strict 664 文件零错误;xdist 大组合 ERROR 为环境既有问题,涉事文件单跑全绿(155/155) (d6e1a583ca)
- 🐞 修复:子 LLM 那条链也走同一套宿主定界(安全强化第 12 批) (31b5094680)
**2026-10-31**
- 🚀 新功能/改进:AIGC 生成内容打标(goal-b40,对齐 Trae tagAigcMetadata)——媒体落库链路自动打标+显式标识文案+标准引用 (122001affa)
- 🚀 新功能/改进:WorkBuddy 切号列表按账号去重展示 + 快照库同账号重复清理器物 (33f5d27f0a)
- 🔧 工程/其他:第五次摘除 aboutPageSections 死件回潮 —— 共享真相源 packages/app/src/features/about/ 在位(AboutScreen.tsx 注释明说端内实现与分段数据表一并删除),端内零真实 import;bfc06bc2b0 第四次删后 74d85e2f21 auto 收编把索引旧副本带回 HEAD;本次走 object-space-land 删除档从结果树摘除并清索引 (d906805d4f)
- 🐞 修复:安全强化第 10 批 cli 侧 serve 面四道收敛 —— ① 默认绑定 127.0.0.1(此前 listen(port) 落 0.0.0.0,局域网对端可达),--host 显式放开且非回环面必须配套入站凭据否则启动期拒绝;② anonymous 透传收窄:主机零凭据时只有无 scope 请求(/health)放行,凡要求 scope 一律 401(此前零凭据主机全 API 匿名直通);③ WS 握手 Origin 校验:浏览器跨站 WebSocket(CSWSH)不受 CORS 限,非回环来源握手直接拒绝(带凭据也不放行);④ CORS 头只在回环面发,非回环暴露面不发 ACAO 让浏览器预检失败;⑤ 凭据写盘 settings.json 统一 0o600(此前默认 0644 组/其他可读)。测试:machine-credentials 54/54 全绿(含 anonymous 收窄新断言),cli typecheck 零错误 (b500f36355)
- 🐞 修复:安全强化第 10 批 web 侧两枚 —— ① 分享页 lists image 点击处 scheme 白名单:content 是分享创建者可控的自由字符串,javascript: 经 window.open 会在本站源执行(存储型 XSS,新窗口继承 opener),现只放行 http(s) 外链并显式 noopener,noreferrer 断开 opener;② RichTextEditor markdownToHtml 属性注入:url/src 内双引号闭合 href/src 属性可注入 onmouseover 等事件处理器,现引号转义 %22 进属性+链接目标 scheme 白名单(http(s)/站内/锚点/mailto),javascript: 同族降级为无 href 的 <a>。验证:web typecheck 零错误(配合 api 侧 share-content 出口 safeMediaUrl 双闸) (ddbe681c57)
- 🐞 修复:安全强化第 10 批 api 侧四组收敛 —— ① /workspace/sandbox/execute 补工作区权限闸+登记根闸(workspacePath/cwd 双过 assertWithinRegisteredRoots fail-closed)+danger-full-access 收窄 admin-only+cleanEnv 全模式滤敏感键(此前任意登录用户自报该档可整袋端走 JWT_SECRET/DATABASE_URL,等价全站接管);② /api/embed-proxy/raw 补 CSP sandbox(onSend 覆盖全部早退路径,直接导航场景第三方脚本不再以 API 同源身份执行,与前端 iframe 档同语义);③ spec-service 落盘面收口:12 处 resolve 换 assertRegisteredWorkspace 单源闸+branchName/version/pipelineId 白名单(SAFE_SPEC_SEGMENT)+git commit 改 spawnSync argv 且 --no-verify 防恶意仓库钩子(branchName ../../ 穿越可写服务器任意 .md);④ share-content 出口 safeMediaUrl 只放行 http(s)/站内绝对路径+rules ReDoS 双闸(schema max(200)+运行闸同 webhooks 口径)。测试:workspace-sandbox-containment 5/5+embed-proxy-ssrf-redirect 4/4+spec-service-containment 6/6 全绿,api/web/cli typecheck 零错误,水印 8/8 完好 (6598779ea0)
- ♻️ 重构:ioredis 内存替身收成一份实现(src/testing)+ tests/helpers 只做再导出 (9cc45fe107)
- 🐞 修复:两档最大红簇收口 —— admin-missing-routes 15 红其实是超时、n8n 7 红其实是 mock 少一个导出 (86f0e94de3)
- 🐞 修复:自愈用例不再在主进程 exec/eval,改子进程隔离执行(安全强化第 11 批) (007f1bfb9c)
- 🐞 修复:生产 CSP 的 connect-src 收成显式名单 + 供应链年龄闸复位 + compose 端口收回环(安全强化第 10 批) (5985317e88)
- 🐞 修复:家长账单端点两枚真缺陷 —— 全量请求恒 400(参数键名漂移)+ 端点手写 401 顶替承载层出口 (6fd09a0303)
- 🐞 修复:企业微信取 token 的 legacy 端点不再匿名中继任意企业凭据(安全强化第 9 批) (9060490a6e)
- 🐞 修复:两处"病灶回归"归位 —— 清空浏览记录重新对非法 userId 报 400、chat/steer 不再把上游凭据错发成 401 (c413b3034d)
- 🚀 新功能/改进:工具结果进入模型上下文前加宿主定界与保留标签中和(安全强化第 8 批) (f02cdd0b43)
- 🐞 修复:归位被"清理回退残留"chore 洗掉的两枚已入库修复 —— 协作者撤销终态守卫 + 号池换 Key 出口 (7b79a81411)
- 🐞 修复:两档 auth 链路用例改吃 ioredis 内存替身 —— 此前它们在生产 Redis 上跑,并因重连退避恒超时 (25130d6314)
- 🐞 修复:远端页面拿不到的本机通道一律摘掉,并关闭 %APPDATA% 直读直写(安全强化第 7 批) (c041f3e3a7)
- 🐞 修复:Azure TTS 的 SSML 不再由未转义的用户文本拼出 + escapeXml 收成一份 (ed3670152c)
- 🐞 修复:SSE/WS 代理的出站期限与断连中止 —— 上游 stall 不再永久占连接 (465fc9ef3c)
- 🔧 工程/其他:四处测试基座缺陷收口 —— 限流隔离夹具一直在结构性空转 (e3e80abf4f)
- 🐞 修复:计算类声明求值改用白名单 AST,摘掉外部输入直达 eval(安全强化第 6 批) (968fb44abd)
- 🐞 修复:SSRF 的 IPv6 一维同样收成单源,规范出口补齐 v6 组播/NAT64/discard 三族 (120baff8a3)
- 🐞 修复:回捞与后台任务查询的身份收口到宿主主体(安全强化第 5 批) (e7af51499d)
- 🐞 修复:im-bridge 无凭据时不发身份头 + 摘除第二份 keepalive router + 修一条误报判据 (2979ff7d2b)
- 🐞 修复:补齐 CloudRunStore 归属入参的两处漏装调用点(前向更正) (13490436d7)
- 🐞 修复:SSRF 内网地址判定收成单源,并补规范出口漏掉的数值字面量档 + 修 19 条恒红用例 (66af475034)
- 🐞 修复:MCP stdio 注册加两道闸 + 目录一键注册的工作目录收口(安全强化第 3 批) (7a1c556d19)
- 🐞 修复:memory/status 作用域只认主体(§5 越权)+ 两处逐字重复实现收成单源 (aa7b8488d5)
- 🐞 修复:agent-runtime 全线补归属校验 —— 任一登录用户此前可读/写/停他人会话(§5) (c16140a862)
- 🐞 修复:后端四枚在册缺陷收口 —— 云会话跨用户读写、签到日界、NaN 进 SQL、Azure 主机名注入 (1811855960)
- 🐞 修复:前端三处可控输入面收口(安全强化第 2 批) (144a28e8af)
- 🐞 修复:后端三格重复实现收成单源,并补 SSRF 与脱敏覆盖 (a9c6cf18c7)
- 🐞 修复:后端越权 / SSRF / 受限模型红线收口(安全强化第 1 批) (420038c4e6)
|                   | 知识文件系统        | knowledge_fs 只读虚拟路径 `/repo/<repoId>/<file>#<symbol>`(list/read/stat/search 四出口,代码切片投影,对齐 Trae ckg Cfs* 读半边)+ external_import 外部运行时 4 维导入(memory→长期记忆 / automations→调度器幂等键 / capabilities 声明 / sessions 让位 relay 腿)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
- 📚 文档:T3 §9 内核族五探复判 + rea 逐函数里程碑 (257e673bea)
- 🚀 新功能/改进:号池账号归属改判 admin 个人池 + 一键切号直连号池(免本机登录) (bcaf7f58d2)
| **账号池管理页 admin**      | `/admin/relay/account-pool`                                   | 页面源文件 `apps/web/app/(main)/admin/relay/account-pool/page.tsx`:单页三栏(账号池 / 代理池 / 模型目录),账号列表 + 平台与健康度筛选 + **归属筛选(2026-10-31,机主令:运营池默认存量视图 / 我的个人池 `owner=me`=当前登录管理员 / 全部归属;个人池行名称列带"个人池"徽章;判据单源 `relay-pool-policy.ownerListCondition` 四分支镜像测试)** + **体检徽章列(六态+闲置天数,判据与 `@ihui/shared` 同源、后端 `/admin/relay/accounts` 的 enriched 回传 `verdict/idleDays`,UI 不重写判据)** + 分页 + 导入对话框(**支持把 .json 拖进文本框 / 点「选文件」**,也支持粘贴:第三方工具导出自动归一、顶层带 `providerCode` 自动选平台) + 启停 + 真实探活 + 按需查余额 + 认领释放 + 手动巡检 + 单账号用量抽屉                                                                                                                                                                                                                                                                                                                     |
|                   | 知识文件系统        | knowledge_fs 只读虚拟路径 `/repo/<repoId>/<file>#<symbol>`(list/read/stat/search 四出口,代码切片投影,对齐 Trae ckg Cfs* 读半边)+ external_import 外部运行时 4 维导入(memory→长期记忆 / automations→调度器幂等键 / capabilities 声明 / sessions 让位 relay 腿) + G7 本地 embedding 回落(远端失败自动降级 1536 维确定性哈希向量,embedding_provider 列如实标注 remote/local-hash,离线索引可识别不冒充)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
- 🚀 新功能/改进:推理档位扩到 xhigh/max(四抄写面同批 + web 轴) (bb5058f925)
- 🔧 工程/其他:接上 AI 代码归属 git notes 的零调用死腿(fail-open) (ea2a4adf09)
- 🚀 新功能/改进:G-18 运行清单 + G-25 产物内容寻址 (5deda5045c)
- 🔧 工程/其他:补齐钩子异步唤醒+8 档事件的用例文件(与 9d14cbe3b 同批,前次提交窗口被并发 reset 打断) (b75a40cc7a)
- 🚀 新功能/改进:钩子 async/rewake 不阻塞 + 8 档事件单源(HookEvent 23→31) (9d14cbe3bb)
- 📚 文档:恢复误删的票5(perf e2e)未勾行 —— 上一枚 2fa2b47ca51 把进展注记误写成结清档导致该行被删除;本次从 139d7f462a7 逐字取回原行并附实测进展(首屏 1158ms/1600ms dev 口径通过,长任务带归因 0 属 dev 噪声),票维持未勾 (5128e3340b)
- 📚 文档:票5 perf e2e 实测进展 —— 隔离栈真跑通(首屏 1158ms/1600ms dev 口径通过),长任务 183/86 带归因 0 属 dev 噪声;票不结清,下一步生产口径复测+归因补 src (2fa2b47ca5)
- 🐞 修复:两处同向嵌套滚动容器摊平 —— 纵向 ScrollView 里别再套纵向 FlatList (86ef41808a)
- 🚀 新功能/改进:编辑器态喂索引(editor_state 入上下文聚合，默认关灰度) (f77199d13f)
- 🚀 新功能/改进:e2e-local-supply 修文档跑不通的旗标形态 + 新增 --stack 隔离栈自起停 —— flagValue 兼容 --base-url <v> 空格形态(此前只认 = 形式,照 --help 敲必 exit 2,§0.8);--stack 自带起/停隔离 API+web(独立库/独立端口/独立 dist,跑完自动收口,--keep 可保留),新增 --api-port/--db/--keep;unknown 判定排除值位置 token。实测:用 --stack + E2E_SKIP_SEED=1 跑通 perf-long-session 首屏用例 1158ms / 预算 1600ms(dev×2)通过(热档 277ms) (139d7f462a)
- 🔧 工程/其他:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (badfe334a6)
- 🐞 修复:清两处测试假 oracle —— 夹具给生产从不填充的 request.user 赋值(门 242 W3 绝对零容忍) (51b6e4be56)
- 🔧 工程/其他:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (b1ba3762e4)
- 🚀 新功能/改进:错题本页改壳承载 + 修好「可换却写不进去」的转换器 (1dbd0dc639)
- 🚀 新功能/改进:34 处键盘点击穿透清零并升 H3 为绝对零容忍;顺带根治门 273 自身的恒红缺陷 (a0e5261a78)
- 🚀 新功能/改进:micro压缩接入执行器 + 浏览器动作tab级作用域 (0cbd8bdb9f)
- 🚀 新功能/改进:号池管理页加归属筛选(我的个人池 owner=me)+ 个人池徽章 —— admin 账号也能看自己的池 (0ddc1fcbf5)
- 🐞 修复:内部端点公网封禁 + 运营面越权收口(安全强化第 14 批·api/web) (bd60682c87)
- 🚀 新功能/改进:G2 ContextFS 只读虚拟文件系统 + Qoder 导入 4 维对位物(goal-b41,先对齐再超越) (6b25542a75)
- 🐞 修复:测试 mock 的 Redis URL 用非法 db 段当哨兵 ⇒ ioredis 真连接后 SELECT NaN,未处理拒绝把 vitest 退出码打成 1 (1963eee7a7)
- 🐞 修复:安全强化第 10 批 R5 —— db_query 只读双层加固 + git_operations argv 注入封死 —— ① db_query:关键词黑名单从「尾随空格子串」改词边界 regex(此前 DELETE\nFROM / DELETE/**/FROM 型变体可绕过,deleted_at/drop_function 类标识符不误杀)+ asyncpg conn.transaction(readonly=True) 数据库层兜底(此前 data-modifying CTE 如 WITH d AS (DELETE...RETURNING...) SELECT... 能穿过任何文本黑名单,数据库层只读事务把这一整族含未来未知写语法结构性封死,黑名单降级为纵深第一道);② git_operations:position 段(ref/分支名/tag 名/pattern)全部过 _assert_safe_git_arg(拒 - 前缀 —— show --output=<path> 曾可写服务器任意文件、--ext-diff 可调外部程序;拒空白/控制符),show/branch_create/branch_switch/branch_delete/merge/rebase/tag_create/tag_list 八个动作点全覆盖。测试 test_security_batch10_r5.py 8/8(换行/注释变体拒绝+标识符正向对照+argv 四态+show 端到端)。 (8407903655)
- 🚀 新功能/改进:大屏「使用数据」补齐用户构成/等级分布/14日增长 + 告警行数分裂提示 (9d2aee1235)
- 🚀 新功能/改进:大屏五语言同批补 6 键 + 删 1 键按正规出口声明 (99a7ebadd4)
- 🔧 工程/其他:重新封存根护栏清单 —— guardian-runner 07:17 改动未同批重封,部署环 fail-closed 停摆 (f1fb8220dd)
- 🐞 修复:归位被"清理功能回退残留"整段回退的积分兑换事务修复 (acd8cd7456)
- 🐞 修复:号池「可调度」补票面维 + 告警账号容量归位 —— 票过期 70 小时的号仍算在分子里 (cbc49b04e9)
- 🔧 工程/其他:安全强化第 13 批接线面回归锁 —— 主链工具结果装配点定界断言五条(llm.py 裸拼形态归零+8 处单源引用 / conversation 失败分支宿主指令在块外(Raw result: {raw_tool_json})/ agent_orchestrator 无裸拼 / agent_loop_v2 第 8 批既有接线未绕开 / protocol_adapter 协议转换器刻意不接定界(既有消息回放,双重包裹破坏回放))。第 13 批修复本体已由并行会话收编入库(f0e490a7f9,与本席 R4 工作树改动同内容),本枚补齐其接线面防回归锁。10/10 全绿(r4+r4_framing),mypy --strict 665 文件零错误 (ae754729de)
- 🐞 修复:安全强化第 13 批 —— 凭据落盘加密/沙箱 fail-closed/工具结果宿主定界/错误帧脱敏/桌面原生确认/边缘封禁 (f0e490a7f9)
- UI/样式: `check-miniapp-taro-design-tokens.mjs` `check-adapter-style-parity.mjs` `check-percent-clamp-single-source.mjs` `check-line-split-parity.mjs` `check-input-focus-feedback.mjs` `check-button-height.mjs` `check-glyph-arrow-icon.mjs` `check-no-divider.mjs` `check-no-mask-image.mjs` `check-no-native-dialog.mjs` `check-no-emoji-icons.mjs` `check-radius-single-source.mjs` `check-radius-role-conformance.mjs` `check-rounded-full.mjs` `check-statusbar-single-source.mjs` `check-cross-end-ui-parity.mjs` `check-cross-end-screen-coverage.mjs` `check-miniapp-tokens-sync.mjs` `check-miniapp-taro-style-parity.mjs` `check-cross-end-tokens.mjs` `check-miniapp-css-landing.mjs` `check-web-rn-parity.mjs`(web↔RN 跨端对账,warn;自检 `node scripts/check-web-rn-parity.mjs`;跳过 `HUSKY_SKIP_WEB_RN_PARITY`) `check-ui-spec-mirror.mjs`(259,blocking;同名配对组件的 RN 壳↔小程序壳 spec **消费面**必须相等,差集逐条点名;例外走具名台账 `scripts/data/ui-mirror-waivers.json`,判序单源 `scripts/lib/ui-mirror-waivers.mjs`——到期回队列、被审面不再命中判清单腐烂、行形态不合格免不了任何东西;取证 = 门体 `--self-test` 13 例。**配套派生器 `gen-ui-mirror.mjs` 判另一半:同档位的「档→类」映射两端逐字相等(取值漂移本门看不见),它是写盘器物、恒读工作树,刻意不入提交链**)
|                   | 知识文件系统        | knowledge_fs 只读虚拟路径 `/repo/<repoId>/<file>#<symbol>`(list/read/stat/search 四出口,代码切片投影,对齐 Trae ckg Cfs* 读半边)+ external_import 外部运行时 4 维导入(memory→长期记忆 / automations→调度器幂等键 / capabilities 声明 / sessions 让位 relay 腿) + G7 本地 embedding 回落(远端失败自动降级 1536 维确定性哈希向量,embedding_provider 列如实标注 remote/local-hash,离线索引可识别不冒充) + knowledge_write agent 知识写面(知识卡创建/更新/删除/链接四出口,双通道身份:创建=内部归属显式、改删=仅本人 JWT;对标 Qoder Repo Wiki 写工具族)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
**2026-10-31**
- 🔧 工程/其他:装机资产清单按 HEAD 重生成 —— .ihui/skills/rea-surpass/SKILL.md 由别席更新(字节 5003556→5004711),清单与 HEAD blob 面重新逐文件对齐;check-installed-asset-catalog → ok(192/192 / 5,004,711 B)。生成物重生成出口:LAND_ALLOW_STALE=1 显式留痕(旧条目被新条目替换,非还原祖先内容) (ef8aaed307)
- 🚀 新功能/改进:接线四条"已实现但零调用方"的启动/查询腿 (e7c5a4f1fc)
- 🐞 修复:收口剩余 CI 红 —— i18n 存量棘轮、e2e 地区与 CSP、OpenAPI 契约漂移、水印缺口 (af90aa3d59)
- 🐞 修复:zh-TW agentBillings 平台→平臺 —— 门 2b(zh-TW 简体字残留)存量一处,随本文件变更一并清掉,其余内容逐字不动 (dcd40b377b)
- 🐞 修复:更正五语言 JSON —— 上一枚 1be794eee0c 在错误锚点插键且漏逗号致 JSON 解析失败(门 2/2n 红),本枚摘掉错插并改在 chat.message 的 toggleMetadata 后正确插入 metadataLoading/metadataUnavailable,五语 JSON.parse 全通过 (42b243c3b2)
- 🚀 新功能/改进:间距档补 2xs/xs-loose/sm-loose —— 新尺量出两端各自成规模用 2/6/10px 而表里没有 (8934ce6115)
- 🚀 新功能/改进:G7 本地 embedding 回落档 —— 离线索引可识别不冒充(goal-b42,对标 Trae ckg -local_embedding) (d1a0710f5b)
- 🔧 工程/其他:补 420038c4e6 带入的溯源水印欠账 —— 安全强化第 1 批那枚测试文件未带载荷 (e572d46bb6)
- 📚 文档:门点名 check-web-rn-style-tiers —— 已接线于 parity-auto 的 gate-style-tiers 腿(R4 义务) (e879b111a1)
- 🚀 新功能/改进:web↔RN 非色档档位对账尺装上驾驶舱 —— 字号/间距/圆角这一腿此前零判据 (95326a0bfe)
- 🐞 修复:run manifest 版本读取补 selfUrl 参数 —— readCliPackage 要求显式 selfUrl,漏传时 tsc TS2554(落地后复跑判据抓出);补后 apps/cli typecheck 0 错、run-manifest 5 例绿 (fe7274ffff)
- 🚀 新功能/改进:D35 metadata 懒取与票71 chat-sync 帧/重同步 —— 五语言补 chat.message.metadataLoading/metadataUnavailable 两键(只落本票两键,同文件他席在飞键不代落) (1be794eee0)
- 📚 文档:AGENTS.md 回落预算内 95645/96000 —— 重复登记副本与历史取证叙述整区移入 AGENTS_trim-2026-10-31b.md (68a419e612)
- 🚀 新功能/改进:新增按压反馈唯一口 pressFeedback() —— 判据同步认它,并把 VoiceNote 三个主按钮接上 (244efbd30d)
- 🐞 修复:webhook 生产投递 SSRF 复检 + OAuth deny 守卫 + checkpoint 路径复验 + Tauri symlink 解析(安全强化第 14 批) (de8f370857)
- 🐞 修复:DAG 面 admin 收敛 + 子进程环境/工作目录白名单 + 会话记忆按主体隔离 + MCP 商店工作区闸 + hook script 限管理员 + 媒体上传逐跳 SSRF(安全强化第 14 批·ai-service) (1480eefdf8)
- 🐞 修复:安全强化第 10 批基础设施批 —— 侦察五处收敛 —— ① cloudflared metrics 0.0.0.0:36500 → 127.0.0.1:36500(Prometheus 指标不再监听全网卡);② 蓝绿主站 nginx 补 /api/internal/ 边缘封禁 403(与 docker 壳同口径 —— 此前只有 docker 壳有,蓝绿腿 aizhs.top 直达 Fastify;/api/internal/* 鉴权 = 单一共享 X-Internal-Secret 且 require-permission 允许内部 token 降级,密钥泄露即冒充任意用户);③ deploy/docker/nginx.web.conf 补全套安全响应头(蓝绿同款复制:HSTS/X-Frame-Options/nosniff/Referrer-Policy/CSP/X-XSS —— 本壳是 cloudflared aizhs.top 落点,此前公网实际响应零安全头,/admin/ 与 /sso/login 可被任意站点 iframe);④ SaaS Traefik dashboard 加 ipAllowlist 仅私有网段(此前知道 ADMIN_DOMAIN 即可读全部客户路由拓扑);⑤ refresh_token cookie「不记住登录」时同为 session(此前无条件 30d,关闭浏览器即登出语义被破坏,令牌窃取窗口与 remember 等价);⑥ relay-pool-snapshot-sync.ts 局部 now 未读 TS6133 顺手清(bcaf7f58d2 引入,deps.now 已随 spread 透传,归属其管道门挡路故代清)。未动项如实交代:cloudflared 的 rdp/ssh 两条 ingress(宿主机远程管理通道,删除需 Cloudflare 控制台同批操作且可能断机主自己的远程面)归机主处置;deploy/nginx/conf.d/00-waf.conf 的 $waf_block 未接线属既有设计取舍,已记录。验证:pnpm turbo typecheck --filter=@ihui/api --force 8/8 全绿,auth-cookie-domain-scope 套通过 (58f6dc169b)
- 守护巡检档(不进提交链,§12e): `check-root-guard-manifest-sync.mjs` —— 判 root-guard 清单与其绑定的规则文件是否同面自洽。三态不并桶:drift ⇒ 到人邮件(附 seal 与 prod 对齐的可执行下一步)/ unjudged ⇒ 只记日志不记绿(§0.3)/ ok ⇒ 静默零派生。判据零复写:sha256Of/loadManifest/hashTarget/ADVISORY_TARGET_IDS 全 import `root-guard.mjs`(§0.6/§22c)。唯一调度器 = `git-guardian.mjs` 的 `auditRootGuardManifestSync()`(main 单轮 + daemon tick 双挂点,15 分钟节流,dedupKey=manifest-drift 只取类别+枚举态)。自检 `--self-test` 8 例(S2/S3 成对)+ 镜像 `scripts/tests/check-root-guard-manifest-sync.test.mjs` 7 例(M6 反向锁:一旦被注册进 guardian-runner 即造恒红 —— 它判仓库状态不判本次提交)。立因 = 2026-10-31 一天内两次「改 guardian-runner 没重封清单」把 prod 部署链打死。
- 守护巡检档(不进提交链,§12e): `check-root-guard-manifest-sync.mjs` —— 判 root-guard 清单与其绑定的规则文件是否同面自洽(判仓库**状态**不判本次提交,挂 blocking 会把上一席的漂移定责给下一席,而下一席补不动:补 README 撞门 173 活性声明开放集合、补 AGENTS 撞门 207 体积预算)。三态不并桶:drift ⇒ 到人邮件(附 seal 与 prod 对齐的可执行下一步)/ unjudged ⇒ 只记日志不记绿 / ok ⇒ 静默。判据零复写:sha256Of / loadManifest / hashTarget / ADVISORY_TARGET_IDS 全 import `root-guard.mjs`(§0.6/§22c)。唯一调度器 = `git-guardian.mjs` 的 `auditRootGuardManifestSync()`(main 单轮 + daemon tick 双挂点,15 分钟节流,dedupKey=manifest-drift 只取类别+枚举态)。自检 `--self-test` 8 例(S2/S3 成对)+ 镜像 `scripts/tests/check-root-guard-manifest-sync.test.mjs` 7 例(M5 双挂点与 stdio/timeout 锁、M6 反向锁「注册进 runner 即造恒红」)。立因 = 2026-10-31 一天内两次「改 guardian-runner 没重封清单」把 prod 部署链打死(部署环每轮在 fetch/对齐**之前**跑 `root-guard --check`,清单落后即永久 fail-closed)
| **AI 服务**  | FastAPI + LangGraph + LiteLLM + MCP + A2A + Socket.IO(Python 3.12,仅此层用 Python),200+ services + 23 routers + 18 LLM Providers + 105 MCP 工具 + 38 发布适配器                                                                            |
|                   | MCP 工具协议        | 105 内置 MCP 工具(全量清单以 apps/ai-service/app/services/mcp_server.py 的 _TOOLS 为准;核心族:代码检索/知识库查询/文件读写/命令执行/网页与图片搜索/工作流触发与续跑/代码调查/团队点名消息/顾问咨询)+ 3 资源 + 3 提示词 / 自定义工具 / 项目级 MCP / mcp-extended                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
|                   | AI 服务             | FastAPI + LangGraph + LiteLLM + MCP + A2A / **200+ services**(Glob 实测)/ **23 routers** / **18 LLM Providers**(openai/anthropic/gemini/qwen/dashscope/doubao/volcengine/zhipu/hunyuan/stepfun/kling/jimeng/ollama/lmstudio/llama_cpp/openrouter/luyala)/ **105 MCP 工具** / **38 发布适配器** / 215+ 端点 / 31+ provider 适配(含 22 免费 provider 内化)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
#### 30. 工作流脚本工具 `run_workflow`(节点级续跑回缓存 · 对标 Qoder Workflow/RunWorkflow)(2026-11-01,所属端 ai-service)
> 逆向-复现-超越(AGENTS §0.12)本轮落地产物之一。对照物 = Qoder CN v0.5.1 agent SDK 的 `Workflow`/`RunWorkflow`;
> 取证册 `docs/benchmark-evidence/2026-10/trae-rea-20261031/T3-gap-matrix.md`(G-01 判结构性缺失)与
> `docs/benchmark-evidence/2026-11/qoder-trae-rea-20261101/T7-matrix-recheck-and-sidecar-ore.md`(现读复量)。
- **能力**:`apps/ai-service/app/services/workflow_runner.py` 接收一段工作流脚本(一串 agent 节点),
  先做 Kahn 拓扑校验(成环 / 重复 id / 空脚本一律拒绝),再逐节点执行。**核心是续跑语义**:带
  `resume_from_run_id` 时入参逐字节未变的节点从 checkpoint 瞬时回缓存**不重跑**,只有入参变了的节点真执行。
- **使用方式**:MCP 工具 `run_workflow`,入参 `{ nodes: [...], resume_from_run_id?: string }`;注册在
  `apps/ai-service/app/services/mcp_server.py` 的 `_TOOLS` / `_TOOL_HANDLERS` 双射表(与既有工具族同形)。
- **对齐轴**:与对照程序一致的「未变节点回缓存」重放语义。
- **超越三条**(对照取证未证到的边界):
  ① **失效方向恒为显式未判定**——run 不存在 / 脚本非法 / 主体缺失一律回具名错误码(`WORKFLOW_RUN_NOT_FOUND` 等)并
  **零节点执行**,绝不「当作缓存命中」也绝不「当作没命中」(§0.3);
  ② **归属主体不信客户端自报**——`principal` 必须由承载层显式注入,run 的 owner 持久在 checkpoint payload,
  续跑时逐字比对,跨租户续跑直接 `WORKFLOW_FORBIDDEN`(§5「认证不等于授权」);
  ③ **幂等键零分叉**——节点键复用全仓唯一出口 `task_executors.compute_idempotency_key` 与 `CheckpointStore`,
  不新写第二套 hash(§0.6),与 `run_in_background` / DAG 三面结构上不会漂移。
- **守门**:`apps/ai-service/tests/test_workflow_runner.py` 8 例 GREEN(含「同 run 二遍执行计数不增」与
  「非法输入零执行」正反对照),mypy strict 0 错,ruff 全过;`test_mcp_server.py` 176 例复跑证明双射注册未被打断。
- 号池队列隔离: `check-relay-queue-db-isolation.mjs`(门 276,2026-10-31 立:env 覆盖块把 `DATABASE_URL` 换成隔离库却没同时换 Redis/队列命名空间 ⇒ 判红;隔离证据写在注释里不算数,三档豁免(路径 `apps/api/tests/`·`*.test.*`/块内 `QUEUE_ISOLATION_EXEMPT`/`READ_ONLY`)逐条打印 `skip(reason)` 不静默吞;队列名携带库身份的解析单源 = `apps/api/src/services/relay-queue-name.ts`(显式 `RELAY_QUEUE_SUFFIX` > 隔离库名特征 > 原名),**分隔符是连字符不是冒号——BullMQ `QueueBase` 对队列名里的 `:` 直接抛,2026-10-31 实测冒号形态让隔离栈 API 崩在 worker 启动那一步**;mode=warn 起步(全量实测存量假阳未清,升 blocking 的前置是存量归零 §12e);自检 17 例 + 镜像 13 例 + `apps/api/tests/relay-queue-name.test.ts` 24 例;不变量与夹具抄写口径见 `docs/RELAY_QUEUE_DB_ISOLATION.md`)
- 插件/装机面: `check-plugin-manifest-integrity.mjs`(门 277,2026-11-01 立,G-21 半腿/逆向-复现-超越 §0.11:已装插件的逐文件内容完整性对账 —— 写侧 `apps/cli/src/plugins/installer.ts` 的 `collectInstallFileDigests` 在落位那一刻把 `{path,sha256,bytes}` 记进 `InstallRecord.fileDigests`(可选字段,存量记录无需迁移),本门读台账 ↔ 盘上三态 `ok/drift/unjudged` 并逐条点名;drift 三类**分开报**不并桶(mismatch 内容有变 / missing 被删 / unlisted 未登记混入),老记录无该字段恒落 `unjudged`+`pending`(既不判"已核对"也不判"被篡改"),目录读不到/台账形状坏/记录名含穿越一律未判定;不跟随符号链接与 junction(§26),登记路径当下是链接 ⇒ 无从证内容;链接判据由注入缝钉死并另做真链接对照。**档位 warn + 差值棘轮**(§12e:判机器装机态,存量 pending 结构上拿不到哈希 ⇒ 升 blocking 即恒红门;升档前置 = pending 归零),`--baseline <file>` 才分得出"新增 vs 存量",不给基线时 `new=null` 不拿 0 冒充"无新增";`--print-baseline` 只打 stdout,**本门绝不写盘/不自愈/不重装**;判据单源 = 门体(比对三分类与 sha 取算复用 `check-installed-asset-catalog.mjs` 的 `judge`/`sha256Hex`,零复算);`--staged` 被接受但判序与全量档同一把尺(判装机态,无仓内取材面);自检 `--self-test` 21 组 + 镜像 `check-plugin-manifest-integrity.test.mjs` 14 例;取源是 git clone 无解包面 ⇒ zip-bomb 那一维不适用)
#### 31. 桌面自动化输入动作族 + 两道内置门(对齐 Qoder `QoderComputerUse.exe`,逆向复现超越 T8 §A)(2026-11-01,所属端 desktop)
> 对照物 = Qoder CN v0.5.1 内置插件原生件 `QoderComputerUse.exe`(2,530,288 B,函数 6,995,MCP 形 JSON-RPC over stdio)。
> 取证册 `docs/benchmark-evidence/2026-11/qoder-trae-rea-20261101/T8-sidecar-native-surface.md`(§A 动作面与 11 项边界)。
- **对齐**:`apps/desktop/src-tauri/src/operator.rs` 的动作枚举原有 5 档缺输入类两档 ⇒ 补 `Drag`(按下→1..12 段插值移动→释放,
  中途失败**先松键**不留按下态)与 `PressKey`(修饰键按下→主键点击→**逆序释放**,主键失败也松),
  键组解析 `parse_key_combo` 支持 X-style `Control_L+a` 与 `shift+alt+F5`,**未知键名或未知修饰键一律报错、不静默换键**、
  `Control++` 保住字面 `+`;决策层补这两趟,端点解不出落 `NoOp` 而不臆造坐标。
- **超越(两道可测不变式,内置在原生执行层)**:
  ① **审批门** `check_approval` + `ApprovalGrant` + `plan_fingerprint` —— 批准必须由承载层显式入参并**绑定本次计划指纹**,
  指纹不符/无批准人/授权串解析不动一律拒;**拒绝路径不构造 Enigo 实例**(结构上不可能误碰真鼠标键盘),
  且 `denied_report` 的签名不接受 Allowed 态,使"被拒却报成功"这一不可能状态消失;
  ② **按类别重试禁令** `max_attempts_for` —— 输入类尝试上限恒为 1 且**结构上读不到 policy**,
  被动类才按预算重试(正向对照用例真重试 3 次)。
- **使用方式**:既有两枚 tauri command(`operator_decide` / `operator_execute`)形态不变,新增档位随计划 JSON 下发;
  批准来源是承载层入参,不是模型可写字段。
- **守门**:`operator::tests` 30 枚新增用例 + 全量 `cargo test --lib` **330 passed / 0 failed**(主席复跑末行现读);
  变异证据 = 摘审批门 8 枚翻红、把输入类上限改为随 policy 则 2 枚翻红,两处逐字还原后 `grep MUTATION` 为空。
- **如实登记的未做格**:`revision 陈旧即拒` 未做——`ScreenState` 无代际字段,补它要连感知/OCR 产出侧同批(跨面契约);
  审批指纹覆盖的是「批准陈旧」不是「感知陈旧」,两者不互相抵充。对侧 `set_value`/`perform_secondary_action` 属 UIA 写值、
  非 enigo 原语,亦未做。
- **口径纪律**:本节不得写成「Qoder 没有审批门」——原生件内 0 命中是观察,「门住宿主侧」是推断,详见 T8 册同一处更正(枚另有其号)。
#### 32. 插件自动更新判据层 `checkUpdates` / `planUpdate`(验不过就不落·对齐 Qoder autoUpdate)(2026-11-01,所属端 cli)
> 缺口矩阵 G-22 的残腿(主腿已在 `defaults.ts:50-51` 显式登记两档默认态)。对照物 = Qoder 装机的
> `installed_plugins_v2.json` + `marketplaces/` + 同一插件多版本并存(`archives/<插件>/<sha256>.zip`,实测**文件名==该 zip 自身 sha256**)。
- **能力**:`apps/cli/src/plugins/update-plan.ts` 出两份报告 —— 哪些插件有更新(`up-to-date / available / unjudged` 三态)、
  以及**只出计划不落盘**的更新方案;出口 `plugin-updates` 命令(`commands/plugin-updates.ts`)。
- **使用方式**:`ihui-cli plugin-updates --check` / `--plan`;退出码 `0 全绿 / 1 有 refused 或 available 未落 / 2 任何未判定`;
  **默认零副作用**,`--apply` 明确未做(要接 safe-commit 五步法与 git 写锁,另票)。
- **供应链判据(超越对照之处)**:①**验不过就不落** —— 落地前必须用门 277 的逐文件完整性判据验暂存副本,
  混入未登记文件 ⇒ `staged-integrity-fail`、改字节 ⇒ `mismatch`,原目录逐字节不动;②**本地脏就停** ⇒ `local-drift-defers`
  且暂存调用数为 0(绝不覆盖用户本地改动);③**取不到不冒充** ⇒ 市场未登记/远端不可达/无 commit pin 一律 `unjudged`,
  `upToDate` 恒 0;④**一次只进一步** ⇒ `merge-base` 距离分档,跳两枚即 `not-direct-successor` 拒绝。
- **判据单源纪律**:比对只用门 `scripts/check-plugin-manifest-integrity.mjs` 的 `judgeRecord`(运行时校验,
  门不在手边即 `integrity-gate-unavailable` 而**绝不回落第二份 hash**),哈希只用写侧 `collectInstallFileDigests`;
  形状锁同时钉住 src 与测试两侧不得出现 `createHash`/`node:crypto`/`sha256Hex`/`judge(`。
- **守门**:`apps/cli/tests/plugin-update-plan.test.ts` 23 例(含"原目录快照逐字等值""stagerCalls==0"这类**副作用没发生**的断言),
  `pnpm turbo typecheck --filter=ihui-cli --force` 8/8;邻档插件回归 176/176。
- **口径纪律**:不得写成「Qoder 没有完整性校验」——它是否校验未取证到,标 [未知];本节说的是本仓多做出来的四道判据。
#### 33. 安全扫描接进 hooks 两腿(编辑后告警 + 收场聚合审查·对齐 Qoder security-scan)(2026-11-01,所属端 cli)
> 缺口矩阵 G-12。真缺口不是"缺扫描器",而是**判据住在 475 行命令壳里出不去**(`commands/security.ts` 当时只导出
> `registerSecurityCommand`),任何内部调用方都用不上 ⇒ 先搬家再接线。
- **能力**:`apps/cli/src/security/secret-scan.ts`(进程内 pattern 判据本体 `SECRET_SCAN_PATTERNS`)与
  `audit-guards.ts`(自命令壳逐字节搬家的 5 枚类型守卫 + 3 枚校验);命令壳降到 319 行只留呈现面。
- **使用方式**:无需新命令 —— 接进既有 hooks 事件面:编辑腿 `postToolCall`(命中 `Edit`/`Write`)出告警、
  收场腿 `stop` 对整轮改动做聚合审查;钩子在 `apps/cli/src/hooks/index.ts` 两处派发。
- **三条硬边界(超越轴)**:①**不外发用户代码**(对照侧深扫走远端,本仓刻意不做,把用户代码送出仓是新增数据出口);
  ②**未判定不冒绿** —— 缺输入落 `undetermined` 并点名 `missing` + `not-judged-safe`,配有反向牙(改判成"安全"必翻红);
  ③**守卫失败不伤用户动作** —— 扫描器自炸时 `proceed` 恒真,绝不因守卫问题拦人干活(§12e 同源的失效方向)。
- **守门**:`apps/cli/tests/security-scan-hooks.test.ts` 15/15;`ihui-cli` typecheck 8/8;门 95 全部通过;
  同批收掉本条线上一枚既有红(`hooks-trust-command` 4 例自 `0e3ad01c29` 起 mock 缺 `TRUSTED_FOLDERS_PATH` 导出)⇒ 现 8/8。
- **如实边界**:云端 L2/L4 深度审查与 settings 开关刻意不做;`additionalContext` 并入模型输入的下游消费腿在 `agent.ts`
  (取证时登记的边界,不在本格射程);对方 `qoder-hooks.json` 的 `Stop` 实为**空数组**(深扫挂 `PostToolUse` 的 `git push`),
  即收场这一层本仓反而更完整。
- 只读尺子/派生器/核验器(不在 runner,不进提交链,也不进守护巡检轮): `check-temp-landing.mjs` `check-dispatch-premise.mjs` `check-alertmanager-live-config.mjs` `check-monitor-runtime-parity.mjs` `check-tunnel-leg-health.mjs` `check-prod-checkout-foreign-work.mjs`(git-guardian 巡检轮派生,`--json` 只判不修;未跟踪洪水只计数不判定) `check-index-unmerged-age.mjs`(2026-10-24 立,index 烂尾哨兵:unmerged 条目按路径集指纹计龄,同批滞留 ≥15 分钟即到人;立因 = 凌晨违规 stash+rebase+pop 冲突逃逸挂了 2 枚 unmerged + 91 个被删文件 12 小时无人察觉;不走提交链,派发层 = git-guardian 的 `auditIndexUnmerged`;镜像 `check-index-unmerged-age.test.mjs`) `verify-panel-data.mjs` `verify-panel-logql.mjs` `verify-grafana-panel-data.mjs` `verify-grafana-logql-panels.mjs` `sync-panel-live-provisioning.mjs` `sync-grafana-live-provisioning.mjs`(仓内 provisioning 是唯一真相 ⇒ 派生到部署机运行副本,连不上的源不写入并点名原因;幂等 + `pre-sync-backups/` 退路;`--check` 零副作用;大屏核验五档 有数/全零/空板/失败/未判定,全零 ≠ 空板,不许接提交门) `strip-stale-closed-rows.mjs` `strip-stale-claim-marks.mjs` `env-backfill-model-keys.mjs` `quarantine-disk-root-strays.mjs` `git-refs-heal.mjs` `git-backup-refresh.mjs` `git-sync-converge.mjs` `git-push-converge.mjs` `git-push-guard.mjs` `heal-worktree-tracked.mjs` `sync-lost-commit-tags.mjs` `check-retrieval-quality.mjs`(2026-11-01 立,逆向复现超越轮:量代码检索的召回形态是 dual-leg-fused 还是 serial-fallback、降级有没有出声;三态 + 枚举 0 枚出口 exit 2;融合判据经真 rrf_fuse 派生,门体自身零公式;刻意不进提交链) `ai-authorship-report.mjs`(2026-11-01 立,AI 代码归属读侧聚合四问 覆盖率/主体分桶/跨席重复主张/归属失效;无 note 一律 unjudged 严禁判成「人类写的」;跨席重复主张做到跨 commit 射程;判据 import lib/ai-authorship-notes 单源;不进提交链)
- 只读哨兵(判机器态,**刻意不进提交链**,§12e:提交者结构上满足不了): `check-qoder-session-sync-task.mjs`(2026-10-31 立 —— Qoder 会话回灌计划任务的**存续哨兵**,只判「这条保活腿现在还在不在跑」,不判账号业务健康。立因:该任务以交互用户身份跑(DPAPI 只能由登录用户解),而「任务被删 / 被禁用 / 被改成 S4U / pwsh 或 Qoder 目录漂移 / 任务停摆」这些失效形态全部表现为**安静** —— 池里那枚号照旧显示 healthy(票还有 30 天),直到票过期才发现没人续。三态 `ok / breach / unjudged`(§0.3):取不到输入记 `unjudged`,不记绿也不冒红;日志刚被新一轮写了一半 ⇒ 本轮 `unjudged`,不按缺陷派单。用法 `node scripts/check-qoder-session-sync-task.mjs [--json]`;退出码 `0 ok / 1 breach / 2 unjudged`。**唯一调度器** = `scripts/git-guardian.mjs` 的 `auditQoderSessionSyncTask()`)
- 只读尺子/派生器/核验器(不在 runner,不进提交链,也不进守护巡检轮): `check-temp-landing.mjs` `check-dispatch-premise.mjs` `check-alertmanager-live-config.mjs` `check-monitor-runtime-parity.mjs` `check-tunnel-leg-health.mjs` `check-prod-checkout-foreign-work.mjs`(git-guardian 巡检轮派生,`--json` 只判不修;未跟踪洪水只计数不判定) `check-index-unmerged-age.mjs`(2026-10-24 立,index 烂尾哨兵:unmerged 条目按路径集指纹计龄,同批滞留 ≥15 分钟即到人;立因 = 凌晨违规 stash+rebase+pop 冲突逃逸挂了 2 枚 unmerged + 91 个被删文件 12 小时无人察觉;不走提交链,派发层 = git-guardian 的 `auditIndexUnmerged`;镜像 `check-index-unmerged-age.test.mjs`) `verify-panel-data.mjs` `verify-panel-logql.mjs` `verify-grafana-panel-data.mjs` `verify-grafana-logql-panels.mjs` `sync-panel-live-provisioning.mjs` `sync-grafana-live-provisioning.mjs`(仓内 provisioning 是唯一真相 ⇒ 派生到部署机运行副本,连不上的源不写入并点名原因;幂等 + `pre-sync-backups/` 退路;`--check` 零副作用;大屏核验五档 有数/全零/空板/失败/未判定,全零 ≠ 空板,不许接提交门) `strip-stale-closed-rows.mjs` `strip-stale-claim-marks.mjs` `env-backfill-model-keys.mjs` `quarantine-disk-root-strays.mjs` `git-refs-heal.mjs` `git-backup-refresh.mjs` `git-sync-converge.mjs` `git-push-converge.mjs` `git-push-guard.mjs` `heal-worktree-tracked.mjs` `sync-lost-commit-tags.mjs` `check-app-version-latest.mjs`(2026-10-29 立 / 2026-10-30 接线,Y-14:App 内更新卡的 **latest 行只读对账** —— 判 `GET /api/app-version/latest?platform=android` 的 `data.latest` 在位、`downloadUrl` 指向自有站点腿、apk 真能取到;红项正文直接给登记器物 `register-app-version-latest.mjs`(OWNER-ONLY:requireAdmin 只认人用 JWT 或生产机 `--via db`);**不进提交链**(§12e,判公网与线上数据,提交者改不了那一格),派发层 = `git-guardian` 的 `auditAppVersionLatest`(6h 节流、未判定只写日志不喊人),手工入口 `node scripts/check-app-version-latest.mjs`(加 `--json` 出机器可读结论)) `check-retrieval-quality.mjs`(2026-11-01 立,逆向复现超越轮:量代码检索的召回形态是 dual-leg-fused 还是 serial-fallback、降级有没有出声;三态 + 枚举 0 枚出口 exit 2;融合判据经真 rrf_fuse 派生,门体自身零公式;刻意不进提交链) `ai-authorship-report.mjs`(2026-11-01 立,AI 代码归属读侧聚合四问 覆盖率/主体分桶/跨席重复主张/归属失效;无 note 一律 unjudged 严禁判成「人类写的」;跨席重复主张做到跨 commit 射程;判据 import lib/ai-authorship-notes 单源;不进提交链)
- **知识与记忆**:RAG 双路召回 + RRF 融合 + LLM 重排 · 代码检索双腿并跑加权融合(关键词腿 + 语义腿 asyncio 并跑,任一条腿坏了具名出声,`mode` / `legsUnavailable` / `degraded` 三键在响应里可查) · pgvector 向量库 · 知识图谱 · 15 个记忆服务(长期 / 衰减 / 多模态 / 项目级)
- **深度能力**:Deep Research(信源分级 + 验证状态)· Computer Use 计算机操控 · 代码库增量索引(Tree-sitter)· LSP 代码智能 · 目录骨架按 token 预算装箱(`render_repo_tree`:枚举走单源出口,预算不足先保目录树、削掉的文件与被 scope 排除的条目分别计数,`complete` 与 `dropReason` 说清这份骨架是全仓还是削过的)
|                   | MCP 工具协议        | 106 内置 MCP 工具(全量清单以 apps/ai-service/app/services/mcp_server.py 的 _TOOLS 为准;核心族:代码检索/知识库查询/文件读写/目录骨架预算装箱/命令执行/网页与图片搜索/工作流触发与续跑/代码调查/团队点名消息/顾问咨询)+ 3 资源 + 3 提示词 / 自定义工具 / 项目级 MCP / mcp-extended                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
- **知识与记忆**:RAG 双路召回 + RRF 融合 + LLM 重排 · pgvector 向量库 · 知识图谱 · 15 个记忆服务(长期 / 衰减 / 多模态 / 项目级) · 检索金标双命名空间打分(`id_native` 用本仓切块器父块现算 id 的同 id 索引,`evidence_span` 用内容锚点),零连库零网络可复跑
- **深度能力**:Deep Research(信源分级 + 验证状态)· Computer Use 计算机操控 · 代码库增量索引(Tree-sitter)· LSP 代码智能 · 同仓索引租约单飞行(被挡住时点名「本轮未开工」,零索引数不当「没东西可索引」报) · Merkle 快照自证档(ok / legacy / absent / corrupt / truncated / skipped 六档,坏档不冒充增量完成)
- **知识与记忆**:RAG 双路召回 + RRF 融合 + LLM 重排 · 代码检索双腿并跑加权融合(关键词腿 + 语义腿 asyncio 并跑,任一条腿坏了具名出声,`mode` / `legsUnavailable` / `degraded` 三键在响应里可查) · pgvector 向量库 · 知识图谱 · 15 个记忆服务(长期 / 衰减 / 多模态 / 项目级) · 检索金标双命名空间打分(`id_native` 用本仓切块器父块现算 id 的同 id 索引,`evidence_span` 用内容锚点),零连库零网络可复跑
- **深度能力**:Deep Research(信源分级 + 验证状态)· Computer Use 计算机操控 · 代码库增量索引(Tree-sitter)· LSP 代码智能 · 目录骨架按 token 预算装箱(`render_repo_tree`:枚举走单源出口,预算不足先保目录树、削掉的文件与被 scope 排除的条目分别计数,`complete` 与 `dropReason` 说清这份骨架是全仓还是削过的) · 同仓索引租约单飞行(被挡住时点名「本轮未开工」,零索引数不当「没东西可索引」报) · Merkle 快照自证档(ok / legacy / absent / corrupt / truncated / skipped 六档,坏档不冒充增量完成)
| | 编辑意图预测(Predictive Edit) | 服务端三态(`suggested` / `no_action` / `undetermined` 且六个不可分辨理由两两可分)与结构化动作校验早已入库(`apps/ai-service/app/services/edit_intent.py`,含区间冲突 `find_range_conflict` 与锚点内容比对两格,动作条数上限由 `MAX_ACTIONS` 单源插入 prompt,不再两侧各说各话)。**前端真调用方(2026-11-01 现读齐备)**:设置页开关卡 `apps/web/src/components/settings/predictive-edit-card.tsx`(挂在 preferences 页,与 NavTier/Sampling/FoldPolicy/WebSearch 同层同形;开关绑 store 而非本地 useState)+ 编辑器侧 `apps/web/src/components/chat/use-edit-intent.ts` 的**三把钥匙**(服务端 enabled ∧ 用户 userEnabled ∧ 阈值,任一关即不发请求——否则"用户关了"与"模型判了 no_action"会在面上折回同一态,那是本票点名禁止的失效) + `edit-intent-bar.tsx` 渲染建议 + `CodeEditor.tsx` 消费。**接受率按场景分账**:服务端 `FIMMetricsReport.scene`(`_normalize_scene`/`_metrics_key`/`_split_metrics_key`,summary 行带 scene)与前端 `PREDICTIVE_EDIT_METRICS_SCENE` 跨语言同值由 `tests/test_fim.py` 钉住;旧调用方不传 scene 走裸 model 键(向后兼容,Redis 旧快照原样恢复)。**真模型取证 2026-11-01 首跑**:五档处置实测到(suggested 1.6–2.3s、no_action 1.8–3.7s、model_timeout、parse_failed、all_actions_rejected 带逐条丢弃原因),`no_credentials` 因本机有凭据结构上跑不到;真实响应可跨 4s 预算上界,该格留作契约收紧候选而非静默。文案走 `chat` 命名空间 6 键 × 五语言(zh-CN/zh-TW/en/ja/ko)齐备,无端内硬编码中文。 |
**2026-11-01**
- 🚀 新功能/改进:把人工阀从"打印出来的装饰"接成派发路径上的真闸(observe 起步),并加 A6 维量它哑不哑 (65443d4d53)
- 🐞 修复:root-guard 用例派生 git 补 stdio 接管（门 193 存量红入库） (246a39e64a)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (19ff4238f5)
- 🐞 修复:修 06:00 探针假阳性 + Qoder 补跑轮 + 号池锚点保护 + 同步徽章 (219424fad8)
- 🔧 工程/其他:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (29bba39eaf)
**2026-11-01**
- 📚 文档:登记「deploy/** 改动当天拿不到 CI 信号」 (4e529f995c)
- 🚀 新功能/改进:把自开发发起腿从"死了 6 天没人知道"修成真能派,并装上存续判据与调度器 (8bb0fb7f9f)
- 📚 文档:登记「deploy/** 改动当天拿不到 CI 信号」—— 缺的是时延不是覆盖,要 workflow paths 与改动映射两处一起改 (2afdbef684)
- 🐞 修复:根护栏前置闸不再读"上一版"把自己锁死 —— 当前面红时改问"本轮要检出的那一面"自洽否 (6198c6c102)
- 📚 文档:点名跨端分享正文通道(§21 交付门槛:新增端能力须同批更新 README) (b5536d03fa)
- 🔧 工程/其他:壳声明件跟随自动升级的 1 枚页(按 HEAD 面派生) (7b9a016f68)
- 🔧 工程/其他:自动把 1 枚手写镜像页升级为壳承载 (fef888deb5)
- 🚀 新功能/改进:打通手写镜像页转壳的第一例——判据认「端内别名转发到共享层」这一型能力覆盖 (6e0a3da5cd)
- 🚀 新功能/改进:分享族 7 屏真的发布正文,并补齐朋友圈卡独立标题与封面两维 (f1af950bf5)
- 🔧 工程/其他:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (bd9071a44c)
- 🔧 工程/其他:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (1f8ccfe6ae)
- 🚀 新功能/改进:跨端分享正文通道落地——屏发布正文,宿主在页面级注册转发/朋友圈 (baf7462ab1)
- 🔧 工程/其他:根护栏清单按 HEAD 面重封 —— 解开部署环的 fail-closed (0b5fcb5cd6)
- 📚 文档:登记「根护栏前置闸读的是换流前那一面,能把自己锁成整轮空转」这一格 —— 带本日两次实测读数与两条同面出路 (9f68e99c85)
- 🐞 修复:公开页 nonce 排除判据从未生效 —— 31 条缓存规则全数不匹配,边缘缓存件里钉死一个 nonce (69ad209b34)
- 🐞 修复:内容类型闸对空 fileName 从"崩成 500 + 产物留盘"收成 fail-closed 的 415 (2b38b72597)
- 📚 文档:deploy-feedback 自动登记(deploy_outcome;端到端反馈闭环第二切片,O65 自进化系列) (cde5c238ec)
- 📚 文档:deploy-feedback 自动登记(deploy_outcome;端到端反馈闭环第二切片,O65 自进化系列) (0607f0042a)
- 📚 文档:deploy-feedback 自动登记(deploy_outcome;端到端反馈闭环第二切片,O65 自进化系列) (84f53c0111)
- 🐞 修复:clawdbot 的对话桶与配对属主从「客户端自报 userId」收回令牌主体(三格) (12f2079a20)
- 🔧 工程/其他:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (41d5a81463)
- 🔧 工程/其他:补 props-resolution 两新件的尾部水印行(与 rn-compat 同类文件同形)+ ui-routes 钉重生成 (98f1252165)
- 🐞 修复:三处构建文件的 pnpm 工具链从 @latest 收回收成逐字钉版,并把判据装到 deploy 面(门 48 规则 D) (660ee253f8)
- 🐞 修复:分包总量消重 —— 根桶副作用豁免,9 份 707 KB 目录块收回 1 份 (eff410c0e5)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (7801e27aef)
- 📚 文档:T12 §5b 状态更新——#8/#6 身份半格已落地,#5 大半落地,#3 缓议有因 (f7eaa3e4ac)
- 🚀 新功能/改进:钩子派发宿主身份核验(deny-by-default)—— T12 缺口表 #6 半格收口 (ea4ec0266f)
- 🚀 新功能/改进:索引快照压缩落盘(gzip 魔数自识别)—— T12 缺口表 #8 落地 (e2c90a75fd)
- 📚 文档:灰度那行就地改写 —— 来源与折绿两格已修死(枚 cf1fdef9cef),留的正是剩下的顺序语义那一格 (f2f8792e29)
- 🐞 修复:灰度槽位从此有产物可服务,且"灰度没量过"再也不能记成判定通过 (cf1fdef9ce)
- 🚀 新功能/改进:消息中心数据钩子补齐——小程序向 RN 对齐真实动作链,fidelity 缺键 17→0 (c970ac616c)
- 🐞 修复:5 个 use-cases 子页的 ja/ko 副本进 hreflang 集群 —— 那句"路由文件不存在"已与盘上相反 (5bbcc27509)
- 🔧 工程/其他:六档陈旧卷宗跟回生产契约 —— 全量回归里剩下的红全部清零(除一枚需暴露决策的) (4cf0461f33)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (44dfcfd91c)
- 📚 文档:同号多行去重 —— Z-1 4→1 / RP-79 2→1 / RP-47 2→1 (55f010724f)
- 🐞 修复:结清 AGENTS.md 守门 207 体积债(HEAD 现读超预算)并补本票两道新门的 R4 点名 (44a91f7f4f)
- 🐞 修复:rn-compat 垫片 props 契约对齐 RN 0.86 —— 小程序宿主 tsc 61 条型错归零 (3b541f58dd)
- 🐞 修复:LIKE 通配符转义收成单源并上门(279),顺手把 AGENTS.md 的体积债与 R4 欠账一并清掉 (96d1f8305b)
- 🐞 修复:会话记忆读/清补可达性闸 —— 身份对了还不够,conversationId 也是客户端给的 (179a297446)
- 🐞 修复:考试判分与题型词表收成单源,并补齐四处端间缺口 (74e79a8fce)
- 🚀 新功能/改进:补登跨端对齐残留产物与镜像资源 (d76f63cde9)
- 🚀 新功能/改进:跨端对齐一键级联编排器 pnpm sync:cross-end(web→RN→小程序 按依赖序一发跑完) (08db578671)
- 🚀 新功能/改进:dir_rhash 接进索引增量链 + T12 缺口表闭环补记(缺口表 #1 全程收口) (37dfaf9dd3)
- 🐞 修复:把登录"等代价"外壳拆出 password-crypto —— 修掉我自己上一批留下的整片替换式 mock 雷 (377115d10e)
- 📚 文档:登记「灰度槽位从未拿到产物」这一型 —— 20/20 轮未判定被折成放量完成 (87f89d0a95)
- 🔧 工程/其他:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (92a9ec433a)
- 📚 文档:把明文例外域名清单登记进声明面 —— 强度只住在本地 .env 就会在一次整体替换时消失 (9c194f3c00)
- 🐞 修复:门 273 遮罩识别补三格 —— 遮罩不再被计成缺按压反馈(HEAD 面 h2 3→0) (759ca70c1e)
- 🐞 修复:开发者绑定一族五格补属主过滤 —— user_id 住在表里,这一族本就可以收 (ce0ae6c9a1)
- 📚 文档:auto-triage 自动登记(api-logs;第 1 期感知层产线动作,O65) (6cbb66b189)
- 📚 文档:压缩守门速查节冗余重复登记、修复失真读数,使体积回到门207预算内 (d3c9ef1f14)
- ♻️ 重构:评论管理面的特权判定收归单源 —— 摘掉本仓最后一枚自带 ADMIN_ROLE_ID 常量 (1f7b651270)
- 🔧 工程/其他:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (ce9af1cfd6)
- 🐞 修复:迁移容器不再以 root 运行 —— 它全程只握着 DATABASE_URL 这一枚生产凭据 (6d9dd26e57)
- 🐞 修复:提现审核的审计主体改从令牌主体取 —— reviewer 不再住请求体 (2e16754244)
- 🔧 工程/其他:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (f23f5fb6df)
- 🐞 修复:五个镜像页取词/功能面与共享屏齐平 —— 镜像保真缺口 17 → 0 (b4794da004)
- 🐞 修复:个人号池反向同步端的内部凭据比较改走 secretsEqual 单源 (5f0bea107c)
- 🔧 工程/其他:根护栏清单按 HEAD 面重封 —— 解开部署环的 fail-closed (e454818278)
- 🐞 修复:两格裸 httpx 取远端可控 URL 补 SSRF 逐跳复检(入口一次 + 每跳一次) (b3099dee1c)
- 🐞 修复:CI 安装步逐字钉版 + 门 48 新增规则 C 把这件事变成机器闸 (630198fe57)
- 🔧 工程/其他:ruff 全量归零(41 机械项 + 3 手工)—— CI 的 Ruff job 直接原因 (2665af9c69)
- 🐞 修复:收口 9095「今日已签」语义 + 第四条回灌腿(minimax)归属缺陷 (e561910994)
- 🐞 修复:补 @rn-shells/DeveloperScreen 类型声明 —— 修壳化落地后的 tsc 红臂 (9da200af08)
- 🐞 修复:rules 面五格裸端点补端点级身份 + /api/rules 进"配置重开不了"的地板名单 (70955c9eb5)
- 🔧 工程/其他:补 test_codebase_indexer_ignore_channels.py 溯源水印 (7995b0f539)
- 🐞 修复:一键登录的明文流量从"整 App 授权"改成"按域名开、默认关死" (0ae5f24bec)
- 🐞 修复:红项按文件归因改走 TAP location，根治 junit file= 在本机恒空转 (1421e386b8)
- 🐞 修复:补上 torpx 夹具里那处未接管 stdio 的 git 派生 —— 门 193 现读点名的一处裸奔 (1d7a026b66)
- 🚀 新功能/改进:目录级递归前像 dir_rhash —— 缺口表 #1 落地(超越 qoder/trae mtree 设计) (1f4956f07b)
- 🐞 修复:补齐小程序 compat 层的四类类型缺口 —— 跨端共享包在小程序宿主下少红 17 条 (f2ac8cf1b5)
- 🐞 修复:两处"外部串直接当路径用"收口 —— 规则删除的任意 .md 删除、git 面的跨目录只读泄露 (2f2511c4f3)
- 🐞 修复:上下文/记忆族的归属只认令牌主体,客服工单 admin 面自带本地闸 (abc0baa402)
- 🚀 新功能/改进:号池隔离盲区监测器收口 D1-D6 + 守护 sweepPoolIsolation 接线 (2026-11-01) (115028214b)
- 🐞 修复:回跳落点必须交出一份第一方落点集 —— 新增门 278 并把 OIDC 自动回跳收到同源 (85ca07c5a9)
- 🐞 修复:torpx 镜像件派生 git 未接管 stdio —— 门 193 唯一红点 (a7039c0c1a)
- 🚀 新功能/改进:工具面能力门 + 索引剪枝回执(缺口表 #7 落地) (4b4fb09283)
- 🐞 修复:根护栏清单按已入库的门 48 规则 B 重封 —— root-guard 不再 fail-closed 挡部署 (674da0c573)
- 📚 文档:复摘 P84/P85/P86 三条僵尸行 —— 结清提交被整份取对侧的合并抹掉后又被回捞腿带回 (b5f0bd106c)
- 🐞 修复:qoder/workbuddy 回灌同型收口 —— 目标行改唯一行并按主键写,本机号落个人池时不再另建运营池行 / 不再恒"池内没有该 uid" (43e9e4a3c3)
- 🐞 修复:悬空导入门两处假阳收紧 + 清掉 seed 里指向未实现特性的三处悬空引用 (d92645f737)
- 📚 文档:结清 P84/P85 —— ai-service 索引 ignore 判据与改名检测已入库 (e91e4492eb)
- 🐞 修复:Toolbar 浮动余量判据改按设计令牌解析 —— 代码按规范写了,判据却"失明" (253c6e8ca8)
- 🚀 新功能/改进:索引面接 ignore 判据 + 代码检索改名检测(票 P84/P85) (789a23b8e0)
- 🐞 修复:object-space-merge-cap 的派生口补 windowsHide 默认值 —— 门 52(blocking,stagedTriggers **/*)不再全仓逼人跳门 (40f4a89a70)
- 🐞 修复:Trae 回灌按唯一目标行并精确到主键 —— 本机号已被个人池持有时不再另建运营池重复行 (4e72e8bf14)
- 📚 文档:结清 O62819(门 128 几何维 CSS 变量解值 + torpx 夹具按新 HEAD 重订) (b2b6ee5909)
- 🐞 修复:钉 @vitejs/plugin-react 到 4.x + Dockerfile 补 COPY ui-native —— e2e/ci.yml/Build Docker 三条真红同批收口 (c67e18d095)
- 🔧 工程/其他:门 128 的 torpx 镜像件 C2 改吃生产面取证(夹具不得比门瞎) (9434c8a932)
- 🐞 修复:4 处 pressFeedback 迁到 Tappable —— 补完 RN 0.86 迁移尾巴,typecheck 归零 (230b6d63dc)
- 📚 文档:结清 O62819 / O67 / P86 —— 门128 工具类模型与门84 混合陈旧底稿拦闸已入库 (b673b33bef)
- 🐞 修复:三处登录端点对"账号不存在"付出等代价口令校验 —— 堵掉耗时面的账号枚举 (b5aaf7e5bc)
- 🚀 新功能/改进:web/小程序腿接可解析工具类模型 + 几何维重锚(票 O62819/O67) (ca00ed0f39)
- 🐞 修复:内部服务鉴权的老门加使用留痕 —— 关它需要证据,而它今天是静默的 (fe7f193699)
- 📚 文档:补第廿一条欠账 —— 同仓索引租约、快照自证六档、检索金标双命名空间打分写进能力面 (484c798d84)
- 🐞 修复:门7 依赖碎片化改差值口径 + 修好从 10-26 起长期烂着的镜像夹具 (aa460475d0)
- 🐞 修复:转壳判据补上 useEffect 承载标题那一形,标题节律同批保住 (cdb29d00b5)
- 🔧 工程/其他:补摘 2 处冗余默认导出(AboutScreen / ClientOnly)—— knip duplicates 维收口 (6ab2605046)
- 🐞 修复:两枚镜像的构建期供应链全部钉版 —— 可变 tag、未钉版安装与 `curl | bash` 清零 (c042ae8041)
- 🐞 修复:派生自愈腿 i18n 一族只交变化集给落地器, 4 份"盘==HEAD"的 CDN 载荷曾把真变的 3 份堵在后面 (5ff60c00c4)
- 🔧 工程/其他:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (3ec38ed5ea)
- 🐞 修复:生产 next build 通过 —— 类型增强显式进 web 程序 + 删死引用 + 补 transpilePackages (98ce4e6d43)
- 📚 文档:认领 O62819(torpx 夹具按新 HEAD 重订)—— 镜像件现读 3 条红(C2/C3/C8),成因已量清:夹具的档表面比门的生产面窄(只喂 spacing,未并 cssTierPxFrom),而旧反例载体 ScreenStates 的 400rpx 已被落档批改成 var(--spacing-3xl) ⇒ 按 HEAD 硬钉的 [15,200] 与「onlyRn=0」双双腐烂。本轮把取证面改成与门同形、并把「反例不得变绿」这一腿换成行为推导而非字面数字。 (394c9b1a34)
- 🐞 修复:再摘 499+11 枚死键(回补提交把它们搬回来了)—— 五端实测归零 (ea9c9e6624)
- 🚀 新功能/改进:补「混合陈旧底稿」行级拦闸(票 P86) (8aa1a3ddfa)
- 🐞 修复:全仓归一 react-native 到单份 0.86.2 —— 修好 next build 类型面最后一处红(部署阻断真因) (e4beec16d3)
- 🐞 修复:兜底鉴权闸缺省档随运行时武装,并停止抢在内部凭据之前判死(实测线上第一方回调被 401) (bc15c99664)
- 🔧 工程/其他:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (eb846d39cb)
- 🚀 新功能/改进:id_native 轨首次可判 —— 同 id 索引(bench/score_id_native.py)(逆向复现超越 goal-b47) —— runner 头注早就写着「哪天仓内真落了同 id 的索引,这一轨自动点亮(判据现算)」,本件就是那把索引:检索宇宙换成本仓 ParentChildChunker 现算的父块、id 用它自带的十六位 chunk_id,不改判据、不做位置配对、不抄 id 表。现读:金标二十八枚 distinct id 复现二十七枚(未复现那枚是随正文变过的陈旧 id,题目与原因逐条点名),二百六十四题里判定二百六十三、判不了的每条带原因名;MRR 零点八一二、hit@5 零点九四三、nDCG@5 零点八四二。指标一律 import retrieval_eval,本件不自带第二份公式(有用例按源码锁这一条)。全程零连库零网络 (7a35b76a1a)
- 🚀 新功能/改进:门 131 补 F3「函数先起名再当 style 传」一档, F1 的内联正则对这一型全盲 (72e36cc58e)
- 🐞 修复:提交面回退巡检的日志判语跟着臂次走 —— partial 型不再被念成"与祖先逐字同形" (8504f90ce0)
- 📚 文档:结清 O22819 —— 侧车改判出口已具备声明式契约 (6e5044df0f)
- 🚀 新功能/改进:侧车归属改判出口补齐三处契约缺口(票 O22819) (4be834eeeb)
- 🐞 修复:自动化配置缓存与调度任务镜像补封顶(只写不读那型再消两格) (09e1678f43)
- 🚀 新功能/改进:run-script-tests 补上「红项 → 文件」归因 —— 252 枚红从此有靶子可打 (3f656a28ea)
- 📚 文档:登记提交链缺口「混合陈旧底稿绕过门 84 R1」—— 本席一枚提交实测吞掉他人 55 枚已入库行并当场回补,判据定义外的这一型从此有人盯 (96088b6edd)
- 🐞 修复:49 枚工作流的 GITHUB_TOKEN 权限面收进顶层声明,并装上门 48 规则 B (304b03ace2)
- 🐞 修复:回补被上一枚提交吃掉的他人已入库件(团队任务表面「队数封顶与逐出」那段安全强化,五十五枚行) —— 成因如实写:上一枚把工作树那份滞后副本整文件交回,吞掉了别人已入库的内容;它没被门 84 拦下不是判据该改,而是那一条判的是「暂存 blob 逐字节等于某祖先版本」,而我这份是「陈旧底稿加我自己的新增」的混合体,结构上落在它的定义之外。正解顺序是先取父提交 blob 把他人内容整段保回、再只把自己的响应面字段重新加一次。现读:五处逐出符号回归、相关用例绿、mcp 族 一七八例绿 (4710182cc9)
- 🐞 修复:index_codebase 响应面接齐三代结果字段并上逐字段完整性钉 —— 遍历通道、快照自证、租约档三代各往 IndexResult 写了字段,而工具响应用的是手挑 key 清单,三回都没抄进去,于是「降级过/自证失败/被租约挡住」在端上与「一切正常」同形;新用例不再测某一个字段,改测「IndexResult 每个字段必须出现在响应里」,不靠人记得手抄。二百三十二例绿、mypy 六百八十二源文件零错 (6534b09698)
- 🔧 工程/其他:金标缺陷答案重标器与前后对比基线(逆向复现 goal-b47,收编席 V 交付) —— 先更正本席派单时的成因假设:那九十五条缺陷题过去根本不在分母里,不是压低召回,而是百分之三十六的金标从未被打分(覆盖缺陷)。补齐后可判从一百六十九升到二百六十四,Recall@5 反升两点零三分、MRR 降两点五五分,检索腿的真实缺口因此才量得出来。重标只取源文件逐字切片,全量二百六十四条断言期望串是其源文件子串(本席另跑一遍复验),原金标件 sha 恒等未被改;取不到时移出打分集并计数,不静默删也不冒充答错。顺带定位到 id_native 轨出路:金标二十八枚 id 就是本仓 ParentChildChunker 的父块 id,现读复现二十七条,漏的一枚是随正文变过的陈旧派生 id。用例十例绿、ruff 通过、mypy 六百八十一源文件零错 (60eb0cbaa6)
- 🐞 修复:夹具闭包推导器把注释里的举例 import 当真边收 —— 一型毒红整片套件的 8 枚用例 (0c99ef30c7)
- 🚀 新功能/改进:同仓索引加租约层做单飞行(逆向复现超越,对齐 T9 的 startSync/refreshLock/endSync 串行协议) —— 本仓此前根本没有这一格:懒索引闸门与 index_codebase 两条路都会发起整仓索引,同仓并发就是各花一遍 embedding,还会抢同一枚临时快照名。并进去的那轮在响应上写 lockState=coalesced-waited;等过窗口返回 over-window 并点名本轮未开工(零索引数不得被读成没东西可索引);跑完即摘牌,所以不存在拿到陈旧结果的通道。测试顺带咬出第二枚真缺陷:并发 replace 被瞬时锁挡下时旧代码只 debug 级留痕并把临时件留在盘上,现改为出声并自清。索引族 一五九例绿、ruff 通过、mypy 六百八十一源文件零错 (a208022b4d)
- 🐞 修复:凭据脱敏闸接到 api 根 logger,并把 BYOK 的 Google key 从 URL 移进头 (99e7ed1d32)
- 🚀 新功能/改进:装上提交面「内容整片退回更早版本」的只读巡检尺 —— 本会话第三起损失的根因格从此有人看 (0082da2004)
- 🐞 修复:平台凭据不再进 URL,并给两条落盘链各接一道凭据脱敏闸 (0e208a6d07)
- 🐞 修复:畸形 ignore 模式不再把整次骨架装配带崩(本仓真档实测复现) —— 上一枚提交里我写了「生成产物全进骨架」这句成因,这枚把它量出来并修掉自己埋的雷:结尾单反斜杠的字符集合按字面量处理,其余编不过的模式跳过并把出处点名到规则文件行号,坏模式不连坐同文件的其它规则。现读实测本仓工作树面:同一份两千 token 预算下源文件从三十枚升到一百七十三枚、目录行从三百四十七降到一百一十六,另有三千零七十九条被剪条目带出处可答。四十三例绿、ruff 通过、mypy 六百八十一源文件零错 (cd32863fb6)
- 🐞 修复:项目百科缓存与团队任务板补外层键封顶 —— "内层有上限、外层键没人管"那型再消两格 (8e6903090f)
- 🚀 新功能/改进:Merkle 快照读回补自证档(逆向复现超越,对齐 T9 逐字段校验并拒绝截断文件那一格) —— 旧口径把打不开、形态不合、尾部截断一律塌成空表,于是响应上读起来像增量完成,实际白烧一轮全量向量,而且删除集的分母一起变空、幽灵切片永不清理。现在写侧带 schemaVersion 与 fileCount,读侧除了比条数还要拿 files 重算 merkleRoot,六档形态收成一份单源清单并随响应回传 snapshotState;自证失败那一档本轮刻意不清幽灵、也不冒充清理过,原委写进 errors。新增九例、索引族套件 一三九例全绿,ruff 通过、mypy 六百八十一源文件零错 (b655b3eaa2)
- 🐞 修复:销一枚溯源水印 HEAD 面欠账 —— 门 47 在 CI 钉版本那枚提交的复跑里抓到 (4ec0770e47)
- 🐞 修复:CI 的 248 处第三方 Action 引用全部按提交号钉死 —— 可变标签是签名发布链的远程代码执行面 (671a0e6a47)
- 📚 文档:登记两格逆向复现残余(索引面 ignore 接线、改名检测)—— 上一枚提交信息说了「已另开票」,这一枚就是那张票 (1aab7fd5ac)
- 🚀 新功能/改进:ignore 规则判据层落地并接进目录骨架装配(逆向复现超越,对齐 T12 原生层 ignore 三文件族剪枝) —— 本仓此前刻意给 rg 传 no-ignore 换两通道对账,代价是生成产物全进骨架与索引;现在规则求值收成一段纯函数、在枚举之后统一过一遍,所以两通道对 ignore 的判断在结构上不可能不一致。剪枝带回出处(哪枚规则文件的哪一行),规则文件读不动或超上限逐条点名不当没发生。索引面这一格刻意没同时接线:本仓存在跟踪但被 gitignore 覆盖的路径(守门 236 就是为这型立的),一口吃进去会让这些文件静默从索引消失,已另开票。三十一例绿、ruff 通过、mypy 六百八十源文件零错 (978b6f7854)
- 🐞 修复:文件版本表补外层键封顶 + watcher 名额闸排在起线程之前 —— 同族第 5 批 (3c3943773e)
- 🔧 工程/其他:回调机主批准的临时放宽 deploy.minutesPerDay 720→480(含现场读数与真因) (ed59167b4a)
- 📚 文档:登记 render_repo_tree 目录骨架预算装箱与代码检索双腿融合(补第廿一条欠账) (b64a2c1b1a)
- 🚀 新功能/改进:新增 render_repo_tree 按 token 预算装箱仓库目录骨架(逆向复现超越,对齐 Qoder mtree 的 renderTree) —— 枚举走 rg_fallback_parity 单源出口不写第二遍遍历,预算先保目录骨架再补文件,削掉的文件与被 scope 排除的条目分格计数并以 complete 与 dropReason 出声,token 估算复用 context_compaction 不另立第二把尺;渲染钉十二例加接线钉五例共十七例绿,ruff 通过、mypy 六百七十九源文件零错 (0de483bff6)
- 🐞 修复:会话级内存账本补外层键封顶 —— 准入留痕只增不删 与 产物"成功也镜像"两格一起收 (8ad1b44ec4)
- 📚 文档:T12 mtree 原生面与钩子宿主取证结清(席 S 交付、本席复验) —— napi 导出实测二十三枚并据此更正 T9 的二十四枚,快照双哈希与 ignore 三文件族在原生层判定,hook 宿主是 Rust tokio 薄壳(导入表无 CreateProcess、无网络栈),钩子契约两个拐点(承载体换原生 exe、事件面从二档扩到五档并首次出现 matcher),缺口对撞表八条含七条真缺口 (18be313f02)
- 🐞 修复:PR diff 缓存补键上限与真过期 + 原语加"新鲜度/会话"两档语义与晚绑定时钟 (4e7177bb74)
- 🔧 工程/其他:归档处置镜像三例按"仍可达的两格"重写 —— 正控前提已被归并层自己吃掉,套件回绿 (e751da2b37)
- 🐞 修复:进程内存储补"键数上限+滑动寿命"原语并接三处 + 更正我上一批过粗的 MCP 角色闸 (9ef49a8476)
- 🔧 工程/其他:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (654a48986a)
- 🚀 新功能/改进:检索金标召回基线 runner 与首份基线件(补齐"指标与金标都在、从没见过面"那一格,逆向复现超越 T9 分档阶梯) (0d5f41b9ba)
- 🐞 修复:收编器补上「部分回退」臂,并修好两条从未被递达的探针 (8af02b64e8)
- 🐞 修复:收敛零丢失判据的空行口径收口 —— 修掉一道把同步链整体卡死的与内容无关的红 (9bb933f627)
- 🐞 修复:file-transfer 两处出网补 SSRF 闸 —— 已导出的通用工具不该指望未来调用方自觉 (8991a5434e)
- 🔧 工程/其他:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (6bdbc1885c)
- 🚀 新功能/改进:代码检索改双腿并跑加权融合加降级具名出声(逆向复现超越 #10,对齐 Qoder 五档召回阶梯) (a898e78057)
- 📚 文档:F9 让号 —— 本侧未推行让给已入库同号(门 203 同题跨号禁止),改前整行逐字入归档件 (64d9562895)
- 🐞 修复:技能库导入/评分面补容量·份额·归属 —— 单人写爆内存与刷高均值两条通道一起关 (4738b9dcf2)
- 📚 文档:固化本轮 16 份席位交接件出 gitignored tmp,落在本轮取证册同族路径 (05e018e583)
- 🐞 修复:三条产出发布物的 CI 链收口到 --frozen-lockfile —— 签名/发布路径不再静默重解析依赖 (dd437a0463)
- 🐞 修复:网络段内网强制锁把某一代写法当契约,实现加强后它自己恒红 (e534238946)
- 📚 文档:只读尺清单同批登记本会话新立的两把尺(检索召回质量尺 + AI 归属读侧聚合) (2743fd398f)
- 🐞 修复:AI 归属主体缺失时不再静默跳过(读侧尺子量出"接线在而零落笔"后的补刀) (2b81e939a7)
- 🐞 修复:ReDoS 闸补齐另外两处调用点 —— 长度闸门挡不住 7 字符的病态模式 (c5487c1ce9)
- 🐞 修复:上一枚回补落地后受影响判据点名门 2f-miniapp-taro 判红,就地补 ko parity —— 反算把 zh-CN 三枚键请回而 ko 缺同键(utilsMiniapplogin.alipayUnsupported / webViewPortal.artifacts / identityVerify.submit);按 i18n 流水线正牌路径自主补译 ko 三条(术语对齐包内既有写法 알리페이 / 산출물 / 인증 제출),经 i18n-apply --target=miniapp-taro --check-first 写入,派生态同批重派(gen-i18n-compressed;en/ja/zh-TW 的 b64 与基线逐字相同故不入声明集)。有意留痕:ko.json 含上一枚从祖先回补的 565 行,按守卫的尺即「行级复活」,而窄清单通道 LAND_RESTORE_MANIFEST 对 .json 只受理数组元素级、字典键级还原不受理 ⇒ 走出口② LAND_ALLOW_STALE=1 显式放行(与枚 fa2b5a4082 同一理由的续格),其余判据一道未跳。末行现读:i18n-diff --target=miniapp-taro 报「无 pending,所有语言 parity + 翻译完整」,i18n-apply 自报 parity 通过。 (af54b80080)
- 🔧 工程/其他:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (a05583509c)
- 🐞 修复:WebView 落点信任闸上收共享层 —— RN 不再把会话授权码签给任意 origin (5cfcb917de)
- 🐞 修复:回补被收编扫描整片抹掉的 2915 行翻译(cli 状态词+小程序五语包+web),派生态同批重派 —— 枚 f9fb2e4ceb(2026-10-31)入库六小时后被枚 f0572d64c4(2026-11-01 00:40 chore(i18n) 收编停留≥3分钟未提交改动)反手抹掉,同枚还削掉 miniapp-taro 五语包各 586 行与 web 各 2 行,合计 2915 删除;现读 cli 包键数 66 掉到 52,packages/types 词条镜像用例红在 HEAD 面(zh-CN 缺 cli.failureOutcomeRetryable ⇒ 五语言全缺)。这与本轮已修的 G-24 归档保留档(枚 9fdbc207ba 抹)、G-44 告警身份单源(枚 9fdbc207ba 与 b41b9fdce8 抹)是同一把按滞后副本写回的刀,本枚只结清语言包这一格,扫描器自身缺守卫另行处理。修法:对 f0572d64c4 那 15 个文件逐字节反向应用(只撤其 hunk),再走正牌生成器同批重派三个 gen.ts 与四个 CDN b64。有意留痕:19 条路径的新内容按定义等于被抹前的祖先 blob(还原的目的就是回到那一形态),窄清单通道 LAND_RESTORE_MANIFEST 只受理行级与数组元素级、JSON 字典键级不受理,故按落地器出口② LAND_ALLOW_STALE=1 显式放行并在此写明;其余判据未跳。差集可核:cli 每包回补 15 键、miniapp-taro 每包 565 行、web 每包 2 行。末行现读:packages/types 词条镜像 10/10(改前红),check:i18n-keys 五语言 parity OK,离线包自述钉 matched。 (fa2b5a4082)
- 🚀 新功能/改进:检索召回质量只读尺 check-retrieval-quality(为双腿融合改造先立验收判据,判据先于改造) (3ac3595549)
- 🐞 修复:notify(email) hook 不再"未投递却报成功" —— 审计/告警通道的终态必须诚实 (09ee10ea92)
- 🚀 新功能/改进:AI 代码归属读侧聚合出口 ai-authorship-report(补"只有写侧没有读侧"那一半,并量出写侧一枚都没落过) (1e49ec1740)
- 🐞 修复:入口把本包自己的 nativewind env 拉进类型程序 —— 补上双份 react-native 那一格 (6239f00e6f)
- 🚀 新功能/改进:agent 工作簿读写工具面入库(对齐 Qoder xlsx-sidecar 的 open/read_range/write_cells/save/close) (d96d43d00d)
- 🐞 修复:回补被两枚同步提交整片写回的 G-44 告警身份单源(部署腿+监控腿),HEAD 面三处恒红转绿 (e9134d30e2)
- 🐞 修复:USDT 验签改走单源常数时间比较 + 未注册的 organization 路由就地补角色闸(堵 fail-open 陷阱) (64c87d8b42)
- ♻️ 重构:web 端字号统一落盘 —— 只落可证恒等的 3877 处(font-weight 锁档) (46cd4f9051)
- 📚 文档:F9 让号 —— 本地两枚未推行 O67 让给已入库的 O67(门128 CSS 变量解值),原行逐字入归档件 (87b3f475e1)
- 🐞 修复:匿名语音上传补上限读取 + 外部 MCP 的 url 通道收归管理员 + 限流补档 (0448b4f43c)
- 🐞 修复:工作区沙箱补齐 git 出网闸 + 集成代理不再让 path 改写落点 + grep 接嵌套量词判据 (555f539da8)
- 🔧 工程/其他:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (92428cbd6d)
- 📚 文档:细节能力清单第 32/33 条登记插件更新判据层与安全扫描 hooks 接线(AGENTS §21 新增端能力必须同批更新 README) (572470b674)
- 🔧 工程/其他:门 273 自检⑯ 的 H3 资格锁改判 HEAD 面 —— 别让别人的滞后盘钉红我的自检 (079a6825a2)
- 🐞 修复:门224镜像按固定缩进取注册条目,一枚缩进漂到三格的收尾把两条目读成合并体 (35426d5dc9)
- 🔧 工程/其他:摘掉本席那把重复镜像锁 —— 同一判据由 O67 的 lib 单源承担,不留第二把 (1e441b5cfb)
- 🚀 新功能/改进:插件更新判据层 checkUpdates 与 planUpdate(补齐 G-22 autoUpdate 残腿,把门 277 接成供应链防线) (23e52bc8bf)
- 🚀 新功能/改进:安全扫描判据搬出命令壳并接进 hooks 两腿(逆向复现超越 G-12,对齐 Qoder security-scan 插件) (60af71ad11)
- 🚀 新功能/改进:工作簿读写服务面入库(收编中断席位可用的半格,主席补类型收口与 lint 修正) (5dc42a3a28)
- 🐞 修复:让号 O67→O62819(合并新增撞号) —— 改未推本地一侧 1 行,改前原文留痕入归档件 (7a7e57708d)
- 🐞 修复:备份落点探测锁把 G-50 的加强读成缺失,HEAD 面两例恒红 (9f1dc08fcd)
- 🐞 修复:terminal_run 补上参数面收敛与沙箱 cwd —— 白名单内命令不再能读走仓库根的 .env (ae1546014a)
- 🐞 修复:门104把位置比对的行数当漂移量级报,11行真差被读成213行 (9db11efbdc)
- 🐞 修复:共享 RN 屏的类型程序自己挂上 className 增强 —— 结清 138 条类型红 (089130c719)
- 📚 文档:细节能力清单第 31 条登记桌面输入动作族与两道内置门(AGENTS §21 新端能力必须同批更新 README) (7460082e2f)
- 📚 文档:T8 把「对侧没有人工审批门与速率闸」降为分层表述(执行席否证主席派单断言,据实采纳) (04a1c90db6)
- ♻️ 重构:web 端字号统一落盘 —— 只落可证恒等的 3877 处(font-weight 锁档) (5988f4cd4b)
- 🚀 新功能/改进:operator.rs 补输入类动作族与两道内置门(对齐 QoderComputerUse 动作面,逆向复现超越 T8 §A) (55744315c8)
- 📚 文档:O67 就地改写为精确剩余项 —— 原点名的两条红已随枚 88bd07c0c0e 结清,剩下的是 web/小程序腿工具类未建模那一格 (975a26574f)
- 📚 文档:点名 check-qoder-session-sync-task.mjs —— 消掉 HEAD 上唯一一枚 R4 恒红(已接线而文档隐形) (94c7251d4b)
- 🐞 修复:登录/注册回跳收成"同源 ∪ env"白名单 + 证书打印窗转义 —— 堵掉带会话外跳与同源弹窗执行面 (fca5f7a796)
- 🐞 修复:完成即删兜底轮把号段租约行当滞留票吃掉,千段租约的占用账被清空 (adf3f7e9a8)
- 📚 文档:更正 Trae 册「消费方接线仍被在飞面挡住」这句过期账(写侧已接、缺的是读侧) (6d3b02600c)
- 🐞 修复:补两枚 keyboardShouldPersistTaps —— H3 绝对零容忍维回到 0，顺带修"键盘抬起吞一次点击" (28769216be)
- 📚 文档:按 T10 复核就地更正三处内核数字(16值/89迁移/145下限)——错误读数留在在册文档里就等于给下一席发错票 (19b19eb030)
- 📚 文档:T10 复核 Trae 内核五条推断级读数 —— 推翻两条并给出逐枚偏移实锤(逆向复现超越的取证纪律腿) (d501ae2f64)
- 🐞 修复:入口的 nativewind 类型增强改成注释指令 —— side-effect import 让打包器必炸 (bf1396e524)
- 📚 文档:T9 Qoder 检索引擎实现级取证 + T8 对照架构图凭据(逆向复现超越的取证腿收口) (e90fe71010)
- 🔧 工程/其他:.ihui-agent/tmp/rn-hyg/msg-renum.txt (11dc40379b)
- 🔧 工程/其他:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (9c73e2d913)
- 🐞 修复:清掉 HEAD 面一枚水印欠账 —— apps/api/tests/relay-account-pool-keepalive-forever.test.ts (c0958c47c7)
- 🚀 新功能/改进:ui-native 四原语补按压 + 两条按压通道深浅并成一档 (e63c5c17e7)
- 🔧 工程/其他:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (7ae43b698d)
- ♻️ 重构:web 端字号统一落盘 —— 只落可证恒等的 3877 处(font-weight 锁档) (22d67096b3)
- 🚀 新功能/改进:手工批 5 文件 8 枚 —— 含门 131 漏判的"命名函数 style"这一型 (8f8b994f80)
- 🚀 新功能/改进:三端落档腿装车齐 —— web 那一侧补上调度器,并把它独有的安全旗写死在 argv 上 (eab90b40e2)
- 🐞 修复:门 128 几何维补上「CSS 命名档」这一腿 —— 落档自动化推进到哪,尺子就跟到哪 (cc6f9ee29d)
- 🚀 新功能/改进:按压反馈批 34 文件 62 枚 —— 死样式清掉、函数形态拆成设计档两参 (d58e272801)
- ♻️ 重构:web 端字号统一落盘 —— 只落可证恒等的 3877 处(font-weight 锁档) (695a08c77f)
- 🔧 工程/其他:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (9fdb4b7b3b)
- 🚀 新功能/改进:Tappable 加 pressedStyle 档 —— 修样式不许顺手改掉设计档 (06b84c8012)
- ♻️ 重构:web 端字号统一落盘 —— 只落可证恒等的 3877 处(font-weight 锁档) (a70cb9c766)
- 🚀 新功能/改进:号池永久保活档 —— 机主本机 Trae 号进池并给它一条不会死的续期路 (a6179dd4a0)
- 🐞 修复:门 273 不再把函数形态 style 当作已有反馈 —— 与门 131 停止互相打脸 (8b50a87750)
- 🚀 新功能/改进:人工批落 24 枚 —— VoiceNote/HomeScreen/ChatScreen/ImageAnnotator 全换 Tappable (2ffa442d8b)
- ♻️ 重构:剩余字号任意值落档 350 处(500~700 字重档)—— 小程序端字号面清零 (dcf297e539)
**2026-10-31**
- 🔧 工程/其他:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (b6cd06f203)
- ♻️ 重构:字号任意值落档 620 处(仅 400 字重档)—— 项目档消费率 53.3%→约 62% (3a42b19b63)
- 🔧 工程/其他:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (c1cb851e27)
- 🐞 修复:补回试点批漏挂的 Tappable import 的另一半 —— 摘掉没用到却挂着的 (908a5ba821)
- 🚀 新功能/改进:按压反馈重铺 72 文件 220 枚 —— className 走 active 变体、原生走 Tappable (35868ba148)
- ♻️ 重构:尺寸/定位属性与内联 style 的等值落档 —— 项目档消费率 50%→53.3% (0509c5a60f)
- 🚀 新功能/改进:守门 273 的遮罩档接上第二跳 —— styles.KEY → 命名 token，现读消掉 28 枚误判 (5213aee5cd)
- 🔧 工程/其他:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (0147b013b9)
**2026-11-01**
- 🔧 工程/其他:重封根护栏清单 —— 6f57e57fe6 的守门277 注册改动合法但漏了 seal,部署环 fail-closed (3dfd9975ba)
- 🐞 修复:归档落点器的保留档能力被一枚清理提交整片写回旧基线,镜像测试空等6天 (17a1d45836)
- 🔧 工程/其他:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (785700f1ea)
- 📚 文档:T7 派单索引更新到本轮现场 —— 交接面(防上下文断档丢现场) (54942dc36d)
- 🚀 新功能/改进:门 128 几何维认得 CSS 变量解值 —— 两族 var 假分叉撤豁免、零分叉族摘锚点键 (88bd07c0c0)
- 🔧 工程/其他:摘 38 处冗余 default + 4 个桶的无人转发出口 + 两枚 OS/装载型登记 —— 棘轮 6/7 维转绿 (735334d665)
- 🔧 工程/其他:摘掉门78里一枚取了没人消费的读数 externalScanned —— 它在 audit 内已随结论行印过,main 侧再解构一次既不打印也不参与判据,却把 eslint 顶成1枚error(lint-staged 只查暂存面⇒存量红一碰这文件就现,上一枚提交因此被逼走 --no-verify 并留痕) (a92aa52da3)
- 🐞 修复:门78深扫档把pnpm跨平台可选变体判成401条悬空红——判据假阳(§12e恒红门) (3feeb2ae4e)
- 📚 文档:auto-triage 自动登记(api-logs;第 1 期感知层产线动作,O65) (a1e6e0e784)
- 📚 文档:T8 两枚 Qoder sidecar 原生面取证(Ghidra headless 级,逆向复现超越本轮的取证腿) (e2a418dd84)
- 📚 文档:auto-triage 自动登记(api-logs;第 1 期感知层产线动作,O65) (61e2fa79a8)
- 📚 文档:守门点名索引补门 277 一行(门 89 R4 义务,与接线同批) (7d386b2826)
- 📚 文档:T3 缺口矩阵补「时效告示」一节 —— 治"按腐烂册面重复派单"(逆向复现超越本轮的防复发腿) (90933dd5ae)
- 🚀 新功能/改进:dev 库口令轮换器补上唯一登记出口 --register(此前全仓无创建出口 ⇒ 下次暴露无人能记) (817e45952f)
- 📚 文档:按机主裁定结清 G-20 与 O68 —— 两项均已完成,整行摘除 (a51d5a1fb5)
- 📚 文档:细节能力清单第 30 条登记 run_workflow(AGENTS §21 新增能力必须同批更新 README) (1eeab01a1d)
- 🚀 新功能/改进:补齐 run_workflow 工具面,对齐 Qoder Workflow/RunWorkflow 的未变节点回缓存重放(G-01) (09fa348a4f)
- 🐞 修复:dev 库口令轮换巡检腿补四处会把它变成死线的缺陷(含一处 fail-open 误判窗口) (f571ea79f0)
- 🐞 修复:号池任务中心"心跳在位"不再被写成"执行成功" —— 与本线已修的四处同族的最后一格 (e28e5f6e4b)
- 🐞 修复:收口被整块重复的登记(F6 块级判据的修复出口) (c64b4566a1)
- 🔧 工程/其他:死 key 存量基线五端下调为 0 —— 存量已实测归零,不留"不会到期的豁免" (5c25e975cf)
- 🐞 修复:补上 mobile-rn 五个词包的死键摘除 + 小程序离线包同批重生成 (eb1dad8a82)
- 🔧 工程/其他:收编停留≥3分钟的 i18n 未提交改动 (f0572d64c4)
- 📚 文档:结清 O69 —— dev 库口令轮换已挂进 guardian 巡检轮 (1502053d88)
- 🐞 修复:G 盘根守护整族跑不动的病根是同一文件写了两条版本声明 —— pwsh 7 在绑参阶段报 Cannot bind parameter because parameter 'version' is specified more than once,install/guardian/status/uninstall 四件一条命令都执行不了;而 VBS 用 SW_HIDE 不等返回、计划任务恒报 LastResult=0,于是这道防线两个月来静默什么都没做(status 件现读 Running: NO 且日志文件从来不存在)。按 §27 保留唯一一条 #requires -Version 7,摘掉陈旧的第二条;修后用 PowerShell 自己的 Parser 全量复验 94 枚 .ps1,bad=0;真跑只读 status 件通过,启任务后守护在 session 0 起进程、日志从不存在变为有内容(v2.0 mode=allowlist-first);顺带把 G 根守护任务按它自己声明的 S4U 复位(此前主体漂回 Interactive,注册器坏了没人修得动 = AGENTS §0.8 那条铁律的现场) (030fa25535)
- 🚀 新功能/改进:dev 库口令轮换挂进巡检轮(票 O69) (b081fa37d8)
**2026-11-01**
- 🐞 修复:CLI 的 V1 配置装配路径接进项目层封闭表 —— 仓库一枚 settings.json 不再能把凭据改道到攻击者主机 (d55306655f)
- 🔧 工程/其他:给新测试补溯源载荷 (L2 头 + L3 尾两行,内容未改) —— 门 47 HEAD 面缺口,工作区已注入待提交 (8f0f4c2b41)
**2026-11-01**
- 🐞 修复:入站身份裁决收进单一出口 —— 修掉三族 v1 路由的混淆代理(可跨租户读代码/写归属) (969b19b054)
- 🐞 修复:门 103 的 D4 接表级例外 + 测试面单向借用登记 —— 例外机制此前对环违规结构性失效(EX-D4 永不命中还自报清单腐烂),补 exPass 并加自检;EX-D4-1 登记 repo-tooling→miniapp 测试借用环;immutable-exempt: 门自身缺陷(例外不覆盖 D4)导致登记后仍红且自报腐烂,补判据链并加成对自检 (25ab228ae7)
- 🚀 新功能/改进:号池永久保活档 —— 机主本机 Trae 号进池并给它一条不会死的续期路 (ee77dea986)
**2026-11-01**
- 🐞 修复:className 类型增强改用 side-effect import —— triple-slash 在 Next 消费面不生效(部署实测) (68c8117b25)
- 🐞 修复:摘除 Z-1 与 RP-79 回捞复活残影共 4 行 —— Z-1 前提已不成立、RP-79 已结清(证据 7908385ffb 结清摘行是祖先 + union-converge-flags 与镜像测试在位) (d6f66d322b)
**2026-11-01**
- 🐞 修复:恢复被旧基线写回的两处已入库修复 —— className 增强与 wb_tasks.not_running_reason (88d43f8c1d)
**2026-11-01**
- 🐞 修复:修复两处已入库的构建阻断 —— 跨端 UI 二期的 className 类型没跟公开入口走、types 漏了 wb_tasks.not_running_reason (6b50c92f5e)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (6453cfd2e3)
- 🐞 修复:让号 O67→O42819(合并时新增撞号) —— 改未推本地一侧 2 行,改前原文留痕入归档件 (d58824d54f)
- 🐞 修复:ai-generation 族队列名接进库身份单源,清掉这一型最后一枚字面量 —— 主库(ihui、未设后缀)解析结果与旧字面量逐字节相同 ⇒ 线上零扰动,这条性质不是口头保证:它调的是被 24 例钉住的同一个纯函数出口(§0.6 单源);本仓 new Worker('ai-generation') 现读零命中 ⇒ 这次改动不构成生产/消费分家(要么两侧都原名,要么本仓根本没有消费者);面纯度已核:E 席那批没碰这族,不存在半接线;两面 tsc 与 eslint 零错,队列契约 29 例仍绿 (14ab2c654c)
- 📚 文档:登记一票=dev 库口令轮换器已入库但未挂调度(窗口靠人盯)，正解照 sweepExposedCredentialRotation 形态挂进 guardian 巡检轮 (03afa371c7)
- 📚 文档:登记一票=门 128 CSS 变量解值根治与 torpx 夹具重订(席位撞轮次上限且改在滞后副本上,产物已存档 seat-k-salvage,须从最新 HEAD 重做) (5e4df4f003)
- 🐞 修复:让号 O68→O22819(合并时新增撞号) —— 只改未推本地一侧 1 行,改前原文留痕入归档件 (395a5e55fd)
- 📚 文档:O68 记轮换器物化进展 —— 器物已入库,执行窗口待机器空闲 (c0ff3a1e79)
- 🐞 修复:收口被整块重复的登记(F6 块级判据的修复出口) (d60e6b85d8)
- 🚀 新功能/改进:本机 dev 库口令轮换器物化(票 O68) (27b7f9e6b7)
- 🐞 修复:入口自带 className 类型增强 —— 止住 CI 构建面 51 条类型红(堵 e2e 与 web build) (6c5f60070d)
- 🐞 修复:守护心跳移到初始启动之前,冷启动窗口不再被判成死亡 —— 一手量数:守护 22:11:13 起、首枚心跳 22:13:53,窗口 160 秒;watchdog 每 2 分钟巡检且阈值 90 秒,于是 22:12:04 派了第二个头,双头并存 109 秒并用 'w' 把 watcher.err.log 截成 0 字节吞掉诊断;另量到常驻期心跳龄 85 秒贴着 90 秒阈值。取「消除零心跳」这一档:单实例锁与第一枚心跳都排在 await run() 之前,此后由真推进事件续写并按 20 秒节流;--check 与一次性体检不写心跳(注定退场的 pid 不许冒充守护);巡检侧阈值 90 秒、2 分钟节律、revive() 调用点一字未动 ⇒ 真死上界仍是 90+120=210 秒未降速;主席补修两枚死变量(heartbeatShouldRefresh 的 freshMs 是无 caller 的装饰入参,删除而非改名;测试里 HEARTBEAT_PHASE_STARTUP 是死解构);新增 17 例并变异自证 (7066570b31)
- 🔧 工程/其他:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (1bd4947583)
- 🐞 修复:其余六族 BullMQ 队列名全部接进库身份单源,号池不再是唯一被隔离的一族 —— 取证席在 Redis db0 实测到同族事故残留 bull:relay-health-check-queue:failed=500,说明 2026-10-24 那笔停摆不只打在号池上;解析层新增语义中立唯一出口 queueNameWithDbIdentity,relayQueueName 退为薄封装(规则表仍只有 resolve 一份);接正 email/notification/ai-callback/notification-dispatch/registry/scheduler/batch/usdt-payment/relay-health-check 九处取名点,观测面 relay-task-center 两枚写死字面量一并改走解析器(该字段会被 admin 路由喂给 new Queue);主库逐字节原名不变用两路取证(契约①逐字比对 + HEAD blob 探针 10 族 3 档);smoke 套件那条等值断言不删只搬到主库 DSN 下的契约①判,原处保留形状与无冒号牙;新增契约用例 5 例、受影响 6 套件 96 例、两面 tsc 均 0 (651283be00)
- 📚 文档:结清 O67 —— safe-commit 发令前点名索引内非本票件已装车 (e9a6a3cea8)
- 🚀 新功能/改进:发令前只读点名「索引里非本票声明的已暂存件」(票 O67) (1a4be3bcb4)
- 📚 文档:登记一票=本机 dev 库口令部分入会话的轮换器物化(现读 DSN 仅 localhost 开发库;红线是前缀也不许进会话,处理口径照 2026-10-26 同类事故=主动提轮换并造轮换器) (56dc3b0258)
- 🔧 工程/其他:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (e119e324f2)
- 📚 文档:结清移动端走查票(首页/学习页区段头几何读数)—— 白屏根因修复已入库 04a5e71d1e:构建后步骤 patch-entry-chunks.mjs 给每个入口补静态 deferred chunk require(幂等+单测3/3,接入 build/build:weapp;干净构建 312 入口/4285 条;getApp()=true、page.data 有 root、首页与学习页完整渲染;主包 1,720,290B≤2,097,152B)。读数:镜像首页 redirect 到 pages/index/index(同一首页、无区段头);学习页「继续学习」自绘头 316×684 截图字高 15px→390 视口≈18.5px(36rpx=18.72),与 spec 16px 差≈2.5px,证实未走 SectionHeader(spec/adapter 半边已由 1394db170f/189f31951f 落地)。automator 的 page 查询对 Taro 渲染树不可用,读数走截图换算。 (62b4253106)
- 🔧 工程/其他:Taro 页面按 app.config.ts 派生 entry —— files 925→350、unlisted 186→4(基线不动) (1e2779b7d4)
- 📚 文档:结清移动端走查票(首页/学习页区段头几何读数)—— 白屏根因修复已入库 04a5e71d1e:构建后步骤 patch-entry-chunks.mjs 给每个入口补静态 deferred chunk require(幂等+单测3/3,接入 build/build:weapp;干净构建 312 入口/4285 条;getApp()=true、page.data 有 root、首页与学习页完整渲染;主包 1,720,290B≤2,097,152B)。读数:镜像首页 redirect 到 pages/index/index(同一首页、无区段头);学习页「继续学习」自绘头 316×684 截图字高 15px→390 视口≈18.5px(36rpx=18.72),与 spec 16px 差≈2.5px,证实未走 SectionHeader(spec/adapter 半边已由 1394db170f/189f31951f 落地)。automator 的 page 查询对 Taro 渲染树不可用,读数走截图换算。 (803d6f8f18)
- 📚 文档:登记一票=提交链所有权盲区(safe-commit 发令前不点名索引内非本票声明的已暂存件) —— 本轮实测两起后果,含 HEAD 一度带 1 failed | 8 passed 的红(已由枚 eb7fbad5ae 结清) (0807e4a16d)
- 🔧 工程/其他:签到面板「自动做任务」补真浏览器规格 16 例(真实 CSP 下全绿) + 一处因果表述更正 (90970468e0)
- 🚀 新功能/改进:把「任务锚点烤进第三方私有目录」变成常驻体检 —— 今天手工修的两枚守护任务只是止血,病根是没有任何一层盯着「任务里烤的是哪枚 node」;ensure-silent-tasks 的任务审计新增 ①c 锚点禁地一档(刻意排在 LogonType 豁免之前:S4U 任务同样会被捆绑 node 拖停,与会不会弹窗无关;Execute 与参数两半都问,真实病形态是锚点藏在 VBS/pwsh 参数里);判据仍单源在 lib/task-node-anchor,巡检器不另写目录清单;锚点测试 8→11 例、巡检器 4→5 例(含接线形状锁);现跑 --check 本机 17 枚任务 0 处违规。immutable-exempt: 只在判据层加新出口与更严的拒绝分支,未放宽任何既有判据 (75428ae4a9)
- 🐞 修复:修好整端白屏 —— 给 webpack 入口补静态 deferred chunk 加载腿。根因(2026-10-31 实测):weapp 为压主包 2MB 上限开 mini.optimizeMainPackage 并摘掉 Taro cacheGroups.common.name,产物里 app.js 与每个页面/组件的入口回调 e.O(0,[…]) 会等二十多个独立 <id>.js;这些 chunk 从未被 require、小程序运行时也不自动加载(动态拼路径实测报 module '…' is not defined)⇒ deferred modules 永不满足 ⇒ App()/页面组件永不执行,表现即整端白屏(getApp() 恒 false、page.data 仅 __webviewId__)。修法:新增构建后步骤 patch-entry-chunks.mjs —— 扫产物里每个含 e.O(0,[...]) 的 JS,把其依赖且 dist 根确实存在的 <id>.js 以静态字面量 require 追加到文件末尾(带 /*miniapp-entry-chunks*/ 幂等标记);接入 build/build:weapp 的 taro build 之后。实测:干净构建 312 个入口共补 4285 条 require;重开 IDE 后 getApp()=true、page.data 出现 root、wx.request success,首页与学习页完整渲染(截图 .ihui-agent/tmp/mobile-walk/{final-render,measure-last}.png);主包 1,720,290B / 上限 2,097,152B(余量 376,862B,check-artifact-budget ✅)。单测 scripts/tests/patch-miniapp-entry-chunks.test.mjs 3/3(层级相对路径/缺产物不补/幂等/无 deferred 不动)。代价:启动时多加载这些 chunk;待 Taro/config 侧能共存后本脚本退役。 (04a5e71d1e)
- 🐞 修复:常驻任务的 node 锚点收成单源,止住「谁跑就烤谁」 —— 今天两枚守护任务长期烤着第三方 AI IDE 自带的 node(…\.workbuddy\binaries\node\versions\…),对方升级或卸载即消失,守护与看门狗会一起静默停摆;新增判据 scripts/lib/task-node-anchor.mjs(纯判据零 IO:优先 PATH 上当次实测的规范 node,取不到且当次解释器干净才如实标 fallback,落在第三方私有目录则拒绝,两者皆无 ⇒ exit 2 未判定,不写死盘符),本台注册器已接;镜像 8 例钉住五型分岔与平台分隔符;immutable-exempt: 新增判据层文件,不改写任何既有判据,只把锚点取值从随进程改成随本机实测 (6c61829ab3)
**2026-10-31**
- 📚 文档:内置 MCP 工具数 24 -> 105(现读 _TOOLS) + 旧 24 枚枚举改指针 —— 本批新增 advisor_consult 后 _TOOLS 现读 105 枚(check-tool-name-display-coverage 105/105);原表里的 24 枚旧名枚举已与注册表严重脱节,改为指向 mcp_server._TOOLS 并列出核心族,避免下次再漂。历史归档段的 24 保持原样(那是当时快照)。其余语言 README 当前不在飞改写中时同批对齐。验证:check-readme-table-integrity + check-doc-numbers 复跑。 (b50d78dc28)
- 📚 文档:G-20 记腾讯云侧真实进展 —— 资质与 8 枚模板已过,唯一卡点签名被拒后已重报(审核中) (10e6e9c8d1)
- 🔧 工程/其他:离线语言包重生成 —— 英文 inviteTitle 去中文残留(Join AI 智汇 community -> Join the IHUI AI community)已由 i18n 收编枚 26e6336 入源;本轮按干净输入面(0 未提交)重生成 3 份 gen + 4 份 CDN 载荷,同时吸收别席已提交的源键。验证:check-i18n-locale-content-language --worktree 候选 0、i18n parity 工作树面 19840 键×5 语言 OK。 (9b9fabfdee)
- 📚 文档:auto-triage 自动登记(api-logs;第 1 期感知层产线动作,O65) (31f8d34ccb)
- 🔧 工程/其他:收编停留≥3分钟的 i18n 未提交改动 (26e6336ec3)
- 🐞 修复:补齐 CSP 修复的另两条路径 —— 上一枚只带进 1/3 声明路径,HEAD 一度带"新断言打旧生产码"的红 (92adf1bb5c)
- 🔧 工程/其他:收编停留≥3分钟的 i18n 未提交改动 (f81ebdc0b6)
- 🔧 工程/其他:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (98eaa34e88)
**2026-11-01**
- 🐞 修复:门 103 契约收口 —— 补 6 处依赖与 9 条公开入口声明、2 处具名豁免(带到期)、archify 目录退出扫描;staged 判红 22→0,自检 138 例绿 (80e11ab999)
**2026-10-31**
- 🚀 新功能/改进:WorkBuddy 回灌腿装成用户态任务 —— 与 Qoder 共用同一把哨兵/派发判据 (ec88d0370f)
- 🔧 工程/其他:部署墙钟上限临时 480→720 —— 机主拍板的单次放宽(发完回调) (73294fc085)
- ♻️ 重构:移除已下线提现端点的 createAgentWithdrawal 封装与孤儿类型 —— 端点已 410、全仓零调用点(删前三问已答),api/web tsc 零错误 (b80a3b0c32)
- 🔧 工程/其他:补 webview 承载页降级回归 —— 非信任 URL 分支必须复制链接且不调 setUrl (33ff9af8c7)
- 🔧 工程/其他:根护栏清单与 HEAD 面重新对齐 —— 解部署环 fail-closed (5cd9e86ffe)
- 📚 文档:安全强化 goal R12 结账注记 —— 四枚提交已入库且 origin 同步(4b32f83f9c) (6705507975)
- 📚 文档:撤掉重复的 R10+R11 合并注记并把两条正本里的短 sha 补成 40 位 —— 逐行自证仅删 1 行+两行 sha 替换 (449c5ec1ff)
- 🔧 工程/其他:修 message_bus 单跑必炸 —— autouse mock 先把 app.main 惰性导入走完再替换 httpx.AsyncClient (4b32f83f9c)
- 🐞 修复:守门276 接正取材面档位并接通人工逃生舱 —— 全量档正文改取 HEAD blob(此前读磁盘,共享工作树里别席未提交字节会混进判定面),清单与内容同面同轮走层出口;新增 --worktree 人工档、未知旗与任意两枚面旗同给一律 exit 2 逐枚点名(此前 --worktree 被静默吞、抬头照打 --staged);MAX_BYTES 512KB→4MB 的依据是现读 git-guardian.mjs HEAD blob 563558B 一直整枚被跳过,即最大启动器从未被审;自检 17→28 例、镜像 13→21 例,runner 的例数与出路同步;immutable-exempt: 本次是把新增门自己的取材面接回统一层并修档位形状,判据三条与三档豁免一字未减 (4d51b4c8ce)
- 🐞 修复:R12 前端收口 —— 画布消息源校验、Playground Key 清旧 localStorage 残值(web 腿) (66545ca044)
- 🔧 工程/其他:收编停留≥3分钟的 i18n 未提交改动 (7cb6c06409)
- 🔧 工程/其他:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (584b1bceaa)
- 🐞 修复:R12 安全续修 12 项 —— 微信登录补 2FA 闸、TOTP 同一步只兑付一次、结算单读取限 admin、全仓发 token 点结构锁扩射程(8 处带理由豁免)、小程序 webview 白名单补备案与微信签约域(修 R11 回归)、签约响应补 signUrl、work-panel 新开标签限 http/https、SVG 资产断源、A2A 生产禁本地回环、MCP 音频下载钉 IP、IM webhook 过 SSRF 尺;API 96 + 小程序 6 + ai-service 94 用例全绿,mypy 674 文件零错误 (9cb6d0efdd)
- 📚 文档:结清 Y-14 —— 生产库 latest 行已登记且公网端点返回真数据 (b8d3e48ac2)
**2026-10-31**
- 🐞 修复:dev 态 CSP 的 nonce 分支补回 unsafe-eval —— 本机活体实测页面曾被推进错误边界 (e77022e24a)
- 🐞 修复:客户端回灌腿同因未判定降噪 —— 服务身份读不到 DPAPI,每 10 分钟一条同文 warn (c0176795b0)
- ♻️ 重构:三端巡检态判据收单一真相源 + 补"配置已开却没跑"档五语言文案 (34c0749d1a)
- 🔧 工程/其他:重落死副本删除 —— fetch-protocols 与 url-protocols 同值且 HEAD 与工作树两面现读全仓零引用,该副本被归并回捞回来过一次;单源保留 url-protocols(消费方 navigable-url 与 ssrf-guard);intentional-delete: 裁决原文见提交 f7ab13bdea1d87171939a8e637cd92b3e348be5b,本枚只是把它重新落地并留可追责意图记录(safe-commit 因窗口期内有他席新件拒发普通提交,按它给的出口走对象空间档,只交声明集) (97150355ae)
- 📚 文档:移动端走查根因挖到构建配置 —— HEAD「开 optimizeMainPackage + 摘 common 名」使 app 入口等 25 个 chunk(其中 23 个独立 NNNNN.js 从未被加载),App() 永不执行、getApp() 恒 false(入口探针无抛错);对照构建关下沉+保留 common 名后 getApp()=true 且开始发 wx.request,但主包超硬上限 137,388B;反向组合构建中止(SplitChunksPlugin 同名冲突)。三选一修法与取证见 .ihui-agent/tmp/mobile-walk/DIAGNOSIS-2026-10-31.md;实验改动已还原 (0378c4b6cc)
**2026-10-31**
- 🚀 新功能/改进:Qoder 回灌任务加存续哨兵 —— 任务被删/停摆/身份漂移都会安静失效,现在到人 (9da1df3ba6)
- 🔧 工程/其他:补上被别枚提交卷走的号池任务中心用例 —— HEAD 面实测 1 条红就地结清 (eb7fbad5ae)
**2026-10-31**
- 🐞 修复:R12 同族收口 —— 调度 webhook 与 A2A 派发补 SSRF 钉 IP、agent 注册归属、连接器写面诚实失败 (714948f4b8)
- 🐞 修复:给 web 的 tsc 程序接上 nativewind 类型增强 —— 修好 next build 在 ui-native 上的类型红 (ea6eacbbf9)
- 🐞 修复:巡检态改观测态 + 手动任务入口补风控预检 + 补签卡写侧装两把机器锁 (0cc3259504)
- 🚀 新功能/改进:能力矩阵认得 settings 族默认关开关 —— 加 J4 覆盖面并登记 5 行 (97083bca8f)
- 📚 文档:T3 §10 修正一处笔误(p 原文 -> prompt 原文)—— 纯文案,无判据变化。 (b740cc303d)
- 🔧 工程/其他:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (5d49e9fbd6)
- 📚 文档:撤掉重复的 R10+R11 goal 注记 —— 保留 12f3cbd 的四条正本,本行内容与 STATE/loop-run-log 重复 (49e83a69d9)
- 🔧 工程/其他:收编停留≥3分钟的 i18n 未提交改动 (fcd9e5a010)
- 📚 文档:安全强化 goal R10+R11 结账注记 —— 两批已入库且 origin 同步(b0e506f31b5e) (5215ebf608)
- 📚 文档:补安全强化 R8/R9/R10/R11 goal 结账注记 —— HEAD 面纯追加 4 行,不带工作区他席在飞行 (12f3cbd383)
- 🐞 修复:dev-stack 常驻链定 pipe 为默认形态并把注册结果判据修对 —— 旧判据只认 LAST=0,而 ExecutionTimeLimit=0 的常驻任务回读到的正是 SCHED_S_TASK_RUNNING(267009),于是每次成功注册都被打成失败:照文档敲 autostart 的人看见假错,watchdog 自愈腿按非零退出记 repair-failed 永远收不到成功、每 2 分钟重装并顺手杀掉在跑的守护;现按 0/267009 判成功、读不到形状走 exit 2 不冒绿(§0.3)。本机实测 IHUI-DevStack 与 IHUI-DevStackWatchdog 双任务已落 S4U + 系统 node(不再挂第三方 IDE 捆绑的 node 目录),守护自起 8801/8802/8806/8807 并续写心跳;镜像 install 6 例、launcher 26 例 (91dcc16835)
- 📚 文档:T3 增 §11 残余四条复判 —— jti 防重放纠正为假缺口，关卡41已消，壳层与持久层维持原判并附复跑入口 (1638812845)
- 🐞 修复:号池队列换库必换队列,并把队列名分隔符从冒号改成连字符 —— BullMQ QueueBase 对名字里的冒号直接抛,旧形态让隔离栈 API 崩在 worker 启动那一步(本机实测);登记守门276(warn 起步,存量假阳未清不升档)+ 镜像13例 + 单测24例含不变量;门体正文改走取材层 catBatch/readWorktreeFile;新增 docs/RELAY_QUEUE_DB_ISOLATION.md 立「队列属于数据库」;immutable-exempt: 本次是新增门的注册条目与 onFailHint 措辞同步并接正取材层,未削弱任何既有判据 (522584b7ff)
- 📚 文档:守门 276 补进「守门脚本点名索引」的号池队列隔离行 —— 门 89 R4 义务(已接线门必须被文档点名) (da510dd9a4)
- 🚀 新功能/改进:Qoder 会话回灌装成用户态计划任务 —— 服务身份 LocalSystem 读不到 DPAPI,本机号一直静默脱池 (fdc24da553)
- 🐞 修复:残余 7 例逐例定性落地 —— 5 例测试腐烂/环境配置按新 IA 重钉,1 例拆开同帧耦合 (8ed1fbddf3)
- 🐞 修复:派单腿指向本机真实 CLI 入口 + 白名单补 deploy-feedback (34402556a8)
- 🐞 修复:mcp_server SSRF 批的收尾 —— mypy 类型收窄 + webhook 测试支撑(安全强化第 32 批) (24c4c72b23)
- 🚀 新功能/改进:advisor_consult 顾问模型工具(G-11 协议层收尾)—— 指定另一个模型就子问题作答,带会话级次数预算与模型名 fail-closed。 (ace8fec86b)
- 🚀 新功能/改进:钩子唤醒腿宿主接线真正入库 —— REPL 会话队列接管 async 钩子 exit2 回灌 (6a6f388253)
- 🚀 新功能/改进:计划执行工厂补回 hook_runtime 与指令片段声明面两参 —— 与第 27 批归属收口同面归并 (6747dfe947)
- 🔧 工程/其他:删掉与 url-protocols 同值的死副本 fetch-protocols —— 协议表只留一份(§0.6) (f7ab13bdea)
- 🐞 修复:协议白名单拆出零 Node 内建的 url-protocols —— 止住扩展/web 构建阻断(node:dns 进浏览器包) (e95ff27a1e)
- 🚀 新功能/改进:补齐第三批 —— 指令片段声明面 + TodoWrite 五态 + 编辑器态共享腿 (906a4ab47b)
- 🚀 新功能/改进:「自动做任务」补齐移动端与小程序 —— 三端同能力、同口径 (3275ed6ee0)
- 守护巡检档(不进提交链,§12e,2026-11-01 立): `check-autonomy-leg-health.mjs` —— 自开发/自修复「发起腿」健康尺(立因 = auto-evolve 的发起腿在本机死了 6 天、现读台账 dispatch 48 轮里 session-ok 仅 1,真因(执行体路径钉死别机盘符)被账面"票失败"完全遮住 —— 安静失效型,此前没有任何尺子在量这条腿)。判据零复算:preflight/分型 import `scripts/lib/autonomy-runner.mjs`,封票/连败 import `scripts/auto-evolve.mjs` 的 `quarantinedUntilOf/failureStreakOf`,取票经 `scripts/plan-tasks.mjs` 的 pickTickets 唯一入口;接线 = `git-guardian.mjs` 的 `sweepAutonomyLegHealth()` 常驻派发点(节流戳 `.ihui-agent/state/autonomy-leg-health-tick.ts`,最近结果 `.ihui-agent/state/autonomy-leg-health-last.json`)。
**2026-11-02**
- 🔧 工程/其他:收编停留≥3分钟的未提交改动 (c5a90766cf)
**2026-11-01**
- 🐞 修复:probe 改派 headless 可执行的只读自检,解危险拒签死循环 (1e42fc5e81)
- 🐞 修复:自治环改用 tsx 加载 CLI 源码,解除 dist 未 bundle 导致的会话派发死锁 (4aa78225b0)
- 🔧 工程/其他:派单面管理员闸 + LIKE转义 + publish同源SSRF闸 (c85a866895)
- 🐞 修复:盘根白名单补 MiniMaxCode(D: 盘已安装应用,消除误报外流) (65b643bb9c)
- 🚀 新功能/改进:会话全文落盘腿与CLI空转/无头审批人根因修复 (09a3f02274)
- 🔧 工程/其他:subagent 全局配置变更面强制管理员闸 (c8c4213622)
- 🔧 工程/其他:收口越权/SSRF/注入/凭据泄露 5 类高危面 (ff4d42705a)
- 🐞 修复:qoder 保活腿——单轮瞬时失败静音,连续失败才报警 (a72ca967d3)
- 📚 文档:标注暴露凭据轮换未判定保留 warning 的安全域意图 (74bb1a4c02)
- 🐞 修复:噪声治理——info 档只登记不寄信 + 自愈全成功静音 (28b2cee5df)
- 🐞 修复:CLI 登录态写入不再因 ENOENT 打断整轮派发 —— 服务身份下 USERPROFILE 没有机主的登录态 (2c346fb800)
- 🐞 修复:票面被截断时风险因子不许读 0 —— 那是"把高风险票排到前面"的失效方向 (65cc7e48a0)
- 🚀 新功能/改进:打通自开发最后三格 —— 会话干完能落账、排期真按模型走、经验真能沉淀 (bf1a42f113)
- 🐞 修复:上下文/记忆面 8 个端点的身份从"自报"改成"注入" (9103baba9b)
- 🔧 工程/其他:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (1b6443c3ab)
- 🐞 修复:收窄 mobile-rn 两处依赖数组消除 exhaustive-deps 红、favorites 镜像件与生成器补 resourceType/resourceId 契约注解、CI pytest 覆盖 basetemp 根因 (c97d501323)
- 🐞 修复:补上五处"闸装错了层/装错了方向"的凭据与主体防线 (f4d5103361)
- 🐞 修复:派发契约尺子学会说取不到输入,隧道不在位不再被念成接线消失 (03a4fdd580)
- 🐞 修复:5类报警根因修复 + 报警前自愈路由层 (1827fde982)
- 🐞 修复:两维尺子不再因历史存量恒红 —— 结算腿改结清全部悬案,A3 只在封禁过半时叫人 (c08df4d714)
- 🐞 修复:裸字面量 TTL 归口常量、两枚策略常量搬到可扫描取用点、probe-dev-extra 进 CI 自述点名表 (9fb6fee7a8)
- 🐞 修复:冲突标记门体接旁路落地自证臂并扣减空冲突区补回量 (c3fc430bc5)
- 🚀 新功能/改进:两类写了没装车的展示契约与错误码契约装上真取用点 (98f7f3be13)
- 🔧 工程/其他:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (837e41f4fb)
- 🚀 新功能/改进:给自开发装上"派发结算"这一问 —— 会话 exit 0 从此不等于票推进了 (31ec3e231f)
- 🔧 工程/其他:本席认领「灰度观察窗排在换流之后」并挂租约(防双开;SPLIT 席已停笔,该格由 OBSWIN 席接手) (6341165f67)
- 🐞 修复:供应商健康摘要的 30s SWR 策略从装饰常量收成单一旋钮 (71b2265af0)
- 🐞 修复:摘掉被 union 归并留成两份的 workbook 路由注册,并把零 JSX 的 React 模块从 .tsx 改回 .ts (8eebef0d1f)
- 🚀 新功能/改进:灰度期实切车道计数持久化 + 熔断记账按轮次结果分桶(收编 SPLIT 席产出) (2829bd6e34)
- 🚀 新功能/改进:端侧存储 transport 取用归口到各端工厂,并收掉 shared 里未接线的 JSON 装饰层 (199c84c412)
- 🚀 新功能/改进:五枚"写了保留策略却从未执行"的清理函数装上真实触发点 (69a64068bd)
- 📚 文档:执行体积清偿第六批——4 行逐字移入归档件,原位置只留一句指针注记 (d3baf99018)
- 📚 文档:落 AGENTS.md 体积清偿第六批的逐字迁出件(先落归档,再摘正文,防 merge-live-doc 把搬走的行判成 lost 补回) (5a6c653770)
- 📚 文档:再摘一次合流捞回的冲突标记行,并把回捞这一型登记成在册票 (24ff0bc188)
- 📚 文档:登记「冲突标记经旁路落地+行级 union 反复回捞」这一格(本席已认领,含两轮实测 sha 与出路) (9795d38e68)
- 📚 文档:补上编辑意图预测(Predictive Edit)能力清单——服务端三态/前端三把钥匙/scene 分账/真模型取证首跑(§21 交付门槛:新增端能力须同枚更新 README) (639c0bb9d2)
- 🔧 工程/其他:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (177ac30e3c)
- 🐞 修复:合流选边遗留的接线红就地收正——W10 补回采样面折算维,部署环 decide 同时带两把钥匙 (ef4c07a465)
- 🐞 修复:产物 token 的签名密钥去掉公开常量兜底,并把"生产必填"那句话真接成启动闸;SaaS 模板弱默认口令封口 (da6f241813)
- 📚 文档:deploy-feedback 自动登记(deploy_outcome;端到端反馈闭环第二切片,O65 自进化系列) (7a809936fe)
- 🐞 修复:收正合流选边遗留两格——灰度产物来源换回对侧定案形态 + web 族源收成共享层壳 (77cb1dc7f1)
- 🐞 修复:/api/context 进"永不公开"地板 —— 那张 router 七格全无端点级身份,靠陈旧 .env 就能匿名重开 (e119289438)
- 🐞 修复:clawdbot 整面闸升到带 requireActiveUser 的档位;并更正我自己写进提交史的一句 folklore (8c7054044b)
- 🐞 修复:摘除合并落进 AGENTS.md 的三行未解决冲突标记 (08b12deaa4)
- 🐞 修复:MCP 项目/集成面收归令牌主体,并堵掉"裸 id 可删任意 system_configs 行"的跨面删除 (3d31adbdac)
- 🐞 修复:票59 消息级版本切换补上小程序消费腿 + 灰度补 P95 延迟劣化真策略用例 (a92c063cac)
- 🐞 修复:摘掉打死守护的三处悬空引用,补齐 pure 层缺失的同类节流判据 (f73fb2793d)
- 🐞 修复:工作簿读写面补装车 —— 五条端点此前线上全 404,而仓里那把"必须注册"的尺一直红着 (75de94caae)
- 🔧 工程/其他:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (f4e8324d22)
- 🚀 新功能/改进:barrel 销账下到符号级,标题臂不再写死形态名——清掉两条假账 (bc64e57842)
- 🔧 工程/其他:壳声明件跟随自动升级的 4 枚页(按 HEAD 面派生) (b2b9dfd385)
- 🔧 工程/其他:自动把 4 枚手写镜像页升级为壳承载 (a69349f15b)
- 🚀 新功能/改进:列表分页与输入框聚焦两族按「闭环在不在屏上」销账——再解放 2 页 (c395144e6c)
- 🚀 新功能/改进:判据认「barrel 里只装了导航条」这一型重复接线——两页当场变 convertible (830fb1b708)
- 🐞 修复:合并后重生成 miniapp 两族派生产物(门 105 的 G5 钉随输入集更新) (0373e9aa2b)
- 🔧 工程/其他:收编停留≥3分钟的未提交改动 (afc5595c90)
- 🐞 修复:正文作用域补上承载壳——判据认「提示住在壳里」这一格 (5b3db1a65e)
- 🔧 工程/其他:收编停留≥3分钟的 i18n 未提交改动 (bd98a24260)
- 🔧 工程/其他:修三处 api 存量红 —— 豁免清单腐烂 / 出站口换 undici / 返回面加了 localEmbedded (39b1ee5ca2)
- 🐞 修复:parentMessageId 口径加宽到 string | null + 小程序腿三处类型错 + knip 兼容层出口盲区登记豁免 (1f1e6e99fb)
- 🐞 修复:回补 cli 包 14 枚动态派生词条 + 登记契约键 (bac640521e)
- 🔧 工程/其他:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (fbad083b81)
- 🐞 修复:清掉 api 包的四类存量 lint 红 + captcha 清理按自身头注分批 (3ebae14ded)
- 🚀 新功能/改进:ws-chat 把断线补发/幂等去重/跨实例限流三枚工具模块装进生产生命周期 (fadde1bce7)
- ♻️ 重构:useFontMultiplier 改名 readFontMultiplier —— 它是纯读函数,不是 React Hook (e75621c841)
- 🔧 工程/其他:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (7362129f72)
- 🔧 工程/其他:收编停留≥3分钟的未提交改动 (eb60e13737)
- 🔧 工程/其他:收编停留≥3分钟的未提交改动 (9930484394)
- 🔧 工程/其他:收编停留≥3分钟的未提交改动 (da729e3f6f)
- 🐞 修复:chat-sync 帧收件人只取承载层认证身份,堵死客户端自报 userId 的跨用户投递 (58fb182dec)
- 🔧 工程/其他:给 hub 早退分支的工具入参校验补行为锁 (bbbf3f7443)
- 🔧 工程/其他:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (fbb4ec7ea9)
- 🐞 修复:套件红项分诊末簇收口——①百分比裁剪 5 处内联手搓收敛到具名唯一出口 clampPercent(@ihui/shared/utils/clamp-percent,api/miniapp/mobile-rn/packages-app×2,语义逐字等价:toNumber 保证有限值/round 先后序等价/NaN 归 0 为出口既定语义),edu-grade-trend 本地同名实现摘除;②三枚镜像测试对齐现形(ui-react T5 仓外样本改真仓兄弟路径构造——toRel 纯路径数学无需夹具/mkScratch 已入仓内批准根;tool-arg-wired 守恒式补 forwarded 转发豁免桶——头注恒等式 covered+forwarded+uncovered===total;transcript TA-12 数据条件化——audit.jsonl schema 演化后 path-ish 族为 0 条,判存在性用门体单源 extractTarget) (f25456c0fd)
- 🐞 修复:合并后重新施加本侧独有的两格运行时缺口 —— Modal 遮罩点关 + Image onLoad 转发 (5f38f5d8dd)
- 🐞 修复:卫生门真债+旧尺各一——①dev-stack-launch-fallback.test.mjs:77 中文绝对路径字面量改 \u 转义构造(运行时语义不变,销 GBK 乱码违规;HEAD 面欠账只有带进 HEAD 的提交能销);②check-workspace-hygiene 落点判据对齐 G-158 现形(改用唯一判据 isAllowedScratchRoot,批准根已入仓内 .DevEnv——判据没跟上设计红在尺子,check-service-binary-paths F3 同型) (007f24437c)
- 🔧 工程/其他:收编停留≥3分钟的未提交改动 (225523491f)
- 🔧 工程/其他:收编停留≥3分钟的未提交改动 (312ff9ad19)
- 🔧 工程/其他:收编停留≥3分钟的未提交改动 (0d8853a870)
- 🔧 工程/其他:收编停留≥3分钟的未提交改动 (9ab4908d49)
- 🔧 工程/其他:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (97a63e10e8)
- 🐞 修复:套件红项分诊第一簇续收 4 格——测试形状正则对齐现形(commit-payload 发令帮手改名 commitArgv/d159 合并命名出口/deploy-diverged 补救功能已整票回退故豁免面关闭零破坏性动词/arg-guard getOpt 三参) (3e76692c31)
- 🔧 工程/其他:收编停留≥3分钟的未提交改动 (3722d122d7)
- 🔧 工程/其他:收编停留≥3分钟的 i18n 未提交改动 (eb97698dbc)
- 📚 文档:T12 §5b 状态更新——#8/#6 身份半格已落地,#5 大半落地,#3 缓议有因 (4b188b3468)
- 🚀 新功能/改进:钩子派发宿主身份核验(deny-by-default)—— T12 缺口表 #6 半格收口 (713eaf1513)
- 🚀 新功能/改进:索引快照压缩落盘(gzip 魔数自识别)—— T12 缺口表 #8 落地 (3b3e9542a4)
- 🔧 工程/其他:parity-auto-stage-crash.test.mjs 溯源水印欠账带进 HEAD(门47 HEAD面欠账清偿) (aaabb813bf)
- 🔧 工程/其他:回正 check-pkg-installable 镜像夹具的包名(包更名后夹具腐烂) (7fba73b50f)
- 🐞 修复:灰度产物来源定案,放量判定拆成在位三态并不再把未判定折成通过 (5d2380fe2f)
- ♻️ 重构:危险操作确认旁路的消费侧收拢到唯一出口并锁零就地判定 (88763ecb62)
- 🐞 修复:号池入库契约把 phone 提为显式键并锁四档命名优先级(O66) (369f74ab01)
- 🔧 工程/其他:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (5cc57906d3)
- 🐞 修复:小程序宿主 typecheck 61→0 —— 去掉索引签名,RN 事件/props 类型面归口 primitives (ff2abfcdbf)
- 🔧 工程/其他:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (dc9a528104)
- 🔧 工程/其他:收编停留≥3分钟的未提交改动 (cffca2c7c7)
- 🐞 修复:F6 判据改行级预算口径,根治「union 重组涌现块」半格死锁 (1addf6f4ab)
**2026-11-02**
- 🔧 工程/其他:收编停留≥3分钟的未提交改动 (ff3f0c5c5c)
**2026-11-02**
- 🔧 工程/其他:收编停留≥3分钟的未提交改动 (fb8410f958)
**2026-11-02**
- 🔧 工程/其他:收编停留≥3分钟的未提交改动 (dd0248cbd2)
- 🔧 工程/其他:清算主工作树滞后副本并补齐派生产物 (04d0c2c7cb)
- 📚 文档:deploy-feedback 自动登记(deploy_outcome;端到端反馈闭环第二切片,O65 自进化系列) (05e0909aff)
- 🔧 工程/其他:重封 AGENTS.md 铁律段哈希，消除合流后 advisory 告警 (86bde84fa7)
- 🔧 工程/其他:补 .gitignore 兜住本地优选 IP 凭据，避免令牌误入库 (213b7c038c)
- 🔧 工程/其他:重生成 ui-routes 生成物（911 条），对齐设置页新卡片 (d388266f28)
- 🔧 工程/其他:按新 HEAD 源重生成离线语言包（键 544→592，钉 2fb7af837e） (2f98eb1e6b)
**2026-11-02**
- 🔧 工程/其他:收编停留≥3分钟的未提交改动 (624f3fded6)
**2026-11-02**
- 🔧 工程/其他:收编停留≥3分钟的未提交改动 (9f63e266d2)
- 📚 文档:全工作树口径条款压缩至体积预算内(语义不变;有意替换本席 a7082004 所加长句,无他人行被吃)并重封根护栏 (4ec42583d6)
- 🔧 工程/其他:按生成器刷新四端最近更新并推进基线(.doc-autoupdate/last-sha) (4e3caa439c)
- 🔧 工程/其他:收敛后按 HEAD 面重生成 3 件 i18n 派生产物 (cf4929783c)
- 🚀 新功能/改进:全工作树未提交状态唯一口径(check-worktree-status + 门 281) (a708200410)
- 🔧 工程/其他:收敛后重生成 web ui-routes 派生件——合并树新增路由共 911 条,sourceCommit 钉到 17398feed4,与输入 sha256 c03c0415 对齐 (c62d667f09)
- 🔧 工程/其他:收敛后重生成 miniapp 离线包 b64 派生件——与已提交的 3 份 .gen.ts 同批产出(输入 sha256 789e9bbe、sourceCommit 4cf59c6ef8),补齐收敛引入的词包更新 (031c4d0933)
- 🔧 工程/其他:收敛后按合并树重生成 ui-routes 派生件——union-converge 落地 e174123809 后按合并树重算,sourceCommit 钉到该合并,输入 sha256 不变(两侧改动路径除本生成物外无重叠) (4cf59c6ef8)
- 🚀 新功能/改进:M4 B1 契约冻结——8 个共享 types 补必填 onNavigate/onToast,29 个共享屏加 assertRequiredPort,30 个 RN 壳经 useHostPorts 接线并挂全局轻提示层,小程序 about-shared 宿主补端口并同步重生成 ui-routes,新增端口接线契约测试(2 例);接手他人未提交工作、来源会话不明(76 条遗留已在前序 5 笔按域提交 b3d2f24247/90b700fb81/99c09c4938/cb39924428/3fe2499620),本笔为随后 M4 B1 自研施工;门禁:根 typecheck 绿(TS+mypy)、两端 typecheck 绿、miniapp test 99 文件/1239 例绿、mobile-rn test 152/153 文件 1385/1397(存量 tests/wallet.test.tsx worker OOM 12 例未跑,文件未改、与 B1 无 import 关系)、parity gap 0/residual 1、门128 判红 0、planner 30/21/15 未变 (408efad761)
- 🐞 修复:get_session_extra_roots 空会话早退后显式收窄 session_id——消 mcp_server.py:715 存量 mypy 错(str | None 传给 str),根 pnpm typecheck 由红转绿;行为不变 (620f408c83)
**2026-11-02**
- 🔧 工程/其他:收编停留≥3分钟的未提交改动 (a3bf177b50)
**2026-11-03**
- 🐞 修复:收窄家长端鉴权用例 unknown 类型并清零 e2e --no-ignore eslint 报错 (75a9836204)
- 🐞 修复:给 @ihui/rn-app 替身补出 AgentReview 列表/详情两屏与 props 捕获出口(与真身 154/278 行同步) (73f7fb1242)
- 🐞 修复:补录 ai-service memory.py 六个 MEMORY_* 兜底码到错误目录并补齐五语词包 (d08f93800e)
- 🔧 工程/其他:main 档不再排队/取消(false 仍会杀掉 pending 的 required run),恢复并行出结论 (3b2e5983cb)
- 🔧 工程/其他:去掉表达式取模(startup failure),PR 侧改单队列;并发上限 3 (57f2a0fbd9)
- 🔧 工程/其他:bump gitleaks/gitleaks-action 2.3.9 -> 3.0.0 (PR #112) —— v3 仅 Node24 运行时(v2 钉 Node20,2026-09-16 起已从 GitHub runner 移除),inputs/outputs/behavior 无变化 (311e770178)
- 🔧 工程/其他:bump actions/deploy-pages 4.0.5 -> 5.0.1 (PR #113) —— v5 仅 Node24 运行时 + 部署轮询改 backoff/jitter,pin 与上游 tag v5.0.1 一致 (fc70686974)
- 🔧 工程/其他:并发闸按 ref 分档(main 取消 + PR 2 槽轮转),e2e 同时占用硬上限 4 (fa5c88025b)
- 🐞 修复:撞号的文档中心门让号 282→285,重封根护栏,再摘 AGENTS.md 回潮的合并残留标记 (37147a7496)
- 🔧 工程/其他:分叉收敛后按 HEAD 面重生成 web/miniapp 两枚 ui-routes 产物(合并提交承诺的落地后重生成;门 105 stale→matched) (35bddefbd9)
- ♻️ 重构:容器 hover 浮起按 2026-11-03 机主二次定档减淡 —— 数值源 --lift-* 单点收敛(位移-4px→-2px,缩放1.015→1.008,两层阴影 6px/12%+30px/25%→3px/6%+18px/12%,暗档同比例),端内不散改 (03d1c4d32e)
- 🐞 修复:收口被整块重复的登记(F6 块级判据的修复出口) (1086dc23ba)
- 🔧 工程/其他:回退 monorepo 测试分片(实测 3.5%)并修分诊矩阵替换 (986657675d)
- 🔧 工程/其他:停掉 WorkBuddy 回灌腿并把降噪窗口临时拉长到 7 天 (6556ac1b6f)
- 🐞 修复:WorkBuddy refresh 60 天绝对寿命落库并加 7 天提前预警 (5cc9ccb083)
- ♻️ 重构:撤除 WorkBuddy 会话同步幽灵定时腿 (684db31ef5)
- 🔧 工程/其他:补齐 ci-test-shards.mjs 溯源水印(HEAD 面欠账) (e748bb7157)
- 🔧 工程/其他:压缩单次 push 墙钟(并发收敛/Docker 层缓存/测试分片,required check 名不变) (5dfdc1fcb8)
- 🐞 修复:notifyGuardRed 增加可选 policyFile 注入缝,单测与生产策略表解耦 (dbf2531b79)
- 🔧 工程/其他:对齐补救功能整票回退后的现形,关掉豁免面 (051d975389)
- 🐞 修复:verify-guardian-mutex 只认四类硬证据 (51d95e1f1b)
- 🐞 修复:daemon 入口取锁补传 roundStaleMs (3a7d4b8010)
- 📚 文档:AiCostLedgerWriteFailures 正文补「首事件也会报」 (a6e2893aef)
- 🐞 修复:恢复事件不再摘去重档,改为 24h 同身份发送上限 (5d9d529393)
- 🚀 新功能/改进:三信封口接入 alert-family-gate,首封必达 + 同族 24h 只留首封 (ab2e6fc1ab)
- 🐞 修复:六条新族窗口收到 8h,并带上另三条族窗口 (7a27cabd22)
- 🐞 修复:心跳续约锁与另一席巡检块合并落地 (04f580d447)
- 🐞 修复:五族窗口收口,族级 24h 只留首封 (0529aa2aaa)
- 🐞 修复:钩子失败按可重试/非本笔分流,并点名锁持有者 (ac5017c39e)
- 🐞 修复:ai-career 判为非同源,摘除旧镜像对 (d03f4aba12)
- 🐞 修复:QUIC 腿数改读 metrics gauge,netstat 只在 http2 交叉校验 (36bb5bde05)
- 🐞 修复:邮件双失败后单次后台重试,UNDEL 留最终凭据 (df43cb3e07)
- 🐞 修复:commit-msg 遵守 --only 的临时索引 (1428656ec0)
- 🐞 修复:尊重 --only 的临时索引,堵住 lint-staged 撞 index.lock 与 MM 静默回滚 (b082a600a6)
- 🐞 修复:同一 alertId 跨进程原子占位,堵住双跑重复投递 (84cc8a94db)
**2026-11-02**
- 🚀 新功能/改进:按服务名复用轮级锁，锁跳过时回滚预记状态 (74ec597cd7)
- 🚀 新功能/改进:接入轮级原子锁终结 daemon 与计划任务双跑 (7297e37425)
- 🐞 修复:按件选根修 8 格未判定——不全局切根,P4a 仍读仓内 .DevEnv (5c8aec3653)
- 🔧 工程/其他:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (18aab35379)
- 🐞 修复:侧栏落点不被运行期资产覆写,并把 iOS 构建期兜底换成真 tag 直链 (227700178b)
- 🐞 修复:补齐 5 个派发点稳定身份 + 派发点审计去重计数 + 形状锁单行清理 (e875255f52)
- 🚀 新功能/改进:下载栏 8 端改取运行期真值,并修掉桌面分页与 iOS 死链 (6a6d193eca)
- 🐞 修复:--audit-new 并行区间不收敛致 10-30 存量每 4h 重投 (1de878d421)
- 🐞 修复:跨端缺块理由按承载形态分措辞——hand 页不再误报整屏文案取不到 (6a71dc4332)
- 🐞 修复:状态文件损坏不再静默清零——原子落盘、损坏件备份、未来时间戳不构成压制 (bed9d10121)
- 🐞 修复:补 shared 五语 career 命名空间——从 mobile-rn 逐字搬 7 键,消跨端词包缺块 (7ee9fc0fa4)
- 📚 文档:auto-triage 自动登记(mail-failure;第 1 期感知层产线动作,O65) (78576fcda4)
- 🐞 修复:去重窗口留 10 分钟余量(230min<AM repeat 4h),杜绝重推被误压成 8h (6f1da728de)
- 🐞 修复:出口被身份窗口压住不得记成已寄出——stdout 处置标记 + 抑制分支只计数不续窗口 (f439a8c84d)
- 🐞 修复:去重窗口不再被重复推送续期——被抑制的推送只读不写,持续 firing 按窗口重报 (19f67b3b45)
- 📚 文档:修正 AiLlm 告警注释里 printf 措辞（与 humanizePercentage 模板对齐） (99f9e0ed34)
- 🐞 修复:修 AiLlm 告警正文把比率当百分比格式化（printf "%.0f%%" → humanizePercentage） (e7bab5a086)
> ⚠️ 未判定 1 项:`guardianGates`(runner 里有 1 个重复 id ⇒ 撞号,条目数不可信)
**2026-11-03**
- 🔧 工程/其他:补全 10 个文件的 L2 零宽载荷与水印尾标(scripts/watermark.mjs inject 生成物) (0223f5e987)
- ♻️ 重构:BannerCarousel 的 50% 白改走设计令牌 rnCssLight.white50 (3d0d31a294)
- ⚡ 性能:下载栏的站点腿探测改「本机源站优先」,并给安卓版补上真实体积 (6a324ae21d)
- 🔧 工程/其他:烘焙 0.1.77 更新源与下载页快照 — Gitee 镜像仓为空仓无 main/tag/release,字节对账未判定故保留 GitHub 直链 (694810b9dc)
- 🔧 工程/其他:收编停留≥3分钟的未提交改动 (1fb2f45d04)
- 🔧 工程/其他:收编停留≥3分钟的未提交改动 (30d2f7ca16)
- 🔧 工程/其他:收编停留≥3分钟的未提交改动 (3c9a00be72)
- 🔧 工程/其他:收编停留≥3分钟的未提交改动 (f6d68d470b)
- 🔧 工程/其他:收编停留≥3分钟的未提交改动 (415b1414a3)
- 🔧 工程/其他:收编停留≥3分钟的未提交改动 (d365afb360)
- 🔧 工程/其他:收编停留≥3分钟的未提交改动 (34ba63607b)
- 🔧 工程/其他:收编停留≥3分钟的未提交改动 (9b60105652)
- 🔧 工程/其他:AgentReviewDetail 改判 not-applicable（无 RN 详情路由/入口） (4381683c20)
- 🚀 新功能/改进:CoursePlanet/MoreCourse/StudyIndex 接共享屏薄壳 (30a2725d76)
- 🔧 工程/其他:收编停留≥3分钟的未提交改动 (ae46cd2635)
- 🔧 工程/其他:收编停留≥3分钟的未提交改动 (45954293cd)
- 🔧 工程/其他:收编停留≥3分钟的未提交改动 (ce45e49f3f)
- 🔧 工程/其他:收编停留≥3分钟的未提交改动 (4c8f9d6aca)
- 🔧 工程/其他:收编停留≥3分钟的未提交改动 (be8220b87d)
- 🔧 工程/其他:收编停留≥3分钟的未提交改动 (3f04652720)
- 🔧 工程/其他:收编停留≥3分钟的未提交改动 (bd75e36dab)
- 指标存在性对账(2026-11-03 立,接线面=根 `package.json` 脚本位 `check:metric-existence`,非提交链): `check-metric-existence.mjs` — 判 alerts 规则引用的指标名在 Prometheus 是否真实存在且近期有样本;T1 拼错(编辑距离 ≤2 并打印最近名字)/T2 不存在/T3 无样本 三态不并桶,任一命中 exit 1。立因:把指标名改错后 promtool 仍 SUCCESS、reload 200、health=ok,规则从此刻起静默永不触发,而既有各门(Metric 存在性只查大屏 expr、P6 只查 alerts.yml 且把无样本算 live)一条都不响。
- 文档中心 / 公开面健康(2026-11-03 装车,blocking,runner id '285';**原登记为 282,与 `check-web-rn-gap-ratchet.mjs` 撞号后被后来者让号**): `check-docs-public-health.mjs`(D1 docs 页 `metadata.alternates.languages` 声明的 hreflang 必须有真实路由文件 / D2 `app/sitemap.ts` 收录的 `/docs*` 路径必须有路由 / D3 docs 页 `icon:` 字段禁 emoji 当图标,须 lucide 矢量组件;三档各自成对夹具 + `--self-test` 10 例,镜像 `scripts/tests/check-docs-public-health.test.mjs`;应急 `HUSKY_SKIP_DOCS_PUBLIC_HEALTH=1`)
- 发布线 / 安卓对外下载腿(2026-11-03 立,CI 档,runner id 以现值为准): `check-mobile-download-leg.mjs`(三问各允许「未判定」而不猜绿:① 配置里的下载 URL 跟随 302 后必须 200/206;② `Content-Length` 须 ≥ `--min-bytes`(默认 50MiB);③ 手里的 APK 证书 SHA-256 须等于正式基准。**退出码 2 = skipped/未判定,不是绿** —— 判据读的是公网与签名,提交者结构上改不了那一格,故按 §12e 不挂提交门;取证 `--self-test`,口径见门体头注)
- 跨端 / web↔RN 覆盖缺口棘轮(2026-11-03 装车,blocking,runner id '282'): `check-web-rn-gap-ratchet.mjs`(把只读对账尺 `check-web-rn-screen-parity.mjs` 的读数包成提交链判据,**不重算第二份口径**——判据 import 其 `__test__` 出口,§0.6;四维 unmapped=0 ∧ judgedGap=0 ∧ prefixHits≤基线容量 ∧ prefixExpired=0,外加每条 aligned 必须带完整 `data.kind`(direct/indirect/static/missing);基线件 `scripts/data/web-rn-gap-baseline.json` 由本器 `--baseline` 现读生成,容量取 min(常量,基线) ⇒ **只收紧不抬闸**;现读 HEAD 面 total 423 · 容量 423 · 全维在闸内 ⇒ 判绿;单次耗时约 4.2s;应急放行 `HUSKY_SKIP_WEB_RN_GAP_RATCHET=1`;镜像 `check-web-rn-gap-ratchet.test.mjs`)
- 跨端 / 声明承载 vs 真承载(2026-11-03 立,blocking,runner id '284'): `check-declared-carriage.mjs`(registry 声明"某小程序页承载某共享屏"时,必须能在该页 HEAD blob 里读到 **`@rn-shells/<屏名>` 的值 import**——注释与 `import type` 都不算(这两型过报本仓都踩过);三桶 carried/假声明/页面查无之和必须等于声明数,漏桶即判死。档位是**差值棘轮**:锚点 = HEAD 面同一判据读数,只拦"本次新增的假声明",现读存量 69 枚(declared 256 / carried 187)逐条报数不拦(§12e:存量未归零前升绝对零 = 恒红门)。整面只起 3 次 git(ls-tree + git grep + show),实测 0.85s——第一版逐页 `git show` 要 21.5s,慢门本身就是逼人跳门的成因。取不到 registry / 坏 JSON / 枚举 0 条 / 阳性对照读到 0 ⇒ 一律未判定或判死,绝不把"尺子读不到"写成"没有缺陷"。镜像 `check-declared-carriage.test.mjs`(7 例,含真仓存活证明);应急放行 `HUSKY_SKIP_DECLARED_CARRIAGE=1`)
- 跨端 / RN 薄壳覆盖(2026-11-03 装车,blocking,runner id '283'): `check-rn-host-shell-coverage.mjs`(判每枚共享屏是否被**至少一枚 RN 壳直接 import**——值 import 才算,`import type` 型边不计;三桶 covered / needsManual / seedableMissing;挂账出口 `scripts/data/rn-host-shell-manual.json`,三要素 owner + expires + reason 齐备才生效,到期即判红,在册面不再命中按 §0.7 判清单腐烂;现读 272 枚 · covered 260 · 12 枚在册在期 ⇒ 判绿;修法出口 `gen-rn-host-shell.mjs`(已由守护腿 `sweepRnHostShells` 30 分钟派发);镜像 `check-rn-host-shell-coverage.test.mjs`;应急放行 `HUSKY_SKIP_RN_HOST_SHELL_COVERAGE=1`)
- **发现射程哨兵**:`scripts/check-desktop-release-discovery-budget.mjs`(只读、**不进提交链** —— 判的是公网端点与运行期数据,挂成提交门即 §12e 恒红门;唯一调度器 = `git-guardian.mjs` 的 `sweepDesktopDiscoveryBudget`,6h 节流)。桌面版靠分页翻 GitHub releases 找最新版,而 Android nightly 会把桌面版挤出射程(2026-11-03 实测:第一页 100 条全是 nightly,桌面版在第 3 页);顶穿那一刻不报错、只安静退回入库快照 ⇒ 这一格把「以后还会翻不到」变成会喊的东西
- **iOS 站点腿**:`https://www.aizhs.top/remote-images/download/ihui-ai-latest.ipa` 是恒定地址,由 `deploy/cdn-server.js` 读旁边的 `ihui-ai-latest.ipa.redirect.json` 转成 no-cache 302;真正被边缘长缓存(7 天)的是带版本号那份。上腿动作 = `scripts/publish-mobile-ipa.mjs --from-release`(唯一调度器 = `git-guardian.mjs` 的 `sweepIosIpaRelay`,60 分钟一台中继)。版本号只认 release 自带的 `ios-version.json`(由构建从真进包的 Info.plist 取);两者都缺 ⇒ 发布器 exit 2 **不猜号**,下载页回落 GitHub 固定 tag
- **运行期真值出口**:`GET /downloads.json`(根级 `.json`,不走 `/api/` —— nginx 把整段 `/api/` 转给后端,Next 路由经公网到不了)与 `apps/web/src/config/downloads-live.ts`:各端版本号与安装包在**运行期**解析(desktop 取 release 分页枚举、android 取 `app_versions` 注册表 latest 行、ios 优先取自有站点腿的恒定指针(答不上才回落 `ios-nightly` 固定 tag)、cli 取 npm `dist-tags.latest`、扩展取 `public/downloads/extension/` 实物文件字节、微信小程序取 `public/images/common/miniapp-qr.png` 的实物字节(生码链 `scripts/gen-miniapp-code.mjs` 向微信要真图,低于 2048 字节一律不认)),构建期常量只作兜底;取不到的端如实标未接入并给机器可读原因码,侧栏下载栏经 `use-live-downloads` 消费同一出口
- 🔧 工程/其他:补三枚 RN 屏溯源水印(合并后 push 门 47p 修复) (9d91dd8bf4)
- 🐞 修复:对账尺子加传输层重试与总预算闸,别再天天量不出结论 (e2e718a6db)
- 🔧 工程/其他:对账尺子按端档案跑 iOS,派发腿拆成两层 (c8ca880f5f)
- 🔧 工程/其他:补 knip alias 自检脚本的溯源水印 (d92f6a957f)
- 🔧 工程/其他:knip 棘轮面收紧 —— rn-compat 构建别名与 Taro 约定入口纳入生成器，清理 209 条死导出并合并重复符号，exports/duplicates/devDeps 三项回绿 (795d606084)
- 🐞 修复:补 Ruff I001 + 分诊重跑尊重 working-directory + 守卫用例移出仓库根 (784ec4d642)
- 🔧 工程/其他:F4 反向例补齐「两组真实重复并行计组」 (70c3d516e8)
- 🐞 修复:两处单行文本断言改多行结构解析 + 重生成 openapi 产物 (a730538dc6)
- 🚀 新功能/改进:下载栏最后一格改由实物码说话,并给生码链加"文件名与字节同形"闸 (7a468f1ad8)
- 🔧 工程/其他:按 origin/main 源面重生成三端 ui-routes 产物,消 G5 自述钉陈旧 (0b3c68bda9)
- 🐞 修复:F4 组数口径最小豁免——已归并副本行退出 dupOpenGroups 分母(1→0) (8e8788ef50)
- 🚀 新功能/改进:下载栏最后一格改由实物码说话,并给生码链加"文件名与字节同形"闸 (1d81b430e7)
**2026-11-03**
- 🐞 修复:小程序 Platform.OS 类型轴补 web 修共享层 TS2367;两处 git 派生测试补显式 stdio (bed67d45fd)
- 🔧 工程/其他:root-guard 清单按现盘复核重封(guardian-runner 号位顺延后) (189decba97)
- 🐞 修复:并行入库撞号收口——props 对账 285→288、web↔RN 缺口棘轮 286→289,重复 id 归零 (5e50ac8f86)
- 🔧 工程/其他:README 活区 testFiles/guardianGates 按生成器现算对齐(4034/323),历史快照区不动 (6ac880c8fc)
- 🔧 工程/其他:react-native 桩补 Platform/Dimensions,承接共享屏 web/原生间距锁 (defe3f0994)
- 🔧 工程/其他:合并 origin/main(7afc9413) 后按合并面重算生成件(README×4/ui-routes×3/i18n/root-guard),并清 RP-35 滞留已勾行 (1a89df8894)
- 🐞 修复:清 gate-test 存量红（桌面快照翻页、鉴权门桩、横线选择器、历史写入侧取样）并让 scan-hardcoded-zh 自建输出目录 (842954d8bc)
- 🐞 修复:两格 quic 下 unjudged 的 reason 改归因——点名"quic 结构盲区",不再误写腿断/腿数不足 (523e3bdd37)
- 🔧 工程/其他:补 scripts/tests/data-json-shape.test.mjs 的溯源水印(门 47 HEAD 面点名) (5d007afdb9)
- 🐞 修复:工作区自愈两层派生补 timeout —— 一次 --align-drift 挂死能让整轮守护静默 3 小时 (386a71182a)
- 🐞 修复:考勤屏测试替身过 lint（HostElement 具名、去未用 style），清 gate-analyse 的 [lint] 红 (6e9aaf553b)
**2026-11-03**
- 🔧 工程/其他:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (55c2cb04cd)
- 📚 文档:清理 Gitee 下线后残留的过时注释,避免宣称已不存在的直链 (228e23dce4)
- 🐞 修复:Gitee 下线后不再输出常驻 warn,避免用一种噪音换另一种 (8c928e3283)
- ♻️ 重构:共享屏间距 26 处落档 + 2 处 Platform 锁 web 值,销账 18 条 decision (73dfd3f56c)
- 🐞 修复:B02② 会话切换时 chatSync 判据面与 resyncPending 一起换人(同 id 重设不动,补 1 条判据测试) (03b1cec6db)
- 🐞 修复:下线空仓 Gitee 发布目标,消除创建标签失败红噪音 (e0869bea5a)
- 🐞 修复:PayPopup 回退误带入的他会话间距中间态，仅保留 ¥ 档位落档 (2ea19b406b)
- 🐞 修复:RP-1 号域族注册表(RP 多字母族在册,单字母逐字不变)+ O01 空对照面收口为「挂账+到期」; immutable-exempt: 族注册表为新增只读取表,挂账判定只在空对照面改判,既有判红档与退出码语义不动 (73eac1c22b)
- ⚡ 性能:36px 图片变体替换两处固定尺寸引用(logo/reddit) (cc40e6b3d0)
- 🐞 修复:RP-47×2 staged 面双测试(有暂存必须取索引 blob/暂存为空判未判定不回落工作树) (1952b604cd)
- ♻️ 重构:钱包/课程/排行等 92 处间距默认档落具名档 (7afdef0638)
- 🐞 修复:runGate 的 node 分支显式 windowsHide(守门 no-visible-spawn 73 行按面转绿;超时与错误文案不变) (f4e33958fc)
- 🐞 修复:页脚备案号合规——显示网站号并外链工信部 beian.miit.gov.cn(补实际改动) (4aea31e9a9)
- 🐞 修复:repair-eo-origin 验证靶改直打源站(修假绿回滚判据) (902e9ed65b)
- 🐞 修复:出包链 windowsHide 接线回归锁(静态扫描全部 spawn/exec 调用点+门体形态锁,2 项) (f04f0b8ab7)
- 🔧 工程/其他:D171 形状锁五→六处，点名 O67 发令前只读点名 (fd1fe89c72)
- ♻️ 重构:门128 几何名额回退 3 处(4/8 档恢复 numeric) (b295cede8c)
- 🚀 新功能/改进:proxy 增加 HTTP→HTTPS 301 应用层兜底(判据只认 CDN 正向证据) (374aecc15c)
- 🐞 修复:18 处人工档位判定·落 8 保 10·不动几何额度 (ec9802df54)
- 📚 文档:守门 207 体积清偿归零(96,790→95,910) (8e09798d32)
- 🐞 修复:页脚备案号合规——显示网站号并外链工信部 beian.miit.gov.cn (7fac191097)
- ♻️ 重构:支付/分销/课程头/简介/VIP/课时 87 处间距默认档落具名档 (9772113c78)
- ⚡ 性能:36px 图片变体替换两处固定尺寸引用(logo/reddit) (81372b1e93)
- 🔧 工程/其他:删除死文件 public/wwLogin-1.0.0.js(全仓零引用) (0fa810fa6c)
- ⚡ 性能:PDF worker 长缓存——/pdfjs/* 由 max-age=0 提至 7 天 (f82e28158b)
- ♻️ 重构:共享屏 17/28/32/36 字号落 title/displayLg 档·10 处 (7a241e4d3e)
- ♻️ 重构:模型配置/运行时/评论 92 处间距默认档落具名档 (d32e043698)
- ♻️ 重构:共享屏 22px 标题/数值落 heading 20 档·71 处 (d2f150f983)
- 🔧 工程/其他:告警投递判据表加防误删闸 + scripts/data/*.json 通用形态闸 (755a07df12)
- 🐞 修复:默认永不跳钩,锁重试收窄为 3 次/指数退避/60s,新增 --allow-skip-hooks (c3898fdb14)
- 🐞 修复:修掉 zh-TW 下载文案里两处简体「平台」残留(门 2b 落地后复跑点名) (10ad69e61c)
- 🔧 工程/其他:提交后格式化回流 2 文件 (1eac95dcd6)
- 🔧 工程/其他:重封根护栏清单 + 摘 AGENTS 合并残留并压回预算 + 补两处 windowsHide 字面量 (b4faab6d55)
- ♻️ 重构:默认档等值落具名档·课程批 73 处 (904cb347c2)
- ♻️ 重构:默认档等值落具名档·屏级批 58 处 (511fcc7b95)
- ♻️ 重构:默认档等值落具名档·组件批 68 处 (766687c346)
- 🐞 修复:--next-id 拒发池外号,池满点名改走 next-plan-id(G-44/G-54) (42f6d6414f)
- 🔧 工程/其他:补齐 9 枚随合并入仓却无载荷的文件,并同批重封根护栏清单 (e1ada60b68)
- ♻️ 重构:销账 6 条已全清 decision、补细 19 条挂账证据 (903c6cee1a)
- ♻️ 重构:22px 上边距落 xl 20 档、30px 内边距落 3xl 32 档 (d5a54b93f4)
- ♻️ 重构:18px 间距落 lg 16 档、30px 落 3xl 32 档 (83617072bc)
- 📚 文档:门 287 号位现读回灌两枚残留 —— hover 门入库时与同批 props 对账门撞 285,落地腿已把 runner 注册块与门体头注顺延为 287(HEAD 面在位);本枚对齐其余两处字面:README 点名条 runner id 与 UI/样式尾注、镜像⑦形状锁号位 regex+文案(prettier 归位后水印已复验完整)。README 盘上派生块(跟踪文件 18947/收编行,可重算件)随本枚带落;props 门自身与其 285 条目未触碰。盘面 scripts/guardian-runner.mjs 为已落地历史拷贝的幻影漂移(§5b 形态,P1 对账尺当轮点名),已按 30c 出路②单文件 checkout HEAD 对齐——零丢失(盘 blob 系上一枚落地态,本票文字全部已入 HEAD)。 (1c9cdb39c2)
- ♻️ 重构:17/32/40/12.5 字号落 title/displayLg/label 档 (4e11292057)
- 🔧 工程/其他:结清 B67/B70/B71、G-1222560/59/56 与 Z-1 两条(证据见行内) (85f1c08855)
- 🚀 新功能/改进:指标存在性门让号 282→286 装车,根护栏巡检补上「远端 tip」那张脸 (8b56f8a460)
- ♻️ 重构:22px 金额/标题落 heading 20 档 (2be9294d5f)
- 🔧 工程/其他:收编停留≥3分钟的未提交改动 (14cdb641cc)
**2026-11-02**
- 🔧 工程/其他:收编停留≥3分钟的未提交改动 (7f9c0f84ca)
**2026-10-30**
- 🐞 修复:registry-sync 批量失败时把真实错误写进 sync_log —— 门 47 现在只报得出条数 (a3d7f7f2bf)
- 🔧 工程/其他:归档件补溯源水印 —— 销 10-29 归档留下的 HEAD 面欠账(门 47 复跑点名) (d05bdf123d)
- 🐞 修复:react-native-screens 4.26.2 升到 4.30.1 —— 桥接拆除期 NPE 的官方修复面 (19ab214903)
**2026-10-30**
- 🐞 修复:回退检查点的时刻在服务端出口折成毫秒 —— 「恢复到本轮之前」此前恒回到未来 (1bf0f57b9d)
- 🐞 修复:大屏号池列宽下限取实测最大值 186 —— 上一版 143 会把复合读数压出卡片 (977734d140)
- 🐞 修复:修正门 237 R1 的出路文案 —— 置 null 不是「无 rn 腿」,删不满足登记口径的条目才是恢复口径 (5265a3a294)
- 📚 文档:登记领券中心两枚端点与工具目录 seed(§21 功能同步) (93cb4a69ca)
- 🐞 修复:拆开 conversationImport.historyFailed 的同名不同义 —— 一个键在两端承载两种语义 (a420cfe1d5)
- 🐞 修复:协议条款正文两端同文 —— 46 处文案漂移里唯一可证安全的一族,其余逐枚判过不是缺陷 (35fbc9e45b)
- 🔧 工程/其他:摘掉两枚 HEAD 存量中文残留红 —— 措辞按仓内正本对齐,不自造 上一枚摘键提交落地后的「受影响判据复跑」点名 blocking 两臂(门 2o-mobile-rn / 门 2s-mobile-rn)。 逐枚现跑归因:两枚都是**先于本席存在**的存量红(行号随摘键挪位才第一次被读到),与本票载荷无关, 但红点归 i18n 面、修法唯一,就地收口而不是留给下一位再撞一次: ① ja  webViewPortal.distributionWithdrawRecords 「分销出金履歴」→「代理販売の出金履歴」    —— 后者就是 miniapp-taro/ja.json:4821 同键的在册正本(miniapp-taro/ja 现跑 ✅ 无中文残留)。 ② zh-TW webViewPortal.memoryManager「記憶管理台」→「記憶管理臺」    —— 守门自己给出的替换值,且与 miniapp-taro/zh-TW.json:4824 的在册正本逐字相同。 ko 面同一键的「分销 출금 기록」被扫描器判 **warn-only**(rc=0,半翻译类,「可能是有意为之」), 按 §12e 不为消红去改判据射程外的措辞 ⇒ 不动,在这里点名它的存在与不修理由。 验证末行(现跑):scan-i18n-zh-residue ja/zh-TW --target=mobile-rn 双双 rc=0「无中文残留」; check-i18n-keys --parity-only --worktree ⇒「5 语言 parity OK」× 25777 键路径;watermark verify 残迹 0。 (045c1aeb2c)
- 🐞 修复:登记表删 4 条不满足登记口径的行,门 237 四处红与漂移 registry-rot 同笔归零 (3e80ad99e5)
- 🐞 修复:门77 B5 63→0 —— 给漏登记的第三方 lucide 字形生成件补 OUT_OF_SCOPE 声明(路径精确正则+bExempt,零通配;1/3/9 本不在档位表,吸附即改坏字形并与 web lucide-react 脱节)。同数据 LineIcon/icons.ts 早已挂 bExempt,icons-generated.tsx 随门251落地时漏登记;单 hunk 只落数组体内,B1-B8/A/C 零字节改动;摘除 239→240、自检 86 例、镜像 23/23,复核期 2027-04-30 写入 why (902b233314)
- 🔧 工程/其他:25 枚死键候选逐枚定性后收口 —— 确证死的摘、契约键登记、在飞与双端不变量一律不动 三桶:A 确证死 9 摘(五语言同批) / B 契约键 3 登记 / C 不动 13。判定按行内自写判据当场复跑,不采信报告措辞。 (1bd1a1fdd7)
- 🔧 工程/其他:ui-routes 产物追平领券中心改动 —— 收掉 105 最后一条 G5 (8da3805690)
- 🔧 工程/其他:G-1102638 批1 同主键副本行物理归并 — 删 1 行(机主拍板〔拍板@2026-10-08 机主:真删+立即执行〕;幸存者规则与F4同向;落账注记行保留待批2;复跑auditPlan对账F1=0/F9不增;逐行留痕 .ihui-agent/archive/PROJECT_PLAN_copy-purge-2026-10-29.md) (1451a858cf)
- 🐞 修复:深度排查前端缺陷第二批 —— 注销/2FA 关闭补请求体,富文本三连,失败不再冒充空态 (f0a0ffa77b)
- 📚 文档:固化 goal-b33/b34 全部 24 份席位交接件(原在 gitignored 临时区,机器清理即丢)⇒ 逐席结论与未收格入受跟踪归档;凭据扫描零命中,水印已注入 (05b1bc5ebd)
- 🔧 工程/其他:两条装车形状锁恢复排版容差(被 9fdbc207ba 批量回退吞掉的那一型)—— 判据没坏,是尺子按折行前的字节形态找字 (8ad1e7dfe7)
- 🐞 修复:有意接回被 1fe3a2b42d -790行回退抹掉的 ④d「枚回执」档(按 91ead7dd14 原设计逐条移植进 HEAD 现有结构,非整文件覆盖)⇒ G-946 唯一尾巴从 archive-absent 拒删变 ④d 可删;④a/④b/④c/⑤/⑥ 零放宽(用例正向钉住 merge-note twin 不经此通道),三镜像合跑 38/38,三型反向各一枚 (db608ef73d)
- 🐞 修复:生成器幂等判据补上「值」这一维 —— 绿灯即缺陷已闭 器物此前只比键名集合,登记表回正 CourseMain/NewsCategory/Assistant 三条的 miniapp 指向后 键名一条没变,于是 --write 自报「✓ 路由映射无变化(盘上已覆盖现读 257 条)」并拒绝写盘: 生成物与登记面长期背离,而 --write 正是门 251 C3 点名的修复出口(§0.8 不许写跑不通的出路)。 (746d64acf8)
- 🐞 修复:有意还原被滞后副本收编吞掉的 requireFlagValue 守卫(门231 --rev 裸值曾静默回落HEAD面/231 --only 吞值假绿/255 --emit-blobs 把旗标当文件名往仓根写/91 --root resolve("")=cwd)+ G-322 blocking档真无守卫4站接齐(站点读数90→86,尺子与 lib/flag-value 一字未动,--self-test 10/10)+ plan-row-conservation 新增窄补号档 idFillTransitionOf(extractTaskFingerprint 族字面量不认两字母个位号⇒RP-1 出路此前结构性不可达;35/35,六型反向全拒) (454c7387cb)
- 🐞 修复:摘 HEAD 自带的重复 import type SyncReason(:53-54,与:47 逐字同,TS2300 挡全 @ihui/api typecheck)——去重后形态恰等于加重复那份之前的祖先,属预期,非回退;tsc 复验该文件 0 错 (168343a7bf)
- 📚 文档:auto-triage 自动登记(api-logs;第 1 期感知层产线动作,O65) (9879a83b86)
- 🔧 工程/其他:移除 knowledge 鉴权里的推断性注释(500 已定位为生产副本未更新) (82fe24c50f)
**2026-10-30**
- 🔧 工程/其他:离线语言包追平 mobile-rn/shared 已入库的新键 —— 清 105 的 G5+B2 两处判红 (df7e748402)
- 🐞 修复:重放 nav.pdfTools 五语言 —— 侧栏引用着它,而词条第二次被并发合并洗掉 (532fdfc9da)
- 🚀 新功能/改进:还原度尺补"本端词包缺整块命名空间"这一维 —— 两把尺原先同时看不见 (cd05449596)
**2026-10-30**
- 🚀 新功能/改进:工具目录补首启 seed —— /tools 页三档此前恒显示「暂无工具」 (784d12c567)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (49f90ce0c2)
- 🐞 修复:账本候选列不再让 hub 这类结构词冒充业务身份 (d5724ae70f)
- 🔧 工程/其他:第二次撤净 parent-pollution-strays —— 第一次的撤销枚被别席滞后前推整片洗回 (0a66be2720)
- 🔧 工程/其他:离线语言包跟随词包重建 —— 补键后产物自述钉必须同源 (442dba3da6)
- 🐞 修复:服务清单器三处裸 $n 内插根修(RegistryKey.ToString() 返 HKEY_LOCAL_MACHINE 全串⇒真服务全 continue,修前 exit 0 而 services:[])+§0.3「枚举到0个⇒exit 2 未判定」硬闸(T| 分三种0)+生产者形状锁 bareRegistryVarHits;自检 20/20 含改回必翻红成对对照;本机现读 3 枚在册服务零入库真相源,反向 8 枚仓内点名本机不存在 (13c78b14fc)
- 🐞 修复:登记表 4 条抢键条目 rn 置 null —— 撞键 5 组收到 1 组,3 个路由名改回真渲染者的页 (b608ba35c3)
- 📚 文档:补回上一枚被 bash 命令替换吞掉的门名(守门133 check-i18n-locale-content-language)——反引号串在双引号里被当命令执行,文件名成空 (892b1ff31f)
- 🐞 修复:结清 G-37 三件事(35枚JSON parse全OK+四道i18n门全绿+CJK互判/同名自套真命中0;133已装车判这两型;看门狗与构建指纹双向消费均在HEAD)——同行清除F11禁桶措辞 (dbb46a7792)
- 📚 文档:把 SDK 票漂开版的两个独有记号折进当下行(G-23 与释放注记) —— 为归并做零丢失前置 (55877ff48d)
- 🐞 修复:结清G-16(别名+类臂两维已落地)/G-14(svc run脚本已入库+E1真装audit)/G-07(清偿器落地前自查已接)/Esc层栈协议5份副本(单实现+50消费方+23用例+CI 692通过) (d6a4f00558)
- 📚 文档:给24枚占位符作用域票补出真实落点(只搬票面正文已点名、但未加反引号且在HEAD存在的路径,零编造)⇒ 派单器可对它们发互斥合格证;勾选/租约/归属三维逐行不变 (93e0ae4653)
- 🔧 工程/其他:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (d2269d7fea)
- 🔧 工程/其他:test (eb848ead6b)
- ♻️ 重构:孤儿护栏一接一退 —— check-immutable-guard 补 --audit-new(每枚判恰好一次,六态封闭)由 git-guardian 旁路派发(5min 节流/breach 才到人,不挂提交链不堵门);check-guardrail-hashes 退役(与 root-guard 同三目标同机制、基线件从未入库致 --verify 恒 exit 2,接线即 §0.6 重复实现装上车) (b2c05e4493)
- 🔧 工程/其他:路由表随登记面重生成 + RN 测试替身收两处局部复刻 + 硬编码中文基线下调一枚 (3b76e9adf5)
- 🐞 修复:有意还原被 9fdbc207ba 当残件删、6d0dbde7c9 只带回消费行的门234纪元声明面 ⇒ --staged/--worktree 不再 ReferenceError(此前 blocking 门在 pre-commit 面等于不存在);恢复 A1 身份维+孤儿 identity 形参接回 judge;侧车签名折算按取证收掉(接回即造 rotn=17 假阳恒红);回归锁:真跑 --staged + 变异反证,镜像 17/17、自检 26/0 (d17a1f6c74)
- 🐞 修复:前向重放首页收口那一刀 —— 它被 ffbe506f9e 的整文件重放抹掉,商品族堆叠在 main 上已复活 (e118488e7a)
**2026-10-29**
- 🚀 新功能/改进:「已 accepted 未投影」账本 + 空响应权威答案兜底 (02bdf74496)
- 🐞 修复:结清11枚已实现票(告警去重身份/票60多窗格/G-878原生弹窗/D11语音barge-in/G-1222556 CSRF形状/成本熔断/影响面隔离/进化回流/监控大屏/O68就绪门 等,g33 t2t3逐条一手凭据) (e7f79cf7ae)
- 🚀 新功能/改进:帧水位事实上报的端内唯一消费点接线(对标 Qoder 借鉴清单第 6 项) (fc66ffaf0d)
- 🔧 工程/其他:侧车经三条官方出口整份重建(258→155行):--dedupe 60条同键多份→--retire-orphans 43键退场(28条逐字留痕)→--reclassify G-115改归机主git收敛面;rot 58→40/conflict 40→0/dup 6→0/blind 5→0;非手改jsonl,逐行处置见 g33-s10 报告 (68029830b1)
- 🐞 修复:结清 B03(双轴类型+consumers+守门68对账齐)/G-965(投影与强制档均已落,门234已blocking) (7d8ec7325f)
- 🐞 修复:结清四票(207第二刀declaredDropCaps已接/G-1222558四格已达成/68-RN腿三函数同值/圆角基线前提腐烂) (eb87981ee5)
- 📚 文档:鉴权兜底闸已切 enforce，补记 12 条裸奔发现与蓝绿踩坑 (6df1c8efdc)
- 🐞 修复:enforce 档抓出的两条合法公开面补进名单(app-version / news) (1a55dab48d)
- 🔧 工程/其他:重封 root-guard 清单到已入库的 guardian-runner 内容 —— 三处签出的部署环此前全部 fail-closed (58f51477c1)
- 🚀 新功能/改进:补 ai.pane.hookFailures 五语言词包(38 键 x 5) (40206d8ec6)
- 🐞 修复:折叠漂开副本族(N→1,认领合并到保留行 + 逐字留痕;--fold-drifted-families) (cd90c6ea1d)
- 🚀 新功能/改进:对标 Qoder 借鉴清单第 9/10 项 —— 准入回执配对(inputId)+ 命名错误码分类处置 (ef471e56a9)
- 🚀 新功能/改进:跨端生成器对同 rn 撞键出声 —— 静默后写覆盖从此可见 (6e712dc3ef)
- 🐞 修复:回补误摘的 G-322 行(该票未完成:旗标单源已接的 11 文件已满探针,另 77 站待迁) (ab52c91d87)
- 🔧 工程/其他:清两族存量测试红 —— skills-market 的 mock 层错位 + 块合并用例沿用旧判据 (65654e57cd)
- 📚 文档:供应商名单补 xai —— 名单项数与计数 18 长期不符,补上后自洽 (3d2895666d)
- 🔧 工程/其他:补 @ihui/shared 子路径别名与替身出口 —— 六枚套件从账面通过变真跑出用例 (f1560a322e)
- 🚀 新功能/改进:上游模型登记器与 workbuddy 同步器双向归属对账(跨路径 provider 抽取 + assertOwnership 前置守卫 + 只读 --check) (cdef20f80d)
- 🔧 工程/其他:摘除两枚误入库的工具会话导出附件(1.8MB,含凭据行;工具产物不入库,盘上副本保留) (34036e6a83)
- 🚀 新功能/改进:十态轮次状态徽章接线 + 错误码目录首次进屏幕 (651cb924c0)
- 🐞 修复:结清 45 枚前提腐烂/已实现票(批3/3,g30 七席只读分诊逐条一手证据) (2d2bceb2c2)
- 🐞 修复:重生成小程序路由表 —— 商店跳板回正,并补出 Home/HomeMain (b439ca6e69)
- 🐞 修复:结清 46 枚前提腐烂/已实现票(批1/3,g30 七席只读分诊逐条一手证据) (900afc860c)
- 🐞 修复:小程序路由表把「AI 应用商店」错指到首页镜像壳 —— 登记表 rn 撞号根治一枚 (8fa01c3233)
- 🐞 修复:副本归并器物有意还原 1fe3a2b42d 对 plan-copy-row-purge 的 -790 行回退(④c 判据层,HEAD 测试 SyntaxError)+ 接线 21/21;修正 s12 测试件重复函数名 (65f63112c2)
- 🔧 工程/其他:更正跨端对账基线里 IntelligentAssistant 豁免的叙述 —— 生产调用方 4 枚减为 3 枚 (48c9c5545a)
- 🔧 工程/其他:摘 home.recommendCourses 五语言 —— 首页横向推荐列表已下线,键随之零消费者 (0c935a0192)
- 🐞 修复:取消信号穿进 hook 调用点 —— 有意还原 9fdbc207ba 当残件删掉的两处 _wait_interruptible 包裹(969d74b9a6..HEAD 对该文件仅 9/32 行差异,已逐行核对) (8a8ff1f65f)
**2026-10-30**
**2026-10-30**
- 🚀 新功能/改进:领券中心接上真实数据与领取动作 —— 止血空态退场 (4f0d0c261b)
**2026-10-30**
- 🚀 新功能/改进:小程序补 member.couponList.receiveFailed 五语言 —— 领取动作需要一条失败文案 (45da4d7815)
- 🚀 新功能/改进:补「领券中心」的两个用户面端点 —— 可领券列表 + 按 id 领取 (36f6c451f8)
**2026-10-29**
- 🔧 工程/其他:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (888be1ba64)
- 🐞 修复:装悬空提交备份腿到弃落出口(四台落地器共用一份 lib)—— 门 30a 存量从此有排水口 (4468747144)
- 🐞 修复:删除 relay-account-pool-worker 重复的 runTraeSessionSync 导出 (8176b5c52a)
- 📚 文档:鉴权兜底闸已以 observe 档上线，更正'未做'记录 (05e0e309c3)
- 🐞 修复:observe 档上线即抓到 GitHub webhook —— 补进鉴权兜底的公开名单 (6774a82ebf)
- 🔧 工程/其他:补齐三个边缘守卫文件的溯源水印 (aa98aab816)
- 🚀 新功能/改进:鉴权默认拒绝兜底闸(onRoute 追加,默认 observe) (e876ad8f6c)
- 🔧 工程/其他:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (cb284b0b0a)
- 📚 文档:防病毒已装并用 EICAR 实测、守护自拉起腿已补 —— 两格闭环 (2feee1ff75)
- 🐞 修复:修 feature-center i18n 键缺失（开发仓对齐生产仓） (a412a16e56)
- 🐞 修复:修 feature-center i18n 键缺失并补 ui-react work-panel 预留属性 (63efdcfb6c)
- 🐞 修复:补齐 checkpoint 回退入口与 tool-summary 帧的两个缺口(全量 typecheck 归零) (909ae74411)
- 🐞 修复:Trae 切号不再按映像名全杀进程 (3f598e351d)
- 🔧 工程/其他:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (c9ab7153bc)
- 🚀 新功能/改进:补 daemon 档自我存活兜底腿 (cca0a95e4f)
- 🐞 修复:本地文件面收口(任意文件读/任意目录删/跨用户上传) + TOTP 默认升 enforce (1ec1beea63)
- 🐞 修复:镜像构建上下文排除真实密钥,并钉住规则不被删/不写错模式 (c860842563)
- 🐞 修复:边缘 IP 归一再补隧道腿——cloudflared 回环对端采信 CF-Connecting-IP (ad802698df)
- 🐞 修复:成本面/调度状态面进入永不公开名单,收回 .env 白名单漂移 (433df6460d)
- 🐞 修复:收紧知识库归属——/api/knowledge 全插件强制登录,归属只认凭据 (ca1775aa7e)
- 🔧 工程/其他:新增变更B边缘IP透传端到端链路测试 (1a9f2ba2ba)
- 🐞 修复:去掉收敛归并留下的三处重复导出(ExpertAutoRouteMode/ReviewFindingEvent/ReviewFindingSeverity) (b4c26c122e)
- 🐞 修复:补齐 9fdbc207ba2 那批「清理功能回退残留」抹掉的实现(api-client 两导出 + 四个 store/hook 面) (c51a00fd0b)
**2026-10-29**
- 🐞 修复:消掉上一枚落地后复跑暴露的三处简体残留 —— 否则这道门就是我造的恒红门 (c306cfaa2a)
- 🔧 工程/其他:把 ruff/mypy 两面存量红(19 + 4)清到 0,让号池之外的 Python 门重新有牙 (2b981bd839)
**2026-10-29**
- 🔧 工程/其他:把 apps/api/scripts 装进 typecheck 射程,并清掉这面 35 枚从未被看见的存量类型错 (1362cec462)
**2026-10-29**
- 🐞 修复:secure-store 回潮重放 + 三屏模糊接线 + 两处 View 直挂裸文本 (ffbe506f9e)
- 📚 文档:账本追平 —— PDF 工具台从未判定转已承载,缺口候选 10→9 (7758eabfee)
- 🐞 修复:结清 web api 壳迁移票——主体234份已在HEAD(349e116a66),末枚admin/sms/operations已迁 (9b30e5b362)
- 🚀 新功能/改进:侧栏补 /tools/pdf 入口(重放版) (c148782a0a)
- 🔧 工程/其他:ui-routes 产物追上 app.config(重放版) (20c2d8755e)
- 🚀 新功能/改进:给 PDF 工具台补入口 + ui-routes 追上(重放版) (d2f1080548)
- 🚀 新功能/改进:PDF 工具台全链落地(页 + 路由 + 入口 + 判据 + 派生) —— 重放版 (6e3584b69f)
- 🐞 修复:智汇AI 首页收口 —— 同数据源堆叠与随之失效的死码一并清掉 (55c75ae60b)
- ♻️ 重构:收尾最后一枚 api<T> 委托壳 —— admin/sms/operations 迁 apiOrThrow(web 本地 api<T> 声明归零) (7ac88bb579)
- 🚀 新功能/改进:僵尸弹窗与撤销轮次两键五语言词包 (e13b707b2b)
- 🐞 修复:/chat/abort 清除 conversation.metadata.pendingQuestion (5c1bbb7c02)
- 🔧 工程/其他:-- (bf5355699b)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (15eaa6f61c)
- 🚀 新功能/改进:落 RP 族 RP-1 首行 —— 26 枚「未取号」票的迁移与文案改正线 (c842abf2b7)
**2026-10-29**
- 🐞 修复:账本生成器补上"写盘后紧随注入"这条腿 —— 并把被我自己洗掉的载荷落回去 (e7bd406d8b)
- 📚 文档:清偿 13c 归档器的文档↔代码脱节(4 文档 44 行)——文档在号召恢复退役件,这才是回潮的驱动力 (40c9ab3e53)
- 🐞 修复:secure-store 探测改同步取模块 —— dev bundle 的 lazy chunk 404 让刷新令牌永远落不了盘 (87a16d748a)
- 🐞 修复:给守门 26 的存量开一条排水口——清扫器新增具名族 parent-pollution-strays(判据 import 门体,不抄第二份) (c86f69d8e1)
- 🔧 工程/其他:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (e0acf77c41)
- 🚀 新功能/改进:活动级几何虚拟化 + 工具摘要三档维度补齐 (80d97436e2)
- 🚀 新功能/改进:轮次呈现投影层建立并装车 —— 消灭「造好没装车」 (1f3e7bd27b)
**2026-10-29**
**2026-10-29**
- 🐞 修复:「我的」页菜单「会员中心」撞名 + 抽屉键错位 + 底部条目被淡出遮罩压暗 (3ac7b5859b)
- 🐞 修复:增强跨端无硬边淡出遮罩强度 (dd34b4bbfa)
- 🚀 新功能/改进:D05设计稿落地现状对齐 + 清偿器补守门130落地前自查(F4/F4b/F9三维,g30 s9/s2) (316beddb12)
- 🔧 工程/其他:登记会话导出件族豁免 —— 门 47 缺口归零 (599baad8fa)
- 🐞 修复:补回富文本锚点 link 族的 <a href> 渲染 —— 事故提交 9fdbc207ba 把 renderLink 当残留删掉导致 role=link 全失效 (8fa512f9bb)
- 🐞 修复:智汇AI 首页移除与 AI 应用商店重复的四块内容 (f571b65018)
- 🐞 修复:结清三票(G-109四格全闭合/G-924死键已清零/G-689 stderr尾缓冲已装车) (5d9d115a2f)
- 🐞 修复:结清两枚前提腐烂票(dot-source传递闭包3d31e4c499已装车/六屏下沉411646ee58等已全量) (13c1bdaec1)
- 🐞 修复:结清 L5646 门116型B行——前提已腐烂(该文件裸git派生实测0,清偿枚949195bcb5早已是祖先) (b8ede2328e)
- 监控/告警规则(2026-11-03 装车,**warn**,runner id '286';**本地面原登记为 282,与 43fe135510 先占的 `check-web-rn-gap-ratchet.mjs` 撞号 ⇒ 门 89 R5 判红,按在册口径「后来者改号」让到 286,判据/档位/skipEnv/射程一字未动**): `check-metric-existence.mjs`(把 `monitoring/**` 告警与 recording 规则里的指标名与 Prometheus `/api/v1/label/__name__/values` + `/api/v1/series`(默认 24h)对账,判**打错 / 从未产生 / 样本过期**三态,任一命中即非零退出;立因:把 `alerts-ai.yml` 的指标名改成 `..._totl` 后 promtool/reload/status/config 全绿、lastError 空,规则从此静默永不触发。不升 blocking 的理由 = 判据依赖本机 Prometheus,机器没起会退到静态清单,升上去就是"Prometheus 没起谁也提交不了"的恒红门(§12e)。自检:`node scripts/check-metric-existence.mjs --self-test`;镜像:`node --test scripts/tests/check-metric-existence.test.mjs`;合法零样本只走具名台账 `scripts/data/metric-existence-exemptions.json`(带到期,发射点仍在 + `up{job}==1` 双硬验);应急放行 `HUSKY_SKIP_METRIC_EXISTENCE=1`(留痕)。
- 根护栏清单自洽(2026-11-03 补**第二张脸**,**不进提交链**): `check-root-guard-manifest-sync.mjs` 原先只判本机 HEAD,而部署环构建的是远端 tip —— 本机 main 落后 origin 317 枚那段,巡检连判 12 轮"✅ 自洽",部署环同刻三轮 `verdict=fail`,墙立了 4.7 小时无人从守护侧发现。现加 `--against-remote origin`(tip 只认 `git ls-remote` 的当次回答,对象不在本地就补取一趟,取不到 ⇒ 未判定不回落 HEAD),调度器 `git-guardian.mjs` 的 `auditRootGuardManifestSync()` 改为 **head + remote 两面各判一次、分桶不并桶**,到人身份 = `face=<面>;manifest-drift`(两面红不许互相吞)。镜像:`node --test scripts/tests/check-root-guard-manifest-sync.test.mjs`(M8–M12 钉住三态与两面派发)。
- 号池只读尺子(2026-11-01 立,同上进不了提交链): `check-pool-isolation.mjs`(号池隔离性六维体检 D1 设备簇/D2 共用 rt/D3 同 uid 双行/D4 rt 终点证据/D5 出口亲和/D6 死副本;薄壳入口——判据单源在 `apps/api/scripts/relay-pool-isolation-audit.ts`,本器只以 tsx 转发跑它,§0.6 零复算;只读不写库不回显凭据;接线 = git-guardian 巡检轮 `sweepPoolIsolation`——门 89 第五处权威点「守护调度器」已认它,此行补的是 R4 文档面)
- **运行期真值出口**:`GET /downloads.json`(根级 `.json`,不走 `/api/` —— nginx 把整段 `/api/` 转给后端,Next 路由经公网到不了)与 `apps/web/src/config/downloads-live.ts`:各端版本号与安装包在**运行期**解析(desktop 取 release 分页枚举、android 取 `app_versions` 注册表 latest 行、ios 取 `ios-nightly` 固定 tag 资产、cli 取 npm `dist-tags.latest`、扩展取 `public/downloads/extension/` 实物文件字节),构建期常量只作兜底;取不到的端如实标未接入并给机器可读原因码,侧栏下载栏经 `use-live-downloads` 消费同一出口
- UI / 容器 hover 浮起数值源(2026-11-03 立,blocking,runner id '287'): `check-hover-lift-single-source.mjs`(`apps/web/**` 与 `packages/ui-react/**` 里任何 `hover:`/`group-hover:`/`sm:hover:` 变体后跟 `translate-y-*` 或 `shadow*` 的 Tailwind 字面量 ⇒ 判红;全站唯一数值源是 `apps/web/app/globals.css` 的 `--lift-*`,那块头注本就写着"端内不得再各写",但**铁律只是注释**时它不存在(§0.9),实测当天全仓 24 个文件 30 处散写。豁免只走具名台账 `scripts/data/hover-lift-single-source-allowlist.json`(reason ≥10 字 + until 到期;到期或登记数大于命中数 ⇒ 红,§0.7)。编号以 runner 现值为准(该条原登记 285,与文档中心公开面门撞号后顺延)。
- 跨端 / 同名组件 props 对称性(2026-11-03 立,blocking,runner id '288'): `check-cross-end-component-props-parity.mjs`(两端同名组件的 props **键集与必选性**对称性,判据引擎单源 = `scripts/lib/component-props-parity.mjs`,本门零复算;档位按 §12e 走**台账制差值棘轮** —— 存量 18 对里 17 对有差是当下事实,全量绝对判红只会变成逼人 `--no-verify`,故基线台账 `scripts/data/cross-end-props-parity-baseline.json` 登记在册差,只拦**新增退化**(在册对出现台账之外的新 onlyRn/onlyMini/reqDrift 键 ⇒ 逐键点名)。立因:调用端把一个只有对端消费的 prop 传出去,本端没有那条腿、不报错、看不出来 —— 失效型是静默的,从"掉色"降到"掉腿"。)
- 下载栏 / 八端运行期真值(2026-11-03 立,**不进提交链**): `check-downloads-live-health.mjs`(读**用户看到的那份** `/downloads.json`,先本机源站臂后公网臂,判五档:D1 整站新鲜度超 25 分钟没刷新 / D2 少一端(形状漂移)/ D3 必备端 `unavailable`(立即类)/ D4 该端 `sizeBytes<=0`(体积拿不到=腿断)/ D5 `web` 那一格不再是「PWA 无安装包」只报名不判红)。立因:八端的降级契约是「取不到就不覆盖底稿」,而**全仓没有任何一道哨兵读这个出口** —— cli / extension / 微信小程序码 / mobile 四条腿永远不会有告警,`generatedAt` 全仓零消费者。防噪声:snapshot(一次网络抖动)需**连续两轮**同判据才喊人,节流戳与台账各一份;红档身份 = `downloads-health;red=<计数档>`(不含时刻/sha,§5e-3)。调度器 = `git-guardian.mjs` 的 `sweepDownloadsLiveHealth()`(daemon tick + main 单轮两处,30 分钟节流)。自检 `node scripts/check-downloads-live-health.mjs --self-test`(13 例,含"摘掉新鲜度判据即翻红"与"无任何时刻字段 ⇒ no-timestamp"两条反向锁)+ 镜像 `node --test scripts/tests/downloads-live-health.test.mjs`(9 例:成对红绿 / 两轮确认 / 未判定不并桶 / 臂序 / 装车锁 / 节流锁 / 反向锁)。刻意不注册进提交链(§12e:站点没刷新不是本次提交者的错,挂上去即恒红)。
**2026-11-03**
**2026-11-03**
**2026-11-03**
**2026-11-02**
**2026-11-03**
- 🔧 工程/其他:a1029c579c 并入后派生件重算 —— ui-routes 329 页 / README 近期块×4 / last-sha (c95120eb2a)
- 🔧 工程/其他:合并后派生件重算 —— ui-routes 329 页 / README 近期块×4 / last-sha (f3a4ce5649)
- 🐞 修复:计划任务档禁用把 main 单轮链 74 条巡检腿整体停摆 27h —— 恢复任务档 + 游标类两枚同挂 tick (a1029c579c)
- 🐞 修复:for-each-ref 顶穿默认 1MiB 缓冲 ⇒ 22,298 条"假缺失"的失明根因 (5625a4b4ee)
- 🚀 新功能/改进:考勤趋势图的 web 五语言键按 HEAD 面重构后入库(不带走别人已入库的键) (2b53f979d7)
- ♻️ 重构:清偿 PROJECT_PLAN 重复登记存量(L1-L4 指针注记 + L5/L6 无注记真归并) (cd02912f6e)
- 🐞 修复:daemon tick 补齐隧道腿/短信通道/发起腿/隧道指标 4 个审计派发 (84bdfb5b7f)
- 🚀 新功能/改进:教师端考勤统计补真趋势图——同板块成绩页早有图表而考勤页停在进度条 (c76c79dffb)
- 🚀 新功能/改进:下载栏八端运行期真值哨兵装车(guardian 30min 轮) (63b4f77013)
- 🔧 工程/其他:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (d4a120413d)
- 🔧 工程/其他:bump nativewind from 4.2.6 to 4.2.7 (774e4e53b0)
- 🐞 修复:添加按钮桌面点击区补足 32px (3855f738d5)
- 🐞 修复:O21b create 版本正向用例声明 text/markdown —— md 纳入上传白名单后,octet-stream 会被 MIME 一致性闸判 400 (5d30f42942)
- 🐞 修复:文档上传再收四档 tsv/json/ods/odp,并把收了却解析不了的那条腿一起补齐(票 D53 第十批,③桶 6 到 1) (405e2a5b46)
- 🐞 修复:小程序端考勤改口服务端判定,状态档与点名时刻走单一契约文件 (ebc76ae16c)
- 🐞 修复:补 marketing-fonts.css 溯源水印 (3498fbedec)
- ⚡ 性能:营销首页落地窄字体子集(三字重 1,082,248→213,768 B,−80.2%) (e43d3fb049)
- 🔧 工程/其他:bump knip from 6.32.2 to 6.44.0 (5ee98040e2)
- 🐞 修复:手机端考勤改口服务端判定——不再自报状态、"早退"有色档、代签限当日 (291f063740)
- 🔧 工程/其他:考勤扫码屏替身 Tappable 扁平 style 再下发,修 react-dom 数组 style 抛错导致的 2 红 (68da14a59e)
- 🔧 工程/其他:四语 README 数字块与最近更新按生成器重算(跟踪文件 18997),last-sha 随生成器更新 (5794de40d7)
- 🐞 修复:底栏加载态收起 spinner,默认 480 面板恢复单行 (bbceebe19c)
- 🐞 修复:缺勤补录加回溯窗——absent_after 晚于跑批时刻的班级不再永远漏判 (8a9fd219e6)
- 🐞 修复:AI 输入卡底栏按钮重叠:禁止压缩、按优先级收文字并在窄档换行 (2d1939b981)
- 🐞 修复:教师代签与批量点名不再认客户端自报状态，签退重判让"早退"真有写入路径 (f1f098635e)
- 🔧 工程/其他:四轮合并后按生成器重算四语 README 数字块与最近更新 (05afa46b95)
- 🔧 工程/其他:三轮合并后按生成器重建三端 ui-routes 与小程序 i18n,重算四语 README 数字与最近更新 (aab5de8927)
- 📚 文档:F9 撞号让号(正牌取号器发 Y-3,原 D53 行留痕归档)并摘除滞留已勾行 RP-35 (72ec4879aa)
- 🐞 修复:知识库上传框收了 md 而后端白名单不收,用户选中必吃 400 —— 白名单补 md、UI 摘掉后端故意拒收的 html/htm(票 D53 第九批) (c52250f555)
- 📚 文档:摘掉收敛写进 HEAD 的三行冲突标记与一条 R4 重复登记副本,体积回到预算内(余量 389 字节) (4fa7c3fd34)
- 📚 文档:归档件先行——2026-11-03 体积清偿的原文逐字落档(收敛残留标记 3 行 + R4 重复登记副本 1 行 + 尺子行的前像) (f460a82b4e)
- 🐞 修复:静态导出移出 docs/[slug]，空 generateStaticParams 不再阻断构建 (7fd9a596ac)
- 🐞 修复:摘除合并回灌造成的 DOWNLOAD_PLATFORMS/isDownloadPlatform 重复定义,修 T1 双声明 typecheck 红 (baab5bfadb)
- 🐞 修复:清掉 downloads.config 重复的 DOWNLOAD_PLATFORMS/isDownloadPlatform 声明（TS2451/TS2456，gate-analyse 与 gate-build 同根因） (dceb324bf1)
- 🐞 修复:两条长期红的修因 —— 假远端页改同源独立文档(生产 CSP 无 unsafe-eval 时 srcdoc 继承策略拦 eval);登录首屏协议弹窗按真实用户路径处理,并消除共享 LoginForm 与 web 扫码面板的双重协议窗 (ffdd903b73)
- 🔧 工程/其他:bump tsx from 4.23.12 to 4.23.15 (d94078250f)
- 🔧 工程/其他:bump @tauri-apps/api from 2.12.1 to 2.12.4 (59f73f26e8)
- 🔧 工程/其他:二次合并后按生成器重算四语 README 数字块与最近更新(619 表/4683 路由/4034 测试/322 守门/52 CI) (e857b3fa9e)
- 🔧 工程/其他:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (6ca3a30179)
- 🔧 工程/其他:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (05be848608)
- 🔧 工程/其他:合并 origin/main 后重算四语 README 数字与最近更新、重建三端生成件并重封根护栏 (c497ced6bf)
- 🐞 修复:恢复被归并丢弃的 unknown 收窄与 e2e 类型导入 (3d7d912572)
- 🔧 工程/其他:考勤词包契约的扫描面从 1 枚扩到 8 枚,并教会它认出"本地转发助手"型取词(票 B71 收口) (69b79aee34)
- 📚 文档:D53 结清后另登记两格真工作(HTTP 真 404 / 手册 5 章补图),各带现状与出路,不混入已结清行 (c6a39010f2)
- 📚 文档:结清 D53 文档中心格式层与排版收口(七簇逐簇有凭据,摘本席牌后整行删除) (9a5f4296d1)
- 🐞 修复:收掉收敛合并的两处后遗症——docs 公开面门重复登记摘除(正号 285),指标存在性门补 R4 文档点名 (657534b221)
- 🐞 修复:文档中心每页只剩一个 H1 且它必须是本页主题;不存在的 slug 不再把 slug 当标题(票 D53 第八批) (b2267de78c)
- 🐞 修复:老格式 Office 预览默认不再外发文件地址,文档中心口径同批改准(票 D53 第七批) (4fe47b7af3)
- 🔧 工程/其他:收编停留≥3分钟的未提交改动 (ac7a1c3ac3)
- 🔧 工程/其他:对齐 README.md 头条表/API/测试/守门/CI 五处数字 (72d41e857d)
- 🔧 工程/其他:对齐 README.en 头条测试文件/守门/CI 三处数字 (12fa52aaa9)
- 🚀 新功能/改进:文档中心首页接上数据库那侧,后台发布的文档终于在前台可见(票 D53 第六批·7 簇最后一格) (b53b8e29c6)
- 🔧 工程/其他:重算四语 README 数字块与活性散文数字(生成器实算面) (3c459e2087)
- 🔧 工程/其他:收敛非 required 高频 workflow —— visual-regression/lighthouse/i18n-dead 转 schedule+dispatch,real-db/mirror/style-spec 按 ref 只跑最新,android APK 改 per-ref 取消 (6d42d30f15)
- 🔧 工程/其他:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (e746f0ba20)
- 🚀 新功能/改进:装上「格式登记表↔渲染实现」对账尺 + 更正门 282 头注与注册现实的矛盾(票 D53 第五批) (43523a5807)
- 🐞 修复:文档中心五页正文表情图标清零+rag 伪表格改语义表格+能力宣称改准(票 D53 第四批) (66c6f4e195)
- 🔧 工程/其他:收编停留≥3分钟的未提交改动 (15c45b0bae)
- 🔧 工程/其他:收编停留≥3分钟的未提交改动 (b58037ca86)
- 🔧 工程/其他:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (fb238de69e)
- 🔧 工程/其他:收编停留≥3分钟的未提交改动 (1e4502da88)
- 🐞 修复:撤回 Button|geometry 与 Button|radius 两条永不命中的允许差异登记(存量债改由 web 腿锚点承担) (50b982eeb0)
- 🔧 工程/其他:把 WD Button 实测存量钉进 web 腿锚点(几何 12 / 圆角 2) (686ecc1db4)
- 🔧 工程/其他:收编停留≥3分钟的未提交改动 (853d6aa959)
- 🚀 新功能/改进:代码块接上语法高亮,复用对话流既有形态(票 D53) (3ca376e9c8)
- 📚 文档:登记 WD Button 几何与圆角两维为带到期的允许差异(到期 2026-11-17) (81051824fc)
- 🔧 工程/其他:收编停留≥3分钟的未提交改动 (a5d5975971)
- 🚀 新功能/改进:文档中心文案抽进 docs.* 命名空间,五语言同批齐备(票 D53) (ef8a1a3f9c)
- 🐞 修复:面板 tooltip 字号脱离 11px 字面量,归到 caption 角色档 (259c615623)
- 🔧 工程/其他:收编停留≥3分钟的未提交改动 (24ed9b91f5)
- 🔧 工程/其他:收编停留≥3分钟的未提交改动 (0e166ea090)
- 🔧 工程/其他:收编停留≥3分钟的未提交改动 (03abe577f7)
- 🔧 工程/其他:收编停留≥3分钟的未提交改动 (c7d0a84638)
- 🔧 工程/其他:收编停留≥3分钟的未提交改动 (d58fdb106f)
- 🔧 工程/其他:收编停留≥3分钟的未提交改动 (2a94268b4e)
- 🚀 新功能/改进:考勤端上面收口 票B67 B70 B72 三端可见可操作可配置 (286ce1da49)
- 🔧 工程/其他:收编停留≥3分钟的未提交改动 (153bf2b63d)
- 🔧 工程/其他:收编停留≥3分钟的未提交改动 (f018abb84b)
- 🔧 工程/其他:收编停留≥3分钟的未提交改动 (884719fa8e)
- 🔧 工程/其他:收编停留≥3分钟的未提交改动 (22205c4117)
- 🐞 修复:游客态手机打开文档站不再被面板整屏遮住(票 D53 第二枚) (704ae4ed73)
- 🔧 工程/其他:收编停留≥3分钟的未提交改动 (06507c867d)
- 🔧 工程/其他:收编停留≥3分钟的未提交改动 (1d2c6be761)
- 🔧 工程/其他:收编停留≥3分钟的未提交改动 (cd48067b9d)
- 🔧 工程/其他:收编停留≥3分钟的未提交改动 (bc0de68629)
- 🔧 工程/其他:收编停留≥3分钟的未提交改动 (5c8563bed1)
- 🔧 工程/其他:收编停留≥3分钟的未提交改动 (ab0f41ac16)
- 🚀 新功能/改进:文档页内目录组件落地(仅组件与用例,挂载待页面席结清后同批) (50c62a2dd0)
- 🔧 工程/其他:收编停留≥3分钟的未提交改动 (318d219ba2)
- 🔧 工程/其他:收编停留≥3分钟的未提交改动 (fd21ed3065)
- 🐞 修复:就绪探针放宽 + 队列锁期补登记 + 侧栏分组标题脱离 10px 档 (8bfa76bddb)
- 🔧 工程/其他:收编停留≥3分钟的未提交改动 (274d22ec99)
- 🚀 新功能/改进:考勤后端面补全 票B67 B70 B71 B72 承载层格 (5d1e160ebc)
- 🚀 新功能/改进:文档中心公开面健康门装车(编号 282,blocking)+ 补记上一枚占位信息 (54e17854b2)
- 📚 文档:auto-triage 自动登记(api-logs;第 1 期感知层产线动作,O65) (aa859c014b)
- 🔧 工程/其他:收编停留≥3分钟的未提交改动 (e92e623473)
- 📚 文档:auto-triage 自动登记(api-logs;第 1 期感知层产线动作,O65) (ef806aa543)
- 📚 文档:auto-triage 自动登记(api-logs;第 1 期感知层产线动作,O65) (d6b41fae4f)
- 🔧 工程/其他:x (8701732dfd)
- 📚 文档:认领文档中心格式层与排版收口票(7 簇并行,主席统一落地) (89b014b18a)
- 🚀 新功能/改进:新增小程序交互卫生门(290)与 web↔RN 措辞一致性门(291) (f664fb52e9)
- 🚀 新功能/改进:落语义等价映射表 + 门285 mapped 分类与棘轮 —— 3 条命名等价(onPress↔onTap×2、label↔labelKey)归 mapped 4 键,漂移 277→273;表扩容须同轮收敛 (2ccede4e8e)
- 🔧 工程/其他:补齐 gen-rn-shell-scaffold 与 rn-shell-target 两枚溯源水印欠账 (e343c19714)
- 🐞 修复:门 289 补射程声明 stagedTriggers ['**/*'] —— check-gate-triggers 新增缺 1→0(到期与暂存面无关,必须每提交跑) (75768f75a5)
- 🚀 新功能/改进:deferred@ 到期判据常驻(门 289,blocking) (fec71850ab)
- 🚀 新功能/改进:覆盖门增补「新屏无壳且无判决」造壳命令队列(既有读数不变) (5f258fd86a)
- 🚀 新功能/改进:新增 gen-rn-shell-scaffold 预演式造壳器(默认 dry-run/--force 先备份/6 例自检) (9eaf14ef2f)
- 🐞 修复:结清 P84/P85/P86 + 摘 RP-91 重复副本 + 结清 docs-207 (848e4a4f46)
- 🐞 修复:收口被整块重复的登记(F6 块级判据的修复出口) (e61c494fc5)
- 🔧 工程/其他:登记 B72/D04/D05 处置 (a1ee9465bf)
- 🔧 工程/其他:登记 B72/D04/D05 处置 (d9ed3e722f)
- 🔧 工程/其他:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (0af18824e2)
- 🔧 工程/其他:RP-79 dedupe theirs (plan-union-merge input) (c3a32de7d7)
- 🐞 修复:ColorfulLoader 两端同源收口 —— RN 补 visible(不渲染即 null)、小程序适配层补 duration(默认共享档),门285 消 2 键 (657b9ed59f)
- 🔧 工程/其他:store-migration-end-factory 冷启动移出用例窗口——全量超时 flake 的确定化收口 (3b72141949)
- 🐞 修复:门 30a 悬空 commit 分档——等价残留(仅树逐字同)不判红,四档逐次报数 (18a0179a49)
- 小程序交互卫生(2026-11-03 立,blocking,runner id '290'): `check-miniapp-interaction-hygiene.mjs`(A1 假可点(View/Text 绑空实现 handler,或 className 带 pointer-events-none 却挂 onClick)与 A2 空端口(onNavigate/onToast/onPickFile 等端口被赋空实现)绝对零容忍;A3 无交互反馈(首读 174 处)与 A4 showModal 纯提示误用只出 advisory、不进退出码(§12e)。豁免只走具名台账 `scripts/data/miniapp-interaction-allowlist.json`。自检 `node scripts/check-miniapp-interaction-hygiene.mjs --self-test`(12 例)+ 镜像 `node --test scripts/tests/check-miniapp-interaction-hygiene.test.mjs`;应急放行 `HUSKY_SKIP_MINIAPP_INTERACTION_HYGIENE=1`(留痕)。)
- 跨端 / web↔RN 措辞一致性(2026-11-03 立,blocking,runner id '291'): `check-web-rn-copy-parity.mjs`(只比对 `scripts/data/web-rn-screen-map.jsonl` 里 aligned 的同屏映射;B1 = web 该屏已走 i18n 键而 RN 仍硬编码逐字相同的中文(JSX 文本节点与 placeholder/title/accessibilityLabel 等用户可见属性)⇒ 判红;B2 同值异键只出 advisory(合并键空间归人裁决,§12e)。存量认领走 `scripts/data/web-rn-copy-diffs.json`(owner/expires/evidence/count,到期即红、认领数少于现读即红)。自检 `node scripts/check-web-rn-copy-parity.mjs --self-test`(12 例)+ 镜像 `node --test scripts/tests/check-web-rn-copy-parity.test.mjs`;应急放行 `HUSKY_SKIP_WEB_RN_COPY_PARITY=1`(留痕)。)
J 扩展端版本单一源头 —— `apps/extension/wxt.config.ts` 不得写死 `manifest.version`(缺省时 WXT 回落 `apps/extension/package.json`,与 `sync-downloads` 的文件名同源),下载页 extension 资产 href 必须由 `extensionPkg.version` 拼出,扩展源码里也不许留手搓版本常量(运行期取 `chrome.runtime.getManifest().version`)。
> 8 端下载元数据单一事实源(`PLATFORM_META`)+ 详情页(`/download/[platform]`)+ 下载量统计 API + 自动化构建同步脚本。**版本与大小两列不再手写** —— 此前这两列钉着一组固定值,而桌面实物在其后又连发了几十个版本、扩展包体积也与登记值差出三倍,手写列本身就成了假账;实时值看 `/downloads.json` 与详情页。下载中心 UI 为 web 专属,统计 API + 共享层类型 + api-client + hook 跨端复用。
| **Desktop**     | Windows NSIS `.exe` + MSI  | 以 `/downloads.json` 为准 | 以 `/downloads.json` 为准 | 🟢 已接入   |
| **CLI**         | `npm install -g ihui-cli` | 以 npm 上的 `ihui-cli` 为准 | -                | 🟢 已接入   |
| **Extension**   | Chrome MV3 `.zip`          | 以 `/downloads.json` 为准 | 以 `/downloads.json` 为准 | 🟢 已接入   |
- **桌面安装包地域分流入口** `GET /dl/desktop?file=<资产文件名>`(所属端:web):同源解析器按访客地域临时重定向 —— 确认在海外走 GitHub 权威腿,国内或地域信号取不到走 Gitee(仍须过字节等值),响应 `no-store` 故地域决策不进 CDN 缓存;口径与判据见 [docs/RELEASE.md](docs/RELEASE.md)
> 而**带不带现在是运行时判的**,不再是文件级禁令:2026-09-28 在真实产物 `chrome-extension://<id>/sidepanel.html` 实测扩展页是安全上下文、`showDirectoryPicker` 在位、`mode:readwrite` 是被接受的枚举、受信任点击后错误由 SecurityError 翻成 AbortError(手势链通),且那份 12-case 委托执行器对着真实可写目录句柄跑 11 条全部按语义返回。于是 `lib/workspace-capability.ts` 把放行条件钉成「能力探测 ∧ 已登记执行代理」两半(改任何一半都不许放开,`toolsForChatRequest` 必须过它),`lib/workspace-store.ts` 在 pick 到 readwrite-granted 的句柄时才登记,侧栏多了工作区入口与工具审批横幅,`ChatPage` 送 `workspaceContext`(服务端委托分支的开关本身)并接 `onToolDelegate`/`onToolApproval`;同批把 web 取句柄的档位从 `read` 改成 `readwrite` —— 此前浏览器端"让 AI 改文件"是发得出去、执行必失败。提交:`64bc41cad1` / `258b43080a` / `07e789b3e1`;补账①②③④ 已于同日落地(`3a8726494e` / `43a5248278` / `c3d14f5586` / `fe69a7ae56` / `baca9cbf32`):扩展端三个真键入语言包并换掉借用的近义键、审批多出"本会话都允许"一档("永远放行"仍永久禁用)、工作区上下文缓存提为共享层单源(扩展每轮不再全扫目录树,切换与清除即收回)、守门 49 的判定面收口到 HEAD/索引两面、服务端委托往返补上进程内集成证明(9 例,含"去掉 `workspace_context` 就落服务端执行"的反例)。**没量到的那一格仍然没量到**:真实浏览器与扩展里的一次点击、原生目录选择框、前端执行器产出 payload 的真实形状、真实 provider 调用与计量 —— 本机登录后端可用性未复核(2026-11-04 实听:8801/8802 由 ihui-api-router.mjs 占用、8803 uvicorn、8810 PostgreSQL、8811 redis-server 在听;6379/5432 零监听;未做 HTTP 登录探测),属真人验收缺口。逐件落点与判据见 PROJECT_PLAN 的 O81 票㉕。**工具流中 diff 预览(SSE `tool-delta` 帧)现覆盖 web / 小程序 / RN 三端**:载荷 `partialText` 是**累积文本**
  诚实边界(2026-09-29 现测,替掉本段原来那句"本机没有运行中的服务"):本机**有** PostgreSQL 18.6(`127.0.0.1:8810`,库 `ihui_dev`)与 Redis(memurai,`127.0.0.1:6379`),`api`(8802)与 `ai-service`(8803)在听、`web`(8801)不在听,也没有 IHUI* 服务形态。所以验证分两档:**数据库侧本机真跑得通**(D172 的迁移已在一次性空库里应用两次并量过列/索引形状),**到端渲染与真机行为仍未取证**(没有浏览器会话,§17 的 4 状态截图要有起来的 web 才拍得出)——不写成"已实测"。
  那句"没有数据库"是怎么来的:**拿端口注册表里的约定端口当引擎存在性去探,探不到就下结论**。而本机 PG 监听 8810(非默认 5432),`apps/api/.env` 的 `DATABASE_URL` 现写着 `127.0.0.1:8810/ihui_dev` —— 应用的连接串才是权威入口;但 `scripts/lib/db-probe-client.mjs` 的 `guardDbDsn` 把 8810 定为生产 SSH 隧道口(`FORBIDDEN_PROD_PORT`)而拒绝连接,故依赖 `--db` 的采集器在本机恒判"未判定" —— 这不是"没有数据库",而是守卫按设计拒绝。口径:**判"某引擎在不在"要先读被审应用自己那份 DSN**, 端口注册表(AGENTS §2 / `docs/port-management.md`)记的是"约定端口",不是"这台机装了什么"。
  诚实边界:以上都只验到"静态判据 + 单元/组件用例"这一层。本机 PostgreSQL 8810 在听(2026-11-04 实测),
  但本轮取证没有浏览器会话,所以**到端渲染与真机行为未取证**,不写成"已实测"。
- **教务考勤**:班级阈值规则(迟到/早退/缺勤)/ 每日缺勤自动补录 / 请假审批联动 / 整班批量点名 / CSV 导出 / 代签·自签·扫码三档签到 / 学生本人页三端同步
- **规则级审批引擎**(2026-11-04,`packages/shared/src/permission/`):
  - 声明式规则 `{id,match,decision,priority}` 排序后判定,输出 `{decision:allow|ask|deny,matchedRule,reason}`;命令风险对接 `packages/shared/src/utils/command-risk.ts` 的 AST 判定(非 token 正则,字符串字面量不误判),规则族覆盖命令风险 / 路径越界 / 网络出口 / 凭据读取 / 批量删除
  - 自动复核只对 `ask` 且 `autoReviewable` 的规则生效(同主体 + 同 workspace + 同规则 id + 同命令前缀的重复请求),结果留 `matchedRule` 与理由;**deny 不可降级为 allow**
  - 授权记忆持久化在 `user_preferences(group='permission', key='grants')`,字段 `{tool,matchPattern,scope(workspace|agent|global),expiresAt,createdAt,grantedBy}`;判定侧校验 scope 与 expiresAt,过期即失效
  - 接口(API 端,需登录):`GET/POST /api/agent-control/permission/grants`、`DELETE /api/agent-control/permission/grants/:id`
  - computer-use 应用白名单:声明 `appName` 的 `/execute` 先过白名单闸门,未授权/过期/scope 不匹配一律 `PERMISSION_DENIED`
**2026-11-04**
- 🔧 工程/其他:收编停留≥3分钟的未提交改动 (08d41693f6)
**2026-11-04**
- 🔧 工程/其他:收编停留≥3分钟的未提交改动 (0cdb9c5adc)
- 🔧 工程/其他:收编停留≥3分钟的未提交改动 (cd5826f592)
- 🔧 工程/其他:收编停留≥3分钟的未提交改动 (3bd970724d)
- 🐞 修复:恢复下载详情页被误删的三个展示组件,修复主干编译中断 (60e311a376)
- 🐞 修复:门291 C组32条挂账清零,RN改取web真源键并摘除旧键 (09aab027db)
- 🐞 修复:门 285 证据定位改为按符号名解析，消除加注释即报证据行漂移的误红 (55cfe0055f)
- 🔧 工程/其他:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (e8587b8d24)
- 🔧 工程/其他:收编停留≥3分钟的未提交改动 (3f53cd4128)
- 🐞 修复:分片腿加首片看门狗,任何失败都退回原生单流 (8dbc29d49e)
- 🐞 修复:B 组收尾补漏（showClear 两端删除、mini robotImage 真渲染） (1b02399947)
- 🐞 修复:平台裁决清零(46→0),A组18条真实现/删除,门128两红收口;补 pnpm-lock 记账(解门101 存量红) (e281cc9b3e)
- 🐞 修复:整包下载改 8 连接分片 + 诚实的速率读数 (e4c0b285e7)
- 🔧 工程/其他:收编停留≥3分钟的未提交改动 (9ba7780301)
- 🔧 工程/其他:收编停留≥3分钟的未提交改动 (ad0af8b999)
- 🔧 工程/其他:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (79fc8f2339)
- 🔧 工程/其他:收编停留≥3分钟的未提交改动 (e89b032d64)
- 🐞 修复:c-drive 默认即扫暂存区，无输入面不再空转报绿 (3bed6719e3)
- 📚 文档:门45 注释同步空暂存区=0 不适用 (e27c873fec)
- 🐞 修复:c-drive 空暂存区按 A 级 check-file-size 口径 = 0 不适用（更正） (e62a4f5e2f)
- ♻️ 重构:屏级默认档等值落具名档·carte/edu-parent 10 处 (0b23dbfbab)
- 🐞 修复:B 级 6 门三态化，取不到输入即 exit 2 (ebee2d6fa5)
- 🚀 新功能/改进:跨端写盘腿 tick 落 downgrade/undetermined 两态并接告警面 (8c61f56034)
- 🐞 修复:登录页 welcome SVG 按 </svg> 截断,消除裸文本子节点触发的 Text 组件告警 (493d714c83)
- 🚀 新功能/改进:新增真机热更预览通道 rn-live-preview(8809, 自检12/12) (2faca4b6fe)
- 🔧 工程/其他:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (af754200b8)
- 🐞 修复:BottomActionBar 来源面板空声明回退 (731af09c90)
- 🐞 修复:LoginPopUp/BackChevron 必选性对齐 (947b908505)
- 🐞 修复:ModelConfigDialog 死变体删除 (767c0b9c0c)
- 🐞 修复:InputArea/ModelList 死腿删除 (0b8992e620)
- 🐞 修复:BottomActionBar 手工压缩入口接线与死腿删除 (ca5429d33a)
- 🔧 工程/其他:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (61f270bf6e)
- 🔧 工程/其他:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (0d87de6175)
- 🐞 修复:NavBar/VideoPlayer 证据换真 (518a6776d0)
- 🐞 修复:VoiceInput 图片死腿删除 (458a4ebf67)
- 🔧 工程/其他:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (4c371d6d51)
- 🐞 修复:UserInfoCard onOpenVip 真实现与死字段删除 (0c51f35b2f)
- 🐞 修复:LoginPopUp 协议真实现与同槽收敛 (912d931bf7)
- 🐞 修复:capability-catalog 门取不到暂存面时改判 exit 2 未判定 (60b472eaa1)
- 🔧 工程/其他:dedupe 夹具超时放宽到 600s(规避 pnpm 并发持有夹具) (794f8b02b0)
- 🐞 修复:底部淡出遮罩渐变段 120→90 —— 机主复看仍点名「顶部有点高」 (cf11ee7293)
- 🐞 修复:根治「签名不一致」—— debug 签名不再静默可得,装机前强制证书对账 (0c3dd5bed7)
- 🐞 修复:底部淡出遮罩渐变段 160→120 —— 机主点名「还是高」,同步「我的」页让位量 104→72 (bdab328668)
- 🐞 修复:overlay-zindex 门扫描面为空/文件读不到时改判 exit 2 (dfbf262512)
- 🐞 修复:基线落账补记等价映射条数,棘轮字段不再随重落丢失 (f3fc367307)
- 🐞 修复:event-closure-leak 门取材失败/文件缺失时改判 exit 2 (08298485b8)
- 🔧 工程/其他:门285 基线重落(存量存差 177→0,judged 166,裁决不适用 2 对) (c44caaf496)
- 🐞 修复:VoiceInput 3 键逐键裁决登记(RN 预留未接线腿) (47a3762e07)
- 🐞 修复:VideoPlayer 3 键逐键裁决登记(原生 Video vs 注入组件/页面标题) (2b39134193)
- 🐞 修复:NavBar 23 键逐键裁决登记(固定槽位 vs RN 泛型动作数组) (94ae780bd9)
- 🐞 修复:file-size 门取材失败/读不到文件时改判 exit 2 (2dc1efb330)
- 🐞 修复:ModelList 5 键逐键裁决登记(分组 groups vs 平铺 models+currentType) (9593eb00fe)
- 🐞 修复:ModelConfigDialog 23 键逐键裁决登记(indexa 媒体链路未接/选型拆到 ModelList) (a773fae04c)
- 🐞 修复:LoginPopUp 20 键逐键裁决登记(登录三回调 vs RN 受控弹窗+扁平资料) (b5ea3cfbf4)
- 🐞 修复:IntelligentAssistant robotImage 归矢量字形媒介裁决 (8234539080)
- 🐞 修复:BackChevron 2 键逐键裁决登记(label 端内 i18n 兜底/color 走 token) (1d228a2a68)
- 🐞 修复:dedupe 门取不到 staged 面/锁文件时改判 exit 2 (9731f496ba)
- 🐞 修复:BottomActionBar 44 键逐键裁决登记(开关聚合/图标卡入参与 RN 受控腿) (01196483c8)
- 🐞 修复:InputArea 31 键逐键裁决登记(折叠/模型/语音腿归平台载体) (07c6dfb7c6)
- 🐞 修复:Carousel banner↔items 映射登记(3 键转裁决) (172a007e10)
- 🐞 修复:UserInfoCard 扁平字段真接线 + 报销空 prop 半成品(6 键转裁决) (4a66989645)
- 🐞 修复:commit-scope 门取不到输入时改判 exit 2 未判定 (b54ee9a4a9)
- 🐞 修复:push-sync 四类折绿分支收口 —— 窗口只降文案不降退出码,祖先/HEAD/清单读数失败一律 exit 2 (344c5dd91c)
- 🐞 修复:底部淡出遮罩延伸到屏幕底 —— 胶囊下方那段悬浮间距此前无人覆盖 (cbce78a947)
- 🐞 修复:首页 AI 输入框不再被底部淡出遮罩压住 —— 补小程序已有的那一层 (ba3cec2095)
- 🐞 修复:校正 push-sync 注释的 rev-list 失败实测读数(本机 bad object exit 1,非 128) (714fda7cf5)
- 🔧 工程/其他:收编守护落档产出(5 件,凭落点账本) (b255c8ac82)
- 🐞 修复:push-sync 读数改三态 —— rev-list 失败/取不到对象不再折算成 ahead=0 假绿,5 例钉三态 (9c0824df44)
- 🐞 修复:两处 git 派生补 windowsHide —— 门52 生产面两处判红清零,消除控制台闪窗;staged 面 3 文件 0 违规 (5321db0ce9)
- 🐞 修复:git 派生调用显式接管 stdio —— 门193 三处判红清零(两枚测试文件),解除 pre-push 阻塞;两测试 14/14 通过 (b135c1b1df)
- 🐞 修复:写盘闸 HEAD 三态 —— git 取不到不再折成「新增文件」放行 (12d92ce084)
**2026-11-03**
- 🔧 工程/其他:285 judged 自检改临时夹具 —— 不再钉死真仓行号 (d472bb39bc)
- 🔧 工程/其他:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (af3c51866d)
- 📚 文档:285/289/290/291/292 语义与三条纪律入档 + 逃生变量并入 §6.3 (3ca2913348)
- 🚀 新功能/改进:门285 引入逐键 judged 桶 —— 存差=未实现+未映射+未裁决 (aaac585bd5)
- 🔧 工程/其他:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (a810aefb23)
- 🐞 修复:门290 判据纠偏 + A3 可挂账 + 修真缺陷 (d255a623ba)
- 🔧 工程/其他:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (a076d3bb7a)
- 🔧 工程/其他:账本收敛为 C 组挂账与 A/B/E 裁决,统一 3 处可改调用点并登记 LearnScreen 4 处 web 无键文案 (5c1de64915)
- 🐞 修复:证书基准拆为官网/Play 上传/Play 应用签名三值并互不校验 (9b5b3233f5)
- 🔧 工程/其他:登记 9 对跨端 props 提案(等价 21 + 平台 141 + FloatBox 整对不适用) (3d8e89c074)
- 🐞 修复:新增 B3 同义键异值判据、common.* 白名单/同字不同义裁决与唯一键去重 (3834b737e4)
- 🐞 修复:门291 P0 将 10 处 RN 硬编码文案改为 web 同源键并补齐 5 语言词包 (67e082814f)
- 🔧 工程/其他:登记 9 对跨端 props 提案(等价 21 + 平台 141 + FloatBox 整对不适用) (1df5542521)
- 🐞 修复:LoginPopUp 24→20 键 —— RN 补 visible 可选、userInfo 适配、defaultAvatar、onNicknameChange (6480532d13)
- 🐞 修复:NavBar 25→23 键 —— 小程序补 subtitle/sticky 真实现，menuIcon 接渲染分支 (7772e22277)
- 🔧 工程/其他:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (c1b9d5ac1f)
- 🐞 修复:BottomActionBar 59→56 键 —— RN 真接 placeholder/disabled,小程序真接 isLoading (fcc34bccf8)
- 🐞 修复:VideoPlayer 补齐 autoplay/poster/loading/onPlay/onPause/startPosition (9816826db5)
- 🐞 修复:ModelList 两端补齐选择/加载/动效/样式契约 (20e1c01630)
- 🐞 修复:ModelConfigDialog 对齐必填漂移 visible/config/onChange/modelType (e87ea6fa69)
- 🐞 修复:InputArea 补齐 RN 输入契约 autoFocus/onFocus/onBlur/onKeyboardHeightChange (6e2dd73d77)
- 🔧 工程/其他:摘除 ColorfulLoader 死副本并重算 ui-routes inputs —— 全仓静态/动态引用为 0,删除后经生成器重算(inputs 611→610、自述钉自洽);门105 保持绿、门285 258 键不变 (d695719bb0)
- 📚 文档:派生块按生成器重算 —— 守门/跟踪文件读数对齐现算,最近更新补齐 48540f6..HEAD (40e31c3b92)
- 🔧 工程/其他:ui-routes 派生件按 HEAD 面重生成(model-edit/apis 两枚输入补钉) (8b2af27a78)
- 🐞 修复:小程序 model-edit 接上 RN 同一份只读清单,并补派生进程 windowsHide (0f46e9a019)
- 🔧 工程/其他:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (43a0ab0c05)
- 🚀 新功能/改进:词包搬运器补键级射程(整块之外的单键缺口此前无人判) (03d72eac3c)
- 🔧 工程/其他:收编守护落档产出(5 件,凭落点账本) (a3cd0e3375)
- 🐞 修复:门285 将 ScreenStates 判为 not-applicable —— 文件级四组件族容器,非单组件对 (71a4f299c2)
**2026-11-04**
- 🔧 工程/其他:收编停留≥3分钟的未提交改动 (a8f8227ad9)
**2026-11-04**
- 🔧 工程/其他:收编停留≥3分钟的未提交改动 (dde2283d8c)
- 🐞 修复:恢复下载详情页被误删的三个展示组件,修复主干编译中断 (a7fc6138d3)
- 🐞 修复:门291 C组32条挂账清零,RN改取web真源键并摘除旧键 (0605ec255d)
- 🐞 修复:门 288 证据定位改为按符号名解析，消除加注释即报证据行漂移的误红 (842c0f0b9a)
- 🔧 工程/其他:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (4fd158208d)
- 🔧 工程/其他:收编停留≥3分钟的未提交改动 (61d4502095)
- 🐞 修复:分片腿加首片看门狗,任何失败都退回原生单流 (61bf95afe2)
**2026-11-04**
**2026-11-04**
- 🔧 工程/其他:收编停留≥3分钟的未提交改动 (decbaf9b4c)
- 🐞 修复:B 组收尾补漏（showClear 两端删除、mini robotImage 真渲染） (dcd22d3ccc)
- 🐞 修复:平台裁决清零(46→0),A组18条真实现/删除,门128两红收口;补 pnpm-lock 记账(解门101 存量红) (2cf8856fd1)
- 🐞 修复:整包下载改 8 连接分片 + 诚实的速率读数 (7242b9cc3d)
**2026-11-04**
- 🔧 工程/其他:收编停留≥3分钟的未提交改动 (6dcc3be9c8)
**2026-11-04**
- 🔧 工程/其他:收编停留≥3分钟的未提交改动 (8e04ad552e)
- 🔧 工程/其他:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (4cde28b4d4)
**2026-11-04**
- 🔧 工程/其他:收编停留≥3分钟的未提交改动 (dcd5d46c43)
- 🐞 修复:c-drive 默认即扫暂存区，无输入面不再空转报绿 (ce21ce2967)
- 📚 文档:门45 注释同步空暂存区=0 不适用 (d03d3421ab)
- 🐞 修复:c-drive 空暂存区按 A 级 check-file-size 口径 = 0 不适用（更正） (15ab31909f)
- ♻️ 重构:屏级默认档等值落具名档·carte/edu-parent 10 处 (31b1682c69)
- 🐞 修复:B 级 6 门三态化，取不到输入即 exit 2 (12c11a928f)
- 🚀 新功能/改进:跨端写盘腿 tick 落 downgrade/undetermined 两态并接告警面 (682441757b)
- 🐞 修复:登录页 welcome SVG 按 </svg> 截断,消除裸文本子节点触发的 Text 组件告警 (2892132dbf)
- 🚀 新功能/改进:新增真机热更预览通道 rn-live-preview(8809, 自检12/12) (80a4925cb6)
- 🔧 工程/其他:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (cd055b78af)
- 🐞 修复:BottomActionBar 来源面板空声明回退 (cf4c76ff1e)
- 🐞 修复:LoginPopUp/BackChevron 必选性对齐 (f11df86f5f)
- 🐞 修复:ModelConfigDialog 死变体删除 (923044485c)
- 🐞 修复:InputArea/ModelList 死腿删除 (804ee7142a)
- 🐞 修复:BottomActionBar 手工压缩入口接线与死腿删除 (a7e4a73d7a)
- 🔧 工程/其他:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (cbe4ddd32c)
- 🔧 工程/其他:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (5ffc1c5120)
- 🐞 修复:NavBar/VideoPlayer 证据换真 (2ef7755dc4)
- 🐞 修复:VoiceInput 图片死腿删除 (633b4a018a)
- 🔧 工程/其他:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (9795a8effe)
- 🐞 修复:UserInfoCard onOpenVip 真实现与死字段删除 (67afef48b0)
- 🐞 修复:LoginPopUp 协议真实现与同槽收敛 (db8e6679cb)
- 🐞 修复:capability-catalog 门取不到暂存面时改判 exit 2 未判定 (d551e17bc3)
- 🔧 工程/其他:dedupe 夹具超时放宽到 600s(规避 pnpm 并发持有夹具) (552b8cfc5d)
- 🐞 修复:底部淡出遮罩渐变段 120→90 —— 机主复看仍点名「顶部有点高」 (f989956df1)
- 🐞 修复:根治「签名不一致」—— debug 签名不再静默可得,装机前强制证书对账 (45506184a7)
- 🐞 修复:底部淡出遮罩渐变段 160→120 —— 机主点名「还是高」,同步「我的」页让位量 104→72 (2c32f411d7)
- 🐞 修复:overlay-zindex 门扫描面为空/文件读不到时改判 exit 2 (c26b9a983a)
- 🐞 修复:基线落账补记等价映射条数,棘轮字段不再随重落丢失 (beb3a3e6e9)
- 🐞 修复:event-closure-leak 门取材失败/文件缺失时改判 exit 2 (31cede2149)
- 🔧 工程/其他:门288 基线重落(存量存差 177→0,judged 166,裁决不适用 2 对) (f92c386395)
- 🐞 修复:VoiceInput 3 键逐键裁决登记(RN 预留未接线腿) (5538025fff)
- 🐞 修复:VideoPlayer 3 键逐键裁决登记(原生 Video vs 注入组件/页面标题) (a728994def)
- 🐞 修复:NavBar 23 键逐键裁决登记(固定槽位 vs RN 泛型动作数组) (d7d23a6822)
- 🐞 修复:file-size 门取材失败/读不到文件时改判 exit 2 (361b4678f8)
- 🐞 修复:ModelList 5 键逐键裁决登记(分组 groups vs 平铺 models+currentType) (362de27391)
- 🐞 修复:ModelConfigDialog 23 键逐键裁决登记(indexa 媒体链路未接/选型拆到 ModelList) (45fe8f9a40)
- 🐞 修复:LoginPopUp 20 键逐键裁决登记(登录三回调 vs RN 受控弹窗+扁平资料) (91d15877ab)
- 🐞 修复:IntelligentAssistant robotImage 归矢量字形媒介裁决 (3280b88e47)
- 🐞 修复:BackChevron 2 键逐键裁决登记(label 端内 i18n 兜底/color 走 token) (c4154d3c81)
- 🐞 修复:dedupe 门取不到 staged 面/锁文件时改判 exit 2 (137263b6ac)
- 🐞 修复:BottomActionBar 44 键逐键裁决登记(开关聚合/图标卡入参与 RN 受控腿) (0fe3ce7009)
- 🐞 修复:InputArea 31 键逐键裁决登记(折叠/模型/语音腿归平台载体) (dfd42f5393)
- 🐞 修复:Carousel banner↔items 映射登记(3 键转裁决) (d7ab5acac8)
- 🐞 修复:UserInfoCard 扁平字段真接线 + 报销空 prop 半成品(6 键转裁决) (784d8dfdbb)
- 🐞 修复:commit-scope 门取不到输入时改判 exit 2 未判定 (9ffeb094b2)
- 🐞 修复:push-sync 四类折绿分支收口 —— 窗口只降文案不降退出码,祖先/HEAD/清单读数失败一律 exit 2 (e0f8c0e451)
- 🐞 修复:底部淡出遮罩延伸到屏幕底 —— 胶囊下方那段悬浮间距此前无人覆盖 (3c2e132bf5)
**2026-11-04**
- 🔧 工程/其他:收编停留≥3分钟的未提交改动 (43f56aa425)
- 🐞 修复:首页 AI 输入框不再被底部淡出遮罩压住 —— 补小程序已有的那一层 (12b69b48aa)
- 🐞 修复:校正 push-sync 注释的 rev-list 失败实测读数(本机 bad object exit 1,非 128) (15915596b8)
**2026-11-04**
- 🔧 工程/其他:收编守护落档产出(5 件,凭落点账本) (cd17b5992d)
- 🐞 修复:push-sync 读数改三态 —— rev-list 失败/取不到对象不再折算成 ahead=0 假绿,5 例钉三态 (03f58d1a29)
- 🐞 修复:两处 git 派生补 windowsHide —— 门52 生产面两处判红清零,消除控制台闪窗;staged 面 3 文件 0 违规 (3f5a439b05)
- 🐞 修复:git 派生调用显式接管 stdio —— 门193 三处判红清零(两枚测试文件),解除 pre-push 阻塞;两测试 14/14 通过 (38f420f6cb)
- 🐞 修复:写盘闸 HEAD 三态 —— git 取不到不再折成「新增文件」放行 (860fc3e087)
**2026-11-03**
- 🔧 工程/其他:288 judged 自检改临时夹具 —— 不再钉死真仓行号 (414db88c6b)
- 🔧 工程/其他:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (6f77b0a629)
- 📚 文档:288/289/290/291/292 语义与三条纪律入档 + 逃生变量并入 §6.3 (53cbd16b34)
- 🚀 新功能/改进:门288 引入逐键 judged 桶 —— 存差=未实现+未映射+未裁决 (0013f61827)
- 🔧 工程/其他:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (1759854c49)
- 🐞 修复:门290 判据纠偏 + A3 可挂账 + 修真缺陷 (9e6d7fedeb)
- 🔧 工程/其他:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (eb67922536)
- 🔧 工程/其他:账本收敛为 C 组挂账与 A/B/E 裁决,统一 3 处可改调用点并登记 LearnScreen 4 处 web 无键文案 (7337b633c3)
- 🐞 修复:证书基准拆为官网/Play 上传/Play 应用签名三值并互不校验 (c7274b7f66)
- 🔧 工程/其他:登记 9 对跨端 props 提案(等价 21 + 平台 141 + FloatBox 整对不适用) (582088f7cd)
- 🐞 修复:新增 B3 同义键异值判据、common.* 白名单/同字不同义裁决与唯一键去重 (fcb2cc8570)
- 🐞 修复:门291 P0 将 10 处 RN 硬编码文案改为 web 同源键并补齐 5 语言词包 (dc74afd1bb)
- 🔧 工程/其他:登记 9 对跨端 props 提案(等价 21 + 平台 141 + FloatBox 整对不适用) (8c63a3b963)
- 🐞 修复:LoginPopUp 24→20 键 —— RN 补 visible 可选、userInfo 适配、defaultAvatar、onNicknameChange (c5b7f31ae9)
- 🐞 修复:NavBar 25→23 键 —— 小程序补 subtitle/sticky 真实现，menuIcon 接渲染分支 (db8b3c8c06)
- 🔧 工程/其他:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (ffbc1e83bd)
- 🐞 修复:BottomActionBar 59→56 键 —— RN 真接 placeholder/disabled,小程序真接 isLoading (3356abdcd5)
- 🐞 修复:VideoPlayer 补齐 autoplay/poster/loading/onPlay/onPause/startPosition (4c44c59a30)
- 🐞 修复:ModelList 两端补齐选择/加载/动效/样式契约 (29f6d7e7d1)
- 🐞 修复:ModelConfigDialog 对齐必填漂移 visible/config/onChange/modelType (46b2a8cf4a)
- 🐞 修复:InputArea 补齐 RN 输入契约 autoFocus/onFocus/onBlur/onKeyboardHeightChange (60fa2ebbea)
- 🔧 工程/其他:摘除 ColorfulLoader 死副本并重算 ui-routes inputs —— 全仓静态/动态引用为 0,删除后经生成器重算(inputs 611→610、自述钉自洽);门105 保持绿、门288 258 键不变 (72eea3c5d5)
- 📚 文档:派生块按生成器重算 —— 守门/跟踪文件读数对齐现算,最近更新补齐 48540f6..HEAD (4576ffade7)
**2026-11-03**
- 🔧 工程/其他:ui-routes 派生件按 HEAD 面重生成(model-edit/apis 两枚输入补钉) (c6c90050fb)
- 🐞 修复:小程序 model-edit 接上 RN 同一份只读清单,并补派生进程 windowsHide (5133f2817d)
- 🔧 工程/其他:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (7755f73e27)
- 🚀 新功能/改进:词包搬运器补键级射程(整块之外的单键缺口此前无人判) (0f42f52703)
- 🔧 工程/其他:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (29e3c26cc0)
- 🔧 工程/其他:收编守护落档产出(5 件,凭落点账本) (335d63c7e8)
- 🐞 修复:门288 将 ScreenStates 判为 not-applicable —— 文件级四组件族容器,非单组件对 (ec90d7b58b)
- 🚀 新功能/改进:小程序词包整块缺口首次有器物并挂上自动链 (3c19ced5cd)
- 🔧 工程/其他:派生产物按 HEAD 面重生成并落地(检出档)—— 补 G5 在工作树滞后那一格的重跑出路 (57c6228ab4)
- 🐞 修复:SectionHeader 两端同源收口 —— 小程序适配层真接 leading/style/titleStyle/subtitleStyle/accessibilityLabel(容器与文字样式覆盖、ariaLabel 落地),非空 prop;门288 270→265,该对归零;intentional-delete: 该对五键已由实现消除 (b80032e3b9)
- 🐞 修复:IntelligentAssistant 两端同源收口 —— RN 补 isLoggedIn(登录态文案+隐藏充值,默认 true 零观感变化)与 5 语 loginRequired,tokenQuantity↔tokenBalance 入映射表;门288 273→270;intentional-delete: 该对 tokenQuantity/tokenBalance/isLoggedIn 三键已由映射+实现消除 (9436bdf042)
**2026-11-03**
- 🚀 新功能/改进:支付出口移入导航层 + Follow/VideoPlayer 语义登记 + 九屏端口自证测试 (830eb717a3)
- 🚀 新功能/改进:校正 AigcList 薄壳对共享屏承接行号的引用 (b569c10672)
- 🔧 工程/其他:重算四语 README 数字块并刷新最近更新 (e647bf8ab5)
- ♻️ 重构:间距 rpx 字面量等值落档（CSS var / taroSpacing，weapp 像素零变化） (0ea20bbe01)
- 🔧 工程/其他:扫码凭证用例确定化 2500ms 轮询触发,消除首轮计时抖动 (ad65d2b05f)
- 🐞 修复:修掉 runner 两处撞号并重封根护栏 (73e64fd2e2)
- ♻️ 重构:常量/条件字面量与手工收尾字号落档 (89831e5034)
- 🚀 新功能/改进:Vip 支付链成功落 PayResult(replace),失败/取消留守;等级横幅入口走 VipUpgrade (2c37223cfd)
- ♻️ 重构:发布/巡检脚本接入 mobile-download-leg 单源并补一致性断言 (5a9fcadb2e)
- 🚀 新功能/改进:ConversationImport 选文件取消/失败经 onToast 明确反馈 (f778f2a752)
- ♻️ 重构:字号任意值等值落具名档（className 字面量批，零视觉变化） (0fdda86798)
- 🚀 新功能/改进:AigcList 切薄壳并给 AigcPublish 接真实上传进度 (ea9e0f60f7)
- 🚀 新功能/改进:补 ExamDetail/VipUpgrade 路由并收口 Exam 两屏推送 (a514deeecc)
- 🔧 工程/其他:refactor(web)!: 容器 hover 浮起回归 --lift-* 单源并立守门 287 防回潮 (13a919a708)
- ♻️ 重构:发布/巡检脚本接入 mobile-download-leg 单源并补一致性断言 (4078b4afcd)
- 🐞 修复:给 @ihui/rn-app 替身补出 AgentReview 列表/详情两屏与 props 捕获出口(与真身 154/278 行同步) (7ffcf16a68)
- 🐞 修复:补录 ai-service memory.py 六个 MEMORY_* 兜底码到错误目录并补齐五语词包 (575a1bd2b7)
- git/提交链: `check-commit-scope-consistency.mjs` `check-push-sync.mjs` `check-head-typecheck.mjs` `check-typecheck.mjs` `check-git-read-timeout.mjs` `check-spawn-stdio.mjs` `check-registry-worktree-superset.mjs` `check-no-nested-git.mjs` `check-commit-loss-guard.mjs` `check-merge-addition-loss.mjs` `check-merge-deletion-resurrection.mjs` `check-staged-resurrection.mjs`(pre-commit 复活闸,与 `safe-commit.mjs` Step 3b-2 同一判据 `lib/intentional-file-deletion.mjs#judgeResurrection`;已登记删除件出现在索引新增面 ⇒ exit 1,台账判不开 ⇒ 只报不拦) `check-single-branch.mjs` `check-stale-stashes.mjs` `check-bypass-landing-scope.mjs` `check-live-doc-references.mjs` `check-mjs-syntax.mjs`(纯语法 compile 不 evaluate;判红臂 = 索引新引入不可解析;镜像 `check-mjs-syntax.test.mjs`) `check-format-changed.mjs` `check-husky-hook-form.mjs`(H1 钩子必须是 sh 薄壳;H2 包装与 node 正文同面在位;正文即 `post-commit-hook.js` 一族;镜像 `check-husky-hook-form.test.mjs`) `check-no-nested-git-sites-durability.mjs`(门 208 豁免台账耐久性)
- 发布线 / 安卓对外下载腿(2026-11-03 立,CI 档,runner id 以现值为准): `check-mobile-download-leg.mjs`(三问各允许「未判定」而不猜绿:① 配置里的下载 URL 跟随 302 后必须 200/206;② `Content-Length` 须 ≥ `--min-bytes`(默认 50MiB);③ 手里的 APK 证书 SHA-256 须等于正式基准。**退出码 2 = skipped/未判定,不是绿** —— 判据读的是公网与签名,提交者结构上改不了那一格,故按 §12e 不挂提交门;取证 `--self-test`,口径见门体头注) · 配套国内腿运行态门 `check-mobile-download-leg-cn.mjs`(Gitee 国内腿,2026-11-04 立:两条腿 `Range: bytes=0-0` 真探,Content-Range 总长必须同为够大的同一枚包;任一腿量不到 ⇒ exit 2 未判定,绝不折算成绿)
- UI/样式: `check-miniapp-taro-design-tokens.mjs` `check-adapter-style-parity.mjs` `check-percent-clamp-single-source.mjs` `check-line-split-parity.mjs` `check-input-focus-feedback.mjs` `check-button-height.mjs` `check-glyph-arrow-icon.mjs` `check-no-divider.mjs` `check-no-mask-image.mjs` `check-no-native-dialog.mjs` `check-no-emoji-icons.mjs` `check-radius-single-source.mjs` `check-radius-role-conformance.mjs` `check-rounded-full.mjs` `check-statusbar-single-source.mjs` `check-cross-end-ui-parity.mjs` `check-cross-end-screen-coverage.mjs` `check-miniapp-tokens-sync.mjs` `check-miniapp-taro-style-parity.mjs` `check-cross-end-tokens.mjs` `check-miniapp-css-landing.mjs` check-miniapp-shell-form.mjs(门 299:小程序「薄壳 vs 复制」实现形态,新增复制页即红;跳过 HUSKY_SKIP_MINIAPP_SHELL_FORM) check-web-mp-route-carriers.mjs(门 301:web↔小程序共享屏承载路由对账;跳过 HUSKY_SKIP_WEB_MP_ROUTE_CARRIERS)
- API/后端/DB: `check-credential-leak-in-message.mjs` `check-egress-ip-drift.mjs` `check-credential-presence-bypass.mjs` `check-principal-consumed.mjs` `check-public-exposure-list.mjs` `check-public-admin-default.mjs`(G-875,2026-10-24 立:仓内不得再出现可登录的公开 admin 默认口令;运行面口令一律环境变量注入,历史散列由失效迁移统一作废) `check-capability-field-not-client-supplied.mjs` `check-authorization-column-isolation.mjs` `check-migration-immutable.mjs` `check-db-blind-updatedat-set.mjs` `check-sequence-lag.mjs` `check-error-code-not-text-matching.mjs` `check-error-attribution-single-source.mjs` `check-error-message-bounded.mjs` `check-inbound-schema-strict.mjs` `check-nested-additional-properties.mjs` `check-enum-default-widening.mjs` `check-enum-fallback-terminal.mjs` `check-txn-cancel-boundary.mjs` `check-dockerfile-copy-paths.mjs` `check-edu-arrears-single-source.mjs` `check-sse-frame-watermark.mjs` `check-python-import-landed.mjs` `check-python-import-resolvable.mjs` `check-mode-permission-matrix.mjs` `check-subagent-permission-inherited.mjs` `check-csrf-exemption-shape.mjs` `check-batch-write-count-honesty.mjs` `check-prod-bundle-shadow.mjs` `check-env-drift.mjs` check-api-endpoint-delta.mjs(门 300:三端 API 调用差集台账,棘轮只拦新增;跳过 HUSKY_SKIP_API_ENDPOINT_DELTA) check-drizzle-journal-sync.mjs(迁移链「文件↔journal」双向对账,git-guardian 巡检轮派发)
- UI/样式: `check-miniapp-taro-design-tokens.mjs` `check-adapter-style-parity.mjs` `check-percent-clamp-single-source.mjs` `check-line-split-parity.mjs` `check-input-focus-feedback.mjs` `check-button-height.mjs` `check-glyph-arrow-icon.mjs` `check-no-divider.mjs` `check-no-mask-image.mjs` `check-no-native-dialog.mjs` `check-no-emoji-icons.mjs` `check-radius-single-source.mjs` `check-radius-role-conformance.mjs` `check-rounded-full.mjs` `check-statusbar-single-source.mjs` `check-cross-end-ui-parity.mjs` `check-cross-end-screen-coverage.mjs` `check-miniapp-tokens-sync.mjs` `check-miniapp-taro-style-parity.mjs` `check-cross-end-tokens.mjs` `check-miniapp-css-landing.mjs` `cross-end-ui-parity-debt.mjs`(2026-11-06 装车的只读欠债账,不进提交链 §12e;轴一 miniapp↔RN 四维 + 轴二 web↔RN 五维,判据全消费门 128 --json 自己零复算;派发层 = git-guardian 的 auditCrossEndDebtLedger(),main 健康轮次 + daemon tick 双挂点共用一枚节流戳,60 分钟、先写 attemptAt 后派生;rc=0/1/2 三态:rc=1 族涨只逐族写日志**不到人**(§5e-1:基线 2026-10-22 的涨项非本次引入,能做的动作是按族派单收口;提前开 IHUI_CROSS_END_DEBT_MAIL=1),rc=2 或结论取不到落未判定不记绿;镜像 scripts/tests/cross-end-debt-dispatch.test.mjs 11 例 import __test__ 零复算 §22c)
