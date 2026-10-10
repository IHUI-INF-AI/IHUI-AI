// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import './global.css'
import { useCallback, useEffect, useState } from 'react'
import { AppRegistry, LogBox, Platform, Text, TextInput, View } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useFonts } from 'expo-font'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import { NavigationContainer, DarkTheme, DefaultTheme } from '@react-navigation/native'
import { StatusBar } from 'expo-status-bar'
import { AuthProvider } from './src/context/AuthContext'
import { ThemeProvider, useTheme } from './src/context/ThemeContext'
import { I18nProvider } from './src/i18n'
import { NetworkProvider, useNetwork } from './src/context/NetworkContext'
import { OfflineBanner } from './src/components/OfflineBanner'
import { DevErrorToast } from './src/components/DevErrorToast'
import { RootNavigator } from './src/navigation/RootNavigator'
import { linking } from './src/navigation/linking'
import { navigationRef, navigateTo } from './src/navigation/navigation-ref'
import { registerWechat } from './src/lib/wechat'
import {
  subscribeOAuthDeepLink,
  getInitialOAuthDeepLink,
  type OAuthRedirectResult,
} from './src/lib/oauth-deeplink'
import { rnAuthStore } from './src/stores/auth-store'
import { tokens } from './src/theme/active-tokens'
import type { RnThemeTokens } from '@ihui/design-tokens'
import { isVideoImmersive, subscribeVideoImmersive } from './src/lib/video-immersive'
import type { LoginResult } from '@ihui/api-client'
import { GlobalFloatBox } from './src/components/GlobalFloatBox'
import { PrivacyPolicyModal } from './src/components/PrivacyPolicyModal'
import { PRIVACY_POLICY_STORAGE_KEY } from './src/constants/privacyPolicy'
import './src/lib/web-shell'

/**
 * 根底色与页面底色不同档的路由(2026-10-07 全面审计)。
 *
 * 状态栏 inset 带 + 全局 OfflineBanner 行由本组件根 View 绘制,默认取 surface.bg
 * (与全站 shell 同档);下列路由的页面根容器另取了档,带色不跟随就会在顶部露出
 * 两截颜色。值是页面根容器的**同一份取色**(逐屏审计见 .ihui-agent/tmp/audit-root-bg.mjs),
 * 不是新造的档;包装层自带 surface.bg 壳的页(AigcList/ModelPlaza/RankingDetail 等)
 * 带色已与壳一致,不入表。 Recruitment 首屏是整幅 bgImage,带色对不齐图片属固有形态,不收。
 */
const ROUTE_ROOT_BG: Record<string, (t: RnThemeTokens, dark: boolean) => string> = {
  Login: (t) => t.surface.card,
  // 顶栏 chrome 带 —— 凡屏内用 <NavChrome> 给导航行取了 tokens.surface.chrome,它的**每一个注册路由名**
  // 都必须在这里给同一档:状态栏 inset 带由本枚根 View 画,导航行由屏自己画,两处不同色就是同一屏两截色
  // (2026-10-10 用户实拍「顶部这个区域为什么是灰色的,怎么还有个灰色带呢?应该不设置背景色 直接透出底色白色啊」)。
  // 清单派生自 RootNavigator 的 name=/component= 注册对(现读,不手拼);漏一条由
  // tests/nav-chrome-route-parity.test.ts 当场判红 —— 它从源码反查"哪些屏渲染 NavBar",再核每个注册名在不在本表。
  // 刻意**不**改成"默认全给 chrome + 例外表":沉浸式/渐变定档那几屏(VideoPlayer / CoursePlanet / MoreCourse /
  // ChatTools)的顶色是各自定稿,翻默认会把它们推给白档。
  Home: (t) => t.surface.chrome,
  HomeMain: (t) => t.surface.chrome,
  Plaza: (t) => t.surface.chrome,
  News: (t) => t.surface.chrome,
  ProfileMain: (t) => t.surface.chrome,
  AiMain: (t) => t.surface.chrome,
  Agent: (t) => t.surface.chrome,
  Settings: (t) => t.surface.chrome,
  AiAssistantN8n: (t) => t.surface.chrome,
  Cart: (t) => t.surface.chrome,
  Chat: (t) => t.surface.chrome,
  CircleIndex: (t) => t.surface.chrome,
  ConversationImport: (t) => t.surface.chrome,
  CourseDetail: (t) => t.surface.chrome,
  DevEnter: (t) => t.surface.chrome,
  Developer: (t) => t.surface.chrome,
  LiveDetail: (t) => t.surface.chrome,
  RankingDetail: (t) => t.surface.chrome,
  Share: (t) => t.surface.chrome,
  StudyIndex: (t) => t.surface.chrome,
  StudyPublish: (t) => t.surface.chrome,
  Subagents: (t) => t.surface.chrome,
  TopicDetail: (t) => t.surface.chrome,
  TopicList: (t) => t.surface.chrome,
  WebPortal: (t) => t.surface.chrome,
  ChatTools: (t, dark) => (dark ? t.gray[900] : t.surface.light),
  WebView: (t, dark) => (dark ? t.gray[900] : t.surface.light),
  Note: (t) => t.surface.light,
  BankCard: (t) => t.surface.light,
  AiGroup: (t) => t.surface.light,
  VipTrader: (t) => t.surface.light,
  AigcCover: (t) => t.surface.light,
  AigcPublish: (t) => t.surface.light,
  BusinessLicense: (t) => t.surface.muted,
  ModelRecord: (t) => t.surface.muted,
  ProfileEdit: (t) => t.surface.muted,
  CoursePlanet: (t) => t.brandAccent.light,
  // 更多课程页:对齐历史 MoreCourse.vue 的渐变中间色(#93D2F3/#93D2E2/#9bd1d1 取中),两主题同值
  MoreCourse: () => '#93D2E2',
}

/**
 * 全局默认字体:阿里妈妈方圆体(对齐 D 盘 uniapp Ai-WXMiniVue 的 App.vue 全局字体)。
 * PostScript name = AlimamaFangYuanTiVF-Thin(见 assets/fonts/AlimamaFangYuanTiVF-Thin.ttf)。
 * 通过 defaultProps.style 注入,所有未显式指定 fontFamily 的 Text/TextInput 默认走此字体;
 * 显式 style 中的 fontFamily 优先级更高,不受影响。
 */
const GLOBAL_FONT_FAMILY = 'AlimamaFangYuanTiVF-Thin'
// 注入全局默认字体（React Native 限制，defaultProps 需要 any 断言）
/* eslint-disable @typescript-eslint/no-explicit-any */
;(Text as any).defaultProps = {
  ...(Text as any).defaultProps,
  style: { fontFamily: GLOBAL_FONT_FAMILY },
}
;(TextInput as any).defaultProps = {
  ...(TextInput as any).defaultProps,
  style: { fontFamily: GLOBAL_FONT_FAMILY },
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// dev 报错悬浮条(替换内核 LogBox,见 src/components/DevErrorToast.tsx):
// 抑制 LogBox UI(metro 终端日志不受影响),报错统一走 DevErrorToast 展示
if (__DEV__) {
  LogBox.ignoreAllLogs()
}

function ThemedNavigation() {
  const { resolvedTheme } = useTheme()
  return (
    <NavigationContainer
      ref={navigationRef}
      linking={linking}
      theme={resolvedTheme === 'dark' ? DarkTheme : DefaultTheme}
    >
      <RootNavigator />
    </NavigationContainer>
  )
}

function AppInner() {
  const { isOnline } = useNetwork()
  return (
    /**
     * 顶部安全区在**这一处单点**注入:RN 0.86 + Expo 强制 edge-to-edge,而全端 180 个共享屏
     * 自绘的"返回"页头没有一个处理 inset,页头与系统时钟/电量叠字(真机实测页头 y0=24..78)。
     * 逐屏补是 180 处改动,这里包一层是一次性收口。因此原先自带顶距的几处必须同时摘掉,否则双份:
     * components/NavBar、screens/PostCreateScreen、screens/WebViewScreen、
     * packages/app 的 search/SearchScreen;DevErrorToast 是 absolute 子元素,相对本容器
     * padding 盒定位,故其 top 也同步去掉状态栏高度。
     * 不经过这里的:Drawer / SideMenu / BottomPops / HandPlatePops / PrivacyPolicyModal ——
     * 它们走 RN <Modal>,渲染在本树之外的原生窗口,各自的 insets.top 必须保留。
     */
    <SafeAreaView edges={['top']} style={{ flex: 1 }}>
      <OfflineBanner isOnline={isOnline} />
      <ThemedNavigation />
      <DevErrorToast />
    </SafeAreaView>
  )
}

/**
 * 将 OAuth deep link 换取的 JWT 写入 rnAuthStore(与 AuthContext.applySsoCode 同语义)。
 *
 * App.tsx 位于 AuthProvider 之外,无法用 useAuth(),但 rnAuthStore 是 zustand 实例,
 * 可直接 import 调用,跨组件树更新认证态(AuthContext 订阅同一 store,会自动重渲染)。
 */
async function applyOAuthResult(result: OAuthRedirectResult): Promise<void> {
  if (!result.success || !result.data) return
  const { accessToken, refreshToken, user }: LoginResult = result.data
  await rnAuthStore.getState().setAuth({ token: accessToken, refreshToken, user })
}

function AppContent() {
  const { resolvedTheme } = useTheme()

  // 初始化微信 SDK + OAuth deep link 监听(ihui://oauth/callback?platform=xxx&code=xxx&state=xxx)
  // 与 SSO deep link(ihui://sso/callback)互不干扰,后者由 AuthContext 监听
  useEffect(() => {
    let unsubOAuth: (() => void) | null = null
    void registerWechat()

    // 冷启动时检查 OAuth deep link + 运行时监听
    void (async () => {
      const initial = await getInitialOAuthDeepLink()
      if (initial) await applyOAuthResult(initial)

      unsubOAuth = subscribeOAuthDeepLink(async (result) => {
        await applyOAuthResult(result)
      })
    })()

    return () => {
      if (unsubOAuth) unsubOAuth()
    }
  }, [])

  // 浮窗跳转:目标页(赚米→推广/客服/反馈)需登录,未登录先引导到登录页
  const goFloat = (name: 'Promote' | 'CustomerService' | 'Feedback'): void => {
    if (rnAuthStore.getState().token) {
      navigateTo(name)
    } else {
      navigateTo('Login')
    }
  }

  // ===== 首启隐私政策弹窗(对齐历史 App.vue onLaunch) =====
  // AsyncStorage 未记录已同意 → 强制展示(小米平台要求:不可绕过,同意后才能继续使用);
  // 同意后持久化记录(对齐历史 onPrivacyAccepted setStorageSync('privacyPolicyShown', true))。
  const [privacyVisible, setPrivacyVisible] = useState(false)
  useEffect(() => {
    void (async () => {
      try {
        const accepted = await AsyncStorage.getItem(PRIVACY_POLICY_STORAGE_KEY)
        if (accepted !== 'true') setPrivacyVisible(true)
      } catch {
        // 存储读取异常时按未同意处理,保证合规弹窗必达
        setPrivacyVisible(true)
      }
    })()
  }, [])

  const handlePrivacyAgree = useCallback(() => {
    void AsyncStorage.setItem(PRIVACY_POLICY_STORAGE_KEY, 'true')
    setPrivacyVisible(false)
  }, [])

  // ===== O57(2026-09-24):根背景按聚焦路由取;L4006(2026-10-02):再叠一条「全屏播放器窗口在位」 =====
  // 全屏沉浸屏(VideoPlayer)的底色铺不进状态栏带 —— 那条带由本组件根 View 的
  // backgroundColor 绘制,屏幕内容在屏幕顶边被裁剪(真机量得带内 y=8..60 浅灰),
  // 端内任何写法都够不到。修法在单点:聚焦路由为 VideoPlayer **或**播放器全屏窗口正盖着本窗口
  // 时取 tokens.gray.black(与共享层 packages/app video-player 容器同源同值,不新增第二个色源),
  // 其余仍 surface.bg。
  // 第二条为什么必须有(2026-10-02 定位):react-native-video 在 Android 上的全屏不是本树的布局
  // 变化,而是 `Dialog(context, Theme_Black_NoTitleBar)` 这个**另一个窗口**(见
  // node_modules/react-native-video/android/src/main/java/com/brentvatne/exoplayer/FullScreenPlayerView.kt:27)
  // —— 该主题不覆盖状态栏带,带位仍由下面这枚根 View 绘制。于是同一只播放器从**别的路由**发起全屏时
  // (今天已知一站是 ProfileScreen 的 VideoPlayerModal,它挂 src/components/VideoPlayer.tsx 而不在
  // VideoPlayer 路由上)仍露浅灰带。路由名不是这件事的因,「有全屏播放器窗口正盖着本窗口」才是,
  // 所以第二个条件取 src/lib/video-immersive.ts 那份布尔(它只传布尔,不取色、不碰顶距)。
  // SafeAreaView edges=['top'] 单点注入不变(守门 97):这里只换底色,不碰顶距。
  const [focusedRoute, setFocusedRoute] = useState<string | null>(null)
  useEffect(() => {
    const sync = (): void => {
      setFocusedRoute(
        navigationRef.isReady() ? (navigationRef.getCurrentRoute()?.name ?? null) : null,
      )
    }
    sync()
    const unsubReady = navigationRef.addListener('ready', sync)
    const unsubState = navigationRef.addListener('state', sync)
    return () => {
      unsubReady()
      unsubState()
    }
  }, [])
  // 初始值现读一次:全屏可以在本组件挂载之前就已呈现(冷启动直达播放器的在飞窗口),
  // 只等订阅回调会让首帧带色停在浅色。
  const [videoImmersive, setVideoImmersive] = useState(isVideoImmersive)
  useEffect(() => subscribeVideoImmersive(setVideoImmersive), [])
  // Login 页(共享层)页面底取 surface.card(暗 #1A1A1A),与全站 shell 的 surface.bg 不同档;
  // 带色不跟随就会在状态栏与断网横幅两处露出一截 #242424(2026-10-07 用户点名)。
  // 其余根底色 ≠ surface.bg 的路由同批收进 ROUTE_ROOT_BG(2026-10-07 全面审计,
  // 取材 .ihui-agent/tmp/audit-root-bg.mjs;包装层自带 surface.bg 壳的页不入表)。
  const routeBgEntry = focusedRoute ? ROUTE_ROOT_BG[focusedRoute] : undefined
  const rootBackground =
    videoImmersive || focusedRoute === 'VideoPlayer'
      ? tokens.gray.black
      : routeBgEntry
        ? routeBgEntry(tokens, resolvedTheme === 'dark')
        : tokens.surface.bg

  return (
    // backgroundColor 兜底:悬浮 TabBar 留边/根节点透明的屏(ProfileScreen 等 Fragment 根)
    // 会露出原生窗口黑底(#000000 splash)。主 tab 页均为静态浅色 token 渲染,
    // 故取浅色 surface.bg 与页面底色一致;沉浸屏(VideoPlayer)例外见上方 O57 注释;
    // 暗色主题全量落地时再随主题切换。
    <View
      className={resolvedTheme === 'dark' ? 'dark' : ''}
      style={{ flex: 1, backgroundColor: rootBackground }}
    >
      <SafeAreaProvider>
        <I18nProvider>
          <AuthProvider>
            <NetworkProvider>
              <AppInner />
            </NetworkProvider>
          </AuthProvider>
        </I18nProvider>
        <StatusBar style="auto" />
      </SafeAreaProvider>
      {/* 全局浮窗:赚米/客服/反馈,覆盖在 RootNavigator 之上(右下角悬浮)。
          对齐历史 Uniapp FloatBox.vue:靠右竖条 + 左滑展开,非箭头按钮显隐。
          未登录时这三个功能页不在导航器里(token 条件分支),先引导到登录页。 */}
      <GlobalFloatBox
        onPromote={() => goFloat('Promote')}
        onConsult={() => goFloat('CustomerService')}
        onFeedback={() => goFloat('Feedback')}
      />
      {/* 首启隐私政策弹窗(RN Modal 恒在最顶层):未同意不可继续使用(对齐历史 App.vue privacy-modal) */}
      <PrivacyPolicyModal visible={privacyVisible} onAgree={handlePrivacyAgree} />
    </View>
  )
}

export default function App() {
  // 加载阿里妈妈方圆体(对齐 uniapp);未加载完返回 null 避免字体闪烁
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fontAsset = require('./assets/fonts/AlimamaFangYuanTiVF-Thin.ttf')
  // eslint-enable @typescript-eslint/no-require-imports
  const [fontsLoaded] = useFonts({
    'AlimamaFangYuanTiVF-Thin': fontAsset,
  })
  // 原生:未加载完返回 null,避免字体闪烁。Web 预览必须跳过这道门:
  // react-native-web 下 require(ttf) 返回的是资产 id 而非可加载 URL,expo-font 的 web
  // loader 永远不 resolve ⇒ fontsLoaded 恒 false ⇒ 整棵树 return null(:8806 白屏根因)。
  if (Platform.OS !== 'web' && !fontsLoaded) return null
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  )
}

// 显式注册 main 组件（Expo CLI 的 .expo/.virtual-metro-entry 虚拟入口在当前
// pnpm isolated monorepo 环境下未正确注入 registerRootComponent 调用，
// 导致 RN 运行时报 "main" has not been registered。这里手动注册兜底。）
AppRegistry.registerComponent('main', () => App)

// Web 平台需要显式调用 runApplication 挂载到 DOM（原生平台由原生代码自动调用，
// index.js 注释已说明；web 平台无原生代码，react-native-web 不会自动 runApplication）。
if (Platform.OS === 'web') {
  AppRegistry.runApplication('main', {
    rootTag: document.getElementById('root'),
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
