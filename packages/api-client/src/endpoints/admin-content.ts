/**
 * B 端内容/运营管理 API
 * 对接后端 apps/api/src/routes/admin/ 下的内容运营与平台管理模块,
 * 覆盖 ai-gc / carousel / comments / comment-logs / video-logs / developer-link /
 * identity-proportion / oss-files / monitor(alerts/alert-rules) / monitoring(logs) /
 * stats(ai-model-config / shop/withdrawal-flow / configs) / system-login-logs(courses /
 * course-videos / learn/homework / developer/coze / oauth/apps) / system-operation-logs /
 * task-developer / user-agent-audio / user-agent-image / news/information /
 * zhs-activity / zhs-agent / zhs-identity / zhs-user 模块。
 */
import type { ApiResult } from '@ihui/types'

import { fetchApi } from '../client.js'
import { buildQs, type PageData, type PageQuery } from '../utils.js'

/** 通用行类型(后端各表结构差异较大,统一用宽松索引签名,与现有 admin-*.ts 一致) */
export interface AdminRow {
  id: string | number
  createdAt?: string
  updatedAt?: string
  [key: string]: unknown
}

/** 通用删除结果(与 admin-auth.ts 的 DeleteResult 同形,局部类型避免 barrel 重导出冲突) */
interface DeleteResult {
  id: string
  deleted: boolean
}

// ===================== ai-gc(AI 生成内容) =====================

export async function listAiGc(params: PageQuery = {}): Promise<ApiResult<PageData<AdminRow>>> {
  return fetchApi<PageData<AdminRow>>(`/api/admin/ai-gc${buildQs(params)}`)
}

export async function addAiGc(body: Record<string, unknown>): Promise<ApiResult<AdminRow>> {
  return fetchApi<AdminRow>('/api/admin/ai-gc', { method: 'POST', body: JSON.stringify(body) })
}

export async function updateAiGc(
  id: string,
  body: Record<string, unknown>,
): Promise<ApiResult<AdminRow>> {
  return fetchApi<AdminRow>(`/api/admin/ai-gc/${id}`, { method: 'PUT', body: JSON.stringify(body) })
}

export async function delAiGc(id: string): Promise<ApiResult<DeleteResult>> {
  return fetchApi<DeleteResult>(`/api/admin/ai-gc/${id}`, { method: 'DELETE' })
}

// ===================== carousel(轮播图) =====================

export async function listCarousel(params: PageQuery = {}): Promise<ApiResult<PageData<AdminRow>>> {
  return fetchApi<PageData<AdminRow>>(`/api/admin/carousel${buildQs(params)}`)
}

export async function addCarousel(body: Record<string, unknown>): Promise<ApiResult<AdminRow>> {
  return fetchApi<AdminRow>('/api/admin/carousel', { method: 'POST', body: JSON.stringify(body) })
}

export async function updateCarousel(
  id: string,
  body: Record<string, unknown>,
): Promise<ApiResult<AdminRow>> {
  return fetchApi<AdminRow>(`/api/admin/carousel/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

export async function delCarousel(id: string): Promise<ApiResult<DeleteResult>> {
  return fetchApi<DeleteResult>(`/api/admin/carousel/${id}`, { method: 'DELETE' })
}

// ===================== comments(评论管理) =====================

export interface AdminCommentListQuery extends PageQuery {
  topicType?: string
  keyword?: string
  status?: 'normal' | 'deleted' | 'all'
}

export async function listAdminComments(
  params: AdminCommentListQuery = {},
): Promise<ApiResult<PageData<AdminRow>>> {
  return fetchApi<PageData<AdminRow>>(`/api/admin/comments${buildQs(params)}`)
}

export async function getAdminComment(
  id: string,
): Promise<ApiResult<{ comment: AdminRow; replies: AdminRow[] }>> {
  return fetchApi<{ comment: AdminRow; replies: AdminRow[] }>(`/api/admin/comments/${id}`)
}

export async function delAdminComment(
  id: string,
): Promise<ApiResult<{ id: string; isDeleted: boolean }>> {
  return fetchApi<{ id: string; isDeleted: boolean }>(`/api/admin/comments/${id}`, {
    method: 'DELETE',
  })
}

// ===================== comment-logs(评论日志) =====================

export interface CommentLogQuery extends PageQuery {
  userUuid?: string
  commentId?: number
  createdAt?: string
}

export async function listCommentLogs(
  params: CommentLogQuery = {},
): Promise<ApiResult<PageData<AdminRow>>> {
  return fetchApi<PageData<AdminRow>>(`/api/admin/comment-logs${buildQs(params)}`)
}

export async function delCommentLog(id: string): Promise<ApiResult<DeleteResult>> {
  return fetchApi<DeleteResult>(`/api/admin/comment-logs/${id}`, { method: 'DELETE' })
}

// ===================== video-logs(视频日志) =====================

export interface VideoLogQuery extends PageQuery {
  userUuid?: string
  videoId?: number
  createdAt?: string
}

export async function listVideoLogs(
  params: VideoLogQuery = {},
): Promise<ApiResult<PageData<AdminRow>>> {
  return fetchApi<PageData<AdminRow>>(`/api/admin/video-logs${buildQs(params)}`)
}

export async function delVideoLog(id: string): Promise<ApiResult<DeleteResult>> {
  return fetchApi<DeleteResult>(`/api/admin/video-logs/${id}`, { method: 'DELETE' })
}

// ===================== developer-link(开发者链接) =====================

export async function listDeveloperLink(
  params: PageQuery = {},
): Promise<ApiResult<PageData<AdminRow>>> {
  return fetchApi<PageData<AdminRow>>(`/api/admin/developer-link${buildQs(params)}`)
}

export async function delDeveloperLink(id: string): Promise<ApiResult<DeleteResult>> {
  return fetchApi<DeleteResult>(`/api/admin/developer-link/${id}`, { method: 'DELETE' })
}

// ===================== identity-proportion(身份比例) =====================

export async function listIdentityProportion(
  params: PageQuery = {},
): Promise<ApiResult<PageData<AdminRow>>> {
  return fetchApi<PageData<AdminRow>>(`/api/admin/identity-proportion${buildQs(params)}`)
}

export async function addIdentityProportion(
  body: Record<string, unknown>,
): Promise<ApiResult<AdminRow>> {
  return fetchApi<AdminRow>('/api/admin/identity-proportion', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function updateIdentityProportion(
  id: string,
  body: Record<string, unknown>,
): Promise<ApiResult<AdminRow>> {
  return fetchApi<AdminRow>(`/api/admin/identity-proportion/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

export async function delIdentityProportion(id: string): Promise<ApiResult<DeleteResult>> {
  return fetchApi<DeleteResult>(`/api/admin/identity-proportion/${id}`, { method: 'DELETE' })
}

// ===================== oss-files(OSS 文件) =====================

export async function listOssFiles(params: PageQuery = {}): Promise<ApiResult<PageData<AdminRow>>> {
  return fetchApi<PageData<AdminRow>>(`/api/admin/oss/files${buildQs(params)}`)
}

export async function deleteOssFile(
  id: string,
): Promise<ApiResult<{ id: string; deleted: boolean }>> {
  return fetchApi<{ id: string; deleted: boolean }>(`/api/admin/oss/files/${id}`, {
    method: 'DELETE',
  })
}

export async function batchDeleteOssFiles(ids: string[]): Promise<ApiResult<{ deleted: number }>> {
  return fetchApi<{ deleted: number }>(`/api/admin/oss/files/batch-delete`, {
    method: 'POST',
    body: JSON.stringify({ ids }),
  })
}

export async function ossFileToBase64(
  id: string,
): Promise<ApiResult<{ base64: string; mimeType: string }>> {
  return fetchApi<{ base64: string; mimeType: string }>(`/api/admin/oss/files/${id}/base64`)
}

// ===================== monitor/alerts(监控告警) =====================

export async function listMonitorAlerts(
  params: PageQuery = {},
): Promise<ApiResult<PageData<AdminRow>>> {
  return fetchApi<PageData<AdminRow>>(`/api/admin/monitor/alerts${buildQs(params)}`)
}

export async function getMonitorAlert(id: string): Promise<ApiResult<AdminRow>> {
  return fetchApi<AdminRow>(`/api/admin/monitor/alerts/${id}`)
}

export async function addMonitorAlert(body: Record<string, unknown>): Promise<ApiResult<AdminRow>> {
  return fetchApi<AdminRow>('/api/admin/monitor/alerts', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function updateMonitorAlert(
  id: string,
  body: Record<string, unknown>,
): Promise<ApiResult<AdminRow>> {
  return fetchApi<AdminRow>(`/api/admin/monitor/alerts/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

export async function delMonitorAlert(id: string): Promise<ApiResult<DeleteResult>> {
  return fetchApi<DeleteResult>(`/api/admin/monitor/alerts/${id}`, { method: 'DELETE' })
}

// ===================== monitor/alert-rules(告警抑制规则) =====================

export async function listMonitorAlertRules(
  params: PageQuery = {},
): Promise<ApiResult<PageData<AdminRow>>> {
  return fetchApi<PageData<AdminRow>>(`/api/admin/monitor/alert-rules${buildQs(params)}`)
}

export async function getMonitorAlertRule(id: string): Promise<ApiResult<AdminRow>> {
  return fetchApi<AdminRow>(`/api/admin/monitor/alert-rules/${id}`)
}

export async function addMonitorAlertRule(
  body: Record<string, unknown>,
): Promise<ApiResult<AdminRow>> {
  return fetchApi<AdminRow>('/api/admin/monitor/alert-rules', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function updateMonitorAlertRule(
  id: string,
  body: Record<string, unknown>,
): Promise<ApiResult<AdminRow>> {
  return fetchApi<AdminRow>(`/api/admin/monitor/alert-rules/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

export async function delMonitorAlertRule(id: string): Promise<ApiResult<DeleteResult>> {
  return fetchApi<DeleteResult>(`/api/admin/monitor/alert-rules/${id}`, { method: 'DELETE' })
}

// ===================== monitoring/logs(API 日志) =====================

export async function listMonitoringLogs(
  params: PageQuery = {},
): Promise<ApiResult<PageData<AdminRow>>> {
  return fetchApi<PageData<AdminRow>>(`/api/admin/monitoring/logs${buildQs(params)}`)
}

export async function getMonitoringLog(id: string): Promise<ApiResult<AdminRow>> {
  return fetchApi<AdminRow>(`/api/admin/monitoring/logs/${id}`)
}

export async function addMonitoringLog(
  body: Record<string, unknown>,
): Promise<ApiResult<AdminRow>> {
  return fetchApi<AdminRow>('/api/admin/monitoring/logs', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function updateMonitoringLog(
  id: string,
  body: Record<string, unknown>,
): Promise<ApiResult<AdminRow>> {
  return fetchApi<AdminRow>(`/api/admin/monitoring/logs/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

export async function delMonitoringLog(id: string): Promise<ApiResult<DeleteResult>> {
  return fetchApi<DeleteResult>(`/api/admin/monitoring/logs/${id}`, { method: 'DELETE' })
}

// ===================== ai-model-config(AI 模型配置) =====================

export async function listAiModelConfig(
  params: PageQuery = {},
): Promise<ApiResult<PageData<AdminRow>>> {
  return fetchApi<PageData<AdminRow>>(`/api/admin/ai-model-config${buildQs(params)}`)
}

export async function getAiModelConfig(id: string | number): Promise<ApiResult<AdminRow>> {
  return fetchApi<AdminRow>(`/api/admin/ai-model-config/${id}`)
}

export async function addAiModelConfig(
  body: Record<string, unknown>,
): Promise<ApiResult<{ id: number; created: boolean }>> {
  return fetchApi<{ id: number; created: boolean }>('/api/admin/ai-model-config', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function updateAiModelConfig(
  id: string | number,
  body: Record<string, unknown>,
): Promise<ApiResult<{ id: number; updated: boolean }>> {
  return fetchApi<{ id: number; updated: boolean }>(`/api/admin/ai-model-config/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

export async function delAiModelConfig(id: string | number): Promise<ApiResult<DeleteResult>> {
  return fetchApi<DeleteResult>(`/api/admin/ai-model-config/${id}`, { method: 'DELETE' })
}

export async function testAiModelConfig(id: string | number): Promise<
  ApiResult<{
    status: string
    responseMs: number
    model?: string
    content?: string
    error?: string
  }>
> {
  return fetchApi<{
    status: string
    responseMs: number
    model?: string
    content?: string
    error?: string
  }>(`/api/admin/ai-model-config/${id}/test`, { method: 'POST' })
}

// ===================== shop/withdrawal-flow(提现流水) =====================

export async function listShopWithdrawalFlow(
  params: PageQuery = {},
): Promise<ApiResult<PageData<AdminRow>>> {
  return fetchApi<PageData<AdminRow>>(`/api/admin/shop/withdrawal-flow${buildQs(params)}`)
}

export async function addShopWithdrawalFlow(
  body: Record<string, unknown>,
): Promise<ApiResult<AdminRow>> {
  return fetchApi<AdminRow>('/api/admin/shop/withdrawal-flow', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function updateShopWithdrawalFlow(
  id: string,
  body: Record<string, unknown>,
): Promise<ApiResult<AdminRow>> {
  return fetchApi<AdminRow>(`/api/admin/shop/withdrawal-flow/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

export async function delShopWithdrawalFlow(id: string): Promise<ApiResult<DeleteResult>> {
  return fetchApi<DeleteResult>(`/api/admin/shop/withdrawal-flow/${id}`, { method: 'DELETE' })
}

// ===================== configs(系统配置 upsert) =====================

export async function upsertSystemConfig(body: {
  key: string
  value: string
  category?: string
  description?: string | null
  isPublic?: boolean
}): Promise<ApiResult<AdminRow>> {
  return fetchApi<AdminRow>('/api/admin/configs', { method: 'PUT', body: JSON.stringify(body) })
}

// ===================== courses(课程管理) =====================

export async function listAdminCourses(
  params: PageQuery = {},
): Promise<ApiResult<PageData<AdminRow>>> {
  return fetchApi<PageData<AdminRow>>(`/api/admin/courses${buildQs(params)}`)
}

export async function getAdminCourse(id: string): Promise<ApiResult<AdminRow>> {
  return fetchApi<AdminRow>(`/api/admin/courses/${id}`)
}

export async function addAdminCourse(body: Record<string, unknown>): Promise<ApiResult<AdminRow>> {
  return fetchApi<AdminRow>('/api/admin/courses', { method: 'POST', body: JSON.stringify(body) })
}

export async function updateAdminCourse(
  id: string,
  body: Record<string, unknown>,
): Promise<ApiResult<AdminRow>> {
  return fetchApi<AdminRow>(`/api/admin/courses/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

export async function delAdminCourse(id: string): Promise<ApiResult<DeleteResult>> {
  return fetchApi<DeleteResult>(`/api/admin/courses/${id}`, { method: 'DELETE' })
}

/** 课程临时表详情(审计比较 after 快照) */
export async function getAdminCourseTemp(id: string): Promise<ApiResult<AdminRow>> {
  return fetchApi<AdminRow>(`/api/admin/courses/temp/${id}`)
}

/** 课程回收站还原 */
export async function restoreAdminCourse(id: string): Promise<ApiResult<AdminRow>> {
  return fetchApi<AdminRow>(`/api/admin/courses/${id}/restore`, { method: 'POST' })
}

// ===================== course-videos(课程视频审计) =====================

export async function getCourseVideo(id: string): Promise<ApiResult<AdminRow>> {
  return fetchApi<AdminRow>(`/api/admin/course-videos/${id}`)
}

export async function getCourseVideoTemp(id: string): Promise<ApiResult<AdminRow>> {
  return fetchApi<AdminRow>(`/api/admin/course-videos/temp/${id}`)
}

// ===================== learn/homework(课后作业) =====================

export async function listLearnHomework(
  params: PageQuery = {},
): Promise<ApiResult<PageData<AdminRow>>> {
  return fetchApi<PageData<AdminRow>>(`/api/admin/learn/homework${buildQs(params)}`)
}

export async function addLearnHomework(
  body: Record<string, unknown>,
): Promise<ApiResult<AdminRow>> {
  return fetchApi<AdminRow>('/api/admin/learn/homework', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function updateLearnHomework(
  id: string,
  body: Record<string, unknown>,
): Promise<ApiResult<AdminRow>> {
  return fetchApi<AdminRow>(`/api/admin/learn/homework/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

export async function delLearnHomework(id: string): Promise<ApiResult<DeleteResult>> {
  return fetchApi<DeleteResult>(`/api/admin/learn/homework/${id}`, { method: 'DELETE' })
}

// ===================== developer/coze(Coze 变量) =====================

export async function listDeveloperCoze(
  params: PageQuery = {},
): Promise<ApiResult<PageData<AdminRow>>> {
  return fetchApi<PageData<AdminRow>>(`/api/admin/developer/coze${buildQs(params)}`)
}

export async function addDeveloperCoze(
  body: Record<string, unknown>,
): Promise<ApiResult<AdminRow>> {
  return fetchApi<AdminRow>('/api/admin/developer/coze', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function updateDeveloperCoze(
  id: string,
  body: Record<string, unknown>,
): Promise<ApiResult<AdminRow>> {
  return fetchApi<AdminRow>(`/api/admin/developer/coze/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

export async function delDeveloperCoze(id: string): Promise<ApiResult<DeleteResult>> {
  return fetchApi<DeleteResult>(`/api/admin/developer/coze/${id}`, { method: 'DELETE' })
}

/** Coze 变量状态切换 */
export async function updateDeveloperCozeStatus(
  id: string,
  status: number,
): Promise<ApiResult<{ id: string; status: number; updated: boolean }>> {
  return fetchApi<{ id: string; status: number; updated: boolean }>(
    `/api/admin/developer/coze/${id}/status`,
    { method: 'PUT', body: JSON.stringify({ status }) },
  )
}

// ===================== oauth/apps(OAuth 应用,admin 侧;用户侧见 developer.ts) =====================

export async function listAdminOauthApps(
  params: PageQuery = {},
): Promise<ApiResult<PageData<AdminRow>>> {
  return fetchApi<PageData<AdminRow>>(`/api/admin/oauth/apps${buildQs(params)}`)
}

export async function addAdminOauthApp(
  body: Record<string, unknown>,
): Promise<ApiResult<AdminRow>> {
  return fetchApi<AdminRow>('/api/admin/oauth/apps', { method: 'POST', body: JSON.stringify(body) })
}

export async function updateAdminOauthApp(
  id: string,
  body: Record<string, unknown>,
): Promise<ApiResult<AdminRow>> {
  return fetchApi<AdminRow>(`/api/admin/oauth/apps/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

export async function delAdminOauthApp(id: string): Promise<ApiResult<DeleteResult>> {
  return fetchApi<DeleteResult>(`/api/admin/oauth/apps/${id}`, { method: 'DELETE' })
}

/** OAuth 应用状态切换(active|disabled) */
export async function updateAdminOauthAppStatus(
  id: string,
  status: string,
): Promise<ApiResult<AdminRow>> {
  return fetchApi<AdminRow>(`/api/admin/oauth/apps/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
}

// ===================== system/operation-logs(操作日志) =====================

export async function listSystemOperationLogs(
  params: PageQuery = {},
): Promise<ApiResult<PageData<AdminRow>>> {
  return fetchApi<PageData<AdminRow>>(`/api/admin/system/operation-logs${buildQs(params)}`)
}

export async function delSystemOperationLog(id: string): Promise<ApiResult<DeleteResult>> {
  return fetchApi<DeleteResult>(`/api/admin/system/operation-logs/${id}`, { method: 'DELETE' })
}

// ===================== task-developer(开发者任务) =====================

export async function listTaskDeveloper(
  params: PageQuery = {},
): Promise<ApiResult<PageData<AdminRow>>> {
  return fetchApi<PageData<AdminRow>>(`/api/admin/task-developer${buildQs(params)}`)
}

export async function addTaskDeveloper(
  body: Record<string, unknown>,
): Promise<ApiResult<AdminRow>> {
  return fetchApi<AdminRow>('/api/admin/task-developer', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function updateTaskDeveloper(
  id: string,
  body: Record<string, unknown>,
): Promise<ApiResult<AdminRow>> {
  return fetchApi<AdminRow>(`/api/admin/task-developer/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

export async function delTaskDeveloper(id: string): Promise<ApiResult<DeleteResult>> {
  return fetchApi<DeleteResult>(`/api/admin/task-developer/${id}`, { method: 'DELETE' })
}

// ===================== user-agent-audio(用户音频) =====================

export async function listUserAgentAudio(
  params: PageQuery = {},
): Promise<ApiResult<PageData<AdminRow>>> {
  return fetchApi<PageData<AdminRow>>(`/api/admin/user-agent-audio${buildQs(params)}`)
}

export async function delUserAgentAudio(id: string): Promise<ApiResult<DeleteResult>> {
  return fetchApi<DeleteResult>(`/api/admin/user-agent-audio/${id}`, { method: 'DELETE' })
}

// ===================== user-agent-image(用户图片) =====================

export async function listUserAgentImage(
  params: PageQuery = {},
): Promise<ApiResult<PageData<AdminRow>>> {
  return fetchApi<PageData<AdminRow>>(`/api/admin/user-agent-image${buildQs(params)}`)
}

export async function getUserAgentImage(id: string): Promise<ApiResult<AdminRow>> {
  return fetchApi<AdminRow>(`/api/admin/user-agent-image/${id}`)
}

export async function addUserAgentImage(
  body: Record<string, unknown>,
): Promise<ApiResult<AdminRow>> {
  return fetchApi<AdminRow>('/api/admin/user-agent-image', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function updateUserAgentImage(
  id: string,
  body: Record<string, unknown>,
): Promise<ApiResult<AdminRow>> {
  return fetchApi<AdminRow>(`/api/admin/user-agent-image/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

export async function delUserAgentImage(id: string): Promise<ApiResult<DeleteResult>> {
  return fetchApi<DeleteResult>(`/api/admin/user-agent-image/${id}`, { method: 'DELETE' })
}

// ===================== news/information(资讯文章) =====================

export async function listNewsInformation(
  params: PageQuery = {},
): Promise<ApiResult<PageData<AdminRow>>> {
  return fetchApi<PageData<AdminRow>>(`/api/admin/news/information${buildQs(params)}`)
}

export async function addNewsInformation(
  body: Record<string, unknown>,
): Promise<ApiResult<AdminRow>> {
  return fetchApi<AdminRow>('/api/admin/news/information', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function updateNewsInformation(
  id: string,
  body: Record<string, unknown>,
): Promise<ApiResult<AdminRow>> {
  return fetchApi<AdminRow>(`/api/admin/news/information/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

export async function delNewsInformation(id: string): Promise<ApiResult<DeleteResult>> {
  return fetchApi<DeleteResult>(`/api/admin/news/information/${id}`, { method: 'DELETE' })
}

// ===================== zhs-activity(智慧树活动) =====================

export async function listZhsActivity(
  params: PageQuery = {},
): Promise<ApiResult<PageData<AdminRow>>> {
  return fetchApi<PageData<AdminRow>>(`/api/admin/zhs-activity${buildQs(params)}`)
}

export async function addZhsActivity(body: Record<string, unknown>): Promise<ApiResult<AdminRow>> {
  return fetchApi<AdminRow>('/api/admin/zhs-activity', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function updateZhsActivity(
  id: string,
  body: Record<string, unknown>,
): Promise<ApiResult<AdminRow>> {
  return fetchApi<AdminRow>(`/api/admin/zhs-activity/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

export async function delZhsActivity(id: string): Promise<ApiResult<DeleteResult>> {
  return fetchApi<DeleteResult>(`/api/admin/zhs-activity/${id}`, { method: 'DELETE' })
}

// ===================== zhs-agent(智慧树代理) =====================

export async function listZhsAgent(params: PageQuery = {}): Promise<ApiResult<PageData<AdminRow>>> {
  return fetchApi<PageData<AdminRow>>(`/api/admin/zhs-agent${buildQs(params)}`)
}

export async function delZhsAgent(id: string): Promise<ApiResult<DeleteResult>> {
  return fetchApi<DeleteResult>(`/api/admin/zhs-agent/${id}`, { method: 'DELETE' })
}

// ===================== zhs-identity(智慧树身份) =====================

export async function listZhsIdentity(
  params: PageQuery = {},
): Promise<ApiResult<PageData<AdminRow>>> {
  return fetchApi<PageData<AdminRow>>(`/api/admin/zhs-identity${buildQs(params)}`)
}

export async function addZhsIdentity(body: Record<string, unknown>): Promise<ApiResult<AdminRow>> {
  return fetchApi<AdminRow>('/api/admin/zhs-identity', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function updateZhsIdentity(
  id: string,
  body: Record<string, unknown>,
): Promise<ApiResult<AdminRow>> {
  return fetchApi<AdminRow>(`/api/admin/zhs-identity/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

export async function delZhsIdentity(id: string): Promise<ApiResult<DeleteResult>> {
  return fetchApi<DeleteResult>(`/api/admin/zhs-identity/${id}`, { method: 'DELETE' })
}

// ===================== zhs-user(智慧树用户) =====================

export async function listZhsUser(params: PageQuery = {}): Promise<ApiResult<PageData<AdminRow>>> {
  return fetchApi<PageData<AdminRow>>(`/api/admin/zhs-user${buildQs(params)}`)
}

export async function delZhsUser(id: string): Promise<ApiResult<DeleteResult>> {
  return fetchApi<DeleteResult>(`/api/admin/zhs-user/${id}`, { method: 'DELETE' })
}
