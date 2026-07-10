import { http } from '@/utils/http'

function realCall<T = any>(
  fn: () => Promise<T>,
  params?: any,
  callback?: any,
): Promise<T> {
  const cb = typeof params === 'function' ? params : callback
  const p = fn()
  if (typeof cb === 'function') {
    p.then((data) => cb(data)).catch(() => {})
  }
  return p
}

function idOf(params: any): any {
  if (params == null || typeof params === 'function') return ''
  if (typeof params !== 'object') return params
  if (params.id != null) return params.id
  for (const k of Object.keys(params)) {
    if (k !== 'callback' && /Id$/.test(k)) return params[k]
  }
  return ''
}

function payloadOf(params: any): any {
  if (params == null || typeof params === 'function') return undefined
  if (typeof params === 'object') return params
  return undefined
}

function listGet(path: string) {
  return (params?: any, callback?: any, ..._rest: any[]) =>
    realCall(() => http.get(path, payloadOf(params)), params, callback)
}
function getByIdGet(path: string) {
  return (params?: any, callback?: any, ..._rest: any[]) =>
    realCall(() => http.get(`${path}/${idOf(params)}`), params, callback)
}
function createPost(path: string) {
  return (params?: any, callback?: any, ..._rest: any[]) =>
    realCall(() => http.post(path, payloadOf(params)), params, callback)
}
function updatePut(path: string) {
  return (params?: any, callback?: any, ..._rest: any[]) =>
    realCall(() => http.put(`${path}/${idOf(params)}`, payloadOf(params)), params, callback)
}
function updatePatch(path: string) {
  return (params?: any, callback?: any, ..._rest: any[]) =>
    realCall(() => http.patch(`${path}/${idOf(params)}`, payloadOf(params)), params, callback)
}
function removeDelete(path: string) {
  return (params?: any, callback?: any, ..._rest: any[]) =>
    realCall(() => http.delete(`${path}/${idOf(params)}`), params, callback)
}
function putBody(path: string) {
  return (params?: any, callback?: any, ..._rest: any[]) =>
    realCall(() => http.put(path, payloadOf(params)), params, callback)
}

export const askApi = {
  findQuestionList: listGet('/asks'),
  getQuestionDetail: getByIdGet('/asks'),
  deleteQuestion: removeDelete('/asks'),
}

export const examApi = {
  findCategoryList: listGet('/admin/exam/categories'),
  toTree: listGet('/admin/exam/categories'),
  getCategory: getByIdGet('/admin/exam/categories'),
  saveCategory: createPost('/admin/exam/categories'),
  updateCategory: updatePut('/admin/exam/categories'),
  removeCategory: removeDelete('/admin/exam/categories'),
  getPaper: getByIdGet('/admin/exam/papers'),
  getRecord: getByIdGet('/admin/exam/records'),
  findList: listGet('/admin/exam/papers'),
  getExamChapterList: (params?: any, callback?: any, ..._rest: any[]) =>
    realCall(() => http.get(`/admin/exam/papers/${idOf(params)}/questions`), params, callback),
  getRecordList: listGet('/admin/exam/records'),
  getAllParent: listGet('/admin/exam/categories'),
  saveBaseInfo: createPost('/admin/exam/papers'),
  updateBaseInfo: updatePut('/admin/exam/papers'),
  getBaseInfo: getByIdGet('/admin/exam/papers'),
  publishExam: (params?: any, callback?: any, ..._rest: any[]) =>
    realCall(() => http.put(`/admin/exam/papers/${idOf(params)}`, { isPublished: true }), params, callback),
  unPublishExam: (params?: any, callback?: any, ..._rest: any[]) =>
    realCall(() => http.put(`/admin/exam/papers/${idOf(params)}`, { isPublished: false }), params, callback),
  saveExamChapter: (params?: any, callback?: any, ..._rest: any[]) =>
    realCall(() => http.post(`/exam/papers/${idOf(params)}/chapters`, payloadOf(params)), params, callback),
  updateExamChapter: (params?: any, callback?: any, ..._rest: any[]) => {
    const paperId = params?.paperId ?? params?.id ?? ''
    const chapterId = params?.chapterId ?? ''
    return realCall(() => http.put(`/exam/papers/${paperId}/chapters/${chapterId}`, payloadOf(params)), params, callback)
  },
  deleteExamChapter: (params?: any, callback?: any, ..._rest: any[]) => {
    const paperId = params?.paperId ?? params?.id ?? ''
    const chapterId = params?.chapterId ?? ''
    return realCall(() => http.delete(`/exam/papers/${paperId}/chapters/${chapterId}`), params, callback)
  },
  saveExamChapterSection: (params?: any, callback?: any, ..._rest: any[]) => {
    const paperId = params?.paperId ?? params?.id ?? ''
    const chapterId = params?.chapterId ?? ''
    return realCall(() => http.post(`/exam/papers/${paperId}/chapters/${chapterId}/sections`, payloadOf(params)), params, callback)
  },
  updateExamChapterSection: (params?: any, callback?: any, ..._rest: any[]) => {
    const paperId = params?.paperId ?? params?.id ?? ''
    const chapterId = params?.chapterId ?? ''
    const sectionId = params?.sectionId ?? ''
    return realCall(() => http.put(`/exam/papers/${paperId}/chapters/${chapterId}/sections/${sectionId}`, payloadOf(params)), params, callback)
  },
  deleteExamChapterSection: (params?: any, callback?: any, ..._rest: any[]) => {
    const paperId = params?.paperId ?? params?.id ?? ''
    const chapterId = params?.chapterId ?? ''
    const sectionId = params?.sectionId ?? ''
    return realCall(() => http.delete(`/exam/papers/${paperId}/chapters/${chapterId}/sections/${sectionId}`), params, callback)
  },
  updateSortOrder: putBody('/exam/sort-order'),
  deleteExam: removeDelete('/admin/exam/papers'),
  getAllExamList: listGet('/admin/exam/categories'),
  getSignUpList: listGet('/exam/signups'),
  delPaper: removeDelete('/admin/exam/papers'),
  delQuestion: removeDelete('/admin/exam/records'),
  manualMarkRecord: (params?: any, callback?: any, ..._rest: any[]) =>
    realCall(() => http.post(`/admin/exam/records/${idOf(params)}/grade`, payloadOf(params)), params, callback),
  getMarkRecordList: listGet('/exam/records/pending-marks'),
}

export const learnApi = {
  getLearnStatistics: listGet('/statistics/learn'),
  findCategoryList: listGet('/admin/learn/categories'),
  toTree: listGet('/admin/learn/categories'),
  getCategory: getByIdGet('/admin/learn/categories'),
  saveCategory: createPost('/admin/learn/categories'),
  updateCategory: updatePut('/admin/learn/categories'),
  removeCategory: removeDelete('/admin/learn/categories'),
  findList: listGet('/admin/learn/lessons'),
  getLessonChapterList: (params?: any, callback?: any, ..._rest: any[]) =>
    realCall(() => http.get(`/admin/learn/lessons/${idOf(params)}/chapters`), params, callback),
  removeLesson: removeDelete('/admin/learn/lessons'),
  removeTopic: removeDelete('/admin/topics'),
  getAllParent: listGet('/admin/learn/categories'),
  saveBaseInfo: createPost('/admin/learn/lessons'),
  updateBaseInfo: updatePut('/admin/learn/lessons'),
  getBaseInfo: getByIdGet('/admin/learn/lessons'),
  publishLesson: (params?: any, callback?: any, ..._rest: any[]) =>
    realCall(() => http.put(`/admin/learn/lessons/${idOf(params)}`, { isPublished: true }), params, callback),
  unPublishLesson: (params?: any, callback?: any, ..._rest: any[]) =>
    realCall(() => http.put(`/admin/learn/lessons/${idOf(params)}`, { isPublished: false }), params, callback),
  saveLessonChapter: (params?: any, callback?: any, ..._rest: any[]) =>
    realCall(() => http.post(`/admin/learn/lessons/${idOf(params)}/chapters`, payloadOf(params)), params, callback),
  updateLessonChapter: (params?: any, callback?: any, ..._rest: any[]) => {
    const lessonId = params?.lessonId ?? params?.id ?? ''
    const chapterId = params?.chapterId ?? ''
    return realCall(() => http.put(`/admin/learn/lessons/${lessonId}/chapters/${chapterId}`, payloadOf(params)), params, callback)
  },
  deleteLessonChapter: (params?: any, callback?: any, ..._rest: any[]) => {
    const lessonId = params?.lessonId ?? params?.id ?? ''
    const chapterId = params?.chapterId ?? ''
    return realCall(() => http.delete(`/admin/learn/lessons/${lessonId}/chapters/${chapterId}`), params, callback)
  },
  updateSortOrder: putBody('/admin/learn/lessons/sort-order'),
  saveLessonChapterSection: (params?: any, callback?: any, ..._rest: any[]) => {
    const lessonId = params?.lessonId ?? params?.id ?? ''
    const chapterId = params?.chapterId ?? ''
    return realCall(() => http.post(`/admin/learn/lessons/${lessonId}/chapters/${chapterId}/sections`, payloadOf(params)), params, callback)
  },
  updateLessonChapterSection: (params?: any, callback?: any, ..._rest: any[]) => {
    const lessonId = params?.lessonId ?? params?.id ?? ''
    const chapterId = params?.chapterId ?? ''
    const sectionId = params?.sectionId ?? ''
    return realCall(() => http.put(`/admin/learn/lessons/${lessonId}/chapters/${chapterId}/sections/${sectionId}`, payloadOf(params)), params, callback)
  },
  deleteLessonChapterSection: (params?: any, callback?: any, ..._rest: any[]) => {
    const lessonId = params?.lessonId ?? params?.id ?? ''
    const chapterId = params?.chapterId ?? ''
    const sectionId = params?.sectionId ?? ''
    return realCall(() => http.delete(`/admin/learn/lessons/${lessonId}/chapters/${chapterId}/sections/${sectionId}`), params, callback)
  },
  saveHomework: (params?: any, callback?: any, ..._rest: any[]) =>
    realCall(() => http.post(`/admin/learn/lessons/${idOf(params)}/homework`, payloadOf(params)), params, callback),
  updateHomework: (params?: any, callback?: any, ..._rest: any[]) => {
    const lessonId = params?.lessonId ?? params?.id ?? ''
    const hwId = params?.hwId ?? ''
    return realCall(() => http.put(`/admin/learn/lessons/${lessonId}/homework/${hwId}`, payloadOf(params)), params, callback)
  },
  getHomework: (params?: any, callback?: any, ..._rest: any[]) =>
    realCall(() => http.get(`/admin/learn/lessons/${idOf(params)}/homework`), params, callback),
  getLearnExamPaper: (params?: any, callback?: any, ..._rest: any[]) =>
    realCall(() => http.get(`/admin/learn/lessons/${idOf(params)}/exam-paper`), params, callback),
  updateLearnExamPaper: (params?: any, callback?: any, ..._rest: any[]) =>
    realCall(() => http.put(`/admin/learn/lessons/${idOf(params)}/exam-paper`, payloadOf(params)), params, callback),
  updateLearnCertificate: (params?: any, callback?: any, ..._rest: any[]) =>
    realCall(() => http.put(`/admin/learn/lessons/${idOf(params)}/certificate`, payloadOf(params)), params, callback),
  publishTopic: (params?: any, callback?: any, ..._rest: any[]) =>
    realCall(() => http.put(`/admin/learn/topics/${idOf(params)}/publish`), params, callback),
  unPublishTopic: (params?: any, callback?: any, ..._rest: any[]) =>
    realCall(() => http.put(`/admin/learn/topics/${idOf(params)}/unpublish`), params, callback),
  getSignUpList: listGet('/admin/learn/signups'),
  batchSignUp: (params?: any, callback?: any, ..._rest: any[]) =>
    realCall(() => http.post(`/admin/learn/lessons/${idOf(params)}/batch-signup`, payloadOf(params)), params, callback),
  removeMap: removeDelete('/admin/learn/maps'),
  publishLearnMap: (params?: any, callback?: any, ..._rest: any[]) =>
    realCall(() => http.put(`/admin/learn/maps/${idOf(params)}/publish`), params, callback),
  unPublishLearnMap: (params?: any, callback?: any, ..._rest: any[]) =>
    realCall(() => http.put(`/admin/learn/maps/${idOf(params)}/unpublish`), params, callback),
  getInvoiceApplicationList: listGet('/admin/learn/invoices'),
  approvedInvoiceApplication: (params?: any, callback?: any, ..._rest: any[]) =>
    realCall(() => http.put(`/admin/learn/invoices/${idOf(params)}/approved`), params, callback),
  rejectedInvoiceApplication: (params?: any, callback?: any, ..._rest: any[]) =>
    realCall(() => http.put(`/admin/learn/invoices/${idOf(params)}/rejected`), params, callback),
  invoicingInvoiceApplication: (params?: any, callback?: any, ..._rest: any[]) =>
    realCall(() => http.put(`/admin/learn/invoices/${idOf(params)}/invoicing`), params, callback),
  invoicedInvoiceApplication: (params?: any, callback?: any, ..._rest: any[]) =>
    realCall(() => http.put(`/admin/learn/invoices/${idOf(params)}/invoiced`), params, callback),
  canceledInvoiceApplication: (params?: any, callback?: any, ..._rest: any[]) =>
    realCall(() => http.put(`/admin/learn/invoices/${idOf(params)}/canceled`), params, callback),
  getInvoiceTitleList: listGet('/admin/learn/invoice-titles'),
  createInvoiceTitle: createPost('/admin/learn/invoice-titles'),
  updateInvoiceTitle: updatePut('/admin/learn/invoice-titles'),
  removeInvoiceTitle: removeDelete('/admin/learn/invoice-titles'),
  getCompanyStudyReport: listGet('/admin/learn/reports/company-study'),
  getLessonStudyReport: listGet('/admin/learn/reports/lesson-study'),
  getLessonSignReport: listGet('/admin/learn/reports/signup'),
  getMemberStudyReport: listGet('/admin/learn/reports/member-study'),
}

export const memberApi = {
  findList: listGet('/admin/members'),
  updateGroup: updatePut('/admin/members/groups'),
  saveGroup: createPost('/admin/members/groups'),
  deleteGroup: removeDelete('/admin/members/groups'),
  updateLevel: updatePut('/admin/members/levels'),
  saveLevel: createPost('/admin/members/levels'),
  deleteLevel: removeDelete('/admin/members/levels'),
  getMemberStatistics: listGet('/admin/members/statistics'),
  getMemberUnauditedList: listGet('/admin/members/unaudited'),
  approvedMember: putBody('/admin/members/approved'),
  rejectMember: putBody('/admin/members/reject'),
  removeMember: (params?: any, callback?: any, ..._rest: any[]) =>
    realCall(() => http.delete('/admin/members', { id: idOf(params) }), params, callback),
  updatePost: updatePut('/admin/members/posts'),
  savePost: createPost('/admin/members/posts'),
  deletePost: removeDelete('/admin/members/posts'),
  getMemberList: listGet('/admin/members'),
  sealMember: putBody('/admin/members/seal'),
  unsealMember: putBody('/admin/members/unseal'),
  updateMember: putBody('/admin/members'),
  memberPwdReset: putBody('/admin/members/pwd/reset'),
  createMember: createPost('/admin/members'),
  findMemberCompanyList: listGet('/admin/members/companies'),
  batchUploadMember: createPost('/admin/members/batch-upload'),
  findTypeList: listGet('/admin/members/types'),
  updateCompanyType: updatePut('/admin/members/company-types'),
  saveCompanyType: createPost('/admin/members/company-types'),
  deleteCompanyType: removeDelete('/admin/members/company-types'),
  enableCompanyType: (params?: any, callback?: any, ..._rest: any[]) =>
    realCall(() => http.put(`/admin/members/company-types/${idOf(params)}/enable`), params, callback),
  disableCompanyType: (params?: any, callback?: any, ..._rest: any[]) =>
    realCall(() => http.put(`/admin/members/company-types/${idOf(params)}/disable`), params, callback),
  updateCompany: updatePut('/admin/members/companies'),
  saveCompany: createPost('/admin/members/companies'),
  deleteCompany: removeDelete('/admin/members/companies'),
  enableCompany: (params?: any, callback?: any, ..._rest: any[]) =>
    realCall(() => http.put(`/admin/members/companies/${idOf(params)}/enable`), params, callback),
  disableCompany: (params?: any, callback?: any, ..._rest: any[]) =>
    realCall(() => http.put(`/admin/members/companies/${idOf(params)}/disable`), params, callback),
  updateTag: updatePut('/admin/members/tags'),
  saveTag: createPost('/admin/members/tags'),
  deleteTag: removeDelete('/admin/members/tags'),
}

export const liveApi = {
  findCategoryList: listGet('/admin/live/categories'),
  getCategory: getByIdGet('/admin/live/categories'),
  removeCategory: removeDelete('/admin/live/categories'),
  toTree: listGet('/admin/live/categories'),
  saveCategory: createPost('/admin/live/categories'),
  updateCategory: updatePut('/admin/live/categories'),
  findList: listGet('/admin/live/channels'),
  removeChannel: removeDelete('/admin/live/channels'),
  getAllParent: listGet('/admin/live/categories'),
  saveChannel: createPost('/admin/live/channels'),
  updateChannel: updatePut('/admin/live/channels'),
  getChannel: getByIdGet('/admin/live/channels'),
}

export const lecturerApi = {
  deleteLecturer: removeDelete('/admin/live/lecturers'),
  findList: listGet('/admin/live/lecturers'),
  saveLecturer: createPost('/admin/live/lecturers'),
  updateLecturer: updatePut('/admin/live/lecturers'),
  getLecturer: getByIdGet('/admin/live/lecturers'),
}

export const statisticsApi = {
  getExamStatistics: listGet('/statistics/exam'),
  getMessageStatistics: listGet('/admin/statistics/message'),
  getLiveStatistics: listGet('/admin/statistics/live'),
  getPointStatistics: listGet('/admin/statistics/point'),
  getContentStatistics: listGet('/statistics/content'),
  getResourceStatistics: listGet('/admin/statistics/resource'),
  getUserCenterStatistics: listGet('/admin/statistics/user-center'),
}

export const indexApi = {
  getDayPvList: listGet('/admin/visit-tracking/day/pv/list'),
  getDayUvList: listGet('/admin/visit-tracking/day/uv/list'),
  getIpCitySummaryList: listGet('/admin/visit-tracking/ip-city/summary/list'),
  getVisitSummary: listGet('/admin/visit-tracking/summary'),
  getStatistics: listGet('/admin/stats'),
  getVisitList: listGet('/admin/visit-tracking/visits'),
}

export const certificateApi = {
  findList: listGet('/admin/certificates/templates'),
}

export const messageApi = {
  getAnnouncementList: listGet('/admin/messages/announcements'),
  removeAnnouncement: removeDelete('/admin/messages/announcements'),
  saveAnnouncement: createPost('/admin/messages/announcements'),
  updateAnnouncement: updatePut('/admin/messages/announcements'),
}

export const circleApi = {
  findCircleList: listGet('/circles'),
  deleteCircleAdmin: removeDelete('/admin/circles'),
  updateCircleShow: (params?: any, callback?: any, ..._rest: any[]) =>
    realCall(() => http.put(`/admin/circles/${idOf(params)}/show`, payloadOf(params)), params, callback),
}

export const commentApi = {
  findCommentList: listGet('/comments'),
  deleteCommentAdmin: removeDelete('/comments'),
}

export const ossApi = {
  findFileList: listGet('/admin/oss/drivers'),
  uploadOssFile: createPost('/admin/oss/drivers'),
  deleteOssFile: removeDelete('/admin/oss/drivers'),
  deleteFile: removeDelete('/admin/oss/drivers'),
}

export const pointApi = {
  findList: listGet('/admin/edu-points/records'),
  updateChannel: updatePut('/admin/edu-points/channels'),
  saveChannel: createPost('/admin/edu-points/channels'),
  updatePoint: updatePut('/admin/edu-points/rules'),
  savePoint: createPost('/admin/edu-points/rules'),
  findPointChannelRelationList: listGet('/admin/edu-points/relations'),
  updatePointChannel: putBody('/admin/edu-points/relations'),
  findPointChannelList: listGet('/admin/edu-points/channels'),
}

export const settingApi = {
  saveCarousel: createPost('/admin/edu-settings'),
  getCarousel: listGet('/admin/edu-settings'),
  saveAgreement: createPost('/admin/edu-settings'),
  getAgreement: listGet('/admin/edu-settings'),
  getAgreementList: listGet('/admin/edu-settings'),
  putAgreement: updatePatch('/admin/edu-settings'),
}

export const roleApi = {
  getRoleList: listGet('/roles'),
  getUserRoleList: (params?: any, callback?: any, ..._rest: any[]) =>
    realCall(() => http.get(`/users/${idOf(params)}/roles`), params, callback),
  updateUserRole: (params?: any, callback?: any, ..._rest: any[]) =>
    realCall(() => http.post(`/users/${idOf(params)}/roles`, payloadOf(params)), params, callback),
  findRoleList: listGet('/roles'),
  saveRole: createPost('/roles'),
  updateRole: updatePatch('/roles'),
  deleteRole: removeDelete('/roles'),
}

export const contentApi = {
  deleteNews: removeDelete('/admin/news/articles'),
  findList: listGet('/admin/news/articles'),
  saveNewsTop: (params?: any, callback?: any, ..._rest: any[]) =>
    realCall(() => http.put(`/admin/news/articles/${idOf(params)}/top`, payloadOf(params)), params, callback),
  deleteNewsTop: (params?: any, callback?: any, ..._rest: any[]) =>
    realCall(() => http.delete(`/admin/news/articles/${idOf(params)}/top`), params, callback),
  saveNewsRecommend: (params?: any, callback?: any, ..._rest: any[]) =>
    realCall(() => http.put(`/admin/news/articles/${idOf(params)}/recommend`, payloadOf(params)), params, callback),
  deleteNewsRecommend: (params?: any, callback?: any, ..._rest: any[]) =>
    realCall(() => http.delete(`/admin/news/articles/${idOf(params)}/recommend`), params, callback),
  saveNews: createPost('/admin/news/articles'),
  updateNews: updatePut('/admin/news/articles'),
  getNews: getByIdGet('/admin/news/articles'),
}

export const organizationalApi = {
  findDepartmentList: listGet('/admin/members/departments'),
  toTree: listGet('/admin/members/departments'),
  getDepartment: getByIdGet('/admin/members/departments'),
  saveDepartment: createPost('/admin/members/departments'),
  updateDepartment: updatePut('/admin/members/departments'),
  removeDepartment: removeDelete('/admin/members/departments'),
  getUserList: (params?: any, callback?: any, ..._rest: any[]) =>
    realCall(() => http.get(`/admin/members/departments/${idOf(params)}/users`, payloadOf(params)), params, callback),
  updateUser: updatePut('/admin/members/users'),
  saveUser: createPost('/admin/members/users'),
  resetPwd: (params?: any, callback?: any, ..._rest: any[]) =>
    realCall(() => http.put(`/admin/members/users/${idOf(params)}/pwd`, payloadOf(params)), params, callback),
  deleteUser: removeDelete('/admin/members/users'),
  getAllParent: listGet('/admin/members/departments'),
}

export const resourceApi = {
  findCategoryList: listGet('/admin/resources/categories'),
  toTree: listGet('/admin/resources/categories'),
  getCategory: getByIdGet('/admin/resources/categories'),
  saveCategory: createPost('/admin/resources/categories'),
  updateCategory: updatePut('/admin/resources/categories'),
  removeCategory: removeDelete('/admin/resources/categories'),
  deleteResource: removeDelete('/admin/resources'),
  findList: listGet('/admin/resources'),
  publishedResource: (params?: any, callback?: any, ..._rest: any[]) =>
    realCall(() => http.put(`/admin/resources/${idOf(params)}/publish`, payloadOf(params)), params, callback),
  getTag: getByIdGet('/resources/tags'),
  removeTag: removeDelete('/admin/resources/tags'),
  findProductList: listGet('/admin/resources/products'),
  getProduct: getByIdGet('/resources/products'),
  saveProduct: createPost('/admin/resources/products'),
  updateProduct: updatePut('/admin/resources/products'),
  removeProduct: removeDelete('/admin/resources/products'),
  findTagList: listGet('/admin/resources/tags'),
  saveTag: createPost('/admin/resources/tags'),
  updateTag: updatePut('/admin/resources/tags'),
}

export const searchApi = {
  findList: listGet('/search/hot-words'),
  removeHotWord: removeDelete('/search/hot-words'),
  saveHotWord: createPost('/search/hot-words'),
  updateHotWord: updatePut('/search/hot-words'),
}
