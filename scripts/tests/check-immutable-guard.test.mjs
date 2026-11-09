// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * §22c 镜像测试：scripts/check-immutable-guard.mjs（判据面不可变护栏，2026-10-25 立）
 *
 * 与源脚本的关系：`import { __test__ }`（§22d isDirectRun 保证 import 无副作用），
 * **不复制任何判据常量/实现** —— trailer 名、最小理由长度、清单路径、匹配与判定全部从生产脚本取。
 *
 * 覆盖面（票面要求 ≥10 例 + 反向牙）：
 *   T1  真实清单形状合法，且票面点名的四类面都被覆盖（含 scripts/lib/judgement-libs.json 现读存在）
 *   T2  匹配语义三形态：精确 / 目录前缀（不越界）/ 段内 glob（不误吞）
 *   T3  trailer 解析：有效 / 过短 / 大小写 / 行首空白 / 一短一长
 *   T4  judgeChanges：删（D）/ 改名（R 两侧）/ 未触及
 *   T5  decide 三态与优先级（清单坏 / 空 / 到期 / 无消息 / 有声明 / 无声明）
 *   T6  到期边界：reviewBy == today 不算过期，today 之后一天算过期
 *   T7  反向牙：清单**新增一项**后，改动落进该项 ⇒ 必须红（尺子不得只认硬编码面）
 *   T8  反向牙：从清单里摘掉前缀项 ⇒ 同一路径必须不再命中（命中来自登记，不是写死）
 *   T9  真实清单每条都能被匹配函数认出（probeEntry），登记了而匹配不上 = 射程静默缩水
 *   T10 --name-status -z 解析（M/A/D/R）
 *   T11 真仓端到端（默认档 + --json）：结构一致、受保护面条数与清单同值、退出码与 code 自洽
 *   T12 临时仓 CLI 端到端：--staged 无消息 ⇒ exit 2；带合格消息 ⇒ exit 0
 *   T13 两面旗同给 / --message-file 不存在 ⇒ exit 2（不猜）
 *   T14 源码形状锁：判据只在 lib 一份（源脚本不自己拼 trailer 正则/最小长度）
 */
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { spawn, spawnSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
// K1–K3 直接用生产出口(§22c:测试不复制判据,也不另造一份密钥解析)
import { resolveSigningKey } from '../check-immutable-guard.mjs'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { gitRaw } from '../lib/face-reader.mjs'
import { __test__ as gate } from '../check-immutable-guard.mjs'
import {
  CODE_LABEL,
  ACK_LEDGER_REL,
  ACK_SIG_VERSION,
  ACK_SIG_VERSION_CURRENT,
  SIG_VERSION,
  exemptPayload,
  ackPayload,
  ackPayloadV2,
} from '../lib/immutable-guard.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..')
const SCRIPT = join(ROOT, 'scripts', 'check-immutable-guard.mjs')

/** 显式 stdio（本机不写会 EBUSY，§12g 同型）—— CLI 端到端真跑。
 *  默认预算 240s：单门 CLI 实测远低于此。`--self-test` 那一档另给预算：
 *  2026-11-05 实测 70 例空闲单跑 104.3 秒，而本镜像档整套并发跑时同一档在 240.0 秒
 *  被杀 ⇒ T16 红（拿 HEAD 原样副本同测也红，属负载型误伤，不是判据红）。
 *  被杀与判红必须分两档报：否则「没判出来」会被读成「判过且红」（§0.3）。 */
const GATE_BUDGET_MS = 240_000
const SELFTEST_BUDGET_MS = Number(process.env.IMM_GUARD_SELFTEST_BUDGET_MS || 600_000)
const runGate = (args, cwd = ROOT, env = {}, timeoutMs = GATE_BUDGET_MS) =>
  spawnSync(process.execPath, [SCRIPT, ...args], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: timeoutMs,
    cwd,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

/** 镜像夹具密钥（≥ MIN_KEY_CHARS；只在临时仓里用，与机主真钥无关）。 */
const T_KEY = 'mirror-test-immutable-guard-key-0123456789'
const T_KEY_OTHER = 'mirror-test-other-immutable-guard-key-0123456789'
const signed = (subject, reason, hits, key = T_KEY) =>
  `${subject}\n\n${gate.EXEMPT_TRAILER} ${reason}\n${gate.SIG_TRAILER} ${gate.signExemption({ subject, hits, reason, key })}`

const parseJsonOut = (stdout) => JSON.parse(stdout.slice(stdout.indexOf('{')))

/** 真实清单（唯一真相源 = 仓内 JSON；测试不另抄一份）。 */
const realText = () => readFileSync(join(ROOT, gate.GUARD_DATA_REL), 'utf8')
const realEntries = () => gate.parseGuardList(realText())
/** 迁移窗口后一天（从清单现读推导，不写死日期；清单没写开关 ⇒ 用当天，因"立即要求签名"）。 */
const dayAfterWindow = (win = realEntries().signatureRequiredFrom) =>
  win
    ? new Date(Date.parse(`${win}T00:00:00Z`) + 86400000).toISOString().slice(0, 10)
    : '2026-11-04'

test('T1 真实清单形状合法且覆盖票面四类面', () => {
  const parsed = realEntries()
  assert.deepEqual(parsed.problems, [], '清单不得有坏行')
  assert.ok(parsed.entries.length >= 5, `受保护面至少 5 条，现读 ${parsed.entries.length}`)
  for (const p of [
    'scripts/guardian-runner.mjs',
    'AGENTS.md',
    'scripts/lib/face-reader.mjs',
    'scripts/data/demo-exemptions.json',
    'scripts/check-demo.mjs',
  ]) {
    const out = gate.decide({
      entries: parsed.entries,
      changes: [{ status: 'M', path: p }],
      message: '',
    })
    assert.equal(out.exit, 1, `清单必须覆盖 ${p}`)
  }
  // 票面点名的 judgement-libs.json：先用现读证明文件真实存在，再证明被 scripts/lib/ 前缀覆盖
  assert.ok(
    existsSync(join(ROOT, 'scripts/lib/judgement-libs.json')),
    'scripts/lib/judgement-libs.json 现读必须存在',
  )
  const hitLib = gate.decide({
    listProblems: [],
    entries: parsed.entries,
    changes: [{ status: 'M', path: 'scripts/lib/judgement-libs.json' }],
    message: 'x',
  })
  assert.equal(hitLib.exit, 1, '改 judgement-libs.json 必须落入受保护面（经 scripts/lib/ 前缀）')
})

test('T2 匹配语义：精确 / 前缀不越界 / glob 不误吞', () => {
  const { entries } = realEntries()
  const entriesOf = (p) => entries.find((e) => e.path === p)
  const prefix = entriesOf('scripts/lib/')
  const glob = entriesOf('scripts/data/*-exemptions.json')
  assert.ok(prefix && glob, '清单必须含前缀项与 glob 项')
  // 精确项等价于「只认自己」
  assert.equal(gate.probeEntry({ path: 'AGENTS.md' }).ok, true)
  assert.equal(
    gate.decide({ entries, changes: [{ status: 'M', path: 'AGENTS.md.bak' }], message: '' }).exit,
    0,
  )
  // 前缀项：必须命中子路径、**不得**越界到同名前缀（scripts/libx/）
  assert.equal(
    gate.decide({
      entries,
      changes: [{ status: 'M', path: 'scripts/lib/face-reader.mjs' }],
      message: '',
    }).exit,
    1,
  )
  assert.equal(
    gate.decide({
      entries,
      changes: [{ status: 'M', path: 'scripts/libx/face-reader.mjs' }],
      message: '',
    }).exit,
    0,
  )
  // glob 项：必须命中、不得把普通 json 一并吞掉
  assert.equal(
    gate.decide({
      entries,
      changes: [{ status: 'M', path: 'scripts/data/no-nested-git-exemptions.json' }],
      message: '',
    }).exit,
    1,
  )
  assert.equal(
    gate.decide({
      entries,
      changes: [{ status: 'M', path: 'scripts/data/immutable-guard.json' }],
      message: '',
    }).exit,
    1,
    '清单自身受保护',
  )
  assert.equal(
    gate.decide({
      entries,
      changes: [{ status: 'M', path: 'scripts/data/whatever.json' }],
      message: '',
    }).exit,
    0,
  )
  assert.ok(gate.probeEntry(glob).ok)
})

test('T3 trailer 解析：有效/过短/大小写/行首空白/一短一长', () => {
  const long = '修复判据取值面，已复核全部调用方'
  assert.ok([...long].length >= gate.MIN_REASON_CHARS, '夹具理由必须达到最小长度')
  const good = gate.parseExemptTrailer(`refactor: x\n\n${gate.EXEMPT_TRAILER} ${long}`)
  assert.equal(good.reasons.length, 1)
  assert.equal(good.problems.length, 0)
  const short = gate.parseExemptTrailer(`${gate.EXEMPT_TRAILER} 改一下`)
  assert.equal(short.reasons.length, 0)
  assert.equal(short.problems[0]?.code, 'reason-too-short')
  const upper = gate.parseExemptTrailer(`IMMUTABLE-EXEMPT: ${long}`)
  assert.equal(upper.reasons.length, 1, 'trailer 名大小写不敏感')
  const indented = gate.parseExemptTrailer(`   ${gate.EXEMPT_TRAILER}   ${long}   `)
  assert.equal(indented.reasons[0]?.reason, long, '理由必须 trim')
  const mixed = gate.parseExemptTrailer(`${gate.EXEMPT_TRAILER} 短\n${gate.EXEMPT_TRAILER} ${long}`)
  assert.equal(mixed.reasons.length, 1)
  assert.equal(mixed.problems.length, 1)
  const none = gate.parseExemptTrailer('feat: 没关系')
  assert.equal(none.present, false)
})

test('T4 judgeChanges：删除 / 改名两侧 / 未触及', () => {
  const { entries } = realEntries()
  const del = gate.decide({
    entries,
    changes: [{ status: 'D', path: 'scripts/check-demo.mjs' }],
    message: '',
  })
  assert.equal(del.exit, 1, '删除门体必须判红')
  const ren = gate.decide({
    entries,
    changes: [{ status: 'R', oldPath: 'scripts/lib/a.mjs', path: 'docs/a.mjs' }],
    message: '',
  })
  assert.equal(ren.exit, 1, '把受保护面改名搬走必须判红')
  assert.ok(ren.hits.some((h) => h.path === 'scripts/lib/a.mjs'))
  const ren2 = gate.decide({
    entries,
    changes: [{ status: 'R', oldPath: 'docs/a.mjs', path: 'scripts/lib/a.mjs' }],
    message: '',
  })
  assert.equal(ren2.exit, 1, '把外部文件改名搬进受保护面同样判红')
  const clean = gate.decide({
    entries,
    changes: [{ status: 'M', path: 'docs/readme.md' }],
    message: '',
  })
  assert.equal(clean.exit, 0)
  assert.equal(clean.hits.length, 0)
})

test('T5 decide 三态与优先级', () => {
  const { entries, problems } = realEntries()
  assert.equal(gate.decide({ entries: [], changes: [], message: '' }).exit, 2, '空清单不记绿')
  assert.equal(
    gate.decide({ entries, listProblems: [{ code: 'x', message: 'x' }], changes: [], message: '' })
      .exit,
    2,
  )
  const expiredEntries = entries.map((e) => ({ ...e, reviewBy: '2020-01-01' }))
  assert.equal(
    gate.decide({
      entries: expiredEntries,
      changes: [{ status: 'M', path: 'docs/x.md' }],
      message: 'x',
    }).exit,
    1,
  )
  const hit = [{ status: 'M', path: 'scripts/lib/face-reader.mjs' }]
  assert.equal(
    gate.decide({ entries, changes: hit, message: null }).exit,
    2,
    '拿不到消息 = 未判定，不是红也不是绿',
  )
  assert.equal(gate.decide({ entries, changes: hit, message: '' }).exit, 1)
  // 仅文字理由：迁移窗口内 = 绿但留痕；窗口到期 = 红（2026-11-04 起签名豁免）
  const reasonOnly = `${gate.EXEMPT_TRAILER} ${'理由'.repeat(6)}`
  const inWindow = gate.decide({
    entries,
    changes: hit,
    message: reasonOnly,
    today: '2026-11-04',
    signatureRequiredFrom: '2099-12-31',
  })
  assert.equal(inWindow.exit, 0)
  assert.equal(inWindow.code, 'declared-unsigned')
  const afterWindow = gate.decide({
    entries,
    changes: hit,
    message: reasonOnly,
    today: dayAfterWindow(),
    signatureRequiredFrom: realEntries().signatureRequiredFrom ?? null,
  })
  assert.equal(afterWindow.exit, 1, '窗口到期后仅文字理由必须判红')
  assert.equal(afterWindow.code, 'undeclared-unsigned')
  const noSwitch = gate.decide({ entries, changes: hit, message: reasonOnly, today: '2026-11-04' })
  assert.equal(noSwitch.exit, 0, '清单没写开关 = 旧语义（开关尚未引入），放行但留痕')
  assert.equal(noSwitch.code, 'declared-unsigned')
  assert.equal(problems.length, 0)
})

test('T6 到期边界：当天仍有效，次日过期', () => {
  const day = '2026-10-25'
  assert.equal(
    gate.parseGuardList(realText(), { today: day }).expired.length,
    0,
    '真实清单在今日不得有到期项',
  )
  const one = gate.parseGuardList(
    JSON.stringify([{ path: 'AGENTS.md', kind: 'rule-doc', why: 'x'.repeat(8), reviewBy: day }]),
    { today: day },
  )
  assert.equal(one.expired.length, 0, 'reviewBy == today 不算过期')
  const next = gate.parseGuardList(
    JSON.stringify([{ path: 'AGENTS.md', kind: 'rule-doc', why: 'x'.repeat(8), reviewBy: day }]),
    { today: '2026-10-26' },
  )
  assert.equal(next.expired.length, 1, '次日必须过期')
})

test('T7 反向牙：清单新增一项后，改动落进该项必须红', () => {
  const { entries } = realEntries()
  const added = [
    ...entries,
    {
      path: 'scripts/totally-new-dir/',
      kind: 'judgement-lib',
      why: '反向牙夹具',
      reviewBy: '2099-12-31',
    },
  ]
  const before = gate.decide({
    entries,
    changes: [{ status: 'M', path: 'scripts/totally-new-dir/x.mjs' }],
    message: '',
  })
  assert.equal(before.exit, 0, '未登记时该路径不得命中')
  const after = gate.decide({
    entries: added,
    changes: [{ status: 'M', path: 'scripts/totally-new-dir/x.mjs' }],
    message: '',
  })
  assert.equal(after.exit, 1, '清单加一项后同一改动必须红 —— 尺子必须真的消费清单')
  assert.equal(after.hits[0]?.entry?.path, 'scripts/totally-new-dir/')
})

test('T8 反向牙：摘掉前缀项后同一路径不再命中', () => {
  const { entries } = realEntries()
  const path = 'scripts/lib/face-reader.mjs'
  assert.equal(gate.decide({ entries, changes: [{ status: 'M', path }], message: '' }).exit, 1)
  const without = entries.filter((e) => e.path !== 'scripts/lib/')
  assert.equal(
    gate.decide({ entries: without, changes: [{ status: 'M', path }], message: '' }).exit,
    0,
    '命中必须来自清单登记，不得写死',
  )
})

test('T9 真实清单每条都能被匹配函数认出（probeEntry）', () => {
  const { entries } = realEntries()
  assert.ok(entries.length > 0)
  const blind = entries.map((e) => gate.probeEntry(e)).filter((p) => !p.ok)
  assert.deepEqual(
    blind.map((p) => p.entry?.path),
    [],
    '清单里存在"登记了但尺子匹配不上"的条目 = 射程静默缩水',
  )
})

test('T10 parseNameStatusZ：M / A / D / R', () => {
  const raw = ['M', 'a.mjs', 'A', 'b.mjs', 'D', 'c.mjs', 'R100', 'old.mjs', 'new.mjs', ''].join(
    '\u0000',
  )
  assert.deepEqual(gate.parseNameStatusZ(raw), [
    { status: 'M', path: 'a.mjs' },
    { status: 'A', path: 'b.mjs' },
    { status: 'D', path: 'c.mjs' },
    { status: 'R', oldPath: 'old.mjs', path: 'new.mjs' },
  ])
})

test('T11 真仓端到端：默认档 --json 结构自洽', () => {
  const r = runGate(['--json'])
  assert.ok(
    [0, 1, 2].includes(r.status),
    `退出码必须是 0/1/2，现读 ${r.status}；stderr=${r.stderr}`,
  )
  const out = parseJsonOut(r.stdout)
  assert.equal(out.face, 'head')
  assert.equal(out.exit, r.status, 'JSON 的 exit 必须与进程退出码一致')
  if (out.code === 'list-missing') {
    // 清单是新文件、尚未入库时，HEAD 面结构上就没有清单 ⇒ 只能是未判定（§0.4 不回落工作树）
    assert.equal(out.entryCount, 0)
    assert.equal(out.exit, 2)
  } else {
    // 同面同轮（§0.4）：这一档的 out 判的是 **HEAD blob**，期望值也必须从 HEAD 取。
    // 原先这里读工作树那份清单，于是"改了清单还没提交"这一格会拿 19 比 20 报假红——
    // 判据自己混了取材面，正是本门要拦的形态。
    let headText = null
    try {
      headText = gitRaw(['show', `HEAD:${gate.GUARD_DATA_REL}`], ROOT)
    } catch {
      headText = null
    }
    const headCount = headText === null ? 0 : gate.parseGuardList(headText).entries.length
    assert.equal(out.entryCount, headCount, 'JSON 里的受保护面条数必须与**被审那一面**的清单同值')
    assert.ok(Array.isArray(out.hits))
    assert.ok(
      r.status === 0 ? ['pass', 'declared', 'declared-unsigned'].includes(out.code) : true,
      '绿档只能是 pass/declared/declared-unsigned（后者是迁移窗口内的无签名豁免，必须已在台账里）',
    )
  }
})

test('T12 临时仓 CLI：--staged 无消息 ⇒ exit 2；带合格声明+签名 ⇒ exit 0', () => {
  const root = gate.seedRepo(realText())
  try {
    gate.writeIn(root, 'scripts/lib/face-reader.mjs', '// staged change\n')
    gitRaw(['add', '-A'], root)
    const miss = runGate(['--staged', '--root', root])
    assert.equal(miss.status, 2, `无消息必须未判定；stdout=${miss.stdout}`)
    assert.match(miss.stdout, /code=message-missing/)
    const reason = '已复核全部调用方与取值面'
    const okRun = runGate(
      [
        '--staged',
        '--root',
        root,
        '--message',
        signed('refactor: x', reason, ['scripts/lib/face-reader.mjs']),
      ],
      root,
      { [gate.KEY_ENV]: T_KEY },
    )
    assert.equal(okRun.status, 0, `带合格声明+签名必须绿；stdout=${okRun.stdout}`)
    assert.match(okRun.stdout, /\[判定面=staged\]/)
    // 只有文字理由、没有签名 ⇒ 迁移窗口内仍放行，但判定码必须是 declared-unsigned（不静默）
    const legacy = runGate(
      ['--staged', '--root', root, '--message', `refactor: x\n\n${gate.EXEMPT_TRAILER} ${reason}`],
      root,
      { [gate.KEY_ENV]: T_KEY },
    )
    assert.equal(legacy.status, 0)
    assert.match(legacy.stdout, /code=declared-unsigned/)
    assert.ok(existsSync(join(root, gate.UNSIGNED_LEDGER_REL)), '无签名豁免必须落台账')
  } finally {
    rmScratch(root)
  }
})

test('T13 两面旗同给 / --message-file 不存在 ⇒ exit 2', () => {
  const both = runGate(['--staged', '--worktree'])
  assert.equal(both.status, 2)
  const noFile = runGate([
    '--staged',
    '--message-file',
    join(ROOT, '.ihui-agent/tmp/immutable-guard/definitely-missing.txt'),
  ])
  assert.equal(noFile.status, 2)
  assert.match(noFile.stdout + noFile.stderr, /未判定/)
})

test('T14 形状锁：判据只在 lib 一份，源脚本不复制 trailer 字面量与最小长度', () => {
  const src = readFileSync(SCRIPT, 'utf8')
  assert.ok(src.includes("from './lib/immutable-guard.mjs'"), '源脚本必须 import 判据库')
  assert.ok(!/const\s+MIN_REASON_CHARS\s*=/.test(src), '最小长度不得在门体另抄一份')
  assert.ok(
    !new RegExp(`const\\s+[A-Z_]*TRAILER\\s*=\\s*['"]${gate.EXEMPT_TRAILER}`).test(src),
    'trailer 名不得在门体另抄一份',
  )
  const lib = readFileSync(join(ROOT, 'scripts/lib/immutable-guard.mjs'), 'utf8')
  assert.ok(lib.includes('export function decide'), '判定本体必须住 lib 并被导出')
})

test('T15 接线形状锁：源脚本不自称 runner 注册块；runner 已把本门注册进 push 门', () => {
  const src = readFileSync(SCRIPT, 'utf8')
  assert.ok(!src.includes("id: '"), '源脚本里不得出现 runner 注册块形态')
  const runner = readFileSync(join(ROOT, 'scripts/guardian-runner.mjs'), 'utf8')
  assert.ok(
    runner.includes("script: 'check-immutable-guard.mjs'"),
    'runner 必须把本门注册进 push 门（2026-11-04 接线）',
  )
  assert.ok(
    runner.includes("'--range', 'origin/main..HEAD'"),
    'push 门必须按显式区间判"本次要推的每一枚"',
  )
})

test('T16 --self-test 真跑：通过数 ≥10 且全绿', () => {
  const r = runGate(['--self-test'], ROOT, {}, SELFTEST_BUDGET_MS)
  if (r.signal)
    assert.fail(
      `未判定：自检子进程在 ${SELFTEST_BUDGET_MS}ms 预算处被杀(signal=${r.signal})，` +
        '这既不是"自检红"也不是"自检绿"——空闲单跑实测 104.3s，命中本档说明机器正被并发负载压着，' +
        '要么重跑要么用 IMM_GUARD_SELFTEST_BUDGET_MS 临时放宽，禁止借这一格跳门',
    )
  assert.equal(r.status, 0, r.stdout + r.stderr)
  const m = /\[immutable-guard:self-test\] (\d+)\/(\d+) 通过/.exec(r.stdout)
  assert.ok(m, `自检末行必须可解析：${r.stdout.slice(-200)}`)
  const [, passed, total] = m.map(Number)
  assert.ok(total >= 10, `自检用例数必须 ≥10，现读 ${total}`)
  assert.equal(passed, total, '自检必须全绿')
})

// ---------------------------------------------------------------------------
// 签名豁免（2026-11-04）：票面点名的四条反向测试，全部走生产 decide（不复制判据）
// ---------------------------------------------------------------------------

const HIT = [{ status: 'M', path: 'scripts/lib/face-reader.mjs' }]
const REASON = '本单即受审对象，签名绑定标题与命中面'
const SUBJECT = 'refactor: signed'

test('T17 带正确签名 ⇒ declared 放行', () => {
  const { entries } = realEntries()
  const out = gate.decide({
    entries,
    changes: HIT,
    message: signed(SUBJECT, REASON, ['scripts/lib/face-reader.mjs']),
    key: T_KEY,
    today: '2026-11-04',
  })
  assert.equal(out.exit, 0)
  assert.equal(out.code, 'declared')
  assert.equal(out.signature.code, 'sig-verified')
})

test('T18 仅文字理由 + 无签名（迁移窗口内）⇒ 放行 + declared-unsigned', () => {
  const { entries } = realEntries()
  const out = gate.decide({
    entries,
    changes: HIT,
    message: `${SUBJECT}\n\n${gate.EXEMPT_TRAILER} ${REASON}`,
    key: T_KEY,
    today: '2026-11-04',
    signatureRequiredFrom: '2026-11-11',
  })
  assert.equal(out.exit, 0, '窗口内仍按旧语义放行')
  assert.equal(out.code, 'declared-unsigned', '但绝不静默：判定码必须可被巡检查出')
  assert.equal(out.signature.code, 'sig-missing')
})

test('T19 仅文字理由 + 无签名（迁移窗口后）⇒ 不放行', () => {
  const { entries } = realEntries()
  const out = gate.decide({
    entries,
    changes: HIT,
    message: `${SUBJECT}\n\n${gate.EXEMPT_TRAILER} ${REASON}`,
    key: T_KEY,
    today: '2026-11-12',
    signatureRequiredFrom: '2026-11-11',
  })
  assert.equal(out.exit, 1, '到期后必须有验得过的签名')
  assert.equal(out.code, 'undeclared-unsigned')
})

test('T20 签名形状正确但验签失败 ⇒ 不放行（窗口内也不放）', () => {
  const { entries } = realEntries()
  const msg = signed(SUBJECT, REASON, ['scripts/lib/face-reader.mjs'], T_KEY_OTHER)
  const out = gate.decide({
    entries,
    changes: HIT,
    message: msg,
    key: T_KEY,
    today: '2026-11-04',
    signatureRequiredFrom: '2026-11-11',
  })
  assert.equal(out.exit, 1)
  assert.equal(out.code, 'undeclared-unsigned')
  assert.equal(out.signature.code, 'sig-invalid')
})

test('T21 密钥不存在 ⇒ fail-closed（有签名行但无从验 ⇒ 判未豁免）', () => {
  const { entries } = realEntries()
  const out = gate.decide({
    entries,
    changes: HIT,
    message: signed(SUBJECT, REASON, ['scripts/lib/face-reader.mjs']),
    key: null,
    today: '2026-11-04',
  })
  assert.equal(out.exit, 1, '没有钥匙绝不放行')
  assert.equal(out.signature.code, 'key-unavailable')
})

test('T22 --range 端到端：区间内的未签名提交在窗口到期后判红', () => {
  const root = gate.seedRepo(realText())
  try {
    gate.writeIn(root, 'scripts/lib/face-reader.mjs', '// changed\n')
    gate.commitAll(root, `refactor: legacy\n\n${gate.EXEMPT_TRAILER} ${REASON}`)
    const r = runGate(['--range', 'HEAD~1..HEAD', '--root', root, '--today', dayAfterWindow()])
    assert.equal(r.status, 1, `区间档必须判红；stdout=${r.stdout}`)
    assert.match(r.stdout, /undeclared-unsigned/)
  } finally {
    rmScratch(root)
  }
})

// ---------------------------------------------------------------------------
// 受保护面扩容（2026-11-04）：票面点名两处新增面必须当场判红
// ---------------------------------------------------------------------------

test('T23 扩容后：改 scripts/git-guardian.mjs 未声明 ⇒ 判红', () => {
  const { entries } = realEntries()
  const out = gate.decide({
    entries,
    changes: [{ status: 'M', path: 'scripts/git-guardian.mjs' }],
    message: '',
  })
  assert.equal(out.exit, 1, '巡检本体改了却没声明 ⇒ 必须判红')
  assert.equal(out.hits[0]?.entry?.path, 'scripts/git-guardian.mjs')
  // 反向牙：未登记的邻居路径不得被误吞（射程靠登记，不靠目录默认豁免）
  assert.equal(
    gate.decide({
      entries,
      changes: [{ status: 'M', path: 'scripts/git-guardian.txt' }],
      message: '',
    }).exit,
    0,
  )
})

test('T24 扩容后：改 .husky/pre-commit ⇒ 判红；README/post-checkout/pre-rebase 仍在射程外', () => {
  const { entries } = realEntries()
  const out = gate.decide({
    entries,
    changes: [{ status: 'M', path: '.husky/pre-commit' }],
    message: '',
  })
  assert.equal(out.exit, 1, '提交链入口被改却没声明 ⇒ 必须判红')
  assert.equal(out.hits[0]?.entry?.path, '.husky/pre-commit')
  for (const p of ['.husky/README.md', '.husky/post-checkout', '.husky/pre-rebase'])
    assert.equal(
      gate.decide({ entries, changes: [{ status: 'M', path: p }], message: '' }).exit,
      0,
      `${p} 必须保持不在射程`,
    )
  // deploy/win/lib 的 glob 只覆盖顶层模块：__tests__ 显式不在射程
  assert.equal(
    gate.decide({
      entries,
      changes: [{ status: 'M', path: 'deploy/win/lib/__tests__/x.mjs' }],
      message: '',
    }).exit,
    0,
    'deploy/win/lib/__tests__/ 必须保持不在射程',
  )
  assert.equal(
    gate.decide({
      entries,
      changes: [{ status: 'M', path: 'deploy/win/lib/edge-admission.mjs' }],
      message: '',
    }).exit,
    1,
    'deploy/win/lib 顶层模块必须在射程内',
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * T12/T13 追认台账的两条形状锁(2026-11-04 立)。
 * 判据本体在 lib(自检 ST32–ST40 已逐档正反成对),这里只钉"覆盖面自证":
 * 台账文件本身必须登记在受保护面里,否则"往台账塞一行"是一条无人看守的洗白通道;
 * 结论码必须在唯一那张表里,否则输出层会拿到 undefined 并印成半句话。
 */
test('T12 追认台账自身登记在受保护面清单里(补一行=改判据面)', () => {
  const { entries, problems } = realEntries()
  assert.deepEqual(problems, [], '清单不得有坏行')
  const hit = entries.some((e) => e.path === ACK_LEDGER_REL)
  assert.ok(hit, `台账必须与清单同档受保护：现读 entries=${entries.map((e) => e.path).join(',')}`)
})

test('T13 retro-declared 有唯一结论码文案,且追认签名与提交签名版本不同形', () => {
  assert.ok(
    CODE_LABEL['retro-declared'].includes('追认'),
    '文案必须点明这是事后追认,不得与 declared 同句',
  )
  assert.notEqual(SIG_VERSION, ACK_SIG_VERSION, '两种签名的版本前缀必须不同,否则可互相抄用')
  assert.notEqual(SIG_VERSION, ACK_SIG_VERSION_CURRENT, '新追认签名前缀也必须与提交签名不同形')
  assert.notEqual(
    ACK_SIG_VERSION,
    ACK_SIG_VERSION_CURRENT,
    'a1 历史档与 a2 现行档必须分开,否则 a1 的洞会跟着版本走',
  )
  const p1 = exemptPayload({ subject: 's', hits: [{ path: 'scripts/lib/' }], reason: 'r' })
  const p2 = ackPayloadV2({
    sha: 'x',
    paths: ['scripts/lib/'],
    reason: 'r',
    ackedBy: '独立复核席位',
  })
  assert.ok(
    !p1.includes(`"${ACK_SIG_VERSION_CURRENT}"`) && p2.includes(`"${ACK_SIG_VERSION_CURRENT}"`),
    '载荷必须各带自己的版本键(交叉复用必然验不过)',
  )
  assert.ok(p2.includes('"ackedBy"'), 'a2 载荷必须绑定 ackedBy，否则署名仍是自由文本')
  assert.ok(
    !ackPayload({ sha: 'x', paths: ['scripts/lib/'], reason: 'r' }).includes('"ackedBy"'),
    'a1 是历史档，不得偷偷长出新键',
  )
})

/**
 * T14 接线锁(2026-11-04 立):`.husky/commit-msg` 里那一档只报不拦的预警必须真在位。
 * 钉三件事:① 调用点带 `--message-file "$1"`(没有消息来源就结构上判不了,那一档等于空转);
 * ② 带 `|| true`(提交链档一旦能拦,共享索引里他人暂存件就会顶住全仓提交,§12e);
 * ③ 门体头注不得再写"刻意不进提交链"——那是本次接线之前的语义,留着就是把跑不通的说法留在文档里(§0.8)。
 */
test('T14 commit-msg 预警档在位、只报不拦,且头注不再自称"不进提交链"', () => {
  const hook = readFileSync(join(ROOT, '.husky', 'commit-msg'), 'utf8')
  const call = hook
    .split(/\r?\n/)
    .find((l) => l.includes('check-immutable-guard.mjs') && l.includes('--staged'))
  assert.ok(call, '.husky/commit-msg 必须真的调用本门(接线不在钩子里=判据从未跑到那一刻)')
  assert.ok(
    call.includes('--message-file "$1"'),
    '必须把本次提交信息交进去,否则 --staged 档结构上判不了',
  )
  assert.ok(call.includes('|| true'), '提交链档必须只报不拦;硬墙在 push 门那一档')
  const src = readFileSync(join(ROOT, 'scripts', 'check-immutable-guard.mjs'), 'utf8')
  const head = src.slice(0, src.indexOf('export const ROOT'))
  assert.ok(!head.includes('刻意不进提交链'), '头注不得保留已被本枚改写的旧语义')
  assert.ok(head.includes('只报不拦'), '头注必须描述当前挂点与档位,而不是只删掉旧话')
})

/**
 * T15 并发夹具（2026-11-04 立）：**两个子进程**，一个在另一进程推进 HEAD 的同时验签。
 *
 * 现场（会话 cc7876c2 实测）：私有 `GIT_INDEX_FILE` + 原生 `git commit` 时，别席把 HEAD
 * 推进之后，`git diff --cached HEAD` 把"他席那条提交的反向改动"也算进本席差异集 ⇒
 * 受保护面命中数从 1 变 2 ⇒ v1 签名（载荷只绑标题/路径集）随机报 `sig-invalid`，
 * 合法提交被判死。本夹具把这条做成可复现读数：
 *   · v2（钉 base + blob）：HEAD 前移前后都必须 `status=0`；
 *   · v1（旧语义基线）：同一轮、同一面必须 `status=1`（证明修的是取数面，不是放宽判据）。
 * 两个子进程同时起跑：推进者 `git commit`，验签者睡几十毫秒后跑 `--staged`（模拟钩子那一刻）。
 * 轮次 ≥20，读数按"验签时 HEAD 是否已离开签发 base"分桶。
 */
test(
  'T25 并发夹具：HEAD 被别席推进时 v2 合法提交仍过 / v1 旧语义必红（≥20 轮）',
  { timeout: 180000 },
  async () => {
    const ROUNDS = 20
    const ours = 'scripts/lib/face-reader.mjs'
    const theirs = 'scripts/guardian-runner.mjs'
    const reason = '并发夹具：HEAD 前移不得改变本席声明面'
    const subject = 'fix: staged signature survives concurrent HEAD advance'
    const root = mkScratch('immguard-conc-')
    const records = []
    try {
      for (const [rel, text] of [
        [ours, '// baseline ours\n'],
        [theirs, '// baseline theirs\n'],
      ]) {
        const abs = join(root, rel)
        mkdirSync(dirname(abs), { recursive: true })
        writeFileSync(abs, text, 'utf8')
      }
      const guardAbs = join(root, gate.GUARD_DATA_REL)
      mkdirSync(dirname(guardAbs), { recursive: true })
      writeFileSync(guardAbs, realText(), 'utf8')
      gitRaw(['init', '-q', '-b', 'main'], root)
      gitRaw(['config', 'user.email', 'selftest@example.invalid'], root)
      gitRaw(['config', 'user.name', 'selftest'], root)
      gitRaw(['config', 'commit.gpgsign', 'false'], root)
      gitRaw(['config', 'core.hooksPath', '.git/no-hooks'], root)
      gitRaw(['add', '-A'], root)
      gitRaw(['commit', '--no-verify', '-F', '-'], root, { input: 'baseline' })

      const verifier = `
      const { spawnSync } = require('child_process')
      const fs = require('fs')
      const c = JSON.parse(process.env.CONC_V)
      const out = { status: 99, headBefore: '', headAfter: '', stdout: '', stderr: '' }
      const git = (args) => spawnSync(process.env.IHUI_GIT_BIN || 'git', ['-C', c.root, ...args], { encoding: 'utf8' }).stdout || ''
      setTimeout(() => {
        out.headBefore = git(['rev-parse', 'HEAD']).trim()
        try {
          const r = spawnSync(process.execPath, [c.script, '--staged', '--root', c.root, '--message-file', c.msg], {
            cwd: c.root,
            encoding: 'utf8',
            env: { ...process.env, GIT_INDEX_FILE: c.idx },
            stdio: ['ignore', 'pipe', 'pipe'],
            timeout: 60000,
          })
          out.status = r.status
          out.stdout = String(r.stdout || '').slice(-2500)
          out.stderr = String(r.stderr || '').slice(-2500)
        } catch (e) {
          out.stderr = String((e && e.message) || e)
        }
        out.headAfter = git(['rev-parse', 'HEAD']).trim()
        fs.writeFileSync(c.out, JSON.stringify(out))
      }, c.delay)
    `
      const advancer = `
      const { execFileSync, spawnSync } = require('child_process')
      const fs = require('fs')
      const c = JSON.parse(process.env.CONC_A)
      const out = { ok: false, head: '', err: '' }
      setTimeout(() => {
        try {
          fs.writeFileSync(c.root + '/' + c.theirs, '// theirs ' + c.round + '\\n')
          execFileSync(process.env.IHUI_GIT_BIN || 'git', ['-C', c.root, 'add', '--', c.theirs], { stdio: 'ignore' })
          const r = spawnSync(process.env.IHUI_GIT_BIN || 'git', ['-C', c.root, 'commit', '--no-verify', '-F', '-'], { input: 'chore: 别席推进 HEAD ' + c.round, encoding: 'utf8' })
          if (r.status !== 0) throw new Error('commit rc=' + r.status + ' ' + String(r.stderr || '').slice(-200))
          out.ok = true
          out.head = String(execFileSync(process.env.IHUI_GIT_BIN || 'git', ['-C', c.root, 'rev-parse', 'HEAD'], { encoding: 'utf8' })).trim()
        } catch (e) {
          out.err = String((e && e.message) || e).slice(0, 200)
        }
        fs.writeFileSync(c.out, JSON.stringify(out))
      }, c.delay)
    `
      const runWorker = (code, env) =>
        new Promise((done) => {
          const p = spawn(process.execPath, ['-e', code], {
            env: { ...process.env, ...env },
            windowsHide: true,
            stdio: ['ignore', 'pipe', 'pipe'],
          })
          p.stdout.resume()
          p.stderr.resume()
          const guard = setTimeout(() => {
            try {
              p.kill()
            } catch {}
            done(99)
          }, 30000)
          p.on('exit', (c) => {
            clearTimeout(guard)
            done(c)
          })
          p.on('error', () => {
            clearTimeout(guard)
            done(99)
          })
        })
      const readJson = (p) => {
        try {
          return JSON.parse(readFileSync(p, 'utf8'))
        } catch {
          return null
        }
      }

      for (let round = 1; round <= ROUNDS; round += 1) {
        const base = String(gitRaw(['rev-parse', 'HEAD'], root)).trim()
        const idx = join(root, '.git', `st-index-${round}`)
        const msgV2 = join(root, '.git', `msg-v2-${round}.txt`)
        const msgV1 = join(root, '.git', `msg-v1-${round}.txt`)
        const outV2 = join(root, '.git', `out-v2-${round}.json`)
        const outV1 = join(root, '.git', `out-v1-${round}.json`)
        const outA = join(root, '.git', `out-a-${round}.json`)
        // 本席：私有索引（相对**当前** HEAD 建），只 add 自己那条路径。
        const gitIdx = (args) =>
          spawnSync(process.env.IHUI_GIT_BIN || 'git', args, {
            cwd: root,
            encoding: 'utf8',
            env: { ...process.env, GIT_INDEX_FILE: idx },
          })
        writeOurs(root, ours, round)
        assert.equal(gitIdx(['read-tree', 'HEAD']).status, 0, `round ${round}: read-tree 失败`)
        assert.equal(gitIdx(['add', '--', ours]).status, 0, `round ${round}: add 失败`)
        const signedV2 = runGate(
          [
            '--sign-staged',
            '--root',
            root,
            '--subject',
            subject,
            '--reason',
            reason,
            '--paths',
            ours,
          ],
          root,
          {
            [gate.KEY_ENV]: T_KEY,
            GIT_INDEX_FILE: idx,
          },
        )
        assert.equal(signedV2.status, 0, `round ${round}: v2 签发失败 ${signedV2.stderr}`)
        const v1 = gate.signExemption({ subject, hits: [{ path: ours }], reason, key: T_KEY })
        writeFileSync(msgV2, `${subject}\n\n${signedV2.stdout}`, 'utf8')
        writeFileSync(
          msgV1,
          `${subject}\n\n${gate.EXEMPT_TRAILER} ${reason}\n${gate.SIG_TRAILER} ${v1}`,
          'utf8',
        )

        const envFor = (msg, out, delay) => ({
          CONC_V: JSON.stringify({ root, script: SCRIPT, idx, msg, delay, out }),
          // 验签子进程也要拿到同一把测试钥，否则验的是本机真钥 ⇒ key-or-signature-mismatch（与夹具无关）
          [gate.KEY_ENV]: T_KEY,
        })
        const verV2 = runWorker(verifier, envFor(msgV2, outV2, 70 + round * 2))
        const verV1 = runWorker(verifier, envFor(msgV1, outV1, 70 + round * 2))
        const adv = runWorker(advancer, {
          CONC_A: JSON.stringify({ root, theirs, round, delay: 0, out: outA }),
        })
        await Promise.all([verV2, verV1, adv])
        const r2 = readJson(outV2)
        const r1 = readJson(outV1)
        const ra = readJson(outA)
        const moved = Boolean(
          r2 &&
          ((r2.headBefore && r2.headBefore !== base) || (r2.headAfter && r2.headAfter !== base)),
        )
        records.push({
          round,
          base,
          moved,
          advanced: Boolean(ra && ra.ok),
          v2: r2?.status,
          v1: r1?.status,
          err2: r2?.stderr ?? '',
          err1: r1?.stderr ?? '',
        })
      }
    } finally {
      rmScratch(root, { bestEffort: true })
    }

    const movedRounds = records.filter((r) => r.moved)
    const v2Pass = movedRounds.filter((r) => r.v2 === 0).length
    const v1Pass = movedRounds.filter((r) => r.v1 === 0).length
    const detail = JSON.stringify({
      rounds: records.length,
      advanced: records.filter((r) => r.advanced).length,
      headMovedBeforeVerify: movedRounds.length,
      v2Pass,
      v1Pass,
      sample: records.slice(0, 3),
    })
    assert.equal(records.length, ROUNDS, '轮次必须跑满')
    // 读数必须落进 TAP（不是只在失败时打印）：这一型是"并发毁签"的核心夹具，空口说"全绿"不算读数。
    console.log(`[T25] ${detail}`)
    assert.ok(
      movedRounds.length >= 15,
      `HEAD 前移的轮次太少（${movedRounds.length}/${ROUNDS}），夹具没压到并发窗口：${detail}`,
    )
    assert.equal(v2Pass, movedRounds.length, `v2 在 HEAD 前移后仍必须全绿：${detail}`)
    assert.equal(v1Pass, 0, `v1 旧语义在 HEAD 前移后必须全红（对照基线）：${detail}`)
  },
)

/** T15 用：写本席路径内容（每轮换内容，保证 blob 真的变）。 */
function writeOurs(root, rel, round) {
  const abs = join(root, rel)
  mkdirSync(dirname(abs), { recursive: true })
  writeFileSync(abs, `// ours ${round}\n`, 'utf8')
}

/**
 * K1–K3 密钥不外泄(2026-11-05 立)。
 * 头注一直承诺「绝不把密钥本身写进任何输出」,但 `key` 是可枚举字段 ⇒ 一次调试性整对象打印
 * 就把明文送进日志/会话记录(当天真实发生过一次)。这三例把承诺变成可执行的不变量。
 */
test('K1 密钥句柄:res.key 可读,但枚举/序列化/插值都不带明文', () => {
  const secret = 'a'.repeat(64)
  const res = resolveSigningKey('/nonexistent-root-for-this-test', {
    IHUI_IMMUTABLE_GUARD_KEY: secret,
  })
  assert.equal(res.key, secret, '读侧必须照常拿得到(否则签名/验签功能被改成瞎的)')
  assert.ok(
    !Object.keys(res).includes('key'),
    'key 不得是可枚举属性 —— 可枚举就等于会被 console.log 带走',
  )
  assert.ok(!JSON.stringify(res).includes(secret), 'JSON.stringify 不得带明文')
  assert.ok(!`${res}`.includes(secret), '模板插值不得带明文')
  assert.ok(
    !JSON.stringify({ wrapped: res }).includes(secret),
    '嵌套序列化(进台账/告警最常见形态)也不得带明文',
  )
  assert.match(JSON.stringify(res), /\*{3}/, '序列化必须给掩码形态,不能变成空值让人以为没读到钥')
})

test('K2 反向锁:展开传播会丢钥 ⇒ 打印/透传面天然不带它', () => {
  const secret = 'b'.repeat(64)
  const res = resolveSigningKey('/nonexistent-root-for-this-test', {
    IHUI_IMMUTABLE_GUARD_KEY: secret,
  })
  assert.equal(
    { ...res }.key,
    undefined,
    '展开必须丢 key:密钥不随 {...} 传播(全仓现读无展开取 key 的用法)',
  )
})

test('K3 短密钥仍按无效处理并说明长度(不外泄 ≠ 假装没读到)', () => {
  const res = resolveSigningKey('/nonexistent-root-for-this-test', {
    IHUI_IMMUTABLE_GUARD_KEY: 'tooshort',
  })
  assert.equal(res.key, null)
  assert.match(res.why, /长度/, `必须点名是长度不够,不是静默"无钥":${res.why}`)
  const none = resolveSigningKey('/nonexistent-root-for-this-test', {})
  assert.equal(none.key, null)
  assert.match(none.why, /不存在/, '三源皆空要说明"不存在"而非空串')
})
