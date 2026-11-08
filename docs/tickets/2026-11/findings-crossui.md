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
- 修复：`81c4ff1ffe`（fix(web): XUI-001 订单状态视图补全 7 值并对未知状态兜底）

#### XUI-002 订单详情响应未拆 `{order}` 包络（RN + 小程序）
- 严重度：P0
- 文件与行号：`apps/api/src/routes/order.ts:494`；`apps/mobile-rn/src/screens/OrderDetailScreen.tsx:52-58,78,114`；小程序同名屏（`apps/miniapp-taro/src/api/index.ts` 订单详情包装）
- 触发路径：进入订单详情
- 根因：后端 `success({ order })`，两端把 `res.data` 当订单本体
- 证据：`setOrder(res.data)`；`refundAmount: order.amount`；`amount: Math.round(order.amount * 100)`
- 影响面：详情字段全 `undefined`、退款金额计算 NaN、页面空态
- 建议修法：统一在 api-client 用 `unwrap('order')`，两端消费脱包结果
- 当场可修：是
- 修复：`5d668e9d2a`（fix(api): XUI-002 订单详情拆 {order} 包络并修正 RN 字段映射）

#### XUI-003 会员信息未拆 `{vip}` 包络（RN + 小程序）
- 严重度：P0
- 文件与行号：`apps/api/src/routes/vip.ts:263-264`；`packages/api-client/src/endpoints/vip.ts:91-92`；`apps/mobile-rn/src/screens/VipScreen.tsx:103-109,264-274`；`apps/miniapp-taro/src/stores/vip.ts:65-72`
- 触发路径：进入会员中心 / 购买页
- 根因：后端返回 `{ vip }`，api-client 类型声明为裸 `MembershipInfo`，消费端按裸字段读
- 证据：`return reply.send(success({ vip }))` vs 类型 `Promise<ApiResponse<MembershipInfo>>`
- 影响面：会员等级、到期时间、权益全空；购买按钮状态错误
- 建议修法：类型与脱包同时修正，避免三端各自 `as any`
- 当场可修：是
- 修复：`1576fe79aa`（fix(api): XUI-003 会员 /vip/my 拆 {vip} 包络并归一 user_vips 行）

#### XUI-004 RN 未登录分支缺注册路由（隐私/协议/换绑/改密）
- 严重度：P0
- 文件与行号：`apps/mobile-rn/src/navigation/RootNavigator.tsx:1400-1406`（未登录仅 Login/Register/ChatTools）vs `:1126-1127`（Privacy/Agreement）、`:1222`（ChangePhone）、`:1300`（ChangePwd，均在 token 分支）；`LoginScreen.tsx:852,858,878,944,1130,1140`；`RegisterScreen.tsx:126,129`
- 触发路径：未登录时点「隐私政策 / 用户协议 / 忘记密码 / 换手机号」
- 根因：路由只在已登录分支注册，`navigate('Privacy')` 落空
- 证据：未登录分支 Screen 列表缺失上述四屏
- 影响面：注册前无法查看协议（合规风险）、找回密码死路
- 建议修法：将 4 屏提到两分支共享注册；或按登录态条件渲染
- 当场可修：是
- 修复：`0ba309d2f7`（fix(mobile-rn): XUI-004 未登录分支补齐 Privacy/Agreement/ChangePhone/ChangePwd 四路由）

#### XUI-005 小程序 UserCard 读恒空存储键导致「请先登录」
- 严重度：P0
- 文件与行号：`apps/miniapp-taro/src/pages/user/components/UserCard.tsx:72-76`
- 触发路径：进入「我的」页
- 根因：`Taro.getStorageSync('data')`，全仓无任何写入 `'data'` 的代码（真实会话键为 `ihui-session-*`）
- 证据：`const userInfodata = Taro.getStorageSync('data')`，随后 `if (!userInfodata) return '请先登录'`
- 影响面：已登录用户始终看到未登录卡片，头像/昵称/等级全丢
- 建议修法：改读会话 store（或 `ihui_user_info`），并删除历史键依赖
- 当场可修：是
- 修复：`bf3d1e2bda`（fix(miniapp): XUI-005/006 登录态改用 getUserInfo 并让清缓存保留登出标记）

#### XUI-006 小程序清缓存保留键用旧命名 → 清缓存后静默自动登录
- 严重度：P0
- 文件与行号：`apps/miniapp-taro/src/pages/setting/cache.tsx:15,45-52`
- 触发路径：退出登录 → 设置 → 清除缓存 → 重新进入
- 根因：`KEEP_KEYS = ['ihui_token','ihui_refresh_token','ihui_user_info','lang','theme']` 用的是旧下划线键；实际会话键为连字符命名，且漏 `ihui-session-logged-out`
- 证据：保留列表与真实写入键不一致；清理时未写登出标记
- 影响面：退出登录失效，跨账号串号风险
- 建议修法：保留键从会话模块单一导出，清理时显式写 `logged-out` 标记
- 当场可修：是
- 修复：`bf3d1e2bda`（fix(miniapp): XUI-005/006 登录态改用 getUserInfo 并让清缓存保留登出标记）

#### XUI-007 RN 支付结果页读错包络 → 永远「支付失败」
- 严重度：P0
- 文件与行号：`apps/mobile-rn/src/screens/PayResultScreen.tsx:50-59`；`apps/api/src/routes/user/payment-routes.ts:102`
- 触发路径：微信/余额支付完成 → 结果页
- 根因：后端 `success({ order })`，页面读 `res.data.status` / `res.data.amount`
- 证据：`setAmount(res.data.amount ?? 0)`；`status` 取不到即映射 `failed`
- 影响面：真实付款成功却展示失败、金额 0，用户重复支付
- 建议修法：脱包 `order` 后取 `order.status/order.amount`；补单次幂等提示
- 当场可修：是
- 修复：`c024572376`（fix(payment): XUI-007/008 支付订单详情拆包络且 DEV mock 不再直通成功）

#### XUI-008 RN 微信支付 mock 分支客户端直通成功
- 严重度：P0
- 文件与行号：`apps/mobile-rn/src/hooks/useWechatPayment.ts:98-103`
- 触发路径：后端未配置商户号（返回 `mock:true`）时发起支付
- 根因：`if (payRes.data.mock) { await onSuccess?.(payRes.data.outTradeNo); return }`，不回调后端验单
- 证据：mock 分支直接调用成功回调并返回
- 影响面：未真实支付即发放权益/订单置为已付
- 建议修法：mock 仅限开发环境且必须走同一「服务端确认」接口
- 当场可修：是
- 修复：`c024572376`（fix(payment): XUI-007/008 支付订单详情拆包络且 DEV mock 不再直通成功）

#### XUI-009 小程序充值未返回 payParams + orderType 默认 0
- 严重度：P0
- 文件与行号：`apps/miniapp-taro/src/pages/.../recharge/index.tsx:97-112`；`src/.../recharge-props.ts:10,67-74`
- 触发路径：充值页点支付
- 根因：后端返回扁平平签名，页面取 `res.payParams`（不存在）→ 不调 `requestPayment`；且 `orderType` 缺省 0，代币不入账
- 证据：`const p = res.payParams` 恒 `undefined`；`orderType ?? 0`
- 影响面：充值无响应或付款后不到账
- 建议修法：按后端契约取签名参数；`orderType` 由商品类型必填推导
- 当场可修：是
- 修复：`eb3bff76f7`（fix(miniapp): XUI-009/010/013 充值签名与 orderType、Easing.sin、Clipboard 默认导出）

#### XUI-010 RN 首页 `Easing.sin` 缺失 → 启动崩溃
- 严重度：P0
- 文件与行号：`apps/mobile-rn/src/screens/HomeScreen.tsx:659,665`；`apps/miniapp-taro/src/rn-compat/apis.ts:187-197`
- 触发路径：小程序端进入首页（走 rn-compat 的共享屏）
- 根因：`Easing` 只实现 `linear/ease/quad/cubic/in/out/inOut/bezier`，无 `sin`
- 证据：`Easing.inOut(Easing.sin)`，`Easing.sin` 为 `undefined`
- 影响面：首页渲染 TypeError，白屏
- 建议修法：补 `sin`（及 `exp/circle` 等常用成员）或降级到 `ease`
- 当场可修：是
- 修复：`eb3bff76f7`（fix(miniapp): XUI-009/010/013 充值签名与 orderType、Easing.sin、Clipboard 默认导出）

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
- 修复：`eb3bff76f7`（fix(miniapp): XUI-009/010/013 充值签名与 orderType、Easing.sin、Clipboard 默认导出）

#### XUI-014 RN 提现页分/元混用
- 严重度：P0
- 文件与行号：`apps/mobile-rn/src/screens/WithdrawScreen.tsx:41,55`（对照 `WalletScreen.tsx:88-91`）
- 触发路径：进入提现 → 输入金额 → 提交
- 根因：`balance` 来自后端分单位，直接按元展示；提交 `Math.round(num)` 未乘 100
- 证据：`setBalance(res.data.balance)`；`amount: Math.round(num)`
- 影响面：余额显示放大 100 倍；实提金额缩小 100 倍（资金错误）
- 建议修法：统一分单位，展示时 `formatPrice`，提交时 `Math.round(yuan*100)`
- 当场可修：是
- 修复：`cfa074991d`（fix(mobile-rn): XUI-014 提现余额按分转元展示、提交金额按元转分）

### P0 复核否证（留痕，未改码）

#### XUI-011 否证：小程序闭包不可达 `createNavigationContainerRef`
- 复核结论：不成立，不改垫片。
- 依据 1：`createNavigationContainerRef` 唯一使用点是 `apps/mobile-rn/src/navigation/navigation-ref.ts:5,14`，属 RN 端私有源码。
- 依据 2：`grep -n "navigation-ref|createNavigationContainerRef" apps/miniapp-taro/src` 零命中；同二词在 `packages/app/src` 亦零命中 ⇒ 小程序别名层只消费 `packages/*` 共享屏，从不把 `apps/mobile-rn` 编进包。
- 依据 3：小程序 `rn-compat` 对 `@react-navigation/native` 的别名只服务共享屏；共享屏无该调用，模块初始化期不会执行到该 import。
- 处置：不改 `apps/miniapp-taro/src/rn-compat/*`。若未来把 RN 导航模块下沉进共享包，此条自动复活，需重开。
- 复核（2026-11-08）：`grep -rn "createNavigationContainerRef|navigation-ref" apps/miniapp-taro/src` 仍零命中；`packages/app/src` 零命中。维持否证。

#### XUI-012 否证：小程序端不会渲染命名导入 `WebView` 的 LoginScreen
- 复核结论：不成立，不改垫片命名导出。
- 依据 1：命名导入发生在 `apps/mobile-rn/src/screens/LoginScreen.tsx:31`，`<WebView>` 用法在同文件 `:1274`，属 RN 端私有屏。
- 依据 2：小程序 `app.config.ts:14-17` 明记 login/register/forgot-password/webview 四页中的 `login` 整页已删，`:316` 再次登记 `pages/login` 移除；现网页面注册表无登录页。
- 依据 3：`grep -n "react-native-webview|LoginScreen" apps/miniapp-taro/src` 只命中注释与本端 `<web-view>` 页面（`pages/webview/index.tsx:6`），无 `LoginScreen` 消费点；`packages/app` 亦无 `react-native-webview` 导入。
- 依据 4：`rn-compat/native-webview.tsx:23-52` 是页面级最小替代（链接复制），仅默认导出；因无消费方，命名导出缺失不构成可达崩溃。
- 处置：保持现状。若后续恢复小程序登录页并复用 RN LoginScreen，需同时补命名导出。
- 复核（2026-11-08）：`LoginScreen` / `react-native-webview` 在 `apps/miniapp-taro/src` 仅命中注释与 `pages/webview/index.tsx`；`app.config.ts` 仍无登录页注册。维持否证。

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
- 修复：`b5f1627643`（fix(miniapp/mobile-rn): XUI-015/037/044/048 注销路由、相册 loading、webview timer、录音卸载清理）

#### XUI-016 小程序退款页 `order.amount` 未定义
- 严重度：P1
- 文件与行号：`apps/miniapp-taro/src/pages/.../refund.tsx:83,171`
- 触发路径：订单详情 → 申请退款
- 根因：订单对象来自列表/详情且字段名不同，`order.amount` 不存在
- 证据：`order.amount.toFixed(2)`；提交体缺 `refundAmount` → 后端 400
- 影响面：退款页崩溃或必失败
- 建议修法：金额取自订单真值字段并做兜底校验
- 当场可修：是
- 修复：`7708c2c548`（fix(miniapp/mobile-rn): XUI-016/019/021 退款金额归一、注销闸门复位、分销字段映射）

#### XUI-017 小程序关于页菜单项传对象、全部开 portal
- 严重度：P1
- 文件与行号：`apps/miniapp-taro/src/pkg-about/about-shared/index.tsx:51-55`
- 触发路径：关于页点任意条目
- 根因：`label: t(\`about.${id}\`)` 未求值就传对象；`onPress: onOpenPortal` 对所有条目同一处理
- 证据：对象进渲染层 → 打印原始 key；所有条目同跳转
- 影响面：文案显示 `about.xxx`，条目功能全错
- 建议修法：`label` 立即求值；按 id 分派目标
- 当场可修：是
- 修复：`b776154139`（about-shared 改 `ABOUT_MENUS.map`，逐条 `navigateTo(menu.url)`，label 按 labelKey 取词；夹具 `about-entries-wiring.test.ts` 3 条，旧码实测红）

#### XUI-018 小程序三个入口指向已删除 `/pages/tools/*`
- 严重度：P1
- 文件与行号：`apps/miniapp-taro/src/pages/community/components/MyAgents.tsx:41-45,49-54`；`RecentAgents.tsx:37-50`；`pages/community/index.tsx:463-466`
- 触发路径：社区页「我的智能体 / 最近使用」
- 根因：仍拼 `/pages/tools/ai_assistant(_n8n)`，该路由在 app.config 中已不存在
- 证据：目标字符串与页面注册表不符（现行路径为 `pkg-ai` 子包）
- 影响面：跳转失败或白页
- 建议修法：从 ui-routes 生成表取目标
- 当场可修：是
- 修复：`b776154139`（三处入口迁 `/pkg-ai/ai-assistant/index`、`/pkg-ai/ai-assistant-n8n/index`、`/pkg-ai/ai-group/index`，与 app.config 注册表对齐；夹具 `community-agent-routes.test.ts` 6 条，旧码实测红）

#### XUI-019 RN 注销二次确认闸门未复位 → 二次点击直接注销
- 严重度：P1
- 文件与行号：`apps/mobile-rn/src/screens/AccountCancelScreen.tsx:45-54`
- 触发路径：打开注销页 → 点确认 → 弹窗自动关闭 → 再次点击
- 根因：自动关闭时未重置 `confirmGateRef`
- 证据：闸门 ref 只在部分分支复位
- 影响面：无二次确认直接注销账号
- 建议修法：关闭/取消路径统一复位
- 当场可修：是
- 修复：`7708c2c548`（fix(miniapp/mobile-rn): XUI-016/019/021 退款金额归一、注销闸门复位、分销字段映射）

#### XUI-020 RN 修改密码无异常兜底 → 按钮永久 loading
- 严重度：P1
- 文件与行号：`apps/mobile-rn/src/screens/SettingsScreen.tsx:237-240`；共享屏 `packages/app/src/features/.../ChangePwdScreen.tsx`
- 触发路径：修改密码请求失败（网络/校验）
- 根因：无 try/catch 与 finally
- 证据：`onChangePassword` 直接 await；共享屏 `changingPwd` 未复位
- 影响面：按钮卡死，只能杀进程
- 建议修法：try/finally 复位状态并 toast
- 当场可修：是
- 修复：`3bf0fc4dcb`（fix(shared/app/miniapp): XUI-020/034/036/042 改密失败复位、脱敏容错、手机号/金额边界、订单列表归一）

#### XUI-021 小程序分销字段映射错位
- 严重度：P1
- 文件与行号：`apps/api/src/routes/distribution.ts:89-95`；`apps/miniapp-taro/src/api/index.ts:1103-1107`
- 触发路径：分销中心
- 根因：把 `pendingCommission` 当 `available`，`level`/`teamCount` 硬编码 0
- 证据：`level: 0, available: res.pendingCommission, teamCount: 0`
- 影响面：可提现金额虚高（不可提部分被当可提），等级/团队数恒 0
- 建议修法：按后端字段名一一映射
- 当场可修：是
- 修复：`7708c2c548`（fix(miniapp/mobile-rn): XUI-016/019/021 退款金额归一、注销闸门复位、分销字段映射）

#### XUI-022 共享通知 store 无限更新环
- 严重度：P1
- 文件与行号：`packages/shared/src/notifications/notification-store.tsx:190-195,225`
- 触发路径：收到第一条 WS 通知后
- 根因：`addFromWs` 每次渲染重建、context value 每次重建、无 id 去重
- 证据：effect 依赖 context 函数 → setState → 重渲染 → 再订阅
- 影响面：CPU 打满、通知列表抖动
- 建议修法：`useCallback` + id 去重 + `useMemo` context
- 当场可修：是
- 修复：`b400751172`（fix(shared): XUI-022/025/032 通知订阅引用稳定、loadMore 失败解锁、分页同 tick 去重）

#### XUI-023 `use-agent-runtime` 过期 abort 清掉新控制器
- 严重度：P1
- 文件与行号：`packages/shared/src/hooks/use-agent-runtime.ts:76-84`
- 触发路径：快速重发/切换会话
- 根因：旧流的 catch/finally 无条件清空 `controllerRef` 与状态
- 证据：无 generation/epoch 判定
- 影响面：新请求被误判为已结束，流式中断
- 建议修法：每次启动自增 epoch，回调比对
- 当场可修：是
- 修复：`beb86a377f`（fix(shared/mobile-rn): XUI-023/024/031/045 运行时代次、分页依赖环、溢出作用域、分享图片 URI）

#### XUI-024 `use-articles` 依赖环 → loadMore 立即回第 1 页
- 严重度：P1
- 文件与行号：`packages/shared/src/hooks/use-articles.ts:146,162,215`
- 触发路径：文章列表下拉加载更多
- 根因：effect 依赖 `load`，而 `load` 闭包含 `page`
- 证据：`loadMore` 触发 page 变化 → 依赖变化 → effect 重置
- 影响面：永远只能看到第一页
- 建议修法：拆 `loadPage` 与 `refresh`，依赖去 page
- 当场可修：是
- 修复：`beb86a377f`（fix(shared/mobile-rn): XUI-023/024/031/045 运行时代次、分页依赖环、溢出作用域、分享图片 URI）

#### XUI-025 `use-load-more` 无 finally → 失败后锁死
- 严重度：P1
- 文件与行号：`packages/shared/src/hooks/use-load-more.ts:10-16`
- 触发路径：加载更多请求 reject
- 根因：`loadingRef` 只在成功路径复位
- 证据：无 try/finally
- 影响面：列表永久无法再加载
- 建议修法：try/finally
- 当场可修：是
- 修复：`b400751172`（fix(shared): XUI-022/025/032 通知订阅引用稳定、loadMore 失败解锁、分页同 tick 去重）

#### XUI-026 WS 通知 id 用 `Date.now()` 兜底 → 冲突
- 严重度：P1
- 文件与行号：`packages/shared/src/notifications/ws-notification-adapter.ts:55-56`
- 触发路径：同毫秒到达两条无 id 通知
- 根因：`` id: str(data.id) ?? `${Date.now()}` ``；`type` 未转字符串
- 证据：同毫秒相同 id → 去重/更新错乱
- 影响面：通知被覆盖或丢条
- 建议修法：UUID/自增序号兜底，`type` 显式 `str`
- 当场可修：是
- 修复：`f2df1e6ca3`（fix(shared/app): XUI-026/027/030/033 通知 type 兜底、408 归瞬时、小时除数、续读保留对侧游标）

#### XUI-027 SSE 408 被归为契约不匹配（终态）
- 严重度：P1
- 文件与行号：`packages/shared/src/sse/contract.ts:1449-1460`
- 触发路径：服务端返回 408/425
- 根因：分类表只显式处理 5xx/429，408 落入 `contract_mismatch`
- 证据：`contract_mismatch` 为终态，不再重试
- 影响面：弱网超时被当致命错误，流不重连
- 建议修法：408/425 归 `transient`
- 当场可修：是
- 修复：`f2df1e6ca3`（fix(shared/app): XUI-026/027/030/033 通知 type 兜底、408 归瞬时、小时除数、续读保留对侧游标）

#### XUI-028 权限判定 fail-open 跨用户放行
- 严重度：P1
- 文件与行号：`packages/shared/src/permission/rules.ts:892,909-911`
- 触发路径：A 用户的 agent 记录被 B 用户校验
- 根因：`(h.agentId ?? principal) === principal`，`agentId` 缺省时等于 `principal` 恒真
- 证据：缺 agentId 的历史记录自动归属当前人
- 影响面：越权自动批准
- 建议修法：缺 `agentId` 一律拒绝或按显式 owner 字段
- 当场可修：是
- 修复：`c126e0892a`（fix(shared/app/mobile-rn/miniapp): XUI-028/029/035/047 权限 fail-closed、水合失败不落盘、重试上限、提现入口锁）

#### XUI-029 `plan-store` 水合失败后仍置 hydrated → 覆盖磁盘
- 严重度：P1
- 文件与行号：`packages/app/src/features/plan/plan-store-core.ts:138-159`
- 触发路径：首启读盘抛错（JSON 损坏/配额）
- 根因：catch 吞异常，`finally hydrated = true`
- 证据：下次 persist 以空状态写回
- 影响面：用户计划数据被清空
- 建议修法：失败时保持 `hydrated=false` 且不落盘
- 当场可修：是
- 修复：`c126e0892a`（fix(shared/app/mobile-rn/miniapp): XUI-028/029/035/047 权限 fail-closed、水合失败不落盘、重试上限、提现入口锁）

#### XUI-030 产物页小时数恒 0
- 严重度：P1
- 文件与行号：`packages/app/src/features/artifacts/ArtifactsScreen.tsx:63`
- 触发路径：产物列表显示「x 小时前」
- 根因：小时分支 `Math.floor(diff / 86_400_000)`（应为 `3_600_000`）
- 证据：`diff` 单位为毫秒
- 影响面：时间文案全错
- 建议修法：改除数
- 当场可修：是
- 修复：`f2df1e6ca3`（fix(shared/app): XUI-026/027/030/033 通知 type 兜底、408 归瞬时、小时除数、续读保留对侧游标）

#### XUI-031 SSE frame-ownership 单溢出槽 + 全局清空 → 丢帧
- 严重度：P1
- 文件与行号：`packages/shared/src/sse/frame-ownership-barrier.ts:163-181,218-228`
- 触发路径：多订阅并发背压
- 根因：只有一个 `overflow` 槽，`clearStaged()` 作用于全局
- 证据：一个订阅溢出清掉其它订阅已暂存帧
- 影响面：消息静默丢失
- 建议修法：按订阅分槽，清理限定作用域
- 当场可修：是
- 修复：`beb86a377f`（fix(shared/mobile-rn): XUI-023/024/031/045 运行时代次、分页依赖环、溢出作用域、分享图片 URI）

#### XUI-032 `use-paginated-list` 用 state 作锁 → 重复页
- 严重度：P1
- 文件与行号：`packages/shared/src/hooks/use-paginated-list.ts:56-75,90-93`
- 触发路径：快速连续触发加载
- 根因：锁基于 state（异步），无 `requestSeq`、无 finally
- 证据：两次并发读到相同 page
- 影响面：重复数据、spinner 卡死
- 建议修法：ref 锁 + 序号丢弃过期响应 + finally
- 当场可修：是
- 修复：`b400751172`（fix(shared): XUI-022/025/032 通知订阅引用稳定、loadMore 失败解锁、分页同 tick 去重）

#### XUI-033 历史投影：新方向边界把 `olderCursor` 置空
- 严重度：P1
- 文件与行号：`packages/shared/src/chat/history-projection.ts:343-352,545-551`
- 触发路径：双向翻页对话
- 根因：较新方向的边界事件覆盖了较老游标
- 证据：`olderCursor = null`
- 影响面：历史无法继续上翻
- 建议修法：游标按方向独立存储
- 当场可修：是
- 修复：`f2df1e6ca3`（fix(shared/app): XUI-026/027/030/033 通知 type 兜底、408 归瞬时、小时除数、续读保留对侧游标）

#### XUI-034 `redact` 未保护 `decodeURIComponent` → URIError
- 严重度：P1
- 文件与行号：`packages/shared/src/utils/redact.ts:224`
- 触发路径：URL query 含裸 `%`
- 根因：直接 `decodeURIComponent(key)`
- 证据：畸形 `%` 抛 URIError，整条日志落盘失败
- 影响面：日志/脱敏链路中断
- 建议修法：try/catch 回退原串
- 当场可修：是
- 修复：`3bf0fc4dcb`（fix(shared/app/miniapp): XUI-020/034/036/042 改密失败复位、脱敏容错、手机号/金额边界、订单列表归一）

#### XUI-035 退款/提现状态机 RETRY 无上限、errorMessage 不清
- 严重度：P1
- 文件与行号：`packages/shared/src/workflows/refund-machine.ts`、`withdrawal-machine.ts`
- 触发路径：连续失败重试
- 根因：RETRY 自旋无最大次数；成功后 `errorMessage` 未清
- 证据：状态机转换表无计数守卫
- 影响面：死循环重试、成功后仍显示错误
- 建议修法：最大重试次数 + 成功清错
- 当场可修：是
- 修复：`c126e0892a`（fix(shared/app/mobile-rn/miniapp): XUI-028/029/035/047 权限 fail-closed、水合失败不落盘、重试上限、提现入口锁）

#### XUI-036 `formatPhone` / `formatAmount` 边界错误
- 严重度：P1
- 文件与行号：`packages/shared/src/utils/format.ts:19-21,36-38,72-76`
- 触发路径：`+86` / 带分隔符手机号；空串金额
- 根因：正则只认 11 位纯数字；`'' → 0.00`
- 证据：返回原串或错误展示 0
- 影响面：三端手机号/金额展示不一致
- 建议修法：归一化后格式化；空值返回 `--`
- 当场可修：是
- 修复：`3bf0fc4dcb`（fix(shared/app/miniapp): XUI-020/034/036/042 改密失败复位、脱敏容错、手机号/金额边界、订单列表归一）

#### XUI-037 小程序保存相册无 hideLoading
- 严重度：P1
- 文件与行号：`apps/miniapp-taro/src/utils/save-album.ts:44-55`
- 触发路径：保存图片成功
- 根因：成功分支未 `hideLoading`
- 证据：仅失败分支关闭
- 影响面：loading 常驻遮罩
- 建议修法：finally 关闭
- 当场可修：是
- 修复：`b5f1627643`（fix(miniapp/mobile-rn): XUI-015/037/044/048 注销路由、相册 loading、webview timer、录音卸载清理）

#### XUI-038 小程序会员支付确认只弹成功
- 严重度：P1
- 文件与行号：`apps/miniapp-taro/src/pages/.../vip/index.tsx:263-266`
- 触发路径：选择支付方式并确认
- 根因：`onPayMethodConfirm` 未发起支付，仅打开成功态
- 证据：回调内无 `requestPayment`
- 影响面：会员未购买即显示成功
- 建议修法：接支付流程后再置成功
- 当场可修：是
- 修复：`dd880eef4b`（fix(miniapp): XUI-038/039/043 会员支付走真实链路、成功页只认服务端 paid、换绑提交旧号验证码）

#### XUI-039 小程序支付成功页用本地 paid 标记
- 严重度：P1
- 文件与行号：`apps/miniapp-taro/src/pages/.../success.tsx:48-54,101`
- 触发路径：从任意入口带 paid 标记进入
- 根因：以本地 `VIP_PAID_STATUS_KEY` 判断，不查服务端
- 证据：标记由客户端写、客户端读
- 影响面：伪造成功、重复领权益
- 建议修法：以服务端订单状态为准
- 当场可修：是
- 修复：`dd880eef4b`（fix(miniapp): XUI-038/039/043 会员支付走真实链路、成功页只认服务端 paid、换绑提交旧号验证码）

#### XUI-042 小程序订单列表标题/时间缺失、`completed` 页签永不命中
- 严重度：P1
- 文件与行号：`apps/miniapp-taro/src/pages/.../orders.tsx:63,66`
- 触发路径：订单列表各页签
- 根因：字段名与后端不一致（`title/createTime`），状态枚举用 `completed` 而真值为 `completed`/`finished` 不一致
- 证据：列表项显示空标题与 `undefined`
- 影响面：列表不可用、页签空
- 建议修法：字段与枚举统一到 types 真值
- 当场可修：是
- 修复：`3bf0fc4dcb`（fix(shared/app/miniapp): XUI-020/034/036/042 改密失败复位、脱敏容错、手机号/金额边界、订单列表归一）

#### XUI-043 小程序换手机号：旧验证码只校验长度不提交
- 严重度：P1
- 文件与行号：`apps/miniapp-taro/src/pages/.../phone.tsx:175-185`
- 触发路径：更换手机号
- 根因：旧号验证码仅做长度判断，请求体未带
- 证据：请求参数缺 `oldCode`
- 影响面：后端校验失败或绕过校验
- 建议修法：随请求提交并等待服务端校验
- 当场可修：是
- 修复：`dd880eef4b`（fix(miniapp): XUI-038/039/043 会员支付走真实链路、成功页只认服务端 paid、换绑提交旧号验证码）

#### XUI-044 小程序 webview 页 reLaunch 定时器未清理
- 严重度：P1
- 文件与行号：`apps/miniapp-taro/src/pages/webview/index.tsx:134`
- 触发路径：进入 webview 后返回/切页
- 根因：`setTimeout(() => reLaunch(...), 600)` 未保存 id、未在卸载时 clear
- 证据：卸载后仍执行 reLaunch
- 影响面：页面栈被强行重置、跳回首页
- 建议修法：卸载清 timer；或改用回调驱动
- 当场可修：是
- 修复：`b5f1627643`（fix(miniapp/mobile-rn): XUI-015/037/044/048 注销路由、相册 loading、webview timer、录音卸载清理）

#### XUI-045 RN 分享页把本地 file:// 当文本分享
- 严重度：P1
- 文件与行号：`apps/mobile-rn/src/screens/ShareScreen.tsx:217-222`
- 触发路径：分享图片/文件
- 根因：仅调用文本分享，传 `file://` URI
- 证据：无文件分享通道
- 影响面：对方收到不可用的本地路径
- 建议修法：走系统文件分享/上传后分享链接
- 当场可修：是
- 修复：`beb86a377f`（fix(shared/mobile-rn): XUI-023/024/031/045 运行时代次、分页依赖环、溢出作用域、分享图片 URI）

#### XUI-046 RN 直播主播页无 teardown、观众数随机
- 严重度：P1
- 文件与行号：`apps/mobile-rn/src/screens/LiveHostScreen.tsx:67-74,105-145`
- 触发路径：开播 → 返回/切后台
- 根因：未在卸载/AppState 变化时停止流；观众数用随机数
- 证据：无 cleanup；`Math.random()` 生成人数
- 影响面：后台仍占用摄像头/流量；数据造假
- 建议修法：卸载与后台停流；人数取服务端
- 当场可修：是
- 修复：`b776154139`（加 `AppState` 监听 + `teardownLive`（ref 读 stream/status）在切后台与卸载时发 `updateSrsStream(id,{status:'inactive'})`；观众数两处 `Math.random()` 全删置 0；夹具 `live-host-teardown.test.ts` 2 条，旧码实测红含 `fabricated viewer count`）

#### XUI-047 RN 分销提现重复提交窗口
- 严重度：P1
- 文件与行号：`apps/mobile-rn/src/screens/DistributionScreen.tsx:263-308`
- 触发路径：点提现 → 实名校验耗时期间再次点击
- 根因：`setWithdrawing(true)` 在 await 实名检查之后
- 证据：锁设置晚于异步边界
- 影响面：重复提现请求
- 建议修法：入口即刻置锁
- 当场可修：是
- 修复：`c126e0892a`（fix(shared/app/mobile-rn/miniapp): XUI-028/029/035/047 权限 fail-closed、水合失败不落盘、重试上限、提现入口锁）

#### XUI-048 RN 录音 hook 卸载未清计时器
- 严重度：P1
- 文件与行号：`apps/mobile-rn/src/hooks/use-voice-recorder.ts:101-109,232-245`
- 触发路径：录音中返回/卸载
- 根因：cleanup 只 `recorder.stop()`，无 `clearInterval`、无 epoch
- 证据：计时器继续 tick 并 setState
- 影响面：卸载后回调、内存泄漏
- 建议修法：清 timer + epoch 丢弃过期回调
- 当场可修：是
- 修复：`b5f1627643`（fix(miniapp/mobile-rn): XUI-015/037/044/048 注销路由、相册 loading、webview timer、录音卸载清理）

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
- 修复：`62a7967c9c`（令牌"无→有"那一次把停在 Login/Register 的人送回 Main,判据 `authArrivalAction` 纯函数 + 9 例对照）

#### XUI-050 rn-compat 图片选择权限硬编码 granted
- 严重度：P2
- 文件与行号：`apps/miniapp-taro/src/rn-compat/platform.tsx:110-145`
- 触发路径：共享屏请求相册权限
- 根因：`requestMediaLibraryPermissionsAsync` 恒返回 `{granted:true,status:'granted'}`
- 证据：无 Taro 授权调用
- 影响面：无权限时静默失败且无法引导
- 建议修法：接 `Taro.authorize/getSetting`
- 当场可修：是
- 修复：`95e1a0892e89`（`platform.tsx` ImagePicker 权限改为如实上报；夹具 `permission.test.ts` 5 条，旧码实测红）

#### XUI-051 rn-compat 缺 `MediaTypeOptions`
- 严重度：P2
- 文件与行号：`apps/miniapp-taro/src/rn-compat/platform.tsx:110-145`
- 触发路径：`ImagePicker.MediaTypeOptions.Images`
- 根因：只导出 `MediaType`
- 证据：消费方取 `undefined`
- 影响面：选择器类型参数失效
- 建议修法：补枚举别名
- 当场可修：是
- 修复：`bcbd00572c`（`export const MediaTypeOptions = ImagePicker.MediaType`；夹具 `media-library-and-linking-shim.test.ts` 4 条，旧码 1 红）

#### XUI-052 rn-compat MediaLibrary 成员缺失/返回形状不符
- 严重度：P2
- 文件与行号：`apps/miniapp-taro/src/rn-compat/platform.tsx:147-158`
- 触发路径：保存图片到相册
- 根因：`createAssetAsync` 返回 void；无 `saveToLibraryAsync`
- 证据：消费方读 `asset.uri` → undefined
- 影响面：保存相册失败
- 建议修法：返回 `{uri,width,height}`；补 `saveToLibraryAsync`
- 当场可修：是
- 修复：`6db56b4765`（`createAssetAsync` 回吐 `{uri,width:0,height:0}`，补 `saveToLibraryAsync` 成员与命名导出；夹具 `media-library-and-linking-shim.test.ts` 3 条，旧码 3 红）

#### XUI-053 rn-compat 缺 `Linking.openSettings`
- 严重度：P2
- 文件与行号：`apps/miniapp-taro/src/rn-compat/apis.ts:91-101`；消费 `apps/mobile-rn/src/screens/AppPermissionScreen.tsx:27`、`ScanLoginScreen.tsx:98`、`EduAttendanceQrScreen.tsx:84`
- 触发路径：权限引导「去设置」
- 根因：垫片只有 `canOpenURL/openURL/addEventListener/getInitialURL`
- 证据：`Linking.openSettings` 为 undefined
- 影响面：引导按钮 TypeError
- 建议修法：补实现（跳小程序设置页/`Taro.openSetting`）
- 当场可修：是
- 修复：`6db56b4765`（`Linking.openSettings` 走 `Taro.openSetting`；夹具 `media-library-and-linking-shim.test.ts` 3 条，旧码 3 红）

#### XUI-054 rn-compat expo-file-system 成员缺口
- 严重度：P2
- 文件与行号：`apps/miniapp-taro/src/rn-compat/native-extras.ts`；消费 `apps/mobile-rn/src/lib/apk-update.ts:323,336,475`、`AigcPublishUpload.ts:24,52,54`、`multipart-download.ts:31,406`、`ranged-download.ts:37,376`
- 触发路径：下载/上传/更新
- 根因：缺 `cacheDirectory/createDownloadResumable/getContentUriAsync`、`File.createUploadTask/open`、`UploadType/FileMode`
- 证据：成员为 undefined
- 影响面：下载更新链路不可用
- 建议修法：补齐或显式降级并在 UI 提示
- 当场可修：是
- 修复：`d6306a65b3`（按「显式 not-supported」落地：`fileSystemSupport.supported=false`；`cacheDirectory/documentDirectory` 显式 `null`；`createDownloadResumable`/`getContentUriAsync`/`File.open`/`File.createUploadTask` 抛 `NotSupportedError(code=ERR_NOT_SUPPORTED)`；`FileMode`/`UploadType` 取值即抛；二进制 `File.write` 不再写空串假装成功。夹具 5 例。改前 5 红 → 5 绿。注：RN 侧这些成员本就走 RN 原生实现，小程序端无可达调用点，本改动是防御性契约，不是恢复某条链路）

#### XUI-055 rn-compat 多选数量只看 selectionLimit
- 严重度：P2
- 文件与行号：`apps/miniapp-taro/src/rn-compat/platform.tsx:110-145`
- 触发路径：`allowsMultipleSelection` 但未给 `selectionLimit`
- 根因：count 仅取 `selectionLimit`
- 证据：多选退化为单选
- 影响面：批量选图受限
- 建议修法：多选时给默认上限
- 当场可修：是
- 复核（2026-11-08，坐实）：`apps/mobile-rn/src/screens/CirclePostScreen.tsx:75-79` 传 `allowsMultipleSelection: true` 且无 `selectionLimit`；垫片旧逻辑只取 `selectionLimit ?? 1` ⇒ `chooseImage({count:1})`。属功能失效/错误数据，P2 上限。
- 修复：`81b3fc2771`（`selectionLimit ?? (allowsMultipleSelection === true ? 9 : 1)`；夹具 `image-picker-multi-select.test.ts` 3 条，旧码 1 红，权限回归 5 条绿）

#### XUI-056 rn-compat 不支持对象形 `navigate`
- 严重度：P2
- 文件与行号：`apps/mobile-rn/src/screens/NoteListScreen.tsx:55`；垫片导航实现
- 触发路径：`navigation.navigate({ name: 'NoteCreate' })`
- 根因：垫片只认字符串+参数
- 证据：对象形被当字符串，路由名 `[object Object]`
- 影响面：跳转失败
- 建议修法：垫片兼容对象形
- 当场可修：是
- 修复：`c6fc25f996`（`navigate` 接受 `{ name, params }` 并拆解；夹具 `object-navigate-shim.test.ts` 2 条，旧码 1 红；既有 `navigation.test.ts` 31 条回归绿）

#### XUI-057 小程序语音识别重复 `configure` 方法
- 严重度：P2
- 文件与行号：`apps/miniapp-taro/src/utils/streaming-recognizer.ts:72-76,93-102`
- 触发路径：编译期（TS2393）
- 根因：同一类内定义两次 `configure`
- 证据：重复成员
- 影响面：类型检查红、后者覆盖前者
- 建议修法：合并为一
- 当场可修：是
- 复核（2026-11-08，**否证/已消解**）：当前 `streaming-recognizer.ts` 全类仅 `configure` 一处定义（`:86`），`init` 在 `:67-68` 以 `this.configure(config)` 复用；录音回调有 `if (this.recorderManager) return` 幂等守卫（`:70`），不会随 `configure` 重复注册。票内 `:72-76,93-102` 的重复成员已不存在，TS2393 不成立。属历史版本残留描述，销号。

#### XUI-058 `order.pay` 文案缺失 + RN 智能体价格按分重复缩放
- 严重度：P2
- 文件与行号：`packages/app/src/features/order/OrderScreen.tsx:188,190`；`apps/mobile-rn/src/screens/MyAgentsScreen.tsx:50`
- 触发路径：订单页/智能体列表
- 根因：i18n key 不存在；`formatPrice(a.price)` 对已是元的字段再除 100
- 证据：界面显示 `order.pay` 原文 / 价格缩小 100 倍
- 影响面：文案与金额错
- 建议修法：补 key；明确单位
- 当场可修：是
- 复核结论（2026-11-08）：**「RN 智能体价格按分重复缩放」与否证不成立，price 单位实为「分」，RN 的 `formatPrice` 是唯一一次换算**。三段证据：
  1. **写入面（证存储单位为分）**：`packages/database/src/schema/agents-extended.ts:42` `price: integer('price').default(0).notNull()`；后台写入点 `apps/api/src/routes/agents.ts:509` 直接落 `body.price`（无 ×100 换算）；服务端唯一换算点 `apps/api/src/services/agent-service.ts:194-195` `(agent.price / 100).toFixed(2) 元` —— 若存储为元则此处会再缩 100 倍，反证存储必为分。
  2. **展示面（并非所有路径都走 formatPrice）**：`formatPrice`（`packages/shared/src/utils` 内 ÷100）调用者仅 `apps/mobile-rn/src/screens/MyAgentsScreen.tsx:50` 一处；web 端另走 `Intl.NumberFormat('currency','CNY')` 或裸 `` `¥${agent.price}` ``：`apps/web/app/(main)/agents/AgentGrid.tsx:27,110`、`.../agents/my/page.tsx:193`、`.../admin/agents/AgentsTable.tsx:53,108` —— 这些路径对同一整数**不再除 100**。
  3. **排除重复缩放**：`GET /agents/my`（`apps/api/src/routes/agents.ts:405-414`）直接复用 `listAgents` 返回 DB 原始行，无 `priceText`/已格式化字段；web 编辑页 `admin/agents/page.tsx:100` 以 `String(agent.price)` 回填也证明接口给的是原始整数。故 RN 侧 `formatPrice(a.price)` 只发生一次 ÷100，不构成「已除过再除」。
- 未修部分：`order.pay` i18n key 缺失位于 `packages/app`，不在本次 miniapp/RN 范围，仍未处理。
- 新开条目（不并入本条）：**XUI-058b web 端把「分」当「元」显示**（`AgentGrid.tsx:110`、`agents/my/page.tsx:193`、`AgentsTable.tsx:108` 直接 format 原始整数，展示值放大 100 倍）。范围外（`apps/web`），仅留痕未改。
- 复核（2026-11-08）：`order.pay` 五语缺 key 已补（`ffa7594775`）；分/元重复缩放部分已否证，无需改。

#### XUI-059 RN 端 artifacts 系列 i18n key 缺失
- 严重度：P2
- 文件与行号：`apps/mobile-rn/src/screens/ArtifactsScreen.tsx`（15+ 处 key）
- 触发路径：产物页各标签
- 根因：RN 语言包未同步新增 key
- 证据：渲染出 key 原文
- 影响面：界面中英混杂
- 建议修法：同步语言包
- 当场可修：是
- 修复：`ffa7594775`（mobile-rn 5 语 artifacts 命名空间对齐 web，补 27 key；共享屏不再回落原始点路径）

#### XUI-060 `login.platformLinuxdo` 缺失
- 严重度：P2
- 文件与行号：`apps/mobile-rn/src/screens/LoginScreen.tsx:278-282`
- 触发路径：第三方登录区
- 根因：key 未定义
- 证据：显示原始 key
- 影响面：文案破损
- 建议修法：补 key
- 当场可修：是
- 修复：`ffa7594775`（补 `login.platformLinuxdo` 五语，值 LinuxDo）

#### XUI-061 模块级 `Intl` 实例冻结时区
- 严重度：P2
- 文件与行号：`apps/mobile-rn/src/screens/MemoryScreen.tsx:103`；`quick-notes-styles.ts:14`；`letter-time.ts:9`；`withdrawal-props.ts:12`
- 触发路径：用户切换时区/语言后
- 根因：模块加载时创建 formatter，参数固化
- 证据：跨时区展示不更新
- 影响面：时间显示错误
- 建议修法：按需创建或缓存带 key
- 当场可修：是
- 复核（2026-11-08）：票内三处已消解 —— `MemoryScreen` 现无任何 `Intl`；`quick-notes-styles.ts`/`withdrawal-props.ts` 已不存在；`letter-time.ts` 是刻意固定 `zh-CN`（逐字复刻 web 口径，非缺陷）。同类残留真例在 `WorkflowsScreen.tsx:20`（票外），已一并修。
- 修复：`0831c5f8a0`（`formatNextRun` 改为按调用时 `new Intl.DateTimeFormat()`，删除模块级实例；夹具 `intl-formatter-not-frozen.test.ts` 2 条，旧码 1 红）

#### XUI-062 相对时间 ja/ko 回退英文
- 严重度：P2
- 文件与行号：`packages/shared/src/utils/date-utils.ts:165-192`
- 触发路径：日/韩语环境
- 根因：仅 zh/en 分支，其余走英文兜底
- 证据：返回英文短语
- 影响面：本地化缺失
- 建议修法：补 ja/ko 或走 Intl.RelativeTimeFormat
- 当场可修：是
- 修复：`c38ec4c9b4`（Hermes 分支补 ja/ko 单位与「たった今 / 방금 전」，zh/en 读数不变）

#### XUI-063 小程序 i18n key 漂移
- 严重度：P2
- 文件与行号：`apps/miniapp-taro/src/pages/plaza/*`（`plaza.index.search` vs `navSearch`）；`wallet/*`（`wallet.recharge.title` vs `wallet.title`）
- 触发路径：广场搜索、钱包充值
- 根因：页面 key 与语言包键名不一致
- 证据：显示原文 key
- 影响面：文案缺失
- 建议修法：统一 key 命名
- 当场可修：是
- 修复：`af15ecdcb5`（只补**源**文案并按规范名对齐：广场页 `search/menu/category` → 源里的 `navSearch/navMenu/navCategory`；源补 `plaza.index.loadFail`、`wallet.recharge.title/balance/rate/introTitle/introBody`、`common.gotIt` ×5 语。夹具 `xui-063-i18n-keys.test.ts` 只对 `packages/i18n/messages/{shared,miniapp-taro}` 断言、不碰 `.gen.ts`；产物重生成并入 XUI-076 同一次，不分两次动同一批文件）

#### XUI-064 AppTopup 屏未接 `texts`
- 严重度：P2
- 文件与行号：`apps/mobile-rn/src/screens/AppTopupScreen.tsx:113-132`
- 触发路径：应用内充值
- 根因：共享屏契约要求 `texts`，容器未传
- 证据：文案空/默认
- 影响面：界面空缺
- 建议修法：传入完整 texts
- 当场可修：是
- 结论（2026-11-08，**不改**）：共享屏 `texts` 是**可选覆盖**、默认文案内置，容器不传不会出现空文案；原「文案空/默认」判断不成立，结案，后续勿重报。

#### XUI-065 token 数值格式化两端分歧
- 严重度：P2
- 文件与行号：`packages/shared/src/utils/format.ts:98-105` vs `apps/miniapp-taro/src/components/UserInfoCard.tsx:114-119`
- 触发路径：余额/代币展示
- 根因：统一格式化与本地格式化两套规则（小数位/千分位）
- 证据：同值不同展示
- 影响面：三端数字不一致
- 建议修法：收敛到共享函数
- 当场可修：是
- 修复：`a3021e99e5`（删除端内 w/k 实现，改 import `@ihui/shared/utils/format` 的 `formatTokenValue`（万/亿 + 2 位）；夹具 `user-token-format-single-source.test.ts` 2 条，旧码 1 红）

#### XUI-066 小程序镜像屏以空串掩盖错误
- 严重度：P2
- 文件与行号：`apps/miniapp-taro/src/pkg-*/**` 传 `error=""` 的壳；共享屏 `HelpScreen.tsx`、`CategoryDetailScreen.tsx:23,73,88,110,114`
- 触发路径：接口失败
- 根因：壳把错误态写死为空
- 证据：失败时仍显示空态而非错误
- 影响面：用户无法感知失败、无法重试
- 建议修法：透传真实错误
- 当场可修：是
- 修复：`5fd91c5f27`（组1:help / category-detail / withdrawal / vip-privilege / study-rank，夹具 `shell-load-error-1.test.ts` 6 条，旧码 5 红）
- 修复：`6c49f40763`（组2:aigc/publish + teacher/detail；`ai-chat-detail` 经查已有 `ErrorState`+`onRetry`，不属静默失败；夹具 `shell-load-error-2.test.ts` 3 条，旧码 2 红）
- 修复：`27140b31c8`（组2b:news/list、vip/index、live/subscribe；夹具 `shell-load-error-3.test.ts` 4 条，旧码 4 红）
- 修复：`d8e7efae39`（组3a:message/index、distribution/rank、setting/privacy；夹具 `shell-load-error-4.test.ts` 3 条，旧码 3 红）
- 修复：`67f95aa05b`（组3b:setting/notification；夹具 `shell-load-error-5.test.ts` 1 条，旧码 1 红）

#### XUI-067 帮助页「返回」实为重试
- 严重度：P2
- 文件与行号：`packages/app/src/features/help/CategoryDetailScreen.tsx:110-114`
- 触发路径：分类详情加载失败
- 根因：错误态按钮文案「返回」绑定重试
- 证据：label 与 handler 不符
- 影响面：用户误操作
- 建议修法：文案/行为对齐
- 当场可修：是
- 复核（2026-11-08，**已消解**）：当前 `packages/app/src/features/category-detail/CategoryDetailScreen.tsx:99` 已为 `retryLabel={t('common.retry')}` + `onRetry`，票内「返回」文案绑定重试的写法已不存在。销号。

#### XUI-068 改密屏「忘记密码」在 RN 为死路
- 严重度：P2
- 文件与行号：`packages/app/src/features/.../ChangePwdScreen.tsx:27,108-117`
- 触发路径：RN 端点击忘记密码
- 根因：该路由仅在未登录分支缺失（见 XUI-004），点击无响应
- 证据：目标路由未注册
- 影响面：找回密码不可用
- 建议修法：与 XUI-004 一并修
- 当场可修：是
- 复核（2026-11-08，**部分覆盖**）：XUI-004（`0ba309d2f7`）补了 ChangePwd 路由，但 RN 宿主 `apps/mobile-rn/src/screens/ChangePwdScreen.tsx` 仍未向共享屏传 `onForgotOld`，忘记密码入口不渲染，找回路径仍缺。
- 修复：`d6306a65b3`（先查复用面：shared 无找回屏、miniapp 页是 Taro 原生给 RN 用不上、web 已有 `/forgot-password` ⇒ RN 用通用 `WebView` 复用 web 页，**不起第二套屏**；登录页忘记入口改跳该页，改密屏「忘记旧密码」也指同一处，**解开 Login→ChangePwd 死环**；未登录分支补注册 `WebView` 路由）

#### XUI-069 RN 设备列表请求竞态
- 严重度：P2
- 文件与行号：`apps/mobile-rn/src/screens/DevicesScreen.tsx:182-198,217-235`；`DistributionOrderListScreen.tsx`
- 触发路径：快速切页/刷新
- 根因：无 requestSeq，旧响应覆盖新状态
- 证据：后到旧数据覆盖
- 影响面：列表回跳
- 建议修法：序号丢弃过期响应
- 当场可修：是
- 修复：`981c44915bfc`（`reqSeqRef`/`filterSeqRef` + mounted ref 丢弃过期响应；夹具 `request-race-and-double-submit.test.ts` 5 条，旧码 5 红）

#### XUI-070 AiWorld / Purchase / AigcPublish 重复提交与卸载后回调
- 严重度：P2
- 文件与行号：`apps/mobile-rn/src/screens/AiWorldScreen.tsx:232-274`；`PurchaseScreen.tsx:159-186`；`AigcPublishScreen.tsx:83-101`
- 触发路径：慢网连点/返回
- 根因：锁晚置或缺失、无 mounted 守卫
- 证据：重复请求、卸载后 setState
- 影响面：重复下单、告警
- 建议修法：入口置锁 + mounted ref
- 当场可修：是
- 修复：`981c44915bfc`（入口 ref 置锁 + mounted 守卫；夹具 `request-race-and-double-submit.test.ts` 5 条，旧码 5 红）

#### XUI-071 multipart 下载无界缓冲、进度回调在卸载后
- 严重度：P2
- 文件与行号：`apps/mobile-rn/src/lib/multipart-download.ts:237-248,438-444`
- 触发路径：大文件分段下载
- 根因：片段全量进内存；进度回调未判存活
- 证据：内存增长与卸载后回调
- 影响面：OOM / 告警
- 建议修法：流式落盘 + 取消令牌
- 当场可修：是
- 降级方案（2026-11-08）：先有界、不一步跨到流式。**上限 = 单片 64 MiB / 整包 256 MiB**（真实包 85–200MB 在界内；XHR 整片驻留内存，超界即低端机 OOM）。**超限拒绝**（不落盘、不做无界缓冲）：清单解析期抛 `PartsUnavailableError`，`code = ERR_PARTS_OVER_LIMIT`；调用方（apk-update）据此退回单文件腿。真流式留给后续跨端分片契约。
- 修复：`d6306a65b3`（`MAX_PART_BYTES`/`MAX_TOTAL_BYTES` + 解析期拒绝 + 错误码；夹具 3 例：单片超界 / 整包超界 / 恰好等于上限仍接受。改前 3 红 → 14/14 绿）

#### XUI-072 小程序课程详情成功与失败 toast 并存
- 严重度：P2
- 文件与行号：`apps/miniapp-taro/src/pkg-learn/course/detail.tsx:172-176`
- 触发路径：报名课程成功
- 根因：连续两次 toast
- 证据：成功提示后紧跟失败提示
- 影响面：误导用户
- 建议修法：单一出口
- 当场可修：是
- 修复：`95e1a0892e89`（成功/失败 toast 互斥；夹具 `sign-toast.test.ts` 2 条，旧码实测红）

#### XUI-073 小程序充值失败丢失 orderNo
- 严重度：P2
- 文件与行号：`apps/miniapp-taro/src/pages/.../recharge/index.tsx:117-127`
- 触发路径：下单成功但拉起支付失败
- 根因：catch 未保留 orderNo
- 证据：无法查单/重试
- 影响面：订单悬挂
- 建议修法：保留并展示订单号
- 当场可修：是
- 修复：`b342856a45`（失败不再跳 `orderNo=` 空单号页；同批修同型死路由 `/pagesA/top-up/index` → `/pkg-shop/wallet/top-up/index`；夹具 `recharge-and-dead-route.test.ts` 4 条，旧码 2 红）

#### XUI-074 ToolApprovalSheet / ImageAnnotator 键盘与高度处理缺失
- 严重度：P2
- 文件与行号：`apps/mobile-rn/src/components/ai/ToolApprovalSheet.tsx:598-610`；`components/chat/ImageAnnotator.tsx:658,667`
- 触发路径：小屏 + 键盘弹出
- 根因：居中卡片无 `maxHeight`/无 ScrollView；`autoFocus` 输入行无 KAV
- 证据：内容溢出、输入框被键盘遮挡
- 影响面：按钮不可达、无法输入
- 建议修法：加 `maxHeight` + ScrollView/KAV
- 当场可修：是
- 修复：`ToolApprovalSheet` 卡片改 `ScrollView`（`maxHeight:'85%'` + `cardContent` 承载 padding/gap + `keyboardShouldPersistTaps="handled"`），外层套 `KeyboardAvoidingView`（iOS `padding`）；`ImageAnnotator` 全屏根容器改 `KeyboardAvoidingView`（iOS `padding`），保留 `autoFocus` 输入行。夹具 `apps/mobile-rn/src/lib/__tests__/xui-074-keyboard-panels.test.ts` 3 条，旧码实测 3 红、新码 3 绿。

---

#### XUI-075 小程序提现「全部提现」写入千分位串导致金额解析为 NaN
- 严重度：P1（错误数据 / 功能失效；机主 2026-11-08 复核上调：余额 ≥1000 用户永远提不出钱 + 失败静默）
- 文件与行号：`apps/miniapp-taro/src/pkg-shop/wallet/withdrawal/withdrawal-props.ts`（`priceFmt` 未关 `useGrouping`，输出 `1,234.56`）、`apps/miniapp-taro/src/pkg-shop/wallet/withdrawal/index.tsx`（原 `:52` `Number(amount)`；失败 `catch` 静默）
- 触发路径：钱包 → 提现 → 点「全部提现」→ 提交
- 根因：展示格式化与提交解析共用同一字符串，`Number('1,234.56') === NaN` ⇒ 守卫判「请输入有效金额」，余额 ≥ 1000 的用户永远提不出钱；另提交失败被 `// ignore` 吞掉，无任何提示。
- 证据：`formatWithdrawAmount` 走 `Intl.NumberFormat` 默认分组；夹具 `withdrawal-amount-parse.test.ts` 用真实 formatter 输出回灌解析。
- 影响面：小程序提现链路（≥1000 元必现）。
- 建议修法：提交前剥离千分位/空白再转数；失败如实 toast。
- 当场可修：是
- 修复：`1a24120be2`（新增 `parseWithdrawAmount`，`onSubmit` 改用它；`catch` 补错误 toast；夹具 3 条，旧码 3 红）

#### XUI-076 小程序派生产物钉陈旧（i18n 离线包 + ui-routes）
- 严重度：P2（错误数据：端上可能读过期文案/路由白名单）
- 状态：**已解冻、仍暂缓重生成**（2026-11-08 用户指令）。AI 计费改由 API 线统一按 B 方案修改（会碰钱包相关代码），本线**先不跑生成器**；等 API 线那批落地后，由**单一写入者**一次性跑 `pnpm gen:i18n` + `node apps/miniapp-taro/scripts/generate-ui-routes.mjs`，避免重生成结果被并行改动顶掉。其他人不得手改这些生成物。前置核对清单已交用户确认，未获批准前不执行。
- 生成器与固定命令（两条，缺一不可）：
  - `pnpm gen:i18n` → `scripts/gen-i18n-compressed.mjs`
  - `node apps/miniapp-taro/scripts/generate-ui-routes.mjs` → `apps/miniapp-taro/scripts/generate-ui-routes.mjs`
- 复算方法：`scripts/lib/generated-input-pin.mjs` 的 `parsePin` + `digestInputs` + `differingInputs`；逐条读取钉内 `input:` 行的磁盘当前内容复算，全程只读，未执行生成器。

| # | 生成物 | 钉内输入数 | 不一致输入数 | 当前钉（`inputsSha256`） | 按磁盘输入复算（2026-11-08 二轮） | 钉内 sourceCommit / generatedAt |
|---|---|---|---|---|---|---|
| 1 | `apps/miniapp-taro/src/i18n/generated/zh-cn-pack.gen.ts` | 3 | 2 | `20c17b6079d21d55740baf172c135c6c24e65a3330f8ebfceb79da8103918c1b` | `7197af7a919af22a24c7e41154d57894675133c0d791bcc47c8ae45f08b53706` | `f5a4ce8f5b82` / `2026-11-07T10:02:27.124Z` |
| 2 | `apps/miniapp-taro/src/i18n/generated/remote-locales.gen.ts` | 12 | 8 | `58e4c4e8730bd376ac6f83eb9d4fee4734f63834ac7e4c7b729cbe6f0ab4355c` | `00d7b63dcaa2eaa41d95aec27b3396e19947a06ac651ad1b8c04dc075f0489e9` | `f5a4ce8f5b82` / `2026-11-07T10:02:26.972Z` |
| 3 | `apps/miniapp-taro/src/i18n/generated/remote-locale-manifest.gen.ts` | 12 | 8 | `58e4c4e8730bd376ac6f83eb9d4fee4734f63834ac7e4c7b729cbe6f0ab4355c` | `00d7b63dcaa2eaa41d95aec27b3396e19947a06ac651ad1b8c04dc075f0489e9` | 同 #2（同一批输入，两产物同钉） |
| 4 | `apps/miniapp-taro/src/constants/ui-routes.generated.ts` | 725 | 43 | `4adbac89e83dfff613c289e935560349b381ee6e06b7c7af4632fe762bb8f2c9` | `e12b25b8b98daa563927c72b3d5204396962c3b1f6e7fd712e9ddb9211633502` | `b832d2a6dc0a` / `2026-11-08T06:52:09.584Z` |

- 复算命令（只读，**不执行生成器**；仓库根运行）：

```js
// node --input-type=module
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { parsePin, digestInputs, differingInputs } from './scripts/lib/generated-input-pin.mjs'
const ROOT = '.'
for (const rel of [
  'apps/miniapp-taro/src/i18n/generated/zh-cn-pack.gen.ts',
  'apps/miniapp-taro/src/i18n/generated/remote-locales.gen.ts',
  'apps/miniapp-taro/src/i18n/generated/remote-locale-manifest.gen.ts',
  'apps/miniapp-taro/src/constants/ui-routes.generated.ts',
]) {
  const pin = parsePin(readFileSync(join(ROOT, rel), 'utf8'))
  const computed = digestInputs(pin.perInput.map((i) => ({
    rel: i.rel,
    text: existsSync(join(ROOT, i.rel)) ? readFileSync(join(ROOT, i.rel), 'utf8') : null,
  })))
  const diff = differingInputs(pin, computed.perInput)
  console.log(rel, { inputs: pin.perInput.length, diff: diff.length, pinned: pin.digest, actual: computed.digest, matched: pin.digest === computed.digest })
}
```

- 输入对应关系（逐条）：
  - **#1** 输入 3 条：`packages/i18n/messages/{miniapp-taro,mobile-rn,shared}/zh-CN.json`；已变 2 条：`miniapp-taro`（`f53b21b04146 → 53f8aea5ea1a`）、`mobile-rn`（`052378aeb068 → e39a25c0280f`）；`shared` 未变。
  - **#2/#3** 输入 12 条：`packages/i18n/messages/{miniapp-taro,mobile-rn,shared}/{en,ja,ko,zh-TW}.json`；已变 8 条，`shared/` 的 4 条未变：
    - `miniapp-taro/`：`en` `3bf8b0052b6a → 3e2ccded610d`、`ja` `6105927852f3 → 8602129401d8`、`ko` `45e30551c544 → d539fe3fcf34`、`zh-TW` `2f9e20268870 → 8980d758445b`
    - `mobile-rn/`：`en` `5968535898a4 → 1d7356fcbe2d`、`ja` `0564e7278384 → 929790b49f73`、`ko` `d9e8112520f8 → 0956ea74b2c9`、`zh-TW` `5e48b44c1f7d → 38096ee1a9ec`
  - **#4** 输入 725 条（`apps/miniapp-taro/src` 源码 + `app.config.ts` + `app.tsx`）；已变 43 条（12 位 sha 前缀，`pinned → actual`）：
    1. `apps/miniapp-taro/src/api/index.ts` `440515d20c9e → 2c32067aa997`
    2. `apps/miniapp-taro/src/components/UserInfoCard.tsx` `7fa64862d686 → f3d01b9aa5f9`
    3. `apps/miniapp-taro/src/pages/community/components/MyAgents.tsx` `20495a0fedcb → 1525fc44a517`
    4. `apps/miniapp-taro/src/pages/community/components/RecentAgents.tsx` `0f30bec278c1 → 83875e98cf51`
    5. `apps/miniapp-taro/src/pages/community/index.tsx` `11144e88b0df → e491d20964d2`
    6. `apps/miniapp-taro/src/pages/distribution/commission-overview.tsx` `810005ec02c2 → 24fee0b1622f`
    7. `apps/miniapp-taro/src/pages/distribution/rank.tsx` `ce87ad53a453 → 13a356fe73c8`
    8. `apps/miniapp-taro/src/pages/forgot-password/index.tsx` `36330202edbf → 46343e98cf80`（相对一轮清单**新增**）
    9. `apps/miniapp-taro/src/pages/plaza/index/index.tsx` `bf8d55342b0a → 060556074c83`（**新增**）
    10. `apps/miniapp-taro/src/pages/setting/index.tsx` `ca1e712b4c29 → 9ac06167c436`
    11. `apps/miniapp-taro/src/pages/setting/notification.tsx` `b1a9156931ed → 993ffc1ff11c`
    12. `apps/miniapp-taro/src/pages/setting/privacy.tsx` `edcb0d63a0fd → c78b472d909f`
    13. `apps/miniapp-taro/src/pages/study/rank.tsx` `55fe773a4e8e → a7a38d15b6b2`
    14. `apps/miniapp-taro/src/pages/user/index.tsx` `2e514383575c → 07f87bb75a66`
    15. `apps/miniapp-taro/src/pages/webview/index.tsx` `ca3a99c4e24a → b8efb77d8879`
    16. `apps/miniapp-taro/src/pkg-about/about-shared/index.tsx` `4f1c15535b37 → 4c3e6bf96e07`
    17. `apps/miniapp-taro/src/pkg-about/about/help.tsx` `8e47f8f5e665 → 3ebd65629246`
    18. `apps/miniapp-taro/src/pkg-ai/ai/chat-list-extras.tsx` `e69844ce7dbb → e14172ec9886`
    19. `apps/miniapp-taro/src/pkg-ai/ai/chat-shell-extras.tsx` `56304872417d → 98cce26ed50f`
    20. `apps/miniapp-taro/src/pkg-ai/ai/chat.tsx` `438fc079585a → 10dc02b18b0a`
    21. `apps/miniapp-taro/src/pkg-ai/ai/model-switch.ts` `d9618f48e982 → e2a188a9b062`
    22. `apps/miniapp-taro/src/pkg-ai/aigc/publish.tsx` `bcb3087f5798 → 8db5dc12a700`
    23. `apps/miniapp-taro/src/pkg-content/category-detail/index.tsx` `3a87b1fc6328 → a99f00462225`
    24. `apps/miniapp-taro/src/pkg-content/news/list.tsx` `6c746e9e340f → af2261a655e3`
    25. `apps/miniapp-taro/src/pkg-learn/course/detail.tsx` `43a43e70681e → 0851965342b4`
    26. `apps/miniapp-taro/src/pkg-learn/live/subscribe.tsx` `d8225b552321 → 89cf4aed1a9d`
    27. `apps/miniapp-taro/src/pkg-learn/teacher/detail.tsx` `8cf48d814364 → faa17850f235`
    28. `apps/miniapp-taro/src/pkg-shop/pay/index.tsx` `f39a893cd928 → 0ef41a5c5cfe`（**新增**）
    29. `apps/miniapp-taro/src/pkg-shop/vip/index.tsx` `c2c9c2985014 → d5b0999f3e35`
    30. `apps/miniapp-taro/src/pkg-shop/vip/privilege.tsx` `b6e92e460035 → 320be699c0ea`
    31. `apps/miniapp-taro/src/pkg-shop/vip/success.tsx` `7802e8745b12 → 2bd8069f8647`
    32. `apps/miniapp-taro/src/pkg-shop/wallet/recharge/index.tsx` `32903eedfb7a → 9437409649f2`
    33. `apps/miniapp-taro/src/pkg-shop/wallet/withdrawal/index.tsx` `a8e49cfdcf8d → b719bde17e6c`
    34. `apps/miniapp-taro/src/pkg-shop/wallet/withdrawal/withdrawal-props.ts` `f07b95d54e7e → 4ff9f8dabc00`（XUI-075 修复新增）
    35. `apps/miniapp-taro/src/pkg-user/account-cancel/index.tsx` `ce4c10bcf43b → ab14c9bef5c6`（**新增**）
    36. `apps/miniapp-taro/src/pkg-user/message/index.tsx` `ce21b8231520 → ee5cea777f6b`
    37. `apps/miniapp-taro/src/pkg-user/user/email.tsx` `68c11c87c076 → c647e0ea3b9e`（**新增**）
    38. `apps/miniapp-taro/src/pkg-user/user/phone.tsx` `098bdca7eeea → aba399a9b5fb`
    39. `apps/miniapp-taro/src/rn-compat/apis.ts` `3e8fcc812bac → b5b1fb26bfb0`
    40. `apps/miniapp-taro/src/rn-compat/native-extras.ts` `34bf6ebbf142 → 466034484bab`（**新增**）
    41. `apps/miniapp-taro/src/rn-compat/navigation.tsx` `3ad2f9eb0d82 → ac95743f46a4`
    42. `apps/miniapp-taro/src/rn-compat/platform.tsx` `f1d75668e67a → ee3a71a31c59`
    43. `apps/miniapp-taro/src/utils/save-album.ts` `54c51fe47bf5 → da89c69bc215`
- **同批派生但一轮清单漏列的 4 个受控文件**：`apps/miniapp-taro/src/assets/remote-locales/{en,ja,ko,zh-TW}.b64.txt`。`gen-i18n-compressed.mjs:536-539` 每次生成都会重写它们，且当前文件字节数（146836/168572/160300/152308）与 manifest 里**旧钉**的 `bytes` 完全一致 ⇒ 它们与 #2/#3 同属陈旧批次，重生成后必然一并出 diff。
- 对照组（第一轮未一并重生成；**2026-11-08 第二轮已补生成收口**）：
  - `apps/mobile-rn/src/constants/ui-routes.generated.ts`：终态 **2 输入**，钉 `fd754397635545ffad8fbe8ff10be7ca96825c77e24a7bef062da1796bef0bd5`
  - `apps/web/src/lib/ui-routes.generated.ts`：终态 **923 输入**，钉 `d413f735eb14192071e3279f2344a331b284f39e1a6e3493e7c93efcefe28c30`
  - **陈旧成因（定论）**：两份都是「源码改了、生成物没重生成」——RN 的 `RootNavigator.tsx` 被 XUI-004 `0ba309d2f7` + XUI-068 `d6306a65b3` 改过；web 的 `wallet/page.tsx`（XUI-086 `0b3724817a`）、`agents/featured/page.tsx` 与 `agents/my/page.tsx`（XUI-075 `8f7b3b3036`）、`admin/api-platform/packages/page.tsx`（XUI-082 `f219b27053`）改过。**不是生成器缺陷，也不是外部输入混入**；下一轮普查不要再把它当新缺陷重复入册。
- **web/RN 补生成（2026-11-08 第二轮，已完成）**：
  - web：提交 `ea1555d0cc`；输入 923 条（数量未变），4 条已变输入全部来自本线（同上）；终态钉 `d413f735…`，复算 matched，diff 仅钉块 7 行，路由清单零变化。
  - RN：提交 `23bfb6ca86`（用户裁决 A 纳入）；输入 2 条，1 条已变（`RootNavigator.tsx`，来源 XUI-004 + XUI-068）；终态钉 `fd754397…`，复算 matched，diff 为钉块 + `skipped: unauthedBranchScreens=7 → 8`，349 条路由清单未变。
  - 小程序腿 `apps/miniapp-taro/src/constants/ui-routes.generated.ts` 未重生成：钉仍 `03af0632…`，字节与提交 `9fc8e895cb` 后一致。
- 交接验收（修正后）：唯一写入者执行两条命令后，**只允许 8 个文件出 diff** —— #1–#4 四个 `.gen.ts/.generated.ts` + 上述 4 个 `*.b64.txt`；`git diff --stat` 应显示 8 files。若多出文件说明波次期间又有源码/语言包变更，按新钉重算再交。**禁止手改 `inputsSha256` / `generatedAt` / `version` / `bytes`**：重生成时由生成器从磁盘输入现算。对照组两个 `ui-routes.generated.ts`（mobile-rn/web）不得出 diff——**该约束仅限小程序轮**；web/RN 已在第二轮按用户批准单独重生成（见上两条）。
- 重生成后必须复核：4 个 `.gen.ts/.generated.ts` 的钉 `inputsSha256` 应变为按磁盘输入复算值（#2/#3 相同）；#4 例外：重生成时补入 `apps/miniapp-taro/src/pkg-shop/vip/paid-verify.ts`（输入 725 → 726），终态为 `03af0632…`；4 个 b64 的字节数应与新 manifest 的 `bytes` 一致。
- 影响面：小程序离线文案（zh-CN 与 en/ja/ko/zh-TW）与 `ROUTE_NOT_ALLOWED` 白名单此前落后于源码；4 个 CDN 载荷 `*.b64.txt` 与 manifest `version/bytes` 此前同样陈旧，2026-11-08 已一次性重生成（见执行记录）。
- 当场可修：已完成（提交 `9fc8e895cb`）。
- 状态（2026-11-08）：**已完成重生成**，提交 `9fc8e895cb`（8 文件，`+94 / −93`）；四个终态钉复算全部 `matched`。
- 执行记录（2026-11-08，单一写入者一次）：`pnpm --filter @ihui/miniapp-taro gen:i18n`（更正：`gen:i18n` 注册在 `apps/miniapp-taro/package.json`，根目录没有该脚本）+ `node apps/miniapp-taro/scripts/generate-ui-routes.mjs`。
  - `git diff --stat` = **8 files changed, 94 insertions(+), 93 deletions(-)**，与验收口径一致；对照组 `apps/web/src/lib/ui-routes.generated.ts`、`apps/mobile-rn/src/constants/ui-routes.generated.ts` 的 `git diff --stat` 输出为空（0 差异）——**注意：其自身钉已陈旧，见上方「对照组」条，勿误读为自洽**。
  - 终态钉（复算 0 差异）：#1 `7197af7a…`（3 输入）、#2/#3 `00d7b63d…`（12 输入）、#4 `03af0632…`（**726** 输入——旧钉 725，重生成时补入 `apps/miniapp-taro/src/pkg-shop/vip/paid-verify.ts` 一条，故聚合值与二轮预期 `e12b25b8…` 不同，属预期）。
  - 4 个 b64 载荷终态：`en` `e40e6739…`/147192、`ja` `06d5cf81…`/169044、`ko` `4313da0e…`/160728、`zh-TW` `83f85a23…`/152716；逐个 SHA256 与 manifest `version` 完全相同，文件长度与 `bytes` 完全相同。
  - 未手改任何钉字段：`inputsSha256` / `generatedAt` / `version` / `bytes` 均由生成器写出，且与按磁盘输入复算值一致。
- 执行前闸门（2026-11-08 复核，历史记录）：API 线 F-203 口径 B 已推 `origin/fix/api-p0-1108`（`2492296e86` 异步 worker 改按定价成本、`cea6f4565e` 钱包扣减与 `ai_cost_records` 同源），但**未合入 main**；且 `crew.ts:198/277`、`stock-service.ts:262`、`proxy-tools.ts:995` 仍拿原始/估算 token 量调 `deductTokens`，同型四点尚未全部收口 ⇒ 按用户条件暂不执行重生成。该分支未触碰 `apps/miniapp-taro/src`、`packages/i18n/messages`、`apps/web`，故 XUI-076 输入未变，复算预期仍有效。

## 三、未判定（证据不足，未计入结论）

| 编号 | 事项 | 缺什么 |
|---|---|---|
| U-1 | 小程序支付宝分支充值金额是否整体 ×100（仅观察到优惠券分支差异） | 需真机支付宝环境 + 服务端下单参数 |
| U-2 | 小程序 `pay/index.tsx` 金额单位（展示为 1/100 真实值，支付宝疑似 100 倍） | 需支付宝沙箱实测 |
| U-3 | 小程序权限硬编码 granted 是否会被 `wx.requirePrivacyAuthorize` 拦截 | 已消解：包装层不再硬编码，改为如实上报（XUI-050 `95e1a0892e89`）；真机拦截仍属平台行为 |
| U-4 | LiveHost 观众数随机是否为 mock 设计（可能是有意的演示数据） | 需产品口径确认；已按「不臆造」处理（置 0），见 XUI-046 修复 `b776154139` |
| U-5 | 构建产物 `dist` 与 `src` 逐符号差异（本轮只验证 exports 叶子存在） | 需构建后比对，超出只读静态面 |
| U-6 | 小程序支付是否缺 `buyerId` 导致后端走 mock | 仅 `pkg-shop/vip/upgrade.tsx:117` 传了 `buyerId`，充值与普通支付路径未取证 |
| U-7 | 小程序提现「千分位字符串 → NaN」 | **复核坐实 → 升级 XUI-075，已修**：`withdrawal-props.ts` 的 `priceFmt` 默认 `useGrouping`，「全部提现」写入 `1,234.56`，旧 `Number(amount)` 得 NaN |

## 四、已否证（误报，附复核依据）

| 编号 | 曾被怀疑 | 复核结论 |
|---|---|---|
| N-1 | RN 全仓无 `navigation.push` / 无 `Platform.select` | 否证（2026-11-08 复核维持）：`navigation.push`/`Platform.select` 在 `apps/mobile-rn/src` 命中 6 个文件，含 `KnowledgeEntryReadingScreen.tsx:127-128`、`LettersScreen.tsx:96`、`ChatMessageList.tsx:230`、`ToolCallCard.tsx:73`、`ChatScreen.tsx:3952`、`AiAssistantN8nScreen.tsx:2395/2407/2414` |
| N-2 | `packages/*` 的 exports 目标文件缺失 | 否证（2026-11-08 复核，需限定）：脚本按通配展开复核 10 包 108 个目标，仅 `app` 的 `./features/*`（映射 `./src/features/*.tsx`）无直系文件（该目录 245 个全是子目录）；全仓 `@ihui/app/features` 零 import ⇒ 无消费面破坏，仍非缺陷 |
| N-3 | 生成物 `inputsSha256` 与源码不符 | **判定纠正：现坐实（陈旧钉）**。2026-11-08 逐条复算 1678 条输入：`web ui-routes` 923 条、`mobile-rn ui-routes` 2 条、`extension` 1 条一致；miniapp 侧 50 条不一致 —— i18n 4 语言输入（`en/ja/ko/zh-TW.json`）与 `zh-cn-pack` 输入 `zh-CN.json` 已变而产物未重生成（`remote-locales.gen.ts`/`remote-locale-manifest.gen.ts` 聚合钉 `58e4c4e8→ad4c9239`）；`miniapp ui-routes` 37 个被本轮 P0/P1 编辑过的页面/组件输入也不再匹配（聚合 `4adbac89→d7c5520c`）。处置：`pnpm gen:i18n` + `node apps/miniapp-taro/scripts/generate-ui-routes.mjs` 重生成（本轮按「不跑门」政策未执行，列为 XUI-076） |
| N-4 | 三端订单/退款状态机真值漂移 | 否证（2026-11-08 复核维持）：Web `PageClient.tsx:47-57` 的 `STATUS_CONFIG` 现含全部 7 个状态（pending/paid/cancelled/refunding/refunded/completed/failed）+ `STATUS_FALLBACK`；原「收缩」问题即 XUI-001，已修 |
| N-5 | rn-compat 缺 `Alert/Share/Keyboard/Animated/BackHandler/DeviceEventEmitter/InteractionManager/RefreshControl/KeyboardAvoidingView/NativeModules/useColorScheme` | 否证（2026-11-08 复核维持）：`RefreshControl` `primitives.tsx:634`、`KeyboardAvoidingView` `primitives.tsx:986`、`NativeModules` `primitives.tsx:1122`；其余 8 个在 `apis.ts` 导出 |
| N-6 | 「格式化 → 再解析」是一整族（千分位 / `toFixed` / `toLocaleString` 输出被 `Number()`/`parseFloat`/一元 `+` 再解析；`reduce` 字符串当数字累加） | **否证（范围内零新增）**：两端 + `packages/*/src` 全量扫描后，唯一真实可达仍是已修的 XUI-075；其余同型写法均无格式化输入路径，逐条依据见下 |

### N-6 扫描明细（2026-11-08，只读）

- 扫描面：`apps/miniapp-taro/src`、`apps/mobile-rn/src`、`packages/*/src`（排除 `*.test.*` 与 `node_modules`）。
- 扫描三类：① 格式化调用（`toLocaleString` / `toFixed` / `Intl.NumberFormat` / `formatPrice` / `formatAmount` / `formatMoney` / `formatTokenValue` / `formatWithdrawAmount` / `priceFmt`）；② 再解析点（`Number(` / `parseFloat(` / `parseInt(` / 一元 `+` / `*` `/`）；③ `reduce` 累加。另做了「赋值变量 → 后续数值运算」与「格式化输出传入 JSX `value=` / 组件 prop → 下游解析」两条跨语句追踪。
- 唯一真实命中（已修）：`apps/miniapp-taro/src/pkg-shop/wallet/withdrawal/withdrawal-props.ts` 的 `onFillAll` 曾把 `formatWithdrawAmount(balance)`（`1,234.56`）写进输入框，提交时 `Number()` → `NaN`。修复 `1a24120be2` 新增 `parseWithdrawAmount`，夹具 3 条旧码 3 红。
- 同型但不可达 / 非本族（逐条排除依据）：
  1. `apps/mobile-rn/src/screens/WithdrawScreen.tsx:128` `Number(amount)`：共享屏 `onFillAll` 为可选，RN 壳未传（`packages/app/src/features/withdraw/WithdrawScreen.tsx` 仅回调），无「全部」把格式化余额写入输入框的路径；输入为原始键盘文本。
  2. `apps/miniapp-taro/src/pkg-shop/pay/index.tsx:130`、`apps/miniapp-taro/src/pkg-shop/vip/success.tsx:51` `Number(router.params.amount)`：`pkg-shop/pay/index` 全部导航点（订单列表 `rawAmountRef`、课程详情 `amount`）传原始数值字符串；`vip/success` 由 `vip/index` 以数值跳转，均无 `toLocaleString`/千分位来源。
  3. `apps/mobile-rn/src/screens/PurchaseScreen.tsx:194` `parseInt(amountText.replace(/[^\d]/g,''))`：`keyboardType="number-pad"` 只收整元，且该 `/[\d]/` 过滤器对粘贴 `1,000` 仍得 `1000`；无小数分单位设计，不属格式化输出再解析。
  4. `apps/miniapp-taro/src/pkg-ai/developer/withdrawal.tsx:66` `reduce + Number(it.amount)`：`it.amount` 类型 `number`，上游 numeric 原文（`1234.56`）无分组分隔符；`apps/mobile-rn/src/screens/CartScreen.tsx:112` 同型，`normalizeCartGoods` 已 `Number()` 归一 `price/quantity`，累加起点为数字，不产生字符串拼接。
  5. `packages/api-client/src/endpoints/agent-usage.ts:40-41` `Number(it.prompt) || 0`：上游为原始整数/数字串，无格式化；`|| 0` 只吞空值（与 API 侧 F-698/F-699 的 `int8 → string` 是另一族，且不在本次两端范围，未重复上报）。
  6. `apps/mobile-rn/src/screens/AgentListPanel.tsx:61-65` `String(parseFloat((cents / 100).toFixed(2)))`：仅用于去尾零，roundtrip 无分组、无精度损失（分值最多 2 位）。
  7. `packages/shared/src/utils/format.ts` 的 `formatPrice` / `formatAmount` / `formatMoney` / `formatTokenValue` 输出（含 `formatAmount` 的 `toLocaleString` 千分位）：两端消费点全部止于 JSX/文案，无 `Number()`/`parseFloat`/一元 `+` 消费；JSX `value={…format…}` 在两端与 `packages/app/src` 零命中，故不存在「格式化值预填表单 → 提交解析」入口。
- 结论：该族在两端 + packages 内零新增；XUI-075 已是唯一实例并修复。若后续新增把格式化文案回灌输入框/接口的代码，按本清单第 1 条模式加夹具拦截。

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

- **新增条数**：74 条（P0 14 / P1 33 / P2 27）。
- **第 6 轮新增**：+2（XUI-075 提现千分位、XUI-076 派生产物陈旧钉）；复核坐实 1（N-3），复核维持否证 7（N-1/N-2/N-4/N-5/N-6 + XUI-011/XUI-012）。
- **2026-11-08 补充**：XUI-076 已产出重生成清单（4 产物 + 4 个 b64 载荷 / 二轮复算 2+8+8+43 条不一致输入 / 钉与复算 sha 全量），解冻但暂缓重生成，等 API 线 AI 计费落地后由单一写入者执行；N-6「格式化→再解析」族扫描零新增。
- **覆盖清单**：三端入口与路由真值 · 共享包导出/types · 订单/会员/分销/退款/提现/充值/支付链 · RN 导航注册与登录态 · 小程序存储键与页面栈 · rn-compat 全量导出与消费交叉 · 共享 hook/状态机/SSE/通知/权限 · i18n 与共享屏契约 · 平台权限/键盘/SafeArea/后台切换 · 输入单位与时区。
- **仍可深挖的方向**：见「未判定」U-1..U-7；另建议补两条静态面：(a) `apps/extension` UI 面（本次扫描范围外）；(b) api-client `dist` 产物与 `src` 逐符号差异（需构建，非只读）。

## 七、2026-11-08 跨端二批（已推 `fix/crossui-p0-p1-1108`）

- **XUI-077 倒计时自减 → shared `useCountdown`（截止戳派生）**：miniapp 4 文件（forgot-password、phone 双冷却、email、account-cancel 60s+5s 双计时）+ RN 1（AccountCancelScreen 60s+5s），后台跨截止回前台在 `useDidShow` / `AppState active` 里显式 `sync()`。`pkg-shop/pay:187` 核实为 `deadlineRef + Date.now()` 轮询计时，未动，夹具做守卫。
- **XUI-078 自动分支空壳**：`scripts/gen-rn-host-shell.mjs` 旧模板无条件声明 `useI18n/useTheme/useNavigation`，零腿/部分腿壳留下未使用变量并产出空 props；已在 `legs=[]` 时不再声明任何 hook、按腿声明、零腿写单行自闭合。R3 旧口径只查 seedable，屏涨出数据腿后旧壳永不复查；现补「带标记但契约不可复现 ⇒ 陈旧」+ 孤儿扫描（按生成物自身 `--screen=` 溯源行反查，不依赖登记表）。
- **三枚自动分支壳的定性**：`FinanceScreen`/`FollowingScreen`/`HelpDetailScreen` 在 `scripts/data/rn-host-shell-manual.json` 均为 `not-applicable`（RN 路由已删：并入 Wallet / Follow / Help 内联展开），且当前契约必填业务数据腿（classify=needs-manual），本器按「不产半成品」拒绝生成（写出=0，点名缺腿）。那三枚 `+28` 空壳是旧模板产物，应在合并侧丢弃而不是修壳；用真实分支文件实测 `--check` 能被 R3 点名（`屏已 needs-manual(缺腿 error, loading, summary)`）。

## 八、2026-11-08 金额单位全扫（已推 `fix/crossui-p0-p1-1108`）

> 起点：`ffa7594775` 把 web 三处「分」当「元」放大 100 倍；本批把同型错误在 web / RN / 小程序 / shared 全扫，并逐端点确认服务端收分还是收元。
> 服务端契约基线见 `apps/api/src/routes/{order,payment-gateway,distribution,wallet,teacher}.ts` 与 `apps/api/src/db/{payment-queries,commission-queries,order-queries}.ts`（摘要：微信支付/提现/佣金/钱包收分；支付宝小程序下单/订单 payAmount/课程 lessons 收元；plans 表 price 为分；developerPricing 为元）。

### A 档：实际扣错钱（已修）

- **XUI-079 小程序支付宝下单分当元**（P0，已修 `2cd995ca5d`）
  - 文件与行号：`apps/miniapp-taro/src/pkg-shop/pay/index.tsx:274-277`
  - 根因：`finalAmount` 来自 `orders.amount`（分），原样传给 `POST /payments/alipay/miniapp/create`；服务端该端点收「元」并在内部 `Math.round(amountYuan*100)`（`payment-gateway.ts:1096,1110`）⇒ 实付放大 100 倍。
  - 修复：`amount: finalAmount / 100`。
  - 夹具：`apps/miniapp-taro/src/pkg-shop/__tests__/money-unit.test.ts`（含服务端契约锁）。
- **XUI-080 小程序提现分/元三处错位**（P0，已修 `2cd995ca5d`）
  - 文件与行号：`apps/miniapp-taro/src/pkg-shop/wallet/withdrawal/index.tsx:71,107`（余额）/`:fillAll`/`:onSubmit`
  - 根因：`getDistributionInfo().available` 与 `availableWithdrawal` 同源为「分」，但共享 `WithdrawScreen` 的 `balance` 约定为「元」；提交 `amount` 服务端收「分」，小程序把用户输入的「元」原样提交 ⇒ 余额放大 100 倍、实提缩 100 倍。
  - 修复：`availableYuan = available/100`、`balance={availableYuan}`、`fillAll` 用 `available/100`、提交 `Math.round(amt*100)`、余额不足判断改分域比较。
  - 三端对照：RN（XUI-014）与 web 均按元展示、元→分提交；仅小程序未转。

### B 档：用户看到错数字（已修）

- **XUI-081 web 智能体详情/精选/分类仍按元渲染分价格**（P1，已修 `8f7b3b3036`）
  - 文件与行号：`apps/web/app/(main)/agents/[id]/PageClient.tsx:276,316`；`agents/featured/page.tsx:141`；`agents/categories/[id]/PageClient.tsx:182`
  - 根因：同源 `/api/agents/list` 的 `agent.price` 为分；`AgentGrid`/`agents/my`/`AgentsTable` 已在 `ffa7594775` 修过，这三页漏网。
  - 修复：统一 `/100`（详情用 `priceFmt.format(agent.price / 100)`，列表用 `¥${(agent.price/100).toFixed(2)}`）。
  - 夹具：扩 `apps/web/tests/xui-058b-price-unit.test.ts`。
- **XUI-082 RN 支付确认弹窗把元再除 100**（P1，已修 `a6413ea859`）
  - 文件与行号：`apps/mobile-rn/src/screens/PaymentScreen.tsx:169-174`
  - 根因：`pendingPurchase.amount` 来自 `/payments/me` 的 `payAmount`（元，`payment-queries.ts:98`），展示又 `/100`；而同文件 `:129` 发送时 `*100` 是正确的，同字段方向相反 ⇒ 弹窗显示 1/100。
  - 修复：弹窗直接传元值（`ConfirmPurchasePopUp.formatPrice` 不做换算）。
- **XUI-083 RN 订单详情映射不存在的 `amount`**（P1，已修 `a6413ea859`）
  - 文件与行号：`apps/mobile-rn/src/screens/OrderDetailScreen.tsx:60-70,93-95`
  - 根因：`GET /orders/:no` 返回 edu_orders 原始行，只有 `payAmount`（元），无 `amount`（`order.ts:486-494`）⇒ `amount=undefined`：详情金额空白、立即支付 `NaN`、退款体字段被丢弃（`refundAmount` 传 number 还会被 `priceSchema` 拒）。
  - 修复：`amount: Number(row.payAmount ?? row.amount ?? 0) || 0`；退款 `refundAmount: order.amount.toFixed(2)`（后端要求两位小数字符串）。
  - 夹具：`apps/mobile-rn/src/lib/__tests__/money-unit-rn.test.ts`。

### 一致（复核过，不改码；下次再报先看这里）

- `packages/app/src/features/course-tab/CourseTabScreen.tsx:75`（`more-course/MoreCourseScreen.tsx:47`、`course-enroll/CourseEnrollScreen.tsx:18` 同型）：不除 100 是**正确**的。数据源 `lessons.price` 为 `numeric(10,2)`「元」（`apps/api/src/routes/user/course-routes.ts:57`），RN `CourseScreen.tsx:63` 与小程序 `pkg-learn/course/list.tsx` 均直接传元。
- `packages/app/src/features/plaza/PlazaScreen.tsx:59`：`lowestPrice/peakPrice` 是 DB `numeric(12,2)` 元，API 入参出参均元，不除正确。
- `apps/miniapp-taro/src/pages/member/index.tsx:426,429,464,467`：`entryLevel/permanentLevel` 用原始 `VipLevel.price`（分）走共享 `formatPrice`（/100）正确；`toLevelItems` 另行 /100 喂按元渲染的 `VipLevelsSection`，**不是双除**。
- `apps/miniapp-taro/src/pkg-shop/vip/upgrade.tsx`：`buildUpgradeLevels` 已 /100 产出元，展示与支付宝下单（收元）一致。
- `apps/miniapp-taro/src/pkg-shop/wallet/recharge/index.tsx`：`resolveRechargeAmount` 返回元；支付宝传元、微信 `yuanToCents` 转分，两端一致。
- `apps/web/app/(main)/developer/relay/subscriptions/page.tsx:30,134` 与 `apps/web/app/(main)/user/subscription/page.tsx:57,223`：`plans.price` 在 DB 是 integer 分（`packages/database/src/schema/billing.ts:30`，`payment-extended.ts:406` 亦按 /100 换元），故 `formatPrice` /100 正确。
- `apps/web/app/(main)/learn/*`、`edu/shop`：`lessons.price` 为元，不除正确；`vip/**` 的 `formatCNY` 按分转元正确。
- `apps/mobile-rn/src/screens/CartScreen.tsx` 与 `PaymentScreen.tsx:129`：元→分发送，正确。
- `apps/miniapp-taro/src/pkg-shop/wallet/withdrawal/withdrawal-props.ts:51`：用户输入先剥千分位再转数（XUI-075 已修）。

### 不可达 / 非缺陷（留痕，防重复上报）

- `apps/mobile-rn/src/components/EarningsStatisticsCard.tsx:80` `formatAmount` 不除 100：全仓无业务导入（仅自身文件 + 测试断言 RN 源码不含该组件），实际不可达。若未来启用，amount 需按分处理。
- `packages/app/src/features/cards/CourseCard.tsx:55` `/100`：唯一消费方 `SharedDemoScreen`（演示屏），演示数据按分传入，自洽；生产业务未使用。
- 类别 4 扫描：`Number(sum.toFixed(2))`（web procurement 汇总）、`amount.toLocaleString()`（`pkg-shop/vip-trader`、`pkg-user/bill`）均只在元域内展示/舍入，无单位反转；`formatPrice` 结果未被 `Number()/parseFloat` 回读。

### 收口结论（2026-11-08 复核：本节两条均已定论）

- `apps/web/app/(main)/admin/api-platform/packages/ApiPackageTable.tsx:68` `¥{p.price}`：**确证为缺陷并已闭合**。`plans.price` 是 integer「分」（`packages/database/src/schema/billing.ts:30`；`admin-api-platform.ts` 写入 schema `price: z.number().int()`），旧表/回填/提交三腿都把分当元 ⇒ XUI-084，修 `f219b27053`，收口见第九节「XUI-084 已闭合」。
- `apps/web/app/(main)/wallet/page.tsx:209,212` `formatPrice(it.quantity)` / `it.balanceAfter`：`/wallet/transactions` **不存在**（全仓 0 命中），实际端点是 `/finance/margin/flows`。`token_flows.quantity/balance_after` 在 op_type 0–5 是「分」，`formatPrice` 对钱腿正确；op_type 6 是 API 配额计数（同列两义）⇒ XUI-085，已让钱流水端点默认排除 `op_type=6`（`ec179dfd99`）。

## 九、2026-11-08 金额单位收尾（已推 `fix/crossui-p0-p1-1108`）

### XUI-084 后台 API 套餐 price 分当元（三腿，**已闭合** + 换算收口）

- **量纲三段核定（同一结论：库里分、传输分、界面元）**
  - 声明：`packages/database/src/schema/billing.ts:23`（注释「price 以分为单位（integer）」）、`:30`（`price: integer('price').notNull()`）。
  - 传输：`apps/api/src/routes/admin-api-platform.ts:40`（create）、`:59`（update）`price: z.number().int().min(0)`，只收整数分。
  - 展示/回填/提交：唯一换算点 `apps/web/app/(main)/admin/api-platform/packages/price-unit.ts:7-19`（`ADMIN_PACKAGE_PRICE_UNIT='fen'`、`priceCentsToYuanText`、`priceCentsToFormYuan`、`formYuanToPriceCents`、`packageToForm`）。
- **消费点（仅三处，全部 import 该模块，不再自己算）**
  - `.../packages/ApiPackageTable.tsx:19`（import）→ `:70` 单元格 `priceCentsToYuanText(p.price)`。
  - `.../packages/helpers.ts:30`（`export { packageToForm } from './price-unit'`，自有实现已删）。
  - `.../packages/page.tsx:16`（import）→ `:71` 编辑回填 `setForm(packageToForm(p))`、`:39` 提交 `price: formYuanToPriceCents(form.price)`。
- **「只有一处换算」判据**：在 `.../packages/` 目录 grep `\*100|\* 100|/100|/ 100`，仅命中 `price-unit.ts:10,14,18`；三个消费文件 0 命中。
- **首尾相等夹具**：`apps/web/tests/xui-admin-package-price.test.ts`（5 例绿）。真实生产函数链 `backendRow(cents) → packageToForm → priceCentsToYuanText → formYuanToPriceCents → 与原 cents 相等`，数值组 0/1/2999/19900/12345（如 2999 → `¥29.99` → 29.99 → 2999）。反例：`¥${2999}` ≠ `¥29.99`、`String(2999)` ≠ `29.99`（即 `f219b27053` 前的写法）。另锁 billing schema 注释与 route int schema。
- **相邻（非量纲，未改）**：该页 `quota/period/status` 与本仓 `plans`（`interval/features/isActive`）不同源，属字段模型差异，不并入本条量纲结论。

### XUI-085 `token_flows` 字段定义（同列两义，已写清 + 端点拆分 `ec179dfd99`）

`token_flows.quantity` / `balance_after` 的**真实单位**：

| op_type | 含义 | `quantity` 单位 | `balance_after` 单位 |
|---|---|---|---|
| 0 充值/入账 · 1 扣减(提现/消费) · 2 过期清零 · 3 退款扣回 · 4 Relay 转账至 API Key · 5 管理员调整(带符号) | 钱包金额流水 | **分** | `user_margins.token_quantity`，**分** |
| 6 API 订阅配额发放 | API 配额流水 | **配额计数（个）** | `developer_api_keys.token_balance`，**配额余额（个，-1=不限）** |

- 证据：充值落 `orders.amount`（分）；买课扣 `priceCents`；提现落 `amount`（分）；op_type 6 写 `appliedQuota` / `tokenBalance`（`api-subscription-service.ts`）。
- 处置（按「先写清字段是什么」）：`packages/database/src/schema/wallet.ts` 注释写清两义；`/finance/margin/flows` 未显式指定 `opType` 时排除 `op_type=6`（显式 `opType=6` 仍可查，但返回值是配额计数）；`packages/api-client/src/endpoints/wallet.ts` 的 `MarginFlowItem` 注释改为「钱流水（op_type 0–5），金额单位分」。
- 一致判定：web `/wallet` 的 `formatPrice(it.quantity)` / `formatPrice(it.balanceAfter)` 对钱腿（0–5）正确，**不改**；`/wallet/withdraw|recharge/records` 的 `amount` 同为分，未发现消费端错用。
- 夹具：`apps/web/tests/xui-wallet-flow-unit.test.ts`（改前 3 红 → 改后 4 绿），含反例「配额 500000 当分格式化会显示 ¥5000.00」。
- **已修（`0b3724817a`）**：`apps/web/app/(main)/wallet/page.tsx` 的 opType 标签/正负号整体错位（原代码把 1 当「充值」，实际 1=扣减/提现；`positive` 集合把提现标成流入）→ 见第十节 XUI-086。
- **设计问题留档（未动）**：AI 计费腿把 LLM token 计数传入同一列（`token-balance-service` 的 `deductTokens(tokens)`），单位口径需专项确认；本次不改成计费规则。

### 端到端量纲断言（已加 `79eac0bbcf`）

- 文件：`apps/miniapp-taro/src/pkg-shop/__tests__/money-unit.test.ts`（12 绿）。
- 支付宝下单：订单 199 元（`orders.amount=19900` 分）⇒ 请求体 `199` ⇒ 服务端 `Math.round(199 * 100)=19900` 分 ⇒ **首尾相等**；反例：分当元直传 ⇒ 落库 1990000 分（放大 100 倍）。
- 提现：输入 199 元 ⇒ 请求体 `19900` 分 ⇒ 与 `availableWithdrawal=19900` 分相等（余额不足判断同域）；反例：元当分直传 ⇒ 199 分 = ¥1.99（缩 100 倍）。
- 目的：两端单测各自自洽仍可能合起来错 100 倍，此断言锁「请求体 ⇄ 服务端落库」首尾相等。

### 台账位置

- 本文件（仓库内 `docs/tickets/2026-11/findings-crossui.md`）为唯一真相，随提交推送；文档外工作副本已删除，不再维护第二份。

## 十、2026-11-08 opType 方向修正 + AI 计费腿判定（`fix/crossui-p0-p1-1108`）

### XUI-086 钱包流水 opType 文案/符号/颜色（**已修**：shared 唯一表 + 三腿同源）

权威枚举以写入点为准（`packages/database/src/schema/wallet.ts` 注释已同步）：

| opType | 写入点 | 业务动作 | 方向 |
|---|---|---|---|
| 0 | `rechargeToken` | 充值/入账 | + |
| 1 | `deductToken` / 提现 | 扣减 | − |
| 2 | `expireToken` | 过期清零 | − |
| 3 | `refundTokenDeduct` | 退款扣回 | − |
| 4 | `relay-billing-service` | 钱包转账至 API Key | − |
| 5 | 管理员调整 | `quantity` 带符号 | ± |
| 6 | `api-subscription-service` | API 配额发放（非金额，钱流水已排除） | 中性 |

- **全仓唯一表**：`packages/shared/src/utils/wallet-flow-meta.ts:44-118`（`resolveWalletFlowMeta(opType, quantity)` → `{labelKey, sign, kind, isMoney, colorClass}`），经 `packages/shared/package.json` 的 `./utils/*` 子路径导出。**`apps/web/lib/wallet-flow-meta.ts` 已删除**（`git status` 为 `D`），不留第二份映射，也没有 re-export 壳。
- **三腿调用点（全部指向唯一表）**
  - web 钱包：`apps/web/app/(main)/wallet/page.tsx:25`（import）→ `:187`（resolve）→ `:191` 文案 / `:194` 颜色 / `:196-209` 符号与 `isMoney` 分支。
  - web 分销 token：`apps/web/app/(main)/distribution/token/page.tsx:33`（import）→ `:59`（`useTranslations('wallet')`）→ `:150`（筛选标签）→ `:196-213`（文案/颜色/符号）。
  - RN：渲染在共享屏 `packages/app/src/features/wallet/WalletScreen.tsx:16`（import）→ `:212`（resolve）→ `:213-218`（按 sign 取色）→ `:222-232`（`isMoney` 分支）→ `:324`（`flowNeutral` 样式）；宿主 `apps/mobile-rn/src/screens/WalletScreen.tsx:9`（引 `WalletScreen as SharedWalletScreen`）→ `:173`（只把 items 交出去），无 opType 判断。
  - 小程序：`apps/miniapp-taro/src/pkg-shop/wallet/index.tsx:15`（`WalletScreen as WalletScreenShell`）→ `:17-22`（壳承载），为共享屏镜像，零本地映射。
- **改前反例（同一病，两腿同时中招）**：共享屏原 `OP_TYPE_KEY`(1..5) 缺 0/6，`POSITIVE_OP_TYPES = new Set([1,4,5])` + `positive ? '+' : '-'` ⇒ 0 显示「0」+负号、1/4 显示 `+¥` 绿色、5 不看 `quantity` 符号、6 显示 `-¥` 红色并套金额色；未知值无兜底。web 原 `?? 'flowRecharge'` 同型。
- **opType 6 判据**：`flowQuota` / `sign:'neutral'` / `kind:'quota'` / `isMoney:false` / `colorClass:'text-muted-foreground'`；三腿一律 `meta.isMoney ? ±¥金额 : 纯数量`，故 6 无 ±、无 ¥、无金额色。文案：`flowQuota` = 「配额类变动」。
- **未知 opType 判据**：`flowOther` + neutral + 中性灰，不得默认收入/支出。
- **钱包合计：证伪**。三腿钱包页（web `wallet/page.tsx`、共享屏 `WalletScreen.tsx`、RN/小程序宿主）均无按 opType 求和的金额合计；共享屏仅 `flows.total`（`:181`、`:193`）为分页条数，非金额。判据：在上述四文件搜索 `reduce(`/`totalAmount`/`sum(`，无金额累加命中。故「6 不进合计」无需额外代码，逻辑上也不可得。
- **「无任何一腿保留自有正负号判断」依据**：在上述四目录（`apps/web/app`、`apps/mobile-rn/src`、`apps/miniapp-taro/src`、`packages/app/src`）grep `POSITIVE_OP_TYPES|OP_TYPE_KEY|opType\s*===\s*\d+\s*\?` ⇒ **0 命中**；仅测试断言字符串与历史文档残留。
- i18n：shared + web 5 语言 `wallet` 补 `flowRecharge/flowDeduct/flowExpire/flowRefund/flowRelayRecharge/flowAdminAdjust/flowQuota/flowOther`（此前 wallet 命名空间缺这些 key，页面标签实际是裸奔）；mobile-rn 删除已成死键的 `wallet.opType1..5`；`gen:i18n` 同笔重生成 4 份 `*.b64.txt` + 3 份 `*.gen.ts`。
- 夹具：`packages/shared/src/utils/wallet-flow-meta.test.ts`（5 绿：0/1-4/5±/6/未知）、`packages/app/tests/wallet-flow-optype.test.ts`（3 绿：共享屏 + RN 宿主 + 小程序镜像源码锁）、`apps/web/tests/xui-wallet-optype-display.test.ts`（web 两页 + 唯一表存在性 + 多语言键齐全）。

### XUI-087 AI 计费腿把 LLM token 数写入资金账（判定：污染；处置改 **B**，由 API 线统一修）

结论：**会污染资金账，须修；但不影响提现可用额。** 2026-11-08 用户决定：撤销 A（止血），改 B（接真实成本），且整块由 API 线统一修改，本线**不动** `ai-callback*` / `crew*` / `stock-service` / `proxy-tools`，避免两边写同一批代码。

- 事实链：`ai-callback.ts` 取 `tokens = usage.total_tokens`（LLM token 计数）→ `ai-callback-worker.ts:142-159` 先 `recordAiCost(...)`（真实成本、单位分，**正确**）→ 紧接着 `ai-callback-worker.ts:160-166` 仍 `server.tokenBalance.deductTokens(userId, tokens, …)`（**原始 tokens 当分**）→ `token-balance-service.ts:169-260` 直接减 `user_margins.token_quantity`，并写 `token_flows` op_type=1、quantity=tokens。**异步 worker 与 route 同错，只修其一无效**（API 线查证结论）。
- 后果：一条 5,000 token 的回复会把余额扣掉 5,000 分 = ¥50.00；用户可在 `/finance/margin/flows`（钱流水）看到该笔「扣减」，量纲错得离谱。
- 不受影响：`availableWithdrawal` 由 `commissionFlows` 汇总（`commission-queries.ts:674-682`），与 `token_quantity` 无关，**提现可用额不受污染**。
- 同型调用点（同风险，同批由 API 线处理）：`proxy-tools.ts:992`（`text.length + answer.length` 当分）、`proxy-tools.ts:1180`（固定 1500）、`stock-service.ts:262`（`chars/4 + 800` 估算）、`crew.ts:198,277`。
- **「token → 分」定价表查证结论：仓内存在，B 方案有现成依据**（本线只读核实，未臆造费率）：
  - `packages/database/src/schema/billing.ts:157-182` —— `ai_pricing` 表，字段 `input_token_price` / `output_token_price`，`numeric(18,6)`，注释明写单位「**分/千 token**（CNY）」；`billing_mode` 支持 token / per_call / per_image / per_video。
  - `apps/api/src/services/pricing-service.ts:198-218` —— `calculateCost()`：`inputCost = roundCents((inputTokens / 1000) * inputTokenPrice)`，output 同式，返回单位「分」（6 位小数）。
  - `apps/api/src/plugins/ai-cost.ts:449-512` —— `recordAiCost()` 未显式传 `cost` 时调用 `calculateCost()`，把成本落 `ai_cost_records.cost`（分），`totalTokens` 仅作审计；该链路**已经在用**。
  - 旁证同口径：`packages/database/src/schema/ai-config.ts:142-164` 的 `ai_model_configs.input_price_per_1k` / `output_price_per_1k`（分/千 token）+ `relay_price_multiplier`；`packages/database/seed/relay-pricing-seed.ts:126-127` 从 `ai_pricing` 回填；`apps/api/src/services/litellm-price-sync.ts:12-13` 注明同单位。
- 正确修法（交 API 线）：扣费一律用 `calculateCost()` / `recordAiCost()` 得出的**分**值（或复用同一次 `recordAiCost` 的结果），`deductTokens` 收折算后的分；**禁止把原始 token 数当金额传**。两条铁律不变：`token_flows.quantity` 不再加第三种含义；钱流水只留 op_type 0–5，配额/计费量迁出资金列。
- 本线边界：不改上述 4 个同型文件；已完成的钱包展示修复（opType 权威枚举、shared `wallet-flow-meta.ts` 唯一表、五语言 key、三份夹具）保留，不回滚。
- 待确认：已消解（B 已定；定价表存在，无「需产品定义费率」的缺口）。
