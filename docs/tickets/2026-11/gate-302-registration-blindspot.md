<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

> 原路径: 本仓直写(收敛线 cut1,未在 .ihui-agent/tmp 留副本)
> 生成时间: 2026-11-08 04:45
> 所属工作线: 收敛线(302p 跨端漂移门)

# 票：302p 的两处结构缺陷 —— 登记面在提交期无人看守；judgedGapWeb 把"诚实缺屏"判成漂移

状态：CLOSED（缺陷② 2026-11-08 修；缺陷① 2026-11-08 接线修复）　　开票：2026-11-08　　开票人：收敛线

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

## 缺陷②修复落地（2026-11-08）

**改法**（基线数值一个字未动）：
- `GATE_DIRECTIONS` 移除 `['judgedGapWeb','up']`：登记动作不再进回归维。
- 登记面 `judgedGapWebRegistered`：只进 `advisories`（人读面标「只报数不阻断」），不进 `state`/`reasons`/退出码；`--gate` 面同时报「基线 → 现读」与新增 gap 键。
- 承载削减面 `judgedGapWebRegression`（blocking）：`judgedGapKeys ∩ 基线承载键(aligned ∪ portal)`，同一 web 键从承载退化为 gap 才阻断并点名该键；键集取不到 ⇒ 该面记「未判定」，不折成 0。
- 键级参照来源：`readBaselineLedger()` 沿 `git log -1 -- scripts/data/cross-end-drift-gate-baseline.json` 找到基线落盘提交，读同树台账按 status 归堆（只做差集，不重算判定）；基线文件本身不改。
- 非 `--gate` 面：`prev` 快照缺键集时登记面只按计数报数、不阻断；承载面另由 `web-aligned-decrease` / `alignedUnique` 兜底，新增 `web-portal-carried-decrease` 兜门户承载行减少。
- 尺子 `check-web-rn-screen-parity.mjs --json` 新增 `alignedKeys` / `portalKeys` / `judgedGapKeys` 三个键（既有键名与类型未动，J1 锁）。

**先红后绿夹具**：
- 改前必红：`D7`（诚实登记 gap 曾被判 `web-judged-gap-increase`）、`G5`（基线 `judgedGapWeb 0→1` 曾被判 regressed）、`G7/G8`（键级分栏尚不存在）。
- 修后仍红：`D8/D9`（aligned / portal 承载键被登记成 gap ⇒ `web-judged-gap-regression` 点名）、`G6`（`alignedUnique 292→291` ⇒ regressed）、`T26b`。
- 读数：镜像测试 `28/28`、self-test `32/32`；真 HEAD `--gate --json` ⇒ `gateState=ok`、`judgedGapWeb=1`（sag2）无回归、`ledgerRef=1b984a2246`（基线提交点）。

## 缺陷①修复落地（2026-11-08）

**改法**（基线数值一个字未动）：
- `check-cross-end-parity-drift.mjs` 解析 `--staged`；`runRulerAsync` 给六把子尺统一转发（索引 blob 面），**不退回工作树**（`--worktree` 仍只作人工逃生）；矩阵文档同取索引面。
- 提交面分档 `commitFaceOf`：id `302` 由 `warn` 提为 `blocking`，但**只让承载削减面判红** —— `mirrored` / `registryEntries` / `aligned` / `alignedUnique` / `fidelityHosted` / `portalRows` / `judgedGapWebRegression`；`unmapped`（新增未登记屏）、`mapRot`、`fidelity*`、`tier*` 等一律降 advisory，人读输出逐行 `· [只报数]`，不进退出码。
- 新接 id `302r`（`check-screen-registration-sync.mjs`，`mode: warn`）：新增 web page / RN 屏 / 小程序页未登记时，点名行走 stderr，原样出现在提交输出（不是只写日志），不阻断提交；fail-closed 的 exit 2 仍按未判定处理。
- push 面 `302p` 判据一字未动：任一维恶化仍 exit 1。

**夹具与真索引面证据**：
- H1–H4（self-test `36/36`、镜像测试 `32/32`）：unmapped 0→1 提交面只报数（同数据 push 面仍 regressed）；alignedUnique 292→291 提交面 regressed；既有承载键变 gap regressed；如实登记不误红。
- 真索引三态：worktree 新屏但未 `git add` ⇒ `unmapped 0`（证明确实读索引而非工作树）；`git add` 后 ⇒ `unmapped 1`、`GATE(commit) STATE=ok`，advisory 行含「只报数」；临时把 `settings` aligned 行改 gap 并暂存 ⇒ `exit 1`、`alignedUnique 292→291`、`judgedGapWebRegression 0→1`，随后 `git restore` 还原。
- 302r 真索引：暂存未登记页 ⇒ `exit 1` 点名 `[unregistered-web-route] drift-probe-302q`。
