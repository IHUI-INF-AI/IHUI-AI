'use client'

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@ihui/ui'
import { DiffPreview } from '@/components/ai/diff-preview'
import { InlineDiffViewer } from '@/components/ai/inline-diff-viewer'
import { TaskListPanel } from '@/components/ai/task-list-panel'
import { RoutinesPanel } from '@/components/ai/routines-panel'
import { WorkspaceFolderSelector } from '@/components/ai/workspace-folder-selector'
import { AI_MOCK } from './helpers'

interface Props {
  selectedFolder?: string
  onSelectFolder: (id: string) => void
}

export function AIWorkspaceTabs({ selectedFolder, onSelectFolder }: Props) {
  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold">AI 工作区</h2>
      <Tabs defaultValue="diff">
        <TabsList>
          <TabsTrigger value="diff">Diff 对比</TabsTrigger>
          <TabsTrigger value="tasks">任务清单</TabsTrigger>
          <TabsTrigger value="routines">例行程序</TabsTrigger>
          <TabsTrigger value="folders">文件夹</TabsTrigger>
        </TabsList>
        <TabsContent value="diff" className="space-y-4">
          <DiffPreview
            oldContent={AI_MOCK.diffOld}
            newContent={AI_MOCK.diffNew}
            filename="src/auth.ts"
            language="ts"
          />
          <InlineDiffViewer content={AI_MOCK.inlineDiff} filename="src/auth.ts" />
        </TabsContent>
        <TabsContent value="tasks">
          <TaskListPanel tasks={AI_MOCK.tasks} />
        </TabsContent>
        <TabsContent value="routines">
          <RoutinesPanel routines={AI_MOCK.routines} />
        </TabsContent>
        <TabsContent value="folders">
          <WorkspaceFolderSelector
            folders={AI_MOCK.folders}
            selected={selectedFolder}
            onSelect={onSelectFolder}
          />
        </TabsContent>
      </Tabs>
    </section>
  )
}
