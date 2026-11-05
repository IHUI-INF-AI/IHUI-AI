// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 本地出口 relay 的**宿主腿**(goal-b49 Z3 腿①的承载/调度/死亡三环,服务器本体在 `./proxy-relay.ts`)。
 *
 * 承载体 = 由 CLI 会话进程懒派生的**脱离式本机 relay 子进程**(不新起常驻 daemon、不挂 nssm/计划任务);
 * 谁调度 = `env-inject.ts` 在 `IHUI_EGRESS_PROXY_URL=auto`(机主显式点名)时调
 * `ensureManagedEgressRelay`,进程内 memo 至多一枚;
 * 怎么死 = ① 载荷里登记的父(CLI)pid 死 ⇒ 自退(`observeProcessAlive` import 单源,零复制)
 * ② 空闲超上限 ⇒ 自退 ③ 最长寿命 ⇒ 自退 —— 三条都有,不给"造好没装车"的僵尸留格子。
 *
 * 就绪协议:runner 以 `port=0` 起监听(端口由内核挑,不猜不撞),把实际端口写进 gitignored
 * 状态目录的 ready 文件;父侧 `execFileSync` 探针同步等就绪(spawnSync 派生路径会占死事件循环,
 * 异步等待结构上不存在)。探针超时 ⇒ **不点代理腿 + 点名**(不假装执法;§0.3 未判定不冒绿)。
 * §12g:派生 git/node 一律显式 stdio;派生子进程 `windowsHide`。裁决零复算:relay 进程
 * 用 `resolveEgressPolicy(process.env)` 与父进程同一份 env 取值装配、同一把尺。
 */

import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { connect } from 'node:net';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { findProjectRoot } from '../../runs/manifest.js';
import { observeProcessAlive } from '../../util/parent-bound.js';
import { startEgressRelay } from './proxy-relay.js';
import { resolveEgressPolicy } from './policy-source.js';

const RUNNER_FLAG = '--ihui-egress-relay-runner';
const PROBE_FLAG = '--ihui-egress-relay-probe';
const TICK_MS = 1_000;
const IDLE_MS = 15 * 60_000;
const MAX_LIFE_MS = 6 * 60 * 60_000;
const PROBE_TIMEOUT_MS = 8_000;

interface RunnerPayload {
  readonly v: 1;
  readonly parentPid: number;
  readonly readyFile: string;
  readonly startDir: string;
  readonly idleMs: number;
  readonly maxLifetimeMs: number;
}

function parseRunnerPayload(raw: string): RunnerPayload | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const p = parsed as Record<string, unknown>;
  const numOk = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
  const strOk = (v: unknown): v is string => typeof v === 'string' && v !== '';
  if (p.v !== 1 || !numOk(p.parentPid) || !numOk(p.idleMs) || !numOk(p.maxLifetimeMs)) return null;
  if (!strOk(p.readyFile) || !strOk(p.startDir)) return null;
  return p as unknown as RunnerPayload;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** runner 主循环(独立进程):起 relay → 写 ready → 三条死亡判据轮询 → 关监听退场。 */
async function runRelayRunner(rawPayload: string): Promise<void> {
  const p = parseRunnerPayload(rawPayload);
  if (p === null) return; // 载荷坏:不起服务也不写 ready(父侧探针超时即不点腿)
  const policy = resolveEgressPolicy(process.env).policy;
  const relay = await startEgressRelay({ policy, startDir: p.startDir });
  mkdirSync(dirname(p.readyFile), { recursive: true });
  writeFileSync(p.readyFile, JSON.stringify({ v: 1, port: relay.port, pid: process.pid }), 'utf8');
  const startedAt = Date.now();
  for (;;) {
    await sleep(TICK_MS);
    const now = Date.now();
    if (observeProcessAlive(p.parentPid) === false) break; // 父死即随(观测 null = 未判定,不动手)
    if (now - startedAt > p.maxLifetimeMs) break; // 最长寿命:死亡机制不被观测缺失卡住
    const act = relay.activity();
    if (act.connections === 0 && now - Math.max(act.lastActivityMs, startedAt) > p.idleMs) break;
  }
  await relay.close();
  try {
    unlinkSync(p.readyFile);
  } catch {
    // ready 文件残影由下一次启动方先清;清不掉不改变本进程退场
  }
}

/** 探针(短命子进程):等同 ready 文件,再对本地端口做 TCP 连接验证;成功 stdout=端口。 */
export async function runRelayProbe(readyFile: string, timeoutMs: number): Promise<number | null> {
  const deadline = Date.now() + Math.max(500, timeoutMs);
  let port = 0;
  while (Date.now() < deadline) {
    try {
      const parsed = JSON.parse(readFileSync(readyFile, 'utf8')) as { v?: unknown; port?: unknown };
      if (parsed.v === 1 && typeof parsed.port === 'number' && parsed.port > 0) {
        port = parsed.port;
        break;
      }
    } catch {
      // ready 未写/半写:继续等
    }
    await sleep(50);
  }
  if (port === 0) return null;
  return (await probeConnect(port, deadline - Date.now())) ? port : null;
}

function probeConnect(port: number, remainingMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const deadline = Date.now() + Math.max(200, remainingMs);
    const attempt = (): void => {
      const sock = connect({ host: '127.0.0.1', port });
      const fail = (): void => {
        sock.destroy();
        if (Date.now() >= deadline) resolve(false);
        else setTimeout(attempt, 100);
      };
      sock.once('connect', () => {
        sock.destroy();
        resolve(true);
      });
      sock.once('error', fail);
    };
    attempt();
  });
}

export interface ManagedRelayResult {
  readonly url: string | null;
  readonly warnings: readonly string[];
}

let memo: ManagedRelayResult | null = null;

/** 进程内至多启动一枚 relay;拿不到就绪 ⇒ url=null + 点名(失效方向是"不点腿",不是"假装点")。 */
export function ensureManagedEgressRelay(
  env: Record<string, string | undefined>,
  cwd: string,
): ManagedRelayResult {
  if (memo !== null) return memo;
  memo = launchManagedEgressRelay(env, cwd);
  return memo;
}

/** 仅供测试重置 memo(接线锁用,生产不调)。 */
export function resetManagedEgressRelayForTests(): void {
  memo = null;
}

function launchManagedEgressRelay(
  _env: Record<string, string | undefined>,
  cwd: string,
): ManagedRelayResult {
  const root = findProjectRoot(cwd);
  if (root === null) {
    return {
      url: null,
      warnings: ['egress relay: no project root above the spawn cwd; proxy leg not wired (undetermined, not a pass)'],
    };
  }
  let modulePath: string;
  try {
    modulePath = fileURLToPath(import.meta.url);
  } catch {
    return { url: null, warnings: ['egress relay: module path not derivable (non file: host); proxy leg not wired'] };
  }
  if (!/\.(?:js|mjs|ts)$/i.test(modulePath)) {
    return { url: null, warnings: ['egress relay: runner entry unavailable on this host form; proxy leg not wired'] };
  }
  const readyFile = join(root, '.ihui-agent', 'state', 'egress-relay.ready.json');
  try {
    unlinkSync(readyFile); // 上一次会话的残影先清,免得探针认假账
  } catch {
    // 不存在即无需清
  }
  const payload: RunnerPayload = {
    v: 1,
    parentPid: process.pid,
    readyFile,
    startDir: cwd,
    idleMs: IDLE_MS,
    maxLifetimeMs: MAX_LIFE_MS,
  };
  try {
    // dev 面入口是 .ts:借 apps/cli 既有 devDependency `tsx` 的 ESM hook(不新增依赖);
    // 生产 .js 面直用 execPath。取不到加载器 ⇒ 探针超时 ⇒ 不点腿 + 点名(与 parent-bound 同型降级)。
    const loader = /\.(?:ts|mts|cts)$/i.test(modulePath) ? ['--import', 'tsx'] : [];
    const runner = spawn(process.execPath, [...loader, modulePath, RUNNER_FLAG, JSON.stringify(payload)], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    });
    runner.on('error', () => undefined);
    runner.unref();
  } catch {
    return { url: null, warnings: ['egress relay: runner spawn failed; proxy leg not wired (this is a named gap, not a pass)'] };
  }
  try {
    const loader = /\.(?:ts|mts|cts)$/i.test(modulePath) ? ['--import', 'tsx'] : [];
    const out = execFileSync(
      process.execPath,
      [...loader, modulePath, PROBE_FLAG, readyFile, String(PROBE_TIMEOUT_MS)],
      { stdio: ['ignore', 'pipe', 'pipe'], timeout: PROBE_TIMEOUT_MS + 3_000, windowsHide: true, encoding: 'utf8' },
    );
    const port = Number(String(out).trim());
    if (!Number.isInteger(port) || port <= 0) throw new Error('bad-ready-port');
    return { url: `http://127.0.0.1:${port}`, warnings: [] };
  } catch {
    return {
      url: null,
      warnings: [`egress relay: local relay did not become ready within ${PROBE_TIMEOUT_MS}ms; proxy leg not wired (this is a named gap, not a pass)`],
    };
  }
}

// §22d isDirectRun:runner/probe 形态仅在被直接执行时进入主流程;被 import 零副作用。
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun && process.argv[2] === RUNNER_FLAG) {
  runRelayRunner(process.argv[3] ?? '').then(
    () => process.exit(0),
    () => process.exit(2),
  )
} else if (isDirectRun && process.argv[2] === PROBE_FLAG) {
  runRelayProbe(process.argv[3] ?? '', Number(process.argv[4]) || PROBE_TIMEOUT_MS).then(
    (port) => {
      if (port === null) process.exit(1);
      process.stdout.write(String(port));
      process.exit(0);
    },
    () => process.exit(2),
  )
}

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
