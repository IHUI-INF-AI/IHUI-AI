// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * miniapp-shell-form.test.mjs —— 门 299 的镜像测试(§22c)。
 *
 * 判据不复制一份:分类/棘轮全部 import 源 lib 与源门 `__test__`;本文件只钉方向:
 *   T1 入口识别:只认 import,不认注释/字符串(观测面抗伪装)
 *   T2 等价入口:必须与声明 spec 对得上,不认野路径
 *   T3 分类:copy/pure、copy/local-delta、shell、不在射程、读不到 ⇒ undetermined
 *   T4 棘轮三向:增 = 红、存量在册 = 绿、存量收敛 = advisory
 *   T5 端到端:真实仓(HEAD 面)当前复制页全部在册 ⇒ exit 0
 *   T6 射程真覆盖:真实仓确有复制页与薄壳页(阳性/阴性对照材质都在)
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

import {
  classifyMiniappPages,
  classifyPage,
  equivalentEntry,
  evaluateRatchet,
  hasShellImport,
  loadLedgerRows,
} from '../lib/miniapp-shell-form.mjs'
import { __test__ as G } from '../check-miniapp-shell-form.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const SCRIPTS = join(ROOT, 'scripts')

const SPEC = ['packages/app/src/features/demo/DemoScreen.tsx']

test('T1 入口识别只认 import,不认注释/字符串/裸提及', () => {
  assert.equal(hasShellImport("import { DemoScreen } from '@rn-shells/DemoScreen'"), true)
  assert.equal(
    hasShellImport("import X from '@ihui/rn-app/features/demo/DemoScreen'"),
    false,
    '等价入口要走 equivalentEntry',
  )
  assert.equal(hasShellImport('// 见 @rn-shells/DemoScreen'), false)
  assert.equal(hasShellImport("const s = '@rn-shells/DemoScreen'"), false)
  assert.equal(hasShellImport("import { __ } from '@rn-shells-utils/x'"), false, '前缀撞名不能误认')
})

test('T2 等价入口必须与声明 spec 对得上', () => {
  assert.match(
    equivalentEntry("import { S } from '@ihui/rn-app/features/demo/DemoScreen'", SPEC) || '',
    /rn-app\/features\/demo\/DemoScreen/,
  )
  assert.equal(
    equivalentEntry("import { S } from '@ihui/rn-app/features/other/OtherScreen'", SPEC),
    null,
  )
  assert.equal(
    equivalentEntry("import { DemoScreen } from '@ihui/rn-app'", SPEC),
    "import {DemoScreen} from '@ihui/rn-app'",
  )
  const otherSpec = ['packages/app/src/features/other/OtherScreen.tsx']
  assert.equal(equivalentEntry("import { DemoScreen } from '@ihui/rn-app'", otherSpec), null)
})

test('T3 分类:声明 + 无壳 = copy,并按数据层痕迹分 pure/local', () => {
  const base = {
    route: 'demo/x',
    file: 'demo/x.tsx',
    declaredSpecs: SPEC,
    registry: { miniapp: 'demo/x' },
  }
  const copy = classifyPage({ ...base, text: 'fetch("/api/x")' })
  assert.equal(copy.impl, 'copy')
  assert.equal(copy.reasonClass, 'local-delta')
  assert.equal(copy.mapStatus, 'registry+declaration')

  const pure = classifyPage({
    ...base,
    text: "import { View } from '@tarojs/components'\n// 对齐 RN",
  })
  assert.equal(pure.reasonClass, 'pure-copy')

  const shell = classifyPage({
    ...base,
    text: "import { DemoScreen } from '@rn-shells/DemoScreen'",
  })
  assert.equal(shell.impl, 'shell')

  assert.equal(
    classifyPage({ route: 'demo/p', file: 'demo/p.tsx', text: 'export default 1' }).impl,
    'plain',
  )
  assert.equal(
    classifyPage({ route: 'demo/u', file: 'demo/u.tsx', text: null }).impl,
    'undetermined',
  )
  assert.equal(classifyPage({ route: 'demo/m', file: null, text: null }).impl, 'undetermined')
})

test('T4 棘轮三向:增=红、存量在册=绿、存量收敛=advisory', () => {
  const copy = classifyPage({
    route: 'demo/x',
    file: 'demo/x.tsx',
    text: 'fetch("/api/x")',
    declaredSpecs: SPEC,
    registry: { miniapp: 'demo/x' },
  })
  const shell = classifyPage({
    route: 'demo/s',
    file: 'demo/s.tsx',
    text: "import { DemoScreen } from '@rn-shells/DemoScreen'",
    declaredSpecs: SPEC,
    registry: { miniapp: 'demo/s' },
  })
  assert.equal(evaluateRatchet([copy], []).reds.length, 1)
  assert.equal(evaluateRatchet([shell], []).reds.length, 0)
  const row = {
    route: copy.route,
    file: copy.file,
    loc: copy.loc,
    mapStatus: copy.mapStatus,
    reasonClass: copy.reasonClass,
    impl: 'copy',
  }
  assert.equal(evaluateRatchet([copy], [row]).reds.length, 0)
  assert.equal(evaluateRatchet([], [row]).advisories[0]?.rule, 'S2')
})

test('T5 真实仓 HEAD 面:当前复制页全部在册,门 exit 0', () => {
  const out = execFileSync(
    process.execPath,
    [join(SCRIPTS, 'check-miniapp-shell-form.mjs'), '--json'],
    {
      cwd: ROOT,
      encoding: 'utf8',
    },
  )
  const j = JSON.parse(out)
  assert.equal(j.reds.length, 0)
  assert.ok(j.stats.copy > 0, '存量复制页必须被数出来,否则射程存疑')
  assert.ok(j.stats.shell > 0, '薄壳页必须被数出来,否则阴性对照缺失')
  assert.equal(j.stats.ledgerRows, loadLedgerRows(ROOT).length)
})

test('T6 射程真覆盖:真实仓同时存在复制页与薄壳页(对照材质)', () => {
  const { rows } = classifyMiniappPages(ROOT, 'head')
  assert.ok(
    rows.some((r) => r.impl === 'copy'),
    '阳性对照材质缺失',
  )
  assert.ok(
    rows.some((r) => r.impl === 'shell' && r.mapStatus !== 'none'),
    '阴性对照材质缺失',
  )
  assert.ok(
    rows.every((r) => r.mapStatus !== 'missing-file'),
    '映射指向不存在的页面 = 未判定,不该静默',
  )
  assert.ok(G.validateLedger(loadLedgerRows(ROOT)).length === 0, '台账不得有腐烂行')
})

test('T7 台账行形状锁:必含 route/file/loc/mapStatus/reasonClass', () => {
  const rows = loadLedgerRows(ROOT)
  assert.ok(rows.length > 0)
  for (const r of rows) {
    assert.equal(typeof r.route, 'string')
    assert.match(r.file, /^apps\/miniapp-taro\/src\/.+\.[jt]sx$/)
    assert.ok(r.loc > 0)
    assert.ok(
      ['registry+declaration', 'registry', 'declaration', 'ambiguous', 'none'].includes(
        r.mapStatus,
      ),
    )
    assert.ok(['pure-copy', 'local-delta', 'undetermined'].includes(r.reasonClass))
  }
  // 台账是判据输入,永远从工作树读;门源码里不得出现对工作树业务代码的直读
  const src = readFileSync(join(SCRIPTS, 'check-miniapp-shell-form.mjs'), 'utf8')
  assert.ok(src.includes('GATE_ID: 299'), '门号头注缺失')
})

// T8 本批薄壳页形态锁(2026-11-05,pkg-user/user/profile):入口被认 + 页内渲染段归零。
// 阴性对照两枚,防止判据恒真:①摘掉入口行后同一把尺子必须不再认;②复制页材质必须被"渲染标签"判据命中。
const PROFILE_PAGE = join(ROOT, 'apps/miniapp-taro/src/pkg-user/user/profile.tsx')
const PROFILE_SPEC = ['packages/app/src/features/profile/ProfileScreen.tsx']
const RENDER_TAG_RE = /<(View|Text|Image|ScrollView)\b/

test('T8 profile 薄壳页:共享入口被认 + 页内无渲染型 JSX(wrapper 除外)', () => {
  const page = readFileSync(PROFILE_PAGE, 'utf8')
  assert.ok(equivalentEntry(page, PROFILE_SPEC), '页面必须直载共享屏等价入口')
  assert.equal(
    equivalentEntry(
      page.replace(/^import[^\n]*@ihui\/rn-app\/features\/profile\/ProfileScreen[^\n]*\n/m, ''),
      PROFILE_SPEC,
    ),
    null,
    '阴性对照:摘掉入口行后不得仍判为薄壳',
  )
  assert.doesNotMatch(page, RENDER_TAG_RE, '页内不得残留小程序组件渲染段')
  assert.match(
    "import { View } from '@tarojs/components'\nexport default () => <View className='pf-section' />",
    RENDER_TAG_RE,
    '阴性对照:复制页材质必须被同一判据命中',
  )
})

// T9 本批薄壳页形态锁(2026-11-05,pkg-user/user/settings):入口被认 + 页内渲染段归零
// + 关键传参在位。阴性对照两枚:①摘掉入口行必须不再判薄壳;②删掉 menuItems 传参必须红。
const SETTINGS_PAGE = join(ROOT, 'apps/miniapp-taro/src/pkg-user/user/settings.tsx')
const SETTINGS_SPEC = ['packages/app/src/features/settings/SettingsScreen.tsx']
const SETTINGS_PROPS_RE = /menuItems=\{menuItems\}/m

test('T9 settings 薄壳页:共享入口被认 + 页内无渲染型 JSX(wrapper 除外)', () => {
  const page = readFileSync(SETTINGS_PAGE, 'utf8')
  assert.ok(equivalentEntry(page, SETTINGS_SPEC), '页面必须直载共享屏等价入口')
  assert.equal(
    equivalentEntry(
      page.replace(/^import[^\n]*@ihui\/rn-app\/features\/settings\/SettingsScreen[^\n]*\n/m, ''),
      SETTINGS_SPEC,
    ),
    null,
    '阴性对照:摘掉入口行后不得仍判为薄壳',
  )
  assert.doesNotMatch(page, RENDER_TAG_RE, '页内不得残留小程序组件渲染段')
  assert.match(
    "import { View } from '@tarojs/components'\nexport default () => <View className='st-section' />",
    RENDER_TAG_RE,
    '阴性对照:复制页材质必须被同一判据命中',
  )
  assert.match(page, SETTINGS_PROPS_RE, '菜单分区必须由页面装配后注入共享屏')
  assert.doesNotMatch(
    page.replace(SETTINGS_PROPS_RE, ''),
    SETTINGS_PROPS_RE,
    '阴性对照:删掉 menuItems 传参后同一判据必须不再命中',
  )
})

// T10 本批薄壳页形态锁(2026-11-05,pkg-user/user/avatar):入口被认 + 页内渲染段归零
// + AvatarEditor 关键传参在位 + RN 真消费同一组件。阴性对照三枚:
// ①摘掉入口行必须不再判薄壳;②删 onUpload 传参必须红;③删 uploading 传参必须红。
const AVATAR_PAGE = join(ROOT, 'apps/miniapp-taro/src/pkg-user/user/avatar.tsx')
const AVATAR_SPEC = ['packages/app/src/features/profile-edit/ProfileEditScreen.tsx']
const AVATAR_SHARED = join(ROOT, 'packages/app/src/features/profile-edit/ProfileEditScreen.tsx')
const AVATAR_RN_PAGE = join(ROOT, 'apps/mobile-rn/src/screens/ProfileEditScreen.tsx')
const AVATAR_ON_UPLOAD_RE = /onUpload=\{\(url\) =>/m
const AVATAR_UPLOADING_RE = /uploading=\{uploading\}/m
const AVATAR_SHARED_ON_UPLOAD_RE = /onPress=\{\(\) => onUpload\(urlInput\.trim\(\)\)\}/m

test('T10 avatar 薄壳页:共享入口被认 + 页内无渲染型 JSX(wrapper 除外)', () => {
  const page = readFileSync(AVATAR_PAGE, 'utf8')
  assert.ok(equivalentEntry(page, AVATAR_SPEC), '页面必须直载共享屏等价入口')
  assert.equal(
    equivalentEntry(
      page.replace(
        /^import[^\n]*@ihui\/rn-app\/features\/profile-edit\/ProfileEditScreen[^\n]*\n/m,
        '',
      ),
      AVATAR_SPEC,
    ),
    null,
    '阴性对照:摘掉入口行后不得仍判为薄壳',
  )
  assert.doesNotMatch(page, RENDER_TAG_RE, '页内不得残留小程序组件渲染段')
  assert.match(page, AVATAR_ON_UPLOAD_RE, 'URL 入口必须注入 onUpload')
  assert.doesNotMatch(
    page.replace(AVATAR_ON_UPLOAD_RE, ''),
    AVATAR_ON_UPLOAD_RE,
    '阴性对照:删掉 onUpload 传参后同一判据必须不再命中',
  )
  assert.match(page, AVATAR_UPLOADING_RE, '上传遮罩开关必须注入 uploading')
  assert.doesNotMatch(
    page.replace(AVATAR_UPLOADING_RE, ''),
    AVATAR_UPLOADING_RE,
    '阴性对照:删掉 uploading 传参后同一判据必须不再命中',
  )
})

test('T10b AvatarEditor 共享组件消费面 + RN 真消费', () => {
  const shared = readFileSync(AVATAR_SHARED, 'utf8')
  assert.match(shared, /export function AvatarEditor\(/m, '共享组件必须以具名导出暴露')
  assert.match(shared, AVATAR_SHARED_ON_UPLOAD_RE, 'URL 入口必须调用 onUpload')
  assert.doesNotMatch(
    shared.replace(AVATAR_SHARED_ON_UPLOAD_RE, ''),
    AVATAR_SHARED_ON_UPLOAD_RE,
    '阴性对照:摘掉 onUpload 调用后同一判据必须不再命中',
  )
  assert.match(shared, /testID="avatar-upload-mask"/m, '上传遮罩必须在 uploading 时渲染')
  const rn = readFileSync(AVATAR_RN_PAGE, 'utf8')
  assert.match(rn, /<AvatarEditor/m, 'RN 资料页必须渲染共享 AvatarEditor')
  assert.match(rn, /onUpload=\{onUploadAvatarUrl\}/m, 'RN 必须注入 onUpload')
  assert.match(rn, /uploading=\{avatarUploading\}/m, 'RN 必须注入 uploading')
})

// T11 本批薄壳页形态锁(2026-11-05,pkg-user/user/orders):入口被认 + 页内渲染段归零
// + onPay 双端真消费 + i18n 适配层不落裸 key/空串。阴性对照四枚:
// ①摘掉入口行必须不再判薄壳;②删页内 onPay 传参必须红;③删 RN 消费点必须红;
// ④删一条 ORDER_TEXT 映射(该键在 locale 无原生词条)后 fixture 必须抛。
const ORDERS_PAGE = join(ROOT, 'apps/miniapp-taro/src/pkg-user/user/orders.tsx')
const ORDERS_SPEC = ['packages/app/src/features/order/OrderScreen.tsx']
const ORDERS_SHARED = join(ROOT, 'packages/app/src/features/order/OrderScreen.tsx')
const ORDERS_RN_PAGE = join(ROOT, 'apps/mobile-rn/src/screens/OrderScreen.tsx')
const ORDERS_LOCALES = join(ROOT, 'packages/i18n/messages/miniapp-taro')
const ORDERS_ON_PAY_RE = /onPay=\{onPay\}/m
const ORDER_TEXT_LINE_RE = /^\s*'([^']+)':\s*'([^']+)',/gm
const ORDER_TABS = ['all', 'pending', 'shipped', 'completed', 'refunded']
const ORDER_STATUSES = [
  'pending',
  'paid',
  'shipped',
  'completed',
  'cancelled',
  'refunded',
  'refunding',
  'failed',
]

function parseOrderText(src) {
  const map = new Map()
  for (const m of src.matchAll(ORDER_TEXT_LINE_RE)) map.set(m[1], m[2])
  return map
}

/** 共享屏会渲染的键:静态 t('x') + 动态 tab 键 + 动态状态键 */
function sharedOrderKeys() {
  const src = readFileSync(ORDERS_SHARED, 'utf8')
  const keys = new Set()
  for (const m of src.matchAll(/t\('([^']+)'\)/g)) keys.add(m[1])
  for (const tab of ORDER_TABS) keys.add(`order.tab.${tab}`)
  for (const st of ORDER_STATUSES) keys.add(`order.status.${st}`)
  return [...keys]
}

function localeValue(locale, dotted) {
  return dotted
    .split('.')
    .reduce((o, p) => (o === null || o === undefined ? undefined : o[p]), locale)
}

/**
 * fixture:按页面真实适配层(ORDER_TEXT)逐键解析到各语言词条。
 * 未映射的键按原样走 i18n;任何键最后落到裸 key / 空串 / 非字符串都算适配层失效。
 */
function resolveOrderCopy(pageSrc) {
  const map = parseOrderText(pageSrc)
  const out = {}
  for (const file of readdirSync(ORDERS_LOCALES).filter((f) => f.endsWith('.json'))) {
    const locale = JSON.parse(readFileSync(join(ORDERS_LOCALES, file), 'utf8'))
    for (const key of sharedOrderKeys()) {
      const mapped = map.get(key) ?? key
      const value = localeValue(locale, mapped)
      assert.equal(typeof value, 'string', `${file}: 键 ${key}(映射 ${mapped})未解析为字符串`)
      assert.ok(value.trim().length > 0, `${file}: 键 ${key}(映射 ${mapped})解析为空串`)
      assert.notEqual(value, mapped, `${file}: 键 ${key} 渲染成裸键 ${mapped}`)
      assert.notEqual(value, key, `${file}: 键 ${key} 渲染成裸键 ${key}`)
      out[`${file}:${key}`] = value
    }
  }
  return out
}

test('T11 orders 薄壳页:入口被认 + 页内无渲染型 JSX + onPay 双端真消费', () => {
  const page = readFileSync(ORDERS_PAGE, 'utf8')
  assert.ok(equivalentEntry(page, ORDERS_SPEC), '页面必须直载共享屏等价入口')
  assert.equal(
    equivalentEntry(
      page.replace(/^import[^\n]*@ihui\/rn-app\/features\/order\/OrderScreen[^\n]*\n/m, ''),
      ORDERS_SPEC,
    ),
    null,
    '阴性对照:摘掉入口行后不得仍判为薄壳',
  )
  assert.doesNotMatch(page, RENDER_TAG_RE, '页内不得残留小程序组件渲染段')

  // onPay 槽:共享屏只在 pending 行渲染操作区;小程序与 RN 都必须真消费
  const shared = readFileSync(ORDERS_SHARED, 'utf8')
  assert.match(shared, /item\.status === 'pending' && onPay/m, '共享屏待支付行必须渲染操作区')
  assert.doesNotMatch(
    shared.replace(/item\.status === 'pending' && onPay/, ''),
    /item\.status === 'pending' && onPay/m,
    '阴性对照:摘掉 onPay 守门后同一判据必须不再命中',
  )
  assert.match(page, ORDERS_ON_PAY_RE, '小程序页必须注入 onPay(支付动作留端内)')
  assert.doesNotMatch(
    page.replaceAll('onPay={onPay}', ''),
    ORDERS_ON_PAY_RE,
    '阴性对照:删掉页内 onPay 传参后同一判据必须不再命中',
  )
  const rn = readFileSync(ORDERS_RN_PAGE, 'utf8')
  assert.match(rn, /<SharedOrderScreen/m, 'RN 列表必须渲染共享屏')
  assert.match(rn, ORDERS_ON_PAY_RE, 'RN 列表必须注入 onPay')
  assert.match(rn, /useWechatPayment\(/m, 'RN 支付必须走端内微信 APP 支付链路')
  assert.doesNotMatch(
    rn.replaceAll('onPay={onPay}', ''),
    ORDERS_ON_PAY_RE,
    '阴性对照:删掉 RN onPay 消费点后同一判据必须不再命中',
  )
})

test('T11b orders i18n 适配层:五语言逐键解析为人话,不落裸 key/空串', () => {
  const page = readFileSync(ORDERS_PAGE, 'utf8')
  const values = resolveOrderCopy(page)
  // 锚两条人话,证明"最后显示的是词条值"而不是 key 本身
  assert.equal(values['zh-CN.json:order.title'], '我的订单')
  assert.equal(values['zh-CN.json:order.tab.all'], '全部')
  // 阴性对照:删掉 order.tab.all 的映射(该键在 locale 无原生词条)⇒ fixture 必抛
  assert.throws(() => resolveOrderCopy(page.replace(/^\s*'order\.tab\.all':[^\n]*\n/m, '')))
})

// T12/T13 共享屏 i18n 裸 key 收口(2026-11-05,change-phone + account-cancel):
// 共享屏文案必须逐键解析为五语言人话;RN 走端词包直读,小程序走 PHONE_TEXT/ACCOUNT_CANCEL_TEXT
// 适配表映射到既有词条。阴性对照两枚:①删 RN 一个键必须抛;②删适配表一条映射必须回落裸 key 抛出。
const SHARED_PHONE = join(ROOT, 'packages/app/src/features/change-phone/ChangePhoneScreen.tsx')
const SHARED_CANCEL = join(ROOT, 'packages/app/src/features/account-cancel/AccountCancelScreen.tsx')
const PHONE_TEXT_FILE = join(ROOT, 'apps/miniapp-taro/src/pkg-user/user/phone.tsx')
const CANCEL_TEXT_FILE = join(ROOT, 'apps/miniapp-taro/src/pkg-user/account-cancel/index.tsx')
const RN_LOCALES = join(ROOT, 'packages/i18n/messages/mobile-rn')
const MINI_LOCALES = join(ROOT, 'packages/i18n/messages/miniapp-taro')
const COPY_MAP_LINE_RE = /^\s*'([^']+)':\s*'([^']+)',/gm

function parseCopyMap(src) {
  const map = new Map()
  for (const m of src.matchAll(COPY_MAP_LINE_RE)) map.set(m[1], m[2])
  return map
}

/** 共享屏会渲染的键:静态 t('x') + 带参数的 t('x', {...}) */
function sharedTKeys(sharedPath) {
  const src = readFileSync(sharedPath, 'utf8')
  return [...new Set([...src.matchAll(/t\('([^']+)'/g)].map((m) => m[1]))]
}

function assertCopyResolvable(locale, keys, map, label, record = () => {}) {
  for (const key of keys) {
    const mapped = map ? (map.get(key) ?? key) : key
    const value = localeValue(locale, mapped)
    assert.equal(typeof value, 'string', `${label}: 键 ${key}(映射 ${mapped})未解析为字符串`)
    assert.ok(value.trim().length > 0, `${label}: 键 ${key}(映射 ${mapped})解析为空串`)
    assert.notEqual(value, mapped, `${label}: 键 ${key} 渲染成裸键 ${mapped}`)
    assert.notEqual(value, key, `${label}: 键 ${key} 渲染成裸键 ${key}`)
    record(key, value)
  }
}

function readLocales(dir, keys, map, label) {
  const out = {}
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
    const locale = JSON.parse(readFileSync(join(dir, file), 'utf8'))
    assertCopyResolvable(locale, keys, map, `${label}/${file}`, (key, value) => {
      out[`${label}/${file}:${key}`] = value
    })
  }
  return out
}

test('T12 change-phone 共享屏 i18n:五语言逐键非空/非裸 key/非中文兜底', () => {
  const keys = sharedTKeys(SHARED_PHONE)
  assert.ok(keys.length >= 8, `共享屏按键数不足:${keys.length}`)
  const map = parseCopyMap(readFileSync(PHONE_TEXT_FILE, 'utf8'))
  const rn = readLocales(RN_LOCALES, keys, null, 'mobile-rn')
  const mini = readLocales(MINI_LOCALES, keys, map, 'miniapp-taro')
  assert.equal(rn['mobile-rn/zh-CN.json:user.profile.changePhoneTitle'], '修改手机号')
  assert.equal(mini['miniapp-taro/zh-CN.json:user.profile.changePhoneTitle'], '绑定手机号')
  // 非中文兜底:en/ja/ko 不得等于 zh-CN 译文;en 不得含汉字
  for (const [lang, label] of [
    ['en', 'mobile-rn'],
    ['ja', 'mobile-rn'],
    ['ko', 'mobile-rn'],
  ]) {
    for (const key of keys) {
      assert.notEqual(
        rn[`${label}/${lang}.json:${key}`],
        rn[`${label}/zh-CN.json:${key}`],
        `${label}/${lang}: 键 ${key} 回落中文`,
      )
    }
  }
  for (const key of keys) {
    assert.doesNotMatch(
      rn[`mobile-rn/en.json:${key}`],
      /\p{Script=Han}/u,
      `mobile-rn/en: 键 ${key} 含汉字`,
    )
  }
  // 阴性对照①:删 RN en 的一个键 ⇒ 同尺子必抛
  assert.throws(() => {
    const en = JSON.parse(readFileSync(join(RN_LOCALES, 'en.json'), 'utf8'))
    delete en.user.profile.confirmChange
    assertCopyResolvable(en, keys, null, 'negative/en')
  })
  // 阴性对照②:删适配表 user.profile.resend ⇒ 回落裸 key 必抛
  assert.throws(() => {
    const zh = JSON.parse(readFileSync(join(MINI_LOCALES, 'zh-CN.json'), 'utf8'))
    const broken = new Map(map)
    broken.delete('user.profile.resend')
    assertCopyResolvable(zh, keys, broken, 'negative/zh-CN')
  })
})

test('T13 account-cancel 共享屏 i18n:五语言逐键非空/非裸 key/非中文兜底', () => {
  const keys = sharedTKeys(SHARED_CANCEL)
  assert.ok(keys.length >= 12, `共享屏按键数不足:${keys.length}`)
  const map = parseCopyMap(readFileSync(CANCEL_TEXT_FILE, 'utf8'))
  const rn = readLocales(RN_LOCALES, keys, null, 'mobile-rn')
  const mini = readLocales(MINI_LOCALES, keys, map, 'miniapp-taro')
  assert.equal(rn['mobile-rn/zh-CN.json:settings.accountDeletionTitle'], '账号注销')
  assert.equal(mini['miniapp-taro/zh-CN.json:settings.accountDeletionTitle'], '注销账号')
  for (const lang of ['en', 'ja', 'ko']) {
    for (const key of keys) {
      assert.notEqual(
        rn[`mobile-rn/${lang}.json:${key}`],
        rn[`mobile-rn/zh-CN.json:${key}`],
        `mobile-rn/${lang}: 键 ${key} 回落中文`,
      )
    }
  }
  for (const key of keys) {
    assert.doesNotMatch(
      rn[`mobile-rn/en.json:${key}`],
      /\p{Script=Han}/u,
      `mobile-rn/en: 键 ${key} 含汉字`,
    )
  }
  // 阴性对照①:删 RN ko 的一个键 ⇒ 同尺子必抛
  assert.throws(() => {
    const ko = JSON.parse(readFileSync(join(RN_LOCALES, 'ko.json'), 'utf8'))
    delete ko.settings.accountDeletionCodeLabel
    assertCopyResolvable(ko, keys, null, 'negative/ko')
  })
  // 阴性对照②:删 account-cancel.warning 映射 ⇒ 落地不存在的键必抛
  assert.throws(() => {
    const zh = JSON.parse(readFileSync(join(MINI_LOCALES, 'zh-CN.json'), 'utf8'))
    const broken = new Map(map)
    broken.delete('settings.accountDeletionWarning')
    assertCopyResolvable(zh, keys, broken, 'negative/zh-CN')
  })
})

// T14 phone 薄壳页(2026-11-05):入口被认 + 页内无渲染段 + 旧码五个槽两端真传。
// 阴性对照:①摘页内入口行 ⇒ 不判薄壳;②删小程序 oldCode 传参 ⇒ 同尺子不命中;
// ③删 RN oldPhone 传参 ⇒ 同尺子不命中;④把 RN 子路径改回桶导入 ⇒ 子路径断言必红。
const PHONE_PAGE = join(ROOT, 'apps/miniapp-taro/src/pkg-user/user/phone.tsx')
const PHONE_RN_PAGE = join(ROOT, 'apps/mobile-rn/src/screens/ChangePhoneScreen.tsx')
const PHONE_SPEC = ['packages/app/src/features/change-phone/ChangePhoneScreen.tsx']
const PHONE_SUBPATH = '@ihui/rn-app/features/change-phone/ChangePhoneScreen'
const OLD_CODE_SLOTS = ['oldPhone', 'oldCode', 'oldCodeMin', 'onOldCodeChange', 'onSendOldCode']

function propPassed(src, name) {
  return new RegExp(`\\b${name}=\\{`).test(src)
}

test('T14 phone 薄壳页:入口被认 + 页内无渲染型 JSX + 旧码五槽两端真传', () => {
  const page = readFileSync(PHONE_PAGE, 'utf8')
  assert.ok(equivalentEntry(page, PHONE_SPEC), '页面必须直载共享屏等价入口')
  assert.equal(
    equivalentEntry(
      page.replace(
        /^import[^\n]*@ihui\/rn-app\/features\/change-phone\/ChangePhoneScreen[^\n]*\n/m,
        '',
      ),
      PHONE_SPEC,
    ),
    null,
    '阴性对照:摘掉入口行后不得仍判为薄壳',
  )
  assert.doesNotMatch(page, RENDER_TAG_RE, '页内不得残留小程序组件渲染段')
  assert.match(page, /<ChangePhoneScreen/m, '页面必须渲染共享屏')

  // 两端都必须直载具体子路径,禁桶入口(桶会把 422 个共享屏文件拉进小程序 tsc 程序)
  assert.ok(page.includes(PHONE_SUBPATH), '小程序页必须用具体子路径导入共享屏')
  assert.doesNotMatch(page, /from '@ihui\/rn-app'/m, '小程序页不得走桶入口')
  const rn = readFileSync(PHONE_RN_PAGE, 'utf8')
  assert.ok(rn.includes(PHONE_SUBPATH), 'RN 必须用具体子路径导入共享屏')
  assert.doesNotMatch(rn, /from '@ihui\/rn-app'/m, 'RN 不得走桶入口')
  // 阴性对照④:把 RN 子路径改回桶导入 ⇒ 桶断言必红
  assert.throws(() => {
    const barrel = rn.replace(`from '${PHONE_SUBPATH}'`, "from '@ihui/rn-app'")
    assert.doesNotMatch(barrel, /from '@ihui\/rn-app'/m, 'negative:改回桶导入后不得仍通过')
  })

  // 五个旧码槽:两端逐项真传
  for (const slot of OLD_CODE_SLOTS) {
    assert.ok(propPassed(page, slot), `小程序页必须真传 ${slot}`)
    assert.ok(propPassed(rn, slot), `RN 必须真传 ${slot}`)
  }
  // 可见差异:小程序传脱敏值,RN 传真值 ⇒ 界面上出现"当前手机号 + 旧验证码"行
  assert.match(page, /oldPhone=\{currentPhone \? maskedPhone : undefined\}/m, '小程序传脱敏手机号')
  assert.match(rn, /oldPhone=\{oldPhone\}/m, 'RN 传真手机号')
  assert.notEqual(
    page.match(/oldPhone=\{([^}]+)\}/)?.[1],
    rn.match(/oldPhone=\{([^}]+)\}/)?.[1],
    '两端 oldPhone 传值必须有可见差异',
  )

  // 阴性对照②:删小程序 oldCode 传参 ⇒ 同尺子必不命中
  assert.throws(() => {
    const broken = page.replace(/^\s*oldCode=\{oldCode\}\n/m, '')
    assert.ok(propPassed(broken, 'oldCode'), 'negative:删小程序 oldCode 后不得仍命中')
  })
  // 阴性对照③:删 RN oldPhone 传参 ⇒ 同尺子必不命中
  assert.throws(() => {
    const broken = rn.replace(/^\s*oldPhone=\{oldPhone\}\n/m, '')
    assert.ok(propPassed(broken, 'oldPhone'), 'negative:删 RN oldPhone 后不得仍命中')
  })
})

// T15 account-cancel 薄壳页(2026-11-05):入口被认 + 页内无渲染段 + consequences/phoneReadOnly
// 两端真传 + 7 项后果逐键 + 无弹窗端的页级倒计时(计时器留页内,共享屏只读 prop)。
// 阴性对照:①摘页内入口 ⇒ 不判薄壳;②删小程序 consequences ⇒ 尺子不命中;
// ③删 RN phoneReadOnly ⇒ 尺子不命中;④把 RN 子路径改回桶导入 ⇒ 必红。
const CANCEL_PAGE = join(ROOT, 'apps/miniapp-taro/src/pkg-user/account-cancel/index.tsx')
const CANCEL_RN_PAGE = join(ROOT, 'apps/mobile-rn/src/screens/AccountCancelScreen.tsx')
const CANCEL_SPEC = ['packages/app/src/features/account-cancel/AccountCancelScreen.tsx']
const CANCEL_SUBPATH = '@ihui/rn-app/features/account-cancel/AccountCancelScreen'
const CONSEQUENCE_KEYS = Array.from(
  { length: 7 },
  (_, i) => `settings.accountDeletionConsequence${i + 1}`,
)

test('T15 account-cancel 薄壳页:入口被认 + 7 项后果/phoneReadOnly 两端真传', () => {
  const page = readFileSync(CANCEL_PAGE, 'utf8')
  const rn = readFileSync(CANCEL_RN_PAGE, 'utf8')
  assert.ok(equivalentEntry(page, CANCEL_SPEC), '页面必须直载共享屏等价入口')
  assert.equal(
    equivalentEntry(
      page.replace(
        /^import[^\n]*@ihui\/rn-app\/features\/account-cancel\/AccountCancelScreen[^\n]*\n/m,
        '',
      ),
      CANCEL_SPEC,
    ),
    null,
    '阴性对照:摘掉入口行后不得仍判为薄壳',
  )
  assert.doesNotMatch(page, RENDER_TAG_RE, '页内不得残留小程序组件渲染段')
  assert.match(page, /<AccountCancelScreen/m, '页面必须渲染共享屏')

  assert.ok(page.includes(CANCEL_SUBPATH), '小程序页必须用具体子路径导入共享屏')
  assert.doesNotMatch(page, /from '@ihui\/rn-app'/m, '小程序页不得走桶入口')
  assert.ok(rn.includes(CANCEL_SUBPATH), 'RN 必须用具体子路径导入共享屏')
  assert.doesNotMatch(rn, /from '@ihui\/rn-app'/m, 'RN 不得走桶入口')
  // 阴性对照④:改回桶导入 ⇒ 桶断言必红
  assert.throws(() => {
    const barrel = rn.replace(`from '${CANCEL_SUBPATH}'`, "from '@ihui/rn-app'")
    assert.doesNotMatch(barrel, /from '@ihui\/rn-app'/m, 'negative:改回桶导入后不得仍通过')
  })

  // 两端都真传 consequences / phoneReadOnly
  assert.ok(propPassed(page, 'consequences'), '小程序页必须真传 consequences')
  assert.ok(propPassed(rn, 'consequences'), 'RN 必须真传 consequences')
  assert.ok(propPassed(page, 'phoneReadOnly'), '小程序页必须真传 phoneReadOnly')
  assert.ok(propPassed(rn, 'phoneReadOnly'), 'RN 必须真传 phoneReadOnly')
  assert.match(page, /phoneReadOnly=\{true\}/m, '小程序 phoneReadOnly 必须为 true(只读)')
  assert.match(rn, /phoneReadOnly=\{true\}/m, 'RN phoneReadOnly 必须为 true(同传)')

  // 7 项后果逐键两端都在(列表出现 = 可见差异)
  for (const key of CONSEQUENCE_KEYS) {
    assert.ok(page.includes(key), `小程序页缺后果键 ${key}`)
    assert.ok(rn.includes(`t('${key}')`), `RN 缺后果键 ${key}`)
  }
  // 无弹窗端的页级倒计时:小程序传 false,RN 传端内状态(值不同)
  assert.match(page, /showConfirmModal=\{false\}/m, '小程序必须关弹窗')
  assert.match(rn, /showConfirmModal=\{showConfirmModal\}/m, 'RN 必须传端内弹窗状态')

  // 阴性对照②:删小程序 consequences 传参 ⇒ 同尺子必不命中
  assert.throws(() => {
    const broken = page.replace(/^\s*consequences=\{[^\n]*\n/m, '')
    assert.ok(propPassed(broken, 'consequences'), 'negative:删小程序 consequences 后不得仍命中')
  })
  // 阴性对照③:删 RN phoneReadOnly 传参 ⇒ 同尺子必不命中
  assert.throws(() => {
    const broken = rn.replace(/^\s*phoneReadOnly=\{true\}\n/m, '')
    assert.ok(propPassed(broken, 'phoneReadOnly'), 'negative:删 RN phoneReadOnly 后不得仍命中')
  })
})

// T16 message 页部分收敛(2026-11-06):共享屏承担页头/通知横幅/搜索/tabs/空态/滚动容器,
// 页内保留五段缺段(聚合会话行/系统通知/私信列表/通知偏好面板/order·course 站内消息)。
// 阴性对照三枚:①摘页内 renderTabBody 传参 ⇒ 尺子不命中;②删 RN onDeleteConversation ⇒ 不命中;
// ③RN 改回桶导入 ⇒ 必红。
const MESSAGE_PAGE = join(ROOT, 'apps/miniapp-taro/src/pkg-user/message/index.tsx')
const MESSAGE_RN_PAGE = join(ROOT, 'apps/mobile-rn/src/screens/MessageCenterScreen.tsx')
const MESSAGE_SHARED = join(
  ROOT,
  'packages/app/src/features/message-center/MessageCenterScreen.tsx',
)
const MESSAGE_SPEC = ['packages/app/src/features/message-center/MessageCenterScreen.tsx']
const MESSAGE_SUBPATH = '@ihui/rn-app/features/message-center/MessageCenterScreen'
const MESSAGE_SLOTS = [
  'tabs',
  'renderTabBody',
  'search',
  'notification',
  'onPressSettings',
  'onToast',
]
const MESSAGE_RN_SLOTS = ['onDeleteConversation', 'onPressSettings', 'search', 'hasMore']

test('T16 message 页:入口被认 + 五段注入 + 槽位两端显式', () => {
  const page = readFileSync(MESSAGE_PAGE, 'utf8')
  const rn = readFileSync(MESSAGE_RN_PAGE, 'utf8')
  assert.ok(equivalentEntry(page, MESSAGE_SPEC), '页面必须直载共享屏等价入口')
  assert.equal(
    equivalentEntry(
      page.replace(
        /^import[^\n]*@ihui\/rn-app\/features\/message-center\/MessageCenterScreen[^\n]*\n/m,
        '',
      ),
      MESSAGE_SPEC,
    ),
    null,
    '阴性对照:摘掉入口行后不得仍判为薄壳',
  )
  assert.match(page, /<MessageCenterScreen/m, '页面必须渲染共享屏')
  // 共享屏已承担的段不得在页内重复渲染(零重复 UI 段)
  assert.doesNotMatch(page, /\bSearchBar\b/m, '搜索条已上收共享屏,页内不得重复')
  assert.doesNotMatch(page, /\bMessageTabs\b/m, 'tabs 已上收共享屏,页内不得重复')
  assert.doesNotMatch(page, /\bScrollView\b/m, '滚动容器已上收共享屏,页内不得重复')
  // 缺段表五段仍留页内(共享屏无对应整块)
  for (const seg of [
    'renderTabBody',
    'SystemNotice',
    'PrivateMessageList',
    'NotificationSettings',
    'InSiteMessagePane',
  ]) {
    assert.ok(page.includes(seg), `页内缺段 ${seg} 必须保留`)
  }
  for (const slot of MESSAGE_SLOTS) {
    assert.ok(propPassed(page, slot), `小程序页必须真传 ${slot}`)
  }

  assert.ok(page.includes(MESSAGE_SUBPATH), '小程序页必须用具体子路径导入共享屏')
  assert.doesNotMatch(page, /from '@ihui\/rn-app'/m, '小程序页不得走桶入口')
  assert.ok(rn.includes(MESSAGE_SUBPATH), 'RN 必须用具体子路径导入共享屏')
  assert.doesNotMatch(rn, /from '@ihui\/rn-app'/m, 'RN 不得走桶入口')
  for (const slot of MESSAGE_RN_SLOTS) {
    assert.ok(propPassed(rn, slot), `RN 必须真传 ${slot}`)
  }

  // 阴性对照①:摘页内 renderTabBody 传参 ⇒ 同尺子必不命中
  assert.throws(() => {
    const broken = page.replace(/\n\s*renderTabBody=\{renderTabBody\}/m, '')
    assert.ok(propPassed(broken, 'renderTabBody'), 'negative:删 renderTabBody 后不得仍命中')
  })
  // 阴性对照②:删 RN onDeleteConversation 传参 ⇒ 不命中
  assert.throws(() => {
    const broken = rn.replace(/\n\s*onDeleteConversation=\{[^\n]*\}/m, '')
    assert.ok(
      propPassed(broken, 'onDeleteConversation'),
      'negative:删 RN onDeleteConversation 后不得仍命中',
    )
  })
  // 阴性对照③:改回桶导入 ⇒ 必红
  assert.throws(() => {
    const barrel = rn.replace(`from '${MESSAGE_SUBPATH}'`, "from '@ihui/rn-app'")
    assert.doesNotMatch(barrel, /from '@ihui\/rn-app'/m, 'negative:改回桶导入后不得仍通过')
  })
})

test('T16b message 共享屏 i18n:小程序五语言逐键解析,不落裸 key/空串', () => {
  // sharedTKeys 的 t(' 正则会误吃 assertRequiredPort('onToast') ⇒ 只取词条命名空间内的键
  const keys = sharedTKeys(MESSAGE_SHARED).filter((k) => /^(messageCenter|common)\./.test(k))
  assert.ok(keys.length >= 12, `共享屏按键数不足:${keys.length}`)
  const map = parseCopyMap(readFileSync(MESSAGE_PAGE, 'utf8'))
  const mini = readLocales(MINI_LOCALES, keys, map, 'miniapp-taro')
  assert.equal(mini['miniapp-taro/zh-CN.json:messageCenter.title'], '消息')
  // 阴性对照:删新增键 messageCenter.markRead ⇒ 落地裸 key 必抛
  assert.throws(() => {
    const zh = JSON.parse(readFileSync(join(MINI_LOCALES, 'zh-CN.json'), 'utf8'))
    delete zh.messageCenter.markRead
    assertCopyResolvable(zh, keys, map, 'negative/zh-CN')
  })
})

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
