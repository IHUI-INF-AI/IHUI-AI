// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * knip-taro-alias-parity.test.mjs — knip.jsonc 的 rn-compat alias 键集必须与构建配置逐项相等
 *
 * 立因(2026-11-03):`apps/miniapp-taro/config/index.ts` 的 alias 把共享层对 react-native 等
 * 已安装包的请求换到端内 rn-compat。这份映射是**构建期**语义,knip.jsonc 的 paths 是它的
 * 配置面投影;两处若只靠人记同步,新增一条 alias 就会让目标文件从 knip 可达面掉出去,
 * 表现为"新增未用导出"的假红。本测试把"逐项相等"变成判据:任一侧多/少一个键立即失败。
 *
 * 反向例(人工执行,命令与输出见提交说明):
 *   从 knip.jsonc 的 paths 删掉 `"react-native$"` → 本测试红;恢复 → 绿。
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

import { __test__ as gen } from '../gen-knip-taro-entries.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8')

const configText = read('apps/miniapp-taro/config/index.ts')
const knipText = read('knip.jsonc')

describe('knip.jsonc 的 rn-compat alias 键集与构建配置逐项相等', () => {
  const cfg = gen.parseRncAliases(configText)
  const knip = gen.parseKnipRncAliases(knipText)

  it('两处都能解析出别名(取不到即未判定,不得静默绿)', () => {
    assert.ok(cfg.size > 0, 'config/index.ts 解析不到 rn-compat alias')
    assert.ok(knip && knip.size > 0, 'knip.jsonc 受管块里解析不到 rn-compat alias')
  })

  it('键集逐项相等(alias 增减而 knip.jsonc 不跟上即红)', () => {
    assert.deepEqual([...(knip ?? new Map()).keys()].sort(), [...cfg.keys()].sort())
  })

  it('每个键的目标文件一致(别名指错文件也算漂移)', () => {
    for (const [key, target] of cfg) {
      assert.equal(
        (knip ?? new Map()).get(key),
        gen.resolveRncFile(target),
        `alias ${key} 的目标与 config/index.ts 不一致`,
      )
    }
  })

  it('tsconfig 的非别名映射仍在受管块里', () => {
    assert.match(knipText, /"@rn-shells\/\*": \["\.\.\/mobile-rn\/src\/screens\/\*"\]/)
    assert.match(knipText, /"@ihui\/rn-app\/\*": \["\.\.\/\.\.\/packages\/app\/src\/\*"\]/)
  })
})
