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
import {
  findVersionDrift,
  collectInputs,
  hasVersionLiteral,
  protocolSkippedIdents,
  MOBILE_JUDGE_MESSAGES,
} from '../check-version-drift.mjs'

/** 一份"全绿"的基线输入,各用例只改其中一项 */
function baseline(over = {}) {
  return {
    tauriConf: {
      version: '0.1.75',
      bundle: { windows: { webviewInstallMode: { type: 'embedBootstrapper' } } },
    },
    desktopPkg: { version: '0.1.75' },
    mobileAppJson: { expo: { version: '0.0.8' } },
    mobilePkg: { version: '0.0.8' },
    appConfigJs: 'const v = process.env.IHUI_MOBILE_VERSION || pkg.version',
    rnConfigTs:
      'export const APP_VERSION = process.env.EXPO_PUBLIC_IHUI_MOBILE_VERSION || PKG_VERSION',
    capGradle: "versionName(System.getenv('IHUI_MOBILE_VERSION') ?: 'x')",
    downloadsConfig: "mobile: { platform: 'mobile', version: mobileRnPkg.version }",
    feedRouteJs: "import { resolveDesktopFeedForUpdater } from '@/config/desktop-feed-live'",
    feedRouteApi: "import { resolveDesktopFeedForUpdater } from '@/config/desktop-feed-live'",
    workflows: { 'sync-downloads.yml': 'run: node scripts/sync-downloads.mjs' },
    wxtConfig: "manifest: { name: 'IHUI AI', minimum_chrome_version: '114' }",
    extensionSources: {
      'apps/extension/lib/agent-control-bridge.ts':
        'function extensionVersion(): string { return chrome.runtime.getManifest().version }',
      'apps/extension/entrypoints/sidepanel/pages/AboutPage.tsx':
        'const version = chrome.runtime.getManifest().version',
    },
    versionLedger: {
      files: [{ path: 'apps/demo/report.ts', source: 'demoPkg.version', why: '演示用的上报脸' }],
      pairs: [
        {
          path: 'deploy/demo.json',
          sourcePkg: 'apps/demo/package.json',
          extracts: ['"version"\\s*:\\s*"([^"]+)"'],
          why: '演示安装器',
        },
      ],
    },
    versionFileTexts: {
      'apps/demo/report.ts': 'const v = demoPkg.version',
      'deploy/demo.json': '{ "version": "1.0.0" }',
      'apps/demo/package.json': '{ "name": "demo", "version": "1.0.0" }',
    },
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

describe('I 移动端双写一致(A 的移动端同型)', () => {
  it('app.json 与 apps/mobile-rn/package.json 版本不一致要被抓', () => {
    // 现实形态(2026-10-27 现读):app.json=0.0.8 而 package.json 还停在 0.0.6 ——
    // 未注入 IHUI_MOBILE_VERSION 的构建回落成 0.0.6,包里显示的版本号落后两个版本。
    const v = findVersionDrift(baseline({ mobilePkg: { version: '0.0.6' } }))
    assert.equal(v.length, 1)
    assert.match(v[0], /移动端版本双写不一致/)
  })

  it('真实文件形状(expo 一层包裹)下漂开必须被抓 —— 2026-10-30 的失效点', () => {
    // 真实 apps/mobile-rn/app.json 是 { expo: { version } };旧实现按顶层取 version 恒得
    // undefined,于是判据从未生效(app.json=0.0.9 / package.json=0.0.5 仍判绿)。
    // 这条用例锁的是"取到了值",不是"值等于几"。
    const v = findVersionDrift(
      baseline({
        mobileAppJson: { expo: { version: '0.0.9' } },
        mobilePkg: { version: '0.0.5' },
      }),
    )
    assert.equal(v.length, 1)
    assert.match(v[0], /移动端版本双写不一致/)
  })

  it('扁平形态仍被识别(兼容分支不许退化成只认 expo 包裹)', () => {
    const v = findVersionDrift(
      baseline({ mobileAppJson: { version: '0.0.8' }, mobilePkg: { version: '0.0.6' } }),
    )
    assert.equal(v.length, 1)
    assert.match(v[0], /移动端版本双写不一致/)
  })

  it('app.json 声明静态 android.versionCode 要被抓(无消费者的死值)', () => {
    // 构建用的是 app.config.js 的 resolveBuildNumber() 派生值;app.json 那份静态号没人读,
    // 唯一效果是与真实版本号漂开(2026-10-30 实测 26102802 vs 实产 26103001)。
    const v = findVersionDrift(
      baseline({
        mobileAppJson: { expo: { version: '0.0.8', android: { versionCode: 41503032 } } },
      }),
    )
    assert.equal(v.length, 1)
    assert.match(v[0], /I2 app\.json 声明了静态 android\.versionCode/)
  })

  it('两处一致时必须零违规(不许把这一维做成恒红)', () => {
    assert.deepEqual(findVersionDrift(baseline()), [])
  })

  it('缺一侧读数时不判(未判定不猜目录,也不冒绿:交给收集面自己报读不到)', () => {
    // findVersionDrift 的契约是"读到什么判什么";读不到由 collectInputs 侧决定是否 exit 2
    assert.deepEqual(findVersionDrift(baseline({ mobileAppJson: null })), [])
    assert.deepEqual(findVersionDrift(baseline({ mobilePkg: null })), [])
  })
})

describe('B/C 移动端版本可追溯', () => {
  it('app.config.js 丢掉 env 消费要被抓(退回人敲的死数字)', () => {
    const v = findVersionDrift(baseline({ appConfigJs: 'version: pkg.version' }))
    assert.ok(v.includes(MOBILE_JUDGE_MESSAGES.appEnvUnconsumed))
  })

  it('config.ts 丢掉 env 消费要被抓', () => {
    const v = findVersionDrift(baseline({ rnConfigTs: 'export const APP_VERSION = PKG_VERSION' }))
    assert.ok(v.includes(MOBILE_JUDGE_MESSAGES.rnEnvUnconsumed))
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

describe('J 扩展端版本单一源头', () => {
  it('J1 wxt.config.ts 写死 manifest.version 要被抓(包内版本与文件名版本分头走)', () => {
    const v = findVersionDrift(
      baseline({ wxtConfig: "manifest: { name: 'IHUI AI', version: '1.0.0' }" }),
    )
    assert.equal(v.length, 1)
    assert.match(v[0], /J1 apps\/extension\/wxt\.config\.ts/)
  })

  it('J1 缺省不声明版本(交给 WXT 回落 package.json)不得被误伤', () => {
    assert.deepEqual(findVersionDrift(baseline()), [])
  })

  it('J2 下载页 extension 资产 href 内嵌版本号要被抓(bump 后静态兜底链直接 404)', () => {
    const v = findVersionDrift(
      baseline({
        downloadsConfig:
          "extension: { assets: [{ href: '/downloads/extension/IHUI-AI-Extension-chrome-v1.0.0.zip' }] }",
      }),
    )
    assert.equal(v.length, 1)
    assert.match(v[0], /J2 downloads\.config\.ts/)
  })

  it('J2 由 extensionPkg.version 拼出的 href 不得被误伤', () => {
    const ok = baseline({
      downloadsConfig:
        'extension: { assets: [{ href: `/downloads/extension/IHUI-AI-Extension-chrome-v${extensionPkg.version}.zip` }] }',
    })
    assert.deepEqual(findVersionDrift(ok), [])
  })

  it('J3 打进包的源码里手搓版本常量要被抓(向用户/服务端上报不存在的版本)', () => {
    const v = findVersionDrift(
      baseline({
        extensionSources: {
          'apps/extension/entrypoints/sidepanel/pages/AboutPage.tsx': "const VERSION = '1.0.0'",
        },
      }),
    )
    assert.equal(v.length, 1)
    assert.match(v[0], /J3 apps\/extension\/entrypoints\/sidepanel\/pages\/AboutPage\.tsx/)
  })

  it('J3 注释里出现的版本字样不得被误伤(判字面量的门只遮注释)', () => {
    const ok = baseline({
      extensionSources: {
        'apps/extension/lib/x.ts':
          "// 历史事故:const VERSION = '1.0.0' 曾写死在这里\nexport const a = 1",
      },
    })
    assert.deepEqual(findVersionDrift(ok), [])
  })

  it('J3 采集面枚举到 0 个文件判死(覆盖面坏了不能冒绿)', () => {
    const v = findVersionDrift(baseline({ extensionSources: {} }))
    assert.equal(v.length, 1)
    assert.match(v[0], /J3 extensionSources 枚举到 0/)
  })

  it('取不到 wxt.config.ts 时不判(未判定不猜,也不冒红)', () => {
    assert.deepEqual(findVersionDrift(baseline({ wxtConfig: null })), [])
  })

  it('接线锁:真实采集面必须把 wxt.config.ts 与扩展源码都送到判据前', () => {
    // 这一条锁的是"输入接上了",不是"值等于几"—— 判据写了但采集面没带这两个键,
    // J 维就永远不会响(本仓反复出现的那型"造好没装车")。
    const inputs = collectInputs()
    assert.equal(typeof inputs.wxtConfig, 'string', 'collectInputs 未带回 wxt.config.ts')
    assert.ok(Object.keys(inputs.extensionSources).length > 0, 'collectInputs 未枚举到任何扩展源码')
    for (const rel of [
      'apps/extension/lib/agent-control-bridge.ts',
      'apps/extension/entrypoints/sidepanel/pages/AboutPage.tsx',
    ]) {
      assert.ok(inputs.extensionSources[rel] !== undefined, `采集面漏了 ${rel}`)
    }
    assert.deepEqual(findVersionDrift(inputs), [], '真实仓库面上 J 维不该有违规')
  })
})

describe('K 全端对外报版本的脸(台账对账)', () => {
  it('台账读不到或形状坏 ⇒ 判红(这一维等于没装)', () => {
    const v = findVersionDrift(baseline({ versionLedger: null }))
    assert.equal(v.length, 1)
    assert.match(v[0], /^K 台账读不到或形状坏/)
  })

  it('两侧都清空 ⇒ 判死(不许用空清单冒充通过)', () => {
    const v = findVersionDrift(baseline({ versionLedger: { files: [], pairs: [] } }))
    assert.equal(v.length, 1)
    assert.match(v[0], /K 台账两侧都枚举到 0 条/)
  })

  it('K1 台账点名的文件里写死版本 ⇒ 被抓', () => {
    const v = findVersionDrift(
      baseline({
        versionFileTexts: { 'apps/demo/report.ts': 'const SERVER_VERSION = "1.0.0"' },
      }),
    )
    assert.ok(
      v.some((x) => /^K1 apps\/demo\/report\.ts 里有手搓的版本字面量/.test(x)),
      v.join('\n'),
    )
  })

  it('K1 协议版本常量不得被误伤(它是契约,本就该写死)', () => {
    const ok = baseline({
      versionFileTexts: {
        'apps/demo/report.ts': 'const PROTOCOL_VERSION = "2026.09.18"\nconst v = demoPkg.version',
        'deploy/demo.json': '{ "version": "1.0.0" }',
        'apps/demo/package.json': '{ "name": "demo", "version": "1.0.0" }',
      },
    })
    assert.deepEqual(findVersionDrift(ok), [])
  })

  it('K1 台账点名的文件在仓里读不到 ⇒ 判红(路径腐烂不静默)', () => {
    const v = findVersionDrift(baseline({ versionFileTexts: {} }))
    assert.ok(
      v.some((x) => /^K1 台账点名的文件在仓里读不到/.test(x)),
      v.join('\n'),
    )
  })

  it('K2 安装器清单版本 ≠ 被打包的包版本 ⇒ 被抓(装到旧包)', () => {
    const v = findVersionDrift(
      baseline({
        versionFileTexts: {
          'apps/demo/report.ts': 'const v = demoPkg.version',
          'deploy/demo.json': '{ "version": "1.0.0" }',
          'apps/demo/package.json': '{ "version": "1.0.1" }',
        },
      }),
    )
    assert.ok(
      v.some((x) => /^K2 deploy\/demo\.json 写着 1\.0\.0/.test(x)),
      v.join('\n'),
    )
  })

  it('K2 逐字相等 ⇒ 零违规(不许把这一维做成恒红)', () => {
    assert.deepEqual(findVersionDrift(baseline()), [])
  })

  it('K2 正则枚举到 0 处 ⇒ 判红(台账与文件脱节要人说一次)', () => {
    const v = findVersionDrift(
      baseline({
        versionFileTexts: {
          'apps/demo/report.ts': 'const v = demoPkg.version',
          'deploy/demo.json': '{ "pkgVersion": "1.0.0" }',
          'apps/demo/package.json': '{ "version": "1.0.0" }',
        },
      }),
    )
    assert.ok(
      v.some((x) => /^K2 deploy\/demo\.json 按 .* 枚举到 0 处/.test(x)),
      v.join('\n'),
    )
  })

  it('接线锁:真实台账必须载得动,且真实仓库面上 K 维零违规', () => {
    const inputs = collectInputs()
    assert.ok(inputs.versionLedger, 'collectInputs 没带回 K 台账')
    assert.ok(inputs.versionLedger.files.length > 0, 'K1 台账为空')
    assert.ok(inputs.versionLedger.pairs.length > 0, 'K2 台账为空')
    // 台账点名的每一枚路径都必须在取材面里(否则"判了"只是没读)
    for (const e of inputs.versionLedger.files) {
      assert.equal(typeof inputs.versionFileTexts[e.path], 'string', `K1 未取到 ${e.path}`)
    }
    for (const e of inputs.versionLedger.pairs) {
      assert.equal(typeof inputs.versionFileTexts[e.path], 'string', `K2 未取到 ${e.path}`)
      assert.equal(
        typeof inputs.versionFileTexts[e.sourcePkg],
        'string',
        `K2 未取到 ${e.sourcePkg}`,
      )
    }
    assert.deepEqual(findVersionDrift(inputs), [], '真实仓库面上 K 维不该有违规')
  })
})

describe('G 的行注释维(2026-11-04 补,治 YAML 叙述行假红)', () => {
  it('整行注释里的 git push … main 不判(它不执行;release-desktop.yml:994 就是这么被冤枉的)', () => {
    const ok = baseline({
      workflows: {
        'release-desktop.yml':
          '#      sync-gitee.py 已改为「先 git push refs/tags/<tag>(指向 Gitee 快照 main 提交)」\n',
      },
    })
    assert.deepEqual(findVersionDrift(ok), [])
  })

  it('行尾注释不得成为出路(命令真执行 ⇒ 照判,判据不许顺手削)', () => {
    const v = findVersionDrift(
      baseline({ workflows: { 'x.yml': 'run: git push origin main # 推 main\n' } }),
    )
    assert.ok(
      v.some((x) => /bot 裸 push 到 main/.test(x)),
      v.join('\n'),
    )
  })

  it('run 块里的 shell 注释行同样不判', () => {
    const ok = baseline({
      workflows: { 'x.yml': 'run: |\n  # git push origin main 的旧写法已废弃\n  echo ok\n' },
    })
    assert.deepEqual(findVersionDrift(ok), [])
  })
})

describe('K1 遮罩与"放过必须可见"(2026-11-04 复核补齐)', () => {
  const texts = () => ({
    'apps/demo/report.ts': 'const v = demoPkg.version',
    'deploy/demo.json': '{ "version": "1.0.0" }',
    'apps/demo/package.json': '{ "name": "demo", "version": "1.0.0" }',
  })

  it('.py 里整行 # 注释写成赋值形 ⇒ 不判(注释不是代码)', () => {
    const ok = baseline({
      versionLedger: {
        files: [
          {
            path: 'apps/demo/x.py',
            source: 'app.__version__',
            why: 'Python 侧的上报脸',
          },
        ],
        pairs: [],
      },
      versionFileTexts: {
        ...texts(),
        'apps/demo/x.py': '# 历史写法 SERVER_VERSION = "1.0.0" 已废弃\ncode = 1\n',
      },
    })
    assert.deepEqual(findVersionDrift(ok), [])
  })

  it('.py 里真赋值 SERVER_VERSION = "1.0.0" ⇒ 照判(遮罩没把判据一起遮掉)', () => {
    const v = findVersionDrift(
      baseline({
        versionLedger: {
          files: [{ path: 'apps/demo/x.py', source: 'app.__version__', why: 'Python 侧的上报脸' }],
          pairs: [],
        },
        versionFileTexts: { ...texts(), 'apps/demo/x.py': 'SERVER_VERSION = "1.0.0"\n' },
      }),
    )
    assert.ok(
      v.some((x) => /^K1 apps\/demo\/x\.py/.test(x)),
      v.join('\n'),
    )
  })

  it('因 protocol 放过的枚数必须被数出来(改名绕门时这行数会从 >0 变 0)', () => {
    const ids = protocolSkippedIdents('PROTOCOL_VERSION = "2026.09.18"\n', 'apps/demo/x.py')
    assert.deepEqual(ids, ['PROTOCOL_VERSION'])
    assert.equal(hasVersionLiteral('PROTOCOL_VERSION = "2026.09.18"\n', 'apps/demo/x.py'), false)
  })

  it('K2 提取式必须容忍无引号写法(YAML 常这么写,不能因此假红)', () => {
    const led = {
      files: [{ path: 'apps/demo/report.ts', source: 'demoPkg.version', why: '演示' }],
      pairs: [
        {
          path: 'deploy/demo.yaml',
          sourcePkg: 'apps/demo/package.json',
          extracts: ['^version:\\s*[\'"]?([^\'"\\s#]+)[\'"]?\\s*(?:#.*)?$'],
          why: '演示安装器',
        },
      ],
    }
    const ok = baseline({
      versionLedger: led,
      versionFileTexts: {
        'apps/demo/report.ts': 'const v = demoPkg.version',
        'deploy/demo.yaml': 'version: 1.0.0\n',
        'apps/demo/package.json': '{ "version": "1.0.0" }',
      },
    })
    assert.deepEqual(findVersionDrift(ok), [])
    const bad = baseline({
      versionLedger: led,
      versionFileTexts: {
        'apps/demo/report.ts': 'const v = demoPkg.version',
        'deploy/demo.yaml': 'version: 9.9.9\n',
        'apps/demo/package.json': '{ "version": "1.0.0" }',
      },
    })
    assert.ok(
      findVersionDrift(bad).some((x) => /K2 deploy\/demo\.yaml 写着 9\.9\.9/.test(x)),
      '无引号形态的值不一致必须照样被抓',
    )
  })

  it('接线锁加强:真实台账每条 extracts 在真实文件里都必须取到值(取不到=尺子已瞎)', () => {
    const inputs = collectInputs()
    for (const e of inputs.versionLedger.pairs) {
      const manifestText = inputs.versionFileTexts[e.path]
      for (const pat of e.extracts) {
        const hits = [...String(manifestText).matchAll(new RegExp(pat, 'gm'))]
        assert.ok(hits.length > 0, `${e.path} 的提取式 ${pat} 在真实文件里枚举到 0 处`)
      }
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
