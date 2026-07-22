import { create } from 'zustand'
import type {
  ViewPanelType,
  IDETabType,
  FileNode,
  EditorTab,
  DiffFile,
  DiffViewMode,
} from '@ihui/types'

/** 示例文件树(模拟项目结构) */
const SAMPLE_FILE_TREE: FileNode[] = [
  {
    id: 'src',
    name: 'src',
    path: '/src',
    type: 'folder',
    children: [
      {
        id: 'src-components',
        name: 'components',
        path: '/src/components',
        type: 'folder',
        children: [
          {
            id: 'src-components-ide',
            name: 'ide',
            path: '/src/components/ide',
            type: 'folder',
            children: [
              {
                id: 'ide-layout',
                name: 'ide-layout.tsx',
                path: '/src/components/ide/ide-layout.tsx',
                type: 'file',
                language: 'tsx',
                content: `import * as React from 'react'\nimport { ActivityBar } from './activity-bar'\nimport { IDETopBar } from './ide-top-bar'\nimport { FileExplorer } from './file-explorer'\nimport { EditorTabBar } from './editor-tab-bar'\nimport { CodeEditorPane } from './code-editor-pane'\nimport { StatusBar } from './status-bar'\n\nexport function IDELayout() {\n  return (\n    <div className="flex h-full flex-col">\n      <IDETopBar />\n      <div className="flex flex-1 overflow-hidden">\n        <ActivityBar />\n        <FileExplorer />\n        <div className="flex flex-1 flex-col">\n          <EditorTabBar />\n          <CodeEditorPane />\n        </div>\n      </div>\n      <StatusBar />\n    </div>\n  )\n}`,
              },
              {
                id: 'activity-bar',
                name: 'activity-bar.tsx',
                path: '/src/components/ide/activity-bar.tsx',
                type: 'file',
                language: 'tsx',
                content: `import * as React from 'react'\nimport { FileSearch, Search, GitBranch, Bug, AppWindow } from 'lucide-react'\n\nconst ITEMS = [\n  { id: 'files', icon: FileSearch, label: '文件' },\n  { id: 'search', icon: Search, label: '搜索' },\n  { id: 'source-control', icon: GitBranch, label: '源代码控制' },\n  { id: 'debug', icon: Bug, label: '调试' },\n  { id: 'applications', icon: AppWindow, label: '应用' },\n] as const\n\nexport function ActivityBar() {\n  return (\n    <div className="flex w-12 flex-col items-center gap-1 py-2">\n      {ITEMS.map((item) => (\n        <button key={item.id} className="rounded-md p-2 hover:bg-muted">\n          <item.icon className="h-5 w-5" />\n        </button>\n      ))}\n    </div>\n  )\n}`,
              },
              {
                id: 'file-explorer',
                name: 'file-explorer.tsx',
                path: '/src/components/ide/file-explorer.tsx',
                type: 'file',
                language: 'tsx',
                content: `import * as React from 'react'\nimport { Folder, FileText } from 'lucide-react'\n\nexport function FileExplorer() {\n  return (\n    <div className="w-60 overflow-auto">\n      <div className="p-2 text-xs font-medium text-muted-foreground">文件</div>\n    </div>\n  )\n}`,
              },
              {
                id: 'editor-tab-bar',
                name: 'editor-tab-bar.tsx',
                path: '/src/components/ide/editor-tab-bar.tsx',
                type: 'file',
                language: 'tsx',
                content: `export function EditorTabBar() {\n  return (\n    <div className="flex h-9 items-center gap-1 px-2">\n      <span className="text-sm">editor-tab-bar</span>\n    </div>\n  )\n}`,
              },
              {
                id: 'code-editor-pane',
                name: 'code-editor-pane.tsx',
                path: '/src/components/ide/code-editor-pane.tsx',
                type: 'file',
                language: 'tsx',
                content: `export function CodeEditorPane() {\n  return (\n    <div className="flex-1 overflow-auto">\n      <pre className="p-4 text-sm">code here</pre>\n    </div>\n  )\n}`,
              },
              {
                id: 'status-bar',
                name: 'status-bar.tsx',
                path: '/src/components/ide/status-bar.tsx',
                type: 'file',
                language: 'tsx',
                content: `export function StatusBar() {\n  return (\n    <div className="flex h-6 items-center px-3 text-xs">\n      <span>main</span>\n    </div>\n  )\n}`,
              },
            ],
          },
        ],
      },
      {
        id: 'src-stores',
        name: 'stores',
        path: '/src/stores',
        type: 'folder',
        children: [
          {
            id: 'ide-workspace-store',
            name: 'ide-workspace.ts',
            path: '/src/stores/ide-workspace.ts',
            type: 'file',
            language: 'ts',
            content: `import { create } from 'zustand'\n\nexport const useIDEWorkspace = create(() => ({}))`,
          },
        ],
      },
    ],
  },
  {
    id: 'package-json',
    name: 'package.json',
    path: '/package.json',
    type: 'file',
    language: 'json',
    content: `{\n  "name": "@ihui/web",\n  "version": "1.0.0",\n  "private": true\n}`,
  },
  {
    id: 'tsconfig',
    name: 'tsconfig.json',
    path: '/tsconfig.json',
    type: 'file',
    language: 'json',
    content: `{\n  "compilerOptions": {\n    "target": "ES2022",\n    "module": "ESNext",\n    "jsx": "preserve"\n  }\n}`,
  },
]

/** 示例 diff 文件 */
const SAMPLE_DIFF_FILES: DiffFile[] = [
  {
    id: 'diff-1',
    filename: 'src/components/ide/ide-layout.tsx',
    status: 'added',
    oldContent: '',
    newContent: `import * as React from 'react'\nimport { ActivityBar } from './activity-bar'\nimport { IDETopBar } from './ide-top-bar'\nimport { FileExplorer } from './file-explorer'\nimport { EditorTabBar } from './editor-tab-bar'\nimport { CodeEditorPane } from './code-editor-pane'\nimport { StatusBar } from './status-bar'\n\nexport function IDELayout() {\n  return (\n    <div className="flex h-full flex-col">\n      <IDETopBar />\n      <div className="flex flex-1 overflow-hidden">\n        <ActivityBar />\n        <FileExplorer />\n        <div className="flex flex-1 flex-col">\n          <EditorTabBar />\n          <CodeEditorPane />\n        </div>\n      </div>\n      <StatusBar />\n    </div>\n  )\n}`,
    additions: 18,
    deletions: 0,
    language: 'tsx',
  },
  {
    id: 'diff-2',
    filename: 'src/components/ide/activity-bar.tsx',
    status: 'modified',
    oldContent: `export function ActivityBar() {\n  return (\n    <div className="w-12">\n      <span>Activity</span>\n    </div>\n  )\n}`,
    newContent: `import * as React from 'react'\nimport { FileSearch, Search, GitBranch, Bug, AppWindow } from 'lucide-react'\n\nexport function ActivityBar() {\n  return (\n    <div className="flex w-12 flex-col items-center gap-1 py-2">\n      <button className="rounded-md p-2 hover:bg-muted">\n        <FileSearch className="h-5 w-5" />\n      </button>\n    </div>\n  )\n}`,
    additions: 8,
    deletions: 3,
    language: 'tsx',
  },
  {
    id: 'diff-3',
    filename: 'src/stores/ide-workspace.ts',
    status: 'modified',
    oldContent: `import { create } from 'zustand'\n\nexport const useIDEWorkspace = create(() => ({}))`,
    newContent: `import { create } from 'zustand'\nimport type { FileNode, EditorTab } from '@ihui/types'\n\ninterface IDEState {\n  fileTree: FileNode[]\n  openTabs: EditorTab[]\n  activeTabId: string | null\n}\n\nexport const useIDEWorkspace = create<IDEState>(() => ({\n  fileTree: [],\n  openTabs: [],\n  activeTabId: null,\n}))`,
    additions: 8,
    deletions: 1,
    language: 'ts',
  },
]

interface IDEWorkspaceState {
  /** 当前活动视图(files/search/source-control/debug/applications) */
  activeView: ViewPanelType
  /** 顶部 tab 类型 */
  activeTopTab: IDETabType
  /** 文件树 */
  fileTree: FileNode[]
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

  // Actions
  setActiveView: (view: ViewPanelType) => void
  setActiveTopTab: (tab: IDETabType) => void
  toggleFolder: (folderId: string) => void
  selectFile: (fileId: string) => void
  openFile: (file: FileNode) => void
  closeTab: (tabId: string) => void
  setActiveTab: (tabId: string) => void
  setActiveDiffFile: (fileId: string) => void
  setDiffViewMode: (mode: DiffViewMode) => void
}

export const useIDEWorkspace = create<IDEWorkspaceState>((set) => ({
  activeView: 'files',
  activeTopTab: 'editor',
  fileTree: SAMPLE_FILE_TREE,
  expandedFolders: new Set(['src', 'src-components', 'src-components-ide']),
  selectedFileId: 'ide-layout',
  openTabs: [
    {
      id: 'tab-ide-layout',
      fileId: 'ide-layout',
      filename: 'ide-layout.tsx',
      path: '/src/components/ide/ide-layout.tsx',
      language: 'tsx',
      content: SAMPLE_FILE_TREE[0]?.children?.[0]?.children?.[0]?.children?.[0]?.content ?? '',
      isDirty: false,
    },
  ],
  activeTabId: 'tab-ide-layout',
  diffFiles: SAMPLE_DIFF_FILES,
  activeDiffFileId: 'diff-1',
  diffViewMode: 'split',

  setActiveView: (view) => set({ activeView: view }),
  setActiveTopTab: (tab) => set({ activeTopTab: tab }),
  toggleFolder: (folderId) =>
    set((state) => {
      const next = new Set(state.expandedFolders)
      if (next.has(folderId)) next.delete(folderId)
      else next.add(folderId)
      return { expandedFolders: next }
    }),
  selectFile: (fileId) => set({ selectedFileId: fileId }),
  openFile: (file) =>
    set((state) => {
      if (file.type !== 'file') return state
      const existing = state.openTabs.find((t) => t.fileId === file.id)
      if (existing) return { activeTabId: existing.id, selectedFileId: file.id }
      const newTab: EditorTab = {
        id: `tab-${file.id}`,
        fileId: file.id,
        filename: file.name,
        path: file.path,
        language: file.language ?? 'text',
        content: file.content ?? '',
        isDirty: false,
      }
      return {
        openTabs: [...state.openTabs, newTab],
        activeTabId: newTab.id,
        selectedFileId: file.id,
      }
    }),
  closeTab: (tabId) =>
    set((state) => {
      const idx = state.openTabs.findIndex((t) => t.id === tabId)
      if (idx === -1) return state
      const tabs = state.openTabs.filter((t) => t.id !== tabId)
      let activeTabId = state.activeTabId
      if (state.activeTabId === tabId) {
        activeTabId = tabs[Math.min(idx, tabs.length - 1)]?.id ?? null
      }
      return { openTabs: tabs, activeTabId }
    }),
  setActiveTab: (tabId) => set({ activeTabId: tabId }),
  setActiveDiffFile: (fileId) => set({ activeDiffFileId: fileId }),
  setDiffViewMode: (mode) => set({ diffViewMode: mode }),
}))
