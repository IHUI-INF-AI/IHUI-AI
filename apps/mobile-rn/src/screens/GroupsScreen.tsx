// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { GroupsScreen as SharedGroupsScreen } from '@ihui/rn-app'
import type { GroupFormValues, GroupView } from '@ihui/rn-app/features/groups/GroupsScreen'
import { NavBar } from '../components/NavBar'
import { NavChrome } from '../components/NavChrome'
import { appAlert } from '../components/BottomPops'
import { useAuthStore } from '../stores/auth-store'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

type GroupRow = GroupView & { status?: string; updatedAt?: string }

/**
 * 我的群组 —— 与 web `/groups`(apps/web/app/(main)/groups)共用同一份渲染。
 *
 * 壳只保留数据层与平台件(NavBar / appAlert / 登录用户 id / 日期格式);
 * 列表、创建/编辑表单、成员面板、危险动作触发全部由共享屏渲染。
 *
 * 端点按 apps/api/src/routes/groups.ts 现读(前缀 /api/groups):
 *  - GET    /api/groups              ⇒ { list }(仅 status=active,支持 ?type=)
 *  - POST   /api/groups              ⇒ 201 { group }
 *  - PATCH  /api/groups/:id          ⇒ { group }(仅群主或 admin)
 *  - DELETE /api/groups/:id          ⇒ { ok }(仅群主或 admin)
 *  - POST   /api/groups/:id/members  ⇒ { member }(body: { userId })
 */
export function GroupsScreen() {
  const { t, locale } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()
  const currentUserId = useAuthStore((s) => s.user?.id)

  const [groups, setGroups] = useState<GroupView[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

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

  const load = useCallback(async () => {
    setLoadError(null)
    try {
      const res = await fetchApi<{ list: GroupRow[] }>('/api/groups')
      if (!res.success) throw new Error(res.error)
      setGroups(res.data?.list ?? [])
    } catch {
      setGroups([])
      setLoadError(t('groups.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  const handleCreate = async (values: GroupFormValues) => {
    const res = await fetchApi('/api/groups', {
      method: 'POST',
      body: JSON.stringify({
        name: values.name,
        ...(values.description ? { description: values.description } : {}),
      }),
    })
    if (!res.success) throw new Error(res.error)
    await load()
  }

  const handleUpdate = async (id: string, values: GroupFormValues) => {
    const res = await fetchApi(`/api/groups/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        name: values.name,
        ...(values.description ? { description: values.description } : {}),
      }),
    })
    if (!res.success) throw new Error(res.error)
    await load()
  }

  const handleDelete = async (id: string) => {
    const res = await fetchApi(`/api/groups/${id}`, { method: 'DELETE' })
    if (!res.success) throw new Error(res.error)
    await load()
  }

  const handleAddMember = async (id: string, userId: string) => {
    const res = await fetchApi(`/api/groups/${id}/members`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    })
    if (!res.success) throw new Error(res.error)
    const doneTitle = t('groups.addMember')
    appAlert(doneTitle, t('groups.memberAdded'))
    await load()
  }

  const handleConfirm = (options: { title: string; message: string; destructive?: boolean }) =>
    new Promise<boolean>((resolve) => {
      appAlert(options.title, options.message, [
        { text: t('common.cancel'), style: 'cancel', onPress: () => resolve(false) },
        {
          text: t('common.confirm'),
          style: options.destructive ? 'destructive' : 'default',
          onPress: () => resolve(true),
        },
      ])
    })

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
        error={loadError}
        currentUserId={currentUserId ?? null}
        formatDate={formatDate}
        onRefresh={load}
        onCreate={handleCreate}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
        onAddMember={handleAddMember}
        onConfirm={handleConfirm}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
})

export default GroupsScreen
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
