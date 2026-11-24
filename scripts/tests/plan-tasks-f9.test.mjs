// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 守门 130 · F9「撞号」判据的**编号位**收窄(§22c 镜像测试;立项票 G-417,2026-09-28)。
 *
 * 这一档判据钉的是:**行文引用与畸形号子串不得被算成"同一个号被两个任务登记了两次"**。
 * 旧口径按"正文开头 48 字窗口内的第一个编号形态"取主键 —— 于是
 * `- [x] ✅(2026-09-28) 一条归因更正:06:24 本会话 D48 提交触发…` 这种**编号位没有号**的行,
 * 会把叙述里的 `D48` 当成本行主键,凭空给 `D48` 添上第二个标题 ⇒ F9 判一组撞号 ⇒ 差值棘轮拦住
 * 每一个碰台账的人,而撞号根本不是他造的。同族还有双前缀畸形号(`G-G-334` / `DD128` / `86G-2`),
 * 窗口从它们肚子里切出一个合法号,又是一组伪撞号。
 *
 * 每条反向用例都自带"旧口径必红"的对照(见 `旧口径必须仍判红` 那几条断言)—— 那才是**变异自证**:
 * 只留反向用例而不证明它会红,等于证明"这一型恰好没被扫到",而"判据失效的表现永远是安静"是本仓
 * 记过最多次的那一型(§22c / 守门 70/76/81/103 同族)。
 *
 * §5c 溯源水印:本文件受 `scripts/watermark.mjs` 管理。
 */
import path from 'node:path'
import { mkdirSync, readdirSync, cpSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { auditPlan, findIdCollisions } from '../lib/plan-task-index.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import {
  f9KeySetOf,
  narrowCollisionsToIdPosition,
  narrowF9Face,
  registersKeyAtIdPosition,
} from '../plan-tasks.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

/** 一把面跑两遍:宽口径(libauditPlan 原样)与窄口径(判据实际用的),两条结论都必须被断言到。 */
const both = (content) => {
  const wide = auditPlan(content)
  return { wide, narrow: narrowCollisionsToIdPosition(content, wide.collisions) }
}

// ── ① 正向锁:两行**编号位**同号 ⇒ 必判撞号(收窄不是放松判据) ──────────────
const TRUE_PAIR = [
  '- [ ]（进行中@2026-09-28/甲）**G-300 甲任务的第一次登记**:说明。',
  '- [x] ✅(2026-09-28) **G-300 乙任务的登记**:另一件完全不同的事。',
].join('\n')

test('正向:两个登记行的编号位同占一个号,必须仍被 F9 判成撞号(收窄不得把真撞号洗绿)', () => {
  const { narrow } = both(TRUE_PAIR)
  assert.equal(narrow.groups.length, 1, `应恰好留一组,实测 ${JSON.stringify(narrow.groups.map((g) => g.key))}`)
  assert.equal(narrow.groups[0].key, 'G-300')
  assert.equal(narrow.groups[0].titleCount, 2, '两个不同标题都必须留在组里')
  // 编号位判据本身对这两行都给 true —— 收窄是靠"行"而不是靠"猜标题像不像"
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
  // 编号位判据必须复用台账既有出口,不得另抄一份"什么算一个号"(§1 行首编号那条同一条禁令)。
  // G-460 起那份实现住在 `lib/plan-task-index.mjs` 的 `isDeclarationRow`(F9 三档与判据共用一份),
  // CLI 侧只剩投影 —— 所以本锁的方向反过来:seam 里**不得**再出现 bodyOfRow/stripOwnKey,
  // 出现就意味着 CLI 又自己算了一遍"什么算声明行"(两处算同一件事必漂移)。
  const seam = src.slice(
    src.indexOf('export function registersKeyAtIdPosition'),
    src.indexOf('export function narrowCollisionsToIdPosition'),
  )
  assert.match(
    seam,
    /isDeclarationRow\(/,
    '编号位判据没走台账层的 isDeclarationRow ⇒ 判据有了第二份实现',
  )
  assert.ok(
    !/bodyOfRow\(|stripOwnKey\(/.test(seam),
    'CLI 层不得再自己剥状态装饰/主键 —— 那 F9 的声明位口径就有两份,收窄前后各一份',
  )
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

// ── ⑦ 真变异(改源码,不是改夹具):把"只看编号位"改回"全文窗口命中" ⇒ 反向用例必红 ──
// 上一节的"旧口径仍判红"证明的是**收窄这一笔**有牙;这一条证明的是**判据本体**有牙 ——
// 把生产模块复制进临时目录、把编号位判据改成恒真(等价收窄前的行为),再用同一批反向夹具跑它。
// 只改复制件,生产文件一个字节不动(共享工作区里改生产文件会伤到并发会话,§12)。
test('真变异:把 registersKeyAtIdPosition 改成恒真(=退回全文匹配口径)后,三条反向用例全部翻红', async () => {
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
    // `scripts/lib` 是**整目录**拷进夹具的,队列按名字跳过了 lib 依赖(避免逐个 walk),于是 lib 里
    // 任何 `from '../x.mjs'` 反向依赖(实测 `lib/gitdir.mjs` → `seal-c-root-stray.mjs`)永远进不了
    // 拷贝名单 ⇒ 变异夹具在 `import` 阶段就 ERR_MODULE_NOT_FOUND。那不是"判据没牙",是**夹具缺件**
    // —— 症状与 §12f 记过的"门体不在 ⇒ 注册指向空"同型(取证链断在结论之前,却长得像结论)。
    // 所以 seeding 阶段按 lib 的真实 import 现取,不手写第二份名单(手写名单必然腐烂,同上方注释那条禁令)。
    for (const f of readdirSync(path.join(ROOT, 'scripts', 'lib'))) {
      if (!f.endsWith('.mjs')) continue
      const t = readFileSync(path.join(ROOT, 'scripts', 'lib', f), 'utf8')
      for (const m of t.matchAll(/from\s+['"]\.\.\/([A-Za-z0-9._-]+\.mjs)['"]/g)) {
        const dep = m[1]
        if (seen.has(dep)) continue
        seen.add(dep)
        queue.push(dep)
      }
    }
    while (queue.length) {
      const rel = queue.shift()
      const abs = path.join(ROOT, 'scripts', rel)
      if (!existsSync(abs)) continue // 取不到就交给 node 自己报,不在夹具里猜
      const txt = readFileSync(abs, 'utf8')
      for (const m of txt.matchAll(/from\s+['"](\.\.?\/[^'"]+)['"]/g)) {
        const dep = m[1].replace(/^\.\.?\//, '')
        if (dep.startsWith('lib/') || seen.has(dep)) continue
        seen.add(dep)
        queue.push(dep)
      }
      cpSync(abs, path.join(dir, 'scripts', rel), { recursive: false })
    }
    const mutated = cli.replace(
      /export function registersKeyAtIdPosition\(rawLine, key\) \{[\s\S]*?\n\}/,
      'export function registersKeyAtIdPosition(rawLine, key) {\n  return !!key\n}',
    )
    assert.notEqual(mutated, cli, '变异没命中 ⇒ 判据函数被改名/改形,本锁须同批改')
    assert.match(mutated, /return !!key/, '变异后的函数体必须真的是恒真')
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
    // 正向那一组在两个口径下都必须是红(变异不影响它)
    const truePair = mod.narrowCollisionsToIdPosition(TRUE_PAIR, auditPlan(TRUE_PAIR).collisions)
    assert.equal(truePair.groups.length, 1, '正向用例在变异面下仍应判红(它本来就该红)')
  } finally {
    rmScratch(dir)
  }
})

// ── ⑧ 真仓正向对照(§22c 红线:判据的对象是真文档的形态,不能全用自造夹具) ─────
test('真仓 HEAD 面:被收窄掉的标题必须逐条都是叙述引用/畸形号,而真撞号一条不许丢', () => {
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
  assert.equal(narrow.groups.length, 1, `真实三行应仍判一组,实测 ${JSON.stringify(narrow.groups)}`)
  assert.equal(narrow.groups[0].key, 'G-267')
  assert.equal(narrow.groups[0].titleCount, 3, '三条都是编号位 ⇒ 一个标题都不许被摘掉')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
