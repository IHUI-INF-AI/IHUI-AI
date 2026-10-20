// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkScratch } from '../lib/scratch-dir.mjs'
import { compositeKeyOf, keyOfRow, parseTaskRows } from '../lib/plan-task-index.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const TOOL = resolve(HERE, '../plan-copy-fold.mjs')
const TICK = String.fromCodePoint(0x2705)

function mkRepo(rows) {
  const dir = mkScratch('pcf-')
  // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
  const g = (a) =>
    execFileSync(
      'git',
      ['-c', 'safe.directory=*', '-c', 'user.email=t@t', '-c', 'user.name=t', '-C', dir, ...a],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    ).toString()
  g(['init', '-q'])
  writeFileSync(join(dir, 'PROJECT_PLAN.md'), rows.join('\n') + '\n', 'utf8')
  g(['add', 'PROJECT_PLAN.md'])
  g(['commit', '-q', '-m', 'fixture'])
  return dir
}
const run = (dir, extra) => {
  const r = execFileSync(process.execPath, [TOOL, `--root=${dir}`, ...extra], {
    encoding: 'utf8',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  return r
}
/** 夹具前提自查:两条行的复合主键必须逐字相等(不等就说明夹具写错了,而不是判据错了)。 */
function assertSameKey(a, b) {
  const ka = keyOfRow(a)
  const kb = keyOfRow(b)
  assert.ok(ka, '主件必须有复合主键')
  assert.equal(ka, kb, '夹具前提:两条同主键')
  return ka
}

const OPEN = '- [ ] D9 夹具标题的正文片段'
const DONE = `- [x] ${TICK}(2026-09-01) D9 夹具标题的正文片段`
const LEASED = '- [ ] （进行中@2026-09-29/holder） D9 夹具标题的正文片段'

test('T1 f1 档:与已勾行同主键的未勾行被翻勾,正文逐字保留、行数不变', () => {
  const key = assertSameKey(DONE, OPEN)
  const dir = mkRepo(['# 夹具', DONE, OPEN, LEASED, '- [ ] Z9 另一件无关的事'])
  const out = run(dir, ['--mode=f1', '--out=cand.md'])
  assert.match(out, /归并 1 行/)
  const cand = readFileSync(join(dir, 'cand.md'), 'utf8').split('\n')
  assert.equal(cand.length, 6, '不删行')
  assert.ok(cand[2].startsWith(`- [x] ${TICK}`), '副本被翻勾')
  assert.ok(cand[2].includes(OPEN.slice('- [ ] '.length)), '正文一字未改(原正文是新行前缀)')
  assert.ok(cand[2].includes(key), '注记点名归并到哪个主键')
})

test('T2 带租约牌的认领行一条都不动(§16 越权边界)', () => {
  const dir = mkRepo(['# 夹具', DONE, OPEN, LEASED])
  run(dir, ['--mode=f1', '--out=cand.md'])
  const cand = readFileSync(join(dir, 'cand.md'), 'utf8').split('\n')
  assert.equal(cand[3], LEASED, '租约行必须逐字原样')
  assert.match(run(dir, ['--mode=f1']), /跳过带租约 1/)
})

test('T3 declared 档比 f1 保守:没有自述声明就不动 ⇒ 拒绝产出空候选', () => {
  const dir = mkRepo(['# 夹具', DONE, OPEN])
  let rc = 0
  let err = ''
  try {
    execFileSync(process.execPath, [TOOL, `--root=${dir}`, '--mode=declared', '--out=cand.md'], {
      encoding: 'utf8',
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch (e) {
    rc = e.status
    err = String(e.stderr || '') + String(e.stdout || '')
  }
  assert.notEqual(rc, 0, 'declared 档必须拒绝(它只收自述副本)')
  assert.match(err, /无事可做或判据失效/, '拒绝时要说是哪一种,不得静默')
})

test('T4 declared 档收得到自述副本(与 T3 成对 ⇒ 两档确实不同判)', () => {
  const declared = '- [ ] D9 夹具标题的正文片段 〔【归并】重复登记副本(2026-09-29):派单以那条为准〕'
  const dir = mkRepo(['# 夹具', DONE, declared])
  const out = run(dir, ['--mode=declared', '--out=cand.md'])
  assert.match(out, /归并 1 行/)
})

test('T5 形状锁:判据只能逐行替换,且只能写候选/清单文件(绝不写回真台账)', () => {
  const src = readFileSync(TOOL, 'utf8')
  assert.doesNotMatch(src, /\.splice\(/, '删行形态不得回来')
  assert.doesNotMatch(src, /writeFileSync\([^)]*PROJECT_PLAN/, '不得直接写回台账')
  assert.match(src, /lines\[i\] = /, '按行索引替换是唯一写形')
  assert.match(src, /CLAIM\.test\(line\)/, '主循环必须先挡租约行')
  assert.match(src, /CLAIM\.test\(orig\[i\]\)/, '自证里必须再挡一次(两道闸不得只留一道)')
  assert.match(src, /from '\.\/lib\/plan-task-index\.mjs'/, '主键判据只许有一份实现')
})

test('T6 --root 缺省时按脚本自身位置定根(生产语义不变)', () => {
  const src = readFileSync(TOOL, 'utf8')
  assert.match(src, /process\.argv\.find\(\(a2\) => a2\.startsWith\('--root='\)\)/)
  assert.match(src, /resolve\(dirname\(fileURLToPath\(import\.meta\.url\)\)/)
  const rows = parseTaskRows(`# x\n${DONE}\n${OPEN}\n`)
  assert.equal(rows.filter((r) => r.state === 'done').length, 1, '夹具经真解析器读得出一勾一未勾')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// T7(G-1058637 的立项凭据,2026-10-06):本器一度用 `keyOfRow`(只回裸编号)当"复合主键",
// 而编号在本仓会复用 —— 真仓现读的 143 条候选里 110 条是把**另一道已闭环的同号行**当成持有行,
// 例如未勾的「G-335. 分叉合并带进来的三组跨分支撞号」与已勾的「G-335 --self-test 登记侧不求值洞」
// 是两道不同的票。翻勾它们等于把没做完的事记成做过的(§1 明令"比原病更响")。
// 判据换成 `compositeKeyOf`(编号 + 题面前缀逐字)后,这一族必须**一条都不折叠**,并且拒绝时要
// 把"判出了多少行"说出来 —— 只报 rc 非零与"判据没跑"在措辞上同形,那正是本仓最贵的假绿。
const DUP_ID_DONE = `- [x] ${TICK}(2026-09-01) G-900 \`--self-test\` 的登记侧不求值洞已逐门普查完:41 道潜伏`
const DUP_ID_OPEN =
  '- [ ] G-900 分叉合并带进来的三组跨分支撞号(G-901 / G-902),锚点已按现读收下,清偿不在这张票里'

test('T7 同号不同题不得被折叠成已闭环(编号复用是常态,复合主键才是主键)', () => {
  const dir = mkRepo(['# 夹具', DUP_ID_DONE, DUP_ID_OPEN])
  // 夹具前提自查:裸编号档**确实相等** —— 不等就说明夹具写错了,而不是判据有牙。
  assert.equal(
    keyOfRow(DUP_ID_OPEN),
    keyOfRow(DUP_ID_DONE),
    '夹具前提:两行裸编号相等(否则测不到这一型)',
  )
  const ca = compositeKeyOf(DUP_ID_OPEN)
  const cb = compositeKeyOf(DUP_ID_DONE)
  assert.ok(ca && cb, '夹具前提:两行都必须取得出复合主键(取不出就只是在测「判不出」那一档)')
  assert.notEqual(ca, cb, '夹具前提:复合主键必须不等(相等就成了真同题副本)')
  let rc = 0
  let err = ''
  try {
    execFileSync(process.execPath, [TOOL, `--root=${dir}`, '--mode=f1', '--out=cand.md'], {
      encoding: 'utf8',
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch (e) {
    rc = e.status
    err = String(e.stderr || '') + String(e.stdout || '')
  }
  assert.notEqual(rc, 0, 'f1 档把同号不同题当成副本 ⇒ 一旦 --apply 就会误翻勾')
  assert.match(err, /无事可做或判据失效/, '仍须给出可读的拒绝理由')
  assert.match(err, /归并候选 0/, '一条都不许折叠 —— 这是本判据存在的全部理由')
  assert.match(err, /判过未折 1/, '必须报出「看过并判断过这一行」,否则与「扫了个空」同形')
})

test('T8 同题真孪生仍须折叠(收紧不得变成永远拒绝)', () => {
  const dir = mkRepo(['# 夹具', DONE, OPEN])
  const out = run(dir, ['--mode=f1', '--out=cand.md'])
  assert.match(out, /归并 1 行/, '真同题副本必须还能折叠 —— 否则本器只是把能力关掉')
})

// T9(G-72 裁决①):f1 档一律不折叠自述指针行。指针行的复合键取自指针文本自身,
// 它的"同键已勾孪生"只是另一条同文指针行,并不证明被指持有行已闭环 ⇒ 翻勾是循环论证
// (把没做完记成做过,本仓最贵的假绿)。declared 档本职就是收自述副本,原样不变。
const PTR_OPEN = '- [ ] D9 夹具标题的正文片段 〔【归并】重复登记副本(2026-09-29):派单以那条为准〕'
const PTR_DONE = `- [x] ${TICK}(2026-09-01) D9 夹具标题的正文片段 〔【归并】重复登记副本(2026-09-29):派单以那条为准〕`

test('T9 f1 档跳过自述指针行(同键已勾孪生指针不构成闭环证据);declared 档仍收自述副本', () => {
  // 夹具前提自查:两行复合键逐字相等且都命中自述声明,否则测不到这一型(假夹具自报)。
  const ka = compositeKeyOf(PTR_OPEN)
  const kb = compositeKeyOf(PTR_DONE)
  assert.ok(ka && kb, '夹具前提:两行都取得出复合主键')
  assert.equal(ka, kb, '夹具前提:两行复合键相等(同文指针孪生,而非真持有行)')
  const selfDecl = /〔[^〕]*(重复登记副本|派单以那条为准|本行不再单独派单)[^〕]*〕/
  assert.match(PTR_OPEN, selfDecl, '夹具前提:未勾行带自述声明')
  assert.match(PTR_DONE, selfDecl, '夹具前提:已勾孪生也是自述指针,不是真持有行')

  // f1:不折叠、归并候选 0、报出 skippedPointer≥1(未勾未降 ⇒ 审计拒绝,rc≠0)。
  const dir = mkRepo(['# 夹具', PTR_DONE, PTR_OPEN])
  let rc = 0
  let err = ''
  try {
    execFileSync(process.execPath, [TOOL, `--root=${dir}`, '--mode=f1', '--out=cand.md'], {
      encoding: 'utf8',
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch (e) {
    rc = e.status
    err = String(e.stderr || '') + String(e.stdout || '')
  }
  assert.notEqual(rc, 0, 'f1 档折叠自述指针行 ⇒ 循环论证误翻勾,必须拒绝')
  assert.match(err, /归并候选 0/, '一条都不许折叠')
  assert.match(err, /跳过自述指针 [1-9]\d*/, '跳过的指针行必须报名,不得静默丢弃')

  // declared 回归:本职就是收自述副本,同一夹具仍折叠(两档不同判)。
  const out = run(dir, ['--mode=declared', '--out=cand2.md'])
  assert.match(out, /归并 1 行/, 'declared 档收自述副本的本职不变')
  const cand = readFileSync(join(dir, 'cand2.md'), 'utf8').split('\n')
  assert.ok(cand[2].startsWith(`- [x] ${TICK}`), 'declared 档把自述副本翻勾')
})
