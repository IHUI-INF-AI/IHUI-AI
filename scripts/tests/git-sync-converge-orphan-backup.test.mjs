// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

/**
 * 收敛器"孤儿合并提交必须当场备份"的镜像锁(§22c:一律 import 源文件导出的判据,不复制实现)。
 *
 * 立因:2026-09-27 同日两例 —— `git-sync-converge` 一轮 CAS 落空就留下一枚悬空 merge,而守门 30a
 * 对"未备份悬空 commit"是 blocking **且没有 stagedTriggers(每次提交必跑)**,于是那次正常的并发
 * 争用把全链 158 道检查对之后每一次提交都顶成 --no-verify。人工补 tag 只能治一次,所以这里把
 * "必须自动补"钉成机器锁。三把锁各管一件事:函数在而没人调 / 名字族不被 30a 认账 / 不 pack 就被删。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { __test__ as G } from '../git-sync-converge.mjs'

const HERE = dirnameOf(import.meta.url)
function dirnameOf(url) {
  return fileURLToPath(new URL('.', url))
}
const src = readFileSync(join(HERE, '..', 'git-sync-converge.mjs'), 'utf8')
const guard = readFileSync(join(HERE, '..', 'check-commit-loss-guard.mjs'), 'utf8')

test('T1 装车锁:CAS 落空那一支必须**真的调用**备份,而不是只把函数写好(本仓最高频失效型=函数在、调度点没有)', () => {
  assert.match(src, /function backupOrphanMerge\(/, '备份函数不见了')
  // 取 CAS 判空那一段的函数体(到本轮 continue 为止),调用必须在**分支内部**
  const i = src.search(/if \(cas === null\) \{/)
  assert.ok(i > 0, 'CAS 判空分支不见了 —— 它一消失本锁就无条件通过,所以这条先判')
  const branch = src.slice(i, src.indexOf('}', src.indexOf('continue', i)))
  assert.match(
    branch,
    /backupOrphanMerge\(mergeSha/,
    'CAS 失败只打印"本轮作废"就 continue ⇒ 悬空对象无人备份 = 守门 30a 恒红',
  )
})

test('T2 备份名必须落在守门 30a 认账的那一族(名字不对 = 备份了但门照样红)', () => {
  const name = G.orphanBackupRefName('947ef34a88a2b4c1d2e3f4a5b6c7d8e9f0a1b2c3')
  assert.equal(name, 'lost-commit/wip-conv-947ef34')
  // 30a 的认账面是 `lost-commit/*` glob;两侧对不上就是替自己造一台恒红门
  assert.match(guard, /lost-commit\/\*/, '守门 30a 的认账族变了,本备份名要跟着变')
  assert.ok(name.startsWith('lost-commit/'), `备份名 ${name} 不在 30a 的 glob 族里`)
  // 形状不对的 SHA 不得造出坏 ref(坏 ref 会让 30a 的"可达性"校验红成另一件事)
  for (const bad of ['', 'zxcvbn', undefined, null]) {
    assert.equal(G.orphanBackupRefName(bad), null, `SHA=${JSON.stringify(bad)} 必须返回 null`)
  }
})

test('T3 tag 之后必须 pack-refs —— 嵌套 refs/tags/<ns>/* 是 depth≥2,不 pack 会被宿主清理层删掉', () => {
  const at = src.indexOf("git(['pack-refs'")
  const tagAt = src.indexOf("'-m', `孤儿合并提交")
  assert.ok(at > 0, 'pack-refs 调用不见了(§5b:松散嵌套 ref 必被清理 ⇒ 下次照样红)')
  assert.ok(tagAt > 0 && at > tagAt, 'pack-refs 必须在 tag 之后,顺序反了就是打包了一个不存在的 ref')
})
