// 平台特有:依赖 Node.js API(os),不适合共享
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import os from 'node:os'
import { createDeviceFingerprintCollector } from '@ihui/types'

const __dirname = dirname(fileURLToPath(import.meta.url))
const pkg = JSON.parse(
  readFileSync(join(__dirname, '..', '..', 'package.json'), 'utf-8'),
) as { version: string }

/**
 * cli 端设备指纹采集器(Node.js CLI)。
 *
 * Node.js 环境无 DOM,采集:
 * - platform: process.platform('win32' / 'darwin' / 'linux')
 * - userAgent: `IHUI-CLI/${version} (${platform}/${arch})`,version 从 package.json 读取
 * - hardwareConcurrency: os.cpus().length
 * 不采集 screen/canvas/webgl(Node.js 无 DOM)。
 */
export const cliDeviceFingerprintCollector = createDeviceFingerprintCollector({
  collect: () => ({
    platform: process.platform,
    userAgent: `IHUI-CLI/${pkg.version} (${process.platform}/${process.arch})`,
    hardwareConcurrency: os.cpus().length,
  }),
})
