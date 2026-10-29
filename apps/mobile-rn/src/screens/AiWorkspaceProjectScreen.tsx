// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useState } from 'react'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import * as DocumentPicker from 'expo-document-picker'
import { fetchApi } from '@ihui/api-client'
import { apiFailureToText } from '@ihui/shared/utils'
import {
  AiWorkspaceProjectScreen as SharedAiWorkspaceProjectScreen,
  type AiWorkspaceConvertResult,
  type AiWorkspaceFile,
  type AiWorkspaceMember,
  type AiWorkspaceProject,
} from '@ihui/rn-app'
import { appAlert } from '../components/BottomPops'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'

/**
 * 路由参数就地声明：`RootNavigator.tsx` 的 `RootStackParamList` 登记属于本屏的共享文件补丁
 * （见 crossend-reg-AiWorkspaceProjectScreen.md 的 (b2)），本切片不得改那支文件。
 * 在补丁落盘前若直接 `RouteProp<RootStackParamList, 'AiWorkspaceProject'>`，隔离 typecheck 会
 * 报 TS2344；故这里用局部 ParamList，补丁落盘后行为等价。
 */
type AiWorkspaceProjectRouteParams = { id: string }
type Route = RouteProp<{ AiWorkspaceProject: AiWorkspaceProjectRouteParams }, 'AiWorkspaceProject'>

/** 后端 `serializeProject` 的裸行（额外容错 `members` —— 现网没有，未来加了也不炸） */
interface RawProject {
  id?: string | number | null
  name?: string | null
  description?: string | null
  status?: number | null
  fileCount?: number | null
  memberCount?: number | null
  members?: RawMember[] | null
  createdAt?: string | null
  updatedAt?: string | null
}

interface RawMember {
  id?: string | number | null
  name?: string | null
  nickname?: string | null
  role?: string | null
}

/** 后端 `serializeFile` 的裸行（size 是 number；防御 bigint/字符串形态） */
interface RawFile {
  id?: string | number | null
  name?: string | null
  size?: number | string | null
  mimeType?: string | null
  createdAt?: string | null
}

/**
 * 两种回包形态都认：`{ project }`（apps/api/src/routes/workspace.ts:264-280 现网实回）
 * 与直接的项目对象（未来若改直出）。取不到就 null —— 由共享屏渲染「项目不存在」。
 */
interface ProjectPayload {
  project?: RawProject | null
  members?: RawMember[] | null
}

interface FilesPayload {
  files?: RawFile[] | null
}

interface ConvertPayload {
  markdown?: string | null
  fileName?: string | null
}

function toStr(value: string | number | null | undefined): string {
  return value === undefined || value === null ? '' : String(value)
}

function toNum(value: number | string | null | undefined): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value)
    if (Number.isFinite(n)) return n
  }
  return null
}

/** 裸行 → 屏形状；id 与 name 全空视为没有这条数据（不塞一个空壳卡片） */
function normalizeProject(raw: RawProject | null | undefined): AiWorkspaceProject | null {
  if (!raw || typeof raw !== 'object') return null
  const id = toStr(raw.id)
  const name = typeof raw.name === 'string' ? raw.name : ''
  if (!id && !name) return null
  return {
    id,
    name,
    description: raw.description ?? null,
    status: toNum(raw.status),
    fileCount: toNum(raw.fileCount),
    memberCount: toNum(raw.memberCount),
    createdAt: raw.createdAt ?? null,
    updatedAt: raw.updatedAt ?? null,
  }
}

function normalizeMembers(raw: RawMember[] | null | undefined): AiWorkspaceMember[] {
  if (!Array.isArray(raw)) return []
  const rows: AiWorkspaceMember[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const id = toStr(item.id)
    const name = item.name ?? item.nickname ?? ''
    if (!id && !name) continue
    rows.push({ id: id || name, name, role: item.role ?? null })
  }
  return rows
}

function normalizeFiles(raw: RawFile[] | null | undefined): AiWorkspaceFile[] {
  if (!Array.isArray(raw)) return []
  const rows: AiWorkspaceFile[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const id = toStr(item.id)
    if (!id) continue
    rows.push({
      id,
      name: typeof item.name === 'string' ? item.name : '',
      size: toNum(item.size),
      mimeType: item.mimeType ?? null,
      createdAt: item.createdAt ?? null,
    })
  }
  return rows
}

/**
 * AI 工作台项目详情 —— RN 宿主壳，对齐 web `/workspace/[id]`。
 *
 * 取数与三个会改服务端状态的动作（上传 / 删除 / 转 Markdown）在此，渲染全在共享屏
 * `@ihui/rn-app` 的 AiWorkspaceProjectScreen。与 RN 既有 `WorkspaceScreen`
 * （app 内的本地工作区列表 + 权限页，走 @ihui/api-client/endpoints/workspace）**不同物**，
 * 互不复用也不覆盖。
 *
 * 端点（apps/api/src/routes/workspace.ts / files.ts 实测）：
 * - `GET  /api/workspace/projects/:id`         → `{ project }`
 * - `GET  /api/workspace/projects/:id/files`   → `{ files }`
 * - `POST /api/workspace/projects/:id/files`   → multipart，`{ file }`（上传走 FormData 透传）
 * - `DELETE /api/workspace/files/:id`          → 软删除，`{ deleted }`
 * - `POST /api/files/:id/convert-markdown`     → `{ markdown, fileName }`，失败 422 + 具体原因
 *
 * 成员 / 任务无后端端点：web 那两张卡是 `helpers.ts` 的 `AI_MOCK`。宿主不传 ⇒ 共享屏渲染空态，
 * 不搬 mock、不编数据（见 @ihui/types/ai-workspace.ts 头注）。
 */
export function AiWorkspaceProjectScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const route = useRoute<Route>()
  const navigation = useNavigation()
  const { id } = route.params

  const [project, setProject] = useState<AiWorkspaceProject | null>(null)
  const [members, setMembers] = useState<AiWorkspaceMember[]>([])
  const [files, setFiles] = useState<AiWorkspaceFile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filesLoading, setFilesLoading] = useState(true)
  const [filesError, setFilesError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [removingFileId, setRemovingFileId] = useState<string | null>(null)
  const [convertingFileId, setConvertingFileId] = useState<string | null>(null)
  const [convertError, setConvertError] = useState('')
  const [convertResult, setConvertResult] = useState<AiWorkspaceConvertResult | null>(null)

  const loadProject = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetchApi<ProjectPayload>(
        `/api/workspace/projects/${encodeURIComponent(id)}`,
      )
      if (!res.success) {
        setProject(null)
        setMembers([])
        setError(apiFailureToText(res, t('aiWorkspace.loadFailed')))
        return
      }
      const data = res.data
      // `{ project }` 是现网形态；`data` 直接是项目对象时也能读（防御性归一）
      const raw = data?.project ?? (data as RawProject | undefined)
      setProject(normalizeProject(raw))
      setMembers(normalizeMembers(data?.members ?? (raw as RawProject | undefined)?.members))
    } catch {
      setProject(null)
      setMembers([])
      setError(t('aiWorkspace.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [id, t])

  const loadFiles = useCallback(async () => {
    setFilesLoading(true)
    setFilesError('')
    try {
      const res = await fetchApi<FilesPayload>(
        `/api/workspace/projects/${encodeURIComponent(id)}/files`,
      )
      if (!res.success) {
        setFiles([])
        setFilesError(apiFailureToText(res, t('aiWorkspace.filesLoadFailed')))
        return
      }
      const data = res.data
      const raw = data?.files ?? (Array.isArray(data) ? data : null)
      setFiles(normalizeFiles(raw))
    } catch {
      setFiles([])
      setFilesError(t('aiWorkspace.filesLoadFailed'))
    } finally {
      setFilesLoading(false)
    }
  }, [id, t])

  useEffect(() => {
    void loadProject()
    void loadFiles()
  }, [loadFiles, loadProject])

  /** 选文件 → multipart POST 直接落到本项目（不经通用 /files/upload/form） */
  const onUpload = useCallback(() => {
    if (uploading) return
    void (async () => {
      try {
        const picked = await DocumentPicker.getDocumentAsync({
          copyToCacheDirectory: true,
          multiple: false,
        })
        if (picked.canceled || picked.assets.length === 0) return
        const asset = picked.assets[0]
        if (!asset) return
        setUploading(true)
        setUploadError('')
        const formData = new FormData()
        // RN FormData 的文件部分是 { uri, type, name } 对象；标准库 append 签名不含该形态，
        // 用 as never 绕过（平台特性，非 any 兜底，与 ConversationImportScreen 同口径）。
        formData.append('file', {
          uri: asset.uri,
          type: asset.mimeType ?? 'application/octet-stream',
          name: asset.name ?? `file-${Date.now()}`,
        } as never)
        const res = await fetchApi<{ file?: unknown }>(
          `/api/workspace/projects/${encodeURIComponent(id)}/files`,
          { method: 'POST', body: formData, timeoutMs: 120_000 },
        )
        if (!res.success) {
          setUploadError(apiFailureToText(res, t('aiWorkspace.uploadFailed')))
          return
        }
        // 文件数变了 ⇒ 项目头的 fileCount 也要重拉（web 同时失效 projects / files 两条 query）
        await Promise.all([loadFiles(), loadProject()])
      } catch {
        setUploadError(t('aiWorkspace.uploadFailed'))
      } finally {
        setUploading(false)
      }
    })()
  }, [id, loadFiles, loadProject, t, uploading])

  const doRemove = useCallback(
    (file: AiWorkspaceFile) => {
      setRemovingFileId(file.id)
      setDeleteError('')
      void (async () => {
        try {
          const res = await fetchApi(`/api/workspace/files/${encodeURIComponent(file.id)}`, {
            method: 'DELETE',
          })
          if (!res.success) {
            setDeleteError(apiFailureToText(res, t('aiWorkspace.removeFailed')))
            return
          }
          await Promise.all([loadFiles(), loadProject()])
        } catch {
          setDeleteError(t('aiWorkspace.removeFailed'))
        } finally {
          setRemovingFileId(null)
        }
      })()
    },
    [loadFiles, loadProject, t],
  )

  /** 删除不可逆（软删进回收站但仍从项目里消失）⇒ 与 WorkspaceScreen 删除项目同口径二次确认 */
  const onRemove = useCallback(
    (file: AiWorkspaceFile) => {
      appAlert(t('aiWorkspace.removeFile'), t('aiWorkspace.removeConfirm', { name: file.name }), [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.confirm'),
          style: 'destructive',
          onPress: () => doRemove(file),
        },
      ])
    },
    [doRemove, t],
  )

  /** 转 Markdown：后端要求发 `{}` + JSON CT（空 body 会被 Fastify 判 400/415，见 web helpers.ts:94-99） */
  const onConvert = useCallback(
    (file: AiWorkspaceFile) => {
      if (convertingFileId) return
      setConvertingFileId(file.id)
      setConvertError('')
      setConvertResult(null)
      void (async () => {
        try {
          const res = await fetchApi<ConvertPayload>(
            `/api/files/${encodeURIComponent(file.id)}/convert-markdown`,
            { method: 'POST', body: JSON.stringify({}), timeoutMs: 120_000 },
          )
          if (!res.success) {
            // web 的格式是「转换失败: <后端具体原因>」；后端没给原因时才只留前缀，不重复两遍同一句
            const prefix = t('aiWorkspace.convertFailed')
            const reason = apiFailureToText(res, prefix)
            setConvertError(reason === prefix ? prefix : `${prefix}: ${reason}`)
            return
          }
          const markdown = res.data?.markdown
          if (typeof markdown !== 'string') {
            setConvertError(t('aiWorkspace.convertFailed'))
            return
          }
          setConvertResult({ markdown, fileName: res.data?.fileName || file.name })
        } catch (e) {
          const prefix = t('aiWorkspace.convertFailed')
          const message = e instanceof Error ? e.message : ''
          setConvertError(message ? `${prefix}: ${message}` : prefix)
        } finally {
          setConvertingFileId(null)
        }
      })()
    },
    [convertingFileId, t],
  )

  return (
    <SharedAiWorkspaceProjectScreen
      t={t}
      project={project}
      members={members}
      // 任务无后端端点（web 是 mock）⇒ 不传，屏上走空态
      tasks={[]}
      files={files}
      loading={loading}
      error={error}
      filesLoading={filesLoading}
      filesError={filesError}
      uploading={uploading}
      uploadError={uploadError}
      deleteError={deleteError}
      removingFileId={removingFileId}
      convertingFileId={convertingFileId}
      convertError={convertError}
      convertResult={convertResult}
      onBack={() => navigation.goBack()}
      onRetry={() => void loadProject()}
      onRetryFiles={() => void loadFiles()}
      onUpload={onUpload}
      onRemove={onRemove}
      onConvert={onConvert}
      onCloseConvertResult={() => setConvertResult(null)}
      colorScheme={resolvedTheme}
    />
  )
}
