#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 只改**正文散文**里的对外数字(生成块由 scripts/sync-readme-numbers.mjs 负责,两器分工不越界)。
 *
 * 立点(2026-11-05):门 173 只在"本轮触及 README"时全判,于是"只加测试不碰 README"的提交让
 * 正文静默过期;pre-push 全量档能判红,但不给人一条机械改对的路径 —— 手工逐条改 13 处,
 * 下次加测试再漂,必然复发。本器把判据自己的裁决(findStaleClaims)反写成修改动作:
 *   · 改哪些行 = 判据报的行(措辞封闭集,不猜);只动 `END RECENT UPDATES` **之前**的活区;
 *   · 归档快照区(其后)一字不碰 —— 那是历史陈述,按差值棘轮只报数(门头注同口径);
 *   · 千位分组保形:原文 `4,415` ⇒ `4,363`,原文 `4120` ⇒ `4123`;
 *   · 幂等:再跑一次 0 处(自检 S3)。
 * 用法(仓库根目录):node scripts/fix-doc-numbers-prose.mjs         # ① 或先跑 sync-readme-numbers 刷块
 *                         node scripts/fix-doc-numbers-prose.mjs --self-test
 * 退出码 0 = 已对齐(含"本来就是对的");1 = 自检失败。写完请用 `node scripts/check-doc-numbers.mjs --strict --push` 复核。
 */

import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'

import { AUDITED_DOCS, UPDATES_END, findStaleClaims } from './check-doc-numbers.mjs'

/** 把活区里的过期断言改写成现算值;返回新文本与修正处数。 */
export function fixText(text, numbers) {
  const lines = text.split(/\r?\n/)
  const cut = lines.findIndex((l) => l.includes(UPDATES_END))
  const stale = findStaleClaims(text, numbers).violations.filter((v) => cut < 0 || v.line - 1 < cut)
  for (const v of stale) {
    const re = new RegExp(`(?<![\\d,])(?:${v.found}|${v.found.toLocaleString('en-US')})(?![\\d,])`, 'g')
    lines[v.line - 1] = lines[v.line - 1].replace(re, (s) => (s.includes(',') ? v.want.toLocaleString('en-US') : String(v.want)))
  }
  return { text: lines.join('\n'), fixed: stale.length }
}

if (process.argv[1]?.endsWith('fix-doc-numbers-prose.mjs') && !process.argv.includes('--self-test')) {
  const numbers = JSON.parse(execFileSync('node', ['scripts/gen-doc-numbers.mjs', '--json'], { encoding: 'utf8' })).numbers
  let total = 0
  for (const f of AUDITED_DOCS) {
    const r = fixText(readFileSync(f, 'utf8'), numbers)
    if (!r.fixed) continue
    writeFileSync(f, r.text)
    total += r.fixed
    console.log(`  ✅ ${f}: 正文 ${r.fixed} 处 → 现算值`)
  }
  console.log(total ? `共修正 ${total} 处(生成块请另跑 sync-readme-numbers.mjs)` : '✅ 正文数字已全部等于现算值')
}

if (process.argv[1]?.endsWith('fix-doc-numbers-prose.mjs') && process.argv.includes('--self-test')) {
  const a = fixText(`正文 4120 个测试文件\n${UPDATES_END}\n4120 个测试文件`, { testFiles: 4123 })
  const b = fixText(a.text, { testFiles: 4123 })
  const c = fixText('4,415 API routes', { apiRoutes: 4363 })
  const pass =
    a.fixed === 1 &&
    a.text.startsWith('正文 4123 个测试文件') &&
    a.text.endsWith('\n4120 个测试文件') &&
    b.fixed === 0 &&
    c.text === '4,363 API routes'
  console.log(pass ? '✅ S1/S2/S3 通过(活区改对 / 归档区不动 / 幂等 + 分组保形)' : '❌ self-test fail')
  process.exit(pass ? 0 : 1)
}
