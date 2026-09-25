// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D92 / D71② 接线契约(源码原文断言,不渲染整个 MessageItem)。
 *
 * 为什么读源码而不是渲染:MessageItem 依赖 store / next-intl / 图片 / 虚拟化等大量上下文,
 * 为一条"是否走了那张表"去搭全套 harness,换来的是一堆可被 mock 掩盖的假绿。
 * 本文件只钉两件"改坏了会立刻静默退化"的事实:
 *   ① 错误卡确实从**统一分类表**取词(且回落态不套表标题);
 *   ② 生产侧确实把后端 errorCode 一路传到 store —— 少一环,分类表就拿不到输入。
 * 同族教训:守门 64「造好没装车」、mcp-view-failure.test.tsx 的 ?raw 三断言。
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import cardSrc from '../MessageItem.tsx?raw'
import producerSrc from '../../../../hooks/use-chat/send-answer.ts?raw'

/**
 * 生产面文件清单(O60i 补的尺子)。
 * 为什么需要它:`MessageErrorCard.tsx` 自入库起就躺着,`git grep` 只在**测试**里命中 ⇒
 * 组件级测试全绿而用户屏幕上一直是 MessageItem 的内联实现。**"组件有自己的渲染测试"
 * 不等于"组件有生产者"** —— 守门 64 对 miniapp 适配器做的正是"必须被目录外源文件 import"
 * 这件事,组件面从来没有等价尺子。刻意排除 `*.test.tsx` 与 `__tests__/`:
 * 若把测试算成 importer,本判据会在孤儿当夜就绿(那正是过去两周的状态)。
 */
function productionFiles(): Array<{ path: string; code: string }> {
  const out: Array<{ path: string; code: string }> = []
  const walk = (dir: string) => {
    for (const ent of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, ent.name)
      if (ent.isDirectory()) {
        if (ent.name === '__tests__' || ent.name === 'tests' || ent.name === 'node_modules') continue
        walk(full)
        continue
      }
      if (!/\.(ts|tsx)$/.test(ent.name)) continue
      out.push({
        path: relative(resolve(process.cwd()), full).replaceAll('\\', '/'),
        code: readFileSync(full, 'utf8'),
      })
    }
  }
  for (const root of ['app', 'src']) walk(resolve(process.cwd(), root))
  return out
}

describe('D92 错误卡接线:必须走统一分类表', () => {
  it('消费侧 import 并调用 resolveViewFailure(与 MCP 面板同一张表)', () => {
    expect(cardSrc).toMatch(
      /import\s*\{[^}]*resolveViewFailure[^}]*\}\s*from\s*'@ihui\/shared\/utils\/view-failure-taxonomy'/,
    )
    expect(cardSrc).toMatch(/resolveViewFailure\(\{[^}]*errorCode:\s*m\.errorCode/)
  })

  it('标题/建议动作取自表内键(entry.titleKey / entry.actionKey),不是本地映射', () => {
    expect(cardSrc).toMatch(/errorViewFailure\.entry\.titleKey/)
    expect(cardSrc).toMatch(/tFailure\(errorViewFailure\.entry\.actionKey\)/)
    // 反例钉死:错误卡内不得再建一张 code→文案 的本地表(即"另起一张表"回退)
    expect(cardSrc).not.toMatch(/ERROR_(TITLE|CARD)_MAP|errorCodeTitleMap/)
  })

  it('回落态保留笼统标题(不得把"未判定"包装成确定性结论)', () => {
    expect(cardSrc).toMatch(/!failureResolution\.isFallback/)
    expect(cardSrc).toMatch(/:\s*t\('errorCardTitle'\)/)
  })

  it('D94 尾票:交接单的 ctx 必须吃分类表的错误码与消息时间(少了就退化成只有错误原文)', () => {
    // 渲染位本身由 message-item-handoff-wiring.test.tsx 用真渲染证明;
    // 这里只钉"喂进去的是分类表给的码 + 这条消息的时间",而不是写死样例。
    expect(cardSrc).toMatch(/localSignals:\s*\{\s*errorCode:\s*errorCodeText \?\? undefined\s*\}/)
    expect(cardSrc).toMatch(/occurredAt:\s*Number\.isFinite\(m\.createdAt\)/)
    // 反例钉死:不得用常量 ctx 或空对象占位(那会让卡片永远显示"未提供")
    expect(cardSrc).not.toMatch(/<HandoffPackageCard\s+ctx=\{\{\s*\}/)
  })

  it('错误码行使用表自带的 errorCodeLabel 键与 ICU 参数', () => {
    expect(cardSrc).toMatch(/VIEW_FAILURE_ERROR_CODE_KEY/)
    expect(cardSrc).toMatch(/errorCodeLabel|\{ errorCode: errorCodeText \}/)
  })
})

describe('D71② 生产侧透传:errorCode 必须活到 store', () => {
  it('formatSSEError 的 errorCode 被传给 setMessageError(而非只塞文案)', () => {
    // 4 个失败出口(onError / 15s / 60s / catch)全部带上码;至少断言出现 3 次
    const withCode = producerSrc.match(/setMessageError\([^)]*,\s*formatted\.errorCode\)/g) ?? []
    expect(withCode.length).toBeGreaterThanOrEqual(3)
  })
})

describe('O60i 装车判据:失败卡只能有一个生产实现,且组件必须有生产者', () => {
  it('MessageErrorCard 被生产面文件 import(不再是"只在测试里活着"的孤儿)', () => {
    const importers = productionFiles()
      .filter(
        (f) =>
          !f.path.endsWith('MessageErrorCard.tsx') &&
          f.code.includes("from '@/components/chat/message-list/MessageErrorCard'"),
      )
      .map((f) => f.path)
    expect(importers).toContain('src/components/chat/message-list/MessageItem.tsx')
  })

  it('message-error-card- 这个 testid 全生产面只能有一处发出(两份实现重名 = 探针失明)', () => {
    // 判**发射形态**而不是裸子串:解释性注释里提到这个 testid 不算发射
    // (本票自己的注释就写过一次,把判据逼成结构匹配 —— 见 `data-testid={` 前缀)。
    const emitters = productionFiles()
      .filter((f) => /data-testid=\{?["`]message-error-card-/.test(f.code))
      .map((f) => f.path)
    expect(emitters).toEqual(['src/components/chat/message-list/MessageErrorCard.tsx'])
  })

  it('宿主把 D92 分类标题传进组件,组件不再自己决定回落文案(判据留在拿得到 isFallback 的一侧)', () => {
    expect(cardSrc).toMatch(/titleText=\{errorCardTitle\}/)
    const comp = readFileSync(
      resolve(process.cwd(), 'src/components/chat/message-list/MessageErrorCard.tsx'),
      'utf8',
    )
    expect(comp).toMatch(/\{titleText \?\? t\('errorCardTitle'\)\}/)
    // 反例钉死:组件不得 import 分类表模块(那会把 D92 的表在端内复制成第二处调用点)。
    // 同样只判 import 形态 —— 组件注释里写了 `resolveViewFailure` 的名字来说明"为什么不在这里算"。
    expect(comp).not.toMatch(/from\s*'@ihui\/shared\/utils\/view-failure-taxonomy'/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
