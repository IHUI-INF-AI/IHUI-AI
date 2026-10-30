// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert } from 'react-native'
import { useNavigation, useRoute } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
  deleteWorkspaceProjectFile,
  fetchWorkspaceProject,
  fetchWorkspaceProjectFiles,
  type WorkspaceProjectDetail,
  type WorkspaceProjectFile,
} from '@ihui/api-client'
import {
  WorkspaceDetailScreen as SharedWorkspaceDetailScreen,
  type WorkspaceFileRowView,
  type WorkspaceProjectHeaderView,
} from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

const NS = 'workspaceDetailPage'

/**
 * 文件字节数 → 人类可读。web 侧由 `components/workspace/file-list` 的格式化器给出同义文本,
 * RN 无 Intl 字节单位,这里按 1024 进制作最简换算(仅展示,不参与任何计算)。
 */
function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '-'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * RN 端「工作区项目详情」薄壳 —— 承载 web `/workspace/[id]`。
 *
 * 取数(契约见 packages/api-client/src/endpoints/workspace-detail.ts 头注):
 *  - GET /api/workspace/projects/:id       → success({ project })(apps/api/src/routes/workspace.ts:264-279)
 *  - GET /api/workspace/projects/:id/files → success({ files })(workspace.ts:335-351)
 *  - DELETE /api/workspace/files/:id       → success({ deleted })(workspace.ts:653-690,软删除)
 * 项目与文件两个请求并发发出,任一失败即整屏错误态(web 用两条 useQuery,错误各自在分区里显示;
 * RN 单屏合并,口径差如实登记在 ledger note)。
 * 上传/下载/预览/转 Markdown 未承载,AIWorkspaceTabs 是 AI_MOCK 静态样例(helpers.ts:9-41)故不搬。
 */
export function WorkspaceDetailScreen() {
  const navigation = useNavigation<NavigationProp>()
  const route = useRoute<{ key: string; name: string; params?: { id?: string } }>()
  const { t, locale } = useI18n()
  const { resolvedTheme } = useTheme()
  const { user } = useAuth()

  const projectId = route.params?.id ?? ''

  const [project, setProject] = useState<WorkspaceProjectHeaderView | null>(null)
  const [files, setFiles] = useState<WorkspaceFileRowView[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [banner, setBanner] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)

  const dateFmt = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }),
    [locale],
  )

  const fmtDate = useCallback(
    (value: string | null | undefined): string => {
      if (!value) return '-'
      const d = new Date(value)
      return Number.isNaN(d.getTime()) ? '-' : dateFmt.format(d)
    },
    [dateFmt],
  )

  const toFileRow = useCallback(
    (file: WorkspaceProjectFile): WorkspaceFileRowView => ({
      id: file.id,
      name: file.name,
      sizeText: formatBytes(file.size),
      mimeType: file.mimeType ?? '',
      uploadedAtText: fmtDate(file.createdAt),
    }),
    [fmtDate],
  )

  const toProjectView = useCallback(
    (detail: WorkspaceProjectDetail): WorkspaceProjectHeaderView => ({
      name: detail.name,
      description: detail.description ?? '',
      updatedAtText: fmtDate(detail.updatedAt),
    }),
    [fmtDate],
  )

  const load = useCallback(async () => {
    if (!user || !projectId) return
    setLoading(true)
    setError(null)
    try {
      const [projectRes, filesRes] = await Promise.all([
        fetchWorkspaceProject(projectId),
        fetchWorkspaceProjectFiles(projectId),
      ])
      if (!projectRes.success || !projectRes.data) {
        setError(projectRes.error ?? t('common.loadFailed'))
        return
      }
      setProject(toProjectView(projectRes.data.project))
      if (!filesRes.success || !filesRes.data) {
        setError(filesRes.error ?? t('common.loadFailed'))
        return
      }
      setFiles((filesRes.data.files ?? []).map(toFileRow))
    } catch {
      setError(t('common.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [user, projectId, toProjectView, toFileRow, t])

  useEffect(() => {
    void load()
  }, [load])

  const handleDelete = useCallback(
    (fileId: string) => {
      const target = files.find((f) => f.id === fileId)
      Alert.alert(t(`${NS}.deleteFile`), t(`${NS}.deleteConfirm`, { name: target?.name ?? '' }), [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => {
            setDeletingId(fileId)
            setBanner(null)
            void (async () => {
              try {
                const res = await deleteWorkspaceProjectFile(fileId)
                if (!res.success) {
                  setBanner({ tone: 'error', text: res.error ?? t('common.failed') })
                  return
                }
                setFiles((prev) => prev.filter((f) => f.id !== fileId))
                setBanner({ tone: 'success', text: t('common.deleted') })
              } catch {
                setBanner({ tone: 'error', text: t('common.failed') })
              } finally {
                setDeletingId(null)
              }
            })()
          },
        },
      ])
    },
    [files, t],
  )

  return (
    <SharedWorkspaceDetailScreen
      t={t}
      colorScheme={resolvedTheme}
      onBack={() => navigation.goBack()}
      loginRequiredText={user ? '' : t(`${NS}.loginRequired`)}
      loading={loading}
      error={error}
      project={project}
      files={files}
      deletingId={deletingId}
      onDelete={handleDelete}
      onRefresh={() => void load()}
      banner={banner}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
