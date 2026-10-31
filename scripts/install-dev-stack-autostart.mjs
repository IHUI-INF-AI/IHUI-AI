// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// scripts/install-dev-stack-autostart.mjs — 把 dev-stack 守护装进「非交互会话」计划任务(开机自启)
//
// 用途(2026-09-22 起,2026-09-23 改造):Windows 登录后自动起 `dev-stack.mjs --watch --device`,
//   每 30s 体检自愈 + 周期重建 adb reverse。npm script: pnpm dev:stack:autostart
//
// 为什么从「启动夹 VBS 隐藏窗口」改成「S4U 非交互计划任务」(2026-09-23 用户硬要求:
// 一扇窗也不许弹,同时自愈不许降速):
//   隐藏窗口靠的是 SW_HIDE(→ `windowsHide:true` / VBS `Run(...,0,...)`),它要求**每个派生点
//   都记得传参**。而服务重启的窗口是 tsx / uvicorn / pnpm 内部 spawn 的孙代进程开的,
//   那些调用点不在我们手里(实测:`tsx` dist 里 `windowsHide` 出现 0 次),逐点补参数是打地鼠。
//   S4U 任务跑在 session 0,**没有桌面** → 该会话内任何进程都无法在你的屏幕上产生窗口,
//   与它怎么 spawn 无关。这是机制无关的根治。
//   A/B 实测(同结构、探针判定,详见 AGENTS.md §5b 与 PROJECT_PLAN 2026-09-23 条目):
//     A 交互任务 session 1 → 故意 windowsHide:false 的子 cmd 弹窗(探针抓到 1 扇)= 阳性对照
//     B S4U  任务 session 0 → 同一探针 0 扇,且其监听端口从 session 1 用 127.0.0.1 可正常访问
//   因此本任务不再需要 VBS 包装:直跑 node.exe 也不会有窗口(§5b「计划任务禁直跑控制台程序」
//   那条铁律的前提是 InteractiveToken,见该节例外说明)。
//
// 链路: 登录 → IHUI-DevStack 任务(S4U,session 0)→ dev-stack-launch.mjs(fd 直传日志,
//       立即退场;孤儿子进程存活已由看门狗复活路径实证)→ dev-stack.mjs --watch --device
// 日志: .tmp-sync/dev-stack-watcher.log(.err.log);服务自身日志 .tmp-sync/dev-stack-<名>.log
// 停止: pnpm dev:safe:stop(按端口归属杀,跨会话有效)

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolveTaskNodeAnchor } from './lib/task-node-anchor.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TASK_NAME = 'IHUI-DevStack';
// 锚点不再直接取 process.execPath(「谁跑就烤谁」是 2026-10-31 两枚常驻任务被烤上第三方 IDE
// 自带 node 的根因)。判据单源 = scripts/lib/task-node-anchor.mjs;缺失时由 install() 现算。
let NODE_EXE = process.execPath;
const LAUNCHER = path.join(ROOT, 'scripts', 'dev-stack-launch.mjs');
const STACK = path.join(ROOT, 'scripts', 'dev-stack.mjs');
const LOG_DIR = path.join(ROOT, '.tmp-sync');
const HB_FILE = path.join(LOG_DIR, 'dev-stack-watcher.heartbeat.json');
// 旧形态残留:启动夹里的 VBS 自启(会在 session 1 起第二个守护,必须清掉,否则双头抢拉)
const LEGACY_VBS = path.join(
  os.homedir(),
  'AppData',
  'Roaming',
  'Microsoft',
  'Windows',
  'Start Menu',
  'Programs',
  'Startup',
  'ihui-dev-stack.vbs',
);

const psEncode = (script) => Buffer.from(script, 'utf16le').toString('base64');

// SCHED_S_TASK_RUNNING(0x41301)。本任务 ExecutionTimeLimit=0,注册并 Start 之后立刻回读
// 拿到的就是这一枚,而不是 0。
const TASK_RESULT_RUNNING = 267009;

/**
 * 判「注册 + 启动」是否成功(纯函数,不碰 IO,测试直接 import 生产判据)。
 *
 * 旧判据是 `/LAST=(?!0\b)/` ⇒ 只认 LAST=0,于是**每次成功注册都被判成失败**并 exit 1:
 * 照文档敲 `pnpm dev:stack:autostart` 的人以为没装上,而 dev-stack-watchdog 的自愈腿
 * (`r.status !== 0` ⇒ 记 `non-s4u-repair-failed`)永远收不到成功,每 2 分钟重装一次。
 * 失效方向按 §0.3:读不到 `LOGON=… LAST=…` 形状 ⇒ 未判定(exit 2),既不冒绿也不冒红。
 */
export function judgeRegisterOutcome(out) {
  const text = String(out ?? '');
  const m = /LOGON=(\S+)\s+LAST=(\d+)/.exec(text);
  if (!m) {
    return { ok: false, undetermined: true, logon: null, last: null, why: '读不到 LOGON/LAST 形状' };
  }
  const logon = m[1];
  const last = Number(m[2]);
  if (logon !== 'S4U') {
    return { ok: false, undetermined: false, logon, last, why: `LogonType=${logon}(非 S4U ⇒ 有桌面即会弹窗)` };
  }
  if (last !== 0 && last !== TASK_RESULT_RUNNING) {
    return { ok: false, undetermined: false, logon, last, why: `LastTaskResult=${last}` };
  }
  return {
    ok: true,
    undetermined: false,
    logon,
    last,
    why: last === TASK_RESULT_RUNNING ? 'running(常驻任务正在跑)' : 'completed(LAST=0)',
  };
}

// pwsh(PS7):本机 WDAC 拦 node 派生的 powershell.exe(5.1)报 EPERM;AGENTS.md §27 亦要求 pwsh
function runPs(script) {
  const r = spawnSync('pwsh.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', psEncode(script)], {
    windowsHide: true,
    encoding: 'utf8',
    timeout: 90_000,
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return `${r.stdout || ''}${r.stderr || ''}`.trim();
}

// 停掉 session 1 里在跑的旧守护(读心跳里的 pid),避免与新任务形成双守护
function stopLegacyWatcher() {
  let hb = null;
  try {
    hb = JSON.parse(fs.readFileSync(HB_FILE, 'utf8'));
  } catch {
    /* 无心跳文件 = 旧守护没在跑 */
  }
  const pid = Number(hb?.pid);
  if (!pid || pid <= 0) return 'no legacy watcher pid recorded';
  const r = spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], {
    windowsHide: true,
    timeout: 20_000,
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return r.status === 0 ? `已停止旧守护 pid=${pid}` : `旧守护 pid=${pid} 无需停止或已退出`;
}

function install() {
  const anchor = resolveTaskNodeAnchor({
    execPath: process.execPath,
    pathEntries: String(process.env.PATH ?? '').split(path.delimiter),
    exists: (p) => fs.existsSync(p),
  });
  if (!anchor.ok) {
    console.error(
      `[dev-stack:autostart] ${anchor.undetermined ? '未判定' : '拒绝注册'}:${anchor.why}`,
    );
    process.exit(anchor.undetermined ? 2 : 1);
  }
  NODE_EXE = anchor.anchor;
  if (anchor.note) console.log(`[dev-stack:autostart] ${anchor.note}`);
  for (const f of [NODE_EXE, LAUNCHER, STACK]) {
    if (!fs.existsSync(f)) {
      console.error(`[dev-stack:autostart] ⚠️ 依赖缺失: ${f}`);
      process.exitCode = 1;
      return;
    }
  }

  const legacyRemoved = (() => {
    try {
      if (!fs.existsSync(LEGACY_VBS)) return 'none';
      fs.rmSync(LEGACY_VBS, { force: true });
      return LEGACY_VBS;
    } catch (e) {
      return `删除失败: ${e instanceof Error ? e.message : String(e)}`;
    }
  })();

  const stopMsg = stopLegacyWatcher();

  // 动作参数与旧启动夹 VBS 完全一致,只是宿主换成 session 0
  const argLine = `"${LAUNCHER}" watcher "${LOG_DIR}" "${ROOT}" "${NODE_EXE}" "${STACK}" --watch --device`;
  const ps = [
    `$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType S4U -RunLevel Limited`,
    `$action = New-ScheduledTaskAction -Execute '${NODE_EXE.replace(/'/g, "''")}' -Argument '${argLine.replace(/'/g, "''")}'`,
    `$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME`,
    `$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Seconds 0)`,
    `Register-ScheduledTask -TaskName '${TASK_NAME}' -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null`,
    `Start-ScheduledTask -TaskName '${TASK_NAME}'`,
    `Start-Sleep -Seconds 3`,
    `$i = Get-ScheduledTaskInfo -TaskName '${TASK_NAME}'`,
    `$p = (Get-ScheduledTask -TaskName '${TASK_NAME}').Principal`,
    `Write-Output ("LOGON={0} LAST={1}" -f $p.LogonType, $i.LastTaskResult)`,
  ].join('\n');

  const out = runPs(ps);
  const verdict = judgeRegisterOutcome(out);
  if (!verdict.ok) {
    const tail = out.split('\n').slice(-6).join('\n');
    if (verdict.undetermined) {
      console.error(`[dev-stack:autostart] 未判定:读不到注册结果形状 ⇒ 不记成功也不记失败:\n${tail}`);
      process.exit(2);
    }
    console.error(`[dev-stack:autostart] 注册/启动失败(${verdict.why}):\n${tail}`);
    process.exit(1);
  }
  console.log(
    `[dev-stack:autostart] 任务 ${TASK_NAME} 已注册并启动(${verdict.why}):LOGON=${verdict.logon} LAST=${verdict.last}`,
  );
  console.log(`[dev-stack:autostart] 旧启动夹 VBS: ${legacyRemoved} · 旧守护: ${stopMsg}`);
  console.log('[dev-stack:autostart] 守护跑在 session 0(无桌面)→ 其服务树结构性无法弹窗;自愈频率未变(30s)。');
  console.log('[dev-stack:autostart] 停止服务: pnpm dev:safe:stop · 看健康: pnpm dev:stack:check');
}

// §22d 双形态入口:镜像测试要 import judgeRegisterOutcome,import 时不得触发重装动作。
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  install();
}

export const __test__ = { judgeRegisterOutcome, TASK_RESULT_RUNNING };

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
