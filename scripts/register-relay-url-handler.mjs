// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * register-relay-url-handler —— 注册/注销/检查 `ihui-relay://` 自定义协议(本机一次性)。
 *
 * 用途:admin 号池页「本机切换」按钮 → 浏览器唤起 ihui-relay://switch?provider=X&uid=Y
 * → 本协议 → scripts/relay-url-handler.ps1(用户会话)→ 既有切换器(关客户端→切→拉起)。
 *
 * 注册形态(HKCU,只影响当前用户,无需管理员):
 *   Software\Classes\ihui-relay  (URL Protocol) / URL Protocol = ''
 *   ...\shell\open\command       = pwsh -NoProfile -ExecutionPolicy Bypass -File "<ps1>" "%1"
 * ps1 路径注册时由本脚本位置推导(§15:不硬编码绝对路径);换机重跑即可。
 *
 * 用法:
 *   node scripts/register-relay-url-handler.mjs            # 注册(幂等,已一致则跳过)
 *   node scripts/register-relay-url-handler.mjs --status   # 只读检查(注册表现值 vs 预期)
 *   node scripts/register-relay-url-handler.mjs --remove   # 注销
 */
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(SCRIPT_DIR, '..')
const HANDLER_PS1 = join(REPO_ROOT, 'scripts', 'relay-url-handler.ps1')
const KEY = 'HKCU\\Software\\Classes\\ihui-relay'
const KEY_CMD = `${KEY}\\shell\\open\\command`
/** -File 形态在部分调用环境会挂输入流,统一 -Command 包一层(实测 2026-10-31) */
const EXPECTED_CMD = `pwsh.exe -NoProfile -ExecutionPolicy Bypass -Command "& '${HANDLER_PS1.replace(/'/g, "''")}' -Url '%1'"`

function regQuery(key) {
  try {
    return execFileSync('reg', ['query', key], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      windowsHide: true,
    })
  } catch {
    return null
  }
}

function regAdd(key, valueName, value, type = 'REG_SZ') {
  execFileSync('reg', ['add', key, '/v', valueName, '/t', type, '/d', value, '/f'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
}

function rootMatches(queryOut) {
  // reg 输出经码页(GBK)"(默认)"会变乱码,只判 ASCII 稳定面:协议值与 URL Protocol 值名
  return queryOut.includes('URL:ihui-relay') && queryOut.includes('URL Protocol')
}

export function handlerStatus() {
  const root = regQuery(KEY)
  const cmd = regQuery(KEY_CMD)
  return {
    registered: root !== null && cmd !== null,
    rootOk: root !== null && rootMatches(root),
    cmdValue: cmd ? (cmd.match(/REG_SZ\s+(.*)/)?.[1] ?? '').trim() : null,
    expectedCmd: EXPECTED_CMD,
    cmdOk: cmd !== null && (cmd.match(/REG_SZ\s+(.*)/)?.[1] ?? '').trim() === EXPECTED_CMD,
    handlerExists: existsSync(HANDLER_PS1),
    handlerPath: HANDLER_PS1,
  }
}

export function registerHandler() {
  if (!existsSync(HANDLER_PS1)) {
    console.error(`handler 脚本不存在: ${HANDLER_PS1}`)
    return 2
  }
  regAdd(KEY, '(默认)', 'URL:ihui-relay')
  regAdd(KEY, 'URL Protocol', '')
  regAdd(KEY_CMD, '(默认)', EXPECTED_CMD)
  const st = handlerStatus()
  if (!st.registered || !st.rootOk || !st.cmdOk) {
    console.error('注册后回读不一致(未判定,§0.3):', JSON.stringify(st))
    return 1
  }
  console.log(`已注册 ihui-relay:// 协议(handler: ${HANDLER_PS1})`)
  console.log('浏览器首点会弹「打开 ihui-relay?」,勾选始终允许即可。')
  return 0
}

export function removeHandler() {
  execFileSync('reg', ['delete', KEY, '/f'], { stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true })
  const st = handlerStatus()
  if (st.registered) {
    console.error('注销后仍查询到注册表项(未判定)')
    return 1
  }
  console.log('已注销 ihui-relay:// 协议')
  return 0
}

function main(argv) {
  if (argv.includes('--status')) {
    const st = handlerStatus()
    console.log(JSON.stringify(st, null, 2))
    return st.registered && st.cmdOk && st.handlerExists ? 0 : 1
  }
  if (argv.includes('--remove')) return removeHandler()
  return registerHandler()
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main(process.argv.slice(2))
}

export const __test__ = { handlerStatus, EXPECTED_CMD, HANDLER_PS1 }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
