<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

> 原路径: 本仓直写(收敛线 cut1,未在 .ihui-agent/tmp 留副本)
> 生成时间: 2026-11-08 04:45
> 所属工作线: 收敛线(302p 跨端漂移门)

# 票：302p 的两处结构缺陷 —— 登记面在提交期无人看守；judgedGapWeb 把"诚实缺屏"判成漂移

状态：OPEN　　开票：2026-11-08　　开票人：收敛线

## 缺陷① 新增 web 路由没有提交期登记门，302p 只在 push 面暴露

**现象**：`/sag2`（`apps/web/app/(main)/sag2/page.tsx`）在远端是新增页，却没有 `scripts/data/web-rn-screen-map.jsonl` 的登记行；本线 push 时 302p 才拦住（`web 路由未判定数 0 → 1`）。

**根因**：
- 302p 头注自述是"只读漂移尺（不进提交链）"（`scripts/check-cross-end-parity-drift.mjs:7`）；提交链里没有任何一道要求"本笔新增 web 路由必须同笔落登记行"。
- 登记面本身没有准入门：`check-web-rn-screen-parity.mjs` 默认 `face=head`（L115），只在被显式调用时计算 `unmapped`；`auto-register-cross-end.mjs` 是"给了提案才落地"的被动通道，不是必填校验。

**证据**：
- `git log -1 -- "apps/web/app/(main)/sag2"` ⇒ `c20e4a5797`（2026-11-08 02:35:52），同一笔未改 `web-rn-screen-map.jsonl`。
- 302p 基线（`scripts/data/cross-end-drift-gate-baseline.json`，2026-11-06 冻结）`unmapped=0`；本轮 push 现读 `unmapped=1`，`unmappedBySegment` 点名 `sag2`。
- `git diff --name-only origin/main HEAD -- apps/web/app` 为空 ⇒ 页面是远端带进来的，不是本线引入。

**改造方向**（未实现）：
- 提交期加一道"新增路由 ⊆ 登记键"的阻断：以本笔 diff 的 `apps/web/app/**/page.tsx` 新增路由为范围，查 `web-rn-screen-map.jsonl` 是否已有 aligned/excluded/gap/portal 行；缺行 ⇒ 红并点名。
- 或把 `check-web-rn-screen-parity.mjs --staged` 挂进 pre-commit；注意只判"本笔新增"，不判存量（存量恒红是 §12e 反模式）。

## 缺陷② judgedGapWeb 方向单一，"新确认的缺屏"与"新引入的漂移"混为一维

**现象**：按门自己的机制如实登记 `/sag2` 为 `gap` 后，302p 仍判断红：`judgedGapWeb(判过确认 RN 缺屏数) 基线 0 → 现读 1`。

**根因**：
- `GATE_DIRECTIONS` 里 `['judgedGapWeb','up']` 只有"涨=坏"一个方向（`scripts/check-cross-end-parity-drift.mjs:109`）。
- 但 `gap` 是门许可的诚实登记档（`auto-register-cross-end.mjs:753-771`，gap 只写"判过零承载 + 证据"）；登记动作必然让该维 +1。于是"如实承认缺一屏"与"把既有承载拆掉"在读数上无法区分。

**证据**：
- 提交 `14e533b6f1`（`web-rn-screen-map.jsonl` 新增 sag2 gap 行）后 `node scripts/check-cross-end-parity-drift.mjs --gate --push` ⇒ `STATE=regressed`，唯一回归维 `judgedGapWeb 0→1`；同轮 `unmapped 1→0`。
- 为转绿按 `refreshProcedure` 定向刷新基线，`git diff` 逐维证明 31 维里仅 `judgedGapWeb` 0→1（same=30 / diff=1），其余维度未动。

**改造方向**（未实现）：
- 拆两栏：`judgedGapWebNew`（登记动作，进 gap 台账 + 派单计数，advisory/只报数）与 `judgedGapRegression`（同一 web 键从 aligned/portal 退化为 gap，或既有 gap 行被无理由删除，仍 blocking）。
- 或把该维判据改为"只判退化"：aligned/portal 行消失 ⇒ 红；gap 新增只出派单提示，不阻断 push。

## 影响面

- 两处都在跨端漂移门的判据面/登记面，不影响其它门。
- 本票只记录缺陷与改造方向，不含实现。
