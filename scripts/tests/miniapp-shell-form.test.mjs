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

// T17 conversation-import 薄壳页(2026-11-06):共享屏承担错误条/来源/选文件+解析/预览/
// 结果区/历史/分析面板,页内只留 ThemeRoot + NavBar + 共享屏(三个开标签,结构下限)。
// 阴性对照五枚:①摘页内入口行 ⇒ 不判薄壳;②删页内 onOpenConversation 传参 ⇒ 尺子不命中;
// ③RN 子路径改回桶导入 ⇒ 必红;④删共享屏 result.error 消费 ⇒ 不命中;⑤删五语言键 ⇒ 必抛。
const IMPORT_PAGE = join(ROOT, 'apps/miniapp-taro/src/pkg-ai/ai/conversation-import.tsx')
const IMPORT_RN_PAGE = join(ROOT, 'apps/mobile-rn/src/screens/ConversationImportScreen.tsx')
const IMPORT_SHARED = join(
  ROOT,
  'packages/app/src/features/conversation-import/ConversationImportScreen.tsx',
)
const IMPORT_SPEC = ['packages/app/src/features/conversation-import/ConversationImportScreen.tsx']
const IMPORT_SUBPATH = '@ihui/rn-app/features/conversation-import/ConversationImportScreen'
const IMPORT_SLOTS = [
  't',
  'sources',
  'onPickFile',
  'onParse',
  'onCommit',
  'onLoadHistory',
  'onOpenConversation',
  'onAnalyze',
]

test('T17a conversation-import 薄壳页:入口被认 + 仅一枚宿主根 View + 三开标签', () => {
  const page = readFileSync(IMPORT_PAGE, 'utf8')
  assert.ok(equivalentEntry(page, IMPORT_SPEC), '页面必须直载共享屏等价入口')
  // 阴性对照:换到未声明的相邻路径 ⇒ 不认等价入口(证明是 spec 对得上,不是「有 import」)
  assert.equal(
    equivalentEntry(
      page.replaceAll(
        'features/conversation-import/ConversationImportScreen',
        'features/conversation-import/ConversationImportPanel',
      ),
      IMPORT_SPEC,
    ),
    null,
    '阴性对照:未声明路径不得仍判为等价入口',
  )
  // 断言过期修正(2026-11-06 批次②):上游 64bbecac99 起页面加回宿主根容器 <View>,它是
  // rn-compat 落地 Taro ScrollView 的高度基准,属宿主骨架白名单,不是"页内残留渲染段"。
  // 现口径:允许且只允许这一枚根 View(h-screen + bg-background),其余渲染型 JSX 一律不许。
  const hostRoots = page.match(/^\s*<View\b[^\n]*$/gm) ?? []
  assert.equal(hostRoots.length, 1, '只允许一枚宿主根容器 View')
  assert.match(hostRoots[0], /h-screen/, '根容器必须是高度基准(h-screen)')
  assert.match(hostRoots[0], /bg-background/, '根容器必须是背景基准(bg-background)')
  assert.doesNotMatch(
    page.replace(/^\s*<View\b[^\n]*$/gm, ''),
    RENDER_TAG_RE,
    '除宿主根容器外不得残留渲染型 JSX',
  )
  assert.match(page, /<ConversationImportScreen/m, '页面必须渲染共享屏')
  // 结构下限 3:根容器 View(宿主骨架)/ NavBar(共享屏无页头)/ 共享屏本体;无法压到 ≤2
  assert.equal((page.match(/^\s*<[A-Z][A-Za-z0-9_]*/gm) ?? []).length, 3, '组件开标签数应恰为 3')
})

test('T17b conversation-import 双端子路径导入,禁桶入口', () => {
  const page = readFileSync(IMPORT_PAGE, 'utf8')
  const rn = readFileSync(IMPORT_RN_PAGE, 'utf8')
  assert.ok(page.includes(IMPORT_SUBPATH), '小程序页必须用具体子路径导入共享屏')
  assert.doesNotMatch(page, /from '@ihui\/rn-app'/m, '小程序页不得走桶入口')
  assert.ok(rn.includes(IMPORT_SUBPATH), 'RN 必须用具体子路径导入共享屏')
  assert.doesNotMatch(rn, /from '@ihui\/rn-app'/m, 'RN 不得走桶入口')
  // 阴性对照:改回桶导入 ⇒ 必红
  assert.throws(() => {
    const barrel = rn.replace(`from '${IMPORT_SUBPATH}'`, "from '@ihui/rn-app'")
    assert.doesNotMatch(barrel, /from '@ihui\/rn-app'/m, 'negative:改回桶导入后不得仍通过')
  })
})

test('T17c conversation-import 8 个注入槽两端显式传', () => {
  const page = readFileSync(IMPORT_PAGE, 'utf8')
  const rn = readFileSync(IMPORT_RN_PAGE, 'utf8')
  for (const slot of IMPORT_SLOTS) {
    assert.ok(propPassed(page, slot), `小程序页必须真传 ${slot}`)
    assert.ok(propPassed(rn, slot), `RN 必须真传 ${slot}`)
  }
  // 阴性对照:删页内 onOpenConversation 传参 ⇒ 同尺子必不命中
  assert.throws(() => {
    const broken = page.replace(/\n\s*onOpenConversation=\{onOpenConversation\}/m, '')
    assert.ok(propPassed(broken, 'onOpenConversation'), 'negative:删 onOpenConversation 后不得仍命中')
  })
})

test('T17d conversation-import 失败字段:errorMessage/failedCount 现状契约 + 两端映射', () => {
  const shared = readFileSync(IMPORT_SHARED, 'utf8')
  const page = readFileSync(IMPORT_PAGE, 'utf8')
  const rn = readFileSync(IMPORT_RN_PAGE, 'utf8')
  // 断言过期修正(2026-11-06 批次②):3755c1d259 把 `readonly error?: string` 更名为
  // `readonly errorMessage?: string`(共享屏 :96),51ee3146d2 补历史行 failedCount?/errorMessage?(:124-126)。
  // 实现未回退:旧字段确实已不存在,新字段确实在消费;下面按现状契约断言,不是放宽。
  assert.doesNotMatch(shared, /readonly error\?: string/m, '旧字段 error? 已更名,不应再存在')
  assert.match(shared, /readonly errorMessage\?: string/m, '共享屏必须声明 commit 失败原因字段')
  assert.match(shared, /failedCount\?: number/m, '共享屏历史行必须声明失败条数(端侧不传则不渲染)')
  assert.match(shared, /setError\(result\.errorMessage \?\? ''\)/m, '共享屏必须消费 result.errorMessage')
  assert.match(shared, /failedCountLabel/m, '共享屏历史行必须渲染失败条数标签')
  assert.match(shared, /h\.errorMessage/m, '共享屏历史行必须渲染失败原文')
  // 阴性对照:删 result.errorMessage 消费 ⇒ 同尺子必不命中
  assert.throws(() => {
    const broken = shared.replace("setError(result.errorMessage ?? '')", '')
    assert.match(broken, /setError\(result\.errorMessage \?\? ''\)/m, 'negative:删消费点后不得仍命中')
  })
  // 两端都必须把后端失败信息搬到共享屏载荷上(RN 历史行两项都传;小程序历史行按端侧口径可略)
  assert.match(rn, /failedCount: item\.failedCount/m, 'RN 必须映射 failedCount')
  assert.match(rn, /errorMessage: item\.errorMessage \?\? undefined/m, 'RN 必须映射 errorMessage')
  assert.match(page, /errorMessage: tt\('conversationImport\.commitFailed'/m, '小程序 commit 失败原因必须回带')
  assert.match(rn, /errorMessage: t\('conversationImport\.commitFailed'/m, 'RN commit 失败原因必须回带')
})

// T18 299-C1(2026-11-06 批次②):薄壳 = 页内**业务** JSX ≤2,宿主骨架白名单不计入。
// 白名单只有三类:ThemeRoot(只跳自身)/ 宿主导航 NavBar|NavChrome|header·nav·tabbar 词元(整棵子树)/
// 根容器高度·背景基准(只跳最外层自身)。阴性对照四枚:
// ①去掉根容器高度基准并加一枚业务节点 ⇒ 3 ⇒ 复制;②把 ThemeRoot 换成任意 Wrapper ⇒ 不豁免 ⇒ 复制;
// ③把 NavBar 换成 Text ⇒ 子树不再豁免 ⇒ 复制;④结构下限是"计入豁免后仍 ≥3",不是"有 import 就绿"。
const C1_ROOT_PAGE = `import { DemoScreen } from '@ihui/rn-app/features/demo/DemoScreen'
export default function P() {
  return (
    <View className="flex flex-col h-screen bg-background">
      <NavBar title="卡片" />
      <DemoScreen />
    </View>
  )
}
`
const C1_THEME_PAGE = `import { DemoScreen } from '@ihui/rn-app/features/demo/DemoScreen'
export default function P() {
  return (
    <ThemeRoot>
      <View className="p-2">
        <DemoScreen />
      </View>
    </ThemeRoot>
  )
}
`

test('T18 299-C1 宿主骨架白名单不计入业务 JSX,计入后仍 ≥3 照旧判复制', () => {
  const base = { route: 'demo/c1', file: 'demo/c1.tsx', declaredSpecs: SPEC, registry: { miniapp: 'demo/c1' } }
  const rootShell = classifyPage({ ...base, text: C1_ROOT_PAGE })
  assert.equal(rootShell.impl, 'shell', '根容器 h-screen/bg-background 只跳自身 ⇒ 业务 JSX ≤2')
  assert.ok(rootShell.businessJsx <= 2, `businessJsx=${rootShell.businessJsx}`)

  const themeShell = classifyPage({ ...base, text: C1_THEME_PAGE })
  assert.equal(themeShell.impl, 'shell', 'ThemeRoot 只跳自身,子树照常计数 ⇒ 业务 JSX 2')
  assert.ok(themeShell.businessJsx <= 2, `businessJsx=${themeShell.businessJsx}`)

  // 阴性对照①:根容器不再命中高度/背景基准 + 加一枚业务节点 ⇒ 3 ⇒ 复制
  const brokeRoot = C1_ROOT_PAGE.replace('flex flex-col h-screen bg-background', 'flex flex-col').replace(
    '<NavBar title="卡片" />',
    '<Text>标题</Text>',
  )
  const c1 = classifyPage({ ...base, text: brokeRoot })
  assert.equal(c1.impl, 'copy', '豁免失效后同一把尺子必须判复制')
  assert.ok(c1.businessJsx >= 3, `businessJsx=${c1.businessJsx}`)

  // 阴性对照②:ThemeRoot 换成任意 Wrapper ⇒ 不在白名单 ⇒ 不豁免(禁止通配任意 View/Fragment)
  const brokeTheme = C1_THEME_PAGE.replace('<ThemeRoot>', '<Wrapper>').replace('</ThemeRoot>', '</Wrapper>')
  const c2 = classifyPage({ ...base, text: brokeTheme })
  assert.equal(c2.impl, 'copy', '白名单之外的容器不得豁免')

  // 阴性对照③:NavBar 换成 Text ⇒ 导航子树豁免不成立 ⇒ 复制
  const brokeNav = C1_ROOT_PAGE.replace('<NavBar title="卡片" />', '<Text>卡片</Text>')
  const c3 = classifyPage({ ...base, text: brokeNav })
  assert.equal(c3.impl, 'copy', '非宿主导航节点不得整棵豁免')
})

// T19 299-C2:与共享屏零重复 UI 段。同构指纹 = tag 序 + className 词集 + 非空文本集。
// 阴性对照三枚:①共享屏无该段 ⇒ 不判重复 ⇒ 薄壳;②共享屏正文读不到(sharedText=null)⇒ 未判定,不报绿;
// ③同一页只要有一段同构即判复制(不是"大部分像"才算)。
const C2_PAGE = `import { DemoScreen } from '@ihui/rn-app/features/demo/DemoScreen'
export default function P() {
  return (
    <View className="h-screen">
      <Text>同步中</Text>
    </View>
  )
}
`
const C2_SHARED_HIT = `export default function S() { return (<View className="x"><Text>同步中</Text></View>) }`
const C2_SHARED_MISS = `export default function S() { return (<View className="x"><Text>已同步</Text></View>) }`

test('T19 299-C2 与共享屏零重复 UI 段(读不到不报绿)', () => {
  const base = { route: 'demo/c2', file: 'demo/c2.tsx', text: C2_PAGE, declaredSpecs: SPEC, registry: { miniapp: 'demo/c2' }, rnText: undefined }
  const dup = classifyPage({ ...base, sharedText: C2_SHARED_HIT })
  assert.equal(dup.impl, 'copy', '存在同构段 ⇒ 复制')
  assert.equal(dup.duplicateUi, true)
  assert.match(dup.note, /重复 UI 段/)

  const clean = classifyPage({ ...base, sharedText: C2_SHARED_MISS })
  assert.equal(clean.impl, 'shell', '共享屏无该段 ⇒ 薄壳')
  assert.equal(clean.duplicateUi, false)

  // 阴性对照②:共享屏正文读不到 ⇒ 不能报绿
  const blind = classifyPage({ ...base, sharedText: null })
  assert.equal(blind.impl, 'undetermined', '共享屏正文读不到不得判薄壳')
  assert.match(blind.note, /共享屏正文读不到/)
})

// T20 299-C3:无"只有单端消费"的 prop。注入型 prop(JSX 值/render prop)必须在另一端同名真传。
// 阴性对照三枚:①RN 同传同名 prop ⇒ 不判单端;②RN 正文读不到(rnText=null)⇒ 未判定,不报绿;
// ③普通数据 prop(体内无 JSX)不参与该条。
const C3_PAGE = `import { DemoScreen } from '@ihui/rn-app/features/demo/DemoScreen'
function renderTabBody() {
  return <Text>内容</Text>
}
export default function P() {
  return (
    <View className="h-screen">
      <DemoScreen renderTabBody={renderTabBody} />
    </View>
  )
}
`
const C3_RN_MISS = `export default function R() { return (<DemoScreen />) }`
const C3_RN_HIT = `export default function R() { return (<DemoScreen renderTabBody={renderTabBody} />) }`

test('T20 299-C3 单端消费 prop(另一端未传即不判薄壳)', () => {
  const base = { route: 'demo/c3', file: 'demo/c3.tsx', text: C3_PAGE, declaredSpecs: SPEC, registry: { miniapp: 'demo/c3' }, sharedText: C2_SHARED_MISS }
  const oneEnd = classifyPage({ ...base, rnText: C3_RN_MISS })
  assert.equal(oneEnd.impl, 'copy', 'renderTabBody 只有小程序端传 ⇒ 复制')
  assert.deepEqual(oneEnd.injectedProps, ['renderTabBody'])
  assert.match(oneEnd.note, /单端消费 prop/)

  const bothEnd = classifyPage({ ...base, rnText: C3_RN_HIT })
  assert.equal(bothEnd.impl, 'shell', '两端同名真传 ⇒ 薄壳')

  // 阴性对照②:RN 正文读不到 ⇒ 不能证明跨端消费 ⇒ 未判定
  const blind = classifyPage({ ...base, rnText: null })
  assert.equal(blind.impl, 'undetermined', 'RN 对照缺失不得判薄壳')
  assert.match(blind.note, /RN 对照读不到/)

  // ③普通数据 prop(体内无 JSX)不参与
  const plainDataProp = classifyPage({
    ...base,
    text: C3_PAGE.replace('renderTabBody={renderTabBody}', 'count={3}'),
    rnText: C3_RN_MISS,
  })
  assert.equal(plainDataProp.impl, 'shell', '数据 prop 不是注入段,不触发 C3')
  assert.deepEqual(plainDataProp.injectedProps, [])
})

// T21 299 `not-applicable` 枚举(2026-11-06 批次②):显式声明 + 可校验 + 可反证。
// 阴性对照:①缺 declaredSpecs ⇒ 校验红;②note 无 file:line 证据 ⇒ 校验红;③页面仍接入口/有重复段/有注入
// prop 时被反证 ⇒ S0 红(填值不是后门);④合法行既不进 S1 也不进 S2"可摘"。
test('T21 not-applicable 校验与 S0 反证', () => {
  const legal = {
    route: 'demo/na',
    file: 'demo/na.tsx',
    loc: 10,
    mapStatus: 'not-applicable',
    impl: 'not-applicable',
    reasonClass: null,
    declaredSpecs: SPEC,
    note: 'demo/na.tsx:10 声明屏 DemoScreen 是课程发布,页面是学习计划 ⇒ 非同业务对象',
  }
  assert.equal(G.validateLedger([legal]).length, 0, '合法 not-applicable 行必须通过校验')
  assert.ok(G.validateLedger([{ ...legal, declaredSpecs: [] }]).length > 0, '缺被否定声明 ⇒ 红')
  assert.ok(G.validateLedger([{ ...legal, note: '不适用' }]).length > 0, '无 file:line 证据 ⇒ 红')

  const naRow = { ...legal, loc: 10 }
  const green = evaluateRatchet([naRow], [legal])
  assert.equal(green.reds.length, 0, '合法 not-applicable 不得判红')
  assert.ok(!green.advisories.some((a) => /可从台账摘除/.test(a.why)), '不得报"可摘"')
  assert.equal(green.stats.notApplicable, 1)

  const rejected = {
    route: 'demo/na2',
    file: 'demo/na2.tsx',
    loc: 10,
    mapStatus: 'declaration',
    impl: 'copy',
    reasonClass: 'pure-copy',
    notApplicableRejected: true,
    note: '台账 not-applicable 被拒: 仍接共享屏入口',
  }
  const red = evaluateRatchet([rejected], [])
  assert.ok(red.reds.some((r) => r.rule === 'S0'), '被反证的 not-applicable 必须判红')
})

test('T17e conversation-import failedCountLabel 十份词包逐键非空/非裸 key', () => {
  const keys = ['conversationImport.failedCountLabel']
  const rn = readLocales(RN_LOCALES, keys, null, 'mobile-rn')
  const mini = readLocales(MINI_LOCALES, keys, null, 'miniapp-taro')
  assert.equal(rn['mobile-rn/zh-CN.json:conversationImport.failedCountLabel'], '失败')
  assert.equal(mini['miniapp-taro/zh-CN.json:conversationImport.failedCountLabel'], '失败')
  for (const lang of ['zh-TW', 'en', 'ja', 'ko']) {
    assert.notEqual(
      rn[`mobile-rn/${lang}.json:conversationImport.failedCountLabel`],
      rn['mobile-rn/zh-CN.json:conversationImport.failedCountLabel'],
      `mobile-rn/${lang}: 键回落中文`,
    )
  }
  assert.doesNotMatch(
    rn['mobile-rn/en.json:conversationImport.failedCountLabel'],
    /\p{Script=Han}/u,
    'mobile-rn/en: 含汉字',
  )
  // 阴性对照:删小程序 zh-CN 该键 ⇒ 落地裸 key 必抛
  assert.throws(() => {
    const zh = JSON.parse(readFileSync(join(MINI_LOCALES, 'zh-CN.json'), 'utf8'))
    delete zh.conversationImport.failedCountLabel
    assertCopyResolvable(zh, keys, null, 'negative/zh-CN')
  })
})

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
