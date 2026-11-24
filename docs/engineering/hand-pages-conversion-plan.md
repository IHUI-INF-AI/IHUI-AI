<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# 小程序端 80 枚手写镜像页「到底缺什么」判定与派单清单

- 生成面：`HEAD`（`git rev-parse HEAD` = `cdb48604ac70`），只读，未改任何源码。
- 输入真相源：`scripts/check-miniapp-mirror-fidelity.mjs`（形制判定）、`scripts/plan-hand-mirror-conversion.mjs`（端内独有符号榜）、`packages/types` + 屏内 `export interface *ScreenProps`（props 腿）、`scripts/data/cross-end-screen-registry.json`（登记表）。
- 机读产物：`D:/IHUI-AI/.worktrees/xend2/scripts/data/hand-pages-conversion-plan.json`（80 条，逐条 `{route,spec,kind,taroApis,hooks,lines,reason}`）。

## 0. 结论（先看这 6 行）

| 事实 | 数值 | 复算方式 |
|---|---|---|
| 镜像对总数 / 壳承载 / 手写 | 219 / 139 / 80 | `node scripts/check-miniapp-mirror-fidelity.mjs --quiet` |
| 80 行里真实路由数 | 77（`pages/circle/detail`、`pages/member/integral`、`pages/member/benefits` 各占 2 行） | §6 表：#20/#53、#51/#75、#70/#74 |
| 可收敛到共享屏 | **69 行 = 86.3%**（A 50 + B 19） | §1 |
| 端内独有、不应共享 | 5 行 = 6.3% | §3-C |
| 账面不成立、先修账本 | 6 行 = 7.5% | §3-D |
| 端内实现总行数 | 25 970 行（A 档 12 878 / B 档 7 765 / C 档 3 949 / D 档 1 378） | §1 |

一句话：**这 80 页缺的不是「Taro API 兼容层」，而是四类不同的东西**——50 页缺的只是「把页面换成壳」（共享屏与 RN 壳都已在位）；19 页缺的是「共享屏本身的内容面」（屏只有端内页的 6%~59%）；5 页是微信宿主私域能力（截屏/订阅/授权/小程序码/广场），本来就不该共享；剩 6 页是账本自己错了（css 残留路径被当成镜像声明、登记表 rn 腿错绑），先把账本修对再谈转壳。

## 1. 分档统计表

| 档位 | 屏数 | 占比 | 端内行数 | 行数占比 | 判据一句话 |
|---|---|---|---|---|---|
| `A_thin` 现有共享屏 + 薄壳 | 50 | 62.5% | 12 878 | 49.6% | 共享屏规模 ≥ 端内页 60% 或键差 < 10；50 条里 45 条端内符号全是取数/跳转/提示类，5 条含宿主 API（须注入回调腿） |
| `B_new_screen` 需新建/实质补全共享屏 | 19 | 23.8% | 7 765 | 29.9% | 共享屏行数 < 端内页 60%，且端内页有 ≥10 个业务文案键在共享屏无对应 |
| `C_miniapp_only` 端内独有 | 5 | 6.3% | 3 949 | 15.2% | 命中微信宿主私域 API，且共享屏 props 无对应回调腿 |
| `D_undetermined` 未判定 | 6 | 7.5% | 1 378 | 5.3% | 账面 pair 由 css 残留路径生成 / RN 壳不消费共享屏 ⇒ 依赖链不明 |
| 合计 | 80 | 100% | 25 970 | 100% | — |

## 2. 判据（可复现，不猜）

### 2.1 三个测量量

1. **规模比** `sl/pl`：共享屏行数 ÷ 端内页行数。共享屏是骨架时该比值明显 < 100%（实测 privacy 6%、agent-detail 23%、agent 53%）。
2. **键级差集** `extra = 端内业务键 − 共享屏业务键`，同时算 **重叠数** `overlap`。键集口径直接复用门的 `businessKeys(consumedKeys(text))`（与 `check-miniapp-mirror-fidelity.mjs` 同一把尺子，零复制）。
3. **端内独有符号**：`scripts/plan-hand-mirror-conversion.mjs` 的相对取差（页面用的 `Taro.X` / `useXxx` / `@/` 模块在「共享屏 ∪ 承载壳」里一个都不出现 ⇒ 记为端内独有）。实测 80 页里 `可转=0`、`带私有能力=79`、`壳不渲染=1`。

### 2.2 四档定义（本报告实际执行的规则）

- **A_thin**：`sl ≥ 0.6×pl` 或不满足 B 的键差阈值 ⇒ 共享屏已具备该页内容面与交互腿，端内页剩余代码只是「取数 + 跳转 + toast + 下拉/触底」；转壳动作 = 页面改渲染 `<XxxScreen/>`（约 20 行）+ 保留 `index.config.ts` + 分享/导航钩子（`useShareAppMessage` 等 3~5 行）。分 A1（可直接转）与 A2（需先修登记表，见 §3-A）。**A 档内部再按端内符号分两类**：45 条只含取数/跳转/提示/常量/组件（薄壳直接承接）；5 条含宿主 API（`pkg-user/user/profile` 的 `Taro.chooseImage`、`pkg-ai/aigc/publish` 的 `chooseImage+getFileSystemManager`、`pkg-ai/aigc/list` 的 `createInnerAudioContext`、`pkg-ai/ai/conversation-import` 的 `chooseMessageFile`、`pages/circle/create` 的 `eventCenter`），转壳时必须由端内薄壳注入到共享屏既有回调腿，验收逐条核对（机读产物的 `reason` 里已逐条标明是「宿主 API」还是「纯取数/跳转」）。
- **B_new_screen**：`sl < 0.6×pl` 且 `extra ≥ 10` ⇒ 共享屏承载不住端内页的内容面。再分两形态：`sl/pl < 30%` 记 **B1 重写/新建**（共享屏实为占位），否则 **B2 补全**（共享屏有骨架、缺正文与交互腿）。
- **C_miniapp_only**：页面主路径依赖微信宿主能力（支付收银台 / 小程序码 / 聊天文件选择 / 截屏监听 / 订阅消息 / 授权 scope / 分享广场），且**共享屏 props 里没有可注入的回调腿**——即薄壳无处接。
- **D_undetermined**：这条 pair 本身不成立（正文无该屏声明、仅 css 残留路径命中，或 RN 端无人渲染该共享屏）⇒ 不能判 A/B/C，须先修账本。**每条都写了具体原因，没有一条是"读不懂"。**

### 2.3 手工改判清单（规则命中但与事实冲突的，全部列在此）

| route | 规则初判 | 改判 | 事实依据 |
|---|---|---|---|
| `pkg-shop/order/detail` | B（105/191） | **A2** | 真壳 `apps/mobile-rn/src/screens/OrderDetailScreen.tsx:13` 已 `import { OrderDetailScreen as SharedOrderDetailScreen }`，登记表却绑到 `CartScreen.tsx`（那里只有 `:9`、`:131` 两处注释） |
| `pkg-ai/ranking/index` | B（235/245） | **A2** | 真壳 `RankingScreen.tsx:11` 已 import `SharedRankingScreen`；登记表绑到 `RankingDetailScreen.tsx`（仅 `:10` 注释提到） |
| `pkg-user/user/profile` | B（215/216） | **A** | 共享屏 `ProfileScreen` 的全部业务腿都是可选（`user?/stats?/orderCount?/menuSections?`），必填只有 `t`+`onBack` |
| `pkg-ai/ai-group/index` | B（424/241，extra 46） | **A** | 46 个「多出键」实为命名空间差异（页面用 `ai.agentList.*`，共享屏 424 行已含分类/搜索/会话列表），键重叠仅 2/48 |
| `pkg-ai/ai-assistant-n8n/index` | A（403/165） | **D** | RN 壳 2481 行自建流式会话，`@ihui/rn-app` 全文件只出现在 `:30` 注释，未 import 共享屏 ⇒ 共享屏 403 行两端都无人渲染 |

### 2.4 量具已知缺陷（会污染后续批次验收，必须先知道）

1. **css 残留路径被当成镜像声明**：`MARK_RE` 在 `text + cssText` 上匹配（`check-cross-end-screen-coverage.mjs:226-230`），实测 5 条 hand 行来自 `.css` 里的历史路径而非正文声明：
   - `pages/member/coupon.css` → `vip/VipScreen`（页面正文只声明 `coupon/CouponScreen`，且已直载该共享屏）
   - `pages/member/coupon-list.css` → `vip/VipScreen`（页面 134 行**无任何声明**）
   - `pages/member/integral.css` / `pages/member/benefits.css` → `vip/VipScreen`
   - `pages/circle/detail.css` → `post-detail/PostDetailScreen`
   ⇒ 这 5 行不是 hand，是**账本假对**。
2. **登记表 rn 腿错绑**：`rnConsumes()` 是「符号名出现 + `@ihui/rn-app` 出现」的宽松判据（`check-cross-end-screen-coverage.mjs:235-240`），只出现在注释里也判 OK。实测 4 条：`order/detail→CartScreen.tsx`、`ranking→RankingDetailScreen.tsx`、`dev-space→DevEnterCoverScreen.tsx`、`vip→AppTopupScreen.tsx`。
3. **键级差集会放大命名差异**：`pages/setting/index.tsx` 用 `setting.*`、共享屏 `SettingsScreen` 用 `settings.*`，19 个键**重叠 0**；`pkg-shop/order/refund.tsx` 用 `order.refund.*`、共享屏用 `orderRefund.*`，25 个键重叠 0。故 B 档以**行数比**为主锚、键差作佐证；A 档中 `extra ≥ 10` 的行在机读产物里已逐条追加「重叠 N（命名空间差异）」。
4. **`allPropsOf` 在主仓不存在**：`git show HEAD:scripts/lib/cross-end-screen-props.mjs | grep -c allPropsOf` = `0`（主仓该文件仅 130 行，只导出 `requiredPropsOf`）；`.worktrees/xend2/scripts/lib/cross-end-screen-props.mjs:137` 有实现，但其 `ROOT` 指向 worktree，实测调用返回 `undetermined: 该文件不在 RN 编译面里`。本报告的「全部 props」是用同一份 `apps/mobile-rn/tsconfig.json` 编译面 + 同一 checker 现算的（命令见 §7-⑤）。

## 3. 每档代表性条目（附路径 + 行号证据）

### 3-A `A_thin`（50 条，列 7 条）

| route | 端内页 | 共享屏 | 证据 | 动作 |
|---|---|---|---|---|
| `pkg-shop/cart/index` | `apps/miniapp-taro/src/pkg-shop/cart/index.tsx` 230 行 | `cart/CartScreen.tsx` 205 行 | 门的实测为 **缺 0/6 键**；端内独有符号只有 `@/api`、`Taro.showToast`、`useDidShow`；RN 壳 `CartScreen.tsx` 218 行已实现取数+微信 App 支付 | A1 直转 |
| `pkg-about/about/index` | `pkg-about/about/index.tsx` 241 行 | `about/AboutScreen.tsx` 217 行 | 缺 1/15 键；`AboutScreen` 必填腿仅 `t`+`onBack`（`reusable`） | A1 直转 |
| `pkg-content/search/index` | `pkg-content/search/index.tsx` 283 行 | `search/SearchScreen.tsx` 154 行 | 缺 **0/3** 键；独有符号 `Taro.navigateBack/navigateTo/switchTab` | A1 直转 |
| `pkg-content/topic/detail` | `pkg-content/topic/detail.tsx` 292 行 | `topic-detail/TopicDetailScreen.tsx` 224 行 | 缺 **0/10** 键；`useShareAppMessage/useShareTimeline`（3 行分享卡，可留在页里） | A1 直转 |
| `pages/exam/wrong-list/index` | `pages/exam/wrong-list/index.tsx` 191 行 | `wrong-questions/WrongQuestionsScreen.tsx` 395 行 | 共享屏比端内页**大一倍**（395 vs 191），端内只缺 2/14 键 ⇒ 端内页是共享屏的子集 | A1 直转 |
| `pkg-shop/token/balance` | `pkg-shop/token/balance.tsx` 249 行 | `token-value/TokenValueScreen.tsx` 300 行 | 真壳 `apps/mobile-rn/src/screens/TokenValueScreen.tsx:19` 已 `import { TokenValueScreen as SharedTokenValueScreen }`；但**登记表无条目**、端内正文无镜像标记（pair 仅来自 css 残留） | A2：补标记 + 补登记行 |
| `pkg-ai/dev-space/index` | `pkg-ai/dev-space/index.tsx` 207 行 | `developer/DeveloperScreen.tsx` 219 行 | 真壳 `DeveloperScreen.tsx:12` 已 import；登记表绑到 `DevEnterCoverScreen.tsx`（仅 `:11` 注释） | A2：改登记表 rn 腿 |

> A2 共 4 条：`order/detail`、`ranking`、`dev-space`、`token/balance`（后两条连"登记行/镜像标记"都缺）。另有两个共享屏同样卡在登记表，但它们本身进 B 档：`n8n-model`（登记表无条目）、`vip`（登记表 rn 腿错绑到 `AppTopupScreen.tsx`，真壳是 `VipScreen.tsx:30`）。A1 共 46 条，可直接排批落地。

### 3-B `B_new_screen`（19 条，列 6 条）

| route | 端内页 | 共享屏 | 差在哪（实测） |
|---|---|---|---|
| `pkg-about/about/privacy` | 591 行 | `privacy/PrivacyScreen.tsx` **34 行** | 共享屏是 3 段 `LegalDocScreen` 配置（`sections` 只有 data/cookie/thirdParty 三节），端内页有 **125 个** `about.privacy.*` 键（完整隐私政策正文）⇒ 共享屏实为占位，须重写 |
| `pkg-ai/ai/agent-detail` | 625 行 | `agent-detail/AgentDetailScreen.tsx` **146 行**（23%） | 端内 56 个业务键共享屏一个都没有（`ai.agentList.categories.*`、`aiAgent.d1..d5`、`messageInput.document`）；端内数据腿 `agent`/`permission`/`permLoading`/`tab`/`related`/`favorited`（`useState` 实测），共享屏 props 只有 `item/loading/error/onBack/onStartChat?/onEdit?` |
| `pkg-shop/vip/index` | 538 行 | `vip/VipScreen.tsx` 249 行（46%） | 56 个键无对应（`vip.plan.monthly/quarterly/yearly` 等套餐档位）；端内状态 `priceOptions`/`selectedPlan`/`autoRenew`/`payMethod`/`signRecurringContract` 都不在 props 腿里 |
| `pages/member/index` | 448 行 | `vip/VipScreen.tsx` 249 行 | 57 个键无对应（`member.benefit.*` 权益墙、`member.level.*` 四级会员）；端内状态 `info/profile/benefits/memberInfo` |
| `pkg-user/message/index` | 510 行 | `message-center/MessageCenterScreen.tsx` 288 行 | 33 个键无对应（`message.tabs.all/system/interaction/private`、`message.notifLabels/Descs.*`）；端内 510 行含系统通知/互动/私信三分类 |
| `pkg-ai/dev-enter/n8n-model/index` | 571 行 | `n8n-model/N8nModelScreen.tsx` 310 行 | 45 个键无对应；端内状态含 `n8nFileName/n8nFileData/inputParams/outputParams`（文件上传 + 参数表单），共享屏 props 无文件腿；且登记表**无条目**、正文无标记（pair 仅来自 css 残留） |

> 另 13 条：`agent`(577/307)、`news/list`(279/148)、`ask/create`(358/146)、`circle/create`(403/135)、`circle/detail`(387/171)、`exam/result`(288/157)、`help`(247/112)、`icp-record`(106/60)、`realname`(290/152)、`developer/income`(653/383)、`ranking/detail`(349/123)、`order/refund-list`(291/117)、`vip/details`(254/123)。

### 3-C `C_miniapp_only`（5 条，**全列**）

| route | 端内页 | 端内独有能力（行号） | 为什么不能共享 |
|---|---|---|---|
| `pages/share/index` | 914 行 | `Taro.eventCenter.trigger('trigger-nav-click')`（`share/index.tsx:377`、`:485`）联动端内自定义 tabBar；页面是「分享广场」（列表+历史+入口） | 共享屏 `ShareScreen` 仅 169 行单次分享表单（`onCreate/onShare/onRemarkChange`），无广场/历史/入口腿；把 914 行压成 169 行 = 能力损失 |
| `pages/distribution/index` | 415 行 | `api.getWxCode`（`:72`）取小程序码；`@/utils/save-album:14` → `saveImageToPhotosAlbum`（`:92`） | 小程序码（wxacode）是微信宿主产物，RN 无对应 API；共享屏只有 `info/onWithdraw/onRefresh` |
| `pkg-ai/ai/chat` | 2246 行 | `Taro.onUserCaptureScreen/offUserCaptureScreen`（`chat.tsx:678`，命中即 toast `ai.screenshotHint`）+ `Taro.request` 流式会话（2246 行内 14 个 Taro API） | 共享屏 `ChatScreen` 314 行只有展示腿（`messages/onSend/onStop`），RN 壳 4409 行另有独立流式实现；端内主路径是「宿主截屏 + SSE」 |
| `pkg-about/about/app-permission/index` | 174 行 | 授权 scope 清单（`scope.writePhotosAlbum/camera/record/userLocation/notification`，`:48-53`）+ `Taro.getSetting`（`:66`）+ `Taro.openSetting` | 授权 scope 是微信宿主私域；共享屏 `AppPermissionScreen` 122 行只有静态说明卡 |
| `pages/setting/notification` | 200 行 | `requestPushSubscription`（`notification.tsx:8` 引 `@/utils/push-init`，`:87-93` 处理结果） | 微信订阅消息需模板 ID + 用户逐条授权（`push-init.ts` 头注），RN 侧无此机制；共享屏只有开关列表 |

### 3-D `D_undetermined`（6 条，**全列**）

| route | spec | 具体原因（不猜，只说读到了什么） |
|---|---|---|
| `pkg-ai/ai-assistant-n8n/index` | `ai-assistant-n8n/AiAssistantN8nScreen.tsx` 403 行 | 共享屏**两端都无人渲染**：RN 壳 `AiAssistantN8nScreen.tsx` 2481 行自建流式会话，`@ihui/rn-app` 全文件只在 `:30` 注释出现；端内页 165 行也自写。转壳前须先定「哪一端是这一屏的真相源」 |
| `pages/circle/detail` | `post-detail/PostDetailScreen.tsx` | 页面正文只声明 `circle-detail/CircleDetailScreen`（`circle/detail.tsx:5`）；这条来自 `pages/circle/detail.css` 残留路径被 `MARK_RE` 命中。页面 387 行是圈子详情（`circle.detail.*` 12 键），不是帖子详情 |
| `pages/member/integral` | `vip/VipScreen.tsx` | 正文只声明 `point-history/PointHistoryScreen`（`member/integral.tsx:4`）；这条来自 `member/integral.css` 残留。页面 174 行是积分明细（`member.integral.*` 5 键） |
| `pages/member/benefits` | `vip/VipScreen.tsx` | 正文只声明 `vip-benefit/VipBenefitScreen`（`member/benefits.tsx:5`）；这条来自 `member/benefits.css` 残留。页面 408 行是权益目录（`member.benefits.*` 4 键） |
| `pages/member/coupon` | `vip/VipScreen.tsx` | 页面已**直载** `@ihui/rn-app/features/coupon/CouponScreen`（`member/coupon.tsx:23`，109 行薄页）；这条来自 `member/coupon.css` 残留 ⇒ 该行 12 键缺口全属假账面 |
| `pages/member/coupon-list` | `vip/VipScreen.tsx` | 页面 134 行**无任何镜像声明**（正文零 `packages/app/src/features` 命中），pair 只来自 `member/coupon-list.css` 残留；真实归属应为 coupon 域 |

## 4. B 档需要新建/补全的共享屏清单（按域聚合）

「覆盖页数」= 这一次改共享屏能同时消掉几枚 hand 页；「RN 复用」= RN 端同名壳是否已在渲染该屏（是 ⇒ 一次改动两端同时受益，无需再改 RN）。

| # | 域 | 共享屏（建议动作） | 形态 | 覆盖 hand 页 | 需补的 props 腿（证据：端内 `useState`/调用） | RN 复用 |
|---|---|---|---|---|---|---|
| B1 | VIP/会员 | `vip/VipScreen.tsx` **补全**（249→约 450 行） | B2 | **2**：`pkg-shop/vip/index`、`pages/member/index` | `priceOptions`、`selectedPlan`、`autoRenew`、`payMethod`、`benefits[]`、`levels[]`、`onSelectPlan`、`onToggleAutoRenew`、`onPay`（`signRecurringContract`/`upgradeVip`） | 是（`VipScreen.tsx:30`） |
| B2 | VIP/会员 | `vip-compare/VipCompareScreen.tsx` **补全** | B2 | 1：`pkg-shop/vip/details` | `rows` 由 5 行扩到 34 个 `vip.details.features.*`（chatCount/drawCount/videoDuration/modelAccess/prioritySupport/exclusiveGroup） | 是（`VipCompareScreen.tsx`） |
| B3 | 法务/帮助 | `privacy/PrivacyScreen.tsx` **重写**（34→约 500 行，正文内化） | B1 | 1：`pkg-about/about/privacy` | 无需新腿（静态 sections 扩大到 125 键）；建议把正文数据放 `privacy/privacysections.ts` | 是（23 行壳，`PrivacyScreen.tsx`） |
| B4 | 法务/帮助 | `help/HelpScreen.tsx` **补全**（FAQ 列表 + 反馈表单） | B2 | 1：`pkg-about/about/help` | `feedbackForm`、`feedbackState`、`onSubmitFeedback`（端内 `getHelp`/`submitFeedback`） | 是（`HelpScreen.tsx:75`） |
| B5 | 法务/帮助 | `icp-record/IcpRecordScreen.tsx` **重写**（60 行硬编码 1 张卡 → 备案信息组） | B1 | 1：`pkg-about/about/icp-record/index` | `records[]`（`aboutIcprecord.p1/r1/r2` 等 15 键） | 是（28 行壳） |
| B6 | AI Agent | `agent-detail/AgentDetailScreen.tsx` **补全**（146→约 550 行） | B1 | 1：`pkg-ai/ai/agent-detail` | `agent`、`permission`、`permLoading`、`tab`、`related`、`favorited`、`onToggleFavorite` | 是（58 行壳） |
| B7 | AI Agent | `agent-screen/AgentScreen.tsx` **补全** | B2 | 1：`pkg-ai/ai/agent` | `keyword`、`activeType`、`activeCategory`、`sortKey`、`favoriteIds`、`recentIds`、`showConfig`（60 键差集） | 是（974 行壳） |
| B8 | AI Agent | `n8n-model/N8nModelScreen.tsx` **补全** + 登记表补行 | B2 | 1：`pkg-ai/dev-enter/n8n-model/index` | `n8nFile`、`inputParams`、`outputParams`、`avatar`、`description`、`onPickFile`（端内 `chooseMessageFile` 留端内） | 是（`N8nModelScreen.tsx:20`） |
| B9 | AI Agent | `model-income/ModelIncomeScreen.tsx` **补全** | B2 | 1：`pkg-ai/developer/income` | `summary`、`showWithdrawModal`、`onOpenWithdraw`、`onConfirmWithdraw`、`activeTab` | 是（117 行壳） |
| B10 | AI Agent | `ranking-detail/RankingDetailScreen.tsx` **补全** | B2 | 1：`pkg-ai/ranking/detail` | `detail`、`history`、`drawerVisible`、`onSelectConversation`、`onDeleteConversation`、`onClaimFree` | 是（214 行壳） |
| B11 | 社区/内容 | `ask-create/AskCreateScreen.tsx` **补全** | B2 | 1：`pages/ask/create` | `form`、`showCategorySheet`、`onPickCategory`、`onSubmit`（`createAsk`） | 是（68 行壳） |
| B12 | 社区/内容 | `circle-create/CircleCreateScreen.tsx` **补全** | B1 | 1：`pages/circle/create` | `hotTopics`、`aigcWorks`、`aigcOpen`、`form`、`onToggleAigc` | 是（71 行壳） |
| B13 | 社区/内容 | `circle-detail/CircleDetailScreen.tsx` **补全** | B2 | 1：`pages/circle/detail` | `comments`、`onShare`、`onSendComment`、`followBusy` | 是（151 行壳） |
| B14 | 社区/内容 | `article-list/ArticleListScreen.tsx` **补全** | B2 | 1：`pkg-content/news/list` | `categories`、`activeCategory`、`onSelectCategory`（`news.cat.*` 14 键） | 是（61 行壳） |
| B15 | 账号/身份 | `identity-verify/IdentityVerifyScreen.tsx` **补全** | B2 | 1：`pkg-user/user/realname` | `frontPhoto`、`backPhoto`、`frontUploading`、`backUploading`、`status`、`rejectReason`、`authedName`、`authedId` | 是（84 行壳） |
| B16 | 账号/身份 | `message-center/MessageCenterScreen.tsx` **补全** | B2 | 1：`pkg-user/message/index` | `activeTab`(all/system/interaction/private)、`conversations`、`onTogglePin`、`onPressConversation` | 是（230 行壳） |
| B17 | 交易/售后 | `refund-history/RefundHistoryScreen.tsx` **补全** | B1 | 1：`pkg-shop/order/refund-list` | `activeTab`、`expandedId`、`hasMore`、`onExpand`（4 个 tab × 3 状态文案） | 是（118 行壳） |
| B18 | 学习/考试 | `exam-result/ExamResultScreen.tsx` **补全** | B2 | 1：`pages/exam/result` | `correct`、`wrong`、`score`、`onShare`（28 键） | 是（56 行壳） |

合计：**18 个共享屏动作覆盖 19 枚 hand 页**，其中 `VipScreen` 一个动作覆盖 2 枚；B1/B3/B5/B6/B12/B17 属「共享屏是占位」型，工作量按重写估。

## 5. 建议派单批次（按「一次共享屏改动能让两端同时受益」的性价比排序）

| 批次 | 内容 | 条目数 | 为什么排这个位置 | 验收命令 |
|---|---|---|---|---|
| **P0 先修账本** | 删 5 处 css 残留路径（`pages/circle/detail.css`、`pages/member/{coupon,coupon-list,integral,benefits}.css`）+ 修 4 处登记表 rn 腿（`order/detail`→`OrderDetailScreen.tsx`、`ranking`→`RankingScreen.tsx`、`dev-space`→`DeveloperScreen.tsx`、`vip`→`VipScreen.tsx`）+ 补 2 条登记行（`n8n-model`、`token/balance`） | 11 处 | 不修则后面每批的验收都被假 pair 干扰：`hand` 计数会从 80 落到 75，缺口账本也少记 5 条假账 | `node scripts/check-miniapp-mirror-fidelity.mjs --quiet`（pairs/hand 计数变化）+ `node scripts/check-cross-end-screen-coverage.mjs` |
| **P1 A1 直转（46 条）** | 按域分 4 小批（商家/交易、内容/社区、学习/直播、账号/设置），每页 ≈20 行 | 46 | 共享屏与 RN 壳都已在位，单页改动最小；合计可删约 11 000 行端内重复实现 | `node scripts/upgrade-miniapp-shell-pages.mjs`（预演应出现可落地行）+ `node scripts/check-miniapp-mirror-fidelity.mjs --quiet`（hand 应下降） |
| **P2 A2 声明补齐（4 条 A 档 + 2 条随 B 档）** | `order/detail`、`ranking`、`dev-space`、`token/balance`（4 条登记/标记修好后即可转）；`vip`、`n8n-model` 随 P3/P6 一起 | 6 | 前置条件已在 P0 完成，纯转壳动作 | 同上 |
| **P3 VIP 域（3 条 / 2 个屏）** | `VipScreen` 补全（覆盖 `pkg-shop/vip/index` + `pages/member/index`）→ `VipCompareScreen` 补全（`vip/details`） | 3 | **唯一一个「一次改动覆盖 2 页」的屏**，且 VIP 是三端流量入口；RN 壳已消费 ⇒ 两端同时受益 | `node scripts/upgrade-miniapp-shell-pages.mjs --json`（该批转为可落地）+ `node scripts/check-miniapp-mirror-fidelity.mjs --quiet` |
| **P4 内容/社区域（4 条）** | `ask-create`、`circle-create`、`circle-detail`、`article-list` 各补全 | 4 | 四屏规模都在 120~180 行，补全工作量中等；帖子/圈子是端内高频 | — |
| **P5 法务/帮助域（3 条）** | `privacy` 重写（591 行正文内化）、`help` 补反馈表单、`icp-record` 补备案信息组 | 3 | 静态内容为主、无取数，风险最低但 privacy 体量最大，独立一批避免拖住 P4 | — |
| **P6 账号/AI/交易/考试（7 条）** | `identity-verify`、`message-center`、`n8n-model`、`model-income`、`ranking-detail`、`refund-history`、`exam-result` | 7 | 逐个单页收益，按域拆给不同人并行 | — |

> 派单粒度说明：P1 每页是一张可独立验收的票（改一个 `index.tsx` + 跑两条命令）；P3~P6 每屏一张票（改一个 `packages/app/src/features/**/XxxScreen.tsx` + props 类型 + RN 壳传参 + 小程序页转壳）。P1 里 5 条含宿主 API 的页（`profile`/`aigc-publish`/`aigc-list`/`conversation-import`/`circle-create`）验收时必须逐条确认「薄壳把宿主 API 注入到了共享屏的哪个回调腿」，没有对应腿就当场改成 B 档补腿，不许静默丢能力。

## 6. 全量 80 条清单（机读同源）

「页/屏行数」= 端内页行数 / 共享屏行数；「端内多出键」= 端内业务键 − 共享屏业务键；「键重叠」= 交集/端内总键数。

| # | route | kind | 页/屏行数 | 端内多出键 | 键重叠 |
|---|---|---|---|---|---|
| 1 | pkg-about/about/index | A_thin | 241/217 | 3 | 14/17 |
| 2 | pkg-ai/ai/agent-detail | B_new_screen | 625/146 | 56 | 0/56 |
| 3 | pkg-ai/ai/agent | B_new_screen | 577/307 | 60 | 0/60 |
| 4 | pkg-ai/ai-assistant-n8n/index | D_undetermined | 165/403 | 10 | 0/10 |
| 5 | pkg-ai/ai-assistant/index | A_thin | 423/257 | 27 | 0/27 |
| 6 | pkg-ai/aigc/list | A_thin | 419/287 | 10 | 5/15 |
| 7 | pkg-ai/aigc/publish | A_thin | 265/363 | 19 | 0/19 |
| 8 | pkg-ai/ai-group/index | A_thin | 241/424 | 46 | 2/48 |
| 9 | pkg-about/about/api-settings/index | A_thin | 279/274 | 22 | 0/22 |
| 10 | pkg-about/about/app-permission/index | C_miniapp_only | 174/122 | 12 | 0/12 |
| 11 | pkg-content/news/detail | A_thin | 241/107 | 8 | 0/8 |
| 12 | pkg-content/news/list | B_new_screen | 279/148 | 14 | 0/14 |
| 13 | pages/ask/create | B_new_screen | 358/146 | 27 | 0/27 |
| 14 | pages/ask/detail | A_thin | 153/130 | 6 | 0/6 |
| 15 | pages/ask/list | A_thin | 140/120 | 6 | 0/6 |
| 16 | pkg-shop/cart/index | A_thin | 230/205 | 6 | 6/12 |
| 17 | pkg-user/user/password | A_thin | 180/192 | 16 | 0/16 |
| 18 | pkg-ai/ai/chat | C_miniapp_only | 2246/314 | 54 | 0/54 |
| 19 | pages/circle/create | B_new_screen | 403/135 | 15 | 0/15 |
| 20 | pages/circle/detail | B_new_screen | 387/171 | 12 | 0/12 |
| 21 | pkg-ai/ai/conversation-import | A_thin | 409/673 | 6 | 11/17 |
| 22 | pkg-learn/course/detail | A_thin | 348/210 | 24 | 0/24 |
| 23 | pkg-learn/course/list | A_thin | 184/622 | 7 | 0/7 |
| 24 | pkg-ai/dev-space/index | A_thin | 207/219 | 5 | 4/9 |
| 25 | pages/distribution/index | C_miniapp_only | 415/250 | 32 | 0/32 |
| 26 | pages/distribution/plan/index | A_thin | 122/228 | 14 | 0/14 |
| 27 | pages/exam/answer | A_thin | 290/184 | 5 | 0/5 |
| 28 | pages/exam/result | B_new_screen | 288/157 | 28 | 0/28 |
| 29 | pkg-user/favorites/index | A_thin | 351/244 | 18 | 0/18 |
| 30 | pkg-user/following/index | A_thin | 243/224 | 15 | 0/15 |
| 31 | pkg-about/about/help | B_new_screen | 247/112 | 18 | 0/18 |
| 32 | pkg-about/about/icp-record/index | B_new_screen | 106/60 | 15 | 0/15 |
| 33 | pkg-user/user/realname | B_new_screen | 290/152 | 26 | 0/26 |
| 34 | pkg-shop/wallet/commission/index | A_thin | 164/339 | 8 | 0/8 |
| 35 | pkg-learn/learn-develop/index | A_thin | 238/182 | 12 | 1/13 |
| 36 | pkg-learn/teacher/detail | A_thin | 344/652 | 9 | 17/26 |
| 37 | pkg-learn/live/detail | A_thin | 210/360 | 14 | 0/14 |
| 38 | pkg-learn/live/host/index | A_thin | 284/328 | 20 | 8/28 |
| 39 | pkg-learn/live/list | A_thin | 215/186 | 7 | 0/7 |
| 40 | pkg-learn/live/history | A_thin | 207/120 | 8 | 0/8 |
| 41 | pkg-user/message/index | B_new_screen | 510/288 | 33 | 0/33 |
| 42 | pkg-ai/dev-enter/model-edit/index | A_thin | 397/353 | 45 | 0/45 |
| 43 | pkg-ai/developer/income | B_new_screen | 653/383 | 31 | 0/31 |
| 44 | pkg-ai/model-plaza/index | A_thin | 356/441 | 16 | 2/18 |
| 45 | pkg-ai/dev-enter/n8n-model/index | B_new_screen | 571/310 | 45 | 0/45 |
| 46 | pages/setting/notification | C_miniapp_only | 200/148 | 12 | 0/12 |
| 47 | pkg-shop/order/detail | A_thin | 191/105 | 13 | 0/13 |
| 48 | pkg-shop/order/refund | A_thin | 237/282 | 25 | 0/25 |
| 49 | pkg-shop/order/list | A_thin | 379/288 | 10 | 0/10 |
| 50 | pkg-shop/pay/result/index | A_thin | 204/246 | 4 | 0/4 |
| 51 | pages/member/integral | A_thin | 174/134 | 5 | 0/5 |
| 52 | pkg-content/community/create/index | A_thin | 238/136 | 2 | 8/10 |
| 53 | pages/circle/detail | D_undetermined | 387/187 | 12 | 0/12 |
| 54 | pkg-about/about/privacy | B_new_screen | 591/34 | 125 | 0/125 |
| 55 | pkg-user/user/profile | A_thin | 216/215 | 25 | 0/25 |
| 56 | pkg-ai/ranking/detail | B_new_screen | 349/123 | 21 | 0/21 |
| 57 | pkg-ai/ranking/index | A_thin | 245/235 | 11 | 1/12 |
| 58 | pkg-shop/order/refund-list | B_new_screen | 291/117 | 17 | 0/17 |
| 59 | pages/register/index | A_thin | 230/320 | 15 | 8/23 |
| 60 | pkg-content/search/index | A_thin | 283/154 | 1 | 3/4 |
| 61 | pages/setting/index | A_thin | 254/440 | 19 | 0/19 |
| 62 | pages/share/index | C_miniapp_only | 914/169 | 22 | 0/22 |
| 63 | pages/study/plan | A_thin | 211/202 | 9 | 0/9 |
| 64 | pages/study/record | A_thin | 299/235 | 19 | 0/19 |
| 65 | pkg-user/subscriptions/index | A_thin | 140/159 | 4 | 2/6 |
| 66 | pages/distribution/company/index | A_thin | 234/316 | 1 | 8/9 |
| 67 | pkg-shop/token/balance | A_thin | 249/300 | 9 | 0/9 |
| 68 | pkg-content/topic/detail | A_thin | 292/224 | 7 | 10/17 |
| 69 | pages/study/video-detail/index | A_thin | 296/178 | 5 | 0/5 |
| 70 | pages/member/benefits | A_thin | 408/114 | 4 | 0/4 |
| 71 | pkg-shop/vip/details | B_new_screen | 254/123 | 34 | 0/34 |
| 72 | pkg-shop/vip/index | B_new_screen | 538/249 | 56 | 0/56 |
| 73 | pages/member/index | B_new_screen | 448/249 | 57 | 0/57 |
| 74 | pages/member/benefits | D_undetermined | 408/249 | 4 | 0/4 |
| 75 | pages/member/integral | D_undetermined | 174/249 | 5 | 0/5 |
| 76 | pages/member/coupon | D_undetermined | 110/249 | 2 | 0/2 |
| 77 | pages/member/coupon-list | D_undetermined | 134/249 | 8 | 0/8 |
| 78 | pkg-shop/vip-trader/index/index | A_thin | 385/348 | 61 | 2/63 |
| 79 | pages/distribution/withdraw | A_thin | 141/155 | 10 | 0/10 |
| 80 | pages/exam/wrong-list/index | A_thin | 191/395 | 2 | 0/2 |

## 7. 复算命令（全部在主仓 cwd 下跑，只读）

```bash
# ① 总账：pairs / hosted / hand
node scripts/check-miniapp-mirror-fidelity.mjs --quiet

# ② hand 80 逐条（route + spec + 键数）
node -e "import('./scripts/check-miniapp-mirror-fidelity.mjs').then(m=>{const r=m.__test__.computeFidelity('head');r.rows.filter(x=>x.form==='hand').forEach((x,i)=>console.log(i+1,x.route,x.spec,x.sharedKeys,x.missing.length))})"

# ③ 端内独有符号榜（79 带私有能力 / 1 壳不渲染 / 可转 0）
node scripts/plan-hand-mirror-conversion.mjs
node scripts/plan-hand-mirror-conversion.mjs --json | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s);j.rows.forEach(r=>console.log(r.route,'|',r.kind,'|',r.why))})"

# ④ 本报告的四档计数（从产物反算）
node -e "const r=require('./.worktrees/xend2/scripts/data/hand-pages-conversion-plan.json');console.log(r.length,r.reduce((a,x)=>(a[x.kind]=(a[x.kind]||0)+1,a),{}))"

# ⑤ props 腿（必填 / 全部）——allPropsOf 主仓不存在，用同编译面现算
node -e "import('./scripts/lib/cross-end-screen-props.mjs').then(m=>{for(const s of ['packages/app/src/features/cart/CartScreen.tsx','packages/app/src/features/privacy/PrivacyScreen.tsx'])console.log(s,JSON.stringify(m.requiredPropsOf(s)))})"

# ⑥ 页/屏行数与键差集（第 6 节表格的来源）
node -e "import('./scripts/check-miniapp-mirror-fidelity.mjs').then(async m=>{const fs=await import('node:fs');const G=m.__test__;for(const x of G.computeFidelity('head').rows.filter(r=>r.form==='hand')){const p='apps/miniapp-taro/src/'+x.route+'.tsx';const t=fs.readFileSync(p,'utf8');const s=fs.readFileSync(x.spec,'utf8');const pk=G.businessKeys([...G.consumedKeys(t)]);const sk=G.businessKeys([...G.consumedKeys(s)]);console.log(x.route,t.split('\n').length+'/'+s.split('\n').length,pk.filter(k=>!sk.includes(k)).length)}})"

# ⑦ D 档 5 条 css 残留的定位（证明 pair 来自 css 而非正文）
node -e "import('./scripts/check-cross-end-screen-coverage.mjs').then(c=>{const M=c.__test__.MARK_RE;for(const r of ['pages/member/coupon','pages/member/coupon-list','pages/member/integral','pages/member/benefits','pages/circle/detail']){const p=c.__test__.collectMiniapp('head').find(x=>x.route===r);console.log(r,'text=',[...((p.text||'').matchAll(M))].map(m=>m[0]),'css=',[...((p.cssText||'').matchAll(M))].map(m=>m[0]))}})"
```

> 复算注意：`computeFidelity('head')` 读的是 **git HEAD 面**，不是工作树。当前工作树有大量未提交改写（`git status` 可见 200+ 条），若用 `--worktree` 跑会得到另一组数字——两份口径不要混用。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
