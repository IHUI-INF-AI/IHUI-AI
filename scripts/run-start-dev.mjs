// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// start-dev.ps1 的启动包装:根治「会话 PATH 陈旧 ⇒ 解析不到 pwsh ⇒ dev:safe 直接断」。
// 2026-10-09 实证:机器装着 PowerShell 7.6.4,但旧会话进程继承的 PATH 快照没有
// `C:\Program Files\PowerShell\7`,pnpm dev:safe 第一步就失败,排障拖了 40 分钟。
// 解析顺序:PATH(where.exe)→ 标准安装位置 → 明确报错(不静默)。
// stdin 显式 ignore:本仓有「Node 子进程 stdin 管道 EBUSY」病灶族,凡不吃 stdin
// 的子进程一律 stdio:['ignore','pipe','pipe']。
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const scriptPath = path.join(repoRoot, 'scripts', 'start-dev.ps1')
const args = process.argv.slice(2)

function findPwsh() {
  const probe = spawnSync('where.exe', ['pwsh'], { stdio: ['ignore', 'pipe', 'pipe'] })
  if (probe.status === 0) {
    const hit = probe.stdout
      .toString()
      .split(/\r?\n/)
      .map((l) => l.trim())
      .find((l) => l && l.toLowerCase().endsWith('pwsh.exe'))
    if (hit) return hit
  }
  const standardLocations = [
    'C:\\Program Files\\PowerShell\\7\\pwsh.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'powershell', 'pwsh.exe'),
  ]
  return standardLocations.find((p) => p && existsSync(p)) || null
}

const pwsh = findPwsh()
if (!pwsh) {
  console.error(
    '[run-start-dev] 未找到 PowerShell 7(pwsh)。已尝试 PATH 与标准安装位置。\n' +
      '修复:安装 PowerShell 7(x64),或把 C:\\Program Files\\PowerShell\\7 加入 PATH。',
  )
  process.exit(2)
}

const spawned = spawnSync(
  pwsh,
  ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath, ...args],
  { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true },
)

if (spawned.stdout && spawned.stdout.length) process.stdout.write(spawned.stdout)
if (spawned.stderr && spawned.stderr.length) process.stderr.write(spawned.stderr)
if (spawned.error) {
  console.error(`[run-start-dev] 启动失败: ${spawned.error.message}`)
  process.exit(1)
}
process.exit(spawned.status ?? 1)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
