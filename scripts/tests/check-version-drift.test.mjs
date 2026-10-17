// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-version-drift 镜像测试(2026-10-17)。
 *
 * 取向:每一条判据都要有一个**能被这条判据抓住的反例**。守门最容易变成摆设的方式,
 * 就是"它在真实仓库上通过"—— 那只能证明现状干净,不能证明它拦得住回退。
 * 所以这里对 A–G 逐条喂反例,并要求违规描述里出现可辨认的关键词。
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { findVersionDrift } from '../check-version-drift.mjs'

/** 一份"全绿"的基线输入,各用例只改其中一项 */
function baseline(over = {}) {
  return {
    tauriConf: {
      version: '0.1.75',
      bundle: { windows: { webviewInstallMode: { type: 'embedBootstrapper' } } },
    },
    desktopPkg: { version: '0.1.75' },
    appConfigJs: 'const v = process.env.IHUI_MOBILE_VERSION || pkg.version',
    rnConfigTs:
      'export const APP_VERSION = process.env.EXPO_PUBLIC_IHUI_MOBILE_VERSION || PKG_VERSION',
    capGradle: "versionName(System.getenv('IHUI_MOBILE_VERSION') ?: 'x')",
    downloadsConfig: "mobile: { platform: 'mobile', version: mobileRnPkg.version }",
    feedRouteJs: "import { resolveDesktopFeedForUpdater } from '@/config/desktop-feed-live'",
    feedRouteApi: "import { resolveDesktopFeedForUpdater } from '@/config/desktop-feed-live'",
    workflows: { 'sync-downloads.yml': 'run: node scripts/sync-downloads.mjs' },
    ...over,
  }
}

describe('check-version-drift 基线', () => {
  it('基线输入必须零违规(否则反例测试会失去区分度)', () => {
    assert.deepEqual(findVersionDrift(baseline()), [])
  })
})

describe('A 桌面双写一致', () => {
  it('tauri.conf 与 package.json 版本不一致要被抓', () => {
    const v = findVersionDrift(baseline({ desktopPkg: { version: '0.1.73' } }))
    assert.equal(v.length, 1)
    assert.match(v[0], /桌面版本双写不一致/)
  })
})

describe('B/C 移动端版本可追溯', () => {
  it('app.config.js 丢掉 env 消费要被抓(退回人敲的死数字)', () => {
    const v = findVersionDrift(baseline({ appConfigJs: 'version: pkg.version' }))
    assert.ok(v.some((x) => /app\.config\.js 未消费 IHUI_MOBILE_VERSION/.test(x)))
  })

  it('config.ts 丢掉 env 消费要被抓', () => {
    const v = findVersionDrift(baseline({ rnConfigTs: 'export const APP_VERSION = PKG_VERSION' }))
    assert.ok(v.some((x) => /APP_VERSION 未消费/.test(x)))
  })
})

describe('D Capacitor 不得写死', () => {
  it('versionName "1.0" 这种字面量要被抓', () => {
    const v = findVersionDrift(baseline({ capGradle: '        versionName "1.0"' }))
    assert.ok(v.some((x) => /versionName 又被写死/.test(x)))
  })

  it('versionCode 1 这种字面量要被抓', () => {
    const v = findVersionDrift(baseline({ capGradle: '        versionCode 1' }))
    assert.ok(v.some((x) => /versionCode 又被写死/.test(x)))
  })

  it('读 env 的写法不得被误伤', () => {
    const ok = baseline({
      capGradle: "versionCode Integer.parseInt(System.getenv('IHUI_VERSION_CODE') ?: '1')",
    })
    assert.deepEqual(findVersionDrift(ok), [])
  })
})

describe('E 下载页不得有假号', () => {
  it("四端任一写死 '1.0.0' 都要被抓", () => {
    for (const p of ['web', 'mobile', 'extension', 'cli']) {
      const v = findVersionDrift(
        baseline({ downloadsConfig: `${p}: { platform: '${p}', version: '1.0.0' }` }),
      )
      assert.ok(
        v.some((x) => /写死了版本号字面量/.test(x)),
        `${p} 未被抓到`,
      )
    }
  })

  it('desktop 的离线兜底常量(不在四端清单内)不得被误伤', () => {
    const ok = baseline({ downloadsConfig: "const DESKTOP_FALLBACK = { version: '0.1.14' }" })
    assert.deepEqual(findVersionDrift(ok), [])
  })
})

describe('F 更新器 feed 必须走运行期解析', () => {
  it('退回读静态快照要被抓', () => {
    const v = findVersionDrift(
      baseline({ feedRouteJs: "import { DESKTOP_FEED } from '@/config/desktop-feed.generated'" }),
    )
    assert.ok(v.some((x) => /desktop-feed\.json\/route\.ts 未走/.test(x)))
  })
})

describe('G 不得再有 bot 裸 push 到 main', () => {
  it('裸 git push 要被抓(它是 GH006 死锁的唯一形态)', () => {
    const v = findVersionDrift(
      baseline({ workflows: { 'sync-downloads.yml': 'run: |\n  git commit -m x\n  git push\n' } }),
    )
    assert.ok(v.some((x) => /bot 裸 push 到 main/.test(x)))
  })

  it('git push origin main 形态同样要被抓', () => {
    const v = findVersionDrift(
      baseline({ workflows: { 'release-desktop.yml': 'run: git push origin main\n' } }),
    )
    assert.ok(v.some((x) => /release-desktop\.yml 出现 bot 裸 push/.test(x)))
  })

  it('推送到其它分支不得被误伤', () => {
    const ok = baseline({
      workflows: { 'x.yml': 'run: git push origin HEAD:refs/heads/bot/foo\n' },
    })
    assert.deepEqual(findVersionDrift(ok), [])
  })
})

describe('H 桌面安装包不得回到 offlineInstaller', () => {
  it('offlineInstaller 要被抓(它让 exe 超 Gitee 100MB 硬上限,国内下载不到)', () => {
    const v = findVersionDrift(
      baseline({
        tauriConf: {
          version: '0.1.75',
          bundle: { windows: { webviewInstallMode: { type: 'offlineInstaller' } } },
        },
      }),
    )
    assert.ok(v.some((x) => /回到 offlineInstaller/.test(x)))
  })

  it('embedBootstrapper / downloadBootstrapper 不得被误伤', () => {
    for (const type of ['embedBootstrapper', 'downloadBootstrapper']) {
      const ok = baseline({
        tauriConf: { version: '0.1.75', bundle: { windows: { webviewInstallMode: { type } } } },
      })
      assert.deepEqual(findVersionDrift(ok), [], `${type} 被误伤`)
    }
  })

  it('配置缺 bundle 段时不得崩(旧形态快照)', () => {
    assert.deepEqual(findVersionDrift(baseline({ tauriConf: { version: '0.1.75' } })), [])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
