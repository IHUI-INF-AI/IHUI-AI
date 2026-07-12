'use client'

import { Ticket, Headphones, Tag } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@ihui/ui'
import { TicketsPanel } from './TicketsPanel'
import { AgentsPanel } from './AgentsPanel'
import { CategoriesPanel } from './CategoriesPanel'

export default function AdminCustomerServicePage() {
  const t = useTranslations('admin.customerService')
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      <Tabs defaultValue="tickets">
        <TabsList>
          <TabsTrigger value="tickets" className="gap-1.5">
            <Ticket className="h-4 w-4" /> {t('tabTickets')}
          </TabsTrigger>
          <TabsTrigger value="agents" className="gap-1.5">
            <Headphones className="h-4 w-4" /> {t('tabAgents')}
          </TabsTrigger>
          <TabsTrigger value="categories" className="gap-1.5">
            <Tag className="h-4 w-4" /> {t('tabCategories')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tickets" className="mt-4">
          <TicketsPanel />
        </TabsContent>
        <TabsContent value="agents" className="mt-4">
          <AgentsPanel />
        </TabsContent>
        <TabsContent value="categories" className="mt-4">
          <CategoriesPanel />
        </TabsContent>
      </Tabs>
    </div>
  )
}
