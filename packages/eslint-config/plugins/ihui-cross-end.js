/**
 * @ihui/eslint-plugin-cross-end
 *
 * 跨端重复实现守门(2026-07-28 立,AGENTS.md §9 多端同步配套)
 *
 * 触发场景:在 apps/{mobile-rn,miniapp-taro}/src/{hooks,utils,stores}/<file>.ts 下
 * 新建文件时,如果 packages/shared/src/<同子目录>/<同名 file>.ts 已存在,
 * 且当前文件没有 import/export 任何 @ihui/shared 模块,则报错。
 *
 * 合规模式(已就位的端内文件全部符合):
 * 1. 纯 re-export:`export { useXxx } from '@ihui/shared/hooks'`
 * 2. 工厂注入:`import { createUseClipboard } from '@ihui/shared/hooks'` + 平台实现
 * 3. 薄封装:`import { exchangeSsoCode as core } from '@ihui/shared/auth/sso-core'` + 平台 API
 *
 * 不触发(豁免):
 * - 端独占 hook/util(如 mobile-rn/use-biometrics.ts,shared 无同名)
 * - 子目录文件(如 stores/helpers/create-taro-zustand-hook.ts,不在直接子文件范围)
 * - index.ts(入口聚合文件)
 * - 测试文件(*.test.ts / *.spec.ts)
 *
 * 设计原则:零误伤 + 防未来漂移。当前(2026-07-28)所有现存文件均合规,规则只对
 * 新代码生效,防止开发者重新实现 shared 已提供的能力。
 */
import fs from 'node:fs'
import path from 'node:path'

/**
 * 从给定路径向上查找 monorepo root(含 pnpm-workspace.yaml 的目录)。
 * @param {string} fromPath 起始路径(文件或目录)
 * @returns {string | null} monorepo root 绝对路径,找不到返回 null
 */
function findMonorepoRoot(fromPath) {
  let dir = path.dirname(fromPath)
  while (dir !== path.dirname(dir)) {
    try {
      if (fs.existsSync(path.join(dir, 'pnpm-workspace.yaml'))) return dir
    } catch {
      // fs 访问异常时继续向上查找,不阻塞 lint
    }
    dir = path.dirname(dir)
  }
  return null
}

export default {
  rules: {
    'no-reimpl-when-shared-exists': {
      meta: {
        type: 'problem',
        docs: {
          description:
            '禁止在 apps/{mobile-rn,miniapp-taro}/src/{hooks,utils,stores} 下重新实现 packages/shared 已有的同名模块。应通过 re-export 或工厂注入复用 @ihui/shared。',
          url: 'https://github.com/ihui-ai/ihui/blob/main/AGENTS.md#9-多端同步开发强制规则强制',
        },
        schema: [],
        messages: {
          reimpl:
            'packages/shared/{{sharedPath}}.ts 已存在同名模块。端内 {{endPath}} 不允许重新实现,请改用以下模式之一:\n' +
            "  1. 纯 re-export:`export { xxx } from '@ihui/shared/{{subdir}}'`\n" +
            "  2. 工厂注入:`import { createXxx } from '@ihui/shared/{{subdir}}'" +
            ' + 注入平台实现\n' +
            '  3. 薄封装:import shared 核心逻辑 + 仅保留端独占 API 调用\n' +
            '详见 AGENTS.md §9 多端同步开发强制规则。',
        },
      },
      create(context) {
        const filename = context.filename || ''
        if (!filename) return {}

        // 路径归一化(Windows 反斜杠 → 正斜杠)
        const normalized = filename.replace(/\\/g, '/')

        // 仅触发 apps/{mobile-rn,miniapp-taro}/src/{hooks,utils,stores}/<file>.ts(x)
        // 不匹配子目录(如 stores/helpers/、stores/tests/),只守门直接子文件
        const match = normalized.match(
          /apps\/(mobile-rn|miniapp-taro)\/src\/(hooks|utils|stores)\/([^/]+\.(ts|tsx))$/,
        )
        if (!match) return {}

        const [, endName, subdir, fileWithExt] = match
        const basename = fileWithExt.replace(/\.(ts|tsx)$/, '')

        // 豁免:index.ts(入口聚合文件,允许多模块 re-export 聚合)
        if (basename === 'index') return {}

        // 豁免:测试文件(尽管 .test.ts 通常在 tests/ 子目录,这里兜底)
        if (/\.(test|spec)$/.test(basename)) return {}

        const root = findMonorepoRoot(filename)
        if (!root) return {}

        // 检查 packages/shared/src/<subdir>/<basename>.ts(x) 是否存在
        const candidates = [
          path.join(root, 'packages', 'shared', 'src', subdir, `${basename}.ts`),
          path.join(root, 'packages', 'shared', 'src', subdir, `${basename}.tsx`),
        ]
        const sharedExists = candidates.some((p) => {
          try {
            return fs.existsSync(p)
          } catch {
            return false
          }
        })
        if (!sharedExists) return {}

        // 检查当前文件是否已引用 @ihui/shared(合规信号)
        const source = context.sourceCode.text
        if (/@ihui\/shared/.test(source)) return {}

        // 当前文件未引用 @ihui/shared,但 shared 已有同名模块 → 报错
        return {
          Program(node) {
            context.report({
              node,
              messageId: 'reimpl',
              data: {
                sharedPath: `${subdir}/${basename}`,
                endPath: `apps/${endName}/src/${subdir}/${fileWithExt}`,
                subdir,
              },
            })
          },
        }
      },
    },
  },
}
