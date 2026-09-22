// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// scripts/dev-stack.mjs — 本地开发栈「体检 + 自愈 + 守护」
//
// 目标(2026-09-22 根治):杜绝「网络不通 / 服务没起」导致的 App 白屏、接口超时、OAuth 失败。
// 三个已确认根因,本脚本逐一封堵:
//   根因1: apps/api/.env 缺失 → DATABASE_URL/JWT_SECRET 未定义,API 拒绝启动
//          → canStart('api') 强制预检 .env,缺失时给出明确指引而非盲启动
//   根因2: 脚本派生的子进程随父会话退出被回收(实测 Metro/API 均这样死过)
//          → 统一走 Start-Process 真正脱离父进程 + 日志落盘(.tmp-sync/dev-stack-*.log)
//   根因3: 手机重启后 adb reverse 丢失 → --device 建转发,watch 模式周期性重建
//
// 端口真值(与 apps/api/.env / scripts/dev-port-registry.json 对齐,勿凭印象改):
//   postgres 8810 · redis 8811 · api 8802(/health) · web 8801 · ai-service 8803
//   metro 8081 —— 手机 dev client 的 bundle 地址指向 localhost:8081(RN 默认),
//   仓库 start 脚本虽是 expo --port 8805,但手机实机链路以 8081 为准。
//
// 用法:
//   node scripts/dev-stack.mjs                 体检,缺失的按依赖顺序拉起,必需全就绪才退出 0
//   node scripts/dev-stack.mjs --check         只体检不自愈(未就绪 exit 1),适合开工自检
//   node scripts/dev-stack.mjs --device        起完后把 8081/8802/8801 反向转发到已连接手机
//   node scripts/dev-stack.mjs --watch         前台守护,每 30s 复检,挂了自动重拉(Ctrl+C 退出)
//   node scripts/dev-stack.mjs --only=api,redis
//   node scripts/dev-stack.mjs --json          机器可读输出
//
// npm scripts: pnpm dev:stack / dev:stack:check / dev:stack:device / dev:stack:watch

import { spawn, spawnSync } from 'node:child_process';
import net from 'node:net';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LOG_DIR = path.join(ROOT, '.tmp-sync');
const ADB = path.join(ROOT, '.android-toolchain', 'android-sdk', 'platform-tools', 'adb.exe');
// 直连 node + js 入口启动各服务:绕过 pnpm.cmd shim(实测 shim 在 detached+重定向链路
// 里输出会凭空丢失,日志 0 字节),且少一层 cmd 包装,进程树更干净。
const NODE_EXE = process.execPath;
const TSX_ENTRY = path.join(ROOT, 'apps', 'api', 'node_modules', 'tsx', 'dist', 'cli.mjs');
const EXPO_ENTRY = path.join(ROOT, 'apps', 'mobile-rn', 'node_modules', 'expo', 'bin', 'cli');
const NEXT_ENTRY = path.join(ROOT, 'apps', 'web', 'node_modules', 'next', 'dist', 'bin', 'next');
const REDIS_EXE = 'D:\\ihui-redis-6.2\\Redis-6.2.24-Windows-x64-msys2\\redis-server.exe';
const REDIS_DIR = 'D:\\ihui-redis-6.2\\data';
const PG_SERVICE = 'PostgreSQL16IHUI';
const API_DIR = path.join(ROOT, 'apps', 'api');
const AI_DIR = path.join(ROOT, 'apps', 'ai-service');
const RN_DIR = path.join(ROOT, 'apps', 'mobile-rn');

// 日志落盘:服务启动失败时能直接看到原因,避免「无输出盲等」
function logPaths(name) {
  return { out: path.join(LOG_DIR, `dev-stack-${name}.log`), err: path.join(LOG_DIR, `dev-stack-${name}.err.log`) };
}

function tail(file, lines = 15) {
  try {
    const s = fs.readFileSync(file, 'utf8').trimEnd().split(/\r?\n/);
    return s.slice(-lines).join('\n');
  } catch {
    return '';
  }
}

// Windows 下必须真正脱离父进程:非 detached 的子进程会随本脚本/会话退出被回收
// (实测 Metro/API 均这样死过)。
// 日志方案(2026-09-22 实测定型):detached 链路里 cmd 重定向对外部 exe 的输出
// 继承损坏(输出凭空消失),node→node 的 fd stdio 直传才可靠 → 经
// scripts/dev-stack-launch.mjs 中间层拉起服务并落盘日志。
function launchDetached(exe, argList, cwd, name, envs = {}) {
  const { out, err } = logPaths(name);
  fs.mkdirSync(LOG_DIR, { recursive: true });
  for (const f of [out, err]) {
    try {
      fs.writeFileSync(f, ''); // 每次启动截断,tail 看到的总是本次尝试
    } catch {
      /* 旧日志删不掉不阻塞启动 */
    }
  }
  return spawn(
    process.execPath,
    [path.join(ROOT, 'scripts', 'dev-stack-launch.mjs'), name, LOG_DIR, cwd, exe, ...argList],
    {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
      env: (() => {
        const env = { ...process.env, ...envs };
        // 防泄漏:CI=true 会把 next/expo 等切到 CI 模式(Metro 实测 "reloads are
        // disabled"),dev 服务永远不该以 CI 模式跑
        delete env.CI;
        delete env.CI_ENABLED;
        return env;
      })(),
    },
  );
}

// —— 进程清理与守护自保(2026-09-22 根治「网络断开复发」三层防线之一) ——
// pidAlive:tasklist CSV 判定 PID 是否仍是指定进程名。不按 INFO 文本判断
// (中文系统本地化文案),只认首个引号段是否等于进程名。
function pidAlive(pid, expectName = 'node.exe') {
  const p = Number(pid);
  if (!p || p <= 0) return false;
  try {
    const r = spawnSync('tasklist', ['/FI', `PID eq ${p}`, '/FO', 'CSV', '/NH'], {
      windowsHide: true,
      encoding: 'utf8',
      timeout: 8000,
    });
    const m = (r.stdout || '').match(/^\s*"([^"]+)"/m);
    return !!m && m[1].toLowerCase() === expectName.toLowerCase();
  } catch {
    return false;
  }
}

function killTree(pid) {
  try {
    spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true, timeout: 10000 });
  } catch {
    /* 杀不掉不阻塞重拉(端口已被假死进程让出时无碍) */
  }
}

// 重拉前清掉同名服务的旧进程树:tsx watch/expo/next 父进程在子服务死后仍存活且
// 不占端口(isUp 探不到),不清就无限堆积(实测 API 假死后父进程残留半日)。
// postgres 走 Windows 服务无 pid 文件,天然跳过。
function killStale(svc) {
  const pidFile = path.join(LOG_DIR, `dev-stack-${svc.name}.pid`);
  try {
    const pid = Number(fs.readFileSync(pidFile, 'utf8').trim());
    if (pidAlive(pid, path.basename(process.execPath))) killTree(pid);
    fs.rmSync(pidFile, { force: true });
  } catch {
    /* 无 pid 文件 = 旧启动方式拉起的,无从清理,不影响 */
  }
}

// ensure(首轮)与 tick(重拉)统一经此启动:先清僵尸再拉新
function startSvc(svc) {
  killStale(svc);
  return svc.start();
}

const SERVICES = [
  {
    name: 'postgres',
    port: 8810,
    required: true,
    probe: 'tcp',
    describe: 'PostgreSQL 16(Windows 服务,开机自启)',
    start: () => spawn('sc', ['start', PG_SERVICE], { stdio: 'ignore', windowsHide: true }),
    hint: `Windows 服务 ${PG_SERVICE} 未运行,请确认服务名(services.msc)`,
  },
  {
    name: 'redis',
    port: 8811,
    required: true,
    probe: 'tcp',
    describe: 'Redis 6.2(队列 / 会话,D:\\ihui-redis-6.2)',
    start: () => launchDetached(REDIS_EXE, ['redis-6.2.conf'], REDIS_DIR, 'redis'),
    hint: `Redis 可执行文件不存在:${REDIS_EXE}`,
  },
  {
    name: 'api',
    port: 8802,
    required: true,
    probe: 'http',
    path: '/health',
    describe: 'Fastify API(移动端 / web 主依赖)',
    start: () =>
      launchDetached(NODE_EXE, [TSX_ENTRY, 'watch', 'src/index.ts'], API_DIR, 'api', {
        NODE_ENV: 'development',
      }),
    hint: 'apps/api 启动失败:优先确认 .env 存在(缺失是已发生过的事故),再看 .tmp-sync/dev-stack-api.log',
  },
  {
    name: 'metro',
    port: 8081,
    required: false,
    probe: 'tcp',
    describe: 'Metro RN 打包器(手机 dev client 指向 8081)',
    start: () => launchDetached(NODE_EXE, [EXPO_ENTRY, 'start', '--port', '8081'], RN_DIR, 'metro'),
    hint: 'apps/mobile-rn 不存在或 expo 启动失败,看 .tmp-sync/dev-stack-metro.log',
  },
  {
    name: 'web',
    port: 8801,
    required: false,
    probe: 'http',
    path: '/',
    describe: 'Next.js Web(OAuth 回调宿主,可选)',
    start: () => {
      // pnpm install 会重链 next dist、抹掉 dev 预取补丁(unlock-dev-prefetch.mjs 头注),
      // 故每次启动 web 前幂等重打(毫秒级,失败不阻塞,脚本内部自行告警)
      try {
        spawnSync(NODE_EXE, [path.join(ROOT, 'scripts', 'unlock-dev-prefetch.mjs')], { stdio: 'ignore', windowsHide: true });
      } catch {
        /* 补丁失败不阻塞启动 */
      }
      return launchDetached(NODE_EXE, [NEXT_ENTRY, 'dev', '--turbopack', '-p', '8801'], path.join(ROOT, 'apps', 'web'), 'web', {
        // 本机 node_modules 经 junction 隔离到 D:\nm,turbopack 默认根(仓库根)容不下
        // 解析后的 realpath,需抬到盘根(见 next.config.ts turbopack.root 注释)
        IHUI_TURBOPACK_ROOT: 'D:\\',
      });
    },
    hint: 'apps/web 启动失败(OAuth 网页回调会不可用,不影响 App 主链路),看 .tmp-sync/dev-stack-web.log',
  },
  {
    name: 'ai-service',
    port: 8803,
    required: false,
    probe: 'http',
    path: '/health',
    describe: 'FastAPI AI 服务(可选)',
    start: () =>
      launchDetached(
        path.join(AI_DIR, '.venv', 'Scripts', 'python.exe'),
        ['-m', 'uvicorn', 'app.main:app', '--host', '0.0.0.0', '--port', '8803'],
        AI_DIR,
        'ai-service',
      ),
    hint: 'apps/ai-service 的 .venv 未就绪,AI 能力不可用(不影响登录 / 主链路)',
  },
];

const args = process.argv.slice(2);
const a = new Set(args);
const getVal = (n, def) => {
  const hit = args.find((x) => x.startsWith(`--${n}=`));
  return hit ? hit.slice(n.length + 3) : def;
};
const wantDevice = a.has('--device') || a.has('--with-device');
const checkOnly = a.has('--check');
const watchMode = a.has('--watch');
const asJson = a.has('--json');
const onlyArg = getVal('only', null);
const onlyList = onlyArg ? onlyArg.split(',').map((s) => s.trim()) : null;
const intervalMs = Number(getVal('interval', '30')) * 1000;
const readyTimeoutMs = Number(getVal('timeout', '120')) * 1000;

const targets = onlyList ? SERVICES.filter((s) => onlyList.includes(s.name)) : SERVICES;

// 双栈探活:Windows 上 dev server 常只绑 IPv6([::1])或只绑 IPv4,必须两个都试。
// 返回实际可达的 host,供 http 探针复用,避免 TCP 通了 HTTP 却探错栈。
function tcpOpen(port, timeout = 1200) {
  const tryHost = (host) =>
    new Promise((resolve) => {
      const sock = net.connect({ port, host });
      const done = (ok) => {
        sock.destroy();
        resolve(ok ? host : null);
      };
      sock.setTimeout(timeout);
      sock.once('connect', () => done(true));
      sock.once('timeout', () => done(false));
      sock.once('error', () => done(false));
    });
  return (async () => (await tryHost('127.0.0.1')) || (await tryHost('::1')))();
}

function httpOk(host, port, urlPath = '/health', timeout = 2500) {
  return new Promise((resolve) => {
    const req = http.get({ host, port, path: urlPath, timeout }, (res) => {
      res.resume();
      resolve(res.statusCode < 500);
    });
    req.once('timeout', () => {
      req.destroy();
      resolve(false);
    });
    req.once('error', () => resolve(false));
  });
}

async function isUp(svc) {
  const host = await tcpOpen(svc.port);
  if (!host) return false;
  if (svc.probe === 'http') return httpOk(host, svc.port, svc.path || '/health');
  return true;
}

async function waitReady(svc, timeoutMs = readyTimeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isUp(svc)) return true;
    await new Promise((r) => setTimeout(r, 1500));
  }
  return isUp(svc);
}

function canStart(svc) {
  if (svc.name === 'postgres') return true; // 走 Windows 服务,缺失由 sc 报错
  if (svc.name === 'redis') return fs.existsSync(REDIS_EXE);
  if (svc.name === 'api') {
    // 根因封堵:.env 缺失或 tsx 入口缺失时 API 必然起不来,不盲启动,直接给出指引
    return fs.existsSync(path.join(API_DIR, '.env')) && fs.existsSync(TSX_ENTRY);
  }
  if (svc.name === 'ai-service') return fs.existsSync(path.join(AI_DIR, '.venv'));
  return fs.existsSync(path.join(ROOT, 'apps', svc.name === 'metro' ? 'mobile-rn' : svc.name));
}

// 手机 dev client 的 bundle/API 地址全走 localhost,依赖 adb reverse;
// 设备重启后转发丢失是已发生过的事故,所以 8081(Metro)/8802(API)/8801(web OAuth)三个都要。
async function adbReverse() {
  if (!fs.existsSync(ADB)) return { ok: false, msg: `未找到 adb:${ADB}` };
  const dev = await runCapture([ADB, 'devices']);
  const lines = dev.split(/\r?\n/).filter((l) => l.trim() && !l.startsWith('List of devices'));
  const online = lines.filter((l) => /\bdevice\b/.test(l) && !/\brecovery\b|\bunauthorized\b|\boffline\b/.test(l));
  if (!online.length) {
    return { ok: false, msg: '无已授权设备(服务已就绪;手机 USB 连上后重跑 --device 即可转发)' };
  }
  const out = [];
  for (const port of [8081, 8802, 8801]) {
    await runCapture([ADB, 'reverse', `tcp:${port}`, `tcp:${port}`]);
    out.push(`${port}→设备`);
  }
  return { ok: true, msg: `${online[0].split('\t')[0]} | ${out.join(', ')}` };
}

function runCapture(cmdArr) {
  // 仅用于 adb 这类探测短命令;数组传参、不走 shell,无注入面
  const [cmd, ...rest] = cmdArr;
  return new Promise((resolve) => {
    let out = '';
    let settled = false;
    const finish = () => {
      if (!settled) {
        settled = true;
        resolve(out);
      }
    };
    const child = spawn(cmd, rest, { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    child.stdout.on('data', (d) => (out += d.toString()));
    child.stderr.on('data', (d) => (out += d.toString()));
    child.once('close', finish);
    child.once('error', finish);
    setTimeout(finish, 5000);
  });
}

async function ensure(svc, results) {
  if (await isUp(svc)) {
    results.push({ name: svc.name, port: svc.port, status: 'up', action: 'none' });
    return true;
  }
  if (checkOnly) {
    results.push({ name: svc.name, port: svc.port, status: 'down', action: 'skipped(check)', hint: svc.hint });
    return false;
  }
  if (!canStart(svc)) {
    results.push({ name: svc.name, port: svc.port, status: 'down', action: 'cannot-start', hint: svc.hint });
    return false;
  }
  let child;
  try {
    child = startSvc(svc);
  } catch (e) {
    results.push({
      name: svc.name,
      port: svc.port,
      status: 'down',
      action: 'start-error',
      hint: `${svc.hint} (spawn 异常: ${e instanceof Error ? e.message : String(e)})`,
    });
    return false;
  }
  if (child && typeof child.unref === 'function') child.unref();
  const ok = await waitReady(svc);
  results.push({
    name: svc.name,
    port: svc.port,
    status: ok ? 'up' : 'down',
    action: ok ? 'started' : 'start-timeout',
    hint: ok ? '' : svc.hint + (ok ? '' : `\n      最近日志:\n${tail(logPaths(svc.name).err) || tail(logPaths(svc.name).out) || '(空)'}`),
  });
  return ok;
}

function report(results, device) {
  if (asJson) {
    console.log(JSON.stringify({ results, device }, null, 2));
    return;
  }
  console.log('\n=== IHUI-AI 本地服务栈 ===');
  const pad = (s, n) => String(s).padEnd(n);
  console.log(pad('服务', 12) + pad('端口', 8) + pad('状态', 10) + pad('动作', 16) + '说明');
  for (const r of results) {
    const svc = SERVICES.find((s) => s.name === r.name);
    const required = svc?.required === true;
    const icon = r.status === 'up' ? '✅' : required ? '❌' : '⚠️';
    const note = r.action === 'skipped(check)' ? svc?.describe || '' : r.hint || svc?.describe || '';
    console.log(pad(`${icon} ${r.name}`, 12) + pad(r.port, 8) + pad(r.status, 10) + pad(r.action, 16) + note);
  }
  if (device) console.log(`\n手机转发: ${device.ok ? '✅ ' : '⚠️ '}${device.msg}`);
  console.log('');
}

async function run() {
  const results = [];
  for (const svc of targets) await ensure(svc, results);
  const device = wantDevice ? await adbReverse() : null;
  report(results, device);

  const downRequired = results.filter((r) => r.status !== 'up' && SERVICES.find((s) => s.name === r.name)?.required);
  const downOptional = results.filter((r) => r.status !== 'up' && !SERVICES.find((s) => s.name === r.name)?.required);

  if (downOptional.length) {
    console.log('可选服务未就绪(不阻塞主链路): ' + downOptional.map((d) => d.name).join(', '));
  }
  if (downRequired.length) {
    console.error('必需服务未就绪: ' + downRequired.map((d) => `${d.name}(:${d.port})`).join(', '));
    return 1;
  }
  console.log('全部必需服务就绪 ✅');
  return 0;
}

const code = await run();

if (watchMode) {
  // —— 单实例锁+心跳(2026-09-22 根治三层防线之二) ——
  // 曾实测两个守护实例并发重拉互相打架(日志双份输出、互相截断);守护自身死亡后
  // vbs 只在开机跑一次、无人复活 → 心跳文件兼任「锁」与「watchdog 巡检依据」:
  // 心跳新鲜(<90s)且 pid 存活 = 已有实例在守护,本实例退出(防双开);
  // 否则接管,每 tick 续写心跳。watchdog(scripts/dev-stack-watchdog.mjs)靠同一
  // 文件判死活,心跳停更 → 2 分钟内自动复活本守护。
  const HEARTBEAT_FILE = path.join(LOG_DIR, 'dev-stack-watcher.heartbeat.json');
  const HEARTBEAT_FRESH_MS = 90_000;
  const readHeartbeat = () => {
    try {
      return JSON.parse(fs.readFileSync(HEARTBEAT_FILE, 'utf8'));
    } catch {
      return null;
    }
  };
  const writeHeartbeat = () => {
    try {
      fs.mkdirSync(LOG_DIR, { recursive: true });
      fs.writeFileSync(HEARTBEAT_FILE, JSON.stringify({ pid: process.pid, ts: Date.now() }));
    } catch {
      /* 心跳写失败不阻塞守护 */
    }
  };
  const hb = readHeartbeat();
  if (hb && Date.now() - Number(hb.ts) < HEARTBEAT_FRESH_MS && pidAlive(hb.pid)) {
    console.log(`已有 dev-stack 守护进程(pid ${hb.pid})在运行,本实例退出(防双开)`);
    process.exit(0);
  }
  writeHeartbeat();
  // 无论首轮成败都进入守护:首轮挂了更要盯着重拉,这才是「根治」。
  console.log(`守护中:每 ${intervalMs / 1000}s 复检,挂了自动重拉(Ctrl+C 退出)`);
  let lastDeviceMsg = null;
  // canStart 不过的服务(如 ai-service .venv 缺失)每个 tick 都报会刷爆日志:
  // 首次或状态由"能启动"变回"不能启动"时才报一次
  const cannotStartNotified = new Set();
  // 「桌面零弹窗」全盘审计(2026-09-22 用户铁律"不允许出现任何窗口"):git-guardian 曾漂移成
  // 直跑 node.exe 每 2 分钟闪黑窗;除其自身自检外,本守护每 10 分钟全盘扫一遍计划任务/
  // 启动项/Run 键,交互会话直跑控制台程序的 IHUI 任务自动包成隐藏 VBS(保留触发器)。
  // 异步派生不阻塞体检 tick;--check 不跑审计(CI 无副作用)。
  const SILENT_AUDIT = path.join(ROOT, 'scripts', 'ensure-silent-tasks.mjs');
  const SILENT_AUDIT_EVERY_TICKS = Math.max(1, Math.round(600000 / intervalMs)); // ≈10 分钟
  let silentAuditTicks = 0;
  const runSilentAudit = () => {
    if (!fs.existsSync(SILENT_AUDIT)) return;
    try {
      const c = spawn(process.execPath, [SILENT_AUDIT], { stdio: 'ignore', windowsHide: true });
      c.unref();
    } catch {
      /* 审计失败不阻塞守护 */
    }
  };
  const tick = async () => {
    writeHeartbeat();
    silentAuditTicks++;
    if (silentAuditTicks % SILENT_AUDIT_EVERY_TICKS === 1) runSilentAudit();
    for (const svc of targets) {
      if (!(await isUp(svc))) {
        try {
          if (!canStart(svc)) {
            if (!cannotStartNotified.has(svc.name)) {
              cannotStartNotified.add(svc.name);
              console.error(`[${new Date().toLocaleTimeString()}] 无法拉起 ${svc.name}:${svc.hint}`);
            }
            continue;
          }
          cannotStartNotified.delete(svc.name);
          console.log(`[${new Date().toLocaleTimeString()}] ${svc.name}(:${svc.port}) 掉线,重拉中...`);
          const child = startSvc(svc);
          if (child && typeof child.unref === 'function') child.unref();
          const ok = await waitReady(svc, 45000);
          console.log(`  ${svc.name} 重拉${ok ? '成功 ✅' : '失败 ❌(日志见 .tmp-sync)'}`);
        } catch (e) {
          console.error(`  重拉失败: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    }
    if (wantDevice) {
      // 手机重插 / 重启后 reverse 丢失,周期性重建;状态不变时不刷屏
      const d = await adbReverse();
      if (d.msg !== lastDeviceMsg) {
        console.log(`手机转发: ${d.ok ? '✅' : '⚠️'} ${d.msg}`);
        lastDeviceMsg = d.msg;
      }
    }
  };
  await tick();
  setInterval(tick, intervalMs);
} else {
  process.exit(code);
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
