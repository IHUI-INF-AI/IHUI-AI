// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `scripts/deploy-lock.mjs` 的镜像测试 —— G-696(2026-09-29):部署锁 release 必须比对 owner token。
 *
 * 票面口径:旧实现"CLI acquire/release 不同进程,按 mode 匹配即视为可释放" ⇒ **同 mode 的
 * 第二条 CLI 能删掉第一条正在用的锁**(悬挂锁代为收口那条路,predev 父 shell 先退、pid 被复用
 * 都是现成入口)。现口径:带 token 的锁必须凭同一 token 才许释放;不匹配(**含根本没带**)
 * ⇒ 拒绝、点名、锁原样在位 —— 绝不静默成功;旧格式锁(meta 无 token 字段)⇒ 归属无法核验,
 * 按既有判据处置并报名"无凭据"(与 host/pidStart 缺失同一纪律)。
 *
 * §22c:判据住在源脚本,本文件只 import `__test__`,不复制第二份判据实现。
 * 真机零副作用:夹具全部走 `mkScratch()`(仓库树外),归档面在任何用例**之前**指进夹具;
 * 环境变量 `IHUI_DEPLOY_LOCK_TOKEN` 必须先清掉 —— 它是 release 的合法凭据来源之一,
 * 留着会让"不匹配 ⇒ 拒绝"那几条变成环境彩票。
 */
import { spawnSync } from 'node:child_process'
import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { __test__ as L } from '../deploy-lock.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const SCRIPT = resolve(HERE, '..', 'deploy-lock.mjs')

// 必须在任何会触发归档的用例之前设置(同 deploy-lock.test.mjs 的红线)
const ARCHIVE_BASE = mkScratch('deploy-lock-token-archive-')
process.env.IHUI_DEPLOY_LOCK_ARCHIVE_DIR = join(ARCHIVE_BASE, 'scene')
// release 的合法凭据来源必须从环境里摘掉,否则负向用例(不匹配 ⇒ 拒绝)拿到的是环境彩票
delete process.env.IHUI_DEPLOY_LOCK_TOKEN
after(() => rmScratch(ARCHIVE_BASE))

/** 已确定不存在的 pid(现查现用,不写死 —— 写死的会在别的机器上复活) */
function deadPid() {
  for (let p = 999_000; p < 1_200_000; p += 17) {
    if (!L.isProcessAlive(p)) return p
  }
  throw new Error('夹具需要一个确定已死的 pid,但未找到')
}

/** 建一个"锁目录"(只建夹具内路径,永不碰真实项目根的 .deploy.lock) */
function lockFixture(base, metaObj) {
  const dir = join(base, `lock-${Math.random().toString(36).slice(2, 8)}`)
  mkdirSync(dir, { recursive: true })
  if (metaObj !== undefined) {
    writeFileSync(join(dir, 'meta.json'), JSON.stringify(metaObj), 'utf8')
  }
  return dir
}

const TOKEN = 'g696-token-holder-credential'
const TOKEN_OTHER = 'g696-token-somebody-else-xxx'

test('acquire 写下的锁必带 owner token,且各把锁各持各的凭据(不是常量)', async () => {
  const base = mkScratch('dl-token-write-')
  try {
    const dA = join(base, 'lock-a')
    const dB = join(base, 'lock-b')
    assert.equal(await L.acquire({ mode: 'build', timeoutMs: 3000, dir: dA }), true)
    assert.equal(await L.acquire({ mode: 'build', timeoutMs: 3000, dir: dB }), true)
    const tA = L.readMeta(dA).meta.token
    const tB = L.readMeta(dB).meta.token
    assert.equal(typeof tA, 'string', `token 未落盘:${JSON.stringify(tA)}`)
    assert.ok(tA.length >= 16, `token 太短不构成凭据:${tA}`)
    assert.notEqual(tA, tB, '两把锁拿到同一枚凭据 = 凭据退化成常量,归属核验失效')
  } finally {
    rmScratch(base)
  }
})

test('token 匹配 ⇒ 释放成功(持有者自释与悬挂锁代为收口两条路都要凭据)', () => {
  const base = mkScratch('dl-token-match-')
  try {
    // (a) 持有者自释:pid 是自己 + 凭据对上 ⇒ 释放
    const mine = lockFixture(base, {
      mode: 'build',
      pid: process.pid,
      ts: Date.now(),
      token: TOKEN,
    })
    assert.equal(L.release({ mode: 'build', dir: mine, token: TOKEN }).released, true)
    assert.ok(!existsSync(mine), '凭据匹配的自释必须真删掉锁')
    // (b) 悬挂锁代为收口:持有者已死 + 凭据对上 ⇒ 照样收口(票面要的不是"永远删不掉")
    const orphan = lockFixture(base, {
      mode: 'build',
      pid: deadPid(),
      ts: Date.now(),
      token: TOKEN,
    })
    const r = L.release({ mode: 'build', dir: orphan, token: TOKEN })
    assert.equal(r.released, true, `实得 ${JSON.stringify(r)}`)
    assert.ok(!existsSync(orphan))
  } finally {
    rmScratch(base)
  }
})

test('token 不匹配 ⇒ 拒绝释放且锁仍在(不得静默成功)', () => {
  const base = mkScratch('dl-token-mismatch-')
  try {
    const dir = lockFixture(base, {
      mode: 'build',
      pid: deadPid(),
      ts: Date.now(),
      token: TOKEN,
    })
    const r = L.release({ mode: 'build', dir, token: TOKEN_OTHER })
    assert.equal(r.released, false, `实得 ${JSON.stringify(r)}`)
    assert.match(r.why, /owner token 不匹配/, `拒绝理由必须点名归属核验,实得 ${r.why}`)
    assert.ok(existsSync(dir), '拒绝释放不得删锁,也不得改写/归档掉原锁')
    assert.equal(
      readMetaToken(dir),
      TOKEN,
      '拒绝路径不得动锁的内容(现场必须原样留给真正的持有者/人工)',
    )
  } finally {
    rmScratch(base)
  }
})

test('锁带 token 而调用方未带 ⇒ 同样视为不匹配,拒绝且锁仍在', () => {
  const base = mkScratch('dl-token-missing-')
  try {
    // 持有者"名义存活"(用父进程)也拦不住要验的第一格:归属核验必须**先**于一切处置。
    const alive = lockFixture(base, {
      mode: 'build',
      pid: process.ppid,
      ownerPid: process.ppid,
      ts: Date.now(),
      token: TOKEN,
    })
    const rAlive = L.release({ mode: 'build', dir: alive })
    assert.equal(rAlive.released, false, `实得 ${JSON.stringify(rAlive)}`)
    assert.match(rAlive.why, /owner token 不匹配/)
    assert.ok(existsSync(alive))
    // 悬挂形态:不带给凭据的 release 同样删不掉 —— 这正是票面点名的"第二条 CLI"入口
    const hanging = lockFixture(base, {
      mode: 'build',
      pid: deadPid(),
      ts: Date.now(),
      token: TOKEN,
    })
    const rHang = L.release({ mode: 'build', dir: hanging })
    assert.equal(rHang.released, false, `实得 ${JSON.stringify(rHang)}`)
    assert.match(rHang.why, /owner token 不匹配/)
    assert.ok(existsSync(hanging))
  } finally {
    rmScratch(base)
  }
})

test('同进程 acquire⇒release 无需显式传 token(进程内备忘按目录各记各的)', async () => {
  const base = mkScratch('dl-token-memo-')
  try {
    const dA = join(base, 'lock-a')
    const dB = join(base, 'lock-b')
    assert.equal(await L.acquire({ mode: 'build', timeoutMs: 3000, dir: dA }), true)
    assert.equal(await L.acquire({ mode: 'build', timeoutMs: 3000, dir: dB }), true)
    assert.equal(L.release({ mode: 'build', dir: dA }).released, true, 'acquire 过的目录必须能自释')
    assert.ok(!existsSync(dA))
    assert.equal(L.release({ mode: 'build', dir: dB }).released, true, '另一目录的凭据不得串门')
    assert.ok(!existsSync(dB))
    // 反向:从未 acquire 过的带 token 夹具,进程内没有它的凭据 ⇒ 拒绝(备忘不是万能钥匙)
    const stranger = lockFixture(base, {
      mode: 'build',
      pid: deadPid(),
      ts: Date.now(),
      token: TOKEN,
    })
    const r = L.release({ mode: 'build', dir: stranger })
    assert.equal(r.released, false, `实得 ${JSON.stringify(r)}`)
    assert.match(r.why, /owner token 不匹配/)
    assert.ok(existsSync(stranger))
  } finally {
    rmScratch(base)
  }
})

test('旧格式锁(meta 无 token 字段)⇒ 归属无法核验,按既有判据处置并报名', () => {
  const base = mkScratch('dl-token-legacy-')
  try {
    // (a) 悬挂锁(持有者已死):无凭据可比 ⇒ 维持改动前判据(代为收口,现场留档)
    const orphan = lockFixture(base, { mode: 'build', pid: deadPid(), ts: Date.now() })
    const r = L.release({ mode: 'build', dir: orphan })
    assert.equal(r.released, true, `实得 ${JSON.stringify(r)}`)
    assert.ok(!existsSync(orphan))
    // (b) 自持锁:同样走既有判据(self ⇒ 自释)
    const mine = lockFixture(base, { mode: 'build', pid: process.pid, ts: Date.now() })
    assert.equal(L.release({ mode: 'build', dir: mine }).released, true)
    assert.ok(!existsSync(mine))
    // (c) 既有判据该拒的照样拒(他人活锁):不得因为"旧格式"就放宽成白拿
    assert.ok(L.isProcessAlive(process.ppid), '夹具需要父进程在位')
    const foreign = lockFixture(base, {
      mode: 'build',
      pid: process.ppid,
      ts: Date.now() - L.HARD_CAP_MS - 5_000,
    })
    const rF = L.release({ mode: 'build', dir: foreign })
    assert.equal(rF.released, false, `实得 ${JSON.stringify(rF)}`)
    assert.match(rF.why, /复用/, `既有判据的拒绝理由必须原样保留,实得 ${rF.why}`)
    assert.ok(existsSync(foreign))
  } finally {
    rmScratch(base)
  }
})

test('端到端(CLI,两个不同进程):acquire 打印 token;无凭据的 release 删不掉;凭同一 token 才删得掉', () => {
  const base = mkScratch('dl-token-e2e-')
  try {
    const dir = join(base, 'lock')
    const dead = deadPid()
    const run = (args) =>
      spawnSync(process.execPath, [SCRIPT, ...args, '--lock-dir', dir], {
        encoding: 'utf8',
        windowsHide: true, // §5b:漏了就是反复弹窗
        timeout: 60_000,
      })
    // ① acquire:夹具 owner 用确定已死的 pid(让②③能走完代为收口那条路),token 现生成并打印
    const acq = run(['acquire', '--mode', 'build', '--owner-pid', String(dead)])
    assert.equal(acq.status, 0, `acquire 失败:${acq.stderr}`)
    const m = /token=([0-9a-f]{32})/.exec(acq.stdout)
    assert.ok(m, `acquire 输出必须带 token 供调用方带给 release:${acq.stdout}`)
    const token = m[1]
    assert.ok(existsSync(join(dir, 'meta.json')))
    // ② 第二个进程、同 mode、不带凭据 ⇒ 拒绝,锁原样在位(票面的"第二条 CLI"场景)
    const noTok = run(['release', '--mode', 'build'])
    assert.ok(
      /拒绝释放/.test(noTok.stderr + noTok.stdout),
      `无凭据 release 必须点名拒绝:${noTok.stderr}`,
    )
    assert.ok(existsSync(join(dir, 'meta.json')), '无凭据的 release 不得删锁')
    // ③ 第三个进程凭同一 token ⇒ 释放成功
    const withTok = run(['release', '--mode', 'build', '--token', token])
    assert.equal(withTok.status, 0, `带凭据 release 失败:${withTok.stderr}`)
    assert.ok(!existsSync(dir), '凭据匹配的 release 必须真删掉锁')
  } finally {
    rmScratch(base)
  }
})

/** 只读夹具 meta 的 token(断言"拒绝路径不动内容"用,不复制判据) */
function readMetaToken(dir) {
  return JSON.parse(readFileSync(join(dir, 'meta.json'), 'utf8')).token
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
