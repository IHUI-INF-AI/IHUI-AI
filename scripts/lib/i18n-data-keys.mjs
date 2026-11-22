// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * i18n 数据驱动键族判据唯一实现(2026-11-22 立)。
 *
 * 立因(实测):侧边栏把导航项抽成数据表 `nav-data.ts`,渲染侧统一 `t(item.labelKey)`,
 * 于是「键」变成了**数据表里的一个字符串字段**,不再是 `t('字面量')` 的实参。
 * `check-i18n-keys.mjs` 只认字面量 + state 键流(traceKeyFlow),这一族整族落在射程外:
 * 全量跑报出 2006 条缺键、其中不含 nav.hrGroup / nav.financeAi / nav.eduHubTitle /
 * nav.contentHubTitle / nav.tradeHubTitle —— 而 SSR HTML 里这五枚就是原样键名。
 * 同型事故此前已有登记(G-1079148:UI 显示裸键名、门一路报绿),说明靠"再补一个门"
 * 不够,必须把「数据表字段 → 命名空间」这条判定链本身收成单一实现,门与审计同源(§0.6)。
 *
 * 本模块只做纯判据(零 IO、零副作用),取材由调用方按自己那一面读进来:
 *   - 消息集:调用方自行 merge(shared, target) 后传 merged
 *   - 源码:调用方自行按被审面取 blob(守门 118:取材面由调用方决定,本层不猜)
 *
 * 三态(AGENTS §0.3):
 *   'ok'            键在该命名空间可解析
 *   'missing-ns'    键存在但不在该命名空间下(渲染时同样是裸键;判据可判定时才给这一档)
 *   'missing-global' 全库任何路径都找不到该键名(必然裸键,不依赖命名空间推断)
 *   'undecidable'   命名空间静态不可知(来自 props/变量),且键在全局可找到 ⇒ 未判定,不记绿不冒红
 */

/**
 * 键字段名字面量(形如 labelKey: 'x')。只收字面量,模板串与变量一律跳过。
 *
 * 2026-11-22 修:原规则是"任何 `*Key` 字段" —— 把 `groupKey: 'operation'` 这类**非词条文案的
 * 技术键**也收进来(实测 admin-nav-groups 的 10 个分组 key 当场被误判成缺键)。改为白名单:
 * 字段名必须指向**给人看的文案**(label/title/desc/name/message/... + Key)才当作 i18n 键。
 * 漏收一个合法字段只会少判一处(门不误红),误收则每次提交都红 —— 方向必须偏向后者。
 */
export const KEY_FIELD_RE = /([A-Za-z_$][A-Za-z0-9_$]*Key)\s*:\s*(?:'([^']*)'|"([^"]*)"|`([^`]*)`)/g

/** KEY_FIELD_RE 的字段名白名单(小写前缀比较;`*Key` 后缀由正则保证) */
const HUMAN_TEXT_KEY_PREFIX =
  /^(label|title|desc|description|name|message|msg|text|hint|placeholder|tooltip|aria|badge|empty|error|success|help|subtitle|caption|tip|note|unit|option|action|reason|status|tab|section|menu|heading|header|footer|cta|alt|summary|detail|toast|dialog|modal|i18n)$/i

function isHumanTextKeyField(field) {
  return HUMAN_TEXT_KEY_PREFIX.test(field.slice(0, -3)) // 去掉结尾的 "Key"
}

/**
 * `const t = useTranslations('nav')` / `const tc = getTranslations()` 一类的映射。
 * 只认"标识符直接接调用",`const { t } = ...` 这种解构形态收不到(会落 undecidable,不会被误判绿)。
 */
export const TRANSLATOR_DECL_RE =
  /(?:const|let|var)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*(?:useTranslations|getTranslations)[A-Za-z]*\s*\(\s*(?:'([^']*)'|"([^"]*)"|`([^`]*)`)?\s*\)/g

/** 任意 `xxx(` 调用里出现 `<field>` 或 `<a.b>.field` 的实参位置 */
function callArgRe(field) {
  return new RegExp(
    `(?:^|[^A-Za-z0-9_$])([A-Za-z_$][A-Za-z0-9_$]*)\\s*\\(\\s*(?:[A-Za-z_$][A-Za-z0-9_$.]*\\.)*${field}\\s*(?:[,)\`])`,
    'g',
  )
}

/** 按点分路径取字符串值;取不到返回 undefined */
export function getMessageByPath(messages, key) {
  if (!messages || typeof key !== 'string' || !key) return undefined
  const parts = key.split('.')
  let cur = messages
  for (const p of parts) {
    if (cur === null || typeof cur !== 'object') return undefined
    cur = cur[p]
  }
  return cur
}

/** 值在全库任意路径下是否作为字符串存在(用于 missing-global 判定,与命名空间无关) */
export function existsAnywhere(messages, value) {
  if (typeof value !== 'string' || !value) return false
  if (typeof getMessageByPath(messages, value) === 'string') return true
  const parts = value.split('.')
  const leaf = parts[parts.length - 1]
  const stack = [messages]
  while (stack.length) {
    const node = stack.pop()
    if (!node || typeof node !== 'object') continue
    for (const k of Object.keys(node)) {
      if (k === leaf && typeof node[k] === 'string') return true
      if (node[k] && typeof node[k] === 'object' && !Array.isArray(node[k])) stack.push(node[k])
    }
  }
  return false
}

/**
 * 从一个源文件里抽出「数据驱动键引用」。
 *
 * @param {string} src 源文件正文
 * @returns {{
 *   translators: Map<string, string|null>,   // 变量名 -> 命名空间(null = 无参/动态)
 *   refs: Array<{field:string, value:string, vars:string[], namespaces:Array<string|null>, decidable:boolean}>
 * }}
 */
export function extractKeyRefs(src, opts = {}) {
  const registered = Array.isArray(opts.registeredNamespaces)
    ? opts.registeredNamespaces.filter((n) => typeof n === 'string' && n)
    : []
  // 第三档开关:未登记的数据表也产出引用(缺就红),由 check-i18n-data-keys.mjs 显式开启
  const orphanDataKeys = Boolean(opts.orphanDataKeys)
  const translators = new Map()
  for (const m of src.matchAll(TRANSLATOR_DECL_RE)) {
    const name = m[1]
    const ns = m[2] ?? m[3] ?? m[4]
    translators.set(name, ns === undefined ? null : ns)
  }

  const fieldValues = new Map() // field -> Set<value>
  for (const m of src.matchAll(KEY_FIELD_RE)) {
    const field = m[1]
    const value = m[2] ?? m[3] ?? m[4]
    if (!value || value.includes('${')) continue
    if (!isHumanTextKeyField(field)) continue // groupKey / rowKey 这类技术键不是文案
    if (!fieldValues.has(field)) fieldValues.set(field, new Set())
    fieldValues.get(field).add(value)
  }

  const refs = []
  for (const [field, values] of fieldValues) {
    const re = callArgRe(field)
    const vars = new Set()
    for (const m of src.matchAll(re)) vars.add(m[1])
    if (vars.size === 0) {
      // 2026-11-22 修:纯数据模块(nav-data.ts 这类)根本不会在本文件里调 t() —— 消费发生在
      // 渲染侧别的文件。旧实现在这里直接 continue,于是登记表形同虚设,侧栏 218 个 labelKey
      // 整族在射程外(这就是"门一路报绿、页面照样显示 nav.hrGroup"的原样复现)。
      // 已登记的模块:字段值本身就当键判,命名空间取登记值。
      if (registered.length) {
        for (const value of values) {
          // 值可能自带完整路径('chat.x.y'),也可能只是相对子键 —— 两种都放进候选:
          // classifyRef 会先试 `登记ns.value`,再试 `value` 本身,谁命中算谁。
          refs.push({ field, value, vars: [], namespaces: registered, decidable: true, globalPath: value.includes('.') })
        }
      } else if (orphanDataKeys) {
        // 第三类漏网(2026-11-22 实测):数据表住 A 文件、t() 消费在 B 文件,且 A 未登记。
        // 旧实现直接 continue,于是 appearance-presets 的 nameKey/descKey 整族在射程外,
        // /settings/appearance 上照样画出 appearanceSettings.presetBuiltinDefault。
        // 这里不再静默丢弃:产出"未登记数据键"引用,由门按词库命中判(缺就红,要求登记或补键)。
        for (const value of values) {
          refs.push({ field, value, vars: [], namespaces: [], decidable: false, orphanData: true })
        }
      }
      continue
    }
    const consuming = [...vars].filter((v) => translators.has(v))
    // 消费变量全部不可静态归属(含 props 透传)⇒ 命名空间不可知
    const namespaces = consuming.length ? consuming.map((v) => translators.get(v)) : [null]
    const decidable =
      consuming.length > 0 && namespaces.every((ns) => typeof ns === 'string' && ns.length > 0)
    for (const value of values) refs.push({ field, value, vars: [...vars], namespaces, decidable })
  }
  return { translators, refs }
}

/**
 * 判定一条引用。
 *
 * @param {object} ref extractKeyRefs 产出的单条
 * @param {object} messages 合并后的消息集(已按被审面取好)
 * @param {string[]} extraNamespaces 数据模块登记过的候选命名空间(见 scripts/data/i18n-data-key-namespaces.json)
 * @returns {'ok'|'missing-ns'|'missing-global'|'undecidable'}
 */
export function classifyRef(ref, messages, extraNamespaces = []) {
  // 未登记数据表档:没有命名空间可归,只能问"这个键在全库任何地方存在吗"
  // (存在则该档由别的 ns 供词,不存在就是真裸键 —— 与 missing-global 同一结局)
  if (ref.orphanData) return existsAnywhere(messages, ref.value) ? 'ok' : 'missing-global'
  const candidates = []
  for (const ns of ref.namespaces)
    if (typeof ns === 'string' && ns) candidates.push(`${ns}.${ref.value}`)
  for (const ns of extraNamespaces) if (ns) candidates.push(`${ns}.${ref.value}`)
  candidates.push(ref.value)

  for (const c of candidates) {
    const v = getMessageByPath(messages, c)
    if (typeof v === 'string') return 'ok'
    // 容器命中(2026-11-22 实测):错误码表这类数据表存的 key 指向一棵子树
    // (`apiDocs.errorCodes.c1000.{meaning,fix}`),消费侧用模板串拼子键。容器存在即说明
    // 这一族有词,子键由模板串消费、不可静态判 —— 不再把它当"裸键"误红。
    if (v && typeof v === 'object' && !Array.isArray(v)) return 'ok'
  }
  if (!existsAnywhere(messages, ref.value)) return 'missing-global'
  // 键名在全库某处存在,但当前候选命名空间里没有
  if (ref.decidable || extraNamespaces.length) return 'missing-ns'
  return 'undecidable'
}

/**
 * 从一个源文件里抽出「字面量键引用」`t('xxx')` —— 与 extractKeyRefs 的字段族互补。
 *
 * 两类各管一半:字段族(`t(item.labelKey)`)是数据表驱动的键,字面量族是直接写在
 * 调用里的键。`check-i18n-keys.mjs` 覆盖了后者(但不含"值来自变量"的错命名空间),
 * 本函数用于让同一道门把两族一起判,避免两套判据漂移(§0.6)。
 *
 * @param {string} src
 * @returns {Array<{ns:string|null, key:string}>}
 */
export function extractLiteralRefs(src) {
  const { translators } = extractKeyRefs(src)
  const out = []
  for (const [v, ns] of translators) {
    const re = new RegExp(`(?:^|[^A-Za-z0-9_$])${v}\\s*\\(\\s*'([^']+)'`, 'g')
    for (const m of src.matchAll(re)) {
      if (m[1].includes('${')) continue
      out.push({ ns, key: m[1] })
    }
  }
  return out
}

/**
 * 第五形态(2026-11-22 实测补):常量映射表 `const ACCENT_LABEL_KEYS = { default: 'accentDefault', … }`
 * —— 字段名是"枚举值"、对象名带 KEY/LABEL 后缀,消费侧写 `t(OBJ[x])`。
 * `KEY_FIELD_RE` 抓不到(它只认 `xxxKey: 'v'`),`extractLiteralRefs` 也抓不到(值不在实参里),
 * 于是 /settings/appearance 的 accentDefault 整族在射程外、页面上照样是裸键。
 *
 * 三条同时成立才收(防把技术映射误收成文案):
 *   ① 对象名含 KEYS/LABELS/TEXT/I18N/TITLES/DESCS
 *   ② 同文件真有 `OBJ[` 消费
 *   ③ 同文件能静态取到 translator 命名空间
 */
export const CONST_KEY_MAP_RE =
  /const\s+([A-Za-z0-9_$]*(?:KEYS?|LABELS?|TEXT|I18N|TITLES?|DESCS?)[A-Za-z0-9_$]*)\s*=\s*\{([\s\S]*?)\}\s*(?:as const)?/g

export function extractConstMapRefs(src) {
  const { translators } = extractKeyRefs(src)
  const namespaces = [...translators.values()].filter((n) => typeof n === 'string' && n)
  if (!namespaces.length) return []
  const out = []
  for (const m of src.matchAll(CONST_KEY_MAP_RE)) {
    const obj = m[1]
    const body = m[2]
    if (!new RegExp(`(?:^|[^A-Za-z0-9_$])${obj}\\s*[\\[.]`).test(src)) continue
    for (const v of body.matchAll(/[A-Za-z0-9_$]+\s*:\s*'([^']+)'/g)) {
      const value = v[1]
      if (!value || value.includes('${') || !/^[A-Za-z][A-Za-z0-9_.]*$/.test(value)) continue
      out.push({ obj, value, namespaces, decidable: true })
    }
  }
  return out
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
