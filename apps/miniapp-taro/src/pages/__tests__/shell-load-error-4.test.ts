// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * XUI-066(第 3a 组):消息中心/推广排行/隐私设置 三个壳把加载失败写死成 error="",
 * 共享屏只能显示空列表/「全部未知」,用户既看不出失败也无法重试。
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const APP_ROOT = join(__dirname, '..', '..', '..')
const read = (p: string) => readFileSync(join(APP_ROOT, p), 'utf8')

const SHELLS: Array<[string, string]> = [
  ['message-center', 'src/pkg-user/message/index.tsx'],
  ['distribution-rank', 'src/pages/distribution/rank.tsx'],
  ['setting-privacy', 'src/pages/setting/privacy.tsx'],
]

describe('XUI-066 组3a:壳必须把加载失败上抛', () => {
  for (const [name, path] of SHELLS) {
    it(`${name} 不再写死 error=""`, () => {
      const src = read(path)
      expect(src).not.toContain('error=""')
      expect(src).toContain('error={loadError}')
      expect(src).toContain('const [loadError, setLoadError] = useState(')
      expect(src.match(/setLoadError\(/g)?.length).toBeGreaterThanOrEqual(2)
      expect(src).toMatch(/setLoadError\((?:t|tt)\('common\.loadFailed'\)/)
    })
  }
})
