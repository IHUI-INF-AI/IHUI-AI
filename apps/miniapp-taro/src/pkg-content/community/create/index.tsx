// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像 packages/app/src/features/post-create/PostCreateScreen.tsx(直载共享屏 + 注入本端事实)
//
// 端内保留:① 路由参数 circleId;② AI 操控通道 useUiField 三字段注册;
// ③ POST /api/community/posts 提交与成功后 redirectTo 详情页。
// 渲染(标题/错误/三字段/发布按钮/提交中态)全部委托共享屏,与 RN/web 同一套样式与取词。

import { useCallback, useState } from 'react'
import Taro from '@tarojs/taro'
import { useI18n, useTt } from '@/i18n'
import { useUiField } from '@/lib/ui-field-registry'
import { fetchApi } from '@ihui/api-client'
import ThemeRoot from '@/components/ThemeRoot'
import { useTheme } from '@/rn-compat/theme'
import { PostCreateScreen } from '@ihui/rn-app/features/post-create/PostCreateScreen'

export default function CommunityCreate() {
  const { t } = useI18n()
  const tt = useTt()
  const { resolvedTheme } = useTheme()
  // 路由参数:圈子 id(可选,对齐 RN route.params.circleId,默认空串)
  const circleId = Taro.getCurrentInstance().router?.params?.circleId ?? ''
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [tags, setTags] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  // AI 操控通道(2026-09-21):发帖表单的三个字段交出组件已绑定的 setter。
  // 提交(发布到社区)是对外发声且不可撤销的动作,按钮/表单不注册 submit,由用户自己点。
  useUiField({
    kind: 'input',
    label: tt('postCreate.titleLabel', '标题'),
    placeholder: tt('postCreate.titlePlaceholder', '给帖子起个标题'),
    readValue: () => title,
    setValue: setTitle,
  })
  useUiField({
    kind: 'textarea',
    label: tt('postCreate.contentLabel', '内容'),
    placeholder: tt('postCreate.contentPlaceholder', '分享你的想法...'),
    readValue: () => content,
    setValue: setContent,
  })
  useUiField({
    kind: 'input',
    label: tt('postCreate.tagsLabel', '标签'),
    placeholder: tt('postCreate.tagsPlaceholder', '多个标签用逗号分隔'),
    readValue: () => tags,
    setValue: setTags,
  })

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
      Taro.redirectTo({ url: `/pkg-content/plaza/detail/index?id=${res.data.id}` }).catch(() => {})
    } else if (!res.success) {
      setError(res.error || tt('postCreate.saveFailed', '保存失败'))
    }
  }, [title, content, tags, circleId, tt])

  return (
    <ThemeRoot>
      <PostCreateScreen
        t={t}
        title={title}
        content={content}
        tags={tags}
        saving={saving}
        error={error}
        onTitleChange={setTitle}
        onContentChange={setContent}
        onTagsChange={setTags}
        onSubmit={() => void onSubmit()}
        onBack={() => void Taro.navigateBack()}
        colorScheme={resolvedTheme}
      />
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
