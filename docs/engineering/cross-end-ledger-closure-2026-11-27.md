# 三端差异台账收口裁决（2026-11-27）

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
