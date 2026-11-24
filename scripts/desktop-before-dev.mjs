// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// scripts/desktop-before-dev.mjs
// ─────────────────────────────────────────────────────────────────────────
// `tauri.conf.json` 的 beforeDevCommand 替身(2026-11-21 立)。
//
// 病灶:原 beforeDevCommand 是 `pnpm --filter @ihui/web dev` —— 无条件再拉一份
// next dev 到 8801。而本机开发常态是"共享一套 dev server"(AGENTS §0.12 铁律),
// 8801 早已由共享 web 占着 ⇒ next dev 撞端口(EADDRINUSE / 交互式问"换端口")
// ⇒ tauri 等不到 devUrl 就按失败退出 ⇒ 桌面端窗口一闪而过(用户实报"双击启动不了")。
//
// 语义:先探 devUrl(8801)。
//   - 已就绪 ⇒ 直接 exit 0。tauri 随后等 devUrl 可达即继续;这里不重复拉 dev server。
//   - 未就绪 ⇒ 前台拉起一份 web dev(stdio 继承),由 tauri 在窗口关闭时一并终止。
//
// 与 start-dev.ps1 的分工:本文件只回答"8801 该不该由我起",不注入工具链、
// 不碰端口注册表(MSVC 注入的唯一真相源仍是 scripts/lib/msvc-env.mjs +
// scripts/desktop-build.mjs,desktop 的 dev 脚本已走该 wrapper)。
// ─────────────────────────────────────────────────────────────────────────
import { spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '..')
const DEV_URL = process.env.IHUI_DESKTOP_DEV_URL ?? 'http://localhost:8801'

/** 探一次 devUrl;超时/异常一律按"未就绪"(失效方向 = 自己拉起,不会假绿)。 */
async function probeOnce(ms = 1500) {
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), ms)
  try {
    const res = await fetch(DEV_URL, { signal: ac.signal, method: 'GET' })
    return res.status >= 200 && res.status < 500
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}

const ready = await probeOnce()
if (ready) {
  console.log(`[desktop-before-dev] ${DEV_URL} 已就绪 ⇒ 复用共享 web dev(不再重复拉起 next dev)`)
  process.exit(0)
}

console.log(`[desktop-before-dev] ${DEV_URL} 未就绪 ⇒ 前台拉起 web dev(pnpm --filter @ihui/web dev)`)
const child = spawn('pnpm', ['--filter', '@ihui/web', 'dev'], {
  cwd: REPO_ROOT,
  stdio: 'inherit',
  shell: process.platform === 'win32',
  windowsHide: true,
})

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    try {
      child.kill(sig)
    } catch {
      /* 子进程已退出 */
    }
  })
}

child.on('exit', (code, signal) => {
  process.exit(signal ? 1 : (code ?? 1))
})
child.on('error', (e) => {
  console.error(`[desktop-before-dev] 拉起 web dev 失败:${e.message}`)
  process.exit(1)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
