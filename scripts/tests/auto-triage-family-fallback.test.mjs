// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * §22c 镜像测试:auto-triage.mjs 的**取号族现读**(2026-10-29 立,结清 L28694「写入台账」最后一格)。
 *
 * 立因(全部现读,不是转述):分诊器物 2026-10-26 接线时把族字母烘成常量 `{{NEXT_ID:G}}`,四天后
 * G 族对本席现读恒回 `pool-exhausted:G / stage=scan-filter`(占用面让得出窗、窗内候选被台账⊕归档件
 * 的引用面全灭 = 真成因 SCAN_FACE_FULL),于是 `.ihui-agent/state/auto-triage-ledger.jsonl` 375 行里
 * `registered` **0 枚** —— "写入台账"这一格从未通过。仓库既有裁量口径:正解是**换字母族/开新字母**,
 * 不是削 G-14 的引用面(散点归档对这一型实测 Δ=0)。
 *
 * 本文件钉七件事(判据一律 import 源脚本 `__test__`,本文件零复制取号/归因判据):
 *  A1 候选族字母表来自族表唯一真相源 `TASK_ID_PATTERN`(族表加一枚字母⇒候选多一枚,不抄清单);
 *  A2 探针的五档读数(issuable/exhausted/no-rows/rejected/undetermined)与"号由分配判据给"这一条;
 *  A3 首族被拒⇒按现读换下一族,令牌只吃族字母;
 *  A4 无一族可发⇒一 spawn 都不发(绝不拿真登记去试错,更不写"未取号");
 *  A5 重试分档:仅 `pool-exhausted` 重试次名族,其他失败原因一次就收(重试不会变);
 *  A6 向后兼容:没给族的 registerToPlan 逐字仍是 `{{NEXT_ID:G}}`(既有镜像锁 ④);
 *  A7 形状锁:本器零第二份取号尺子(不 import usedIdsOfPrefix/nextTaskIdLabel),登记分支必须先挑族;
 *  A8 真仓端到端只读:现跑一遍各族探针⇒读数结构齐全且成因句只由 lib 渲染(不断言具体哪一族可发,
 *     那是一台恒红门 —— 号池水位是现读的)。
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { __test__ as tr } from '../auto-triage.mjs'
import { TASK_ID_PATTERN } from '../check-plan-line-loss.mjs'
import {
  EXHAUST_STAGE,
  POOL_EXHAUST_REASON,
  SCAN_FACE_EXHAUST_REASON,
  describeExhaustion,
} from '../lib/plan-id-lease.mjs'

const SRC = readFileSync(new URL('../auto-triage.mjs', import.meta.url), 'utf8')

/** 族表解析出的字母集合(与源脚本共用同一份实现 ⇒ 断言的是"单源成立",不是"我抄的那份成立")。 */
const famsOfTable = () => tr.idFamilyLetters(TASK_ID_PATTERN)

const okRow = (line) => ({ ok: true, lines: [line] })
const exhausted = (family, stage = EXHAUST_STAGE.scanFilter) => ({
  ok: false,
  reason: `pool-exhausted:${family}`,
  exhaustion: { stage, family, candidates: 9, scanHitCount: 9 },
})

// ── A1 ──
test('A1 候选族字母表由族表唯一真相源现解析(G 居首、守门不进、族表加一枚就多一枚)', () => {
  const list = famsOfTable()
  assert.ok(list.length >= 3, `族表解析出的候选字母过少:${list.join('/')}`)
  assert.equal(list[0], 'G', 'G 居首=族表自身顺序(2026-10-26 接线时的行为逐字同序)')
  assert.ok(list.every((f) => /^[A-Za-z]+$/.test(f)), `令牌族只吃字母,实得:${list.join('/')}`)
  assert.ok(!list.some((f) => /守门/.test(f)), '"守门 NN"不是字母族,进令牌照被拒发')
  // 族表多一枚字母 ⇒ 候选表下一轮就多一枚(证明这里没有第二份清单可漂)
  assert.deepEqual(tr.idFamilyLetters('G-\\d+|Z\\d+|守门\\s*\\d+'), ['G', 'Z'])
  // 坏输入 ⇒ 空数组(调用方落未判定,不猜)
  assert.deepEqual(tr.idFamilyLetters(''), [])
  assert.deepEqual(tr.idFamilyLetters(null), [])
})

// ── A2 ──
test('A2 探针五档读数齐全;可发时的号是分配判据给的,本器只搬读数', () => {
  const mk = (r) => tr.probeIdFamily('G', { faceText: '- [ ] G1 x', machineId: 'seatA', resolve: () => r })
  assert.equal(mk(okRow('- [ ] G-42 标题')).status, 'issuable')
  assert.equal(mk(okRow('- [ ] G-42 标题')).label, 'G-42', '编号取自 resolveIdTokens 改写后的行首')
  assert.equal(mk(exhausted('G')).status, 'exhausted')
  assert.equal(mk({ ok: false, reason: 'no-such-family:G' }).status, 'no-rows')
  assert.equal(mk({ ok: false, reason: 'duplicate-title' }).status, 'rejected')
  assert.equal(mk(null).status, 'undetermined', '探针返回形状未知 ⇒ 未判定,绝不记绿')
  assert.equal(
    tr.probeIdFamily('G', {
      faceText: '- [ ] G1 x',
      resolve: () => {
        throw new Error('炸了')
      },
    }).status,
    'undetermined',
    '判据抛异常 ⇒ 未判定(§0.3),不得当成"这族不行"',
  )
  assert.equal(mk({ ok: true, lines: [] }).label, null, '判据没给行首 ⇒ 不编造首号')
})

// ── A3 ──
test('A3 首族被扫描灭窗 ⇒ 换到下一枚现读可发族,令牌只吃族字母', () => {
  const p = tr.pickIdFamily({
    faceText: '- [ ] G1 行\n- [ ] O1 行',
    families: ['G', 'O'],
    machineId: 'seatA',
    resolve: (lines) => (lines[0].includes('{{NEXT_ID:G}}') ? exhausted('G') : okRow(lines[0].replace('{{NEXT_ID:O}}', 'O7'))),
  })
  assert.equal(p.ok, true)
  assert.equal(p.family, 'O')
  assert.equal(p.token, '{{NEXT_ID:O}}')
  assert.equal(p.label, 'O7')
  assert.equal(p.readings.length, 2, '全部探完(次名重试与 --families 共用这张表,不必再探一遍)')
  assert.equal(p.readings[0].exhaustion.stage, EXHAUST_STAGE.scanFilter)
})

// ── A4 ──
test('A4 无一族可发 ⇒ ok:false 且一 spawn 都不发(绝不拿真登记试错、绝不写"未取号")', () => {
  const p = tr.pickIdFamily({
    faceText: '- [ ] G1 行',
    families: ['G', 'O'],
    resolve: (lines) => exhausted(/NEXT_ID:(\w+)/.exec(lines[0])[1]),
  })
  assert.equal(p.ok, false)
  assert.equal(p.token, null, '不可发时不得交出任何令牌形态')
  let spawns = 0
  const r = tr.registerWithFamilyFallback(
    { source: 'api-logs', fingerprint: 'fp', title: 't', evidence: 'e' },
    p,
    () => {
      spawns++
      return { status: 0, stdout: '回读', stderr: '' }
    },
  )
  assert.equal(r.ok, false)
  assert.equal(spawns, 0, '族全灭还要 spawn = 把注定失败的登记往共享台账里灌')
  assert.match(r.why, /无一族现读可发号/)
  // 未判定档同样零 spawn,并带 undetermined 标记(调用方按 exit 2 收)
  const und = tr.pickIdFamily({ faceText: '', families: ['G'] })
  assert.equal(und.ok, false)
  assert.equal(und.undetermined, true, '底稿面取不到 ⇒ 未判定,绝不回落"就用 G"')
  assert.equal(tr.registerWithFamilyFallback({ source: 's', fingerprint: 'f', title: 't', evidence: 'e' }, und).ok, false)
})

// ── A5 ──
test('A5 只有 pool-exhausted 才重试次名族;其他失败原因一次就收;重试次数有上限', () => {
  const p = tr.pickIdFamily({
    faceText: '- [ ] D1 行',
    families: ['D', 'O', 'B', 'P'],
    resolve: (lines) => okRow(lines[0]),
  })
  const seq = []
  const r = tr.registerWithFamilyFallback(
    { source: 's', fingerprint: 'fp1', title: 't', evidence: 'e' },
    p,
    (_c, _a, opts) => {
      seq.push(opts.env.LIVE_BLOCK_FILE)
      return { status: 2, stdout: '', stderr: '号池已满(pool-exhausted:D)' }
    },
    { maxSpawns: 2 },
  )
  assert.equal(r.ok, false)
  assert.equal(seq.length, 2, `重试上限必须生效(实得 ${seq.length} 次)`)
  assert.deepEqual(r.tried.map((t) => t.family), ['D', 'O'])
  let m = 0
  const r2 = tr.registerWithFamilyFallback(
    { source: 's', fingerprint: 'fp2', title: 't', evidence: 'e' },
    p,
    () => {
      m++
      return { status: 2, stdout: '', stderr: 'duplicate-title 同题已在册' }
    },
  )
  assert.equal(r2.ok, false)
  assert.equal(m, 1, '非 pool-exhausted 的失败换族也不会变 ⇒ 不重试')
  assert.match(r2.why, /duplicate-title/)
})

// ── A6 ──
test('A6 registerToPlan:没给族逐字仍是 {{NEXT_ID:G}}(既有镜像锁),给了族按现读写,行内不自算号', () => {
  const seen = []
  const spy = (_c, _a, opts) => {
    seen.push({ block: readFileSync(opts.env.LIVE_BLOCK_FILE, 'utf8'), env: opts.env })
    return { status: 0, stdout: '✅ 回读:本块每一条非空行都在 HEAD 里', stderr: '' }
  }
  tr.registerToPlan({ source: 'mail-failure', fingerprint: 'fpa', title: '甲', evidence: 'e' }, spy)
  assert.match(seen[0].block, /^- \[ \] \{\{NEXT_ID:G\}\} \[auto-triage\] 甲/)
  tr.registerToPlan({ source: 's', fingerprint: 'fpd', title: '丁', evidence: 'e', family: 'O' }, spy)
  assert.match(seen[1].block, /^- \[ \] \{\{NEXT_ID:O\}\} \[auto-triage\] 丁/)
  // 坏族名(带数字/符号)⇒ 令牌只吃字母,回落 G 而不是产出消费不掉的令牌字面量
  tr.registerToPlan({ source: 's', fingerprint: 'fpb', title: '乙', evidence: 'e', family: 'V3' }, spy)
  assert.match(seen[2].block, /\{\{NEXT_ID:G\}\}/)
  for (const s of seen) assert.ok(!/^- \[ \] [A-Za-z]+-?\d+/.test(s.block), '本器不得自算号')
})

// ── A7 ──
test('A7 形状锁:本器零第二份取号尺子,登记分支必须先挑族(§0.6/§0.9)', () => {
  assert.match(SRC, /import \{ resolveIdTokens \} from '\.\/live-doc-edit\.mjs'/)
  assert.match(SRC, /import \{ TASK_ID_PATTERN \} from '\.\/check-plan-line-loss\.mjs'/)
  // "什么算一个号 / 下一号是谁"一概不住本器
  assert.doesNotMatch(SRC, /usedIdsOfPrefix/, '不得 import 号集判据(那是 plan-task-index 那一份)')
  assert.doesNotMatch(SRC, /nextTaskIdLabel/, '不得 import 下一号尺子(挑族只问"能不能发",不自算号)')
  assert.doesNotMatch(SRC, /smallestFreeId|leaseCursor|poolFreeList/, '池式算术不得住进消费器(§0.6)')
  // 登记分支的真次序:先现读挑族,再带族登记;族字母来自变量而不是写死
  const reg = SRC.slice(SRC.indexOf("// f.action === 'register'"))
  const pickAt = reg.indexOf('pickRegistrationFamily(')
  const fallbackAt = reg.indexOf('registerWithFamilyFallback(')
  assert.ok(pickAt >= 0 && fallbackAt > pickAt, 'register 分支必须先挑族再登记(烘在轮首=又写死一次)')
  assert.match(
    SRC,
    /`- \[ \] \{\{NEXT_ID:\$\{fam\}\}\} \[auto-triage\] \$\{title\}/,
    '令牌族必须由现读变量拼(写死字母=本票病根回潮)',
  )
  // 成因句只住 lib:本器只 import describeExhaustion,不自拼"池已满"句子
  assert.match(SRC, /import \{ machineIdentity, describeExhaustion \} from '\.\/lib\/plan-id-lease\.mjs'/)
  assert.doesNotMatch(SRC, /号池已满/, '本器不得再自带旧假归因句子(实测对灭窗型 Δ=0)')
  assert.doesNotMatch(SRC, /function describe[A-Z]\w*Exhaustion/, '不得写第二份成因渲染')
})

// ── A8 真仓端到端(只读) ──
test('A8 真跑一遍各族探针:读数结构齐全、成因句只由 lib 渲染(不断言哪一族可发=不做恒红门)', () => {
  const p = tr.pickRegistrationFamily()
  assert.equal(
    p.readings.map((r) => r.family).join(','),
    famsOfTable().join(','),
    '探针族集必须逐字等于族表解析结果(没有偷偷少探一枚)',
  )
  const STATUSES = new Set(['issuable', 'exhausted', 'no-rows', 'rejected', 'undetermined'])
  for (const r of p.readings) {
    assert.ok(STATUSES.has(r.status), `未知读数档 ${r.status}(${r.family})`)
    assert.equal(r.ok, r.status === 'issuable', '只有 issuable 算可发')
    if (r.ok) assert.ok(String(r.label).length > 1, `可发却没交首号:${r.family}`)
    if (r.exhaustion) {
      const line = describeExhaustion(r.exhaustion)
      assert.ok(
        line.includes(POOL_EXHAUST_REASON.poolFull) ||
          line.includes(POOL_EXHAUST_REASON.noContiguousWindow) ||
          line.includes(SCAN_FACE_EXHAUST_REASON) ||
          line.includes('未判定') ||
          line.includes('领空'),
        `成因句既没点三档之一也没落未判定:${line.slice(0, 120)}`,
      )
    }
  }
  assert.equal(p.ok, p.readings.some((r) => r.ok))
  assert.equal(p.token, p.ok ? `{{NEXT_ID:${p.family}}}` : null)
  assert.equal(p.undetermined, !p.ok && p.readings.length === 0, '面取不到才叫未判定')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
