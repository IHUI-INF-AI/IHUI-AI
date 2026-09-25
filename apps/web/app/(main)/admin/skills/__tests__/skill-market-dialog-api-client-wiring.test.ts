// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 装车证明(AGENTS.md §3 共享层优先 / 守门 73 同族):admin 技能市场对话框的后端调用
// 必须经 @ihui/api-client 出口,不得回退为页面内 api() 直连拼 URL;同时钉死
// install/unlist 的端点路径语义(禁止有人把 unlist 硬删"顺手"改成 listing 翻转)。
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const dialogFile = resolve(here, '..', 'SkillMarketDialog.tsx')
// here = apps/web/app/(main)/admin/skills/__tests__ → 上溯 7 级到仓库根
const skillsMarketFile = resolve(
  here,
  '..',
  '..',
  '..',
  '..',
  '..',
  '..',
  '..',
  'packages',
  'api-client',
  'src',
  'endpoints',
  'skills-market.ts',
)

describe('SkillMarketDialog 走 @ihui/api-client(共享层优先)', () => {
  const src = readFileSync(dialogFile, 'utf8')

  it('从 @ihui/api-client 导入 installSkill / unlistSkill', () => {
    expect(src).toMatch(
      /import\s*\{[^}]*\binstallSkill\b[^}]*\bunlistSkill\b[^}]*\}\s*from\s*'@ihui\/api-client'/,
    )
  })

  it('不再从 ./helpers 导入 api,页面内无 api( 直连、无裸 fetch', () => {
    expect(src).not.toMatch(/\bapi\s*\(/)
    expect(src).not.toMatch(/\bfetch\s*\(/)
    expect(src).not.toMatch(/from\s*'\.\/helpers'[^;]*\bapi\b/)
  })

  it('失败仍按原语义抛错(mutation 错误分支不变)', () => {
    // 两处 mutationFn 各自把 !success 转成 throw,保证 react-query isError 行为与原 api() 一致
    const throws = src.match(/if \(!r\.success\) throw new Error\(r\.error\)/g) ?? []
    expect(throws).toHaveLength(2)
  })
})

describe('api-client skills-market 出口路径语义钉死', () => {
  const src = readFileSync(skillsMarketFile, 'utf8')

  it('installSkill 打 /install,unlistSkill 打 /unlist(不得被改成 /listing 翻转)', () => {
    // 模板字符串结尾是反引号,不是引号 —— 正则须按源码真实形态匹配
    expect(src).toMatch(/export function installSkill[\s\S]*?\/install`/)
    expect(src).toMatch(/export function unlistSkill[\s\S]*?\/unlist`/)
  })

  it('listing 级出口与 unlist 硬删并存且相互独立(setSkillListing 未被挪用替代)', () => {
    expect(src).toMatch(/export function setSkillListing[\s\S]*?\/listing`/)
    expect(src).toMatch(/export function unlistSkill/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
