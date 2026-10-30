// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `lib/prod-checkout-root.mjs` 单源镜像测试（RP-90，2026-10-30）。
 * 锁两类病：① 判据行为（四臂选根方向与失效方向）；② **回潮**——同一条机器事实被重新拼第二份
 * （历史上正是三份各拼 `join(devEnvRoot(x),'ihui-prod')` 漂开，一侧读到线上态、另一侧永远影子账）。
 * 判据一律 import 源文件那一份（§22c），测试不复算候选序。
 */
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, parse, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { test } from 'node:test'
import { maskComments } from '../lib/code-mask.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const LIB_REL = 'scripts/lib/prod-checkout-root.mjs'
const libPath = join(REPO, ...LIB_REL.split('/'))

const { prodCheckoutRoot, prodDeployLoopLog, prodWebBuildShaCandidates, PROD_CHECKOUT_BASENAME } = await import(
  pathToFileURL(libPath).href
)

const runWithDevEnv = (v, body) => {
  const prev = process.env.IHUI_DEVENV_ROOT
  try {
    if (v === null) delete process.env.IHUI_DEVENV_ROOT
    else process.env.IHUI_DEVENV_ROOT = v
    return body()
  } finally {
    if (prev === undefined) delete process.env.IHUI_DEVENV_ROOT
    else process.env.IHUI_DEVENV_ROOT = prev
  }
}

// 生产源码取景面：scripts 一层 + scripts/lib 一层（测试与归档不进，防自指）。
// 一律**遮注释**后再判字面量（AGENTS 横向口径：判字面量的门只遮注释）。本枚第一版没遮，
// 被我们自己写在注释里的那句 join(devEnvRoot(...),'ihui-prod') 打成两枚假阳 —— 假阳的锁不如没有。
const readCode = (rel) => maskComments(readFileSync(join(REPO, ...rel.split('/')), 'utf8'))

function underProduction() {
  const out = []
  for (const relDir of ['scripts', 'scripts/lib']) {
    const dir = join(REPO, ...relDir.split('/'))
    for (const n of readdirSync(dir)) {
      if (!n.endsWith('.mjs')) continue
      const rel = `${relDir}/${n}`
      const src = readCode(rel)
      if (!src.trim()) continue
      out.push({ rel, src })
    }
  }
  return out
}


test('四臂：主候选优先 / 显式覆盖不越权 / 无覆盖时并集回落 / 双双缺失仍交主候选（失效方向不改）', () => {
  const norm = (p) => resolve(p)
  const VR = 'X:/vroot/.DevEnv'
  const VP = 'X:/virtual/IHUI-AI'
  const cand = norm(join(VR, PROD_CHECKOUT_BASENAME))
  const alt = norm(join('X:\\', 'DevEnv', PROD_CHECKOUT_BASENAME))

  // 有显式覆盖臂：坐标完全虚拟，可判定"优先级"与"不得越权"两格。
  runWithDevEnv(VR, () => {
    const both = (p) => [cand, alt].includes(norm(p))
    assert.equal(norm(prodCheckoutRoot(VP, both)), cand, '主候选在 ⇒ 回落不得改写优先级')
    assert.equal(norm(prodCheckoutRoot(VP, (p) => norm(p) === alt)), cand, '显式覆盖 ⇒ 绝不越权回落（T17 那格）')
    assert.equal(norm(prodCheckoutRoot(VP, () => false)), cand, '都不在 ⇒ 给出主候选让调用方点名，不得返回空')
  })

  // 无覆盖臂必须用真仓坐标：虚拟路径下 devEnvRoot 直接落 <盘根>/DevEnv ⇒ 两候选同根、测不出回落。
  // 断言写成形态无关的一条 —— 无论主候选是谁，"盘根侧存在时取到盘根侧"这条核心承诺都必须成立。
  runWithDevEnv(null, () => {
    const rootAlt = norm(join(resolve(parse(REPO).root), 'DevEnv', PROD_CHECKOUT_BASENAME))
    const onlyAlt = (p) => norm(p) === rootAlt
    assert.equal(norm(prodCheckoutRoot(REPO, onlyAlt)), rootAlt, '盘根侧存在 ⇒ 并集必须取到它（修瞎的那格的本体承诺）')
    assert.equal(
      norm(prodDeployLoopLog(REPO, onlyAlt)),
      norm(join(rootAlt, 'deploy/win/deploy-loop.log')),
      '日志腿必须随解析器换根，不得另拼一条路径',
    )
  })
})

test('BASENAME 单源：lib 内 ' + "'ihui-prod'" + " 字面量恰一处（定义处），消费方拼根不得再写第二条", () => {
  const src = readCode(LIB_REL)
  assert.equal(PROD_CHECKOUT_BASENAME, 'ihui-prod')
  const inLib = (src.match(/'ihui-prod'/g) || []).length
  assert.equal(inLib, 1, `lib 里出现 ${inLib} 处字面量（要求恰 1：BASENAME 定义；注释里用反引号不算）`)
})

test('单源锁：全仓生产源码里 export function prodCheckoutRoot 恰一处，且就在 lib', () => {
  const hits = underProduction()
    .filter((f) => /export function prodCheckoutRoot/.test(f.src))
    .map((f) => f.rel)
  assert.deepEqual(hits, [LIB_REL], `实现只许一份，实得 ${JSON.stringify(hits)}`)
})

test('回潮锁：三门/两 lib 不得再自拼 join(devEnvRoot(…), ’ihui-prod’)，一律吃单源', () => {
  const watchers = [
    'scripts/lib/deploy-decisions-face.mjs',
    'scripts/check-prod-checkout-foreign-work.mjs',
    'scripts/check-ops-patrol.mjs',
    'scripts/check-credential-health.mjs',
  ]
  for (const rel of watchers) {
    const src = readCode(rel)
    assert.doesNotMatch(src, /join\(\s*devEnvRoot\([^)]*\)\s*,\s*'ihui-prod'\s*\)/, `${rel} 又出现自拼生产根 ⇒ 第二份候选序必然漂开(§0.6)`)
  }
  // 消费面必须真接上单源（不是注释里提一句就算接了 —— §0.9 造好没装车=没有）
  assert.match(readCode('scripts/lib/deploy-decisions-face.mjs'), /prodCheckoutRoot\(/)
  assert.match(readCode('scripts/check-prod-checkout-foreign-work.mjs'), /prodCheckoutRoot\(/)
})

test('门体只薄再导出：check-ops-patrol 从 lib 取并再导出，自身不留第二份实现', () => {
  const gate = readCode('scripts/check-ops-patrol.mjs')
  assert.match(gate, /from '\.\/lib\/prod-checkout-root\.mjs'/, '门体没接单源')
  assert.match(gate, /export \{[^}]*prodCheckoutRoot[^}]*\}/, '门体没再导出 ⇒ 既有 import 面(check-credential-health)会断')
  assert.doesNotMatch(gate, /const fallback = join\(parse\(/, '门体里还留着第二份回落实现')
  assert.equal(typeof prodCheckoutRoot, 'function')
})

// ── 线上 web 构建标记的落点(2026-10-30 补)────────────────────────────────
// 立因:停摆尺子硬读 `apps/web/.next/IHUI_BUILD_SHA`,而活环只写 `.next-blue`/`.next-green`
// ⇒ 每轮读空 ⇒ 把一次刚成功的部署判成 level=fail 并送进 critical 到人通道。
// 这一族用例钉的是"落点按活跃色取"与"读不到状态件时绝不猜色"两个方向。
const WB_STATE = join('deploy', 'run', 'web-bluegreen.json')
const readerOf = (activeJson) => (p) => (p.endsWith(WB_STATE) ? activeJson : '')

test('T-WEB-1 active=blue ⇒ 首候选是 .next-blue 的标记,且非活跃色一律不出现在候选里', () => {
  const cands = prodWebBuildShaCandidates(join('X:', 'prod'), readerOf(JSON.stringify({ active: 'blue' })))
  assert.equal(cands[0], join('X:', 'prod', 'apps', 'web', '.next-blue', 'IHUI_BUILD_SHA'))
  assert.ok(!cands.some((p) => p.includes('.next-green')), '把非活跃色列进候选 ⇒ 会读到上一色的陈旧标记')
  assert.equal(cands[cands.length - 1], join('X:', 'prod', 'apps', 'web', '.next', 'IHUI_BUILD_SHA'))
})

test('T-WEB-2 active=green ⇒ 候选序整体翻转(成对夹具:只测 blue 等于没测色是从状态件读的)', () => {
  const cands = prodWebBuildShaCandidates(join('X:', 'prod'), readerOf(JSON.stringify({ active: 'green' })))
  assert.equal(cands[0], join('X:', 'prod', 'apps', 'web', '.next-green', 'IHUI_BUILD_SHA'))
  assert.ok(!cands.some((p) => p.includes('.next-blue')))
})

test('T-WEB-3 状态件坏 / active 不在封闭词表 ⇒ 不猜色,只留 .next 一档(§0.3)', () => {
  for (const body of ['', 'not json', JSON.stringify({ active: 'purple' }), JSON.stringify({})]) {
    const cands = prodWebBuildShaCandidates(join('X:', 'prod'), readerOf(body))
    assert.deepEqual(cands, [join('X:', 'prod', 'apps', 'web', '.next', 'IHUI_BUILD_SHA')], `坏态 "${body}" 不得产出一个没依据的色目录`)
  }
})

test('T-WEB-4 覆盖面锁:线上标记落点不得再被第二处自拼 —— 除 lib 定义处,全仓源码里 .next/IHUI_BUILD_SHA 的字面拼接恰 0 处', () => {
  const libSrc = readCode(LIB_REL)
  assert.equal((libSrc.match(/'IHUI_BUILD_SHA'/g) || []).length, 2, 'lib 里该字面量应恰在两处候选拼接(色目录 + .next 回落)')
  const consumers = ['scripts/check-credential-health.mjs', 'scripts/check-ops-patrol.mjs', 'scripts/lib/deploy-decisions-face.mjs']
  for (const rel of consumers) {
    assert.doesNotMatch(readCode(rel), /'IHUI_BUILD_SHA'/, `${rel} 又自拼线上标记落点 ⇒ 第二份必然与蓝绿形态漂开(§0.6)`)
  }
  assert.match(readCode('scripts/check-credential-health.mjs'), /prodWebBuildShaCandidates\(/, '取材层没接单源 = 造好没装车(§0.9)')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
