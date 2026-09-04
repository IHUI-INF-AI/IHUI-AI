// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 平台页面:镜像 packages/app/src/features/post-create/PostCreateScreen UI 与
// apps/mobile-rn PostCreateScreen 状态机(端内重写渲染层,Taro 无法直接渲染 RN 原语)
import { useCallback, useState } from 'react'
import type { CSSProperties } from 'react'
import { View, Text, Input, Textarea, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useTt } from '@/i18n'
import { getRnTokens, type RnThemeTokens } from '@ihui/design-tokens'
import { useAppTheme } from '@/lib/theme'
import { fetchApi } from '@ihui/api-client'
import ThemeRoot from '@/components/ThemeRoot'

/** Taro rpx 单位换算(1px = 2rpx,750 设计稿基准) */
const toRpx = (px: number): string => `${px * 2}rpx`

// ===== 样式函数(view/text 分组,避免 style 联合类型;对齐共享屏 createStyles) =====

const viewStyles = {
  container: (tk: RnThemeTokens): CSSProperties => ({
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    backgroundColor: tk.surface.bg,
  }),
  bodyScroll: (): CSSProperties => ({
    flex: 1,
  }),
  body: (): CSSProperties => ({
    paddingLeft: toRpx(10),
    paddingRight: toRpx(10),
    paddingTop: toRpx(12),
    paddingBottom: toRpx(32),
  }),
  center: (): CSSProperties => ({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    paddingLeft: toRpx(16),
    paddingRight: toRpx(16),
  }),
  backBtn: (): CSSProperties => ({
    alignSelf: 'flex-start',
  }),
  input: (tk: RnThemeTokens): CSSProperties => ({
    marginTop: toRpx(8),
    paddingLeft: toRpx(12),
    paddingRight: toRpx(12),
    paddingTop: toRpx(8),
    paddingBottom: toRpx(8),
    borderRadius: toRpx(12),
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: tk.border.light,
    fontSize: toRpx(16),
    color: tk.text.primary,
    backgroundColor: tk.surface.muted,
  }),
  textarea: (tk: RnThemeTokens): CSSProperties => ({
    ...viewStyles.input(tk),
    width: '100%',
    boxSizing: 'border-box',
    minHeight: toRpx(120),
    maxHeight: toRpx(240),
  }),
  submitBtn: (tk: RnThemeTokens): CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: toRpx(20),
    paddingTop: toRpx(12),
    paddingBottom: toRpx(12),
    borderRadius: toRpx(12),
    backgroundColor: tk.brand.DEFAULT,
  }),
}

const textStyles = {
  muted: (tk: RnThemeTokens): CSSProperties => ({
    fontSize: toRpx(14),
    color: tk.text.secondary,
  }),
  back: (tk: RnThemeTokens): CSSProperties => ({
    fontSize: toRpx(16),
    color: tk.text.secondary,
  }),
  title: (tk: RnThemeTokens): CSSProperties => ({
    marginTop: toRpx(8),
    marginBottom: toRpx(12),
    fontSize: toRpx(22),
    fontWeight: '600',
    color: tk.text.primary,
  }),
  error: (tk: RnThemeTokens): CSSProperties => ({
    marginBottom: toRpx(8),
    fontSize: toRpx(14),
    color: tk.danger.DEFAULT,
  }),
  label: (tk: RnThemeTokens): CSSProperties => ({
    marginTop: toRpx(12),
    fontSize: toRpx(14),
    color: tk.text.secondary,
  }),
  submitText: (tk: RnThemeTokens): CSSProperties => ({
    fontSize: toRpx(16),
    fontWeight: '600',
    color: tk.surface.light,
  }),
}

export default function CommunityCreate() {
  const tt = useTt()
  const { resolved: appTheme } = useAppTheme()
  const tk = getRnTokens(appTheme)
  // 路由参数:圈子 id(可选,对齐 RN route.params.circleId,默认空串)
  const circleId = Taro.getCurrentInstance().router?.params?.circleId ?? ''
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [tags, setTags] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // 提交:对齐 mobile-rn onSubmit(POST /api/community/posts;标题/内容必填,标签逗号分隔)
  const onSubmit = useCallback(async () => {
    if (!title.trim() || !content.trim()) {
      setError(tt('postCreate.required', '请输入内容'))
      return
    }
    setSaving(true)
    setError('')
    const res = await fetchApi<{ id: string }>('/api/community/posts', {
      method: 'POST',
      body: JSON.stringify({
        title: title.trim(),
        content: content.trim(),
        circleId,
        tags: tags
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      }),
    })
    setSaving(false)
    if (res.success && res.data) {
      // 对齐 mobile-rn navigation.replace('PostDetail'):小程序用 redirectTo 详情页(详情走 /api/plaza/:id)
      Taro.redirectTo({ url: `/pages/plaza/detail/index?id=${res.data.id}` }).catch(() => {})
    } else if (!res.success) {
      setError(res.error || tt('postCreate.saveFailed', '保存失败'))
    }
  }, [title, content, tags, circleId, tt])

  const goBack = () => {
    // 发帖页从社区 tab 进入,navigateBack 失败时回落 switchTab 社区(tab 页不可 navigateTo)
    Taro.navigateBack({ delta: 1 }).catch(() => {
      Taro.switchTab({ url: '/pages/community/index' })
    })
  }

  // 提交中整页 loading(对齐共享屏 if (saving) 分支)
  if (saving) {
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
        <ScrollView scrollY style={viewStyles.bodyScroll()}>
          <View style={viewStyles.body()}>
            <View style={viewStyles.backBtn()} onTap={goBack}>
              <Text style={textStyles.back(tk)}>{tt('common.back', '返回')}</Text>
            </View>
            <Text style={textStyles.title(tk)}>{tt('postCreate.title', '发布帖子')}</Text>
            {error ? <Text style={textStyles.error(tk)}>{error}</Text> : null}
            <Text style={textStyles.label(tk)}>{tt('postCreate.titleLabel', '标题')}</Text>
            <Input
              style={viewStyles.input(tk)}
              value={title}
              placeholder={tt('postCreate.titlePlaceholder', '给帖子起个标题')}
              placeholderStyle={`color: ${tk.text.tertiary}`}
              maxlength={-1}
              onInput={(e) => setTitle(e.detail.value)}
            />
            <Text style={textStyles.label(tk)}>{tt('postCreate.contentLabel', '内容')}</Text>
            <Textarea
              style={viewStyles.textarea(tk)}
              value={content}
              placeholder={tt('postCreate.contentPlaceholder', '分享你的想法...')}
              placeholderStyle={`color: ${tk.text.tertiary}`}
              maxlength={-1}
              onInput={(e) => setContent(e.detail.value)}
            />
            <Text style={textStyles.label(tk)}>{tt('postCreate.tagsLabel', '标签')}</Text>
            <Input
              style={viewStyles.input(tk)}
              value={tags}
              placeholder={tt('postCreate.tagsPlaceholder', '多个标签用逗号分隔')}
              placeholderStyle={`color: ${tk.text.tertiary}`}
              maxlength={-1}
              onInput={(e) => setTags(e.detail.value)}
            />
            <View style={viewStyles.submitBtn(tk)} onTap={() => void onSubmit()}>
              <Text style={textStyles.submitText(tk)}>{tt('postCreate.submit', '发布')}</Text>
            </View>
          </View>
        </ScrollView>
      </View>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
