/**
 * withPermissionPruning.cjs — 摘除"包内声明但代码零引用"的危险权限(2026-11-03 立)
 *
 * 立因(实测,不是预防):`android.permission.SYSTEM_ALERT_WINDOW`(悬浮窗/显示在其他应用上层)
 * 出现在 prebuild 生成的 app manifest 第 13 行,manifest-merger-release-report 标它是
 * `ADDED from app/src/main/AndroidManifest.xml`,而全仓 `apps/mobile-rn/src`、`packages/app/src`、
 * `packages/shared/src` 对 SYSTEM_ALERT_WINDOW / canDrawOverlays / ACTION_MANAGE_OVERLAY_PERMISSION
 * **零命中**。一个没人用的危险权限在国内商店与工信部通报里都是重点项:要么被要求补用途说明,
 * 要么直接被通报。摘掉比解释便宜。
 *
 * 为什么必须走 plugin 而不是直接改 xml:`android/` 整目录在 .gitignore 内(Expo prebuild 生成物),
 * 直改既不进仓、也会被下一次 prebuild 洗掉 —— 与 withNativeInputChrome.cjs 同一口径。
 * 这里同时做两件事:① 从当前 manifest 里删掉该条;② 追加 `tools:node="remove"`,
 * 让 manifest merger 在依赖库又把同名权限带回来时仍然摘得掉(只删不防 = 下次 autolinking 又长回来)。
 */
const { withAndroidManifest } = require('@expo/config-plugins')

/** 默认摘除集:全部满足"危险/受通报权限 ∧ 仓内零引用"两条,新增项要附证据再进表。 */
const DEFAULT_PRUNED = Object.freeze(['android.permission.SYSTEM_ALERT_WINDOW'])

const NAME = 'android:name'
const TOOLS_NODE = 'tools:node'

function prune(manifest, pruned) {
  // @expo/config-plugins 的 manifest 条目形状是 `{ $: { 'android:name': … } }`,属性住在 `$` 下。
  // 第一版写成 e?.[NAME] ⇒ 永远取到 undefined ⇒ filter 一条也删不掉,而 alreadyMarked 恒空,
  // 于是每次 prebuild 都往 manifest 里多塞一条 remove 指令。测试 S6 抓到了这两件事。
  const attr = (e, key) => e?.$?.[key] ?? e?.[key]
  const list = manifest['uses-permission'] ?? []
  // remove 指令条目本身也带着同一个权限名,必须先豁免 —— 否则每次 prebuild 都"删掉它再补一条",
  // removed 恒等于 1,回执就把"本来就摘好了"读成"这次又摘了一条"(2026-11-03 测试 S6 抓到)。
  const kept = list.filter((e) => attr(e, TOOLS_NODE) === 'remove' || !pruned.includes(attr(e, NAME)))
  const removed = list.length - kept.length
  // 只补"当前不在 manifest 里"的 remove 指令,避免同一条重复追加(重复条目会让 merger 报告变噪音)
  const alreadyMarked = new Set(kept.filter((e) => attr(e, TOOLS_NODE) === 'remove').map((e) => attr(e, NAME)))
  for (const p of pruned) {
    if (!alreadyMarked.has(p)) kept.push({ $: { [NAME]: p, [TOOLS_NODE]: 'remove' } })
  }
  manifest['uses-permission'] = kept
  return { removed, kept: kept.map((e) => `${attr(e, NAME)}${attr(e, TOOLS_NODE) ? `[${attr(e, TOOLS_NODE)}]` : ''}`) }
}

module.exports = function withPermissionPruning(config, props = {}) {
  const pruned = Array.isArray(props.prune) && props.prune.length ? props.prune : [...DEFAULT_PRUNED]
  return withAndroidManifest(config, (cfg) => {
    if (!cfg.modResults?.manifest) return cfg
    const { removed } = prune(cfg.modResults.manifest, pruned)
    if (removed > 0) {
      // prebuild 期的可见回执:这格被摘过就必须说出来,否则下一次审计只看到"manifest 里没有",
      // 分不清"本来就没有"与"被摘掉了"—— 后者是需要在商店材料里同步的。
      console.log(`[withPermissionPruning] 从 manifest 摘除 ${removed} 条未使用危险权限:${pruned.join(', ')}`)
    }
    return cfg
  })
}

module.exports.__test__ = { DEFAULT_PRUNED, prune }
