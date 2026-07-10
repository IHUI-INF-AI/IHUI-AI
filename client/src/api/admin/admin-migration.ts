import type { Recordable } from '@/types'

export interface BatchInfo {
  batch_id: string
  status?: string
  started_at?: string
  finished_at?: string
  total_tables?: number
  processed_tables?: number
  task_count: number
  done_count: number
  failed_count: number
  running_count: number
  migrated_rows: number
  total_rows: number
  description?: string
  [key: string]: unknown
}

export interface CheckpointInfo {
  checkpoint_id: string
  batch_id?: string
  created_at?: string
  description?: string
  source_table?: string
  target_table?: string
  status?: string
  migrated_rows?: number
  total_rows?: number
  last_pk?: string
  updated_at?: string
  error_msg?: string
  [key: string]: unknown
}

export interface TableVerifyInfo {
  table_name: string
  row_count?: number
  status?: string
  source_table?: string
  target_table?: string
  h_count?: number
  g_count?: number
  ok?: boolean
  ratio?: number | string
  [key: string]: unknown
}

export function getHealth(): Promise<Recordable> {
  return Promise.resolve({})
}
export function listBatches(params?: Recordable): Promise<BatchInfo[]> {
  return Promise.resolve([])
}
export function listCheckpoints(batchId: string): Promise<CheckpointInfo[]> {
  return Promise.resolve([])
}
export function rollbackBatch(batchId: string, checkpointId?: string): Promise<void> {
  return Promise.resolve()
}
export function runMigration(params?: Recordable): Promise<{ msg: string; data: { pid: number; log_file: string } }> {
  return Promise.resolve({ msg: '', data: { pid: 0, log_file: '' } })
}
export function verifyBatch(batchId: string): Promise<{ batch_id: string; tables: TableVerifyInfo[] }> {
  return Promise.resolve({ batch_id: batchId, tables: [] })
}
