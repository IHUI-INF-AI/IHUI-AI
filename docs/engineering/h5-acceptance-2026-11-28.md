# IHUI-AI 提现 H5 验收报告（2026-11-28）

## 结论

RN/小程序提现接卡链路已通过 **H5 验收**：Taro H5 产物成功构建，提现页在 390×844 移动端视口正常渲染；默认银行卡自动选中，历史只读投影卡被过滤；选择第二张卡并输入 20 元后，确认弹层可触发，提现请求体为：

```json
{"amount":2000,"accountType":"bank","bankCardId":"bc_h5_second"}
```

即：金额按分提交、`accountType='bank'`、只传 `bankCardId`、不再把卡 id 塞进 `account`、不再使用后端不认的 `account_type='bank_card'`。

## H5 构建

- 命令：`IHUI_MINIAPP_OUTPUT_ROOT=.tmp-h5 pnpm run build:h5`
- 结果：`EXIT=0`，webpack 5.91.0 编译成功，耗时约 154s，7 个非阻断 warning。
- 产物：`apps/miniapp-taro/.tmp-h5`
- 本次为构建 H5 补齐了两处 workspace TS 编译面：
  1. `h5.webpackChain` 显式给 `@ihui/*` / `apps/mobile-rn/src` / 本机 `.tmp` 镜像源挂 `babel-loader`；
  2. `h5`/`mini` alias 增加 `@rn-components`，提现页才能挂 `AppConfirmHost`。
- 另修复提现页 `提现手续费 {fee}%` 的 i18n 插值：改为 `t('withdraw.feeHint', { fee: '0' })`，H5 实拍显示「提现手续费 0%」。

## 视觉验收

- [初始提现页](assets/withdraw-h5-2026-11-28.png)
  - 可提现金额 `1288.00`
  - 默认卡「招商银行 **** **** **** 8888 · 默认」处于选中态
  - 第二张可编辑卡「中国工商银行 **** **** **** 6666」可见
  - `readOnly` 历史投影卡「历史银行」未出现（过滤生效）
  - 页脚「提现手续费 0%」正常

- [提交成功态](../engineering/assets/withdraw-h5-success-2026-11-28.png)
  - 选择第二张卡 + 输入 20 元 + 确认后显示「提现申请已提交」
  - 成功后金额清空；页面显示「收款账户」空输入框（共享屏在清空 `selectedBankCardId` 后的既有形态，不影响本次提交契约）

## 交互验收（Playwright + route mock）

脚本：`C:\Users\Administrator\AppData\Local\Temp\ihui-h5-interaction.cjs`（验收临时脚本，不入库）

结果：

- `ASSERT_DEFAULT_CARD_AND_READONLY_FILTER=PASS`
- `CONFIRM_VISIBLE=true`
- `WITHDRAW_BODY={"amount":2000,"accountType":"bank","bankCardId":"bc_h5_second"}`
- `ASSERT_WITHDRAW_PAYLOAD=PASS`

说明：
- H5 的 API 用 Playwright route mock 固定为真实信封 `{code:0,message:'success',data}`；后端真实链路已在 `wallet-bank-cards.spec.ts` E2E 4/4 与 API real 25/25 覆盖，本次 H5 验收聚焦前端壳的取数、选卡、提交体与成功态。
- 提现确认弹层由 `AppConfirmHost` 承载；此前小程序/H5 未挂该宿主，`appAlert` 只改模块变量、页面无反应，提现永远发不出去。本次已把宿主挂到提现页，并在 `gen-miniapp-mirror.mjs` 的 `WithdrawScreen` 分支固化，避免下次重生成丢失。

## 小程序产物回归

- `IHUI_MINIAPP_OUTPUT_ROOT=.tmp-weapp pnpm run build:weapp`：**Compiled successfully in 2.74m**
- 主包 `1,861,073 B / 2,097,152 B`，余量 `236,079 B`
- `.tmp-weapp` 内 `pages/distribution/withdraw.js` 及其 sub-common 命中 `bankCardId` / `AppConfirmHost`
- 注意：`check-miniapp-css-landing` 在私有输出根下读的是旧 `dist`，本次以 `exit 2` 报「未判定（C0 产物新鲜度）」，**不是构建失败**；构建本身成功。生产 `build:weapp` 走默认 `dist` 时该门才会对齐。

## 其他回归

- RN wallet 3 个测试文件：**19/19 passed**（46.71s）
- `apps/miniapp-taro typecheck`：仅剩 `packages/app/src/features/agent-create/AgentCreateScreen.tsx` 的 `variant` 既有类型错（本次未触碰）；本次新增的 `@rn-components` 引用已通过。
- RN typecheck 仍受本机 `react-native` 类型缺失与同一 AgentCreate 既有错影响，非本次改动引入。

## H5 路由注意

Taro H5 首帧直接打开子包深链 `#/pages/distribution/withdraw` 时页面不挂载（标题已变但 body 为空）；验收采用「先打开 `#/pages/index/index`，再切 hash 到提现页」的等价路径。若要让用户直接打开提现深链，需要单独补 Taro H5 子包首帧路由初始化，不在本次 H5 验收范围内。
