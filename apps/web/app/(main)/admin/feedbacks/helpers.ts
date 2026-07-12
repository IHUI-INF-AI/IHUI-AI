import type { FeedbackType, FeedbackStatus, Priority } from '@/lib/feedback'
import type { CreateForm, EditForm, SearchState } from './types'

export const PAGE_SIZE = 10

export const EMPTY_SEARCH: SearchState = { title: '', creator: '', createdAt: '' }

export const EMPTY_EDIT_FORM: EditForm = { status: 'pending', priority: 'low', adminReply: '' }

export const TYPE_TABS: { value: string; labelKey: 'all' | FeedbackType }[] = [
  { value: 'all', labelKey: 'all' },
  { value: 'bug', labelKey: 'bug' },
  { value: 'feature', labelKey: 'feature' },
  { value: 'improvement', labelKey: 'improvement' },
  { value: 'other', labelKey: 'other' },
]

export const STATUS_TABS: { value: string; labelKey: 'all' | FeedbackStatus }[] = [
  { value: 'all', labelKey: 'all' },
  { value: 'pending', labelKey: 'pending' },
  { value: 'reviewing', labelKey: 'reviewing' },
  { value: 'resolved', labelKey: 'resolved' },
  { value: 'closed', labelKey: 'closed' },
]

export const STATUS_OPTIONS: FeedbackStatus[] = ['pending', 'reviewing', 'resolved', 'closed']
export const PRIORITY_OPTIONS: Priority[] = ['low', 'medium', 'high']

export const EMPTY_CREATE: CreateForm = {
  title: '',
  context: '',
  filePath: '',
  isDel: '0',
  feedback: '',
  feedbackPath: '',
}

export const EXPORT_COLUMNS = [
  { key: 'id', title: 'ID' },
  { key: 'title', title: '标题' },
  { key: 'context', title: '内容' },
  { key: 'filePath', title: '图片' },
  { key: 'status', title: '状态' },
  { key: 'feedback', title: '反馈' },
  { key: 'feedbackPath', title: '反馈图片' },
  { key: 'creator', title: '创建人' },
  { key: 'createdAt', title: '创建时间' },
]

export const selectClass =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export const textareaClass =
  'flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export const inputSm =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
