// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// §22c 镜像测试:scripts/resolve-desktop-download.mjs 的 Gitee 字节对账判据。
// 判据只有一份 —— 这里 import 源脚本,不复制常量。
//
// 立因(2026-10-18):快照生成器过去对 Windows 直链做**无条件 host 盲钉**(forceGiteeWindowsExe),
// 只要名字能拼出来就当 Gitee 有那份字节。两条实锤:
//   ① desktop-v0.1.75:Gitee 同名 exe 10,118,299 字节,CI 签名覆盖的是 10,122,472 字节
//      ⇒ 签名配到别人的字节上,客户端下载成功而验签必失败,自动更新静默失效;
//   ② 0.1.54 那份入库快照被钉到 Gitee 根本没镜像的 tag ⇒ 直链实测 404,
//      live 一取不到就同时给出「降级 21 版」+「死链」。
// 失败方向必须是"多要一次说明"(量不到 ⇒ 保持 GitHub 并大声报未判定),
// 绝不能是"多放一次盲钉"。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { giteeBytesVerdict } from '../resolve-desktop-download.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

test('正例:两侧等长 ⇒ same', () => {
  assert.equal(giteeBytesVerdict(10122472, 10122472), 'same')
})

test('反例(事故复现):同名差 4173 字节 ⇒ different,不得采信 Gitee', () => {
  assert.equal(giteeBytesVerdict(10122472, 10118299), 'different')
})

test('未判定档必须存在:任一侧 size 拿不到都不算"对上了"', () => {
  assert.equal(giteeBytesVerdict(10122472, 0), 'undetermined')
  assert.equal(giteeBytesVerdict(0, 10122472), 'undetermined')
  assert.equal(giteeBytesVerdict(undefined, 10122472), 'undetermined')
  assert.equal(giteeBytesVerdict(10122472, null), 'undetermined')
})

test('变异自证:把"两侧都量不到"判成 same 的写法必须被这条打死(0 vs 0 ⇒ undetermined)', () => {
  // 这一格是整个判据最容易静默失效的方向:size 缺省值是 0,两侧都是 0 时
  // `a === b` 会成立 —— 若没有前面的"量不到"闸门,就会把"一次都没量"写成"字节一致"。
  assert.equal(giteeBytesVerdict(0, 0), 'undetermined')
  assert.notEqual(giteeBytesVerdict(0, 0), 'same')
})

test('非数值输入不得当成 same(字符串/NaN 形态一律未判定)', () => {
  assert.equal(giteeBytesVerdict('100', '100'), 'same') // Number() 归一后等长 ⇒ 合法
  assert.equal(giteeBytesVerdict('abc', 100), 'undetermined')
  assert.equal(giteeBytesVerdict(NaN, NaN), 'undetermined')
})

test('接线锁:盲钉必须已从源里消失,且两条合并都真的调用这把尺子(防被判据改名后悄悄退回)', () => {
  const src = readFileSync(join(ROOT, 'resolve-desktop-download.mjs'), 'utf8')
  assert.ok(!/forceGiteeWindowsExe/.test(src), 'forceGiteeWindowsExe 仍在源里 ⇒ host 又被无条件钉了')
  const calls = src.match(/giteeBytesVerdict\(/g) || []
  // 定义处 1 次 + assets 合并 1 次 + updater 合并 1 次;少一次就是有一侧没对账。
  assert.ok(calls.length >= 3, `giteeBytesVerdict 调用点应 ≥3(定义+两侧合并),实得 ${calls.length}`)
  assert.ok(/giteeBytesVerdict\(a\.sizeBytes, g\.sizeBytes\)/.test(src), 'assets 侧未按字节对账')
  assert.ok(/giteeBytesVerdict\(gh\.size, g\.size\)/.test(src), 'updater 侧未按字节对账')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
