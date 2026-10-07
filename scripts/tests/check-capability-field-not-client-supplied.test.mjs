// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 镜像测试:scripts/check-capability-field-not-client-supplied.mjs(§22c 模式)。
 *
 * 这一枚走的是"测试改调生产判据"那条通道:判据本体(`readCapabilityFields` /
 * `dynamicConcatPattern` / `judgeFile` / `listRepoFiles` 与两条形态正则)一律从
 * `../check-capability-field-not-client-supplied.mjs` 的 `__test__` 出口取,
 * 本文件**不再声明**任何名单、正则集或常量表(重抄一份就是第二套真相,门 191 拦的正是它)。
 *
 * 断言的输入逐字取自真仓 HEAD(git 取材走 scripts/lib/face-reader.mjs 的 catBatch,
 * 不在这里拼 git show):
 *   · 名单本体 packages/types/src/agent-runtime.ts
 *   · 注入口调用方 packages/api-client/src/client.ts
 *   · Python 侧注入点 apps/ai-service/app/routers/engine.py
 *   · 声明形态样本 apps/web/src/lib/entitlement-tri-state.ts(取 HEAD 里那一行原文)
 *   · 无关样本 packages/shared/src/utils/format-mobile.ts
 *
 * 成对口径(每条判据都有"必须命中"与"必须放过"两臂,不并列不并桶):
 *   C1 名单现读 / C2 三面 cleared 与 clean / C3 声明形态 hit↔cleared 变异对 /
 *   C4 动态拼接 undetermined↔非 undetermined / C5 两条正则各自的命中与不命中 /
 *   C6 端到 CLI(临时目录里的门副本):hit 必红、cleared 必绿、名单本体缺失必须判死不记绿 /
 *   C7 默认档枚举面与 CLI 结论的一致性(尺子活着 ≠ 尺子说真话,两面必须同一答案)。
 *
 * 不钉任何存量数字:命中数、覆盖面文件数只作现读打印,写进断言会把"修好了那天"变成一条
 * 与本次改动无关的红(AGENTS §12e)。
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { __test__ as gate } from '../check-capability-field-not-client-supplied.mjs'
import { catBatch } from '../lib/face-reader.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { copyScriptWithClosure } from '../lib/scratch-module-closure.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const SCRIPTS_DIR = resolve(HERE, '..')
const REPO_ROOT = resolve(SCRIPTS_DIR, '..')
const GATE_REL = 'check-capability-field-not-client-supplied.mjs'

/** 被取证的四个真站点 + 一个无关样本(路径是数据,不是判据)。 */
const REGISTRY_REL = gate.REGISTRY_FILE
const INJECTOR_REL = 'packages/api-client/src/client.ts'
const PY_INJECTOR_REL = 'apps/ai-service/app/routers/engine.py'
const DECLARE_REL = 'apps/web/src/lib/entitlement-tri-state.ts'
const NEUTRAL_REL = 'packages/shared/src/utils/format-mobile.ts'

/** HEAD 面一次性批量取正文;取不到即判死(绝不回落成"没有内容 = 没有违规")。 */
function headBlobs(rels) {
  const specs = rels.map((r) => `HEAD:${r}`)
  const got = catBatch(REPO_ROOT, specs, { timeout: 120_000 })
  const out = {}
  const missing = []
  for (let i = 0; i < rels.length; i++) {
    const text = got.get(specs[i])
    if (typeof text !== 'string') missing.push(rels[i])
    else out[rels[i]] = text
  }
  if (missing.length > 0) throw new Error(`HEAD 面取不到 ${missing.length} 个正文,首个:${missing[0]}`)
  return out
}

const BLOBS = headBlobs([REGISTRY_REL, INJECTOR_REL, PY_INJECTOR_REL, DECLARE_REL, NEUTRAL_REL])
const FIELDS = gate.readCapabilityFields()

/** 派生 CLI:退出码与合流输出一起拿(非零不是异常,它就是被测结论)。 */
function runGate(scriptAbs, args) {
  try {
    const out = execFileSync(process.execPath, [scriptAbs, ...args], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 180_000,
      maxBuffer: 32 << 20,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return { code: 0, out }
  } catch (e) {
    return { code: typeof e?.status === 'number' ? e.status : -1, out: `${e?.stdout ?? ''}${e?.stderr ?? ''}` }
  }
}

function put(dir, rel, text) {
  const abs = join(dir, rel)
  mkdirSync(dirname(abs), { recursive: true })
  writeFileSync(abs, text, 'utf8')
  return abs
}

/** 从 HEAD 的声明形态样本里现取一行原文(不手抄,样本漂了本条自己会红)。 */
function headDeclareLine() {
  const line = BLOBS[DECLARE_REL]
    .split('\n')
    .find((l) => l.includes(FIELDS[0]) && l.includes(':'))
  if (typeof line !== 'string' || line.trim().length === 0)
    throw new Error(`${DECLARE_REL} 的 HEAD 面里取不到"名单键 + 冒号"那一行,取证样本已漂移`)
  return line
}

test('C1 名单只有一份真相:readCapabilityFields() 的每一键都真在 HEAD 名单本体里', () => {
  assert.ok(Array.isArray(FIELDS), 'readCapabilityFields() 必须返回数组')
  assert.ok(FIELDS.length > 0, '名单为空即判死,不得当成"没有键可查"放过')
  assert.equal(new Set(FIELDS).size, FIELDS.length, `名单里有重复键:${FIELDS.join(',')}`)
  for (const f of FIELDS) {
    assert.equal(typeof f, 'string')
    assert.ok(f.length > 0, '空键名进不了声明形态判定,是名单读取本身的破损')
    assert.ok(BLOBS[REGISTRY_REL].includes(f), `名单键 ${f} 不在 HEAD 的 ${REGISTRY_REL} 里 ⇒ 读到的不是本体那一份`)
  }
  console.log(`    · 现读名单(${FIELDS.length} 键):${FIELDS.join(',')}`)
})

test('C2 三面真站点必须判"放过"(注入口调用方 / 名单本体 / Python 注入点),无关样本判"不判"', () => {
  assert.equal(gate.judgeFile(REGISTRY_REL, BLOBS[REGISTRY_REL], FIELDS), 'cleared', '名单本体必须被认成定义处,否则每次写名单都自触红')
  assert.equal(gate.judgeFile(INJECTOR_REL, BLOBS[INJECTOR_REL], FIELDS), 'cleared', '真调注入口的文件必须放过')
  assert.equal(gate.judgeFile(PY_INJECTOR_REL, BLOBS[PY_INJECTOR_REL], FIELDS), 'cleared', 'Python 侧注入点必须放过(跨语言两面同一条判据)')
  const neutral = BLOBS[NEUTRAL_REL]
  assert.ok(
    FIELDS.every((f) => !neutral.includes(f)),
    '无关样本必须真的不含名单键,否则下面那条 clean 断言是在测别的东西',
  )
  assert.equal(gate.judgeFile(NEUTRAL_REL, neutral, FIELDS), 'clean', '不含名单键的文件不得被数成"放过"(放过与不判是两格)')
})

test('C3 声明形态成对:同一行 HEAD 原文,接上注入口判放过、摘掉判命中;注释里提一句不算接线', () => {
  const decl = headDeclareLine()
  const bare = `export interface Snapshot {\n${decl}\n}\n`
  const wired = `export function pick(raw: Record<string, unknown>) {\n  return stripClientCapabilityFields(raw)\n}\n${bare}`
  assert.equal(gate.judgeFile('bare.ts', bare, FIELDS), 'hit', '声明了名单键又不调注入口 ⇒ 必须红(客户端可自报档位)')
  assert.equal(gate.judgeFile('wired.ts', wired, FIELDS), 'cleared', '同一份声明,接上宿主注入口就必须放过')
  const commentOnly = `// 这里应当调 stripClientCapabilityFields 但没调\n${bare}`
  assert.equal(
    gate.judgeFile('comment.ts', commentOnly, FIELDS),
    'hit',
    '注释里提到注入口不等于接线(判据跑在代码面上,不能把"说过"读成"做过")',
  )
})

test('C4 动态拼接落"未判定"这一格,且真仓名单本体不被误判成动态', () => {
  const field = FIELDS.find((f) => /[A-Z]/.test(f)) ?? FIELDS[0]
  const cut = field.search(/[A-Z]/)
  assert.ok(cut > 0, `取不到一个可切的驼峰位(样本键:${field})⇒ 本条失去依据`)
  const reList = gate.dynamicConcatPattern(field)
  assert.equal(reList.length, field.length - 1, '每个切点都要有一条拼接式,少一个切点就是漏判面')
  const dyn = `const key = '${field.slice(0, cut)}' + '${field.slice(cut)}'\nexport function apply(p) {\n  p[key] = 1\n}\n`
  assert.ok(reList.some((re) => re.test(dyn)), '动态拼接式认不出自己该认的形状 ⇒ undetermined 那一格是空的')
  assert.equal(gate.judgeFile('dyn.ts', dyn, FIELDS), 'undetermined', '键名被拆成两段拼接 ⇒ 静态判不了,必须逐条报名而不是放过')
  assert.equal(
    gate.judgeFile('dyn-clean.ts', BLOBS[REGISTRY_REL], FIELDS) !== 'undetermined',
    true,
    '名单本体被判成"动态拼接"就是尺子过宽:全仓每一处引用都会被它吞成未判定',
  )
  assert.ok(!reList.some((re) => re.test(BLOBS[REGISTRY_REL])), '同上:正则集在名单本体上必须不命中')
})

test('C5 两条接线正则各有一对正反,且都跑在 HEAD 原文上', () => {
  assert.ok(gate.INJECTION_CALL_RE.test(BLOBS[INJECTOR_REL]), '注入口调用式必须认得真仓 TS 那一处')
  assert.ok(gate.INJECTION_CALL_RE.test(BLOBS[PY_INJECTOR_REL]), '注入口调用式必须认得真仓 Python 那一族')
  assert.ok(!gate.INJECTION_CALL_RE.test(BLOBS[NEUTRAL_REL]), '无关文件被认成"调了注入口" ⇒ 全仓都会被放过')
  assert.ok(gate.REGISTRY_MARKER_RE.test(BLOBS[REGISTRY_REL]), '名单本体标记式必须认得 TS 那一份')
  assert.ok(gate.REGISTRY_MARKER_RE.test(BLOBS[PY_INJECTOR_REL]), '名单本体标记式必须认得 Python 那一份')
  assert.ok(!gate.REGISTRY_MARKER_RE.test(BLOBS[NEUTRAL_REL]), '同上,无关文件不得命中名单标记')
})

test('C6 端到 CLI(临时目录里的门副本):命中必红并点名,放过必绿,名单本体缺失必须判死', () => {
  const dir = mkScratch('cap-field-mirror-')
  try {
    const scriptsCopy = join(dir, 'scripts')
    copyScriptWithClosure(SCRIPTS_DIR, GATE_REL, scriptsCopy, ['lib/scratch-dir.mjs'])
    const gateAbs = join(scriptsCopy, GATE_REL)
    const decl = headDeclareLine()
    put(dir, REGISTRY_REL, BLOBS[REGISTRY_REL])
    const hitRel = 'packages/api-client/src/endpoints/hit-fixture.ts'
    const okRel = 'packages/api-client/src/endpoints/ok-fixture.ts'
    put(dir, hitRel, `export interface P {\n${decl}\n}\n`)
    put(dir, okRel, `export function f(raw) {\n  return stripClientCapabilityFields(raw)\n}\nexport interface Q {\n${decl}\n}\n`)
    const bad = runGate(gateAbs, ['--files', `${hitRel},${okRel}`])
    assert.equal(bad.code, 1, `有 hit 必须 exit 1,实得 ${bad.code}:${bad.out}`)
    assert.ok(bad.out.includes(hitRel), `判红必须点名 hit 落点,实得:${bad.out}`)
    assert.ok(!bad.out.includes(okRel), `已接线的那份不得被一起点名:${bad.out}`)
    const good = runGate(gateAbs, ['--files', okRel])
    assert.equal(good.code, 0, `全放过必须 exit 0,实得 ${good.code}:${good.out}`)
    // 判死那一格:名单本体取不到 ⇒ exit 2,绝不写成"0 命中"
    const noRegistry = mkScratch('cap-field-noregistry-')
    try {
      const scripts2 = join(noRegistry, 'scripts')
      copyScriptWithClosure(SCRIPTS_DIR, GATE_REL, scripts2, ['lib/scratch-dir.mjs'])
      const dead = runGate(join(scripts2, GATE_REL), ['--files', 'packages/api-client/src/endpoints/x.ts'])
      assert.equal(dead.code, 2, `名单本体缺失必须判死(exit 2),实得 ${dead.code}:${dead.out}`)
      assert.ok(!/0 命中/.test(dead.out), `判死不记绿:输出里不得出现"0 命中"这种通过话术:${dead.out}`)
    } finally {
      rmScratch(noRegistry)
    }
  } finally {
    rmScratch(dir)
  }
})

test('C7 默认档两面同答案:listRepoFiles 枚举非空,且用生产判据自算的 hit 数与 CLI 退出码同一结论', () => {
  const face = gate.listRepoFiles()
  assert.ok(Array.isArray(face) && face.length > 0, '默认档枚举到 0 个文件 ⇒ 尺子失明,不得当成"全仓干净"')
  assert.equal(new Set(face).size, face.length, '枚举面有重复项 ⇒ 命中数会被同一文件顶两遍')
  let hits = 0
  let undetermined = 0
  let unreadable = 0
  let firstHitRel = null
  for (const rel of face) {
    const abs = join(REPO_ROOT, rel)
    if (!existsSync(abs)) {
      unreadable++
      continue
    }
    const outcome = gate.judgeFile(rel, readFileSync(abs, 'utf8'), FIELDS)
    if (outcome === 'hit') {
      hits++
      if (firstHitRel === null) firstHitRel = rel
    } else if (outcome === 'undetermined') undetermined++
  }
  const cli = runGate(join(SCRIPTS_DIR, GATE_REL), [])
  console.log(
    `    · 现读:覆盖面 ${face.length} 文件(取不到 ${unreadable})/ 自算 hit ${hits} / 自算未判定 ${undetermined} / CLI exit ${cli.code}`,
  )
  assert.equal(
    hits === 0,
    cli.code === 0,
    `生产判据自算(${hits} 处 hit)与 CLI 退出码(${cli.code})结论相反 ⇒ 有一面在说谎:${cli.out}`,
  )
  if (hits > 0) {
    assert.ok(cli.out.includes(firstHitRel), `CLI 判红必须点名自算找到的那一处 ${firstHitRel}:${cli.out}`)
    assert.ok(/无法判定/.test(cli.out) === false, `默认档两面都有正文时不得报"无法判定":${cli.out}`)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
