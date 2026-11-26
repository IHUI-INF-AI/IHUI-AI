// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * L13 窗口安全面的**构建期断言**(2026-11-26)。
 *
 * 对标口径是 Electron 的 `contextIsolation / sandbox / webSecurity` 三项强制开启。本仓桌面壳是
 * Tauri,三项没有同名开关,对应的事实面是这四条 —— 判据按事实面写,不照搬 Electron 名词:
 *
 *  1. `withGlobalTauri: false` —— 不把整份 IPC 面挂到 window 上(等价于"只暴露一个受控命名空间");
 *  2. CSP 非空、含 `default-src`、不含 `unsafe-eval`、`script-src` 里没有 `*` 通配 —— 等价于
 *     webSecurity + 不给 eval 放行;
 *  3. `tauri` 依赖的默认 features **不含 `devtools`** —— 生产包不带 DevTools;dev 档由
 *     `scripts/desktop-build.mjs --dev` 显式追加,二进制的特性集合与生产一致;
 *  4. capabilities 里不许出现裸 `*` 权限,也不许 `shell:allow-execute` / `shell:allow-spawn`
 *     这类"能起任意进程"的授权 —— 它们绕开命令面预算直接等同 RCE。
 *
 * 取材纪律(门 118):本脚本**只走 git 面**(默认 HEAD,`--worktree` 时读索引 `:<path>`),
 * 不在本尺另开 fs 通道;入口纪律(门 194):末尾 direct-run 守卫,不在顶层裸调 `main()`。
 *
 * 退出码:0 = 全过;1 = 有红。红灯逐条点名并给出文件位置。
 */

import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

// 取材只走仓内唯一出口(门 118):不在这里另开 git cat-file / 磁盘通道。
import { catBatch, listFaceFiles, readWorktreeFile, Undetermined } from './lib/face-reader.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CONF = 'apps/desktop/src-tauri/tauri.conf.json'
const CARGO = 'apps/desktop/src-tauri/Cargo.toml'
const CAPS_DIR = 'apps/desktop/src-tauri/capabilities'

const reds = []
const warns = []
const oks = []

function fail(check, detail) {
  reds.push(`${check}:${detail}`)
}

function pass(check, detail) {
  oks.push(`${check}:${detail}`)
}

/** 统一取材:head/staged 走 face-reader 的批量取 blob;worktree 走同一层的取盘出口。 */
function readText(face, relPath) {
  if (face === 'worktree') {
    const text = readWorktreeFile(ROOT, relPath)
    if (typeof text !== 'string') throw new Undetermined(`worktree 面取不到 ${relPath}`)
    return text
  }
  const spec = face === 'staged' ? `:${relPath}` : `HEAD:${relPath}`
  const text = catBatch(ROOT, [spec], { timeout: 60_000 }).get(spec)
  if (typeof text !== 'string') throw new Undetermined(`${face} 面取不到 ${relPath}`)
  return text
}

function listFiles(face, pathspec) {
  return listFaceFiles(ROOT, face, { paths: [pathspec] })
}

function checkGlobalTauri(conf) {
  const flag = conf?.app?.withGlobalTauri
  if (flag === false) pass('withGlobalTauri', 'false')
  else fail('withGlobalTauri', `应为 false,实为 ${JSON.stringify(flag)}`)
}

function checkCsp(conf) {
  const csp = conf?.app?.security?.csp
  if (typeof csp !== 'string' || !csp.trim()) {
    fail('csp', '未配置 CSP(生产 webview 等于无同源限制)')
    return
  }
  if (!/default-src/.test(csp)) fail('csp', '缺少 default-src')
  else pass('csp', 'default-src 在位')
  if (/unsafe-eval/.test(csp)) fail('csp', '含 unsafe-eval(脚本可 eval,webSecurity 形同虚设)')
  else pass('csp', '无 unsafe-eval')
  const scriptTrim = (/script-src([^;]*)/.exec(csp)?.[1] ?? '').trim()
  if (!scriptTrim) fail('csp', '缺少 script-src')
  else if (scriptTrim.includes('*') || scriptTrim.includes("'unsafe-inline'")) {
    fail('csp', `script-src 放得过宽:${scriptTrim}`)
  } else pass('csp', `script-src 受限:${scriptTrim}`)
}

function checkCargo(cargo) {
  const line = cargo.split(/\r?\n/).find((l) => /^\s*tauri\s*=/.test(l))
  if (!line) {
    fail('cargo', '未找到 tauri 依赖行')
    return
  }
  if (/"devtools"/.test(line)) fail('cargo', `生产默认特性含 devtools:${line.trim()}`)
  else pass('cargo', 'tauri 默认特性不含 devtools')
  if (/devtools\s*=\s*\["tauri\/devtools"\]/.test(cargo)) {
    pass('cargo', 'devtools 为显式 opt-in feature')
  } else fail('cargo', '缺少 devtools = ["tauri/devtools"] 显式 feature(dev 档将无 DevTools)')
}

/** capability 权限可能是字符串、`{identifier,allow}` 对象或嵌套对象;递归收齐。 */
function collectPermissions(node, out) {
  if (Array.isArray(node)) {
    for (const item of node) collectPermissions(item, out)
    return
  }
  if (node && typeof node === 'object') {
    if (typeof node.identifier === 'string') out.push(node.identifier)
    for (const value of Object.values(node)) collectPermissions(value, out)
    return
  }
  if (typeof node === 'string') out.push(node)
}

function checkCapabilities(face) {
  const files = listFiles(face, CAPS_DIR).filter((name) => name.endsWith('.json'))
  if (files.length === 0) {
    fail('capabilities', '没有任何 capability 文件')
    return
  }
  let scanned = 0
  for (const file of files) {
    const doc = JSON.parse(readText(face, file))
    const perms = []
    collectPermissions(doc.permissions ?? [], perms)
    scanned += perms.length
    const short = file.split('/').pop()
    for (const permit of perms) {
      if (permit === '*') fail('capabilities', `${short} 含裸 * 权限`)
      if (/^shell:allow-(execute|spawn)$/.test(permit)) {
        fail('capabilities', `${short} 含 ${permit}(可起任意进程,等同绕过命令面)`)
      }
    }
    const devtools = perms.filter((p) => /devtools/i.test(p))
    if (devtools.length && doc.remote) {
      warns.push(`capabilities:${short} 的 remote 面暴露 ${devtools.join(',')}(建议改本地面,未阻塞)`)
    }
  }
  pass('capabilities', `扫 ${files.length} 份、${scanned} 条权限,无裸 * / 无 shell 执行族`)
}

export function main(argv = process.argv.slice(2)) {
  const face = argv.includes('--worktree') ? 'worktree' : 'head'
  const conf = JSON.parse(readText(face, CONF))
  const cargo = readText(face, CARGO)
  checkGlobalTauri(conf)
  checkCsp(conf)
  checkCargo(cargo)
  checkCapabilities(face)

  const state = reds.length ? 'red' : 'ok'
  console.log(
    `[L13 窗口安全断言] face=${face} state=${state} 红=${reds.length} 过=${oks.length} 警=${warns.length}`,
  )
  for (const item of oks) console.log(`  ✅ ${item}`)
  for (const item of warns) console.log(`  ⚠️  ${item}`)
  for (const item of reds) console.log(`  ❌ ${item}`)
  process.exit(reds.length ? 1 : 0)
}

// §22d 入口守卫:只在直接运行时执行,不在顶层裸调 main()。
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main()
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
