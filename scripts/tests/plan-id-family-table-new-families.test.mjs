// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * §22c 镜像测试:编号族表**新字母族**的三处一致性与两位号上限(票 Z-1 结清,2026-10-30 立)。
 *
 * 立因(Z-1 票面现读):G/D/O 三族令牌全灭(G=SCAN_FACE_FULL 候选窗 58~67 九枚逐枚命中、
 * D=POOL_FULL 池内空闲 0、O=NO_CONTIGUOUS_LEASE_WINDOW 空闲 40 却腾不出连续 10 号窗),而
 * 2026-10-24 的既有拍板是「族满开新字母族、**永不升位数**」。族表认不出的字母,对**取号器与
 * 主键判据同时隐身** —— 该判决的现场就是本票自己:HEAD 面那枚具名首号 `Z-1` 在补表前
 * `headIdOf` 与 `keyOfRow` 双双读 `null`,连"隐身点名维"`unseenRegistrantIds` 也读 0(两字符
 * 短号落在它自己的门槛外)。
 *
 * 本文件钉七件事(判据一律 import 源脚本导出,测试内不抄第二份族表/正则):
 *  T1 族表新增字母只追加在表尾 ⇒ G 仍居首(挑族顺序=既有行为逐字不变);
 *  T2 新族对复合主键与防丢面**不再隐身**(keyOfRow/headIdOf/usedIdsOfPrefix 三把尺同判);
 *  T3 新族经**唯一分配判据**真发得出号(不是读代码猜的);
 *  T4 族表外的字母仍对判据隐身(主键 null + 取号器 `no-such-family`),而点名维必须出声;
 *  T5 两位号上限 99 的形态不变(池满拒发,绝不发 >99 的号);
 *  T6 F 系列归并器与族表同源:同一行在补表前给不出折叠、补表后给得出且可逆;
 *  T7 单一真相源接线锁:族表定义全仓只有一处,三个消费点各自 import 它,本测试零复制。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  TASK_ID_PATTERN,
  headIdOf,
  unseenRegistrantIds,
} from '../check-plan-line-loss.mjs'
import { keyOfRow, usedIdsOfPrefix } from '../lib/plan-task-index.mjs'
import { idFamilyLetters, probeIdFamily } from '../auto-triage.mjs'
import { LEASE_POOL_MAX, POOL_EXHAUST_REASON } from '../lib/plan-id-lease.mjs'
import { __test__ as LDE } from '../live-doc-edit.mjs'
import { __test__ as MERGE } from '../plan-tasks-merge.mjs'

const resolveIdTokens = LDE.resolveIdTokens
const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..')

/** 本次补表新增的字母(按票面 Z-1 结清的现读;测试只问族表本身,不自立第二份清单)。 */
const NEW_LETTERS = ['Z', 'Y', 'Q', 'K']

/**
 * Z-1 之后按 goal-b25 追加的族(RP)。单字母已无可用位,理由写在族表旁注里:唯一未被占用的单字母
 * E 在现读宽面上池内命中 40/99、连续 10 号干净窗 0 个(命中全是十六进制提交前缀)⇒ 补 E 等于把
 * 本批要治的 SCAN_FACE_FULL 复制一遍。这里只钉"它是**追加**、不是插队":族表前缀顺序逐字不变。
 */
const APPENDED_FAMILIES = ['RP']


/** 该族在夹具底稿里的实占声明位行(与 usedIdsOfPrefix 同形)。 */
const claimed = (fam, nums, sep = '-') =>
  nums.map((n) => `- [ ] ${fam}${sep}${n} 夹具占位登记${n}。`).join('\n')

// ── T1 ──
test('T1 新字母追加在表尾:候选字母表含 Z/Y/Q/K,G 仍居首(挑族行为逐字不变)', () => {
  const fams = idFamilyLetters(TASK_ID_PATTERN)
  for (const L of NEW_LETTERS)
    assert.ok(fams.includes(L), `族表未解析出 ${L}:${fams.join('/')}`)
  assert.equal(fams[0], 'G', 'G 居首 = 2026-10-26 接线时的顺序,补族不得把既有优先级搅动')
  assert.deepEqual(fams.slice(0, 10), ['G', 'D', 'O', 'B', 'P', 'W', 'WP', 'A', 'H', 'V'])
  assert.deepEqual(
    fams.slice(10),
    [...NEW_LETTERS, ...APPENDED_FAMILIES],
    '新族必须整批落在表尾(插在中间=改挑族顺序)',
  )
  assert.ok(fams.every((f) => /^[A-Za-z]+$/.test(f)), `令牌族只吃字母:${fams.join('/')}`)
})

// ── T2 ──
test('T2 新族不再隐身:keyOfRow / headIdOf / usedIdsOfPrefix 三把尺同判同一枚号', () => {
  const row = `- [ ] Z-1  **取号池已饱和** —— 夹具里复刻票面的具名首号形态。`
  assert.equal(keyOfRow(row), 'Z-1', '复合主键必须读到声明位(补表前实测为 null)')
  assert.equal(headIdOf(row), 'Z-1', '防丢面的行首编号必须读到(补表前实测为 null)')
  const u = usedIdsOfPrefix(`${row}\n- [ ] Z-7 另一枚。`, 'Z')
  assert.ok(u, '取号集合不得判"该族无行"')
  assert.equal(u.max, 7)
  assert.equal(u.template, 'Z-%d', '书写形状由该族自己现读决定(带横杠⇒发号也带横杠)')
  // 横杠可选那一形态同样吃(D 族同一条理由:注记形态不得再隐身)
  assert.equal(keyOfRow('- [ ] Y7 不带横杠的首号形态。'), 'Y7')
})

// ── T3 ──
test('T3 新族经唯一分配判据真发得出号:号码 ≤99 且不与底稿撞', () => {
  const face = `${claimed('Z', [1, 2])}\n- [ ] Q1 备用族首号。`
  const row = '- [ ] {{NEXT_ID:Z}} 本轮唯一新登记标题不会与占位行同题'
  const tok = resolveIdTokens([row], face, null, { machineId: 'seatA' })
  assert.equal(tok.ok, true, `新族必须真发得出号,实际 reason=${tok.reason}`)
  const issued = String(tok.lines?.[0] ?? '').replace(/^\s*-\s\[[ x]\]\s*/, '').split(/\s/)[0]
  const m = /^Z-?(\d+)$/.exec(issued)
  assert.ok(m, `发号形态必须落在本族书写形状上,实得:${issued}`)
  assert.ok(Number(m[1]) <= LEASE_POOL_MAX, `发号越界:${issued} > ${LEASE_POOL_MAX}`)
  assert.ok(![1, 2].includes(Number(m[1])), `不得重发底稿已占的号:${issued}`)
  // 探针走的是 auto-triage 同一张表(次名重试与 --families 共用读数)
  const p = probeIdFamily('Z', { faceText: face, machineId: 'seatA' })
  assert.equal(p.status, 'issuable', `探针读数漂开:${JSON.stringify(p)}`)
})

// ── T4 ──
test('T4 族表外的字母仍对判据隐身:主键 null + 取号器拒发,而点名维必须出声', () => {
  const fams = idFamilyLetters(TASK_ID_PATTERN)
  // 反证字母由族表本身选出(不写死字母 ⇒ 将来真补了这一族,本例自动换一枚仍在表外的)
  const hidden = ['T', 'U', 'F', 'X', 'R', 'S', 'M', 'N', 'J', 'I', 'C', 'E', 'L'].find(
    (L) => !fams.includes(L),
  )
  assert.ok(hidden, `族表已把反证字母全部登记:${fams.join('/')} ⇒ 本维需换测法,不得静默跳过`)
  const row = `- [ ] ${hidden}-10 隐身测试行:族表认不出 ⇒ 三把尺都读不到。`
  assert.equal(keyOfRow(row), null, '族表外的字母不得混进复合主键')
  assert.equal(headIdOf(row), null, '族表外的字母不得混进防丢面行首编号')
  assert.equal(usedIdsOfPrefix(`${row}\n- [ ] ${hidden}-11 另一枚。`, hidden), null)
  const tok = resolveIdTokens(
    [`- [ ] {{NEXT_ID:${hidden}}} 本轮唯一新登记标题不会与占位行同题`],
    row,
    null,
    { machineId: 'seatA' },
  )
  assert.equal(tok.ok, false, '族表外的字母绝不能被当成"能发"')
  assert.match(String(tok.reason), new RegExp(`no-such-family:${hidden}`), `实得 reason=${tok.reason}`)
  // 但"隐身"本身必须大声:点名维按形状收集,不受族表约束(§0.3 没判绝不写成判过)
  const named = unseenRegistrantIds(row)
  assert.equal(named.length, 1, `隐身声明位必须逐条点名,实得 ${named.length} 条`)
  assert.equal(named[0].token, `${hidden}10`)
})

// ── T5 ──
test('T5 两位号上限 99 的形态不变:池满只拒发,绝不发 >99 的号', () => {
  assert.equal(LEASE_POOL_MAX, 99, '池上限 = 2026-10-24 拍板的两位数,补族不得顺手改位数')
  const face = claimed('Z', Array.from({ length: 99 }, (_, i) => i + 1))
  const tok = resolveIdTokens(
    ['- [ ] {{NEXT_ID:Z}} 本轮唯一新登记标题不会与占位行同题'],
    face,
    null,
    { machineId: 'seatA' },
  )
  assert.equal(tok.ok, false, '池内空闲 0 枚必须拒绝,而不是把号升到三位数')
  assert.equal(tok.exhaustion.cursor.reason, POOL_EXHAUST_REASON.poolFull)
  assert.equal(tok.exhaustion.cursor.poolMax, LEASE_POOL_MAX)
  assert.ok(!('lines' in tok), '拒绝路径不得交回任何改写后的行(零发号面)')
  // 正控:同一入口让出连续窗后立刻恢复可发(证明 T5 的拒发不是恒红)
  const freed = claimed(
    'Z',
    Array.from({ length: 89 }, (_, i) => i + 1),
  )
  const again = resolveIdTokens(
    ['- [ ] {{NEXT_ID:Z}} 本轮唯一新登记标题不会与占位行同题'],
    freed,
    null,
    { machineId: 'seatA' },
  )
  assert.equal(again.ok, true, `让出连续窗后应恢复可发,实得 reason=${again.reason}`)
  const n = Number(/Z-?(\d+)/.exec(again.lines[0])?.[1] ?? 0)
  assert.ok(n >= 90 && n <= 99, `可发号必须落在池内 90..99,实得 ${n}`)
})

// ── T6 ──
test('T6 F 系列归并器与族表同源:新族行给得出孪生折叠,且折叠可逐字还原', () => {
  const line = '- [ ] Z-9 同一件事的第二份逐字相同待办(夹具)'
  const keeper = '- [ ] Z-8 同一件事的持有行(夹具)'
  assert.equal(keyOfRow(line), 'Z-9', '前提:该行的键在补表后读得出')
  const folded = MERGE.buildTwinFold(line, keeper, '2026-10-30')
  assert.ok(folded, '补表前 buildTwinFold 对这一族返回 null(没有键可折)⇒ 现在必须给得出')
  assert.match(folded, /原编号 Z-9/, '折叠沿革必须带上该族自己的编号(与 TWIN_ID_RE 同源)')
  assert.equal(MERGE.stripTwinFold(folded), line, '折叠必须可逆:不可逆=在改别人的登记')
  assert.equal(MERGE.isTwinFolded(folded), true)
})

// ── T7 ──
test('T7 单一真相源接线锁:族表定义全仓只有一处,三个消费点各自 import,本测试零复制', () => {
  const read = (rel) => readFileSync(join(ROOT, rel), 'utf8')
  const src = read('scripts/check-plan-line-loss.mjs')
  assert.equal(
    (src.match(/^const ID = String.raw`/gm) ?? []).length,
    1,
    '族表底稿在门体内只能有一行(两处各写一遍必然漂移)',
  )
  assert.match(src, /export const TASK_ID_PATTERN = ID/, '族表必须仍从这一处导出')
  for (const rel of [
    'scripts/lib/plan-task-index.mjs',
    'scripts/auto-triage.mjs',
    'scripts/plan-tasks-merge.mjs',
  ]) {
    const s = read(rel)
    assert.match(
      s,
      /import\s*\{[^}]*\bTASK_ID_PATTERN\b[^}]*\}\s*from\s*'[^']*check-plan-line-loss\.mjs'/s,
      `${rel} 未从唯一真相源 import 族表 ⇒ 消费点脱钩`,
    )
  }
  // 本测试自己的形状锁:判据一律 import,不抄第二份族表/位数上限。
  // ⚠ Forbidden 形态按**行首定义**判,而不是按"文件里出现过这串字"判:上面那条接线锁的
  // 断言字面量本身含 `export const TASK_ID_PATTERN = ID`,一把会读到自己说明文字的尺子
  // 拦得住抄写、也拦得住解释它(unseenRegistrantIds 的分隔符注释记过同一型)。
  const me = read('scripts/tests/plan-id-family-table-new-families.test.mjs')
  assert.doesNotMatch(me, /^\s*(?:export\s+)?const TASK_ID_PATTERN\b/m, '测试内不得再定义编号族(§22c)')
  assert.doesNotMatch(me, /^\s*(?:export\s+)?const LEASE_POOL_MAX\b/m, '测试内不得自立池上限(必须 import LEASE_POOL_MAX)')
  assert.doesNotMatch(me, /G-\\d\+\[a-z\]/, '测试内不得抄族表字面量')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
