// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * XUI-015 / XUI-037 / XUI-044 接线锁(小程序)。
 * 三者都发生在 Taro 生命周期/路由注册的边界,node 环境无法真跑页面,
 * 沿用本仓源码级自证:把"路由必须与注册表一致""loading 必须 finally 关""timer 必须可取消"钉住。
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const APP_ROOT = join(__dirname, '..', '..', '..')
const read = (p: string) => readFileSync(join(APP_ROOT, p), 'utf8')

const SETTING = read('src/pages/setting/index.tsx')
const APP_CONFIG = read('src/app.config.ts')
const ALBUM = read('src/utils/save-album.ts')
const WEBVIEW = read('src/pages/webview/index.tsx')

describe('XUI-015 注销账号路由必须命中注册页', () => {
  it('setting 菜单用 /pkg-user/account-cancel/index(不再多一段 /index)', () => {
    expect(SETTING).toContain("accountCancel: '/pkg-user/account-cancel/index'")
    expect(SETTING).not.toContain("accountCancel: '/pkg-user/account-cancel/index/index'")
  })

  it('该路由确实注册在 app.config.ts 子包里(阴性对照)', () => {
    expect(APP_CONFIG).toContain("'account-cancel/index'")
  })
})

describe('XUI-037 保存相册 loading 必须 finally 关闭', () => {
  it('hideLoading 写在 finally(成功/失败都关)', () => {
    expect(ALBUM).toMatch(/finally \{[\s\S]*?Taro\.hideLoading\(\)/)
  })

  it('不再只在 catch 分支关闭(旧病灶)', () => {
    expect(ALBUM).not.toMatch(/catch \(err\) \{\s*Taro\.hideLoading\(\)/)
  })
})

describe('XUI-044 webview reLaunch 定时器必须可取消', () => {
  it('定时器 id 落到 ref,并在卸载 cleanup 中 clearTimeout', () => {
    expect(WEBVIEW).toContain('const reLaunchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)')
    expect(WEBVIEW).toMatch(/clearTimeout\(reLaunchTimerRef\.current\)/)
  })

  it('reLaunch 由 ref 中的定时器触发,不再裸 setTimeout', () => {
    expect(WEBVIEW).toMatch(/reLaunchTimerRef\.current = setTimeout\(/)
    expect(WEBVIEW).not.toMatch(/setTimeout\(\(\) => reLaunch\(/)
  })
})
