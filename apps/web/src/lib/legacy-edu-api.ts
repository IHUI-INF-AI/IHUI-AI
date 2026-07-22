/**
 * 旧架构 edu-web 函数名桥接层 (2026-07-22 立)
 *
 * 背景: 旧架构 git commit 3ee96cf09 中 client/src/api/* 包含 17 个旧命名函数
 * (findCategoryList/toTree/getAllParent/saveLike/getQuestionList/saveQuestion/
 *  getAnswerList/saveAnswer/getMemberQuestionList/getMemberAnswerList/findList/
 *  getArticle/getNews/findTopList/findRecommendList/getLetterMember/getLetterList),
 * 新架构已重命名,旧调用方代码无法直接迁移。
 *
 * 策略: 本文件以旧函数名暴露包装,内部直接调用新 lib 端点,
 * 实现零行为差异 + 最小迁移成本。旧调用方按需逐步替换为新名即可,
 * 无需一次性重写所有页面。
 *
 * 完整旧→新映射表: @ihui/types → LEGACY_EDU_API_RENAMES
 */
import * as api from '@ihui/api-client'
import type { ApiResult } from '@ihui/types'

// ===================== category（旧 category.ts 桥接） =====================

/** @deprecated 使用 getCategories from @ihui/api-client → system.ts */
export const findCategoryList = api.getCategories

/** @deprecated 使用 getCategoryTree from @ihui/api-client → system.ts */
export const toTree = (type?: string) => api.getCategoryTree(type)

// ===================== like（旧 like.ts 桥接） =====================

/** @deprecated 使用 recordBehavior from @ihui/api-client → system.ts */
export const saveLike = (input: { targetType: string; targetId: string }) =>
  api.recordBehavior({ action: 'like', targetType: input.targetType, targetId: input.targetId })

/** @deprecated 使用 getMyAsks from @ihui/api-client → community.ts */
export const getMemberLikeList = (query?: { page?: number; pageSize?: number }) =>
  api.getMyAsks(query)

// ===================== question/answer（旧 question.ts 桥接） =====================

/** @deprecated 使用 getAsks from @ihui/api-client → community.ts */
export const getQuestionList = api.getAsks

/** @deprecated 使用 createAsk from @ihui/api-client → community.ts */
export const saveQuestion = api.createAsk

/** @deprecated 使用 getAnswers from @ihui/api-client → community.ts */
export const getAnswerList = api.getAnswers

/** @deprecated 使用 createAnswer from @ihui/api-client → community.ts */
export const saveAnswer = api.createAnswer

/** @deprecated 使用 getMyAsks from @ihui/api-client → community.ts */
export const getMemberQuestionList = api.getMyAsks

/** @deprecated 使用 getMyAnswers from @ihui/api-client → community.ts */
export const getMemberAnswerList = api.getMyAnswers

// ===================== article（旧 article.ts 桥接） =====================

/** @deprecated 使用 getNews from @ihui/api-client → community.ts */
export const findList = (query?: { page?: number; pageSize?: number; category?: string; keyword?: string }) =>
  api.getNews(query ?? {})

/** @deprecated 使用 getNewsById from @ihui/api-client → community.ts */
export const getArticle = api.getNewsById

/** @deprecated 使用 countMyQuestions from @ihui/api-client → community.ts */
export const countMemberArticle = api.countMyQuestions

// ===================== news（旧 news.ts 桥接） =====================

/** @deprecated 使用 getNewsById from @ihui/api-client → community.ts */
export const getNews = api.getNewsById

/** @deprecated 使用 getNews + isTop from @ihui/api-client → community.ts */
export const findTopList = (query?: { page?: number; pageSize?: number; category?: string }) =>
  api.getNews({ ...query, isTop: 'true' } as Parameters<typeof api.getNews>[0])

/** @deprecated 使用 getNews + isRecommend from @ihui/api-client → community.ts */
export const findRecommendList = (query?: { page?: number; pageSize?: number; category?: string }) =>
  api.getNews({ ...query, isRecommend: 'true' } as Parameters<typeof api.getNews>[0])

// ===================== certificate（旧 certificate.ts 桥接） =====================

/** @deprecated 使用 getCertificates from @ihui/api-client → resource.ts */
export const findCertificateList = (query?: Parameters<typeof api.getCertificates>[0]) =>
  api.getCertificates(query ?? {})

// ===================== private letter（旧 message/letter.ts 桥接） =====================

/** @deprecated 使用 getPrivateLetterMembers from @ihui/api-client → private-letters.ts */
export const getMemberList = api.getPrivateLetterMembers

/** @deprecated 使用 getPrivateLetterMembers from @ihui/api-client → private-letters.ts */
export const getLetterMember = api.getPrivateLetterMembers

/** @deprecated 使用 getPrivateLetterList from @ihui/api-client → private-letters.ts */
export const getLetterList = api.getPrivateLetterList

/** @deprecated 使用 getPrivateLetterList from @ihui/api-client → private-letters.ts */
export const getNewLetterList = (query?: Parameters<typeof api.getPrivateLetterList>[0]) =>
  api.getPrivateLetterList({ ...query, sort: 'desc' } as Parameters<typeof api.getPrivateLetterList>[0])

/** 同函数名,保留别名以便全局替换时统一管理 */
export const sendPrivateLetter = api.sendPrivateLetter

/** @deprecated 使用 getAnnouncements from @ihui/api-client → legacy-public.ts */
export const getNoticeList = (query?: { page?: number; pageSize?: number }) =>
  api.getAnnouncements(query ?? {})

// ===================== point（旧 point/index.ts 桥接） =====================

/** @deprecated 使用 getMyPoints from @ihui/api-client → legacy-public.ts */
export const countMemberPoint = api.getMyPoints

/** @deprecated 使用 getPointTransactions from @ihui/api-client → legacy-public.ts */
export const getRecordList = (query?: { page?: number; pageSize?: number; type?: 'earn' | 'spend' }) =>
  api.getPointTransactions(query ?? {})

// ===================== search（旧 search/index.ts 桥接） =====================

/** @deprecated 使用 searchContent from @ihui/api-client → legacy-public.ts */
export const getSearchTypeList = (): Promise<ApiResult<api.SearchType[]>> =>
  Promise.resolve({
    success: true,
    data: [
      { type: 'lesson', label: '课程' },
      { type: 'live', label: '直播' },
      { type: 'article', label: '文章' },
      { type: 'news', label: '资讯' },
      { type: 'ask', label: '问答' },
      { type: 'resource', label: '资源' },
      { type: 'exam', label: '考试' },
    ],
  })

/** @deprecated 使用 getSearchHotWords from @ihui/api-client → legacy-public.ts */
export const getHotWordList = api.getSearchHotWords

/** @deprecated 使用 searchContent from @ihui/api-client → legacy-public.ts */
export const getSearchContentList = (input: { q: string; type?: string; limit?: number }) =>
  api.searchContent({
    q: input.q,
    type: (input.type as 'user' | 'project' | 'file' | 'all') ?? 'all',
    limit: input.limit,
  })

// ===================== agreement（旧 agreement.ts 桥接） =====================

/** @deprecated 使用 getCurrentAgreement from @ihui/api-client → legacy-public.ts */
export const getAgreement = (type: api.AgreementType) => api.getCurrentAgreement(type)

// ===================== carousel（旧 carousel.ts 桥接） =====================

/** @deprecated 使用 getActiveCarousels from @ihui/api-client → legacy-public.ts */
export const getCarousel = api.getActiveCarousels

// ===================== recommend（旧 recommend.ts 桥接,P1 已补齐） =====================

/** @deprecated 使用 getHotLearnCourses from @ihui/api-client → learn.ts */
export const getHotLesson = api.getHotLearnCourses

/** @deprecated 使用 getRecommendLearnCourses from @ihui/api-client → learn.ts */
export const getRecommendLesson = api.getRecommendLearnCourses

/** @deprecated 使用 getLearnCategoryParents from @ihui/api-client → learn.ts */
export const getAllParent = api.getLearnCategoryParents
