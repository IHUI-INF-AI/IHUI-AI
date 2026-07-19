export type JobLogStatus = 'success' | 'fail' | 'running'

export interface JobLog {
  jobLogId: string | number
  jobName: string
  jobGroup: string
  invokeTarget: string
  jobMessage?: string
  status?: string
  createTime?: string
  exceptionInfo?: string
  startTime?: string
  endTime?: string
  duration?: number
}

export interface JobLogFilter {
  jobName: string
  jobGroup: string
  status: 'all' | JobLogStatus
  startDate: string
  endDate: string
  page: number
  pageSize: number
}

export type JobLogSearch = Omit<JobLogFilter, 'page' | 'pageSize'>
