// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 命令安全护栏 —— 对外签名保持不变的薄壳,内部委托 `command-policy/` 的 argv 结构化求值。
 *
 * 两层防线(语义与旧实现逐条对齐,只收紧不放宽):
 *   1. `matchDangerousCommand` —— 危险档。判据 = 结构化求值的 danger ∪ 旧字符串模式扫描。
 *      保留"求值器判不出时退回字符串扫描"这一层,是为了让重构不可能造成"旧正则拦得住、
 *      新求值器放过"的反向退化;新增的破坏性知识(kubectl delete、docker system prune 等)
 *      只走 `evaluateCommand().destructive` / `alwaysConfirm` 两档,不并进这里 ——
 *      那会顺带改变 IHUI_YOLO 逃生舱的既有拦截面。
 *   2. `isReadonlyCommand` —— 免确认档。判据 = 三态求值 `read-only`,默认态 unknown 一律不免确认。
 *      与旧实现的两处收紧:① 子命令白名单不再对选项盲视(`git branch -d`、`git remote remove`
 *      这类"只读子命令 + 写语义选项"不再免确认);② 未登记命令/子命令判 unknown 而非放行。
 *
 * 返回类型仍是 `RegExp | null` 而不是换成结构化对象:既有调用方把 `dangerousMatch.source` 直接
 * 拼进用户提示(`tools/builtins.ts`、`tools/terminal.ts`),改返回类型会连带改这两处文案的语义。
 */

import { evaluateCommand } from './command-policy/index.js';

/**
 * 危险模式表 —— 现在是"求值器的等价面 + 判不出时的兜底扫描",不再是唯一判据。
 * 新增危险面请优先写进 `command-policy/syntax-table.ts`,这里只保留与旧行为一一对应的条目。
 */
export const DANGEROUS_COMMAND_PATTERNS: readonly RegExp[] = [
  /\brm\s+(-[a-zA-Z]*r[a-zA-Z]*f?|--recursive)\b/i,
  /\bchmod\s+([0-7]{3,4}|u\+s|g\+s|777|666)\b/i,
  /\bchown\b/i,
  /\bchgrp\b/i,
  /\bchattr\b/i,
  /\bpkill\b/i,
  /\bkill(all)?\s+-9\b/i,
  /\bgit\s+push\s+(-f|--force|--force-with-lease)\b/i,
  /\bgit\s+reset\s+--hard\b/i,
  /\bgit\s+clean\s+-[a-zA-Z]*f[a-zA-Z]*\b/i,
  /\bgit\s+branch\s+-D\b/i,
  /\bshutdown\b/i,
  /\breboot\b/i,
  /\bmkfs\b/i,
  /\bdd\s+.*of=\/dev\//i,
];

/**
 * 只读 basename 白名单 —— 保留导出是为了兼容既有调用方与测试断言;
 * 真正的只读判定已改由 `command-policy/syntax-table.ts` 承担(那份表额外区分选项)。
 */
export const READONLY_COMMAND_BASENAMES: readonly string[] = [
  'ls', 'cat', 'pwd', 'date', 'whoami', 'hostname', 'uptime', 'ps',
  'head', 'tail', 'wc', 'sort', 'uniq', 'tr', 'cut',
  'git',
  'grep', 'rg', 'ag',
  'cargo',
  'kubectl',
  'docker',
];

/** 旧的两词只读子命令清单(同上,仅作兼容导出;新判定见语法表)。 */
export const GIT_READONLY_SUBCOMMANDS: readonly string[] = [
  'status', 'branch', 'log', 'diff', 'ls-files', 'show', 'rev-parse', 'blame', 'remote', 'config --get',
];

/** 把求值结论映射回一条可展示的旧模式:先按词边界命中,再按包含命中,都不中则用规则文本合成。 */
function reportingPattern(rule: string | undefined, basename: string | undefined): RegExp {
  const haystack = `${rule ?? ''} ${basename ?? ''}`.trim();
  const hints = rule?.startsWith('git ') ? [rule.split(' ')[1] ?? '', 'git'] : [rule?.split(' ')[0] ?? '', basename ?? ''];
  for (const hint of hints) {
    if (!hint || hint.length < 3) continue;
    const anchored = DANGEROUS_COMMAND_PATTERNS.find((p) => p.source.includes(`\\b${hint}`) || p.source.includes(hint));
    if (anchored) return anchored;
  }
  // 新判据命中但旧表没有对应条目时,合成的 RegExp 只用于把"命中了什么规则"说清楚。
  const literal = haystack.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(literal || 'dangerous-command', 'i');
}

function scanLegacyPatterns(command: string): RegExp | null {
  for (const pattern of DANGEROUS_COMMAND_PATTERNS) {
    if (pattern.test(command)) return pattern;
  }
  return null;
}

/**
 * 危险命令判定。返回命中的模式(供调用方直接把 `.source` 写进提示),未命中返回 null。
 *
 * 判据是"结构化 danger ∪ 旧字符串扫描",而不是二选一:
 * 只要旧扫描还会命中的输入继续被拦,这次重构才可能是纯收紧而不是"顺手放宽"。
 * (旧扫描对 `"rm" -rf` 这类写法本来就漏 —— 那一半由结构化面补上。)
 */
export function matchDangerousCommand(command: string): RegExp | null {
  if (!command || !command.trim()) return null;
  const assessment = evaluateCommand(command);
  if (assessment.dangerous) return reportingPattern(assessment.rule, assessment.basename);
  return scanLegacyPatterns(command);
}

/**
 * 只读(免确认)命令判定。三态求值里只有 `read-only` 返回 true;
 * `mutating` 与 `unknown` 都需要走确认路径。
 *
 * 额外一道 basename 白名单锁:语法表里新登记的纯读子命令(`git describe`、`docker top`、
 * `cargo metadata` 一类)通过 `evaluateCommand()` 可见,但**不**经由这个旧函数拿到免确认资格 ——
 * 免确认面本次只收紧、不放宽,要放宽得单独走一次评审。
 */
export function isReadonlyCommand(command: string): boolean {
  if (!command || !command.trim()) return false;
  const assessment = evaluateCommand(command);
  if (assessment.verdict !== 'read-only') return false;
  return assessment.basename !== undefined && READONLY_COMMAND_BASENAMES.includes(assessment.basename);
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
