// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * §22c 镜像测试:scripts/check-live-doc-references.mjs(活文档点名路径存续性 + CK 维)
 *
 * 与源脚本的关系:本文件 `import { __test__ }`(§22d isDirectRun 保证 import 无副作用),
 * **不复制判据实现** —— 两份真相是本仓登记在案的漂移源(见 T7 的形状锁)。
 *
 * 覆盖面:
 *   T1  装车证明(读 **HEAD 面** runner,不读磁盘那份):条目成套 = blocking + skipEnv,
 *       且**不带 --strict**(默认档只报数;把问责档接进提交链就是恒红门,§12e)
 *   T2  取材面形状锁:清单与内容都走 face-reader 的 gitRaw;不得自派生 git、不得 readdirSync
 *   T3  真仓端到端阳性对照:audit 面必须**看得见** CK 存量(checkedMissing>0)而 red=0 ——
 *       看不见存量不算通过,把它判成本次的红也不算通过
 *   T4  临时仓四臂(CK 维的牙):HEAD 存量⇒只报数 / 索引新增⇒判红并点名 / 未勾同形⇒只 warning /
 *       文件与勾同枚进来⇒放过(newlyLanded)
 *   T5  锚点取不到 ⇒ anchor=null 且 judgeRefs 一律算存量("没量到"不得写成"新增红")
 *   T6  report 退出码三态:CK 存量在 --strict 下是**红(1)**不是"未判定(2)";undetermined 才是 2
 *   T7  唯一实现锁:镜像必须经门导出口裁定,旧错形不得回来
 *
 * ⚠️ 形状锁(T2/T7)读的是**工作树**那一份,不是 `HEAD:<path>`:本枚在入库前跑,
 * HEAD 里根本没有 CK 维,按 HEAD 判会让反向锁**空转成绿**(§22c"只判被审面"在这一格里
 * 的反面形态 —— 判据还没进 HEAD 时,读 HEAD 等于没读)。入库后索引==工作树,结论不变。
 */
import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { __test__ as gate } from '../check-live-doc-references.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..')
const GATE_SRC = join(ROOT, 'scripts', 'check-live-doc-references.mjs')

const git = (args, cwd) =>
  spawnSync('git', ['-c', 'safe.directory=*', ...args], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 60000,
    cwd,
    // §12g:本机不写 stdio 会 spawnSync EBUSY(与"取不到"在账面上同形)
    stdio: ['ignore', 'pipe', 'pipe'],
  })

const headOf = (p) => {
  const r = git(['show', `HEAD:${p}`], ROOT)
  assert.equal(r.status, 0, `HEAD:${p} 取不到 ⇒ 无法判定,不得读成"没有"`)
  return r.stdout
}

function initRepo(dir) {
  for (const a of [['init'], ['config', 'user.email', 't@t'], ['config', 'user.name', 't']]) {
    assert.equal(git(a, dir).status, 0, `git ${a.join(' ')} 失败:${git(a, dir).stderr}`)
  }
}

/** 造一个只含活文档的临时 git 仓并完成初始提交。 */
function makeRepo(tag, planLines, extraFiles = {}, commit = true) {
  const dir = mkScratch(`ck84-${tag}-`)
  initRepo(dir)
  writeFileSync(join(dir, 'PROJECT_PLAN.md'), `${planLines.join('\n')}\n`)
  for (const [p, body] of Object.entries(extraFiles)) {
    mkdirSync(dirname(join(dir, p)), { recursive: true })
    writeFileSync(join(dir, p), body)
  }
  if (commit) {
    assert.equal(git(['add', '-A'], dir).status, 0)
    const r = git(['commit', '-m', 'fixture: 初始提交'], dir)
    assert.equal(r.status, 0, r.stderr || r.stdout)
  }
  return dir
}
const stageAll = (dir) => assert.equal(git(['add', '-A'], dir).status, 0)

test('T1 装车证明:HEAD 面 runner 里条目成套,且不带 --strict', () => {
  const out = headOf('scripts/guardian-runner.mjs')
  const at = out.indexOf("'check-live-doc-references.mjs'")
  assert.ok(at > 0, '本门未注册进 guardian-runner —— 头注自称已接线即为谎(守门 89 R1/R2)')
  // 从 script: 反向取整个注册块的花括号边界;取"前后各 N 字符"会跨进邻门(上一版犯过)
  const start = out.lastIndexOf('{', at)
  let depth = 0
  let end = -1
  for (let i = start; i < out.length; i++) {
    if (out[i] === '{') depth++
    else if (out[i] === '}') {
      depth--
      if (depth === 0) {
        end = i
        break
      }
    }
  }
  assert.ok(end > start, '注册块花括号配平失败')
  const block = out.slice(start, end + 1)
  assert.match(block, /mode:\s*'blocking'/, '本门注册必须是 blocking')
  assert.match(
    block,
    /skipEnv:\s*'HUSKY_SKIP_LIVE_DOC_REFERENCES'/,
    'blocking 门必须带应急跳过变量',
  )
  const argsM = /args:\s*\[([^\]]*)\]/.exec(block)
  assert.ok(
    !argsM || !argsM[1].includes('--strict'),
    '默认档只报数;把 --strict 接进提交链 = 恒红门(§12e)',
  )
})

test('T2 取材面形状锁:清单与内容同走 face-reader,禁自派生 git / 禁 readdirSync', () => {
  const src = readFileSync(GATE_SRC, 'utf8')
  assert.match(src, /from\s*'\.\/lib\/face-reader\.mjs'/, '必须引 face-reader')
  assert.match(src, /gitRaw\(/, 'git 调用必须走层的 gitRaw(带 timeout/stdio)')
  assert.doesNotMatch(src, /execSync\s*\(/, '不得自派生 git(无 timeout 那一型)')
  assert.doesNotMatch(
    src,
    /readdirSync\(/,
    '活文档清单必须按被审面枚举,不读磁盘目录(13c A1/A2 同课)',
  )
})

test('T3 真仓阳性对照:audit 面看得见 CK 存量,而它不构成本次的红', () => {
  const res = gate.run({ root: ROOT, face: 'audit' })
  assert.ok(res.docs > 0, '活文档枚举到 0 ⇒ 空扫与"都没违规"同形')
  assert.ok(res.refs > 0, '一条点名都提不出来 ⇒ 提取器哑火')
  assert.ok(
    res.checkedMissing.length > 0,
    '真仓 HEAD 面明明有"已勾行点名失踪路径",看不见就不算通过(阳性对照)',
  )
  for (const c of res.checkedMissing) {
    assert.deepEqual(c.fresh, [], `audit 面与锚点同为 HEAD ⇒ 全部是存量,${c.path} 被读成了新增红`)
  }
  assert.equal(
    res.red.filter((r) => String((r.missing || [])[0] || '').includes('已勾')).length,
    0,
    '存量被算成了红 —— 那就是每台每次被逼 --no-verify 的恒红门(§12e)',
  )
})

test('T4 临时仓四臂:存量报数 / 新增判红 / 未勾只 warning / 同枚补齐放过', () => {
  const dir = makeRepo('t4', ['- [x] 已完成 ✅ 取证件见 `docs/gone-stock.md`'])
  try {
    // A. HEAD 就有这一行 ⇒ 存量,只报数
    const stock = gate.run({ root: dir, face: 'audit' })
    assert.deepEqual(
      stock.checkedMissing.map((c) => c.path),
      ['docs/gone-stock.md'],
      'A 臂:门没看见 HEAD 面上的存量验收缺口(看不见存量不算通过)',
    )
    assert.equal(stock.red.length, 0, 'A 臂:存量不得判红')

    const plan = join(dir, 'PROJECT_PLAN.md')

    // B. 索引里新增一条同样的行 ⇒ 本次新增 ⇒ 判红,且只点新增那一条
    writeFileSync(
      plan,
      '- [x] 已完成 ✅ 取证件见 `docs/gone-stock.md`\n- [x] 已完成 ✅ 另一份见 `docs/gone-fresh.md`\n',
    )
    stageAll(dir)
    const fresh = gate.run({ root: dir, face: 'staged' })
    assert.deepEqual(
      fresh.red
        .filter((r) => String((r.missing || [])[0] || '').includes('已勾'))
        .map((r) => r.path),
      ['docs/gone-fresh.md'],
      `B 臂:本次新增必须判红且只点新增那一条,实得 ${JSON.stringify(fresh.red)}`,
    )

    // C. 同一条挂在**未勾**待办上 ⇒ 仍只 warning(不无谓加严)
    writeFileSync(
      plan,
      '- [x] 已完成 ✅ 取证件见 `docs/gone-stock.md`\n- [ ] 待办,见 `docs/gone-todo.md`\n',
    )
    stageAll(dir)
    const todo = gate.run({ root: dir, face: 'staged' })
    assert.equal(todo.red.length, 0, 'C 臂:未勾行的失踪点名不得判红')
    assert.ok(
      todo.warn.some((w) => w.path === 'docs/gone-todo.md'),
      `C 臂:该条也没被 warning 桶收走 ⇒ 分档失效,实得 ${JSON.stringify(todo.warn.map((w) => w.path))}`,
    )

    // D. 验收行与它点名的文件**同枚**进来 ⇒ 承诺当场兑现,放过且留痕
    writeFileSync(
      plan,
      '- [x] 已完成 ✅ 取证件见 `docs/gone-stock.md`\n- [x] 已完成 ✅ 新增件见 `docs/added-now.md`\n',
    )
    mkdirSync(join(dir, 'docs'), { recursive: true })
    writeFileSync(join(dir, 'docs/added-now.md'), '# 新增\n')
    stageAll(dir)
    const landed = gate.run({ root: dir, face: 'staged' })
    assert.equal(landed.red.length, 0, 'D 臂:正当修法被误伤 —— 本维最危险的新恒红')
    assert.ok(
      landed.newlyLanded.some((n) => n.path === 'docs/added-now.md'),
      `D 臂:放过必须留痕(newlyLanded),不得静默,实得 ${JSON.stringify(landed.newlyLanded)}`,
    )
  } finally {
    rmScratch(dir)
  }
})

test('T5 锚点取不到 ⇒ 一律算存量,绝不把"没量到"写成"新增红"', () => {
  const notARepo = mkScratch('ck84-nogit-')
  try {
    const { anchor, err } = gate.buildCheckedAnchor({ root: notARepo, headSet: new Set() })
    assert.equal(anchor, null, '非 git 目录不得给出一个看起来合法的空军')
    assert.ok(err && String(err).length > 0, 'err 必须点名原因')
    const refs = new Map()
    gate.addRef(refs, 'PROJECT_PLAN.md', gate.normalizeToken('docs/x.md'), true)
    const r = gate.judgeRefs({
      refs,
      headSet: new Set(),
      indexSet: new Set(),
      workCheck: () => false,
      face: 'staged',
      checkedAnchor: anchor,
    })
    assert.equal(r.checkedMissing.length, 1)
    assert.deepEqual(r.checkedMissing[0].fresh, [], '锚点缺席时不得产出"新增"')
  } finally {
    rmScratch(notARepo)
  }
})

test('T6 report 退出码三态:CK 存量在问责档是红(1),未判定才是 2', () => {
  const mk = () => ({
    face: 'audit',
    docs: 1,
    refs: 2,
    green: 1,
    red: [],
    warn: [{ path: 'docs/typo.md', docs: ['PROJECT_PLAN.md'], why: 'x' }],
    newlyLanded: [],
    undetermined: [],
    checkedMissing: [{ path: 'docs/gone.md', docs: ['PROJECT_PLAN.md'], fresh: [], form: 'file' }],
  })
  const capture = (fn) => {
    const lines = []
    const orig = console.log
    console.log = (...a) => lines.push(a.join(' '))
    try {
      return { rc: fn(), lines }
    } finally {
      console.log = orig
    }
  }
  const strict = capture(() => gate.report(mk(), { json: false, strict: true }))
  assert.equal(
    strict.rc,
    1,
    '问责档对"已判定的存量"必须判红 —— 把判过的写成未判定,与把没判写成判过,是同一条禁令的两个方向',
  )
  assert.match(strict.lines.join('\n'), /判红/, '结论文案必须说是红,不是"未判定"')

  const loose = capture(() => gate.report(mk(), { json: false, strict: false }))
  assert.equal(loose.rc, 0, '缺省档(提交链)对存量只报数')

  const undet = capture(() =>
    gate.report({ ...mk(), undetermined: ['取不到:git 不可问'] }, { json: false, strict: false }),
  )
  assert.equal(undet.rc, 2, '未判定 ⇒ 判死,不得记绿')
})

test('T7 唯一实现锁:镜像经门导出口裁定,旧错形不得回来', () => {
  assert.equal(typeof gate.checkedMissingPairs, 'function', '锚点配对集合必须由门导出那一份')
  assert.equal(typeof gate.buildCheckedAnchor, 'function', '锚点构造必须由门导出那一份')
  const src = readFileSync(GATE_SRC, 'utf8')
  assert.doesNotMatch(
    src,
    /\(rec\.checkedDocs \|\| \[\]\)\.length/,
    'Set 问 .length 恒 undefined ⇒ 锚点静默为空 ⇒ 把全部存量算成本次新增红(2026-10-12 实测)',
  )
  assert.match(
    src,
    /const checked = \[\.\.\.\(rec\.checkedDocs \|\| \[\]\)\]/,
    '取空必须展开 Set,且只住一处',
  )
  // 镜像自己也不得另写一份配对判据。
  // ⚠️ 模式必须**拼**出来:把被禁的标识符逐字写进正则字面量,本断言会命中它自己(恒红)。
  const forbidden = new RegExp(
    ['checkedDocs' + '\\.size', 'rec\\.' + 'checkedDocs' + '\\s*!=='].join('|'),
  )
  const self = readFileSync(
    join(ROOT, 'scripts', 'tests', 'check-live-doc-references.test.mjs'),
    'utf8',
  )
  assert.doesNotMatch(self, forbidden, '镜像里出现这些形态就是第二份真相(§22c)')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
