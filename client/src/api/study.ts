/**
 * 学习相关 API
 * 迁移自 Ai-WXMiniVue/src/service/study.js
 * 转换：JS -> TS, uni.request -> axios
 * 包含 21 个函数
 */

import request from '@/utils/request-compat'

/**
 * 课程列表查询参数
 */
export interface CourseListParams {
  page?: number
  pageSize?: number
  categoryId?: string
  keyword?: string
  [key: string]: unknown
}

/**
 * 获取课程列表
 */
export function getGroupList(data: CourseListParams) {
  return request({
    url: `/course/list`,
    headers: {
      'COURSE-PLATFORM': 'system_wechat',
    },
    method: 'GET',
    data,
    base: 1,
  })
}

/**
 * 根据子赛道id获取主赛道
 */
export function parentquery(ids: string) {
  return request({
    url: `/categoryDictionary/get/parent?ids=${ids}`,
    headers: {
      'COURSE-PLATFORM': 'system_wechat',
    },
    method: 'GET',
    base: 1,
  })
}

/**
 * 查询 集合详情
 */
export function getGroupDetail(id: string) {
  return request({
    url: `/course/${id}`,
    headers: {
      'COURSE-PLATFORM': 'system_wechat',
    },
    method: 'GET',
    base: 1,
  })
}

/**
 * 查询 视频详情
 */
export function getVideoDetail(id: string) {
  return request({
    url: `/courseVideo/${id}`,
    headers: {
      'COURSE-PLATFORM': 'system_wechat',
    },
    method: 'GET',
    base: 1,
  })
}

/**
 * 查询 合集详情
 */
export function getCourseDetail(id: string) {
  return request({
    url: `/course/${id}`,
    headers: {
      'COURSE-PLATFORM': 'system_wechat',
    },
    method: 'GET',
    base: 1,
  })
}

/**
 * 点赞、收藏、分享
 */
export function userVideoLogOperate(videoId: string, type: string) {
  return request({
    url: `/userVideoLog/operate/${videoId}/${type}`,
    headers: {
      'COURSE-PLATFORM': 'system_wechat',
    },
    method: 'GET',
    base: 1,
  })
}

/**
 * 取消点赞、收藏
 */
export function userVideoLog(ids: string) {
  return request({
    url: `/userVideoLog/${ids}`,
    headers: {
      'COURSE-PLATFORM': 'system_wechat',
    },
    method: 'DELETE',
    base: 1,
  })
}

/**
 * 视频评论列表查询参数
 */
export interface VideoCommentListParams {
  videoId: string
  page?: number
  pageSize?: number
  [key: string]: unknown
}

/**
 * 查询 评论列表
 */
export function getUserVideoCommentList(data: VideoCommentListParams) {
  return request({
    url: `/userVideoComment/list`,
    headers: {
      'COURSE-PLATFORM': 'system_wechat',
    },
    data,
    method: 'GET',
    base: 1,
  })
}

/**
 * 视频评论参数
 */
export interface VideoCommentParams {
  videoId: string
  content: string
  parentId?: string
  [key: string]: unknown
}

/**
 * 新增评论
 */
export function userVideoComment(data: VideoCommentParams) {
  return request({
    url: `/userVideoComment`,
    headers: {
      'content-type': 'application/json',
      'COURSE-PLATFORM': 'system_wechat',
    },
    method: 'POST',
    data,
    base: 1,
  })
}

/**
 * 智能体列表查询参数
 */
export interface AgentsAllListParams {
  page?: number
  pageSize?: number
  keyword?: string
  [key: string]: unknown
}

/**
 * 获取智能体列表
 * 注意：base: 3 已经包含 /cozeZhsApi 前缀，这里只需要写接口路径
 */
export function getAgentsAlllist(data: AgentsAllListParams) {
  return request({
    url: `/agents/Alllist`,
    method: 'GET',
    data,
    base: 3,
  })
}

/**
 * 视频列表查询参数
 */
export interface VideoListParams {
  courseId?: string
  page?: number
  pageSize?: number
  [key: string]: unknown
}

/**
 * 获取视频列表
 */
export function getVideoList(data: VideoListParams) {
  return request({
    url: `/courseVideo/list`,
    headers: {
      'COURSE-PLATFORM': 'system_wechat',
    },
    method: 'GET',
    data,
    base: 1,
  })
}

/**
 * 发布合集参数
 */
export interface AddGroupParams {
  name: string
  description?: string
  categoryId?: string
  [key: string]: unknown
}

/**
 * 发布合集
 */
export function addGroup(data: AddGroupParams) {
  return request({
    url: `/course`,
    headers: {
      'content-type': 'application/json',
      'COURSE-PLATFORM': 'system_wechat',
    },
    method: 'POST',
    data,
    base: 1,
  })
}

/**
 * 修改合集参数
 */
export interface CoursePutParams {
  id: string
  name?: string
  description?: string
  [key: string]: unknown
}

/**
 * 修改合集
 */
export function coursePut(data: CoursePutParams) {
  return request({
    url: `/course`,
    headers: {
      'content-type': 'application/json',
      'COURSE-PLATFORM': 'system_wechat',
    },
    method: 'PUT',
    data,
    base: 1,
  })
}

/**
 * 删除合集
 */
export function courseDelete(ids: string) {
  return request({
    url: `/course/${ids}`,
    headers: {
      'COURSE-PLATFORM': 'system_wechat',
    },
    method: 'DELETE',
    base: 1,
  })
}

/**
 * 添加视频参数
 */
export interface AddVideoParams {
  courseId: string
  title: string
  videoUrl?: string
  [key: string]: unknown
}

/**
 * 添加视频
 */
export function addVideo(data: AddVideoParams) {
  return request({
    url: `/courseVideo`,
    headers: {
      'content-type': 'application/json',
      'COURSE-PLATFORM': 'system_wechat',
    },
    method: 'POST',
    data,
    base: 1,
  })
}

/**
 * 修改视频参数
 */
export interface VideoPutParams {
  id: string
  title?: string
  videoUrl?: string
  [key: string]: unknown
}

/**
 * 修改视频
 */
export function videoPut(data: VideoPutParams) {
  return request({
    url: `/courseVideo`,
    headers: {
      'content-type': 'application/json',
      'COURSE-PLATFORM': 'system_wechat',
    },
    method: 'PUT',
    data,
    base: 1,
  })
}

/**
 * 删除视频
 */
export function videoDelete(ids: string) {
  return request({
    url: `/courseVideo/${ids}`,
    headers: {
      'COURSE-PLATFORM': 'system_wechat',
    },
    method: 'DELETE',
    base: 1,
  })
}

/**
 * 分片上传参数
 */
export interface ChunkedFileParams {
  file: Blob | ArrayBuffer
  fileName: string
  chunkNumber: number
  totalChunks: number
  fileMD5: string
  fileType: string
  [key: string]: unknown
}

/**
 * 分片上传
 */
export function uploadChunkedFile(param: ChunkedFileParams, length: number) {
  return request({
    url: `/file/uploadChunkedFile`,
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Length': length.toString(),
      fileName: param.fileName,
      chunkNumber: param.chunkNumber?.toString(),
      totalChunks: param.totalChunks?.toString(),
      fileMD5: param.fileMD5,
      fileType: param.fileType,
    },
    method: 'POST',
    data: param.file,
    base: 4,
  })
}

/**
 * 分片上传PC参数
 */
export interface ChunkedFilePCParams {
  file: File | FormData
  fileName: string
  [key: string]: unknown
}

/**
 * 分片上传 PC
 */
export function uploadChunkedFilePC(param: ChunkedFilePCParams) {
  const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substr(2, 10)

  return request({
    url: `/file/uploadChunkedFile/pc`,
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    },
    method: 'POST',
    data: param,
    base: 4,
  })
}

/**
 * 分片合并参数
 */
export interface ChunkedFileJointParams {
  fileName: string
  fileMD5: string
  totalChunks: number
  [key: string]: unknown
}

/**
 * 获取分片视频完整地址
 */
export function uploadChunkedFileJoint(data: ChunkedFileJointParams) {
  return request({
    url: `/file/uploadChunkedFile/joint`,
    headers: {
      'content-type': 'application/json',
      'COURSE-PLATFORM': 'system_wechat',
    },
    method: 'POST',
    data,
    base: 4,
  })
}

/**
 * 视频预加载参数
 */
export interface VideoPreloadParams {
  videoUrl: string
  [key: string]: unknown
}

/**
 * 视频预加载
 */
export function videoPreload(data: VideoPreloadParams) {
  return request({
    url: `/general/api/video/preload`,
    headers: {
      'content-type': 'application/json',
      'COURSE-PLATFORM': 'system_wechat',
    },
    method: 'POST',
    data,
    base: 4,
  })
}

/**
 * 上架
 */
export function issue(ids: string) {
  return request({
    url: `/courseVideo/issue/${ids}`,
    headers: {
      'content-type': 'application/json',
      'COURSE-PLATFORM': 'system_wechat',
    },
    method: 'POST',
    base: 1,
  })
}

/**
 * 下架
 */
export function delist(ids: string) {
  return request({
    url: `/course/delist/${ids}`,
    headers: {
      'content-type': 'application/json',
      'COURSE-PLATFORM': 'system_wechat',
    },
    method: 'POST',
    base: 1,
  })
}

/**
 * 用户反馈参数
 */
export interface UserFeedbackParams {
  content: string
  type?: string
  [key: string]: unknown
}

/**
 * 反馈
 */
export function userFeedback(data: UserFeedbackParams) {
  return request({
    url: `/userFeedback`,
    headers: {
      'content-type': 'application/json',
    },
    data,
    method: 'POST',
    base: 1,
  })
}

/**
 * 反馈列表查询参数
 */
export interface UserFeedbackListParams {
  page?: number
  pageSize?: number
  type?: string
  [key: string]: unknown
}

/**
 * 反馈列表
 */
export function userFeedbackList(data: UserFeedbackListParams) {
  return request({
    url: `/userFeedback/list`,
    data,
    method: 'GET',
    base: 1,
  })
}
