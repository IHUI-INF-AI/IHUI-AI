// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { defineConfig } from 'vitest/config'

/**
 * 收集面 = 本包测试文件仅有的两棵子树(实测 2026-09-25:`npx vitest list --filesOnly` = 55 份
 * = src 39 + tests 16,磁盘上不存在第三种落点)。与下面的装载不变量共用同一份常量,不另立第二份真相。
 */
const COLLECT_INCLUDE = [
  'src/**/*.{test,spec}.?(c|m)[jt]s?(x)',
  'tests/**/*.{test,spec}.?(c|m)[jt]s?(x)',
]

/**
 * 装载不变量:src/** 与 tests/** 缺一棵就是"静默丢整批用例"。为什么要把断言写在配置里、而不是只写
 * 在测试里:证明本身躺在 tests/** 下 —— 谁把 include 收成 src/**,它就跟着不再执行,而 `vitest run`
 * 仍然 exit 0(实测:收窄后 39 份全绿、830 例,16 份 tests/ 用例连同证明一起消失)。配置在收集**之前**
 * 被加载,这里抛错 = 整包直接红,把"静默"换成"响亮"。删掉这段同样要付 visible diff 的代价,而收窄
 * include 原本零成本 —— 这正是本包注释谎话能活到今天的机制。
 */
function assertCollectionSurface(patterns: readonly string[]): void {
  const missing = ['src', 'tests'].filter((root) => !patterns.some((p) => p.startsWith(`${root}/`)))
  if (missing.length > 0) {
    throw new Error(
      `[packages/shared/vitest.config] 收集面缺少子树: ${missing.join(', ')}。` +
        `现值: ${patterns.join(' | ') || '(空)'}。` +
        `tests/** 必须在面内 —— tests/chat/waiting-keys-in-end-packages.test.ts 是从 packages/i18n/tests/ ` +
        `搬进来的(架构契约门 103 判 D2 只看层序 rank),漏掉即整批静默不执行。` +
        `确要新增第三棵子树,请连同 COLLECT_INCLUDE、本断言与 tests/chat/waiting-keys-collection.test.ts 一起改。`,
    )
  }
}

assertCollectionSurface(COLLECT_INCLUDE)

export default defineConfig({
  test: {
    // 收集面显式写死,且 **src/** 与 tests/** 两棵子树都必须在面内**(实测 2026-09-25:
    // `npx vitest list --filesOnly` = 55 份 = src 39 + tests 16,磁盘上不存在第三种落点)。
    // 为什么单独补这一行 include:此前这里只有 exclude,收集全靠 vitest 默认 glob,而紧邻的注释
    // 却写着"只跑 src 下的测试" —— 注释与实际行为**相反**。下一个人若相信那句去把 include 真收成
    // src/**,tests/ 下那 16 份用例会**静默不再执行**:文件还在仓库里、全链照样绿,只是没人跑它
    // (本仓称之为"造好没装车")。而 tests/** 必须在面内是有具体原因的 ——
    // `tests/chat/waiting-keys-in-end-packages.test.ts`(D79 等待态词包防回潮,12 例)今天刚从
    // `packages/i18n/tests/` 搬来:架构契约门(103)判 D2 依赖方向只看层序 rank,i18n(20) 反向
    // 依赖 shared(30) 即红,搬进 shared 同包则零跨模块边;它读各端词包用 readFileSync,不构成
    // import 边。装载正确性现由两把尺子钉死:本文件的 assertCollectionSurface(收集前就判,收窄即整包红)
    // + `tests/chat/waiting-keys-collection.test.ts`(派生 `vitest list` 真实收集结果并与磁盘全集对账),
    // 不得只靠本注释。新增用例只能落 src/** 或 tests/**;落到别处 = 那枚证明判红,要么搬回,要么加一档 glob。
    include: [...COLLECT_INCLUDE],
    // `dist/` 是 tsc 产物,里面也躺着 31 份编译后的 .test.js
    // (实测 vitest 4.1.10 会把它们一并收集 —— 默认 exclude 未覆盖本包的 dist 布局)。
    // 危害不是"多跑一遍":本包有 D75 纪律的**源码级结构断言**(test 里 readFileSync 自己的
    // 被测模块,如 `../input-sources.ts`),编译产物旁边根本没有 .ts 可读 ⇒ 必然 ENOENT,
    // 且栈帧被 sourcemap 映射回 src,报错看起来像 src 的测试坏了。2026-09-24 就是这么红了一次。
    // 显式 exclude 会**替换**默认值,故把默认项一并写全。
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/cypress/**',
      '**/.{idea,git,cache,output,temp}/**',
      '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,postcss,css}.config.*',
    ],
  },
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
