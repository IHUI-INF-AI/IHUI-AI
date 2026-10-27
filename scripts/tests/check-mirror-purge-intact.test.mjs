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
 *  —— 以下六例为 2026-10-27 写回出口(--fix)追加 ——
 *  T11 旗标互斥:--fix 与 --json / --worktree 同给 = 用法错 exit 2(纯函数 + 真进程双证)。
 *  T12 阳性装车:夹具造回潮 ⇒ fixDocuments 摘掉禁止行 ⇒ worktree 面判据转绿,而 HEAD 面不触动。
 *  T13 在飞副本闸:磁盘副本 ≠ 面副本且含禁止行 ⇒ 那一份拒绝改写、字节不动、点名;其余各份照改。
 *  T14 幂等自证:同一轮回潮 fix 两遍 ⇒ 第二遍 0 改动且磁盘逐字节同形。
 *  T15 量级闸:单文档命中行数 > MAX_FIX_REMOVED_LINES ⇒ refuse 且磁盘一字节未动。
 *  T16 真仓反向对照(只读):HEAD 面现读干净 ⇒ 干跑必须 0 改写、磁盘不动。
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

import { gitRaw, readWorktreeFile } from '../lib/face-reader.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
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
  const r = spawnSync(process.execPath, [resolve(ROOT, 'scripts', SCRIPT), '--json'], { cwd: ROOT, encoding: 'utf8', timeout: 120000 })
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

test('T10 导出齐全:__test__ 必须给出方向锁/阳性对照/射程/写回出口用到的全部判据名', () => {
  for (const name of ['SCOPE_FILES', 'SELF_SKIP', 'scanText', 'runCheck', 'faceFromArgv', 'faceSpec', 'makeAssert', 'LINE_CRITERIA', 'BADGE_LABEL_RE', 'MIRROR_HOST_RE', 'MIRROR_WORKFLOW_RE', 'DEPRECATION_RE', 'MAX_FIX_REMOVED_LINES', 'stripViolatingLines', 'decideFix', 'fixArgConflict', 'fixDocuments'])
    assert.ok(name in gate, `__test__ 缺导出 ${name}`)
  // 面选择行为锚:双旗互斥(端到端行为已由 self-test ⑤ 证明,这里只钉入口不丢)
  const both = gate.faceFromArgv(['--staged', '--worktree'])
  assert.equal(both.face, null)
  assert.ok(Boolean(both.error))
  assert.equal(gate.faceFromArgv([]).face, 'head')
})

/* ───────── T11–T16 写回出口(--fix)───────── */

/** 回潮夹具:一份含 M4 旧断言的 AGENTS.md + 一份含徽章(M2 抢先 + M1)的 README.md。 */
const RESURGE_AGENTS =
  '- **git 网络与推送**:Gitee/GitCode 由 `mirror-to-cn.yml` CI 镜像,本地手推 = 违反架构。\n' +
  '- 这条没有禁止内容,写回出口必须原样留着。\n'
const RESURGE_README =
  '[![Gitee](https://img.shields.io/badge/国内镜像-Gitee-red)](https://gitee.com/JLSLSSZWHYXGS_0/IHUI-AI)\n' +
  '[![GitCode](https://img.shields.io/badge/国内镜像-GitCode-blue)](https://gitcode.com/IHUI-AI/IHUI-AI)\n' +
  '- 正常段落,不许被裁。\n'

function mkFixRepo(tag) {
  const dir = mkScratch(tag)
  gitRaw(['init', '-q', '-b', 'main'], dir)
  gitRaw(['config', 'user.email', 't@t'], dir)
  gitRaw(['config', 'user.name', 't'], dir)
  writeFileSync(join(dir, 'AGENTS.md'), RESURGE_AGENTS, 'utf8')
  writeFileSync(join(dir, 'README.md'), RESURGE_README, 'utf8')
  gitRaw(['add', '-A'], dir)
  gitRaw(['commit', '-qm', 'fixture: 回潮'], dir)
  return dir
}

test('T11 旗标互斥:--fix 与 --json / --worktree 同给 = 用法错(纯函数 + 真进程双证)', () => {
  assert.match(String(gate.fixArgConflict(['--fix', '--json'])), /不判定/)
  assert.match(String(gate.fixArgConflict(['--fix', '--worktree'])), /失明/)
  assert.equal(gate.fixArgConflict(['--fix']), null)
  assert.equal(gate.fixArgConflict(['--fix', '--staged']), null)
  assert.equal(gate.fixArgConflict(['--json']), null)
  for (const flags of [['--fix', '--json'], ['--fix', '--worktree']]) {
    const r = spawnSync(process.execPath, [resolve(ROOT, 'scripts', SCRIPT), ...flags], { cwd: ROOT, encoding: 'utf8', timeout: 60000 })
    assert.equal(r.status, 2, `${flags.join(' ')} 应落用法错 exit 2,实得 ${r.status};stderr=${r.stderr}`)
    assert.match(r.stderr, /用法错/)
  }
})

test('T12 阳性装车:夹具回潮 ⇒ --fix 摘掉禁止行 ⇒ worktree 面转绿,而 HEAD 面不触动', () => {
  const dir = mkFixRepo('ihui-mpfix-t12-')
  try {
    const res = gate.fixDocuments({ root: dir, face: 'head', log: () => {} })
    assert.equal(res.fixed, 2, `两份回潮文档都该被改写,rows=${JSON.stringify(res.rows)}`)
    assert.equal(gate.runCheck(dir, 'worktree').violations.length, 0, '写回后 worktree 面必须零命中(器物修得了自己判的事)')
    assert.equal(gate.runCheck(dir, 'head').state, 'violation', '写档不判档、也不替面写绿:HEAD 面照旧')
    assert.match(readWorktreeFile(dir, 'AGENTS.md'), /这条没有禁止内容/, '非命中行必须逐字节留着')
    assert.match(readWorktreeFile(dir, 'README.md'), /正常段落/, '非命中行必须逐字节留着')
  } finally {
    rmScratch(dir)
  }
})

test('T13 在飞副本闸:磁盘 ≠ 面且含禁止行 ⇒ 那一份拒改、字节不动、点名;其余各份照改', () => {
  const dir = mkFixRepo('ihui-mpfix-t13-')
  try {
    // 别人正拿着 AGENTS.md 的在飞改动(追加一行),而禁止行还在
    writeFileSync(join(dir, 'AGENTS.md'), RESURGE_AGENTS + '- 别人的未提交新段落。\n', 'utf8')
    const inflight = readWorktreeFile(dir, 'AGENTS.md')
    const res = gate.fixDocuments({ root: dir, face: 'head', log: () => {} })
    const row = res.rows.find((r) => r.rel === 'AGENTS.md')
    assert.equal(row.action, 'refuse', `在飞副本必须拒绝改写,实得 ${JSON.stringify(row)}`)
    assert.match(row.why, /在飞/)
    assert.equal(readWorktreeFile(dir, 'AGENTS.md'), inflight, '拒改那份必须一字节未动(不覆盖别人的未提交改动)')
    assert.equal(res.fixed, 1, 'README.md 面盘同形,必须照改(跳过逐份点名,不连坐)')
    assert.equal(gate.runCheck(dir, 'worktree').violations.filter((v) => v.rel === 'README.md').length, 0)
  } finally {
    rmScratch(dir)
  }
})

test('T14 幂等自证:同一轮回潮 fix 两遍 ⇒ 第二遍 0 改动且磁盘逐字节同形', () => {
  const dir = mkFixRepo('ihui-mpfix-t14-')
  try {
    gate.fixDocuments({ root: dir, face: 'head', log: () => {} })
    const after1 = { agents: readWorktreeFile(dir, 'AGENTS.md'), readme: readWorktreeFile(dir, 'README.md') }
    const res2 = gate.fixDocuments({ root: dir, face: 'head', log: () => {} })
    assert.equal(res2.fixed, 0, `第二遍必须 0 改写,rows=${JSON.stringify(res2.rows.filter((r) => r.action === 'fix'))}`)
    assert.equal(res2.refused, 0, '第一轮写回留下的"磁盘≠HEAD"形态不得被在飞闸误伤(磁盘已净 ⇒ clean 判序在前)')
    assert.equal(readWorktreeFile(dir, 'AGENTS.md'), after1.agents)
    assert.equal(readWorktreeFile(dir, 'README.md'), after1.readme)
  } finally {
    rmScratch(dir)
  }
})

test('T15 量级闸:单文档摘除行数 > 上限 ⇒ refuse 且磁盘一字节未动', () => {
  const dir = mkScratch('ihui-mpfix-t15-')
  try {
    gitRaw(['init', '-q', '-b', 'main'], dir)
    gitRaw(['config', 'user.email', 't@t'], dir)
    gitRaw(['config', 'user.name', 't'], dir)
    const over = Array.from({ length: gate.MAX_FIX_REMOVED_LINES + 1 }, (_, i) => `- 镜像仓库:https://gitcode.com/IHUI-AI/IHUI-AI#${i}`).join('\n') + '\n'
    mkdirSync(join(dir, 'docs'), { recursive: true })
    writeFileSync(join(dir, 'docs', 'RELEASE.md'), over, 'utf8')
    gitRaw(['add', '-A'], dir)
    gitRaw(['commit', '-qm', 'fixture: 超限'], dir)
    const res = gate.fixDocuments({ root: dir, face: 'head', log: () => {} })
    const row = res.rows.find((r) => r.rel === 'docs/RELEASE.md')
    assert.equal(row.action, 'refuse', `超限必须拒改,实得 ${JSON.stringify(row)}`)
    assert.match(row.why, /上限/)
    assert.equal(readWorktreeFile(dir, 'docs/RELEASE.md'), over, '超限轮磁盘必须一字节未动')
    assert.equal(res.fixed, 0)
  } finally {
    rmScratch(dir)
  }
})

test('T16 真仓反向对照(干跑,零写盘):HEAD 面现读干净 ⇒ --fix 0 改写、磁盘不动', () => {
  const pre = gate.runCheck(ROOT, 'head')
  const before = new Map(gate.SCOPE_FILES.map((rel) => [rel, readWorktreeFile(ROOT, rel)]))
  const res = gate.fixDocuments({ root: ROOT, face: 'head', dryRun: true, log: () => {} })
  assert.equal(res.rows.length, gate.SCOPE_FILES.length)
  if (pre.state === 'clean') {
    // 反向对照:健康仓上这台器物不得裁任何人在写的正常内容
    assert.equal(res.fixed, 0, `HEAD 面干净时干跑必须 0 改写,实得 ${JSON.stringify(res.rows.filter((r) => r.action === 'fix'))}`)
  }
  for (const [rel, text] of before) assert.equal(readWorktreeFile(ROOT, rel), text, `干跑绝不动磁盘上的 ${rel}`)
})

