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
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TASK_NAME = 'IHUI-DevStack';
const NODE_EXE = process.execPath;
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

// pwsh(PS7):本机 WDAC 拦 node 派生的 powershell.exe(5.1)报 EPERM;AGENTS.md §27 亦要求 pwsh
function runPs(script) {
  const r = spawnSync('pwsh.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', psEncode(script)], {
    windowsHide: true,
    encoding: 'utf8',
    timeout: 90_000,
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
  const r = spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { windowsHide: true, timeout: 20_000 });
  return r.status === 0 ? `已停止旧守护 pid=${pid}` : `旧守护 pid=${pid} 无需停止或已退出`;
}

function install() {
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
  if (!/LOGON=S4U/.test(out) || /LAST=(?!0\b)/.test(out)) {
    console.error(`[dev-stack:autostart] 注册/启动失败:\n${out.split('\n').slice(-6).join('\n')}`);
    process.exit(1);
  }
  const line = out.split('\n').find((l) => l.startsWith('LOGON=')) || out;
  console.log(`[dev-stack:autostart] 任务 ${TASK_NAME} 已注册并启动:${line}`);
  console.log(`[dev-stack:autostart] 旧启动夹 VBS: ${legacyRemoved} · 旧守护: ${stopMsg}`);
  console.log('[dev-stack:autostart] 守护跑在 session 0(无桌面)→ 其服务树结构性无法弹窗;自愈频率未变(30s)。');
  console.log('[dev-stack:autostart] 停止服务: pnpm dev:safe:stop · 看健康: pnpm dev:stack:check');
}

// 本脚本仅 CLI 形态使用(无测试 import),故直接执行,不需要 §22d isDirectRun 守卫
install();

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
