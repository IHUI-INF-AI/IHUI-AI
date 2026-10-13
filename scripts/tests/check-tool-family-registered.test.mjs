// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像测试:守门「工具族注册对账」(§22c —— 直接 import 源模块,不复制判据实现)
//
// 钉六件事:
//  1. 源模块 export `__test__` 且判据所需纯函数在内(§22c phase B/C);
//  2. **装车证明**:runner 里必须真有本门条目,且 mode='warn' + skipEnv 与门内 SKIP_ENV_NAME
//     逐字一致 + 编号在本门申报值上恰好出现一次(撞号会串 skipEnv 与失败归属 —— 仓里踩过四次);
//     若有人把它悄悄升成 blocking 而未清偿存量,本例会红(那是需要人来背的决定,不是漂移);
//  3. 问责入口成套:`pnpm check:tool-family` 必须存在且带 `--strict`,否则 warn 档永远没人被追问;
//  4. 真仓取材可用,且**判据对真事故有牙** —— 事故用探针索引**构造**出来(摘掉 registerTools(DEBUG_TOOLS) ⇒ --staged 必红),
//     `DEBUG_TOOLS`(名字逐字取自 `apps/cli/src/tools/debug.ts`,不用自造夹具当规格);
//  5. 定根纪律:ROOT 由脚本自身位置推导,**不得靠 cwd**(守门 70 的镜像测试 13/14 恒红那一型);
//     `--root` 只作测试通道,且换根仍按被审面读;
//  6. 判据失效的方向:两面旗同给 ⇒ exit 2;枚举 0 个族 ⇒ exit 2,绝不表现为 exit 0 的绿;
//  7. **指向反查**(G-998149 票3):T2 的撞号反查只判"号重复",判不到"号在、script 被就地改写"。
//     前置取证(2026-10-13,git log --follow 全 313 提交、逐提交与其**第一父**比对 id→script,
//     26 次命中、逐抽样人工核对真实 diff 无一假阳):改指在本仓真实发生过 —— 89afadbbba 把 36/37
//     从 miniapp/web-tokens-sync 改指合并后的 design-tokens-sync、ba0123ff6b 让 189 从
//     python-import-landed 改指 git-stdio-discipline(换号复用)、7cecb3d0f7 曾把 161 的 script
//     写成带 scripts/ 前缀的不存在路径 ⇒ 故从观察转强推,补 T8(存在性)/T9(相对 HEAD^ 的
//     改指反查)/T10(三臂变异对照)。取证取向:不建号单,一切从注册表现读。
import { spawnSync } from 'node:child_process'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, rmSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { __test__ } from '../check-tool-family-registered.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const GUARD = join(REPO, 'scripts', 'check-tool-family-registered.mjs')
const RUNNER = join(REPO, 'scripts', 'guardian-runner.mjs')
const PKG = join(REPO, 'package.json')
const SCRIPT_NAME = 'check-tool-family-registered.mjs'
const SCRIPTS_DIR = join(REPO, 'scripts')

// 2026-10-13:.git 可能是 **gitfile**(本仓共享索引形态:工作区 .git 是一行
// `gitdir: D:/IHUI-AI-git-repo`),探针索引必须落在**真实** git 目录里,
// join(REPO, '.git', …) 会 ENOENT(本机实测 T4/T5 恒红那一型)。
// 必须 --absolute-git-dir:`--git-dir` 返回相对路径,join 会解析到测试进程的 cwd
// (check-commit-loss-guard.test.mjs:486 同一教训)。
const GIT_DIR = (() => {
  const r = spawnSync('git', ['-c', 'safe.directory=*', 'rev-parse', '--absolute-git-dir'], {
    cwd: REPO,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 60000,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  return r.status === 0 && r.stdout.trim() ? r.stdout.trim() : join(REPO, '.git')
})()

const runGuard = (extra = [], opts = {}) =>
  spawnSync(process.execPath, [GUARD, ...extra], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 240000,
    maxBuffer: 64 << 20,
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
    ...opts,
  })

/** 只在测试内做的注册表解析(不是判据实现的副本,是"装车"检查)。 */
function registrationOf(text, scriptName) {
  const lines = text.split('\n')
  const hits = []
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].includes(`script: '${scriptName}'`)) continue
    const block = lines.slice(Math.max(0, i - 14), i + 14).join('\n')
    hits.push({
      id: /id:\s*'([^']+)'/.exec(block)?.[1] ?? null,
      mode: /mode:\s*'([^']+)'/.exec(block)?.[1] ?? null,
      skipEnv: /skipEnv:\s*'([^']+)'/.exec(block)?.[1] ?? null,
      line: i + 1,
    })
  }
  return hits
}

/**
 * 结构解析**全 runner** 注册表(以 4 空格缩进的 `id:` 字段切段,段内取 script/args/mode)。
 * 与 registrationOf 同取向:解析注册表源结构,**不手抄任何门号/门脚本** —— 号单与专名必然腐。
 * 解析完备性由 T8 现场断言(script/args/mode 全字段非空)兜底。
 */
function parseRegistry(text) {
  const ids = [...text.matchAll(/^ {4}id: '([^']+)'/gm)]
  const rows = []
  for (let k = 0; k < ids.length; k++) {
    const start = ids[k].index + ids[k][0].length
    const end = k + 1 < ids.length ? ids[k + 1].index : text.length
    const seg = text.slice(start, end)
    const grab = (re) => re.exec(seg)?.[1] ?? null
    rows.push({
      id: ids[k][1],
      script: grab(/^ {4}script: '([^']+)'/m),
      args: grab(/^ {4}args: (\[[^\n]*\])/m),
      mode: grab(/^ {4}mode: '([^']+)'/m),
      skipEnv: grab(/^ {4}skipEnv: '([^']+)'/m),
    })
  }
  return rows
}

/** 指向存在性:每个在册号的 script 必须是 scripts/ 下真实文件(写成 'scripts/x.mjs' 带前缀也必落空 ⇒ 同臂判红)。 */
function missingScripts(rows, scriptsDir) {
  return rows
    .filter((r) => !r.script || !existsSync(join(scriptsDir, r.script)))
    .map((r) => `· [${r.id}] script=${r.script ?? '(缺)'} 在 scripts/ 下不存在`)
}

/**
 * 指向反查(票面草案):同号两版 script 逐字不同 ⇒ 改指,红并点名
 * `· [号] <基线>=<旧脚本> HEAD=<新脚本>`;"基线无此号"(纯新增)放行。
 * 只看 script 字段:mode/label 属定级与文案,另有 T2/门内自检覆盖,不在本臂射程。
 */
function repointViolations(curRows, baseRows, baseLabel = 'HEAD^') {
  const base = new Map(baseRows.map((r) => [r.id, r.script]))
  const out = []
  for (const r of curRows) {
    if (!base.has(r.id)) continue // 纯新增 ⇒ 过(票面草案)
    const old = base.get(r.id)
    if (old && r.script !== old) out.push(`· [${r.id}] ${baseLabel}=${old} HEAD=${r.script}`)
  }
  return out
}

/**
 * 重复登记:同一 **(script, args)** 判据被两个号登记 ⇒ 红(判据重复装车,失败归因会串)。
 * 注意:同 script **不同 args** 是本仓合法参数化(2b/2c 型,注册表现读 18 组),不在其列 ——
 * 全局判"同 script 即红"会把现注册表误杀,那不是判据是噪声。
 */
function duplicateCriteria(rows) {
  const seen = new Map()
  const out = []
  for (const r of rows) {
    const key = `${r.script} ${r.args}`
    if (seen.has(key)) {
      if (seen.get(key).id !== r.id) {
        out.push(
          `· [${r.id}] 与 [${seen.get(key).id}] 同判据重复登记: script=${r.script} args=${r.args}` +
            `(判据 ${r.mode}/${r.skipEnv ?? '-'} vs ${seen.get(key).mode}/${seen.get(key).skipEnv ?? '-'})`,
        )
      }
    } else {
      seen.set(key, r)
    }
  }
  return out
}

test('T1 §22c:源模块导出判据所需的纯函数与常量', () => {
  for (const k of [
    'maskNoise',
    'balanced',
    'classifyPath',
    'isTestSurface',
    'resolveSpec',
    'arrayLiteralOf',
    'compositionEdges',
    'scanEvidence',
    'decide',
    'analyze',
    'ratchetize',
    'main',
  ]) assert.equal(typeof __test__[k], 'function', `__test__.${k} 缺失`)
  assert.equal(__test__.SKIP_ENV_NAME, 'HUSKY_SKIP_TOOL_FAMILY_REGISTERED', '紧急跳过 env 名不得漂移')
  assert.equal(__test__.TOOLS_DIR, 'apps/cli/src/tools', '声明面漂移 ⇒ 门会扫空气')
})

test('T2 装车证明:runner 有本门条目,mode=blocking + skipEnv 成套 + 编号唯一未被占', () => {
  const text = readFileSync(RUNNER, 'utf8')
  const hits = registrationOf(text, SCRIPT_NAME)
  assert.equal(hits.length, 1, `本门在 runner 里应恰好注册一次(实得 ${hits.length})`)
  const hit = hits[0]
  assert.equal(hit.id, __test__.GUARDIAN_ID_EXPECTED, `编号应为 ${__test__.GUARDIAN_ID_EXPECTED},实得 ${hit.id}`)
  assert.equal(
    hit.mode,
    'blocking',
    `前置已满足 ⇒ 本门必须 blocking:未注册存量已于同日随 DEBUG_TOOLS 挂线归零,` +
      `继续留 warn 等于"判对了也没人被打断"(守门 105 升档同型)。` +
      `若有人把它降回 warn 而不写明理由,本例必红 —— 定级是判据的一部分,不是可调旋钮`,
  )
  assert.equal(hit.skipEnv, __test__.SKIP_ENV_NAME, 'runner 的 skipEnv 必须与门内常量逐字一致')
  // 撞号反查:全 runner 任何 id 不得出现两次(不硬写本门编号 —— 别人挪号会让硬写的断言先腐)
  const ids = [...text.matchAll(/^\s{4}id: '([^']+)'/gm)].map((m) => m[1])
  const dupes = ids.filter((v, i) => ids.indexOf(v) !== i)
  assert.deepEqual([...new Set(dupes)], [], `runner 里有重号门: ${[...new Set(dupes)].join(',')}`)
})

test('T3 问责入口成套:pnpm check:tool-family 存在且带 --strict(warn 档必须有人能追问)', () => {
  const pkg = JSON.parse(readFileSync(PKG, 'utf8'))
  const entry = pkg.scripts?.['check:tool-family']
  assert.ok(typeof entry === 'string' && entry.length > 0, '根 package.json 缺 check:tool-family')
  assert.match(entry, /--strict/, '问责入口必须带 --strict,否则 warn 门无人被追问')
})

test('T4 真仓:HEAD 面已清偿 + 摘掉注册点仍能点名 DEBUG_TOOLS(判据有牙,且不靠仓库瞬时状态)', () => {
  const src = readFileSync(join(REPO, 'apps/cli/src/tools/debug.ts'), 'utf8')
  assert.match(src, /^export const DEBUG_TOOLS\b/m, '夹具规格失效:debug.ts 已不再导出 DEBUG_TOOLS,请改本例')

  // ① 清偿侧:HEAD 面必须不再点名这一族(本门立项时它正是唯一的红格)
  const r = runGuard(['--json'])
  assert.equal(r.status, 0, `全量档默认只报数,不该红(实得 ${r.status}):${r.stderr}`)
  const json = JSON.parse(r.stdout)
  assert.ok(json.counts.families >= 10, `族声明数被枚举到(实得 ${json.counts.families})`)
  assert.ok(
    !json.violations.some((v) => v.name === 'DEBUG_TOOLS'),
    `DEBUG_TOOLS 已挂线 ⇒ HEAD 面不应再点名它(实得 ${JSON.stringify(json.violations.map((v) => v.name))})`,
  )

  // ② 有牙侧:**构造**那次事故(探针索引里摘掉注册行),而不是断言"仓库现在正带着这个缺陷"。
  //    判据曾经直接读 HEAD 的违规清单 ⇒ 修好之后本例反而变红,那是给成功判刑(守门 130 同型教训)。
  const probe = join(GIT_DIR, 'ihui-probe-index-t4.tmp')
  const git = (args, extra = {}) =>
    spawnSync('git', ['-c', 'safe.directory=*', ...args], {
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8',
      windowsHide: true,
      maxBuffer: 32 << 20,
      env: { ...process.env, GIT_INDEX_FILE: probe },
      ...extra,
    })
  try {
    if (existsSync(probe)) rmSync(probe)
    assert.equal(git(['read-tree', 'HEAD']).status, 0, `探针索引 read-tree 失败:${git(['read-tree', 'HEAD']).stderr}`)
    const rel = 'apps/cli/src/commands/agent.ts'
    const show = git(['show', `HEAD:${rel}`])
    assert.equal(show.status, 0, show.stderr)
    assert.match(show.stdout, /registerTools\(DEBUG_TOOLS\)/, 'HEAD 里没有 DEBUG_TOOLS 的注册点 ⇒ 事故无法复现')
    const mutated = show.stdout.replace(/^[ \t]*registerTools\(DEBUG_TOOLS\);[ \t]*\r?\n/m, '')
    assert.notEqual(mutated, show.stdout, '注册点没被摘掉 ⇒ 本对照无牙')
    const blob = git(['hash-object', '-w', '--stdin'], { input: mutated })
    assert.equal(blob.status, 0, blob.stderr)
    assert.equal(git(['update-index', '--cacheinfo', `100644,${blob.stdout.trim()},${rel}`]).status, 0)
    const after = runGuard(['--staged', '--json'], { env: { ...process.env, GIT_INDEX_FILE: probe } })
    assert.equal(after.status, 1, `摘掉注册点后 --staged 必须红(实得 ${after.status}):${after.stderr}`)
    const broken = JSON.parse(after.stdout)
    const named = [...(broken.ratchet?.broken ?? []), ...(broken.ratchet?.fresh ?? [])]
    assert.ok(named.includes('DEBUG_TOOLS'), `必须点名 DEBUG_TOOLS(实得 ${JSON.stringify(named)})`)
  } finally {
    if (existsSync(probe)) rmSync(probe)
  }
})

test('T5 变异对照:把某一族的注册点从**探针索引**里摘掉 ⇒ --staged 必红(broken)', () => {
  // 用独立的 GIT_INDEX_FILE,绝不触碰共享主索引(§12 多会话纪律)。
  const probe = join(GIT_DIR, 'ihui-probe-index-tool-family.tmp')
  const git = (args, extra = {}) =>
    spawnSync('git', ['-c', 'safe.directory=*', ...args], {
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8',
      windowsHide: true,
      maxBuffer: 32 << 20,
      env: { ...process.env, GIT_INDEX_FILE: probe },
      ...extra,
    })
  try {
    if (existsSync(probe)) rmSync(probe)
    assert.equal(git(['read-tree', 'HEAD']).status, 0, '探针索引 read-tree 失败')
    const rel = 'apps/cli/src/commands/agent.ts'
    const show = git(['show', `HEAD:${rel}`])
    assert.equal(show.status, 0, show.stderr)
    const target = 'CODEGRAPH_TOOLS'
    assert.match(show.stdout, new RegExp(`registerTools\\(${target}\\)`), `HEAD 里没有 ${target} 的注册点,对照失效`)
    const mutated = show.stdout.replace(
      new RegExp(`^[ \\t]*registerTools\\(${target}\\);[ \\t]*\\r?\\n`, 'm'),
      '',
    )
    assert.notEqual(mutated, show.stdout, '注册点没被摘掉 ⇒ 本对照无牙')
    const hash = git(['hash-object', '-w', '--stdin'], { input: mutated })
    assert.equal(hash.status, 0, hash.stderr)
    const oid = hash.stdout.trim()
    assert.equal(
      git(['update-index', '--add', '--cacheinfo', `100644,${oid},${rel}`]).status,
      0,
      '探针索引 update-index 失败',
    )
    const staged = runGuard(['--staged', '--json'], { env: { ...process.env, GIT_INDEX_FILE: probe } })
    assert.equal(
      staged.status,
      1,
      `摘掉注册点后 --staged 必须 exit 1(实得 ${staged.status}):${staged.stdout}${staged.stderr}`,
    )
    const json = JSON.parse(staged.stdout)
    assert.ok(
      (json.ratchet?.broken ?? []).includes(target),
      `必须归到 broken(HEAD 有、索引被摘),实得 ${JSON.stringify(json.ratchet)}`,
    )
  } finally {
    if (existsSync(probe)) rmSync(probe)
  }
})

test('T6 定根纪律:不得靠 cwd 定仓库,且必须走 face-reader', () => {
  const src = readFileSync(GUARD, 'utf8')
  assert.ok(!/const\s+ROOT\s*=\s*process\.cwd\(\)/.test(src), 'ROOT 不得由 cwd 推(守门 70 的失效型)')
  assert.ok(/from '\.\/lib\/face-reader\.mjs'/.test(src), '取材必须走 scripts/lib/face-reader.mjs')
  assert.match(src, /catBatch\(/, '必须用层的批量读取(半接线 = 守门 118 判红那一型)')
  assert.ok(!/\bgitRaw\(\[?'show'/.test(src), '不得自己散写 `git show` 取正文')
})

test('T7 判据失效方向:两面旗同给 ⇒ exit 2;空面 ⇒ exit 2', () => {
  const both = runGuard(['--staged', '--worktree'])
  assert.equal(both.status, 2, `两面旗同给必须判死(实得 ${both.status})`)
  const bogus = runGuard(['--root', resolve(REPO, 'scripts')])
  assert.equal(bogus.status, 2, `root 不是仓库根必须 exit 2,不得记绿(实得 ${bogus.status})`)
})

test('T8 指向反查·存在性臂:在册号的 script 必须真实存在于 scripts/(现读注册表,不建号单)', () => {
  const rows = parseRegistry(readFileSync(RUNNER, 'utf8'))
  // 解析完备性:字段取不到 ⇒ 判据在扫空气,不许表现为绿
  assert.ok(rows.length > 0, '注册表解析为空 ⇒ 判据扫空气,不得记绿')
  for (const r of rows) {
    assert.ok(r.script, `· [${r.id}] 解析不到 script 字段(注册表结构变了,先修 parseRegistry)`)
    assert.ok(r.args, `· [${r.id}] 解析不到 args 字段(重复登记臂失效在即,先修 parseRegistry)`)
    assert.ok(r.mode, `· [${r.id}] 解析不到 mode 字段(注册表结构变了,先修 parseRegistry)`)
  }
  assert.deepEqual(
    missingScripts(rows, SCRIPTS_DIR),
    [],
    '在册号必须指向真实存在的脚本(含"写成 scripts/ 前缀导致落空"那一型 —— 取证 7cecb3d0f7 真实发生过)',
  )
  // 正例同臂:同 script 不同 args 的参数化共享必须放行(2b/2c 型),否则重复登记臂会误杀现注册表
  assert.deepEqual(duplicateCriteria(rows), [], '同一 (script,args) 判据被两号重复登记')
})

test('T9 指向反查·改指臂:在册号的 script 相对基线不得被改写(基线 HEAD^,取不到则降级/未判定,绝不记绿)', (t) => {
  const cur = parseRegistry(readFileSync(RUNNER, 'utf8'))
  // spawnSync 不走 shell —— execSync 经 cmd.exe 会把 `^` 当转义符吃掉(取证脚本实测踩过:
  // `rev-parse <hash>^` 静默返回自身 ⇒ 全量假 0)。基线取法依票面草案与本仓既有形态
  // (live-doc-edit.test.mjs 已用 `git show "HEAD^:…"`)。
  const show = (rev) => {
    const r = spawnSync('git', ['-c', 'safe.directory=*', 'show', `${rev}:scripts/guardian-runner.mjs`], {
      cwd: REPO,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 60000,
      maxBuffer: 32 << 20,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return r.status === 0 && r.stdout ? r.stdout : null
  }
  let baseText = show('HEAD^')
  let label = 'HEAD^'
  if (!baseText) {
    // 浅克隆/单提交(如 actions/checkout 默认 fetch-depth=1)拿不到 HEAD^:
    // 降级 HEAD 只能保住"未提交改指"窗口,上一提交窗口**未判定** —— diagnostic 显形,不算绿。
    baseText = show('HEAD')
    label = 'HEAD(降级)'
    if (baseText) t.diagnostic('HEAD^ 不可用 ⇒ 基线降级 HEAD:仅覆盖未提交改指,上一提交窗口未判定')
  }
  if (!baseText) {
    t.skip('未判定:HEAD^/HEAD 基线均取不到(无 git 或无提交),指向反查不作结论')
    return
  }
  const v = repointViolations(cur, parseRegistry(baseText), label)
  assert.deepEqual(v, [], `出现改指(号在、script 被就地改写):\n${v.join('\n')}`)
})

test('T10 变异对照(镜像·全内存):改指他处/指向不存在/同判据重复登记 ⇒ 必红,合法共享 ⇒ 过', () => {
  const text = readFileSync(RUNNER, 'utf8')
  const base = parseRegistry(text)
  assert.deepEqual(missingScripts(base, SCRIPTS_DIR), [], '正例①:在册号全部指向存在的脚本')
  assert.deepEqual(duplicateCriteria(base), [], '正例③:现注册表无同判据重复登记(参数化共享放行)')

  // 锚点不硬写门号/门脚本(编号清单与专名都会腐):现读注册表取首号作改指对象;
  // 改指目标取"存在、且其全部在册判据 args 均与锚点不同"的脚本 —— 隔离三臂,互不污染。
  const anchor = base[0]
  const victim = base.find(
    (r) => r.script !== anchor.script && base.every((o) => o.script !== r.script || o.args !== anchor.args),
  )
  assert.ok(victim && anchor?.script, `找不到合法改指目标(注册表形态变了 ⇒ 本对照需重拟)`)

  // ②a 改指他处(script 仍真实存在)⇒ 只有改指臂判红,存在性臂/重复登记臂必须仍绿
  const movedText = text.replace(`script: '${anchor.script}'`, `script: '${victim.script}'`)
  assert.notEqual(movedText, text, '锚点 script 没被替换 ⇒ 对照无牙(锚点名腐了,改本例)')
  const moved = parseRegistry(movedText)
  assert.deepEqual(missingScripts(moved, SCRIPTS_DIR), [], '隔离:victim 必须存在(本臂只测改指)')
  assert.deepEqual(duplicateCriteria(moved), [], '隔离:args 已选不同,重复登记臂不得误红')
  const rv = repointViolations(moved, base)
  const changedIdx = base.findIndex((r, i) => moved[i]?.script !== r.script)
  assert.ok(changedIdx >= 0, '改指没落到任何在册号上 ⇒ 对照无牙')
  assert.deepEqual(
    rv,
    [`· [${base[changedIdx].id}] HEAD^=${anchor.script} HEAD=${victim.script}`],
    '改指必须恰好判红一处,且点名号与新旧脚本(票面格式)',
  )

  // ②b 指向不存在 ⇒ 存在性臂必红;改指臂同红(两臂在此重合:不存在的指向同时违反两条断言)
  const ghostText = text.replace(`script: '${anchor.script}'`, `script: 'check-ghost-nonexistent.mjs'`)
  assert.notEqual(ghostText, text, '锚点 script 没被替换 ⇒ 对照无牙')
  const ghost = parseRegistry(ghostText)
  assert.ok(
    missingScripts(ghost, SCRIPTS_DIR).some((m) => m.includes(anchor.id)),
    '指向不存在的脚本必须由存在性臂判红',
  )
  assert.equal(repointViolations(ghost, base).length, 1, '指向不存在同时是改指,改指臂也应判红(重合臂)')

  // ③ 同 script 以**不同判据**被两号重复登记 ⇒ 必红(克隆一条真在册共享项,判据改档)
  const shared = base.find((r) => base.some((o) => o.id !== r.id && o.script === r.script))
  assert.ok(shared, '注册表现无共享 script 形态 ⇒ 本对照无牙(重拟锚点)')
  const dupRows = [
    ...base,
    {
      ...shared,
      id: `${shared.id}-dup-probe`,
      mode: shared.mode === 'blocking' ? 'warn' : 'blocking',
      skipEnv: shared.skipEnv ? `${shared.skipEnv}_DUP` : 'HUSKY_SKIP_DUP_PROBE',
    },
  ]
  const dv = duplicateCriteria(dupRows)
  assert.equal(dv.length, 1, `同 (script,args) 被两号以不同判据登记必须恰判红一处,实得 ${JSON.stringify(dv)}`)
  assert.ok(dv[0].includes(shared.script) && dv[0].includes(`${shared.id}-dup-probe`), '红必须点名两号与 script')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
