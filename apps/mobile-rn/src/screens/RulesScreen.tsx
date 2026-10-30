// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { listRules, patchRuleEnabled, type RuleRecord } from '@ihui/api-client'
import { RulesScreen as SharedRulesScreen, type RuleRowView } from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

const NS = 'rulesPage'

/**
 * RN 端「规则管理」薄壳 —— 承载 web /rules。渲染全部委托共享屏,本文件只管:
 * 取数 GET /api/rules(契约 apps/api/src/routes/rules.ts:142-148,需登录,
 * 响应 data = { rules, total },services/rules-service.ts:444-451)、
 * 启用态切换 PATCH /api/rules/:id(同文件:303-333 区间,body { enabled })、
 * 逐行文案映射(scope / matchType 由 t 注入)、登录门(未登录不发注定 401 的查询)。
 * 口径差:web 的新建/编辑/删除/测试/冲突/模板/统计/A-B/自动生成/知识图谱弹窗族
 * 本次未承载,共享屏不渲染对应按钮(如实登记,不造假按钮)。
 */
export function RulesScreen() {
  const navigation = useNavigation<NavigationProp>()
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const { user } = useAuth()

  const [rows, setRows] = useState<RuleRowView[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const mapScope = useCallback(
    (scope: RuleRecord['scope']): string => {
      if (scope === 'workspace') return t(`${NS}.scopeWorkspace`)
      if (scope === 'agent') return t(`${NS}.scopeAgent`)
      return t(`${NS}.scopeGlobal`)
    },
    [t],
  )

  const mapMatchType = useCallback(
    (matchType: RuleRecord['matchType']): string => {
      if (matchType === 'keyword') return t(`${NS}.matchKeyword`)
      if (matchType === 'regex') return t(`${NS}.matchRegex`)
      if (matchType === 'semantic') return t(`${NS}.matchSemantic`)
      return t(`${NS}.matchAlways`)
    },
    [t],
  )

  const toRow = useCallback(
    (item: RuleRecord): RuleRowView => ({
      id: item.id,
      name: item.name,
      description: item.description ?? '',
      scopeText: mapScope(item.scope),
      matchTypeText: mapMatchType(item.matchType),
      priorityText: String(item.priority),
      enabled: item.enabled,
    }),
    [mapScope, mapMatchType],
  )

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const res = await listRules()
      if (!res.success || !res.data) {
        setError(res.error ?? t('common.loadFailed'))
        return
      }
      setError(null)
      setRows((res.data.rules ?? []).map(toRow))
    } catch {
      setError(t('common.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [user, toRow, t])

  useEffect(() => {
    void load()
  }, [load])

  const handleToggle = useCallback(
    async (id: string, enabled: boolean) => {
      setTogglingId(id)
      try {
        const res = await patchRuleEnabled(id, enabled)
        if (!res.success) {
          setError(res.error ?? t('common.loadFailed'))
          return
        }
        setRows((prev) => prev.map((row) => (row.id === id ? { ...row, enabled } : row)))
      } catch {
        setError(t('common.loadFailed'))
      } finally {
        setTogglingId(null)
      }
    },
    [t],
  )

  return (
    <SharedRulesScreen
      t={t}
      colorScheme={resolvedTheme}
      onBack={() => navigation.goBack()}
      loginRequiredText={user ? '' : t(`${NS}.loginRequired`)}
      loading={loading}
      error={error}
      rows={rows}
      togglingId={togglingId}
      onToggle={(id, enabled) => {
        if (togglingId) return
        void handleToggle(id, enabled)
      }}
      onRefresh={() => void load()}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
