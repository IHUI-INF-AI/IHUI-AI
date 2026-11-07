<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

> 原路径: D:\IHUI-AI\.ihui-agent\tmp\ticket-check-typecheck-dist-preflight-20261107.md
> 生成时间: 2026-11-07 16:26:52
> 所属工作线: 收敛线（类型检查前置）

# 票：`check-typecheck` 的「陈旧 dist 前置重建」未更新 `packages/types/dist`

状态：OPEN　　开票：2026-11-07 16:2x　　开票人：收敛线（只读侦查）

## 现象（可复核）

1. HEAD `2a0a2283` 上直跑 `node scripts/check-typecheck.mjs`：**rc=2**，报
   `src/endpoints/notification.ts(16,3): error TS2724: '"@ihui/types"' has no exported member named 'NotificationListFilters'`。
   同一批输出里前置步骤自称：`11 个包的 dist 比 src 旧 或 dist 不存在 ⇒ 先重建再 typecheck`。
2. 但 `packages/types/dist/notification.d.ts` 在这次运行前后 **mtime 恒为 2026-11-06 21:48:52**，内容截断在
   `export interface CustomerServiceMessage …`，**不含** `NotificationListFilters`（该接口在
   `packages/types/src/notification.ts:134`，由 `packages/types/src/index.ts:15` `export * from './notification.js'` 导出，
   随 `d050d90d10`（2026-11-06 18:13）入库 —— 即 **dist 早于接口入库的那次构建**）。
3. 手工 `pnpm --filter @ihui/types build`（rc=0，4.6s）后，`dist/notification.d.ts` mtime 变为 16:12:56、
   出现 `NotificationListFilters`；**再跑 `node scripts/check-typecheck.mjs` 立刻 rc=0**（62.3s）。

## ① 预步骤的实际实现位置与「陈旧」判据

- 位置：`scripts/typecheck-full.mjs`，`staleDistPreflight()`（函数注释起于 L67，调用点 L62；`--preflight-only` 分支在 L45-52）。
- 判据（源码注释 L79-80 + 实现 L143-159）：**只看 `packages/` 下带 build script 的自建包**，
  `distMissing || newestMtimeMs(src) > newestMtimeMs(dist)` ⇒ 判陈旧；`newestMtimeMs()` 递归取目录内最新 mtime
  （跳过依赖/缓存目录）。命中集合在 L88 `.filter((e) => e.hasBuildScript && (e.distMissing || e.srcNewestMtimeMs > e.distNewestMtimeMs))`。
- 该函数只打印**命中数量**（本次是 11），**不打印包名清单**，也不逐包回吐构建 rc。

## ② 为什么 types 没被更新（尚未确证，二分）

两个候选，均未被现有日志排除：

- (a) `@ihui/types` 根本不在那 11 个命中包里 —— 即判据在当前工作树状态下把它算成「不陈旧」；
- (b) 它在 11 个里，但 `atomic-build` 换入的是临时目录产物、换入失败/被跳过，而外层仍按成功继续。

**证据缺口（本身是缺陷）**：门不打印命中的包名、不打印每个包的构建 rc 与耗时，
`--preflight-only` 也只给总数。因此事后无法从日志分辨 (a)/(b)。

另有一条与判据相关的可疑点，供后续核对（**未下结论**）：`newestMtimeMs(dist)` 递归取 dist 内**最新**文件 mtime，
只要 dist 里有一个文件比 src 新（例如被 `scripts/embed-types.mjs` 改写过的 `ihui-types.d.ts`），
整包就会被判「不陈旧」——`packages/types` 恰好有 `embed-types` 这一步（本次运行输出 `✅ embed-types: dist/ihui-types.d.ts 已生成,改写 13 个声明文件`）。

## ③ 复现三步

```powershell
# 1) 确认 dist 缺导出（应输出 0 行、mtime 停在接口入库之前）
Get-Item D:\IHUI-AI\packages\types\dist\notification.d.ts | Select-Object LastWriteTime
Select-String -Path D:\IHUI-AI\packages\types\dist\notification.d.ts -Pattern 'NotificationListFilters'

# 2) 跑门：应 rc=2，报 TS2724，且前置步骤不改变上面那个 mtime
node scripts/check-typecheck.mjs

# 3) 手工重建 types 后再跑：应 rc=0
pnpm --filter @ihui/types build
node scripts/check-typecheck.mjs
```

## 影响面

T1 是 push blocking 门。任何「包源码入库、dist 未重建」的干净检出都会在 T1 判红，
而红的原因写在**消费者**（api-client）的文件上，不指向真正陈旧的包 —— 归因成本高。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
