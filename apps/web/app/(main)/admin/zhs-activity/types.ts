export interface ZhsActivity {
  id: string
  activityName: string | null
  activityRule: string | null
  activityRecharge: string | null
  beginAmount: string | null
  multiple: string | null
  computing: string | null
  beginTime: string | null
  endTime: string | null
  status: number
}

export interface ListData {
  list: ZhsActivity[]
  total: number
}

export interface ZhsActivityForm {
  activityName: string
  activityRule: string
  activityRecharge: string
  beginAmount: string
  multiple: string
  computing: string
  beginTime: string
  endTime: string
  status: boolean
}
