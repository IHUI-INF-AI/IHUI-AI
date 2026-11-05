// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 按操作分维的声明式文件访问裁决(read / write / delete 三轴独立判定)。
 *
 * 立因(goal-b49 逆向取证,对照程序 = 本机 WorkBuddy 5.9.3):对方自带一份
 * 逐路径 × 逐操作的规则表(默认动作 ask),把"凭据目录不可读"与"守护件不可随手改"
 * 收成运行时裁决。本仓此前只有**单一档位**的 folder_trust(trusted/read-only/forbidden),
 * 且全仓仅 `tools/index.ts:1956` 一处消费 ⇒ **读侧根本没有闸**(本仓已发生过两次
 * 凭据被整段打进聊天的事故),而"判据面不可变"只能在提交后由门 279 事后追认。
 *
 * 相对对照程序的超越轴(交付时逐条可验):
 *  1. 清单不抄第二份:守护面规则由本仓已审的 `scripts/data/immutable-guard.json` **派生**,
 *     读不到时如实记 `unjudged` 并点名,绝不用 0 冒充"没有守护件"(§0.3)。
 *  2. 可测性:裁决是纯函数 + 注入式清单读取器,CI 里直接断言,含"副作用未发生"的反向牙。
 *  3. 失效方向:命中即点名"是哪条规则、哪个操作、下一步做什么"(§0.10),
 *     而不是静默降级 —— 对方钩子坏了是 `catch {}`。
 *  4. 不制造恒红门(§12e):守护面默认 **advisory**(出声不阻断),
 *     只有凭据族的 deny 是 enforce;升 blocking 的前置是既有工作流改造完,不是今天。
 */
import { readFileSync } from 'node:fs';
import { join, isAbsolute, relative, resolve, sep } from 'node:path';
import { globMatches, normalizeWorkspacePath } from './glob-pattern.js';

export type FileAccessOp = 'read' | 'write' | 'delete';
export type FileAccessDecision = 'allow' | 'ask' | 'deny';
/** enforce = 直接拦;advisory = 出声放行(留给"先登记、后升档"的那一格)。 */
export type FileAccessEnforcement = 'enforce' | 'advisory';
export type FileAccessRuleSource = 'credential' | 'guard-face';

export interface FileAccessRule {
  /** 工作区相对 glob(`*` 单层 / `**` 递归),语义与 folder_trust 同一原语 */
  readonly pattern: string;
  /** 逐操作裁决;缺键 = 该操作不受本条约束(继续往下找,最终默认 allow) */
  readonly ops: Readonly<Partial<Record<FileAccessOp, FileAccessDecision>>>;
  readonly enforcement: FileAccessEnforcement;
  readonly source: FileAccessRuleSource;
  /** 为什么立这条 —— 必须是人能读懂的一句话,拒绝"看代码自己猜" */
  readonly why: string;
}

export interface FileAccessVerdict {
  readonly op: FileAccessOp;
  readonly path: string;
  readonly decision: FileAccessDecision;
  readonly enforcement: FileAccessEnforcement;
  readonly rule: FileAccessRule | null;
  /** 拒绝/追问时的下一步;allow 时为 null */
  readonly nextStep: string | null;
}

/** 本仓自带的凭据族(读侧一律 deny:把正文交出去就是事故本身)。 */
export const CREDENTIAL_FILE_ACCESS_RULES: readonly FileAccessRule[] = [
  // 例外族必须排在通配族之前:裁决按声明序取首个命中(见 decideFileAccess)。
  {
    pattern: '.env.example',
    ops: {},
    enforcement: 'enforce',
    source: 'credential',
    why: '模板件不含真实凭据,放行以便新人照着配',
  },
  {
    pattern: '.env.template',
    ops: {},
    enforcement: 'enforce',
    source: 'credential',
    why: '同上:模板件无凭据',
  },
  {
    pattern: '.env',
    ops: { read: 'deny', write: 'deny', delete: 'ask' },
    enforcement: 'enforce',
    source: 'credential',
    why: '工作区 .env 是明文键值容器,整份读出来就等于把凭据交出去',
  },
  {
    pattern: '.env.*',
    ops: { read: 'deny', write: 'deny', delete: 'ask' },
    enforcement: 'enforce',
    source: 'credential',
    why: '.env.local / .env.production 等分档件同样只存明文凭据',
  },
  {
    pattern: '**/.npmrc',
    ops: { read: 'deny', delete: 'ask' },
    enforcement: 'enforce',
    source: 'credential',
    why: '.npmrc 存发布令牌(_authToken),读正文即暴露',
  },
  {
    pattern: '**/.git-credentials',
    ops: { read: 'deny', delete: 'ask' },
    enforcement: 'enforce',
    source: 'credential',
    why: 'git 明文凭据文件',
  },
  {
    pattern: 'secrets/**',
    ops: { read: 'deny', delete: 'ask' },
    enforcement: 'enforce',
    source: 'credential',
    why: '工作区根下的凭据目录(`**/x/**` 形如本仓 glob 语义要求前置一层,故根层单列)',
  },
  {
    pattern: '**/secrets/**',
    ops: { read: 'deny', delete: 'ask' },
    enforcement: 'enforce',
    source: 'credential',
    why: '约定俗成的凭据目录',
  },
  {
    pattern: '**/*.pem',
    ops: { read: 'deny', delete: 'ask' },
    enforcement: 'enforce',
    source: 'credential',
    why: '私钥/证书私钥正文',
  },
  {
    pattern: '**/*.key',
    ops: { read: 'deny', delete: 'ask' },
    enforcement: 'enforce',
    source: 'credential',
    why: '私钥文件(含 Windows 生成件)',
  },
  {
    pattern: '**/id_rsa*',
    ops: { read: 'deny', delete: 'ask' },
    enforcement: 'enforce',
    source: 'credential',
    why: 'SSH 私钥',
  },
  {
    pattern: '**/id_ed25519*',
    ops: { read: 'deny', delete: 'ask' },
    enforcement: 'enforce',
    source: 'credential',
    why: 'SSH 私钥',
  },
  // 根层单列族:本仓 glob 语义里 `**/x` 要求前置一层(vitest 首跑实测),
  // 所以工作区根上的凭据件必须有裸形态,否则"根层 id_rsa"会从尺子上漏过去。
  {
    pattern: 'id_rsa*',
    ops: { read: 'deny', delete: 'ask' },
    enforcement: 'enforce',
    source: 'credential',
    why: 'SSH 私钥(工作区根层形态)',
  },
  {
    pattern: 'id_ed25519*',
    ops: { read: 'deny', delete: 'ask' },
    enforcement: 'enforce',
    source: 'credential',
    why: 'SSH 私钥(工作区根层形态)',
  },
  {
    pattern: '*.pem',
    ops: { read: 'deny', delete: 'ask' },
    enforcement: 'enforce',
    source: 'credential',
    why: '私钥/证书私钥(工作区根层形态)',
  },
  {
    pattern: '*.key',
    ops: { read: 'deny', delete: 'ask' },
    enforcement: 'enforce',
    source: 'credential',
    why: '私钥文件(工作区根层形态)',
  },
  {
    pattern: '.npmrc',
    ops: { read: 'deny', delete: 'ask' },
    enforcement: 'enforce',
    source: 'credential',
    why: '.npmrc 存发布令牌(工作区根层形态)',
  },
  {
    pattern: '.git-credentials',
    ops: { read: 'deny', delete: 'ask' },
    enforcement: 'enforce',
    source: 'credential',
    why: 'git 明文凭据(工作区根层形态)',
  },
  {
    pattern: '.ssh/**',
    ops: { read: 'deny', delete: 'ask' },
    enforcement: 'enforce',
    source: 'credential',
    why: '工作区根下的 .ssh 目录',
  },
];

/** `scripts/data/immutable-guard.json` 在工作区内的相对位置(单一真相源所在)。 */
export const GUARD_MANIFEST_REL_PATH = 'scripts/data/immutable-guard.json';

interface GuardManifestEntry {
  readonly path: string;
  readonly kind: string;
  readonly why: string;
}

export type GuardManifestOutcome =
  | { readonly state: 'ok'; readonly rules: readonly FileAccessRule[]; readonly count: number }
  | { readonly state: 'unjudged'; readonly rules: []; readonly count: 0; readonly reason: string };

/** 注入式读取器:返回文件正文;读不到返回 null(不抛,便于测试与跨机)。 */
export type ManifestReader = (absolutePath: string) => string | null;

const defaultManifestReader: ManifestReader = (abs) => {
  try {
    return readFileSync(abs, 'utf8');
  } catch {
    return null;
  }
};

/**
 * 从已审的守护面清单派生访问规则。
 * 三态(§0.3):文件读不到 / JSON 坏 / 条目形状坏 ⇒ `unjudged` 并点名原因,
 * **不返回空表冒充"本仓没有守护件"**。
 *
 * 结论按工作区缓存:一次会话里 read_file/write_file 会被调用成百次,每问一次都重读
 * 清单是纯浪费;`unjudged` 也进缓存(同一工作区不会突然变成可判),由测试与升档入口显式清。
 */
const guardRulesCache = new Map<string, GuardManifestOutcome>();

export function loadGuardFaceRules(
  workspacePath: string,
  read: ManifestReader = defaultManifestReader,
): GuardManifestOutcome {
  const cacheKey = resolve(workspacePath);
  const cached = guardRulesCache.get(cacheKey);
  if (cached && read === defaultManifestReader) return cached;
  const outcome = computeGuardFaceRules(cacheKey, read);
  if (read === defaultManifestReader) guardRulesCache.set(cacheKey, outcome);
  return outcome;
}

/** 清缓存(测试与"清单刚被改过"的场景用)。不传参 ⇒ 全清。 */
export function clearGuardRulesCache(workspacePath?: string): void {
  if (workspacePath === undefined) guardRulesCache.clear();
  else guardRulesCache.delete(resolve(workspacePath));
}

function computeGuardFaceRules(
  workspacePath: string,
  read: ManifestReader,
): GuardManifestOutcome {
  const raw = read(join(workspacePath, GUARD_MANIFEST_REL_PATH));
  if (raw === null) {
    return {
      state: 'unjudged',
      rules: [],
      count: 0,
      reason: `取不到守护面清单 ${GUARD_MANIFEST_REL_PATH}(本工作区可能不是 IHUI-AI 仓库)`,
    };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    return {
      state: 'unjudged',
      rules: [],
      count: 0,
      reason: `守护面清单不是合法 JSON:${e instanceof Error ? e.message : String(e)}`,
    };
  }
  const entries = (parsed as { entries?: unknown }).entries;
  if (!Array.isArray(entries) || entries.length === 0) {
    return {
      state: 'unjudged',
      rules: [],
      count: 0,
      reason: '守护面清单未枚举到任何条目(枚举到 0 条不判绿,§0.3)',
    };
  }
  const rules: FileAccessRule[] = [];
  for (const e of entries as Partial<GuardManifestEntry>[]) {
    if (typeof e?.path !== 'string' || e.path.length === 0) continue;
    rules.push({
      // 目录形态(尾斜杠)补成递归 glob;其余形态(含 check-*.mjs)原样作 glob
      pattern: e.path.endsWith('/') ? `${e.path}**` : e.path,
      ops: { write: 'ask', delete: 'ask' },
      enforcement: 'advisory',
      source: 'guard-face',
      why: typeof e.why === 'string' && e.why.length > 0 ? e.why : `守护件(kind=${e.kind ?? '未知'})`,
    });
  }
  if (rules.length === 0) {
    return { state: 'unjudged', rules: [], count: 0, reason: '守护面清单条目全部形状不合判据' };
  }
  return { state: 'ok', rules, count: rules.length };
}

/** 完整裁决表 = 凭据族(逐条 enforce) + 守护面派生族。声明序即匹配序。 */
export function buildFileAccessRules(
  workspacePath: string,
  read: ManifestReader = defaultManifestReader,
): { readonly rules: readonly FileAccessRule[]; readonly guard: GuardManifestOutcome } {
  const guard = loadGuardFaceRules(workspacePath, read);
  return { rules: [...CREDENTIAL_FILE_ACCESS_RULES, ...guard.rules], guard };
}

/**
 * 纯裁决函数:按声明序取**首个模式命中**的规则,由它定论(命中即止)。
 * 因此例外族(`ops` 里不含该操作 ⇒ 本条明确不约束它)必须排在通配族之前 ——
 * 表内已保证,并由用例 ② 反向钉住(`.env.example` 可读而 `.env.local` 不可读)。
 */
export function decideFileAccess(
  op: FileAccessOp,
  filePath: string,
  rules: readonly FileAccessRule[],
): FileAccessVerdict {
  const normalized = normalizeWorkspacePath(filePath);
  for (const rule of rules) {
    if (!globMatches(rule.pattern, normalized)) continue;
    const decision = rule.ops[op];
    if (decision === undefined) {
      // 首个模式命中但本条不管这个操作 ⇒ 判 allow 并停止(例外族正是靠这一步生效)
      break;
    }
    if (decision === 'allow') break;
    return {
      op,
      path: normalized,
      decision,
      enforcement: rule.enforcement,
      rule,
      nextStep: nextStepFor(op, decision, rule),
    };
  }
  return {
    op,
    path: normalized,
    decision: 'allow',
    enforcement: 'enforce',
    rule: null,
    nextStep: null,
  };
}

function nextStepFor(op: FileAccessOp, decision: FileAccessDecision, rule: FileAccessRule): string {
  if (rule.source === 'guard-face') {
    return (
      '该路径属判据面(守护件)。确需改动:按 AGENTS.md 的判据面纪律,在提交信息正文带一行 ' +
      '`immutable-exempt: <≥10 字理由>`;需要机主追认的走 `scripts/data/immutable-guard-acks.jsonl`。'
    );
  }
  if (decision === 'deny') {
    return (
      `不要把该文件的正文打印或回传。需要确认某项配置时,读**模板件**(.env.example)或让用户自己给结论;` +
      `本条判据:${rule.why}`
    );
  }
  return `${op === 'delete' ? '删除' : '改动'}前需一次定向说明(为什么做、恢复源在哪)。本条判据:${rule.why}`;
}

/** 升档开关:严档把 advisory 也当 enforce 拦(默认关,免得把并行席的正常改动全堵死)。 */
export const FILE_ACL_STRICT_ENV = 'IHUI_FILE_ACL_STRICT';

export function isStrictMode(env: Record<string, string | undefined> = process.env): boolean {
  return env[FILE_ACL_STRICT_ENV] === '1';
}

/**
 * 消费点用的总闸:把"裁决 + 严档开关"折成单一出口。
 * `blocked=false` 也可能带 note —— advisory 命中必须出声,静默等于没判(§0.9)。
 */
export function evaluateFileAccess(
  op: FileAccessOp,
  filePath: string,
  workspacePath: string,
  env: Record<string, string | undefined> = process.env,
  read: ManifestReader = defaultManifestReader,
): { blocked: boolean; verdict: FileAccessVerdict; note: string | null } {
  const { rules } = buildFileAccessRules(workspacePath, read);
  const verdict = decideFileAccess(op, filePath, rules);
  if (verdict.decision === 'allow') return { blocked: false, verdict, note: null };
  const enforceThis = verdict.enforcement === 'enforce' || isStrictMode(env);
  if (!enforceThis) {
    return {
      blocked: false,
      verdict,
      note: `[file-acl advisory] ${op} ${verdict.path} 命中 ${verdict.rule?.pattern}(${verdict.rule?.source})⇒ 放行但出声:${verdict.nextStep}`,
    };
  }
  return {
    blocked: true,
    verdict,
    note: `[file-acl ${verdict.decision}] ${op} ${verdict.path} 命中 ${verdict.rule?.pattern}:${verdict.rule?.why} 下一步:${verdict.nextStep}`,
  };
}

/**
 * Windows 盘符(`G:/`、`G:\`)与 UNC(`\\server\share`)绝对形态。
 * 判据与宿主平台无关:`node:path` 的 `isAbsolute` 在 POSIX 上不认盘符,
 * 同一个输入会在本地(Windows)与 CI(Linux)给出两种结论 —— 裁决面不允许这种漂移。
 */
const WINDOWS_ABS_RE = /^(?:[A-Za-z]:[\\/]|\\\\)/;

/** 按 Windows 语义(大小写不敏感)把盘符绝对路径折成工作区相对形态;越界则原样返回。 */
function foldWindowsAbsUnderWorkspace(workspacePath: string, filePath: string): string {
  const ws = normalizeWorkspacePath(workspacePath);
  const fp = normalizeWorkspacePath(filePath);
  const prefix = ws.endsWith('/') ? ws : `${ws}/`;
  if (fp.toLowerCase().startsWith(prefix.toLowerCase())) return fp.slice(prefix.length);
  return fp;
}

/**
 * 把消费点拿到的路径折成"用于匹配的工作区相对 POSIX 形态"。
 * 绝对路径(以及越出工作区的路径)也照样进尺:secrets 族与私钥扩展名族
 * 靠尾段匹配,逃不出去 —— 不给"传绝对路径就绕过裁决"这条缝留口子。
 */
export function toAclPath(workspacePath: string, filePath: string): string {
  if (WINDOWS_ABS_RE.test(filePath)) return foldWindowsAbsUnderWorkspace(workspacePath, filePath);
  if (!isAbsolute(filePath)) return normalizeWorkspacePath(filePath);
  const rel = relative(resolve(workspacePath), resolve(filePath));
  if (rel === '' || rel.startsWith(`..${sep}`) || rel === '..') return normalizeWorkspacePath(filePath);
  return normalizeWorkspacePath(rel);
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
