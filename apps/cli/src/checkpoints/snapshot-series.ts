// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 会话快照的可寻址版本序列 `<uuid>@vN` —— 纯判据层,零 fs、零时钟、零随机。
 *
 * 立因(goal-b49 S3,对照取证 `docs/benchmark-evidence/2026-11/qoder-trae-workbuddy-rea-20261105/Q1-qoder-cn-main-bundle.md` §4 #16):
 * 对方 `file-history/<sid>/<uuid>@vN` 现读 244 目录 65 版且**无任何清理**,版本号只是"写盘顺序的副产品",
 * 既不可寻址(要列目录才知道下一版是几)、也无到期概念。我方落地把它做成**一等公民契约**:
 *   - 序列号由会话种子推导(`seriesUuidFromSeedHex`)⇒ 不列盘也能算出该会话的序列身份;
 *   - 下一版由分配器给(`allocateNextSnapshotSeriesRef`)⇒ 重号在命名层就被排除;
 *   - 序列单调性可独立审计(`auditSnapshotSeriesOrdering`)⇒ 回退/重号/畸形名各自有拒绝原因码;
 *   - 畸形名永不被"猜"出一个版本号:一律带原因码退回,由调用方决定不删/不停摆(AGENTS §0.3)。
 *
 * 消费方(门 121「声明必须有消费者」):`./snapshot-gc.ts` 取解析与同序判据;
 * `./index.ts` 的 `CheckpointManager` 取命名分配与序列身份推导。
 */

export const SNAPSHOT_SERIES_SEPARATOR = '@v'
export const SNAPSHOT_SERIES_MIN_VERSION = 1
export const SNAPSHOT_SERIES_MAX_VERSION = 999_999_999
/** 序列种子摘要的十六进制长度(= uuid 去掉连字符后的 32 位) */
export const SNAPSHOT_SERIES_SEED_HEX_LENGTH = 32

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
/** 拒绝 `v0`、拒绝前导零(`v007`)、拒绝小数/符号/空格 */
const VERSION_RE = /^[1-9][0-9]{0,8}$/
const SEED_HEX_RE = /^[0-9a-f]{32}$/i

export interface SnapshotSeriesRef {
  /** 序列身份:规范化小写的 8-4-4-4-12 十六进制 */
  uuid: string;
  /** 版本号:从 1 起,严格递增,无前导零 */
  version: number;
}

export type SnapshotSeriesFailureReason =
  | 'empty-name'
  | 'unsafe-path-segment'
  | 'missing-separator'
  | 'multiple-separators'
  | 'malformed-uuid'
  | 'malformed-version'
  | 'malformed-seed-hex'
  | 'version-exhausted';

export type SnapshotSeriesParseResult =
  | { ok: true; name: string; ref: SnapshotSeriesRef }
  | { ok: false; name: string; reason: SnapshotSeriesFailureReason; detail: string };

export type SnapshotSeriesAllocation =
  | { ok: true; ref: SnapshotSeriesRef; observedVersions: number }
  | { ok: false; reason: SnapshotSeriesFailureReason; detail: string };

export type SnapshotSeriesUuidResult =
  | { ok: true; uuid: string }
  | { ok: false; reason: 'malformed-seed-hex'; detail: string };

export interface SnapshotSeriesViolation {
  name: string;
  reason: 'malformed-name' | 'duplicate-version' | 'version-regression';
  detail: string;
}

export interface SnapshotSeriesAudit {
  ok: boolean;
  /** 按入参顺序、且逐条通过解析的引用(畸形名不进此表,只进 violations) */
  refs: SnapshotSeriesRef[];
  violations: SnapshotSeriesViolation[];
}

function fail(name: string, reason: SnapshotSeriesFailureReason, detail: string) {
  return { ok: false as const, name, reason, detail };
}

/** 目录名必须是单段、可安全参与 path.join 的字面量:分隔符、点段、空字节都拒绝。 */
function isUnsafeSegment(name: string): boolean {
  return (
    name.includes('/') ||
    name.includes('\\') ||
    name.includes('\0') ||
    name === '.' ||
    name === '..' ||
    name !== name.trim()
  );
}

export function isSnapshotSeriesDirName(name: string): boolean {
  return parseSnapshotSeriesDirName(name).ok;
}

/** 解析 `<uuid>@vN`;任何一档不合格都带原因码退回,不做任何"最接近的猜测"。 */
export function parseSnapshotSeriesDirName(name: string): SnapshotSeriesParseResult {
  if (name.length === 0) return fail(name, 'empty-name', '目录名为空');
  if (isUnsafeSegment(name)) {
    return fail(name, 'unsafe-path-segment', '目录名必须是单个安全路径段(无分隔符/点段/空白首尾)');
  }
  const first = name.indexOf(SNAPSHOT_SERIES_SEPARATOR);
  if (first === -1) {
    return fail(name, 'missing-separator', `目录名缺少版本标记 ${SNAPSHOT_SERIES_SEPARATOR}`);
  }
  if (name.indexOf(SNAPSHOT_SERIES_SEPARATOR, first + SNAPSHOT_SERIES_SEPARATOR.length) !== -1) {
    return fail(name, 'multiple-separators', '目录名出现多枚版本标记,无法定位版本号');
  }
  const uuidPart = name.slice(0, first);
  if (!UUID_RE.test(uuidPart)) {
    return fail(name, 'malformed-uuid', `序列身份不是规范 8-4-4-4-12 十六进制: ${uuidPart}`);
  }
  const versionPart = name.slice(first + SNAPSHOT_SERIES_SEPARATOR.length);
  if (!VERSION_RE.test(versionPart)) {
    return fail(name, 'malformed-version', `版本号必须是 1..${SNAPSHOT_SERIES_MAX_VERSION} 的无前导零整数`);
  }
  return { ok: true, name, ref: { uuid: uuidPart.toLowerCase(), version: Number(versionPart) } };
}

/** 构造目录名;入参不合格直接抛错(构造不接受"半档"输入,避免把畸形写进盘)。 */
export function formatSnapshotSeriesDirName(ref: SnapshotSeriesRef): string {
  if (!UUID_RE.test(ref.uuid)) {
    throw new RangeError(`snapshot-series: 非法序列身份 ${ref.uuid}(须规范 8-4-4-4-12 十六进制)`);
  }
  if (!Number.isInteger(ref.version) || ref.version < SNAPSHOT_SERIES_MIN_VERSION) {
    throw new RangeError(`snapshot-series: 非法版本号 ${String(ref.version)}(须为 ≥1 的整数)`);
  }
  if (ref.version > SNAPSHOT_SERIES_MAX_VERSION) {
    throw new RangeError(`snapshot-series: 版本号超出上界 ${SNAPSHOT_SERIES_MAX_VERSION}`);
  }
  return `${ref.uuid.toLowerCase()}${SNAPSHOT_SERIES_SEPARATOR}${ref.version}`;
}

/**
 * 由种子摘要(32 位十六进制)推导序列身份:同一会话/同一文件键在任何进程、任何时刻
 * 都算出同一个 uuid ⇒ 版本序列可寻址,不依赖"先列盘"。
 */
export function seriesUuidFromSeedHex(hex: string): SnapshotSeriesUuidResult {
  const normalized = hex.toLowerCase();
  if (!SEED_HEX_RE.test(normalized)) {
    return {
      ok: false,
      reason: 'malformed-seed-hex',
      detail: `种子摘要须为 ${SNAPSHOT_SERIES_SEED_HEX_LENGTH} 位十六进制,实得 ${hex.length} 位`,
    };
  }
  const uuid = `${normalized.slice(0, 8)}-${normalized.slice(8, 12)}-${normalized.slice(
    12,
    16,
  )}-${normalized.slice(16, 20)}-${normalized.slice(20, 32)}`;
  return { ok: true, uuid };
}

/**
 * 分配下一版:取该 uuid 现有名的最大版本 + 1(无历史则从 1 起)。
 * 解析不过的名字属于**别的命名空间**(如历史 `cp_*`、`hunk_*`),不参与本序列取最大,
 * 也永不可能与 `<uuid>@vN` 形态的目标名撞车 —— 故分配不会因外来名而误判重号。
 */
export function allocateNextSnapshotSeriesRef(
  existingNames: string[],
  uuid: string,
): SnapshotSeriesAllocation {
  const normalized = uuid.toLowerCase();
  if (!UUID_RE.test(normalized)) {
    return { ok: false, reason: 'malformed-uuid', detail: `序列身份不合法: ${uuid}` };
  }
  let max = 0;
  let observed = 0;
  for (const name of existingNames) {
    const parsed = parseSnapshotSeriesDirName(name);
    if (!parsed.ok || parsed.ref.uuid !== normalized) continue;
    observed += 1;
    if (parsed.ref.version > max) max = parsed.ref.version;
  }
  const next = max + 1;
  if (next > SNAPSHOT_SERIES_MAX_VERSION) {
    return {
      ok: false,
      reason: 'version-exhausted',
      detail: `序列 ${normalized} 已到版本上界 ${SNAPSHOT_SERIES_MAX_VERSION},不再分配`,
    };
  }
  return { ok: true, ref: { uuid: normalized, version: next }, observedVersions: observed };
}

/**
 * 单调性审计:按入参给定顺序逐条走查(顺序即"写盘/枚举顺序")。
 * 三档拒绝各有原因码:畸形名 / 同序列重号 / 同序列回退。跨 uuid 互不影响。
 */
export function auditSnapshotSeriesOrdering(orderedNames: string[]): SnapshotSeriesAudit {
  const refs: SnapshotSeriesRef[] = [];
  const violations: SnapshotSeriesViolation[] = [];
  const lastByVersion = new Map<string, number>();
  for (const name of orderedNames) {
    const parsed = parseSnapshotSeriesDirName(name);
    if (!parsed.ok) {
      violations.push({ name, reason: 'malformed-name', detail: parsed.detail });
      continue;
    }
    const last = lastByVersion.get(parsed.ref.uuid);
    if (last !== undefined) {
      if (parsed.ref.version === last) {
        violations.push({
          name,
          reason: 'duplicate-version',
          detail: `序列 ${parsed.ref.uuid} 的 v${last} 在给定顺序里出现第二次`,
        });
        continue;
      }
      if (parsed.ref.version < last) {
        violations.push({
          name,
          reason: 'version-regression',
          detail: `序列 ${parsed.ref.uuid} 由 v${last} 回退到 v${parsed.ref.version}`,
        });
        continue;
      }
    }
    lastByVersion.set(parsed.ref.uuid, parsed.ref.version);
    refs.push(parsed.ref);
  }
  return { ok: violations.length === 0, refs, violations };
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
