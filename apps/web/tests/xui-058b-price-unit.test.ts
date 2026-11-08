// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// XUI-058b: 智能体价格字段是「分」,web 三处直接按元渲染 ⇒ 金额放大 100 倍。
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8')

describe('XUI-058b web 智能体价格按分转元', () => {
  it('AgentGrid 卡片价格先 /100 再进 Intl 货币格式化', () => {
    const src = read('app', '(main)', 'agents', 'AgentGrid.tsx')
    expect(src).toMatch(/priceFmt\.format\(a\.price\s*\/\s*100\)/)
    expect(src).not.toMatch(/priceFmt\.format\(a\.price\)(?!\s*\/)/)
  })

  it('我的智能体列表 ¥ 前缀同样按分转元(保留两位)', () => {
    const src = read('app', '(main)', 'agents', 'my', 'page.tsx')
    expect(src).toMatch(/agent\.price\s*\/\s*100/)
    expect(src).not.toMatch(/¥\$\{agent\.price\}/)
  })

  it('后台智能体表格价格列按分转元', () => {
    const src = read('app', '(main)', 'admin', 'agents', 'AgentsTable.tsx')
    expect(src).toMatch(/priceFmt\.format\(a\.price\s*\/\s*100\)/)
    expect(src).not.toMatch(/priceFmt\.format\(a\.price\)(?!\s*\/)/)
  })
})
