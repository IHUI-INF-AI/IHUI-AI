// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

/**
 * `scripts/lib/log-rotation.mjs` 的 §22c 镜像测试(机制对标 ZCode desktop logRetention)。
 *
 * 为什么这些例子必须存在:本层是**删文件**的清理器,而清理器的失效方向永远是安静 ——
 * "没删"、"删错"、"根本没挂上"三种情况在账面上都长得像"日志很健康"。实测动因:
 * `.workbuddy/hook-logs/pre-commit.log` 93,344,342 B 无保留期,而全仓唯一的轮转在
 * `deploy/win/ihui-deploy-loop.ps1`(53MB 事故之后才加的)。
 *
 * 跑法:`node --test scripts/tests/log-rotation.test.mjs`
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, renameSync, statSync, utimesSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { archiveName, decide, rotateAppendLog } from '../lib/log-rotation.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')

const put = (p, bytes, tag = 'x') => {
  writeFileSync(p, String(tag).repeat(bytes))
  // mtime 推到一小时前:默认稳定窗 1s,测试关心的是尺寸判定而不是竞态
  const old = new Date(Date.now() - 60 * 60 * 1000)
  utimesSync(p, old, old)
  return p
}

test('R1 decide:未超上限 ⇒ 不动、不删、如实给原因', () => {
  const d = decide({ exists: true, size: 10, ageMs: 9.9e9, archives: [], nowMs: 0, maxBytes: 100 })
  assert.equal(d.rotate, false)
  assert.deepEqual(d.rm, [])
  assert.match(d.reason, /健康|上限/)
})

test('R2 decide:活动文件不存在 ⇒ 报"不存在"而不是判失败(新建归写方)', () => {
  const d = decide({ exists: false, size: 0, ageMs: 0, archives: [], nowMs: 0 })
  assert.equal(d.rotate, false)
  assert.match(d.reason, /不存在/)
})

test('R3 decide:稳定窗内绝不改名(与写方抢句柄会写出半份日志)', () => {
  const d = decide({ exists: true, size: 1e9, ageMs: 12, archives: [], nowMs: 0, settleMs: 1000 })
  assert.equal(d.rotate, false)
  assert.match(d.reason, /稳定窗/)
})

test('R4 decide:双上限同时生效 —— 超总量才删最旧,不超就全部留着', () => {
  const over = decide({
    exists: true,
    size: 30,
    ageMs: 9e9,
    archives: [
      { gen: 1, path: 'a.1', size: 30 },
      { gen: 2, path: 'a.2', size: 30 },
    ],
    maxBytes: 10,
    maxTotalBytes: 60,
    maxFiles: 2,
  })
  assert.equal(over.rotate, true)
  assert.deepEqual(over.rm, ['a.2'], '只该删超出总量预算的那一份(最旧)')
  const fits = decide({
    exists: true,
    size: 11,
    ageMs: 9e9,
    archives: [{ gen: 1, path: 'a.1', size: 10 }],
    maxBytes: 10,
    maxTotalBytes: 60,
    maxFiles: 2,
  })
  assert.deepEqual(fits.rm, [], '没超预算还去删,就是把现场删了')
})

test('R5 端到端:超上限 ⇒ 原字节进归档、活动文件让位给写方、不产第二份', () => {
  const dir = mkScratch('rot-r5-')
  try {
    const p = join(dir, 'app.log')
    put(p, 4096)
    const r = rotateAppendLog(p, { maxBytes: 1024 })
    assert.equal(r.rotated, true, JSON.stringify(r))
    assert.equal(r.failed, null)
    assert.ok(!existsSync(p), '活动文件必须已被改名(由写方重建)')
    assert.equal(readFileSync(archiveName(p, 1), 'utf8').length, 4096, '归档内容必须逐字等值')
    const again = rotateAppendLog(p, { maxBytes: 1024 })
    assert.equal(again.rotated, false, '活动文件已不在 ⇒ 不得凭空造第二代')
    assert.ok(!existsSync(archiveName(p, 2)))
  } finally {
    rmScratch(dir)
  }
})

test('R6 端到端:稳定窗内 ⇒ 一行未动并把原因报出来(不是静默跳过)', () => {
  const dir = mkScratch('rot-r6-')
  try {
    const p = join(dir, 'app.log')
    writeFileSync(p, 'x'.repeat(4096)) // 刚写 ⇒ mtime = now
    const r = rotateAppendLog(p, { maxBytes: 1024 })
    assert.equal(r.rotated, false)
    assert.match(String(r.skipped), /稳定窗/)
    assert.ok(existsSync(p), '正在被追加的日志被改名 = 写方继续往旧句柄写,新文件收不到后续行')
  } finally {
    rmScratch(dir)
  }
})

test('R7 端到端:代次上移 + 只淘汰最旧那份(不得把幸存者的新位置当成淘汰对象)', () => {
  const dir = mkScratch('rot-r7-')
  try {
    const p = join(dir, 'app.log')
    put(p, 3000, 'x')
    put(archiveName(p, 1), 2048, 'y')
    put(archiveName(p, 2), 1024, 'z')
    const r = rotateAppendLog(p, { maxBytes: 1024, maxTotalBytes: 7000, maxFiles: 2 })
    assert.equal(r.rotated, true, JSON.stringify(r))
    assert.deepEqual(r.removed, [archiveName(p, 2)], '该淘汰的是最旧那份(代次数字大的)')
    assert.equal(readFileSync(archiveName(p, 2), 'utf8')[0], 'y', '原 .log.1 必须上移到 .log.2')
    assert.equal(readFileSync(archiveName(p, 1), 'utf8')[0], 'x', '活动文件必须落到 .log.1')
    assert.ok(!existsSync(p), '活动文件让位给写方')
  } finally {
    rmScratch(dir)
  }
})

test('R8 中途改名失败 ⇒ 已完成的移动全部回滚,并如实说清哪些回不来', () => {
  const dir = mkScratch('rot-r8-')
  try {
    const p = join(dir, 'app.log')
    put(p, 4096, 'x')
    put(archiveName(p, 1), 2048, 'y')
    let calls = 0
    const r = rotateAppendLog(p, {
      maxBytes: 1024,
      maxTotalBytes: 10_000,
      maxFiles: 3,
      rename: (from, to) => {
        calls += 1
        if (calls === 2) {
          const err = new Error('injected')
          err.code = 'EBUSY'
          throw err
        }
        renameSync(from, to)
      },
    })
    assert.equal(r.rotated, false, JSON.stringify(r))
    assert.match(String(r.failed), /EBUSY/)
    assert.ok(existsSync(p), '活动文件必须回到原位')
    assert.ok(existsSync(archiveName(p, 1)), '第一代必须回到原位(第一步已挪到 2,须被回滚)')
    assert.ok(!existsSync(archiveName(p, 2)), '回滚后不得留下第二代残骸')
    assert.match(String(r.skipped), /回滚 1 次/)
  } finally {
    rmScratch(dir)
  }
})

test('R9 装车证明:守护巡检真调它,且挂在 !CHECK_ONLY 分支上', () => {
  const src = readFileSync(join(ROOT, 'scripts', 'git-guardian.mjs'), 'utf8')
  assert.match(src, /function rotateRunLogs\(\)/, '回收器本体不见了')
  assert.match(
    src,
    /^\s*if \(!CHECK_ONLY\) rotateRunLogs\(\)\s*$/m,
    '挂点丢 !CHECK_ONLY 守卫或改成裸调用 ⇒ 挂进早退路径等于永不执行(本文件已踩过两次)',
  )
  assert.match(src, /from '\.\/lib\/log-rotation\.mjs'/)
})

test('R10 归档不得咬掉提交归因:safe-commit 的第二输入源必须同时读 .1', () => {
  const src = readFileSync(join(ROOT, 'scripts', 'safe-commit.mjs'), 'utf8')
  const i = src.indexOf("hook-logs', `pre-commit.log${suffix}`")
  assert.ok(i > 0, "读日志的窗口构造不见了 ⇒ 归因会退化成'未归因'")
  const seg = src.slice(Math.max(0, i - 620), i + 700)
  assert.match(seg, /\['\.1',\s*''\]/, '缺 .1 那一档就是「归档后看不见上一轮」')
  assert.match(seg, /hookLogTail = chunk \+ hookLogTail/, '时间序必须「旧在前」，拼反了窗口判定会读到半行')
})

test('R11 反向对照:量尺寸用 statSync 实际字节,不得把目录当 0 通过', () => {
  const dir = mkScratch('rot-r11-')
  try {
    const p = join(dir, 'app.log')
    put(p, 2048)
    const before = statSync(p).size
    assert.equal(before, 2048)
    const r = rotateAppendLog(p, { maxBytes: 2048 })
    assert.equal(r.rotated, false, '等于上限不算超(判据是 >,写成 >= 会让边界值每轮都动)')
  } finally {
    rmScratch(dir)
  }
})

test('R12 本层只改名与删归档,绝不截断活动文件', () => {
  const src = readFileSync(join(ROOT, 'scripts', 'lib', 'log-rotation.mjs'), 'utf8')
  assert.doesNotMatch(src, /truncateSync|writeFileSync|openSync/, '出现写/截断原语 ⇒ 它不再只是"改名 + 删归档"')
  assert.ok(existsSync(join(ROOT, 'scripts', 'lib', 'log-rotation.mjs')))
})
