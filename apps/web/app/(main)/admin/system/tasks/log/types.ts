export interface JobLog {
  id: string
  jobName: string
  jobGroup: string
  invokeTarget: string
  jobMessage: string
  status: number
  exceptionInfo: string
  startTime: string
  stopTime: string
  costTime: number
}

export interface ListResp {
  list: JobLog[]
  total: number
}

export interface SearchState {
  jobName: string
  jobGroup: string
  status: string
}

export interface SortState {
  col: string
  dir: 'asc' | 'desc'
}
