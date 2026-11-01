// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `web-utility-classes.mjs` 的编译腿(子进程):把「主题样式源 + 候选类名」变成真 CSS。
 *
 * 为什么要独立进程:`tailwindcss` 4.x 的 `compile()` 是 async(要 loadStylesheet / loadModule),
 * 而门 128 的 `collect()` 是同步函数,16 处测试直接调它。子进程把 async 吃掉,代价是每次
 * 约 250ms —— 只在有 web 腿类名时跑一次,不是每族一次。
 *
 * 输入(stdin JSON):`{ repoRoot, entry, files: {相对路径: 正文}, candidates: string[] }`。
 * 样式源一律取自 `files`(**被审面**的字节),只有包自带的 `tailwindcss` 与插件从 node_modules
 * 解析 —— 它们是工具链版本,不属于被审面的像素材料。
 * 输出(stdout JSON):`{ css }` 或 `{ error }`(父进程按"模型不可用 ⇒ 未判定"处理,不猜)。
 */
import { compile } from 'tailwindcss'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'

const readStdin = async () => {
  const chunks = []
  for await (const c of process.stdin) chunks.push(c)
  return Buffer.concat(chunks).toString('utf8')
}

const posixDir = (rel) => path.posix.dirname(rel)

const main = async () => {
  const { repoRoot, entry, files, candidates } = JSON.parse(await readStdin())
  const entryText = files?.[entry]
  if (typeof entryText !== 'string') throw new Error(`入口样式表不在输入面:${entry}`)
  // 插件(tailwindcss 自身 / @tailwindcss/typography / tailwindcss-animate)按 **web 包**解析:
  // 它们装在 workspace 的依赖树里,从仓库根解析会 MODULE_NOT_FOUND(实测)。
  const req = createRequire(path.join(repoRoot, 'apps/web/package.json'))
  const compiler = await compile(entryText, {
    base: path.join(repoRoot, posixDir(entry)),
    loadStylesheet: async (id, base) => {
      if (id === 'tailwindcss' || id.startsWith('tailwindcss/')) {
        const spec = id === 'tailwindcss' ? 'tailwindcss/index.css' : id
        const p = req.resolve(spec)
        return { path: p, base: path.dirname(p), content: readFileSync(p, 'utf8') }
      }
      const baseRel = path.relative(repoRoot, base).split(path.sep).join('/')
      const rel = path.posix.normalize(path.posix.join(baseRel, id))
      const text = files[rel]
      // 缺一份 = 编译面不完整;直接失败让父进程记"模型不可用",绝不拿残树下结论。
      if (typeof text !== 'string') throw new Error(`样式源不在输入面:${rel}`)
      return { path: path.join(repoRoot, rel), base: path.join(repoRoot, posixDir(rel)), content: text }
    },
    loadModule: async (id) => {
      const p = req.resolve(id)
      const m = await import(pathToFileURL(p).href)
      return { base: path.dirname(p), module: m.default ?? m }
    },
  })
  process.stdout.write(JSON.stringify({ css: compiler.build(candidates) }))
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  main().catch((e) => {
    // 失败也走 stdout 的结构化出口:父进程按"模型不可用 ⇒ 未判定"处理,不猜、不回落。
    process.stdout.write(JSON.stringify({ error: String(e?.message ?? e) }))
    process.exitCode = 1
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
