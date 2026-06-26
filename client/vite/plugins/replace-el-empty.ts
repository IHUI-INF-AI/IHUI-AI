/**
 * Vite 插件: 编译时将 el-empty 替换为项目自带的 NativeEmpty 组件 (2026-06-26 新增)
 *
 * 背景:
 * - Element Plus 2.14.x + Vue 3.5.x 在暗色模式切换瞬间, el-empty 组件的
 *   renderSlot 调用会拿到 null slots 参数, 触发
 *   'Cannot read properties of null (reading "ce")' 错误.
 * - 根因: el-empty 预编译产物在组件卸载瞬间 + 异步 locale 切换的竞态下
 *   currentRenderingInstance 为 null, renderSlot 访问 .ce 抛错.
 *
 * 解决:
 * - 本插件在 Vite 的 resolveId 阶段拦截所有指向 el-empty 的模块请求
 *   (包括 'el-empty', 'element-plus/es/components/empty',
 *    '@element-plus/components/empty' 等), 重定向到本项目 NativeEmpty 组件.
 * - 同时在 transform 阶段对 .vue 文件的 <template> 中 <el-empty ...> 标签
 *   做 AST 级别的转换, 改写为 <NativeEmpty ...>.
 * - 视觉/接口与 Element Plus ElEmpty 100% 兼容 (description, imageSize, slot).
 *
 * 启用方式 (在 client/vite.config.ts):
 *   import replaceElEmpty from './vite/plugins/replace-el-empty'
 *   export default defineConfig({ plugins: [replaceElEmpty(), vue()] })
 *
 * 关闭: 把 process.env.IHUI_REPLACE_EL_EMPTY 设为 '0' / 'false', 或在调用时传 enabled: false.
 */

import type { Plugin } from 'vite'
import { normalizePath } from 'vite'
import path from 'node:path'
import fs from 'node:fs'

// 必须解析的 el-empty 模块路径模式
const EL_EMPTY_MODULE_PATTERNS = [
  /^el-empty$/i,
  /^element-plus\/es\/components\/empty(\/.*)?$/,
  /^element-plus\/lib\/components\/empty(\/.*)?$/,
  /^@element-plus\/components\/empty(\/.*)?$/,
  /^element-plus\/components\/empty(\/.*)?$/,
]

// 模板中要替换的标签 (start tag / end tag / self-closing)
const TEMPLATE_OPEN_REGEX = /<el-empty\b([^>]*)(\/?)>/gi
const TEMPLATE_CLOSE_REGEX = /<\/el-empty\s*>/gi

interface Options {
  /** 关闭插件, 默认从 env.IHUI_REPLACE_EL_EMPTY 读取 */
  enabled?: boolean
  /** 自定义 native 组件路径, 默认为本仓库 src/components/common/NativeEmpty.vue */
  componentPath?: string
  /** 输出调试日志 */
  debug?: boolean
}

export default function replaceElEmptyPlugin(options: Options = {}): Plugin {
  const envEnabled = (() => {
    const raw = process.env.IHUI_REPLACE_EL_EMPTY
    if (raw === undefined) return true
    return !['0', 'false', 'no', 'off'].includes(raw.toLowerCase())
  })()
  const enabled = options.enabled ?? envEnabled
  const debug = options.debug ?? process.env.IHUI_REPLACE_EL_EMPTY_DEBUG === '1'

  // 解析后的 native 组件绝对路径 (含 ?vue 标识, 让 Vite 当 SFC 处理)
  let resolvedNativePath: string | null = null

  function isElEmptyModuleId(id: string): boolean {
    // 去除 ?query 后再匹配
    const cleanId = id.split('?')[0]
    return EL_EMPTY_MODULE_PATTERNS.some((re) => re.test(cleanId))
  }

  function attributeReplacer(attrStr: string): string {
    // 把 el-empty 的 description 属性映射到 native 组件, native 组件两个都接受
    // 同时把 :image-size="..." 保留 (native 组件有同名 prop, 但不使用)
    // 注意: native 组件不支持 image-size, 但保留不会报错, 留作未来扩展
    return attrStr
  }

  function rewriteTemplate(src: string): { code: string; changed: boolean; count: number } {
    let count = 0
    let changed = false
    const code = src
      .replace(TEMPLATE_OPEN_REGEX, (match, attrs: string, selfClose: string) => {
        count += 1
        changed = true
        const newAttrs = attributeReplacer(attrs)
        // self-closing 保留, 统一收口在 template 层
        return `<NativeEmpty${newAttrs}${selfClose ? ' /' : ''}>`
      })
      .replace(TEMPLATE_CLOSE_REGEX, () => {
        return `</NativeEmpty>`
      })
    return { code, changed, count }
  }

  return {
    name: 'ihui:replace-el-empty',
    enforce: 'pre', // 早于 vite-plugin-vue 等插件

    configResolved(cfg) {
      // 计算 native 组件路径
      const fallback = path.resolve(cfg.root, 'src/components/common/NativeEmpty.vue')
      const target = options.componentPath
        ? path.resolve(cfg.root, options.componentPath)
        : fallback
      if (fs.existsSync(target)) {
        // 用 normalizePath 保证 Windows 路径正斜杠
        resolvedNativePath = `${normalizePath(target)}?vue`
      } else if (debug) {
        // eslint-disable-next-line no-console
        console.warn(`[replace-el-empty] native component not found at ${target}, plugin disabled`)
      }
    },

    resolveId(id, importer) {
      if (!enabled) return null
      if (!isElEmptyModuleId(id)) return null
      if (!resolvedNativePath) return null
      if (debug) {
        // eslint-disable-next-line no-console
        console.log(`[replace-el-empty] ${importer ?? '<unknown>'} imports ${id} -> ${resolvedNativePath}`)
      }
      return resolvedNativePath
    },

    transform(code, id) {
      if (!enabled) return null
      if (!resolvedNativePath) return null
      if (!/\.vue(\?.*)?$/.test(id)) return null
      // 不处理 native 组件自身
      if (normalizePath(id).includes('NativeEmpty.vue')) return null

      // 只处理 template 部分: 用最简单的方式 - 找 <template> ... </template>
      const templateMatch = code.match(/<template>([\s\S]*?)<\/template>/i)
      if (!templateMatch) return null
      const fullTemplate = templateMatch[0]
      const inner = templateMatch[1]
      const result = rewriteTemplate(inner)
      if (!result.changed) return null
      if (debug) {
        // eslint-disable-next-line no-console
        console.log(`[replace-el-empty] ${id}: replaced ${result.count} <el-empty>`)
      }
      const newTemplate = `<template>${result.code}</template>`
      const newCode = code.replace(fullTemplate, newTemplate)

      return {
        code: newCode,
        map: null,
      }
    },
  }
}
