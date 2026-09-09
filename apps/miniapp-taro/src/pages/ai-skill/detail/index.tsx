// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 平台页面:镜像 apps/mobile-rn AiSkillDetailScreen(AI 技能详情:prompt 模板与来源信息)
// 端内重写渲染层(Taro 无法直接渲染 RN 原语)
import { useCallback, useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { getAiSkill, type AiSkillMeta } from '@ihui/api-client'
import { useTt } from '@/i18n'
import { getRnTokens, type RnThemeTokens } from '@ihui/design-tokens'
import { useAppTheme } from '@/lib/theme'
import ThemeRoot from '@/components/ThemeRoot'

/** Taro rpx 单位换算(1px = 2rpx,750 设计稿基准) */
const toRpx = (px: number): string => `${px * 2}rpx`

// ===== 样式函数(view/text 分组,避免 style 联合类型;对齐 RN 端 Tailwind 视觉) =====

const viewStyles = {
  // 容器背景对齐 RN:亮 bg-white / 暗 bg-neutral-900
  // (#FFFFFF → --color-surface-light;#171717 → --color-surface-dark 暗值)
  container: (_tk: RnThemeTokens, isDark: boolean): CSSProperties => ({
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    backgroundColor: isDark ? 'var(--color-surface-dark)' : 'var(--color-surface-light)',
  }),
  center: (isDark: boolean): CSSProperties => ({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    backgroundColor: isDark ? 'var(--color-surface-dark)' : 'var(--color-surface-light)',
  }),
  header: (): CSSProperties => ({
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: toRpx(16),
    paddingRight: toRpx(16),
    paddingTop: toRpx(12),
    paddingBottom: toRpx(8),
  }),
  bodyScroll: (): CSSProperties => ({
    flex: 1,
  }),
  // 对齐 RN ScrollView px-4 pt-2(无底部内边距)
  body: (): CSSProperties => ({
    paddingLeft: toRpx(16),
    paddingRight: toRpx(16),
    paddingTop: toRpx(8),
  }),
  errorBox: (): CSSProperties => ({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    paddingTop: toRpx(64),
    paddingBottom: toRpx(64),
  }),
  // 重试按钮对齐 RN:bg-gray-200(rounded-md 6px→12rpx;#E5E5E5 ≈ --color-border)
  retryBtn: (_tk: RnThemeTokens): CSSProperties => ({
    marginTop: toRpx(12),
    borderRadius: toRpx(6),
    backgroundColor: 'var(--color-border)',
    paddingLeft: toRpx(16),
    paddingRight: toRpx(16),
    paddingTop: toRpx(8),
    paddingBottom: toRpx(8),
  }),
  badgeRow: (): CSSProperties => ({
    marginTop: toRpx(12),
    display: 'flex',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: toRpx(6),
  }),
  // 徽章对齐 RN:rounded-sm(2px→4rpx);bg-gray-100(亮 ≈ --color-muted)/ dark:bg-neutral-700(≈ --color-accent)
  categoryBadge: (_tk: RnThemeTokens, isDark: boolean): CSSProperties => ({
    borderRadius: toRpx(2),
    backgroundColor: isDark ? 'var(--color-accent)' : 'var(--color-muted)',
    paddingLeft: toRpx(8),
    paddingRight: toRpx(8),
    paddingTop: toRpx(4),
    paddingBottom: toRpx(4),
    overflow: 'hidden',
  }),
  // bg-orange-50 / dark:bg-neutral-700 → 统一品牌橙浅底 token(明暗成对)
  tagBadge: (_tk: RnThemeTokens): CSSProperties => ({
    borderRadius: toRpx(2),
    backgroundColor: 'var(--color-brand-orange-light)',
    paddingLeft: toRpx(8),
    paddingRight: toRpx(8),
    paddingTop: toRpx(4),
    paddingBottom: toRpx(4),
    overflow: 'hidden',
  }),
  // promptBox 对齐 RN:亮 border-gray-200 + bg-gray-50(≈ --color-secondary)
  // 暗 border-neutral-700 + bg-neutral-800(≈ --color-border + --color-muted)
  promptBox: (isDark: boolean): CSSProperties => ({
    borderRadius: toRpx(8),
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'var(--color-border)',
    backgroundColor: isDark ? 'var(--color-muted)' : 'var(--color-secondary)',
    padding: toRpx(12),
  }),
}

const textStyles = {
  // text.secondary #666666/#A3A3A3 ↔ --color-muted-foreground(亮暗成对)
  muted: (_tk: RnThemeTokens): CSSProperties => ({
    fontSize: toRpx(14),
    color: 'var(--color-muted-foreground)',
  }),
  back: (_tk: RnThemeTokens): CSSProperties => ({
    fontSize: toRpx(14),
    color: 'var(--color-muted-foreground)',
  }),
  headerTitle: (_tk: RnThemeTokens): CSSProperties => ({
    maxWidth: '60%',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
    fontSize: toRpx(16),
    fontWeight: '500',
    color: 'var(--color-foreground)',
  }),
  // RN dark:text-gray-300 / text-gray-600 → --color-text-medium(亮 #404040 / 暗 #D4D4D4 成对)
  description: (_tk: RnThemeTokens): CSSProperties => ({
    fontSize: toRpx(14),
    lineHeight: toRpx(24),
    color: 'var(--color-text-medium)',
  }),
  categoryText: (_tk: RnThemeTokens): CSSProperties => ({
    fontSize: toRpx(12),
    color: 'var(--color-muted-foreground)',
  }),
  tagText: (_tk: RnThemeTokens): CSSProperties => ({
    fontSize: toRpx(12),
    color: 'var(--color-brand-orange)',
  }),
  sectionTitle: (_tk: RnThemeTokens): CSSProperties => ({
    marginTop: toRpx(20),
    marginBottom: toRpx(8),
    fontSize: toRpx(14),
    fontWeight: '500',
    color: 'var(--color-text-medium)',
  }),
  promptText: (_tk: RnThemeTokens): CSSProperties => ({
    fontSize: toRpx(14),
    lineHeight: toRpx(24),
    color: 'var(--color-text-medium)',
  }),
  // RN dark:text-gray-400 / text-gray-600 → --color-muted-foreground(暗 #A3A3A3 精确 / 亮相近)
  sourceText: (_tk: RnThemeTokens): CSSProperties => ({
    fontSize: toRpx(14),
    color: 'var(--color-muted-foreground)',
  }),
  errorText: (_tk: RnThemeTokens): CSSProperties => ({
    fontSize: toRpx(14),
    color: 'var(--color-muted-foreground)',
    textAlign: 'center',
  }),
  retryText: (_tk: RnThemeTokens): CSSProperties => ({
    fontSize: toRpx(14),
    color: 'var(--color-foreground)',
  }),
}

export default function AiSkillDetail() {
  const tt = useTt()
  const { resolved: appTheme } = useAppTheme()
  const tk = getRnTokens(appTheme)
  const isDark = appTheme === 'dark'
  // 路由参数:技能 id 与名称(对齐 RN route.params.id / route.params.name)
  const router = Taro.getCurrentInstance().router
  const skillId = router?.params?.id ?? ''
  const skillName = decodeURIComponent(router?.params?.name ?? '')
  const [skill, setSkill] = useState<AiSkillMeta | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const res = await getAiSkill(skillId)
      if (!res.success) throw new Error()
      setSkill(res.data)
    } catch {
      setError(tt('aiSkillDetail.loadFailed', '技能详情加载失败'))
    } finally {
      setLoading(false)
    }
  }, [skillId, tt])

  useEffect(() => {
    void load()
  }, [load])

  const goBack = () => {
    Taro.navigateBack({ delta: 1 }).catch(() => {
      Taro.switchTab({ url: '/pages/index/index' })
    })
  }

  const retry = () => {
    setLoading(true)
    void load()
  }

  if (loading) {
    return (
      <ThemeRoot>
        <View style={viewStyles.center(isDark)}>
          <Text style={textStyles.muted(tk)}>{tt('common.loading', '加载中...')}</Text>
        </View>
      </ThemeRoot>
    )
  }

  return (
    <ThemeRoot>
      <View style={viewStyles.container(tk, isDark)}>
        <View style={viewStyles.header()}>
          <View onTap={goBack} hoverClass="opacity-60">
            <Text style={textStyles.back(tk)}>{tt('common.back', '返回')}</Text>
          </View>
          <Text style={textStyles.headerTitle(tk)}>{skillName}</Text>
          <View style={{ width: toRpx(40) }} />
        </View>

        <ScrollView scrollY style={viewStyles.bodyScroll()}>
          <View style={viewStyles.body()}>
            {error ? (
              <View style={viewStyles.errorBox()}>
                <Text style={textStyles.errorText(tk)}>{error}</Text>
                <View style={viewStyles.retryBtn(tk)} onTap={retry} hoverClass="opacity-60">
                  <Text style={textStyles.retryText(tk)}>{tt('aiSkillDetail.retry', '重试')}</Text>
                </View>
              </View>
            ) : skill ? (
              <View>
                <Text style={textStyles.description(tk)}>{skill.description}</Text>
                <View style={viewStyles.badgeRow()}>
                  <View style={viewStyles.categoryBadge(tk, isDark)}>
                    <Text style={textStyles.categoryText(tk)}>{skill.category}</Text>
                  </View>
                  {skill.tags.map((tag) => (
                    <View key={tag} style={viewStyles.tagBadge(tk)}>
                      <Text style={textStyles.tagText(tk)}>{tag}</Text>
                    </View>
                  ))}
                </View>

                <Text style={textStyles.sectionTitle(tk)}>
                  {tt('aiSkillDetail.prompt', 'Prompt 模板')}
                </Text>
                <View style={viewStyles.promptBox(isDark)}>
                  <Text style={textStyles.promptText(tk)}>
                    {skill.promptTemplate || tt('aiSkillDetail.noPrompt', '无模板')}
                  </Text>
                </View>

                <Text style={textStyles.sectionTitle(tk)}>
                  {tt('aiSkillDetail.source', '来源')}
                </Text>
                <Text style={textStyles.sourceText(tk)}>
                  {skill.source}
                  {skill.sourceUrl ? ` · ${skill.sourceUrl}` : ''}
                </Text>
              </View>
            ) : null}
          </View>
        </ScrollView>
      </View>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
