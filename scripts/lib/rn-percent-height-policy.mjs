// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * RN 端「百分比高度」判据的单一真相源。
 *
 * 消费方只有两处,且都不许自己再写一份正则(§22c):
 *   ① scripts/check-sheet-flex-contract.mjs 的 R3(提交链 blocking 门 217);
 *   ② apps/mobile-rn/tests/dialog-geometry.test.ts 的全源码零容忍断言。
 *
 * 病理:RN 0.86 Fabric 下百分比 maxHeight / minHeight 不给子节点确定测量边界,
 * 内部 ScrollView / FlatList 滚不动,配合 overflow:'hidden' 还会把底部内容裁掉;
 * 非 100% 的百分比 height 同理。100% 撑满形态例外:父容器有确定高度时可正常解析。
 *
 * 三态纪律:本件只做纯文本判定、不碰 IO;审面取不到由门自己 exit 2「未判定」。
 * 豁免须「验过才免且会到期」(AGENTS §0.7):命中点邻近必须出现登记的样式键名,
 * 全量档还要核对每条豁免真的被命中(清单腐烂判红),并有存活期。
 */

/** R3 独立扫描面:RN 端 + 共享层(共享组件同样会被 RN 渲染,不能被漏在面外) */
export const PERCENT_HEIGHT_SCAN_RELS = Object.freeze(['apps/mobile-rn/src', 'packages/app/src'])

export const SCAN_EXT_RE = /\.(?:ts|tsx|js|jsx)$/

/** 单引号 / 双引号 / 模板串一视同仁,换个引号不能绕过判据 */
export const PERCENT_HEIGHT_RE = /\b(maxHeight|minHeight|height)\s*:\s*(['"`])(\d+)%\2/g

/** 豁免族存活期:到期未复评 ⇒ 门红。 */
export const PERCENT_HEIGHT_EXEMPTION_EXPIRES = '2027-03-27'

/**
 * 非 100% 的百分比 height 唯一合法形态 = 父容器确定高度下的图片内容比例:
 * 内部无滚动列表,是图片自身显示比例,不是弹层限高,不属 Fabric 测量缺陷。
 * key 用于「逐行生效」校验,rel 与 percent 三者同时匹配才免。
 */
export const PERCENT_HEIGHT_EXEMPTIONS = Object.freeze([
  {
    rel: 'apps/mobile-rn/src/screens/ChatScreen.tsx',
    key: 'imagePreviewFull',
    percent: 80,
    why: '图片预览:父容器 flex:1 确定高度,内部无滚动列表',
  },
  {
    rel: 'apps/mobile-rn/src/screens/ProfileScreen.tsx',
    key: 'previewImage',
    percent: 80,
    why: '头像/图片预览:预览项取 screenHeight 确定高度,内部无滚动列表',
  },
  {
    rel: 'packages/app/src/features/chat-room/ChatRoomScreen.tsx',
    key: 'previewImage',
    percent: 80,
    why: '共享层图片预览:fullscreen 容器 flex:1 确定高度,内部无滚动列表',
  },
  {
    rel: 'packages/app/src/features/chat/ChatMessageList.tsx',
    key: 'fullscreenImage',
    percent: 80,
    why: '共享层全屏看图:fullscreen 容器 flex:1 确定高度,内部无滚动列表',
  },
])

export function exemptionKeyOf(e) {
  return `${e.rel}#${e.key}`
}

/** 到期即失效;日期串写坏也判失效,绝不静默放行 */
export function exemptionExpired(now = new Date()) {
  const t = Date.parse(PERCENT_HEIGHT_EXEMPTION_EXPIRES)
  return !Number.isFinite(t) || now.getTime() > t
}

/**
 * 纯文本判据。返回违规数组;命中合法豁免时额外带 exemptionKey 供门收集命中集。
 * rel 必须是仓库相对路径(正斜杠),与豁免清单的口径一致。
 */
export function findPercentHeightViolations(src, rel) {
  const out = []
  const re = new RegExp(PERCENT_HEIGHT_RE.source, 'g')
  let m
  while ((m = re.exec(src))) {
    const prop = m[1]
    const percent = Number(m[3])
    const line = src.slice(0, m.index).split('\n').length
    const base = { rel, line, prop, percent, text: m[0] }

    if (prop === 'maxHeight' || prop === 'minHeight') {
      out.push({
        ...base,
        reason: '百分比限高在 Fabric 下不提供确定测量边界,改用 lib/dialog-geometry.ts 的数值高度',
      })
      continue
    }
    // height:'100%' 是撑满形态:父容器有确定高度,不属于限高缺陷
    if (percent === 100) continue

    const near = src.slice(Math.max(0, m.index - 240), m.index)
    const ex = PERCENT_HEIGHT_EXEMPTIONS.find(
      (e) => e.rel === rel && e.percent === percent && near.includes(e.key),
    )
    if (ex) {
      out.push({
        ...base,
        allowed: true,
        exemptionKey: exemptionKeyOf(ex),
        why: ex.why,
      })
      continue
    }
    out.push({
      ...base,
      reason: '非 100% 的百分比 height 未登记豁免;限高面板必须接数值高度真相源',
    })
  }
  return out
}

/** 全量档清单腐烂检查:登记过的豁免必须真的在审面上被命中,否则判红 */
export function exemptionRotCheck(seenKeys) {
  return PERCENT_HEIGHT_EXEMPTIONS.map(exemptionKeyOf).filter((k) => !seenKeys.has(k))
}

/** 供测试 import 的聚合出口(§22c:测试 import 源脚本 __test__,禁止复制判据) */
export const __test__ = Object.freeze({
  PERCENT_HEIGHT_RE,
  PERCENT_HEIGHT_SCAN_RELS,
  PERCENT_HEIGHT_EXEMPTIONS,
  PERCENT_HEIGHT_EXEMPTION_EXPIRES,
  SCAN_EXT_RE,
  exemptionKeyOf,
  exemptionExpired,
  exemptionRotCheck,
  findPercentHeightViolations,
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
