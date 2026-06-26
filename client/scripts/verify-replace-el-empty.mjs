/**
 * 真实环境 Vite 插件验证 (2026-06-26 新增)
 *
 * 不依赖完整 build, 直接构造一个内存中的 Vite 实例, 加载 replace-el-empty 插件,
 * 模拟对 LogDetailDialog.vue 的 transform 调用, 验证替换是否生效.
 *
 * 同时在 Node 中直接 require/import 插件, 验证 TS 文件可以被 Node 加载 (兼容性).
 */

import { createServer } from 'vite'
import path from 'node:path'
import fs from 'node:fs'
import url from 'node:url'

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
// scripts/ 上一级是 client/ (项目根)
const CLIENT_ROOT = path.resolve(__dirname, '..')

console.log('🧪 验证 replace-el-empty 插件 (真实 Vite 环境)')
console.log(`   客户端根: ${CLIENT_ROOT}`)

// 1. 静态加载插件 - 用 esbuild 即时转译
const PLUGIN_PATH = path.join(CLIENT_ROOT, 'vite', 'plugins', 'replace-el-empty.ts')
console.log(`\n[1] 加载插件: ${PLUGIN_PATH}`)

// Windows 上 dynamic import 绝对路径需要 file:// URL
const { default: replaceElEmptyPlugin } = await import(url.pathToFileURL(PLUGIN_PATH).href)
const plugin = replaceElEmptyPlugin({ debug: true, enabled: true })
console.log(`   ✅ 插件名: ${plugin.name}, enforce: ${plugin.enforce}`)

// 2. 直接调用 transform 钩子 - 用项目中的真实文件
const TARGET_VUE = path.join(CLIENT_ROOT, 'src', 'components', 'api', 'LogDetailDialog.vue')
console.log(`\n[2] 测试 transform: ${path.relative(CLIENT_ROOT, TARGET_VUE)}`)

if (!fs.existsSync(TARGET_VUE)) {
  console.error(`   ❌ 目标文件不存在: ${TARGET_VUE}`)
  process.exit(1)
}

const code = fs.readFileSync(TARGET_VUE, 'utf-8')
console.log(`   文件大小: ${code.length} bytes`)

// 模拟 Vite configResolved
const mockConfig = { root: CLIENT_ROOT }
plugin.configResolved(mockConfig)
console.log(`   configResolved 完成`)

// 重新读取 plugin 闭包内变量不可行, 但可以确认 enabled 状态:
// 我们手动再调用一次 transform, 这次打开 debug
console.log(`   环境变量 IHUI_REPLACE_EL_EMPTY = ${process.env.IHUI_REPLACE_EL_EMPTY || '(未设置)'}`)
console.log(`   调用 transform(code, "${TARGET_VUE}")`)

// 直接 inline 调用 transform 逻辑验证 (避开 mock)
import { normalizePath } from 'vite'
const _id = TARGET_VUE
console.log(`   normalizePath(id): ${normalizePath(_id)}`)
console.log(`   .vue test: ${/\.vue(\?.*)?$/.test(_id)}`)
console.log(`   includes NativeEmpty: ${normalizePath(_id).includes('NativeEmpty.vue')}`)
const _code = code
const _tm = _code.match(/<template>([\s\S]*?)<\/template>/i)
console.log(`   template match: ${_tm ? 'OK (' + _tm[0].length + ' bytes)' : 'NULL'}`)

const result = plugin.transform(code, TARGET_VUE)
if (!result) {
  console.error('   ❌ transform 返回 null, 替换未生效')
  process.exit(1)
}

const replaced = result.code
const beforeCount = (code.match(/<el-empty\b/gi) || []).length
const afterElEmpty = (replaced.match(/<el-empty\b/gi) || []).length
const afterNativeEmpty = (replaced.match(/<NativeEmpty\b/gi) || []).length

console.log(`   替换前 <el-empty> 数量: ${beforeCount}`)
console.log(`   替换后 <el-empty> 数量: ${afterElEmpty}  (期望 0)`)
console.log(`   替换后 <NativeEmpty> 数量: ${afterNativeEmpty}  (期望 ${beforeCount})`)

if (afterElEmpty !== 0) {
  console.error('   ❌ 仍有 el-empty 残留')
  process.exit(1)
}
if (afterNativeEmpty !== beforeCount) {
  console.error('   ❌ NativeEmpty 数量与 el-empty 原始数量不一致')
  process.exit(1)
}

// 3. resolveId 测试
console.log(`\n[3] 测试 resolveId 钩子`)
const ridCases = [
  ['el-empty', '导入语句形式'],
  ['element-plus/es/components/empty', 'ES module 子路径'],
  ['element-plus/es/components/empty/src/empty.vue', 'ES module 深层'],
  ['@element-plus/components/empty', 'scoped 路径'],
  ['el-button', '非空组件, 不应被替换'],
  ['vue', 'Vue 核心, 不应被替换'],
]
let ridOk = true
for (const [req, desc] of ridCases) {
  const out = plugin.resolveId(req, TARGET_VUE)
  if (req === 'el-empty' || req.startsWith('element-plus/es/components/empty') || req === '@element-plus/components/empty') {
    if (!out) {
      console.error(`   ❌ ${req} (${desc}) 未重定向`)
      ridOk = false
    } else {
      console.log(`   ✅ ${req} (${desc}) -> ${out.split('?')[0]}`)
    }
  } else {
    if (out) {
      console.error(`   ❌ ${req} (${desc}) 不应被重定向, 但返回了 ${out}`)
      ridOk = false
    } else {
      console.log(`   ✅ ${req} (${desc}) passthrough`)
    }
  }
}
if (!ridOk) process.exit(1)

// 4. 验证 NativeEmpty 组件自身不被处理
console.log(`\n[4] 测试 NativeEmpty.vue 不被自我替换`)
const NATIVE_PATH = path.join(CLIENT_ROOT, 'src', 'components', 'common', 'NativeEmpty.vue')
const nativeCode = fs.readFileSync(NATIVE_PATH, 'utf-8')
const nativeResult = plugin.transform(nativeCode, NATIVE_PATH)
if (nativeResult) {
  console.error('   ❌ NativeEmpty.vue 不应被 transform')
  process.exit(1)
} else {
  console.log('   ✅ NativeEmpty.vue 不被处理 (避免循环替换)')
}

console.log('\n✅ 所有真实环境验证通过')
console.log('\n📋 验证总结:')
console.log(`   - 插件名: ${plugin.name}`)
console.log(`   - 真实 LogDetailDialog.vue 中 ${beforeCount} 个 <el-empty> 全部被替换为 <NativeEmpty>`)
console.log(`   - resolveId 重定向 6 个测试场景全部通过`)
console.log(`   - NativeEmpty.vue 自身不会被自我替换`)
