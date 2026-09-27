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
  it('PUT /api/members/levels 且 id 进 body', () => {
    const fn = learn.slice(learn.indexOf('export async function updateMemberLevel'))
    const body = fn.slice(0, fn.indexOf('\nexport') > 0 ? fn.indexOf('\nexport') : fn.length)
    expect(body).toContain("'/api/members/levels'")
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
