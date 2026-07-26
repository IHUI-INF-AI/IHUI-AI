// dev-weapp.mjs — wraps `taro build --type weapp --watch` + strip-tailwind-backslash --watch
//
// Why:
//   pnpm dev runs taro in watch mode. Taro regenerates .wxss on every rebuild,
//   re-introducing Tailwind backslash escapes that the WeChat WXSS parser
//   rejects ("unexpected `\` at pos X"). The strip script must run in watch
//   mode too, in parallel, so each .wxss change is re-stripped immediately.
//
//   Windows PowerShell does not support `&` for parallel npm scripts, so we
//   spawn both processes here and forward signals/exit codes correctly.
import { spawn } from 'node:child_process'

// shell:true so Windows resolves `taro` -> `taro.cmd` automatically
const taro = spawn('taro', ['build', '--type', 'weapp', '--watch'],
  { stdio: 'inherit', shell: true })

// Give taro a head start so dist/ exists before strip-watch starts polling
setTimeout(() => {
  const strip = spawn('node', ['scripts/strip-tailwind-backslash.mjs', '--watch'],
    { stdio: 'inherit', shell: true })

  strip.on('exit', (code) => {
    if (code !== 0) console.warn(`[dev-weapp] strip-watch exited with ${code}`)
  })

  process.on('SIGINT', () => { strip.kill('SIGINT'); taro.kill('SIGINT') })
  process.on('SIGTERM', () => { strip.kill('SIGTERM'); taro.kill('SIGTERM') })
}, 1500)

taro.on('exit', (code) => {
  console.log(`[dev-weapp] taro exited with ${code}`)
  process.exit(code ?? 0)
})

process.on('SIGINT', () => taro.kill('SIGINT'))
process.on('SIGTERM', () => taro.kill('SIGTERM'))
