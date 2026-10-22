// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 小程序"硬编码登录页路由"的源码面锁(2026-10-23 自
 * `apps/miniapp-taro/tests/login-popup-password-fallback.test.tsx` 的同名用例搬来,判据一字未改)。
 *
 * 为什么搬到脚本层:那条用例要 `maskComments`(只判代码位、不判注释),而端包 import 仓库工具
 * `scripts/lib/code-mask.mjs` 构成 apps/miniapp-taro(rank 40)→ repo-tooling(rank 90)的反向依赖,
 * 并坐实 shared → api-client → repo-tooling → shared 的成环 —— 架构契约门 D1/D2/D4 同红,
 * 而 D4(module-cycle)既不登记表级 exceptions 也不认行内 arch-exempt ⇒ 除环只有搬文件这一条路。
 * 同文件里另三条只读正文、不碰遮罩的用例(占位文案 / app.css 三个类 / 不走 webview 死路)
 * 留在端包原位:搬它们对本门零收益,只是把内容从绿套件里挪窝。
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

import { maskComments } from '../lib/code-mask.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const SRC = resolve(HERE, '../../apps/miniapp-taro/src')
const codeFace = (rel) => String(maskComments(readFileSync(resolve(SRC, rel), 'utf8')))

test('硬编码登录页路由的调用点必须归零,app.config 也不许再注册它', () => {
  // 不写"被删文件必须不存在"那种断言:对被删路径的任何指认本身就是一条引用(守门 99 会判
  // "被删文件仍有人引用"),而它要保的性质已由下面两锁覆盖,且不留悬空路径。
  // 只判**代码位**:历史注记里提到过这个 root 是交代成因,不是把它注册回来了
  // (判据读注释会把"讲过这件事"误判成"还在做这件事",那会让人学会去删注释而不是删代码)
  const cfg = codeFace('app.config.ts')
  assert.equal(cfg.includes("root: 'pages/login'"), false)
  // 路由串只剩这一处锁自己 —— 任何一处再把它硬编码回去,这里就红
  const grepTargets = [
    'utils/api-bridge.ts',
    'utils/auth.ts',
    'pages/register/index.tsx',
    'pages/forgot-password/index.tsx',
    'pages/setting/index.tsx',
    'pkg-user/account-cancel/index.tsx',
    'pkg-user/user/settings.tsx',
  ]
  for (const rel of grepTargets) {
    assert.equal(
      codeFace(rel).includes('/pages/login/login'),
      false,
      `${rel} 里又出现了硬编码 /pages/login/login`,
    )
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
