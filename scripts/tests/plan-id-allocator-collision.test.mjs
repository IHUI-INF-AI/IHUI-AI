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
 * 夹具:本机自有段 G-90~G-99(主键=段尾号 G-99),段内 G-90/G-91 是**声明位**登记行
 * (⇒ `usedIdsOfPrefix` 看得见,不进候选),下一枚空闲号 G-92 只以**正文引用**形态存在 ——
 * 正是"段内空闲序"与"文中已声明的号"重合的那一刻。
 *
 * 2026-10-24 改夹具(池上限降到两位数、段容量 10):旧夹具用 G-901~G-950 的自有段,
 * 池式取号只认 end ≤ 99 的段 ⇒ 旧段整段作废、取号器改走"池内新占窗"(发到 G-20 一类),
 * 于是本文件六条对照全部量到另一条路径上。段与号改成池内形态后,受测行为逐条不变:
 * 段内空闲序、命中即跳过、逐枚带位置点名、无重合时逐字同发。
 */
function occupiedFixture(proseLines) {
  const ledgerLines = [
    '# 临时台账(G-14 夹具)',
    '',
    '- [x] G-99 〔千段租约〕 本机=' + MACHINE + ' 段=G-90~G-99(取号器专用行)',
    '- [ ] G-90 **段内已声明的既有题零** 正文',
    '- [ ] G-91 **段内已声明的既有题甲** 正文',
    ...proseLines,
    '',
  ]
  return scratchLedger({ ledgerLines })
}

test('① 阳性对照(改动前):未过滤候选序的第一枚就是撞上的那个号', () => {
  const prose = ['承 G-92 的取证:这一号只在正文引用里出现,不是登记行的声明位。']
  const { face, ledgerText } = occupiedFixture(prose)
  const r = __test__.resolveIdTokens([TOKEN('新登记甲')], face, null, { machineId: MACHINE })
  assert.equal(r.ok, true, `夹具必须能发号;实得 ${JSON.stringify({ reason: r.reason })}`)
  assert.equal(
    r.scanReport[0].firstCandidate,
    'G-92',
    '改动前(无全文件扫描)发出去的正是未过滤候选序第一枚 —— 这一条就是"改动前会发出撞号"的取证',
  )
  assert.equal(r.scanReport[0].family, 'G')
  // 撞号确实只活在**文件面**上:声明位口径(`usedIdsOfPrefix`)看不见它,全文件扫描才看得见。
  assert.ok(!/^\s*-\s\[[ xX]\]\s*G-92/m.test(ledgerText), '夹具里 G-92 不得是声明位(否则测的是另一条判据)')
  assert.ok(scanFamilyIds(face, 'G').has(92), '全文件扫描必须看见正文引用里的 92')
  assert.equal(ledgerText.includes('承 G-92'), true)
})

test('② 阳性对照(改动后):跳过并逐枚打印命中行号', () => {
  const prose = ['承 G-92 的取证:这一号只在正文引用里出现,不是登记行的声明位。']
  const { face, ledgerText } = occupiedFixture(prose)
  const r = __test__.resolveIdTokens([TOKEN('新登记甲')], face, null, { machineId: MACHINE })
  assert.equal(r.assigned, 'G-93', '段内 92 已被占 ⇒ 必须顺延到 93(不是跨段、不是重占)')
  assert.deepEqual(r.leaseClaims, [], '跳过发生在自有段内 ⇒ 不得因此另占新段(千段租约规则不变)')
  assert.equal(r.scanReport[0].skipped.length, 1)
  const skip = r.scanReport[0].skipped[0]
  assert.equal(skip.id, 'G-92')
  const expectedLine = ledgerText.split('\n').findIndex((l) => l.includes('承 G-92')) + 1
  assert.equal(skip.sites[0].line, expectedLine, `命中位置必须报台账真实行号(期望 ${expectedLine})`)
  assert.match(skip.sites[0].snippet, /G-92/, '片段必须把命中的号带出来,否则点名人还得自己再搜一遍')
  // 逐枚打印:一行一枚,带"哪一行",而不是一句"某某号已被占"。
  const detail = r.scanNotes.filter((n) => n.includes('跳过 G-92'))
  assert.equal(detail.length, 1, `必须逐枚给出跳过明细;实得 ${JSON.stringify(r.scanNotes)}`)
  assert.ok(detail[0].includes(`第 ${expectedLine} 行`), `明细必须带位置;实得 ${detail[0]}`)
  assert.ok(detail[0].includes('顺延'), '必须说明去向(顺延取下一枚),不只是"跳过"')
  // 落地的号绝不能再是扫描号集里的号(这是本票的判据本体)。
  assert.ok(!scanFamilyIds(face, 'G').has(93))
})

test('③ 阳性对照(连登三票,2026-10-22 病型):三枚号都被占 ⇒ 三票各拿一个不撞的新号', () => {
  // 病型原文:一席走 `{{NEXT_ID:G}}` 连登三票,拿到的 G-924/G-926/G-929 每一枚都已挂在别席既存题上。
  // 池降到两位后同一病型的号域是 92/93/94(段内空闲序 92..98)。
  const prose = [
    '<!-- 已归档(2026-10-21):✅(2026-10-21) **G-92 别席既存题甲** —— 完整内容在归档件 -->',
    '<!-- 已归档(2026-10-21):✅(2026-10-21) **G-93 别席既存题乙** —— 完整内容在归档件 -->',
    '<!-- 已归档(2026-10-21):✅(2026-10-21) **G-94 别席既存题丙** —— 完整内容在归档件 -->',
  ]
  const { face } = occupiedFixture(prose)
  const r = __test__.resolveIdTokens([TOKEN('新票甲'), TOKEN('新票乙'), TOKEN('新票丙')], face, null, {
    machineId: MACHINE,
  })
  assert.equal(r.ok, true)
  assert.equal(r.assigned, 'G-95,G-96,G-97', '三个候选(92/93/94)全被占 ⇒ 顺延到 95/96/97')
  const ids = r.assigned.split(',')
  assert.equal(new Set(ids).size, 3, '同一轮连登不得发出重复号')
  const scanned = scanFamilyIds(face, 'G')
  for (const id of ids) assert.ok(!scanned.has(Number(id.slice(2))), `${id} 仍在扫描号集里 ⇒ 撞号`)
  for (const skipId of ['G-92', 'G-93', 'G-94'])
    assert.ok(
      r.scanNotes.some((n) => n.includes(`跳过 ${skipId}`) && n.includes('第 ')),
      `${skipId} 必须逐枚点名并带位置;实得 ${JSON.stringify(r.scanNotes)}`,
    )
})

test('④ 反向对照(无重合):发出的号与改动前逐字相同,且不产出任何跳过噪声', () => {
  const { face } = occupiedFixture(['正文引用的都是段外的号:G-120 与 G-200 只是别处取证。'])
  const r = __test__.resolveIdTokens([TOKEN('新登记甲')], face, null, { machineId: MACHINE })
  assert.equal(r.ok, true)
  assert.equal(r.assigned, 'G-92', '段内首个空闲号照发(不得恒跳过)')
  assert.equal(
    r.scanReport[0].firstCandidate,
    'G-92',
    '正常路径:发号必须与"改动前那一枚"逐字相同(本票不许顺手改配额/号段/候选序)',
  )
  assert.deepEqual(r.scanNotes, [], '没有命中时不得产出跳过点名(正常路径输出与改动前逐字相同)')
  assert.deepEqual(r.leaseNotes, [
    `号段租约:本机=${MACHINE} 在自有段 G-90~G-99 内按空闲序连号(本次首号=G-92)`,
  ])
})

test('⑤ 归档件侧的重合同样算占(占用面 = 台账 ⊕ 归档件,不是只看台账)', () => {
  const { face } = scratchLedger({
    ledgerLines: [
      '# 临时台账(G-14 夹具)',
      '- [x] G-99 〔千段租约〕 本机=' + MACHINE + ' 段=G-90~G-99(取号器专用行)',
      '- [ ] G-90 **段内已声明的既有题零** 正文',
      '- [ ] G-91 **段内已声明的既有题甲** 正文',
    ],
    archiveLines: [
      '### 已归档',
      '承 G-92 的取证:这一号只活在归档件的正文里(不是登记行的声明位,窄面结构上看不见)。',
    ],
  })
  const r = __test__.resolveIdTokens([TOKEN('新登记甲')], face, null, { machineId: MACHINE })
  assert.equal(r.assigned, 'G-93', '归档件里已占的 92 必须跳过(窄面发号正是本缺陷的症状)')
  assert.ok(r.scanReport[0].skipped.some((s) => s.id === 'G-92'))
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

/**
 * ⑧/⑧b/⑧c —— G-35 形态 B(2026-10-25 主会话裁决采纳):第一发号出口也吃**工作树副本**那一维。
 *
 * 病型:他席手写工作树副本(未提交)登记了 G-92,HEAD 台账上 92 仍空闲 ⇒ 旧口径(只扫 HEAD 宽面)
 * 把它当空闲发出,他席一提交就是同号两行 —— 第二出口(next-plan-id 的 scanWork)早扫了这一面,
 * 第一出口没扫 = 两出口同漂。修法:resolveIdTokens 吃 opts.worktreeText,副本上独有的号一并算已占
 * (同一把尺 scanFamilyIdHits);并集方向(HEAD 已含的不损),缺省 undefined 行为逐字同形(旧调用方零感知),
 * null(读不到)⇒ 警告由调用方 catch 出声、本函数不造新硬闸。
 */
test('⑧ 形态 B 阳性对照:工作树手填未提交的号不当作空闲发出(G-35 主会话裁决采纳档)', () => {
  const { face } = occupiedFixture([])
  const wtLines = ['# 工作树副本(他席未提交的现场)', '- [ ] G-92 **他席手填未提交题** 正文', '']
  const r = __test__.resolveIdTokens([TOKEN('新登记甲')], face, null, {
    machineId: MACHINE,
    worktreeText: wtLines.join('\n'),
  })
  assert.equal(r.ok, true, `夹具必须能发号;实得 ${JSON.stringify({ reason: r.reason })}`)
  assert.equal(r.assigned, 'G-93', '工作树上未提交的 G-92 必须被顶掉 ⇒ 顺延 G-93')
  assert.equal(r.scanReport[0].skipped.length, 1)
  const skip = r.scanReport[0].skipped[0]
  assert.equal(skip.id, 'G-92')
  assert.equal(skip.fromWorktree, true, '命中来源必须标注工作树(行号按工作树文件,不标注会核错行)')
  assert.equal(skip.sites[0].line, 2, '行号必须是工作树文件的真实行号')
  // 明细必须点明来源面:运维照"第 2 行"去 HEAD 台账核会核到别人那一行上。
  const detail = r.scanNotes.filter((n) => n.includes('跳过 G-92'))
  assert.equal(detail.length, 1, `必须逐枚给出跳过明细;实得 ${JSON.stringify(r.scanNotes)}`)
  assert.ok(detail[0].includes('工作树副本第 2 行'), `明细必须带工作树来源;实得 ${detail[0]}`)
  assert.ok(detail[0].includes('(未提交)'), `明细必须写明未提交;实得 ${detail[0]}`)
  // 落地的号绝不能是工作树号集里的号(本票判据本体)。
  assert.ok(!scanFamilyIdHits(wtLines.join('\n'), 'G').has(93))
})

test('⑧b 形态 B 双向对照:HEAD 证据优先、缺省 undefined 与 null 都退回旧行为(不造新硬闸)', () => {
  // ① HEAD 宽面已命中的号保留 HEAD 证据(并集方向:不删不减,fromWorktree 不得误标)
  const prose = ['承 G-92 的取证:这一号在 HEAD 台账正文里,也在工作树副本里。']
  const { face, ledgerText } = occupiedFixture(prose)
  const wt = ['- [ ] G-92 **工作树同号行** 正文', ''].join('\n')
  const r = __test__.resolveIdTokens([TOKEN('新登记甲')], face, null, {
    machineId: MACHINE,
    worktreeText: wt,
  })
  assert.equal(r.assigned, 'G-93')
  const skip = r.scanReport[0].skipped[0]
  assert.equal(skip.fromWorktree, false, 'HEAD 面已命中的号保留 HEAD 证据(行号按台账,并集方向不倒扣)')
  const expectedLine = ledgerText.split('\n').findIndex((l) => l.includes('承 G-92')) + 1
  assert.equal(skip.sites[0].line, expectedLine, '来自 HEAD 面的命中必须报台账行号')
  // ② 缺省 undefined(旧调用方)⇒ 行为与该档加入前逐字同形:G-92 照发、零噪声(不得比改前更堵)
  const legacy = __test__.resolveIdTokens([TOKEN('新登记甲')], occupiedFixture([]).face, null, {
    machineId: MACHINE,
  })
  assert.equal(legacy.assigned, 'G-92', '缺省 undefined ⇒ 本维缺席,行为逐字同形')
  assert.deepEqual(legacy.scanNotes, [])
  // ③ null(调用方读不到,警告已由调用方 catch 出声)⇒ 退回 HEAD 宽面,不造新硬闸
  const nulled = __test__.resolveIdTokens([TOKEN('新登记甲')], occupiedFixture([]).face, null, {
    machineId: MACHINE,
    worktreeText: null,
  })
  assert.equal(nulled.assigned, 'G-92')
  assert.deepEqual(nulled.scanNotes, [])
})

test('⑧c 形态 B 装车形状锁:CAS 循环必须真读工作树副本并传参,警告必须点名 path 与原因', () => {
  const src = readFileSync(join(HERE, '..', 'live-doc-edit.mjs'), 'utf8')
  assert.match(
    src,
    /worktreeText = readFileSync\(resolve\(root, doc\), 'utf8'\)/,
    'CAS 循环必须真读工作树副本(只加参数不传值 = 没装车,造好没装车那一型)',
  )
  assert.match(
    src,
    /manualCheck: !replacements,\s*worktreeText,/,
    'resolveIdTokens 的调用点必须真传 worktreeText',
  )
  assert.match(
    src,
    /工作树副本 \$\{doc\} 读不到\(/,
    '读不到的警告必须点名 path(§0.3:失效方向是多要一次定向说明,不是安静退回)',
  )
  assert.match(
    src,
    /本轮实时占用面退回 HEAD 宽面/,
    '警告必须写明退回后的面(与 next-plan-id 同一档措辞,两出口同话)',
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
