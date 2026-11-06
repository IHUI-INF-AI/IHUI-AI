// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 桌面端 shell:allow-open 白名单收口测试(2026-10-31 安全强化)。
// 判 apps/desktop/src-tauri/capabilities/default.json 的声明面:
//   1) allow 数组只含显式域名条目,禁止裸协议通配(https://* / http://*);
//   2) 禁止 host 后缀/夹心通配(https://aizhs.top* 会连坐 aizhs.top.evil.com);
//   3) http 仅限 localhost 开发条目;
//   4) 必须覆盖实测调用域(见 ALLOWED_EXACT 处证据),且不许出现枚举外条目。
// 运行:node apps/desktop/tests/capabilities-allow-open.test.mjs
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const CAPS_PATH = join(here, '..', 'src-tauri', 'capabilities', 'default.json')

// 实测调用面唯一通道 = apps/web/src/lib/tauri-bridge.ts openExternalUrl(invoke plugin:shell|open):
// - LoginDialog.tsx handleDesktopSso:SSO 地址 ${origin}/sso/login,生产 origin ∈ {https://aizhs.top,
//   https://www.aizhs.top}(remote.urls 实证 www 在用)或 WEB_BASE=https://aizhs.top(tauri:// 分支);
//   dev = http://localhost:8801(tauri.conf.json build.devUrl)。
// - web-work-panel.tsx handleOpenExternal:内嵌浏览器当前页 = 任意第三方 URL(用户驱动),
//   无法用静态清单表达,本次不进白名单,冲突已在交付报告点名。
export const ALLOWED_EXACT = [
  'https://aizhs.top/*',
  'https://www.aizhs.top/*',
  'http://localhost:8801/*',
]

// host 段 = protocol:// 之后、第一个 / 之前
function hostOf(pattern) {
  const m = /^([a-z][a-z0-9+.-]*):\/\/([^/?#]*)/i.exec(pattern)
  return m ? m[2] : null
}

export function judgeAllowOpen(caps) {
  const problems = []
  const entry = (caps.permissions ?? []).find(
    (p) => typeof p === 'object' && p !== null && p.identifier === 'shell:allow-open',
  )
  if (!entry) return { ok: false, problems: ['capabilities 里找不到 shell:allow-open 权限条目'] }
  const allow = entry.allow ?? []
  if (!Array.isArray(allow) || allow.length === 0) {
    return { ok: false, problems: ['shell:allow-open 缺 allow 数组(空 allow = 全拒,SSO 链路会断)'] }
  }
  const urls = allow.map((a) => {
    if (typeof a !== 'object' || a === null || typeof a.url !== 'string') {
      problems.push('allow 数组出现非 {url:string} 条目: ' + JSON.stringify(a))
      return null
    }
    return a.url
  })

  for (const u of urls) {
    if (u === null) continue
    // 裸协议通配:protocol:// 后 host 位就是 *(含 https://* / http://*)
    if (/^[a-z][a-z0-9+.-]*:\/\/\*(?:[/?#]|$)/i.test(u)) {
      problems.push('裸协议通配条目(放行任意站): ' + u)
      continue
    }
    const host = hostOf(u)
    if (host === null) {
      problems.push('url 条目缺 host: ' + u)
      continue
    }
    if (host.includes('*') && !host.startsWith('*.')) {
      problems.push('host 后缀/夹心通配(会连坐 host 后缀拼接域): ' + u)
      continue
    }
    if (host.startsWith('*.')) {
      problems.push('子域通配未按需收窄(实测调用面只有 apex 与 www): ' + u)
      continue
    }
    if (/^http:\/\//i.test(u) && !/^localhost(?::\d+)?$/i.test(host)) {
      problems.push('http 仅允许 localhost 开发条目,出现明文域: ' + u)
      continue
    }
    if (!ALLOWED_EXACT.includes(u)) {
      problems.push('条目不在实测调用面枚举内(禁止为「以后可能用」加域): ' + u)
    }
  }

  for (const required of ALLOWED_EXACT) {
    if (!urls.includes(required)) problems.push('实测调用域缺失(SSO 链路会断): ' + required)
  }
  return { ok: problems.length === 0, problems, urls: urls.filter((u) => u !== null) }
}

// ── remote.urls 覆盖面(2026-11-07 缺陷挖掘回归钉)──────────────────────────
// 主窗配置 https://aizhs.top/ 实测 308 → https://www.aizhs.top/;Tauri ACL 按
// 每次 IPC 的 Origin 头匹配 capability.remote.urls。apex 与 www 是**两个不同
// origin**,只写 apex 会让重定向后的线上页 100% 被 ACL 拒绝(全部自定义命令失效)。
const REQUIRED_REMOTE_URLS = ['http://tauri.localhost', 'https://aizhs.top/*', 'https://www.aizhs.top/*']

export function judgeRemoteUrls(caps) {
  const problems = []
  const urls = caps.remote?.urls ?? []
  for (const required of REQUIRED_REMOTE_URLS) {
    if (!urls.includes(required)) problems.push('remote.urls 缺少实际 origin: ' + required)
  }
  return { ok: problems.length === 0, problems }
}

// ── remote 侧真实调用命令必须被授予(2026-11-07 缺陷挖掘回归钉)──────────────
// 线上页(308 后的 www origin)实测会 invoke 这两条命令:
//   - take_pending_tray_actions ← apps/web/src/hooks/use-desktop.ts(冷启动取托盘动作)
//   - set_caption_button_theme  ← apps/web/src/lib/tauri-bridge.ts:290(暗色标题栏按钮)
// 命令在 invoke_handler 注册 + build.rs 生成权限,但 capability 没列 allow-* 时,
// 远程 IPC 会被 ACL 静默拒绝(前端拿 no-op / 报错,按钮看不清、托盘点击丢失)。
const REQUIRED_REMOTE_COMMANDS = [
  'allow-take-pending-tray-actions',
  'allow-set-caption-button-theme',
]

export function judgeRemoteCommandGrants(caps) {
  const problems = []
  const granted = (caps.permissions ?? []).filter((p) => typeof p === 'string')
  for (const required of REQUIRED_REMOTE_COMMANDS) {
    if (!granted.includes(required)) {
      problems.push('remote 侧真实调用命令未被 capability 授予: ' + required)
    }
  }
  return { ok: problems.length === 0, problems }
}

// ── remote 侧 store 通道收口(2026-11-07 缺陷挖掘 T1)────────────────────────
// 旧面:`store:default` 对远程 origin 全量放行,tauri-plugin-store 的 load(path)
// 把相对路径解析到 app_data_dir、**绝对路径原样返回**(无 scope 校验)。线上页被 XSS
// 后可读写任意 name 的 store 文件(含路径逃逸),也能直接读走 ihui-vault.json 里的
// 主密钥与 auth.json 里的 refresh token。
// 新面:撤销 store:default,只留两条受限命令 —— vault_read / vault_write,
// 文件名与键名双白名单 + app_data_dir 规范化包含性校验(Rust 侧 vault_store.rs)。
const REQUIRED_VAULT_COMMANDS = ['allow-vault-read', 'allow-vault-write']

export function judgeRemoteVaultScope(caps) {
  const problems = []
  const granted = (caps.permissions ?? []).filter((p) => typeof p === 'string')
  if (granted.includes('store:default')) {
    problems.push('remote capability 仍授予 store:default(任意 store 文件读写,含绝对路径逃逸)')
  }
  for (const required of REQUIRED_VAULT_COMMANDS) {
    if (!granted.includes(required)) problems.push('受限 vault 命令未授予: ' + required)
  }
  return { ok: problems.length === 0, problems }
}

function main() {
  let verdict
  let guard
  let cmdGuard
  let vaultGuard
  try {
    const caps = JSON.parse(readFileSync(CAPS_PATH, 'utf8'))
    verdict = judgeAllowOpen(caps)
    guard = judgeRemoteUrls(caps)
    cmdGuard = judgeRemoteCommandGrants(caps)
    vaultGuard = judgeRemoteVaultScope(caps)
  } catch (e) {
    // 取不到输入/解析不了 ⇒ 显式「未判定」,不冒绿
    console.error('FAIL UNDETERMINED ' + CAPS_PATH + ': ' + (e?.message ?? e))
    process.exit(2)
  }
  assert.equal(verdict.ok, true, 'allow-open 白名单违规:\n  ' + verdict.problems.join('\n  '))
  assert.equal(guard.ok, true, 'remote.urls 覆盖面缺失:\n  ' + guard.problems.join('\n  '))
  assert.equal(cmdGuard.ok, true, 'remote 命令授权缺失:\n  ' + cmdGuard.problems.join('\n  '))
  assert.equal(vaultGuard.ok, true, 'remote store 通道未收口:\n  ' + vaultGuard.problems.join('\n  '))
  console.log(
    'PASS shell:allow-open 白名单 ' +
      verdict.urls.length +
      ' 条全显式域名(无裸协议通配/后缀通配),覆盖 aizhs.top/www.aizhs.top/localhost:8801',
  )
  console.log('PASS remote.urls 覆盖 apex+www(308 重定向后的真实 origin)')
  console.log('PASS remote 侧无 store:default,仅 vault_read/vault_write 受限命令')
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

// ── 运行面(2026-10-31 安全强化第 17 批主会话追加)────────────────────────
// 实测 tauri-plugin-shell 2.3.5 的 open 命令只消费 tauri.conf.json
// plugins.shell.open 的校验正则(CommandScope 未接线到 open),capability 的
// url scope 是声明面 —— 两面缺一不可,本段钉运行面正则的存在性与判定。
function judgeShellOpenConf() {
  const conf = JSON.parse(
    readFileSync(join(here, '..', 'src-tauri', 'tauri.conf.json'), 'utf8'),
  )
  const openRe = conf.plugins?.shell?.open
  assert.ok(typeof openRe === 'string' && openRe.length > 0, 'plugins.shell.open 运行时正则必须配置')
  const re = new RegExp(openRe)
  assert.ok(re.test('https://aizhs.top/'), '产品域放行')
  assert.ok(re.test('https://www.aizhs.top/agents'), 'www 子域放行')
  assert.ok(re.test('http://localhost:8801/sso/login'), 'dev SSO 外开放行(与声明面 dev 条目对齐)')
  assert.ok(!re.test('https://evil.example.com/phish'), '第三方域拒绝(钓鱼链)')
  assert.ok(!re.test('javascript:alert(1)'), 'javascript: 形态拒绝')
  return openRe
}

// ── OS 级拖拽面收口(2026-11-07 缺陷挖掘 T5)────────────────────────────────
// `dragDropEnabled` 默认 true:WRY 会向 webview 投递 tauri://drag-drop 事件,payload 里是
// 用户拖入文件的**绝对路径**。主窗加载远程页(含任意 XSS),该页可通过
// `getCurrentWebview().onDragDropEvent` 收到这些路径 —— 用户拖一次文件就泄露一次
// 本机目录结构。远程页没有读文件授权(已撤销),但路径本身仍是隐私面。关掉 OS 级拖拽后
// 改由浏览器 HTML5 DnD 处理,页面只拿到 File 对象,拿不到绝对路径。
function judgeDragDropConf() {
  const conf = JSON.parse(
    readFileSync(join(here, '..', 'src-tauri', 'tauri.conf.json'), 'utf8'),
  )
  const main = (conf.app?.windows ?? []).find((w) => w.label === 'main')
  assert.ok(main, 'tauri.conf.json 找不到 main 窗口配置')
  assert.equal(
    main.dragDropEnabled,
    false,
    'main 窗口必须显式 dragDropEnabled:false(Tauri 默认 true ⇒ 远程页可拿到拖入文件绝对路径)',
  )
  return main.dragDropEnabled
}

if (isDirectRun) {
  main()
  const openRe = judgeShellOpenConf()
  console.log('PASS plugins.shell.open 运行面正则钉:' + openRe)
  judgeDragDropConf()
  console.log('PASS main 窗口 OS 级拖拽已关闭(远程页拿不到拖入文件绝对路径)')
}

export const __test__ = { judgeAllowOpen, judgeRemoteVaultScope, ALLOWED_EXACT, hostOf }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
