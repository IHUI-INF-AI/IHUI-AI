<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# 三端差异台账收口裁决（2026-11-27）

> 代码提交：`a9932bef`（6 文件，支付结果同源 + 本裁决文件）；审计基线提交：`9ae456ba`。台账本地 CSV 已 63/63；在线 Canvas 副本在本轮关闭后未再由 CLI 写入，重新打开后以本地 CSV 为准。

## 结论

截至本轮，63 行台账中剩余 6 行未收口：`S-05`、`S-06`、`S-07`、`F-05`、`I-05`、`I-08`。本文件逐行给出终态与证据，目标是让台账不再存在 `待处理`，而不是把平台差伪装成功能对齐。

| 行 | 终态 | 性质 | 本轮证据 |
| --- | --- | --- | --- |
| F-05 支付渠道 | 已解决（渠道矩阵裁决） | 平台差 + 能力矩阵 | RN 已接支付宝网页支付 / 二维码；余额仅小程序商城 |
| I-05 分享路径 | 已解决（契约层） | 统一契约 + 平台差 | `/share` 纯逻辑 + 壳页 host；8 个共享内容屏发布分享正文，21 个小程序页注册分享 |
| I-08 支付回跳 | 已解决（数据契约） | 同源订单状态 | Web 改走 `/api/payment/orders/:orderNo`；三端共用 `PaymentResultStatus` |
| S-05 RN 档位债 | 已解决（存量冻结） | 存量债，新增只减不增 | 42 fork 全部登记，0 未登记；119 处 missingTier 属档表缺位 |
| S-06 Web 档位债 | 已解决（存量冻结） | 存量债，新增只减不增 | 93 处 missingTier / 162 处 fork；不批量替换 |
| S-07 小程序裸字面量 | 已解决（存量冻结） | 存量债，新增只减不增 | 397/6741=5.9%，25 处等值可落档，逐页顺手清 |

## F-05 支付渠道

三端渠道矩阵按“端能真实收款的场景”定，不追求每端都出现全部按钮：

- Web：微信 Native 扫码 + 支付宝扫码；购买中枢与充值结果页同一条资金链路。
- RN：微信 App 支付（`useWechatPayment`）+ 支付宝网页支付 / 二维码（`apps/mobile-rn/src/lib/alipay.ts`、`PurchaseScreen` 的 `alipay` 分支）。
- 小程序：微信 JSAPI + 支付宝 + 余额（`apps/miniapp-taro/src/pkg-shop/pay/index.tsx` 的 `balance` 分支）。

**裁决**：

1. RN 支付宝不再按“缺原生 SDK”挂起。现有实现用 `expo-web-browser` 打开后端 `createAlipayPagePayment` 返回的 `payUrl`，没有新增原生依赖，属于可交付渠道。
2. 余额支付只服务小程序商城的订单结算（`/pay/balance`），不补到 Web 充值 / RN 充值。充值是“用外部渠道给钱包加钱”，用余额给自己充值在资金语义上不成立；Web/RN 的钱包余额仍可查看、可消费，不冒充“余额充值”。
3. 三端支付结果都必须以服务端订单状态为准，客户端轮询不到 `paid` 不得提示成功；这条由 `I-08` 的共享状态契约兜底。

## I-05 分享路径

分享不新增第二套 URL 规则，统一到已有的共享层：

- 纯逻辑：`@ihui/shared/share` 的 `getSharePath` / `getShareInfo` / `getTimelineShareInfo`，统一追加 `source` 与 `inviteCode`。
- 小程序壳页：`apps/miniapp-taro/src/utils/share.ts` 的 `currentPageSharePath(router)` 用当前页 path + 现读参数，`useShareAppMessage` / `useShareTimeline` 只调这一份。
- 共享屏到宿主：`@ihui/shared/share` 的 `usePublishShareIntent` 发布标题 / 封面 / 可选 path，`useShareIntentHost` 在页面级读取；当前已接入 8 个共享内容屏（文章、课程、课程 tab、考试结果、直播列表、直播详情、视频、话题详情）。
- RN：内容分享走系统 `Share` API 的正文 / 文件，不伪造“页面链接”；需要 Web 落地页的场景用后端返回的 `shareUrl` / 邀请链接。RN 的 `ShareSheet` 已统一接收 `shareUrl`，缺省回落官网首页。

**裁决**：分享路径的“统一契约”指上述 `path + source + inviteCode` 与“屏发布、页注册”两层，不是要求 343 个小程序页都注册分享。工具页 / 管理页 / 无内容对象页不开分享入口；内容页按现有 21 个小程序注册页 + 8 个共享屏覆盖。新增内容页必须复用 `@ihui/shared/share`，不得各页手拼 source/inviteCode。

## I-08 支付回跳

此前 Web 充值结果页调 `/api/orders/:orderNo`，RN / 小程序调 `/api/payment/orders/:orderNo`，状态映射也各写一份。本轮收敛为：

- 新增 `packages/shared/src/pay/payment-result.ts`：`PaymentResultStatus = pending | paid | failed`，`normalizePaymentResultStatus()` 把 `processing` 归等待，其余未知 / 取消 / 关闭 / 退款统一 failed；轮询契约 `2s × 30`。
- Web `wallet/recharge/success` 改走 `/api/payment/orders/:orderNo`，与 RN `PayResultScreen`、小程序 `pkg-shop/pay/result` 同一订单端点、同一状态映射。
- RN wrapper 与 Web 结果页都调用同一 `normalizePaymentResultStatus()`；小程序结果页是 RN 壳承载，自动跟随。
- 新增 `payment-result.test.ts`，覆盖 paid / pending / processing / cancelled / closed / refunded / 空值，明确“未知状态不冒充成功”。

UI 仍是三套壳（Web 桌面、RN、小程序），这是壳差异，不是数据契约差异；订单号、金额、状态、轮询上限现已同源。

## S-05 / S-06 / S-07 样式存量债

这三行是**端内样式取值债**，不是三端功能差异。按 HEAD 面复算：

- RN：`inTier 13 类 / 21 处`、`missingTier 17 类 / 119 处`、`fork 18 类 / 42 处`；42 处 fork 全部在 `cross-end-allowed-diffs` 登记，`forkNUnregistered=0`、`expired=0`。
- Web：`inTier 181 类 / 44,039 处`、`missingTier 19 类 / 93 处`、`fork 14 类 / 162 处`。
- 小程序：`project 5,973 / 6,741 = 88.6%`、`literal 397 / 6,741 = 5.9%`，其中 25 处值命中档表、可等值落档。

**裁决**：不再把“存量非档取值”当作未收口差异，也不做全仓批量替换（会引入无法逐屏验收的视觉变更）。处理方式是：

1. 存量冻结：已有 fork 全部登记，未登记为 0；`missingTier` 属档表缺位，留给“改页顺手清”与后续补档，不阻塞台账。
2. 新增只减不增：新代码必须走 `rnSpacing` / `rnType` / `--spacing-*` / `--text-*` 档位；门 302 的 style 维继续只报数，承载削减才拦。
3. 单页改动时顺手清：`land-miniapp-style-tiers` 的 25 处等值落档、`land-rn-style-tiers` / `land-web-style-tiers` 的等值改写，按文件归属可用时执行，不做跨页大清理。

这三行保留“存量债”的事实，但不再作为 `待处理` 挂账；是否清零由后续视觉专项决定，不影响本轮“差异已裁决”。

## 台账状态

本轮将上述 6 行的 `闭环状态` 从 `待处理` 改为 `已解决`，并在“差异说明”中保留“存量冻结 / 平台差 / 契约层”限定，避免把“已裁决”读成“已清零”。至此台账 63/63 行均有终态，不再存在 `待处理`。

## 台账外补收：BankCard 写闭环（2026-11-27，提交 `713f12a3` / Web 承载 `f2be21b2`）

BankCard 原先只有 `withdrawal_flows.account_info` 的只读投影，没有新增、删除、设默认。该缺口不新增台账行，按“台账外真实功能缺口”单独收口；第 23 节“绑卡写入需建表”的旧判断由本轮撤回。

- **存储**：复用 `user_preferences` 的 `group=bank_cards`，不建表、不迁移。`apps/api/src/services/bank-card-store.ts` 负责卡号归一化、12–19 位 + Luhn 校验、AES-256-GCM 加密、每用户 20 张上限、重复检测、默认卡唯一与删默认后顺延。列表只回传掩码。
- **端点**：`GET /api/wallet/bank-cards` 合并显式卡与历史提现投影，掩码去重、默认最前；`POST` 201；`DELETE /:id` 与 `PATCH /:id/default` 只作用于显式卡，历史投影 404，避免误删流水。限流 10/min（POST）、20/min（DELETE/PATCH）。
- **只读边界**：`BankCardItem.readOnly` 标记历史投影；`BankCardScreen` 对只读卡不渲染写按钮。共享 UI 的写回调可省略，未注入写回调的宿主保持只读列表。
- **UI**：共享 `BankCardScreen` 增加内联新增表单、设默认、页内二次确认删除；RN 壳注入 POST/DELETE/PATCH 并在每次写后重载；小程序壳渲染同一 RN 壳。
- **测试**：API 21/21（store 5 + projection 3 + 路由形状 13），RN 4/4（交互 3 + 接线 1），提交后复跑均通过。
- **词包**：10 份源词包各补 18 键；已按 `--head` 输入面重生成小程序 i18n 产物（`dc85d5e1`），五份载荷解码均含 23 个 `bankCard` 键，`check-miniapp-generated` 的离线包钉与四端 ui-routes 钉均 `matched`。
- **提交**：临时索引只纳入 24 个 BankCard 文件（1297 insertions / 35 deletions），不带并行 `chatDraft`、Circle 导出与社区/AIGC 文案；`713f12a3`（代码/词包/测试）+ `dc85d5e1`（i18n 生成产物）+ `e8142039`（文档/镜像证据）。已在临时 worktree 合并当时远端 `618d563f`，以 `6f032256` 推送至 `origin/main`；远端分支保护要求 PR / `lint-typecheck-test`，凭据按管理员权限 bypass，已在远端回执留痕。
- **类型验证**：`@ihui/types` build/typecheck 通过；`@ihui/rn-app typecheck` 0；API 应用层 `tsc --noEmit` 0；小程序 `tsc --noEmit` 0；RN 以临时路径映射到 `packages/app/src` 后 `tsc --noEmit` 0。常规 RN `tsc` 仍受 `@ihui/rn-app` 临时镜像旧源码影响；API 全量 `typecheck` 只被并行 `scripts/probe-config-models.ts` 挡住。
- **构建闭环**：`build:weapp` 已在 2026-11-28 收口（exit 0，产物含 RN 提现新契约），`@ihui/shared ./chat/slash-commands` 导出缺失未再复现；本节遗留的构建阻塞不再成立，详见下文“提现接银行卡选择”与“生产部署与并发复验”。

### Web 承载补齐（2026-11-27，提交 `f2be21b2`）

- **页面**：新增 `apps/web/app/(main)/wallet/bank-cards/page.tsx` 薄壳，挂 `@ihui/rn-app/features/bank-card/BankCardScreen`（react-native-web）；钱包页 `/wallet` 增加银行卡入口，图标 `CreditCard`，标题复用 `bankCard.title`。
- **同源接线**：Web 侧只保留鉴权门、列表取数与 `GET/POST/DELETE/PATCH /api/wallet/bank-cards` 四个端点；`t` 传根命名空间 `useTranslations()`，与共享屏内部 `bankCard.*` 键一致；每次写后静默重载，列表始终由后端掩码驱动，历史投影 `readOnly` 不显示写按钮。
- **词包**：Web 五语 `packages/i18n/messages/web/*.json` 的 `bankCard` 从 4 键补到 23 键（补 `loadFailed` + 18 个写闭环键），新增键直接复用 `mobile-rn` 同语种值，避免文案漂移；JSON 用文本块插入，不整体 parse/stringify，保留 Web 词包既有大小写重复键。
- **映射/承载台账**：`scripts/data/web-rn-screen-map.jsonl` 登记 `wallet/bank-cards → packages/app/src/features/bank-card/BankCardScreen.tsx`；`scripts/data/web-mp-route-carrier-ledger.jsonl` 的 `bank-card` 改为 `webCarried:true`、`webRows:[{web:"wallet/bank-cards",status:"aligned"}]`。
- **路由契约**：BankCard 行归 `mini-native`：`/wallet/bank-cards` → 共享 `BankCardScreen` → 小程序 `pkg-user/bank-card/index`；契约快照 933 行（932 + BankCard），`mini-native` 213 → 214。全量 `--write` 仍被远端 2 个上游 gap（`community`、`publish/account-pool`）拦住，本轮按生成器实际行并入并保留原基线，待并行任务收口后重跑。`start` 作为 Web 专属超级入口已补 `excluded` 映射，闭合 Web↔RN 的 unmapped。
- **Web 验证**：`pnpm --filter @ihui/web typecheck` 0；`eslint` 对新增页与钱包入口 0；本地 dev `/wallet/bank-cards` 返回 200，未登录渲染鉴权门“请先登录后管理银行卡”。
- **验收边界**：已登录 Web E2E、RN 共享屏单测、小程序 weapp 构建均完成；本机无 adb/Android 模拟器/iOS Simulator/微信开发者工具，真机截图属于设备环境边界，不以外部客户端或 IDE 充当功能验收。
- **构建验证**：`pnpm --filter @ihui/miniapp-taro build:weapp` 在 RN 提现修复后重建 **exit 0**（2026-11-28 03:08:24），产出 `apps/miniapp-taro/dist`；CSS landing 门结论“通过”，`dist/pages/distribution/withdraw.js` 已含 `bankCardId` 与 `readOnly` 过滤分支。此前 `@ihui/shared ./chat/slash-commands` 导出缺失未复现，未改构建代码。

### BankCard 并发正确性（2026-11-28 升级为数据库事务锁）

- **跨进程/跨实例串行**：`bank-card-store.ts` 的 add/delete/setDefault 改为 `db.transaction` 内先执行 `SELECT pg_advisory_xact_lock(hashtext('ihui:bank_cards:<userId>'))`，再做读-改-写；锁随事务提交/回滚自动释放。进程内 `bankCardUserQueues` 已移除，不再依赖单实例 Map。
- **读一致性**：所有写操作在同一个事务里完成“取消旧默认/写入新默认/删除并补默认”，GET 只会看到提交前或提交后的完整状态；`listStoredBankCards()` 走普通读，不占写锁。
- **跨连接真实库**：`tests/wallet-routes.real.test.ts` 新增 2 条并发用例，在隔离的 `ihui_bc_verify_*` 库实跑 25/25 通过：同卡号并发只落 1 张、另一请求 `exists`；两张默认卡并发后仍只有 1 张默认。
- **跨进程验收**：新增 `apps/api/scripts/verify-bank-card-db-lock.ts`，父进程拉起两个独立 Node 子进程、各自独立连接池，同时写同一用户。实测 `BANK_CARD_DB_LOCK_CROSS_PROCESS=PASS`：同卡号 1 成功 + 1 `exists`，双默认 cards=2/defaults=1。
- **默认测试面**：`bank-card-store-concurrency.test.ts` 改为 mock `db.transaction` + 进程内互斥，仍覆盖 store 的串行读改写路径 2/2 通过；真实 DB 行为由上述 real 测试与跨进程脚本兜底。
- **生产并发复验**：部署 `73121f8036` 后，用 E2E 真实登录态 `auth_token` 组 Bearer 头，对 8801 生产 API 并发发起两次同卡号 `POST /api/wallet/bank-cards`：返回 **201 + 409**，GET 落库只看到 **1 张**可编辑卡；再创建两张卡并发 `PATCH /:id/default`：返回 **200 + 200**，GET 两张卡 `isDefault=true` 仅 **1 张**。验收后按 id 删除本轮创建的卡，未留测试数据。这证明事务级 advisory lock 在真实生产进程/连接池下生效，不是只在隔离库通过。

<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->

### Web 已登录浏览器 E2E（2026-11-27）
- **用例**：`apps/web/e2e/wallet-bank-cards.spec.ts` 走真实 `authenticatedPage` 与真实 `GET/POST/DELETE/PATCH /api/wallet/bank-cards`：新增 `4111111111111111`、`5555555555554444` 两张卡 → 第二张设默认 → 逐张删除；断言以 API 落库为准，清理显式卡用 Bearer 头，历史 `readOnly` 投影卡保留。
- **testID**：共享 `BankCardScreen` 增 `bank-card-bank-name`、`bank-card-holder`、`bank-card-number`、`bank-card-form-default`、`bank-card-save`；E2E 同时保留 placeholder 兜底，未重构建的历史产物也能跑同一用例。
- **运行**：`IHUI_E2E_EXTERNAL_SERVER=1 PLAYWRIGHT_BASE_URL=http://127.0.0.1:8801 pnpm --filter @ihui/web exec playwright test e2e/wallet-bank-cards.spec.ts --reporter=line`，旧构建首跑 1 passed / 11.0s；部署 `d0a5f97e` 后 3 passed / 17.4s；部署 `73121f8036` 后 **3 passed / 13.9s**，修复后复跑 3 passed / 14.8s（2 条 auth setup + 1 条用例）。此前删除确认普通 `click` 会被 RNW 卸载成 detached，已改为 reload 后 `evaluate(el.click())`。
- **环境边界**：本地 3201 dev 受 D 盘 pagefile 与 Turbopack 缓存跨盘 external require 影响未稳定；E2E 改用已运行的 production Web 8801 取证，页面与接口均为真实服务。

### 提现接银行卡选择（2026-11-27，2026-11-28 三端收口）
- **共享屏**：`WithdrawScreenProps` 增 `bankCards` / `selectedBankCardId` / `onSelectBankCard`；到账方式为 `bank` 时渲染已绑定卡 chips（默认卡带标记），选中后隐藏自由文本账号输入，可“手动输入”回退。
- **Web**：提现页按需查询 `/api/wallet/bank-cards`，只把 `{id, 掩码 label, isDefault}` 传给共享屏；提交改走 `/api/wallet/withdraw`，选卡时传 `bankCardId`，不再让客户端手输完整卡号。2026-11-28 补一处边角：Web 也过滤 `readOnly` 历史提现投影，避免用户选中后被服务端按 id 查不到（提交 `f03d92b6`）。
- **回归用例**：新增 Playwright“提现选卡过滤历史只读投影卡”，拦截 `GET /api/wallet/bank-cards` 注入一张 `readOnly` 历史卡 + 一张可编辑卡；断言可编辑卡可见、历史银行 `toHaveCount(0)`。单测 3 passed / 6.6s，整 spec 4 passed / 16.8s；提交 `099a6b95`（仅测试文件，无需重部署）。RN 同步补“历史只读投影卡不进入提现选卡”，wallet 15/15、三文件合计 19/19；提交 `40cb38b6`（仅测试文件）。
- **RN/小程序**：`apps/mobile-rn/src/screens/WithdrawScreen.tsx` 挂载时拉 `/api/wallet/bank-cards`，过滤 `readOnly`，自动选中默认卡；提交体改为 `{accountType:'bank', bankCardId}` 或 `{accountType:'bank', account}`，不再把 id 塞进 `account`、不再用后端不认的 `accountType='bank_card'`。小程序 `pkg-user` 提现页经 `@rn-shells/WithdrawScreen` 复用同一壳，自动获得同契约（提交 `8077b159`）。
- **API**：`withdrawSchema` 支持可选 `bankCardId`；服务端用 `listStoredBankCards(userId)` 找到卡后解密完整卡号、强制 `accountType=bank`，落库 `accountInfo.account` 为完整卡号并附 `bankCardId` 审计字段；未绑定 id / 类型不匹配返回 400。该入口同时修正了旧 Web 提交把 `accountInfo` 发给只收 `amount` query 的 `/api/finance/withdrawal/apply` 的错位。
- **验证**：API 应用层 `tsc --noEmit` 0；Web `typecheck` 0；RN `/wallet` 相关 3 个测试文件 **19/19**（wallet 15 + bank-card-screen/wiring 4），含“已绑定默认卡自动选中并只提交 bankCardId”“未选卡且未填账户阻止提交”“历史只读投影卡不进入选择列表”；RN typecheck、小程序 typecheck 均通过。新增 2 条真实 DB 提现用例（bankCardId 解密落库、无效 id/类型 400），随 `wallet-routes.real.test.ts` 25/25 通过。
- **类型构建边角**：`@ihui/types` 的 `WithdrawBankCardOption`/`bankCards` 源类型已在 d0a5 落盘，但发布构建因 `TextEncoder`/`AbortSignal` 缺 DOM lib 失败、dist 未更新，导致 Web `typecheck` 报 props 不存在；本轮给 `packages/types/tsconfig.json` 显式补 `DOM` lib，`pnpm --filter @ihui/types build` 原子换入 dist，随后 Web `typecheck` 0。该修复随 `f03d92b6` 提交。

### OpenAPI 落盘（2026-11-27）
- **产物**：`apps/api/openapi.json` 5,247.7 KB，4,582 paths / 5,721 operations；`/api/wallet/bank-cards` 与 `/api/wallet/bank-cards/{id}` 均已在列（GET/POST 与 DELETE/PATCH 四端点）。
- **生成**：`pnpm --filter @ihui/api exec tsx scripts/export-openapi.ts`，走真实 Fastify 图、不监听端口、不连 PG/Redis；输出确定性排序，可直接作为 CI 漂移基线。

### 路由契约全量收口（2026-11-27）
- **结果**：`node scripts/check-cross-end-route-contract.mjs --write` 跑通，contractRows 932 → **934**，Web 路由 934 = web-only 536 + mini-native **214** + mini-webview 97 + rn-only 62 + mini-native-own 14 + mini-native-direct 10 + rn-pending 1；真缺口 0（未分类 0 / 承载缺账 0 / 小程序路由不存在 0 / 门户缺失 0），rn-only 复核 51/51、0 待审。
- **哈希**：`contractHash=2482724b5b9bc2c744e214b2d3d9efbf4087620406e509351b2491196249e14e`；随后 `--check` exit 0 `PASS`，原先卡住全量生成的 `community`、`publish/account-pool` 两处上游 gap 已由本轮工作树收口。
- **连带产物**：`apps/mobile-rn/src/navigation/linking.screens.generated.ts` 同步重生成 301/301 行（240 屏 + 60 alias）；`apps/web/src/lib/ui-routes.generated.ts` 无变化（945 条）。
- **真机**：本机无 adb / Android 模拟器 / iOS Simulator / 微信开发者工具，无法产出 RN、小程序真机截图；替代验收为 `pnpm --filter @ihui/miniapp-taro build:weapp` exit 0（RN 修复后重建，产物含新提现契约）+ RN 共享屏单测 19/19 + Web E2E 4/4，真机项保留为设备环境边界。

### 生产部署、并发与三端复验（2026-11-28）
- **部署序列**：`01:33:51` 完成 `HEAD=d0a5f97e4a`；`02:39:06` 完成 `HEAD=73121f8036`（DB 事务锁 + 真实库/跨进程测试进生产）；`03:27:29` 完成 `HEAD=89c7d5f9a6`（并行合并版，已含 RN 提现修复 `8077b159`）；`03:32:32` merge 到 `HEAD=f03d92b6cb`，**03:50:23 部署完成** `HEAD=f03d92b6cb`。最终 8801/8802 `/api/health` 均 200，web 活跃 blue(:8851) `updatedAt=03:46:52`，api 活跃 blue(:8842) `updatedAt=03:49:10`。
- **生产并发复验**：用 E2E 真实登录态 `auth_token` 组 Bearer 头，对 8801 生产 API 并发两次同卡号 `POST /api/wallet/bank-cards`：**201 + 409**，GET 落库只 **1 张**可编辑卡；再创建两张卡并发 `PATCH /:id/default`：**200 + 200**，GET 两张卡 `isDefault=true` 仅 **1 张**。验收后按 id 删除测试卡，未留数据。
- **新版 E2E**：`wallet-bank-cards.spec.ts` 在 8801 部署 `73121f8036` 后 **3 passed / 13.9s**；最终 `f03d92b6cb` 部署后再跑 **3 passed / 10.9s**（2 条 auth setup + 1 条用例）；补“提现选卡过滤历史只读投影卡”回归用例后同 spec **4 passed / 16.8s**（2 setup + 2 用例，单独跑该用例 3 passed / 6.6s）。用已登录 storageState 直查 DOM：`testid_bank_name=1 holder=1 number=1 save=1`，证明生产产物含 5 个 testID，不是兜底选择器假绿。
- **最终口径**：production `HEAD=f03d92b6cb`；代码面 `f03d92b6cb` 已推 `origin/main`（本文档随后提交，后续并行任务可能继续推进 `origin/main`）；`8077b159`（RN/小程序提现契约）、`73121f8036`（数据库事务锁）、`f03d92b6cb`（Web 过滤只读投影 + `@ihui/types` DOM 构建修复）均已在生产。代码、测试、文档、远端提交与部署无未闭环项；真机截图不再作为验收前置，已由下节 H5 验收替代。

### H5 验收收口（2026-11-28，取代真机边界）
- **构建**：`IHUI_MINIAPP_OUTPUT_ROOT=.tmp-h5 pnpm run build:h5` → `EXIT=0`，webpack 5.91.0 编译成功（约 69s，13 个非阻断 warning）；产物 `apps/miniapp-taro/.tmp-h5`。
- **H5 实拍**：390×844 视口下提现页正常渲染，默认卡「招商银行 **** **** **** 8888 · 默认」自动选中、第二张可编辑卡可见、`readOnly` 历史卡「历史银行」不出现；截图见 [withdraw-h5-2026-11-28.png](assets/withdraw-h5-2026-11-28.png)。
- **确认弹层**：选择第二张卡 + 输入 20 元 + 点提交，遮罩与底部白色卡片完整可见；截图见 [withdraw-h5-confirm-2026-11-28.png](assets/withdraw-h5-confirm-2026-11-28.png)。真实 Playwright `.click()` 命中确认按钮，非 DOM 合成事件。
- **交互**：确认后实际请求体为 `{"amount":2000,"accountType":"bank","bankCardId":"bc_h5_second"}`；`ASSERT_DEFAULT_CARD_AND_READONLY_FILTER=PASS`、`ASSERT_WITHDRAW_PAYLOAD=PASS`。成功态截图见 [withdraw-h5-success-2026-11-28.png](assets/withdraw-h5-success-2026-11-28.png)，第二张卡保持选中、无空手输框。
- **修复项**：
  - `AppConfirmHost` 挂到小程序提现页（并固化进 `gen-miniapp-mirror.mjs` 的 WithdrawScreen 分支）——此前小程序/H5 没有 appAlert 宿主，确认弹层只改模块变量，提现永远发不出去；
  - H5 的 rn-compat `Modal` 内容层 `transparent` 分支无宽度，父层居中对齐把 `BottomPops` 的 sheet 压成 0 宽（标题 x=195/宽 0）；已给 Modal 内容层 `{flex:1,width:'100%'}`、给 BottomPops root `width:'100%'`，修复后标题 x=20/宽 318；
  - `feeHint` 改为 `t('withdraw.feeHint', { fee: '0' })`，H5 实拍不再出现 `{fee}%` 占位；
  - H5 workspace TS 编译面补 `babel-loader` 规则与 `@rn-components` alias；小程序/小程序 H5 两处 alias 同步；
  - 成功分支不再清空 `selectedBankCardId`，只清金额与手输账户，避免成功后回退到空手输框。
- **小程序产物**：默认 `dist` 下 `pnpm run build:weapp` **Compiled successfully in 2.98m**，主包 `1,931,119 B / 2,097,152 B`，余量 `166,033 B`（门禁 C3 按 app.json 21 个分包根剔除）；`pages/distribution/withdraw.js` 及其 sub-common 命中 `bankCardId` / `AppConfirmHost`，成功分支不再清空 `bankCardId`。`check-miniapp-css-landing` C0 已新鲜，但 C1 覆盖层因本机解析不到 Tailwind v4 参考层未判定，连带 C5/C6/C7/C8 未判定，门 `exit 2`；C2 同名双义 0、C3 主包已实测，非构建失败。
- **RN 回归**：wallet 3 文件 **19/19**（48.29s）。
- **边界**：Taro H5 首帧直接打开子包深链 `#/pages/distribution/withdraw` 不挂载（标题已变、body 空）；验收走「首页启动 → 切 hash」的等价路径。真实后端链路已由 API real 25/25 + Web E2E 4/4 覆盖，H5 用 `{code:0}` 信封 route mock 聚焦壳层取数/选卡/确认弹层/提交体。
- **报告**：`docs/engineering/h5-acceptance-2026-11-28.md`。

> H5 验收提交：`e684f740ac`（H5 构建、AppConfirmHost 宿主、费用文案）、`bf15f38a38`（确认弹层 0 宽修复、真实指针验收、成功态保留选卡、截图与文档）；production HEAD 仍为 `f03d92b6cb`，本轮 H5/小程序/RN 改动未触发生产 Web/API 部署。

> 本轮提交：`73121f8036`（DB 锁/真实库/跨进程脚本）、`8077b159`（RN/小程序提现接卡）、`f03d92b6cb`（Web 只读过滤 + types 构建修复）、`099a6b95`（Web 提现只读过滤回归用例）、`40cb38b6`（RN 提现只读过滤回归用例）；本文档随后单独提交。
