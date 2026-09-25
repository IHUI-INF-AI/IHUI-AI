<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# D67 额度归属分型与折扣倒计时 —— 装车报告(2026-09-25)

## 结论一句话

`QuotaOwnershipCard` 从「在库、生产零消费点」变为**两个宿主真实挂载**:
`MessageErrorCard`(额度型错误卡)与 `FallbackBanner`(生产已由 MessageList 挂载的降级横幅)。
归属四型判定**全部经 shared 层 `fromErrorCode`**,端内零硬编码型别。

## 消费点(文件:行,工作树现值)

| 宿主 | 行 | 接的是什么 |
| --- | --- | --- |
| `apps/web/src/components/chat/message-list/MessageErrorCard.tsx` | 19-20 | import 分型卡 + `fromErrorCode` |
| 同上 | 98 | `const ownershipKind = fromErrorCode(errorCode)`(新 prop `errorCode`,见 49 行注释) |
| 同上 | 104-118 | `handleOwnershipAction` 穷尽三动作 → `onViewUsage` / `onSwitchTier` / `onUpgradePlan` |
| 同上 | 170-176 | 额度分支内渲染 `<QuotaOwnershipCard kind rejectedByQuota freeTierAvailable onAction data-testid>` |
| `apps/web/src/components/chat/message-list/FallbackBanner.tsx` | 8-9 | import 分型卡 + `fromErrorCode` + `PROVIDER_QUOTA_EXHAUSTED` |
| 同上 | 65 | `ownershipKind = isQuotaEquivalent ? fromErrorCode(PROVIDER_QUOTA_EXHAUSTED) : null` |
| 同上 | 177-182 | quota_equivalent 分支内渲染分型卡(标题上屏,动作族仍由下方 D39 出口承载) |

`FallbackBanner` 是**当前唯一真正被 MessageList 挂载**的宿主
(`apps/web/src/components/chat/message-list/MessageList.tsx:32,365`),所以本票的界面改动
有一条不依赖他人的在途接缝。

## `git grep -l -F "QuotaOwnershipCard" -- apps packages`(装车证明)

```
apps/web/src/components/ai/__tests__/quota-ownership-card.test.tsx
apps/web/src/components/ai/quota-ownership-card.tsx
apps/web/src/components/chat/message-list/FallbackBanner.tsx   ← 宿主(生产已挂载)
apps/web/src/components/chat/message-list/MessageErrorCard.tsx ← 宿主(D39 错误卡)
```

改前(HEAD 口径)只有前两行 = 定义 + 自身测试 ⇒ 零消费点。

## 新增测试(断言接线本身,不重测纯函数)

`apps/web/src/components/chat/message-list/__tests__/quota-ownership-wiring.test.tsx`,11 例:

- 宿主内出现分型卡且 `data-quota-kind` 正确(**三枚 errorCode 各自分型**,证明型别来自 shared 映射而非端内硬编码);
- 分型卡三动作点击**分别**回调到宿主既有接缝(`onViewUsage` / `onSwitchTier` / `onUpgradePlan` 各 1 次);
- 一枚接缝都没注入 ⇒ 标题照上屏、**不摆无响应按钮**(动作行不渲染);
- 心智边界不回退:`freeTierAvailable` 时 `upgradeOrAdmin` 剔除,而 `viewUsage` / `switchFreeModel` **仍在**,且降级建议在位;
- 分型卡**不顶掉** D39 六动作:补积分 / 升级套餐 / 切档 / 查看用量 / 重登 / 重试同屏可达(逐 testid 断言);
- 非额度码(`RATE_LIMITED`)、`quotaError={false}`、无 `errorCode` 旧调用形态三种反例均不挂分型卡,而动作族/错误卡不受影响;
- FallbackBanner:`quota_equivalent` 挂 `freeModelDaily` 卡 + 动作族四个出口不减少;`timeout` 两样都不挂(旧横幅形态不变)。

## 设计取舍(为什么这样接)

1. **`rejectedByQuota` 由宿主并两路**:`quotaError === true || ownershipKind !== null` —— 宿主只传
   `errorCode` 也应当上屏;显示门槛本身(`shouldShowOwnershipCard`)仍在 shared 判定层,渲染层不复述判据。
2. **FallbackBanner 刻意不传 `onAction`**:其下方 `QuotaActionFamily` 已带真实导航出口(补积分/升级/
   查看用量/重登),再摆一排同义按钮属重复;且 quota_equivalent 场景「切档」后端已替用户完成
   (本次即由 `backupModel` 作答)。该宿主只取分型**标题**与 `escalate`/降级建议渲染。
   若要在此宿主也开动作行,需 `MessageList` 注入模型选择器接缝 —— `MessageList.tsx` 不在我的清单内,
   已在「未做完」列明。
3. **`quota-ownership.ts` 未改**:两型 `teamAdmin` / `billingGroupCredits` 接不上是**服务端缺码**
   (见下),不是判据太严;放宽 `fromErrorCode` 的第一道闸(error-catalog 真相源)属被禁动作。
4. **`quota-ownership-card.tsx` 未改**:现有 props(`kind` / `rejectedByQuota` / `freeTierAvailable` /
   `onAction` / `data-testid`)形态够用,13 枚键取值口径一字未动。

## 缺的服务端字段(接不了的,已按要求点名)

### 1) 低峰折扣倒计时 —— 缺折扣窗口起止时刻

- 组件需要:`QuotaOwnershipCard.discountWindow = { windowStart, windowEnd }`(**epoch ms**),
  见 `apps/web/src/components/ai/quota-ownership-card.tsx:43`。
- **全仓无任何来源**,故两个宿主都**未传** `discountWindow`(不传 ⇒ 折扣行不渲染,`DISCOUNT_PHASES`
  的 `none` 语义,不是降级):
  - `packages/api-client/src/client.ts:1225-1232` `FallbackEvent` 只有 `primaryModel` / `backupModel` /
    `reason`,无任何窗口字段;
  - 额度面现有字段只到 `percent` / `usedTokens` / `limitTokens` / **`resetAt`**(重置时刻,不是折扣窗口),
    见 `apps/web/src/hooks/use-chat/send-message.ts:1018` 与 `packages/api-client/src/client.ts:1260` 附近注释;
  - `apps/api/src/routes/ai-vendors/proxy-extended-media2.ts:64` 的 `off_peak: z.boolean().optional()` 是
    **发给厂商的请求参数(布尔)**,不是我方向前端播报的窗口;
  - `apps/web/app/(main)/models/ModelsMarketplace.tsx:1170` 的 `isOffPeak = peak < 0.999` 是**倍率**换算
    (来自 `relay.offPeak` 展示),同样不含时刻。
- 需要新增(建议落点):额度/计费响应体与 SSE budget 帧补 `discountWindowStart` / `discountWindowEnd`
  (epoch ms 或 ISO + 前端换算)。字段到位后,宿主把值塞进 `discountWindow` 即生效,**判定层与组件零改动**
  (`discountCountdown` 已处理非法区间/NaN ⇒ `none`)。

### 2) 团队 / 计费组额度 —— 缺 errorCode 本体(不是缺映射)

- `packages/shared/src/chat/error-catalog.ts`(104 条)**没有**任何团队或计费组额度类错误码;
  全仓 `apps/api` + `apps/ai-service` 也搜不到 `TEAM_QUOTA*` / `BILLING_GROUP*` / `CREDITS_EXHAUSTED`
  形态的服务端发码点(唯一命中在 `.venv` 里的 litellm 第三方源码,不属我方契约)。
- 因 `fromErrorCode` 第一道闸要求「码必须在 error-catalog 内」,`ERROR_CODE_TO_KIND` 里的
  `teamAdmin` / `billingGroupCredits` 两型**当前不可达**(卡片自身测试仍覆盖这两型的渲染,
  因为测试直接喂 kind)。
- 到位路径:服务端新增码(如 `TEAM_QUOTA_EXHAUSTED` / `BILLING_GROUP_CREDITS_EXCEEDED`)→
  登记进 `error-catalog.ts`(含 titleKey/actionKey,五语键另计)→ 在 `ERROR_CODE_TO_KIND`
  补两行。**不需要放宽任何判据。**

## 待补 i18n 键

**无。** 本票复用既有 13 枚 `ai.pane.quotaOwnership.*` 键(五语齐,已由 card 用例读真实词包守住),
未新增任何键,未编辑任何词包文件。

## 未做完 / 需要下一轮

1. **`MessageErrorCard` 自身在生产零消费点**(HEAD `git grep -l` 只命中它自己)。它是 D39 为
   替换 `MessageItem.tsx:728-764` 内联错误卡而准备的载体,接管动作没做 —— 而 `MessageItem.tsx`
   是本轮**另一代理的独占文件**(任务书明列禁区),我没有越界去接。
   ⇒ 分型卡在**错误卡**这条路径上真正上屏,需下一轮把 MessageItem 的内联错误卡换成 MessageErrorCard
   并传 `errorCode={m.errorCode}`(`m.errorCode` 已在 `MessageItem.tsx:160` 被消费,数据面是通的)。
   横幅路径(FallbackBanner)不受此限,已经上屏。
2. FallbackBanner 的分型动作行需 `MessageList` 注入模型选择器接缝(见「设计取舍 2」),未做。
3. 上述两项服务端字段到位后,`discountWindow` / 两型 kind 才能自然接通。

## 验证(命令 + 末行输出原文)

### 1) `pnpm --filter @ihui/web typecheck`

```
G:\IHUI-AI\apps\web:
[ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL] @ihui/web@0.0.0 typecheck: `tsc --noEmit`
Exit status 2
```

exit 2 **全部来自他人既有红**(共 39 条 `error TS`)。区分依据 —— 报错文件 uniq 清单:

```
src/components/ai/__tests__/review-stats-bar.test.tsx
src/components/ai/progress-sections/__tests__/tool-call-summary-category.test.tsx
src/components/ai/progress-sections/__tests__/tool-category.test.ts
src/components/ai/progress-sections/tool-category.ts
src/components/chat/message-input.tsx
src/components/chat/voice-note.tsx
src/config/desktop-feed-payload.ts
src/hooks/__tests__/use-prompt-drafts.test.tsx
src/hooks/use-prompt-drafts.ts
```

我的文件 0 错,取证命令(空输出 = 无命中):

```
$ grep -E "MessageErrorCard|FallbackBanner|quota-ownership" .ihui-agent/tmp/d67/typecheck.log
(无输出)
```

注:`message-input.tsx` / `voice-note.tsx` 报的是 `Cannot find module
'@ihui/shared/chat/{prompt-drafts,voice-note}'`(他人票的 shared 产物未构建),两文件均在禁区清单内。

### 2) vitest(本票两条测试文件)

```
$ cd apps/web && node ./node_modules/vitest/vitest.mjs run src/components/chat/message-list/__tests__/quota-ownership-wiring.test.tsx src/components/ai/__tests__/quota-ownership-card.test.tsx
 ✓ src/components/ai/__tests__/quota-ownership-card.test.tsx (18 tests) 313ms
 ✓ src/components/chat/message-list/__tests__/quota-ownership-wiring.test.tsx (11 tests) 97ms

 Test Files  2 passed (2)
      Tests  29 passed (29)
   Duration  4.33s
```

### 3) 宿主邻居测试无回归

```
$ cd apps/web && node ./node_modules/vitest/vitest.mjs run src/components/chat/message-list/__tests__/fallback-banner-d56.test.tsx src/components/chat/message-list/__tests__/message-item-error-card-wiring.test.ts
 Test Files  2 passed (2)
      Tests  8 passed (8)
```

(`message-item-fallback-line.test.tsx` 属同批另一代理的在途改动,未跑,以免把他人红当成我的。)

### 4) `node scripts/check-error-code-coverage.mjs`

```
EXIT=0
✅ 错误码覆盖率通过(判定面:HEAD blob):扫 643 个文件,产出 97 个 errorCode,catalog 104 条全覆盖,八类齐全,零「未知错误」兜底
```

### 5) `node scripts/check-word-table-resolvable.mjs`

```
EXIT=0
  ✅ 每键在 5 语言 × 消费端合并视图 + 小程序离线包全部取到值
```

### 6) 水印与 lint(新建文件必做)

```
$ node scripts/watermark.mjs inject apps/web/src/components/chat/message-list/__tests__/quota-ownership-wiring.test.tsx
[watermark:inject] ... → injected
$ node scripts/watermark.mjs verify <同文件>
[watermark:verify] 覆盖 1/1 个指定文件, 残迹(载荷丢失) 0 个, 载荷损坏 0 个, 跳过 0 个
纳入口径的文件均已携带完整溯源水印。

$ node ./node_modules/eslint/bin/eslint.js <三个改动文件>
MessageErrorCard.tsx / quota-ownership-wiring.test.tsx:0 错
FallbackBanner.tsx:8 处 eqeqeq(第 70/74/75/76/77/156/159/162 行)
```

那 8 处 eqeqeq **全部是 HEAD 既有**(`git show HEAD:<该文件> | grep -c ' != '` = 8,与我新增行无交集:
`grep -n ' != ' <该文件> | grep -vE "retryInfo|retryView"` 空输出)。提交时 lint-staged 的
`eslint --fix` 会把它们规范成 `!==`,属格式化,不改语义;我未主动改他人那 8 行。

## 收尾自检 `git status --porcelain`

我的改动面(3 个文件,全部在允许清单内):

```
M apps/web/src/components/chat/message-list/MessageErrorCard.tsx
M apps/web/src/components/chat/message-list/FallbackBanner.tsx
? apps/web/src/components/chat/message-list/__tests__/quota-ownership-wiring.test.tsx
```

清单外的脏文件(他人所有,我未触碰):
`apps/web/src/components/chat/message-list/__tests__/message-item-fallback-line.test.tsx`
(开工前的单写者检查即已存在)。另:开工后对
`apps/web/{src/components/ai,src/components/chat/message-list}` 与 `packages/shared/src/chat`
做宽口径 `git status` 时,列表里还有 20+ 个他人脏文件(cloud-chat-ops / tool-call-card /
edit-resend-rollback / auto-topup / tool-category 等,均属同批其他代理),**我一个字都没写**;
开工前的单写者检查是对**我的四个允许文件逐个**跑的,当时四个全部干净。
另外为存验证日志新建了
`.ihui-agent/tmp/d67/{typecheck,gate-errcode,gate-wordtable}.log`(已 gitignore,可随时清理)。

`packages/shared/src/chat/quota-ownership.ts`、`apps/web/src/components/ai/quota-ownership-card.tsx`
**未改**(判据未放宽,取值口径未动)。未做任何 git 写操作。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
