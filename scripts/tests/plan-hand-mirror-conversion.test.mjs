// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像测试:判据腿 `scripts/plan-hand-mirror-conversion.mjs`(§22c:判据直接 import 源符号,不复制)。
//
// 为什么要有:这些判据在 2026-10-27/28 被反复改过(十几次),此前只有脚本自带的 `--self-test`,
// 而自检是可以被跳过的一步。本文件把其中**决定"这页能不能迁"的几条**用 node --test 钉死,
// 每条都要求"正面放行 ∧ 反面拒绝"成对出现 —— 只测正面会让判据退化成"什么都放行"也照样绿。
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { __test__ as conv } from '../plan-hand-mirror-conversion.mjs'

test('M1 端点归一:去 /api 前缀、${} 与数字段折成 :id(同一端点两种写法必须相等)', () => {
  assert.equal(conv.normEndpoint('/api/follows/${id}/status'), '/follows/:id/status')
  assert.equal(conv.normEndpoint('/follows/123/status?a=1'), '/follows/:id/status')
  assert.equal(conv.normEndpoint('/api/users/'), '/users')
})

test('M2 端点等价销账:页面直调端点全落在壳 fetchApi 里才认;不重合或带业务函数都不认', () => {
  const shell = "fetchApi(`/api/follows/${uid}/status`)\nfetchApi('/api/messages/conversations')"
  assert.equal(
    conv.apiEndpointsCovered(
      "import { get, post } from '@/api'\nget('/follows/1/status')\npost('/messages/conversations')",
      shell,
    ),
    true,
  )
  assert.equal(conv.apiEndpointsCovered("import { get } from '@/api'\nget('/agents/list')", shell), false)
  assert.equal(conv.apiEndpointsCovered("import { getX } from '@/api'\nget('/x')", shell), false)
})

test('M3 跳转覆盖:route-map 反查 ∧ 壳出现该路由名;query 插值不影响路径反查', () => {
  const rm = conv.routeMapFrom("export const RN_ROUTE_MAP = { Detail: '/pkg-a/detail/index' }")
  assert.equal(
    conv.coveredNavigation("Taro.navigateTo({ url: '/pkg-a/detail/index?id=${encodeURIComponent(x)}' })", "navigation.navigate('Detail')", rm)
      .covered,
    true,
  )
  assert.equal(
    conv.coveredNavigation("Taro.navigateTo({ url: '/pkg-a/detail/index' })", 'function S(){ return null }', rm).covered,
    false,
  )
})

test('M4 逐条 toast:一页里"catch 内 + 成功分支"并存也全过;有一条两不满足则不销', () => {
  const shell = "appAlert(t('eduShop.orderCreated'))"
  assert.equal(
    conv.toastFullyCovered(
      "Taro.showToast({ title: t('eduShop.orderCreated') }); try { await buy() } catch { Taro.showToast({ title: t('common.loadFailed') }) }",
      shell,
    ),
    true,
  )
  assert.equal(conv.toastFullyCovered("Taro.showToast({ title: t('x.onlyPage') })", shell), false)
})

test('M5 toast 括号配对:模板插值含右花括号也不截断调用', () => {
  const spans = conv.toastCallSpans("Taro.showToast({ title: `${t('a.b')}${msg ? `:${msg}` : ''}` })")
  assert.equal(spans.length, 1)
  assert.ok(spans[0].text.includes('msg'))
})

test('M6 回屏重取:壳有 useRefreshOnFocus/useFocusEffect 才算;useEffect 不认', () => {
  assert.equal(conv.shellRefreshesOnFocus('useRefreshOnFocus(load)'), true)
  assert.equal(conv.shellRefreshesOnFocus('useFocusEffect(cb)'), true)
  assert.equal(conv.shellRefreshesOnFocus('useEffect(load)'), false)
})

test('M7 确认弹窗:Alert.alert 或带选项(appAlert+onPress)才算;普通 appAlert 不认', () => {
  assert.equal(conv.modalCovered('Alert.alert(t("x"), "", [])'), true)
  assert.equal(conv.modalCovered("appAlert(name, desc, [{ text: t('ok'), onPress: () => go() }])"), true)
  assert.equal(conv.modalCovered("appAlert(t('common.failed'))"), false)
})

test('M8 鉴权门:钩子体只做 waitUntilReady 才算;有别的语句不算', () => {
  assert.equal(
    conv.authGateCoversDidShow("import { useAuthReadyGate } from '@/hooks/use-auth-ready-gate'\nuseDidShow(() => { gate.waitUntilReady(() => { void load() }) })"),
    true,
  )
  assert.equal(conv.authGateCoversDidShow('useDidShow(() => { track() })'), false)
})

test('M9 正文闸:只数不在词包里的字符串字面量中文(注释与词包已有都不算)', () => {
  const page = `// 这是一段很长的中文注释,不应计入\nconst a = '暂无数据'\nconst b = '仅本页才有的正文'`
  const messages = '{"common":{"empty":"暂无数据"}}'
  const miss = conv.hardcodedCjkNotInMessages(page, messages)
  assert.equal(miss, '仅本页才有的正文'.length)
})

test('M10 switchTab 回落:只作 navigateBack 的 catch 回落不算私有;独立切 tab 仍算', () => {
  assert.equal(
    conv.backFallbackOnly("Taro.navigateBack({ delta: 1 }).catch(() => { Taro.switchTab({ url: '/pages/index/index' }) })"),
    true,
  )
  assert.equal(conv.backFallbackOnly("Taro.switchTab({ url: '/pages/x' })"), false)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
