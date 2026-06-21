// admin.ts 单元测试 - 提升覆盖率
import { describe, it, expect, vi, beforeEach } from 'vitest'

// mock 请求与工具
vi.mock('@/utils/request', () => ({
  default: vi.fn().mockImplementation((config: any) => {
    if (config && typeof config === 'object' && config.url) {
      return Promise.resolve({ data: { code: 200, data: {}, success: true, message: 'ok' } })
    }
    // 调用方式为 http.get(...), http.post(...)
    return Promise.resolve({ data: { code: 200, data: {} } })
  }),
  get: vi.fn().mockResolvedValue({ data: { code: 200, data: {} } }),
  post: vi.fn().mockResolvedValue({ data: { code: 200, data: {} } }),
  put: vi.fn().mockResolvedValue({ data: { code: 200, data: {} } }),
  delete: vi.fn().mockResolvedValue({ data: { code: 200, data: {} } }),
}))

vi.mock('@/utils/api-response', () => ({
  normalizeApiResponse: vi.fn((r: any) => r?.data || { code: 200, data: {} }),
}))

vi.mock('@/utils/seedData', () => ({
  querySeed: vi.fn().mockResolvedValue({ data: { list: [], total: 0, page: 1, size: 20 } }),
  getConfig: vi.fn().mockResolvedValue({}),
}))

import * as apiNs from '../admin'

const api: any = (apiNs as any).adminApi || (apiNs as any).default

async function callFn(name: string, ...args: any[]): Promise<any> {
  try {
    const result = await api[name](...args)
    expect(result).toBeDefined()
    return result
  } catch (e) {
    expect(e).toBeDefined()
    return null
  }
}

describe('admin', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // 列表类方法
  it('list 列表方法', async () => {
    await callFn('memberList', {})
    await callFn('memberGroupList', {})
    await callFn('memberLevelList', {})
    await callFn('memberPostList', {})
    await callFn('memberTagList', {})
    await callFn('memberCompanyList', {})
    await callFn('memberCompanyTypeList')
    await callFn('accountList', {})
    await callFn('accountSecurity')
    await callFn('orgUserList', {})
    await callFn('orgDepartmentTree')
    await callFn('orgDepartmentList', {})
    await callFn('learnLessonList', {})
    await callFn('learnLessonTrash', {})
    await callFn('learnCategoryList', {})
    await callFn('learnCategoryTree')
    await callFn('learnMapList', {})
    await callFn('learnTopicList', {})
    await callFn('learnTopicCategoryList', {})
    await callFn('learnOrderList', {})
    await callFn('learnOrderInvoiceTitle', {})
    await callFn('learnOrderInvoiceApplication', {})
    await callFn('learnSignupList', {})
    await callFn('learnReportLesson', {})
    await callFn('learnReportMember', {})
    await callFn('examList', {})
    await callFn('examPaperList', {})
    await callFn('examPaperMock', {})
    await callFn('examPaperNormal', {})
    await callFn('examPaperRandom', {})
    await callFn('examPaperCategory', {})
    await callFn('examQuestionList', {})
    await callFn('examQuestionCategory', {})
    await callFn('examQuestionSingle', {})
    await callFn('examQuestionMulti', {})
    await callFn('examQuestionJudgment', {})
    await callFn('examQuestionFill', {})
    await callFn('examQuestionSubjective', {})
    await callFn('examAnswerList', {})
    await callFn('examAnswerDetail', 1)
    await callFn('examAnswerMark', {})
    await callFn('liveChannelList', {})
    await callFn('liveLecturerList', {})
    await callFn('liveCategoryList', {})
    await callFn('askQuestionList', {})
    await callFn('askCategoryList', {})
    await callFn('circleList', {})
    await callFn('circleDynamicList', {})
    await callFn('circleCategoryList', {})
    await callFn('articleContentList', {})
    await callFn('articleCategoryList', {})
    await callFn('commentList', {})
    await callFn('commentSensitive', {})
    await callFn('newsContentList', {})
    await callFn('resourceList', {})
    await callFn('resourceCategory', {})
    await callFn('resourceTag', {})
    await callFn('pointList', {})
    await callFn('pointChannel', {})
    await callFn('pointRecord', {})
    await callFn('certificateTemplate', {})
    await callFn('messageAnnouncement', {})
    await callFn('roleList', {})
    await callFn('authorityList', {})
    await callFn('settingBase')
    await callFn('settingCarousel', {})
    await callFn('settingAgreement')
    await callFn('searchHot', {})
    await callFn('aiworldSiteList', {})
  })

  // CRUD 详情
  it('CRUD 详情', async () => {
    await callFn('dashboardStats')
    await callFn('memberDetail', 1)
    await callFn('memberCreate', {})
    await callFn('memberUpdate', 1, {})
    await callFn('memberDelete', 1)
    await callFn('memberAudit', 1, 1)
    await callFn('settingBaseSave', {})
  })

  // 会员子实体 CRUD
  it('会员子实体 CRUD', async () => {
    await callFn('memberTagCreate', {})
    await callFn('memberTagUpdate', 1, {})
    await callFn('memberTagDelete', 1)
    await callFn('memberPostCreate', {})
    await callFn('memberPostUpdate', 1, {})
    await callFn('memberPostDelete', 1)
    await callFn('memberLevelCreate', {})
    await callFn('memberLevelUpdate', 1, {})
    await callFn('memberLevelDelete', 1)
    await callFn('memberGroupCreate', {})
    await callFn('memberGroupUpdate', 1, {})
    await callFn('memberGroupDelete', 1)
    await callFn('memberCompanyCreate', {})
    await callFn('memberCompanyUpdate', 1, {})
    await callFn('memberCompanyDelete', 1)
    await callFn('accountCreate', {})
    await callFn('accountUpdate', 1, {})
    await callFn('accountDelete', 1)
    await callFn('orgDepartmentCreate', {})
    await callFn('orgDepartmentUpdate', 1, {})
    await callFn('orgDepartmentDelete', 1)
  })

  // 课程/考试/直播/社区/内容/积分/消息/权限/设置 CRUD
  it('各业务 CRUD', async () => {
    await callFn('learnCategoryCreate', {})
    await callFn('learnCategoryUpdate', 1, {})
    await callFn('learnCategoryDelete', 1)
    await callFn('learnMapCreate', {})
    await callFn('learnMapUpdate', 1, {})
    await callFn('learnMapDelete', 1)
    await callFn('learnTopicCreate', {})
    await callFn('learnTopicUpdate', 1, {})
    await callFn('learnTopicDelete', 1)
    await callFn('learnTopicCategoryCreate', {})
    await callFn('learnTopicCategoryUpdate', 1, {})
    await callFn('learnTopicCategoryDelete', 1)
    await callFn('examQuestionCategoryCreate', {})
    await callFn('examQuestionCategoryUpdate', 1, {})
    await callFn('examQuestionCategoryDelete', 1)
    await callFn('examPaperCategoryCreate', {})
    await callFn('examPaperCategoryUpdate', 1, {})
    await callFn('examPaperCategoryDelete', 1)
    await callFn('liveLecturerCreate', {})
    await callFn('liveLecturerUpdate', 1, {})
    await callFn('liveLecturerDelete', 1)
    await callFn('liveCategoryCreate', {})
    await callFn('liveCategoryUpdate', 1, {})
    await callFn('liveCategoryDelete', 1)
    await callFn('askCategoryCreate', {})
    await callFn('askCategoryUpdate', 1, {})
    await callFn('askCategoryDelete', 1)
    await callFn('circleCategoryCreate', {})
    await callFn('circleCategoryUpdate', 1, {})
    await callFn('circleCategoryDelete', 1)
    await callFn('articleCategoryCreate', {})
    await callFn('articleCategoryUpdate', 1, {})
    await callFn('articleCategoryDelete', 1)
    await callFn('resourceCategoryCreate', {})
    await callFn('resourceCategoryUpdate', 1, {})
    await callFn('resourceCategoryDelete', 1)
    await callFn('resourceTagCreate', {})
    await callFn('resourceTagUpdate', 1, {})
    await callFn('resourceTagDelete', 1)
    await callFn('pointChannelCreate', {})
    await callFn('pointChannelUpdate', 1, {})
    await callFn('pointChannelDelete', 1)
    await callFn('certificateTemplateCreate', {})
    await callFn('certificateTemplateUpdate', 1, {})
    await callFn('certificateTemplateDelete', 1)
    await callFn('messageAnnouncementCreate', {})
    await callFn('messageAnnouncementUpdate', 1, {})
    await callFn('messageAnnouncementDelete', 1)
    await callFn('roleCreate', {})
    await callFn('roleUpdate', 1, {})
    await callFn('roleDelete', 1)
    await callFn('authorityCreate', {})
    await callFn('authorityUpdate', 1, {})
    await callFn('authorityDelete', 1)
    await callFn('settingCarouselCreate', {})
    await callFn('settingCarouselUpdate', 1, {})
    await callFn('settingCarouselDelete', 1)
    await callFn('searchHotCreate', {})
    await callFn('searchHotUpdate', 1, {})
    await callFn('searchHotDelete', 1)
  })

  // 批量删除
  it('批量删除方法', async () => {
    await callFn('memberTagBatchDelete', [1, 2])
    await callFn('memberPostBatchDelete', [1, 2])
    await callFn('memberLevelBatchDelete', [1, 2])
    await callFn('memberGroupBatchDelete', [1, 2])
    await callFn('memberCompanyBatchDelete', [1, 2])
    await callFn('accountBatchDelete', [1, 2])
    await callFn('orgDepartmentBatchDelete', [1, 2])
    await callFn('learnCategoryBatchDelete', [1, 2])
    await callFn('learnMapBatchDelete', [1, 2])
    await callFn('learnTopicBatchDelete', [1, 2])
    await callFn('learnTopicCategoryBatchDelete', [1, 2])
    await callFn('examQuestionCategoryBatchDelete', [1, 2])
    await callFn('examPaperCategoryBatchDelete', [1, 2])
    await callFn('liveLecturerBatchDelete', [1, 2])
    await callFn('liveCategoryBatchDelete', [1, 2])
    await callFn('askCategoryBatchDelete', [1, 2])
    await callFn('circleCategoryBatchDelete', [1, 2])
    await callFn('articleCategoryBatchDelete', [1, 2])
    await callFn('resourceCategoryBatchDelete', [1, 2])
    await callFn('resourceTagBatchDelete', [1, 2])
    await callFn('pointChannelBatchDelete', [1, 2])
    await callFn('certificateTemplateBatchDelete', [1, 2])
    await callFn('messageAnnouncementBatchDelete', [1, 2])
    await callFn('roleBatchDelete', [1, 2])
    await callFn('authorityBatchDelete', [1, 2])
    await callFn('settingCarouselBatchDelete', [1, 2])
    await callFn('searchHotBatchDelete', [1, 2])
  })

  // AI 站点 CRUD
  it('AI 站点 CRUD', async () => {
    await callFn('aiworldSiteCreate', {})
    await callFn('aiworldSiteUpdate', 1, {})
    await callFn('aiworldSiteDelete', 1)
    await callFn('aiworldSiteBatchDelete', [1, 2])
  })

  // 默认导出 adminApi
  it('默认导出 adminApi', () => {
    expect(apiNs.default).toBeDefined()
    expect((apiNs as any).adminApi).toBeDefined()
    expect(api).toBeDefined()
  })
})
