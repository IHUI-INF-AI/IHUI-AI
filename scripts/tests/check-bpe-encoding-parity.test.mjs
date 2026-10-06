// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * §22c 镜像测试:check-bpe-encoding-parity(G-1058650 残余②「跨端 BPE 分歧未归因」的尺子)
 *
 * 与源脚本的关系:本文件 `import { __test__ }`(§22d isDirectRun 保证 import 无副作用),
 * **不复制判据实现** —— 两份真相是登记在案的漂移源。探针语料、解析器、evaluate、decide
 * 全取源脚本那一份;本文件只负责"用判据自己的出口去问判据自己的答案"。
 *
 * 覆盖面:
 *   T1 接线方向锁:本门**刻意未装车**,故头注必须自称未装;真值源(guardian-runner.mjs)里
 *      必须零命中 —— 头注与真值源互相打脸的方向,与check-gate-wiring.mjs 的 R1 同型。
 *   T2 取材面纪律:C1/C2 必须同面,且被审内容必须走 face-reader;不得散写 git show 取正文。
 *   T3 C1 解析三态:裸主入口(向包现读)/ 显式说明符 / 注释不算 / 变量实参判不出。
 *   T4 C1b 防空转:两端**相等**但都是未批准表 ⇒ 仍判红;两端同为已批准的另一张 ⇒ 不判红
 *      (这一对是"不能替人拍板选模型"的可执行证据)。
 *   T5 decide 优先级:未判定(exit 2)压过漂移(exit 1);一例都没判到 ⇒ 判死。
 *   T6 端到端阳性对照(真仓):两端现状必须判红,且必须点名 o200k vs cl100k。
 *   T7 端到端变异对照(真跑):TS→cl100k ⇒ 转绿;两端同改 p50k ⇒ 仍判红。
 *      注入**确实命中**由"变异文本必须与原文件不同"证明;两臂都报红等于没测。
 *   T8 反向锁不得空转:REVERSE_PROBES 在两张表下逐条同值(S5/S6 的镜像),且真仓跑出来同值。
 *   T9 CLI 面旗矛盾 ⇒ exit 2,不冒红也不记绿。
 *  T10 面一致性:被审面取不到时 rc 2 并点名路径,绝不 rc 0。
 */
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { __test__ as gate } from '../check-bpe-encoding-parity.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..')
const SCRIPT = join(ROOT, 'scripts', 'check-bpe-encoding-parity.mjs')
const RUNNER = 'scripts/guardian-runner.mjs'

const runCli = (args) =>
  spawnSync(process.execPath, [SCRIPT, ...args], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 300000,
    cwd: ROOT,
    // 2026-10-04:不吃 stdin 的子进程必须显式 stdio,否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
  })

/** 内联读 HEAD 面的文件内容(不 git add、不改索引;纯只读取证)。 */
const gitShowHead = (rel) =>
  spawnSync('git', ['-c', 'safe.directory=*', 'show', `HEAD:${rel}`], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 60000,
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

const pkgDir = join(ROOT, 'packages', 'context-compaction', 'node_modules', 'gpt-tokenizer')
const req = createRequire(join(ROOT, 'packages', 'context-compaction', 'package.json'))
const hasPkg = existsSync(pkgDir)

test('T1 接线方向锁:未装车 ⇒ 头注自称未装,且 guardian-runner 里零命中(读 HEAD 面真值源)', () => {
  const head = gitShowHead(RUNNER)
  assert.equal(head.status, 0, `读 HEAD:${RUNNER} 失败`)
  assert.ok(
    !head.stdout.includes('check-bpe-encoding-parity.mjs'),
    '本门在真值源里出现注册条目 —— 头注的"未装车"自称就成了谎报(这正是本仓 40+ 例的成因)',
  )
  // 头注必须**如实**写未装车。若哪天有人真去注册了,这条会红,提醒同步改头注。
  const self = readFileSync(SCRIPT, 'utf8')
  assert.match(self, /接线状态:未接 pre-commit/, '头注必须自称未接 pre-commit(与真值源一致)')
  assert.match(self, /未登记 guardian-runner/, '头注必须自称未登记 guardian-runner')
})

test('T2 取材面纪律:C1/C2 同面,且正文取材走 face-reader 而非散写 git show', () => {
  const self = readFileSync(SCRIPT, 'utf8')
  assert.match(self, /catBatch/, '必须用 face-reader 的 catBatch 取 blob 面')
  assert.match(self, /materializeTsFace/, '行为层必须把被审面落盘后执行(C1/C2 同面)')
  assert.match(self, /materializePyFace/, 'Python 面同样必须落盘后执行')
  // 散写 git show 取被审正文 =绕过 face-reader,面纪律就漏了
  const bad = self.match(/git\s+show|execFileSync\(\s*['"]git['"]/)
  assert.equal(bad, null, '门内不得散写 git 调用取被审正文(面纪律要求走 face-reader)')
})

test('T3 C1 解析:裸主入口向包现读;显式说明符直取;注释不算;变量实参判不出', () => {
  const rBare = gate.parseTsEncoding("import { encode } from 'gpt-tokenizer'\n", () => pkgDir)
  assert.ok(hasPkg, 'gpt-tokenizer 未安装,本用例无法取证')
  assert.equal(rBare.ok, true)
  assert.equal(rBare.encoding, 'o200k_base', '裸主入口必须解析成 o200k_base(真包现读)')

  const rExplicit = gate.parseTsEncoding("import { encode } from 'gpt-tokenizer/encoding/cl100k_base'\n", () => {
    throw new Error('显式说明符不该问包')
  })
  assert.equal(rExplicit.encoding, 'cl100k_base')

  // 注释里的说明符不构成声明 —— 这是本票要拔掉的谎报形态
  const rComment = gate.parseTsEncoding("// 'gpt-tokenizer/encoding/p50k_base'\nconst x = 1\n", () => pkgDir)
  assert.equal(rComment.ok, false, '注释里的说明符不得被当成声明')

  // 散文回归锁(实测踩过):头注里一句与真import 同形的散文,不得被数成第二个说明符
  const rProse = gate.parseTsEncoding(
    [
      "// 头注散文:import { encode } from 'gpt-tokenizer' —— 这不是声明,只是陈述",
      "import { encode } from 'gpt-tokenizer/encoding/cl100k_base'",
    ].join('\n'),
    () => null,
  )
  assert.equal(rProse.ok, true, `头注散文被误当成声明了(实测踩过这个坑):${JSON.stringify(rProse)}`)
  assert.equal(rProse.encoding, 'cl100k_base')

  // Python 侧同理:必须走 AST,散文里的 get_encoding 不算声明(门内不得退回正则扫文本)
  assert.match(readFileSync(SCRIPT, 'utf8'), /pythonAstProgram/, 'Python 侧必须用 AST 取调用点')
  const rVar = gate.parsePyEncodingFromAst({
    calls: [{ name: null, lineno: 92, fallback: false }],
    primary: { name: null, lineno: 92, fallback: false },
    fallbacks: [],
  })
  assert.equal(rVar.ok, false, '变量实参必须判不出(不猜)')
})

test('T4 C1b:两端相等但未批准 ⇒ 判红;两端同为已批准的另一张 ⇒ 不判红(不替人拍板)', () => {
  const ok = { checked: 3, drifts: [], undetermined: [] }
  const both = (enc) => ({ tsEnc: { encoding: enc }, pyEnc: { encoding: enc }, positive: ok, reverse: ok, fixture: ok })

  const p50k = gate.decide(both('p50k_base'))
  assert.equal(p50k.rc, 1, '两端同为 p50k_base 必须判红(纯相等判据在此处会记绿)')
  assert.ok(p50k.encodingUnapproved, '红的理由必须是 C1b(未批准候选),不是别的原因')

  const cl = gate.decide(both('cl100k_base'))
  assert.equal(cl.rc, 0, '两端同为 cl100k_base(已批准的另一张)不得判红 —— 否则本门越权替人选了模型')
  assert.equal(cl.encodingUnapproved, null)
})

test('T5 decide 优先级:未判定压过漂移;一例都没判到 ⇒ 判死', () => {
  const ok = { checked: 1, drifts: [], undetermined: [] }
  const und = gate.decide({
    tsEnc: { undetermined: '取不到' },
    pyEnc: { encoding: 'cl100k_base' },
    positive: { checked: 0, drifts: [{ name: 'x', ts: 1, py: 2 }], undetermined: ['跑不到'] },
    reverse: ok,
    fixture: ok,
  })
  assert.equal(und.rc, 2, '同时有未判定与漂移时必须 exit 2(未判定压过漂移)')

  const empty = gate.decide({
    tsEnc: { encoding: 'o200k_base' },
    pyEnc: { encoding: 'o200k_base' },
    positive: { checked: 0, drifts: [], undetermined: [] },
    reverse: { checked: 0, drifts: [], undetermined: [] },
    fixture: { checked: 0, drifts: [], undetermined: [] },
  })
  assert.equal(empty.rc, 2, '一例都没判到必须判死,不得记绿')
})

test('T6 端到端(真仓 worktree):两端现状必须判红,并点名 o200k vs cl100k', () => {
  const r = runCli(['--worktree'])
  assert.equal(r.status, 1, `现状必须判红(缺陷已坐实),实得 rc=${r.status}\n${r.stdout}\n${r.stderr}`)
  assert.match(r.stdout, /TS\s+: o200k_base/, '必须点名 TS 侧实际编码')
  assert.match(r.stdout, /Python : cl100k_base/, '必须点名 Python 侧实际编码')
  assert.match(r.stdout, /两端声明的编码不同/, '必须给出声明层分歧结论')
  // 行为层至少一条真分歧,逐条带两端读数
  assert.match(r.stdout, /ascii-addition\s+TS=8 \/ Python=9/, '必须报出坐实样本的逐值读数')
})

test('T7 端到端变异(真跑):TS→cl100k ⇒ 转绿;两端同改 p50k ⇒ 仍判红', async () => {
  if (!hasPkg) return
  const scratch = mkScratch('ihui-bpe-mirror-')
  try {
    const contents = gate.readBothContents(ROOT, 'worktree')
    const tsReal = contents.get(gate.TS_REL)
    const pyReal = contents.get(gate.PY_REL)
    const tunReal = contents.get(gate.TUNABLES_REL)
    const fxReal = contents.get(gate.FIXTURE_REL)
    const common = {
      root: ROOT,
      face: 'worktree',
      readPkgDir: () => pkgDir,
      resolveBareEntry: () => req.resolve('gpt-tokenizer'),
      tunablesText: tunReal,
      pythonPath: gate.findPython(ROOT),
    }
    const withText = (ts, py) =>
      new Map([
        [gate.TS_REL, ts],
        [gate.PY_REL, py],
        [gate.TUNABLES_REL, tunReal],
        [gate.FIXTURE_REL, fxReal],
      ])

    // 变异锚**最后一处**裸说明符:两侧头注里都有一模一样的散文,
    // replace() 默认只换第一处 ⇒ 会改到散文而真 import/调用原封不动,"注入生效"是假的。
    const replaceLast = (text, from, to) => {
      const i = text.lastIndexOf(from)
      return i === -1 ? null : text.slice(0, i) + to + text.slice(i + from.length)
    }
    const toFileUrl = (p) => new URL(`file:///${p.replace(/\\/g, '/')}`).href

    // 变异①:TS → cl100k(与 Python 一致)⇒ 转绿
    const absCl = toFileUrl(req.resolve('gpt-tokenizer/encoding/cl100k_base'))
    const tsExec1 = replaceLast(tsReal, "from 'gpt-tokenizer'", `from '${absCl}'`).replace(/^import type .*$/gm, '')
    const tsDecl1 = replaceLast(tsReal, "from 'gpt-tokenizer'", "from 'gpt-tokenizer/encoding/cl100k_base'")
    assert.notEqual(tsExec1, tsReal, '变异①注入未生效(TS 执行文本没变) —— 变异无效,后面结论不算数')
    assert.notEqual(tsDecl1, tsReal, '变异①注入未生效(TS 声明文本没变)')

    const run1 = mkScratch('ihui-bpe-mirror-run-')
    let r1
    try {
      r1 = await gate.evaluate({
        ...common,
        scratch: run1,
        contents: withText(tsDecl1, pyReal),
        execTsText: tsExec1,
      })
    } finally {
      rmScratch(run1)
    }
    assert.equal(r1.tsEnc.encoding, 'cl100k_base', '变异①的声明层必须解析成 cl100k_base')
    assert.equal(r1.d.rc, 0, `变异①必须转绿,实得 rc=${r1.d.rc} drifts=${r1.d.drifts.length} und=${r1.d.undetermined.join(';')}`)

    // 变异②:两端同改 p50k ⇒ 仍判红(靠 C1b;两端彼此相等,行为层一致)
    const absP50 = toFileUrl(req.resolve('gpt-tokenizer/encoding/p50k_base'))
    const tsExec2 = replaceLast(tsReal, "from 'gpt-tokenizer'", `from '${absP50}'`).replace(/^import type .*$/gm, '')
    const tsDecl2 = replaceLast(tsReal, "from 'gpt-tokenizer'", "from 'gpt-tokenizer/encoding/p50k_base'")
    const pyMut2 = replaceLast(pyReal, 'tiktoken.get_encoding("cl100k_base")', 'tiktoken.get_encoding("p50k_base")')
    assert.notEqual(tsExec2, tsReal, '变异②注入未生效(TS 执行文本没变)')
    assert.notEqual(pyMut2, pyReal, '变异②注入未生效(Python 文本没变)')

    const run2 = mkScratch('ihui-bpe-mirror-run-')
    let r2
    try {
      r2 = await gate.evaluate({
        ...common,
        scratch: run2,
        contents: withText(tsDecl2, pyMut2),
        execTsText: tsExec2,
      })
    } finally {
      rmScratch(run2)
    }
    assert.equal(r2.d.encodingDrift, null, '变异②下两端声明彼此相等(这正是要防的形态)')
    assert.equal(r2.d.rc, 1, '变异②必须仍判红')
    assert.ok(r2.d.encodingUnapproved, '变异②判红的理由必须是 C1b')
  } finally {
    rmScratch(scratch)
  }
})

test('T8 反向锁不空转:REVERSE_PROBES 在两张表下逐条同值,且真仓跑出来反向锁全同值', () => {
  if (!hasPkg) return
  const o = req('gpt-tokenizer/encoding/o200k_base')
  const c = req('gpt-tokenizer/encoding/cl100k_base')
  for (const p of gate.REVERSE_PROBES) {
    assert.equal(
      o.encode(p.text).length,
      c.encode(p.text).length,
      `反向锁语料 ${p.name} 在两表下不同值 —— 它不再是"等值形态",C3 防空转能力失效`,
    )
  }
  const r = runCli(['--worktree'])
  assert.match(r.stdout, /反向锁全同值/, '真仓跑出来反向锁必须全同值(没被误报成分歧)')
})

test('T8b 既有夹具是**历史语料**而非反向锁:分叉要如实报出,不得据此判"实现坏了"', () => {
  // 夹具里出现分歧是**证据**(印证词表不同),不是"反向锁被破坏"。
  // 若把 fixture.drifts 并进 reverseDrifts,一条语料更新就会被误报成实现回归。
  const r = runCli(['--worktree'])
  assert.match(r.stdout, /【既有夹具】/, '必须单列既有夹具一节')
  assert.match(r.stdout, /历史语料,不是一致性证据/, '必须写明夹具不是一致性证据')
  assert.match(r.stdout, /HEAD 那 24 条的同值是\*\*巧合\*\*/, '必须钉住"24 条同值是巧合"这一事实')
  // 反向锁判红文案只归 REVERSE_PROBES,与夹具分叉数无关
  assert.match(r.stdout, /反向锁全同值/, `反向锁必须仍然全同值\n${r.stdout}`)
})

test('T9 CLI 面旗矛盾 ⇒ exit 2(不冒红也不记绿)', () => {
  const r = runCli(['--staged', '--worktree'])
  assert.equal(r.status, 2, `两面旗同给必须判死,实得 rc=${r.status}`)
  assert.match(r.stderr + r.stdout, /不得同用/)
})

test('T10 面一致性:被审面取不到 ⇒ rc 2 并点名,绝不 rc 0', () => {
  const empty = mkScratch('ihui-bpe-emptyroot-')
  try {
    const r = spawnSync(process.execPath, [SCRIPT, '--root', empty, '--worktree'], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 120000,
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    assert.equal(r.status, 2, `空根必须 rc 2,实得 rc=${r.status}`)
    assert.match(r.stderr + r.stdout, /未判定/)
  } finally {
    rmScratch(empty)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
