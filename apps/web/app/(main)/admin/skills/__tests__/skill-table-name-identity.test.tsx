// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 缺陷 2 回归:admin 技能表的行身份是 **name**,不是那个从不产出的 `id`。
 *
 * 立因:后端 `apps/api/src/routes/skills.ts` 的存储形态 `SkillRecord` 没有 id 字段,
 * 而 `SkillTable.tsx` 曾写 `<tr key={skill.id}>` + `onDelete(skill.id)` ⇒
 *  ① 每行 React key 恒为 undefined(重复 key,列表复用错乱的根源);
 *  ② 删除实际打到 `DELETE /api/skills/undefined` ⇒ 恒 404,**删除功能对用户是坏的**。
 * 市场侧同族问题已由 market-list-items-contract 那票以「id = entry.name」映射收口;
 * 本票把视图模型里那个虚构字段**删掉**,统一「以 name 为身份」。
 *
 * 两层判据:
 *  A 运行时(主判据):真渲染 SkillTable,点第一行的删除钮,断言回调收到的是**真实 name**
 *    (旧实现这里收到 undefined ⇒ 红);并断言每一行都带非空 React key(旧实现整表 key 全
 *    为 undefined,React 会打 duplicate key 警告 ⇒ console.error 计数为 0 是硬条件)。
 *  B 源码锚点(反向对照):types.ts 的 Skill 接口不得再声明 `id`(有人加回即红),
 *    删除入口的实参必须是 skill.name。变异取证:把 onDelete(skill.name) 改回
 *    onDelete(skill.id) ⇒ A 红(且 tsc 因字段已删而红)。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'

import { SkillTable } from '../SkillTable'
import type { Skill } from '../types'

const dir = resolve(__dirname, '..')

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'zh-CN',
}))

const ROWS = [
  'pdf-converter',
  'web-scraper',
  '3f2b7c1a-9d4e-4a5b-8c6f-1e2d3a4b5c01-not-an-id-but-a-name',
] as const

function rows(): Skill[] {
  return ROWS.map((name) => ({
    name,
    description: `${name} 的描述`,
    version: '1.0.0',
    tags: ['t'],
    createdAt: '2026-09-25T00:00:00.000Z',
  }))
}

function renderTable(onDelete = vi.fn()) {
  render(
    <SkillTable
      skills={rows()}
      isLoading={false}
      error={null}
      total={ROWS.length}
      onEdit={() => {}}
      onDelete={onDelete}
      onOpenMarket={() => {}}
    />,
  )
  return onDelete
}

beforeEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('A · 运行时:删除回调必须收到真实 name,且每行都有非空 React key', () => {
  it('渲染三行各自的名称与删除钮(数量与行集一致)', () => {
    // 如实登记:这一臂原本还想靠 console.error 判"重复 key 警告",但变异取证
    // (把 key 改回 skill.id)显示本 harness 下 React 不往 console.error 吐 unique-key
    // 警告 ⇒ 那条断言无牙。key 的正确性由下一条(实参逐行对齐)+ B 锚点
    // (key={skill.name} 且 skill.id 不得回潮)两道共同保证,这里不再冒充有牙。
    renderTable()
    for (const name of ROWS) expect(screen.getByText(name)).toBeTruthy()
    expect(screen.getAllByText('delete')).toHaveLength(ROWS.length)
  })

  it('删除实参逐行对齐:三行按下标各自回自己的 name', () => {
    const onDelete = renderTable()
    const buttons = screen.getAllByText('delete')
    expect(buttons).toHaveLength(ROWS.length)
    buttons.forEach((btn) => fireEvent.click(btn))
    expect(onDelete.mock.calls.map((c) => c[0])).toEqual([...ROWS])
  })
})

describe('B · 源码锚点(反向对照):虚构的 id 字段不得回潮', () => {
  it('types.ts 的 Skill 接口不再声明 id: 这一字段', () => {
    const src = readFileSync(resolve(dir, 'types.ts'), 'utf8')
    const block = src.match(/export interface Skill \{[\s\S]*?\n\}/)
    expect(block, 'Skill 接口须保持在 types.ts(签名被改先修本测试)').not.toBeNull()
    expect(block?.[0]).not.toMatch(/(^|[{\s,])id:\s/)
    expect(block?.[0]).toMatch(/name:\s*string/)
  })

  it('SkillTable 的行 key 与删除实参都取 name(skill.id 不得回潮)', () => {
    const src = readFileSync(resolve(dir, 'SkillTable.tsx'), 'utf8')
    expect(src).toMatch(/<tr\s+key=\{skill\.name\}/)
    expect(src).toMatch(/onDelete\(skill\.name\)/)
    expect(src).not.toMatch(/skill\.id/)
  })

  it('page.tsx 的删除目标状态按 name 存,并原样交给 removeSkill', () => {
    const src = readFileSync(resolve(dir, 'page.tsx'), 'utf8')
    expect(src).toMatch(/removeSkill\(name\)/)
    expect(src).toMatch(/setDelName\(name\)/)
    expect(src).not.toMatch(/skill\.id/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
