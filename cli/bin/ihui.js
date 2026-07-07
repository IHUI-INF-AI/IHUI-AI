#!/usr/bin/env node
// IHUI CLI 入口 — 使用 tsx 运行时编译 TypeScript
//
// 开发模式: 直接运行 TypeScript (tsx tsImport API)
// 生产模式: 运行编译后的 JS (dist/index.js)
//
// 注意: tsx v4+ 的 ESM API 是 tsImport, 不是 register

try {
  // 优先尝试加载编译后的 JS (生产模式)
  await import('../dist/index.js')
} catch {
  // 回退到 tsx 实时编译 (开发模式)
  const { tsImport } = await import('tsx/esm/api')
  await tsImport('../src/index.ts', import.meta.url)
}
