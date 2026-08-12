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
 *   - ModelList(variant='popup',分类弹出列表 + Agent 模式)
 *   - ModelTypeButtonGroup(variant='wide',8 个 200rpx×60rpx 横向滚动)
 *   - BottomActionBar(variant='ai-home',ToggleButtonGroup + InputArea + icon-button-group)
 *
 * TODO: 原教育门户业务功能(轮播/课程/直播/社区)已迁移至其他 tab 页
 * (智汇社区/课程/直播/我的),首页保持纯 AI 对话布局对齐原项目 ai_index.vue
 */
import { View, Image, Text } from '@tarojs/components'
import Taro, { useDidShow, useShareAppMessage, useShareTimeline } from '@tarojs/taro'
import { useState, useMemo } from 'react'
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
import ModelTypeButtonGroup from '@/components/ModelTypeButtonGroup'
import type { ModelType } from '@/components/ModelTypeButton'
import BottomActionBar, {
  type ToggleButtonItem,
} from '@/components/BottomActionBar'
import Toolbar from '@/components/Toolbar'
import { icon } from '@/constants/remote-icons'
// 本地化远程 CDN 图标（原 cdn.bspapp.com / file.aizhs.top 在 H5 模式下加载失败）
import aiIconLocal from '@/assets/remote-images/ai-icon.svg'
import courseIconLocal from '@/assets/remote-images/course-icon.svg'
import vipActIconLocal from '@/assets/remote-images/user-vip-act.svg'
import './index.css'

const DEFAULT_AVATAR =
  'https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/tabbar/tabbar/home.png'

// 首页静态资源(Taro config copy.patterns 把 src/static/* 复制到 dist/static/*)
const SHARE_ZHUANMI_IMG = '/static/images/share_zhuanmi.png'
const SHARE_ZHZ_IMG = '/static/images/share_zhz.png'
const QRCODE_IMG = '/static/images/qewm.png'

// 本地 mock 模型列表(对齐原项目 modelList 数据源,TODO: 接入真实 API /api/llm/models)
const MOCK_MODELS: ModelItem[] = [
  { id: 'step-3.7-flash', name: 'Step 3.7 Flash', provider: 'stepfun', context_length: 128000, input_price: 0 },
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai', context_length: 128000, input_price: 0 },
  { id: 'claude-3.5', name: 'Claude 3.5', provider: 'anthropic', context_length: 200000, input_price: 0 },
]

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
  }))

  const [models] = useState<ModelItem[]>(MOCK_MODELS)

  const systemInfo = Taro.getSystemInfoSync()
  const statusBarHeight = systemInfo.statusBarHeight || 20

  useDidShow(() => {
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

  const handleModelTypeClick = (type: ModelType) => {
    setState((s) => ({
      ...s,
      currentModelType: s.currentModelType === type ? '' : type,
      showModelList: s.currentModelType !== type,
    }))
  }

  const handleModelSelect = (model: ModelItem) => {
    setState((s) => ({
      ...s,
      selectedModelId: model.id,
      modelName: model.name,
      showModelList: false,
      currentModelType: '',
    }))
  }

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

  return (
    <View className="ai-home-page min-h-screen" style={{ background: 'var(--color-background)' }}>
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

      {/* ===== container 主容器 ===== */}
      <View
        className="flex flex-col"
        style={{ minHeight: '100vh', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' }}
      >
        {/* ===== NavBar(粘性 + 标题"智汇AI社区" + 菜单 + 加入社区群)===== */}
        <NavBar
          variant="ai-home"
          title={tt('index.title', '智汇AI社区')}
          bgColor="var(--color-nav-bg, #E9F0FD)"
          textColor="var(--color-nav-title, #171717)"
          onMenuClick={handleMenuClick}
          onJoinClick={handleJoinClick}
        />

        {/* ===== top_box(顶部 72vh 区域,share-image 140rpx×140rpx,pulse 动画)===== */}
        <View
          className="relative flex flex-col"
          style={{ padding: '0 20rpx', height: 'calc(72vh)' }}
        >
          <View className="flex flex-col items-end relative">
            <View
              className="flex flex-col items-end relative"
              style={{ gap: '6rpx', marginTop: '10rpx' }}
            >
              {/* share-image:140rpx×140rpx + pulse 动画 + 点击跳转"我的" */}
              <Image
                className="ai-pulse"
                src={SHARE_ZHUANMI_IMG}
                style={{ width: '140rpx', height: '140rpx', zIndex: 10 }}
                mode="aspectFit"
                onClick={() => Taro.switchTab({ url: '/pages/user/index' })}
              />
            </View>
          </View>
        </View>

        {/* ===== Toolbar(快捷入口工具栏,横向滚动,不带背景)===== */}
        <View className="px-[20rpx] py-[16rpx]">
          <Toolbar
            items={[
              { id: 'ai', name: tt('toolbar.ai', 'AI对话'), icon: aiIconLocal, onClick: () => Taro.navigateTo({ url: '/pages/ai/chat' }) },
              { id: 'course', name: tt('toolbar.course', '课程'), icon: courseIconLocal, onClick: () => Taro.switchTab({ url: '/pages/course/list' }) },
              { id: 'plaza', name: tt('toolbar.plaza', '广场'), icon: '🏙️', onClick: () => Taro.navigateTo({ url: '/pages/plaza/index/index' }) },
              { id: 'rank', name: tt('toolbar.rank', '排行'), icon: icon('rankone'), onClick: () => Taro.navigateTo({ url: '/pages/ranking/index' }) },
              { id: 'vip', name: tt('toolbar.vip', '会员'), icon: vipActIconLocal, onClick: () => Taro.navigateTo({ url: '/pages/vip/index' }) },
            ]}
          />
        </View>

        {/* ===== input_box_content(底部输入区,position fixed)===== */}
        <View
          className="left-0 right-0"
          style={{
            position: 'fixed',
            bottom: computedContainerBottom,
            background: 'var(--color-card)',
            paddingBottom: 'calc(env(safe-area-inset-bottom) + 10rpx)',
            transition: 'bottom 0.3s ease',
            zIndex: 1000,
          }}
        >
          {/* ===== posi_angeetlis(相对定位容器)===== */}
          <View className="relative">
            {/* ModelList 弹出层 */}
            <View style={{ padding: '0 20rpx' }}>
              {state.showModelList && state.currentModelType && state.currentModelType !== 'skills' && state.currentModelType !== 'sck' ? (
                <ModelList
                  variant="popup"
                  models={filteredModels}
                  selectedId={state.selectedModelId}
                  onSelect={handleModelSelect}
                  currentType={state.currentModelType}
                  agentActive={state.agentModeActive}
                  onAgentSelect={handleAgentToggle}
                />
              ) : null}
            </View>

            {/* 8 个 model-type-btn 横向滚动 */}
            <ModelTypeButtonGroup
              variant="wide"
              activeType={state.currentModelType}
              onSelect={handleModelTypeClick}
            />
          </View>

          {/* ===== BottomActionBar(ToggleButtonGroup + InputArea + icon-button-group)===== */}
          <BottomActionBar
            variant="ai-home"
            modelName={state.modelName}
            showIconButtons={state.showIconButtons}
            toggleButtons={state.toggleButtons}
            onToggle={handleToggleButtonClick}
            inputAreaProps={{
              onSend: handleSend,
              disabled: !state.isLogin,
              placeholder: state.isLogin ? tt('index.placeholder.input', '输入消息...') : tt('index.placeholder.loginRequired', '请先登录'),
            }}
          />
        </View>
      </View>

      {/* ===== share-points-popup(分享领智汇值弹窗,对齐原项目 v-if)===== */}
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
              style={{ width: '440rpx' }}
              mode="widthFix"
            />
          </View>
        </View>
      ) : null}

      {/* ===== qr-code-modal(二维码弹窗)===== */}
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
              borderRadius: '20rpx',
              padding: '50rpx 40rpx 20rpx',
            }}
            onClick={(e: { stopPropagation: () => void }) => e.stopPropagation()}
          >
            <Image
              src={QRCODE_IMG}
              style={{ width: '600rpx', height: '600rpx' }}
              mode="aspectFit"
            />
            <Text style={{ fontSize: '32rpx', color: 'var(--color-foreground)', marginTop: '20rpx' }}>
              {tt('index.qrCodeHint', '扫描二维码加入社区')}
            </Text>
            {/* 关闭按钮(对齐原项目 .qr-code-close:60rpx×60rpx,圆形,AGENTS 豁免)*/}
            <View
              className="ai-close-btn"
              style={{ top: '10rpx', right: '10rpx', width: '60rpx', height: '60rpx', border: '1px solid #000' }}
              onClick={handleQrCodeClose}
            >
              <Text style={{ fontSize: '60rpx', lineHeight: '60rpx', color: 'var(--color-foreground)' }}>×</Text>
            </View>
          </View>
        </View>
      ) : null}
    </View>
  )
}
