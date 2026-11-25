// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { canStepBackInAdminHistory } from '../src/lib/webview-history'

/**
 * WebView 手机承载细节锁(2026-11-23 立)。
 *
 * 管理后台全部分类页、找回密码等 Web 页都走同一个 WebViewScreen。真机/代码审计
 * 发现三处会直接影响"在手机上用"的细节:
 *  ① 失败页"重试"只把 failed/loading 翻回 false,WebView 从未重新取页面 ⇒ 转圈到死;
 *  ② 页头标题没有主题色,暗色模式下深底黑字直接不可见;
 *  ③ 自绘加载遮罩 ∧ startInLoadingState 双开 ⇒ 两个转圈叠在一起。
 * 本锁逐条钉住,避免后续重构成"看起来接上、实际没重载"。
 */
const APP = process.cwd()
const SRC = join(APP, 'src/screens/WebViewScreen.tsx')
const CHAT = join(APP, 'src/screens/ChatToolsScreen.tsx')
const WATCHDOG = join(APP, 'src/hooks/use-webview-load-watchdog.ts')

describe('WebView 手机承载细节', () => {
  const src = readFileSync(SRC, 'utf-8')

  it('重试是真重载:reloadNonce 变更会让 WebView 重新挂载取页面', () => {
    expect(src).toContain('const [reloadNonce, setReloadNonce] = useState(0)')
    expect(src).toContain('setReloadNonce((n) => n + 1)')
    expect(src).toContain('key={`${sourceUri}#${reloadNonce}`}')
  })

  it('重试会重新签发 SSO 码,不能重放已过期的旧码', () => {
    expect(src).toContain('const buildSourceUri = useCallback(async (): Promise<string> => {')
    expect(src).toContain('void buildSourceUri().then((next) => {')
    expect(src).toContain('setSourceUri(next)')
  })

  it('加载指示只有一个:自绘遮罩在,startInLoadingState 关掉', () => {
    expect(src).toContain('startInLoadingState={false}')
    expect(src).toContain('{loading ? (')
  })

  it('页头标题用主题墨色,暗色模式不再深底黑字', () => {
    expect(src).toContain('style={{ color: tokens.text.primary }}')
  })

  it('失败页重试按钮有可访问语义', () => {
    expect(src).toContain("accessibilityLabel={t('webView.retry')}")
    expect(src).toContain('onPress={retry}')
  })

  it('导航态同步 loading,不只同步 failed(否则重载后遮罩不会重新出现)', () => {
    expect(src).toContain('setLoading(true)')
    expect(src).toContain('setLoading(false)')
  })

  it('断网不会永远停在加载中:20s 看门狗亮失败态并 stopLoading', () => {
    const watchdog = readFileSync(WATCHDOG, 'utf-8')
    expect(watchdog).toContain('WEBVIEW_LOAD_TIMEOUT_MS = 20_000')
    expect(watchdog).toContain('setTimeout(() => callbackRef.current()')
    expect(src).toContain('useWebviewLoadWatchdog(loading, handleLoadTimeout)')
    expect(src).toContain('webViewRef.current?.stopLoading()')
  })

  it('Web 对话屏同一套体验:看门狗、暗色标题、单加载指示', () => {
    const chat = readFileSync(CHAT, 'utf-8')
    expect(chat).toContain('useWebviewLoadWatchdog(loading, handleLoadTimeout)')
    expect(chat).toContain('setLoading(true)')
    expect(chat).toContain('stopLoading: () => void')
    expect(chat).toContain('startInLoadingState={false}')
  })

  it('SSO 初始链不会被站内后退带回一次性会话页', () => {
    const base = 'https://aizhs.top'
    expect(
      canStepBackInAdminHistory(
        [
          `${base}/sso/mobile-auth?sso_code=xxx&redirect=%2Fdomains%2Fadmin`,
          `${base}/domains/admin`,
        ],
        base,
      ),
    ).toBe(false)
  })

  it('管理端下钻一层才允许后退一格', () => {
    const base = 'https://aizhs.top'
    expect(
      canStepBackInAdminHistory([`${base}/domains/admin`, `${base}/domains/users`], base),
    ).toBe(true)
    expect(canStepBackInAdminHistory([`${base}/domains/admin`, `${base}/admin`], base)).toBe(true)
    expect(
      canStepBackInAdminHistory([`${base}/domains/admin`, `${base}/admin/monitor/wallboard`], base),
    ).toBe(true)
    expect(
      canStepBackInAdminHistory(
        ['https://evil.example/domains/admin', `${base}/domains/users`],
        base,
      ),
    ).toBe(false)
  })

  it('首屏目标预置进历史,分类页返回键才能回到分类总览', () => {
    expect(src).toContain('navHistoryRef.current = [url]')
    expect(src).toContain('await ensureFreshToken()')
  })

  it('SSO 重定向链不靠 onLoadEnd 单点收遮罩,进度过半也收', () => {
    expect(src).toContain('onLoadProgress={onLoadProgress}')
    expect(src).toContain('event.nativeEvent.progress < 0.5')
  })

  it('头部返回与安卓返回键共用站内后退判据', () => {
    expect(src).toContain('canStepBackInAdminHistory')
    expect(src).toContain('BackHandler.addEventListener')
    expect(src).toContain('webViewRef.current?.goBack()')
    expect(src).toContain('navigation.canGoBack()')
    expect(src).toContain("navigation.navigate('Main', undefined as never)")
    expect(src).toContain('onPress={handleBack}')
  })

  it('安卓返回不能放回系统把整个 App 退到桌面', () => {
    expect(src).toContain('handleBack()\n      return true')
  })

  it('加载遮罩不透明,不与 Web 页自身 spinner 叠成双转圈', () => {
    expect(src).toContain('bg-white dark:bg-neutral-900')
    expect(src).not.toContain('bg-white/70')
    const chat = readFileSync(CHAT, 'utf-8')
    expect(chat).not.toContain('bg-white/70')
  })

  it('分类页站内跳转不重开全屏遮罩(否则已渲染的管理页永远被盖住)', () => {
    expect(src).toContain('const hasLoadedRef = useRef(false)')
    expect(src).toContain('if (!hasLoadedRef.current) {')
    expect(src).toContain('onLoadEnd={onLoadEnd}')
    expect(src).toContain('hasLoadedRef.current = true')
  })

  it('管理端 WebView 隐藏手机档全屏 AI 抽屉,管理分类才成为可见表面', () => {
    expect(src).toContain('.ai-panel-root{display:none!important;}')
    expect(src).toContain('injectJavaScript(ADMIN_WEBVIEW_MOBILE_FIX)')
    expect(src).toContain("path === '/domains/admin'")
  })

  it('分类卡片窄屏强制单列并解除 truncate,名称不再缩成「管…」', () => {
    expect(src).toContain("grid.style.gridTemplateColumns = 'minmax(0, 1fr)'")
    expect(src).toContain('white-space:normal!important')
    expect(src).toContain('text-overflow:clip!important')
  })

  it('管理页水合后才出现 76 张卡片:注入脚本在窗口内随 DOM 变化重跑', () => {
    expect(src).toContain('MutationObserver')
    expect(src).toContain('observer.disconnect()')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
