// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 运维工具:批量 tag 备份全部未备份悬空 commit(幂等,已备份者跳过)
// 用法: node scripts/backup-unreachable-commits.mjs
// 背景: stash 链整体悬空时守门 tree/hash/subject 三路放行失效,
//       显式 tag 是唯一可靠出口(详见 STATE.md 2026-09-04 守门加固轮).
// 命名: unreachable-commits-backup/<yyyymmdd-HHMMSS>-<hash12>
import { execSync, spawnSync } from 'node:child_process'

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
if (GIT_BIN === '') {
  console.error(
    '❌ 未判定:本器取不到 git 可执行体(lib/face-reader.gitBinary() 与 `where git` 两档皆空)⇒ 一行 tag 都不打。' +
      '这是"没判成",不是"没有悬空 commit 要备份";请按 AGENTS §12g 先让 git 可寻址再重跑本器。',
  )
  process.exit(2)
}
function runGit(args) {
  const r = spawnSync(GIT_BIN, args, { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8', maxBuffer: 64e6, windowsHide: true })
  if (r.status !== 0) throw new Error(`git ${args[0]} exit=${r.status}: ${(r.stderr || '').slice(0, 150)}`)
  return (r.stdout || '').trim()
}
function runGitSoft(args) {
  const r = spawnSync(GIT_BIN, args, { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8', maxBuffer: 64e6, windowsHide: true })
  return (r.stdout || '')
}

// ① 现有备份集(lost-commit/* + backup/* 的 peeled commit hash;
// 不含 unreachable-commits-backup/* 自身——否则本脚本幂等重跑永远 0,无法追赶新悬空)
const refOut = runGit([
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

// ② 悬空 commit 全量(fsck 发现任何丢失对象即 exit 1/2,属预期,取 stdout)
const fsck = runGitSoft(['fsck', '--unreachable', '--no-progress'])
const unreach = []
for (const l of fsck.split('\n')) {
  const m = l.match(/^unreachable commit ([0-9a-f]{40})/)
  if (m) unreach.push(m[1]) // 守门脚本对 backedUp 命中者已放行,此处全量 tag 化最稳妥
}
console.log('to backup:', unreach.length)

// ③ 逐个打轻量 tag(git tag 本身很快;幂等:ref 已存在则跳过)
const existingRefs = new Set(
  runGit(['for-each-ref', 'refs/tags/unreachable-commits-backup', '--format=%(refname)']).split('\n'),
)
const ts = new Date()
const pad = (n) => String(n).padStart(2, '0')
const stamp = `${ts.getFullYear()}${pad(ts.getMonth() + 1)}${pad(ts.getDate())}-${pad(ts.getHours())}${pad(ts.getMinutes())}${pad(ts.getSeconds())}`
let created = 0
for (const h of unreach) {
  const name = `unreachable-commits-backup/${stamp}-${h.slice(0, 12)}`
  if (existingRefs.has(`refs/tags/${name}`)) continue
  runGit(['tag', name, h])
  created++
}
console.log('tags created:', created)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
