// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Pre/Post Tool Hooks — 用户自定义工具调用钩子。
 *
 * 灵感来源:参考行业 Agent 框架的 hooks 系统(pre/post tool call 可阻断 + sessionStart/sessionEnd 生命周期)。
 * 简化策略(做减法):
 *   - 多源加载 hooks.json:<cwd>/.{ihui,claude,cursor} → ~/.{ihui,claude,cursor}(高→低,深合并)
 *   - 每个 hook 二选一:command(本地 shell)或 webhook(HTTP POST 通知外部服务)
 *   - preToolCall:钩子失败时阻断工具调用(blockOnError 默认 true)
 *   - postToolCall:钩子失败时返回 blockResult(blockOnError 默认 false,仅通知)
 *   - sessionStart:会话启动时执行,失败阻断会话启动(blockOnError 默认 true)
 *   - sessionEnd:会话结束时执行,失败不阻塞退出(始终 swallow)
 *   - 钩子通过环境变量接收上下文(IHUI_TOOL / IHUI_TOOL_INPUT / IHUI_TOOL_OUTPUT / IHUI_WORKSPACE / IHUI_SESSION_ID)
 *   - matchTool 支持正则匹配工具名,省略则匹配所有工具
 *
 * 配置示例 (~/.ihui/hooks.json):
 * {
 *   "preToolCall": [
 *     { "name": "block-rm-rf", "command": "echo 'blocked' && exit 1", "matchTool": "bash", "blockOnError": true }
 *   ],
 *   "postToolCall": [
 *     { "name": "notify-feishu", "webhook": "https://open.feishu.cn/open-apis/bot/v2/hook/xxx",
 *       "body": "{\"event\":\"{{event}}\",\"tool\":\"{{toolName}}\"}", "blockOnError": false }
 *   ],
 *   "sessionStart": [
 *     { "name": "load-ctx", "command": "cat ~/.ihui/context.md" }
 *   ],
 *   "sessionEnd": [
 *     { "name": "notify", "command": "echo 'session ended' >> ~/.ihui/sessions.log" }
 *   ]
 * }
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
// 规范化器唯一实现(见下方摘要口径处的说明)
import { canonicalizeArgs } from '../stream-tool-ledger.js';
import { tryParseJson, isRecord } from '../util/json.js';
import { gateHook } from './trust.js';

export interface HookEntry {
  name: string;
  /** 本地 shell 命令(与 webhook 二选一) */
  command?: string;
  /** HTTP webhook URL(与 command 二选一,POST 通知外部服务) */
  webhook?: string;
  /** webhook 请求方法(默认 POST) */
  method?: 'POST' | 'PUT' | 'GET';
  /** webhook 请求头 */
  headers?: Record<string, string>;
  /** webhook 请求 body 模板(支持 {{event}} {{workspacePath}} {{sessionId}} {{toolName}} {{toolArgs}}) */
  body?: string;
  matchTool?: string;
  blockOnError?: boolean;
  /** 超时毫秒(command 与 webhook 共用,默认 10000) */
  timeout?: number;
  /** 来源标记,由 loadHooksConfig 按配置文件落点盖章:
   *  - `'project'` = 工作区里带的配置(clone 下来的仓库可写)→ command 形态必须过目录信任门
   *  - `'user'`    = 用户主目录下的配置 → 行为与接线前完全一致
   *  未盖章(`undefined`)按 `'project'` 处理:来源不明不能变成免检通道。 */
  source?: 'project' | 'user';
  /** 来源配置所在目录(绝对路径)。目录信任判定按**它**而不是 process.cwd() ——
   *  IHUI_HOOKS_CONFIG 可以把配置指到任意目录,按 cwd 判会把陌生目录的钩子
   *  算成"已信任目录里长出来的"。 */
  sourceFolder?: string;
}

export type HookEvent =
  | 'preToolCall'
  | 'postToolCall'
  | 'sessionStart'
  | 'sessionEnd'
  | 'userPromptSubmit'
  | 'preCompact'
  | 'postCompact'
  | 'notification'
  | 'stop'
  | 'stopFailure'
  | 'postToolUseFailure'
  | 'permissionDenied'
  | 'subagentStart'
  | 'subagentStop'
  // P2-4 agent-lifecycle Turn 级事件(4 种):
  // - turnStart:每次 LLM 调用 + 工具循环开始(每轮触发,粒度细于 sessionStart)
  // - turnEnd:每轮成功结束(无论是否调用工具)
  // - turnError:本轮出错(单轮失败,不等于 agent 终止)
  // - turnComplete:agent 完成所有轮次(成功或失败都触发,与 stop 配对)
  | 'turnStart'
  | 'turnEnd'
  | 'turnError'
  | 'turnComplete';

export interface HooksConfig {
  preToolCall?: HookEntry[];
  postToolCall?: HookEntry[];
  sessionStart?: HookEntry[];
  sessionEnd?: HookEntry[];
  userPromptSubmit?: HookEntry[];
  preCompact?: HookEntry[];
  postCompact?: HookEntry[];
  notification?: HookEntry[];
  stop?: HookEntry[];
  stopFailure?: HookEntry[];
  postToolUseFailure?: HookEntry[];
  permissionDenied?: HookEntry[];
  subagentStart?: HookEntry[];
  subagentStop?: HookEntry[];
  // P2-4 Turn 级事件(4 种,粒度细于 sessionStart/sessionEnd)
  turnStart?: HookEntry[];
  turnEnd?: HookEntry[];
  turnError?: HookEntry[];
  turnComplete?: HookEntry[];
}

export interface HookResult {
  proceed: boolean;
  reason?: string;
}

export interface SessionHookContext {
  workspacePath: string;
  sessionId?: string;
}

export interface HookContext {
  workspacePath?: string;
  sessionId?: string;
  toolName?: string;
  toolArgs?: unknown;
  toolResult?: unknown;
  prompt?: string;
  error?: string;
  reason?: string;
  subagentId?: string;
  subagentType?: string;
  compactedTokensBefore?: number;
  compactedTokensAfter?: number;
  notificationText?: string;
  // P2-4 Turn 级事件字段
  /** 当前 turn 序号(1-based) */
  turnNumber?: number;
  /** 最大 turn 数(对应 maxIterations) */
  maxTurns?: number;
  /** agent 最终完成的轮次总数(turnComplete 事件用) */
  totalTurns?: number;
  /** agent 停止原因(turnComplete 事件用,与 AgentStopReason 对齐) */
  stopReason?: string;
}

/**
 * webhook body 模板变量替换:将 {{var}} 替换为 vars[var]。
 * 未定义变量替换为空字符串。无变量时原样返回。
 */
export function buildWebhookBody(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    return Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key] ?? '') : '';
  });
}

/** HooksConfig 的全部事件键 —— 合并与来源盖章两处共用一份清单
 *  (两处各抄一份时,新增事件只改一处就会静默漏掉另一处)。 */
const HOOK_EVENT_KEYS: Array<keyof HooksConfig> = [
  'preToolCall', 'postToolCall', 'sessionStart', 'sessionEnd',
  'userPromptSubmit', 'preCompact', 'postCompact', 'notification',
  'stop', 'stopFailure', 'postToolUseFailure', 'permissionDenied',
  'subagentStart', 'subagentStop',
  // P2-4 Turn 级事件
  'turnStart', 'turnEnd', 'turnError', 'turnComplete',
];

/**
 * 深合并两个 HooksConfig:b 的标量/数组与 a 合并。
 * 数组字段(preToolCall 等)拼接为 [...a, ...b](a 在前);仅一边存在则保留该边。
 */
export function deepMergeHooks(a: HooksConfig, b: HooksConfig): HooksConfig {
  const result: HooksConfig = {};
  const keys: Array<keyof HooksConfig> = HOOK_EVENT_KEYS;
  for (const k of keys) {
    const av = a[k];
    const bv = b[k];
    if (av && bv) {
      result[k] = [...av, ...bv];
    } else if (av) {
      result[k] = [...av];
    } else if (bv) {
      result[k] = [...bv];
    }
  }
  return result;
}

/** 多源扫描目录(高→低):workspace 三级 → home 三级 */
const CONFIG_SOURCE_DIRS = ['.ihui', '.claude', '.cursor'];

function listHooksConfigPaths(cwd: string): string[] {
  const home = os.homedir();
  const paths: string[] = [];
  for (const d of CONFIG_SOURCE_DIRS) paths.push(path.join(cwd, d, 'hooks.json'));
  for (const d of CONFIG_SOURCE_DIRS) paths.push(path.join(home, d, 'hooks.json'));
  return paths;
}

/**
 * 配置文件归属的"目录" —— 目录信任判定要以它为粒度,而不是以 hooks.json 所在目录:
 * `<repo>/.ihui/hooks.json` 的归属目录是 `<repo>`(用户要信任的是这个仓库,
 * 而不是它的 `.ihui` 子目录)。约定目录名不在 CONFIG_SOURCE_DIRS 里时,取其自身父目录。
 */
export function owningFolderOfConfig(configFile: string): string {
  const dir = path.dirname(path.resolve(configFile));
  return CONFIG_SOURCE_DIRS.includes(path.basename(dir)) ? path.dirname(dir) : dir;
}

function isSameOrUnder(candidate: string, root: string): boolean {
  return candidate === root || candidate.startsWith(root + path.sep);
}

/**
 * 按配置文件落点判定来源:
 * - 归属目录落在工作区内 → `'project'`(clone 下来的仓库自带的配置走这一支)
 * - 落在用户主目录下 → `'user'`(用户自己写的,不算外来代码)
 * - 两处都不落(单源模式指到别处 / 判不出来)→ `'project'`
 *   最后一支是**刻意的保守**:默认放行等于把"来源不明"当免检通道。
 */
export function classifyHooksSource(configFile: string, cwd: string): 'project' | 'user' {
  const owning = owningFolderOfConfig(configFile);
  if (isSameOrUnder(owning, path.resolve(cwd))) return 'project';
  if (isSameOrUnder(owning, path.resolve(os.homedir()))) return 'user';
  return 'project';
}

/** 给一份从磁盘读到的配置逐条盖来源戳(必须在合并**之前**做,合并后无法区分谁带来的) */
function stampConfigSource(
  config: HooksConfig,
  source: 'project' | 'user',
  sourceFolder: string,
): HooksConfig {
  const stamped: HooksConfig = {};
  for (const key of HOOK_EVENT_KEYS) {
    const entries = config[key];
    if (!entries) continue;
    // 已带 source 的条目不覆盖:允许调用方(或再上一层生成器)显式声明来源
    stamped[key] = entries.map((e) => ({
      ...e,
      source: e.source ?? source,
      sourceFolder: e.sourceFolder ?? sourceFolder,
    })) as never;
  }
  return stamped;
}

/** 一份磁盘配置 + 它解析出来的**原树**(束摘要必须喂原树,不能喂合并/加工后的派生态) */
interface HooksSourceBundle {
  configFile: string;
  config: HooksConfig;
  raw: Record<string, unknown>;
}

function readHooksConfigBundle(p: string): HooksSourceBundle | null {
  if (!fs.existsSync(p)) return null;
  try {
    const parsed = tryParseJson(fs.readFileSync(p, 'utf-8'));
    // 损坏文件返回 null,由调用方继续下一源(与旧行为一致)
    if (!isRecord(parsed)) return null;
    return { configFile: p, config: parsed as unknown as HooksConfig, raw: parsed };
  } catch {
    return null;
  }
}

function readHooksConfigFile(p: string): HooksConfig | null {
  return readHooksConfigBundle(p)?.config ?? null;
}

/** 剥掉派发侧盖上的派生字段,只留磁盘上那份声明(信任记录与门内比对必须用同一个口径) */
function stripDispatchStamps(entry: HookEntry): Record<string, unknown> {
  const all = entry as unknown as Record<string, unknown>;
  const { source: _s, sourceFolder: _f, ...raw } = all;
  void _s;
  void _f;
  return raw;
}

/**
 * 内容摘要的两个口径(A20)。放在配置层而不是信任层,有两个理由:
 *   ① 摘要取的是"配置长什么样",这本来就是 loadHooksConfig 的知识;trust.ts 只认
 *      不透明字符串(它连 HooksConfig 的类型都不该引,否则信任层要反过来懂配置格式)。
 *   ② 实测过的工程约束:`tests/hooks-trust-command.test.ts` 用 vi.mock 整模块替换
 *      trust.js(只给出它认识的那几个导出)。摘要函数住在 trust.js 时,任何走
 *      commands/hooks.ts → index.ts → trust.js 的调用都会撞上 "No export is defined on
 *      the mock" —— 既有测试一字未改就红。住在配置层则与被替换的模块无关。
 *
 * 规范化器只认一份实现(AGENTS「两处算同一 key 必须共用一份实现」):
 * `apps/cli/src/stream-tool-ledger.ts` 的 canonicalizeArgs(递归按 key 排序),
 * 消除"同一对象两种 JSON 串"造成的指纹分裂 —— 也就是"改了键序/缩进就误判过期"那一类。
 */

/** 摘要前缀带形态版本 + 算法名:改了"取哪些字段/怎么编码"必须 +1,否则新旧两套字节共用同一份登记表 */
const DIGEST_PREFIX = `v1-sha256-`

/** 单条声明摘要的聚合前缀:与整束摘要分域,使两者**不可能**产出同一个值(不靠注释提醒) */
const DECL_DIGEST_PREFIX = 'ihui-hook-decl-v1'

function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

/**
 * 「束」摘要 —— 覆盖的是**面**,不是取值:有哪几份来源文件、每个事件下有哪些钩子名字、
 * 以及事件数组之外的根级字段。单条钩子把命令改掉不该让整个目录掉信任(见
 * computeHookContentDigests 的两级说明),但"凭空多出一条钩子"必须让整批重确认 ——
 * 用户当初批准的是那份清单,清单变长不在授权范围内。
 */
export function digestOfHooksBundle(surface: unknown): string {
  return DIGEST_PREFIX + sha256(canonicalizeArgs(surface ?? {}));
}

/**
 * 单条钩子声明的摘要 —— 覆盖这条声明的**全部取值**。
 * `kind` 前缀让 command 形态与 webhook 形态不在同一命名空间比较:把一条 command 原地
 * 换成 webhook(或反之)是最需要重新确认的一次改动,而两者共用字段可能一字未动。
 * kind 由声明自身推出(webhook 有值即 webhook),不依赖任何外部登记。
 */
export function digestOfHookDeclaration(entry: unknown): string {
  const rec = (entry ?? {}) as Record<string, unknown>;
  const kind = typeof rec.webhook === 'string' && rec.webhook.length > 0 ? 'webhook' : 'command';
  const material = `${DECL_DIGEST_PREFIX}\u0000${kind}\u0000${canonicalizeArgs(entry ?? {})}`;
  return DIGEST_PREFIX + sha256(material);
}

/**
 * 算出「该目录下会派发的钩子」的内容摘要(束 + 逐条)。
 * `ihui hooks trust` 批准时与派发门判定时**都必须**走这一个函数 —— 两处各算一遍
 * (一侧喂磁盘原树、一侧喂合并结果)必然不同形,表现为永不收敛的 stale。
 *
 * 两级各管一类(缺任一级都会退化):
 *   - 束摘要管"清单与根级面":来源文件增删 / 某事件下多出一个钩子名字 / 根级字段变化
 *     → 整批掉信任,因为用户批的是那份清单。
 *   - 单条摘要管"这一条的取值":改一条命令 / URL / 匹配器 / 超时
 *     → **只有那一条**掉信任,其余照跑。只有束级时改一条会把全部钩子打回重批,
 *     用户被骚扰到无脑点"是",信任就退化成噪音。
 *
 * 单条摘要的登记表键 = 钩子 `name`,与既有的 `~/.ihui/disabled-hooks`(也按名字逐条管)
 * 同一身份口径:"这个目录里叫 X 的那条钩子"就是用户批准时看到的东西。代价如实登记:
 * 两个事件下各有一条同名钩子时,摘要表只留**先读到的**那条 —— 不会因此漏判,
 * 因为两条同名钩子的"面"(事件 × 名字身份)本来就不同,增删任一条都会先动束摘要。
 *
 * 只统计**工作区那一层**的配置文件(<dir>/.{ihui,claude,cursor}/hooks.json),
 * 不并入用户主目录的配置 —— 家目录配置派发时本就不查门(source==='user' 短路),
 * 把它并进摘要会让"改一条用户自己的全局钩子"把每个项目的信任一起打回重批。
 */
export function computeHookContentDigests(
  cwd: string = process.cwd(),
): { bundleDigest: string; declarations: Record<string, string> } {
  const paths: string[] = [];
  if (process.env.IHUI_HOOKS_CONFIG) paths.push(process.env.IHUI_HOOKS_CONFIG);
  else for (const d of CONFIG_SOURCE_DIRS) paths.push(path.join(cwd, d, 'hooks.json'));
  const sources: string[] = [];
  const surface: string[] = [];
  const roots: Array<Record<string, unknown>> = [];
  const declarations: Record<string, string> = {};
  for (const p of paths) {
    const bundle = readHooksConfigBundle(p);
    if (!bundle) continue;
    // 来源名取相对 cwd 的那一段(<.ihui|...>/hooks.json)或绝对路径本身(单源模式)——
    // 不含盘符前缀,所以"仓库搬家"不会因为路径字符串变化而额外掉信任(搬家本来就要重批目录)。
    const rel = path.relative(cwd, p);
    sources.push(rel && !rel.startsWith('..') && !path.isAbsolute(rel) ? rel.split(path.sep).join('/') : p);
    // 事件数组之外的键(若有人往根上塞了 version/timeout 之类)整体计入束摘要
    const root: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(bundle.raw)) {
      if (!(HOOK_EVENT_KEYS as string[]).includes(k)) root[k] = v;
    }
    roots.push(root);
    for (const event of HOOK_EVENT_KEYS) {
      for (const entry of bundle.config[event] ?? []) {
        surface.push(`${event}:${entry.name}`);
        if (declarations[entry.name] === undefined) {
          declarations[entry.name] = digestOfHookDeclaration(stripDispatchStamps(entry));
        }
      }
    }
  }
  // 数组顺序 = 优先级顺序(高→低),与 loadHooksConfig 的读取方向一致 ⇒ 同一份磁盘内容
  // 在任何一次调用里算出的束摘要都相同(不存在"键序 / 读序"造成的假 stale)。
  const bundleDigest = digestOfHooksBundle({
    sources,
    surface: surface.slice().sort(),
    roots,
  });
  return { bundleDigest, declarations };
}

export function getHooksPath(): string {
  if (process.env.IHUI_HOOKS_CONFIG) return process.env.IHUI_HOOKS_CONFIG;
  return path.join(os.homedir(), '.ihui', 'hooks.json');
}

/**
 * 多源加载 hooks.json,按优先级深合并(高优先级覆盖低优先级)。
 * IHUI_HOOKS_CONFIG 环境变量设置时退化为单源(向后兼容)。
 * 每条钩子都会被盖上 `source` / `sourceFolder`(派发时判目录信任要用)。
 */
export function loadHooksConfig(cwd: string = process.cwd()): HooksConfig {
  if (process.env.IHUI_HOOKS_CONFIG) {
    const p = process.env.IHUI_HOOKS_CONFIG;
    const parsed = readHooksConfigFile(p);
    if (!parsed) return {};
    return stampConfigSource(parsed, classifyHooksSource(p, cwd), owningFolderOfConfig(p));
  }
  const paths = listHooksConfigPaths(cwd);
  let acc: HooksConfig = {};
  for (const p of [...paths].reverse()) {
    const parsed = readHooksConfigFile(p);
    if (parsed) {
      acc = deepMergeHooks(acc, stampConfigSource(parsed, classifyHooksSource(p, cwd), owningFolderOfConfig(p)));
    }
  }
  return acc;
}

export function loadHooks(): HooksConfig {
  return loadHooksConfig();
}

function matchesTool(entry: HookEntry, toolName: string): boolean {
  if (!entry.matchTool) return true;
  try {
    return new RegExp(entry.matchTool).test(toolName);
  } catch {
    return entry.matchTool === toolName;
  }
}

type WebhookResult =
  | { kind: 'response'; status: number; body: string }
  | { kind: 'error'; error: 'timeout' | 'network'; message: string };

/** 子进程脚本:用原生 fetch 发起 webhook,AbortController 控制超时,结果以 JSON 写到 stdout。
 *  通过 IHUI_WEBHOOK_CFG 环境变量传入配置,避免命令行转义。 */
const WEBHOOK_SCRIPT = `
const cfg = JSON.parse(process.env.IHUI_WEBHOOK_CFG || '{}');
const ctrl = new AbortController();
const timer = setTimeout(() => ctrl.abort(), cfg.timeout);
fetch(cfg.url, {
  method: cfg.method,
  headers: cfg.headers,
  body: cfg.body,
  signal: ctrl.signal,
}).then(async (r) => {
  const t = await r.text().catch(() => '');
  process.stdout.write(JSON.stringify({ kind: 'response', status: r.status, body: String(t).slice(0, 500) }));
}).catch((e) => {
  const name = (e && e.name) || '';
  const code = (e && e.code) || '';
  const isTimeout = name === 'TimeoutError' || name === 'AbortError' || code === 'ABORT_ERR';
  process.stdout.write(JSON.stringify({ kind: 'error', error: isTimeout ? 'timeout' : 'network', message: String((e && e.message) || e) }));
}).finally(() => clearTimeout(timer));
`;

function extractWebhookVars(env: Record<string, string>): Record<string, string> {
  return {
    event: env.IHUI_HOOK_TYPE ?? '',
    workspacePath: env.IHUI_WORKSPACE ?? '',
    sessionId: env.IHUI_SESSION_ID ?? '',
    toolName: env.IHUI_TOOL ?? '',
    toolArgs: env.IHUI_TOOL_INPUT ?? env.IHUI_TOOL_OUTPUT ?? '',
    prompt: env.IHUI_PROMPT ?? '',
    error: env.IHUI_ERROR ?? '',
    reason: env.IHUI_REASON ?? '',
    subagentId: env.IHUI_SUBAGENT_ID ?? '',
    subagentType: env.IHUI_SUBAGENT_TYPE ?? '',
    compactedTokensBefore: env.IHUI_COMPACTED_TOKENS_BEFORE ?? '',
    compactedTokensAfter: env.IHUI_COMPACTED_TOKENS_AFTER ?? '',
    notificationText: env.IHUI_NOTIFICATION_TEXT ?? '',
  };
}

function runWebhookSync(
  entry: HookEntry,
  env: Record<string, string>,
): { exitCode: number; stdout: string; stderr: string } {
  const timeout = entry.timeout ?? 10_000;
  const cfg = {
    url: entry.webhook,
    method: entry.method ?? 'POST',
    headers: entry.headers ?? {},
    body: entry.body ? buildWebhookBody(entry.body, extractWebhookVars(env)) : undefined,
    timeout,
  };
  const result = spawnSync(process.execPath, ['-e', WEBHOOK_SCRIPT], {
    env: { ...process.env, ...env, IHUI_WEBHOOK_CFG: JSON.stringify(cfg) },
    encoding: 'utf-8',
    timeout: timeout + 3000,
    windowsHide: true,
  });
  if (result.error) {
    return { exitCode: 1, stdout: '', stderr: `webhook 执行失败: ${result.error.message}` };
  }
  if (result.status === null) {
    return { exitCode: 1, stdout: '', stderr: 'webhook 超时' };
  }
  const out = typeof result.stdout === 'string' ? result.stdout.trim() : '';
  const parsed = tryParseJson(out);
  if (!isRecord(parsed)) {
    return { exitCode: 1, stdout: '', stderr: 'webhook 响应解析失败' };
  }
  const res = parsed as unknown as WebhookResult;
  if (res.kind === 'response') {
    if (res.status >= 200 && res.status < 300) {
      return { exitCode: 0, stdout: `webhook ${res.status}`, stderr: '' };
    }
    return { exitCode: 1, stdout: '', stderr: `webhook 返回 ${res.status}` };
  }
  if (res.error === 'timeout') {
    return { exitCode: 1, stdout: '', stderr: 'webhook 超时' };
  }
  return { exitCode: 1, stdout: '', stderr: res.message || 'webhook 网络错误' };
}

/** IHUI_TRUST_WORKSPACE 放行只提示一次,免得每条钩子刷一行 */
let workspaceTrustWarned = false;
/** 已提示过的被跳过钩子(按 来源+名字 去重:同一钩子每次工具调用都跑,不能每次都刷) */
const announcedSkips = new Set<string>();

/** 提示走 stderr:不得占用钩子的 stdout/stderr 通道,那两条是钩子结果本身 */
function warnOnce(line: string): void {
  try {
    process.stderr.write(`${line}\n`);
  } catch {
    // 提示写不出去也不影响派发判定
  }
}

/**
 * 派发前的信任判定 —— 只挂在 runHookEntry 这一个执行收口点上。
 *
 * 为什么必须有:配置可以从**工作区**里加载(`loadHooksConfig` 读 `<cwd>/.{ihui,claude,cursor}/
 * hooks.json`),而 command 形态是 `spawnSync(cmd, { shell: true, env: {...process.env} })` ——
 * 没有这道门时,clone 一个陌生仓库并在里面跑 CLI,仓库自带的命令就会带着全部 API key 执行。
 * trust.ts 里这道门早就写好了,只是从来没有被调用(第一轮修的正是这一格)。
 *
 * 第二轮补的是**另一半**:门只问"这个目录在不在清单里",所以一旦某个目录被信任过,
 * 之后往它的 hooks.json 里塞任何命令都不再问一次。这里因此把"现在这份内容"的两个摘要
 * (整束 + 本条声明)一起交给门,由它对着批准时登记的摘要比 —— 见 trust.ts 的第 4 道判据。
 * 摘要在这里现算而不是在 loadHooksConfig 里盖戳:同一份 loadHooksConfig 的输出对象会被
 * deepMergeHooks 逐条 `{...e}` 复制,给每个字段配一份"必须原样穿过合并"的派生值等于多一条
 * 会漂移的路径;而磁盘原树是稳定的单一真相。
 *
 * @returns 跳过原因文案;null = 允许执行
 */
export function hookTrustSkipReason(entry: HookEntry, trustFileText?: string): string | null {
  // 用户主目录里的配置:行为与接线前完全一致(不查门)
  if (entry.source === 'user') return null;
  // 未盖章的条目按 project 处理 —— "来源不明"不构成免检通道。
  // 判定用来源目录而不是 process.cwd():IHUI_HOOKS_CONFIG 可以把配置指到任意目录。
  const folder = entry.sourceFolder ?? process.cwd();
  const { bundleDigest, declarations } = computeHookContentDigests(folder);
  const gate = gateHook(
    {
      name: entry.name,
      bundleDigest,
      // 本条声明不在磁盘束里(程序内自造的钩子)时不传单条摘要 → 门只比束摘要。
      hookName: declarations[entry.name] === undefined ? undefined : entry.name,
      declarationDigest: declarations[entry.name],
    },
    folder,
    trustFileText,
  );
  if (gate.allowed) return null;
  // IHUI_TRUST_WORKSPACE=1 = 非交互场景(CI / 脚本 / 无 TTY)的显式出口。
  // **只免"目录信任"**:免到内容这一层就等于本票没修(一个环境变量把"新塞进来的命令"
  // 也一起放行)。也不免 disabled-hooks:后者是用户逐条关掉的开关,
  // 一个环境变量不该把它复活。
  if (gate.reason === 'folder-not-trusted' && process.env.IHUI_TRUST_WORKSPACE === '1') {
    if (!workspaceTrustWarned) {
      workspaceTrustWarned = true;
      warnOnce(`⚠ IHUI_TRUST_WORKSPACE=1 已生效:本项目会话内的项目钩子一律按"已信任"执行(首个来源目录 ${folder})`);
    }
    return null;
  }
  return gate.detail ?? `hook "${entry.name}" 未通过信任门控`;
}

function runHookEntry(
  entry: HookEntry,
  env: Record<string, string>,
): { exitCode: number; stdout: string; stderr: string } {
  // 两种形态过**同一道**门:判据只写一份。webhook 的外泄面不比 command 小 ——
  // IHUI_TOOL_INPUT / IHUI_TOOL_OUTPUT 会被原样 POST 到配置里的外部 URL
  // (见 extractWebhookVars 的 toolArgs),等价于"把工具输入输出发给外人"。
  // 上一版只在 command 分支查门,所以 clone 陌生仓库 + 仓库自带 webhook 钩子
  // 仍然会在无人知晓的情况下把会话内容送到外部地址。
  //
  // 先短路"两者皆空"的条目:它没有任何外部副作用,不值得为它查门并刷一行提示。
  if (!entry.webhook && !entry.command) {
    return { exitCode: 0, stdout: '', stderr: '' };
  }
  const skipReason = hookTrustSkipReason(entry);
  if (skipReason) {
    // 跳过 ≠ 失败:exitCode 必须给 0。返回非 0 会让 blockOnError 的钩子反过来
    // 阻断工具调用,用户看到的是"我的工具坏了",而不是真实原因"这个目录没被信任"。
    const key = `${entry.source ?? 'unstamped'}::${entry.name}`;
    if (!announcedSkips.has(key)) {
      announcedSkips.add(key);
      warnOnce(`⚠ 已跳过钩子 "${entry.name}":${skipReason}`);
    }
    return { exitCode: 0, stdout: '', stderr: skipReason };
  }
  if (entry.webhook) {
    return runWebhookSync(entry, env);
  }
  const result = spawnSync(entry.command!, {
    shell: true,
    encoding: 'utf-8',
    timeout: entry.timeout ?? 10_000,
    env: { ...process.env, ...env },
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
  });
  const timedOut = result.signal === 'SIGTERM' && result.status === null;
  return {
    exitCode: timedOut ? 124 : (result.status ?? 1),
    stdout: typeof result.stdout === 'string' ? result.stdout.trim() : '',
    stderr: typeof result.stderr === 'string' ? result.stderr.trim() : '',
  };
}

export function runPreToolCall(toolName: string, input: unknown): HookResult {
  const config = loadHooks();
  const hooks = config.preToolCall ?? [];
  for (const entry of hooks) {
    if (!matchesTool(entry, toolName)) continue;
    const r = runHookEntry(entry, {
      IHUI_HOOK_TYPE: 'preToolCall',
      IHUI_TOOL: toolName,
      IHUI_TOOL_INPUT: JSON.stringify(input ?? {}),
    });
    const blockOnError = entry.blockOnError ?? true;
    if (blockOnError && r.exitCode !== 0) {
      return {
        proceed: false,
        reason: `钩子 "${entry.name}" 阻断: ${r.stderr || r.stdout || 'exit ' + r.exitCode}`,
      };
    }
  }
  return { proceed: true };
}

export function runPostToolCall(toolName: string, output: unknown): HookResult {
  const config = loadHooks();
  const hooks = config.postToolCall ?? [];
  for (const entry of hooks) {
    if (!matchesTool(entry, toolName)) continue;
    const r = runHookEntry(entry, {
      IHUI_HOOK_TYPE: 'postToolCall',
      IHUI_TOOL: toolName,
      IHUI_TOOL_OUTPUT: JSON.stringify(output ?? {}),
    });
    const blockOnError = entry.blockOnError ?? false;
    if (blockOnError && r.exitCode !== 0) {
      return {
        proceed: false,
        reason: `postToolCall 钩子 "${entry.name}" 阻断: ${r.stderr || r.stdout || 'exit ' + r.exitCode}`,
      };
    }
  }
  return { proceed: true };
}

export function runSessionStartHooks(config: HooksConfig | null, ctx: SessionHookContext): HookResult {
  if (!config?.sessionStart) return { proceed: true };
  for (const entry of config.sessionStart) {
    const r = runHookEntry(entry, {
      IHUI_HOOK_TYPE: 'sessionStart',
      IHUI_WORKSPACE: ctx.workspacePath,
      IHUI_SESSION_ID: ctx.sessionId ?? '',
    });
    const blockOnError = entry.blockOnError ?? true;
    if (blockOnError && r.exitCode !== 0) {
      return {
        proceed: false,
        reason: `sessionStart 钩子 "${entry.name}" 阻断: ${r.stderr || r.stdout || 'exit ' + r.exitCode}`,
      };
    }
  }
  return { proceed: true };
}

export function runSessionEndHooks(config: HooksConfig | null, ctx: SessionHookContext): void {
  if (!config?.sessionEnd) return;
  for (const entry of config.sessionEnd) {
    try {
      runHookEntry(entry, {
        IHUI_HOOK_TYPE: 'sessionEnd',
        IHUI_WORKSPACE: ctx.workspacePath,
        IHUI_SESSION_ID: ctx.sessionId ?? '',
      });
    } catch {
      // sessionEnd 失败不阻塞退出
    }
  }
}

const TOOL_EVENTS: ReadonlySet<HookEvent> = new Set(['preToolCall', 'postToolCall', 'postToolUseFailure']);

function isToolEvent(event: HookEvent): boolean {
  return TOOL_EVENTS.has(event);
}

function defaultBlockOnError(event: HookEvent): boolean {
  return event === 'preToolCall' || event === 'sessionStart';
}

function buildHookEnv(event: HookEvent, ctx: HookContext): Record<string, string> {
  const env: Record<string, string> = { IHUI_HOOK_TYPE: event };
  if (ctx.workspacePath !== undefined) env.IHUI_WORKSPACE = ctx.workspacePath;
  if (ctx.sessionId !== undefined) env.IHUI_SESSION_ID = ctx.sessionId;
  if (ctx.toolName !== undefined) env.IHUI_TOOL = ctx.toolName;
  if (ctx.toolArgs !== undefined) env.IHUI_TOOL_INPUT = JSON.stringify(ctx.toolArgs ?? {});
  if (ctx.toolResult !== undefined) env.IHUI_TOOL_OUTPUT = JSON.stringify(ctx.toolResult ?? {});
  if (ctx.prompt !== undefined) env.IHUI_PROMPT = ctx.prompt;
  if (ctx.error !== undefined) env.IHUI_ERROR = ctx.error;
  if (ctx.reason !== undefined) env.IHUI_REASON = ctx.reason;
  if (ctx.subagentId !== undefined) env.IHUI_SUBAGENT_ID = ctx.subagentId;
  if (ctx.subagentType !== undefined) env.IHUI_SUBAGENT_TYPE = ctx.subagentType;
  if (ctx.compactedTokensBefore !== undefined) env.IHUI_COMPACTED_TOKENS_BEFORE = String(ctx.compactedTokensBefore);
  if (ctx.compactedTokensAfter !== undefined) env.IHUI_COMPACTED_TOKENS_AFTER = String(ctx.compactedTokensAfter);
  if (ctx.notificationText !== undefined) env.IHUI_NOTIFICATION_TEXT = ctx.notificationText;
  // P2-4 Turn 级事件字段
  if (ctx.turnNumber !== undefined) env.IHUI_TURN_NUMBER = String(ctx.turnNumber);
  if (ctx.maxTurns !== undefined) env.IHUI_MAX_TURNS = String(ctx.maxTurns);
  if (ctx.totalTurns !== undefined) env.IHUI_TOTAL_TURNS = String(ctx.totalTurns);
  if (ctx.stopReason !== undefined) env.IHUI_STOP_REASON = ctx.stopReason;
  return env;
}

/**
 * 通用 hook 分发:按事件类型加载对应配置并执行所有匹配的钩子。
 * 钩子失败时按 blockOnError 决定是否阻断(默认 preToolCall/sessionStart 阻断,其余仅通知)。
 * 任何异常均吞掉返回 proceed=true,确保 hook 故障不影响主流程。
 */
export function runHook(event: HookEvent, ctx: HookContext): HookResult {
  try {
    const config = loadHooks();
    const hooks = config[event] ?? [];
    const env = buildHookEnv(event, ctx);
    for (const entry of hooks) {
      if (isToolEvent(event) && ctx.toolName && !matchesTool(entry, ctx.toolName)) continue;
      const r = runHookEntry(entry, env);
      const blockOnError = entry.blockOnError ?? defaultBlockOnError(event);
      if (blockOnError && r.exitCode !== 0) {
        return {
          proceed: false,
          reason: `${event} 钩子 "${entry.name}" 阻断: ${r.stderr || r.stdout || 'exit ' + r.exitCode}`,
        };
      }
    }
    return { proceed: true };
  } catch {
    return { proceed: true };
  }
}

// ============================================================================
// Hooks 目录自动发现(Wave 3 W3-4,2026-07-22 立)
// re-export discovery.ts 作为统一入口,供 commands/hooks.ts enable/disable 使用
// 完整沙箱执行见 commands/hooks-auto.ts(registerHooksAutoCommand)
// ============================================================================
export {
  discoverHooks,
  listDiscoveredHooks,
  enableHook,
  disableHook,
  getHooksDirs,
  type DiscoveredHook,
  type DiscoveredHookType,
} from './discovery.js';
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
