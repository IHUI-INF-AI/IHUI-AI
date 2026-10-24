// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 工作区屏(mobile-rn 原生实现,对应 Web 端 /workspace 与其子页 /workspace/permissions)。
 *
 * 平台说明:
 * - 消费 @ihui/api-client/endpoints/workspace 的 getWorkspaces / createWorkspace /
 *   deleteWorkspace(项目页)与 listAllWorkspacePermissions / setWorkspacePermission /
 *   deleteWorkspacePermission / getWorkspacePermissionDefault /
 *   setWorkspacePermissionDefault(权限页)。
 *   这一组返回 **ApiResult**(成功载荷在 res.data,失败原因在 res.error —— 不是 res.message),
 *   与 research / agent-runtime 那两组"失败即 throw"的端点形状不同,故此处按 success 分支处理。
 * - 权限档位措辞走唯一真源 `permissionTierWordKeys(mode)`(档位注册表在
 *   @ihui/types/permission-mode),**绝不裸显 accept-edits / bypass-permissions 这类英文枚举**;
 *   后端给了认不出的档位时落「未知模式」,不静默当默认档显示。
 * - 删除项目、删除权限配置、切到绕过权限档都是不可逆/高风险动作,一律 appAlert 二次确认。
 * - 样式与 McpStoreScreen 一致:Tailwind className + resolvedTheme 暗色适配 + NavBar。
 */
import { useCallback, useEffect, useState } from 'react'
import { RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { TextField } from '@ihui/rn-app'
import { appAlert } from '../components/BottomPops'
import {
  createWorkspace,
  deleteWorkspace,
  deleteWorkspacePermission,
  getWorkspacePermissionDefault,
  getWorkspaces,
  listAllWorkspacePermissions,
  setWorkspacePermission,
  setWorkspacePermissionDefault,
  type Workspace,
  type WorkspacePermission,
  type WorkspacePermissionMode,
} from '@ihui/api-client/endpoints/workspace'
import { PERMISSION_MODE_WIRE_VALUES } from '@ihui/types/permission-mode'
import { permissionTierWordKeys } from '@ihui/shared/chat'
import NavBar from '../components/NavBar'
import { NavChrome } from '../components/NavChrome'
import { useTheme } from '../context/ThemeContext'
import { useI18n } from '../i18n'
import { tokens } from '../theme/active-tokens'

const PAGE_SIZE = 50
/** 切到这一档会跳过审批门,必须在确认弹窗里把后果说清楚 */
const RISK_MODE: WorkspacePermissionMode = 'bypass-permissions'

type TabKey = 'projects' | 'permissions'

export function WorkspaceScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const [tab, setTab] = useState<TabKey>('projects')

  // ---- 项目 ----
  const [projects, setProjects] = useState<Workspace[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  // ---- 权限 ----
  const [permissions, setPermissions] = useState<WorkspacePermission[]>([])
  const [permLoading, setPermLoading] = useState(true)
  const [permError, setPermError] = useState('')
  const [defaultMode, setDefaultMode] = useState<WorkspacePermissionMode | null>(null)
  const [busyKey, setBusyKey] = useState('')

  const [refreshing, setRefreshing] = useState(false)

  const loadProjects = useCallback(async () => {
    setError('')
    try {
      const res = await getWorkspaces({ page: 1, pageSize: PAGE_SIZE })
      if (!res.success) {
        setError(res.error || t('workspace.loadFailed'))
        setProjects([])
        return
      }
      setProjects(res.data?.list ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : t('workspace.loadFailed'))
      setProjects([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [t])

  const loadPermissions = useCallback(async () => {
    setPermError('')
    try {
      const [listRes, defaultRes] = await Promise.all([
        listAllWorkspacePermissions(),
        getWorkspacePermissionDefault(),
      ])
      if (!listRes.success) {
        setPermError(listRes.error || t('workspace.permLoadFailed'))
        setPermissions([])
      } else {
        setPermissions(listRes.data?.permissions ?? [])
      }
      setDefaultMode(defaultRes.success ? (defaultRes.data?.mode ?? null) : null)
    } catch (e) {
      setPermError(e instanceof Error ? e.message : t('workspace.permLoadFailed'))
      setPermissions([])
    } finally {
      setPermLoading(false)
    }
  }, [t])

  useEffect(() => {
    void loadProjects()
    void loadPermissions()
  }, [loadPermissions, loadProjects])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    void loadProjects()
    void loadPermissions()
  }, [loadPermissions, loadProjects])

  const onSubmitProject = useCallback(() => {
    if (creating) return
    const trimmed = name.trim()
    if (!trimmed) {
      appAlert(t('workspace.create'), t('workspace.nameRequired'))
      return
    }
    setCreating(true)
    void (async () => {
      try {
        const res = await createWorkspace({
          name: trimmed,
          ...(description.trim() ? { description: description.trim() } : {}),
        })
        if (!res.success) throw new Error(res.error || t('workspace.createFailed'))
        setName('')
        setDescription('')
        setFormOpen(false)
        await loadProjects()
      } catch (e) {
        appAlert(
          t('workspace.createFailed'),
          e instanceof Error ? e.message : t('workspace.createFailed'),
        )
      } finally {
        setCreating(false)
      }
    })()
  }, [creating, description, loadProjects, name, t])

  const onDeleteProject = useCallback(
    (item: Workspace) => {
      appAlert(t('workspace.confirmDelete'), item.name, [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.confirm'),
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                const res = await deleteWorkspace(item.id)
                if (!res.success) throw new Error(res.error || t('workspace.deleteFailed'))
                await loadProjects()
              } catch (e) {
                appAlert(
                  t('workspace.deleteFailed'),
                  e instanceof Error ? e.message : t('workspace.deleteFailed'),
                )
              }
            })()
          },
        },
      ])
    },
    [loadProjects, t],
  )

  /** 切换某工作区的权限档;落到绕过权限档时先把后果讲清楚再确认 */
  const onSwitchMode = useCallback(
    (perm: WorkspacePermission, mode: WorkspacePermissionMode) => {
      const words = permissionTierWordKeys(mode)
      const title =
        mode === RISK_MODE ? t('workspace.permSwitchRisk') : t('workspace.permSwitchConfirm')
      appAlert(title, `${t(words.title)} · ${t(words.desc)}`, [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.confirm'),
          style: mode === RISK_MODE ? 'destructive' : 'default',
          onPress: () => {
            setBusyKey(perm.id)
            void (async () => {
              try {
                const res = await setWorkspacePermission({
                  workspacePath: perm.workspacePath,
                  name: perm.name,
                  mode,
                  ...(perm.techStack ? { techStack: perm.techStack } : {}),
                })
                if (!res.success) throw new Error(res.error || t('workspace.permSwitchFailed'))
                await loadPermissions()
              } catch (e) {
                appAlert(
                  t('workspace.permSwitchFailed'),
                  e instanceof Error ? e.message : t('workspace.permSwitchFailed'),
                )
              } finally {
                setBusyKey('')
              }
            })()
          },
        },
      ])
    },
    [loadPermissions, t],
  )

  /** 设置全局默认档(未显式配置的工作区回退到这一档) */
  const onSetDefaultMode = useCallback(
    (mode: WorkspacePermissionMode) => {
      setBusyKey('__default__')
      void (async () => {
        try {
          const res = await setWorkspacePermissionDefault(mode)
          if (!res.success) throw new Error(res.error || t('workspace.permDefaultFailed'))
          setDefaultMode(res.data?.mode ?? mode)
        } catch (e) {
          appAlert(
            t('workspace.permDefaultFailed'),
            e instanceof Error ? e.message : t('workspace.permDefaultFailed'),
          )
        } finally {
          setBusyKey('')
        }
      })()
    },
    [t],
  )

  const onDeletePermission = useCallback(
    (perm: WorkspacePermission) => {
      appAlert(t('workspace.permDeleteConfirm'), perm.workspacePath, [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.confirm'),
          style: 'destructive',
          onPress: () => {
            setBusyKey(perm.id)
            void (async () => {
              try {
                const res = await deleteWorkspacePermission(perm.workspacePath)
                if (!res.success) throw new Error(res.error || t('workspace.permDeleteFailed'))
                await loadPermissions()
              } catch (e) {
                appAlert(
                  t('workspace.permDeleteFailed'),
                  e instanceof Error ? e.message : t('workspace.permDeleteFailed'),
                )
              } finally {
                setBusyKey('')
              }
            })()
          },
        },
      ])
    },
    [loadPermissions, t],
  )

  const renderModeChips = useCallback(
    (current: string | null | undefined, onPick: (mode: WorkspacePermissionMode) => void) => (
      <View className="mt-2 flex-row flex-wrap">
        {PERMISSION_MODE_WIRE_VALUES.map((mode) => {
          const active = current === mode
          return (
            <TouchableOpacity
              key={mode}
              disabled={busyKey !== ''}
              onPress={() => onPick(mode)}
              className={`mb-2 mr-2 rounded-sm px-3 py-1.5 ${
                active ? 'bg-neutral-900 dark:bg-neutral-100' : 'bg-neutral-200 dark:bg-neutral-800'
              }`}
            >
              <Text
                className={`text-xs ${
                  active
                    ? 'text-neutral-50 dark:text-neutral-900'
                    : 'text-neutral-700 dark:text-neutral-300'
                }`}
              >
                {t(permissionTierWordKeys(mode).title)}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>
    ),
    [busyKey, t],
  )

  return (
    <View className={`flex-1 ${isDark ? 'bg-neutral-950' : 'bg-neutral-50'}`}>
      <NavChrome>
        <NavBar title={t('workspace.title')} />
      </NavChrome>

      <View className="flex-row px-4 pb-2">
        {(['projects', 'permissions'] as const).map((k) => {
          const active = tab === k
          return (
            <TouchableOpacity
              key={k}
              onPress={() => setTab(k)}
              className={`mr-2 rounded-sm px-3 py-1.5 ${
                active ? 'bg-neutral-900 dark:bg-neutral-100' : 'bg-neutral-200 dark:bg-neutral-800'
              }`}
            >
              <Text
                className={`text-xs ${
                  active
                    ? 'text-neutral-50 dark:text-neutral-900'
                    : 'text-neutral-700 dark:text-neutral-300'
                }`}
              >
                {t(k === 'projects' ? 'workspace.tabProjects' : 'workspace.tabPermissions')}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>

      <ScrollView
        className="flex-1"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {tab === 'projects' ? (
          <>
            <View className="mx-4 mb-3 rounded-xl border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900">
              <TouchableOpacity
                onPress={() => setFormOpen((v) => !v)}
                className="self-start rounded-sm bg-neutral-900 px-4 py-2 dark:bg-neutral-100"
              >
                <Text className="text-xs text-neutral-50 dark:text-neutral-900">
                  {t('workspace.newProject')}
                </Text>
              </TouchableOpacity>

              {formOpen ? (
                <View className="mt-3">
                  <TextField
                    colorScheme={resolvedTheme}
                    value={name}
                    onChangeText={setName}
                    placeholder={t('workspace.namePlaceholder')}
                    placeholderTextColor={tokens.text.tertiary}
                    className="rounded-sm border border-neutral-200 px-3 py-2 text-sm text-neutral-900 dark:border-neutral-700 dark:text-neutral-100"
                  />
                  <TextField
                    colorScheme={resolvedTheme}
                    value={description}
                    onChangeText={setDescription}
                    multiline
                    numberOfLines={3}
                    placeholder={t('workspace.descriptionPlaceholder')}
                    placeholderTextColor={tokens.text.tertiary}
                    className="mt-2 rounded-sm border border-neutral-200 px-3 py-2 text-sm text-neutral-900 dark:border-neutral-700 dark:text-neutral-100"
                  />
                  <TouchableOpacity
                    disabled={creating}
                    onPress={onSubmitProject}
                    className={`mt-2 self-start rounded-sm px-4 py-2 ${
                      creating
                        ? 'bg-neutral-300 dark:bg-neutral-800'
                        : 'bg-neutral-900 dark:bg-neutral-100'
                    }`}
                  >
                    <Text
                      className={`text-xs ${creating ? 'text-neutral-600' : 'text-neutral-50 dark:text-neutral-900'}`}
                    >
                      {creating ? t('workspace.creating') : t('workspace.create')}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>

            {loading ? (
              <View className="items-center py-12">
                <Text className="text-sm text-neutral-500 dark:text-neutral-400">{t('common.loading')}</Text>
              </View>
            ) : error ? (
              <View className="mx-4 mb-3 rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950">
                <Text className="mb-3 text-xs text-red-700 dark:text-red-300">{error}</Text>
                <TouchableOpacity
                  onPress={() => void loadProjects()}
                  className="self-start rounded-sm bg-neutral-900 px-4 py-2 dark:bg-neutral-100"
                >
                  <Text className="text-xs text-neutral-50 dark:text-neutral-900">
                    {t('common.retry')}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : projects.length === 0 ? (
              <View className="items-center py-12">
                <Text className="text-sm text-neutral-500 dark:text-neutral-400">{t('workspace.empty')}</Text>
              </View>
            ) : (
              projects.map((item) => (
                <View
                  key={item.id}
                  className="mx-4 mb-3 rounded-xl border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900"
                >
                  <View className="flex-row items-center justify-between">
                    <Text className="flex-1 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                      {item.name}
                    </Text>
                    <View className="rounded-xs bg-neutral-100 px-2 py-0.5 dark:bg-neutral-800">
                      <Text className="text-xs text-neutral-700 dark:text-neutral-300">
                        {item.isShared ? t('workspace.shared') : t('workspace.private')}
                      </Text>
                    </View>
                  </View>
                  {item.description ? (
                    <Text className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
                      {item.description}
                    </Text>
                  ) : null}
                  <Text className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                    {t('workspace.files', { count: item.fileCount })} ·{' '}
                    {t('workspace.members', {
                      count: item.memberCount,
                    })}
                  </Text>
                  <TouchableOpacity
                    onPress={() => onDeleteProject(item)}
                    className="mt-3 self-start rounded-sm border border-neutral-300 px-3 py-1.5 dark:border-neutral-700"
                  >
                    <Text className="text-xs text-neutral-700 dark:text-neutral-300">
                      {t('common.delete')}
                    </Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </>
        ) : (
          <>
            <View className="mx-4 mb-3 rounded-xl border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900">
              <Text className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                {t('workspace.permDefault')}
              </Text>
              <Text className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
                {defaultMode
                  ? `${t(permissionTierWordKeys(defaultMode).title)} · ${t(permissionTierWordKeys(defaultMode).desc)}`
                  : t('workspace.permDefaultUnset')}
              </Text>
              {renderModeChips(defaultMode, onSetDefaultMode)}
            </View>

            {permLoading ? (
              <View className="items-center py-12">
                <Text className="text-sm text-neutral-500 dark:text-neutral-400">{t('common.loading')}</Text>
              </View>
            ) : permError ? (
              <View className="mx-4 mb-3 rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950">
                <Text className="mb-3 text-xs text-red-700 dark:text-red-300">{permError}</Text>
                <TouchableOpacity
                  onPress={() => void loadPermissions()}
                  className="self-start rounded-sm bg-neutral-900 px-4 py-2 dark:bg-neutral-100"
                >
                  <Text className="text-xs text-neutral-50 dark:text-neutral-900">
                    {t('common.retry')}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : permissions.length === 0 ? (
              <View className="items-center py-12">
                <Text className="text-sm text-neutral-500 dark:text-neutral-400">{t('workspace.permEmpty')}</Text>
              </View>
            ) : (
              permissions.map((perm) => {
                const words = permissionTierWordKeys(perm.mode)
                return (
                  <View
                    key={perm.id}
                    className="mx-4 mb-3 rounded-xl border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900"
                  >
                    <View className="flex-row items-center justify-between">
                      <Text className="flex-1 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                        {perm.name}
                      </Text>
                      <View className="rounded-xs bg-neutral-100 px-2 py-0.5 dark:bg-neutral-800">
                        <Text className="text-xs text-neutral-700 dark:text-neutral-300">
                          {t('permissionTier.label')}: {t(words.title)}
                        </Text>
                      </View>
                    </View>
                    <Text className="mt-1 text-xs text-neutral-500 dark:text-neutral-400" numberOfLines={1}>
                      {t('workspace.permPath')}: {perm.workspacePath}
                    </Text>
                    {perm.techStack ? (
                      <Text className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                        {t('workspace.permStack')}: {perm.techStack}
                      </Text>
                    ) : null}
                    <Text className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
                      {words ? t(words.desc) : ''}
                    </Text>
                    {renderModeChips(perm.mode, (mode) => onSwitchMode(perm, mode))}
                    <TouchableOpacity
                      disabled={busyKey === perm.id}
                      onPress={() => onDeletePermission(perm)}
                      className="self-start rounded-sm border border-neutral-300 px-3 py-1.5 dark:border-neutral-700"
                    >
                      <Text className="text-xs text-neutral-700 dark:text-neutral-300">
                        {t('workspace.permDelete')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )
              })
            )}
          </>
        )}
      </ScrollView>
    </View>
  )
}

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
