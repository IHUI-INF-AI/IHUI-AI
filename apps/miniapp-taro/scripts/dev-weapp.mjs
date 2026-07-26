// dev-weapp.mjs — wraps `taro build --type weapp --watch`
//
// Why:
//   pnpm dev runs taro in watch mode. 2026-07-26 起改用 weapp-tailwindcss
//   插件(在 config/index.ts 的 vitePlugins 注册),由插件在编译时同步处理
//   WXSS 选择器转义和 wxml/js class 匹配,无需 strip-tailwind-backslash.mjs。
//
//   历史背景:之前用 strip-tailwind-backslash.mjs 在 taro 构建后异步删除
//   WXSS 中的反斜杠转义,但无法处理 Tailwind 任意值语法 [xxx](541 个规则),
//   WXSS parser 把 [2px] 当属性选择器报错。weapp-tailwindcss 在编译时同步
//   把 .-bottom-[2px] 重写为 .-bottom-_b2px_B,WXSS 和 wxml 同步匹配。
import { spawn } from 'node:child_process'

// shell:true so Windows resolves `taro` -> `taro.cmd` automatically
const taro = spawn('taro', ['build', '--type', 'weapp', '--watch'],
  { stdio: 'inherit', shell: true })

taro.on('exit', (code) => {
  console.log(`[dev-weapp] taro exited with ${code}`)
  process.exit(code ?? 0)
})

process.on('SIGINT', () => taro.kill('SIGINT'))
process.on('SIGTERM', () => taro.kill('SIGTERM'))
