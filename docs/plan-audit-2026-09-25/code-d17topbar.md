<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# D17 生态统一入口 — 顶栏那一半(编码代理交付报告)

批次:WAVE2 / 票:D17 顶栏收敛 / 完成时间:2026-09-25
允许清单内文件:`apps/web/src/components/layout/GlobalTopBar.tsx`、
`apps/web/src/components/layout/__tests__/global-topbar-ecosystem.test.tsx`(**新建**)
清单外文件:**零改动**(词包、nav-data、chat/ai、contract.ts、api-client、活文档一律未碰)

## 1. 改法(几行到几行)

| 位置 | 改前(HEAD) | 改后(工作树) |
| --- | --- | --- |
| `GlobalTopBar.tsx:131-139` | Plus 九宫格第三组 `groupSettings` 里 **5 个并列市场入口**(`skill→/ai-skills`、`mcpStore→/mcp-store`、`capabilityMarket→/capability-market`、`skillsMarket→/skills-market`、`connectors→/connectors`) | **整组摘除**,只留注释占位说明去向(:127-132)。Plus 菜单项 12 → **7** |
| `GlobalTopBar.tsx:135-154` | 无 | 新增 `ECOSYSTEM_MARKETS` 直达表(5 条,href 与聚合页 `ecosystem-hub.tsx` MARKETS 逐条同值)+ `ECOSYSTEM_HUB_HREF='/ecosystem'` |
| `GlobalTopBar.tsx:74-84` | `PlusMenuAction.key` 含 5 个市场键 | 收窄为 7 个键(编译期保证被摘项不再被引用) |
| `GlobalTopBar.tsx:888-1007` | 无 | 新增子组件 **`TopBarEcosystemMenu`**(定义在 :905)+ 共享类 `ECOSYSTEM_MENU_ITEM_CLASS`(:1005) |
| `GlobalTopBar.tsx:700-706` | Plus 之后直接是 chevron | 在 flex 位 **2.5**(Plus 与 chevron 之间)插入 `<TopBarEcosystemMenu />`(:706)—— **这就是那 1 个「生态市场」入口** |
| `GlobalTopBar.tsx:190-200`、`:544-551` | 顶栏 flex 顺序契约两处 | 各补 `2.5 <TopBarEcosystemMenu>` 一行(:196 / :549),注释与实际渲染点对账 |

净变化:`git diff --numstat` = **162 增 / 24 删**(单文件)。

入口形态:36×36 方块(`TOPBAR_BTN_BASE` + `TOPBAR_BTN_W9`,与搜索/Plus/chevron/窗口控制同档同形),
图标 `LayoutGrid`(lucide-react,**与侧栏 `nav-data.ts:417` 那条入口同图标**),
点击展开弹层:**首项 = `/ecosystem` 聚合页**(标签取 `nav.ecosystemHub`),
其下 `ecosystem.marketsSection` 分组标题 + **5 条分组直达**(标签取 `ecosystem.cards.<key>.title`)。

## 2. 装车点(生产消费点 + 用测试证明被消费)

- 消费点:`apps/web/src/components/layout/GlobalTopBar.tsx:706`(`<TopBarEcosystemMenu />` 在顶栏 flex 位 2.5),
  渲染宿主链 = `GlobalShell.tsx:29 import { GlobalTopBar }` → 全站顶栏。
- 证明:测试第 1 例「装车:顶栏渲染 1 个生态市场入口」直接 `render(<GlobalTopBar />)` 后按
  `getByRole('button', { name: /生态市场/ })` 命中 —— 命中者是**顶栏本体**,不是子组件自测。
- 命中清单(`git grep` 口径,含渲染宿主):
  `apps/web/src/components/layout/GlobalTopBar.tsx`(定义 + 渲染)、
  `apps/web/src/components/layout/__tests__/global-topbar-ecosystem.test.tsx`(断言)。

## 3. 老 URL 一律继续可达(三条独立证据)

1. **路由零改动**:`apps/web/app/(main)/{ai-skills,mcp-store,capability-market,skills-market,connectors}/page.tsx`
   五个目录实测在位,未删/未移/未加 redirect 表(本票未触碰 `apps/web/app/**`)。
2. **顶栏直达仍在**:新弹层内 5 条 `<a href>` 逐条断言存在
   (测试第 4 例 `panel.querySelector('a[href="/mcp-store"]')` 等 5 条全绿),
   且实测 `header a[href="/ai-skills"]` 等在**弹层收起态**为 0 —— 并列形态确实收敛掉了。
3. **其他消费点未受影响**:`apps/web/src/lib/command-registry.ts:147/153/159/165/171` 五条 navigate 动作
   仍指向老 URL(Ctrl+Shift+P 命令面板可达);`/ecosystem` 聚合页 5 张卡片(`ecosystem-hub.tsx:16-22`)照旧。
   → 收敛后每个老 URL 至少有 3 条到达路径(聚合页卡片 / 顶栏弹层直达 / 命令面板)。

Plus 菜单摘除不影响既有 e2e:`apps/web/e2e/annotation-flow.spec.ts:189-191` 用的是
「添加视图 → 内置浏览器」,两项均保留。

## 4. 观感 / 约束合规

- 弹层原语 = 与 Plus **同一个** `PortalPanel`(`components/feedback/portal-panel.tsx`):
  portal + 视口 clamp + Esc/外点关闭 + `@/lib/overlay-stack` 层栈(传 `overlayId='global-topbar-ecosystem'`,
  一次 Esc 只关最上层)。**未新建第二套下拉实现**。
- 面板类名与 Plus 同档:`rounded-md border border-border bg-popover p-1 shadow-md`(§4「菜单/选项列表 p-1」),
  `zIndexClassName="z-header"` 与 Plus 同层;无 `rounded-[任意值]`、无数字字面量圆角(守门 77 逐文件绿)。
- 零分割线(分组标题用 `mt-1` 间距 + 低对比文字)、零 `mask-image`、零 `title` 属性、零 `alert/confirm`。
- 图标全为 lucide-react 矢量(`LayoutGrid` + 5 个市场原图标),**无 emoji、无字符箭头 `›»>`**(守门 102 逐文件绿)。
- 文案零硬编码中文、**零新增词包键**;`aria-label` 里的顿号/逗号由 `Intl.ListFormat` 按 locale 产出,不写死标点。
- 无 `any`(新代码 0 处);测试用 `unknown` + 类型守卫解析 JSON。
- 快捷键:新入口**不声明任何键位**,守门 69 输出与改前一致(3 项存疑均为他人既有,非本票文件)。

## 5. 无障碍(可断言项)

- `aria-label` = `生态市场、AI 技能、MCP 商店、能力市场、Skill 市场、中文连接器`(zh-CN 实渲染值,
  由 `Intl.ListFormat('zh-CN',{style:'narrow',type:'conjunction'})` 拼),脱离上下文成立。
- `aria-haspopup="menu"` + `aria-expanded={open}` + `data-state={open?'open':'closed'}`
  (自写 trigger 必挂 data-state,口径同 `scripts/check-popover-trigger-data-state.mjs`)。
- 面板 `role="menu"` + 6 个 `role="menuitem"` 真 `<a href>` → Tab / Enter 原生可达,无焦点陷阱。
- 测试第 2、3 例断言开合三态(aria-expanded / data-state / 面板节点存在),并断言
  Esc 关闭由 `PortalPanel` 统一逻辑生效;第 6 例断言 aria-label **不直出键名**(守门 74 口径)。

## 6. 验证命令与输出末行(原文)

```
$ cd apps/web && node ./node_modules/vitest/vitest.mjs run src/components/layout/__tests__/global-topbar-ecosystem.test.tsx
 Test Files  1 passed (1)
      Tests  8 passed (8)
   Start at  08:27:18
   Duration  10.61s (transform 8.25s, setup 194ms, import 8.85s, tests 345ms, environment 1.03s)

$ pnpm --filter @ihui/web typecheck        # 33 处 error,**全部在他人文件**
   去重后的报错文件清单:src/components/ai/progress-sections/{tool-category.ts,__tests__/tool-call-summary-category.test.tsx,__tests__/tool-category.test.ts}
   src/components/chat/{message-input.tsx,voice-note.tsx} · src/config/desktop-feed-payload.ts
   src/hooks/{use-prompt-drafts.ts,__tests__/use-prompt-drafts.test.tsx}
   区分命令:`pnpm --filter @ihui/web typecheck 2>&1 | grep -i "GlobalTopBar\|global-topbar-ecosystem"` → 0 命中;
             `... | grep "src/components/layout"` → 0 命中  ⇒ 本批两文件命中 0
$ node ../../node_modules/eslint/bin/eslint.js src/components/layout/GlobalTopBar.tsx src/components/layout/__tests__/global-topbar-ecosystem.test.tsx
(无输出)eslint_exit=0

$ node scripts/check-nav-dead-links.mjs
✅ 无死链:全部侧边栏导航均有对应页面            (exit=0)
$ node scripts/check-declared-shortcuts.mjs
【绑了未声明 — 信息】0 项                        (exit=0;3 项"存疑"均为他人既有文件)
$ node scripts/check-no-emoji-icons.mjs
  违规数:   0 处 (BLOCKING)
✅ emoji 图标守门通过
$ node scripts/check-i18n-keys.mjs
[i18n 键检查] 通过,已检查 1568 文件, 17785 键, 5 语言 parity OK
$ node scripts/check-radius-single-source.mjs --files apps/web/src/components/layout/GlobalTopBar.tsx
✅ 圆角单一源头对账通过(违规 0 处 / 新增 0)
$ node scripts/check-glyph-arrow-icon.mjs --files apps/web/src/components/layout/GlobalTopBar.tsx
✅ 无文本箭头字形、无字号倒挂、共享矢量实现在位   (exit=0)
$ node scripts/watermark.mjs verify
[watermark:verify] 覆盖 10574/10574 个已跟踪文件, 残迹(载荷丢失) 0 个, 载荷损坏 0 个, 跳过 0 个
纳入口径的文件均已携带完整溯源水印。
$ node scripts/check-watermark-coverage.mjs --no-fix
[watermark-coverage] ✅ 已跟踪文件水印完整(其余为未跟踪本地产物,不计入)
```

新建测试文件已跑 `node scripts/watermark.mjs inject`(上面 verify 10574/10574 即含它)。

## 7. 运行时验证(浏览器)

**未做浏览器实测取证。** 原因(如实登记,不甩锅给用户):
`netstat` 实测本机 8801/8802 **无监听**(与 AGENTS §5b 2026-09-24 深夜更正一致),
唯一可跑真实渲染的路径是自己起 `next dev`;而 `apps/web` 的 dev 脚本链
(`unlock-dev-preflight` → `clean-turbopack-cache` → `dev-with-warmup`)会**清写 `apps/web/.next`**,
该目录归并行会话的生产构建所有(AGENTS「部署/构建全局锁」段记录过两构建同写 `.next` → 8801 502 的事故)。
多会话共享工作树期间不为取证去动别人的产物目录。
替代取证 = **jsdom 真实渲染 + DOM 属性断言**(8 例,读到的是 `aria-label` / `aria-expanded` /
`data-state` / `role` / `href` 的实渲染值,不是截图),外加第 8 例**直读 `packages/i18n/messages/web/*.json`**
证明本票 7 个取词点在五语真包里逐条可解析(即不会 MISSING_MESSAGE 直出键名)。

## 8. 待补键(本轮词包冻结,交主代理集中 apply)

**不需要新增键即已交付**;以下两项属"补了更好",缺键期已有可用回落形态,**界面不会直出键名**:

1. `ide.topBar.ecosystemHub`(或 `nav.ecosystemHub` 复用)—— 现直接用既有 `nav.ecosystemHub`
   (zh-CN「生态市场」/ en "Ecosystem Market" / ja「エコシステムマーケット」/ ko「생태 마켓」/ zh-TW「生態市場」),
   侧栏 D17 那条入口用的是同一个键,**无需新增**。仅当产品要给顶栏入口换个区别于侧栏的说法时才需要新键。
2. `ide.topBar.ecosystemAria`(aria-label 模板,例:zh-CN `生态市场:{markets}`)——
   现在是代码里 `Intl.ListFormat` 拼装(零新键)。补模板键的收益 = 可控制措辞与"入口/直达"等字样;
   若要补,建议形态 `{hub, markets}` 双占位,五语对照:
   zh-CN `生态市场:{markets}` / zh-TW `生態市場:{markets}` / en `Ecosystem Market: {markets}` /
   ja `エコシステムマーケット:{markets}` / ko `생태 마켓:{markets}`。

**反向遗留(需主代理排期,不属本票文件集)**:`ide.topBar.{skill,mcpStore,capabilityMarket,skillsMarket,connectors}`
5 个键自本改动起**全仓零引用**(`git grep` 实测零命中,含 `apps/web`+`packages`),
其中 `ide.topBar.skill` 是原 `skill` 项专用。是否删除属词包轮动作(可能牵动 web 死 key 审计门与 miniapp 离线包),
**本轮一律未删**。

## 9. 未做完 / 风险登记

- 5 个市场 href↔图标↔键 的映射表在 `ecosystem-hub.tsx`(私有 `MARKETS`)与本文件(`ECOSYSTEM_MARKETS`)**两份**。
  根治 = 把表提到 `packages/shared`(或 web 内 `src/lib/ecosystem-markets.ts`)由两端共读,
  但那两个文件不在本票允许清单内(`ecosystem-hub.tsx` 未列入只读参考可改范围),**未动**,留给下一轮。
  现状风险:新增第 6 个市场时可能只改一处(已在本文件注释里点名对账要求作为缓解)。
- 侧栏 `nav-data.ts` 只读未动(其 D17 那条 `/ecosystem` 入口已入库)。
- 本票只做 web 端顶栏(AGENTS §9 平台独占:web 顶栏/Plus 弹层为 web 形态,其余端无此组件)。
- 未 commit、未 push(按 RULES:git 写操作归主代理 `safe-commit.mjs`)。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
