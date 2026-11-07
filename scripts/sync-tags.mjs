// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 运维工具:按命名空间策略分批同步 tag 到远端(根治 push --tags 假死)
// 用法: node scripts/sync-tags.mjs <remote...>
// 背景: 本地 4919 tag 中 lost-commit/* 历史归档占 4018,单次 push --tags
//       巨量协商无进度反馈形如假死;镜像仓不需要全量历史归档.
// 策略(2026-09-04 立见 STATE.md):
//   - origin = 权威备份仓,历史归档命名空间全量保护
//   - 镜像仓 = 只同步活命名空间(backup/saved/recovery/
//     unreachable-commits-backup/release 版本 tag),历史归档不同步
// 注:2026-10-23 起国内代码镜像仓(Gitee/GitCode)已弃用、远端已从仓库配置移除,
//     本脚本对它们不再有任何调用点;镜像分支仍保留,供将来任一真实镜像远端使用。
import { spawnSync } from 'node:child_process'
import { appendFileSync } from 'node:fs'
// 2026-11-05 修复既存死器:下面第 19 行一直在用 `resolve/dirname/fileURLToPath` 三个标识符,
// 而本文件只 import 了两个 ⇒ `node scripts/sync-tags.mjs --help` 实测抛
// `ReferenceError: resolve is not defined`(HEAD 面同一处逐字相同 ⇒ 不是我本次改动引入)。
// 这是"能过 `node --check` 但一跑就死"的形态:语法门看不见未定义标识符,而全仓没有任何门
// 去真跑一次 scripts/ 里的器物(同族先例:半径护栏只量"在不在库",不量"跑不跑得动")。
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const G = 'C:/Program Files/Git/cmd/git.exe'
const cwd = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const LOG = 'push_tags.log'
const log = (s) => {
  const line = `[${new Date().toISOString()}] ${s}`
  appendFileSync(LOG, line + '\n')
  console.log(line)
}
const run = (args, timeout = 240000) =>
  // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
  spawnSync(G, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
    maxBuffer: 64e6,
    cwd,
    timeout,
  })

// 镜像仓同步的命名空间白名单(前缀匹配);release 版本 tag 形如 v0.2.0/desktop-v*
const MIRROR_NS = [
  'backup/',
  'saved/',
  'recovery/',
  'unreachable-commits-backup/',
  'lost-commit-backup/',
]

const BATCH = 60

// 用法档(2026-11-05 立,同族):本器把**每个命令行参数都当成远端名**,所以旧行为下
// 敲 `--help` 会被当作一个叫 `--help` 的 remote 去 ls-remote/push —— 那不是"读一下用法",
// 而是拿一个不存在的远端去撞网络(且真给某台机加过同名 remote 时就会真写)。
// 只加这一档,位置参数语义完全不变。
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(
    [
      'usage: node scripts/sync-tags.mjs <remote> [...remote]',
      '  参数是**远端名**(不是旗标);把 lost-commit/* 与备份族标签同步到给定远端。',
      '  只读对账请用 node scripts/sync-lost-commit-tags.mjs --check。',
      '  注:这一档只打用法,不 ls-remote、不 push。',
    ].join('\n'),
  )
  process.exit(0)
}

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
      !rt.has(t) && (MIRROR_NS.some((ns) => t.startsWith(ns)) || /^(v|desktop-v)[0-9]/.test(t)),
  )
  log(`${remote}: local=${localTags.length} remote=${rt.size} to-sync=${missing.length}`)
  let pushed = 0
  for (let i = 0; i < missing.length; i += BATCH) {
    const batch = missing.slice(i, i + BATCH)
    const r = run([
      'push',
      '--no-verify',
      remote,
      ...batch.map((t) => `refs/tags/${t}:refs/tags/${t}`),
    ])
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
