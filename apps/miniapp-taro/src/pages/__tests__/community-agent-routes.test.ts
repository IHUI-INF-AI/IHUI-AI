// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * XUI-018 接线锁(小程序社区 → AI 助手/团队)。
 * 旧实现仍跳已随分包迁移删除的 /pages/tools/*,点击无反应;现行在册路径为 pkg-ai 分包。
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const APP_ROOT = join(__dirname, '..', '..', '..')
const read = (p: string) => readFileSync(join(APP_ROOT, p), 'utf8')

const MY_AGENTS = read('src/pages/community/components/MyAgents.tsx')
const RECENT_AGENTS = read('src/pages/community/components/RecentAgents.tsx')
const COMMUNITY = read('src/pages/community/index.tsx')
const APP_CONFIG = read('src/app.config.ts')

/** 接线判据:正反两面对同一实现 */
export function detectCommunityRoutes(src: string): string[] {
  const missing: string[] = []
  if (src.includes("'/pages/tools/")) missing.push('legacy /pages/tools route')
  if (!src.includes("'/pkg-ai/ai-assistant/index'")) missing.push('assistant route')
  if (!src.includes("'/pkg-ai/ai-assistant-n8n/index'")) missing.push('n8n assistant route')
  return missing
}

export function detectGroupRoute(src: string): string[] {
  const missing: string[] = []
  if (src.includes("'/pages/tools/ai_group/index'")) missing.push('legacy group route')
  if (!src.includes("'/pkg-ai/ai-group/index'")) missing.push('group route')
  return missing
}

describe('XUI-018 社区入口路由必须命中在册页面', () => {
  it('MyAgents:助手/n8n 路由已迁到 pkg-ai,且无旧 /pages/tools', () => {
    expect(detectCommunityRoutes(MY_AGENTS)).toEqual([])
  })

  it('RecentAgents:同上', () => {
    expect(detectCommunityRoutes(RECENT_AGENTS)).toEqual([])
  })

  it('community 列表选中走 pkg-ai 助手页', () => {
    expect(COMMUNITY).toContain('`/pkg-ai/ai-assistant/index?agentId=')
    expect(COMMUNITY).not.toContain('url: `/pages/tools/ai_assistant')
  })

  it('MyAgents 团队入口走 pkg-ai/ai-group', () => {
    expect(detectGroupRoute(MY_AGENTS)).toEqual([])
  })

  it('反向对照:旧 /pages/tools 实现必须判红', () => {
    const oldImpl = `
function goToTeam() { Taro.navigateTo({ url: '/pages/tools/ai_group/index' }) }
const targetUrl = agent.source === 'n8n' ? '/pages/tools/ai_assistant_n8n' : '/pages/tools/ai_assistant'
`
    expect(detectCommunityRoutes(oldImpl)).toContain('legacy /pages/tools route')
    expect(detectCommunityRoutes(oldImpl)).toContain('assistant route')
    expect(detectGroupRoute(oldImpl)).toEqual(['legacy group route', 'group route'])
  })

  it('这些页面确实注册在 app.config.ts', () => {
    expect(APP_CONFIG).toContain("'ai-assistant/index'")
    expect(APP_CONFIG).toContain("'ai-assistant-n8n/index'")
    expect(APP_CONFIG).toContain("'ai-group/index'")
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
