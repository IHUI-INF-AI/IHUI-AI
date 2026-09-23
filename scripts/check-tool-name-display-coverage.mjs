// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 工具名显示覆盖率守门(D54 / H16,2026-09-21 立)。
 *
 * 判据:`apps/ai-service/app/services/mcp_server.py` 的自研工具注册表 `_TOOLS` 里每一个
 * `name="..."` 都必须在 `packages/shared/src/chat/tool-display.ts` 的 `TOOL_DISPLAY_KEYS`
 * 有对应 display key,且该 key 在五语言 `packages/i18n/messages/shared/*.json` 的 `taskStatus`
 * 里都真的有值。三者任一缺失即 exit 1(blocking)。
 *
 * 为什么必须是静态脚本而不是运行时兜底:界面禁止把 `read_file` / `browser_click_element` 这类
 * 英文码名当作用户可见文案。运行时"回落原展示"是必要的兜底,但它同时会让新增工具**静默地**
 * 带着英文码名上线 —— 只有静态比对能拦住这件事。
 *
 * 用法:
 *   node scripts/check-tool-name-display-coverage.mjs            # 全量
 *   node scripts/check-tool-name-display-coverage.mjs --staged   # pre-commit 模式(同全量,注册表变更需同批改词表)
 *   node scripts/check-tool-name-display-coverage.mjs --json     # 机器可读输出
 */
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const LANGS = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko']

/** 从 mcp_server.py 的 _TOOLS 字面量里提取注册工具名(方括号配平,避开 list[MCPTool] 的假锚点) */
export function extractRegisteredToolNames(pyText) {
  const start = pyText.indexOf('_TOOLS: list[MCPTool] = [')
  if (start === -1) throw new Error('找不到 _TOOLS 注册表锚点(mcp_server.py 结构变更?)')
  const open = pyText.indexOf('= [', start)
  if (open === -1) throw new Error('_TOOLS 锚点后找不到字面量起点')
  let depth = 0
  let end = -1
  for (let i = open + 2; i < pyText.length; i += 1) {
    if (pyText[i] === '[') depth += 1
    else if (pyText[i] === ']') {
      depth -= 1
      if (depth === 0) {
        end = i
        break
      }
    }
  }
  if (end === -1) throw new Error('_TOOLS 字面量方括号未配平')
  const block = pyText.slice(start, end + 1)
  return [...new Set([...block.matchAll(/name=["']([a-z0-9_]+)["']/g)].map((m) => m[1]))].sort()
}

/** 从 tool-display.ts 取 工具名 → display key 映射(只认对象字面量里的 `name: 'key',` 行) */
export function extractDisplayKeyMap(tsText) {
  const start = tsText.indexOf('const TOOL_DISPLAY_KEYS')
  if (start === -1) throw new Error('找不到 TOOL_DISPLAY_KEYS')
  const end = tsText.indexOf('\n}', start)
  const block = tsText.slice(start, end === -1 ? tsText.length : end)
  const map = new Map()
  for (const m of block.matchAll(/^\s*([a-z0-9_]+):\s*'([A-Za-z0-9_]+)'/gm)) map.set(m[1], m[2])
  return map
}

async function main() {
  const json = process.argv.includes('--json')
  const pyText = readFileSync(resolve(ROOT, 'apps/ai-service/app/services/mcp_server.py'), 'utf8')
  const tsText = readFileSync(resolve(ROOT, 'packages/shared/src/chat/tool-display.ts'), 'utf8')
  const locales = {}
  for (const lang of LANGS) {
    const parsed = JSON.parse(readFileSync(resolve(ROOT, `packages/i18n/messages/shared/${lang}.json`), 'utf8'))
    locales[lang] = parsed.taskStatus ?? {}
  }

  const names = extractRegisteredToolNames(pyText)
  const map = extractDisplayKeyMap(tsText)
  const unmapped = names.filter((n) => !map.has(n))
  const missingI18n = []
  for (const name of names) {
    const key = map.get(name)
    if (!key) continue
    for (const lang of LANGS) {
      if (typeof locales[lang][key] !== 'string' || locales[lang][key].trim() === '') {
        missingI18n.push(`${lang}.taskStatus.${key} (工具 ${name})`)
      }
    }
  }
  // 反向:词表里有映射但注册表已不存在的工具名不算错(历史工具仍在界面出现于旧消息),只报信息
  const stale = [...map.keys()].filter((n) => !names.includes(n))

  const result = {
    registered: names.length,
    mapped: names.length - unmapped.length,
    unmapped,
    missingI18n,
    staleMapped: stale.length,
    ok: unmapped.length === 0 && missingI18n.length === 0,
  }

  if (json) {
    console.log(JSON.stringify(result))
    process.exit(result.ok ? 0 : 1)
  }
  if (result.ok) {
    console.log(
      `[tool-name-coverage] ✅ ${result.registered}/${names.length} 工具名有本地化功能名,五语言 taskStatus 全有值(词表另含 ${stale.length} 个未注册历史名)`,
    )
    return 0
  }
  console.error(`[tool-name-coverage] ❌ 覆盖率 ${result.mapped}/${result.registered}`)
  if (unmapped.length) {
    console.error(`  未映射工具名(${unmapped.length}):${unmapped.join(', ')}`)
  }
  if (missingI18n.length) {
    console.error(`  缺 i18n 值(${missingI18n.length}):${missingI18n.slice(0, 20).join('; ')}`)
  }
  console.error(
    '  修法:在 packages/shared/src/chat/tool-display.ts 的 TOOL_DISPLAY_KEYS 补 name → toolXxx,' +
      '并给 packages/i18n/messages/shared/{zh-CN,zh-TW,en,ja,ko}.json 的 taskStatus 补 toolXxx 五语言文案。',
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
