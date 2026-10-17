// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * resolve-mobile-version 单测(2026-10-17)。
 *
 * 钉死三条"版本号必须自动"的判据:
 *   ① 同一天内多次调用结果幂等(否则同一个构建也可能算出两个号);
 *   ② 跨天必然变大 —— 这是"自动更新"的全部含义:不允许出现"发了新包但版本号没动";
 *   ③ 基底为空时不吐出半个版本号 `undefined.20261017`,那是把错误吞进串里。
 * 另锁 release kind 不再加日期戳(正式发版的版本号由人推进,不该被构建时刻污染)。
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { resolveMobileVersion, parseArgs, mainCore } from '../resolve-mobile-version.mjs'

describe('resolveMobileVersion', () => {
  it('按 UTC 日期派生,同一天幂等', () => {
    const at = new Date('2026-10-17T08:00:00Z')
    assert.equal(resolveMobileVersion({ base: '0.0.5', at }), '0.0.5.20261017')
    assert.equal(
      resolveMobileVersion({ base: '0.0.5', at }),
      resolveMobileVersion({ base: '0.0.5', at }),
    )
  })

  it('跨天必然变大(每次发新包用户都能看到新号)', () => {
    const v1 = resolveMobileVersion({ base: '0.0.5', at: new Date('2026-10-17T00:00:00Z') })
    const v2 = resolveMobileVersion({ base: '0.0.5', at: new Date('2026-10-18T00:00:00Z') })
    assert.equal(v2, '0.0.5.20261018')
    assert.equal(v2 > v1, true)
  })

  it('基底为空时不产出半个版本号', () => {
    const at = new Date('2026-10-17T00:00:00Z')
    assert.equal(resolveMobileVersion({ base: '', at }), '0.0.0')
    assert.equal(resolveMobileVersion({ base: null, at }), '0.0.0')
  })

  it('release kind 不再加日期戳(正式版本号由人推进)', () => {
    assert.equal(
      resolveMobileVersion({
        base: '1.2.3',
        at: new Date('2026-10-17T00:00:00Z'),
        kind: 'release',
      }),
      '1.2.3',
    )
  })

  it('release kind 且给了 tag 时,tag 里的版本号优先于 base', () => {
    // 实测到过的真实形态:APK 的 release tag 是 v0.1.74(仓库级版本),而 base 是 package.json
    // 的 0.0.5 —— 不取 tag 就会"下载页显示 0.1.74、装到手机上 App 内显示 0.0.5"。
    assert.equal(resolveMobileVersion({ base: '0.0.5', tag: 'v0.1.74', kind: 'release' }), '0.1.74')
    assert.equal(
      resolveMobileVersion({ base: '0.0.5', tag: 'mobile-v2.3.4', kind: 'release' }),
      '2.3.4',
    )
  })

  it('tag 里取不到语义版本时回退 base,不产出半个号', () => {
    assert.equal(
      resolveMobileVersion({ base: '0.0.5', tag: 'nightly-38704094092', kind: 'release' }),
      '0.0.5',
    )
  })
})

describe('parseArgs', () => {
  it('未知名参与非法 kind 都要报错(静默回落会把拼错的变量变成假版本)', () => {
    assert.ok(parseArgs(['--nope']).error)
    assert.ok(parseArgs(['--kind', 'weekly']).error)
    assert.equal(parseArgs(['--kind', 'release']).kind, 'release')
  })
})

describe('mainCore', () => {
  it('--emit github 同时给出原生与 bundle 两把钥匙,且是同一个值', () => {
    const r = mainCore({ base: '0.0.5', emit: 'github', at: new Date('2026-10-17T00:00:00Z') })
    assert.equal(r.error, undefined)
    assert.deepEqual(r.lines, [
      'IHUI_MOBILE_VERSION=0.0.5.20261017',
      'EXPO_PUBLIC_IHUI_MOBILE_VERSION=0.0.5.20261017',
    ])
  })

  it('读不到 app 的 package.json 要报错,不许悄悄回退', () => {
    assert.ok(mainCore({ app: 'does-not-exist' }).error)
  })
})
