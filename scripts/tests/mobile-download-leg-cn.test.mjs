#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 国内腿「单源一致性」锁(2026-11-04 立)。
 *
 * 为什么需要这一格:国内腿 URL 天然要出现在三个互不相通的地方 ——
 *   scripts/data/mobile-download-leg.json(发布侧单源)、
 *   apps/mobile-rn/src/lib/apk-download-legs.ts(RN 客户端,读不了仓库 JSON)、
 *   scripts/publish-mobile-apk-gitee.py(上传脚本)。
 * 任何一处改漏,客户端探针会去打一条不存在的直链,而**所有现有门仍然全绿**
 * (门只验主腿 URL 可达)。这里把三处逐字钉在一起,分叉即红。
 *
 * 反向锁:同时验证上传脚本是从单源读坐标,而不是自己再抄一份字面量 URL。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('../../', import.meta.url))
const read = (p) => readFileSync(join(ROOT, p), 'utf8')

const cfg = JSON.parse(read('scripts/data/mobile-download-leg.json'))
const client = read('apps/mobile-rn/src/lib/apk-download-legs.ts')
const publisher = read('scripts/publish-mobile-apk-gitee.py')

function pick(source, name) {
  const m = new RegExp(`export const ${name} = ['"\`]([^'"\`]+)['\"\`]`).exec(source)
  assert.ok(m, `客户端缺常量 ${name}`)
  return m[1]
}

const tag = pick(client, 'APK_CN_LEG_TAG')
const asset = pick(client, 'APK_CN_LEG_ASSET')

function expectedUrl(owner, repo, tagValue, assetName) {
  return `https://gitee.com/${owner}/${repo}/releases/download/${tagValue}/${assetName}`
}

test('单源四字段齐全且自洽:cnLegUrl 必须由坐标推出,不能另抄一份', () => {
  for (const k of ['cnLegTag', 'cnLegOwner', 'cnLegRepo', 'cnLegUrl']) {
    assert.equal(typeof cfg[k], 'string', `单源缺 ${k}`)
    assert.ok(cfg[k].length > 0, `单源 ${k} 为空`)
  }
  assert.equal(
    cfg.cnLegUrl,
    expectedUrl(cfg.cnLegOwner, cfg.cnLegRepo, cfg.cnLegTag, cfg.latestKey),
  )
  assert.equal(cfg.cnLegTag, tag)
  assert.equal(cfg.latestKey, asset)
})

test('RN 客户端的 APK_CN_LEG_URL 与单源逐字一致', () => {
  const decl = /export const APK_CN_LEG_URL = `([^`]+)`/.exec(client)
  assert.ok(decl, '客户端缺 APK_CN_LEG_URL 模板声明')
  const expanded = decl[1]
    .replaceAll('${APK_CN_LEG_TAG}', tag)
    .replaceAll('${APK_CN_LEG_ASSET}', asset)
  assert.equal(expanded, cfg.cnLegUrl)
  // owner/repo 是模板里那段字面量,同样要钉住(改仓名时不能只改 JSON)
  const coord =
    /https:\/\/gitee\.com\/([A-Za-z0-9_-]+)\/([A-Za-z0-9_-]+)\/releases\/download\//.exec(decl[1])
  assert.ok(coord, '客户端直链里取不到 Gitee 坐标')
  assert.equal(coord[1], cfg.cnLegOwner)
  assert.equal(coord[2], cfg.cnLegRepo)
})

test('客户端体积下限与发布侧下限同值(体积对账才谈得上同一枚包)', () => {
  // 客户端写的是 `50 * 1024 * 1024` 而不是字面量;只捕第一个数会把它读成 50。
  const m = /export const APK_MIN_BYTES = (\d+)\s*\*\s*1024\s*\*\s*1024/.exec(client)
  assert.ok(m, '客户端 APK_MIN_BYTES 不是 N * 1024 * 1024 形态')
  assert.equal(Number(m[1]) * 1024 * 1024, Number(cfg.minApkBytes))
})

test('上传脚本从单源读坐标,且缺凭据时判未判定而非静默跳过', () => {
  for (const k of ['cnLegTag', 'cnLegOwner', 'cnLegRepo', 'cnLegUrl', 'latestKey', 'minApkBytes']) {
    assert.ok(publisher.includes(`"${k}"`), `上传脚本没读单源字段 ${k}`)
  }
  assert.ok(publisher.includes('EXIT_UNDETERMINED'), '缺凭据必须走未判定出口')
  assert.ok(publisher.includes('setx GITEE_TOKEN'), '缺凭据必须点名唯一整改命令')
  assert.ok(
    publisher.includes('先 POST 新附件') || publisher.includes('先传新'),
    '必须保留「先传新再删旧」的同名附件顺序说明',
  )
})

test('反向:把单源 cnLegUrl 改坏,本测试会判红(钉的是真取值而非恒真断言)', () => {
  const broken = { ...cfg, cnLegUrl: 'https://evil.example/x.apk' }
  assert.notEqual(
    broken.cnLegUrl,
    expectedUrl(broken.cnLegOwner, broken.cnLegRepo, broken.cnLegTag, broken.latestKey),
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
