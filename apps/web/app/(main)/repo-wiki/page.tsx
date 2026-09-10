// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * Repo Wiki 页面 (2026-09-07 新增,Repo Wiki MVP)
 *
 * 上半区:仓库名 + 选择文件夹(浏览器 FileSystemDirectoryHandle 遍历收集文本文件)
 *        → 生成按钮 → 调后端 LLM 生成"仓库总览 + 模块文档"。
 * 下半区:该仓库文档列表(标题/类型/生成时间)→ 点击查看用 MarkdownStream 渲染。
 */

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Eye, FolderOpen, Loader2, RefreshCw, Trash2 } from 'lucide-react'
import { Button, Card, CardContent, CardHeader, CardTitle } from '@ihui/ui-react'
import { Alert, confirmDialog } from '@/components/feedback'
import { Input } from '@/components/form'
import { MarkdownStream } from '@/components/ai/markdown-stream'
import {
  generateRepoWiki,
  listRepoWiki,
  getRepoWikiDoc,
  deleteRepoWikiDoc,
  type RepoWikiDocSummary,
  type RepoWikiFileInput,
} from '@ihui/api-client'

// =============================================================================
// 本地文件收集(浏览器 File System Access API)
// =============================================================================

/** 跳过的目录名(与 workspace-context-loader 口径对齐,避免噪音) */
const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  'dist',
  'build',
  'out',
  '.output',
  '.turbo',
  '.cache',
  'coverage',
  '.nyc_output',
  '__pycache__',
  '.pytest_cache',
  '.venv',
  'venv',
  'env',
  'target',
  '.cargo',
  '.idea',
  '.vscode',
])

/** 视为文本的扩展名(用于判断是否读取内容) */
const TEXT_EXTENSIONS = new Set([
  '.md',
  '.txt',
  '.json',
  '.yaml',
  '.yml',
  '.toml',
  '.ini',
  '.cfg',
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.py',
  '.rb',
  '.go',
  '.rs',
  '.java',
  '.kt',
  '.swift',
  '.css',
  '.scss',
  '.less',
  '.html',
  '.vue',
  '.svelte',
  '.sh',
  '.bash',
  '.zsh',
  '.ps1',
  '.sql',
  '.graphql',
  '.proto',
  '.gitignore',
])

/** 无扩展名的文本文件名 */
const EXACT_TEXT_NAMES = new Set(['Dockerfile', 'Makefile', 'Procfile', '.env.example'])

/** 目录遍历最大深度 */
const MAX_DEPTH = 8
/** 最多收集文件数(后端 route 上限 400) */
const MAX_FILES = 400
/** 单文件前端截断(64KB,后端还有 8KB 二次截断) */
const MAX_FILE_CHARS = 64 * 1024
/** 前端收集总量上限(900KB,防浏览器卡顿;后端预算 120KB) */
const MAX_TOTAL_CHARS = 900 * 1024

function getExtension(path: string): string {
  const idx = path.lastIndexOf('.')
  if (idx < 0) return ''
  return path.slice(idx).toLowerCase()
}

function isTextFile(path: string): boolean {
  const baseName = path.slice(path.lastIndexOf('/') + 1)
  if (EXACT_TEXT_NAMES.has(baseName)) return true
  return TEXT_EXTENSIONS.has(getExtension(path))
}

/** 遍历目录收集文本文件内容(前端先做一层截断防卡) */
async function collectRepoFiles(handle: FileSystemDirectoryHandle): Promise<RepoWikiFileInput[]> {
  const files: RepoWikiFileInput[] = []
  let total = 0

  async function walk(
    dir: FileSystemDirectoryHandle,
    prefix: string,
    depth: number,
  ): Promise<void> {
    if (depth >= MAX_DEPTH || files.length >= MAX_FILES || total >= MAX_TOTAL_CHARS) return
    // TS lib.dom.d.ts 未声明 values(),用类型断言访问标准 API
    const iterable = dir as unknown as { values(): AsyncIterableIterator<FileSystemHandle> }
    for await (const entry of iterable.values()) {
      if (files.length >= MAX_FILES || total >= MAX_TOTAL_CHARS) return
      const path = prefix ? `${prefix}/${entry.name}` : entry.name
      if (entry.kind === 'directory') {
        if (!SKIP_DIRS.has(entry.name)) {
          await walk(entry as FileSystemDirectoryHandle, path, depth + 1)
        }
      } else if (entry.kind === 'file' && isTextFile(path)) {
        try {
          const file = await (entry as FileSystemFileHandle).getFile()
          const text = await file.slice(0, MAX_FILE_CHARS).text()
          files.push({ path, content: text.slice(0, MAX_FILE_CHARS) })
          total += text.length
        } catch {
          // 读取失败,跳过
        }
      }
    }
  }

  await walk(handle, '', 0)
  return files
}

interface PickerWindow {
  showDirectoryPicker?: (opts?: { mode?: 'read' | 'readwrite' }) => Promise<FileSystemDirectoryHandle>
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

// =============================================================================
// 页面
// =============================================================================

export default function RepoWikiPage() {
  const t = useTranslations('repoWiki')

  const [repoName, setRepoName] = React.useState('')
  const [folderName, setFolderName] = React.useState<string | null>(null)
  const [collectedFiles, setCollectedFiles] = React.useState<RepoWikiFileInput[]>([])
  const [collecting, setCollecting] = React.useState(false)
  const [generating, setGenerating] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const [docs, setDocs] = React.useState<RepoWikiDocSummary[]>([])
  const [loadingDocs, setLoadingDocs] = React.useState(false)

  const [viewingId, setViewingId] = React.useState<string | null>(null)
  const [viewingTitle, setViewingTitle] = React.useState('')
  const [detailContent, setDetailContent] = React.useState<string | null>(null)
  const [loadingDetail, setLoadingDetail] = React.useState(false)
  const [deletingId, setDeletingId] = React.useState<string | null>(null)

  const loadDocs = React.useCallback(async (name: string) => {
    if (!name.trim()) return
    setLoadingDocs(true)
    setError(null)
    try {
      const rows = await listRepoWiki(name.trim())
      setDocs(rows)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoadingDocs(false)
    }
  }, [])

  // 选择文件夹(showDirectoryPicker),自动把文件夹名填入仓库名
  const handlePickFolder = React.useCallback(async () => {
    setError(null)
    const w = window as unknown as PickerWindow
    if (typeof w.showDirectoryPicker !== 'function') {
      setError(t('pickerUnsupported'))
      return
    }
    setCollecting(true)
    try {
      const handle = await w.showDirectoryPicker({ mode: 'read' })
      const files = await collectRepoFiles(handle)
      if (files.length === 0) {
        setError(t('noTextFiles'))
        setFolderName(null)
        return
      }
      setFolderName(handle.name)
      setRepoName(handle.name)
      setCollectedFiles(files)
      setDocs([])
    } catch (e) {
      // 用户取消选择 AbortError,静默
      if ((e as Error).name !== 'AbortError') {
        setError((e as Error).message)
      }
    } finally {
      setCollecting(false)
    }
  }, [t])

  // 生成 Wiki
  const handleGenerate = React.useCallback(async () => {
    setError(null)
    if (!repoName.trim()) {
      setError(t('needRepoName'))
      return
    }
    setGenerating(true)
    try {
      if (collectedFiles.length === 0) {
        setError(t('needFolder'))
        return
      }
      await generateRepoWiki({ repoName: repoName.trim(), files: collectedFiles })
      await loadDocs(repoName.trim())
    } catch (e) {
      setError(`${t('generateFailed')}:${(e as Error).message}`)
    } finally {
      setGenerating(false)
    }
  }, [repoName, collectedFiles, loadDocs, t])

  // 查看文档
  const handleView = React.useCallback(async (doc: RepoWikiDocSummary) => {
    setViewingId(doc.id)
    setViewingTitle(doc.title)
    setDetailContent(null)
    setLoadingDetail(true)
    try {
      const detail = await getRepoWikiDoc(doc.id)
      setDetailContent(detail.content)
    } catch (e) {
      setError((e as Error).message)
      setViewingId(null)
    } finally {
      setLoadingDetail(false)
    }
  }, [])

  // 删除文档
  const handleDelete = React.useCallback(
    async (doc: RepoWikiDocSummary) => {
      const ok = await confirmDialog({ title: t('deleteConfirm'), variant: 'danger' })
      if (!ok) return
      setDeletingId(doc.id)
      try {
        await deleteRepoWikiDoc(doc.id)
        setDocs((prev) => prev.filter((d) => d.id !== doc.id))
      } catch (e) {
        setError((e as Error).message)
      } finally {
        setDeletingId(null)
      }
    },
    [t],
  )

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4">
      <div>
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('description')}</p>
      </div>

      {error && <Alert variant="danger" description={error} className="items-start" />}

      {/* 上半区:生成入口 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FolderOpen className="h-4 w-4" aria-hidden />
            {t('generateSection')}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <label className="w-20 shrink-0 text-sm font-medium" htmlFor="repo-wiki-repo-name">
              {t('repoNameLabel')}
            </label>
            <Input
              id="repo-wiki-repo-name"
              value={repoName}
              onChange={(e) => setRepoName(e.target.value)}
              placeholder={t('repoNamePlaceholder')}
              className="max-w-xs"
              disabled={generating}
            />
            <Button variant="outline" onClick={handlePickFolder} disabled={collecting || generating}>
              {collecting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <FolderOpen className="h-4 w-4" aria-hidden />}
              {collecting ? t('collecting') : t('pickFolder')}
            </Button>
          </div>

          {folderName && (
            <p className="text-sm text-muted-foreground">
              {t('folderSelected', { name: folderName, count: collectedFiles.length })}
            </p>
          )}

          <div>
            <Button onClick={handleGenerate} disabled={generating || collecting || !folderName}>
              {generating && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              {generating ? t('generating') : t('generate')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 查看详情 */}
      {viewingId && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-base">
              <span>{viewingTitle}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setViewingId(null)
                  setDetailContent(null)
                }}
              >
                {t('backToList')}
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingDetail || detailContent === null ? (
              <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                {t('loadingDetail')}
              </div>
            ) : (
              <MarkdownStream content={detailContent} collapseLines={0} />
            )}
          </CardContent>
        </Card>
      )}

      {/* 下半区:文档列表 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-base">
            <span>{t('listTitle')}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void loadDocs(repoName)}
              disabled={loadingDocs || !repoName.trim()}
            >
              <RefreshCw className="h-4 w-4" aria-hidden />
              {t('refresh')}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingDocs ? (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              {t('loadingDocs')}
            </div>
          ) : docs.length === 0 ? (
            <p className="py-6 text-sm text-muted-foreground">{t('emptyList')}</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {docs.map((doc) => (
                <li
                  key={doc.id}
                  className="flex flex-wrap items-center gap-3 rounded-lg border p-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{doc.title}</span>
                      <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
                        {doc.kind === 'module' ? t('kindModule') : t('kindOverview')}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t('generatedAt', { time: formatDate(doc.generatedAt) })}
                      {' · '}
                      {t('fileCount', { count: doc.fileCount })}
                      {doc.model ? ` · ${doc.model}` : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => void handleView(doc)}>
                      <Eye className="h-4 w-4" aria-hidden />
                      {t('view')}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void handleDelete(doc)}
                      disabled={deletingId === doc.id}
                    >
                      {deletingId === doc.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      ) : (
                        <Trash2 className="h-4 w-4" aria-hidden />
                      )}
                      {t('delete')}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
