// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 可安装性自检:证明一个 workspace 包 `npm pack` 出来的 tarball 真的能被外部装到并用。
//
// 用法:
//   node scripts/check-pkg-installable.mjs packages/api-client
//   node scripts/check-pkg-installable.mjs packages/api-client --keep   (保留解包现场)
//
// 判据(全部为"发布前硬闸",任一不过即 exit 1):
//   1. npm pack 真产出 tarball,并能列出成员(不是 --dry-run --json 的推断)
//   2. 含 dist/index.js + dist/index.d.ts(编译产物 + 类型声明都在包里)
//   3. 不含 src/(外部装到的是 dist,泄漏源码即说明 exports 仍指向 src)
//   4. 不含 .env / .npmrc / *.pem / *.key / id_rsa / *secret* / *credential* / *.token
//      以及 node_modules / .turbo / .git / *.tsbuildinfo 等构建噪音
//   5. packed package.json 的 dependencies / peerDependencies 里没有 `workspace:` 残留
//      (workspace: 协议只在本仓库内有意义,发出去 = 外部装到一个不存在的包)
//   6. 含 LICENSE + NOTICE(Apache-2.0 要求随包保留声明)
//   7. 解包后逐个 dist/*.js 的相对 import 必须带扩展名(Node ESM 完全指定解析,
//      ./client 不会补成 ./client.js;Bundler 模式下 tsc 不改写扩展名 → 纯 Node 消费者装到即坏)
//   8. packed manifest 的 name/version 与仓库内 package.json 一致
//      (捕获"prepack 改版本没改回来"这类静默坏包;仓库版本仍是占位 0.0.0 时跳过比对)
//
// `private: true` 单独作为「未放行发布」提示,不计入 blocker —— 本脚本正是
// "去 private 之前必须通过的自检",所以它应当在 private 仍为 true 时就能跑。
//
// 退出码:0 = 可安装自检通过 / 1 = 存在 blocker / 2 = 脚本自身异常(见 AGENTS.md §22d)
// 输出顺序:解包成员清单(最多 40 条)→ 结论 → blocker 明细 → private 状态提示。

import { execFileSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
// §26 临时夹具唯一落点(2026-09-25 迁):解包现场此前留在仓库树内 .ihui-agent/tmp/,
// 而 scratch-dir 的硬约束是临时物既不写 Node 的 TEMP 变量(活进程 TEMP 可能钉在 C 盘)
// 也不写仓库树 —— 锚定工作树同盘的 DevEnv/Temp/ihui-scratch,清理只删自己 mkScratch 出来的目录。
import { mkScratch, rmScratch } from './lib/scratch-dir.mjs'

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const SECRET_PATTERNS = [
  /\.env(\.|$)/i,
  /\.npmrc$/i,
  /\.pem$/i,
  /\.key$/i,
  /id_rsa/i,
  /secret/i,
  /credential/i,
  /\.token$/i,
]

const JUNK_PATTERNS = [/^package\/(node_modules|\.turbo|\.git)\//, /\.tsbuildinfo$/i]

const REQUIRED_ENTRIES = ['dist/index.js', 'dist/index.d.ts', 'LICENSE', 'NOTICE']

/** `tar -tzf` 输出归一化为 `package/...` 形式的成员路径数组。 */
export function normalizeTarEntries(stdout) {
  return String(stdout)
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^\.\//, ''))
    .filter((line) => line.length > 0 && !line.endsWith('/'))
}

/**
 * 找出发行产物里「无扩展名的相对 import」。
 * Node 的 ESM 解析是完全指定的:`from './client'` 不会被补成 `./client.js`,
 * 直接 ERR_MODULE_NOT_FOUND。tsc 在 moduleResolution: Bundler 下不改写扩展名,
 * 所以这类产物只有打包器能用,外部纯 Node ESM 消费者装到即坏。
 */
export function findExtensionlessRelativeImports(text) {
  const bad = new Set()
  const re = /(?:^|\s|;|})(?:import|export)\s[^'"]*?from\s*(['"])(\.\.?\/[^'"]*)\1/gm
  for (const m of String(text).matchAll(re)) {
    if (!/\.[A-Za-z0-9]+$/.test(m[2])) bad.add(m[2])
  }
  const dyn = /\(\s*(['"])(\.\.?\/[^'"]*)\1\s*\)/g
  for (const m of String(text).matchAll(dyn)) {
    if (!/\.[A-Za-z0-9]+$/.test(m[2])) bad.add(m[2])
  }
  return [...bad]
}

/** 对解包后的 dist/*.js 逐个做扩展名断言,聚合为最多一条 blocker(避免上百行刷屏)。 */
export function collectEsmBlockers(prefix, jsFiles) {
  const offenders = []
  for (const [relPath, text] of jsFiles) {
    const bad = findExtensionlessRelativeImports(text)
    if (bad.length > 0) offenders.push(`${relPath} → ${bad.slice(0, 2).join(', ')}`)
  }
  if (offenders.length === 0) return []
  const shown = offenders.slice(0, 5).join('; ')
  return [
    `${offenders.length} 个 ${prefix}/dist/*.js 含无扩展名相对 import(样例:${shown}${offenders.length > 5 ? ' …' : ''})` +
      ' —— 纯 Node ESM 消费者 ERR_MODULE_NOT_FOUND,需改用可被 Node 解析的产物(tsup/NodeNext + .js 后缀)',
  ]
}

/** 收集 blocker:返回字符串数组,空数组即自检通过。 */
export function collectBlockers(prefix, entries, manifest, repoManifestPath) {
  const blockers = []
  const rel = entries.filter((p) => p.startsWith(`${prefix}/`)).map((p) => p.slice(prefix.length + 1))
  const at = (p) => `${prefix}/${p}`

  for (const need of REQUIRED_ENTRIES) {
    if (!rel.includes(need)) blockers.push(`tarball 缺少 ${at(need)}`)
  }
  const srcFiles = rel.filter((p) => p === 'src' || p.startsWith('src/'))
  if (srcFiles.length > 0) {
    blockers.push(`tarball 混入 src/(${srcFiles.length} 个文件,样例 ${srcFiles.slice(0, 3).map(at).join(', ')})—— exports 未指向 dist`)
  }
  for (const p of rel) {
    const hitSecret = SECRET_PATTERNS.find((re) => re.test(p))
    if (hitSecret) blockers.push(`tarball 混入疑似密钥/敏感文件 ${at(p)}(命中 ${hitSecret})`)
    const hitJunk = JUNK_PATTERNS.find((re) => re.test(at(p)))
    if (hitJunk) blockers.push(`tarball 混入构建噪音 ${at(p)}`)
  }
  for (const field of ['dependencies', 'peerDependencies', 'optionalDependencies']) {
    const deps = manifest?.[field]
    if (!deps || typeof deps !== 'object') continue
    for (const [name, spec] of Object.entries(deps)) {
      if (typeof spec === 'string' && spec.startsWith('workspace:')) {
        blockers.push(`${field}.${name} = "${spec}" —— workspace: 协议发出去即装不到`)
      }
    }
  }
  const repoManifest = JSON.parse(readFileSync(repoManifestPath, 'utf8'))
  if (manifest?.name !== repoManifest?.name) {
    blockers.push(`packed name "${String(manifest?.name)}" 与仓库内 name "${String(repoManifest?.name)}" 不一致`)
  }
  if (!manifest?.version) blockers.push('packed manifest 缺 version')
  // 版本一致性:未定版的包(disk 仍是占位 0.0.0)不做比对,避免把"尚未接发布流水线"
  // 误判成"prepack 坏了"。
  if (
    typeof repoManifest?.version === 'string' &&
    repoManifest.version !== '0.0.0' &&
    repoManifest.version !== manifest?.version
  ) {
    blockers.push(
      `packed version "${String(manifest?.version)}" 与仓库内 version "${repoManifest.version}" 不一致(prepack 未生效 / 未随 tag 定版)`,
    )
  }
  return blockers
}

/**
 * 走 shell 调用:Windows 上 npm 实际是 npm.cmd,Node 24 起 execFileSync
 * 对 .cmd 必须 shell:true(否则 EINVAL / ENOENT);shell 派生链必须带 windowsHide,
 * 否则会弹可见控制台(AGENTS.md §5b)。
 */
function sh(cmd, args, opts = {}) {
  const line = [cmd, ...args.map((a) => (/\s/.test(a) ? `"${a}"` : a))].join(' ')
  return execFileSync(line, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    shell: true,
    windowsHide: true,
    ...opts,
  })
}

async function main() {
  const argv = process.argv.slice(2)
  const keep = argv.includes('--keep')
  const target = argv.find((a) => !a.startsWith('--'))
  if (!target) {
    console.error('用法: node scripts/check-pkg-installable.mjs <pkg-dir> [--keep]')
    process.exit(2)
  }
  const pkgDir = resolve(REPO_ROOT, target)
  if (!existsSync(join(pkgDir, 'package.json'))) {
    console.error(`❌ ${target} 下没有 package.json`)
    process.exit(2)
  }
  const workDir = mkScratch('pkg-installable-run-')
  try {
    console.log(`▶ npm pack → ${target}`)
    // --json:清单走 stdout,"npm notice" 人类可读行进 stderr,避免靠肉眼切最后一行。
    const packJson = sh('npm', ['pack', '--json', '--pack-destination', workDir], { cwd: pkgDir })
    let packed
    try {
      packed = JSON.parse(packJson)[0]
    } catch {
      console.error(`❌ npm pack --json 解析失败:${packJson.slice(0, 400)}`)
      process.exit(2)
    }
    const tarball = packed?.filename
    if (!tarball || !existsSync(join(workDir, tarball))) {
      console.error(`❌ npm pack 未产出 tarball(filename=${JSON.stringify(tarball)})`)
      process.exit(1)
    }
    console.log(`  tarball: ${tarball}(${(packed.size / 1024).toFixed(1)}KB,解包 ${(packed.unpackedSize / 1024 / 1024).toFixed(2)}MB)`)

    // tar 用相对路径 + cwd:Git for Windows 的 /usr/bin/tar 会把 `G:\x\y` 里的
    // `G:` 当成 "host:" 前缀去连远程("Cannot connect to G: resolve failed")。
    const tarOpts = { cwd: workDir }
    const entries = normalizeTarEntries(sh('tar', ['-tzf', tarball], tarOpts))
    const prefix = (entries[0] ?? '').split('/')[0]
    if (!prefix) {
      console.error('❌ tarball 解包后没有任何成员')
      process.exit(1)
    }
    console.log(`  成员数: ${entries.length}(解包根: ${prefix}/)`)

    const packedManifest = JSON.parse(sh('tar', ['-xOf', tarball, `${prefix}/package.json`], tarOpts))
    const blockers = collectBlockers(prefix, entries, packedManifest, join(pkgDir, 'package.json'))

    // 解包 → 对**真正发出去的** dist/*.js 断言 ESM 可用性(不读仓库 src,避免两份真相)
    sh('tar', ['-xzf', tarball], tarOpts)
    const distJs = entries
      .filter((p) => p.startsWith(`${prefix}/dist/`) && p.endsWith('.js'))
      .map((p) => [p.slice(prefix.length + 1), readFileSync(join(workDir, p), 'utf8')])
    blockers.push(...collectEsmBlockers(prefix, distJs))

    for (const e of entries.slice(0, 40)) console.log(`    ${e}`)
    if (entries.length > 40) console.log(`    … 其余 ${entries.length - 40} 项省略`)

    console.log('')
    console.log(`结论: ${blockers.length === 0 ? '✅ 可安装自检通过' : '❌ 可安装自检未通过'}`)
    if (blockers.length === 0) {
      console.log('  ✅ dist 产物齐备 / 无 src 泄漏 / 无密钥形态文件 / 无 workspace: 残留')
    } else {
      for (const b of blockers) console.log(`  ❌ ${b}`)
    }
    console.log(
      packedManifest.private === true
        ? '提示: 该包仍为 private: true —— 上面 blockers 清零后才允许去除。'
        : '提示: 该包已非 private,本自检结论即发布放行依据。',
    )
    process.exit(blockers.length === 0 ? 0 : 1)
  } finally {
    if (keep) console.log(`(保留现场) ${workDir}`)
    else rmScratch(workDir)
  }
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  main().catch((e) => {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  })
}

export const __test__ = {
  normalizeTarEntries,
  collectBlockers,
  findExtensionlessRelativeImports,
  collectEsmBlockers,
  SECRET_PATTERNS,
  JUNK_PATTERNS,
  REQUIRED_ENTRIES,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
