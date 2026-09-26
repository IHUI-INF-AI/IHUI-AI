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
//  4. 真仓取材可用,且**判据对真事故有牙** —— HEAD 面实测未注册的那一族必须是
//     `DEBUG_TOOLS`(名字逐字取自 `apps/cli/src/tools/debug.ts`,不用自造夹具当规格);
//  5. 定根纪律:ROOT 由脚本自身位置推导,**不得靠 cwd**(守门 70 的镜像测试 13/14 恒红那一型);
//     `--root` 只作测试通道,且换根仍按被审面读;
//  6. 判据失效的方向:两面旗同给 ⇒ exit 2;枚举 0 个族 ⇒ exit 2,绝不表现为 exit 0 的绿。
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

const runGuard = (extra = [], opts = {}) =>
  spawnSync(process.execPath, [GUARD, ...extra], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 240000,
    maxBuffer: 64 << 20,
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

test('T2 装车证明:runner 有本门条目,mode=warn + skipEnv 成套 + 编号唯一未被占', () => {
  const text = readFileSync(RUNNER, 'utf8')
  const hits = registrationOf(text, SCRIPT_NAME)
  assert.equal(hits.length, 1, `本门在 runner 里应恰好注册一次(实得 ${hits.length})`)
  const hit = hits[0]
  assert.equal(hit.id, __test__.GUARDIAN_ID_EXPECTED, `编号应为 ${__test__.GUARDIAN_ID_EXPECTED},实得 ${hit.id}`)
  assert.equal(
    hit.mode,
    'warn',
    `本门定级 warn 是设计前提(存量 debug 族未注册时 blocking = 恒红门 ⇒ 逼人 --no-verify);` +
      `升 blocking 必须同时清偿存量并显式改这里`,
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

test('T4 真仓 HEAD 面:判据对真事故有牙(DEBUG_TOOLS 逐字取自真实文件)', () => {
  const src = readFileSync(join(REPO, 'apps/cli/src/tools/debug.ts'), 'utf8')
  assert.match(src, /^export const DEBUG_TOOLS\b/m, '夹具规格失效:debug.ts 已不再导出 DEBUG_TOOLS,请改本例')
  const r = runGuard(['--json'])
  assert.equal(r.status, 0, `全量档默认只报数,不该红(实得 ${r.status}):${r.stderr}`)
  const json = JSON.parse(r.stdout)
  assert.ok(json.counts.families >= 10, `族声明数被枚举到(实得 ${json.counts.families})`)
  assert.ok(
    json.violations.some((v) => v.name === 'DEBUG_TOOLS'),
    `HEAD 面必须点名 DEBUG_TOOLS(实得 ${JSON.stringify(json.violations.map((v) => v.name))})`,
  )
})

test('T5 变异对照:把某一族的注册点从**探针索引**里摘掉 ⇒ --staged 必红(broken)', () => {
  // 用独立的 GIT_INDEX_FILE,绝不触碰共享主索引(§12 多会话纪律)。
  const probe = join(REPO, '.git', 'ihui-probe-index-tool-family.tmp')
  const git = (args, extra = {}) =>
    spawnSync('git', ['-c', 'safe.directory=*', ...args], {
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
