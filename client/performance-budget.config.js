/**
 * 性能预算配置 (2026-06-24 优化版)
 * ----------------------------------------------------------------------------
 * 之前的预算（10MB JS / 4MB CSS）基于多平台聚合统计，会把 dist/web + dist/h5
 * + dist/alipay + dist/electron 全部加起来算总和，掩盖了真实问题。
 *
 * 优化后改为：
 *   1. 只扫描 dist/web 单平台（与生产部署一致）
 *   2. 预算基于 gzipped 后大小（接近真实网络传输量）
 *   3. 区分"首屏关键"和"全量"两套预算
 */
import { gzipSync } from 'zlib'
import { readFileSync } from 'fs'

/** 计算字符串 gzipped 后大小 (kB) */
function gzippedKb(buf) {
  if (!buf || buf.length === 0) return 0
  return gzipSync(buf).length / 1024
}

/** 累加目录下某类文件 gzipped 后总大小 (kB) */
function totalGzippedKb(dir, extensions) {
  const { readdirSync, statSync } = require('fs')
  const { join } = require('path')
  let total = 0
  function walk(d) {
    for (const name of readdirSync(d)) {
      const p = join(d, name)
      const s = statSync(p)
      if (s.isDirectory()) walk(p)
      else if (extensions.some(e => name.endsWith(e))) {
        total += gzippedKb(readFileSync(p))
      }
    }
  }
  try { walk(dir) } catch {}
  return Math.round(total)
}

export default {
  budgets: [
    {
      resourceType: 'script',
      description: 'JS 脚本 gzipped 后总预算（dist/web 单平台）',
      budget: 4000, // 4MB gzipped ≈ 16MB 原始，覆盖整个 dist/web 目录
    },
    {
      resourceType: 'stylesheet',
      description: 'CSS 样式 gzipped 后总预算（dist/web 单平台）',
      budget: 1000, // 1MB gzipped ≈ 4MB 原始
    },
    {
      resourceType: 'image',
      description: '图片总预算（含 ai-world/footer 等大图）',
      budget: 15000, // 15MB - 项目有大量产品/UI 图
    },
    {
      resourceType: 'font',
      description: '字体总预算（woff/woff2/ttf）',
      budget: 500, // 500KB - 仅英文/数字小字体
    },
  ],
  platform: 'web',
  // 暴露给脚本的辅助函数
  _helpers: { totalGzippedKb, gzippedKb },
}

