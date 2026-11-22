#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * miniapp-preview.mjs 的镜像测试(AGENTS.md §22c:禁止在测试里复制源实现)。
 *
 * 立因:scripts/miniapp-preview.mjs 把 workspace 包名写成 `@ihui/miniapp`,
 * 而本仓真实包名是 `@ihui/miniapp-taro`。实测 `pnpm --filter @ihui/miniapp dev:h5`
 * 打 "No projects matched the filters" 且**退出码 0** ⇒ 预览静默空跑、
 * CI 的 miniapp-preview.yml 全绿但零产物。本文件第 1 组用例就是这个缺陷的
 * 守门形态 —— 它是唯一能防止它再回来的东西(typecheck / lint / 其余守门
 * 对"filter 匹配不到包"全部无感)。
 *
 * 跑:node --test scripts/tests/miniapp-preview.test.mjs
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { __test__ as preview } from '../miniapp-preview.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..')

/** 本仓 workspace 真实包名集合(事实源 = pnpm-workspace.yaml 的 apps/* + packages/*) */
function workspacePackageNames() {
  const names = new Map()
  for (const group of ['apps', 'packages']) {
    const dir = join(ROOT, group)
    if (!existsSync(dir)) continue
    for (const entry of readdirSync(dir)) {
      const manifest = join(dir, entry, 'package.json')
      if (!existsSync(manifest)) continue
      const parsed = JSON.parse(readFileSync(manifest, 'utf8'))
      if (typeof parsed.name === 'string') names.set(parsed.name, manifest)
    }
  }
  return names
}

/** 由包名反查其目录(不写死 apps/miniapp-taro —— 那样测试就成了常量复读) */
function packageDirOf(name) {
  const manifest = workspacePackageNames().get(name)
  assert.ok(manifest, `包 ${name} 不在本仓 workspace 里`)
  return dirname(manifest)
}

/** 从 config/dev.ts 源码里取 h5.devServer.port(端口唯一真相源) */
function devServerPortFromConfig(pkgDir) {
  const file = join(pkgDir, 'config', 'dev.ts')
  assert.ok(existsSync(file), `缺少 ${file}`)
  const src = readFileSync(file, 'utf8')
  const h5 = src.slice(src.indexOf('h5:'))
  const m = h5.match(/devServer\s*:\s*\{[\s\S]*?\bport\s*:\s*(\d+)/)
  assert.ok(m, 'config/dev.ts 里解析不到 h5.devServer.port')
  return Number(m[1])
}

test('__test__ 导出面齐备(§22c:源脚本必须 export 可判定常量)', () => {
  assert.ok(preview, 'miniapp-preview.mjs 未导出 __test__')
  for (const key of [
    'PACKAGE_NAME',
    'DEV_SCRIPT',
    'PREVIEW_PORT',
    'PREVIEW_URL_DELAY_MS',
    'buildPnpmArgs',
  ]) {
    assert.ok(key in preview, `__test__ 缺键 ${key}`)
  }
  assert.equal(typeof preview.buildPnpmArgs, 'function')
})

test('包名必须能在本仓 workspace 里解析到真实存在的包(本缺陷的守门形态)', () => {
  const names = workspacePackageNames()
  assert.ok(names.size > 0, 'workspace 包名集合为空 = 测试夹具失效,不是通过')
  assert.ok(
    names.has(preview.PACKAGE_NAME),
    `scripts/miniapp-preview.mjs 用的包名 ${preview.PACKAGE_NAME} 在本仓不存在 ⇒ ` +
      `pnpm --filter 匹配零包、退出码 0、预览静默空跑`,
  )
})

test('反向对照:写错的旧包名必须落在集合外(证明上一条断言有牙)', () => {
  const names = workspacePackageNames()
  assert.equal(names.has('@ihui/miniapp'), false)
  // 同名前缀也不许存在,否则 "@ihui/miniapp" 可能是合法的 scope 父级
  for (const n of names.keys()) assert.notEqual(n, '@ihui/miniapp')
})

test('源码里不得再出现裸的旧包名字面量(注释除外)', () => {
  const src = readFileSync(join(ROOT, 'scripts', 'miniapp-preview.mjs'), 'utf8')
  const code = src
    .split('\n')
    .map((line) => (line.trimStart().startsWith('//') ? '' : line))
    .join('\n')
  assert.equal(/['"`]@ihui\/miniapp['"`]/.test(code), false, '旧包名字面量回潮')
})

test('dev 脚本必须真的存在于该包的 package.json scripts', () => {
  const pkgDir = packageDirOf(preview.PACKAGE_NAME)
  const manifest = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'))
  assert.ok(
    manifest.scripts && typeof manifest.scripts[preview.DEV_SCRIPT] === 'string',
    `包 ${preview.PACKAGE_NAME} 没有 ${preview.DEV_SCRIPT} 脚本`,
  )
})

test('预览端口必须等于 config/dev.ts 的 h5.devServer.port(禁止第二个真相源)', () => {
  const pkgDir = packageDirOf(preview.PACKAGE_NAME)
  const expected = devServerPortFromConfig(pkgDir)
  assert.equal(preview.PREVIEW_PORT, expected)
  // 阳性对照:写死 5173(Vite 默认口)必须与端内配置不等,否则本断言恒真
  assert.notEqual(preview.PREVIEW_PORT, 5173)
})

test('预览端口必须已登记进端口注册表', () => {
  const doc = readFileSync(join(ROOT, 'docs', 'port-management.md'), 'utf8')
  const line = doc.split('\n').find((l) => l.includes(`| ${preview.PREVIEW_PORT} |`))
  assert.ok(line, `${preview.PREVIEW_PORT} 未登记于 docs/port-management.md`)
  assert.match(line, /miniapp/i)
})

test('buildPnpmArgs() 的形态就是 pnpm --filter <包> <脚本>', () => {
  assert.deepEqual(preview.buildPnpmArgs(), ['--filter', preview.PACKAGE_NAME, preview.DEV_SCRIPT])
})

test('spawn 派生点必须带 windowsHide(守门 52)/ execSync 必须带 timeout(守门 80 同族)', () => {
  const src = readFileSync(join(ROOT, 'scripts', 'miniapp-preview.mjs'), 'utf8')
  const spawnCall = src.slice(src.indexOf('spawn('), src.indexOf('child.on('))
  assert.match(spawnCall, /windowsHide\s*:\s*true/, 'spawn 缺 windowsHide ⇒ 守门 52 会拦')
  const execCall = src.slice(src.indexOf('execSync('))
  assert.match(execCall.slice(0, 400), /windowsHide\s*:\s*true/)
  assert.match(execCall.slice(0, 400), /timeout\s*:\s*\d+/, 'execSync 缺 timeout ⇒ 无界阻塞风险')
})

test('CLI 与 import 双形态:源脚本必须有 isDirectRun 守卫(§22d)', () => {
  const src = readFileSync(join(ROOT, 'scripts', 'miniapp-preview.mjs'), 'utf8')
  assert.match(src, /const isDirectRun = process\.argv\[1\] && import\.meta\.url === pathToFileURL/)
  assert.match(src, /if \(isDirectRun\) \{/)
  assert.match(src, /export const __test__ = \{/)
  // __test__ 必须在守卫之后(§22d 位置约束)
  assert.ok(src.indexOf('if (isDirectRun) {') < src.indexOf('export const __test__'))
  // 本测试文件能 import 成功且没把 dev server 拉起来,就是守卫生效的行为证据
  assert.ok(Number.isInteger(preview.PREVIEW_URL_DELAY_MS) && preview.PREVIEW_URL_DELAY_MS > 0)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
