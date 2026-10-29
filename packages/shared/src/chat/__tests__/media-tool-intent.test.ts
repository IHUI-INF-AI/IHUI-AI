// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 媒体族「意图→工具集」策略的行为锁与单一源锁(2026-10-29 立)。
 *
 * 这张表决定"哪些话术会让模型看见 `video_generation`" —— 它是要花钱的外部调用,
 * 多给一次就是多一次计费,少给一次就是"用户说做视频、模型只会回文字"。所以
 * 判据必须落在被审文件上,而不是落在注释里的承诺(与 file-tool-intent 同一条理由)。
 *
 * 两组锁:① 行为对子(生成意图/取件追问/纯提及各一对正反);
 *        ② 单一源(web 消费方指向本子路径、端内不得再写视频关键词正则、
 *           且本模块**故意不进 `./chat` barrel**)。
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { VIDEO_INTENT_TOOLS, videoToolsFor } from '../media-tool-intent'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '../../../../..')
if (!existsSync(join(REPO_ROOT, 'pnpm-workspace.yaml'))) {
  throw new Error(`REPO_ROOT 解析异常:${REPO_ROOT} 下没有 pnpm-workspace.yaml ⇒ 相对层数写错`)
}

const webConfig = readFileSync(
  join(REPO_ROOT, 'apps/web/src/hooks/use-chat/tool-config.ts'),
  'utf8',
)
const chatBarrel = readFileSync(join(REPO_ROOT, 'packages/shared/src/chat/index.ts'), 'utf8')

describe('videoToolsFor 行为对子', () => {
  it('生成意图命中', () => {
    for (const text of [
      '帮我生成一段视频',
      '做个 5 秒的视频',
      '拍一段短视频，内容是海边日落',
      '文生视频：赛博朋克城市',
      'make a video of a cat playing piano',
    ]) {
      expect(videoToolsFor(text), text).toEqual(['video_generation'])
    }
  })

  it('取件追问命中(task_ 任务号)', () => {
    expect(videoToolsFor('task_p01oMMP5bnc4JuWPr6zUvYW93aItkfHH 好了吗')).toEqual([
      'video_generation',
    ])
  })

  it('纯提及不命中', () => {
    for (const text of [
      '',
      '这个视频怎么样',
      '视频会议怎么开',
      '读一下 video.ts 这个文件',
      '帮我把视频下载到本地', // 没有生成动词,只是搬运
    ]) {
      expect(videoToolsFor(text), text).toEqual([])
    }
  })

  it('工具清单只含视频生成一件', () => {
    expect([...VIDEO_INTENT_TOOLS]).toEqual(['video_generation'])
  })
})

describe('单一源锁', () => {
  it('web 消费方从共享子路径取用', () => {
    expect(webConfig).toContain(
      "export { videoToolsFor } from '@ihui/shared/chat/media-tool-intent'",
    )
  })

  it('端内不得再写一套视频关键词正则', () => {
    expect(webConfig).not.toMatch(/text2video|图生视频|生成[^。\n]{0,12}视频/)
  })

  it('本模块不进 ./chat barrel(避免 export * 名字歧义)', () => {
    expect(chatBarrel).not.toContain('media-tool-intent')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
