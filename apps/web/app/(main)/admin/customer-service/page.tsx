'use client'

import { Ticket, Headphones, Tag } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@ihui/ui'
import { TicketsPanel } from './TicketsPanel'
import { AgentsPanel } from './AgentsPanel'
import { CategoriesPanel } from './CategoriesPanel'

export default function AdminCustomerServicePage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">客服管理</h1>
        <p className="mt-1 text-sm text-muted-foreground">工单管理、坐席分配与服务评级</p>
      </div>

      <Tabs defaultValue="tickets">
        <TabsList>
          <TabsTrigger value="tickets" className="gap-1.5">
            <Ticket className="h-4 w-4" /> 工单管理
          </TabsTrigger>
          <TabsTrigger value="agents" className="gap-1.5">
            <Headphones className="h-4 w-4" /> 坐席管理
          </TabsTrigger>
          <TabsTrigger value="categories" className="gap-1.5">
            <Tag className="h-4 w-4" /> 分类管理
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
