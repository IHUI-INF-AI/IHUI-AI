// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { jsonLdHtml } from '../json-ld'

describe('jsonLdHtml:JSON-LD 内联载荷的唯一出口', () => {
  it('载荷里的 `<` 一律转义,`</script>` 无法提前闭合脚本标签', () => {
    const html = jsonLdHtml({ name: '</script><img src=x onerror=alert(1)>' })
    expect(html).not.toContain('<')
    expect(html).toContain('\\u003c/script>')
  })

  it('转义后仍是合法 JSON:解析回来与输入逐字相等(安全不得改数据)', () => {
    const payload = {
      '@type': 'Product',
      name: 'A&B',
      description: 'a<b && c>d',
      offers: [{ price: 1 }],
    }
    expect(JSON.parse(jsonLdHtml(payload))).toEqual(payload)
  })

  it('不含 `<` 的载荷与 JSON.stringify 逐字同形(不为了安全多塞别的东西)', () => {
    expect(jsonLdHtml({ a: 1, b: [true, null] })).toBe('{"a":1,"b":[true,null]}')
  })

  it('源面上不许回潮:每个 ld+json 注入点都必须走 jsonLdHtml(多行形态同样计入)', () => {
    const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..')
    const sources: { label: string; text: string }[] = []
    for (const dir of ['app', 'src']) {
      for (const rel of readdirSync(join(webRoot, dir), { recursive: true }) as string[]) {
        if (!/\.(tsx|ts)$/.test(rel)) continue
        const file = join(webRoot, dir, rel)
        if (file.endsWith(join('lib', 'seo', 'json-ld.ts'))) continue
        sources.push({ label: relative(webRoot, file), text: readFileSync(file, 'utf8') })
      }
    }

    const offenders: string[] = []
    let injections = 0
    for (const { label, text } of sources) {
      const count = (text.match(/type=("|')application\/ld\+json\1/g) ?? []).length
      if (count === 0) continue
      injections += count
      const calls = (text.match(/jsonLdHtml\(/g) ?? []).length
      if (!/from\s+("|')@\/lib\/seo\/json-ld\1/.test(text)) {
        offenders.push(`${label}:缺 jsonLdHtml 导入`)
      } else if (calls < count) {
        offenders.push(`${label}:注入点 ${count} > 出口调用 ${calls}`)
      }
    }
    for (const { label, text } of sources) {
      if (/__html:\s*JSON\.stringify/.test(text))
        offenders.push(`${label}:__html 直塞 JSON.stringify`)
    }

    expect(injections).toBeGreaterThan(0)
    expect(offenders).toEqual([])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
