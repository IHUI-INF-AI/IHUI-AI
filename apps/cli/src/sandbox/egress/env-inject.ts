// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 出口结论 → **子进程 env 出口**(goal-b49 复现腿的落地那一半)。
 *
 * 对侧把 TCP 连接判定交给常驻 LocalProxy,本仓此刻没有、也刻意不起那个载体,所以这里的
 * 出口分三条腿,每条都写清"谁在真正执行":
 *  1. **命令里点名了目的地**(curl/wget/pip/git 的 URL 参数、裸 IP):由派生点直接执行裁决 ——
 *     命中 enforce 档的 deny 就不拉起子进程(复用 sandbox 既有的 blocked 形态,不另造一套)。
 *     这一条不依赖代理,今天就是真的。
 *  2. **声明了执法代理**(`IHUI_EGRESS_PROXY_URL`):把 HTTP(S)_PROXY 指过去 + NO_PROXY 列出
 *     已判 allow 的主机,连接级判定交代理层(对侧的另一引擎)。没有代理进程时这条腿
 *     自动不点,不假装在执法。
 *  3. **只有名字没有目的地**(子进程自己再去连的域名):env 只能传策略标记
 *     (`IHUI_EGRESS_DECISION` 等),供代理/上层读取。真按域名拦需要代理腿 ⇒ 见交付报告"未竟"。
 *
 * 失效方向(§0.10):护栏自己取不到输入 ⇒ `unjudged` + 点名 + 下一步,而不是静默放行,
 * 也不是像对侧钩子那样 `catch {}`。
 */

import {
  appendEgressAuditRows,
  toAuditRow,
  type EgressAuditRow,
  type LedgerOutcome,
  type RowAppender,
} from './audit-ledger.js';
import {
  adjudicateEgressTargets,
  type CommandLineTokenizer,
  type DomainResolver,
} from './dns-adjudicator.js';
import {
  EGRESS_ENV,
  type EgressDecision,
  type EgressJudgement,
  type EgressPolicy,
} from './policy.js';
import { resolveEgressPolicy } from './policy-source.js';

export type EgressAggregate = 'noop' | 'allow' | 'deny' | 'unjudged';

/**
 * 出口标记键名。刻意避开本仓凭据形态 deny 表的任何后缀
 * (`*_KEY` / `*_TOKEN` / `*_SECRET` / `*_PASSWORD` / `*_API_KEY` …)——
 * 否则这些标记会被 `buildFilteredEnv` 自己剥掉(顺序见 `applyEgressEnvExit` 的头注)。
 */
const IHUI_EGRESS_DENIED_HOSTS_KEY = 'IHUI_EGRESS_DENIED_HOSTS';
const IHUI_EGRESS_UNJUDGED_KEY = 'IHUI_EGRESS_UNJUDGED';
const IHUI_EGRESS_UNJUDGED_REASONS_KEY = 'IHUI_EGRESS_UNJUDGED_REASONS';
const IHUI_EGRESS_LEDGER_STATE_KEY = 'IHUI_EGRESS_LEDGER_STATE';
const IHUI_EGRESS_LEDGER_REASON_KEY = 'IHUI_EGRESS_LEDGER_REASON';

export interface EgressEnvExit {
  readonly policy: EgressPolicy;
  readonly verdicts: readonly EgressJudgement[];
  readonly aggregate: EgressAggregate;
  /** true = 有 enforce 档的 deny 命中,派生点据此**不要**拉起子进程。 */
  readonly blocked: boolean;
  readonly blockReason: string | null;
  /** 要并进入子进程 env 的键(不含任何凭据、不含 URL 查询串)。 */
  readonly env: Readonly<Record<string, string>>;
  /** 必须出声的条目:策略取值被更严结算 / 裁决落在 unjudged / 台账写不成。 */
  readonly warnings: readonly string[];
  readonly rows: readonly EgressAuditRow[];
  readonly ledger: LedgerOutcome;
}

export interface EgressEnvExitInput {
  readonly commandLine: string;
  /** 派生工作目录:台账定根的起点(不取 process.cwd(),§15)。 */
  readonly cwd: string;
  readonly env?: Record<string, string | undefined>;
  /** 不传 ⇒ 由 env 解析(内置表恒在场)。 */
  readonly policy?: EgressPolicy | null;
  readonly resolver?: DomainResolver | null;
  readonly tokenize?: CommandLineTokenizer;
  readonly now?: () => Date;
  /** 测试替身:避免用例碰真实文件系统。 */
  readonly append?: RowAppender;
}

function aggregateOf(verdicts: readonly EgressJudgement[]): EgressAggregate {
  if (verdicts.length === 0) return 'noop';
  if (verdicts.some((v) => v.decision === 'deny')) return 'deny';
  if (verdicts.some((v) => v.decision === 'unjudged')) return 'unjudged';
  return 'allow';
}

/** 只取 ASCII 原因码(整条 hint 里可能带路径/引号,不往 env 里塞)。 */
function reasonCodes(verdicts: readonly EgressJudgement[], decision: EgressDecision): string[] {
  const out: string[] = [];
  for (const v of verdicts) {
    if (v.decision === decision && !out.includes(v.reason)) out.push(v.reason);
  }
  return out;
}

function proxyUrlOrNull(raw: string | undefined, warnings: string[]): string | null {
  const value = raw?.trim();
  if (!value) return null;
  try {
    const u = new URL(value);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return value;
  } catch {
    // 不回显 URL 本身:它可能带 user:pass@ 形态的代理凭据。
    warnings.push('egress: IHUI_EGRESS_PROXY_URL is not an http(s) URL; proxy leg not wired (this is a named gap, not a pass)');
    return null;
  }
}

/**
 * 组装出口(纯装配 + 一次台账写;零网络、零 spawn)。
 */
export function buildEgressEnvExit(input: EgressEnvExitInput): EgressEnvExit {
  const env = input.env ?? process.env;
  const warnings: string[] = [];

  let policy = input.policy ?? null;
  if (policy === null) {
    const resolved = resolveEgressPolicy(env);
    policy = resolved.policy;
    for (const w of resolved.warnings) warnings.push(w);
  }

  const verdicts = adjudicateEgressTargets(input.commandLine, {
    policy,
    resolver: input.resolver ?? null,
    tokenize: input.tokenize,
  });
  const aggregate = aggregateOf(verdicts);

  const blocking = verdicts.filter((v) => v.decision === 'deny' && v.enforcement === 'enforce');
  const blockReason =
    blocking.length > 0 ? `egress_denied: ${blocking.map((v) => v.target).join(',')}` : null;

  const deniedHosts = verdicts.filter((v) => v.decision === 'deny').map((v) => v.target);
  const allowedHosts = verdicts.filter((v) => v.decision === 'allow').map((v) => v.target);
  const unjudgedReasons = reasonCodes(verdicts, 'unjudged');

  const childEnv: Record<string, string> = { IHUI_EGRESS_DECISION: aggregate };
  if (deniedHosts.length > 0) childEnv[IHUI_EGRESS_DENIED_HOSTS_KEY] = deniedHosts.join(',');
  if (unjudgedReasons.length > 0) {
    childEnv[IHUI_EGRESS_UNJUDGED_KEY] = String(verdicts.filter((v) => v.decision === 'unjudged').length);
    childEnv[IHUI_EGRESS_UNJUDGED_REASONS_KEY] = unjudgedReasons.join(',');
  }

  const declaredProxy = proxyUrlOrNull(env[EGRESS_ENV.proxyUrl], warnings);
  if (declaredProxy !== null) {
    childEnv.HTTP_PROXY = declaredProxy;
    childEnv.http_proxy = declaredProxy;
    childEnv.HTTPS_PROXY = declaredProxy;
    childEnv.https_proxy = declaredProxy;
    const noProxy = [...new Set([...allowedHosts, 'localhost', '127.0.0.1'])].join(',');
    childEnv.NO_PROXY = noProxy;
    childEnv.no_proxy = noProxy;
  }

  const rows = verdicts.map((v) => toAuditRow(v, input.now, process.pid, blocking.includes(v)));
  const ledger: LedgerOutcome = appendEgressAuditRows(rows, {
    startDir: input.cwd,
    env,
    append: input.append,
  });
  childEnv[IHUI_EGRESS_LEDGER_STATE_KEY] = ledger.state;
  if (ledger.state === 'unjudged') {
    childEnv[IHUI_EGRESS_LEDGER_REASON_KEY] = ledger.reason.split(' ')[0] ?? 'unjudged';
    warnings.push(`egress ledger unjudged: ${ledger.reason}`);
  }

  for (const v of verdicts) {
    if (v.decision === 'unjudged') {
      warnings.push(`egress unjudged: ${v.target} (${v.reason}) -> ${v.hint}`);
    } else if (v.decision === 'deny' && v.enforcement === 'advisory') {
      warnings.push(`egress advisory deny: ${v.target} (${v.reason}) -> ${v.hint}`);
    }
  }
  if (verdicts.length === 0 && policy.addressProof) {
    warnings.push('egress: no destination named in this command line; address proof deferred to the proxy leg');
  }

  return {
    policy,
    verdicts,
    aggregate,
    blocked: blocking.length > 0,
    blockReason,
    env: childEnv,
    warnings,
    rows,
    ledger,
  };
}

/**
 * 把出口并进**已经过 `buildFilteredEnv` 剥凭据**的子进程 env。
 * 顺序固定:先剥凭据、后写出口标记 —— 反过来的话标记会被自己的 deny 表吃掉。
 * 返回新对象(不改入参)。
 */
export function applyEgressEnvExit(
  filteredEnv: Record<string, string | undefined>,
  exit: EgressEnvExit,
): Record<string, string | undefined> {
  return { ...filteredEnv, ...exit.env };
}

/** 去重账:同一签名只喊一次(同 `reportSuspiciousEnvVars`,每条命令都喊会刷屏,静默则敞口不可见)。 */
const reportedSignatures = new Set<string>();

/**
 * 出声出口:写**父进程** stderr(子进程自己的 stderr 走管道,不会混进命令输出)。
 * §0.9:判过没出声 = 没判;`warnings` 为空时零输出。
 */
export function reportEgressWarnings(exit: EgressEnvExit, stderr: NodeJS.WriteStream = process.stderr): void {
  if (exit.warnings.length === 0) return;
  const signature = `${exit.aggregate}|${exit.warnings.join('|')}`;
  if (reportedSignatures.has(signature)) return;
  reportedSignatures.add(signature);
  for (const line of exit.warnings) stderr.write(`⚠ egress: ${line}\n`);
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
