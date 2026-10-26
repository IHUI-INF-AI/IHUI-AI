// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { createTeam, getTeams } from '@ihui/api-client'
import { formatDateOnly } from '@ihui/shared/utils/date-utils'
import {
  TeamsScreen as SharedTeamsScreen,
  type TeamCardItem,
  type TeamCreateForm,
} from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type LocalParamList = RootStackParamList & {
  Teams: undefined
  TeamWorkspace: { teamId: string }
}
type NavigationProp = NativeStackNavigationProp<LocalParamList>

const EMPTY_FORM: TeamCreateForm = { name: '', slug: '', description: '' }

/**
 * RN 端「协作团队列表」薄壳 —— 渲染全部委托共享屏
 * `packages/app/src/features/teams/TeamsScreen.tsx`,本文件只管平台侧:
 * 取词、主题、导航落点,以及 GET/POST /api/teams(对齐 web teams/page.tsx:26/:45)。
 *
 * 与既有 TeamScreen(分销团友, /distribution/team/*)同名相近但不同域,互不复用。
 */
export function TeamsScreen() {
  const navigation = useNavigation<NavigationProp>()
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const [teams, setTeams] = useState<TeamCardItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState<TeamCreateForm>(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true)
      else setLoading(true)
      try {
        const res = await getTeams()
        if (!res.success) {
          setError(res.error || t('teamsPage.loadFailed'))
          return
        }
        setTeams(
          (res.data.teams ?? []).map((team) => ({
            id: team.id,
            name: team.name,
            slug: team.slug,
            description: team.description,
            memberCount: team.memberCount,
            createdAt: formatDateOnly(team.createdAt),
          })),
        )
        setError(null)
      } catch {
        setError(t('teamsPage.loadFailed'))
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [t],
  )

  useEffect(() => {
    void load()
  }, [load])

  const handleCreate = useCallback(async () => {
    setFormError(null)
    if (!form.name.trim()) {
      setFormError(t('teamsPage.nameRequired'))
      return
    }
    if (!form.slug.trim()) {
      setFormError(t('teamsPage.slugRequired'))
      return
    }
    setCreating(true)
    try {
      const res = await createTeam({
        name: form.name.trim(),
        slug: form.slug.trim(),
        description: form.description.trim() || undefined,
      })
      if (!res.success) {
        setFormError(res.error || t('teamsPage.createFailed'))
        return
      }
      setCreateOpen(false)
      setForm(EMPTY_FORM)
      void load()
    } catch {
      setFormError(t('teamsPage.createFailed'))
    } finally {
      setCreating(false)
    }
  }, [form, load, t])

  return (
    <SharedTeamsScreen
      t={t}
      colorScheme={resolvedTheme}
      onBack={() => navigation.goBack()}
      loading={loading}
      refreshing={refreshing}
      error={error}
      teams={teams}
      onRefresh={() => void load(true)}
      onEnterTeam={(teamId) => navigation.navigate('TeamWorkspace', { teamId })}
      createOpen={createOpen}
      onCreateOpenChange={setCreateOpen}
      form={form}
      onFormChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
      formError={formError}
      creating={creating}
      onCreate={() => void handleCreate()}
    />
  )
}

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
