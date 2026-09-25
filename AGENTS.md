<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

- **prod-bundle 影子副本对账**:`scripts/check-prod-bundle-shadow.mjs`(2026-09-24 立,挂在 `pnpm check:all` 与 `node scripts/check-prod-bundle-shadow.mjs`)—— §5e 说"落进 `deploy/prod-bundle/` 的运维脚本必须同时落一份入库源,否则等于写进盲区",但这句话过去**只有散文没有尺子**。本门登记「入库源 ↔ 生产实际执行的那份」逐字节必须等值,三条判据:S1 入库源必须真被 git 跟踪(不被跟踪就没有对账对象)、S2 运行副本必须真被忽略(否则登记表过期,同样判红)、S3 两侧 sha1 全等,不等即红并给出差异行数。任一侧取不到 ⇒ **exit 2 显式"无法判定"**,绝不记绿。首跑抓到并入库的是数据库备份那一对:`deploy/prod-bundle/pg-backup{,-scheduler}.ps1`(整目录被 `.gitignore` 忽略、全仓零入库源,而它每天 03:00 产出 94MB 生产库 dump)。本门**刻意没有改成转发壳**——把 runner 换成转发壳后重启服务,`pg_dump` 出现 3.5 分钟零输出挂死(旧 runner 同库同日 34 秒跑完),在解释清之前不动生产备份;因此两侧都是全文,靠本门钉住等值。自检 `--self-test`(5 例,含"入库源被摘线必红"与"缺一侧必计无法判定")。紧急跳过 `HUSKY_SKIP_PROD_BUNDLE_SHADOW=1`。

# AGENTS.md — IHUI-AI 项目 Agent 指南

> 作用域:`D:/IHUI-AI` 仓库根目录及所有子目录（2026-09-12 修正:仓库早已从 `G:` 迁到 `D:`，旧盘符路径已全部改为从脚本自身位置推导）。
> 历史案例归档见 `.ihui-agent/archive/AGENTS_history.md`。
> 本文件为精简版(2026-07-25 重构,原 783 行 → ≤400 行),保留所有强制规则核心条款。

---

## 1. 任务计划文档规则(强制)

- 项目**唯一**任务计划文档是 `PROJECT_PLAN.md`(根目录),所有任务计划、进度更新、待办清单、状态变更**只写**此文件,**不得**在 `.ihui-agent/`、`docs/`、根目录或其他位置新建计划/TODO/ROADMAP 文件。
- 完成任务后 `[ ]` → `[x] ✅(日期)`;新增任务追加到对应优先级(P0/P1/P2)末尾。commit message:`feat`/`fix`/`docs`/`chore`/`test`/`refactor` 前缀。
- **任务认领(2026-09-23 立)**:agent 开始任务前,在对应 `- [ ]` 后追加 `（进行中）` 标记(全角括号),例 `- [ ]（进行中）O20d 守门...`;完成后按上条改 `[x] ✅(日期)` 并删除 `（进行中）`。扫描 `PROJECT_PLAN.md` 可区分三态:无人认领(`- [ ]` 无标记)/ 进行中(`- [ ]（进行中）`)/ 已完成(`- [x]`)。派单前先扫进行中项,避免重复认领。扫描工具:`node scripts/check-task-claims.mjs`。

### 归档机制

- 已完成任务条目(`### XXX(已完成 ✅ ...)` 标题)**禁止直接删除**,必须两步走:① 把完整任务条目(标题 + 正文)移动到 `.ihui-agent/archive/PROJECT_PLAN_YYYY-MM-DD.md`;② 在 `PROJECT_PLAN.md` 原位置留 HTML 注释占位:`<!-- 已归档(YYYY-MM-DD):XXX 任务,完整内容在 .ihui-agent/archive/PROJECT_PLAN_*.md -->`。
- **自动归档**:`scripts/archive-completed-tasks.mjs` 扫描完成 ≥7 天的条目,post-commit 钩子自动 `--auto-commit`,归档 commit 设 `IHUI_ARCHIVE_COMMIT=1` 防递归。
- **手动触发**:`pnpm archive` / `--all`(全部)/ `--days 3`(自定义)/ `--dry-run`(预览);跳过用 `HUSKY_SKIP_ARCHIVE=1 git commit`。
- **守门**:`scripts/check-project-plan-archive.mjs` + pre-commit 第 13c 项。历史案例见 `.ihui-agent/archive/AGENTS_history.md`。

### 唯一例外

- `/goal` 模式:`.ihui-agent/goal-runtime/STATE.md` + `loop-run-log.md`(临时,目标结束后删除);skills:`.ihui-agent/skills/SKILL.md`(AI 工具配置,非计划文档)。

---

## 2. 项目概览

IHUI-AI 是全栈 AI 平台(TS Monorepo + pnpm workspace + Turborepo),8 端清单:

- `apps/api`(Fastify 5 + Drizzle ORM 0.38 + PostgreSQL)
- `apps/web`(Next.js 16.2.12 + React 19 + Tailwind 4 + shadcn/ui)
- `apps/ai-service`(FastAPI + LangGraph + LiteLLM + MCP)
- `apps/miniapp-taro`(Taro 4 + React)
- `apps/desktop` / `apps/extension` / `apps/mobile-rn` / `apps/cli`(各端独立)
- `packages/`(database / auth / types / ui / config / eslint-config / tsconfig)

---

## 3. 代码风格

- 做减法,最小化代码,零冗余。复用现有代码和模式,不创建文档文件(除非明确要求),不加 copyright/license header。

### TypeScript 类型零技术债(强制)

- **尽最大程度禁用 `any`**,优先用 `unknown` + 类型守卫 / `as const` / 泛型 / 条件类型 / 工具类型(`Pick`/`Omit`/`Record`/`Partial`/`Required`/`ReturnType`/`Parameters`)/ 精确接口替代,禁止把 `any` 当"类型兜底"逃避设计。
- **深度分析 TS 用法**:函数签名(入参/出参/泛型约束)、对象字段、API 响应、props、state 必须显式标注精确类型;能由 `tsc` 推断且可读性良好的局部变量可省略,但禁止"省略 = 不写类型"扩散到公共 API。
- **必须用 `any` 的例外(三选一)**:① 第三方库无 `@types` 或类型声明缺失;② 泛型推断失败且无法用 `unknown` + 守卫替代;③ 跨包循环依赖无法用类型导入断言解决。**必须**附行内注释 `// FIXME(any): 原因 + 移除计划 + 截止版本`,后续 PR 必须清理。
- **不留技术债**:新代码 `tsc --noEmit` 必须 0 错误,禁止"先 any 后修"占位;重构遗留 `any` 必须替换为精确类型,**禁止**复制粘贴扩散 `any`;PR 引入新的 `any` 必须在 PR 描述说明例外依据。
- **守门**(分层渐进):
  - **过渡期(当前生效)**:`@typescript-eslint/no-explicit-any: error`(packages/eslint-config/index.js,syntax-level 不需 type info,已生效)。lint-staged 对 staged 源码文件触发阻塞,新代码引入 `any` 会在 `pnpm lint` 报错。
  - **目标态(已评估,推迟启用)**:`@typescript-eslint/no-unsafe-assignment` / `no-unsafe-member-access` / `no-unsafe-call` / `no-unsafe-return` / `no-unsafe-argument` 五条规则设为 `error`。**2026-07-28 评估结论**:实测启用 `recommendedTypeChecked` + `projectService` 后,(a) 性能不可接受 — cli 包(最小)lint 时间 2.7s -> 51.9s(慢 19 倍),web/api 包预计 30s -> 600s+;(b) 历史错误多 — cli 包已报 30+ 处(`require-await` / `no-unsafe-assignment` / `no-base-to-string` / `restrict-template-expressions` / `no-unnecessary-type-assertion`),全量预计 300+ 处;(c) 配置陷阱 — `eslint.config.js` 不被 tsconfig include 需 `allowDefaultProject`,JS 文件需单独豁免 `no-unsafe-*`。**启用前置条件(全部满足才可启用)**:1. lint 性能优化方案落地(eslint cache 持久化 / 仅 staged 文件 typed-lint / CI 才跑全量 typed-lint);2. 历史类型错误清零(`require-await` 等非 unsafe 错误先修);3. `allowDefaultProject` 配置就绪。
  - **测试文件豁免**:`**/*.test.ts` / `**/*.spec.ts` / `**/tests/**` / `**/test/**` / `**/e2e/**` 路径下的 mock/stub 代码允许 `any`(mock 类型断言必需),启用 typed-linting 后通过 `files` overrides 关闭上述规则。
  - CI `pnpm typecheck` 全绿方可合并。

### 共享层优先(强制)

- **写新代码前必须先查共享层**,确认是否已有现成实现。禁止在端内(apps/*)重新实现 `packages/` 已提供的功能。
- **检查清单(按顺序)**:
  1. **hooks**: `packages/shared/src/hooks/` — 基础 hook(clipboard/debounce/countdown/form/mounted/pagination 等)和业务 hook(auth/chat/agents/articles/agent-runtime/confirm-dialog 等)共 16 个。各端 `hooks/` 目录应只做 re-export wrapper + 平台 adapter,不得独立实现。
  2. **utils**: `packages/shared/src/utils/` — 工具函数(date-utils/dangerous-command-detector/format/file-helpers/error-messages/jwt-utils/ai-skill-variables 等)。各端 `lib/` 目录应只做 re-export wrapper。
  3. **types**: `packages/types/src/` — 所有跨端类型(ChatMessage/MessageInputFile/WorkspacePermissionMode/User/ApiRequest 等)。禁止在端内重新声明同名类型。
  4. **api-client**: `packages/api-client/src/` — 所有 API 调用。禁止在端内直接用 `fetch`/`axios`/`Taro.request` 调后端,必须走 `@ihui/api-client`。端内可保留 re-export + 平台 adapter(如 AsyncStorage 持久化)。
  5. **stores**: `packages/shared/src/stores/` — 共享 store 工厂(createAuthStore/createThemeStore)。各端 store 应调工厂 + 注入平台 transport,不得重新定义 state shape。
  6. **constants**: `packages/shared/src/constants/` — 跨端常量(storage key/URL/locale key 等)。禁止在端内硬编码同名常量。
- **如果共享层没有**:
  - 评估是否跨端可用 → 如果是,先提取到 `packages/shared/` 再在端内 import,不得直接在端内写。
  - 如果确认平台特有(依赖 DOM/RN API/Taro API)→ 可在端内实现,但必须在文件头注释说明 `// 平台特有:依赖 [DOM/RN/Taro] API,不适合共享`。
- **工厂模式优先**:跨端 hook/util 用工厂函数 + 依赖注入(参考 `createUseClipboard` / `createAuthStore`),各端传入平台 adapter。不得用 `if (Platform.OS === 'web')` 条件分支在共享层处理平台差异。
- **守门**:PR review 时检查是否有端内文件重新实现了共享层已有功能。发现重复 → 要求改为 import 共享层。

---

## 4. 前端 UI 约束

- compact 紧凑、elegant 优雅。hover 用 subtle 颜色变化,**不要蓝色发光边框**。复用 `packages/ui-react` 的 Card/Button/Input/Dialog。每个页面 < 250 行。时间用 `Intl.DateTimeFormat`,头像用 initials。状态徽章:draft 灰 / published 绿。积分正数绿色,负数红色。

### 品牌 CTA / 主按钮色同源(强制,2026-09-24 收口)

- **唯一写法(2026-09-24 改档)**:主按钮、选中胶囊、悬浮加号这类"品牌实底 + 其上文字",RN/共享包写 `brand.cta`(底)+ `brand.ctaForeground`(文字)**成对**;CSS/类名侧用 `--color-cta` + `--color-cta-foreground`(小程序 `CategoryBar`/FAB 同值)。**这一档明暗同值**(`#4A7A96` / `#FFFFFF`),刻意不随主题反转 —— 取值 = `--color-brand-accent-deep` 的亮档(2026-09-14 用户定稿的全项目统一强调色),不引入新色相;白字对比 4.65:1、亮页上 4.27:1、暗页上 3.34:1(≥3:1 过 WCAG 1.4.11)。对账由「跨端色值同源对账」守门负责(编号以 `scripts/guardian-runner.mjs` 现值为准,勿照抄文档)。
- **为什么不再是 `brand.DEFAULT`**:DEFAULT 浅色=纯黑、深色=纯白,大色块在两个主题里都是与页面相反的那一极,用户实拍反馈"浅色一大片黑 / 深色一大片白"。而**不能直接改 `--color-primary`** —— 它在 web 端兼任墨色(`text-primary` 1803 处),改它等于给全站正文染色。所以新增一档而不是挪旧档;`brand.DEFAULT` / `--color-primary` 保留原义(墨色 + 描边 + 文字色)。
- ~~**唯一写法(2026-09-24 已废)**:主按钮/选中胶囊用 `brand.DEFAULT` + `brand.foreground`,CSS 侧 `--color-primary` + `--color-primary-foreground`。~~ 该行描述的正是被本票替换掉的旧档:DEFAULT 亮=纯黑 / 暗=纯白,大色块与页面反极。**现存唯一写法见本节第一条**(`brand.cta` / `--color-cta`)。保留本行仅为让早期条目里的 `brand.DEFAULT` 措辞能被追溯到已废。
- 真要新增品牌档:先在 `tokens.css` 落一个 CSS 变量,再到同源对账门的映射表登记依据;确属 RN 专属(如 `brand.dark` 品牌绿)才能进 `RN_ONLY_BRAND_KEYS` 并写明理由 —— 豁免项若已不存在同样算红(防清单腐烂)。
- 悬空引用由该门的"品牌键"判据直接拦(编译不一定红,运行时是 `undefined` 颜色)。并行会话的暂存区里若还残留 `tokens.brand.ctaFill/ctaText`,改法只有一行:`ctaFill` → `cta`、`ctaText` → `ctaForeground`(2026-09-24 改档;此前该行的指向是 `DEFAULT`/`foreground`,已随 CTA 独立成档而更新)。
- **禁止端内自立 CTA 档**:`brand.ctaFill` / `ctaText` 这类"浅色等于 web、深色另取一档"的**混血**键不得再加回 —— 当年删它不是因为"不许有 CTA 档",而是因为**它在端里自立、且两档取值互不相同**(那才是"手机上改了 web 没改"的成因)。2026-09-24 的 `--color-cta` 走的是相反路径:先落 `tokens.css` 源头、明暗同值、再进同源对账门的映射表,所以它合法而旧键仍属禁止。要调主按钮观感就改 `--color-cta` **一处**(它不分 `.dark`,两态同时动);不得在某一端单独覆盖。
- **成对即合规,不得再当债务**:主 CTA 的唯一写法是 `brand.cta` 实底 + `brand.ctaForeground` 文字(旧档 `brand.DEFAULT` + `brand.foreground` 已废,见上),所以这套配对**必须**被所有前景/容器对账判据认作合法 —— 按规矩写就红的门只有一个结局:逼人 `--no-verify`,连带废掉全部守门。拦的是**没有配对前景**的实底卡片与**跨档错配**(底取 `brand.cta`、字却取 `text.primary`/`surface.light` —— 后者在深色档案下压 #4A7A96 只有 3.25:1,掉出 AA)。守门 83 的 R1_BG 已同时认 `brand.DEFAULT|brand.cta`,就是为了"判据必须覆盖门自己产出的形态"。
- **禁止端内自立 CTA 档**:`brand.ctaFill` / `ctaText` 这类"浅色等于 web、深色另取一档"的混血键已全部删除,**不得再加回**。要调暗色主按钮的观感(例如觉得纯白刺眼),改 `tokens.css` 的 `.dark --color-primary` **一处**,web / 小程序 / RN 同时动;不得在某一端单独覆盖 —— 那正是"手机上改了 web 没改"的成因。

> ⚠️ 本行已于 2026-09-24 被上面「禁止端内自立 CTA 档」新条目就地改写取代;保留原文只为不丢行,勿照它执行。

- **成对即合规,不得再当债务**(同日补):上面这条是主 CTA 的唯一写法,所以深色档案下"brand.DEFAULT 实底 + brand.foreground 文字"**必须**被所有前景/容器对账判据认作合法 —— 按规矩写就红的门只有一个结局:逼人 `--no-verify`,连带废掉全部守门。拦的是**没有配对前景**的白卡片与**跨档错配**(底取 brand、字取 `text.primary`/`surface.light`)。

> ⚠️ 本行已于 2026-09-24 被上面「成对即合规」新条目就地改写取代;保留原文只为不丢行,勿照它执行。

- **RN 侧 `dark:` 类必须与 App 主题同源才允许依赖**(强制):共享 preset 是 `darkMode: 'class'`,`dark:*` 工具类读 NativeWind 自己的 colorScheme store。`apps/mobile-rn/src/theme/color-scheme-sync.ts` + `ThemeProvider` 负责把 App 解析出的主题(light/dark/system→系统)落进该 store —— 缺这一步,`dark:` 只跟系统外观,与 App 内主题开关长期分裂(而前景/容器对账门把"同行有 `dark:` 变体"记为已配对,不同步时那些配对只是纸面正确)。**新增深色取用二选一**:走 `tokens.*`(模块级单例,重载 JS 生效,共享包默认),或走 `dark:` 变体(依赖上述同步);不得混用两套、更不得在端内自造第三个色源。回归:`apps/mobile-rn/tests/theme-colorscheme-sync.test.ts`。

- 真要新增品牌档:先在 `tokens.css` 落一个 CSS 变量,再到守门 90 的映射表登记依据;确属 RN 专属(如 `brand.dark` 品牌绿)才能进 `RN_ONLY_BRAND_KEYS` 并写明理由 —— 豁免项若已不存在同样算红(防清单腐烂)。
- 悬空引用由 R3 直接拦(编译不一定红,运行时是 `undefined` 颜色)。并行会话的暂存区里若还残留 `tokens.brand.ctaFill/ctaText`,改法只有一行:`ctaFill` → `DEFAULT`、`ctaText` → `foreground`。

### 圆角单一源头(强制,2026-09-23 全端收口)

- **唯一真相源**:`packages/design-tokens/src/radius.js` 的 `RADIUS_STEPS` = `xs 2 / sm 4 / md 6 / lg 8 / xl 12 / 2xl 16`(px;`DEFAULT`=8 对齐 web `--radius: 0.5rem`)。改档位只改这一处。`tailwind-preset.js` 必须写 `borderRadius: RADIUS_REM`,`tokens.css` / `app.css` 的 `--radius-*` 必须与之逐档同值。
- **各端取用形态(不得自创写法)**:

  | 场景                                         | 唯一写法                                                                      |
  | -------------------------------------------- | ----------------------------------------------------------------------------- |
  | web / ui-react / extension(Tailwind v4 类名) | `rounded-xs` ~ `rounded-2xl`;CSS 里 `var(--radius-<step>)`                    |
  | miniapp-taro / mobile-rn(NativeWind v3 类名) | 同上,**禁止** `rounded-[24rpx]` 这类任意值                                    |
  | RN StyleSheet / 任意内联 style               | `borderRadius: rnRadius.lg`(`import { rnRadius } from '@ihui/design-tokens'`) |
  | `.css/.scss/.html` 任何端                    | `border-radius: var(--radius-lg)`,禁止 px/rpx 字面量                          |

- **类名语义按 web 对齐(修文档漂移)**:v3 preset 曾把 `rounded-sm` 定成 2px、web v4 是 4px,同名不同值即"手机上圆角和全局不一致"的根因;现 `sm=4px`,2px 由 **`rounded-xs`** 承载。裸 `rounded` 全端统一 8px(web 现实)。旧条目里"`rounded-sm`(2px)"作废。
- **禁止绕档**:每文件自定 `const *_RADIUS = <数字>`(含 `BAR_RX` 这类**名字不带 RADIUS** 的圆角常量)、用 `rpx()` 算圆角、`rounded-[任意值]`、StyleSheet 里写数字字面量、**以及写字符串形态 `borderRadius: '8px'` / `"6px 6px 0 0"`**(字符串曾是守门盲区,2026-09-23 对抗排查补上;多值串须拆成四个角属性引用档位)。
- **SVG 圆角同样受管(B5)**:`rx` / `ry` 会产生圆角,JSX 内联 SVG 必须写 `rx={rnRadius.xs}`;**静态 `.svg` 资产**没有 JS 通道,取值须等于档位值(偏档就近吸附、等距取小),确属形状需要则加 `<!-- radius-exempt: 原因 -->`。
- **生成式 HTML/CSS 字符串**(cli 分享页、`packages/shared/src/design/design-templates.ts`、扩展 content script、api 的 `swagger-theme.ts` 等拼 CSS 文本处):**不得写死数字**,用同表插值 `border-radius: ${RADIUS_CSS_PX.md}`(`import { RADIUS_CSS_PX } from '@ihui/design-tokens'`),不新增第二份真相。
- **真圆/胶囊豁免**:头像 / 装饰点 / 红点 / 进度环 / Switch 拇指 / 半高胶囊输入框**不得方档化把形状改坏**。优先 `size / 2` 表达式;确需保留数值必须在同行或紧邻上行写 `radius-exempt: <一句话原因>`(JS/TSX 用 `//`,CSS 用 `/* */`,静态 .svg 用 `<!-- -->`),不得静默写死。
- **守门**:`scripts/check-radius-single-source.mjs`(guardian 第 **77** 项,blocking)三判据 —— A 档位表四处对账(改一处忘改另一处即红)、B 端内取用必须引用档位(B1 数值与字符串形态 / B2 本地常量 / B3 CSS 字面量 / B4 任意值类 / B5 SVG rx-ry / **B6 引用 `rnRadius`、`RADIUS_CSS_PX` 却没在本文件 import** —— 本门判 HEAD 而 `pnpm typecheck` 只跑 worktree,悬空标识符属于"两边都不红"那一类)、C 覆盖面对账(含圆角的跟踪文件要么落在 SCAN_DIRS,要么在 `OUT_OF_SCOPE` 写明为什么不适用)。**B 的棘轮锚点是「该文件 HEAD 版本自身的违规数」**,不是手工清单 —— 只拦"这次改动把绕档加回来了",不拦仓库既有债。2026-09-24 换锚的起因:并行会话的索引层重建把 309 个路径整文件回写成迁移前的旧基线(**HEAD 积累 1179 处**),静态清单对此完全绿灯;同时全量审计改判 **HEAD blob 而非工作树**,因为滞后的旧草稿会被按磁盘读误记成本仓债务(一道与真实改动无关的红门只会逼人 `--no-verify`,连带废掉全部守门)。`scripts/radius-single-source-baseline.json` 降级为人工兜底,**现须为空**(镜像测试钉死)。判据**不锚定行首**,故 `width:16px; border-radius:50%` 同行多声明、TS 里生成的 CSS 一样可见。按文件自验:`--files <a> <b>`;紧急跳过 `HUSKY_SKIP_RADIUS_GUARD=1`;自检 `--self-test`(49 例,含真实表端到端对账、静态/内联 SVG 两种语义、NaN 防回归、HEAD 锚点四方向正反例、多行 import 不误伤),镜像测试 `node --test scripts/tests/check-radius-single-source.test.mjs`(4 例,含"锚点必须是 HEAD 而非静态清单"的装车证明)。容器纯圆违规仍由 `scripts/check-rounded-full.mjs`(第 11 项)管,两条互补不互替。

### Button 高度档位守门(强制,2026-09-07 立)

- **`@ihui/ui-react` 的 `<Button>` 禁止用 className `h-*` / `w-*` 覆盖高度宽度**,必须用 `size` 档位:`xs`(h-7 px-3 text-xs, 28px)/ `sm`(h-8, 32px)/ `default`(h-9, 36px)/ `lg`(h-10, 40px)/ `icon-2xs`(h-7 w-7, 28px)/ `icon-xs`(h-8 w-8)/ `icon-sm`(h-8 w-8)/ `icon`(h-8 w-8)。需要新高度先在 `packages/ui-react/src/components/button.tsx` size 表立档,禁止逐处打补丁。**2026-09-21 修正文档漂移**:`icon-xs`/`icon-sm`/`icon` 三档当前**同值**(均为 32px,仅保留名称以兼容既有调用),28px 图标请用 `icon-2xs`;此前本文档误写为 h-7/h-8/h-9 三档不同 —— 这正是"按文档用 `icon-xs` 期望 28px → 不达预期 → 再以 `className="h-7 w-7"` 覆盖 → 触发本守门"违规链的成因。守门脚本(`check-button-height.mjs`)的档位清单已改为从 button.tsx **动态解析**,不再手抄。
- **豁免(不属 Button token 体系)**:原生 `<button>` 自绘按钮(IDE 面板 / spec-panel / chat 密集工具条的 24px 紧凑档为有意设计)、`Input` / `SelectTrigger` / `Skeleton` / 图标 svg 等非 Button 元素;Button 上的 `h-5`/`h-6`(24px/20px 紧凑档,存量 45 处表格行操作钮/侧栏密集场景)暂豁免,后续统一时先立对应档位再迁移。
- 守门:`scripts/check-button-height.mjs`(精确 JSX 开标签解析,零误报;拦 h-7 及以上覆盖 + 校验 size 值合法性)+ pre-commit blocking(紧急跳过 `HUSKY_SKIP_BUTTON_HEIGHT_GUARD=1`)。

### 中文字体 + 图标垂直对齐硬约束(强制)

- **根治方案**:`apps/web/app/globals.css` 设 `--text-vcenter-offset: 0.3px` + 全局规则 `:where(button, a, [role='button'], [role='menuitem']):has(>svg):has(>span) > span { transform: translateY(var(--text-vcenter-offset)); }`,button/a 内 "icon + 中文 span" 同行布局自动应用,text-xs (12px) 用专用 0.7px 规则。配套:`apps/web/src/lib/nav-styles.ts` 5 个共享类 + `<CenteredText>` 组件(`apps/web/src/components/common/CenteredText.tsx`)。
- **编码强制 — icon + 文字必须包 `<span>`(2026-09-15 组件层根治)**:根因是补偿规则 `:has(>span) > span` 只能命中 `<span>` 元素,裸文本节点永远无法对齐(复发 3 次以上)。**根治:`@ihui/ui-react` 的 `<Button>` 已内置 `wrapRawTextChildren`,裸文本 children 自动包裹 `<span>`,使用 Button 无需手写。** 手写原生 `<button>`/`<a>`/`[role=button]` 时仍**必须**自行把文字包 `<span>`(自检口诀:**button 里有 svg,则每个直接文字都写 `<span>文字</span>`**)。守门:`apps/web/e2e/icon-text-alignment.spec.ts`(阈值 |delta| ≤ 0.15px)+ code review 必查项。
- **守门**:`apps/web/e2e/icon-text-alignment.spec.ts` 阈值 |delta| ≤ 0.15px,漏改 → CI fail。**严禁** `-mt-px` / `margin-top: -1px` 反向微调 hack。
- **数字计数徽章强制规范(2026-09-15 立,复发根治)**:按钮/标签内嵌数字计数(如待办数、队列数)**禁止**裸 `<span class="px-1">数字</span>` 手搓 — 行高、字形侧空、位数变化都会导致数字在色块内偏移。**必须**使用确定性居中模板:`inline-flex h-4 min-w-4 items-center justify-center rounded bg-*/… px-1 text-[10px] font-semibold leading-none tabular-nums`。要点:`inline-flex + justify-center` 保证任意位数水平居中;`h-4 + leading-none + items-center` 保证垂直居中(不依赖字体行高);`min-w-4` 保证单位数不掉宽;`tabular-nums` 保证多位数字等宽不抖动。
- **flex 自居中 span 豁免 vcenter 补偿(2026-09-15)**:全局补偿规则(`packages/design-tokens/src/styles/tokens.css`)已改为 `> span:not([class~='flex']):not([class*='inline-flex'])` — 徽章等 inline-flex span 由 flexbox 自居中,整盒再被 translate 下推 0.3/0.7px 会"偏下"(用户实测复发)。**手写 flex 徽章 span 天然豁免,无需任何反向 hack;严禁给徽章再加 -mt/translate 反补**。

### 区段头「更多」入口单一源头(强制,2026-09-24 立)

- **三端唯一实现**:RN = `packages/app/src/components/MoreLink.tsx`(经 `@ihui/rn-app` 导出);web = `apps/web/src/components/common/view-more-link.tsx`;小程序 = `LineIcon name="chevron-right"`(`components/LineIcon/icons.ts` 已含该图标,零新素材)。**禁止在任何端再自拼第四份**「标签 + 箭头」。
- **箭头必须是矢量图标,禁止用字符 `›` / `»` / `>` 充当**。字符与文字没有共用度量,`align-items:center` 居中的是各自行盒:实测「更」12px 墨迹偏上 1.0px,而 `›` 在 14/16/18/20px 档偏下 1.0 至 1.5px —— 是**相加**关系,所以"标签小、箭头大"的旧写法错位 2.0 至 2.5px。算式与完整根因见 `docs/UI_GUIDELINES.md` §4.6。
- **标签与箭头必须同一光学尺寸(RN/web 12px、小程序 24rpx)+ 同一缩放倍率**:旧写法箭头带 `allowFontScaling={false}` 而标签允许缩放,用户调大系统字号即分叉。RN 侧把倍率同时喂 `Text.maxFontSizeMultiplier` 与图标 `size`(clamp 1..1.4),并保留 `includeFontPadding: false`(Android 字体留白不对称,端内已有 8 处同写法)。
- **禁止反向微调补丁**:`marginBottom: -2` / `translateY` / 负 margin 凑数(与本节上方"严禁 -mt-px"同一条禁令,换机型即失效)。
- **文案统一 `common.more`**(更多 / More / もっと見る / 더 보기),不得再写"查看更多 / 查看全部 / 完整榜单";但 `accessibilityLabel` **刻意保留长口径**(如"查看更多模型")—— 可见文案求短,无障碍名称须脱离上下文成立。
- **守门**:`scripts/check-glyph-arrow-icon.mjs`(guardian 第 **102** 项,blocking)三类判据:**GA1** 整格字符箭头 `›»→》`(或 `{'>'}`)在可证 affordance 语境(自身或 ≤8 层祖先带 `on*Press/Click/Tap` 或 `role="button"`,或祖先为 `Link/Pressable/Touchable*/Button`)当图标;**GA2** 「更多」类标签与**同词干** `*Arrow*` 样式配对后箭头字号 > 标签字号(单位不同不判红,计入 undetermined);**S0** 三端唯一实现被摘线或无人 import(防"造好没装车")。口径同 77/83:全量判 HEAD blob、`--staged` 判索引、**棘轮锚点 = 该文件 HEAD 自身违规数**(行尾字符箭头存量 70 处只报数不拦,免得恒红逼人绕过钩子连带废掉全部门);行内豁免 `glyph-arrow-exempt: <原因>`(须带原因);取证 `--self-test` 45 例(含阳性对照与棘轮四向)+ 镜像测试 13 例。紧急跳过 `HUSKY_SKIP_GLYPH_ARROW_ICON=1`。

### 禁止分割线(强制)

- 禁止 `<hr>` / `divide-y` / `divide-x` / 单边 `border-t/b/l/r` 当分割线。允许:容器完整描边(`border border-border`)、背景色对比(`bg-card` vs `bg-background`)、间距分隔(`gap-*`)。

#### 单边 border 的明确区分(解决两位开发者的分歧)

历史上出现两种冲突理解:一位开发者认为**所有** `border-t` 一律禁止;另一位认为显式 `border-t border-border/50` 一律允许。现统一为以下规则,**所有** `border-t/b/l/r` 用法必须归入下列两类之一,不得作为纯分割线使用:

- **允许(结构性边框,非分割线)**:
  1. 卡片/面板边缘:作为完整边框系统的一部分,例如带 `border` 的容器其 header 条用 `border-b` 作为容器底边(边框系统的收口,而非在两项之间画线);
  2. 引用块 / 语义强调左边框:`border-l-4` 等作为语义强调(如 blockquote、强调条),而非分隔两项内容的线;
  3. IDE diff 面板等编辑器内 chrome:有意为之的编辑器界面元素。
- **禁止(纯分割线)**:仅在**列表项之间**或**区块之间**用 `border-t/b/l/r` 画一条分隔线,此类场景必须用 `space-y-*` 间距,或 `bg-muted` / `bg-card` 背景对比替代。

> 注:低透明度单边边框(如 `border-t border-border/50`)是典型的"伪分割线",单独守门脚本 `scripts/check-no-divider.mjs` 对其作 **WARN** 告警(非阻塞),提示开发者确认是否为纯分隔用途;纯分隔线务必改用间距或背景对比。此后若确需单边边框,仅限上述"允许"三类情形。

### 禁止渐变遮罩(强制)

- 任何容器禁止 `mask-image` / `-webkit-mask-image` / `linear-gradient` 用作边缘淡出。用显式 UI 元素("查看更多"按钮 / 计数徽章 / 分页)替代。

### 禁用原生提示窗(强制)

- **禁止**使用原生浏览器提示:`title` 属性 / `alert()` / `confirm()` / `prompt()`。必须使用项目自有的 `Tooltip` 组件(`@/components/feedback`)统一提示样式。

### 图标统一用图标库(强制)

- **UI 图标一律用矢量图标库,禁止 emoji 充当图标。** 图标指导航项 / Tab / 按钮 / 状态指示 / 徽章 / 占位默认图标 / 关闭·发送·播放等操作图标 / 章节标题前缀 icon / 等级奖牌等界面元素。
- **web 端**:统一 `lucide-react`(`import { X } from 'lucide-react'`),渲染 `<X className="h-4 w-4" />`;配置数组里的 `icon: 'emoji'` 须改为 `icon: LucideIcon` 组件引用后在渲染处用 `<item.icon className="..." />`。
- **移动端(React Native)**:统一 `lucide-react-native`(`import { X } from 'lucide-react-native'`),渲染 `<X size={16} color={'#6b7280'} />`;颜色按原 `Text` 的 `text-*` 类或 style 颜色意图转十六进制,尺寸按原 fontSize(-xs→12 / -sm→14 / -lg→18 / -2xl→24)。
- **Taro 小程序端(miniapp-taro)**:统一 `apps/miniapp-taro/src/static/images/icons/` 下的 lucide 风格 SVG(24x24,stroke `#6366F1`),渲染 `<Image className="..." src="/static/images/icons/xxx.svg" mode="aspectFit" />`;动态切换用条件 src(如 `{liked ? heart-fill.svg : heart.svg}`);缺失图标用 `node scripts/gen-taro-lucide-icons.mjs <name>` 从 lucide 提取生成(别名如 bar-chart-3 自动解析)。
- **禁止**在 UI 图标位置使用 emoji(如 🏆 🤖 🔥 ✅ ❌ 🎤 🔔 等)。新增图标须先查 `lucide-react` / `lucide-react-native` / Taro `static/images/icons/` 是否有对应名称,无则用近义图标,不得回退 emoji。
- **例外(不强制)**:文档 / 营销页正文里的装饰性 emoji(提示 💡、技术栈列表、章节叙述中的 emoji)属于内容文案,不在此限;但同一页面应风格统一,优先用图标库。
- 守门:`scripts/check-no-emoji-icons.mjs` 扫描 UI 图标位 emoji(icon 字段 / JSX 渲染位 / 三元条件图标),豁免注释、i18n 参数、表情面板、`'★'.repeat` 评分字符串、表格布尔标记、docs/marketing 正文;guardian-runner 第 11h 项(pre-commit staged 模式阻塞 commit)。

### 品牌/平台图标必须是官方真实图标(强制)

- **展示第三方品牌 / 平台身份的图标(模型、推广平台、接入平台、社交渠道等),一律使用该品牌官方发布的真实图标,严禁手绘、自造、近似模仿或用字母占位图代替。** 手绘品牌图标属于品牌失真,被用户发现即为交付事故(2026-09 头条/WordPress/微博图标事故教训)。
- **官方图标获取链路(按优先级)**:
  1. 官网 favicon 直取:`https://<domain>/favicon.ico`;
  2. Google favicon 服务:`https://www.google.com/s2/favicons?domain=<domain>&sz=128`;
  3. 备源:`https://favicon.im/<domain>?larger=true`;
  4. 品牌官方 CDN / 官网 press-kit 资源。
     下载后必须人工目检(Read 工具查看图片)确认是官方真实图形,不是字母占位或第三方水印版。
- **存放与引用分离**:
  - 发布平台官方 favicon:`apps/web/public/publish-icons/`(引用方:`apps/web/src/components/publish/platform-icon.tsx` 的 `PNG_ICONS` 注册表);
  - 页脚/跑马灯 mono 白色剪影素材:`apps/web/public/footer/tuiguangpingtai/`(引用方:`apps/web/src/components/marketing/footer-data.ts`,带 `mono: true` 反色适配)。
    **两套素材禁止混用**:官方彩色 favicon 不得覆盖页脚 mono 剪影同名文件,反之亦然;新增图标先进 `publish-icons/`,不与 footer 素材重名。
- **深色模式可见性**:黑色系官方图标在注册表中标 `invertInDark: true`(深色下反色为白);彩色官方 favicon 无需反色,靠 `bg-primary/10` 容器衬托。
- **素材卫生**:被替代的旧图标文件必须同任务删除,不留孤儿资源;`.ico` 仅在拿不到 `.png/.svg` 时使用。
- 违反本条 = 未完成:用户要求"官方图标"时,交付物必须逐个可溯源到官方域名,可附来源 URL 清单。

### 圆角容器内 absolute 子元素避让

- 父容器 `rounded-xl` + `overflow-hidden` 时,贴边子元素**禁止** `h-full`/`w-full`,用 `top-<radius> bottom-<radius>`(纵向)或 `left-<radius> right-<radius>`(横向)替代。映射:`rounded-lg`→`top-2 bottom-2` / `rounded-xl`→`top-3 bottom-3` / `rounded-2xl`→`top-4 bottom-4`。
- 拖拽手柄用双层 div 结构(外层命中区 + 内层可见细线),**禁止** `before:` 伪元素方案。

### 浮动弹层内边距规范(2026-09-21 立,起因:context-usage-ring 弹层漏 padding 内容贴边)

新建弹层/浮层必须按内容类型对齐以下四档,**禁止自创中间值**:

| 类型          | 判定特征                                                            | 容器内边距                              | 参考实现                                                              |
| ------------- | ------------------------------------------------------------------- | --------------------------------------- | --------------------------------------------------------------------- |
| 内容面板      | role=dialog,含标题/表单/信息块(permission、通知、设置卡)            | `p-3`                                   | permission-mode-popover、permission-history-panel、context-usage-ring |
| 菜单/选项列表 | role=menu / select 列表,纯按钮项                                    | `p-1`                                   | Select、TagsView 右键菜单、canvas-overlay                             |
| 轻提示/徽标   | tooltip、角标、状态胶囊                                             | `px-2 py-1`(mini 用 `px-1.5 py-0.5`)    | ByokIncomeChart、activity-bar                                         |
| 复合面板      | 输入行+列表的 overflow-hidden 面板(mention、selector、终端 overlay) | 外层零 padding,**行级自带** `px-3 py-*` | file-mention-popover、context-selector-popover                        |

- 反例存档:自定义 portal 弹层从 Radix 迁出时最易漏搬 `p-3`(PopoverContent 自带),新建 portal 容器必须显式写内边距档位。
- 同族组件必须同档:同一直弹层家族(如 permission 系列)不允许 p-2/p-3 混用。

### 跨端样式同步铁律(强制)

- web 与 miniapp-taro 视觉必须完全一致(除平台独占差异:登录页小程序端无、rem2rpx 自适应缩放、原生导航栏/tabBar 用 `Taro.setNavigationBarColor`/`setTabBarStyle` 而非 CSS var 等)。**任何一端改了样式/组件/主题,必须同步另一端**——这是交付门槛,不是可选项。
- **单一真相源**:design-tokens 在 `packages/design-tokens/src/styles/tokens.css`(`@theme` + `:root` + `.dark`)。miniapp-taro 的 `app.css :root/.dark` 由 `apps/miniapp-taro/scripts/sync-design-tokens.mjs` 自动同步(**禁止手改 app.css 的 token 块**;改 token 改源头 + 跑同步,该脚本是端内脚本,根 `scripts/` 下没有同名文件,`node scripts/sync-design-tokens.mjs` 会报模块找不到)。另有 `scripts/check-miniapp-taro-design-tokens.mjs` 与 `scripts/check-miniapp-tokens-sync.mjs`(后者为 guardian-runner 第 36 项实际调用项)校验同步一致性。
- **主题系统**:miniapp-taro 主题根为 `ThemeRoot`(`@/components/ThemeRoot`,内部调用 `useThemeRoot()`),每个路由页 .tsx 顶层须 `<ThemeRoot>...</ThemeRoot>`。设置页切换主题必须调用 `@/lib/theme` 的 `setThemePreference`(同步原生导航栏/tabBar 配色 + 广播事件),**禁止**只用 `Taro.setStorageSync('theme', ...)` 而不同步原生 chrome(否则导航栏/tabBar 不变色)。
- **禁止深色科技风回潮**:app.css 不得再出现 `page{background:#121217}` / `*{font-family!important}` 等全局深色强制覆盖;页面/组件 CSS 不得硬编码禁用色板(`#00f2ff`/`#121217`/`#1f1f28`/`#1a1a2e` 等),一律改用 `var(--color-*`)。
- **禁止同名工具类冲突**:miniapp-taro 的 `app.css` 不得重定义 `.text-primary`/`.mt-*`/`.flex*`/`.align-*`/`.justify-*` 等与 web 端 Tailwind 同名同义类(语义冲突),局部样式用语义化类名 + `var(--color-*`)。
- **守门**:`scripts/check-miniapp-taro-style-parity.mjs`(RULE-1~5:禁用色板 BLOCK / 其他 hex WARN / app.css 回归 BLOCK / 路由页 ThemeRoot BLOCK / tsx 内联 hex WARN / 已删除装饰类复用 BLOCK),接入 pre-commit(`HUSKY_SKIP_MINIAPP_PARITY=1` 跳过)+ `pnpm check:all`。新增路由页忘挂 `ThemeRoot`、改回深色科技风、复用已删装饰类,均会阻塞提交。

---

## 5. 后端约束

- Drizzle ORM 0.38 + postgres-js。用 Zod 校验请求参数。复用 `packages/auth` 的 authenticate 函数;admin 路由用 preHandler 统一校验(roleId >= 1)。幂等操作用 `onConflictDoNothing`。slug 从 name 自动生成。API 响应统一 `{ code, message, data }` 格式。

### 鉴权面公开化必须显式列举(强制,2026-09-23 立)

- **禁止**用兜底正则把 `/api/<前缀>/[^/]+` 这类"参数路由"形态当作公开面 —— 它会连同**静态子路由**一起放行。实测 `agents.ts` 的 `^/api/agents/[^/]+$` 让 `/agents/health` 游客可访问,而 `/agents/need-tasks` 的 handler 依赖 `request.userId`,游客走到它不是 401 而是 **500**:fail-open 直接崩在鉴权层后面,比 401 更难发现。
- 正确做法:**显式白名单列路径**(如 `/api/agents`、`/api/agents/list`、`/api/categories/list`),详情路由用正则时**必须**配一张静态段排除表(`AGENTS_PROTECTED_STATIC_SEGMENTS`)。**新增 `/agents/<静态段>` 的 GET 路由时必须同步登记该表**,否则会被当成游客详情放行。
- 游客视图的公开数据由 handler 自证:强制 `status=published` + `sanitizePublicAgent` 脱敏,并且测试要断言"未发布读不到 + 脱敏字段不出现",不得只断言 200。
- 改动 router 鉴权面前必须做**影响面核查**:全仓 grep 该路径(含 `packages/` 与各端)确认没有未登录调用方;本仓这两个端点的实际调用方为 0。
- 部署侧 nginx 与蓝绿 nginx 是两份配置:边缘限流(`limit_req_zone` / `limit_req_status 429` / `error_page 429`)改一处必须同步另一处,docker 侧 zone 名须带 `docker_` 前缀以免与 `deploy/nginx/conf.d/*.conf` 重名(Nginx 同 http 上下文重名 zone 会**启动失败**)。静态自检:`apps/api/tests/o5-nginx-edge-ratelimit.test.ts`。

### 测试隔离铁律(强制,2026-09-12 立)

- **测试一律禁止连生产库**。pytest 用例不得对生产 PostgreSQL(`8810`)/ Redis(`8811`)产生任何写入副作用;需要 DB 的路径必须 mock 或注入隔离实例。
- 共享连接池(fastapi 侧 `app.core.db_pool.get_shared_pool`)是唯一生产入口,**所有**用例必须通过 `monkeypatch` 替换为 mock,不得直接 acquire。
- autouse fixture 只兜住"默认安全",用例体内若先于 `monkeypatch` 触发真实写入(如 `TestLoadActiveTests::test_duplicate_skill_skipped` 在 patch 前 `await create_test(...)`),仍会污染库 —— 新增用例必须自查执行顺序。
- 回归事故:`agent_ab_tests` 曾累计 17 行 `skill-a` 垃圾数据,并使 `len(stopped)==2` / `totalTests==3` 断言漂移。修复落点为 `apps/ai-service/tests/conftest.py::_isolate_ab_test_db`。
- 自检:<全量回归跑两次> + <跑前跑后 `agent_ab_tests` 行数不变> 才算通过。

---

## 5b. `.git` 存续治理(强制,2026-09-12 立)

**背景**:本机宿主 safe-delete 层会**整体删除**工作区 `.git`,累计触发 15 次(commit/husky、rebase、filter-repo、`reset --hard`、`git stash create`、本机直推 Gitee/GitCode 后 5s 窗口)。`CODEBUDDY_SAFE_DELETE_ENABLED=0` **已证明防不住**。

**现状结构(不可改回)**:

| 路径                                                                                                                                                                                                                                                                       | 角色                                                        |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `D:/IHUI-AI/.git`                                                                                                                                                                                                                                                          | **28 字节指针文件**(`gitdir: D:/IHUI-AI-git-repo`),不是目录 |
| `D:/IHUI-AI-git-repo`                                                                                                                                                                                                                                                      | 真实 gitdir(544MB),在工作区之外                             |
| `D:/IHUI-AI.git-backup-20260912`                                                                                                                                                                                                                                           | gitdir 完整备份,守护的本地恢复源                            |
| **守护**:计划任务 **`IHUI-AI git-guardian`**(每 2 分钟)→ `"C:/Program Files/nodejs/node.exe" D:/IHUI-AI/scripts/git-guardian.mjs`。本机**未安装 nssm**,故未采用 `--daemon` 常驻服务形态,改用脚本自带的 schtasks 兜底(2026-09-12 15:30 实测启用;16:12 实测**自愈已生效**)。 |
| 分层自愈:`指针 → 环境 → HEAD 语法 → 嵌套 ref → 本地备份 → 远端`;每步破坏性覆盖前先归档现场。实测自愈 **0.9s**(refs 自愈实测 **0.14s**)。                                                                                                                                   |

**守护**:计划任务 **`IHUI-AI git-guardian`**(每 2 分钟)→ `"C:/Program Files/nodejs/node.exe" D:/IHUI-AI/scripts/git-guardian.mjs`。本机**未安装 nssm**,故未采用 `--daemon` 常驻服务形态,改用脚本自带的 schtasks 兜底(2026-09-12 15:30 实测启用;16:12 实测**自愈已生效**)。
分层自愈:`指针 → 环境 → HEAD 语法 → 嵌套 ref → 本地备份 → 远端`;每步破坏性覆盖前先归档现场。实测自愈 **0.9s**(refs 自愈实测 **0.14s**)。
**守护**:计划任务 **`IHUI-AI git-guardian`**(每 2 分钟)→ `"C:/Program Files/nodejs/node.exe" D:/IHUI-AI/scripts/git-guardian.mjs`。改用脚本自带的 schtasks 兜底(2026-09-12 15:30 实测启用;16:12 实测**自愈已生效**)。

> **本句原先还写"本机未安装 nssm,故未采用 `--daemon` 常驻服务形态" —— 该前提已失真并于 2026-09-24 更正**:实测 `C:\Windows\System32\nssm.exe` 在位(331264 字节),且存在 NSSM 服务 **`IHUI-GIT-GUARD`**(`git-guardian.mjs --daemon`,进程自 2026-09-15 08:48:42 常驻),与上面那条每 2 分钟的计划任务**同时运行**。即"守护"当前是**双执行体并存**(常驻 daemon + 2 分钟 tick)。本票只如实登记、不动任何一侧:砍哪一侧属 `.git` 存续决策(§5b 的分层自愈依赖"每 2 分钟必有一次巡检"来兜底,而 daemon 侧是否等价覆盖尚未取证),且它**没有任何到人出口**(实测 `grep -niE "mail|smtp|resend|notify|ftqq|sct|pushplus|alert" scripts/git-guardian.mjs` 零命中),故不影响 §5e 通道口径。
> 分层自愈:`指针 → 环境 → HEAD 语法 → 嵌套 ref → 本地备份 → 远端`;每步破坏性覆盖前先归档现场。实测自愈 **0.9s**(refs 自愈实测 **0.14s**)。
>
> **本节三条"机器事实"于 2026-09-24 在 `G:` 那份 checkout 上被逐条测反,照抄会误诊(与 §15b 的盘符补注同族)**:
> ① **活 gitdir 就是工作区内的 `G:\IHUI-AI\.git`(实体目录 2.4GB,不是 28 字节指针)**,`refs-manifest.json` 在它里面;而 `G:\IHUI-AI-git-repo`(810MB)**没有 manifest**,是无人读取的残壳。守护自评 `node scripts/git-guardian.mjs --status` 对当前形态给 `pointerOk:true / gitdirOk:true`。⇒ §5b"必须外置 + 指针"与 §12d"禁止迁出工作区/改指针(**并行会话的恢复逻辑会把指针文件当损坏清除**,2026-09-10 立)"这两条在本机**互斥**;本票只如实登记、**不动任何一侧**——把 `.git` 迁出去是一次破坏性迁移(会连带移动 2.4GB 对象库并撞上清理层),不是"修复文档与现状不符"。
> ② `git remote get-url origin` 实测 **`ssh://git@ssh.github.com:443/IHUI-INF-AI/IHUI-AI.git`**,且 `ls-remote` / `fetch` / 后台 `git-push-guard` 推送全通;上方"origin 实测为 HTTPS `github.com`,`ssh://git@ssh.github.com:443` 形态在本机从未成立"在这一台机上**不成立**。
> ③ `git config --local http.proxy` 实测 **unset**;上方"本机已另配仓库级持久代理(因为钩子进程不继承 shell env)"在这一台机上**不成立**(ssh-over-443 通道不需要它)。
> **口径(本条的真正约束):凡「盘符 / gitdir 形态 / 远端 URL / 代理」四类,每次使用前按当次实测取值**,不得把另一台机的现状当本机事实写进判据,也不得据此推断"通道坏了"。 —— **本行 2026-09-24 被并发旧基线回写带走过一次,同日原地补注使其重新成为"本侧修改"**

### 嵌套 ref 存续(2026-09-12 立,与 `.git` 同源问题)

**现象**:`refs/remotes/origin/main` 反复变 `[gone]`、`refs/tags/backup/push4-*` 反复"仅远端" → 守门 `30a`(commit 丢失防护)**抖动性阻塞**(刚 fetch 完绿,宿主一清理又红)。曾误判为"真的丢 commit"。

**机理(对照实验,可复现)**:宿主清理层删除 gitdir 下 **depth ≥ 2** 的嵌套命名空间目录:

| ref 路径                                       | 层级 | 结果                   |
| ---------------------------------------------- | ---- | ---------------------- |
| `refs/heads/main`                              | 1    | ✅ 存活                |
| `refs/tags/nightly-*`                          | 1    | ✅ 存活                |
| `refs/remotes/origin/main`                     | 2    | ❌ 目录被删 → `[gone]` |
| `refs/tags/backup/push4-*`、`refs/tags/<ns>/*` | 2    | ❌ 目录被删 → "仅远端" |

且 `git update-ref` 对这类嵌套 ref **返回 0 却不落盘**(静默失败)—— 所以"fetch 成功"不等于"ref 存在"。

**边界精化(2026-09-15 受控实验二次实证)**:

- `git update-ref` 对 **refs/heads 一级松散 ref 可靠**(新建 `refs/heads/<name>` 与覆盖既有 loose 均真实落盘);静默失败**仅限 depth ≥ 2 嵌套命名空间**(`refs/remotes/**`、`refs/tags/<ns>/**`)。
- 假成功链路:update-ref 先成功创建嵌套目录(如 `refs/remotes/origin/`)→ ref 文件被秒清 → 同命令内紧接的 `rev-parse` 读回 `packed-refs` 旧值。**"读回旧值"不代表 packed-refs 被改过**,勿朝 packed 损坏方向排查。
- bash 直写(`printf >` / `cp`)与 bash `mv` 对 gitdir 任意路径均真实落盘——清理层只针对 git ref 命名空间,不是文件系统级拦截;`git pack-refs --all --prune` 重写 `packed-refs` 本身可靠。
- 因此**对齐 `origin/main` 的唯一正解**:`git fetch origin main` → `node scripts/git-refs-heal.mjs`(FETCH_HEAD 权威值 → 固化 packed-refs)。**禁止**手工 `git update-ref` / 松散直写 `origin/main`(写了也会被清,且假成功会误导排查方向)。

**解法(载体替换,非 workaround)**:把嵌套 ref 固化进 `packed-refs`(gitdir **顶层单文件** → 清理不到),期望值另存 `refs-manifest.json`(同为顶层文件)。松散文件被删也照样解析。

- 期望值清单:`<gitdir>/refs-manifest.json`(含 `refs/remotes/origin/main`、`refs/tags/<ns>/*`)
- 固化:`git pack-refs --all --prune`(松散文件被 prune,只剩 packed)
- 手工命令:

  ```bash
  node scripts/git-refs-heal.mjs                   # 离线:按清单重建缺失 ref + 固化(无需网络)
  node scripts/git-refs-heal.mjs --status          # 只看健康
  node scripts/git-refs-heal.mjs --refresh-remote  # 联网:从 origin 校准全量 tag/heads 后固化
  ```

- 守护已在每个 tick 检查 `refsOk`,缺失即离线重建并写审计日志 —— **一般无需人工介入**。
- **`origin/main` 以 `FETCH_HEAD` 为准**:fetch 写入的松散 remote-tracking ref 在 **1 秒内**即被清理,
  若 `packed-refs` 残留旧值,同 sha 也会显示 `## main...origin/main [ahead 1]`。
  修复器已内建该规则(`git-refs-heal.mjs` / 守护 `healRefs()` 均读取 FETCH_HEAD 权威值)。
- **禁止**把嵌套 ref 的存续寄托在松散文件上(必被清理);**禁止**用 `HUSKY_SKIP_COMMIT_LOSS_CHECK=1` 绕过 30a —— 先跑 `git-refs-heal.mjs` 判定是真丢 commit 还是 ref 抖动。

**铁律**:

- **禁止**把 `.git` 改回目录形态:`git init` 必须带 `--separate-git-dir=D:/IHUI-AI-git-repo`;不带参数重建会把 544MB 实体拉回工作区,直接暴露给宿主删除。
- **禁止**删除/清理 `D:/IHUI-AI-git-repo`、`D:/IHUI-AI.git-backup-20260912`,以及两目录的 `*.broken-*` 归档。
- **现场归档一律落在 `gitArchiveDir()`(现 `D:\DevEnv\backups\git\`),手工抢修也不得例外**:把 `.git*` 的归档 `mv` 到**工作区根目录**等于把恢复现场送回宿主清理层的射程内(§5b 背景),而 §15b 已把项目根排除在备份落点之外。2026-09-24 03:13 一次手工 `mv` 就在一级目录留下 7 项 `.git.broken-remote-*`(3.2MB refs 快照 + 4 个 24 字节 `gitdir: G:/...` 旧指针),由守门 44(根目录整洁,blocking)检出后收口 —— 判据本身有效,缺的是"人工路径也必须走 `gitArchiveDir()`"这句。
- **禁止**手工 `git init` 抢修`:git` 消失 —— 先等守护(≤2 分钟;急可 `schtasks /run /tn "IHUI-AI git-guardian"` 立即触发),再查 `.workbuddy/git-guardian.log`(健康时**不写行**,别把「无日志」当没跑)。
- git 调用**不得依赖环境**:脚本一律 `execFileSync(<绝对路径 git>, ['-c','safe.directory=*', ...])`;服务账户(LocalSystem)与交互账户的 `safe.directory` 互不相通。
- **提交/推送**:**本机就是生产机**(`IHUI-API` 的 nssm `AppDirectory=D:\IHUI-AI\apps\api`、`IHUI-DEPLOYLOOP` 的 `AppDirectory=D:\IHUI-AI`,部署日志实测)。**【2026-09-24 深夜就地更正:这句在本侧 checkout 不成立 —— 用户明确指正"本机不是生产机,是开发机",三重实测印证:`Get-Service -Name IHUI*` 计数 0、`Win32_Service` 按 `DisplayName -Like *IHUI*` 零条、`Get-NetTCPConnection -State Listen` 对 8801/8802/8803/8810/8811 全部零命中(web/api/PG/Redis 无一在跑),而 `schtasks /fo CSV` 里仍有 16 条 `IHUI*` 计划任务 —— 形态是"任务在、服务与端口不在"。与 §5b/§15b 同族:上面那串 nssm `AppDirectory` 是 `D:` 那份 checkout 的历史事实,不得当本机现值照抄。后果是实打实的:本会话有 agent 据此把 D20/D29 的建表迁移按住,理由是"部署环会自动应用迁移=生产爆炸半径",该理由在本机不存在。口径:凡"要不要因为怕影响生产而暂缓"的判断,**先实测服务与端口**,查不到=开发机,按常规动作走;但反过来也别把"没有服务"读成"随便动" —— 无 PG 端口意味着迁移在本地连应用与验证都做不了,验收只能走守门 49 的离线判据(B1–B5)并明写"`--db` 模式本机不可用",不得让绿钩子冒充"迁移已验证"。取证陷阱:`powershell.exe -Command "... \$_.Name ..."`(双引号+转义)会**静默返回空**,看似"什么都没找到";判"零命中"必须换单引号包整段命令复测,否则把工具失效当成了事实。】**本行曾被 `978480078d0`(converge 的 worktree-preserving 合并)整文件回写吞掉一次,同日原地重打。`origin` 实测为 **HTTPS** `https://github.com/IHUI-INF-AI/IHUI-AI.git`,且 **HTTPS 直连 `github.com:443` 时通时不通**(同一分钟内 `git fetch` 可成功而 `git push`/`git ls-remote` 连拒 4 次)。唯一稳定通道是**本机代理 `http://127.0.0.1:7897`** —— `deploy/win/ihui-deploy.ps1` 每轮就是用它 fetch(日志行 `git 网络走代理 http://127.0.0.1:7897`),所以"部署环能取到远端而 agent 推不动"不是玄学,是**没走代理**。旧文档写的 `ssh://git@ssh.github.com:443/...` + 仓库级 `core.sshCommand` 形态**在本机从未成立**:`core.sshCommand` 未设置,`ssh.github.com` 握手可通但 `~/.ssh/id_ed25519`、`id_remote_control` 逐把 `git ls-remote` 均 `Permission denied (publickey)`(无任何已登记公钥,登记属账号侧动作)。⚠️ `~/.git-credentials` 在本机**并不存在**,不要按它取 token(HTTPS 走的是凭据管理器)。**agent 需要 git 网络时的两种写法**:临时用 `export http_proxy=http://127.0.0.1:7897 https_proxy=…`(或 `git -c http.proxy=…`);**本机已另配仓库级持久代理** `git config --local http.proxy/https.proxy = http://127.0.0.1:7897`(2026-09-23 立),因为 post-commit 的 `git-push-guard` 与其后台 worker 是钩子派生的 git 进程、**不继承任何 shell 的 env**,没有仓库级配置就仍然直连撞墙(此前"commit 成功、push 反复 failed"的真因即此)。该配置落在指针文件指向的 `D:/IHUI-AI-git-repo/config` 里,**不在工作树内 ⇒ 不受"旧基线整文件回写"影响**,也不会被并发会话抹掉;换网或代理关停时用 `git config --local --unset http.proxy` 撤销即可。新克隆/新机需重跑一次这条配置。本机**不直推 Gitee/GitCode**,交给 `mirror-to-cn.yml` 镜像收敛。自 2026-09-12 15:30 起 gitdir 已移出工作区(仅剩 28 字节指针),本地 git 写操作不再暴露给宿主批量删除层。
  - **🚫 agent 禁止手写 `git push`(2026-09-18 立,"已推完还在等"事故根治)**:①origin 的推送由 post-commit 钩子 `git-push-guard.mjs` 自动完成(内置 ahead 检测+推送+回读验证,幂等)——commit 落地即已推送,**手动盲推必撞 already-pushed 非快进报错**并诱发后台反复干等;②Gitee/GitCode 由 `mirror-to-cn.yml` CI 在 push 后自动镜像(+每日 2 次兜底),**本地手推镜像仓=违反架构**且制造 DIVERGED 竞态。③收尾核验同步状态**只允许** `node scripts/git-push-converge.mjs`(只读判定,六态 ALREADY/PUSHING/PUSHED/SKIP/BEHIND/DIVERGED,不做任何非必要推送);仅在 guard/CI 均失效的应急场景才人工推,且必须先跑该脚本确认状态。多会话并发期:本会话交付已被远端包含(merge-base --is-ancestor 验证)即为完成,本地 HEAD 落后不追、不与并发会话抢 reset/ff。
  - **⚡ 推送异步化(2026-09-18 立,根治第二段)**:guard 检测到 ahead 时默认 spawn 后台 worker 推送(pre-push 质量门不降级,实测单遍 216.8s)并立即返回——**commit 命令秒回,不再被推送拖住**;状态在 `.workbuddy/push-state.json`(running/done/failed,失败由下次 guard 自动重试),converge 读该状态显示 PUSHING;核验若见 PUSHING=正在推,等 1-2 分钟再查即可,勿手动干预。强制同步推送:GUARD_ASYNC=0。(2026-09-18 晚修复:异步 spawn 的 fd 误用 `out.close()` 必抛 TypeError→静默回退同步推送+双重推送竞态,已改 `closeSync`;push-gate 缓存改**内容指纹键控**(HEAD:apps/HEAD:packages 子树+脏文件内容 hash),合并/文档提交不再重跑全量门。)
  - **🔄 主动收敛(2026-09-18 晚立,根治第三段)**:推送遇 non-FF(并发会话推力)时**禁止手工 fetch/merge/push 循环**(实测 3 轮 25 分钟),统一跑 `node scripts/git-sync-converge.mjs`(默认 3 轮:fetch→祖先判定→`merge-tree --write-tree` 索引层合并(**零触碰他人未提交文件**)+commit-tree+update-ref→guard 推送,直至收敛;冲突才需人工)。只读核验仍用 `git-push-converge.mjs`。
  - **🪟 后台进程禁弹窗(2026-09-18 晚立)**:Windows 下 `spawn(detached:true)` + 控制台程序**必弹新 cmd 窗口**——所有 detached spawn 必须带 `windowsHide: true`(guard worker/锁心跳/desktop-dev-saas 已全量修复,仓库既有正例 dev-with-warmup.mjs)。**同理所有 `shell:true` 的 spawnSync/execSync 必须带 `windowsHide: true`**——shell 派生链无 CREATE_NO_WINDOW 时,pnpm -r typecheck 等会为每个子包拉起可见 cmd.exe(2026-09-18 WMI 实锤:一次全量 typecheck ~30 次闪窗,13 处派生点已全量修复)。新增派生点遗漏此参数=用户桌面反复弹窗事故。**⚠️ 默认终端=Windows Terminal 时上述措施全部失效(2026-09-18 深夜 WMI 二次实锤根治)**:WT 宿主忽略 SW_HIDE(windowsHide 无效)且不理 HKCU\Console 离屏档案,同一负载实测 135 个可见窗口样本;已把 `HKCU\Console\%%Startup` 的 DelegationConsole/DelegationTerminal 双双设为 `{B23D10C0-E52E-411E-9D5B-C09FDF709C7D}`(Windows 控制台主机 conhost)——conhost 尊重 SW_HIDE 与离屏档案,复跑同负载可见窗口归零。**禁止改回 WT 委托**;排查弹窗先查此键,取证脚本=.ihui-agent/tmp/console-watch.ps1(WMI 事件+15ms 可见窗口采样,后台 PS 任务约 2 分钟即被杀,足够覆盖一次守门链)。
  - **🧬 机器级根治 windowsHide 默认值(2026-09-20 立,"git 窗口一直弹"第四次复发收口)**:实测 Node v24 `child_process` 的 `windowsHide` **默认 `false`**;当父进程**无控制台**(detached+文件 fd 的 guard worker、计划任务、Qoder/Trae/WorkBuddy 等 GUI 宿主派生)时,派生任何控制台程序(git/cmd/pnpm/node)**必分配一个可见控制台**。逐点补参数不可持续(仅 `scripts/`+`.husky/` 热路径就 74 处漏,全仓 ~600 处,且新写脚本继续产生)。**根治**:`node scripts/install-console-window-hook.mjs --apply` —— 把 `scripts/lib/windows-hide-default.mjs` 复制到**仓库外**稳定目录(默认 `<TEMP 上级>/ihui-node-hooks`,本机 = `D:\caches\ihui-node-hooks`;放仓库外是因为 `NODE_OPTIONS` 指向的文件一旦缺失会让**全机所有 node 进程启动失败**,仓库移动/删除不得波及。钩子源文件**必须是 `.mjs`**:`.gitignore` 第 207 行 `*.cjs` 会把 `.cjs` 静默忽略,§23 同类陷阱,一旦被忽略其他机器就装不上),并以 `--import=file:///...` 写入 HKCU 用户级 `NODE_OPTIONS`。钩子给 7 个派生方法补默认 `windowsHide: true`,**显式传 `false` 一律尊重**;落盘前必先用暂存副本做"node 能否带此 NODE_OPTIONS 启动 + 7 个方法是否真被替换"双试跑,不通过则**拒绝写入**,原值备份于同目录 `node-options-backup.json`。实测**ESM 具名导入 `import { spawnSync }` 同样被拦**(loader 早于 builtin ESM facade 创建)。**换机/重装/新克隆后必须跑一次 `--apply`**;`--verify` 巡检不写盘,`--remove` 卸载。**不得因此省略逐点参数**:干净 checkout、他人机器、CI 没有此 env 时仍靠显式 `windowsHide: true` 生效,新增派生点照旧必须写。
  - **🔒 机制守门(2026-09-20 同日补,防第 5 次复发)**:`scripts/check-no-visible-spawn.mjs`(guardian-runner 第 **52** 项,blocking)——括号配平提取 `spawn/spawnSync/exec/execSync/execFile/execFileSync/fork` 调用,**首参可"肯定"为控制台程序**(白名单含 git/node/pnpm/cmd/pwsh/schtasks/ffmpeg…,并覆盖绝对路径与"路径+参数"两种形态)且 options 缺 `windowsHide` 即拦截。刻意**宁漏不误报**(未知变量名一律放过),避免阻塞他人提交;测试代码路径降为 warn(测试由终端 runner 派生,子进程继承已有控制台不新分配窗口)。`--staged` 供 pre-commit 用(runner 自动下发),`node scripts/check-no-visible-spawn.mjs` 为全量审计,`--self-test` 跑 14 例逻辑自检。§22c 镜像测试:`scripts/tests/check-no-visible-spawn.test.mjs`。
  - **🔗 异步推送配套适配(2026-09-18 晚)**:①check-push-sync(pre-commit #29)遇 push-state running(未过期)放行——否则每次 commit 后 270s 窗口内的下一次 commit 必被 #29 阻塞→--no-verify→80 项守门全跳过;②guard worker 串行化:在途 worker 未落定时新 worker 先等后跑,杜绝多个 270s typecheck 并行打满 CPU。③**推送门中断分类(2026-09-18 深夜)**:typecheck 进程被外部杀死(CTRL_C 注入/宿主清树,exit 3221225786/141/143/130/137,实测日志 39 次)≠ 类型检查结论——check-typecheck 按**临时失败 exit 75** 退出→guardian-runner 原样传播→pre-push 写 `.workbuddy/push-gate-last-result.json` 标记+exit 75→guard worker 见新鲜 75 标记**先带 hook 重试**拿真实结论,仍失败才按用户规则 --no-verify 兜底(此前"被杀"被误判成"他人代码失败"直接绕过真实门禁)。④降级判据第三兜底 `head-diff`:push-scope 与暂存区均为空时用 `git diff --name-only origin/main HEAD` 推断推送范围(实测 4 例"无可判定改动范围,无降级"硬拦);⑤push-state 死 pid 自愈:guard 启动发现 running+死 pid → 顺手改写 failed 终态。⑥**typecheck 再入守卫(2026-09-18 深夜,WMI 实测 24.6 万 cmd/2min fork 风暴根治)**:根包 `pnpm typecheck`=typecheck-full.mjs,pnpm -r 一旦把根包纳入执行即无限递归(每层再起 pnpm -r,指数级进程树,实测 ~2000 cmd/秒持续 26 分钟,即用户"一直闪弹 cmd"的主源);typecheck-full 已加 `IHUI_TYPECHECK_FULL_CHILD` 环境变量再入守卫(子层检测到立即 exit 0),勿删。
- **工作区存续自愈(2026-09-23 立,与 `.git` / 嵌套 ref 同源问题)**:宿主清理层同样会**成批删除工作区里的已跟踪目录**(实测同日三轮 137 → 27 → 1 个,命中 `tests/`、`__tests__/` 整目录与安装器位图资源)。缺失只体现为 `git status` 一片 ` D`,而**下一次提交就会把这些文件从版本树里删掉**(等价一次静默回滚)——`.git` 与 refs 早有分层自愈,工作区存续性此前无人管。自愈脚本 `scripts/heal-worktree-tracked.mjs` 判据三条同时成立才恢复:① 工作区缺该文件;② **索引 blob == HEAD blob**(⇒ 无人对它暂存过任何改动,含 `git rm` 的暂存删除);③ HEAD 中该路径存在。故恢复内容按定义零独有数据,他人已暂存的删除**只报数、不代裁**。触发点挂在 `git-guardian` 巡检的**健康轮次早退之前**(计划任务实跑 `main()` 单轮,`startDaemon` 未启用 —— 挂错位置等于永不执行);`--check` 口径保持零副作用,派生一律带 `windowsHide`(§5b)。手动:`node scripts/heal-worktree-tracked.mjs [--dry-run|--json|--self-test]`;跳过 `IHUI_SKIP_WORKTREE_HEAL=1`。故障演练:删 `scripts/brand-foreground-baseline.json` → 跑一轮守护 → 文件自动找回并写审计行「✅ 工作区存续自愈:恢复 1 个被外部删除的跟踪文件」。
- **同一自愈的第二、三层(2026-09-23 补)**:`alignDrifts()` 对齐**幻影漂移**(索引==HEAD 且 工作区内容==该路径某祖先版本 ⇒ 才动;判据直接复用守门 84(原 76),单一真相源);`refreshStaleIndex()` 刷新**落后索引** —— CAS / converge 用 commit-tree + update-ref 推进 HEAD 却**不动主索引**(`git status` 首列 `M `,实测同日 14 个路径),此时一次不带 pathspec 的普通 commit 就把整批文件写回旧版;三条判据同时成立才刷新(① index≠HEAD ② 索引 blob 确为该路径历史版本 ③ 工作区==索引),且**只逐路径 `update-index`,绝不做全局 `git reset`**(会连带 unstage 他人真正的暂存)。挂点:`git-sync-converge` 的成功出口自动调 `--align-drift`(真仓实测已生效)。`--self-test` 共 12 例,含三条反向对照:真编辑不覆盖 / 暂存后又有改动不刷新 / 他人真暂存不刷新。
- **本地恢复源必须增量刷新(2026-09-24 立,补 §5b 唯一的空白层)**:`git-guardian` 只**读**恢复源(`backupOk` 判存在 + `cpSync(BACKUP → GITDIR)`),此前**没有任何环节更新它**。实测 2026-09-24 04:40:`G:/IHUI-AI.git-backup-20260912` 的 main 停在 `f481c39a0`(09-23 20:13),本机 main 已前进 **97 个提交** ⇒ 宿主再删一次 `.git`,从该源恢复等价于**回滚 97 个提交**;若其中含未推送提交,即 09-23 15:49"15 条未推送 commit 对象永久丢失"的同型事故重演。刷新器 `scripts/git-backup-refresh.mjs` 对备份做**增量 fetch**(`+refs/heads/*` + `+refs/tags/*`、`--update-head-ok`,备份是 `.git` 的非裸 cpSync 副本,默认会被 git 硬拒)、`read-tree --reset HEAD` 重建其索引(不触碰任何工作树)、并复制 `refs-manifest.json`(使离线恢复后立刻具备嵌套 ref 自愈)。取证:`--self-test` 9 例(第 7/8 例专测非裸副本形态 —— 真仓首跑就是被它咬出 `refusing to fetch into branch 'refs/heads/main' checked out`;裸仓测不到)、`--check` 在追平前 exit 1、真刷后 exit 0。触发点:计划任务 **`IHUI Git Backup Refresh`**(每 15 分钟,经**纯 ASCII** `scripts/git-backup-refresh-hidden.vbs` 以 SW_HIDE 派生,注册前已用 `cscript //nologo` 实跑预检)。手动:`node scripts/git-backup-refresh.mjs`;判健康:`node scripts/git-backup-refresh.mjs --check`(零副作用)。
  - **触发点已改挂守护 tick(2026-09-24 同日补)**:实测 `Get-ScheduledTask` 全量列表里**已经没有** `IHUI Git Backup Refresh`(与 §26 记的 `IHUI C-Drive AutoMaintain` 凭空消失同型,而同目录其余 `IHUI*` 任务全在位可列 ⇒ 不是查法失效),恢复源因此又落后 100+ 枚提交。现由 `git-guardian` 每轮 `refreshRecoverySource()`:先 `--check`(零副作用、便宜)早退,判落后才跑增量刷新。**教训:关键自愈层不得挂在一个会自己消失的东西上** —— 计划任务可以当兜底,不能当唯一挂点。
- **禁止 `git pull --rebase`**:2026-09-12 15:2x 一次 rebase 崩溃导致真 gitdir 目录被原生删除。同步一律用 `git fetch <remote> main` + `git merge --ff-only FETCH_HEAD`。

**诊断**:

```bash
node scripts/git-guardian.mjs --status      # pointer/gitdir/git/HEAD/dirty/备份/嵌套ref 全量健康
node scripts/git-guardian.mjs --check       # 只检查,异常 exit 1(CI/巡检用)
node scripts/git-refs-heal.mjs --status     # 嵌套 ref 与清单比对(缺失即 exit 1)
schtasks /query /tn "IHUI-AI git-guardian"  # 守护任务实况(本机无 nssm;急用 schtasks /run 立即触发)
schtasks /query /tn "IHUI-AI git-guardian"  # 守护任务实况(另有 NSSM 服务 IHUI-GIT-GUARD 常驻 --daemon,见 §5b 上方更正;急用 schtasks /run 立即触发)
tail -20 .workbuddy/git-guardian.log        # 自愈审计流水(健康时不写行)
```

---

## 5c. 溯源水印与生成产物(强制,2026-09-12 立)

**三层水印**(`scripts/watermark.mjs`):L1 可见横幅(`// © 2026 IHUI AI …` + `// Provenance-watermarked. …`)、L2 横幅内零宽载荷(`// [IHUI-AI-PROVENANCE]:<zw>`)、L3 文件末尾独立不可见行。
**判据(2026-09-12 加严)**:载荷必须**可解码且等于 `WATERMARK_TEXT`**,仅"存在"不算数。四态:`完好` / `残迹`(有横幅无载荷)/ `载荷损坏`(存在但解码不符)/ `未覆盖`。后三者 `watermark.mjs verify` 与 `check-watermark-coverage` 均 **exit 1**。

- 新建源文件后必跑:`node scripts/watermark.mjs inject <file>`;然后 `node scripts/check-watermark-coverage.mjs`(pre-commit + CI 门禁,只统计 git 跟踪文件)。
- **门禁是自愈式(2026-09-12 立,根治"恒红只能靠跳过"的历史痛点)**:`check-watermark-coverage.mjs` 检出缺口后**自动 `clean+inject` 回写并 `git add` 回暂存区**,修复后 `exit 0`。因此**任何**来源(生成器 / `sed` / 批量脚本 / 手工编辑)产出的无水印或载荷损坏文件,都不可能进入提交 —— 无需再 `HUSKY_SKIP_WATERMARK_GUARD=1`。
  - 纯判定不改文件(CI / 审计):`node scripts/check-watermark-coverage.mjs --no-fix`。
  - 安全闸:单次缺口 > 200 个时**拒绝**自动回写并报错(疑似批量改写事故,须先排查来源再整体 `inject`),避免静默整体重写。
  - CI 侧仍用 `node scripts/watermark.mjs verify` **严格判定**(不自动修复),保证"本地能自愈、远端不掩盖"。
- **生成器仍应自带注入(更早一步,非唯一防线)**:任何 `writeFileSync` 产出 git 跟踪文件后,必须紧随一次水印注入,失败即 `process.exit(1)`:

  ```js
  execFileSync(process.execPath, [resolve(repoRoot, 'scripts/watermark.mjs'), 'inject', outFile], {
    stdio: 'inherit',
  })
  ```

  - 用 `process.execPath` + 绝对路径,**不要**裸 `node` / `spawn('node')`(依赖 PATH,服务/CI 下会失败)。
  - 参考实现:`apps/miniapp-taro/scripts/gen-i18n-compressed.mjs`。
  - 事故:该生成器此前不写横幅 → 产物 `src/i18n/generated/remote-locales.gen.ts` 长期缺载,使 `check-watermark-coverage` 对已跟踪文件恒红,提交只能靠 `HUSKY_SKIP_WATERMARK_GUARD=1` 绕过。

- **禁止对含载荷文件做文本级批量改写**(reflow、空白归一、正则替换、`sed -i`、编码往返、批量重写):`U+200B`/`U+200C`/`U+200D`/`U+2060` 属 Unicode **Cf 类**不可见字符,会被这类操作静默改写。
  - 事故:`apps/ai-service/**` 等 **144 个已跟踪文件、218 处载荷**被破坏,解码成 `PROVENCE-2026` / `IHUHU-AI` / `IIUIUIUI-AI` / 混入控制字符 —— 旧版门禁只验存在性,损坏长期隐形。修复后 `verify` 新增"载荷损坏"计数并阻断。
  - 需批量改名/改动时:先 `clean` → 改 → 再 `inject`;或直接 `inject`(工具已能识别损坏并清洗重注)。
- 注入是**幂等**的(同一载荷 → 同一字节),重复生成不产生 diff;`clean → inject` 往返**零漂移**(已回归验证:可见内容逐字节不变)。
- `clean` 按**行首锚定**(`© YYYY IHUI AI` / `Provenance-watermarked.` / `[IHUI-AI-PROVENANCE]:`)识别横幅,**不会**误伤源码里的 `BANNER_ID` 常量或正则定义。
- **禁止**为加水印而整体重写文件内容(会破坏零宽溯源链),一律用 `watermark.mjs`。

---

## 5d. 模型密钥引导与 `.env` 回填(强制,2026-09-12 立)

**密钥不入仓、不入聊天记录。** 本机模型密钥的唯一权威来源是百度网盘同步目录 `BaiduSyncdisk/密钥/模型/`(每厂商一个 txt,内容为裸 token)。**盘符不得写死**:本机实测真实库在 **`F:/BaiduSyncdisk/密钥/模型/`**,而 `D:/BaiduSyncdisk` 根本不存在 —— 旧版本节与两处脚本都按 `D:` 写,结果是"读不到文件"被下游门禁报成"凭据失效"(2026-09-24 镜像活性假故障的根因)。解析统一走 `scripts/lib/key-dir.mjs`(`resolveKeyDir('模型')` / `resolveKeyDir('git仓库')`,按 F→D→E→G→C 取第一个存在者);目录仍可用环境变量 `IHUI_MODEL_KEY_DIR` / `IHUI_MODEL_KEY_DIR_GIT` / `IHUI_SECRETS_ROOT` 或 `--key-dir` 覆盖。

- 回填流程:先 `node scripts/env-backfill-model-keys.mjs --verify` 巡检(不写盘),确认无误后 `--verify --apply` 写盘。
- 硬性约束:只写 `.env` 中**值为空**的键;已有值一律跳过、**绝不覆盖**;apply 前自动备份到 `.ihui-agent/env-backup/`(已被 `.gitignore` 忽略)。
- 输出恒为脱敏态 `前6位***后2位 (len=N)`,任何情况下不打印完整 key。`.env` 由 `.gitignore` 第 98 行忽略,**永不入库**。
- 多候选消歧:同一源文件出现多把 key 时(如 AGNES 曾有两把),`--verify` 会逐把请求厂商官方 `/models` 端点,取**真能鉴权通过**的那把 —— 不靠猜测、不靠索引。
- 判读规则:`网络不可达` **不等于** key 无效(本机访问不到 Google,`GEMINI_API_KEY` 探测必然超时);只有 `鉴权通过` 才是有效判据。
- 换机器 / 重装后若 ai-service 静默降级,首选动作就是跑一次本脚本巡检。
- **上面"真实库在 `F:`、`D:/BaiduSyncdisk` 根本不存在"是另一台机(G: 那份 checkout)的实测,在这一台机上正好相反**(2026-09-25 实测:`F:`/`E:` 都 absent,`D:/BaiduSyncdisk/密钥/` 才是真库 —— 里面有 `模型/`、`git仓库/`、`IHUI生产账号/` 等)。与 §5b 四条"机器事实"同族:**盘符每次使用前按当次实测取值**,不得把另一台机的现状当本机事实,更不得据此推断"凭据失效"。
- **非 node 调用方(PowerShell / 批处理 / 计划任务)取凭据路径的唯一出口 = `node scripts/secret-path.mjs <子目录> <文件名>`**(2026-09-25 立)。它只做 `key-dir.mjs` 的出口包装,**stdout 恒为路径、绝不含任何凭据内容**(NSSM 会把服务 stdout 落进日志,打内容等于把口令写进日志),且**区分"凭据目录不存在"(要先 mkdir)与"文件不存在"**(两者处置动作不同,混成一句会让人写好文件仍读不到)。退出码:`0` 解析到 / `1` 目录或文件缺失 / `2` 连根都不可达(`2` 是"无法判定",不得报成"口令错误")。调用方**禁止再自己抄一份 F→D→E→G→C 候选** —— 那正是本节记过的"读不到被下游说成失效"的成因。
- **口令落点按用途分子目录,规矩同一套**:现有 `模型/`(厂商 key)、`git仓库/`(远端凭据),2026-09-25 起新增 **`db-backup/ihui-backup.txt`**(PG 备份专用角色口令,见 `deploy/win/ihui-pg-backup-role.sql` 与 `deploy/win/ihui-pg-backup.ps1` 的凭据段)。新增用途就再加一个子目录,**不要**把口令挪进仓库、`.env`、日志或聊天记录。
  - **跨进程参数选 ASCII**(本例 `db-backup` 而非 `数据库备份`)——但先看清**本机实测中文是无损的**:`.ps1` 保持无 BOM UTF-8,经服务实际使用的 `C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`(**在这个 Windows 11 26200 上产品版本已是 7.6.2**,`Get-Item .VersionInfo.ProductVersion` 实读)传给 node 后 hex 逐字节一致。选 ASCII 只是让"解释器版本 / 控制台代码页"这类未证差异**不可能**影响一条功能参数;真正会发生的现象是**输出面**因 GBK 控制台代码页花屏(实测),那不影响判据,所以中文留在注释与 `Write-Host` 里无妨。
  - ⚠️ **由此推翻 §27 的一个前提**:在这一台机上 `powershell.exe` 与 `pwsh.exe` **是同一个引擎(7.6.2)**,所以"必须用 pwsh 才安全"在这里不是引擎差异而是路径习惯。**别再按 5.1 的假设写防御代码** —— 本票就先写了一段 `ErrorActionPreference='Continue'` 包裹(防"Stop + 原生 `2>&1` 把 stderr 升成终止错误"),实测两引擎都不抛、`$LASTEXITCODE` 完好,遂删。凡"某个 PowerShell 版本会怎样"的断言,一律当场跑一次再说。

---

## 5e. 运维到人通知 = 邮件单通道(2026-09-24 收口)

- **告警/运维到人只有邮件一条通道**。此前并行的第三方推送腿(免费额度 5 条/天的推送网关 + 其凭据环境变量/密钥文件/状态文件)已**整体摘除**:代码、环境变量读取、状态文件读写、文档段落均不留残余;摘除原因与演进记录只存在于 PROJECT_PLAN/归档。第三方凭据文件按策略不删(删凭据不是本仓动作),只是不再被任何代码读取。
- **配额模型 = 只按身份去重、无总量封顶**:同一条告警(alertname+instance 指纹)在去重窗口(默认 4h)内只寄一封,不同告警一律照寄。"每日 N 封"计数闸全部禁止 —— 第三方额度是**他人配额**,撞顶即静默丢投递,自保才有意义;SMTP 是我们自己的,自设总量上限等于把"告警静默"再复制一遍。显式开关(`BRIDGE_MAIL_ENABLED` 这类)只允许关"要不要发",不得关"发几封"。
- **失败必须响**:第三方推送时代"邮件只是兜底、失败可以忍"的前提已不存在。邮件寄不出去必须留可诊断痕迹(日志吼 + UNDELIVERED 标记文件,参照 `scripts/check-credential-health.mjs` 的 `UNDELIVERED` 机制与 bridge `alert-bridge-mail-UNDELIVERED.json`),下一次成功投递自动清除;不得静默。
- **发信一律经 `apps/api/scripts/notify-deploy-failure.ts`,不得在任何脚本里自拼 SMTP/Resend**(版式唯一真相源 `apps/api/src/services/email-templates.ts`,由守门 81 `check-brand-email-channel.mjs` 硬拦)。**通道与 From 的硬事实**:① 优先 SMTP,且经 `smtp.qq.com` 中继时 **From 的邮箱段必须等于登录账号**,否则被 550 拒 —— 旧规则"发件人统一 `智汇AI官方 <IHUI-AI@aizhs.top>`"配 QQ 账号正是本条成因(SMTP 恒被拒 → 恒回落纯文本 Resend → 用户收到的邮件永远没样式);② `aizhs.top` 只在 **Resend(已验证域)** 通道作 From,回落链 SMTP → Resend 且 payload 必带 `html`;③ 多行中文正文必须走 `--message-file`(无 BOM UTF-8),命令行参数会过一层控制台代码页(GBK);④ 调用方**一律不得传 `--env-file`**(tsx v4 会劫持它转发给 node,路径不存在时 node 直接 `exit 9`)。运维告警收件人由 `apps/api/.env` 的 `ALERT_EMAIL_TO` 控制(缺该键 ⇒ `alert-notification-service` 的 email 通道被整条排除,含数据库备份缺失 / 24h 错误超阈 / AI 资讯源失败 / 转发配额四类告警,且只在全通道皆空时才 warn)。
- **凭据残留的两类处置边界(2026-09-24 实测划定)**:① **服务环境块**里已无人读取的推送键要**事务式**摘除 —— `nssm set … AppEnvironmentExtra` 是**整块覆盖**语义,同块往往还挂着别的关键值(本机 `IHUI-DEPLOYLOOP` 块内就有 `IHUI_ADMIN_PASSWORD`),写坏等于把部署环打回"凭据过期"那次两天冻结。正确姿势 = 先 `reg` 读整块 → 备份到 `D:\DevEnv\backups\env\` → 只滤掉目标前缀 → **逐条逐字节比对剩余项全等**才 `SetValue` → 写回后**再读再比**,不等即从备份整块还原(本机实测:`IHUI_ADMIN_PASSWORD` 摘前/摘后 SHA 同为 `43CA897ACBFC`,条数 2→1)。② **HKCU 用户级同名键不得摘**:它不是本仓遗留,`~/.workbuddy/skills/serverchan` 与 `~/.agents/skills/serverchan` 的 `SKILL.md` 声明 `env_vars: SERVERCHAN_SENDKEY`、`scripts/send.sh` 直接读它 —— 删了是**删别人工具的凭据**,§5e 说的"本仓代码不再读"从不等于"全机无人读"。同理,孤儿运行态文件(如 `deploy/win/.sct-notify-state.json`,实测 mtime 停在生成方被移除的那一刻、全仓唯一引用是一道**断言它不得存在**的反向测试)可删,而"名字像垃圾"不构成删除依据。
- `apps/api/src/services/alert-notification-service.ts` 的 7 条 IM/pager 腿(钉钉/企微/飞书/Slack/Teams/PagerDuty/generic)**不在本节的摘除范围内**:它是**对外产品能力**(用户给自己的中转站/监控站配告警出口),不是运维到人通道;env 未设 ⇒ 今天不可达,而 email 腿已走 `renderSystemAlertEmail` + `html`(实测 `:29/:448/:471`)。**能力清单的取舍属用户职权,不得按"通道收口"顺手摘**。
- agent 侧长任务完成/阻塞待决策等**交互回复走会话本身**;需要"手机也收到"的事件统一走上述邮件通道。
- **"这条通道是否已摘干净"必须按"服务实际执行的是哪份文件"取径,不得按 `git ls-files`**。判据:`nssm get <svc> AppParameters`(逐个服务),顺着那个路径看内容 —— `deploy/prod-bundle/` 被 `.gitignore:383` 整目录忽略,里面的运行副本**可以完全没有入库源**,对跟踪文件做的 grep 对它零覆盖。实测教训(2026-09-24):两票按跟踪文件做出的"零残留"证明都成立,而 `IHUI-MONITOR` 跑的 `deploy/prod-bundle/monitor.ps1` 仍内联着第三方推送凭据常量与三条纯文本推送通道,其唯一通道当日已被对端配额打死(`monitor-alerts.log` 累计 55338 行推送失败),期间它判出的 `api(8802) 未监听`/公网 500 一封都没到人。现该文件已改为**入库源的转发器**(与 bridge 同一收敛法),真身 `deploy/win/ihui-monitor.ps1`。新写运维脚本若落在 `deploy/prod-bundle/`,必须同时落一份入库源 + 转发壳,否则等于写进盲区。
- 到人链路的**现役生产者清单**(改通道要逐个覆盖,缺一不可):`ihui-alert-bridge`(→`monitoring/alertbridge/alert-webhook-bridge.cjs`)、`IHUI-DEPLOYLOOP`(→`deploy/win/ihui-deploy.ps1`)、`IHUI-MONITOR`(→`deploy/prod-bundle/monitor.ps1` 转发 `deploy/win/ihui-monitor.ps1`)、`scripts/check-credential-health.mjs`、`scripts/git-guardian.mjs`、`.github/workflows/blue-green-deploy.yml`。**改完必须重启对应服务**才生效:PowerShell/Node 都在启动时把脚本读进内存,改文件不动运行中的进程 —— 只 commit 不重启 = 线上仍跑旧逻辑(旧版含每日封顶),而本地一切看上去已修好。
  - **`scripts/git-guardian.mjs` 这一行此前是"设计意图",不是现状**(2026-09-24 补齐):实测该文件里 `mail|smtp|resend|notify|alert` **零命中** —— 它每 2 分钟巡检、判红只落 `.workbuddy/git-guardian.log`,所以"守护发现问题 = 到人"从来不成立。现已接上派发出口(经 `notify-deploy-failure.ts`,不自拼 SMTP,受守门 81 管),按 alert 身份 + 内容指纹 4h 去重、未送达 30min 退避、**无每日总量封顶**,发信失败不改自愈与退出码;核验入口 `--notify-dry-run` / `--notify-test <名>` / `--status` 的 `.notify` 字段。**教训同 §26**:清单里写"某生产者会喊人",必须实测它真有一条到人的出口,否则记账与事实分叉,而分叉形态永远是"安静"。

---

## 6. 验证命令

```bash
pnpm turbo build typecheck lint test          # 全量验证(必须全绿)
pnpm --filter @ihui/api typecheck             # 单独验证后端
pnpm --filter @ihui/web typecheck             # 单独验证前端
cd apps/ai-service && mypy app --ignore-missing-imports --strict   # Python 类型(app 源码路径 apps/ai-service/app,继承 pyproject.toml [tool.mypy])
pnpm dev                                       # 启动所有服务(web + api + ai-service,端口见 docs/port-management.md)
```

---

## 7. 删除/重构安全规则(强制)

删除任何 git 对象(分支/stash/commit/文件)前必须回答:① 该内容承载的**功能**是什么?② 当前 monorepo 中是否有**等价的功能实现**?③ 没有 → **不可以删除**,必须先迁移/开发替代。禁止基于"路径不兼容"或"看起来是垃圾"擅自 drop。stash drop / branch -D 同样适用。

---

## 8. goal 模式工作流(强制)

触发 `/goal <目标条件>` 时按本节流程执行。

### 目标条件硬门槛(单条最大 4000 字符)

必须同时包含:核心任务 + 验证标准(命令退出码/测试输出/文件状态/HTTP 响应)+ 约束边界 + 质量要求 + 异常处理。缺一即拒绝启动。示例见对话上下文。

### 运行时文件(强制)

进入 goal 模式第一轮执行前必须在 `.ihui-agent/goal-runtime/` 创建:

- `STATE.md`:目标条件 + 状态机(`active`/`paused`/`achieved`/`blocked`/`budget_limited`)+ 当前轮次 + Token 累计 + 最近评估结论 + 硬性指标清单。
- `loop-run-log.md`:逐轮追加(轮次号 + 执行摘要 + 工具调用统计 + 评估结论 `yes|no` + 一行理由)。

### 7 步执行循环

1. 目标解析与初始化(拆分硬性/软性指标,初始化 STATE.md)
2. 单轮任务执行(聚焦核心问题,输出执行摘要)
3. 独立评估校验(基于真实结果,禁止模型自评 yes)
4. 循环判定(yes → 第 5 步;no → 续跑;连续 3 轮 no 无进展 → blocked)
5. 最终交付校验(逐条核对硬性指标)
6. 状态清除与交还控制权(输出交付报告)
7. 整合与清理(目标摘要追加到 PROJECT_PLAN.md,删除 STATE.md + loop-run-log.md)

**子命令**:`<目标条件>` 启动第一轮;`(无参数)`/`status` 查询;`pause`/`hold` 暂停;`resume`/`continue` 续跑;`clear`/`stop`/`off`/`reset` 终止清理;`budget <数值>` 设 Token 上限;`log`/`history` 输出日志。

### 红线规则

- 单目标最大自动迭代 **20 轮**,超出 blocked。
- 高危操作(删分支/强推/删库表/影响生产)**必须暂停**请求人工确认。
- 严格围绕目标,禁止扩展需求、做无关重构。
- 每轮**完整承接上下文**(压缩后必须重读 STATE.md)。
- 连续 5 轮工具失败 → blocked。

### 失败回滚

- `blocked` / `budget_limited` 状态下**禁止** agent 自主执行 `git reset --hard` / `git checkout .` / `git clean -f`。
- 必须在 PROJECT_PLAN.md 记录:已修改文件 + 当前分支 + 起始 commit sha + 未完成原因。
- 回滚决策权归属用户。

---

## 9. 多端同步开发强制规则(强制)

- **默认全端连通**:每一个任务默认 8 端(web/api/ai-service/desktop/extension/mobile-rn/miniapp-taro/cli)同步开发,"匹配连通好"= 代码同步(共享 types/UI/schema 跨端一致)+ 链路打通(跨端调用无契约/类型/路由/404 错)+ 验证齐绿(各端 typecheck+build+test 全绿)。禁止只改一端交付、单端验证声明完成、分期交付(平台独占豁免除外)。
- **平台独占豁免需显式标注**:仅天然只属特定端(desktop 系统托盘/extension 上下文菜单/miniapp-taro 微信支付/cli 终端集成/纯文档守门脚本)可豁免,必须在 PROJECT_PLAN.md 标注"平台独占"或"单端文档/脚本",未标注按全端同步执行。
- **多端并行派单**:主 agent 优先用 §11 多 Subagent 并行模式按端拆分,每个 subagent 管自己端的代码+typecheck+build;主 agent 负责跨端契约对齐(共享类型/API 路由/schema)和全链路连通验证,不得下放给单个 subagent。
- **登录/SSO 链路跨端自动同步(强制,2026-09-04 立)**:凡改动登录相关 UI/文案/逻辑,必须**主动**同步所有相关端,不得等用户提醒。关键结构事实:① 共享登录 UI 仅覆盖 mobile-rn(`packages/app/src/features/login/LoginScreen.tsx`),**miniapp-taro 登录页是独立实现**(`apps/miniapp-taro/src/pages/login/login.tsx`),两端都要动;② SSO deep-link scheme:mobile-rn/desktop 用 `ihui://sso/callback`,miniapp-taro 用 `ihui-miniapp://sso/callback`,后端白名单由 `apps/api/.env` 的 `SSO_ALLOWED_DEEP_LINK_SCHEMES` 控制,新增 scheme 必须同步登记;③ web OAuth 中转页 `apps/web/app/(auth)/callback/OAuthCallbackHandler.tsx` 的 `redirect=mobile-rn` 分支负责跳 `ihui://oauth/callback` 回 App(支付宝回调参数为 `auth_code`);④ web 端 SSO 出口页为 `apps/web/app/sso/*`(支持 custom scheme 回跳)。
- **守门**(warn-only):`scripts/check-multi-end-sync.mjs` 检测 staged 跨端分布 4 场景(纯豁免目录→pass;触及 packages/* 未标注→warn;触及≥2 端→pass;触及 1 端未标注→warn),集成于 pre-commit 第 21 项。

---

## 9b. 单分支开发强制规则(强制)

- **禁止创建乱七八糟分支,所有改动统一往 main 合并**。除 main 之外**不允许**新建任何本地/远程分支(`feat/*` / `fix/*` / `hotfix/*` / `add-*` / `rescue/*` / 自定义前缀全部禁止)。
- **唯一例外**:`/goal` 模式目标条件强制要求独立分支时,允许创建 `goal/<目标名>` 临时分支(AGENTS.md §8);`goal/*` 完成后**必须立即删除**,不留历史快照。
- **必要分支判断标准**:**单次任务无法在 main 上原子完成**才允许创建(如 8 端并行多 subagent、紧急 hotfix 需独立回滚通道);**普通功能开发、Bug 修复、refactor、文档/守门脚本改动一律禁止创建分支**,全部在 main 上直接 commit。
- **已合并分支立即删除**:任务合并后**本会话内**完成 `git branch -d <已合并>`(本地) + `git push origin --delete <已合并>`(远程),不留"历史快照"分支污染 main 分支列表。
- **删除未合并分支前必须 tag 备份**(AGENTS.md §22 配套):`git tag backup/cleanup-<date>-<branch> <branch>` → `git push origin --atomic refs/tags/backup/cleanup-*` → 再 `git branch -D`。tag 必须本地+远端双备份,防 git gc 清理。
- **fetch + prune 是日常**:`git fetch origin --prune` 在每个 push 周期跑一次,清理已删远程分支的本地 stale 引用。
- **守门**(2026-07-30 立,2026-08-02 落地):
  - `scripts/check-single-branch.mjs`:检测 `git branch -a` 列表中除 main / upstream 外的分支,发现任意 1 个 → exit 1 阻塞 commit。
  - 集成位置:`scripts/guardian-runner.mjs` id 41(blocking),守门不通过则禁止 commit + push。
  - 豁免:§8 goal 模式临时分支(必须带 `goal/` 前缀,且在 `.ihui-agent/goal-runtime/STATE.md` 标注 `active` 状态才算合法)。
- **历史教训**(2026-07-30 立):仓库曾积累 12 个分支(本地 6 + 远程 7 + 1 upstream),其中 `add-ihui-ai` / `goal/*` / `rescue/*` 等 13 个无价值分支全部已合并或已被 main 覆盖;3 个未合并分支的内容(LLM 三提供商/i18n 五端/console.log→logger/awesome-prs)均已在 main 后续 commit 中包含或演进,merge 会回退 main 功能。教训:**分支不是"工作单元",是"协作单元"**——单 agent 单任务无需分支,直接 main 提交即可。

---

## 10. 交付报告一致性硬约束(强制)

同一份 .md 报告中**不得**同时出现:"无后续建议" / "完整收尾" / "对话可关闭" 与 "P1-P5" / "优化项" / "TODO" / "后续任务"。守门:`scripts/check-delivery-report-consistency.mjs` + pre-commit 第 12 项。

---

## 11. 多 Subagent 并行开发强制规则(强制)

### 任务分配格式(强制)

派发子任务时必须用以下格式,缺一拒绝执行:

```
## 任务目标
<一句话>

## 受影响文件(绝对路径,只允许以下文件)
- <repo-root>\path\to\file1
- <repo-root>\path\to\file2

## 禁止修改
- 任何不在上述清单的文件

## 验证命令(子任务完成后必须自行运行)
- pnpm --filter @ihui/web typecheck
- pnpm --filter @ihui/api test

## 约束边界
- <API 契约/类型/样式/行为约束>

## 交付物
- 完整代码 + 自验通过 + 一句话总结
```

### 联动规则

- 与第 7 节(删除安全)协同:subagent 不得删除非任务清单内文件。
- 与第 16 节(push保护)和 §20 协同:subagent 完成后由主 agent 统一 push。
- **subagent working tree 自检(2026-07-30 立,真实事故)**:subagent 完成任务后**必须**执行 `git status --short` 自检,确认 working tree 状态符合预期——只有任务清单内文件被修改/新增。如果发现意外文件(其他 agent 改动被 `git stash pop` 带回 / lint-staged 副作用 / IDE 自动 stage / 文件被清成 1 行等异常),**立即停止**并报告主 agent,**禁止**继续 commit/push/补救。主 agent 收到异常报告后按 §12 + §22 处理(revert / 隔离 add / `--no-verify` 跳过其他 agent 代码问题)。
- **stash 操作后强制 Read 验证(2026-07-30 立)**:subagent 在执行 `git stash push` / `git stash pop` / `git stash apply` 后,**必须**用 Read 工具验证任务清单内文件内容完整(防止 stash 误操作把文件清成 1 行或吞掉内容)。Read 返回内容与预期不符 → 立即停止,报告主 agent,**禁止**基于未验证的"假设文件完整"继续操作。

---

## 12. 多会话并行操作同一仓库强制规则(强制)

- 多会话/多 agent 在同一仓库并行工作时,**禁止**任何破坏性 git 操作:`git restore` / `git stash push` / `git clean -f` / `git reset --hard` / `Remove-Item` 删除其他 agent 创建的文件(包括"看着像垃圾"的 `commit_msg.txt` / 临时测试文件 / 调试日志)。
- commit 阶段**只 add 本任务相关文件**:`git add <file1> <file2>`,**禁止** `git add .` / `git add -A` / `git add -u`。
- **提交活文档前必须做"工作树 ⊇ HEAD"行级对账(2026-09-24 立,一夜三次自伤换来的)**:`README.md` / `AGENTS.md` / `PROJECT_PLAN.md` 这类多会话共写的文件,工作树副本**常年滞后于 HEAD**(实测分别少 57 / 48 / 54 行),而 `safe-commit` 的 Step ④ 是 `git commit -- <pathspec>` —— 按路径取**工作树**版本,于是"只 add 本任务文件"的规范提交照样把别人已入库的行整批写回旧态,`git status`、diff 行数、typecheck、守门 71 全都看不出来。动作:① 提交前 `node scripts/merge-live-doc.mjs --file <该文档>`(exit 1 = 存在真丢失);② 需归并时 `--apply`(它按锚点把 HEAD 缺失块插回工作树,并区分"被吃掉"与"被就地改写",后者不插回以免新老并存);③ 归并后必须报"仍判 lost = 0 且长行重复新增 = 0"。判据是**字符二元组** Jaccard ≥ 0.6 —— 前缀与按空格切词在中文里都会漏(工具自己栽过一次,README 里一度同时留下 `**第 93 项 X**` 与 `**守门 X**` 两行),已由 `--self-test` 8 例钉死。登记条目见 PLAN 的 O46④/O46⑩。
- **提交活文档前必须做"工作树 ⊇ HEAD"行级对账(2026-09-24 立,一夜三次自伤换来的)**:`README.md` / `AGENTS.md` / `PROJECT_PLAN.md` 这类多会话共写的文件,工作树副本**常年滞后于 HEAD**(实测分别少 57 / 48 / 54 行),而 `safe-commit` 的 Step ④ 是 `git commit -- <pathspec>` —— 按路径取**工作树**版本,于是"只 add 本任务文件"的规范提交照样把别人已入库的行整批写回旧态,`git status`、diff 行数、typecheck、守门 71 全都看不出来。动作:① 提交前 `node scripts/merge-live-doc.mjs --file <该文档>`(exit 1 = 存在真丢失);② 需归并时 `--apply`(它按锚点把 HEAD 缺失块插回工作树,并区分"被吃掉"与"被就地改写",后者不插回以免新老并存);③ 归并后必须报"仍判 lost = 0 且长行重复新增 = 0"。**但提交前的报告有时效边界**(2026-09-24 实测:`merge-live-doc` 报 0 丢失之后、`safe-commit` 落地之前,并发会话又推进了一轮 ⇒ 那次提交仍丢掉 2 条他人登记行)。所以顺序必须是四步:**报告 → 提交 → 立刻 `git show <新提交>^..<新提交>` 做行级对账 → 有丢失就地回补**(发现手段只能是提交后的 diff,`git status` 与提交前那次报告都看不见)。判据是**字符二元组** Jaccard ≥ 0.6 —— 前缀与按空格切词在中文里都会漏(工具自己栽过一次,README 里一度同时留下 `**第 93 项 X**` 与 `**守门 X**` 两行),已由 `--self-test` 8 例钉死。登记条目见 PLAN 的 O46④/O46⑩。
  - **回补过的行还要在"每次收敛/合并之后"复验它仍在 HEAD(2026-09-24 实测该文件第 4 次被顶掉)**:
    并发会话的 union 合并会把别人刚回补的行**再次吃掉** —— 实测
    `packages/shared/src/chat/handoff-package.ts` 的 `i18n-content-exempt-file:` 声明:被 `cfe8f65e4`
    抹掉 → `9e01f6aa9` 原样补回 → 几轮合并后 `git show HEAD:<该文件>` 又是 0 命中。"提交前对账 +
    提交后 diff"两道都保不住它,因为吃掉它的不是回补那次提交。复验是一行的事:
    `git show HEAD:<该文件> | grep -c '<该行稳定前缀>'` 应为非 0,为 0 即重新回补(工作树通常还留着,
    `git diff HEAD -- <该文件>` 立刻可见)。守门 70 的声明式出口是**随行内联**的 —— 行一丢,该文件
    49 处中文立刻判红:红点会等下一个碰它的人来吃,不会静默,但也只有那个人会以为是自己的错。
- 正确流程:预检(`git status --porcelain`)→ 隔离 add 本任务文件 → 验证 staged 仅含本任务文件。
- **任务完成必须自动 commit(2026-09-20 用户指令,强制)**:任务/批次完成且验证全绿后,agent **必须立即自动 commit**——不经询问、不等用户确认、禁止以"不擅自 commit"为由把已验证的工作留在未提交状态。push 仍按 §16/§20 执行(用户未要求时不主动 push)。commit 形态仍受本节约束(多 agent 并行必须 safe-commit.mjs;单 agent 直接 add 声明文件;禁止 `git add .` / `-A` / `-u`)。
- pre-push / pre-commit hook 失败因**其他 agent 引入的代码问题**(schema drift / 其他模块 TS/lint 错误 / 其他 agent 未完成 migration 等,不在本任务范围):**直接用 `--no-verify` 跳过 hook** 完成自己的 commit + push;**禁止**修改其他 agent 代码"帮他们修" / `git reset --hard` / 把"等其他 agent 修复再 push"作为交付结论 / 用 AskUserQuestion 询问用户;自己 commit + push 前只需保证**本任务改动文件** typecheck + lint + build 全绿即可;`--no-verify` 合法场景**仅限**"hook 失败原因是其他 agent 代码",若失败原因是**本任务自己代码**必须修复后正常 commit。

### 强制使用 safe-commit.mjs(2026-08-06 立,真实事故根治)

- **触发背景**:commit `aa15bec23` "fix(web): message-list 消息操作按钮..." 意外包含 `message-input.tsx`(其他 agent 改的 `rounded-t-xl`)。根因:`message-input.tsx` 在 pre-commit hook 执行**前**已被 IDE/其他 agent staged,`takeStagingSnapshot` 把它当成本任务文件,`restoreStaging` 不会 unstage。所有领域级守门(`check-commit-scope` / `check-staged-pollution`)都放过(同目录 `apps/web/src/components/chat/`,scope=web 匹配)。领域级守门**无法防御同目录文件级污染**。
- **强制规则**:多 agent 并行环境(≥2 个 agent 同时工作)下,agent commit **必须**用 `node scripts/safe-commit.mjs -m "<message>" -- <file1> [file2 ...]`,**禁止**直接 `git add <file> && git commit -m "..."`。
- **safe-commit.mjs 5 步法(零信任)**:① `git reset HEAD` 清空整个暂存区(无论谁 staged 的)→ ② `git add -A -- <声明的文件>` 只暂存自己声明的文件 → ③ 校验 `git diff --cached --name-only` === 声明文件(有意外文件立即 exit 1)→ ④ `git commit -- <pathspec>` 原生 pathspec 终极兜底 → ⑤ `git show --name-only HEAD` 验证 commit 内容只包含预期文件。
- **钩子失败的归因是量出来的,不是抄来的(2026-09-25 立,`scripts/lib/commit-gate-attribution.mjs`)**:旧版首次 commit 一失败就打印「按用户规则"hook 失败因其他 agent 代码 → --no-verify 重试"」并整批跳门 —— 它**从未计算过归因**。实测一轮 134 道门 111 通过 / 1 失败,红的是 `check-push-sync`(判远端态、与提交内容无关),措辞仍是"他人代码"。现流程:解析 runner 的失败门清单 → **逐道复跑** → 该门这次的输出**点名本次声明的文件 ⇒ 判"本任务自己的红",拒绝 `--no-verify` 并 exit 1**(必须修);一个都没点名 ⇒ 允许跳,但只说量到的话;批没跑完 / 解析不到 / 复跑全不可用 ⇒ 明写「未归因」,按应急路径落地并留痕于 `.workbuddy/safe-commit-attestation.jsonl`。**刻意不建"机器态门 id 清单"** —— 豁免清单必然腐烂(见 §4 对 `RN_ONLY_BRAND_KEYS` 的教训)。取证:镜像测试 5/5(含装车证明 + 真实 `hook-logs/pre-commit.log` 取样校验夹具)+ 三条变异各自变红(ANSI 剥色那条登记为**等价变异**,不造假具硬凑红)。**因此:agent 不得再假设"钩子红了就能跳"** —— 被拒时那句红点名了哪个文件,就去修哪个文件;确属误判才可按 §16 显式说明后手工提交。
- **单 agent 环境豁免**:确认无其他 agent 并行时,可直接 `git add <file> && git commit`,但必须先 `git status --porcelain` 确认 staging area 干净(无其他已 staged 文件)。
- **pre-commit hook 配套提示层**(2026-08-06 立):hook 入口调用 `auditStagingFiles()` 打印 staged 文件清单(按目录分组)+ 同目录多文件警告 + 文件数 > 5 严重警告(warn-only,不阻塞)。提示层无法真正阻止污染,真正阻止污染的是 safe-commit.mjs 的 `git reset HEAD` 清空暂存区。
- **红线**:
  - ❌ 禁止多 agent 并行时直接 `git add <file> && git commit`(staging area 可能有其他 agent 残留)
  - ❌ 禁止用 `git add .` / `git add -A` / `git add -u`(会把其他 agent 改动一起 stage)
  - ❌ 禁止忽略 pre-commit hook 的 `📋 staged 文件清单审计` 警告(同目录多文件时必须核对)
  - ✅ 多 agent 并行时用 `node scripts/safe-commit.mjs -m "..." -- <files>`(自动清空暂存区 + 只 add 声明文件 + 校验)
- **git 写操作全局锁**(2026-08-06 立,`.git` 损坏事故根治):所有 git **写**操作(commit/push/pull/rebase/merge/stash/checkout/gc/repack/fetch)在同一仓库必须**串行化**,同一时刻只允许一个写操作单元执行。
  - **已自动生效**:safe-commit.mjs 整个 commit 流程自带锁(`Step 0/5 获取 git 写锁`);post-commit 钩子自动处理直接 `git commit` 场景。**agent 无需额外操作**。
  - **手动 git 命令**必须遵守:执行 `git pull` / `git rebase` / `git fetch` / `git checkout` / `git stash` 等写操作前,先 `node scripts/git-lock.mjs check`(exit 0 = 无锁可执行;exit 1 = 有其他写操作进行中,等待后重试)。
  - **禁止手动 `git gc` / `git repack` / `git prune`**:需要时用 `node scripts/safe-gc.mjs`(自动检查无锁后执行)。autoGc 已禁用(`gc.auto=0` + `maintenance.auto=false`),无需也不应手动触发 gc。
  - **锁异常处理(2026-09-18 心跳机制升级)**:持锁方 safe-commit/safe-gc 会 spawn 心跳子进程每 5s 续期 `meta.ts`——**活进程的锁绝不会被抢占**;仅当"锁年龄超 300s **且** 持有者 pid 已死"或超 1800s 硬上限(pid 复用兜底)才强制抢占。锁等待超时(safe-commit 15min / post-commit 3min)报错并提示持有者是否存活;紧急可删 `.git/ihui-git-write.lock`(先确认无 git 写进程)。绕过:`IHUI_GIT_NO_LOCK=1`(仅应急,禁用后自行承担并发风险)。
  - **新环境初始化**:重新 clone 后必须执行一次 `node scripts/git-hygiene-init.mjs`(恢复 gc.auto=0 / maintenance.auto=false 防护配置,这些是 local config,clone 不保留)。

### .git 整目录消失事故链根治(2026-09-10 立,当日 7 次事故复盘)

- **根因**:多会话共享同一工作区时,并发 git 手术互踩——会话 A 重建/删除 `.git` 期间,会话 B 的 git 命令撞上 `.git` 缺失,B 误判"仓库损坏"也触发重建/清理,互相把对方的 `.git` 删掉;refs 写入"被吞"多为重建窗口期读写竞态的表象。
- **强制规则**:
  1. `.git` 异常时**先诊断后动手**:`node scripts/git-lock.mjs check` 确认无其他会话持锁 + `ps`/审计日志确认无并行 git 进程,才允许删除/重建。
  2. 重建**只能**走 `node scripts/git-rebuild-local.mjs`(已接入 git-lock,锁被持有时快速失败),**禁止**手工 `rm -rf .git` + `git init` 自由发挥。
  3. 修复 refs 后必须**回读验证**:`git update-ref ... && git rev-parse <ref>` 输出一致才算成功;批量修复后 `git pack-refs --all` 持久化。
  4. **禁止把 `.git` 迁出工作区/改指针文件**(2026-09-10 已验证:并行会话的恢复逻辑会把指针文件当"损坏"清除,反而制造新事故)。
  5. `git ls-remote` 为远端真值唯一来源,本地 `origin/main` 引用异常时用显式 SHA 操作,勿信本地引用。

### 部署/构建全局锁(2026-08-09 立,并发部署事故根治)

- **事故背景**(8-09 实锤):多 Agent/自动化任务并行触发 `build-next-prod.ps1` 时,两个构建同时备份/清理/写入 `apps/web/.next` → 8801 短暂 502 + 监控报警,产物存在损坏风险。原 `apps/web/scripts/check-lock.js` 只有 dev-vs-build 互斥,**没有 build-vs-build 互斥**;且 `build-next-prod.ps1` 曾引用不存在的 `scripts/check-lock.js`,锁从未生效。
- **锁机制**:`node scripts/deploy-lock.mjs acquire|release|check`(锁 = 项目根 `.deploy.lock` 目录,mkdir 原子性)。build 与 build/dev 全部互斥;dev+dev 共存;stale(10min)+ 超时(10min)自动兜底。
- **已自动生效**:`build-next-prod.ps1` [0/6] 阶段自动 acquire、[7/6] release;web 包 `prebuild`/`predev` 已接入。**agent 无需额外操作,直接跑构建脚本即可**。
- **手动构建必须遵守**:触发 web 构建前先 `node scripts/deploy-lock.mjs check`(exit 0=可构建;exit 1=有其他构建/部署进行中,等待后重试)。**禁止**绕过锁直接 `next build` 或并发触发 `build-next-prod.ps1`。
- **锁异常处理**:超时自动报错;超过 10min 的悬挂锁(持锁进程已死)自动抢占;紧急可删项目根 `.deploy.lock`(先确认无构建进程)。`.deploy.lock/` 已 gitignore。
- **禁止**用 `-CleanCache` 或其它参数绕过锁;多 Agent 协作时若需排队构建,等待而不是强删锁。

### 12b. 协作收尾 SOP (2026-08-18 立, §22c 配套)

当发现其他 agent 正在并行做同一任务时(working tree 与 origin/main 不一致, 或远端新 commit 提到类似功能), 不要立即重写对方主体逻辑, 改走协作收尾路径:

1. **核查现状**: 用 `git diff HEAD --stat` + `git log origin/main..HEAD` 确认
   - 远端是否已 commit (a01fcf4 这种情况)
   - 本地 working tree 是否含对方未提交的改动
   - 对方改动的完整性与正确性
2. **不重写主体**: 仅修复对方代码中的明确缺陷(如测试用例失败、QUIET bug)
3. **最小化改动**: 用 `git add <仅自己改的文件>` 只 stage 自己的改动
4. **--no-verify 跳过**: 因为 hook 会被对方未 commit 的 working tree 改动误判为污染
5. **commit message 标注**: 标题含「(协作收尾)」后缀, 描述中明确
   「不动其他 agent 的主体逻辑」+ 列出具体修复点
6. **push-guard 自动捎带**: push 后 push-guard 会自动捎带其他 agent 的 commit,
   因为 git-pull-rebase --autostash 已同步

### 12c. 并发 commit 防混淆 SOP (2026-08-19 立)

当多个 agent 同时 commit 同一文件时, 可能出现:

- 你的 commit message 描述的是 A, 但 diff 里包含 B 的修改 (race condition)
- 因为另一个 agent 在你 commit 期间 `git add` 了相同/不同文件

防混淆措施:

1. **精确 add**: 用 `git add <具体路径>`, **禁止** `git add .` / `git add -A` / `git add -u`
2. **commit 前验证**: `git diff --cached --stat` 必须与预期文件清单完全一致
3. **commit 后审查**: `git show HEAD --stat` 立即检查 commit 内容, 若含无关文件 → `git reset HEAD~1` 重提
4. **避免同时改同一文件**: 如果发现其他 agent 在改相同文件, 等他完成后再动
5. **接受混合 commit**: 当混合 commit 已 push 到 main 且功能正确, 不要 force-amend, 加一个空 commit 标注"混合 commit 说明"即可

历史案例: d6e8906 + f028e5517b 期间出现"scripts 改动 + api 改动 + mobile-rn 改动"被同一 commit 收录, 后续审计应见此节说明。

### 12d. git worktree 多会话隔离规范(2026-08-31 立,stash 丢失 + 守门误伤事故根治)

- **触发背景**(真实事故链,同日三连):① 多会话共享 working tree,某会话 `git stash push/pop` 冲突导致另一会话已完成的 llm_gateway.py 拦截代码在提交中丢失(提交 diff 只剩 63+/58- 格式化差异);② 守门第 8 项 check-api-routes 全量扫描工作区,104 处"前端调用无后端路由"全部来自其他会话未完成文件,正常提交被阻塞;③ push 门全量 typecheck 报上千 TS 错误全部来自其他会话工作区噪音,推送反复被阻;④ 2026-08-31 补充事故:d22d233091 的 commit message 声称含 §12d 规范但 AGENTS.md 实际 diff 仅 1 行——§12d 本体在提交前被并行会话覆盖工作区而丢失,**commit message 声称的规范条目必须与实际 diff 一致**。根因:**多会话共享同一 working tree + 同一 git index**。
- **第一优先:单写者原则**——同一时刻只允许一个会话写 working tree;并行会话开工前先确认其他会话已收尾(无未提交改动、无进行中 stash)。
- **确需并行写时必须用 worktree 隔离**(与 §9b 单分支规则协同):
  - `git worktree add --detach ../IHUI-AI-wt-<任务名>`(detached HEAD,不占分支名,不违反 §9b)
  - worktree 内正常开发 + commit(本地 sha 可引用;worktree 无 node_modules,hook 必败,可 `--no-verify`)
  - 完成后回主 worktree `git cherry-pick <sha>` 收编,随主 worktree push
  - 收编后立即 `git worktree remove ../IHUI-AI-wt-<任务名>` + `git worktree prune`
- **worktree 内约束**:venv/node_modules 各自安装;端口不得冲突(docs/port-management.md 注册表);共享 DB/Redis 时 schema 迁移互斥。
- **守门兜底(2026-08-31 已落地)**:即使未用 worktree,守门已支持 staged-scope 降级防误伤——① `check-api-routes.mjs`(pre-commit 第 8 项)仅收集暂存区前端文件调用点,暂存区无前端文件→跳过,暂存区为空(手动跑)→保持全量;② 新增 `scripts/check-typecheck.mjs` 包装 push 门全量 typecheck(**判据 = 本次改动范围**:优先 `PUSH_SCOPE_FILES`(pre-push 依 git 传入的 remote_sha..local_sha 计算),暂存区仅兜底;报错文件均不在改动范围内→降级警告放行;解析不到报错文件=tsc 未真正运行→按失败,宁误拦不放过);③ `.husky/pre-push` 第 2 段接入 `node scripts/guardian-runner.mjs --push-gate` 编排。自检:`node scripts/check-typecheck.mjs --self-test`(新增样例 8-12 覆盖 refspec push 与 Next.js 路由组括号路径)。
  - **2026-09-03 push-scope 修复(必读,曾致 push 反复被硬拦)**:原判据只用暂存区,而 `git push <sha>:<ref>` 这类 refspec 推送**不产生暂存区**,若此刻他人也没 staged 文件,降级直接失效 → 他人并行会话的半编辑态报错(实测 miniapp-taro TS1005、web TS2345,单独复验均 0 错误)会硬拦本次 push。故 pre-push 先缓冲 stdin(`PUSH_REFS="$(cat)"`)再回喂 git-lfs,并据 `remote_sha..local_sha` 计算改动文件导出 `PUSH_SCOPE_FILES`;改动文件 >300 时清空该变量退回暂存区兜底(env 有长度上限,截断会漏判→宁可不降级)。同修一处不安全缺陷:tsc 报错正则原排除括号,把 `app/(main)/xxx.tsx` 截断成 `/xxx.tsx`,导致范围内文件匹配不上而**误放行**,现改为「扩展名 + `(\d+,\d+):`」双锚定。
- **全流程已实战演练验证(2026-08-31,主仓零残留)**:worktree add --detach(9785 文件)→worktree 内 commit(--no-verify)→主仓 `cherry-pick --no-commit` 收编验证无冲突→`git restore --staged -- <file>` + 删除文件精准撤销→`git worktree remove` + `git worktree prune`。细则:① cherry-pick --no-commit 验证后**必须立即撤销**,验证/撤销对在同一 git-lock 单元内紧凑完成,防暂存文件被并行会话的 commit 卷入;② 演练/临时文件删除用 `Remove-Item -LiteralPath`(回收站式删除会失败)。
- **应急:主 index 写锁/损坏时用 GIT_INDEX_FILE 旁路提交**(2026-08-31 实战验证,d22d233091 即此法提交):症状为 `fatal: Could not write new index file.`(objects 可写、磁盘充足、无 index.lock)→ 主 index 被外部句柄锁定。手法:`$env:GIT_INDEX_FILE = "$env:TEMP\ihui-index-recover"` 后照常跑 safe-commit 全流程(写入临时 index,主 index 不被触碰);旁路期间 staged-scope 守门读到的暂存区恰为本次声明文件,反而更精准。收尾:`Remove-Item Env:\GIT_INDEX_FILE` 必须清除防污染后续命令;事后 `git reset` 修复主 index(`git write-tree` 应返回非空树)。
- **stash 清理零损失流程(2026-08-31 实例:backup/stash-temp-other-sessions-8e1863c)**:`git tag backup/stash-<名>-<sha7> '<stash-ref>'` → `git rev-parse` 验证 tag 与 stash SHA 一致 → `git stash drop '<stash-ref>'`。tag 指向原 stash commit,内容永不丢失,随时 `git stash apply <tag>` 可恢复。
- **stash 后当日 apply 落地(2026-09-08 立,stash 丢失事故根治)**:任何 `git stash push` 的内容**必须当日 `apply` 落地或 tag 零损失备份**——stash 是黑盒(不提醒/不过期/不可见),滞留 stash 在并行会话合流推进下必然造成"功能被回滚"假象(2026-09-08 实证:压缩入口整合 + IM 聊天室重写 775 行双双滞留 2-3 天)。守门:`scripts/check-stale-stashes.mjs`——guardian-runner 第 30b 项(blocking,≥48h 含源码改动未备份→阻塞 commit)+ dev-web.mjs/apps/web predev 启动 warn 扫描;跳过 `HUSKY_SKIP_STALE_STASH_CHECK=1`。
- **全面禁止 git stash(2026-09-18 立,机制级根治,取代"当日 apply"条——从源头禁止,不再产生新 stash)**:任何情况下禁止 `git stash push` / `git stash`(含路径限定、含 -a/-u),**推了就是要生效**——改动必须直接 commit(走 safe-commit.mjs 多 agent 流程)或用本节 worktree 隔离,绝不允许藏进 stash。已落地 git 层面硬拦截:`.husky/reference-transaction` hook 在 prepared 阶段对 refs/stash 新建事务 exit 1 → `git stash push` 直接 `fatal: reference-transaction hook aborted`(`--no-verify` 也无法绕过;git 无 pre-stash hook,refs/stash 写入走引用事务故可拦)。hook 只拦"新建"不拦"清理"(drop/pop/clear 放行),纯 sh 内建实现不依赖 grep/sed。唯一例外=清理存量 stash:`IHUI_ALLOW_STASH=1` 前缀执行,且必须先按上方零损失流程 tag 备份、在会话报告声明放行原因。
- **红线**:
  - ❌ 禁止一切 `git stash`(2026-09-18 起全面禁止,见上方"全面禁止 git stash"条款,hook 已硬拦截;历史事故:无路径限定全仓快照曾致 stash@{0} 沦为 1781 文件巨型快照)——改动直接 commit 或 worktree 隔离
  - ❌ 禁止在非 worktree 场景用 detached HEAD 承载长期开发(commit 游离无引用)
  - ❌ 禁止 commit message 声称未落盘的规范/代码条目——commit 前 `git show --stat`(或 `git diff HEAD --stat`)核对声称内容与实际 diff 一致(2026-08-31 d22d233091 事故教训)
  - ✅ worktree 收编前 `git log <sha> --stat` 核对内容,收编后 `git worktree list` 确认清理
  - ✅ 怀疑脚本被外部进程(水印/注入)污染时:`node --check` 取证 → `git show HEAD:<path>` 验证基线 → `git restore --source=HEAD --worktree -- <path>` 恢复 → 冒烟(2026-08-31 git-lock.mjs 修复实例:水印进程追加零宽 Unicode 行致 SyntaxError)

---

### 12e. workspace 加依赖禁用 `pnpm install --filter`(2026-09-23 立,自伤实测)

- 实测:为 `apps/extension` 加 `@ihui/design-tokens` workspace 依赖时跑 `pnpm install --filter @ihui/extension`,pnpm 按"只装被选中项目所需"重链接,**顺带剪掉根 `node_modules` 里未被该包引用的链接** —— `lint-staged` 就此消失,`.husky/pre-commit` 第一步即崩,每次 commit 都失败并逼出 `--no-verify`,连带 109 道守门全废(而 `git status` 与 typecheck 都看不出依赖树被削)。
- **规则**:本仓任何"新增/调整 workspace 依赖"一律跑**全量 `pnpm install`**(不带 `--filter`);改完必须验证 `node_modules/lint-staged/bin/lint-staged.js` 与 `node_modules/.bin` 关键入口在位,再提交。
- 排查同类问题的顺序:`grep "Cannot find module" .workbuddy/hook-logs/pre-commit.log`,先怀疑依赖树被动过,再怀疑守门判据。**但"根 `node_modules/.bin` 缺 shim"这一型既不看 package.json 也不报 Cannot find module** —— 它表现为 lint-staged 第一步 `'eslint' 不是内部或外部命令` → 每次 commit 必红 → 各会话合法 `--no-verify` → 约 110 道守门对全队同时失效(2026-09-24 实测连吃三次)。此型 `pnpm install` 与 `pnpm install --force` 都在 1.2 秒内回 "Already up to date"(pnpm 认为树是好的),**上一行那个 remedy 不起作用**;唯一生效的是 `node scripts/repair-node-bin-links.mjs`,且**判据只认实测版本号**:`node_modules/.bin/eslint --version` 与 `tsc --version` 必须都出版本号(或 `pnpm exec eslint --version`)。
- 排查同类问题的顺序:`grep "Cannot find module" .workbuddy/hook-logs/pre-commit.log`,先怀疑依赖树被动过,再怀疑守门判据。

## 13. 文件修改持久化强制规则(强制)

- 任何文件修改后**必须立即用 Read 验证**修改已落地(防止文件系统缓存不一致)。
- 大文件(>500 行)修改后,Read 验证时**必须读取修改区域 ±50 行**,确认上下文完整。
- 若 Read 返回内容与预期不符(陈旧缓存),**必须**重读最多 3 次,仍不符则停止并报告用户。
- **禁止**基于未验证的"假设修改已成功"继续后续操作。

---

## 14. Agent 自主验证强制规则(强制)

- Agent **必须独立完成**它能完成的验证(browser_use / API 测试 / 文件检查 / 命令执行),**禁止**要求用户代为验证。
- **禁止**在交付报告中写"请你刷新浏览器查看效果" / "请你启动 dev server 验证" / "请你手动测试"等甩锅措辞。
- 验证失败时,记录失败原因 + 已尝试方法 + 建议下一步,**不**得假装验证通过。

---

## 15. 工作区卫生强制规则(强制)

**禁止项**:① 在 `G:\` 根目录创建任何文件;② 项目数据(扩展打包/Chrome profile/构建副本/临时 DB/临时配置)写到项目外路径;③ 硬编码 `C:\temp\ihui-*`/`$env:TEMP\ihui-*` 等项目外路径;④ agent 用 RunCommand/PowerShell/Out-File/Set-Content/New-Item 在项目外直接创建文件;⑤ 在 `G:\` 根目录运行 Qt 类外部工具或执行 pnpm 命令(会创建 `.pnpm-store` v11 冲突);⑥ 硬编码中文绝对路径(GBK 乱码)。路径推导用 `$PSScriptRoot`/`__dirname`/`import.meta.url`。唯一例外:纯系统日志(`debug.log`/`next-server.log`)可写 `$env:TEMP`。

**必须用项目内路径**(根 `g:\IHUI-AI`):扩展打包→`apps/extension/.output/chrome-mv3/`;Chrome profile→`.ihui-agent/tmp/chrome-profile/`;临时副本→`.ihui-agent/tmp/<任务名>/`;临时脚本→`.ihui-agent/tmp/<脚本名>.ps1`;临时文件统一放 `.ihui-agent/tmp/`(已 gitignore),任务完成后清理。

**守门脚本**:

- `check-workspace-hygiene.mjs`(第 25 项 BLOCKING:项目外路径写入;WARNING:硬编码中文路径)
- `check-parent-pollution.mjs`(第 26 项 BLOCKING:项目父目录递归 2 层+桌面根级+用户主目录巡查,命中=文件名强信号 `search_*.ps1`/`*_result.txt` 或内容双信号)。**2026-09-23 结构性加固**:新增 `CREDENTIAL_DIR_NAMES` 共 8 项,对 `secrets`/`secret`/`credentials`/`credential`/`密钥`/`certs`/`certificates`/`.pybcrypt` **整目录不扫不删**(目录名按 `toLowerCase()` 比对,大小写不敏感;既往逐 `USER_LEGIT_PATTERNS` 按 filename 豁免已被证明会漏第三把密钥);另新增 `BACKUP_DIR_NAMES` + `BACKUP_DIR_PREFIXES` 整目录豁免,防"卫生守门删掉数据备份"。
- `cleanup-external-junk.ps1`(G:\ 垃圾清理,16 目录+31 文件,`-Force` 跳过确认)
- `g-root-guardian.ps1` v2.0(G:\ 实时守门,FileSystemWatcher+白名单优先 5 层判定,~110-222ms 删除,Windows 计划任务自启)+ 配套 `g-root-blacklist.json`/install/uninstall/status 脚本
- post-commit 自动 `--auto-clean --quiet`(仅清文件名强信号);定时 08:00 巡查;跳过 `HUSKY_SKIP_HYGIENE=1`。**⚠️ `--auto-clean` 对强信号命中直接 `unlinkSync` 实删文件、无任何二次确认** —— 清理类任务的铁律:先跑不带 `--auto-clean` 的 `node scripts/check-parent-pollution.mjs` 看命中清单并逐项验明身份,**命中项落在凭据/密钥目录内或名字含 key/secret/token 的,一律先补豁免再清理,顺序不可颠倒**(2026-09-22 实测用户口令表 `D:/DevEnv/secrets/ihui-app-password.txt` 因 `ihui-` 前缀被判为 agent 垃圾 —— 若不先补目录级豁免而直接跑 `pnpm hygiene:parent:clean`,它**会被无声删除**;该文件现仍完好)。历史案例见 `.ihui-agent/archive/AGENTS_history.md`。

### 15b. 项目外落点唯一制(强制,2026-09-23 立)

用户规定:**任何文件都不得写在项目文件夹之外**,只允许下述四个经批准的落点;不再新增第五个。
禁止在家目录、盘根、`AppData` 下随手建目录 —— 本机曾因此散落 `D:\tmp-*`、`D:\c`、`D:\d`、
`D:\IHUI-AI-backup-*.tar`(8.3GB)等十几个游离项,已收口。

| 落点                                 | 用途                                                                                                                                  | 依据 |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| `D:\IHUI-AI\`(含 `.ihui-agent\tmp\`) | 源码、构建产物、一切临时物                                                                                                            | §15  |
| `D:\DevEnv\backups\`                 | **唯一备份目录**:`git\ sql\ deploy\ archives\ desktop\ pg\ env\ releases\`。项目内不得留备份(`backups/` 曾压 64MB DB 快照,已外迁)     | §15b |
| `D:\DevEnv\{cache,tools,runtimes}\`  | 工具链缓存唯一根;家目录里的工具状态一律 `robocopy /MOVE` + **junction** 改道(禁改 `HKCU\Environment\Path`),旧路径经 junction 仍可解析 | §26  |
| `D:\DevEnv\Temp\`                    | `TEMP`/`TMP`/`TMPDIR`(HKCU,需新开终端才继承)                                                                                          | §26  |

> **上表的 `D:` 是"D 盘那份 checkout"的历史值,不得当本机现值照抄**(2026-09-24 实测,登记于 PROJECT_PLAN —— **本行 2026-09-24 被并发旧基线回写带走过一次,同日原地补注使其重新成为"本侧修改"**
> 第三十三批 续五⑦):`gitArchiveDir()`(`scripts/lib/gitdir.mjs`)按**工作树所在盘**推导,工作树在
> `G:\IHUI-AI` 时它返回 **`G:/DevEnv/backups/git`**;而 `D:\DevEnv`(Temp/backups/kc-tools/logs)与
> `G:\DevEnv`(Temp/backups/cache/tools)**同时存在**,各自服务所在盘上的 checkout。
> **规则:凡脚本需要归档/备份/临时落点,一律 `import` 出口函数(`gitArchiveDir()` / `gitdirArchivePath()` /
> `resolveBackupDir()`),禁止再硬编码盘符** —— 硬编码的结果是"备份落点解析到不存在的路径",
> 表现为 `git-guardian --status` 的 `backupOk:false` 这类静默失效(§5b 已记过一次同型)。

**显式例外与已改道项(改道用 junction,故旧路径仍可用)**:

1. `D:\IHUI-AI-git-repo` —— 真 gitdir。§5b 实测宿主层会整体删除工作区内 `.git`,故必须在外;
   `scripts/git-rebuild-local.mjs:169` 硬编码该路径,`git-refs-heal.mjs` / `git-guardian.mjs` 依赖其
   `refs-manifest.json`。同族的 `IHUI-AI.git-backup-20260912` 与 `IHUI-AI-git-repo.broken-*` 由
   `scripts/lib/gitdir.mjs:250` 按路径主动选读,一律禁删。
   **但"必须在盘根"只是历史状态**:2026-09-23 起,gitdir 的**备份与现场归档**统一落
   `D:\DevEnv\backups\git\`(单一真相源 `gitArchiveDir()` / `gitdirArchivePath()`),
   因为旧写法 `${GITDIR}.broken-<ts>` 每次守护/重建归档都必然在盘根长一个新目录(实测累计 3 个 /
   1.94GB)。盘根因此从 6 项收口到 2 项(项目 + 活 gitdir);回归测试
   `scripts/tests/gitdir-archive-paths.test.mjs`(4 例,含"调用点必须真用该出口"的装车断言)。
   **改这类路径必须同批改 `resolveBackupDir`**:它曾只认写死的 `D:/IHUI-AI.git-backup-20260912`,
   目录一迁走就解析到不存在路径,表现为 `git-guardian --status` 的 `backupOk:false` —— 本地恢复源
   静默失效且无告警(与同日生产部署冻结同属"凭据/路径过期只以下游门禁失败形态出现")。
2. `F:\BaiduSyncdisk\密钥\`(盘符按 §5d 由 `scripts/lib/key-dir.mjs` 探测,不得写死)——模型密钥唯一权威源(§5d),不入仓、不入聊天记录。
3. 第三方 IDE/agent 自管家目录的**运行态**(`~/.workbuddy\binaries\PortableGit` 是
   `scripts/lib/gitdir.mjs:36-37` 解析 git 二进制的首选;`.qoder-cn` 承载本项目记忆与工作区状态)。
   这类不属"我们的产物",只登记、不搬动。
4. `~/.ihui`(1.2MB / 693 文件)—— 我们 CLI 的全局状态,**2026-09-23 已按 §26 的 junction 机制改道**
   到 `D:\DevEnv\cache\userhome\.ihui`(复制后逐文件校验 0 差异 → 删源 → `mklink /J`,**未改一行业务代码、未设任何环境变量**)。
   之所以不用"设 `IHUI_HOME`"这条路:`IHUI_HOME` 当前在本仓有**两套互斥语义** ——
   `apps/cli/src/plugins/paths.ts:31` 当它是**家目录**(再拼 `.ihui`),而
   `apps/cli/src/tools/mcp-oauth.ts:43`、`mcp-credentials.ts:26`、
   `apps/ai-service/app/core/message_history.py:33` 当它是**状态目录本身**;另有
   `workspace-ai-service.ts:38/252/2578`、`workspace-ai.ts:714/730/807`、
   `announcements/index.ts:117`、`refresh-cli-token.mjs:34` 与 `apps/cli` 内约 30 处裸 `homedir()`
   完全不认它。**设 env 必造双根分裂**;junction 则对硬编码路径同样生效。
   语义统一属独立技术债(动它需同步改 `plugin-marketplace.test.ts:114-129` 等被钉死的断言),不在本策略范围。

**新写文件前的三问**:① 是源码/产物吗 → 项目内;② 是备份吗 → `D:\DevEnv\backups\<类>\`;
③ 是临时物吗 → `TEMP`。三者都不是 → 停下来问用户,不得自建新目录。

---

## 16. Push 阶段跨 Agent 改动保护规则(强制)

- 本 agent 完成 commit + push 后,不再触碰 working tree,不执行 `git pull` / `git fetch` / `git rebase` / `git push --force`。
- 抹除其他 agent 改动 → **协作事故**;混入其他 agent 改动到自己 commit → **污染事故**;修改其他 agent 文件"帮他们修" → **越权事故**。
- `--no-verify` 跳过 hook 的合法性:见 §12 最后一条(hook 失败因其他 agent 代码 → 合法跳过;本任务代码 → 禁止跳过);`--no-verify` 不是流程事故,前提是本任务改动文件已通过 typecheck + lint + build。

---

## 17. UI 改动验证强制规则(强制)

**触发条件**:UI 样式/布局/交互改动(CSS/className/style/组件结构/Tailwind 类/shadcn props)。

**强制动作**(缺一不可,违反视为交付事故):

1. 改码前 browser ping `http://localhost:8801` 确认服务在线,不通则先启动 web+api+ai-service(端口见 `docs/port-management.md`)。
2. 改码后确认 web+api 服务在跑(browser 实际访问)。
3. 用 browser_use subagent 渲染目标页面,截图自验 4 状态:默认/hover/active/dark mode。
4. 读 DOM 数值验证样式生效(`getAttribute`/`getComputedStyle`,禁止只靠截图)。
5. 交付附 4 状态截图 + "已自验通过"声明;服务起不来禁止交付。

**commit message trailer**:含 `apps/web/**/*.css` 改动必须附 `Verified-DOM: http://localhost:8801/<path> (<DOM 属性=数值> ...)`,commit-msg hook 自动守门。

**Next.js CSS 缓存陷阱**:改 globals.css/styles 后 HMR 不一定重编译 CSS chunk,必须 curl 当前 CSS chunk 验证新值;`grep -c` 返回 0 → kill 旧 next-server 重启 `pnpm --filter @ihui/web dev`,等 15s 重新 curl 确认。

**工具故障应急**:dev server 永远只在集成终端内部运行(`RunCommand long_running_process`+`blocking=false`),禁止 `Start-Process` 派生独立窗口。RunCommand 连续 2 次返回空输出 → 判定失联 → 告知用户在集成终端面板手动执行。工具反复失败时先 Grep project_memory.md 查已知约束。

**豁免**(允许跳过 browser_use):① 纯后端 API(curl 验证);② 纯类型/工具函数(typecheck+test);③ dev server 30 分钟无法修复(降级单元测试);④ CI 环境(e2e)。历史案例见 `.ihui-agent/archive/AGENTS_history.md`。

---

## 18. 启动项目语义(强制)

用户说"启动项目" = 前后端全链路同步启动:web + api + ai-service(端口见 `docs/port-management.md`),必要时检查并启动数据库 / Redis。禁止只启动前端就交付。

---

## 19. i18n 约束规则(强制)

### 翻译文件语言纯度

- **zh-CN.json**:基准语言文件,其他 4 语言必须 parity(key 集合完全一致)。
- **zh-TW.json**:繁体中文,禁止简体字(pre-commit 第 2b 项,opencc 字形转换检测,阻塞)。
- **ko.json**:韩语,禁止中文残留(第 2c 项,字符范围检测,阻塞)。
- **ja.json**:日语,禁止中文残留(第 2d 项,warn-only,日文汉字词易误报)。
- **en.json**:英文,禁止中文残留 + 禁止破碎机翻(第 2e 项,阻塞)。

### JSON 重复键禁止

- 同一对象内禁止重复 key(`JSON.parse` 时最后一个生效,前面被 shadowed)。
- 添加新键前 Grep 确认同级命名空间无同名块(models/nav/sort/market 等高频命名空间尤需注意)。

### 翻译策略(source of truth:`scripts/brand-glossary.json`)

- 品牌名/公司名/字体名/技术术语:优先 canonical 英文名(智谱清言→Zhipu AI, 宋体→SimSun, 物联网→IoT)。
- 人名:fictional/示例数据用拼音(李思涵→Li Sihan / 리쓰한 / リ・スハン);称呼符合目标语言习惯(李总→이 대표)。
- 占位符 `{var}` / `{{var}}` 必须原样保留。
- zh-TW 用繁体字形(简体→繁体);ko 用 Hangul;ja 汉字词允许(登録/確認/削除)但简体字残留改日文习惯;en 禁破碎机翻(如 AgentDevPlatform)。

**守门工具**:`scan-i18n-zh-residue.mjs <locale>`(zh-TW/ko 阻塞,ja warn)/ `check-i18n-broken-en.mjs`(en 破碎机翻,阻塞)/ `check-i18n-keys.mjs --staged`(key 完整性+parity+白名单+**含点键**+**同层重复 key**,后两项 2026-09-20 起阻塞)/ `brand-glossary.json`(canonical 映射表)+ `apply-brand-glossary.mjs [--dry-run]` / `i18n-diff.mjs`(差异检测,输出 pending.json)/ `i18n-apply.mjs [--check]`(应用器,按 zh-CN 重排 key+parity 校验)/ `check-i18n-namespace-passing.mjs`(检测 useTranslations('xxx') 限定命名空间 + 把 t 传给 @ihui/ui-react 共享登录组件的 bug 模式,warn-only)。

**AI 翻译流水线**(强制,零用户算力):zh-CN.json 新增/修改 key 后必须执行:① `i18n-diff.mjs` 检测差异生成 pending.json;② AI agent 读 pending.json+brand-glossary.json 自行翻译;③ 写 i18n-translations.json(`{ translations: { [lang]: { [key]: value } } }`);④ `i18n-apply.mjs` 应用到 4 语言;⑤ `check-i18n-keys.mjs` 验 parity;⑥ `scan-i18n-zh-residue.mjs ko/zh-TW` 验无残留。

**守门集成**:web(第 2f-web 项 blocking,仅 staged 涉及 zh-CN.json 时);miniapp-taro(第 2f-miniapp-taro 项 blocking,`--target=miniapp-taro`);多 agent 并行时其他 agent 改 target locale 不触发阻塞。

---

## 20. 任务完成硬定义 — 杜绝"commit 后忘记 push"协作事故(强制)

### 任务完成的硬定义(5 条全满足才可声明"完成")

1. ✅ **本地有 commit**:`git log --oneline -1` 显示本次任务的 commit SHA
2. ✅ **工作区干净**:`git status --short` 无本任务残留 untracked / modified
3. ✅ **origin 同步**:`git push origin <branch>` 成功,stdout 含 `X..Y <branch> -> <branch>`
4. ✅ **HEAD 对齐**:`git rev-parse HEAD` === `git rev-parse origin/<branch>`
5. ✅ **守门脚本通过**:`node scripts/git-push-guard.mjs` exit 0

### 4 道自动防线

1. **pre-commit**:`check-push-sync.mjs`(guardian 第 29 项 blocking),commit 前检测本地 ahead(`git rev-list --count origin/<branch>..HEAD`),>0 阻塞;跳过 `HUSKY_SKIP_PUSH_SYNC=1`(不推荐);归档 commit `IHUI_ARCHIVE_COMMIT=1` 豁免。
2. **post-commit(主防线)**:`git-push-guard.mjs` 自动检测 ahead → push + 验证 local == remote,失败阻断提示手动 push;跳过 `HUSKY_SKIP_PUSH=1`(不推荐)。
3. **pre-push**:`.husky/pre-push` 第 2 段跑 `guardian-runner --push-gate`(2026-08-31 改版 / 2026-09-03 push-scope 增强:check-typecheck.mjs 包装,**判据优先 PUSH_SCOPE_FILES 本次推送改动范围,暂存区兜底**——报错文件均不在改动范围内时降级警告放行,防并行会话工作区噪音误伤,见 §12d),失败阻止 push(commit 仍本地保留);跳过 `HUSKY_SKIP_TYPECHECK=1`(不推荐)。
4. **手动兜底**:`node scripts/git-push-guard.mjs` 任何时候可手跑,打印 local vs remote HEAD,完全对齐 exit 0。

### 红线(违反视为协作事故)

- ❌ 禁止 commit 后只输出"已 commit"就声明任务完成,必须 push + 验证
- ❌ 禁止交付报告遗漏 "local HEAD == remote HEAD" commit SHA 对照
- ❌ 禁止用 `--no-verify` 绕过 `git-push-guard`(除非 typecheck 自验通过且显式说明)
- ❌ 禁止把 "git push 失败" 作为交付结论(必须修复后重推或显式说明阻塞原因)

### 交付报告必含证据

```
## Git 同步证据
- 本地 commit: <sha>
- origin commit: <sha>
- 同步状态: local == remote ✅ / 落后 N 个 commit ⚠️
- 守门脚本: node scripts/git-push-guard.mjs exit 0
```

### 工具失联处理流程

- **触发条件**:RunCommand 连续 ≥2 次返回 `{Exited, exit_code 0, 空输出}`(连 `Write-Output "test"` / `git --version` 都无输出),判定平台级故障。
- **红线**:禁止把 git 命令清单甩给用户作为交付物;禁止把"用户手动执行"作为完成结论;禁止用"工具失联"停止 retry;必须自己完成 commit+push+验证;工具失联时报告"blocked"状态不声明完成;工具恢复后立即执行 git 流程;唯一例外是用户主动说"我来手动执行"。
- **retry 策略**:首次失联用 `Write-Output "alive-test"` 探测 → 每隔 1-2 轮 retry RunCommand(可派 subagent 尝试) → 持续 retry 不放弃 → 恢复后立即执行完整 git 流程(add → commit → push → git-push-guard 验证)。
- 历史案例见 `.ihui-agent/archive/AGENTS_history.md`。

---

## 21. 功能开发同步更新 README 规则(强制)

### 触发条件

任务**新增 / 修改 / 删除**以下任一类别能力:

- 新功能模块(新增 P3 深度层 / IM 渠道 / 沙箱后端等)
- 现有功能重大调整(API 路由变更 / 架构重构 / schema 迁移)
- 守门规则 / 工程约束新增(本节本身即触发例)
- 项目对外能力清单变化(支持的平台 / 厂商 / 模型 / 端)

### 强制动作(缺一不可,违反视为交付事故)

1. **同步修改根目录 `README.md`**:在对应章节(功能特性 / 架构 / 平台支持 / 守门规则)更新文字 + 表格。
2. **README 改动必须与本任务代码同 commit 提交**:禁止"代码先 push、README 下一轮补"的分期模式。
3. **README 必须可被 git 远端可见**:commit + push 后 `git rev-parse origin/main` 必须包含 README 改动(由 §20 git-push-guard 自动验证)。
4. **交付报告必须含 "README 更新证据"**:列出修改的章节 + 行数变化。
5. **禁止以"下一步建议"形式把 README 同步留给下一轮**:本任务触发条件则 README 同步属本任务一部分,不得列为 P1/P2 遗留项或"最优下一步建议",违反视为交付事故。

### 豁免场景(允许不更新 README)

- 纯 bug 修复(不改变对外能力)
- 纯重构(不改变功能契约)
- 纯测试 / 文档 / 守门脚本改动(不改变运行时能力)
- 纯配置 / 依赖升级(不改变功能清单)
- 单端内部优化(不改变跨端契约)

### 守门(warn-only)

- `scripts/check-readme-sync.mjs`:staged 中有 `apps/` / `packages/` 下功能代码改动但 `README.md` 不在 staged → warn 提醒。
- 集成位置:`.husky/pre-commit` 第 22 项(warn-only,不阻塞 commit,只提醒)。
- 历史案例见 `.ihui-agent/archive/AGENTS_history.md`。

---

## 22. 防止 commit / push / merge 提交丢失硬性规则(强制)

### 触发背景(2026-07-25 立,真实事故)

reflog 记录 18:12-18:20 期间发生 **6 次 `reset: moving to HEAD~` 操作**,导致 3 个本地 commit 在 main 历史中消失:

- `15b984f90` "fix(api): P0 安全债并行修复"(ws-chat/ws-tasks IDOR + payment-gateway 金额反查)
- `5ef36e59d` "fix(web): sidebar 折叠按钮图标 16→20px" 第一次
- `b120c6e20` "fix(web): sidebar 折叠按钮图标 16→20px" 第二次

幸运的是这 3 个 commit 的工作内容已通过后续 commit(`ce3116ebd` merge + `ff7f744e0` 重做)重新整合到 origin/main,但 commit 本身已不可追溯,git log 不再显示原始 commit hash。

**根因**:多 agent 并行 + 某 agent 自动化流程使用 `git reset` 时,未考虑对其他 agent 本地 commit 的影响,导致 reset 把整个 commit 链(包括其他 agent 的工作)一并丢弃。

### 硬性规则(违反视为协作事故)

1. **禁止**在共享分支(任何已 push 过的分支,包括 main)使用 `git reset --hard`。
2. **禁止**使用 `git reset HEAD~N` / `git reset --soft HEAD~N` 撤销本地 commit(在多 agent 并行环境下,该 commit 可能被其他 agent 依赖)。
3. **禁止**使用 `git push --force` / `git push --force-with-lease`(已 push commit 的"撤销"必须用 `git revert`)。
4. **撤销已 push 提交必须用 `git revert`**:产生新 commit 撤销改动,保留原始 commit hash,所有 agent 都能看到完整历史。
5. **撤销本地未 push commit 推荐 `git revert`**(同样产生新 commit 保留历史);仅在确认 commit 内容无价值、且无其他 agent 引用时,才考虑 `git reset`(不推荐,需记录在 commit message)。
6. **禁止** `git stash drop` / `git stash clear`,除非先 `git stash show <id> --stat` 确认 stash 内容已合并到 working tree 或其他 commit;lint-staged 自动创建的 stash 必须保留至少到 commit 成功后下一次 git gc 周期(默认 14 天)。
7. **多 agent 并行 reset 前必须**:`git log --all --oneline | grep <other-agent-commit-sha>` 确认无其他 agent 引用;并在 `PROJECT_PLAN.md` 记录"reset 影响范围 + 已 tag 备份的 commit hash"。

### 已被 reset 丢失的 commit 永久记录(tag 备份)

3 个被 reset 的 commit 已用以下 tag 永久保留(防止 git gc 清理):

- `lost-commit/P0-security-debt` → `15b984f90`(P0 安全债)
- `lost-commit/sidebar-fold-btn-1` → `5ef36e59d`(sidebar 按钮第一次)
- `lost-commit/sidebar-fold-btn-2` → `b120c6e20`(sidebar 按钮第二次)
- `backup/pre-drop-recovery` → `251956eb6`(恢复前主分支快照)

可通过 `git show <tag-name>` 查看完整 commit 内容;`git tag -l "lost-commit/*"` 列出所有丢失 commit tag。

### 守门(blocking 升级已完成,2026-07-25)

`scripts/check-commit-loss-guard.mjs`(guardian-runner 第 30a 项,2026-07-25 升级为 blocking):

- ✅ **已升级 blocking**:`guardian-runner.mjs` 第 30a 项以 `node scripts/check-commit-loss-guard.mjs --blocking --filter-stash` 调用
- pre-commit 前扫描 `git reflog --all --date=iso` 最近 50 步(2026-07-26 扩),检测是否含 `reset: moving to HEAD~` 模式
- 扫描 `git fsck --unreachable --no-reflogs` 检测是否有悬空 commit
- 5 段检查流程(2026-07-26 强化):reflog reset / fsck 悬空 / lost-commit tag / backup tag / 远程 tag 完整性
- **仅远端 tag 已改为自愈式(2026-09-24)**:另一台机器推来的 `lost-commit/*` / `backup/*` tag 本地缺失时,本门自己 `git fetch --no-tags origin refs/tags/<t>:refs/tags/<t>`(分批 50、超时 60s,`IHUI_TAG_HEAL_MAX` / `IHUI_TAG_HEAL_TIMEOUT_MS` 可调),再 `git pack-refs --all --prune` 固化 —— 松散嵌套 `refs/tags/<ns>/*` 会被宿主清理层删掉,**不 pack 等于下次再红**(§5b)。拉回来即不红;离线 / 无凭据 / 超时只降级为警告并写明原因。理由:东西在**远端**、本地少一个引用根本不是 commit 丢失风险,而恒红的唯一结局是人人 `--no-verify`,把真正防丢的三条一起废掉。`reset` 检测 / 未备份悬空 commit / tag 对象不可达 **仍然 blocking**。
- 镜像测试 `scripts/tests/check-commit-loss-guard.test.mjs`(26 例)含端到端装车证明:本地 bare origin +「另一台机」推 tag → 守门须 exit 0、tag 必须真回到本机(证明不是"干脆不看远端"糊过去)、且落在 packed-refs。
- 发现 reset 操作或未备份悬空 commit → exit 1,阻塞 commit
- **悬空 commit 备份**:被 reset / drop 的 commit 一旦出现在 `git fsck --unreachable` 输出中且无 `lost-commit/*` tag 备份,即为"未备份悬空 commit",会阻塞 commit——需先执行 `git tag lost-commit/<name> <hash> -m "lost via reset"` 永久保留(防止 git gc 清理),再重新 commit
- 紧急跳过:`HUSKY_SKIP_COMMIT_LOSS_CHECK=1 git commit ...`
- 详细档案:见 [docs/lost-commit-archive.md](./docs/lost-commit-archive.md)

### 自动化 tag 同步(2026-07-26 立)

`scripts/sync-lost-commit-tags.mjs`(本任务新增)+ `.husky/post-commit` 第 5 段集成:

- **自动 push**:每次 commit 后自动 `git push origin --atomic refs/tags/lost-commit/* refs/tags/backup/*`,防止本地 git gc 清理 tag 后无远端备份
- **手动 fetch**:`node scripts/sync-lost-commit-tags.mjs --fetch` 一键从 origin 拉回所有 lost-commit/backup tag
- **手动 check**:`node scripts/sync-lost-commit-tags.mjs --check` 校验本地+远端 tag 一致性 + tag 对象可达性
- **package.json scripts**:`tag:sync` / `tag:sync:check` / `tag:sync:fetch` / `tag:sync:push`
- **紧急跳过**:`HUSKY_SKIP_TAG_SYNC=1`
- **触发背景**:2026-07-26 04:23 真实事故 — 本地 tag 被 git gc 清理,远端虽有但 fetch 失败(因为 fetch 默认不包含 tag,需要明确 refspec)
- **详细档案**:见 [docs/lost-commit-archive.md](./docs/lost-commit-archive.md) "🛡️ 防护机制" 段

**改道完整性已由机器看守(2026-09-24 立,守门 `check-home-junctions.mjs`)**:上面那三条人肉命令长期
等于没有校验 —— 实测 `AppData\Roaming\npm` 长成 **2.05GB**、`AppData\Local\pnpm-cache` **758MB** 都是实体目录
(同期 `~\.ihui`、桌面端两处 `com.ihui.desktop` 早已是 junction ⇒ 机制有效,**缺的只是回潮哨兵**)。
该门登记 16 项工具态,判三条:存在却不是指针 = `REAL-DIR` 红(且必须量出体积,否则报告写成"合计约 0 MB"的
假小量级)、指针目标不可达 = `DANGLING` 红、登记表被过滤空 = `EMPTY-REGISTRY` 红;非 Windows 如实报"未判定"
不计通过。**第三方 IDE 自管态(`.workbuddy`、`.qoder-cn`)刻意不进登记表** —— 由镜像测试反向钉死,
防止有人把它们加进来逼后人去挪别人的运行态(挪 `.qoder-cn` 等于丢记忆)。
同日已按 §26 机制把这两处收口(镜像复制→逐文件字节校验→源改名→`mklink /J`→经 junction 回读一致→才删源),
C 盘可用 44G → **45.75G**。

**但"能判"不等于"能修"(2026-09-24 补第二层)**:门 96 上线后当天,`D:\DevEnv\cache\userhome` 整棵被清
(13:15 前后,同分钟 `cache/Temp/tools` 被重建),16 项登记里 **已改道 0 / 违规 9**、4770MB 回到 C 盘。
门判红是对的,可它是 **blocking** 而修复只有人肉五步 —— 结果是**每一次提交都被逼成绕过钩子**,
一次绕过等于约 110 道守门对该提交全部作废(§12e 同型)。恒红门的唯一结局就是没人再守门。
所以补了幂等修复器 `scripts/re-home-junctions.mjs`( `--check` / `--apply` / `--reset-dst` / `--self-test` ):
登记表**复用门 96 的 `registryOf()`**、D 盘根**复用 `seal-c-root-stray` 的 `devEnvRoot()`**,不另立第二份表、
不写死盘符;流程仍是"镜像复制 → 逐文件(相对路径 + 字节)校验 → 源改名 → `mklink /J` → 经 junction
回读一致 → 才删源",任一步不符一律回退(源在校验通过前一字不动);robocopy 返回码 ≥8 视为失败。
**两条实测教训**:① 复制语义必须与校验语义一致 —— 要带 `/XJ /SL`,否则源内部的重解析点被 robocopy
展开成真实文件,而指纹两侧都跳过重解析点,永不收敛(`.cargo` 四轮稳定差 13 个即此;**我第一版把它
误报成"目标正被持续写入",是判据错、不是世界错**);② 被进程占用(EBUSY)的项由修复器自己记
30 分钟冷却,免得守护每 2 分钟重抄一遍 108MB 去撞同一个失败。触发点挂在 `git-guardian` 的
`healHomeJunctions()`(与 `healRootSeal` 同位、**早退之前**;每日 03:00 体检兜不住 23 小时空窗)。
实测:9 项违规 → 8 项已改道并逐字节校验一致(含 `.cargo` 947MB/21760 文件);剩 `~\.codex` 被别的会话
正在跑的 `codex-windows-sandbox-service` 占用 ⇒ 进冷却,该服务退出后 2 分钟内自动补回,**不杀别人的进程**。

**第三层:悬空目标必须能重建,冷却不得拦住人工窗口(2026-09-24 同日补,前向更正上面最后一句)**
上面"该服务退出后自动补回"是**错的**:`CodexSandboxService.OpenAI.Codex` 是 StartMode=Auto 的
LocalSystem 服务(实测 PID 6196,exe 在 `WindowsApps\OpenAI.Codex_*` 里、**不在 `~\.codex` 内**),
它**永不退出**,所以"等它释放"等于无限期恒红。处置是把窗口**造出来**而不是等:停服务 → `--apply` →
`finally` 里无条件启回 → 复核(服务 `Running`、事件日志 15 分钟内无 codex 相关报错、`Get-Item -Force`
的 `Attributes` 含 `ReparsePoint` 且 `Target` 指向 D 盘)。实测 **5732 个文件逐字节校验一致后改道**,
门 96 从"违规 1 / C 盘 108.8MB"到 **违规 0 / exit 0**。动手前必须先确认**只有该服务自身**匹配 codex
(无并发 CLI/IDE 会话),否则不 stop。

补这一层时暴露了两个真缺陷,都由自检抓出(不是演练抓的 —— **演练只能证明"会红",判据才证明"不会修"**):

1. **`repairOne` 的判序**:第一行是 `if (!existsSync(srcPath)) return 'absent'`,而**悬空 junction 的
   `existsSync` 返回 `false`**(它跟随重解析点,目标已被删)。于是"源不存在、无需改道"把这一整型吞掉,
   表现就是上面演练里"守护跑完什么都没补"。门 96 自己判的是 `!existsSync(p) && !isLink(p)`(两半都有),
   修复器只抄了前半 ⇒ **同一个判据在两处必须同形**,否则一边判红、一边判无需修,合起来是恒红且永不自愈。
   现判序改为先 `isLink`(lstat);并把"指针指向与登记表算出的目标不一致"单列 `link-moved` **判红交人工**,
   不擅自改指向 —— 那等于替人决定数据落点。
2. **冷却吞掉人工窗口**:第一次 `--apply --no-cooldown` 之前,上一轮 EBUSY 留下的 30 分钟冷却把服务
   已停好的窗口判成了"跳过"。故加 `--apply --no-cooldown`:**绕过判定但保留既有条目**(守护侧仍需拦住
   "每 2 分钟重抄 108MB 再撞同一个 EBUSY"),且本轮再失败时**不再续冷却**,否则下一个人工窗口照样被拦。
   两处都由镜像测试用正则钉死(`scripts/tests/re-home-junctions.test.mjs`),因为它们是行为分支,不是注释。

### 历史案例

`.ihui-agent/archive/AGENTS_history.md` 记录每次 reset 事故 + 已采取的 tag 备份措施。

---

## 22b. staged-typecheck 闸门:全量 include + 错误过滤(2026-08-18 立,根治改版)

### 触发背景

pre-commit 第 16 项「条件 typecheck 闸门」原策略:临时 tsconfig 只 include staged 文件 → 模块扩展(declare module 'fastify' 等)未被加载 → 报 TS2339 假阳性(如 `pushNotification` / `isMultipart` / `file`)。多 agent 并行时,任何 agent 改一下 ws-notifications.ts 都会让其他 agent 的 web 包 typecheck 失败 100% 误阻塞。

### 核心策略(根治)

`scripts/check-staged-typecheck.mjs`:

- **临时 tsconfig 沿用 package 原始 tsconfig 的【全量 include】**,完整加载所有模块扩展与全局类型,消除 TS2339 假阳性。
- **tsc 输出按行解析**,只把【错误文件属于 staged 文件】的错误视为失败;其他 agent 引入的非 staged 文件错误自动过滤、不阻塞。
- tsc 未能真正运行(如 pnpm/tsc 未找到、进程崩溃、空输出)按失败处理,**禁止静默通过**。
- 临时 tsconfig 清理加重试(Windows transient file lock 兼容);`.gitignore` 已加 `**/tsconfig.staged-typecheck.json` 防残留误入库。

### 守门集成

- `scripts/guardian-runner.mjs` 第 16 项 blocking(已有调用 `node scripts/check-staged-typecheck.mjs --staged`)
- 跳过方法:`HUSKY_SKIP_STAGED_TYPECHECK=1 git commit ...`(应急)
- 适用范围:任意 staged .ts/.tsx 文件(不限 apps/web)
- 自动跳过:apps/ai-service(Python,走 mypy)、apps/desktop(无 typecheck script)、packages/eslint-config / packages/tsconfig(纯配置包)等无 typecheck script / tsconfig 的 package

### 红线规则

- ❌ 禁止把临时 tsconfig 的 include 缩窄到 staged 文件(会回退到旧 partial-include 假阳性 bug)
- ❌ 禁止把 `**/tsconfig.staged-typecheck.json` 从 .gitignore 移除(Windows 偶发 unlink 失败可能残留)
- ❌ 禁止把 `sawAnyTscError` 移除(若 tsc 未能真正运行,必须按失败处理,不能静默通过)
- ✅ 修改 `filterTscOutputForStagedFiles` / `getOriginalInclude` 时必须同步更新 `scripts/tests/check-staged-typecheck.test.mjs`(镜像常量同步锚点:源脚本第 298-327 行 / 244-256 行)
- ✅ 修改源脚本 `check-staged-typecheck.mjs` 的核心函数时,必须同步:
  1. 测试文件 `scripts/tests/check-staged-typecheck.test.mjs` 中的镜像常量
  2. 跑 `scripts/check-staged-typecheck-mirror-sync.mjs` 验证指纹一致

---

## 22c. 镜像常量守门模式规范(2026-08-18 立)

### 背景

部分核心工具脚本(如 `scripts/check-staged-typecheck.mjs`)导出大量内部辅助函数,而测试文件 `scripts/tests/*.test.mjs` 由于路径隔离 / 模块副作用 / 静态导出冲突等原因,**无法直接 `import` 源函数**。沿用"测试文件里复制一份相同实现的镜像常量"做法虽然能跑通断言,但形成两套并行真相:任何对源函数签名的修改(参数顺序、返回值结构、过滤规则常量)必须**手动同步**到测试文件;一旦遗漏,测试将持续"假绿"(通过旧逻辑断言已不存在的字段),守门形同虚设。

### 根治路径(三步)

1. **源函数 export**:把核心函数从源脚本顶部 export 出去,确保测试环境可解析(注意 `.mjs` 必须用 `export` 关键字,且不引入副作用代码)。
2. **测试直接 import**:测试文件 `import { __test__ as <别名> } from '../source.mjs'`,消除"两份真相"。
3. **守门脚本检测 export 锚点**:`scripts/check-staged-typecheck-mirror-sync.mjs` 持续校验:
   - 源文件必须存在并 export `__test__` 对象
   - `__test__` 必须包含指定的函数键(本场景:`getOriginalInclude` / `normalizePath` / `filterTscOutputForStagedFiles`)
   - 测试文件必须存在对应 `import { __test__ as ... } from '../source.mjs'` 语句
   - 任意锚点缺失即 exit 1 报错(提示"镜像常量漂移,需走 §22c 协作收尾")

### 守门脚本工作机制(`check-staged-typecheck-mirror-sync.mjs`)

- **阶段 A · 检测源文件存在**:确认 `scripts/check-staged-typecheck.mjs` 存在于工作区(防止路径漂移)。
- **阶段 B · 检测 export const **test** 锚点**:用正则匹配 `export const __test__ = { ... }`,并校验三个键 (`getOriginalInclude` / `normalizePath` / `filterTscOutputForStagedFiles`) 均出现在对象字面量中(防止 export 但漏字段)。
- **阶段 C · 检测测试文件 import**:确认 `scripts/tests/check-staged-typecheck.test.mjs` 存在 `import { __test__ as ... } from '../check-staged-typecheck.mjs'` 语句(防止 import 路径写错 / 别名错配)。
- **触发场景**:任何对 `check-staged-typecheck.mjs` 的核心函数修改后,pre-commit hook 自动跑该守门脚本;若 export 锚点漂移,立即阻断 commit 并提示同步测试 import。

### 可复用模板

检测模式(正则 + 字符串匹配 + import 锚点)可复用到其他类似场景:

```javascript
// 伪代码:三阶段检测模板
const source = readFileSync('scripts/<source>.mjs', 'utf8')
assert(source.includes('export const __test__ = {'), 'phase B: missing __test__ export')
const requiredKeys = ['funcA', 'funcB', 'funcC']
for (const k of requiredKeys) assert(source.includes(`${k}:`), `phase B: missing key ${k}`)
const test = readFileSync('scripts/tests/<source>.test.mjs', 'utf8')
assert(
  /import\s*\{\s*__test__\s+as\s+\w+\s*\}\s*from\s*['"]\.\.\/<source>\.mjs['"]/.test(test),
  'phase C: missing __test__ import in test file',
)
```

可复用到:任何"测试文件无法直接 import 源函数"的工具脚本场景(如 `scripts/check-commit-scope.mjs` / `scripts/check-staged-pollution.mjs` 等)。

> 📌 配套使用: 本模板的入口守护需搭配 §22d `isDirectRun` 模式使用, 避免 import 时 main() 误触发。

### 红线规则

- ❌ 禁止在测试文件中**复制**源函数实现(产生镜像常量漂移风险)
- ❌ 禁止修改源函数签名后**不更新** `__test__` 对象的导出键(守门立即失败是预期行为,不是 bug)
- ❌ 禁止删除 `check-staged-typecheck-mirror-sync.mjs` 中的任何一项锚点检测(削弱守门强度)
- ✅ 修改源函数后必须 `pnpm test scripts/tests/check-staged-typecheck.test.mjs` + 跑 mirror-sync 守门脚本双验证
- ✅ 新增工具脚本若需要被测试直接 import,必须遵循"源文件 export `__test__` + 测试 import + 守门脚本三阶段检测"模板

---

## 22d. `isDirectRun` 模式规范:ESM 脚本"双形态"入口守护(2026-08-18 立)

### 背景

部分 `.mjs` 工具脚本(如 `scripts/check-staged-typecheck.mjs`)需要同时支持两种使用形态:

1. **CLI 直接执行**:`node scripts/foo.mjs`(命令行手动跑 / pre-commit hook 调用 → 必须自动执行 `main()`)。
2. **模块被 import**:`import { __test__ } from './foo.mjs'`(测试文件复用导出符号 → **绝不**触发 `main()` 副作用)。

ESM(`.mjs`)模块与 CJS(`.cjs` / `.js` + `"type": "module"`)的求值模型:**顶层代码仅在被 import 时执行一次**,但**直接 `node foo.mjs` 时同样会执行顶层代码**。这意味着 — 如果脚本顶层直接写 `main().catch(...)`,测试一旦 `import` 该模块,就会**连带触发 CLI 主流程**(批量跑 typecheck、写临时 tsconfig、调 git diff),把测试环境搞炸,或更糟 — 在测试用例之间留下真实副作用(临时文件未清理、staged 状态污染)。

### 根因:`import.meta.url` vs `process.argv[1]`

- **`import.meta.url`**:ESM 模块加载器注入,恒为**当前模块文件**的 `file://` URL(无论是被 import 还是直接 node 执行,值都相同:指向 `foo.mjs` 自身)。
- **`process.argv[1]`**:Node 启动时传入的第一个脚本参数,只在**直接 node 执行**时等于本模块路径;被 import 时为 undefined 或与本模块无关。

因此判定**"本模块是不是被直接 node 执行"** 可用:`import.meta.url === pathToFileURL(process.argv[1]).href`。两者相等 ⇒ 直接执行,触发 `main()`;否则 ⇒ 被 import,跳过副作用。

> ⚠️ **跨平台陷阱**:Windows 路径是反斜杠 `C:\foo\bar.mjs`,不能直接拼成 `file://` URL,否则 `import.meta.url`(始终是标准 `file:///`)与字符串永远不匹配。**必须**经 `node:url` 的 `pathToFileURL()` 归一化。

### 可复用模板

在 `.mjs` 脚本**底部顶层**(所有 export 之后)粘贴以下 4 行(已适配 Windows / Linux / macOS,推荐用项目现存形式而非手写字符串拼接):

```javascript
import { pathToFileURL } from 'node:url'

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  main().catch((e) => {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  })
}

export const __test__ = {/* 暴露给测试的核心函数 */}
```

位置约束:

- `__test__` 的 `export` 必须放在 **`if (isDirectRun)` 之后**(否则 ESM 提升可能在测试 import 时机前完成,语义仍正确但不直观;且与 §22c "镜像常量守门" 的 `import { __test__ as ... }` 锚点要求一致,便于 grep)。
- `main()` 自身声明应保持文件靠前位置(便于阅读),`if (isDirectRun)` 仅触发调用,**不**延迟或重写 `main`。
- `process.exit(2)` 复用 §22b 中"异常 vs 失败"的退出码约定(2 = 脚本自身异常,1 = 业务失败)。

### 与 §22c 的关系

`isDirectRun` 是 **§22c 镜像常量守门模式的使能条件**。没有它,§22c 的"源文件 export `__test__` + 测试 import"做法会因为 `main()` 顶层自动执行而不可行 — 测试一旦 import 就会触发 CLI 主流程,副作用污染测试环境(写临时文件、调 git 改 staged 状态、写控制台横幅噪音),`vitest` / `node --test` 都会在 setup 阶段立即崩。`isDirectRun` 把"CLI 入口"和"模块导出"两种用法的副作用隔离开,使 §22c 的 export / import 双真相消除得以落地。

两者协作的最小工作流:

1. 源 `.mjs` 脚本加 `isDirectRun` 守护(本节模板)。
2. 源脚本 export `__test__ = { fn1, fn2, ... }`(§22c 第 1 步)。
3. 测试文件 `import { __test__ as X } from '../source.mjs'`(§22c 第 2 步)— 因 `isDirectRun=false`,`main()` 不执行,仅拿到导出对象。
4. 守门脚本 `scripts/check-staged-typecheck-mirror-sync.mjs` 三阶段检测 export / key / import 锚点(§22c 第 3 步)。

### 红线规则

- ❌ 禁止在 **CommonJS / `.cjs`** 脚本中使用 `isDirectRun`(`.cjs` 没有 `import.meta`,需走 `require.main === module` 判定,本规范不适用;混用会导致 `SyntaxError: Cannot use 'import.meta' outside a module`)。
- ❌ 禁止把 `main()` 写成**同步函数**后用 `if (isDirectRun) { main() }`(同步抛错会抛出 toplevel,无法被 `.catch` 包裹,且 ESLint `no-top-level-await` 外的同步 throw 在 Node 18+ 表现不一致;必须保持 `main()` 是 `async` 或返回 `Promise`)。
- ❌ 禁止手写字符串拼接 `import.meta.url === 'file:///' + process.argv[1]` 替代 `pathToFileURL`(Windows 反斜杠永远不匹配,直接判定失败 → CLI 永不触发 main → 静默失控)。
- ❌ 禁止把 `isDirectRun` 守卫放到 `main` 函数**内部**(局部守卫无法阻止其他顶层 import 时副作用已执行的部分,如顶层模块加载就跑了 git diff / 写了临时文件)。
- ❌ 禁止把 `export const __test__` 移到 `if (isDirectRun)` **之前**且不放 `export`(否则测试 import 时拿到 undefined,§22c 守门 phase B 立即失败 — 这是预期行为,不是 bug)。
- ✅ 修改源脚本的 `main()` 调用约定时必须同步 §22c 守门(双验证 `pnpm test` + `node scripts/check-staged-typecheck-mirror-sync.mjs`),否则 `__test__` 导出语义与 import 时机解耦,可能让测试在 CI 通过而在本地 import 时副作用泄漏。
- ✅ 新增任何"需要双形态(CLI + import)"的 `.mjs` 工具脚本,必须沿用本节 4 行模板 + §22c export 规范,**不**为单次用例复制粘贴变体。

---

## 23. `.gitignore __*` 规则静默忽略 `__tests__/` 目录教训(强制)

### 触发背景(2026-07-25 立,真实事故)

`.gitignore` 第 154 行 `__*` 规则(本意是忽略"Agent 临时脚本",如 `__round1.log` / `__audit_dump`)会**静默忽略**所有以 `__` 开头的路径,包括合法的 `__tests__/` 测试目录。**关键陷阱**:`git status` 对 ignore 的文件**完全不显示**(既不 untracked 也不 modified),开发者肉眼完全看不到。

### 真实事故(2026-07-25 阶段 13 集成测试)

集成测试 subagent 在 `apps/web/__tests__/storage-adapter.test.ts` 写完测试文件,本任务合 stage 13 计划清单:

- 创建文件 → `git status` 不显示
- 编辑文件 → `git status` 不显示
- 准备 commit 时,`git add __tests__/` → 无任何文件可加(`__*` 规则吞掉)
- 险些导致整个 stage 13 测试集成**永久丢失**;直到最后 `git check-ignore -v apps/web/__tests__/` 才追查到 `__*` 规则源头

修复方法:把目录重命名为 `tests/`(避开 `__*` 规则)→ 后续 16 个 `__tests__/` 目录已审计,**全部未被 `__*` 规则命中**(未含 `.gitkeep` 且 `git check-ignore` 返回空),本任务仅作为守门+教训记录,不要求批量迁移。

### 硬性规则(违反视为事故)

1. **项目内测试目录必须用 `tests/`**(推荐)或 `spec/` / `__tests__/` + `.gitkeep`(不推荐);**禁止**新建无 `.gitkeep` 的 `__tests__/` 目录。`__tests__/` 命名只在"目录内全部文件被故意 ignore + 留 `.gitkeep` 占位"时使用。
2. **创建测试目录前必须** `git check-ignore -v <path>` 确认不被 ignore(空输出=安全,非空=被命中);`__` 前缀目录需逐个验证。
3. **CI / pre-commit 必跑** `node scripts/check-test-paths.mjs`(本任务新增,§守门脚本速查),命中 `__tests__/` 无 `.gitkeep` 且被 gitignore 吞掉 → 阻塞(退出码 1)。

### 守门脚本:`scripts/check-test-paths.mjs`

- 扫描 `apps/` + `packages/` + `scripts/` 下所有 `__tests__/` 目录
- 每个 `__tests__/` 调 `git check-ignore -v` 复核 + 检查 `.gitkeep`
- 同时检测 `*.tmp` / `*.bak` 目录 + 非白名单隐藏目录
- exit 0 (无阻断) / exit 1 (有 `__tests__/` 被吞掉阻断项)
- 详细用法:脚本头部 docstring

### 关联案例

- 阶段 13 集成测试 subagent:险些丢失 `apps/web/__tests__/storage-adapter.test.ts`
- 历史事故:曾出现"测试写了不显示 → commit 漏文件 → CI 假绿"模式,本节规则根治

---- **2026-07-26**:Commit 丢失防护机制强化。本地 lost-commit/* tag 被 git gc 清理事故暴露后,新增 sync-lost-commit-tags.mjs 自动 push + fetch 机制,创建 docs/lost-commit-archive.md 永久档案,check-commit-loss-guard.mjs 升级为 5 段检查(reflog 50 步 + 远程 tag 校验 + tag 对象可达性)。

---

## 24. 新增功能须用户确认强制规则(强制)

### 触发条件

任务类型 ∈ {新增功能模块 / 新增 API 路由 / 新增页面 / 新增端能力 / 新增对外能力清单 / 在 PROJECT_PLAN.md 中无对应条目的自发性功能开发}。

> 判定"新增功能"而非"修改/修复"的核心标准:**是否引入了 PROJECT_PLAN.md 当前任务清单之外的新能力**。是 → 触发本规则;否(属于现有功能的修复/重构/优化/适配)→ 不触发。

### 强制动作(缺一不可,违反视为越权事故)

1. **暂停开发**:识别到"新增功能"意图后,**禁止**直接动手写代码,必须先用 `AskUserQuestion` 工具向用户确认是否开发该功能。
2. **明确边界**:确认问题必须包含 ① 功能目标一句话描述 ② 受影响范围(端/文件/契约) ③ 是否纳入 PROJECT_PLAN.md(及其优先级 P0/P1/P2)。
3. **等待显式同意**:用户回复"同意/可以/做吧/开发"等肯定语义后才能开始;用户回复"不用/暂缓/先不做"则**禁止开发**;模糊回复需再次确认。
4. **补登记 PROJECT_PLAN.md**:用户同意后,将该功能追加到 PROJECT_PLAN.md 对应优先级末尾(遵循 §1),再开始编码。
5. **commit message 前缀**:新增功能 commit 用 `feat:` 前缀(§1 已规定)。

### 红线(违反视为协作事故)

- ❌ **禁止**未确认直接开发新功能(包括"顺手加一个"、"我看这里缺个"、"我加个小特性")。
- ❌ **禁止**把新功能伪装成"修复/重构"绕过确认(如新增路由写成"重构路由文件")。
- ❌ **禁止**在 `/goal` 模式下借目标执行之机擅自扩展目标范围外的新功能(违反 §8 红线"严格围绕目标,禁止扩展需求")。
- ❌ **禁止**用"已写完了,你看下要不要保留"代替事前确认。

### 豁免场景(允许不确认直接开发)

- **用户在本轮对话已明确要求开发该功能**(如"帮我加个 XXX 功能"、"做个 XXX")——用户意图已显式,无需再次确认。
- **/goal 模式目标条件内包含的功能**(目标已包含 = 已确认)。
- **纯 bug 修复 / 重构 / 类型修复 / 测试 / 文档 / 配置**(不引入新能力)。
- **守门脚本 / 工程约束自身的增量**(本节即触发例,属工程治理而非业务功能)。
- **PROJECT_PLAN.md 已有条目的细化执行**(任务已登记 = 已确认范围)。

### 与其他规则协同

- 与 §8(goal 模式)协同:goal 模式下不得借目标扩需求,新增功能必须先暂停 goal 询问用户。
- 与 §9(多端同步)协同:用户确认新功能后,默认按 8 端同步开发,除非显式标注"平台独占"。
- 与 §21(README 同步)协同:新功能开发必须同 commit 更新 README(§21 触发条件命中)。
- 与 §7(删除安全)协同:新功能开发中如需删除/重构现有代码,仍遵循 §7 三问。

---

## 25. `verify-*.mjs` / `verify-*.ts` 临时验证文件归档规则(强制)

### 触发条件

Agent 在调试 / 验证 / 探查某项功能时,常在 `apps/web/` / `apps/api/` 等源码根目录随手写一个 `verify-xxx.mjs` 脚本(如 `verify-permission-popover-v2.mjs` / `verify-permission-popover-v3.mjs` / `verify-login-tabs.mjs`)快速跑一次。这类临时文件**禁止**提交到 git,必须归档到 `.ihui-agent/tmp/<任务名>/`。

### 强制动作(缺一不可,违反视为协作事故)

1. **临时文件必须放 `.ihui-agent/tmp/<任务名>/`**:例如 `.ihui-agent/tmp/perm-popover-debug/verify-v2.mjs`。
2. _*禁止放 apps/* 根目录_*:`apps/web/verify-*.mjs` / `apps/api/verify-*.ts` 等位置**严禁** commit。
3. **禁止放 .ihui-agent/ 根目录**:`.ihui-agent/verify-*.mjs` 与守门脚本混在一起,难追溯。
4. **路径推导用项目内路径**:`$PSScriptRoot` / `__dirname` / `import.meta.url`,不写硬编码绝对路径(§15 卫生规则)。
5. **任务完成后清理**:`rm -rf .ihui-agent/tmp/<任务名>/`(已 gitignore,自动忽略)。
6. **commit 阶段禁 add**:`git add <本任务文件>`(§12 多会话保护),**禁止** `git add .` / `git add -A` 一次性把所有 verify-*.mjs 加进去。

### 红线(违反视为协作事故)

- ❌ **禁止** `apps/web/verify-*.mjs` 等源码根目录临时文件 commit(会被守门脚本警告 + 污染 main 分支)。
- ❌ **禁止** 用 "这是为了验证 XXX 功能" 借口把临时文件 commit 进来。
- ❌ **禁止** 留 `verify-v1.mjs` / `verify-v2.mjs` / `verify-v3.mjs` 等版本号后缀文件(版本号在 git history 里有)。

### 豁免场景(允许放源码目录)

- 守门脚本:`scripts/check-*.mjs` / `scripts/verify-*.mjs`(正式工具,有 README/CLI/help)。
- 测试文件:`*.test.ts` / `*.spec.ts` / `tests/` / `__tests__/`(符合 §23 测试目录规则)。
- 长期保留的 E2E 脚本:`scripts/e2e-*.mjs`(已纳入 CI,有意保留)。

### 守门脚本:`scripts/check-verify-tmp-files.mjs`

- 扫描 `apps/*/verify-*.mjs` / `apps/*/verify-*.ts` / `scripts/verify-*.mjs`(白名单外)
- 发现任意 1 个 → 警告(不阻断,只提示)
- 集成位置:CI / guardian-runner 后续项(暂 warn-only,后续按需升级 blocking)
- 退出码:0(有警告但通过)+ 输出警告列表

### 与其他规则协同

- 与 §12(多会话并行)协同:`git add` 阶段只加本任务文件,不批量加 verify-*.mjs。
- 与 §13(文件修改持久化)协同:Read 验证 verify-*.mjs 的修改生效。
- 与 §15(工作区卫生)协同:临时文件必须项目内路径(`.ihui-agent/tmp/`),不写 `G:\` 根目录或 `C:\temp\`。
- 与 §23(测试目录)协同:`verify-*.mjs` 命名 ≠ 测试文件,不能伪装成 `*.test.mjs` 绕过守门。

---

## 守门脚本速查(pre-commit 项,按类别)

- **i18n**(2/2b/2c/2d/2e/2f/2g-web/2f-mobile-rn/2f-cli):check-i18n-keys(parity+白名单)/ scan-i18n-zh-residue(zh-TW/ko 阻塞,ja warn)/ check-i18n-broken-en(阻塞)/ i18n-diff(翻译流水线,2f-web + 2f-miniapp-taro 阻塞)/ check-i18n-namespace-passing(命名空间传递,warn)/ check-cli-i18n-parity(cli 端 parity,warn,2f-cli)
- **代码质量**(1/3/4/4b/4c/5/6/7/8/9/10):API key 泄露 / schema drift / 陈旧 dist / UTF-8 完整性 / lint-staged / sanitizer / dedupe / 路由一致性 / safeParse(warn)/ OpenAPI(info)
- **UI/样式**(11/11b/17/18/20/24a/24b/27/28/36/102):圆角 / 圆角溢出(父 rounded + 子 bg 贴边,warn,2026-08-06 立)/ CSS token / title tooltip / Tailwind 冲突 / 侧边栏宽度+端口注册表(warn)/ z-index 层叠+遮罩 z-index(阻塞,id 27/28,2026-09-22 加固:补 skipEnv + onFailHint,并在 id 27 新增第 5 项两组契约——桌面端自绘窗口控制三按钮挂 z-max(10003) 不能降(须高于 resize 抓手 z-loading=10000),`z-modal` 遮罩永远盖不到它,故等效压暗层 `data-window-controls`+`data-window-controls-dim` 与失焦非活动态 `data-window-inactive` 两组标记缺一不可,**两态弱化/瞬时规则必须写在 `apps/web/app/globals.css`**(入口 CSS 变更必然重编译;实测生产构建里组件内 Tailwind 任意变体未进 CSS 产物);判据有效性自查 `--self-test`;紧急跳过 HUSKY_SKIP_Z_INDEX_GUARD / HUSKY_SKIP_OVERLAY_ZINDEX)/ miniapp-taro design-tokens 同步(阻塞,防 app.css 漂移)
- **工程约束**(12/13b/13c/15/19/21/22/23):交付报告 / PLAN 体积(warn)+防误删 / 迁移完整性 / staged 污染(warn)/ 多端同步(warn)/ README 同步(warn)/ staged 清单(info)
- **Push/工作区**(25/26/29):项目外路径(阻塞)/ 父目录污染(阻塞)/ Push 同步(阻塞)
- **防提交丢失**(30a):reflog reset 检测 + fsck 悬空 commit 检测 + lost-commit/* tag 备份清单(AGENTS.md §22 配套,blocking);**仅远端 tag 缺失走自愈 fetch + packed-refs 固化,拉不动才降为警告**(2026-09-24)
- **对话流元素覆盖**(57):锚点 / SSE 契约双端 / 清单条目三条判据(blocking);**判仓库内容而非共享工作区快照** —— 已暂存取索引 blob、仅工作树脏取 HEAD blob,别人未提交的重写不得钉红无关提交(2026-09-24,与守门 77 同取向)
- **凭据外泄对账**(67):非 2xx 响应**不经** `response-sanitizer`(其 496 行 `statusCode<200||>=300` 直接 return payload),故把上游响应体拼进 error message 是脱敏旁路。判据 = **A∧B ＋ C/D/E/F 至少一条**:**A** 错误构造上下文含 4xx/5xx 响应 **与 `throw new Error(...)`/`XxxError(...)`** 两类(service 层走后者);**B** 外泄形态 = `JSON.stringify(X)` **或整对象插值** `${x}` / `${x.slice(…)}`(字段投影 `${json.error}` **不算**,那是推荐写法);**C** 凭据语义(变量名/声明右侧/对象 key/message 字面量命中 `token|secret|credential|password|api_?key|bearer|access_token|refresh_token|id_token`);**D/E 来源证据**:不认变量名,沿 `X=(await R.json()|R.text())` → `R=await fetch('<令牌端点>')` 回溯,以路由注册行为处理器边界、窗口 ≤40 行,越界放弃(宁漏不误报);**F 关键词兜底**:被调方是 **SDK 而非 fetch** 时 URL 不在文件里(D/E 结构上够不到),改以「消息自带凭据端点关键词(`AssumeRole`/OAuth/`device/code`/`gettoken`/`tenant_access_token` …)∧ 整对象被倒进 message(目标路径末段为 `body`/`data`/`payload` …)」双条件命中,单条件一律不判。其余非令牌端点的错误体透传只进低置信候选不计失败(现 30 处,含经 `callVendor`/`cozeRequest`/`callLuyala` 转发的动态 URL,调用点 path 均为推理接口;`throw` 形态新增的 4 处已逐个读明:1 处即下述 STS 真缺陷,3 处不含凭据——明细见 README 守门 67 节)。成因:同日实测出**五处**同族真缺陷——IMS 令牌体进 502(`tokenData`,C 抓)、GitHub `/login/device/code` 体进 400(变量名 `json`,`device_code` 按 RFC 8628 §1.5 是 bearer 凭据,C 全盲靠 D)、PayPal `/v1/oauth2/token` 原始文本进 `throw`(**既非 stringify 也非 status(),靠 A 扩展 + E**)、阿里云 STS `AssumeRole` 的 `response.body` 进 `throw`(走 SDK 无 URL 字面量 → 靠 F)、腾讯云 `oss-sts-service.ts` 的兜底 `errMsg = … ?? JSON.stringify(result)`(成功体含 TmpSecretKey / Token,且是"上行取体下行拼"的两行式 → 靠 F 的变量链配对)。**教训:每一代判据只会漏掉自己形态之外的那一种**,四通道是叠加不是替换;名字类判据必然漏掉名字最无辜的那一处。修这类缺陷**严禁**用加 `skipResponseSanitization` 消红——那是关掉脱敏保护。覆盖 **JS/TS 与 Python 两套语法**(`.py` 亦在 `apps/` 扫描内):`json.dumps`、f-string `{x}` / `{x[:200]}`、`raise XError(...)`、`status_code=4xx`、`#` 注释豁免都是独立的语法锚点,缺一条该语言整条空转;F 通道的关键词与 dump 只认两种配对:**同行**,或**关键词行插值的变量其声明右侧就是那记 dump(两行式)**;整窗任意配对会产出假阳性(实测 cnblogs/oschina/segmentfault 三处),已各留正反用例钉住。`--staged` 只收窄文件清单、内容一律读工作树(与 lint-staged 同形态),index 与工作树错配由 30c/65 负责。紧急跳过 `HUSKY_SKIP_CREDENTIAL_LEAK_IN_MESSAGE=1`,自检 `node scripts/check-credential-leak-in-message.mjs --self-test` + `node --test scripts/tests/check-credential-leak-in-message.test.mjs`
- **适配层接线**(64):miniapp-taro `adapters/*.taro.tsx` 未被 adapters **目录外**源文件从 adapters 路径 import 即拦截(blocking,2026-09-22 立)。补 `check-adapter-style-parity.mjs` 只守硬编码颜色、不守"是否被 import"的缺口——9 个屏级适配器 3078 行"造好没装车"直到删除始终无闸可挡,即本条成因。存量基线已清零(`scripts/adapter-wiring-baseline.json` = `unwiredAdapters: []`),任何新增未接线适配器一律直接拦截;判据必须限定 specifier,否则端内同名自有组件(`components/NavBar.tsx` 等)会造成假阳性放过死代码。紧急跳过 `HUSKY_SKIP_ADAPTER_WIRING=1`,自检 `node --test scripts/tests/check-adapter-wiring.test.mjs`
- **Python 类型**(35):mypy 检查(阻塞,防 ai-service Python 类型回退)
- **依赖治理**(38):solito 幽灵依赖回归守门(阻塞,防 P0 优化被回退)
- **迁移完整性**(39):mobile-rn screen 迁移守门(阻塞,防独立实现回升,白名单:Debug/DevEnter/SharedDemo/profileMenuData)
- **共享层重复**(40):端内重新实现 shared hook/util 检测(阻塞,防端内独立实现回升,白名单:web/useChat + web/useAuth + web/useAgentRuntime + web/useClipboard + web/useNotificationStore + mobile-rn/useAuth + mobile-rn/useNotificationStore(后二者均为 re-export wrapper + 平台 adapter,属 §3 允许形态;守门的 re-export 判定只看 export 那一行有无 `from`,函数型 wrapper 必须显式登记))
- **条件**(16/16b):staged-typecheck(任意 staged .ts/.tsx → 全量 include + 错误过滤,2026-08-18 根治);packages/database/src staged → build(脚本:check-staged-typecheck.mjs,详见 §22b)
- (16c):check-staged-typecheck-mirror-sync(源/测镜像漂移防御,blocking,AGENTS.md §22b 配套,2026-08-18 立)
- **React 事件闭包**(42):check-event-closure-leak(异步回调闭包访问 SyntheticEvent 属性检测,blocking,AGENTS.md §42 配套,2026-08-12 立)
- **桌面弹窗防护**(52):check-no-visible-spawn(派生控制台程序漏 `windowsHide` 检测,blocking,AGENTS.md §5b 机器级根治配套,2026-09-20 立;`--self-test` 14 例 + §22c 镜像测试)
- **工具名本地化**(55/56):check-tool-name-display-coverage(注册表 `_TOOLS` × 词表 × 五语言 taskStatus 三方比对,blocking,拦"新增工具不补功能名");check-tool-display-resolvable(91 个功能名在 shared + 5 端合并视图 + 小程序离线包逐语言解析,拦两类静默失败:端内取词缺键回显 `toolReadFile`、忘跑 `pnpm gen:i18n` 致离线包过期;`node --test scripts/tests/check-tool-display-resolvable.test.mjs` 自检)。紧急跳过 `HUSKY_SKIP_TOOL_NAME_COVERAGE=1` / `HUSKY_SKIP_TOOL_DISPLAY_RESOLVABLE=1`
- **快捷键声明与归属对账**(69):check-declared-shortcuts.mjs(blocking,2026-09-22 立并注册)——两类红点:① "声明未绑"(UI 标了 `Ctrl+X` 而全仓无处理器,含注册表"有键无消费者");② "同键被他功能接走"(`field` 类声明与全局注册表同键,但声明方拿不出持有证据;成因是 `view-switcher` 曾把 document/browser/figma/code-changes/agent 五项标成 `Ctrl+1-5`,而该族键位实际切 AI 对话模式)。合法证据三选一:本文件出现该条目 `event` 引号字面量 / 本文件自有同键 handler + `stopPropagation`(独占截断,`RichTextEditor` 的修法)/ 条目自身与注册表同义镜像(命令面板原样列出全局键位)。**刻意只认 `field`**:`<kbd>`/正文常合法描述**别的表面**的键位,纳进必假红。全量审计 `node scripts/check-declared-shortcuts.mjs`,自检 `node --test scripts/tests/check-declared-shortcuts.test.mjs`,紧急跳过 `HUSKY_SKIP_DECLARED_SHORTCUTS=1`
- **硬编码中文基线棘轮**(70):scan-hardcoded-zh.mjs(blocking,2026-09-22 接线)—— 扫 `apps/web/{app,src/components,src/hooks}` + `packages/{ui-react,shared}/src` + 2026-09-24 补的三端(`apps/mobile-rn/src`、`apps/extension/{entrypoints,src,lib}`、`apps/cli/src`),排除注释/metadata/useTranslations 行/admin/测试。**每文件命中数与基线额度比较**(`scripts/hardcoded-zh-baseline.json`):只拦"比基线更多",存量债(886 文件 / 13090 行)冻结、新增即拦;清理后 `--update-baseline` 下调额度(必须人工确认后再跑,禁止为过门而调高)。该脚本 2026-07-20 即存在但从未接入守门链,是"造好没装车"的第二个实例(第一个是同一批的 69)。`--staged` 由 runner 自动下发(runner 传 `--exit 1`,不带该参数时**永远 exit 0** —— 集成测试踩过),暂存集为空时回退全量防"空暂存恒绿"。**两处同日修**:① 14 例镜像测试自 §15「ROOT 由脚本自身位置推导」起 **13/14 恒红** —— 测试靠 `cwd` 定位夹具而脚本按定义忽略 cwd,14 例全在扫真仓(不是判据错,是调用方式失效);加 `--root <dir>` 显式测试通道(生产不带,语义不变)后 15/15 绿。② 命中判定漏剥**行尾 `//`** ⇒ PriceChart / TerminalTab / TerminalStatusIndicators 各多出 2/1/1 处假阳,把它们顶过基线额度、把本门钉成"谁碰这三个文件谁被拦";同时修 `'https://x/*'` 这类串内 `/*` 骗进块注释状态机的假绿。**遗留已消除(2026-09-25 实测复核)**：全量模式的取材口径**已改为判 HEAD blob** —— `scan-hardcoded-zh.mjs` 现有"磁盘/索引/HEAD 三种取材共用一份判据"(约 :204 行注释与实现)，实测 `node scripts/scan-hardcoded-zh.mjs` 全量**越线文件数 = 0**。本段此前写的"全量模式按共享工作树判 ⇒ 同一份 HEAD 代码干净检出报 1 个、本机工作树报 281 个"是**已修状态**，保留原话只为说明那一型为什么会发生；**下一个接手者不必再做这件事**，若要复核判据请跑上面那条命令看末行现值。（另记 `heal-worktree-tracked` 的刷新面仍在扩大，两件事互补不互替。）紧急跳过 `HUSKY_SKIP_HARDCODED_ZH_GUARD=1`
- **计划登记行防丢**(71):check-plan-line-loss.mjs(blocking,2026-09-22 立,`stagedTriggers=PROJECT_PLAN.md`)—— 共享工作区里并发会话按"内存中那份旧计划文档"整文件提交,会把别人**已入库**的登记行按旧基线回写掉(2026-09-22 一小时内两次发生,本会话 10 条 G-152/G-166/D107b 进度行被抹)。既有 13c `check-project-plan-archive.mjs` 只认 `### XXX(已完成 ✅)` 任务标题行,条目内 bullet 登记行不在其视野,故补此闸。**登记编号族含 `G-x`/`Dx`/`Px`/`Wx` 与 `守门 NN`**(2026-09-23 补最后一族:各道闸门在计划里的登记行用的正是 `**守门 NN …**` 前缀 —— 实测一枚并发暂存版本整块删掉别人的守门 72 登记(40 行),只认 G/D/P/W 完全看不见);自愈结论一律写 `.workbuddy/plan-heal.log`(旧版丢 `/dev/null` 配 `|| true`,再叠加未 `.trim()` 的 sha,自愈静默失效一整天)。判据按**编号标记的原文前缀**在待提交内容里全文搜:整行消失 → 拦;只改写文案、保留编号 → 不报(不误伤正常编辑);原文能在 `.ihui-agent/archive/PROJECT_PLAN_*.md` 找到(§1 归档)→ 放行。写闸过程中真修掉一个自造假阳:标记若按"编号 + 后续文本"重拼,`D107b` 会被拆成源文本里不存在的 `D107 b`,使正常提交被误判丢失。自检 `node scripts/check-plan-line-loss.mjs --self-test`(9 例正反成对,含 missingFrom 双目标比对);**自愈面**:`.husky/post-commit` 第 6 段每次提交后扫最近历史自动回捞(并发会话 routinely 用 `--no-verify` 绕过 pre-commit,故这一层必须有),手动 `--heal` 只写工作区、`--heal --commit` 顺带前向提交(基线一律取 HEAD,不代收别人未提交的内容)。**2026-09-23 两处加固(都是"本地全绿也发现不了"那一类)**:① 自愈比对改成**工作区与 HEAD 分别判缺失** —— commit-tree 旁路(`git-sync-converge` 索引层合并、临时索引提交)**不跑钩子**,它把已入库行从 HEAD 合掉时共享工作区常还留着那行,单目标会"无缺失"提前返回 → HEAD 永久缺行(本次 G-154 登记行即此因),现由 converge 落合并提交后就地补跑一次自愈;② `rev-parse`/`hash-object` 未 `.trim()`,尾部换行使 `read-tree` 报 `Not a valid object name`,**自愈提交自上线起从未成功过**,而 post-commit 写作 `|| true` 所以毫无声响 —— 判据只能在**独立仓库**做端到端取证才暴露(临时 repo 造一次真旁路合行 → A/B:旧版判"无缺失",新版识别并建前向恢复提交)。跳过 `HUSKY_SKIP_PLAN_HEAL=1`;紧急跳过本闸 `HUSKY_SKIP_PLAN_LINE_LOSS=1`(会把别人的登记行写没,慎用)
- **Dockerfile 构建上下文对账**(72):check-dockerfile-copy-paths.mjs(blocking,2026-09-22 立)—— 堵的是"本地全绿也发现不了"的一类:提交 `79b906463f` 给根 package.json 加 `postinstall: node scripts/fix-expo-metro-junction.mjs`,而 `deploy/docker/Dockerfile.{api,web,cli,migrate}` 只 COPY 清单就跑 `pnpm install` ⇒ 镜像缺该脚本,CI 上 build-api/build-web 同时 `MODULE_NOT_FOUND`(本机无 docker,typecheck/lint/单测全都不会知道)。两条判据只用仓库内信息:**A** 凡 COPY `pnpm-workspace.yaml`(根上下文标记)的 Dockerfile,必须 COPY 钩子里 `node <file>` 引用的每个脚本(只 COPY 单文件,勿 COPY 整个 `scripts/` 以保层缓存);**B** 每条非通配、非 `--from=` 的 COPY 源必须存在于**构建上下文**,上下文由 `.github/workflows` 的 `context:`/`file:` 成对解析,解析不到即跳过并在结论行如实报 `B 核了 N/M`;**C** `pnpm --filter <spec> run <script>` 对闭包里**没有该脚本**的包是**静默跳过而非报错**,若被跳过的包自带 `build`(产出 dist)则下游按 `main`/`exports` 读 dist 必 `Module not found` —— 判据 = 从 workspace 包图展开闭包(`pkg`=自身、`pkg^...`=仅依赖、`pkg...`=自身+依赖,取反与上游方向放过),点名"有 build 却缺被调用脚本"的包。**A/B 修完 build-api 绿了,build-web 仍恒红就是 C 类**(Dockerfile.web 跑 `--filter @ihui/web... run build:static`,而 web 的 7 个可构建依赖全都没有 `build:static` ⇒ 一个都没构建 ⇒ `@ihui/api-client` 解析失败;同仓 Dockerfile.api 用 `run build` 人人都有故一直绿,两条只差脚本名)。**存在性一律按提交内容(`git ls-tree -r HEAD`)判,不按工作树**——并行会话可能删了文件但未暂存,按 `existsSync` 会产出与真实构建相反的假阳性(实测踩过)。`COPY . .` 与 `pnpm-lock.yaml*` 不参与判定。自检 `--self-test`(10 例,含 C 的 5 例正反对照)+ `node --test scripts/tests/check-dockerfile-copy-paths.test.mjs`(10 例,含"真仓包图上旧行必红且点名 api-client、修后必绿、api 作同仓对照"与 `expandFilterSpec` 三形态);紧急跳过 `HUSKY_SKIP_DOCKERFILE_COPY_GUARD=1`
- **mobile-rn 深色前景/容器对账**(83,原 75):check-brand-foreground.mjs(blocking,2026-09-23 立)—— 四条判据:**R1** 零豁免,同一 style 块内 `tokens.brand.DEFAULT` 作背景 × `surface.light`/`text.primary` 作前景(深色档案下 brand.DEFAULT=纯白 ⇒ 白底白字);**R4** 同一关系被拆到**兄弟 key**(`retryBtn` × `retryText`)时按命名配对判,走基线棘轮;**R2** `surface.light` 背景 / α≥0.5 白 rgba / 无 `dark:` 变体的 `bg-white` 作容器底,每文件计数对 `scripts/brand-foreground-baseline.json` 只减不增;**R3** 数 brand.DEFAULT 填充/描边但**不计 §4 成对 CTA**(同块或兄弟键用 `brand.foreground` 作前景)—— 见本节上方「品牌 CTA / 主按钮色同源」,按规矩写就红的门只会逼人 `--no-verify`;**无配对的白卡片照旧计**(自检里两条阳性对照钉住)。**内容口径**:全量与 `--update-baseline` 判 **HEAD blob**,`--staged` 判暂存 —— 共享工作树滞后 HEAD,按磁盘算会在恒红/假绿间来回跳并把错数写回基线(2026-09-24 一天内 R3 登记被整文件回退三次的直接成因)。`--staged` / `--update-baseline` / `--self-test`;紧急跳过 `HUSKY_SKIP_BRAND_FOREGROUND=1`。

- **mobile-rn 深色前景/容器对账**(83,原 75):check-brand-foreground.mjs(blocking,2026-09-23 立)—— 四条判据:**R1** 零豁免,同一 style 块内 `tokens.brand.DEFAULT` 作背景 × `surface.light`/`text.primary` 作前景(深色档案下 brand.DEFAULT=纯白 ⇒ 白底白字);**R4** 同一关系被拆到**兄弟 key**(`retryBtn` × `retryText`)时按命名配对判,走基线棘轮;**R2** `surface.light` 背景 / α≥0.5 白 rgba / 无 `dark:` 变体的 `bg-white` 作容器底,每文件计数对 `scripts/brand-foreground-baseline.json` 只减不增;**R3** 数 brand.DEFAULT 填充/描边但**不计 §4 成对 CTA**(同块或兄弟键用 `brand.foreground` 作前景)—— 见本节上方「品牌 CTA / 主按钮色同源」,按规矩写就红的门只会逼人 `--no-verify`;**无配对的白卡片照旧计**(自检里两条阳性对照钉住)。**内容口径**:全量与 `--update-baseline` 判 **HEAD blob**,`--staged` 判暂存 —— 共享工作树滞后 HEAD,按磁盘算会在恒红/假绿间来回跳并把错数写回基线(2026-09-24 一天内 R3 登记被整文件回退三次的直接成因)。`--staged` / `--update-baseline` / `--self-test`;紧急跳过 `HUSKY_SKIP_BRAND_FOREGROUND=1`。
- **mobile-rn 深色前景/容器对账**(83,原 75):check-brand-foreground.mjs(blocking,2026-09-23 立)—— R1 零豁免:同一 style 块内 `tokens.brand.DEFAULT` 作背景 × `surface.light`/`text.primary` 作前景(深色档案下 brand.DEFAULT=纯白 ⇒ 白底白字);R2 基线棘轮:`surface.light` 背景 / α≥0.5 白 rgba / 无 `dark:` 变体的 `bg-white` 作容器底,每文件计数对 `scripts/brand-foreground-baseline.json`(现 13 文件 24 处,均为媒体上的合法浮层或已带 `dark:` 变体)只减不增。`--staged` / `--update-baseline` / `--self-test`(11 例);紧急跳过 `HUSKY_SKIP_BRAND_FOREGROUND=1`。
- **反回退对账**(84,原 76):check-stale-revert.mjs(blocking,2026-09-23 立)—— 堵共享工作区**静默回滚**:§12d converge 用 merge-tree/commit-tree 只推进 HEAD+index、**不 checkout**,工作区落后 HEAD 时 `git add <file>` 交的是旧基线(实测 503 文件落后 486 提交),等于把别人该路径的后续改动静默回滚,而 diff 只显"改了几行"。判据 R1 = 暂存 blob != HEAD blob **且字节级等于该路径某祖先提交版本** → 拦并点名回到的 commit;真新编辑不可能恰好等于历史 blob,故误报极低。三条护栏:merge/cherry-pick/revert 上下文整轮豁免、暂存删除只 warn(`git rm` 合法,机器分不清就被删)、判定文件 >300 跳过(性能护栏,防逼人 --no-verify 连带关掉全部守门)。取证 `--self-test` 8 例(含"写回 v1 必判红"阳性对照)+ 临时 index 端到端演练 3/3;**有意回退一律改用 `git revert` 生成前向提交**。紧急跳过 `HUSKY_SKIP_STALE_REVERT_GUARD=1`。

<!-- 合并归并说明:本行下方两条登记分属两个会话同日新增的闸门(78 workspace 依赖链接对账 / 79 提交内容含冲突标记),两侧均保留,不构成互斥。
     (2026-9-24 校正:原写法把冲突标记门写成 77,而 77 是「全 8 端圆角单一源头对账」——同日撞号正是本节要防的事,登记新门前请按守门速查逐条核对 id。) -->

- **workspace 依赖链接对账**(78):check-workspace-dep-links.mjs(blocking,2026-09-23 立)—— 堵的是同一族"**本地全绿、出事的是别人**"的故障,现共**五维**,每维的修复动作不同,红点会点名是哪一维:**① 声明↔链接**:`package.json` 声明 `workspace:*` 而 `node_modules` 里没有那条链接(§12e 的 `pnpm install --filter` 后遗症)。2026-09-23 实例:`@ihui/extension` 缺 `@ihui/design-tokens` → rollup `failed to resolve import` → `pnpm -r build` 连 4 次全红 → 部署进入 30 分钟冷却循环、线上停在旧提交,而 **typecheck/lint/单测全都不会红**(TS 走 tsconfig paths,不看 node_modules)。判据 = 每个包 dependencies/devDependencies/peerDependencies 里所有 `workspace:` 声明,必须在 `<pkg>/node_modules/<dep>` 或根 `node_modules/<dep>` 可解析(`existsSync` 跟随符号链接 ⇒ **悬空链接同样判红**)。**② 链接↔内容**(2026-09-24 补,`findGuttedLinks`):每条**符号链接**的目标必须是真包(有可 parse 且带 `name` 的 `package.json`)——`existsSync` 对"指向**空目录**的链接"仍返回 true,而 09-24 本机全机门禁停摆正是这一型:`node_modules/typescript`、`node_modules/eslint` 指向 `.pnpm` 里的空目录,`.bin` 只剩 16 项 ⇒ lint-staged 第一步 `✖ eslint --fix` 阻止提交 ⇒ **每一次提交都被迫 `--no-verify`,约 110 道守门对全队同时失效**,而 `git status`/typecheck/其余报告全都看不出来。刻意**不**比 name(pnpm 别名 `foo@npm:bar` 必产假阳);真目录(file:/workspace: 直连)不参与;`--strict` 档另把本维延伸到 `node_modules/.pnpm/*/node_modules/*` **传递闭包**(实测真仓浅扫 717 条 / 深扫 10,015 条,均 0 红,深扫 +1.3s);**深扫刻意不进提交链** —— 并发 `pnpm install` 半复制态会一次闪出上百条,而本门 blocking,恒红门的唯一结局就是各会话跳门、连带全部守门作废(本仓最高反面教训);`.pnpm` 里含 `_tmp_` 的安装中临时键**跳过并如实计数**,不判红。**③ shim 完整性(仅报数)**:直接声明的依赖有 `bin` 而该处 `.bin` 无同名 shim;不判红是因为它**在并发 install 窗口内会闪**(实测 0↔113 跳),判红落在 `pnpm check:dep-links:strict`(已串进 `check:all`)。稳态真仓实测 **0 条**缺失、25 个包各有 `.bin`(apps/api 45 项 / web 33 / extension 24 / shared 15 …)⇒ 旧条目写的"真仓 102 条含 apps/api 15 条""apps/api 根本没有自身 `.bin`"**是那次削损的现场读数,不是基线,已于 2026-09-24 全量安装后复测证伪并就地更正**;同时 pnpm 只为**直接声明的依赖**建 shim(根里 hoist 上来的 `expo`/`react-native` 不在根 `package.json` 内,按定义没有),`declaredFor(owner)` 就是为剔除这类假阳而存在。**④ 钩子命令可解析性(判红,不需基线假设)**:`lint-staged` 配置里必然被 spawn 的命令(现 `eslint`/`prettier`)必须在**根** `node_modules/.bin` 解析得到。两处刻意的窄口径:**不**接受"`node_modules/<cmd>` 包目录存在"作为通过(故障当天恰是"包体完好、shim 没了":`node node_modules/eslint/bin/eslint.js --version` 出 v10.8.1,而按 PATH 找 `eslint` 报「不是内部或外部命令」);**不**查全局 PATH(本会话 `where eslint` 能命中全局版,而钩子进程的 PATH 里没有 ⇒ 拿全局命中当"能解析"就是造一台**在故障现场报绿的尺子**)。**⑤ shim 指向的入口文件(判红)**:shim 在位而它 exec 的那个 `bin/*.js` 被删 ⇒ ④ 全绿、lint-staged 一 spawn 就 `Cannot find module`。`resolveShimEntry` 双路兜底(先剥 shim 文本的 `%~dp0`/`$basedir` 模板,再退回包清单的 `bin` 字段),两路都探不到一律记 `unresolved` **不判红**;两个写门时自己踩到的坑已由反向对照钉死 —— pnpm 的 `.CMD` **第一个候选是 `"%~dp0\node.exe"`**(存在性分支头),按"第一个命中"取值会让本门在**完好仓库**上恒红;`%~dp0` 本身就是 `.bin`,再拼一层 `..` 会多跳一级把目标算到 `node_modules` 外面。两条反假绿护栏:扫不到任何 workspace 包 → `exit 1`(不报绿);根 `node_modules` 不存在 → 显式提示"先 pnpm install"并**无法判定**(不记为通过);**扫到 0 条链接一律判红**(空扫不报绿,浅/深合计口径,默认档与改前逐字等值)。`--staged` **不**随暂存收窄范围,恒全量判定(全量 25 包约 0.2s)—— 这类破损与"本次改了什么"无关:手动删链接、他机跑过 `--filter`、清理工具动过依赖树,按 staged 收范围恰好放过整类。取证:`--self-test` + `node --test scripts/tests/check-workspace-dep-links.test.mjs`(例数以各自末行现测为准,不写死防漂移;含**装车证明** runner 里确有 id 78 + blocking + skipEnv、"真仓 eslint/prettier 第五维必须判绿"的**反恒红**对照、以及"深扫只在 strict 生效"的接线方向对照)。**修复动作按维度分**:① ② 靠全量 `pnpm install`(不带 `--filter`);③ ④ ⑤ 靠 `node scripts/repair-node-bin-links.mjs` —— 因为 **shim 不会被 `pnpm install` 或 `pnpm install --force` 重建**(两条都只回 `Already up to date`,1.2s 收工)。验收一律实测命令本身(`.bin/eslint --version` + `.bin/tsc --version` 都出版本号、`pnpm --filter @ihui/api typecheck` 真跑、门 78 全量 exit 0),只看 `node_modules/eslint` 在不在等于没测;`repair-node-bin-links.mjs --check` 在修复后的现读是「根依赖 16 个包 / bin 声明 9 个:`.bin` 完整,无缺失」。另留一条**归属纪律**:本机第一次补回 shim 的 mtime(11:22:56)与另一会话 `repair-node-bin-links.mjs` 入库(11:35)、与我自跑 `pnpm install --force` 都在同窗口,**归属未定 —— 只记事实,不记成果**。紧急跳过 `HUSKY_SKIP_WORKSPACE_DEP_LINKS=1`。

- **提交内容含冲突标记**(79):check-no-conflict-markers.mjs(blocking,2026-09-23 立)—— 2026-09-23 15:49 `.git` 被宿主清除,恢复期某会话在共享工作区跑真实 `git merge`,留下 103 个未合并路径与 94 个带字面标记的工作区文件;而全链守门**没有任何一道**看"被提交的内容含冲突标记",于是 `apps/cli/tests/file-edit.test.ts` 带着 `<<<<<<<` 一路进 HEAD 树,整轮 merge 结束都没被发现。判据 = 同文件内**成对**出现的行首 `<<<<<<< ` 与 `>>>>>>> `(中间允许夹整行 `=======`);**强制成对**是硬要求 —— 单行 `=======` 在 Markdown setext 标题下划线、表格分隔、ASCII 示意图里都合法,只判单行会满天假红(实测全仓 `^=======$` 命中远多于成对命中);未配对的孤立标记不计红但如实报数("只剩一半"= 标记被手删的强信号)。三模式:`--staged`(只判索引内容,`git show :<path>`,取不到退回工作区;路径清单含 `U` 未合并态,因 merge 冲突时 git 把该文件标为 unmerged,只按 ACMR 过滤会恰好漏掉本门要拦的那一类)/ 缺省(判所有跟踪文件工作区内容,`git ls-files`,实测 16561 候选 1.5s)/ `--rev <sha|HEAD>`(判提交树,`git grep -Ilz` 定位候选 + blob 复核,供事后核验)。护栏:自豁免(本门脚本与测试必含字面量,按文件名前缀跳过)、>2MB 大文件、二进制(前 8KB 含 NUL),三类**均在输出里如实计数**;退出码 0/1/2(2=git 候选解析失败等脚本自身异常,绝不静默放行)。取证 `--self-test` 23 例(含正反成对对照 + 真实 merge 未合并路径现场:成对判红 / 单行 setext 判绿 / 索引脏即红而仅工作区脏判绿 / rev 隔离 / 自豁免与大文件二进制计数)+ §22c 镜像测试 11 例。修复口径:**用 `git checkout --ours/--theirs` 或按 §12b 协作收尾重新归并,禁止手删三行标记当作已解决**;紧急跳过 `HUSKY_SKIP_CONFLICT_MARKERS=1`。

- **热路径 git 只读调用超时**(80):check-git-read-timeout.mjs(blocking,2026-09-23 立)—— 堵"提交像死掉了"这类无界挂起:`scripts/check-port-registry.mjs` 一处 `execSync('git ls-files')` 无 `timeout`,在共享工作区挂住 **80 分钟而 CPU 只用 2.84s**(等锁/等 IO 型),而 `git status`、typecheck 全看不出异常。全仓首参锚定实测 **159 处** git 派生调用**无一带 timeout** ⇒ 不是个别疏忽,是没有约束。口径刻意收窄三条(与门 52 同取向:宁漏不误报):① 只判钩子/守护链可达的 `HOT` 文件清单,不判测试夹具与端内代码;② 只判**动词为字面量**的调用 —— `git(args)` / `runGit(args)` 这类包装器动词未知,整体加超时会连带 bound 写操作,而 **`commit`/`add`/`reset`/`mktree` 中途被 SIGTERM 可能留下 `.git/index.lock`**,把一次挂起换成全局阻塞;③ 只判只读动词表内的调用。写动词与包装器**不判但如实计数**(输出行含 `写动词不判 N 处 / 包装器不判 M 处`),绝不静默成"看起来全绿"。字符串与注释内的命中一律丢弃(`markHidden`)——该缺陷是自检抓出来的:判据会把 `const fixture = "execFileSync('git', …)"` 这种测试夹具源码当真调用判红。`timeout` 两种写法都认(`timeout: <ms>` 与简写 `{ timeout }`)。**动词提取按 token 位置逐个走,并对 `-C <dir>` / `-c k=v` 这类带值选项连值一起跳**(`pickVerb`)——旧正则要求数组首元素即动词,于是 `execFileSync(GIT_BIN, ['-C', repoDir, 'status'])` 与 `['-c','safe.directory=*','for-each-ref']` 这两种最常见形态**根本匹配不到**:门恒报"0 处"而实际有 2 处无界只读调用(`git-push-guard.mjs`,已随本次清零)。判据盲区由并行会话的交付报告指出、以自检用例钉住;教训是**"扫到 0"必须先怀疑判据,再相信世界**。`HOT` 现 18 项(新增 `apps/cli/src/worktree.ts`)。**存量已随本门一并清零**(runner 3 处 + converge 4 处 + commit-loss-guard 默认值 1 处),不留基线债。取证 `--self-test` 12 例(含夹具/注释不判、简写属性不假红、写动词计数、-C 与 -c 带值选项取动词)+ `node --test scripts/tests/check-git-read-timeout.test.mjs` 7 例(含**装车证明**)。紧急跳过 `HUSKY_SKIP_GIT_READ_TIMEOUT=1`。 **登记新门前先查编号占用**(`grep -oE "^    id: .[0-9]+.," scripts/guardian-runner.mjs | sort -V | uniq -d` 应只出历史遗留项):同日多会话在数组同一位置各加一道门必然撞号 —— 实测 75/76 已各重复一次,本门最初登记的 79 也与并线进来的 check-no-conflict-markers 同号,故改号为 80 并在镜像测试里钉死"本门编号在 runner 中必须出现恰好一次"。
- **品牌邮件通道对账**(81):check-brand-email-channel.mjs(blocking,2026-09-23 立)—— 拦绕过品牌模板层的 ops 自发纯文本邮件("能发出去、typecheck/lint 全绿,用户收到的邮件没样式",与守门 72/78 同族):R1 `Send-MailMessage` 调用语句缺 `-BodyAsHtml` / R2 `api.resend.com/emails`(含 host+path 分行形态)同一发送上下文无 `html` 字段 / R3 有发信动作(`createTransport`/`sendMail`/`api.resend.com`)却不引用 `email-templates` 也不调用 `notify-deploy-failure`;范围 `deploy/**`+`scripts/**`(不含 tests)+workflows `*.yml`,注释行/裸域名不判(宁漏不误报),行内豁免 `brand-mail-exempt: <原因>`,存量走 `scripts/brand-email-channel-baseline.json` 只减不增(建门实测:ps1 自拼通道已被并行会话清除,副产品揪出第三条通道 `scripts/check-credential-health.mjs` 已入基线待迁移)。**修法的唯一姿势:ops 邮件一律经 `apps/api/scripts/notify-deploy-failure.ts`(版式由 `email-templates.ts` 单点决定),不得端内自拼传输层**。取证 `--self-test` 30 例(正反成对+临时仓双取材面)+ 镜像测试 8 例(含装车证明);`--staged` 暂存集为空/取不到 → 退化全量(守门 70 教训);紧急跳过 `HUSKY_SKIP_BRAND_MAIL_GUARD=1`。

- **品牌邮件通道对账**(81):check-brand-email-channel.mjs(blocking,2026-09-23 立)—— 拦绕过品牌模板层的 ops 自发纯文本邮件("能发出去、typecheck/lint 全绿,用户收到的邮件没样式",与守门 72/78 同族):R1 `Send-MailMessage` 调用语句缺 `-BodyAsHtml` / R2 `api.resend.com/emails`(含 host+path 分行形态)同一发送上下文无 `html` 字段 / R3 有发信动作(`createTransport`/`sendMail`/`api.resend.com`)却不引用 `email-templates` 也不调用 `notify-deploy-failure`;范围 `deploy/**`+`scripts/**`(不含 tests)+workflows `*.yml`,注释行/裸域名不判(宁漏不误报),行内豁免 `brand-mail-exempt: <原因>`,存量走 `scripts/brand-email-channel-baseline.json` 只减不增(建门实测:ps1 自拼通道已被并行会话清除,副产品揪出第三条通道 `scripts/check-credential-health.mjs` 已入基线待迁移)。**修法的唯一姿势:ops 邮件一律经 `apps/api/scripts/notify-deploy-failure.ts`(版式由 `email-templates.ts` 单点决定),不得端内自拼传输层**。取证 `--self-test` 30 例(正反成对+临时仓双取材面)+ 镜像测试 8 例(含装车证明);`--staged` 暂存集为空/取不到 → 退化全量(守门 70 教训);紧急跳过 `HUSKY_SKIP_BRAND_MAIL_GUARD=1`。
- **品牌邮件通道对账**(81):check-brand-email-channel.mjs(blocking,2026-09-23 立)—— 拦绕过品牌模板层的 ops 自发纯文本邮件("能发出去、typecheck/lint 全绿,用户收到的邮件没样式",与守门 72/78 同族):R1 `Send-MailMessage` 调用语句缺 `-BodyAsHtml` / R2 `api.resend.com/emails`(含 host+path 分行形态)同一发送上下文无 `html` 字段 / R3 有发信动作(`createTransport`/`sendMail`/`api.resend.com`)却不引用 `email-templates` 也不调用 `notify-deploy-failure`;范围 `deploy/**`+`scripts/**`(不含 tests)+workflows `*.yml`,注释行/裸域名不判(宁漏不误报),行内豁免 `brand-mail-exempt: <原因>`,存量走 `scripts/brand-email-channel-baseline.json` 只减不增(**2026-09-24 实测基线 `counts` 已为 `{}`** —— 建门时揪出的第三条通道 `scripts/check-credential-health.mjs` 已迁到同一派发器,未用 `brand-mail-exempt:` 糊过去)。**范围已两度扩面**(2026-09-24):原只扫 `deploy/**`+`scripts/**`,而告警邮件正文的实际出口在 `monitoring/alertbridge/*.cjs` —— 目录与扩展名**双重不可见**;现含 `monitoring/**` + `.cjs/.mts` + `apps/api/scripts/**`,并新增两条判据:**R3b** 接了唯一出口却自带一份 HTML 版式(三段与门:邮件版式标记 ∧ ±10 行样式指纹 ∧ 本文件确在邮件语境,注释行不计)—— R1/R2/R3a 只看"有没有走模板",对这一型全盲;**R4 告警接收面** `monitoring/alertmanager/**` 的 yml/yaml/tmpl 出现 `email_configs`/`smtp_*`(AM 原生邮件 = 无版式纯文本)、IM 中转 receiver(名字与 host/路径**都**认,`feishu-copy` 改名躲不过)、或 `webhook_configs` 里 url ≠ `BRIDGE_URL` ⇒ 红;注释行不判红但 `amCommentLiterals` 如实计数。**全仓不扫 yml**(根 compose / prometheus / loki 的历史注释里就写着 `dingtalk-webhook`,全仓扫必假红 —— 面外写进断言)。`stagedTriggers` 与扫描面**必须同步扩**,否则"只改 bridge/模板的提交"根本不唤起本门(判据存在而永不调用 = 没有,守门 70/76 同型;该字段今晚被并发整文件回写抹掉**三次**,由镜像测试"装车证明"抓回)。**修法的唯一姿势:ops 邮件一律经 `apps/api/scripts/notify-deploy-failure.ts`(版式由 `email-templates.ts` 单点决定),不得端内自拼传输层;Alertmanager 出口只有 bridge 一条**。取证 `--self-test` 61 例(正反成对+临时仓双取材面)+ 镜像测试 20 例(含装车证明与 `BRIDGE_URL` 与渲染器逐字等值的漂移即红断言);`--staged` 暂存集为空/取不到 → 退化全量(守门 70 教训);紧急跳过 `HUSKY_SKIP_BRAND_MAIL_GUARD=1`。
- **主题接线对账**(91):check-theme-prop-wiring.mjs(blocking,2026-09-24 立)—— 堵"顶栏深色 + 正文浅色"这类**同屏双色档案**:`packages/app` 213 个 theme-driven 组件的形参默认值是 `colorScheme = 'light'`,调用方漏传就静默脱主题,类型系统完全不红(`colorScheme?:` 可选)。三判据 —— **missing**(渲染点未传该属性)/ **literal**(写死 `'light'` 或 `'dark'`)/ **spread-unknown**(仅 `{...props}` 展开且回溯不出来源,判不出即如实报数,不静默放行)。建门实测:此前一轮用"JSX 元素文本里有没有 `colorScheme` 字样"统计出"漏传 0 处",**该结论是错的** —— 换成花括号深度扫描 + 组件清单自动推导后真实命中 **118 处 / 117 文件**,即 115 个屏一直在静默锁死浅色档案。**盲区已补(比漏修更值得记)**:写死的 `'light'` 有 5 处藏在**对象构造里**而非 JSX 属性上(`const props = { colorScheme: 'light' }; return <SharedX {...props} />`),"字面量"判据只解析 attrs 故从不判红,"未接线"判据见到 spread 就笼统归"判不出" —— 这 5 屏以"待人工核"的名义静默锁死浅色,**门一直是瞎的**。现由 `resolveSpreadThemeValue()` 回溯对象构造再判:对象里有字面量 → 判红;对象里确实没这个键 → 判 missing;props 来自函数形参且本文件无对象字面量 → 仍承认判不出,不猜。**基线 `scripts/theme-prop-wiring-baseline.json` 现须为空 `{counts:{}}`(零容忍)**,`--strict` 口径为"0 未接线 / 0 字面量 / 0 判不出"。行内豁免 `theme-wiring-exempt: <原因>`(须带原因)。取证 `--self-test`(**含阳性对照**:注释里写 `colorScheme: 'light'` 不得误判、不传 `src` 时行为与旧版一致)+ §22c 镜像测试 `scripts/tests/check-theme-prop-wiring.test.mjs`(含**装车证明**:runner 里必须真有 id 91 + blocking + skipEnv,且本门编号在 runner 中恰好出现一次)。**内容口径(2026-09-25 补齐,此前它是全链最后一道按磁盘判的主题门)**:全量判 **HEAD blob**、`--staged` 判**索引 blob**、`--worktree` 仅人工逃生舱;枚举与内容同面同轮;取不到 ⇒ **exit 2「无法判定」**(不冒红也不记绿),`--staged --worktree` 同给判死,全量枚举到 0 个 .tsx 判死;git 面必须先 `prefetch`(一次 `cat-file --batch`)再 `read`,未预取即 read 抛错而非静默跳过。立项当场即由此把他人**未提交**的 `ChatScreen.tsx` 摘 prop 判成本仓违规(HEAD 其实合规)。取证 `--self-test` 的 F1–F4 在 `mkScratch` 临时仓里造"索引≠磁盘"现场,并由**三条变异**分别证明 F1/F4 不是恒真;紧急跳过 `HUSKY_SKIP_THEME_PROP_WIRING=1`。
- **HEAD 悬空具名导入对账**(98):`scripts/check-dangling-local-imports.mjs`(blocking,2026-09-24 立)—— 与守门 77 B6 同族的**另一半**:77 管"用了标识符却没 import",本门管"`import { X } from './y'` 而 y 根本不导出 X"。两者都只在编译期可见,而 `pnpm typecheck` 只跑共享工作区 —— 工作区恰好是旧基线时**两边都不红**。2026-09-24 一天内各中一次:`rnRadius['2xl']` 两处未 import 让真机 release 包启动即 SIGABRT(Metro 不查类型,打包成功≠能跑);`PermissionTierRow` 经 `git log --all -S` 证明**从未在任何提交里存在过**,而引用它的注释还写着"已抽到 ChatDisclosure"。判据 D1(具名导入无对应导出)/ D2(相对路径解析不到);口径与 77/83/90 一致:全量判 **HEAD blob**、`--staged` 判索引 blob、**棘轮锚点恒为该文件 HEAD 自身违规数**(把锚点写成 0 会让存量 300+ 文件整片报红 ⇒ 逼人 `--no-verify` ⇒ 全部守门作废);宁漏不误报 —— `export *` 目标不可枚举即放过,缩进/注释/模板字符串里的 import 形态一律不判。真仓 HEAD 实测 8042 源文件、悬空 6 处且**全在测试面**,生产代码 0 处。取证 `--self-test` 19 例 + §22c 镜像测试 5 例(含"存量只允许落在测试文件"与 runner 装车证明)。紧急跳过 `HUSKY_SKIP_DANGLING_IMPORTS=1`。
- **架构契约对账**(103):`scripts/check-architecture-policy.mjs`(blocking,2026-09-25 立)—— 与其余全部守门**方向相反**的一道:其余是"发现一类违规 → 写一条判据"(打地鼠),本门读 `config/architecture-policy.yaml` 这张**声明表**,从声明反查违规。四类红:**T1** 表与现实脱节(模块改名/目录搬走而表没跟上 —— 表一过期,依赖它的所有判断都在对着空气打分)/ **C1** 单文件行上限(阈值 6000,**取自 HEAD 实测最大文件 5258 行之上**,依据写在 yaml 注释里)/ **D1 D2** 依赖方向(包 import 端、或 `requires` 未声明就 import;以及反向按 rank 更深一层)/ **D3** 深导入(绕过 `public_entrypoints` 直接摸别的包内部 —— 它是"端内重复实现"的入口)。**渐进收口是设计前提**:立项时 24 块一律 `managed: false`(只报数不判红),逐块翻正时才按判红口径问责。⚠️ "**存量一律 false**"描述的是**立项状态,不是现值** —— 现值一律按当次实测取,见下。翻 true 前先用 `--managed-trial <id>` 看条数,**不得为消红去改阈值或把不该对外的模块标成 exported**。行内豁免 `arch-exempt: <原因>`(须带原因)。口径同 70/77/83/98/101:全量判 **HEAD blob**、`--staged` 判索引 blob。**策略表自身的取材按档定向**(`policyFaceOrder`):全量档 HEAD 优先、**`--staged` 档索引优先**,两者都再降级到工作树;取不到判"无法判定",不冒红也不记绿。⚠️ 这里 2026-09-25 修掉一处**本门对自身改动的盲视**:原实现两个面都 HEAD 优先,于是"修改策略表自身"的那枚提交完全不进本门审查 —— 实测往索引版 `apps/cli.requires` 注入一条 `apps/api`(端应用 `exported:false`,T1 必判红)后全量与 `--staged` 双双 exit 0,而 `--staged` 输出照旧打印旧表的 `managed:true` 清单。这个洞偏偏落在"规矩 2:翻 `managed:true` 前先试跑"所要求的动作上(提交链是唯一无验的一环),且源码旧注释"表是输入不是被审对象"正是它的设计理由,已就地推翻。取证 `--self-test` 51 例(成对正反 + 两面口径差异 + 解析器坏了必须大声失败)+ 镜像测试 13 例(含 runner 装车证明、"同一代码 managed 两侧结论不同"、T12 的**纯函数+构造面**取材面证明、以及 T12b 的尺子反例;变异回旧顺序只有 T12 红)。**本门自身踩过的判据教训(勿再犯)**:这里曾写过一条"索引表≠HEAD 表 ⇒ 两档收口集合必异形"的条件断言,两条前提都不成立(改注释/requires 都会让表不同而集合不变;尺子若吞到行尾则两档因"扫描 N 文件"天然不等)⇒ 一支误红、一支无牙,已删。**证明取材面这类行为只能用纯函数+构造面**,不得依赖仓库瞬时状态。**收口进度不写进文档**:某模块是否 `managed:true` 一律按当次实测取(`--staged` 输出行即现值),理由与本门刚修的那类缺陷同源 —— 登记过期数字会替人做出"已经收口"的判断。编号说明:任务书原定 102,落地前已被 `check-glyph-arrow-icon` 占用,按"后来者改号"顺延 103。紧急跳过 `HUSKY_SKIP_ARCH_POLICY=1`。
- **守门 77 B6 的括号形态盲区(2026-09-24 补)**:B6 首版的使用形态正则是 `rnRadius\s*\.`,而本门 `targetOf()` 对 2xl 档**规定的写法恰是 `rnRadius['2xl']`**(`rnRadius.2xl` 不是合法 JS)—— 门让你怎么写,门就看不见怎么写。现判据改为 `\s*(?:\.|\[)` 两种形态同视,`--self-test` 补 3 例成对正反对照,镜像测试补"括号形态必须被看见"的装车证明。教训:**判据必须覆盖自己产出的那一种形态**,否则它只拦得住别人、拦不住自己。

### 计划任务与 .vbs 的硬约束(2026-09-20 立,由本人引入的弹窗回归收口)

- **🚫 计划任务禁止直接执行控制台程序**:InteractiveToken 下 `/tr "node.exe xxx"` 会让 Windows **显示控制台窗口**(每 2 分钟闪一扇黑窗)。一律经 `wscript.exe "<name>-hidden.vbs"` 包装(`objShell.Run(cmd, 0, False)` = SW_HIDE);`-WindowStyle Hidden` 与 `powershell -WindowStyle Hidden` **仍会闪**,不作为豁免手段。现存正例:`git-guardian-hidden.vbs` / `cleanup-zombie-processes-hidden.vbs` / `kill-git-selector-hidden.vbs`。
- **🅰 `.vbs` 文件必须纯 ASCII**:`cscript`/`wscript` 按 **ANSI(本机 GBK)代码页**解码 `.vbs`,UTF-8 中文注释会被错切成伪引号 → **编译期**语法错 → wscript 弹 "Windows Script Host" 对话框,而 `schtasks` 仍报成功(与 §27 的 PowerShell/ANSI 同类陷阱)。`.vbs` 里**不得写中文注释**,说明一律英文;`git-guardian.mjs --install` 已内置"注册前用 `cscript //nologo` 实跑一次、非零退出即拒绝注册"的预检。
- **`WshShell.Run` 命令串引号规则**:裸程序名**不能**加引号(`"node.exe" arg` 会按字面文件名解析而失败),仅路径真含空格时才加引号;参数照常加引号。
- **`WScript.Shell.Environment()("不存在的键")` 返回 Null**,`Len(Null)` 亦为 Null,后续比较抛 "Type mismatch" 并静默中止。读环境变量必须 `& ""` 归一:`raw = shell.Environment("Process").Item("X") & ""`。
- **Electron 宿主无视 `NODE_OPTIONS`**:实测 Qoder/Trae 自带运行时内 `process.env.NODE_OPTIONS === undefined`(Electron 主动剥离),故机器级 windowsHide 钩子**只覆盖独立 `node.exe`**,覆盖不到 IDE 内部的 git 调用。后者若弹窗,只能关 IDE 自带 git 集成或改其调用方,不要误以为环境变量层能解决。

- **圆角容器背景溢出守门**(11b): `scripts/check-rounded-overflow.mjs`(warn) —— 拦"父 rounded-lg/xl/2xl/md 无 overflow-hidden × 子 bg-* 贴边无 rounded-* 无 margin 且非 absolute/fixed"六条件齐备的圆角冒角,--staged 只咬新增行,违规 exit 1(`scripts/check-rounded-overflow.mjs:457`,判定 `isViolation:229`);真跑全量 rc=0(3s);无 --self-test;紧急跳过 `HUSKY_SKIP_ROUNDED_OVERFLOW=1`(脚本自读 :56)。
- **TagsView 选中态描边定稿守门**(11c): `scripts/check-tagsview-visual.mjs`(blocking) —— 拦 TagsView active 态丢 `outline-2+outline-border` 定稿、全站出现 `outline-black`/`dark:outline-white` 回潮、pinned/inactive 背景 token 被换、测试反向断言被删,违规 exit 1(`scripts/check-tagsview-visual.mjs:188`,全站扫描段 `extractQuotedStrings:64`);真跑全量 rc=0(1s);无 --self-test;⚠️失败提示与头注称 `HUSKY_SKIP_TAGSVIEW_GUARD=1` 可跳,实际脚本与 runner 条目均不读该 env——无真实应急通道。
- **单文件行数守门**(11e): `scripts/check-file-size.mjs`(blocking) —— 拦 --staged 新增文件超 800 行(`FILE_SIZE_LIMIT`/`--limit` 可改阈值),exit 1(`scripts/check-file-size.mjs:216`),全量模式仅报告 exit 0;真跑全量 rc=0(1s);无 --self-test;紧急跳过 `HUSKY_SKIP_FILE_SIZE=1`(脚本自读 :51)。
- **原生弹窗禁用守门**(11f): `scripts/check-no-native-dialog.mjs`(blocking) —— 拦 staged 新增行里调用形态 `alert(`/`confirm(`/`prompt(`(去注释+去字符串后判定,`stripStringsAndComments:79`),exit 1(`:298`),全量仅报告;真跑全量 rc=0(7s);无 --self-test;紧急跳过 `HUSKY_SKIP_NATIVE_DIALOG=1`(脚本自读 :40)。
- **渐变遮罩禁用守门**(11g): `scripts/check-no-mask-image.mjs`(blocking) —— 拦 staged 新增行出现 `mask-image`/`-webkit-mask-image` 字面量(注释行豁免 `isExempt:63`),exit 1(`:244`),全量仅报告;真跑全量 rc=0(3s);无 --self-test;紧急跳过 `HUSKY_SKIP_MASK_IMAGE=1`(脚本自读 :39)。
- **i18n JSON 同层重复键守门**(2e-dupns): `scripts/check-i18n-duplicate-namespaces.mjs`(blocking) —— 字符级深度栈扫 `packages/i18n/messages/**/*.json` 找同一对象层重复键(JSON.parse last-wins 静默遮蔽),发现即 exit 1(`:163`,核心 `findDuplicateKeys:64`),另接 cert `i18n-duplicate-ns`(warnOnly:false)+ CI path 触发;真跑全量 rc=0(0s);无 --self-test;紧急跳过 `HUSKY_SKIP_I18N_DUP_NS=1`(脚本自读 :115);⚠️头注称"调用方 guardian-runner 第 2f 项",实际条目 id 为 `2e-dupns`。
- **陈旧副本/保护区删除守门**(30c): `scripts/check-stale-copy.mjs`(blocking) —— 拦两态:staged D 命中保护区(drizzle .sql/各端 tests/scripts/check-*/scripts/lib)或 staged M 内容 = 该路径基线祖先的历史 blob(`git log --find-object` 判据),exit 1(`:116`);真跑 rc=1(13s)红 3 处(`PROJECT_PLAN.md`、`scripts/check-c-drive-pollution.mjs` 及其测试被判陈旧副本——系本机共享工作树滞后/并行会话现场,存量红待清,非 HEAD 缺陷);无 --self-test;紧急跳过 `HUSKY_SKIP_STALE_COPY=1`(脚本自读 :55)。
- **LLM provider 字典 schema 守门**(33): `scripts/check-llm-provider-schema.mjs`(blocking) —— 对 `apps/ai-service/.env` 的 `LLM_PROVIDERS(_JSON)` 跑 7 条规则(32 provider 白名单/字段类型/未知 provider/空值/重复等),含 error 即 exit 1(`:339`),`.env` 缺失或参数错 exit 2(`:306/:316/:324`);真跑 rc=0(0s);无 --self-test,但镜像测试 node --test 真跑 rc=0(45 例);无应急通道(runner 条目无 skipEnv、脚本不读 env);⚠️头注"集成位置:.husky/pre-commit 第 N+1 项"与实际不符(实际挂 runner id 33 + 专属 CI `llm-provider-schema-test.yml`)。
- **新增 @ts-ignore/@ts-nocheck 守门**(34): `scripts/check-ts-ignore.mjs`(warn) —— 扫 staged .ts/.tsx/.mjs/.js/.cjs 注释形态新增 @ts-ignore/@ts-nocheck(e2e 等白名单 `SKIP_PATTERNS:55`),exit 1(`:160`)但 runner 以 warn 计不阻塞;真跑 rc=0(0s);无 --self-test,但镜像测试 node --test 真跑 rc=0(15 例);无应急通道(warn 级)。
- **web globals.css token 单源守门**(37): `scripts/check-web-tokens-sync.mjs`(blocking) —— 拦两态:globals.css 丢失 `@import tokens.css`(:136-141 REGRESSION)或顶层 `:root/.dark` 重宣 tokens.css @theme 变量,exit 1(`scripts/check-web-tokens-sync.mjs:132` 读失败 / 末尾 exitCode 汇总);真跑全量 rc=0(0s);无 --self-test;无应急通道(runner 无 skipEnv、脚本不读 env);⚠️头注只述 :root/.dark 回归,实际还承载 @import 存在性判据(门 89 台账引用的是后者)。
- **solito 幽灵依赖回潮守门**(38): `scripts/check-solito-residue.mjs`(blocking) —— 五查(package.json 三类依赖/pnpm.patchedDependencies/pnpm-workspace publicHoist/`patches/solito*.patch`/packages/app tsx `from 'solito/...'`)命中即 exit 1(`:353`,检测函数 `:110/:154/:189/:234`);真跑 rc=0(0s);无 --self-test,但镜像测试 node --test 真跑 rc=0(15 例);无应急通道。
- **共享层重复实现守门**(40): `scripts/check-shared-layer-duplication.mjs`(blocking) —— apps/*/src 的 export 名与 packages/shared/src export 名求交集(`collectExports:21`,`scanAppDir:85`),端内重新实现即 exit 1(`:152`);真跑 rc=0(0s);无 --self-test;无应急通道(runner 无 skipEnv;re-export wrapper 豁免逻辑在白名单)。
- **统一返回键私接守门**(46): `scripts/check-inline-back-button.mjs`(blocking) —— 拦 apps/web/src 内 `router.back()`/`history.back()` 出现在 GlobalTopBar.tsx 之外(注释行自动跳过 `isCommentLine:51`,ALLOWLIST/BANNED :317-318),exit 1(`:90`);真跑全量 rc=0(15s);无 --self-test;⚠️头注称 `HUSKY_SKIP_INLINE_BACK_GUARD=1` 可跳,实际脚本与 runner 条目均不读该 env——无真实应急通道。
- **GitHub Actions 步骤顺序守门**(48): `scripts/check-workflow-step-order.mjs`(blocking) —— 同 job 内 `actions/setup-node` 带 `cache: pnpm` 而 `pnpm/action-setup` 未排其前 → exit 1(`scripts/workflow 扫描主体 :79`,立因 2026-09-10 两 workflow 恒败);真跑 rc=0(1s);无 --self-test;紧急跳过 `HUSKY_SKIP_WORKFLOW_ORDER=1`(脚本自读 :30)。
- **迁移记账结构守门**(49): `scripts/check-migration-bookkeeping.mjs`(blocking) —— 离线 B1-B5:journal tag↔drizzle/*.sql 双向双射、tag 唯一、when 严格递增唯一、idx 唯一、journal 结构完整,违反 exit 1(`:258`);`--db` 追加 B6-B9 库内双射(行数/created_at 集合/max 相等/hash 合法唯一);真跑(离线)rc=0(0s),`--db` 模式未跑(连库);无 --self-test;紧急跳过 `HUSKY_SKIP_MIGRATION_BOOKKEEPING=1`(脚本自读 :56);另被 ci.yml run 步引用。
- **next-env.d.ts 构建污染守门**(50): `scripts/check-next-env-dist.mjs`(blocking) —— --staged:暂存的 `apps/web/next-env.d.ts` 引用 `.next-<suffix>` 变体即无条件 exit 1(`:112`);全量:变体目录仍存活(并发会话在用)只提示、目录已消失才判红;真跑全量 rc=0(0s);无 --self-test;⚠️头注称 `HUSKY_SKIP_NEXT_ENV_DIST=1` 可跳,脚本与 runner 条目实际都不读该 env——无真实应急通道。
- **能力目录三方一致守门**(51): `scripts/check-capability-catalog.mjs`(blocking) —— A `capability-catalog.ts`↔`generated/capabilities.json` 产物一致 / B v1 路由逐 handler 被能力闸覆盖 / C scope 语义(platform/thirdPartyEligible=false 不得进 /v1 rules)/ D 反向核对 warn,违规 exit 1(`:1097` 附近聚合,解析核心 `parseCatalogEntries:285`),--staged 把 B/C 收窄到暂存 v1 文件;真跑全量 rc=0(2s);--self-test rc=0 ✅ 18 条断言全绿 + 镜像测试 `scripts/tests/check-capability-catalog.test.mjs` node --test 真跑 rc=0(20 例);紧急跳过 `HUSKY_SKIP_CAPABILITY_CATALOG_GUARD=1`(脚本自读 :893;id 51 注册块 HEAD:1131/1133 已 grep 直验在场)。
- **未提交改动年龄守门**(54): `scripts/check-uncommitted-age.mjs`(warn) —— `git status --porcelain -z` 取已改+未跟踪源码文件(.ts/.tsx/.js/.jsx/.mjs/.cjs/.py/.css/.sql),mtime 年龄>45 分钟(阈值可 `resolveThresholdMin:200` 覆盖)即判风险 exit 1(runner warn 计不阻塞;绝不输出文件内容,.env*/generated/.ihui-agent 豁免);真跑 rc=0(0s);--self-test rc=0 ✅ 28 例全绿 + 镜像测试 node --test 真跑 rc=0(21 例);无应急通道(warn 级)。
- **权限模式词汇对账守门**(68): `scripts/check-permission-mode-vocabulary.mjs`(blocking) —— R1 TS/Py 双注册表成员+别名逐字同(`checkMirror:163`)/R2 别名值域闭合(`checkAliasClosure:195`)/R3 已知消费点字面量落在成员∪别名键、AgentLoopV2 禁 `auto`/自造白名单(`checkConsumers:214`/`checkNoSecondList:258`)/wire 镜像(`checkWireMirrors:312`),违规 exit 1(`:586`);真跑全量 rc=0(0s);--self-test rc=0 ✅ 21 条输出(含"两侧一致放过"反例)+ 镜像测试 node --test 真跑 rc=0(11 例);紧急跳过 `HUSKY_SKIP_PERMISSION_VOCAB=1`(runner skipEnv)。
- **端内绕过 api-client 直连后端守门**(73): `scripts/check-direct-backend-calls.mjs`(blocking) —— 拦端内裸 `fetch(`/`axios.*(`/`{Taro,wx,my,tt,…}.request(`/`new XMLHttpRequest(`+`.open(`/`navigator.sendBeacon(`/`http(s).request(` 且 URL 经污点传播锚定本仓后端(BASE_URL 符号族/自家 host/锚定 `/api/` 段,跨文件回溯深度 5,`findCallSites:410`),违规 exit 1,存量走 `scripts/direct-backend-calls-baseline.json` 棘轮只减不增;未真跑(副作用 grep 命中 :76/:1093 基线回写形态,按规则整门保守不跑);--self-test 存在(3 处)未跑(其镜像测试 node --test 真跑 rc=0,15 例);紧急跳过 `HUSKY_SKIP_DIRECT_BACKEND_CALLS=1`(runner skipEnv,留痕)。
- **词表键五语言可解析守门**(74): `scripts/check-word-table-resolvable.mjs`(blocking) —— W1 对象字面量词表发现(`scanObjectLiterals:133`/`discoverWordTables:171`)/W2 权威语料 ≥2 键且 ≥50% 锚定为 i18n 词表/W3 逐键×逐语言在消费端 shared+端合并视图必须解析出非空且≠键名/W4 miniapp 离线包载荷/W5 未接入端只记 notice 不计退出码,违反 exit 1(`:885` 提示行所在判红聚合)。**W3 的"消费端"按符号粒度认**(2026-09-24 修盲区):同一模块多导出时,只有经模块内引用链**真正读到这张表**的导出符号才算消费端。旧判据是"提到任一导出符号即算",于是 `packages/shared/src/utils/error-messages.ts` 里返回固定中文、根本不查词表的 `toUserFriendlyMessage` 把 mobile-rn 40 个屏算成了 `errors.*` 的消费端,产出 70 枚 blocking 恒红 —— 而那 14 枚键的出口 `getErrorI18nKey` 全仓零调用方。顶层切分失效与 re-export 两种情形一律**退回全量符号面**(宁可多报,绝不让判据失效表现为"没有消费端"而把红洗成绿),`--self-test` 与镜像测试各含变异对照。取证口径:干净 HEAD(`git archive` 隔离检出)真跑 exit 0,55 张表 54 张结论逐字不变、唯一变化的正是上述那一张;--self-test rc=0 ✅ 33 条(含真语料注入验证)+ 镜像测试 node --test 真跑 rc=0(26 例);紧急跳过 `HUSKY_SKIP_WORD_TABLE_RESOLVABLE=1`(runner skipEnv + 脚本自读 :57)。
- **Agent Engine 协议三方 parity 守门**(无 id,hook :582): `scripts/check-agent-engine-parity.mjs`(blocking) —— JSON-RPC 引擎 handler 表(agent_engine.py 事实源)↔ TS `packages/sdk/src/agent-engine.ts` ↔ Python SDK 的方法/notifications/streaming/error code 常量集合静态对齐,漂移 exit 1(`:216`),hook 以 `--quiet` 跑;真跑全量 rc=0(0s);无 --self-test;紧急跳过 `HUSKY_SKIP_AGENT_ENGINE_PARITY=1`(hook :578)。
- **凭据前缀一致性守门**(无 id,hook :538): `scripts/check-api-credential-prefix.mjs`(blocking,--staged) —— 面向用户文案/示例里 `Authorization: Bearer`/`api_key` 必须 `ihui_` 前缀,`sk_` 仅允许在描述 `X-Api-Secret` 语境,暂存违规 exit 1(`scanFile:160`,作用域 `inScope:145`),全量模式仅报告 exit 0;真跑全量 rc=0(2s);--self-test rc=0 ✅ 20 条规则;无镜像测试;紧急跳过 `HUSKY_SKIP_CREDENTIAL_PREFIX_GUARD=1`(hook :534)。
- **auth refresh 单例守门**(无 id,hook :273): `scripts/check-auth-refresh-singleton.mjs`(blocking) —— 客户端业务代码禁绕过 `refreshAccessTokenOnce` 单例裸发 `/auth/refresh`(fetchApi/fetch/裸 `refreshAccessToken(` 三形态,`scanFile:131`;定义处/后端/测试/token-provider 注入 :98/extension 合法刷新域 :115 白名单),违规 exit 1(`:211`);未真跑(网络 grep 命中 `fetch(` —— 命中行是门自身判据模式串,脚本实为只读,仍按规则保守不跑);无 --self-test;紧急跳过 `HUSKY_SKIP_AUTH_REFRESH=1`(hook :269)。
- **桌面端事件链路接线守门**(无 id,hook :606): `scripts/check-desktop-event-wiring.mjs`(blocking) —— Tauri `.emit("事件名")` → `use-desktop.ts` listen+case+`new CustomEvent` → 前端 `addEventListener`/事件注册表三层对账,任一层断链 exit 1(`:497`,立因托盘主题/设置点击无反应);未真跑(副作用 grep 命中 :62-66 —— 命中为 tee 结果文件回写,脚本主判定只读);无 --self-test;紧急跳过 `HUSKY_SKIP_DESKTOP_EVENT_WIRING=1`(hook :602);另在 `pnpm check:all` 链内。
- **miniapp ICU .replace 反模式守门**(无 id,hook :403 条件 blocking): `scripts/check-miniapp-replace-antipattern.mjs`(blocking,--staged) —— 拦 `t/tt('key', '...{{n}}...').replace('{{n}}',v)` 三命中规则(5 白名单:`t(key,{vars})` 等),staged 新增行命中 exit 1(`main:302`,异常 :305/:384 exit 2),仅 staged 触及 apps/miniapp-taro/src/ 时执行;真跑全量 rc=0(1s);无 --self-test;紧急跳过 `HUSKY_SKIP_MINIAPP_ICU_CHECK=1`(hook :387)。
- **createPortal 定位守门**(无 id,hook :495): `scripts/check-portal-fixed.mjs`(blocking,--staged) —— `createPortal(<div …>)` 定位容器必须显式 `position:'fixed'/'absolute'` style 或 `fixed/` 类(`checkPortalElement:65`;style 引外部变量降级 WARN 留人工 review),违规 exit 1(`:134`);真跑全量 rc=1(0s)红 1 处(`apps/web/src/components/feedback/portal-panel.tsx:147` 缺显式 fixed——全量口径存量待清;hook 实际以 --staged 只咬新增);无 --self-test;紧急跳过 `HUSKY_SKIP_PORTAL_GUARD=1`(hook :491)。
- **mobile-rn global.css token 同步守门**(无 id,hook :348 条件 blocking): `scripts/check-rn-global-css-sync.mjs`(blocking) —— `apps/mobile-rn/global.css` 的 `--color-*` 值与 `packages/design-tokens/src/styles/tokens.css` 逐变量对账(NativeWind 4.x 手抄副本,漂移即视觉 bug),不一致 exit 1(`:117`),staged 触及两文件之一才触发;真跑全量 rc=0(1s);无 --self-test,但镜像测试 node --test 真跑 rc=0(15 例);无应急通道(hook 未设 skip env;头注自述 `--staged` 被接受但语义仍是全量扫描)。
- **SiteFooter 防回退守门**(无 id,hook :471): `scripts/check-site-footer.mjs`(blocking) —— 6 项定稿断言(关键 className 集合/ECOSYSTEM_GROUPS=5 分组/INTERNATIONAL+CHINESE_MODELS import+export/单一 `useTranslations('footer')`/5 语言 footer 键齐),失败 exit 1(`:174`,判定 `check:39`);真跑 rc=0(0s);无 --self-test;紧急跳过 `HUSKY_SKIP_FOOTER_GUARD=1`(hook :467);另有 `pnpm footer:guard`。
- **staged 文件数预检守门**(无 id,hook :44): `scripts/check-staged-files-count.mjs`(warn) —— staged 文件数 > 阈值(默认 10,`--max` 可调)打警告,仅 `--strict` 才 exit 1(`:66`);hook 用 execSync+catch 吞失败,恒不阻塞;真跑 rc=0(1s);无 --self-test;紧急跳过 `HUSKY_SKIP_STAGED_COUNT=1`(脚本自读 :36);⚠️头注"集成位置:.husky/pre-commit 第 0 项"与实际不符(实挂 `scripts/lib/pre-commit-hook.js:44`,且为 warn)。
- **样式改动 Verified-DOM trailer 守门**(无 id,.husky/commit-msg:10): `scripts/check-style-verification.mjs`(warn——wiring `|| true` 吞退出码) —— staged 含 apps/web `.css` 时 commit message 必须带 `Verified-DOM:` trailer,缺失 exit 1(`:79`),缺参数亦 exit 1(`:33`);未真跑(需 commit-msg 文件参数);无 --self-test,但镜像测试 node --test 真跑 rc=0(15 例);紧急跳过 `HUSKY_SKIP_STYLE_VERIFY=1`(脚本自读 :25);⚠️AGENTS.md §17 称"commit-msg hook 自动守门"暗示阻塞,实际接线 `|| true`(hook 注释自述"失败不阻断 commit,仅警告")。
- **Agent SSE 事件契约 parity 守门**(无 id,cert `sse-event-parity` warnOnly:false + `8end-consistency-cert.yml` path 触发 + check:all): `scripts/check-agent-event-parity.mjs`(仅CI) —— 全仓 SSE 生产面(api 路由 `event:` 模板/broadcastSSEEvent/@ihui/types 契约声明/ai-service agents·agent_runtime·langgraph·llm 生产者)提取事件名与消费面监听集合双向对账,漂移 exit 1(`:716`);未真跑(副作用 grep 命中 :77-79 —— 命中为 tee 结果文件回写);无 --self-test;无应急通道(CI 门)。
- **mobile-rn 语言包 key parity 守门**(无 id,cert `i18n-parity-mobile-rn` warnOnly:false + CI path 触发): `scripts/check-i18n-parity.mjs`(仅CI) —— `packages/i18n/messages/mobile-rn` 各语言键集以 `en.json` 为基准做缺失/多余 diff(`getAllKeys:11`),报告写 `tmp/i18n-parity-report.txt`(:62-63);未真跑(写 `tmp/` 报告命中副作用 grep);无 --self-test;⚠️脚本源码无任何 process.exit——退出码恒 0,cert 虽标 warnOnly:false 该判据是否真生效待持有人核;无应急通道。
- **死代码棘轮守门**(无 id,`knip.yml:74` run 步): `scripts/check-knip-ratchet.mjs`(仅CI) —— `knip --reporter json` 分类计数 vs `scripts/knip-baseline.json`(可 `KNIP_RATCHET_TOLERANCE` 加容差),任一项超基线 exit 1(`:182`),knip 不可用/解析失败 exit 2(`:74-99`),`--update` 收紧基线(`:140`);未真跑(基线回写 + 全量 knip 重);无 --self-test;无应急通道(CI 门)。
- **空库全链迁移重放守门**(无 id,`db-from-zero-migrate.yml:93` run 步 + path 触发): `scripts/check-migration-from-zero.mjs`(仅CI) —— 一次性空库按 journal 逐迁移 psql 重放 + `drizzle-kit migrate` 全链 + 迁移后库↔drizzle 元数据表/列双向 diff(`KNOWN_SCHEMA_HOLES` 基线扣减),不 100% 应用或 diff 非空即非零退出(`:719` 为脚本异常态),临时库必定 DROP;未真跑(在生产 PG :8810 建删临时库,§5 测试隔离铁律);无 --self-test,但镜像测试 node --test 真跑 rc=0(16 例);无应急通道(CI 门)。
- **NativeWind 升级就绪监控(反向判据)**(无 id,`nativewind-monitor.yml:45` 定时 + `pnpm nativewind:status`): `scripts/check-nativewind-status.mjs`(仅CI) —— `npm view nativewind dist-tags`,latest 为 5.x stable → exit 1(=升级窗口已到、提醒移除 metro monkey-patch,红≠违规,`:73`);registry 不可达 exit 2 不误报(`:48/:56`);真跑 rc=0(2s,latest 仍 4.x/preview);无 --self-test,但镜像测试 node --test 真跑 rc=0(15 例);无应急通道(监控语义)。
- **!important 禁用守门(CSS 感知版)**(无 id,`style-spec.yml:57` run 步): `scripts/check-no-important.mjs`(仅CI) —— 解析式扫 apps/web 样式(剥注释后),非豁免 `!important` 判违规 exit 1(`:141`,分析 `analyze:62`),豁免仅两类:`prefers-reduced-motion` 块 + 行内 `-- ihui-allow-important: 理由`;真跑 rc=0(1s);无 --self-test;无应急通道(CI 门)。
- **跨端色值 token 漂移对账**(93): `scripts/check-cross-end-tokens.mjs`(blocking,2026-09-24 由 id 90 改号而来 —— 与 SSE 门撞号，守门 89 的 R5 实测抓到) —— RN `rn-tokens.ts` hex ↔ miniapp/web `tokens.css` 按“确定语义相同”映射表逐位比对(hsl→hex 归一、rgba 空格归一、.dark 未覆盖按 cascade 回退),不一致 exit 1(:226/:263);另由 cert `cross-end-tokens`(warnOnly:false)+ CI path 触发 + check:all 承载;真跑 rc=0(0s);无 --self-test;无应急通道(runner 未声明 skipEnv)。
- **button 文本换行浏览器实测守门**(无 id,仅 `pnpm check:button-wrap:browser`): `scripts/check-button-text-wrap.mjs`(手动) —— Playwright 实测各 button 内最深 span 高/单行基线 ratio>1.4 判换行成 2 行,`--strict` 下命中或 server 不可达场景 exit 1(`:318/:393/:461/:468`,算法 `buildDetectFn:188`,探活 `probeServer:255`);未真跑(需 Playwright+dev server,且写临时目录 :351 命中副作用 grep);无 --self-test;无应急通道(不在提交链);⚠️头注称可用于 pre-commit/nightly,当前未接任何提交链。
- **全端杀手锏常量二次写死守门**(无 id,check:all): `scripts/check-killer-parity-ends.mjs`(blocking 语义,仅 check:all 内) —— 扫全部 TS 端源码中绕过 `tunables.py`→`constants.ts` 单源直接硬编码同值的"二次写死"(白名单显式豁免),违规 exit 1(`:156`,`--warn-only` 降级);真跑 rc=0(0s);无 --self-test;无应急通道。
- **mobile-rn 硬编码 hex 基线棘轮守门**(无 id,check:all + `pnpm check:rn-parity`): `scripts/check-mobile-rn-style-parity.mjs`(blocking 语义,仅 check:all 内) —— RULE-1 基线外新增 `#hex` 字面量即 BLOCK(exit 1,`scanFile:98`,基线 `scripts/rn-style-parity-baseline.json` 只减不增,`--update-baseline` 收紧 :130),RULE-2 基线失条目 WARN;未真跑(--update-baseline 回写命中副作用 grep);无 --self-test;无应急通道。
- **侧边栏导航死链守门**(无 id,check:all + `pnpm check:nav-dead-links`): `scripts/check-nav-dead-links.mjs`(blocking 语义,仅 check:all 内) —— `nav-data.ts` 全部 href 必须能在 apps/web/app 推出 page 路由((group)/_private 不占段、动态段通配 `toRoutePattern:59`),死链 exit 1(`:103`);真跑 rc=0(1s);无 --self-test;无应急通道。
- **workspace 包可安装性自检**(无 id,仅 `pnpm check:pkg-installable <pkg>`): `scripts/check-pkg-installable.mjs`(手动,发布前硬闸) —— 真 `npm pack` + 解包 8 项判据(dist 双产物在包内/不含 src/无凭据噪音/无 `workspace:` 残留/LICENSE+NOTICE/ESM 相对 import 带扩展名/manifest 名版一致),blocker exit 1(`:190/:201`),脚本异常 exit 2(`:167`),private 只提示不计红;未真跑(npm pack+mkdtemp 解包 :174 命中副作用 grep);无 --self-test,但镜像测试 node --test 真跑 rc=0(14 例);无应急通道。
- **自写 popover data-state 守门**(无 id,check:all + `pnpm check:popover-trigger-data-state`): `scripts/check-popover-trigger-data-state.mjs`(warn/手动,--staged 才 blocking) —— 含 `createPortal(` 且不 import Radix 的文件必须手挂 `data-state` 属性(`classifyFile:111`),全量模式 WARN exit 0,`--staged` 新增违规 exit 1(`:209`);真跑(全量)rc=0(0s);无 --self-test;紧急跳过 `HUSKY_SKIP_POPOVER_DATA_STATE=1`(脚本自读 :47)。
- **web 死 i18n key 审计别名 wrapper**(无 id,wiring 仅 template 层引用): `scripts/scan-web-dead-i18n-keys.mjs`(手动别名) —— 自身零判据:转发全部参数到 `scan-dead-i18n-keys.mjs --target=web` 并透传退出码(`:11-15` spawnSync,status 透传),实际判据/报告在统一入口(check:all 走 `--target all --exit 1`,CI 审计 workflow 跑其镜像测试);真跑 rc=0(3s,经委托链);无 --self-test,但镜像测试 node --test 真跑 rc=0(7 例)(其本体);无应急通道;⚠️门 89 判其接线为 template 弱接线,登记时勿当作独立闸。
- **守门接线层对账**(89): `scripts/check-gate-wiring.mjs`(blocking) —— 本门是其余全部守门的"装车检",查接线层四类结构缺陷:**R1/R2** 脚本头部或 AGENTS.md 声称"已接 pre-commit/pre-push/CI 必跑/第 N 项"而五处权威点(`guardian-runner` 的 `script:` ∪ `scripts/lib/pre-commit-hook.js` ∪ `.husky/*` ∪ 根 `package.json` ∪ `.github/workflows`+cert)全部零命中 → 拦;**R4**(2026-09-24 由"仅报数"升档,前置=真仓缺口 48→0 已清零)门已接线但 AGENTS.md/README.md 通篇未点名 → 拦(判据刻意宽松:出现去后缀同名即算,故只会漏报不会误拦);**R5** 同一 `id` 登记两道门 → 拦(串 skipEnv 与失败归属);**R7** 台账 `type=dispatcher` 的依据文件不存在或文件里没提该脚本 → 拦。R3(五处零命中且无肯定式声称)/R6(共用 skipEnv)/弱接线(仅 CI)只如实报数不判红。**取材口径分两面**:接线面(哪些脚本被登记为已接)一律按 **HEAD** 判 —— 共享工作区的工作区文件会滞后,产出相反结论;而**文档面**(AGENTS.md / README.md 有没有点名)按 **HEAD ∪ 索引**判(2026-09-24 改),因为"同一枚提交里既注册新门又补点名行"是正确姿势,只读 HEAD 会让这枚提交被自己判红 ⇒ 逼人 `--no-verify` ⇒ 全部守门作废;索引取不到退回 HEAD,口径在结论行如实报出,且**绝不读工作区**(只躺在工作区没 `git add` 的文档行不算点名,已由自检 M9d/M9e 一红一绿的可逆对照钉死)。;台账 `scripts/gate-wiring-allowlist.json` 只能救 R3,凡声称已接线者台账不救。⚠️ 本门对自身 `SELF_EXEMPT`(创建当期 HEAD 里还没有它),所以"它自己被摘线"由镜像测试 T13 钉死。真跑 `node scripts/check-gate-wiring.mjs` exit 0(已接线 143 / 台账豁免 13 / R4 0 枚,数字以命令末行现测为准);自检 `--self-test`(例数以末行为准,含 M8a/M8b 的 R4 双向端到端证明 + M9a-M9e 的文档取材口径五形态对照)+ `node --test scripts/tests/check-gate-wiring.test.mjs`(例数以末行为准,含 T13 装车证明与 T14/T15 取材对照);紧急跳过 `HUSKY_SKIP_GATE_WIRING=1`。
- **跨端主题透线对账**(91): `scripts/check-theme-prop-wiring.mjs`(blocking) —— packages/app 的主题驱动组件(形参解构含 `colorScheme` 且一律带 `= 'light'` 默认值)必须在每个 JSX 渲染点被**真的传参**:默认值就是"静默失效开关"，写死或漏传都不报错、typecheck 也不红。拦两类真事故形态 —— L1 调用方写死 `colorScheme="light"`(实测导航栏深色而页面体浅色，同一屏两套档案)、L2 漏传(当前 0 处，本门把它钉死在 0；刻意不把 213 处形参改成必填:无收益且会与并行会话在 213 个文件上对撞)。组件集**不靠手工清单**(清单过期正是上一道门漏判的原因)，改为扫 `packages/app/src` 导出组件名 + **import 解析**(含 alias / 默认导入 / 命名空间成员)，只有解析到 `@ihui/rn-app` 或包内相对路径才算共享主题组件 —— 端内同名自绘版(NavBar/TabBar/Carousel/UserInfoCard)因此不会误判；`{...spread}` 转发的渲染点单列「不确定」如实报数(不静默放过、也不误判为红)。实测真仓 `--staged` exit 0；应急跳过 `HUSKY_SKIP_THEME_PROP_WIRING=1`。

- **顶部状态栏避让单一源头**(97):`scripts/check-statusbar-single-source.mjs`(blocking,2026-09-24 立)—— 真机实测(Redmi 720x1640 / density 320)状态栏 inset = 68px = **34dp**;而 399 个 `*Screen.tsx` 里真读 inset 的只有 3 个:83 处在页头/根容器写死 `paddingTop: 48` 硬蒙量级(换机型即失配)、113 处完全没有顶距 ⇒ 页头与系统时钟/电量**叠字**。**唯一注入点 = `apps/mobile-rn/App.tsx` 的 `<SafeAreaView edges={['top']}>`**;状态栏是平台概念,所以 `packages/app`(跨端共享屏)一律不碰顶距,共享层 NavBar 那个默认 0、零调用方的 `statusBarHeight` prop 属第二个真相源,**已删**,不得再加回。三判据:**S1** 单点在位(该文件必须真有 `SafeAreaView` 且 `edges` 含 `'top'` —— 防"装好被摘线",机制不在而门仍报绿等于没有)/ **S2** 第二取值口(代码里出现 `StatusBar.currentHeight` 或 `statusBarHeight` 即红;前者 iOS 恒 `undefined` ⇒ 0)/ **S3** 魔法顶距(`container|page|root|wrapper|header|headerRow|screen|body` 的对象内 `paddingTop: 24..60` 字面量即红,**零容忍** —— 83 处已随本票清零,所以不需要基线)。口径同守门 77/83:全量判 HEAD blob、`--staged` 判索引 blob,不判滞后的共享工作树。行内豁免 `statusbar-exempt: <一句话原因>`(**M2:逐行生效且必须带原因**,一行标记救不了同文件另一处)。**M1 泄压阀**:含 JSX `<Modal` 的文件(Drawer/SideMenu/BottomPops/HandPlatePops 等)渲染在导航树外、不继承单点,其顶距命中只报数不判红(`--all` 逐条列出);注释里提 `<Modal` **不配豁免**。S2 的 `statusBarHeight` 只拦"布局取值"(`paddingTop/top/marginTop/= …`),共享层"调用方注入、默认 0"的 prop 声明不判红。扫描面为整包 `packages/app` + `apps/mobile-rn`(App.tsx 自身也在 S2/S3 射程内);全量经一次 `git grep` 预筛(627→87,38s→5s,模式串为判据字面量严格超集,筛不动退回全量)。取证 `--self-test` **40 例**(含 Modal 豁免、逐行豁免、单点被摘等 E2E 阳性对照)+ §22c 镜像测试 12 例(装车证明 + `--json` 可 parse + AGENTS/README 点名)。**两条写门过程中的教训值得留**:① 第一版"沉浸式豁免名单"是拿"出现 `position:'absolute'` + `top:0`"探的,8 个候选全是假阳(命中的是眼睛按钮和下拉框)—— 判据探不到就别硬编,默认值本身就是正确答案;② `readFileSync` 漏 import 被外层 `catch` 吞成"取不到内容",一个编码错误伪装成业务结论,故**工作树面不得套 try**。紧急跳过 `HUSKY_SKIP_STATUSBAR_SINGLE_SOURCE=1`。
- **暂存删除存续性对账**(99):`scripts/check-staged-deletions.mjs`(blocking,2026-09-24 立,Agent A 交付)—— 堵守门 65(整树删除拦截,只看规模 ≥1000/≥20%)与 `heal-worktree-tracked`(对暂存删除按设计"只报数、不代裁")之间的**空档**:删除规模不大、但仓库仍在引用它的暂存删除(`D `),任何人跑一次不带 pathspec 的普通 commit 就把已入库的功能与测试从版本树里删掉 —— 一次静默回滚,而 `git status`/diff/守门 65 全都看不见。判"误删"依据两条同时成立才判红:**E1 引用仍在**(索引 blob 里的相对 import / require / 动态 import / barrel `export *` / 别名路径含父目录名 / 整仓库路径字面量,覆盖代码+配置,`.md` 叙述与夹具/产物/记账 JSON/生成物不算)∧ **E2 无替代路径**(同名同后缀文件不在索引其他目录,有 = 已迁移放行)。只成立一条 → 不计红但**如实报数**(绝不静默成"看起来全绿");引用方(barrel)自己也一起删 = 正当删除形态,放行。护栏:名字 <4 字符 / 候选引用方 >2000 / 删除面 >400(那是 65 的地盘)一律 `undetermined` 只报数;豁免清单 `scripts/staged-deletions-allowlist.json`(坏 JSON 显式报错,不静默当空清单)。**不加 stagedTriggers —— 暂存删除可触及任意路径,任何提交都不得跳过**。口径:判索引 blob(与 70/77/83 同取向),全程只读。取证 `--self-test` 33 例(正反成对:barrel 仍 export 必红 / 引用方一起删必绿 / 歧义、注释、夹具、生成物各一反例)+ §22c 镜像测试 `scripts/tests/check-staged-deletions.test.mjs` 12 例(含"未注册时绿、注册后必须 blocking + skipEnv"的装车前置断言)。紧急跳过 `HUSKY_SKIP_STAGED_DELETIONS=1`。
- **合并新增文件存续性对账**(100):`scripts/check-merge-addition-loss.mjs`(blocking,2026-09-24 立)—— 堵的是**合并提交在文件面上的静默吞并**,与守门 71(只管 PROJECT_PLAN 登记行)、84(只管「暂存内容 == 祖先 blob」)都不重叠:2026-09-24 实测一枚写着「台账按 union 归并,双方每一行均存活」的合并 `9a0f7610e9`,把对侧**独有的 35 个新增路径整批抹掉**、连带 72 个文件回退成旧基线(相对共同祖先净 **−12014 行**),而它**不产生冲突、也不进 diff 报告** —— 「一侧新增、另一侧从未有过」的路径在「取某一侧整棵树」的合并里会直接消失。判据一条,且结构上排除了误伤正常合并:**A1** 路径 P ∈ 某父提交树 ∧ P ∉ 本次合并的共同基底(`git merge-base --all <parents>`)⇒ P 必须 ∈ 合并结果;「∉ 基底」正是把「对侧曾删除它」这一唯一正当解释排除掉。真要在合并里删除,必须**合并之后**单独 `git rm`(那时所有父都不含它,自动放过)。**口径是本门的生命线**:默认只判 `origin/main..HEAD` 里的合并 —— 已入库的历史事故若每轮重判,会让之后每一次提交恒红,唯一结局是人人绕过钩子、连带废掉全部守门;别人推来的合并由 `--all-new` 增量台账(`.workbuddy/merge-addition-loss-audited.json`)判到**一次**,`--limit N` 留给人工回看。取证 `--self-test` 9 例(真临时仓:正常合并必绿 / 整树回写必红并点名 / 未推必拦与已推必放用同一条判据 / 台账不重复判红)+ §22c 镜像测试 5 例。含两条**写门时自己踩到**的缺陷:① `rev-list --parents` 的第一个 token 是提交**自己**,`slice(2)` 会把合并误判成单父 ⇒ 整门恒绿;② 树缓存键必须先剥到 tree oid,按 `'HEAD'` 这种符号名缓存会在 ref 移动后读到旧树(自检第一轮就是把真事故判成了绿)。紧急跳过 `HUSKY_SKIP_MERGE_ADDITION_LOSS=1`。
- **本轮四道门的口径/落点收口(2026-09-24 立,一批内完成)**:① **守门 94 `check-error-code-coverage.mjs`** 此前**以 uncaught 异常 exit 1 冒充判据失败**——成因不在判据,而在它按磁盘读输入,而共享工作树的 `packages/i18n/messages/web/zh-CN.json` 副本滞后 HEAD(HEAD 有 `ai.pane.errorCatalog`)。现统一为 `makeFaceReader` 单一取材层(默认 **HEAD blob** / `--staged` 判索引 / `--worktree` 仅逃生舱,两个面旗同给判死),清单与内容同面同轮;取不到输入 ⇒ `UndeterminedError` ⇒ **exit 2 显式"无法判定"**,绝不冒烟成判据红也绝不记绿。② **守门 84 `check-stale-revert.mjs` 的 `MAX_FILES=300` 护栏原先一超限就整门跳过**,而共享工作区常年滞后数百文件 ⇒ 恰在最需要它的时候失明;现把**乘数级路径**(`guardian-runner.mjs` / 各道 `check-*.mjs` / `scripts/lib/` / `.husky/` 钩子 / 根 `package.json` / `pnpm-*.yaml` / `.github/workflows/` / 门的测试)从护栏里摘出来恒照判——它们被写回旧版不表现为"少一个功能",而是**一批守门静默失效**(当天 `guardian-runner.mjs` 落后 61 行、离一次 `git add` 只差一步)。③ **`union-converge` 的"对侧自己动过"原以文件为粒度**,两侧同改同一文件会整文件取对侧而丢本侧改动;现走 `git merge-file` 真三方,**冲突/二进制/非普通 mode 一律折进落地闸并点名文件**(不猜、不选边),另加第四条断言 `lostAddedLines` 保住两侧相对基底的新增行。④ **`git-guardian` 有了真实的到人出口**(见 §5e:它此前在"现役生产者清单"里挂着名字却零命中):判红经 `notify-deploy-failure.ts` 派发,按 alert 身份 + 内容指纹 4h 去重、未送达 30min 退避、**无每日总量封顶**,发信失败不改自愈与退出码。取证:门 94 镜像 6 例 / 门 84 镜像 4 例(含"顶过上限仍判红"与"真新编辑不判红"成对)/ union 自检 20 例 + 镜像 9 例 / 守护通知镜像 19 例;两门新入守门 80 的 HOT 清单(它们现在派生 git)。
- **合并吞并的修复出口 `scripts/union-converge.mjs`**(2026-09-24 立,守门 100 的另一半)—— 判据只说"红了",不修就等于把红留给下一个人(§12e 同型)。构造是**集合运算不是启发式**:合并树 = 本侧整棵树 ∪ 对侧「相对共同基底自己动过的路径」逐个取对侧版本 ∪ 活文档(PROJECT_PLAN / AGENTS / README)按「每行重数 = max(ours, theirs)」union;**对侧的删除不随合并传播**(确要删必须在合并之后显式 `git rm`,那才是 A1 认得的合法形态)。落地前自证 `丢本侧路径 = 0 ∧ 丢对侧路径 = 0 ∧ 三份文档未存活行 = 0`,落地后**用守门 100 本人的 A1 复核这枚合并**(用它的判据验它的产物);写盘一律临时索引 + commit-tree + CAS update-ref,从不 checkout、不碰共享工作区(§12d)。触发点两处:① `git-sync-converge` 的 merge-tree **冲突分支**先交它归并,收不住才退回"需人工"(人工最容易犯的错就是选边,而本次事故正是这么来的);② `git-guardian` 每轮的 `auditMergeAdditionLoss()` 调 `check-merge-addition-loss.mjs --all-new` 增量台账 —— 提交链上那道门按设计只判未推的合并,而 converge / 手工 commit-tree **不跑钩子**,别人造好推来的合并只能靠这一层看到一次(**只判不修**:自动重做合并风险远大于收益)。取证 `--self-test` 8 例 + §22c 镜像测试 4 例(含"选边式合并必须判失败"反向对照与两条挂点装车证明);手动:`node scripts/union-converge.mjs [--apply|--theirs <sha>|--self-test]`。

- **prod-bundle 影子副本对账**:`scripts/check-prod-bundle-shadow.mjs`(2026-09-24 立;**2026-09-25 接进提交链 = guardian id `104`,blocking,紧急跳过 `HUSKY_SKIP_PROD_BUNDLE_SHADOW=1`**)—— 此前它只挂在 `pnpm check:all`,`grep -c check-prod-bundle-shadow scripts/guardian-runner.mjs` = 0,即"门存在、判据正确、没有任何调度器跑它",正是本仓最高频的**造好没装车**。§5e 那句"落进 `deploy/prod-bundle/` 的运维脚本必须同时落一份入库源,否则等于写进盲区"从此才有尺子。本门登记「入库源 ↔ 生产实际执行的那份」逐字节必须等值,判据:S0 入库源缺失(跟踪文件,任何检出都该在 ⇒ 判红,不是机器态)、S1 入库源必须真被 git 跟踪(不被跟踪就没有对账对象)、S2 运行副本必须真被忽略(否则登记表过期)、S3 两侧 sha1 全等,不等即红并点名两侧路径。**退出码按"机器态 vs 内容态"三态分流**:整目录 `deploy/prod-bundle/` 被 `.gitignore` 忽略 ⇒ 运行副本**只存在于部署机**,若在非部署机/CI/干净检出上判红,结局是逼人 `--no-verify` 连带 130+ 道门全废(§4/§12e 同型),故"缺运行副本"= **未判定,exit 0 但逐条喊出原因**(禁静默绿,也禁静默红);git 问不到 = exit 2 优先于 1。聚合抽成导出纯函数 `decide()`,机器态分流可用构造输入证明、不必真机改名。刻意**不挂 `stagedTriggers`**:会漂移那侧是被忽略的运行副本,结构上永不出现在暂存区,按 staged 收窄等于放过本门立门那一型。首跑抓到并入库的是数据库备份那一对:`deploy/prod-bundle/pg-backup{,-scheduler}.ps1`(整目录被忽略、全仓零入库源,而它每天 03:00 产出 94MB 生产库 dump)。本门**刻意没有改成转发壳**——把 runner 换成转发壳后重启服务,`pg_dump` 出现 3.5 分钟零输出挂死(旧 runner 同库同日 34 秒跑完),在解释清之前不动生产备份;因此两侧都是全文,靠本门钉住等值。自检 `--self-test`(例数以命令末行现测为准,含"入库源被摘线必红""缺运行副本计未判定不判红"成对正反例;**必须连跑两次**——该门曾 `--self-test` 第二次起恒 exit 2,只能跑一次的取证等于没取证)。
  - 同批登记两条实测事实,免得下一个人重新猜:(a) 备份脚本靠什么凭据认证**至今没答上** —— 脚本显式 `$dbPw = ""`、注释写"pg_hba 本地 trust 免密",而实测机器级与用户级都没有 `PGPASSWORD`、`systemprofile` 与 Administrator 下都没有 `pgpass.conf`、`postgres` 对错误口令回 `password authentication failed`、空口令被拒;任何**带控制台上下文**的 `pg_dump`/`psql` 会阻塞在口令提示(`stdin` 重定向也拦不住,libpq 走 ReadConsoleW)。兜底不是没有:`apps/api/src/services/alert-check-service.ts` 巡检两条备份链目录,判"备份缺失 / 0 字节"并走邮件。(b) 调度器 `Run-Backup` 用 `& script.ps1` 调子脚本,而 PowerShell 的 `&` **不因被调脚本 `exit 1` 抛异常** ⇒ `catch` 永不触发;实测一次真实失败(日志先打 `[ERROR] 备份失败`)之后仍打"备份完成"。修它要改生产 runner 并重启服务(该服务"启动即备份"),与凭据问题一并处理。

### 守门手动触发 / 紧急跳过抽查

- **手动触发全量守门**:`node scripts/guardian-runner.mjs --staged`(pre-commit 模式,传给所有脚本);不带 `--staged` 为全量扫描。
- **执行语义(2026-09-22 由 fail-fast 改为跑完再汇总)**:任一 blocking 门失败不再中断本轮 —— 全部 96 项跑完后末尾列「失败门清单 + 单独复现命令」再 exit(1)。原 fail-fast 会遮蔽其后所有门(实测同一工作区真实存在 5 道红,旧行为只显示 1 道,且让人误判"新注册的门没生效")。**两条不变量**:① 子门 `exit 75`(中断)仍**立即**以 75 向上传播,不收敛成 1(§5b ⑦ 的 push guard 重试链依赖它);② 逃生舱 `GUARDIAN_STOP_ON_FIRST=1` 完整恢复旧的"首个失败立即 exit(1)"。绿的路径耗时不变(原本就要跑完),仅失败轮次变长。
- **commit 污染防护(scope 一致性)**:`.husky/commit-msg` 的 `check-commit-scope-consistency.mjs`(AGENTS.md §16 配套);紧急跳过 `HUSKY_SKIP_SCOPE_CHECK=1 git commit ...`。
- **commit 丢失防护**:guardian 第 30a 项 `check-commit-loss-guard.mjs`(AGENTS.md §22 配套);紧急跳过 `HUSKY_SKIP_COMMIT_LOSS_CHECK=1 git commit ...`。

> post-commit 钩子:`git-push-guard.mjs` 自动 push + 验证 local == remote(见 §20)。

---

## 26. C 盘防护强制规则(强制)

### 触发背景(2026-07-27 立,真实事故)

C 盘 120 GB 频繁告急,根因排查发现:

- **第三方 AI IDE 自身缓存 12.88 GB**(国内版 CN 7.68 + 旧版 3.46 + 国内旧版 1.74)
- **Chrome OptGuideOnDeviceModel 4 GB**(Chrome 内置 AI 模型,用户不用)
- **Local\Temp 累积 1.6 GB**(第三方 AI IDE 旧版安装包 + pip 安装临时)
- **项目历史违规写入 `C:\temp\ihui-*` 0.33 GB**

已通过环境变量迁移 + 符号链接 + 自动维护计划任务根治。

### 开发工具缓存路径强制规则(强制)

**所有开发工具的全局缓存/存储/临时目录必须指向 D 盘**(2026-09-23 全量实测校正 —— 下表旧版写的
`D:\caches\*` 是**死路径**,本机不存在 `D:\caches`,且 `CARGO_HOME`/`RUSTUP_HOME`/`OLLAMA_MODELS`
当时**根本没设**,即"文档说已迁、实际还在 C 盘";真实外置根是 `D:\DevEnv\`)。

| 工具                | 环境变量 / 配置                             | 实测路径                                                                            |
| ------------------- | ------------------------------------------- | ----------------------------------------------------------------------------------- |
| Temp/TMP            | `TEMP` / `TMP` / `TMPDIR`                   | `D:\DevEnv\Temp`(2026-09-23 才真正写入 HKCU)                                        |
| pnpm                | `PNPM_HOME` + `pnpm store path`             | `D:\DevEnv\tools\pnpm`,store=`...\pnpm\store\v11`                                   |
| npm                 | `npm config`                                | `D:\DevEnv\cache\npm`                                                               |
| pip                 | `PIP_CACHE_DIR`                             | `D:\DevEnv\cache\pip`                                                               |
| uv                  | `UV_CACHE_DIR`                              | `D:\DevEnv\cache\uv`                                                                |
| Cargo               | junction(`%USERPROFILE%\.cargo`)            | `D:\DevEnv\cache\userhome\.cargo`                                                   |
| Rustup              | junction(`%USERPROFILE%\.rustup`)           | `D:\DevEnv\cache\userhome\.rustup`                                                  |
| Maven/.m2           | junction(`%USERPROFILE%\.m2`)               | `D:\DevEnv\cache\userhome\.m2`                                                      |
| Codex/.cache/.codex | junction                                    | `D:\DevEnv\cache\userhome\{.cache,.codex,.codex-session-delete}`                    |
| Trae 全家           | junction(`.trae`/`.trae-cn`/`.trae-aicc`)   | `D:\DevEnv\cache\userhome\`                                                         |
| DeepSeek CLI        | junction(`%USERPROFILE%\.deepseek`)         | `D:\DevEnv\cache\userhome\.deepseek`                                                |
| Ollama(含服务)      | junction(`%USERPROFILE%\.ollama`)           | `D:\DevEnv\cache\ollama`(服务 `OLLAMA_MODELS` 路径经 junction 解析)                 |
| IHUI CLI 状态       | junction(`%USERPROFILE%\.ihui`)             | `D:\DevEnv\cache\userhome\.ihui`                                                    |
| 桌面端 Local 态     | junction(`%LOCALAPPDATA%\com.ihui.desktop`) | `D:\DevEnv\cache\userhome\appdata-local-com.ihui.desktop`(515 文件/39.25MB)         |
| 桌面端 Roaming 态   | junction(`%APPDATA%\com.ihui.desktop`)      | `D:\DevEnv\cache\userhome\appdata-roaming-com.ihui.desktop`(auth/tray/window-state) |
| **服务身份 TEMP**   | **没有 env 可改**(HKCU 迁移对它无效)        | 必须显式选目录 + 用完删除,详见下方"junction 管不了身份"                             |
| Go                  | `GOPATH` / `GOMODCACHE` / `GOCACHE`         | `D:\DevEnv\cache\go{,\pkg\mod}` / `...\go-build`                                    |
| Playwright          | `PLAYWRIGHT_BROWSERS_PATH`                  | `D:\DevEnv\cache\playwright`                                                        |

| 工具                | 环境变量 / 配置                           | 实测路径                                                            |
| ------------------- | ----------------------------------------- | ------------------------------------------------------------------- |
| Temp/TMP            | `TEMP` / `TMP` / `TMPDIR`                 | `D:\DevEnv\Temp`(2026-09-23 才真正写入 HKCU)                        |
| pnpm                | `PNPM_HOME` + `pnpm store path`           | `D:\DevEnv\tools\pnpm`,store=`...\pnpm\store\v11`                   |
| npm                 | `npm config`                              | `D:\DevEnv\cache\npm`                                               |
| pip                 | `PIP_CACHE_DIR`                           | `D:\DevEnv\cache\pip`                                               |
| uv                  | `UV_CACHE_DIR`                            | `D:\DevEnv\cache\uv`                                                |
| Cargo               | junction(`%USERPROFILE%\.cargo`)          | `D:\DevEnv\cache\userhome\.cargo`                                   |
| Rustup              | junction(`%USERPROFILE%\.rustup`)         | `D:\DevEnv\cache\userhome\.rustup`                                  |
| Maven/.m2           | junction(`%USERPROFILE%\.m2`)             | `D:\DevEnv\cache\userhome\.m2`                                      |
| Codex/.cache/.codex | junction                                  | `D:\DevEnv\cache\userhome\{.cache,.codex,.codex-session-delete}`    |
| Trae 全家           | junction(`.trae`/`.trae-cn`/`.trae-aicc`) | `D:\DevEnv\cache\userhome\`                                         |
| DeepSeek CLI        | junction(`%USERPROFILE%\.deepseek`)       | `D:\DevEnv\cache\userhome\.deepseek`                                |
| Ollama(含服务)      | junction(`%USERPROFILE%\.ollama`)         | `D:\DevEnv\cache\ollama`(服务 `OLLAMA_MODELS` 路径经 junction 解析) |
| IHUI CLI 状态       | junction(`%USERPROFILE%\.ihui`)           | `D:\DevEnv\cache\userhome\.ihui`                                    |
| Go                  | `GOPATH` / `GOMODCACHE` / `GOCACHE`       | `D:\DevEnv\cache\go{,\pkg\mod}` / `...\go-build`                    |
| Playwright          | `PLAYWRIGHT_BROWSERS_PATH`                | `D:\DevEnv\cache\playwright`                                        |

**改道机制定为 junction,不 env 优先**:家目录工具态一律 `robocopy <src> <dst> /E /MOVE` →
`mklink /J <旧路径> <新路径>`。理由:工具态常有**硬编码**读取方(如 `~/.cargo\bin` 在
`HKCU\Environment\Path` 首位、守门脚本按 `%USERPROFILE%` 拼路径),junction 让旧路径继续可解析,
因此**不需要也不允许**去改 `Path` 或逐个改码;改环境变量反而会造出"双根分裂"。
校验方法:`rustup show home`、`reg query HKCU\Environment`、`(Get-Item ~\.cargo).Attributes -match ReparsePoint`。
新增工具的缓存落点一律走 `D:\DevEnv\cache\userhome\<名称>` + junction,不得再在家目录留实体目录。
**盘根"写歪项"一律封口改道,不许只删(2026-09-24 立)**:第三方程序(剪映、微信输入法、MSYS 侧工具、
各类安装器)用**相对路径**写自己的状态,而进程工作目录恰好是 `C:\` ⇒ `common_attachment`、
`persistent_data`、`tmp`、`tools` 直接长在盘根。**这类残骸删掉必然复发,因为成因改不了(闭源)**。
唯一正解是把那个名字换成 junction 指向 §15b 落点 —— 程序按原路径读写不变,内容落到 D 盘。
清单与执行的唯一入口是 `scripts/seal-c-root-stray.mjs`(`--check` 零副作用 / `--apply` 幂等,
**换机或重装后需重跑一次**),守门与 `c-drive-auto-maintain.ps1` 第 4 段都 import 同一份清单,
**禁止在别处再抄一份名字**。发现某新残骸也属这一型:加进 `SEALED_DIRS`(必须带 `owner` + `evidence`
两项取证)而不是写进删除名单。
**封口必须同时挂进 `git-guardian` 的自愈轮(2026-09-24 实测)**:`--apply` 做的 junction **会被重启清掉**
(当天 4 个里死 3 个,D 侧内容完好)。只靠每日 03:00 体检 = 最长 23 小时空窗,够第三方自建真目录回到
复发原点。正解是第三层 `healRootSeal()` 挂在 `git-guardian` 的 `!CHECK_ONLY` 分支(与
`healWorktreeTracked` 同位,2 分钟一轮),`seal --check` 判红才 `--apply`;挂点写成 CHECK_ONLY
路径等于永不执行(工作区自愈层踩过同一坑),三条装车证明由 `scripts/tests/seal-c-root-stray.test.mjs` 钉死。
**⚠️ junction 的头号危险是"被递归穿透"(同日实测)**:PowerShell 7 的 `Get-ChildItem -Recurse`
**会穿过 junction** 枚举到目标里的文件,于是"按名字删 `C:\tmp\ihui-*`"会顺着链接清空 D 盘真实目标,
把改道机制变成自毁机制。三条要求:① 任何递归删除/枚举前必须判 `ReparsePoint`,重解析点只能
`[System.IO.Directory]::Delete($path, $false)` 断链;② 量体积的工具遇 junction **不得跟随**
(否则把 D 盘的量报成 C 盘的债);③ Node 侧 `lstatSync(p).isSymbolicLink()` 对 junction 报 `true`,
`rmSync(link)` 只断链不穿透(均已实测)。判据由 `seal-c-root-stray` 与 C 盘污染守门的镜像测试钉死。
**要藏住 junction 的名字,只能用 PowerShell 提供器 + 父目录枚举复核(2026-09-24 实测)**:用户选择
"设隐藏,保留改道"后,`attrib +h <junction>` 是**陷阱** —— 它把 Hidden 设到**目标**那一侧,链接本体
纹丝不动,而 `attrib` 回显时又顺着链接读目标,于是打印出 `H` 让调用者以为成功了(本仓第一版就这样
"隐藏了 4 次",C 盘那 4 个名字照旧可见,反倒把 D 盘的 4 个数据目录藏掉了)。正确做法:
`(Get-Item -LiteralPath <链接> -Force).Attributes = $i.Attributes -bor [System.IO.FileAttributes]::Hidden`,
并且**唯一可信的 oracle 是父目录枚举** `Get-ChildItem <父目录> -Force`(那正是 Explorer 读的那份目录项
属性)—— 设完必须自己回读,不许把"没抛错"当成成功。隐藏只影响浏览,穿透读写与
`isSymbolicLink()` 判定均不受影响(已实测)。策略固化在 `seal-c-root-stray.mjs` 的 `setLinkHidden`,
每次 `--apply` 都确保在位(封口被重建也不会露回来),镜像测试断言源码里**不得再出现 `attrib`**。
**改页面文件必须留"待重启生效"哨兵(2026-09-24 立)**:本机 C/D 两个 pagefile 都是**手设固定值**
(C 32768MB / D 98304MB)而非系统管理。要缩 C 的占用,改的是
`HKLM\...\Session Manager\Memory Management\PagingFiles`(用 `Set-CimInstance Win32_PageFileSetting`
写入,回读该注册表值才算落盘)—— 但**内存管理器运行期锁住 pagefile.sys,磁盘上的旧大小只有重启才收缩**,
而本机是生产机(20+ 个 IHUI-* 服务在跑),重启时机归用户。所以任何这类改动都必须同时留一条
会自我清空的哨兵:比对「配置上限 vs WMI `Win32_PageFileUsage.AllocatedBaseSize`」,落差 >512MB 且 >25%
就报「待重启生效」,缩到位后不再报。**量这个大小有三连坑,都不报错、只给假绿**:`fs.statSync` 对
`pagefile.sys` 必报 `EINVAL`(打不开句柄);`cmd /c for %A in (...) do %~zA` 会被 Node 的加引号 +
cmd 剥首尾引号的双层规则打掉;属性名写成 MSDN 文档的 `AllocBaseSize`(本机真名是
**`AllocatedBaseSize`**)会被 PowerShell 静默渲染成空串。三条已由守门 `--self-test` 与镜像测试钉死,
且"一条都没量到"必须打印**未判定**、绝不记为通过。
**⚠️ junction 只管"路径",管不了"身份"(2026-09-24 实测的第四类真因)**:同一个 `$env:TEMP` /
`os.tmpdir()` 在**不同身份下指向不同目录** —— HKCU 把交互账户 TEMP 迁到 `D:\DevEnv\Temp` 之后,
nssm 服务(IHUI-API / IHUI-DEPLOYLOOP 以 LocalSystem 运行)拿到的仍是 `C:\Windows\Temp`。
**任何"改成 `$env:TEMP`"式修复对它只是往 C 盘内部挪坑。**所以三条硬要求:
① 服务/守护类脚本若要落临时物,必须**显式指定目录**,不能信任 `$env:TEMP`;
② **用完必须删** —— 实测反例:`deploy/win/ihui-deploy.ps1` 把构建 stdout/stderr 重定向到
`$env:TEMP` 的 `ihui-next-build-<PID>-try<N>-{out,err}.log`,Tail 进 deploy-loop.log 之后**从不删除**
⇒ 部署环每 30 分钟漏 2 个,`C:\Windows\Temp` 攒到 **526 项 / 6.86MB**(同文件里的
`ihui-align-$PID.log` 反而有删,所以泄漏面精确到构建这一处;2026-09-24 已改为用完即删,
并现场观察到一轮构建结束后该 2 个文件自动消失);
③ **守门必须扫"服务身份的 TEMP"** —— 守门 `check-c-drive-pollution.mjs`(编号同日漂移过
同日三次撞号)此前只扫 `tmpdir()`,即"看门人自己的 TEMP",于是它一路报"本项目产物 0 项"
而真凶全在 `C:\Windows\Temp`。现 `tempScanDirs()` 显式并入 `SystemRoot\Temp` 并由 `--self-test`
钉死(扫描面缩回去即红)。**同批修掉这条门自身的两处假绿灯**:同一目录因大小写被计两次
(`C:\windows\Temp` 与 `C:\Windows\Temp` ⇒ 实测 1056 项 vs 真实 526,按小写键去重)、文件一律
记 `sizeMB: 0`(只有目录量体积 ⇒ 526 个小文件把 6.86MB 报成"合计约 0 MB")。
它的修复提示原写 `pnpm c-drive:clean-ours`,而根 package.json **从来没有这个脚本**
(实测取该键得 undefined)⇒ 门给出的是跑不通的出路,已改为真实入口并要求先 `-DryRun`。
**该方法唯一的真实危险**:`robocopy` 非零返回码(如 `.codex` 持锁 rc=9)会让内容已搬走但**不建 junction**,
路径直接消失 —— 必须回读"旧路径是否存在 + 新路径文件数/字节"再补 junction(本次即手工补建后凭据零丢失)。
**校验必须逐文件比对相对路径 + 字节数**(`robocopy /E` 不带 `/MOVE` 先做镜像副本),通过后才删源。

**禁止 agent 在代码或脚本中硬编码 C 盘路径**作为写入目标:

- ❌ `C:\temp\*` / `C:\Users\荣耀\AppData\Local\Temp\*`(用 `os.tmpdir()` / `$env:TEMP` 替代,会自动走 D 盘)
- ❌ `C:\Users\荣耀\AppData\Local\*\cache`(用工具自带配置或环境变量)
- ❌ `C:\Users\荣耀\AppData\Roaming\AICodingIDE*\*`(第三方 AI IDE 自身管理,agent 不触碰)

**唯一例外**:系统日志(`debug.log` / `next-server.log`)可走 `$env:TEMP`(已指向 D 盘)。

### 自动维护计划任务

| `IHUI C-Drive AutoMaintain` | 每天 3am | `wscript.exe scripts/c-drive-maintain-hidden.vbs` → `pwsh -File c-drive-auto-maintain.ps1` | **六段**:①Chrome 缓存 ②Temp 旧目录 ③本项目 C 盘产物 ④盘根封口体检 ⑤系统自产残骸(卡死打印队列/内核转储/孤儿浏览器构建) ⑥回潮源封禁(Chrome 政策,写前先验政策名真在 chrome.dll 里) |

| 任务名                      | 触发     | 实际执行体                                                                                 | 功能                                  |
| --------------------------- | -------- | ------------------------------------------------------------------------------------------ | ------------------------------------- |
| `IHUI C-Drive AutoMaintain` | 每天 3am | `wscript.exe scripts/c-drive-maintain-hidden.vbs` → `pwsh -File c-drive-auto-maintain.ps1` | 清理 Chrome/Temp 缓存 + 报告 C 盘状态 |

**⚠️ 注册名含空格,不是连字符**(`schtasks /query /fo CSV` 实读回 = `\IHUI C-Drive AutoMaintain`)。按文档里旧写的 `IHUI-C-Drive-AutoMaintain` 去查,`schtasks` 回「系统找不到指定的文件」—— 2026-09-23 我就是因此**误判成"任务从未注册"**,而它当时确实还没注册(23:55 才注册),但**名字陷阱会让人在任何一天都得出同样的错结论**。Git Bash 下查还要加 `MSYS_NO_PATHCONV=1`,否则 `/query` 被改写成路径。判存在与否只认 `schtasks /query /fo CSV | grep -i c-drive` 这种全量列名法,不要拿文档里的名字去点名查。

**2026-09-23 曾实测:该任务在本机并不存在**(当时代号未注册,`D:\DevEnv\logs\c-drive-maintain.log` 也从未生成)。当时的表是**设计意图**而非现状,曾据此以为"每天在清"⇒ 实际零执行,这是 C 盘能攒下 13.2GB `.next` 构建备份的直接原因之一。

**同日 23:59 经用户授权后已真正注册**(状态=现状,不再是设计意图):

> **该"现状"于 2026-09-24 再次失真,已三路取证终判为「当前不存在」**(本节下方表格里的"每天 3am"因此也是设计意图而非实况):
> ① `schtasks /query /fo CSV | grep -i c-drive` **零命中**(这正是本节规定的权威查法);
> ② `Get-ScheduledTask | Where TaskName -match 'C-Drive|Maintain'` 返回**空**;
> ③ 递归枚举 `C:\Windows\System32\Tasks\*.XML`,**没有**任何 C-Drive/Maintain 定义文件 —— 而同目录其余 **14 个 `IHUI*` 任务全部在位可列**
> ⇒ 排除"查法失效"这一假阴性解释,任务确实不在了。
> `D:\DevEnv\logs\c-drive-maintain.log` 今天(09-24 10:59)那条记录是**人工 `-DryRun` 预演**,不是 03:00 自动执行(全文 `[DRY]` 无 `[DEL]`,合计释放 0 MB),
> 所以"每天在清"在今天并没有发生。**注册动作 = 影响全机的每日自动删除,仍须用户授权,agent 不得自行 `schtasks /create` 恢复**;
> 上一条"回读 `schtasks /Query /XML` 实证 `LogonType=S4U`"当时为真,但那份定义现已不在 —— 名字陷阱的解释**不成立**(权威全量列表法连空格名一起扫,零命中)。
>
> **同日 17:1x 已按用户授权重新注册,并留配对证明(本条从"设计意图"重新变回现状)**:
> ① **注册前实跑预检**(§26 硬约束):在 `scripts/` 放一份与 `c-drive-maintain-hidden.vbs` 同体、仅把参数换成
> `-DryRun` 的副本,用 `cscript //nologo` 真跑一遍 —— `cscript` 退出 0、日志新增 76 行、
> 首行 `DRY RUN(全脚本不删任何东西)`、**`[DEL]` 计数 = 0**(证明拉起链通且零删除),预检副本当场删除;
> ② 注册命令 `schtasks /create /tn "IHUI C-Drive AutoMaintain" /tr "wscript.exe \"<工作树实测绝对路径>\c-drive-maintain-hidden.vbs\"" /sc daily /st 03:00 /f`,
> 再 `cscript //nologo scripts/task-set-s4u.vbs "IHUI C-Drive AutoMaintain"` 升 S4U(`/RU <user> /NP` 会**弹密码提示**、非交互跑不通,
> 而本机 pwsh 无 ScheduledTasks 模块 ⇒ 只有 Schedule.Service COM 这条活路,该工具头注已记);
> ③ **XML 回读独立取证**:`<LogonType>S4U</LogonType>`、`<StartBoundary>…T03:00:00</StartBoundary>`、
> `<Command>wscript.exe</Command>` ⇒ 三项齐备才算注册落地(不得把 `schtasks` 打印的"成功"当成功);
> ④ 权威存在法同一时刻由 0 命中翻成 **1 命中**(`\IHUI C-Drive AutoMaintain`)。
> **盘符按当次实测取**:本机工作树是 `G:\IHUI-AI`,注册的 `/tr` 就指 `G:\…`,不得照抄本节正文里的 `D:/…`(§5b/§15b 已各记过一次盘符失真)。
>
> **同批根掉了一句会再骗一次的东西**:守门 92 `check-c-drive-pollution.mjs` 原先在结论后**无条件打印**
> "计划任务 IHUI C-Drive AutoMaintain 每天 03:00 已注册(S4U,wscript 包装)",而脚本内**一次 `schtasks` 都没调过**
> —— 一道只读污染门正在替一个当时并不存在的防护背书。现改为**实测三态判据** `registered / unregistered / undetermined`
> (查法仍是全量 `/FO CSV /NH` + 名字不区分大小写匹配,**禁止**点名查),非 win32 / ENOENT / 超时 / 空输出 /
> 输出形态解不出任务路径一律 `未判定` 并写原因,**绝不计为通过**;本门仍只读、未注册不改退出码(warn-only 语义由断言钉死)。
> 配对证明:注册前该判据实测 `unregistered`(346 项零命中),注册后 `registered`(347 项命中 1 条),两次退出码均 0。

- **动作链按本节下方「计划任务禁止直接执行控制台程序」硬约束走**:`wscript.exe` → 纯 ASCII 的 `scripts/c-drive-maintain-hidden.vbs` → `pwsh -NoProfile -ExecutionPolicy Bypass -File …ps1`。注册前用 `cscript //nologo` 实跑过一份**只带 `-DryRun` 的同体副本**做语法+拉起链证明(实测写出 `[WARN] … DRY RUN(全脚本不删任何东西)`),因此注册过程零删除。
- **登录类型已升 S4U**(与凭据巡检同一套 `scripts/task-set-s4u.vbs`),否则 3am 无人登录时不会跑。回读 `schtasks /Query /XML` 实证:`LogonType=S4U`、`Command=wscript.exe`、`StartBoundary=03:00`、下次运行 `2026-09-24 03:00`。
- **它的删除面是"按名字"的,不是"按目录整片"**(2026-09-24 把行为收拢到与这句话一致,之前并非如此):盘根只认 `IHUI-*` / `.empty-tmp*` / `.pnpm-store`;`C:\tmp` 与 `C:\temp` 内只删 `ihui-*` / `IHUI-*` / `next-backup-*` / `probe-*` / `wb-ext-debug.log`;`%LOCALAPPDATA%\Temp` **默认也只删这四类名字**,原来是对"所有 mtime>3 天的目录"整片删(09-23 一次误跑就是因此清掉约 29.8MB 无主旧目录)—— 宽口径整片清扫现在必须显式设 `IHUI_TEMP_WIDE_SWEEP=1` 才恢复,未开启时把"被跳过多少个、合计多少 MB"如实打印,不静默。唯一剩下的非按名字删除面是 `C:\Windows\Temp` 里 mtime>3 天的**文件**(系统临时文件,保留原语义),日志里以 `[NOTE]` + 逐条留痕明示。
- **Chrome 缓存那 6 条路径是死路径,但故意不"修好"**:它们硬编码 `C:\Users\荣耀\AppData\Local\...`,本机用户是 `Administrator` ⇒ 天天空转。改成指向真实用户配置等于**突然开始删一个在用浏览器的缓存**,风险远大于收益;现在改为检测到路径不存在就显式 `[WARN]`(6/6 不存在 + 当前用户名),不再静默。要清这台机器的 Chrome 缓存,请人工确认后再动。
- **全脚本的删除出口只有 `ForceDelete` 一个**,且每次过 `Test-Protected`(`secrets` / `密钥` / `credentials` / `backups` / `BaiduSyncdisk` 等整目录不碰);`-DryRun` 拦在该出口上,预演模式**一条 `[DEL]` 都不会出现**(实测 179 行日志 `[DEL]` 计数 = 0)。
- **TEMP 漂移(2026-09-24 已根治写入侧,残余只是"活进程不刷新")**:HKCU `TEMP` 已指 `D:\DevEnv\Temp`,但活着的宿主/终端进程仍持 `C:\Users\Administrator\AppData\Local\Temp`(实测 `node -p os.tmpdir()` 即旧值),新开终端/重启宿主后自愈。**更严重的那一半是"服务身份根本不读 HKCU"** —— LocalSystem 的 TEMP 是 `C:\Windows\Temp`,已按上文③把守门扫描面补齐,并把 `deploy/win/ihui-deploy.ps1` 的构建重定向日志改为**用完即删**(实测存量 526 项 / 6.86MB 清完、下一轮构建结束后 2 个文件自行消失)。判据与污染可见性由守门 `check-c-drive-pollution.mjs`(只读、永不删;编号见 runner)承担。
- **家目录实体目录再少两处**(2026-09-24):桌面端 `%LOCALAPPDATA%\com.ihui.desktop`(515 文件/39.25MB)与 `%APPDATA%\com.ihui.desktop`(auth/tray/window-state)已按本节 junction 机制改道到 `D:\DevEnv\cache\userhome\appdata-{local,roaming}-com.ihui.desktop`;流程是"镜像复制 ⇒ 逐文件(相对路径+字节)校验 ⇒ 源改名为 `.pre-junction-<ts>` ⇒ `mklink /J` ⇒ 经 junction 回读数量一致 ⇒ 才删源",任一步不符即改名回退。改道前已确认桌面端不在运行(该目录最后写入 09-06,机上 13 个 `msedgewebview2.exe` 全属他应用)。同批删除 `AppData\Local\智汇AI` 与 `AppData\Local\ihui-node-hooks` 两个**空**孤儿目录(后者说明机器级 windowsHide 钩子当前未装:`HKCU\Environment\NODE_OPTIONS` 实测未设)。
- **仍未闭环的一条**:TEMP 漂移 —— HKCU `TEMP` 已指 `D:\DevEnv\Temp`,但活着的宿主/终端进程仍持 `C:\Users\Administrator\AppData\Local\Temp`(实测 `node -p os.tmpdir()` 即旧值),所以走 `os.tmpdir()` 的脚本会继续落 C 盘;新开终端/重启宿主后自愈。判据与污染可见性由守门 **93** `check-c-drive-pollution.mjs`(只读、永不删)承担。

**同日修 `c-drive-auto-maintain.ps1` 的三处失效**(全部实测取证):

1. 原"清理本项目产物"段扫的是 `C:\temp\ihui-*`,而我们实际写到 `C:\tmp\*`(构建备份)、`%LOCALAPPDATA%\Temp\ihui-*`(测试夹具)、以及盘根本身 —— **扫错目录 = 每天跑也零效果**。现覆盖这三处 + 盘根 `IHUI-*`/`.empty-tmp*`/`.pnpm-store`。
2. `ForceDelete` 只有 `DeleteDirectory` 分支,对**文件**路径必然抛后被 catch 吞掉 ⇒ 静默"清理成功但什么都没删"(盘根 `IHUI-probe-*.ps1` 就属于这一类)。现按 Leaf/Directory 分流。
3. 新增 `-DryRun`,**拦在 `ForceDelete` 这个唯一删除出口上**而非某一段里。教训实测:最初只把 DryRun 写在第三段,预演模式下第一段(Chrome 缓存)和第二段(Temp >3 天目录)**照样被真删了**(DeletePermanently 不进回收站);当时释放约 29.8MB,均为 `Temp` 下 mtime>3 天的目录,项目文件/备份/凭据全在 D 盘未受影响。现每段逐条留痕(`[DEL]`/`[DRY]`),不再静默删除。

**手动触发**:`pwsh -File scripts/c-drive-auto-maintain.ps1`
**查看日志**:`D:\DevEnv\logs\c-drive-maintain.log`(旧文档写 `D:\caches\...`,该目录本机不存在,日志从未写出)
**查看任务状态**:`Get-ScheduledTask -TaskName "IHUI-*"` / `schtasks /Query /TN "IHUI-C-Drive-AutoMaintain"`

### 2026-09-23 已办与剩余阻碍

**已办**:① **10.3GB 游离备份收口进 `D:\DevEnv\backups\`**(根目录散落的 `IHUI-AI-backup-*.tar` 8.3G、
`IHUI-AI-backup-20260911.git` 727M、`IHUI-AI_workbak_20260910` 537M、两个根 `.sql`、`IHUI AI Desktop` 94M
等,同卷 `mv` + 每步回读"源已无 + 目标体积一致");② **C 盘 20G → 31G 可用**;③ **12 项家目录改道**
(`.rustup .cargo .m2 .cache .codex .trae .trae-cn .trae-aicc .deepseek .codex-session-delete .ihui` →
`D:\DevEnv\cache\userhome\`,`.ollama` → `D:\DevEnv\cache\ollama`);④ **Ollama 2.9GB** 先镜像复制 +
逐文件(路径+字节)校验 + sha256 寻址核对,13/13 一致后才 `nssm stop` → 删 C 原件 → `mklink /J` →
`nssm start`;验收=服务 RUNNING **且真跑一次 `qwen2.5-coder:1.5b` 生成成功**(1.53s,日志无 error);
顺带修掉该服务把 `TEMP`/`TMP` 钉死在 `C:\Users\...\AppData\Local\Temp` 的配置(nssm LocalSystem
自带环境块,HKCU 的 TEMP 迁移对它无效,它一直在往 C 写)。原环境块备份在
`D:\DevEnv\backups\env\ollama-service-env-original.txt`。

**剩余客观阻碍(不是遗漏)**:`~/.workbuddy` 3.1GB 内含 `binaries\PortableGit`
(被 `scripts/lib/gitdir.mjs:36-37` 当 git 二进制首选解析)不得搬,其 `logs`/`traces` 约 2GB 属该 IDE
自管;`.qoder-cn`/`.qoder` 是本会话宿主状态,改道即丢记忆。`scripts/kill-git-selector-hidden.vbs`
已改为随自身目录定位目标脚本,但其包装的 `kill-git-selector.ps1` **在仓库里并不存在**(死代码);
`scripts/release-desktop-local.mjs:67,74` 需要 `%USERPROFILE%\.tauri\ihui-updater.key`,本机无 `.tauri`
→ 桌面端发布在此机必 `exit 1`(需发布机或补生成密钥)。

### 守门(已实现,guardian-runner 第 45 项)

- `scripts/check-c-drive-paths.mjs`(guardian-runner 第 45 项,warn-only,2026-08-13 立):扫描 staged 文件中硬编码的 C 盘写入路径(`C:\temp\` / `C:\Users\*\AppData\Local\Temp\` 等,排除 `os.tmpdir()` / `$env:TEMP` / 注释 / 文档)。
- **`scripts/check-c-drive-pollution.mjs`(guardian-runner 已注册项,warn-only,2026-09-23 立。**编号同日重排 5 次(85→90→91→92→93→96),文档一律不写死,以 runner 里该 `script:` 所在条目的 `id` 为准**)—— 补上第 45 项看不见的那一半**。成因:第 45 项只扫**源码字面量**,而 C 盘残骸恰恰是从 `os.tmpdir()` / `$env:TEMP` 这类"源码里没写 C"的路径流出去的;`check-parent-pollution`(只扫项目父目录 `D:\`)和 `check-root-dir-clean`(只扫项目根)同样不看 C 盘文件系统 —— 全链 90+ 道门没有一道实地扫过 C,于是 13.2GB `.next` 备份和单日 45 个 git 夹具可以在全量审计恒绿的情况下一直堆在 C 盘。本门实地扫 `C:\` 根 + `C:\tmp` + `C:\temp` + 活 TEMP,按名字白名单只认**本项目产物**(他人条目进"未识别清单",只登记不定性、不清理);并单独判 **TEMP 漂移**(注册表 `HKCU\Environment\TEMP` 已指 `D:\DevEnv\Temp` 而活进程仍持 `C:\Users\...\AppData\Local\Temp`)—— 这就是"改了指针但残骸天天还在长"的机制,新建终端/重启宿主后自愈。
- **`scripts/check-c-drive-pollution.mjs`(guardian-runner 第 93 项,warn-only,2026-09-23 立)—— 补上第 45 项看不见的那一半**。成因:第 45 项只扫**源码字面量**,而 C 盘残骸恰恰是从 `os.tmpdir()` / `$env:TEMP` 这类"源码里没写 C"的路径流出去的;`check-parent-pollution`(只扫项目父目录 `D:\`)和 `check-root-dir-clean`(只扫项目根)同样不看 C 盘文件系统 —— 全链 90+ 道门没有一道实地扫过 C,于是 13.2GB `.next` 备份和单日 45 个 git 夹具可以在全量审计恒绿的情况下一直堆在 C 盘。本门实地扫 `C:\` 根 + `C:\tmp` + `C:\temp` + 活 TEMP,按名字白名单只认**本项目产物**(他人条目进"未识别清单",只登记不定性、不清理);并单独判 **TEMP 漂移**(注册表 `HKCU\Environment\TEMP` 已指 `D:\DevEnv\Temp` 而活进程仍持 `C:\Users\...\AppData\Local\Temp`)—— 这就是"改了指针但残骸天天还在长"的机制,新建终端/重启宿主后自愈。
  - **定级 warn 而非 blocking**:盘根多数条目不属本仓,拦提交只会逼人 `--no-verify`,连带废掉其余守门(与守门 77/52 同取向)。`--strict` 供 CI/巡检改判红。
  - 本门**只读,永不删文件**;清理动作一律走 `c-drive-auto-maintain.ps1`(带 `-DryRun` 与逐条留痕)。
  - 取证:`--self-test` 12 例 + §22c 镜像测试 `node --test scripts/tests/check-c-drive-pollution.test.mjs`(7 例,含"他人工具态不得被判为我们的"、"TEMP 漂移判据"与**"本门编号在 runner 中必须唯一(反查 id,不硬写编号)+ 邻门注册块不得缺失)"**)。
  - 取证:`--self-test` 11 例 + §22c 镜像测试 `node --test scripts/tests/check-c-drive-pollution.test.mjs`(7 例,含"他人工具态不得被判为我们的"、"TEMP 漂移判据"与**"本门编号在 runner 中必须唯一(反查 id,不硬写编号)+ 邻门注册块不得缺失)"**)。
  - **自有产物特征含一条"盘根单字母目录"**:`C:\c` 这类是 MSYS/Git-Bash 把 `/c/...` 当**相对路径**用的错位指纹。实测 2026-08-06 一次就这样在 C 盘里套出 515MB(4 份 origin 浅克隆 + 一份错位的 npm 全局前缀),`git status` 与其余守门全都不知道。只认目录、同名文件不判(宁漏不误报);本门仍**只报不删**,该形态是否清理由人定。
  - **编号事故实录(一天撞四次,且"先查占用"被证明不够)**:85(与 `check-test-paths` 撞)→ 90(与 `ce261e1a8` 的 `check-sse-dispatch-parity` 撞)→ 91(与 `check-error-code-coverage` 撞)→ 92 又撞一次 —— **这次不是我没查**:我取 92 时它确实在 91,是别的会话随后把 `errorCode` 从 91 重排到 92,把重复号**带进了 origin/main**。⇒ 在高并发同日仓里,"提交前查一次占用"挡不住别人事后挪号,**唯一可靠的是让 runner 自己说话**:本门镜像测试现在断言"全 runner 任何 id 不得出现两次"(反查法,不硬写编号),它正是这次红掉的成因;本门编号此后仍在漂移,现值一律以 runner 为准。其中改 90 那次最严重:按整文件提交 `guardian-runner.mjs`(提交 `5db08f26e`)曾把别人刚装上的门**注册块直接覆盖掉**(diff 里就是一行 `script:` 被替换)—— 撞号只是重名,覆盖却是替别人卸闸;已按原文回插,并把断言写成"邻门注册块必须存在"。⇒ 两条硬规矩:① 改共享注册类文件(runner / package.json / CI)必须 `git show <commit> -- <f> | grep '^[-+].*(id:|script:|label:)'` 逐块核对;② **判据要能让机器自己发现撞号**,不要依赖人记得去查。紧急跳过 `HUSKY_SKIP_C_DRIVE_POLLUTION=1`。
  - **编号事故实录(一天撞四次,且"先查占用"被证明不够)**:85(与 `check-test-paths` 撞)→ 90(与 `ce261e1a8` 的 `check-sse-dispatch-parity` 撞)→ 91(与 `check-error-code-coverage` 撞)→ 92 又撞一次 —— **这次不是我没查**:我取 92 时它确实在 91,是别的会话随后把 `errorCode` 从 91 重排到 92,把重复号**带进了 origin/main**。⇒ 在高并发同日仓里,"提交前查一次占用"挡不住别人事后挪号,**唯一可靠的是让 runner 自己说话**:本门镜像测试现在断言"全 runner 任何 id 不得出现两次"(反查法,不硬写编号),它正是这次红掉的成因;终落 **93**。其中改 90 那次最严重:按整文件提交 `guardian-runner.mjs`(提交 `5db08f26e`)曾把别人刚装上的门**注册块直接覆盖掉**(diff 里就是一行 `script:` 被替换)—— 撞号只是重名,覆盖却是替别人卸闸;已按原文回插,并把断言写成"邻门注册块必须存在"。⇒ 两条硬规矩:① 改共享注册类文件(runner / package.json / CI)必须 `git show <commit> -- <f> | grep '^[-+].*(id:|script:|label:)'` 逐块核对;② **判据要能让机器自己发现撞号**,不要依赖人记得去查。紧急跳过 `HUSKY_SKIP_C_DRIVE_POLLUTION=1`。
- **临时夹具唯一落点:`scripts/lib/scratch-dir.mjs`(`mkScratch` / `rmScratch`,2026-09-23 立)**。两条选址硬约束都由实测踩坑固化:① 不得用 `os.tmpdir()`(活进程 TEMP 可能仍钉在 C 盘);② 不得落在仓库树内 —— git 夹具要模拟"非 git 目录",放在 `.ihui-agent/tmp/` 里时 `git rev-parse --show-toplevel` 会向上逃逸到真仓库,使该用例恒红(已用 HEAD 副本 A/B 实证,是当初先试后撤的方案)。现锚定**工作树同盘的 `DevEnv/Temp/ihui-scratch`**(§15b 批准的临时物落点),与 `gitArchiveDir()` 同一套盘符推导;`IHUI_SCRATCH_DIR` 为换机/CI 逃生舱,指向仓库内时按硬约束直接拒建而非静默产出会逃逸的夹具。回归:`node --test scripts/tests/scratch-dir.test.mjs`(4 例)。
- **行为(与 guardian-runner.mjs 实际一致)**:本脚本违规时 exit 1(供统计),guardian-runner 以 warn 模式捕获后计为"警告"、**不阻塞 commit**;仅 blocking 项失败才 exit 1 阻塞 commit。
- 紧急跳过(应急,默认不推荐):`HUSKY_SKIP_C_DRIVE_PATHS=1 git commit ...`

### 历史案例

- 2026-07-27:C 盘 28 GB → 42 GB,释放 13.85 GB(第三方 AI IDE 旧版残留 + Chrome OptGuideOnDeviceModel + Temp 旧文件)
- 后续配置 11 个环境变量永久指向 D 盘,杜绝开发工具缓存再写 C 盘
- 第三方 AI IDE 自身缓存由其自管理,项目维护脚本不再代清理

---

## 27. PowerShell 7 强制规则(强制,2026-08-13 立)

### 触发背景

Windows PowerShell 5.1(`powershell.exe`)已 EOL(微软停止维护),且存在已知 bug:

- `Out-File -Encoding UTF8` 实际写 UTF-16 LE(BOM 处理 bug)
- ANSI 代码页读 UTF-8 写入的 `.ps1` 文件时,`if/else` 块解析截断(`Missing closing '}'` 误报)
- 中文路径/文件名处理在 5.1 上不稳定
- 跨平台兼容性差(Linux/macOS 跑不通)
- 真实事故:2026-08-13 C 盘 130MB 修复任务,D 盘诊断脚本二次报 `Missing closing '}'`,根因是 5.1 读 pwsh 7 写入的 UTF-8 文件的 BOM bug

### 强制规则(违反视为交付事故)

1. **agent 跑 PowerShell 必须用 `pwsh.exe`**(PowerShell 7+):
   - ✅ `pwsh -File scripts/foo.ps1`
   - ✅ `& "C:/Program Files/PowerShell/7/pwsh.exe" -File ...`
   - ❌ `powershell -File scripts/foo.ps1`
   - ❌ `powershell.exe -Command ...`
   - 唯一例外:Windows 系统 5.1 专属 cmdlet 需在脚本里 `Set-Alias` 显式标注
2. **所有项目内 `.ps1` 文件第一行必须 `#requires -Version 7`**:在 5.1 上跑会**直接报错退出**,这正是强制效果
3. **CI / 守门脚本必须用 `pwsh`** 跑
4. **路径统一用正斜杠 `/`**:`C:/Program Files/PowerShell/7/`,避免 5.1 反斜杠转义 bug
5. **`.ps1` 文件用 UTF-8 with BOM 写**:PowerShell 5.1 默认以 ANSI 代码页读 `.ps1`,`Out-File -Encoding UTF8` 在 5.1 上写的是 UTF-16 LE,必须用 `[System.IO.File]::WriteAllText($path, $content, [System.Text.UTF8Encoding]::new($true))`

### 守门(blocking)

- `scripts/check-pwsh-version.mjs`:检查 `.ps1` 前 5 行是否含 `#requires -Version 7`,缺失则 exit 1。ROOT 由脚本自身位置推导(不写死盘符)
  - `--staged`:仅检查 **git index 中已暂存的** `.ps1`(`.husky/pre-commit` 用此模式)
  - 缺省:全树扫描(人工 / CI 全量审计用)
- 集成位置:`.husky/pre-commit` 直接调用 `node scripts/check-pwsh-version.mjs --staged`(blocking);跳过 `HUSKY_SKIP_PWSH_VERSION_GUARD=1`(应急,默认不推荐)
- 检查范围:项目内 `.ps1`(`scripts/`、`apps/*/scripts/`、`.ihui-agent/scripts/` 等)
- 白名单:`*.venv/*`、`venv/*`、`node_modules/*`、`.git/*`、`tmp/*`、`deploy/*`、`.ihui-agent/*`、`site-packages/*`(playwright 驱动)、`.workbuddy/quarantine/*`(污染治理隔离归档)
- **2026-09-15 修复(本守门自身 P0 回归)**:`--staged` 自挂载起只在用法注释里声明、**从未实现**,实现中只有无条件的全树 `scan(ROOT)`,导致工作区里未跟踪且被 gitignore 的遗留 `.ps1`(实测 `.android-toolchain/*.ps1`、`.tmp-wechat-test/watch.ps1`)**阻断每一次提交**——而它们在干净 checkout / CI 里根本不存在。已真正实现 `--staged`,并补齐 `deploy/*` 等白名单口径。

### 安装指引(机器上没装 PowerShell 7)

```powershell
winget install --id Microsoft.PowerShell -e --source winget
# 或一键脚本
iex "& { $(irm https://aka.ms/install-powershell.ps1) } -UseMSI"
```

### 历史教训

- 2026-08-13:CredentialHelperSelector 弹窗修复任务全程用 `powershell`(5.1),导致 D 盘诊断脚本二次报 `Missing closing '}'`(5.1 对 BOM 处理 bug)。改用 `pwsh` + `#requires -Version 7` 后立即通过。教训:RunCommand 默认 PowerShell 解释器**不是 7 也不是 5 的中性选择**——必须显式指定 `pwsh`。

---

## 28. 根目录整洁铁律(强制,2026-08-15 立)

### 触发背景

根目录曾散落 10+ 临时产物:`debug.log` / `aha_electron_2026.0810.log` / `cookies.txt` /
`page_eval/prompts/response/usage.html` / 过时 `start-dev.ps1`(D 盘旧路径 + 8810 旧端口) /
`browser_test_output/` 等。2026-08-15 一次性清理后,立此铁律防回潮。

### 强制规则(违反视为交付事故)

1. **一级目录只允许白名单内条目**,白名单封闭维护于 `scripts/check-root-dir-clean.mjs`(4 组 Set):
   - `ALLOWED_FILES`:配置(`package.json`/`pnpm-*.yaml`/`turbo.json`/`eslint.config.mjs`/`tsconfig.base.json`/`knip.jsonc`/`docker-compose.yml`/`railway.json`/`render.yaml`/`app.json`)+ 标准文档(`README*.md`/`LICENSE`/`SECURITY.md`/`CONTRIBUTING.md`/`CODE_OF_CONDUCT.md`)+ 项目强制(`AGENTS.md`/`PROJECT_PLAN.md`)
   - `ALLOWED_DIRS`:`apps`/`packages`/`scripts`/`docs`/`deploy`/`monitoring`/`reports`/`sdks`/`cert`/`products`/`logs`/`node_modules`/`tmp`/`test-results`
   - `ALLOWED_HIDDEN_FILES` / `ALLOWED_HIDDEN_DIRS`:`.env*`/`.gitignore`/`.git`/`.github`/`.husky`/IDE/工具目录等
2. **禁止在一级目录生成 `.log` / `.html` / `cookies*` / 截图 / ad-hoc 脚本**:临时产物一律进 `tmp/` 或 `logs/`,测试产物进 `test-results/` 或对应子目录。
3. **新增合法根目录文件/目录必须显式审批**:把条目加进 `scripts/check-root-dir-clean.mjs` 白名单并随 commit 提交,禁止绕过白名单。
4. **任务收尾必查**:交付前跑 `node scripts/check-root-dir-clean.mjs --staged`,0 违规才算完成。
5. **忽略产物也纳入视野(2026-09-23 补)**:守门原对"被 git 忽略的一级目录条目"整体跳过(该豁免必要 —— 忽略条目本由 `.gitignore` 承接,若一并拦截则各类构建产物与本地目录会让每次提交皆红;注意 `tmp/`、`logs/` 等已在 `ALLOWED_DIRS`,驱动这条豁免的是"未进白名单却被忽略"的产物),致本规则第 2 条的禁令对被忽略文件零覆盖 —— 实测一次性翻出 14 个静默残留(`_knip.log`/`.tmp-tsc.log`/`build-oidc.log` 等),`git status` 与守门都看不见。现新增**只告警层**(不计失败、不改退出语义:全量恒 0,`--staged` 仍只对非忽略违规 exit 1)。看到该告警即删除或移入 `tmp/`、`logs/`。

### 守门(blocking)

- `scripts/check-root-dir-clean.mjs`:扫描一级目录,白名单外条目 `--staged` 模式 exit 1
- 集成位置:`scripts/guardian-runner.mjs` pre-commit 第 44 项(2026-08-15 立)
- 逃生舱(应急,默认不推荐):`HUSKY_SKIP_ROOT_DIR_GUARD=1 git commit ...`

### 配套

- `.gitignore` 已补 `browser_test_output/`、`cookies.txt` 防回潮(未跟踪垃圾不污染 `git status`)

---

## 29. dangling commit 备份策略(2026-08-19 立)

### 由来

`commit-loss-check` 守门会拦截 dangling commits,要求先备份为 tag 再继续操作。
本仓库实践:所有 dangling commits 备份为 `lost-commit/wip-*` tag(以 commit 短 hash 命名,
例如 `lost-commit/0141d221`、`lost-commit/wip-batch-00f2429`)。

截至 2026-08-19,本地 `lost-commit/*` tag 数量 = **4188** 个,远超 §22「已被 reset 丢失的 commit
永久记录」清单的 3 个手工备份 tag — 绝大多数来自 `check-commit-loss-guard.mjs` 自动 fsck
悬空检测后批量打 tag 的产物(典型为 merge commit / stash pop 失败的中间 commit)。

抽样 `git show --stat lost-commit/{0141d221,02000bfd,043af88d}` 均显示为 Merge commit,
作者 `AI智汇社 <lizong@aizhs.top>`,日期集中在 2026-08-17 — 与 §22 守门日志一致。

### 保留周期

建议 **30 天**。超出后一次性 GC(由仓库维护者人工触发,不在守门脚本里自动跑):

```bash
# 1. 先确认无重要未提交工作(红线!)
git status               # 应 clean
git stash list           # 应为空
git diff --stat          # 应无改动

# 2. 列出所有 lost-commit tag(预演,确认数量级合理)
git tag -l 'lost-commit/*' | wc -l   # 当前 4188

# 3. 本地一次性删除
git tag -l 'lost-commit/*' | xargs git tag -d

# 4. 同步删除远程 tag(仅当你确认远端也允许清理时;默认保留远端)
#    警告:此操作会真正影响 origin ref 列表,需在 PR 中明确说明
git tag -l 'lost-commit/*' | xargs -I{} git push origin :refs/tags/{}

# 5. 验证 (强校验,任何 missing/unreachable 都应人工复核)
git fsck --unreachable --no-reflogs
git tag -l 'lost-commit/*' | wc -l   # 应为 0
```

### 为什么必须人工触发而不是脚本自动化

- **守门不擅自删 tag**: `check-commit-loss-guard.mjs` 的职责是"检出 + 备份",
  不应承担"GC 清理"职责 — 后者一旦误删,会真正丢失 dangling commit 的可达路径,
  即使远端有备份也增加了恢复成本。
- **数量级跃升需要人审**: 从 0 → 4188 是日积月累的结果,任何"一键 GC"脚本都应要求
  人类在 PR 里显式 ack,而不是 nightly cron 自动跑。
- **§22 守门只挡新增**: pre-commit 第 30a 项(`--blocking --filter-stash`)只关心
  "这一次操作是否会产生 dangling",不关心历史积累。

### 红线

- ❌ **不要把 lost-commit tag push 到 origin 之外的 fork / mirror**(会污染外部 ref 列表)。
  §22「自动化 tag 同步」明确禁止了向非 origin 的推送。
- ❌ **GC 前未确认 `git status clean` + `git stash list` 为空**(会丢失未提交改动)。
- ❌ **一次性删除超过 1000 个 tag 后不验证 `git fsck` 就 push**(可能误删有意义的 commit,
  因为 fsck 检出的是"创建时刻"的悬挂,不代表当下已被 merge 进 main)。
- ❌ **amend 含 dangling 备份说明的 commit**(本节一旦 commit,内容视为定稿;
  后续 GC 时间窗的调整应新加 §29a / §29b,不要回头改这一节)。

### 配套

- §22「防止 commit / push / merge 提交丢失硬性规则」— 提供守门 + 备份机制
- §22「自动化 tag 同步」(`scripts/sync-lost-commit-tags.mjs`)— 保证远端有副本
- `docs/lost-commit-archive.md` — 丢失 commit 的永久档案(人工可读清单)
- `.ihui-agent/archive/AGENTS_history.md` — 历史 GC 案例(本节首次落地后应补一条案例)

---

## 42. React SyntheticEvent 闭包陷阱(强制)

### 触发背景(2026-08-12 立,真实 bug)

`apps/web/src/components/chat/model-selector.tsx` 原 `onMouseLeave` 在 `setTimeout` 回调闭包内访问 `e.currentTarget`:

```tsx
setTimeout(() => {
  setPopoverAnchor((prev) => (prev?.el === e.currentTarget ? null : prev))
}, 100)
```

React 17+ 的 SyntheticEvent 在事件处理函数返回后 `currentTarget` 会被置 `null`,异步回调触发时 `prev?.el === null` 永远为 `false`,关闭分支永远不进 → model picker 常驻显示。

### 陷阱机制

- React 事件处理函数(`onClick={e => ...}` 等)**同步作用域内** `e.target` / `e.currentTarget` 有效。
- 一旦进入异步回调(`setTimeout` / `setInterval` / `requestAnimationFrame` / `requestIdleCallback` / `queueMicrotask` / 未捕获 `e` 的 promise)或 memoized / 延迟执行的闭包场景,SyntheticEvent 会被事件池复用/清空,`e.target` / `e.currentTarget` 失效或为 `null`(React 17+ 不再 pooled,但 `currentTarget` 一定在 handler 返回后置 null)。

### 强制做法(违反视为 defect 事故,强制)

1. **同步缓存**:在事件处理函数**同步作用域**先缓存所需字段,再在异步中使用。例:`const id = e.currentTarget.dataset.id` → 异步闭包内读 `id`,严禁直接读 `e.currentTarget.dataset.id`。
2. **用 ref 管理 DOM**:`anchorRef.current` 替代 `e.currentTarget`,适合需在多个回调 / 清理函数中引用同一 DOM。
3. **异步闭包内禁止访问 `e.` 任何属性/方法**(`currentTarget` / `target` / `preventDefault` / `stopPropagation`)。

### 守门

`scripts/check-event-closure-leak.mjs`(guardian-runner 第 42 项,blocking):用括号配对算法提取异步回调第一个参数(箭头函数体),在其内搜 `e.X` 模式,命中 → exit 1 阻塞 commit。
参考修复:`apps/web/src/components/chat/model-selector.tsx` MemberDiscountSection。

---

## 关键参考文档

| 文档                      | 说明                                                          |
| ------------------------- | ------------------------------------------------------------- |
| `PROJECT_PLAN.md`         | 唯一任务计划文档(必读)                                        |
| `.ihui-agent/archive/`    | 历史归档(audit/交接/迁移报告,只读)                            |
| `docs/architecture.md`    | 系统架构文档                                                  |
| `docs/port-management.md` | 端口注册表(88xx 段)                                           |
| `docs/learning-assets.md` | 学习资产登记(34 个工作流反馈来源,新增/删除工作流必须同步更新) |

<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->

| 路径                             | 角色                                                        |
| -------------------------------- | ----------------------------------------------------------- |
| `D:/IHUI-AI/.git`                | **28 字节指针文件**(`gitdir: D:/IHUI-AI-git-repo`),不是目录 |
| `D:/IHUI-AI-git-repo`            | 真实 gitdir(544MB),在工作区之外                             |
| `D:/IHUI-AI.git-backup-20260912` | gitdir 完整备份,守护的本地恢复源                            |

- **唯一写法**:主按钮、选中胶囊、悬浮加号这类"品牌实底 + 其上文字",RN/共享包写 `brand.DEFAULT`(底)+ `brand.foreground`(文字)**成对**;CSS/类名侧用 `--color-primary` + `--color-primary-foreground`(小程序 `CategoryBar`/FAB 同值)。这两档在两主题下逐位同值(亮 `#000/#fff`、暗 `#fff/#000`),对账由「跨端色值同源对账」守门负责(编号以 `scripts/guardian-runner.mjs` 现值为准,勿照抄文档)。
- **唯一写法**:主按钮、选中胶囊、悬浮加号这类"品牌实底 + 其上文字",RN/共享包写 `brand.DEFAULT`(底)+ `brand.foreground`(文字)成对;CSS/类名侧用 `--color-primary` + `--color-primary-foreground`(小程序 `CategoryBar`/FAB 同值)。这两档在两主题下逐位同值(亮 `#000/#fff`、暗 `#fff/#000`),对账由守门 90 负责。

> ⚠️ 本行已于 2026-09-24 被上面「唯一写法(2026-09-24 改档)」就地改写取代(旧档 brand.DEFAULT/foreground 已废);保留原文只为不丢行,勿照它执行。

- 悬空引用由该门的"品牌键"判据直接拦(编译不一定红,运行时是 `undefined` 颜色)。并行会话的暂存区里若还残留 `tokens.brand.ctaFill/ctaText`,改法只有一行:`ctaFill` → `DEFAULT`、`ctaText` → `foreground`。
- **清单↔锁 specifier 对账**(101):`scripts/check-lock-manifest-consistency.mjs`(blocking,2026-09-24 立)—— 堵的是**依赖真值**这一整类"本地全绿、生产构建必炸":`package.json` 声明与 `pnpm-lock.yaml` 的 `importers.<pkg>` specifier 不一致时,pnpm **整段跳过该包的链接步骤**(不报错、不改锁、`pnpm install` 与 `pnpm install --force` 都只回 "Already up to date"),本地 node_modules 早就装好 ⇒ typecheck/lint/单测/其余守门全绿,直到 bundler 报 Module not found 打死生产构建。立因实例:当天 `apps/web` 写 `"xlsx": "^0.18.5"` 而锁记 `npm:@e965/xlsx@^0.20.3`,症状是"97 个声明依赖精确缺 3 条"——**只缺某一个 importer 的全部新增项**这个形状本身就是指纹(第一反应容易误判成"stale dist / 服务进程锁住文件",两者当日都被实测证伪:短停 IHUI-WEB 后 `--force` 仍 285ms 回绿)。三条判据 R1 缺记账 / R2 specifier 不等 / R3 反向孤儿**只报数不判红**;两个必须建模的 pnpm 合法行为,否则 22 枚存量误红逼人绕过钩子:**维度 A** 读 `pnpm-workspace.yaml` 的 `overrides`(真仓 50 条,裸名与 `pkg@<=版本` 两形态),lock 等于 override 目标即放过(19 条),但**严格侧保留**——某依赖只有唯一一条裸名 override 而 lock 仍停在 manifest 原值 ⇒ 判 `override-not-applied` 红(否则维度 A 就成了无条件放过);**维度 B** peerDependencies 不比 specifier(pnpm 记进 devDeps 段且写解析后的范围,3 条),但仍要求"任一段有条目",缺条目照红。**口径是本门生命线**:`--staged` 判**索引 blob**、全量判 **HEAD blob**(同 70/77/83/98/99),只允许同一轮读同一个面(含包清单枚举也走同一面,否则"glob 读盘 + 内容读 git"会造出自洽但基准错位的假绿尺子),`--worktree` 仅作人工排查逃生舱、两个面旗标同时给 ⇒ exit 2;取不到(缺路径/unmerged/非 blob/二进制/git 失败/列出 0 路径/toplevel 不匹配)一律 **exit 2 显式"无法判定"并点名路径**,绝不记绿。不挂 `stagedTriggers` —— 前缀语义表达不出"任意 `*/package.json`",而漏挂等于没有这道门(守门 81 教训),实测 282ms/342ms,每轮跑得起。取证 `--self-test` 34 例 + §22c 镜像测试 24 例,含三条端到端**假绿/假红钉死**对照(临时 git 仓:索引坏而盘上好 ⇒ staged 必红;索引好而盘上别人半编辑 ⇒ staged 必绿;该面取不到 ⇒ exit 2)与"改写真 decision/真事故值必红"的阳性对照;写门过程中自检另抓出 `splitOverrideKey` 把 13 条 `>=` 版本选择器误判成父作用域(整类隐身)这一自造缺陷。紧急跳过 `HUSKY_SKIP_LOCK_MANIFEST_GUARD=1`。

  - **`--take-ours <path>` 是"声明式例外",不是选边后门**(2026-09-24 加):两侧同改且真三方报冲突时,默认一律 `needHuman` 交人工 —— 但**报冲突不等于必须交人工**:若合并树的内容已让对侧那一版判据**必红**,取本侧就是被内容强制的唯一解。当天实例:`scripts/tests/check-cross-end-tokens.test.mjs` 两侧在同一段各写各的,对侧留着回归锁"brand 里不得再有 CTA 档",而 `packages/design-tokens` **只有本侧改过**(对侧动过数实测 0)⇒ 合并树必含 `brand.cta` ⇒ 那把锁 100% 失败;取证是**跑两版**:本侧版 `pass 11 / fail 0`,对侧版 `pass 7 / fail 1`(红的正是那把锁)。使用该例外必须**逐条附这样的取证**,且工具会把声明过的项目打进输出与合并提交信息(`;取本侧(已声明+可复核): <path>`)⇒ 无从静默。判据底线不变:落地前 `丢本侧路径 = 0 ∧ 丢对侧路径 = 0 ∧ 活文档未存活行 = 0`,落地后由守门 100 的 A1 复核。镜像测试钉住三件事:默认必须 `needHuman`、声明后 `keptOurs` 必须点名、且**一条例外不得连带丢掉对侧其它独有新增**。

- **mobile-rn 深色前景/容器对账**(83,原 75):check-brand-foreground.mjs(blocking,2026-09-23 立)—— 四条判据:**R1** 零豁免,同一 style 块内 `tokens.brand.DEFAULT` 作背景 × `surface.light`/`text.primary` 作前景(深色档案下 brand.DEFAULT=纯白 ⇒ 白底白字);**R4** 同一关系被拆到**兄弟 key**(`retryBtn` × `retryText`)时按命名配对判,走基线棘轮;**R2** `surface.light` 背景 / α≥0.5 白 rgba / 无 `dark:` 变体的 `bg-white` 作容器底,每文件计数对 `scripts/brand-foreground-baseline.json` 只减不增;**R3** 数 brand.DEFAULT 填充/描边但**不计 §4 成对 CTA**(同块或兄弟键用 `brand.foreground` 作前景)—— 见本节上方「品牌 CTA / 主按钮色同源」,按规矩写就红的门只会逼人 `--no-verify`;**无配对的白卡片照旧计**(自检里两条阳性对照钉住)。**内容口径**:全量与 `--update-baseline` 判 **HEAD blob**,`--staged` 判暂存 —— 共享工作树滞后 HEAD,按磁盘算会在恒红/假绿间来回跳并把错数写回基线(2026-09-24 一天内 R3 登记被整文件回退三次的直接成因)。`--staged` / `--update-baseline` / `--self-test`;紧急跳过 `HUSKY_SKIP_BRAND_FOREGROUND=1`。 ⚠️ 本行为 2026-09-24 就地改写**前**的原文,保留以不丢行(§12);现行文本见下方「品牌实底前景/容器对账(RN + 共享包 + web 类名面)」条,勿照本行执行。
- **mobile-rn 深色前景/容器对账**(83,原 75):check-brand-foreground.mjs(blocking,2026-09-23 立)—— R1 零豁免:同一 style 块内 `tokens.brand.DEFAULT` 作背景 × `surface.light`/`text.primary` 作前景(深色档案下 brand.DEFAULT=纯白 ⇒ 白底白字);R2 基线棘轮:`surface.light` 背景 / α≥0.5 白 rgba / 无 `dark:` 变体的 `bg-white` 作容器底,每文件计数对 `scripts/brand-foreground-baseline.json`(现 13 文件 24 处,均为媒体上的合法浮层或已带 `dark:` 变体)只减不增。`--staged` / `--update-baseline` / `--self-test`(11 例);紧急跳过 `HUSKY_SKIP_BRAND_FOREGROUND=1`。 ⚠️ 本行为 2026-09-24 就地改写**前**的原文,保留以不丢行(§12);现行文本见下方「品牌实底前景/容器对账(RN + 共享包 + web 类名面)」条,勿照本行执行。
- **mobile-rn 深色前景/容器对账**(83,原 75):check-brand-foreground.mjs(blocking,2026-09-23 立)—— 四条判据:**R1** 零豁免,同一 style 块内 `tokens.brand.DEFAULT` 作背景 × `surface.light`/`text.primary` 作前景(深色档案下 brand.DEFAULT=纯白 ⇒ 白底白字);**R4** 同一关系被拆到**兄弟 key**(`retryBtn` × `retryText`)时按命名配对判,走基线棘轮;**R2** `surface.light` 背景 / α≥0.5 白 rgba / 无 `dark:` 变体的 `bg-white` 作容器底,每文件计数对 `scripts/brand-foreground-baseline.json` 只减不增;**R3** 数 brand.DEFAULT 填充/描边但**不计 §4 成对 CTA**(同块或兄弟键用 `brand.foreground` 作前景)—— 见本节上方「品牌 CTA / 主按钮色同源」,按规矩写就红的门只会逼人 `--no-verify`;**无配对的白卡片照旧计**(自检里两条阳性对照钉住)。**内容口径**:全量与 `--update-baseline` 判 **HEAD blob**,`--staged` 判暂存 —— 共享工作树滞后 HEAD,按磁盘算会在恒红/假绿间来回跳并把错数写回基线(2026-09-24 一天内 R3 登记被整文件回退三次的直接成因)。`--staged` / `--update-baseline` / `--self-test`;紧急跳过 `HUSKY_SKIP_BRAND_FOREGROUND=1`。 ⚠️ 本行为 2026-09-24 就地改写**前**的原文,保留以不丢行(§12);现行文本见下方「品牌实底前景/容器对账(RN + 共享包 + web 类名面)」条,勿照本行执行。
- **品牌实底前景/容器对账(RN + 共享包 + web 类名面)**(83,原 75):check-brand-foreground.mjs(blocking,2026-09-23 立)—— 五条判据,`brand.DEFAULT` 与 `brand.cta` **同形认**(只认 DEFAULT 会让迁移后的主实底整片隐身 —— 判据必须覆盖门自己产出的形态):**R1** 零豁免,同块内 `backgroundColor: (tokens|tk).brand.(DEFAULT|cta)` × `surface.light`/`text.primary` 作前景;**R4** 同一关系拆到**兄弟 key**(`retryBtn` × `retryText`)按命名配对判,走棘轮(现 127 处);**R2** 拦"浅色当容器底"(`surface.light` / α≥0.5 白 rgba / 无 `dark:` 变体的 `bg-white`),棘轮现 24 处;**R3** 数品牌实底填充/描边,**按档配对**免债:DEFAULT 底 ↔ `brand.foreground`、cta 底 ↔ `brand.ctaForeground`,**跨档配对仍计**(DEFAULT 底 × ctaForeground 深色档案下=白底白字),棘轮现 235 处;**R5** web/ui-react 的 **Tailwind 类名形态**(R1–R4 全解析 RN style 对象,对 `bg-primary`+`text-primary-foreground` 这一 §4 已废配对原本整侧盲视),同行成对才算,变体前缀(`data-[state=checked]:bg-primary`)与染色底(`bg-primary/10`)不算,`r5-cta-exempt: 原因` 豁免,基线 `webClassPairCounts` **现为空 = 零容忍**(立项实测 22 处/14 文件,含 `@ihui/ui-react` Button 的 6 个 variant,当日由并行提交 `4e0b24689a` 迁完)。**R5 两条已知限制如实登记**:跨行配对不计(宁窄不误)、变体前缀不算实底(排除前缀的字符类与排除 `/90` 的是同一个,放宽任一即破坏口径)。**内容口径**:全量与 `--update-baseline` 判 **HEAD blob**,`--staged` 判暂存 —— 共享工作树滞后 HEAD,按磁盘算会恒红/假绿来回跳并把错数写回基线(2026-09-24 一天内 R3 登记被整文件回退三次的直接成因)。基线 6 键:`counts`/`ctaCounts`/`r4Counts`/`webClassPairCounts` + 两个文档性注记键(`pairedCtaNotVisibleToRule`/`ctaFillRenameLedger`)—— `--update-baseline` **必须保留注记键**,旧写法整文件重写会把他人审计台账冲掉(本轮并入远端时实测踩过)。取证:`--self-test` **94 条断言**(含 3 条阳性对照 + 变异对照)+ `node --test scripts/tests/check-brand-foreground.test.mjs` **13 例**;`--staged` / `--update-baseline` / `--self-test`;紧急跳过 `HUSKY_SKIP_BRAND_FOREGROUND=1`。
- **品牌实底前景/容器对账(RN + 共享包 + web 类名面)**(83,原 75):check-brand-foreground.mjs(blocking,2026-09-23 立)—— 五条判据,`brand.DEFAULT` 与 `brand.cta` **同形认**(只认 DEFAULT 会让迁移后的主实底整片隐身 —— 判据必须覆盖门自己产出的形态):**R1** 零豁免,同块内 `backgroundColor: (tokens|tk).brand.(DEFAULT|cta)` × `surface.light`/`text.primary` 作前景;**R4** 同一关系拆到**兄弟 key**(`retryBtn` × `retryText`)按命名配对判,走棘轮(现 127 处);**R2** 拦"浅色当容器底"(`surface.light` / α≥0.5 白 rgba / 无 `dark:` 变体的 `bg-white`),棘轮现 24 处;**R3** 数品牌实底填充/描边,**按档配对**免债:DEFAULT 底 ↔ `brand.foreground`、cta 底 ↔ `brand.ctaForeground`,**跨档配对仍计**(DEFAULT 底 × ctaForeground 深色档案下=白底白字),棘轮现 235 处;**R5** web/ui-react 的 **Tailwind 类名形态**(R1–R4 全解析 RN style 对象,对 `bg-primary`+`text-primary-foreground` 这一 §4 已废配对原本整侧盲视),同行成对才算,变体前缀(`data-[state=checked]:bg-primary`)与染色底(`bg-primary/10`)不算,`r5-cta-exempt: 原因` 豁免,基线 `webClassPairCounts` **现为空 = 零容忍**(立项实测 22 处/14 文件,含 `@ihui/ui-react` Button 的 6 个 variant,当日由并行提交 `4e0b24689a` 迁完)。**R5 两条已知限制如实登记**:跨行配对不计(宁窄不误)、变体前缀不算实底(排除前缀的字符类与排除 `/90` 的是同一个,放宽任一即破坏口径)。**内容口径**:全量与 `--update-baseline` 判 **HEAD blob**,`--staged` 判暂存 —— 共享工作树滞后 HEAD,按磁盘算会恒红/假绿来回跳并把错数写回基线(2026-09-24 一天内 R3 登记被整文件回退三次的直接成因)。基线 6 键:`counts`/`ctaCounts`/`r4Counts`/`webClassPairCounts` + 两个文档性注记键(`pairedCtaNotVisibleToRule`/`ctaFillRenameLedger`)—— `--update-baseline` **必须保留注记键**,旧写法整文件重写会把他人审计台账冲掉(本轮并入远端时实测踩过)。取证:`--self-test` **94 条断言**(含 3 条阳性对照 + 变异对照)+ `node --test scripts/tests/check-brand-foreground.test.mjs` **13 例**;`--staged` / `--update-baseline` / `--self-test`;紧急跳过 `HUSKY_SKIP_BRAND_FOREGROUND=1`。
- ⚠️ 本行原为守门 83 的**第三条重复登记**,且把取证量写死成"`--self-test` 11 例"(实为 94 条断言)。2026-09-24 就地改写为指向条:该门的现行条目见**上方两条**(编号 83,判据 R1–R5);保留本行只为不丢行,勿照它执行。
- **守门 83 追加 R7(2026-09-25,JSX 渲染嵌套级跨档配对)**:R1 只看同一 style 块、R4 只认命名兄弟(`X`/`XText`),但真实代码里"底"与"它的文字"常毫无命名关系 —— `balanceCard: {backgroundColor: tk.brand.cta}` 配 `balanceLabel: {color: tk.surface.light}`,深色档 `surface.light=#262626` 压 `#4A7A96` = **3.25:1,低于 AA 4.5:1**。R7 用递归下降扫 JSX(深度感知、跳字符串/注释,吃三元、`.map()` 体、泛型 `<FlatList<T>>`、多行与数组 `style={[a, b && c]}`),把前景归到**最近一个自带背景的祖先**;该祖先须整族为品牌档且所有候选前景全不匹配才判,命名兄弟让给 R4 不重复计;并覆盖内联 `color=` 的 icon/spinner(如 `<Plus color={tk.surface.card}>` 落在 cta 悬浮钮上 —— R1/R4 一条都看不见)。**HEAD 实测 16 处 / 9 文件**冻进基线键 `nestMismatchCounts`(只减不增),人工出口 `r7-nest-exempt: <原因>`(**须带原因,不得用它清账**)。构建期自查出两类假阳性并已钉成回归:① 嵌套元素 `style=` 并入宿主 key 集(致 `commentEmptyText` 冒充 `commentNickname` 的底)② 与 R4 重叠的命名兄弟重复计债。取证:`--self-test` 133 条断言(含 34 条 R7,含"把真文件 ctaForeground 改回 surface.light 必命中、换回必 0"的判别力证明)+ 镜像测试 17 例。**性能**:R7 在 557 文件上 137ms(R1+R3+R4 合计 174ms);本门 27–45s 的大头是既有的逐文件 `git show` 取材成本,不是新判据。
- ⚠️ 上面那条的"判定文件 >300 跳过"护栏已被 **2026-09-24 的乘数级例外**收窄(普通文件仍受护栏约束,但门的注册表/门自身/`scripts/lib/`/钩子/根清单/工作流恒照判)——现行口径见本节「本轮四道门的口径/落点收口」第 ② 条与 `scripts/tests/check-stale-revert.test.mjs`;保留原文只为不丢行,勿照它执行。
- **UI/样式**(11/11b/17/18/20/24a/24b/27/28/36):圆角 / 圆角溢出(父 rounded + 子 bg 贴边,warn,2026-08-06 立)/ CSS token / title tooltip / Tailwind 冲突 / 侧边栏宽度+端口注册表(warn)/ z-index 层叠+遮罩 z-index(阻塞,id 27/28,2026-09-22 加固:补 skipEnv + onFailHint,并在 id 27 新增第 5 项两组契约——桌面端自绘窗口控制三按钮挂 z-max(10003) 不能降(须高于 resize 抓手 z-loading=10000),`z-modal` 遮罩永远盖不到它,故等效压暗层 `data-window-controls`+`data-window-controls-dim` 与失焦非活动态 `data-window-inactive` 两组标记缺一不可,**两态弱化/瞬时规则必须写在 `apps/web/app/globals.css`**(入口 CSS 变更必然重编译;实测生产构建里组件内 Tailwind 任意变体未进 CSS 产物);判据有效性自查 `--self-test`;紧急跳过 HUSKY_SKIP_Z_INDEX_GUARD / HUSKY_SKIP_OVERLAY_ZINDEX)/ miniapp-taro design-tokens 同步(阻塞,防 app.css 漂移)
- **桌面端本地缓存明文巡检**(warn-only,2026-09-24 立,**不进提交链**):`scripts/check-desktop-cache-plaintext.mjs` —— D48 的加密代码早在 HEAD(`apps/web/src/lib/chat-persist-crypto.ts` / `local-vault.ts` / `desktop-token-vault.ts`),而桌面端 WebView 数据目录整棵 `ihuiVaultV1` **零命中** ⇒ 票面"静态盘 grep 明文会话为 0"这条验收**是虚假通过**:它绿是因为这台机当前没有登录数据,不是因为数据被加密。四判据必须同时成立才算数 —— **判据 0** 含唯一 nonce 中文串的**阳性对照**(先证明"扫描动作本身看得见明文",缺了它的门等于没有);**判据 1** 断言 `ihui-chat` / goal 键的**结构位**恰为 `{ihuiVaultV1}` → `{alg,kid,iv,ct}`,常量自 `local-vault.ts` 源码解析(**禁止抄第二份字面量**,§"两处算同一 key 必须共用一份实现");**判据 2** 目录级 CJK 命中为 0 **且必须打印实扫清单**,扫描面刻意排除 `Cache_Data`/`Code Cache`/`GPUCache`(实测无正文,35MB+ 只会拖慢并引入二进制误报);**判据 3** 密钥不入仓(`git ls-files` 双向断言)+ `ihui-vault.json` 落点字符串单源。路径一律 `realpathSync` 解析 junction 真身,**禁写死盘符**(§26 台账里的 `D:` 在本机已漂到 `G:`);非 win32 / 目录不存在 → 显式判"未判定"并给原因,**绝不记为通过**。全程只读,任何递归枚举前先判重解析点(§26 的 junction 穿透清空事故)。定级 warn 且刻意不挂 guardian-runner:它判的是**机器状态**,提交者结构上无法满足,挂 blocking 只会逼全队 `--no-verify` 连带废掉全部守门(§12e 同型)。入口 `pnpm check:desktop-cache-plaintext`;取证 `--self-test` 10/10 + `node --test scripts/tests/check-desktop-cache-plaintext.test.mjs` 12/12。
- **Tailwind v3 消费端的 `/alpha` 修饰符由共享 preset 负责**(2026-09-25 立):v3 的 `bg-<色>/<透明度>` 语法要求把颜色拆成 rgb 分量,而 preset 若只给 `var(--color-x)` 单值,这一整类类名在 miniapp-taro 端**根本不产出 CSS** —— 页面"样式没生效"却零报错,而 web/extension(v4,原生支持)一切正常,即"手机上改了 web 没改"的又一成因。修法唯一:`packages/design-tokens/src/tailwind-alpha-plugin.js` 为每个颜色键补 `<key>-rgb` 三元组并 `addUtilities`,挂在该 preset 的 `plugins` 上,**禁止**在端内自拼 `rgba(...)` 绕过。**新增颜色档必须同时进这个插件**,否则新档又缺 `/alpha`。取证:真 miniapp 源码上选择器 73 → 91、REMOVED 0 / ADDED 18(含任意值形态 `bg-muted/[0.12]`);NativeWind 侧装 release 包 v21→v22 逐指标 A/B 六项读数完全相同(零回归)。
- **Tailwind v3 消费端的 `/alpha` 修饰符由共享 preset 负责**(2026-09-25 立):v3 的 `bg-<色>/<透明度>` 语法要求把颜色拆成 rgb 分量,而 preset 若只给 `var(--color-x)` 单值,这一整类类名在 miniapp-taro 端**根本不产出 CSS** —— 页面"样式没生效"却零报错,而 web/extension(v4,原生支持)一切正常,即"手机上改了 web 没改"的又一成因。修法唯一:`packages/design-tokens/src/tailwind-alpha-plugin.js` 为每个颜色键补 `<key>-rgb` 三元组并 `addUtilities`,挂在该 preset 的 `plugins` 上,**禁止**在端内自拼 `rgba(...)` 绕过。**新增颜色档必须同时进这个插件**,否则新档又缺 `/alpha`。**这条散文自 2026-09-25 起是机器判据,不再是约定**:守门「跨端色值 token 漂移对账」新增 **R6**(`scripts/check-cross-end-tokens.mjs`,编号以 runner 现值为准)扫三个 v3 消费端源码(`apps/miniapp-taro/src` + `apps/mobile-rn/src` + `packages/app/src`)里真实写过的 `bg|text|border-<档>/<数值>` 类名,逐条要求 ① 该形态在 `ALPHA_USAGE` 登记过、② 插件的 `buildAlphaUtilities` 真产出那个选择器、③ 每档在 `tokens.css` 有 `<key>-rgb` 三元组;反向也判 —— 登了却没人用的行按"清单腐烂"红(每条登记 = 主包里一条死规则)。判不出的形态(动态拼接类名)与默认色板(`bg-white/50`,v3 原生支持)只报数不判红;行内豁免 `alpha-plugin-exempt: <原因>`,须带原因且只救本行/紧邻上一行。口径同 77/83/98:全量判 HEAD blob、`--staged` 判索引⊕HEAD,**登记表与用量必须同面**(表读磁盘 + 用量读 HEAD 会在并行会话刚补行的瞬间产出假红/假绿);腐烂判据在 staged 面走**棘轮**(存量只计数不判红),否则一枚与之无关的提交会被别人欠的债钉红 → 逼人 `--no-verify`。取证:真 miniapp 源码上选择器 73 → 91、REMOVED 0 / ADDED 18(含任意值形态 `bg-muted/[0.12]`);NativeWind 侧装 release 包 v21→v22 逐指标 A/B 六项读数完全相同(零回归)。R6 上线首跑即抓出 `bg-muted/40` 是**从注释文本里 harvest 出来的假用量**(该文件头注的用量统计当时没剥注释),已删该行,现 17 形态。
- ⚠️ **上面那条 `/alpha` 判据目前到不了小程序产物**(2026-09-25 实测,登记于 PROJECT_PLAN O62附②):`apps/miniapp-taro/config/index.ts` 的 `tailwindcss: { enable: true, config: {} }` 让端内 `tailwind.config.ts`(content globs + `presets:[@ihui/design-tokens/tailwind-preset]` + 本插件)在真实构建中**从未被加载** —— 实测真实 build 后 dist 的 154 个 wxss 里,源码用到的 **687 个 Tailwind utility / 11,105 处用法有 0 个产出规则**,`.flex{` 与 preflight 指纹双双缺失;阳性对照是同一份 dist 里 `app.css` 手写类名 75/98 可查到规则,故不是检索姿势问题。**后果**:改这条配置等于让整端 11,105 处用法同时开始产出 CSS,而现状很可能是手写 CSS 已补偿过(自有类名 2,228 个),开启后好坏只能由微信开发者工具真机渲染判定 ⇒ 属未决决策项,不是已收口项。**同时提醒同源对账门的边界**:门 36/37/93/`check-miniapp-taro-style-parity` 全部只核源码与 token 源头,**没有一道看产物**;它们五道全绿而到端 CSS 为零,是可能且已发生的。新增跨端同源门时,请先问自己判的是"写的同源"还是"生效的同源"。
- **硬编码中文基线棘轮**(70):scan-hardcoded-zh.mjs(blocking,2026-09-22 接线)—— 扫 `apps/web/{app,src/components,src/hooks}` + `packages/{ui-react,shared}/src` + 2026-09-24 补的三端(`apps/mobile-rn/src`、`apps/extension/{entrypoints,src,lib}`、`apps/cli/src`),排除注释/metadata/useTranslations 行/admin/测试。**每文件命中数与基线额度比较**(`scripts/hardcoded-zh-baseline.json`):只拦"比基线更多",存量债(886 文件 / 13090 行)冻结、新增即拦;清理后 `--update-baseline` 下调额度(必须人工确认后再跑,禁止为过门而调高)。该脚本 2026-07-20 即存在但从未接入守门链,是"造好没装车"的第二个实例(第一个是同一批的 69)。`--staged` 由 runner 自动下发(runner 传 `--exit 1`,不带该参数时**永远 exit 0** —— 集成测试踩过),暂存集为空时回退全量防"空暂存恒绿"。**两处同日修**:① 14 例镜像测试自 §15「ROOT 由脚本自身位置推导」起 **13/14 恒红** —— 测试靠 `cwd` 定位夹具而脚本按定义忽略 cwd,14 例全在扫真仓(不是判据错,是调用方式失效);加 `--root <dir>` 显式测试通道(生产不带,语义不变)后 15/15 绿。② 命中判定漏剥**行尾 `//`** ⇒ PriceChart / TerminalTab / TerminalStatusIndicators 各多出 2/1/1 处假阳,把它们顶过基线额度、把本门钉成"谁碰这三个文件谁被拦";同时修 `'https://x/*'` 这类串内 `/*` 骗进块注释状态机的假绿。**遗留(已量化,未修)**:全量模式按共享工作树判,而共享工作树对约 2064 个路径落后 HEAD —— 同一份 HEAD 代码,临时 worktree 干净检出报 **1** 个文件越线(`packages/shared/src/chat/handoff-package.ts` 49 处 / 基线 0),本机工作树报 **281** 个。要么让全量模式改判 HEAD blob(守门 77 已验证的口径),要么把 `heal-worktree-tracked` 的刷新面扩大;前者是判据口径、后者是环境自愈,都不该靠"反正本地红着习惯就好"糊过去。紧急跳过 `HUSKY_SKIP_HARDCODED_ZH_GUARD=1`
- **架构契约对账**(103):`scripts/check-architecture-policy.mjs`(blocking,2026-09-25 立)—— 与其余全部守门**方向相反**的一道:其余是"发现一类违规 → 写一条判据"(打地鼠),本门读 `config/architecture-policy.yaml` 这张**声明表**,从声明反查违规。四类红:**T1** 表与现实脱节(模块改名/目录搬走而表没跟上 —— 表一过期,依赖它的所有判断都在对着空气打分)/ **C1** 单文件行上限(阈值 6000,**取自 HEAD 实测最大文件 5258 行之上**,依据写在 yaml 注释里)/ **D1 D2** 依赖方向(包 import 端、或 `requires` 未声明就 import;以及反向按 rank 更深一层)/ **D3** 深导入(绕过 `public_entrypoints` 直接摸别的包内部 —— 它是"端内重复实现"的入口)。**渐进收口是设计前提**:存量模块一律 `managed: false` ⇒ 只报数不判红(立项实测全量 exit 0、报数 3 处、`managed:true` 0 个),翻 true 前先用 `--managed-trial <id>` 看条数,**不得为消红去改阈值或把不该对外的模块标成 exported**。行内豁免 `arch-exempt: <原因>`(须带原因)。口径同 70/77/83/98/101:全量判 **HEAD blob**、`--staged` 判索引 blob,策略表自身按 HEAD→索引→工作树降级取且**退到工作树会大声提示**;取不到判"无法判定",不冒红也不记绿。取证 `--self-test` 51 例(成对正反 + 两面口径差异 + 解析器坏了必须大声失败)+ 镜像测试 10 例(含 runner 装车证明与"同一代码 managed 两侧结论不同"的判据有牙证明)。编号说明:任务书原定 102,落地前已被 `check-glyph-arrow-icon` 占用,按"后来者改号"顺延 103。紧急跳过 `HUSKY_SKIP_ARCH_POLICY=1`。

> ⚠️ 本行为守门 103 的**立项原文**,其中"策略表自身按 HEAD→索引→工作树降级"已被 2026-09-25 同日的批量归并留成旧副本 —— 现行判据是**按档定向取材**(`policyFaceOrder`:全量 HEAD 优先 / `--staged` 索引优先),原文照抄会重新引入"改表那枚提交不被审"的盲视;现行条目见本节内"镜像测试 13 例"那一条,勿照本行执行。保留本行只为不丢行(§12)。

- **`merge-live-doc` 的第三种定性:同锚点 ⇒ 就地改写(2026-09-25 补,`--self-test` 13→16 例)**。上面两句判据只分"吃掉 vs 存活":容器短路管"旧行逐字活在新行里",Jaccard 管"两行很像"。**改行中段**时两者同时失效(旧行不逐字存活、长行大改后相似度掉到阈值下),于是正当的就地改写被判成"真丢失"并要人跑 `--apply` —— 而 `--apply` 会把旧行原样插回 ⇒ **同一件事新旧两行并存**,本节上方那对重复的"提交活文档前必须做…"登记行、以及守门 83 的三条同体行,制造路径之一就是这个。现规则:三份活文档都是「一件事一行」且行首有稳定锚点(`- **名称**` / `### 标题`),**同一锚点在"HEAD 缺失集"与"工作树独有集"里各只出现一次** ⇒ 判 `superseded`(不插回)。唯一性是生命线:锚点在任一侧数量 ≠ 1 就不猜,退回原判据(宁可多报交人工,也不能把"整段登记被删"洗成"他改写了")。取证两层:①`node scripts/merge-live-doc.mjs --self-test` 16 例(⑭改写⇒0 / ⑮删除⇒仍 lost / ⑯同锚点两条⇒不猜);②CLI 级装车证明 `scripts/tests/merge-live-doc-anchor.test.mjs`(3 例 A/B/C)—— 本文件顶层就是 CLI 且**没有 §22d `isDirectRun` 守卫**(`lib/live-doc-similarity.mjs` 就是为此被抽出来的),所以测试只能把脚本 spawn 起来验,不能 import 判据函数;C 例自证夹具确实"不像",防止 A 臂退化成容器短路的测试。**误判的代价不是"多一行报告",是逼人跑 `--apply`,而 `--apply` 造出的重复行下一次又被判成需要归并 —— 这是它自己的正反馈环。**
- **反回退对账**(84,原 76):check-stale-revert.mjs(blocking,2026-09-23 立)—— 堵共享工作区**静默回滚**:§12d converge 用 merge-tree/commit-tree 只推进 HEAD+index、**不 checkout**,工作区落后 HEAD 时 `git add <file>` 交的是旧基线(实测 503 文件落后 486 提交),等于把别人该路径的后续改动静默回滚,而 diff 只显"改了几行"。判据 R1 = 暂存 blob != HEAD blob **且字节级等于该路径某祖先提交版本** → 拦并点名回到的 commit;真新编辑不可能恰好等于历史 blob,故误报极低。三条护栏:merge 上下文**不再整轮豁免**(2026-09-25 收窄,见下)、暂存删除只 warn(`git rm` 合法,机器分不清就被删)、判定文件 >300 跳过(性能护栏,防逼人 --no-verify 连带关掉全部守门;**乘数级路径不吃这条护栏**,2026-09-24 立)。**合并期窄判据 R1m**:某路径上 `ours == theirs`(两父逐字节一致)⇒ 合并对它无事可做 ⇒ 索引里与两父都不同的内容**不可能来自本次合并**,再要求它恰等于该路径某历史版本才判红 —— 第三个条件是必须的,因为"人工解冲突写进新内容"同样满足前两条,而那是正当形态。`cherry-pick / revert / rebase` 仍整轮豁免(取历史内容本就是其语义)。立因(第四十二批未闭环④):旧口径那句"merge 上下文整轮豁免"是**本门自己的盲区**,当夜 30c 判红、84 沉默,合并期把旧基线写进索引完全无人看守。取证 `--self-test` **12 例**(新增 5a/5b/5c/5d/6b 五例合并对照:两父不同⇒绿、两父一致而等于历史版本⇒红、等于新写内容⇒绿、cherry-pick⇒仍绿)+ §22c 镜像测试 7 例(含"整轮豁免那句写法不得回来"的**反向回归锁** —— 收窄是判据不是临时关闭,必须能被机器发现)+ 临时 index 端到端演练 3/3(2026-09-23 原始取证,保留);**有意回退一律改用 `git revert` 生成前向提交**。紧急跳过 `HUSKY_SKIP_STALE_REVERT_GUARD=1`。
- **架构契约对账**(103):`scripts/check-architecture-policy.mjs`(blocking,2026-09-25 立)—— 与其余全部守门**方向相反**的一道:其余是"发现一类违规 → 写一条判据"(打地鼠),本门读 `config/architecture-policy.yaml` 这张**声明表**,从声明反查违规。四类红:**T1** 表与现实脱节(模块改名/目录搬走而表没跟上 —— 表一过期,依赖它的所有判断都在对着空气打分)/ **C1** 单文件行上限(阈值 6000,**取自 HEAD 实测最大文件 5258 行之上**,依据写在 yaml 注释里)/ **D1 D2** 依赖方向(包 import 端、或 `requires` 未声明就 import;以及反向按 rank 更深一层)/ **D3** 深导入(绕过 `public_entrypoints` 直接摸别的包内部 —— 它是"端内重复实现"的入口)。**渐进收口是设计前提**:存量模块一律 `managed: false` ⇒ 只报数不判红(立项实测全量 exit 0、报数 3 处、`managed:true` 0 个),翻 true 前先用 `--managed-trial <id>` 看条数,**不得为消红去改阈值或把不该对外的模块标成 exported**。行内豁免 `arch-exempt: <原因>`(须带原因)。口径同 70/77/83/98/101:全量判 **HEAD blob**、`--staged` 判索引 blob。**策略表自身的取材按档定向**(`policyFaceOrder`):全量档 HEAD 优先、**`--staged` 档索引优先**,两者都再降级到工作树;取不到判"无法判定",不冒红也不记绿。⚠️ 这里 2026-09-25 修掉一处**本门对自身改动的盲视**:原实现两个面都 HEAD 优先,于是"修改策略表自身"的那枚提交完全不进本门审查 —— 实测往索引版 `apps/cli.requires` 注入一条 `apps/api`(端应用 `exported:false`,T1 必判红)后全量与 `--staged` 双双 exit 0,而 `--staged` 输出照旧打印旧表的 `managed:true` 清单。这个洞偏偏落在"规矩 2:翻 `managed:true` 前先试跑"所要求的动作上(提交链是唯一无验的一环),且源码旧注释"表是输入不是被审对象"正是它的设计理由,已就地推翻。取证 `--self-test` 51 例(成对正反 + 两面口径差异 + 解析器坏了必须大声失败)+ 镜像测试 12 例(含 runner 装车证明、"同一代码 managed 两侧结论不同"、以及 T12 的**取材面双向条件不变量** —— 索引表≠HEAD 表则两档结论必不同形、相同则必同形;变异回旧顺序只有 T12 红)。**收口进度不写进文档**:某模块是否 `managed:true` 一律按当次实测取(`--staged` 输出行即现值),理由与本门刚修的那类缺陷同源 —— 登记过期数字会替人做出"已经收口"的判断。编号说明:任务书原定 102,落地前已被 `check-glyph-arrow-icon` 占用,按"后来者改号"顺延 103。紧急跳过 `HUSKY_SKIP_ARCH_POLICY=1`。

> ⚠️ 本行是守门 103 的**中间态副本**(2026-09-25 同日两次改写之间的一次),其中"取材面双向条件不变量"这条断言**已被删除** —— 它两条前提都不成立(改注释/requires 会让表不同而 managed 集合不变;尺子若吞到行尾则两档因"扫描 N 文件"天然不等),留着会教人把它当判据复原。现行是"镜像测试 13 例"那一条(T12 改用纯函数+构造面、新增 T12b 尺子反例、T8 改为自带构造的 false 侧)。勿照本行执行;保留只为不丢行(§12)。

- **架构契约对账**(103):`scripts/check-architecture-policy.mjs`(blocking,2026-09-25 立)—— 与其余全部守门**方向相反**的一道:其余是"发现一类违规 → 写一条判据"(打地鼠),本门读 `config/architecture-policy.yaml` 这张**声明表**,从声明反查违规。四类红:**T1** 表与现实脱节(模块改名/目录搬走而表没跟上 —— 表一过期,依赖它的所有判断都在对着空气打分)/ **C1** 单文件行上限(阈值 6000,**取自 HEAD 实测最大文件 5258 行之上**,依据写在 yaml 注释里)/ **D1 D2** 依赖方向(包 import 端、或 `requires` 未声明就 import;以及反向按 rank 更深一层)/ **D3** 深导入(绕过 `public_entrypoints` 直接摸别的包内部 —— 它是"端内重复实现"的入口)。**渐进收口是设计前提**:存量模块一律 `managed: false` ⇒ 只报数不判红(立项实测全量 exit 0、报数 3 处、`managed:true` 0 个),翻 true 前先用 `--managed-trial <id>` 看条数,**不得为消红去改阈值或把不该对外的模块标成 exported**。行内豁免 `arch-exempt: <原因>`(须带原因)。口径同 70/77/83/98/101:全量判 **HEAD blob**、`--staged` 判索引 blob。**策略表自身的取材按档定向**(`policyFaceOrder`):全量档 HEAD 优先、**`--staged` 档索引优先**,两者都再降级到工作树;取不到判"无法判定",不冒红也不记绿。⚠️ 这里 2026-09-25 修掉一处**本门对自身改动的盲视**:原实现两个面都 HEAD 优先,于是"修改策略表自身"的那枚提交完全不进本门审查 —— 实测往索引版 `apps/cli.requires` 注入一条 `apps/api`(端应用 `exported:false`,T1 必判红)后全量与 `--staged` 双双 exit 0,而 `--staged` 输出照旧打印旧表的 `managed:true` 清单。这个洞偏偏落在"规矩 2:翻 `managed:true` 前先试跑"所要求的动作上(提交链是唯一无验的一环),且源码旧注释"表是输入不是被审对象"正是它的设计理由,已就地推翻。取证 `--self-test` 51 例(成对正反 + 两面口径差异 + 解析器坏了必须大声失败)+ 镜像测试 13 例(含 runner 装车证明、"同一代码 managed 两侧结论不同"、T12 的**纯函数+构造面**取材面证明、以及 T12b 的尺子反例;变异回旧顺序只有 T12 红)。**本门自身踩过的判据教训(勿再犯)**:这里曾写过一条"索引表≠HEAD 表 ⇒ 两档收口集合必异形"的条件断言,两条前提都不成立(改注释/requires 都会让表不同而集合不变;尺子若吞到行尾则两档因"扫描 N 文件"天然不等)⇒ 一支误红、一支无牙,已删。**证明取材面这类行为只能用纯函数+构造面**,不得依赖仓库瞬时状态。**收口进度不写进文档**:某模块是否 `managed:true` 一律按当次实测取(`--staged` 输出行即现值),理由与本门刚修的那类缺陷同源 —— 登记过期数字会替人做出"已经收口"的判断。编号说明:任务书原定 102,落地前已被 `check-glyph-arrow-icon` 占用,按"后来者改号"顺延 103。紧急跳过 `HUSKY_SKIP_ARCH_POLICY=1`。
  - **`merge-live-doc` 的第三种定性:同锚点 ⇒ 就地改写(2026-09-25 补,`--self-test` 13→16 例)**。上面两句判据只分"吃掉 vs 存活":容器短路管"旧行逐字活在新行里",Jaccard 管"两行很像"。**改行中段**时两者同时失效(旧行不逐字存活、长行大改后相似度掉到阈值下),于是正当的就地改写被判成"真丢失"并要人跑 `--apply` —— 而 `--apply` 会把旧行原样插回 ⇒ **同一件事新旧两行并存**,本节上方那对重复的"提交活文档前必须做…"登记行、以及守门 83 的三条同体行,制造路径之一就是这个。现规则:三份活文档都是「一件事一行」且行首有稳定锚点(`- **名称**` / `### 标题`),**同一锚点在"HEAD 缺失集"与"工作树独有集"里各只出现一次** ⇒ 判 `superseded`(不插回)。唯一性是生命线:锚点在任一侧数量 ≠ 1 就不猜,退回原判据(宁可多报交人工,也不能把"整段登记被删"洗成"他改写了")。取证两层:①`node scripts/merge-live-doc.mjs --self-test` 16 例(⑭改写⇒0 / ⑮删除⇒仍 lost / ⑯同锚点两条⇒不猜);②CLI 级装车证明 `scripts/tests/merge-live-doc-anchor.test.mjs`(3 例 A/B/C)—— 本文件顶层就是 CLI 且**没有 §22d `isDirectRun` 守卫**(`lib/live-doc-similarity.mjs` 就是为此被抽出来的),所以测试只能把脚本 spawn 起来验,不能 import 判据函数;C 例自证夹具确实"不像",防止 A 臂退化成容器短路的测试。**误判的代价不是"多一行报告",是逼人跑 `--apply`,而 `--apply` 造出的重复行下一次又被判成需要归并 —— 这是它自己的正反馈环。**
- ⚠️ **上面那条 `/alpha` 判据目前到不了小程序产物**(2026-09-25 实测,登记于 PROJECT_PLAN O62附②/附③):源码用到的 **687 个 Tailwind utility / 11,105 处用法**,在真实构建(`pnpm --filter @ihui/miniapp-taro build`,exit 0)的 154 个 wxss 里 **0 个产出规则**(`.flex{` `.items-center{` `.rounded-xl{` `.bg-muted{` `.text-sm{` 逐条为 0);而 **base/preflight 层是在的**(`border:0 solid;box-sizing:border-box;margin:0;padding:0`)⇒ 症状精确到"**只有 utilities 层为空**"。阳性对照:同一份 dist 里 `app.css` 手写类名 75/98 可查到规则。**机制不是** `config/index.ts` 那行 `tailwindcss: { enable: true, config: {} }` —— 实测把它改成真实配置路径后 A/B/C 三次构建产物**逐字节相同**(该键不是开关);真因指向 weapp-tailwindcss 5.2.9 **自带一份 vendored tailwind**(`dist/tailwindcss-*.js`)并由它自己的 generator 出 CSS,项目 `tailwind.config.ts` 的 content globs 没有喂进那条链。**后果**:本条 R6 判据守的是"源码用量 ↔ 登记表 ↔ 插件产出"三者一致,这三者都在**项目侧**;小程序实际产物由第三方 generator 决定,R6 的绿灯**不等于**到端生效。改这行配置的爆炸半径见 O62附③(主包余量 42,401 B 而 utilities 约 42,392 B,以及 `text-card` 同名双义会被注入白底白字)。
