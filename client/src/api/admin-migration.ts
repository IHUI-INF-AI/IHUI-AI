import { request } from '@/utils/request'

const PREFIX = '/api/admin/migration'

export interface BatchInfo {
  batch_id: string
  description: string
  depends_on: string[]
  task_count: number
  done_count: number
  running_count: number
  failed_count: number
  total_rows: number
  migrated_rows: number
}

export interface MigrateRequest {
  batch_id: string
  task_source_table?: string
  restart?: boolean
  dry_run?: boolean
}

export interface CheckpointInfo {
  source_table: string
  target_table: string
  status: string
  last_pk: string
  total_rows: number
  migrated_rows: number
  error_msg?: string
  started_at?: string
  finished_at?: string
  updated_at?: string
}

export interface TableVerifyInfo {
  source_table: string
  target_table: string
  h_count: number
  g_count: number
  ratio: number
  ok: boolean
}

export async function listBatches(): Promise<BatchInfo[]> {
  const res = await request.get<BatchInfo[]>(`${PREFIX}/batches`)
  return res.data
}

export function runMigration(req: MigrateRequest) {
  return request.post(`${PREFIX}/run`, req)
}

export async function verifyBatch(batchId: string): Promise<{ batch_id: string; tables: TableVerifyInfo[] }> {
  const res = await request.get<{ batch_id: string; tables: TableVerifyInfo[] }>(
    `${PREFIX}/verify/${batchId}`,
  )
  return res.data
}

export function rollbackBatch(batchId: string, confirm = true) {
  return request.post(
    `${PREFIX}/rollback/${batchId}?confirm=${confirm}`,
  )
}

export async function listCheckpoints(batchId: string): Promise<CheckpointInfo[]> {
  const res = await request.get<CheckpointInfo[]>(
    `${PREFIX}/checkpoints/${batchId}`,
  )
  return res.data
}

export function getHealth() {
  return request.get(`${PREFIX}/health`)
}
