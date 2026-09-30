// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 守门 130 · F9「撞号」判据的**编号位**收窄与**子集/归属**收口(§22c 镜像测试)。
 *
 * 三代判据,各有立项票,镜像例成对钉住(阳性 = 该票登记的误报形态从红变绿,反向 = 真撞号仍红):
 *  - G-417(2026-09-28):行文引用与畸形号子串不得被算成"同一个号被两个任务登记了两次"
 *    —— 判据收窄到**编号位**(`registersKeyAtIdPosition`)。
 *  - G-455(2026-09-30):撞号只判「**未完成 ∧ 编号位**」子集(`countsAsF9Registration`);
 *    仅已完成行组成的组、未完成+已完成同键的组、交叉引用组只报数、分组报名、不判红、不进基线。
 *  - G-815426(2026-09-30):F9 的标题归一化(`normalizeF9Title`)剥掉行尾注记族再比标题
 *    —— 同一任务副本各带不同措辞注记不再是"多个不同标题";F1/F4 的复合主键那份判据一字不动。
 *  - G-681(2026-09-30):F9 基线层**归属过滤** —— 差值档只把"基线缺 ∧ HEAD 也没有"的键
 *    记在本次提交头上,存量键(HEAD 已有)打 ℹ 报名不判红;全量档不过滤;基准面缺逐组明细判未判定。
 *
 * 旧口径(全文窗口命中)的对照仍保留在每条反向用例里(`旧口径必须仍判红` 那几条断言)—— 那才是
 * **变异自证**:只留反向用例而不证明它会红,等于证明"这一型恰好没被扫到",而"判据失效的表现永远是
 * 安静"是本仓记过最多次的那一型(§22c / 守门 70/76/81/103 同族)。
 *
 * §5c 溯源水印:本文件受 `scripts/watermark.mjs` 管理。
 */
import path from 'node:path'
import { mkdirSync, cpSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { auditPlan, compositeKeyOf, findIdCollisions } from '../lib/plan-task-index.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import {
  f9KeySetOf,
  gate,
  narrowCollisionsToIdPosition,
  narrowF9Face,
  normalizeF9Title,
  registersKeyAtIdPosition,
} from '../plan-tasks.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

/** 一把面跑两遍:宽口径(libauditPlan 原样)与窄口径(判据实际用的),两条结论都必须被断言到。 */
const both = (content) => {
  const wide = auditPlan(content)
  return { wide, narrow: narrowCollisionsToIdPosition(content, wide.collisions) }
}

// ── ① 正向锁:两行**未完成 ∧ 编号位**同号 ⇒ 必判撞号(收窄不是放松判据) ──────────────
// G-455(2026-09-30)把判据子集从"编号位"收成"未完成 ∧ 编号位" ⇒ 夹具第三行刻意用已完成行:
// 它必须被状态维摘掉,不得把 titleCount 顶成 3。
const TRUE_PAIR = [
  '- [ ]（进行中@2026-09-28/甲）**G-300 甲任务的第一次登记**:说明。',
  '- [x] ✅(2026-09-28) **G-300 乙任务的登记**:另一件完全不同的事。',
  '- [ ] **G-300 丙任务的登记**:第三件完全不同的事。',
].join('\n')

test('正向:两个**未完成**登记行的编号位同占一个号,必须仍被 F9 判成撞号(已完成行不计入子集)', () => {
  const { narrow } = both(TRUE_PAIR)
  assert.equal(narrow.groups.length, 1, `应恰好留一组,实测 ${JSON.stringify(narrow.groups.map((g) => g.key))}`)
  assert.equal(narrow.groups[0].key, 'G-300')
  assert.equal(
    narrow.groups[0].titleCount,
    2,
    `两个未完成标题都必须留在组里、已完成行不得顶数,实测 ${JSON.stringify(narrow.groups[0])}`,
  )
  assert.deepEqual(
    narrow.groups[0].titles.flatMap((t) => t.lines),
    [1, 3],
    '判据子集里不得出现已完成行的行号(G-455 状态维)',
  )
  assert.equal(
    narrow.droppedGroups,
    0,
    '该组整体仍在判据面里(两条未完成 ⇒ 判红),已完成行只是不计入子集 —— 与"整组只报数"是两回事',
  )
  // 编号位判据本身对这三行都给 true —— 状态维是另一道闸,别把两道混成一道
  for (const g of findIdCollisions(TRUE_PAIR))
    for (const t of g.titles)
      for (const ln of t.lines)
        assert.ok(
          registersKeyAtIdPosition(
            TRUE_PAIR.split('\n')[ln - 1],
            g.key,
          ),
          `编号位行 L${ln} 必须被认成登记`,
        )
})

// ── ② 反向锁:一行编号位 + 另一行正文引用同号 ⇒ **不得**判撞号 ────────────────
const CROSS_REF = [
  '- [ ] **G-301 交叉引用**:这一条才是真登记。',
  // 编号位是「一条归因更正」(无编号形态),窗口于是抓到叙述里的 G-301 —— 旧口径在这里判红。
  '- [x] ✅(2026-09-28) **一条归因更正**:06:24 本会话 G-301 提交触发的那次归因是错的。',
].join('\n')

test('反向:行文引用同号不得算撞号;而旧口径(全文窗口命中)必须仍判红 —— 本条即变异自证', () => {
  const { wide, narrow } = both(CROSS_REF)
  assert.ok(
    wide.collisions.some((g) => g.key === 'G-301' && g.titleCount === 2),
    `旧口径必须仍把这一型判成撞号,否则这条反向用例没有牙(实测宽口径 ${JSON.stringify(wide.collisions.map((g) => [g.key, g.titleCount]))})`,
  )
  assert.equal(narrow.groups.length, 0, `收窄后不得留组,实测 ${JSON.stringify(narrow.groups)}`)
  assert.equal(narrow.droppedTitles, 1, '被摘掉的叙述标题必须如实计数(收窄不是"看不见")')
})

// ── ③ 反向锁:畸形号(双前缀 / 父号带子号 / 归档占位与说明行)不得计入 ──────────
const MALFORMED = [
  '- [ ] G-302 **真登记行**:一件事。',
  // 取号令牌展开值已含族名,正文又手填了一个 G- ⇒ 产出 G-G-302;窗口从它肚子里切出 G-302。
  '- [ ] G-G-302 **畸形号行**:取号竞态留下的脏号,不是第二次登记。',
].join('\n')

test('反向:双前缀畸形号里的合法子串不得被当成本行主键', () => {
  const { wide, narrow } = both(MALFORMED)
  assert.ok(
    wide.collisions.some((g) => g.key === 'G-302'),
    '旧口径必须仍把 G-G-302 切成 G-302 并造出撞号组(变异自证)',
  )
  assert.equal(narrow.groups.length, 0)
  assert.equal(narrow.droppedTitles, 1)
})

const PARENTED = [
  '- [ ] **G-2 撞号逐组定性**:真登记行。',
  // 86G 的第二半:编号位是"86G-2"(父号 + 子序号),不是 G-2;窗口却切出 G-2。
  '- [x] ✅(2026-09-28) **86G-2. 密钥轮换与 kid→多公钥表**(86G 的第二半,仍在账):两半分开做。',
].join('\n')

test('反向:父号带子序号(86G-2)不得被读成 G-2 的第二次登记', () => {
  const { wide, narrow } = both(PARENTED)
  assert.ok(wide.collisions.some((g) => g.key === 'G-2'), '旧口径必须仍判红(变异自证)')
  assert.equal(narrow.groups.length, 0)
})

const ARCHIVED = [
  '<!-- 已归档(2026-09-20):G-303 任务,完整内容在 .ihui-agent/archive/PROJECT_PLAN_2026-09-20.md -->',
  '- [ ] **G-303 真登记**:一件事。',
  // 归档说明行:条目行,但编号位没有号,只在正文里点了历史号。
  '- [x] ✅(2026-09-20) 归档说明:本条 G-303 的正文已搬入 .ihui-agent/archive/PROJECT_PLAN_2026-09-20.md。',
].join('\n')

test('反向:归档占位注释与归档说明行里的历史号不得计入撞号', () => {
  const { wide, narrow } = both(ARCHIVED)
  // 占位注释本身不是条目行 ⇒ 两侧都不该看见它(这一半是把"只认条目行"钉成契约)
  assert.ok(
    wide.collisions.some((g) => g.key === 'G-303'),
    '旧口径下说明行仍造出 G-303 组 ⇒ 变异自证成立',
  )
  assert.equal(narrow.groups.length, 0)
  const noteRow = ARCHIVED.split('\n')[3]
  assert.equal(
    registersKeyAtIdPosition(noteRow, 'G-303'),
    false,
    '说明行的编号位必须给不出主键',
  )
})

// ── ④ 同步性:组数与名单必须一起收窄(否则差值档读组数、点名读名单,红会点不出名) ──
test('narrowF9Face 必须同批改 counts.collisionGroups 与 collisions,并留下宽口径读数', () => {
  const wide = auditPlan(CROSS_REF)
  const a = narrowF9Face(wide, CROSS_REF)
  assert.equal(a.counts.collisionGroups, 0)
  assert.deepEqual(a.collisions, [])
  assert.equal(a.counts.f9WideGroups, 1, '宽口径读数必须留在面上:收窄是"不计判据",不是"没看见"')
  assert.deepEqual(f9KeySetOf(a), [], '收窄后的键集不得再把叙述引用号喂给基线棘轮')
})

// ── ⑤ 装车证明:两把判定面都必须走收窄后的出口,判据不得留一条"宽"旁路 ────────
test('装车证明:main() 的两把面都经 auditFace(=同一次取材里收窄),不得残留 auditPlan(readPlan( 的宽旁路', () => {
  const src = readFileSync(path.join(ROOT, 'scripts', 'plan-tasks.mjs'), 'utf8')
  assert.match(
    src,
    /export function auditFace\(/,
    'auditFace 不在位 ⇒ 收窄没有单一落点,各调用点必然各写一遍',
  )
  assert.match(src, /a = auditFace\(o\.root, o\.face\)/, '当前判定面没走 auditFace')
  assert.match(
    src,
    /preBefore = auditFace\(o\.root, 'head'\)/,
    '差值基准面没走 auditFace ⇒ 两把尺子不同口径,收窄等于没生效',
  )
  assert.ok(
    !/auditPlan\(readPlan\(/.test(src),
    '残留 auditPlan(readPlan(…) 的宽旁路 ⇒ 那一档仍在按全文窗口判撞号',
  )
  // 编号位判据必须复用台账既有出口,不得另抄一份"什么算一个号"(§1 行首编号那条同一条禁令)
  const seam = src.slice(
    src.indexOf('export function registersKeyAtIdPosition'),
    src.indexOf('export function narrowCollisionsToIdPosition'),
  )
  assert.match(seam, /bodyOfRow\(/, '编号位判据没走 bodyOfRow ⇒ 状态装饰会被算进主键区')
  assert.match(seam, /stripOwnKey\(/, '编号位判据没走 stripOwnKey ⇒ 必然另抄了编号正则')
  assert.ok(
    !/G-\\d|D\\d|TASK_ID_PATTERN/.test(seam),
    '编号位判据里不得再写一遍编号族 ⇒ 两处算同一件事必漂移',
  )
})

// ── ⑥ 行号不得进证据文本(§1 第三条禁令:行号在任何一次 append 后都会挪位) ────
test('F9 逐组点名的文案出口只给「编号 + 标题」,不得把行号写进证据文本', async () => {
  const { f9GroupLine } = await import('../plan-tasks.mjs')
  const line = f9GroupLine({
    key: 'G-9',
    titleCount: 2,
    titles: [
      { title: '甲', lines: [11, 12] },
      { title: '乙', lines: [30] },
    ],
  })
  assert.match(line, /「甲」/, '两侧标题必须都在(退化成只报编号等于没报名)')
  assert.match(line, /「乙」/)
  assert.ok(!/@L/.test(line), `证据文本里不得出现行号,实测 ${line}`)
  assert.ok(!/\bL\d/.test(line), `同上,实测 ${line}`)
})

// ── ⑦ 真变异(改源码,不是改夹具):把"登记子集"谓词改成恒真 ⇒ 反向用例必红 ──
// 上一节的"旧口径仍判红"证明的是**收窄这一笔**有牙;这一条证明的是**判据本体**有牙 ——
// 把生产模块复制进临时目录、把登记子集谓词(G-417 编号位 ∧ G-455 未完成,单一靶点)改成恒真
// (等价于收窄前的"任意状态 ∧ 全文窗口命中"),再用同一批反向夹具跑它。
// 只改复制件,生产文件一个字节不动(共享工作区里改生产文件会伤到并发会话,§12)。
test('真变异:把 countsAsF9Registration 改成恒真(=退回"任意状态 ∧ 全文窗口"旧口径)后,四条反向用例全部翻红', async () => {
  const dir = mkScratch('plan-tasks-f9-mut-')
  try {
    mkdirSync(path.join(dir, 'scripts', 'lib'), { recursive: true })
    cpSync(path.join(ROOT, 'scripts', 'lib'), path.join(dir, 'scripts', 'lib'), {
      recursive: true,
      filter: (s) => !/[\\/]\tests?[\\/]/.test(s),
    })
    const cli = readFileSync(path.join(ROOT, 'scripts', 'plan-tasks.mjs'), 'utf8')
    /**
     * 变异复制件必须带上 CLI **传递闭包**里的每一个非 lib 模块。
     * 2026-09-29 实测:枚 `8cbc85847b` 给 `plan-tasks.mjs` 加了 `./live-doc-edit.mjs` 这一条依赖,
     * 本夹具(原来只拷 `scripts/lib` + `check-plan-line-loss.mjs`)当场在**干净 HEAD** 上变红 ——
     * 而红的形态是 `ERR_MODULE_NOT_FOUND`,不是"判据没牙",极易被误读成别的事(§12f:
     * 判据失效的表现是安静或变形,不会是"恰好是我关心的那一句")。
     * 闭包按**被拷文件自己的 import 现取**,不手写第二份名单(手写名单必然腐烂 —— §4 对
     * `RN_ONLY_BRAND_KEYS` 记过同一条),所以今后再加依赖也不会重破这一条。
     */
    const queue = ['plan-tasks.mjs', 'check-plan-line-loss.mjs']
    const seen = new Set(queue)
    while (queue.length) {
      const rel = queue.shift()
      const abs = path.join(ROOT, 'scripts', rel)
      if (!existsSync(abs)) continue // 取不到就交给 node 自己报,不在夹具里猜
      const txt = readFileSync(abs, 'utf8')
      for (const m of txt.matchAll(/from\s+['"](\.\/[^'"]+)['"]/g)) {
        const dep = m[1].replace(/^\.\//, '')
        if (dep.startsWith('lib/') || seen.has(dep)) continue
        seen.add(dep)
        queue.push(dep)
      }
      cpSync(abs, path.join(dir, 'scripts', rel), { recursive: false })
    }
    const mutated = cli.replace(
      /export function countsAsF9Registration\(rawLine, key, state\) \{[\s\S]*?\n\}/,
      'export function countsAsF9Registration(rawLine, key, state) {\n  return true\n}',
    )
    assert.notEqual(mutated, cli, '变异没命中 ⇒ 判据函数被改名/改形,本锁须同批改')
    assert.match(mutated, /return true/, '变异后的函数体必须真的是恒真')
    writeFileSync(path.join(dir, 'scripts', 'plan-tasks.mjs'), mutated, 'utf8')
    cpSync(path.join(ROOT, 'scripts', 'check-plan-line-loss.mjs'), path.join(dir, 'scripts', 'check-plan-line-loss.mjs'))
    const mod = await import(pathToFileURL(path.join(dir, 'scripts', 'plan-tasks.mjs')).href)
    for (const [name, content] of [
      ['交叉引用', CROSS_REF],
      ['双前缀畸形号', MALFORMED],
      ['父号带子序号', PARENTED],
      ['归档说明行', ARCHIVED],
    ]) {
      const got = mod.narrowCollisionsToIdPosition(content, auditPlan(content).collisions)
      assert.ok(
        got.groups.length >= 1,
        `变异面(恒真判据)下"${name}"必须重新被判成撞号 —— 它不红就说明反向用例是假的,实测 ${JSON.stringify(got.groups.map((g) => g.key))}`,
      )
    }
    // 正向那一组在两个口径下都必须是红(变异不影响它)—— 完成行在变异面下也会被算回来,
    // 所以 titleCount 是 3 而不是判据子集的 2;组数两个口径一致才是本断言的点。
    const truePair = mod.narrowCollisionsToIdPosition(TRUE_PAIR, auditPlan(TRUE_PAIR).collisions)
    assert.equal(truePair.groups.length, 1, '正向用例在变异面下仍应判红(它本来就该红)')
    assert.equal(truePair.groups[0].titleCount, 3, '变异面(恒真)下已完成行也被算回 ⇒ 3 个标题')
  } finally {
    rmScratch(dir)
  }
})

// ── ⑧ 真仓正向对照(§22c 红线:判据的对象是真文档的形态,不能全用自造夹具) ─────
// G-455(2026-09-30)之后,这三行(1 条未完成 + 2 条已完成,三个真实不同题)从判据子集移到
// "未完成+已完成同键"只报数桶 —— 分组报名必须一个不少(收窄是"不计判据",不是"看不见")。
test('真仓 HEAD 面:1 未完成 + 2 已完成的真实同号组进"同键两态"只报数桶,三个标题逐个报名', () => {
  const src = readFileSync(path.join(ROOT, 'scripts', 'tests', 'plan-tasks.test.mjs'), 'utf8')
  const m = /const REAL_G267_ROWS = \[([\s\S]*?)\n\]/.exec(src)
  assert.ok(m, '取不到 REAL_G267_ROWS ⇒ 真仓样本被搬走,本锁须同批改')
  const rows = m[1]
    .split('\n')
    .filter((l) => l.trim().startsWith("'"))
    .map((l) => l.trim().replace(/,$/, '').replace(/^'|'$/g, ''))
    .join('\n')
  assert.ok(rows.includes('G-267'), '真仓三行必须都含 G-267(样本被掏空时本条不得算通过)')
  const { narrow } = both(rows)
  assert.equal(
    narrow.groups.length,
    0,
    `判据子集只有 1 个未完成标题 ⇒ 不得判撞号,实测 ${JSON.stringify(narrow.groups)}`,
  )
  assert.equal(narrow.mixedStateGroups.length, 1, '该组必须进"未完成+已完成同键"只报数桶')
  assert.equal(
    narrow.mixedStateGroups[0].titleCount,
    3,
    '只报数桶必须保住全部 3 个标题(报名缩水 = 把不可清偿的账藏起来)',
  )
  assert.equal(narrow.mixedStateGroups[0].key, 'G-267')
})

// ── ⑨ G-815426(2026-09-30):F9 标题归一化 —— 行尾注记漂移的副本族不算撞号 ──────────
// 形态逐字取自 HEAD 面实测(`74.` 组 10 份副本,标题差全在 `〔…〕` 注记上;
// `68` 组同型:`流式中切换模型→终止后自动带入新模型〔` —— `【` 是 titleOf 的截断符 ⇒ 悬挂空开口)。
const ANNOT_COPIES = [
  '- [ ] **G-815432 流式中切换模型**:主行。',
  '- [ ] **G-815432 流式中切换模型 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记,派单以那条为准〕**:副本。',
  '- [ ] **G-815432 流式中切换模型〔第四份同主键副本(现读该编号共 4 行)**:无尾注的裸抄件。',
].join('\n')

test('G-815426 阳性:同任务副本的行尾注记漂移不得再算撞号(宽口径仍红 = 变异自证);F1/F4 复合主键一字不动', () => {
  const { wide, narrow } = both(ANNOT_COPIES)
  assert.ok(
    wide.collisions.some((g) => g.key === 'G-815432' && g.titleCount === 3),
    `宽口径必须仍判 3 个"不同标题"(否则归一化这一笔没有牙),实测 ${JSON.stringify(wide.collisions)}`,
  )
  assert.equal(narrow.groups.length, 0, `归一化并成同题 ⇒ 撞号组消失,实测 ${JSON.stringify(narrow.groups)}`)
  // F1/F4 的复合主键那份判据一字不动:三行仍是三个复合键(注记进标题恰是它把副本认成同题的机制)
  const keys = ANNOT_COPIES.split('\n').map((l) => compositeKeyOf(l))
  assert.equal(
    new Set(keys).size,
    3,
    `F1/F4 复合主键不得被归一化波及(两套口径各判各的事),实测 ${JSON.stringify(keys)}`,
  )
})

test('G-815426 反向:真撞号(题面主体不同)不得被归一化洗绿;题面自带的括注不得被剥', () => {
  const truePair =
    '- [ ] **G-815433 归一化后仍不同的甲任务**:第一件事。\n' +
    '- [ ] **G-815433 归一化后仍不同的乙任务〔注记〕**:另一件事。'
  const { narrow } = both(truePair)
  assert.equal(
    narrow.groups.length,
    1,
    `题面主体不同 ⇒ 仍判撞号,实测 ${JSON.stringify(narrow.groups.map((g) => [g.key, g.titleCount]))}`,
  )
  assert.equal(normalizeF9Title('CLI全屏TUI决策〔'), 'CLI全屏TUI决策', '悬挂空开口(截断产物)必须剥')
  assert.equal(normalizeF9Title('CLI全屏TUI决策〔第四份同主键副本'), 'CLI全屏TUI决策', '悬挂含副本声明的必须剥')
  assert.equal(normalizeF9Title('X〔【进展】2026-09-29 收口'), 'X', '悬挂含进展标记的必须剥')
  assert.equal(
    normalizeF9Title('部署〔含金丝雀、灰度〕'),
    '部署〔含金丝雀、灰度〕',
    '题面自带的完整括注(无注记标记)不得剥 —— 无条件剥会把真不同题合并成假同题',
  )
  assert.equal(
    normalizeF9Title('部署〔含金丝雀'),
    '部署〔含金丝雀',
    '题面自带括注被截断出的悬挂(内容无标记)同样不得剥',
  )
})

// ── ⑩ G-455(2026-09-30):只报数三族进报名桶,不进判据面 ⇒ 不进基线键集 ─────────────
test('G-455 成对:done-only / 交叉引用两族只报数,键集与逐组报名都如实落在 f9ReportOnly', () => {
  const doneOnly =
    '- [x] ✅(2026-09-25) **G-815434 历史已完成甲**:已落账。\n' +
    '- [x] ✅(2026-09-28) **G-815434 历史已完成乙**:另一件已落账的事,同号。'
  const w1 = auditPlan(doneOnly)
  assert.equal(w1.collisions.length, 1, '变异自证:宽口径必须仍把两条已完成行算成撞号')
  const n1 = narrowCollisionsToIdPosition(doneOnly, w1.collisions)
  assert.equal(n1.groups.length, 0)
  assert.equal(n1.doneOnlyGroups.length, 1)
  const face = narrowF9Face(w1, doneOnly)
  assert.deepEqual(
    f9KeySetOf(face),
    [],
    '基线键集不得含只报数桶(把不可清偿的读数冻成基线 = 给腐烂发通行证)',
  )
  assert.equal(face.counts.f9DoneOnlyGroups, 1, '计数必须如实留在面上(收窄不是看不见)')
  assert.equal(face.f9ReportOnly.doneOnly[0].key, 'G-815434', '只报数桶必须分组报名')
  // 交叉引用族(G-417 摘掉的)也必须有名字 —— ② 的 CROSS_REF 在这里复核报名形态
  const w2 = auditPlan(CROSS_REF)
  const n2 = narrowCollisionsToIdPosition(CROSS_REF, w2.collisions)
  assert.deepEqual(
    n2.crossRefGroups.map((g) => g.key),
    ['G-301'],
    `交叉引用组必须逐组报名,实测 ${JSON.stringify(n2.crossRefGroups)}`,
  )
})

// ── ⑪ G-681(2026-09-30):F9 基线层归属过滤 —— 两条反向锁(纯函数 + 构造面 + 私有基线) ──
// 刻意用 scratch 目录里自建的基线文件,不依赖仓库瞬时状态(守门 103 T12 那一课):
// 同一份"存量键在 HEAD 已有、基线没有"的面,--staged 档必须绿而全量档必须红(锁 A);
// 基准面缺逐组明细 ⇒ 未判定 exit 2(锁 B)。
const ATTR_BASE = { F1: 0, F2: 0, F3: 0, F4: 0, F4b: 0, F6: 0, F8: 0, F5: 21, F9: ['Z-OTHER-KEY'] }
const gOfAttr = (key) => ({
  key,
  titleCount: 2,
  titles: [
    { title: `${key} 标题甲`, lines: [2] },
    { title: `${key} 标题乙`, lines: [3] },
  ],
})
const attrFace = (gs) => ({
  counts: {
    forks: 0,
    voidRows: 0,
    rotatedPointers: 0,
    rotatedAuto: 0,
    rotatedNoExit: 0,
    dupOpenCopies: 0,
    verbatimDupCopies: 0,
    dupBlocks: 0,
    newUndisposed: 0,
    mergeNotes: 99,
    collisionGroups: gs.length,
  },
  staleRows: [],
  collisions: gs,
})
const capGate = (fn) => {
  const cap = []
  const log = console.log
  console.log = (s) => cap.push(String(s))
  try {
    return { rc: fn(), cap }
  } finally {
    console.log = log
  }
}
const mkAttrRoot = () => {
  const dir = mkScratch('plan-f9-g681-')
  mkdirSync(path.join(dir, 'scripts'), { recursive: true })
  writeFileSync(
    path.join(dir, 'scripts', 'plan-task-state-baseline.json'),
    JSON.stringify(ATTR_BASE),
    'utf8',
  )
  return dir
}

test('G-681 锁A:同一份"存量键在 HEAD 已有、基线没有"的面 --staged 必须绿(ℹ 报名)而全量必须红', () => {
  const dir = mkAttrRoot()
  try {
    const stock = [gOfAttr('Z-STOCK-KEY')]
    // --staged 档:a 与 before 同面(本次提交没带来任何撞号变化),基线缺的键全是存量 ⇒ 绿 + ℹ
    const staged = capGate(() => gate(attrFace(stock), false, dir, attrFace(stock), null))
    assert.equal(
      staged.rc,
      0,
      `存量键不记在本次提交头上 ⇒ 差值档必须绿,实测 exit ${staged.rc}:${JSON.stringify(staged.cap.slice(0, 3))}`,
    )
    assert.ok(
      staged.cap.some((x) => x.includes('ℹ F9 基线缺项 1 组此刻已在 HEAD 面') && x.includes('Z-STOCK-KEY')),
      `存量键必须打 ℹ 报名(静默等于放行),实测 ${JSON.stringify(staged.cap)}`,
    )
    // 全量档:同一份面,没有基准面 ⇒ 不过滤 ⇒ 存量照旧红、逐组名单照旧给(强度一字未松)
    const full = capGate(() => gate(attrFace(stock), false, dir, null, null))
    assert.equal(full.rc, 1, `全量档必须仍红,实测 exit ${full.rc}`)
    assert.ok(
      full.cap.some((x) => x.includes('❌ 基线棘轮') && x.includes('Z-STOCK-KEY')),
      `全量档必须点名该键,实测 ${JSON.stringify(full.cap.slice(0, 2))}`,
    )
  } finally {
    rmScratch(dir)
  }
})

test('G-681 归属只滤存量:等量换键面(差值绿)上 HEAD 没有的新键仍进红档,存量键只走 ℹ;--strict 仍拦', () => {
  const dir = mkAttrRoot()
  try {
    const a = attrFace([gOfAttr('Z-STOCK-KEY'), gOfAttr('Z-FRESH-KEY')])
    const before = attrFace([gOfAttr('Z-STOCK-KEY'), gOfAttr('Z-OLD-KEY')])
    const swap = capGate(() => gate(a, false, dir, before, null))
    assert.equal(swap.rc, 0, '提交链档:归属后的基线红不拦提交(与修前同一定级 —— 只改归属不改强度)')
    assert.ok(
      swap.cap.some((x) => x.includes('❌ 基线棘轮') && x.includes('Z-FRESH-KEY')),
      `HEAD 没有的新键必须仍进红档名单,实测 ${JSON.stringify(swap.cap)}`,
    )
    assert.ok(
      !swap.cap.some((x) => x.includes('基线新增撞号') && x.includes('Z-STOCK-KEY')),
      '存量键不得混进红档名单(它已在 ℹ 里报过名)',
    )
    assert.ok(
      swap.cap.some((x) => x.includes('ℹ F9 基线缺项') && x.includes('Z-STOCK-KEY')),
      '存量键必须走 ℹ 报名',
    )
    const strict = capGate(() => gate(a, true, dir, before, null))
    assert.equal(strict.rc, 1, '--strict 问责档仍对归属后的新键拦下(强度一字未松)')
  } finally {
    rmScratch(dir)
  }
})

test('G-681 锁B:差值基准面缺逐组明细 ⇒ 未判定 exit 2,不冒红也不记绿', () => {
  const dir = mkAttrRoot()
  try {
    const a = attrFace([gOfAttr('Z-STOCK-KEY')])
    // 半张面:报了组数却不带逐组明细 ⇒ "哪些键已在 HEAD 面"无从判定 ⇒ 归属过滤本身未判定
    const halfBefore = { counts: { ...attrFace([]).counts, collisionGroups: 2 }, staleRows: [] }
    const got = capGate(() => gate(a, false, dir, halfBefore, null))
    assert.equal(
      got.rc,
      2,
      `必须 exit 2(未判定),实测 exit ${got.rc}:${JSON.stringify(got.cap.slice(0, 2))}`,
    )
    assert.ok(
      got.cap.some((x) => x.includes('无法判定') && x.includes('逐组明细')),
      `必须大声报"未判定",实测 ${JSON.stringify(got.cap)}`,
    )
  } finally {
    rmScratch(dir)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
