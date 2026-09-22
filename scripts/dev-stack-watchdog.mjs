#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// scripts/dev-stack-watchdog.mjs — 守护进程的守护进程(2026-09-22 根治第三层防线)
//
// 事故复盘:dev-stack --watch 守护 16:17 死亡后无人复活,api/web 全挂到用户发现
// 「网络断开」。vbs 自启只在登录时跑一次,守护自身死掉即整个自愈体系瓦解。
//
// 本脚本由 Windows 计划任务(IHUI-DevStackWatchdog,每 2 分钟)调起,单次执行:
//   1. 读 .tmp-sync/dev-stack-watcher.heartbeat.json(dev-stack --watch 每 30s 续写)
//   2. 心跳新鲜(<90s)且 pid 存活 → 守护健康,直接退出
//   3. 否则经 dev-stack-launch.mjs 隐藏拉起守护(单实例锁防双开,新实例会接管)
//
// 用法: node scripts/dev-stack-watchdog.mjs [--install]
//   --install 注册计划任务(幂等);无参 = 单次巡检(计划任务调用形态)

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LOG_DIR = path.join(ROOT, '.tmp-sync');
const HB_FILE = path.join(LOG_DIR, 'dev-stack-watcher.heartbeat.json');
const WATCHDOG_LOG = path.join(LOG_DIR, 'dev-stack-watchdog.log');
const FRESH_MS = 90_000;
const TASK_NAME = 'IHUI-DevStackWatchdog';

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    fs.appendFileSync(WATCHDOG_LOG, line + '\n');
  } catch {
    /* 日志失败不影响巡检 */
  }
  console.log(line);
}

function pidAlive(pid) {
  const p = Number(pid);
  if (!p || p <= 0) return false;
  try {
    const r = spawnSync('tasklist', ['/FI', `PID eq ${p}`, '/FO', 'CSV', '/NH'], {
      windowsHide: true,
      encoding: 'utf8',
      timeout: 8000,
    });
    const m = (r.stdout || '').match(/^\s*"([^"]+)"/m);
    return !!m && m[1].toLowerCase() === 'node.exe';
  } catch {
    return false;
  }
}

function revive() {
  // 经 dev-stack-launch.mjs(node→node fd 直传)隐藏拉起,与开机自启链路一致;
  // 守护侧单实例锁保证心跳旧/进程死时新实例接管而非退出
  const r = spawnSync(
    process.execPath,
    [
      path.join(ROOT, 'scripts', 'dev-stack-launch.mjs'),
      'watcher',
      LOG_DIR,
      ROOT,
      process.execPath,
      path.join(ROOT, 'scripts', 'dev-stack.mjs'),
      '--watch',
      '--device',
    ],
    { windowsHide: true, timeout: 15_000 },
  );
  if (r.error) {
    log(`复活失败: ${r.error.message}`);
    return false;
  }
  log('守护死亡/心跳过期,已触发复活(dev-stack --watch --device)');
  return true;
}

function patrol() {
  let hb = null;
  try {
    hb = JSON.parse(fs.readFileSync(HB_FILE, 'utf8'));
  } catch {
    /* 无心跳文件 = 守护从未跑过或刚被清 */
  }
  const fresh = hb && Date.now() - Number(hb.ts) < FRESH_MS;
  if (fresh && pidAlive(hb.pid)) {
    // 健康:不写日志(每 2 分钟一条会刷爆),静默退出
    return;
  }
  log(`心跳${hb ? `过期(${Math.round((Date.now() - Number(hb.ts)) / 1000)}s,pid ${hb.pid}${pidAlive(hb.pid) ? '存活' : '已死'})` : '缺失'},需要复活`);
  revive();
}

// —— 计划任务注册(幂等) ——
// ASCII-only VBS 包装(桌面零弹窗铁律):计划任务 action 直指 node.exe 必弹 conhost
// 2026-09-23:principal 由 Interactive 改 S4U。下面这条旧注释的前提是 InteractiveToken(有桌面):
// "计划任务 action 直指 node.exe 必弹 conhost"。S4U 跑在 session 0 无桌面,该会话内任何进程都无法
// 产生可见窗口,故不再需要 VBS 包装(连带消灭 .vbs 的 ANSI 编码陷阱)。revive() 的本地派生与本任务
// 同会话,因此也自动落在 session 0,无需改成 Start-ScheduledTask。
function psEncode(script) {
  return Buffer.from(script, 'utf16le').toString('base64');
}

function install() {
  // pwsh(PS7):本机 WDAC 拦 node 派生的 powershell.exe(5.1)报 EPERM
  const me = path.join(ROOT, 'scripts', 'dev-stack-watchdog.mjs');
  try {
    fs.rmSync(path.join(ROOT, 'scripts', 'dev-stack-watchdog-task.vbs'), { force: true });
  } catch {
    /* 旧 VBS 生成物删不掉不阻塞注册 */
  }

  const ps = [
    `$action = New-ScheduledTaskAction -Execute '${process.execPath.replace(/'/g, "''")}' -Argument '"${me.replace(/'/g, "''")}"'`,
    `$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).Date -RepetitionInterval (New-TimeSpan -Minutes 2) -RepetitionDuration (New-TimeSpan -Days 3650)`,
    `$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 5)`,
    `$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType S4U -RunLevel Limited`,
    `Register-ScheduledTask -TaskName '${TASK_NAME}' -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null`,
    `$p = (Get-ScheduledTask -TaskName '${TASK_NAME}').Principal`,
    `Write-Output ("OK LOGON=" + $p.LogonType)`,
  ].join('\n');
  const r = spawnSync('pwsh.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', psEncode(ps)], {
    windowsHide: true,
    encoding: 'utf8',
    timeout: 60_000,
  });
  const out = `${r.stdout || ''}${r.stderr || ''}`;
  if (!/OK LOGON=S4U/.test(out)) {
    console.error(`[dev-stack-watchdog] 计划任务注册失败: ${out.trim().split('\n').slice(-5).join(' | ')}`);
    process.exit(1);
  }
  log(`计划任务 ${TASK_NAME} 已注册(每 2 分钟巡检,LogonType=S4U → session 0,无桌面即无窗口)`);
}

const isDirectRun = process.argv[1] && import.meta.url === (await import('node:url')).pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  if (process.argv.includes('--install')) install();
  else patrol();
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
