// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-679 可寻址性守恒尺的 §22c 镜像测试（node:test）。
 *
 * 三条硬约束（都是本仓记过的失效型，写在最前面免得被当成普通测试文件）：
 *  1. **判据一份都不抄** —— 所有分档/解析都从门体 `__test__` 导入。镜像里再写一份 `resolveTarget`
 *     就是"测试只复读实现"的复读机（§22c 明令禁止），所以本文件末尾有一条**源码形状锁**把它钉住。
 *  2. **阳性对照必须真阳** —— "文本还在但 target 已不可寻址 ⇒ 必判红"这一条不许用恒真断言冒充；
 *     反向对照（同代能精确命中 ⇒ 不判红）必须同时在场，否则门只是把仓库改坏了而已。
 *  3. **"未接线"与"接线"是两个可判态** —— 门体头注自称"不在提交链"，那么 `guardian-runner.mjs`
 *     里必须找不到它；哪天有人把它接进去而没有重新定级，这条方向锁就红（守门 89/R4 同族）。
 *     git 问不到 ⇒ 如实 skip 并写明"未判定"，**不得**折成通过。
 */

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { __test__ as gate } from '../check-transcript-addressability.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const GATE_FILE = path.resolve(HERE, '..', 'check-transcript-addressability.mjs')

const jl = (rows) => rows.map((r) => JSON.stringify(r)).join('\n') + '\n'
const granted = (ref, extra = {}) => ({
  timestamp: '2026-01-01T00:00:00.000Z',
  tool: 'permission_lease_granted',
  input: { auditRef: ref, scope: 'goal:t', capabilities: ['write_file'], ...extra },
  success: true,
})
const used = (ref) => ({
  timestamp: '2026-01-01T00:00:01.000Z',
  tool: 'permission_lease_used',
  input: { auditRef: ref, capability: 'write_file' },
  success: true,
})
const drift = (ref) => ({
  timestamp: '2026-01-01T00:00:02.000Z',
  tool: 'permission_lease_content_drift',
  input: { auditRef: ref, capability: 'write_file', reason: 'digest 不符' },
  success: false,
})

/** 跑一整遍并把 summarize 走完（判据一律用门体那一份）。 */
function passOf(text, generation = 1) {
  return gate.summarize(gate.runPass(gate.materialize(text, generation)))
}

// ── 1. 三态分档：可寻址失败才判红 ──────────────────────────────────────────────
test('TA-1 阳性对照：auditRef 在本次 materialization 内零生产点 ⇒ R1 判红', () => {
  const s = passOf(jl([used('lease-vanished'), drift('lease-vanished')]))
  if (s.red !== 2) throw new Error(`期望 2 条判红，实得 ${s.red}`)
  if (s.redByRule[gate.RULE_UNADDRESSABLE] !== 2)
    throw new Error(`判红规则错位：${JSON.stringify(s.redByRule)}`)
  if (s.resolved !== 0)
    throw new Error(`零生产点却报命中 ${s.resolved} ⇒ 判据把"没找到"写成了"找到"`)
  if (typeof s.reds[0].ref !== 'string' || !Number.isInteger(s.reds[0].rowNo)) {
    throw new Error('判红项必须逐条点名 ref 与行号（只给计数就无法复核）')
  }
})

test('TA-2 负对照：同一代 materialization 里精确命中 ⇒ 不判红', () => {
  const s = passOf(jl([granted('lease-live'), used('lease-live'), drift('lease-live')]))
  if (s.red !== 0) throw new Error(`不该判红，实得 ${s.red}：${JSON.stringify(s.reds)}`)
  if (s.resolved !== 3)
    throw new Error(`期望 3 次命中（生产行自证 + 两个消费行），实得 ${s.resolved}`)
})

test('TA-3 不精确命中（同 ref 两个生产点）⇒ R2 判红，票面要求"精确命中"', () => {
  const s = passOf(jl([granted('lease-dup'), granted('lease-dup'), used('lease-dup')]))
  if (s.red === 0 || !s.redByRule[gate.RULE_AMBIGUOUS])
    throw new Error(`期望 R2 判红，实得 ${JSON.stringify(s.redByRule)}`)
})

test('TA-4 跨代配对（A 次的行交给 B 次的 resolver）⇒ R3 判红：这就是"点了必 stale"的机制本体', () => {
  const text = jl([granted('lease-gen'), used('lease-gen')])
  const matA = gate.materialize(text, 1)
  const matB = gate.materialize(text, 2)
  const target = gate.extractTarget(matA.entries[1])
  target.generation = matA.generation
  const r = gate.resolveTarget(matB.index, target)
  if (r.state !== 'red' || r.rule !== gate.RULE_CROSS_GENERATION) {
    throw new Error(`跨代配对必须判 R3，实得 ${r.state}/${r.rule}`)
  }
  // 反向：同代整遍跑完不得有任何红（否则本条只是"逢跨代即红"的单向改动）。
  if (passOf(text, 2).red !== 0) throw new Error('同代整遍不该有红')
})

// ── 2. 放过与未判定：绝不冒充判红（防恒红门）─────────────────────────────────
test('TA-5 文件类 target ⇒ 未判定（逐条点名 + 原因），判红恒 0', () => {
  const rows = [
    { tool: 'read_file', input: { path: 'lib.mjs' }, success: true },
    { tool: 'git_add', input: { files: ['a.mjs', 'b.mjs'] }, success: true },
    { tool: 'batch_edit', input: { operations: [{ path: 'shared.mjs' }] }, success: true },
    { tool: 'delete_file', input: { path: 'test_stats.mjs' }, success: true },
  ].map((r) => ({ timestamp: '2026-01-01T00:00:00.000Z', ...r }))
  const s = passOf(jl(rows))
  if (s.red !== 0) throw new Error(`文件类 target 不得判红（记录无工作区身份），实得 ${s.red}`)
  if (s.undetermined !== 4) throw new Error(`期望 4 条未判定，实得 ${s.undetermined}`)
  if (!s.undeterminedSamples.every((g) => g.reason.includes('工作区身份')))
    throw new Error('未判定必须带原因')
})

test('TA-6 启发式族（模式串/命令串/待办/commit 文案/拒绝指纹）只报数，零红零未判定', () => {
  const rows = [
    { tool: 'glob', input: { pattern: '**/lib.mjs' }, success: true },
    { tool: 'grep', input: { pattern: 'slugify' }, success: true },
    { tool: 'run_command', input: { command: 'sed -i lib.mjs' }, success: true },
    { tool: 'terminal_open', input: { command: 'cat a.mjs' }, success: true },
    { tool: 'todo_write', input: { todos: [{ id: 't1' }] }, success: true },
    { tool: 'git_commit', input: { message: 'fix: x' }, success: true },
    {
      tool: 'tool_call_denied',
      input: { argsFingerprint: 'sha256:0', argKeys: ['path'] },
      success: false,
    },
    { tool: 'permission_lease_granted', input: { scope: 'goal:x' }, success: true },
    { tool: 'run_tests', input: { filter: 'queue' }, success: true },
    { tool: 'gh_pr_create', input: { title: 't', body: 'b' }, success: true },
  ].map((r) => ({ timestamp: '2026-01-01T00:00:00.000Z', ...r }))
  const s = passOf(jl(rows))
  if (s.red !== 0 || s.undetermined !== 0)
    throw new Error(`启发式只许报数：red=${s.red} und=${s.undetermined}`)
  if (s.heuristic !== 10) throw new Error(`期望 10 条启发式，实得 ${s.heuristic}`)
  if (s.heuristicByVia.length !== 9)
    throw new Error(
      `期望 9 个 via 分堆（run_command 与 terminal_open 同归 command-string），实得 ${s.heuristicByVia.length}`,
    )
  for (const via of [
    'glob-pattern',
    'grep-pattern',
    'command-string',
    'todo-items',
    'commit-message',
    'denied-fingerprint',
    'lease-scope',
    'test-filter',
    'pr-body',
  ]) {
    // 每个族必须**各自**可见 —— 全部塞进一个总数里，就等于"某族被静默丢弃"也读不出来。
    if (!s.heuristicByVia.some(([v]) => v === via))
      throw new Error('启发式族 ' + via + ' 没有独立分堆 ⇒ 该族被静默丢弃')
  }
})

test('TA-7 流内无生产点的标识符族（sessionId / checkpointId）⇒ 未判定，不得读成"点了必 stale"', () => {
  const rows = [
    {
      tool: 'terminal_read',
      input: { sessionId: 'term_1788432972680_34c5b3', timeout: 5000 },
      success: true,
    },
    { tool: 'batch_undo', input: { checkpointId: 'chk_1768488110113_c4919876' }, success: true },
  ].map((r) => ({ timestamp: '2026-01-01T00:00:00.000Z', ...r }))
  const s = passOf(jl(rows))
  if (s.red !== 0) throw new Error(`该族在 audit.jsonl 内零生产点，判红等于凭空造债：red=${s.red}`)
  if (s.undetermined !== 2 || s.undeterminedRefFallback !== 2)
    throw new Error(`期望 2 条未判定，实得 ${s.undetermined}/${s.undeterminedRefFallback}`)
})

// ── 3. 崩溃维与判死维：不冒红、不记绿 ────────────────────────────────────────
test('TA-8 坏 JSON 行属崩溃维 ⇒ 计入 badLines，decideExit 判 2 不判 1', () => {
  const mat = gate.materialize(
    '{"tool":"read_file","input":{"path":"a.mjs"},"success":true}\n{坏掉的一行\n',
  )
  if (mat.badLines !== 1 || mat.entries.length !== 1)
    throw new Error(`bad=${mat.badLines} entries=${mat.entries.length}`)
  const s = gate.summarize(gate.runPass(mat))
  if (gate.decideExit(s, { crashed: true }) !== 2) throw new Error('崩溃维必须 exit 2')
  if (gate.decideExit(s, { crashed: false }) !== 0) throw new Error('崩溃标记没传时不得被冒充成红')
})

test('TA-9 枚举到 0 条 ⇒ 判死不记绿（exit 2）', () => {
  const s = passOf('')
  if (s.entries !== 0) throw new Error(`空面应 0 条目，实得 ${s.entries}`)
  if (gate.decideExit(s, {}) !== 2) throw new Error('空枚举不得返回 0')
})

test('TA-10 decideExit 四态表：无红 0 / 有红 1 / strict 下有未判定 2 / 崩溃 2', () => {
  const und = passOf(
    jl([{ timestamp: 'x', tool: 'read_file', input: { path: 'a' }, success: true }]),
  )
  if (gate.decideExit(und, { strict: false }) !== 0) throw new Error('默认档：未判定只报数')
  if (gate.decideExit(und, { strict: true }) !== 2)
    throw new Error('strict：有未判定应拒绝出合格证')
  const red = passOf(jl([used('lease-none')]))
  if (gate.decideExit(red, { strict: true }) !== 1) throw new Error('判红优先于未判定')
  if (gate.decideExit(und, { crashed: true }) !== 2) throw new Error('崩溃优先')
})

test('TA-11 参数面：--source / --top / --strict / 未知参数', () => {
  const a = gate.parseArgs(['--source=/tmp/x.jsonl', '--top', '3', '--strict'])
  if (a.error || a.opts.source !== '/tmp/x.jsonl' || a.opts.top !== 3 || !a.opts.strict)
    throw new Error(JSON.stringify(a))
  const b = gate.parseArgs(['--nonsense'])
  if (!b.error) throw new Error('未知参数必须判用法错，不得静默当默认档')
  const c = gate.parseArgs(['--top=abc'])
  if (!c.error) throw new Error('--top 非整数必须判用法错')
})

// ── 4. 真源端到端（只读复制 ⇒ 夹具 ⇒ 解析 ⇒ 回收）────────────────────────────
test('TA-12 真源跑一遍：零判红 + 命中数与流内生产/消费行数自证', (t) => {
  const probe = gate.inspectSource(gate.DEFAULT_SOURCE)
  if (!probe.ok) {
    t.diagnostic(`未判定（跳过，不计通过）：${probe.reason}`)
    return
  }
  const fx = gate.copyIntoScratch(probe.real, 'g679-mirror')
  try {
    const buf = fs.readFileSync(fx.file)
    if (buf.length !== probe.size)
      throw new Error(`复制字节数与源体积不符：${buf.length} vs ${probe.size} ⇒ 只读复制没复制全`)
    const mat = gate.materialize(buf.toString('utf8'), 1)
    const s = gate.summarize(gate.runPass(mat))
    if (mat.badLines !== 0)
      throw new Error(`真源含 ${mat.badLines} 个坏行 ⇒ 本镜的"0 判红"结论无效`)
    if (s.red !== 0)
      throw new Error(
        `真源出现判红 ${s.red}：${s.reds
          .slice(0, 3)
          .map((r) => `${r.rule}#${r.rowNo}`)
          .join(', ')}`,
      )
    // 自证（防"扫到 0 却报绿"）：命中数必须等于 auditRef 生产行数 + 消费行数。
    const all = buf
      .toString('utf8')
      .split('\n')
      .filter((x) => x.trim())
      .map((x) => JSON.parse(x))
    const producers = all.filter(
      (o) =>
        o.tool === 'permission_lease_granted' && o.input && typeof o.input.auditRef === 'string',
    ).length
    const consumers = all.filter(
      (o) =>
        o.input && typeof o.input.auditRef === 'string' && o.tool !== 'permission_lease_granted',
    ).length
    if (s.resolved !== producers + consumers) {
      throw new Error(`覆盖面不闭合：命中 ${s.resolved} ≠ 生产 ${producers} + 消费 ${consumers}`)
    }
    if (s.entries !== all.length) throw new Error(`条目数不闭合：${s.entries} vs ${all.length}`)
    if (s.undetermined === 0)
      throw new Error('真源里文件类 target 明明存在，未判定归零 ⇒ 抽取式失灵（0 命中先怀疑尺子）')
  } finally {
    gate.rmScratch(fx.dir)
    if (fs.existsSync(fx.dir)) throw new Error('夹具未回收（会在 scratch 根里长二阶目录）')
  }
})

// ── 5. 形状锁：判据不得有第二份 / 定级与接线必须同形 ───────────────────────────
test('TA-13 形状锁：本镜像不得复制判据（§22c）', () => {
  const self = fs.readFileSync(path.join(HERE, 'check-transcript-addressability.test.mjs'), 'utf8')
  // 令牌按运行时拼出 —— 字面写出来会让本锁把自己源码里的这份清单读成'第二份判据'（说明性文字也会带执行性字符，本仓记过）。
  const JUDGE_FNS = [
    'resolveTarget',
    'materialize',
    'extractTarget',
    'runPass',
    'summarize',
    'decideExit',
  ]
  for (const banned of JUDGE_FNS.map((n) => 'function ' + n + '(')) {
    if (self.includes(banned)) throw new Error(`镜像里出现了第二份判据：${banned}`)
  }
  if (
    !/import \{ __test__ as gate \} from '\.\.\/check-transcript-addressability\.mjs'/.test(self)
  ) {
    throw new Error('镜像必须 import 门体的 __test__ 出口（§22c 根治路径第 2 步）')
  }
})

test('TA-14 方向锁：门体自称"不在提交链" ⇒ guardian-runner 必须找不到它', () => {
  let runnerSrc = null
  let whyUnavailable = ''
  try {
    const gitBin = process.env.IHUI_GIT_BIN || 'git'
    runnerSrc = execFileSync(gitBin, ['show', 'HEAD:scripts/guardian-runner.mjs'], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 30000,
      stdio: ['ignore', 'pipe', 'pipe'], // §12g：不显式接管 stdio 在本机会稳定 EBUSY
    })
  } catch (e) {
    whyUnavailable = e && e.code ? e.code : String((e && e.message) || e).slice(0, 120)
  }
  const src =
    runnerSrc !== null
      ? runnerSrc
      : fs.readFileSync(path.resolve(HERE, '..', 'guardian-runner.mjs'), 'utf8')
  const wired = src.includes('check-transcript-addressability')
  const headNote = fs.readFileSync(GATE_FILE, 'utf8').split('\n').slice(0, 70).join('\n')
  const claimsNotWired = /不在提交链|未接提交链/.test(headNote)
  if (!runnerSrc && !fs.existsSync(path.resolve(HERE, '..', 'guardian-runner.mjs'))) {
    throw new Error(
      `未判定：git 取不到(${whyUnavailable}) 且工作树也没有注册表 —— 方向锁不得凭空记绿`,
    )
  }
  if (claimsNotWired && wired)
    throw new Error(
      '门体头注自称未接线，而注册表里找到了它 ⇒ 要么重新定级、要么改头注，不得两句话并存',
    )
  if (!claimsNotWired && !wired)
    throw new Error(
      '头注不再自称未接线、注册表里也没有它 ⇒ 本门既没接线也没声明，读报告的人会以为它在跑',
    )
})

test('TA-15 门体导出面必须齐备（摘掉任何一件判据，本镜立刻红）', () => {
  for (const k of [
    'RULE_UNADDRESSABLE',
    'RULE_AMBIGUOUS',
    'RULE_CROSS_GENERATION',
    'materialize',
    'extractTarget',
    'resolveTarget',
    'runPass',
    'summarize',
    'decideExit',
    'parseArgs',
    'inspectSource',
    'copyIntoScratch',
    'REF_KINDS',
    'HEURISTIC_SHAPES',
    'selfTest',
  ]) {
    if (!(k in gate))
      throw new Error(`门体未导出 ${k} —— 镜像只能重写一份判据，那正是 §22c 禁的形态`)
  }
  if (typeof gate.rmScratch !== 'function')
    throw new Error('夹具回收没有单点出口（测试侧自建删除路径 = 第二份落点判据）')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
