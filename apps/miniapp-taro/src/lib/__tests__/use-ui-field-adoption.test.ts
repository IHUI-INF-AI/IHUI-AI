// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 端内控件注册表「逐屏采纳」防漂移回归(2026-09-21)。
//
// 为什么要有这个文件:公共注册表自身有单测(ui-field-registry.test.ts),但"**业务屏有没有真的
// 把写通道交出来**"这件事一直没有断言 —— 组件删掉一行 `useUiField`,全量测试照样全绿,
// 而 AI 侧的症状是"这个框填不了"(无声的能力缺失)。
//
// 为什么不做实渲染:本端 vitest 是 environment=node,没有 jsdom / @testing-library 基架,
// 自己搭 DOM shim 去渲染整页业务组件(依赖 Taro API、i18n 压缩包、若干 provider)既脆弱又只
// 能证明"桩件能跑",不证明真机界面。所以这里用两类**能证伪**的断言组合,并把"未做真机渲染验证"
// 显式写在结论里(AGENTS §14:不能验证的事不写成已验证):
//   1. 源码级:每个采纳点必须交出 setValue,且那个 setter **就是** JSX 里 onInput 用的同一个 ——
//      这条同时排除了"塞一个 no-op 假装可写"(注册表会回 ok 而界面不动,正是本项目定性的假成功);
//   2. 注册表级:敏感/破坏性文案连快照都不出现、计量语境的 Max Tokens 必须可见、
//      卸载(dispose)后旧 id 如实失败。
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect, beforeEach } from 'vitest'

import {
  isSensitiveField,
  registerUiField,
  resetUiFieldRegistryForTest,
  setFieldValue,
  snapshotUiFields,
} from '../ui-field-registry'

const ROOT = resolve(__dirname, '../..')
const read = (rel: string): string => readFileSync(resolve(ROOT, rel), 'utf8')

/** 已接入登记钩子的业务文件(逐屏采纳台账) */
const ADOPTED: readonly string[] = [
  'components/InputArea.tsx',
  'components/ModelConfigDialog.tsx',
  'components/SearchBar.tsx',
  'pages/exam/answer.tsx',
  'pages/study/plan.tsx',
  'pages/study/publish/index.tsx',
  'pkg-about/about/api-settings/index.tsx',
  'pkg-about/about/help.tsx',
  'pkg-ai/aigc/publish.tsx',
  'pkg-ai/dev-enter/n8n-model/index.tsx',
  'pkg-content/community/create/index.tsx',
  'pkg-shop/order/refund.tsx',
  'pkg-user/user/email.tsx',
  'pkg-user/user/feedback.tsx',
  'pkg-user/user/nickname.tsx',
]

/** 凭据/账号类屏:一个登记点都不许有(改到这里必须先想清楚不可逆代价) */
const NEVER_ADOPTED: readonly string[] = [
  'pages/login/login.tsx',
  'pages/register/index.tsx',
  'pages/forgot-password/index.tsx',
  'pkg-user/user/password.tsx',
  'pkg-user/user/phone.tsx',
  'pkg-user/user/realname.tsx',
  'pkg-user/account-cancel/index.tsx',
]

/** 抓出文件里每个 `useUiField({...})` 块(按括号配平,不靠正则猜结尾) */
function fieldBlocks(src: string): string[] {
  const out: string[] = []
  const needle = 'useUiField('
  for (let i = src.indexOf(needle); i >= 0; i = src.indexOf(needle, i + 1)) {
    let depth = 0
    let j = i + needle.length - 1
    for (; j < src.length; j += 1) {
      if (src[j] === '(') depth += 1
      else if (src[j] === ')') {
        depth -= 1
        if (depth === 0) break
      }
    }
    out.push(src.slice(i, j + 1))
  }
  return out
}

describe('逐屏采纳防漂移:业务屏必须真的交出写通道', () => {
  it('每个采纳文件都含 useUiField,且块内 label 有可读来源', () => {
    for (const rel of ADOPTED) {
      const blocks = fieldBlocks(read(rel))
      expect(blocks.length, `${rel} 里找不到 useUiField 登记点`).toBeGreaterThan(0)
      for (const block of blocks) {
        // label 允许三种真实形态:中文字面量 / t('key') / tt('key','默认中文') / 变量兜底表达式
        const label = /label:\s*([^\n,]+(?:\([^\n]*\))?)/.exec(block)
        expect(label, `${rel} 有登记点没有 label`).not.toBeNull()
        const value = (label?.[1] ?? '').trim()
        expect(value.length, `${rel} 的 label 为空`).toBeGreaterThan(1)
        expect(/^['"]{2}$|^undefined$|^$/.test(value), `${rel} 的 label 是空串`).toBe(false)
        // 可读来源:带引号的文案(中或英)、i18n 取值、变量兜底表达式都算;空串/undefined 不算
        expect(
          /['"][^'"]{2,}['"]|t\(\s*['"]|tt\(\s*['"]|\?\?|\|\||[A-Za-z_$][\w$]*$/.test(value),
          `${rel} 的 label 来源不可读:${value}`,
        ).toBe(true)
      }
    }
  })

  it('每个 setValue 用的写函数,必须是同文件里输入事件在用的那一个(不许塞 no-op 假装可写)', () => {
    const offenders: string[] = []
    for (const rel of ADOPTED) {
      const src = read(rel)
      for (const block of fieldBlocks(src)) {
        const expr = (/setValue:\s*([^\n]+)/.exec(block)?.[1] ?? '').replace(/,\s*$/, '').trim()
        if (!expr) {
          offenders.push(`${rel}: 登记块没有 setValue`)
          continue
        }
        // no-op 一律拒绝:注册表写后读不回仍会回 ok,那正是本项目定性的"回了 ok 而界面没动"
        if (/=>\s*(?:undefined|void 0|\{\s*\})\s*$/.test(expr)) {
          offenders.push(`${rel}: setValue 是 no-op`)
          continue
        }
        // 认出写函数:setValue: setNickname / (next) => onChange?.({...}) / (next) => select(next)
        const fn =
          (/=>\s*([A-Za-z_$][\w$]*)\s*(?:\?\.|\()/.exec(expr)?.[1] ?? '') ||
          (/^\s*([A-Za-z_$][\w$]*)\s*$/.exec(expr)?.[1] ?? '')
        if (!fn) {
          offenders.push(`${rel}: 认不出 setValue 引用的写函数:${expr}`)
          continue
        }
        // 整块登记被"该 prop 存在"守卫(无 prop 就不登记 = InputArea 形态,同样不会假成功)
        if (new RegExp(`\\(\\s*${fn}\\s*\\?|${fn}\\s*&&`).test(block)) continue
        // 否则要求:这个写函数就是文件里输入事件回调所走的函数,**或**是那些回调所调用的
        // 本地包装函数真正落到的那一层(ModelConfigDialog 的 onInput→update→onChange 即此类)。
        // 判据的意义:no-op、或指向一个与界面无关的变量,都会在这里红掉。
        const handlerFns = [
          ...src.matchAll(
            /on(?:Input|ChangeText|ValueChange|Confirm|Blur)[\s\S]{0,260}?\b([A-Za-z_$][\w$]*)\s*\(/g,
          ),
        ].map((m) => m[1] ?? '')
        const reaches = handlerFns.some(
          (h) =>
            h === fn ||
            new RegExp(`(?:const|function)\\s+${h}\\b[\\s\\S]{0,320}?\\b${fn}\\b`).test(src),
        )
        if (!reaches) {
          offenders.push(
            `${rel}: setValue 写的 ${fn} 与输入事件回调(${[...new Set(handlerFns)].join('/') || '无'})不同源`,
          )
        }
      }
    }
    expect(offenders, `以下登记点不成立:\n${offenders.join('\n')}`).toEqual([])
  })

  it('凭据 / 账号注销类屏一律不得出现登记点', () => {
    for (const rel of NEVER_ADOPTED) {
      expect(fieldBlocks(read(rel)), `${rel} 不该登记控件`).toEqual([])
    }
  })

  it('发布 / 退款 / 充值类只交出字段,不交出 submit 通道', () => {
    for (const rel of [
      'pages/study/publish/index.tsx',
      'pkg-ai/aigc/publish.tsx',
      'pkg-content/community/create/index.tsx',
      'pkg-shop/order/refund.tsx',
      'pkg-user/user/feedback.tsx',
    ]) {
      expect(read(rel), `${rel} 把 submit 交给了 AI`).not.toMatch(/useUiForm\s*\(/)
    }
  })
})

describe('注册表判据(与 mobile-rn 同一口径,防两端漂移)', () => {
  beforeEach(() => {
    resetUiFieldRegistryForTest()
  })

  it('凭据文案连快照都不出现;计量语境的 Max Tokens 必须可见可填', () => {
    for (const label of ['Access Token', 'API Key', '登录密码', '短信验证码', '访问令牌']) {
      expect(isSensitiveField({ kind: 'input', label }), `${label} 应为敏感`).toBe(true)
    }
    expect(isSensitiveField({ kind: 'input', label: 'Max Tokens' })).toBe(false)
    expect(isSensitiveField({ kind: 'input', label: '输出 tokens 上限' })).toBe(false)

    const dispose = registerUiField({
      kind: 'input',
      label: 'Max Tokens',
      setValue: () => undefined,
    })
    expect(dispose, '计量字段被误判敏感 ⇒ ModelConfig 类页面少一个可填项').not.toBeNull()
    expect(snapshotUiFields().elements[0]).toMatchObject({ label: 'Max Tokens' })
    expect(setFieldValue('fld:input#1', '8192').ok).toBe(true)
    dispose()
  })

  it('password 属性与 inputType 直接判敏感,不依赖文案', () => {
    expect(isSensitiveField({ kind: 'input', label: '备注', password: true })).toBe(true)
    expect(isSensitiveField({ kind: 'input', label: '备注', inputType: 'password' })).toBe(true)
  })

  it('未登记的 id 与已摘除的 id 都如实失败,不会假成功', () => {
    expect(setFieldValue('fld:input#99999', 'x').ok).toBe(false)
    const dispose = registerUiField({ kind: 'input', label: '昵称', setValue: () => undefined })
    expect(dispose).not.toBeNull()
    const id = snapshotUiFields().elements[0]?.id ?? ''
    dispose!()
    expect(setFieldValue(id, 'x').ok).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
