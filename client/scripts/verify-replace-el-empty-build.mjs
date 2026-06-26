/**
 * Vite 完整 build 验证 (2026-06-26 新增)
 *
 * 创建一个临时 mock 项目, 在 App.vue 中使用 <el-empty>, 然后完整 build,
 * 检查产物中是否还包含 el-empty (期望 0 个) 以及包含 NativeEmpty (期望 >= 1 个).
 */

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import url from 'node:url'
import { build } from 'vite'
import vue from '@vitejs/plugin-vue'

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const CLIENT_ROOT = path.resolve(__dirname, '..')

console.log('🧪 Vite 完整 build 验证 (mock 项目)')
console.log(`   客户端根: ${CLIENT_ROOT}`)

const TMP_ROOT = path.join(os.tmpdir(), `replace-el-empty-test-${Date.now()}`)
fs.mkdirSync(TMP_ROOT, { recursive: true })
console.log(`   临时目录: ${TMP_ROOT}`)

// 1. package.json
fs.writeFileSync(
  path.join(TMP_ROOT, 'package.json'),
  JSON.stringify({ name: 'mock', type: 'module', version: '0.0.0' }, null, 2)
)

// 2. App.vue - 使用 el-empty
const APP_VUE = `<template>
  <div>
    <h1>Mock App</h1>
    <el-empty description="暂无数据" />
    <el-empty description="加载失败">
      <button>重试</button>
    </el-empty>
  </div>
</template>
<script setup>
import { ref } from 'vue'
const count = ref(0)
</script>
`
fs.writeFileSync(path.join(TMP_ROOT, 'App.vue'), APP_VUE, 'utf-8')

// 4. main.ts - 用相对路径引入 NativeEmpty 副本
const MAIN_TS = `import { createApp } from 'vue'
import App from './App.vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import NativeEmpty from './src/components/common/NativeEmpty.vue'
import { createI18n } from 'vue-i18n'

const i18n = createI18n({
  legacy: false,
  locale: 'zh-CN',
  messages: { 'zh-CN': {} }
})

const app = createApp(App)
app.use(ElementPlus)
app.use(i18n)
app.component('NativeEmpty', NativeEmpty)
app.mount('#app')
`
fs.writeFileSync(path.join(TMP_ROOT, 'main.ts'), MAIN_TS, 'utf-8')

// 4. index.html
const INDEX_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Test</title>
</head>
<body>
  <div id="app"></div>
  <script type="module" src="/main.ts"></script>
</body>
</html>
`
fs.writeFileSync(path.join(TMP_ROOT, 'index.html'), INDEX_HTML, 'utf-8')

// 5. 复制 NativeEmpty.vue 到 mock 项目, 这样 plugin 能找到
fs.mkdirSync(path.join(TMP_ROOT, 'src', 'components', 'common'), { recursive: true })
fs.copyFileSync(
  path.join(CLIENT_ROOT, 'src', 'components', 'common', 'NativeEmpty.vue'),
  path.join(TMP_ROOT, 'src', 'components', 'common', 'NativeEmpty.vue')
)

// 6. 复制 plugin 到 mock 项目 (可选, 这里直接动态 import 即可)
const PLUGIN_PATH = path.join(CLIENT_ROOT, 'vite', 'plugins', 'replace-el-empty.ts')
console.log(`\n[1] 加载插件: ${PLUGIN_PATH}`)
const { default: replaceElEmptyPlugin } = await import(url.pathToFileURL(PLUGIN_PATH).href)

// 7. 跑 build - alias 指向 CLIENT_ROOT 的 node_modules, 让 vue / element-plus / vue-i18n 可解析
console.log(`\n[2] 启动 Vite build...`)
try {
  await build({
    root: TMP_ROOT,
    logLevel: 'warn',
    plugins: [replaceElEmptyPlugin({ debug: true, enabled: true }), vue()],
    resolve: {
      alias: {
        vue: path.join(CLIENT_ROOT, 'node_modules', 'vue'),
        'element-plus': path.join(CLIENT_ROOT, 'node_modules', 'element-plus'),
        'vue-i18n': path.join(CLIENT_ROOT, 'node_modules', 'vue-i18n'),
      },
    },
    build: {
      outDir: 'dist',
      minify: false,
      sourcemap: false,
      write: true,
    },
    configFile: false,
  })
  console.log(`   ✅ Vite build 完成`)
} catch (e) {
  console.error(`   ❌ Vite build 失败:`, e.message)
  process.exit(1)
}

// 7. 检查 dist 产物
const distDir = path.join(TMP_ROOT, 'dist', 'assets')
if (!fs.existsSync(distDir)) {
  console.error(`   ❌ dist 目录不存在`)
  process.exit(1)
}

const files = fs.readdirSync(distDir)
console.log(`\n[3] 产物文件 (${files.length}):`)
for (const f of files) console.log(`   - ${f}`)

let allContent = ''
for (const f of files) {
  const p = path.join(distDir, f)
  if (fs.statSync(p).isFile()) {
    allContent += fs.readFileSync(p, 'utf-8') + '\n'
  }
}

// 8. 验证
console.log(`\n[4] 验证产物内容:`)
// Vue 编译器会把 <el-empty> 编译为 createBlock(_component_el_empty, ...) 形式
// 把 <NativeEmpty> 编译为 createBlock(_component_NativeEmpty, ...) 形式
// 验证: 产物中不应有 _component_el_empty 引用 (说明模板中的 <el-empty> 都已被替换)
const elEmptyComponentRefs = allContent.match(/_component_el_empty\b/g) || []
const nativeEmptyComponentRefs = allContent.match(/_component_NativeEmpty\b/g) || []
const elEmptyTagInOutput = allContent.match(/<el-empty\b/g) || []
const nativeEmptyTagInOutput = allContent.match(/<NativeEmpty\b/g) || []

// 统计 element-plus 库代码中的 el-empty 字符串 (这些是组件实现, 不是模板使用)
const elEmptyInElplus = allContent.match(/(el-empty|el_empty)/g) || []

console.log(`   "<el-empty" 标签数: ${elEmptyTagInOutput.length}  (期望 0)`)
console.log(`   "<NativeEmpty" 标签数: ${nativeEmptyTagInOutput.length}  (期望 0, Vue 编译后是 _component_* 形式)`)
console.log(`   "_component_el_empty" 引用: ${elEmptyComponentRefs.length}  (期望 0)`)
console.log(`   "_component_NativeEmpty" 引用: ${nativeEmptyComponentRefs.length}  (期望 >= 2)`)
console.log(`   "el-empty/el_empty" 字符串总数: ${elEmptyInElplus.length}  (在 element-plus 库代码中, 正常)`)

let pass = true
if (elEmptyTagInOutput.length !== 0) {
  console.error(`   ❌ 仍有 <el-empty> 标签`)
  pass = false
}
if (elEmptyComponentRefs.length !== 0) {
  console.error(`   ❌ 产物中仍引用 _component_el_empty, 说明 <el-empty> 没被替换`)
  pass = false
}
if (nativeEmptyComponentRefs.length < 2) {
  console.error(`   ❌ _component_NativeEmpty 数量不足 (期望 >= 2)`)
  pass = false
}

// 进一步: 单独检查 App.vue 编译后的 chunk
const appChunk = files.find((f) => f.endsWith('.js'))
if (appChunk) {
  const appJs = fs.readFileSync(path.join(distDir, appChunk), 'utf-8')
  // 找 template 渲染片段, 验证 component 名
  // _component_NativeEmpty 出现 3 次: App.vue 模板中 2 个 + main.ts 中 app.component('NativeEmpty') 注册 1 次
  const nativeCalls = (appJs.match(/_component_NativeEmpty/g) || []).length
  const elCalls = (appJs.match(/_component_el_empty/g) || []).length
  console.log(`\n   App.js (_${appChunk}) 中的渲染调用:`)
  console.log(`     _component_NativeEmpty 调用数: ${nativeCalls}  (期望 2, 仅模板)`)
  console.log(`     _component_el_empty 调用数:    ${elCalls}  (期望 0)`)
  // App.vue 模板里有 2 个 <NativeEmpty>, 所以 _component_NativeEmpty 在产物模板渲染处 = 2
  // main.ts 的注册是字符串 'NativeEmpty' 而非 _component_NativeEmpty 标识符
  if (nativeCalls < 2) {
    console.error(`   ❌ App.js 中 _component_NativeEmpty 模板调用数不足`)
    pass = false
  }
  if (elCalls !== 0) {
    console.error(`   ❌ App.js 中仍存在 _component_el_empty`)
    pass = false
  }
}

// 清理
console.log(`\n[5] 清理临时目录: ${TMP_ROOT}`)
fs.rmSync(TMP_ROOT, { recursive: true, force: true })

if (!pass) process.exit(1)
console.log('\n✅ Vite 完整 build 验证通过')
