<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# 票：T1（push 门全量 typecheck）在纯净 `origin/main` 上即红 —— 基线存量 18 条（2026-11-09 已清）

状态：CLOSED（2026-11-09 已清）　　开票：2026-11-08　　开票人：fix/db-p1-1108 工作线

## 结论（先给判定）

- **纯净基线即红，不是 `fix/db-p1-1108` 引入，也不是 dist 陈旧残留。**
- 同一 worktree 内把工作树切到 `origin/main`（`00fa9e977f64780002702dd2f3371d7fc4105b75`，先 `git fetch origin`），`git status --short` 为空（纯净检出），跑 T1 后 **rc=2**，18 条唯一 `error TS`（`Select-String "error TS"` 命中 23 行 = 18 条错误 + 5 条包级汇总）。
- 与本分支推送时 T1 的报错**逐行、逐文件、逐列完全相同**（证据：`D:\IHUI-AI-wt-db-p1-1108\.ihui-agent\state\hook-logs\pre-push-gate.log` 第 85–189 行 / 第 420–455 行，与本次纯净基线日志一致）。
- T1 自身的 dist 预重建已走 main 的逐产物对账（日志：`重建 @ihui/database ... 陈旧产物 2,复核刷新 2/2,复扫 0`；其余 11 包内容未变已跳过），**不报「未判定」**。

## 复现命令与环境

```powershell
# worktree: D:\IHUI-AI-wt-db-p1-1108
git fetch origin
git switch --detach origin/main     # HEAD = 00fa9e977f64780002702dd2f3371d7fc4105b75
git status --short                  # 空
node scripts/check-typecheck.mjs    # T1: 全量 typecheck(staged-scope 降级包装)
```

- 运行日志头：[`check-typecheck] 运行全量 typecheck(node scripts/typecheck-full.mjs,实时透传输出) [无可判定改动范围,无降级]...`
- **rc=2**
- 完整日志留存：`%TEMP%\t1_pure_origin_main.log`（本机）；本文下方逐条抄录。

## 完整 error TS 原文（18 条，rc=2）

```text
apps/extension: src/hooks/use-extension-third-party-auth.tsx(50,3): error TS2353: Object literal may only specify known properties, and 'linuxdo' does not exist in type 'Record<ThirdPartyPlatform, string>'.
apps/miniapp-taro: src/pkg-ai/dev-enter/n8n-model/list-view.tsx(8,72): error TS2307: Cannot find module './workflow-card' or its corresponding type declarations.
apps/miniapp-taro: src/pkg-shop/vip-trader/index/index.tsx(15,34): error TS2307: Cannot find module '@rn-shells/VipTraderScreen' or its corresponding type declarations.
apps/miniapp-taro: src/utils/streaming-recognizer.ts(72,3): error TS2393: Duplicate function implementation.
apps/miniapp-taro: src/utils/streaming-recognizer.ts(93,3): error TS2393: Duplicate function implementation.
apps/mobile-rn: src/screens/LoginScreen.tsx(279,7): error TS2322: Type '"linuxdo"' is not assignable to type 'ThirdPartyPlatform'.
apps/mobile-rn: src/utils/chat-render-model.ts(554,9): error TS2322: Type '"done" | "failed" | "stub"' is not assignable to type '"done" | "failed" | undefined'.
apps/api: src/routes/__tests__/conversation-import.test.ts(605,14): error TS18048: 'skills' is possibly 'undefined'.
apps/api: src/routes/__tests__/conversation-import.test.ts(606,14): error TS18048: 'automations' is possibly 'undefined'.
apps/api: src/routes/__tests__/conversation-import.test.ts(614,14): error TS18048: 'memory' is possibly 'undefined'.
apps/api: src/server.ts(478,10): error TS2304: Cannot find name 'startSuperAgentPumpLoop'.
apps/api: src/server.ts(484,7): error TS2304: Cannot find name 'stopSuperAgentPumpLoop'.
apps/api: src/services/super-agent-pump-service.ts(80,9): error TS2345: Argument of type '{ err: string; }' is not assignable to parameter of type 'string'.
apps/api: src/services/super-agent-pump-service.ts(123,20): error TS18046: 'parsed' is of type 'unknown'.
apps/web: src/components/ai/progress-sections/timeline-tab.tsx(142,27): error TS7053: Element implicitly has an 'any' type because expression of type 'TimelineEventStatus' can't be used to index type '{ done: number; failed: number; running: number; pending: number; }'.
apps/web: src/components/chat/message-list/MessageList.tsx(677,9): error TS2322: Type '{ isLoading: boolean | undefined; loadingLabel: string | undefined; emptyTitle: string; emptyHint: string; showTemplates: boolean; onTemplateSelect: ((content: string) => void) | undefined; t: Translator<...>; }' is not assignable to type 'IntrinsicAttributes & EmptyStateProps'.
apps/web: src/hooks/use-third-party-config.tsx(63,5): error TS2322: Type '"linuxdo"' is not assignable to type 'ThirdPartyPlatform'.
apps/web: src/hooks/use-third-party-config.tsx(158,7): error TS2322: Type 'import("D:/IHUI-AI-wt-db-p1-1108/apps/web/src/types/third-party").ThirdPartyPlatform | null' is not assignable to type 'import("D:/IHUI-AI-wt-db-p1-1108/packages/ui-react/src/components/login-form/types").ThirdPartyPlatform | null'.
[typecheck:full] ❌ 以下包未通过:@ihui/api(rc=2), @ihui/extension(rc=2), @ihui/miniapp-taro(rc=2), @ihui/mobile-rn(rc=2), @ihui/web(rc=2)
  - @ihui/api: rc=2 error TS=7
  - @ihui/extension: rc=2 error TS=1
  - @ihui/miniapp-taro: rc=2 error TS=4
  - @ihui/mobile-rn: rc=2 error TS=2
  - @ihui/web: rc=2 error TS=4
❌ 全量 typecheck 失败,推送已阻止(exit 2)
```

## 判据

1. **纯净面**：`git status --short` 为空、HEAD 为 `00fa9e977f`，无任何本地改动/暂存内容，不存在「他人并行会话未完成文件」噪音。
2. **dist 面对账**：`typecheck:full` 前置重建仅刷新了 `@ihui/database` 的 2 个陈旧产物（复扫 0），其余 11 包跳过；不存在旧 dist 污染。
3. **与分支逐行同构**：`fix/db-p1-1108` 推送时 T1 的 18 条错误与上表完全一致（文件、行、列、TS 码全部相同），说明本分支 7 个提交未新增/改变任何 T1 红项。
4. **无降级、无未判定**：日志明确 `[无可判定改动范围,无降级]`；不存在「tsc 没真正运行」的未判定情形。

## 处置

- 本票只登记与定性，**不改任何代码/门禁/断言，不放宽校验**。
- `fix/db-p1-1108` 保持本地分支、`先不 push`（7 个提交：DB-01、DB-02、DB-03、SDB-27/28、SDB-29、SDB-30、SDB-04），合并阶段由主线统一处理。（该合并已完成；main 上的存量红随后由主线于 2026-11-09 统一清掉，见文末「收官」。）
- 后续收口需按包逐条修复上述 18 条（属独立缺陷，不在本次 P1 修复范围）：`apps/api` 7 条、`apps/web` 4 条、`apps/miniapp-taro` 4 条、`apps/mobile-rn` 2 条、`apps/extension` 1 条。

## 收官（2026-11-09，主线 T1 存量红清理线）

- **基线漂移说明**：本票正文的 18 条是 `00fa9e977f` 时点快照。到 `origin/main = 73a6352a830b348dd8037c66dc84429954a2d79c`，实测为 43 条：`api 28 | miniapp 4 | mobile-rn 1 | rn-app 4 | web 1 | cli 5`。
- **结果**：在 `origin/main = 73a6352a83` 的独立 detached worktree 上逐条修根因后，`node scripts/typecheck-full.mjs` **rc=0**，21 个包 + `apps/web/e2e` 全部通过；上述六包逐包读数全 0。
- **分笔提交（按包）**：
  - `4fb05b74bd` shared：deadline-ticker 改 `typeof globalThis` + 能力判定（三端共用，RN/小程序无 `window` 时走 null 分支）
  - `1e0d1c1b19` api：缺列回补、响应码声明补齐 403/400、重复声明收敛、泛型约束放宽、5 处夹具对齐
  - `e7b1139c57` cli：`measuredCompactRatio` 保留 (0,1] 单份、移除未用 `segmentPathInside`
  - `e643edd9e4` web：account-deletion 补 `useAuthGate` 导入
  - `e81cf6e796` miniapp：`tt` 三处补 fallback、路由夹具加空表守卫
  - `e4c0a435a3` mobile-rn：移除未用 `REPO_ROOT`
  - `d5c0dd8731` rn-app：分销夹具改结构传参、plan `constraints` 对齐 string
- **归因口径（可复用）**：真丢代码 / 类型收窄没跟上 / 环境判断缺失 / 跨包类型未导出。本次无豁免清单、未改基线冻结读数、未放宽 `strict`、未新增 `@ts-expect-error`。
- **未清项**：无。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
