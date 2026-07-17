import { View, Text, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { logger } from '@/utils/logger'
import ErrorView from '@/components/ErrorView'

type ModelKey = 'nanobanana' | 'veo3' | 'httpmodel' | 'gemini-flash'

interface ModelEntry {
  key: ModelKey
  name: string
  icon: string
  desc: string
  capabilities: string[]
  available: boolean
  apiStatus: string
  route?: string
}

const MODELS: ModelEntry[] = [
  {
    key: 'nanobanana',
    name: 'NanoBanana',
    icon: '🍌',
    desc: 'Google 图片编辑模型,支持自然语言指令编辑图片',
    capabilities: ['图片编辑', '自然语言指令', '局部重绘'],
    available: false,
    apiStatus: 'API 未迁移',
  },
  {
    key: 'veo3',
    name: 'Veo3',
    icon: '🎬',
    desc: 'Google 视频生成模型,支持高质量文生视频',
    capabilities: ['文生视频', '高清输出', '长视频'],
    available: false,
    apiStatus: 'API 未迁移',
  },
  {
    key: 'httpmodel',
    name: 'HttpModel',
    icon: '🔌',
    desc: '通用 HTTP 模型代理,支持自定义模型接入',
    capabilities: ['自定义模型', 'HTTP 代理', '通用接口'],
    available: false,
    apiStatus: 'API 未迁移',
  },
  {
    key: 'gemini-flash',
    name: 'Gemini-2.5-flash',
    icon: '⚡',
    desc: 'Google Gemini 2.5 Flash 文本模型,快速响应',
    capabilities: ['文本对话', '多模态输入', '快速响应'],
    available: true,
    apiStatus: '可通过 AI 对话使用',
    route: '/pages/ai/chat?model=gemini-2.5-flash',
  },
]

export default function SpecialModelsPage() {
  const [errorMsg, setErrorMsg] = useState('')

  const onEnter = useCallback((model: ModelEntry) => {
    if (!model.available) {
      Taro.showModal({
        title: model.name,
        content: `${model.desc}\n\n状态:${model.apiStatus}\n\n该模型 API 暂未迁移到当前端,请联系管理员或等待后端补充。`,
        showCancel: false,
        confirmText: '知道了',
      })
      return
    }
    if (model.route) {
      Taro.navigateTo({ url: model.route }).catch((e) => {
        logger.error('ai/special', `跳转 ${model.name}`, e)
        setErrorMsg('页面跳转失败')
      })
    } else {
      Taro.showToast({ title: '功能开发中', icon: 'none' })
    }
  }, [])

  return (
    <View className="min-h-screen bg-[#f7f8fa]">
      <ScrollView scrollY className="h-screen">
        <View className="px-3 py-3">
          <Text className="block text-xs text-gray-500 mb-3">
            以下为特殊 AI 模型入口,部分模型 API 仍在迁移中
          </Text>
          {errorMsg ? (
            <View className="mb-2">
              <ErrorView title="操作失败" desc={errorMsg} onRetry={() => setErrorMsg('')} />
            </View>
          ) : null}
          {MODELS.map((m) => (
            <View
              key={m.key}
              className="flex items-center bg-white rounded-lg p-3 mb-2"
              onClick={() => onEnter(m)}
            >
              <View className="flex items-center justify-center w-12 h-12 mr-3 rounded-lg bg-gray-50">
                <Text className="text-2xl">{m.icon}</Text>
              </View>
              <View className="flex-1 min-w-0">
                <View className="flex items-center">
                  <Text className="text-sm font-medium text-gray-800">{m.name}</Text>
                  <Text
                    className={`ml-2 px-2 py-0.5 text-[10px] rounded ${
                      m.available ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {m.available ? '可用' : '未开放'}
                  </Text>
                </View>
                <Text className="block text-xs text-gray-500 mt-1">{m.desc}</Text>
                <View className="flex flex-wrap gap-1 mt-2">
                  {m.capabilities.map((c) => (
                    <Text
                      key={c}
                      className="px-2 py-0.5 text-[10px] rounded bg-gray-50 text-gray-500"
                    >
                      {c}
                    </Text>
                  ))}
                </View>
                <Text className="block text-[10px] text-gray-400 mt-1">{m.apiStatus}</Text>
              </View>
              <Text className="ml-2 text-gray-300 text-lg">›</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  )
}
