// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-937952 [A4]:Bash 副作用回写 readFileState(上游 `tool/handlers/bash-read-file-state.ts`
 * 的机制等价版;上游出处 :20-42,59-93,95-166,182-190)。
 *
 * 三条行为,全部挂在 `settleForegroundCommand` 唯一前台结算出口(builtins.ts):
 * ① stale 回填:命令跑完后,把"此前 Read 过、当前指纹已变(含被删)"的条目从状态图摘掉,
 *    并返回一条 system-reminder 提示 —— 否则模型对"`eslint a.ts --fix` 改了我读过的文件"
 *    零感知,后续 Edit 是盲写(上游输出形态:"modified N files you've previously read …
 *    Call Read before editing")。
 * ② cat 整文件回填:`cat <单文件>`(不带旗标、单操作数)且 exit 0、未截断、stdout 与盘上
 *    内容逐字一致 ⇒ 记一条全读条目 —— 后续 read_file 命中 FILE_UNCHANGED_STUB 短路,免整读。
 * ③ 截断不回填:stdout 被截断 ⇒ 模型看到的不是完整文件,任何回填都会制造假新鲜 ⇒ 一律不记。
 *
 * 边界(如实登记):只覆盖前台结算出口;后台任务(get_command_output 路径)的回填属另一格账。
 */

import fs from 'node:fs';
import path from 'node:path';

import { getReadFileStateMap, normalizeMtimeMs } from './read-file-state.js';

/** `cat <单文件>` 形状:单操作数、零旗标(旗标会改输出字节,回填就是假新鲜)、无 shell 操作符。 */
const CAT_SINGLE_FILE_RE = /^cat\s+(?:"([^"]*)"|'([^']*)'|([^\s;&|]+))$/;

/**
 * ① stale 回填:扫状态图,凡当前 stat 指纹与记录不符(或文件已消失)的条目整族摘除。
 * 返回去重后的 stale 路径(供提示拼装);图空/扫不出 ⇒ 空数组,无副作用。
 */
export function markStalePreviouslyRead(ctx: object): string[] {
  const state = getReadFileStateMap(ctx);
  if (state.size === 0) return [];
  const stalePaths = new Set<string>();
  for (const [key, entry] of state) {
    let stat: fs.Stats | undefined;
    try {
      stat = fs.statSync(entry.path);
    } catch {
      stat = undefined; // 文件已消失:也是一种"变了"
    }
    const fresh =
      stat !== undefined &&
      entry.mtimeMs !== undefined &&
      normalizeMtimeMs(entry.mtimeMs) === normalizeMtimeMs(stat.mtimeMs) &&
      entry.sizeBytes === stat.size;
    if (!fresh) {
      stalePaths.add(entry.path);
      state.delete(key);
    }
  }
  return [...stalePaths];
}

/** stale 提示文案(上游语义等价;system-reminder 包裹与 gh 限流提示同一先例)。 */
export function getBashReadStateHint(stalePaths: string[]): string {
  const listed = stalePaths.map((p) => p.split(/[\\/]/).pop() ?? p).join(', ');
  return (
    `<system-reminder>${stalePaths.length} file(s) you've previously read were modified outside ` +
    `the Read tool (by this command): ${listed}. Their cached read state has been invalidated — ` +
    `call Read before editing them.</system-reminder>`
  );
}

/**
 * ② cat 整文件回填。形状与内容双闸,任一不满足 ⇒ 不记(宁漏不假):
 * 命令形状(零旗标单操作数)/ exit 0 / 未截断未超时 / 路径落在工作区内 / stdout 与盘上逐字一致。
 */
export function backfillFromCatCommand(
  result: { stdout: string; exitCode: number | null; truncated: boolean; timedOut: boolean; blocked: boolean },
  command: string,
  ctx: { workspacePath: string },
): boolean {
  if (result.blocked || result.timedOut || result.truncated || result.exitCode !== 0) return false;
  if (!result.stdout) return false;
  const m = CAT_SINGLE_FILE_RE.exec(command.trim());
  if (!m) return false;
  const raw = m[1] ?? m[2] ?? m[3];
  if (!raw) return false;
  const abs = path.isAbsolute(raw) ? raw : path.resolve(ctx.workspacePath, raw);
  const workspace = path.resolve(ctx.workspacePath);
  const rel = path.relative(workspace, abs);
  if (rel.startsWith('..') || path.isAbsolute(rel)) return false; // 工作区外不回填(读侧路径策略另有闸,状态图不越界记账)
  let content: string;
  let stat: fs.Stats;
  try {
    content = fs.readFileSync(abs, 'utf8');
    stat = fs.statSync(abs);
  } catch {
    return false;
  }
  if (content !== result.stdout) return false; // 内容逐字一致才配"全读"这个名分(二进制/编码走样在此落空)
  getReadFileStateMap(ctx).set(JSON.stringify([abs, null, null]), {
    path: abs,
    isPartialView: false,
    mtimeMs: stat.mtimeMs,
    sizeBytes: stat.size,
    recordedAt: Date.now(),
  });
  return true;
}
