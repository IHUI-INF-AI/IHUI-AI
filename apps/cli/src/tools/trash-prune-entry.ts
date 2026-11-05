// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 回收站「到期清理」的**可执行入口**(goal-b49 X1 席 adapter 的调度腿唯一调用面)。
 *
 * 为什么单独一档:adapter(`./trash-prune.js`)是**纯函数** —— 不读 env、不写 stdout、不起调度,
 * 调度归 `scripts/git-guardian.mjs` 的巡检轮(判机器状态 ⇒ 不进提交链,§12e)。守护腿是 .mjs、
 * 端内实现是 TS,两者跨进程 ⇒ 本文件就是那道边界:把结论打成**一行机器可读的结论行**
 * (`TRASH-PRUNE state=… gate=…`),守护腿只读这一行,不复制任何判据(§0.6)。
 *
 * 跑法(与本仓既有 tsx 入口同型,见 `scripts/auto-evolve.mjs` 的 `TSX_ENTRY`):
 *   node <repo>/apps/cli/node_modules/tsx/dist/cli.mjs \
 *        <repo>/apps/cli/src/tools/trash-prune-entry.ts --workspace <repo>
 *
 * 退出码:**打印了结论行 ⇒ 0**(结论好坏由 `state=` 字段承载,不让退出码二义化 —— 「判不出」
 * 与「崩了」必须分得开:前者有结论行、后者没有);没打印出来 ⇒ 1(崩了 / 入参不合法),
 * 守护腿据此判「未跑成」而不是「没有过期件」(§0.3)。
 */

import { pruneExpiredTrash } from './trash-prune.js';

/** 取旗标值;缺旗标 / 下一个 token 仍是旗标 ⇒ null(不猜)。 */
function flagValue(argv: readonly string[], name: string): string | null {
  const at = argv.indexOf(name);
  if (at < 0) return null;
  const value = argv[at + 1];
  return value !== undefined && !value.startsWith('--') ? value : null;
}

/** 单行化:机器读的行不许换行;空白压成下划线,免得解析端要处理多行值。 */
function oneLine(text: string): string {
  return String(text).replace(/\s+/g, '_');
}

const argv = process.argv.slice(2);
const workspace = flagValue(argv, '--workspace') ?? process.cwd();

const result = pruneExpiredTrash(workspace);

// 结论行:adapter 自己那一份 summary(判据层原样透出),此处**一字不改**地转述。
process.stdout.write(`${result.summary}\n`);
for (const skip of result.skipped) {
  process.stdout.write(`TRASH-PRUNE-SKIP reason=${oneLine(skip.reason)}\n`);
}
for (const fail of result.failed) {
  process.stdout.write(`TRASH-PRUNE-FAIL reason=${oneLine(fail.reason)}\n`);
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
