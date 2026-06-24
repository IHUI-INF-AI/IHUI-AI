/**
 * Edu domain shared TypeScript types.
 *
 * Mirrors server-side edu_models.py / edu_schemas.py so web + h5 + miniapp
 * can consume the same contracts.
 */

// ============================================================================
// Auth types
// ============================================================================

export interface EduUser {
  id: number
  username: string
  nickname?: string
  avatar?: string
  email?: string
  phone?: string
  gender?: 'M' | 'F' | 'U'
  status?: number
  created_at?: string
  last_login_at?: string
}

export interface EduAuthTokens {
  access_token: string
  refresh_token: string
  expires_in?: number
  user?: EduUser
}

// ============================================================================
// Member
// ============================================================================

export type EduMemberType = 'student' | 'teacher' | 'parent'

export interface EduMember {
  id: number
  user_id: number
  member_no?: string
  real_name?: string
  id_card?: string
  member_type: EduMemberType
  school?: string
  grade?: string
  class_name?: string
  student_no?: string
  points: number
  level: number
  expire_at?: string
}

// ============================================================================
// Learn
// ============================================================================

export type EduDifficulty = 'beginner' | 'intermediate' | 'advanced'

export interface EduCourse {
  id: number
  title: string
  subtitle?: string
  cover?: string
  description?: string
  teacher_id: number
  category_id?: number
  price: number
  original_price?: number
  student_count: number
  lesson_count: number
  duration_minutes: number
  difficulty?: EduDifficulty
  is_free: boolean
  is_published: boolean
  published_at?: string
  rating?: number
  created_at?: string
}

export interface EduCourseChapter {
  id: number
  course_id: number
  parent_id?: number
  title: string
  sort_order: number
  description?: string
}

export interface EduCourseSection {
  id: number
  chapter_id: number
  course_id: number
  title: string
  video_url?: string
  duration_seconds: number
  resource_url?: string
  sort_order: number
  is_free_preview: boolean
}

export interface EduLearnRecord {
  id: number
  user_id: number
  course_id: number
  section_id?: number
  progress_seconds: number
  total_seconds: number
  progress_percent: number
  is_completed: boolean
  completed_at?: string
  last_position?: number
}

export interface EduCertificate {
  id: number
  certificate_no: string
  user_id: number
  course_id: number
  title: string
  issue_date: string
  expire_date?: string
  pdf_url?: string
  score?: number
}

// ============================================================================
// Exam
// ============================================================================

export type EduQuestionType = 'single' | 'multi' | 'judge' | 'fill' | 'essay'
export type EduExamStatus = 'in_progress' | 'submitted' | 'graded'

export interface EduPaper {
  id: number
  title: string
  course_id?: number
  description?: string
  duration_minutes: number
  total_score: number
  pass_score: number
  question_count: number
  difficulty?: EduDifficulty
  is_published: boolean
}

export interface EduQuestion {
  id: number
  paper_id?: number
  question_type: EduQuestionType
  stem: string
  options?: string[]
  correct_answer?: string
  analysis?: string
  score: number
  difficulty?: EduDifficulty
  tags?: string
}

export interface EduExamRecord {
  id: number
  user_id: number
  paper_id: number
  start_at: string
  submit_at?: string
  duration_seconds: number
  score?: number
  is_passed?: boolean
  status: EduExamStatus
}

// ============================================================================
// Ask (edu-unique)
// ============================================================================

export interface EduAskQuestion {
  id: number
  user_id: number
  title: string
  content: string
  course_id?: number
  tags?: string
  view_count: number
  answer_count: number
  is_resolved: boolean
  best_answer_id?: number
  created_at: string
}

export interface EduAskAnswer {
  id: number
  question_id: number
  user_id: number
  content: string
  is_best: boolean
  like_count: number
  adopted_at?: string
  created_at: string
}

// ============================================================================
// Circle (edu-unique)
// ============================================================================

export type EduCircleCategory = 'class' | 'interest' | 'study'
export type EduCircleMemberRole = 'owner' | 'admin' | 'member'

export interface EduCircle {
  id: number
  owner_id: number
  name: string
  description?: string
  cover?: string
  category?: EduCircleCategory
  is_public: boolean
  member_count: number
  post_count: number
  created_at: string
}

export interface EduCirclePost {
  id: number
  circle_id: number
  user_id: number
  content: string
  images?: string[]
  like_count: number
  comment_count: number
  created_at: string
}

export interface EduCircleMember {
  id: number
  circle_id: number
  user_id: number
  role: EduCircleMemberRole
  joined_at: string
}

// ============================================================================
// Order / Pay / Point
// ============================================================================

export type EduOrderType = 'course' | 'card' | 'package'
export type EduOrderStatus = 'pending' | 'paid' | 'cancelled' | 'refunded'
export type EduPayChannel = 'wechat' | 'alipay' | 'installment' | 'balance'

export interface EduOrder {
  id: number
  order_no: string
  user_id: number
  order_type: EduOrderType
  total_amount: number
  paid_amount: number
  discount_amount: number
  status: EduOrderStatus
  pay_method?: EduPayChannel
  paid_at?: string
  expire_at?: string
  remark?: string
  created_at: string
}

export interface EduPayOrder {
  id: number
  order_id: number
  pay_channel: EduPayChannel
  pay_amount: number
  pay_status: 'pending' | 'paid' | 'failed' | 'refunded'
  transaction_id?: string
  paid_at?: string
  installment_count?: number
}

export interface EduPointAccount {
  user_id: number
  balance: number
  frozen: number
  total_earned: number
  total_spent: number
}

export type EduPointChangeType = 'earn' | 'spend' | 'freeze' | 'unfreeze'

export interface EduPointRecord {
  id: number
  user_id: number
  change_type: EduPointChangeType
  amount: number
  balance_after: number
  source: string
  remark?: string
  created_at: string
}

// ============================================================================
// Live / Message / Notification
// ============================================================================

export type EduLiveStatus = 'scheduled' | 'live' | 'ended' | 'cancelled'

export interface EduLiveRoom {
  id: number
  title: string
  teacher_id: number
  course_id?: number
  description?: string
  cover?: string
  scheduled_start: string
  scheduled_end: string
  actual_start?: string
  actual_end?: string
  status: EduLiveStatus
  stream_url?: string
  playback_url?: string
  attendee_count: number
  max_attendees: number
}

export type EduMessageType = 'system' | 'private' | 'group'

export interface EduMessage {
  id: number
  sender_id?: number
  receiver_id: number
  msg_type: EduMessageType
  title?: string
  content: string
  is_read: boolean
  read_at?: string
  created_at: string
}

export type EduNotificationChannel = 'in_app' | 'sms' | 'email' | 'push'

export interface EduNotification {
  id: number
  user_id: number
  template_code: string
  channel: EduNotificationChannel
  title: string
  content: string
  payload?: Record<string, unknown>
  is_sent: boolean
  sent_at?: string
  created_at: string
}

// ============================================================================
// Common API response types
// ============================================================================

export interface EduBaseResponse<T = unknown> {
  code: number
  msg?: string
  data?: T
}

export interface EduPaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  size: number
  pages?: number
}

export interface EduQueryParams {
  page?: number
  size?: number
  keyword?: string
  order_by?: string
  [key: string]: unknown
}