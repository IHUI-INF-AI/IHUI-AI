// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// vitest 的 root 为 apps/web(见 RUN 行),用 cwd 相对定位仓库文件
// 从 constants.ts 源码动态解析 i18n 键名清单(不手抄,防止常量表与测试漂移)
const constantsSrc = readFileSync(
  resolve(process.cwd(), 'src/components/ai/spec-panel/constants.ts'),
  'utf8',
)

function block(name: string, closer: '}' | ']'): string {
  const re = new RegExp(`export const ${name}[\\s\\S]*?= [\\s\\S]*?\\n${closer}`)
  const m = constantsSrc.match(re)
  if (!m) throw new Error(`constants.ts 中未找到 export const ${name}`)
  return m[0]
}

/** 数组型常量:label: 'key' 形式的键名 */
const arrayKeys = [block('SCOPE_OPTIONS', ']'), block('TAB_OPTIONS', ']')].flatMap((b) =>
  [...b.matchAll(/label:\s*'([^']+)'/g)].map((m) => m[1]!),
)
/** Record 型常量:`xxx: 'key',` 的值位 */
const recordKeys = ['STATUS_LABEL', 'RISK_LABEL', 'BRANCH_STATUS_LABEL'].flatMap((name) =>
  [...block(name, '}').matchAll(/:\s*'([^']+)'/g)].map((m) => m[1]!),
)

const allKeys = [...arrayKeys, ...recordKeys]

/** 剥离注释后的纯代码(与硬编码中文扫描器口径一致:注释不计入) */
const codeOnly = constantsSrc
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n')
  .filter((line) => !line.trimStart().startsWith('//'))
  .join('\n')

describe('spec-panel constants 标签键化', () => {
  it('解析出非空键名清单且格式合法(camelCase,不含点/中文)', () => {
    expect(allKeys.length).toBeGreaterThanOrEqual(20)
    expect(new Set(allKeys).size).toBe(allKeys.length)
    for (const k of allKeys) {
      expect(k, `非法键名: ${k}`).toMatch(/^[a-z][A-Za-z0-9]*$/)
    }
  })

  it('constants.ts 非注释代码不再含 CJK 字符,且 label 值不再有中文字面量', () => {
    expect(codeOnly).not.toMatch(/[\u4e00-\u9fff]/)
    for (const labelMatch of codeOnly.matchAll(/label:\s*'([^']*)'/g)) {
      expect(labelMatch[1]).not.toMatch(/[\u4e00-\u9fff]/)
    }
  })

  it('每个键名都能在 web zh-CN 语言包 specPanel 命名空间解析到', () => {
    const messages = JSON.parse(
      readFileSync(resolve(process.cwd(), '../../packages/i18n/messages/web/zh-CN.json'), 'utf8'),
    ) as { specPanel?: Record<string, unknown> }
    const ns = messages.specPanel ?? {}
    const missing = allKeys.filter((k) => typeof ns[k] !== 'string' || ns[k] === '')
    expect(missing, `specPanel 命名空间缺键: ${missing.join(', ')}`).toEqual([])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
