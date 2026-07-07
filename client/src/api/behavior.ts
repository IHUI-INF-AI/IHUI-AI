/**
 * behavior.ts — 行为分析 API 封装
 *
 * 对齐后端 server/app/api/v1/behavior/behavior.py 的 18 个端点:
 *   点赞/收藏/评论/分享/举报/敏感词/关注
 *
 * 历史项目来源: edu service/ihui-ai-edu-behavior-service
 *   - CommentController / FavoriteController / LikeController
 *   - WordController (敏感词) / WatchController (关注)
 *
 * 注: admin.ts 已封装敏感词管理 (admin 视角), 此处封装用户视角的 18 个端点,
 *     供 client/src/components/statistics/BehaviorStatistics.vue 等组件使用.
 */

import request from '@/utils/request'
import type { ApiResponse } from '@/types'

const BASE = '/behavior'

/** 点赞目标类型: article/lesson/answer/question/comment 等 */
export type BehaviorTargetType =
  | 'article'
  | 'lesson'
  | 'answer'
  | 'question'
  | 'comment'
  | 'live'
  | 'channel'
  | 'circle'
  | string

export interface LikeRecord {
  id: number
  user_id: string
  user_name?: string
  target_type: string
  target_id: number
  created_at?: string
}

export type FavoriteRecord = LikeRecord

export interface CommentRecord {
  id: number
  user_id: string
  user_name?: string
  target_type: string
  target_id: number
  content: string
  parent_id?: number | null
  status?: number
  created_at?: string
}

export interface ReportRecord {
  id: number
  user_id: string
  user_name?: string
  target_type: string
  target_id: number
  reason: string
  status?: number
  handler?: string
  created_at?: string
  handled_at?: string
}

export interface SensitiveWordRecord {
  id: number
  word: string
  category?: string
  created_at?: string
}

export interface FollowRecord {
  id: number
  user_id: string
  user_name?: string
  follow_user_id: string
  follow_user_name?: string
  created_at?: string
}

// ============ 点赞 ============

/** 点赞 / 取消点赞 */
export function toggleLike(target_type: BehaviorTargetType, target_id: number) {
  return request.post<ApiResponse<{ liked: boolean }>>(`${BASE}/like`, null, {
    params: { target_type, target_id },
  })
}

/** 点赞列表 */
export function listLikes(params: {
  target_type?: string
  user_id?: string
  page?: number
  limit?: number
}) {
  return request.get<ApiResponse<LikeRecord[]>>(`${BASE}/like/list`, { params })
}

// ============ 收藏 ============

/** 收藏 / 取消收藏 */
export function toggleFavorite(target_type: BehaviorTargetType, target_id: number) {
  return request.post<ApiResponse<{ favorited: boolean }>>(`${BASE}/favorite`, null, {
    params: { target_type, target_id },
  })
}

/** 收藏列表 */
export function listFavorites(params: {
  target_type?: string
  user_id?: string
  page?: number
  limit?: number
}) {
  return request.get<ApiResponse<FavoriteRecord[]>>(`${BASE}/favorite/list`, { params })
}

// ============ 评论 ============

/** 发表评论 */
export function addComment(payload: {
  target_type: BehaviorTargetType
  target_id: number
  content: string
  parent_id?: number | null
}) {
  return request.post<ApiResponse<{ id: number }>>(`${BASE}/comment`, payload)
}

/** 评论列表 */
export function listComments(params: {
  target_type?: string
  target_id?: number
  user_id?: string
  page?: number
  limit?: number
}) {
  return request.get<ApiResponse<CommentRecord[]>>(`${BASE}/comment/list`, { params })
}

/** 删除评论 */
export function deleteComment(cid: number) {
  return request.delete<ApiResponse<void>>(`${BASE}/comment/${cid}`)
}

// ============ 分享 ============

/** 记录分享行为 */
export function recordShare(payload: {
  target_type: BehaviorTargetType
  target_id: number
  channel?: string
}) {
  return request.post<ApiResponse<{ shared: boolean }>>(`${BASE}/share`, payload)
}

// ============ 举报 ============

/** 提交举报 */
export function submitReport(payload: {
  target_type: BehaviorTargetType
  target_id: number
  reason: string
  evidence?: string
}) {
  return request.post<ApiResponse<{ id: number }>>(`${BASE}/report`, payload)
}

/** 举报列表 (admin) */
export function listReports(params: {
  target_type?: string
  status?: number
  page?: number
  limit?: number
}) {
  return request.get<ApiResponse<ReportRecord[]>>(`${BASE}/report/list`, { params })
}

/** 处理举报 (admin) */
export function handleReport(rid: number, payload: {
  status: number
  handler?: string
  remark?: string
}) {
  return request.put<ApiResponse<void>>(`${BASE}/report/${rid}/handle`, payload)
}

// ============ 敏感词 ============

/** 敏感词列表 */
export function listSensitiveWords(params: {
  category?: string
  page?: number
  limit?: number
}) {
  return request.get<ApiResponse<SensitiveWordRecord[]>>(`${BASE}/sensitive/list`, { params })
}

/** 添加敏感词 (admin) */
export function addSensitiveWord(payload: {
  word: string
  category?: string
}) {
  return request.post<ApiResponse<{ id: number }>>(`${BASE}/sensitive`, payload)
}

/** 删除敏感词 (admin) */
export function deleteSensitiveWord(sid: number) {
  return request.delete<ApiResponse<void>>(`${BASE}/sensitive/${sid}`)
}

/** 敏感词检测 */
export function checkSensitive(payload: { text: string }) {
  return request.post<ApiResponse<{ hits: string[]; sanitized: string }>>(
    `${BASE}/sensitive/check`,
    payload,
  )
}

// ============ 关注 ============

/** 关注 / 取消关注 */
export function toggleFollow(follow_user_id: string) {
  return request.post<ApiResponse<{ followed: boolean }>>(`${BASE}/follow`, null, {
    params: { follow_user_id },
  })
}

/** 关注列表 */
export function listFollows(params: {
  user_id?: string
  page?: number
  limit?: number
}) {
  return request.get<ApiResponse<FollowRecord[]>>(`${BASE}/follow/list`, { params })
}

export default {
  toggleLike,
  listLikes,
  toggleFavorite,
  listFavorites,
  addComment,
  listComments,
  deleteComment,
  recordShare,
  submitReport,
  listReports,
  handleReport,
  listSensitiveWords,
  addSensitiveWord,
  deleteSensitiveWord,
  checkSensitive,
  toggleFollow,
  listFollows,
}
