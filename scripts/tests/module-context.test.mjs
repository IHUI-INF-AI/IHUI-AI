// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// scripts/module-context.mjs 的镜像测试。
//
// 本票的核心主张是"策略表不能只有判据、没有出口",所以这里钉的是三件事:
//  ① 出口**说的**与判据**判的**必须是同一份实现算出的同一个结论(同源);
//  ② 缺工件必须**同时**打印 missing 与给出非 0 退出码(上游 ZCode 只打印不判,等于不判);
//  ③ 未知模块 id / 未知开关一律 exit 2 且点名 —— 不得静默走默认分支
//     (本仓在 sync-lost-commit-tags.mjs 上刚踩过同一型)。
// 夹具全部走 `mkScratch` + 构造的策略表,**不往真表写真策略表写自测行**。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { __test__ as gate, declarationContext, resolveEntrypoint } from '../check-architecture-policy.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { gitRaw } from '../lib/face-reader.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const SCRIPT = join(REPO, 'scripts', 'module-context.mjs')
const RUNNER = join(REPO, 'scripts', 'guardian-runner.mjs')

const run = (args) => {
  try {
    const out = execFileSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8', maxBuffer: 1 << 28, timeout: 300000, windowsHide: true })
    return { code: 0, out }
  } catch (e) {
    return { code: typeof e.status === 'number' ? e.status : 2, out: `${e.stdout || ''}${e.stderr || ''}` }
  }
}

/** 构造一张只含一个纳管块的小策略表,落在仓库外的 scratch 目录里 */
function fixtureTable(body) {
  const dir = mkScratch('module-context-fixture-')
  const file = join(dir, 'policy.yaml')
  const head = `version: 1
constraints:
  max_file_lines: 9999
  max_contract_file_lines: 9999
  max_public_exports: 9999
  contract_file_patterns:
    - 'zzz-no-such-pattern/**'
layers:
  - id: 'platform'
    rank: 20
modules:
`
  writeFileSync(file, head + body, 'utf8')
  return { dir, file }
}
const BLOCK = (contractFiles) => `  - id: 'packages/api-client'
    package: '@ihui/api-client'
    layer: 'platform'
    exported: true
    managed: true
    roots:
      - 'packages/api-client'
    requires: []
    public_entrypoints:
      - '.'
    contract_files:${contractFiles.length ? '\n' + contractFiles.map((f) => `      - '${f}'`).join('\n') : ' []'}`

test('M1 --json 可被 JSON.parse,且阅读包六格齐备', () => {
  const r = run(['packages/api-client', '--json'])
  assert.equal(r.code, 0, r.out)
  const o = JSON.parse(r.out)
  assert.equal(o.moduleId, 'packages/api-client')
  for (const k of ['managed', 'requires', 'contractFiles', 'dependencyContracts', 'entries', 'missing']) assert.ok(k in o, `阅读包缺字段 ${k}`)
  assert.equal(o.managed, true)
  assert.ok(o.entries.length > 0 && o.contractFiles.length > 0)
  assert.ok(o.dependencyContracts.length >= 1, '声明依赖 packages/types 的契约文件必须出现在阅读包里')
})

test('M2 --files 每行都是取材面里真实存在的路径(派单清单不得含幻影文件)', () => {
  const tracked = new Set(gitRaw(['ls-tree', '-r', '--name-only', 'HEAD', '-z'], REPO, { timeout: 180000, maxBuffer: 1 << 29, windowsHide: true }).split('\0').filter(Boolean))
  const r = run(['packages/api-client', '--files'])
  assert.equal(r.code, 0, r.out)
  const lines = r.out.trim().split('\n')
  assert.ok(lines.length > 10, `清单只有 ${lines.length} 行,取面可能失效`)
  for (const l of lines) {
    assert.doesNotMatch(l, /\s/, `清单行含空白,不像路径:${l}`)
    assert.ok(tracked.has(l), `清单里的路径不在 HEAD 取材面:${l}`)
  }
})

test('M3 未知模块 id / 未知开关 / 缺 id 一律 exit 2 且点名(不得静默走默认档)', () => {
  const unknown = run(['nope-not-a-module'])
  assert.equal(unknown.code, 2, unknown.out)
  assert.match(unknown.out, /未知模块 id/)
  assert.match(unknown.out, /--list/, '应把发现入口(--list)交回调用方')
  const badFlag = run(['packages/api-client', '--jsonn'])
  assert.equal(badFlag.code, 2, badFlag.out)
  assert.match(badFlag.out, /未知开关/)
  const badFace = run(['packages/api-client', '--face', 'deskside'])
  assert.equal(badFace.code, 2, badFace.out)
  assert.match(badFace.out, /未知 --face/)
  const noId = run([])
  assert.equal(noId.code, 2, noId.out)
  assert.match(noId.out, /缺少模块 id/)
})

test('M4 同源:阅读包的入口结论必须与门自己的解析结果逐条相同(禁止第二份实现)', () => {
  const r = JSON.parse(run(['packages/api-client', '--json']).out)
  const P = gate.loadPolicy(gate.parseYaml(gitRaw(['show', 'HEAD:config/architecture-policy.yaml'], REPO, { timeout: 180000, maxBuffer: 1 << 29, windowsHide: true }), 'HEAD'))
  const paths = gitRaw(['ls-tree', '-r', '--name-only', 'HEAD', '-z'], REPO, { timeout: 180000, maxBuffer: 1 << 29, windowsHide: true }).split('\0').filter(Boolean)
  const ctx = declarationContext(P, paths, 'HEAD')
  const m = P.modules.get('packages/api-client')
  assert.ok(m, '真表里没有 packages/api-client —— 前提已失效,本条不再有意义')
  const direct = m.entrypoints.map((ep) => resolveEntrypoint(m, ep, ctx))
  assert.equal(r.entries.length, direct.length, '条数不一致 ⇒ 两侧读的不是同一份声明')
  for (let i = 0; i < direct.length; i++) assert.deepEqual(r.entries[i], { ep: direct[i].ep, state: direct[i].state, path: direct[i].path, how: direct[i].how }, `第 ${i + 1} 条入口结论与判据侧不同形`)
  const src = readFileSync(SCRIPT, 'utf8')
  assert.match(src, /import \{[^}]*auditDeclarations[^}]*\} from '\.\/check-architecture-policy\.mjs'/, '退出码必须由门的 auditDeclarations 推导')
  // 只审**代码面**:提示语里提到门的字段名是正当的(它在解释这块工件是从哪一栏来的)
  // 只审「门自己的字段标识符」:human 消息里出现 YAML 键名是正当的(它在解释这块工件从哪一栏来)
  assert.doesNotMatch(src, /P[.]contractPatterns|P[.]maxFileLines|P[.]constraints|P[.]exceptions/, '阅读包不得直接读门的字段栏(那是第二份真相)')
  assert.doesNotMatch(src, /function parseYaml|YamlError/, '阅读包不得自带第二份策略表解析')
})

test('M5 缺契约工件 ⇒ 打印 missing 且退出码非 0(上游只打印不判,这一条就是分水岭)', () => {
  const fx = fixtureTable(BLOCK(['src/definitely-absent-7c1d9f.ts']))
  try {
    const r = run(['packages/api-client', '--policy', fx.file])
    assert.equal(r.code, 1, `缺工件必须非 0,实得 ${r.code}\n${r.out}`)
    assert.match(r.out, /missing .*src\/definitely-absent-7c1d9f\.ts/, '阅读包必须把失踪的声明式契约文件标出来')
    assert.match(r.out, /contract-artifact-missing/, '退出原因要点名规则')
    const f = run(['packages/api-client', '--policy', fx.file, '--files'])
    assert.equal(f.code, 1, '--files 形态同样要带退出码')
    assert.match(f.out, /^MISSING packages\/api-client\/src\/definitely-absent-7c1d9f\.ts$/m, f.out)
    assert.equal(JSON.parse(run(['packages/api-client', '--policy', fx.file, '--json']).out).missing.length, 1)
  } finally {
    rmScratch(fx.dir)
  }
})

test('M6 与 M5 成对:声明的契约文件真实存在 ⇒ exit 0 且不写 missing', () => {
  const fx = fixtureTable(BLOCK(['src/index.ts']))
  try {
    const r = run(['packages/api-client', '--policy', fx.file])
    assert.equal(r.code, 0, `齐备的模块不该红:\n${r.out}`)
    assert.doesNotMatch(r.out, /missing/, r.out)
    assert.match(r.out, /present +packages\/api-client\/src\/index\.ts/, r.out)
  } finally {
    rmScratch(fx.dir)
  }
})

test('M7 未齐备档:默认只报数(不造恒红门),--strict 才问责', () => {
  const fx = fixtureTable(BLOCK([]))
  try {
    const soft = run(['packages/api-client', '--policy', fx.file])
    assert.equal(soft.code, 0, `默认档把"一块工件都没有"判红就是恒红门:\n${soft.out}`)
    assert.match(soft.out, /报数\(未收口档,不计退出码/, soft.out)
    assert.match(soft.out, /missing  \(一块都没有/, soft.out)
    const strict = run(['packages/api-client', '--policy', fx.file, '--strict'])
    assert.equal(strict.code, 1, `--strict 必须按未齐备问责,实得 ${strict.code}\n${strict.out}`)
  } finally {
    rmScratch(fx.dir)
  }
})

test('M8 装车证明:判据门在 runner 上必须是 blocking + 有 skipEnv;阅读包未登记则喊"待接线"而不判失败', () => {
  const runner = readFileSync(RUNNER, 'utf8')
  const hits = gate.registrationOf(runner, 'check-architecture-policy.mjs')
  assert.equal(hits.length, 1, `守门 103 的注册块应恰好 1 个,实得 ${hits.length}`)
  const unq = (s) => (typeof s === 'string' ? s.replace(/^['"]|['"]$/g, '') : '')
  assert.equal(unq(hits[0].mode), 'blocking', '判据门被降成 warn = 新判据形同虚设')
  assert.match(unq(hits[0].skipEnv), /^HUSKY_SKIP_[A-Z_]+$/, '必须有真实紧急跳过变量')
  const self = gate.registrationOf(runner, 'module-context.mjs')
  if (!self.length) console.log('  ℹ️ 待接线:module-context.mjs 未登记为独立门(按设计只读出口,不进提交链)')
  else for (const s of self) assert.match(unq(s.skipEnv), /^HUSKY_SKIP_[A-Z_]+$/, '一旦被登记成门,就必须同时有 skipEnv')
  const pkg = JSON.parse(readFileSync(join(REPO, 'package.json'), 'utf8'))
  if (!(pkg.scripts || {})['module:context']) console.log('  ℉️ 待接线:根 package.json 尚无 "module:context" 脚本键(注册表由主会话统一改)')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
