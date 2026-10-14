// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 并发整索引提交下的**载荷归因**唯一出口(G-920,2026-10-15 立)。
 *
 * 为什么住 lib 而不是留在 `safe-commit.mjs` 里:本仓的规矩是"算同一件事的判据只许一份"(§0.6/§22c),
 * 而 `safe-commit.mjs` 是直线执行脚本(无 §22d `isDirectRun` 守卫)⇒ 测试 import 它就会**真的跑一次提交流程**。
 * 所以判据住这里,工具引这一份,镜像测试也引这一份(§22c:测试不得自己再算一遍)。
 *
 * 要根治的失效形态(2026-10-14 晚两起实测,均已留痕):Step 4 刻意不带 pathspec(pathspec 提交在钩子
 * 持锁期间与 lint-staged 自碰撞,理由仍成立),而 Step 3 到 Step 4 之间隔着整段钩子运行期(本机实测
 * ≈15 分钟),期间任何会话往共享索引放东西都会被本枚一起交出去。两起方向相反:
 *  ① 本会话那枚带出他人两枚在飞新件 —— 旧实现把它读成"并发场景下未能定位本次提交"(因为"文件集全在
 *    预期内"这一条对它不成立),然后建议 `git reset HEAD~1`;而当时 HEAD~1 已不是自己那枚,照做就会
 *    把**他人的提交**从分支尖端退掉。错报 + 危险建议,是同一条判据缺"内容级"这一维造成的。
 *  ② 反向:本会话三件已 staged 的收尾件被他人那枚 `fix(autostart)` 整索引带走 —— 内容与工作树都无损,
 *    只有"提交信息 == 载荷"这条对应关系断了,而当时没有任何一处会喊。
 *
 * 因此这里把"事后回看"分成四种可分辨的形态,并把建议与形态绑死:
 *  - `clean`              载荷恰好是声明集 ⇒ 正常。
 *  - `polluted-ours`      载荷**包含**声明集且额外带了别人 staged 的路径 ⇒ 这枚确实是我们那枚,
 *                         只是被灌了内容。处置只有记账与前向修正,**禁止**建议 reset(其上可能已叠他人提交)。
 *  - `carried-by-other`   区间内没有一枚以我们的声明集为载荷,但有一枚**含**这些路径 ⇒ 被他人整索引提交
 *                         带走了(②型)。点名那枚 sha + 标题,让"没落地"与"落地在他人标题下"可分辨。
 *  - `unlocated`          两者都不是 ⇒ 才是真的"未能定位本次提交"。
 * 判定只依据注入的 `filesOf(sha)`(纯函数入参),不在本模块读 git —— 便于独立仓夹具做正反对照。
 */

const NORM = (p) => String(p ?? '').replace(/^\.\//, '').replace(/\\/g, '/').trim()

/**
 * @param {string[]} newShas  本次提交窗口内新增的 sha(不含 beforeSha)
 * @param {(sha:string)=>string[]} filesOf  取某枚提交的文件清单(调用方注入,已归一化与否均可)
 * @param {Iterable<string>} expected       本票声明的路径集
 * @param {(sha:string)=>string} [subjectOf] 取某枚提交的标题(内容级不足以分辨①/②时用它)
 * @param {string} [ourSubject]             本次运行要落地的标题(= 提交信息的第一行)
 */
export function classifyConcurrentCommits({ newShas, filesOf, expected, subjectOf, ourSubject }) {
  const expectedNorm = new Set([...(expected ?? [])].map(NORM).filter(Boolean))
  const list = Array.isArray(newShas) ? newShas.filter(Boolean) : []
  if (list.length === 0) return { kind: 'unlocated', reason: '区间内零枚新提交' }
  const subject = (sha) => (typeof subjectOf === 'function' ? NORM(subjectOf(sha)) : '')
  const payloadOf = (sha) => [...new Set((filesOf(sha) ?? []).map(NORM).filter(Boolean))]

  // 身份优先:有一枚的标题就是本次运行的标题 ⇒ 它是我们那枚,内容级只决定它是不是被灌了。
  // 为什么标题能当身份:①型(自己那枚被灌)与②型(声明件被别家整索引提交带走)在**纯内容**上同形
  // —— 都是"某枚含我们的路径 + 别的东西"。只有"是谁写的这句话"能分开它们,而②型恰恰是那句话不见了。
  const oursBySubject = ourSubject ? list.find((sha) => subject(sha) === NORM(ourSubject)) : null
  if (oursBySubject) {
    const files = payloadOf(oursBySubject)
    const extraFiles = files.filter((f) => !expectedNorm.has(f))
    return extraFiles.length
      ? { kind: 'polluted-ours', sha: oursBySubject, extraFiles, checked: list.length }
      : { kind: 'clean', sha: oursBySubject, extraFiles: [], checked: list.length }
  }
  const payloads = list.map((sha) => ({ sha, files: payloadOf(sha) }))
  const covered = payloads.filter((p) => p.files.length > 0 && p.files.every((f) => expectedNorm.has(f)))
  if (covered.length === 1 && covered[0].files.length === expectedNorm.size)
    return { kind: 'clean', sha: covered[0].sha, extraFiles: [], checked: list.length }
  const superset = payloads.find(
    (p) => p.files.length > 0 && [...expectedNorm].every((f) => p.files.includes(f)),
  )
  if (superset) {
    // 带来了我们的路径却没有我们的标题:知道本次标题 ⇒ 判②型(被别人带走);
    // 拿不到标题 ⇒ 只能保守判①型(宁可多喊一次,不静默)。
    if (ourSubject)
      return {
        kind: 'carried-by-other',
        carriers: [
          {
            sha: superset.sha,
            subject: subject(superset.sha),
            carried: [...expectedNorm].filter((f) => superset.files.includes(f)),
          },
        ],
        checked: list.length,
      }
    return {
      kind: 'polluted-ours',
      sha: superset.sha,
      extraFiles: superset.files.filter((f) => !expectedNorm.has(f)),
      checked: list.length,
    }
  }
  // ②型:我们声明的路径出现在**别家的**载荷里(他人整索引提交带走了)
  const carriers = payloads.filter((p) => p.files.some((f) => expectedNorm.has(f)))
  if (carriers.length > 0) {
    return {
      kind: 'carried-by-other',
      carriers: carriers.map((p) => ({
        sha: p.sha,
        subject: typeof subjectOf === 'function' ? String(subjectOf(p.sha) ?? '') : '',
        carried: p.files.filter((f) => expectedNorm.has(f)),
      })),
      checked: list.length,
    }
  }
  return { kind: 'unlocated', reason: '区间内没有任何一枚以本票声明集为载荷', checked: list.length }
}

/**
 * 形态 → 处置建议。建议与形态**绑死**,因为读错建议的代价是把他人提交退掉(§22:任何 rewind 前先验
 * 尖端身份)。这里唯一允许出现"回退"字样的场景,是明确说明"不得直接 reset HEAD~1"。
 */
export function adviceFor(kind) {
  if (kind === 'clean') return { lines: [], exit: 0 }
  if (kind === 'polluted-ours')
    return {
      lines: [
        '处置:只做记账与前向修正 —— **不要** `git reset HEAD~1` 重提。',
        '理由:并发会话随时可能把分支尖端推走,HEAD~1 是相对位置不是身份;要弃某枚必须先按 §22 钉 `lost-commit/*` tag 并当场验尖端 sha。',
      ],
      exit: 1,
    }
  if (kind === 'carried-by-other')
    return {
      lines: [
        '处置:确认内容已在 HEAD(无损)后,把"提交信息 ≠ 载荷"记进台账,并复核归属会话是否仍需一枚自己的提交。',
        '理由:这一型不会喊"失败" —— 内容与工作树都完好,断掉的只是"提交信息=载荷"的对应关系,所以必须点名carrier。',
      ],
      exit: 1,
    }
  return {
    lines: ['处置:人工核对索引与工作树后重跑本工具(先 `git show --stat HEAD` 看清是谁那一枚,再决定前向修正)。'],
    exit: 1,
  }
}

export const __test__ = { classifyConcurrentCommits, adviceFor, NORM }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
