// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 不可信外部文本进告警邮件正文的归一化 —— scheduler-worker.ts 那三个出口的回归锁。
//
// 为什么要有这把尺子(而不是"改完看一眼"):AGENTS.md §5e 说邮件是运维到人的**唯一**通道,
// 而 scheduler-worker 里 pushAlert 的 message 拼的是上游资讯源的错误原文与文件系统读回来的
// 文件名。这类"某处必须出现 X"的判断,本仓反复踩过"函数在、判据过、但调用点没接上"那一型
// (守门 70/76/81/102 同型),所以最后一条判据直接审**源文件本身**有没有走这两个出口。
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import {
  capAlertMessage,
  flattenUntrustedText,
  untrustedErrorField,
} from '../src/workers/scheduler-worker.js'

/** 与 scheduler-worker.ts 里的 ALERT_FIELD_MAX_CHARS / ALERT_MESSAGE_MAX_BYTES 同值 */
const FIELD_MAX = 300
const BODY_MAX_BYTES = 20_000

describe('flattenUntrustedText:外部文本进告警正文前的形状归一', () => {
  it('换行与控制字符折成空格(一条外部错误只许占一行)', () => {
    // \u0007=BEL、\u001b=ESC:留在正文里会污染终端/邮件客户端渲染
    expect(flattenUntrustedText('第一行\n第二行\u0007tail')).toBe('第一行 第二行 tail')
  })

  it('零宽字符不得活着进正文(§5c 水印同款字符,不可见即不可审)', () => {
    expect(flattenUntrustedText('a\u200bb\u2060c\u200dd')).toBe('a b c d')
  })

  it('未超档不加工(不得给正常文本凭空加尾注)', () => {
    expect(flattenUntrustedText('ETIMEDOUT')).toBe('ETIMEDOUT')
    expect(flattenUntrustedText(null)).toBe('')
    expect(flattenUntrustedText(undefined)).toBe('')
    expect(flattenUntrustedText('   ')).toBe('')
  })

  it('超档必须截断**并点名丢了多少字符**(静默变短=伪造完整性)', () => {
    const out = flattenUntrustedText('x'.repeat(FIELD_MAX + 700))
    expect(out.startsWith('x'.repeat(FIELD_MAX))).toBe(true)
    expect(out.endsWith('…[截断,已丢弃 700 字符]')).toBe(true)
  })
})

describe('untrustedErrorField:自有诊断串 vs 上游原文', () => {
  it('本仓 ai-feed-service 的固定前缀标为「自有诊断串」', () => {
    expect(untrustedErrorField('RSSHub https://rsshub.example/x 返回 502')).toBe(
      '[自有诊断串] RSSHub https://rsshub.example/x 返回 502',
    )
    expect(untrustedErrorField('fetch failed')).toBe('[自有诊断串] fetch failed')
    expect(untrustedErrorField('ETIMEDOUT')).toBe('[自有诊断串] ETIMEDOUT')
    // 'unknown error' 是 scheduler-worker 自己写的兜底字面量
    expect(untrustedErrorField('unknown error')).toBe('[自有诊断串] unknown error')
  })

  it('判不出来的默认归「上游原文」(宁可标严,不把未经审核的文本冒充自有)', () => {
    expect(untrustedErrorField('<!DOCTYPE html>500 Internal Server Error')).toBe(
      '[上游原文] <!DOCTYPE html>500 Internal Server Error',
    )
    expect(untrustedErrorField('')).toBe('[上游原文] (无内容)')
    expect(untrustedErrorField(undefined)).toBe('[上游原文] (无内容)')
  })

  it('标签不改变封顶:上游长文一样被截断并留丢弃量', () => {
    const out = untrustedErrorField(`上游回吐:\n${'y'.repeat(2000)}`)
    expect(out.startsWith('[上游原文] 上游回吐: y')).toBe(true)
    expect(/已丢弃 \d+ 字符\]$/.test(out)).toBe(true)
    // 前缀 12 字符 + 正文 ≤ FIELD_MAX
    expect(out.length).toBeLessThanOrEqual('[上游原文] '.length + FIELD_MAX + '…[截断,已丢弃 1988 字符]'.length + 6)
  })
})

describe('capAlertMessage:整条正文的字节闸门', () => {
  it('未越限时逐字不变(幂等,不得给正常正文加尾注)', () => {
    expect(capAlertMessage('普通告警正文')).toBe('普通告警正文')
  })

  it('越限时总字节数仍 ≤ 上限,且正文里吼出丢弃量与去处', () => {
    const out = capAlertMessage('z'.repeat(BODY_MAX_BYTES * 2))
    expect(Buffer.byteLength(out, 'utf8')).toBeLessThanOrEqual(BODY_MAX_BYTES)
    expect(out).toContain('正文已达上限 20000 字节,已丢弃')
    expect(out).toContain('完整批次]')
  })

  it('按码点切:不得产出孤立代理对(切坏等于把要看的那半句也弄坏)', () => {
    const out = capAlertMessage('\u{1F600}'.repeat(9000))
    // 孤立 surrogate(高代理后面不跟低代理)必须为零
    expect(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/.test(out)).toBe(false)
    expect(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(out)).toBe(false)
  })

  it('CJK 正文按字节而非字符计量(3 字节/字,字符数封顶会放行 3 倍体积)', () => {
    const out = capAlertMessage('中'.repeat(9000))
    expect(Buffer.byteLength(out, 'utf8')).toBeLessThanOrEqual(BODY_MAX_BYTES)
  })
})

describe('装车对账:两个 pushAlert 调用点必须真的走这两个出口', () => {
  const src = readFileSync(
    fileURLToPath(new URL('../src/workers/scheduler-worker.ts', import.meta.url)),
    'utf8',
  )

  it('AI 资讯源错误原文经 untrustedErrorField,且整条 message 过 capAlertMessage', () => {
    expect(src).toContain('untrustedErrorField(d.error')
    expect(src).toContain('capAlertMessage(')
    // 旧形态(把 d.error 原样拼进正文)不得回来 —— 与本仓"整轮豁免那句写法不得回来"同型反向锁
    expect(src).not.toContain("`${d.sourceCode}: ${d.error ?? 'unknown error'}`")
  })

  it('备份监控的 backupIssues(含文件名与异常原文)也走同一把尺子', () => {
    expect(src).toMatch(/backupIssues[\s\S]{0,200}flattenUntrustedText/)
    expect(src).not.toMatch(/message: result\.backupIssues\.join\('\\n'\)/)
  })

  it('两侧字节闸门必须是同一把尺子(bridge 与 api worker 各定一档 = 第二条真相)', () => {
    const bridgeSrc = readFileSync(
      fileURLToPath(new URL('../../../monitoring/alertbridge/alert-webhook-bridge.cjs', import.meta.url)),
      'utf8',
    )
    const apiCap = /const ALERT_MESSAGE_MAX_BYTES = ([\d_]+)/.exec(src)?.[1]
    const bridgeCap = /const MAIL_BODY_MAX_BYTES = ([\d_]+)/.exec(bridgeSrc)?.[1]
    // 取不到常量 = 某一侧把闸门摘了或改了名 ⇒ 判红,绝不当"两边都没有所以不比较"
    expect(apiCap, 'scheduler-worker 的字节闸门常量不见了').toBeTruthy()
    expect(bridgeCap, 'alert-webhook-bridge 的字节闸门常量不见了').toBeTruthy()
    // 源码里写的是 `20_000` 这种带分隔符的形态,Number("20_000") 是 NaN,必须先剥下划线
    const toNum = (s: string) => Number(s.replace(/_/g, ''))
    expect(Number.isFinite(toNum(apiCap as string)), 'api 侧常量解析不出数值').toBe(true)
    expect(toNum(apiCap as string)).toBe(toNum(bridgeCap as string))
  })
})

describe('flattenUntrustedText:截断之前先过共享层脱敏', () => {
  it('上游错误里的 IP 不会原样寄进到人邮件', () => {
    // 用 IP / 邮箱这类 redactSecrets 覆盖的形态做探针:它们与凭据走同一个出口函数,
    // 而把真凭据形态写进仓库会被 push protection 按 commit 拦下(本仓为此卡死过 main)。
    expect(flattenUntrustedText('upstream 502 from 10.20.30.40')).toBe(
      'upstream 502 from [REDACTED_IP]',
    )
  })

  it('脱敏发生在截断之前(否则边界上的凭据会留下可读半截)', () => {
    const long = `${'x'.repeat(296)}a@corp.example.com tail`
    const out = flattenUntrustedText(long)
    expect(out).not.toContain('a@corp.example.com')
    expect(out).toContain('***')
    expect(out.length).toBeLessThanOrEqual(FIELD_MAX + 40)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
