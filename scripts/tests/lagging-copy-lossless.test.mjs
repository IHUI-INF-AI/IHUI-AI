// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// §22c 镜像测试:scripts/lagging-copy-lossless.mjs
// 判据对象是「滞后工作树副本对齐会不会带走未入库内容」这一型 —— 它的失效表现是"把没判写成无损"。
// 全部用临时仓 + 构造面证明(不得拿真仓瞬时状态当合格证,守门 103 T12 那一课)。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import {
  judgeLossless,
  run,
  collectTargets,
  summarize,
  emptyEnumerationVerdict,
} from '../lagging-copy-lossless.mjs'

const GIT = process.env.IHUI_GIT_BIN || 'git'

function gitAt(root, args) {
  return execFileSync(GIT, ['-c', 'safe.directory=*', '-c', 'core.autocrlf=false', ...args], {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
  })
}

/** 造一个真 git 仓:两个已跟踪文件,工作树按各臂形态改动。 */
function makeRepo() {
  const dir = mkScratch('lag-lossless-')
  gitAt(dir, ['init', '-q'])
  gitAt(dir, ['config', 'user.email', 't@example.invalid'])
  gitAt(dir, ['config', 'user.name', 'T'])
  writeFileSync(join(dir, 'pure.txt'), 'alpha\nbeta\ngamma\n')
  writeFileSync(join(dir, 'wip.txt'), 'one\ntwo\n')
  gitAt(dir, ['add', '--', 'pure.txt', 'wip.txt'])
  gitAt(dir, ['commit', '-q', '-m', 'base'])
  return dir
}

test('T1 正向对照:副本 ⊆ HEAD ⇒ alignable(对齐可证零损失)', () => {
  const dir = makeRepo()
  try {
    // 删掉 HEAD 里的一行:这份副本不含任何未入库内容
    writeFileSync(join(dir, 'pure.txt'), 'alpha\ngamma\n')
    const rows = run(['pure.txt'], dir)
    assert.equal(rows.length, 1)
    assert.equal(rows[0].verdict, 'alignable', JSON.stringify(rows[0]))
    assert.equal(rows[0].ownCount, 0)
    assert.equal(rows[0].missingCount, 1, '缺 HEAD 行必须被量出来,不得与"同形"混淆')
  } finally {
    rmScratch(dir)
  }
})

test('T2 反向对照:副本含独有行 ⇒ held(不得对齐)', () => {
  const dir = makeRepo()
  try {
    // 同一份滞后副本 + 一行 HEAD 从未有过的内容 = 别人正在写
    writeFileSync(join(dir, 'pure.txt'), 'alpha\nLIVE-EDIT\n')
    const rows = run(['pure.txt'], dir)
    assert.equal(rows[0].verdict, 'held', JSON.stringify(rows[0]))
    assert.equal(rows[0].ownCount, 1)
    assert.match(rows[0].ownSamples[0].line, /LIVE-EDIT/, '必须点名是哪一行带走了内容')
  } finally {
    rmScratch(dir)
  }
})

test('T3 取不到 HEAD ⇒ 未判定,绝不记 alignable', () => {
  const dir = makeRepo()
  try {
    writeFileSync(join(dir, 'untracked.txt'), 'x\n')
    const rows = run(['untracked.txt'], dir)
    assert.equal(rows[0].verdict, 'undetermined', JSON.stringify(rows[0]))
    assert.ok(rows[0].reason, '未判定必须带原因')
    const s = summarize(rows)
    assert.equal(s.alignable.length, 0, '未判定不得被折进"可证无损"')
  } finally {
    rmScratch(dir)
  }
})

test('T4 collectTargets 在被审根上取清单,并排除暂存删除与未跟踪', () => {
  const dir = makeRepo()
  try {
    writeFileSync(join(dir, 'pure.txt'), 'alpha\n') // 工作树已改、未暂存 ⇒ 待审
    writeFileSync(join(dir, 'brand-new.txt'), 'n\n') // 未跟踪 ⇒ 不是滞后副本
    gitAt(dir, ['rm', '--cached', '-q', '--', 'wip.txt']) // 暂存删除 ⇒ 盘上内容不属于本型
    const list = collectTargets([], dir)
    assert.ok(!list.includes('brand-new.txt'), '未跟踪(??)不是滞后副本')
    assert.ok(!list.includes('wip.txt'), '暂存删除的盘上内容不是待审形态')
    assert.ok(list.includes('pure.txt'), '工作树已改的跟踪文件必须在清单里')
  } finally {
    rmScratch(dir)
  }
})

test('T5 空枚举判死(清单取不到不等于仓库干净)', () => {
  assert.equal(emptyEnumerationVerdict([]).exit, 2)
  assert.match(emptyEnumerationVerdict([]).reason, /未判定/)
  assert.equal(emptyEnumerationVerdict(['a']), null)
})

test('T6 纯函数判据:重数与集合两维不得互相顶账', () => {
  assert.equal(judgeLossless('a\na\n', 'a\n').verdict, 'held', '重数超出 = 独有,按集合判会洗成无损')
  assert.equal(judgeLossless('a\n', 'a\na\n').verdict, 'alignable', '重数不足 = 对齐只会补回')
  assert.equal(judgeLossless('a\nb\n', 'b\na\n').verdict, 'alignable', '行序不构成内容')
})

test('T7 形状锁:取材必须走层且显式传根,不得隐式绑真仓', () => {
  const src = readFileSync(new URL('../lagging-copy-lossless.mjs', import.meta.url), 'utf8')
  assert.match(
    src,
    /from '\.\/lib\/face-reader\.mjs'/,
    'HEAD 面取材必须走 face-reader(守门 118 口径)',
  )
  assert.match(src, /catBatch\(/, '不得自派生 git 读正文')
  assert.doesNotMatch(
    src,
    /readFileSync\(join\(ROOT/,
    '工作树取材必须用调用方传入的 root,否则镜像夹具会在真仓上跑(守门 70 那一型)',
  )
  assert.match(src, /windowsHide: true/, '派生 git 必须带 windowsHide(§5b 弹窗禁令)')
})

test('T8 真仓现读不得被用作合格证:同一片 HEAD 下三态计数必须同源', () => {
  // 这一条防的是"计数与名单来自两次取材":并发推进时报告自洽却错位
  const dir = makeRepo()
  try {
    writeFileSync(join(dir, 'pure.txt'), 'alpha\n')
    writeFileSync(join(dir, 'wip.txt'), 'one\nNEW\n')
    const rows = run(['pure.txt', 'wip.txt', 'nope.txt'], dir)
    const s = summarize(rows)
    assert.equal(rows.length, 3)
    assert.equal(
      s.alignable.length + s.held.length + s.undetermined.length,
      3,
      '三态必须闭合,不吞条目',
    )
    assert.deepEqual(
      s.held.map((r) => r.path),
      ['wip.txt'],
    )
    assert.deepEqual(
      s.alignable.map((r) => r.path),
      ['pure.txt'],
    )
    assert.deepEqual(
      s.undetermined.map((r) => r.path),
      ['nope.txt'],
    )
  } finally {
    rmScratch(dir)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
