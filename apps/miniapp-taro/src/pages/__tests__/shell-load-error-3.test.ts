// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * XUI-066(第 2b 组):资讯列表/VIP/直播订阅 三个壳把加载失败写死成 error="",
 * 共享屏只能显示空列表(VIP 还会退回写死价),用户既看不出失败也无法重试。
 * 本夹具钉住每屏都有真实 loadError。
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const APP_ROOT = join(__dirname, '..', '..', '..')
const read = (p: string) => readFileSync(join(APP_ROOT, p), 'utf8')

const SHELLS: Array<[string, string]> = [
  ['news-list', 'src/pkg-content/news/list.tsx'],
  ['vip-index', 'src/pkg-shop/vip/index.tsx'],
  ['live-subscribe', 'src/pkg-learn/live/subscribe.tsx'],
]

describe('XUI-066 组2b:壳必须把加载失败上抛', () => {
  for (const [name, path] of SHELLS) {
    it(`${name} 不再写死 error=""`, () => {
      const src = read(path)
      expect(src).not.toContain('error=""')
      expect(src).toContain('error={loadError}')
      expect(src).toContain('const [loadError, setLoadError] = useState(')
      expect(src.match(/setLoadError\(/g)?.length).toBe(2)
    })
  }

  it('失败态不再只靠一次性 toast', () => {
    for (const [, path] of SHELLS) {
      const src = read(path)
      expect(src).toContain("setLoadError('')")
      expect(src).toMatch(/setLoadError\((?:t|tt)\('common\.loadFailed'/ )
    }
  })
})
