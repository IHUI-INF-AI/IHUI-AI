// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 守门 130 · F9「撞号」的**活题面**判据(§22c 镜像测试;立项票 G-455 + G-45,2026-10-29 b25-gate130)。
 *
 * 判据一句话:**真撞号 = 同一编号下 ≥2 个「仍有未勾活行」的不同题面。**
 * 已完成历史行(`- [x]`)与正文交叉引用都不算。实现单源在 `scripts/lib/plan-collision.mjs`,
 * `plan-tasks.mjs` 只做适配 —— 本文件既钉**结论**,也钉**单源**(源码锁那一条)。
 *
 * 每条"不判红"的用例都配一条"必须仍判红"的反向用例(§22c 变异自证):只留反向用例、不证明
 * 判据的口径会变,等于证明"这一型恰好没被扫到"—— 而"判据失效的表现永远是安静"是本仓
 * 记过最多次的那一型(守门 70/76/81/103 同族)。
 *
 * §5c 溯源水印:本文件受 `scripts/watermark.mjs` 管理。
 */
import path from 'node:path'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { auditPlan, f9Faces } from '../lib/plan-task-index.mjs'
import { HISTORY_REASON, splitLiveCollisions } from '../lib/plan-collision.mjs'
import { f9Ratchet, narrowF9Face, newCollisionGroups } from '../plan-tasks.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

/** 同一把面走一遍判定链(`auditPlan` → `narrowF9Face`),与 CLI 逐字同路。 */
const faceOf = (content) => narrowF9Face(auditPlan(content), content)

/**
 * 夹具口径:**行首编号 + 题面**。题面必须真的不同(前缀不同),否则 F9 的前缀套叠并桶会先把它并成
 * 一组 —— 那测的就不是本层的判据了。
 */
const ROW = {
  liveA: '- [ ] **G-612 活票甲搬运链**:一件事。',
  liveB: '- [ ] **G-612 活票乙归档轴**:完全另一件事。',
  doneA: '- [x] **G-612 活票甲搬运链**:一件事。',
  doneB: '- [x] ✅(2026-10-01) **G-612 活票乙归档轴**:完全另一件事。',
}

/** ① 反向锁(变异自证):两个题面各有未勾活行 ⇒ 必须仍判一组红。 */
test('真撞号:同一编号下两个题面各有未勾活行 ⇒ 必须判红(收窄不得吃掉这一型)', () => {
  const content = [ROW.liveA, ROW.liveB].join('\n')
  const f = faceOf(content)
  assert.equal(f.counts.collisionGroups, 1, `实测 ${JSON.stringify(f.counts.collisionGroups)}`)
  assert.equal(f.collisions[0].key, 'G-612')
  assert.equal(f.collisions[0].titleCount, 2)
  assert.equal(f.counts.f9SettledGroups, 0, '活撞号不得被算进历史档')
})

/** ② 正向:整组都是已完成行 ⇒ 只报数、报名、报成因,不进判红面。 */
test('已完成历史行:整组 `- [x]` ⇒ 不判红,但必须报名并给出成因(all-done)', () => {
  const content = [ROW.doneA, ROW.doneB].join('\n')
  const f = faceOf(content)
  assert.equal(f.counts.collisionGroups, 0, '历史行不得进判红面(否则红与任何提交无关地恒亮)')
  assert.equal(f.counts.f9SettledGroups, 1, '降档必须报名 —— 从红路挪走与"没人看过"不得同形')
  assert.equal(f.counts.f9SettledAllDone, 1, '成因必须分开报数')
  assert.equal(f.f9Settled[0].key, 'G-612')
  assert.equal(f.f9Settled[0].titleCount, 2, '降档名单必须保留题目/题面,否则报数变成一个无法定位的整数')
})

/** ③ 正向:混合组(一半已完成、一半还活着)⇒ 只有一个活题面 ⇒ 不是"两件事抢一个号"。 */
test('混合组:只剩一个活题面 ⇒ 不判红(旧判据在这一型上恒红且不可清偿)', () => {
  const content = [ROW.doneA, ROW.liveB].join('\n')
  const f = faceOf(content)
  assert.equal(f.counts.collisionGroups, 0, '一个活题面没有竞争者 ⇒ 不是撞号')
  assert.equal(f.counts.f9SettledGroups, 1)
  assert.equal(f.counts.f9SettledAllDone, 0, '这一型不得被算成"整组已完成"')
  assert.equal(f.f9Settled[0].key, 'G-612')
})

/** ④ 正向:正文里点别人的号(编号位不是本行主键)⇒ 引用,不是第二次登记。 */
test('正文交叉引用:编号只出现在正文里 ⇒ 不判红(归引用图只报数)', () => {
  const content = [
    '- [ ] **G-613 主行**:这件事本身。',
    '- [ ] 复核时顺带点了 G-613 一嘴,但本行不是它的第二次登记。',
    '- [ ] 又一次提到 G-613,仍然只是叙述。',
  ].join('\n')
  const f = faceOf(content)
  assert.equal(f.counts.collisionGroups, 0, '引用不得当撞号(§1:宁可少判,不能把引用判成撞号)')
  assert.equal(f.counts.f9SettledGroups, 0, '引用也不得混进历史档 —— 两档各有名字')
})

/** ⑤ 判据单源 + 会计恒等:判红 + 降档 = 声明位总组数,任何一份语料上都成立。 */
test('会计恒等:判红组 + 降档组 必须等于声明位总组数(每条夹具逐个核)', () => {
  const corpus = [
    [ROW.liveA, ROW.liveB],
    [ROW.doneA, ROW.doneB],
    [ROW.doneA, ROW.liveB],
    [ROW.liveA, ROW.doneB],
    [ROW.liveA, ROW.liveB, ROW.doneA],
  ]
  for (const rows of corpus) {
    const content = rows.join('\n')
    const a = auditPlan(content)
    const f = narrowF9Face(a, content)
    assert.equal(
      f.counts.collisionGroups + f.counts.f9SettledGroups,
      a.counts.f9DeclaredGroups ?? a.f9Declared.length,
      `判红 + 降档 ≠ 声明位总组数(少同步一处账面就自相矛盾)。语料 ${JSON.stringify(rows)}`,
    )
    // 纯函数层同一条恒等(不经 CLI):两处各算一次必漂移,所以这里核对的是**同一个实现**
    const split = splitLiveCollisions(content, a.f9Declared ?? [])
    assert.equal(split.live.length + split.history.length, (a.f9Declared ?? []).length)
  }
})

/**
 * ⑥ 两档口径一致(G-45 的诉求):**同一事实不许一档绿一档红**。
 *
 * 三档语义写死在这里,三档都已被断言:
 *  - 本次新增的一撞号 ⇒ 差值档红 ∧ 基线档红(两档同结论);
 *  - 两边都没有、只有基线缺 ⇒ 差值档绿、基线档红**但归属过滤后不记在本次头上**(报数不判红);
 *  - 什么都没变 ⇒ 两档都绿。
 */
test('两档口径一致:同一输入下 差值档 与 基线档 结论必须同向(或按声明的归属档解释)', () => {
  const beforeText = [ROW.liveA, ROW.liveB].join('\n') // HEAD 面:已有 G-612 一组
  const before = faceOf(beforeText)
  const cleanText = '- [ ] **G-620 无关的一行**:与撞号无关。'
  const clean = faceOf(cleanText)

  // 情形甲:相对基准面新增一组真撞号 ⇒ 两档都必须红
  const newText = [beforeText, '- [ ] **G-621 新甲轴**:新事。', '- [ ] **G-621 新乙轴**:另一件新事。'].join('\n')
  const now = faceOf(newText)
  const diffRed = newCollisionGroups(now, before).map((g) => g.key)
  assert.deepEqual(diffRed, ['G-621'], `差值档必须点名新增的那一组,实测 ${JSON.stringify(diffRed)}`)
  const baseRed = f9Ratchet({ F9: ['G-612'] }, now)
  assert.equal(baseRed.kind, 'red')
  assert.deepEqual(baseRed.added, ['G-621'], `基线档点名的必须是同一组,实测 ${JSON.stringify(baseRed)}`)

  // 情形乙:什么都没变 ⇒ 两档都绿
  assert.equal(newCollisionGroups(before, before).length, 0)
  assert.equal(f9Ratchet({ F9: ['G-612'] }, before).kind, 'ok')

  // 情形丙:基线缺、HEAD 面已有(别人跳门塞进 HEAD 的存量)⇒
  //   差值档看不见(它与本次改了什么无关,绿),基线档红但**归属过滤后为空** ⇒ 不记在本次头上。
  const stock = f9Ratchet({ F9: [] }, before)
  assert.equal(stock.kind, 'red', '基线档必须看得见"跳门塞进 HEAD"那一型')
  assert.equal(newCollisionGroups(before, before).length, 0, '差值档对这一型结构上看不见(这是设计:量纲不同)')
  const headKeys = new Set((before.collisions ?? []).map((g) => g.key))
  assert.deepEqual(
    stock.added.filter((k) => !headKeys.has(k)),
    [],
    '归属过滤后必须为空 —— 存量不得记在本次提交头上(否则每一次台账提交都被逼跳门 = G-45 原病)',
  )
  // 反面:干净面 + 空基线 ⇒ 两档都绿(证明上面那条红是"事实"而不是"判据恒红")
  assert.equal(f9Ratchet({ F9: [] }, clean).kind, 'ok')
})

/** ⑦ fail-closed:行号/题面取不到 ⇒ 仍判红(不得当成"没有活行")。 */
test('fail-closed:组明细取不到题面或行号 ⇒ 仍进判红面', () => {
  const content = [ROW.doneA, ROW.doneB].join('\n')
  const noTitles = splitLiveCollisions(content, [{ key: 'X-1', titleCount: 2, titles: [] }])
  assert.equal(noTitles.live.length, 1, '没有题面明细 = 没量到,不是"量到没有活行"')
  const unknownLines = splitLiveCollisions(content, [
    { key: 'Y-1', titleCount: 2, titles: [{ title: '甲', lines: [999] }, { title: '乙', lines: [998] }] },
  ])
  assert.equal(unknownLines.live.length, 1, '行号取不到 ⇒ 状态未知 ⇒ 宁可多判')
})

/** ⑧ 单源锁:判据实现只许有一份;台账层不得被本批改动(它是 b25-poolG 席的面)。 */
test('单源:plan-collision 只 import 台账既有导出,不自带编号正则;plan-tasks 不再自算状态', () => {
  const collisionSrc = readFileSync(path.join(ROOT, 'scripts', 'lib', 'plan-collision.mjs'), 'utf8')
  assert.match(collisionSrc, /from '\.\/plan-task-index\.mjs'/, '必须复用台账导出,不得自造取材层')
  assert.ok(
    !/(?:^|[^\\w$])\/\[[^\n]*\\d[^\n]*\/[gimsuy]*\.test\(/m.test(collisionSrc),
    '本层不得出现"编号形态"正则 —— 那等于第二份"什么算撞号"',
  )
  const cliSrc = readFileSync(path.join(ROOT, 'scripts', 'plan-tasks.mjs'), 'utf8')
  const p = cliSrc.indexOf('export function splitF9SettledGroups')
  assert.ok(p >= 0, '适配出口仍在(三个既有调用点在用)')
  const seam = cliSrc.slice(p, p + 1200)
  assert.match(seam, /splitLiveCollisions\(/, '适配层必须调单源实现,不得自己再判一遍状态')
  assert.ok(!/stateByLine/.test(seam), '适配层不得再自建"行号→状态"表(那一份必然与单源漂开)')
})

/**
 * ⑨ 粗尺不可达锁(G-75 那台的病根):`ratchetViolations` 在**没拿到逐组明细**时退化成
 * "组数 > 基线键数"的粗尺 —— 两档量纲不同,基线键集只许收窄 ⇒ 那一天起就是恒红门。
 * 修法(前批已落地)是每个调用点都传第三个参数。这条锁把"退回粗尺"钉死:源码里任何一次
 * `ratchetViolations(` 调用都必须带面,否则本测红。
 */
test('粗尺不可达:scripts 下每一处 ratchetViolations 调用都必须传第三参(逐组明细)', () => {
  const dir = path.join(ROOT, 'scripts')
  const files = ['plan-tasks.mjs', 'git-sync-converge.mjs', 'union-converge.mjs']
  let seen = 0
  for (const f of files) {
    const full = readFileSync(path.join(dir, f), 'utf8')
    // 只扫**生产段**:自测函数体内刻意构造粗尺用例(它们断言的就是粗尺文案本身),不是调用点。
    const cut = full.indexOf('function selfTest()')
    const src = cut > 0 ? full.slice(0, cut) : full
    const re = /(?:^|[^.\w])ratchetViolations\(([^)\n]*)\)/gm
    for (const m of src.matchAll(re)) {
      const args = m[1].trim()
      if (!args || args.includes('items') === false) continue
      if (args.split(',')[0].trim() === 'null') continue
      seen += 1
      assert.ok(
        args.split(',').length >= 3,
        `${f} 的 ratchetViolations(${args}) 少了第三参 ⇒ 退化成"组数 > 基线键数"的粗尺(量纲不同 = 恒红门)`,
      )
    }
  }
  assert.ok(seen > 0, '一条调用点都没扫到 ⇒ 本锁没装成(正则失效会静默全绿)')
})

/** ⑩ 真仓阳性对照(§22c 红线:不得全用自造夹具)。 */
test('真仓对照:HEAD 面 F9 每一组都必须满足"≥2 个活题面",且降档组必须报名', () => {
  const content = readFileSync(path.join(ROOT, 'PROJECT_PLAN.md'), 'utf8')
  const declared = f9Faces(content).collisions
  const f = faceOf(content)
  assert.equal(f.counts.collisionGroups + f.counts.f9SettledGroups, declared.length)
  assert.equal(f.counts.f9SettledGroups, f.f9Settled.length, '降档数与名单必须同形')
  assert.equal(
    f.counts.f9SettledAllDone + (f.counts.f9SettledGroups - f.counts.f9SettledAllDone),
    f.counts.f9SettledGroups,
    '两种成因之和必须等于降档总数',
  )
  assert.ok(
    HISTORY_REASON.ALL_DONE === 'all-done' && HISTORY_REASON.ONE_LIVE_TITLE === 'one-live-title',
    '成因枚举是报名文案的一部分,改名必须同步改消费点',
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
