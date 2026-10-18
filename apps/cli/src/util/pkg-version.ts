// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * CLI 包信息单一真相源(version + engines.minimumVersion)。
 *
 * 收敛此前四处各自为政的 package.json 读取(index.ts / lib/device-fingerprint.ts /
 * commands/repl.ts / crash-handler.ts / updater.ts):
 * - index.ts 与 device-fingerprint.ts 原先**无守卫**,文件缺失即启动崩溃
 *   (Node SEA 单文件形态下 dist 相对路径不存在,实测 --version 直接 ENOENT 崩溃);
 * - crash-handler.ts 原先在 ESM 包里裸用 `__dirname`(未定义),ReferenceError
 *   被 try/catch 吞成 'unknown'(与 updater.ts 历史缺陷同型);
 * - 四处哨兵默认值各不相同(0.0.0 / 1.0.0 / unknown),读取逻辑必须只有一份。
 *
 * 候选路径按序尝试,首个"可读且含 version 字段"者胜:
 * 1. `../package.json`        —— src 直跑与 dist 一层形态(src → 包根)
 * 2. `../../package.json`     —— dist/lib 两层形态(monorepo 构建产物)
 * 3. `<exe目录>/package.json` —— Node SEA 单文件形态(exe 旁随包携带)
 * 全部不可读返回 null,由调用方按各自哨兵语义兜底,本模块不设默认值。
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { tryParseJson, isRecord } from './json.js'

export interface CliPackageInfo {
  version: string
  /** package.json `engines.minimumVersion`(建议最低版本阈值,updater 闸门用) */
  minimumVersion?: string
}

function readPackageAt(pkgPath: string): CliPackageInfo | null {
  const raw = tryParseJson(readFileSync(pkgPath, 'utf-8'))
  if (!isRecord(raw) || typeof raw.version !== 'string') return null
  const engines = isRecord(raw.engines) ? raw.engines : {}
  return {
    version: raw.version,
    minimumVersion:
      typeof engines.minimumVersion === 'string' ? engines.minimumVersion : undefined,
  }
}

// SEA 单文件形态的构建期注入(build-sea.mjs 经 esbuild --define 写成常量字面量):
// exe 被拷进任意目录后,文件探测既可能落空(哨兵 0.0.0 ⇒ 版本闸门静默放行、UA 退化),
// 也可能误邻到宿主项目的 package.json(读出别人的版本)—— 构建注入优先于一切文件探测。
// dist(npm)形态不经 esbuild define,此处两值为 undefined,照走文件探测(tsc 产物不受影响)。
const BUILD_VERSION: string | undefined =
  typeof process.env.IHUI_BUILD_VERSION === 'string' ? process.env.IHUI_BUILD_VERSION : undefined
const BUILD_MIN_VERSION: string | undefined =
  typeof process.env.IHUI_BUILD_MIN_VERSION === 'string'
    ? process.env.IHUI_BUILD_MIN_VERSION
    : undefined

export function readCliPackage(selfUrl: string): CliPackageInfo | null {
  if (BUILD_VERSION) {
    return { version: BUILD_VERSION, minimumVersion: BUILD_MIN_VERSION }
  }
  const here = dirname(fileURLToPath(selfUrl))
  const candidates = [
    join(here, '..', 'package.json'),
    join(here, '..', '..', 'package.json'),
    join(dirname(process.execPath), 'package.json'),
  ]
  for (const pkgPath of candidates) {
    try {
      const info = readPackageAt(pkgPath)
      if (info) return info
    } catch {
      // ENOENT / EACCES 等 —— 换下一候选,不外抛
    }
  }
  return null
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
