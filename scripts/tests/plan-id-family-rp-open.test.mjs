// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * §22c 镜像测试:goal-b25「开新字母族 RP」的六格(2026-10-29,b25-newfamily 席立)。
 *
 * 立因(现读,不是假想):G 族池内 1..99 每一枚都在「台账 ⊕ 47 份归档件」正文里出现过 ⇒ 取号器给
 * `SCAN_FACE_FULL`(占用面口径还剩 47 枚空闲,却没有一个连续 10 号干净窗),D=`POOL_FULL`,
 * O=`NO_CONTIGUOUS_LEASE_WINDOW`;而 2026-10-24 拍板的出路是「族满开新字母族、永不升位数」。
 * 逐字母量完后单字母已无可用位(唯一未被占用的 E 池内命中 40/99、连续 10 号干净窗 0 个 ⇒ 补它等于
 * 把本批要治的病复制一遍),故按既有 `WP` 先例补两字母族 `RP`(池内命中 0 枚、干净窗 90 个)。
 *
 * 本文件钉六件事(判据一律 import 源脚本导出,测试内不抄第二份族表/池上限/成因字面量):
 *  P1 族表认得出 RP:复合主键 / 行首编号 / 取号集合三把尺同判,且隐身点名维对它零点名;
 *  P2 首行落地后令牌真发得出号(号 ∈ 1..99 且与首行不撞),探针读数同源点头;
 *  P3 首行**未**落地时 fail-closed:令牌拒发 `no-such-family:RP`,探针落 `no-rows`,不编造 RP-1;
 *  P4 不产生越界号:池真满 ⇒ POOL_FULL 拒发;候选被全文件扫描面全灭 ⇒ SCAN_FACE_FULL(两档不并桶);
 *  P5 既有族不回归:新族不吃别族的行,且 G/D/Y/Q/K 仍按各自形状各自发号;
 *  P6 单一真相源:族表里 RP 只出现一次,本测试零复制族表字面量。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { TASK_ID_PATTERN, headIdOf, unseenRegistrantIds } from '../check-plan-line-loss.mjs'
import { keyOfRow, usedIdsOfPrefix } from '../lib/plan-task-index.mjs'
import { idFamilyLetters, probeIdFamily } from '../auto-triage.mjs'
import {
  EXHAUST_STAGE,
  LEASE_POOL_MAX,
  POOL_EXHAUST_REASON,
  SCAN_FACE_EXHAUST_REASON,
  describeExhaustion,
} from '../lib/plan-id-lease.mjs'
import { scanFamilyIdHits } from '../lib/plan-id-face.mjs'
import { __test__ as LDE } from '../live-doc-edit.mjs'

const resolveIdTokens = LDE.resolveIdTokens
const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..')

/** 本次开族的族名。**族表字面量不在这里抄** —— 这里只写"要测哪一族"这个名字,形态由源脚本回答。 */
const FAM = 'RP'
const MACHINE = 'seatA'
const STAMP = '2026-10-29'
const NEW_TITLE = '本轮唯一新登记标题(镜像夹具,不与任何既有行同题)'

/** 族表里该族自己的书写形状(现读表里那一格,不写死 `RP-\\d+`)。 */
const familyAltOf = (fam) =>
  String(TASK_ID_PATTERN)
    .split('|')
    .find((alt) => new RegExp(`^${fam}(?:$|[^A-Za-z])`).test(alt))

const firstRow = () =>
  `- [ ] ${FAM}-1 (${STAMP}) **号池新族首行(手填)** —— 声明位手填,号码由手填给出。`
const tokenRow = (title = NEW_TITLE) => `- [ ] {{NEXT_ID:${FAM}}} ${title}`
const declared = (nums) => nums.map((n) => `- [ ] ${FAM}-${n} 夹具占位登记${n}。`).join('\n')
const issuedIdOf = (tok) => String(tok.lines?.[0] ?? '').replace(/^\s*-\s\[[ x]\]\s*/, '').split(/\s/)[0]
const numOf = (label) => Number(new RegExp(`^${FAM}-?(\\d+)$`).exec(String(label))?.[1] ?? Number.NaN)

// ── P1 ──
test('P1 族表认得出本族:主键/行首编号/取号集合三把尺同判,隐身点名维零点名', () => {
  const fams = idFamilyLetters(TASK_ID_PATTERN)
  assert.ok(fams.includes(FAM), `族表未解析出 ${FAM}:${fams.join('/')}`)
  assert.equal(fams.at(-1), FAM, '新族只追加在表尾(插在中间=改挑族顺序)')
  assert.match(String(familyAltOf(FAM)), /^[A-Za-z]+-\?\\d\+\[a-z\]\?$/, '形态须与 D/Z/Y/Q/K 同形(横杠可选)')

  const row = firstRow()
  assert.equal(keyOfRow(row), `${FAM}-1`, '复合主键必须读到声明位(补表前实测 null)')
  assert.equal(headIdOf(row), `${FAM}-1`, '防丢面的行首编号必须读到')
  const u = usedIdsOfPrefix(`${row}\n- [ ] ${FAM}-7 另一枚。`, FAM)
  assert.ok(u, '取号集合不得判"该族无行"')
  assert.equal(u.max, 7)
  assert.equal(u.template, `${FAM}-%d`, '书写形状由该族自己现读决定')
  // 横杠可选那一形态同样吃(D/Z/Y/Q/K 同一条理由:注记形态不得再隐身)
  assert.equal(keyOfRow(`- [ ] ${FAM}9 不带横杠的首号形态。`), `${FAM}9`)
  assert.equal(unseenRegistrantIds(row).length, 0, '族表认得出的号不得再进"隐身点名"')
  assert.equal(unseenRegistrantIds(`- [ ] ${FAM}9 不带横杠。`).length, 0, '不带横杠的形态同样不得点名')
})

// ── P2 ──
test('P2 首行落地后令牌真发得出号:号在池内且不撞首行,探针同源点头', () => {
  const face = `${firstRow()}\n- [ ] G-1 别的族照常在册。`
  const tok = resolveIdTokens([tokenRow()], face, null, { machineId: MACHINE })
  assert.equal(tok.ok, true, `首行落地后必须发得出号,实际 reason=${tok.reason}`)
  const id = issuedIdOf(tok)
  const n = numOf(id)
  assert.ok(Number.isFinite(n), `发号形态必须落在本族书写形状上,实得:${id}`)
  assert.ok(n >= 1 && n <= LEASE_POOL_MAX, `发号越界:${id}(池 1..${LEASE_POOL_MAX})`)
  assert.notEqual(n, 1, '不得重发首行已占的号')
  // 探针(auto-triage 的挑族判据)读同一份判据 ⇒ 同一族必须同样点头
  const p = probeIdFamily(FAM, { faceText: face, machineId: MACHINE })
  assert.equal(p.status, 'issuable', `探针读数漂开:${JSON.stringify(p)}`)
  assert.ok(Number.isFinite(numOf(p.label)), `探针首号形状漂开:${p.label}`)
})

// ── P3 ──
test('P3 首行未落地 ⇒ fail-closed:令牌报 no-such-family,探针落 no-rows,绝不编造首号', () => {
  const emptyFace = '- [ ] G-1 别的族照常在册。'
  const tok = resolveIdTokens([tokenRow()], emptyFace, null, { machineId: MACHINE })
  assert.equal(tok.ok, false, '空族绝不能被当成"能发"')
  assert.equal(tok.reason, `no-such-family:${FAM}`, `实得 reason=${tok.reason}`)
  assert.ok(!('lines' in tok), '拒绝路径不得交回任何改写后的行')
  const p = probeIdFamily(FAM, { faceText: emptyFace, machineId: MACHINE })
  assert.equal(p.status, 'no-rows', `探针必须如实落"该族无行",实得 ${JSON.stringify(p)}`)
  // 手填行(无令牌)不受这条影响:取号器对手填行逐字保留
  const manual = resolveIdTokens([firstRow()], emptyFace, null, { machineId: MACHINE, manualCheck: true })
  assert.equal(manual.ok, true, `手填首行必须能原样落地,实得 reason=${manual.reason}`)
  assert.equal(issuedIdOf(manual), `${FAM}-1`)
})

// ── P4 ──
test('P4 不产生越界号:池真满 ⇒ POOL_FULL;候选被扫描面全灭 ⇒ SCAN_FACE_FULL(两档不并桶)', () => {
  const full = resolveIdTokens(
    [tokenRow()],
    declared(Array.from({ length: LEASE_POOL_MAX }, (_, i) => i + 1)),
    null,
    { machineId: MACHINE },
  )
  assert.equal(full.ok, false, '池内空闲 0 枚必须拒绝,而不是把号升到三位数')
  assert.equal(full.exhaustion.cursor.reason, POOL_EXHAUST_REASON.poolFull)
  assert.equal(full.exhaustion.cursor.poolMax, LEASE_POOL_MAX)
  assert.ok(!('lines' in full), '拒绝路径不得交回任何改写后的行(零发号面)')

  // 第二档:声明位让得出窗,但池内每一枚都在正文里被引用过 ⇒ 候选全灭 = SCAN_FACE_FULL,不是 POOL_FULL
  const half = Math.floor(LEASE_POOL_MAX / 2)
  const face =
    declared(Array.from({ length: half }, (_, i) => i + 1)) +
    `\n- [ ] G-1 正文流水把池内剩下的号全引了一遍:${Array.from(
      { length: LEASE_POOL_MAX - half },
      (_, i) => `${FAM}-${half + i + 1}`,
    ).join(' ')}`
  const scanned = resolveIdTokens([tokenRow()], face, null, { machineId: MACHINE })
  assert.equal(scanned.ok, false, '候选全被引用面命中 ⇒ 必须拒发,不得照发')
  assert.equal(scanned.reason, `pool-exhausted:${FAM}`)
  assert.equal(scanned.exhaustion.stage, EXHAUST_STAGE.scanFilter)
  // 成因句由 lib 单源渲染(本器不拼句子)⇒ 这一型必须念成 SCAN_FACE_FULL;
  // 两档并桶会把出路指成"归档腾号"(实测 Δ=0),故正反各锁一次。
  const said = describeExhaustion(scanned.exhaustion)
  assert.ok(said.includes(SCAN_FACE_EXHAUST_REASON), `这一型必须念成 ${SCAN_FACE_EXHAUST_REASON}:${said}`)
  // 反向:池真满那一档不得被念成扫描关(两档不并桶,任一侧并过去都是把人指向无效出路)
  const saidFull = describeExhaustion(full.exhaustion)
  assert.ok(
    saidFull.includes(POOL_EXHAUST_REASON.poolFull),
    `池真满必须念成 ${POOL_EXHAUST_REASON.poolFull}:${saidFull}`,
  )
  assert.ok(!saidFull.includes(SCAN_FACE_EXHAUST_REASON), `池真满不得念成扫描关:${saidFull}`)
})

// ── P5 ──
test('P5 既有族不回归:新族不吃别族的行,G/D/Y/Q/K 各按自己形状各自发号', () => {
  const otherRows = ['G-5 甲', 'D7 乙', 'Y-3 丙', 'Q2 丁', 'K1 戊'].map((s) => `- [ ] ${s}`).join('\n')
  const hits = scanFamilyIdHits(otherRows, FAM)
  assert.ok(hits !== null, '新族扫描必须可判(不得返回"判不出")')
  assert.equal(hits.size, 0, `新族不得把别族的号读成自己的:${[...hits.keys()].join(',')}`)
  assert.equal(usedIdsOfPrefix(otherRows, FAM), null, '别族行不得进本族取号集合')

  for (const fam of ['G', 'D', 'Y', 'Q', 'K']) {
    const face = `- [ ] ${fam}-1 该族首行夹具。\n`
    const tok = resolveIdTokens([`- [ ] {{NEXT_ID:${fam}}} ${NEW_TITLE}-${fam}`], face, null, {
      machineId: MACHINE,
    })
    assert.equal(tok.ok, true, `${fam} 族补表后必须照旧发得出号,实得 reason=${tok.reason}`)
    const id = issuedIdOf(tok)
    assert.ok(id.startsWith(`${fam}-`) || id.startsWith(fam), `号形状漂到别族去了:${fam} ⇒ ${id}`)
    assert.ok(Number(new RegExp(`^${fam}-?(\\d+)$`).exec(id)?.[1] ?? 0) <= LEASE_POOL_MAX, `越界号:${id}`)
  }
})

// ── P6 ──
test('P6 单一真相源:族表里本族只出现一次,本测试零复制族表字面量', () => {
  const src = readFileSync(join(ROOT, 'scripts', 'check-plan-line-loss.mjs'), 'utf8')
  const idLine = src.split(/\r?\n/).find((l) => l.startsWith('const ID = String.raw`'))
  assert.ok(idLine, '族表底稿那一行必须仍在(单一真相源)')
  const alts = idLine.slice(idLine.indexOf('`') + 1, idLine.lastIndexOf('`')).split('|')
  assert.equal(alts.filter((a) => a.startsWith(FAM)).length, 1, '同一族在表里只能有一格')
  const me = readFileSync(join(ROOT, 'scripts', 'tests', 'plan-id-family-rp-open.test.mjs'), 'utf8')
  assert.doesNotMatch(me, /^\s*(?:export\s+)?const TASK_ID_PATTERN\b/m, '测试内不得再定义编号族(§22c)')
  assert.doesNotMatch(me, /^\s*(?:export\s+)?const LEASE_POOL_MAX\b/m, '池上限必须 import')
  assert.doesNotMatch(me, /^\s*(?:export\s+)?const POOL_EXHAUST_REASON\b/m, '成因字面量必须 import')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
