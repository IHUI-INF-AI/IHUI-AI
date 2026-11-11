#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
/**
 * 守门:号池单测**不得**真连生产(2026-11-12 立)。
 *
 * 事故现场(同一形状踩了两次):
 *   `relay-account-pool.mjs` 自 2026-11-07 起 `prodPush` **默认 true**,而两个写于 11-06/11-07
 *   的单测只注入了 `runImporter` —— 于是"纯逻辑"用例每条都真的经 SSH 打生产:
 *     · pool-owner-default.test.mjs   → 用例 ① 判红(远端对空载荷退出 1),整文件 24.7 秒;
 *     · relay-account-tokens-text.test.mjs → 91 秒、18 处生产/DB 痕迹,只因没断言 exit 才"绿"着。
 *   两个文件头都写着"不连生产库、不起导入子进程"——**契约写在注释里等于没有**(§0.8/§12f)。
 *
 * 判据(结构面,不看行为):只要测试文件 import 了号池编排器并调用它的 `main`,
 * 就必须同时出现 `pushProd` 注入(替身)。理由:
 *   · `runImporter` 只能拦本机落库;生产推送走的是另一个出口 `deps.pushProd`,不注入就直连;
 *   · 旗标式修法(`argv` 补 --no-sync-prod)不是判据 —— 默认值再翻一次就静默复发,
 *     所以本守门认的是**注入点**而非旗标。
 *
 * 反退化(§12f 判据失效永远安静):断言"检出集非空且含两个已知文件",
 * 一旦正则写坏/路径改名,守门自己先红,而不是在空集上绿。
 */
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const TEST_DIR = fileURLToPath(new URL('.', import.meta.url))

/** 已知必须注入 pushProd 替身的文件(反退化锚点)。 */
const KNOWN_CALLERS = ['pool-owner-default.test.mjs', 'relay-account-tokens-text.test.mjs']

/**
 * 去掉行首注释与块注释(不碰行内,避免误伤 URL/正则字面量里的 `//`)。
 *
 * 必要性(2026-11-12 变异实测):判据最初写成"文件里出现 pushProd 字样",结果**把注入行注释掉
 * 仍然判绿** —— 因为文件里的说明注释含同样的字样。判据能被注释满足 = 没有判据(§12f)。
 * 现在只认"去注释后真实存在的 `pushProd:` 属性赋值"。
 */
function stripComments(text) {
  const out = []
  let inBlock = false
  for (const line of text.split(/\r?\n/)) {
    if (inBlock) {
      if (/\*\//.test(line)) inBlock = false
      continue
    }
    const trimmed = line.trimStart()
    if (trimmed.startsWith('/*')) {
      if (!/\*\//.test(trimmed)) inBlock = true
      continue
    }
    if (trimmed.startsWith('//')) continue
    out.push(line)
  }
  return out.join('\n')
}

function scan() {
  const files = readdirSync(TEST_DIR).filter((f) => f.endsWith('.test.mjs'))
  const callers = []
  const offenders = []
  for (const file of files) {
    // 本文件自身也在 scripts/tests 下,跳过免得把自己算成调用方
    if (file === 'check-relay-pool-test-isolation.test.mjs') continue
    const code = stripComments(readFileSync(join(TEST_DIR, file), 'utf8'))
    const importsPool = /from\s+['"][^'"]*relay-account-pool\.mjs['"]/.test(code)
    const callsMain = /\.main\(/.test(code)
    if (!importsPool || !callsMain) continue
    callers.push(file)
    // 必须是真实的属性赋值 `pushProd: ...`(注释掉的不算,注释里提到也不算)
    if (!/\bpushProd\s*:/.test(code)) offenders.push(file)
  }
  return { files, callers, offenders }
}

test('① 调用号池 main 的测试必须注入 pushProd 替身,否则就是在真连生产', () => {
  const { callers, offenders } = scan()
  assert.deepEqual(
    offenders,
    [],
    `下列测试调用 relay-account-pool.main 却没注入 pushProd 替身,会真经 SSH 打生产:\n  ` +
      offenders.join('\n  ') +
      `\n修法:在 main 的 deps 里加 pushProd: async () => { throw new Error('本用例禁止生产推送') },` +
      `并给 argv 补 --no-sync-prod。`,
  )
  // 反退化:检出集必须非空,否则判据已失效(路径改名/import 写法变化),不能安静通过
  assert.ok(
    callers.length > 0,
    `没有检出任何"import 号池编排器并调用 main"的测试 —— 守门判据已失效(不是"没人违规")`,
  )
})

test('② 反退化:两个已知违规现场仍在检出集内(正则坏掉时本守门自己先红)', () => {
  const { callers } = scan()
  for (const known of KNOWN_CALLERS) {
    assert.ok(
      callers.includes(known),
      `已知文件 ${known} 不在检出集(${callers.join(', ') || '空'}) —— ` +
        `import 写法或文件名已变,本守门的判据需要跟着更新,否则会在空集上假绿`,
    )
  }
})
