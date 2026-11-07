// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 「近期已结清号」避让面的 **IO 装载层**(2026-11-06 立,和判据分家的理由在下面)。
 *
 * 为什么不Put进 `lib/plan-id-face.mjs`(那是判据层):那里有一条既有的形状锁
 * `scripts/tests/plan-id-face.test.mjs T4`——「本面一个字节都不从工作树/磁盘取,清单与正文都问
 * 同一个 source」。而摘除台账 `.ihui-agent/state/plan-row-drop.jsonl` 是 **gitignore 的运行态留痕**,
 * 根本不在任何被审 revision 上 ⇒ 它必须从磁盘读,也不该把这条纪律在判据层里破一个口子
 * (破口子的代价不是形式问题:那条锁防的正是"按磁盘判 revision 面"这一型误判)。
 *
 * 分工因此是:判据 = `lib/plan-id-face.mjs` 的 `collectRetiredIds`(纯,IO 全注入);
 * 取数 = 本文件(唯一一处真读盘,两个发号出口共用同一份,§0.6 仍成立)。
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { git } from './bypass-git.mjs'
import { collectRetiredIds, RETIRE_WINDOW_DAYS, PRIMARY_FAMILY } from './plan-id-face.mjs'

export const RETIRE_IO_MAX_TITLES = 60000

/**
 * @param root       被取数的仓根
 * @param families   需要避让的族(大写)
 * @param days       窗口(缺省沿用判据层的 RETIRE_WINDOW_DAYS,不在这儿另拍一个数)
 */
export function loadRetiredIdSets({
  root,
  families = [PRIMARY_FAMILY],
  days = RETIRE_WINDOW_DAYS,
  logTimeoutMs = 25_000,
} = {}) {
  return collectRetiredIds({
    families,
    days,
    readText: (rel) => {
      try {
        return readFileSync(resolve(root, rel), 'utf8')
      } catch {
        return null
      }
    },
    recentCommitTitles: () => {
      const z = git(
        ['log', `--since=${days} days ago`, '--format=%s', `-${RETIRE_IO_MAX_TITLES}`],
        {
          root,
          raw: true,
          timeout: logTimeoutMs,
        },
      )
      const s = Array.isArray(z) ? z.join('\n') : typeof z === 'string' ? z : null
      if (s === null) return null
      const lines = s.split(/\r?\n/).filter(Boolean)
      return lines.length === 0 ? null : lines // 空输出 = 取不到,不是"这些天没有提交"
    },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
