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
//   1. 读 .tmp-sync/dev-stack-watcher.heartbeat.json(dev-stack --watch 的**推进事件**续写:
//      锁检查后第一枚 → 初始启动阶段每条腿/每轮探活 → 进入循环后每轮 tick;
//      2026-10-31 前的旧实现只在进入 watch 块后才写,于是冷启动 160s 判成"死了",
//      每 2 分钟无效 revive 一头,并把在跑那头的日志以 'w' 截成 0 字节 —— 详见
//      scripts/tests/dev-stack-watchdog-coldstart.test.mjs 的立因段)
//   2. 心跳新鲜(<90s)且 pid 存活 → 守护健康,直接退出
//   3. 否则经 dev-stack-launch.mjs 隐藏拉起守护(单实例锁防双开,新实例会接管)
//
// 判据本体在 decidePatrol(纯函数,挂 __test__ 供镜像测试 import,§22c 禁止第二份);
// 本脚本**没有**新增"任务在跑就宽限"一类的放宽:自愈口径(FRESH_MS=90s + 每 2 分钟一轮)
// 与 2026-10-31 之前逐毫秒相同。
//
// 用法: node scripts/dev-stack-watchdog.mjs [--install]
//   --install 注册计划任务(幂等);无参 = 单次巡检(计划任务调用形态)

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LOG_DIR = path.join(ROOT, '.tmp-sync');
// 心跳落点与写方(scripts/dev-stack.mjs)同源:默认线上那枚;DEV_STACK_HEARTBEAT_FILE
// 只给镜像测试重定向用(两侧必须一起设,否则巡检读默认路径会把健康守护判成死)。
const HB_PATH_ENV = 'DEV_STACK_HEARTBEAT_FILE';
const HB_FILE = (String(process.env[HB_PATH_ENV] || '').trim() || path.join(LOG_DIR, 'dev-stack-watcher.heartbeat.json'));
const WATCHDOG_LOG = path.join(LOG_DIR, 'dev-stack-watchdog.log');
const FRESH_MS = 90_000;
// 巡检节律(分钟):install() 注册的重复间隔就是它,镜像测试用它对账"自愈没被改慢"
const PATROL_INTERVAL_MINUTES = 2;
const TASK_NAME = 'IHUI-DevStackWatchdog';
// 被巡检的守护任务(由 install-dev-stack-autostart.mjs 注册为 S4U 非交互)
const SUPERVISOR_TASK = 'IHUI-DevStack';

/**
 * 巡检裁决(纯判据,零 IO):
 *   心跳缺失/坏形状 → 'revive'(守护从未跑过或刚被清,与 2026-09-22 以来的口径一致)
 *   心跳过期        → 'revive'
 *   心跳新鲜但 pid 已死 → 'revive'(pid 复用/半死)
 *   心跳新鲜且 pid 存活 → 'healthy'
 * 不在此处判"任务是否在跑":冷启动期该由写方自己续心跳(见 dev-stack.mjs 的 heartbeat*)。
 * @returns {'healthy'|'revive'}
 */
function decidePatrol({ hb, now = Date.now(), freshMs = FRESH_MS, alive = false } = {}) {
  const ts = Number(hb?.ts);
  const n = Number(now);
  if (!Number.isFinite(ts) || ts <= 0) return 'revive';
  if (!Number.isFinite(n)) return 'revive'; // 读不到"现在"⇒ 不猜健康,按缺心跳处理(与旧实现同)
  if (n - ts >= freshMs) return 'revive';
  return alive ? 'healthy' : 'revive';
}

/** 心跳龄(毫秒);缺/坏字段 ⇒ null(点名"读不到",不冒充 0 也不冒充健康) */
function heartbeatAgeMs({ hb, now = Date.now() } = {}) {
  const ts = Number(hb?.ts);
  if (!Number.isFinite(ts) || ts <= 0) return null;
  return now - ts;
}

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
    // 2026-10-04：不吃的子进程必须给 stdio，否则本机报 spawnSync EBUSY
    const r = spawnSync('tasklist', ['/FI', `PID eq ${p}`, '/FO', 'CSV', '/NH'], {
      stdio: ['ignore', 'pipe', 'pipe'],
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
    { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true, timeout: 15_000 },
  );
  if (r.error) {
    log(`复活失败: ${r.error.message}`);
    return false;
  }
  log('守护死亡/心跳过期,已触发复活(dev-stack --watch --device)');
  return true;
}

// 守护任务本身是否仍是"S4U 非交互"形态(2026-09-23 立)。
// 为什么由巡检顺带做:弹窗的根因是宿主会话,不是某个 spawn 参数。一旦任务被删掉、
// 换机器/移动仓库后丢失、或被改回 InteractiveToken + VBS(=回到"逐点传 windowsHide"
// 的老路),自愈就白做了。这里不新增守门 ID,只在已有巡检里补一次查询 + 自动重装。
function supervisorTaskHealth() {
  const ps = [
    `$t = Get-ScheduledTask -TaskName '${SUPERVISOR_TASK}' -ErrorAction SilentlyContinue`,
    `if (-not $t) { Write-Output 'MISSING' } else { Write-Output ('LOGON=' + $t.Principal.LogonType) }`,
  ].join('\n')
  const r = spawnSync('pwsh.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', psEncode(ps)], {
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    encoding: 'utf8',
    timeout: 30_000,
  })
  const out = `${r.stdout || ''}`.trim()
  if (out.includes('LOGON=S4U')) return 'ok'
  if (out.includes('MISSING')) return 'missing'
  if (out.includes('LOGON=')) return 'non-s4u'
  // 查不到结论(pwsh 不可用/任务服务异常)时不动手,避免误重装
  return 'unknown'
}

function ensureSupervisorTask() {
  const health = supervisorTaskHealth()
  if (health === 'ok' || health === 'unknown') return health
  log(`守护任务 ${SUPERVISOR_TASK} 异常(${health})→ 自动重装为 S4U 非交互形态`)
  const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'install-dev-stack-autostart.mjs')], {
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    encoding: 'utf8',
    timeout: 90_000,
  })
  if (r.status !== 0) {
    log(`自动重装失败:${`${r.stdout || ''}${r.stderr || ''}`.trim().split('\n').slice(-3).join(' | ')}`)
    return `${health}-repair-failed`
  }
  log(`已重装并启动 ${SUPERVISOR_TASK}(S4U → session 0,无桌面即无窗口)`)
  return 'repaired'
}

function patrol() {
  ensureSupervisorTask();
  let hb = null;
  try {
    hb = JSON.parse(fs.readFileSync(HB_FILE, 'utf8'));
  } catch {
    /* 无心跳文件 = 守护从未跑过或刚被清 */
  }
  const now = Date.now();
  // pidAlive 只在有心跳时才真派生 tasklist(无心跳时 Number(undefined)=NaN ⇒ 直接 false,
  // 与旧实现的短路同 IO 成本:旧版在需要写日志那一支同样调了 pidAlive)
  const alive = pidAlive(hb?.pid);
  const verdict = decidePatrol({ hb, now, freshMs: FRESH_MS, alive });
  if (verdict === 'healthy') {
    // 健康:不写日志(每 2 分钟一条会刷爆),静默退出
    return;
  }
  const age = heartbeatAgeMs({ hb, now });
  log(
    `心跳${
      age === null
        ? '缺失'
        : `过期(${Math.round(age / 1000)}s,pid ${hb.pid}${alive ? '存活' : '已死'})`
    },需要复活`,
  );
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
    `$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).Date -RepetitionInterval (New-TimeSpan -Minutes ${PATROL_INTERVAL_MINUTES}) -RepetitionDuration (New-TimeSpan -Days 3650)`,
    `$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 5)`,
    `$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType S4U -RunLevel Limited`,
    `Register-ScheduledTask -TaskName '${TASK_NAME}' -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null`,
    `$p = (Get-ScheduledTask -TaskName '${TASK_NAME}').Principal`,
    `Write-Output ("OK LOGON=" + $p.LogonType)`,
  ].join('\n');
  const r = spawnSync('pwsh.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', psEncode(ps)], {
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    encoding: 'utf8',
    timeout: 60_000,
  });
  const out = `${r.stdout || ''}${r.stderr || ''}`;
  if (!/OK LOGON=S4U/.test(out)) {
    console.error(`[dev-stack-watchdog] 计划任务注册失败: ${out.trim().split('\n').slice(-5).join(' | ')}`);
    process.exit(1);
  }
  log(`计划任务 ${TASK_NAME} 已注册(每 ${PATROL_INTERVAL_MINUTES} 分钟巡检,LogonType=S4U → session 0,无桌面即无窗口)`);
}

// §22d 双形态守卫:CLI 直跑才执行巡检/注册,被镜像测试 import 时零副作用
// (import 一 patrol 就会派生守护头与 pwsh,这是测试绝不能碰的副作用)。
const isDirectRun = process.argv[1] && import.meta.url === (await import('node:url')).pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  if (process.argv.includes('--install')) install();
  else patrol();
}

// 纯判据与常量导出给镜像测试(scripts/tests/dev-stack-watchdog-coldstart.test.mjs)。
// 测试一律 import 这里,不得再复制第二份判据(§22c)。
export const __test__ = {
  decidePatrol,
  heartbeatAgeMs,
  FRESH_MS,
  PATROL_INTERVAL_MINUTES,
  HB_PATH_ENV,
  HB_FILE,
  TASK_NAME,
  SUPERVISOR_TASK,
};
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
