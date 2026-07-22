import { create } from 'zustand'
import {
  browseDirectory,
  readFile,
  runCommand,
  type BrowseEntry,
} from '@ihui/api-client'
import type {
  ViewPanelType,
  IDETabType,
  FileNode,
  EditorTab,
  DiffFile,
  DiffViewMode,
} from '@ihui/types'

/** 扩展名 → 语言映射 */
const EXT_LANG: Record<string, string> = {
  ts: 'typescript', tsx: 'tsx', js: 'javascript', jsx: 'jsx',
  json: 'json', css: 'css', scss: 'scss', html: 'html', md: 'markdown',
  py: 'python', go: 'go', rs: 'rust', sh: 'shell', yml: 'yaml', yaml: 'yaml',
  sql: 'sql', xml: 'xml', svg: 'xml', vue: 'vue', svelte: 'svelte',
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

  // UI Actions
  setActiveView: (view: ViewPanelType) => void
  setActiveTopTab: (tab: IDETabType) => void
  setWorkspacePath: (path: string) => void
  toggleFolder: (folderId: string) => void
  selectFile: (fileId: string) => void
  openFile: (file: FileNode) => void
  closeTab: (tabId: string) => void
  setActiveTab: (tabId: string) => void
  setActiveDiffFile: (fileId: string) => void
  setDiffViewMode: (mode: DiffViewMode) => void

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
    set({ expandedFolders: next })
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
    get().fetchFileContent(file.path).then((content) => {
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
      }
    } catch (e) {
      console.error('fetchFolderChildren error:', e)
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
      console.error('fetchFileContent error:', e)
      return ''
    }
  },

  fetchDiffFiles: async () => {
    const { workspacePath } = get()
    if (!workspacePath) return
    try {
      // 获取 git diff --name-status 变更文件列表
      const result = await runCommand({
        command: 'git diff --name-status HEAD',
        workspacePath,
      })
      if (!result.success || !result.data.stdout.trim()) {
        set({ diffFiles: [] })
        return
      }
      // 解析变更列表
      const lines = result.data.stdout.trim().split('\n').filter(Boolean)
      const diffFiles: DiffFile[] = []
      for (const line of lines) {
        const [status, filename] = line.split('\t')
        if (!filename) continue
        const ext = filename.split('.').pop()?.toLowerCase() ?? ''
        const statusMap: Record<string, DiffFile['status']> = {
          A: 'added', M: 'modified', D: 'deleted', R: 'renamed',
        }
        // 获取 diff 统计
        const statResult = await runCommand({
          command: `git diff --numstat HEAD -- "${filename}"`,
          workspacePath,
        })
        let additions = 0
        let deletions = 0
        if (statResult.success && statResult.data.stdout.trim()) {
          const parts = statResult.data.stdout.trim().split('\t')
          additions = parseInt(parts[0] ?? '0', 10) || 0
          deletions = parseInt(parts[1] ?? '0', 10) || 0
        }
        diffFiles.push({
          id: `diff-${filename}`,
          filename,
          status: statusMap[status?.[0] ?? 'M'] ?? 'modified',
          oldContent: '',
          newContent: '',
          additions,
          deletions,
          language: EXT_LANG[ext] ?? 'text',
        })
      }
      set({ diffFiles, activeDiffFileId: diffFiles[0]?.id ?? null })
    } catch (e) {
      console.error('fetchDiffFiles error:', e)
      set({ diffFiles: [] })
    }
  },

  fetchGitLog: async () => {
    const { workspacePath } = get()
    if (!workspacePath) return
    try {
      const result = await runCommand({
        command: 'git log -20 --pretty=format:%H%x00%an%x00%ar%x00%s',
        workspacePath,
      })
      if (!result.success || !result.data.stdout.trim()) {
        set({ gitCommits: [] })
        return
      }
      const commits = result.data.stdout
        .trim()
        .split('\n')
        .filter(Boolean)
        .map((line) => {
          const [id, author, time, ...msgParts] = line.split('\x00')
          return {
            id: id ?? '',
            message: msgParts.join('\x00'),
            author: author ?? '',
            time: time ?? '',
          }
        })
      set({ gitCommits: commits })
    } catch (e) {
      console.error('fetchGitLog error:', e)
      set({ gitCommits: [] })
    }
  },

  fetchGitBranches: async () => {
    const { workspacePath } = get()
    if (!workspacePath) return
    try {
      const result = await runCommand({
        command: 'git branch --list',
        workspacePath,
      })
      if (!result.success) return
      const lines = result.data.stdout.trim().split('\n').filter(Boolean)
      const branches = lines.map((l) => l.replace(/^\*?\s+/, '').trim()).filter(Boolean)
      const current = lines.find((l) => l.startsWith('*'))?.replace(/^\*\s+/, '').trim() ?? 'main'
      set({ gitBranches: branches, gitCurrentBranch: current })
    } catch (e) {
      console.error('fetchGitBranches error:', e)
    }
  },
}))
