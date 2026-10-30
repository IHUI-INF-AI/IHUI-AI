// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { fetchApi } from '../client.js'

/**
 * 工作区「项目详情」出口(2026-10-27 立,Wave3 补屏 Q5 席位)。
 *
 * 为什么不复用既有 `endpoints/workspace.ts`(两条硬理由,现读该文件而非猜测):
 *  1. 该文件的 `getFiles`(workspace.ts:134-141)把 `GET /api/workspace/projects/:id/files`
 *     的 data 声明成 `PageData<WorkspaceFile>`,而后端实际发的是 `success({ files })`
 *     (apps/api/src/routes/workspace.ts:349-350)⇒ 按既有声明读 `data.list` 恒空。
 *     这里的类型按**后端实际信封**声明,不去改别人的件。
 *  2. 该文件没有「项目详情」封装(`GET /api/workspace/projects/:id`),而本屏第一屏数据就是它。
 *
 * 后端契约(apps/api/src/routes/workspace.ts,经 routes/index.ts:563 以 prefix `/api/workspace` 注册):
 *  - GET    /api/workspace/projects/:id       → 200 success({ project })   (workspace.ts:264-279)
 *      非本人项目 403、不存在 404(workspace.ts:271-276)。
 *  - GET    /api/workspace/projects/:id/files → 200 success({ files })     (workspace.ts:335-351)
 *      鉴权档同上(403/404),文件行形状见 serializeFile(workspace.ts:125-148):
 *      `{ id, projectId, name, size(字节,已 Number 化), mimeType, uploadedBy, createdAt }`,
 *      **不含 path**(2026-09-23 出口剥盘路径,同文件 :150-153 注释)。
 *  - DELETE /api/workspace/files/:id          → 200 success({ deleted })    (workspace.ts:653-690)
 *      软删除(移入回收站),仅项目 owner 可删(workspace.ts:681-684)。
 */

/** 项目详情(GET /api/workspace/projects/:id → data.project) */
export interface WorkspaceProjectDetail {
  id: string
  userId: string
  name: string
  description: string
  /** 后端 serializeProject 把 null 归一为 1(workspace.ts:118) */
  status: number
  createdAt: string
  updatedAt: string
  fileCount?: number
}

/** 项目文件行(GET /api/workspace/projects/:id/files → data.files[]) */
export interface WorkspaceProjectFile {
  id: string
  projectId: string
  name: string
  /** 字节数 */
  size: number
  mimeType: string
  uploadedBy: string | null
  createdAt: string
}

/** 取项目详情 */
export function fetchWorkspaceProject(projectId: string) {
  return fetchApi<{ project: WorkspaceProjectDetail }>(
    `/api/workspace/projects/${encodeURIComponent(projectId)}`,
  )
}

/** 取项目文件列表(裸 `{ files }`,不是分页信封) */
export function fetchWorkspaceProjectFiles(projectId: string) {
  return fetchApi<{ files: WorkspaceProjectFile[] }>(
    `/api/workspace/projects/${encodeURIComponent(projectId)}/files`,
  )
}

/** 软删除一个文件(移入回收站;返回 deleted 表示库确实改了行) */
export function deleteWorkspaceProjectFile(fileId: string) {
  return fetchApi<{ deleted: boolean }>(`/api/workspace/files/${encodeURIComponent(fileId)}`, {
    method: 'DELETE',
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
