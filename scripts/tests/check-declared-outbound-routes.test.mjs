// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 镜像测试:scripts/check-declared-outbound-routes.mjs(§22c 模式 —— 测试**直接 import 源脚本的
 * `__test__`**,不在这里复制第二份判据;判据本体住在 scripts/lib/outbound-route-{facts,registrations}.mjs)。
 *
 * 与 --self-test 的分工:自检打构造面与真语料(纯内存 + 只读),本文件打**CLI 契约**与**取材面**——
 * 临时 git 仓里造"索引 ≠ HEAD ≠ 磁盘"的三面现场,证明默认档真在判 HEAD blob、--staged 真在判索引 blob,
 * 以及"两面旗同给 / 无提交"都判死而不是记绿。
 *
 * 一条方向性对照(T1)钉住"接线必须成套":本门已由主会话接进 guardian-runner,
 * 所以它要求 `mode: 'blocking'` 与 `skipEnv` 同时在场 —— 只接一半(比如漏 skipEnv)比不接更危险,
 * 因为判据红的时候没有人能正当脱身,唯一结局是各会话跳门并连带废掉全部守门。
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { test } from 'node:test'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

import { GIT_BIN, runGate, writeRepo } from './helpers/outbound-routes-fixtures.mjs'

test('T1 接线成套性:未接则放过,已接则必须 blocking + skipEnv 齐备', () => {
  const runner = readFileSync(new URL('../guardian-runner.mjs', import.meta.url), 'utf8')
  const wired = runner.includes('check-declared-outbound-routes.mjs')
  if (!wired) return
  // 一旦被接线(主会话的权限),必须同时是 blocking 且有应急跳过通道 —— 缺一即红。
  // 注:runner 的定级字段是 `mode: 'blocking'`,不是 `blocking: true` —— 按 runner 的真实 schema 判,
  // 否则这条断言会在**已正确接线**的提交上恒红(判据错 ≠ 交付缺陷)。
  const block = /check-declared-outbound-routes\.mjs[\s\S]{0,600}?mode:\s*'blocking'/.test(runner)
  const skip = runner.includes('HUSKY_SKIP_DECLARED_OUTBOUND_ROUTES')
  if (!block || !skip)
    throw new Error(`接线不完整: blocking=${block} skipEnv=${skip}(半接线比不接更危险)`)
})

test('T2 默认档判 HEAD blob:索引与磁盘都被别人改脏也不得跟着走', () => {
  const dir = mkScratch('outbound-face-')
  try {
    writeRepo(dir)
    // 索引里把声明删掉、盘上再改成另一条 —— 两面都与 HEAD 不同
    writeFileSync(
      `${dir}/apps/ai-service/app/services/hub.py`,
      'x = 1  # 别人把声明删了\n',
      'utf8',
    )
    execFileSync(GIT_BIN, ['-C', dir, 'add', 'apps/ai-service/app/services/hub.py'], { windowsHide: true })
    writeFileSync(`${dir}/apps/ai-service/app/services/hub.py`, 'y = 2  # 盘上又是另一份\n', 'utf8')
    const head = runGate(dir, [])
    const staged = runGate(dir, ['--staged'])
    if (head.code !== 0) throw new Error(`HEAD 面默认档应 exit 0,实得 ${head.code}:${head.out}`)
    if (!/未匹配 1/.test(head.out)) throw new Error(`HEAD 面必须仍报那 1 条未匹配:${head.out}`)
    if (!/未匹配 0/.test(staged.out)) throw new Error(`--staged 应看到索引里声明已被删 ⇒ 0:${staged.out}`)
  } finally {
    rmScratch(dir)
  }
})

test('T3 两面旗同给 ⇒ exit 2(不得任选一面冒充判定)', () => {
  const dir = mkScratch('outbound-flags-')
  try {
    writeRepo(dir)
    const r = runGate(dir, ['--staged', '--worktree'])
    if (r.code !== 2) throw new Error(`期望 exit 2,实得 ${r.code}:${r.out}`)
    if (!/无法判定/.test(r.out)) throw new Error(`必须喊"无法判定"而不是静默挑一面:${r.out}`)
  } finally {
    rmScratch(dir)
  }
})

test('T4 无提交可判 ⇒ exit 2,不得记成"没有违规"', () => {
  const dir = mkScratch('outbound-empty-')
  try {
    // 装好门与夹具文件,但**不提交** ⇒ HEAD 面取不到。此时候选声明一条都读不到,
    // 那是"判不了"不是"没有违规";记绿会让这道门在 CI 上永远绿灯。
    writeRepo(dir, { commit: false })
    const r = runGate(dir, [])
    if (r.code !== 2) throw new Error(`空仓上必须判死,实得 ${r.code}:${r.out}`)
    if (!/无法判定/.test(r.out)) throw new Error(`必须喊"无法判定":${r.out}`)
  } finally {
    rmScratch(dir)
  }
})

test('T5 strict 才有退出码 1:默认档判同一批但不拦提交(防恒红门)', () => {
  const dir = mkScratch('outbound-strict-')
  try {
    writeRepo(dir)
    const loose = runGate(dir, [])
    const strict = runGate(dir, ['--strict'])
    if (loose.code !== 0) throw new Error(`默认档应 0,实得 ${loose.code}`)
    if (strict.code !== 1) throw new Error(`--strict 应 1,实得 ${strict.code}:${strict.out}`)
    if (!/hub\.py/.test(strict.out)) throw new Error(`--strict 必须点名文件与行号:${strict.out}`)
  } finally {
    rmScratch(dir)
  }
})

test('T6 取材面纪律形状锁:必须引 face-reader 且真用 catBatch 读内容(门 118 的半接线型)', () => {
  const src = readFileSync(new URL('../check-declared-outbound-routes.mjs', import.meta.url), 'utf8')
  if (!/from '\.\/lib\/face-reader\.mjs'/.test(src)) throw new Error('未引 face-reader')
  if (!/catBatch\(/.test(src)) throw new Error('未走层的读取入口 catBatch ⇒ 属半接线')
  if (/execFileSync\(\s*['"]git['"]/.test(src) || /git show/.test(src))
    throw new Error('守门脚本里不得自己派生 git 读内容')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
