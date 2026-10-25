#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-mobile-rn-style-parity.test.mjs — 守门(rn-parity 硬编码 hex 棘轮)的镜像测试。
 *
 * 立项起因(2026-10-16):本门此前**只挂 check:all、不进 pre-commit**,且纯磁盘读、无 face
 * discipline —— 仓规原话「判据存在而永不调用 = 没有」。本文件钉四件事:
 *   ① 取材面:源码必须走 scripts/lib/face-reader.mjs(catBatch / readWorktreeFile / selectFace),
 *     不得再 readFileSync 被审内容(守门 118 loose-fs 同族);
 *   ② 装车证明:guardian-runner 里确有本门注册块(blocking + stagedTriggers),编号**反查**、
 *     全 runner 唯一(本仓 2026-10-16 同日撞过号 214);
 *   ③ 端到端:`--self-test` 阳性对照 exit 0;HEAD 档全量 exit 0;
 *   ④ 判据同源:自检的红/绿夹具与 RULE-1 实现同出一源(不复制判据实现,§22c)。
 *
 * 取材口径:一律读**磁盘**上的源文件与 runner(镜像测试锁的是"这两份当前源码的关系");
 * 被审内容的判定面(HEAD/索引/工作树)由被测脚本自身的面档负责,不在本文件射程。
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { __test__ as gate } from '../check-mobile-rn-style-parity.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const TOOL = join(REPO, 'scripts', 'check-mobile-rn-style-parity.mjs')
const RUNNER = join(REPO, 'scripts', 'guardian-runner.mjs')
const BASELINE = join(REPO, 'scripts', 'rn-style-parity-baseline.json')

const runOpts = {
  stdio: ['ignore', 'pipe', 'pipe'],
  encoding: 'utf8',
  windowsHide: true,
  timeout: 300_000,
  maxBuffer: 64 << 20,
}

test('① 取材面:源码走 face-reader(catBatch/readWorktreeFile/selectFace),不再 readFileSync 被审内容', () => {
  const src = readFileSync(TOOL, 'utf8')
  assert.ok(src.includes("from './lib/face-reader.mjs'"), '必须从 scripts/lib/face-reader.mjs 导入')
  assert.ok(/\bcatBatch\(/.test(src), 'blob 正文必须经 catBatch 批量读(逐文件派生 = fork 风暴)')
  assert.match(src, /readWorktreeFile\(/, '工作树档必须经 readWorktreeFile(层的磁盘面出口)')
  assert.match(src, /selectFace\(/, '面旗互斥必须经 selectFace(不许自己解析后放行两面同给)')
  assert.match(src, /Undetermined/, '取不到 ⇒ Undetermined ⇒ exit 2 必须由层给出')
  assert.match(src, /FACE_LABEL\[face\]/, '结论行必须打印口径标签(FACE_LABEL)')
  // 正文抽取点不得再磁盘读被审文件 —— 词法边界:readFileSync 只允许出现在**基线 JSON**上。
  const bodyReads = [...src.matchAll(/readFileSync\s*\(([^)]*)/g)].map((m) => m[1])
  for (const arg of bodyReads) {
    assert.ok(
      /BASELINE_PATH/.test(arg),
      `readFileSync 只允许读基线 JSON,实得实参: ${arg} —— 被审内容按磁盘判 = 两头都错(见头注取材口径段)`,
    )
  }
})

test('② 装车证明:guardian-runner 注册块存在(blocking + skipEnv + stagedTriggers),编号反查且全 runner 唯一', () => {
  const lines = readFileSync(RUNNER, 'utf8').split('\n')
  const hits = lines
    .map((l, i) => ({ l, i }))
    .filter((x) => x.l.includes("script: 'check-mobile-rn-style-parity.mjs'"))
  assert.equal(hits.length, 1, `同一 script 必须恰好注册一次,实得 ${hits.length} 次`)
  const at = hits[0].i
  const block = lines.slice(Math.max(0, at - 14), at + 20).join('\n')
  // 编号**反查**不硬写(本仓 2026-10-16 撞过号:214 被 sheet-flex 先占,本门顺延)。
  const idMatch = block.match(/id:\s*'(\d+)'/)
  assert.ok(idMatch, '注册块里找不到 id —— 条目形状被改坏')
  const id = idMatch[1]
  const allIds = [...readFileSync(RUNNER, 'utf8').matchAll(/id:\s*'(\d+)'/g)].map((m) => m[1])
  assert.equal(
    allIds.filter((x) => x === id).length,
    1,
    `id ${id} 在 runner 里重复出现 —— 撞号会让两道门的结论互相冒名`,
  )
  assert.match(block, /mode: 'blocking'/, '必须 blocking(pre-commit 阻断),不许被降级成 warn/info')
  assert.match(
    block,
    /skipEnv:\s*'HUSKY_SKIP_RN_STYLE_PARITY'/,
    'skipEnv 必须新设且与脚本内 SKIP_ENV 同名(否则应急放行通道不生效)',
  )
  assert.match(
    block,
    /stagedTriggers:\s*\[[^\]]*apps\/mobile-rn\/src\//,
    '触发面必须圈住 apps/mobile-rn/src/(数组形态,漏了就等于提交链上永不执行)',
  )
  assert.match(
    block,
    /stagedTriggers:\s*\[[^\]]*rn-style-parity-baseline\.json/,
    '基线文件本身进暂存时也必须触发(防止"顺手把红写进基线"绕开复核)',
  )
  // args 不得写死 --staged:runner 的分发循环统一追加,写死会让两面同给 → 判死。
  const entry = lines.slice(Math.max(0, at - 14), at + 20).join('\n')
  const argsMatch = entry.match(/args:\s*\[([^\]]*)\]/)
  if (argsMatch) {
    assert.ok(
      !argsMatch[1].includes('--staged') && !argsMatch[1].includes('--worktree'),
      `args 不得写死面旗(由 runner 统一追加),实得: ${argsMatch[1]}`,
    )
  }
  // 源码里的 SKIP_ENV 与 runner 登记必须同名。
  const src = readFileSync(TOOL, 'utf8')
  const skipInSrc = src.match(/SKIP_ENV\s*=\s*'([^']+)'/)
  assert.ok(skipInSrc, '脚本里找不到 SKIP_ENV 定义')
  assert.equal(
    skipInSrc[1],
    'HUSKY_SKIP_RN_STYLE_PARITY',
    '脚本 SKIP_ENV 与 guardian 登记必须同名(不同名 = 应急放行设了也不生效)',
  )
})

test('③ 端到端 --self-test:阳性对照(红/绿/注释/词法边界/面旗互斥)exit 0', () => {
  const r = spawnSync(process.execPath, [TOOL, '--self-test'], runOpts)
  assert.equal(r.status, 0, `--self-test 必须 exit 0,实得 ${r.status}\n${r.stderr || r.stdout}`)
  assert.match(r.stdout, /SELF-TEST OK/, '自检通过必须打出 SELF-TEST OK(静默通过 = 没跑)')
})

test('③b 端到端 HEAD 档:全量 exit 0 且打印内容口径标签', () => {
  const r = spawnSync(process.execPath, [TOOL], runOpts)
  assert.equal(
    r.status,
    0,
    `HEAD 档全量必须 exit 0,实得 ${r.status}\n${r.stderr || r.stdout}`,
  )
  assert.match(r.stdout, /内容口径:/, '结论行必须带口径标签(读了哪一面必须自述)')
  assert.match(r.stdout, /RULE-1/, '必须走完 RULE-1 判据(短路早退 = 判据没跑)')
})

test('③c 面旗互斥:--staged --worktree 同给必须 exit 2(selectFace 出口真的在 CLI 路径上)', () => {
  const r = spawnSync(process.execPath, [TOOL, '--staged', '--worktree'], runOpts)
  assert.equal(r.status, 2, `两面同给必须判死 exit 2,实得 ${r.status}\n${r.stderr}`)
  assert.match(r.stderr, /互斥|不得同用/, '错误必须点名互斥(换个说法会让下一个人看不懂)')
})

test('④ 基线文件在位且为 JSON 对象(RULE-1 的对照面不存在时门会假绿)', () => {
  assert.ok(existsSync(BASELINE), '基线文件不存在 ⇒ 门首次运行即 FAIL,必须随门一起入库')
  const baseline = JSON.parse(readFileSync(BASELINE, 'utf8'))
  assert.equal(typeof baseline, 'object', '基线必须是对象(文件→hex 数组)')
  assert.ok(!Array.isArray(baseline), '基线不得是数组(形状漂移会让 RULE-1 全量放行)')
})

test('⑤ 源码头注与用法三面齐备(全量/ --staged / --worktree / --self-test)', () => {
  const src = readFileSync(TOOL, 'utf8')
  for (const flag of ['--staged', '--worktree', '--update-baseline', '--self-test']) {
    assert.ok(src.includes(flag), `头注/用法必须自述 ${flag}(不自述 = 没人知道逃生舱在哪)`)
  }
  assert.match(src, /exit 2/, '退出码 2「无法判定」必须在头注里自述')
})

test('⑥ import 面通道(G-239):判据从门体 __test__ 调,不在测试里复写一份', () => {
  for (const k of ['extractHexes', 'diffAgainstBaseline', 'runSelfTest', 'main'])
    assert.equal(typeof gate[k], 'function', `__test__ 缺导出 ${k}`)
  // 注释内色值不计、真字面量必收(调生产导出口)
  assert.deepEqual(gate.extractHexes("const c = '#AbC' // #fff\n/* #00ff00 */"), ['#abc'])
  // RULE-1 判据:基线外新增必红、基线内必绿
  const red = gate.diffAgainstBaseline(
    new Map([['a.tsx', new Set(['#123456'])]]),
    new Map([['a.tsx', new Set(['#abcdef'])]]),
  )
  assert.equal(red.newHits.length, 1, '基线外 hex 必须判红')
  assert.deepEqual(red.newHits[0].added, ['#123456'])
  const green = gate.diffAgainstBaseline(
    new Map([['a.tsx', new Set(['#abcdef'])]]),
    new Map([['a.tsx', new Set(['#abcdef'])]]),
  )
  assert.deepEqual(green.newHits, [], '基线内 hex 必须判绿')
  assert.equal(gate.runSelfTest(), 0, '门体自检必须仍绿(判据未被守卫改造带偏)')
})

test('⑥b import 面无 CLI 副作用:独立子进程 import 门体不打印读数、不非零退出', () => {
  const r = spawnSync(
    process.execPath,
    ['--input-type=module', '-e', `await import(${JSON.stringify(pathToFileURL(TOOL).href)});console.log('__IMPORTED__')`],
    { cwd: REPO, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], timeout: 120_000 },
  )
  assert.equal(r.status, 0, `import 门体不得非零退出:${r.stdout}${r.stderr}`)
  assert.match(r.stdout, /__IMPORTED__/, '子进程未走到哨兵行,import 可能被判死')
  assert.doesNotMatch(r.stdout, /\[check-mobile-rn-style-parity\]/, 'import 即打印门读数 ⇒ 顶层裸 main() 回来了')
})

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
