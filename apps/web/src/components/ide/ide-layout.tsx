'use client'
import * as React from 'react'
import { useTranslations } from 'next-intl'
import { useIDEWorkspace } from '@/stores/ide-workspace'
import { useIDEShortcuts } from '@/hooks/use-ide-shortcuts'
import { IDETopBar } from './ide-top-bar'
import { ActivityBar } from './activity-bar'
import { FileExplorer } from './file-explorer'
import { SearchPanel } from './search-panel'
import { SourceControlPanel } from './source-control-panel'
import { DebugPanel } from './debug-panel'
import { ApplicationsPanel } from './applications-panel'
import { CodeEditorPane } from './code-editor-pane'
import { DiffViewerPane } from './diff-viewer-pane'
import { StatusBar } from './status-bar'

/** 根据活动视图渲染左侧面板 */
function SidePanel() {
  const { activeView } = useIDEWorkspace()
  switch (activeView) {
    case 'files':
      return <FileExplorer />
    case 'search':
      return <SearchPanel />
    case 'source-control':
      return <SourceControlPanel />
    case 'debug':
      return <DebugPanel />
    case 'applications':
      return <ApplicationsPanel />
    default:
      return null
  }
}

/** 根据顶部 tab 类型渲染主内容区 */
function MainContent() {
  const { activeTopTab } = useIDEWorkspace()
  const t = useTranslations('ide')
  switch (activeTopTab) {
    case 'editor':
      return <CodeEditorPane />
    case 'code-changes':
      return <DiffViewerPane />
    case 'document':
      return <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">{t('layout.documentView')}</div>
    case 'terminal':
      return <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">{t('layout.terminalView')}</div>
    case 'browser':
      return <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">{t('layout.browserView')}</div>
    case 'figma':
      return <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">{t('layout.figmaView')}</div>
    case 'agent':
      return <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">{t('layout.agentView')}</div>
    case 'mcp':
      return <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">{t('layout.mcpView')}</div>
    case 'settings':
      return <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">{t('layout.settingsView')}</div>
    default:
      return <CodeEditorPane />
  }
}

export function IDELayout() {
  useIDEShortcuts()
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-border bg-background">
      <IDETopBar />
      <div className="flex min-h-0 flex-1">
        <ActivityBar />
        <SidePanel />
        <div className="flex min-w-0 flex-1 flex-col">
          <MainContent />
        </div>
      </div>
      <StatusBar />
    </div>
  )
}
