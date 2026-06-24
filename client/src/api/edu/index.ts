/**
 * Edu business API client (Phase C)
 *
 * Wraps 129 endpoints from /api/v1/edu/* into typed TypeScript API functions.
 * Uses axios instance from @/utils/request.ts (token injection, error handling).
 */

import request from '@/utils/request';

// ============================================================================
// Types
// ============================================================================

export interface EduBaseResponse<T = unknown> {
  code: number;
  msg?: string;
  data?: T;
}

export interface EduPaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
  pages?: number;
}

// Auth types
export interface EduUser {
  id: number;
  username: string;
  nickname?: string;
  avatar?: string;
  email?: string;
  phone?: string;
  status?: number;
  created_at?: string;
  last_login_at?: string;
}

export interface EduAuthTokens {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
  user?: EduUser;
}

// Member
export interface EduMember {
  id: number;
  user_id: number;
  member_no?: string;
  real_name?: string;
  member_type: string;
  school?: string;
  grade?: string;
  class_name?: string;
  student_no?: string;
  points: number;
  level: number;
  expire_at?: string;
}

// Learn
export interface EduCourse {
  id: number;
  title: string;
  subtitle?: string;
  cover?: string;
  description?: string;
  teacher_id: number;
  category_id?: number;
  price: number;
  original_price?: number;
  student_count: number;
  lesson_count: number;
  duration_minutes: number;
  difficulty?: string;
  is_free: boolean;
  is_published: boolean;
  published_at?: string;
  rating?: number;
  created_at?: string;
}

export interface EduCourseChapter {
  id: number;
  course_id: number;
  parent_id?: number;
  title: string;
  sort_order: number;
  description?: string;
}

export interface EduCourseSection {
  id: number;
  chapter_id: number;
  course_id: number;
  title: string;
  video_url?: string;
  duration_seconds: number;
  resource_url?: string;
  sort_order: number;
  is_free_preview: boolean;
}

export interface EduLearnRecord {
  id: number;
  user_id: number;
  course_id: number;
  section_id?: number;
  progress_percent: number;
  is_completed: boolean;
  completed_at?: string;
  last_position?: number;
}

export interface EduCertificate {
  id: number;
  certificate_no: string;
  title: string;
  issue_date: string;
  expire_date?: string;
  pdf_url?: string;
  score?: number;
}

// Exam
export interface EduPaper {
  id: number;
  title: string;
  course_id?: number;
  description?: string;
  duration_minutes: number;
  total_score: number;
  pass_score: number;
  question_count: number;
  difficulty?: string;
  is_published: boolean;
}

export interface EduQuestion {
  id: number;
  paper_id?: number;
  question_type: string;
  stem: string;
  options?: string[];
  correct_answer?: string;
  analysis?: string;
  score: number;
  difficulty?: string;
  tags?: string;
}

export interface EduExamRecord {
  id: number;
  user_id: number;
  paper_id: number;
  start_at: string;
  submit_at?: string;
  duration_seconds: number;
  score?: number;
  is_passed?: boolean;
  status: string;
}

// Ask (edu-unique)
export interface EduAskQuestion {
  id: number;
  user_id: number;
  title: string;
  content: string;
  course_id?: number;
  tags?: string;
  view_count: number;
  answer_count: number;
  is_resolved: boolean;
  best_answer_id?: number;
  created_at: string;
}

export interface EduAskAnswer {
  id: number;
  question_id: number;
  user_id: number;
  content: string;
  is_best: boolean;
  like_count: number;
  adopted_at?: string;
  created_at: string;
}

// Circle (edu-unique)
export interface EduCircle {
  id: number;
  owner_id: number;
  name: string;
  description?: string;
  cover?: string;
  category?: string;
  is_public: boolean;
  member_count: number;
  post_count: number;
  created_at: string;
}

export interface EduCirclePost {
  id: number;
  circle_id: number;
  user_id: number;
  content: string;
  images?: string[];
  like_count: number;
  comment_count: number;
  created_at: string;
}

// Order/Pay/Point
export interface EduOrder {
  id: number;
  order_no: string;
  user_id: number;
  order_type: string;
  total_amount: number;
  paid_amount: number;
  discount_amount: number;
  status: string;
  pay_method?: string;
  paid_at?: string;
  created_at: string;
}

export interface EduPointAccount {
  user_id: number;
  balance: number;
  frozen: number;
  total_earned: number;
  total_spent: number;
}

// Live
export interface EduLiveRoom {
  id: number;
  title: string;
  teacher_id: number;
  course_id?: number;
  scheduled_start: string;
  scheduled_end: string;
  status: 'scheduled' | 'live' | 'ended' | 'cancelled';
  stream_url?: string;
  playback_url?: string;
  attendee_count: number;
  max_attendees: number;
}

// ============================================================================
// P0: Auth API (8 endpoints)
// ============================================================================

export const authApi = {
  register: (data: { username: string; password: string; phone?: string; email?: string; nickname?: string; invite_code?: string }) =>
    request.post<EduBaseResponse<EduUser>>('/api/v1/edu/auth/register', data),

  login: (data: { username: string; password: string }) =>
    request.post<EduBaseResponse<EduAuthTokens>>('/api/v1/edu/auth/login', data),

  me: () => request.get<EduBaseResponse<EduUser>>('/api/v1/edu/auth/me'),

  updateProfile: (data: Partial<EduUser>) => request.put<EduBaseResponse<EduUser>>('/api/v1/edu/auth/me', data),

  changePassword: (data: { old_password: string; new_password: string }) =>
    request.post<EduBaseResponse<{ changed: boolean }>>('/api/v1/edu/auth/change-password', data),

  ssoLogin: (data: { client_id: string; signed_jwt: string }) =>
    request.post<EduBaseResponse<EduAuthTokens>>('/api/v1/edu/auth/sso/login', data),

  ssoGenerateKeypair: (data: { client_id: string; name?: string }) =>
    request.post<EduBaseResponse<{ client_id: string; public_key: string }>>('/api/v1/edu/auth/sso/keypair', data),

  thirdPartyLogin: (data: { platform: string; code: string; user_info?: Record<string, unknown> }) =>
    request.post<EduBaseResponse<EduAuthTokens>>('/api/v1/edu/auth/third-party/login', data),
};

// ============================================================================
// P0: Member API (10 endpoints)
// ============================================================================

export const memberApi = {
  create: (data: Partial<EduMember>) => request.post<EduBaseResponse<EduMember>>('/api/v1/edu/member', data),

  me: () => request.get<EduBaseResponse<EduMember>>('/api/v1/edu/member/me'),

  updateMe: (data: Partial<EduMember>) => request.put<EduBaseResponse<EduMember>>('/api/v1/edu/member/me', data),

  get: (memberId: number) => request.get<EduBaseResponse<EduMember>>(`/api/v1/edu/member/${memberId}`),

  addPoints: (userId: number, data: { amount: number; source?: string }) =>
    request.post<EduBaseResponse<EduMember>>(`/api/v1/edu/member/${userId}/points/add`, data),

  deductPoints: (userId: number, data: { amount: number }) =>
    request.post<EduBaseResponse<EduMember>>(`/api/v1/edu/member/${userId}/points/deduct`, data),

  list: (params?: { page?: number; size?: number; member_type?: string; keyword?: string }) =>
    request.get<EduBaseResponse<EduPaginatedResponse<EduMember>>>('/api/v1/edu/member', { params }),

  bindParent: (data: { parent_user_id: number; student_user_id: number; relation?: string }) =>
    request.post<EduBaseResponse<{ id: number }>>('/api/v1/edu/member/parents', data),

  unbindParent: (data: { parent_user_id: number; student_user_id: number }) =>
    request.delete<EduBaseResponse<{ unbound: boolean }>>('/api/v1/edu/member/parents', { data }),

  listChildren: (parentUserId: number) =>
    request.get<EduBaseResponse<EduMember[]>>(`/api/v1/edu/member/parents/${parentUserId}/children`),
};

// ============================================================================
// P0: UserCenter API (8 endpoints)
// ============================================================================

export const userCenterApi = {
  getProfile: (userId?: number) =>
    request.get<EduBaseResponse<Record<string, unknown>>>(
      userId ? `/api/v1/edu/usercenter/profile/${userId}` : '/api/v1/edu/usercenter/profile/me'
    ),

  updateProfile: (data: Record<string, unknown>) =>
    request.put<EduBaseResponse<Record<string, unknown>>>('/api/v1/edu/usercenter/profile/me', data),

  addAddress: (data: {
    receiver: string;
    phone: string;
    province: string;
    city: string;
    district?: string;
    detail: string;
    is_default?: boolean;
  }) => request.post<EduBaseResponse<Record<string, unknown>>>('/api/v1/edu/usercenter/addresses', data),

  updateAddress: (addressId: number, data: Record<string, unknown>) =>
    request.put<EduBaseResponse<Record<string, unknown>>>(
      `/api/v1/edu/usercenter/addresses/${addressId}`,
      data
    ),

  deleteAddress: (addressId: number) =>
    request.delete<EduBaseResponse<{ deleted: boolean }>>(
      `/api/v1/edu/usercenter/addresses/${addressId}`
    ),

  listAddresses: () =>
    request.get<EduBaseResponse<Record<string, unknown>[]>>('/api/v1/edu/usercenter/addresses/me'),

  getDefaultAddress: () =>
    request.get<EduBaseResponse<Record<string, unknown> | null>>(
      '/api/v1/edu/usercenter/addresses/me/default'
    ),
};

// ============================================================================
// P0: Setting API (7 endpoints)
// ============================================================================

export const settingApi = {
  get: (dictType: string, dictKey: string) =>
    request.get<EduBaseResponse<Record<string, unknown>>>(`/api/v1/edu/setting/dict/${dictType}/${dictKey}`),

  listByType: (dictType: string) =>
    request.get<EduBaseResponse<Record<string, unknown>[]>>(`/api/v1/edu/setting/dict/${dictType}`),

  batchGet: (dictTypes: string[]) =>
    request.post<EduBaseResponse<Record<string, Record<string, unknown>[]>>>(
      '/api/v1/edu/setting/dict/batch-get',
      { dict_types: dictTypes }
    ),

  create: (data: {
    dict_type: string;
    dict_key: string;
    dict_value: string;
    sort_order?: number;
    remark?: string;
  }) => request.post<EduBaseResponse<Record<string, unknown>>>('/api/v1/edu/setting/dict', data),

  update: (dictId: number, data: Record<string, unknown>) =>
    request.put<EduBaseResponse<Record<string, unknown>>>(`/api/v1/edu/setting/dict/${dictId}`, data),

  delete: (dictId: number) =>
    request.delete<EduBaseResponse<{ deleted: boolean }>>(`/api/v1/edu/setting/dict/${dictId}`),

  list: (params?: { page?: number; size?: number; dict_type?: string; keyword?: string }) =>
    request.get<EduBaseResponse<EduPaginatedResponse<Record<string, unknown>>>>(
      '/api/v1/edu/setting/dict',
      { params }
    ),
};

// ============================================================================
// P0: Content API (5 endpoints)
// ============================================================================

export const contentApi = {
  createArticle: (data: {
    title: string;
    content: string;
    summary?: string;
    cover?: string;
    category_id?: number;
    tags?: string;
  }) => request.post<EduBaseResponse<Record<string, unknown>>>('/api/v1/edu/content/articles', data),

  publishArticle: (articleId: number) =>
    request.put<EduBaseResponse<{ id: number; published_at: string }>>(
      `/api/v1/edu/content/articles/${articleId}/publish`
    ),

  getArticle: (articleId: number) =>
    request.get<EduBaseResponse<Record<string, unknown>>>(`/api/v1/edu/content/articles/${articleId}`),

  likeArticle: (articleId: number) =>
    request.post<EduBaseResponse<{ like_count: number }>>(
      `/api/v1/edu/content/articles/${articleId}/like`
    ),

  listArticles: (params?: {
    page?: number;
    size?: number;
    author_id?: number;
    category_id?: number;
    keyword?: string;
    order_by?: 'latest' | 'hot';
  }) =>
    request.get<EduBaseResponse<EduPaginatedResponse<Record<string, unknown>>>>(
      '/api/v1/edu/content/articles',
      { params }
    ),
};

// ============================================================================
// P0: Learn API (19 endpoints)
// ============================================================================

export const learnApi = {
  createCourse: (data: Partial<EduCourse> & { teacher_id: number; title: string }) =>
    request.post<EduBaseResponse<EduCourse>>('/api/v1/edu/learn/courses', data),

  updateCourse: (courseId: number, data: Partial<EduCourse>) =>
    request.put<EduBaseResponse<EduCourse>>(`/api/v1/edu/learn/courses/${courseId}`, data),

  deleteCourse: (courseId: number) =>
    request.delete<EduBaseResponse<{ deleted: boolean }>>(`/api/v1/edu/learn/courses/${courseId}`),

  getCourse: (courseId: number) =>
    request.get<EduBaseResponse<EduCourse>>(`/api/v1/edu/learn/courses/${courseId}`),

  listCourses: (params?: {
    page?: number;
    size?: number;
    category_id?: number;
    teacher_id?: number;
    is_free?: boolean;
    is_published?: boolean;
    keyword?: string;
    order_by?: 'latest' | 'hot' | 'rating';
  }) =>
    request.get<EduBaseResponse<EduPaginatedResponse<EduCourse>>>(
      '/api/v1/edu/learn/courses',
      { params }
    ),

  enrollCourse: (courseId: number) =>
    request.post<EduBaseResponse<EduCourse>>(`/api/v1/edu/learn/courses/${courseId}/enroll`),

  createChapter: (data: { course_id: number; title: string; parent_id?: number; sort_order?: number; description?: string }) =>
    request.post<EduBaseResponse<EduCourseChapter>>('/api/v1/edu/learn/chapters', data),

  listChapters: (courseId: number) =>
    request.get<EduBaseResponse<EduCourseChapter[]>>('/api/v1/edu/learn/chapters', {
      params: { course_id: courseId },
    }),

  deleteChapter: (chapterId: number) =>
    request.delete<EduBaseResponse<{ deleted: boolean }>>(`/api/v1/edu/learn/chapters/${chapterId}`),

  createSection: (data: {
    chapter_id: number;
    title: string;
    video_url?: string;
    duration_seconds?: number;
    resource_url?: string;
    sort_order?: number;
    is_free_preview?: boolean;
  }) => request.post<EduBaseResponse<EduCourseSection>>('/api/v1/edu/learn/sections', data),

  listSections: (chapterId: number) =>
    request.get<EduBaseResponse<EduCourseSection[]>>(`/api/v1/edu/learn/chapters/${chapterId}/sections`),

  updateProgress: (data: {
    course_id: number;
    section_id?: number;
    progress_seconds: number;
    total_seconds: number;
    last_position?: number;
  }) => request.post<EduBaseResponse<EduLearnRecord>>('/api/v1/edu/learn/progress', data),

  getMyProgress: (courseId: number) =>
    request.get<EduBaseResponse<EduLearnRecord[]>>(`/api/v1/edu/learn/courses/${courseId}/progress`),

  getCompletion: (courseId: number) =>
    request.get<EduBaseResponse<{
      user_id: number;
      course_id: number;
      total_sections: number;
      completed_sections: number;
      completion_percent: number;
    }>>(`/api/v1/edu/learn/courses/${courseId}/completion`),

  createHomework: (data: {
    course_id: number;
    title: string;
    description?: string;
    deadline?: string;
    max_score?: number;
    chapter_id?: number;
  }) => request.post<EduBaseResponse<Record<string, unknown>>>('/api/v1/edu/learn/homeworks', data),

  submitHomework: (homeworkId: number, data: { content?: string; attachment_url?: string }) =>
    request.post<EduBaseResponse<Record<string, unknown>>>(
      `/api/v1/edu/learn/homeworks/${homeworkId}/submit`,
      data
    ),

  gradeSubmission: (submissionId: number, data: { score: number; comment?: string }) =>
    request.post<EduBaseResponse<Record<string, unknown>>>(
      `/api/v1/edu/learn/submissions/${submissionId}/grade`,
      data
    ),

  issueCertificate: (data: { course_id: number; title: string; score?: number }) =>
    request.post<EduBaseResponse<EduCertificate>>('/api/v1/edu/learn/certificates/issue', data),

  myCertificates: () =>
    request.get<EduBaseResponse<EduCertificate[]>>('/api/v1/edu/learn/certificates/me'),
};

// ============================================================================
// P0: Exam API (13 endpoints)
// ============================================================================

export const examApi = {
  createPaper: (data: Partial<EduPaper> & { title: string }) =>
    request.post<EduBaseResponse<EduPaper>>('/api/v1/edu/exam/papers', data),

  publishPaper: (paperId: number) =>
    request.put<EduBaseResponse<EduPaper>>(`/api/v1/edu/exam/papers/${paperId}/publish`),

  getPaper: (paperId: number) =>
    request.get<EduBaseResponse<EduPaper>>(`/api/v1/edu/exam/papers/${paperId}`),

  listPapers: (params?: { page?: number; size?: number; course_id?: number; is_published?: boolean }) =>
    request.get<EduBaseResponse<EduPaginatedResponse<EduPaper>>>('/api/v1/edu/exam/papers', { params }),

  addQuestion: (data: Partial<EduQuestion> & { question_type: string; stem: string }) =>
    request.post<EduBaseResponse<EduQuestion>>('/api/v1/edu/exam/questions', data),

  listQuestions: (paperId: number) =>
    request.get<EduBaseResponse<EduQuestion[]>>(`/api/v1/edu/exam/papers/${paperId}/questions`),

  startExam: (paperId: number) =>
    request.post<EduBaseResponse<EduExamRecord>>('/api/v1/edu/exam/records', { paper_id: paperId }),

  submitExam: (recordId: number, answers: Record<number, string>) =>
    request.post<EduBaseResponse<EduExamRecord>>(`/api/v1/edu/exam/records/${recordId}/submit`, { answers }),

  getExamRecord: (recordId: number) =>
    request.get<EduBaseResponse<EduExamRecord>>(`/api/v1/edu/exam/records/${recordId}`),

  myExams: (params?: { page?: number; size?: number; status?: string }) =>
    request.get<EduBaseResponse<EduPaginatedResponse<EduExamRecord>>>(
      '/api/v1/edu/exam/records/me',
      { params }
    ),

  addWrongQuestion: (questionId: number) =>
    request.post<EduBaseResponse<Record<string, unknown>>>(
      `/api/v1/edu/exam/wrong-book/${questionId}`
    ),

  markMastered: (wrongBookId: number) =>
    request.post<EduBaseResponse<Record<string, unknown>>>(
      `/api/v1/edu/exam/wrong-book/${wrongBookId}/mastered`
    ),

  myWrongBook: (params?: { page?: number; size?: number; mastered?: boolean }) =>
    request.get<EduBaseResponse<EduPaginatedResponse<Record<string, unknown>>>>(
      '/api/v1/edu/exam/wrong-book/me',
      { params }
    ),
};

// ============================================================================
// P1: Ask API (13 endpoints, edu-unique)
// ============================================================================

export const askApi = {
  createQuestion: (data: { title: string; content: string; course_id?: number; tags?: string }) =>
    request.post<EduBaseResponse<EduAskQuestion>>('/api/v1/edu/ask/questions', data),

  listQuestions: (params?: {
    page?: number;
    size?: number;
    user_id?: number;
    course_id?: number;
    is_resolved?: boolean;
    keyword?: string;
    order_by?: 'latest' | 'hot' | 'unresolved';
  }) =>
    request.get<EduBaseResponse<EduPaginatedResponse<EduAskQuestion>>>(
      '/api/v1/edu/ask/questions',
      { params }
    ),

  hotQuestions: (limit = 10) =>
    request.get<EduBaseResponse<EduAskQuestion[]>>('/api/v1/edu/ask/questions/hot', {
      params: { limit },
    }),

  getQuestion: (questionId: number) =>
    request.get<EduBaseResponse<EduAskQuestion>>(`/api/v1/edu/ask/questions/${questionId}`),

  updateQuestion: (questionId: number, data: Partial<EduAskQuestion>) =>
    request.put<EduBaseResponse<EduAskQuestion>>(`/api/v1/edu/ask/questions/${questionId}`, data),

  deleteQuestion: (questionId: number) =>
    request.delete<EduBaseResponse<{ deleted: boolean }>>(`/api/v1/edu/ask/questions/${questionId}`),

  questionStats: (questionId: number) =>
    request.get<EduBaseResponse<Record<string, unknown>>>(
      `/api/v1/edu/ask/questions/${questionId}/stats`
    ),

  userStats: (userId: number) =>
    request.get<EduBaseResponse<Record<string, unknown>>>(`/api/v1/edu/ask/users/${userId}/stats`),

  createAnswer: (questionId: number, data: { content: string }) =>
    request.post<EduBaseResponse<EduAskAnswer>>(
      `/api/v1/edu/ask/questions/${questionId}/answers`,
      data
    ),

  listAnswers: (questionId: number, params?: { page?: number; size?: number; order_by?: 'best' | 'latest' }) =>
    request.get<EduBaseResponse<EduPaginatedResponse<EduAskAnswer>>>(
      `/api/v1/edu/ask/questions/${questionId}/answers`,
      { params }
    ),

  deleteAnswer: (answerId: number) =>
    request.delete<EduBaseResponse<{ deleted: boolean }>>(`/api/v1/edu/ask/answers/${answerId}`),

  adoptAnswer: (answerId: number) =>
    request.post<EduBaseResponse<EduAskAnswer>>(`/api/v1/edu/ask/answers/${answerId}/adopt`),

  likeAnswer: (answerId: number) =>
    request.post<EduBaseResponse<{ like_count: number }>>(`/api/v1/edu/ask/answers/${answerId}/like`),
};

// ============================================================================
// P1: Circle API (13 endpoints, edu-unique)
// ============================================================================

export const circleApi = {
  createCircle: (data: { name: string; description?: string; cover?: string; category?: string; is_public?: boolean }) =>
    request.post<EduBaseResponse<EduCircle>>('/api/v1/edu/circle/circles', data),

  listCircles: (params?: {
    page?: number;
    size?: number;
    category?: string;
    is_public?: boolean;
    keyword?: string;
    order_by?: 'latest' | 'hot';
  }) =>
    request.get<EduBaseResponse<EduPaginatedResponse<EduCircle>>>(
      '/api/v1/edu/circle/circles',
      { params }
    ),

  getCircle: (circleId: number) =>
    request.get<EduBaseResponse<EduCircle>>(`/api/v1/edu/circle/circles/${circleId}`),

  updateCircle: (circleId: number, data: Partial<EduCircle>) =>
    request.put<EduBaseResponse<EduCircle>>(`/api/v1/edu/circle/circles/${circleId}`, data),

  deleteCircle: (circleId: number) =>
    request.delete<EduBaseResponse<{ deleted: boolean }>>(`/api/v1/edu/circle/circles/${circleId}`),

  joinCircle: (circleId: number) =>
    request.post<EduBaseResponse<{ circle_id: number; user_id: number; role: string }>>(
      `/api/v1/edu/circle/circles/${circleId}/join`
    ),

  leaveCircle: (circleId: number) =>
    request.post<EduBaseResponse<{ left: boolean }>>(
      `/api/v1/edu/circle/circles/${circleId}/leave`
    ),

  listMembers: (circleId: number, params?: { page?: number; size?: number }) =>
    request.get<EduBaseResponse<EduPaginatedResponse<Record<string, unknown>>>>(
      `/api/v1/edu/circle/circles/${circleId}/members`,
      { params }
    ),

  createPost: (circleId: number, data: { content: string; images?: string[] }) =>
    request.post<EduBaseResponse<EduCirclePost>>(
      `/api/v1/edu/circle/circles/${circleId}/posts`,
      data
    ),

  listPosts: (circleId: number, params?: { page?: number; size?: number; order_by?: 'latest' | 'hot' }) =>
    request.get<EduBaseResponse<EduPaginatedResponse<EduCirclePost>>>(
      `/api/v1/edu/circle/circles/${circleId}/posts`,
      { params }
    ),

  deletePost: (postId: number) =>
    request.delete<EduBaseResponse<{ deleted: boolean }>>(`/api/v1/edu/circle/posts/${postId}`),

  likePost: (postId: number) =>
    request.post<EduBaseResponse<{ like_count: number }>>(`/api/v1/edu/circle/posts/${postId}/like`),

  userCircles: (userId: number, params?: { page?: number; size?: number }) =>
    request.get<EduBaseResponse<EduPaginatedResponse<EduCircle>>>(
      `/api/v1/edu/circle/users/${userId}/circles`,
      { params }
    ),
};

// ============================================================================
// P1: Pay/Order/Point/Message/Notification (transaction & comm)
// ============================================================================

export const payApi = {
  createPayOrder: (data: { order_id: number; pay_channel: string; installment_count?: number }) =>
    request.post<EduBaseResponse<Record<string, unknown>>>('/api/v1/edu/pay/pay-orders', data),

  markPaid: (payOrderId: number, data: { transaction_id: string }) =>
    request.post<EduBaseResponse<Record<string, unknown>>>(
      `/api/v1/edu/pay/pay-orders/${payOrderId}/mark-paid`,
      data
    ),

  myPayments: (params?: { page?: number; size?: number; pay_status?: string }) =>
    request.get<EduBaseResponse<EduPaginatedResponse<Record<string, unknown>>>>(
      '/api/v1/edu/pay/pay-orders/me',
      { params }
    ),
};

export const orderApi = {
  createOrder: (data: { order_type: string; items: Array<{ entity_id: number; quantity: number; price: number }>; discount_amount?: number; remark?: string }) =>
    request.post<EduBaseResponse<EduOrder>>('/api/v1/edu/order/orders', data),

  cancelOrder: (orderId: number) =>
    request.post<EduBaseResponse<EduOrder>>(`/api/v1/edu/order/orders/${orderId}/cancel`),

  refundOrder: (orderId: number, amount: number) =>
    request.post<EduBaseResponse<EduOrder>>(`/api/v1/edu/order/orders/${orderId}/refund`, { amount }),

  getOrder: (orderId: number) =>
    request.get<EduBaseResponse<EduOrder>>(`/api/v1/edu/order/orders/${orderId}`),

  myOrders: (params?: { page?: number; size?: number; status?: string; order_type?: string }) =>
    request.get<EduBaseResponse<EduPaginatedResponse<EduOrder>>>(
      '/api/v1/edu/order/orders/me',
      { params }
    ),
};

export const pointApi = {
  earn: (data: { amount: number; source: string; remark?: string }) =>
    request.post<EduBaseResponse<EduPointAccount>>('/api/v1/edu/point/points/earn', data),

  spend: (data: { amount: number; source: string; remark?: string }) =>
    request.post<EduBaseResponse<EduPointAccount>>('/api/v1/edu/point/points/spend', data),

  myAccount: () =>
    request.get<EduBaseResponse<EduPointAccount>>('/api/v1/edu/point/points/me'),

  myRecords: (params?: { page?: number; size?: number; change_type?: string }) =>
    request.get<EduBaseResponse<EduPaginatedResponse<Record<string, unknown>>>>(
      '/api/v1/edu/point/points/records',
      { params }
    ),
};

export const messageApi = {
  send: (data: { receiver_id: number; msg_type?: string; title?: string; content: string }) =>
    request.post<EduBaseResponse<Record<string, unknown>>>('/api/v1/edu/message/messages', data),

  markRead: (messageId: number) =>
    request.post<EduBaseResponse<Record<string, unknown>>>(
      `/api/v1/edu/message/messages/${messageId}/read`
    ),

  inbox: (params?: { page?: number; size?: number; is_read?: boolean; msg_type?: string }) =>
    request.get<EduBaseResponse<EduPaginatedResponse<Record<string, unknown>>>>(
      '/api/v1/edu/message/messages/inbox',
      { params }
    ),

  unreadCount: () =>
    request.get<EduBaseResponse<{ unread_count: number }>>('/api/v1/edu/message/messages/unread-count'),
};

export const notificationApi = {
  send: (data: { user_id: number; template_code: string; channel: string; title: string; content: string; payload?: Record<string, unknown> }) =>
    request.post<EduBaseResponse<Record<string, unknown>>>('/api/v1/edu/notification/notifications', data),

  batchSend: (data: { user_ids: number[]; template_code: string; channel: string; title: string; content: string; payload?: Record<string, unknown> }) =>
    request.post<EduBaseResponse<{ count: number }>>('/api/v1/edu/notification/notifications/batch', data),

  myNotifications: (params?: { page?: number; size?: number; is_sent?: boolean; template_code?: string }) =>
    request.get<EduBaseResponse<EduPaginatedResponse<Record<string, unknown>>>>(
      '/api/v1/edu/notification/notifications/me',
      { params }
    ),
};

// ============================================================================
// P2: Live/OSS/Search/Schedule/Behavior/VisitTracking
// ============================================================================

export const liveApi = {
  createRoom: (data: {
    title: string;
    teacher_id: number;
    course_id?: number;
    description?: string;
    cover?: string;
    scheduled_start: string;
    scheduled_end: string;
    max_attendees?: number;
  }) => request.post<EduBaseResponse<EduLiveRoom>>('/api/v1/edu/live/rooms', data),

  startLive: (roomId: number) =>
    request.post<EduBaseResponse<EduLiveRoom>>(`/api/v1/edu/live/rooms/${roomId}/start`),

  endLive: (roomId: number, data: { playback_url?: string }) =>
    request.post<EduBaseResponse<EduLiveRoom>>(`/api/v1/edu/live/rooms/${roomId}/end`, data),

  joinLive: (roomId: number) =>
    request.post<EduBaseResponse<Record<string, unknown>>>(
      `/api/v1/edu/live/rooms/${roomId}/join`
    ),

  leaveLive: (roomId: number) =>
    request.post<EduBaseResponse<Record<string, unknown>>>(
      `/api/v1/edu/live/rooms/${roomId}/leave`
    ),

  getRoom: (roomId: number) =>
    request.get<EduBaseResponse<EduLiveRoom>>(`/api/v1/edu/live/rooms/${roomId}`),

  listRooms: (params?: { page?: number; size?: number; teacher_id?: number; status?: string }) =>
    request.get<EduBaseResponse<EduPaginatedResponse<EduLiveRoom>>>(
      '/api/v1/edu/live/rooms',
      { params }
    ),

  listAttendees: (roomId: number, params?: { page?: number; size?: number }) =>
    request.get<EduBaseResponse<EduPaginatedResponse<Record<string, unknown>>>>(
      `/api/v1/edu/live/rooms/${roomId}/attendees`,
      { params }
    ),
};

export const searchApi = {
  index: (data: { entity_type: string; entity_id: number; title: string; content?: string; tags?: string; boost?: number }) =>
    request.post<EduBaseResponse<Record<string, unknown>>>('/api/v1/edu/search/index', data),

  search: (params: { q: string; entity_type?: string; page?: number; size?: number }) =>
    request.get<EduBaseResponse<EduPaginatedResponse<Record<string, unknown>>>>(
      '/api/v1/edu/search/search',
      { params }
    ),

  deleteIndex: (entityType: string, entityId: number) =>
    request.delete<EduBaseResponse<{ deleted: boolean }>>(
      `/api/v1/edu/search/index/${entityType}/${entityId}`
    ),
};

// ============================================================================
// All-in-one export
// ============================================================================

export const eduApi = {
  auth: authApi,
  member: memberApi,
  userCenter: userCenterApi,
  setting: settingApi,
  content: contentApi,
  learn: learnApi,
  exam: examApi,
  ask: askApi,
  circle: circleApi,
  pay: payApi,
  order: orderApi,
  point: pointApi,
  message: messageApi,
  notification: notificationApi,
  live: liveApi,
  oss: {} as Record<string, never>,  // OSS multipart not yet wrapped in TS (heavy)
  search: searchApi,
  schedule: {} as Record<string, never>,
  behavior: {} as Record<string, never>,
  visitTracking: {} as Record<string, never>,
  resource: {} as Record<string, never>,
};

export default eduApi;