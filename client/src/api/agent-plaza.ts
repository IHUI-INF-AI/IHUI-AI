/**
 * api/agent-plaza.ts - 智能体广场列表/分类/收藏/点赞接口
 *
 * 路径对应后端 mock 路由 (app/api/mock/__init__.py):
 *   - GET  /api/agent/rule/search/bylink  按主分类分组的智能体列表 (mock_agent_bylink)
 *   - GET  /api/agent/categories          主分类 + 子分类 (mock_agent_categories)
 *   - POST /api/agent/collect/{id}        收藏 (mock_agent_collect)
 *   - POST /api/agent/like/{id}           点赞 (mock_agent_like)
 *
 * 注意: 后端另有 /api/agents/categories (复数, mock_agents_categories) 但返回格式不同,
 *       前端 categories() 期望 {agentMainCategory, agentCategory}, 必须用单数版本.
 *       v1 router 的 prefix="/agents" 是 ORM 真实路由, 但 categories 端点未实现,
 *       所以生产环境需要补全 v1 agents/categories 端点或保持 mock 启用.
 */
import request from '@/utils/request'
import { defaultCache } from '@/utils/requestCache'

export interface AgentInfo {
  botId?: string
  agentId?: string
  id?: string | number
  agentName?: string
  botName?: string
  name?: string
  agentDescription?: string
  description?: string
  agentAvatar?: string
  avatar?: string
  creatorName?: string
  userName?: string
  userNickname?: string
  creatorAvatar?: string
  userAvatar?: string
  creator_avatar?: string
  user_avatar?: string
  agentMainCategory?: Array<{ id?: string; name: string }>
  agent_main_category?: Array<{ id?: string; name: string }>
  agentCategory?: Array<{ id?: string; name: string }>
  agent_category?: Array<{ id?: string; name: string }>
  usageCount?: number
  collectCount?: number
  isCollect?: number
  likeCount?: number
  isThumbs?: number
  is_top?: number
  [key: string]: any
}

export interface AgentListParams {
  id?: string
  pageNum?: number
  pageSize?: number
  agentCategory?: string
  agentMainCategory?: string
  agentId?: string
  keyword?: string
}

/** 后端统一响应体 {code, msg, data, timestamp} */
interface ApiEnvelope<T = unknown> {
  code?: number
  msg?: string
  data?: T
  timestamp?: number
}

/** 从 axios response 中提取后端 data 字段，包装为 {data: ...} 供 loadList 消费 */
function extractData<T>(response: any): { data?: T } {
  const body = (response as { data?: ApiEnvelope<T> })?.data
  return { data: body?.data }
}

/** 从 axios response 中提取后端 msg 字段，包装为 {message: ...} 供 toggleCollect/toggleLike 消费 */
function extractMessage(response: any): { message?: string } {
  const body = (response as { data?: ApiEnvelope })?.data
  return { message: body?.msg }
}

/** 获取智能体列表 (按主分类分组) */
export async function getAgentList(params: AgentListParams): Promise<{ data?: Record<string, AgentInfo[]> | AgentInfo[] | { list?: AgentInfo[] } }> {
  const response = await request({
    url: '/agent/rule/search/bylink',
    method: 'GET',
    params,
    base: 0,
  })
  return extractData<Record<string, AgentInfo[]> | AgentInfo[] | { list?: AgentInfo[] }>(response)
}

/** 获取智能体分类 (主分类 + 子分类) - 缓存 5 分钟，分类不常变化 */
export async function categories(): Promise<{ data?: { agentMainCategory?: Array<{ id?: string; name: string }>; agentCategory?: Array<{ id?: string; name: string }> } }> {
  return defaultCache.wrap(
    '/agent/categories',
    async () => {
      const response = await request({
        url: '/agent/categories',
        method: 'GET',
        base: 0,
      })
      return extractData<{ agentMainCategory?: Array<{ id?: string; name: string }>; agentCategory?: Array<{ id?: string; name: string }> }>(response)
    },
    undefined,
    5 * 60 * 1000
  )
}

/** 收藏智能体 */
export async function getAgentCollect(id: string | number): Promise<{ message?: string }> {
  const response = await request({
    url: `/agent/collect/${id}`,
    method: 'POST',
    base: 0,
  })
  return extractMessage(response)
}

/** 点赞智能体 */
export async function getAgentLike(id: string | number): Promise<{ message?: string }> {
  const response = await request({
    url: `/agent/like/${id}`,
    method: 'POST',
    base: 0,
  })
  return extractMessage(response)
}

/** 根据 ID 查找 mock 智能体 (详情页兜底用) */
export function findMockAgentById(id: string): AgentInfo | null {
  const all: AgentInfo[] = [
    { agentName: '写作助手', agentDescription: '辅助写作、润色与续写', agentMainCategory: [{ name: 'AI写作' }] },
    { agentName: '翻译润色', agentDescription: '多语言翻译与文本润色', agentMainCategory: [{ name: 'AI写作' }] },
    { agentName: '智能客服', agentDescription: '7x24 小时智能客服与常见问题解答', agentMainCategory: [{ name: 'AI客服' }] },
    { agentName: '头像设计师', agentDescription: 'AI 生成个性化头像设计', agentMainCategory: [{ name: 'AI绘画' }] },
    { agentName: '代码助手', agentDescription: '代码补全、审查与重构建议', agentMainCategory: [{ name: 'AI编程' }] },
    { agentName: 'PPT 大师', agentDescription: '一键生成专业 PPT 演示文稿', agentMainCategory: [{ name: 'AI办公' }] },
  ]
  return all.find(a => id.includes(String(a.agentName))) || all[0]
}

/** AgentListOptions - 与 AgentListParams 相同，用于 remote.ts 兼容 */
export type AgentListOptions = AgentListParams
