// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { GroupsScreen as SharedGroupsScreen } from '@ihui/rn-app'
import type { GroupConfirmOptions, GroupFormValues, GroupView } from '@ihui/rn-app'
import { tokens } from '../theme/active-tokens'
import { NavBar } from '../components/NavBar'
import { NavChrome } from '../components/NavChrome'
import { appAlert } from '../components/BottomPops'
import { useAuthStore } from '../stores/auth-store'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/**
 * 我的群组薄壳 —— 渲染全部委托共享屏 `packages/app/src/features/groups/GroupsScreen.tsx`。
 *
 * 端点(与 web `/groups` 同源,按 apps/api/src/routes/groups.ts,前缀 /api/groups):
 *  - GET    /api/groups              → { list }(仅 status=active)
 *  - POST   /api/groups              → 201 { group }
 *  - PATCH  /api/groups/:id          → { group }(仅群主或 admin)
 *  - DELETE /api/groups/:id          → { ok }(仅群主或 admin)
 *  - POST   /api/groups/:id/members  → { member }(body: { userId })
 *
 * 契约缺口(不搬假能力):后端没有 GET /api/groups/:id 与成员列表端点,
 * 所以共享屏只保留"按用户 ID 添加成员"这条真能力。
 *
 * 此前本屏自建 464 行 UI + 数据,共享层 613 行零渲染;现共享屏为唯一实现,
 * 小程序经 @rn-shells 跟随本壳。
 */
export default function GroupsScreen() {
  const { t, locale } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()
  const currentUserId = useAuthStore((s) => s.user?.id)

  const [groups, setGroups] = useState<GroupView[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetchApi<{ list: GroupView[] }>('/api/groups')
      if (!res.success) throw new Error(res.error || t('groups.loadFailed'))
      setGroups(res.data?.list ?? [])
    } catch (e) {
      setGroups([])
      setError(e instanceof Error && e.message ? e.message : t('groups.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  const formatDate = useCallback(
    (iso: string) => {
      const d = new Date(iso)
      if (Number.isNaN(d.getTime())) return iso
      return new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(d)
    },
    [locale],
  )

  /** 失败一律 alert 后 rethrow:共享屏靠抛出与否决定是否保留表单内容 */
  const onCreate = useCallback(
    async (values: GroupFormValues) => {
      try {
        const res = await fetchApi('/api/groups', {
          method: 'POST',
          body: JSON.stringify(values),
        })
        if (!res.success) throw new Error(res.error || t('groups.saveFailed'))
        await load()
      } catch (e) {
        appAlert(t('common.error'), e instanceof Error && e.message ? e.message : t('groups.saveFailed'))
        throw e
      }
    },
    [load, t],
  )

  const onUpdate = useCallback(
    async (id: string, values: GroupFormValues) => {
      try {
        const res = await fetchApi(`/api/groups/${id}`, {
          method: 'PATCH',
          body: JSON.stringify(values),
        })
        if (!res.success) throw new Error(res.error || t('groups.saveFailed'))
        await load()
      } catch (e) {
        appAlert(t('common.error'), e instanceof Error && e.message ? e.message : t('groups.saveFailed'))
        throw e
      }
    },
    [load, t],
  )

  const onDelete = useCallback(
    async (id: string) => {
      try {
        const res = await fetchApi(`/api/groups/${id}`, { method: 'DELETE' })
        if (!res.success) throw new Error(res.error || t('groups.deleteFailed'))
        await load()
      } catch (e) {
        appAlert(
          t('common.error'),
          e instanceof Error && e.message ? e.message : t('groups.deleteFailed'),
        )
        throw e
      }
    },
    [load, t],
  )

  const onAddMember = useCallback(
    async (id: string, userId: string) => {
      try {
        const res = await fetchApi(`/api/groups/${id}/members`, {
          method: 'POST',
          body: JSON.stringify({ userId }),
        })
        if (!res.success) throw new Error(res.error || t('groups.memberAddFailed'))
        appAlert(t('groups.addMember'), t('groups.memberAdded'))
        await load()
      } catch (e) {
        appAlert(
          t('common.error'),
          e instanceof Error && e.message ? e.message : t('groups.memberAddFailed'),
        )
        throw e
      }
    },
    [load, t],
  )

  const onConfirm = useCallback(
    (options: GroupConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        appAlert(options.title, options.message, [
          { text: t('common.cancel'), style: 'cancel', onPress: () => resolve(false) },
          {
            text: t('common.confirm'),
            style: options.destructive ? 'destructive' : 'default',
            onPress: () => resolve(true),
          },
        ])
      }),
    [t],
  )

  return (
    <View style={styles.container}>
      <NavChrome>
        <NavBar title={t('groups.title')} onBack={() => navigation.goBack()} />
      </NavChrome>
      <SharedGroupsScreen
        t={t}
        colorScheme={resolvedTheme}
        groups={groups}
        loading={loading}
        error={error}
        currentUserId={currentUserId ?? null}
        formatDate={formatDate}
        onRefresh={load}
        onCreate={onCreate}
        onUpdate={onUpdate}
        onDelete={onDelete}
        onAddMember={onAddMember}
        onConfirm={onConfirm}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.surface.bg },
})
