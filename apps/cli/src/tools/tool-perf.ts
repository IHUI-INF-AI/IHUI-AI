// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Bash 命令遥测的有界化原语(吸收 G-937979)。
 *
 * 上游出处:`apps/zcode-cli/packages/core/src/tool/handlers/tool-perf.ts:21-31,33-80`
 *   - `commandHash`:sha256 只吃**首尾各 4096 字符**(中间段永不进 hash),16 hex 截断;
 *   - `classifyCommand`:分类只看**前 2048 字符**,不为埋点复制/扫描完整命令,
 *     也避免正文里的 "npm test" 误导分类;
 *   - `classifySafeCommandIdentity`:安全命令名只允许公开注册表里的**静态可执行文件名**,
 *     动态构造/超长/判不出的一律降级 "other",绝不上传原始 token。
 *
 * 三条边界各有一个量纲:hash 吃首尾 4096、分类吃前 2048、身份解析吃 8k —— 任何一条
 * 超界的输入都不允许把 O(命令长度) 的成本带进遥测路径(8MB heredoc 也必须常数时间出结论)。
 *
 * 我方落点说明:本文件是纯函数模块(与上游同名的 tool-perf 同型)。CLI 的遥测发射点在
 * `commands/agent.ts` 的 `tool_call_completed`(该文件属并行车道,不在此接线);
 * 接入即把 `buildBashCommandTelemetry(command)` 的四个字段(category/count/name/hash)
 * 并进该事件的 props —— 字段口径与上游 `bash-output.ts` 的 command telemetry 对齐。
 */

import { createHash } from 'node:crypto';

/** 遥测里命令 hash 的展示长度(16 hex,碰撞空间对排障足够) */
const COMMAND_HASH_LENGTH = 16;
/** hash 只吃首尾各 4096 字符:中间段(heredoc 正文等)永不进 hash */
const COMMAND_HASH_EDGE_CHARS = 4096;
/** 分类只看前 2048 字符:避免为埋点扫描完整命令,也避免正文关键词误导分类 */
const COMMAND_CLASSIFY_PREFIX_CHARS = 2048;
/** 超过这个长度的命令不做身份解析(宁可少一个 count/name,不为遥测制造 O(n) 扫描) */
const MAX_COMMAND_IDENTITY_PARSE_CHARS = 8 * 1024;

/**
 * 命令指纹:长度 + 首尾 4096 窗口的 sha256。
 *
 * 为什么 hash 吃首尾而不是全文:遥测只需要"是不是同一条命令"的等值判据,不需要全文。
 * 中段是 heredoc/inline script 的主体 —— 让它进 hash 等于为了埋点把 8MB 正文再复制一遍,
 * 且 hash 不脱敏,长正文里的敏感行会随 hash 输入面扩大(虽不可逆,输入面仍应最小)。
 * `length` 参与输入:不同长度的命令即使首尾相同也不同指纹。
 */
export function commandHash(command: string): string {
  const hash = createHash('sha256');
  hash.update(String(command.length));
  hash.update('\0');
  hash.update(command.slice(0, COMMAND_HASH_EDGE_CHARS));
  if (command.length > COMMAND_HASH_EDGE_CHARS) {
    hash.update('\0');
    hash.update(command.slice(-COMMAND_HASH_EDGE_CHARS));
  }
  return hash.digest('hex').slice(0, COMMAND_HASH_LENGTH);
}

/**
 * 命令类别:只看前 2048 字符(有界),表驱动,顺序即优先级。
 * 判不出 ⇒ "other";空命令 ⇒ "empty"。表与上游 `tool-perf.ts` 同形,覆盖本仓工具链
 * (pnpm/npm/git/rg/curl 等);类别只进遥测,不参与任何判定。
 */
export function classifyCommand(command: string): string {
  const normalized = command.slice(0, COMMAND_CLASSIFY_PREFIX_CHARS).trimStart().toLowerCase();
  if (!normalized) return 'empty';
  if (/\b(?:npm|pnpm|yarn|bun)\s+(?:test|run\s+test|vitest|jest)\b/u.test(normalized)) return 'test';
  if (/\b(?:npm|pnpm|yarn|bun)\s+(?:install|add|update|remove)\b/u.test(normalized)) return 'package';
  if (/\bgit\b/u.test(normalized)) return 'git';
  if (/\b(?:rg|grep|find|fd)\b/u.test(normalized)) return 'search';
  if (/\b(?:npm|pnpm|yarn|bun)\s+(?:run\s+)?(?:build|compile)\b/u.test(normalized)) return 'build';
  if (/\b(?:curl|wget|gh\s+api)\b/u.test(normalized)) return 'network';
  return 'other';
}

/**
 * 公开命令注册表:允许进入遥测 `name` 字段的**静态可执行文件名**闭集。
 *
 * 上游用的是生成的补全注册表(fig-2.692.3 trie,64KB+),本仓不移植那份体量 ——
 * 这里是一份手维护的策展闭集(常见公开工具名,含 sandbox profile 白名单里的成员)。
 * 关键契约不在表的大小,而在判定方向:**表外一律 "other"**。自定义脚本名
 * (`./my-script.sh`)、动态表达式(`$(...)`)、判不出的 token 永远不上传。
 */
const BASH_COMMAND_REGISTRY: Readonly<Record<string, true>> = Object.freeze({
  awk: true, bash: true, bun: true, bunx: true, cargo: true, cat: true, chmod: true,
  chown: true, cmake: true, cmp: true, comm: true, cp: true, curl: true, cut: true,
  date: true, deno: true, df: true, diff: true, dirname: true, docker: true, dotnet: true,
  du: true, echo: true, env: true, eslint: true, fd: true, file: true, find: true,
  go: true, grep: true, gunzip: true, gzip: true, head: true, hostname: true, java: true,
  javac: true, jest: true, jq: true, kubectl: true, less: true, ln: true, ls: true,
  make: true, mkdir: true, more: true, mv: true, node: true, npm: true, npx: true,
  pnpm: true, prettier: true, printf: true, pwd: true, python: true, python3: true,
  pip: true, pip3: true, rg: true, rm: true, rmdir: true, ruby: true, sed: true,
  sh: true, sort: true, stat: true, tail: true, tar: true, touch: true, tr: true,
  tsc: true, tsx: true, 'ts-node': true, unzip: true, vi: true,
  vim: true, vitest: true, wget: true, which: true, whoami: true, xz: true, yarn: true,
  zsh: true, gh: true, git: true,
});

/** {@link classifySafeCommandIdentity} 的产出:count/name 两个字段直接并进遥测 props。 */
export interface SafeCommandIdentity {
  /** 拆得出的命令段数;超长跳过解析时缺省(宁可少一个 count,不为此扫 8MB) */
  count?: number;
  /** 注册表内的静态名 / 'compound' / 'empty' / 'other'(表外与判不出的唯一去向) */
  name: string;
}

/** 安全命令名允许的 Windows 可执行后缀(basename 带后缀时剥掉再查表) */
const WINDOWS_EXEC_SUFFIX_RE = /\.(?:exe|cmd|bat)$/i;

/**
 * 保守的静态命令形状分析(代替上游的 unbash parser —— 本仓无该依赖,且遥测侧
 * 不值得为它加一条解析器依赖)。契约是**判不准就降级**,方向永远 fail-closed:
 *   - 任何动态构造(`$`、反引号、进程替换)⇒ unreliable;
 *   - heredoc(`<<`)、子 shell/花括号组 ⇒ unreliable;
 *   - 引号未闭合 ⇒ unreliable;
 *   - 引号内的分隔符**不**拆段(`git commit -m "a; b"` 是一条命令);
 *   - `2>&1` 这类 fd 复制不算段;`#` 注释整段跳过。
 * unreliable 时调用方输出 "other",count 仍尽量给出(仅遥测展示,误差无害)。
 */
interface StaticShapeAnalysis {
  count: number;
  reliable: boolean;
  firstName: string;
}

function analyzeStaticCommandShape(command: string): StaticShapeAnalysis {
  let reliable = true;
  let count = 0;
  let firstName = '';
  let inSingle = false;
  let inDouble = false;
  let escaped = false;
  let currentToken = '';
  let hasCurrentToken = false;
  let sawTokenThisSegment = false;
  let namedThisSegment = false;

  const commitToken = (): void => {
    if (!hasCurrentToken) return;
    hasCurrentToken = false;
    const isAssignment = /^[A-Za-z_][A-Za-z0-9_]*=/.test(currentToken);
    if (!namedThisSegment && !(isAssignment && !sawTokenThisSegment)) {
      // 段内第一个非 env-assignment token 是命令名候选(FOO=bar git status ⇒ git)
      if (count === 0) firstName = currentToken;
      namedThisSegment = true;
    }
    sawTokenThisSegment = true;
    currentToken = '';
  };
  const discardToken = (): void => {
    hasCurrentToken = false;
    currentToken = '';
  };
  const endSegment = (): void => {
    commitToken();
    if (!sawTokenThisSegment) reliable = false; // 空段(连续分隔符/前导分隔符)= 判不准
    count += 1;
    sawTokenThisSegment = false;
    namedThisSegment = false;
  };

  for (let i = 0; i < command.length; i++) {
    const ch = command[i]!;
    if (escaped) {
      currentToken += ch;
      hasCurrentToken = true;
      escaped = false;
      continue;
    }
    if (inSingle) {
      if (ch === "'") inSingle = false;
      else {
        currentToken += ch;
        hasCurrentToken = true;
      }
      continue;
    }
    if (inDouble) {
      if (ch === '"') inDouble = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '$') { reliable = false; break; } // 双引号内的 $ 一律按动态处理
      else {
        currentToken += ch;
        hasCurrentToken = true;
      }
      continue;
    }
    switch (ch) {
      case '\\':
        escaped = true;
        break;
      case "'":
        inSingle = true;
        break;
      case '"':
        inDouble = true;
        break;
      case '$':
      case '`':
        reliable = false;
        break;
      case '<': {
        const next = command[i + 1];
        if (next === '<' || next === '(') { reliable = false; break; } // heredoc/进程替换
        if (/^\d+$/.test(currentToken)) discardToken(); // 2<&1 的 fd 数字不是词
        commitToken();
        break;
      }
      case '>': {
        if (command[i + 1] === '(') { reliable = false; break; }
        if (/^\d+$/.test(currentToken)) discardToken(); // 2>&1 的 fd 数字不是词
        commitToken();
        break;
      }
      case '(':
      case ')':
      case '{':
      case '}':
        reliable = false;
        break;
      case '#':
        if (!hasCurrentToken) {
          while (i < command.length && command[i] !== '\n') i++; // 注释整段跳过
        } else {
          currentToken += ch;
        }
        break;
      case ';':
      case '\n':
        endSegment();
        break;
      case '|':
        commitToken();
        if (command[i + 1] === '|') i++;
        endSegment();
        break;
      case '&': {
        const prev = i > 0 ? command[i - 1] : '';
        if (prev === '>' || prev === '<') break; // 2>&1 fd 复制,不是分隔符
        commitToken();
        if (command[i + 1] === '&') i++;
        endSegment();
        break;
      }
      case ' ':
      case '\t':
      case '\r':
        commitToken();
        break;
      default:
        currentToken += ch;
        hasCurrentToken = true;
        break;
    }
    if (!reliable) break;
  }
  if (inSingle || inDouble || escaped) reliable = false;
  if (reliable && (hasCurrentToken || count === 0)) endSegment(); // 末段(尾部分隔符不算空段)
  return { count, reliable, firstName };
}

function registryNameOf(rawName: string): string {
  const base = rawName.split(/[\\/]/u).at(-1) ?? '';
  const withoutSuffix = base.replace(WINDOWS_EXEC_SUFFIX_RE, '');
  const executable = withoutSuffix.toLowerCase();
  return Object.hasOwn(BASH_COMMAND_REGISTRY, executable) ? executable : 'other';
}

/**
 * 安全命令身份:遥测 `count`/`name` 的唯一出口。
 *
 * 降级序(与上游 `classifySafeCommandIdentity` 同形):
 *   空命令 ⇒ {count:0, name:'empty'};
 *   超长(>8k)⇒ {name:'other'}(不解析 —— 遥测不为超大命令制造 O(n) CPU/内存);
 *   动态/不支持/判不准 ⇒ {count, name:'other'};
 *   多段 ⇒ {count, name:'compound'};
 *   单段 ⇒ 注册表命中给静态名,表外一律 'other'(自定义脚本、判不出的 token 不上传)。
 */
export function classifySafeCommandIdentity(command: string): SafeCommandIdentity {
  if (!command.trim()) return { count: 0, name: 'empty' };
  if (command.length > MAX_COMMAND_IDENTITY_PARSE_CHARS) return { name: 'other' };
  const analysis = analyzeStaticCommandShape(command);
  if (!analysis.reliable) return { name: 'other' }; // 残值计数比缺席更噪:判不准连 count 也不报
  if (analysis.count !== 1) {
    return { count: analysis.count, name: analysis.count > 1 ? 'compound' : 'other' };
  }
  return { count: analysis.count, name: registryNameOf(analysis.firstName) };
}

/**
 * 组装一条 bash 命令遥测(上游 `bash-output.ts` command telemetry 的字段口径):
 * `category`(有界分类)+ `count`/`name`(安全身份)+ `hash`(有界指纹)。
 * 发射点:`commands/agent.ts` 的 `tool_call_completed`(接线由该文件持有人完成)。
 */
export function buildBashCommandTelemetry(command: string): SafeCommandIdentity & { category: string; hash: string } {
  return {
    ...classifySafeCommandIdentity(command),
    category: classifyCommand(command),
    hash: commandHash(command),
  };
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
