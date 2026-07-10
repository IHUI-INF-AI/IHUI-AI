#!/usr/bin/env node
/**
 * 守门脚本：检测 LanguageSwitcher / AppDownload 下拉菜单的 watch(visible) 定位时序
 *
 * 历史根因 (2026-07-06 彻底修复):
 *  - watch(visible, v => v && updateMenuPosition(...)) 默认 flush:'pre'
 *  - flush:'pre' 在组件 DOM 更新前执行, 此时 v-if="visible" 菜单尚未渲染, menuEl.value === null
 *  - useDropdownPosition.updatePosition 首行 `if (!menuEl) return false` 直接退出
 *  - 菜单 inline top/left 永不设置 → position:fixed 无定位值 → 菜单渲染在视口错误位置
 *    (被 header 遮挡或落在视口外) → 用户"点击不弹菜单"
 *  - 此问题与 popper backdrop 泄漏 (check-popper-backdrop-leak.mjs) 是两个独立根因,
 *    交替触发导致"修了又坏, 坏了又修"的反反复复。
 *  - 实测证据 (verify-dropdown-rootcause.cjs): 修复前菜单 inlineTop/inlineLeft 均为空字符串,
 *    菜单 rect.top=900 (视口外), rect.left=0, 而触发器在 x=38 → 菜单不在触发器下方。
 *
 * 本脚本确保两个组件的 watch(visible) 必须用 { flush: 'post' },
 * 缺失则 pre-commit / CI 阻断, 杜绝根因 2 再次复发。
 *
 * 用法:
 *   node scripts/check-dropdown-watch-flush.mjs
 */
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = resolve(__dirname, '..')

const TARGETS = [
  {
    file: 'src/components/header/parts/LanguageSwitcher.vue',
    name: 'LanguageSwitcher',
  },
  {
    file: 'src/components/header/parts/AppDownload.vue',
    name: 'AppDownload',
  },
]

const REQUIRED = [
  {
    name: "watch(visible) 含 flush: 'post'",
    // 匹配 watch( visible ... flush: 'post' 或 flush: "post", 容许中间 0~150 字符
    pattern: /watch\(\s*visible[\s\S]{0,150}flush:\s*['"]post['"]/,
    desc: "防止默认 flush:'pre' 在 DOM 更新前执行导致 menuEl===null, 菜单 inline 定位永不设置",
  },
  {
    name: 'watch(visible) 调用 updateMenuPosition',
    pattern: /watch\(\s*visible[\s\S]{0,150}updateMenuPosition/,
    desc: '确保 visible 变化时触发定位计算',
  },
  {
    name: 'open() 内 nextTick 主动定位 (双保险)',
    pattern: /nextTick\(\(\)\s*=>\s*updateMenuPosition/,
    desc: '即使 watch flush 被误删, open 时 nextTick 仍能定位',
  },
]

let failed = 0
for (const t of TARGETS) {
  const full = resolve(ROOT, t.file)
  if (!existsSync(full)) {
    console.error(`[FAIL] ${t.name}: 文件不存在 ${t.file}`)
    failed++
    continue
  }
  const content = readFileSync(full, 'utf8')
  for (const r of REQUIRED) {
    if (!r.pattern.test(content)) {
      console.error(`[FAIL] ${t.name}: ${r.name}`)
      console.error(`       ${r.desc}`)
      failed++
    } else {
      console.log(`[ OK ] ${t.name}: ${r.name}`)
    }
  }
}

if (failed > 0) {
  console.error(`\n❌ 失败 ${failed} 项: 下拉菜单 watch(visible) 时序约束不满足`)
  console.error("   根因: 默认 flush:'pre' 在 DOM 更新前执行, menuEl===null,")
  console.error('         updatePosition 首行 return false, 菜单 inline 定位永不设置,')
  console.error('         position:fixed 无定位值 → 菜单渲染在视口错误位置 → "点击不弹菜单"')
  console.error("   修复: watch(visible, v => v && updateMenuPosition(...), { flush: 'post' })")
  console.error('         并在 open() 内加: nextTick(() => updateMenuPosition(selectorEl.value, menuEl.value))')
  process.exit(1)
}

console.log(`\n✅ 全部 ${TARGETS.length * REQUIRED.length} 项检查通过`)
