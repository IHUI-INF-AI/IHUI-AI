// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Shell 风格分词器 —— 把命令字符串切成"可静态求值的段 + 无法静态确定语义的构造清单"。
 *
 * 为什么必须自己写而不能用 `split(/\s+/)`:
 *   字符串切分会把引号内的空格、转义、`$()` 展开、重定向目标一律当成参数,
 *   于是 `"rm" -rf /` 这类写法既逃得出旧的危险正则,也逃不出"看起来像只读"的误判。
 *   本分词器的产物是 argv 数组 + issues 列表:凡出现无法静态确定语义的构造,
 *   只记 issue 不做猜测,由求值器把结论钉在 unknown。
 *
 * 只覆盖"判定安全性所需"的 shell 语法(引号/转义/分段/命令替换/变量/重定向/子 shell),
 * 不是完整 shell 实现:别名、函数、`case`、协进程、`\c` 控制字符一律记 issue 或按字面量处理。
 */

export interface ArgToken {
  /** 去引号、去转义后的真实参数值 */
  value: string;
  /** 该参数是否含变量展开或命令替换(值不可静态确定) */
  expanded: boolean;
}

export interface TokenizedSegment {
  argv: ArgToken[];
  /** `>` `>>` 的目标(写文件,即使命令本身只读也构成副作用) */
  writesTo: ArgToken[];
  /** `<` 的目标(读文件) */
  readsFrom: ArgToken[];
}

export type TokenIssueKind =
  | 'command-substitution'
  | 'process-substitution'
  | 'variable-command'
  | 'subshell'
  | 'brace-group'
  | 'heredoc'
  | 'unterminated-quote'
  | 'dollar-quote'
  | 'unterminated-substitution'
  | 'empty-command';

export interface TokenIssue {
  kind: TokenIssueKind;
  detail: string;
}

export interface TokenizeResult {
  segments: TokenizedSegment[];
  issues: TokenIssue[];
  /** 提取出的命令替换内容(需递归求值,只用于危险面) */
  substitutions: string[];
}

/** 配对消费 `$( ... )` / `${ ... }` / `( ... )`,含内层引号;返回结束位置(开区间末尾)。 */
function consumeBalanced(input: string, openAt: number, open: string, close: string): number {
  let depth = 0;
  let quote: string | null = null;
  for (let i = openAt; i < input.length; i += 1) {
    const c = input[i];
    if (quote) {
      if (c === '\\' && quote === '"') {
        i += 1;
        continue;
      }
      if (c === quote) quote = null;
      continue;
    }
    if (c === "'" || c === '"') {
      quote = c;
      continue;
    }
    if (c === open) depth += 1;
    else if (c === close) {
      depth -= 1;
      if (depth === 0) return i + 1;
    }
  }
  return -1;
}

function isVariableStart(input: string, at: number): boolean {
  const c = input[at];
  return !!c && (/[A-Za-z_]/.test(c) || c === '{' || c === '(' || c === '$' || c === '@' || c === '*' || c === '?');
}

/**
 * 主分词入口。
 * 分段符:`&&` `||` `|` `|&` `;` `&` 换行 —— 段与段之间的关系不猜,只逐段求值后聚合。
 */
export function tokenizeCommand(input: string): TokenizeResult {
  const issues: TokenIssue[] = [];
  const substitutions: string[] = [];
  const segments: TokenizedSegment[] = [];

  let segment: TokenizedSegment = { argv: [], writesTo: [], readsFrom: [] };
  let token = '';
  let tokenExpanded = false;
  let tokenStarted = false;
  let quote: string | null = null;
  /** 待接收重定向目标的槽位 */
  let pendingRedirect: 'write' | 'read' | null = null;

  const pushSegment = (): void => {
    flushToken();
    if (segment.argv.length > 0 || segment.writesTo.length > 0 || segment.readsFrom.length > 0) {
      segments.push(segment);
    }
    segment = { argv: [], writesTo: [], readsFrom: [] };
    pendingRedirect = null;
  };

  const flushToken = (): void => {
    if (!tokenStarted) return;
    const item: ArgToken = { value: token, expanded: tokenExpanded };
    if (pendingRedirect === 'write') segment.writesTo.push(item);
    else if (pendingRedirect === 'read') segment.readsFrom.push(item);
    else segment.argv.push(item);
    pendingRedirect = null;
    token = '';
    tokenExpanded = false;
    tokenStarted = false;
  };

  const addIssue = (kind: TokenIssueKind, detail: string): void => {
    issues.push({ kind, detail });
  };

  for (let i = 0; i < input.length; i += 1) {
    const c = input[i]!;

    if (quote) {
      if (c === quote) {
        quote = null;
        continue;
      }
      if (quote === '"' && c === '\\' && i + 1 < input.length) {
        const next = input[i + 1]!;
        if (next === '"' || next === '\\' || next === '$' || next === '`') {
          token += next;
          i += 1;
          continue;
        }
        token += c;
        continue;
      }
      // 双引号内的 `$( )` / 反引号仍然展开,必须继续识别
      if (quote === '"' && c === '$' && input[i + 1] === '(') {
        const end = consumeBalanced(input, i + 1, '(', ')');
        if (end < 0) {
          addIssue('unterminated-substitution', input.slice(i));
          break;
        }
        substitutions.push(input.slice(i + 2, end - 1));
        addIssue('command-substitution', input.slice(i, end));
        tokenExpanded = true;
        i = end - 1;
        continue;
      }
      if (quote === '"' && (c === '$' || c === '`')) {
        tokenExpanded = true;
      }
      token += c;
      continue;
    }

    switch (c) {
      case ' ':
      case '\t':
      case '\n':
      case '\r':
        flushToken();
        break;

      case "'":
      case '"':
        tokenStarted = true;
        quote = c;
        break;

      case '\\': {
        tokenStarted = true;
        const next = input[i + 1];
        if (next === '\n') {
          i += 1; // 行连接符:不产生参数边界
        } else {
          token += next ?? '';
          i += 1;
        }
        break;
      }

      case '$': {
        const next = input[i + 1];
        if (next === '(') {
          const end = consumeBalanced(input, i + 1, '(', ')');
          if (end < 0) {
            addIssue('unterminated-substitution', input.slice(i));
            i = input.length;
            break;
          }
          substitutions.push(input.slice(i + 2, end - 1));
          addIssue('command-substitution', input.slice(i, end));
          tokenStarted = true;
          tokenExpanded = true;
          i = end - 1;
          break;
        }
        if (next === '{') {
          const end = consumeBalanced(input, i + 1, '{', '}');
          if (end < 0) {
            addIssue('unterminated-substitution', input.slice(i));
            i = input.length;
            break;
          }
          tokenStarted = true;
          tokenExpanded = true;
          i = end - 1;
          break;
        }
        if (next === "'") {
          // `$'...'` 是 ANSI-C 引用,内部可含任意转义序列 —— 不猜语义
          addIssue('dollar-quote', input.slice(i, i + 4));
          tokenStarted = true;
          tokenExpanded = true;
          break;
        }
        tokenStarted = true;
        if (next && isVariableStart(input, i + 1)) {
          tokenExpanded = true;
          let j = i + 1;
          while (j < input.length && /[A-Za-z0-9_@*?#$-]/.test(input[j]!)) j += 1;
          i = j - 1;
        } else {
          token += c;
        }
        break;
      }

      case '`': {
        const end = input.indexOf('`', i + 1);
        if (end < 0) {
          addIssue('unterminated-substitution', input.slice(i));
          i = input.length;
          break;
        }
        substitutions.push(input.slice(i + 1, end));
        addIssue('command-substitution', input.slice(i, end + 1));
        tokenStarted = true;
        tokenExpanded = true;
        i = end;
        break;
      }

      case '(':
      case ')': {
        // `<(` `>(` 已在重定向分支处理;走到这里说明是子 shell 或括号分组
        pushSegment();
        addIssue('subshell', c === '(' ? '(' : ')');
        const end = c === '(' ? consumeBalanced(input, i, '(', ')') : i;
        if (c === '(' && end > 0) {
          // 括号内内容单独成段求值(危险面仍要看见)
          const inner = input.slice(i + 1, end - 1);
          const nested = tokenizeCommand(inner);
          segments.push(...nested.segments);
          issues.push(...nested.issues.filter((x) => x.kind !== 'subshell'));
          substitutions.push(...nested.substitutions);
          i = end - 1;
        }
        break;
      }

      case '{': {
        // 仅当作为段首出现时才当作 brace group;`{` 出现在参数中间按字面量
        if (segment.argv.length === 0 && !tokenStarted) {
          addIssue('brace-group', '{');
          flushToken();
          break;
        }
        tokenStarted = true;
        token += c;
        break;
      }

      case '>':
      case '<': {
        const isWrite = c === '>';
        const after = input[i + 1];
        if (after === '(' || after === '<') {
          if (after === '(') {
            addIssue('process-substitution', `${c}(`);
            flushToken();
            const end = consumeBalanced(input, i + 1, '(', ')');
            if (end > 0) i = end - 1;
            break;
          }
          addIssue('heredoc', '<<');
          flushToken();
          // heredoc 正文无法静态界定,后续内容按段继续切,结论一律 unknown
          i += 1;
          break;
        }
        // `2>` 之类的 fd 前缀不是参数,丢掉
        if (tokenStarted && /^[0-9]+$/.test(token)) {
          token = '';
          tokenStarted = false;
          tokenExpanded = false;
        } else {
          flushToken();
        }
        pendingRedirect = isWrite ? 'write' : 'read';
        if (isWrite && after === '>') i += 1;
        break;
      }

      case '&': {
        pushSegment();
        if (input[i + 1] === '&') {
          i += 1;
          break;
        }
        addIssue('subshell', '&'); // 后台执行:段边界之外还多一层时序不确定性
        break;
      }

      case '|': {
        pushSegment();
        if (input[i + 1] === '|' || input[i + 1] === '&') i += 1;
        break;
      }

      case ';':
        pushSegment();
        break;

      default:
        if (!tokenStarted) tokenStarted = true;
        token += c;
    }
  }

  if (quote) addIssue('unterminated-quote', token);
  pushSegment();

  if (segments.length === 0) addIssue('empty-command', input.trim());
  if (segments.some((s) => s.argv.length > 0 && s.argv[0]!.expanded)) {
    addIssue('variable-command', segments.find((s) => s.argv[0]!.expanded)!.argv[0]!.value);
  }
  // `2>/dev/null` 这类目标为设备/描述符的重定向不构成文件写副作用,由求值器按需放行
  return { segments, issues, substitutions };
}

/** 供求值器判断重定向目标是否真的是文件(而非 /dev/null 等)。 */
export function isFileRedirectTarget(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  if (v.startsWith('/dev/')) return false;
  if (v === '&1' || v === '&2') return false;
  return true;
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
