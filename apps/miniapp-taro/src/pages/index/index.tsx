// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 首页 AI 对话主页布局
 *
 * 对齐原项目:`D:\历史项目存档\zhs_app-ZZ\Ai-WXMiniVue\src\pages\table\aiIndex\ai_index.vue`
 * 视觉规则:`.trae-cn/tmp/miniapp-taro-style-align/home-spec.md`
 *
 * 结构:7 层嵌套(根 → 容器 → 输入区 → 定位 → 滚动 → 按钮组 → 按钮内容)
 * - DrawerComponent(side='left',500rpx 宽抽屉 + 历史对话 + 用户信息)
 * - NavBar(variant='ai-home',sticky + 标题"智汇AI社区" + 菜单 + 加入社区群)
 * - top_box(消息列表区:share-image 缩为右上角 80rpx 图标 + ScrollView 流式对话渲染)
 * - input_box_content(position: fixed bottom)
 *   - posi_angeetlis(ModelList / MaterialList 切换)
 *   - MaterialCards(已选素材卡片横向滚动)
 *   - ModelTypeButtonGroup(variant='wide',8 个 200rpx×60rpx 横向滚动)
 *   - BottomActionBar(variant='ai-home',ToggleButtonGroup + InputArea + icon-button-group + 语音输入)
 *   - ModelConfigDialog(模型参数配置弹窗)
 *
 * 流式对话(2026-08-13):
 * - handleSend 调用 api.chatStream(SSE 流式),onChunk 渐增 streamingContent,onDone 转为 assistant 消息
 * - top_box 内嵌 ScrollView 渲染 conversationMessages + 流式光标 + 思考中占位
 *
 * 新增功能(2026-08-12):
 * - MaterialList 素材库(sck 按钮触发,4 Tab:文本/图片/视频/音频)
 * - MaterialCards 素材卡片流(横向滚动显示已选素材)
 * - 语音输入模式(切换按钮 + 录音动画)
 * - ModelConfigDialog 模型配置弹窗
 */
import { useTt, useI18n, t } from '@/i18n'
import { View, Image, Text, ScrollView, Button } from '@tarojs/components'
import Taro, {
  useDidShow,
  useShareAppMessage,
  useShareTimeline,
  usePullDownRefresh,
  useReachBottom,
} from '@tarojs/taro'
import { useState, useMemo, useCallback, useEffect } from 'react'
import { isLoggedIn, getUserInfo, type UserInfo } from '@/utils/auth'
import { getSystemInfoCompat } from '@/utils/system-info'
import NavBar from '@/components/NavBar'
import DrawerComponent, {
  type DrawerModelGroup,
  type DrawerUserInfo,
  type DrawerMenuItem,
  type DrawerChatItem,
} from '@/components/DrawerComponent'
import ModelList, { type ModelItem } from '@/components/ModelList'
import type { ModelType } from '@/components/ModelTypeButton'
import BottomActionBar, { type ToggleButtonItem } from '@/components/BottomActionBar'
import ModelConfigDialog from '@/components/ModelConfigDialog'
import type { ModelConfig } from '@/components/ModelConfigDialog'
import AgentListPanel, { type AgentInfo } from '@/components/AgentListPanel'
import SkillsPopup, { type AgentItem } from '@/components/SkillsPopup'
import { FloatBox, ModelTypeButtonGroup } from '@/components'
import closeInputPng from '@/assets/remote/images/close_input.png'
import { rpx } from '@/utils/rpx'
import * as api from '@/api'
import type { ChatMessage } from '@/api'
import { TABBAR_HOME_ICON_URL } from '@/constants/external-urls'
import { FALLBACK_MODELS } from '@ihui/shared/constants'
import ThemeRoot from '@/components/ThemeRoot'

import './index.css'

const DEFAULT_AVATAR = TABBAR_HOME_ICON_URL

// 首页静态资源(Taro config copy.patterns 把 src/static/* 复制到 dist/static/*)
const SHARE_ZHZ_IMG = '/static/images/share_zhz.png'
const QRCODE_IMG = '/static/images/qewm.png'

// 已验证兜底模型(仅后端 /llm/models 不可达或返回空时降级,映射自共享 FALLBACK_MODELS)
const FALLBACK_MODEL_ITEMS: ModelItem[] = FALLBACK_MODELS.map((f) => ({
  id: f.value,
  name: f.label,
  provider: f.vendor,
  context_length: 128000,
  input_price: 0,
}))

// 本地 mock 智能体列表(对齐原项目 agentList 数据源)
const MOCK_AGENTS: AgentInfo[] = [
  {
    id: 'agent-1',
    name: t('pagesindexindex.d1'),
    description: t('pagesindexindex.d2'),
    avatar: '',
    useCount: 1234,
    category: t('ai.agentList.categories.writing'),
  },
  {
    id: 'agent-2',
    name: t('pagesindexindex.d3'),
    description: t('pagesindexindex.d4'),
    avatar: '',
    useCount: 2341,
    category: t('pagesindexindex.d5'),
  },
  {
    id: 'agent-3',
    name: t('pagesindexindex.d6'),
    description: t('pagesindexindex.d7'),
    avatar: '',
    useCount: 987,
    category: t('pagesindexindex.d8'),
  },
  {
    id: 'agent-4',
    name: t('pagesindexindex.d9'),
    description: t('pagesindexindex.d10'),
    avatar: '',
    useCount: 876,
    category: t('pagesindexindex.d11'),
  },
  {
    id: 'agent-5',
    name: t('pagesindexindex.d12'),
    description: t('pagesindexindex.d13'),
    avatar: '',
    useCount: 765,
    category: t('pagesindexindex.d14'),
  },
]

// 本地 mock 技能列表(对齐原项目 skillsPopup 数据源)
const MOCK_SKILLS: AgentItem[] = [
  {
    id: 'skill-1',
    name: t('pagesindexindex.d15'),
    description: t('pagesindexindex.d16'),
    avatar: '',
    useCount: 5678,
    category: 'text',
  },
  {
    id: 'skill-2',
    name: t('pagesindexindex.d17'),
    description: t('pagesindexindex.d18'),
    avatar: '',
    useCount: 4321,
    category: 'image',
  },
  {
    id: 'skill-3',
    name: t('pagesindexindex.d19'),
    description: t('pagesindexindex.d20'),
    avatar: '',
    useCount: 2345,
    category: 'video',
  },
  {
    id: 'skill-4',
    name: t('pagesindexindex.d21'),
    description: t('pagesindexindex.d22'),
    avatar: '',
    useCount: 1234,
    category: 'audio',
  },
  {
    id: 'skill-5',
    name: t('pagesindexindex.d23'),
    description: t('pagesindexindex.d24'),
    avatar: '',
    useCount: 3456,
    category: 'text',
  },
  {
    id: 'skill-6',
    name: t('pagesindexindex.d25'),
    description: t('pagesindexindex.d26'),
    avatar: '',
    useCount: 2100,
    category: 'text',
  },
  {
    id: 'skill-7',
    name: t('pagesindexindex.d27'),
    description: t('pagesindexindex.d28'),
    avatar: '',
    useCount: 5432,
    category: 'image',
  },
  {
    id: 'skill-8',
    name: t('pagesindexindex.d29'),
    description: t('pagesindexindex.d30'),
    avatar: '',
    useCount: 1876,
    category: 'video',
  },
]

// ===== 素材库数据类型 =====
interface MaterialItem {
  id: string | number
  title: string
  content?: string
  imageList?: string[]
  videoUrl?: string
  audioUrl?: string
  posterUrl?: string
  time?: string
  chatId?: string
}

interface MaterialCard {
  type: 1 | 2 | 3 | 4 // 1文本 2图片 3视频 4音频
  id: string | number
  title: string
  content?: string
  imageList?: string[]
  videoUrl?: string
  audioUrl?: string
  posterUrl?: string
  chatId?: string
}

// 素材库 Mock 数据(对齐原项目 getMyCreation API 响应格式)
const MOCK_MATERIAL_TEXT: MaterialItem[] = [
  {
    id: 't1',
    title: t('pagesindexindex.d31'),
    content: t('pagesindexindex.d32'),
    time: '2026-08-10',
  },
  {
    id: 't2',
    title: t('pagesindexindex.d33'),
    content: t('pagesindexindex.d34'),
    time: '2026-08-09',
  },
  {
    id: 't3',
    title: t('pagesindexindex.d35'),
    content: t('pagesindexindex.d36'),
    time: '2026-08-08',
  },
  {
    id: 't4',
    title: t('pagesindexindex.d37'),
    content: t('pagesindexindex.d38'),
    time: '2026-08-07',
  },
]

const MOCK_MATERIAL_IMAGE: MaterialItem[] = [
  {
    id: 'i1',
    title: t('pagesindexindex.d39'),
    imageList: ['https://picsum.photos/seed/img1/300/300'],
    time: '2026-08-10',
  },
  {
    id: 'i2',
    title: t('pagesindexindex.d40'),
    imageList: ['https://picsum.photos/seed/img2/300/300'],
    time: '2026-08-09',
  },
  {
    id: 'i3',
    title: t('pagesindexindex.d41'),
    imageList: ['https://picsum.photos/seed/img3/300/300'],
    time: '2026-08-08',
  },
]

const MOCK_MATERIAL_VIDEO: MaterialItem[] = [
  {
    id: 'v1',
    title: t('pagesindexindex.d42'),
    videoUrl: 'https://example.com/video1.mp4',
    posterUrl: 'https://picsum.photos/seed/vid1/300/200',
    time: '2026-08-10',
  },
  {
    id: 'v2',
    title: t('pagesindexindex.d43'),
    videoUrl: 'https://example.com/video2.mp4',
    posterUrl: 'https://picsum.photos/seed/vid2/300/200',
    time: '2026-08-09',
  },
]

const MOCK_MATERIAL_AUDIO: MaterialItem[] = [
  {
    id: 'a1',
    title: t('pagesindexindex.d44'),
    audioUrl: 'https://example.com/audio1.mp3',
    time: '2026-08-10',
  },
  {
    id: 'a2',
    title: t('pagesindexindex.d45'),
    audioUrl: 'https://example.com/audio2.mp3',
    time: '2026-08-09',
  },
  {
    id: 'a3',
    title: t('pagesindexindex.d46'),
    audioUrl: 'https://example.com/audio3.mp3',
    time: '2026-08-08',
  },
]

// 素材库 tab 配置
const MATERIAL_TABS = [
  { id: 1, label: t('aigc.list.catText') },
  { id: 2, label: t('aigc.list.catImage') },
  { id: 3, label: t('aigc.list.catVideo') },
  { id: 4, label: t('aigc.list.catAudio') },
] as const

interface AiHomeState {
  drawerVisible: boolean
  showModelList: boolean
  currentModelType: ModelType | ''
  selectedModelId: string | number | undefined
  agentModeActive: boolean
  isLogin: boolean
  userInfo: UserInfo | null
  modelName: string
  showSharePointsPopup: boolean
  showQrCodeModal: boolean
  showIconButtons: boolean
  toggleButtons: ToggleButtonItem[]
  groupedData: DrawerModelGroup[]
  // 素材库状态
  showMaterialList: boolean
  materialTab: 1 | 2 | 3 | 4
  materialTextList: MaterialItem[]
  materialImageList: MaterialItem[]
  materialVideoList: MaterialItem[]
  materialAudioList: MaterialItem[]
  materialCards: MaterialCard[]
  materialLoading: boolean
  // 语音输入状态
  isVoiceInput: boolean
  isVoiceAnimationActive: boolean
  isRecording: boolean
  // 模型配置状态
  showModelConfig: boolean
  modelConfig: ModelConfig
  // 技能商店弹窗
  showSkillsPopup: boolean
  // 智能体列表
  showAgentList: boolean
  // 分页状态
  page: number
  pageSize: number
  hasMore: boolean
  isLoadingMore: boolean
  // 输入框焦点
  isInputFocused: boolean
  // 公告文本
  announcementText: string
  // 流式对话状态(对标原项目 conversationMessages)
  conversationMessages: ChatMessage[]
  isStreaming: boolean
  streamingContent: string
  sessionId: string
}

/**
 * PushNotification 推送通知(对齐原项目 PushNotification.vue L4 + L3646-3653)
 * - 通过 Taro.eventCenter 监听 'showPushNotification' 全局事件
 * - showToast 兜底显示通知(简化版,原项目是有 UI 渲染的弹窗)
 */
function PushNotification() {
  // 对齐原项目:监听 showPushNotification 全局事件
  useDidShow(() => {
    Taro.eventCenter.on('showPushNotification', (options: { title?: string; content?: string }) => {
      if (options?.title) {
        Taro.showToast({
          title: options.title,
          icon: 'none',
          duration: 3000,
        })
      }
    })
  })

  // 清理监听(防止内存泄漏)
  useEffect(() => {
    return () => {
      Taro.eventCenter.off('showPushNotification')
    }
  }, [])

  return null
}

// ===== MaterialCards 子组件(提取自主组件,减少嵌套,对齐"做减法"原则)=====
function MaterialCards({
  cards,
  onRemove,
  tt,
}: {
  cards: MaterialCard[]
  onRemove: (index: number) => void
  tt: (key: string, fallback: string) => string
}) {
  if (cards.length === 0) return null
  return (
    <View
      className="material-cards-wrap"
      style={{ background: 'var(--color-card-subtle)' }}
    >
      <ScrollView scrollX className="material-cards-scroll" showScrollbar={false}>
        <View
          className="material-cards-list"
          style={{ display: 'flex', flexDirection: 'row', padding: '10rpx 20rpx' }}
        >
          {cards.map((card, index) => (
            <View
              key={`mc-${card.id || index}-${index}`}
              className="material-card-item"
              style={{ marginRight: rpx(16) }}
            >
              <Image
                src={closeInputPng}
                mode="widthFix"
                className="material-card-close"
                style={{
                  width: rpx(32),
                  height: rpx(32),
                  position: 'absolute',
                  top: rpx(-8),
                  right: rpx(-8),
                  zIndex: 2,
                }}
                onClick={() => onRemove(index)}
              />
              {card.type === 1 && (
                <View
                  className="material-card-body material-card-text"
                  style={{
                    width: rpx(200),
                    height: rpx(160),
                    padding: rpx(12),
                    background: 'var(--color-card)',
                    borderRadius: rpx(16),
                  }}
                >
                  <Text
                    className="material-card-title"
                    style={{ fontSize: rpx(24), fontWeight: 'bold', marginBottom: rpx(6) }}
                  >
                    {card.title}
                  </Text>
                  <Text
                    className="material-card-preview"
                    style={{ fontSize: rpx(20), color: 'var(--color-muted-foreground)' }}
                  >
                    {(card.content || '').slice(0, 20)}
                    {card.content && card.content.length > 20 ? '...' : ''}
                  </Text>
                </View>
              )}
              {card.type === 2 && card.imageList && card.imageList[0] && (
                <View
                  className="material-card-body material-card-img"
                  style={{ width: rpx(200), borderRadius: rpx(16), overflow: 'hidden' }}
                >
                  <Image
                    src={card.imageList[0]}
                    mode="aspectFill"
                    style={{ width: rpx(200), height: rpx(140) }}
                  />
                  <Text
                    className="material-card-title"
                    style={{
                      fontSize: rpx(22),
                      padding: rpx(6),
                      background: 'rgba(0,0,0,0.5)',
                      color: 'var(--color-foreground)',
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                    }}
                  >
                    {card.title}
                  </Text>
                </View>
              )}
              {card.type === 3 && (
                <View
                  className="material-card-body material-card-video"
                  style={{ width: rpx(200), borderRadius: rpx(16), overflow: 'hidden' }}
                >
                  <Image
                    src={card.posterUrl || card.videoUrl || ''}
                    mode="aspectFill"
                    style={{ width: rpx(200), height: rpx(140) }}
                  />
                  <Text
                    className="material-card-title"
                    style={{
                      fontSize: rpx(22),
                      padding: rpx(6),
                      background: 'rgba(0,0,0,0.5)',
                      color: 'var(--color-foreground)',
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                    }}
                  >
                    {card.title}
                  </Text>
                </View>
              )}
              {card.type === 4 && (
                <View
                  className="material-card-body material-card-audio"
                  style={{
                    width: rpx(200),
                    height: rpx(140),
                    padding: rpx(12),
                    background: 'var(--color-card)',
                    borderRadius: rpx(16),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text
                    className="material-card-title"
                    style={{ fontSize: rpx(24), fontWeight: 'bold' }}
                  >
                    {card.title}
                  </Text>
                  <Text
                    className="material-card-preview"
                    style={{ fontSize: rpx(20), color: 'var(--color-muted-foreground)', marginTop: rpx(6) }}
                  >
                    {tt('index.material.audio', '音频')}
                  </Text>
                </View>
              )}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  )
}

// ===== VoiceAnimationOverlay 子组件(提取自主组件,对齐原项目 voice-animation-overlay)=====
function VoiceAnimationOverlay({
  visible,
  tt,
  onClose,
}: {
  visible: boolean
  tt: (key: string, fallback: string) => string
  onClose: () => void
}) {
  if (!visible) return null
  return (
    <View
      className="voice-animation-overlay"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 1001,
        background: 'var(--color-card)',
        padding: '30rpx 0',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <Text style={{ fontSize: rpx(28), color: 'var(--color-foreground)', marginBottom: rpx(20) }}>
        {tt('index.voice.listening', '正在聆听...')}
      </Text>
      <View
        className="voice-wave-container"
        style={{ display: 'flex', alignItems: 'center', gap: rpx(8), height: rpx(80) }}
      >
        {[1, 2, 3, 4, 5].map((i) => (
          <View
            key={i}
            className="ai-voice-move voice-wave-bar"
            style={{
              width: rpx(8),
              height: rpx(60),
              background: 'var(--color-brand-cyan)',
              borderRadius: rpx(4),
              animationDelay: `${i * 0.1}s`,
              animationDuration: `${0.5 + i * 0.1}s`,
            }}
          />
        ))}
      </View>
      <Text style={{ fontSize: rpx(24), color: 'var(--color-muted-foreground)', marginTop: rpx(16) }}>
        {tt('index.voice.tapToStop', '点击停止录音')}
      </Text>
    </View>
  )
}

export default function Index() {
  const { t } = useI18n()
  const tt = useTt()
  const [state, setState] = useState<AiHomeState>(() => ({
    drawerVisible: false,
    showModelList: false,
    currentModelType: '',
    selectedModelId: undefined,
    agentModeActive: false,
    isLogin: false,
    userInfo: null,
    modelName: '',
    showSharePointsPopup: false,
    showQrCodeModal: false,
    showIconButtons: false,
    toggleButtons: [
      { key: 'superAgent', label: tt('index.feature.superAgent', '深度思考'), active: false },
      { key: 'mcp', label: tt('index.feature.mcp', '联网'), active: false },
      { key: 'knowledgeBase', label: tt('index.feature.knowledgeBase', '知识库'), active: false },
      {
        key: 'permanentMemory',
        label: tt('index.feature.permanentMemory', '永久记忆'),
        active: false,
      },
    ],
    groupedData: [
      {
        modelName: 'GPT-4',
        dateGroups: [
          {
            date: tt('index.mock.today', '今天'),
            chats: [
              {
                id: 1,
                title: tt('index.mock.post1Title', '如何使用 React Hooks?'),
                date: tt('index.mock.today', '今天'),
              },
              {
                id: 2,
                title: tt('index.mock.post2Title', 'TypeScript 类型推断'),
                date: tt('index.mock.today', '今天'),
              },
            ],
          },
        ],
      },
      {
        modelName: 'Claude',
        dateGroups: [
          {
            date: tt('index.mock.yesterday', '昨天'),
            chats: [
              {
                id: 3,
                title: tt('index.mock.post3Title', '设计模式讨论'),
                date: tt('index.mock.yesterday', '昨天'),
              },
            ],
          },
        ],
      },
    ],
    // 素材库
    showMaterialList: false,
    materialTab: 1,
    materialTextList: MOCK_MATERIAL_TEXT,
    materialImageList: MOCK_MATERIAL_IMAGE,
    materialVideoList: MOCK_MATERIAL_VIDEO,
    materialAudioList: MOCK_MATERIAL_AUDIO,
    materialCards: [],
    materialLoading: false,
    // 语音输入
    isVoiceInput: false,
    isVoiceAnimationActive: false,
    isRecording: false,
    // 模型配置
    showModelConfig: false,
    modelConfig: {
      temperature: 0.7,
      maxTokens: 2048,
      topP: 0.9,
      systemPrompt: '',
      streamEnabled: true,
    },
    // 技能商店弹窗
    showSkillsPopup: false,
    // 智能体列表
    showAgentList: false,
    // 分页状态
    page: 1,
    pageSize: 10,
    hasMore: true,
    isLoadingMore: false,
    // 输入框焦点
    isInputFocused: false,
    // 公告文本
    announcementText: t('pagesindexindex.register1'),
    // 流式对话状态
    conversationMessages: [],
    isStreaming: false,
    streamingContent: '',
    sessionId: '',
  }))

  // 模型列表(唯一权威源:后端 /llm/models 已过滤"可用且有配额"模型)
  const [models, setModels] = useState<ModelItem[]>([])
  const [modelsLoading, setModelsLoading] = useState(false)
  // 输入框文本(受控,由 BottomActionBar -> InputArea 双向绑定)
  const [inputText, setInputText] = useState('')

  const systemInfo = getSystemInfoCompat()
  const statusBarHeight = systemInfo.statusBarHeight || 20

  useDidShow(() => {
    // 修复 (2026-08-12):Taro H5 在 dev server 模式下挂载完页面会自动滚动到
    // scrollTop=426,导致首屏 Hero + Toolbar 在视口上方不可见,留下 40% 空白。
    // 这里强制重置到顶部,确保用户首屏看到 Hero。
    try {
      Taro.pageScrollTo({ scrollTop: 0, duration: 0 })
    } catch {
      // 静默:部分 Taro 版本可能不支持 pageScrollTo API
    }
    const logged = isLoggedIn()
    const info = getUserInfo()
    setState((s) => ({
      ...s,
      isLogin: logged,
      userInfo: info,
      // 初始化默认选中第一个模型(后端列表未加载时用已验证兜底,id 与后端 /llm/models 一致)
      modelName: s.modelName || (models[0]?.name ?? FALLBACK_MODEL_ITEMS[0]?.name ?? ''),
      selectedModelId: s.selectedModelId ?? models[0]?.id ?? FALLBACK_MODEL_ITEMS[0]?.id,
    }))
  })

  // 拉取模型列表(唯一权威源:后端过滤后的可用模型);失败/空时降级为共享已验证兜底
  const loadModels = useCallback(async () => {
    setModelsLoading(true)
    try {
      const res = await api.fetchModels()
      setModels(res?.models && res.models.length > 0 ? res.models : FALLBACK_MODEL_ITEMS)
    } catch {
      setModels(FALLBACK_MODEL_ITEMS)
    } finally {
      setModelsLoading(false)
    }
  }, [])

  // 仅在列表为空时拉取,避免 useDidShow 重复请求
  useEffect(() => {
    if (!models.length) loadModels()
  }, [models.length, loadModels])

  // 下拉刷新(对齐原项目 onPullDownRefresh)
  usePullDownRefresh(() => {
    // 重置分页并刷新数据
    setState((s) => ({
      ...s,
      page: 1,
      hasMore: true,
      isLoadingMore: false,
    }))
    setTimeout(() => {
      Taro.stopPullDownRefresh()
    }, 500)
  })

  // 上拉加载更多(对齐原项目 onReachBottom)
  useReachBottom(() => {
    loadMoreModels()
  })

  // 微信分享配置
  useShareAppMessage(() => ({
    title: t('share.appTitle'),
    path: '/pages/index/index',
    imageUrl: '/static/share.png',
  }))
  useShareTimeline(() => ({
    title: t('share.timelineTitle'),
    query: '',
  }))

  // ===== 事件处理 =====
  const handleMenuClick = () => setState((s) => ({ ...s, drawerVisible: true }))
  const handleDrawerClose = () => setState((s) => ({ ...s, drawerVisible: false }))
  const handleJoinClick = () => setState((s) => ({ ...s, showQrCodeModal: true }))
  const handleQrCodeClose = () => setState((s) => ({ ...s, showQrCodeModal: false }))
  const handleSharePointsClose = () => {
    // 对齐原项目 closeSharePointsPopup:storage 清理 + 事件移除
    try {
      Taro.setStorageSync('shareCancelled', true)
      Taro.removeStorageSync('isSharing')
      Taro.removeStorageSync('shareStatus')
    } catch {
      // 静默:部分平台可能不支持
    }
    Taro.eventCenter.off('shareSuccess')
    Taro.eventCenter.off('shareFail')
    setState((s) => ({ ...s, showSharePointsPopup: false }))
  }

  // 处理模型类型点击(sck 特殊处理→素材库,skills 特殊处理→暂不实现,其他→ModelList)
  const handleModelTypeClick = useCallback(
    (type: ModelType) => {
      if (type === 'sck') {
        // sck 类型:切换素材库弹窗(对齐原项目 toggleMaterialPopup)
        setState((s) => {
          if (s.currentModelType === 'sck') {
            return { ...s, currentModelType: '', showMaterialList: false }
          }
          return {
            ...s,
            currentModelType: 'sck',
            showMaterialList: true,
            showModelList: false,
            materialTab: 1,
          }
        })
      } else if (type === 'skills') {
        // skills 类型:弹出技能商店(SkillsPopup) + 显示智能体列表(对齐原项目 toggleSkillsPopup)
        setState((s) => {
          if (s.currentModelType === 'skills') {
            return { ...s, currentModelType: '', showSkillsPopup: false, showAgentList: false }
          }
          return {
            ...s,
            currentModelType: 'skills',
            showSkillsPopup: true,
            showAgentList: true,
            showModelList: false,
            showMaterialList: false,
          }
        })
      } else {
        // 其他类型(talk/image/video/audio/videoa/other):切换 + 自动选第一个模型
        // 对齐原项目 ai_index.vue L698-777:setTimeout 500ms 自动选中
        setState((s) => ({
          ...s,
          currentModelType: s.currentModelType === type ? '' : type,
          showModelList: s.currentModelType !== type,
          showMaterialList: false,
        }))
        // 自动选第一个模型(对齐原项目,从对应分类列表取第一个)
        // 2026-08-27:改取后端列表/已验证兜底第一个(id 与后端一致),不再用 MOCK_MODELS
        setTimeout(() => {
          setState((s) => {
            if (s.currentModelType !== type) return s // 用户已切换走,不自动选
            const firstModel = models[0] ?? FALLBACK_MODEL_ITEMS[0]
            if (!firstModel) return s
            return {
              ...s,
              selectedModelId: firstModel.id,
              modelName: firstModel.name,
            }
          })
        }, 500)
      }
    },
    [models],
  )

  // ===== 容器点击关闭逻辑(对齐原项目 handleContainerClick) =====
  // 点击容器空白处关闭所有弹出层(由内层组件自行 stopPropagation)
  const handleContainerClick = useCallback(() => {
    setState((s) => {
      if (!s.showModelList && !s.showAgentList && !s.showSkillsPopup && !s.showMaterialList)
        return s
      return {
        ...s,
        showModelList: false,
        showAgentList: false,
        showSkillsPopup: false,
        showMaterialList: false,
        currentModelType: '',
      }
    })
  }, [])

  const handleModelSelect = (model: ModelItem) => {
    setState((s) => ({
      ...s,
      selectedModelId: model.id,
      modelName: model.name,
      showModelList: false,
      currentModelType: '',
    }))
  }

  // 技能选择回调(从 SkillsPopup 选择技能)
  const handleSkillSelect = useCallback((skill: AgentItem) => {
    setState((s) => ({
      ...s,
      selectedModelId: skill.id,
      modelName: skill.name,
      showSkillsPopup: false,
      currentModelType: '',
    }))
  }, [])

  // 关闭技能商店弹窗(同时关闭 AgentList,对齐原项目)
  const handleSkillsClose = useCallback(() => {
    setState((s) => ({
      ...s,
      showSkillsPopup: false,
      showAgentList: false,
      currentModelType: '',
    }))
  }, [])

  // 输入框聚焦/失焦
  const handleInputFocus = useCallback(() => {
    setState((s) => ({ ...s, isInputFocused: true }))
  }, [])

  const handleInputBlur = useCallback(() => {
    setState((s) => ({ ...s, isInputFocused: false }))
  }, [])

  // 键盘显示/隐藏
  const handleKeyboardShow = useCallback((_height: number) => {
    // 键盘弹出时可选调整布局
  }, [])

  // 分页加载更多模型
  const loadMoreModels = useCallback(() => {
    setState((s) => {
      if (s.isLoadingMore || !s.hasMore) return s
      return { ...s, isLoadingMore: true, page: s.page + 1 }
    })
    // 模拟异步加载
    setTimeout(() => {
      setState((s) => ({
        ...s,
        isLoadingMore: false,
        hasMore: s.page < 5, // 最多 5 页
      }))
    }, 1000)
  }, [])

  const handleAgentToggle = () => {
    setState((s) => ({
      ...s,
      agentModeActive: !s.agentModeActive,
      selectedModelId: undefined,
      showModelList: false,
    }))
  }

  const handleCreateNewChat = () => {
    setState((s) => ({ ...s, drawerVisible: false }))
    Taro.navigateTo({ url: '/pages/ai/chat' }).catch(() => {
      // 路径不存在时静默
    })
  }

  const handleMenuItemClick = (item: DrawerMenuItem) => {
    setState((s) => ({ ...s, drawerVisible: false }))
    const pathMap: Record<string, string> = {
      appStore: '/pages/model-plaza/index',
      demand: '/pages/community/index',
      inspiration: '/pages/ai/agent',
      dynamic: '/pages/community/index',
      course: '/pages/course/list',
    }
    const path = pathMap[item.key]
    if (path) {
      Taro.switchTab({ url: path, fail: () => Taro.navigateTo({ url: path }) })
    }
  }

  const handleChatItemClick = (chat: DrawerChatItem) => {
    setState((s) => ({ ...s, drawerVisible: false }))
    Taro.navigateTo({ url: `/pages/ai/chat?id=${chat.id}` }).catch(() => {
      // 路径不存在时静默
    })
  }

  const handleToggleButtonClick = (item: ToggleButtonItem) => {
    setState((s) => ({
      ...s,
      toggleButtons: s.toggleButtons.map((btn) =>
        btn.key === item.key ? { ...btn, active: !btn.active } : btn,
      ),
    }))
  }

  const handleSend = async (text: string) => {
    if (!state.isLogin) {
      Taro.showToast({ title: tt('index.toast.loginRequired', '请先登录'), icon: 'none' })
      return
    }
    if (!text.trim() || state.isStreaming) return

    const userMsg: ChatMessage = {
      role: 'user',
      content: text,
      timestamp: Date.now(),
    }

    const sid = state.sessionId || `sess_${Date.now()}`

    setState((s) => ({
      ...s,
      conversationMessages: [...s.conversationMessages, userMsg],
      isStreaming: true,
      streamingContent: '',
      sessionId: sid,
    }))

    setInputText('')

    setTimeout(() => {
      Taro.pageScrollTo({ scrollTop: 999999, duration: 300 }).catch(() => {})
    }, 100)

    try {
      await api.chatStream(
        [...state.conversationMessages, userMsg],
        sid,
        {
          model: state.modelName || undefined,
          modelId: state.selectedModelId ? String(state.selectedModelId) : undefined,
          agentId: state.agentModeActive ? String(state.selectedModelId ?? '') : undefined,
        },
        (delta: string) => {
          setState((s) => ({
            ...s,
            streamingContent: s.streamingContent + delta,
          }))
        },
        undefined,
        undefined,
        undefined,
        undefined,
        (info) => {
          setState((s) => {
            const assistantMsg: ChatMessage = {
              role: 'assistant',
              content: s.streamingContent,
              timestamp: Date.now(),
              tokenCount: info?.totalTokens,
            }
            return {
              ...s,
              conversationMessages: [...s.conversationMessages, assistantMsg],
              isStreaming: false,
              streamingContent: '',
            }
          })
        },
      )
    } catch {
      setState((s) => {
        const errorMsg: ChatMessage = {
          role: 'assistant',
          content: s.streamingContent || tt('index.chatError', '发送失败,请重试'),
          timestamp: Date.now(),
        }
        return {
          ...s,
          conversationMessages: [...s.conversationMessages, errorMsg],
          isStreaming: false,
          streamingContent: '',
        }
      })
      Taro.showToast({ title: tt('index.chatError', '发送失败,请重试'), icon: 'none' })
    }
  }

  // ===== 素材库事件处理(对齐原项目 ai_index.vue) =====
  const handleMaterialTabChange = useCallback((tabId: number) => {
    setState((s) => ({
      ...s,
      materialTab: tabId as 1 | 2 | 3 | 4,
    }))
  }, [])

  const handleMaterialItemClick = useCallback(
    (item: MaterialItem, type: 1 | 2 | 3 | 4) => {
      const card: MaterialCard = {
        type,
        id: item.id,
        title:
          item.title ||
          (type === 1
            ? tt('aigc.list.untitled', '文本内容')
            : type === 2
              ? tt('pagesindexindex.p1', '图片内容')
              : type === 3
                ? tt('pagesindexindex.p2', '视频内容')
                : tt('pagesindexindex.p3', '音频内容')),
        content: item.content,
        imageList: item.imageList,
        videoUrl: item.videoUrl,
        audioUrl: item.audioUrl,
        posterUrl: item.posterUrl,
        chatId: item.chatId,
      }
      setState((s) => ({
        ...s,
        materialCards: [...s.materialCards, card],
        showMaterialList: false,
        currentModelType: '',
      }))
    },
    [tt],
  )

  const removeMaterialCard = useCallback((index: number) => {
    setState((s) => ({
      ...s,
      materialCards: s.materialCards.filter((_, i) => i !== index),
    }))
  }, [])

  // ===== 语音输入(对齐原项目 toggleVoiceInput) =====
  const toggleVoiceInput = useCallback(() => {
    setState((s) => {
      const newVoiceInput = !s.isVoiceInput
      return {
        ...s,
        isVoiceInput: newVoiceInput,
        isVoiceAnimationActive: newVoiceInput,
        isRecording: newVoiceInput,
      }
    })
    // 模拟录音结束(实际需集成录音 API)
    if (!state.isVoiceInput) {
      setTimeout(() => {
        setState((s) => ({
          ...s,
          isVoiceAnimationActive: false,
          isRecording: false,
        }))
      }, 5000)
    }
  }, [state.isVoiceInput])

  // ===== 模型配置 =====
  const handleModelConfigChange = useCallback((config: ModelConfig | Record<string, unknown>) => {
    setState((s) => ({
      ...s,
      modelConfig: config as ModelConfig,
    }))
  }, [])

  const handleModelConfigClose = useCallback(() => {
    setState((s) => ({ ...s, showModelConfig: false }))
  }, [])

  // ===== 用户信息(传给 Drawer)=====
  const drawerUserinfo: DrawerUserInfo | undefined = state.userInfo
    ? {
        avatar: state.userInfo.avatar || DEFAULT_AVATAR,
        nickname: state.userInfo.userName || state.userInfo.nickname,
      }
    : undefined

  // ===== 计算底部偏移(对齐原项目 computedContainerBottom,简化为 0 由键盘自适应)=====
  const computedContainerBottom = '0'

  // ===== 当前类型模型列表(对齐原项目根据 currentModelType 过滤)=====
  const filteredModels = useMemo(() => {
    if (
      !state.currentModelType ||
      state.currentModelType === 'skills' ||
      state.currentModelType === 'sck'
    ) {
      return models
    }
    return models
  }, [models, state.currentModelType])

  // ===== 获取当前 tab 的素材列表 =====
  const currentMaterialList = useMemo(() => {
    switch (state.materialTab) {
      case 1:
        return state.materialTextList
      case 2:
        return state.materialImageList
      case 3:
        return state.materialVideoList
      case 4:
        return state.materialAudioList
      default:
        return state.materialTextList
    }
  }, [
    state.materialTab,
    state.materialTextList,
    state.materialImageList,
    state.materialVideoList,
    state.materialAudioList,
  ])

  return (
    <ThemeRoot className="ai-home-page min-h-screen">
      <View
        style={{ background: 'var(--color-background)' }}
        onClick={handleContainerClick}
      >
      {/* ===== PushNotification 推送通知弹窗(对齐原项目) ===== */}
      <PushNotification />

      {/* ===== DrawerComponent (左侧抽屉,500rpx) ===== */}
      <DrawerComponent
        side="left"
        visible={state.drawerVisible}
        onClose={handleDrawerClose}
        statusBarHeight={statusBarHeight}
        groupedData={state.groupedData}
        userinfo={drawerUserinfo}
        activeChatId={state.selectedModelId}
        onMenuItemClick={handleMenuItemClick}
        onChatItemClick={handleChatItemClick}
        onCreateChat={handleCreateNewChat}
      />

      {/* ===== FloatBox 悬浮侧边栏(对齐原项目 float-box) ===== */}
      <FloatBox />

      {/* ===== container 主容器(对齐原项目 container) ===== */}
      <View className="container" style={{ padding: 0 }}>
        {/* ===== NavBar(导航栏,对齐原项目 navigation-bars) ===== */}
        <NavBar
          variant="ai-home"
          title={tt('index.title', '智汇AI社区')}
          bgColor="var(--color-card)"
          textColor="var(--color-foreground)"
          onMenuClick={handleMenuClick}
          onJoinClick={handleJoinClick}
        />

        {/* ===== top_box(对齐原项目,改为消息列表区)===== */}
        <View
          className="top_box"
          style={{
            padding: '0 20rpx',
            height: 'calc(100vh - 120rpx - env(safe-area-inset-bottom))',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* 顶部 share-image(缩小为右上角小图标,对齐原项目 titlebox-right)*/}
          <View
            className="titlebox"
            style={{
              width: '100%',
              display: 'flex',
              justifyContent: 'flex-end',
              marginBottom: rpx(10),
            }}
          >
            <View className="titlebox-right">
              <Image
                className="share-image"
                style={{ width: rpx(80), height: rpx(80) }}
                src="/static/images/share_zhuanmi.png"
                mode="widthFix"
                onClick={() => {
                  Taro.switchTab({
                    url: '/pages/user/index',
                    success: () => {
                      setTimeout(() => {
                        Taro.eventCenter.trigger('showImageSharePopup', { current: 0 })
                      }, 500)
                    },
                  })
                }}
              />
            </View>
          </View>

          {/* 消息列表(对标原项目 conversationMessages 渲染)*/}
          <ScrollView
            scrollY
            className="conversation-list"
            style={{ flex: 1, height: 'calc(100% - 100rpx)' }}
            onScrollToLower={() => {}}
          >
            {/* 直播预告 banner(对齐 home.livePreview/startTime/more) */}
            <View
              className="live-preview-banner"
              style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: `${rpx(16)} ${rpx(20)}`,
                marginBottom: rpx(16),
                background:
                  'linear-gradient(90deg, var(--color-brand-cyan), var(--color-primary))',
                borderRadius: rpx(16),
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: rpx(28), fontWeight: 'bold', color: 'var(--color-foreground)' }}>
                  {tt('home.livePreview', '直播预告')}
                </Text>
                <Text
                  style={{ fontSize: rpx(22), color: 'rgba(255,255,255,0.92)', marginTop: rpx(4) }}
                >
                  {tt('home.startTime', '开播时间')} 20:00
                </Text>
              </View>
              <View
                onClick={() => Taro.navigateTo({ url: '/pages/live/list' })}
                style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}
              >
                <Text style={{ fontSize: rpx(22), color: 'var(--color-foreground)' }}>{tt('home.more', '更多')}</Text>
              </View>
            </View>
            {state.conversationMessages.length === 0 && !state.isStreaming ? (
              <View
                className="flex flex-col items-center justify-center"
                style={{ paddingTop: rpx(200) }}
              >
                <Text
                  style={{
                    fontSize: rpx(32),
                    color: 'var(--color-muted-foreground)',
                    marginBottom: rpx(16),
                  }}
                >
                  {tt('index.welcome', '欢迎使用智汇AI社区')}
                </Text>
                <Text style={{ fontSize: rpx(26), color: 'var(--color-text-date)' }}>
                  {tt('index.welcomeHint', '输入消息开始对话')}
                </Text>
              </View>
            ) : null}
            {state.conversationMessages.map((msg, idx) => (
              <View
                key={idx}
                className={`conversation-msg ${msg.role === 'user' ? 'msg-user' : 'msg-assistant'}`}
                style={{
                  display: 'flex',
                  justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  marginBottom: rpx(16),
                }}
              >
                <View
                  style={{
                    maxWidth: '80%',
                    padding: `${rpx(16)} ${rpx(20)}`,
                    borderRadius: rpx(16),
                    background:
                      msg.role === 'user'
                        ? 'var(--color-brand-cyan)'
                        : 'var(--color-card)',
                    color: 'var(--color-foreground)',
                    fontSize: rpx(28),
                    lineHeight: 1.6,
                    boxShadow: '0 2rpx 8rpx rgba(0,0,0,0.05)',
                  }}
                >
                  <Text>{msg.content}</Text>
                </View>
              </View>
            ))}
            {/* 流式接收中的消息 */}
            {state.isStreaming && state.streamingContent ? (
              <View
                className="conversation-msg msg-assistant"
                style={{
                  display: 'flex',
                  justifyContent: 'flex-start',
                  marginBottom: rpx(16),
                }}
              >
                <View
                  style={{
                    maxWidth: '80%',
                    padding: `${rpx(16)} ${rpx(20)}`,
                    borderRadius: rpx(16),
                    background: 'var(--color-card)',
                    color: 'var(--color-foreground)',
                    fontSize: rpx(28),
                    lineHeight: 1.6,
                  }}
                >
                  <Text>{state.streamingContent}</Text>
                  <Text
                    style={{
                      display: 'inline-block',
                      width: rpx(8),
                      height: rpx(28),
                      background: 'var(--color-brand-cyan)',
                      marginLeft: rpx(4),
                      animation: 'blink 1s infinite',
                    }}
                  >
                    |
                  </Text>
                </View>
              </View>
            ) : null}
            {/* loading 占位(流式刚开始,onChunk 还未到)*/}
            {state.isStreaming && !state.streamingContent ? (
              <View
                style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: rpx(16) }}
              >
                <View
                  style={{
                    padding: `${rpx(16)} ${rpx(20)}`,
                    borderRadius: rpx(16),
                    background: 'var(--color-card)',
                  }}
                >
                  <Text style={{ fontSize: rpx(28), color: 'var(--color-muted-foreground)' }}>
                    {tt('index.thinking', '思考中...')}
                  </Text>
                </View>
              </View>
            ) : null}
          </ScrollView>
        </View>

        {/* ===== input_box_content(底部输入区,fixed 贴底,对齐原项目) ===== */}
        <View
          className="input_box_content"
          style={{
            position: 'fixed',
            bottom: computedContainerBottom,
            left: 0,
            right: 0,
            zIndex: 1000,
          }}
        >
          {/* ===== posi_angeetlis(对齐原项目,包裹 ModelList/AgentList/MaterialList + ModelType 按钮) ===== */}
          <View className="posi_angeetlis">
            {/* ModelList/AgentList/MaterialList 区域(对齐原项目 padding 0 20rpx) */}
            <View style={{ padding: '0 20rpx' }}>
              {/* ModelList 模型列表 */}
              {state.showModelList &&
              state.currentModelType &&
              state.currentModelType !== 'skills' &&
              state.currentModelType !== 'sck' ? (
                <View onClick={(e: { stopPropagation: () => void }) => e.stopPropagation()}>
                  <ModelList
                    variant="popup"
                    models={filteredModels}
                    selectedId={state.selectedModelId}
                    onSelect={handleModelSelect}
                    currentType={state.currentModelType}
                    agentActive={state.agentModeActive}
                    onAgentSelect={handleAgentToggle}
                    loading={modelsLoading}
                  />
                </View>
              ) : null}
              {/* AgentList 智能体列表(对齐原项目 AgentList) */}
              {state.showAgentList ? (
                <View onClick={(e: { stopPropagation: () => void }) => e.stopPropagation()}>
                  <AgentListPanel
                    visible={state.showAgentList}
                    agents={MOCK_AGENTS}
                    loading={false}
                    onSelect={(agent) => {
                      setState((s) => ({
                        ...s,
                        selectedModelId: agent.id,
                        modelName: agent.name,
                        showAgentList: false,
                      }))
                      // 对齐原项目 handleAgentPitch:跳转到智能体助手页
                      Taro.navigateTo({
                        url: `/pages/ai/agent?id=${agent.id}&name=${encodeURIComponent(agent.name)}`,
                        fail: () => {
                          Taro.showToast({
                            title: tt('pagesindexindex.text2', '智能体助手页未配置'),
                            icon: 'none',
                          })
                        },
                      })
                    }}
                  />
                </View>
              ) : null}
              {/* MaterialList 素材库弹窗(对齐原项目 MaterialList) */}
              {state.showMaterialList ? (
                <View
                  className="material-list-container"
                  onClick={(e: { stopPropagation: () => void }) => e.stopPropagation()}
                >
                  {/* Tab 栏:文本/图片/视频/音频 */}
                  <View className="material-tabs">
                    {MATERIAL_TABS.map((tab) => (
                      <View
                        key={tab.id}
                        className={`material-tab ${state.materialTab === tab.id ? 'material-tab-active' : ''}`}
                        onClick={() => handleMaterialTabChange(tab.id)}
                      >
                        <Text className="material-tab-text">{tab.label}</Text>
                      </View>
                    ))}
                  </View>
                  {/* 素材列表 */}
                  <ScrollView
                    scrollY
                    className="material-list-scroll"
                    style={{ maxHeight: rpx(500) }}
                    onScrollToLower={() => {
                      // 加载更多(暂用 mock 数据,不重复加载)
                    }}
                  >
                    {currentMaterialList.length === 0 ? (
                      <View className="flex items-center justify-center py-[40rpx]">
                        <Text style={{ fontSize: rpx(28), color: 'var(--color-text-date)' }}>
                          {tt('index.material.empty', '暂无素材')}
                        </Text>
                      </View>
                    ) : (
                      currentMaterialList.map((item) => (
                        <View
                          key={item.id}
                          className="material-list-item"
                          onClick={() => handleMaterialItemClick(item, state.materialTab)}
                        >
                          {/* 文本类型:显示标题 + 内容预览 */}
                          {state.materialTab === 1 && (
                            <View className="material-item-text">
                              <Text className="material-item-title">{item.title}</Text>
                              {item.content && (
                                <Text className="material-item-preview">
                                  {(item.content || '').slice(0, 40)}
                                  {item.content && item.content.length > 40 ? '...' : ''}
                                </Text>
                              )}
                            </View>
                          )}
                          {/* 图片类型:显示缩略图 + 标题 */}
                          {state.materialTab === 2 && item.imageList && item.imageList[0] && (
                            <View className="material-item-image">
                              <Image
                                src={item.imageList[0]}
                                className="material-item-thumb"
                                mode="aspectFill"
                                style={{ width: rpx(120), height: rpx(120), borderRadius: rpx(12) }}
                              />
                              <Text className="material-item-title">{item.title}</Text>
                            </View>
                          )}
                          {/* 视频类型:显示封面 + 标题 */}
                          {state.materialTab === 3 && (
                            <View className="material-item-video">
                              <Image
                                src={item.posterUrl || item.videoUrl || ''}
                                className="material-item-thumb"
                                mode="aspectFill"
                                style={{ width: rpx(120), height: rpx(120), borderRadius: rpx(12) }}
                              />
                              <Text className="material-item-title">{item.title}</Text>
                            </View>
                          )}
                          {/* 音频类型:显示标题 */}
                          {state.materialTab === 4 && (
                            <View className="material-item-audio">
                              <Text className="material-item-title">{item.title}</Text>
                              <Text className="material-item-preview">
                                {tt('index.material.audio', '音频')}
                              </Text>
                            </View>
                          )}
                        </View>
                      ))
                    )}
                  </ScrollView>
                </View>
              ) : null}
            </View>

            {/* ModelType 按钮区域(对齐原项目,使用 ModelTypeButtonGroup 组件) */}
            <View onClick={(e: { stopPropagation: () => void }) => e.stopPropagation()}>
              <ModelTypeButtonGroup
                variant="wide"
                activeType={state.currentModelType}
                onSelect={(type) => handleModelTypeClick(type)}
              />
            </View>
          </View>

          {/* ModelConfigDialog 模型配置弹窗(在 ModelList 和 MaterialCards 之间) */}
          {state.showModelConfig && (
            <ModelConfigDialog
              visible
              variant="default"
              config={state.modelConfig}
              onChange={handleModelConfigChange}
              onClose={handleModelConfigClose}
            />
          )}

          {/* MaterialCards 素材卡片流(在 ModelConfigDialog 和 BottomActionBar 之间) */}
          <MaterialCards cards={state.materialCards} onRemove={removeMaterialCard} tt={tt} />

          {/* BottomActionBar 底部操作栏(对齐原项目) */}
          <View
            style={{
              background: 'var(--color-card)',
              paddingBottom: 'calc(env(safe-area-inset-bottom) + 10rpx)',
              boxShadow: '0 -2rpx 10rpx rgba(0, 0, 0, 0.05)',
            }}
          >
            <BottomActionBar
              variant="ai-home"
              modelName={state.modelName}
              showIconButtons
              isVoiceInput={state.isVoiceInput}
              onVoiceInputToggle={toggleVoiceInput}
              toggleButtons={state.toggleButtons}
              inputAreaProps={{
                value: inputText,
                onInput: setInputText,
                onSend: handleSend,
                placeholder: state.isLogin
                  ? tt('message.inputPlaceholder', '输入消息...')
                  : tt('ai.aiAssistant.pleaseLogin', '请先登录'),
                onFocus: handleInputFocus,
                onBlur: handleInputBlur,
                onKeyboardHeightChange: handleKeyboardShow,
              }}
              onToggle={handleToggleButtonClick}
            />
          </View>
        </View>
      </View>

      {/* ===== SkillsPopup 技能商店弹窗(对齐原项目 skills popup,在 input_box_content 之外) ===== */}
      <SkillsPopup
        visible={state.showSkillsPopup}
        agents={MOCK_SKILLS}
        loading={false}
        selectedId={state.selectedModelId as string | undefined}
        onSelect={handleSkillSelect}
        onClose={handleSkillsClose}
      />

      {/* ===== 语音输入动画覆盖层(对齐原项目 .voice-animation-overlay,提取为子组件) ===== */}
      <VoiceAnimationOverlay
        visible={state.isVoiceAnimationActive}
        tt={tt}
        onClose={() =>
          setState((s) => ({
            ...s,
            isVoiceAnimationActive: false,
            isVoiceInput: false,
            isRecording: false,
          }))
        }
      />

      {/* ===== share-points-popup(分享领智汇值弹窗,对齐原项目 v-if,在 input_box_content 之外) ===== */}
      {state.showSharePointsPopup ? (
        <View
          className="fixed inset-0 z-[9999] flex items-center justify-center"
          onClick={handleSharePointsClose}
        >
          <View className="absolute inset-0" style={{ background: 'rgba(0, 0, 0, 0.5)' }} />
          <View
            className="ai-flip-in relative z-10 flex flex-col items-center"
            onClick={(e: { stopPropagation: () => void }) => e.stopPropagation()}
          >
            <Image src={SHARE_ZHZ_IMG} style={{ width: rpx(440) }} mode="widthFix" />
            {/* 分享按钮(对齐原项目 popup-share-btn,open-type="share" 用于微信小程序) */}
            <Button
              openType="share"
              className="absolute inset-0 w-full h-full"
              style={{ opacity: 0, zIndex: 10 }}
              onClick={() => {
                // 分享成功后弹出下一轮分享提示
                setState((s) => ({ ...s, showSharePointsPopup: false }))
              }}
            />
          </View>
        </View>
      ) : null}

      {/* ===== qr-code-modal(二维码弹窗,在 input_box_content 之外) ===== */}
      {state.showQrCodeModal ? (
        <View
          className="fixed inset-0 z-[9999] flex items-center justify-center"
          onClick={handleQrCodeClose}
          style={{ background: 'rgba(0, 0, 0, 0.7)' }}
        >
          <View
            className="ai-popup-fade-in flex flex-col items-center"
            style={{
              background: 'var(--color-card)',
              borderRadius: rpx(20),
              padding: '50rpx 40rpx 20rpx',
            }}
            onClick={(e: { stopPropagation: () => void }) => e.stopPropagation()}
          >
            <Image
              src={QRCODE_IMG}
              style={{ width: rpx(600), height: rpx(600) }}
              mode="aspectFit"
              onLongPress={() => {
                // 长按保存二维码(对齐原项目 handleLongPressQrCode)
                Taro.showActionSheet({
                  itemList: [tt('pagesindexindex.r1', '保存图片到相册')],
                  success: () => {
                    Taro.showToast({
                      title: tt('pagesindexindex.save3', '图片已保存'),
                      icon: 'success',
                    })
                  },
                  fail: () => {
                    // 用户取消操作
                  },
                }).catch(() => {})
              }}
            />
            <Text
              style={{ fontSize: rpx(32), color: 'var(--color-foreground)', marginTop: rpx(20) }}
            >
              {tt('index.qrCodeHint', '扫描二维码加入社区')}
            </Text>
            {/* 关闭按钮(对齐原项目 .qr-code-close:60rpx×60rpx,圆形,AGENTS 豁免)*/}
            <View
              className="ai-close-btn"
              style={{
                top: rpx(10),
                right: rpx(10),
                width: rpx(60),
                height: rpx(60),
                border: '1px solid var(--color-foreground)',
              }}
              onClick={handleQrCodeClose}
            >
              <Text
                style={{ fontSize: rpx(60), lineHeight: rpx(60), color: 'var(--color-foreground)' }}
              >
                ×
              </Text>
            </View>
          </View>
        </View>
      ) : null}
      </View>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
