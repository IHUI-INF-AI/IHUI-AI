// @ts-nocheck
/**
 * 教育平台管理端 API 适配层（自动生成）
 * - 由旧项目 src/api/*.js 解析生成
 * - 旧路径自动加 /api/v1/edu 前缀（PREFIX + path）
 * - 保留旧回调签名 (params, success) / (data, success) / (success) / (params, success, notShowError)
 * - 用法: import { memberApi } from '@/api/edu/admin-api'; const { getMemberList } = memberApi
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
// 注意: url 参数应已包含 PREFIX 前缀（调用方传入 PREFIX + path）
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
  const resData = data
  const tree = []
  for (let i = 0; i < resData.length; i++) {
    if (resData[i].pid === 0) {
      const obj = {
        value: resData[i].id,
        label: resData[i].name
      }
      tree.push(obj)
      resData.splice(i, 1)
      i--
    }
  }
  function run(chiArr) {
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
  tree.unshift({
    value: 0,
    label: "全部"
  })
  return tree
}

function getAllParent(categoryList: any, cidList: any) {
  const fullPidArray = []
  function getFullParentCid(categoryList, id) {
    if (!categoryList || categoryList.length <= 0 || id === 0) {
      return [id]
    }
    const getRootCategory = function(categoryList, id) {
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

function loginOut() {
  // 2026-07-06 修复: 原 localStorage.clear() 会连同清除登录账号历史(login_history_*)
  // 和记住我凭据(remember_me_*)等用户偏好, 导致用户重新登录时无法一键填入历史账号.
  // 改为保留登录历史和用户偏好, 只清除认证与缓存数据.
  const PRESERVE_KEYS = ['darkMode', 'locale']
  const PRESERVE_PREFIXES = ['login_history_', 'remember_me']
  const preserved: Record<string, string> = {}
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key) continue
      if (PRESERVE_KEYS.includes(key) || PRESERVE_PREFIXES.some(p => key.startsWith(p))) {
        preserved[key] = localStorage.getItem(key) || ''
      }
    }
  } catch {
    // 降级: 忽略备份错误
  }
  localStorage.clear()
  try {
    for (const [key, value] of Object.entries(preserved)) {
      localStorage.setItem(key, value)
    }
  } catch {
    // 降级: 忽略恢复错误
  }
  // 删除token
  localStorage.removeItem('edu_admin_token')
  localStorage.removeItem('token')
}

function organizationalApi_getAllParent(categoryList: any, cidList: any) {
  const fullPidArray = []
  function getFullParentCid(categoryList, id) {
    if (!categoryList || categoryList.length <= 0 || id === 0) {
      return [id]
    }
    const getRootDepartment = function(categoryList, id) {
      for (const category of categoryList) {
        if (category.children && category.children.length > 0) {
          const c = getRootDepartment(category.children, id)
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
    return getRootDepartment(categoryList, id)
  }
  for (const id of cidList) {
    fullPidArray.push(getFullParentCid(categoryList, id))
  }
  return fullPidArray
}

function resourceApi_toTree(data: any) {
  const resData = data
  const tree = []
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
  function run(chiArr) {
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
  tree.unshift({
    value: 0,
    label: "全部"
  })
  return tree
}

function gotoTopic(item: any) {
  if (item.type === "comment" || item.type === "reply_comment") {
    //return
  } else {
    const buildUrl = (path: string, id: any) => `/admin/edu${path}?id=${id}`
    switch (item.topicType) {
    case "lesson":
      window.location.href = buildUrl("/learn/detail", item.topicId)
      break;
    case "news":
      window.location.href = buildUrl("/news/detail", item.topicId)
      break;
    case "channel":
      window.location.href = buildUrl("/live/detail", item.topicId)
      break;
    case "article":
      window.location.href = buildUrl("/article/detail", item.topicId)
      break;
    case "resource":
      window.location.href = buildUrl("/resource/detail", item.topicId)
      break;
    case "question":
      window.location.href = buildUrl("/ask/question", item.topicId)
      break;
    case "answer":
      window.location.href = buildUrl("/ask/question", item.question ? item.question.id : item.topic.parentTopic.id)
      break;
    case "dynamic":
      window.location.href = buildUrl("/circle/detail", item.topicId)
      break;
    }
  }
}


export const askApi = {
  findList: (params: any, success: any) => get(PREFIX + "/ask/answer/list", params, success),
  getQuestion: (id: any, success: any) => get(PREFIX + "/ask/public-api/question", {id: id}, success),
  updateQuestion: (data: any, success: any) => put(PREFIX + "/ask/question", data, success),
  saveQuestion: (data: any, success: any) => post(PREFIX + "/ask/question", data, success),
  deleteQuestion: (id: any, success: any) => del(PREFIX + "/ask/question", {id: id}, success),
  findCategoryList: (id: any, fetchAll: any, success: any) => get(PREFIX + "/ask/category/admin/list", { id: id, fetchAll: fetchAll }, success),
  getCategory: (id: any, success: any) => get(PREFIX + "/ask/category/" + id, {}, success),
  saveCategory: (data: any, success: any) => post(PREFIX + "/ask/category", data, success),
  updateCategory: (data: any, success: any) => put(PREFIX + "/ask/category", data, success),
  removeCategory: (id: any, success: any) => del(PREFIX + "/ask/category/" + id, {}, success),
  toTree: toTree,
  getAllParent: getAllParent,
  getQuestionListByIds: (params: any, success: any) => get(PREFIX + "/ask/public-api/question/list/by-ids", params, success),
  getAnswerListByIds: (params: any, success: any) => get(PREFIX + "/ask/public-api/answer/list/by-ids", params, success),
  // 管理端问答题目
  findQuestionList: (params: any, success: any) => get(PREFIX + "/ask/question/list", params, success),
  getQuestionDetail: (id: any, success: any) => get(PREFIX + "/ask/question", {id: id}, success),
}

export const authApi = {
  getAuthorityList: (params: any, callback: any) => get(PREFIX + "/auth/authorities", params, callback),
  getAuthorityTree: (callback: any) => get(PREFIX + "/auth/authorities/tree", {}, callback),
}

export const certificateApi = {
  findCertificateList: (params: any, success: any) => get(PREFIX + "/learn/certificate/list", params, success),
  getCertificate: (id: any, success: any) => get(PREFIX + "/learn/certificate", {id: id}, success),
  validCertificate: (data: any, success: any) => put(PREFIX + "/learn/certificate/valid", data, success),
  suspendedCertificate: (data: any, success: any) => put(PREFIX + "/learn/certificate/suspended", data, success),
  cancelledCertificate: (data: any, success: any) => put(PREFIX + "/learn/certificate/cancelled", data, success),
  expiredCertificate: (data: any, success: any) => put(PREFIX + "/learn/certificate/expired", data, success),
  revokedCertificate: (data: any, success: any) => put(PREFIX + "/learn/certificate/revoked", data, success),
  deleteCertificate: (id: any, success: any) => del(PREFIX + "/learn/certificate", {id: id}, success),
  findCertificateTemplateList: (params: any, success: any) => get(PREFIX + "/learn/certificate-template/list", params, success),
  getCertificateTemplate: (id: any, success: any) => get(PREFIX + "/learn/certificate-template", {id: id}, success),
  updateCertificateTemplate: (data: any, success: any) => put(PREFIX + "/learn/certificate-template", data, success),
  saveCertificateTemplate: (data: any, success: any) => post(PREFIX + "/learn/certificate-template", data, success),
  deleteCertificateTemplate: (id: any, success: any) => del(PREFIX + "/learn/certificate-template", {id: id}, success),
  activeCertificateTemplate: (data: any, success: any) => put(PREFIX + "/learn/certificate-template/active", data, success),
  inactiveCertificateTemplate: (data: any, success: any) => put(PREFIX + "/learn/certificate-template/inactive", data, success),
}

export const circleApi = {
  findCategoryList: (id: any, fetchAll: any, success: any) => get(PREFIX + "/circle/category/admin/list", { id: id, fetchAll: fetchAll }, success),
  getCategory: (id: any, success: any) => get(PREFIX + "/circle/category/" + id, {}, success),
  saveCategory: (data: any, success: any) => post(PREFIX + "/circle/category", data, success),
  updateCategory: (data: any, success: any) => put(PREFIX + "/circle/category", data, success),
  removeCategory: (id: any, success: any) => del(PREFIX + "/circle/category/" + id, {}, success),
  toTree: toTree,
  getAllParent: getAllParent,
  findList: (params: any, success: any) => get(PREFIX + "/circle/dynamic/list", params, success),
  getDynamic: (id: any, success: any) => get(PREFIX + "/circle/public-api/dynamic", {id: id}, success),
  updateDynamic: (data: any, success: any) => put(PREFIX + "/circle/dynamic", data, success),
  saveDynamic: (data: any, success: any) => post(PREFIX + "/circle/dynamic", data, success),
  deleteDynamic: (id: any, success: any) => del(PREFIX + "/circle/dynamic", {id: id}, success),
  getListByIds: (params: any, success: any) => get(PREFIX + "/circle/public-api/dynamic/list/by-ids", params, success),
  getCircle: (id: any, success: any) => get(PREFIX + "/circle/public-api/circle", {id: id}, success),
  updateCircle: (data: any, success: any) => put(PREFIX + "/circle/circle", data, success),
  saveCircle: (data: any, success: any) => post(PREFIX + "/circle/circle", data, success),
  deleteCircle: (id: any, success: any) => del(PREFIX + "/circle/auth-api/circle", {id: id}, success),
  // 管理端圈子
  findCircleList: (params: any, success: any) => get(PREFIX + "/circle/list", params, success),
  deleteCircleAdmin: (id: any, success: any) => del(PREFIX + "/circle", {id: id}, success),
  updateCircleShow: (data: any, success: any) => put(PREFIX + "/circle/is-show", data, success),
}

export const commentApi = {
  saveFavorite: (data: any, success: any) => post(PREFIX + "/comment/auth-api/favorite", data, success),
  deleteFavorite: (data: any, success: any) => del(PREFIX + "/comment/auth-api/favorite", data, success),
  getMemberFavoriteList: (param: any, success: any) => get(PREFIX + "/comment/auth-api/favorite/list", param, success),
  getFavoriteCountList: (param: any, success: any) => get(PREFIX + "/comment/public-api/favorite/count", param, success),
  saveComment: (data: any, success: any) => post(PREFIX + "/comment/auth-api/comment", data, success),
  deleteComment: (data: any, success: any) => del(PREFIX + "/comment/auth-api/comment", data, success),
  getCommentList: (params: any, success: any) => get(PREFIX + "/comment/public-api/comment/list", params, success),
  getCurrentMemberCommentList: (params: any, success: any) => get(PREFIX + "/comment/auth-api/current-member/comment/list", params, success),
  saveReplyComment: (data: any, success: any) => post(PREFIX + "/comment/auth-api/reply/comment", data, success),
  deleteReplyComment: (data: any, success: any) => del(PREFIX + "/comment/auth-api/reply/comment", data, success),
  saveLike: (data: any, success: any) => post(PREFIX + "/comment/auth-api/like", data, success),
  updateLike: (data: any, success: any) => put(PREFIX + "/comment/auth-api/like", data, success),
  getMemberLikeList: (param: any, success: any) => get(PREFIX + "/comment/auth-api/like/list", param, success),
  getLikeCountList: (param: any, success: any) => get(PREFIX + "/comment/public-api/like/count", param, success),
  saveSensitiveWord: (data: any, success: any) => post(PREFIX + "/comment/sensitive-word", data, success),
  updateSensitiveWord: (data: any, success: any) => put(PREFIX + "/comment/sensitive-word", data, success),
  removeSensitiveWord: (data: any, success: any) => del(PREFIX + "/comment/sensitive-word", data, success),
  getSensitiveWordList: (param: any, success: any) => get(PREFIX + "/comment/sensitive-word/list", param, success),
  // 管理端评论
  findCommentList: (params: any, success: any) => get(PREFIX + "/comment/list", params, success),
  deleteCommentAdmin: (id: any, success: any) => del(PREFIX + "/comment", {id: id}, success),
}

export const contentApi = {
  findList: (params: any, success: any) => get(PREFIX + "/content/article/list", params, success),
  getArticle: (id: any, success: any) => get(PREFIX + "/content/public-api/article", {id: id}, success),
  updateArticle: (data: any, success: any) => put(PREFIX + "/content/article", data, success),
  saveArticle: (data: any, success: any) => post(PREFIX + "/content/article", data, success),
  deleteArticle: (id: any, success: any) => del(PREFIX + "/content/auth-api/article", {id: id}, success),
  saveArticleTop: (id: any, success: any) => post(PREFIX + "/content/article/top", {id: id}, success),
  deleteArticleTop: (id: any, success: any) => del(PREFIX + "/content/article/top", {id: id}, success),
  saveArticleRecommend: (id: any, success: any) => post(PREFIX + "/content/article/recommend", {id: id}, success),
  deleteArticleRecommend: (id: any, success: any) => del(PREFIX + "/content/article/recommend", {id: id}, success),
  getListByIds: (params: any, success: any) => get(PREFIX + "/content/public-api/article/list/by-ids", params, success),
  findCategoryList: (id: any, fetchAll: any, success: any) => get(PREFIX + "/content/category/admin/list", { id: id, fetchAll: fetchAll }, success),
  getCategory: (id: any, success: any) => get(PREFIX + "/content/category/" + id, {}, success),
  saveCategory: (data: any, success: any) => post(PREFIX + "/content/category", data, success),
  updateCategory: (data: any, success: any) => put(PREFIX + "/content/category", data, success),
  removeCategory: (id: any, success: any) => del(PREFIX + "/content/category/" + id, {}, success),
  toTree: toTree,
  getAllParent: getAllParent,
  getNews: (id: any, success: any) => get(PREFIX + "/content/public-api/news", {id: id}, success),
  updateNews: (data: any, success: any) => put(PREFIX + "/content/news", data, success),
  saveNews: (data: any, success: any) => post(PREFIX + "/content/news", data, success),
  deleteNews: (id: any, success: any) => del(PREFIX + "/content/news", {id: id}, success),
  saveNewsTop: (id: any, success: any) => post(PREFIX + "/content/news/top", {id: id}, success),
  deleteNewsTop: (id: any, success: any) => del(PREFIX + "/content/news/top", {id: id}, success),
  saveNewsRecommend: (id: any, success: any) => post(PREFIX + "/content/news/recommend", {id: id}, success),
  deleteNewsRecommend: (id: any, success: any) => del(PREFIX + "/content/news/recommend", {id: id}, success),
}

export const examApi = {
  findCategoryList: (id: any, fetchAll: any, success: any) => get(PREFIX + "/exam/category/admin/list", { id: id, fetchAll: fetchAll }, success),
  getCategory: (id: any, success: any) => get(PREFIX + "/exam/category/" + id, {}, success),
  saveCategory: (data: any, success: any) => post(PREFIX + "/exam/category", data, success),
  updateCategory: (data: any, success: any) => put(PREFIX + "/exam/category", data, success),
  removeCategory: (id: any, success: any) => del(PREFIX + "/exam/category/" + id, {}, success),
  toTree: toTree,
  getAllParent: getAllParent,
  findList: (params: any, success: any) => get(PREFIX + "/exam/exam/list", params, success),
  saveBaseInfo: (params: any, success: any) => post(PREFIX + "/exam/exam", params, success),
  updateBaseInfo: (params: any, success: any) => put(PREFIX + "/exam/exam", params, success),
  getBaseInfo: (id: any, success: any) => get(PREFIX + "/exam/exam", {id: id}, success),
  deleteExam: (params: any, success: any) => del(PREFIX + "/exam/exam", params, success),
  publishExam: (params: any, success: any) => put(PREFIX + "/exam/exam/publish", params, success),
  unPublishExam: (params: any, success: any) => put(PREFIX + "/exam/exam/un-publish", params, success),
  saveExamChapter: (params: any, success: any) => post(PREFIX + "/exam/exam/chapter", params, success),
  updateExamChapter: (params: any, success: any) => put(PREFIX + "/exam/exam/chapter", params, success),
  deleteExamChapter: (params: any, success: any) => del(PREFIX + "/exam/exam/chapter", params, success),
  getAllExamList: (params: any, success: any) => get(PREFIX + "/exam/public-api/exam/list", params, success),
  getExamChapterList: (params: any, success: any) => get(PREFIX + "/exam/exam/chapter/list", params, success),
  saveExamChapterSection: (params: any, success: any) => post(PREFIX + "/exam/exam/chapter-section", params, success),
  updateExamChapterSection: (params: any, success: any) => put(PREFIX + "/exam/exam/chapter-section", params, success),
  deleteExamChapterSection: (params: any, success: any) => del(PREFIX + "/exam/exam/chapter-section", params, success),
  updateSortOrder: (data: any, success: any) => put(PREFIX + "/exam/exam/chapter/sort-order", data, success),
  delPaper: (id: any, success: any) => del(PREFIX + "/exam/paper", { id: id }, success),
  publishPaper: (params: any, success: any) => put(PREFIX + "/exam/paper/publish", params, success),
  unPublishPaper: (params: any, success: any) => put(PREFIX + "/exam/paper/un-publish", params, success),
  savePaperRule: (params: any, success: any) => post(PREFIX + "/exam/paper/rule", params, success),
  updatePaperRule: (params: any, success: any) => put(PREFIX + "/exam/paper/rule", params, success),
  getPaperRule: (paperId: any, success: any) => get(PREFIX + "/exam/paper/rule/by-paper-id", { paperId: paperId }, success),
  savePaperQuestion: (params: any, success: any) => post(PREFIX + "/exam/paper/question", params, success),
  getPaperQuestionList: (params: any, success: any) => get(PREFIX + "/exam/paper/question/by-paper-id", params, success),
  getMarkRecordList: (params: any, success: any) => get(PREFIX + "/exam/record/mark/paper/list", params, success),
  manualMarkRecord: (params: any, success: any) => put(PREFIX + "/exam/record/manual/mark/paper", params, success),
  getRecordList: (params: any, success: any) => get(PREFIX + "/exam/record/list", params, success),
  getPaper: (id: any, success: any) => get(PREFIX + "/exam/paper", {id: id}, success),
  getRecord: (params: any, success: any) => get(PREFIX + "/exam/auth-api/record", params, success),
  getSignUpList: (params: any, success: any) => get(PREFIX + "/exam/sign-up/list", params, success),
  delQuestion: (id: any, success: any) => del(PREFIX + "/exam/question-lib/question", { id: id }, success),
}

export const indexApi = {
  getVisitSummary: (params: any, success: any, notShowError: any) => get(PREFIX + "/visit-tracking/visit-log/summary", params, success, notShowError),
  getDayPvList: (params: any, success: any, notShowError: any) => get(PREFIX + "/visit-tracking/visit-log/day/pv/list", params, success, notShowError),
  getDayUvList: (params: any, success: any, notShowError: any) => get(PREFIX + "/visit-tracking/visit-log/day/uv/list", params, success, notShowError),
  getIpCitySummaryList: (params: any, success: any, notShowError: any) => get(PREFIX + "/visit-tracking/visit-log/ip-city/summary/list", params, success, notShowError),
  // 访问统计概览与明细
  getStatistics: (params: any, success: any, notShowError?: any) => get(PREFIX + "/visit-tracking/statistics", params, success, notShowError),
  getVisitList: (params: any, success: any, notShowError?: any) => get(PREFIX + "/visit-tracking/list", params, success, notShowError),
}

export const learnApi = {
  findCategoryList: (id: any, fetchAll: any, success: any) => get(PREFIX + "/learn/category/admin/list", { id: id, fetchAll: fetchAll }, success),
  getCategory: (id: any, success: any) => get(PREFIX + "/learn/category/" + id, {}, success),
  saveCategory: (data: any, success: any) => post(PREFIX + "/learn/category", data, success),
  updateCategory: (data: any, success: any) => put(PREFIX + "/learn/category", data, success),
  removeCategory: (id: any, success: any) => del(PREFIX + "/learn/category/" + id, {}, success),
  toTree: toTree,
  getAllParent: getAllParent,
  findList: (params: any, success: any) => get(PREFIX + "/learn/learn-map/list", params, success),
  saveBaseInfo: (params: any, success: any) => post(PREFIX + "/learn/learn-map", params, success),
  updateBaseInfo: (params: any, success: any) => put(PREFIX + "/learn/learn-map", params, success),
  getBaseInfo: (id: any, success: any) => get(PREFIX + "/learn/learn-map", { id: id }, success),
  removeMap: (data: any, success: any) => del(PREFIX + "/learn/learn-map", data, success),
  publishLearnMap: (params: any, success: any) => put(PREFIX + "/learn/learn-map/publish", params, success),
  unPublishLearnMap: (params: any, success: any) => put(PREFIX + "/learn/learn-map/un-publish", params, success),
  updateLearnExamPaper: (params: any, success: any) => put(PREFIX + "/learn/lesson/exampaper", params, success),
  updateLearnCertificate: (params: any, success: any) => put(PREFIX + "/learn/lesson/certificate", params, success),
  removeLesson: (data: any, success: any) => del(PREFIX + "/learn/lesson", data, success),
  publishLesson: (params: any, success: any) => put(PREFIX + "/learn/lesson/publish", params, success),
  unPublishLesson: (params: any, success: any) => put(PREFIX + "/learn/lesson/un-publish", params, success),
  saveLessonChapter: (params: any, success: any) => post(PREFIX + "/learn/lesson/chapter", params, success),
  updateLessonChapter: (params: any, success: any) => put(PREFIX + "/learn/lesson/chapter", params, success),
  deleteLessonChapter: (params: any, success: any) => del(PREFIX + "/learn/lesson/chapter", params, success),
  getLessonChapterList: (params: any, success: any) => get(PREFIX + "/learn/lesson/chapter/list", params, success),
  updateSortOrder: (data: any, success: any) => put(PREFIX + "/learn/lesson/chapter/sort-order", data, success),
  saveLessonChapterSection: (params: any, success: any) => post(PREFIX + "/learn/lesson/chapter-section", params, success),
  updateLessonChapterSection: (params: any, success: any) => put(PREFIX + "/learn/lesson/chapter-section", params, success),
  deleteLessonChapterSection: (params: any, success: any) => del(PREFIX + "/learn/lesson/chapter-section", params, success),
  getSignUpList: (params: any, success: any) => get(PREFIX + "/learn/sign-up/list", params, success),
  getLessonListByIds: (params: any, success: any) => get(PREFIX + "/learn/public-api/lesson/list/by-ids", params, success),
  saveHomework: (data: any, success: any) => post(PREFIX + "/learn/lesson/homework", data, success),
  updateHomework: (data: any, success: any) => put(PREFIX + "/learn/lesson/homework", data, success),
  getHomework: (params: any, success: any) => get(PREFIX + "/learn/lesson/homework", params, success),
  getLessonSignReport: (params: any, success: any) => get(PREFIX + "/learn/report/lesson/sign", params, success),
  getLessonStudyReport: (params: any, success: any) => get(PREFIX + "/learn/report/lesson/study", params, success),
  getMemberStudyReport: (params: any, success: any) => get(PREFIX + "/learn/report/member/study", params, success),
  getLearnExamPaper: (params: any, success: any) => get(PREFIX + "/exam/auth-api/paper", params, success),
  batchSignUp: (data: any, success: any) => post(PREFIX + "/learn/auth-api/sign-up/batch", data, success),
  getCompanyStudyReport: (params: any, success: any) => get(PREFIX + "/learn/report/company/member/signup", params, success),
  getLearnStatistics: (success: any) => get(PREFIX + "/learn/statistics", {}, success),
  removeTopic: (data: any, success: any) => del(PREFIX + "/learn/topic", data, success),
  publishTopic: (params: any, success: any) => put(PREFIX + "/learn/topic/publish", params, success),
  unPublishTopic: (params: any, success: any) => put(PREFIX + "/learn/topic/un-publish", params, success),
  getInvoiceApplicationList: (params: any, success: any) => get(PREFIX + "/order-api/invoice/application/list", params, success),
  createInvoiceApplication: (data: any, success: any) => post(PREFIX + "/order-api/invoice/application", data, success),
  updateInvoiceApplication: (data: any, success: any) => put(PREFIX + "/order-api/invoice/application", data, success),
  removeInvoiceApplication: (data: any, success: any) => del(PREFIX + "/order-api/invoice/application", data, success),
  approvedInvoiceApplication: (data: any, success: any) => post(PREFIX + "/order-api/invoice/application/approved", data, success),
  rejectedInvoiceApplication: (data: any, success: any) => post(PREFIX + "/order-api/invoice/application/rejected", data, success),
  invoicingInvoiceApplication: (data: any, success: any) => post(PREFIX + "/order-api/invoice/application/invoicing", data, success),
  invoicedInvoiceApplication: (data: any, success: any) => post(PREFIX + "/order-api/invoice/application/invoiced", data, success),
  canceledInvoiceApplication: (data: any, success: any) => post(PREFIX + "/order-api/invoice/application/canceled", data, success),
  getInvoiceTitleList: (params: any, success: any) => get(PREFIX + "/order-api/invoice/title/list", params, success),
  createInvoiceTitle: (data: any, success: any) => post(PREFIX + "/order-api/invoice/title", data, success),
  updateInvoiceTitle: (data: any, success: any) => put(PREFIX + "/order-api/invoice/title", data, success),
  removeInvoiceTitle: (data: any, success: any) => del(PREFIX + "/order-api/invoice/title", data, success),
}

export const lecturerApi = {
  findList: (params: any, success: any) => get(PREFIX + "/live/lecturer/list", params, success),
  getLecturer: (id: any, success: any) => get(PREFIX + "/live/lecturer", {id: id}, success),
  updateLecturer: (data: any, success: any) => put(PREFIX + "/live/lecturer", data, success),
  saveLecturer: (data: any, success: any) => post(PREFIX + "/live/lecturer", data, success),
  deleteLecturer: (id: any, success: any) => del(PREFIX + "/live/lecturer", {id: id}, success),
}

export const liveApi = {
  findCategoryList: (id: any, fetchAll: any, success: any) => get(PREFIX + "/live/category/admin/list", { id: id, fetchAll: fetchAll }, success),
  getCategory: (id: any, success: any) => get(PREFIX + "/live/category/" + id, {}, success),
  saveCategory: (data: any, success: any) => post(PREFIX + "/live/category", data, success),
  updateCategory: (data: any, success: any) => put(PREFIX + "/live/category", data, success),
  removeCategory: (id: any, success: any) => del(PREFIX + "/live/category/" + id, {}, success),
  toTree: toTree,
  getAllParent: getAllParent,
  findList: (params: any, success: any) => get(PREFIX + "/live/channel/list", params, success),
  saveChannel: (params: any, success: any) => post(PREFIX + "/live/channel", params, success),
  updateChannel: (params: any, success: any) => put(PREFIX + "/live/channel", params, success),
  getChannel: (id: any, success: any) => get(PREFIX + "/live/channel/" + id, {}, success),
  removeChannel: (id: any, success: any) => del(PREFIX + "/live/channel", {id: id}, success),
  getChannelListByIds: (params: any, success: any) => get(PREFIX + "/live/public-api/channel/list/by-ids", params, success),
}

export const loginApi = {
  passwordLogin: (data: any, callback: any) => post(PREFIX + "/login/admin", data, callback),
  getMsgAuthCode: (mobile: any, callback: any) => get(PREFIX + "/auth/public-api/auth-code", { mobile: mobile }, callback),
  authCodeLogin: (data: any, callback: any) => post(PREFIX + "/login/admin/auth-code", data, callback),
  getLoginQrCode: (callback: any) => get(PREFIX + "/qr-code", undefined, callback),
  workWeChatLogin: (data: any, callback: any) => post(PREFIX + "/login/work-we-chat", data, callback),
  dingTalkLogin: (data: any, callback: any) => post(PREFIX + "/login/ding-talk", data, callback),
  refreshAccessToken: (data: any, callback: any) => post(PREFIX + "/login/admin/refresh", data, callback),
  loginOut: loginOut,
  getCurrentUser: (callback: any) => get(PREFIX + "/current-user", {}, callback, true),
  getWorkWeChatConfig: (callback: any) => get(PREFIX + "/user-center/public-api/work-we-chat/config", {}, callback),
  getDingTalkConfig: (callback: any) => get(PREFIX + "/user-center/public-api/ding-talk/config", {}, callback),
}

export const memberApi = {
  findList: (params: any, success: any) => get(PREFIX + "/member/company/list", params, success),
  getCompany: (id: any, success: any) => get(PREFIX + "/member/public-api/company", {id: id}, success),
  updateCompany: (data: any, success: any) => put(PREFIX + "/member/company", data, success),
  saveCompany: (data: any, success: any) => post(PREFIX + "/member/company", data, success),
  deleteCompany: (data: any, success: any) => del(PREFIX + "/member/company", data, success),
  enableCompany: (data: any, success: any) => put(PREFIX + "/member/company/enable", data, success),
  disableCompany: (data: any, success: any) => put(PREFIX + "/member/company/disable", data, success),
  findTypeList: (params: any, success: any) => get(PREFIX + "/member/company/type/list", params, success),
  getCompanyType: (id: any, success: any) => get(PREFIX + "/member/company/type", {id: id}, success),
  updateCompanyType: (data: any, success: any) => put(PREFIX + "/member/company/type", data, success),
  saveCompanyType: (data: any, success: any) => post(PREFIX + "/member/company/type", data, success),
  deleteCompanyType: (data: any, success: any) => del(PREFIX + "/member/company/type", data, success),
  enableCompanyType: (data: any, success: any) => put(PREFIX + "/member/company/type/enable", data, success),
  disableCompanyType: (data: any, success: any) => put(PREFIX + "/member/company/type/disable", data, success),
  getGroup: (id: any, success: any) => get(PREFIX + "/member/public-api/group", {id: id}, success),
  updateGroup: (data: any, success: any) => put(PREFIX + "/member/group", data, success),
  saveGroup: (data: any, success: any) => post(PREFIX + "/member/group", data, success),
  deleteGroup: (id: any, success: any) => del(PREFIX + "/member/group", {id: id}, success),
  getMemberList: (param: any, success: any) => get(PREFIX + "/member/list", param, success),
  getMemberUnauditedList: (param: any, success: any) => get(PREFIX + "/member/unaudited/list", param, success),
  sealMember: (data: any, success: any) => put(PREFIX + "/member/seal", data, success),
  unsealMember: (data: any, success: any) => put(PREFIX + "/member/unseal", data, success),
  approvedMember: (data: any, success: any) => put(PREFIX + "/member/approved", data, success),
  rejectMember: (data: any, success: any) => put(PREFIX + "/member/reject", data, success),
  createMember: (data: any, success: any) => post(PREFIX + "/member/create", data, success),
  updateMember: (data: any, success: any) => put(PREFIX + "/member/update", data, success),
  memberPwdReset: (data: any, success: any) => put(PREFIX + "/member/pwd/reset", data, success),
  addMemberLevel: (data: any, success: any) => post(PREFIX + "/member/level", data, success),
  editMemberLevel: (data: any, success: any) => put(PREFIX + "/member/level", data, success),
  getMemberLevel: (id: any, success: any) => get(PREFIX + "/member/level", { id: id }, success),
  listMemberLevel: (params: any, success: any) => get(PREFIX + "/member/level/list", params, success),
  removeMemberLevel: (id: any, success: any) => del(PREFIX + "/member/level", { id: id }, success),
  getListByIds: (params: any, success: any) => get(PREFIX + "/member/public-api/by-ids", params, success),
  findMemberCompanyList: (params: any, success: any) => get(PREFIX + "/member/company/list", params, success),
  batchUploadMember: (formData: any, success: any) => uploadFile(PREFIX + "/member/import/excel", formData, success),
  removeMember: (data: any, success: any) => del(PREFIX + "/member/delete", data, success),
  getMemberStatistics: (success: any) => get(PREFIX + "/member/statistics", {}, success),
  getLevel: (id: any, success: any) => get(PREFIX + "/member/public-api/level", {id: id}, success),
  updateLevel: (data: any, success: any) => put(PREFIX + "/member/level", data, success),
  saveLevel: (data: any, success: any) => post(PREFIX + "/member/level", data, success),
  deleteLevel: (data: any, success: any) => del(PREFIX + "/member/level", data, success),
  getPost: (id: any, success: any) => get(PREFIX + "/member/public-api/post", {id: id}, success),
  updatePost: (data: any, success: any) => put(PREFIX + "/member/post", data, success),
  savePost: (data: any, success: any) => post(PREFIX + "/member/post", data, success),
  deletePost: (data: any, success: any) => del(PREFIX + "/member/post", data, success),
  getTag: (id: any, success: any) => get(PREFIX + "/member/public-api/tag", {id: id}, success),
  updateTag: (data: any, success: any) => put(PREFIX + "/member/tag", data, success),
  saveTag: (data: any, success: any) => post(PREFIX + "/member/tag", data, success),
  deleteTag: (data: any, success: any) => del(PREFIX + "/member/tag", data, success),
}

export const messageApi = {
  getAnnouncementList: (params: any, success: any) => get(PREFIX + "/message/announcement/list", params, success),
  saveAnnouncement: (params: any, success: any) => post(PREFIX + "/message/announcement", params, success),
  updateAnnouncement: (params: any, success: any) => put(PREFIX + "/message/announcement", params, success),
  getAnnouncement: (id: any, success: any) => get(PREFIX + "/message/announcement", {id: id}, success),
  removeAnnouncement: (data: any, success: any) => del(PREFIX + "/message/announcement", data, success),
}

export const organizationalApi = {
  findDepartmentList: (id: any, fetchAll: any, success: any) => get(PREFIX + "/user-center/department/list", { id: id, fetchAll: fetchAll }, success),
  getDepartment: (id: any, success: any) => get(PREFIX + "/user-center/department", {id: id}, success),
  saveDepartment: (data: any, success: any) => post(PREFIX + "/user-center/department", data, success),
  updateDepartment: (data: any, success: any) => put(PREFIX + "/user-center/department", data, success),
  removeDepartment: (id: any, success: any) => del(PREFIX + "/user-center/department", {id: id}, success),
  toTree: toTree,
  getAllParent: organizationalApi_getAllParent,
  getUserInfo: (mobile: any, callback: any) => get(PREFIX + "/user-center/auth-api/by-mobile", { mobile: mobile }, callback),
  getUserList: (params: any, callback: any) => get(PREFIX + "/user-center/list", params, callback),
  updateUser: (data: any, success: any) => put(PREFIX + "/user-center/user", data, success),
  updateUserInfo: (data: any, success: any) => put(PREFIX + "/user-center/user/info", data, success),
  updateUserPwd: (data: any, success: any) => put(PREFIX + "/user-center/user/pwd", data, success),
  saveUser: (data: any, success: any) => post(PREFIX + "/user-center/user", data, success),
  deleteUser: (id: any, success: any) => del(PREFIX + "/user-center/user", {id: id}, success),
  resetPwd: (data: any, callback: any) => put(PREFIX + "/user-center/user/reset/pwd", data, callback),
}

export const ossApi = {
  deleteFile: (path: any, success: any) => del(PREFIX + "/oss/file", { path: path }, success),
  toBase64: (url: any, successCallback: any) => get(PREFIX + "/oss/to-base64", { url: url }, successCallback),
  // 管理端文件
  findFileList: (params: any, success: any) => get(PREFIX + "/oss/list", params, success),
  uploadOssFile: (formData: any, success: any) => uploadFile(PREFIX + "/oss/upload", formData, success),
  deleteOssFile: (id: any, success: any) => del(PREFIX + "/oss", {id: id}, success),
}

export const pointApi = {
  findList: (params: any, success: any) => get(PREFIX + "/point/channel/list", params, success),
  getChannel: (id: any, success: any) => get(PREFIX + "/point/public-api/channel", {id: id}, success),
  updateChannel: (data: any, success: any) => put(PREFIX + "/point/channel", data, success),
  saveChannel: (data: any, success: any) => post(PREFIX + "/point/channel", data, success),
  getPoint: (id: any, success: any) => get(PREFIX + "/point/public-api/point", {id: id}, success),
  updatePoint: (data: any, success: any) => put(PREFIX + "/point/point", data, success),
  savePoint: (data: any, success: any) => post(PREFIX + "/point/point", data, success),
  deletePoint: (id: any, success: any) => del(PREFIX + "/point/point", {id: id}, success),
  findPointChannelList: (params: any, success: any) => get(PREFIX + "/point/channel/all", params, success),
  findPointChannelRelationList: (params: any, success: any) => get(PREFIX + "/point/point/channel/relation/list", params, success),
  updatePointChannel: (data: any, success: any) => put(PREFIX + "/point/point/channel/relation", data, success),
}

export const resourceApi = {
  findCategoryList: (id: any, fetchAll: any, success: any) => get(PREFIX + "/resource/category/admin/list", { id: id, fetchAll: fetchAll }, success),
  getCategory: (id: any, success: any) => get(PREFIX + "/resource/category/" + id, {}, success),
  saveCategory: (data: any, success: any) => post(PREFIX + "/resource/category", data, success),
  updateCategory: (data: any, success: any) => put(PREFIX + "/resource/category", data, success),
  removeCategory: (id: any, success: any) => del(PREFIX + "/resource/category/" + id, {}, success),
  toTree: resourceApi_toTree,
  getAllParent: getAllParent,
  findList: (params: any, success: any) => get(PREFIX + "/resource/resource/list", params, success),
  getResource: (id: any, success: any) => get(PREFIX + "/resource/public-api/resource", {id: id}, success),
  updateResource: (data: any, success: any) => put(PREFIX + "/resource/resource", data, success),
  saveResource: (data: any, success: any) => post(PREFIX + "/resource/resource", data, success),
  deleteResource: (id: any, success: any) => del(PREFIX + "/resource/auth-api/resource", {id: id}, success),
  publishedResource: (data: any, success: any) => put(PREFIX + "/resource/public-api/resource/published", data, success),
  getListByIds: (params: any, success: any) => get(PREFIX + "/resource/public-api/resource/list/by-ids", params, success),
  findProductList: (params: any, success: any) => get(PREFIX + "/resource/resource/product/list", params, success),
  getProduct: (id: any, success: any) => get(PREFIX + "/resource/public-api/resource/product", {id: id}, success),
  removeProduct: (id: any, success: any) => del(PREFIX + "/resource/resource/product", {id: id}, success),
  updateProduct: (data: any, success: any) => put(PREFIX + "/resource/resource/product", data, success),
  saveProduct: (data: any, success: any) => post(PREFIX + "/resource/resource/product", data, success),
  findTagList: (params: any, success: any) => get(PREFIX + "/resource/resource/tag/list", params, success),
  getTag: (id: any, success: any) => get(PREFIX + "/resource/public-api/resource/tag", {id: id}, success),
  removeTag: (id: any, success: any) => del(PREFIX + "/resource/resource/tag", {id: id}, success),
  updateTag: (data: any, success: any) => put(PREFIX + "/resource/resource/tag", data, success),
  saveTag: (data: any, success: any) => post(PREFIX + "/resource/resource/tag", data, success),
}

export const roleApi = {
  getRoleList: (callback: any) => get(PREFIX + "/auth/role/list", {}, callback),
  getRolePageList: (params: any, callback: any) => get(PREFIX + "/auth/role/page/list", params, callback),
  findRoleList: (params: any, callback: any) => get(PREFIX + "/auth/role/list", params, callback),
  saveRole: (data: any, callback: any) => post(PREFIX + "/auth/role", data, callback),
  updateRole: (data: any, callback: any) => put(PREFIX + "/auth/role", data, callback),
  deleteRole: (id: any, callback: any) => del(PREFIX + "/auth/role", {id: id}, callback),
  getRoleAuthorityList: (id: any, callback: any) => get(PREFIX + "/auth/role/authority/list", {id: id}, callback),
  saveOrUpdateRoleAuthorityList: (data: any, callback: any) => put(PREFIX + "/auth/role/authority/update", data, callback),
  getUserRoleList: (userId: any, callback: any) => get(PREFIX + "/auth/role/user/list", {userId: userId}, callback),
  updateUserRole: (data: any, callback: any) => put(PREFIX + "/auth/role/user/list", data, callback),
}

export const searchApi = {
  findList: (params: any, success: any) => get(PREFIX + "/search/hot-word/list", params, success),
  saveHotWord: (params: any, success: any) => post(PREFIX + "/search/hot-word", params, success),
  updateHotWord: (params: any, success: any) => put(PREFIX + "/search/hot-word", params, success),
  getHotWord: (id: any, success: any) => get(PREFIX + "/search/hot-word", {id: id}, success),
  removeHotWord: (data: any, success: any) => del(PREFIX + "/search/hot-word", data, success),
}

export const settingApi = {
  saveAgreement: (data: any, success: any) => post(PREFIX + "/setting/agreement", data, success),
  getAgreement: (params: any, success: any) => get(PREFIX + "/setting/public-api/agreement", params, success),
  putAgreement: (data: any, success: any) => put(PREFIX + "/setting/agreement", data, success),
  getAgreementList: (params: any, success: any) => get(PREFIX + "/setting/agreement/page", params, success),
  saveCarousel: (params: any, success: any) => post(PREFIX + "/setting/carousel", params, success),
  getCarousel: (params: any, success: any) => get(PREFIX + "/setting/public-api/carousel", params, success),
}

export const statisticsApi = {
  getLearnStatistics: (success: any) => get(PREFIX + "/learn/statistics", {}, success),
  getExamStatistics: (success: any) => get(PREFIX + "/exam/statistics", {}, success),
  getLiveStatistics: (success: any) => get(PREFIX + "/live/statistics", {}, success),
  getContentStatistics: (success: any) => get(PREFIX + "/content/statistics", {}, success),
  getAskStatistics: (success: any) => get(PREFIX + "/ask/statistics", {}, success),
  getCircleStatistics: (success: any) => get(PREFIX + "/circle/statistics", {}, success),
  getPointStatistics: (success: any) => get(PREFIX + "/point/statistics", {}, success),
  getMessageStatistics: (success: any) => get(PREFIX + "/message/statistics", {}, success),
  getResourceStatistics: (success: any) => get(PREFIX + "/resource/statistics", {}, success),
  getUserCenterStatistics: (success: any) => get(PREFIX + "/user-center/statistics", {}, success),
}

export const topicApi = {
  gotoTopic: gotoTopic,
}
