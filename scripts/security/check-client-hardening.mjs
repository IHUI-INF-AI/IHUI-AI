#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- CLI 门需要 stdout 诊断 */
/**
 * 客户端安全面硬化检查(2026-11-24 立)。
 *
 * 桌面/移动端的安全边界与 web 不同:WebView 的 CSP 由壳配置、移动端的明文流量由
 * 平台清单决定,这些开关**不在服务端判据里**,回退时也没有任何 CI 会红。
 * 本门只钉「一旦回退就直接扩大攻击面」的六个开关,不做全量合规。
 *
 * 用法: node scripts/security/check-client-hardening.mjs [--update-baseline] [--json]
 * 退出码: 0 无新增 | 1 新增 | 2 未判定
 */
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defaultBaselinePath, listRepoFiles, readText, redactSnippet, runScanCli } from './lib/scan-lib.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..')

export const CLIENT_RULES = Object.freeze([
  { id: 'tauri-global-api', severity: 'high', re: /"withGlobalTauri"\s*:\s*true/, message: 'Tauri 把全部 API 挂到 window（任何 XSS 都能调原生能力）' },
  { id: 'tauri-csp-missing', severity: 'critical', re: /"csp"\s*:\s*(?:null|"")\s*,?/, message: 'Tauri CSP 被清空（WebView 无脚本来源限制）' },
  { id: 'tauri-csp-eval', severity: 'high', re: /'unsafe-eval'/, message: 'CSP 允许 unsafe-eval（动态代码执行）' },
  { id: 'tauri-disable-csp-mod', severity: 'high', re: /"dangerousDisableAssetCspModification"\s*:\s*true/, message: '关闭 Tauri CSP 资产改写保护' },
  { id: 'electron-node-integration', severity: 'critical', re: /nodeIntegration\s*:\s*true/, message: 'Electron 开启 nodeIntegration（渲染进程可执行任意命令）' },
  { id: 'electron-no-isolation', severity: 'critical', re: /contextIsolation\s*:\s*false/, message: 'Electron 关闭上下文隔离' },
  { id: 'electron-no-websecurity', severity: 'critical', re: /webSecurity\s*:\s*false/, message: 'Electron 关闭同源策略' },
  { id: 'ios-ats-open', severity: 'high', re: /"NSAllowsArbitraryLoads"\s*:\s*true/, message: 'iOS ATS 允许任意明文/弱 TLS' },
  { id: 'android-cleartext', severity: 'high', re: /usesCleartextTraffic[^\n]{0,12}(?:true|'true'|"true")/, message: 'Android 全局允许明文流量' },
  { id: 'public-secret', severity: 'high', re: /NEXT_PUBLIC_[A-Z0-9_]*(?:SECRET|PRIVATE_KEY|PASSWORD|API_KEY)/, message: 'NEXT_PUBLIC_ 前缀会把值打进客户端 bundle（密钥泄漏）' },
])

const TARGET_RE = /(?:tauri\.conf\.json|Info\.plist|AndroidManifest\.xml|app\.json|app\.config\.js|\.electron(?:rc)?|main\/index\.(?:js|ts)|src\/(?:main|preload)\.(?:js|ts))$|(?:^|\/)\.env/
const SCAN_EXTS = ['.json', '.js', '.cjs', '.mjs', '.ts', '.tsx', '.xml', '.plist']

function main() {
  const argv = process.argv.slice(2)
  const json = argv.includes('--json')
  const updateBaseline = argv.includes('--update-baseline')
  const strict = !argv.includes('--no-strict')
  const baselinePath = defaultBaselinePath(ROOT, 'client-hardening')

  const { files, error } = listRepoFiles(ROOT, { exts: SCAN_EXTS })
  const targets = files.filter((f) => TARGET_RE.test(f))
  const findings = []
  const skipped = []
  for (const file of targets) {
    const { text, skipped: why } = readText(ROOT, file)
    if (why) {
      skipped.push({ file, reason: why })
      continue
    }
    const lines = text.split(/\r?\n/)
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i]
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('#') || /security-exempt\s*:/.test(line)) continue
      for (const rule of CLIENT_RULES) {
        if (!rule.re.test(line)) continue
        findings.push({ file, line: i + 1, rule: rule.id, severity: rule.severity, message: rule.message, snippet: redactSnippet(line) })
      }
    }
  }

  const result = runScanCli({
    name: 'client-hardening',
    findings,
    skipped,
    baselinePath,
    strict,
    updateBaseline,
    root: ROOT,
    extraLines: [`扫描面 ${targets.length} 个客户端配置文件/入口（Tauri / Electron / iOS / Android / public env）`],
    unjudged: error,
  })
  if (json) console.log(JSON.stringify({ ok: result.code === 0, ...result.counts, findings }, null, 2))
  return result.code
}

const IS_MAIN = process.argv[1] && process.argv[1].endsWith('check-client-hardening.mjs')
if (IS_MAIN) process.exit(main())

export const __test__ = { CLIENT_RULES }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
