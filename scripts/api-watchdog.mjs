#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// scripts/api-watchdog.mjs — api(8802)「卡死但没死」看门狗(2026-11-15 立)
//
// 立因(2026-11-15 实证,别把判据改浅):
//   真机出现过一次 api 进程**半死**:`GET /health` 6ms 返回 200,`POST /api/auth/refresh`
//   与 `GET /api/auth/me` 却永久挂起(curl 20s 无响应,浏览器 10s 超时,responseStatus=0);
//   `POST /api/auth/login`、未知路由仍 4ms 返回 ⇒ 进程没死,是部分链路卡住。
//   由此产生的用户可见现象是「登录态总丢」:拿不到新 access token ⇒ 用户级接口全 401
//   ⇒ 侧边栏「自定义」退回本地缓存(而缓存可能已被写成 `[]`)⇒ 界面像掉登录。
//
//   仓库既有自愈链覆盖不到这一类:
//     · scripts/dev-stack-watchdog.mjs 只看守护进程心跳;
//     · dev-stack --watch 对 api 只探 `GET /health`(见 dev-stack.mjs 的 LEGS),
//       而上面那次事故里 /health 恰恰是健康的。
//   所以本脚本必须**同时**探「零依赖存活」与「带 DB 的用户级路由」:任何一条超时即判卡死。
//
// 用法:
//   node scripts/api-watchdog.mjs           前台常驻,每 30s 探活,连续 2 次失败即重启 api
//   node scripts/api-watchdog.mjs --once    单次体检(健康 exit 0,异常 exit 1),给计划任务用
//
// 环境变量(都有默认值,正常不用设):
//   API_WATCHDOG_PORT=8802        被守护端口
//   API_WATCHDOG_INTERVAL_MS=30000 巡检间隔
//   API_WATCHDOG_TIMEOUT_MS=8000  单次探测超时(与浏览器侧 10s 同量级,别调大)
//   API_WATCHDOG_NO_SPAWN=1       只报不杀不拉(排障/试运行用)
//
// ⚠ 与 `dev-stack --watch`、`pnpm dev:safe` 二选一:那两条链路各自也会拉起/重启 8802,
//   同时在跑会抢端口。本脚本只在「端口没人听」或「判定卡死」时才动手。
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LOG_DIR = path.join(ROOT, '.tmp-sync');
const LOG_FILE = path.join(LOG_DIR, 'api-watchdog.log');

const PORT = Number(process.env.API_WATCHDOG_PORT || 8802);
const INTERVAL_MS = Number(process.env.API_WATCHDOG_INTERVAL_MS || 30_000);
const TIMEOUT_MS = Number(process.env.API_WATCHDOG_TIMEOUT_MS || 8_000);
const NO_SPAWN = process.env.API_WATCHDOG_NO_SPAWN === '1';
const ONCE = process.argv.includes('--once');

// 连续失败阈值:单次抖动(GC/首编译/隧道抖动)不该触发重启,2 次≈1 分钟。
const FAIL_THRESHOLD = 2;
// 重启预算:1 小时内最多 6 次,超了就是代码级故障,重启只会白烧 CPU。
const MAX_RESTARTS_PER_HOUR = 6;
const RESTART_BUDGET_WINDOW_MS = 60 * 60 * 1000;
// 拉起后等待 /health 就绪的上限(api 冷启动要跑插件注册 + Redis/DB 探活)。
const STARTUP_WAIT_MS = 180_000;

const HEALTH_PATH = '/health';
// 带 DB 的用户级路由:无 cookie 时应**快速**返回 400/401;它挂起 = 卡死信号。
const DEEP_PROBE = { path: '/api/auth/refresh', method: 'POST', body: '{}' };

let child = null;
let stopping = false;
let consecutiveFails = 0;
let everSeenUp = false;
let lastHealthyLogAt = 0;
const restartTimestamps = [];

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    fs.appendFileSync(LOG_FILE, line + '\n');
  } catch {
    /* 日志失败不影响巡检 */
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 端口是否有人在听(TCP 连上即算,不看应答)。 */
function isListening() {
  return new Promise((resolve) => {
    const sock = net.connect({ host: '127.0.0.1', port: PORT });
    const done = (v) => {
      sock.destroy();
      resolve(v);
    };
    sock.setTimeout(1500);
    sock.once('connect', () => done(true));
    sock.once('timeout', () => done(false));
    sock.once('error', () => done(false));
  });
}

/** 单次 HTTP 探测;超时与连接失败都算失败,并带回可读原因。 */
async function probe({ method = 'GET', path: p, body } = {}) {
  const started = Date.now();
  try {
    const res = await fetch(`http://127.0.0.1:${PORT}${p}`, {
      method,
      // connection: close —— 不留 keep-alive 长连接,否则 --once 退出时会带着
      // 未关闭的 uv 句柄走 process.exit(Windows 上实测触发 libuv 断言)。
      headers: { connection: 'close', ...(body ? { 'content-type': 'application/json' } : {}) },
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    // 必须把 body 读掉,否则连接不释放
    await res.arrayBuffer().catch(() => {});
    return { ok: true, status: res.status, ms: Date.now() - started };
  } catch (err) {
    const reason =
      err?.name === 'TimeoutError' || err?.name === 'AbortError'
        ? `超时 >${TIMEOUT_MS}ms`
        : String(err?.cause?.code || err?.message || err);
    return { ok: false, reason, ms: Date.now() - started };
  }
}

/**
 * 找出"该杀谁":监听端口的进程,以及它上面属于 api 启动链的祖先。
 *
 * 为什么不能只杀监听者:`node --watch` 的父进程在子进程被杀后仍活着,开发时任意
 * 文件改动都会让它再拉一个子进程 → 与看门狗拉起的 api 抢 8802。所以向上找到
 * **命令行为 api 专属**(@ihui/api / src/index.ts / tsx)的最顶层祖先,连同它一起杀。
 * 一旦祖先不像 api 链路(比如用户跑的是 turbo/pnpm dev 全栈)就立即收手,绝不误杀整栈。
 */
function listenerPid() {
  if (process.platform !== 'win32') {
    const r = spawnSync('lsof', ['-ti', `tcp:${PORT}`, '-sTCP:LISTEN'], { encoding: 'utf8' });
    const pid = Number((r.stdout || '').trim().split(/\s+/)[0]);
    return Number.isFinite(pid) && pid > 0 ? pid : null;
  }
  const ps = [
    `$cur = (Get-NetTCPConnection -LocalPort ${PORT} -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty OwningProcess)`,
    `if (-not $cur) { exit 0 }`,
    `for ($i = 0; $i -lt 4; $i++) {`,
    `  $proc = Get-CimInstance Win32_Process -Filter "ProcessId=$cur" -ErrorAction SilentlyContinue`,
    `  if (-not $proc) { break }`,
    `  $parent = Get-CimInstance Win32_Process -Filter "ProcessId=$($proc.ParentProcessId)" -ErrorAction SilentlyContinue`,
    `  if (-not $parent) { break }`,
    `  if ($parent.CommandLine -match '@ihui/api|src/index\\.ts|--import tsx|tsx watch') { $cur = $parent.ProcessId } else { break }`,
    `}`,
    `$cur`,
  ].join('; ');
  const r = spawnSync('powershell', ['-NoProfile', '-Command', ps], { encoding: 'utf8', windowsHide: true });
  const pid = Number((r.stdout || '').trim());
  return Number.isFinite(pid) && pid > 0 ? pid : null;
}

function killTree(pid) {
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
    return;
  }
  spawnSync('kill', ['-9', String(pid)], { stdio: 'ignore' });
}

function spawnApi() {
  try {
    // Windows 上 pnpm 是 .cmd,必须经 shell 拉起(Node 18.20+ 禁止无 shell 直接 exec .cmd,
    // 实测裸 spawn 抛 EINVAL —— 2026-11-15 自测踩到)。
    child = spawn('pnpm', ['--filter', '@ihui/api', 'dev'], {
      cwd: ROOT,
      stdio: 'inherit',
      shell: true,
      windowsHide: false,
    });
  } catch (err) {
    log(`[child] 拉起失败:${err?.message || err}`);
    child = null;
    return;
  }
  child.on('error', (err) => {
    log(`[child] 拉起失败:${err?.message || err}`);
    child = null;
  });
  child.on('exit', (code, signal) => {
    // 主动 kill 时由 restart 流程复位,这里只记录非预期退出
    if (!stopping && code !== 0) log(`[child] api 进程退出 code=${code} signal=${signal ?? '-'}`);
    child = null;
  });
}

/** 等端口听上且 /health 200(冷启动) */
async function waitHealthy() {
  const deadline = Date.now() + STARTUP_WAIT_MS;
  while (Date.now() < deadline) {
    if (await isListening()) {
      const h = await probe({ path: HEALTH_PATH });
      if (h.ok && h.status === 200) return true;
    }
    await sleep(2000);
  }
  return false;
}

/** 重启预算是否还够 */
function budgetLeft() {
  const now = Date.now();
  while (restartTimestamps.length && now - restartTimestamps[0] > RESTART_BUDGET_WINDOW_MS) {
    restartTimestamps.shift();
  }
  return restartTimestamps.length < MAX_RESTARTS_PER_HOUR;
}

async function restart(reason) {
  if (NO_SPAWN) {
    log(`[判定卡死] ${reason} —— API_WATCHDOG_NO_SPAWN=1,只报不动`);
    return false;
  }
  if (!budgetLeft()) {
    log(`[重启被拒] ${reason} —— 1 小时内已重启 ${restartTimestamps.length} 次,按代码级故障处理,暂停自动重启`);
    return false;
  }
  restartTimestamps.push(Date.now());

  const pid = listenerPid();
  if (pid) {
    log(`[重启] ${reason} —— 结束占用 ${PORT} 的进程树 pid=${pid}`);
    killTree(pid);
    child = null;
  } else {
    log(`[重启] ${reason} —— 端口无人监听,直接拉起`);
  }

  // 等端口真正释放,否则新进程 EADDRINUSE
  for (let i = 0; i < 15; i++) {
    if (!(await isListening())) break;
    await sleep(1000);
  }

  // 本机可能还有别的链路(另一个 dev-stack ensure / 手工启动)在同时抢修:
  // 端口已重新听上就不要再拉第二个,只等它就绪,否则两个实例互抢 8802。
  if (await isListening()) {
    log(`[重启] 端口 ${PORT} 已被其他链路抢先拉起,改为等待就绪`);
  } else {
    log(`[重启] 拉起 pnpm --filter @ihui/api dev`);
    spawnApi();
  }

  const ok = await waitHealthy();
  if (ok) {
    log(`[重启] 完成,/health 200`);
    return true;
  }
  log(`[重启] 失败:${STARTUP_WAIT_MS / 1000}s 内未就绪,下一轮继续判定`);
  return false;
}

async function checkOnce() {
  const listening = await isListening();
  if (!listening) {
    return { healthy: false, reason: `端口 ${PORT} 未监听` };
  }
  // 两条探针并发,总耗时≈较慢那条
  const [health, deep] = await Promise.all([probe({ path: HEALTH_PATH }), probe(DEEP_PROBE)]);
  if (!health.ok) return { healthy: false, reason: `${HEALTH_PATH} 无响应(${health.reason})` };
  if (health.status !== 200) return { healthy: false, reason: `${HEALTH_PATH} 返回 ${health.status}` };
  if (!deep.ok) {
    return { healthy: false, reason: `${DEEP_PROBE.path} 挂起(${deep.reason})⇒ 进程半死` };
  }
  return { healthy: true, detail: `${HEALTH_PATH} ${health.ms}ms · ${DEEP_PROBE.path} ${deep.status}/${deep.ms}ms` };
}

async function main() {
  if (ONCE) {
    const r = await checkOnce();
    log(`[单次体检] ${r.healthy ? '健康' : '异常'}:${r.healthy ? r.detail : r.reason}`);
    // 不用 process.exit:显式退出会在 Windows 上带着 undici 残留句柄触发 libuv 断言。
    process.exitCode = r.healthy ? 0 : 1;
    return;
  }

  log(`[启动] 守护 127.0.0.1:${PORT},间隔 ${INTERVAL_MS / 1000}s,超时 ${TIMEOUT_MS}ms,连续 ${FAIL_THRESHOLD} 次失败即重启`);

  const onSignal = () => {
    stopping = true;
    if (child) {
      log('[退出] 结束本脚本拉起的 api 子进程');
      killTree(child.pid);
    }
    log('[退出] 看门狗已停止');
    process.exit(0);
  };
  process.on('SIGINT', onSignal);
  process.on('SIGTERM', onSignal);

  for (;;) {
    const r = await checkOnce();

    if (r.healthy) {
      if (consecutiveFails > 0) log(`[恢复] 探针正常(${r.detail})`);
      else if (!everSeenUp) log(`[接管] 探针正常(${r.detail})`);
      else if (Date.now() - lastHealthyLogAt > 10 * 60 * 1000) log(`[心跳] 正常(${r.detail})`);
      consecutiveFails = 0;
      lastHealthyLogAt = Date.now();
      everSeenUp = true;
    } else {
      consecutiveFails += 1;
      log(`[探针失败 ${consecutiveFails}/${FAIL_THRESHOLD}] ${r.reason}`);
      if (consecutiveFails >= FAIL_THRESHOLD) {
        // 从未见过它起来(比如用户还没启动 api)时不盲目拉起,避免和手工启动抢端口
        if (!everSeenUp && !(await isListening())) {
          log('[跳过] 该端口从未由本脚本观察到就绪,等待手工启动');
        } else {
          await restart(r.reason);
        }
        consecutiveFails = 0;
      }
    }

    await sleep(INTERVAL_MS);
  }
}

// §22d 双形态守卫:CLI 直跑才执行,被镜像测试 import 时零副作用
const isDirectRun =
  process.argv[1] && import.meta.url === (await import('node:url')).pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  main().catch((err) => {
    log(`[致命] ${err?.stack || err}`);
    process.exit(1);
  });
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
