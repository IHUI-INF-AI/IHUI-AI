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

function main() {
  let verdict
  try {
    const caps = JSON.parse(readFileSync(CAPS_PATH, 'utf8'))
    verdict = judgeAllowOpen(caps)
  } catch (e) {
    // 取不到输入/解析不了 ⇒ 显式「未判定」,不冒绿
    console.error('FAIL UNDETERMINED ' + CAPS_PATH + ': ' + (e?.message ?? e))
    process.exit(2)
  }
  assert.equal(verdict.ok, true, 'allow-open 白名单违规:\n  ' + verdict.problems.join('\n  '))
  console.log(
    'PASS shell:allow-open 白名单 ' +
      verdict.urls.length +
      ' 条全显式域名(无裸协议通配/后缀通配),覆盖 aizhs.top/www.aizhs.top/localhost:8801',
  )
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

if (isDirectRun) {
  main()
  const openRe = judgeShellOpenConf()
  console.log('PASS plugins.shell.open 运行面正则钉:' + openRe)
}

export const __test__ = { judgeAllowOpen, ALLOWED_EXACT, hostOf }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
