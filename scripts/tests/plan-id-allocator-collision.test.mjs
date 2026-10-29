// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 取号器撞号防线的**夹具级**取证(G-14 补完,2026-10-23)。
//
// 本票缺的那一格(票面原文):"用 mkScratch() 造一份临时台账,故意让'本机段内的空闲号'与
// '文中已声明的号'重合" —— 既有镜像(`live-doc-edit-id-collision.test.mjs`)量的是**落地之后**
// 那道 F9 闸,`plan-id-lease.test.mjs` 的 T4c-T4g 量的是内存里的字符串;没有一条量"真台账文件
// 被读成占用面之后,取号器发出的到底是哪一个号"。而 2026-10-22 的病型恰恰只在**真文件面**上成立:
// 号只活在归档件/正文引用里,`usedIdsOfPrefix` 看不见它,段内又确实空着。
//
// 三条对照(缺一不可,方向必须双向):
//   ① 改动前会发出那个撞号 —— 从本次运行的 `scanReport[0].firstCandidate`(未过滤候选序的第一枚,
//      即"没有全文件扫描时"第一个被发出的号)读到;
//   ② 改动后会跳过、顺延,并**逐枚打印命中的行号**;
//   ③ 反向对照:无重合时发出的号与改动前逐字相同,且 `scanNotes` 为空(不许把正常路径染上噪声)。
//
// ⚠ 判据一律从源脚本 `__test__` / lib 出口拿,本文件不写第二份"什么算该族的号"(§22c)。

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { after, test } from 'node:test'
import assert from 'node:assert/strict'

import { __test__ } from '../live-doc-edit.mjs'
import { joinFace, scanFamilyIdHits, scanFamilyIds, ARCHIVE_DIR } from '../lib/plan-id-face.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const MACHINE = 'fixture-machine-g14'

/** 夹具落点:scratch(§15b 批准的工作树外落点),进程结束统一回收。 */
const dirs = []
function scratchLedger({ ledgerLines, archiveLines = [] }) {
  const dir = mkScratch('pid-alloc-')
  dirs.push(dir)
  const ledger = join(dir, 'PROJECT_PLAN.md')
  writeFileSync(ledger, ledgerLines.join('\n'), 'utf8')
  const bodies = []
  if (archiveLines.length) {
    const arch = join(dir, ARCHIVE_DIR, 'PROJECT_PLAN_2026-10-20_fixture.md')
    mkdirSync(dirname(arch), { recursive: true })
    writeFileSync(arch, archiveLines.join('\n'), 'utf8')
    bodies.push(readFileSync(arch, 'utf8'))
  }
  // 占用面必须按生产口径拼(台账恒在最前,归档件用同一个 joinFace)—— 自己拼一份就等于换了个面。
  return { dir, ledgerText: readFileSync(ledger, 'utf8'), face: joinFace(readFileSync(ledger, 'utf8'), bodies) }
}

after(() => {
  for (const d of dirs) rmScratch(d)
})

const TOKEN = (title) => `- [ ] {{NEXT_ID:G}} **${title}** 正文`

/**
 * 夹具:本机自有段 G-901~G-950(主键=段尾号 G-950),段内 901/902/903 是**声明位**登记行
 * (⇒ `usedIdsOfPrefix` 看得见,不进候选),而下一枚空闲号 904 只以**正文引用**形态存在 ——
 * 正是"段内空闲序"与"文中已声明的号"重合的那一刻。
 */
function occupiedFixture(proseLines) {
  const ledgerLines = [
    '# 临时台账(G-14 夹具)',
    '',
    '- [x] G-950 〔千段租约〕 本机=' + MACHINE + ' 段=G-901~G-950(取号器专用行)',
    '- [ ] G-901 **段内已声明的既有题甲** 正文',
    '- [ ] G-902 **段内已声明的既有题乙** 正文',
    '- [ ] G-903 **段内已声明的既有题丙** 正文',
    ...proseLines,
    '',
  ]
  return scratchLedger({ ledgerLines })
}

test('① 阳性对照(改动前):未过滤候选序的第一枚就是撞上的那个号', () => {
  const prose = ['承 G-904 的取证:这一号只在正文引用里出现,不是登记行的声明位。']
  const { face, ledgerText } = occupiedFixture(prose)
  const r = __test__.resolveIdTokens([TOKEN('新登记甲')], face, null, { machineId: MACHINE })
  assert.equal(r.ok, true, `夹具必须能发号;实得 ${JSON.stringify({ reason: r.reason })}`)
  assert.equal(
    r.scanReport[0].firstCandidate,
    'G-904',
    '改动前(无全文件扫描)发出去的正是未过滤候选序第一枚 —— 这一条就是"改动前会发出撞号"的取证',
  )
  assert.equal(r.scanReport[0].family, 'G')
  // 撞号确实只活在**文件面**上:声明位口径(`usedIdsOfPrefix`)看不见它,全文件扫描才看得见。
  assert.ok(!/^\s*-\s\[[ xX]\]\s*G-904/m.test(ledgerText), '夹具里 G-904 不得是声明位(否则测的是另一条判据)')
  assert.ok(scanFamilyIds(face, 'G').has(904), '全文件扫描必须看见正文引用里的 904')
  assert.equal(ledgerText.includes('承 G-904'), true)
})

test('② 阳性对照(改动后):跳过并逐枚打印命中行号', () => {
  const prose = ['承 G-904 的取证:这一号只在正文引用里出现,不是登记行的声明位。']
  const { face, ledgerText } = occupiedFixture(prose)
  const r = __test__.resolveIdTokens([TOKEN('新登记甲')], face, null, { machineId: MACHINE })
  assert.equal(r.assigned, 'G-905', '段内 904 已被占 ⇒ 必须顺延到 905(不是跨段、不是重占)')
  assert.deepEqual(r.leaseClaims, [], '跳过发生在自有段内 ⇒ 不得因此另占新段(千段租约规则不变)')
  assert.equal(r.scanReport[0].skipped.length, 1)
  const skip = r.scanReport[0].skipped[0]
  assert.equal(skip.id, 'G-904')
  const expectedLine = ledgerText.split('\n').findIndex((l) => l.includes('承 G-904')) + 1
  assert.equal(skip.sites[0].line, expectedLine, `命中位置必须报台账真实行号(期望 ${expectedLine})`)
  assert.match(skip.sites[0].snippet, /G-904/, '片段必须把命中的号带出来,否则点名人还得自己再搜一遍')
  // 逐枚打印:一行一枚,带"哪一行",而不是一句"某某号已被占"。
  const detail = r.scanNotes.filter((n) => n.includes('跳过 G-904'))
  assert.equal(detail.length, 1, `必须逐枚给出跳过明细;实得 ${JSON.stringify(r.scanNotes)}`)
  assert.ok(detail[0].includes(`第 ${expectedLine} 行`), `明细必须带位置;实得 ${detail[0]}`)
  assert.ok(detail[0].includes('顺延'), '必须说明去向(顺延取下一枚),不只是"跳过"')
  // 落地的号绝不能再是扫描号集里的号(这是本票的判据本体)。
  assert.ok(!scanFamilyIds(face, 'G').has(905))
})

test('③ 阳性对照(连登三票,2026-10-22 病型):三枚号都被占 ⇒ 三票各拿一个不撞的新号', () => {
  // 病型原文:一席走 `{{NEXT_ID:G}}` 连登三票,拿到的 G-924/G-926/G-929 每一枚都已挂在别席既存题上。
  const prose = [
    '<!-- 已归档(2026-10-21):✅(2026-10-21) **G-904 别席既存题甲** —— 完整内容在归档件 -->',
    '<!-- 已归档(2026-10-21):✅(2026-10-21) **G-905 别席既存题乙** —— 完整内容在归档件 -->',
    '<!-- 已归档(2026-10-21):✅(2026-10-21) **G-906 别席既存题丙** —— 完整内容在归档件 -->',
  ]
  const { face } = occupiedFixture(prose)
  const r = __test__.resolveIdTokens([TOKEN('新票甲'), TOKEN('新票乙'), TOKEN('新票丙')], face, null, {
    machineId: MACHINE,
  })
  assert.equal(r.ok, true)
  assert.equal(r.assigned, 'G-907,G-908,G-909', '三个候选(904/905/906)全被占 ⇒ 顺延到 907/908/909')
  const ids = r.assigned.split(',')
  assert.equal(new Set(ids).size, 3, '同一轮连登不得发出重复号')
  const scanned = scanFamilyIds(face, 'G')
  for (const id of ids) assert.ok(!scanned.has(Number(id.slice(2))), `${id} 仍在扫描号集里 ⇒ 撞号`)
  for (const skipId of ['G-904', 'G-905', 'G-906'])
    assert.ok(
      r.scanNotes.some((n) => n.includes(`跳过 ${skipId}`) && n.includes('第 ')),
      `${skipId} 必须逐枚点名并带位置;实得 ${JSON.stringify(r.scanNotes)}`,
    )
})

test('④ 反向对照(无重合):发出的号与改动前逐字相同,且不产出任何跳过噪声', () => {
  const { face } = occupiedFixture(['正文引用的都是段外的号:G-120 与 G-200 只是别处取证。'])
  const r = __test__.resolveIdTokens([TOKEN('新登记甲')], face, null, { machineId: MACHINE })
  assert.equal(r.ok, true)
  assert.equal(r.assigned, 'G-904', '段内首个空闲号照发(不得恒跳过)')
  assert.equal(
    r.scanReport[0].firstCandidate,
    'G-904',
    '正常路径:发号必须与"改动前那一枚"逐字相同(本票不许顺手改配额/号段/候选序)',
  )
  assert.deepEqual(r.scanNotes, [], '没有命中时不得产出跳过点名(正常路径输出与改动前逐字相同)')
  assert.deepEqual(r.leaseNotes, [
    `号段租约:本机=${MACHINE} 在自有段 G-901~G-950 内按空闲序连号(本次首号=G-904)`,
  ])
})

test('⑤ 归档件侧的重合同样算占(占用面 = 台账 ⊕ 归档件,不是只看台账)', () => {
  const { face } = scratchLedger({
    ledgerLines: [
      '# 临时台账(G-14 夹具)',
      '- [x] G-950 〔千段租约〕 本机=' + MACHINE + ' 段=G-901~G-950(取号器专用行)',
      '- [ ] G-901 **段内已声明的既有题甲** 正文',
      '- [ ] G-902 **段内已声明的既有题乙** 正文',
      '- [ ] G-903 **段内已声明的既有题丙** 正文',
    ],
    archiveLines: [
      '### 已归档',
      '承 G-904 的取证:这一号只活在归档件的正文里(不是登记行的声明位,窄面结构上看不见)。',
    ],
  })
  const r = __test__.resolveIdTokens([TOKEN('新登记甲')], face, null, { machineId: MACHINE })
  assert.equal(r.assigned, 'G-905', '归档件里已占的 904 必须跳过(窄面发号正是本缺陷的症状)')
  assert.ok(r.scanReport[0].skipped.some((s) => s.id === 'G-904'))
})

test('⑥ 未判定:扫描面取不到 ⇒ 拒绝发号,绝不退回"段内空闲序照发"', () => {
  // 票面必做 4:取不到被审面 / 扫不出集合 ⇒ 不合格就不发号。
  for (const bad of [undefined, null, 42, {}, []]) {
    const r = __test__.resolveIdTokens([TOKEN('新登记甲')], bad, null, { machineId: MACHINE })
    assert.equal(r.ok, false, `输入 ${JSON.stringify(bad)} ⇒ 必须拒绝发号`)
    assert.match(String(r.reason), /^id-scan-undetermined/, `理由必须点名"未判定";实得 ${r.reason}`)
  }
  // 两视图的分工:号集视图沿用既有语义(非文本 ⇒ 空集),带位置视图必须给出 null(判不出)。
  assert.equal(scanFamilyIdHits(null, 'G'), null, '带位置视图在取不到文本时必须是 null,不是空 Map')
  assert.equal(scanFamilyIds(null, 'G').size, 0, '号集视图的既有语义不得改变(next-plan-id 依赖它)')
  assert.equal(scanFamilyIdHits('', 'G').size, 0, '空文本是"扫过且零命中",不是判不出')
})

test('⑦ 形状锁:扫描只有一份实现,且跳过明细必须真打到 stdout', () => {
  const src = readFileSync(join(HERE, '..', 'live-doc-edit.mjs'), 'utf8')
  assert.match(
    src,
    /import\s*\{\s*collectIdFace,\s*scanFamilyIdHits\s*\}\s*from\s*'\.\/lib\/plan-id-face\.mjs'/,
    '取号出口必须 import 那一份扫描实现,不许在本器里再抄一条号正则',
  )
  assert.doesNotMatch(
    src,
    /\(\?<!\[A-Za-z0-9\]\)/,
    '本器里不得出现第二份"什么算该族的号"正则(§22c)',
  )
  assert.match(
    src,
    /for \(const n of tok\.scanNotes \?\? \[\]\) console\.log/,
    '跳过明细必须打印到 stdout(CAS 报告那一层)',
  )
  const lib = readFileSync(join(HERE, '..', 'lib', 'plan-id-face.mjs'), 'utf8')
  assert.match(
    lib,
    /export function scanFamilyIds\(text, family\) \{\s*const hits = scanFamilyIdHits\(text, family\)/,
    'scanFamilyIds 必须是带位置视图的投影(两个视图共用一条正则)',
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
