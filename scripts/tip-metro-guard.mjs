// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
// scripts/tip-metro-guard.mjs — TIP worktree Metro(8813) 守护(开机自启 + 崩溃自愈)
//
// ⚠️ 与 dev-stack.mjs「Metro 单实例铁律(2026-10-15 你立)」的关系:
//   全仓库唯一 Metro 仍是 web-preview(8806)。本脚本另起的 8813 是**专为手机热更新
//   远端 TIP 代码**而设的预览 Metro,跑在 .worktrees/rnmp-latest(TIP 工作树),与 8806
//   并存是**有意为之**——手机要的是 TIP 而非主仓代码,否则就得回退去重编原生(你拒了)。
//   回归单 Metro 时,停掉本任务即可:node scripts/tip-metro-guard.mjs stop
//
// 职责:
//   1. 每 30s 探活 8813;挂了就用 dev-stack-launch.mjs(零窗口 detached)拉起 TIP Metro
//      (node <worktree>/node_modules/expo/bin/cli start --port 8813, cwd=worktree)。
//   2. 周期性重建 adb reverse(手机重启会丢):8805→8813(Metro 深链 ihui://localhost:8805)、
//      8807→8807(prod-proxy)、8802→8802(API)、8801→8801(web)。幂等,与 dev-stack --device 不冲突。
//   3. 注册 S4U 计划任务 IHUI-TipMetro 开机自启(模式同 install-dev-stack-autostart.mjs)。
//
// 用法:
//   node scripts/tip-metro-guard.mjs            # 跑守护循环(计划任务里这么跑)
//   node scripts/tip-metro-guard.mjs status     # 打印 8813 监听 + adb reverse 现状
//   node scripts/tip-metro-guard.mjs start-now  # 一次性确保 reverse + 拉起(若未起)
//   node scripts/tip-metro-guard.mjs install    # 注册 S4U 计划任务(开机自启)
//   node scripts/tip-metro-guard.mjs stop       # 注销计划任务

import { spawn, spawnSync } from 'node:child_process';
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LOG_DIR = path.join(ROOT, '.tmp-sync');
const LAUNCHER = path.join(ROOT, 'scripts', 'dev-stack-launch.mjs');
const ADB = path.join(ROOT, '.android-toolchain', 'android-sdk', 'platform-tools', 'adb.exe');
const TIP_WT = path.join(ROOT, '.worktrees', 'rnmp-latest');
const RN_TIP = path.join(TIP_WT, 'apps', 'mobile-rn');
const EXPO_TIP = path.join(RN_TIP, 'node_modules', 'expo', 'bin', 'cli');
const METRO_PORT = 8813;
const NAME = 'tip-metro';
const TASK_NAME = 'IHUI-TipMetro';
const REVERSE_MAPS = [
  ['8805', '8813'], // Metro(手机 dev client 深链 ihui://localhost:8805)
  ['8807', '8807'], // prod-proxy(API 反代出口)
  ['8802', '8802'], // API 直连
  ['8801', '8801'], // web(OAuth 等)
];
const WATCH_MS = 30_000;

function preflight() {
  const missing = [];
  for (const [label, p] of [
    ['expo', EXPO_TIP],
    ['工作树', RN_TIP],
    ['adb', ADB],
    ['launcher', LAUNCHER],
  ]) {
    if (!fs.existsSync(p)) missing.push(`${label}: ${p}`);
  }
  return missing;
}

// —— TCP 双栈探活 ——
function tcpOpen(port, timeout = 1500) {
  return new Promise((resolve) => {
    const tryHost = (host) =>
      new Promise((res) => {
        const s = net.connect({ port, host });
        const to = setTimeout(() => {
          try {
            s.destroy();
          } catch {}
          res(false);
        }, timeout);
        s.once('connect', () => {
          clearTimeout(to);
          try {
            s.destroy();
          } catch {}
          res(true);
        });
        s.once('error', () => {
          clearTimeout(to);
          res(false);
        });
      });
    Promise.all([tryHost('127.0.0.1'), tryHost('::1')]).then(([a, b]) => resolve(a || b)).catch(() => resolve(false));
  });
}

// —— 选 node:优先复用正在跑的 8813 Metro 的 node(已验证可用),否则 env,否则自身 ——
function resolveNodeExe() {
  try {
    const r = spawnSync(
      'wmic',
      ['path', 'win32_process', 'where', 'name="node.exe"', 'get', 'commandline,processid', '/format:csv'],
      { encoding: 'utf8', windowsHide: true, timeout: 15000, stdio: ['ignore', 'pipe', 'pipe'] },
    );
    for (const line of (r.stdout || '').split('\n')) {
      if (line.includes('expo') && line.includes(String(METRO_PORT))) {
        const m = line.match(/([^\s"]+node\.exe)/i);
        if (m) return m[1];
      }
    }
  } catch {}
  if (process.env.IHUI_TIP_METRO_NODE && fs.existsSync(process.env.IHUI_TIP_METRO_NODE))
    return process.env.IHUI_TIP_METRO_NODE;
  return process.execPath;
}

// —— adb reverse(幂等,失败忽略) ——
function ensureAdbReverse() {
  if (!fs.existsSync(ADB)) return;
  for (const [device, host] of REVERSE_MAPS) {
    try {
      spawnSync(ADB, ['reverse', `tcp:${device}`, `tcp:${host}`], {
        windowsHide: true,
        timeout: 10000,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch {}
  }
}
function adbReverseList() {
  if (!fs.existsSync(ADB)) return '(adb 缺失)';
  try {
    const r = spawnSync(ADB, ['reverse', '--list'], {
      windowsHide: true,
      timeout: 10000,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return (r.stdout || '').trim() || '(无映射)';
  } catch {
    return '(读取失败)';
  }
}

// —— 拉起 TIP Metro(复用 dev-stack-launch.mjs 零窗口 detached) ——
function launchTipMetro() {
  const nodeExe = resolveNodeExe();
  const env = { ...process.env };
  delete env.CI; // 防泄漏:CI 模式会让 Metro 关掉 reload
  delete env.CI_ENABLED;
  fs.mkdirSync(LOG_DIR, { recursive: true });
  // dev-stack-launch.mjs <name> <logDir> <cwd> <exe> [args...]
  const child = spawn(
    process.execPath,
    [LAUNCHER, NAME, LOG_DIR, RN_TIP, nodeExe, EXPO_TIP, 'start', '--port', String(METRO_PORT)],
    { detached: true, stdio: 'ignore', windowsHide: true, env },
  );
  child.unref();
  return child.pid;
}

async function tick() {
  ensureAdbReverse();
  const up = await tcpOpen(METRO_PORT);
  if (!up) {
    console.log(
      `[tip-metro-guard ${new Date().toISOString()}] 8813 未监听,拉起 TIP Metro(worktree=${path.basename(TIP_WT)})`,
    );
    try {
      launchTipMetro();
    } catch (e) {
      console.error('launch failed:', e);
    }
  }
}

// —— S4U 计划任务注册(模式同 install-dev-stack-autostart.mjs) ——
const psEncode = (script) => Buffer.from(script, 'utf16le').toString('base64');
function runPs(script) {
  const r = spawnSync('pwsh.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', psEncode(script)], {
    windowsHide: true,
    encoding: 'utf8',
    timeout: 90_000,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return `${r.stdout || ''}${r.stderr || ''}`.trim();
}
function installTask() {
  const missing = preflight();
  if (missing.length) {
    console.error('[tip-metro-guard] 路径缺失,无法安装:\n' + missing.join('\n'));
    process.exitCode = 1;
    return;
  }
  const nodeExe = process.execPath;
  const guard = fileURLToPath(import.meta.url);
  const argLine = `"${guard}" guard`;
  const ps = [
    `$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType S4U -RunLevel Limited`,
    `$action = New-ScheduledTaskAction -Execute '${nodeExe.replace(/'/g, "''")}' -Argument '${argLine.replace(/'/g, "''")}'`,
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
  if (!/LOGON=S4U/.test(out)) {
    console.error(`[tip-metro-guard] 注册/启动失败:\n${out.split('\n').slice(-6).join('\n')}`);
    process.exit(1);
  }
  console.log(
    `[tip-metro-guard] 任务 ${TASK_NAME} 已注册并启动:${out.split('\n').find((l) => l.startsWith('LOGON=')) || out}`,
  );
  console.log('[tip-metro-guard] 守护跑在 session 0(无桌面)→ 无窗口;自愈 30s。停止: node scripts/tip-metro-guard.mjs stop');
}
function stopTask() {
  const ps = `Unregister-ScheduledTask -TaskName '${TASK_NAME}' -Confirm:$false -ErrorAction SilentlyContinue; Write-Output "done"`;
  const out = runPs(ps);
  console.log(`[tip-metro-guard] 任务 ${TASK_NAME} 已注销: ${out || '(若无此任务则本就不存在)'}`);
}

// —— CLI ——
const mode = process.argv[2] || 'guard';
async function main() {
  if (mode === 'install') return installTask();
  if (mode === 'stop' || mode === 'uninstall') return stopTask();
  if (mode === 'status') {
    const up = await tcpOpen(METRO_PORT);
    console.log(`8813(TIP Metro): ${up ? '监听中' : '未监听'}`);
    console.log(`adb reverse:\n${adbReverseList()}`);
    let head = '?';
    try {
      head = spawnSync('git', ['-C', TIP_WT, 'rev-parse', '--short', 'HEAD'], {
        encoding: 'utf8',
        windowsHide: true,
      }).stdout.trim();
    } catch {}
    console.log(`工作树: ${RN_TIP} (HEAD ${head})`);
    return;
  }
  if (mode === 'start-now') {
    const missing = preflight();
    if (missing.length) {
      console.error('路径缺失:\n' + missing.join('\n'));
      process.exitCode = 1;
      return;
    }
    ensureAdbReverse();
    if (!(await tcpOpen(METRO_PORT))) launchTipMetro();
    else console.log('8813 已在监听,跳过');
    return;
  }
  // guard(默认):跑循环
  const missing = preflight();
  if (missing.length) {
    console.error('[tip-metro-guard] 路径缺失,守护无法工作:\n' + missing.join('\n'));
    process.exit(1);
  }
  console.log(
    `[tip-metro-guard] 守护启动:每 ${WATCH_MS / 1000}s 探活 8813 + 重建 adb reverse。session 内 Ctrl+C 退出。`,
  );
  await tick();
  const t = setInterval(() => tick(), WATCH_MS);
  const shutdown = () => {
    clearInterval(t);
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
main();
