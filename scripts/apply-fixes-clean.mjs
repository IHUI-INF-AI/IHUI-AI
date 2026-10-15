// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// © 2026 IHUI AI · 干净一次性修复:从已恢复为 HEAD 的工作树出发:
//   1) 全局字符串级 {{ -> { 与 }} -> }(无值碰撞风险,JSON 结构不含 {{)
//   2) 内存中修正 字面量转义 / plural 补 } / folderPicker 分支
//   3) 写回(2 空格缩进,与现有格式一致,最小化 diff)
import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const MESSAGES_ROOT = join(root, 'packages/i18n/messages/web')
const LOCALES = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko']

function escICU(s) {
  return s.replace(/'/g, "''").replace(/[{}]/g, (m) => "'" + m + "'")
}
function getByPath(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj)
}
function setByPath(obj, path, val) {
  const segs = path.split('.')
  const last = segs.pop()
  const parent = segs.reduce((o, k) => (o == null ? o : o[k]), obj)
  parent[last] = val
}

const LITERAL_KEYS = [
  'developerPricingPage.codeNode',
  'developerPricingPage.codePython',
  'hooks.conditionHint',
  'checkin.deviceMapPlaceholder',
]
const PLURAL_BRACE_KEYS = [
  'ai.pane.agentActions.header.count',
  'ai.pane.injectionKindAutoContext',
  'ai.pane.injectionTitle',
  'ai.pane.injectionExpand',
  'multiAgentAction.header.count',
  'cloudChat.header.count',
  'cloudChat.turns',
]
const FOLDER_FIX = {
  en: '{count, plural, =0 {No folders} =1 {1 folder} other {# folders}}',
  'zh-CN': '{count, plural, =0 {无文件夹} =1 {1 个文件夹} other {# 个文件夹}}',
  'zh-TW': '{count, plural, =0 {無文件夾} =1 {1 個文件夾} other {# 個文件夾}}',
  ja: '{count, plural, =0 {フォルダなし} =1 {1 フォルダ} other {# フォルダ}}',
  ko: '{count, plural, =0 {폴더 없음} =1 {1 폴더} other {# 폴더}}',
}

let total = 0
for (const locale of LOCALES) {
  const file = join(MESSAGES_ROOT, `${locale}.json`)
  let raw = readFileSync(file, 'utf8')
  // 1) 全局双花括号
  const before = (raw.match(/\{\{/g) || []).length + (raw.match(/\}\}/g) || []).length
  raw = raw.replace(/\{\{/g, '{').replace(/\}\}/g, '}')
  // 2) 解析后内存修正
  const obj = JSON.parse(raw)
  let n = 0
  for (const key of LITERAL_KEYS) {
    const cur = getByPath(obj, key)
    if (typeof cur === 'string') {
      setByPath(obj, key, escICU(cur))
      n++
    }
  }
  for (const key of PLURAL_BRACE_KEYS) {
    const cur = getByPath(obj, key)
    if (typeof cur === 'string') {
      const need = (cur.match(/{/g) || []).length - (cur.match(/}/g) || []).length
      if (need > 0) {
        setByPath(obj, key, cur + '}'.repeat(need))
        n++
      }
    }
  }
  {
    const key = 'workspace.folderPicker.itemCount'
    const cur = getByPath(obj, key)
    if (typeof cur === 'string' && FOLDER_FIX[locale]) {
      setByPath(obj, key, FOLDER_FIX[locale])
      n++
    }
  }
  writeFileSync(file, JSON.stringify(obj, null, 2))
  total += n
  console.log(`${locale}: 全局双花括号 ${before} 处 + 内存修正 ${n} 处`)
}
console.log(`合计修正完成。`)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
