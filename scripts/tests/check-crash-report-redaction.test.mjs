// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 守门「崩溃上报出口脱敏对账」(check-crash-report-redaction.mjs)的 §22c 镜像测试。
//
// 为什么每例都必须存在:本门守的是**没有任何编译期症状**的一型 —— 崩溃上报少了脱敏,
// typecheck / lint / 其余 180+ 道门全都绿,只有"90 天后有人 dump crash_reports"才看得见。
// 而门自身最容易的三种"看起来正常其实失明"是:注册块被摘线、共用遮罩/取材层被复制成第二份、
// 预筛词面漏掉判据字面量。这三种都只会表现为一路报绿,所以必须用源码锁 + 临时仓端到端钉住。
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { test } from 'node:test'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { copyScriptWithClosure } from '../lib/scratch-module-closure.mjs'
import { resolveGitBin } from '../lib/gitdir.mjs'

const GATE_REL = 'check-crash-report-redaction.mjs'
const HERE = dirname(fileURLToPath(import.meta.url))
const SCRIPTS_DIR = resolve(HERE, '..')
const REPO = resolve(SCRIPTS_DIR, '..')
const RUNNER = join(SCRIPTS_DIR, 'guardian-runner.mjs')
const SRC = join(SCRIPTS_DIR, GATE_REL)
const GIT = resolveGitBin() || 'git'

/** 真事故形状(逐字取自修复前的 ErrorBoundary.componentDidCatch:fetch + 端点 + 无出口) */
const EMITTER_BAD = [
  'export function reportCrash(error) {',
  "  void fetch('/api/crash-reports', {",
  "    method: 'POST',",
  '    body: JSON.stringify({ platform: \'web\', errorMessage: error.message }),',
  '  })',
  '}',
  '',
].join('\n')
/** 修好之后的形状:同一个发射动作,正文先过共享层唯一出口 */
const EMITTER_OK = [
  "import { redactCrashText } from '@ihui/shared/utils/redact'",
  'export function reportCrash(error) {',
  "  void fetch('/api/crash-reports', {",
  "    method: 'POST',",
  '    body: JSON.stringify({ platform: \'web\', errorMessage: redactCrashText(error.message) }),',
  '  })',
  '}',
  '',
].join('\n')
const EXIT_OK = 'export function redactCrashText(text) { return text }\n'
const EXIT_NO_EXPORT = 'function redactCrashText(text) { return text }\n'
const PERSIST_BAD = [
  'export async function recordCrash(input) {',
  '  await db.insert(crashReports).values({ errorMessage: input.errorMessage })',
  '}',
  '',
].join('\n')

function gitIn(dir, args) {
  return execFileSync(GIT, ['-c', 'safe.directory=*', '-C', dir, ...args], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 120_000,
    maxBuffer: 32 << 20,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

function put(dir, rel, text) {
  const abs = join(dir, rel)
  mkdirSync(dirname(abs), { recursive: true })
  writeFileSync(abs, text, 'utf8')
}

/**
 * 把门**连同相对 import 闭包**装进夹具仓(门按自身位置推 ROOT —— 不装它就在审真仓,
 * 那等于测试跑完什么都没测;守门 70 的 13/14 恒红与 13c 的 11/13 例失真都是这一型)。
 */
function makeRepo(dir, { emitter = EMITTER_OK, exitBody = EXIT_OK, persist = null } = {}) {
  gitIn(dir, ['init', '-q'])
  gitIn(dir, ['config', 'user.email', 'gate@fixture.local'])
  gitIn(dir, ['config', 'user.name', 'gate-fixture'])
  gitIn(dir, ['config', 'commit.gpgsign', 'false'])
  put(dir, 'packages/shared/src/utils/redact.ts', exitBody)
  put(dir, 'apps/web/src/ErrorBoundary.tsx', emitter)
  if (persist) put(dir, 'apps/api/src/services/crash-report-service.ts', persist)
  copyScriptWithClosure(SCRIPTS_DIR, GATE_REL, join(dir, 'scripts'), [
    'lib/face-reader.mjs',
    'lib/gitdir.mjs',
    'lib/code-mask.mjs',
  ])
  gitIn(dir, ['add', '-A'])
  gitIn(dir, ['commit', '-q', '-m', 'fixture'])
  return dir
}

function runGate(dir, args) {
  try {
    const out = execFileSync(process.execPath, [join(dir, 'scripts', GATE_REL), ...args], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 180_000,
      maxBuffer: 64 << 20,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return { code: 0, out }
  } catch (e) {
    return { code: e?.status ?? -1, out: `${e?.stdout ?? ''}${e?.stderr ?? ''}` }
  }
}

const parse = (s) => JSON.parse(s.out.slice(s.out.indexOf('{')))

/* ---------------------------- 接线层 ---------------------------- */

test('T1 装车证明:runner 里必须有 id 144,且 blocking + skipEnv + stagedTriggers 齐备', () => {
  const src = readFileSync(RUNNER, 'utf8')
  const at = src.indexOf("id: '144'")
  assert.ok(at >= 0, '本门不在 runner 里 —— 门存在但没人调度 = 没有(§22c 反复记过)')
  const block = src.slice(at, at + 2600)
  assert.ok(block.includes(`script: '${GATE_REL}'`), 'id 144 指向的不是本门')
  assert.match(block, /mode:\s*'blocking'/, '本门必须 blocking(存量有棘轮兜住,不会恒红)')
  assert.match(block, /skipEnv:\s*'HUSKY_SKIP_CRASH_REDACTION'/, '缺 skipEnv 就没有应急出口')
  assert.match(block, /stagedTriggers:[^\n]*'apps\/'/, '缺 stagedTriggers 会让本门在提交链上根本不唤起')
})

test('T2 反向对照:把 id 摘掉后,T1 那种"已装车"结论不得成立', () => {
  const src = readFileSync(RUNNER, 'utf8')
  const stripped = src.replace(/id: '144',/g, "id: '___',")
  assert.ok(
    !(stripped.includes("id: '144'") && stripped.includes(`script: '${GATE_REL}'`)),
    '改掉 id 之后仍被判成"已装车" —— 说明 T1 的锚点根本不看 id',
  )
})

test('T3 撞号反向锁:全 runner 任何 id 不得出现两次(含本门编号恰好一次)', () => {
  const src = readFileSync(RUNNER, 'utf8')
  const ids = [...src.matchAll(/^\s+id:\s*'([^']+)'/gm)].map((m) => m[1])
  assert.ok(ids.length > 100, `只解析到 ${ids.length} 个 id —— 解析式与注册表写法漂了`)
  const dup = ids.filter((x, i) => ids.indexOf(x) !== i)
  assert.deepEqual(dup, [], `runner 里有重复 id:${[...new Set(dup)].join(', ')} —— 撞号会串 skipEnv 与失败归属`)
  assert.equal(ids.filter((x) => x === '144').length, 1, '本门编号必须在 runner 中恰好出现一次')
})

test('T4 取材面形状锁:内容必须走 face-reader 的读取入口,不得回磁盘/自派生 git 散读', () => {
  const src = readFileSync(SRC, 'utf8')
  assert.match(src, /from '\.\/lib\/face-reader\.mjs'/, '本门必须走 face-reader(全量判 HEAD blob)')
  assert.match(src, /catBatch\(/, '没调用层的读取入口 = 半接线(守门 118 那一型)')
  assert.match(src, /maskCommentsAndStrings/, '遮罩必须共用 lib(门 131/135 同一条禁令)')
  assert.ok(
    !/function maskCommentsAndStrings\(/.test(src),
    '本门里不得留第二份遮罩实现 —— 两处算同一件事必漂移',
  )
  assert.ok(
    !/readFileSync\(\s*join\(\s*ROOT/.test(src),
    '不得用 ROOT 拼磁盘路径读被审内容(共享工作树滞后 HEAD 时会换结论)',
  )
})

/* ---------------------------- 真仓现读 ---------------------------- */

test('T5 真仓阳性对照:HEAD 面必须看得见崩溃上报站点,且不得因存量判红', () => {
  const r = runGate(REPO, ['--json'])
  assert.equal(r.code, 0, `真仓 HEAD 全量档不得非零(恒红门只会逼人 --no-verify):\n${r.out}`)
  const j = parse(r)
  assert.ok(j.sites.length >= 3, `HEAD 上看不见已知站点(实得 ${j.sites.length})⇒ 判据对该形态全盲,不是"已清完"`)
  assert.equal(j.emptyScan, false, '空扫不得记绿')
  assert.ok(j.scannedFiles >= 3, `预筛候选异常小(${j.scannedFiles})—— 词面或枚举坏了`)
  assert.deepEqual(j.red, [], '全量档的棘轮锚点=该文件 HEAD 自身,存量一律不得进 red')
})

test('T6 暂存档成套性:--staged 不得被 runner 的 --staged 传成恒挡(无关提交必须判"未判")', () => {
  // 本门的 --staged 只判"暂存集 ∩ 候选";无关提交交集为空 ⇒ notApplicable + exit 0。
  // 端到端那一路取决于共享索引此刻有什么,所以只在夹具仓里证(见 T8/T9),这里锁纯形状。
  const src = readFileSync(SRC, 'utf8')
  assert.match(src, /notApplicable/, '无候选的暂存档必须有可读的"未判"出口,不得静默记绿也不得判死')
  assert.match(src, /--diff-filter=ACMR/, '暂存清单必须走 ACMR(删除不该被当站点)')
})

/* ---------------------------- 构造面判据 ---------------------------- */

test('T7 判定行为只能用纯函数 + 构造面证明(不得用"源码里有没有某个串"冒充)', async () => {
  const { __test__ } = await import(pathToFileURL(SRC).href)
  const { classifySite, detectExit, v1IsRed, v2IsRed, countExitDecls, PREFILTER_TOKENS, JUDGE_LITERALS } = __test__
  assert.equal(classifySite(EMITTER_BAD).role, 'emit', '真事故形状必须被认作发射点')
  assert.equal(classifySite(EMITTER_BAD).violation, true, '未施加出口的发射点必须判违规')
  assert.equal(classifySite(EMITTER_OK).violation, false, '同一形状换了出口就必须放过(否则判据无牙)')
  assert.equal(classifySite(PERSIST_BAD).role, 'persist')
  assert.equal(classifySite(PERSIST_BAD).violation, true)
  // 注释里"提到"出口不算装车(本仓最高频失效型:看起来有、其实没接线)
  assert.equal(
    classifySite(EMITTER_BAD.replace('error.message }', 'error.message } // 应当调用 redactCrashText(x)')).violation,
    true,
    '把出口只写进注释 ⇒ 仍必须判违规(否则判据被注释洗绿)',
  )
  assert.equal(classifySite('').role, 'none', '空正文不得被认作站点')
  assert.equal(detectExit(EXIT_OK), 'ok')
  assert.equal(detectExit(EXIT_NO_EXPORT), 'missing', '没 export 的出口等于不存在')
  assert.equal(detectExit(null), 'undetermined', '取不到内容不得判"缺失"也不得判"在"')
  assert.equal(v1IsRed({ headViolation: false, currentViolation: true }), true)
  assert.equal(v1IsRed({ headViolation: true, currentViolation: true }), false, '存量不得变成人人跳门')
  assert.equal(v2IsRed({ anyReference: true, exitState: 'missing' }), true)
  assert.equal(v2IsRed({ anyReference: false, exitState: 'missing' }), false, '零引用时判红 = 本门在落地前的 HEAD 上恒红')
  assert.equal(
    countExitDecls(new Map([['a.ts', EXIT_OK], ['b.ts', EXIT_OK]])).length,
    2,
    '第二份实现必须数得出来(V3 的存在理由)',
  )
  assert.ok(
    JUDGE_LITERALS.every((lit) => PREFILTER_TOKENS.some((t) => t === lit)),
    '预筛词面漏了判据字面量 —— 门对该形态全盲却一路报绿(守门 102 同一课)',
  )
})

/* ---------------------------- 夹具仓端到端 ---------------------------- */

test('T8 有牙证明:HEAD 干净的文件被摘掉出口并 git add 后,--staged 必须判红并点名', () => {
  const dir = mkScratch('crr-regress-')
  try {
    makeRepo(dir, { emitter: EMITTER_OK })
    const clean = runGate(dir, ['--staged', '--json'])
    assert.equal(clean.code, 0, `无暂存变更时不应判红:\n${clean.out}`)
    assert.equal(parse(clean).sites.length, 0, '暂存档交集应为空(未判),不得把 HEAD 内容当本次改动')

    put(dir, 'apps/web/src/ErrorBoundary.tsx', EMITTER_BAD)
    gitIn(dir, ['add', '-A'])
    const bad = runGate(dir, ['--staged', '--json'])
    assert.equal(bad.code, 1, `把脱敏摘掉必须拦得住:\n${bad.out}`)
    const j = parse(bad)
    assert.equal(j.red.length, 1, `应恰好点名一个文件(实得 ${j.red.length})`)
    assert.equal(j.red[0].file, 'apps/web/src/ErrorBoundary.tsx')
    assert.equal(j.red[0].cap, 0, '锚点必须是该文件 HEAD 自身存量(HEAD 干净 ⇒ cap 0)')
    const rep = runGate(dir, ['--staged'])
    assert.match(rep.out, /V1 新增违规/, '报告必须点名,不得只给退出码')
  } finally {
    rmScratch(dir)
  }
})

test('T9 新增落库点必拦;出口被摘线判"没有出路";第二份声明判红', () => {
  const dir = mkScratch('crr-new-')
  try {
    // 起点:HEAD 上只有一个**已收口**的发射点 ⇒ 任何档都不该红
    makeRepo(dir, { emitter: EMITTER_OK })
    const baseline = runGate(dir, ['--staged', '--json'])
    assert.equal(baseline.code, 0, `起点就红说明判据把合规读成违规:\n${baseline.out}`)
    assert.equal(parse(baseline).anyReference, true, '发射点引用出口这件事必须被看见(整面,不收窄)')

    // ① 新增第二个不脱敏的落库点 ⇒ V1 判红并点名
    put(dir, 'apps/api/src/services/crash-report-service.ts', PERSIST_BAD)
    gitIn(dir, ['add', '-A'])
    const added = runGate(dir, ['--staged', '--json'])
    assert.equal(added.code, 1, `新增落库点未脱敏必须判红:\n${added.out}`)
    assert.equal(parse(added).red[0].file, 'apps/api/src/services/crash-report-service.ts')
    gitIn(dir, ['commit', '-q', '-m', 'persist site'])
    // 同一形状再问一次全量档:它此刻已是 HEAD 存量 ⇒ 只报数、不判红(否则就是恒红门)
    const asLegacy = runGate(dir, ['--json'])
    assert.equal(asLegacy.code, 0, `HEAD 存量不得判红:\n${asLegacy.out}`)
    assert.ok(parse(asLegacy).legacy.length >= 1, '存量必须被点名报数,不得静默')

    // ② 把出口的 export 摘掉(引用仍在 ⇒ V2 判"没有出路")
    put(dir, 'packages/shared/src/utils/redact.ts', EXIT_NO_EXPORT)
    gitIn(dir, ['add', '-A'])
    const noExit = runGate(dir, ['--staged', '--json'])
    assert.equal(noExit.code, 1, `引用了出口而面上没导出必须判红:\n${noExit.out}`)
    assert.equal(parse(noExit).exitMissingRed, true)
    assert.equal(parse(noExit).exitState, 'missing')
    put(dir, 'packages/shared/src/utils/redact.ts', EXIT_OK)
    // 索引与工作树一起回到 HEAD 的那一份(`checkout HEAD -- <path>`),**不需要**再 commit:
    // 再 add 一次就变成"没有改动可提交",夹具会在那一步炸掉而什么都没验证。
    gitIn(dir, ['checkout', 'HEAD', '--', 'packages/shared/src/utils/redact.ts'])

    // ③ 第二份实现 ⇒ V3 判红(它是"两处算同一件事必漂移"的唯一机器看守)
    put(dir, 'packages/shared/src/utils/redact2.ts', `// 另一处"自有规则"\n${EXIT_OK}`)
    gitIn(dir, ['add', '-A'])
    const dup = runGate(dir, ['--staged', '--json'])
    assert.equal(dup.code, 1, `出现第二份出口声明必须判红:\n${dup.out}`)
    assert.equal(parse(dup).dupDeclRed, true)
    assert.equal(parse(dup).decls.length, 2)
  } finally {
    rmScratch(dir)
  }
})

test('T11 无关提交不得被本门挡住:暂存集里没有崩溃相关路径 ⇒ 判"未判"而不是判死', () => {
  const dir = mkScratch('crr-unrelated-')
  try {
    makeRepo(dir, { emitter: EMITTER_BAD }) // HEAD 自带存量
    put(dir, 'docs/readme-note.md', '随便一次文档提交\n')
    put(dir, 'apps/web/src/unrelated.ts', 'export const a = 1\n')
    gitIn(dir, ['add', '-A'])
    const r = runGate(dir, ['--staged', '--json'])
    assert.equal(r.code, 0, `无关提交被挡住 = 替每一次提交挡路(§12e 同型):\n${r.out}`)
    const j = parse(r)
    assert.equal(j.notApplicable, true, '必须如实标"未判",不得读成"判过且通过"')
    assert.equal(j.v1Scanned, 0, 'V1 判据必须收窄到暂存集')
    assert.ok(j.scannedFiles >= 2, 'V2/V3 仍按整面判(收窄它 = 摘掉出口那一步没人看守)')
  } finally {
    rmScratch(dir)
  }
})

test('T10 --self-test 端到端 exit 0(判据自身必须可取证)', () => {
  const r = runGate(REPO, ['--self-test'])
  assert.equal(r.code, 0, `--self-test 必须全绿:\n${r.out}`)
  assert.match(r.out, /--self-test: (\d+)\/\1 通过/, '末行必须自报通过数/总数且相等')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
