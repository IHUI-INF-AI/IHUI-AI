#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * restore-deploy-generated.test.mjs — 生产签出 ff 让位器 的 §22c 镜像测试
 *
 * 2026-10-19 立。判据一律 import 源文件的 `__test__`,本档不复制任何扫描实现。
 * 夹具全部现造临时仓(§15c:工作树内禁止嵌套 git 仓 ⇒ 唯一落点 mkScratch),不碰真生产签出。
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))

// 备份根必须在 import 源文件之前就钉到夹具里(源里 BACKUP_ROOT 是模块级读 env)
const base = mkScratch('restore-deploy-generated')
process.env.IHUI_DEPLOY_GENERATED_BACKUP = join(base, 'backups')
const { __test__: T } = await import('../restore-deploy-generated.mjs')

const git = (args, cwd) =>
  execFileSync('git', ['-c', 'safe.directory=*', ...args], {
    cwd,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 60_000,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

const REG_EMPTY = JSON.stringify({ paths: [] })
// 空清单会走"判死"早退(⑦ 专测那一档),其余用例必须给一份**非空但与本夹具无关**的清单,
// 否则测的是早退分支而不是扫描逻辑(这条早退本身是 §0.3 要求的,不能为了测试把它摘掉)。
const REG_UNRELATED = JSON.stringify({
  paths: [{ path: 'monitoring/grafana/dashboards/fixture.json', untrackedCollide: true, reason: '夹具占位:让清单非空' }],
})
const A_BYTES = 'export const A = 1\n'
const B_BYTES = 'export const B = 2\n'

/**
 * 造一枚"tip 已跟踪、当前检出面是未跟踪影子"的临时仓:
 *   main 只有一个 README ⇒ tip 分支上加 a.txt/b.txt ⇒ 回到 main 后按原字节重建 a.txt、
 *   用**不同**字节重建 b.txt。这样 a.txt 是零信息损失的影子,而 b.txt 内容会真的不一样。
 */
function fixture() {
  const repo = join(base, `repo-${Math.random().toString(36).slice(2, 8)}`)
  mkdirSync(repo, { recursive: true })
  git(['init', '-q', '-b', 'main'], repo)
  git(['-c', 'user.name=t', '-c', 'user.email=t@e', 'commit', '-q', '--no-verify', '--allow-empty', '-m', 'base'], repo)
  writeFileSync(join(repo, 'a.txt'), A_BYTES, 'utf8')
  writeFileSync(join(repo, 'b.txt'), B_BYTES, 'utf8')
  git(['add', 'a.txt', 'b.txt'], repo)
  git(['-c', 'user.name=t', '-c', 'user.email=t@e', 'commit', '-q', '--no-verify', '-m', 'tip adds both'], repo)
  git(['branch', 'tip'], repo)
  git(['checkout', '-q', 'HEAD^'], repo)
  writeFileSync(join(repo, 'a.txt'), A_BYTES, 'utf8') // 与 tip 同一枚 blob
  writeFileSync(join(repo, 'b.txt'), 'export const B = 999 // 内容漂开\n', 'utf8') // 不同 blob
  return repo
}

const planOf = (repo, registryText = REG_UNRELATED) => T.planGeneratedYield(repo, registryText, { ref: 'tip' })
const act = (plan, rel) => plan.actions.find((a) => a.rel === rel)

test('① 内容与 tip 同一枚 blob 的未跟踪影子 ⇒ 免登记也让位(停摆不能等"有人想到去登记")', () => {
  const repo = fixture()
  const plan = planOf(repo)
  const a = act(plan, 'a.txt')
  assert.ok(a, `夹具里 a.txt 必须进让位计划(实得 ${JSON.stringify(plan.actions.map((x) => x.rel))})`)
  assert.equal(a.tier, 'untracked-collides-tip')
  assert.match(a.action, /同一枚 blob/, `同内容必须写明"零信息损失"这一档(实得 ${a.action})`)
  assert.ok(a.backup, '让位前必须有逐字节备份落点')
})

test('② 反向对照(成对夹具的另一臂):内容与 tip 漂开且清单未授权 ⇒ 照旧不动、且把 blocked 立起来', () => {
  const repo = fixture()
  const plan = planOf(repo)
  const b = act(plan, 'b.txt')
  assert.ok(b, '夹具失效:b.txt 没进计划')
  assert.match(b.action, /不动\(清单未授予 untrackedCollide/, `内容不同就不得免登记(实得 ${b.action})`)
  assert.equal(plan.blocked, true, '有一枚"漂开且未授权"的影子却不 blocked ⇒ 判据把"没授权"读成了"没问题"')
})

test('③ 只在本仓独有的未跟踪文件(.tip 里没有同名路径)一律 HANDS-OFF,不与影子档混桶', () => {
  const repo = fixture()
  writeFileSync(join(repo, 'c.txt'), 'mine only\n', 'utf8')
  const plan = planOf(repo)
  assert.equal(act(plan, 'c.txt').tier, 'untracked-unique')
  assert.equal(act(plan, 'c.txt').action, 'HANDS-OFF')
})

test('④ 封闭清单原有的逐条授权档不被新例外顶掉(授权过而内容漂开的仍让位)', () => {
  const repo = fixture()
  const plan = planOf(
    repo,
    JSON.stringify({ paths: [{ path: 'b.txt', untrackedCollide: true, reason: '夹具:已显式授权' }] }),
  )
  assert.match(act(plan, 'b.txt').action, /备份后让位/)
})

test('⑤ 端到端 --apply 的落盘语义:影子被备份后移除,漂开那份留在盘上(证明"备份失败即不动"不是空话)', () => {
  const repo = fixture()
  const plan = planOf(repo)
  const r = T.applyGeneratedYield(repo, plan)
  assert.ok(!existsSync(join(repo, 'a.txt')), '同内容影子应已被让位(合进来的就是同一枚字节)')
  assert.ok(existsSync(join(repo, 'b.txt')), '内容漂开且未授权的那份必须还在 —— 让位器不是 rm -rf')
  const backed = Object.keys(r.done || {})
  assert.ok(
    existsSync(plan.actions.find((a) => a.rel === 'a.txt').backup),
    `a.txt 的备份件必须真在盘上(落点清单:${backed.join('|') || '空'})`,
  )
  assert.equal(readFileSync(plan.actions.find((a) => a.rel === 'a.txt').backup, 'utf8'), A_BYTES)
})

test('⑥ 取材非空锁:夹具造出三型状态时计划里必须≥3 条(解析失效不得被读成"无事可做")', () => {
  const repo = fixture()
  writeFileSync(join(repo, 'c.txt'), 'mine only\n', 'utf8')
  const plan = planOf(repo)
  assert.ok(plan.actions.length >= 3, `只解析到 ${plan.actions.length} 条状态 ⇒ git 口径漂了,判据失明`)
})

test('⑦ 清单为空 ⇒ 判死点名,不记绿(§0.3);而 tip 取不到时一律不得产出"让位"', () => {
  const repo = fixture()
  assert.match(T.planGeneratedYield(repo, REG_EMPTY, { ref: 'tip' }).fatal || '', /枚举到 0|清单为空/, '空清单必须拒绝判定')
  const noTip = T.planGeneratedYield(
    repo,
    JSON.stringify({ paths: [{ path: 'a.txt', untrackedCollide: true, reason: 'x' }] }),
    { ref: 'refs/heads/不存在' },
  )
  assert.ok(noTip.actions.length > 0, `tip 不存在时状态扫描仍应如实报数(实得 ${JSON.stringify(noTip.actions)})`)
  for (const a of noTip.actions) {
    assert.doesNotMatch(a.action, /让位/, `tip 取不到却写让位 = 拿不存在的版本当依据(${a.rel})`)
  }
})

test('⑧ 形状锁:同内容那一档的比较必须走 oid,不得拿"字节数相同"冒充内容相同', () => {
  const src = readFileSync(join(HERE, '..', 'restore-deploy-generated.mjs'), 'utf8')
  const body = src.slice(src.indexOf('export function planGeneratedYield'), src.indexOf('export function applyGeneratedYield'))
  assert.ok(body.length > 800, '函数体取形失败 ⇒ 本条无牙')
  assert.match(body, /hash-object/, '必须用 hash-object 量盘上那份的 blob oid')
  assert.match(body, /rev-parse/, '必须用 rev-parse 量 tip 那一份的 blob oid')
  assert.doesNotMatch(body, /\.size/, '按体积判同内容 = 同名同大小不同字节的假配对(本仓反复踩过)')
})

process.on('exit', () => {
  try {
    rmScratch(base)
  } catch {
    /* Windows 偶发句柄占用:临时目录自清 */
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
