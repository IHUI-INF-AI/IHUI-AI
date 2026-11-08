<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# 跨端 UI 面缺陷普查报告（findings-crossui）

> 基线：`D:\IHUI-AI-cut10`（干净工作树，HEAD `d5f5581a`）。
> `git diff --stat 895027a9d6 HEAD -- apps/mobile-rn/src apps/miniapp-taro/src packages/app/src packages/shared/src` = 空，即范围内源码与 `origin/main` 尖端 `895027a9d6` 完全一致；全文行号对该基线有效。
> 纪律：全程只读，未改仓库、未提交、未 push；本文件是唯一写入物。
> 收敛判定：第 6 轮（rn-compat 全量导出交叉 + packages 公共包 exports 目标全量存在性）**零新增**，宣布收敛。

## 一、基线与方法

### 三端入口
| 端 | 入口 | 路由真值源 | 说明 |
|---|---|---|---|
| RN | `apps/mobile-rn/src/index.tsx` → `navigation/RootNavigator.tsx` | `packages/shared/src/constants/ui-routes.generated.ts`（349 条） | 未注册路由在 release 下静默 no-op |
| 小程序 | `apps/miniapp-taro/src/app.tsx` + `app.config.ts` | 同文件（329 条，与 app.config 页面数一致） | 另有 `rn-compat` 别名层承载 `packages/app` 共享屏 |
| Web | `apps/web/app/**` | 同文件（913 条） | Next.js App Router |

### 共享包导出面
`shared / app / api-client / types / ui-react / ui-native / design-tokens / auth / i18n / database`：`package.json` 的 `main/module/types` 与全部 `exports` 叶子路径 **Test-Path 全量通过，零缺失**。五个生成物（RN 349 / miniapp 329 / web 913 / extension 51 / rn-compat 别名表）的 `inputsSha256` 复算一致。

### 轮次
| 轮 | 面 | 新增 |
|---|---|---|
| 1 | 共享包导出/类型、RN 生命周期、小程序存储、三端业务漂移、输入/时间 | 27 |
| 2 | 支付链路、共享屏契约 | 14 |
| 3 | rn-compat 首扫 | 5 |
| 4 | rn-compat 二扫 + 导航/权限 | 6 |
| 5 | rn-compat 表驱动 + shared 余量 | 12 |
| 6 | rn-compat 全量导出交叉 + packages exports 存在性 | **0** |

---

## 二、已证实缺陷

### P0（会崩溃 / 资金与登录态错误）

#### XUI-001 Web 订单详情状态图标取值崩溃
- 严重度：P0
- 文件与行号：`apps/web/app/(main)/orders/[id]/PageClient.tsx:142-143`（`STATUS_CONFIG` 定义同文件上方，仅 4 键）
- 触发路径：打开任意 `status` 不在 4 值内的订单详情（如 `refunding`/`cancelled`/`completed` 之外的 7 值真值）
- 根因：本地 `OrderStatus` 只声明 4 值，`STATUS_CONFIG[order.status]` 返回 `undefined` 后直接取 `.icon`
- 证据：`const sc = STATUS_CONFIG[order.status]; const StatusIcon = sc.icon`
- 影响面：Web 订单详情白屏（整页 React 渲染抛错）
- 建议修法：改用 `packages/types` 的订单状态真值并给 `STATUS_CONFIG` 补齐 7 值 + 默认项
- 当场可修：是

#### XUI-002 订单详情响应未拆 `{order}` 包络（RN + 小程序）
- 严重度：P0
- 文件与行号：`apps/api/src/routes/order.ts:494`；`apps/mobile-rn/src/screens/OrderDetailScreen.tsx:52-58,78,114`；小程序同名屏（`apps/miniapp-taro/src/api/index.ts` 订单详情包装）
- 触发路径：进入订单详情
- 根因：后端 `success({ order })`，两端把 `res.data` 当订单本体
- 证据：`setOrder(res.data)`；`refundAmount: order.amount`；`amount: Math.round(order.amount * 100)`
- 影响面：详情字段全 `undefined`、退款金额计算 NaN、页面空态
- 建议修法：统一在 api-client 用 `unwrap('order')`，两端消费脱包结果
- 当场可修：是

#### XUI-003 会员信息未拆 `{vip}` 包络（RN + 小程序）
- 严重度：P0
- 文件与行号：`apps/api/src/routes/vip.ts:263-264`；`packages/api-client/src/endpoints/vip.ts:91-92`；`apps/mobile-rn/src/screens/VipScreen.tsx:103-109,264-274`；`apps/miniapp-taro/src/stores/vip.ts:65-72`
- 触发路径：进入会员中心 / 购买页
- 根因：后端返回 `{ vip }`，api-client 类型声明为裸 `MembershipInfo`，消费端按裸字段读
- 证据：`return reply.send(success({ vip }))` vs 类型 `Promise<ApiResponse<MembershipInfo>>`
- 影响面：会员等级、到期时间、权益全空；购买按钮状态错误
- 建议修法：类型与脱包同时修正，避免三端各自 `as any`
- 当场可修：是

#### XUI-004 RN 未登录分支缺注册路由（隐私/协议/换绑/改密）
- 严重度：P0
- 文件与行号：`apps/mobile-rn/src/navigation/RootNavigator.tsx:1400-1406`（未登录仅 Login/Register/ChatTools）vs `:1126-1127`（Privacy/Agreement）、`:1222`（ChangePhone）、`:1300`（ChangePwd，均在 token 分支）；`LoginScreen.tsx:852,858,878,944,1130,1140`；`RegisterScreen.tsx:126,129`
- 触发路径：未登录时点「隐私政策 / 用户协议 / 忘记密码 / 换手机号」
- 根因：路由只在已登录分支注册，`navigate('Privacy')` 落空
- 证据：未登录分支 Screen 列表缺失上述四屏
- 影响面：注册前无法查看协议（合规风险）、找回密码死路
- 建议修法：将 4 屏提到两分支共享注册；或按登录态条件渲染
- 当场可修：是

#### XUI-005 小程序 UserCard 读恒空存储键导致「请先登录」
- 严重度：P0
- 文件与行号：`apps/miniapp-taro/src/pages/user/components/UserCard.tsx:72-76`
- 触发路径：进入「我的」页
- 根因：`Taro.getStorageSync('data')`，全仓无任何写入 `'data'` 的代码（真实会话键为 `ihui-session-*`）
- 证据：`const userInfodata = Taro.getStorageSync('data')`，随后 `if (!userInfodata) return '请先登录'`
- 影响面：已登录用户始终看到未登录卡片，头像/昵称/等级全丢
- 建议修法：改读会话 store（或 `ihui_user_info`），并删除历史键依赖
- 当场可修：是

#### XUI-006 小程序清缓存保留键用旧命名 → 清缓存后静默自动登录
- 严重度：P0
- 文件与行号：`apps/miniapp-taro/src/pages/setting/cache.tsx:15,45-52`
- 触发路径：退出登录 → 设置 → 清除缓存 → 重新进入
- 根因：`KEEP_KEYS = ['ihui_token','ihui_refresh_token','ihui_user_info','lang','theme']` 用的是旧下划线键；实际会话键为连字符命名，且漏 `ihui-session-logged-out`
- 证据：保留列表与真实写入键不一致；清理时未写登出标记
- 影响面：退出登录失效，跨账号串号风险
- 建议修法：保留键从会话模块单一导出，清理时显式写 `logged-out` 标记
- 当场可修：是

#### XUI-007 RN 支付结果页读错包络 → 永远「支付失败」
- 严重度：P0
- 文件与行号：`apps/mobile-rn/src/screens/PayResultScreen.tsx:50-59`；`apps/api/src/routes/user/payment-routes.ts:102`
- 触发路径：微信/余额支付完成 → 结果页
- 根因：后端 `success({ order })`，页面读 `res.data.status` / `res.data.amount`
- 证据：`setAmount(res.data.amount ?? 0)`；`status` 取不到即映射 `failed`
- 影响面：真实付款成功却展示失败、金额 0，用户重复支付
- 建议修法：脱包 `order` 后取 `order.status/order.amount`；补单次幂等提示
- 当场可修：是

#### XUI-008 RN 微信支付 mock 分支客户端直通成功
- 严重度：P0
- 文件与行号：`apps/mobile-rn/src/hooks/useWechatPayment.ts:98-103`
- 触发路径：后端未配置商户号（返回 `mock:true`）时发起支付
- 根因：`if (payRes.data.mock) { await onSuccess?.(payRes.data.outTradeNo); return }`，不回调后端验单
- 证据：mock 分支直接调用成功回调并返回
- 影响面：未真实支付即发放权益/订单置为已付
- 建议修法：mock 仅限开发环境且必须走同一「服务端确认」接口
- 当场可修：是

#### XUI-009 小程序充值未返回 payParams + orderType 默认 0
- 严重度：P0
- 文件与行号：`apps/miniapp-taro/src/pages/.../recharge/index.tsx:97-112`；`src/.../recharge-props.ts:10,67-74`
- 触发路径：充值页点支付
- 根因：后端返回扁平平签名，页面取 `res.payParams`（不存在）→ 不调 `requestPayment`；且 `orderType` 缺省 0，代币不入账
- 证据：`const p = res.payParams` 恒 `undefined`；`orderType ?? 0`
- 影响面：充值无响应或付款后不到账
- 建议修法：按后端契约取签名参数；`orderType` 由商品类型必填推导
- 当场可修：是

#### XUI-010 RN 首页 `Easing.sin` 缺失 → 启动崩溃
- 严重度：P0
- 文件与行号：`apps/mobile-rn/src/screens/HomeScreen.tsx:659,665`；`apps/miniapp-taro/src/rn-compat/apis.ts:187-197`
- 触发路径：小程序端进入首页（走 rn-compat 的共享屏）
- 根因：`Easing` 只实现 `linear/ease/quad/cubic/in/out/inOut/bezier`，无 `sin`
- 证据：`Easing.inOut(Easing.sin)`，`Easing.sin` 为 `undefined`
- 影响面：首页渲染 TypeError，白屏
- 建议修法：补 `sin`（及 `exp/circle` 等常用成员）或降级到 `ease`
- 当场可修：是

#### XUI-011 RN 导航 ref 工厂在小程序垫片缺失 → 模块初始化崩溃
- 严重度：P0
- 文件与行号：`apps/mobile-rn/src/navigation/navigation-ref.ts:5,14`；`apps/miniapp-taro/src/rn-compat/`（`@react-navigation/native` 别名）
- 触发路径：小程序加载任何引用该 ref 的页面
- 根因：`createNavigationContainerRef` 未导出，模块顶层调用即 TypeError
- 证据：`import { createNavigationContainerRef }` 后在模块级执行
- 影响面：整包启动失败（非单页）
- 建议修法：垫片补实现（返回带 `current/getCurrentRoutes/navigate` 的对象）
- 当场可修：是

#### XUI-012 RN 登录页命名导入 `WebView`，垫片只有默认导出
- 严重度：P0
- 文件与行号：`apps/mobile-rn/src/screens/LoginScreen.tsx:31,1274`；`apps/miniapp-taro/src/rn-compat/native-webview.tsx:23-52`
- 触发路径：第三方登录/协议页打开 webview
- 根因：`import { WebView } from 'react-native-webview'`，垫片仅 `export default`
- 证据：`<WebView ... />` 拿到 `undefined`
- 影响面：渲染抛错（Element type is invalid）
- 建议修法：垫片补命名导出 `export const WebView = ...`（同时保留 default）
- 当场可修：是

#### XUI-013 rn-compat 的 Clipboard 默认导出形状与消费方不符
- 严重度：P0
- 文件与行号：`apps/miniapp-taro/src/rn-compat/platform.tsx:21-36,403-411`
- 触发路径：共享屏 `import Clipboard from 'expo-clipboard'` 后调用 `Clipboard.setStringAsync`
- 根因：默认导出是包袋 `{Clipboard, ImagePicker, MediaLibrary, SafeAreaView, ...}`，方法挂在 `default.Clipboard` 上
- 证据：`Clipboard.setStringAsync` 为 `undefined`
- 影响面：复制类操作全静默失败/抛错
- 建议修法：默认导出改为 Clipboard 本体，其余成员走命名导出
- 当场可修：是

#### XUI-014 RN 提现页分/元混用
- 严重度：P0
- 文件与行号：`apps/mobile-rn/src/screens/WithdrawScreen.tsx:41,55`（对照 `WalletScreen.tsx:88-91`）
- 触发路径：进入提现 → 输入金额 → 提交
- 根因：`balance` 来自后端分单位，直接按元展示；提交 `Math.round(num)` 未乘 100
- 证据：`setBalance(res.data.balance)`；`amount: Math.round(num)`
- 影响面：余额显示放大 100 倍；实提金额缩小 100 倍（资金错误）
- 建议修法：统一分单位，展示时 `formatPrice`，提交时 `Math.round(yuan*100)`
- 当场可修：是

### P1（功能静默失效 / 状态错乱）

#### XUI-015 小程序注销账号路径多一段 `/index`
- 严重度：P1
- 文件与行号：`apps/miniapp-taro/src/pages/setting/index.tsx:43` vs `app.config.ts` 子包页面
- 触发路径：设置 → 注销账号
- 根因：`'/pkg-user/account-cancel/index/index'`，实际页面为 `account-cancel/index`
- 证据：路径与实际注册页不一致
- 影响面：跳转失败，注销入口不可用
- 建议修法：改路径或从生成路由表取值
- 当场可修：是

#### XUI-016 小程序退款页 `order.amount` 未定义
- 严重度：P1
- 文件与行号：`apps/miniapp-taro/src/pages/.../refund.tsx:83,171`
- 触发路径：订单详情 → 申请退款
- 根因：订单对象来自列表/详情且字段名不同，`order.amount` 不存在
- 证据：`order.amount.toFixed(2)`；提交体缺 `refundAmount` → 后端 400
- 影响面：退款页崩溃或必失败
- 建议修法：金额取自订单真值字段并做兜底校验
- 当场可修：是

#### XUI-017 小程序关于页菜单项传对象、全部开 portal
- 严重度：P1
- 文件与行号：`apps/miniapp-taro/src/pkg-about/about-shared/index.tsx:51-55`
- 触发路径：关于页点任意条目
- 根因：`label: t(\`about.${id}\`)` 未求值就传对象；`onPress: onOpenPortal` 对所有条目同一处理
- 证据：对象进渲染层 → 打印原始 key；所有条目同跳转
- 影响面：文案显示 `about.xxx`，条目功能全错
- 建议修法：`label` 立即求值；按 id 分派目标
- 当场可修：是

#### XUI-018 小程序三个入口指向已删除 `/pages/tools/*`
- 严重度：P1
- 文件与行号：`apps/miniapp-taro/src/pages/community/components/MyAgents.tsx:41-45,49-54`；`RecentAgents.tsx:37-50`；`pages/community/index.tsx:463-466`
- 触发路径：社区页「我的智能体 / 最近使用」
- 根因：仍拼 `/pages/tools/ai_assistant(_n8n)`，该路由在 app.config 中已不存在
- 证据：目标字符串与页面注册表不符（现行路径为 `pkg-ai` 子包）
- 影响面：跳转失败或白页
- 建议修法：从 ui-routes 生成表取目标
- 当场可修：是

#### XUI-019 RN 注销二次确认闸门未复位 → 二次点击直接注销
- 严重度：P1
- 文件与行号：`apps/mobile-rn/src/screens/AccountCancelScreen.tsx:45-54`
- 触发路径：打开注销页 → 点确认 → 弹窗自动关闭 → 再次点击
- 根因：自动关闭时未重置 `confirmGateRef`
- 证据：闸门 ref 只在部分分支复位
- 影响面：无二次确认直接注销账号
- 建议修法：关闭/取消路径统一复位
- 当场可修：是

#### XUI-020 RN 修改密码无异常兜底 → 按钮永久 loading
- 严重度：P1
- 文件与行号：`apps/mobile-rn/src/screens/SettingsScreen.tsx:237-240`；共享屏 `packages/app/src/features/.../ChangePwdScreen.tsx`
- 触发路径：修改密码请求失败（网络/校验）
- 根因：无 try/catch 与 finally
- 证据：`onChangePassword` 直接 await；共享屏 `changingPwd` 未复位
- 影响面：按钮卡死，只能杀进程
- 建议修法：try/finally 复位状态并 toast
- 当场可修：是

#### XUI-021 小程序分销字段映射错位
- 严重度：P1
- 文件与行号：`apps/api/src/routes/distribution.ts:89-95`；`apps/miniapp-taro/src/api/index.ts:1103-1107`
- 触发路径：分销中心
- 根因：把 `pendingCommission` 当 `available`，`level`/`teamCount` 硬编码 0
- 证据：`level: 0, available: res.pendingCommission, teamCount: 0`
- 影响面：可提现金额虚高（不可提部分被当可提），等级/团队数恒 0
- 建议修法：按后端字段名一一映射
- 当场可修：是

#### XUI-022 共享通知 store 无限更新环
- 严重度：P1
- 文件与行号：`packages/shared/src/notifications/notification-store.tsx:190-195,225`
- 触发路径：收到第一条 WS 通知后
- 根因：`addFromWs` 每次渲染重建、context value 每次重建、无 id 去重
- 证据：effect 依赖 context 函数 → setState → 重渲染 → 再订阅
- 影响面：CPU 打满、通知列表抖动
- 建议修法：`useCallback` + id 去重 + `useMemo` context
- 当场可修：是

#### XUI-023 `use-agent-runtime` 过期 abort 清掉新控制器
- 严重度：P1
- 文件与行号：`packages/shared/src/hooks/use-agent-runtime.ts:76-84`
- 触发路径：快速重发/切换会话
- 根因：旧流的 catch/finally 无条件清空 `controllerRef` 与状态
- 证据：无 generation/epoch 判定
- 影响面：新请求被误判为已结束，流式中断
- 建议修法：每次启动自增 epoch，回调比对
- 当场可修：是

#### XUI-024 `use-articles` 依赖环 → loadMore 立即回第 1 页
- 严重度：P1
- 文件与行号：`packages/shared/src/hooks/use-articles.ts:146,162,215`
- 触发路径：文章列表下拉加载更多
- 根因：effect 依赖 `load`，而 `load` 闭包含 `page`
- 证据：`loadMore` 触发 page 变化 → 依赖变化 → effect 重置
- 影响面：永远只能看到第一页
- 建议修法：拆 `loadPage` 与 `refresh`，依赖去 page
- 当场可修：是

#### XUI-025 `use-load-more` 无 finally → 失败后锁死
- 严重度：P1
- 文件与行号：`packages/shared/src/hooks/use-load-more.ts:10-16`
- 触发路径：加载更多请求 reject
- 根因：`loadingRef` 只在成功路径复位
- 证据：无 try/finally
- 影响面：列表永久无法再加载
- 建议修法：try/finally
- 当场可修：是

#### XUI-026 WS 通知 id 用 `Date.now()` 兜底 → 冲突
- 严重度：P1
- 文件与行号：`packages/shared/src/notifications/ws-notification-adapter.ts:55-56`
- 触发路径：同毫秒到达两条无 id 通知
- 根因：`` id: str(data.id) ?? `${Date.now()}` ``；`type` 未转字符串
- 证据：同毫秒相同 id → 去重/更新错乱
- 影响面：通知被覆盖或丢条
- 建议修法：UUID/自增序号兜底，`type` 显式 `str`
- 当场可修：是

#### XUI-027 SSE 408 被归为契约不匹配（终态）
- 严重度：P1
- 文件与行号：`packages/shared/src/sse/contract.ts:1449-1460`
- 触发路径：服务端返回 408/425
- 根因：分类表只显式处理 5xx/429，408 落入 `contract_mismatch`
- 证据：`contract_mismatch` 为终态，不再重试
- 影响面：弱网超时被当致命错误，流不重连
- 建议修法：408/425 归 `transient`
- 当场可修：是

#### XUI-028 权限判定 fail-open 跨用户放行
- 严重度：P1
- 文件与行号：`packages/shared/src/permission/rules.ts:892,909-911`
- 触发路径：A 用户的 agent 记录被 B 用户校验
- 根因：`(h.agentId ?? principal) === principal`，`agentId` 缺省时等于 `principal` 恒真
- 证据：缺 agentId 的历史记录自动归属当前人
- 影响面：越权自动批准
- 建议修法：缺 `agentId` 一律拒绝或按显式 owner 字段
- 当场可修：是

#### XUI-029 `plan-store` 水合失败后仍置 hydrated → 覆盖磁盘
- 严重度：P1
- 文件与行号：`packages/app/src/features/plan/plan-store-core.ts:138-159`
- 触发路径：首启读盘抛错（JSON 损坏/配额）
- 根因：catch 吞异常，`finally hydrated = true`
- 证据：下次 persist 以空状态写回
- 影响面：用户计划数据被清空
- 建议修法：失败时保持 `hydrated=false` 且不落盘
- 当场可修：是

#### XUI-030 产物页小时数恒 0
- 严重度：P1
- 文件与行号：`packages/app/src/features/artifacts/ArtifactsScreen.tsx:63`
- 触发路径：产物列表显示「x 小时前」
- 根因：小时分支 `Math.floor(diff / 86_400_000)`（应为 `3_600_000`）
- 证据：`diff` 单位为毫秒
- 影响面：时间文案全错
- 建议修法：改除数
- 当场可修：是

#### XUI-031 SSE frame-ownership 单溢出槽 + 全局清空 → 丢帧
- 严重度：P1
- 文件与行号：`packages/shared/src/sse/frame-ownership-barrier.ts:163-181,218-228`
- 触发路径：多订阅并发背压
- 根因：只有一个 `overflow` 槽，`clearStaged()` 作用于全局
- 证据：一个订阅溢出清掉其它订阅已暂存帧
- 影响面：消息静默丢失
- 建议修法：按订阅分槽，清理限定作用域
- 当场可修：是

#### XUI-032 `use-paginated-list` 用 state 作锁 → 重复页
- 严重度：P1
- 文件与行号：`packages/shared/src/hooks/use-paginated-list.ts:56-75,90-93`
- 触发路径：快速连续触发加载
- 根因：锁基于 state（异步），无 `requestSeq`、无 finally
- 证据：两次并发读到相同 page
- 影响面：重复数据、spinner 卡死
- 建议修法：ref 锁 + 序号丢弃过期响应 + finally
- 当场可修：是

#### XUI-033 历史投影：新方向边界把 `olderCursor` 置空
- 严重度：P1
- 文件与行号：`packages/shared/src/chat/history-projection.ts:343-352,545-551`
- 触发路径：双向翻页对话
- 根因：较新方向的边界事件覆盖了较老游标
- 证据：`olderCursor = null`
- 影响面：历史无法继续上翻
- 建议修法：游标按方向独立存储
- 当场可修：是

#### XUI-034 `redact` 未保护 `decodeURIComponent` → URIError
- 严重度：P1
- 文件与行号：`packages/shared/src/utils/redact.ts:224`
- 触发路径：URL query 含裸 `%`
- 根因：直接 `decodeURIComponent(key)`
- 证据：畸形 `%` 抛 URIError，整条日志落盘失败
- 影响面：日志/脱敏链路中断
- 建议修法：try/catch 回退原串
- 当场可修：是

#### XUI-035 退款/提现状态机 RETRY 无上限、errorMessage 不清
- 严重度：P1
- 文件与行号：`packages/shared/src/workflows/refund-machine.ts`、`withdrawal-machine.ts`
- 触发路径：连续失败重试
- 根因：RETRY 自旋无最大次数；成功后 `errorMessage` 未清
- 证据：状态机转换表无计数守卫
- 影响面：死循环重试、成功后仍显示错误
- 建议修法：最大重试次数 + 成功清错
- 当场可修：是

#### XUI-036 `formatPhone` / `formatAmount` 边界错误
- 严重度：P1
- 文件与行号：`packages/shared/src/utils/format.ts:19-21,36-38,72-76`
- 触发路径：`+86` / 带分隔符手机号；空串金额
- 根因：正则只认 11 位纯数字；`'' → 0.00`
- 证据：返回原串或错误展示 0
- 影响面：三端手机号/金额展示不一致
- 建议修法：归一化后格式化；空值返回 `--`
- 当场可修：是

#### XUI-037 小程序保存相册无 hideLoading
- 严重度：P1
- 文件与行号：`apps/miniapp-taro/src/utils/save-album.ts:44-55`
- 触发路径：保存图片成功
- 根因：成功分支未 `hideLoading`
- 证据：仅失败分支关闭
- 影响面：loading 常驻遮罩
- 建议修法：finally 关闭
- 当场可修：是

#### XUI-038 小程序会员支付确认只弹成功
- 严重度：P1
- 文件与行号：`apps/miniapp-taro/src/pages/.../vip/index.tsx:263-266`
- 触发路径：选择支付方式并确认
- 根因：`onPayMethodConfirm` 未发起支付，仅打开成功态
- 证据：回调内无 `requestPayment`
- 影响面：会员未购买即显示成功
- 建议修法：接支付流程后再置成功
- 当场可修：是

#### XUI-039 小程序支付成功页用本地 paid 标记
- 严重度：P1
- 文件与行号：`apps/miniapp-taro/src/pages/.../success.tsx:48-54,101`
- 触发路径：从任意入口带 paid 标记进入
- 根因：以本地 `VIP_PAID_STATUS_KEY` 判断，不查服务端
- 证据：标记由客户端写、客户端读
- 影响面：伪造成功、重复领权益
- 建议修法：以服务端订单状态为准
- 当场可修：是

#### XUI-042 小程序订单列表标题/时间缺失、`completed` 页签永不命中
- 严重度：P1
- 文件与行号：`apps/miniapp-taro/src/pages/.../orders.tsx:63,66`
- 触发路径：订单列表各页签
- 根因：字段名与后端不一致（`title/createTime`），状态枚举用 `completed` 而真值为 `completed`/`finished` 不一致
- 证据：列表项显示空标题与 `undefined`
- 影响面：列表不可用、页签空
- 建议修法：字段与枚举统一到 types 真值
- 当场可修：是

#### XUI-043 小程序换手机号：旧验证码只校验长度不提交
- 严重度：P1
- 文件与行号：`apps/miniapp-taro/src/pages/.../phone.tsx:175-185`
- 触发路径：更换手机号
- 根因：旧号验证码仅做长度判断，请求体未带
- 证据：请求参数缺 `oldCode`
- 影响面：后端校验失败或绕过校验
- 建议修法：随请求提交并等待服务端校验
- 当场可修：是

#### XUI-044 小程序 webview 页 reLaunch 定时器未清理
- 严重度：P1
- 文件与行号：`apps/miniapp-taro/src/pages/webview/index.tsx:134`
- 触发路径：进入 webview 后返回/切页
- 根因：`setTimeout(() => reLaunch(...), 600)` 未保存 id、未在卸载时 clear
- 证据：卸载后仍执行 reLaunch
- 影响面：页面栈被强行重置、跳回首页
- 建议修法：卸载清 timer；或改用回调驱动
- 当场可修：是

#### XUI-045 RN 分享页把本地 file:// 当文本分享
- 严重度：P1
- 文件与行号：`apps/mobile-rn/src/screens/ShareScreen.tsx:217-222`
- 触发路径：分享图片/文件
- 根因：仅调用文本分享，传 `file://` URI
- 证据：无文件分享通道
- 影响面：对方收到不可用的本地路径
- 建议修法：走系统文件分享/上传后分享链接
- 当场可修：是

#### XUI-046 RN 直播主播页无 teardown、观众数随机
- 严重度：P1
- 文件与行号：`apps/mobile-rn/src/screens/LiveHostScreen.tsx:67-74,105-145`
- 触发路径：开播 → 返回/切后台
- 根因：未在卸载/AppState 变化时停止流；观众数用随机数
- 证据：无 cleanup；`Math.random()` 生成人数
- 影响面：后台仍占用摄像头/流量；数据造假
- 建议修法：卸载与后台停流；人数取服务端
- 当场可修：是

#### XUI-047 RN 分销提现重复提交窗口
- 严重度：P1
- 文件与行号：`apps/mobile-rn/src/screens/DistributionScreen.tsx:263-308`
- 触发路径：点提现 → 实名校验耗时期间再次点击
- 根因：`setWithdrawing(true)` 在 await 实名检查之后
- 证据：锁设置晚于异步边界
- 影响面：重复提现请求
- 建议修法：入口即刻置锁
- 当场可修：是

#### XUI-048 RN 录音 hook 卸载未清计时器
- 严重度：P1
- 文件与行号：`apps/mobile-rn/src/hooks/use-voice-recorder.ts:101-109,232-245`
- 触发路径：录音中返回/卸载
- 根因：cleanup 只 `recorder.stop()`，无 `clearInterval`、无 epoch
- 证据：计时器继续 tick 并 setState
- 影响面：卸载后回调、内存泄漏
- 建议修法：清 timer + epoch 丢弃过期回调
- 当场可修：是

### P2（局部错误 / 体验与一致性问题）

#### XUI-049 登录态下重新登录仍停留在登录页
- 严重度：P2
- 文件与行号：`apps/mobile-rn/src/navigation/auth-arrival.ts:27`；`LoginScreen.tsx:372-379`
- 触发路径：已登录状态进入登录页完成登录
- 根因：`if (args.hadToken || !args.hasToken) return 'none'`，`if (!target) return`
- 证据：目标为空即直接返回
- 影响面：登录后无跳转
- 建议修法：登录成功一律进入首页
- 当场可修：是

#### XUI-050 rn-compat 图片选择权限硬编码 granted
- 严重度：P2
- 文件与行号：`apps/miniapp-taro/src/rn-compat/platform.tsx:110-145`
- 触发路径：共享屏请求相册权限
- 根因：`requestMediaLibraryPermissionsAsync` 恒返回 `{granted:true,status:'granted'}`
- 证据：无 Taro 授权调用
- 影响面：无权限时静默失败且无法引导
- 建议修法：接 `Taro.authorize/getSetting`
- 当场可修：是

#### XUI-051 rn-compat 缺 `MediaTypeOptions`
- 严重度：P2
- 文件与行号：`apps/miniapp-taro/src/rn-compat/platform.tsx:110-145`
- 触发路径：`ImagePicker.MediaTypeOptions.Images`
- 根因：只导出 `MediaType`
- 证据：消费方取 `undefined`
- 影响面：选择器类型参数失效
- 建议修法：补枚举别名
- 当场可修：是

#### XUI-052 rn-compat MediaLibrary 成员缺失/返回形状不符
- 严重度：P2
- 文件与行号：`apps/miniapp-taro/src/rn-compat/platform.tsx:147-158`
- 触发路径：保存图片到相册
- 根因：`createAssetAsync` 返回 void；无 `saveToLibraryAsync`
- 证据：消费方读 `asset.uri` → undefined
- 影响面：保存相册失败
- 建议修法：返回 `{uri,width,height}`；补 `saveToLibraryAsync`
- 当场可修：是

#### XUI-053 rn-compat 缺 `Linking.openSettings`
- 严重度：P2
- 文件与行号：`apps/miniapp-taro/src/rn-compat/apis.ts:91-101`；消费 `apps/mobile-rn/src/screens/AppPermissionScreen.tsx:27`、`ScanLoginScreen.tsx:98`、`EduAttendanceQrScreen.tsx:84`
- 触发路径：权限引导「去设置」
- 根因：垫片只有 `canOpenURL/openURL/addEventListener/getInitialURL`
- 证据：`Linking.openSettings` 为 undefined
- 影响面：引导按钮 TypeError
- 建议修法：补实现（跳小程序设置页/`Taro.openSetting`）
- 当场可修：是

#### XUI-054 rn-compat expo-file-system 成员缺口
- 严重度：P2
- 文件与行号：`apps/miniapp-taro/src/rn-compat/native-extras.ts`；消费 `apps/mobile-rn/src/lib/apk-update.ts:323,336,475`、`AigcPublishUpload.ts:24,52,54`、`multipart-download.ts:31,406`、`ranged-download.ts:37,376`
- 触发路径：下载/上传/更新
- 根因：缺 `cacheDirectory/createDownloadResumable/getContentUriAsync`、`File.createUploadTask/open`、`UploadType/FileMode`
- 证据：成员为 undefined
- 影响面：下载更新链路不可用
- 建议修法：补齐或显式降级并在 UI 提示
- 当场可修：是

#### XUI-055 rn-compat 多选数量只看 selectionLimit
- 严重度：P2
- 文件与行号：`apps/miniapp-taro/src/rn-compat/platform.tsx:110-145`
- 触发路径：`allowsMultipleSelection` 但未给 `selectionLimit`
- 根因：count 仅取 `selectionLimit`
- 证据：多选退化为单选
- 影响面：批量选图受限
- 建议修法：多选时给默认上限
- 当场可修：是

#### XUI-056 rn-compat 不支持对象形 `navigate`
- 严重度：P2
- 文件与行号：`apps/mobile-rn/src/screens/NoteListScreen.tsx:55`；垫片导航实现
- 触发路径：`navigation.navigate({ name: 'NoteCreate' })`
- 根因：垫片只认字符串+参数
- 证据：对象形被当字符串，路由名 `[object Object]`
- 影响面：跳转失败
- 建议修法：垫片兼容对象形
- 当场可修：是

#### XUI-057 小程序语音识别重复 `configure` 方法
- 严重度：P2
- 文件与行号：`apps/miniapp-taro/src/utils/streaming-recognizer.ts:72-76,93-102`
- 触发路径：编译期（TS2393）
- 根因：同一类内定义两次 `configure`
- 证据：重复成员
- 影响面：类型检查红、后者覆盖前者
- 建议修法：合并为一
- 当场可修：是

#### XUI-058 `order.pay` 文案缺失 + RN 智能体价格按分重复缩放
- 严重度：P2
- 文件与行号：`packages/app/src/features/order/OrderScreen.tsx:188,190`；`apps/mobile-rn/src/screens/MyAgentsScreen.tsx:50`
- 触发路径：订单页/智能体列表
- 根因：i18n key 不存在；`formatPrice(a.price)` 对已是元的字段再除 100
- 证据：界面显示 `order.pay` 原文 / 价格缩小 100 倍
- 影响面：文案与金额错
- 建议修法：补 key；明确单位
- 当场可修：是

#### XUI-059 RN 端 artifacts 系列 i18n key 缺失
- 严重度：P2
- 文件与行号：`apps/mobile-rn/src/screens/ArtifactsScreen.tsx`（15+ 处 key）
- 触发路径：产物页各标签
- 根因：RN 语言包未同步新增 key
- 证据：渲染出 key 原文
- 影响面：界面中英混杂
- 建议修法：同步语言包
- 当场可修：是

#### XUI-060 `login.platformLinuxdo` 缺失
- 严重度：P2
- 文件与行号：`apps/mobile-rn/src/screens/LoginScreen.tsx:278-282`
- 触发路径：第三方登录区
- 根因：key 未定义
- 证据：显示原始 key
- 影响面：文案破损
- 建议修法：补 key
- 当场可修：是

#### XUI-061 模块级 `Intl` 实例冻结时区
- 严重度：P2
- 文件与行号：`apps/mobile-rn/src/screens/MemoryScreen.tsx:103`；`quick-notes-styles.ts:14`；`letter-time.ts:9`；`withdrawal-props.ts:12`
- 触发路径：用户切换时区/语言后
- 根因：模块加载时创建 formatter，参数固化
- 证据：跨时区展示不更新
- 影响面：时间显示错误
- 建议修法：按需创建或缓存带 key
- 当场可修：是

#### XUI-062 相对时间 ja/ko 回退英文
- 严重度：P2
- 文件与行号：`packages/shared/src/utils/date-utils.ts:165-192`
- 触发路径：日/韩语环境
- 根因：仅 zh/en 分支，其余走英文兜底
- 证据：返回英文短语
- 影响面：本地化缺失
- 建议修法：补 ja/ko 或走 Intl.RelativeTimeFormat
- 当场可修：是

#### XUI-063 小程序 i18n key 漂移
- 严重度：P2
- 文件与行号：`apps/miniapp-taro/src/pages/plaza/*`（`plaza.index.search` vs `navSearch`）；`wallet/*`（`wallet.recharge.title` vs `wallet.title`）
- 触发路径：广场搜索、钱包充值
- 根因：页面 key 与语言包键名不一致
- 证据：显示原文 key
- 影响面：文案缺失
- 建议修法：统一 key 命名
- 当场可修：是

#### XUI-064 AppTopup 屏未接 `texts`
- 严重度：P2
- 文件与行号：`apps/mobile-rn/src/screens/AppTopupScreen.tsx:113-132`
- 触发路径：应用内充值
- 根因：共享屏契约要求 `texts`，容器未传
- 证据：文案空/默认
- 影响面：界面空缺
- 建议修法：传入完整 texts
- 当场可修：是

#### XUI-065 token 数值格式化两端分歧
- 严重度：P2
- 文件与行号：`packages/shared/src/utils/format.ts:83-90` vs `apps/miniapp-taro/src/pages/user/components/UserInfoCard.tsx:114-119`
- 触发路径：余额/代币展示
- 根因：统一格式化与本地格式化两套规则（小数位/千分位）
- 证据：同值不同展示
- 影响面：三端数字不一致
- 建议修法：收敛到共享函数
- 当场可修：是

#### XUI-066 小程序镜像屏以空串掩盖错误
- 严重度：P2
- 文件与行号：`apps/miniapp-taro/src/pkg-*/**` 传 `error=""` 的壳；共享屏 `HelpScreen.tsx`、`CategoryDetailScreen.tsx:23,73,88,110,114`
- 触发路径：接口失败
- 根因：壳把错误态写死为空
- 证据：失败时仍显示空态而非错误
- 影响面：用户无法感知失败、无法重试
- 建议修法：透传真实错误
- 当场可修：是

#### XUI-067 帮助页「返回」实为重试
- 严重度：P2
- 文件与行号：`packages/app/src/features/help/CategoryDetailScreen.tsx:110-114`
- 触发路径：分类详情加载失败
- 根因：错误态按钮文案「返回」绑定重试
- 证据：label 与 handler 不符
- 影响面：用户误操作
- 建议修法：文案/行为对齐
- 当场可修：是

#### XUI-068 改密屏「忘记密码」在 RN 为死路
- 严重度：P2
- 文件与行号：`packages/app/src/features/.../ChangePwdScreen.tsx:27,108-117`
- 触发路径：RN 端点击忘记密码
- 根因：该路由仅在未登录分支缺失（见 XUI-004），点击无响应
- 证据：目标路由未注册
- 影响面：找回密码不可用
- 建议修法：与 XUI-004 一并修
- 当场可修：是

#### XUI-069 RN 设备列表请求竞态
- 严重度：P2
- 文件与行号：`apps/mobile-rn/src/screens/DevicesScreen.tsx:182-198,217-235`；`DistributionOrderListScreen.tsx`
- 触发路径：快速切页/刷新
- 根因：无 requestSeq，旧响应覆盖新状态
- 证据：后到旧数据覆盖
- 影响面：列表回跳
- 建议修法：序号丢弃过期响应
- 当场可修：是

#### XUI-070 AiWorld / Purchase / AigcPublish 重复提交与卸载后回调
- 严重度：P2
- 文件与行号：`apps/mobile-rn/src/screens/AiWorldScreen.tsx:232-274`；`PurchaseScreen.tsx:159-186`；`AigcPublishScreen.tsx:83-101`
- 触发路径：慢网连点/返回
- 根因：锁晚置或缺失、无 mounted 守卫
- 证据：重复请求、卸载后 setState
- 影响面：重复下单、告警
- 建议修法：入口置锁 + mounted ref
- 当场可修：是

#### XUI-071 multipart 下载无界缓冲、进度回调在卸载后
- 严重度：P2
- 文件与行号：`apps/mobile-rn/src/lib/multipart-download.ts:237-248,438-444`
- 触发路径：大文件分段下载
- 根因：片段全量进内存；进度回调未判存活
- 证据：内存增长与卸载后回调
- 影响面：OOM / 告警
- 建议修法：流式落盘 + 取消令牌
- 当场可修：是

#### XUI-072 小程序课程详情成功与失败 toast 并存
- 严重度：P2
- 文件与行号：`apps/miniapp-taro/src/pkg-learn/course/detail.tsx:172-176`
- 触发路径：报名课程成功
- 根因：连续两次 toast
- 证据：成功提示后紧跟失败提示
- 影响面：误导用户
- 建议修法：单一出口
- 当场可修：是

#### XUI-073 小程序充值失败丢失 orderNo
- 严重度：P2
- 文件与行号：`apps/miniapp-taro/src/pages/.../recharge/index.tsx:117-127`
- 触发路径：下单成功但拉起支付失败
- 根因：catch 未保留 orderNo
- 证据：无法查单/重试
- 影响面：订单悬挂
- 建议修法：保留并展示订单号
- 当场可修：是

#### XUI-074 ToolApprovalSheet / ImageAnnotator 键盘与高度处理缺失
- 严重度：P2
- 文件与行号：`apps/mobile-rn/src/components/ai/ToolApprovalSheet.tsx:598-610`；`components/chat/ImageAnnotator.tsx:658,667`
- 触发路径：小屏 + 键盘弹出
- 根因：居中卡片无 `maxHeight`/无 ScrollView；`autoFocus` 输入行无 KAV
- 证据：内容溢出、输入框被键盘遮挡
- 影响面：按钮不可达、无法输入
- 建议修法：加 `maxHeight` + ScrollView/KAV
- 当场可修：是

---

## 三、未判定（证据不足，未计入结论）

| 编号 | 事项 | 缺什么 |
|---|---|---|
| U-1 | 小程序支付宝分支充值金额是否整体 ×100（仅观察到优惠券分支差异） | 需真机支付宝环境 + 服务端下单参数 |
| U-2 | 小程序 `pay/index.tsx` 金额单位（展示为 1/100 真实值，支付宝疑似 100 倍） | 需支付宝沙箱实测 |
| U-3 | 小程序权限硬编码 granted 是否会被 `wx.requirePrivacyAuthorize` 拦截 | 需微信隐私协议配置实测 |
| U-4 | LiveHost 观众数随机是否为 mock 设计（可能是有意的演示数据） | 需产品口径确认 |
| U-5 | 构建产物 `dist` 与 `src` 逐符号差异（本轮只验证 exports 叶子存在） | 需构建后比对，超出只读静态面 |
| U-6 | 小程序支付是否缺 `buyerId` 导致后端走 mock | 仅 `pkg-shop/vip/upgrade.tsx:117` 传了 `buyerId`，充值与普通支付路径未取证 |
| U-7 | 小程序提现「千分位字符串 → NaN」 | `pkg-shop/wallet/withdrawal/index.tsx:52` 为 `Number(amount)`，输入源是否被格式化未取证 |

## 四、已否证（误报，附复核依据）

| 编号 | 曾被怀疑 | 复核结论 |
|---|---|---|
| N-1 | RN 全仓无 `navigation.push` / 无 `Platform.select` | 否证：实际存在 `KnowledgeEntryReadingScreen.tsx:127-128`、`LettersScreen.tsx:96`、`ChatMessageList.tsx:230`、`ToolCallCard.tsx:73`、`ChatScreen.tsx:3952`、`AiAssistantN8nScreen.tsx:2395/2407/2414` |
| N-2 | `packages/*` 的 exports 目标文件缺失 | 否证：10 个包全量 `Test-Path` 通过，零缺失 |
| N-3 | 生成物 `inputsSha256` 与源码不符 | 否证：RN 349 / miniapp 329 / web 913 / extension 51 全部复算一致 |
| N-4 | 三端订单/退款状态机真值漂移 | 否证：真值源一致；Web 本地 `STATUS_CONFIG` 收缩才是问题（已列 XUI-001） |
| N-5 | rn-compat 缺 `Alert/Share/Keyboard/Animated/BackHandler/DeviceEventEmitter/InteractionManager/RefreshControl/KeyboardAvoidingView/NativeModules/useColorScheme` | 否证：均已在 `apis.ts`/`primitives.tsx`/`native-extras.ts` 导出 |

## 五、与 `PROJECT_PLAN.md` / `plan-fields.jsonl` 的去重

| 本报告 | 已有条目 | 关系 |
|---|---|---|
| XUI-001 | 无 | 新增 |
| XUI-003 | 无（VIP 包络在计划中无专条） | 新增 |
| XUI-008 | DBG-30（useWechatPayment 状态复查） | 邻近但不同：DBG-30 是支付后状态复查缺失，本条是 mock 分支客户端直通成功 |
| XUI-010 | 无 | 新增 |
| XUI-011 | 无 | 新增 |
| XUI-017 | 计划 3152 行（AboutScreen import 已派单收编） | 邻近但不同文件/问题：那条是 import 路径收编，本条是菜单项传对象 |
| XUI-007 | 计划 2791 行（PayResultScreen `‹` 矢量字符） | 邻近但不同：那条是图标字符，本条是响应包络 |
| XUI-031 | 计划 31690 行（frame-ownership 双实现登记） | 邻近但不同：那条是双实现事实，本条是单溢出槽行为缺陷 |
| 其余 | 无直接对应 | 新增 |

> `PaymentScreen` 的「去充值」i18n（计划 379/383 行）已确认修好，未重复上报。

## 六、收尾

- **新增条数**：72 条（P0 14 / P1 32 / P2 26）。
- **第 6 轮新增**：0 条 → 收敛。
- **覆盖清单**：三端入口与路由真值 · 共享包导出/types · 订单/会员/分销/退款/提现/充值/支付链 · RN 导航注册与登录态 · 小程序存储键与页面栈 · rn-compat 全量导出与消费交叉 · 共享 hook/状态机/SSE/通知/权限 · i18n 与共享屏契约 · 平台权限/键盘/SafeArea/后台切换 · 输入单位与时区。
- **仍可深挖的方向**：见「未判定」U-1..U-7；另建议补两条静态面：(a) `apps/extension` UI 面（本次扫描范围外）；(b) api-client `dist` 产物与 `src` 逐符号差异（需构建，非只读）。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
