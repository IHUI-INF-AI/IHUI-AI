// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @ihui-seat S-RP90 2026-11-01

/**
 * RP-90 形态遮蔽锁：`scripts/check-prod-checkout-foreign-work.mjs` 通道 C 与
 * `scripts/lib/deploy-decisions-face.mjs` 的生产候选必须都问 `lib/prod-checkout-root.mjs` 单源。
 *
 * 病灶（2026-10-30 实测，G-814433 之后的新机器形态）：
 *   `devEnvRoot(repoRoot)` 的选形态粒度是「仓内 `.DevEnv` **根目录**在不在」；
 *   当 `backups`/`Temp` 搬进了仓内、而 `ihui-prod` 仍留在盘根侧时，
 *   根目录在 ⇒ `devEnvRoot` 返回 `<repo>/.DevEnv` ⇒ 自拼 `<repo>/.DevEnv/ihui-prod` **恒缺**
 *   ⇒ 通道 C 恒判「约定目录量过·无此目录」，台账候选静默回落主仓影子账。
 *
 * 合成面（不写死盘符、不在盘根落任何真实目录）：
 *   · 真实临时仓根 `<tmp>/srp90-xxxx/repo`，其内**真建** `.DevEnv/`（病灶前提成立）；
 *   · 「盘根侧那份」只以**注入的 exists 谓词**存在 —— 盘根路径由 `path.parse(repoRoot).root`
 *     推导（该推导本身就是要锁的契约），绝不在 C:\, G:\ 之类根上建目录（那会碰真生产 checkout）。
 *   · 因此本文件对 `exists` 的注入是判据面的一部分（单源纯函数本就为此可注入，§22c），
 *     而不是"测不过就换假数据"。
 *
 * 牙（正例 + 反向例）：
 *   正例：通道 C 在「仓内 .DevEnv 在 + 盘根侧 ihui-prod 带 .git」的面上必须解析到**盘根侧**那份。
 *   反向例：把通道 C 改回 `join(devEnvRoot(repoRoot),'ihui-prod')`（本文件 `legacyChannelC`
 *     就是那条回退的逐字镜像），同一面上解析结果必为「空 / 仓内侧路径」⇒ 正例断言翻红。
 *     已实跑变异验证（把生产文件真的改回旧写法后本文件 3 条翻红，见席位记录）。
 */
import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, parse, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { devEnvRoot } from '../seal-c-root-stray.mjs'
import { prodCheckoutRoot } from '../lib/prod-checkout-root.mjs'
import { conventionalProdRoots } from '../check-prod-checkout-foreign-work.mjs'
import { candidatesFor, LEDGER_BASENAME } from '../lib/deploy-decisions-face.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const SRC_FOREIGN = join(HERE, '..', 'check-prod-checkout-foreign-work.mjs')
const SRC_FACE = join(HERE, '..', 'lib', 'deploy-decisions-face.mjs')

const norm = (p) => String(p ?? '').replace(/[\\/]+/g, '/').replace(/\/+$/, '').toLowerCase()

// —— 合成面 ——
// 不用 lib/scratch-dir.mjs 的 mkScratch：它的落点含 `ihui-scratch` 段，而 devEnvRoot 对
// 「仓根位于 scratch 夹具内」会显式抛错（通道 C 会落 refused）⇒ 那种落点根本造不出本格的病灶形态。
const FIXTURE_PARENT = mkdtempSync(join(tmpdir(), 'srp90-shape-'))
const FIX = (() => {
  const repo = join(FIXTURE_PARENT, 'repo')
  mkdirSync(join(repo, '.DevEnv'), { recursive: true })
  const driveRoot = parse(repo).root
  return {
    repo,
    driveRoot,
    repoInner: join(repo, '.DevEnv', 'ihui-prod'),
    // 盘根侧（推导走 parse().root，不写死 C:/ 或 G:/）
    driveSide: join(driveRoot, 'DevEnv', 'ihui-prod'),
  }
})()

/** 形态：「仓内 .DevEnv 根在、仓内 ihui-prod **不在**、盘根侧那份带 .git 在」。 */
const shadowShape = (p) => {
  const n = norm(p)
  return n === norm(FIX.driveSide) || n === norm(join(FIX.driveSide, '.git'))
}

after(() => {
  try {
    rmSync(FIXTURE_PARENT, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
  } catch (e) {
    console.warn(`⚠ S-RP90 夹具未清理：${FIXTURE_PARENT} —— ${String(e?.message ?? e).slice(0, 120)}`)
  }
})

/** 回退版通道 C 的逐字镜像（= 修复前的写法）。它不是被测对象，是"变成什么样该红"的标尺。 */
function legacyChannelC(repoRoot) {
  const cand = join(devEnvRoot(repoRoot), 'ihui-prod')
  return cand
}

// —— ① 前提：病根本身存在（否则这条票的合成面是假的）——
test('前提：仓内 .DevEnv 在 ⇒ devEnvRoot 返回仓内路径（这就是遮蔽病灶的根）', () => {
  assert.equal(norm(devEnvRoot(FIX.repo)), norm(join(FIX.repo, '.DevEnv')), '合成面必须真的触发仓内形态')
  assert.notEqual(norm(join(parse(FIX.repo).root, 'DevEnv')), norm(join(FIX.repo, '.DevEnv')), '两形态必须不是同一个目录，否则本测试无判别力')
})

// —— ② 正例：通道 C 必须解析到盘根侧那份 ——
test('正例·通道 C：仓内 ihui-prod 缺、盘根侧在 ⇒ 必须解析到盘根侧（不得落成"量过·无此目录"）', () => {
  const r = conventionalProdRoots(FIX.repo, { exists: shadowShape, env: {} })
  assert.equal(r.state, 'measured', `通道 C 不许因此抛错/拒判：${JSON.stringify(r)}`)
  assert.deepEqual(r.roots.map(norm), [norm(FIX.driveSide)], '必须取盘根侧那份带 .git 的 checkout')
  assert.ok(r.roots.length > 0, '为空即"回流主仓影子账"的那一格')
})

// —— ③ 反向例：回退写法在同一面上必须给不出答案（正例据此有牙）——
test('反向例·回退写法（join(devEnvRoot,ihui-prod)）在同一合成面上必须恒缺 ⇒ 正例必红', () => {
  const legacy = legacyChannelC(FIX.repo)
  assert.equal(norm(legacy), norm(FIX.repoInner), '回退版算出来的就是仓内那一份')
  assert.equal(shadowShape(legacy), false, '仓内那一份在合成面上不存在')
  const legacyRoots = shadowShape(legacy) ? [legacy] : []
  assert.deepEqual(legacyRoots, [], '回退后 roots 为空 ⇒ 上一条 deepEqual 必红。这就是牙')
  // 顺带钉住"回退不会抛成 refused 而误当成环境问题"：它安静地给空集
  assert.equal(norm(prodCheckoutRoot(FIX.repo, shadowShape, {})), norm(FIX.driveSide), '单源本身必须给出盘根侧')
})

// —— ④ 优先级：主候选在时回落不得改写它 ——
test('优先级：仓内 ihui-prod 也在 ⇒ 仍取仓内（回落只补缺，不改写优先级）', () => {
  const bothShape = (p) => {
    const n = norm(p)
    return (
      n === norm(FIX.repoInner) ||
      n === norm(join(FIX.repoInner, '.git')) ||
      n === norm(FIX.driveSide) ||
      n === norm(join(FIX.driveSide, '.git'))
    )
  }
  const r = conventionalProdRoots(FIX.repo, { exists: bothShape, env: {} })
  assert.deepEqual(r.roots.map(norm), [norm(FIX.repoInner)])
})

// —— ⑤ 显式 IHUI_DEVENV_ROOT = 强声明，绝不越权回落（未判定，不折绿）——
test('边界：显式 IHUI_DEVENV_ROOT 声明后主候选缺 ⇒ 落"无此目录"，绝不越权取盘根侧', () => {
  const r = conventionalProdRoots(FIX.repo, { exists: shadowShape, env: { IHUI_DEVENV_ROOT: join(FIX.repo, '.DevEnv') } })
  assert.equal(r.state, 'measured')
  assert.deepEqual(r.roots, [], '夹具声明"生产根不存在"时被真机另一侧找回输入 ⇒ 把未判定判成有读数')
})

// —— ⑥ 两候选都不在：返回空 roots（调用方落未判定），不编一个假根 ——
test('失效方向：两候选都不在 ⇒ roots 为空，而不是返回一个不存在的根', () => {
  const r = conventionalProdRoots(FIX.repo, { exists: () => false, env: {} })
  assert.deepEqual(r.roots, [])
  assert.equal(r.state, 'measured')
})

// —— ⑦ 台账面（deploy-decisions-face）同源锁 ——
test('台账面：prod 候选必须等于单源推导（不再自拼 devEnvRoot），且不得越过单源自己算', () => {
  const cands = candidatesFor({ repoRoot: FIX.repo, env: {} })
  const prod = cands.find((c) => c.kind === 'prod-checkout')
  assert.ok(prod, '必须仍产出 prod-checkout 候选')
  const expected = join(prodCheckoutRoot(FIX.repo), '.ihui-agent', LEDGER_BASENAME)
  assert.equal(norm(prod.path), norm(expected), 'prod 候选的根必须逐字来自单源')
  assert.equal(norm(prod.root), norm(prodCheckoutRoot(FIX.repo)))
})

// —— ⑧ 源码形状锁（§0.9 造好没装车 = 没有；回退到自拼会在这里立刻红）——
test('形状锁：两个消费方都必须 import 单源，且本文件之外不得再出现 devEnvRoot 自拼 ihui-prod', () => {
  const foreign = readFileSync(SRC_FOREIGN, 'utf8')
  assert.match(foreign, /import\s*\{\s*prodCheckoutRoot\s*\}\s*from\s*'\.\/lib\/prod-checkout-root\.mjs'/, '通道 C 必须 import 单源')
  assert.doesNotMatch(foreign, /^import[^\n]*devEnvRoot/m, '通道 C 不得再 import devEnvRoot（自拼的入口）')
  assert.match(foreign, /prodCheckoutRoot\(\s*repoRoot\s*,\s*hasCheckout\s*,\s*env\s*\)/, '通道 C 必须把 .git 守卫与 env 一起交给单源（§0.6 不拼第二份候选序）')

  const face = readFileSync(SRC_FACE, 'utf8')
  assert.match(face, /import\s*\{\s*prodCheckoutRoot\s*\}\s*from\s*'\.\/prod-checkout-root\.mjs'/, '台账面必须 import 单源')
  assert.doesNotMatch(face, /^import[^\n]*devEnvRoot/m, '台账面不得再 import devEnvRoot')
  assert.match(face, /prodCheckoutRoot\(\s*repoRoot\s*\)/, '台账面的生产候选必须逐字问单源')
})

test('形状锁·反例可构造：把回退写法写进源码会影响本测试所锁的调用形（自证闸不是散文）', () => {
  const legacySrc = `conventionalProdRoots: const cand = join(devEnvRoot(repoRoot), 'ihui-prod')`
  assert.doesNotMatch(legacySrc, /prodCheckoutRoot\(\s*repoRoot\s*,\s*hasCheckout\s*,\s*env\s*\)/, '回退形态不满足 ⑧ 的第一条断言 ⇒ ⑧ 对回退敏感')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
