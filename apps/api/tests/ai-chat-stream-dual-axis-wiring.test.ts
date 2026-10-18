// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 79 号票(权限双轴)网关接线段的防回归锁(源码级,零连接)。
//
// 为什么钉计数而不是钉"存在":这条链的失效型不是编译错,而是**某一跳漏了**——
// schema 声明了却不在解构里取 ⇒ zod 把它留在 parsed.data 里静默丢弃;
// 解构取了却没递给 streamToClient ⇒ 上游收不到,而界面看着一切正常。
// 本文件的两条入口(chat / answer)各有一套 schema→解构→调用点→转发行,
// 少任何一跳都不报错,只有计数能把它照出来(与 D130 reasoningEffort 同型断链)。
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// vitest 的 cwd 恒等于本包根(与同目录既有源级锁同一口径,不写绝对路径)
const SRC = readFileSync(resolve(process.cwd(), 'src/routes/ai-chat-stream.ts'), 'utf8')

function countOf(re: RegExp): number {
  // 强制带 g:`String.match` 不带 g 只返回第一枚匹配,那会把"计数"悄悄退化成"存在性"
  // —— 而本文件的牙全在计数上(某一跳漏了仍然"存在",只是少一行)。
  const withG = re.flags.includes('g') ? re : new RegExp(re.source, re.flags + 'g')
  return (SRC.match(withG) ?? []).length
}

describe('ai-chat-stream 双轴透传链(79 号票)', () => {
  it('入站 schema 声明了两轴(未声明的键会被 zod strip 静默丢掉)', () => {
    expect(countOf(/sandboxMode: z\.enum\(SANDBOX_MODES\)\.optional\(\)/)).toBe(1)
    expect(countOf(/approvalPolicy: z\.enum\(APPROVAL_POLICIES\)\.optional\(\)/)).toBe(1)
    // 值域取注册表派生,路由不得自抄字面量清单(G-164)
    expect(SRC).not.toMatch(/sandboxMode: z\.enum\(\['/)
  })

  it('两条入口都把两轴从 parsed.data 解构出来并递给调用点(各两跳,共四行独立传递)', () => {
    // 独立成行的简写共 4 处 = 2 条入口 × (解构 + 递参);
    // 少一行就是"某一跳漏了"那一型 —— 编译不报错,上游静默收不到。
    // 不钉缩进(那是排版,重构会正当改变),钉的是"独立传递的行数"这个语义量。
    expect(countOf(/^ +sandboxMode,$/m)).toBe(4)
    expect(countOf(/^ +approvalPolicy,$/m)).toBe(4)
  })

  it('全局出现次数自洽:四行传递 + 一行转发(第五处只能是转发行)', () => {
    expect(countOf(/sandboxMode,/g)).toBe(5)
    expect(countOf(/approvalPolicy,/g)).toBe(5)
  })

  it('转发行按 camel 入 / snake 出,且只此一处(两处转发就是两份真相源)', () => {
    expect(countOf(/sandbox_mode: opts\.sandboxMode,/)).toBe(1)
    expect(countOf(/approval_policy: opts\.approvalPolicy,/)).toBe(1)
  })

  it('streamToClient 的 opts 类型显式声明两轴为封闭联合成员(不重声明值域)', () => {
    expect(SRC).toContain('sandboxMode?: SandboxModeId')
    expect(SRC).toContain('approvalPolicy?: ApprovalPolicyId')
    expect(SRC).toMatch(/type SandboxModeId,\s+type ApprovalPolicyId,/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
