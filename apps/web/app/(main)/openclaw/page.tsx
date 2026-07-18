'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@ihui/ui'
import { Brain, Package, Clock, Radio, Cpu, Mic, PenTool, Globe } from 'lucide-react'

import {
  MemoryPanel,
  SkillsPanel,
  AutomationPanel,
  IntegrationsPanel,
  ModelsPanel,
  VoicePanel,
  CanvasPanel,
  BrowserPanel,
} from '@/components/openclaw'

export default function OpenClawPage() {
  const t = useTranslations('floatingChat.openclaw')

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">OpenClaw</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      <Tabs defaultValue="memory" className="space-y-4">
        <TabsList className="flex w-full flex-wrap gap-1">
          <TabsTrigger value="memory" className="flex items-center gap-1.5">
            <Brain className="h-3.5 w-3.5" />
            {t('tabMemory')}
          </TabsTrigger>
          <TabsTrigger value="skills" className="flex items-center gap-1.5">
            <Package className="h-3.5 w-3.5" />
            {t('tabSkills')}
          </TabsTrigger>
          <TabsTrigger value="automation" className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            {t('tabAutomation')}
          </TabsTrigger>
          <TabsTrigger value="integrations" className="flex items-center gap-1.5">
            <Radio className="h-3.5 w-3.5" />
            {t('tabIntegrations')}
          </TabsTrigger>
          <TabsTrigger value="models" className="flex items-center gap-1.5">
            <Cpu className="h-3.5 w-3.5" />
            {t('tabModels')}
          </TabsTrigger>
          <TabsTrigger value="voice" className="flex items-center gap-1.5">
            <Mic className="h-3.5 w-3.5" />
            {t('tabVoice')}
          </TabsTrigger>
          <TabsTrigger value="canvas" className="flex items-center gap-1.5">
            <PenTool className="h-3.5 w-3.5" />
            {t('tabCanvas')}
          </TabsTrigger>
          <TabsTrigger value="browser" className="flex items-center gap-1.5">
            <Globe className="h-3.5 w-3.5" />
            {t('tabBrowser')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="memory" className="mt-0">
          <MemoryPanel />
        </TabsContent>
        <TabsContent value="skills" className="mt-0">
          <SkillsPanel />
        </TabsContent>
        <TabsContent value="automation" className="mt-0">
          <AutomationPanel />
        </TabsContent>
        <TabsContent value="integrations" className="mt-0">
          <IntegrationsPanel />
        </TabsContent>
        <TabsContent value="models" className="mt-0">
          <ModelsPanel />
        </TabsContent>
        <TabsContent value="voice" className="mt-0">
          <VoicePanel />
        </TabsContent>
        <TabsContent value="canvas" className="mt-0">
          <CanvasPanel />
        </TabsContent>
        <TabsContent value="browser" className="mt-0">
          <BrowserPanel />
        </TabsContent>
      </Tabs>
    </div>
  )
}
