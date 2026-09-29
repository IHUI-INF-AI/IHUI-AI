// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 自定义命令 —— 加载与展开的**唯一**实现(台账号 G-814413,AGENTS §24 已由用户 2026-09-29 拍板)。
 *
 * 四条硬约束与本文件的对应关系(逐条可查,勿在别处另建):
 *  1. `$ARGUMENTS` 与 `$1..$n` 的插值只在本文件的 `expandCustomCommandPrompt()` 里发生一处;
 *     正文没有任何占位符而用户又给了参数时,追加 `User arguments:` 段(与上游
 *     `zcode/apps/zcode-cli/packages/cli/src/custom-command-expand.ts:41-43` 同语义)。
 *     含**不支持的动态 shell**(`!`…`` 或 ```! 围栏块)⇒ **抛错**,绝不静默丢弃那一段。
 *  2. 保留名保护复用 `slash-registry.ts` 的 `getAllSlashNames()` / `findSlashCommand()` ——
 *     本文件**不抄第二份名单**(名单一抄就会腐烂,AGENTS §4 对 `RN_ONLY_BRAND_KEYS` 记过同一课)。
 *  3. 校验/探测阶段**绝不执行内嵌 shell**:本模块根本没有执行通道(不 import child_process),
 *     而 `probeCustomCommand()` 只做「保留名检查 + 读盘」这一对,刻意不调展开 ——
 *     拿展开去探测等于把校验阶段变成执行阶段。哨兵文件用例见
 *     `apps/cli/tests/custom-command-expand.test.ts`。
 *  4. 失败不静默:每一种失败都带一句**可操作**文案(`describeCustomCommandFailure()`),文案走
 *     i18n(`cli.custom.*`,五语言同批补齐),代码里不硬编码中文(守门 70 的扫描面含 apps/cli/src)。
 *
 * 与上游的一处**刻意分歧**:上游 `$3` 越界时静默替换成空串
 * (`custom-command-expand.ts:36-39` 的 `?? ""`),而硬约束 4 要求"参数不足 ⇒ 回可操作文案",
 * 所以这里改成抛 `missing_arguments`。缺主语的指令发给模型只会得到一次猜测,那不是"降级"而是"编造"。
 *
 * 上游未纳入本票的两格(如实登记,不是遗漏):skills 前言(`:58-64`)与 shell 展开本身 ——
 * 前者要接技能系统、后者要接审批链,都超出"让用户能存自定义命令"的已批准范围(AGENTS §24)。
 *
 * 落点(§15b 项目外落点唯一制):`~/.ihui/commands/<name>.md`,由 `getIhuiRoot()` 派生,
 * 不新增第五个落点、不往仓里写用户命令文件。写盘走仓内既有原子写出口
 * (`../util/atomic-write.ts` 的 captureWriteBaseline + commitAtomicWrite),不手搓 tmp+rename。
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import { t } from '../i18n/index.js';
import { getIhuiRoot } from '../plugins/paths.js';
import { captureWriteBaseline, commitAtomicWrite } from '../util/atomic-write.js';
import { findSlashCommand, getAllSlashNames } from './slash-registry.js';

/** 全部参数的占位符(唯一写法之一,与上游逐字同形) */
const ALL_ARGUMENTS_TOKEN = '$ARGUMENTS';
/** 位置参数 $1..$n */
const POSITIONAL_ARGUMENT_PATTERN = /\$(\d+)/g;
/** 两型占位符合遍一次扫完($ARGUMENTS ∪ $<数字>)—— 见 expandCustomCommandPrompt 内的合遍理由 */
const TEMPLATE_PATTERN = /\$(?:ARGUMENTS|(\d+))/g;
/** 不支持的动态 shell:行内 `!`cmd`` 形态 */
const INLINE_SHELL_PATTERN = /!`[^`]*`/;
/** 不支持的动态 shell:```! 围栏块形态 */
const FENCED_SHELL_PATTERN = /```!\s*[\s\S]*?```/;
/** 正文无占位符时追加的分段标题(模型侧协议文本,非界面文案 ⇒ 不进 i18n) */
const USER_ARGUMENTS_HEADING = 'User arguments:';
/** 提示词抬头两行(同为模型侧协议文本,与上游 `:50-52` 同形) */
const PROMPT_HEADER_RUN = 'Run custom command';
const PROMPT_HEADER_SOURCE = 'Command source';
/** 命令文件后缀与存放目录名 */
const COMMAND_FILE_EXT = '.md';
const COMMANDS_DIR_NAME = 'commands';
/** 名字形态:小写字母开头,仅小写字母/数字/-/_。同时把路径分隔符挡在外面(见 loadCustomCommand)。 */
const COMMAND_NAME_PATTERN = /^[a-z][a-z0-9]*([-_][a-z0-9]+)*$/;
/** frontmatter 里唯一被读取的字段 */
const DESCRIPTION_LINE_PATTERN = /^description\s*:\s*(.*)$/;

/** 失败种类 —— 每一种都有一句可操作文案,没有一种会被静默吞掉 */
export type CustomCommandErrorCode =
  | 'not_found'
  | 'reserved_name'
  | 'invalid_name'
  | 'empty_body'
  | 'unsupported_shell'
  | 'missing_arguments';

const FAILURE_MESSAGE_KEYS: Record<CustomCommandErrorCode, string> = {
  not_found: 'cli.custom.unknown',
  reserved_name: 'cli.custom.reserved',
  invalid_name: 'cli.custom.invalidName',
  empty_body: 'cli.custom.emptyBody',
  unsupported_shell: 'cli.custom.unsupportedShell',
  missing_arguments: 'cli.custom.missingArgs',
};

/**
 * 失败 → 用户可读的可操作文案。唯一映射表在 `FAILURE_MESSAGE_KEYS`,取词一律经 `t()`。
 * 参数不足等形态把 `required`/`given` 一起递给语言包,让文案自己决定语序。
 */
export function describeCustomCommandFailure(
  code: CustomCommandErrorCode,
  commandName: string,
  details: Readonly<Record<string, string>> = {},
): string {
  const params: Record<string, string> = { name: commandName, ...details };
  return t(FAILURE_MESSAGE_KEYS[code], params);
}

/**
 * 自定义命令的失败 —— 携带 `code` 而非靠 message 文本判型。
 * 上游用 `error.message` 正则匹配"是不是 not found"(`prompt-command.ts:460-469`),
 * 判据与被判内容都住在一句话里,改文案就能把探测判据改歪;这里用 `instanceof` + `code`。
 */
export class CustomCommandError extends Error {
  readonly code: CustomCommandErrorCode;
  readonly commandName: string;
  readonly details: Readonly<Record<string, string>>;

  constructor(
    code: CustomCommandErrorCode,
    commandName: string,
    details: Readonly<Record<string, string>> = {},
  ) {
    super(describeCustomCommandFailure(code, commandName, details));
    this.name = 'CustomCommandError';
    this.code = code;
    this.commandName = commandName;
    this.details = details;
  }
}

/** 已加载的一条自定义命令 */
export interface CustomCommandDefinition {
  readonly name: string;
  readonly description: string;
  readonly body: string;
  readonly source: string;
  readonly scope: 'user';
}

/** 展开结果 */
export interface CustomCommandExpansion {
  readonly prompt: string;
  readonly argumentCount: number;
  readonly usedArgumentsPlaceholder: boolean;
}

/**
 * 分派落位的结果 —— 判别联合,`handled: false` 一定带**为什么**没落位,
 * 调用方(repl)据此决定是回落内置分支还是念"未定义"文案。
 */
export type CustomCommandInvocation =
  | {
      readonly handled: false;
      readonly reason: 'reserved' | 'not_found';
      /** reason 为 not_found 时给可操作文案;reserved 时为空,因为内置分支会自己处理 */
      readonly message: string;
    }
  | {
      readonly handled: true;
      readonly prompt: string;
      readonly argumentCount: number;
      readonly usedArgumentsPlaceholder: boolean;
    };

/** 保存入参 */
export interface SaveCustomCommandInput {
  readonly name: string;
  readonly description?: string;
  readonly body: string;
}

/** 去掉可能带的 '/' 前缀并 trim —— 内置名与用户输入都走这里归一,避免两套写法。 */
function normalizeCommandName(raw: string): string {
  return raw.trim().replace(/^\/+/, '');
}

/** 用户级存放目录:`~/.ihui/commands` */
export function getCustomCommandsDir(): string {
  return path.join(getIhuiRoot(), COMMANDS_DIR_NAME);
}

/** 名字形态校验(不含保留名判据):load 与 save 都用它,把 `..`/`/` 这类形态挡在拼路径之前。 */
function assertCustomCommandNameShape(name: string): string {
  const normalized = normalizeCommandName(name);
  if (!COMMAND_NAME_PATTERN.test(normalized)) {
    throw new CustomCommandError('invalid_name', normalized || name);
  }
  return normalized;
}

/**
 * 是不是内置保留名(硬约束 2)。**名单现读 `getAllSlashNames()`**,不缓存、不抄第二份 ——
 * 注册表加一条命令这里自动跟着变;缓存会让"新内置名"对保护判据隐身一整个进程生命周期。
 */
export function isReservedCustomCommandName(name: string): boolean {
  const target = normalizeCommandName(name);
  if (target.length === 0) return false;
  return getAllSlashNames().some((entry) => normalizeCommandName(entry) === target);
}

/** 撞名时点名"撞了谁":别名相撞也回报其正主(如 /quit → exit),而不是把用户输入原样念一遍。 */
function findReservedOwner(name: string): string {
  return findSlashCommand(normalizeCommandName(name))?.name ?? normalizeCommandName(name);
}

/** 内容里是否含不支持的动态 shell 形态(纯字面判据,不执行任何东西)。 */
export function usesUnsupportedDynamicShell(content: string): boolean {
  return INLINE_SHELL_PATTERN.test(content) || FENCED_SHELL_PATTERN.test(content);
}

/** 含不支持的动态 shell ⇒ 抛错(硬约束 1 的"不得静默丢弃")。 */
function assertNoUnsupportedDynamicShell(name: string, content: string): void {
  if (usesUnsupportedDynamicShell(content)) {
    throw new CustomCommandError('unsupported_shell', name);
  }
}

/** 按空格切参数,识别单/双引号与反斜杠转义(与上游 `:66-105` 同语义)。 */
export function splitCustomCommandArguments(input: string): string[] {
  const args: string[] = [];
  let current = '';
  let escaping = false;
  let quote: "'" | '"' | null = null;

  for (const char of input) {
    if (escaping) {
      current += char;
      escaping = false;
      continue;
    }
    if (char === '\\') {
      escaping = true;
      continue;
    }
    if (quote) {
      if (char === quote) quote = null;
      else current += char;
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }
    if (/\s/.test(char)) {
      if (current.length > 0) {
        args.push(current);
        current = '';
      }
      continue;
    }
    current += char;
  }

  if (escaping) current += '\\';
  if (current.length > 0) args.push(current);
  return args;
}

/** 正文引用到的最大位置参数下标(`$0` 不是合法槽位,不计入需求)。 */
function maxReferencedPositional(content: string): number {
  let max = 0;
  for (const match of content.matchAll(POSITIONAL_ARGUMENT_PATTERN)) {
    const index = Number(match[1]);
    if (Number.isFinite(index) && index > max) max = index;
  }
  return max;
}

/**
 * 读一条自定义命令。只做"读盘 + 解析",**不展开、不执行**(硬约束 3)。
 * 名字先过形态校验再拼路径 —— 未校验的 `..`/绝对路径会把读盘变成越界读。
 */
export function loadCustomCommand(name: string): CustomCommandDefinition {
  const normalized = assertCustomCommandNameShape(name);
  const dir = getCustomCommandsDir();
  const source = path.join(dir, `${normalized}${COMMAND_FILE_EXT}`);

  let raw: string;
  try {
    raw = fs.readFileSync(source, 'utf-8');
  } catch (e) {
    if (isNotFound(e)) {
      throw new CustomCommandError('not_found', normalized, { dir });
    }
    throw e; // 权限/IO 一类失败继续冒泡:把"读不到"报成"没这条命令"会盖掉真因
  }

  const parsed = parseCustomCommandFile(raw);
  if (parsed.body.trim().length === 0) {
    throw new CustomCommandError('empty_body', normalized, { path: source });
  }
  return { name: normalized, description: parsed.description, body: parsed.body, source, scope: 'user' };
}

function isNotFound(e: unknown): boolean {
  return typeof e === 'object' && e !== null && 'code' in e && (e as { code: unknown }).code === 'ENOENT';
}

/** 解析 frontmatter:只有文件以 `---` 行开始且有配对的结束行时才当 frontmatter,否则整份是正文。 */
function parseCustomCommandFile(raw: string): { description: string; body: string } {
  const lines = raw.replace(/\r\n/g, '\n').split('\n');
  if (lines[0]?.trim() !== '---') return { description: '', body: raw };
  const end = lines.findIndex((line, i) => i > 0 && line.trim() === '---');
  if (end < 0) return { description: '', body: raw }; // 未闭合 ⇒ 不猜,整份按正文处理

  let description = '';
  for (const line of lines.slice(1, end)) {
    const m = DESCRIPTION_LINE_PATTERN.exec(line.trim());
    if (m) description = (m[1] ?? '').trim();
  }
  return { description, body: lines.slice(end + 1).join('\n') };
}

/**
 * 展开成发给模型的提示词(硬约束 1 的唯一落点)。
 * 判序:先 shell 判据、再算参数需求 —— 两条都是纯字面,没有任何"先跑一下看看"的通道。
 */
export function expandCustomCommandPrompt(
  definition: CustomCommandDefinition,
  argsRaw: string,
): CustomCommandExpansion {
  assertNoUnsupportedDynamicShell(definition.name, definition.body);

  const args = argsRaw.trim();
  const positional = splitCustomCommandArguments(args);
  const required = maxReferencedPositional(definition.body);
  if (positional.length < required) {
    throw new CustomCommandError('missing_arguments', definition.name, {
      required: String(required),
      given: String(positional.length),
    });
  }

  let usedArgumentsPlaceholder = false;
  // 两种占位符在**一遍**替换里完成:上游是 replaceAll('$ARGUMENTS') 再 replace($n) 两遍
  // (`custom-command-expand.ts:34-39`),于是用户参数里带的 `$1` 会被第二轮再展开一次 ——
  // 参数内容是数据,不该成为第二次模板输入。合遍后替换进去的文本永远不会被重新扫描。
  const substituted = definition.body.replace(TEMPLATE_PATTERN, (match, digits?: string) => {
    usedArgumentsPlaceholder = true;
    if (match === ALL_ARGUMENTS_TOKEN) return args;
    const slot = Number(digits);
    // 上面已保证 slot ≤ positional.length 且 slot ≥ 1 才算需求($0 不占名额),取不到只会是 $0
    return slot >= 1 ? (positional[slot - 1] ?? '') : '';
  });

  let body = substituted;
  if (args.length > 0 && !usedArgumentsPlaceholder) {
    body = `${substituted.trimEnd()}\n\n${USER_ARGUMENTS_HEADING}\n${args}`;
  }

  const prompt = [
    `${PROMPT_HEADER_RUN} /${definition.name}.`,
    `${PROMPT_HEADER_SOURCE}: ${definition.scope}/${path.basename(definition.source)}.`,
    '',
    body.trim(),
  ].join('\n');

  return { prompt, argumentCount: positional.length, usedArgumentsPlaceholder };
}

/**
 * 探测"这个名字能不能落成一条自定义命令"(硬约束 2 + 3 的交汇处)。
 *
 * 判序照抄上游 `prompt-command.ts:460-476`:**保留名先问,再读盘**。
 * 探测刻意用「保留名检查 + load」这一对,而不是 `buildCustomCommandInvocation()` ——
 * 后者会走展开与 shell 判据,拿它探测等于在校验阶段碰执行路径。
 * 只有 `not_found` 算不可解析;`empty_body`/IO 失败继续冒泡,否则一句"没这条命令"会盖掉真因。
 */
export function probeCustomCommand(name: string): boolean {
  const normalized = normalizeCommandName(name);
  if (isReservedCustomCommandName(normalized)) return false;
  try {
    loadCustomCommand(normalized);
    return true;
  } catch (e) {
    if (e instanceof CustomCommandError && e.code === 'not_found') return false;
    throw e;
  }
}

/**
 * REPL 分派用的唯一入口。返回值不是"提示词或 undefined"而是判别联合,
 * 因为"用户拼错了自定义命令名"与"这是内置命令"必须能被调用方区分开(硬约束 4):
 * `not_found` 带可操作文案,`reserved` 让调用方原样落回内置分支。
 * 其余失败(动态 shell / 参数不足 / 空正文 / 读盘失败)一律抛 `CustomCommandError` —— 
 * 它们的 message 已经是可操作文案,调用方念出来即可,不许吞。
 *
 * 内置名永远优先:`reserved` 分支在读盘之前返回,即使有人在 `~/.ihui/commands/` 里
 * 手放一个 `model.md`,它也永远不会被送到模型 —— 劫持在结构上不可能,不依赖调用方记得判。
 */
export function buildCustomCommandInvocation(
  name: string,
  argsRaw: string,
): CustomCommandInvocation {
  const normalized = normalizeCommandName(name);
  if (isReservedCustomCommandName(normalized)) {
    return { handled: false, reason: 'reserved', message: '' };
  }

  let definition: CustomCommandDefinition;
  try {
    definition = loadCustomCommand(normalized);
  } catch (e) {
    if (e instanceof CustomCommandError && e.code === 'not_found') {
      return { handled: false, reason: 'not_found', message: e.message };
    }
    throw e;
  }

  const expansion = expandCustomCommandPrompt(definition, argsRaw);
  return {
    handled: true,
    prompt: expansion.prompt,
    argumentCount: expansion.argumentCount,
    usedArgumentsPlaceholder: expansion.usedArgumentsPlaceholder,
  };
}

/**
 * 保存一条自定义命令(本票"让用户能存"的那一半)。
 * 顺序:名字形态 → 保留名 → 空正文 → 动态 shell → 落盘。四道闸都在写盘之前,
 * 所以磁盘上永远不会出现一条"存下了但永远跑不了"的命令(那才是真正的静默)。
 */
export function saveCustomCommand(input: SaveCustomCommandInput): { name: string; path: string } {
  const name = assertCustomCommandNameShape(input.name);
  if (isReservedCustomCommandName(name)) {
    throw new CustomCommandError('reserved_name', name, { owner: findReservedOwner(name) });
  }
  const body = input.body;
  const source = path.join(getCustomCommandsDir(), `${name}${COMMAND_FILE_EXT}`);
  if (body.trim().length === 0) {
    throw new CustomCommandError('empty_body', name, { path: source });
  }
  assertNoUnsupportedDynamicShell(name, body);

  commitAtomicWrite(
    captureWriteBaseline(source),
    serializeCustomCommand(input.description, body),
  );
  return { name, path: source };
}

/** 序列化:有描述才写 frontmatter,避免给每条命令都挂一个空块;描述折成单行,保证 frontmatter 可再解析。 */
function serializeCustomCommand(description: string | undefined, body: string): string {
  const oneLine = (description ?? '').replace(/\s*\n\s*/g, ' ').trim();
  const head = oneLine.length > 0 ? `---\ndescription: ${oneLine}\n---\n\n` : '';
  return `${head}${body.replace(/\s+$/, '')}\n`;
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
