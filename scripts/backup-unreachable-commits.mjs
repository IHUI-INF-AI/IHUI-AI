// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 运维工具:批量 tag 备份全部未备份悬空 commit(幂等,已备份者跳过)
// 用法: node scripts/backup-unreachable-commits.mjs
// 背景: stash 链整体悬空时守门 tree/hash/subject 三路放行失效,
//       显式 tag 是唯一可靠出口(详见 STATE.md 2026-09-04 守门加固轮).
// 命名: 默认 unreachable-commits-backup/<yyyymmdd-HHMMSS>-<hash12>;
//       可用 IHUI_UNREACHABLE_BACKUP_PREFIX 覆盖命名空间(2026-11-08):
//       守门 30a 只把 `<prefix>lost-commit/*` + `backup/*` 认作"已备份",存量债清偿时
//       传 `IHUI_UNREACHABLE_BACKUP_PREFIX=lost-commit/auto-` 才能被门直接读成 backed。
import { execSync, spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

import { gitBinary } from './lib/face-reader.mjs'

/**
 * git 取源(2026-11-06 改造,根因是一枚**崩溃**不是慢):
 *  旧写法在**模块顶层** `execSync('where git')`,本机当次实测该派生直接以
 *  `status=3221225773`(0xC0000409 fastfail)、stdout/stderr 皆空 死掉 ⇒ 整个器物在 import 阶段
 *  抛裸栈退出。后果比"这次没跑成"重:守门 30a 点名"待处置 109 枚悬空 commit"时,唯一的批量出口
 *  其实一跑就崩,而崩掉的栈被当成"运维工具的一次失败",账面看起来仍然"有人管"。
 *
 * 现在:① 取源走仓里唯一实现 `lib/face-reader.gitBinary()`(§0.6 —— 第二份 `where git` 必然漂移,
 *  本机服务身份 PATH 是死目录时它给不出东西);② 取不到 ⇒ **显式未判定退出 2 并点名原因**,
 *  不在顶层抛栈,也绝不带着空 GIT_BIN 往下跑一堆 tag;③ 仍保留 `where git` 作次名兜底,
 *  但它现在包在 try 里 —— 兜底失败只是少一条来源,不是整枚器物炸在 import 上。
 */
const GIT_BIN = (() => {
  const fromLib = gitBinary()
  if (typeof fromLib === 'string' && fromLib !== '') return fromLib
  try {
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    const w = execSync('where git', {
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8',
      windowsHide: true,
      timeout: 30_000,
    })
    for (const raw of String(w).split('\n')) {
      const p = raw.trim()
      if (/\\cmd\\git\.exe$/i.test(p)) return p
    }
  } catch {
    // 取不到就是取不到:交给下面的统一出口,不在这里冒充"那就用裸 git 试试"
  }
  return ''
})()
// tag 命名空间(2026-11-08 可覆盖):守门 30a 的 backed 集 = `lost-commit/*` + `backup/*`。
// 一次性清偿仓级存量债时传 `lost-commit/auto-`,让本器新增的 ref 直接被门读成"已备份";
// 不传则沿用原命名。只改命名空间,**不删任何 ref**。
// 非法前缀只记原因,退出放在 main:被测试 import 时不得 process.exit。
const PREFIX = (() => {
  const raw = String(process.env.IHUI_UNREACHABLE_BACKUP_PREFIX || 'unreachable-commits-backup/').trim()
  // 允许以 `/` 或 `-` 结尾:`lost-commit/auto-` 应打出 `lost-commit/auto-20261108-<hash12>`
  // (而不是多一级 `auto-/`);不带分隔符的旧值 `unreachable-commits-backup` 仍补成 `…/`。
  const norm = /[/-]$/.test(raw) ? raw : `${raw}/`
  // 只接受常规 ref 名段(含嵌套);非法值 ⇒ 未判定退出,不带着坏前缀往下打一堆 tag。
  if (!/^[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*[/-]$/.test(norm)) {
    return {
      ok: false,
      prefix: '',
      reason: `IHUI_UNREACHABLE_BACKUP_PREFIX=${JSON.stringify(raw)} 不是合法 ref 命名空间`,
    }
  }
  return { ok: true, prefix: norm, reason: '' }
})()

const GIT_SPAWN = {
  stdio: ['ignore', 'pipe', 'pipe'],
  encoding: 'utf8',
  maxBuffer: 64e6,
  windowsHide: true,
}

function spawnGit(gitBin, args) {
  return spawnSync(gitBin, args, GIT_SPAWN)
}

function runGit(gitBin, args) {
  const r = spawnGit(gitBin, args)
  if (r.status !== 0) throw new Error(`git ${args[0]} exit=${r.status}: ${(r.stderr || '').slice(0, 150)}`)
  return (r.stdout || '').trim()
}

/**
 * fsck 派生结果能不能当悬空清单用。
 *
 * 旧 `runGitSoft` 只回 stdout、不看 status/error/signal。fsck 崩溃时 stdout 为空,
 * 调用方就打印 `to backup: 0` 并随脚本自然退出 0 —— 把「没判成」写成「没有悬空提交」。
 *
 * 与守门 30a `listUnreachableHashes` 同一口径(RC 单独不是失败):
 * - 跑完且 RC=0:stdout 可为空,空 = 真的零悬空
 * - 跑完且 RC≠0、stdout 非空、stderr 无 fatal:清单仍可信(本仓 broken link 使 RC=2)
 * - error / 信号 / 无退出码 / stdout 不可读 / fatal / 非 0 且 stdout 空白:不可信
 *
 * @param {import('node:child_process').SpawnSyncReturns<string> | null | undefined} spawnResult
 * @returns {{ ok: true, stdout: string } | { ok: false, reason: string }}
 */
function judgeFsckSpawn(spawnResult) {
  const r = spawnResult && typeof spawnResult === 'object' ? spawnResult : null
  if (!r) return { ok: false, reason: '命令失败:没有派生结果' }
  if (r.error) {
    const msg = r.error instanceof Error ? r.error.message : String(r.error)
    return { ok: false, reason: `命令失败:${msg}` }
  }
  if (r.signal) return { ok: false, reason: `命令失败:被信号 ${r.signal} 终止,输出不可信` }
  if (typeof r.status !== 'number') return { ok: false, reason: '命令失败:派生未取得退出码,输出不可信' }
  if (typeof r.stdout !== 'string') return { ok: false, reason: '输出不可信:stdout 不可读' }
  const stderr = typeof r.stderr === 'string' ? r.stderr : ''
  if (/(?:^|\n)fatal:/m.test(stderr)) {
    return { ok: false, reason: `输出不可信:stderr 含 fatal (status=${r.status})` }
  }
  if (r.status !== 0 && r.stdout.trim() === '') {
    return { ok: false, reason: `命令失败:退出码 ${r.status} 且 stdout 为空` }
  }
  return { ok: true, stdout: r.stdout }
}

/** 只收 `unreachable commit <40hex>`。tree/blob/broken link 行不是要打的 tag。 */
function parseUnreachableCommits(stdout) {
  const unreach = []
  for (const raw of String(stdout).split('\n')) {
    const m = raw.replace(/\r$/, '').match(/^unreachable commit ([0-9a-f]{40})/)
    if (m) unreach.push(m[1])
  }
  return unreach
}

/**
 * @param {import('node:child_process').SpawnSyncReturns<string> | null | undefined} spawnResult
 * @returns {{ exitCode: number, message: string, unreach: string[] | null }}
 */
function decideFsck(spawnResult) {
  const judged = judgeFsckSpawn(spawnResult)
  if (!judged.ok) {
    return {
      exitCode: 2,
      message:
        `❌ 未判定:fsck 命令失败或输出不可信(${judged.reason})。` +
        '不得把空结果当成没有悬空提交,一行 tag 都不打。',
      unreach: null,
    }
  }
  return { exitCode: 0, message: '', unreach: parseUnreachableCommits(judged.stdout) }
}

async function main() {
  if (GIT_BIN === '') {
    console.error(
      '❌ 未判定:本器取不到 git 可执行体(lib/face-reader.gitBinary() 与 `where git` 两档皆空)⇒ 一行 tag 都不打。' +
        '这是"没判成",不是"没有悬空 commit 要备份";请按 AGENTS §12g 先让 git 可寻址再重跑本器。',
    )
    process.exit(2)
  }
  if (!PREFIX.ok) {
    console.error(`❌ 未判定:${PREFIX.reason}`)
    process.exit(2)
  }
  // ① 现有备份集(lost-commit/* + backup/* 的 peeled commit hash;
  // 不含 unreachable-commits-backup/* 自身——否则本脚本幂等重跑永远 0,无法追赶新悬空)
  const refOut = runGit(GIT_BIN, [
    'for-each-ref',
    'refs/tags/lost-commit',
    'refs/tags/backup',
    '--format=%(objectname)%09%(*objectname)',
  ])
  const backed = new Set()
  for (const l of refOut.split('\n').filter(Boolean)) {
    const c = l.trim().split('\t')
    const h = c[1] || c[0]
    if (/^[0-9a-f]{40}$/.test(h)) backed.add(h)
  }
  console.log('backed hashes:', backed.size)

  // ② 悬空 commit 全量。参数与守门 30a 的 detectUnreachable 逐字对齐
  // (--connectivity-only --unreachable --no-reflogs):否则「只经 reflog 可达」的提交
  // 会被本器当成已可达而漏备,门却仍判悬空。
  // 退出码 1/2 且 stdout 有清单 = 正常读数。命令没跑成,或非 0 且 stdout 为空 = 未判定,
  // 禁止报 to backup: 0。RC=0 的空清单仍是「真的零悬空」。
  const fsckSpawn = spawnGit(GIT_BIN, [
    'fsck',
    '--connectivity-only',
    '--unreachable',
    '--no-reflogs',
    '--no-progress',
  ])
  const decision = decideFsck(fsckSpawn)
  if (decision.exitCode !== 0) {
    console.error(decision.message)
    process.exit(decision.exitCode)
  }
  const unreach = decision.unreach
  if (!Array.isArray(unreach)) {
    console.error('❌ 未判定:fsck 没有给出可信的悬空清单,不得把空结果当成没有悬空提交,一行 tag 都不打。')
    process.exit(2)
  }
  console.log('to backup:', unreach.length)

  // ③ 逐个打轻量 tag(git tag 本身很快;幂等:ref 已存在则跳过)
  const existingRefs = new Set(
    runGit(GIT_BIN, ['for-each-ref', `refs/tags/${PREFIX.prefix.replace(/[/-]$/, '')}`, '--format=%(refname)']).split(
      '\n',
    ),
  )
  const ts = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  const stamp = `${ts.getFullYear()}${pad(ts.getMonth() + 1)}${pad(ts.getDate())}-${pad(ts.getHours())}${pad(ts.getMinutes())}${pad(ts.getSeconds())}`
  let created = 0
  for (const h of unreach) {
    const name = `${PREFIX.prefix}${stamp}-${h.slice(0, 12)}`
    if (existingRefs.has(`refs/tags/${name}`)) continue
    runGit(GIT_BIN, ['tag', name, h])
    created++
  }
  console.log('tags created:', created)
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main().catch((e) => {
    console.error(`❌ 未判定:${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  })
}

export const __test__ = {
  judgeFsckSpawn,
  decideFsck,
  parseUnreachableCommits,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
