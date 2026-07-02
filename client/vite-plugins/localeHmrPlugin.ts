/**
 * localeHmrPlugin - 让 locales/modules/<lang>/<module>.json 的改动即时反映到浏览器
 *
 * 问题背景:
 *   Vite 5+ 在 dev 模式下对 JSON 文件做 transform 时, 把转换结果按 URL 缓存到内存.
 *   当 .json 文件被修改, Vite 的文件 watcher 会触发 HMR, 但:
 *     1) .ts/.vue 文件的 HMR 边界是模块级, json 不会冒泡到父 .ts 模块
 *     2) 即便 .ts 模块被 invalidate, 它内部 import() 的 .json 转换产物仍走缓存
 *   结果: 浏览器看到的还是旧 i18n 字符串, 必须 Ctrl+R 强刷或重启 dev server.
 *
 * 解决方案:
 *   监听 src/locales/modules 下所有 json 的 change/add/unlink 事件,
 *   直接调用 server.moduleGraph.invalidateModule() 抹掉所有引用它的模块,
 *   浏览器拿到 invalid 信号后会重新 import, 看到新内容.
 *
 * 设计要点:
 *   - 只对 locale JSON 生效 (不影响其他 JSON 资源, 避免误伤)
 *   - 文件删除时同样处理 (防止 dangling 引用)
 *   - 配合 server.watch.usePolling=true (Windows 必需), 改动 300ms 内被检测
 *
 * 验证方法:
 *   改 src/locales/modules/zh-CN/navigation.json 里的一个 key
 *   浏览器无需刷新, 文字应立即更新
 *
 * 引入位置: vite.config.ts plugins 数组最前面 (优先于其他插件, 尽早注册 listener)
 */
import type { Plugin, ViteDevServer } from 'vite'
import path from 'node:path'

const LOCALE_GLOB = 'src/locales/modules/**/*.json'

export function localeHmrPlugin(): Plugin {
  return {
    name: 'locale-hmr',
    apply: 'serve', // 仅 dev 模式生效, build 不需要
    configureServer(server: ViteDevServer) {
      const root = server.config.root

      // 把 locale JSON 加入主 watcher (双重保险, 即便 server.watch.depth 调小也能被监听到)
      server.watcher.add(LOCALE_GLOB)

      // 路径过滤: 只处理 locales/modules 下的 json, 避免误伤其他文件
      const isLocaleJson = (file: string): boolean => {
        const normalized = file.replace(/\\/g, '/')
        return /\/src\/locales\/modules\/[^/]+\/[^/]+\.json$/.test(normalized)
      }

      const invalidate = (file: string): void => {
        if (!isLocaleJson(file)) return
        const graph = server.moduleGraph
        // 暴力清空所有 locale 相关的模块 (准确路径在 watcher 阶段拿不到, 用包含路径最稳)
        for (const [, mod] of graph.idToModuleMap) {
          if (mod.id && mod.id.includes('/locales/modules/') && mod.id.endsWith('.json')) {
            graph.invalidateModule(mod)
          }
        }
        // 通知客户端 reload, 让相关组件重新 import
        server.ws.send({ type: 'full-reload', path: '*' })
        // eslint-disable-next-line no-console
        console.log(`[locale-hmr] invalidated locale modules (triggered by: ${path.basename(file)})`)
      }

      server.watcher.on('change', invalidate)
      server.watcher.on('add', invalidate)
      server.watcher.on('unlink', invalidate)
    },
  }
}
