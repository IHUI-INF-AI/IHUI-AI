// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 门 8 死调用清账(第一批五处)的防回潮源锁(2026-09-28)。
// 纯静态断言,不连库不发网络请求(§5 测试隔离铁律;姿势照 b127-outbound-route-fix.test.ts)。
// 分工:路由**存在性**由守门 8 每次提交现判(修好的调用若被后端摘路由会当场新增判红);
// 本测试钉的是**客户端形态**——修对的路径不得被改回从未注册的旧路径。
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const read = (rel: string): string =>
  readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')

/** 剥 // 行注释与 /* *\/ 块注释(修账注释里允许引用旧路径说明历史,b127 同纪律)。 */
const stripComments = (s: string): string =>
  s.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')

const course = read('../../../packages/api-client/src/endpoints/course.ts')
const developer = read('../../../packages/api-client/src/endpoints/developer.ts')
const learn = read('../../../packages/api-client/src/endpoints/learn.ts')
const payment = read('../../../packages/api-client/src/endpoints/payment.ts')
const aiMedia = read('../../../packages/api-client/src/endpoints/ai-media.ts')
const community = read('../../../packages/api-client/src/endpoints/community.ts')
const ai = read('../../../packages/api-client/src/endpoints/ai.ts')

describe('getCategories → GET /api/learn/categories(旧 /api/course/categories 从未注册)', () => {
  const fn = course.slice(course.indexOf('export async function getCategories'))
  const body = fn.slice(0, fn.indexOf('\nexport') > 0 ? fn.indexOf('\nexport') : fn.length)
  it('新路径在位且旧路径不回潮', () => {
    expect(body).toContain("'/api/learn/categories'")
    expect(body).not.toContain('/api/course/categories')
  })
  it('后端 { list } 包裹必须被解包(消费方 category.ts 直接把 data 当数组用)', () => {
    expect(body).toContain('res.data.list')
  })
})

describe('OAuth 授权两面 → /api/auth/oauth/my-authorized(旧 /api/oauth-apps/* 从未注册)', () => {
  const code = stripComments(developer)
  it('列表与撤销都指真路由;旧路径不回潮', () => {
    expect(code).toContain("'/api/auth/oauth/my-authorized'")
    expect(code).toContain('/api/auth/oauth/my-authorized/${encodeURIComponent(id)}')
    expect(code).not.toContain('oauth-apps/authorizations')
    expect(code).not.toContain('/api/oauth-apps/my-authorized')
  })
  it('撤销返回体按后端真形状 { deleted } 声明(不是假 { success })', () => {
    const fn = developer.slice(developer.indexOf('export async function revokeAuthorization'))
    expect(fn.slice(0, 400)).toContain('deleted')
  })
})

describe('会员等级 PUT/DELETE → id 在体/在 query(旧 /:id 形态从未注册)', () => {
  it('PUT /api/admin/members/levels 且 id 进 body', () => {
    // 2026-10-22 对齐真注册面:PUT/DELETE /members/levels 只在 adminMemberRoutes 里
    // (member.ts:559 起,746/760),routes/index.ts:622 挂 /api/admin ⇒ 真路径
    // /api/admin/members/levels;第一批清账(60594944da)把客户端钉在 /api/members/levels
    // 实为 404 死调用,G-962 批 5 已把 learn.ts 全族会员等级端点纠正到 admin 面。
    const fn = learn.slice(learn.indexOf('export async function updateMemberLevel'))
    const body = fn.slice(0, fn.indexOf('\nexport') > 0 ? fn.indexOf('\nexport') : fn.length)
    expect(body).toContain("'/api/admin/members/levels'")
    expect(body).toContain('JSON.stringify({ id, ...input })')
    expect(body).not.toContain('/api/members/levels/${id}')
  })
  it('DELETE /api/members/levels 且 id 走 query', () => {
    const fn = learn.slice(learn.indexOf('export async function deleteMemberLevel'))
    const body = fn.slice(0, fn.indexOf('\nexport') > 0 ? fn.indexOf('\nexport') : fn.length)
    expect(body).toContain('buildQs({ id })')
    expect(body).not.toContain('/api/members/levels/${id}')
  })
})

describe('getWithdrawalStatus → GET 无体(旧 POST 从未注册,昵称/openId 后端从未读)', () => {
  const fn = payment.slice(payment.indexOf('export async function getWithdrawalStatus'))
  const body = fn.slice(0, fn.indexOf('\nexport') > 0 ? fn.indexOf('\nexport') : fn.length)
  it('GET 真路由,POST/死参数不回潮', () => {
    expect(body).toContain("'/api/finance/withdrawal/getWithdrawal'")
    expect(body).not.toContain("method: 'POST'")
    expect(body).not.toContain('nickname')
    expect(body).not.toContain('openId')
  })
})

describe('公告/会员分组管理页 → /api/admin/*(G-962 台账 7 条的防回潮)', () => {
  // 台账已了结这 7 条(admin 页面写口改挂真注册面),这层钉子防"改回旧前缀"后再造 404。
  const announcementsPage = stripComments(
    read('../../../apps/web/app/(main)/admin/announcements/page.tsx'),
  )
  const groupsPage = stripComments(
    read('../../../apps/web/app/(main)/admin/member-groups/page.tsx'),
  )
  const groupsHelpers = stripComments(
    read('../../../apps/web/app/(main)/admin/member-groups/helpers.ts'),
  )
  it('公告 增/改/删 全在 /api/admin/announcements(与 adminContentRoutes 同面)', () => {
    expect(announcementsPage).toContain('/api/admin/announcements/${editing.id}')
    expect(announcementsPage).toContain("'/api/admin/announcements'")
    expect(announcementsPage).toContain('/api/admin/announcements/${id}')
    expect(announcementsPage).not.toContain('/api/announcements/')
    expect(announcementsPage).not.toContain("'/api/announcements'")
  })
  it('会员分组 列表/增/改/删 全在 /api/admin/members/groups(member.ts adminMemberRoutes)', () => {
    expect(groupsHelpers).toContain('/api/admin/members/groups?pageSize=200')
    expect(groupsPage).toContain('/api/admin/members/groups/${editing.id}')
    expect(groupsPage).toContain("'/api/admin/members/groups'")
    expect(groupsPage).toContain('/api/admin/members/groups/${id}')
    expect(groupsPage).not.toContain('/api/members/groups')
  })
})

describe('relay 渠道组注册前缀只给 /api(旧 /api/admin 叠成 /api/admin/admin/relay/*,11 条前端 404)', () => {
  // 该插件每个 server.* 路径都自带 /admin 段(relay-channels.ts),与 relay-account-pool 同款;
  // 注册处再叠 admin 会让真路径多一层,前端按注释写 /api/admin/relay/* 反而全 404。
  const indexSrc = stripComments(read('../../../apps/api/src/routes/index.ts'))
  const relayPage = stripComments(
    read('../../../apps/web/app/(main)/admin/relay/channels/page.tsx'),
  )
  it('注册前缀 = /api', () => {
    expect(indexSrc).toContain("server.register(adminRelayChannelsRoutes, { prefix: '/api' })")
    expect(indexSrc).not.toContain("server.register(adminRelayChannelsRoutes, { prefix: '/api/admin' })")
  })
  it('前端 11 处仍走 /api/admin/relay/channels/*,不出现双 admin', () => {
    expect(relayPage).toContain('/api/admin/relay/channels/groups')
    expect(relayPage).toContain('/api/admin/relay/channels/batch-toggle')
    expect(relayPage).not.toContain('/api/admin/admin/')
  })
})

describe('community 问答改稿 → PATCH(旧 PUT 在 /api/asks 两面都未注册)', () => {
  const code = stripComments(community)
  const fnBody = (name: string, next: string): string => {
    const from = code.indexOf(`export async function ${name}`)
    return code.slice(from, code.indexOf(`export async function ${next}`, from))
  }
  it('updateAsk / updateAnswer 用 PATCH(community/asks.ts:208 与 ask-extended.ts:48)', () => {
    expect(fnBody('updateAsk', 'deleteAsk')).toContain("method: 'PATCH'")
    expect(fnBody('updateAnswer', 'deleteAnswer')).toContain("method: 'PATCH'")
    expect(code).not.toContain("method: 'PUT'")
  })
})

describe('ai-modules 改删面清零(后端只有 GET,PUT/DELETE 与社区详情从未注册且零消费方)', () => {
  const code = stripComments(ai)
  it('改删导出已摘,列表 GET 保留', () => {
    expect(code).not.toContain('updateAiChatType')
    expect(code).not.toContain('deleteAiChatType')
    expect(code).not.toContain('updateAiTeam')
    expect(code).not.toContain('deleteAiTeam')
    expect(code).not.toContain('getAiCommunityDetail')
    expect(code).toContain('/api/ai/chat-types')
    expect(code).toContain('/api/ai/team')
    expect(code).toContain('/api/ai/community')
  })
})

describe('ai-audio 族 → /api/ai/audio/*(旧 /api/ai-audio/* 从未注册;textToSpeech 删除)', () => {
  const code = stripComments(aiMedia)
  it('三枚接真路由(chat/recognize/models),旧 ai-audio 面不回潮', () => {
    expect(code).toContain("'/api/ai/audio/chat'")
    expect(code).toContain("'/api/ai/audio/recognize'")
    expect(code).toContain("'/api/ai/audio/models'")
    expect(code).not.toContain('/api/ai-audio/')
  })
  it('textToSpeech 与 TtsResult 已摘(真 TTS 音频通道 = fetchTextToSpeechAudio 走 /api/ai/audio/speech)', () => {
    expect(code).not.toContain('export async function textToSpeech')
    expect(code).not.toContain('interface TtsResult')
    expect(code).toContain("'/api/ai/audio/speech'")
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
