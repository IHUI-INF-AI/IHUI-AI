/**
 * Admin 后台综合 API 客户端
 * 覆盖 12 大类管理端点(用户/会员/组织/课程/考试/直播/社区/内容/积分/消息/权限/设置)
 * P15.1: 所有列表方法自动 fallback 到 seedData,后端不可用时仍有数据
 */
import http from '@/utils/request'
import type { ApiResponse, PaginationResponse } from '@/types'
import { querySeed, getConfig } from '@/utils/seedData'
import { normalizeApiResponse } from '@/utils/api-response'

// 通用列表查询
export interface ListParams { current?: number; size?: number; keyword?: string; status?: string | number; [k: string]: unknown }

// P15.1 API 方法名 → seedData 文件名映射(P16.2 修正:借用改为专用数据)
const SEED_MAP: Record<string, string> = {
  memberList: 'users', memberGroupList: 'users', memberLevelList: 'users', memberPostList: 'users',
  memberTagList: 'users', memberCompanyList: 'users', accountList: 'users', orgUserList: 'users',
  learnLessonList: 'courses', learnCategoryList: 'courses', learnMapList: 'courses', learnTopicList: 'courses',
  learnOrderList: 'orders', learnSignupList: 'orders', learnOrderInvoiceTitle: 'orders', learnOrderInvoiceApplication: 'orders',
  learnHomeworkList: 'courses',
  examList: 'exams', examPaperList: 'exams', examPaperMock: 'exams', examPaperNormal: 'exams',
  examPaperRandom: 'exams', examQuestionList: 'exams', examAnswerList: 'exams', examAnswerMark: 'exams',
  liveChannelList: 'lives', liveLecturerList: 'users',
  askQuestionList: 'asks', circleList: 'circles', circleDynamicList: 'circles', articleContentList: 'articles',
  commentList: 'comments', commentSensitive: 'comments', newsContentList: 'news',
  resourceList: 'resources', resourceTag: 'resources',
  pointList: 'points', pointRecord: 'points', certificateTemplate: 'certificates',
  messageAnnouncement: 'announcements', roleList: 'roles', searchHot: 'searchHots', settingCarousel: 'carousels',
  authorityList: 'authorities',
}

// P15.1 列表 fallback:将 seedData 转为体系 A 期望的 { records, total } 格式
async function listFallback(apiName: string, params: ListParams = {}): Promise<ApiResponse<PaginationResponse<unknown>>> {
  const seedName = SEED_MAP[apiName] || 'users'
  const { current = 1, size = 20, keyword = '' } = params
  const result = await querySeed(seedName, { page: current, size, keyword })
  return {
    code: 0,
    message: 'success',
    data: { records: result.data.list, total: result.data.total, current: result.data.page, size: result.data.size },
    success: true,
    timestamp: Date.now(),
  }
}

// P15.1 配置类 fallback
async function configFallback(): Promise<ApiResponse<unknown>> {
  const data = await getConfig('config')
  return { code: 0, message: 'success', data: data || {}, success: true, timestamp: Date.now() } as ApiResponse<unknown>
}

// P15.1 Dashboard fallback
async function dashboardFallback(): Promise<ApiResponse<unknown>> {
  return { code: 0, message: 'success', data: { userCount: 5000, courseCount: 1000, orderCount: 500, revenue: 1250000 }, success: true, timestamp: Date.now() } as ApiResponse<unknown>
}

const rawAdminApi = {
  // === Dashboard ===
  dashboardStats: () => http.get<ApiResponse<{ userCount: number; courseCount: number; orderCount: number; revenue: number }>>('/admin/dashboard/stats'),

  // === 用户/会员 ===
  memberList: (params: ListParams = {}) => http.get<ApiResponse<PaginationResponse<unknown>>>('/admin/member/list', { params }),
  memberDetail: (id: string | number) => http.get<ApiResponse<unknown>>(`/admin/member/${id}`),
  memberCreate: (payload: Record<string, unknown>) => http.post<ApiResponse<unknown>>('/admin/member', payload),
  memberUpdate: (id: string | number, payload: Record<string, unknown>) => http.put<ApiResponse<unknown>>(`/admin/member/${id}`, payload),
  memberDelete: (id: string | number) => http.delete<ApiResponse<void>>(`/admin/member/${id}`),
  memberAudit: (id: string | number, status: number) => http.post<ApiResponse<void>>(`/admin/member/${id}/audit`, { status }),
  memberGroupList: (params: ListParams = {}) => http.get<ApiResponse<PaginationResponse<unknown>>>('/admin/member/group/list', { params }),
  memberLevelList: (params: ListParams = {}) => http.get<ApiResponse<unknown[]>>('/admin/member/level/list', { params }),
  memberPostList: (params: ListParams = {}) => http.get<ApiResponse<PaginationResponse<unknown>>>('/admin/member/post/list', { params }),
  memberTagList: (params: ListParams = {}) => http.get<ApiResponse<PaginationResponse<unknown>>>('/admin/member/tag/list', { params }),
  memberCompanyList: (params: ListParams = {}) => http.get<ApiResponse<PaginationResponse<unknown>>>('/admin/member/company/list', { params }),
  memberCompanyTypeList: () => http.get<ApiResponse<unknown[]>>('/admin/member/company/type/list'),

  // === 账号/安全 ===
  accountList: (params: ListParams = {}) => http.get<ApiResponse<PaginationResponse<unknown>>>('/admin/account/list', { params }),
  accountSecurity: () => http.get<ApiResponse<unknown>>('/admin/account/security'),

  // === 组织架构 ===
  orgUserList: (params: ListParams = {}) => http.get<ApiResponse<PaginationResponse<unknown>>>('/admin/org/user/list', { params }),
  orgDepartmentTree: () => http.get<ApiResponse<unknown[]>>('/admin/org/department/tree'),
  orgDepartmentList: (params: ListParams = {}) => http.get<ApiResponse<PaginationResponse<unknown>>>('/admin/org/department/list', { params }),

  // === 课程/学习 ===
  learnLessonList: (params: ListParams = {}) => http.get<ApiResponse<PaginationResponse<unknown>>>('/learn/lesson/list', { params }),
  learnLessonTrash: (params: ListParams = {}) => http.get<ApiResponse<PaginationResponse<unknown>>>('/learn/lesson/trash', { params }),
  learnCategoryList: (params: ListParams = {}) => http.get<ApiResponse<unknown[]>>('/learn/category/list', { params }),
  learnCategoryTree: () => http.get<ApiResponse<unknown[]>>('/learn/category/tree'),
  learnMapList: (params: ListParams = {}) => http.get<ApiResponse<PaginationResponse<unknown>>>('/learn/learn-map/list', { params }),
  learnTopicList: (params: ListParams = {}) => http.get<ApiResponse<PaginationResponse<unknown>>>('/learn/topic/list', { params }),
  learnTopicCategoryList: (params: ListParams = {}) => http.get<ApiResponse<unknown[]>>('/learn/topic-category/list', { params }),
  learnOrderList: (params: ListParams = {}) => http.get<ApiResponse<PaginationResponse<unknown>>>('/learn/order/list', { params }),
  learnOrderInvoiceTitle: (params: ListParams = {}) => http.get<ApiResponse<PaginationResponse<unknown>>>('/learn/order/invoice-title', { params }),
  learnOrderInvoiceApplication: (params: ListParams = {}) => http.get<ApiResponse<PaginationResponse<unknown>>>('/learn/order/invoice-application', { params }),
  learnSignupList: (params: ListParams = {}) => http.get<ApiResponse<PaginationResponse<unknown>>>('/learn/sign-up/list', { params }),
  learnHomeworkList: (params: ListParams = {}) => http.get<ApiResponse<PaginationResponse<unknown>>>('/learn/homework-record/list', { params }),
  learnReportLesson: (params: ListParams = {}) => http.get<ApiResponse<unknown>>('/learn/report/lesson', { params }),
  learnReportMember: (params: ListParams = {}) => http.get<ApiResponse<unknown>>('/learn/report/member', { params }),

  // === 考试/题库 ===
  examList: (params: ListParams = {}) => http.get<ApiResponse<PaginationResponse<unknown>>>('/admin/exam/list', { params }),
  examPaperList: (params: ListParams = {}) => http.get<ApiResponse<PaginationResponse<unknown>>>('/admin/exam/paper/list', { params }),
  examPaperMock: (params: ListParams = {}) => http.get<ApiResponse<PaginationResponse<unknown>>>('/admin/exam/paper/mock', { params }),
  examPaperNormal: (params: ListParams = {}) => http.get<ApiResponse<PaginationResponse<unknown>>>('/admin/exam/paper/normal', { params }),
  examPaperRandom: (params: ListParams = {}) => http.get<ApiResponse<PaginationResponse<unknown>>>('/admin/exam/paper/random', { params }),
  examPaperCategory: (params: ListParams = {}) => http.get<ApiResponse<unknown[]>>('/admin/exam/paper/category', { params }),
  examQuestionList: (params: ListParams = {}) => http.get<ApiResponse<PaginationResponse<unknown>>>('/admin/exam/question/list', { params }),
  examQuestionCategory: (params: ListParams = {}) => http.get<ApiResponse<unknown[]>>('/admin/exam/question/category', { params }),
  examQuestionSingle: (params: ListParams = {}) => http.get<ApiResponse<PaginationResponse<unknown>>>('/admin/exam/question/single', { params }),
  examQuestionMulti: (params: ListParams = {}) => http.get<ApiResponse<PaginationResponse<unknown>>>('/admin/exam/question/multi', { params }),
  examQuestionJudgment: (params: ListParams = {}) => http.get<ApiResponse<PaginationResponse<unknown>>>('/admin/exam/question/judgment', { params }),
  examQuestionFill: (params: ListParams = {}) => http.get<ApiResponse<PaginationResponse<unknown>>>('/admin/exam/question/fill', { params }),
  examQuestionSubjective: (params: ListParams = {}) => http.get<ApiResponse<PaginationResponse<unknown>>>('/admin/exam/question/subjective', { params }),
  examAnswerList: (params: ListParams = {}) => http.get<ApiResponse<PaginationResponse<unknown>>>('/admin/exam/answer/list', { params }),
  examAnswerDetail: (id: string | number) => http.get<ApiResponse<unknown>>(`/admin/exam/answer/${id}`),
  examAnswerMark: (params: ListParams = {}) => http.get<ApiResponse<PaginationResponse<unknown>>>('/admin/exam/answer/mark', { params }),

  // === 直播 ===
  liveChannelList: (params: ListParams = {}) => http.get<ApiResponse<PaginationResponse<unknown>>>('/admin/live/channel/list', { params }),
  liveLecturerList: (params: ListParams = {}) => http.get<ApiResponse<PaginationResponse<unknown>>>('/admin/live/lecturer/list', { params }),
  liveCategoryList: (params: ListParams = {}) => http.get<ApiResponse<unknown[]>>('/admin/live/category/list', { params }),

  // === 社区 ===
  askQuestionList: (params: ListParams = {}) => http.get<ApiResponse<PaginationResponse<unknown>>>('/admin/ask/question/list', { params }),
  askCategoryList: (params: ListParams = {}) => http.get<ApiResponse<unknown[]>>('/admin/ask/category/list', { params }),
  circleList: (params: ListParams = {}) => http.get<ApiResponse<PaginationResponse<unknown>>>('/admin/circle/list', { params }),
  circleDynamicList: (params: ListParams = {}) => http.get<ApiResponse<PaginationResponse<unknown>>>('/admin/circle/dynamic/list', { params }),
  circleCategoryList: (params: ListParams = {}) => http.get<ApiResponse<unknown[]>>('/admin/circle/category/list', { params }),
  articleContentList: (params: ListParams = {}) => http.get<ApiResponse<PaginationResponse<unknown>>>('/admin/article/content/list', { params }),
  articleCategoryList: (params: ListParams = {}) => http.get<ApiResponse<unknown[]>>('/admin/article/category/list', { params }),
  commentList: (params: ListParams = {}) => http.get<ApiResponse<PaginationResponse<unknown>>>('/admin/comment/list', { params }),
  commentSensitive: (params: ListParams = {}) => http.get<ApiResponse<PaginationResponse<unknown>>>('/admin/comment/sensitive', { params }),

  // === 内容 ===
  newsContentList: (params: ListParams = {}) => http.get<ApiResponse<PaginationResponse<unknown>>>('/admin/news/content/list', { params }),
  resourceList: (params: ListParams = {}) => http.get<ApiResponse<PaginationResponse<unknown>>>('/admin/resource/list', { params }),
  resourceCategory: (params: ListParams = {}) => http.get<ApiResponse<unknown[]>>('/admin/resource/category', { params }),
  resourceTag: (params: ListParams = {}) => http.get<ApiResponse<PaginationResponse<unknown>>>('/admin/resource/tag/list', { params }),

  // === 积分/证书 ===
  pointList: (params: ListParams = {}) => http.get<ApiResponse<PaginationResponse<unknown>>>('/admin/point/list', { params }),
  pointChannel: (params: ListParams = {}) => http.get<ApiResponse<unknown[]>>('/admin/point/channel', { params }),
  pointRecord: (params: ListParams = {}) => http.get<ApiResponse<PaginationResponse<unknown>>>('/admin/point/record', { params }),
  certificateTemplate: (params: ListParams = {}) => http.get<ApiResponse<PaginationResponse<unknown>>>('/admin/certificate/template', { params }),

  // === 消息 ===
  messageAnnouncement: (params: ListParams = {}) => http.get<ApiResponse<PaginationResponse<unknown>>>('/admin/message/announcement', { params }),

  // === 权限/角色 ===
  roleList: (params: ListParams = {}) => http.get<ApiResponse<PaginationResponse<unknown>>>('/admin/auth/role/list', { params }),
  authorityList: (params: ListParams = {}) => http.get<ApiResponse<unknown[]>>('/admin/auth/authority/list', { params }),

  // === 设置 ===
  settingBase: () => http.get<ApiResponse<unknown>>('/admin/setting/base'),
  settingBaseSave: (payload: Record<string, unknown>) => http.post<ApiResponse<unknown>>('/admin/setting/base', payload),
  settingCarousel: (params: ListParams = {}) => http.get<ApiResponse<PaginationResponse<unknown>>>('/admin/setting/carousel', { params }),
  settingAgreement: () => http.get<ApiResponse<unknown[]>>('/admin/setting/agreement'),
  searchHot: (params: ListParams = {}) => http.get<ApiResponse<PaginationResponse<unknown>>>('/admin/search/hot', { params }),

  // === P21.3: CRUD 方法补全 (create / update / delete) ===
  // 会员子实体
  memberTagCreate: (payload: Record<string, unknown>) => http.post<ApiResponse<unknown>>('/admin/member/tag', payload),
  memberTagUpdate: (id: string | number, payload: Record<string, unknown>) => http.put<ApiResponse<unknown>>(`/admin/member/tag/${id}`, payload),
  memberTagDelete: (id: string | number) => http.delete<ApiResponse<void>>(`/admin/member/tag/${id}`),
  memberPostCreate: (payload: Record<string, unknown>) => http.post<ApiResponse<unknown>>('/admin/member/post', payload),
  memberPostUpdate: (id: string | number, payload: Record<string, unknown>) => http.put<ApiResponse<unknown>>(`/admin/member/post/${id}`, payload),
  memberPostDelete: (id: string | number) => http.delete<ApiResponse<void>>(`/admin/member/post/${id}`),
  memberLevelCreate: (payload: Record<string, unknown>) => http.post<ApiResponse<unknown>>('/admin/member/level', payload),
  memberLevelUpdate: (id: string | number, payload: Record<string, unknown>) => http.put<ApiResponse<unknown>>(`/admin/member/level/${id}`, payload),
  memberLevelDelete: (id: string | number) => http.delete<ApiResponse<void>>(`/admin/member/level/${id}`),
  memberGroupCreate: (payload: Record<string, unknown>) => http.post<ApiResponse<unknown>>('/admin/member/group', payload),
  memberGroupUpdate: (id: string | number, payload: Record<string, unknown>) => http.put<ApiResponse<unknown>>(`/admin/member/group/${id}`, payload),
  memberGroupDelete: (id: string | number) => http.delete<ApiResponse<void>>(`/admin/member/group/${id}`),
  memberCompanyCreate: (payload: Record<string, unknown>) => http.post<ApiResponse<unknown>>('/admin/member/company', payload),
  memberCompanyUpdate: (id: string | number, payload: Record<string, unknown>) => http.put<ApiResponse<unknown>>(`/admin/member/company/${id}`, payload),
  memberCompanyDelete: (id: string | number) => http.delete<ApiResponse<void>>(`/admin/member/company/${id}`),

  // 账号
  accountCreate: (payload: Record<string, unknown>) => http.post<ApiResponse<unknown>>('/admin/account', payload),
  accountUpdate: (id: string | number, payload: Record<string, unknown>) => http.put<ApiResponse<unknown>>(`/admin/account/${id}`, payload),
  accountDelete: (id: string | number) => http.delete<ApiResponse<void>>(`/admin/account/${id}`),

  // 组织架构
  orgDepartmentCreate: (payload: Record<string, unknown>) => http.post<ApiResponse<unknown>>('/admin/org/department', payload),
  orgDepartmentUpdate: (id: string | number, payload: Record<string, unknown>) => http.put<ApiResponse<unknown>>(`/admin/org/department/${id}`, payload),
  orgDepartmentDelete: (id: string | number) => http.delete<ApiResponse<void>>(`/admin/org/department/${id}`),

  // 课程/学习
  learnCategoryCreate: (payload: Record<string, unknown>) => http.post<ApiResponse<unknown>>('/learn/category', payload),
  learnCategoryUpdate: (id: string | number, payload: Record<string, unknown>) => http.put<ApiResponse<unknown>>(`/learn/category/${id}`, payload),
  learnCategoryDelete: (id: string | number) => http.delete<ApiResponse<void>>(`/learn/category/${id}`),
  learnMapCreate: (payload: Record<string, unknown>) => http.post<ApiResponse<unknown>>('/learn/learn-map', payload),
  learnMapUpdate: (id: string | number, payload: Record<string, unknown>) => http.put<ApiResponse<unknown>>(`/learn/learn-map/${id}`, payload),
  learnMapDelete: (id: string | number) => http.delete<ApiResponse<void>>(`/learn/learn-map/${id}`),
  learnTopicCreate: (payload: Record<string, unknown>) => http.post<ApiResponse<unknown>>('/learn/topic', payload),
  learnTopicUpdate: (id: string | number, payload: Record<string, unknown>) => http.put<ApiResponse<unknown>>(`/learn/topic/${id}`, payload),
  learnTopicDelete: (id: string | number) => http.delete<ApiResponse<void>>(`/learn/topic/${id}`),
  learnTopicCategoryCreate: (payload: Record<string, unknown>) => http.post<ApiResponse<unknown>>('/learn/topic-category', payload),
  learnTopicCategoryUpdate: (id: string | number, payload: Record<string, unknown>) => http.put<ApiResponse<unknown>>(`/learn/topic-category/${id}`, payload),
  learnTopicCategoryDelete: (id: string | number) => http.delete<ApiResponse<void>>(`/learn/topic-category/${id}`),
  learnLessonCreate: (payload: Record<string, unknown>) => http.post<ApiResponse<unknown>>('/learn/lesson', payload),
  learnLessonUpdate: (id: string | number, payload: Record<string, unknown>) => http.put<ApiResponse<unknown>>(`/learn/lesson/${id}`, payload),
  learnLessonDelete: (id: string | number) => http.delete<ApiResponse<void>>(`/learn/lesson/${id}`),
  learnSignupComplete: (id: string | number) => http.put<ApiResponse<unknown>>(`/learn/sign-up/${id}/complete`),
  learnSignupCancel: (id: string | number) => http.put<ApiResponse<unknown>>(`/learn/sign-up/${id}/cancel`),
  learnHomeworkReview: (id: string | number, payload: Record<string, unknown>) => http.put<ApiResponse<unknown>>(`/learn/homework-record/${id}/status`, payload),

  // 考试/题库
  examQuestionCategoryCreate: (payload: Record<string, unknown>) => http.post<ApiResponse<unknown>>('/admin/exam/question/category', payload),
  examQuestionCategoryUpdate: (id: string | number, payload: Record<string, unknown>) => http.put<ApiResponse<unknown>>(`/admin/exam/question/category/${id}`, payload),
  examQuestionCategoryDelete: (id: string | number) => http.delete<ApiResponse<void>>(`/admin/exam/question/category/${id}`),
  examPaperCategoryCreate: (payload: Record<string, unknown>) => http.post<ApiResponse<unknown>>('/admin/exam/paper/category', payload),
  examPaperCategoryUpdate: (id: string | number, payload: Record<string, unknown>) => http.put<ApiResponse<unknown>>(`/admin/exam/paper/category/${id}`, payload),
  examPaperCategoryDelete: (id: string | number) => http.delete<ApiResponse<void>>(`/admin/exam/paper/category/${id}`),

  // 直播
  liveLecturerCreate: (payload: Record<string, unknown>) => http.post<ApiResponse<unknown>>('/admin/live/lecturer', payload),
  liveLecturerUpdate: (id: string | number, payload: Record<string, unknown>) => http.put<ApiResponse<unknown>>(`/admin/live/lecturer/${id}`, payload),
  liveLecturerDelete: (id: string | number) => http.delete<ApiResponse<void>>(`/admin/live/lecturer/${id}`),
  liveCategoryCreate: (payload: Record<string, unknown>) => http.post<ApiResponse<unknown>>('/admin/live/category', payload),
  liveCategoryUpdate: (id: string | number, payload: Record<string, unknown>) => http.put<ApiResponse<unknown>>(`/admin/live/category/${id}`, payload),
  liveCategoryDelete: (id: string | number) => http.delete<ApiResponse<void>>(`/admin/live/category/${id}`),

  // 社区
  askCategoryCreate: (payload: Record<string, unknown>) => http.post<ApiResponse<unknown>>('/admin/ask/category', payload),
  askCategoryUpdate: (id: string | number, payload: Record<string, unknown>) => http.put<ApiResponse<unknown>>(`/admin/ask/category/${id}`, payload),
  askCategoryDelete: (id: string | number) => http.delete<ApiResponse<void>>(`/admin/ask/category/${id}`),
  circleCategoryCreate: (payload: Record<string, unknown>) => http.post<ApiResponse<unknown>>('/admin/circle/category', payload),
  circleCategoryUpdate: (id: string | number, payload: Record<string, unknown>) => http.put<ApiResponse<unknown>>(`/admin/circle/category/${id}`, payload),
  circleCategoryDelete: (id: string | number) => http.delete<ApiResponse<void>>(`/admin/circle/category/${id}`),
  articleCategoryCreate: (payload: Record<string, unknown>) => http.post<ApiResponse<unknown>>('/admin/article/category', payload),
  articleCategoryUpdate: (id: string | number, payload: Record<string, unknown>) => http.put<ApiResponse<unknown>>(`/admin/article/category/${id}`, payload),
  articleCategoryDelete: (id: string | number) => http.delete<ApiResponse<void>>(`/admin/article/category/${id}`),

  // 内容
  resourceCategoryCreate: (payload: Record<string, unknown>) => http.post<ApiResponse<unknown>>('/admin/resource/category', payload),
  resourceCategoryUpdate: (id: string | number, payload: Record<string, unknown>) => http.put<ApiResponse<unknown>>(`/admin/resource/category/${id}`, payload),
  resourceCategoryDelete: (id: string | number) => http.delete<ApiResponse<void>>(`/admin/resource/category/${id}`),
  resourceTagCreate: (payload: Record<string, unknown>) => http.post<ApiResponse<unknown>>('/admin/resource/tag', payload),
  resourceTagUpdate: (id: string | number, payload: Record<string, unknown>) => http.put<ApiResponse<unknown>>(`/admin/resource/tag/${id}`, payload),
  resourceTagDelete: (id: string | number) => http.delete<ApiResponse<void>>(`/admin/resource/tag/${id}`),

  // 积分/证书
  pointChannelCreate: (payload: Record<string, unknown>) => http.post<ApiResponse<unknown>>('/admin/point/channel', payload),
  pointChannelUpdate: (id: string | number, payload: Record<string, unknown>) => http.put<ApiResponse<unknown>>(`/admin/point/channel/${id}`, payload),
  pointChannelDelete: (id: string | number) => http.delete<ApiResponse<void>>(`/admin/point/channel/${id}`),
  certificateTemplateCreate: (payload: Record<string, unknown>) => http.post<ApiResponse<unknown>>('/admin/certificate/template', payload),
  certificateTemplateUpdate: (id: string | number, payload: Record<string, unknown>) => http.put<ApiResponse<unknown>>(`/admin/certificate/template/${id}`, payload),
  certificateTemplateDelete: (id: string | number) => http.delete<ApiResponse<void>>(`/admin/certificate/template/${id}`),

  // 消息
  messageAnnouncementCreate: (payload: Record<string, unknown>) => http.post<ApiResponse<unknown>>('/admin/message/announcement', payload),
  messageAnnouncementUpdate: (id: string | number, payload: Record<string, unknown>) => http.put<ApiResponse<unknown>>(`/admin/message/announcement/${id}`, payload),
  messageAnnouncementDelete: (id: string | number) => http.delete<ApiResponse<void>>(`/admin/message/announcement/${id}`),

  // 权限/角色
  roleCreate: (payload: Record<string, unknown>) => http.post<ApiResponse<unknown>>('/admin/auth/role', payload),
  roleUpdate: (id: string | number, payload: Record<string, unknown>) => http.put<ApiResponse<unknown>>(`/admin/auth/role/${id}`, payload),
  roleDelete: (id: string | number) => http.delete<ApiResponse<void>>(`/admin/auth/role/${id}`),
  authorityCreate: (payload: Record<string, unknown>) => http.post<ApiResponse<unknown>>('/admin/auth/authority', payload),
  authorityUpdate: (id: string | number, payload: Record<string, unknown>) => http.put<ApiResponse<unknown>>(`/admin/auth/authority/${id}`, payload),
  authorityDelete: (id: string | number) => http.delete<ApiResponse<void>>(`/admin/auth/authority/${id}`),

  // 设置
  settingCarouselCreate: (payload: Record<string, unknown>) => http.post<ApiResponse<unknown>>('/admin/setting/carousel', payload),
  settingCarouselUpdate: (id: string | number, payload: Record<string, unknown>) => http.put<ApiResponse<unknown>>(`/admin/setting/carousel/${id}`, payload),
  settingCarouselDelete: (id: string | number) => http.delete<ApiResponse<void>>(`/admin/setting/carousel/${id}`),
  searchHotCreate: (payload: Record<string, unknown>) => http.post<ApiResponse<unknown>>('/admin/search/hot', payload),
  searchHotUpdate: (id: string | number, payload: Record<string, unknown>) => http.put<ApiResponse<unknown>>(`/admin/search/hot/${id}`, payload),
  searchHotDelete: (id: string | number) => http.delete<ApiResponse<void>>(`/admin/search/hot/${id}`),

  // === P23.4: 批量删除方法 ===
  /** P23.4: 批量删除 */
  memberTagBatchDelete: (ids: (string | number)[]) =>
    http.post<ApiResponse<{ success: number; failed: number }>>('/admin/member/tag/batch-delete', { ids }),
  /** P23.4: 批量删除 */
  memberPostBatchDelete: (ids: (string | number)[]) =>
    http.post<ApiResponse<{ success: number; failed: number }>>('/admin/member/post/batch-delete', { ids }),
  /** P23.4: 批量删除 */
  memberLevelBatchDelete: (ids: (string | number)[]) =>
    http.post<ApiResponse<{ success: number; failed: number }>>('/admin/member/level/batch-delete', { ids }),
  /** P23.4: 批量删除 */
  memberGroupBatchDelete: (ids: (string | number)[]) =>
    http.post<ApiResponse<{ success: number; failed: number }>>('/admin/member/group/batch-delete', { ids }),
  /** P23.4: 批量删除 */
  memberCompanyBatchDelete: (ids: (string | number)[]) =>
    http.post<ApiResponse<{ success: number; failed: number }>>('/admin/member/company/batch-delete', { ids }),
  /** P23.4: 批量删除 */
  accountBatchDelete: (ids: (string | number)[]) =>
    http.post<ApiResponse<{ success: number; failed: number }>>('/admin/account/batch-delete', { ids }),
  /** P23.4: 批量删除 */
  orgDepartmentBatchDelete: (ids: (string | number)[]) =>
    http.post<ApiResponse<{ success: number; failed: number }>>('/admin/org/department/batch-delete', { ids }),
  /** P23.4: 批量删除 */
  learnCategoryBatchDelete: (ids: (string | number)[]) =>
    http.post<ApiResponse<{ success: number; failed: number }>>('/learn/category/batch-delete', { ids }),
  /** P23.4: 批量删除 */
  learnMapBatchDelete: (ids: (string | number)[]) =>
    http.post<ApiResponse<{ success: number; failed: number }>>('/learn/learn-map/batch-delete', { ids }),
  /** P23.4: 批量删除 */
  learnLessonBatchDelete: (ids: (string | number)[]) =>
    http.post<ApiResponse<{ success: number; failed: number }>>('/learn/lesson/batch-delete', { ids }),
  /** P23.4: 批量删除 */
  learnTopicBatchDelete: (ids: (string | number)[]) =>
    http.post<ApiResponse<{ success: number; failed: number }>>('/learn/topic/batch-delete', { ids }),
  /** P23.4: 批量删除 */
  learnTopicCategoryBatchDelete: (ids: (string | number)[]) =>
    http.post<ApiResponse<{ success: number; failed: number }>>('/learn/topic-category/batch-delete', { ids }),
  /** P23.4: 批量删除 */
  examQuestionCategoryBatchDelete: (ids: (string | number)[]) =>
    http.post<ApiResponse<{ success: number; failed: number }>>('/admin/exam/question/category/batch-delete', { ids }),
  /** P23.4: 批量删除 */
  examPaperCategoryBatchDelete: (ids: (string | number)[]) =>
    http.post<ApiResponse<{ success: number; failed: number }>>('/admin/exam/paper/category/batch-delete', { ids }),
  /** P23.4: 批量删除 */
  liveLecturerBatchDelete: (ids: (string | number)[]) =>
    http.post<ApiResponse<{ success: number; failed: number }>>('/admin/live/lecturer/batch-delete', { ids }),
  /** P23.4: 批量删除 */
  liveCategoryBatchDelete: (ids: (string | number)[]) =>
    http.post<ApiResponse<{ success: number; failed: number }>>('/admin/live/category/batch-delete', { ids }),
  /** P23.4: 批量删除 */
  askCategoryBatchDelete: (ids: (string | number)[]) =>
    http.post<ApiResponse<{ success: number; failed: number }>>('/admin/ask/category/batch-delete', { ids }),
  /** P23.4: 批量删除 */
  circleCategoryBatchDelete: (ids: (string | number)[]) =>
    http.post<ApiResponse<{ success: number; failed: number }>>('/admin/circle/category/batch-delete', { ids }),
  /** P23.4: 批量删除 */
  articleCategoryBatchDelete: (ids: (string | number)[]) =>
    http.post<ApiResponse<{ success: number; failed: number }>>('/admin/article/category/batch-delete', { ids }),
  /** P23.4: 批量删除 */
  resourceCategoryBatchDelete: (ids: (string | number)[]) =>
    http.post<ApiResponse<{ success: number; failed: number }>>('/admin/resource/category/batch-delete', { ids }),
  /** P23.4: 批量删除 */
  resourceTagBatchDelete: (ids: (string | number)[]) =>
    http.post<ApiResponse<{ success: number; failed: number }>>('/admin/resource/tag/batch-delete', { ids }),
  /** P23.4: 批量删除 */
  pointChannelBatchDelete: (ids: (string | number)[]) =>
    http.post<ApiResponse<{ success: number; failed: number }>>('/admin/point/channel/batch-delete', { ids }),
  /** P23.4: 批量删除 */
  certificateTemplateBatchDelete: (ids: (string | number)[]) =>
    http.post<ApiResponse<{ success: number; failed: number }>>('/admin/certificate/template/batch-delete', { ids }),
  /** P23.4: 批量删除 */
  messageAnnouncementBatchDelete: (ids: (string | number)[]) =>
    http.post<ApiResponse<{ success: number; failed: number }>>('/admin/message/announcement/batch-delete', { ids }),
  /** P23.4: 批量删除 */
  roleBatchDelete: (ids: (string | number)[]) =>
    http.post<ApiResponse<{ success: number; failed: number }>>('/admin/auth/role/batch-delete', { ids }),
  /** P23.4: 批量删除 */
  authorityBatchDelete: (ids: (string | number)[]) =>
    http.post<ApiResponse<{ success: number; failed: number }>>('/admin/auth/authority/batch-delete', { ids }),
  /** P23.4: 批量删除 */
  settingCarouselBatchDelete: (ids: (string | number)[]) =>
    http.post<ApiResponse<{ success: number; failed: number }>>('/admin/setting/carousel/batch-delete', { ids }),
  /** P23.4: 批量删除 */
  searchHotBatchDelete: (ids: (string | number)[]) =>
    http.post<ApiResponse<{ success: number; failed: number }>>('/admin/search/hot/batch-delete', { ids }),

  // === AI世界站点管理 ===
  aiworldSiteList: (params: ListParams = {}) => http.get<ApiResponse<PaginationResponse<unknown>>>('/admin/aiworld/site/list', { params }),
  aiworldSiteCreate: (payload: Record<string, unknown>) => http.post<ApiResponse<unknown>>('/admin/aiworld/site', payload),
  aiworldSiteUpdate: (id: string | number, payload: Record<string, unknown>) => http.put<ApiResponse<unknown>>(`/admin/aiworld/site/${id}`, payload),
  aiworldSiteDelete: (id: string | number) => http.delete<ApiResponse<void>>(`/admin/aiworld/site/${id}`),
  aiworldSiteBatchDelete: (ids: (string | number)[]) =>
    http.post<ApiResponse<{ success: number; failed: number }>>('/admin/aiworld/site/batch-delete', { ids }),

  // === 敏感词管理 (对齐后端 behavior.py /api/v1/behavior/sensitive/*) ===
  // 后端 POST /sensitive 使用 Query 参数(FastAPI 签名), 前端用 params 传递
  sensitiveList: (params: { page?: number; limit?: number; category?: string } = {}) =>
    http.get<ApiResponse<unknown[]>>('/behavior/sensitive/list', { params }),
  sensitiveCreate: (payload: { word: string; category?: string; level?: number; action?: string; replacement?: string }) =>
    http.post<ApiResponse<{ id: number }>>('/behavior/sensitive', null, { params: payload }),
  sensitiveDelete: (id: string | number) =>
    http.delete<ApiResponse<void>>(`/behavior/sensitive/${id}`),
}

// Proxy 运行时通过 normalizeApiResponse 把 AxiosResponse 解包为 ApiResponse，
// 因此返回类型需用 UnwrapAxiosMethod 映射为正确的业务类型（保留函数签名，只转换返回类型）
type UnwrapAxiosMethod<T> = T extends (...args: infer A) => Promise<import('axios').AxiosResponse<infer U>>
  ? (...args: A) => Promise<U>
  : T
type UnwrappedAdminApi = { [K in keyof typeof rawAdminApi]: UnwrapAxiosMethod<(typeof rawAdminApi)[K]> }

// P15.1 Proxy 包装:所有方法自动 fallback 到 seedData,正常路径用 normalizeApiResponse 统一格式
export const adminApi = new Proxy(rawAdminApi, {
  get(target, prop: string) {
    const orig = (target as Record<string, (...args: never[]) => unknown>)[prop]
    if (typeof orig !== 'function') return orig
    return async (...args: never[]) => {
      try {
        const response = await orig(...args)
        // 统一用 normalizeApiResponse 转换 AxiosResponse → ApiResponse
        return normalizeApiResponse(response)
      } catch (_e) {
        // Dashboard fallback
        if (prop === 'dashboardStats') return dashboardFallback()
        // 配置类 fallback
        if (prop === 'settingBase' || prop === 'settingAgreement' || prop === 'accountSecurity') return configFallback()
        // 列表类 fallback
        if (SEED_MAP[prop]) return listFallback(prop, args[0])
        // 其他方法(创建/更新/删除)无 fallback,抛出错误
        throw _e
      }
    }
  },
}) as unknown as UnwrappedAdminApi

export default adminApi
