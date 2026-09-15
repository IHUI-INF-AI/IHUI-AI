// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * SelfMediaScreen 自媒体助手(mobile-rn 端 wrapper)
 *
 * 2026-09-15 迁移:UI 与展示逻辑下沉共享层 @ihui/rn-app SelfMediaScreen,
 * 本 wrapper 仅保留平台特定职责:
 * - 数据:listSelfMediaSkills / invokeSelfMediaSkill / listSelfMediaRecords
 * - 技能调用:prompt 校验 + Alert 提示;结果分享走 RN Share API
 * - tab/技能展开/prompt/调用结果全部受控注入共享层
 * - 导航 goBack;主题色 / i18n 注入
 */
import { useCallback, useEffect, useState } from 'react'
import { Alert, Share } from 'react-native'
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
import { SelfMediaScreen as SelfMediaScreenView } from '@ihui/rn-app'
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
    <SelfMediaScreenView
      t={t}
      tab={tab}
      skills={skills}
      records={records}
      loading={loading}
      activeSkillId={activeSkillId}
      prompt={prompt}
      invoking={invoking}
      result={result}
      onTabChange={setTab}
      onSelectSkill={(skillId) => {
        setActiveSkillId(skillId)
        setResult(null)
        setPrompt('')
      }}
      onPromptChange={setPrompt}
      onInvoke={(skill) => void onInvoke(skill)}
      onShare={onShare}
      onBack={() => navigation.goBack()}
      colorScheme={resolvedTheme}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
