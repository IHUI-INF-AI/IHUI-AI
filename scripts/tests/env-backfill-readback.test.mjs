// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 测试脚本需要输出诊断信息 */
/**
 * env-backfill-readback.test.mjs — "写入确认 ≠ 生效确认"回归(2026-09-26 票,离线)
 *
 * 钉 scripts/env-backfill-model-keys.mjs 的那一格:旧实现写盘后只拿**内存串**比较就决定
 * 打印"✅ 回填完成" —— 文件只读/被外部持有/并发改写时,磁盘内容并未成为预期,而账面全绿。
 * 现在唯一出口 writeEnvWithReadBack:写完必须读回逐字节比对,不一致/写失败 ⇒ 打 ❌ 并
 * exit 1,且**任何输出不得含 key 值**(§5d 脱敏铁律;被改坏的行可能整行就是裸 token,
 * 所以差异定位只允许回显 `KEY=` 的键名)。
 *
 * 夹具全部落 mkScratch(§26:不落 os.tmpdir、不落仓库树),绝不碰真 .env。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
// §22c/§22d:直接 import 源函数(不复制实现)。import 本身能成功且不退出,
// 就是"isDirectRun 守卫在位、顶层不触发 CLI"的行为证明。
import { __test__ } from '../env-backfill-model-keys.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const CLI = join(ROOT, 'scripts', 'env-backfill-model-keys.mjs')
const { writeEnvWithReadBack } = __test__

const SECRET = 'STEPFUN_FAKE_KEY_0123456789_abcdefghij'

test('import 侧证:__test__ 出口在位且 writeEnvWithReadBack 可用(没有守卫,import 就会跑整轮巡检)', () => {
  assert.ok(__test__, '缺少 __test__ 导出 —— 镜像测试只能 import,不许复制实现(§22c)')
  assert.equal(typeof writeEnvWithReadBack, 'function')
})

test('正常写盘:读回一致 ⇒ attempted 且无 writeErr/mismatch', () => {
  const dir = mkScratch('env-backfill-normal')
  try {
    const envPath = join(dir, '.env')
    const expected = `STEPFUN_API_KEY=${SECRET}\nGROQ_API_KEY=\n`
    const r = writeEnvWithReadBack(envPath, expected)
    assert.deepEqual(r, { attempted: true, writeErr: null, mismatch: null })
    assert.equal(readFileSync(envPath, 'utf8'), expected, '盘上真值必须与预期一致(判据不是自说的)')
  } finally {
    rmScratch(dir)
  }
})

test('写盘被外部改动:注入 readFile 返回篡改内容 ⇒ mismatch 点名且绝不回显值', () => {
  const dir = mkScratch('env-backfill-tamper')
  try {
    const envPath = join(dir, '.env')
    writeFileSync(envPath, 'STEPFUN_API_KEY=\n')
    const tampered = `STEPFUN_API_KEY=${'LEAKED_CANARY_9f8e7d6c5b4a3210'}\nOTHER=x\n`
    const r = writeEnvWithReadBack(envPath, `STEPFUN_API_KEY=${SECRET}\n`, {
      writeFileSync,
      readFileSync: () => tampered,
    })
    assert.equal(r.attempted, true)
    assert.equal(r.writeErr, null)
    assert.ok(r.mismatch, '盘上内容与预期不符必须报 mismatch')
    assert.match(r.mismatch, /第 1 行/)
    assert.match(r.mismatch, /STEPFUN_API_KEY/, '差异定位按 KEY= 前缀点名键名(键名不是秘密)')
    assert.ok(!r.mismatch.includes('LEAKED_CANARY'), 'mismatch 输出不得带出被篡改行的值')
    assert.ok(!r.mismatch.includes(SECRET), 'mismatch 输出也不得带出预期值')
  } finally {
    rmScratch(dir)
  }
})

test('被改坏的行不是 KEY= 形态(整行裸 token)⇒ 连键名位都不得回显整行', () => {
  const r = writeEnvWithReadBack('/dev/null-ish', `A=1\n`, {
    writeFileSync: () => {},
    readFileSync: () => 'sk-bare-token-should-never-echo-0123456789',
  })
  assert.ok(r.mismatch)
  assert.ok(!r.mismatch.includes('sk-bare-token'), '非键值行必须整行省略')
  assert.match(r.mismatch, /非键值行/)
})

test('文件只读:真实 chmod ⇒ writeErr 非空(不得走到"完成"文案)', () => {
  const dir = mkScratch('env-backfill-readonly')
  const envPath = join(dir, '.env')
  try {
    writeFileSync(envPath, 'STEPFUN_API_KEY=\n')
    chmodSync(envPath, 0o444)
    const r = writeEnvWithReadBack(envPath, `STEPFUN_API_KEY=${SECRET}\n`)
    assert.equal(r.attempted, true)
    assert.ok(r.writeErr, `只读盘上写入必须报 writeErr,实得 ${JSON.stringify(r)}`)
    assert.equal(r.mismatch, null, '写都失败了不再走读回比较')
  } finally {
    try {
      chmodSync(envPath, 0o644)
    } catch {}
    rmScratch(dir)
  }
})

// ─── CLI 端到端(全离线:假密钥目录 + 单候选 → 不联网、不落真 .env)─────────────

function makeOfflineFixture(dir) {
  const keyDir = join(dir, 'keys')
  mkdirSync(keyDir, { recursive: true })
  // 只放 STEPFUN 一个源文件,单候选 ⇒ pickToken 不走 --verify,零网络;其余 4 家"源文件不存在"跳过
  writeFileSync(join(keyDir, 'step apikey.txt'), SECRET + '\n')
  const envPath = join(dir, '.env')
  writeFileSync(envPath, 'STEPFUN_API_KEY=\nSTEPFUN_API_BASE=https://example.invalid/v1\n')
  const backupDir = join(dir, 'backup')
  mkdirSync(backupDir, { recursive: true })
  return { keyDir, envPath, backupDir }
}

function runCli(args) {
  return spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8', windowsHide: true, timeout: 60000 })
}

test('CLI e2e(可写盘):回填成功 ⇒ 打"回填完成(读回比对一致)"+ 重启生效提示,盘上真值到位', () => {
  const dir = mkScratch('env-backfill-e2e-ok')
  try {
    const { keyDir, envPath, backupDir } = makeOfflineFixture(dir)
    const res = runCli(['--apply', '--key-dir', keyDir, '--env', envPath, '--backup-dir', backupDir])
    assert.equal(res.status, 0, `CLI 应成功:stdout=${res.stdout}\nstderr=${res.stderr}`)
    assert.match(res.stdout, /回填完成\(读回比对一致\)/)
    assert.match(res.stdout, /重启.*才生效/, '完成文案必须带"须重启服务才生效"一句(§5e)')
    assert.ok(!res.stdout.includes(SECRET), '输出恒脱敏:只允许 前6***后2,不得回显完整 key')
    assert.match(readFileSync(envPath, 'utf8'), new RegExp(`STEPFUN_API_KEY=${SECRET}`))
  } finally {
    rmScratch(dir)
  }
})

test('CLI e2e(只读盘):写失败 ⇒ 不得出现"回填完成",退出码 1,点名未生效', () => {
  const dir = mkScratch('env-backfill-e2e-ro')
  const { keyDir, envPath, backupDir } = makeOfflineFixture(dir)
  try {
    chmodSync(envPath, 0o444)
    const res = runCli(['--apply', '--key-dir', keyDir, '--env', envPath, '--backup-dir', backupDir])
    assert.equal(res.status, 1, `写未生效必须以非 0 收口,实得 ${res.status}`)
    assert.ok(!res.stdout.includes('回填完成'), '写盘失败时"回填完成"四个字不得出现')
    assert.match(res.stdout, /写入未生效/)
    assert.ok(!res.stdout.includes(SECRET), '失败输出同样不得带出 key 值')
  } finally {
    try {
      chmodSync(envPath, 0o644)
    } catch {}
    rmScratch(dir)
  }
})

test('源码级锁:"回填完成"在**输出代码行**里只出现一次,旧的不带比对文案不得回来', () => {
  const src = readFileSync(CLI, 'utf8')
  // 反向锁必须打在**剥行注释后的代码面**:源注释里逐字引用了旧写法作说明
  // (G-196"说明性文字也带执行性字符"同坑)—— 全文 doesNotMatch 会把注释本身当成回归。
  const codeOnly = src
    .split(/\r?\n/)
    .filter((l) => !l.trim().startsWith('//'))
    .join('\n')
  // 只数能进 stdout 的行(注释里叙述"回填完成"不构成冒充路径;按全文计数会把第一版
  // 自己骗成 4≠1 —— 判据要数的是产出点,不是词汇出现次数)
  const emitLines = src
    .split(/\r?\n/)
    .filter((l) => /console\.(log|error)\(/.test(l) && l.includes('回填完成'))
  assert.equal(emitLines.length, 1, '"回填完成"只允许一条 console 产出路径(多条 = 多一条冒充口)')
  assert.match(emitLines[0], /wb\.attempted \? '✅ 回填完成\(读回比对一致\)'/, '唯一产出点必须是读回比对一致的那个分支')
  assert.match(codeOnly, /if \(wb\.attempted && \(wb\.writeErr \|\| wb\.mismatch\)\)/, '完成/失败分流必须挂读回结果上')
  assert.doesNotMatch(codeOnly, /if \(out !== envText\) writeFileSync\(ENV, out\)/, '旧的"裸写不比对"形态不得回来(剥注释后的代码面)')
  assert.doesNotMatch(codeOnly, /\? '✅ 回填完成' :/, '旧的无条件完成文案不得回来(剥注释后的代码面)')
  assert.match(codeOnly, /isDirectRun/, '§22d 入口守卫必须在位(import 不触发 CLI)')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
