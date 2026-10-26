// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// §22c 镜像测试:判据全部 import 源脚本的 __test__,本文件不复制第二份比较逻辑。
// 本票锁四件事:① 定级形状锁 —— 只读尺子,guardian-runner 注册表与 .husky 钩子面
//    **绝不得出现本文件名**(挂进提交链即 §12e 恒红门风险);
// ② 三态判定走生产判据(有交集 exit 1 点名两侧归属与行号 / 无交集 exit 0 /
//    输入缺失 exit 2 / 坏行单列不连坐:overlap 保留、undetermined 只记坏行);
// ③ 真仓两侧权威输入可判(登记表 providerCode 枚举 + workbuddy PROVIDER 常量);
// ④ --db 失败必须落未判定 exit 2,绝不记绿,且凭据字样不落输出。
// 临时夹具唯一落点 = scripts/lib/scratch-dir.mjs(§15b)。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { __test__ as gate, probeDb } from '../check-relay-model-dual-writers.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..')

const wbSrc = (providerCode) =>
  ['// fixture', `const PROVIDER = '${providerCode}'`, 'const CONFIG_NAME = "x"'].join('\n')
const regLine = (o) => JSON.stringify(o)

test('装车形状锁(反向):guardian-runner 与 .husky 面不得出现本文件名 —— 只读尺子不接提交链', () => {
  const runner = readFileSync(join(ROOT, 'scripts', 'guardian-runner.mjs'), 'utf8')
  assert.ok(!runner.includes('check-relay-model-dual-writers'), '本尺被误接进守护巡检注册表')
  for (const f of ['pre-commit', 'pre-push', 'commit-msg']) {
    let text = ''
    try {
      text = readFileSync(join(ROOT, '.husky', f), 'utf8')
    } catch {
      continue
    }
    assert.ok(!text.includes('check-relay-model-dual-writers'), `本尺被误接进 .husky/${f}`)
  }
})

test('登记表解析:坏行单列不连坐 —— 只记自己那行,好行照常进集合', () => {
  const r = gate.parseRegistryProviders(
    [regLine({ providerCode: 'qoder', models: [{ alias: 'qoder/a' }] }), '{ 坏 JSON', regLine({ models: [] })].join(
      '\n',
    ),
  )
  assert.equal(r.providers.length, 1)
  assert.equal(r.providers[0].providerCode, 'qoder')
  assert.deepEqual(r.problems.map((p) => p.lineNo), [2, 3], '两条坏行必须逐条带行号点名')
})

test('workbuddy 侧判据:PROVIDER 常量可解析出行号与身份;缺常量 ⇒ ok:false(调用方落未判定)', () => {
  const okp = gate.parseWorkbuddyProvider(wbSrc('workbuddy'))
  assert.equal(okp.ok, true)
  assert.equal(okp.providerCode, 'workbuddy')
  assert.equal(okp.lineNo, 2, '行号即出处,必须点名常量所在行')
  assert.equal(gate.parseWorkbuddyProvider('export const SOMETHING = 1').ok, false)
})

test('三态判定(生产判据):有交集 exit 1 点名两侧;无交集 exit 0;输入缺失 exit 2', () => {
  const overlap = gate.judgeDualWriters({
    registryText: [regLine({ providerCode: 'qoder' }), regLine({ providerCode: 'workbuddy', models: [{ a: 1 }] })].join(
      '\n',
    ),
    workbuddyText: wbSrc('workbuddy'),
  })
  assert.equal(overlap.exitCode, 1)
  assert.equal(overlap.overlap.length, 1)
  assert.equal(overlap.overlap[0].providerCode, 'workbuddy')
  assert.equal(overlap.overlap[0].registry.lineNos[0], 2, '登记器侧点名登记表行号')
  assert.equal(overlap.overlap[0].workbuddy.lineNo, 2, 'workbuddy 侧点名源码行号')
  assert.equal(overlap.resultLine, `${gate.RESULT_PREFIX} overlap=1 undetermined=0`)

  const clean = gate.judgeDualWriters({
    registryText: regLine({ providerCode: 'qoder' }),
    workbuddyText: wbSrc('workbuddy'),
  })
  assert.equal(clean.exitCode, 0)
  assert.equal(clean.overlap.length, 0)

  const missing = gate.judgeDualWriters({ registryText: null, workbuddyText: wbSrc('workbuddy') })
  assert.equal(missing.exitCode, 2)
  assert.ok(missing.undetermined.some((u) => u.includes('登记表读不到')))

  const badLine = gate.judgeDualWriters({
    registryText: [regLine({ providerCode: 'workbuddy' }), '{ 坏 JSON'].join('\n'),
    workbuddyText: wbSrc('workbuddy'),
  })
  assert.equal(badLine.exitCode, 2, '坏行可能藏着 provider ⇒ 整轮未判定')
  assert.equal(badLine.overlap.length, 1, '但好行算出的交集不许被连坐抹掉')
  assert.equal(badLine.resultLine, `${gate.RESULT_PREFIX} overlap=1 undetermined=1`)
})

test('三态优先级(finalize):任一未判定压过交集,交集压过绿', () => {
  assert.equal(gate.finalize({ overlap: [], undetermined: [] }).exitCode, 0)
  assert.equal(gate.finalize({ overlap: [{ providerCode: 'x' }], undetermined: [] }).exitCode, 1)
  assert.equal(gate.finalize({ overlap: [{ providerCode: 'x' }], undetermined: ['坏'] }).exitCode, 2)
})

test('报告渲染:末行恒为机读结论;交集条目点名两侧归属', () => {
  const r = gate.judgeDualWriters({
    registryText: regLine({ providerCode: 'workbuddy', configName: 'Q 池' }),
    workbuddyText: wbSrc('workbuddy'),
  })
  const lines = gate.renderReport(r).split('\n')
  assert.equal(lines.at(-1), r.resultLine)
  assert.ok(lines.some((l) => l.includes('双路径登记') && l.includes('workbuddy')), '交集必须点名 provider')
  assert.ok(
    lines.some((l) => l.includes('登记器侧')) && lines.some((l) => l.includes('workbuddy 侧')),
    '必须同时点名两侧归属',
  )
})

test('真仓两侧权威输入可判(经生产取材层 readRepoInput):登记表枚举 ≥1 provider,workbuddy PROVIDER 常量在位', () => {
  const regText = gate.readRepoInput({ face: 'worktree', rel: gate.REGISTRY_REL }).text
  const wbText = gate.readRepoInput({ face: 'worktree', rel: gate.WORKBUDDY_REL }).text
  assert.ok(regText && wbText, '真仓工作树面两份输入必须取得到')
  const r = gate.judgeDualWriters({ registryText: regText, workbuddyText: wbText })
  assert.equal(r.undetermined.length, 0, `真仓输入必须全可判:${r.undetermined.join(' | ')}`)
  assert.ok(r.registry.providers.length >= 1)
  assert.equal(r.workbuddy.ok, true)
  assert.ok(r.workbuddy.providerCode.length > 0)
  assert.equal(r.exitCode, r.overlap.length ? 1 : 0)
})

test('--db 失败 ⇒ probeDb 返回未判定且凭据字样不落结论(非回环 host 被守卫拒绝)', async () => {
  const dir = mkScratch('dual-writers-dbtest')
  try {
    const envPath = join(dir, 'env')
    writeFileSync(envPath, 'DATABASE_URL=postgres://user:SENTINEL-SECRET@evil-host.example:5432/db\n')
    const res = await probeDb({ argv: [], env: {}, envFile: envPath, codes: ['qoder'] })
    assert.equal(res.ok, false, '--db 失败绝不折成 ok')
    assert.ok(String(res.why).includes('未判定'))
    assert.ok(!JSON.stringify(res).includes('SENTINEL-SECRET'), '凭据字样不得落结论')
  } finally {
    rmScratch(dir)
  }
})

test('CLI 退出码(runMain):默认档真仓读数与判据一致;--db 失败 exit 2;面旗互斥与未知选项 exit 2', async () => {
  const realRc = await gate.runMain([], {})
  const real = gate.judgeDualWriters({
    registryText: gate.readRepoInput({ face: 'worktree', rel: gate.REGISTRY_REL }).text,
    workbuddyText: gate.readRepoInput({ face: 'worktree', rel: gate.WORKBUDDY_REL }).text,
  })
  assert.equal(realRc, real.exitCode, 'CLI 结论必须与生产判据同值,不许两套账')
  assert.equal(await gate.runMain(['--staged', '--worktree'], {}), 2, '两判定面互斥,同给=自相矛盾⇒未判定')

  const dir = mkScratch('dual-writers-cli')
  try {
    const regPath = join(dir, 'r.jsonl')
    const wbPath = join(dir, 'w.ts')
    const envPath = join(dir, 'env')
    writeFileSync(regPath, regLine({ providerCode: 'workbuddy' }))
    writeFileSync(wbPath, wbSrc('workbuddy'))
    writeFileSync(envPath, 'DATABASE_URL=postgres://user:SENTINEL-SECRET@evil-host.example:5432/db\n')
    const dbFailRc = await gate.runMain(
      ['--registry', regPath, '--workbuddy', wbPath, '--db', '--env-file', envPath],
      {},
    )
    assert.equal(dbFailRc, 2, '--db 失败必须未判定,不得因有交集/无交集改口')
    assert.equal(await gate.runMain(['--bogus-flag'], {}), 2, '未知选项 ⇒ 用法错未判定')
  } finally {
    rmScratch(dir)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
