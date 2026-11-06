// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// Z53 席镜像测试 · 票 S-26 后半格:台账类活文档的「面一致性」闸(§22c:判据 import 生产出口,零复制)
//
// 立因(现读,取证见 scripts/auto-commit-quiet.mjs 的 partitionLedgerDocFace 头注):Z46 把 converge
// 链的取材面改成 blob 三态后点名"本票未结清的半格在白名单外"——收编器仍把**滞后的台账副本按 pathspec
// 直提**。本测试锁五件事:①滞后即不收编并点名(正向销账);②等值/非台账照收(反向牙,防过度收窄);
// ③取不到输入 ⇒ 未判定不冒绿;④形状锁:旧形态"归并之后直提"不得再现;⑤分工证明:行级 union 仍归
// union-converge,本器只指路不复算。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { gitRaw } from '../lib/face-reader.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { __test__ as auto } from '../auto-commit-quiet.mjs'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const SRC = readFileSync(join(REPO, 'scripts', 'auto-commit-quiet.mjs'), 'utf8')
const UNION_SRC = readFileSync(join(REPO, 'scripts', 'union-converge.mjs'), 'utf8')

const NEW_ROW = '- [x] ✅(2026-11-06/主席结算) G-7 P1 票:面一致性要落地'
const OLD_ROW = '- [ ] G-7 P1 票:面一致性要落地'

function put(dir, rel, text) {
  const abs = join(dir, rel)
  mkdirSync(dirname(abs), { recursive: true })
  writeFileSync(abs, text)
}
/** 独立临时 git 仓(带一枚初始提交,HEAD/rev-list 都问得到)。§15b:不落仓库树内。 */
function newRepo(withPlan = true) {
  const dir = mkScratch('z53-face-')
  gitRaw(['init', '-q', '-b', 'main'], dir)
  gitRaw(['config', 'user.name', 'ihui-test'], dir)
  gitRaw(['config', 'user.email', 'ihui-test@example.invalid'], dir)
  gitRaw(['config', 'commit.gpgsign', 'false'], dir)
  put(dir, 'README.md', '# demo\n')
  if (withPlan) put(dir, 'PROJECT_PLAN.md', `${NEW_ROW}\n- [ ] G-8 另一件事\n`)
  gitRaw(['add', '-A'], dir)
  gitRaw(['commit', '-q', '-m', 'init'], dir)
  return dir
}
const headBlob = (dir, rel) => {
  try {
    return String(gitRaw(['show', `HEAD:${rel}`], dir))
  } catch {
    return null
  }
}
const gate = (dir, paths) => {
  const lines = []
  const out = auto.gateLedgerDocFaceBatch(paths, {
    root: dir,
    logLine: (l) => lines.push(String(l)),
  })
  return { ...out, lines: lines.join('\n') }
}

test('① 滞后副本(真仓真取数臂):HEAD 有较新行、工作树停在旧形态 ⇒ 不收编 + 点名 + 指路', () => {
  const dir = newRepo()
  try {
    put(dir, 'PROJECT_PLAN.md', `${OLD_ROW}\n- [ ] G-8 另一件事\n`) // 滞后台账副本
    const g = gate(dir, ['PROJECT_PLAN.md'])
    assert.deepEqual(g.lagging, ['PROJECT_PLAN.md'], `应判滞后并剔出,实得 ${JSON.stringify(g)}`)
    assert.deepEqual(g.kept, [], '滞后的一枚绝不能再留在提交批里')
    assert.deepEqual(g.undetermined, [], '两面都读得到 ⇒ 不是未判定')
    assert.match(g.lines, /面一致性闸\(PROJECT_PLAN\.md\)/, '必须出声点名')
    assert.match(g.lines, /union-converge/, '必须指路行级 union 器物')
    assert.match(g.lines, /object-space-land/, '必须指路对象空间落盘')
    // 同一 fixture 里把滞后版按 pathspec 直提(= 旧形态做的事):面退化是可量的
    gitRaw(['add', '-A', '--', 'PROJECT_PLAN.md'], dir)
    gitRaw(['commit', '-q', '-m', 'simulated-direct-commit'], dir)
    const after = headBlob(dir, 'PROJECT_PLAN.md')
    assert.ok(!after.includes(NEW_ROW), '前提不成立:直提本应把 HEAD 已入库的较新行洗掉')
    assert.ok(after.includes(OLD_ROW), '直提后 HEAD 面应退回陈旧行(复现成立)')
  } finally {
    rmScratch(dir)
  }
})

test('①b absent(HEAD 面结构上没有这一路径)⇒ 该维无语义、照收,不制造无人能处置的未判定', () => {
  const dir = newRepo()
  try {
    put(dir, 'AGENTS.md', '# 规则文档(尚未入库)\n')
    const g = gate(dir, ['AGENTS.md'])
    assert.deepEqual(g.kept, ['AGENTS.md'], `absent 应放行,实得 ${JSON.stringify(g)}`)
    assert.deepEqual(g.lagging, [])
    assert.deepEqual(g.undetermined, [])
  } finally {
    rmScratch(dir)
  }
})

test('② 反向牙(防过度收窄):等值照收 + 非台账类一律不进射程', () => {
  const dir = newRepo()
  try {
    // (a) 工作树 == HEAD blob:本闸不得凭空造红
    const g1 = gate(dir, ['PROJECT_PLAN.md'])
    assert.deepEqual(g1.kept, ['PROJECT_PLAN.md'], '等值必须照收')
    assert.deepEqual(g1.lagging, [])
    // (b) 同批里台账滞后、业务码与派生态照收:只剔那一枚,不整批拒
    put(dir, 'PROJECT_PLAN.md', `${OLD_ROW}\n- [ ] G-8 另一件事\n`)
    const others = ['scripts/data/cross-end-landing.jsonl', 'apps/demo/src/a.ts', 'README.md']
    for (const p of others) put(dir, p, 'x\n')
    const g2 = gate(dir, ['PROJECT_PLAN.md', ...others])
    assert.deepEqual(g2.lagging, ['PROJECT_PLAN.md'])
    assert.deepEqual(g2.kept.sort(), others.slice().sort(), `非台账类不得被收窄,实得 ${g2.kept}`)
  } finally {
    rmScratch(dir)
  }
})

test('③ 取不到输入 ⇒ 未判定:不记绿也不冒充滞后,且该枚同样剔出本批', () => {
  // (a) 生产臂:unborn HEAD(仓里一枚提交都没有)⇒ HEAD 面既非内容也非 absent ⇒ error
  const dir = mkScratch('z53-face-')
  try {
    gitRaw(['init', '-q', '-b', 'main'], dir)
    gitRaw(['config', 'user.name', 'ihui-test'], dir)
    gitRaw(['config', 'user.email', 'ihui-test@example.invalid'], dir)
    put(dir, 'PROJECT_PLAN.md', `${NEW_ROW}\n`)
    const g = gate(dir, ['PROJECT_PLAN.md'])
    assert.deepEqual(g.kept, [], '未判定不得照收(§0.10 失效方向 = 少提)')
    assert.deepEqual(g.lagging, [], '未判定不得冒充"判成滞后"(§0.3 两面不并桶)')
    assert.deepEqual(g.undetermined, ['PROJECT_PLAN.md'])
    assert.match(g.lines, /面一致性未判定/, '未判定必须出声')
  } finally {
    rmScratch(dir)
  }
  // (b) 纯判据面:HEAD 探针抛错 / 工作树 oid 取不到 ⇒ 两格都落未判定
  const err = auto.partitionLedgerDocFace(['PROJECT_PLAN.md'], {
    headFace: () => ({ error: 'cat-file 无应答' }),
    worktree: () => 'aaaa'.repeat(10),
  })
  assert.deepEqual(err.undetermined, ['PROJECT_PLAN.md'])
  const noWt = auto.partitionLedgerDocFace(['PROJECT_PLAN.md'], {
    headFace: () => ({ oid: 'bbbb'.repeat(10) }),
    worktree: () => null,
  })
  assert.deepEqual(noWt.undetermined, ['PROJECT_PLAN.md'])
  assert.match(noWt.why.get('PROJECT_PLAN.md'), /无法证明/)
})

test('④ 形状锁:旧形态"归并之后按 pathspec 直提"不得再现,两族都必须在提交前过闸', () => {
  const calls = [...SRC.matchAll(/gateLedgerDocFaceBatch\(/g)].length
  assert.equal(calls, 3, `定义 1 处 + 两族装车各 1 处 = 3,实得 ${calls}`)
  assert.match(
    SRC.slice(SRC.indexOf('export const __test__')),
    /gateLedgerDocFaceBatch,/,
    '出口必须登记在 __test__(镜像测试按 §22c 用它,不许在测试里复制判据)',
  )
  const wlStart = SRC.indexOf('function runWhitelistFamily(')
  const wl = SRC.slice(wlStart, SRC.indexOf('\nexport function blockerFromOutput(', wlStart + 10))
  const ldStart = SRC.indexOf('export function runLedgerFamily(')
  const ld = SRC.slice(ldStart, SRC.indexOf('\nfunction main(', ldStart + 10))
  assert.ok(
    wlStart > 0 && ldStart > 0 && wl.length > 200 && ld.length > 200,
    '两个族函数都要能定位(形状锁本身不许哑)',
  )
  // 白名单族:闸必须排在 mergeLiveDoc 之后、syncReadmeNumbers(→ 提交批)之前
  assert.ok(wl.includes('gateLedgerDocFaceBatch('), '白名单族未装车 = 造好没装车(§0.9)')
  assert.ok(
    wl.indexOf('gateLedgerDocFaceBatch(') > wl.indexOf('mergeLiveDoc(f)'),
    '闸必须排在归并之后',
  )
  assert.ok(
    wl.indexOf('gateLedgerDocFaceBatch(') < wl.indexOf('syncReadmeNumbers(stale)'),
    '闸必须排在提交批成形之前(旧形态就是差这一格)',
  )
  // 账本族:闸排在 liveDocGuard 之后、残渣闸与 commit 之前
  assert.ok(ld.includes('gateLedgerDocFaceBatch('), '账本族未装车 = 第二条通道仍在直提')
  assert.ok(
    ld.indexOf('gateLedgerDocFaceBatch(') > ld.indexOf('liveDocGuard(p,'),
    '账本族的闸必须排在归并护栏之后',
  )
  assert.ok(
    ld.indexOf('gateLedgerDocFaceBatch(') < ld.indexOf('commit(list,'),
    '账本族的闸必须排在提交之前',
  )
  // 纯判据零 IO:不得自己读盘、不得回落另一个面
  const judge = SRC.slice(
    SRC.indexOf('export function partitionLedgerDocFace('),
    SRC.indexOf('/**\n * HEAD 面三态取数'),
  )
  assert.ok(judge.length > 200, '判据体定位失败(形状锁不得哑)')
  for (const bad of ['readFileSync', 'readWorktreeFile', 'existsSync', 'show', 'catBatch']) {
    assert.ok(!judge.includes(bad), `纯判据里不得出现 ${bad}(取数一律走注入探针)`)
  }
  // 反向牙:摘掉装车即翻红 —— 用切片构造"旧形态"的那一份源码
  const oldForm = wl.replace('gateLedgerDocFaceBatch(stale)', 'NO_GATE(stale)')
  assert.ok(oldForm !== wl, '替换必须真发生,否则本牙证明不了任何事')
  assert.ok(!/gateLedgerDocFaceBatch\(stale\)/.test(oldForm), '旧形态切片里应已无闸')
})

test('④d 射程只有台账类:README 生成数字块必须在射程外(否则门 173 变恒红门,§12e)', () => {
  assert.equal(auto.isLedgerFaceGated('PROJECT_PLAN.md'), true)
  assert.equal(auto.isLedgerFaceGated('AGENTS.md'), true)
  assert.equal(auto.isLedgerFaceGated('apps/web/AGENTS.md'), true)
  assert.equal(auto.isLedgerFaceGated('README.md'), false, 'README 由 syncReadmeNumbers 独占刷值')
  assert.equal(auto.isLedgerFaceGated('README.en.md'), false)
  assert.equal(auto.isLedgerFaceGated('scripts/data/x.jsonl'), false)
  assert.equal(auto.isLedgerFaceGated('apps/demo/src/a.ts'), false)
})

test('⑤ 分工证明:活文档行级 union 仍由 union-converge 负责,本器只指路、零复算', () => {
  assert.ok(
    UNION_SRC.includes('liveDocExpectedCounts'),
    '行级 union 的在册实现应在 union-converge(分工的另一半)',
  )
  assert.ok(
    !SRC.includes('liveDocExpectedCounts'),
    '收编器不得出现行级 union 的实现或引用(不复算别人的判据,§0.6)',
  )
  assert.ok(
    !/function\s+(rowUnion|liveDocRowUnion)\s*\(/.test(SRC),
    '收编器里不得新长出一份行级 union',
  )
  const dir = newRepo()
  try {
    put(dir, 'PROJECT_PLAN.md', `${OLD_ROW}\n`)
    const g = gate(dir, ['PROJECT_PLAN.md'])
    assert.match(g.lines, /scripts\/union-converge\.mjs/, '滞后出路必须点名活文档器物')
    assert.ok(
      !g.lines.includes('已补回') && !g.lines.includes('插回'),
      '本器不得自己动台账内容(处置权在器物与持牌席位)',
    )
  } finally {
    rmScratch(dir)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
