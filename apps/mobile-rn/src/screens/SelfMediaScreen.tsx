// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Share,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
  invokeSelfMediaSkill,
  listSelfMediaRecords,
  listSelfMediaSkills,
  type SelfMediaInvokeResult,
  type SelfMediaRecord,
  type SelfMediaSkill,
} from '@ihui/api-client'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/**
 * 自媒体助手(M3 补齐:web /self-media 技能调用与记录的移动端原生入口)。
 * 技能数据源:8802 透明代理 ai-service(GET /skills + POST invoke,LLM 生成);
 * 记录数据源:GET /records 直读数据库。koubo/wechat/automation 复杂工作流由 M4
 * WebView 门户承载,此处补门户没有的「技能即席调用 + 记录浏览」。
 */
export function SelfMediaScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()
  const [tab, setTab] = useState<'skills' | 'records'>('skills')
  const [skills, setSkills] = useState<SelfMediaSkill[]>([])
  const [records, setRecords] = useState<SelfMediaRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [activeSkillId, setActiveSkillId] = useState<string | null>(null)
  const [prompt, setPrompt] = useState('')
  const [invoking, setInvoking] = useState(false)
  const [result, setResult] = useState<SelfMediaInvokeResult | null>(null)

  const dark = resolvedTheme === 'dark'

  const load = useCallback(
    async (which: 'skills' | 'records') => {
      setLoading(true)
      try {
        if (which === 'skills') {
          setSkills(await listSelfMediaSkills())
        } else {
          const res = await listSelfMediaRecords({ limit: 50 })
          if (!res.success || !res.data) throw new Error(res.error)
          setRecords(res.data.items)
        }
      } catch {
        Alert.alert(t('selfMedia.loadFailed'))
      } finally {
        setLoading(false)
      }
    },
    [t],
  )

  useEffect(() => {
    void load(tab)
  }, [tab, load])

  const onInvoke = async (skill: SelfMediaSkill) => {
    if (!prompt.trim()) {
      Alert.alert(t('selfMedia.promptRequired'))
      return
    }
    setInvoking(true)
    setResult(null)
    try {
      const res = await invokeSelfMediaSkill(skill.id, prompt.trim())
      setResult(res)
      if (!res.ok) Alert.alert(res.error || t('selfMedia.invokeFailed'))
    } catch {
      Alert.alert(t('selfMedia.invokeFailed'))
    } finally {
      setInvoking(false)
    }
  }

  const onShare = () => {
    if (result?.output) void Share.share({ message: result.output })
  }

  return (
    <View className={`flex-1 ${dark ? 'bg-neutral-900' : 'bg-white'}`}>
      <View className="flex-row items-center justify-between px-4 pb-2 pt-3">
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text className="text-sm text-gray-500">{t('common.back')}</Text>
        </TouchableOpacity>
        <Text className="text-base font-medium">{t('selfMedia.title')}</Text>
        <View className="w-8" />
      </View>

      {/* tab 切换 */}
      <View className="mx-4 flex-row gap-2">
        {(['skills', 'records'] as const).map((key) => {
          const active = tab === key
          return (
            <TouchableOpacity
              key={key}
              onPress={() => setTab(key)}
              className={`flex-1 rounded-md py-2 ${active ? 'bg-blue-600' : 'bg-gray-100 dark:bg-neutral-800'}`}
            >
              <Text
                className={`text-center text-xs ${active ? 'font-medium text-white' : 'text-gray-600 dark:text-neutral-300'}`}
              >
                {t(key === 'skills' ? 'selfMedia.tabSkills' : 'selfMedia.tabRecords')}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
        {loading ? (
          <View className="mt-8 items-center">
            <ActivityIndicator size="small" />
          </View>
        ) : tab === 'skills' ? (
          <View className="gap-3">
            {skills.length === 0 ? (
              <Text className="mt-8 text-center text-sm text-gray-400">{t('spec.empty')}</Text>
            ) : (
              skills.map((skill) => {
                const expanded = activeSkillId === skill.id
                return (
                  <View
                    key={skill.id}
                    className="rounded-lg border border-gray-200 p-3 dark:border-neutral-700"
                  >
                    <TouchableOpacity
                      onPress={() => {
                        setActiveSkillId(expanded ? null : skill.id)
                        setResult(null)
                        setPrompt('')
                      }}
                    >
                      <View className="flex-row items-center gap-2">
                        <Text className="text-sm font-medium dark:text-neutral-100">
                          {skill.name}
                        </Text>
                        <View
                          className={`rounded px-1.5 py-0.5 ${skill.available ? 'bg-green-50 dark:bg-green-900/30' : 'bg-gray-100 dark:bg-neutral-800'}`}
                        >
                          <Text
                            className={`text-[10px] ${skill.available ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}`}
                          >
                            {skill.category}
                          </Text>
                        </View>
                      </View>
                      <Text className="mt-1 text-xs text-gray-500 dark:text-neutral-400" numberOfLines={2}>
                        {skill.description}
                      </Text>
                    </TouchableOpacity>

                    {expanded ? (
                      <View className="mt-2">
                        <TextInput
                          value={prompt}
                          onChangeText={setPrompt}
                          placeholder={skill.examples[0] || t('selfMedia.promptPlaceholder')}
                          placeholderTextColor="#9ca3af"
                          multiline
                          textAlignVertical="top"
                          className="min-h-[64px] rounded-md border border-gray-200 p-2.5 text-xs dark:border-neutral-700 dark:text-neutral-100"
                        />
                        <TouchableOpacity
                          onPress={() => void onInvoke(skill)}
                          disabled={invoking || !skill.available}
                          className={`mt-2 items-center rounded-md py-2.5 ${invoking || !skill.available ? 'bg-blue-400' : 'bg-blue-600'}`}
                        >
                          <Text className="text-xs font-medium text-white">
                            {invoking ? t('selfMedia.invoking') : t('selfMedia.invoke')}
                          </Text>
                        </TouchableOpacity>
                        {result ? (
                          <View className="mt-2 rounded-md bg-gray-50 p-2.5 dark:bg-neutral-800">
                            <View className="flex-row items-center justify-between">
                              <Text className="text-[10px] text-gray-400">
                                {t('selfMedia.duration', { ms: result.duration_ms })}
                              </Text>
                              <TouchableOpacity onPress={onShare} hitSlop={{ top: 6, bottom: 6 }}>
                                <Text className="text-xs text-blue-600 dark:text-blue-400">
                                  {t('selfMedia.share')}
                                </Text>
                              </TouchableOpacity>
                            </View>
                            <Text
                              selectable
                              className="mt-1 text-xs leading-4 text-gray-700 dark:text-neutral-200"
                            >
                              {result.output || result.error}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    ) : null}
                  </View>
                )
              })
            )}
          </View>
        ) : records.length === 0 ? (
          <Text className="mt-8 text-center text-sm text-gray-400">{t('selfMedia.empty')}</Text>
        ) : (
          <View className="gap-2.5">
            {records.map((rec) => (
              <View
                key={rec.id}
                className="rounded-lg border border-gray-200 p-3 dark:border-neutral-700"
              >
                <View className="flex-row items-center justify-between">
                  <Text className="flex-1 text-sm font-medium dark:text-neutral-100" numberOfLines={1}>
                    {rec.title}
                  </Text>
                  <View
                    className={`rounded px-1.5 py-0.5 ${rec.status === 'published' ? 'bg-green-50 dark:bg-green-900/30' : rec.status === 'failed' ? 'bg-red-50 dark:bg-red-900/30' : 'bg-gray-100 dark:bg-neutral-800'}`}
                  >
                    <Text
                      className={`text-[10px] ${rec.status === 'published' ? 'text-green-600 dark:text-green-400' : rec.status === 'failed' ? 'text-red-500 dark:text-red-400' : 'text-gray-500 dark:text-neutral-400'}`}
                    >
                      {rec.status}
                    </Text>
                  </View>
                </View>
                <Text className="mt-1 text-[10px] text-gray-400">
                  {rec.category}
                  {rec.topicKeyword ? ` · ${rec.topicKeyword}` : ''}
                  {` · ${new Date(rec.createdAt).toLocaleString()}`}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
