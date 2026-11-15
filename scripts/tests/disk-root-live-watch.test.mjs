#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


/**
 * §22c 镜像测试 —— scripts/lib/disk-root-live-watch.mjs 严口径
 *
 * 钉死四件事:
 *   L1 严口径白名单读数:D 盘只认 8 条(项目3 + 系统件),不含历史申报的用户目录(BaiduSyncdisk 等);
 *   L2 白名单外条目出现 ⇒ onStray 被调,报出完整路径 + 事件类型;
 *   L3 白名单内条目出现 ⇒ onStray 不被调(放行);
 *   L4 子目录深路径(递归=false 防御) ⇒ 忽略,不当外流。
 *
 * 判据单一真相源:白名单 = config/disk-root-allowlist.json 的 roots.liveWatch.allow(严口径节)。
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { loadAllowlist, startDiskRootLiveWatch } from '../lib/disk-root-live-watch.mjs'

/** 真实 config 的严口径读数(L1 用)。 */
const realAllowlist = loadAllowlist()

/** 注入用的假 watch:捕获回调,测试里手动触发。 */
const makeFakeWatch = () => {
  const callbacks = []
  const impl = (root, opts, cb) => {
    callbacks.push({ root, cb })
    return { close: () => {} }
  }
  return { impl, callbacks }
}

test('L1 严口径白名单:D 盘只认项目+系统件,不含历史申报的用户目录', async () => {
  assert.ok(realAllowlist, '取不到 config/disk-root-allowlist.json')
  const d = realAllowlist.get('D:\\')
  assert.ok(d, 'D 盘白名单缺失')
  // 项目必在
  for (const need of ['IHUI-AI', 'IHUI-AI-git-repo', 'DevEnv', 'tmp']) {
    assert.ok(d.has(need), `D 严口径须含 ${need}`)
  }
  // 系统件必在(注意:D 盘无 swapfile.sys,那是 C 盘件;严口径须 ⊆ H1 宽 allow,只窄不宽)
  for (const sys of ['pagefile.sys', '$RECYCLE.BIN', 'System Volume Information']) {
    assert.ok(d.has(sys), `D 严口径须含系统件 ${sys}`)
  }
  // 历史申报的用户目录必须被剔出实时监听(写入即点名)
  for (const notIn of ['BaiduSyncdisk', '桌面', 'Code', '小米云盘', '智汇AI', '小浣熊', '电脑软件', '系统配套软件', 'Huorong', 'XiaomiCloudTemp']) {
    assert.ok(!d.has(notIn), `D 严口径须剔出 ${notIn}(严口径只窄不宽,写入即点名)`)
  }
  // 严口径 D 集必须比卫生尺 H1 的宽 allow 更紧(只窄不宽)
  const h1 = JSON.parse(
    // 单一真相源:直接读卫生尺那份宽 allow,断言实时层是它的子集
    (
      await import('node:fs')
    ).readFileSync(new URL('../../config/disk-root-allowlist.json', import.meta.url), 'utf8'),
  )
  const h1D = new Set(h1.roots['D:\\'].allow)
  for (const e of d) assert.ok(h1D.has(e), `严口径条目 ${e} 不在卫生尺宽 allow 里 ⇒ 实时层反被放宽,违约只窄不宽`)
})

test('L2 白名单外条目出现 ⇒ onStray 报完整路径+事件', () => {
  const { impl, callbacks } = makeFakeWatch()
  const strays = []
  const handle = startDiskRootLiveWatch({
    roots: ['D:\\'],
    allowlist: realAllowlist,
    onStray: (p, ev) => strays.push({ p, ev }),
    _watchImpl: impl,
  })
  assert.equal(callbacks.length, 1, 'D 盘应挂一个 watch')
  // 模拟盘根出现百度网盘(严口径外)—— 实时层必须当场抓
  callbacks[0].cb('rename', 'BaiduSyncdisk')
  assert.equal(strays.length, 1, '白名单外条目须触发 onStray')
  assert.match(strays[0].p, /BaiduSyncdisk/, '须报出条目名')
  assert.equal(strays[0].ev, 'rename', '须带上事件类型')
  handle.close()
})

test('L3 白名单内条目出现 ⇒ 放行(onStray 不触发)', () => {
  const { impl, callbacks } = makeFakeWatch()
  const strays = []
  const handle = startDiskRootLiveWatch({
    roots: ['D:\\'],
    allowlist: realAllowlist,
    onStray: (p, ev) => strays.push({ p, ev }),
    _watchImpl: impl,
  })
  for (const ok of ['IHUI-AI', 'DevEnv', 'tmp', 'pagefile.sys']) {
    callbacks[0].cb('change', ok)
  }
  assert.equal(strays.length, 0, '白名单内条目须全部放行')
  handle.close()
})

test('L4 子目录深路径 ⇒ 忽略(一级外条目才算外流)', () => {
  const { impl, callbacks } = makeFakeWatch()
  const strays = []
  const handle = startDiskRootLiveWatch({
    roots: ['D:\\'],
    allowlist: realAllowlist,
    onStray: (p, ev) => strays.push({ p, ev }),
    _watchImpl: impl,
  })
  // 递归=false 下理论不给深路径,防御性再滤
  callbacks[0].cb('rename', 'SomeDir\\file.txt')
  callbacks[0].cb('rename', 'a/b')
  assert.equal(strays.length, 0, '深路径须忽略')
  // filename=null/Buffer(平台差异) ⇒ 跳过不猜
  callbacks[0].cb('rename', null)
  callbacks[0].cb('rename', Buffer.from('x'))
  assert.equal(strays.length, 0, '非字符串 filename 须跳过')
  handle.close()
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
