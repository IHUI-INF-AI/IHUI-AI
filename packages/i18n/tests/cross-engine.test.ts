// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D101 跨引擎一致性夹具:同一 pattern × locale × params,本解释器输出必须与
// intl-messageformat(即 next-intl web 端底层渲染引擎)逐字符相同。
// 子集边界(offset/skeleton/缺 other/转义)在 icu.test.ts 覆盖,本表只收录合法子集用例。

import { IntlMessageFormat } from 'intl-messageformat'
import { describe, expect, it } from 'vitest'

import { formatIcu } from '../src/icu'

type Params = Record<string, string | number>

interface Case {
  name: string
  pattern: string
  locale: string
  params: Params
}

function reference(pattern: string, locale: string, params: Params): string {
  return new IntlMessageFormat(pattern, locale).format(params) as string
}

const LOCALES = ['zh-CN', 'en', 'ja', 'ko', 'zh-TW'] as const

const SELECT = '{state, select, running {RUN} completed {DONE} other {PEND}}'
const SELECT_NESTED =
  '{state, select, running {执行:{name}} completed {已完成:{name}} other {待定:{name}}}'
const PLURAL_EXACT = '{count, plural, =0 {none} =1 {one} other {# items}}'
const PLURAL_EN = '{count, plural, one {# message} other {# messages}}'
const PLURAL_NESTED =
  '{count, plural, =0 {none} other {{state, select, running {running #} other {idle #}}}}'
const ORDINAL = '{n, selectordinal, one {#st} two {#nd} few {#rd} other {#th}}'
const NUMBER = '共{v, number}条'
const CLI_ZH = '恢复最近会话:{id}({count, plural, =0 {无历史} other {{count}条历史}})'
const CLI_EN = 'Resumed:{id}({count, plural, =0 {none} one {# msg} other {# msgs}})'
const SHARED_ZH =
  '{state, select, running {正在执行:{name}} completed {已完成:{name}} other {执行:{name}}}'

const CASES: Case[] = [
  ...LOCALES.flatMap((locale): Case[] => [
    { name: `select/${locale}/running`, pattern: SELECT, locale, params: { state: 'running' } },
    { name: `select/${locale}/other`, pattern: SELECT, locale, params: { state: 'zzz' } },
    {
      name: `select-nested/${locale}`,
      pattern: SELECT_NESTED,
      locale,
      params: { state: 'completed', name: '相册' },
    },
    { name: `plural-exact/${locale}/0`, pattern: PLURAL_EXACT, locale, params: { count: 0 } },
    { name: `plural-exact/${locale}/1`, pattern: PLURAL_EXACT, locale, params: { count: 1 } },
    { name: `plural-exact/${locale}/5`, pattern: PLURAL_EXACT, locale, params: { count: 5 } },
    {
      name: `plural-nested/${locale}`,
      pattern: PLURAL_NESTED,
      locale,
      params: { count: 3, state: 'running' },
    },
    { name: `number/${locale}`, pattern: NUMBER, locale, params: { v: 1234567.89 } },
    { name: `shared-shape/${locale}`, pattern: SHARED_ZH, locale, params: { state: 'running', name: 'N' } },
  ]),
  { name: 'plural-en/1', pattern: PLURAL_EN, locale: 'en', params: { count: 1 } },
  { name: 'plural-en/2', pattern: PLURAL_EN, locale: 'en', params: { count: 2 } },
  { name: 'plural-en/0', pattern: PLURAL_EN, locale: 'en', params: { count: 0 } },
  { name: 'ordinal-en/1', pattern: ORDINAL, locale: 'en', params: { n: 1 } },  { name: 'ordinal-en/2', pattern: ORDINAL, locale: 'en', params: { n: 2 } },
  { name: 'ordinal-en/3', pattern: ORDINAL, locale: 'en', params: { n: 3 } },
  { name: 'ordinal-en/4', pattern: ORDINAL, locale: 'en', params: { n: 4 } },
  { name: 'ordinal-en/11', pattern: ORDINAL, locale: 'en', params: { n: 11 } },
  {
    name: 'cli-zh/0',
    pattern: CLI_ZH,
    locale: 'zh-CN',
    params: { id: 'a1', count: 0 },
  },
  {
    name: 'cli-zh/3',
    pattern: CLI_ZH,
    locale: 'zh-CN',
    params: { id: 'a1', count: 3 },
  },
  { name: 'cli-en/1', pattern: CLI_EN, locale: 'en', params: { id: 'a1', count: 1 } },
  { name: 'cli-en/7', pattern: CLI_EN, locale: 'en', params: { id: 'a1', count: 7 } },
  {
    name: 'ordinal-exact-en/1',
    pattern: '{n, selectordinal, =1 {first!} one {#st} other {#th}}',
    locale: 'en',
    params: { n: 1 },
  },
  {
    name: 'ordinal-exact-en/2',
    pattern: '{n, selectordinal, =1 {first!} one {#st} other {#th}}',
    locale: 'en',
    params: { n: 2 },
  },
  {
    name: 'number-percent-en',
    pattern: '{v, number, percent}',
    locale: 'en',
    params: { v: 0.25 },
  },
  {
    name: 'number-percent-zh',
    pattern: '{v, number, percent}',
    locale: 'zh-CN',
    params: { v: 0.25 },
  },
]

describe('跨引擎一致性: formatIcu ≡ intl-messageformat(next-intl 底层)', () => {
  for (const c of CASES) {
    it(c.name, () => {
      expect(formatIcu(c.pattern, c.params, { locale: c.locale })).toBe(
        reference(c.pattern, c.locale, c.params),
      )
    })
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
