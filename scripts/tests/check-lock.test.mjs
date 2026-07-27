import { describe, test, before, after, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import {
  existsSync,
  readFileSync,
  writeFileSync,
  unlinkSync,
  mkdtempSync,
  rmSync,
} from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

// ─── 路径推导(AGENTS.md §15:用 import.meta.url,不硬编码) ───
const __dirname = fileURLToPath(new URL('.', import.meta.url))
const SCRIPT_PATH = join(__dirname, '..', 'check-lock.mjs')
const REPO_ROOT = join(__dirname, '..', '..')
const LOCK_FILE = join(REPO_ROOT, 'apps', 'web', '.dev.lock')

// ─── 常量 ──────────────────────────────────────────────
// 测试运行器进程:subprocess 执行期间一定存活,用于 "alive PID" 场景
const ALIVE_PID = process.pid

// ─── 辅助:获取一个已死的 PID(spawn 立即退出的进程) ───
// 用于 "dead PID" 场景;spawnSync 返回时该进程已退出,PID 极 unlikely 被复用
let deadPid
function ensureDeadPid() {
  if (deadPid) return deadPid
  const child = spawnSync(process.execPath, ['-e', 'process.exit(0)'], {
    stdio: 'pipe',
  })
  deadPid = child.pid
  assert.ok(deadPid, '获取 dead PID 失败')
  return deadPid
}

// ─── 辅助:运行 check-lock.mjs(可选 mode 参数) ────────
function runScript(mode) {
  const args = mode ? [SCRIPT_PATH, mode] : [SCRIPT_PATH]
  return spawnSync(process.execPath, args, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: 15000,
  })
}

// ─── 辅助:去除 ANSI 颜色码(脚本未用色,保留以防万一) ──
function stripAnsi(s) {
  return (s || '').replace(/\x1b\[[0-9;]*m/g, '')
}

// ─── 辅助:写锁文件(JSON 对象或原始字符串) ─────────────
function writeLockFile(content) {
  writeFileSync(LOCK_FILE, typeof content === 'string' ? content : JSON.stringify(content))
}

// ─── 辅助:删除锁文件(若存在) ─────────────────────────
function removeLock() {
  if (existsSync(LOCK_FILE)) {
    try {
      unlinkSync(LOCK_FILE)
    } catch {
      /* ignore */
    }
  }
}

// ─── 备份/恢复原锁文件(防止污染真实仓库状态) ─────────
let backupDir = null
let hadOriginalLock = false
before(() => {
  hadOriginalLock = existsSync(LOCK_FILE)
  if (hadOriginalLock) {
    backupDir = mkdtempSync(join(tmpdir(), 'ihui-lock-bak-'))
    writeFileSync(join(backupDir, '.dev.lock'), readFileSync(LOCK_FILE))
    removeLock()
  }
  ensureDeadPid()
})

after(() => {
  removeLock()
  if (hadOriginalLock && backupDir) {
    writeFileSync(LOCK_FILE, readFileSync(join(backupDir, '.dev.lock')))
    rmSync(backupDir, { recursive: true, force: true })
  }
})

beforeEach(() => {
  removeLock()
})
afterEach(() => {
  removeLock()
})

describe('check-lock.mjs — CLI 参数校验', () => {
  // 1. 无参数 → exit 1 + usage(stderr)
  test('无参数 → exit 1 + usage 错误到 stderr', () => {
    const r = runScript()
    assert.equal(r.status, 1, `无参数应 exit 1,实际 ${r.status}`)
    const err = stripAnsi(r.stderr)
    assert.match(err, /用法:/, 'stderr 应含用法提示')
    assert.match(err, /<dev\|build>/, 'stderr 应含 <dev|build> 说明')
  })

  // 2. 无效参数 → exit 1 + usage(stderr)
  test('无效参数 "foo" → exit 1 + usage 错误到 stderr', () => {
    const r = runScript('foo')
    assert.equal(r.status, 1, `无效参数应 exit 1,实际 ${r.status}`)
    const err = stripAnsi(r.stderr)
    assert.match(err, /用法:/)
    assert.ok(!r.stdout.includes('OK'), '无效参数不应输出 OK')
  })
})

describe('check-lock.mjs — 无锁场景', () => {
  // 3. dev 模式无锁 → exit 0 + OK(stdout)
  test('dev 模式无锁 → exit 0 + OK 到 stdout', () => {
    const r = runScript('dev')
    assert.equal(r.status, 0, `dev 无锁应 exit 0,实际 ${r.status}`)
    const out = stripAnsi(r.stdout)
    assert.match(out, /OK: dev mode acquired, lock pid=\d+/)
  })

  // 4. build 模式无锁 → exit 0 + OK(stdout)
  test('build 模式无锁 → exit 0 + OK 到 stdout', () => {
    const r = runScript('build')
    assert.equal(r.status, 0, `build 无锁应 exit 0,实际 ${r.status}`)
    const out = stripAnsi(r.stdout)
    assert.match(out, /OK: build mode acquired, lock pid=\d+/)
  })
})

describe('check-lock.mjs — 模式互斥检测', () => {
  // 5. dev 锁 + build 命令 + alive PID → exit 1(冲突)
  test('dev 锁 + build 命令(alive PID)→ exit 1 + 冲突信息', () => {
    writeLockFile({ pid: ALIVE_PID, mode: 'dev', startedAt: Date.now() })
    const r = runScript('build')
    assert.equal(r.status, 1, `dev+build 冲突应 exit 1,实际 ${r.status}`)
    const err = stripAnsi(r.stderr)
    assert.match(err, /冲突.*dev server.*不能执行 build/)
    assert.match(err, /dev:stop/)
    assert.ok(!r.stdout.includes('OK'), '冲突时不应输出 OK')
  })

  // 6. build 锁 + dev 命令 + alive PID → exit 1(冲突)
  test('build 锁 + dev 命令(alive PID)→ exit 1 + 冲突信息', () => {
    writeLockFile({ pid: ALIVE_PID, mode: 'build', startedAt: Date.now() })
    const r = runScript('dev')
    assert.equal(r.status, 1, `build+dev 冲突应 exit 1,实际 ${r.status}`)
    const err = stripAnsi(r.stderr)
    assert.match(err, /冲突.*build.*不能执行 dev/)
    assert.match(err, /请等待 build 完成/)
    assert.ok(!r.stdout.includes('OK'), '冲突时不应输出 OK')
  })

  // 7. dev 锁 + dev 命令 + alive PID → exit 0(宽松策略,同模式复用)
  test('dev 锁 + dev 命令(alive PID)→ exit 0(宽松策略不阻塞)', () => {
    writeLockFile({ pid: ALIVE_PID, mode: 'dev', startedAt: Date.now() })
    const r = runScript('dev')
    assert.equal(r.status, 0, `dev+dev 同模式应 exit 0,实际 ${r.status}`)
    const out = stripAnsi(r.stdout)
    assert.match(out, /OK: dev mode acquired/)
    const err = stripAnsi(r.stderr)
    assert.ok(!err.includes('冲突'), 'dev+dev 不应触发冲突')
  })

  // 8. build 锁 + build 命令 + alive PID → exit 0(无显式冲突分支)
  test('build 锁 + build 命令(alive PID)→ exit 0(脚本未显式处理 build+build)', () => {
    writeLockFile({ pid: ALIVE_PID, mode: 'build', startedAt: Date.now() })
    const r = runScript('build')
    assert.equal(r.status, 0, `build+build 应 exit 0,实际 ${r.status}`)
    const out = stripAnsi(r.stdout)
    assert.match(out, /OK: build mode acquired/)
    const err = stripAnsi(r.stderr)
    assert.ok(!err.includes('冲突'), 'build+build 不触发冲突分支')
  })
})

describe('check-lock.mjs — stale 锁检测(>2h)', () => {
  // 9. stale + dead PID → WARN "视为 stale" + clearLock + exit 0
  test('stale(>2h)+ dead PID → WARN "视为 stale" + exit 0', () => {
    writeLockFile({
      pid: ensureDeadPid(),
      mode: 'dev',
      startedAt: Date.now() - 3 * 60 * 60 * 1000, // 3h 前
    })
    const r = runScript('dev')
    assert.equal(r.status, 0, `stale+dead 应 exit 0(继续),实际 ${r.status}`)
    const err = stripAnsi(r.stderr)
    assert.match(err, /WARN.*视为 stale/)
    assert.match(err, /dev:clean/)
    const out = stripAnsi(r.stdout)
    assert.match(out, /OK: dev mode acquired/, 'stale 清理后应继续获取锁')
  })

  // 10. stale + alive PID → WARN "仍在跑"(不清理) + exit 0
  test('stale(>2h)+ alive PID → WARN "仍在跑" + exit 0', () => {
    writeLockFile({
      pid: ALIVE_PID,
      mode: 'dev',
      startedAt: Date.now() - 3 * 60 * 60 * 1000, // 3h 前
    })
    const r = runScript('dev')
    assert.equal(r.status, 0, `stale+alive 应 exit 0,实际 ${r.status}`)
    const err = stripAnsi(r.stderr)
    assert.match(err, /WARN.*仍在跑/)
    assert.match(err, /dev:clean/)
    const out = stripAnsi(r.stdout)
    assert.match(out, /OK: dev mode acquired/)
  })
})

describe('check-lock.mjs — 边界与异常', () => {
  // 11. 非 stale + dead PID → 静默覆盖(exit 0,无 WARN)
  test('非 stale + dead PID → 静默覆盖 + exit 0(无 WARN)', () => {
    writeLockFile({
      pid: ensureDeadPid(),
      mode: 'dev',
      startedAt: Date.now(), // 刚创建,非 stale
    })
    const r = runScript('dev')
    assert.equal(r.status, 0, `非stale+dead 应 exit 0,实际 ${r.status}`)
    const out = stripAnsi(r.stdout)
    assert.match(out, /OK: dev mode acquired/)
    const err = stripAnsi(r.stderr)
    assert.ok(!err.includes('WARN'), '非 stale 不应输出 WARN')
    assert.ok(!err.includes('冲突'), 'dead PID 不应触发冲突')
  })

  // 12. 锁文件损坏(invalid JSON)→ readLock 返回 null → exit 0
  test('锁文件损坏(invalid JSON)→ 视为无锁 + exit 0', () => {
    writeLockFile('{ this is not valid json,,, }')
    const r = runScript('dev')
    assert.equal(r.status, 0, `损坏锁应 exit 0,实际 ${r.status}`)
    const out = stripAnsi(r.stdout)
    assert.match(out, /OK: dev mode acquired/)
    const err = stripAnsi(r.stderr)
    assert.ok(!err.includes('WARN'), '损坏锁不应触发 stale WARN')
    assert.ok(!err.includes('冲突'), '损坏锁不应触发冲突')
  })

  // 13. startedAt 缺失 → isStale 返回 false → 正常流程 exit 0
  test('锁 startedAt 缺失 → isStale false → exit 0(无 WARN)', () => {
    writeLockFile({ pid: ensureDeadPid(), mode: 'dev' }) // 无 startedAt
    const r = runScript('dev')
    assert.equal(r.status, 0, `无 startedAt 应 exit 0,实际 ${r.status}`)
    const out = stripAnsi(r.stdout)
    assert.match(out, /OK: dev mode acquired/)
    const err = stripAnsi(r.stderr)
    assert.ok(!err.includes('WARN'), '无 startedAt 不应触发 stale WARN')
  })

  // 14. pid 缺失 → isProcessAlive(undefined) 返回 false → 正常流程 exit 0
  test('锁 pid 缺失 → isProcessAlive false → exit 0(无冲突)', () => {
    writeLockFile({ mode: 'build', startedAt: Date.now() }) // 无 pid
    const r = runScript('build')
    assert.equal(r.status, 0, `无 pid 应 exit 0,实际 ${r.status}`)
    const out = stripAnsi(r.stdout)
    assert.match(out, /OK: build mode acquired/)
    const err = stripAnsi(r.stderr)
    assert.ok(!err.includes('冲突'), '无 pid 不应触发冲突(isProcessAlive 返回 false)')
    assert.ok(!err.includes('WARN'), '无 pid 不应触发 stale WARN')
  })
})
