#!/usr/bin/env node
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

const STABLE_5_RE = /^5\.\d+\.\d+$/ // 5.x.y 纯数字,无 preview 后缀

function main() {
  let distTags
  try {
    const out = execSync('npm view nativewind dist-tags --json', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 30000,
    })
    distTags = JSON.parse(out)
  } catch (err) {
    console.warn(
      '⚠ NativeWind 状态查询失败(网络不可用或 npm registry 异常),跳过检查。'
    )
    console.warn(`  错误: ${err.message}`)
    process.exit(2)
  }

  const latest = distTags.latest
  const preview = distTags.preview

  if (!latest) {
    console.warn('⚠ npm registry 返回的 dist-tags 缺少 latest 字段,跳过检查。')
    process.exit(2)
  }

  const isStable5 = STABLE_5_RE.test(latest)

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
    process.exit(1)
  }

  const reason = latest.startsWith('4.')
    ? '仍是 4.x'
    : latest.includes('preview')
      ? '仍为 5.x preview,非 stable'
      : '非 5.0 stable'
  console.log(`\n⏳ NativeWind 5.0 stable 尚未发布(${reason}),monkey-patch 暂保留。`)
  process.exit(0)
}

main()
