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
 *
 * 规则表**不含** `.worktrees/**` 一族(goal-b49 S7 裁决,反证钉在
 * `apps/cli/tests/acl-followup-b49.test.ts` R3 两例):
 *  ① 威胁型打不中 —— 危险从来不是"删自己那格隔离区",而是 `agentId` 带 `..` 把删除目标
 *     **折出** `.worktrees/`;折出去之后路径已不落在 `.worktrees/**` 之下,这条规则对它零作用;
 *  ② 加了会挡死合法腿 —— `IHUI_FILE_ACL_STRICT=1` 那档会把每一次隔离区回收(§12d 建/删/prune、
 *     worker-pool 收尾、守护对账)一起升成拦,正是 §12e 禁止的恒红门;
 *  ③ 真正管这一型的层已有:命中即止的裁决排在 `existsSync`/`git`/`rm` 之前
 *     (`tools/worktree.ts` 的 `WorktreeManager.remove` 与 `subagents/worktree.ts` 的
 *     `removeWorktree`),外加未合并/未提交/unknown 三档安全判据。
 *  ④ 上面 ① 的"折出"型由 `judgeWorktreeContainment`(goal-b49 W5)按几何事实兜住:ACL 的
 *     绝对 / 越界回落对 `.env` / `id_rsa` 这类根层单列族打不中 `../..`,容器性断言只看
 *     "解析后仍在隔离区根之下",补上 ACL 的结构盲区(与 ACL 分职,不替代也不放宽)。
 */
import { readFileSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
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

/** 清缓存(测试与"清单刚被改过"的场景用)。不传参 ⇒ 全清。出声账同批复位,不留第二把尺。 */
export function clearGuardRulesCache(workspacePath?: string): void {
  if (workspacePath === undefined) {
    guardRulesCache.clear();
    announcedGuardStates.clear();
    return;
  }
  guardRulesCache.delete(resolve(workspacePath));
  clearGuardUnjudgedAnnouncements(workspacePath);
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
 * 守护面不可判时的**出声**出口(goal-b49 S7,判据层单源 —— 消费点不许自己拼这句话)。
 *
 * 为什么需要它:`loadGuardFaceRules` 早就有三态,清单坏掉时报 `unjudged`;但那份判定
 * 折在 `buildFileAccessRules` 里,消费点只拿到"规则表短了一族"这个既成事实 ⇒
 * 于是"守护面族为空"这件事对人是不可见的(§0.9 静默 = 没判)。
 * 本出口只做一件事:**同一(工作区 × 原因)只报一次**,并且既不改判据结论、也不放宽任何一档
 * —— 失效方向恒为"多要一次定向说明",绝不是"多放一次跳门"(§0.10):
 * 凭据族照旧 enforce 拦(不记绿),合法操作照旧放行(不记红,§12e 不做恒红门)。
 */
const announcedGuardStates = new Set<string>();

/** 组一条 unjudged 提示;`guard.state==='ok'` 时返回 null(不该出声的不该出声)。 */
export function buildGuardUnjudgedNotice(
  workspacePath: string,
  guard: GuardManifestOutcome,
  site: string,
): string | null {
  if (guard.state !== 'unjudged') return null;
  const manifest = join(resolve(workspacePath), GUARD_MANIFEST_REL_PATH);
  return (
    `[file-acl unjudged] ${site}:守护面清单不可判 ⇒ 本轮只有凭据族在判,守护面族为空。` +
    `原因:${guard.reason}。这既不是"判过并通过"也不是"判红"(§0.3)。` +
    `下一步:确认 ${manifest} 可读且 entries 形状合判据,再重跑本操作。`
  );
}

/**
 * 消费点用的出声动作:同一(工作区 × 原因)首次返回 true 并落 stderr,之后返回 false。
 * stderr 不可用不影响判定结论(与既有 advisory 出声同形)。
 */
export function announceGuardUnjudged(
  workspacePath: string,
  guard: GuardManifestOutcome,
  site: string,
): boolean {
  if (guard.state !== 'unjudged') return false;
  const notice = buildGuardUnjudgedNotice(workspacePath, guard, site);
  if (notice === null) return false;
  const key = `${resolve(workspacePath)}|${guard.reason}`;
  if (announcedGuardStates.has(key)) return false;
  announcedGuardStates.add(key);
  try {
    process.stderr.write(`${notice}\n`);
  } catch {
    // 报名通道不可用不改判据结论
  }
  return true;
}

/** 清出声账(与 `clearGuardRulesCache` 同一复位出口;测试与"清单刚被修好"的场景用)。 */
export function clearGuardUnjudgedAnnouncements(workspacePath?: string): void {
  if (workspacePath === undefined) {
    announcedGuardStates.clear();
    return;
  }
  const prefix = `${resolve(workspacePath)}|`;
  for (const key of [...announcedGuardStates]) {
    if (key.startsWith(prefix)) announcedGuardStates.delete(key);
  }
}

/**
 * 消费点用的总闸:把"裁决 + 严档开关"折成单一出口。
 * `blocked=false` 也可能带 note —— advisory 命中必须出声,静默等于没判(§0.9)。
 *
 * `guard` 把守护面清单的三态一并透出(goal-b49 S7):消费点因此能区分
 * "这一族判过且放行" 与 "这一族根本没判成"(`announceGuardUnjudged` 是唯一出声出口)。
 */
export function evaluateFileAccess(
  op: FileAccessOp,
  filePath: string,
  workspacePath: string,
  env: Record<string, string | undefined> = process.env,
  read: ManifestReader = defaultManifestReader,
): { blocked: boolean; verdict: FileAccessVerdict; note: string | null; guard: GuardManifestOutcome } {
  const { rules, guard } = buildFileAccessRules(workspacePath, read);
  const verdict = decideFileAccess(op, filePath, rules);
  if (verdict.decision === 'allow') return { blocked: false, verdict, note: null, guard };
  const enforceThis = verdict.enforcement === 'enforce' || isStrictMode(env);
  if (!enforceThis) {
    return {
      blocked: false,
      verdict,
      note: `[file-acl advisory] ${op} ${verdict.path} 命中 ${verdict.rule?.pattern}(${verdict.rule?.source})⇒ 放行但出声:${verdict.nextStep}`,
      guard,
    };
  }
  return {
    blocked: true,
    verdict,
    note: `[file-acl ${verdict.decision}] ${op} ${verdict.path} 命中 ${verdict.rule?.pattern}:${verdict.rule?.why} 下一步:${verdict.nextStep}`,
    guard,
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

/**
 * worktree 删除出口的**容器性断言**(goal-b49 W5,判据层单源 §0.6)。
 *
 * 与 ACL **分职**:ACL 判"这个路径准不准删"(凭据族 / 守护面族,靠 `toAclPath` 折成工作区相对
 * 形态后走尾段 glob);本判据判"删除目标解析后有没有越出**自家隔离区根**"。二者互补,谁也不
 * 替代谁、谁也不放宽谁。
 *
 * 为什么必须有它(立因):`toAclPath` 的绝对 / 越界形态走的是**绝对路径回落**(见上),
 * 逃逸出工作区的目标只能靠**尾段 glob**(secrets 目录族、npmrc 族,形态见规则表而非本注)拦住,
 * `.env` / `id_rsa` 这类**根层单列族**对 `../..` 折叠出来的形态天然打不中 —— ACL 在「越界」这一型上有结构盲区。
 * 容器性断言不看内容族,只看"解析后仍在隔离区根之下"这一几何事实,正好补那一格。
 *
 * 失效方向(§0.10):命拒 = 越界 ⇒ 调用方须"出声 + 不删",绝不抛穿被上层 catch 洗成静默。
 * 判定是纯函数,不碰 fs。
 *
 * 两臂取其一即判容器内(超越轴:既认"权威根下"(WorktreeManager 有确定的 `rootDir`),
 * 又认"隔离区叶子直子"(subagents.removeWorktree 拿到的 `sourcePath` 可能被内部收尾腿传歪,
 * 如 worker-pool 以 `parentId` 当 sourcePath ⇒ 严格比根会误杀合法回收)):
 *  ① `strictlyUnder`:`resolve(target)` 落在 `resolve(worktreeRoot)` 之下(非 `..`、非绝对回落、非根本身);
 *  ② `structuralChild`:`resolve(target)` 的父目录叶子名 == 隔离区根叶子名(如 `.worktrees`),
 *     且目标自身是单段普通名(无分隔符、非 `.`/`..`)。`..` 向上折出隔离区时父目录叶子名即失配,
 *     而内部收尾腿即便 sourcePath 传歪,真实目标 `<repo>/.worktrees/<id>` 的父叶子仍是 `.worktrees` ⇒ 不误杀。
 */
export type WorktreeContainmentVerdict =
  | { readonly contained: true; readonly target: string }
  | { readonly contained: false; readonly target: string; readonly reason: string; readonly nextStep: string };

export function judgeWorktreeContainment(worktreeRoot: string, targetPath: string): WorktreeContainmentVerdict {
  const target = resolve(targetPath);
  const root = resolve(worktreeRoot);
  const isWin = sep === '\\';
  const leafEq = (a: string, b: string): boolean => (isWin ? a.toLowerCase() === b.toLowerCase() : a === b);

  const rel = relative(root, target);
  const strictlyUnder =
    rel.length > 0 && rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);

  const targetLeaf = basename(target);
  const parentLeaf = basename(dirname(target));
  const isolationLeaf = basename(root);
  const structuralChild =
    targetLeaf.length > 0 &&
    targetLeaf !== '.' &&
    targetLeaf !== '..' &&
    !targetLeaf.includes('/') &&
    !targetLeaf.includes('\\') &&
    leafEq(parentLeaf, isolationLeaf);

  if (strictlyUnder || structuralChild) return { contained: true, target };
  return {
    contained: false,
    target,
    reason: `解析后越出隔离区根:目标 ${target} 不在 ${root} 之下`,
    nextStep:
      '本出口只回收隔离区根之下的直接子目录;若确需删除该路径,请给一次定向说明(为什么删它、恢复源在哪),' +
      '并确认它不属任何 worktree 隔离区。',
  };
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
