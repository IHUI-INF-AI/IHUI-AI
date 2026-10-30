#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 守门 272 的镜像测试:钉"这道门真的装在提交链上"与"判据只有一份"。
// 判据实现一律从门体 __test__ 调(§22c 禁止在测试里复制判据);取材面用磁盘读源文本。
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { spawnSync } from 'node:child_process'
import test from 'node:test'

import { maskComments } from '../lib/code-mask.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const GATE = join(ROOT, 'scripts/check-modal-keyboard-avoid.mjs')
const RUNNER = readFileSync(join(ROOT, 'scripts/guardian-runner.mjs'), 'utf8')
const { __test__ } = await import(pathToFileURL(GATE).href)
const { findMissingAvoids, SKIP_ENV, SRC_RELS } = __test__

test('① 装车:runner 注册块存在,blocking + skipEnv + stagedTriggers 成套', () => {
  const at = RUNNER.indexOf("script: 'check-modal-keyboard-avoid.mjs'")
  assert.ok(at > 0, 'runner 里没有本门的注册块 ⇒ 头注自称已接线就是假的(门 89 R1/R2)')
  const block = RUNNER.slice(Math.max(0, at - 700), at + 900)
  assert.match(block, /id:\s*'272'/, '注册块缺 id 272')
  assert.match(block, /mode:\s*'blocking'/, '必须 blocking —— warn 拦不住任何事')
  assert.match(block, new RegExp(`skipEnv:\\s*'${SKIP_ENV}'`), 'skipEnv 与门内 SKIP_ENV 必须同名')
  assert.match(block, /stagedTriggers:\s*\[[^\]]*apps\/mobile-rn\/src\//, '触发面缺端内侧')
  assert.match(block, /stagedTriggers:\s*\[[^\]]*packages\/app\/src\//, '触发面缺共享屏侧')
})

test('② 编号唯一:id 272 作为注册条目只出现一次(R5/R13 同型防线)', () => {
  // 用仓内遮罩库剥注释,不自己写正则:上一版用 /^\s*\/\/.*$/gm + /\*[\s\S]*?\*/ 剥,
  // 结果 runner 里 label 字符串中的 `*/` 让块注释正则一路误吞,把整片注册表都剥没了
  // (code 面数到 0,"唯一性"就这么假绿过去)。本仓早有统一出口 code-mask(§0.6 单一实现)。
  const code = maskComments(RUNNER)
  const n = (code.match(/id:\s*'272'/g) ?? []).length
  assert.equal(n, 1, `id '272' 在代码面出现 ${n} 次 ⇒ 要么撞号,要么一个对象里写了两个 id`)
  // 归一化本身要被量到:不剥注释数到 2(注册块上方说明文字提过一次);
  // 而"剥多了"(整片注册表不见)必须由下面这条一起挡住 —— 它要求代码面仍能数到 1。
  assert.equal(
    (RUNNER.match(/id:\s*'272'/g) ?? []).length,
    2,
    '不剥注释应当数到 2 ⇒ 若不是 2,说明说明文字变了,本条对照失效',
  )
  assert.ok(
    maskComments(RUNNER).includes("script: 'check-modal-keyboard-avoid.mjs'"),
    '剥注释后必须还能看到本门的 script 行 ⇒ 看不到就是遮罩吞掉了注册表(老尺子的失效形态)',
  )
})

test('③ 射程与触发面成对:门体枚举的根必须都在 runner 触发面里', () => {
  const at = RUNNER.indexOf("script: 'check-modal-keyboard-avoid.mjs'")
  const block = RUNNER.slice(Math.max(0, at - 700), at + 900)
  for (const scope of SRC_RELS) {
    assert.ok(block.includes(`${scope}/`), `runner 触发面漏了 ${scope}/ ⇒ 该层提交永不送进本门`)
    assert.ok(SRC_RELS.includes(scope), `门体枚举反向缺 ${scope}`)
  }
})

test('④ 判据单元:红/绿/避让在外 三形态由生产实现现算', () => {
  assert.equal(findMissingAvoids('<Modal><View><TextInput /></View></Modal>').length, 1)
  assert.equal(
    findMissingAvoids('<Modal><KeyboardAvoidingView><TextInput /></KeyboardAvoidingView></Modal>')
      .length,
    0,
  )
  assert.equal(
    findMissingAvoids('<KeyboardAvoidingView><Modal><TextInput /></Modal></KeyboardAvoidingView>')
      .length,
    1,
    '挂在 Modal 外的避让层被当成有效 ⇒ 这条锁会放过最危险的写法',
  )
})

test('⑤ 端到端:--self-test 与 --staged --worktree 同给的用法错都是契约内出口', () => {
  const st = spawnSync(process.execPath, [GATE, '--self-test'], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  assert.equal(st.status, 0, `--self-test 必须 exit 0:${st.stderr}`)
  const both = spawnSync(process.execPath, [GATE, '--staged', '--worktree'], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  assert.equal(both.status, 2, '两面旗同给必须 exit 2(守门 118:不做"猜哪面")')
})

test('⑥ R4 点名义务:README 的守门索引里有本门名(文档面读 HEAD blob)', () => {
  const readme = spawnSync('git', ['show', 'HEAD:README.md'], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 1 << 28,
  })
  assert.equal(readme.status, 0, `读不到 HEAD 面 README:${readme.stderr}`)
  assert.ok(
    readme.stdout.includes('check-modal-keyboard-avoid.mjs'),
    '门已接线而文档通篇未点名 ⇒ 门 89 R4 判红;点名落在「守门脚本点名索引」的 UI/样式 行',
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
