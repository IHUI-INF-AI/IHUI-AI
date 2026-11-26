#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 本机 main 历史线保活:只快进追上 origin/main,绝不推送、合并分叉或改写历史。
 *
 * 所有 git 派生复用 face-reader 的 gitRaw(绝对 git、windowsHide、显式 stdio、有界超时);
 * fetch 先走直连避开仓库里已知不通的 7897 代理,失败后再用环境代理重试一次。
 * 判据与 IO 分离:classify 只吃 sha/祖先关系/计数,--self-test 不派生 git、不写盘。
 */
/* eslint-disable no-console -- CLI 工具,需 console 输出诊断信息 */
import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { GIT_EGRESS_DIRECT_ARGS, gitErrText, gitRaw } from './lib/face-reader.mjs'
import { resolveWriteLockDir } from './lib/git-dir-boundary.mjs'
import { tryAcquireSingleInstance } from './git-lock.mjs'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const SHA_RE = /^[0-9a-f]{40,64}$/i
const GIT_TIMEOUT_MS = 120_000
const EXIT_CODES = Object.freeze({
  'up-to-date': 0,
  behind: 0,
  ahead: 0,
  diverged: 1,
  undetermined: 2,
})

function report(state, fields = {}) {
  return {
    state,
    localSha: fields.localSha ?? null,
    remoteSha: fields.remoteSha ?? null,
    behindCount: fields.behindCount ?? null,
    aheadCount: fields.aheadCount ?? null,
    reason: String(fields.reason ?? ''),
  }
}

/**
 * 纯判据。isAncestor 表示 localSha 是否为 remoteSha 的祖先;反向关系必须由 IO 明问,
 * 不能把「local 不是 remote 祖先」直接猜成 ahead/diverged。
 */
export function classify({
  localSha = null,
  remoteSha = null,
  isAncestor = null,
  remoteIsAncestor = null,
  behindCount = 0,
  aheadCount = 0,
} = {}) {
  if (!SHA_RE.test(String(localSha ?? '')) || !SHA_RE.test(String(remoteSha ?? '')))
    return report('undetermined', { reason: 'localSha/remoteSha 不是完整 commit oid' })
  if (localSha.toLowerCase() === remoteSha.toLowerCase())
    return report('up-to-date', {
      localSha,
      remoteSha,
      behindCount: 0,
      aheadCount: 0,
      reason: '本地与远端相等',
    })
  if (typeof isAncestor !== 'boolean')
    return report('undetermined', { localSha, remoteSha, reason: 'merge-base 祖先关系未判定' })
  if (isAncestor)
    return report('behind', {
      localSha,
      remoteSha,
      behindCount,
      aheadCount: 0,
      reason: '远端包含本地,可执行 ff-only',
    })
  if (remoteIsAncestor === true)
    return report('ahead', {
      localSha,
      remoteSha,
      behindCount: 0,
      aheadCount,
      reason: '本地领先远端;不自动推送,交既有 git-sync-converge 处置',
    })
  if (remoteIsAncestor === false)
    return report('diverged', {
      localSha,
      remoteSha,
      behindCount,
      aheadCount,
      reason: '两边各有独有提交;不执行任何写操作,交既有 git-sync-converge 处置',
    })
  return report('undetermined', { localSha, remoteSha, reason: '反向 merge-base 祖先关系未判定' })
}

function readSha(value) {
  const text = String(value ?? '').trim()
  if (!SHA_RE.test(text))
    throw new Error(`ref 输出解不出完整 commit oid:${text.slice(0, 80) || '(空)'}`)
  return text.toLowerCase()
}

function countBetween(run, left, right) {
  const text = String(
    run(['rev-list', '--count', `${left}..${right}`], { timeout: GIT_TIMEOUT_MS }) ?? '',
  ).trim()
  if (!/^\d+$/.test(text)) throw new Error(`rev-list 计数输出非法:${text.slice(0, 80) || '(空)'}`)
  return Number(text)
}

function ancestor(run, older, newer) {
  try {
    run(['merge-base', '--is-ancestor', older, newer], { timeout: GIT_TIMEOUT_MS })
    return true
  } catch (e) {
    // exit 1 是 git 对「不是祖先」的正常结论;其余退出码/派生失败一律未判定。
    if (e?.status === 1) return false
    throw e
  }
}

function acquireWriteLock() {
  return tryAcquireSingleInstance({
    dir: resolveWriteLockDir(ROOT),
    unitId: 'mainline-keep-latest',
    log: () => {},
  })
}

function proxyEgressArgs(env = process.env) {
  const proxy = env.HTTPS_PROXY || env.https_proxy || env.HTTP_PROXY || env.http_proxy || ''
  if (!proxy || /127\.0\.0\.1:7897\b/.test(proxy)) return null
  return ['-c', `http.proxy=${proxy}`, '-c', `https.proxy=${proxy}`]
}

function fetchMainline(run, env = process.env) {
  const attempts = [GIT_EGRESS_DIRECT_ARGS]
  const viaProxy = proxyEgressArgs(env)
  if (viaProxy) attempts.push(viaProxy)
  let lastError = null
  for (const egress of attempts) {
    try {
      run([...egress, 'fetch', 'origin', '+main:refs/remotes/origin/main'], {
        timeout: GIT_TIMEOUT_MS,
      })
      return
    } catch (e) {
      lastError = e
    }
  }
  throw lastError
}

/** IO 编排。默认 root 由脚本自身位置推导,不依赖共享工作区的 cwd。 */
export function keepLatest({
  root = ROOT,
  run = (args, opts) => gitRaw(args, root, opts),
  acquireWriteLock: acquireLock = acquireWriteLock,
  env = process.env,
} = {}) {
  let localSha = null
  let remoteSha = null
  try {
    fetchMainline(run, env)
    localSha = readSha(run(['rev-parse', '--verify', 'HEAD^{commit}'], { timeout: GIT_TIMEOUT_MS }))
    remoteSha = readSha(
      run(['rev-parse', '--verify', 'refs/remotes/origin/main^{commit}'], {
        timeout: GIT_TIMEOUT_MS,
      }),
    )
    if (localSha === remoteSha)
      return classify({ localSha, remoteSha, isAncestor: true, behindCount: 0, aheadCount: 0 })

    const isAncestor = ancestor(run, localSha, remoteSha)
    let remoteIsAncestor = null
    if (!isAncestor) remoteIsAncestor = ancestor(run, remoteSha, localSha)

    const behindCount = isAncestor
      ? countBetween(run, localSha, remoteSha)
      : remoteIsAncestor === false
        ? countBetween(run, localSha, remoteSha)
        : 0
    const aheadCount = !isAncestor ? countBetween(run, remoteSha, localSha) : 0
    const verdict = classify({
      localSha,
      remoteSha,
      isAncestor,
      remoteIsAncestor,
      behindCount,
      aheadCount,
    })
    if (verdict.state !== 'behind') return verdict

    const lock = acquireLock()
    if (!lock?.acquired)
      return report('undetermined', {
        localSha,
        remoteSha,
        behindCount,
        reason: `git 写锁被占用,拒绝快进:${String(lock?.why ?? lock?.kind ?? '未给出原因')}`,
      })
    try {
      const lockedHead = readSha(
        run(['rev-parse', '--verify', 'HEAD^{commit}'], { timeout: GIT_TIMEOUT_MS }),
      )
      if (lockedHead !== localSha)
        return report('undetermined', {
          localSha: lockedHead,
          remoteSha,
          behindCount,
          reason: '取锁后 HEAD 已变化,拒绝按旧判定快进',
        })
      const branch = String(
        run(['symbolic-ref', '--quiet', '--short', 'HEAD'], { timeout: GIT_TIMEOUT_MS }) ?? '',
      ).trim()
      if (branch !== 'main')
        return report('undetermined', {
          localSha,
          remoteSha,
          behindCount,
          reason: `当前分支为 ${branch || '(detached)'},拒绝快进非 main`,
        })
      const dirty = String(
        run(['status', '--porcelain=v1', '--untracked-files=normal'], {
          timeout: GIT_TIMEOUT_MS,
        }) ?? '',
      )
        .split(/\r?\n/)
        .filter(Boolean)
      if (dirty.length)
        return report('undetermined', {
          localSha,
          remoteSha,
          behindCount,
          reason: `工作树有 ${dirty.length} 项未提交改动,拒绝快进:${dirty
            .slice(0, 20)
            .map((line) => line.trim())
            .join(' | ')}${dirty.length > 20 ? ' | …' : ''}`,
        })
      run(['merge', '--ff-only', remoteSha], { timeout: GIT_TIMEOUT_MS })
      const after = readSha(
        run(['rev-parse', '--verify', 'HEAD^{commit}'], { timeout: GIT_TIMEOUT_MS }),
      )
      if (after !== remoteSha)
        return report('undetermined', {
          localSha: after,
          remoteSha,
          behindCount,
          reason: 'ff-only 后回读 HEAD 与远端不一致',
        })
      return { ...verdict, localSha: after, reason: `已快进 ${behindCount} 枚提交并回读一致` }
    } finally {
      lock.release()
    }
  } catch (e) {
    return report('undetermined', {
      localSha,
      remoteSha,
      reason: `${gitErrText(e)};未判定,不记绿`,
    })
  }
}

export function stateExitCode(state) {
  return EXIT_CODES[state] ?? 2
}

/** 纯内存自检:覆盖五档、缺反向祖先关系、写执行边界与快进回读。 */
export function runSelfTest() {
  const checks = []
  const check = (name, fn) => {
    fn()
    checks.push(name)
  }
  const a = 'a'.repeat(40)
  const b = 'b'.repeat(40)
  const c = 'c'.repeat(40)
  check('up-to-date', () => {
    const r = classify({ localSha: a, remoteSha: a, isAncestor: true })
    assert.equal(r.state, 'up-to-date')
    assert.equal(r.behindCount, 0)
    assert.equal(r.aheadCount, 0)
  })
  check('behind', () => {
    assert.equal(
      classify({ localSha: a, remoteSha: b, isAncestor: true, behindCount: 2 }).state,
      'behind',
    )
  })
  check('ahead', () => {
    assert.equal(
      classify({
        localSha: b,
        remoteSha: a,
        isAncestor: false,
        remoteIsAncestor: true,
        aheadCount: 3,
      }).state,
      'ahead',
    )
  })
  check('diverged', () => {
    assert.equal(
      classify({
        localSha: a,
        remoteSha: b,
        isAncestor: false,
        remoteIsAncestor: false,
        behindCount: 2,
        aheadCount: 3,
      }).state,
      'diverged',
    )
  })
  check('undetermined-missing-reverse-ancestry', () => {
    assert.equal(classify({ localSha: a, remoteSha: b, isAncestor: false }).state, 'undetermined')
  })
  check('undetermined-fetch-failure', () => {
    const r = keepLatest({
      run: () => {
        throw new Error('fetch failed')
      },
    })
    assert.equal(r.state, 'undetermined')
    assert.equal(r.localSha, null)
  })
  check('diverged-no-write', () => {
    const calls = []
    const r = keepLatest({
      run(args) {
        calls.push(args)
        if (args[4] === 'fetch') return ''
        if (args[0] === 'rev-parse') return args.includes('HEAD^{commit}') ? a : b
        if (args[0] === 'merge-base') {
          const err = new Error('not ancestor')
          err.status = 1
          throw err
        }
        if (args[0] === 'rev-list') return '2'
        throw new Error(`unexpected write:${args.join(' ')}`)
      },
    })
    assert.equal(r.state, 'diverged')
    assert.equal(
      calls.some((args) => args[0] === 'merge' || args[0] === 'push'),
      false,
    )
  })
  check('behind-readback-mismatch-undetermined', () => {
    let callsHead = a
    const r = keepLatest({
      acquireWriteLock: () => ({ acquired: true, release() {} }),
      run(args) {
        if (args[4] === 'fetch') return ''
        if (args[0] === 'rev-parse') {
          if (args.includes('refs/remotes/origin/main^{commit}')) return b
          return callsHead
        }
        if (args[0] === 'merge-base') return ''
        if (args[0] === 'rev-list') return '1'
        if (args[0] === 'symbolic-ref') return 'main'
        if (args[0] === 'status') return ''
        if (args[0] === 'merge') {
          assert.deepEqual(args, ['merge', '--ff-only', b])
          callsHead = c
          return ''
        }
        throw new Error('unexpected command')
      },
    })
    assert.equal(r.state, 'undetermined')
    assert.match(r.reason, /回读 HEAD 与远端不一致/)
  })
  check('write-lock-contended-undetermined-no-merge', () => {
    const calls = []
    const r = keepLatest({
      acquireWriteLock: () => ({ acquired: false, kind: 'skipped-held', why: 'held' }),
      run(args) {
        calls.push(args)
        if (args[4] === 'fetch') return ''
        if (args[0] === 'rev-parse') return args.includes('HEAD^{commit}') ? a : b
        if (args[0] === 'merge-base') return ''
        if (args[0] === 'rev-list') return '1'
        throw new Error('unexpected command')
      },
    })
    assert.equal(r.state, 'undetermined')
    assert.match(r.reason, /写锁被占用/)
    assert.equal(
      calls.some((args) => args[0] === 'merge'),
      false,
    )
  })
  check('write-lock-head-moved-undetermined-no-merge', () => {
    const calls = []
    let headReads = 0
    const r = keepLatest({
      acquireWriteLock: () => ({ acquired: true, release() {} }),
      run(args) {
        calls.push(args)
        if (args[4] === 'fetch') return ''
        if (args[0] === 'rev-parse') {
          if (args.includes('refs/remotes/origin/main^{commit}')) return b
          headReads += 1
          return headReads === 1 ? a : c
        }
        if (args[0] === 'merge-base') return ''
        if (args[0] === 'rev-list') return '1'
        throw new Error('unexpected command')
      },
    })
    assert.equal(r.state, 'undetermined')
    assert.match(r.reason, /取锁后 HEAD 已变化/)
    assert.equal(
      calls.some((args) => args[0] === 'merge'),
      false,
    )
  })
  return { passed: checks.length, failed: 0, checks }
}

function main(argv) {
  if (argv.includes('--self-test')) {
    try {
      const r = runSelfTest()
      for (const name of r.checks) console.log(`SELF-TEST ok ${name}`)
      console.log(`SELF-TEST-RESULT passed=${r.passed} failed=${r.failed}`)
      return 0
    } catch (e) {
      console.log(`SELF-TEST failed ${String(e?.message ?? e)}`)
      console.log('SELF-TEST-RESULT passed=0 failed=1')
      return 1
    }
  }
  const unknown = argv.find((arg) => arg !== '--json')
  const result = unknown ? report('undetermined', { reason: `未知参数:${unknown}` }) : keepLatest()
  if (argv.includes('--json')) console.log(JSON.stringify(result))
  else
    console.log(
      `MAINLINE-KEEP-LATEST state=${result.state} localSha=${result.localSha ?? '-'} remoteSha=${result.remoteSha ?? '-'} behindCount=${result.behindCount ?? '-'} aheadCount=${result.aheadCount ?? '-'} reason=${result.reason}`,
    )
  return stateExitCode(result.state)
}

export const MAINLINE_KEEP_LATEST_DEFAULT_MS = 15 * 60 * 1000
const MAINLINE_KEEP_LATEST_CONFIGURED_MS = Number(process.env.IHUI_MAINLINE_KEEP_LATEST_INTERVAL_MS)
export const MAINLINE_KEEP_LATEST_INTERVAL_MS =
  Number.isFinite(MAINLINE_KEEP_LATEST_CONFIGURED_MS) && MAINLINE_KEEP_LATEST_CONFIGURED_MS > 0
    ? MAINLINE_KEEP_LATEST_CONFIGURED_MS
    : MAINLINE_KEEP_LATEST_DEFAULT_MS
export const MAINLINE_KEEP_LATEST_TICK = join(
  ROOT,
  '.ihui-agent',
  'state',
  'mainline-keep-latest-last.json',
)
// up-to-date 不写节流戳:同一常驻进程内用内存窗口挡住 10s tick;失败/分叉仍落盘冷却。
const upToDateWindows = new Map()
const SWEEP_STATES = new Set(['up-to-date', 'behind', 'ahead', 'diverged', 'undetermined'])

/**
 * main 历史线保活调度腿:只快进追平 origin/main,不推不合。
 * 判机器状态 ⇒ 不进提交链、不注册 guardian-runner;失败只冷却并日志。
 */
export async function sweepMainlineKeepLatest({
  now = Date.now(),
  intervalMs = MAINLINE_KEEP_LATEST_INTERVAL_MS,
  tickFile = MAINLINE_KEEP_LATEST_TICK,
  logger = (line) => console.log(line),
  keepLatestImpl = keepLatest,
  memory = upToDateWindows,
} = {}) {
  const throttleMs =
    Number.isFinite(intervalMs) && intervalMs > 0 ? intervalMs : MAINLINE_KEEP_LATEST_INTERVAL_MS
  const key = String(tickFile)
  let diskLast = NaN
  try {
    diskLast = Date.parse(String(JSON.parse(readFileSync(tickFile, 'utf8')).attemptAt ?? '').trim())
  } catch {
    /* 没跑过或台账读不到 ⇒ 放行,不把故障折成永久静默 */
  }
  const memoryLast = Number(memory.get(key))
  const last = Math.max(
    Number.isFinite(memoryLast) ? memoryLast : -Infinity,
    Number.isFinite(diskLast) ? diskLast : -Infinity,
  )
  if (Number.isFinite(last) && now - last < throttleMs) return { ran: false, why: '未到节流窗口' }

  let result = null
  try {
    result = await keepLatestImpl()
  } catch {
    /* 无结论 ⇒ 未判定,下面统一落失败冷却 */
  }
  if (!result || !SWEEP_STATES.has(result.state))
    result = report('undetermined', { reason: '结论缺失或 state 非法' })

  if (result.state === 'up-to-date') {
    memory.set(key, now)
    return {
      ran: true,
      state: result.state,
      localSha: result.localSha,
      remoteSha: result.remoteSha,
    }
  }

  const record = {
    attemptAt: new Date(now).toISOString(),
    state: result.state,
    localSha: result.localSha ?? null,
    remoteSha: result.remoteSha ?? null,
    behindCount: result.behindCount ?? null,
    aheadCount: result.aheadCount ?? null,
    reason: String(result.reason ?? '').slice(0, 400),
  }
  try {
    mkdirSync(dirname(tickFile), { recursive: true })
    writeFileSync(tickFile, `${JSON.stringify(record)}\n`)
  } catch (e) {
    logger(`ℹ️ main 保活:节流台账写盘失败(不阻断):${String(e?.message ?? e).slice(0, 120)}`)
  }
  if (result.state === 'undetermined') {
    logger(`ℹ️ main 保活:未判定 —— ${String(result.reason ?? '(无原因)').slice(0, 240)}`)
    return { ran: true, ...result }
  }
  if (result.state === 'diverged') {
    logger(
      `⚠️ main 保活:历史线分叉 local=${result.localSha ?? '-'} remote=${result.remoteSha ?? '-'} behind=${result.behindCount ?? '-'} ahead=${result.aheadCount ?? '-'} ⇒ 不写操作,交 git-sync-converge`,
    )
    return { ran: true, ...result }
  }
  logger(
    `ℹ️ main 保活:state=${result.state} local=${result.localSha ?? '-'} remote=${result.remoteSha ?? '-'} behind=${result.behindCount ?? '-'} ahead=${result.aheadCount ?? '-'} —— ${String(result.reason ?? '').slice(0, 200)}`,
  )
  return { ran: true, ...result }
}

export function resetUpToDateWindowsForTest() {
  upToDateWindows.clear()
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) process.exitCode = main(process.argv.slice(2))

export const __test__ = {
  classify,
  keepLatest,
  sweepMainlineKeepLatest,
  resetUpToDateWindowsForTest,
  MAINLINE_KEEP_LATEST_INTERVAL_MS,
  runSelfTest,
  readSha,
  ancestor,
  countBetween,
  stateExitCode,
  EXIT_CODES,
  REPORT_KEYS: Object.freeze([
    'state',
    'localSha',
    'remoteSha',
    'behindCount',
    'aheadCount',
    'reason',
  ]),
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
