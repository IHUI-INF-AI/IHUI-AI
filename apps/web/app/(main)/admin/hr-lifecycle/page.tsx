// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import {
  LayoutDashboard,
  FileSignature,
  UserPlus,
  MessagesSquare,
  LogOut,
  Banknote,
} from 'lucide-react'

import { HasPermi } from '@/components/auth/HasPermi'
import { FeaturePageShell } from '@/components/layout'
import { HR_VIEW_PERM, RECRUIT_PERM } from './types'
import { BoardTab, ContractsTab, RecruitTab, ResignTab, PayoutTab } from './tabs'
import { InterviewTab } from './interview-tab'

/**
 * 人事生命周期(2026-11-23 立):入职前(招聘) → 合同/试用 → 离职 → 发薪闭环。
 *
 * 本页之前,人事动作散在考勤/薪资两个页面,合同到期没人提醒、离职交接靠 Excel、
 * 代发文件要手工拼 —— 这里把"一个员工从候选到离场"的链路收进一页。
 */

type TabKey = 'board' | 'contracts' | 'recruit' | 'interview' | 'resign' | 'payout'

export default function HrLifecyclePage() {
  const t = useTranslations('hrLifecycle')
  const [tab, setTab] = React.useState<TabKey>('board')

  const tabs: Array<{
    key: TabKey
    label: string
    icon: React.ComponentType<{ className?: string }>
  }> = [
    { key: 'board', label: t('tabBoard'), icon: LayoutDashboard },
    { key: 'contracts', label: t('tabContracts'), icon: FileSignature },
    { key: 'recruit', label: t('tabRecruit'), icon: UserPlus },
    { key: 'interview', label: t('tabInterview'), icon: MessagesSquare },
    { key: 'resign', label: t('tabResign'), icon: LogOut },
    { key: 'payout', label: t('tabPayout'), icon: Banknote },
  ]

  return (
    <FeaturePageShell title={t('title')} description={t('desc')}>
      <HasPermi
        code={HR_VIEW_PERM}
        fallback={<p className="text-sm text-muted-foreground">{t('noPerm')}</p>}
      >
        <div className="mb-3 flex flex-wrap gap-1">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs ${
                tab === key ? 'bg-muted font-medium' : 'text-muted-foreground hover:bg-muted/60'
              }`}
              onClick={() => setTab(key)}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        {tab === 'board' && <BoardTab />}
        {tab === 'contracts' && <ContractsTab />}
        {tab === 'recruit' && (
          <HasPermi
            code={RECRUIT_PERM}
            fallback={<p className="text-sm text-muted-foreground">{t('recruitNoPerm')}</p>}
          >
            <RecruitTab />
          </HasPermi>
        )}
        {tab === 'interview' && (
          <HasPermi
            code={RECRUIT_PERM}
            fallback={<p className="text-sm text-muted-foreground">{t('recruitNoPerm')}</p>}
          >
            <InterviewTab />
          </HasPermi>
        )}
        {tab === 'resign' && <ResignTab />}
        {tab === 'payout' && <PayoutTab />}
      </HasPermi>
    </FeaturePageShell>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
