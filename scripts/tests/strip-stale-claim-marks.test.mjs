// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `strip-stale-claim-marks.mjs` 的镜像测试(§22c 模式:判据 import 源脚本的 `__test__`,
 * 本文件零复制判据 —— 复制一份迟早漂成"一边摘牌、一边不摘")。
 *
 * 三件事各钉一环:
 *   ① 摘谁不摘谁(超龄维 / 裸标记两档 / 幂等)——与器物 --self-test 同源实现;
 *   ② 形状锁:器物必须 import `claimMarkOf`,不得自带"什么算挂牌"的正则(本次事故的病根就是两处各写一份);
 *   ③ 派发层(git-guardian 的 sweepStaleClaimMarks)只认机读结论行,拿不到必须落未判定。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { __test__ as strip, planSweep } from '../strip-stale-claim-marks.mjs'
import { claimMarkOf } from '../lib/plan-task-index.mjs'
import { sweepStaleClaimMarks } from '../git-guardian.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const NOW = Date.parse('2026-10-22T12:00:00Z')
const base = { nowMs: NOW, ttlHours: 72, seat: 't', asOf: '2026-10-22' }

test('①摘除集=三枚(两枚超龄租约 + 一枚裸标记),新鲜租约不许动', () => {
  const p = planSweep(strip.FIXTURE, base)
  assert.equal(p.leases.length, 3)
  assert.equal(p.held.length, 1)
  assert.equal(p.ok, true, p.why)
})

test('①注记逐字保留原牌日期与持有者(摘牌可追责)', () => {
  const p = planSweep(strip.FIXTURE, base)
  assert.match(p.text, /原牌 2026-01-01\/甲席 超龄 \d+h/)
  assert.match(p.text, /原牌 2026-01-02\/丙席 超龄 \d+h/)
})

test('①注记只放最小可追责要素,行内长度有上限(依据进提交信息,不糊台账)', () => {
  const d = planSweep(strip.FIXTURE, base)
  assert.match(d.text, /原裸标记无日期/)
  for (const m of d.text.matchAll(/（认领已释放@[^）]*）/g)) {
    assert.ok(m[0].length <= 80, `注记过长(${m[0].length} 字):依据类文字不得写进台账行 —— ${m[0]}`)
  }
  const a = planSweep(strip.FIXTURE, { ...base, legacyByOwnerRuling: '机主 2026-10-22 判定无席位在飞' })
  assert.equal(a.leases.length, 3)
  assert.match(a.text, /机主原话见本轮提交信息/)
  assert.equal(a.ok, true, a.why)
})

test('①超龄维有牙:TTL 收到零时新鲜牌同批可摘', () => {
  assert.equal(planSweep(strip.FIXTURE, { ...base, ttlHours: -1 }).leases.length, 4)
})

test('①幂等:摘过的文本再跑=零可摘(否则每轮都在抖台账)', () => {
  const once = planSweep(strip.FIXTURE, base)
  const again = planSweep(once.text, base)
  assert.equal(again.leases.length, 0)
})

test('②形状锁:器物与守门 109 共用同一份挂牌判据,不得自带正则', () => {
  const src = readFileSync(path.join(HERE, '..', 'strip-stale-claim-marks.mjs'), 'utf8')
  assert.match(
    src,
    /import \{[^}]*claimMarkOf[^}]*\} from '\.\/lib\/plan-task-index\.mjs'/,
    '器物未从单源 import claimMarkOf',
  )
  assert.doesNotMatch(
    src,
    /const\s+\w*CLAIM\w*_RE\s*=\s*new RegExp|const\s+\w*CLAIM\w*_SRC\s*=\s*'（进行中/,
    '器物内另立了一份"什么算挂牌"的正则 —— 这正是 2026-10-22 那次 31 vs 59 漂移的病根',
  )
  // 正向对照:判据本体自带条目行前置(非条目行 ⇒ null)
  assert.equal(claimMarkOf('这段叙述里写着（进行中@2026-01-01/甲）,不是登记行'), null)
  assert.equal(claimMarkOf('- [ ]（进行中@2026-01-01/甲） 登记行')?.form, 'lease')
})

test('③派发层只认机读结论行:stripped 分读正确,拿不到一律未判定', () => {
  const logs = []
  const dir = path.join(HERE, '..', '..', '.ihui-agent', 'tmp', 'gc-claim-test')
  // tickFile 必须每臂唯一:派发层自带 30 分钟节流,复用同一个文件会让第二次运行落进
  // "未到节流窗口"分支而拿到 undefined —— 那是**测试不幂等**,不是器物错(2026-10-22 实犯)。
  const uniq = (k) => path.join(dir, `${k}-${process.pid}-${Date.now()}.json`)
  const r = sweepStaleClaimMarks({
    tickFile: uniq('a'),
    logger: (l) => logs.push(l),
    runner: () => ({ ok: true, out: 'x\nSWEEP-RESULT state=stripped stale=30 held=27 stripped=30 lines=258' }),
  })
  assert.equal(r.state, 'stripped')
  assert.equal(r.stripped, '30')
  assert.equal(r.held, '27')
  assert.match(logs.join('\n'), /代摘 30 枚/)

  const r2 = sweepStaleClaimMarks({
    tickFile: uniq('b'),
    logger: () => {},
    runner: () => ({ ok: true, out: '看起来一切正常,但没有机读行' }),
  })
  assert.equal(r2.state, 'undetermined', '拿不到结论行被读成"无需摘"就是把没做写成做过')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
