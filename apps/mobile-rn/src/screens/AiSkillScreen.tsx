// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { appAlert, BottomPops } from '../components/BottomPops'
import { useRefreshOnFocus } from '../hooks'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import {
  importAiSkill,
  listAiSkills,
  type AiSkillMeta,
  type SkillImportData,
} from '@ihui/api-client'
import { AiSkillScreen as SharedAiSkillScreen, TextField, type AiSkillListItem } from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import { tokens } from '../theme/active-tokens'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/** AiSkillMeta(API)→ 共享层 AiSkillListItem 映射 */
function toItem(skill: AiSkillMeta): AiSkillListItem {
  return {
    id: skill.id,
    name: skill.name,
    description: skill.description,
    category: skill.category,
    tags: skill.tags,
  }
}

/**
 * AI 技能市场(mobile-rn 端 wrapper)
 *
 * 2026-09-15 迁移:UI 与展示逻辑已下沉共享层 @ihui/rn-app SharedAiSkillScreen
 * (M3 补齐:web /ai-skills 在移动端的原生入口),本 wrapper 仅保留平台特定职责:
 * - 数据:listAiSkills('all') + 下拉刷新/重试
 * - 交互:点击技能卡 Alert 确认(取消 / 查看详情)
 * - 导航:AiSkillDetail 跳转 / goBack;主题色 / i18n 注入
 */
export function AiSkillScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()
  const [items, setItems] = useState<AiSkillMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [importOpen, setImportOpen] = useState(false)
  const [importJson, setImportJson] = useState('')
  const [importError, setImportError] = useState('')
  const [importing, setImporting] = useState(false)

  const load = useCallback(async () => {
    setError('')
    try {
      const res = await listAiSkills({ category: 'all' })
      if (!res.success) throw new Error()
      setItems(res.data ?? [])
    } catch {
      setError(t('aiSkill.loadFailed'))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  // 回屏即重取(对齐小程序 useDidShow 的每次显示刷新)
  useRefreshOnFocus(load)

  // 点击技能卡:查看详情确认弹窗(原屏 Alert 行为,跳转在选项回调内完成)
  const onOpen = (skill: AiSkillListItem) => {
    appAlert(skill.name, skill.description, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('aiSkill.detail'),
        onPress: () => navigation.navigate('AiSkillDetail', { id: skill.id, name: skill.name }),
      },
    ])
  }

  const openImport = () => {
    setImportError('')
    setImportOpen(true)
  }

  const closeImport = () => {
    if (importing) return
    setImportOpen(false)
  }

  /**
   * 粘贴 JSON → 校验(空 / 非法 JSON / 缺 name)→ importAiSkill → 刷新列表。
   * 校验全部前置:任一不过都不发请求,错误以内联文案留在输入区内。
   */
  const handleImport = async () => {
    const trimmed = importJson.trim()
    if (!trimmed) {
      setImportError(t('aiSkill.importInvalidJson'))
      return
    }
    let parsed: Record<string, unknown>
    try {
      const rawParsed: unknown = JSON.parse(trimmed)
      if (typeof rawParsed !== 'object' || rawParsed === null || Array.isArray(rawParsed)) {
        setImportError(t('aiSkill.importInvalidJson'))
        return
      }
      parsed = rawParsed as Record<string, unknown>
    } catch {
      setImportError(t('aiSkill.importInvalidJson'))
      return
    }
    const name = parsed.name
    if (typeof name !== 'string' || !name.trim()) {
      setImportError(t('aiSkill.importMissingName'))
      return
    }

    const data: SkillImportData = {
      name: name.trim(),
      description: typeof parsed.description === 'string' ? parsed.description : '',
      icon: typeof parsed.icon === 'string' ? parsed.icon : 'wand2',
      category: typeof parsed.category === 'string' ? parsed.category : 'ai-top',
      tags: Array.isArray(parsed.tags)
        ? parsed.tags.filter((tag): tag is string => typeof tag === 'string')
        : [],
      promptTemplate: typeof parsed.promptTemplate === 'string' ? parsed.promptTemplate : '',
      sourceUrl: typeof parsed.sourceUrl === 'string' ? parsed.sourceUrl : '',
    }

    setImportError('')
    setImporting(true)
    try {
      const r = await importAiSkill(data)
      if (!r.success) {
        setImportError(r.error || t('aiSkill.importFailed'))
        return
      }
      setImportOpen(false)
      setImportJson('')
      appAlert(t('aiSkill.importSuccess'))
      void load()
    } catch {
      setImportError(t('aiSkill.importFailed'))
    } finally {
      setImporting(false)
    }
  }

  return (
    <>
      <SharedAiSkillScreen
        t={t}
        items={items.map(toItem)}
        loading={loading}
        refreshing={refreshing}
        error={error}
        onRefresh={() => {
          setRefreshing(true)
          void load()
        }}
        onRetry={() => {
          setLoading(true)
          void load()
        }}
        onOpenSkill={onOpen}
        onImport={openImport}
        importing={importing}
        onBack={() => navigation.goBack()}
        colorScheme={resolvedTheme}
      />

      <BottomPops visible={importOpen} onClose={closeImport} title={t('aiSkill.importTitle')}>
        <View style={styles.importBody}>
          <Text style={styles.importHint}>{t('aiSkill.importHint')}</Text>
          <TextField
            colorScheme={resolvedTheme}
            value={importJson}
            onChangeText={(value) => {
              setImportJson(value)
              if (importError) setImportError('')
            }}
            multiline
            textAlignVertical="top"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!importing}
            placeholder='{"name": "my-skill"}'
            style={styles.importInput}
          />
          {importError ? <Text style={styles.importError}>{importError}</Text> : null}
          <View style={styles.importActions}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={closeImport}
              disabled={importing}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.successButton, importing ? styles.buttonDisabled : null]}
              onPress={() => void handleImport()}
              disabled={importing}
              activeOpacity={0.7}
            >
              {importing ? (
                <ActivityIndicator size="small" color={tokens.brand.ctaForeground} />
              ) : null}
              <Text style={styles.successText}>
                {importing ? t('aiSkill.importing') : t('aiSkill.importButton')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </BottomPops>
    </>
  )
}

const styles = StyleSheet.create({
  importBody: { gap: rnSpacing.md },
  importHint: {
    fontSize: rnType.label.size,
    lineHeight: 18,
    color: tokens.text.secondary,
  },
  importInput: {
    minHeight: 140,
    paddingHorizontal: rnSpacing.md,
    paddingVertical: rnSpacing.sm,
    borderRadius: rnRadius.sm,
    borderWidth: 1,
    borderColor: tokens.border.medium,
    backgroundColor: tokens.surface.inputBg,
    color: tokens.text.primary,
    fontSize: rnType.body.size,
    fontFamily: 'monospace',
  },
  importError: { fontSize: rnType.label.size, color: tokens.danger.DEFAULT },
  importActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: rnSpacing.sm,
  },
  cancelButton: {
    paddingHorizontal: rnSpacing.md,
    paddingVertical: rnSpacing['xs-loose'],
    borderRadius: rnRadius.sm,
    borderWidth: 1,
    borderColor: tokens.border.medium,
  },
  cancelText: { fontSize: rnType.body.size, color: tokens.text.primary },
  successButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rnSpacing['2xs'],
    paddingHorizontal: rnSpacing.md,
    paddingVertical: rnSpacing['xs-loose'],
    borderRadius: rnRadius.sm,
    backgroundColor: tokens.brand.cta,
  },
  successText: {
    fontSize: rnType.body.size,
    fontWeight: '500',
    color: tokens.brand.ctaForeground,
  },
  buttonDisabled: { opacity: 0.5 },
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
