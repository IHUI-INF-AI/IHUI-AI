/**
 * AI 模型相关 API
 * 迁移自 Ai-WXMiniVue/src/service/aiModels.js
 * 转换：JS -> TS, uni.request -> axios
 * 包含 30+ 个函数
 */

import { COZE_PATHS } from '@/config/backend-paths'
import request from '@/utils/request-compat'

/**
 * 智能体收藏查询参数
 */
export interface AgentCollectParams {
  page?: number
  pageSize?: number
  [key: string]: unknown
}

/**
 * 获取收藏的智能体
 */
export function getAgentbyCollect(data: AgentCollectParams, uuid: string) {
  return request({
    url: `/remote/agent/by/collect/${uuid}`,
    method: 'GET',
    data,
    base: 2,
  })
}

/**
 * 智能体类型查询参数
 */
export interface AgentTypeParams {
  type?: string
  page?: number
  pageSize?: number
  [key: string]: unknown
}

/**
 * 获取 AI团队 智能体 列表
 */
export function getAgentType(data: AgentTypeParams) {
  return request({
    url: `/remote/agent/by/type`,
    method: 'GET',
    data,
    base: 2,
  })
}

/**
 * 获取 AI团队 code
 */
export function category(type: string = '1') {
  return request({
    url: `/remote/agent/category`,
    method: 'GET',
    data: {
      type,
    },
    base: 2,
  })
}

/**
 * 获取分类字典
 */
export function categoryDictionary() {
  return request({
    url: `/categoryDictionary/list`,
    method: 'GET',
    base: 1,
  })
}

/**
 * 智能体购买参数
 */
export interface AgentPayParams {
  agentId: string
  [key: string]: unknown
}

/**
 * ai团队，老员工，购买
 */
export function aiRemoveAgent(data: AgentPayParams) {
  return request({
    url: `/remote/agent/by/pay`,
    method: 'GET',
    data,
    base: 2,
  })
}

/**
 * 开发者
 */
export function getDevInfo() {
  return request({
    url: `/resource/developer/price`,
    method: 'GET',
    base: 1,
  })
}

/**
 * 智能体审核记录查询参数
 */
export interface AgentExamineParams {
  page?: number
  pageSize?: number
  status?: string
  [key: string]: unknown
}

/**
 * 获取智能体审核记录列表
 */
export function getZntList(data: AgentExamineParams) {
  return request({
    url: COZE_PATHS.agentExamine.list,
    method: 'GET',
    data,
    base: 3,
  })
}

/**
 * 根据智能体ID获取收费配置
 */
export function getChargeInfoById(id: string) {
  return request({
    url: COZE_PATHS.agentCategory.agentById(id),
    method: 'GET',
    base: 3,
  })
}

/**
 * 付费记录创建参数
 */
export interface PayHistoryParams {
  agentId: string
  amount: number
  [key: string]: unknown
}

/**
 * 创建付费记录
 */
export function createPayHistory(data: PayHistoryParams) {
  return request({
    url: `/agentBuy`,
    headers: {
      'content-type': 'application/json',
    },
    method: 'POST',
    data,
    base: 3,
  })
}

/**
 * 智能体收费配置参数
 */
export interface AgentChargeParams {
  agentId: string
  price: number
  [key: string]: unknown
}

/**
 * 创建智能体收费配置
 */
export function createZntCharge(data: AgentChargeParams) {
  return request({
    url: `/agentCategory`,
    headers: {
      'content-type': 'application/json',
    },
    method: 'POST',
    data,
    base: 3,
  })
}

/**
 * 修改智能体收费配置
 */
export function putZntCharge(data: AgentChargeParams & { agent_id?: string; id?: string }) {
  return request({
    url: `/agentCategory`,
    headers: {
      'content-type': 'application/json',
    },
    method: 'PUT',
    data,
    base: 3,
  })
}

/**
 * 删除智能体收费配置
 */
export function deleteZntCharge(ids: string | string[]) {
  const idsString = Array.isArray(ids) ? ids.join(',') : ids
  return request({
    url: `/agentCategory/${idsString}`,
    headers: {
      'content-type': 'application/json',
    },
    method: 'DELETE',
    base: 3,
  })
}

/**
 * 收入详情查询参数
 */
export interface IncomeOverviewParams {
  startDate?: string
  endDate?: string
  [key: string]: unknown
}

/**
 * 收入详情
 */
export function getBuyInfo(data: IncomeOverviewParams) {
  return request({
    url: COZE_PATHS.agentSettlement.incomeOverview,
    method: 'GET',
    data: {
      start_date: data.startDate,
      end_date: data.endDate,
    },
    base: 3,
  })
}

/**
 * 收入列表查询参数
 */
export interface SettlementListParams {
  page?: number
  pageSize?: number
  startDate?: string
  endDate?: string
  [key: string]: unknown
}

/**
 * 收入列表
 */
export function getBuyList(data: SettlementListParams) {
  return request({
    url: `/agentSettlement/list`,
    method: 'GET',
    data: {
      page: data.page,
      page_size: data.pageSize,
      start_date: data.startDate,
      end_date: data.endDate,
    },
    base: 3,
  })
}

/**
 * 明细列表查询参数
 */
export interface WithdrawalDetailListParams {
  page?: number
  pageSize?: number
  agentId?: string
  userId?: string
  [key: string]: unknown
}

/**
 * 明细列表
 *
 * 2026-06-25 修复#G: 路径对齐到 Python 后端真实端点.
 *   原路径 /agentWithdrawalDetail/list (base 3, baseUrl3='') 无 vite 代理规则,
 *   无后端实现, 请求会 404. 对齐到 /api/v1/agents/withdrawal/list (base 1,
 *   走 api-kou 代理到 Python 后端), 与 agent-withdrawal.ts 的 getWithdrawalList
 *   一致. 后端参数: page/limit/status, user_uuid 从 token 取.
 */
export function getMxList(data: WithdrawalDetailListParams) {
  return request({
    url: `/api/v1/agents/withdrawal/list`,
    method: 'GET',
    data: {
      page: data.page,
      page_size: data.pageSize,
      agent_id: data.agentId,
      user_id: data.userId,
    },
    base: 1,
  })
}

/**
 * 发布广场查询参数
 */
export interface PlazaListParams {
  pageNum: number
  pageSize: number
  status: string
  search?: string
  creator?: string
  types?: string[]
  categorys?: string[]
  [key: string]: unknown
}

/**
 * 发布广场
 */
export function getPlazaList(data: PlazaListParams) {
  let url = `/remote/agent/task/need/task?pageNum=${data.pageNum}&pageSize=${data.pageSize}&status=${data.status}&search=${data.search}&creator=${data.creator}`
  if (data.types && data.types.length > 0) {
    url += `&types=${data.types}`
  }
  if (data.categorys && data.categorys.length > 0) {
    url += `&categorys=${data.categorys}`
  }
  return request({
    url: url,
    method: 'GET',
    base: 2,
  })
}

/**
 * 发布广场模型参数
 */
export interface PlazaModelParams {
  title: string
  description: string
  types?: string[]
  categorys?: string[]
  [key: string]: unknown
}

/**
 * 发布
 */
export function addPlazaModel(data: PlazaModelParams) {
  return request({
    url: `/remote/agent/task/need/task/add`,
    headers: {
      'content-type': 'application/json',
    },
    method: 'POST',
    data,
    base: 2,
  })
}

/**
 * 发布广场，获取详情
 */
export function getPlazaInfoById(id: string) {
  return request({
    url: `/remote/agent/task/need/task/add/${id}`,
    method: 'GET',
    base: 2,
  })
}

/**
 * 获取智能体地址列表
 */
export function getCozeApiList() {
  return request({
    url: COZE_PATHS.aiModelInfo.list,
    method: 'GET',
    base: 3,
  })
}

/**
 * 千问文生图参数
 */
export interface DashscopeImageGenerateParams {
  prompt: string
  model?: string
  [key: string]: unknown
}

/**
 * 千问文生图
 */
export function cozeZhsApiDashscopeImageGenerate(data: DashscopeImageGenerateParams, url: string) {
  return request({
    url,
    headers: {
      'content-type': 'application/json',
    },
    method: 'POST',
    data,
    base: 3,
  })
}

/**
 * 千问图片修改参数
 */
export interface DashscopeImageEditParams {
  image: string
  prompt: string
  [key: string]: unknown
}

/**
 * 千问图片修改
 */
export function dashscopeImageEditSimple(data: DashscopeImageEditParams, url: string) {
  return request({
    url,
    headers: {
      'content-type': 'application/json',
    },
    method: 'POST',
    data,
    base: 3,
  })
}

/**
 * 千问视频生成参数
 */
export interface DashscopeVideoGenerateParams {
  prompt: string
  [key: string]: unknown
}

/**
 * 千问视频生成
 */
export function cozeZhsApiDashscopeVideoGenerate(data: DashscopeVideoGenerateParams, url: string) {
  return request({
    url,
    headers: {
      'content-type': 'application/json',
    },
    method: 'POST',
    data,
    base: 3,
  })
}

/**
 * 腾讯混元3D提交参数
 */
export interface TencentHunyuan3dParams {
  prompt: string
  [key: string]: unknown
}

/**
 * 腾讯混元3D，请求后等后端生成，生成好后再请求
 */
export function tencentHunyuan3dSubmit(data: TencentHunyuan3dParams, url: string) {
  return request({
    url,
    headers: {
      'content-type': 'application/json',
    },
    method: 'POST',
    data,
    base: 3,
  })
}

/**
 * 腾讯混元3D查询参数
 */
export interface TencentHunyuan3dQueryParams {
  taskId: string
  [key: string]: unknown
}

/**
 * 还原 3d 生成结果查询
 */
export function tencentHunyuan3dQuery(data: TencentHunyuan3dQueryParams, url: string) {
  return request({
    url,
    headers: {
      'content-type': 'application/json',
    },
    method: 'POST',
    data,
    base: 3,
  })
}

/**
 * 谷歌图片编辑参数
 */
export interface LuyalaChatParams {
  prompt: string
  image?: string
  max_tokens?: number
  model?: string
  user_uuid?: string
  messages?: Array<{ role: string; content: unknown }>
  chat_id?: string
  zidingyican?: unknown
  [key: string]: unknown
}

/**
 * 谷歌图片编辑
 */
export function cozeZhsApiLuyalaChatCompletions(data: LuyalaChatParams, url: string) {
  return request({
    url,
    headers: {
      'content-type': 'application/json',
    },
    method: 'POST',
    data,
    base: 3,
  })
}

/**
 * 即梦4.0参数
 */
export interface DoubaoSeedreamParams {
  prompt: string
  [key: string]: unknown
}

/**
 * 即梦4.0
 */
export function cozeZhsApiDoubaoSeedream40(data: DoubaoSeedreamParams, url: string) {
  return request({
    url,
    headers: {
      'content-type': 'application/json',
    },
    method: 'POST',
    data,
    base: 3,
  })
}

/**
 * veo3视频生成参数
 */
export interface LuyalaVideoParams {
  prompt: string
  [key: string]: unknown
}

/**
 * veo3
 */
export function cozeZhsApiLuyalaVideoCreate(data: LuyalaVideoParams, url: string, base: number = 3) {
  return request({
    url,
    headers: {
      'content-type': 'application/json',
    },
    method: 'POST',
    data,
    base: base,
  })
}

/**
 * 通用POST请求参数
 */
export interface PostByUrlParams {
  [key: string]: unknown
}

/**
 * 通过 URL 发送 POST 请求
 */
export function postByUrl(data: PostByUrlParams, url: string) {
  return request({
    url,
    headers: {
      'content-type': 'application/json',
    },
    method: 'POST',
    data,
    base: 3,
  })
}

/**
 * 音频生成参数
 */
export interface AudioStartParams {
  prompt: string
  [key: string]: unknown
}

/**
 * 音频 开始
 */
export function audioStart(data: AudioStartParams) {
  return request({
    url: `/kling/generate/video`,
    headers: {
      'content-type': 'application/json',
    },
    method: 'POST',
    data,
    base: 1,
  })
}

/**
 * 音频 结束
 */
export function audioEnd(id: string) {
  return request({
    url: `/kling/video/info/${id}`,
    method: 'GET',
    base: 1,
  })
}

/**
 * 搜索模型工作流运行参数
 */
export interface SearchModelWorkflowParams {
  query: string
  [key: string]: unknown
}

/**
 * 搜索模型工作流运行
 */
export function searchModelWorkflowRun(data: SearchModelWorkflowParams) {
  return request({
    url: COZE_PATHS.search.modelWorkflowRun,
    headers: {
      'content-type': 'application/json',
    },
    method: 'POST',
    data,
    base: 3,
  })
}

/**
 * 阿里音频生成参数
 */
export interface AliTimbreParams {
  prompt: string
  [key: string]: unknown
}

/**
 * 音频 开始（阿里）
 */
export function aliGenerateTimbre(data: AliTimbreParams) {
  return request({
    url: `/ali/generate/timbre`,
    headers: {
      'content-type': 'application/json',
    },
    method: 'POST',
    data,
    base: 0, // 原项目使用 base: 0
  })
}

/**
 * Sora视频生成参数
 */
export interface SoraRequestParams {
  prompt: string
  [key: string]: unknown
}

/**
 * sora音频 开始
 */
export function soraRequest(data: SoraRequestParams) {
  return request({
    url: `/jianyi/sora2/generate/video`,
    headers: {
      'content-type': 'application/json',
    },
    method: 'POST',
    data,
    base: 1,
  })
}

/**
 * Sora视频查询参数
 */
export interface SoraRequestEndParams {
  taskId: string
  [key: string]: unknown
}

/**
 * sora音频 结束
 */
export function soraRequestEnd(data: SoraRequestEndParams) {
  return request({
    url: `/jianyi/sora2/video/info`,
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    data,
    base: 1,
  })
}
