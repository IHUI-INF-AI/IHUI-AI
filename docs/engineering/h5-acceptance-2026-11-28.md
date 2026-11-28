# IHUI-AI 提现 H5 验收报告（2026-11-28）

## 结论

RN/小程序提现接卡链路已通过 **H5 验收**：Taro H5 产物成功构建，提现页在 390×844 移动端视口正常渲染；默认银行卡自动选中，历史只读投影卡被过滤；选择第二张卡并输入 20 元后，确认弹层**视觉可见**且可被真实指针点击，提现请求体为：

```json
{"amount":2000,"accountType":"bank","bankCardId":"bc_h5_second"}
```

即：金额按分提交、`accountType='bank'`、只传 `bankCardId`、不再把卡 id 塞进 `account`、不再使用后端不认的 `account_type='bank_card'`。

## H5 构建

- 命令：`IHUI_MINIAPP_OUTPUT_ROOT=.tmp-h5 pnpm run build:h5`
- 结果：`EXIT=0`，webpack 5.91.0 编译成功；首轮 7 warnings，补 Modal 宽度与 H5 深链引导器后 13 warnings（均为体积/兼容非阻断项），最终耗时 **1.76m**（webpack 105.88s）。
- 产物：`apps/miniapp-taro/.tmp-h5`
- 本次为构建 H5 补齐了两处 workspace TS 编译面：
  1. `h5.webpackChain` 显式给 `@ihui/*` / `apps/mobile-rn/src` / 本机 `.tmp` 镜像源挂 `babel-loader`；
  2. `h5`/`mini` alias 增加 `@rn-components`，提现页才能挂 `AppConfirmHost`。
- 另修复提现页 `提现手续费 {fee}%` 的 i18n 插值：改为 `t('withdraw.feeHint', { fee: '0' })`，H5 实拍显示「提现手续费 0%」。
- **确认弹层宽度修复**：H5 的 `react-native` 走 `apps/miniapp-taro/src/rn-compat`，其 `Modal` 对 `transparent` 分支只渲染一个无宽度 `View`，父层 `alignItems:center` 把它收缩到 0 宽，`BottomPops` 的 `left:0/right:0` sheet 跟着落到 0 宽（标题 x=195、宽 0）。已做两处：
  - `rn-compat/primitives.tsx` 的 Modal 内容层显式 `{ flex: 1, width: '100%' }`；
  - `BottomPops` 的 `root` 显式 `width:'100%'` 兜底。
  修复后标题 x=20/宽 318，确认按钮 y≈792，遮罩与底部卡片完整可见；`confirm` 用真实 Playwright `.click()` 即可提交。

## 视觉验收

- [初始提现页](assets/withdraw-h5-2026-11-28.png)
  - 可提现金额 `1288.00`
  - 默认卡「招商银行 **** **** **** 8888 · 默认」处于选中态
  - 第二张可编辑卡「中国工商银行 **** **** **** 6666」可见
  - `readOnly` 历史投影卡「历史银行」未出现（过滤生效）
  - 页脚「提现手续费 0%」正常

- [确认弹层](assets/withdraw-h5-confirm-2026-11-28.png)
  - 选择第二张卡 + 输入 20 元后点「提交」，灰色遮罩覆盖页面，底部白色卡片完整滑入
  - 标题「确认提现」、内容「确认提现 20.00 元？提交后请等待到账」、取消/确认两键均可见
  - 真实 Playwright `.click()` 命中确认按钮，不是 DOM 合成事件

- [提交成功态](assets/withdraw-h5-success-2026-11-28.png)
  - 确认后显示「提现申请已提交」
  - 金额清空，第二张卡保持选中，不再出现空「收款账户」手输框（已移除成功后清空 `selectedBankCardId` 的旧行为）

## 交互验收（Playwright + route mock）

脚本：`C:\Users\Administrator\AppData\Local\Temp\ihui-h5-interaction.cjs`（验收临时脚本，不入库）

结果：

- 直接打开 `http://127.0.0.1:8931/#/pages/distribution/withdraw`，由 `app.tsx` 的 `H5DeepLinkBootHandler` 先挂首页再切回子包页；4s 内提现页可交互，无空白首帧。
- `ASSERT_DEFAULT_CARD_AND_READONLY_FILTER=PASS`
- `CONFIRM_VISIBLE=true`（标题 box `x=20,y=694.5,w=318,h=21`；确认按钮 box `y≈792.8`）
- `WITHDRAW_BODY={"amount":2000,"accountType":"bank","bankCardId":"bc_h5_second"}`
- `ASSERT_WITHDRAW_PAYLOAD=PASS`
- 确认按钮用 Playwright 真实 `.click()`，非 DOM `dispatchEvent`。

说明：
- H5 的 API 用 Playwright route mock 固定为真实信封 `{code:0,message:'success',data}`；后端真实链路已在 `wallet-bank-cards.spec.ts` E2E 4/4 与 API real 25/25 覆盖，本次 H5 验收聚焦前端壳的取数、选卡、确认弹层、提交体与成功态。
- 提现确认弹层由 `AppConfirmHost` 承载；此前小程序/H5 未挂该宿主，`appAlert` 只改模块变量、页面无反应，提现永远发不出去。本次已把宿主挂到提现页，并在 `gen-miniapp-mirror.mjs` 的 `WithdrawScreen` 分支固化，避免下次重生成丢失。
- 确认弹层此前还有 H5 布局塌 0 宽的问题，不是 `AppConfirmHost` 挂载问题；本轮已在 rn-compat Modal 与 BottomPops 根层同时修掉，实拍见上。
- H5 子包深链此前首帧空白：页面 chunk 已 200 加载，但 Taro 4.2 H5 路由层不挂载；已在 `app.tsx` 加 H5-only 引导器（目标存 sessionStorage → `history.replaceState` 到首页 → `.taro_page` 挂载后切回目标），主包 6 页不受影响，sessionStorage 不可用时静默跳过。

## 小程序产物回归

- `pnpm run build:weapp`（默认 `dist`）：**Compiled successfully in 4.87m**
- 主包 `1,931,705 B / 2,097,152 B`，余量 `165,447 B`（门禁 C3 按 app.json 21 个分包根剔除）
- `.tmp-weapp` / `dist` 内 `pages/distribution/withdraw.js` 及其 sub-common 命中 `bankCardId` / `AppConfirmHost`；成功分支已不再清空 `bankCardId`
- 注意：`check-miniapp-css-landing` 本次 C0 产物新鲜度已判定「新鲜」，但 C1 覆盖层因本机解析不到 Tailwind v4 参考层无法判定，连带 C5/C6/C7/C8 未判定，门以 `exit 2` 收口；C2 同名双义 0 条、C3 主包尺寸已实测。**这不是构建失败**。

## 其他回归

- RN wallet 3 个测试文件：**19/19 passed**（48.29s）
- `apps/miniapp-taro typecheck`：仅剩 `packages/app/src/features/agent-create/AgentCreateScreen.tsx` 的 `variant` 既有类型错（本次未触碰）；本次新增的 `@rn-components` 引用已通过。
- RN typecheck 仍受本机 `react-native` 类型缺失与同一 AgentCreate 既有错影响，非本次改动引入。

## H5 子包深链

已修复。直接打开 `#/pages/distribution/withdraw` 时，`app.tsx` 的 `H5DeepLinkBootHandler` 先 `history.replaceState` 到首页，轮询到 `.taro_page` 挂载后再切回原 hash；本次实拍在 4s 内进入提现页，卡片/余额/手续费均正常，后续选卡、确认、提交全链路通过。

代价是冷启动会短暂经过首页再落到目标页（视设备约 1–4s），不是原生级定向启动；但不再出现「导航栏标题已变、body 空白、永远不挂载」。sessionStorage 不可用时静默退回原行为。

## 提交

- `e684f740ac`：H5 构建编译面、`@rn-components` alias、提现页 `AppConfirmHost`、`feeHint` 插值与首版验收文档。
- `bf15f38a38`：rn-compat Modal / BottomPops 宽度修复、真实指针确认、成功态保留选卡、确认态截图与文档终版。
- `b410e589f6`：H5 子包深链首帧修复（`H5DeepLinkBootHandler`）、深链直达交互验收与终版截图。
- production 代码 HEAD 仍为 `f03d92b6cb`；本轮只涉及小程序 H5 / weapp / RN 壳层，不触发生产 Web/API 部署。
