/**
 * Edu API endpoint constants shared across all clients.
 *
 * Source of truth: server-side app/api/v1/edu/* (FastAPI routers).
 * See docs/migration/api-contract-deltas.md for the full endpoint list.
 */

export const EDU_API_PREFIX = '/api/v1/edu' as const

// ============================================================================
// Auth endpoints (8)
// ============================================================================

export const EDU_AUTH_ENDPOINTS = {
  REGISTER: `${EDU_API_PREFIX}/auth/register`,
  LOGIN: `${EDU_API_PREFIX}/auth/login`,
  ME: `${EDU_API_PREFIX}/auth/me`,
  UPDATE_ME: `${EDU_API_PREFIX}/auth/me`,
  CHANGE_PASSWORD: `${EDU_API_PREFIX}/auth/change-password`,
  SSO_LOGIN: `${EDU_API_PREFIX}/auth/sso/login`,
  SSO_GENERATE_KEYPAIR: `${EDU_API_PREFIX}/auth/sso/keypair`,
  THIRD_PARTY_LOGIN: `${EDU_API_PREFIX}/auth/third-party/login`,
} as const

// ============================================================================
// Member endpoints (10)
// ============================================================================

export const EDU_MEMBER_ENDPOINTS = {
  CREATE: `${EDU_API_PREFIX}/member`,
  ME: `${EDU_API_PREFIX}/member/me`,
  UPDATE_ME: `${EDU_API_PREFIX}/member/me`,
  BY_ID: (id: number) => `${EDU_API_PREFIX}/member/${id}`,
  ADD_POINTS: (userId: number) => `${EDU_API_PREFIX}/member/${userId}/points/add`,
  DEDUCT_POINTS: (userId: number) => `${EDU_API_PREFIX}/member/${userId}/points/deduct`,
  LIST: `${EDU_API_PREFIX}/member`,
  BIND_PARENT: `${EDU_API_PREFIX}/member/parents`,
  UNBIND_PARENT: `${EDU_API_PREFIX}/member/parents`,
  CHILDREN: (parentUserId: number) =>
    `${EDU_API_PREFIX}/member/parents/${parentUserId}/children`,
} as const

// ============================================================================
// UserCenter (8)
// ============================================================================

export const EDU_USERCENTER_ENDPOINTS = {
  PROFILE_ME: `${EDU_API_PREFIX}/usercenter/profile/me`,
  UPDATE_PROFILE: `${EDU_API_PREFIX}/usercenter/profile/me`,
  PROFILE_BY_ID: (userId: number) => `${EDU_API_PREFIX}/usercenter/profile/${userId}`,
  ADD_ADDRESS: `${EDU_API_PREFIX}/usercenter/addresses`,
  UPDATE_ADDRESS: (id: number) => `${EDU_API_PREFIX}/usercenter/addresses/${id}`,
  DELETE_ADDRESS: (id: number) => `${EDU_API_PREFIX}/usercenter/addresses/${id}`,
  ADDRESSES: `${EDU_API_PREFIX}/usercenter/addresses/me`,
  DEFAULT_ADDRESS: `${EDU_API_PREFIX}/usercenter/addresses/me/default`,
} as const

// ============================================================================
// Setting (7)
// ============================================================================

export const EDU_SETTING_ENDPOINTS = {
  GET_DICT: (type: string, key: string) => `${EDU_API_PREFIX}/setting/dict/${type}/${key}`,
  LIST_BY_TYPE: (type: string) => `${EDU_API_PREFIX}/setting/dict/${type}`,
  BATCH_GET: `${EDU_API_PREFIX}/setting/dict/batch-get`,
  CREATE: `${EDU_API_PREFIX}/setting/dict`,
  UPDATE: (id: number) => `${EDU_API_PREFIX}/setting/dict/${id}`,
  DELETE: (id: number) => `${EDU_API_PREFIX}/setting/dict/${id}`,
  LIST: `${EDU_API_PREFIX}/setting/dict`,
} as const

// ============================================================================
// Content (5)
// ============================================================================

export const EDU_CONTENT_ENDPOINTS = {
  CREATE_ARTICLE: `${EDU_API_PREFIX}/content/articles`,
  PUBLISH_ARTICLE: (id: number) => `${EDU_API_PREFIX}/content/articles/${id}/publish`,
  GET_ARTICLE: (id: number) => `${EDU_API_PREFIX}/content/articles/${id}`,
  LIKE_ARTICLE: (id: number) => `${EDU_API_PREFIX}/content/articles/${id}/like`,
  LIST_ARTICLES: `${EDU_API_PREFIX}/content/articles`,
} as const

// ============================================================================
// Learn (19)
// ============================================================================

export const EDU_LEARN_ENDPOINTS = {
  COURSES: `${EDU_API_PREFIX}/learn/courses`,
  COURSE: (id: number) => `${EDU_API_PREFIX}/learn/courses/${id}`,
  ENROLL: (id: number) => `${EDU_API_PREFIX}/learn/courses/${id}/enroll`,
  CHAPTERS: `${EDU_API_PREFIX}/learn/chapters`,
  CHAPTER: (id: number) => `${EDU_API_PREFIX}/learn/chapters/${id}`,
  SECTIONS: `${EDU_API_PREFIX}/learn/sections`,
  CHAPTER_SECTIONS: (chapterId: number) =>
    `${EDU_API_PREFIX}/learn/chapters/${chapterId}/sections`,
  PROGRESS: `${EDU_API_PREFIX}/learn/progress`,
  MY_PROGRESS: (courseId: number) =>
    `${EDU_API_PREFIX}/learn/courses/${courseId}/progress`,
  COMPLETION: (courseId: number) =>
    `${EDU_API_PREFIX}/learn/courses/${courseId}/completion`,
  HOMEWORKS: `${EDU_API_PREFIX}/learn/homeworks`,
  SUBMIT_HOMEWORK: (id: number) =>
    `${EDU_API_PREFIX}/learn/homeworks/${id}/submit`,
  GRADE_SUBMISSION: (id: number) =>
    `${EDU_API_PREFIX}/learn/submissions/${id}/grade`,
  ISSUE_CERTIFICATE: `${EDU_API_PREFIX}/learn/certificates/issue`,
  MY_CERTIFICATES: `${EDU_API_PREFIX}/learn/certificates/me`,
} as const

// ============================================================================
// Exam (13)
// ============================================================================

export const EDU_EXAM_ENDPOINTS = {
  PAPERS: `${EDU_API_PREFIX}/exam/papers`,
  PAPER: (id: number) => `${EDU_API_PREFIX}/exam/papers/${id}`,
  PUBLISH_PAPER: (id: number) =>
    `${EDU_API_PREFIX}/exam/papers/${id}/publish`,
  QUESTIONS: `${EDU_API_PREFIX}/exam/questions`,
  PAPER_QUESTIONS: (paperId: number) =>
    `${EDU_API_PREFIX}/exam/papers/${paperId}/questions`,
  RECORDS: `${EDU_API_PREFIX}/exam/records`,
  RECORD: (id: number) => `${EDU_API_PREFIX}/exam/records/${id}`,
  SUBMIT_RECORD: (id: number) =>
    `${EDU_API_PREFIX}/exam/records/${id}/submit`,
  MY_RECORDS: `${EDU_API_PREFIX}/exam/records/me`,
  WRONG_BOOK_QUESTION: (id: number) =>
    `${EDU_API_PREFIX}/exam/wrong-book/${id}`,
  WRONG_BOOK_MASTERED: (id: number) =>
    `${EDU_API_PREFIX}/exam/wrong-book/${id}/mastered`,
  WRONG_BOOK_ME: `${EDU_API_PREFIX}/exam/wrong-book/me`,
} as const

// ============================================================================
// Ask (13, edu-unique)
// ============================================================================

export const EDU_ASK_ENDPOINTS = {
  QUESTIONS: `${EDU_API_PREFIX}/ask/questions`,
  QUESTION: (id: number) => `${EDU_API_PREFIX}/ask/questions/${id}`,
  HOT: `${EDU_API_PREFIX}/ask/questions/hot`,
  QUESTION_STATS: (id: number) =>
    `${EDU_API_PREFIX}/ask/questions/${id}/stats`,
  ANSWERS: (qid: number) => `${EDU_API_PREFIX}/ask/questions/${qid}/answers`,
  ANSWER: (id: number) => `${EDU_API_PREFIX}/ask/answers/${id}`,
  ADOPT_ANSWER: (id: number) => `${EDU_API_PREFIX}/ask/answers/${id}/adopt`,
  LIKE_ANSWER: (id: number) => `${EDU_API_PREFIX}/ask/answers/${id}/like`,
  USER_STATS: (userId: number) => `${EDU_API_PREFIX}/ask/users/${userId}/stats`,
} as const

// ============================================================================
// Circle (13, edu-unique)
// ============================================================================

export const EDU_CIRCLE_ENDPOINTS = {
  CIRCLES: `${EDU_API_PREFIX}/circle/circles`,
  CIRCLE: (id: number) => `${EDU_API_PREFIX}/circle/circles/${id}`,
  JOIN: (id: number) => `${EDU_API_PREFIX}/circle/circles/${id}/join`,
  LEAVE: (id: number) => `${EDU_API_PREFIX}/circle/circles/${id}/leave`,
  MEMBERS: (id: number) => `${EDU_API_PREFIX}/circle/circles/${id}/members`,
  POSTS: (circleId: number) =>
    `${EDU_API_PREFIX}/circle/circles/${circleId}/posts`,
  POST: (id: number) => `${EDU_API_PREFIX}/circle/posts/${id}`,
  LIKE_POST: (id: number) => `${EDU_API_PREFIX}/circle/posts/${id}/like`,
  USER_CIRCLES: (userId: number) =>
    `${EDU_API_PREFIX}/circle/users/${userId}/circles`,
} as const

// ============================================================================
// Pay / Order / Point / Message / Notification (transaction + comm)
// ============================================================================

export const EDU_PAY_ENDPOINTS = {
  CREATE_PAY_ORDER: `${EDU_API_PREFIX}/pay/pay-orders`,
  MARK_PAID: (id: number) => `${EDU_API_PREFIX}/pay/pay-orders/${id}/mark-paid`,
  MY_PAYMENTS: `${EDU_API_PREFIX}/pay/pay-orders/me`,
} as const

export const EDU_ORDER_ENDPOINTS = {
  CREATE: `${EDU_API_PREFIX}/order/orders`,
  CANCEL: (id: number) => `${EDU_API_PREFIX}/order/orders/${id}/cancel`,
  REFUND: (id: number) => `${EDU_API_PREFIX}/order/orders/${id}/refund`,
  ORDER: (id: number) => `${EDU_API_PREFIX}/order/orders/${id}`,
  MY_ORDERS: `${EDU_API_PREFIX}/order/orders/me`,
} as const

export const EDU_POINT_ENDPOINTS = {
  EARN: `${EDU_API_PREFIX}/point/points/earn`,
  SPEND: `${EDU_API_PREFIX}/point/points/spend`,
  ACCOUNT: `${EDU_API_PREFIX}/point/points/me`,
  RECORDS: `${EDU_API_PREFIX}/point/points/records`,
} as const

export const EDU_MESSAGE_ENDPOINTS = {
  SEND: `${EDU_API_PREFIX}/message/messages`,
  MARK_READ: (id: number) => `${EDU_API_PREFIX}/message/messages/${id}/read`,
  INBOX: `${EDU_API_PREFIX}/message/messages/inbox`,
  UNREAD_COUNT: `${EDU_API_PREFIX}/message/messages/unread-count`,
} as const

export const EDU_NOTIFICATION_ENDPOINTS = {
  SEND: `${EDU_API_PREFIX}/notification/notifications`,
  BATCH: `${EDU_API_PREFIX}/notification/notifications/batch`,
  MY: `${EDU_API_PREFIX}/notification/notifications/me`,
} as const

// ============================================================================
// Live / Search (supporting)
// ============================================================================

export const EDU_LIVE_ENDPOINTS = {
  ROOMS: `${EDU_API_PREFIX}/live/rooms`,
  ROOM: (id: number) => `${EDU_API_PREFIX}/live/rooms/${id}`,
  START: (id: number) => `${EDU_API_PREFIX}/live/rooms/${id}/start`,
  END: (id: number) => `${EDU_API_PREFIX}/live/rooms/${id}/end`,
  JOIN: (id: number) => `${EDU_API_PREFIX}/live/rooms/${id}/join`,
  LEAVE: (id: number) => `${EDU_API_PREFIX}/live/rooms/${id}/leave`,
  ATTENDEES: (id: number) => `${EDU_API_PREFIX}/live/rooms/${id}/attendees`,
} as const

export const EDU_SEARCH_ENDPOINTS = {
  INDEX: `${EDU_API_PREFIX}/search/index`,
  SEARCH: `${EDU_API_PREFIX}/search/search`,
  DELETE_INDEX: (entityType: string, entityId: number) =>
    `${EDU_API_PREFIX}/search/index/${entityType}/${entityId}`,
} as const

// ============================================================================
// Aggregate export
// ============================================================================

export const EDU_ENDPOINTS = {
  AUTH: EDU_AUTH_ENDPOINTS,
  MEMBER: EDU_MEMBER_ENDPOINTS,
  USERCENTER: EDU_USERCENTER_ENDPOINTS,
  SETTING: EDU_SETTING_ENDPOINTS,
  CONTENT: EDU_CONTENT_ENDPOINTS,
  LEARN: EDU_LEARN_ENDPOINTS,
  EXAM: EDU_EXAM_ENDPOINTS,
  ASK: EDU_ASK_ENDPOINTS,
  CIRCLE: EDU_CIRCLE_ENDPOINTS,
  PAY: EDU_PAY_ENDPOINTS,
  ORDER: EDU_ORDER_ENDPOINTS,
  POINT: EDU_POINT_ENDPOINTS,
  MESSAGE: EDU_MESSAGE_ENDPOINTS,
  NOTIFICATION: EDU_NOTIFICATION_ENDPOINTS,
  LIVE: EDU_LIVE_ENDPOINTS,
  SEARCH: EDU_SEARCH_ENDPOINTS,
} as const

export default EDU_ENDPOINTS