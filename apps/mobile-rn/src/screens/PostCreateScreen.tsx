// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Hash } from 'lucide-react-native'
import { fetchApi } from '@ihui/api-client'
import { PostCreateScreen as SharedPostCreateScreen } from '@ihui/rn-app'
import { rnLightTokens as tokens } from '@ihui/design-tokens'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type Route = RouteProp<RootStackParamList, 'PostCreate'>
type NavigationProp = NativeStackNavigationProp<RootStackParamList>

export function PostCreateScreen() {
  const { t } = useI18n()
  const route = useRoute<Route>()
  const navigation = useNavigation<NavigationProp>()
  const { circleId, topicName, onPickTopic } = route.params ?? {}
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [tags, setTags] = useState(topicName ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // P1(2026-09-04):选话题入口(镜像 miniapp from=create + TOPIC_EVENT 回传,RN 用函数 params)
  const pickTopic = useCallback(() => {
    navigation.navigate('TopicList', {
      from: 'create',
      onPickTopic: (name: string) => {
        onPickTopic?.(name)
        if (name) setTags((prev) => (prev.includes(name) ? prev : prev ? `${prev},${name}` : name))
      },
    })
  }, [navigation, onPickTopic])

  const onSubmit = useCallback(async () => {
    if (!title.trim() || !content.trim()) {
      setError(t('postCreate.required'))
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
    if (res.success && res.data) navigation.replace('PostDetail', { id: res.data.id })
    else if (!res.success) setError(res.error || t('postCreate.saveFailed'))
  }, [title, content, tags, circleId, t, navigation])

  return (
    <View style={styles.pickWrap}>
      <Pressable
        style={({ pressed }) => [styles.pickBtn, pressed ? styles.pickBtnPressed : null]}
        onPress={pickTopic}
        accessibilityRole="button"
      >
        <Hash size={14} color={tokens.brand.DEFAULT} />
        <Text style={styles.pickBtnText}>{t('postCreate.pickTopic')}</Text>
      </Pressable>
      <SharedPostCreateScreen
        t={t}
        title={title}
        content={content}
        tags={tags}
        saving={saving}
        error={error}
        onTitleChange={setTitle}
        onContentChange={setContent}
        onTagsChange={setTags}
        onSubmit={onSubmit}
        onBack={() => navigation.goBack()}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  pickWrap: {
    flex: 1,
    backgroundColor: tokens.surface.bg,
  },
  pickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    marginTop: 8,
    marginHorizontal: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.border.medium,
    backgroundColor: tokens.surface.card,
  },
  pickBtnPressed: {
    opacity: 0.7,
  },
  pickBtnText: {
    fontSize: 12,
    color: tokens.brand.DEFAULT,
  },
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
