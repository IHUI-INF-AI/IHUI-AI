#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


/* eslint-disable no-console -- CLI 工具,需 console 输出诊断信息 */
/**
 * check-downloads-config.mjs — 下载配置就绪核查(2026-08-06 立)。
 *
 * 背景:downloads.config.ts 已 10 处 env 化(NEXT_PUBLIC_DOWNLOAD_*),运营/运维可一键
 * 确认"哪些端已上架应用商店、缺什么 env"。
 *
 * 2026-11-16 口径收窄:**本脚本判的是「运营 env 是否填写」,不是「该端能否下载」**。
 * iOS 自那日起底稿自足 —— 未上架 App Store 也有站内 /download/ios 与内置 IPA 直链,
 * 所以 iOS 的 ⚠️ 只表示"尚未上架商店",不表示下载入口不可用;输出里逐端点明,
 * 避免把"未上架"误读成"按钮该灰"(这正是本次置灰事故的认知起点)。
 *
 * 用法:
 *   node scripts/check-downloads-config.mjs           # 检查 apps/web/.env* 当前配置
 *   node scripts/check-downloads-config.mjs --strict  # 未配置的端以非 0 退出(CI 用)
 *
 * 输出:8 端状态(✅ 已配置 / ⚠️ 缺 X env),末端汇总"缺 N 项运营 env"。
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

// 各端所需的 NEXT_PUBLIC_DOWNLOAD_* env(与 downloads.config.ts 读取逻辑对齐)
const REQUIRED_ENVS = {
  ios: ['NEXT_PUBLIC_DOWNLOAD_APPSTORE_ID'],
  'android-apk': ['NEXT_PUBLIC_DOWNLOAD_APK_URL', 'NEXT_PUBLIC_DOWNLOAD_GOOGLE_PLAY_URL', 'NEXT_PUBLIC_DOWNLOAD_CDN_BASE'],
  'wechat-miniapp': ['NEXT_PUBLIC_DOWNLOAD_WECHAT_QR', 'NEXT_PUBLIC_DOWNLOAD_WECHAT_URL'],
  web: [],
  desktop: [],
  extension: [],
  mobile: [],
  cli: [],
}

const PLATFORM_LABEL = {
  ios: 'iOS App Store',
  'android-apk': 'Android (APK/Play)',
  'wechat-miniapp': '微信小程序',
  web: 'Web PWA',
  desktop: 'Desktop 客户端',
  extension: '浏览器扩展',
  mobile: '移动端(源码构建)',
  cli: 'CLI',
}

function loadEnvFiles(root) {
  const candidates = ['.env.local', '.env.production', '.env.development', '.env']
  const env = {}
  for (const name of candidates) {
    const p = join(root, name)
    if (!existsSync(p)) continue
    for (const line of readFileSync(p, 'utf8').split('\n')) {
      const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
      if (m && !(m[1] in env)) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  }
  return env
}

const STRICT = process.argv.includes('--strict')
const webRoot = join(process.cwd(), 'apps', 'web')
const env = loadEnvFiles(webRoot)

let missing = 0
console.log('📦 下载配置就绪核查(环境: ' + (process.env.NODE_ENV || 'default') + ')')
console.log('')

for (const [platform, envs] of Object.entries(REQUIRED_ENVS)) {
  const configured = envs.length === 0 || envs.some((k) => (env[k] ?? '').length > 0)
  const label = PLATFORM_LABEL[platform] ?? platform
  if (configured) {
    console.log(`  ✅ ${label}: 已配置`)
  } else {
    missing++
    // iOS 底稿自足:缺 App Store env 只表示"未上架商店",不表示"下载入口不可用"
    const note =
      platform === 'ios'
        ? ' —— 未上架商店,但站内 /download/ios + 内置 IPA 直链已可下载(不影响可用性)'
        : ''
    console.log(`  ⚠️  ${label}: 未配置(需 ${envs.join(' 或 ')} 之一)${note}`)
  }
}

console.log('')
if (missing === 0) {
  console.log('✅ 全部下载端配置就绪')
  process.exit(0)
}
console.log(
  `⚠️  共 ${missing} 项运营 env 未配置(仅影响 android-apk / wechat-miniapp 的展示与 App Store 上架状态;iOS 下载已底稿自足),填好 env 后重新 build 即生效(详见 apps/web/.env.example)`,
)
if (STRICT) process.exit(1)
process.exit(0)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
