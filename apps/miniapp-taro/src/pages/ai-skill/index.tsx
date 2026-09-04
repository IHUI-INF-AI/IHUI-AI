// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 平台页面:镜像 apps/mobile-rn AiSkillScreen(AI 技能市场,数据源 listAiSkills('all'))
// 端内重写渲染层(Taro 无法直接渲染 RN 原语);RN Alert 确认弹窗改用 Taro.showModal
import { useCallback, useState } from 'react'
import type { CSSProperties } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro'
import { listAiSkills, type AiSkillMeta } from '@ihui/api-client'
import { useTt } from '@/i18n'
import { getRnTokens, type RnThemeTokens } from '@ihui/design-tokens'
import { useAppTheme } from '@/lib/theme'
import ThemeRoot from '@/components/ThemeRoot'

/** Taro rpx 单位换算(1px = 2rpx,750 设计稿基准) */
const toRpx = (px: number): string => `${px * 2}rpx`

// ===== 样式函数(view/text 分组,避免 style 联合类型;对齐 RN 端 Tailwind 视觉) =====

const viewStyles = {
  container: (tk: RnThemeTokens): CSSProperties => ({
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    backgroundColor: tk.surface.bg,
  }),
  center: (): CSSProperties => ({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    paddingLeft: toRpx(24),
    paddingRight: toRpx(24),
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
  retryBtn: (tk: RnThemeTokens): CSSProperties => ({
    borderRadius: toRpx(6),
    backgroundColor: tk.surface.card,
    paddingLeft: toRpx(16),
    paddingRight: toRpx(16),
    paddingTop: toRpx(8),
    paddingBottom: toRpx(8),
  }),
  listBody: (): CSSProperties => ({
    flex: 1,
  }),
  listPadding: (): CSSProperties => ({
    padding: toRpx(16),
  }),
  card: (tk: RnThemeTokens): CSSProperties => ({
    marginBottom: toRpx(12),
    borderRadius: toRpx(8),
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: tk.border.light,
    backgroundColor: tk.surface.card,
    padding: toRpx(16),
  }),
  cardTitleRow: (): CSSProperties => ({
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  }),
  categoryBadge: (tk: RnThemeTokens): CSSProperties => ({
    marginLeft: toRpx(8),
    backgroundColor: tk.surface.muted,
    paddingLeft: toRpx(6),
    paddingRight: toRpx(6),
    paddingTop: toRpx(2),
    paddingBottom: toRpx(2),
    overflow: 'hidden',
  }),
  tagRow: (): CSSProperties => ({
    marginTop: toRpx(8),
    display: 'flex',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: toRpx(6),
  }),
  tagBadge: (tk: RnThemeTokens): CSSProperties => ({
    backgroundColor: tk.indigo.light,
    paddingLeft: toRpx(6),
    paddingRight: toRpx(6),
    paddingTop: toRpx(2),
    paddingBottom: toRpx(2),
    overflow: 'hidden',
  }),
}

const textStyles = {
  muted: (tk: RnThemeTokens): CSSProperties => ({
    fontSize: toRpx(14),
    color: tk.text.secondary,
  }),
  back: (tk: RnThemeTokens): CSSProperties => ({
    fontSize: toRpx(14),
    color: tk.text.secondary,
  }),
  headerTitle: (tk: RnThemeTokens): CSSProperties => ({
    fontSize: toRpx(16),
    fontWeight: '500',
    color: tk.text.primary,
  }),
  errorText: (tk: RnThemeTokens): CSSProperties => ({
    marginBottom: toRpx(12),
    fontSize: toRpx(14),
    color: tk.text.secondary,
    textAlign: 'center',
  }),
  retryText: (tk: RnThemeTokens): CSSProperties => ({
    fontSize: toRpx(14),
    color: tk.text.primary,
  }),
  cardName: (tk: RnThemeTokens): CSSProperties => ({
    flex: 1,
    fontSize: toRpx(16),
    fontWeight: '500',
    color: tk.text.primary,
  }),
  categoryText: (tk: RnThemeTokens): CSSProperties => ({
    fontSize: toRpx(12),
    color: tk.text.secondary,
  }),
  cardDesc: (tk: RnThemeTokens): CSSProperties => ({
    marginTop: toRpx(4),
    fontSize: toRpx(14),
    lineHeight: toRpx(20),
    color: tk.text.medium,
  }),
  tagText: (tk: RnThemeTokens): CSSProperties => ({
    fontSize: toRpx(12),
    color: tk.indigo.DEFAULT,
  }),
}

export default function AiSkillList() {
  const tt = useTt()
  const { resolved: appTheme } = useAppTheme()
  const tk = getRnTokens(appTheme)
  // 对齐 mobile-rn AiSkillScreen 状态机:items/loading/error + load/retry/onOpen
  const [items, setItems] = useState<AiSkillMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const res = await listAiSkills({ category: 'all' })
      if (!res.success) throw new Error()
      setItems(res.data ?? [])
    } catch {
      setError(tt('aiSkill.loadFailed', '技能列表加载失败'))
    } finally {
      setLoading(false)
      Taro.stopPullDownRefresh()
    }
  }, [tt])

  useDidShow(() => {
    void load()
  })

  usePullDownRefresh(() => {
    void load()
  })

  // RN 端 Alert(name/description + 取消/查看详情)→ Taro.showModal 等价实现
  const onOpen = (skill: AiSkillMeta) => {
    Taro.showModal({
      title: skill.name,
      content: skill.description,
      confirmText: tt('aiSkill.detail', '查看详情'),
      cancelText: tt('common.cancel', '取消'),
      success: (res) => {
        if (res.confirm) {
          Taro.navigateTo({
            url: `/pages/ai-skill/detail/index?id=${encodeURIComponent(skill.id)}&name=${encodeURIComponent(skill.name)}`,
          })
        }
      },
    })
  }

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
        <View style={viewStyles.center()}>
          <Text style={textStyles.muted(tk)}>{tt('common.loading', '加载中...')}</Text>
        </View>
      </ThemeRoot>
    )
  }

  return (
    <ThemeRoot>
      <View style={viewStyles.container(tk)}>
        <View style={viewStyles.header()}>
          <View onTap={goBack}>
            <Text style={textStyles.back(tk)}>{tt('common.back', '返回')}</Text>
          </View>
          <Text style={textStyles.headerTitle(tk)}>{tt('aiSkill.title', 'AI 技能')}</Text>
          <View style={{ width: toRpx(40) }} />
        </View>

        {error ? (
          <View style={viewStyles.center()}>
            <Text style={textStyles.errorText(tk)}>{error}</Text>
            <View style={viewStyles.retryBtn(tk)} onTap={retry}>
              <Text style={textStyles.retryText(tk)}>{tt('aiSkill.retry', '重试')}</Text>
            </View>
          </View>
        ) : (
          <ScrollView scrollY style={viewStyles.listBody()}>
            <View style={viewStyles.listPadding()}>
              {items.length === 0 ? (
                <View style={viewStyles.center()}>
                  <Text style={textStyles.muted(tk)}>{tt('aiSkill.empty', '暂无技能')}</Text>
                </View>
              ) : (
                items.map((item) => (
                  <View key={item.id} style={viewStyles.card(tk)} onTap={() => onOpen(item)}>
                    <View style={viewStyles.cardTitleRow()}>
                      <Text style={textStyles.cardName(tk)}>{item.name}</Text>
                      <View style={viewStyles.categoryBadge(tk)}>
                        <Text style={textStyles.categoryText(tk)}>{item.category}</Text>
                      </View>
                    </View>
                    <Text style={textStyles.cardDesc(tk)}>{item.description}</Text>
                    {item.tags.length > 0 ? (
                      <View style={viewStyles.tagRow()}>
                        {item.tags.slice(0, 4).map((tag) => (
                          <View key={tag} style={viewStyles.tagBadge(tk)}>
                            <Text style={textStyles.tagText(tk)}>{tag}</Text>
                          </View>
                        ))}
                      </View>
                    ) : null}
                  </View>
                ))
              )}
            </View>
          </ScrollView>
        )}
      </View>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
