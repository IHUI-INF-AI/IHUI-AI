// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 兜底模型的上下文容量:只许来自唯一容量出口(小程序首页与模型广场两处同判)。
//
// 为什么这一格值得钉:广场卡片与首页模型行**直接把容量当规格展示给用户**(32K / 128K / 200K),
// 写死一个数不是"少显示一点",而是对一半以上的模型报错误规格;而它不会报错、不会崩、
// 数字看着完全合理 —— 与 web 任务进度面板那个"上下文占用百分比"是同一型(见
// `apps/web/tests/agent-pane-context-denominator.test.ts`)。所以判据钉在取材面,不靠人记。
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { getModelContextCapacity } from '@ihui/api-client'
import { describe, expect, it } from 'vitest'

// 本文件在 apps/miniapp-taro/src/pkg-ai/model-plaza/__tests__/ ⇒ 端根要上跳四级
// (__tests__ → model-plaza → pkg-ai → src → 端根)。这一格上一版少跳一级,ENOENT 被读成
// "判据没命中",实际是路径算错 —— 红先看路径,再怀疑判据。
const END_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..')

describe('兜底模型容量不得写死', () => {
  for (const rel of ['src/pages/index/index.tsx', 'src/pkg-ai/model-plaza/index.tsx']) {
    it(`${rel}:不出现容量字面量,且引用唯一出口`, () => {
      const src = readFileSync(join(END_ROOT, rel), 'utf8')
      expect(src).not.toMatch(/context_?[lL]ength\s*[:=]\s*128[_,]?000/)
      expect(src).toMatch(/getModelContextCapacity\s*\(\s*f\.value\s*\)/)
      expect(src).toMatch(/import\s*\{[^}]*getModelContextCapacity[^}]*\}\s*from\s*'@ihui\/api-client'/)
    })
  }

  it('出口本身对同一批兜底模型会给出**不同**容量(证明这不是换个名字的常数)', () => {
    // 判据要"有牙":若出口对样本 id 全给同一个值,上面那两条源码锁就只是把 128000 换了个写法。
    const caps = ['stepfun/step-router-v1', 'gpt-4o-mini', 'claude-3-haiku-20240307'].map((id) =>
      getModelContextCapacity(id),
    )
    expect(new Set(caps).size).toBeGreaterThan(1)
    expect(caps.every((c) => Number.isFinite(c) && c > 0)).toBe(true)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
