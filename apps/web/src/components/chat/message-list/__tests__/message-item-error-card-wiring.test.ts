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
import cardSrc from '../MessageItem.tsx?raw'
import producerSrc from '../../../../hooks/use-chat/send-answer.ts?raw'

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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
