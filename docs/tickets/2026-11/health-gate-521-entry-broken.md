<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# 健康门禁 originOk 逐维救援 —— 切流窗口 521 误回滚事故与收口

- 仓库：`D:\IHUI-AI`
- 类别：生产部署门禁核心逻辑（影响全部后续上线）
- 状态：**已落地 · 机主拍板追认 · 待下一轮部署环切流**
- 根因段来源：operator 在对话中给出、并经 Read 源码逐行核验；未在本仓任何 `*.md` 台账落盘，故本票自包含记录根因。

---

## 一、根因（现读源码核验）

文件 `deploy/win/health-gate-verdict.ps1` 的 `Get-HealthGateVerdict`（纯函数、零副作用）里，`originOk` 的旧写法把入口故障判定收成一个**全局聚合布尔** `webOrigin && apiOrigin`：

- 既**漏掉 `llmOrigin`**（llm 整维缺 origin 键时直接算不成立）；
- 又**硬性要求 web+api 同时 pass**（切流窗口里只要末轮 web 不是它的同维，`originOk` 就退化成 false）。

于是切流窗口中 api/llm 公网被 Cloudflare 隧道读成 **521**、而源站直探三路全 200 时，`originOk=false` → 整包判 `fail` → **每一轮都回滚一个好构建**。这正是该模块注释自己警告的"把入口故障当好版本回滚"。

**关键对照（区分"入口坏"vs"构建坏"）：**
- 公网那一路 `api.aizhs.top` 经 Cloudflare 隧道，在切流窗口返回 **521 = 隧道到源站不通**，不是服务挂（已 curl 实证）。
- 源站直探（直打 `127.0.0.1`）全程 **200/ok**。
- 旧代码的 `GATE-GREEN-VIA-ORIGIN` 只把 api/llm 的"源站正常"记进日志（注释明写"只进日志，不进告警身份"），**不改判定**——所以末轮只要 webOrigin 非 pass 或 llm 整维被全局聚合漏掉，`originOk=false` 就判 fail 整包回滚。

**事故影响面：** 自 `2026-11-10 18:19` 起 `last-green.json` 停在 `db32cc91` 零前进；A/B/C 代码修复、app_versions 数据迁移、服务端 app-version 假阳性修复（B）、APK 修复 B 等一连串修复**全部上不了线**——部署环解开 root-guard（6b50bea596 已解除 fail-closed，日志 18:34 `root-guard: verdict=pass` 10/10）后走到健康门禁，每轮 `web=pass api=fail llm=fail`、末轮 `lastFails=[api(521) llm(521)]` → `DEPLOY-DECISION action=rollback`。

---

## 二、推荐修法（最小、对症、复用既有 entry-broken 出口）

把 `originOk` 由"全局 web+api"改成**逐维**：对 `lastFails` 每个失败维取它**自己**的 `*Origin`：

- 全部失败维的**自身** origin 都 = `pass` ⇒ 判 `entry-broken`（不回滚、也不冒绿）；
- 任一失败维 origin 缺失或 ≠ `pass` ⇒ 仍 `fail`（真坏才回滚，fail-closed）。

**不破坏"真坏→回滚"**：稳定态 `api.aizhs.top` 经隧道本就 200（已 curl 实证），521 仅切流窗口且源站直探全程 200；救 521 不会把"隧道真断的好版本"放行成线上 521。

---

## 三、机主拍板（2026-11-11 19:42）

**授权，并追认已正确落地。**

经核验，上述逐维修法**已被另一个会话落地于 `origin/main`**，提交 `42d29418d3`（2026-11-11 19:24:43），标题 `fix(deploy): 健康门禁 originOk 改为逐维救援,修复切流窗口 521 误回滚`：

- 内容与推荐逐字一致（`$originByDim = @{ web='webOrigin'; api='apiOrigin'; llm='llmOrigin' }`，对 `lastFails` 每枚取其维度名→对应 `*Origin`，全部 pass 才 `originOk=$true`；判序本体 `fail / entry-broken / pass / pass-unproven` 一字未动）。
- 故本拍板为**追认已正确落地的修复**，无需再 push。

### 关于 immutable-guard 签名
- 经查 `scripts/data/immutable-guard.json` 受保护面 **不含 `deploy/win/health-gate-verdict.ps1`**（受保护面仅含 `deploy/win/ihui-deploy.ps1`、`ihui-deploy-loop.ps1`、`deploy/win/lib/*.mjs`）。
- 因此本次变更**不需要 `immutable-exempt:` 签名行**；你提到的"走 immutable-guard 签名"对该文件不适用。
- `42d29418d3` 所用 `git push --no-verify` 旁路的是"他人未提交 WIP 改了受保护面"（`scripts/lib/post-commit-hook.js`、`root-guard-manifest.json`、`.husky/pre-push` 等）导致的外部红（IG 门红），与本次 3 文件变更无关；提交信息已附 `External-Red-Audit` 说明，符合旁路落地纪律（不改判据/门注册/超时/基线）。

---

## 四、验证（判据必须在真跑那一刻才成立）

- 纯函数有 harness + node 镜像测试；`health-gate-verdict-harness.ps1` 新增：
  - **[16] 真事故回归**：切流窗口 api/llm 公网 521、源站三路全 200 ⇒ 仍 `entry-broken`（不回滚好构建）；
  - **[17] 反向对照**：任一失败维自身源站也不健康 ⇒ 仍 `fail`（真坏，按 fail-closed 回滚）；
  - 另含 [9]/[10]/[11] 等"源站 fail / 取不到 / 不传"均判 `fail` 的反向锁。
- `health-gate-verdict.test.mjs` 保留 T6（判序自洽）、T8（入口故障不回滚也不冒绿）、T9（llm 源站腿）等断言。
- **本地实跑**：`node --test deploy/tests/health-gate-verdict.test.mjs` → **9/9 pass**（harness 零 FAIL 内含）；提交记录 `node/ps1 判据 48/48 + 9/9 全绿`。

---

## 五、后续（无需再 push）

修复已在 `origin/main`（`42d29418d3`）。**部署环下一轮将读取该提交完成切流**，把 B 修复与所有积压修复一并上线。本轮无需任何额外推送动作。

### 工作树备注（已对齐，2026-11-11 20:15 收尾）
- 本地 3 个 deploy 文件此前有与 `42d29418d3` 同文的未提交副本，已 `git checkout HEAD --` 归位；`git diff origin/main --` 三文件为空（逐字节对齐），`deploy/` porcelain 为空。
- 本地 `main` 已与 origin/main 对齐（`behind=0`），`42d29418d3` 已是 HEAD 祖先且修复在 HEAD 树中。无需再 push 该修复。

---

## 六、审计发现（2026-11-11 并行 agent 普查，补漏）

### 6.1 已修：`deploy/win/tests/health-gate-evidence.test.ps1` 第 4 组被逐维修法打红（28/29）
- `42d29418d3` 只改了 3 个文件，漏了本文件的 `Rnd` 辅助函数——它只写 `webOrigin/apiOrigin`、**无 `llmOrigin`**；用例 4a 喂 `llm=fail` 却期望 `entry-broken`，逐维 fail-closed 下 llm 失败维缺 `llmOrigin` ⇒ 实得 `fail` ⇒ 4a 红（`pass=28 fail=1`）。
- 修法：`Rnd` 增 `$lo` 形参并写 `llmOrigin`；4a/4b/4c 按逐维语义传值（4a 失败维 llm 源站 pass ⇒ entry-broken；4b llm 源站 fail ⇒ fail；4c 全绿 ⇒ pass）。**复跑 29/29 全绿**。这是 `42d29418d3` 的收尾补丁。

### 6.2 残余（需机主定夺，本次未改）
- **`$proven` 漏维假绿（`health-gate-verdict.ps1:66`）**：`$proven` 只凭"本轮 `fails`/`unknown` 皆空"反推三项全绿，不校验 `$dims` 每维 `pass>0`。若某维整维缺席（键缺失/未探）仍可能判 `pass`。**现网不可达**：真实调用方 `ihui-deploy.ps1:1160-1216` 每轮必探三维、非绿维必落 `fails`/`unknown`（rescued 除外，且 rescued 是 2026-10-19 既定"源站 pass 折算为绿"语义）。属纵深防御建议，改它会触及既定 rescue 语义，故留待定夺。
- **llm 源站腿端点不等价（`ihui-deploy.ps1:1174`）**：llm 源站腿探 `8803/health`（liveness、免鉴权瞬时），公网腿 `Test-LlmGateway` 探 `/api/llm/providers/health`。若 providers 路由真坏（404/500）而 8803 活着 ⇒ `llmOrigin=pass` ⇒ 判 entry-broken ⇒ 不回滚坏构建。**这是既有腿的端点选择权衡**（源站直探拿不到 providers 鉴权），非本次修复引入；本次逐维改造反而比改前更严（改前 llm 失败根本不看 llmOrigin）。彻底收口需给 llm 源站腿补带鉴权的 providers 探针，属另一张票。

**总评**：主链路逐维修复完整、判序未动、测试全绿；两处残余均为"放行坏构建/假绿"方向的纵深防御项，非本次事故的误回滚方向，登记待定夺。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
