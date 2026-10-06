#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * check-cli-i18n-parity.mjs - Guard: verify packages/i18n/messages/cli/*.json
 * key parity across all 5 locales (zh-CN, en, ja, ko, zh-TW).
 *
 * cli 域 i18n 已下沉到 packages/i18n(2026-07-27 立),本脚本确保 5 语言键集合一致,
 * 防止翻译遗漏导致 cli --help 多语言切换时显示原始 key 而非译文。
 *
 * Usage:
 *   node scripts/check-cli-i18n-parity.mjs            # exit 0 on OK, 1 on drift
 *   node scripts/check-cli-i18n-parity.mjs --quiet    # errors only
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const CLI_I18N_DIR = join(root, 'packages/i18n/messages/cli')
const REQUIRED_LOCALES = ['zh-CN', 'en', 'ja', 'ko', 'zh-TW']

function getAllKeys(obj, prefix = '') {
  const keys = []
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) return keys
  for (const [k, v] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${k}` : k
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      keys.push(...getAllKeys(v, fullKey))
    } else {
      keys.push(fullKey)
    }
  }
  return keys
}

function loadLocaleKeys(locale) {
  const file = join(CLI_I18N_DIR, `${locale}.json`)
  if (!existsSync(file)) return null
  const content = readFileSync(file, 'utf8')
  try {
    const data = JSON.parse(content)
    return new Set(getAllKeys(data))
  } catch {
    return null
  }
}

async function main() {
  const quiet = process.argv.includes('--quiet')
  if (!existsSync(CLI_I18N_DIR)) {
    if (!quiet) console.log('[OK] cli i18n directory does not exist, skipping')
    process.exit(0)
  }
  const existing = readdirSync(CLI_I18N_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.replace('.json', ''))
    .filter((l) => REQUIRED_LOCALES.includes(l))

  if (existing.length === 0) {
    if (!quiet) console.log('[OK] cli i18n files not yet present, skipping')
    process.exit(0)
  }

  const localeKeys = {}
  for (const loc of existing) {
    const keys = loadLocaleKeys(loc)
    if (keys === null) {
      console.error(`[FAIL] cli/${loc}.json is invalid JSON`)
      process.exit(1)
    }
    localeKeys[loc] = keys
  }

  const baseline = localeKeys[existing[0]]
  const failures = []
  for (const loc of existing) {
    if (localeKeys[loc].size !== baseline.size) {
      failures.push(`cli/${loc}.json has ${localeKeys[loc].size} keys, expected ${baseline.size}`)
    }
    for (const key of baseline) {
      if (!localeKeys[loc].has(key)) failures.push(`cli/${loc}.json missing key: ${key}`)
    }
  }

  if (failures.length === 0) {
    if (!quiet) console.log(`[OK] cli i18n parity: ${existing.length} locales, ${baseline.size} keys each`)
    process.exit(0)
  }
  console.error('[FAIL] cli i18n parity drift:')
  for (const f of failures) console.error(`  - ${f}`)
  console.error(`Fix: add missing keys to ${CLI_I18N_DIR}/*.json (use zh-CN as source of truth)`)
  process.exit(1)
}

// §22d:CLI 直接执行才跑主流程;镜像测试 import 判据函数时不得有副作用
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  main().catch((e) => {
    console.error(`[ERROR] check-cli-i18n-parity 脚本执行异常: ${e?.message ?? e}`)
    process.exit(2)
  })
}

// §22c:判据单元经 __test__ 暴露给镜像测试,测试不得另抄一遍检测逻辑
export const __test__ = {
  CLI_I18N_DIR,
  REQUIRED_LOCALES,
  getAllKeys,
  loadLocaleKeys,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
