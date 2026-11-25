// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * 数据大屏实时性锁(2026-11-23 立)。
 *
 * 用户原话:"特别是数据大屏啥的我没法用移动端实时看"。改造前 DashboardScreen
 * 只在挂载时拉一次四源快照(useEffect),之后只能手动下拉 —— 那不是大屏,是截图。
 * 本锁钉住三件事,少一件都退回"打开时快照":
 *  ① 聚焦态 30s 自动刷新(useFocusEffect + setInterval,离开即 clearInterval);
 *  ② 单飞闸,避免自动刷新与下拉刷新叠成第四轮四源请求;
 *  ③ 状态行把"数据有多新"写给用户看(statusText 透传共享层渲染)。
 */

const APP = process.cwd()
const WRAPPER = join(APP, 'src/screens/DashboardScreen.tsx')
const SHARED = join(APP, '../../packages/app/src/features/dashboard/DashboardScreen.tsx')

describe('数据大屏实时化', () => {
  const wrapper = readFileSync(WRAPPER, 'utf-8')
  const shared = readFileSync(SHARED, 'utf-8')

  it('聚焦期间每 30 秒自动刷新,离开屏幕即停表', () => {
    expect(wrapper).toMatch(
      /import\s*\{[^}]*useFocusEffect[^}]*\}\s*from\s*'@react-navigation\/native'/,
    )
    expect(wrapper).toContain('useFocusEffect(')
    expect(wrapper).toContain('setInterval(() => void load(), AUTO_REFRESH_MS)')
    expect(wrapper).toContain('clearInterval(timer)')
    expect(wrapper).toMatch(/AUTO_REFRESH_MS\s*=\s*30_000/)
  })

  it('单飞闸拦住并发取数(自动刷新 ∧ 下拉刷新同一刻)', () => {
    expect(wrapper).toContain('inFlightRef')
    expect(wrapper).toContain('if (inFlightRef.current) {')
    expect(wrapper).toContain('setRefreshing(false)')
    expect(wrapper).toContain('inFlightRef.current = false')
  })

  it('下拉刷新真的亮 RefreshControl,且与自动刷新共用单飞闸', () => {
    // 只传 load 时 refreshing 永远 false ⇒ 用户下拉没有任何指示(2026-11-23 补)
    expect(wrapper).toContain('const handlePullRefresh = useCallback(')
    expect(wrapper).toContain('setRefreshing(true)')
    expect(wrapper).toContain('onRefresh={handlePullRefresh}')
  })

  it('应用回前台立即补一次,不靠后台被冻结的定时器', () => {
    expect(wrapper).toContain("import { AppState, View } from 'react-native'")
    expect(wrapper).toContain("AppState.addEventListener('change'")
    expect(wrapper).toContain("if (state === 'active') void load()")
    expect(wrapper).toContain('appStateSub.remove()')
  })

  it('部分数据源失败必须显式提示,不能只显示几条 — 当成功', () => {
    expect(wrapper).toContain("setError(okCount < 4 ? t('dashboard.partialFailed') : '')")
    for (const locale of ['zh-CN', 'en', 'ja', 'ko', 'zh-TW']) {
      const pack = readFileSync(
        join(APP, `../../packages/i18n/messages/mobile-rn/${locale}.json`),
        'utf-8',
      )
      expect(pack, `${locale} 缺 dashboard.partialFailed`).toContain('"partialFailed"')
    }
  })

  it('只有真取到数据才推进"更新于",状态行五语言在位', () => {
    expect(wrapper).toContain('setLastUpdated(new Date())')
    expect(wrapper).toContain("t('dashboard.liveStatus', { time })")
    expect(wrapper).toContain("t('dashboard.autoRefreshHint')")
    expect(wrapper).toContain('statusText={statusText}')
  })

  it('共享层 statusText 是可选项且真的渲染(不传保持零行为变化)', () => {
    expect(shared).toContain('statusText?: string')
    expect(shared).toContain('{statusText ?')
    expect(shared).toContain('styles.statusText')
  })

  it('大屏有返回键:NavChrome + NavBar 标题与 dashboard.title 同源', () => {
    // 真机验收发现:RootStack 全局 headerShown=false,大屏此前顶部只有状态行、
    // 没有标题/返回键;补全站一致的 NavChrome + NavBar 后再锁住。
    expect(wrapper).toContain("import { NavBar } from '../components/NavBar'")
    expect(wrapper).toContain("import { NavChrome } from '../components/NavChrome'")
    expect(wrapper).toContain('<NavChrome>')
    expect(wrapper).toContain(
      "<NavBar title={t('dashboard.title')} onBack={() => navigation.goBack()} />",
    )
  })

  it('错误态只显示一次:空态里已有错误+重试,顶部横幅不再重复同一句', () => {
    // 真机 403 截图:红字"没有权限执行此操作"出现两遍(顶部横幅 + 空态)。
    // 空态由 renderEmpty 用同一个 error 渲染,横幅只在"有指标 + 部分源失败"时才有意义。
    expect(shared).toContain('{error && !isEmpty ? (')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
