// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// §22c 镜像常量守门模式:测试直接 import 源脚本的 __test__,不复制任何实现,
// 杜绝"源/测两份真相"漂移。§22d:源脚本 main() 受 isDirectRun 守护,被 import 时零副作用。
import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { existsSync, mkdirSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs'

import { __test__ as src } from '../check-uncommitted-age.mjs'
// §15c/§15b:索引面要用**真 git 夹具**(staged 条目只能真造),夹具一律落项目外 scratch 根,
// 派生 git 一律走 lib/face-reader 的 gitRaw(它把 §12g 的 stdio 两态写死在层里)。
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { gitRaw } from '../lib/face-reader.mjs'

const SRC_FILE = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'check-uncommitted-age.mjs')
const SRC_TEXT = readFileSync(SRC_FILE, 'utf8')

const NOW = 1_700_000_000_000
/** 造一个"年龄 = ageMin 分钟"的条目 */
const stat = (path, ageMin) => ({ path, mtimeMs: NOW - ageMin * 60_000 })
/** 把文件清单包成 porcelain 条目(modified) */
const asModified = (files) => files.map((f) => ({ path: f, status: ' M', untracked: false }))
/** 端到端:收集层过滤 → 年龄判定(过滤职责在收集层,不在年龄层) */
const evaluate = (files, thresholdMin = 45) =>
  src.classifyByAge(
    src
      .collectCandidatePaths(asModified(files), () => [])
      .map((f) => stat(f, thresholdMin * 2)),
    thresholdMin,
    NOW,
  )

test('__test__ 导出形状齐全(§22c 锚点,重命名即失败)', () => {
  for (const key of [
    'parsePorcelainZ',
    'normalizePath',
    'isSourceFile',
    'isExemptPath',
    'isCandidatePath',
    'collectCandidatePaths',
    'resolveThresholdMin',
    'classifyByAge',
    'formatAge',
    'runSelfTest',
    'SOURCE_EXTS',
    'EXCLUDED_DIRS',
    'DEFAULT_THRESHOLD_MIN',
    // 索引面(2026-10-15 扩面)的出口一个都不能少:少一个 ⇒ 镜像测试只能自己抄判据(§22c)
    'STAGED_INDEX_LETTERS',
    'INDEX_PENDING_LEDGER_REL',
    'INDEX_PENDING_LEDGER_VERSION',
    'STAGE_ORACLE_FIELDS',
    'isStagedIndexEntry',
    'collectStagedCandidatePaths',
    'indexInflightAttestations',
    'resolveStageStartMs',
    'describeAgeSource',
    'firstSeenKeyOf',
    'indexPendingLedgerPath',
    'parseIndexPendingLedger',
    'readIndexPendingLedger',
    'serializeIndexPendingLedger',
    'writeIndexPendingLedger',
    'pruneIndexPendingLedger',
    'evaluateIndexFace',
    'runIndexFace',
    'indexExitLines',
    'indexEvidenceLine',
  ]) {
    assert.ok(key in src, `__test__ 缺少导出键 ${key}`)
  }
  assert.equal(typeof src.parsePorcelainZ, 'function')
  assert.equal(typeof src.runIndexFace, 'function')
  assert.equal(typeof src.classifyByAge, 'function', '索引面必须复用这一把年龄尺子,不得自立一份')
})

test('导入源模块未触发 main() 副作用(§22d isDirectRun)', () => {
  // 若 main() 被误执行,进程会在 import 阶段 process.exit,本文件断言根本跑不到。
  // 再显式核对:被 import 时 process.argv[1] 是本测试文件而非源脚本。
  assert.notEqual(
    import.meta.url,
    pathToFileURL(resolve('scripts/check-uncommitted-age.mjs')).href,
  )
})

// ─── 四类基础判据 ───────────────────────────────────────────
test('① 无改动 = pass', () => {
  assert.deepEqual(src.parsePorcelainZ(''), [])
  assert.deepEqual(src.parsePorcelainZ('\n'), [])
  const r = src.classifyByAge([], 45, NOW)
  assert.equal(r.scanned, 0)
  assert.equal(r.risky.length, 0)
})

test('② 新改动(阈值内)= pass', () => {
  const r = src.classifyByAge([stat('apps/web/src/a.ts', 10)], 45, NOW)
  assert.equal(r.scanned, 1)
  assert.equal(r.risky.length, 0)
})

test('③ 老改动(超阈值)= fail', () => {
  const r = src.classifyByAge([stat('apps/api/src/routes/x.ts', 120)], 45, NOW)
  assert.equal(r.risky.length, 1)
  assert.equal(r.risky[0].file, 'apps/api/src/routes/x.ts')
  assert.equal(r.risky[0].ageMs, 120 * 60_000)
})

test('④ 豁免目录 = fail 不成立(超龄豁免文件一律不报)', () => {
  const exempt = [
    '.ihui-agent/tmp/probe/old.ts',
    'node_modules/pkg/index.ts',
    'apps/web/dist/old.js',
    'apps/web/.next/static/chunk.ts',
    'packages/i18n/generated/remote-locales.gen.ts',
    'apps/api/.env.local',
    'docs/notes.md',
  ]
  assert.deepEqual(exempt.filter(src.isCandidatePath), [])
  assert.equal(evaluate(exempt).risky.length, 0)
})

test('阈值边界:严格大于才报(恰好等于不报)', () => {
  assert.equal(src.classifyByAge([stat('a.ts', 45)], 45, NOW).risky.length, 0)
  assert.equal(src.classifyByAge([stat('a.ts', 46)], 45, NOW).risky.length, 1)
})

// ─── porcelain -z 解析 ─────────────────────────────────────
test('parsePorcelainZ:modified / untracked / rename 三类条目', () => {
  const parsed = src.parsePorcelainZ(' M apps/web/src/a.ts\0?? scripts/new.mjs\0R  apps/new.ts\0apps/old.ts\0')
  assert.deepEqual(
    parsed.map((p) => p.path),
    ['apps/web/src/a.ts', 'scripts/new.mjs', 'apps/new.ts'],
  )
  assert.equal(parsed[0].untracked, false)
  assert.equal(parsed[1].untracked, true)
})

test('parsePorcelainZ:rename 的 origin path 被跳过(不重复计入)', () => {
  const parsed = src.parsePorcelainZ('R  apps/new.ts\0apps/old.ts\0')
  assert.equal(parsed.length, 1)
  assert.ok(!parsed.some((p) => p.path === 'apps/old.ts'))
})

test('parsePorcelainZ:Windows 反斜杠归一为 /', () => {
  assert.equal(src.parsePorcelainZ(' M apps\\web\\b.ts\0')[0].path, 'apps/web/b.ts')
  assert.equal(src.normalizePath('a\\b\\c.ts'), 'a/b/c.ts')
})

test('parsePorcelainZ:未跟踪目录以 / 结尾,原样保留待展开', () => {
  const parsed = src.parsePorcelainZ('?? scripts/probe/\0')
  assert.equal(parsed[0].path, 'scripts/probe/')
  assert.equal(src.isCandidatePath('scripts/probe/'), false)
})

// ─── 源码判据 / 豁免口径 ────────────────────────────────────
test('isSourceFile:九类扩展名全认,其余不认', () => {
  for (const ext of ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.py', '.css', '.sql']) {
    assert.equal(src.isSourceFile(`p/f${ext}`), true, ext)
  }
  for (const p of ['README.md', 'x.json', 'Dockerfile', 'a.ts.map', 'img.png', 'no_ext']) {
    assert.equal(src.isSourceFile(p), false, p)
  }
})

test('isExemptPath:目录段命中排除清单 + 点文件 + 生成物', () => {
  assert.equal(src.isExemptPath('.ihui-agent/tmp/a.ts'), true)
  assert.equal(src.isExemptPath('a/generated/b.ts'), true)
  assert.equal(src.isExemptPath('apps/api/.env'), true)
  assert.equal(src.isExemptPath('.env.production'), true)
  assert.equal(src.isExemptPath('src/x.gen.ts'), true)
  assert.equal(src.isExemptPath('src/x.ts'), false)
  assert.equal(src.EXCLUDED_DIRS.has('node_modules'), true)
  assert.equal(src.EXCLUDED_DIRS.has('dist'), true)
})

test('isExemptPath:文件名含 env/gen 子串不得误豁免(防过度豁免)', () => {
  assert.equal(src.isExemptPath('src/environment_context.py'), false)
  assert.equal(src.isExemptPath('src/agent-model.ts'), false)
})

test('collectCandidatePaths:未跟踪目录交给注入的 listFiles 展开且二次过滤', () => {
  const entries = [
    { path: 'scripts/probe/', status: '??', untracked: true },
    { path: 'a.ts', status: ' M', untracked: false },
  ]
  // 故意返回未过滤清单(含 md / 豁免目录)→ 收集层必须自己挡掉
  const raw = ['scripts/probe/old.ts', 'scripts/probe/readme.md', 'node_modules/x/y.ts']
  assert.deepEqual(src.collectCandidatePaths(entries, () => raw), ['a.ts', 'scripts/probe/old.ts'])
})

test('collectCandidatePaths:豁免目录不触发展开 + 去重', () => {
  let called = 0
  const list = () => {
    called++
    return []
  }
  src.collectCandidatePaths([{ path: 'node_modules/x/', status: '??' }], list)
  assert.equal(called, 0)
  const dup = src.collectCandidatePaths(
    [
      { path: 'a.ts', status: ' M' },
      { path: 'a.ts', status: ' M' },
    ],
    () => [],
  )
  assert.deepEqual(dup, ['a.ts'])
})

// ─── 阈值解析 ─────────────────────────────────────────────
test('resolveThresholdMin:CLI(两种写法)> env > 默认 45', () => {
  assert.equal(src.resolveThresholdMin([], {}), src.DEFAULT_THRESHOLD_MIN)
  assert.equal(src.resolveThresholdMin([], { IHUI_UNCOMMITTED_AGE_MIN: '10' }), 10)
  assert.equal(src.resolveThresholdMin(['--threshold-min=5'], { IHUI_UNCOMMITTED_AGE_MIN: '10' }), 5)
  assert.equal(src.resolveThresholdMin(['--threshold-min', '7'], {}), 7)
  assert.equal(src.resolveThresholdMin(['--threshold-min=abc'], { IHUI_UNCOMMITTED_AGE_MIN: '-1' }), 45)
})

// ─── 报告可读性 / 排序 ────────────────────────────────────
test('classifyByAge:最老的排前面(报告按风险排序)', () => {
  const r = src.classifyByAge([stat('new.ts', 50), stat('oldest.ts', 500), stat('mid.ts', 100)], 45, NOW)
  assert.deepEqual(
    r.risky.map((x) => x.file),
    ['oldest.ts', 'mid.ts', 'new.ts'],
  )
})

test('formatAge:分钟 / 小时 / 天三档', () => {
  assert.match(src.formatAge(20 * 60_000), /分钟$/)
  assert.match(src.formatAge(5 * 3_600_000), /小时$/)
  assert.match(src.formatAge(3 * 86_400_000), /天$/)
})

test('报告只含文件名与年龄,不含任何文件内容', () => {
  const r = src.classifyByAge([stat('apps/api/.env', 600)], 45, NOW)
  const serialized = JSON.stringify(r)
  assert.ok(!/SECRET|PASSWORD|BEGIN PRIVATE/i.test(serialized))
  assert.ok(r.risky.every((x) => Object.keys(x).sort().join(',') === 'ageMs,file'))
})

test('源脚本内置 --self-test 用例全绿(与 CLI 同一套判据)', () => {
  const failed = src.runSelfTest().filter((r) => !r.pass)
  assert.deepEqual(failed, [])
})

// ════════════════════════════════════════════════════════════════
// 索引面(已暂存未提交)扩面 2026-10-15
// 立因:原排除条款「已 staged 的内容已由 index 保住,不在本判据内」被 2026-10-14 实测否证
//   —— 索引里长期挂着 4 条"已暂存未提交",没有任何门发现过它。
// 夹具纪律:真 staged 条目只能在真 git 仓里造 ⇒ 仓必须落在 scratch 根(§15c 禁仓库树内 git init)。
// ════════════════════════════════════════════════════════════════
const NOW_IDX = Date.now()
const scratchMade = []
const box = (tag) => {
  const d = mkScratch(`cuea-idx-${tag}-`)
  scratchMade.push(d)
  mkdirSync(join(d, 'src'), { recursive: true })
  mkdirSync(join(d, '.workbuddy'), { recursive: true })
  return d
}
after(() => {
  // 清理走 lib/scratch-dir.mjs 的 rmScratch(§15b 唯一删除出口:嵌套守卫 + 宿主批量闸 bestEffort);
  // 断言失败时 mkScratch 的进程退出回收是兜底,但不能拿它当正解。
  for (const d of scratchMade) rmScratch(d, { bestEffort: true })
})

const GIT_G = ['-c', 'safe.directory=*', '-c', 'core.autocrlf=false', '-c', 'user.email=t@t', '-c', 'user.name=t']
function freshRepo(tag) {
  const root = box(tag)
  gitRaw([...GIT_G, 'init', '-q'], root)
  writeFileSync(join(root, 'src/a.ts'), 'export const a = 1\n')
  gitRaw(['add', 'src/a.ts'], root)
  gitRaw(['commit', '-q', '-m', 'base'], root)
  return root
}
/** 造一条 staged 条目并把它的工作区 mtime 钉到 ageMin 分钟前 */
function stageFile(root, rel, text, ageMin) {
  writeFileSync(join(root, rel), text)
  gitRaw(['add', '--', rel], root)
  if (ageMin !== undefined) {
    const t = new Date(Date.now() - ageMin * 60_000)
    utimesSync(join(root, rel), t, t)
  }
}
/** 用真 git 的 porcelain 取条目(不在测试里复制判据,清单只来自 parsePorcelainZ) */
function porcelainEntries(root) {
  return src.parsePorcelainZ(gitRaw(['status', '--porcelain', '-z'], root))
}
function writeAttest(root, lines) {
  writeFileSync(join(root, '.workbuddy', 'safe-commit-attestation.jsonl'), lines.map((l) => JSON.stringify(l) + '\n').join(''))
}
function readLedger(root) {
  return JSON.parse(readFileSync(src.indexPendingLedgerPath(root), 'utf8'))
}

test('①【正向】staged 且超龄 ⇒ 必须报出并点名路径(索引面这一维真的在判)', () => {
  const root = freshRepo('overage')
  stageFile(root, 'src/a.ts', 'export const a = 2\n', 180)
  const r = src.runIndexFace({ root, entries: porcelainEntries(root), thresholdMin: 45, now: Date.now() })
  assert.equal(r.risky.length, 1, JSON.stringify(r))
  assert.equal(r.risky[0].file, 'src/a.ts')
  assert.ok(r.risky[0].ageMs >= 175 * 60_000, `年龄应 ≈3 小时,实得 ${r.risky[0].ageMs}`)
  assert.match(r.risky[0].ageSource, /mtime/)
})

test('②【反向对照】staged 但新鲜 ⇒ 一条也不报(判据不是恒红)', () => {
  const root = freshRepo('fresh')
  stageFile(root, 'src/a.ts', 'export const a = 2\n', 1)
  const r = src.runIndexFace({ root, entries: porcelainEntries(root), thresholdMin: 45, now: Date.now() })
  assert.equal(r.risky.length, 0, JSON.stringify(r.risky))
  assert.equal(r.scanned, 1, '新鲜条目必须如实计数,不得读成"没有索引改动"')
})

test('③【回归】未暂存的工作树改动:索引面不收它,而工作树面照旧收(原维度没被改坏)', () => {
  const root = freshRepo('regress')
  writeFileSync(join(root, 'src/a.ts'), 'export const a = 3\n') // 只改工作区,绝不 add
  const entries = porcelainEntries(root)
  assert.equal(entries.filter(src.isStagedIndexEntry).length, 0, '" M" 的第二列形态不得进索引面')
  const r = src.runIndexFace({ root, entries, thresholdMin: 45, now: Date.now() })
  assert.equal(r.scanned, 0)
  assert.equal(r.risky.length, 0)
  // 同一批条目喂原维度:必须仍然被 collectCandidatePaths 收成候选(扩面不得吃掉旧射程)
  const legacy = src.collectCandidatePaths(entries, () => [])
  assert.deepEqual(legacy, ['src/a.ts'], `工作树面候选被改坏:${legacy}`)
  const aged = src.classifyByAge([{ path: 'src/a.ts', mtimeMs: Date.now() - 120 * 60_000 }], 45, Date.now())
  assert.equal(aged.risky.length, 1)
})

test('④【§0.3 反控】把 first-seen 台账拿掉 ⇒ 必须读成 undetermined,绝不能读成"0 违规"', () => {
  const root = freshRepo('undetermined')
  // 造一条"三把尺子全断"的悬留:删除态(工作区文件不存在 ⇒ mtime 取不到)+ 无 attestation + 无台账
  gitRaw(['rm', '-q', '--', 'src/a.ts'], root)
  const entries = porcelainEntries(root)
  assert.ok(entries.some((e) => e.status[0] === 'D' && e.path === 'src/a.ts'), `应当有一条 D:${JSON.stringify(entries)}`)

  const r1 = src.runIndexFace({ root, entries, thresholdMin: 45, now: NOW_IDX })
  assert.equal(r1.scanned, 0, '未判定的条目不得混进 scanned 冒充"判过了"')
  assert.equal(r1.risky.length, 0, '没有时刻 ⇒ 不得凭空冒红')
  assert.equal(r1.undetermined.length, 1, '必须点名"未判定",不得读成 0 违规')
  assert.equal(r1.undetermined[0].state, 'undetermined')
  assert.match(r1.undetermined[0].reason, /stage 时刻取不到/)
  assert.equal(r1.stamped, 1, '首次观测必须由判据自己盖 first-seen 台账')
  assert.equal(r1.fresh, 0)

  // 台账建起来之后,同一条必须被"量到"(证明这把尺子真的参与判定)
  const r2 = src.runIndexFace({ root, entries, thresholdMin: 45, now: NOW_IDX + 180 * 60_000 })
  assert.equal(r2.undetermined.length, 0, '台账有了时刻就不得再报未判定')
  assert.equal(r2.risky.length, 1, JSON.stringify(r2.risky))
  assert.match(r2.risky[0].ageSource, /first-seen/, `下界应由本门台账给出:${r2.risky[0].ageSource}`)

  // ★ 反控:把台账拿掉 ⇒ 结论必须退回 undetermined,而不是"没有悬留"
  rmSync(src.indexPendingLedgerPath(root), { force: true })
  assert.equal(existsSync(src.indexPendingLedgerPath(root)), false)
  const r3 = src.runIndexFace({ root, entries, thresholdMin: 45, now: NOW_IDX + 180 * 60_000 })
  assert.equal(r3.undetermined.length, 1, '拿掉台账却报"0 违规"就是把没判写成判过了(§0.3)')
  assert.equal(r3.scanned, 0)
  assert.equal(r3.stamped, 1)

  // 纯函数面同一刀:三把尺子全空 ⇒ null(不是 0)
  assert.equal(src.resolveStageStartMs({ mtimeMs: Number.NaN, attestMs: null, firstSeenMs: null }), null)
})

test('④b【台账自建 + 有终态】首见盖时刻,条目从索引消失后台账必须回收', () => {
  const root = freshRepo('ledger')
  stageFile(root, 'src/a.ts', 'export const a = 2\n', 180)
  const first = src.runIndexFace({ root, entries: porcelainEntries(root), thresholdMin: 45, now: NOW_IDX })
  assert.equal(first.stamped, 1)
  assert.equal(first.writeBack.ok, true, first.writeBack.why)
  const disk1 = readLedger(root)
  assert.equal(Object.keys(disk1.entries).length, 1)
  const key = Object.keys(disk1.entries)[0]
  assert.match(key, /\|src\/a\.ts$/, `key 必须是 sha|路径:${key}`)

  // 同一条目再跑一轮:时刻不重盖(否则年龄永远年轻)
  const second = src.runIndexFace({ root, entries: porcelainEntries(root), thresholdMin: 45, now: NOW_IDX + 60_000 })
  assert.equal(second.stamped, 0, '已登记的条目不得重盖 first-seen')
  assert.equal(second.recycled.length, 0)

  // 提交掉 ⇒ 条目从索引消失 ⇒ 台账必须回收(不得无限增长)
  gitRaw(['commit', '-q', '-m', 'land it'], root)
  const third = src.runIndexFace({ root, entries: porcelainEntries(root), thresholdMin: 45, now: NOW_IDX + 120_000 })
  assert.equal(third.recycled.length, 1, JSON.stringify(third))
  assert.deepEqual(Object.keys(readLedger(root).entries), [])
})

test('④c【sha 变了就重计】同路径换内容 ⇒ 旧 key 回收、新 key 重新起算', () => {
  const root = freshRepo('resha')
  stageFile(root, 'src/a.ts', 'export const a = 2\n', 180)
  src.runIndexFace({ root, entries: porcelainEntries(root), thresholdMin: 45, now: NOW_IDX })
  const next = src.runIndexFace({ root, entries: porcelainEntries(root), thresholdMin: 45, now: NOW_IDX + 1000 })
  assert.equal(next.stamped, 0)
  stageFile(root, 'src/a.ts', 'export const a = 99\n', 180) // 换内容重新 add ⇒ blob sha 变色
  const changed = src.runIndexFace({ root, entries: porcelainEntries(root), thresholdMin: 45, now: NOW_IDX + 2000 })
  assert.equal(changed.recycled.length, 1, '旧 sha 的 key 必须被回收')
  assert.equal(changed.stamped, 1, '新 sha 必须当作首次观测重计')
})

test('⑤【阈值 A/B 正向对照】窗口设 0 ⇒ 索引面全翻红;窗口极大 ⇒ 全绿', () => {
  const root = freshRepo('threshold')
  stageFile(root, 'src/a.ts', 'export const a = 2\n', 180)
  writeFileSync(join(root, 'src/b.ts'), 'export const b = 1\n')
  stageFile(root, 'src/b.ts', 'export const b = 2\n', 90)
  const zero = src.runIndexFace({ root, entries: porcelainEntries(root), thresholdMin: 0, now: Date.now() })
  assert.equal(zero.risky.length, 2, `阈值 0 必须全红:${JSON.stringify(zero.risky.map((r) => r.file))}`)
  assert.deepEqual(zero.risky.map((r) => r.file), ['src/a.ts', 'src/b.ts'], '按年龄降序点名')
  const huge = src.runIndexFace({ root, entries: porcelainEntries(root), thresholdMin: 999999999, now: Date.now() })
  assert.equal(huge.risky.length, 0)
  assert.equal(huge.scanned, 2, '全绿也要如实报数,不得把"没超龄"读成"没有悬留"')
})

test('⑥【attestation oracle】"有 headBefore 而无 landedSha"的留痕参与年龄下界;已落地那一轮不参与', () => {
  const root = freshRepo('attest')
  // 删除态:工作区文件已不在 ⇒ mtime 这把尺子断了,只剩 attestation 与台账两把
  gitRaw(['rm', '-q', '--', 'src/a.ts'], root)
  writeAttest(root, [
    {
      ts: new Date(Date.now() - 180 * 60_000).toISOString(),
      kind: 'not-ours',
      declaredFiles: ['src/a.ts'],
      headBefore: 'f'.repeat(40),
    },
    // 同一批文件 30 分钟前**真的落地了**(有 landedSha)⇒ 这一轮不构成"仍在飞"的证据。
    // 若实现把它错当证据,max 会取这枚更晚的时刻 ⇒ 年龄 30 分钟 ⇒ 该红变不红 ⇒ 本用例即红。
    {
      ts: new Date(Date.now() - 30 * 60_000).toISOString(),
      kind: 'bypass-landing',
      gatesRun: false,
      declaredFiles: ['src/a.ts'],
      headBefore: 'a'.repeat(40),
      landedSha: 'b'.repeat(40),
      source: 'object-space-land',
    },
  ])
  const r = src.runIndexFace({ root, entries: porcelainEntries(root), thresholdMin: 45, now: Date.now() })
  assert.equal(r.risky.length, 1, JSON.stringify(r))
  assert.match(r.risky[0].ageSource, /attestation/, `下界应由在飞留痕给出:${r.risky[0].ageSource}`)
  assert.ok(r.risky[0].ageMs > 170 * 60_000 && r.risky[0].ageMs < 190 * 60_000, String(r.risky[0].ageMs))
  // 删除态不得冒充"≠ 任何祖先版本"(形态那一维必须说真话)
  assert.equal(r.risky[0].ancestorEqual.state, 'deleted', JSON.stringify(r.risky[0].ancestorEqual))
  assert.match(src.indexEvidenceLine(r.risky[0]), /删除态,无暂存 blob 可比形态/)
})

test('⑦【形态分流】暂存 blob == 某祖先版本 ⇒ 出口给"按 HEAD 对齐",绝不建议提交它', () => {
  const root = freshRepo('ancestor')
  stageFile(root, 'src/a.ts', 'export const a = 2\n')
  gitRaw(['commit', '-q', '-m', 'v2 是别人的合并成果'], root) // HEAD: a=2
  // 模拟"旧基线被暂存回来":把索引 + 工作区写回 HEAD~1 的内容(a=1 == 某祖先版本)
  gitRaw(['checkout', 'HEAD~1', '--', 'src/a.ts'], root)
  const t = new Date(Date.now() - 180 * 60_000)
  utimesSync(join(root, 'src/a.ts'), t, t)
  const r = src.runIndexFace({ root, entries: porcelainEntries(root), thresholdMin: 45, now: Date.now() })
  assert.equal(r.risky.length, 1, JSON.stringify(r))
  const item = r.risky[0]
  assert.equal(item.ancestorEqual.state, 'lagging-ancestor', JSON.stringify(item.ancestorEqual))
  const exits = src.indexExitLines(item).join('\n')
  assert.match(exits, /git restore --staged -- src\/a\.ts/)
  assert.ok(!/safe-commit\.mjs/.test(exits), '等于祖先版本那一型不许建议"提交它"')
  assert.match(exits, /已在历史里/)
  // 正向对照:真新内容那一型必须给提交建议
  stageFile(root, 'src/a.ts', 'export const a = 7\n', 180)
  const novel = src.runIndexFace({ root, entries: porcelainEntries(root), thresholdMin: 45, now: Date.now() })
  assert.equal(novel.risky[0].ancestorEqual.state, 'novel', JSON.stringify(novel.risky[0].ancestorEqual))
  assert.match(src.indexExitLines(novel.risky[0]).join('\n'), /safe-commit\.mjs/)
})

test('⑧【取证行】报告行含路径/时长/祖先形态/最近留痕四要素,且不含任何文件内容', () => {
  const line = src.indexEvidenceLine({
    file: 'src/a.ts',
    ageMs: 180 * 60_000,
    ageSource: '工作区 mtime',
    attestMs: NOW_IDX,
    firstSeenMs: NOW_IDX - 60_000,
    ancestorEqual: { state: 'novel' },
  })
  assert.match(line, /悬留下界 3 小时/)
  assert.match(line, /≠ 任何已读祖先版本/)
  assert.match(line, /最近一次在飞留痕 \d{4}-\d{2}-\d{2}T/)
  assert.ok(!/export const/.test(line))
})

// ─── CLI 层(§0.9"造好没装车 = 没有":判据必须住在每次提交真跑的那一层) ───
// 本门 ROOT 由**脚本自身位置**推导(§15,共享工作区 cwd 不可靠),所以要把 CLI 连同它的
// **相对 import 闭包**复制进夹具仓再执行 —— 直接跑仓内 CLI 判的是真仓(而且绝不允许:
// 夹具会往真索引里写东西)。闭包按 import 推导,不手抄清单(手抄晚一拍 ⇒ 子进程
// ERR_MODULE_NOT_FOUND,红在一件与被测行为无关的事上 —— 先例 git-guardian-drift-align.test.mjs)。
const SCRIPTS = resolve(dirname(fileURLToPath(import.meta.url)), '..')
function localImportClosure(entryRel, seen = new Set()) {
  if (seen.has(entryRel)) return seen
  seen.add(entryRel)
  let text = ''
  try {
    text = readFileSync(join(SCRIPTS, entryRel), 'utf8')
  } catch {
    return seen // 闭包之外的文件(不该发生):由调用方的存在性断言去报
  }
  for (const m of text.matchAll(/^\s*import\b[^'"]*from\s*'(\.[^']+)'/gm)) {
    // 只做 join + 归一,**不能 resolve**:resolve 会拿测试进程的 cwd 去补相对路径,
    // 于是闭包里冒出一个绝对路径,复制目标落到夹具之外(实测 ENOENT mkdir '…\scripts\D:\IHUI-AI\lib')。
    const next = join(dirname(entryRel), m[1])
      .replace(/^\.\//, '')
      .replace(/\\/g, '/')
    localImportClosure(next, seen)
  }
  return seen
}
function cliFixture(tag) {
  const root = freshRepo(tag)
  for (const rel of localImportClosure('check-uncommitted-age.mjs')) {
    const dst = join(root, 'scripts', rel)
    mkdirSync(dirname(dst), { recursive: true })
    writeFileSync(dst, readFileSync(join(SCRIPTS, rel)))
  }
  return root
}
function runCli(root, extraArgs = []) {
  const out = execFileSync(process.execPath, [join(root, 'scripts', 'check-uncommitted-age.mjs'), ...extraArgs], {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 120_000,
    maxBuffer: 32 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  return JSON.parse(out)
}

test('C1【CLI·①】staged 且超龄:main() 真跑的 --json 必须点名路径', () => {
  const root = cliFixture('cli-overage')
  stageFile(root, 'src/a.ts', 'export const a = 2\n', 180)
  const j = runCli(root, ['--json'])
  assert.equal(j.ok, false, JSON.stringify(j.indexFace))
  assert.equal(j.indexFace.risky.length, 1)
  assert.equal(j.indexFace.risky[0].file, 'src/a.ts')
  assert.ok(j.indexFace.risky[0].exits.join('\n').length > 0, '每条都必须带出口命令(§5e-1)')
  assert.equal(j.indexFace.risky[0].stagedBlob?.length, 40, '取证行必须带上暂存 blob sha')
})

test('C1b【CLI·隔离证明】staged 删除态 + 在飞留痕:工作树面看不见它,索引面必须看见', () => {
  // 这一条才是"扩面确实新增了一维"的隔离证据:同一份 --json 里 ① 恒空、② 点名。
  // 删除态 ⇒ 工作区文件不存在 ⇒ ① 的 mtime 尺子与 statables 过滤都拿不到它;
  // ② 改用 attestation 那把尺子(有 headBefore 而无 landedSha)⇒ 仍能量出悬留下界。
  const root = cliFixture('cli-isolation')
  gitRaw(['rm', '-q', '--', 'src/a.ts'], root)
  writeAttest(root, [
    {
      ts: new Date(Date.now() - 240 * 60_000).toISOString(),
      kind: 'undetermined-red',
      declaredFiles: ['src/a.ts'],
      headBefore: 'c'.repeat(40),
    },
  ])
  const j = runCli(root, ['--json'])
  // 隔离点:删除态的工作区文件不存在 ⇒ ① 的 statables 过滤(mtime 非有限即弃)收不到它,
  // 而 ② 靠 attestation 这把尺子仍然量出 4 小时下界。(① 的 scanned 里还会有复制进去的
  // 闭包文件本身 —— 那些是未跟踪新文件,mtime 新鲜,只计数不报。)
  assert.equal(j.risky.length, 0, `原维度不该报删除态:${JSON.stringify(j.risky)}`)
  assert.equal(j.indexFace.risky.length, 1, JSON.stringify(j.indexFace))
  assert.equal(j.indexFace.risky[0].file, 'src/a.ts')
  assert.equal(j.indexFace.risky[0].ancestorEqual.state, 'deleted')
  assert.match(j.indexFace.risky[0].ageSource, /attestation/)
  assert.ok(j.indexFace.risky[0].ageMin >= 200, String(j.indexFace.risky[0].ageMin))
  assert.equal(j.ok, false)
})

test('C2【CLI·③回归】只改工作区不 add:工作树面照旧点名,索引面一条不收', () => {
  const root = cliFixture('cli-regress')
  writeFileSync(join(root, 'src/a.ts'), 'export const a = 5\n')
  const t = new Date(Date.now() - 180 * 60_000)
  utimesSync(join(root, 'src/a.ts'), t, t)
  const j = runCli(root, ['--json'])
  assert.equal(j.risky.length, 1, `原维度必须仍然报:${JSON.stringify(j)}`)
  assert.equal(j.risky[0].file, 'src/a.ts')
  assert.equal(j.indexFace.risky.length, 0)
  assert.equal(j.indexFace.status, 'empty', '未暂存的条目不得被算进索引面')
})

test('C3【CLI·⑤阈值 A/B】--threshold-min 极小 ⇒ 索引面全翻红;极大 ⇒ 全绿但仍报数', () => {
  const root = cliFixture('cli-threshold')
  stageFile(root, 'src/a.ts', 'export const a = 2\n', 180)
  writeFileSync(join(root, 'src/b.ts'), 'export const b = 1\n')
  stageFile(root, 'src/b.ts', 'export const b = 2\n', 120)
  const red = runCli(root, ['--json', '--threshold-min', '1'])
  assert.deepEqual(red.indexFace.risky.map((r) => r.file), ['src/a.ts', 'src/b.ts'], JSON.stringify(red.indexFace.risky))
  const green = runCli(root, ['--json', '--threshold-min', '999999999'])
  assert.equal(green.indexFace.risky.length, 0)
  assert.equal(green.indexFace.scanned, 2, '全绿也必须如实报数,不得把"没超龄"读成"没有悬留"')
  assert.equal(green.ok, true)
})

test('C4【CLI·④§0.3 反控】台账被拿掉那一轮 ⇒ 必须是 undetermined,不是"0 违规"', () => {
  const root = cliFixture('cli-undet')
  gitRaw(['rm', '-q', '--', 'src/a.ts'], root) // 删除态:mtime 断;夹具无 attestation;台账尚未建立
  const first = runCli(root, ['--json'])
  assert.equal(first.indexFace.risky.length, 0, '没有时刻 ⇒ 不得凭空冒红')
  assert.equal(first.indexFace.scanned, 0, '未判定不得混进 scanned 冒充"判过了"')
  assert.equal(first.indexFace.undetermined.length, 1, '必须点名未判定(§0.3)')
  assert.match(first.indexFace.undetermined[0].reason, /stage 时刻取不到/)
  assert.ok(first.indexFace.stamped >= 1, '首见必须由判据自己盖 first-seen 台账')

  const ledgerFile = join(root, '.workbuddy', 'index-pending-first-seen.json')
  assert.equal(existsSync(ledgerFile), true, '台账必须落在夹具内(不污染真仓)')
  // 把台账里的时刻手工推老 4 小时 ⇒ 证明这把尺子真的参与判定
  const led = JSON.parse(readFileSync(ledgerFile, 'utf8'))
  const k = Object.keys(led.entries)[0]
  led.entries[k].firstSeenMs = Date.now() - 240 * 60_000
  writeFileSync(ledgerFile, JSON.stringify(led))
  const second = runCli(root, ['--json', '--threshold-min', '45'])
  assert.equal(second.indexFace.undetermined.length, 0, '台账有时刻就不得再报未判定')
  assert.equal(second.indexFace.risky.length, 1, JSON.stringify(second.indexFace))
  assert.match(second.indexFace.risky[0].ageSource, /first-seen/)

  // ★ 反控:把台账拿掉(且 mtime/attestation 两把也拿不到)⇒ 结论必须退回未判定,而不是"没有悬留"
  rmSync(ledgerFile, { force: true })
  rmSync(join(root, '.workbuddy', 'safe-commit-attestation.jsonl'), { force: true })
  const third = runCli(root, ['--json'])
  assert.equal(third.indexFace.undetermined.length, 1, '拿掉台账却报"0 违规"就是把没判写成判过了')
  assert.equal(third.indexFace.scanned, 0)

  // 条目从索引消失(提交掉)⇒ 台账必须回收,不得无限增长
  gitRaw(['commit', '-q', '-m', 'land the deletion'], root)
  runCli(root, ['--json'])
  assert.deepEqual(JSON.parse(readFileSync(ledgerFile, 'utf8')).entries, {}, '条目消失后台账必须清空')
})

// ─── 装车锁(§0.9"造好没装车 = 没有"):判据必须住在每次提交都跑的那一层 ───
test('W1 索引面判据住在 main()(每次提交都跑的那一层),不是只住 --self-test', () => {
  const at = SRC_TEXT.indexOf('async function main()')
  assert.ok(at >= 0, 'main() 不存在')
  const body = SRC_TEXT.slice(at, SRC_TEXT.indexOf('// ─── 入口守护', at))
  assert.match(body, /runIndexFace\(/, 'main() 没调用索引面装配 ⇒ 扩面根本没装车')
  assert.match(body, /statusRead\.ok/, 'main 必须区分"status 读失败"与"索引为空"(§0.3)')
  assert.match(body, /collectCandidatePaths\(entries, walkUntrackedDir\)/, '原工作树维度必须仍在 main 里(扩面不能取代旧射程)')
})

test('W2 被否证的排除条款不得回潮(引原文只许作改判留痕,须与"否证"同段)', () => {
  assert.ok(!/刻意忽略/.test(SRC_TEXT), '「本守门刻意忽略 --staged」这句排除条款回来了 ⇒ 判据又被削短')
  const quoted = SRC_TEXT.indexOf('不在本判据内')
  assert.ok(quoted >= 0, '被否证的原文必须逐字留档(改判留痕),不得抹掉')
  // 该引用必须落在"否证"叙述段内:向前 400 字符里必须出现"否证",否则就是当成口径在写
  const before = SRC_TEXT.slice(Math.max(0, quoted - 400), quoted)
  assert.match(before, /否证/, '原文只许作为被否证的引文存在,不得复活成判据口径')
})

test('W3 台账落点纪律:相对路径 + 由 root 推导(禁绝对路径、禁盘符字面量)', () => {
  assert.ok(!src.INDEX_PENDING_LEDGER_REL.startsWith('/'), '台账必须是相对路径,由各 root 自行推导')
  assert.doesNotMatch(src.INDEX_PENDING_LEDGER_REL, /^[A-Za-z]:[\\/]/, '禁硬编码盘符(§26)')
  const root = box('ledgerpath')
  const p = src.indexPendingLedgerPath(root)
  assert.equal(dirname(p), join(root, '.workbuddy'), '台账必须落在被审 root 之内(测试夹具不得逃逸到真仓)')
  assert.ok(!/[A-Za-z]:[\\\\/]DevEnv/.test(SRC_TEXT), '源脚本不得硬编码项目外落点')
})

// §22c 单一真相源:扩面必须复用既有判据,第二份实现必然漂移。
// 这一条锁的是"调用点存在",不是"输出数字一致" —— 摘掉任一复用点即红。
// 取函数体用**顶层声明边界**切,不用花括号配平:参数表里的解构 `{ root = ROOT }` 与模板串里的
// `${}` 都会把"取下一个左花括号"的尺子骗走(先例:alert-volume-report.test.mjs 的 bodyOf 踩的就是这坑)。
const TOP_FN_DECL_RE = /^(?:export )?(?:async )?function /m
function bodyOfSource(name) {
  const re = new RegExp(`^(?:export )?(?:async )?function ${name}\\(`, 'm')
  const m = SRC_TEXT.match(re)
  assert.ok(m, `源脚本里已没有顶层 function ${name}(判据被改名/摘除,本锁该红不该跳过)`)
  const at = m.index
  const after = SRC_TEXT.slice(at + 1)
  const nextTop = after.search(TOP_FN_DECL_RE)
  const marker = after.indexOf('\n// ─── 入口守护')
  const ends = [nextTop >= 0 ? at + 1 + nextTop : -1, marker >= 0 ? at + 1 + marker : -1].filter((n) => n > 0)
  assert.ok(ends.length > 0, `切不出 function ${name} 的射程`)
  return SRC_TEXT.slice(at, Math.min(...ends))
}

test('W4 §22c 复用锁:索引面必须吃原维度那把尺子,不得自立第二份判据', () => {
  assert.match(bodyOfSource('collectStagedCandidatePaths'), /isCandidatePath\(/, '候选口径抄了两份必漂移')
  assert.match(bodyOfSource('isStagedIndexEntry'), /STAGED_INDEX_LETTERS/, '第一列字母表必须是那张具名清单')
  assert.match(bodyOfSource('evaluateIndexFace'), /classifyByAge\(/, '年龄判据必须复用 classifyByAge(严格大于那把尺子)')
  assert.match(bodyOfSource('runIndexFace'), /collectStagedCandidatePaths\(/, '索引面候选走收集层,不在判定层重筛')
  assert.match(bodyOfSource('runIndexFace'), /readLedgerRecords\(/, 'attestation 只许走 lib/commit-attestation.mjs 的读侧唯一出口')
  assert.match(bodyOfSource('runIndexFace'), /indexInflightAttestations\(/, '在飞筛选走纯函数出口(测试可直接构造)')
  assert.match(bodyOfSource('runIndexFace'), /analyzeIndexRevert\(/, '"等于某祖先版本"必须复用门 30b 的判据本体')
  assert.match(bodyOfSource('runIndexFace'), /resolveBlobs\(/, '暂存 blob 取材复用 face-reader 一侧的批读出口')
  assert.match(bodyOfSource('runIndexFace'), /windowLoss/, '祖先窗口用尽那一维必须传出来,不得静默当"不是回写"')
  assert.match(bodyOfSource('main'), /resolveThresholdMin\(argv, process\.env\)/, '阈值解析仍是唯一出口(两面共用)')
  // 索引面清单只来自 parsePorcelainZ(main 把同一次 status 的解析结果传进两面),不得另读一次 status
  const mainAt = SRC_TEXT.indexOf('async function main()')
  const mainBody = SRC_TEXT.slice(mainAt, SRC_TEXT.indexOf('// ─── 入口守护', mainAt))
  assert.equal((mainBody.match(/runGitResult\(/g) || []).length, 1, 'status 只读一次:读两次会拿到两面不一致的索引快照')
  assert.match(mainBody, /runIndexFace\(\{ entries, thresholdMin \}\)|runIndexFace\(\{[\s\S]{0,80}entries/, '索引面必须吃同一份 entries')
})

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
