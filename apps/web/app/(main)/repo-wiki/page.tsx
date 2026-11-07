// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * Repo Wiki 页面 (2026-09-07 新增,Repo Wiki MVP)
 *
 * 与 RN `apps/mobile-rn/src/screens/RepoWikiScreen.tsx` 共用同一份渲染
 * (`@ihui/rn-app/features/repo-wiki/RepoWikiScreen`,react-native-web 承载)。
 * 本页只保留 web 侧独有的"选文件夹 + 生成"能力(浏览器 File System Access API,
 * RN 无等价能力)与平台件:MarkdownStream 正文渲染、confirmDialog、生成错误提示。
 * 仓库名输入、文档列表、详情查看、删除确认均由共享屏渲染。
 */

import * as React from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { FolderOpen, Loader2 } from 'lucide-react'
import { Button, Card, CardContent, CardHeader, CardTitle } from '@ihui/ui-react'
import { Alert, confirmDialog } from '@/components/feedback'
import { MarkdownStream } from '@/components/ai/markdown-stream'
import type { TFunction } from '@ihui/types'
import {
  RepoWikiScreen as SharedRepoWikiScreen,
  type RepoWikiDocView,
} from '@ihui/rn-app/features/repo-wiki/RepoWikiScreen'
import { formatDate } from '@/lib/date-utils'
import {
  generateRepoWiki,
  listRepoWiki,
  getRepoWikiDoc,
  deleteRepoWikiDoc,
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
  showDirectoryPicker?: (opts?: {
    mode?: 'read' | 'readwrite'
  }) => Promise<FileSystemDirectoryHandle>
}

// =============================================================================
// 页面
// =============================================================================

export default function RepoWikiPage() {
  const t = useTranslations('repoWiki')
  const locale = useLocale()

  const [repoName, setRepoName] = React.useState('')
  const [folderName, setFolderName] = React.useState<string | null>(null)
  const [collectedFiles, setCollectedFiles] = React.useState<RepoWikiFileInput[]>([])
  const [collecting, setCollecting] = React.useState(false)
  const [generating, setGenerating] = React.useState(false)
  const [genError, setGenError] = React.useState<string | null>(null)

  const [docs, setDocs] = React.useState<RepoWikiDocView[]>([])
  const [loadingDocs, setLoadingDocs] = React.useState(false)
  const [loadError, setLoadError] = React.useState<string | null>(null)

  const loadDocs = React.useCallback(async () => {
    const name = repoName.trim()
    if (!name) return
    setLoadingDocs(true)
    setLoadError(null)
    try {
      setDocs(await listRepoWiki(name))
    } catch (e) {
      setLoadError((e as Error).message)
    } finally {
      setLoadingDocs(false)
    }
  }, [repoName])

  // 选择文件夹(showDirectoryPicker),自动把文件夹名填入仓库名
  const handlePickFolder = React.useCallback(async () => {
    setGenError(null)
    const w = window as unknown as PickerWindow
    if (typeof w.showDirectoryPicker !== 'function') {
      setGenError(t('pickerUnsupported'))
      return
    }
    setCollecting(true)
    try {
      const handle = await w.showDirectoryPicker({ mode: 'read' })
      const files = await collectRepoFiles(handle)
      if (files.length === 0) {
        setGenError(t('noTextFiles'))
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
        setGenError((e as Error).message)
      }
    } finally {
      setCollecting(false)
    }
  }, [t])

  // 生成 Wiki
  const handleGenerate = React.useCallback(async () => {
    setGenError(null)
    if (!repoName.trim()) {
      setGenError(t('needRepoName'))
      return
    }
    setGenerating(true)
    try {
      if (collectedFiles.length === 0) {
        setGenError(t('needFolder'))
        return
      }
      await generateRepoWiki({ repoName: repoName.trim(), files: collectedFiles })
      await loadDocs()
    } catch (e) {
      setGenError(`${t('generateFailed')}:${(e as Error).message}`)
    } finally {
      setGenerating(false)
    }
  }, [repoName, collectedFiles, loadDocs, t])

  const handleLoadDoc = React.useCallback(async (id: string) => {
    const full = await getRepoWikiDoc(id)
    return full.content
  }, [])

  const handleDelete = React.useCallback(async (id: string) => {
    await deleteRepoWikiDoc(id)
    setDocs((prev) => prev.filter((d) => d.id !== id))
  }, [])

  const handleConfirm = React.useCallback(
    (options: { title: string; message: string; destructive?: boolean }) =>
      confirmDialog({
        title: options.title,
        content: options.message,
        variant: options.destructive ? 'danger' : 'default',
      }),
    [],
  )

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-4">
      <div>
        <h1 className="text-display font-semibold">{t('title')}</h1>
      </div>

      {genError && <Alert variant="danger" description={genError} className="items-start" />}

      {/* web 独有:选文件夹 + 生成(浏览器 File System Access API,RN 无等价能力) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FolderOpen className="h-4 w-4" aria-hidden />
            {t('generateSection')}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              onClick={handlePickFolder}
              disabled={collecting || generating}
            >
              {collecting ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <FolderOpen className="h-4 w-4" aria-hidden />
              )}
              {collecting ? t('collecting') : t('pickFolder')}
            </Button>
            {folderName && (
              <p className="text-body text-muted-foreground">
                {t('folderSelected', { name: folderName, count: collectedFiles.length })}
              </p>
            )}
          </div>

          <div>
            <Button onClick={handleGenerate} disabled={generating || collecting || !folderName}>
              {generating && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              {generating ? t('generating') : t('generate')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <SharedRepoWikiScreen
        t={t as unknown as TFunction}
        colorScheme="light"
        repoName={repoName}
        onChangeRepoName={setRepoName}
        docs={docs}
        loading={loadingDocs}
        error={loadError}
        formatDate={(iso) => formatDate(iso, locale)}
        onLoad={loadDocs}
        onLoadDoc={handleLoadDoc}
        onDelete={handleDelete}
        onConfirm={handleConfirm}
        renderDetail={(content) => <MarkdownStream content={content} collapseLines={0} />}
      />
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
