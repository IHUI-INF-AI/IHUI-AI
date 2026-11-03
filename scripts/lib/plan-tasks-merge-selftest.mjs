// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 从 scripts/plan-tasks-merge.mjs 搬出来的 selfTest(2026-10-19;搬的是**纯测试码**)。
//
// 为什么搬:守门 103 的 C1(单文件 6000 行)**没有例外通道** ——
// check-architecture-policy.mjs:782 是直接 add('file-lines', ...),不查 exceptions,
// 所以往策略表加豁免是假豁免(门照红 + 表上多一条从不生效的例外)。而 C1 红着的唯一实际结局,
// 是每个碰 scripts/ 的提交都跳门、连带废掉全部守门(§12e/§12f 禁的正是这一型)。
// 搬折叠族那条路实测走不通(段外还引 keyOfRow/parseTaskRows 等 7+ 个助函数,搬出去主文件加载即崩,
// 已当场复原),而 selfTest 是唯一"大而不缠"的一段:928 行,段外引用全部可由调用方注入。
//
// 搬动规则:**函数体一个字都不改** —— 段外引用的名字在开头从 deps 解构成同名绑定,
// import 只带段内真用到的那几个(多一条不用的会被 no-unused-vars 判红,那是把红推给下一个人)。
// 主文件的 --self-test 分支照旧调 selfTest(),外部看不出这次搬动。
import { flagValue } from './flag-value.mjs'
import {
  DUP_POINTER_RE,
  compositeKeyOf,
  findPrefixNestedCopies,
  keyOfRow,
  planPrefixNestedPointer,
} from './plan-task-index.mjs'
import { headIdOf, lostMarkers, markerOf, loopBreakerDecision } from '../check-plan-line-loss.mjs'
import { forkPreserved } from './plan-merge-annotation.mjs'
export function runSelfTest(deps) {
  // 注入即同名绑定:名字一个一个列出来,方便下一个读的人核对"到底注入了什么"
  const {
    setArchivedIndex,
    archivedIndex,
    audit,
    rewriteFork,
    rewriteDup,
    buildMerge,
    auditPointerTerminals,
    buildRestoreTerminals,
    verifyRestoreTerminals,
    buildBlockDedupe,
    verifyBlockDedupe,
    findOpenRowTwins,
    findOpenRowRefusals,
    planOpenRowChunks,
    buildOpenRowDedupe,
    verifyOpenRowDedupe,
    buildTwinFold,
    stripTwinFold,
    twinFoldRejectReason,
    foldTwins,
    applyTwinFolds,
    verifyTwinFold,
    pointerVisibilityRegression,
    healStopReasons,
    verifyMerge,
    parsePositiveInt,
    inspectArgs,
    TWIN_GROUP_MAX,
    KNOWN_FLAGS,
    VALUE_FLAGS,
  } = deps
  function selfTestInner() {
    let pass = 0
    let fail = 0
    const ok = (c, n) => (c ? pass++ : (fail++, console.log(`  ❌ ${n}`)))
    const src = [
      '- [x] ✅(2026-09-20) **D6 复合主键正例**:说明文字。',
      '- [ ] **D6 复合主键正例**:旧副本。',
      '- [ ] **D97 作废声明**:〔本行判:已完成,勿照本行派单〕。',
      // F3 两型各一条,合起来才钉得住新语义:
      //  ①可自动收口 —— 指针指向的行与本行**同复合主键**,换成"同主键登记「本行键」"是真话;
      //  ②无自动出口 —— 指向的是**另一条主键**(作者当时指谁已不可推断),动它就是编造证据。
      '- [x] ✅(2026-09-20) **D96 指针**:同题的另一份登记。',
      '- [ ] **D96 指针**:本行正题逐字存活于 L4 的同编号登记。',
      '- [ ] **D95 指针无出口**:本行正题存活于 L1 的同编号登记。',
      '- [ ] **D98 真待办**:谁都没做过,不得被动。',
    ].join('\n')
    const r = buildMerge(src, '2026-09-26')
    // 3 = F1(D6 旧副本)+ F2(D97)+ D96 那一行。注意 D96 **同时**命中 F1 与 F3(它与已勾那份同复合主键,
    // 而指针又指向同主键的行)—— 一行只可能被改一次,所以这里不能按"判据条数"数,只能按行号数。
    ok(r.changed.length === 3, `应改 3 行(F1 + F2 + D96 那行),实测 ${r.changed.length}`)
    ok(r.refused.length === 0, `不应拒写,实测 ${JSON.stringify(r.refused)}`)
    const v = verifyMerge(src, r.text, r.changed)
    ok(v.problems.length === 0, `零损失与归零断言应全过:${JSON.stringify(v.problems)}`)
    ok(
      v.after.rotatedAuto === 0 && v.after.rotatedNoExit === 1,
      `可自动收口那一族必须归零、无出口那一族必须留着交人工,实测 auto=${v.after.rotatedAuto} noExit=${v.after.rotatedNoExit}`,
    )
    ok(
      v.after.claimable === 2,
      `归并后真待办应是 D95(无出口指针,事项本身没做完)+ D98 两条,实测 ${v.after.claimable}`,
    )
    const line5 = r.text.split('\n')[4]
    ok(!/存活于\s*L\d/.test(line5) && line5.includes('同主键登记'), 'F3(可收口)必须换成内容锚点')
    const line6 = r.text.split('\n')[5]
    ok(
      /存活于\s*L1\b/.test(line6),
      'F3(无出口)不得被自动改写 —— 把猜出来的锚点写进台账比留个腐烂行号更危险',
    )
    // 反向对照:未参与改写的行被偷偷动一下,零损失断言必须炸
    const sabotage = r.text.replace(
      '- [ ] **D98 真待办**:谁都没做过,不得被动。',
      '- [ ] **D98 真待办**:被偷偷改了。',
    )
    ok(
      verifyMerge(src, sabotage, r.changed).problems.length > 0,
      '破坏未登记行时断言必须炸(不得静默通过)',
    )
    // 自愈层的"该不该停手" —— 纯函数,三条各一对
    ok(healStopReasons(src, r.text, r.changed, 0).length === 0, '正当归并结果不得停手')
    ok(
      healStopReasons(src, `${r.text}\n多塞一行`, r.changed, 0).join().includes('行数不等'),
      '多塞一行必须停手',
    )
    ok(
      healStopReasons(src, src, r.changed, 0).join().includes('未归零'),
      '什么都不改(分叉仍在)必须停手 —— 否则自愈会变成"跑过一次就算修好"',
    )
    ok(healStopReasons(src, r.text, r.changed, 2).join().includes('拒写'), '有拒写项必须停手')
    /**
     * G-218(a) 成对判据:翻勾前后,剥掉复选框与本工具追加的注记之后,两侧正文必须逐字相等。
     * 正向 = 现行后置式与 legacy 前置式都判"保住了";反向 = "整行替换/截断"的实现必须被炸出来
     * (两代形态都过同一条 forkPreserved,看守侧与生产侧共用 lib 里那一份剥取实现)。
     */
    const G0 = '- [ ] G-218 一条待办:这段正文在翻勾后必须一字不差地活着。'
    const G0F = rewriteFork(G0, 'G-218#一条待办', '2026-09-28')
    ok(
      /^- \[x\] ✅\(2026-09-28\) G-218 一条待办/.test(G0F),
      `新形态必须把正文留在行首、注记追加行尾:${G0F.slice(0, 60)}`,
    )
    ok(forkPreserved(G0, G0F), '正当翻勾必须判"正文逐字保留"')
    ok(
      forkPreserved(
        G0,
        '- [x] ✅(2026-09-27) **[归并]** 本行与已完成登记同题(主键 「G-218 · 一条待办」),是被并发并集留下的未翻勾副本 ⇒ 只落状态、不删行、不重复计账。 G-218 一条待办:这段正文在翻勾后必须一字不差地活着。',
      ),
      'legacy 前置式(HEAD 存量形态)剥注记后同样必须逐字相等',
    )
    // 反向对照:"用注记文案整行替换"(循环肇因里被怀疑的形态)必须让本判据红
    ok(
      !forkPreserved(
        G0,
        '- [x] ✅(2026-09-28) **[归并]** 本行与已完成登记同题(主键 「G-218 · 一条待办」),是被并发并集留下的未翻勾副本 ⇒ 只落状态、不删行、不重复计账。 G-218 一条待办:这段正文被',
      ),
      '把正文截断的实现必须被 forkPreserved 抓住(变异对照,不得恒真)',
    )
    {
      // 两条落地闸(healStopReasons 与 verifyMerge)必须各自拦住"截断正文"的产物 ——
      // 只装一道,等于另一道将来可以随便漂(§12"两处算同一件事必漂移"同一条理由)。
      const trunc = [...r.changed]
      const first = trunc.findIndex(
        (c) => /(?:^|\+)F[12](?:\+|$)/.test(c.kind) && /^\s*- \[ \]/.test(c.before),
      )
      trunc[first] = { ...trunc[first], after: trunc[first].after.slice(0, 20) }
      const txt = r.text.split('\n')
      txt[trunc[first].line - 1] = trunc[first].after
      ok(
        healStopReasons(src, txt.join('\n'), trunc, 0).some((x) => x.includes('逐字保留')),
        'healStopReasons 必须拦下截断正文的那一行(自愈落地档)',
      )
      ok(
        verifyMerge(src, txt.join('\n'), trunc).problems.some((x) => x.includes('逐字相等')),
        'verifyMerge 对同一形态也必须点名(报告档,两闸不得只装一个)',
      )
    }
    /**
     * G-815914 成对自检:F1 与 F3 **落在同一行**、而 F3 走的是「归档反查出口」那一档措辞。
     *
     * 为什么单独立一对:上面那组夹具盖的是 F3 的 **face** 档(目标行还在面上)—— 那一档里
     * `rewritePointer(before, key)` 与生产侧 `rewritePointer(after, key, archived=null)` 同字面,
     * 所以"闸门少拿一个参数"这件事**结构上测不出来**。真仓 HEAD 面上 8 行(归档档)因此被两道
     * 落地闸同时判成"翻勾把正文改了",F1 73 组 / F4 425 行的整批归并被这 8 行挡住 —— 停手是安全的,
     * 但出口从此永不触发,这正是本仓记过多次的"判据失效的表现永远是安静"的反面(它太响了,响到没人能动)。
     *
     * 四条断言各钉一个方向:
     *  ① 生产侧确实把用过的归档值随记录交出去(装车证明 —— 没有这一条,"闸门通过"可能只是判据被削);
     *  ② 两闸对正当归档档产物**不再停手**;
     *  ③ 变异对照:把那个值摘掉 ⇒ 两闸**必须**各自翻红(证明它不是恒真、字段是有牙的);
     *  ④ face 档不受影响(与上面 src 那组同判,防"为了修归档档把面内档改坏")。
     */
    {
      const prevArch = archivedIndex()
      const aSrc = [
        '- [x] ✅(2026-09-20) **D94 归档指针**:同题的已完成登记。',
        '- [ ] **D94 归档指针**:本行正题逐字存活于 L7 的同编号登记。',
      ].join('\n')
      const aKey = compositeKeyOf(aSrc.split('\n')[1])
      ok(!!aKey, `夹具必须给得出复合主键(否则归档出口结构上不会命中,这条自检就成了空跑)`)
      setArchivedIndex(
        new Map([[aKey, { name: 'PROJECT_PLAN_2099-01-01_probe.md', title: '归档指针' }]]),
      )
      const ar = buildMerge(aSrc, '2026-09-29')
      const rec = ar.changed.find((c) => c.line === 2) ?? {}
      ok(
        /(?:^|\+)F3(?:\+|$)/.test(rec.kind ?? '') && /(?:^|\+)F1(?:\+|$)/.test(rec.kind ?? ''),
        `夹具必须产出 F1+F3 同一行,实测 kind=${rec.kind}`,
      )
      ok(r.text.split('\n')[4].includes('存活于同主键登记'), '④ face 档的措辞一字不得被这次改动带偏')
      ok(
        !!rec.pointerArchived && rec.pointerArchived.name === 'PROJECT_PLAN_2099-01-01_probe.md',
        `① 生产侧必须把归档出口的实际用值随 changed 记录交出(装车证明),实测 ${JSON.stringify(rec.pointerArchived)}`,
      )
      ok(
        ar.text.split('\n')[1].includes('已随归档搬至'),
        `夹具产物须是归档档措辞(否则 ②③ 两臂都在测 face),实测行:${ar.text.split('\n')[1].slice(0, 80)}`,
      )
      ok(
        healStopReasons(aSrc, ar.text, ar.changed, 0).length === 0,
        `② 归档档的 F1+F3 正当归并不得停手:${JSON.stringify(healStopReasons(aSrc, ar.text, ar.changed, 0))}`,
      )
      ok(
        verifyMerge(aSrc, ar.text, ar.changed).problems.length === 0,
        `② 报告档同一形态也不得报问题:${JSON.stringify(verifyMerge(aSrc, ar.text, ar.changed).problems)}`,
      )
      const stripped = ar.changed.map((c) => ({
        line: c.line,
        kind: c.kind,
        before: c.before,
        after: c.after,
      }))
      ok(
        healStopReasons(aSrc, ar.text, stripped, 0).some((x) => x.includes('逐字保留')),
        '③ 变异对照:少传归档值(回到修复前的形态)时自愈档必须拦下来 —— 字段是有牙的,不是恒真',
      )
      ok(
        verifyMerge(aSrc, ar.text, stripped).problems.some((x) => x.includes('逐字相等')),
        '③ 变异对照:报告档也必须因同一件事点名(两闸各处一份就会有一道静默)',
      )
      setArchivedIndex(prevArch)
    }
    /**
     * F6 块级收口:四条各钉一个方向。缺任何一条,这一型就会退化成
     * "要么删不掉,要么把唯一份删掉"—— 后者比前者贵得多(§1 禁止无声删除)。
     */
    const LP = (s) => s + '　'.repeat(Math.max(0, 46 - [...s].length))
    // 块首行必须带复选框:drifted 候选资格按"首行是登记行"判(bodyOfRow 非空,剔切分产物,
    // 见 findDupBlocks 头注①)——无复选框的块在该判据下结构性进不了 drifted,用例必须跟判据同形。
    const BLK = [
      LP('- [ ] 块行一:整块登记被并发 union 追加两遍时,行级判据看不见,因为每行只是又一个孪生行'),
      LP('- [ ] 块行二:第二行,长度必须过块级阈值;阈值以下(短行/2 行块)天然成对,纳入只剩噪声'),
      LP('- [ ] 块行三:第三行,三行合成 F6 的量纲 —— 块,而不是行'),
    ].join('\n')
    const dupDoc = `## 甲段\n${BLK}\n## 乙段\n${BLK}\n\n尾行不是 bullet,否则会把上一个 run 续成四行`
    const oneDoc = `## 甲段\n${BLK}\n\n尾行不是 bullet`
    const bd = buildBlockDedupe(dupDoc)
    ok(bd.deletedCount === 3, `两份逐字相同的块应删 3 行,实测 ${bd.deletedCount}`)
    ok(
      verifyBlockDedupe(dupDoc, bd.text, bd.deletedCount).length === 0,
      `块级零损失断言应全过:${JSON.stringify(verifyBlockDedupe(dupDoc, bd.text, bd.deletedCount))}`,
    )
    ok(
      audit(bd.text).counts.dupBlocks === 0,
      `收口后 F6 应为 0,实测 ${audit(bd.text).counts.dupBlocks}`,
    )
    ok(
      audit(dupDoc).counts.dupBlocks === 1 && audit(oneDoc).counts.dupBlocks === 0,
      '块级判据本身要能数出这一型',
    )
    ok(buildBlockDedupe(oneDoc).deletedCount === 0, '只有一份时一行都不许删(幂等 + 不误伤唯一副本)')
    // 漂移副本(首行同而正文不同)结构性不可自动折半:必须原样留着交人工
    const driftDoc = `## 甲段\n${BLK}\n## 乙段\n${[BLK.split('\n')[0], LP('- [ ] 块行二:被人工改过的第二行,与上面那份不再逐字相等'), BLK.split('\n')[2]].join('\n')}\n\n尾行不是 bullet`
    ok(audit(driftDoc).counts.dupBlocks === 0, '漂移不该算逐字重复(算了就等于允许机器折半)')
    ok(
      audit(driftDoc).counts.dupBlockDrifted === 1,
      `漂移应单独计 1,实测 ${audit(driftDoc).counts.dupBlockDrifted}`,
    )
    ok(buildBlockDedupe(driftDoc).deletedCount === 0, '漂移副本一份都不许自动删')
    // 反向对照:假装"幸存份也没了" —— 断言必须炸,否则它等于没有
    ok(
      verifyBlockDedupe(dupDoc, oneDoc, 3).length > 0,
      '删完却把唯一幸存份也一起删掉的输出必须判失败',
    )
    // ── F4:同一件事两条待办 ⇒ 只给副本加指针,**绝不允许翻勾**(两件事都没做完) ──
    const f4src = [
      '- [ ] **D92 同一件事**:较长的那条登记,承载了更多上下文说明。',
      '- [ ] **D92 同一件事**:短的那条。',
      '- [ ] **D90 无关任务**:不该被本票碰到。',
    ].join('\n')
    const f4 = buildMerge(f4src, '2026-09-26')
    ok(f4.changed.length === 1, `F4 应只改副本那一行,实测 ${f4.changed.length}`)
    ok(f4.changed[0].kind === 'F4', `F4 归并的行必须只挂 F4 判据,实测 ${f4.changed[0].kind}`)
    ok(!/^- \[x\]/m.test(f4.text.split('\n')[1]), 'F4 不得把没做完的事翻成已完成(与 F1 的处置相反)')
    ok(/【归并】重复登记副本/.test(f4.text), '必须写下索引层认得的副本指针字面')
    ok(verifyMerge(f4src, f4.text, f4.changed).after.dupOpenCopies === 0, 'F4 归并后必须归零')
    const f4again = buildMerge(f4.text, '2026-09-26')
    ok(
      f4again.changed.length === 0,
      `第二次跑不得再改同一行(幂等),实测又改 ${f4again.changed.length} 行`,
    )
    ok(
      healStopReasons(f4src, f4src, f4.changed, 0).join().includes('未归零'),
      'F4 未归零时自愈必须停手 —— 否则"跑过一次"会被当成"修好了"',
    )
    /**
     * 自动档(noPointer)三断言(2026-10-14 接线,用户指令「重复登记副本一条也不许再产生」):
     * ① buildMerge 自动档对同一 F4 夹具**一个字节都不动**(指针注记不再由自动路径产出);
     * ② 同一残留 F4 在 noPointer 口径下**不再**触发"归并后未归零"(设计内状态,自动档少修
     *    一维不是错误;非自动档口径仍停手 —— 上一条 ok 已钉);
     * ③ 棘轮(门 13d 同源):noPointer 口径下产物多出一行指针注记 ⇒ 停手 —— 这是旁路落地
     *    (commit-tree 不跑钩子)面前最后一道闸,红 = 有人把注记路径接了回来。
     */
    const f4auto = buildMerge(f4src, '2026-09-26', { noPointer: true })
    ok(f4auto.changed.length === 0, `自动档不得改写 F4 副本行,实测改了 ${f4auto.changed.length} 行`)
    ok(f4auto.text === f4src, '自动档产物必须与输入逐字相等(F4 维零动作)')
    ok(
      !healStopReasons(f4src, f4src, [], 0, null, { noPointer: true }).some((x) =>
        x.includes('未归零'),
      ),
      'noPointer 口径下残留 F4 不得触发"归并后未归零"(那一维刻意交人工)',
    )
    ok(
      healStopReasons(f4src, f4.text, [], 0, null, { noPointer: true }).some((x) =>
        x.includes('指针注记棘轮'),
      ),
      'noPointer 口径下产物新增指针注记必须被棘轮拦下(门 13d 同源,旁路落地的最后防线)',
    )
    /**
     * 隐形族诊断必须**成对**有牙:全族互指要点名(不点名等于没有这个出口),有终端代表不得点名
     * (乱点名会让读数变成"每一族都是债",那与没有读数一样不能用来派单)。
     * 夹具的两行都带指针 —— 就是 HEAD 面实测 19 族 / 101 行的形态本身。
     */
    const ptrDead = [
      '- [ ] **G-9. 甲事** 〔【归并】重复登记副本(2026-09-26):同主键的另一条登记,派单以那条为准,本行不再单独派单。〕',
      '- [ ] **G-9. 甲事** 〔【归并】重复登记副本(2026-09-26):同主键的另一条登记,派单以那条为准,本行不再单独派单。〕',
    ].join('\n')
    const tDead = auditPointerTerminals(ptrDead)
    ok(
      tDead.families === 1 && tDead.rows === 2,
      `全族互指必须被点名为无终端,实测 ${tDead.families} 族 / ${tDead.rows} 行 —— 若为 0,说明 compositeKeyOf 对这一形态给不出键且兜底键也没接住,本诊断对它失明`,
    )
    ok(
      tDead.hiddenFamilies === 1,
      `同编号也没有任何代表 ⇒ 必须算"真隐形",实测 hiddenFamilies=${tDead.hiddenFamilies}`,
    )
    const tAlive = auditPointerTerminals(
      [
        '- [ ] **G-9. 甲事**',
        '- [ ] **G-9. 甲事** 〔【归并】重复登记副本(2026-09-26):同主键的另一条登记〕',
      ].join('\n'),
    )
    ok(tAlive.families === 0, `族内有一行不带指针就不算无终端,实测报了 ${tAlive.families} 族(误伤)`)
    /**
     * 第三臂钉"不把撞号副产物报成债"。真仓形态:`D2` 挂着两种标题写法(短标题+指针 / 长正文版),
     * 按主键判前者"无终端",按编号判这件活由长正文那行代表、**没有隐形**。
     * 少了这一臂,读数就会把 F9 撞号的副产物写成"活账消失",派单人去修一件不存在的事。
     */
    const tSplit = auditPointerTerminals(
      [
        '- [ ] D2 甲题 〔【归并】重复登记副本(2026-09-26):同主键的另一条登记,派单以那条为准。〕',
        '- [ ] D2 甲题 〔【归并】重复登记副本(2026-09-26):同主键的另一条登记,派单以那条为准。〕',
        '- [ ] D2 甲题的长正文版(同编号、另一种标题写法,自己不带指针)',
      ].join('\n'),
    )
    ok(
      tSplit.families >= 1 && tSplit.hiddenFamilies === 0,
      `同编号另有代表时不得计为真隐形,实测 families=${tSplit.families} hiddenFamilies=${tSplit.hiddenFamilies}`,
    )
    ok(
      auditPointerTerminals('').families === 0 && auditPointerTerminals(null).families === 0,
      '空面不得凭空造出债',
    )
    /**
     * 恢复档成对断言(R1–R7)。这一族判据若只测"剥得掉",会漏掉它仅有的两个危险失败方向:
     * 多吃作者正文、以及把已被别人占用的编号领回来(原地造 F9 撞号)。
     * 另有一条 R5b/R8 是**接线锁**:护栏函数写在文件里而两处落地闸没调它,提交链上就等于没有。
     */
    const NOTE =
      ' 〔【归并】重复登记副本(2026-09-28):同主键的另一条登记,派单以那条为准,本行不再单独派单。〕'
    // 夹具必须用**真仓题面形态**(编号后带句点),因为守门 130 的 F9 比的正是未剥注记的 titleOf:
    // 写成无句点的 `G-501 甲题` 会让"恢复一行"给同一编号造出两个题面 ⇒ 本档的 F9 互咬预检正当拒落。
    // 第一版就那么写,那条红是夹具造的,不是仓库的债(真仓 38 族跑同一判据:因 F9 被拒的是 0 族)。
    const RST_LINE = '- [ ] G-501. 甲题:一件待做的事。'
    const rstSrc = [`${RST_LINE}${NOTE}`, `${RST_LINE}${NOTE}`].join('\n')
    const rst1 = buildRestoreTerminals(rstSrc, '2026-09-28')
    ok(
      rst1.edits.length === 1,
      `全指族必须恰好恢复一行代表(不是两行、不是零行),实测 ${rst1.edits.length}`,
    )
    ok(
      rst1.edits.length === 1 && rst1.edits[0].after === RST_LINE,
      `恢复后应逐字回到裸登记形态,实测 ${rst1.edits[0] ? JSON.stringify(rst1.edits[0].after) : '无 edits'}`,
    )
    const v1 = verifyRestoreTerminals(rstSrc, rst1.text, rst1.edits)
    ok(v1.problems.length === 0, `正当恢复不得报问题,实测 ${v1.problems[0] ?? '无'}`)
    ok(v1.hiddenAfter === 0, `恢复后该族不得再被判隐形,实测 ${v1.hiddenAfter}`)
    // R1 反向:恢复动作若顺手写了新字,"保序子序列"判据必须炸(只判"剥没剥掉"拦不住加字)
    const bad = rst1.edits.map((e) => ({ ...e, after: `${e.after}X` }))
    const badLines = rstSrc.split('\n')
    badLines[bad[0].line - 1] = bad[0].after
    ok(
      verifyRestoreTerminals(rstSrc, badLines.join('\n'), bad).problems.some((p) =>
        p.includes('子序列'),
      ),
      '恢复后的正文不是底稿子序列时必须拦下',
    )
    // R2:裸形态(无闭符)整族拒绝并点名 —— 按行尾剥会吃掉作者正文
    const bareLine =
      '- [ ] **[归并]** 【归并】重复登记副本:本行与同标题登记 L9 重复。本行不进派单口径,活账以主行为准。'
    const rst2 = buildRestoreTerminals([bareLine, bareLine].join('\n'), '2026-09-28')
    ok(
      rst2.edits.length === 0 &&
        rst2.refused.length === 1 &&
        rst2.refused[0].reason.includes('结构边界'),
      `裸形态必须拒绝并报名,实测 edits=${rst2.edits.length} refused=${rst2.refused.length}`,
    )
    // R3:同编号在别处挂着另一件事 ⇒ 恢复会原地造出 F9 撞号,必须拒
    const clashSrc = [
      `- [ ] G-502 丁题${NOTE}`,
      `- [ ] G-502 丁题${NOTE}`,
      `- [ ] G-502 卯题${NOTE}`,
    ].join('\n')
    const rst3 = buildRestoreTerminals(clashSrc, '2026-09-28')
    ok(
      rst3.edits.length === 0 &&
        rst3.refused.length >= 1 &&
        rst3.refused.some((f) => f.reason.includes('撞号')),
      `恢复会把别人正占着的编号领回来时必须拒,实测 edits=${rst3.edits.length} refused=${JSON.stringify(rst3.refused.map((f) => f.reason.slice(0, 18)))}`,
    )
    // R4:折叠孤立行(持有行已不在面上)必须由 stripTwinFold 还原,连尾注一起剥回底稿
    const pre4 = '- [ ] **G-503. 折叠题**:第一份登记。'
    const foldLine = buildTwinFold(pre4, '- [ ] **G-504. 别的题**:与它无关。', '2026-09-28')
    const rst4 = buildRestoreTerminals(foldLine, '2026-09-28')
    ok(
      rst4.edits.length === 1 &&
        rst4.edits[0].via === 'stripTwinFold' &&
        rst4.edits[0].after === pre4,
      `折叠产物必须逐字还原成底稿(尾注原编号一并剥掉),实测 ${JSON.stringify(rst4.edits[0] ?? rst4.refused[0])}`,
    )
    // R9:题面没有句点边界的族,恢复会让同一编号出现"带注记 / 不带注记"两个 titleOf ⇒
    // 守门 130 的 F9 差值棘轮会当场判红。本档不许为变绿去改那道门的判据(lib 持有人职权),
    // 也不许整批按住,所以**逐族**拒绝并写明解阻前置 —— 这条断言钉的就是"它真的拒"。
    // 注记必须**夹在正文中间**(后跟续段):行尾注记的恢复题面是原题面的精确前缀,
    // F9 的前缀套叠并桶(②,f9CollapsePrefixNested)会把它吃掉 ⇒ 结构上不再判红,
    // 那一形态现在"不拒"是正确行为;行中注记剥出非前缀题面才真正会多一组 —— 用例钉的是它。
    const f9Line = `- [ ] G-509 无句点题面${NOTE}续段正文`
    const rst9 = buildRestoreTerminals([f9Line, f9Line].join('\n'), '2026-09-28')
    ok(
      rst9.edits.length === 0 && rst9.refused.length === 1 && rst9.refused[0].reason.includes('F9'),
      `与 F9 互咬的那一型必须被拒并点名解阻前置,实测 edits=${rst9.edits.length} refused=${JSON.stringify(rst9.refused.map((f) => f.reason.slice(0, 12)))}`,
    )
    // R5:差值护栏必须点名"把一族唯一的代表也标上指针"的合并
    const gSrc = [`- [ ] G-505 戊题`, `- [ ] G-505 戊题${NOTE}`].join('\n')
    const gHide = [`- [ ] G-505 戊题${NOTE}`, `- [ ] G-505 戊题${NOTE}`].join('\n')
    ok(
      (pointerVisibilityRegression(gSrc, gHide) ?? '').includes('隐形族'),
      '抹掉唯一代表的合并必须被差值护栏点名',
    )
    // R6:留了代表的正常归并不得被点名(拦正当动作的闸与恒红门同罪)
    ok(
      pointerVisibilityRegression(gSrc, gSrc) === null &&
        pointerVisibilityRegression(gSrc, `${gSrc}\n- [ ] 新行`) === null,
      '没有把任何族弄隐形的改动不得被护栏拦',
    )
    // R7:一族里唯一的活行被正当翻勾 ⇒ 必须靠"已完成行也算代表"认下来,否则 --heal 每次翻勾都停手
    ok(
      pointerVisibilityRegression('- [ ] G-506 己题', '- [x] ✅(2026-09-28) G-506 己题') === null,
      '翻勾成已完成不得被读成"把活账弄隐形"',
    )
    // R5b/R8 接线锁(行为式,不读源码):两处落地闸必须真的调了这条护栏
    ok(
      healStopReasons(
        gSrc,
        gHide,
        [{ line: 1, kind: 'F4', before: '- [ ] G-505 戊题', after: `- [ ] G-505 戊题${NOTE}` }],
        0,
      )
        .join()
        .includes('隐形族'),
      '自愈停手判据必须挂上差值护栏 —— 函数在而无人调,提交链上等于没有',
    )
    ok(
      verifyMerge(gSrc, gHide, [
        { line: 1, kind: 'F4', before: '- [ ] G-505 戊题', after: `- [ ] G-505 戊题${NOTE}` },
      ]).problems.some((p) => p.includes('隐形族')),
      '零损失对账链也必须挂上差值护栏(与 healStopReasons 同一份实现)',
    )
    /**
     * F10 折叠档 —— 成对断言(单向断言等于没有):
     *  (a) 同题 + 编号互异 ⇒ 恰好折掉后到的一条,持有行一字不动;
     *  (b) 第二遍 ⇒ 零改动(幂等是本票的全部价值,不钉住就等于没做);
     *  (c) 同题而编号相同 ⇒ **不是**本档地盘(那是 F1/F4 那一维);
     *  (d) 已有归并指针的那一族 ⇒ 不重复折;
     *  (e) 摘号必须用**真尺子**核,并配一条"把 G-999 写进注记"的正对照 —— 少了正对照,
     *      `keyOfRow(after) === null` 就只是一句同义反复(今天真犯过这个错:指针里写了持有行的
     *      编号且落在前 48 字符内 ⇒ 折一条副本反而多造一次撞号)。
     */
    const twinSrc = [
      '- [ ] **G-11. 同一件事**:第一份登记。',
      '- [ ] **G-12. 同一件事**:并发取号抢到的另一个号,同一件事。',
      '- [ ] **G-13. 别的事**:与上面两行无关。',
    ].join('\n')
    const twLines = twinSrc.split('\n')
    const tw1 = applyTwinFolds(twinSrc, '2026-09-28')
    ok(tw1.edits.length === 1, `同题两号应恰好折 1 行,实测 ${tw1.edits.length}`)
    ok(
      tw1.edits[0]?.line === 2,
      `持有行必须是位置最靠前的 L1,折的是 L2,实测 ${JSON.stringify(tw1.edits.map((e) => e.line))}`,
    )
    ok(tw1.text.split('\n')[0] === twLines[0], '持有行必须逐字不动(一行都不许被顺手改)')
    ok(tw1.text.split('\n')[2] === twLines[2], '不相关行必须逐字不动')
    ok(
      !!tw1.edits[0] &&
        (keyOfRow(tw1.edits[0].after) === null ||
          keyOfRow(tw1.edits[0].after) === keyOfRow(twLines[1])) &&
        DUP_POINTER_RE.test(tw1.edits[0].after),
      `摘号未生效:折后主键实得 ${tw1.edits[0] && keyOfRow(tw1.edits[0].after)}(折前主键 ${keyOfRow(twLines[1])})、指针在场=${
        tw1.edits[0] ? DUP_POINTER_RE.test(tw1.edits[0].after) : false
      } —— 主键不得被换成别人的号,且必须被派单口径的指针族逐出`,
    )
    ok(
      !!tw1.edits[0] && stripTwinFold(tw1.edits[0].after) === twLines[1],
      '剥掉本档注记后必须逐字回到底稿',
    )
    ok(!!tw1.edits[0] && /^- \[ \]/.test(tw1.edits[0].after), '本档不得翻勾')
    ok(
      !!tw1.edits[0] && headIdOf(tw1.edits[0].after) === headIdOf(twLines[1]),
      `门 71 的"行首名额"必须原样保住,实得 ${headIdOf(tw1.edits[0] && tw1.edits[0].after)}`,
    )
    ok(
      !!tw1.edits[0] && lostMarkers(twinSrc, tw1.text).length === 0,
      `折叠不得被防丢层读成消失,实测 ${lostMarkers(twinSrc, tw1.text).length} 处`,
    )
    ok(
      verifyTwinFold(twinSrc, tw1.text, tw1.edits, tw1.refused).problems.length === 0,
      `正当折叠的零损失断言应全过:${JSON.stringify(verifyTwinFold(twinSrc, tw1.text, tw1.edits, tw1.refused).problems)}`,
    )
    const tw2 = applyTwinFolds(tw1.text, '2026-09-28')
    ok(
      tw2.edits.length === 0 && tw2.text === tw1.text,
      `幂等:第二遍必须零改动,实测 ${tw2.edits.length} 行`,
    )
    ok(
      healStopReasons(
        twinSrc,
        tw1.text,
        tw1.edits.map((e) => ({ ...e, kind: 'F10折叠' })),
        0,
      ).length === 0,
      `正当折叠不该被自愈档停手:${JSON.stringify(
        healStopReasons(
          twinSrc,
          tw1.text,
          tw1.edits.map((e) => ({ ...e, kind: 'F10折叠' })),
          0,
        ),
      )}`,
    )
    ok(
      healStopReasons(
        twinSrc,
        twinSrc,
        tw1.edits.map((e) => ({ ...e, kind: 'F10折叠' })),
        0,
      )
        .join()
        .includes('折叠维未闭合'),
      '一行都不折(孪生仍在)必须被闭合断言停手 —— 否则"跑过一次"又会被当成"修好了"',
    )
    ok(
      foldTwins(['- [ ] **G-11. 同一件事**:甲。', '- [ ] **G-11. 同一件事**:乙。']).edits.length ===
        0,
      '编号相同那一型归 F1/F4,本档不得插手(混维就会有两套翻勾判据互咬)',
    )
    const ptrOwned = [
      '- [ ] **G-11. 同一件事**:甲。',
      '- [ ] **G-12. 同一件事** 〔【归并】重复登记副本(2026-09-26):同主键的另一条登记,派单以那条为准。〕',
    ].join('\n')
    const twPtr = foldTwins(ptrOwned.split('\n'), '2026-09-28')
    ok(twPtr.edits.length === 0, `已带归并指针的一族不得再折,实测折了 ${twPtr.edits.length} 行`)
    /** 正对照:注记里出现 `G-<数字>` 且落在主键窗口内 ⇒ 尺子**必须**取得到键,否则上面的 null 断言是同义反复。 */
    const poisoned = twLines[1].replace(/^- \[ \] /, '- [ ] （【归并】副本·持有行 G-999）')
    ok(
      keyOfRow(poisoned) !== null,
      '正对照失效:把编号写进注记前 48 字符,真尺子竟取不到主键 ⇒ 这条断言没有牙',
    )
    /**
     * ⑦ 的两条成对用例(2026-09-29,由本会话一次真实自伤立):
     *  正向 —— 正常折叠(折副本、留持有行)必须**没有**"失去当前状态行"这一红;
     *  反向 —— 把产物里的持有行也换成指针行(正是枚 b3f73e2b37e 落出来的形状),第七断言必须点名。
     *  少了正向,这条锁会退化成"只要折叠就红";少了反向,它可以在什么都不防的状态下恒绿。
     */
    {
      const src = [
        '- [ ] **G-701. 一件活账**:甲。',
        '- [ ] **G-702. 一件活账**:乙。',
        '- [ ] **G-703. 一件活账**:丙。',
      ].join('\n')
      const tw = foldTwins(src.split('\n'), '2026-09-29')
      const landed = [...src.split('\n')]
      for (const e of tw.edits) landed[e.line - 1] = e.after
      const ok7 = verifyTwinFold(src, landed.join('\n'), tw.edits, tw.refused)
      ok(
        tw.edits.length === 2 && ok7.problems.length === 0,
        `正向对照红:折 2 留 1 的正常折叠被第七断言误判,实测 edits=${tw.edits.length} problems=${JSON.stringify(ok7.problems)}`,
      )
      const broken = landed.map((l) =>
        /^- \[ \]/.test(l)
          ? l.replace(
              /^- \[ \] /,
              '- [ ] （【归并】重复登记副本·同题不同编号·2026-09-29·摘号留指针）',
            )
          : l,
      )
      const bad7 = verifyTwinFold(src, broken.join('\n'), tw.edits, tw.refused)
      ok(
        bad7.problems.some((p) => p.includes('失去当前状态行')),
        `反向对照失效:全族折成指针时第七断言没喊红,实测 ${JSON.stringify(bad7.problems.slice(0, 2))}`,
      )
    }
    ok(
      (twinFoldRejectReason(twLines[1], poisoned) || '').includes('主键'),
      `编号写进注记必须被拒折判据点名,实得:${twinFoldRejectReason(twLines[1], poisoned)}`,
    )
    const numbered = twLines[1].replace(/^- \[ \] /, '- [ ] （【归并】副本·见 L1234）')
    ok(
      twinFoldRejectReason(twLines[1], numbered) !== null,
      '行号写进注记也要被点名拒折(§1 规矩 3;拒因是"取到主键"还是"不可逆"都算拦住,但不能放行)',
    )
    ok(
      buildTwinFold(
        '- [x] ✅(2026-09-20) **G-12. 同一件事**:乙。',
        twLines[0],
        '2026-09-28',
      ).includes('[x]'),
      '已完成行若被显式构造,复选框必须原样带过去(选持有行时本档不选它)',
    )
    ok(
      foldTwins(['- [ ] **G-1. 题**:甲。', '- [ ] **G-2. 题**:乙。']).undetermined.length === 0,
      '两行一族不构成"可疑超上限",不该记未判定',
    )
    ok(
      foldTwins(
        Array.from(
          { length: TWIN_GROUP_MAX + 1 },
          (_, i) => `- [ ] **G-${10 + i}. 超上限族**:同一件事第 ${i} 份。`,
        ),
      )
        .undetermined.join()
        .includes('上限'),
      '组内行数超上限必须点名交人工,不得猜持有行',
    )
    ok(
      foldTwins([
        '- [x] ✅(2026-09-20) **G-1. 全族已完成**:甲。',
        '- [x] ✅(2026-09-21) **G-2. 全族已完成**:乙。',
      ])
        .undetermined.join()
        .includes('已完成'),
      '全组已勾选 ⇒ 本档不动勾选,点名交 F1/归档器那一维(不得记为"已修")',
    )
    ok(foldTwins([]).edits.length === 0 && foldTwins(null).edits.length === 0, '空面不得凭空造出折叠')
    /**
     * 未勾单行等值副本档(G-741)。成对写:每条"该删的必须删得动"都配一条"不该碰的一份都不许动",
     * 再给四条零损失断言各配一条"故意做坏必须拒" —— 只判坏的会退化成永拒,只判好的等于没判。
     */
    const O_TWIN =
      '- [ ] **G-741 单行档自检夹具**:〔【归并】重复登记副本 2026-09-28·派单以另一条为准〕正文逐字相同,长度足够越过 40 字符噪声阈。'
    const O_NOPTR =
      '- [ ] **G-742 未带指针的等值孪生**:两份逐字相同,但本档不得碰 —— 那一族的出口是 --heal 加注记,一行不删才对。'
    const O_DRA =
      '- [ ] **G-743 同主键漂移**:第一段正文,长度足够越过噪声阈以便证明它不是被长度筛掉的而是被逐字不同筛掉的。'
    const O_DRB =
      '- [ ] **G-743 同主键漂移**:第二段正文,与甲同复合主键而正文不同 ⇒ 机器折半即有损,必须点名交人工才对。'
    const O_SHORT = '- [ ] G-744 短〔【归并】重复登记副本〕'
    const O_IND =
      '  - [ ] G-745 缩进未勾副本〔【归并】重复登记副本〕长度足够越过噪声阈,所以它不是被长度筛掉的而是被顶层判据筛掉的。'
    const oSrc = [
      '# 台账',
      '',
      O_TWIN,
      O_TWIN,
      O_TWIN,
      O_NOPTR,
      O_NOPTR,
      O_SHORT,
      O_SHORT,
      O_DRA,
      O_DRB,
      O_IND,
      O_IND,
      '',
    ].join('\n')
    const oT = findOpenRowTwins(oSrc)
    ok(
      oT.length === 1 && oT[0].copies === 3,
      `未勾档应只命中 1 组×3 份(带指针+顶层+≥40+逐字同),实得 ${JSON.stringify(oT.map((g) => g.copies))}`,
    )
    const oRef = findOpenRowRefusals(oSrc)
    ok(
      oRef.noPointer.length === 1,
      `未带指针的等值孪生必须被点名而不被删:实得 ${oRef.noPointer.length} 组`,
    )
    ok(oRef.drifted.length === 1, `同主键而正文已漂开必须被点名交人工:实得 ${oRef.drifted.length} 组`)
    const oR = buildOpenRowDedupe(oSrc)
    ok(oR.deletedCount === 2, `三份等值副本只删第 2..N 份 ⇒ 应删 2,实得 ${oR.deletedCount}`)
    ok(oR.text.split('\n').filter((l) => l === O_TWIN).length === 1, '必须留一份原件幸存')
    ok(oR.text.includes(O_NOPTR) && oR.text.includes(O_DRB), '刻意不删的两族必须逐字留在产物里')
    ok(
      verifyOpenRowDedupe(oSrc, oR.text, oR.deletedCount, null, oR.droppedLines).length === 0,
      '纯删除必须过全部零损失断言',
    )
    ok(buildOpenRowDedupe(oR.text).deletedCount === 0, '第二次必须报"无可归并"(幂等)')
    // 四条"故意做坏必须拒":漏保留行 / 多删一行 / 新增行 / 行数差不等
    const oLost = oR.text
      .split('\n')
      .filter((l) => l !== O_TWIN)
      .join('\n')
    ok(
      verifyOpenRowDedupe(oSrc, oLost, oR.deletedCount, null, oR.droppedLines).some((p) =>
        p.includes('一份都不剩'),
      ),
      '漏保留行必须被拒',
    )
    const oExtra = oR.text.replace(O_DRB + '\n', '')
    ok(
      verifyOpenRowDedupe(oSrc, oExtra, oR.deletedCount, null, new Set([4, 5])).some(
        (p) => p.includes('活数') || p.includes('逐行等值'),
      ),
      '多删一行(吃掉一条真待办)必须被拒',
    )
    ok(
      verifyOpenRowDedupe(
        oSrc,
        `${oR.text}\n- [ ] 凭空新增的一行待办(长度足够越过噪声阈以便证明不是被长度筛掉的)`,
        oR.deletedCount,
        null,
        oR.droppedLines,
      ).some((p) => p.includes('新增')),
      '产物含新增行必须被拒(只断"不删"会造出重复行而账面全绿)',
    )
    ok(
      verifyOpenRowDedupe(oSrc, oR.text, oR.deletedCount + 1, null, oR.droppedLines).some((p) =>
        p.includes('行数差'),
      ),
      '行数减少量必须等于声明删除量',
    )
    /**
     * 分块 + 轮次(2026-09-29 立)。这一族的全部风险是"为了跑得动而把判据放宽",所以断言成对:
     * 块必须**按组完整**取(切半会让第②条"幸存份在位"失去意义)、幂等只允许在"本轮认领的组"上换口径
     * (不降任何一条别的判据)、maxRows=null 必须与旧行为**逐字等值**(防止我为了分块偷偷改选取顺序)。
     */
    const C_A =
      '- [ ] **G-750 四份一组的夹具**:〔【归并】重复登记副本 2026-09-29·派单以另一条为准〕四份逐字相同,cost=3,长度越过噪声阈。'
    const C_B =
      '- [ ] **G-751 两份一组的夹具**:〔【归并】重复登记副本 2026-09-29·派单以另一条为准〕两份逐字相同,cost=1,长度同样越过噪声阈。'
    const cSrc = ['# 台账', '', C_A, C_A, C_A, C_A, C_B, C_B, ''].join('\n')
    const cGroups = findOpenRowTwins(cSrc)
    ok(
      cGroups.length === 2 && cGroups[0].copies === 4 && cGroups[1].copies === 2,
      `夹具必须恰好两组(4 份 + 2 份),实得 ${JSON.stringify(cGroups.map((g) => g.copies))}`,
    )
    // (a) 块不切组:maxRows=3 ⇒ 第一组整组(cost 3)进块,第二组(cost 1)装不进 ⇒ 整组保留
    const c3 = buildOpenRowDedupe(cSrc, null, 3)
    ok(c3.deletedCount === 3, `maxRows=3 应取满第一组的 3 行而一组不落第二组,实得 ${c3.deletedCount}`)
    ok(
      c3.selectedGroups.length === 1 && c3.selectedGroups[0].line === C_A,
      '块里只许有整组:第一组完整入块',
    )
    ok(
      c3.text.split('\n').filter((l) => l === C_A).length === 1,
      '第一组必须留首次出现那一份(幸存份在位)',
    )
    ok(
      c3.text.split('\n').filter((l) => l === C_B).length === 2,
      '第二组必须整份原样保留 —— 切半等于让"幸存份在位"失去意义',
    )
    ok(
      verifyOpenRowDedupe(cSrc, c3.text, c3.deletedCount, null, c3.droppedLines, c3.selectedLines)
        .length === 0,
      '分块后仍有未轮到的组 ⇒ 幂等不得误拒(这是 scopeLines 存在的唯一理由,不放宽其余七条)',
    )
    ok(
      verifyOpenRowDedupe(cSrc, c3.text, c3.deletedCount, null, c3.droppedLines, new Set([C_B])).some(
        (p) => p.includes('不闭合'),
      ),
      '反向对照:scopeLines 传错(不含已选组)⇒ 必红 —— 只有正向那条的"放宽"无从证明它是放宽了范围而不是关了判据',
    )
    // (b) 单组超上限 ⇒ 跳过它**但后面的组照样装填**,且超上限那组必须逐条报名(不得静默)
    const c2 = buildOpenRowDedupe(cSrc, null, 2)
    ok(
      c2.selectedGroups.length === 1 && c2.selectedGroups[0].line === C_B && c2.deletedCount === 1,
      `上限 2 时 cost=3 的首组整组跳过、cost=1 的次组必须仍被装上(旧"前缀停手"口径会把这 1 行也判成无路可走),` +
        `实得 选中 ${c2.selectedGroups.length} 组 / ${c2.deletedCount} 行`,
    )
    ok(
      c2.plan.oversized.length === 1 &&
        c2.plan.oversized[0].copies === 4 &&
        c2.plan.oversized[0].cost === 3,
      '超上限的组必须报名到"几份/几行",而不是从账面上消失',
    )
    ok(c2.plan.remainingRows === 3, `跳过的那组留 3 行无路可装,实得 ${c2.plan.remainingRows}`)
    ok(
      c2.text.split('\n').filter((l) => l === C_A).length === 4,
      '被跳过的组一份都不许动(它是"换出口"的对象,不是本轮的对象)',
    )
    // (c) 投影轮数与 build 同源:同一面、同一上限,块数与行数必须互洽
    const cProj = planOpenRowChunks(cGroups, 3)
    ok(
      cProj.chunks.length === 2 && cProj.chunks.map((x) => x.rows).join(',') === '3,1',
      `投影应给 2 块(3 行 + 1 行),实得 ${JSON.stringify(cProj.chunks.map((x) => x.rows))}`,
    )
    ok(cProj.totalRows === 4 && cProj.remainingRows === 0, '全组都能进块时 remainingRows 必须为 0')
    ok(
      planOpenRowChunks(cGroups, null).chunks.length === 1,
      'maxRows=null ⇒ 一整块装全部(与分块前逐字同义)',
    )
    // (d) null 与旧行为逐字等值 + 确定性:同一输入两跑产物必须字节全等
    ok(
      buildOpenRowDedupe(oSrc, null, null).text === oR.text,
      'maxRows=null 的产物必须与不带该参数逐字等值',
    )
    ok(
      buildOpenRowDedupe(oSrc, null, 9999).text === oR.text,
      '上限大到一个块装得下全部 ⇒ 产物必须与不分块逐字等值',
    )
    ok(
      buildOpenRowDedupe(cSrc, null, 3).text === c3.text,
      '同一输入重复跑必须给出同一块(选取顺序不许带随机性,否则落地与报告对不上)',
    )
    ok(
      planOpenRowChunks([], 5).chunks.length === 0 && planOpenRowChunks([], 5).oversized.length === 0,
      '空组集必须给出"0 块 + 无堵塞",不得凭空造块(空扫判绿是本仓最高频失效型)',
    )
    // (e) 整数取值判据成对:合法值必放行、四类非法值必拒且带回实得
    ok(parsePositiveInt('25').ok === true && parsePositiveInt('25').value === 25, '合法整数必须放行')
    ok(parsePositiveInt('0').ok === false, '0 不构成一块/一轮(它必须由 empty 报出,不能由旗标伪装)')
    ok(parsePositiveInt('-5').ok === false, '负数必须拒')
    ok(
      parsePositiveInt('25.9').ok === false,
      '小数不是整数块大小 —— parseInt 会把它读成 25,那叫静默改语义',
    )
    ok(parsePositiveInt('1e3').ok === false, '科学计数法不是块大小(Number 会读成 1000)')
    ok(
      parsePositiveInt('abc').ok === false && parsePositiveInt(null).ok === false,
      '非数字与缺值必须拒',
    )
    // (f) 旗标成套性:白名单、值旗标表、inspectArgs 三处必须同时认识 --max-rows/--rounds
    for (const f of ['--max-rows', '--rounds', '--help']) {
      ok(KNOWN_FLAGS.includes(f), `${f} 未进 KNOWN_FLAGS ⇒ inspectArgs 会把整条命令拒掉`)
    }
    for (const f of ['--max-rows', '--rounds']) {
      ok(
        VALUE_FLAGS.includes(f),
        `${f} 未进 VALUE_FLAGS ⇒ 它的值会被当未知位置参数拒掉(白名单认识、值不认识=自相矛盾)`,
      )
    }
    ok(
      inspectArgs(['--dedupe-open-rows', '--max-rows', '25', '--rounds', '60', '--commit']).unknown
        .length === 0,
      '分块档的完整命令行必须被 inspectArgs 放行',
    )
    ok(
      inspectArgs(['--dedupe-open-rows', '--max-rows']).unknown.length === 0,
      '裸 --max-rows 缺值是 flagValue 的地面,不是 inspectArgs 的 —— 本判据不得顺手把它当未知参数',
    )
    ok(
      inspectArgs(['--dedupe-open-rows', '25']).unknown.includes('25'),
      '没有被值旗标领着的裸位置参数必须拒(它多半是漏写旗标的 25)',
    )
    /**
     * 带值旗标的取值判据(枚 380431ffc 同族口径)。成对,单向断言等于没有:
     * 只判"坏的必被拒"会让它退化成"永远拒",而 (b) 那一臂证明合法路径照写。
     */
    ok(
      flagValue(['--write-to', '--staged'], '--write-to').valid === false,
      '紧跟的 - 旗标不得被当成本旗标的值',
    )
    ok(flagValue(['--write-to'], '--write-to').valid === false, '其后没有参数不得被当成有值')
    ok(flagValue(['--write-to', ''], '--write-to').valid === false, '空串不是路径')
    ok(
      flagValue(['--write-to', 'out/cand.md'], '--write-to').value === 'out/cand.md',
      '合法路径必须放行(否则本校验变成永拒)',
    )
    ok(flagValue(['--all'], '--write-to').present === false, '旗标缺席时不得判成"值为空"')
    // ── G-814403 ②:--match-prefix-holder 出口(planPrefixNestedPointer)三条反向对照 ──
    const pSrc = [
      '- [ ] **G-701. 前缀套叠登记**:完整的那一份,包含全部细节与最新证据。',
      '- [ ] **G-701. 前缀套叠登记**:完整的那一份',
      '- [ ] **G-702. 别的事**:无关行。',
    ].join('\n')
    // ① 前缀关系不成立时不得计入:G-702 无关行永不进 targets;片段按"L1 独有正文"唯一定位
    //   (同主键两行共享题面,拿题面当片段会多命中被拒 —— 这本身就是②要钉的形状)
    const pr1 = planPrefixNestedPointer(pSrc, '包含全部细节与最新证据')
    ok(
      pr1.ok && pr1.holderLine === 1 && pr1.pointered.length === 1 && pr1.pointered[0].line === 2,
      `前缀族应恰指 L2(精确前缀),实测 ${JSON.stringify(pr1)}`,
    )
    // ② holder 不在被审面 ⇒ 大声失败,不得静默退化成"这一族没配上"
    const pr2 = planPrefixNestedPointer(pSrc, 'G-999 不存在的片段')
    ok(
      !pr2.ok && pr2.reason.includes('0 命中'),
      `holder 0 命中必须大声失败,实测 ${JSON.stringify(pr2)}`,
    )
    // ③ 成对:加一行新前缀副本 ⇒ 报数上升(三层 754⊂1372⊂1767 按库定义产 3 对,逐层各一);
    //   指定持有行加指针 ⇒ 该族清零(指针打破 startsWith)
    const pBefore = findPrefixNestedCopies(pSrc).pairs.length
    const pGrown = `${pSrc}\n- [ ] **G-701. 前缀套叠登记**:完整的那`
    const pAfter0 = findPrefixNestedCopies(pGrown).pairs.length
    ok(
      pBefore === 1 && pAfter0 === 3,
      `前缀套叠按逐层各一对计:一层 1 对 ⇒ 三层 3 对,实测 ${pBefore}→${pAfter0}`,
    )
    const pr3 = planPrefixNestedPointer(pGrown, '包含全部细节与最新证据')
    const pGrownLines = pGrown.split('\n')
    const pLines = pGrownLines.map((l, i) => {
      const t0 = pr3.ok && pr3.pointered.find((p) => p.line === i + 1)
      return t0 ? rewriteDup(l, t0.key, '2026-10-07') : l
    })
    ok(
      pr3.ok && pr3.pointered.length === 2,
      `三层套叠应恰报 2 份副本待指,实测 ${JSON.stringify(pr3)}`,
    )
    ok(
      findPrefixNestedCopies(pLines.join('\n')).pairs.length === 0,
      `副本加指针后该族必须清零,实测仍报 ${findPrefixNestedCopies(pLines.join('\n')).pairs.length} 对`,
    )
    ok(
      pLines[0] === pGrownLines[0] &&
        DUP_POINTER_RE.test(pLines[1]) &&
        DUP_POINTER_RE.test(pLines[3]),
      '持有行逐字不动、两份被指副本各带派单口径指针(L3 无关行不得被误加)',
    )
    /**
     * ── G-218 票一③:熔断必须是**纯函数 + 构造面**(真仓的提交数是瞬时状态,拿它当断言就是假账)──
     * 三态各一对:未达阈值⇒不熔断 / 达阈值⇒熔断 / 人工提交的触碰⇒不计票;阈值一律走参数,不写死常量。
     * (判定本体住在门 71 `loopBreakerDecision`,这里只钉"它必须有牙"。)
     */
    const autoSub = 'docs(plan): 自动回捞 1 条被并发旧基线提交抹掉的登记行'
    ok(loopBreakerDecision([], 3).tripped === false, '熔断:没有触碰记录不得判熔断')
    ok(
      loopBreakerDecision([{ sha: 'a', subject: autoSub }], 1).tripped === true,
      '熔断:达阈值必须判熔断(阈值走参数而不是常量,否则这一条测的是写死的那个数)',
    )
    ok(
      loopBreakerDecision(
        [
          { sha: 'a', subject: autoSub },
          { sha: 'b', subject: 'fix(plan): 自愈被回写的任务状态副本(守门 130 的 post-commit 层)' },
        ],
        3,
      ).touches === 2,
      '熔断:两个自动层各算一票(它们就是互咬的那两侧)',
    )
    ok(
      loopBreakerDecision(
        Array.from({ length: 5 }, (_, i) => ({ sha: `s${i}`, subject: 'docs(plan): 人工登记一行注记' })),
        3,
      ).touches === 0,
      '熔断:人工提交的触碰不得计票(否则一次大清理就把自动档永久冻结)',
    )
    ok(
      loopBreakerDecision([{ sha: 'a', subject: autoSub }, null, { subject: undefined }], 3).touches === 1,
      '熔断:清单里混进空项不得炸,也不得多计',
    )
    /**
     * 构造面(skipMarkers → blocked):熔断的落点是**本文件这一侧**的 `buildMerge` —— 命中 marker
     * 的行进 blocked、原文一字不动;未命中的行照常归并(熔断是"只少做这些行",不是整轮停摆)。
     * 夹具行刻意写到 40 字符以上并用**裸编号**:`markerOf` 对短行(<40)与 `**加粗编号**` 都返回
     * null ⇒ 拿短行/加粗行测出来的绿是假绿(熔断对它们结构性失明,这一条同时钉住取样口径)。
     */
    const loopDone = '- [x] ✅(2026-09-20) D94 熔断夹具:已完成的那条,题面写得足够长以越过登记行四十字符的长度下限。'
    const loopOpen = '- [ ] D94 熔断夹具:归因未定,同一主键被两个自动层反复顶来顶去的那一行,题面同样写得很长。'
    const loopSrc = ['# 计划', loopDone, loopOpen, '- [ ] D98 真待办:谁都没做过,不得被动。'].join('\n')
    const loopMk = markerOf(loopOpen)
    ok(!!loopMk, '熔断夹具行必须算得出 marker(否则下一条断言是在空集合上空跑)')
    const loopPlain = buildMerge(loopSrc, '2026-09-26')
    ok(loopPlain.changed.length === 1 && loopPlain.blocked.length === 0, '未给 skipMarkers 时行为必须与旧版逐字一致')
    const loopB = buildMerge(loopSrc, '2026-09-26', { skipMarkers: new Set([loopMk]) })
    ok(
      loopB.changed.length === 0 && loopB.blocked.length === 1,
      `命中熔断的行必须从 changed 剔除并进 blocked,实测 changed=${loopB.changed.length} blocked=${JSON.stringify(loopB.blocked)}`,
    )
    ok(
      !!loopB.blocked[0]?.reason.includes('熔断') && loopB.blocked[0].reason.includes(loopMk),
      `blocked 理由必须点名熔断与该 marker,实测 ${loopB.blocked[0]?.reason}`,
    )
    ok(loopB.text === loopSrc, '熔断命中的产物必须逐字等于原文(本轮对这一行一个字节都不动)')
    ok(
      loopB.refused.length === 0,
      `熔断行不得转记成 refused(拒写会让整轮停手、退出码 1 ⇒ 把刹车做成恒红门),实测 ${JSON.stringify(loopB.refused)}`,
    )
    const loopOther = buildMerge(loopSrc, '2026-09-26', { skipMarkers: ['D0 不存在的编号'] })
    ok(
      loopOther.changed.length === 1 && loopOther.blocked.length === 0,
      '未命中的 marker 不得误伤(熔断是选择性的;数组形态同样受支持)',
    )
    console.log(`\n自检:${pass} 通过 / ${fail} 失败`)
    return fail ? 1 : 0
  }
  return selfTestInner()
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
