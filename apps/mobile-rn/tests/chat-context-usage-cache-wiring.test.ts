// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * RN 主聊天屏的上下文用量接线锁(G-403 / G-225 的 RN 腿)
 *
 * 为什么存在:缓存两维(cache 命中读 / cache 写入)此前四层都通了 —— 服务端发帧、
 * `@ihui/api-client` 解析、web 的 ring 与小程序的归因条都在消费 —— 唯独 RN 主屏
 * 只在 `onUsage` 里取 `totalTokens` 写进消息 meta,接了帧却无人渲染,面板于是恒显
 * 「不可得」。这种"链路只差最后一格"的缺口,类型检查看不见(两维是可选 prop)、
 * 门 128 也看不见(它比对的是样式取值,不是数据有没有走到渲染位)。
 *
 * 为什么是源码级而不是渲染级:ChatScreen 模块顶层直挂大量宿主能力
 * (expo-* / mmkv / assets-registry 的 svg require),在 vitest 下整屏挂载需要的替身
 * 规模远超本断言的价值 —— 与 `login-error-identity.test.ts` 同一取舍。
 * 因此本文件把判据落在**唯一能出错的那一件事**上:帧到渲染位之间的形状。
 *
 * 三态是本案的重点(与 G-394 同一条禁令):`0` 是"一次都没命中"这个结论本身,
 * `null`/缺字段是"没采到"。把 null 折成 0、或把缓存读数排在
 * `totalTokens <= 0` 的早退之后,都会把已知的一档读成未知 —— 两者都由本文件拦下。
 *
 * 阳性对照不钉 HEAD:HEAD 会被本次改动自己刷绿(记过的失效型),故旧形态取内联夹具,
 * 由同一把尺子判它必须不通过。
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

// 与 login-error-identity.test.ts 同款:__dirname 在 vitest SSR 变换下可用;
// import.meta.url 在本仓环境是 vite 的 http 形态,fileURLToPath 会当场报 "URL must be of scheme file"。
const SRC_PATH = join(__dirname, '..', 'src', 'screens', 'ChatScreen.tsx')
const src = readFileSync(SRC_PATH, 'utf8')

/** 取 `onUsage` 回调体(含首尾标记);取不到返回 null ⇒ 调用方必须判失败,不得放行 */
function onUsageBody(text: string): string | null {
  const start = text.indexOf('onUsage: (usage) => {')
  if (start === -1) return null
  const end = text.indexOf('\n      },', start)
  return end === -1 ? text.slice(start) : text.slice(start, end)
}

/** 本屏缓存读数的全部判据(源文进、违规清单出);清单为空即接线成立 */
function judge(text: string): string[] {
  const bad: string[] = []
  const body = onUsageBody(text)
  if (!body) {
    return ['本屏没有 onUsage 回调 —— usage 帧无处落,三态无从谈起']
  }
  const setIdx = body.indexOf('setLatestCacheTokens(')
  const guardIdx = body.indexOf('if (usage.totalTokens <= 0) return')

  if (setIdx === -1) bad.push('onUsage 未记录缓存两维(RN 腿断在帧处理这一格)')
  if (setIdx !== -1 && guardIdx !== -1 && setIdx > guardIdx) {
    bad.push('缓存两维排在 totalTokens<=0 的早退之后 ⇒ 「报了缓存但本轮总量为 0」会被折成未知')
  }
  if (!/cacheReadTokens:\s*usage\.cacheReadTokens\s*\?\?\s*null/.test(body)) {
    bad.push('cacheReadTokens 未以 `?? null` 形态接住(缺席与显式 null 必须同为未知)')
  }
  if (!/cacheWriteTokens:\s*usage\.cacheWriteTokens\s*\?\?\s*null/.test(body)) {
    bad.push('cacheWriteTokens 未以 `?? null` 形态接住')
  }
  if (/cache(?:Read|Write)Tokens\s*(?:\?\?|\|\|)\s*0/.test(text)) {
    bad.push('渲染位或帧处理把未采到折成 0(0 是"一次都没命中"的结论,不是"没量到")')
  }
  if (
    !/<ContextUsagePanel[\s\S]{0,700}?cacheReadTokens=\{latestCacheTokens\.cacheReadTokens\}/.test(
      text,
    )
  ) {
    bad.push('共享面板未从本页 state 取缓存两维(接了帧却没走到渲染位)')
  }
  if (
    !/setLatestCacheTokens\(\{\s*cacheReadTokens:\s*null,\s*cacheWriteTokens:\s*null\s*\}\)/.test(
      text,
    )
  ) {
    bad.push('新一轮开始未重置上一轮缓存读数(旧账会挂到本轮面板上)')
  }
  if (!/maxTokens=\{getModelContextCapacity\(model\)\}/.test(text)) {
    bad.push('窗口容量未取共享解析器 getModelContextCapacity(端内不得自立容量档)')
  }
  if (/function\s+ContextUsagePanel|const\s+ContextUsagePanel\s*=/.test(text)) {
    bad.push('端内另立了第二份归因面板实现(单一真相源:复用 @ihui/rn-app 那一个)')
  }
  return bad
}

describe('RN 主聊天屏的上下文用量接线(G-403/G-225 RN 腿)', () => {
  it('现读被审面:七条判据全部成立', () => {
    expect(judge(src)).toEqual([])
  })

  it('面板从 @ihui/rn-app 取(与共享屏同一个组件,不是第三份实现)', () => {
    expect(src).toMatch(/ContextUsagePanel,[\s\S]{0,200}?from '@ihui\/rn-app'/)
  })

  it('有消息才渲染,无消息不占位(与小程序归因条同一档)', () => {
    expect(src).toMatch(/\{messages\.length \?\s*\(\s*<ContextUsagePanel/)
  })

  it('阳性对照:早退在前的那一版必须被同一把尺子拒下', () => {
    const legacy = src.replace(
      /onUsage: \(usage\) => \{\s*setLatestCacheTokens\(\{[\s\S]*?\}\)\s*\n(\s*)if \(usage\.totalTokens <= 0\) return/,
      (m) => m.replace(/setLatestCacheTokens\(\{[\s\S]*?\}\)\s*\n\s*/, ''),
    )
    expect(legacy).not.toBe(src)
    const verdict = judge(legacy)
    expect(verdict.some((v) => v.includes('未记录缓存两维'))).toBe(true)
  })

  it('阳性对照:把 null 折成 0 的那一版必须被同一把尺子拒下', () => {
    const zeroFold = src.replace(
      /cacheReadTokens:\s*usage\.cacheReadTokens\s*\?\?\s*null/,
      'cacheReadTokens: usage.cacheReadTokens ?? 0',
    )
    expect(zeroFold).not.toBe(src)
    expect(judge(zeroFold).some((v) => v.includes('折成 0'))).toBe(true)
  })

  it('阳性对照:整条 onUsage 摘掉(本改动前的形态)必须判失败而不是判空通过', () => {
    const noUsage = src.replace(/onUsage: \(usage\) => \{/, 'onX: () => {')
    expect(judge(noUsage)).toEqual(['本屏没有 onUsage 回调 —— usage 帧无处落,三态无从谈起'])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
