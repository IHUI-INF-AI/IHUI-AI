// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 守门 90(check-sse-dispatch-parity.mjs)的 §22c 镜像测试(PROJECT_PLAN D107 ① 装车票)。
// 覆盖四件事,缺一即本票不成立:
//   ① 判据本身有效(注入违规必红)—— 且**不靠改真台账文件**做注入,用真数据 + 抽走一个命中;
//   ② 真仓当前结论为绿(台账与 HEAD 实测逐字对得上);
//   ③ **装车证明**:guardian-runner 里确实注册了这道门、且编号在本仓唯一(§22c「造好没装车」教训);
//   ④ 取材基准是 HEAD 而不是工作树 —— 这是本票补的那处结构缺陷,回归会把它悄悄改回去。

import { execFileSync } from 'node:child_process'
import { copyFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  collectHitMap,
  evaluateDispatchParity,
  extractCallbackNames,
  readFrameSource,
  resolveFrameCallbacks,
} from '../check-sse-dispatch-parity.mjs'
import { resolveGitBin } from '../lib/gitdir.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const RUNNER = join(REPO, 'scripts', 'guardian-runner.mjs')
const LEDGER = join(REPO, 'scripts', 'data', 'sse-dispatch-coverage.json')
const GIT_BIN = resolveGitBin() || 'git'

/** 用临时索引跑 git —— 绝不动共享工作区的主索引(多会话同用一个 .git) */
function gitRun(args, env) {
  return execFileSync(GIT_BIN, ['-c', 'safe.directory=*', '-C', REPO, ...args], {
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 32 * 1024 * 1024,
    timeout: 120000,
    env,
  })
}

/** 主索引的真实路径(.git 可能是指针文件,故问 git 自己而不是拼字符串) */
function resolveGitIndex() {
  const gitdir = gitRun(['rev-parse', '--absolute-git-dir']).trim()
  return join(gitdir, 'index')
}

const realData = () => JSON.parse(readFileSync(LEDGER, 'utf8'))

test('① 出口齐备(§22c 锚点)', () => {
  for (const fn of [
    extractCallbackNames,
    resolveFrameCallbacks,
    evaluateDispatchParity,
    collectHitMap,
    readFrameSource,
  ]) {
    assert.equal(typeof fn, 'function', '存在未导出的核心函数')
  }
})

test('② 真仓:HEAD 实测与台账精确一致(判据在真数据上为绿)', () => {
  const data = realData()
  const { source, error } = readFrameSource()
  assert.equal(error, null, `帧清单取材失败:${error}`)
  const known = extractCallbackNames(source)
  const callbacks = resolveFrameCallbacks(source, data.toolCallbacks)
  assert.ok(callbacks.length >= 20, `帧清单只有 ${callbacks.length} 个,提取疑似失效`)
  const hit = collectHitMap(data, callbacks)
  const result = evaluateDispatchParity({ hit, callbacks, known, data })
  assert.deepEqual(result.errors, [], '真仓判定不应有红项')
  assert.deepEqual(result.warnings, [], '真仓不应留 baseline 待上调的警告(增长后必须同票上调)')
  assert.equal(result.ok, true)
})

test('③ 注入违规:抽走一个端的一个命中必须判红(红因是"静默丢弃")', () => {
  const data = realData()
  const { source } = readFrameSource()
  const known = extractCallbackNames(source)
  const callbacks = resolveFrameCallbacks(source, data.toolCallbacks)
  const hit = collectHitMap(data, callbacks)
  // 从 cli 端拿走它确实命中的第一帧 ⇒ 该帧变成"实测未命中且未登记",即本门要抓的原始形态
  const cliHit = [...hit['cli']]
  assert.ok(cliHit.length > 0, 'cli 端零命中,注入样本无从取')
  const removed = cliHit.sort()[0]
  hit['cli'] = new Set(cliHit.filter((c) => c !== removed))
  const result = evaluateDispatchParity({ hit, callbacks, known, data })
  assert.equal(result.ok, false, `抽走 ${removed} 后仍判绿 ⇒ 判据空转`)
  assert.ok(
    result.errors.some((e) => e.includes('静默丢弃') && e.includes(removed)),
    `红项未点名被抽走的帧 ${removed}`,
  )
})

test('④ 注入违规:baseline 抬高 1 必须判红(ratchet 真的咬住)', () => {
  const data = realData()
  const { source } = readFrameSource()
  const known = extractCallbackNames(source)
  const callbacks = resolveFrameCallbacks(source, data.toolCallbacks)
  const hit = collectHitMap(data, callbacks)
  const bumped = { ...data, baseline: { ...data.baseline, web: data.baseline.web + 1 } }
  const result = evaluateDispatchParity({ hit, callbacks, known, data: bumped })
  assert.equal(result.ok, false, 'baseline 抬高一格仍判绿 ⇒ ratchet 未生效')
  assert.ok(result.errors.some((e) => e.includes('低于 baseline')))
})

test('⑤ 取材基准是提交树,不是工作树(pre-commit 须切暂存区,否则同票推进被自己卡死)', () => {
  const src = readFileSync(join(REPO, 'scripts', 'check-sse-dispatch-parity.mjs'), 'utf8')
  // 帧清单与命中侧都走 git,且两侧同一修订
  assert.match(src, /git\(\['show',\s*spec\]\)/u, '帧清单未走 git show')
  assert.match(src, /basis === 'index' \? '' : 'HEAD'/u, "帧清单未支持 'index' 修订")
  assert.match(src, /'grep',\s*'--cached',\s*'-o',\s*'-E',\s*alt/u, '暂存区口径的 --cached 未放在模式串之前')
  assert.match(src, /argv\.includes\('--staged'\) \? 'index' : 'head'/u, 'pre-commit 模式未切到暂存区')
  assert.ok(
    !/readFileSync\(\s*API_CLIENT_FILE/u.test(src),
    '帧清单又改回读工作树的 client.ts —— 命中侧读提交树、清单侧读工作树会让未提交的新帧把五端一起判红',
  )
})

test('⑤b 暂存区口径实跑:budget 一族的端内接线进临时索引后门必须判绿(代码与台账同票)', () => {
  // 清单 = 本族"端内注册层"改动的全集。**少列一个端不会让本例假绿** —— 临时索引里
  // 该端仍是 HEAD 的旧命中数,低于台账 baseline 即判红,失效方式是响的。
  // 再有端接入 budget 时把它加进来(以及 --staged 的 baseline 同票上调)。
  const TICKET_FILES = [
    'scripts/data/sse-dispatch-coverage.json',
    'packages/shared/src/chat/budget-note.ts',
    'packages/shared/src/chat/index.ts',
    'apps/cli/src/commands/task-status-line.ts',
    'apps/cli/src/commands/agent.ts',
    'apps/cli/src/commands/repl.ts',
    'apps/mobile-rn/src/utils/budget-note.ts',
    'apps/mobile-rn/src/screens/AiAssistantN8nScreen.tsx',
  ]
  const tmpIndex = join(tmpdir(), `ihui-sse-idx-${process.pid}-${Date.now()}`)
  copyFileSync(resolveGitIndex(), tmpIndex)
  const env = { ...process.env, GIT_INDEX_FILE: tmpIndex }
  try {
    for (const p of TICKET_FILES) gitRun(['add', '--', p], env)
    const out = execFileSync(
      process.execPath,
      [join(REPO, 'scripts', 'check-sse-dispatch-parity.mjs'), '--staged'],
      { encoding: 'utf8', windowsHide: true, timeout: 120000, env },
    )
    assert.match(out, /守门通过/u, `暂存区口径未判绿:${out}`)
  } finally {
    rmSync(tmpIndex, { force: true })
  }
})

test('⑥ 台账卫生:groups 里不得留无人引用的分组(登记项不得变墓志铭)', () => {
  const data = realData()
  const referenced = new Set(Object.values(data.missing ?? {}).flatMap((m) => Object.values(m)))
  const orphan = Object.keys(data.groups ?? {}).filter((g) => !referenced.has(g))
  assert.deepEqual(
    orphan,
    [],
    `分组 ${orphan.join(', ')} 已无端引用,应删除(留着就是在替已实现的功能喊 WONTFIX)`,
  )
})

/**
 * 从 runner 反查本门注册块 —— **不硬写编号**。
 * 硬写 id 的断言在并发重排号时会二选一失效:要么把在位的门判成"没装车",
 * 要么更糟 —— 悄悄通过(编号被人挪走而块还在)。今天本仓就为此撞了三次号(85→90→91→92)。
 */
function findOwnBlock(runnerSrc) {
  const blocks = [...runnerSrc.matchAll(/^ {2}\{[\s\S]*?^ {2}\},/gmu)]
  const own = blocks.find((m) => /script:\s*'check-sse-dispatch-parity\.mjs'/u.test(m[0]))
  return own ? own[0] : null
}

test('⑦ 装车证明:runner 里有本门注册块且为 blocking(编号从文件反查)', () => {
  const runner = readFileSync(RUNNER, 'utf8')
  const block = findOwnBlock(runner)
  assert.ok(block, '未找到 check-sse-dispatch-parity.mjs 的注册块 —— 脚本存在但没接上守门链等于没有闸')
  assert.match(block, /mode:\s*'blocking'/u)
  assert.match(block, /skipEnv:\s*'HUSKY_SKIP_SSE_DISPATCH_PARITY'/u)
  assert.match(block, /stagedTriggers:/u, '缺 stagedTriggers ⇒ 每次提交全量跑,拖慢提交链会逼人 --no-verify')
})

test('⑧ 编号唯一:本门所用的 id 在 runner 中必须恰好出现一次(并发抢号教训)', () => {
  const runner = readFileSync(RUNNER, 'utf8')
  const block = findOwnBlock(runner)
  assert.ok(block, '找不到本门注册块')
  const ownId = (block.match(/id:\s*'([^']+)'/u) || [])[1]
  assert.ok(ownId, '本门注册块里没有 id 字段')
  const ids = [...runner.matchAll(/^\s{4}id:\s*'([^']+)'/gmu)].map((m) => m[1])
  assert.ok(ids.length > 80, `只解析到 ${ids.length} 个 id,缩进锚点疑似失效`)
  const hits = ids.filter((x) => x === ownId).length
  assert.equal(hits, 1, `id ${ownId} 出现 ${hits} 次 —— 同 id 两道门会串 skipEnv 与失败归属,后来者必须改号`)
})

test('⑨ --self-test 入口可用且全绿', () => {
  const out = execFileSync(
    process.execPath,
    [join(REPO, 'scripts', 'check-sse-dispatch-parity.mjs'), '--self-test'],
    {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 120000,
    },
  )
  assert.match(out, /\[self-test\] (\d+)\/\1 通过/u, '自测未全绿')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
