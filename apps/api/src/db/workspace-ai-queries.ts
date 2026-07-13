import { db } from './index.js'
import { workspaceAiTasks, type WorkspaceAiTask } from '@ihui/database'

export interface CreateWorkspaceAiTaskInput {
  userId: string
  type: string
  input?: string | null
  output?: string | null
  status?: number
}

export async function createWorkspaceAiTask(
  data: CreateWorkspaceAiTaskInput,
): Promise<WorkspaceAiTask> {
  const rows = await db
    .insert(workspaceAiTasks)
    .values({
      userId: data.userId,
      type: data.type,
      input: data.input,
      output: data.output,
      status: data.status ?? 0,
    })
    .returning()
  const row = rows[0]
  if (!row) throw new Error('创建 workspace-ai 任务失败')
  return row
}
