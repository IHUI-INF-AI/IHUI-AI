// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { spawn, spawnSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

/**
 * 项目级 REA MCP 入口。IHUI 代理 spawn `node` 拉起本文件，本文件再拉起
 * `rea-agents@6.4.0 mcp`，并把 stdin/stdout 原样接过去。
 *
 * 首选直接 spawn 全局安装的 rea.mjs：npx 经 cmd.exe 垫片在 node 管道下
 * 会吞 stdin，且在 pnpm workspace 根目录会让 npm arborist 崩。
 * 全局包版本必须等于钉住的 6.4.0，否则回退 npx（在中性目录跑）。
 */
const PINNED_VERSION = '6.4.0'

function resolveGlobalReaCli() {
  try {
    const probe =
      process.platform === 'win32'
        ? spawnSync('cmd.exe', ['/d', '/c', 'npm', 'root', '-g'], { encoding: 'utf8' })
        : spawnSync('npm', ['root', '-g'], { encoding: 'utf8' })
    const root = probe.stdout?.trim()
    if (probe.status !== 0 || !root) return null
    const pkgDir = path.join(root, 'rea-agents')
    const cli = path.join(pkgDir, 'scripts', 'rea.mjs')
    const pkgJson = path.join(pkgDir, 'package.json')
    if (!fs.existsSync(cli) || !fs.existsSync(pkgJson)) return null
    if (JSON.parse(fs.readFileSync(pkgJson, 'utf8')).version !== PINNED_VERSION) return null
    return cli
  } catch {
    return null
  }
}

const globalCli = resolveGlobalReaCli()
const child = globalCli
  ? spawn(process.execPath, [globalCli, 'mcp'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
      cwd: os.tmpdir(),
    })
  : process.platform === 'win32'
    ? spawn('cmd.exe', ['/d', '/c', 'npx', '-y', `rea-agents@${PINNED_VERSION}`, 'mcp'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
        cwd: os.tmpdir(),
      })
    : spawn('npx', ['-y', `rea-agents@${PINNED_VERSION}`, 'mcp'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
        cwd: os.tmpdir(),
      })

process.stdin.pipe(child.stdin)
child.stdout.pipe(process.stdout)
child.stderr.pipe(process.stderr)

child.on('error', (error) => {
  process.stderr.write(`${error.message}\n`)
  process.exit(1)
})

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }
  process.exit(code ?? 1)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
