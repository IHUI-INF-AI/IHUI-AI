// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-plan-closed-stock 的镜像用例(AGENTS §22c):判据一律 import 源脚本的 __test__,
 * 本文件不复制第二份"什么算同一件事"或"什么算已勾"。
 * 咬六件事:
 *  M1 判据有牙:跨枚滞留必须被判出(掏空判据即红);
 *  M2 一枚宽限:刚翻勾的那一枚不判红(否则门 71 的配平凭据永远造不出来);
 *  M3 未勾行零射程:本门只管已勾,不碰守门 71 的保护面;
 *  M4 单一实现:源脚本必须从 plan-task-index 取 compositeKeyOf/parseTaskRows,
 *     且不得自带复选框正则(两份身份判据必然漂开);
 *  M5 三面纪律:面旗互斥与「取不到 ⇒ 未判定」必须在真跑的 CLI 上成立,不只是文案;
 *  M6 取材层纪律(守门 118):被审面/基线面一律经 face-reader,不散写 cat-file。
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import { __test__ as G } from '../check-plan-closed-stock.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const GATE = path.join(ROOT, 'scripts/check-plan-closed-stock.mjs')
const SRC = readFileSync(GATE, 'utf8')

const OPEN = '- [ ] G-1 P1 测试票:镜像夹具要做一件事'
const CLOSED = '- [x] ✅(2026-10-20/镜像席) G-1 P1 测试票:镜像夹具要做一件事'
const UNRELATED = '- [ ] G-2 另一件无关的事'

test('M1 跨枚滞留判红:同一枚已勾行在基线面也已是已勾', () => {
  const v = G.staleClosedVerdict([CLOSED, UNRELATED].join('\n'), [CLOSED, UNRELATED].join('\n'))
  assert.equal(v.undetermined, false, '判据不得异常')
  assert.equal(v.stale.length, 1, `应判出 1 条滞留,实得 ${v.stale.length}`)
  assert.match(v.stale[0].raw, /G-1/)
})

test('M2 一枚宽限:基线面里这条还是未勾 ⇒ 本次翻勾不算滞留', () => {
  const v = G.staleClosedVerdict([CLOSED, UNRELATED].join('\n'), [OPEN, UNRELATED].join('\n'))
  assert.equal(v.stale.length, 0, '刚翻勾的行不该被拦(门 71 (c) 的配平凭据依赖这一格)')
})

test('M2b 反向配对:摘除该行的提交全绿(滞留集为空)', () => {
  const v = G.staleClosedVerdict(UNRELATED, [CLOSED, UNRELATED].join('\n'))
  assert.equal(v.stale.length, 0)
})

test('M2c 同主键两枚滞留已勾拷贝逐枚全报:首枚不遮蔽后续(清扫器 H3 恒拒的根,2026-10-22 根治)', () => {
  const copy2 = '- [x] ✅(2026-10-20/镜像席) G-1 P1 测试票:镜像夹具要做一件事〔第二枚拷贝〕'
  const face = [CLOSED, copy2].join('\n')
  const v = G.staleClosedVerdict(face, face)
  assert.equal(v.undetermined, false, '判据不得异常')
  assert.equal(v.stale.length, 2, `两枚拷贝应逐枚全报,实得 ${v.stale.length}`)
  assert.deepEqual(v.stale.map((r) => r.line), [1, 2], '逐枚上报且按行序')
})

test('M2d 同号一行未勾+一行滞留已勾 ⇒ 已勾拷贝照报,不被未勾副本遮蔽(票面夹具)', () => {
  const face = [OPEN, CLOSED].join('\n')
  const v = G.staleClosedVerdict(face, face)
  assert.equal(v.stale.length, 1, '已勾拷贝必须检出,不因同号存在未勾行而漏报')
  assert.equal(v.stale[0].raw, CLOSED)
  assert.equal(v.faceClosed, 1, '未勾行不得进已勾集')
})

test('M3 未勾行零射程:两面全是未勾 ⇒ 已勾计数恒 0', () => {
  const v = G.staleClosedVerdict([OPEN, UNRELATED].join('\n'), [OPEN, UNRELATED].join('\n'))
  assert.equal(v.faceClosed, 0, '未勾行不得进已勾集')
  assert.equal(v.stale.length, 0)
})

test('M3b 同主键而正文漂开仍算同一枚(编号+标题前缀为身份,不是整行等值)', () => {
  const drifted = '- [x] ✅(2026-10-20/镜像席) G-1 P1 测试票:镜像夹具要做一件事〔进度注记〕'
  const v = G.staleClosedVerdict(drifted, CLOSED)
  assert.equal(v.stale.length, 1, '正文追加注记不得成为逃过滞留判定的缝')
})

test('M4 单一实现:身份判据取 plan-task-index,本门不抄第二份复选框正则', () => {
  assert.match(SRC, /from '\.\/lib\/plan-task-index\.mjs'/, '必须 import 单源身份判据')
  assert.match(SRC, /compositeKeyOf/, '复合主键必须走 compositeKeyOf 单源')
  assert.match(SRC, /parseTaskRows/, '登记行必须走 parseTaskRows 单源')
  // 掏空反证:判据函数必须真的在源里(不是测试自己算一份)
  assert.equal(typeof G.staleClosedVerdict, 'function')
  assert.equal(typeof G.closedRowsOf, 'function')
  assert.ok(
    !/const\s+CHECKBOX_RE\s*=|\/\^\\s\(\?:\[-\*\]\\s\*\)\?\\\[/.test(SRC),
    '本门内不得出现第二份复选框解析实现',
  )
})

test('M5 三面纪律:两面旗同给 ⇒ 未判定,不回落另一个面(§0.4)', () => {
  // 判据层的可观察形状:面名在源码里成对出现(索引 / HEAD / 工作树),且互斥分支先于取材
  assert.match(SRC, /两面旗同给/, '缺"两面旗同给 ⇒ exit 2"这一格就是违反 §0.4')
  assert.match(SRC, /不记绿也不冒红/, '取不到面必须落未判定(§0.3)')
  // 真跑一次(形状锁能锁住文案,锁不住"这一支到底有没有接在 CLI 上"):
  const both = spawnSync(process.execPath, [GATE, '--staged', '--worktree'], {
    cwd: ROOT,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 120000,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  assert.equal(both.status, 2, `两面旗同给必须 exit 2,实得 ${both.status}: ${(both.stdout + both.stderr).slice(0, 200)}`)
  assert.match(`${both.stdout}${both.stderr}`, /未判定/, '必须显式写「未判定」,不记绿也不冒红(§0.3)')
})

test('M6 取材层纪律(守门 118):走 face-reader,不散写 cat-file', () => {
  assert.match(SRC, /from '\.\/lib\/face-reader\.mjs'/, '取材必须经层(selectFace/catBatch)')
  assert.match(SRC, /selectFace\(/, '面旗互斥必须走 selectFace 单源')
  assert.ok(!/['"]cat-file['"]/.test(SRC), "散写 'cat-file' 参数 = 清单与内容不同面同轮的那一型(注释里提到这个词不算)")
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
