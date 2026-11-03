#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


/**
 * NativeWind 升级就绪监控脚本
 *
 * 监控 NativeWind 是否已发布 5.0 stable(届时可移除 apps/mobile-rn/metro.config.js
 * 中的 Module._resolveFilename monkey-patch,详见该文件第 3、5 点评估)。
 *
 * 检测逻辑:
 *   - 调用 `npm view nativewind dist-tags --json` 获取 latest / preview 标签
 *   - 若 latest 主版本 === 5 且版本号不含 "preview" → 5.0 stable 已发布 → exit 1
 *   - 若 latest 仍为 4.x,或 5.x 仍带 preview 后缀 → 未就绪 → exit 0
 *
 * 用法:
 *   node scripts/check-nativewind-status.mjs          # 人工检查
 *   pnpm nativewind:status                            # 等价 npm script(若已配置)
 *   CI 每月调度:crontab "0 0 1 * *" node scripts/check-nativewind-status.mjs
 *
 * 退出码:
 *   0  - NativeWind 5.0 stable 尚未发布(当前 4.x 或 5.x-preview),无需动作
 *   1  - NativeWind 5.0 stable 已发布,可执行升级步骤移除 monkey-patch
 *   2  - 网络不可用 / npm registry 查询失败(不误报,打印警告)
 */

import { execSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

const STABLE_5_RE = /^5\.\d+\.\d+$/ // 5.x.y 纯数字,无 preview 后缀

/**
 * 判据单元①:latest 是否为 5.x.y 纯数字 stable。
 * [G-1058651 §22c] 由原 main() 内联表达式 `STABLE_5_RE.test(latest)` 逐字搬出,语义/阈值未改。
 */
function isStable5Latest(latest) {
  return STABLE_5_RE.test(latest)
}

/**
 * 判据单元②:未就绪时的归因文案。
 * [G-1058651 §22c] 由原 main() 内联三元链逐字搬出,三个分支文案与判定顺序未改。
 */
function notReadyReason(latest) {
  return latest.startsWith('4.')
    ? '仍是 4.x'
    : latest.includes('preview')
      ? '仍为 5.x preview,非 stable'
      : '非 5.0 stable'
}

async function main() {
  let distTags
  try {
    const out = execSync('npm view nativewind dist-tags --json', {
      encoding: 'utf8',
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
      // 返回值被消费(JSON.parse(out))⇒ stdout 仍须 pipe,只把 stdin 切掉
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 30000,
      windowsHide: true,
    })
    distTags = JSON.parse(out)
  } catch (err) {
    console.warn(
      '⚠ NativeWind 状态查询失败(网络不可用或 npm registry 异常),跳过检查。'
    )
    console.warn(`  错误: ${err.message}`)
    return 2 // 未判定:网络/registry 不可达 ⇒ 不误报(原 process.exit(2),退出码分档未改)
  }

  const latest = distTags.latest
  const preview = distTags.preview

  if (!latest) {
    console.warn('⚠ npm registry 返回的 dist-tags 缺少 latest 字段,跳过检查。')
    return 2 // 未判定:取不到判未判定,不记绿(原 process.exit(2))
  }

  const isStable5 = isStable5Latest(latest)

  console.log(`NativeWind 升级就绪检查`)
  console.log(`  latest  tag: ${latest}${isStable5 ? '  ← 5.0 stable!' : ''}`)
  if (preview) console.log(`  preview tag: ${preview}`)

  if (isStable5) {
    console.log('')
    console.log('✅ NativeWind 5.0 stable 已发布!')
    console.log('   可执行升级步骤移除 apps/mobile-rn/metro.config.js 中的 monkey-patch:')
    console.log('   1. 升级 nativewind 到 5.x stable')
    console.log('   2. 移除 metro.config.js 中的 Module._resolveFilename monkey-patch')
    console.log('   3. 删除 apps/mobile-rn 本地 tailwindcss@3 依赖')
    console.log('   4. 27 + 11 文件 className 全链路冒烟测试')
    return 1 // 命中:5.0 stable 已发布(原 process.exit(1))
  }

  const reason = notReadyReason(latest)
  console.log(`\n⏳ NativeWind 5.0 stable 尚未发布(${reason}),monkey-patch 暂保留。`)
  return 0 // 放过:未就绪(原 process.exit(0))
}

/** §22d 双形态入口守护:测试 import 时不得触发 CLI 副作用(联网查询 + 退出码)。 */
const isDirectRun =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  main()
    .then((code) => {
      if (code) process.exit(code)
    })
    .catch((e) => {
      console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
      process.exit(2)
    })
}

// [G-1058651 §22c] 判据单元唯一出处:镜像测试 import 本对象,不得自抄判据。置于守卫之后。
export const __test__ = {
  STABLE_5_RE,
  isStable5Latest,
  notReadyReason,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
