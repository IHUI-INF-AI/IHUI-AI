// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// T1 提速夹具(2026-11-07):并发跑包不能吃掉错误、不能漏包、不能把优先级写死。
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  countErrorTS,
  discoverTypecheckProjects,
  poolMap,
  resolveConcurrency,
  runTypecheckProjects,
  topoLayers,
} from '../lib/typecheck-concurrent.mjs'

const TMP = mkdtempSync(join(tmpdir(), 'ihui-tc-'))
process.on('exit', () => {
  try {
    rmSync(TMP, { recursive: true, force: true })
  } catch {
    /* 临时目录清理失败不影响结论 */
  }
})

const CHILD = join(TMP, 'child.cjs')
writeFileSync(
  CHILD,
  `const fs=require('node:fs');const path=require('node:path');
const dir=process.cwd();const p=JSON.parse(fs.readFileSync(path.join(dir,'payload.json'),'utf8'));
setTimeout(()=>{if(p.stdout)process.stdout.write(p.stdout);if(p.stderr)process.stderr.write(p.stderr);process.exit(p.code)},p.delay);
`,
)

function makeProject(name, payload) {
  const dir = join(TMP, name)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'payload.json'), JSON.stringify(payload))
  return { name, dir, command: `node "${CHILD}"`, args: [] }
}

test('C1 并发池上限被守住,且确实发生了重叠(上限写死的反向证明)', async () => {
  let active = 0
  let maxActive = 0
  const results = await poolMap([1, 2, 3, 4, 5, 6], 3, async (n) => {
    active++
    maxActive = Math.max(maxActive, active)
    await new Promise((r) => setTimeout(r, 40))
    active--
    return n
  })
  assert.deepEqual(results, [1, 2, 3, 4, 5, 6], '所有任务都必须有结果,不许漏项')
  assert.equal(maxActive, 3, '并发度必须达到上限(若为 1 说明退化成串行)')
  assert.ok(!results.some((r) => r?.error), '不应有任务抛错')
})

test('C2 一个包失败不得中断其它包;每包 rc 与 error TS 原文完整保留', async () => {
  const out = []
  const err = []
  const projects = [
    makeProject('ok-pkg', { delay: 100, code: 0, stdout: 'ok-pkg: clean\n' }),
    makeProject('bad-a', {
      delay: 700,
      code: 2,
      stdout: 'src/a.ts(1,1): error TS1001: alpha\nsrc/a.ts(2,2): error TS1002: beta\n',
      stderr: 'note: keep-this-line\n',
    }),
    makeProject('bad-b', { delay: 400, code: 1, stdout: 'src/b.ts(9,9): error TS2001: gamma\n' }),
  ]
  const started = Date.now()
  const r = await runTypecheckProjects({
    projects,
    concurrency: 3,
    root: TMP,
    out: (s) => out.push(s),
    err: (s) => err.push(s),
    writeStdout: (s) => out.push(s),
    writeStderr: (s) => err.push(s),
  })
  const elapsed = Date.now() - started
  assert.equal(r.ok, false, '有包失败必须整体判红')
  assert.equal(r.results.length, 3, '失败不得导致漏包')
  assert.equal(r.results.find((x) => x.name === 'ok-pkg').rc, 0)
  assert.equal(r.results.find((x) => x.name === 'bad-a').rc, 2, 'rc 必须原样保留')
  assert.equal(r.results.find((x) => x.name === 'bad-b').rc, 1, 'rc 必须原样保留')
  assert.equal(countErrorTS(r.results.map((x) => `${x.stdout}${x.stderr}`).join('\n')), 3)
  const allOut = `${out.join('\n')}\n${err.join('\n')}`
  for (const needle of [
    'error TS1001: alpha',
    'error TS1002: beta',
    'error TS2001: gamma',
    'note: keep-this-line',
  ]) {
    assert.ok(allOut.includes(needle), `错误原文被吞/被截断:${needle}`)
  }
  assert.equal(err.join('\n').includes('bad-a(rc=2)'), true, '失败清单必须点名包与 rc')
  // 路径前缀必须与 pnpm -r 同形,否则 check-typecheck 的降级判据会把 `src/a.ts` 解析到仓根。
  assert.ok(allOut.includes('bad-a: src/a.ts(1,1): error TS1001: alpha'), '丢了 pnpm -r 的包目录前缀')
  assert.ok(allOut.includes('bad-a: note: keep-this-line'), 'stderr 也要带前缀')
  // 完成顺序 = 延时顺序,而不是提交顺序:证明三个包真的同时在飞。
  const order = out
    .filter((line) => line.includes('完成 rc='))
    .map((line) => /──── [^\s]+ (\S+) 完成/.exec(line)?.[1])
    .filter(Boolean)
  assert.deepEqual(order, ['ok-pkg', 'bad-b', 'bad-a'], `完成顺序应体现并发,实际 ${order.join('→')}`)
  const serialSum = r.results.reduce((s, x) => s + x.ms, 0)
  assert.ok(elapsed < serialSum, `未见并发(墙钟 ${elapsed}ms ≥ 逐项耗时和 ${serialSum}ms)`)
})

test('C3 并发上限由核数/内存推导,不写死;env 只做显式覆盖', () => {
  const a = resolveConcurrency({ cpuCount: 20, totalMemBytes: 30 * 1024 ** 3, env: {} })
  assert.equal(a.limit, 13, '20 核 / 30GB 应得 13(内存维先到限)')
  assert.match(a.basis, /逻辑核 20/)
  assert.match(a.basis, /内存/)
  const b = resolveConcurrency({ cpuCount: 4, totalMemBytes: 8 * 1024 ** 3, env: {} })
  assert.equal(b.limit, 2, '4 核 / 8GB 应得 2(内存维)')
  const c = resolveConcurrency({ cpuCount: 2, totalMemBytes: 64 * 1024 ** 3, env: {} })
  assert.equal(c.limit, 1, '2 核留 1 核 ⇒ 1')
  const d = resolveConcurrency({ cpuCount: 20, totalMemBytes: 64 * 1024 ** 3, env: { IHUI_TYPECHECK_CONCURRENCY: '5' } })
  assert.equal(d.limit, 5, 'env 显式覆盖必须生效')
  assert.match(d.basis, /env IHUI_TYPECHECK_CONCURRENCY=5/)
})

test('C4 重建按 workspace 依赖拓扑分层:被依赖包必须在前一层', () => {
  const graph = new Map([
    ['@ihui/types', new Set()],
    ['@ihui/api-client', new Set(['@ihui/types'])],
    ['@ihui-ai/sdk', new Set(['@ihui/types', '@ihui/api-client'])],
    ['@ihui/shared', new Set(['@ihui/api-client', '@ihui/types'])],
  ])
  const { layers, cycle } = topoLayers(['@ihui-ai/sdk', '@ihui/shared', '@ihui/api-client', '@ihui/types'], graph)
  assert.equal(cycle.length, 0)
  assert.deepEqual(layers[0], ['@ihui/types'], '无依赖包先建')
  assert.ok(layers[1].includes('@ihui/api-client'))
  assert.ok(layers.at(-1).includes('@ihui-ai/sdk'), 'sdk 必须在 types 之后的层')
  // 反向对照:旧串行按字典序会把 sdk 排到 types 前面 —— 这里必须不出现。
  const flat = layers.flat()
  assert.ok(flat.indexOf('@ihui/types') < flat.indexOf('@ihui-ai/sdk'))
})

test('C5 成环不得死循环:整体并入一层并显式报环', () => {
  const graph = new Map([
    ['a', new Set(['b'])],
    ['b', new Set(['a'])],
  ])
  const { layers, cycle } = topoLayers(['a', 'b'], graph)
  assert.deepEqual(cycle.sort(), ['a', 'b'])
  assert.equal(layers.length, 1)
})

test('C6 包发现只收带非空 typecheck 脚本的 workspace 包', () => {
  const root = join(TMP, 'ws')
  mkdirSync(join(root, 'apps', 'one'), { recursive: true })
  mkdirSync(join(root, 'apps', 'empty'), { recursive: true })
  mkdirSync(join(root, 'packages', 'pkg'), { recursive: true })
  writeFileSync(join(root, 'apps', 'one', 'package.json'), JSON.stringify({ name: 'app-one', scripts: { typecheck: 'tsc --noEmit' } }))
  writeFileSync(join(root, 'apps', 'empty', 'package.json'), JSON.stringify({ name: 'app-empty', scripts: { typecheck: '  ' } }))
  writeFileSync(join(root, 'packages', 'pkg', 'package.json'), JSON.stringify({ name: '@ihui/pkg', scripts: { typecheck: 'tsc --noEmit' } }))
  const found = discoverTypecheckProjects(root)
  assert.deepEqual(found.map((p) => p.name).sort(), ['@ihui/pkg', 'app-one'])
  assert.match(found.find((p) => p.name === '@ihui/pkg').command, /^pnpm --filter @ihui\/pkg run typecheck$/)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
