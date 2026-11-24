<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# S6 落地现场 — parent-bound 看门狗(复现+超越 WorkBuddy Job Object)

- 标题行:S6(goal-b49 执行席,REA 取证落地:Win32 Job Object「父死子随死」能力复现+超越)
- `git rev-parse HEAD` 现读:e557c22648652636498e67f726fe74de1f46291f(收尾复测同值,主席现场 HEAD 未漂移)
- 计划动的文件:`apps/cli/src/util/parent-bound.ts`(新增)、`apps/cli/tests/parent-bound.test.ts`(新增)、`apps/cli/src/tools/mcp-runtime.ts`(接线两处);`spawn-isolated.ts` 只 import。

## 一、现场读数

- 动手前 `git status --porcelain -- <四路>` = 空(全部干净);收尾复现读 = `M mcp-runtime.ts` / `?? parent-bound.ts` / `?? parent-bound.test.ts`,spawn-isolated.ts 无行(零修改得证)。
- HEAD 的 `apps/cli/src/commands/skill-package.ts:33` 缺模块为他席在飞存量(票面已证),本席未碰;验证一律走 vitest/tsc 直调,不依赖 CLI 全局入口。
- apps/cli 整目录被 `.prettierignore` 模式 `cli/` 忽略(`--file-info` 现读 ignored:true)⇒ 格式门对该面无问责;新文件按同目录 util 风格(无分号单引号)书写,mcp-runtime 追加行随其本地分号风格。

## 二、落了什么

1. **`apps/cli/src/util/parent-bound.ts`(248 行,<250 达标)**
   - `decideWatchdogTick({parentAlive,childAlive,nowMs,startedAtMs,maxLifetimeMs})` → `'wait'|'kill'|'exit'|'unjudged'` 纯判据:子先死⇒exit(不留僵尸看守);父死子活⇒kill;都活且到 `maxLifetimeMs`⇒exit(看门狗自身死亡机制,观测评不到也不卡死机制);任一观测为 null⇒`unjudged` 绝不动手(§0.3)。父死+超上限并存时先 kill,runner 完成回收立即自退,死亡机制在 runner 层兜住。
   - `unjudgedFieldsOf()` 点名是哪一维观测缺失;`observeProcessAlive()` 按 `process.kill(pid,0)` 语义:ESRCH=死、**EPERM=活**、其余=null(不猜)。
   - `stepWatchdog(deps,cfg)`:观测+判据+(仅 kill 档)执行;副作用全在注入的 deps。
   - `spawnParentWatchdog(child,opts)`:父侧 await 采生前创建标识(`captureRootCreationIdentity`,import 单源)→ 以 `detached:true, stdio:'ignore', windowsHide:true` 拉起**自身模块** runner(§22d `isDirectRun`+`pathToFileURL`,仅 `.js/.mjs/.ts` 白名单路径才拉,SEA 等不可直跑形态显式折 null);全程零抛错,任何失败=显式降级。
   - 杀树**零复制**:runner 的 killTree 走 `killProcessTreeVerified`(import 自 spawn-isolated.js)—— 身份复核+PID 复用防误认全在那一份;本文件不出现 taskkill/kill(-pid) 第二实现。跨进程拿不到真实 ChildProcess ⇒ 以最小观测形 `{pid,exitCode:null,signalCode:null}` 进入同一判据(该函数只读这三键,且本调用点固定显式传 `preMortemCreationIdentity`,不触父侧 WeakMap;注释已写明,若判据将来新增读取键,需 spawn-isolated 开 pid 形态新出口——本席未要求)。
   - 身份采不到 ⇒ payload 带 null ⇒ kill 档在 `killProcessTreeVerified` 第②环 fail-closed(不杀),比对方 Job Object 更保守。
2. **接线(mcp-runtime.ts,门 121 消费者成立)**:stdio 分支 `conn.process = proc;` 之后、`if (proc.pid)` 时 `void spawnParentWatchdog(proc, { label })`。未动 `detached` 取值(G-690 分档原样)、未动 disconnectMcpServer 回收腿(G-690 killProcessTree+G-692 补刀原样);import 区加一行(带取证指路注释)。
3. **`apps/cli/tests/parent-bound.test.ts`(161 行)**:票面六例全覆盖 —— ①父死⇒kill ②父活子活⇒wait ③子先死⇒exit(含父母俱亡⇒exit) ④到点即超⇒exit(含+1ms) ⑤观测缺失⇒unjudged+点名维度、stepWatchdog 反证(spy `not.toHaveBeenCalled()`)与正证(恰一次且收 childPid)、wait/exit 档同不触发、观测缺失+超上限仍 exit ⑥形状锁:现读源码切出 `decideWatchdogTick` 函数体,断言零 spawn(/kill(/process.kill/process.exit/exec*/readFileSync/writeFileSync/require(/import(。

## 三、验证末行现读(全部为最终源码态复跑)

- `npx vitest run tests/parent-bound.test.ts` → `Tests 10 passed (10) / Duration 466ms`
- MCP/spawn 回归(5 枚相关档):`npx vitest run tests/mcp-runtime-kill-tree.test.ts tests/g-694-mcp-stdio-cleanup.test.ts tests/mcp-runtime.test.ts tests/spawn-isolated-stop-machine.test.ts tests/g-689-mcp-stderr-diagnostics.test.ts` → `Test Files 5 passed (5) / Tests 47 passed (47) / Duration 29.41s`(含「spawn 分档在位」原判据仍绿=detached 未被本席改动)
- `npx tsc --noEmit -p tsconfig.json`(src 面)→ exit=2,全量原始输出 7 行且**逐行均为 `src/commands/skill-package.ts`**(他席在飞存量,票面已证,不代修);`grep -cE "parent-bound|mcp-runtime"`=0 ⇒ 触及面 0 错。tests 面(tsconfig.tests.json)同法:触及面 0 错(其余为他席大面积存量)。
- 水印:`inject` 两新文件 → `injected`;终态 `inject` 复跑 → `skip-done`(幂等);`verify` parent-bound.ts / parent-bound.test.ts / mcp-runtime.ts 三枚均 → `覆盖 1/1 个指定文件, 残迹 0, 载荷损坏 0, 仅隐写 0 … 纳入口径的文件均已携带完整溯源水印。`
- 端到端冒烟(dist/s6-smoke-build 编译产物、真实依赖面,跑毕已清):父死+子活+无身份 → `exit=0 elapsed_ms=1387` 且 `CHILD_STILL_ALIVE`(runner 循环真执行、kill 档 fail-closed 不杀裸 PID 得证);子先死 → `exit=0 elapsed_ms=1389`(一个 tick 内自退,不留僵尸看守);坏 payload → `exit=0` 即退不触碰任何进程;无 flag 直跑 → `exit=0` 无操作(isDirectRun/flag 双条件互不越界)。

## 四、超越轴对账(票面三条)

- ① 纯函数化入库可 diff:已做到(decideWatchdogTick + 形状锁第⑥例,守门 diff 面可见)。
- ② 看门狗自身死亡机制:已做到(maxLifetimeMs 到点必 exit,且观测缺失不卡该机制;子先死即退 —— 对方靠 OS,无此概念)。
- ③ 观测不到=不判定且不动手:已做到('unjudged' 档 + unjudgedFieldsOf 点名 + spy 反证零杀调用;对方无此档)。

## 五、未竟(逐条带解锁条件)

1. **dev/vitest 形态下 runner 实际不落生效**:tsx 直跑的 `.ts` 被 `node <path>` 拉起时会因加载器缺位失败 ⇒ 静默降级(冒烟已证生产 dist 形态可用)。解锁:生产 dist 运行自然生效;若机主要求 dev 面也兜底,需主席裁决是否随 env 传 tsx loader(涉派生 env 面,超本票边界)。
2. **看门狗静默无留痕**:身份采不到/spawn 失败均折 null,运行侧无日志面(stdio ignore)。解锁:按 §5e-1「可整改性」准入由主席定是否接台账/邮件;本席不自接。
3. **仅 mcp-runtime stdio 分支接线**(票面明定);spawnIsolated 等其余派生面仍只有优雅回收腿。解锁:主席按票面扩单(对方是全局 Job,本仓按面推进)。
4. **带真实身份的端到端正向击杀**(现测身份匹配⇒真派生 taskkill / kill(-pid))由 spawn-isolated 既有镜像用例钉住,本席未另造(判据零复制原则)。解锁:如需跨进程全链路 e2e,归主席立单。
5. **提交/推送**:票面禁本席 commit/push,落地由主席走 safe-commit/object-space-land 常规链(触及面守门已预判:格式门对 apps/cli 为 ignored、水印 verify 绿、门 121 消费者在 mcp-runtime 成立)。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
