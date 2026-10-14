<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# AGENTS.md — IHUI-AI 项目 Agent 指南

> 作用域:`G:/IHUI-AI` 仓库根目录及所有子目录。凡「盘符 / gitdir 形态 / 远端 URL / 代理 / 服务承载体(nssm·计划任务·daemon) / PowerShell 解释器身份 / TEMP」七类机器事实,**每次使用前按当次实测取值**,不得把本文或另一台机的现状当本机事实写进判据。
> **本文件为 2026-10-14 压缩版**:规则条款全部保留;历史叙述、失效原文残留、重复登记副本与超长守门登记整区逐字归档于 `.ihui-agent/archive/AGENTS_full-pre-compact-2026-10-14.md`(出处 HEAD `c7834a8f0388aa006ca746cb1cc4a3006336c23d`,1,261,607 字节)。本文与归档原文冲突时以本文为准;本文未写的历史案例按归档件查。另见 `.ihui-agent/archive/AGENTS_history.md`。

## 0. 全局铁律(先读,跨节通用)

1. **凡数字一律现读**:本文所有计数、门编号、例数都是登记时刻读数,派单/问责前必须重跑对应脚本取现值。
2. **恒红门禁令(§12e/§12f)**:与本次提交内容无关的红门,唯一结局是逼人 `--no-verify`、连带废掉全部守门。判机器状态/判历史存量的 → warn 或差值棘轮(只拦新增);**升 blocking 的前置 = 存量归零**。
3. **"没判"绝不写成"判过"**:取不到输入 ⇒ exit 2 显式「未判定」并点名原因,不记绿也不冒红;枚举到 0 个候选判死不记绿。
4. **守门取材面纪律(守门 118)**:全量档判 **HEAD blob**、`--staged` 判**索引 blob**、`--worktree` 仅人工逃生舱;清单与内容同面同轮;取不到不回落另一个面。
5. **棘轮锚点 = 该文件 HEAD 自身的违规数**:只拦"本次改动把违规加回来",存量只报数。
6. **单一真相源**:同类判据/清单/取值实现全仓只许一份,第二份必然漂移(§22c);测试 import 源脚本 `__test__`,禁止复制判据。
7. **豁免必须"验过才免"且会到期**(守门 108):行内豁免标记必须带原因、逐行生效;豁免族必须登记存活期;已登记的豁免若被审面不再命中 ⇒ 清单腐烂判红。
8. **文档不得写跑不通的出路**:给用户的每条命令必须真跑得通;应急跳过变量以 `scripts/guardian-runner.mjs` 注册条目现值为准,本文不逐枚罗列。
9. **判据必须在真跑它的那一刻才成立**:"造好没装车"= 没有;守门 89 R4:已接线而 AGENTS.md/README.md 通篇不点名 ⇒ 红。
10. **失效方向必须是"多要一次定向说明",绝不能是"多放一次跳门"**(归因、豁免、跳门留痕同此禁令)。

## 1. 任务计划文档规则(强制)

- 唯一任务计划文档 = `PROJECT_PLAN.md`(根目录)。所有计划/进度/待办**只写**此文件,禁止在别处新建计划/TODO/ROADMAP 文件(唯一例外:`/goal` 模式的 `.ihui-agent/goal-runtime/STATE.md` + `loop-run-log.md`,以及 `.ihui-agent/skills/SKILL.md`)。
- 完成翻勾 `[ ]` → `[x] ✅(日期)`;新增任务追加到对应优先级(P0/P1/P2)末尾;commit message 用 `feat/fix/docs/chore/test/refactor` 前缀。
- **认领即租约**:开始任务在 `- [ ]` 后追加 `（进行中@YYYY-MM-DD/持有者短名）`,三要素齐备才算认领(裸 `（进行中）` 只计数不判红;年龄 >72h 判红,守门 109);完成翻勾并摘牌;**门绝不自动摘除任何人的认领**。派单前先扫进行中项:`node scripts/check-task-claims.mjs`。
- **一个编号只能有一行"当前状态"**:新登记同一件事必须把旧行翻勾或就地改写,不得再抄一份(复合主键 = 编号 + 标题前缀逐字等值,不是相似度;机器闸在 `scripts/live-doc-edit.mjs` 写盘闸 + 守门 130 差值棘轮)。归并出口:`node scripts/plan-tasks-merge.mjs --heal --commit`(F4 只加指针、绝不动勾选)。
- **派单口径只认一个入口**:`node scripts/plan-tasks.mjs --open --dispatchable --exclude-inflight`(数字现读;被摘除的"在飞"行是临时让位不是完成)。
- **证据指针禁止行号、禁止 7-12 位短 sha**:行号一次 append 就挪位;短 sha 腐烂率 30.2%——**要么全量 40 位,要么内容锚点**(编号 + 标题原文)。两条登记入口(`live-doc-edit.mjs` / `safe-commit.mjs`)已接机器闸。
- **新登记必须有交代**:一条 `- [ ]` 要么带租约、要么写明在等什么、要么带新鲜日期;三样皆无 = 无交代,提交链差值棘轮只拦本次带进来的(守门 130 F7/F8)。
- **同题跨号禁止**:`{{NEXT_ID}}` 取号令牌 + 标题指纹查重(守门 203 `check-plan-task-duplicates.mjs` + `live-doc-edit` 写盘闸双接线);同号同题副本走 F4 归并。
- **「重复登记副本」指针注记存量已清零、今后一条也不许再产生**(2026-10-13/14 收口):自动档已停产指针注记(F4/F10 只报数);守门 13d 差值棘轮拦注记变多;门 71 归档豁免射程已纳入清偿台账——**旁路落地(回捞器/自愈)不跑钩子,防它必须在判据源头接**。分族键指纹优先(与门 203 同源),不要按复合主键分族。
- **归档机制**:已完成条目(含 bullet 级 `- [x]` 连续块)禁止直接删除,两步走——①完整条目移入 `.ihui-agent/archive/PROJECT_PLAN_YYYY-MM-DD.md`;②原位置留 HTML 注释占位,且**占位点名的文件必须真在审面里**(守门 13c A1/A2/A3)。块内有未勾行 ⇒ 先 `node scripts/ledger-strip-open-rows.mjs --apply` 移出块,不得改判据放过、不得随块搬走。自动档:`scripts/archive-completed-tasks.mjs`(post-commit 自动 `--auto-commit`,阈值 0=完成即归档;大批量按最旧优先贪心取前缀,单批 ≤500 段/256KB;假条目"标题已完成体内有未勾"一律不搬,`--allow-mass` 绕不过)。归档锚点必须受版本控制(`.gitignore` 的 `!.ihui-agent/archive/` 例外不得改);归档 commit 必须带 pathspec。手动:`pnpm archive` / `--days N` / `--dry-run`;跳过 `HUSKY_SKIP_ARCHIVE=1`。守门:`scripts/check-project-plan-archive.mjs`(13c)。
- **自动档写活文档的硬规矩**:底稿一律取被审面(`git show HEAD:<文档>` / `scripts/lib/face-reader.mjs`),落盘走对象空间(临时索引 + `commit-tree` + CAS,不写工作树);落地前自证"父提交里每条 `[x]` 复合主键本次仍为 `[x]`",不成立拒绝落地(实测 18 行翻勾被退回的事故即此型)。

## 2. 项目概览

IHUI-AI 全栈 AI 平台(TS Monorepo + pnpm workspace + Turborepo),8 端(2026-10-03 起 apps/assistant 已服务端化并入 ai-service):`apps/api`(Fastify 5 + Drizzle 0.38 + PostgreSQL)、`apps/web`(Next.js 16 + React 19 + Tailwind 4)、`apps/ai-service`(FastAPI + LangGraph + LiteLLM + MCP)、`apps/miniapp-taro`(Taro 4)、`apps/desktop`、`apps/extension`、`apps/mobile-rn`、`apps/cli`;共享层 `packages/`(database / auth / types / ui / config / eslint-config / tsconfig / shared / api-client / design-tokens / app / ui-react / ui-native / i18n 等)。

## 3. 代码风格

- 做减法、最小化、零冗余;复用现有代码与模式;不创建文档文件(除非明确要求);不加 license header;每页面 < 250 行;时间用 `Intl.DateTimeFormat`。
- **TypeScript 类型零技术债**:禁 `any`(例外三选一须行内 `// FIXME(any): 原因+移除计划`);公共 API 显式精确类型;新代码 `tsc --noEmit` 0 错误;`@typescript-eslint/no-explicit-any: error` 已生效(lint-staged 阻塞);typed-lint 目标态启用前置 = lint 性能优化 + 历史错误清零 + allowDefaultProject 就绪(评估见归档件);测试文件豁免;CI typecheck 全绿方可合并。
- **共享层优先(强制)**:写新代码前先查 `packages/shared/src/{hooks,utils,stores,constants}`、`packages/types`、`packages/api-client`,端内禁止重新实现共享层已有功能;跨端可用的先提取到 shared(工厂模式 + 平台 adapter 注入,禁止 `Platform.OS==='web'` 分支进共享层);平台特有的在文件头注释 `// 平台特有:依赖 [DOM/RN/Taro] API`。守门:`check-shared-layer-duplication.mjs`。

## 4. 前端 UI 约束

- compact 紧凑、elegant 优雅;hover 用 subtle 颜色变化,不要蓝色发光边框;复用 `packages/ui-react` 的 Card/Button/Input/Dialog;状态徽章 draft 灰/published 绿;积分正绿负红。

### 品牌 CTA / 主按钮色同源(强制)

- **唯一写法**:品牌实底 + 其上文字,RN/共享包写 `brand.cta`(底)+ `brand.ctaForeground`(字)成对;CSS 侧 `--color-cta` + `--color-cta-foreground`。黑/白反转:亮=纯黑底白字,暗=纯白底黑字,`.dark` 显式覆盖。调观感只改 `tokens.css` 一处,三端同动,禁止端内单独覆盖或自立 CTA 档(`brand.ctaFill/ctaText` 类混血键已删,不得加回)。跨端 Button 基座唯一源 = `packages/design-tokens/src/button-variants.ts`(`SHARED_BUTTON_BASE/VARIANT/SIZE` 三表,两端 cva 先 spread 再追加,禁止端内抄同档 class string;锁定 `scripts/tests/shared-button-tier-base.test.mjs`)。新增品牌档:先落 `tokens.css` → 同源对账门映射表登记;RN 专属键进 `RN_ONLY_BRAND_KEYS` 须写明理由,豁免项消失同样算红。

### 描边不得取墨档(强制)

- 任何描边(RN `borderColor`、web/小程序 `border-primary`/`ring-primary` 类名、CSS `border*: var(--color-primary)`)一律不得取墨档(`brand.DEFAULT`/`brand.foreground`/`brand.ctaForeground`/`text.primary`)。合法出路:中性描边 `border.light/medium`,强调描边 `brandAccent.light/deep`。唯一例外位:输入框/选择控件聚焦态描边(2026-09-30 用户定档)。守门 83 R8,基线零容忍,行内豁免 `border-ink-exempt: <原因>`。

### 圆角单一源头(强制)

- 唯一真相源 `packages/design-tokens/src/radius.js`:`RADIUS_STEPS` = xs 2 / sm 4 / md 6 / lg 8 / xl 12 / 2xl 16(px);角色档 `RADIUS_ROLES` = tiny→xs / control→sm / chip→md / card→lg / panel→xl / hero→2xl,新增角色必须同笔有消费方。取用形态:web/Tailwind 用 `rounded-xs..2xl` 与 `var(--radius-*)`;RN 用 `rnRadius.<step>` / `rnRadiusFor.<角色>`;CSS 用 `var(--radius-*)`;**禁止** px/rpx 字面量、`rounded-[任意值]`、字符串形态 `borderRadius:'8px'`、本地 `*_RADIUS` 常量。SVG 内联写 `rx={rnRadius.xs}`;生成式 HTML/CSS 字符串用 `RADIUS_CSS_PX` 插值。**B6 引用 `rnRadius`、`rnRadiusFor`、`RADIUS_CSS_PX` 却未在本文件 import ⇒ 判红**(悬空标识符 typecheck 与 HEAD 门双盲)。真圆/胶囊靠量出来的形状不靠标记:半径一刀切 ≤2xl;胶囊判红三条件 = 盒形只取自身属性区 + 非正方盒 + 短边 ≥16px;细于 16px 的进度条/骨架/指示点只开队列不判。守门:`check-radius-single-source.mjs`(77)三判据 A 档位表对账 / B 端内取用 / C 覆盖面;`check-radius-role-conformance.mjs` 角色档;`check-rounded-full.mjs`(11)容器纯圆。

### Button 高度档位守门(强制)

- `@ihui/ui-react` 的 `<Button>` 禁止 className `h-*`/`w-*` 覆盖,必须用 `size` 档(xs 28 / sm 32 / default 36 / lg 40 / icon-2xs 28 / icon-xs·icon-sm·icon 32);新高度先在 `button.tsx` size 表立档。守门 `check-button-height.mjs`(档位清单动态解析)。

### 中文字体 + 图标垂直对齐(强制)

- web `globals.css` 已有 vcenter 补偿(0.3px,text-xs 0.7px);button/a 内 icon + 文字必须包 `<span>`(`<Button>` 已内置 `wrapRawTextChildren`;手写原生元素须自包);**严禁** `-mt-px` 反向 hack;flex/inline-flex span 豁免补偿。守门 `apps/web/e2e/icon-text-alignment.spec.ts`(|delta| ≤ 0.15px)。
- **数字计数徽章模板(强制)**:`inline-flex h-4 min-w-4 items-center justify-center rounded-md bg-*/… px-1 text-[10px] font-semibold leading-none tabular-nums`,禁止裸 span 手搓。

### 页头返回键 / 「更多」入口单一源头(强制)

- 三端唯一实现(S0 机制清单,摘线或无人 import 即红,守门 102 S0):小程序返回键 `apps/miniapp-taro/src/components/BackChevron.tsx`、RN/共享屏返回键 `packages/app/src/components/BackChevron.tsx`(`colorScheme` 必填 prop)、RN 更多 `packages/app/src/components/MoreLink.tsx`、web 更多 `apps/web/src/components/common/view-more-link.tsx`、小程序更多/返回箭头复用 `apps/miniapp-taro/src/components/LineIcon/icons.ts` 素材、共享输入框 `packages/app/src/components/TextField.tsx`。web 返回键唯一实现 = `GlobalTopBar.tsx` 的 `TopBarBackButton`(守门 46 拦私接 `router.back()`)。
- 箭头必须矢量图标,禁止字符 `› » → ‹ ←` 当图标(GA1)、「返回」两字当返回箭头(GA4)、混写(GA5)、双返回(GA6 原生导航栏)、导航锚点内字形+带宾语文案(GA8)。豁免通道:`glyph-arrow-exempt` / `back-label-exempt` / `nav-chrome-exempt`(各带原因、互不串门、进守门 108 存活期表)。守门:`check-glyph-arrow-icon.mjs`(102)。

### 其他 UI 硬规则(强制)

- **禁止分割线**:`<hr>`/`divide-*`/单边 `border-t/b/l/r` 当纯分隔线一律禁止,用 `space-y-*`/背景对比替代;结构性边框(容器边框收口、引用块左边框、IDE diff)允许;低透明度单边边框由 `check-no-divider.mjs` WARN。
- **禁止渐变遮罩**:mask-image/linear-gradient 边缘淡出禁止(`check-no-mask-image.mjs`),用显式 UI 元素替代。
- **禁用原生提示窗**:`title`/`alert()`/`confirm()`/`prompt()` 禁止,用项目 `Tooltip`(`check-no-native-dialog.mjs`)。
- **图标一律图标库**:web `lucide-react`、RN `lucide-react-native`、小程序 `static/images/icons/` lucide 风格 SVG(`node scripts/gen-taro-lucide-icons.mjs <name>` 生成);禁止 emoji 充当 UI 图标(`check-no-emoji-icons.mjs`);**品牌/平台图标必须官方真实图标**(favicon 直取 → Google s2 → favicon.im → 官方 CDN,人工目检;`publish-icons/` 与 footer mono 剪影两套素材禁止混用;`.ico` 仅为兜底)。
- **圆角容器内 absolute 子元素避让**:父 `rounded-xl`+`overflow-hidden` 时贴边子元素禁 `h-full/w-full`,用 `top-<radius> bottom-<radius>` 映射(lg→2/xl→3/2xl→4)。
- **浮动弹层内边距四档**:内容面板 `p-3`、菜单列表 `p-1`、轻提示 `px-2 py-1`、复合面板外层零 padding 行级自带;禁止自创中间值,同族组件必须同档。
- **状态栏避让单一源头(97)**:唯一注入点 `apps/mobile-rn/App.tsx` 的 `<SafeAreaView edges={['top']}>`;`packages/app` 不碰顶距;禁 `StatusBar.currentHeight`/`statusBarHeight` 取值与 24..60 魔法顶距;豁免 `statusbar-exempt: <原因>`。守门 `check-statusbar-single-source.mjs`。

### 跨端样式同步铁律(强制)

- web 与 miniapp-taro 视觉必须完全一致(除平台独占差异);**任何一端改样式必须同步另一端,这是交付门槛**。小程序与 RN 必须长成同一张脸:一份平台无关组件源 + 平台 adapter,禁止两端各写一份靠对账追平;对账门 `check-cross-end-ui-parity.mjs`(128,blocking,棘轮基线 `cross-end-ui-parity-baseline.json`,含圆角 RD 维与 web 腿 WD 维,差异必须显式登记 waivers,静默不同形与为消红补数字都违规)。
- **单一色值源** `packages/design-tokens/src/styles/tokens.css`;各端副本(`app.css` 受管块、`mobile-rn/global.css`、`rn-tokens.ts`、`@theme` 注册区、theme.json/THEME_CHROME)一律**派生态**:原位写回、幂等、禁止手改,由 `scripts/lib/design-token-blocks.mjs` 唯一取源 + `sync-miniapp-tokens.mjs`/`sync-miniapp-chrome.mjs` 等派生,挂 `TOKEN_SYNC_TARGETS` 自动写回;守门 36(`check-miniapp-tokens-sync.mjs`)核 `:root/.dark/@theme` 三面。改 token 只改源头 + 跑 sync。新增跨端档位顺序:tokens.css → sync → 门复核。
- 主题系统:miniapp 路由页顶层 `<ThemeRoot>`;切主题必须 `setThemePreference`(同步原生导航栏/tabBar);RN `dark:` 类依赖 `color-scheme-sync.ts` 落 store,不得混用两套色源;禁止深色科技风回潮与同名工具类冲突。守门 `check-miniapp-taro-style-parity.mjs`、`check-cross-end-tokens.mjs`(93)。
- Tailwind 版本事实(现读为准):miniapp 实跑 v4(vendored by weapp-tailwindcss),`/alpha` 在 v4 原生、v3 端(mobile-rn/NativeWind)靠 `tailwind-alpha-plugin.js`(新颜色档必须同笔进插件);v3 端裸 rpx 任意值必须 `text-[length:28rpx]`(守门 93 R7)。判"到端生效"看 `check-miniapp-css-landing.mjs`(先认 C5/C6 构建档位再说百分比)。

## 5. 后端约束

- Drizzle ORM 0.38 + postgres-js;Zod 校验请求参数;复用 `packages/auth` 的 authenticate;admin 路由 preHandler 统一校验(roleId ≥ 1);幂等用 `onConflictDoNothing`;slug 自动生成;API 响应统一 `{ code, message, data }`。
- **鉴权面公开化必须显式列举(强制)**:禁止兜底正则放行参数路由(会连静态子路由一起放行,fail-open 崩 500);显式白名单列路径;新增 `/agents/<静态段>` GET 必须同步登记 `AGENTS_PROTECTED_STATIC_SEGMENTS`;游客数据 handler 自证 `status=published` + 脱敏;改鉴权面前全仓 grep 调用方。对外能力白名单对账:`check-public-exposure-list.mjs`(X1 精确 location/X2 站点壳与 docker 壳同批/X3 资格/X4 剥身份头/X7 handler 真解析身份;刻意不接提交链,接了镜像 T6 就红)。
- **认证不等于授权(强制)**:归属型记录的入口,令牌主体必须由承载层显式入参传入,不得丢弃、不得从被操作记录反推、不得信客户端自报;身份不得住客户端可整写字段;越权用例必须断言"副作用没发生"并成对留正向对照。出口 `require_request_user_id` / `IDENTITY_METADATA_KEYS` 单源。
- **测试隔离铁律(强制)**:测试一律禁止连生产库(PG 8810/Redis 8811);共享连接池必须 monkeypatch;跑两次 + 行数不变才算通过。

## 5b. `.git` 存续治理(强制)

- **结构与守护**:活 gitdir 形态按当次实测(本机 = 工作区内 `.git` 实体目录;`D:/IHUI-AI-git-repo` 与 `D:/IHUI-AI.git-backup-20260912` 是另一形态的遗留,禁止删除/清理)。守护 = `git-guardian.mjs`(daemon + 计划任务 `IHUI-AI git-guardian` 每 2 分钟),分层自愈 `指针→环境→HEAD→嵌套 ref→本地备份→远端`,破坏性覆盖前先归档到 `gitArchiveDir()`(现 `D:\DevEnv\backups\git\`),**手工抢修也不得把 `.git*` 归档 mv 到工作区根**。诊断:`node scripts/git-guardian.mjs --status|--check`;日志 `.workbuddy/git-guardian.log`(健康不写行)。
- **嵌套 ref 存续**:`git update-ref` 对 depth ≥2 嵌套命名空间静默假成功;对齐 `origin/main` 唯一正解 = `git fetch origin main` → `node scripts/git-refs-heal.mjs`(FETCH_HEAD 权威值固化 packed-refs);禁止手工 update-ref/松散直写 origin/main;禁止 `HUSKY_SKIP_COMMIT_LOSS_CHECK=1` 绕 30a。远端 stale 分支出路 = `git-refs-heal.mjs --refresh-remote`(fetch --prune 连期望清单一起摘)。
- **git 网络与推送**:同步一律 `git fetch <remote> main` + `git merge --ff-only FETCH_HEAD`,**禁止 `git pull --rebase`**。**agent 禁止手写 `git push`**:origin 由 post-commit `git-push-guard.mjs` 自动异步推送(ahead 检测+后台 worker+回读验证,状态 `.workbuddy/push-state.json`);Gitee/GitCode 由 `mirror-to-cn.yml` CI 镜像,本地手推 = 违反架构。收尾核验只跑 `node scripts/git-push-converge.mjs`(只读六态);遇 non-FF 跑 `node scripts/git-sync-converge.mjs`(索引层合并,零触碰他人未提交文件),禁止手工 fetch/merge/push 循环。
- **worktree/索引自愈**(`heal-worktree-tracked.mjs`,挂 guardian tick):①恢复被外部删除的跟踪文件(索引==HEAD ∧ HEAD 存在);②对齐幻影漂移(索引==HEAD ∧ 工作区==某祖先版本);③刷新落后索引(逐路径 update-index,绝不全局 reset);**MERGE_HEAD 在 ⇒ 各写索引层整轮让路**。
- **恢复源增量刷新**:`git-backup-refresh.mjs` 由 guardian 每轮先 `--check` 再增量刷——**关键自愈层不得挂在会自己消失的计划任务上**(兜底可以,唯一挂点不行)。
- **派生进程纪律**:`spawn/exec` 一律 `windowsHide: true`(机器级默认钩子 `install-console-window-hook.mjs --apply`,换机必跑;不得因钩子省略逐点参数);**派生 git 必须显式 stdio**(§12g);`NODE_OPTIONS` 钩子文件必须 `.mjs` 且放仓库外。禁弹窗排查先查 `HKCU\Console\%%Startup` 委托键(已固定 conhost,禁改回 WT)。

## 5c. 溯源水印与生成产物(强制)

- 三层水印(`scripts/watermark.mjs`):L1 可见横幅、L2 横幅内零宽载荷、L3 文件末独立不可见行。载荷必须**可解码且等于 `WATERMARK_TEXT`**;五态:完好/残迹/载荷损坏/仅隐写/未覆盖,后四者 `watermark.mjs verify` 与 `check-watermark-coverage.mjs` 均 exit 1。
- 新建源文件必跑 `node scripts/watermark.mjs inject <file>`;门禁自愈式(检出缺口自动 clean+inject 回写并 git add;单次缺口 >200 拒绝自动回写;CI 用 `verify` 严格判定);生成器 writeFileSync 后必须紧随注入(用 `process.execPath` + 绝对路径)。
- **禁止对含载荷文件做文本级批量改写**(reflow/正则替换/sed -i/编码往返会毁零宽链);需批量改先 clean → 改 → inject;注入幂等。

## 5d. 模型密钥引导与 `.env` 回填(强制)

- 密钥不入仓、不入聊天记录。权威来源 = 网盘同步目录 `密钥/模型/`(每厂商一个 txt);盘符不写死,统一走 `scripts/lib/key-dir.mjs`(F→D→E→G→C 取存在者;非 node 调用方走 `node scripts/secret-path.mjs <子目录> <文件名>`,stdout 恒为路径绝不含凭据;候选序解析器必须同时提供「出处」出口 `resolveKeyDirDetailed()`),env `IHUI_MODEL_KEY_DIR` 可覆盖。
- 回填:`node scripts/env-backfill-model-keys.mjs --verify` 巡检 → `--verify --apply` 写盘;只写空值键、绝不覆盖;apply 前自动备份;输出恒脱敏 `前6***后2 (len=N)`;判读只有「鉴权通过」算有效,网络不可达 ≠ key 无效;换机后 ai-service 静默降级首选跑本脚本。node stdout 的中文路径会被 GBK 码页吃掉——凡"读回来继续用"的值,调 node 前 `[Console]::OutputEncoding = UTF8` 并 finally 还原。

## 5e. 运维到人通知 = 邮件单通道(强制)

- 告警/运维到人只有邮件一条通道,第三方推送腿已整体摘除;配额只按身份去重(默认 4h),**禁止自设每日总量上限**(撞顶 = 静默丢投递)。发信一律经 `apps/api/scripts/notify-deploy-failure.ts`(版式唯一源 `email-templates.ts`,守门 81 硬拦自拼 SMTP);多行中文正文走 `--message-file`(无 BOM UTF-8);调用方不得传 `--env-file`。
- **告警"可整改性"准入(5e-1)**:判据挂到人通道前必须回答"红了收信人能做什么"——能整改给可执行下一步;不能整改但合法进白名单写明理由;判据本身有问题就拆/撤。同一故障按稳定语义身份去重(dedupKey = 类别+计数,不按会抖动的明细清单)。
- **删除类运维动作不得推回用户(5e-2)**:"需要你手动跑 X"禁止对用户说;agent 自己查端口/进程、自己清、自己验证、只汇报结果。唯一例外 = 需用户职权的动作。大批量删除正解 = `robocopy /MIR` 镜像空目录(独立进程,不经 node fs 守卫;exit 2=成功);深路径先 rename 到短路径再删;Git Bash 传参会吞 `/MIR` 必须走 PowerShell。递归删除前核验三件事:已摘登记面/无进程持有/无未入库工作。失败必须响(UNDELIVERED 标记 + 下次成功自动清)。
- 通道"可用"必须被量到,不能靠"没人记下失败";改通道改完必须重启对应服务;判断"执行的是哪份文件"按 `nssm get <svc> AppParameters` 实际路径,不按 `git ls-files`(`deploy/prod-bundle/` 运行副本可与入库源不同,影子对账由 `check-prod-bundle-shadow.mjs` 判逐字节等值)。

## 6. 验证命令

```bash
pnpm turbo build typecheck lint test          # 全量验证(必须全绿)
pnpm --filter @ihui/api typecheck             # 单独验证后端
pnpm --filter @ihui/web typecheck             # 单独验证前端
cd apps/ai-service && mypy app --ignore-missing-imports --strict   # Python 类型
pnpm check:pytest                             # Python 用例唯一入口(透传: pnpm check:pytest -- tests/test_x.py)
pnpm dev                                      # 启动所有服务(端口见 docs/port-management.md)
```

## 7. 删除/重构安全规则(强制)

删除任何 git 对象(分支/stash/commit/文件)前必答三问:①承载什么功能?②有无等价实现?③无 ⇒ 不可删,先迁移/开发替代。禁止基于"路径不兼容""看起来是垃圾"擅自 drop;stash drop / branch -D 同样适用。

## 8. goal 模式工作流(强制)

- 目标条件硬门槛(单条 ≤4000 字符):核心任务 + 验证标准 + 约束边界 + 质量要求 + 异常处理,缺一拒绝启动。
- 运行时文件:`.ihui-agent/goal-runtime/STATE.md`(状态机 active/paused/achieved/blocked/budget_limited)+ `loop-run-log.md`(逐轮追加)。
- 7 步循环:目标解析 → 单轮执行 → 独立评估(禁模型自评 yes)→ 循环判定(连续 3 轮 no 无进展 ⇒ blocked)→ 最终交付校验 → 状态清除交还 → 摘要入 PROJECT_PLAN + 清理运行时文件。
- 红线:单目标 ≤20 轮;高危操作必须暂停等人工;严禁扩展需求;每轮完整承接上下文;连续 5 轮工具失败 ⇒ blocked。blocked/budget_limited 下**禁止** `git reset --hard`/`checkout .`/`clean -f`;必须在 PROJECT_PLAN 记录现场,回滚决策权归用户。

## 9. 多端同步开发强制规则(强制)

- 每个任务默认 8 端同步开发:"匹配连通好" = 代码同步 + 链路打通 + 验证齐绿;禁止只改一端交付、单端验证、分期交付。平台独占豁免须在 PROJECT_PLAN 显式标注。主 agent 用 §11 按端拆 subagent,跨端契约对齐不下放。
- **登录/SSO 链路跨端自动同步**:共享登录 UI 只覆盖 mobile-rn,miniapp 登录页独立实现,两端都要动;deep-link scheme:mobile-rn/desktop `ihui://sso/callback`、miniapp `ihui-miniapp://sso/callback`,新增 scheme 同步登记 `SSO_ALLOWED_DEEP_LINK_SCHEMES`;web OAuth 中转页 + `apps/web/app/sso/*` 出口页。
- 守门(warn):`check-multi-end-sync.mjs`(pre-commit 第 21 项)。

## 9b. 单分支开发强制规则(强制)

- 除 main 外禁止新建分支;普通功能/修复/重构/文档一律 main 直接 commit。豁免(逐条点名不静默):`/goal` 的 `goal/*` 临时分支(完成立即删)、48h 在飞窗口内的 PR 分支、linked worktree checkout 分支及其 origin 镜像、镜像远端与幻影引用、stale 远程跟踪引用(出路 `--refresh-remote`)、**`backup/` 与 `ihui-backup/` 引用永不判红**。已合并分支本会话内删净;删未合并分支前必须 tag 备份(§22)。日常 `git fetch origin --prune`。守门:`check-single-branch.mjs`(41,blocking;在飞窗口 `IHUI_SINGLE_BRANCH_GRACE_HOURS`,阳性对照 = 窗口设 0 全翻红)。

## 10. 交付报告一致性硬约束(强制)

交付报告必须与实际产出一致:声称完成的每条给出验证证据(typecheck/test/守门末行现读),禁止"已完成"却没有对应 diff/测试;报告含后续建议与 P1-P5 优化项时不得与"无后续工作"互斥(判据见 `check-delivery-report-consistency.mjs`)。

## 11. 多 Subagent 并行开发强制规则(强制)

任务分配格式(强制字段):任务目标 / 受影响文件(绝对路径,只允许清单内)/ 禁止修改 / 验证命令(子任务完成后必须自行运行)/ 约束边界 / 交付物。**我方现状格(强制,G-830)**:派单前写明当前分支/HEAD、相关文件在飞状态、已有等价实现;前提自检声明"本格内容按当次实测填写"。门不得读自己(判"前提是否腐烂"的门扫被审面,不扫自己)。

## 12. 多会话并行操作同一仓库强制规则(强制)

- **强制 `scripts/safe-commit.mjs` 五步法**(真实事故根治):①暂存文件清单回显 → ②只 add 本任务文件(禁 `git add .`/`-A`)→ ③commit 带 pathspec(只提交声明集)→ ④推送 → ⑤回读验证 local == remote。禁止裸 `git commit`。
- **git 写锁**:`scripts/git-lock.mjs`;部署/构建全局锁 `deploy-lock.mjs`(meta 记 host+pidStart,`pidStart` 量的必须是"判活所问的那个 pid";判活再加一环 = 身份凭据;只有 `mismatch` 给抢占授权,先归档现场再抢;`check`/`release` 不现测)。dev 入口统一 `scripts/dev-with-warmup.mjs` 启动器(拿锁在 spawn 之前;破坏性步骤必须在 acquire 后、next dev 前)。
- **stash 全面禁止**(多会话共享工作区 stash 会吞他人现场);跨会话现场隔离用 git worktree(§12d)。
- **12b 协作收尾 SOP / 12c 并发 commit 防混淆 / 12d worktree 隔离规范**:commit 前 `merge-live-doc.mjs --file <活文档>` 对账(lost/superseded/stale 三态;提交后立刻 `git show <新提交>^..<新提交>` 行级对账,有丢失就地回补);converge 用 merge-tree/commit-tree 只推进 HEAD+index 不 checkout,工作区落后 HEAD 时 `git add <file>` 交的是旧基线(守门 84 R1 拦,判据 = 暂存 blob≠HEAD 且等于某祖先版本)。
- **12e 恒红门优先级(强制)**:与提交内容无关的红门唯一结局是人人 `--no-verify` 连带废掉全部守门——**修红不得顺手削判据**;存量未清时上 blocking = 恒红门;升档前置 = 存量归零。
- **12f 恒红门优先级(同日三道实测)**:同型。判据失效的表现永远是安静;凡"文档写了出路"必须实测真跑得通。
- **12g 派生 git 必须显式接管 stdio(2026-10-03 立,EBUSY 实测)**:本机任何派生 git 必须显式写 `stdio`(不写稳定 EBUSY;`shell:true` 经 cmd.exe 100% 复现;绝对路径不是豁免)。样板:`const stdio = opts.input === undefined ? ['ignore','pipe','pipe'] : ['pipe','pipe','pipe']`(带 input 必须 `['pipe','pipe','pipe']`)。判据门:`check-git-stdio-discipline.mjs`(193,括号配平取整个调用、只判属性名不判取值、禁行内豁免,豁免走具名台账)。反向门 `check-spawn-output-channel.mjs`(199):stdio 丢 stdout 又去读 ⇒ 结论恒 null,拦。任何"这行是否必要"的判断必须 ≥20 次成组对照,单次成功不构成"不需要"的证据。

## 13. 文件修改持久化强制规则(强制)

写盘后必须 Read 验证修改生效,禁止只凭工具返回"成功"就声明完成(缓存/缓冲会让磁盘与预期不一致)。

## 14. Agent 自主验证强制规则(强制)

交付前必须自主运行验证命令(§6)并贴末行现读;禁止把"我写的应该没问题"当验证。

## 15. 工作区卫生强制规则(强制)

- 临时文件一律 `.ihui-agent/tmp/<任务名>/`(gitignored),任务完成清理;路径推导用 `$PSScriptRoot`/`import.meta.url`,禁硬编码绝对路径;ROOT 由脚本自身位置推导,禁 `process.cwd()` 定根(共享工作区 cwd 不可靠,守门 70 镜像 13/14 恒红同型)。
- **15b 项目外落点唯一制**:项目外落点只允许批准目录(`D:\DevEnv\{Temp,logs,backups,cache}` 等);临时夹具唯一落点 `scripts/lib/scratch-dir.mjs`(`mkScratch`/`rmScratch`,工作树同盘 `DevEnv/Temp/ihui-scratch`,**不得** `os.tmpdir()`(TEMP 可能钉 C 盘)、不得落仓库树内(git 夹具会向上逃逸到真仓));两把只读尺子 `check-scratch-root-no-nesting.mjs` / `check-fixture-tmpdir.mjs`。守门 `check-workspace-hygiene.mjs`;`check-temp-landing.mjs` 为配套只读对账工具(未接提交链)。

## 16. Push 阶段跨 Agent 改动保护规则(强制)

push 前必须确认远端无并发会话新提交(`git-push-converge.mjs` 六态);非快进一律走 converge,禁止强推;commit 污染防护 = `.husky/commit-msg` 的 `check-commit-scope-consistency.mjs`(跳过 `HUSKY_SKIP_SCOPE_CHECK=1`)。

## 17. UI 改动验证强制规则(强制)

UI 改动必须真机/真浏览器验证(截图或 e2e),禁止只凭代码审查声明"改好了";web 样式改动 commit message 带 `Verified-DOM:` trailer(`check-style-verification.mjs`,warn)。

## 18. 启动项目语义(强制)

"启动项目"= `pnpm dev` 全栈(web+api+ai-service);单端启动须显式说端名。`dev`/`dev:clean`/`dev:stable` 三条入口统一走启动器(拿锁在 spawn 前)。

## 19. i18n 约束规则(强制)

- 翻译文件语言纯度:zh-TW/ko 阻塞中文残留、ja warn(`scan-i18n-zh-residue.mjs`);en 破损检测 `check-i18n-broken-en.mjs`;parity `check-i18n-keys.mjs`(五语言键集对齐);**新增状态词必须同批补齐五语言**,禁止端内硬编码中文(`scan-hardcoded-zh.mjs` 70,基线棘轮)。
- **JSON 重复键禁止**:JSON.parse last-wins 静默遮蔽;同层重复键守门 `check-i18n-duplicate-namespaces.mjs`(2e-dupns,blocking)。
- 翻译策略 source of truth:`scripts/brand-glossary.json`;ICU 插值走 `t(key,{vars})`,禁 `.replace('{{n}}',…)` 反模式(`check-miniapp-replace-antipattern.mjs`)。
- parity 绿 ≠ 语种对:批量落 i18n 后必须逐语种量 CJK 三族互判 + 扫同名自套一层(`{"x":{"x":…}}`),这两型现无门,人工必查。

## 20. 任务完成硬定义(强制)

5 条全满足才可声明"完成":①代码合入 main 并推送;②验证齐绿(typecheck/build/test);③守门全过;④PROJECT_PLAN 翻勾;⑤交付报告带证据。commit 后忘记 push = 协作事故;4 道自动防线:post-commit 自动 push / push-state 跟踪 / converge 核验 / 任务完成定义。工具失联按流程升级,不得静默放弃。

## 21. 功能开发同步更新 README 规则(强制)

触发:新增功能模块/API 路由/页面/端能力。强制动作:同 commit 更新 README(功能说明 + 使用方式 + 所属端),缺一视为交付事故;豁免:纯内部重构/修复。守门(warn):`check-readme-sync.mjs`、`check-readme-table-integrity.mjs`。

## 22. 防止 commit/push/merge 提交丢失硬性规则(强制)

- 任何丢 commit 风险操作(reset --hard/checkout ./clean/filter-branch/rebase)前:先备份(tag `backup/cleanup-<date>-<branch>` 本地+远端双留),再操作;**已合并分支删除同样先确认远端在**。
- 守门 30a `check-commit-loss-guard.mjs`(blocking):reflog 50 步 + 远端 tag 校验 + tag 可达性 + **悬空 commit 30 天窗维**(2026-10-11 立:近 30 天内新产生且无 `lost-commit/*` 备份的悬空 commit 阻塞,须先 `git tag lost-commit/<name> <hash>` 再 commit;超窗只报数 = §29 人工 GC 存量;时刻读不到 ⇒ 保守算窗内照拦;`--window-days 0` 回全量语义,`--strict` 问责存量)。tag 自动同步:`sync-lost-commit-tags.mjs`;永久档案 `docs/lost-commit-archive.md`。
- reset 丢失的 commit 永久记录于 tag;守门 100 `check-merge-addition-loss.mjs` 拦合并吞掉对侧独有新增(A1:P ∈ 某父 ∧ P ∉ 基底 ⇒ P 必须 ∈ 结果;默认只判未入 origin/main 的合并,增量台账判到一次);守门 168 `check-merge-deletion-resurrection.mjs` 拦本侧删除被合并写回(DR1/DR2;豁免 = 提交信息 `intentional-delete:` 或具名 allowlist)。归并修复出口 `scripts/union-converge.mjs`(集合运算:本侧整树 ∪ 对侧自改路径 ∪ 活文档行级 union;落地前零丢失自证;`--take-ours` 是声明式例外,必须逐条附两版取证)。

## 22b. staged-typecheck 闸门(2026-08-18 立)

全量 include + 错误过滤:暂存面 typecheck 必须全量 include(临时 tsconfig 摘 include = 假绿),错误按白名单过滤;退出码约定:0 成功 / 1 业务失败 / 2 脚本自身异常。守门集成 + 镜像 `check-staged-typecheck.test.mjs`;红线:禁止临时缩小 include 面消红。

## 22c. 镜像常量守门模式规范(2026-08-18 立)

- **三步根治**:①源脚本 export `__test__ = { 核心函数 }`;②镜像测试 `import { __test__ as X } from '../source.mjs'` 直接用生产判据;③守门 `check-staged-typecheck-mirror-sync.mjs` 三阶段检测 export/key/import 锚点。**禁止在测试里复制一份判据常量**(必然漂移;跨门判据 `check-test-judge-not-replicated.mjs` 191,warn,行内出口 `judge-replica-exempt`)。
- 通用形态锁:镜像测试还须断言"注册条目 blocking+skipEnv 成套(装车证明读 HEAD 面 runner)""未注册时头注不得自称已接线""全 runner id 不得重复(反查法)"。

## 22d. `isDirectRun` 模式规范:ESM 脚本"双形态"入口守护(2026-08-18 立)

`.mjs` 工具脚本需同时支持 CLI 直执行与被 import,顶层直接 `main().catch(...)` 会让测试 import 时触发主流程副作用。模板(底部顶层,export 之后):

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

红线:`main()` 必须是 async/Promise;禁手拼 `'file:///' + process.argv[1]`(Windows 反斜杠永不匹配,必须 `pathToFileURL`);守卫放顶层不放 main 内部;`.cjs` 不适用(用 `require.main === module`)。跨门判据 `check-direct-run-guard.mjs`(194,blocking,差值棘轮,豁免只走具名台账 `scripts/data/direct-run-guard-exemptions.json`,无行内豁免)。

## 23. `.gitignore __*` 规则静默忽略 `__tests__/` 教训(强制)

`.gitignore` 的 `__*` 规则会静默吞 `__tests__/` 目录且 `git status` 完全不显示。硬规矩:项目内测试目录用 `tests/`;新建目录前 `git check-ignore -v <path>` 确认不被忽略;守门 `check-test-paths.mjs` 拦被吞的 `__tests__/`。同理警惕 `.cjs` 静默忽略(NODE_OPTIONS 钩子必须 `.mjs`)。

## 24. 新增功能须用户确认强制规则(强制)

触发 = 引入 PROJECT_PLAN 清单之外的新能力。强制动作:暂停 → `AskUserQuestion` 确认(目标/范围/是否入 PLAN 及优先级)→ 显式同意后才开发 → 补登记 PLAN → `feat:` 前缀。红线:禁止未确认直接开发、禁止伪装成修复绕过、禁止"写完了你看下要不要"代替事前确认。豁免:用户本轮明确要求、goal 目标内含、纯修复/重构/测试/文档、PLAN 已有条目细化。

## 25. `verify-*.mjs` / `verify-*.ts` 临时验证文件归档规则(强制)

临时验证脚本放 `.ihui-agent/tmp/<任务名>/`,禁止放 apps/* 根目录或 `.ihui-agent/` 根目录,禁止 commit,禁止留 v1/v2/v3 版本号后缀;`git add` 只加本任务文件。豁免:正式守门脚本(`scripts/check-*.mjs`)、测试文件、已纳 CI 的 `scripts/e2e-*.mjs`。守门:`check-verify-tmp-files.mjs`(warn)。

## 26. C 盘防护强制规则(强制)

- **所有开发工具全局缓存/临时目录必须指向 D 盘**(`D:\DevEnv\`,实测现值为准):`TEMP/TMP→D:\DevEnv\Temp`、`PNPM_HOME=D:\DevEnv\tools\pnpm`、npm/pip/uv cache、`GOPATH/GOMODCACHE/GOCACHE`、`PLAYWRIGHT_BROWSERS_PATH=D:\DevEnv\cache\playwright`;家目录工具态(`.cargo/.rustup/.m2/.cache/.codex/.trae*/.deepseek/.ollama/.ihui/com.ihui.desktop` 等)一律 junction 改道到 `D:\DevEnv\cache\userhome\`,**改道机制定为 junction 不 env 优先**(硬编码读取方靠旧路径可解析;换机/重装后重跑)。
- **盘根"写歪项"封口改道不删**:闭源程序按相对路径写盘根,删必复发;唯一正解 = 名字换 junction 指向批准落点。唯一入口 `scripts/seal-c-root-stray.mjs`(`--check`/`--apply`,清单 `SEALED_DIRS` 带 owner+evidence),并挂进 `git-guardian` 自愈轮(`--apply` 的 junction 会被重启清掉,只靠每日体检不够)。
- **junction 头号危险 = 递归穿透**:PowerShell `Get-ChildItem -Recurse` 会穿过 junction 清空 D 盘真实目标。递归删除/枚举前必须判 `ReparsePoint`;断链用 `[System.IO.Directory]::Delete($path,$false)`;量体积不跟随;`attrib +h` 是陷阱(设到目标侧),隐藏用提供器属性 + 父目录枚举回读。
- **junction 管路径管不了身份**:LocalSystem 服务 TEMP = `C:\Windows\Temp`,HKCU 迁移对它无效。服务/守护脚本落临时物必须显式指定目录 + 用完必删(实测部署日志 526 项泄漏即此型);守门扫描面必须并入 `SystemRoot\Temp`。
- **禁止硬编码 C 盘路径作写入目标**(`C:\temp\*`、`C:\Users\*\AppData\Local\Temp\*` 等;用 `os.tmpdir()`/`$env:TEMP`)。守门:`check-c-drive-paths.mjs`(45,源码字面量)、`check-c-drive-pollution.mjs`(93,warn,实地扫 C 盘 + TEMP 漂移判据,只读永不删;`--strict` 问责)。
- **自动维护**:`IHUI C-Drive AutoMaintain` 计划任务(每天 3am,`c-drive-maintain-hidden.vbs` → pwsh;**注册名含空格,查存在只认 `schtasks /query /fo CSV` 全量列名法**);删除出口唯一 `ForceDelete`,`-DryRun` 拦在该出口;删除面按名字白名单不整片删。页面文件改动留"待重启生效"哨兵。
- 改共享注册类文件(runner/package.json/CI)必须逐块核对 diff,防覆盖他人注册块;判据要能让机器自己发现撞号(runner id 反查唯一性)。

## 27. PowerShell 7 强制规则(强制)

- agent 跑 PowerShell 必须用 `pwsh.exe`(7+),禁 `powershell -File`/`powershell -Command`(5.1 的 UTF8→UTF16LE BOM bug、代码页截断);项目内 `.ps1` 第一行 `#requires -Version 7`;**例外**:`deploy/**` 的 `.ps1` 不吃该 pragma(守门 `check-pwsh-version.mjs` 对该面只报名,真判据在调用侧:调 `deploy/**.ps1` 必须显式 `pwsh` 或经 `.vbs` 包装);路径统一正斜杠;`.ps1` 用 UTF-8 with BOM 写。解释器身份是七类现读机器事实之一——两引擎版本差异每次实测,别按 5.1 或 7 的假设写防御代码。

## 28. 根目录整洁铁律(强制)

一级目录只允许 `check-root-dir-clean.mjs` 白名单内条目(配置/标准文档/`AGENTS.md`/`PROJECT_PLAN.md`/标准目录);禁止在一级目录生成 .log/.html/cookies/截图/ad-hoc 脚本,临时产物进 `tmp/`/`logs/`;新增合法条目必须显式改白名单随 commit 提交;任务收尾跑 `node scripts/check-root-dir-clean.mjs --staged`;被忽略的一级条目纳入只告警层。守门 44(blocking,跳过 `HUSKY_SKIP_ROOT_DIR_GUARD=1`)。

## 29. dangling commit 备份策略(2026-08-19 立)

- `commit-loss-check` 检出的悬空 commit 一律备份为 `lost-commit/*` tag 再继续;保留期 **30 天**,GC 由维护者人工触发(守门不擅自删 tag):确认工作区 clean → 列 tag 预演 → 删 → 验证 `git fsck --unreachable`。红线:不推 origin 之外的 mirror;GC 前未确认 clean = 丢工作;一次删 >1000 tag 后必须 fsck 验证再 push;本节定稿后修订走新小节,不回头改。

## 42. React SyntheticEvent 闭包陷阱(强制)

React 事件对象的 `e.currentTarget` 在 handler 返回后置 null:异步回调(setTimeout/promise/memoized 闭包)内**禁止访问 `e.` 任何属性**;同步作用域先缓存字段(`const id = e.currentTarget.dataset.id`)或用 ref 管理 DOM。守门:`check-event-closure-leak.mjs`(42,blocking,括号配对提取异步回调首参搜 `e.X`)。

## 30. 代理与会话面的状态词汇与撤销语义(强制,2026-09-27 立)

- 状态词汇是一等契约:子智能体六态、后台进程六态、阶段性回复三键、截断提示文案,必须走 i18n 五语言同批补齐,禁端内硬编码。**两套撤销语义分离**:代码 `rollback`(回检查点)与会话 `revert`(撤销一次回答及副作用)不得共用标签;机器代批拒绝后必须留人工放行入口。**钩子无终态不得渲染成"完成"**(没有终态就写"已完成" = 本仓最高频失效型)。

## 附加强制条款(2026-09/10 收口)

- **内部机器调用的豁免必须"验过才免"**:豁免与它跳过的校验共用同一判定实现;越权用例断言"未发出查询/未产生副作用"。
- **会话状态**:登出标记必须比凭据活得久、且不同层;判据唯一出口单源。
- **工作队列必须有死亡机制**;收敛链"崩溃 ≠ 裁决"(git-sync-converge/union-converge 三道口径:崩溃退出不得被读成合并失败或成功)。
- **宿主级提示块唯一出口** `apps/cli/src/utils/prompt-boundary.ts`(`frameSystemReminder`/`neutralizeBoundaries`);`[系统提醒]` 裸前缀禁止复用;第三方内容被省略必须留计数行。守门 `check-prompt-injection-registry.mjs`(129)。
- **shared 包非 Node 宿主纯度**:`packages/shared` 可达闭包禁 `node:` 内建导入(126,blocking;修法 = adapter 注入或移出共享面)。
- **声明必须有消费者**:`check-declared-policy-has-consumer.mjs`(121,五类声明 + `create*Handler/Transport` 工厂);**工具契约三面投影单源** `packages/types/src/{tool-contract,schema-projection}.ts`(111/113/115:契约声明、路由身份键 `ROUTING_IDENTITY_KEYS` 禁入模型参数、入参校验 shadow 档默认 off)。
- **批量写计数诚实性**:`check-batch-write-count-honesty.mjs`(134,blocking):`.where(inArray)` 批量写必须 `.returning({id})` 回库确认集合,响应带 `missedIds`,禁把请求侧 `.length` 当 affected;B3–B7 五维只拦新增。
- **provider 健康四档单一真相源**(200):canonical = `apps/web/app/(main)/settings/llm/types-v2.ts` 的 `PROVIDER_HEALTH_STATUSES`(as const),全仓禁第二份同值声明(PV2)。
- **桌面事件接线三层对账**:`check-desktop-event-wiring.mjs`(Tauri emit → listen → 前端注册;"就绪点亮"按可达性判,被抽进被调函数也算,允许一跳)。
- **迁移正文不可变**(185):已进 journal 的 .sql 禁就地改正文(IM1 首次入库 blob 对照/IM2 索引 vs HEAD);守门 49 记账结构(B1-B5 离线,B6-B9 连库)。**受管 `.env` 键值被清空对账** `check-env-drift.mjs`(守护巡检档,判机器状态不进提交链)。
- **元运维巡检轮** `check-ops-patrol.mjs`:看守者本身还活着吗(P1-P6:副本漂移/规则不热加载/时钟失步/无上限/心跳无人判/引用不存在指标)。**服务存续双探测**:`check-service-binary-paths.mjs`(warn,STATE/nssm Application 存在/端口应答,nssm stdout 是 UTF-16)、`check-public-path-probe.mjs`(outage 与常态分序列,取证经 `run-evidence.mjs` 封缄,truncated 不成合格证)。
- **跳门留痕**:钩子失败归因是量出来的(`scripts/lib/commit-gate-attribution.mjs`:逐道复跑、点名本次文件 ⇒ 必修;批没跑完 ⇒ safe-commit 自跑一遍再归因;汇总块必须先过"轮次绑定"锁——之前那次 staged 清单回显必须完整包含本次声明集)。跳门次数唯一真值 = `.workbuddy/safe-commit-attestation.jsonl`。**agent 不得假设"钩子红了就能跳"**。

## 关键参考文档

| 文档                      | 说明                                                                                         |
| ------------------------- | -------------------------------------------------------------------------------------------- |
| `PROJECT_PLAN.md`         | 唯一任务计划文档(必读)                                                                       |
| `.ihui-agent/archive/`    | 历史归档(只读;含本次压缩前完整原文 `AGENTS_full-pre-compact-2026-10-14.md`)                  |
| `docs/architecture.md`    | 系统架构文档                                                                                 |
| `docs/port-management.md` | 端口注册表(88xx 段;端口表描述部署形态,不判引擎存在性——判引擎先读应用自己的 DSN 再看监听归谁) |
| `docs/UI_GUIDELINES.md`   | UI 规范(§3.1 圆角角色、§4.6 图标对齐算式)                                                    |
| `docs/learning-assets.md` | 学习资产登记(新增/删除工作流必须同步)                                                        |

## 守门脚本速查(压缩索引)

- 原速查整区(约 800 行超长登记)已逐字归档于 `.ihui-agent/archive/AGENTS_full-pre-compact-2026-10-14.md`;此处只留:门 89 本体 + 横向口径 + 全部门名点名索引(R4 义务:每道已接线门必须在本文或 README 可见)。**mode/blocking、skipEnv、编号一律以 `scripts/guardian-runner.mjs` 注册条目现值为准**。
- **手动全量**:`node scripts/guardian-runner.mjs --staged`(pre-commit 模式)/不带为全量;失败不中断,跑完汇总再 exit 1(子门 exit 75 中断仍立即传播;`GUARDIAN_STOP_ON_FIRST=1` 恢复 fail-fast)。

- **守门接线层对账**(89): `scripts/check-gate-wiring.mjs`(blocking)—— 全部守门的"装车检":**R1/R2** 头注或文档声称已接而五处权威点(`guardian-runner` ∪ `scripts/lib/pre-commit-hook.js` ∪ `.husky/*` ∪ 根 `package.json` ∪ `.github/workflows`+cert)零命中 ⇒ 拦;**R4** 已接线而 AGENTS.md/README.md 通篇未点名 ⇒ 拦(去后缀同名即算,文档面按 HEAD∪索引判,绝不读工作区);**R5** 同 id 登记两门 ⇒ 拦;**R7** dispatcher 依据文件不存在 ⇒ 拦;**R8** `stagedTriggers` 会让 `guardian-triggers.mjs` 当场抛错 ⇒ 拦。R3/R6/弱接线只报数。台账 `scripts/gate-wiring-allowlist.json` 只救 R3。

- **横向口径(适用于绝大多数内容门,勿逐门重抄)**:全量判 HEAD blob / `--staged` 判索引 blob / `--worktree` 仅人工;两面旗同给 exit 2;取不到判「无法判定」不回落;枚举到 0 判死;棘轮锚点 = 该文件 HEAD 自身违规数;行内豁免须带原因且多数登记守门 108 存活期表;取证 = `--self-test` + §22c 镜像测试,例数以命令末行现读为准;遮罩统一引 `scripts/lib/code-mask.mjs`,方向分两档(判字面量的门"只遮注释保留字符串",判代码结构的门"注释与字符串都遮")。

- **门名点名索引**(按主题归堆;blocking/warn 以 runner 现值为准):
- 计划文档: `check-plan-dup-pointer-ratchet.mjs` `check-plan-sha-resolvable.mjs` `check-plan-sha-form.mjs` `check-baseline-freshness.mjs`
- git/提交链: `check-commit-scope.mjs` `check-push-sync.mjs` `check-head-typecheck.mjs` `check-typecheck.mjs` `check-git-read-timeout.mjs` `check-spawn-stdio.mjs` `check-registry-worktree-superset.mjs`
- 接线/守门自身: `check-gate-face-discipline.mjs` `check-skip-env-promise.mjs` `check-selftest-registrant-evaluates.mjs` `check-list-predicate-has-positive-proof.mjs` `check-baseline-freshness.mjs` `check-ops-patrol.mjs`
- UI/样式: `check-miniapp-taro-design-tokens.mjs` `check-adapter-style-parity.mjs` `check-percent-clamp-single-source.mjs`
- i18n/文案: `check-i18n-locale-content-language.mjs` `scan-web-dead-i18n-keys.mjs` `scan-desktop-dead-i18n-keys.mjs` `scan-extension-dead-i18n-keys.mjs` `scan-miniapp-taro-dead-i18n-keys.mjs` `scan-mobile-rn-dead-i18n-keys.mjs` `check-cli-i18n-parity.mjs`
- API/后端/DB: `check-credential-leak-in-message.mjs` `check-credential-presence-bypass.mjs` `check-principal-consumed.mjs` `check-public-exposure-list.mjs` `check-capability-field-not-client-supplied.mjs` `check-authorization-column-isolation.mjs` `check-migration-immutable.mjs` `check-db-blind-updatedat-set.mjs` `check-sequence-lag.mjs` `check-error-code-not-text-matching.mjs` `check-error-attribution-single-source.mjs` `check-error-message-bounded.mjs` `check-inbound-schema-strict.mjs` `check-nested-additional-properties.mjs` `check-enum-default-widening.mjs` `check-enum-fallback-terminal.mjs` `check-txn-cancel-boundary.mjs` `check-dockerfile-copy-paths.mjs` `check-edu-arrears-single-source.mjs` `check-sse-frame-watermark.mjs` `check-python-import-landed.mjs` `check-python-import-resolvable.mjs` `check-mode-permission-matrix.mjs` `check-subagent-permission-inherited.mjs`
- CLI/工具契约: `check-tool-exec-budget.mjs` `check-tool-family-registered.mjs` `check-tool-schema-projection.mjs` `check-file-write-safety.mjs` `check-mention-engine-wired.mjs` `check-slash-command-wired.mjs` `check-lsp-language-table.mjs` `check-doom-loop-parity.mjs` `check-guardian-review-wired.mjs` `check-turn-ordinal-lock.mjs` `check-truncation-accounting.mjs` `check-dispatch-premise.mjs` `check-list-cap-honesty.mjs` `check-compaction-denominator.mjs` `check-load-state-loaded-marks.mjs` `check-load-state-projection-parity.mjs` `check-mobile-api-base-bake.mjs` `check-mobile-version-code.mjs` `check-v3-62-conversation-mount.mjs` `check-ai-panel-mount-guards.mjs` `check-virtualization-coverage.mjs` `check-crash-report-redaction.mjs` `check-diagnostic-redaction.mjs` `check-digest-name-reality.mjs` `check-image-placeholders.mjs` `check-upload-budget.mjs` `check-lock-manifest-consistency.mjs` `check-orphan-deletion-refs.mjs` `check-process-exit-attribution.mjs` `check-wire-strictness.mjs` `check-env-drift.mjs` `check-disk-root-hygiene.mjs` `check-temp-landing.mjs` `check-bypass-landing-scope.mjs` `check-live-doc-references.mjs` `check-percent-clamp-single-source.mjs`
- 常驻工具(非守门,勿因"不在 runner"当没装车): `watermark.mjs` `guardian-runner.mjs` `safe-commit.mjs` `git-guardian.mjs` `git-refs-heal.mjs` `git-backup-refresh.mjs` `heal-worktree-tracked.mjs` `git-sync-converge.mjs` `git-push-converge.mjs` `git-push-guard.mjs` `git-lock.mjs` `deploy-lock.mjs` `union-converge.mjs` `merge-live-doc.mjs` `live-doc-edit.mjs` `object-space-land.mjs` `gate-registry-insert.mjs` `plan-tasks.mjs` `plan-tasks-merge.mjs` `plan-pointer-purge.mjs` `plan-task-index.mjs` `plan-line-age.mjs` `ledger-strip-open-rows.mjs` `archive-completed-tasks.mjs` `bypass-git.mjs` `face-reader.mjs` `code-mask.mjs` `scratch-dir.mjs` `key-dir.mjs` `secret-path.mjs` `seal-c-root-stray.mjs` `scrub-temp-fixtures.mjs` `c-disk-breakdown.mjs` `plan-union-merge.mjs` `run-evidence.mjs` `visible-window-probe.mjs` `install-console-window-hook.mjs` `commit-gate-attribution.mjs` `plan-bypass-ledger-report.mjs` `alert-volume-report.mjs` `provenance-ledger.mjs` `module-context.mjs` `notify-deploy-failure.ts`

<!-- 守门门名索引补漏:以下名称同样受 R4 点名义务覆盖,若上面分组有遗漏以此行兜底: check-adapter-style-parity check-ai-panel-mount-guards check-enum-default-widening check-guardian-review-wired check-load-state-loaded-marks check-sequence-lag check-sse-frame-watermark check-txn-cancel-boundary check-upload-budget check-virtualization-coverage check-dangling-local-imports check-stale-stashes check-grokbuild-integration-completeness -->
