#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * upload-miniapp.mjs — 微信小程序 CI 上传(替代「开发者工具手工点上传」)
 *
 * 背景: docs/RELEASE.md 的 miniapp 发版链路长期停在「打开微信开发者工具 → 上传」,
 *       无法在 CI / 无人值守环境复现。本脚本用官方 miniprogram-ci 走同一套上传接口。
 *
 * 用法:
 *   node scripts/upload-miniapp.mjs --version 0.0.5 --desc "发版说明"
 *   node scripts/upload-miniapp.mjs --key D:\keys\private.wx27028e276ffdbc5d.key --robot 1
 *
 * 前置:
 *   1. 已构建产物: pnpm --filter @ihui/miniapp-taro build:weapp  → apps/miniapp-taro/dist/
 *   2. 上传密钥: 微信公众平台 → 开发管理 → 开发设置 → 小程序代码上传密钥(下载后自行保管,不入库)
 *      路径来源优先级: --key > 环境变量 WX_MINIAPP_PRIVATE_KEY > apps/miniapp-taro/private.<appid>.key
 *   3. 依赖: miniprogram-ci(pnpm --filter @ihui/miniapp-taro add -D miniprogram-ci)
 *
 * 退出码: 0 成功 / 1 参数或产物问题 / 2 缺密钥或依赖(未执行上传)
 */
import { existsSync, readFileSync, statSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const APP_DIR = join(ROOT, 'apps', 'miniapp-taro')
const PROJECT_CONFIG = join(APP_DIR, 'project.config.json')
const DIST_DIR = join(APP_DIR, 'dist')

function parseArgs(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (!a.startsWith('--')) continue
    const key = a.slice(2)
    const next = argv[i + 1]
    if (next && !next.startsWith('--')) {
      out[key] = next
      i += 1
    } else {
      out[key] = true
    }
  }
  return out
}

function fail(msg, code = 1) {
  console.error(`❌ ${msg}`)
  process.exit(code)
}

const args = parseArgs(process.argv.slice(2))

if (!existsSync(PROJECT_CONFIG)) fail(`找不到 ${PROJECT_CONFIG}`)
const projectConfig = JSON.parse(readFileSync(PROJECT_CONFIG, 'utf8'))
const appid = args.appid || projectConfig.appid
if (!appid) fail('project.config.json 缺 appid')

if (!existsSync(DIST_DIR) || !statSync(DIST_DIR).isDirectory()) {
  fail('缺少构建产物 apps/miniapp-taro/dist/,请先执行 pnpm --filter @ihui/miniapp-taro build:weapp')
}

const keyPath = resolve(
  args.key || process.env.WX_MINIAPP_PRIVATE_KEY || join(APP_DIR, `private.${appid}.key`),
)
if (!existsSync(keyPath)) {
  fail(
    [
      `找不到上传密钥: ${keyPath}`,
      '  在 微信公众平台 → 开发管理 → 开发设置 → 小程序代码上传密钥 下载,然后:',
      `  node scripts/upload-miniapp.mjs --key <密钥路径>`,
      '  或设置环境变量 WX_MINIAPP_PRIVATE_KEY。密钥禁止入库。',
    ].join('\n'),
    2,
  )
}

let ci
try {
  ci = (await import('miniprogram-ci')).default
} catch {
  fail(
    [
      '缺少依赖 miniprogram-ci(未安装)。安装后重试:',
      '  pnpm --filter @ihui/miniapp-taro add -D miniprogram-ci',
    ].join('\n'),
    2,
  )
}

const now = new Date()
const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
const version = args.version || process.env.MINIAPP_VERSION || `0.0.${stamp}`
const desc = args.desc || `IHUI-AI 小程序 ${version}`
const robot = Number(args.robot || 1)

console.log(`→ appid    : ${appid}`)
console.log(`→ 产物目录 : ${DIST_DIR}`)
console.log(`→ 版本     : ${version}`)
console.log(`→ 描述     : ${desc}`)
console.log(`→ robot    : ${robot}`)

const project = new ci.Project({
  appid,
  type: 'miniProgram',
  projectPath: APP_DIR,
  privateKeyPath: keyPath,
  ignores: ['node_modules/**/*', 'src/**/*', 'scripts/**/*'],
})

try {
  await ci.upload({
    project,
    version,
    desc,
    robot,
    setting: { es6: true, minify: true, autoPrefixWXSS: true },
    onProgressUpdate: (t) => {
      if (t && typeof t === 'object' && '_msg' in t) console.log(`  ${t._msg}`)
    },
  })
  console.log('✅ 上传成功,请到 微信公众平台 → 版本管理 提交审核')
} catch (err) {
  console.error('❌ 上传失败:', err instanceof Error ? err.message : err)
  process.exit(1)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
