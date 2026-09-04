// 运维工具:按命名空间策略分批同步 tag 到远端(根治 push --tags 假死)
// 用法: node scripts/sync-tags.mjs <remote...>
// 背景: 本地 4919 tag 中 lost-commit/* 历史归档占 4018,单次 push --tags
//       巨量协商无进度反馈形如假死;gitcode 等镜像仓不需要全量历史归档.
// 策略(2026-09-04 立见 STATE.md):
//   - origin = 权威备份仓,历史归档命名空间全量保护
//   - gitee/gitcode = 镜像仓,只同步活命名空间(backup/saved/recovery/
//     unreachable-commits-backup/release 版本 tag),历史归档不同步
import { spawnSync } from 'node:child_process'
import { appendFileSync } from 'node:fs'

const G = 'C:/Program Files/Git/cmd/git.exe'
const cwd = 'g:/IHUI-AI'
const LOG = 'push_tags.log'
const log = (s) => {
  const line = `[${new Date().toISOString()}] ${s}`
  appendFileSync(LOG, line + '\n')
  console.log(line)
}
const run = (args, timeout = 240000) =>
  spawnSync(G, args, { encoding: 'utf8', maxBuffer: 64e6, cwd, timeout })

// 镜像仓同步的命名空间白名单(前缀匹配);release 版本 tag 形如 v0.2.0/desktop-v*
const MIRROR_NS = [
  'backup/',
  'saved/',
  'recovery/',
  'unreachable-commits-backup/',
  'lost-commit-backup/',
]

const BATCH = 60

for (const remote of process.argv.slice(2)) {
  const rt = new Set(
    run(['ls-remote', '--refs', remote])
      .stdout.split('\n')
      .filter(Boolean)
      .map((l) => (l.split('\t')[1] || '').replace('refs/tags/', '')),
  )
  if (rt.size === 0) {
    log(`${remote}: ls-remote 空,跳过(网络/权限问题先排查)`)
    continue
  }
  const localTags = run(['for-each-ref', 'refs/tags', '--format=%(refname)'])
    .stdout.split('\n')
    .filter(Boolean)
    .map((t) => t.replace('refs/tags/', ''))
  const missing = localTags.filter(
    (t) =>
      !rt.has(t) &&
      (MIRROR_NS.some((ns) => t.startsWith(ns)) ||
        /^(v|desktop-v)[0-9]/.test(t)),
  )
  log(`${remote}: local=${localTags.length} remote=${rt.size} to-sync=${missing.length}`)
  let pushed = 0
  for (let i = 0; i < missing.length; i += BATCH) {
    const batch = missing.slice(i, i + BATCH)
    const r = run(
      ['push', '--no-verify', remote, ...batch.map((t) => `refs/tags/${t}:refs/tags/${t}`)],
    )
    if (r.status === 0) {
      pushed += batch.length
      log(`${remote} batch@${i} OK (${pushed}/${missing.length})`)
    } else {
      log(`${remote} batch@${i} FAIL exit=${r.status} err=${(r.stderr || '').slice(-200)}`)
      break
    }
  }
  log(`=== ${remote} done: pushed=${pushed}/${missing.length}`)
}
