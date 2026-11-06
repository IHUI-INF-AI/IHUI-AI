// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * voice-audio-context-lifecycle.test.ts — BUG-0013 语音条音频上下文生命周期锁(2026-11-06 立)
 *
 * 判据对象:apps/miniapp-taro/src/pkg-ai/ai/voice.tsx 的**源码文本**(非运行期实例)。
 * 为何不跑 DOM:本仓 vitest environment 固定为 'node',未安装 jsdom / @testing-library,
 * 且票面禁止新增依赖;InnerAudioContext 是 Taro 宿主对象,node 下无真实实现。故用
 * 「源码形制锁」对 onPlayAudio 的分支顺序、释放函数体、cleanup 与 createInnerAudioContext
 * 调用次数做精确断言 —— 把实现改回「只置 -1 不停播」「播新条不释旧条」「每次新建不
 * destroy」「卸载不销毁」中任一种,本文件都会红。
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const VOICE_REL = 'src/pkg-ai/ai/voice.tsx'
const VOICE_ABS = resolve(__dirname, '..', VOICE_REL)
const src = readFileSync(VOICE_ABS, 'utf8')

/** 释放必须发生在置 -1 之前:同一 idx 分支/onEnded/onError 共用这把尺 */
function releasesBeforeReset(body: string): boolean {
  const release = body.indexOf('destroyCurrentAudio()')
  const reset = body.indexOf('setPlayingIdx(-1)')
  return release >= 0 && reset >= 0 && release < reset
}

/** 取出「停掉并销毁当前 context」的局部函数体 */
function releaseHelperBody(): string | null {
  const start = src.indexOf('const destroyCurrentAudio = useCallback(')
  const end = src.indexOf('const onPlayAudio = useCallback(')
  return start >= 0 && end > start ? src.slice(start, end) : null
}

/** 取出 onPlayAudio 整个回调块 */
function playAudioBody(): string | null {
  const start = src.indexOf('const onPlayAudio = useCallback(')
  const end = src.indexOf('const onClear = useCallback(')
  return start >= 0 && end > start ? src.slice(start, end) : null
}

/** 取出指定音频事件的回调体 */
function audioEventBody(name: 'onEnded' | 'onError'): string | null {
  const block = playAudioBody()
  if (!block) return null
  const m = block.match(
    new RegExp(`${name}\\(\\s*\\(\\)\\s*=>\\s*\\{([\\s\\S]*?)\\n\\s*\\}\\s*\\)`),
  )
  return m?.[1] ?? null
}

describe('BUG-0013 语音条 InnerAudioContext 生命周期', () => {
  it('存在 audioRef,且类型为 Taro.InnerAudioContext | null', () => {
    expect(
      /const\s+audioRef\s*=\s*useRef<Taro\.InnerAudioContext\s*\|\s*null>\s*\(\s*null\s*\)/.test(
        src,
      ),
      '缺少 audioRef:每次播放都新建 context 且从不销毁,卸载/切条时无法停掉旧音轨',
    ).toBe(true)
  })

  it('createInnerAudioContext 的结果被赋给 audioRef.current', () => {
    const block = playAudioBody()
    expect(block, '定位不到 onPlayAudio').not.toBeNull()
    expect(block!).toMatch(/const\s+audio\s*=\s*Taro\.createInnerAudioContext\(\)/)
    expect(block!, '新建 context 未登记到 audioRef.current ⇒ 旧条无法被释放(叠音)').toMatch(
      /audioRef\.current\s*=\s*audio/,
    )
    const createIdx = block!.indexOf('Taro.createInnerAudioContext()')
    const assignIdx = block!.search(/audioRef\.current\s*=\s*audio/)
    expect(assignIdx).toBeGreaterThan(createIdx)
  })

  it('全文 createInnerAudioContext() 只出现 1 次(不允许裸创建第二份)', () => {
    const count = (src.match(/createInnerAudioContext\s*\(\s*\)/g) ?? []).length
    expect(
      count,
      `出现 ${count} 处 createInnerAudioContext():多出来的那处必然是「播新条不释放旧条」的裸创建`,
    ).toBe(1)
  })

  it('同一 idx 再点:先释放 context,再 setPlayingIdx(-1)', () => {
    const block = playAudioBody()
    expect(block, '定位不到 onPlayAudio').not.toBeNull()
    const m = block!.match(
      /if\s*\(\s*!msg\.audio\s*\|\|\s*playingIdx\s*===\s*idx\s*\)\s*\{([\s\S]*?)\n\s*\}/,
    )
    expect(m, '定位不到「同一 idx 再点」分支').not.toBeNull()
    const branch = m?.[1] ?? null
    expect(branch, '定位不到「同一 idx 再点」分支').not.toBeNull()
    expect(releasesBeforeReset(branch!)).toBe(true)
    expect(
      branch!.includes('return'),
      '同一 idx 分支释放后必须 return,不能落进新建 context 的路径',
    ).toBe(true)
    // 阳性对照:抹掉释放调用后判据必须失败(证明上面不是恒真)
    expect(releasesBeforeReset(branch!.replace('destroyCurrentAudio()', ''))).toBe(false)
  })

  it('点另一条:创建新 context 前先释放旧 context', () => {
    const block = playAudioBody()
    expect(block, '定位不到 onPlayAudio').not.toBeNull()
    const m = block!.match(
      /if\s*\(\s*!msg\.audio\s*\|\|\s*playingIdx\s*===\s*idx\s*\)\s*\{([\s\S]*?)\n\s*\}/,
    )
    const afterBranch = block!.slice((m!.index ?? 0) + m![0].length)
    const releaseIdx = afterBranch.indexOf('destroyCurrentAudio()')
    const createIdx = afterBranch.indexOf('Taro.createInnerAudioContext()')
    expect(releaseIdx, '点另一条时没有先释放旧 context ⇒ 新旧两条叠音').toBeGreaterThanOrEqual(0)
    expect(createIdx).toBeGreaterThan(releaseIdx)
  })

  it('释放函数体含 stop() + destroy() 并置 audioRef.current = null,且包在 try 里', () => {
    const helper = releaseHelperBody()
    expect(helper, '缺少「停掉并销毁当前 context」的局部函数').not.toBeNull()
    expect(helper!, '释放函数没有 stop()').toMatch(/audio\.stop\(\)/)
    expect(helper!, '释放函数没有 destroy() ⇒ 每次播放都遗留一个宿主音频实例').toMatch(
      /audio\.destroy\(\)/,
    )
    expect(helper!, '释放后未置空 audioRef.current').toMatch(/audioRef\.current\s*=\s*null/)
    expect(helper!, 'stop/destroy 可能抛错,未用 try 包住会打断 UI').toMatch(/try\s*\{[\s\S]*catch/)
    // 阳性对照:删掉 destroy 后判据必须失败
    expect(/audio\.destroy\(\)/.test(helper!.replace('audio.destroy()', ''))).toBe(false)
  })

  it('onEnded 回调体:先释放再置 -1', () => {
    const body = audioEventBody('onEnded')
    expect(body, '定位不到 onEnded 回调体').not.toBeNull()
    expect(
      body!.includes('destroyCurrentAudio()'),
      'onEnded 只置 -1 不释放 ⇒ 播完后 context 仍挂在 audioRef 上',
    ).toBe(true)
    expect(releasesBeforeReset(body!)).toBe(true)
  })

  it('onError 回调体:先释放再置 -1', () => {
    const body = audioEventBody('onError')
    expect(body, '定位不到 onError 回调体').not.toBeNull()
    expect(
      body!.includes('destroyCurrentAudio()'),
      'onError 只置 -1 不释放 ⇒ 出错后 context 仍挂在 audioRef 上',
    ).toBe(true)
    expect(releasesBeforeReset(body!)).toBe(true)
  })

  it('组件卸载的 cleanup 中释放 context', () => {
    const m = src.match(
      /useEffect\(\s*\(\)\s*=>\s*\{\s*return\s*\(\)\s*=>\s*\{\s*destroyCurrentAudio\(\)\s*\}\s*\},\s*\[destroyCurrentAudio\]\s*\)/,
    )
    expect(
      m,
      '缺少仅含清理的 useEffect(deps 为 destroyCurrentAudio):页面卸载时音频会继续播放',
    ).not.toBeNull()
    // 阳性对照:删掉 cleanup 里的释放调用后判据必须失败
    expect(/destroyCurrentAudio\(\)/.test(m![0].replace('destroyCurrentAudio()', ''))).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
