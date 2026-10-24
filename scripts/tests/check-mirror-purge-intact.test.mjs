// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * §22c 镜像测试:check-mirror-purge-intact 的接线方向锁与源码级反向锁。
 *
 * 判据**行为**(M1–M4 正反对照 / 三面 / 一行一条 / 全缺未判定)由门自己的 `--self-test`
 * 在真临时仓里成对证明(19 例);本文件只钉"只有镜像能钉"的东西 —— 跨文件与源码形状:
 *  T1  方向锁:未注册 ⇒ 头注必须明说未接线且无肯定式声称;已注册 ⇒ 注册块 blocking +
 *      skipEnv 成套 + 数字 id,且头注那一行说已接入。
 *  T2  提取器有牙:同一提取器对不含本门的合成 runner 必须返回 null(否则 T1 恒真)。
 *  T3  判据不得有第二份:本测试与门体都不得自行定义镜像模式正则/射程清单(import __test__)。
 *  T4  取材面形状锁:内容必须走 face-reader 入口(catBatch / readWorktreeFile);禁 execSync /
 *      禁自己 readFileSync / 禁自派生 git show 读射程内容 / process.cwd() 只许经 assertRepoRoot。
 *  T5  makeAssert 行为锁:传函数当 cond 必须记红 —— 用门自己的 makeAssert 证明。
 *  T6  真仓 HEAD 端到端:--json 可 parse、退出码 ∈ {0,1,2};**不断言必为 0**(真仓此刻若有
 *      回潮就是该喊的红,断成 0 等于替仓库欠账发合格证)。
 *  T7  阳性装车:复活前的旧 AGENTS.md blob(固定 40 位 sha,不用会腐烂的短 sha)喂
 *      __test__.scanText 必须命中 M4 —— 门必须能抓住"union 带回来"的那个形态。
 *  T8  射程形状:10 个文档、含 4 版 README + AGENTS.md、不含 PROJECT_PLAN.md、全是 .md。
 *  T9  同源常量:__test__.SELF_SKIP === 'HUSKY_SKIP_MIRROR_PURGE_INTACT'。
 *  T10 导出齐全:__test__ 必须给出 T1/T7/T8/T9 用到的全部判据名(少一个即形状漂移)。
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

import { gitRaw } from '../lib/face-reader.mjs'
import { HEADER_CLAIM_PATTERNS } from '../check-gate-wiring.mjs'
import { __test__ as gate } from '../check-mirror-purge-intact.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..')
const SCRIPT = 'check-mirror-purge-intact.mjs'
const GATE_SRC = readFileSync(resolve(ROOT, 'scripts', SCRIPT), 'utf8')
const TEST_SRC = readFileSync(resolve(HERE, 'check-mirror-purge-intact.test.mjs'), 'utf8')

/** 复活前现场:68e4b42399(union 回归修复前的 origin tip)的 AGENTS.md,120 行是旧镜像断言。 */
const RESURRECTED_BLOB_SHA = '68e4b42399'

function runnerHeadText() {
  return gitRaw(['show', 'HEAD:scripts/guardian-runner.mjs'], ROOT, { timeout: 60000 })
}

/** 按"script 行锚定 → 上溯块首 `  {` → 下找 `  },`"整块提取;找不到返回 null(与守门 148/100 同法)。 */
function extractEntry(runnerText, scriptName) {
  const lines = runnerText.split('\n')
  const anchor = lines.findIndex((l) => l.trim() === `script: '${scriptName}',`)
  if (anchor < 0) return null
  let start = -1
  for (let i = anchor; i >= 0; i--) {
    if (lines[i] === '  {') {
      start = i
      break
    }
  }
  if (start < 0) return { malformed: true }
  let end = -1
  for (let i = anchor; i < lines.length; i++) {
    if (lines[i] === '  },') {
      end = i
      break
    }
  }
  if (end < 0) return { malformed: true }
  return { block: lines.slice(start, end + 1).join('\n') }
}

const WIRING_GUIDE = /接线(?:现状|状态)\s*(?:\([^)]*\))?\s*[:：]/
const WIRING_HISTORY = /已漂移|原\s*20\d{2}[-/]\d{2}|不再是/

test('T1 方向锁:未注册时头注必须自称"尚未接线",已注册时注册项必须成套', () => {
  const e = extractEntry(runnerHeadText(), SCRIPT)
  // 现状陈述与历史引文必须分开:先把带时点/漂移标记的行剔掉,再看本门此刻在说什么。
  const spoken = GATE_SRC.split('\n').filter((l) => !WIRING_HISTORY.test(l))
  const statusLines = spoken.filter((l) => WIRING_GUIDE.test(l))
  const claimsWired = statusLines.some((l) => /已接入|已注册|已挂进/.test(l))
  const claimsNotWired = statusLines.some((l) => /未接|尚未|未进/.test(l))
  if (e === null) {
    assert.ok(!claimsWired, `未注册,头注的『接线状态:』那一行却声称已接入 ⇒ 谎报现状`)
    assert.ok(claimsNotWired || statusLines.length === 0, `未注册,头注必须明说未接线(而不是留白让人猜)`)
    const spokenText = spoken.join('\n')
    for (const { re, tag } of HEADER_CLAIM_PATTERNS)
      assert.ok(!re.test(spokenText), `头注出现肯定式声称「${tag}」而本门未注册 ⇒ 守门 89 R1 会对每次提交恒红`)
    assert.doesNotMatch(spokenText, /集成位置/, '不得写"集成位置"(该措辞正是 R1 的肯定式模板)')
  } else {
    assert.ok(!e.malformed, `注册块形状漂:${JSON.stringify(e)}`)
    assert.match(e.block, /mode: 'blocking'/, '定级必须是 blocking(内容门,提交链硬拦)')
    assert.match(e.block, /skipEnv: 'HUSKY_SKIP_MIRROR_PURGE_INTACT'/, 'skipEnv 必须成套')
    assert.match(e.block, /id: ['"]\d+['"],/, '必须带数字 id')
    assert.ok(claimsWired, `注册表里本门已注册,但头注的『接线状态:』那一行仍说未接线 ⇒ 文档与提交链分叉`)
  }
})

test('T2 提取器有牙:合成 runner 无本门必须返回 null', () => {
  const synthetic = ['const checks = [', '  {', "    id: '999',", "    script: 'check-someone-else.mjs',", '  },', ']'].join('\n')
  assert.equal(extractEntry(synthetic, SCRIPT), null)
})

test('T3 判据不得有第二份:测试与门体都不得自行定义镜像模式/射程', () => {
  // 测试侧:不得出现正则定义(import __test__ 是唯一入口)
  assert.doesNotMatch(TEST_SRC, /re:\s*\//, '测试不得自定义正则判据(应 import 门体 __test__)')
  assert.doesNotMatch(TEST_SRC, /const\s+SCOPE_FILES\s*=/, '测试不得自定义射程清单(只许 import __test__;等号形态 = 真定义)')
  // 门体侧:四条判据的正则/射程只能各有一处定义
  assert.equal(GATE_SRC.match(/gitcode\\\.com\\\/IHUI-AI/g)?.length ?? 0, 1, 'M1 正则只许一处定义')
  assert.equal(GATE_SRC.match(/JLSLSSZWHYXGS_0\\\/IHUI-AI/g)?.length ?? 0, 1, 'M2 正则只许一处定义')
  assert.equal(GATE_SRC.match(/export const SCOPE_FILES/g)?.length ?? 0, 1, 'SCOPE_FILES 只许一处定义')
})

test('T4 取材面形状锁:内容走 face-reader 入口,禁自派生读取', () => {
  assert.match(GATE_SRC, /catBatch/, '射程内容必须经 catBatch(HEAD/staged 面)')
  assert.match(GATE_SRC, /readWorktreeFile/, 'worktree 面必须经 readWorktreeFile')
  assert.doesNotMatch(GATE_SRC, /execSync\(/, '禁 execSync')
  assert.doesNotMatch(GATE_SRC, /readFileSync\(/, '禁自己 readFileSync 读射程内容(self-test 建夹具只许 writeFileSync)')
  const cwdUses = GATE_SRC.match(/process\.cwd\(\)/g)?.length ?? 0
  assert.ok(cwdUses <= 1, `process.cwd() 只许出现在 assertRepoRoot 一处,实得 ${cwdUses} 处`)
  assert.match(GATE_SRC, /assertRepoRoot\(process\.cwd\(\)/, '定根必须经 assertRepoRoot 校验')
})

test('T5 makeAssert 行为锁:函数 cond 必须记红', () => {
  const probe = gate.makeAssert(() => {})
  probe.ok('函数 cond 必须记红', () => {})
  assert.equal(probe.state.pass, 0)
  assert.equal(probe.state.fails.length, 1)
})

test('T6 真仓 HEAD 端到端:--json 可 parse、退出码 ∈ {0,1,2}(不断言必为 0)', () => {
  const r = spawnSync(process.execPath, [resolve(ROOT, 'scripts', SCRIPT), '--json'], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 120000,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const parsed = JSON.parse(r.stdout)
  assert.ok([0, 1, 2].includes(r.status), `退出码必须落在 {{0,1,2}},实得 ${r.status};stderr=${r.stderr}`)
  assert.ok(['clean', 'violation', 'undetermined'].includes(parsed.state), `state 必须是三态之一,实得 ${parsed.state}`)
  assert.equal(parsed.scope, 10)
  assert.ok(Array.isArray(parsed.violations) && Array.isArray(parsed.absent))
})

test('T7 阳性装车:复活前的旧 AGENTS.md blob 喂 scanText 必须命中 M4', () => {
  const full = gitRaw(['rev-parse', RESURRECTED_BLOB_SHA], ROOT, { timeout: 60000 }).trim()
  assert.match(full, /^[0-9a-f]{40}$/, `固定锚点必须能解析成 40 位 sha,实得 ${full}`)
  const text = gitRaw(['show', `${full}:AGENTS.md`], ROOT, { timeout: 60000 })
  const hits = gate.scanText(text)
  assert.ok(hits.some((v) => v.code === 'M4'), `旧 blob 必须被 M4 抓住(union 回潮形态),实得 ${JSON.stringify(hits)}`)
  const m4 = hits.find((v) => v.code === 'M4')
  assert.match(m4.excerpt, /git 网络与推送/, 'M4 命中必须点名到 §5b 推送子弹那一行')
  // 同一份旧文本里,我方 purged 行(418 行重复条目)因带弃用标记而豁免 ⇒ 只命中一次
  assert.equal(hits.filter((v) => v.code === 'M4').length, 1, `旧 blob 应恰好一条 M4(120 行旧版),实得 ${hits.length} 条`)
})

test('T8 射程形状:10 个文档、含 4 版 README + AGENTS.md、不含 PROJECT_PLAN.md', () => {
  assert.equal(gate.SCOPE_FILES.length, 10)
  for (const f of ['README.md', 'README.en.md', 'README.ja.md', 'README.ko.md', 'AGENTS.md'])
    assert.ok(gate.SCOPE_FILES.includes(f), `射程缺 ${f}`)
  assert.ok(!gate.SCOPE_FILES.includes('PROJECT_PLAN.md'), 'PROJECT_PLAN.md 是历史台账,不在射程')
  assert.ok(gate.SCOPE_FILES.every((f) => f.endsWith('.md')), '射程全是文档')
})

test('T9 同源常量:__test__.SELF_SKIP 与注册块 skipEnv 同值', () => {
  assert.equal(gate.SELF_SKIP, 'HUSKY_SKIP_MIRROR_PURGE_INTACT')
  const e = extractEntry(runnerHeadText(), SCRIPT)
  if (e && !e.malformed) assert.match(e.block, new RegExp(`skipEnv: '${gate.SELF_SKIP}'`), '注册块 skipEnv 必须与门体常量同值')
})

test('T10 导出齐全:__test__ 必须给出方向锁/阳性对照/射程用到的全部判据名', () => {
  for (const name of ['SCOPE_FILES', 'SELF_SKIP', 'scanText', 'runCheck', 'faceFromArgv', 'faceSpec', 'makeAssert', 'LINE_CRITERIA', 'BADGE_LABEL_RE', 'MIRROR_HOST_RE', 'MIRROR_WORKFLOW_RE', 'DEPRECATION_RE'])
    assert.ok(name in gate, `__test__ 缺导出 ${name}`)
  // 面选择行为锚:双旗互斥(端到端行为已由 self-test ⑤ 证明,这里只钉入口不丢)
  const both = gate.faceFromArgv(['--staged', '--worktree'])
  assert.equal(both.face, null)
  assert.ok(Boolean(both.error))
  assert.equal(gate.faceFromArgv([]).face, 'head')
})

