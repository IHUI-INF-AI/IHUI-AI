// @ts-nocheck
/**
 * 教育平台用户端 API 适配层
 * - 由旧项目 src/api/*.js 解析生成（34 个文件）
 * - 旧路径自动加 /api/v1/edu 前缀（PREFIX + path）
 * - 保留旧回调签名 (params, success) / (data, success) / (success) / (params, success, notShowError)
 * - 用法: import { learnApi } from '@/api/edu/web-api'; const { getLessonList } = learnApi
 *
 * 路径前缀映射（旧 → 当前）:
 *   /learn/*         → /api/v1/edu/learn/*
 *   /exam/*          → /api/v1/edu/exam/*
 *   /live/*          → /api/v1/edu/live/*
 *   /ask/*           → /api/v1/edu/ask/*
 *   /circle/*        → /api/v1/edu/circle/*
 *   /resource/*      → /api/v1/edu/resource/*
 *   /content/*       → /api/v1/edu/content/*
 *   /member/*        → /api/v1/edu/member/*
 *   /point/*         → /api/v1/edu/point/*
 *   /message/*       → /api/v1/edu/message/*        (含 announcement / comment)
 *   /order-api/*     → /api/v1/edu/order/*
 *   /search/*        → /api/v1/edu/search/*
 *   /oss/*           → /api/v1/edu/oss/*
 *   /setting/*       → /api/v1/edu/setting/*
 *   /visit-tracking/*→ /api/v1/edu/visit-tracking/*
 *   /learn/auth-api/certificate/* → /api/v1/edu/certificate/* (证书独立)
 */
import request from '@/utils/request'
import { ElMessage } from 'element-plus'

const PREFIX = '/api/v1/edu'

function unwrap(resp: any, success: any, notShowError?: boolean) {
  const body = resp && resp.data !== undefined ? resp.data : resp
  if (body && typeof body === 'object' && 'code' in body) {
    const code = body.code
    if (code === 0 || code === 200 || code === '0' || code === '200') {
      if (typeof success === 'function') success(body.data)
      return body.data
    }
    if (!notShowError) ElMessage.error(body.msg || body.message || '请求失败')
    return undefined
  }
  if (typeof success === 'function') success(body)
  return body
}

// 兼容旧签名: get(url, params, success, notShowError) 或 get(url, success)
// 注意: url 已包含完整前缀（方法处拼接 PREFIX），此处不再重复加前缀
export function get(url: string, params?: any, success?: any, notShowError?: boolean) {
  if (typeof params === 'function') { notShowError = success; success = params; params = null }
  return request.get(url, { params }).then((resp: any) => unwrap(resp, success, notShowError))
}
export function post(url: string, data?: any, success?: any, notShowError?: boolean) {
  if (typeof data === 'function') { notShowError = success; success = data; data = null }
  return request.post(url, data).then((resp: any) => unwrap(resp, success, notShowError))
}
export function put(url: string, data?: any, success?: any, notShowError?: boolean) {
  if (typeof data === 'function') { notShowError = success; success = data; data = null }
  return request.put(url, data).then((resp: any) => unwrap(resp, success, notShowError))
}
export function del(url: string, data?: any, success?: any, notShowError?: boolean) {
  if (typeof data === 'function') { notShowError = success; success = data; data = null }
  return request.delete(url, { data }).then((resp: any) => unwrap(resp, success, notShowError))
}
export function uploadFile(url: string, formData: any, success?: any, notShowError?: boolean) {
  return request.post(url, formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then((resp: any) => unwrap(resp, success, notShowError))
}

// ==================== 纯工具函数（自包含，从旧 api 模块提取） ====================
function toTree(data: any) {
  const resData = data ? [...data] : []
  const tree: any[] = []
  for (let i = 0; i < resData.length; i++) {
    if (resData[i].pid === 0 || !resData[i].pid) {
      const obj = {
        value: resData[i].id,
        label: resData[i].name
      }
      tree.push(obj)
      resData.splice(i, 1)
      i--
    }
  }
  function run(chiArr: any) {
    if (resData.length !== 0 && chiArr) {
      for (let i = 0; i < chiArr.length; i++) {
        for (let j = 0; j < resData.length; j++) {
          if (chiArr[i].value === resData[j].pid) {
            const obj = {
              value: resData[j].id,
              label: resData[j].name
            }
            if (!chiArr[i].children) {
              chiArr[i].children = []
            }
            chiArr[i].children.push(obj)
            resData.splice(j, 1)
            j--
          }
        }
        run(chiArr[i].children)
      }
    }
  }
  run(tree)
  return tree
}

function getAllParent(categoryList: any, cidList: any) {
  const fullPidArray: any[] = []
  function getFullParentCid(categoryList: any, id: any) {
    if (!categoryList || categoryList.length <= 0 || id === 0) {
      return [id]
    }
    const getRootCategory = function (categoryList: any, id: any) {
      for (const category of categoryList) {
        if (category.children && category.children.length > 0) {
          const c = getRootCategory(category.children, id)
          if (c && c.length > 0) {
            c.unshift(category.value)
            return c
          }
        }
        if (category.value === id) {
          return [category.value]
        }
      }
    }
    return getRootCategory(categoryList, id)
  }
  for (const id of cidList) {
    fullPidArray.push(getFullParentCid(categoryList, id))
  }
  return fullPidArray
}

// 简易 localStorage 缓存（替代旧 storageUtils）
const storageUtils = {
  getJsonExpire(key: string) {
    try {
      const raw = localStorage.getItem('edu_cat_' + key)
      if (!raw) return null
      const obj = JSON.parse(raw)
      if (obj && obj.expire && obj.expire > Date.now()) return obj.data
      return null
    } catch {
      return null
    }
  },
  setJsonExpire(key: string, data: any, expire: number) {
    try {
      localStorage.setItem('edu_cat_' + key, JSON.stringify({ data, expire: Date.now() + expire }))
    } catch {
      // ignore
    }
  }
}

// ==================== learn 课程 ====================
export const learnApi = {
  // lesson.js
  getLesson: (params: any, success: any) => get(PREFIX + '/learn/public-api/lesson', params, success),
  getLessonChapterList: (params: any, success: any) => get(PREFIX + '/learn/public-api/lesson/chapter/list', params, success),
  getLessonList: (params: any, success: any) => get(PREFIX + '/learn/public-api/lesson/list', params, success),
  getFavoriteLessonList: (params: any, success: any) => get(PREFIX + '/learn/auth-api/lesson/favorite/list', params, success),
  saveSignUp: (data: any, success: any) => post(PREFIX + '/learn/auth-api/sign-up', data, success),
  cancelSignUp: (data: any, success: any) => del(PREFIX + '/learn/auth-api/sign-up', data, success),
  getTotalLearnTime: (success: any) => get(PREFIX + '/learn/auth-api/sign-up/total-learn-time', {}, success),
  getTodayLearnTime: (success: any) => get(PREFIX + '/learn/auth-api/sign-up/today-learn-time', {}, success),
  getLearnTimeRankPercent: (success: any) => get(PREFIX + '/learn/auth-api/sign-up/learn-time-rank-percent', {}, success),
  saveRecord: (data: any, success: any) => post(PREFIX + '/learn/auth-api/record', data, success),
  updateRecord: (data: any, success: any) => put(PREFIX + '/learn/auth-api/record', data, success),
  getRecordLessonList: (params: any, success: any) => get(PREFIX + '/learn/auth-api/lesson/member/learn/list', params, success),
  getLessonListByIds: (params: any, success: any) => get(PREFIX + '/learn/public-api/lesson/list/by-ids', params, success),
  createLessonOrder: (data: any, success: any) => post(PREFIX + '/learn/auth-api/lesson/order', data, success),
  paymentLessonOrder: (data: any, success: any) => post(PREFIX + '/learn/auth-api/lesson/order/payment', data, success),
  getHomework: (params: any, success: any) => get(PREFIX + '/learn/auth-api/homework/record', params, success),
  updateHomework: (params: any, success: any) => put(PREFIX + '/learn/auth-api/homework/record', params, success),
  saveHomework: (params: any, success: any) => post(PREFIX + '/learn/auth-api/homework/record', params, success),
  learnSignUp: (params: any, success: any) => get(PREFIX + '/learn/public-api/sign-up', params, success),
  // category.js
  findCategoryList: (id: any, fetchAll: any, success: any) => get(PREFIX + '/learn/public-api/category/list', { id: id, fetchAll: fetchAll }, success),
  toTree: toTree,
  getAllParent: getAllParent,
  // topic.js
  getTopic: (params: any, success: any) => get(PREFIX + '/learn/public-api/topic', params, success),
  getTopicList: (params: any, success: any) => get(PREFIX + '/learn/public-api/topic/list', params, success),
  findTopicCategoryList: (id: any, fetchAll: any, success: any) => get(PREFIX + '/learn/public-api/topic/category/list', { id: id, fetchAll: fetchAll }, success),
  // index.js
  getRecommendLesson: (params: any, success: any) => get(PREFIX + '/learn/public-api/lesson/recommend/list', params, success),
  getHotLesson: (params: any, success: any) => get(PREFIX + '/learn/public-api/lesson/hottest/list', params, success),
}

// ==================== exam 考试 ====================
export const examApi = {
  // index.js
  getExam: (params: any, success: any) => get(PREFIX + '/exam/public-api/exam', params, success),
  getExamChapterList: (params: any, success: any) => get(PREFIX + '/exam/public-api/exam/chapter/list', params, success),
  getExamList: (params: any, success: any) => get(PREFIX + '/exam/public-api/exam/list', params, success),
  getFavoriteExamList: (params: any, success: any) => get(PREFIX + '/exam/auth-api/member/favorite/list', params, success),
  getByIds: (params: any, success: any) => get(PREFIX + '/exam/public-api/list/by-ids', params, success),
  getSignUp: (params: any, success: any) => get(PREFIX + '/exam/public-api/sign-up', params, success),
  saveSignUp: (data: any, success: any) => post(PREFIX + '/exam/auth-api/sign-up', data, success),
  cancelSignUp: (data: any, success: any) => del(PREFIX + '/exam/auth-api/sign-up', data, success),
  saveRecord: (data: any, success: any) => post(PREFIX + '/exam/auth-api/record', data, success),
  updateRecord: (data: any, success: any) => put(PREFIX + '/exam/auth-api/record', data, success),
  getRecord: (params: any, success: any) => get(PREFIX + '/exam/auth-api/record', params, success),
  submitRecord: (data: any, success: any) => put(PREFIX + '/exam/auth-api/record/submit', data, success),
  getExamSignUpList: (params: any, success: any) => get(PREFIX + '/exam/auth-api/member/sign-up/list', params, success),
  getExamRecordList: (params: any, success: any) => get(PREFIX + '/exam/auth-api/member/sign-up/record/list', params, success),
  getMemberPaperRecordList: (params: any, success: any) => get(PREFIX + '/exam/auth-api/paper/record/list', params, success),
  checkSubmitted: (params: any, success: any) => get(PREFIX + '/exam/auth-api/record/check-submitted', params, success),
  getWrongQuestionList: (params: any, success: any) => get(PREFIX + '/exam/auth-api/wrong-question/list', params, success),
  removeWrongQuestion: (data: any, success: any) => del(PREFIX + '/exam/auth-api/wrong-question', data, success),
  getRecommendExam: (params: any, success: any) => get(PREFIX + '/exam/public-api/recommend', params, success),
  getHotExam: (params: any, success: any) => get(PREFIX + '/exam/public-api/hot', params, success),
  // category.js
  findCategoryList: (id: any, fetchAll: any, success: any) => get(PREFIX + '/exam/public-api/category/list', { id: id, fetchAll: fetchAll }, success),
  toTree: toTree,
  getAllParent: getAllParent,
  // paper/index.js
  getPaper: (id: any, success: any) => get(PREFIX + '/exam/auth-api/paper', { id: id }, success),
}

// ==================== live 直播 ====================
export const liveApi = {
  // index.js
  liveList: (params: any, success: any) => get(PREFIX + '/live/public-api/channel/list', params, success),
  getChannel: (params: any, success: any) => get(PREFIX + '/live/public-api/channel', params, success),
  getChannelListByIds: (params: any, success: any) => get(PREFIX + '/live/public-api/channel/list/by-ids', params, success),
  subscribeChannel: (data: any, success: any) => post(PREFIX + '/live/auth-api/subscribe', data, success),
  // category.js
  findCategoryList: (id: any, fetchAll: any, success: any) => get(PREFIX + '/live/public-api/category/list', { id: id, fetchAll: fetchAll }, success),
  toTree: toTree,
  getHotLive: (params: any, success: any) => get(PREFIX + '/live/public-api/channel/hot/list', params, success),
  getRecommendLive: (params: any, success: any) => get(PREFIX + '/live/public-api/channel/recommend/list', params, success),
}

// ==================== ask 问答 ====================
export const askApi = {
  // index.js
  getQuestionList: (params: any, success: any) => get(PREFIX + '/ask/public-api/question/list', params, success),
  saveQuestion: (data: any, success: any) => post(PREFIX + '/ask/auth-api/question', data, success),
  updateQuestion: (data: any, success: any) => put(PREFIX + '/ask/auth-api/question', data, success),
  getCategoryList: (params: any, success: any) => get(PREFIX + '/ask/public-api/category/list', params, success),
  getAnswerList: (params: any, success: any) => get(PREFIX + '/ask/public-api/answer/list', params, success),
  getQuestion: (params: any, success: any) => get(PREFIX + '/ask/public-api/question', params, success),
  saveAnswer: (data: any, success: any) => post(PREFIX + '/ask/auth-api/answer', data, success),
  countMemberQuestion: (params: any, success: any) => get(PREFIX + '/ask/public-api/question/member/count', params, success),
  countMemberAnswer: (params: any, success: any) => get(PREFIX + '/ask/public-api/answer/member/count', params, success),
  getMemberQuestionList: (params: any, success: any) => get(PREFIX + '/ask/auth-api/member/question/list', params, success),
  getMemberAnswerList: (params: any, success: any) => get(PREFIX + '/ask/auth-api/member/answer/list', params, success),
  removeQuestion: (id: any, success: any) => del(PREFIX + '/ask/auth-api/question', { id: id }, success),
  removeAnswer: (id: any, success: any) => del(PREFIX + '/ask/auth-api/answer', { id: id }, success),
  updateAnswer: (data: any, success: any) => put(PREFIX + '/ask/auth-api/answer', data, success),
  getQuestionListByIds: (params: any, success: any) => get(PREFIX + '/ask/public-api/question/list/by-ids', params, success),
  getAnswerListByIds: (params: any, success: any) => get(PREFIX + '/ask/public-api/answer/list/by-ids', params, success),
  // category.js
  findCategoryList: (id: any, fetchAll: any, success: any) => get(PREFIX + '/ask/public-api/category/list', { id: id, fetchAll: fetchAll }, success),
}

// ==================== circle 圈子 ====================
export const circleApi = {
  // index.js
  getCircleList: (params: any, success: any) => get(PREFIX + '/circle/public-api/circle/list', params, success),
  getCircleHotList: (params: any, success: any) => get(PREFIX + '/circle/public-api/circle/hot/list', params, success),
  getHotCircleList: (params: any, success: any) => get(PREFIX + '/circle/public-api/circle/list', params, success),
  createCircle: (data: any, success: any) => post(PREFIX + '/circle/auth-api/circle', data, success),
  updateCircle: (data: any, success: any) => put(PREFIX + '/circle/auth-api/circle', data, success),
  getCircleCategoryList: (params: any, success: any) => get(PREFIX + '/circle/public-api/category/list', params, success),
  getCircle: (params: any, success: any) => get(PREFIX + '/circle/public-api/circle', params, success),
  countMemberCircle: (success: any) => get(PREFIX + '/circle/public-api/circle/member/count', {}, success),
  joinCircle: (data: any, success: any) => post(PREFIX + '/circle/auth-api/member', data, success),
  exitCircle: (data: any, success: any) => del(PREFIX + '/circle/auth-api/member', data, success),
  getCircleMemberNum: (id: any, success: any) => get(PREFIX + '/circle/public-api/member/count', { circleId: id }, success),
  getCircleMember: (id: any, success: any) => get(PREFIX + '/circle/public-api/member', { circleId: id }, success),
  getMemberCircleList: (params: any, success: any) => get(PREFIX + '/circle/auth-api/member/circle/list', params, success),
  getMemberJoinCircleList: (params: any, success: any) => get(PREFIX + '/circle/auth-api/member/join/circle/list', params, success),
  removeCircle: (data: any, success: any) => del(PREFIX + '/circle/auth-api/circle', data, success),
  getListByIds: (params: any, success: any) => get(PREFIX + '/circle/public-api/circle/list/by-ids', params, success),
  // dynamic.js
  getDynamicList: (params: any, success: any) => get(PREFIX + '/circle/public-api/dynamic/list', params, success),
  createDynamic: (data: any, success: any) => post(PREFIX + '/circle/auth-api/dynamic', data, success),
  deleteDynamic: (data: any, success: any) => del(PREFIX + '/circle/auth-api/dynamic', data, success),
  getCircleDynamicNum: (id: any, success: any) => get(PREFIX + '/circle/public-api/dynamic/count', { circleId: id }, success),
  getDynamicListByIds: (params: any, success: any) => get(PREFIX + '/circle/public-api/dynamic/list/by-ids', params, success),
  // category.js
  findCategoryList: (id: any, fetchAll: any, success: any) => get(PREFIX + '/circle/public-api/category/list', { id: id, fetchAll: fetchAll }, success),
}

// ==================== resource 资源 ====================
export const resourceApi = {
  // index.js
  getResource: (id: any, success: any) => get(PREFIX + '/resource/public-api/resource', { id: id }, success),
  getResourceList: (params: any, success: any) => get(PREFIX + '/resource/auth-api/resource/list', params, success),
  getResourceRecommendList: (params: any, success: any) => get(PREFIX + '/resource/public-api/resource/recommend-list', params, success),
  saveResource: (data: any, success: any) => post(PREFIX + '/resource/auth-api/resource', data, success),
  updateResource: (data: any, success: any) => put(PREFIX + '/resource/auth-api/resource', data, success),
  deleteResource: (data: any, success: any) => del(PREFIX + '/resource/auth-api/resource', data, success),
  download: (params: any, success: any) => get(PREFIX + '/resource/auth-api/resource/download', params, success),
  getResourceType: (params: any, success: any) => get(PREFIX + '/resource/public-api/resource/type/list', params, success),
  getMemberResourceList: (params: any, success: any) => get(PREFIX + '/resource/auth-api/member/resource/list', params, success),
  getMemberDownloadResourceList: (params: any, success: any) => get(PREFIX + '/resource/auth-api/member/download/resource/list', params, success),
  getListByIds: (params: any, success: any) => get(PREFIX + '/resource/public-api/resource/list/by-ids', params, success),
  getResourceLastSearchRecord: (success: any) => get(PREFIX + '/resource/auth-api/member/last-search-record', {}, success),
  getResourceProductList: (param: any, success: any) => get(PREFIX + '/resource/public-api/resource/product/list', param, success),
  getResourceTagList: (param: any, success: any) => get(PREFIX + '/resource/public-api/resource/tag/list', param, success),
  // category.js
  findCategoryList: (id: any, fetchAll: any, success: any) => get(PREFIX + '/resource/public-api/category/list', { id: id, fetchAll: fetchAll }, success),
  toTree: toTree,
}

// ==================== content 文章/资讯 ====================
export const contentApi = {
  // article.js
  findArticleList: (params: any, success: any) => get(PREFIX + '/content/public-api/article/list', params, success),
  getArticle: (id: any, success: any) => get(PREFIX + '/content/public-api/article', { id: id }, success),
  findArticleTopList: (params: any, success: any) => get(PREFIX + '/content/public-api/article/top/list', params, success),
  findArticleRecommendList: (params: any, success: any) => get(PREFIX + '/content/public-api/article/recommend/list', params, success),
  countMemberArticle: (success: any) => get(PREFIX + '/content/public-api/article/member/count', {}, success),
  saveArticle: (data: any, success: any) => post(PREFIX + '/content/auth-api/article', data, success),
  updateArticle: (data: any, success: any) => put(PREFIX + '/content/auth-api/article', data, success),
  removeArticle: (data: any, success: any) => del(PREFIX + '/content/auth-api/article', data, success),
  getMemberArticleList: (params: any, success: any) => get(PREFIX + '/content/auth-api/member/article/list', params, success),
  getArticleListByIds: (params: any, success: any) => get(PREFIX + '/content/public-api/article/list/by-ids', params, success),
  // news.js
  findNewsList: (params: any, success: any) => get(PREFIX + '/content/public-api/news/list', params, success),
  getNews: (id: any, success: any) => get(PREFIX + '/content/public-api/news', { id: id }, success),
  findNewsTopList: (params: any, success: any) => get(PREFIX + '/content/public-api/news/top/list', params, success),
  findNewsRecommendList: (params: any, success: any) => get(PREFIX + '/content/public-api/news/recommend/list', params, success),
  getNewsListByIds: (params: any, success: any) => get(PREFIX + '/content/public-api/news/list/by-ids', params, success),
  // category.js
  findCategoryList: (id: any, fetchAll: any, success: any) => get(PREFIX + '/content/public-api/category/list', { id: id, fetchAll: fetchAll }, success),
}

// ==================== member 会员 ====================
export const memberApi = {
  // index.js
  registerMember: (data: any, callback: any) => post(PREFIX + '/member/public-api/register', data, callback),
  registerMemberByMobile: (data: any, callback: any) => post(PREFIX + '/member/public-api/register/mobile', data, callback),
  updateAvatar: (data: any, success: any) => put(PREFIX + '/member/auth-api/update/avatar', data, success),
  updateName: (data: any, success: any) => put(PREFIX + '/member/auth-api/update/name', data, success),
  updateMobile: (data: any, success: any) => put(PREFIX + '/member/auth-api/update/mobile', data, success),
  updateEmail: (data: any, success: any) => put(PREFIX + '/member/auth-api/update/email', data, success),
  updatePassword: (data: any, success: any) => put(PREFIX + '/member/auth-api/update/password', data, success),
  getMemberInfo: (params: any, success: any) => get(PREFIX + '/member/auth-api/by-mobile', params, success),
  getMemberByMobile: (mobile: any, callback: any) => get(PREFIX + '/member/auth-api/by-mobile', { mobile: mobile }, callback),
  getMemberById: (id: any, callback: any) => get(PREFIX + '/member/auth-api/by-id', { id: id }, callback),
  getAuthMemberList: (params: any, callback: any) => get(PREFIX + '/member/auth-api/list', params, callback),
  checkIn: (success: any) => post(PREFIX + '/member/auth-api/check-in', {}, success),
  getCheckIn: (success: any) => get(PREFIX + '/member/public-api/check-in', {}, success),
  isFollowMember: (followMemberId: any, success: any) => get(PREFIX + '/member/auth-api/follow', { followMemberId: followMemberId }, success),
  followMember: (followMemberId: any, success: any) => post(PREFIX + '/member/auth-api/follow', { followMemberId: followMemberId }, success),
  unfollowMember: (followMemberId: any, success: any) => del(PREFIX + '/member/auth-api/follow', { followMemberId: followMemberId }, success),
  followMemberCount: (followMemberId: any, success: any) => get(PREFIX + '/member/public-api/follow/member/count', { followMemberId: followMemberId }, success),
  getFollowMemberList: (param: any, success: any) => get(PREFIX + '/member/auth-api/follow/list', param, success),
  getFollowFansMemberList: (param: any, success: any) => get(PREFIX + '/member/auth-api/follow/fans/list', param, success),
  getListByIds: (params: any, success: any) => get(PREFIX + '/member/public-api/by-ids', params, success),
  getPwdAuthCode: (username: any, callback: any) => post(PREFIX + '/member/public-api/pwd/send/auth-code', { username: username }, callback),
  checkPwdAuthCode: (data: any, callback: any) => post(PREFIX + '/member/public-api/pwd/check/auth-code', data, callback),
  resetPwd: (data: any, callback: any) => put(PREFIX + '/member/public-api/pwd/reset', data, callback),
}

// ==================== point 积分 ====================
export const pointApi = {
  countMemberPoint: (success: any) => get(PREFIX + '/point/public-api/member/point', {}, success),
  getRecordList: (params: any, success: any) => get(PREFIX + '/point/auth-api/record/list', params, success),
}

// ==================== message 消息（含私信/公告/评论） ====================
export const messageApi = {
  // message/index.js
  getMemberList: (param: any, success: any) => get(PREFIX + '/message/auth-api/private-letter/member/list', param, success),
  getLetterMember: (param: any, success: any) => get(PREFIX + '/message/auth-api/private-letter/member', param, success),
  getLetterList: (param: any, success: any) => get(PREFIX + '/message/auth-api/private-letter/list', param, success),
  getNewLetterList: (param: any, success: any) => get(PREFIX + '/message/auth-api/private-letter/new/list', param, success),
  sendPrivateLetter: (data: any, success: any) => post(PREFIX + '/message/auth-api/private-letter', data, success),
  getNoticeList: (param: any, success: any) => get(PREFIX + '/message/auth-api/notice/list', param, success),
  // announcement/index.js
  getAnnouncementList: (params: any, success: any) => get(PREFIX + '/message/public-api/announcement/list', params, success),
  getAnnouncement: (params: any, success: any) => get(PREFIX + '/message/public-api/announcement', params, success),
}

// ==================== comment 评论/点赞/收藏 ====================
export const commentApi = {
  // favorite.js
  saveFavorite: (data: any, success: any) => post(PREFIX + '/comment/auth-api/favorite', data, success),
  deleteFavorite: (data: any, success: any) => del(PREFIX + '/comment/auth-api/favorite', data, success),
  getMemberFavoriteList: (param: any, success: any) => get(PREFIX + '/comment/auth-api/favorite/list', param, success),
  getFavoriteCountList: (param: any, success: any) => get(PREFIX + '/comment/public-api/favorite/count', param, success),
  getFavoriteTypeList: (success: any) => get(PREFIX + '/comment/public-api/favorite/type/list', {}, success),
  getMemberFavoritePageList: (params: any, success: any) => get(PREFIX + '/comment/auth-api/favorite/member/list', params, success),
  // index.js
  saveComment: (data: any, success: any) => post(PREFIX + '/comment/auth-api/comment', data, success),
  deleteComment: (data: any, success: any) => del(PREFIX + '/comment/auth-api/comment', data, success),
  getCommentList: (params: any, success: any) => get(PREFIX + '/comment/public-api/comment/list', params, success),
  getMemberCommentList: (params: any, success: any) => get(PREFIX + '/comment/auth-api/current-member/comment/list', params, success),
  saveReplyComment: (data: any, success: any) => post(PREFIX + '/comment/auth-api/reply/comment', data, success),
  deleteReplyComment: (data: any, success: any) => del(PREFIX + '/comment/auth-api/reply/comment', data, success),
  getTypeList: (success: any) => get(PREFIX + '/comment/public-api/comment/type/list', {}, success),
  // like.js
  saveLike: (data: any, success: any) => post(PREFIX + '/comment/auth-api/like', data, success),
  updateLike: (data: any, success: any) => put(PREFIX + '/comment/auth-api/like', data, success),
  getMemberLikeList: (param: any, success: any) => get(PREFIX + '/comment/auth-api/like/list', param, success),
  getLikeCountList: (param: any, success: any) => get(PREFIX + '/comment/public-api/like/count', param, success),
}

// ==================== order 订单 ====================
export const orderApi = {
  createOrder: (data: any, success: any) => post(PREFIX + '/order/order', data, success),
}

// ==================== search 搜索 ====================
export const searchApi = {
  getSearchTypeList: (success: any) => get(PREFIX + '/search/public-api/content/type', {}, success),
  getHotWordList: (params: any, success: any) => get(PREFIX + '/search/public-api/hot-word/list', params, success),
  getSearchContentList: (params: any, success: any) => get(PREFIX + '/search/public-api/content', params, success),
}

// ==================== oss 文件 ====================
export const ossApi = {
  deleteFile: (path: any, successCallback: any) => del(PREFIX + '/oss/file', { path: path }, successCallback),
  toBase64: (url: any, successCallback: any) => get(PREFIX + '/oss/to-base64', { url: url }, successCallback),
}

// ==================== setting 设置 ====================
export const settingApi = {
  getAgreement: (params: any, successCallback: any) => get(PREFIX + '/setting/public-api/agreement', params, successCallback),
  getCarousel: (params: any, successCallback: any) => get(PREFIX + '/setting/public-api/carousel', params, successCallback),
}

// ==================== certificate 证书 ====================
export const certificateApi = {
  findCertificateList: (params: any, success: any) => get(PREFIX + '/learn/certificate/list', params, success),
  getCertificate: (id: any, success: any) => get(PREFIX + '/learn/certificate', { id: id }, success),
}

// ==================== visit-tracking 访问统计 ====================
export const visitTrackingApi = {
  saveVisitTracking: (data: any, success: any) => post(PREFIX + '/visit-tracking/public-api/visit-log', data, success),
}

// ==================== index 首页聚合（getCategory 聚合分类树） ====================
export const indexApi = {
  getRecommendLesson: (params: any, success: any) => get(PREFIX + '/learn/public-api/lesson/recommend/list', params, success),
  getHotLesson: (params: any, success: any) => get(PREFIX + '/learn/public-api/lesson/hottest/list', params, success),
  // 聚合各模块分类树（带 10 分钟 localStorage 缓存）
  getCategory: async (success: any) => {
    const expire = 600000
    const mods: Array<[string, string, string]> = [
      ['learn', 'learn', '课程'],
      ['live', 'live', '直播'],
      ['article', 'content', '文章'],
      ['ask', 'ask', '问答'],
      ['circle', 'circle', '社区'],
      ['resource', 'resource', '知识'],
      ['exam', 'exam', '考试'],
      ['news', 'content', '资讯'],
    ]
    for (let i = 0; i < mods.length; i++) {
      const [key, type, label] = mods[i]
      const cached = storageUtils.getJsonExpire(key)
      if (cached) {
        success && success({ value: i, type: type, label: label, children: cached })
        continue
      }
      try {
        let apiMod: any
        if (type === 'learn') apiMod = learnApi
        else if (type === 'live') apiMod = liveApi
        else if (type === 'content') apiMod = contentApi
        else if (type === 'ask') apiMod = askApi
        else if (type === 'circle') apiMod = circleApi
        else if (type === 'resource') apiMod = resourceApi
        else if (type === 'exam') apiMod = examApi
        else apiMod = contentApi
        await apiMod.findCategoryList(0, true, (res: any) => {
          const tree = toTree(res)
          storageUtils.setJsonExpire(key, tree, expire)
          success && success({ value: i, type: type, label: label, children: tree })
        })
      } catch {
        // 单个模块失败不影响其它
      }
    }
  },
}

// ==================== topic 聚合（getTopicList 按 topicType 分发） ====================
export const topicApi = {
  getTopicList: (topicType: string, topicIdList: any, success: any) => {
    const params = { idList: topicIdList }
    switch (topicType) {
      case 'lesson':
        return learnApi.getLessonListByIds(params, success)
      case 'news':
        return contentApi.getNewsListByIds(params, success)
      case 'article':
        return contentApi.getArticleListByIds(params, success)
      case 'question':
        return askApi.getQuestionListByIds(params, success)
      case 'answer':
        return askApi.getAnswerListByIds(params, success)
      case 'dynamic':
        return circleApi.getDynamicListByIds(params, success)
      case 'channel':
        return liveApi.getChannelListByIds(params, success)
      case 'resource':
        return resourceApi.getListByIds(params, success)
      case 'circle':
        return circleApi.getListByIds(params, success)
      case 'learn_topic':
      case 'learn_map':
        success && success([])
        return
      case 'member':
        return memberApi.getListByIds({ ids: topicIdList }, success)
    }
  },
}

export default {
  learnApi,
  examApi,
  liveApi,
  askApi,
  circleApi,
  resourceApi,
  contentApi,
  memberApi,
  pointApi,
  messageApi,
  commentApi,
  orderApi,
  searchApi,
  ossApi,
  settingApi,
  certificateApi,
  visitTrackingApi,
  indexApi,
  topicApi,
  get,
  post,
  put,
  del,
  uploadFile,
}
