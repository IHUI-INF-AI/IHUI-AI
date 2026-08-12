/**
 * 首页 AI 对话主页布局
 *
 * 对齐原项目:`D:\历史项目存档\zhs_app-ZZ\Ai-WXMiniVue\src\pages\table\aiIndex\ai_index.vue`
 * 视觉规则:`.trae-cn/tmp/miniapp-taro-style-align/home-spec.md`
 *
 * 结构:7 层嵌套(根 → 容器 → 输入区 → 定位 → 滚动 → 按钮组 → 按钮内容)
 * - DrawerComponent(side='left',500rpx 宽抽屉 + 历史对话 + 用户信息)
 * - NavBar(variant='ai-home',sticky + 标题"智汇AI社区" + 菜单 + 加入社区群)
 * - top_box(顶部 72vh 区域,share-image 140rpx×140rpx,pulse 动画)
 * - input_box_content(position: fixed bottom)
 *   - posi_angeetlis(ModelList / MaterialList 切换)
 *   - MaterialCards(已选素材卡片横向滚动)
 *   - ModelTypeButtonGroup(variant='wide',8 个 200rpx×60rpx 横向滚动)
 *   - BottomActionBar(variant='ai-home',ToggleButtonGroup + InputArea + icon-button-group + 语音输入)
 *   - ModelConfigDialog(模型参数配置弹窗)
 *
 * 新增功能(2026-08-12):
 * - MaterialList 素材库(sck 按钮触发,4 Tab:文本/图片/视频/音频)
 * - MaterialCards 素材卡片流(横向滚动显示已选素材)
 * - 语音输入模式(切换按钮 + 录音动画)
 * - ModelConfigDialog 模型配置弹窗
 */
import { View, Image, Text, ScrollView } from '@tarojs/components'
import Taro, {
  useDidShow,
  useShareAppMessage,
  useShareTimeline,
  usePullDownRefresh,
  useReachBottom,
} from '@tarojs/taro'
import { useState, useMemo, useCallback } from 'react'
import { isLoggedIn, getUserInfo, type UserInfo } from '@/utils/auth'
import { useI18n, useTt } from '@/i18n'
import NavBar from '@/components/NavBar'
import DrawerComponent, {
  type DrawerModelGroup,
  type DrawerUserInfo,
  type DrawerMenuItem,
  type DrawerChatItem,
} from '@/components/DrawerComponent'
import ModelList, { type ModelItem } from '@/components/ModelList'
import type { ModelType } from '@/components/ModelTypeButton'
import BottomActionBar, {
  type ToggleButtonItem,
} from '@/components/BottomActionBar'
import ModelConfigDialog from '@/components/ModelConfigDialog'
import type { ModelConfig } from '@/components/ModelConfigDialog'
import AgentListPanel, { type AgentInfo } from '@/components/AgentListPanel'
import SkillsPopup, { type AgentItem } from '@/components/SkillsPopup'
import closeInputPng from '@/assets/remote/images/close_input.png'
import { rpx } from '@/utils/rpx'
// ===== 内联模型类型按钮 SVG 资源(对齐原项目 ai_index.vue model-type-btn) =====
import skillsIcon from '@/assets/images/add/skills.svg'
import talkIcon from '@/assets/images/add/talk.svg'
import imageIcon from '@/assets/images/add/image.svg'
import videoIcon from '@/assets/images/add/video.svg'
import audioIcon from '@/assets/images/add/audio.svg'
import videoaIcon from '@/assets/images/add/videoa.svg'
import otherIcon from '@/assets/images/add/other.svg'
import sckIcon from '@/assets/images/add/sck.svg'
import activeBackSvg from '@/static/images/add/active_back.svg'
import backDefaultSvg from '@/static/images/add/back_default.svg'
import jiantouSvg from '@/static/images/add/jiantou.svg'

import './index.css'

const DEFAULT_AVATAR =
  'https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/tabbar/tabbar/home.png'

// 首页静态资源(Taro config copy.patterns 把 src/static/* 复制到 dist/static/*)
const SHARE_ZHZ_IMG = '/static/images/share_zhz.png'
const QRCODE_IMG = '/static/images/qewm.png'

// 本地 mock 模型列表(对齐原项目 modelList 数据源,TODO: 接入真实 API /api/llm/models)
const MOCK_MODELS: ModelItem[] = [
  { id: 'step-3.7-flash', name: 'Step 3.7 Flash', provider: 'stepfun', context_length: 128000, input_price: 0 },
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai', context_length: 128000, input_price: 0 },
  { id: 'claude-3.5', name: 'Claude 3.5', provider: 'anthropic', context_length: 200000, input_price: 0 },
]

// 本地 mock 智能体列表(对齐原项目 agentList 数据源,TODO: 接入真实 API)
const MOCK_AGENTS: AgentInfo[] = [
  { id: 'agent-1', name: 'AI 写作助手', description: '帮你撰写高质量文章、报告和文案', avatar: '', useCount: 1234, category: '写作' },
  { id: 'agent-2', name: '编程助手', description: '代码编写、调试和优化建议', avatar: '', useCount: 2341, category: '开发' },
  { id: 'agent-3', name: '数据分析师', description: '数据可视化和分析洞察', avatar: '', useCount: 987, category: '分析' },
  { id: 'agent-4', name: '设计创意师', description: '创意设计和视觉方案', avatar: '', useCount: 876, category: '设计' },
  { id: 'agent-5', name: '翻译达人', description: '多语言翻译和本地化', avatar: '', useCount: 765, category: '工具' },
]

// 本地 mock 技能列表(对齐原项目 skillsPopup 数据源,TODO: 接入真实 API)
const MOCK_SKILLS: AgentItem[] = [
  { id: 'skill-1', name: '文本生成', description: '高质量文本内容生成', avatar: '', useCount: 5678, category: 'text' },
  { id: 'skill-2', name: '图片生成', description: 'AI 绘画和图片创作', avatar: '', useCount: 4321, category: 'image' },
  { id: 'skill-3', name: '视频制作', description: 'AI 视频生成和编辑', avatar: '', useCount: 2345, category: 'video' },
  { id: 'skill-4', name: '音频处理', description: '语音合成和音频编辑', avatar: '', useCount: 1234, category: 'audio' },
  { id: 'skill-5', name: '代码生成', description: '多语言代码自动生成', avatar: '', useCount: 3456, category: 'text' },
  { id: 'skill-6', name: '数据分析', description: '数据分析和可视化', avatar: '', useCount: 2100, category: 'text' },
  { id: 'skill-7', name: 'AI 绘画', description: '文生图和图生图创作', avatar: '', useCount: 5432, category: 'image' },
  { id: 'skill-8', name: '视频剪辑', description: '智能视频剪辑和特效', avatar: '', useCount: 1876, category: 'video' },
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
  { id: 't1', title: 'AI 绘画入门指南', content: '本文详细介绍 AI 绘画的基础知识和常用工具...', time: '2026-08-10' },
  { id: 't2', title: '深度学习模型优化技巧', content: '如何优化深度学习模型的训练速度和准确率...', time: '2026-08-09' },
  { id: 't3', title: 'Prompt 工程最佳实践', content: '掌握 Prompt 工程的核心技巧,提升 AI 输出质量...', time: '2026-08-08' },
  { id: 't4', title: '多模态 AI 应用场景', content: '探索多模态 AI 在医疗、教育、金融等领域的应用...', time: '2026-08-07' },
]

const MOCK_MATERIAL_IMAGE: MaterialItem[] = [
  { id: 'i1', title: '山水风景画', imageList: ['https://picsum.photos/seed/img1/300/300'], time: '2026-08-10' },
  { id: 'i2', title: '城市夜景', imageList: ['https://picsum.photos/seed/img2/300/300'], time: '2026-08-09' },
  { id: 'i3', title: '抽象艺术作品', imageList: ['https://picsum.photos/seed/img3/300/300'], time: '2026-08-08' },
]

const MOCK_MATERIAL_VIDEO: MaterialItem[] = [
  { id: 'v1', title: 'AI 视频生成教程', videoUrl: 'https://example.com/video1.mp4', posterUrl: 'https://picsum.photos/seed/vid1/300/200', time: '2026-08-10' },
  { id: 'v2', title: '数字人直播演示', videoUrl: 'https://example.com/video2.mp4', posterUrl: 'https://picsum.photos/seed/vid2/300/200', time: '2026-08-09' },
]

const MOCK_MATERIAL_AUDIO: MaterialItem[] = [
  { id: 'a1', title: 'AI 语音合成演示', audioUrl: 'https://example.com/audio1.mp3', time: '2026-08-10' },
  { id: 'a2', title: 'TTS 音色对比', audioUrl: 'https://example.com/audio2.mp3', time: '2026-08-09' },
  { id: 'a3', title: '语音克隆效果', audioUrl: 'https://example.com/audio3.mp3', time: '2026-08-08' },
]

// 素材库 tab 配置
const MATERIAL_TABS = [
  { id: 1, label: '文本' },
  { id: 2, label: '图片' },
  { id: 3, label: '视频' },
  { id: 4, label: '音频' },
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
  // 分享弹窗
  showSharePopup: boolean
  // 公告文本
  announcementText: string
  // FloatBox 悬浮组件可见性(对齐原项目 floatboxVisible)
  floatboxVisible: boolean
}

/**
 * FloatBox 悬浮侧边栏组件(对齐原项目 FloatBox.vue)
 * - 固定在右下侧,包含"赚米"/"客服"/"反馈"按钮
 * - 可展开/收起
 */
function FloatBox({
  visible,
  onToggle,
  onShare,
  onCustomerService,
  onFeedback,
}: {
  visible: boolean
  onToggle: () => void
  onShare?: () => void
  onCustomerService?: () => void
  onFeedback?: () => void
}) {
  return (
    <View>
      {/* 侧边栏展开时显示透明遮罩 */}
      {!visible && (
        <View
          className="fixed inset-0"
          style={{ zIndex: 1004, background: 'transparent' }}
          onClick={onToggle}
        />
      )}
      <View
        className="float-box"
        style={{
          position: 'fixed',
          right: visible ? rpx(20) : rpx(-240),
          bottom: '9%',
          width: rpx(118),
          minHeight: rpx(340),
          backgroundColor: '#fff',
          borderRadius: rpx(30),
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          transition: 'right 0.35s cubic-bezier(0.4, 1.3, 0.6, 1)',
          zIndex: 1005,
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
        }}
      >
        {/* 展开箭头 */}
        <View
          className="float-arrow"
          style={{
            width: rpx(40),
            height: rpx(100),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'absolute',
            left: visible ? rpx(-161) : rpx(-37),
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'transparent',
            zIndex: 10000,
            transition: 'left 0.3s',
          }}
          onClick={(e: { stopPropagation: () => void }) => {
            e.stopPropagation()
            onToggle()
          }}
        >
          <Text
            style={{
              fontSize: rpx(36),
              color: '#333',
              fontWeight: 'bold',
            }}
          >
            {visible ? '◀' : '▶'}
          </Text>
        </View>
        {/* 悬浮内容 */}
        {visible && (
          <View
            className="float-content"
            style={{
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: `${rpx(14)} 0`,
              boxSizing: 'border-box',
              justifyContent: 'center',
            }}
          >
            {/* 赚米按钮 */}
            <View
              className="float-item"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                margin: `${rpx(5)} 0`,
                background: 'none',
                border: 'none',
                padding: 0,
              }}
              onClick={(e: { stopPropagation: () => void }) => {
                e.stopPropagation()
                onShare?.()
              }}
            >
              <Text style={{ fontSize: rpx(36), marginBottom: rpx(6) }}>💰</Text>
              <Text
                style={{
                  fontSize: rpx(28),
                  fontWeight: 'bold',
                  color: '#ff0000',
                  letterSpacing: rpx(2),
                }}
              >
                赚米
              </Text>
            </View>
            {/* 客服按钮 */}
            <View
              className="float-item"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                margin: `${rpx(5)} 0`,
                background: 'none',
                border: 'none',
                padding: 0,
              }}
              onClick={(e: { stopPropagation: () => void }) => {
                e.stopPropagation()
                onCustomerService?.()
              }}
            >
              <Text style={{ fontSize: rpx(36), marginBottom: rpx(6) }}>💬</Text>
              <Text
                style={{
                  fontSize: rpx(28),
                  fontWeight: 'bold',
                  color: '#222',
                  letterSpacing: rpx(2),
                }}
              >
                客服
              </Text>
            </View>
            {/* 反馈按钮 */}
            <View
              className="float-item"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                margin: `${rpx(5)} 0`,
                background: 'none',
                border: 'none',
                padding: 0,
              }}
              onClick={(e: { stopPropagation: () => void }) => {
                e.stopPropagation()
                onFeedback?.()
              }}
            >
              <Text style={{ fontSize: rpx(36), marginBottom: rpx(6) }}>📝</Text>
              <Text
                style={{
                  fontSize: rpx(28),
                  fontWeight: 'bold',
                  color: '#222',
                  letterSpacing: rpx(2),
                }}
              >
                反馈
              </Text>
            </View>
          </View>
        )}
      </View>
    </View>
  )
}

/**
 * PushNotification 推送通知弹窗组件(对齐原项目 PushNotification.vue)
 * - 通过全局事件触发显示,固定在页面顶部
 * - 当前为占位组件,待接入真实推送逻辑
 */
function PushNotification() {
  return null
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
      { key: 'permanentMemory', label: tt('index.feature.permanentMemory', '永久记忆'), active: false },
    ],
    groupedData: [
      {
        modelName: 'GPT-4',
        dateGroups: [
          {
            date: tt('index.mock.today', '今天'),
            chats: [
              { id: 1, title: tt('index.mock.post1Title', '如何使用 React Hooks?'), date: tt('index.mock.today', '今天') },
              { id: 2, title: tt('index.mock.post2Title', 'TypeScript 类型推断'), date: tt('index.mock.today', '今天') },
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
              { id: 3, title: tt('index.mock.post3Title', '设计模式讨论'), date: tt('index.mock.yesterday', '昨天') },
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
    // 分享弹窗
    showSharePopup: false,
    // 公告文本
    announcementText: '🎉 欢迎使用智汇AI社区，新用户注册即赠5000智汇值！',
    // FloatBox 可见性(对齐原项目 floatboxVisible: true)
    floatboxVisible: true,
  }))

  const [models] = useState<ModelItem[]>(MOCK_MODELS)
  // 输入框文本(受控,由 BottomActionBar -> InputArea 双向绑定)
  const [inputText, setInputText] = useState('')

  const systemInfo = Taro.getSystemInfoSync()
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
      // 初始化默认选中第一个模型(对齐原项目默认模型)
      modelName: s.modelName || (MOCK_MODELS[0]?.name ?? ''),
      selectedModelId: s.selectedModelId ?? MOCK_MODELS[0]?.id,
    }))
  })

  // 下拉刷新(对齐原项目 onPullDownRefresh)
  usePullDownRefresh(() => {
    // 重置分页并刷新数据(TODO: 接入真实 API)
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
  const handleSharePointsClose = () => setState((s) => ({ ...s, showSharePointsPopup: false }))

  // 处理模型类型点击(sck 特殊处理→素材库,skills 特殊处理→暂不实现,其他→ModelList)
  const handleModelTypeClick = useCallback((type: ModelType) => {
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
      // skills 类型:弹出技能商店(SkillsPopup)
      setState((s) => ({
        ...s,
        currentModelType: 'skills',
        showSkillsPopup: true,
        showModelList: false,
        showMaterialList: false,
      }))
    } else {
      setState((s) => ({
        ...s,
        currentModelType: s.currentModelType === type ? '' : type,
        showModelList: s.currentModelType !== type,
        showMaterialList: false,
      }))
    }
  }, [])

  // ===== 容器点击关闭逻辑(对齐原项目 handleContainerClick) =====
  // 点击容器空白处关闭所有弹出层(由内层组件自行 stopPropagation)
  const handleContainerClick = useCallback(() => {
    setState((s) => {
      if (!s.showModelList && !s.showAgentList && !s.showSkillsPopup && !s.showMaterialList) return s
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

  // ===== 内部容器点击处理(对齐原项目 container @click="handleClick") =====
  // 与 handleContainerClick 不同,此为 container 内部容器专用
  const handleInnerClick = useCallback(() => {
    // 原项目用于切换 sourceIs/sourceIsAgent 状态
    // 当前 Taro 版本通过 BottomActionBar 的 toggle 按钮处理,此处为占位
  }, [])

  // FloatBox 切换可见性
  const handleFloatBoxToggle = useCallback(() => {
    setState((s) => ({ ...s, floatboxVisible: !s.floatboxVisible }))
  }, [])

  // FloatBox 分享(赚米)
  const handleFloatBoxShare = useCallback(() => {
    setState((s) => ({ ...s, showSharePopup: true }))
  }, [])

  // FloatBox 客服
  const handleFloatBoxCustomerService = useCallback(() => {
    Taro.showToast({ title: '客服功能开发中', icon: 'none' })
  }, [])

  // FloatBox 反馈
  const handleFloatBoxFeedback = useCallback(() => {
    Taro.navigateTo({ url: '/pagesA/fankui/index' }).catch(() => {
      Taro.showToast({ title: '反馈页面未配置', icon: 'none' })
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

  // 关闭技能商店弹窗
  const handleSkillsClose = useCallback(() => {
    setState((s) => ({
      ...s,
      showSkillsPopup: false,
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

  // 分享成功触发分享弹窗
  const handleShareTrigger = useCallback(() => {
    setState((s) => ({ ...s, showSharePopup: true }))
  }, [])

  // 分页加载更多模型
  const loadMoreModels = useCallback(() => {
    setState((s) => {
      if (s.isLoadingMore || !s.hasMore) return s
      return { ...s, isLoadingMore: true, page: s.page + 1 }
    })
    // 模拟异步加载(TODO: 接入真实 API)
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

  const handleSend = (text: string) => {
    if (!state.isLogin) {
      Taro.showToast({ title: tt('index.toast.loginRequired', '请先登录'), icon: 'none' })
      return
    }
    Taro.navigateTo({ url: `/pages/ai/chat?prompt=${encodeURIComponent(text)}` }).catch(() => {
      Taro.showToast({ title: tt('index.toast.chatNotConfigured', '对话页未配置'), icon: 'none' })
    })
  }

  // ===== 素材库事件处理(对齐原项目 ai_index.vue) =====
  const handleMaterialTabChange = useCallback((tabId: number) => {
    setState((s) => ({
      ...s,
      materialTab: tabId as 1 | 2 | 3 | 4,
    }))
  }, [])

  const handleMaterialItemClick = useCallback((item: MaterialItem, type: 1 | 2 | 3 | 4) => {
    const card: MaterialCard = {
      type,
      id: item.id,
      title: item.title || (type === 1 ? '文本内容' : type === 2 ? '图片内容' : type === 3 ? '视频内容' : '音频内容'),
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
  }, [])

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
    if (!state.currentModelType || state.currentModelType === 'skills' || state.currentModelType === 'sck') {
      return models
    }
    return models
  }, [models, state.currentModelType])

  // ===== 获取当前 tab 的素材列表 =====
  const currentMaterialList = useMemo(() => {
    switch (state.materialTab) {
      case 1: return state.materialTextList
      case 2: return state.materialImageList
      case 3: return state.materialVideoList
      case 4: return state.materialAudioList
      default: return state.materialTextList
    }
  }, [state.materialTab, state.materialTextList, state.materialImageList, state.materialVideoList, state.materialAudioList])

  return (
    <View className="ai-home-page min-h-screen" style={{ background: 'var(--color-background)' }} onClick={handleContainerClick}>
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
      <FloatBox
        visible={state.floatboxVisible}
        onToggle={handleFloatBoxToggle}
        onShare={handleFloatBoxShare}
        onCustomerService={handleFloatBoxCustomerService}
        onFeedback={handleFloatBoxFeedback}
      />

      {/* ===== container 主容器(对齐原项目 container @click=handleClick) ===== */}
      <View className="container" style={{ padding: 0 }} onClick={handleInnerClick}>
        {/* ===== NavBar(导航栏,对齐原项目 navigation-bars) ===== */}
        <NavBar
          variant="ai-home"
          title={tt('index.title', '智汇AI社区')}
          bgColor="var(--color-card)"
          textColor="var(--color-foreground)"
          onMenuClick={handleMenuClick}
          onJoinClick={handleJoinClick}
        />

        {/* ===== top_box(对齐原项目 padding 0 20rpx,height: calc(72vh)) ===== */}
        <View
          className="top_box"
          style={{
            padding: '0 20rpx',
            height: 'calc(72vh)',
            position: 'relative',
          }}
        >
          <View className="titlebox" style={{ width: '100%', display: 'flex', justifyContent: 'flex-end', paddingTop: rpx(20) }}>
            <View className="titlebox-right">
              <Image
                className="share-image"
                style={{ width: rpx(140), height: rpx(140) }}
                src="/static/images/share_zhuanmi.png"
                mode="widthFix"
                onClick={() => Taro.switchTab({ url: '/pages/user/index' })}
              />
            </View>
          </View>
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
              {state.showModelList && state.currentModelType && state.currentModelType !== 'skills' && state.currentModelType !== 'sck' ? (
                <View onClick={(e: { stopPropagation: () => void }) => e.stopPropagation()}>
                  <ModelList
                    variant="popup"
                    models={filteredModels}
                    selectedId={state.selectedModelId}
                    onSelect={handleModelSelect}
                    currentType={state.currentModelType}
                    agentActive={state.agentModeActive}
                    onAgentSelect={handleAgentToggle}
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
                    }}
                  />
                </View>
              ) : null}
              {/* MaterialList 素材库弹窗(对齐原项目 MaterialList) */}
              {state.showMaterialList ? (
                <View className="material-list-container" onClick={(e: { stopPropagation: () => void }) => e.stopPropagation()}>
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
                        <Text style={{ fontSize: rpx(28), color: 'var(--color-text-date, #888)' }}>
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
                                  {(item.content || '').slice(0, 40)}{(item.content && item.content.length > 40) ? '...' : ''}
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
                              <Text className="material-item-preview">{tt('index.material.audio', '音频')}</Text>
                            </View>
                          )}
                        </View>
                      ))
                    )}
                  </ScrollView>
                </View>
              ) : null}
            </View>

            {/* ModelType 按钮区域(对齐原项目 display:flex justify-content:center margin-bottom:10rpx) */}
            <View style={{ display: 'flex', flexDirection: 'row', justifyContent: 'center', marginBottom: '10rpx' }}>
              <ScrollView scrollX className="w-full" style={{ whiteSpace: 'nowrap' }} enhanced showScrollbar={false}>
                <View
                  className="inline-flex flex-row items-center"
                  style={{ padding: '0 20rpx' }}
                >
                  {/* skills 技能商店 */}
                  <View
                    className="ai-model-type-btn"
                    onClick={(e: { stopPropagation: () => void }) => {
                      e.stopPropagation()
                      handleModelTypeClick('skills')
                    }}
                  >
                    <Image
                      className="absolute top-0 left-0"
                      src={state.currentModelType === 'skills' ? activeBackSvg : backDefaultSvg}
                      style={{ width: '100%', height: '100%', zIndex: 1, opacity: state.currentModelType === 'skills' ? 1 : 0.6 }}
                      mode="aspectFill"
                    />
                    <View className="relative flex items-center justify-center" style={{ zIndex: 3 }}>
                      <Image src={skillsIcon} style={{ width: rpx(100), height: rpx(36) }} mode="aspectFit" />
                      <Image
                        src={jiantouSvg}
                        className={state.currentModelType === 'skills' ? 'ai-btn-arrow-rotate' : 'ai-btn-arrow'}
                        style={{ width: rpx(20), height: rpx(20), position: 'relative', zIndex: 3, marginLeft: rpx(6) }}
                        mode="aspectFit"
                      />
                    </View>
                  </View>
                  {/* talk 文本对话 */}
                  <View
                    className="ai-model-type-btn"
                    onClick={(e: { stopPropagation: () => void }) => {
                      e.stopPropagation()
                      handleModelTypeClick('talk')
                    }}
                  >
                    <Image
                      className="absolute top-0 left-0"
                      src={state.currentModelType === 'talk' ? activeBackSvg : backDefaultSvg}
                      style={{ width: '100%', height: '100%', zIndex: 1, opacity: state.currentModelType === 'talk' ? 1 : 0.6 }}
                      mode="aspectFill"
                    />
                    <View className="relative flex items-center justify-center" style={{ zIndex: 3 }}>
                      <Image src={talkIcon} style={{ width: rpx(100), height: rpx(36) }} mode="aspectFit" />
                      <Image
                        src={jiantouSvg}
                        className={state.currentModelType === 'talk' ? 'ai-btn-arrow-rotate' : 'ai-btn-arrow'}
                        style={{ width: rpx(20), height: rpx(20), position: 'relative', zIndex: 3, marginLeft: rpx(6) }}
                        mode="aspectFit"
                      />
                    </View>
                  </View>
                  {/* image 图片生成 */}
                  <View
                    className="ai-model-type-btn"
                    onClick={(e: { stopPropagation: () => void }) => {
                      e.stopPropagation()
                      handleModelTypeClick('image')
                    }}
                  >
                    <Image
                      className="absolute top-0 left-0"
                      src={state.currentModelType === 'image' ? activeBackSvg : backDefaultSvg}
                      style={{ width: '100%', height: '100%', zIndex: 1, opacity: state.currentModelType === 'image' ? 1 : 0.6 }}
                      mode="aspectFill"
                    />
                    <View className="relative flex items-center justify-center" style={{ zIndex: 3 }}>
                      <Image src={imageIcon} style={{ width: rpx(100), height: rpx(36) }} mode="aspectFit" />
                      <Image
                        src={jiantouSvg}
                        className={state.currentModelType === 'image' ? 'ai-btn-arrow-rotate' : 'ai-btn-arrow'}
                        style={{ width: rpx(20), height: rpx(20), position: 'relative', zIndex: 3, marginLeft: rpx(6) }}
                        mode="aspectFit"
                      />
                    </View>
                  </View>
                  {/* video 视频生成 */}
                  <View
                    className="ai-model-type-btn"
                    onClick={(e: { stopPropagation: () => void }) => {
                      e.stopPropagation()
                      handleModelTypeClick('video')
                    }}
                  >
                    <Image
                      className="absolute top-0 left-0"
                      src={state.currentModelType === 'video' ? activeBackSvg : backDefaultSvg}
                      style={{ width: '100%', height: '100%', zIndex: 1, opacity: state.currentModelType === 'video' ? 1 : 0.6 }}
                      mode="aspectFill"
                    />
                    <View className="relative flex items-center justify-center" style={{ zIndex: 3 }}>
                      <Image src={videoIcon} style={{ width: rpx(100), height: rpx(36) }} mode="aspectFit" />
                      <Image
                        src={jiantouSvg}
                        className={state.currentModelType === 'video' ? 'ai-btn-arrow-rotate' : 'ai-btn-arrow'}
                        style={{ width: rpx(20), height: rpx(20), position: 'relative', zIndex: 3, marginLeft: rpx(6) }}
                        mode="aspectFit"
                      />
                    </View>
                  </View>
                  {/* audio 音频生成 */}
                  <View
                    className="ai-model-type-btn"
                    onClick={(e: { stopPropagation: () => void }) => {
                      e.stopPropagation()
                      handleModelTypeClick('audio')
                    }}
                  >
                    <Image
                      className="absolute top-0 left-0"
                      src={state.currentModelType === 'audio' ? activeBackSvg : backDefaultSvg}
                      style={{ width: '100%', height: '100%', zIndex: 1, opacity: state.currentModelType === 'audio' ? 1 : 0.6 }}
                      mode="aspectFill"
                    />
                    <View className="relative flex items-center justify-center" style={{ zIndex: 3 }}>
                      <Image src={audioIcon} style={{ width: rpx(100), height: rpx(36) }} mode="aspectFit" />
                      <Image
                        src={jiantouSvg}
                        className={state.currentModelType === 'audio' ? 'ai-btn-arrow-rotate' : 'ai-btn-arrow'}
                        style={{ width: rpx(20), height: rpx(20), position: 'relative', zIndex: 3, marginLeft: rpx(6) }}
                        mode="aspectFit"
                      />
                    </View>
                  </View>
                  {/* videoa 数字人 */}
                  <View
                    className="ai-model-type-btn"
                    onClick={(e: { stopPropagation: () => void }) => {
                      e.stopPropagation()
                      handleModelTypeClick('videoa')
                    }}
                  >
                    <Image
                      className="absolute top-0 left-0"
                      src={state.currentModelType === 'videoa' ? activeBackSvg : backDefaultSvg}
                      style={{ width: '100%', height: '100%', zIndex: 1, opacity: state.currentModelType === 'videoa' ? 1 : 0.6 }}
                      mode="aspectFill"
                    />
                    <View className="relative flex items-center justify-center" style={{ zIndex: 3 }}>
                      <Image src={videoaIcon} style={{ width: rpx(100), height: rpx(36) }} mode="aspectFit" />
                      <Image
                        src={jiantouSvg}
                        className={state.currentModelType === 'videoa' ? 'ai-btn-arrow-rotate' : 'ai-btn-arrow'}
                        style={{ width: rpx(20), height: rpx(20), position: 'relative', zIndex: 3, marginLeft: rpx(6) }}
                        mode="aspectFit"
                      />
                    </View>
                  </View>
                  {/* other 通用 */}
                  <View
                    className="ai-model-type-btn"
                    onClick={(e: { stopPropagation: () => void }) => {
                      e.stopPropagation()
                      handleModelTypeClick('other')
                    }}
                  >
                    <Image
                      className="absolute top-0 left-0"
                      src={state.currentModelType === 'other' ? activeBackSvg : backDefaultSvg}
                      style={{ width: '100%', height: '100%', zIndex: 1, opacity: state.currentModelType === 'other' ? 1 : 0.6 }}
                      mode="aspectFill"
                    />
                    <View className="relative flex items-center justify-center" style={{ zIndex: 3 }}>
                      <Image src={otherIcon} style={{ width: rpx(100), height: rpx(36) }} mode="aspectFit" />
                      <Image
                        src={jiantouSvg}
                        className={state.currentModelType === 'other' ? 'ai-btn-arrow-rotate' : 'ai-btn-arrow'}
                        style={{ width: rpx(20), height: rpx(20), position: 'relative', zIndex: 3, marginLeft: rpx(6) }}
                        mode="aspectFit"
                      />
                    </View>
                  </View>
                  {/* sck 素材库 */}
                  <View
                    className="ai-model-type-btn"
                    onClick={(e: { stopPropagation: () => void }) => {
                      e.stopPropagation()
                      handleModelTypeClick('sck')
                    }}
                  >
                    <Image
                      className="absolute top-0 left-0"
                      src={state.currentModelType === 'sck' ? activeBackSvg : backDefaultSvg}
                      style={{ width: '100%', height: '100%', zIndex: 1, opacity: state.currentModelType === 'sck' ? 1 : 0.6 }}
                      mode="aspectFill"
                    />
                    <View className="relative flex items-center justify-center" style={{ zIndex: 3 }}>
                      <Image src={sckIcon} style={{ width: rpx(100), height: rpx(36) }} mode="aspectFit" />
                      <Image
                        src={jiantouSvg}
                        className={state.currentModelType === 'sck' ? 'ai-btn-arrow-rotate' : 'ai-btn-arrow'}
                        style={{ width: rpx(20), height: rpx(20), position: 'relative', zIndex: 3, marginLeft: rpx(6) }}
                        mode="aspectFit"
                      />
                    </View>
                  </View>
                </View>
              </ScrollView>
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
          {state.materialCards.length > 0 && (
            <View className="material-cards-wrap" style={{ background: 'var(--color-card-subtle, #fafafa)' }}>
              <ScrollView scrollX className="material-cards-scroll" showScrollbar={false}>
                <View className="material-cards-list" style={{ display: 'flex', flexDirection: 'row', padding: '10rpx 20rpx' }}>
                  {state.materialCards.map((card, index) => (
                    <View key={`mc-${card.id || index}-${index}`} className="material-card-item" style={{ marginRight: rpx(16) }}>
                      <Image
                        src={closeInputPng}
                        mode="widthFix"
                        className="material-card-close"
                        style={{ width: rpx(32), height: rpx(32), position: 'absolute', top: rpx(-8), right: rpx(-8), zIndex: 2 }}
                        onClick={() => removeMaterialCard(index)}
                      />
                      {card.type === 1 && (
                        <View className="material-card-body material-card-text" style={{ width: rpx(200), height: rpx(160), padding: rpx(12), background: 'var(--color-card)', borderRadius: rpx(16) }}>
                          <Text className="material-card-title" style={{ fontSize: rpx(24), fontWeight: 'bold', marginBottom: rpx(6) }}>{card.title}</Text>
                          <Text className="material-card-preview" style={{ fontSize: rpx(20), color: '#888' }}>
                            {(card.content || '').slice(0, 20)}{(card.content && card.content.length > 20) ? '...' : ''}
                          </Text>
                        </View>
                      )}
                      {card.type === 2 && card.imageList && card.imageList[0] && (
                        <View className="material-card-body material-card-img" style={{ width: rpx(200), borderRadius: rpx(16), overflow: 'hidden' }}>
                          <Image src={card.imageList[0]} mode="aspectFill" style={{ width: rpx(200), height: rpx(140) }} />
                          <Text className="material-card-title" style={{ fontSize: rpx(22), padding: rpx(6), background: 'rgba(0,0,0,0.5)', color: '#fff', position: 'absolute', bottom: 0, left: 0, right: 0 }}>{card.title}</Text>
                        </View>
                      )}
                      {card.type === 3 && (
                        <View className="material-card-body material-card-video" style={{ width: rpx(200), borderRadius: rpx(16), overflow: 'hidden' }}>
                          <Image src={card.posterUrl || card.videoUrl || ''} mode="aspectFill" style={{ width: rpx(200), height: rpx(140) }} />
                          <Text className="material-card-title" style={{ fontSize: rpx(22), padding: rpx(6), background: 'rgba(0,0,0,0.5)', color: '#fff', position: 'absolute', bottom: 0, left: 0, right: 0 }}>{card.title}</Text>
                        </View>
                      )}
                      {card.type === 4 && (
                        <View className="material-card-body material-card-audio" style={{ width: rpx(200), height: rpx(140), padding: rpx(12), background: 'var(--color-card)', borderRadius: rpx(16), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Text className="material-card-title" style={{ fontSize: rpx(24), fontWeight: 'bold' }}>{card.title}</Text>
                          <Text className="material-card-preview" style={{ fontSize: rpx(20), color: '#888', marginTop: rpx(6) }}>{tt('index.material.audio', '音频')}</Text>
                        </View>
                      )}
                    </View>
                  ))}
                </View>
              </ScrollView>
            </View>
          )}

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
                placeholder: state.isLogin ? '输入消息...' : '请先登录',
                onFocus: handleInputFocus,
                onBlur: handleInputBlur,
                onKeyboardHeightChange: handleKeyboardShow,
              }}
              onToggle={handleToggleButtonClick}
            />
            {/* 分享触发按钮(在底部输入区右侧,对齐原项目 share trigger) */}
            <View
              style={{
                position: 'absolute',
                right: rpx(20),
                top: rpx(-60),
                zIndex: 1001,
              }}
              onClick={handleShareTrigger}
            >
              <View
                style={{
                  padding: '8rpx 20rpx',
                  borderRadius: rpx(20),
                  background: 'var(--color-brand-cyan, #00F2FF)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: rpx(8),
                }}
              >
                <Text style={{ fontSize: rpx(22), color: '#000' }}>📤</Text>
                <Text style={{ fontSize: rpx(22), color: '#000', fontWeight: 500 }}>
                  {tt('index.share', '分享')}
                </Text>
              </View>
            </View>
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

      {/* ===== 语音输入动画覆盖层(对齐原项目 .voice-animation-overlay) ===== */}
      {state.isVoiceAnimationActive && (
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
          onClick={() => setState((s) => ({ ...s, isVoiceAnimationActive: false, isVoiceInput: false, isRecording: false }))}
        >
          <Text style={{ fontSize: rpx(28), color: 'var(--color-foreground)', marginBottom: rpx(20) }}>
            {tt('index.voice.listening', '正在聆听...')}
          </Text>
          <View className="voice-wave-container" style={{ display: 'flex', alignItems: 'center', gap: rpx(8), height: rpx(80) }}>
            {[1, 2, 3, 4, 5].map((i) => (
              <View
                key={i}
                className="ai-voice-move voice-wave-bar"
                style={{
                  width: rpx(8),
                  height: rpx(60),
                  background: 'var(--color-brand-cyan, #93d2f3)',
                  borderRadius: rpx(4),
                  animationDelay: `${i * 0.1}s`,
                  animationDuration: `${0.5 + i * 0.1}s`,
                }}
              />
            ))}
          </View>
          <Text style={{ fontSize: rpx(24), color: '#888', marginTop: rpx(16) }}>
            {tt('index.voice.tapToStop', '点击停止录音')}
          </Text>
        </View>
      )}

      {/* ===== share-points-popup(分享领智汇值弹窗,对齐原项目 v-if,在 input_box_content 之外) ===== */}
      {state.showSharePointsPopup ? (
        <View
          className="fixed inset-0 z-[9999] flex items-center justify-center"
          onClick={handleSharePointsClose}
        >
          <View className="absolute inset-0" style={{ background: 'rgba(0, 0, 0, 0.5)' }} />
          <View
            className="ai-flip-in relative z-10"
            onClick={(e: { stopPropagation: () => void }) => e.stopPropagation()}
          >
            <Image
              src={SHARE_ZHZ_IMG}
              style={{ width: rpx(440) }}
              mode="widthFix"
            />
          </View>
        </View>
      ) : null}

      {/* ===== share-popup(分享弹窗,分享成功后触发显示,在 input_box_content 之外) ===== */}
      {state.showSharePopup ? (
        <View
          className="fixed inset-0 z-[9999] flex items-center justify-center share-popup-overlay"
          onClick={() => setState((s) => ({ ...s, showSharePopup: false, showSharePointsPopup: true }))}
        >
          <View className="absolute inset-0" style={{ background: 'rgba(0, 0, 0, 0.6)' }} />
          <View
            className="share-popup-content"
            onClick={(e: { stopPropagation: () => void }) => e.stopPropagation()}
          >
            <View className="share-popup-header">
              <Text className="share-popup-title">{tt('index.sharePopup.title', '分享到')}</Text>
            </View>
            <View className="share-popup-channels">
              {/* 微信好友 */}
              <View className="share-popup-channel" onClick={handleShareTrigger}>
                <View className="share-popup-icon" style={{ background: '#07C160' }}>
                  <Text style={{ fontSize: rpx(36), color: '#fff' }}>💬</Text>
                </View>
                <Text className="share-popup-label">{tt('index.sharePopup.wechat', '微信好友')}</Text>
              </View>
              {/* 朋友圈 */}
              <View className="share-popup-channel" onClick={handleShareTrigger}>
                <View className="share-popup-icon" style={{ background: '#07C160' }}>
                  <Text style={{ fontSize: rpx(36), color: '#fff' }}>🔄</Text>
                </View>
                <Text className="share-popup-label">{tt('index.sharePopup.moments', '朋友圈')}</Text>
              </View>
              {/* 复制链接 */}
              <View className="share-popup-channel" onClick={() => {
                Taro.setClipboardData({ data: 'https://ihui.ai' }).catch(() => {})
                setState((s) => ({ ...s, showSharePopup: false, showSharePointsPopup: true }))
              }}>
                <View className="share-popup-icon" style={{ background: 'var(--color-brand-cyan, #00F2FF)' }}>
                  <Text style={{ fontSize: rpx(36), color: '#000' }}>🔗</Text>
                </View>
                <Text className="share-popup-label">{tt('index.sharePopup.copyLink', '复制链接')}</Text>
              </View>
            </View>
            <View
              className="share-popup-cancel"
              onClick={() => setState((s) => ({ ...s, showSharePopup: false }))}
            >
              <Text className="share-popup-cancel-text">{tt('index.sharePopup.cancel', '取消')}</Text>
            </View>
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
            />
            <Text style={{ fontSize: rpx(32), color: 'var(--color-foreground)', marginTop: rpx(20) }}>
              {tt('index.qrCodeHint', '扫描二维码加入社区')}
            </Text>
            {/* 关闭按钮(对齐原项目 .qr-code-close:60rpx×60rpx,圆形,AGENTS 豁免)*/}
            <View
              className="ai-close-btn"
              style={{ top: rpx(10), right: rpx(10), width: rpx(60), height: rpx(60), border: '1px solid #000' }}
              onClick={handleQrCodeClose}
            >
              <Text style={{ fontSize: rpx(60), lineHeight: rpx(60), color: 'var(--color-foreground)' }}>×</Text>
            </View>
          </View>
        </View>
      ) : null}
    </View>
  )
}