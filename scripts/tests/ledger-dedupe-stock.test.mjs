// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * ledger-dedupe-stock 镜像测试(2026-10-15):在真临时仓验证"存量清偿"落地全链路,
 * 不碰本仓工作树。每臂成对:能折的必须折得动、且零损失;不能折/不该折的必须跳过。
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { execFileSync } from 'node:child_process'
import { writeFileSync, readFileSync } from 'node:fs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { git } from '../lib/bypass-git.mjs'
import { dedupeStock } from '../ledger-dedupe-stock.mjs'

function makeRepo() {
  const dir = mkScratch('dedupe-stock-test-')
  git(['init'], { root: dir })
  git(['config', 'user.email', 'test@test.local'], { root: dir })
  git(['config', 'user.name', 'dedupe-stock-test'], { root: dir })
  return dir
}
function headBlobText(root, path) {
  const blob = git(['rev-parse', '--verify', '--quiet', `HEAD:${path}`], { root, allowFail: true })
  if (!blob) return null
  return git(['cat-file', 'blob', blob], { root, maxBuffer: 1 << 28 })
}
function seed(root, text) {
  writeFileSync(`${root}/PROJECT_PLAN.md`, text, 'utf8')
  git(['add', '--', 'PROJECT_PLAN.md'], { root })
  git(['commit', '-m', 'seed'], { root })
}

describe('ledger-dedupe-stock 落地链路', () => {
  it('脏工作树(账本体有未提交改动) ⇒ 跳过,绝不动账本体', () => {
    const dir = makeRepo()
    try {
      seed(dir, ['# 台账', '- [ ] G-100 **修复登录超时问题** 〔甲〕', ''].join('\n'))
      // 制造未提交改动(模拟在飞 agent)
      writeFileSync(`${dir}/PROJECT_PLAN.md`, ['# 台账', '- [ ] G-100 **修复登录超时问题** 〔甲〕', '- [ ] G-999 **修复登录超时问题** 〔乙〕', ''].join('\n'), 'utf8')
      const r = dedupeStock({ root: dir })
      assert.equal(r.skipped, true, `脏树必须跳过,实得 ${JSON.stringify(r)}`)
      assert.ok(r.why.includes('未提交'), `原因应指未提交改动,实得 ${r.why}`)
      // 账本体未被改动(仍含未提交的两行)
      const wt = readFileSync(`${dir}/PROJECT_PLAN.md`, 'utf8')
      assert.ok(wt.includes('G-999'), '脏树时账本体必须原样保留')
    } finally {
      rmScratch(dir)
    }
  })

  it('已提交账本体含同题副本 ⇒ 折叠成一行且零损失,产出新提交', () => {
    const dir = makeRepo()
    try {
      const src = [
        '# 台账',
        '- [ ] G-100 **修复登录超时问题** 〔✅(2026-10-15) 已联调〕',
        '- [ ] G-999 **修复登录超时问题** 〔✅(2026-10-14) 初版〕',
        '',
      ].join('\n')
      seed(dir, src)
      assert.equal((src.match(/^- \[ \]/gm) || []).length, 2, '种子有 2 行')

      const r = dedupeStock({ root: dir })
      assert.equal(r.landed, true, `应落地,实得 ${JSON.stringify(r)}`)
      assert.equal(r.removed, 1, '应折叠 1 行')

      const afterText = headBlobText(dir, 'PROJECT_PLAN.md')
      assert.equal((afterText.match(/^- \[ \]/gm) || []).length, 1, '折后只剩一行未勾')
      assert.ok(afterText.includes('已联调'), '保留行自带注记在')
      assert.ok(afterText.includes('初版'), '被丢弃行独有注记并入')
      assert.ok(afterText.includes('同题原号 G-999'), '被丢弃行票号并入')
    } finally {
      rmScratch(dir)
    }
  })

  it('已提交账本体无同题副本 ⇒ 无需清偿,不产提交', () => {
    const dir = makeRepo()
    try {
      const src = ['# 台账', '- [ ] G-100 **唯一一件事**', ''].join('\n')
      seed(dir, src)
      const r = dedupeStock({ root: dir })
      assert.equal(r.skipped, true, `无重复应跳过,实得 ${JSON.stringify(r)}`)
      assert.ok(/无需清偿|无可折/.test(r.why), `原因应是无重复,实得 ${r.why}`)
    } finally {
      rmScratch(dir)
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
