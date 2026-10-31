// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 进程内安全扫描判据层(单一真相源,AGENTS §0.6)——本仓「Edit/Write 后 pattern warning +
 * 收场聚合审查」两层的判据本体,住这里;钩子接线面(`hooks/index.ts`)只调用、不复制判据。
 *
 * 对齐对象(2026-11-01 取证,qoder security-scan 0.9.5 声明面,详见
 * docs/benchmark-evidence/2026-11/qoder-trae-rea-20261101/T11-security-hook-parity.md):
 *  - L1 pattern warning:编辑类工具后的正则/子串告警(告警语义,不阻断);
 *  - diff 收集上限对齐其 review.shared.diff 的三条(单文件 80KB / 总量 400KB / 30 文件);
 *  - 告警去重窗口对齐其 previous_findings_ttl_secs(3600s)。
 *
 * 刻意分歧(超越轴,不改):
 *  1. **零外发**——对照程序把 diff 送云端 review;本层只在本进程内判,绝不把用户代码
 *     发给任何远端(那是新的数据出口,AGENTS §5e 精神:判据不自带外泄面)。
 *  2. **未判定不冒绿**(§0.3)——取不到输入(路径缺失/读盘失败/git 不可用/输入非字符串)
 *     一律 status='undetermined' 并逐条点名缺什么;任何路径都不返回「安全」。
 *  3. **守卫失败不影响用户动作**(§12e)——本层所有入口自身不抛(scanText 对非法输入
 *     给未判定;IO 采集内部全兜底),调用面另有 catch,双保险。
 *
 * 与同族判据的分工(如实登记,防「三件套齐了」的册面误读):
 *  - `scripts/check-api-key-leak.mjs`:提交链守门(判 git blob,blocking);与本层**不同面
 *    同族**:一个拦提交、一个在会话内出告警,模式集各自独立(提交门判已知前缀真值,
 *    本层判通用形态;把两份合并反而让发布包依赖仓库根脚本)。
 *  - `apps/cli/src/redact.ts` / `packages/shared/src/utils/redact.ts`:**遮蔽**(把凭据
 *    打码后呈现),不是检测;本层产出的 excerpt 遮蔽格式与 §5d 口径一致(前6***后N)。
 *  - `apps/ai-service/app/services/{prompt_guard,tool_input_scanner,exec_policy}.py`:
 *    Python agent 运行时面,跨语言不可 import,与本层无共享判据。
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';

// ============================================================================
// 判据值域
// ============================================================================

export type SecretScanSeverity = 'HIGH' | 'MEDIUM' | 'LOW';

/** 三态值域:findings=判出命中 / clean=扫过且零命中 / undetermined=**没判成**(绝不等于安全)。 */
export type SecretScanStatus = 'findings' | 'clean' | 'undetermined';

export interface SecretScanFinding {
  ruleId: string;
  severity: SecretScanSeverity;
  /** 1-based 行号 */
  line: number;
  origin: string;
  /** 已遮蔽的命中样例(前6***后2 (len=N)),**绝不含凭据原文** */
  excerpt: string;
}

export interface SecretScanOutcome {
  status: SecretScanStatus;
  findings: SecretScanFinding[];
  /** 未判定时逐条点名缺的输入(§0.3:取不到 ⇒ 说清缺什么,不记绿也不冒红) */
  missing: string[];
  /** 被上限截断的来源点名(诚实性:扫了前半 ≠ 扫了全部) */
  truncatedOrigins: string[];
}

/** 模式表:id/严重度/正则源串/告警文案(对齐对照程序 security-patterns 的字段形态)。 */
export interface SecretScanPattern {
  id: string;
  severity: SecretScanSeverity;
  source: string;
  reminder: string;
}

/**
 * 内置模式集。通用形态(厂商前缀/私钥块/赋值行),不含任何真实凭据字面量;
 * 与 scripts/check-api-key-leak.mjs 的已知前缀集**刻意不同维**(那判泄露真值,这判危险形态)。
 */
export const SECRET_SCAN_PATTERNS: readonly SecretScanPattern[] = [
  {
    id: 'aws-access-key-id',
    severity: 'HIGH',
    source: String.raw`\bAKIA[0-9A-Z]{16}\b`,
    reminder: 'AWS access key id hardcoded; use env injection or a secrets manager',
  },
  {
    id: 'github-token',
    severity: 'HIGH',
    source: String.raw`\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,}\b|\bgithub_pat_[A-Za-z0-9_]{40,}\b`,
    reminder: 'GitHub token hardcoded; use a fine-grained token from env/secrets, not source',
  },
  {
    id: 'openai-style-key',
    severity: 'HIGH',
    source: String.raw`\bsk-[A-Za-z0-9_-]{32,}\b`,
    reminder: 'sk- prefixed API key hardcoded; move to env (key never enters git/history)',
  },
  {
    id: 'private-key-block',
    severity: 'HIGH',
    source: String.raw`-----BEGIN [A-Z0-9 ]*PRIVATE KEY( BLOCK)?-----`,
    reminder: 'private key material in source; keys belong in keystore/agent, not files',
  },
  {
    id: 'slack-token',
    severity: 'MEDIUM',
    source: String.raw`\bxox[baprs]-[A-Za-z0-9-]{10,}\b`,
    reminder: 'Slack token hardcoded; use env injection',
  },
  {
    id: 'google-api-key',
    severity: 'MEDIUM',
    source: String.raw`\bAIza[0-9A-Za-z_-]{35}\b`,
    reminder: 'Google API key hardcoded; use env injection',
  },
  {
    id: 'generic-key-assignment',
    severity: 'MEDIUM',
    // 赋值行形态:键名含 secret/token/key/password + 引号内 ≥16 字符的连续值。
    // 只判「赋了长字面量」这一种危险形态;占位符行先被 PLACEHOLDER_PATTERNS 放行。
    source: String.raw`(?:"|')?(?:api[_-]?key|secret|passwd|password|access[_-]?token|auth(?:orization)?)[_"'\s]*[:=]\s*(?:"|')[A-Za-z0-9+/_=.-]{16,}(?:"|')`,
    reminder: 'credential-looking literal assignment; prefer runtime injection and keep secrets out of the repo',
  },
];

/** 占位符/变量引用形态:命中即整行放行(防误伤 .env.example、模板与文档)。 */
export const PLACEHOLDER_PATTERNS: readonly RegExp[] = [
  /<your[-_a-z0-9]*>/i, // <your-api-key>
  /\{\{[A-Za-z0-9_.]+\}\}/, // {{TOKEN}}
  /\$\{[^}]*\}/, // ${API_KEY} / ${API_KEY:-default}
  /\$[A-Z][A-Z0-9_]{2,}/, // $API_KEY
  /=\s*(?:""|'')\s*$/, // KEY="" 空值
  /changeme|placeholder|example\.com|redacted/i,
];

// 上限常量:对齐对照程序 review.shared.diff 三条 + previous_findings_ttl_secs(见文件头注)。
export const MAX_SCAN_BYTES_PER_FILE = 81_920; // 80 KiB
export const MAX_SCAN_TOTAL_BYTES = 409_600; // 400 KiB
export const MAX_SCAN_FILES_PER_REVIEW = 30;
export const FINDINGS_DEDUP_TTL_MS = 3_600_000; // 1h
const FINDINGS_MEMORY_CAP = 500;
const GIT_TIMEOUT_MS = 10_000;

/**
 * 编辑类工具名匹配器的**唯一**登记处(对齐对照程序 PostToolUse matcher
 * `Edit|Write|MultiEdit|NotebookEdit` 的本仓对应物;本仓工具面现读为
 * write_file / edit_file / batch_edit —— delete_file 不产新内容,不入射程)。
 */
export const EDIT_TOOL_NAMES: readonly string[] = ['write_file', 'edit_file', 'batch_edit'];

export function isEditToolName(toolName: string): boolean {
  return EDIT_TOOL_NAMES.includes(toolName);
}

// ============================================================================
// 纯判据(零 IO)
// ============================================================================

const COMPILED: ReadonlyArray<{ pattern: SecretScanPattern; re: RegExp }> = SECRET_SCAN_PATTERNS.map(
  (pattern) => ({ pattern, re: new RegExp(pattern.source, 'i') }),
);

function isPlaceholderLine(line: string): boolean {
  return PLACEHOLDER_PATTERNS.some((p) => p.test(line));
}

/** 命中样例的遮蔽形态(§5d 口径:前6***后2 (len=N);短命中只留长度,绝不回显原文)。 */
export function maskExcerpt(matched: string): string {
  const cps = Array.from(matched);
  if (cps.length <= 8) return `*** (len=${cps.length})`;
  return `${cps.slice(0, 6).join('')}***${cps.slice(-2).join('')} (len=${cps.length})`;
}

function undetermined(missingItems: string[], findings: SecretScanFinding[] = []): SecretScanOutcome {
  return {
    status: 'undetermined',
    findings,
    missing: missingItems,
    truncatedOrigins: [],
  };
}

function clean(): SecretScanOutcome {
  return { status: 'clean', findings: [], missing: [], truncatedOrigins: [] };
}

/**
 * 对一段文本跑全部内置模式(逐行;占位符行放行)。
 * 输入不是字符串 ⇒ 未判定并点名(反向牙:任何调用面拿不到内容时,不许替它说"安全")。
 */
export function scanText(text: unknown, origin: string): SecretScanOutcome {
  if (typeof text !== 'string') {
    return undetermined([`content-unavailable(origin=${origin}, typeof=${typeof text})`]);
  }
  if (text === '') return clean();
  const truncated = text.length > MAX_SCAN_BYTES_PER_FILE;
  const scanned = truncated ? text.slice(0, MAX_SCAN_BYTES_PER_FILE) : text;
  const findings: SecretScanFinding[] = [];
  const lines = scanned.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    if (line === '' || isPlaceholderLine(line)) continue;
    for (const { pattern, re } of COMPILED) {
      const m = re.exec(line);
      if (m === null) continue;
      findings.push({
        ruleId: pattern.id,
        severity: pattern.severity,
        line: i + 1,
        origin,
        excerpt: maskExcerpt(m[0]),
      });
    }
  }
  return {
    status: findings.length > 0 ? 'findings' : 'clean',
    findings,
    missing: [],
    truncatedOrigins: truncated ? [origin] : [],
  };
}

/** 合并多个来源的判定:任一未判定 ⇒ 整体未判定(缺的输入必须可见);否则 findings>clean。 */
export function mergeOutcomes(outcomes: SecretScanOutcome[]): SecretScanOutcome {
  const missing: string[] = [];
  const findings: SecretScanFinding[] = [];
  const truncatedOrigins: string[] = [];
  let anyUndetermined = false;
  for (const o of outcomes) {
    missing.push(...o.missing);
    findings.push(...o.findings);
    truncatedOrigins.push(...o.truncatedOrigins);
    if (o.status === 'undetermined') anyUndetermined = true;
  }
  if (anyUndetermined) return { status: 'undetermined', findings, missing, truncatedOrigins };
  return { status: findings.length > 0 ? 'findings' : 'clean', findings, missing, truncatedOrigins };
}

// ============================================================================
// 命中去重(对齐对照程序 previous_findings_ttl_secs 的"同一漏洞不重复报"窗口)
// ============================================================================

const reportedFindings = new Map<string, number>();

function findingKey(f: SecretScanFinding): string {
  return `${f.ruleId}|${f.origin}|${f.excerpt}`;
}

/** 只留"窗口内没报过"的命中,并把留下的登记进窗口(超界先清过期,再清最旧 ⇒ 不无界增长)。 */
export function filterNewFindings(findings: SecretScanFinding[], now = Date.now()): SecretScanFinding[] {
  for (const [key, at] of reportedFindings) {
    if (now - at > FINDINGS_DEDUP_TTL_MS) reportedFindings.delete(key);
  }
  const fresh: SecretScanFinding[] = [];
  for (const f of findings) {
    const key = findingKey(f);
    if (reportedFindings.has(key)) continue;
    reportedFindings.set(key, now);
    fresh.push(f);
  }
  while (reportedFindings.size > FINDINGS_MEMORY_CAP) {
    const oldest = reportedFindings.keys().next();
    if (oldest.done === false && oldest.value !== undefined) reportedFindings.delete(oldest.value);
    else break;
  }
  return fresh;
}

// ============================================================================
// 编辑层:扫描刚落盘的文件(post-edit 现状;对照程序扫的是 edit diff,本层扫改后内容 ⇒
// 判"文件现在长什么样"而非"谁写的",误报面更宽但零漏报,取舍见取证册)
// ============================================================================

/** 读文件前段(不整读超大文件);任何读失败 ⇒ null(调用面转未判定,绝不抛)。 */
function readHead(filePath: string, capBytes: number): { text: string; truncated: boolean } | null {
  let fd: number | undefined;
  try {
    const st = fs.statSync(filePath);
    if (!st.isFile()) return null;
    fd = fs.openSync(filePath, 'r');
    const len = Math.min(st.size, capBytes);
    const buf = Buffer.alloc(len);
    fs.readSync(fd, buf, 0, len, 0);
    return { text: buf.toString('utf8'), truncated: st.size > capBytes };
  } catch {
    return null;
  } finally {
    if (fd !== undefined) {
      try {
        fs.closeSync(fd);
      } catch {
        // 关闭失败不影响已读内容判定
      }
    }
  }
}

/**
 * 编辑类工具收场后对本次落盘文件做 L1 pattern 扫描。
 * 输入 = runPostToolCall 的 output 载荷({ path, ... })。
 * 拿不到路径 / 读不了盘 ⇒ 未判定并点名;本函数自身不抛。
 */
export function scanEditedFile(output: unknown): SecretScanOutcome {
  if (typeof output !== 'object' || output === null || typeof (output as { path?: unknown }).path !== 'string' || (output as { path: string }).path === '') {
    return undetermined(['tool-output-file-path-missing']);
  }
  const rawPath = (output as { path: string }).path;
  const resolved = path.resolve(rawPath);
  const read = readHead(resolved, MAX_SCAN_BYTES_PER_FILE);
  if (read === null) {
    return undetermined([`file-not-readable(path=${rawPath})`]);
  }
  const outcome = scanText(read.text, rawPath);
  if (read.truncated && !outcome.truncatedOrigins.includes(rawPath)) {
    outcome.truncatedOrigins.push(rawPath);
  }
  return outcome;
}

// ============================================================================
// 收场层:整轮聚合改动审查(对齐对照程序 commit/push 前的 diff review 层,零外发)
// ============================================================================

export interface CollectedDiffInput {
  /** 已跟踪文件的 unified diff(added lines 是判据输入) */
  trackedDiff: string | null;
  /** 未跟踪新文件的路径清单(null = 采集失败 ⇒ 未判定) */
  untrackedPaths: string[] | null;
  /** 采集失败原因点名(逐条) */
  collectErrors: string[];
}

/** 派生 git 的纪律面(§12g):显式 stdio + windowsHide + 有界超时;失败 ⇒ null,不抛。 */
export function runGitForReview(workspacePath: string, args: string[]): { ok: true; stdout: string } | { ok: false; error: string } {
  try {
    const stdout = execFileSync('git', ['-C', workspacePath, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      timeout: GIT_TIMEOUT_MS,
      maxBuffer: MAX_SCAN_TOTAL_BYTES + 65_536,
    });
    return { ok: true, stdout };
  } catch (err) {
    const note = err instanceof Error ? err.message : String(err);
    return { ok: false, error: note.slice(0, 200) };
  }
}

export function collectStopReviewInputs(workspacePath: string, gitRun = runGitForReview): CollectedDiffInput {
  const errors: string[] = [];
  const diff = gitRun(workspacePath, ['diff', '--no-color', '--unified=0', 'HEAD']);
  if (!diff.ok) errors.push(`git-diff-HEAD-unavailable: ${diff.error}`);
  const others = gitRun(workspacePath, ['ls-files', '--others', '--exclude-standard']);
  if (!others.ok) errors.push(`git-ls-files-others-unavailable: ${others.error}`);
  return {
    trackedDiff: diff.ok ? diff.stdout : null,
    untrackedPaths: others.ok ? others.stdout.split(/\r?\n/).map((s) => s.trim()).filter((s) => s !== '') : null,
    collectErrors: errors,
  };
}

/** 从 unified diff 中只取新增行('+',排除 '+++'),拼成待扫文本。 */
export function addedLinesFromDiff(diffText: string): string {
  const out: string[] = [];
  for (const line of diffText.split(/\r?\n/)) {
    if (line.startsWith('+++')) continue;
    if (line.startsWith('+')) out.push(line.slice(1));
  }
  return out.join('\n');
}

/**
 * 收场聚合审查:HEAD 以来全部未提交改动(diff 新增行 + 未跟踪文件前段)。
 * 采集失败 ⇒ 未判定并点名;超限截断 ⇒ truncatedOrigins 如实留名。
 */
export function reviewWorkspaceChanges(workspacePath: string, gitRun = runGitForReview): SecretScanOutcome {
  try {
    const collected = collectStopReviewInputs(workspacePath, gitRun);
    const outcomes: SecretScanOutcome[] = [];
    if (collected.trackedDiff !== null) {
      outcomes.push(scanText(addedLinesFromDiff(collected.trackedDiff), 'workspace:diff-added-lines'));
    }
    if (collected.untrackedPaths !== null) {
      let budget = MAX_SCAN_TOTAL_BYTES;
      const files = collected.untrackedPaths.slice(0, MAX_SCAN_FILES_PER_REVIEW);
      if (collected.untrackedPaths.length > files.length) {
        outcomes.push(undetermined([`untracked-files-over-cap(total=${collected.untrackedPaths.length}, scanned=${files.length})`]));
      }
      for (const rel of files) {
        if (budget <= 0) {
          outcomes.push(undetermined([`scan-budget-exhausted(remaining-untracked-skipped-from=${rel})`]));
          break;
        }
        const read = readHead(path.resolve(workspacePath, rel), Math.min(budget, MAX_SCAN_BYTES_PER_FILE));
        if (read === null) {
          outcomes.push(undetermined([`file-not-readable(path=${rel})`]));
          continue;
        }
        budget -= read.text.length;
        const single = scanText(read.text, `workspace:${rel}`);
        if (read.truncated) single.truncatedOrigins.push(rel);
        outcomes.push(single);
      }
    }
    if (collected.collectErrors.length > 0) {
      outcomes.push(undetermined(collected.collectErrors));
    }
    return mergeOutcomes(outcomes);
  } catch (err) {
    // 采集/扫描自身异常 ⇒ 未判定(绝不冒绿),且不把异常传导给调用面(§12e)。
    const note = err instanceof Error ? err.message : String(err);
    return undetermined([`stop-review-crashed: ${note.slice(0, 200)}`]);
  }
}

// ============================================================================
// 呈现成形(ASCII 机器码行;进模型上下文前由钩子层过唯一成形出口 redactThenClip)
// ============================================================================

/**
 * 判定结果 → 一行 ASCII 机器码。三态在**值**上可判(不靠文案):
 *  - status=undetermined 必带 missing= 点名,并显式写 `not-judged-safe`(反向牙:
 *    谁把它改成冒绿,"clean-scan-ran" 与 "not-judged-safe" 的形状就都被测试钉住);
 *  - status=clean 只在**真扫过**时出现。
 * 去重窗口内的重复命中折叠为 deduped=N,不再逐条复读。
 */
export function describeScanOutcome(outcome: SecretScanOutcome): string {
  if (outcome.status === 'undetermined') {
    const parts = [`status=undetermined`, `not-judged-safe`];
    if (outcome.missing.length > 0) parts.push(`missing=${outcome.missing.join(';')}`);
    if (outcome.findings.length > 0) parts.push(`partial-findings=${outcome.findings.length}`);
    return parts.join(' | ');
  }
  const fresh = filterNewFindings(outcome.findings);
  const deduped = outcome.findings.length - fresh.length;
  const parts: string[] = [];
  if (outcome.status === 'findings') {
    parts.push('status=findings', `count=${outcome.findings.length}`, `new=${fresh.length}`);
    if (fresh.length > 0) {
      parts.push(`details=${fresh.map((f) => `${f.ruleId}@${f.origin}:L${f.line}[${f.severity}]`).join(',')}`);
    }
    parts.push(`reminders=${fresh.map((f) => f.ruleId).join(',')}`);
  } else {
    parts.push('status=clean', 'scan-ran', 'findings=0');
  }
  if (deduped > 0) parts.push(`deduped=${deduped}`);
  if (outcome.truncatedOrigins.length > 0) parts.push(`truncated=${outcome.truncatedOrigins.join(',')}`);
  return parts.join(' | ');
}

/** 测试通道:清空去重窗口(判据本身不经这里改)。 */
export function resetFindingsMemoryForTest(): void {
  reportedFindings.clear();
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
