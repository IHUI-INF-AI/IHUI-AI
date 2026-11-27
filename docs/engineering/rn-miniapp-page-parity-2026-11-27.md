<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# RN ↔ 小程序页面一致性收官报告（2026-11-27）

## 结论

- 真实基线以远端 `10604b5a` 为准：启动时实测 `pairs=251 / hosted=251 / hand=10 / avg=99.7% / missing=9`，旧报告里的 `hosted=254 / hand=7 / avg=100%` 已过时。
- 本轮不再为 10 个手写页补第二套镜像，而是**整屏直接承载 RN 壳**：页面结构、可见元素、数据请求、空/错/加载态、导航与交互全部回到同一份 `packages/app` / `apps/mobile-rn` 源码。
- 收官读数：`pairs=263 / hosted=260 / hand=0 / other=0 / broken=0 / avg=100.0% / missing=0 / aliasSame=0 / state=ok`。10 个目标页逐行均为 `hosted`、`fidelity=1`。
- 覆盖门：共享屏 278、RN 屏 349（335 委托共享层，96.0%）、小程序页 335、共享屏被显式镜像 258/278、已裁决不承载 20、未判定 0、无声明 0、登记表 259；结论“登记映射全部真实，镜像/下沉两项无倒退”。
- 小程序全量构建 `Compiled successfully in 2.49m`，`patch-entry-chunks` 补挂 333 个入口 / 7242 条静态 require；主包 1,830,644 B / 上限 2,097,152 B，余量 266,508 B。
- 两端 `typecheck` 均通过：`@ihui/miniapp-taro`、`@ihui/mobile-rn`、`@ihui/app` 均为 0 错。

全量逐对账本见同目录 `rn-miniapp-page-parity-2026-11-27.csv`（263 行，可按路由/承载形态/还原度复核）。

## 10 个手写页的最终承载

| 小程序路由 | 旧形态 | 最终承载 | 说明 |
| --- | --- | --- | --- |
| `pkg-hr/hr-attendance/index` | 只读记录，无签到 | `HrAttendanceScreenShell` | 新增 `index.config.ts`，`navigationStyle:'custom'`；外层 `RnShellPage + AuthReadyGate` |
| `pkg-ai/ai/agent` | 端内拼装 | `AgentScreenShell showTabBar={false}` | 自定义导航；避免 RN `TabBar` 与端内 tabBar 重影 |
| `pkg-ai/ai/agent-detail` | 端内拼装 | `AgentDetailScreenShell` | 自定义导航；共享屏补 rating/price 空值防御 |
| `pkg-learn/course/detail` | 端内拼装 | `CourseDetailScreenShell` | 自定义导航；目录三态文案与共享屏一致 |
| `pkg-learn/course/list` | 端内拼装 | `CourseScreenView initialKeyword showTabBar={false}` | 保留原生导航（本页无 RN 页内 header） |
| `pkg-shop/order/refund` | 端内拼装 | `OrderRefundScreenShell` | 自定义导航 |
| `pkg-share/share/index` | 端内拼装 | `ShareScreenShell` | 原 config 已是自定义导航 |
| `pkg-shop/vip/details` | 端内拼装 | `VipCompareScreenShell` | 自定义导航；功能名改走 `vipBenefitLabel` |
| `pkg-shop/vip/index` | 端内拼装 | `VipScreenShell` | 自定义导航；与 `pages/member/index` 共用同一 RN Vip 屏 |
| `pages/member/index` | 端内拼装 | `VipScreenShell` | 自定义导航；同一 `VipScreen` 不再各写一套 |

## 关键根因与修复

### 1. 宿主容器：RN 屏 `flex:1` 在小程序里折叠成 0 高

`RnShellPage` 原只有 `paddingTop: statusBarHeight`，没有确定高度；RN 屏根节点普遍 `flex:1`，在 Taro `auto-height` 父容器里高度为 0。改为 `height:100vh + boxSizing:'border-box' + paddingTop:statusBarHeight`，并把主题窗口底色内联到 `ThemeRoot`。

### 2. 自定义导航顶栏发黑：透明玻璃被合成到黑色图层

`NavChrome` 玻璃条在微信自定义导航栏下用 `rgba(255,255,255,0.6)`，透明层被宿主合成为黑色。新增 `globalThis.wx` 判据，在小程序宿主下把玻璃条背景覆盖为不透明的 `tokens.surface.bg`；RN 端保持原玻璃效果。`ThemeRoot` 同时补 `themeWindowBg(resolved)`，状态栏垫高区不再露出原生黑底。

> 第一次用 `Platform.OS` 判断失败，因为 Taro RN 兼容层把 OS 报成 ios/android；改判全局 `wx` 后，首页、Agent、Share、课程详情逐页截图均为浅色顶栏。

### 3. i18n：动态模板前缀没有进入承载词包

`RnShellReplacePlugin` 把 RN 壳的 `../i18n` 请求改写到小程序 `src/i18n`，因此 `VipScreen` 的 `tStatic` 实际走小程序词包。原生成器只抽取 `t('a.b')` 字面量，漏了：

- `tStatic(\`introducePopup.${seg}.${k}\`)` 这类动态模板；
- RN `screens` 里的常量键表；
- 承载页引用的裸键名。

修复 `scripts/lib/rn-carried-keys.mjs`：闭包内所有 RN 文件与承载页增加裸字面量键表扫描，并收集 `tStatic` 模板稳定前缀。修复 `scripts/gen-i18n-compressed.mjs`：按 `templatePrefixes` 从 RN 词包整片展开后 `subsetMissing`；承载层补键 922 → 1240。

重新生成后解包校验：`introducePopup.index.title = 会员权益`、`vipScreen.plans.continuous = 连续包月`、`uiText.benefitsIntro = 权益介绍`。`zh-cn-pack.gen.ts` 188,837 → 194,402 B；`remote-locales.gen.ts` 768,296 → 790,700 B；CDN 四语 b64 同步。

### 4. 共享屏空值崩溃：`rating/price` 直接 `.toFixed`

`AgentDetailScreen`、`CourseDetailScreen` 直接 `item.rating.toFixed(1)` / `item.price.toFixed(2)`；本地 API 的 agent/course 缺字段时触发 TypeError，页面停在骨架屏。改为 `typeof === 'number' && Number.isFinite(...)` 兜底 0；Agent 详情恢复渲染（评分 0.0 / 免费 / 开始对话）。

### 5. VIP 对比功能名显示裸 key

API `/api/vip-compare` 返回 `unlimitedChat`、`exclusiveModel`、`distributionQualification` 等原始 id。共享屏原直接 `label: row.feature`，RN 与小程序同样显示英文 key。改走 `@ihui/shared/constants` 的 `vipBenefitLabel`，复用 `VIP_BENEFIT_LABELS` 单一真相源；截图已显示“无限 AI 对话 / 独享高级模型 / 分销资格 / 线下学习”等中文。

### 6. 其他同步修复

- `rn-compat/drawer.tsx` 补 `export default Drawer`：`AgentScreen` / `ShareScreen` 用 default import，缺 default 会让 JSX 拿到 `undefined`（React #130 整屏白）。当前仍是平台占位交互件，不作为页面结构差异。
- `AgentScreen` 增加 `showTabBar = true` 可选参数，小程序壳传 `false`；避免 RN TabBar 与端内 tabBar 重影。
- `CourseScreen` 增加 `CourseScreenView` / `showTabBar` / `initialKeyword` 承载面，并修正 RN 类型路由名。
- `pkg-learn/course/detail-sections.tsx` 补齐 `completed / learning / locked` 三态文案。
- 删除 `pages/circle/detail.css` 造成的假 `PostDetailScreen` 配对。

## 验证

### 页面截图（微信开发者工具，iPhone 390×844 逻辑尺寸）

| 页面 | 结果 |
| --- | --- |
| 首页 | 浅色玻璃顶栏，NavChrome 夹具生效 |
| Agent | 轮播、最近使用、智汇值、智能体/模型 tab、分类与列表正常；顶栏浅色，无 tabBar 重影 |
| Agent 详情 | 标题、编辑、简介、创建者、使用次数、评分 0.0、免费、开始对话全部渲染 |
| Share | AI 内容、运行时空态、输入框、语音输入、分享素材、分享按钮正常；顶栏浅色 |
| HR 考勤 | 页头“人事部 · 考勤”、签到表单、考勤记录空态；测试账号无 HR 数据，结构正常 |
| 课程列表 | 原生导航“课程列表”，统计、学习路径空态、课程分类、搜索结构正常 |
| 课程详情 | 错误态“无效的 ID / 目录 / 评论 / 讲师 / 作业”正常；顶栏由黑转浅 |
| 订单退款 | 空态“申请退款 / 选择订单 / 暂无可退款的订单”正常 |
| VIP 对比 | 功能名列中文标签；基础/高级/企业列与表格正常 |
| VIP / member | 中文权益、套餐、等级权益弹窗正常；两页共用同一 `VipScreen` |

### 门读数

```text
check-cross-end-screen-coverage --worktree
sharedTotal=278 rnScreens=349 delegated=335 miniappPages=335
mirroredShared=258 adjudicatedNotCarried=20 noDeclaration=0 undetermined=0
registryEntries=259 => 登记映射全部真实，无倒退

check-miniapp-mirror-fidelity --worktree
pairs=263 hosted=260 hand=0 other=0 broken=0 packAbsentRows=0
avg=100.0% missing=0 aliasSame=0 state=ok

typecheck: miniapp-taro / mobile-rn / app => 0 errors
build:weapp: Compiled successfully in 2.49m; patch-entry-chunks 333 entries / 7242 requires
```

> CSS landing 门 C8 在“未提交工作树 vs HEAD”的对照下仍报 `prefixed 2→5 / other 13→27 / total 15→32`。该门源码面取 HEAD、产物面取磁盘；当前 HEAD 还是旧手写页，提交后需复跑。代码编译本身通过，主包体积未超限。

## 仍属宿主能力差异

- `rn-compat/drawer.tsx` 仅有关闭态占位：RN Drawer 依赖 `Animated / PanResponder / Modal` 手势链，小程序端无等价物。Agent/Share 的菜单按钮视觉已与 RN 一致，侧滑菜单交互尚未接 Taro 等价实现。
- VIP 支付：RN 走 `createWechatAppPayment + openWeChatPayment` App 支付；小程序已有 `upgradeVip + requestWxPayment` JSAPI 链，但 RN 壳尚未接平台回调。页面入口、套餐、权益展示已同源，支付通道仍各走宿主能力。

这两项不影响本轮“页面结构 / 元素 / 空错加载态 / 导航 / 数据面”同源判定，后续作为独立平台能力项处理。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
