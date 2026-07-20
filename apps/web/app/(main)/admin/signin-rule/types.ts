export type SigninRuleStatus = 'draft' | 'pending' | 'published' | 'rejected'

export interface SigninRule {
  id: string
  day: number
  points: number
  extra: number
  status: SigninRuleStatus
}

export interface SigninRuleListData {
  list: SigninRule[]
  total: number
}
