// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * AI 工作台「项目详情」屏的形状单源（web `workspace/[id]` ↔ RN `AiWorkspaceProject`）。
 *
 * 2026-10-28 立：工单 `web-rn-gap:workspace/[id]`（gap-tickets.jsonl 第 11 行）判定 RN 无此屏。
 * web 页把字段拆在 `PageClient.tsx` + `ProjectHeader.tsx` + `FilesSection.tsx` +
 * `components/workspace/file-list.tsx` 四处各写一份，这里收成一份，共享屏
 * `packages/app/src/features/ai-workspace/AiWorkspaceProjectScreen.tsx` 直取。
 *
 * ⚠️ 端点现状（读 apps/api/src/routes/workspace.ts 实测）：
 * - `GET /api/workspace/projects/:id` → `success({ project })`，`project` 由 `serializeProject`
 *   产出：`{ id, userId, name, description, status, createdAt, updatedAt }`（**无** fileCount /
 *   memberCount / members / tasks）。
 * - `GET /api/workspace/projects/:id/files` → `success({ files })`，`serializeFile` 产出
 *   `{ id, projectId, name, size, mimeType, uploadedBy, createdAt }`。
 * - `DELETE /api/workspace/files/:id` → 软删除（进回收站），`success({ deleted })`。
 * - `POST /api/files/:id/convert-markdown` → `success({ markdown, fileName })`，失败 422。
 * - **成员 / 任务没有后端端点**：web 的「任务清单 / 例行程序 / 文件夹」三卡读的是页面内
 *   `helpers.ts` 的 `AI_MOCK` 假数据，`AIWorkspaceTabs.tsx` 直接渲染 mock。故本文件的
 *   `member` / `task` 形状按契约目标声明，宿主拿不到就传空数组，**不得编造**。
 */
import type { TFunction } from './app-shared.js'

/** 项目详情（web `ProjectHeader` 消费的 ProjectDetail + 后端 serializeProject 的超集） */
export interface AiWorkspaceProject {
  id: string
  name: string
  /** 后端把 NULL 归一成 ''；屏上为空则回退到「项目描述」占位文案 */
  description?: string | null
  /** 后端 status（1 正常）；本屏不渲染，留给后续切片 */
  status?: number | null
  /** 列表端点才带（`GET /projects` 的 fileCount）；详情端点没有，宿主可传文件数兜底 */
  fileCount?: number | null
  /** 同上：后端无成员计数，缺省按成员数组长度兜底 */
  memberCount?: number | null
  createdAt?: string | null
  updatedAt?: string | null
}

/** 项目成员（后端无端点；web 侧栏的「{count} 名成员」来自 GET /projects 的同名字段） */
export interface AiWorkspaceMember {
  id: string
  name: string
  /** 角色（owner / editor / viewer 等）；后端未给就不渲染这一行 */
  role?: string | null
}

/** 项目任务（后端无端点；web AIWorkspaceTabs 的 mock 形状，此处只留屏上真要渲染的三列） */
export interface AiWorkspaceTask {
  id: string
  title: string
  /** 状态原值（todo / in-progress / done …）；认不出就原样显示，不猜 */
  status?: string | null
  /** 优先级原值（low / medium / high …） */
  priority?: string | null
  /** 负责人昵称 */
  assignee?: string | null
}

/** 项目文件（对齐后端 serializeFile，去掉本屏不用的 projectId / uploadedBy） */
export interface AiWorkspaceFile {
  id: string
  name: string
  size?: number | null
  mimeType?: string | null
  createdAt?: string | null
}

/** 转 Markdown 结果（对齐 `POST /api/files/:id/convert-markdown` 的 success 载荷） */
export interface AiWorkspaceConvertResult {
  markdown: string
  fileName: string
}

/**
 * AiWorkspaceProjectScreen 受控 props 契约。
 * 取数、登录态、上传/删除/转换的副作用全在宿主 wrapper；共享屏只渲染 + 回调。
 */
export interface AiWorkspaceProjectScreenProps {
  t: TFunction
  /** 项目详情；`null` + 非 loading 且无 error ⇒ 渲染「项目不存在」 */
  project: AiWorkspaceProject | null
  /** 成员；缺省空数组 ⇒ 渲染「暂无成员」 */
  members?: AiWorkspaceMember[]
  /** 任务；缺省空数组 ⇒ 渲染「暂无任务」 */
  tasks?: AiWorkspaceTask[]
  /** 文件；缺省空数组 ⇒ 渲染「暂无文件」 */
  files?: AiWorkspaceFile[]
  /** 项目详情首屏加载中（整屏骨架） */
  loading: boolean
  /** 项目详情加载失败文案（非空渲染错误态 + 重试） */
  error: string
  /** 文件列表加载中（只影响文件区，不遮整屏） */
  filesLoading?: boolean
  /** 文件列表加载失败文案 */
  filesError?: string
  /** 上传中（禁用上传键 + 文案切换） */
  uploading?: boolean
  /** 上传失败文案（web 在文件区顶部显示后端具体原因） */
  uploadError?: string
  /** 删除失败文案 */
  deleteError?: string
  /** 正在删除的文件 id（逐行禁用） */
  removingFileId?: string | null
  /** 正在转换的文件 id（逐行禁用 + 文案切换） */
  convertingFileId?: string | null
  /** 转换失败文案（web `convertMarkdownFailed: <后端原因>`） */
  convertError?: string
  /** 最近一次转换结果；非空则渲染结果卡（web 用弹窗，RN 用同屏卡片） */
  convertResult?: AiWorkspaceConvertResult | null
  /** 顶部返回 */
  onBack: () => void
  /** 项目详情错误态重试 / 不存在时重新拉取 */
  onRetry: () => void
  /** 文件区重试（未接线则不渲染重试入口） */
  onRetryFiles?: () => void
  /** 选择并上传文件（未接线则不渲染上传键） */
  onUpload?: () => void
  /** 删除文件（二次确认由宿主做，共享屏直接触发） */
  onRemove?: (file: AiWorkspaceFile) => void
  /** 转 Markdown（未接线则不渲染该键） */
  onConvert?: (file: AiWorkspaceFile) => void
  /** 关闭转换结果卡（未接线则不渲染关闭键） */
  onCloseConvertResult?: () => void
  colorScheme?: 'light' | 'dark'
}
