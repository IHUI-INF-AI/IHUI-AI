// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 工具功能名"在各端真的取到值"守门(2026-09-21 立)。
 *
 * 拦两类**静默**失败(都在本轮真实踩过):
 *  1. shared 词表加了映射,但某语言 / 某端语言包没有对应 taskStatus 键 →
 *     端内取词器(点号全路径 + 缺键回显键名)会把 `read_file` 显示成 `toolReadFile`;
 *     断言"界面不含 read_file"仍然通过,肉眼也看不出。
 *  2. miniapp-taro 的离线压缩语言包 `remote-locales.gen.ts` 忘了重生 →
 *     非中文端整块掉回中文/键名(实测 taskStatus 键数 13 vs shared 139)。
 *
 * 判据:对 TOOL_DISPLAY_KEYS 的每个 display key,
 *   - shared/<lang>.json 的 taskStatus[key] 必须是非空字符串且不等于键名;
 *   - 每个端语言包与 shared 深合并后(端 override 优先)同样必须解析出值;
 *   - miniapp-taro 生成物里 5 语言载荷各自必须解析出值(过期即红)。
 *
 * 用法:
 *   node scripts/check-tool-display-resolvable.mjs            # 全量
 *   node scripts/check-tool-display-resolvable.mjs --json     # 机读
 * 紧急跳过:HUSKY_SKIP_TOOL_DISPLAY_RESOLVABLE=1 git commit ...
 */
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const LANGS = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko']
const END_DIRS = ['web', 'extension', 'miniapp-taro', 'mobile-rn', 'cli']

/** 与 packages/i18n/src/loader.ts:mergeMessages 同语义(先铺 base,再遍历 override) */
export function mergeMessages(base, override) {
  const result = { ...base }
  for (const key of Object.keys(override ?? {})) {
    const val = override[key]
    const baseVal = result[key]
    if (
      val &&
      typeof val === 'object' &&
      !Array.isArray(val) &&
      baseVal &&
      typeof baseVal === 'object' &&
      !Array.isArray(baseVal)
    ) {
      result[key] = mergeMessages(baseVal, val)
    } else if (val !== undefined) {
      result[key] = val
    }
  }
  return result
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(resolve(ROOT, path), 'utf8'))
  } catch {
    return {}
  }
}

/** 从词表源码里取 工具名 → display key(只认对象字面量内的 `name: 'key'` 行) */
export function extractDisplayKeys(tsText) {
  const start = tsText.indexOf('const TOOL_DISPLAY_KEYS')
  if (start === -1) throw new Error('找不到 TOOL_DISPLAY_KEYS')
  const end = tsText.indexOf('\n}', start)
  const block = tsText.slice(start, end === -1 ? tsText.length : end)
  return [...new Set([...block.matchAll(/^\s*[a-z0-9_]+:\s*'([A-Za-z0-9_]+)'/gm)].map((m) => m[1]))].sort()
}

/**
 * miniapp-taro 离线包只装**远程语言**(zh-CN 由 JSON 直接随包发,见生成器 REMOTE_LOCALES),
 * 按 `en: '…'` / `'zh-TW': '…'` 两种形态取载荷。生成器格式变更时宁可报错也不要静默放过。
 */
export function remoteLocaleList(generatorText) {
  const m = /const REMOTE_LOCALES\s*=\s*\[([^\]]*)\]/.exec(generatorText)
  if (!m) return null
  return [...m[1].matchAll(/['"]([\w-]+)['"]/g)].map((x) => x[1])
}

export function decodeTaroBundle(genText, locales) {
  const out = {}
  for (const lang of locales) {
    const m = new RegExp(`['"]?${lang}['"]?\\s*:\\s*'([A-Za-z0-9+/=]+)'`).exec(genText)
    if (!m) {
      out[lang] = null
      continue
    }
    try {
      out[lang] = JSON.parse(gunzipSync(Buffer.from(m[1], 'base64')).toString('utf8'))
    } catch {
      out[lang] = null
    }
  }
  return out
}

async function main() {
  const json = process.argv.includes('--json')
  const tsText = readFileSync(resolve(ROOT, 'packages/shared/src/chat/tool-display.ts'), 'utf8')
  const displayKeys = extractDisplayKeys(tsText)
  if (displayKeys.length === 0) throw new Error('词表解析出 0 个 display key(源码格式变更?)')

  const failures = []
  const sharedByLang = {}
  for (const lang of LANGS) {
    sharedByLang[lang] = readJson(`packages/i18n/messages/shared/${lang}.json`)
  }

  const check = (where, bucket, key) => {
    const value = bucket?.[key]
    if (typeof value !== 'string' || value.trim() === '' || value === key) {
      failures.push(`${where} → taskStatus.${key}`)
    }
  }

  for (const lang of LANGS) {
    const sharedTask = sharedByLang[lang]?.taskStatus ?? {}
    for (const key of displayKeys) {
      check(`shared/${lang}`, sharedTask, key)
      for (const dir of END_DIRS) {
        const merged = mergeMessages(sharedByLang[lang], readJson(`packages/i18n/messages/${dir}/${lang}.json`))
        check(`${dir}/${lang}`, merged.taskStatus ?? {}, key)
      }
    }
  }

  // 生成物:小程序离线包必须与词表同步(忘跑 pnpm gen:i18n 即红)
  const genPath = 'apps/miniapp-taro/src/i18n/generated/remote-locales.gen.ts'
  const remote =
    remoteLocaleList(readFileSync(resolve(ROOT, 'apps/miniapp-taro/scripts/gen-i18n-compressed.mjs'), 'utf8')) ?? LANGS
  const bundle = decodeTaroBundle(readFileSync(resolve(ROOT, genPath), 'utf8'), remote)
  for (const lang of remote) {
    if (!bundle[lang]) {
      failures.push(`${genPath} 解不出 ${lang} 载荷(生成物过期或格式变更,需 pnpm gen:i18n)`)
      continue
    }
    for (const key of displayKeys) check(`taro-gen/${lang}`, bundle[lang].taskStatus ?? {}, key)
  }

  const k = displayKeys.length
  const result = {
    displayKeys: k,
    // shared 1 份 + 各端合并视图 + 小程序离线包(仅远程语言)
    checked: k * LANGS.length * (1 + END_DIRS.length) + k * remote.length,
    failures,
  }
  if (json) {
    console.log(JSON.stringify(result))
    process.exit(failures.length ? 1 : 0)
  }
  if (failures.length === 0) {
    console.log(
      `[tool-display-resolvable] ✅ ${displayKeys.length} 个工具功能名在 ${LANGS.length} 语言 ×(shared + ${END_DIRS.length} 端 + taro 生成物)全部取到值,共比对 ${result.checked} 项`,
    )
    return 0
  }
  console.error(`[tool-display-resolvable] ❌ ${failures.length} 处取不到值(会回显键名或掉回中文):`)
  for (const line of failures.slice(0, 25)) console.error(`  - ${line}`)
  if (failures.length > 25) console.error(`  …另 ${failures.length - 25} 处`)
  console.error(
    '  修法:补 packages/i18n/messages/shared/<lang>.json 的 taskStatus 键(5 语言齐全),' +
      '改完必须跑 cd apps/miniapp-taro && pnpm gen:i18n 重生成离线语言包。',
  )
  return 1
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main()
    .then((code) => {
      if (typeof code === 'number' && code !== 0) process.exit(code)
    })
    .catch((error) => {
      console.error(`❌ ${error?.message ?? error}`)
      process.exit(2)
    })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
