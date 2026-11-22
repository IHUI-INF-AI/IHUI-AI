// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { create } from 'zustand'
import { logger } from '@/lib/logger'
import {
  browseDirectory,
  getWorkspaceGitBranches,
  getWorkspaceGitDiffStat,
  getWorkspaceGitLog,
  readFile,
  type BrowseEntry,
  type WorkspaceGitDiffStatFile,
} from '@ihui/api-client'
import type {
  ViewPanelType,
  IDETabType,
  FileNode,
  EditorTab,
  DiffFile,
  DiffViewMode,
} from '@ihui/types'

/** 扩展名 → 语言映射(导出供跨文件跳转构造 FileNode 用,0-4c) */
export const EXT_LANG: Record<string, string> = {
  ts: 'typescript',
  tsx: 'tsx',
  js: 'javascript',
  jsx: 'jsx',
  json: 'json',
  css: 'css',
  scss: 'scss',
  html: 'html',
  md: 'markdown',
  py: 'python',
  go: 'go',
  rs: 'rust',
  sh: 'shell',
  yml: 'yaml',
  yaml: 'yaml',
  sql: 'sql',
  xml: 'xml',
  svg: 'xml',
  vue: 'vue',
  svelte: 'svelte',
}

/** BrowseEntry → FileNode */
function entryToFileNode(entry: BrowseEntry, parentId: string): FileNode {
  const ext = entry.name.split('.').pop()?.toLowerCase() ?? ''
  return {
    id: `${parentId}/${entry.name}`,
    name: entry.name,
    path: entry.path,
    type: entry.isDir ? 'folder' : 'file',
    language: entry.isDir ? undefined : (EXT_LANG[ext] ?? 'text'),
    size: entry.size || undefined,
    lastModified: entry.modified || undefined,
    children: entry.isDir ? [] : undefined,
  }
}

/** 在树中查找节点 */
function findNode(nodes: FileNode[], id: string): FileNode | null {
  for (const n of nodes) {
    if (n.id === id) return n
    if (n.children) {
      const found = findNode(n.children, id)
      if (found) return found
    }
  }
  return null
}

/** 结构化 diff-stat → DiffFile;状态与统计同源,不再逐文件跑 git。 */
export function mapGitDiffStatToDiffFiles(files: WorkspaceGitDiffStatFile[]): DiffFile[] {
  return files.map((file) => {
    const ext = file.path.split('.').pop()?.toLowerCase() ?? ''
    return {
      id: `diff-${file.path}`,
      filename: file.path,
      status: file.status,
      oldContent: '',
      newContent: '',
      additions: file.additions,
      deletions: file.deletions,
      language: EXT_LANG[ext] ?? 'text',
    }
  })
}

/** localStorage 键 */
const LS_EXPANDED_FOLDERS = 'ide:expandedFolders'

/** 从 localStorage 恢复展开的文件夹 id 集合(仅在客户端调用) */
function loadExpandedFolders(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const saved = window.localStorage.getItem(LS_EXPANDED_FOLDERS)
    return new Set(saved ? (JSON.parse(saved) as string[]) : [])
  } catch {
    return new Set()
  }
}

/** 持久化展开的文件夹 id 集合到 localStorage */
function saveExpandedFolders(folders: Set<string>): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(LS_EXPANDED_FOLDERS, JSON.stringify([...folders]))
  } catch {
    /* localStorage 配额满或禁用时静默忽略 */
  }
}

/** 更新树中指定节点的 children */
function updateTreeChildren(nodes: FileNode[], folderId: string, children: FileNode[]): FileNode[] {
  return nodes.map((n) => {
    if (n.id === folderId) return { ...n, children }
    if (n.children) return { ...n, children: updateTreeChildren(n.children, folderId, children) }
    return n
  })
}

export interface GitCommit {
  id: string
  message: string
  author: string
  time: string
}

interface IDEWorkspaceState {
  /** 当前活动视图 */
  activeView: ViewPanelType
  /** 顶部 tab 类型 */
  activeTopTab: IDETabType
  /** 工作区路径 */
  workspacePath: string
  /** 文件树 */
  fileTree: FileNode[]
  /** 已加载子项的文件夹 id 集合 */
  loadedFolders: Set<string>
  /** 展开的文件夹 id 集合 */
  expandedFolders: Set<string>
  /** 选中的文件 id */
  selectedFileId: string | null
  /** 打开的编辑器 tab */
  openTabs: EditorTab[]
  /** 活动 tab id */
  activeTabId: string | null
  /** diff 文件列表 */
  diffFiles: DiffFile[]
  /** 活动 diff 文件 id */
  activeDiffFileId: string | null
  /** diff 视图模式 */
  diffViewMode: DiffViewMode
  /** git 提交历史 */
  gitCommits: GitCommit[]
  /** git 分支列表 */
  gitBranches: string[]
  /** git 当前分支 */
  gitCurrentBranch: string
  /** 加载状态 */
  loading: boolean
  /** 错误信息 */
  error: string | null
  /**
   * 编辑器「揭示到行」入口:由 CodeEditorPane 挂载期注册、卸载即注销。
   * 审查 finding 等跨面板跳转在 openFile + setActiveTopTab('editor') 之后调用;
   * 只做转发,揭示机制仍由 CodeEditor 的 pendingReveal 单点承载。
   */
  revealAt: ((file: string, line: number, column: number) => void) | null

  // UI Actions
  setActiveView: (view: ViewPanelType) => void
  setActiveTopTab: (tab: IDETabType) => void
  setWorkspacePath: (path: string) => void
  toggleFolder: (folderId: string) => void
  /** 从 localStorage 恢复展开状态(仅客户端初始化时调用) */
  restoreExpandedFolders: () => void
  selectFile: (fileId: string) => void
  openFile: (file: FileNode) => void
  closeTab: (tabId: string) => void
  setActiveTab: (tabId: string) => void
  setActiveDiffFile: (fileId: string) => void
  setDiffViewMode: (mode: DiffViewMode) => void
  setRevealAt: (fn: ((file: string, line: number, column: number) => void) | null) => void

  // Fetch Actions
  fetchFileTree: () => Promise<void>
  fetchFolderChildren: (folderId: string) => Promise<void>
  fetchFileContent: (filePath: string) => Promise<string>
  fetchDiffFiles: () => Promise<void>
  fetchGitLog: () => Promise<void>
  fetchGitBranches: () => Promise<void>
}

export const useIDEWorkspace = create<IDEWorkspaceState>((set, get) => ({
  activeView: 'files',
  activeTopTab: 'editor',
  workspacePath: '',
  fileTree: [],
  loadedFolders: new Set<string>(),
  expandedFolders: new Set<string>(),
  selectedFileId: null,
  openTabs: [],
  activeTabId: null,
  diffFiles: [],
  activeDiffFileId: null,
  diffViewMode: 'split',
  gitCommits: [],
  gitBranches: [],
  gitCurrentBranch: 'main',
  loading: false,
  error: null,
  revealAt: null,

  setActiveView: (view) => set({ activeView: view }),
  setActiveTopTab: (tab) => set({ activeTopTab: tab }),
  setWorkspacePath: (path) => set({ workspacePath: path }),

  toggleFolder: (folderId) => {
    const state = get()
    const next = new Set(state.expandedFolders)
    if (next.has(folderId)) {
      next.delete(folderId)
    } else {
      next.add(folderId)
      // 如果文件夹子项未加载,异步加载
      if (!state.loadedFolders.has(folderId)) {
        get().fetchFolderChildren(folderId)
      }
    }
    saveExpandedFolders(next)
    set({ expandedFolders: next })
  },

  restoreExpandedFolders: () => {
    const saved = loadExpandedFolders()
    if (saved.size === 0) return
    set({ expandedFolders: saved })
  },

  selectFile: (fileId) => set({ selectedFileId: fileId }),

  openFile: (file) => {
    if (file.type !== 'file') return
    const state = get()
    const existing = state.openTabs.find((t) => t.fileId === file.id)
    if (existing) {
      set({ activeTabId: existing.id, selectedFileId: file.id })
      return
    }
    const newTab: EditorTab = {
      id: `tab-${file.id}`,
      fileId: file.id,
      filename: file.name,
      path: file.path,
      language: file.language ?? 'text',
      content: '',
      isDirty: false,
    }
    set({
      openTabs: [...state.openTabs, newTab],
      activeTabId: newTab.id,
      selectedFileId: file.id,
    })
    // 异步加载文件内容
    get()
      .fetchFileContent(file.path)
      .then((content) => {
        set((s) => ({
          openTabs: s.openTabs.map((t) => (t.id === newTab.id ? { ...t, content } : t)),
        }))
      })
  },

  closeTab: (tabId) => {
    const state = get()
    const idx = state.openTabs.findIndex((t) => t.id === tabId)
    if (idx === -1) return
    const tabs = state.openTabs.filter((t) => t.id !== tabId)
    let activeTabId = state.activeTabId
    if (state.activeTabId === tabId) {
      activeTabId = tabs[Math.min(idx, tabs.length - 1)]?.id ?? null
    }
    set({ openTabs: tabs, activeTabId })
  },

  setActiveTab: (tabId) => set({ activeTabId: tabId }),
  setActiveDiffFile: (fileId) => set({ activeDiffFileId: fileId }),
  setDiffViewMode: (mode) => set({ diffViewMode: mode }),
  setRevealAt: (fn) => set({ revealAt: fn }),

  // ============ Fetch Actions ============

  fetchFileTree: async () => {
    const { workspacePath } = get()
    if (!workspacePath) return
    set({ loading: true, error: null })
    try {
      const result = await browseDirectory(workspacePath)
      if (result.success) {
        const tree = result.data.entries.map((e) => entryToFileNode(e, workspacePath))
        set({ fileTree: tree, loading: false })
        // 自动恢复顶层展开文件夹的子项(刷新后懒加载状态重建)
        const { expandedFolders, fetchFolderChildren } = get()
        for (const node of tree) {
          if (node.type === 'folder' && expandedFolders.has(node.id)) {
            void fetchFolderChildren(node.id)
          }
        }
      } else {
        set({ loading: false, error: result.error ?? '加载文件树失败' })
      }
    } catch (e) {
      set({ loading: false, error: (e as Error).message })
    }
  },

  fetchFolderChildren: async (folderId: string) => {
    const state = get()
    if (!state.workspacePath) return
    // 已加载则跳过(防止自动恢复时重复 fetch)
    if (state.loadedFolders.has(folderId)) return
    const folder = findNode(state.fileTree, folderId)
    if (!folder || folder.type !== 'folder') return
    try {
      const result = await browseDirectory(folder.path)
      if (result.success) {
        const children = result.data.entries.map((e) => entryToFileNode(e, folder.id))
        set({
          fileTree: updateTreeChildren(state.fileTree, folderId, children),
          loadedFolders: new Set(state.loadedFolders).add(folderId),
        })
        // 递归恢复嵌套展开文件夹的子项
        const { expandedFolders, fetchFolderChildren } = get()
        for (const child of children) {
          if (child.type === 'folder' && expandedFolders.has(child.id)) {
            void fetchFolderChildren(child.id)
          }
        }
      }
    } catch (e) {
      logger.error('fetchFolderChildren error:', e)
    }
  },

  fetchFileContent: async (filePath: string) => {
    const { workspacePath } = get()
    if (!workspacePath) return ''
    try {
      const result = await readFile({ path: filePath, workspacePath })
      if (result.success) return result.data.content
      return ''
    } catch (e) {
      logger.error('fetchFileContent error:', e)
      return ''
    }
  },

  fetchDiffFiles: async () => {
    const { workspacePath } = get()
    if (!workspacePath) return
    try {
      // 2026-11-23:一次结构化 diff-stat 取回「状态 + 增删行数」;
      // 旧实现是 `git diff --name-status HEAD` 后每个文件再跑一次 numstat(N+1 子进程)。
      const result = await getWorkspaceGitDiffStat({ workspacePath })
      if (!result.success) {
        set({ diffFiles: [] })
        return
      }
      const diffFiles = mapGitDiffStatToDiffFiles(result.data.files)
      set({ diffFiles, activeDiffFileId: diffFiles[0]?.id ?? null })
    } catch (e) {
      logger.error('fetchDiffFiles error:', e)
      set({ diffFiles: [] })
    }
  },

  fetchGitLog: async () => {
    const { workspacePath } = get()
    if (!workspacePath) return
    try {
      const result = await getWorkspaceGitLog({ workspacePath, limit: 20 })
      if (!result.success) {
        set({ gitCommits: [] })
        return
      }
      set({
        gitCommits: result.data.commits.map((c) => ({
          id: c.hash,
          message: c.subject,
          author: c.author,
          time: c.date,
        })),
      })
    } catch (e) {
      logger.error('fetchGitLog error:', e)
      set({ gitCommits: [] })
    }
  },

  fetchGitBranches: async () => {
    const { workspacePath } = get()
    if (!workspacePath) return
    try {
      const result = await getWorkspaceGitBranches({ workspacePath })
      if (!result.success) return
      const branches = result.data.branches.map((b) => b.name)
      const current = result.data.branches.find((b) => b.current)?.name ?? 'main'
      set({ gitBranches: branches, gitCurrentBranch: current })
    } catch (e) {
      logger.error('fetchGitBranches error:', e)
    }
  },
}))
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
