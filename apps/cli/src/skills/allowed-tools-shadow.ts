// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// G-427 第①步「allowed-tools 影子记账」—— 只记不挡(机主拍板 2026-10-10)。
//
// 要解决的那一格(不是"再写一份权限判定"):
//   allowed-tools / tools 两字段今天只有解析(parseFrontmatter)与回写(serialize)两个触点,
//   getAllowedTools() 生产零调用方 —— 声明面承诺了"这个技能只准用这些工具",而执行层从不消费它。
//   直接把它接成闸门 = 替机主提前拍板;而"先记账一周"要的是**实据**:哪些(技能, 工具)对真会发生。
//   本模块就是那本账。
//
// 三条不可动摇的口径:
//   ① **永不拦截、永不改判定**:observeShadowToolCall() 返回的是"这一记被记上了几笔",
//      调用侧(executeToolCall)把它**丢掉**。任何"根据返回值 return / throw"的改法都等于
//      把影子档实现成 enforce,那在本票明令禁止之列(与 argument-validation 的
//      shadowValidateToolArguments 同一条纪律:只读、不写 args、不返回给调用链)。
//   ② **默认落盘,但只在真会发生时才写**:没技能声明白名单 ⇒ 一次盘都不碰(所以普通会话零副作用);
//      设 IHUI_SKILL_ALLOWED_TOOLS_LEDGER=0|off|false|no 可整块关掉,给一个路径即改道。
//      与姊妹出口 appendArgRejectionLedger 的"未设 env 即不写"刻意相反,理由是**这条被拍板要求
//      攒够一周样本** —— 默认关等于让"一周后再看"变成"一周后什么都没有",而那正是本仓
//      反复记过的"造好没装车"。两种默认都必须在头注写清,不得让下一个人以为是抄漏了。
//   ③ **只记标识符,不记内容**:落盘的每个字段是技能名、工具名、ISO 时刻、计数。
//      不含入参值、不含提示词、不含路径 —— 台账会被复制进 issue/邮件,而"把用户数据写进
//      诊断出口"在本仓已被记成缺陷型(守门 67/115/144 同族),所以这里刻意不过 redact 出口:
//      要盖的东西结构上进不来。技能名/工具名仍按码点截断并压掉控制字符,超限**留标记**,
//      不静默变短(AGENTS §30)。
//
// 覆盖面如实登记(不得读成"全通道都记到了"):
//   · 记的是**实际执行的调用** —— 观察点在 executeToolCall 本地分支、所有既有闸门(参数校验 /
//     权限规则 / 限流 / 危险确认)放行之后、executeWithRetry 之前。已被别的闸拒掉的调用
//     不记:白名单真生效时它们同样是"被拒",记下来只会把一件事算两遍。
//   · hub 分支(hubEnabled && hubResolver)在拿到本地 Tool 对象之前就 return,与姊妹出口
//     shadowValidateToolArguments 的已知缺口同型,本票不扩面。
//   · 显式单点调用技能不经过 formatSkillsForPrompt,其调用点在 commands/repl.ts,所以
//     **未被观察** —— 见报告的 unobserved 行,不得把"零命中"读成"没有冲突"。
//   · 白名单集取"进自动加载面的那批技能"(safeToAutoLoad === false 的不算)。被单条/总预算
//     截掉正文的技能**仍然计入声明面**:这只会多记一条证据,不会少记 —— 影子账的失效方向
//     必须是"多要一次人工裁决",不是"提前给出干净结论"。
//
// 三态绝不并桶(与 G-428 的三值口径同源,判据住在 getAllowedTools,本模块只投影):
//   · declared     —— 显式写了 string 数组(含**显式空表**:那意味着"一个工具都不许",
//                     所以任何调用都是命中,不是"没说话")。
//   · silent       —— 两键都没写 ⇒ "什么都没说",不参与判定,也不计命中。
//   · undetermined —— frontmatter 是块状 mapping 等非法形态(null)⇒ 判不了,逐条报名。
//   · invalid      —— 技能名取不出(非字符串/空串)⇒ 整条不进声明面并计一档,不静默丢。

import * as fs from 'node:fs';
import * as path from 'node:path';
import { getIhuiRoot } from '../plugins/paths.js';

/** 台账开关:0|off|false|no 关闭,给一个路径即改道,未设 = 默认路径开启。 */
export const SHADOW_LEDGER_ENV = 'IHUI_SKILL_ALLOWED_TOOLS_LEDGER';
/** 台账文件名(同目录唯一)。派生判断都取这个名字,不得在别处再抄一遍。 */
export const SHADOW_LEDGER_FILE_NAME = 'skill-allowed-tools-shadow.jsonl';
const DISABLE_VALUES: readonly string[] = ['0', 'off', 'false', 'no'];
/** 行格式版本:读侧只认这一版,不猜旧形态。 */
export const SHADOW_SCHEMA_VERSION = 1;
/** 单进程最多写这么多行(命中可能发生在每一次工具调用上,必须有上界;超限后只在内存计数并报名)。 */
export const SHADOW_LEDGER_MAX_ROWS_PER_PROCESS = 200;
/** 进台账的标识符按码点截断。 */
const TOKEN_MAX_CODEPOINTS = 60;
/** surface 行里最多列几个技能名(整份名单太长,报名到够用为止)。 */
const SURFACE_NAME_LIST_MAX = 20;
/** 待播告警队列上界(呈现侧取走,不得无限积)。 */
const ALERT_QUEUE_MAX = 20;
/** 少于这么多个"有声明的运行" ⇒ 报告明写证据不足,不得给一张空表让人读成"没有冲突"。 */
export const MIN_RUNS_FOR_VERDICT = 1;

// ==================== 类型 ====================

/** getAllowedTools() 的三值投影结果(名字与语义与那边同源,不另立第四态)。 */
export type ShadowSurfaceKind = 'declared' | 'silent' | 'undetermined' | 'invalid';

export interface ShadowSkillInput {
  name: unknown;
  /** 三值:undefined=什么都没说,null=非法形态,数组=声明面(含显式空表) */
  allowed: string[] | null | undefined;
}

export type ShadowLedgerRow =
  | {
      v: number;
      kind: 'surface';
      ts: string;
      declared: number;
      silent: number;
      undetermined: number;
      invalid: number;
      skills: string[];
      skillsOmitted: number;
    }
  | { v: number; kind: 'hit'; ts: string; skill: string; tool: string };

export interface ShadowPairCount {
  skill: string;
  tool: string;
  count: number;
}

export interface ShadowSnapshot {
  /** 本次进程声明过的面(名字),与 surface 行同口径 */
  declaredSkills: string[];
  silentSkills: number;
  undeterminedSkills: number;
  invalidSkills: number;
  /** 经过观察点的调用总次数(含没命中的)—— 分母,只在进程内可读,不落盘 */
  observedCalls: number;
  /** 命中(即"真上闸门就会被挡")的调用次数 */
  hitCalls: number;
  pairs: ShadowPairCount[];
  ledgerRows: number;
  writeFailures: number;
  capReached: boolean;
  ledgerEnabled: boolean;
  ledgerPath: string;
}

export interface ShadowLedgerRead {
  path: string;
  surfaceRows: number;
  hitRows: number;
  declaredSum: number;
  silentSum: number;
  undeterminedSum: number;
  invalidSum: number;
  pairs: ShadowPairCount[];
  declaredSkillNames: string[];
  malformedLines: number;
  totalLines: number;
  /** 文件不存在或读不到 ⇒ true:那是"无法判定",不是"样本为 0"(两者处置动作不同) */
  missing: boolean;
  unreadableReason: string | null;
}

export interface ShadowAggregate {
  source: string;
  read: ShadowLedgerRead;
  /** 有声明的运行数 —— 报告的头号判据:它决定"零命中"是不是一句有效结论 */
  runsWithDeclaredSurfaces: number;
  insufficient: boolean;
  insufficientReason: string | null;
  rows: ShadowPairCount[];
}

// ==================== 进程内状态 ====================

interface SurfaceEntry {
  skill: string;
  /** null ⇒ undetermined(非法形态);空数组 ⇒ 显式"一个都不许" */
  allowed: string[] | null;
  kind: ShadowSurfaceKind;
}

let surfaces: SurfaceEntry[] = [];
/** 上一次声明的签名:同面重复声明不再落 surface 行(见 declareShadowSurfaces 的注记)。 */
let lastSignature = '';
const pairCounts = new Map<string, number>();
const lastBuckets = { silent: 0, undetermined: 0, invalid: 0 };
let observedCalls = 0;
let hitCalls = 0;
let ledgerRows = 0;
let writeFailures = 0;
let capReached = false;
const alerts: string[] = [];
/** 已经朝 stderr 喊过的告警种类(同一件事一次会话只喊一遍)。 */
const announcedKinds = new Set<string>();

function pushAlert(text: string): void {
  alerts.push(text);
  if (alerts.length > ALERT_QUEUE_MAX) alerts.splice(0, alerts.length - ALERT_QUEUE_MAX);
  // **同一件事只喊一次**:写台账失败与规模闸触发在本进程内没有呈现点(那两个呈现点此刻在
  // 他席手里的 commands/repl.ts 与 commands/agent.ts 里 —— 归属纪律见 AGENTS §12,本票不越权
  // 改别人的文件)。所以这里直接落 stderr:否则"这台机的账根本没记上"就只在内存里安静躺着,
  // 而 §5e 明令"失败必须响"、§26 记过"兜底全落空必须喊出来,严禁无 else 静默降级"。
  // 一次性:长跑会话每条工具调用都刷一行 stderr 会把日志淹掉,那和静默同样没用。
  const kind = text.slice(0, 24);
  if (announcedKinds.has(kind)) return;
  announcedKinds.add(kind);
  try {
    process.stderr.write(`${text}\n`);
  } catch {
    /* stderr 自己写不进(重定向已断)时无路可喊:队列里仍留一份,由呈现侧取走 */
  }
}

/** 清一次性播报集合:自检与"重新开一轮"要清,否则第二次跑同样故障就听不见声音。 */
export function resetShadowAnnouncements(): void {
  announcedKinds.clear();
}

/** 取走并清空待播告警(呈现点调用;写台账失败绝不能静默,与 background-ledger 同一口径)。 */
export function drainShadowAlerts(): string[] {
  const out = alerts.slice();
  alerts.length = 0;
  return out;
}

/** 测试与"重新开一轮"用的复位口。复位不影响盘上已写的行。 */
export function resetShadowAllowedTools(): void {
  surfaces = [];
  lastSignature = '';
  pairCounts.clear();
  lastBuckets.silent = 0;
  lastBuckets.undetermined = 0;
  lastBuckets.invalid = 0;
  resetRunCounters();
}

// ==================== 落点与开关 ====================

/**
 * 台账落点:用户状态根下的同名文件 —— 本端**已有**的跨进程状态目录(插件注册表、后台任务台账
 * 都在那儿),且它已被 §26 的 junction 改道到数据盘。**刻意不放 .ihui-agent/tmp/**:那一个是
 * "任务完成后清理"的临时件落点,而这份账要活过一周 —— 写进会被扫的地方等于账根本没记。
 */
export function ledgerFilePath(env: Record<string, string | undefined> = process.env): string {
  const override = env[SHADOW_LEDGER_ENV];
  if (override !== undefined && override.trim() !== '' && !isDisableValue(override)) {
    return path.resolve(override.trim());
  }
  return path.join(getIhuiRoot(), SHADOW_LEDGER_FILE_NAME);
}

function isDisableValue(raw: string): boolean {
  return DISABLE_VALUES.includes(raw.trim().toLowerCase());
}

export function shadowLedgerEnabled(env: Record<string, string | undefined> = process.env): boolean {
  const raw = env[SHADOW_LEDGER_ENV];
  if (raw === undefined || raw.trim() === '') return true;
  return !isDisableValue(raw);
}

// ==================== 文本卫生 ====================

/** 按码点截断并**留下被截掉多少**:静默变短等于伪造完整性(AGENTS §30)。 */
function capCodepoints(text: string, max: number): string {
  const cps = Array.from(text);
  if (cps.length <= max) return text;
  return `${cps.slice(0, max).join('')}...[+${cps.length - max}]`;
}

/** 标识符卫生:压掉控制字符 + 码点截断。取不出名字返回 null,由调用方落 invalid 档。 */
function safeToken(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
  if (cleaned === '') return null;
  return capCodepoints(cleaned, TOKEN_MAX_CODEPOINTS);
}

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * 声明面签名:顺序无关、集合语义。**undetermined / invalid 的条数也进签名** ——
 * 只算 declared 的话,"两批技能同样没有可用白名单、但非法/无名条数从 0 变成 5"
 * 会被判成同一次声明而不落行,台账里那 5 格就永远没人看见(判据只报数不报名的同型)。
 */
function signatureOf(entries: readonly SurfaceEntry[], invalidCount: number): string {
  let undetermined = 0;
  const parts: string[] = [];
  for (const e of entries) {
    if (e.kind === 'undetermined') {
      undetermined += 1;
      continue;
    }
    parts.push(`${e.skill}=${Array.from(new Set(e.allowed ?? [])).sort().join(',')}`);
  }
  parts.push(`~undetermined=${undetermined}`);
  parts.push(`~invalid=${invalidCount}`);
  return parts.sort().join('|');
}

function pairKey(skill: string, tool: string): string {
  return `${skill}\u0000${tool}`;
}

// ==================== 写 ====================

function appendRows(rows: ShadowLedgerRow[], env: Record<string, string | undefined>): void {
  if (!shadowLedgerEnabled(env) || rows.length === 0) return;
  if (ledgerRows + rows.length > SHADOW_LEDGER_MAX_ROWS_PER_PROCESS) {
    if (!capReached) {
      capReached = true;
      pushAlert(
        `[skill-shadow] per-process ledger cap (${SHADOW_LEDGER_MAX_ROWS_PER_PROCESS} rows) reached; `
          + 'later hits are counted in memory only and will not appear in the ledger',
      );
    }
    return;
  }
  const file = ledgerFilePath(env);
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.appendFileSync(file, `${rows.map((r) => JSON.stringify(r)).join('\n')}\n`, 'utf-8');
    ledgerRows += rows.length;
  } catch (e) {
    writeFailures += 1;
    const code = typeof e === 'object' && e !== null && 'code' in e ? String((e as { code: unknown }).code) : '';
    pushAlert(`[skill-shadow] failed to write the shadow ledger to ${file} (${code || 'io-error'}); counts stay in memory only`);
  }
}

// ==================== 对外三入口 ====================

/**
 * 声明本次运行的白名单面。**生产唯一调用点是 formatSkillsForPrompt** —— 也就是"这批技能
 * 真的被交给了提示词构造"的那一刻,不是"磁盘上有这些文件"。
 *
 * 后一次声明整块替换前一次(一个进程一次运行)。有 ≥1 条 declared/undetermined/invalid 时
 * 落一行 surface,使"零命中"在台账里可以被区分成"确实没冲突"与"根本没东西可判"。
 */
export function declareShadowSurfaces(
  skills: readonly ShadowSkillInput[],
  env: Record<string, string | undefined> = process.env,
): void {
  const next: SurfaceEntry[] = [];
  let silent = 0;
  let undetermined = 0;
  let invalid = 0;
  for (const s of skills) {
    const name = safeToken(s.name);
    if (name === null) {
      invalid += 1;
      continue;
    }
    if (s.allowed === undefined) {
      silent += 1;
      continue;
    }
    if (s.allowed === null) {
      undetermined += 1;
      next.push({ skill: name, allowed: null, kind: 'undetermined' });
      continue;
    }
    const allowed = Array.from(new Set(s.allowed.map((t) => String(t)).filter((t) => t !== '')));
    next.push({ skill: name, allowed, kind: 'declared' });
  }
  const nextSignature = signatureOf(next, invalid);
  surfaces = next.filter((e) => e.kind === 'declared');
  lastBuckets.silent = silent;
  lastBuckets.undetermined = undetermined;
  lastBuckets.invalid = invalid;
  const declared = surfaces.length;
  if (declared === 0 && undetermined === 0 && invalid === 0) {
    lastSignature = '';
    return;
  }
  // 同一进程内重复声明**同一张面**(重建提示词、子代理复用)不再落 surface 行、不清计数:
  // 报表里的 "instrumented runs" 数的是运行,不是提示词重建次数 —— 让一次会话把自己
  // 数成八次,等于给"有样本"这句话注水。
  if (nextSignature === lastSignature) return;
  lastSignature = nextSignature;
  resetRunCounters();
  const names = surfaces.map((e) => e.skill);
  appendRows(
    [
      {
        v: SHADOW_SCHEMA_VERSION,
        kind: 'surface',
        ts: nowIso(),
        declared,
        silent,
        undetermined,
        invalid,
        skills: names.slice(0, SURFACE_NAME_LIST_MAX),
        skillsOmitted: Math.max(0, names.length - SURFACE_NAME_LIST_MAX),
      },
    ],
    env,
  );
}

function resetRunCounters(): void {
  pairCounts.clear();
  observedCalls = 0;
  hitCalls = 0;
  ledgerRows = 0;
  writeFailures = 0;
  capReached = false;
}

/**
 * 观察一次**实际执行**的工具调用。永不抛、永不拦截、永不改 args。
 * 返回值是给测试与呈现侧看的记账信息,执行链**必须忽略它**(见文件头①)。
 */
export function observeShadowToolCall(
  toolName: unknown,
  env: Record<string, string | undefined> = process.env,
): { hits: number; recorded: number } {
  observedCalls += 1;
  const tool = safeToken(toolName);
  if (tool === null) return { hits: 0, recorded: 0 };
  const hits: SurfaceEntry[] = [];
  for (const surface of surfaces) {
    const allowed = surface.allowed;
    if (allowed === null) continue;
    if (allowed.includes(tool)) continue;
    hits.push(surface);
  }
  if (hits.length === 0) return { hits: 0, recorded: 0 };
  hitCalls += 1;
  const ts = nowIso();
  const rows: ShadowLedgerRow[] = [];
  for (const surface of hits) {
    const key = pairKey(surface.skill, tool);
    pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
    rows.push({ v: SHADOW_SCHEMA_VERSION, kind: 'hit', ts, skill: surface.skill, tool });
  }
  appendRows(rows, env);
  return { hits: hits.length, recorded: rows.length };
}

/** 进程内快照(报告命令与测试都读它;跨进程的事实只在台账里)。 */
export function snapshotShadowAllowedTools(env: Record<string, string | undefined> = process.env): ShadowSnapshot {
  return {
    declaredSkills: surfaces.map((e) => e.skill),
    silentSkills: lastBuckets.silent,
    undeterminedSkills: lastBuckets.undetermined,
    invalidSkills: lastBuckets.invalid,
    observedCalls,
    hitCalls,
    pairs: pairsFromCounts(pairCounts),
    ledgerRows,
    writeFailures,
    capReached,
    ledgerEnabled: shadowLedgerEnabled(env),
    ledgerPath: ledgerFilePath(env),
  };
}

function pairsFromCounts(counts: Map<string, number>): ShadowPairCount[] {
  const out: ShadowPairCount[] = [];
  for (const [key, count] of counts) {
    const [skill, tool] = key.split('\u0000');
    out.push({ skill: skill ?? '', tool: tool ?? '', count });
  }
  return sortPairs(out);
}

function sortPairs(rows: ShadowPairCount[]): ShadowPairCount[] {
  return rows.slice().sort((a, b) => b.count - a.count || a.skill.localeCompare(b.skill) || a.tool.localeCompare(b.tool));
}

// ==================== 读台账 ====================

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function nonNegInt(v: unknown): number | null {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : null;
}

function stringList(v: unknown): string[] | null {
  if (!Array.isArray(v)) return null;
  const out: string[] = [];
  for (const item of v) {
    if (typeof item !== 'string') return null;
    out.push(item);
  }
  return out;
}

/** 一行的归属形态:三种之一,或 null(判不了 ⇒ malformed,不猜内容)。 */
function classifyRow(raw: unknown): ShadowLedgerRow | null {
  if (!isRecord(raw)) return null;
  if (raw.v !== SHADOW_SCHEMA_VERSION || typeof raw.ts !== 'string') return null;
  if (raw.kind === 'hit') {
    if (typeof raw.skill !== 'string' || raw.skill === '') return null;
    if (typeof raw.tool !== 'string' || raw.tool === '') return null;
    return { v: SHADOW_SCHEMA_VERSION, kind: 'hit', ts: raw.ts, skill: raw.skill, tool: raw.tool };
  }
  if (raw.kind === 'surface') {
    const declared = nonNegInt(raw.declared);
    const silent = nonNegInt(raw.silent);
    const undetermined = nonNegInt(raw.undetermined);
    const invalid = nonNegInt(raw.invalid);
    const skillsOmitted = nonNegInt(raw.skillsOmitted);
    const skills = stringList(raw.skills);
    if (declared === null || silent === null || undetermined === null || invalid === null || skillsOmitted === null || skills === null) {
      return null;
    }
    return { v: SHADOW_SCHEMA_VERSION, kind: 'surface', ts: raw.ts, declared, silent, undetermined, invalid, skills, skillsOmitted };
  }
  return null;
}

/** 读 JSONL 台账。坏行计入 malformedLines 并跳过;**只认当前版本,不猜旧形态**。 */
export function readShadowLedger(target: string): ShadowLedgerRead {
  const base: ShadowLedgerRead = {
    path: target,
    surfaceRows: 0,
    hitRows: 0,
    declaredSum: 0,
    silentSum: 0,
    undeterminedSum: 0,
    invalidSum: 0,
    pairs: [],
    declaredSkillNames: [],
    malformedLines: 0,
    totalLines: 0,
    missing: false,
    unreadableReason: null,
  };
  let text: string;
  try {
    text = fs.readFileSync(target, 'utf-8');
  } catch (e) {
    const code = typeof e === 'object' && e !== null && 'code' in e ? String((e as { code: unknown }).code) : '';
    return { ...base, missing: true, unreadableReason: code === 'ENOENT' ? 'no ledger file' : `unreadable (${code || 'io-error'})` };
  }
  const lines = text.split('\n').filter((l) => l.trim() !== '');
  const counts = new Map<string, number>();
  const names = new Set<string>();
  let surfaceRows = 0;
  let hitRows = 0;
  let declaredSum = 0;
  let silentSum = 0;
  let undeterminedSum = 0;
  let invalidSum = 0;
  let malformed = 0;
  for (const line of lines) {
    let raw: unknown;
    try {
      raw = JSON.parse(line);
    } catch {
      malformed += 1;
      continue;
    }
    const row = classifyRow(raw);
    if (row === null) {
      malformed += 1;
      continue;
    }
    if (row.kind === 'surface') {
      surfaceRows += 1;
      declaredSum += row.declared;
      silentSum += row.silent;
      undeterminedSum += row.undetermined;
      invalidSum += row.invalid;
      for (const n of row.skills) names.add(n);
      if (row.skillsOmitted > 0) names.add(`(+${row.skillsOmitted} more, unnamed in ledger)`);
      continue;
    }
    hitRows += 1;
    const key = pairKey(row.skill, row.tool);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return {
    ...base,
    surfaceRows,
    hitRows,
    declaredSum,
    silentSum,
    undeterminedSum,
    invalidSum,
    pairs: pairsFromCounts(counts),
    declaredSkillNames: Array.from(names).sort(),
    malformedLines: malformed,
    totalLines: lines.length,
  };
}

// ==================== 聚合 ====================

/**
 * 把台账读到的东西折成"逐技能可裁决"的表。**结论闭集**:不存在"看起来没问题"的第四态 ——
 * 没有声明面的样本就是 insufficient,必须写明,不得用一张空表冒充"没有冲突"。
 */
export function aggregateShadowLedger(read: ShadowLedgerRead, source: string): ShadowAggregate {
  const runsWithDeclaredSurfaces = read.surfaceRows;
  let insufficient = false;
  let reason: string | null = null;
  if (read.missing) {
    insufficient = true;
    reason = `ledger unreadable (${read.unreadableReason ?? 'unknown reason'}) at ${read.path}`;
  } else if (read.surfaceRows === 0) {
    insufficient = true;
    reason = 'no run ever declared an allowed-tools surface, so "zero hits" proves nothing';
  } else if (read.declaredSum === 0 && runsWithDeclaredSurfaces < MIN_RUNS_FOR_VERDICT) {
    insufficient = true;
    reason = `only ${runsWithDeclaredSurfaces} run(s) with declared surfaces (need >= ${MIN_RUNS_FOR_VERDICT})`;
  }
  return {
    source,
    read,
    runsWithDeclaredSurfaces,
    insufficient,
    insufficientReason: reason,
    rows: read.pairs,
  };
}

// ==================== 呈现 ====================

/** 输出面一律 ASCII(含中文串会让守门 70 把本文件判成"新增硬编码中文",它不在基线里)。 */
export function formatShadowReport(a: ShadowAggregate): string {
  const out: string[] = [];
  out.push(`[skills allowed-tools shadow] source: ${a.source}`);
  const r = a.read;
  if (r.missing) {
    out.push(`  UNDETERMINED: ${r.unreadableReason ?? 'ledger unavailable'} -- this is not "no conflicts"`);
    out.push(`  expected file: ${r.path}`);
    return out.join('\n');
  }
  out.push(`  lines read: ${r.totalLines} (surface ${r.surfaceRows}, hit ${r.hitRows}, malformed ${r.malformedLines})`);
  out.push(`  declared surfaces across runs: ${r.declaredSum} (silent ${r.silentSum}, undetermined ${r.undeterminedSum}, invalid ${r.invalidSum})`);
  if (r.malformedLines > 0) {
    out.push(`  NOTE: ${r.malformedLines} line(s) were not understood and were skipped -- counted, never dropped`);
  }
  if (r.undeterminedSum > 0) {
    out.push(`  NOTE: ${r.undeterminedSum} skill(s) had an unparseable surface (block-style mapping) -- undetermined, not "no restriction"`);
  }
  if (r.invalidSum > 0) {
    out.push(`  NOTE: ${r.invalidSum} skill(s) had no usable name -- excluded from the surface, listed as invalid`);
  }
  out.push('  NOT OBSERVED: explicit single-skill invocation (repl path) and the hub dispatch branch (no local Tool object).');
  out.push('              Zero hits below therefore means "none among auto-loaded skills in instrumented runs".');
  if (a.insufficient) {
    out.push(`  INSUFFICIENT EVIDENCE: ${a.insufficientReason}`);
    return out.join('\n');
  }
  if (a.rows.length === 0) {
    out.push(`  verdict: 0 would-be-blocked calls across ${a.runsWithDeclaredSurfaces} instrumented run(s) with surfaces`);
    out.push('  this IS a conclusion (surfaces were in effect and nothing outside them was called).');
    return out.join('\n');
  }
  out.push(`  would-be-blocked pairs (skill, tool) -- decide per skill, enforcement is a separate ticket:`);
  for (const row of a.rows) {
    out.push(`    ${row.skill} -> ${row.tool}  x${row.count}`);
  }
  return out.join('\n');
}

export const USAGE = `usage: ihui skills shadow-report [--ledger <jsonl>] [--json] [--self-test]
  reads the allowed-tools shadow ledger (record-only, never enforced)
  default file: ~/.ihui/${SHADOW_LEDGER_FILE_NAME}
  exit codes: 0 report produced (incl. "insufficient evidence", a valid conclusion)
              2 input unavailable = undetermined (never read as "clean")`;

/** 相对路径一律锚在**用户状态根或显式路径**,不得锚 cwd(pnpm --filter 会把 cwd 设成包目录)。 */
export function resolveShadowLedgerPath(explicit: string | undefined, env: Record<string, string | undefined> = process.env): string {
  if (explicit !== undefined && explicit.trim() !== '') return path.resolve(explicit.trim());
  return ledgerFilePath(env);
}

