// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像测试:守门「工具入参路由身份对账」(§22c —— 直接 import 源模块,不复制判据实现)
//
// 钉五件事:
//  1. 源模块必须 export `__test__` 且判据所需纯函数在内(§22c phase B/C);
//  2. **清单只有一份**:门必须从 packages/types 的 ROUTING_IDENTITY_KEYS 取表,自己不得再定义一张;
//  3. **装车前置**:本门按任务书不由实现票接线(注册表由主会话单写)。因此
//     未注册 ⇒ 通过并如实点名"待接线";一旦出现在 runner 里,必须同时是 blocking + 真实 skipEnv,
//     且编号在整份 runner 里唯一(撞号会串 skipEnv 与失败归属 —— 仓里踩过);
//  4. 真仓取材通路可用(HEAD/索引/工作树三面的只读 git 派生);
//  5. 临时独立仓端到端:新增越权键 ⇒ exit 1 并点名文件与键;带原因豁免 ⇒ exit 0;
//     而"扫不到候选文件"必须 exit 2,**绝不允许表现为 exit 0 的绿**。
import { execFileSync, spawnSync } from 'node:child_process'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { resolveGitBin } from '../lib/gitdir.mjs'
import { __test__ } from '../check-tool-arg-routing-identity.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const GUARD = join(REPO, 'scripts', 'check-tool-arg-routing-identity.mjs')
const RUNNER = join(REPO, 'scripts', 'guardian-runner.mjs')
const SCRIPT_NAME = 'check-tool-arg-routing-identity.mjs'
const SKIP_ENV = 'HUSKY_SKIP_TOOL_ARG_ROUTING_IDENTITY'
const GIT = resolveGitBin() || 'git'
const gitOpts = { encoding: 'utf8', windowsHide: true, timeout: 120000, maxBuffer: 64 << 20 }
const runGit = (dir, args) => execFileSync(GIT, ['-c', 'safe.directory=*', '-C', dir, ...args], gitOpts)
const runGuard = (dir, extra = []) =>
  spawnSync(process.execPath, [GUARD, '--root', dir, ...extra], { encoding: 'utf8', windowsHide: true, timeout: 240000, maxBuffer: 64 << 20 })

/** 只在测试内做的注册表解析(不是判据实现的副本,是"装车"检查) */
function registrationOf(text, scriptName) {
  const lines = text.split('\n')
  const hits = []
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].includes(`script: '${scriptName}'`)) continue
    const block = lines.slice(Math.max(0, i - 12), i + 12).join('\n')
    const id = /id:\s*'([^']+)'/.exec(block)?.[1] ?? null
    const mode = /mode:\s*'([^']+)'/.exec(block)?.[1] ?? null
    const skipEnv = /skipEnv:\s*'([^']+)'/.exec(block)?.[1] ?? null
    hits.push({ id, mode, skipEnv, line: i + 1 })
  }
  return hits
}

const CONTRACT_SRC = "export const ROUTING_IDENTITY_KEYS = ['sessionId','session_id','agentId','agent_id','userId','user_id'] as const\n"
const PROJECTION_SRC =
  'export function projectToolInputSchema(parameters) {\n  const properties = {}\n  for (const [name, d] of Object.entries(parameters)) properties[name] = { type: d.type }\n  return { type: "object", properties }\n}\n'

function makeRepo(t) {
  const dir = mkScratch('tool-arg-routing-')
  t.after(() => rmScratch(dir))
  runGit(dir, ['init', '-q'])
  mkdirSync(join(dir, 'apps/cli/src/tools'), { recursive: true })
  mkdirSync(join(dir, 'packages/types/src'), { recursive: true })
  writeFileSync(join(dir, 'packages/types/src/tool-contract.ts'), CONTRACT_SRC)
  writeFileSync(join(dir, 'packages/types/src/schema-projection.ts'), PROJECTION_SRC)
  writeFileSync(join(dir, 'apps/cli/src/tools/builtins.ts'), "export const read_file = { name: 'read_file', parameters: { path: { type: 'string' } }, required: ['path'] }\n")
  writeFileSync(join(dir, 'package.json'), '{ "name": "e2e" }\n')
  runGit(dir, ['add', '-A'])
  runGit(dir, ['commit', '-q', '-m', 'init'])
  return dir
}

test('1 §22c:源模块导出判据所需的纯函数', () => {
  for (const k of ['normalizeKey', 'maskNoise', 'parseNameList', 'collectSchemaKeys', 'scanFile', 'auditProjection', 'decide', 'readRulerSource', 'analyze'])
    assert.equal(typeof __test__[k], 'function', `__test__.${k} 缺失`)
})

test('2 清单只有一份:门自己不得再定义一张身份键表', () => {
  const src = readFileSync(GUARD, 'utf8')
  // 必须先在**门自己的遮蔽层**里过一遍:注释与夹具字符串里出现的 `const ROUTING_IDENTITY_KEYS = [ … ]`
  // 不是门自定清单(尺子若量到自己的解释注释,就又是一台自咬的门 —— 仓里踩过)
  const codeOnly = __test__.maskNoise(src)
  const selfDefined = /(?:const|let|var)\s+\w*(?:ROUTING|IDENTITY)\w*\s*=\s*\[[^\]]*\]/.exec(codeOnly)
  assert.equal(selfDefined, null, `门里出现了自定清单:${selfDefined?.[0]?.slice(0, 80)}`)
  assert.match(src, /packages\/types\/src\/tool-contract\.ts/, '必须点名唯一清单源')
  // 真仓现读:清单必须真解析得到,且含票面点名的 8 族
  const keys = __test__.parseNameList(readFileSync(join(REPO, 'packages/types/src/tool-contract.ts'), 'utf8'))
  const norm = new Set(keys.map(__test__.normalizeKey))
  for (const want of ['sessionId', 'session_id', 'agentId', 'instanceId', 'userId', 'conversationId', 'chatId', 'runId', 'turnId'])
    assert.ok(norm.has(__test__.normalizeKey(want)), `清单缺 ${want}`)
  // 排掉的内容引用键不得进表(误拦正当用法)
  for (const bad of ['messageId', 'toolCallId', 'message_id', 'tool_call_id'])
    assert.ok(!norm.has(__test__.normalizeKey(bad)), `内容引用键 ${bad} 不得进路由身份表`)
})

test('3 装车前置:未注册则如实点名待接线;注册了必须 blocking + 真实 skipEnv + 编号唯一', () => {
  const text = readFileSync(RUNNER, 'utf8')
  const hits = registrationOf(text, SCRIPT_NAME)
  if (hits.length === 0) {
    console.log('  ℹ️  本门按任务书未由实现票接线 guardian-runner(注册表由主会话单写)⇒ 此处如实点名,不冒充已装')
  } else {
    assert.equal(hits.length, 1, `注册块出现 ${hits.length} 次(script: 行重复即撞号)`)
    assert.equal(hits[0].mode, 'blocking', '本门必须是 blocking(warn 级等于没有)')
    assert.equal(hits[0].skipEnv, SKIP_ENV, '紧急跳过环境变量必须与门内一致')
    const ids = text.split('\n').filter((l) => new RegExp(`^\\s*id: '${hits[0].id}',$`).test(l)).length
    assert.equal(ids, 1, `id ${hits[0].id} 在 runner 里出现 ${ids} 次(撞号即串 skipEnv 与失败归属)`)
  }
  // 变异对照:同一份注册文本把 mode 改成 warn,装车断言必须失效(证明这条断言有牙)
  const fabricated = `  {\n    id: '999',\n    script: '${SCRIPT_NAME}',\n    mode: 'warn',\n    skipEnv: '${SKIP_ENV}',\n  },\n`
  const mutated = registrationOf(fabricated, SCRIPT_NAME)
  assert.equal(mutated.length, 1, '夹具必须能被解析到')
  assert.notEqual(mutated[0].mode, 'blocking', '变异注入未被识破 ⇒ 装车断言无牙')
})

test('4 端到端:新增越权键 ⇒ exit 1 并点名文件与键;带原因豁免 ⇒ exit 0', (t) => {
  const dir = makeRepo(t)
  // ① 干净基线 ⇒ exit 0
  assert.equal(runGuard(dir).status, 0, '干净夹具应当通过')
  // ② 新增 sessionId 进 parameters ⇒ exit 1(夹具里没有基线文件 = 零容忍)
  writeFileSync(
    join(dir, 'apps/cli/src/tools/builtins.ts'),
    "export const read_file = { name: 'read_file', parameters: { path: { type: 'string' }, sessionId: { type: 'string' } }, required: ['path'] }\n",
  )
  runGit(dir, ['add', '-A'])
  const red = runGuard(dir, ['--staged'])
  assert.equal(red.status, 1, `应当判红,实得 ${red.status}:${red.stdout}${red.stderr}`)
  assert.match(`${red.stdout}${red.stderr}`, /sessionid/, '必须点名命中的键')
  assert.match(`${red.stdout}${red.stderr}`, /apps\/cli\/src\/tools\/builtins\.ts/, '必须点名文件')
  // ③ 同键 + 带原因豁免 ⇒ exit 0
  writeFileSync(
    join(dir, 'apps/cli/src/tools/builtins.ts'),
    `export const read_file = { name: 'read_file', parameters: { path: { type: 'string' }, sessionId: { type: 'string' } } } // ${__test__.EXEMPT_MARK_TEXT} 调试用只读工具,宿主已绑定会话 until 2099-12-31\n`,
  )
  runGit(dir, ['add', '-A'])
  const green = runGuard(dir, ['--staged'])
  assert.equal(green.status, 0, `带原因豁免应当放行,实得 ${green.status}:${green.stdout}${green.stderr}`)
  // ④ 豁免不带原因 ⇒ 仍判红(不得用它清账)
  writeFileSync(
    join(dir, 'apps/cli/src/tools/builtins.ts'),
    `export const read_file = { name: 'read_file', parameters: { path: { type: 'string' }, sessionId: { type: 'string' } } } // ${__test__.EXEMPT_MARK_TEXT}\n`,
  )
  runGit(dir, ['add', '-A'])
  assert.equal(runGuard(dir, ['--staged']).status, 1, '无原因的豁免标记不得放行')
})

test('5 反向对照:判据失效不得表现为"扫 0 记绿"(夹具里没有扫描面 ⇒ exit 2)', (t) => {
  const dir = mkScratch('tool-arg-routing-empty-')
  t.after(() => rmScratch(dir))
  runGit(dir, ['init', '-q'])
  mkdirSync(join(dir, 'packages/types/src'), { recursive: true })
  writeFileSync(join(dir, 'packages/types/src/tool-contract.ts'), CONTRACT_SRC)
  writeFileSync(join(dir, 'packages/types/src/schema-projection.ts'), PROJECTION_SRC)
  writeFileSync(join(dir, 'README.md'), 'no tools here\n')
  runGit(dir, ['add', '-A'])
  runGit(dir, ['commit', '-q', '-m', 'init'])
  const r = runGuard(dir)
  assert.equal(r.status, 2, `扫不到候选文件必须 exit 2(无法判定),实得 ${r.status}:${r.stdout}${r.stderr}`)
  assert.match(`${r.stdout}${r.stderr}`, /无法判定|0 个/, '结论行必须写明为什么无法判定')
})

test('6 真仓取材可用:三种面都能读到清单与投影源(只读,不改索引)', () => {
  for (const face of ['head', 'staged', 'worktree']) {
    const src = __test__.readRulerSource(REPO, face, __test__.NAME_SOURCE, (t) => /ROUTING_IDENTITY_KEYS/.test(t))
    if (typeof src.text === 'string') assert.match(src.text, /ROUTING_IDENTITY_KEYS/, `${face} 面读到的清单源不含标记`)
    else assert.ok(src.notices.length > 0, `${face} 面取不到却不报原因`)
  }
  const proj = __test__.auditProjection(readFileSync(join(REPO, 'packages/types/src/schema-projection.ts'), 'utf8'))
  assert.equal(proj.verdict, 'name-preserving', `投影出口应当逐字保留键名,实得 ${proj.verdict}(${proj.why})`)
  const res = __test__.analyze(REPO, 'head')
  assert.ok(res.scannedFiles > 0, '真仓必须扫到候选文件')
  assert.ok(res.keys.length >= 16, '清单项数不得少于票面 16')
})

test('7 取材口径:--staged 与 --worktree 同给 ⇒ 判死(不选边)', () => {
  const r = spawnSync(process.execPath, [GUARD, '--staged', '--worktree'], { encoding: 'utf8', windowsHide: true, timeout: 120000 })
  assert.equal(r.status, 2, `两面旗同给必须 exit 2,实得 ${r.status}`)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
