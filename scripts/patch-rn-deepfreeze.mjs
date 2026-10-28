#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * patch-rn-deepfreeze.mjs — 幂等修复 RN 0.86 deepFreeze × react-native-svg 15 兼容问题
 *
 * 背景(2026-09-03 实测):react-native-svg 15.x 会对 defaultProps/propTypes 等对象做预冻结
 * (configurable:false),而 RN 0.86 dev 模式 deepFreezeAndThrowOnMutationInDev 会对对象每个
 * key 二次 Object.defineProperty,抛 "property is not configurable",阻断整个 App 初始化
 * (红屏,非 bundle 错误,属渲染期崩溃)。
 *
 * 为什么不用 pnpm patchedDependencies:本仓库 react-native@0.86.2 存在多个 peer 变体
 * (react-native@0.86.2_@babel+_c6de... / _efa7...),裸版本 patch 声明有歧义;且打补丁需
 * 全量 pnpm install(重、扰动并行会话)。此脚本扫描 .pnpm 下全部 0.86.2 实例逐个注入,幂等。
 *
 * 用法: node scripts/patch-rn-deepfreeze.mjs
 * 触发: 每次 pnpm install 重置 node_modules 后、或 mobile-rn Android dev 前执行一次
 *       (scripts/start-mobile-rn-android.ps1 已自动调用)。已补丁实例自动跳过。
 */
import {readdirSync, readFileSync, writeFileSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pnpmDir = join(root, 'node_modules', '.pnpm');
const relTarget =
  'node_modules/react-native/Libraries/Utilities/deepFreezeAndThrowOnMutationInDev.js';

const MARKER = '2026-09-03 兼容性补丁';

// 上游原始代码块(8 空格缩进,与 0.86.2 一致)
const ORIGINAL = `        Object.defineProperty(object, key, {
          get: identity.bind(null, object[key]),
        });
        Object.defineProperty(object, key, {
          set: throwOnImmutableMutation.bind(null, key),
        });`;

// 补丁后代码块:预冻结属性跳过 + defineProperty 失败静默容忍
const PATCHED = `        // 2026-09-03 兼容性补丁: react-native-svg 15.x 等第三方库会对属性预冻结
        // (configurable:false),RN 0.86 deepFreeze 二次 defineProperty 会抛 "property is not
        // configurable" 阻断 App 初始化。降级: 已冻结属性跳过,defineProperty 失败静默容忍。
        try {
          const existing = Object.getOwnPropertyDescriptor(object, key);
          if (existing && existing.configurable === false) {
            // 第三方库已冻结该 key,RN 跳过(对象已不会再变更)
          } else {
            Object.defineProperty(object, key, {
              get: identity.bind(null, object[key]),
            });
            Object.defineProperty(object, key, {
              set: throwOnImmutableMutation.bind(null, key),
            });
          }
        } catch (_e) {
          // 防御性兜底: 任何 defineProperty 失败静默跳过,保证 dev 模式可继续渲染
        }`;

let found = 0;
let patched = 0;
let skipped = 0;
let warned = 0;

let dirs;
try {
  dirs = readdirSync(pnpmDir);
} catch (err) {
  if (err.code === 'ENOENT') {
    console.warn('[warn] node_modules/.pnpm 不存在(node_modules 未安装),无需补丁');
    process.exit(0);
  }
  throw err;
}

const rnDirs = dirs.filter((e) => e.startsWith('react-native@0.86.2'));
for (const dir of rnDirs) {
  const file = join(pnpmDir, dir, relTarget);
  let content;
  try {
    content = readFileSync(file, 'utf8');
  } catch {
    console.warn(`[warn] 未找到 ${file},跳过`);
    warned++;
    continue;
  }
  found++;
  if (content.includes(MARKER)) {
    console.log(`[skip] 已补丁: ${dir}`);
    skipped++;
    continue;
  }
  const idx = content.indexOf(ORIGINAL);
  if (idx === -1) {
    console.warn(`[warn] 未匹配到原始代码块,不修改(避免损坏): ${dir}`);
    warned++;
    continue;
  }
  writeFileSync(file, content.slice(0, idx) + PATCHED + content.slice(idx + ORIGINAL.length), 'utf8');
  console.log(`[patched] 已注入 deepFreeze 兼容补丁: ${dir}`);
  patched++;
}

if (found === 0) {
  console.warn('[warn] 未找到 react-native@0.86.2 实例;若已安装请检查 pnpm install 后重试');
  process.exit(1);
}
console.log(`[done] 扫描 ${found} 个实例 | 新补丁 ${patched} | 已存在 ${skipped} | 告警 ${warned}`);
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
