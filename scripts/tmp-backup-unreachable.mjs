// 临时处置:批量 tag 备份全部未备份悬空 commit(幂等,已备份者跳过)
// 命名: unreachable-commits-backup/<yyyymmdd-HHMMSS>-<hash12>
import { execSync, spawnSync } from 'node:child_process'

const GIT_BIN = (() => {
  const w = execSync('where git', { encoding: 'utf8' })
  for (const raw of w.split('\n')) {
    const p = raw.trim()
    if (/\\cmd\\git\.exe$/i.test(p)) return p
  }
  return 'git'
})()
function runGit(args) {
  const r = spawnSync(GIT_BIN, args, { encoding: 'utf8', maxBuffer: 64e6 })
  if (r.status !== 0) throw new Error(`git ${args[0]} exit=${r.status}: ${(r.stderr || '').slice(0, 150)}`)
  return (r.stdout || '').trim()
}
function runGitSoft(args) {
  const r = spawnSync(GIT_BIN, args, { encoding: 'utf8', maxBuffer: 64e6 })
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
