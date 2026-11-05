// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// i18n-content-exempt-file: 装机判据的三态结论本身就是交付给操作者的拒绝语,拆成英文键会把"为什么判不了"洗掉 until 2027-05-04
/**
 * 内置资源装机策略 —— `ensure-minimum` 语义在本仓的**唯一判据实现**(纯函数,零 fs、零平台 API)。
 *
 * 立的因(goal-b49 取证 Q1 §3 #9 / §4):对照程序 `bundled-resources/manifest.json` 每枚资源形如
 * `{id, version, revision, install:{presence:"ensure-minimum"}, archive:{sha256,maxEntries,maxExpandedBytes}, files:[{path,sha256}]}`
 * —— 已装得更高不降级、缺最低版本才装、revision 单调、逐文件 sha256 各自校验。本仓装机面
 * (`plugins/installer.ts` 的"已装短路")此前只看"记录在不在 + 目录可不可用",三维一概不比
 * ⇒ "源目录就地升级后再装一次"被读成"已装过"。
 *
 * 三条纪律(不得"顺手"改掉):
 *   1. **三态,"没判"绝不写成"判过"**(AGENTS §0.3):清单取不到 / presence 形态不认 /
 *      到期读不出 / 版本形状不可比 / 声明的摘要算不出 ⇒ `unjudged` 并逐条点名,不记绿也不冒红。
 *   2. **纯判据**:输入全部由参数注入(含"当下时刻"),本文件不 import fs/path/child_process —— 读盘与采集归调用方,否则测试里长出第二份判据(§0.6)。
 *   3. **超越轴 = 到期判据**(§4 该行点名的差集):对方清单只有装机策略、无到期形态;我方把 `expires`
 *      纳入 §0.7「验过才免且会到期」——到期即回待裁队列(`unjudged`),不静默放行。
 */

/** 对照程序唯一用到的 presence 档;其余形态一律"不认"(= 判不了,不是"按默认放行") */
export const ENSURE_MINIMUM_PRESENCE = 'ensure-minimum';

/** `installed` = 本次要装;`already-satisfied` = 满足最低要求(不许重复装/降级);`unjudged` = 没判 */
export type InstallPolicyVerdict = 'installed' | 'already-satisfied' | 'unjudged';

/** 清单声明的期望文件(`sha256` 缺席 = 清单没给这一枚的摘要,不计入对照) */
export interface PolicyExpectedFile {
  path: string;
  sha256?: string | null;
}

/** 装机面观测到的摘要(`sha256: null` = 读不动/算不出 —— 与"文件不在"是两格) */
export interface PolicyObservedFile {
  path: string;
  sha256: string | null;
}

/** 清单侧:本次要确保的最低状态 */
export interface DesiredResource {
  id: string;
  presence?: string | null;
  version?: string | null;
  /** 单调递增的清单代数(对照程序的 `revision`) */
  revision?: number | null;
  /** 逐文件期望摘要;`null`/`undefined` = 清单未声明这一维 */
  files?: PolicyExpectedFile[] | null;
  /** ISO 时刻;超越轴(到期即回待裁队列) */
  expires?: string | null;
}

/** 现状侧:盘上/台账里已有的那一代 */
export interface InstalledState {
  version?: string | null;
  revision?: number | null;
  /** `null`/`undefined` = 摘要面整块拿不到(老记录/采集失败),**不等于**"没有文件" */
  files?: PolicyObservedFile[] | null;
}

export interface InstallPolicyInput {
  resource?: DesiredResource | null;
  installed?: InstalledState | null;
  /** 判到期用的当下时刻(ISO);声明了 `expires` 却给不出 `now` ⇒ 到期维判不了 */
  now?: string | null;
}

export interface InstallPolicyDecision {
  verdict: InstallPolicyVerdict;
  /** 逐条点名"为什么是这个结论 / 哪一维判不了" */
  reasons: string[];
  missingFiles: string[];
  mismatchedFiles: string[];
  /** 两边都在却算不出摘要的路径(= 未判定,不是不符) */
  unjudgedFiles: string[];
}

/** 单个可比维度:`beyond` = 已装得更高(不降级) / `behind` = 已装得更低(要装) */
type DimReading = 'beyond' | 'satisfied' | 'behind' | 'unknown';

const isNum = (v: number | null | undefined): v is number =>
  typeof v === 'number' && Number.isFinite(v);

function revisionReading(desired?: number | null, installed?: number | null): DimReading {
  if (!isNum(desired) || !isNum(installed)) return 'unknown';
  return desired < installed ? 'beyond' : desired > installed ? 'behind' : 'satisfied';
}

/**
 * 版本串比较 —— 只在**形状读得出**时给结论,读不出返回 null(交回 `unjudged`)。
 * 分隔符 `[.+-]`,逐段比:两数字段按数值、同串按相等;一数字一非数字、或两个不同的非数字段
 * (如 `1.0.0-a` vs `1.0.0-b`)⇒ 判不出(不猜 pre-release 序)。
 */
export function compareVersionStrings(a: string, b: string): number | null {
  const left = a.trim().split(/[.+-]/).filter((s) => s.length > 0);
  const right = b.trim().split(/[.+-]/).filter((s) => s.length > 0);
  if (left.length === 0 || right.length === 0) return null;
  const shared = Math.min(left.length, right.length);
  for (let i = 0; i < shared; i++) {
    const x = left[i]!;
    const y = right[i]!;
    if (x === y) continue;
    if (!/^\d+$/.test(x) || !/^\d+$/.test(y)) return null;
    return Number(x) > Number(y) ? 1 : -1;
  }
  if (left.length === right.length) return 0;
  const rest = left.length > right.length ? left.slice(shared) : right.slice(shared);
  if (!rest.every((s) => /^\d+$/.test(s))) return null;
  if (rest.every((s) => Number(s) === 0)) return 0;
  return left.length > right.length ? 1 : -1;
}

function versionReading(desired?: string | null, installed?: string | null): DimReading {
  if (typeof desired !== 'string' || typeof installed !== 'string') return 'unknown';
  const cmp = compareVersionStrings(desired, installed);
  if (cmp === null) return 'unknown';
  return cmp < 0 ? 'beyond' : cmp > 0 ? 'behind' : 'satisfied';
}

interface DigestFace {
  consulted: boolean;
  missing: string[];
  mismatched: string[];
  undetermined: string[];
  checked: number;
}

const EMPTY_FACE: DigestFace = { consulted: false, missing: [], mismatched: [], undetermined: [], checked: 0 };

function digestFace(
  expected: PolicyExpectedFile[] | null | undefined,
  observed: PolicyObservedFile[] | null | undefined,
): DigestFace {
  if (!expected || expected.length === 0) return EMPTY_FACE;
  if (!observed) return { ...EMPTY_FACE, consulted: true };
  const byPath = new Map<string, string | null>();
  for (const f of observed) if (!byPath.has(f.path)) byPath.set(f.path, f.sha256);
  const face: DigestFace = { ...EMPTY_FACE, consulted: true, missing: [], mismatched: [], undetermined: [] };
  for (const want of expected) {
    if (typeof want.sha256 !== 'string' || want.sha256.length === 0) continue;
    face.checked++;
    const got = byPath.get(want.path);
    if (!byPath.has(want.path)) face.missing.push(want.path);
    else if (got === null || got === undefined) face.undetermined.push(want.path);
    else if (got.toLowerCase() !== want.sha256.toLowerCase()) face.mismatched.push(want.path);
  }
  return face;
}

/** 摘要维的登记语(点名而不改判),保证"没判"不会被读成"判过" */
function faceHints(face: DigestFace): string[] {
  const hints: string[] = [];
  if (face.missing.length > 0) hints.push(`清单声明的文件缺 ${face.missing.length} 枚(${face.missing.join(', ')})`);
  if (face.mismatched.length > 0) hints.push(`摘要不符 ${face.mismatched.length} 枚(${face.mismatched.join(', ')})`);
  if (face.undetermined.length > 0) hints.push(`摘要算不出 ${face.undetermined.length} 枚(${face.undetermined.join(', ')})`);
  if (hints.length === 0 && face.checked > 0) hints.push(`逐文件 sha256 ${face.checked} 枚已核对`);
  return hints;
}

function decide(verdict: InstallPolicyVerdict, reasons: string[], face: DigestFace = EMPTY_FACE): InstallPolicyDecision {
  return {
    verdict,
    reasons,
    missingFiles: face.missing,
    mismatchedFiles: face.mismatched,
    unjudgedFiles: face.undetermined,
  };
}

/**
 * 装机策略判定(唯一出口)。判序高优先在前,写死在代码里、不只写在注释里:
 *   ① 结构维:清单取不到 / 缺 id / presence 未声明或不认 ⇒ `unjudged`。
 *   ② 到期维(超越轴):声明了 `expires` 却读不出 / 拿不到 `now` / 已到期 ⇒ `unjudged`。
 *   ③ 不降级维:revision 或 version 任一读出"已装得更高" ⇒ `already-satisfied`(终局)。
 *   ④ 最低版本维:任一可比维读出"更旧" ⇒ `installed`;两维都不可比 ⇒ `unjudged`。
 *   ⑤ 摘要维(仅当清单声明 `files`):缺文件/不符 ⇒ `installed`;算不出 ⇒ `unjudged`(算不出 ≠ 相符)。
 */
export function decideInstallPolicy(input: InstallPolicyInput): InstallPolicyDecision {
  const resource = input.resource;
  if (!resource) return decide('unjudged', ['清单取不到(未传/解析失败):既不说"已满足"也不说"缺",交回待裁']);
  if (typeof resource.id !== 'string' || resource.id.trim() === '') {
    return decide('unjudged', ['清单缺 id:结论无法归属到某一枚资源']);
  }
  if (resource.presence === null || resource.presence === undefined) {
    return decide('unjudged', [`资源 ${resource.id}:presence 未声明,不猜默认档`]);
  }
  if (resource.presence !== ENSURE_MINIMUM_PRESENCE) {
    return decide('unjudged', [`资源 ${resource.id}:presence 形态不认(${resource.presence}),本判据只实现 ${ENSURE_MINIMUM_PRESENCE}`]);
  }

  const reasons: string[] = [`资源 ${resource.id} 按 ${ENSURE_MINIMUM_PRESENCE} 判`];

  if (resource.expires !== null && resource.expires !== undefined) {
    const expMs = Date.parse(resource.expires);
    const nowMs = input.now === null || input.now === undefined ? NaN : Date.parse(input.now);
    if (Number.isNaN(expMs)) return decide('unjudged', [...reasons, `到期时刻读不出(${resource.expires}):到期维判不了,不静默放行`]);
    if (Number.isNaN(nowMs)) return decide('unjudged', [...reasons, `清单声明了 expires 却拿不到当下时刻:到期维判不了,不静默放行`]);
    if (nowMs >= expMs) return decide('unjudged', [...reasons, `清单已于 ${resource.expires} 到期 ⇒ 回到待裁队列,不静默放行`]);
    reasons.push(`到期维:未到期(now < ${resource.expires})`);
  } else {
    reasons.push('到期维:清单未声明 expires(该枚不过期,不等于"腐烂无人管")');
  }

  const face = digestFace(resource.files, input.installed?.files ?? null);
  const rv = revisionReading(resource.revision, input.installed?.revision);
  const vv = versionReading(resource.version, input.installed?.version);

  if (input.installed === null || input.installed === undefined) {
    return decide('installed', [...reasons, '现状面:没有任何已装记录 ⇒ 缺最低版本'], face);
  }

  if (rv === 'beyond' || vv === 'beyond') {
    const why = [
      rv === 'beyond' ? `已装 revision ${input.installed.revision} > 清单 ${resource.revision}` : '',
      vv === 'beyond' ? `已装版本 ${input.installed.version} 高于清单最低 ${resource.version}` : '',
    ].filter((s) => s.length > 0);
    return decide('already-satisfied', [...reasons, `不降级:${why.join(' / ') || '更高代数在前'}`, ...faceHints(face)], face);
  }

  if (rv === 'behind' || vv === 'behind') {
    const which =
      rv === 'behind'
        ? `revision ${input.installed.revision} < 清单 ${resource.revision}`
        : `版本 ${input.installed.version} < 清单最低 ${resource.version}`;
    return decide('installed', [...reasons, `缺最低版本:${which}`], face);
  }

  if (rv === 'unknown' && vv === 'unknown') {
    return decide('unjudged', [...reasons, 'revision 与 version 两维都不可比(缺值或形状读不出):无法保证最低版本'], face);
  }

  if (face.consulted && (input.installed.files === null || input.installed.files === undefined)) {
    reasons.push('摘要维:清单声明了逐文件 sha256 而现状摘要面拿不到 ⇒ 该维未判定(不改"最低版本"这一格的结论)');
  }
  if (face.missing.length > 0) {
    return decide('installed', [...reasons, ...faceHints(face), '清单声明的文件在现状里缺 ⇒ 重装'], face);
  }
  if (face.mismatched.length > 0) {
    return decide('installed', [...reasons, ...faceHints(face), '盘上字节不是清单认的那批 ⇒ 重装'], face);
  }
  if (face.undetermined.length > 0) {
    return decide('unjudged', [...reasons, ...faceHints(face), '算不出 ≠ 相符'], face);
  }

  const by = [rv === 'satisfied' ? 'revision' : '', vv === 'satisfied' ? '版本' : ''].filter((s) => s.length > 0);
  return decide('already-satisfied', [...reasons, `${by.join(' / ')}已满足最低要求`, ...faceHints(face)], face);
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
