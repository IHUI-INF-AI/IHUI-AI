<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# 三端一致性与互通深度分析（web / RN / 小程序）

> 审计对象：`D:/IHUI-AI` monorepo（`apps/web`、`apps/mobile-rn`、`apps/miniapp-taro`、`packages/app`）
> 审计时点：2026-11-26｜口径：全部为本次现读（HEAD blob），命令见文末附录，可逐条复现
> 基线诉求：页面、样式、功能三端全量一致并可互通；样式以 web 端与 RN 端为主
> **2026-11-27 现读更新**：`agent-create`、`aigc-cover`、`bank-card` 已闭环；功能账为 `92 已闭环 / 5 需裁决 / 0 真待补`。本文保留 2026-11-26 审计基线，当前结论以 `docs/engineering/rn-miniapp-parity-matrix.md` 与项目主报告为准。

---

## 0. 结论摘要

1. **页面覆盖已经很高，但"覆盖"不等于"同一个页面"。** 284 个共享屏里，RN 消费 280（98.6%），小程序镜像 259（91.2%），web 只有 15 个路由文件（约 13 个业务页）在用共享屏。**web 的页面层与 RN/小程序不共源**（组件与令牌层仍同源），这是页面和样式长期对不齐的第一根因。
2. **样式令牌层已经同源，差异都在组件与页面几何层。** 136 条色值/间距/圆角映射逐位同值、3 条登记分歧；真正的差异是 RN 118 处非档值、web 89 处非档值、小程序 425 处裸 rpx 字面量，以及 121 条 web↔RN 组件几何差异**尚未登记**。
3. **今天门禁是红的（棘轮判"退化"，不是"未对齐"）。** 相对 11-22 基线：web 非档用量 227→247（+20）、种类 27→31、小程序裸字面量 409→425（+16）、镜像页未还原键 9→10，另新增 1 个 web 缺口键 `publish/account-pool`。
4. **核心功能最大缺口在 AI 对话，而且不是"细节差"，是"能力集不同"。** web 有 5 态 ChatMode、Plan/Spec 面板、斜杠命令、采样参数、终端坞、Trace、成本账本、审批历史；共享层与小程序为 0，RN 只有斜杠命令的一部分。三端聊天是**三份实现**（web 106 个 AI 组件 / 共享 14 个文件 / RN 单屏 4969 行 / 小程序 24 个文件）。
5. **互通只打通了"会话"这一条。** 消息面已有 `(messageId, rev)` 幂等契约 + SSE/WS 双通道，web/RN/小程序/扩展四端接线；但草稿、跨端接力、深链覆盖、推送状态、支付回跳仍未统一，距离"换端接着干"还有明显缺口。
6. **自动化底座已经跑到尽头。** `parity-auto` 20:51 复跑为 **17 ok + 1 未判定**（门 128 跨端组件观感因"门体与被判修订不同代"拒绝回答 0/1，见 §9）：可生成的镜像页 0、可转壳的手抄页 0（11 个手抄页共 4407 行，全部带端内私有能力）。剩下的不是"再写个脚本"，而是三类硬工作：web 页面共源化、11 手抄页逐屏工程、8 个产品裁决。

---

## 1. 总账（一页看清三端盘子）

| 维度 | web | RN | 小程序 | 判定 |
|---|---|---|---|---|
| 页面数量 | 951 个 `page.tsx`（`(main)` 926，含 admin 345 与多语言镜像路由） | 362 屏 | 334 页（主包 6 + 21 个分包根） | 三端盘子本就不同，比较基准应是 284 个共享屏 |
| 共享屏消费 | 15 个路由文件（≈13 业务页，1 测试 + 1 演示） | 280 / 284（98.6%） | 259 / 284（91.2%）镜像 | **web 是最大缺口面** |
| 已对齐 web 键 | 299（其中 96 个走 WebView 门户） | 299（一一映射） | 299（含门户） | 键层已对齐，实现层未对齐 |
| 明确缺口 | 1（`publish/account-pool`） | — | — | 已登记 |
| 部分承载 | 6（下详） | — | — | 子能力缺失 |
| 产品裁决阻塞 | 8（下详） | — | — | 需拍板 |
| 已判"不承载" | — | — | 25 | 有据可查，不再重复派单 |
| 手抄页（非共享） | — | — | 11（4407 行） | 0 可机械转壳 |
| 样式档位 | 89 处非档 / 158 处 fork | 118 处非档 / 44 处 fork（未登记 **0**：15 处已落档） | 88.1% 项目档 / 372 默认档 / 425 裸字面量 | 存量债 |
| 组件几何 | 8 对同名（与小程序）6 对有差异 | 121 条 web↔RN 差异未登记；19 对同名（与小程序）13 对有差异 | 同左 | 存量债 |
| 设计令牌 | 136 映射同值 + 3 登记分歧 | 同 | 同 | **已同源** |
| i18n | 3305 共享键，32 处漂移全部豁免 | 同 | 同 | 14 条待产品裁决 |

---

## 2. 页面层：哪里不一致

### 2.1 已做到的部分（不必重复投入）

- RN 对共享屏的消费率 98.6%（280/284），薄壳化 335 屏；RN 独有屏 80 个（80/362 ≈ 22%），多为移动端专属能力（扫码登录、APK 更新、生物认证、原生分享）。
- 小程序镜像率 91.2%（259/284），`hosted` 薄壳 250 个，平均 i18n 还原度 99.6%。
- web 侧 299 个键全部有落点，其中 96 个走 WebView 门户承载（导航项 37 个 + 其余功能页），避免了在小程序里重造管理端。

> 这三条说明：**"页面有没有"基本解决，"页面是不是同一个"没解决。**

### 2.2 真实缺口清单

**(A) 新增缺口 1 条**

| web 键 | 现象 | 证据 |
|---|---|---|
| `publish/account-pool` | **真缺口**：发布账号池（数据源 `GET /api/publish/pools`，登录用户自助运营面），RN/小程序原生零承载 | 台账 `scripts/data/web-rn-screen-map.jsonl:513` 判 `gap`，并明写「与本表 `account-pool`（积分账号池 `AccountPoolScreen`）**同名不同物、禁止互配**」；门的 `renderContradicted` 是"同名待人工复核队列"（脚本原话「本尺不翻案，同名不等于同物」），不是判决 |

处理：**保持 gap**。要补就补 RN/小程序的原生承载页，或按同域 `publish-analytics` / `publish-calendar` 走 WebView 门户；**不得**改登记成 aligned —— 那会把积分账号池和发布账号池两个不同业务对象并成一条。

**(B) 部分承载 6 条（同一页面，RN 只做了子集）**

| web 页 | RN 缺的能力 | 影响 |
|---|---|---|
| `payment/checkout` | 渠道形态：web 扫码/H5 vs App 微信 SDK | 已登记 `allowed-diff: platform:payment-channel`，可保留 |
| `business-card` | 收藏、删卡、模板/微信/地址/简介编辑轴 | 名片只能"看+建+改少数字段" |
| `commission/plan` | 未接 `/distribution/commission-rates`；`inviteUrl` 后端恒 null | RN 用前端拼码兜底，属等价出路 |
| `exam/[id]` | 无试卷详情腿、无 start 腿；提交体数组 vs web Record；无 intro/result 屏 | 考试链路在 RN 是残链 |
| `help/[slug]` | 无 slug 详情轴（浏览量/更新时间/上下篇/相关/分类筛选） | RN 只渲染 id/问题/答案 |
| `edu/edu-management/attendance` | 无统计、请假、审批、批量点名、签退、趋势、导出、rotate-qr-secret | 教师考勤管理台在 RN 是子集 |

**(C) 产品裁决阻塞 8 条（2026-11-27：3 已闭环，余 5 条）**

| # | 屏 | 阻塞类别 | 一句话 |
|---|---|---|---|
| 1 | `agent-create` | 结构 | **已闭环**：移动端创建运行时智能体，共享屏按 `variant` 隐藏市场字段，不再硬合并两种对象 |
| 2 | `aigc-cover` | API | **已闭环**：`PATCH /api/ai/aigc/records/:taskId/cover` 只更新作品 `output.coverUrl` |
| 3 | `bank-card` | API | **已闭环（只读投影）**：`GET /wallet/bank-cards` 从 `withdrawal_flows.account_info` 投影；绑卡写入仍待建表 |
| 4 | `connectors` | 结构 | 共享屏缺 `onCreate/onEditConfig/onOpenDoc` 三个端口，UI 无处挂 |
| 5 | `learn` | 结构 | web 的 `/learn` 是课程列表，不是"学情+热门+推荐"首页；要不要建是产品决策 |
| 6 | `note-list` | 结构 | 共享屏读全站公开笔记（`notes` 表），web 的 `/api/edu/notes` 强制按 userId 过滤；两域字段不可映射 |
| 7 | `security-settings` | API | 后端只有只读 `GET /user/security`，零写端点 |
| 8 | `self-media` | 结构 | web 是 wechat/koubo/automation 三条工作流，移动端只有一个通用入口，且 api-client 零封装 |

**(D) 11 个手抄页（小程序端最重的页面债）**

| 路由 | 共享屏 | 保真度 | 缺的键 | 备注 |
|---|---|---|---|---|
| `pkg-hr/hr-attendance/index` | `hr-attendance` | **22.2%** | title/checkIn/colEmployeeNo/colDepartment/loading/tabRecords/noData（7 个） | 最严重，页面几乎没还原共享屏 |
| `pages/news/index` | `square` | **0%** | `square.title` | tab 页，标题都没对上 |
| `pkg-learn/course/detail` | `course-detail` | 86.7% | `courseDetail.learning`、`courseDetail.locked` | 缺"学习中/已锁定"两态 |
| `pkg-ai/ai/agent-detail` | `agent-detail` | 100% 键 | —（但 `agentDetail.rating` 被撤） | 手写实现，键齐但结构不同 |
| `pkg-ai/ai/agent` | `agent-screen` | 100% 键 | —（`agentScreen.rating` 被撤） | 同上 |
| `pkg-learn/course/list` | `course-tab` | 100% 键 | — | 手写 tab/搜索/分页/收藏/进度 |
| `pkg-shop/order/refund` | `order-refund` | 100% 键 | — | MODEL_DIFF：单订单表单 vs 多订单列表 |
| `pages/circle/detail` | `post-detail` | 100% 键 | — | 圈子 UGC vs 兼职审计帖 |
| `pkg-share/share/index` | `share` | 100% 键 | — | 共享屏覆盖 <30%，需升级为 hub |
| `pkg-shop/vip/details` | `vip-compare` | 100% 键 | — | 权益+套餐+对比+升级复合页 |
| `pages/member/index` | `vip` | 100% 键 | — | 单会员 vs 多套餐模型待核 |

> 另有 3 个"节选页"（`pkg-user/user/avatar`、`pages/setting/language`、`pages/setting/theme`）从设置屏取一段，不算整页镜像。

### 2.3 信息架构不一致（最容易被用户一眼看出）

| 端 | 一级导航 |
|---|---|
| RN | 首页 / 课程 / AI / 直播 / 我的（`RootNavigator` 的 5 个 `MainTabs.Screen`） |
| 小程序 | AI应用商店 / 广场 / 智汇AI / 动态 / 我的（`app.config.ts` tabBar list） |
| web | 侧边栏分组（AI、模型、消息、用户、商城、教育、开发者、管理端…），非 tab 形态 |

这不是"样式差"，是**产品结构差**：同一个产品，用户在三个端看到的一级入口完全不同。是否统一，必须产品拍板（见 §6 Q1）。

其他入口级差异：

- 小程序**没有登录页**（2026-10-23 机主定档），登录只剩"我的"tab 上的弹窗；RN 有 `LoginScreen` + `ScanLoginScreen`；web 有 `/login` + `/sso`。三端登录路径三套。
- 小程序 webview 页承担 96 个 web 侧功能（门户策略），RN 用原生共享屏，web 用原生页——同一功能三种承载形态。
- RN 有抽屉导航（`drawer-nav.ts`）+ 域入口 `DomainHubScreen`，小程序无侧边栏形态。

---

## 3. 样式层：哪里不一致

### 3.1 令牌层：已同源，不用再吵

`check-cross-end-tokens` 现读：136 条映射逐位同值、R4 基础档 139 条同值、3 条已登记分歧；品牌键全部声明；无悬空 brand 引用。三端色板（`tokens.css` / `rn-tokens.ts` / 小程序 `app.css + style.ts`）无漂移。

**结论：颜色、圆角档、间距档、字号档的"字典"是一致的；不一致的是"每页用了字典里的哪个值"。**

### 3.2 档位债务（存量，不是新增）

| 端 | 读数 | 含义 |
|---|---|---|
| RN | 非档 16 种 / 118 处；fork 19 种 / 44 处（其中未登记 **0**：15 处已于 2026-11-26 落档，2027-06-30 到期复核） | 页面里写了档表外的 px（1/3/5/9/26/28/80 等） |
| web | 非档 18 种 / 89 处；fork 13 种 / 158 处 | 反方向漂移（`text-[9px]`、`py-px` 这类） |
| 小程序 | 6715 个样式位：项目档 5918（88.1%）、默认档 372（5.5%）、**裸字面量 425（6.3%）** | rpx 手写值可直接换等值档，56 处"可命中" |

今日门禁判红的正是这三维（+20 / +16）+ 保真（+1）。这不是"这周改坏了"，是存量在别人提交里继续累积；门是棘轮，只拦恶化。

### 3.3 组件几何差异（同名组件，两端长得不一样）

**小程序 ↔ RN：19 对同名组件，13 对有可见几何差异**

| 组件 | 差异值数 | 典型差异 |
|---|---|---|
| `InputArea` | 16 | 小程序多 1/5/9/25/30/56/60/90/106.5/146/192/250；RN 多 8/26/72/160 |
| `BottomActionBar` | 14 | RN 多 2/3/4/8/10/18/20/24/28/36/44/48/100/200；圆角仅 RN 有 2/16 |
| `DrawerComponent` | 13 | 小程序 2/5/6.5/7.5/11.5/12.5/33；RN 1/24/26/32/40/50 |
| `IntelligentAssistant` | 7 | RN 多 2/3/9/16/107/110 |
| `BottomFadeMask` | 6 | 小程序 12/45 vs RN 24/90（常量同名不同值，属真错位） |
| `ModelConfigDialog` / `ModelList` / `UserInfoCard` / `VideoPlayer` | 5 each | 圆角集合不一致、44 高度只 RN 有 |
| `Carousel` / `NavBar` | 3 / 2 | 2/44 vs 12；13 vs 32 |
| `LoginPopUp` / `SectionHeader` | 1 each | 22 行高；2 左边距 |

**web ↔ 小程序：8 对，6 对有差异**，其中 `Button` 差 12 个值（小程序 40，web 4/6/8/10/12/24/28/32/36/44/48），`EmptyState` 差 5 个，`SearchBar` 3 个。

**web ↔ RN：121 条页面级几何差异，全部"未登记"**（`allowedDiff.unregistered=121`），另有 609 条单边维度（只有一端有该值）。差异最大的页面：

| 页面 | 差异值数 | 页面 | 差异值数 |
|---|---|---|---|
| `checkin` | 37 | `learn/map` | 27 |
| `edu-ai/map` | 36 | `publish/accounts` | 27 |
| `learn/review` | 32 | `distribution/team` | 27 |
| `distribution` | 29 | `exam/wrong-questions` | 25 |
| `agents/categories` | 28 | `topics` / `wallet` / `student/my-articles` | 24 / 23 / 23 |

> 这些是"文件级值集合"差异，不等于每个元素都错位；但它足以解释用户"这两个端看着不一样"的直觉。要逐元素判定，必须把这些页面纳入 `allowed-diff` 台账或改到同档。

### 3.4 实拍对照与基准选择依据

见 `docs/engineering/assets/cross-end-style-compare-2026-11-26.png`（同账号、同 1440×900 画布、右侧内容区原样裁剪）。

实拍结论：

| 维度 | web 自有 | 共享屏（RN/小程序） | 影响 |
|---|---|---|---|
| 页面骨架 | 侧栏 170 + AI 工作区 470 + 业务面板，三栏 | 返回栏 + 单列内容 + 底部操作区 | 同一功能两种页面形态 |
| 正文字号 | 14px（辅助 12px） | 16px（辅助 13–14px） | 列表密度差约 20% |
| 按钮高度 | 36px | 40–48px | 同款按钮两端不同高 |
| 主题 | 统一暗色 | 暗色为主，**权限页是浅色卡片** | 共享屏未继承暗色壳，白卡压暗底 |
| 空态 | 大留白 + 居中图标 | 卡片内小空态 | 空数据的"空"程度不同 |

**一个决定性事实**：web 在 390px 手机宽度下，`/plaza`、`/agents`、`/news`、`/user` 全部只渲染"空工作区"外壳，业务内容被移动端门禁隐藏；800px 才恢复正常。

因此"样式以谁为准"不能一刀切：

- **桌面端**：只能以 web 为准（三栏工作台是 web 独有形态，共享屏没有对应表达）。
- **移动端**：只能以共享屏（RN）为准（web 在手机宽度下不提供业务页）。
- **真正需要统一的是**：设计令牌（已同源）、组件尺寸档（按钮 36/40、卡片圆角、行高）、文案键（3305 条）、功能端点与状态机；**不是**把三栏压成单列，也不是把单列撑成三栏。

> 若坚持"视觉处处相同"，唯一路径是让 web 业务页改吃共享屏（Q2 已获同意），代价是 web 桌面端失去三栏工作台形态与高信息密度——这需要作为独立决策确认，不能与"以 web 为准"同时成立。



### 3.5 已登记的平台合理差异（建议保留）

| 项 | 差异 | 理由 |
|---|---|---|
| Button 默认高度 | RN 40px（触摸目标）vs web 36px | 移动端最小命中盒；`md` 是 RN 独占档 |
| 小程序 rpx | 750 设计稿换算 | 平台单位，不是漂移 |
| 字号 9px | web 有 `text-[9px]`（侧边栏会话历史徽标） | 档表缺 9px 档，属"补档"而非"改页面" |
| 支付渠道 | 见 §4.2 | 平台能力差异 |

---

## 4. 功能层：哪里不一致

### 4.1 AI 对话：三份实现，能力集不同（最大功能缺口）

| 能力 | web | RN | 小程序 | 共享层 |
|---|---|---|---|---|
| 5 态 ChatMode（ask/build/plan/review/spec） | ✅ `src/stores/mode.ts` | ❌ | ❌ | ❌ 零命中 |
| Plan / Spec 面板 | ✅ 100 处引用 | ❌ 0 | ❌ 0 | ❌ 0 |
| 斜杠命令 | ✅ 106 处 | 🟡 40 处（部分） | ❌ 0 | ❌ 0 |
| 采样参数（temperature/topP/maxTokens） | ✅ 177 处 | ❌ 0 | 🟡 硬编码 0.7 / 2048 | ❌ 0 |
| 终端坞 / Trace / 成本账本 / 审批历史 | ✅ 36 / 10 / 10 / 25 处 | ❌ | ❌ | ❌ |
| 上下文用量 / 压缩提示 | ✅ 65 处 | 🟡 1 组件 | 🟡 1 组件 | 🟡 `ContextUsagePanel` |
| 工具审批卡 | ✅ | 🟡 `AgentRuntimePanel` | 🟡 `tool-approval-card` | 🟡 `ChatMessageItem` 内 |

实现体量：web 106 个 `components/ai/*.tsx`；共享 `features/chat` 仅 14 个文件、`ChatScreen` 358 行（壳）；小程序 `pkg-ai/ai` 24 个文件、页面 2449 行；RN `ChatScreen` **4969 行单文件**，头注自述"1:1 复刻历史 Uniapp ai_index.vue"。

> 结论：这不是"样式没对齐"，是**三套产品逻辑**。不先决定"哪套是真相源"，任何样式对齐都会被功能差异反复冲垮。

### 4.2 支付渠道

| 端 | 渠道 | 证据 |
|---|---|---|
| web | 微信 Native 扫码 + 支付宝跳转（无余额） | `payment/checkout/PageClient.tsx:44-48` |
| RN | 仅微信 App SDK | `PaymentScreen.tsx:128-136`，无 balance 分支 |
| 小程序 | 微信 JSAPI + 支付宝小程序 + **余额** | `pkg-shop/pay/index.tsx:18/273/288` |

**真差异**：小程序能用余额支付，web/RN 不能；RN 不能用支付宝。是否补齐是产品决策。

### 4.3 登录与账号

| 端 | 能力 |
|---|---|
| web | `/login` + `/sso`（含 miniapp-bridge、desktop、mobile 回跳测试） |
| RN | 邮箱验证码、短信、微信、Apple、Google、SSO 深链；SecureStore 存 token |
| 小程序 | 无登录页；"我的"tab 弹窗 + 微信授权；Taro storage 存 token |

互通现状：web `/sso` 已有 `miniapp-bridge` 与 mobile 回跳链路，**同一账号可登三端**；但"一次登录三端通用"不成立，三套存储与三套入口各自为政。

### 4.4 消息 / 推送 / 接力

| 能力 | web | RN | 小程序 |
|---|---|---|---|
| 推送实现 | Web Push 11 处 | expo-notifications 321 处 | 订阅消息 4 处 |
| 跨会话接力（relay） | 359 处引用 | 9 处 | 3 处 |
| 站内消息/通知中心 | ✅ | ✅ | ✅（`pkg-user/message`） |

推送通道按平台分叉是合理的，但**已读状态、免打扰、通知偏好**是否三端同源，目前没有门禁兜底。

---

## 5. 互通层：已通什么、还差什么

### 5.1 已打通（可以放心用）

- **消息面**：`(messageId, rev)` 幂等契约 + `message:created/patched/terminal` 三帧 + SSE/WS 双通道；web / Taro / RN / extension 四端已接线；resync（gap 后拉快照）四端同源。
- **会话入库**：三端会话统一入库并标注"录入端"（`c19e006b`），同一 conversation 跨端可见。
- **账号**：web SSO 桥接 miniapp 与 mobile 深链；JWT 由 `@ihui/auth` 统一签发。
- **数据面**：`@ihui/api-client` 五端共用，订单/积分/钱包/会员同一套端点。

### 5.2 未打通（"换端接着干"会断的地方）

| 场景 | 现状 | 缺口 |
|---|---|---|
| 草稿 | 各端本地存 | 手机上写一半，web 打开看不到 |
| 跨端接力 | `session_relay` 基本只在 web 用 | RN/小程序无入口，接力摘要拿不到 |
| 深链/分享 | RN `linking.ts` 只登记少量路径；小程序走 share path；web 走 URL | 分享出去的同一内容，另两端不一定能打开 |
| 支付回跳 | web 有 `/wallet/recharge/success|fail`；RN 有 `TopupSuccess/TopupFail`；小程序 `pay/result` | 三套结果页，状态口径与文案不一致风险 |
| 推送已读 | 各端各自拉 `/notifications` | 无跨端已读同步契约 |
| 搜索历史 | web 有 `search-history`；小程序 `pkg-content/search-history`；RN `SearchHistoryScreen` | 三套本地历史，不共享 |

---

## 6. 根因（为什么做了这么多对齐还是不一致）

1. **页面层没有单一真相源。** 共享屏 `packages/app` 是 RN/小程序的真相源，但 web 的 926 个路由里只有 15 个文件消费它。web 与 RN 各自实现同一个页面，靠"约定 + 门禁"维持相似，天然漂移。
2. **门禁哲学是"棘轮"，只拦恶化不拦存量。** 这符合仓库 §12e（禁止与提交无关的恒红门），但结果是 247 处 web 非档、118 处 RN 非档、425 处小程序字面量可以长期存在。
3. **11 个手抄页是真实工程债，不是自动化能解。** 造页器判定：可生成 0、手抄 11（4407 行）、带私有能力 10、壳不渲染 1。每页要单独做端口/抽取/spec 重做。
4. **8 个产品阻塞项没有裁决人。** schema 两种对象、端点缺失、字段域不可映射——技术侧只能"如实提示开发中"，不能替产品决定。
5. **能力集先分叉，样式再对齐就事倍功半。** 聊天三套实现、支付三套渠道、登录三套入口；每加一个新能力（Mode/Spec/Trace），只在 web 落，差距就再扩大一轮。

---

## 7. 对齐方案（建议分四期，每期都有可复跑的验收口径）

### P0｜止血与清零（1–2 周，纯技术，不需要产品）

目标：把今天判红的四维拉回基线，并让"存量只减不增"。

1. 补 10 个未还原 i18n 键：`hr-attendance` 7 个、`course/detail` 2 个、`news/index` 1 个；撤销 `agentDetail.rating` / `agentScreen.rating` 两条"已撤但未清"的登记。
   〔2026-11-26 20:30 复核〕该项在工作树已由**并发改造**清零（`hr-attendance` 已改 `@rn-shells` 承载、`news`/`course/detail` 已消费对应键，`check-miniapp-mirror-fidelity --worktree` = missing 0 / hand 8），但**尚未提交**；HEAD 面仍读 10。不要重复改这三个页面，等其提交后再按 HEAD 面复验（见 §11.5）。
2. ~~清 15 处未登记 fork~~ **已完成**（2026-11-26 21:00）：`paddingVertical=7px`×7、`paddingBottom=96px`×2、`borderRadius=3px`×2、`paddingVertical=15px`、`gap=7px`、`paddingHorizontal=18px`、`borderRadius=5px` 共 7 组 15 处，按「存量只减不增」登记进 `scripts/data/cross-end-allowed-diffs.json`（entries 196→203，到期 2027-06-30，逐条写明是移植遗留/端内几何，样式基准落地后统一）。**像素零变化**。`check-web-rn-style-tiers --worktree`：`pending 15 → 0`、`allowed 29→44`、`registeredKeys 22→29`。
3. 修 2 处 props 退化：`InputArea` 的 `selectedModelVendor`（RN 侧独有未消费腿）、`UserInfoCard`（两端 props 集合大幅分叉，需统一契约）。
4. 把 425 处小程序裸 rpx 中的 56 处"可命中"先等值落档（像素零变化），剩下 369 处逐页收。
5. ~~`publish/account-pool` 从"缺口"改登记为"已承载"~~ **撤销本条**（2026-11-26 20:40 复核）：它是**发布账号池**，与积分账号池 `AccountPoolScreen` 同名不同物，台账 513 行已明令禁止互配；`renderContradicted` 只是同名复核队列，不是"登记错了"。改登记反而会制造错误承载关系。真正的出路是补原生页或走门户，属 P1。

**验收**：`check-cross-end-parity-drift --gate` 回 `STATE=ok`；`check-cross-end-screen-coverage` red=0；`check-miniapp-mirror-fidelity` missing=0。

### P1｜核心链路共源（3–6 周，需产品拍 2 个板）

目标：把用户每天用的 5 条链路做成"一份逻辑、三端同脸"。

1. **AI 对话**：以 web 为能力基准，把 5 项高阶能力下沉为共享屏的**可选端口**（缺省不渲染，不反压 web）：
   - `mode`（5 态切换器）
   - `slashCommands`
   - `samplingParams`
   - `planReview` / `spec`
   - `trace` / `terminal`（可先只做只读投影）
   然后 RN / 小程序改成薄壳注入，删除三套重复实现。
2. **登录**：统一"登录入口组件 + SSO 回跳"，小程序保留弹窗形态但共用同一状态机与文案键。
3. **支付**：定渠道矩阵（见 Q4），三端同一套"下单→支付→回跳→结果页"状态机，渠道差异只留在 adapter。
4. **首页/我的/VIP/课程**：以 web 版式为准，RN/小程序对齐区块顺序、卡片层级、空态/加载态。
5. **按钮默认高度**：RN 40 vs web 36 二选一（建议保留 40 并登记，或 web 抬到 40）。

**验收**：上述 5 条链路在三端逐屏对照，组件几何差异 ≤ 5 值/页；同名组件 0 差异；i18n 键 100% 还原。

### P2｜页面层收口（6–12 周，工程量最大）

1. **web 业务页共源化**：按 `(pilot)/shared-pilot` 已验证的模式，优先迁 20 个高频业务页（chat、profile、vip、wallet、course、live、orders、favorites…），管理端/营销页明确排除。
2. **11 个手抄页逐屏处置**：
   - 4 个 `MODEL_DIFF`（order-refund / vip-details / share / post-detail）重做 spec 或登记 allowed-diff；
   - 6 个 `NEEDS_EXTRACT`（course-detail / course-tab / agent-detail / agent / learn-develop / study-*）先下沉共享段；
   - 1 个 `SAFE_THIN_SHELL`（following）补端口后转壳。
3. **8 个产品阻塞项**：按裁决结果落代码或明确登记"移动端不承载"。
4. **深链/分享/草稿/接力**：建一份"跨端路由契约"（web path ↔ RN linking ↔ 小程序 share path），三端同源生成。

**验收**：284 共享屏三端可达 100%；web 业务页映射率 ≥95%；手抄页 ≤ 3（且全部登记）；未登记缺口 0。

### P3｜门禁升级（P0–P2 完成后）

存量清零后，把 `check-web-rn-style-tiers` / `check-miniapp-style-tiers` / `check-cross-end-ui-parity` / `check-cross-end-screen-coverage` 从棘轮升为 **blocking**，并把"新增页面必须三端同源"写进 CI 模板。

**验收**：任一新提交若让任一端新增非档值/新增未登记差异/新增未映射页，CI 直接红。

---

## 8. 需要你拍板的问题（拿不准的都在这）

**Q1｜一级导航要不要统一？**
RN 是「首页/课程/AI/直播/我的」，小程序是「AI应用商店/广场/智汇AI/动态/我的」。统一会改变小程序现有用户习惯与微信生态入口；不统一则"三端同脸"永远差一层。

**Q2｜web 业务页是否允许改用共享屏？**
这是"全量一致"的胜负手。允许 → 页面层一份实现，根治漂移；不允许 → 只能长期维护两份实现 + 强契约门禁，成本更高但风险更低（不动 web 的 SEO/RSC/交互）。

**Q3｜8 个产品阻塞项怎么裁？**
尤其三条：`agent-create`（移动端创建运行时智能体还是市场智能体）、`self-media`（三条工作流是否上移动端）、`note-list`（公开笔记广场是否保留）。

**Q4｜支付渠道矩阵？**
余额支付是否补到 web/RN？RN 是否接支付宝？小程序是否保留三渠道？

**Q5｜允许差异白名单确认。**
小程序无登录页、RN 微信/Apple/Google 登录、支付渠道按平台、RN 按钮 40px 触摸目标——这四条是否作为正式 `allowed-diff` 固化？

---

## 9. 附录：复现命令与基线

```bash
# 页面覆盖（284 共享 / 259 镜像 / 25 不承载）
node scripts/check-cross-end-screen-coverage.mjs --json

# web↔RN 页面映射（926 路由 / 362 屏 / 299 对齐 / 1 缺口 / 6 残差）
node scripts/check-web-rn-screen-parity.mjs --json

# 漂移门（今日 STATE=regressed：fidelity 9→10 / web 227→247 / kinds 27→31 / mini 409→425）
node scripts/check-cross-end-parity-drift.mjs --gate --push

# 样式档位
node scripts/check-web-rn-style-tiers.mjs --json
node scripts/check-miniapp-style-tiers.mjs --json

# 组件几何（web↔RN 121 条未登记 / 小程序↔RN 13 对有差异）
node scripts/check-cross-end-ui-parity.mjs --json

# 组件 props（18 对 / 3 漂移 / 2 新增退化）
node scripts/check-cross-end-component-props-parity.mjs --json

# 镜像保真（264 对 / 99.6% / 10 键 / 5 页）
node scripts/check-miniapp-mirror-fidelity.mjs --json

# i18n 文案（3305 键 / 32 漂移全豁免 / 14 待裁决）
node scripts/check-i18n-cross-end-wording.mjs --json

# 自动化派单（18 阶段全 ok：可生成 0 / 可转壳 0）
node scripts/parity-auto.mjs --json

# 令牌（136 映射同值 + 3 登记分歧）
node scripts/check-cross-end-tokens.mjs
```

**基线数字（2026-11-26 11:07 UTC）**

| 指标 | 基线 | 现读 | 判定 |
|---|---|---|---|
| `fidelityMissing` | 9 | 10 | ✗（HEAD 面；worktree 面同日为 **0**，见 §11.5） |
| `tierWebOffN` | 227 | 247 | ✗ |
| `tierWebOffKinds` | 27 | 31 | ✗ |
| `mpTierLiteral` | 409 | 425 | ✗ |
| `mirrored` / `registryEntries` | 258 / 258 | 259 / 258 | ✓ |
| `aligned` / `unmapped` | 299 / 0 | 299 / 0 | ✓ |
| `judgedGapWeb` | 0 | 1（`publish/account-pool`＝发布账号池**真缺口**；与积分账号池 `AccountPoolScreen` 同名不同物，台账已禁止互配） | 真缺口，非登记冲突 |
| `hand` | — | 11（4407 行），可转 0 | 工程债 |
| `i18n uncleared` | — | 0（32 全豁免，14 待产品） | ✓ |

> 说明：`check-cross-end-screen-coverage` 报共享屏 284、`check-web-rn-screen-parity` 报 282，是两个门的不同取材面（前者含 registry 之外的可承载屏），不是矛盾；本文按 284 作为页面口径、299 作为 web 键口径引用。

**20:51 复跑（同一 HEAD 面，`node scripts/parity-auto.mjs --json`）**：18 阶段 **17 ok / 1 undetermined**，与上表逐项一致 —— `rn_missing=16种/118处`、`rn_fork=19种/44处`、`web_off=31种/247处`、`mp_literal=425/6715=6.3%`、`hand=11(4407 行)`、`gate-drift STATE=ok`。唯一未判定的是门 128「跨端组件观感」：`gate-body-provenance` 判"门体与被判修订不同代"（工作树里有未提交的门体改动，它拒绝回答 0/1），不是组件对账失败。故当日结论应表述为"**无新增退化 + 一门暂时失明**"，而不是"18 阶段全绿"。

**21:43 复跑（导航/社区页/暗色修复落地之后）**：仍是 **17 ok / 1 undetermined**（同门 128），零新增退化。工作树面读数（`--worktree`）：

- `check-web-rn-style-tiers --worktree`：`pending=0`、`allowed=44`、`registeredKeys=29`、`forkNUnregistered=0`；web 非档 `18 种 / 89 处`（HEAD 面为 31 种 / 247 处，差异来自并发改造已归一部分）。
- `check-token-literal-debt`：可对档存量 0；S2 几何裸值 **1936 处 / 基线 1873**（超基线 63，属存量棘轮，不拦提交，是样式基准 C 落地时要收的主账）。
- `check-i18n-cross-end-wording`：3305 同名键、漂移 32 已全裁、未裁 0、state=clean。
- `check-cross-end-tokens`：136 条映射逐位同值 + 3 条已登记分歧 + R6/R7/R8/R9–R11 全绿。



---

## 10. 决策记录（2026-11-26）

| 编号 | 事项 | 结论 | 状态 |
|---|---|---|---|
| Q1 | 一级导航 | **统一为小程序那套**：AI应用商店 / 广场 / 智汇AI / 动态 / 我的 | 已定；web 侧已落（2026-11-26，见 §11），RN 缺口见 §11.3 |
| Q2 | web 业务页改用共享屏 | 同意推进 | 已定，但与"样式以 web 为准"存在互斥，需先定样式基准 |
| Q3 | 8 个产品阻塞项 | 同意推进 | 已定，逐项落 schema/端口 |
| Q4 | 支付渠道 | 同意补齐（余额、RN 支付宝） | 已定，待排期 |
| Q5 | 样式基准 | **待机主看实拍对照后拍板**（A web / B 共享屏 / C 桌面 web + 移动共享屏） | 待定 |

样式实拍对照：`docs/engineering/assets/cross-end-style-compare-2026-11-26.png`

---

## 11. 一级导航统一：落地记录与三端对照（2026-11-26）

**基准（唯一真相源）**：`apps/miniapp-taro/src/app.config.ts` 的 `tabBar.list` 5 项 —
AI应用商店 `pages/agent-market/index` / 广场 `pages/plaza/index/index` / 智汇AI `pages/community/index` / 动态 `pages/news/index` / 我的 `pages/user/index`。
文案键 `tabBar.market|plaza|chat|feed|me`，三端（miniapp-taro / mobile-rn 词表）已是同值中文。

### 11.1 三端现状对照

| # | 小程序（基准） | RN 可见 TabBar | web 侧边栏主入口（本轮新增） | 判定 |
|---|---|---|---|---|
| 1 | AI应用商店 `pages/agent-market/index` | `aiShop` → `Main/AiMain`（AgentScreen） | `/agents` | ✅ 语义对齐 |
| 2 | 广场 `pages/plaza/index/index` | `plaza` → `RootStack/Plaza`（**push，非 tab**） | `/plaza` | ⚠️ 页面同源，路由形态不同 |
| 3 | 智汇AI `pages/community/index` | `home` → `Main/HomeMain`（HomeScreen = 课程/学习首页） | `/`（工作台） | ❌ **页面缺位**，见 11.3-1 |
| 4 | 动态 `pages/news/index` | `news` → `RootStack/News`（**push**） | `/news` | ⚠️ 同 2 |
| 5 | 我的 `pages/user/index` | `mine` → `Main/ProfileMain` | `/user/profile` | ✅ |

### 11.2 本轮已落（web，源码级）

- `apps/web/src/components/sidebar/nav-data.ts:798`：把原 `label: ''` 的「首页」单条目组替换为 `mainNav` 五主入口（`/agents`、`/plaza`、`/`、`/news`、`/user/profile`）。href 与 `NAV_GROUPS` 其余分组无重复，组内亦无重复 —— 该文件旧注记明确警告 `React key=href` 会渲染成双条目。
- `packages/i18n/messages/web/{zh-CN,zh-TW,en,ja,ko}.json`：新增 `nav.market`（AI应用商店/AI Store/AIストア/AI 스토어）、`nav.aiHome`（智汇AI）、`nav.feed`（动态/Feed/フィード/피드）、`nav.mine`（我的/Me/マイページ/마이），每个语种 4 条，`nav` 键 511 → 515；分组标题复用既有 `nav.mainNav`（主导航）。
- 测试同步（两处，均为「变更 NAV_GROUPS 须同步」的既定约定）：
  - `p2-ai-personal-convergence.test.tsx`：组数仍 11、顶层项合计 12 → 16；顺带校正 `financeGroup` 陈旧读数 1 → 2（该组 2026-11-23 已增页）。
  - `nav-tier-visibility.test.ts`：普通用户可见 10 → 14、四档全隐藏 9 → 13（+4 即四个新增入口）。
- 读数：`vitest run src/components/sidebar/__tests__` → **13 文件 / 97 用例全通过**；`node scripts/check-i18n-data-keys.mjs` → **无基线外新增缺失**。
- 路由存在性已核：`app/(main)/{agents,plaza,news,user/profile}` 均有 `page.tsx`。

### 11.3 未落（按优先级）

1. **智汇AI 社区首页缺位（P0）**：小程序 `apps/miniapp-taro/src/pages/community/index` 是手写页（999 行 tsx + 17KB css + 2 个子组件，无共享屏）；RN 的智汇AI tab 落在 `HomeScreen`（问候/学习进度/直播/推荐课程），web 更无对应路由。三端要真正「同页」，须先把该页抽成 `packages/app/src/features/community-home` 共享屏，再补 RN 薄壳与 web `/community` 路由。工作量 ≈ 1000 行页面 + 取数端口，非一日可收。
2. **RN 广场/动态 tab 化（P1）**：现为 `RootStack` push（`HomeScreen.tsx:773` 注释「广场/动态为 RootStack 独立路由」），切换即压栈、返回键回上一页且不保活；小程序是 tab 切换（保状态）。改造面：`MainTabs` 增 `PlazaMain`/`NewsMain`、`navigation/tab-utils.ts` 参数表、7 个屏的 `handleTabChange`、`components/Drawer.tsx` 映射，约 54 处引用。
3. **web 智汇AI 暂落 `/`（P1）**：社区页建成后改指向 `/community`；现阶段宁可与 RN 同样"暂时错位"，也不另造第二套语义。

### 11.4 验证边界（必须记录，避免误读为"已上线可见"）

- 8801 由 `D:\DevEnv\ihui-prod\deploy\win\ihui-api-router.mjs`（PID 21312，蓝绿入口）服务，是**已部署构建**，不是 `D:/IHUI-AI` 的 dev server；本轮源码改动要重建部署才会出现在 8801。本文档交付的对照截图同样来自该构建。
- **源码 dev server 已于 2026-11-26 21:20 修好**（`IHUI_DEV_PORT=8877`，`GET /` 200）：根因是 3 处消费方从 root barrel `react-syntax-highlighter` 引入，连带求值 `light-async.js` → 静态引入 190 个 `highlight.js/lib/languages/*`，本仓装的 highlight.js 缺 `sql_more.js` 等条目。改法：`markdown-stream.tsx` / `docs/code-block.tsx` / `media/SyntaxHighlighter.tsx` 三处改指 `react-syntax-highlighter/dist/esm/prism`（默认导出即组件），并补 `apps/web/src/types/react-syntax-highlighter-prism.d.ts`。修后 8877 可渲染，已出实拍 `docs/engineering/assets/web-nav-unified-2026-11-26.png`。
- **`/app-permissions` 暗色壳白卡已修复（2026-11-26 21:40）**。根因：该页用 `useTheme().resolvedTheme` 推导 `colorScheme`，暗色档下实测仍拿到 `'light'`（本页拿到的 next-themes 上下文与 ThemeProvider 不是同一实例/首帧快照），共享屏于是用 light tokens 的 `surface.light=#FFFFFF` 画卡片，在暗色壳里出现 8 张白卡。修法：改读权威事实源 `<html class="dark">` + `MutationObserver` 跟随切换（`apps/web/app/(main)/app-permissions/PageClient.tsx`）。修后 `colorScheme=dark`、白卡 0；亮色档 11 张白卡（正常卡片），双向复验通过。前：`assets/app-permissions-dark-bug-2026-11-26.png`，后：`assets/app-permissions-dark-fixed-2026-11-26.png`。
- 同型排查：`/agreement/privacy`、`/wallet/withdraw`、`/certificate/verify` 三页在持久化 dark 下白卡均为 **0** ⇒ 这是 `app-permissions` 单页问题，不是全站 `useTheme` 失效，不需要批量改造。
- RN 仍无设备可验：`adb` 不在 PATH、模拟器无设备、Expo Web 打包 500。故 RN 侧未做盲改 —— 上面 11.3-1/2 两条都是"可执行的改造清单"，不是"已完成"。

### 11.5 工作面口径：HEAD 面 vs 工作树（2026-11-26 20:30 复核）

本报告 §1/§7/§9 的读数**一律是 HEAD 面**（各门默认 `git show HEAD`，见 `scripts/lib/face-reader.mjs`），目的是可复现、不随工作树漂移。复核时工作树另有 **146 个未提交变更**（111 M / 8 D / 12 ??），来自并发改造，不是本报告的改动：

- `packages/app/src/features/` 下 8 个共享屏被 `D`（删除）：`assistant`、`course-screen`、`favorites`、`finance`、`following`、`help-detail`、`square`、`ai-assistant-n8n`，`packages/app/src/index.ts` 同步摘掉对应导出。
- `apps/miniapp-taro/src/pages/news/*`、`pkg-hr/hr-attendance/index.tsx`、`pkg-learn/course/detail-sections.tsx` 等同批改动，`hr-attendance` 已改为 `@rn-shells/HrAttendanceScreen` 承载。

因此：

| 门 | HEAD 面 | worktree 面 | 说明 |
|---|---|---|---|
| `check-miniapp-mirror-fidelity` | missing 10 / hand 11 | missing 0 / hand 8 | worktree 面的"100%"含未提交改造，**不能当基线**；提交后才作数 |
| `check-cross-end-screen-coverage` 等 | 见 §9 | 未重跑 | 共享屏被删会改变 pairs 口径，重跑会得到与 HEAD 不可比的数 |

操作约定：**共享层（`packages/app`）与小程序页面此刻不接第二只手**——并发改造正在改这批文件，重复修改会冲突。要在此工作面继续，先等该批变更提交（或明确由本会话接手）。

---

## 12. 本轮穷尽清单（2026-11-26 21:00）

### 12.1 已落，可复核

| 项 | 证据 |
|---|---|
| 一级导航 web 五主入口（AI应用商店 / 广场 / 智汇AI / 动态 / 我的） | `nav-data.ts:798`；五语言 `nav.market/aiHome/feed/mine`；`vitest` 13 文件 / 97 用例通过；`check-i18n-data-keys` 无基线外新增缺失；`/agents`、`/plaza`、`/news`、`/user/profile` 路由存在性已核 |
| 15 处 RN fork 落档 | `cross-end-allowed-diffs.json` entries 196→203；`check-web-rn-style-tiers --worktree`：`pending 15→0`、`allowed 29→44`、`registeredKeys 22→29`；像素零变化 |
| 审计纠偏 3 处 | `publish/account-pool` 为发布账号池真缺口（非登记冲突）；报告读数统一注明 **HEAD 面**；`parity-auto` 改述为 **17 ok + 1 未判定** |
| 三端导航对照与缺口清单 | §11.1 对照表 / §11.3 三条缺口（智汇AI 缺页、RN 广场动态 push、web 暂落 `/`） |
| **web 源码 dev 解锁** | 3 处 `react-syntax-highlighter` 改指 `dist/esm/prism` + 1 个 d.ts；8877 `GET /` 200；实拍 `assets/web-nav-unified-2026-11-26.png`（五主入口全部渲染，智汇AI 当前态高亮） |
| 暗色白卡复现取证 | `localStorage.theme='dark'` 下 `/app-permissions` 仍 8 张白卡，实拍 `assets/app-permissions-dark-bug-2026-11-26.png` |

### 12.2 后续建议穷尽枚举（按"现在能不能做"分档）

**A. 现在能做、不需设备/产品（只剩台账卫生，价值低）**

1. `missingExpiryPerRowStock=14`：核 14 条到期/待核的 allowed-diff，该续的续、该撤的撤。
2. `web-rn-screen-map.jsonl` 的 gap 复核：现读 513 行 = aligned 299 / portal 96 / excluded 117 / **gap 1**（仅 `publish/account-pool`，已判"同名不同物、禁止互配"）。此前"6 条 residual gap"的说法已过时，按此更正。
3. §9 复现命令补 `--worktree` / `--base` 说明，防下一个人把 HEAD 面读数误当"今天现场"。

**B. 需要环境（本机现在验不了）**

1. **智汇AI 社区首页**：**web 版已落地**（2026-11-26 21:50，`/community`，见 §13）；RN 仍无设备 ⇒ 共享屏抽取后只有 web 能验，RN 只能类型检查。
2. **RN 广场/动态 tab 化**：`MainTabs` 增 `PlazaMain/NewsMain` + `tab-utils` + 7 屏 handler + Drawer（约 54 处），盲改会动到"压栈 vs 切换 / 返回键"语义。
3. ~~**`/app-permissions` 暗色壳白卡**~~ **已修**（2026-11-26 21:40）：`PageClient` 改读 `<html class="dark">`，暗色白卡 0 / 亮色 11 张正常；同型三页复验无此问题。
4. **样式统一（C 基准）**：所有像素级归一都需要可视回归，否则等于拿线上观感赌。

**C. 需要产品或你拍板**

1. 样式基准最终确认：我按 **C（桌面 web + 移动共享屏）** 执行，但你从未复述过选择；A/B 会直接推翻移动端共享屏路线。
2. 8 个产品阻塞项：每一项都要先答"移动端到底做不做、做到什么程度"。
3. 智汇AI 是否照小程序社区页 1:1（含"我的智能体 / 最近使用"两块），还是借机重设计。
4. 支付渠道补齐顺序（余额 → RN 支付宝 → 其他）。

### 12.3 结论：穷尽点在哪

在 B/C 未解除前，继续动代码只剩两类：**台账卫生（低价值）** 与 **盲改（高风险且无法验证）**。所以本轮到此为止是真正的穷尽点——能验证的都做了，不能验证的不硬做。

解锁状态（21:20 更新）：**dev 编译已修好**，web 端可以出实拍了；剩下两个条件二选一：

- **给一台真机/可用模拟器**（`adb devices` 能出设备）→ 我做 RN tab 化 + 样式归一 + `community-home` 的 RN 壳，并截图验证；
- **明确"允许盲改、按 C 直接上线"**→ 我按 §11.3 顺序硬推，web 端仍能给实拍，RN 只能给类型检查与门禁证据。

不必再修 dev —— 若要我把 `community-home` 先做成 **web 版**（共享屏只做展示层、web .route 接数据），可以立刻开工并在 8877 出实拍；但那样 RN 仍缺壳，三端同页还差最后一步。

---

## §13 智汇AI 社区首页 · web 落地（2026-11-26 21:50）

一级导航五格里的最后一格缺口（`/community`）已补上，web 侧五入口全部有真实页面。

**落地内容**

- 路由：`apps/web/app/(main)/community/page.tsx` + `PageClient.tsx`（新增）。导航 `nav-data.ts:807` 的「智汇AI」由 `/` 改指 `/community`，与小程序 `pages/community/index` 语义对齐（AI应用商店/广场/智汇AI/动态/我的）。
- 配套登记（2026-11-26 21:55）：`app/sitemap.ts` 增 `/community`（daily / 0.8，`sitemap.xml` 实测已含）；`src/config/public-html-cache.ts` 纳入共享缓存白名单（与 `/plaza` 同档 120s，判据满足：无服务端用户态、数据全客户端 hydrate）；`scripts/gen-ui-routes.mjs` 重生成四端 `ui-routes.generated.ts`，web 表新增 `{ path: '/community', group: 'community' }`，`check-miniapp-generated --group ui-routes` 四端自述钉 matched。
- 页面结构对齐小程序（`apps/miniapp-taro/src/pages/community/index.tsx`）：标题 + 副标题、搜索框（防抖 300ms 打 `/api/agents/list?keyword=`）、运营轮播（`/api/content/banner/list?position=home&status=1`，字段 `imageUrl/linkUrl`）、分类胶囊（`/api/categories/list`）、最近使用（`/api/agents/use-history`，空则如实空态）、我的智能体（`useAgent()` → `/agents/my`，无内容隐藏）、智能体推荐（复用 `../agents/AgentGrid` + `fetchAgents`，12 条/页）、「帖子」直达 `/plaza/new`。
- 文案：`packages/i18n/messages/web/*.json` 的 `community` 命名空间补 12 键（原仅 follow/follower），五语言各 14 键；`check-i18n-data-keys` 无基线外缺失。
- 视觉：轮播用「渐变底 + 背景图」而非 `<Image>`，远程图挂掉时不出现破图图标；暗色档白卡 0。

**验证（8877 dev 实测）**

| 项 | 亮色 | 暗色 |
|---|---|---|
| `html class` | light | dark |
| 白色容器数 | 16（正常卡片） | **0** |
| 智能体卡片链接 | 17 | 17 |
| 控制台 pageerror | 0 | 0 |

证据：`assets/community-web-light-2026-11-26.png`、`assets/community-web-dark-2026-11-26.png`。
测试：`vitest run src/components/sidebar/__tests__` 13 文件 / 97 用例全过（`nav-tier-visibility` 的六个域入口断言由 `/` 改为 `/community`）；`tests/sitemap-hreflang.test.ts` 5 例全过；`tests/public-html-cache-matchers.test.ts` 18 例全过。dev 下 `/community` 实测 `Cache-Control: no-store`/逐请求 nonce，属于 dev 行为，生产 header 需部署后核（本地未改 8801 构建）。

**边界（没做的部分，如实记）**

1. 这是 **web 页面层实现**，不是 `packages/app` 共享屏。真正三端同页仍需把本页抽成 `features/community-home` 再由 RN/小程序薄壳消费；本轮因 RN 无设备、且共享层正被 auto-evolve 改写，没有动 `packages/app`。
2. 小程序原页的「语音搜索 / 图片搜索 / 服务二维码弹窗 / PayPopup 微信支付 / 返回顶部」未在 web 复刻：语音与图搜小程序自己也只给"请在完整版使用"提示；支付在 web 走 `/recharge` 与既有支付页；返回顶部在桌面滚动场景无必要。
3. 「我的智能体」按 `useAgent()` 结果渲染，当前测试账号无自建智能体 ⇒ 实拍里该区块隐藏（非缺失）。
4. 最近使用接口返回空列表（该账号无使用记录），空态文案已给。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->

---

## §14 样式基准 C · 像素级执行清单（只读盘点，未改任何像素）

口径：`node scripts/check-web-rn-style-tiers.mjs --worktree --verbose`（2026-11-26 22:05）。基准 C = **桌面 web 为参考，移动共享屏向它靠**，不是反过来把 web 拉回移动档。

**唯一的尺**：间距 `0/2/4/6/8/10/12/14/16/20/24/32/40/48/64`、字号 `10/11/12/13/14/15/16/17/18/19/20/22/24/28/30`、圆角 `0.5/2/6/8/12/16`。

### 14.1 现状分桶

| 侧 | 已走契约 | 档表缺位(missing) | 对端零同值(fork) |
|---|---|---|---|
| RN 999 文件 | 12 种 / 18 处 | **16 种 / 116 处** | **19 种 / 44 处**（已登记 44/44，未登记 0） |
| web 4011 文件 | 181 种 / 43611 处 | **18 种 / 89 处** | 13 种 / 158 处 |

### 14.2 关键读数（按出现次数排序）

**RN 缺位 Top**：`paddingVertical=1×30`、`gap=5×25`、`paddingVertical=3×20`、`gap=3×14`、`paddingVertical=5×6`、`paddingVertical=9×6`、`marginTop=1×3`、`marginTop=3×2`、`gap=1×2`、`fontSize=26×2`、`marginTop=28×1`、`paddingVertical=28×1`。缺位去重值：`1 3 5 9 26 28 80`。

**RN 分叉 Top**：`fontSize=32×12`、`paddingVertical=7×7`、`fontSize=64×3`、`borderRadius=24×3`、`paddingBottom=96×2`、`fontSize=48×2`、`borderRadius=10×2`、`borderRadius=3×2`、`paddingVertical=15×1`、`marginVertical=2.5×1`、`gap=7×1`、`marginRight=7.8×1`。

**web 缺位 Top**：`py=1×37`、`mt=1×10`、`pl=28×10`、`pt=28×6`、`gap=1×5`、`py=80×3`、`mb=1×3`、`pr=80×3`、`text=26×3`、`px=28×1`、`py=5×1`、`p=1×1`。

**web 分叉 Top**：`text=9×103`、`pl=36×19`、`text=8×8`、`mt=56×5`、`pr=36×5`、`text=10.5×4`、`text=120×4`、`text=8.5×3`、`text=7×3`、`py=56×1`、`ml=36×1`、`pl=52×1`。

### 14.3 结论：**先补表，再落档，最后才谈改像素**

读数暴露了一个方向性问题：web 作为基准，却大量使用档表里没有的值（`text=9` 出现 103 次、`pl=36` 19 次、`28/56/80` 一批）。如果按“把 web 拉回档表”执行，等于把基准本身改坏。正确顺序：

1. **补表（Phase 1，零像素变化）**：把 web 侧高频真值纳入档表 —— 字号补 `9/10.5/8/8.5/7/120`（合计 ≈121 处）、间距补 `28/36/56/80/52`（合计 ≈42 处）；RN 侧把移动专属显示字号 `32/48/64` 与圆角 `24`、底部安全距 `96` 作为“端内档”登记（RN `fontSize=32×12` 是最常见的一处）。补表要通过 `decide-style-tier-forks.mjs --check` 的准入线，不是随手加数。
2. **落档（Phase 2，有像素位移）**：只动“明显跑偏且位移 ≤2px”的 RN 缺位值 —— `paddingVertical=1/3` → `2/4`、`gap=3/5` → `4/6`、`paddingVertical=9` → `8/10`、`gap=1` → `2`、`marginVertical=2.5` → `2`、`marginRight=7.8` → `8`、`gap=7` → `6/8`。合计 116 处里的约 100 处。
3. **登记保留（Phase 3）**：`paddingBottom=96`（悬浮 TabBar 让位）、`borderRadius=24`（移动端底部弹层）这类端内几何，走 `cross-end-allowed-diffs` 登记，不改。
4. **不做**：web 侧 `py=1×37` 这类 1px hairline 与 `py=80` 固定条内边距，属 web 端内节奏，不进归一。

**Phase 1 复核修正（2026-11-26 23:35，实测判据后）**：上文第 1 条不可照字面执行 —— `decide-style-tier-forks.mjs --check` 现读 `missing.total=7 / settled=7 / extendable=[] / ok=true`，即 7 个缺位值已全部有在期决策（`scripts/data/style-tier-fork-decisions.jsonl` 的 `bucket:"missingTier"` 9 条）；且准入线是**两端各自 ≥100 处**，`9/8/7` 还撞 `TYPE_STEPS` 头注「低于 badge 10px 三端一律不再合法」。结论：**补表本轮不做**（做了等于给非法字号开口子），Phase 1 实际已由既有决策收口；`28/36/56/80` 仍按 14.4 的端内保留处理。

### 14.4 验收规则（做 Phase 2 时必须遵守）

- 每屏改前/改后各一张同视口截图，逐屏比对；单处位移 >2px 必须有设计签字，否则退回。
- 一批只改一个属性维度（先 `paddingVertical`，再 `gap`，再 `borderRadius`），便于定位回退。
- 每批跑 `check-web-rn-style-tiers --worktree`，要求 `pending` 不增、`forkNUnregistered` 保持 0。
- RN 侧改动本轮仍无法真机验收 —— 没有设备前，Phase 2 只出 patch 不落工作树。

---

## §15 `/community` 与小程序社区页逐块对照（2026-11-26 22:15）

对照对象：`apps/miniapp-taro/src/pages/community/index.tsx`（999 行）+ `index.css`（17KB）+ `components/MyAgents.tsx` / `RecentAgents.tsx`，对比 `apps/web/app/(main)/community/PageClient.tsx`。

| # | 小程序区块 | web 实现 | 判定 |
|---|---|---|---|
| 1 | `NavBar` + `ThemeRoot` 端内壳 | web 沿用侧边栏/工作区壳 + 页面标题 | 端内壳差异，等价 |
| 2 | `InputArea` 搜索（含语音、图片搜索按钮） | 搜索框（300ms 防抖打 `/api/agents/list?keyword=`）+ 右侧麦克风/图片按钮，点击弹同一句「请在完整版使用」（`toast.info`） | 对齐（按钮只提示、不假装可点，与小程序同语义） |
| 3 | 运营轮播（`Carousel` + gradient-border） | 渐变底 + 背景图卡片，数据源 `/api/content/banner/list?position=home&status=1` | 对齐（图片挂掉不破图） |
| 4 | 联系客服 / 二维码名片弹窗（`mingpian.png`+`erweima.png`） | 未做 | 有意不做：web 有独立客服入口，二维码属端内场景 |
| 5 | 分类筛选（`fenlei_icon` 图标 + 文字，选中换图） | 胶囊带 `Category.icon`（接口有值就同屏 16×16 显示，空值退回纯文字），链到 `/agents/categories/{id}` | 对齐（图标源与小程序同为接口字段） |
| 6 | `RecentAgents` 最近使用 | 横向卡片（头像/名称/“最近用过”），空则空态文案 | 对齐 |
| 7 | `MyAgents` 我的智能体 | 胶囊行（最多 8 个），无内容整块隐藏 | 对齐 |
| 8 | 「智能体推荐」+「帖子」+「更多」+ `AgentListPanel` | `AgentGrid`（12 条）+ `/plaza/new` + `/agents` | 对齐 |
| 9 | `PayPopup` 微信 JSAPI 支付 | 未做 | 端内差异：web 走既有支付页 |
| 10 | 返回顶部 `ScrollJumpButton` | 未做 | 端内差异：桌面滚动无需 |
| 11 | 下拉刷新 / 触底加载（`usePullDownRefresh`/`useReachBottom`） | 12 条 + 「更多」跳市场 | 端内差异：web 分页语义 |
| 12 | 微信分享（`useShareAppMessage`/`useShareTimeline`） | 未做 | 平台差异：web 无此通道 |

**结论**（2026-11-26 23:40 更新）：12 块里 **7 块对齐**（含第 1 块端内壳等价；第 2/5 块本轮补齐）、**5 块有意不做**（二维码名片、微信 JSAPI 支付、返回顶部、下拉刷新/触底、微信分享，均属端内/平台差异）。

## §16 社区首页抽共享屏（2026-11-27，只落屏、未接线）

> 后续进展见 §17：RN 已完成接线，小程序已补齐同构区块；本节「未接线」的结论已被取代，保留为过程记录。

**做了什么**：新建 `packages/app/src/features/community-home/CommunityHomeScreen.tsx`，把小程序 `pages/community/index` 与 web `/community` 共有的七块结构收成一份纯 UI 共享屏：标题/副标题 + 帖子入口、搜索行（含语音/图搜两个提示入口）、运营轮播、分类胶囊（带 `icon`）、最近使用（空态文案）、我的智能体（空则整块隐藏）、智能体推荐（双列卡）。数据、登录、支付、跳转全部由宿主注入（与 `AgentMarketScreen` 同约）。

**契约**：`labels` 由宿主按自己的 i18n 命名空间翻译后传入（共享层不假设键名，避免把 web 的 `community.*` 键强推给 RN）；`colorScheme`、`keyword`、`onSearch`、各区块数组与 `onPress*` 回调均为 props。

**为什么只落屏不接线**：RN 的 `HomeMain`（首页/智汇AI位）目前是课程首页容器（`apps/mobile-rn/src/screens/HomeScreen.tsx`，115KB，内含 Drawer/TabBar/课程数据），把它换成社区首页等于换整个主 tab 的内容与数据面，且本机没有 `adb`/模拟器可验收 —— 盲改会同时动导航语义与首屏数据，风险高于收益。共享屏先就位，接线（宿主容器 + Drawer/TabBar 壳 + 五入口 IA）留作独立一步。

**验证**：`pnpm --filter @ihui/rn-app exec tsc --noEmit` 通过（exit 0）；未改任何 RN 端内文件，RN 侧零像素变化。至此 `/community` 与小程序社区页在信息架构和可见交互上无差异，剩余 5 块都不该在 web 复制：二维码属端内扫码场景、支付走 web 既有页、滚动/刷新/分享是容器能力。

## §17 社区首页三端接线与同构收口（2026-11-27）

**结论**：三端首屏已按同一信息架构与同一套视觉档位收口，一级导航仍是「AI应用商店 / 广场 / 智汇AI / 动态 / 我的」。RN 的 `HomeMain` 已由共享屏宿主替换，小程序补齐标题/搜索/分类/最近空态/双列推荐卡，web `/community` 复用同一份共享屏。搜索与分类筛选在 RN H5 实测可用；小程序在后台静默（微信开发者工具保持最小化，未置顶、未抢焦点）完成登录与截图验收。

**RN 端**

- 新增 `apps/mobile-rn/src/screens/CommunityMainScreen.tsx`（约 390 行），作为 `packages/app/src/features/community-home/CommunityHomeScreen.tsx` 的宿主：数据、翻译、路由全部在端内注入，壳沿用 `NavChrome + NavBar + Drawer + TabBar(activeTab="home")`。
- `RootNavigator.tsx` 只改两处：引入 `CommunityMainScreen`、把 `MainTabs` 的 `HomeMain` 组件从 `HomeScreen` 换成它。`CourseMain`、Drawer「课程」入口、RootStack `Home` 均保留，课程首页不丢。
- 共享屏本轮升级：搜索行改成「输入框 + 黑色圆形放大镜按钮」，分类胶囊支持选中态（黑底反白），推荐卡改为「封面区 + 头像 + 名称 + 2 行描述 + 免费/价格徽标」，`useWindowDimensions` 响应式 2 列（<700）／ 3 列（≥700），`free` label 改为可选以兼容既有 web 宿主。
- 卡片右列溢出修复：`flexBasis` 改 `width`，并给卡片、标题、描述补 `minWidth: 0` / `flexShrink: 1`，避免长中文标题的 min-content 把 41% 的卡撑到贴边。

**小程序端**

- `apps/miniapp-taro/src/pages/community/index.tsx` 按共享屏顺序重排：标题 + 副标题 +「帖子」按钮 → 搜索行 → 轮播 →「分类」标题 + 常驻胶囊 → 联系客服 → 最近使用（空态常驻）→ 智能体推荐（双列封面卡 + 更多）。
- 搜索行去掉 `InputArea` 的语音/图片/加号/发送一排控件，改为 `Input` + 圆形搜索按钮；`confirmType="search"` 支持键盘搜索，回车与点按钮同一条 `handleSearchSend`。
- 推荐区从单列 `AgentListPanel` 改为双列卡片：封面区（头像大图或 ✨ 占位）、名称、两行描述、免费/价格；月费智能体仍保留原 `handlePurchase` 支付弹窗路径。
- `FloatBox` 新增 `defaultOpen` prop，社区页传 `false`：赚米/客服/反馈三个悬浮按钮默认收起，只留右侧细箭头，不再压住智能体卡片。
- 后端相对素材路径统一经 `resolveCommunityAssetUrl` 拼到 Web 站点底座（与 RN `resolveWebAssetUrl` 同口径），轮播 `coverUrl` 与智能体 `avatar` 不再出现白块；本轮截图已能看到卡片头像正常加载。
- 删掉因移除「帖子」文字而变成死规则的 `.community-agent-list-posts` CSS；构建门 C8 死规则由 15 降到 12，`build:weapp` exit 0。

**验收证据**

| 端 | 通道 | 结果 |
|---|---|---|
| RN | Playwright H5，390×844，`--disable-web-security` | `innerWidth=390`、`scrollWidth=390`，推荐卡左 12 / 右 378，无横向溢出；标题/副标题/帖子/搜索/轮播/分类/最近空态/推荐九块齐全；分类与关键词筛选此前已实测生效 |
| 小程序 | 微信开发者工具 automator，后台 `miniProgram.screenshot` | 登录 token 333 字符；页面文本 50 条覆盖标题、副标题、帖子、5 张 banner 标题、分类、5 个胶囊、最近空态、推荐标题 + 12 张卡；滚动到 650 可见双列卡与头像；开发者工具全程最小化，未置顶 |
| Web | `/community` 复用共享屏 | 既有亮/暗截图仍有效；本轮共享屏字段与列宽改动对 web 向后兼容（`free` 可选、`minWidth` 只影响长标题收缩） |

截图归档：`docs/engineering/assets/community-miniapp-2026-11-27.png`（首屏）、`community-miniapp-grid-2026-11-27.png`（双列推荐）、`community-rn-h5-2026-11-27.png`（RN 首屏）、`community-web-light-2026-11-26.png` / `community-web-dark-2026-11-26.png`（web 既有）。

**仍未做（明确登记，不冒充已做）**

1. 小程序推荐卡的封面目前用 `avatar` 放大占位；小程序 API 层 `AgentRawRow` 还未透出后端已有的 `cover` 字段，等下一轮改 `apps/miniapp-taro/src/api/index.ts` 后可直接换成真封面。
2. 本地 `content/home` 的 5 条 banner `coverUrl` 全为空，所以三端都只显示标题 + 灰底；属内容数据，不是布局缺陷。
3. 小程序「联系客服」二维码弹窗、返回顶部、下拉刷新、微信分享仍按平台差异保留，不在 web/RN 复制。
4. RN 验收走 H5（本机无 adb/模拟器），真机 iOS/Android 的触感与 safe-area 未在本轮取证。
5. 小程序截图分辨率受开发者工具窗口最小化影响（224×448 档），信息架构与卡片结构可辨，像素级视觉请以 web/RN 截图为准。
6. 本轮的 `RootNavigator`、10 份 i18n 走 blob 模式落地，不携带工作树里其他并行任务的 `CommunityScreen` 路由与 `CirclePost` 类型改动。
