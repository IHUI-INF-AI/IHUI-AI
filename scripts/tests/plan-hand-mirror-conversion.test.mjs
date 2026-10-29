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

test('M11 屏幕消费键:驼峰命名空间必须认(notificationSettings.*),路由/包名不得混入', () => {
  const screen = `
    const a = t('notificationSettings.title'), b = t('liveHost.streamKey'), c = t('modelEdit.salePaid')
    const d = t('common.back')
    import x from '@ihui/rn-app'
    const url = '/pages/setting/notification'
    const cls = 'flex-row items-center'`
  const keys = conv.screenConsumedKeys(screen)
  assert.equal(keys.has('notificationSettings.title'), true)
  assert.equal(keys.has('liveHost.streamKey'), true)
  assert.equal(keys.has('modelEdit.salePaid'), true)
  assert.equal(keys.has('common.back'), true)
  assert.equal(keys.has('/pages/setting/notification'), false)
  assert.equal(keys.has('@ihui/rn-app'), false)
  assert.equal(keys.size, 4)
})

test('M12 正文闸的作用域:同一句话在别的键下不算该屏渲染得出(驼峰键也要按作用域算)', () => {
  const page = `const a = '通知分类'`
  const messages = '{"notificationSettings":{"title":"通知设置"},"other":{"x":"通知分类"}}'
  // 该屏只消费 notificationSettings.* ⇒ 页面的"通知分类"渲染不出来
  const screenHay = conv.messagesValuesByKeys(messages, conv.screenConsumedKeys(`t('notificationSettings.title')`))
  assert.equal(conv.cjkNotRenderedOnScreen(page, screenHay), '通知分类'.length)
  // 该屏确实消费了 other.x ⇒ 销账
  const okHay = conv.messagesValuesByKeys(messages, conv.screenConsumedKeys(`t('other.x')`))
  assert.equal(conv.cjkNotRenderedOnScreen(page, okHay), 0)
})

test('M13 catch 形态必须认全:语句式与三种箭头式 .catch 里的 toast 都算错误分支', () => {
  // 仓内主流是 `.catch((e) => { … })`;旧实现只认语句式 `catch (e) {` ⇒ 这类页恒被判
  // "toast 不在 catch 里",于是「错误提示由壳承担」这条等价判据对绝大多数请求代码恒为假。
  const cases = {
    '带括号单参箭头': "load().catch((e) => { Taro.showToast({ title: tt('x.loadFailed') }) })",
    '空参箭头': "load().catch(() => { Taro.showToast({ title: tt('x.loadFailed') }) })",
    '裸标识符箭头': "load().catch(err => { Taro.showToast({ title: tt('x.loadFailed') }) })",
    语句式: "try { load() } catch (e) { Taro.showToast({ title: tt('x.loadFailed') }) }",
  }
  for (const [name, src] of Object.entries(cases))
    assert.equal(conv.toastOnlyInCatch(src), true, `${name} 的 catch 必须被认出来`)
  // 反面:catch 之外还有成功提示 ⇒ 不得整体算成错误分支
  const mixed =
    "load().catch((e) => { Taro.showToast({ title: 'x' }) }); Taro.showToast({ title: 'y' })"
  assert.equal(conv.toastOnlyInCatch(mixed), false, 'catch 外的 toast 仍要拦住')
})

test('M14 壳侧反馈出口含整屏错误态:ErrorState 与 appAlert 同等看待', () => {
  const page = "load().catch(() => { Taro.showToast({ title: tt('x.loadFailed') }) })"
  assert.equal(
    conv.toastFullyCovered(page, 'if (error) return <ErrorState message={error} />'),
    true,
    'ErrorState 是错误提示的等价出口(实测 ExamResultScreen 就是这个形态)',
  )
  assert.equal(conv.toastFullyCovered(page, 'return <View />'), false, '壳连错误态都没有 ⇒ 不销账')
})

test('M15 具名薄封装:定义体的字面量端点与壳重合 ⇒ 销账;动态段 / 别名转发 ⇒ 保守拒', () => {
  const page = "import { getAskList } from '@/api'\ngetAskList()"
  assert.equal(
    conv.apiEndpointsCovered(page, "fetchApi('/api/asks')", "export const getAskList = (p) => get('/asks', p)"),
    true,
  )
  assert.equal(
    conv.apiEndpointsCovered(page, "fetchApi('/api/asks')", ''),
    false,
    '读不到 api 模块 ⇒ 一律不销账',
  )
  assert.equal(
    conv.apiEndpointsCovered("import { g } from '@/api'\ng()", "fetchApi('/api/x')", 'export const g = (id) => get(`/x/${id}`)'),
    false,
    '动态段解析不出 ⇒ 不销账',
  )
  assert.equal(
    conv.apiEndpointsCovered("import { a } from '@/api'\na()", "fetchApi('/api/x')", 'export const a = _a'),
    false,
    '别名转发(定义体里没有请求器)⇒ 不销账',
  )
  // 边界:夹在中间的 export type 不得把下一个符号的端点算进前一个
  const mod = "export const f = () => get('/a')\nexport type T = { x: 1 }\nexport const g = () => get('/b')"
  assert.deepEqual([...conv.apiSymbolEndpoints(mod).get('f')], ['/a'])
  assert.deepEqual([...conv.apiSymbolEndpoints(mod).get('g')], ['/b'])
})

test('M16 客户端分页:本地可见量递增 ⇒ 不算要下一页;真数据翻页(page:)或没触底钩子都不放行', () => {
  // 正例 = model-plaza 现读形态:一次取回(仅 pageSize),触底只调本地可见条数
  const modelPlaza = [
    "const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)",
    'const visibleList = filteredList.slice(0, visibleCount)',
    'useReachBottom(() => { if (hasMore) setVisibleCount((c) => c + PAGE_SIZE) })',
    'const resp = await fetchModels({ pageSize: 100 })',
  ].join('\n')
  assert.equal(conv.clientSidePaging(modelPlaza), true)
  // 反面:带 page 参数 = 真向后端要下一页,共享屏的列表承担不了数据分页
  assert.equal(
    conv.clientSidePaging(`${modelPlaza}\nfetchModels({ page: nextPage, pageSize: 20 })`),
    false,
  )
  // 反面:没有触底钩子 ⇒ 这条判断根本不该销账
  assert.equal(conv.clientSidePaging('const x = list.slice(0, 10)'), false)
  // 反面:只在注释里提过 useReachBottom(注释不是实现,与 S19 同型)
  assert.equal(
    conv.clientSidePaging('// 对齐 useReachBottom\nconst x = list.slice(0, 10)'),
    false,
  )
  // 反面:可见量不做切片(没有 slice(0,…))⇒ 形态不成立,保守拒
  assert.equal(
    conv.clientSidePaging('useReachBottom(() => setVisibleCount((c) => c + 10))'),
    false,
  )
})

test('M17 跨端通用能力按类别销账:壳侧确有该类实现才销,平台独占能力永在表外', () => {
  const pageTokens = () => new Set(['@/api', 'Taro.navigateTo', 'Taro.showToast', 'useShareAppMessage'])
  const shell =
    "import { fetchApi } from '@ihui/api-client'\nnavigation.navigate('X')\nappAlert('保存失败')"
  const t1 = pageTokens()
  assert.deepEqual(conv.shellCapabilityCovered(t1, shell), ['取数', '导航', '用户提示'])
  // 平台独占(小程序分享)不在表里:壳再会导航也销不掉它 —— 转壳就是真丢功能
  assert.deepEqual([...t1], ['useShareAppMessage'])
  // 反面:壳只有 onPress 回调(跳转外包给宿主,宿主是否真接了这一跳没人证明)⇒ 导航不销
  const t2 = pageTokens()
  conv.shellCapabilityCovered(t2, 'onPressItem={() => {}}')
  assert.ok(t2.has('Taro.navigateTo'))
  // 反面:只在注释里提过取数 ⇒ 不销(注释不是实现,与 S19 同型)
  const t3 = pageTokens()
  conv.shellCapabilityCovered(t3, '// 壳用 @ihui/api-client 取数')
  assert.ok(t3.has('@/api'))
  // 反面:空壳 ⇒ 一族都不销,一个 token 都不许少
  const t4 = pageTokens()
  assert.deepEqual(conv.shellCapabilityCovered(t4, ''), [])
  assert.equal(t4.size, 4)
})

test('M18 提示能力认"error 交给共享屏渲染"这一形:共享屏不渲染就不销(本票重构引入过的回归)', () => {
  const mk = () => new Set(['Taro.showToast'])
  // 2026-10-29 把 wrapper 重构成 usePaginatedList 后,壳里不再有 setError 字面量,
  // 错误经 hook 的 error 出口流到共享屏的 ErrorState/errorText —— 只认旧字面量会把
  // live/history 与 member/integral 两页当场退回"缺提示能力"(实测到的自伤)。
  const t1 = mk()
  assert.deepEqual(
    conv.shellCapabilityCovered(t1, '<Shared error={error} onEndReached={loadMore} />', '<ErrorState message={error} />'),
    ['用户提示'],
  )
  assert.ok(!t1.has('Taro.showToast'))
  // 反向对照:壳把 error 传下去了,共享屏那一侧却没任何渲染 ⇒ 用户看不见失败 ⇒ 不销
  const t2 = mk()
  assert.deepEqual(conv.shellCapabilityCovered(t2, '<Shared error={error} />', 'return <View />'), [])
  assert.ok(t2.has('Taro.showToast'))
  // 反向对照:共享屏渲染 error 但壳没把它交下去 ⇒ 同样不销
  const t3 = mk()
  assert.deepEqual(conv.shellCapabilityCovered(t3, 'return <Shared />', '<ErrorState message={error} />'), [])
  assert.ok(t3.has('Taro.showToast'))
  // 旧形态仍算(不能因为加了新一维就把 setError 那条证据丢掉)
  const t4 = mk()
  assert.deepEqual(
    conv.shellCapabilityCovered(t4, 'const [error, setError] = useState("")\nsetError(t("x.loadFailed"))', ''),
    ['用户提示'],
  )
})

test('M19 返回键两端同源:壳交 onBack ∧ 共享屏渲染 <BackChevron> 才销,缺一侧不销', () => {
  const mk = () => new Set(['@/components/BackChevron'])
  // 正例 = pkg-content/search/index 现读三层:页面 <BackChevron onTap={goBack}> /
  // 壳 onBack={() => navigation.goBack()} / 共享屏 <BackChevron onPress={onBack} …>
  const t1 = mk()
  assert.deepEqual(
    conv.shellCapabilityCovered(t1, 'onBack={() => navigation.goBack()}', '<BackChevron onPress={onBack} />'),
    ['返回键'],
  )
  assert.ok(!t1.has('@/components/BackChevron'))
  // 反面:壳传了 onBack,但共享屏根本没渲染返回键 ⇒ 转壳后用户没退路 ⇒ 不销
  const t2 = mk()
  assert.deepEqual(conv.shellCapabilityCovered(t2, 'onBack={() => navigation.goBack()}', 'return <View />'), [])
  assert.ok(t2.has('@/components/BackChevron'))
  // 反面:共享屏有 <BackChevron>,但壳没把 onBack 交进去 ⇒ 按上去没反应 ⇒ 不销
  const t3 = mk()
  assert.deepEqual(conv.shellCapabilityCovered(t3, 'return <Shared items={items} />', '<BackChevron onPress={onBack} />'), [])
  assert.ok(t3.has('@/components/BackChevron'))
  // 共享屏侧的 BackChevron 也算注释不成立(遮注释后仍要有真 JSX)
  const t4 = mk()
  assert.deepEqual(
    conv.shellCapabilityCovered(t4, 'onBack={() => navigation.goBack()}', '// <BackChevron /> 以后再说'),
    [],
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
