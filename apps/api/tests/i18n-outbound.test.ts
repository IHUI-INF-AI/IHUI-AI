// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * 台账号 G-815926 — 服务端 IM 出站/通知文案收进 `apiOutbound` 键族后的判据。
 *
 * 三条硬判据:
 *  ① 行为零变化:zh-CN 渲染值与旧源码硬编码**逐字相同**(原样钉死,改一个字都判红);
 *  ② 取词出口:插值参数替换正确、缺键回退 zh-CN、终极回退 = 键名;
 *  ③ 五语言同枚:api/*.json 的 apiOutbound 键集五端逐键一致(parity 门之外的本仓内对照)。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  OUTBOUND_HARD_CUT_MARK,
  OUTBOUND_MAX_CHARS_PER_SEGMENT,
  applyFoldToOutcome,
  classifyTransportError,
  interpretPlatformResponse,
  outboundFoldNotice,
  planOutboundMessages,
} from '../src/services/im-outbound-policy.js'
import { normalizeOutboundLocale, t } from '../src/services/i18n-outbound.js'

const LOCALES = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko'] as const

function loadApiMessages(locale: string): Record<string, unknown> {
  const file = fileURLToPath(
    new URL(`../../../packages/i18n/messages/api/${locale}.json`, import.meta.url),
  )
  return JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>
}

function flattenKeys(node: unknown, prefix = ''): string[] {
  if (node === null || typeof node !== 'object' || Array.isArray(node)) return [prefix]
  return Object.entries(node as Record<string, unknown>).flatMap(([k, v]) =>
    flattenKeys(v, prefix ? `${prefix}.${k}` : k),
  )
}

describe('G-815926 ① 行为零变化:zh-CN 渲染值与旧硬编码逐字相同', () => {
  it('折叠告知模板(旧:im-outbound-policy.ts 源码常量)', () => {
    expect(outboundFoldNotice(3)).toBe('\n\n【内容过长】剩余 3 段因超出单次上限未发送。')
    expect(OUTBOUND_HARD_CUT_MARK).toBe('……（接下一段）')
  })

  it('折叠结论 reason(旧:applyFoldToOutcome 源码模板)', () => {
    const delivered = {
      ok: true,
      status: 'delivered' as const,
      providerMessageId: 'm1',
      retryable: false,
      attempts: 1,
    }
    expect(applyFoldToOutcome(delivered, 2).reason).toBe(
      '内容超出单次段数上限,剩余 2 段未投递(已在末段告知)',
    )
  })

  it('平台结论 reason(旧:interpretPlatformResponse / classifyTransportError 源码模板)', () => {
    expect(interpretPlatformResponse(500, '').reason).toBe('平台返回 HTTP 500')
    expect(interpretPlatformResponse(500, '{"errcode":42}').reason).toBe(
      '平台返回 HTTP 500 code=42',
    )
    expect(interpretPlatformResponse(200, '{"code":4001,"msg":"bad token"}').reason).toBe(
      '平台业务拒绝 code=4001 bad token',
    )
    expect(classifyTransportError(new Error('boom')).reason).toBe('投递异常: boom')
  })
})

describe('G-815926 ② 取词出口 t():插值与回退', () => {
  it('插值参数替换正确(数字与字符串)', () => {
    expect(t('apiOutbound.adapterMissing', { platform: 'feishu' })).toBe('未配置 feishu 适配器')
    expect(t('apiOutbound.circuitOpen', { seconds: 60 })).toContain('60s 后放行一次探测')
    expect(t('apiOutbound.deliveryError', { message: 'x' })).toBe('投递异常: x')
  })

  it('缺键回退 zh-CN:未知 locale 取不到 ⇒ 落回 zh-CN 同键值', () => {
    const expected = '\n\n【内容过长】剩余 1 段因超出单次上限未发送。'
    expect(t('apiOutbound.foldNotice', { count: 1 }, 'xx-XX')).toBe(expected)
    expect(t('apiOutbound.foldNotice', { count: 1 }, 'zh-CN')).toBe(expected)
  })

  it('终极回退 = 键名(文案缺失不得抛错、不得返回 undefined)', () => {
    expect(t('apiOutbound.__noSuchKey__')).toBe('apiOutbound.__noSuchKey__')
    expect(t('apiOutbound.__noSuchKey__', { a: 1 }, 'ja')).toBe('apiOutbound.__noSuchKey__')
  })
})

/**
 * ④ **按-locale-取词这条主路径的正向覆盖**(G-1058621,2026-10-05 补)。
 *
 * 为什么必须有这一组:本文件原有两条带 `locale` 的测试(`:80` 未知 locale 回落 / `:86` 终极回退)
 * **都在验"取不到时怎么办"** —— 没有任何一条验"传一个**真实存在**的 locale 能拿到该语言的文案"。
 * 后果不是"覆盖率低"这么软:`ja.json`/`ko.json` 里那 65 个 `apiOutbound` 叶子
 * **在测试里从未被渲染过一次**;于是把 `ja` 误写成 `jp`、把 `zh-CN` 误写成 `zh_CN` 这类
 * locale 拼写错,会**静默回落到 zh-CN 而测试照样全绿** —— 错语言上线了也没有任何测试能发现。
 *
 * 两条断言都要有,缺一条就漏一类退化:
 *  - `toBe(期望)`:钉住"确实拿到了那个 locale 的字面量";
 *  - `not.toBe(zh-CN 同键值)`:防"静默回落冒充通过" —— 只钉 `toBe` 的话,
 *    哪天词包被误改回 zh-CN 值,断言会在"期望值跟着一起变"时一起通过。
 * 期望值**从词包现读**(不硬编码字面量):翻译更新时本测试跟着走,不会假红;
 * 真正要抓的是"取词时用错了 locale",不是"某个字面量被改了"。
 */
describe('G-1058621 ④ 取词出口正向:真实 locale 必须取到该语言(不是静默回落 zh-CN)', () => {
  const SAMPLES = [
    { key: 'apiOutbound.foldNotice', params: { count: 1 } },
    { key: 'apiOutbound.adapterMissing', params: { platform: 'feishu' } },
  ] as const

  for (const { key, params } of SAMPLES) {
    it(`${key} @ ${LOCALES.slice(1).join('/')} 四面各自取到本语言值`, () => {
      const zhCn = t(key, params, 'zh-CN')
      for (const locale of LOCALES.slice(1)) {
        const got = t(key, params, locale)
        // 期望值从词包**现读模板**再渲染一遍(与 t() 走同一套占位符替换)
        const expected = renderWith(rawTemplate(locale, key), params)
        expect(got, `${locale} @ ${key}`).toBe(expected)
        expect(got, `${locale} @ ${key} 静默回落成了 zh-CN`).not.toBe(zhCn)
      }
    })
  }

  it('locale 拼写错误必须**不被当成合法 locale**(否则错语言上线无测试可发现)', () => {
    // `jp` 是常见误写(日本国码是 ja)。若将来有人给 t() 加"宽松匹配",这一条会翻红。
    const bogus = t('apiOutbound.foldNotice', { count: 1 }, 'jp')
    const zhCn = t('apiOutbound.foldNotice', { count: 1 }, 'zh-CN')
    // 现读行为:未知 locale 一律回落 zh-CN ⇒ 值相等。**钉的是"回落"这个已知行为**,
    // 而不是"报错" —— 取词出口的设计就是缺键/缺面都不得抛错(见 i18n-outbound.ts 头注)。
    expect(bogus).toBe(zhCn)
    // 但**合法 locale 必须真的不同**:这一条才有意义 —— 若两句都回落,上面那组正向测试就全红了
    expect(t('apiOutbound.foldNotice', { count: 1 }, 'ja')).not.toBe(zhCn)
  })
})

/**
 * ⑤ locale 归一化 + 出站分段按用户语言渲染(G-1058621 拍板①「按用户语言」的落地判据)。
 *
 * 上一组(④)只证明 t() 收到合法 locale 时能取对词;这一组钉的是**真实调用方链路**:
 *  - `normalizeOutboundLocale` 把 user_preferences 里自由格式的 language 值归一到词包语言面,
 *    认不出一律 zh-CN(与 t() 的缺键回退同一条禁令,见 `:128` 对 `jp` 的判定);
 *  - `planOutboundMessages` 是硬切标记/折叠告知进入**出站正文**的唯一通道,locale 必须真的
 *    影响正文渲染;且不传 locale 时与旧实现逐字同值(界下零行为变化)。
 */
describe('G-1058621 ⑤ locale 归一化 + 出站分段按用户语言渲染', () => {
  it('normalizeOutboundLocale:精确命中(大小写/连接符不敏感)', () => {
    expect(normalizeOutboundLocale('ja')).toBe('ja')
    expect(normalizeOutboundLocale('JA')).toBe('ja')
    expect(normalizeOutboundLocale('zh_TW')).toBe('zh-TW')
    expect(normalizeOutboundLocale('zh-cn')).toBe('zh-CN')
  })

  it('normalizeOutboundLocale:主子标签前缀命中(en-US → en)', () => {
    expect(normalizeOutboundLocale('en-US')).toBe('en')
    expect(normalizeOutboundLocale('ja-JP')).toBe('ja')
    expect(normalizeOutboundLocale('ko-KR')).toBe('ko')
    expect(normalizeOutboundLocale('zh')).toBe('zh-CN')
  })

  it('normalizeOutboundLocale:认不出/空值一律 zh-CN(防拼错 locale 静默变成错语言)', () => {
    expect(normalizeOutboundLocale('jp')).toBe('zh-CN')
    expect(normalizeOutboundLocale('fr-FR')).toBe('zh-CN')
    expect(normalizeOutboundLocale('')).toBe('zh-CN')
    expect(normalizeOutboundLocale('   ')).toBe('zh-CN')
    expect(normalizeOutboundLocale(null)).toBe('zh-CN')
    expect(normalizeOutboundLocale(undefined)).toBe('zh-CN')
  })

  it('planOutboundMessages 传 locale:硬切标记按该语言渲染进正文,不得静默回落 zh-CN', () => {
    const text = '长'.repeat(OUTBOUND_MAX_CHARS_PER_SEGMENT * 2)
    const { rendered } = planOutboundMessages({ messageType: 'text', text }, { locale: 'ja' })
    expect(rendered).not.toBeNull()
    expect(rendered!.hardCutCount).toBe(1)
    const markJa = renderWith(rawTemplate('ja', 'apiOutbound.hardCutMark'), {})
    const markZh = renderWith(rawTemplate('zh-CN', 'apiOutbound.hardCutMark'), {})
    expect(markJa).not.toBe(markZh)
    // 第 2 段与第 1 段之间是硬切接缝 ⇒ 左段(第 2 段)末尾带**本语言**硬切标记
    expect(rendered!.messages[1]!.endsWith(markJa)).toBe(true)
    expect(rendered!.messages[1]!.endsWith(markZh)).toBe(false)
  })

  it('planOutboundMessages 传 locale:折叠告知按该语言渲染(出站文案 = 用户收到的正文)', () => {
    const text = '字'.repeat(OUTBOUND_MAX_CHARS_PER_SEGMENT * 3)
    const { rendered } = planOutboundMessages({ messageType: 'text', text }, { maxSegments: 2, locale: 'ko' })
    expect(rendered).not.toBeNull()
    expect(rendered!.omittedSegmentCount).toBe(1)
    const noticeKo = renderWith(rawTemplate('ko', 'apiOutbound.foldNotice'), { count: 1 })
    expect(rendered!.messages.at(-1)!.endsWith(noticeKo)).toBe(true)
    // 防静默回落冒充通过:同一条正文在 zh-CN 下的结尾必须**不同**
    const noticeZh = renderWith(rawTemplate('zh-CN', 'apiOutbound.foldNotice'), { count: 1 })
    expect(noticeKo).not.toBe(noticeZh)
  })

  it('planOutboundMessages 不传 locale:与旧实现逐字同值(界下零行为变化)', () => {
    const text = '长'.repeat(OUTBOUND_MAX_CHARS_PER_SEGMENT * 3)
    const { rendered } = planOutboundMessages({ messageType: 'text', text }, { maxSegments: 2 })
    expect(rendered).not.toBeNull()
    // 硬切标记 = 模块常量 OUTBOUND_HARD_CUT_MARK(旧实现同源);折叠告知 = outboundFoldNotice
    // (旧实现同一函数)—— 不传 locale 时渲染值必须与二者逐字相同。
    expect(rendered!.messages[1]).toContain(OUTBOUND_HARD_CUT_MARK)
    expect(rendered!.messages.at(-1)!.endsWith(outboundFoldNotice(1))).toBe(true)
  })
})

/** 从词包取模板原文(`{count}` / `{platform}` 保持未替换)。 */
function rawTemplate(locale: string, key: string): string {
  const tree = loadApiMessages(locale).apiOutbound
  return key
    .split('.')
    .slice(1)
    .reduce<unknown>(
      (node, seg) =>
        node && typeof node === 'object' && !Array.isArray(node)
          ? (node as Record<string, unknown>)[seg]
          : undefined,
      tree,
    ) as string
}

/** 与 `i18n-outbound.ts` 的插值规则同形:`{name}` 占位,未提供的原样保留。 */
function renderWith(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (ph, name: string) =>
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : ph,
  )
}

describe('G-815926 ③ 五语言同枚', () => {
  it('api/*.json 的 apiOutbound 键集五端逐键一致', () => {
    const keySets = LOCALES.map((locale) =>
      flattenKeys(loadApiMessages(locale).apiOutbound).sort(),
    )
    for (const locale of LOCALES.slice(1)) {
      expect(keySets[0]).toEqual(keySets[LOCALES.indexOf(locale)])
    }
    // 防空扫:键族必须有实质内容(枚举到 0 键 = 判据失明)
    expect(keySets[0].length).toBeGreaterThan(50)
  })
})
