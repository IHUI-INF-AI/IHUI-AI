// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 认领件的端侧 adapter(判据一律 import `@ihui/shared/local-registry`,本层零复算)。
 *
 * 为什么住在 CLI:落盘与探活都是宿主能力;shared 层按纯度门不碰 `node:`。
 * 落点走 `getIhuiRoot()` 的具名出口(不自己拼 home 路径 —— 换机/junction 改道时会指错地方)。
 *
 * 两件事刻意分开,因为所需输入不同(混用就会出现"为了删而假装探过"):
 *  · **清理**只需要 心跳时刻 + pid 判活 ⇒ `pruneStaleClaims`;判不了的保留,不删。
 *  · **发现**还要求实端自述代次 ⇒ `discoverLiveClaims` 必须吃调用方给的 `probeEndpoint`;
 *    没给就整体判 `unusable-unjudged`,**绝不用"TCP 能连"冒充"代次相符"**
 *    (把探测结果回填成记录里的 generation 是自证假绿,本仓明令禁止的那种)。
 */
import { existsSync, readdirSync, readFileSync, rmSync, mkdirSync } from 'node:fs';
import { request } from 'node:http';
import { connect } from 'node:net';
import { join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import {
  classifyClaimFreshness,
  isClaimFileName,
  parseServiceClaim,
  selectLiveEndpoints,
  type ClaimCheckOptions,
  type ServiceClaim,
} from '@ihui/shared/local-registry';
import { getIhuiRoot } from '../plugins/paths.js';
import { captureWriteBaseline, commitAtomicWrite } from '../util/atomic-write.js';

const CLAIM_SUBDIR = join('clients', 'agent-server');
/** 心跳节拍必须显著小于判陈线 30s,否则一轮调度抖动就被读成"实例消亡" */
const HEARTBEAT_MS = 10_000;

export function claimDir(root: string = getIhuiRoot()): string {
  return join(root, CLAIM_SUBDIR);
}

export function claimFileFor(id: string, root: string = getIhuiRoot()): string {
  return join(claimDir(root), `${id}.json`);
}

/**
 * 代次标识 = 端口 + 进程启动时刻 + pid 的稳定摘要。
 * 刻意不是密钥:目的不是认证,而是让"伪造一条认领件把扩展指向自己的口"必须同时猜中这三元,
 * 且真端自述与实际口不一致时会被判不符(见 shared 层 evaluateServiceClaim)。
 */
export function generationOf(port: number, startedAt: number, pid: number): string {
  return createHash('sha256').update(`${port}|${startedAt}|${pid}`).digest('hex').slice(0, 16);
}

/** 原子发布(全仓唯一原子写出口,不在这里再抄一份 tmp+rename) */
export function publishClaim(claim: ServiceClaim, root: string = getIhuiRoot()): string {
  const dir = claimDir(root);
  mkdirSync(dir, { recursive: true });
  const file = claimFileFor(claim.id, root);
  commitAtomicWrite(captureWriteBaseline(file), JSON.stringify(claim, null, 2));
  return file;
}

export function retireClaim(id: string, root: string = getIhuiRoot()): void {
  try {
    rmSync(claimFileFor(id, root), { force: true });
  } catch {
    // 删不掉 ⇒ 交给清理轮按心跳陈旧收走;此处不谎报"已清"
  }
}

export interface StartClaimOptions {
  readonly port: number;
  readonly productVersion?: string;
  readonly root?: string;
  readonly heartbeatMs?: number;
}

export interface RunningClaim {
  readonly id: string;
  readonly generation: string;
  readonly file: string;
  beat: () => void;
  stop: () => void;
}

/** 起一个实例的认领件 + 心跳;`stop()` 必须挂到服务关闭路径上,否则心跳会把文件留在盘上被读成"还在跑" */
export function startClaim(opts: StartClaimOptions): RunningClaim {
  const id = randomUUID();
  const startedAt = Date.now();
  const generation = generationOf(opts.port, startedAt, process.pid);
  const beat = (): void => {
    publishClaim(
      {
        id,
        port: opts.port,
        pid: process.pid,
        timestamp: Date.now(),
        generation,
        ...(opts.productVersion ? { productVersion: opts.productVersion } : {}),
      },
      opts.root,
    );
  };
  const file = claimFileFor(id, opts.root);
  beat();
  const timer = setInterval(beat, opts.heartbeatMs ?? HEARTBEAT_MS);
  // 心跳定时器不得单独把进程钉住(服务已关而进程不退 = 比没有认领件更坏的形态)
  timer.unref?.();
  return {
    id,
    generation,
    file,
    beat,
    stop: () => {
      clearInterval(timer);
      retireClaim(id, opts.root);
    },
  };
}

/** pid 判活:EPERM = 存活但无权(与对侧同一语义),其余抛错按消亡 */
export function isPidAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return (err as NodeJS.ErrnoException).code === 'EPERM';
  }
}

/** TCP 可连性(同步等待版)——只回答"这瞬间有没有人应答",不代表身份 */
export function tcpProbe(port: number, timeoutMs = 250): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = connect({ host: '127.0.0.1', port });
    const done = (ok: boolean): void => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
  });
}

function readClaims(root: string): { claims: ServiceClaim[]; broken: Array<{ id: string | null; reason: string }> } {
  const dir = claimDir(root);
  const claims: ServiceClaim[] = [];
  const broken: Array<{ id: string | null; reason: string }> = [];
  if (!existsSync(dir)) return { claims, broken };
  // 只认 `<id>.json` 形态:同目录里别人的落物一律不碰
  for (const name of readdirSync(dir).filter(isClaimFileName)) {
    const file = join(dir, name);
    let raw: unknown;
    try {
      raw = JSON.parse(readFileSync(file, 'utf-8'));
    } catch (err) {
      broken.push({ id: name, reason: `读取或解析失败:${err instanceof Error ? err.message : String(err)}` });
      continue;
    }
    const parsed = parseServiceClaim(raw, name.slice(0, -'.json'.length));
    if ('error' in parsed) {
      broken.push({ id: name, reason: parsed.error });
      continue;
    }
    claims.push(parsed.claim);
  }
  return { claims, broken };
}

export interface PruneResult {
  readonly removed: ReadonlyArray<{ id: string; reason: string }>;
  readonly kept: ReadonlyArray<{ id: string; reason: string }>;
  readonly scanned: number;
  readonly state: 'ok' | 'unjudged';
}

/**
 * 清理轮:删"心跳陈旧 **且** 进程已消亡"的件;任一维判不了就保留(宁留不误删活实例)。
 * 双条件是本层与对侧的实质差别 —— 对侧只看时刻,时钟回拨或实例刚启动就会被误删。
 */
export function pruneStaleClaims(
  root: string = getIhuiRoot(),
  opts: { now?: number; staleAfterMs?: number } = {},
): PruneResult {
  const { claims, broken } = readClaims(root);
  if (claims.length === 0 && broken.length === 0) {
    return { removed: [], kept: [], scanned: 0, state: 'unjudged' };
  }
  const removed: Array<{ id: string; reason: string }> = [];
  const kept: Array<{ id: string; reason: string }> = [];
  for (const claim of claims) {
    const fresh = classifyClaimFreshness(claim, opts);
    if (fresh.state !== 'stale') {
      kept.push({ id: claim.id, reason: fresh.state === 'fresh' ? '心跳新鲜' : `未判定:${fresh.reason ?? ''}` });
      continue;
    }
    if (isPidAlive(claim.pid)) {
      kept.push({ id: claim.id, reason: '心跳陈旧但进程仍活(可能正在长任务),保留待下轮' });
      continue;
    }
    try {
      rmSync(claimFileFor(claim.id, root), { force: true });
      removed.push({ id: claim.id, reason: `${fresh.reason ?? ''} 且进程已消亡` });
    } catch (err) {
      kept.push({ id: claim.id, reason: `删除失败:${err instanceof Error ? err.message : String(err)}` });
    }
  }
  for (const b of broken) {
    // 形状坏的件**不删**:坏记录也可能是别人正在写的半件,删它等于毁他人现场
    kept.push({ id: b.id ?? '(unparsed)', reason: `记录形状不合判据,保留不删:${b.reason}` });
  }
  return { removed, kept, scanned: claims.length + broken.length, state: 'ok' };
}

export interface DiscoverResult {
  readonly usable: ReadonlyArray<{ id: string; port: number; url: string }>;
  readonly rejected: ReadonlyArray<{ id: string | null; reason: string }>;
  readonly state: 'ok' | 'unjudged';
  readonly scanned: number;
}

/** GET /health 取实端自述代次(拿不到 ⇒ null;这一层不猜) */
async function httpProbe(port: number, timeoutMs = 300): Promise<{ generation?: string } | null> {
  return new Promise((resolve) => {
    const req = request(
      { host: '127.0.0.1', port, path: '/health', method: 'GET', timeout: timeoutMs },
      (res) => {
        let body = '';
        res.setEncoding('utf-8');
        res.on('data', (chunk: string) => {
          body += chunk;
          // 半件就够判"有没有自述代次",不必等完整响应体
          if (body.length > 8_192) req.destroy();
        });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(body) as { data?: { generation?: unknown } };
            const g = parsed?.data?.generation;
            resolve(typeof g === 'string' ? { generation: g } : {});
          } catch {
            resolve(null);
          }
        });
      },
    );
    req.on('timeout', () => {
      req.destroy();
      resolve(null);
    });
    req.on('error', () => resolve(null));
    req.end();
  });
}

/**
 * 发现:先对每个候选口做**真实** HTTP 探测(/health 自述代次),再交给判据裁决。
 * 探测结果绝不回填成记录里的代次 —— 那是自证假绿;两侧不一致就判"代次不符"并拒。
 * 没给 `probeEndpoint` 也不假装探过 ⇒ 整体 `unjudged` 并点名缺哪一步。
 */
export async function discoverLiveClaims(
  root: string = getIhuiRoot(),
  opts: ClaimCheckOptions = {},
): Promise<DiscoverResult> {
  const { claims, broken } = readClaims(root);
  const scanned = claims.length + broken.length;
  if (typeof opts.probeEndpoint !== 'function') {
    return {
      usable: [],
      rejected: [
        ...claims.map((c) => ({ id: c.id, reason: '未判定:调用方没给端点探测(probeEndpoint),代次无从核验' })),
        ...broken.map((b) => ({ id: b.id, reason: b.reason })),
      ],
      state: 'unjudged',
      scanned,
    };
  }
  const probe = opts.probeEndpoint;
  const probed = new Map<number, { generation?: string } | null>();
  for (const claim of claims) {
    if (probed.has(claim.port)) continue;
    probed.set(claim.port, await probe(claim.port));
  }
  const picked = selectLiveEndpoints(claims, {
    isPidAlive,
    ...opts,
    probeEndpoint: (port) => probed.get(port) ?? null,
  });
  return {
    ...picked,
    rejected: [...picked.rejected, ...broken.map((b) => ({ id: b.id, reason: b.reason }))],
    scanned,
  };
}

/** 默认探测器:真实 HTTP GET /health(调用方可整体换成自己的注入,如测试里的假端) */
export const defaultProbeEndpoint = (port: number): Promise<{ generation?: string } | null> => httpProbe(port);
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
