// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 预热复用读数(不起常驻进程,不加依赖)—— 对标 WorkBuddy `cbc-prewarm` 控制面
 * (REA 取证 W1-workbuddy-main.md 缺口 ⑪)。对方起常驻进程 + 带外管道;本仓这一格
 * 只做**可断言的读数**:状态件由未来的预热入口(或测试)写入,启动侧读一次并三态判定。
 *
 * 三态口径(§0.3,与 profile.ts 同族):
 *   - `hit`      :状态件完好 ∧ schema 相符 ∧ 指纹相符 ∧ 记录 pid 现读仍存活 ∧ 时刻不倒挂;
 *   - `miss`     :取到了完好记录但**复用条件不成立**(进程被换 / 指纹不符)——必点名原因;
 *   - `unjudged` :取不到输入(文件缺失/坏 JSON/schema 不符/字段残缺/时钟倒挂)——
 *                 不冒 hit 也不冒 miss,"没量到预热"不等于"预热没命中"。
 *
 * 落点走仓内既有 CLI 数据目录出口 `getIhuiRoot()`(认 IHUI_HOME,测试重定向用),
 * 不自己拼 home 路径(票面约束)。写盘为覆盖式小文件(单写者状态件,非台账),
 * 读侧永不抛异常:一切异常都归化成上面的三态之一。
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { getIhuiRoot } from '../plugins/paths.js';
import { formatMs } from './profile.js';

/** 状态件 schema 版本:读侧对不上版本 ⇒ unjudged(旧/异形态账面不得拿来判本轮)。 */
export const PREWARM_SCHEMA_VERSION = 'ihui-cli-prewarm-status.v1';

/** 状态件文件名(单一具名落点,禁止第二份拼路径)。 */
export const PREWARM_STATUS_FILE_NAME = 'prewarm-status.json';

/** `~/.ihui/startup/prewarm-status.json` —— 根由 getIhuiRoot() 现算。 */
export function getPrewarmStatusPath(): string {
  return path.join(getIhuiRoot(), 'startup', PREWARM_STATUS_FILE_NAME);
}

/** 状态件账面形态:schema + 预热时刻(毫秒 epoch)+ 指纹 + 写手 pid。 */
export interface PrewarmRecord {
  schema: string;
  prewarmAtMs: number;
  fingerprint: string;
  pid: number;
}

export type PrewarmReading =
  | { status: 'hit'; ageMs: number; pid: number }
  | { status: 'miss'; reason: 'process-replaced' | 'fingerprint-mismatch'; detail: string }
  | { status: 'unjudged'; reason: string };

/** 读侧注入点:全部可测(时钟、判活谓词都不由本层私藏实现)。 */
export interface PrewarmReadDeps {
  currentFingerprint: string;
  nowMs: number;
  /** pid 存活性判定:生产传 defaultIsPidAlive;测试注入常数。 */
  isPidAlive: (pid: number) => boolean;
}

/**
 * 运行时身份指纹:平台:架构:Node 版本:CLI 版本。
 * 任何一段变了(换机 / 升 Node / 升 CLI),旧预热产物即不再等价 ⇒ 读侧判 miss。
 * 纯字符串拼接,不采集任何进程外信息。
 */
export function buildProcessFingerprint(parts: {
  platform: string;
  arch: string;
  nodeVersion: string;
  cliVersion: string;
}): string {
  return `${parts.platform}:${parts.arch}:${parts.nodeVersion}:${parts.cliVersion}`;
}

/**
 * 默认判活:process.kill(pid, 0) 不发信号只查存在性。
 * EPERM ⇒ 进程在但无权限 ⇒ 视为存活(存在性成立);其余异常 ⇒ 不存活。
 */
export function defaultIsPidAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return (err as NodeJS.ErrnoException).code === 'EPERM';
  }
}

/**
 * 写手侧出口(未来的预热入口/测试用;本票消费者只读)。
 * mkdir 递归 + 覆盖写;失败返回 {ok:false,error} 点名,**不抛** ——
 * 预热写账失败的正确失效方向是"下轮读数落 unjudged 并可见原因",不是砸启动流程。
 */
export function writePrewarmRecord(record: PrewarmRecord): { ok: boolean; error?: string } {
  const file = getPrewarmStatusPath();
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`, 'utf8');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

function parseRecord(raw: string): PrewarmRecord | null {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return null;
  }
  if (json === null || typeof json !== 'object' || Array.isArray(json)) return null;
  const o = json as Record<string, unknown>;
  if (typeof o.schema !== 'string') return null;
  if (typeof o.prewarmAtMs !== 'number' || !Number.isFinite(o.prewarmAtMs)) return null;
  if (typeof o.fingerprint !== 'string' || o.fingerprint.length === 0) return null;
  if (typeof o.pid !== 'number' || !Number.isInteger(o.pid)) return null;
  return { schema: o.schema, prewarmAtMs: o.prewarmAtMs, fingerprint: o.fingerprint, pid: o.pid };
}

/** 判序的唯一实现:写侧/读侧共用同一份账面形态,测试 import 本出口不复制判据(§22c)。 */
export function readPrewarmStatus(deps: PrewarmReadDeps): PrewarmReading {
  const file = getPrewarmStatusPath();
  let raw: string;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    return {
      status: 'unjudged',
      reason: code === 'ENOENT' ? 'record-absent(no prewarm was proven nor disproven)' : `record-unreadable(${code ?? 'unknown'})`,
    };
  }
  const record = parseRecord(raw);
  if (record === null) return { status: 'unjudged', reason: 'record-malformed' };
  if (record.schema !== PREWARM_SCHEMA_VERSION) {
    return { status: 'unjudged', reason: `schema-mismatch(got=${record.schema})` };
  }
  if (record.prewarmAtMs > deps.nowMs) {
    return { status: 'unjudged', reason: 'clock-skew(prewarm-epoch-in-future)' };
  }
  if (record.fingerprint !== deps.currentFingerprint) {
    return {
      status: 'miss',
      reason: 'fingerprint-mismatch',
      detail: `expected=${deps.currentFingerprint} got=${record.fingerprint}`,
    };
  }
  if (!deps.isPidAlive(record.pid)) {
    return { status: 'miss', reason: 'process-replaced', detail: `pid=${record.pid} no longer alive` };
  }
  return { status: 'hit', ageMs: deps.nowMs - record.prewarmAtMs, pid: record.pid };
}

/**
 * 渲染单行读数(ASCII、不折行;unjudged 行不含任何 `<数字>ms` 读数 ——
 * "取不到"不得被账面化成耗时,同 profile.ts 的 0ms 禁令)。
 */
export function renderPrewarmLine(reading: PrewarmReading): string {
  if (reading.status === 'hit') {
    return `[prewarm] status=hit schema=${PREWARM_SCHEMA_VERSION} pid=${reading.pid} age=${formatMs(reading.ageMs)}`;
  }
  if (reading.status === 'miss') {
    return `[prewarm] status=miss reason=${reading.reason} ${reading.detail}`;
  }
  return `[prewarm] status=unjudged reason=${reading.reason} (a missing reading is never reported as hit or miss)`;
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
