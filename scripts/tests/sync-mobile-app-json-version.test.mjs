// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * sync-mobile-app-json-version 镜像测试(2026-11-07)。
 *
 * 取向(与门 214 的镜像测试同族):每条判据都要有一个**能被它抓住的反例**,
 * 否则"它在当前仓库上算对了"只证明现状干净,不证明它拦得住回退。
 *
 * 锁四件事:
 *  ① 只动 expo.version 那一处字符串 —— 其余字节逐字不动(不重排行内数组、不重排键序);
 *  ② 同一输入跑两次字节一致(可复现),且第二次判 changed=false(幂等);
 *  ③ 缺 expo.version / 坏 JSON / 非语义版本一律**拒绝**,不猜写入位置;
 *  ④ 文件里另有同值 version 字面量时,替换点仍落在 expo 那份(改错了会被自校验拒绝)。
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { deriveAppJsonVersion } from '../sync-mobile-app-json-version.mjs'

const APP_JSON = `{
  "expo": {
    "name": "IHUI AI",
    "slug": "ihui-ai-mobile",
    "version": "0.0.5",
    "ios": {
      "infoPlist": {
        "LSApplicationQueriesSchemes": ["weixin", "wechat"]
      }
    },
    "plugins": [
      ["expo-camera", { "cameraPermission": "允许使用相机" }]
    ]
  }
}
`

describe('deriveAppJsonVersion: 正向派生', () => {
  it('把 expo.version 写成 package.json 的版本,且只动这一处字符串', () => {
    const r = deriveAppJsonVersion(APP_JSON, '0.0.12')
    assert.equal(r.ok, true)
    assert.equal(r.changed, true)
    assert.equal(r.from, '0.0.5')
    assert.equal(r.to, '0.0.12')
    // 最小编辑:除了值 token,其余字节逐字保留(行内数组不被展开、键序不变)
    assert.equal(r.text, APP_JSON.replace('"version": "0.0.5"', '"version": "0.0.12"'))
  })

  it('同一输入跑两次字节一致,第二次判 changed=false(幂等)', () => {
    const first = deriveAppJsonVersion(APP_JSON, '0.0.12')
    const second = deriveAppJsonVersion(first.text, '0.0.12')
    assert.equal(second.changed, false)
    assert.equal(second.text, first.text)
    const again = deriveAppJsonVersion(APP_JSON, '0.0.12')
    assert.equal(again.text, first.text)
  })

  it('prerelease 后缀也按真源原样写入', () => {
    const r = deriveAppJsonVersion(APP_JSON, '0.1.0-beta.1')
    assert.equal(r.ok, true)
    assert.equal(r.text.includes('"version": "0.1.0-beta.1"'), true)
  })
})

describe('deriveAppJsonVersion: 反例(拒绝而不是猜)', () => {
  it('缺 expo.version ⇒ ok=false', () => {
    const r = deriveAppJsonVersion('{ "expo": { "name": "x" } }', '0.0.12')
    assert.equal(r.ok, false)
    assert.match(r.error, /expo\.version/)
  })

  it('坏 JSON ⇒ ok=false', () => {
    const r = deriveAppJsonVersion('{ "expo": ', '0.0.12')
    assert.equal(r.ok, false)
    assert.match(r.error, /JSON/)
  })

  it('package.json 版本不是语义版本 ⇒ ok=false(不把名字/分支当版本写进去)', () => {
    const r = deriveAppJsonVersion(APP_JSON, 'latest')
    assert.equal(r.ok, false)
    assert.match(r.error, /语义版本/)
  })

  it('另有同值 version 字面量时,替换点仍落在 expo 那份', () => {
    const text = `{
  "expo": { "name": "x", "version": "0.0.5" },
  "extra": { "version": "0.0.5" }
}
`
    const r = deriveAppJsonVersion(text, '0.0.12')
    assert.equal(r.ok, true)
    assert.equal(r.text.includes('"expo": { "name": "x", "version": "0.0.12" }'), true)
    assert.equal(r.text.includes('"extra": { "version": "0.0.5" }'), true)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
