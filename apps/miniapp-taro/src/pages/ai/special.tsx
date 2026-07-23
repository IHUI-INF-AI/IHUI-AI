import { View, Text, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { logger } from '@/utils/logger'
import ErrorView from '@/components/ErrorView'
import { useI18n } from '@/i18n'

type ModelI18nKey = 'nanobanana' | 'veo3' | 'httpmodel' | 'geminiFlash'

interface ModelEntry {
  key: string
  i18nKey: ModelI18nKey
  icon: string
  route?: string
}

const MODELS: ModelEntry[] = [
  { key: 'nanobanana', i18nKey: 'nanobanana', icon: '🍌', route: '/pages/ai/image' },
  { key: 'veo3', i18nKey: 'veo3', icon: '🎬', route: '/pages/ai/video' },
  { key: 'httpmodel', i18nKey: 'httpmodel', icon: '🔌', route: '/pages/ai/chat' },
  { key: 'gemini-flash', i18nKey: 'geminiFlash', icon: '⚡', route: '/pages/ai/chat?model=gemini-2.5-flash' },
]

export default function SpecialModelsPage() {
  const { t, tList } = useI18n()
  const [errorMsg, setErrorMsg] = useState('')

  const onEnter = useCallback(
    (model: ModelEntry) => {
      if (model.route) {
        Taro.navigateTo({ url: model.route }).catch((e) => {
          logger.error('ai/special', `跳转 ${model.key}`, e)
          setErrorMsg(t('ai.special.pageError'))
        })
      } else {
        Taro.showToast({ title: t('ai.special.pageError'), icon: 'none' })
      }
    },
    [t],
  )

  return (
    <View className="min-h-screen bg-background">
      <ScrollView scrollY className="h-screen">
        <View className="px-3 py-3">
          <Text className="block text-xs text-muted-foreground mb-3">
            {t('ai.special.hint')}
          </Text>
          {errorMsg ? (
            <View className="mb-2">
              <ErrorView title={t('ai.special.pageError')} desc={errorMsg} onRetry={() => setErrorMsg('')} />
            </View>
          ) : null}
          {MODELS.map((m) => {
            const name = t(`ai.special.${m.i18nKey}.name`)
            const desc = t(`ai.special.${m.i18nKey}.desc`)
            const apiStatus = t(`ai.special.${m.i18nKey}.apiStatus`)
            const capabilities = tList(`ai.special.${m.i18nKey}.capabilities`)
            return (
              <View
                key={m.key}
                className="flex items-center bg-card rounded-lg p-3 mb-2"
                onClick={() => onEnter(m)}
              >
                <View className="flex items-center justify-center w-12 h-12 mr-3 rounded-lg bg-muted">
                  <Text className="text-2xl">{m.icon}</Text>
                </View>
                <View className="flex-1 min-w-0">
                  <View className="flex items-center">
                    <Text className="text-sm font-medium text-foreground">{name}</Text>
                    <Text className="ml-2 px-2 py-0.5 text-[10px] rounded bg-primary/10 text-primary">
                      {t('ai.special.available')}
                    </Text>
                  </View>
                  <Text className="block text-xs text-muted-foreground mt-1">{desc}</Text>
                  <View className="flex flex-wrap gap-1 mt-2">
                    {capabilities.map((c) => (
                      <Text
                        key={c}
                        className="px-2 py-0.5 text-[10px] rounded bg-muted text-muted-foreground"
                      >
                        {c}
                      </Text>
                    ))}
                  </View>
                  <Text className="block text-[10px] text-muted-foreground mt-1">{apiStatus}</Text>
                </View>
                <Text className="ml-2 text-muted-foreground text-lg">›</Text>
              </View>
            )
          })}
        </View>
      </ScrollView>
    </View>
  )
}
