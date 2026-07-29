import { useEffect, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { getAiCareers, type AiCareerItem } from '@ihui/api-client'
import {
  RecruitmentScreen as SharedRecruitmentScreen,
  type RecruitmentJob,
  type RecruitmentCategory,
} from '@ihui/rn-app'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/** Map backend category string to local TABS category, default 'tech' if unmatched */
function parseCategory(raw: string | undefined): Exclude<RecruitmentCategory, 'all'> {
  if (raw === 'tech' || raw === 'product' || raw === 'design' || raw === 'ops') return raw
  return 'tech'
}

/** AiCareerItem -> RecruitmentJob field mapping (strongly typed, backend fields are explicit) */
function mapCareerToJob(item: AiCareerItem): RecruitmentJob {
  return {
    id: item.id,
    position: item.title,
    company: item.company || '—',
    salary: item.salary || '面议',
    location: item.location || '—',
    category: parseCategory(item.category),
    tags: item.tags ?? [],
    experience: item.experience || '—',
    education: item.education || '—',
    description: item.description ?? item.content ?? '',
    requirements: item.requirements ?? [],
  }
}

/** 招聘列表:职位筛选 / 列表 / 详情 / 投递。 */
export default function RecruitmentScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const [activeTab, setActiveTab] = useState<RecruitmentCategory>('all')
  const [selected, setSelected] = useState<RecruitmentJob | null>(null)
  const [applied, setApplied] = useState<Set<string>>(new Set())
  const [jobs, setJobs] = useState<RecruitmentJob[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // 从 @ihui/api-client 加载真实招聘数据,替换原 MOCK_JOBS。
  // cancelled flag 防止组件卸载后 setState 导致内存泄漏。
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await getAiCareers({ page: 1, pageSize: 50 })
        if (cancelled) return
        if (res.success) {
          setJobs(res.data.list.map(mapCareerToJob))
        } else {
          setError(res.error || t('recruitment.loadFailed'))
        }
      } catch {
        if (!cancelled) setError(t('recruitment.loadFailed'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [t])

  const onApply = (job: RecruitmentJob) => {
    setApplied((prev) => new Set(prev).add(job.id))
    setSelected(null)
  }

  return (
    <SharedRecruitmentScreen
      t={t}
      jobs={jobs}
      activeTab={activeTab}
      appliedIds={applied}
      selected={selected}
      loading={loading}
      error={error}
      onSelectTab={setActiveTab}
      onSelectJob={setSelected}
      onApply={onApply}
      onBack={() => navigation.goBack()}
    />
  )
}
