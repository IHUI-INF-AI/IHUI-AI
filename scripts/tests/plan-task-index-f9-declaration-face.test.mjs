// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 守门 130 · F9 的**声明位分组**与两档"只报数并报名"的读数(§22c 镜像;立项票 G-460,2026-10-02)。
 *
 * G-460 要收的那一型:F9 的分组输入此前是"正文前 48 字窗口里的第一个编号形态",于是
 * ① 别人的登记行在**正文里**点了我的号,就凭空给我的号添第二个标题;② 畸形号(`G-G-302`)肚子
 * 里的合法子串被切出来顶替别人的第二个标题。两者都不是"两个任务抢同一个号",却都进判据 ⇒
 * 差值棘轮拦住的是**碰台账的人**,不是造撞号的人;而"改号"这一出路对引用型根本不成立(旧号会继续
 * 挂在别人的句子里)。自本票起分组只看声明位,引用与畸形各成一档 —— **挪出判据必须同时报名**,
 * 否则"挪到报数档"与"这一格没人看过"在账面上同形(本仓记过多次:判据失效的表现永远是安静)。
 *
 * 每条反向用例都配一条"宽口径必须仍看得见"的对照 —— 那才是变异自证:绿必须绿在"分组只看声明位"
 * 这一条上,而不是绿在"这一型根本没被扫到"。
 *
 * §5c 溯源水印:本文件受 `scripts/watermark.mjs` 管理。
 */
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { auditPlan, findIdCollisions, f9Faces, isDeclarationRow } from '../lib/plan-task-index.mjs'
import { narrowF9Face, registersKeyAtIdPosition } from '../plan-tasks.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

/** ① 正向:两行**声明位**同号 ⇒ 判据必须仍判一组(收窄不是放松,真撞号一条不许丢) */
const TRUE_PAIR = [
  '- [ ]（进行中@2026-10-02/甲）**G-900 甲任务**:第一件事。',
  '- [x] ✅(2026-10-02) **G-900 乙任务**:另一件完全不同的事。',
].join('\n')
test('正向:两个声明行的声明位同占一个号,必须仍判撞号(三档里只有 collisions 吃它)', () => {
  const f = f9Faces(TRUE_PAIR)
  assert.equal(f.collisions.length, 1, `判据面应恰好一组,实测 ${JSON.stringify(f.collisions.map((g) => g.key))}`)
  assert.equal(f.collisions[0].titleCount, 2, '两个标题都必须留在判据组里')
  assert.equal(f.references.length, 0, '声明位命中不得被记进行文引用档')
  assert.equal(f.malformed.length, 0)
  assert.equal(f.droppedTitles, 0)
  assert.equal(auditPlan(TRUE_PAIR).f9Declared.length, 1, 'auditPlan 必须把声明位面递到面上')
  assert.equal(auditPlan(TRUE_PAIR).counts.collisionGroups, 1)
})

/** ② 反向 + 变异自证:正文引用同一个号 ⇒ 判据面 0 组,而宽口径读数必须仍是 1 组(否则本条没牙) */
const CROSS_REF = [
  '- [ ] **G-901 交叉引用**:这一条才是真登记。',
  '- [x] ✅(2026-10-02) **一条归因更正**:本会话 G-901 提交触发的那次归因是错的。',
].join('\n')
test('反向:行文引用不算第二次登记;宽口径(窗口内任意命中)必须仍造出那一组 —— 变异自证', () => {
  const f = f9Faces(CROSS_REF)
  assert.equal(f.wide.length, 1, `旧口径必须仍判红,否则这条反向用例是假的,实测 ${JSON.stringify(f.wide.map((g) => [g.key, g.titleCount]))}`)
  assert.equal(f.collisions.length, 0, '判据面不得留引用造成的伪组')
  assert.equal(f.droppedTitles, 1, '被摘掉的那一次命中必须如实计数(挪出判据 ≠ 没看见)')
  assert.equal(isDeclarationRow('- [x] ✅(2026-10-02) 本行只是回顾 G-901 已收口,没有登记新任务。', 'G-901'), false)
  assert.equal(registersKeyAtIdPosition('- [x] ✅(2026-10-02) 本行只是回顾 G-901 已收口,没有登记新任务。', 'G-901'), false)
})

/** ③ 引用图必须**报名**:两行正文引用同一号且标题不同 ⇒ references 成一组并给出编号与标题 */
const REF_GRAPH = [
  '- [ ] **G-902 真登记**:一件事。',
  '- [x] ✅(2026-10-01) **回顾甲**:G-902 当时判错了方向。',
  '- [x] ✅(2026-10-02) **回顾乙**:G-902 的结论又被推翻一次。',
].join('\n')
test('引用图一档:非声明位的多个标题必须成组点名,而判据面与它分家(三态不并桶)', () => {
  const f = f9Faces(REF_GRAPH)
  assert.equal(f.collisions.length, 0)
  assert.equal(f.references.length, 1, `引用档应成一组,实测 ${JSON.stringify(f.references.map((g) => [g.key, g.titleCount]))}`)
  assert.equal(f.references[0].key, 'G-902')
  assert.equal(f.references[0].titleCount, 2, '引用档也必须把两侧标题都报出来')
})

/** ④ 畸形号:`G-G-903` 肚子里的 `G-903` 不得顶替真登记的第二个标题,而要单独点名 */
const MALFORMED = [
  '- [ ] G-903 **真登记行**:一件事。',
  '- [ ] G-G-903 **畸形号行**:取号令牌已含族名、正文又手填了一个 G-。',
].join('\n')
test('畸形号单独成档:子串不得进任何分组,而宽口径必须仍切成 G-903 —— 畸形不是"没扫到"', () => {
  const f = f9Faces(MALFORMED)
  assert.ok(f.wide.some((g) => g.key === 'G-903'), '旧口径必须仍把畸形号切成正常号(变异自证)')
  assert.equal(f.collisions.length, 0, '判据面里畸形号永不参与分组')
  assert.equal(f.references.length, 0, '畸形号也不得混进行文引用档 —— 两档的处置动作不同')
  assert.equal(f.malformed.length, 1, `畸形档应点名被切出的那个号,实测 ${JSON.stringify(f.malformed)}`)
  assert.equal(f.malformed[0].key, 'G-903')
})

/** ⑤ 面上字段齐备:三档读数与名单必须同时在面上 —— 缺一项就等于那一档没人算过 */
test('auditPlan 面必须同时递出判据/宽口径/引用图/畸形号四份读数,缺项即失明', () => {
  const a = auditPlan([TRUE_PAIR, CROSS_REF, REF_GRAPH, MALFORMED].join('\n'))
  for (const k of ['f9Declared', 'f9References', 'f9MalformedMasquerade', 'collisions'])
    assert.ok(Array.isArray(a[k]), `面上缺 ${k} —— 那一档没有名单就只有计数`)
  for (const k of ['collisionGroups', 'f9WideGroups', 'f9DeclaredGroups', 'f9NonIdTitles', 'f9ReferenceIds', 'f9MalformedMasqueradeIds'])
    assert.equal(typeof a.counts[k], 'number', `counts 缺 ${k} —— 只报名单不报数同样无从对账`)
  assert.equal(a.counts.f9WideGroups, a.collisions.length, '宽口径组数必须与 collisions 名单同形(判据面另在 f9Declared)')
  const n = narrowF9Face(a, [TRUE_PAIR, CROSS_REF, REF_GRAPH, MALFORMED].join('\n'))
  assert.equal(n.collisions, a.f9Declared, '判定面必须直接取台账那份,不在 CLI 重筛一遍(两处算同一件事必漂移)')
  assert.equal(n.counts.collisionGroups, n.collisions.length, '组数与名单必须一起收窄')
})

/** ⑥ 单一实现锁:分组循环只许有一份,CLI 侧不得再抄"什么算声明行" */
test('单一实现:findIdCollisions 是 f9Faces 的投影,registersKeyAtIdPosition 是 isDeclarationRow 的投影', () => {
  const libSrc = readFileSync(path.join(ROOT, 'scripts', 'lib', 'plan-task-index.mjs'), 'utf8')
  const p = libSrc.indexOf('export function findIdCollisions')
  assert.ok(p >= 0)
  assert.match(libSrc.slice(p, p + 160), /f9Faces\(/, '宽口径名单必须由同一次扫描给出')
  const cliSrc = readFileSync(path.join(ROOT, 'scripts', 'plan-tasks.mjs'), 'utf8')
  const q = cliSrc.indexOf('export function registersKeyAtIdPosition')
  assert.ok(q >= 0)
  const seam = cliSrc.slice(q, cliSrc.indexOf('export function narrowCollisionsToIdPosition'))
  assert.match(seam, /isDeclarationRow\(/, '编号位判据必须有第二份实现之嫌才会在 CLI 里自己剥装饰')
  assert.ok(!/bodyOfRow\(|stripOwnKey\(/.test(seam), 'CLI 层不得再自己剥状态装饰/主键')
})

/** ⑦ 真仓阳性对照(§22c 红线:不得全用自造夹具):被审面上的引用档必须真的非空,而判据面确实变窄 */
test('真仓 HEAD 面:宽口径组数 > 判据组数,且引用图非空并逐条报名 —— 收窄量到的是发生过的事', () => {
  const content = execFileSync('git', ['show', 'HEAD:PROJECT_PLAN.md'], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 1 << 28,
    windowsHide: true,
    timeout: 120000,
    stdio: ['ignore', 'pipe', 'pipe']
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
  })
  const f = f9Faces(content)
  assert.ok(f.wide.length > f.collisions.length, `宽口径必须比判据面多(伪组确实存在),实测 wide=${f.wide.length} declared=${f.collisions.length}`)
  assert.ok(f.references.length > 0, `引用图必须非空,实测 ${JSON.stringify(f.references.map((g) => g.key))}`)
  for (const g of f.references)
    assert.ok(g.titleCount >= 2 && g.titles.length >= 2, `引用档必须逐条报名,实测 ${JSON.stringify(g)}`)
  assert.equal(findIdCollisions(content).length, f.wide.length, '投影读数必须与同源那份宽口径等值')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
