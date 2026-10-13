// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 自检用例登记的**唯一共用出口**。
 *
 * 为什么要有这一格(G-1038420 第一阶段的根因,不是"把潜伏清零"):
 *   本仓 200+ 道守门各带 `--self-test`,而"登记一条用例"这件事**每道门各抄一份**。
 *   抄得最多的那一族恰好是坏的那一族(不求值的 `{name, ok}` 裸存 vs 会求值的 `{name, fn}`),
 *   于是"潜伏洞"不是 41 个独立缺陷,而是**一个结构问题的 41 个投影**。
 *   守门 156 已把出路写死:修复出口 = 改登记侧求值(体内调用该形参,或 thunk 族),
 *   **不是**把用例改成布尔去过门。本模块就是那条"改登记侧"的标准答案。
 *
 * 为什么是 thunk 族(`{name, fn}` + 消费循环 `c.fn()`)而不是 `cond === true`:
 *   `cond === true` 那一档要求调用方**先算好**再传,所以它"传函数必翻红"—— 安全但死板,
 *   而且 `scripts/tests/plan-collide-renumber.test.mjs` 已用 `assert.match(src, /cond === true/)`
 *   把那一格逐字钉死在 `plan-collide-renumber-selftest.mjs` 上,改它必红。
 *   thunk 族允许用例随手写 `() => 断言`(这才是人写断言的天然形态),把求值点**收进出口**,
 *   消费循环成为全文唯一的求值位置 —— 登记侧再也不可能"忘了调用"。
 *
 * 自诊断字段 `got` 的由来(照抄 `plan-collide-renumber-selftest.mjs` 那套,一字不改):
 *   `got: 'function(从未求值)'` 是"断言从未被判过"的那一支体温计。
 *   在 thunk 族里它换了触发点但没换含义 —— 消费点拿到手的**仍然是个函数**,
 *   就说明这条用例返回的不是一个结论而是又一个待执行的 thunk,断言依然没跑过。
 *
 * ⚠️ 本文件住在 `scripts/lib/**`,而守门 156 的射程是仓库根一级 `scripts/*.mjs`
 *   (`check-selftest-registrant-evaluates.mjs` 的 `SCOPE_RE`),**出口本身不在它自己的面上**。
 *   这是对的:判据的"宿主内自造登记器"判据(R-EXIST)要的正是"出口之外的每处自造都被点名",
 *   出口自己被自己的门扫到只会在文件里读出自己的函数名、制造无意义的自咬。
 *   出口的合规性由**消费方**的判据证明(样板门 `check-baseline-freshness.mjs` 的实测读数)。
 *
 * 用法(两种登记形态都收,登记侧判据一律是"求值后的结论"而非布尔字面量):
 *   const { t, report } = makeRegistrar()
 *   t('①落后 1 枚 ⇒ exit 1', () => B(1).code === 1)   // thunk:登记的是待判的断言
 *   t('②清单为空 ⇒ 0', list.length === 0)              // 值:即算即得的结论
 *   t('③报出实得面', v.state === 'drift', JSON.stringify(v.drift)) // 第三参=失败时的诊断,可省
 *   const r = report()            // { pass, fail, cases:[{name, pass, got}] }
 *   return r.fail ? 1 : 0
 *
 * 判据三态(任一为假/取不到 ⇒ self-test 真失败,绝不记绿):
 *   真判据:结论 === true ⇒ pass。
 *   假判据:结论 === false ⇒ fail 并记 got(打印出来就是"这条为什么红")。
 *   取不到:用例没给结论(undefined)/ 返回的仍是函数(又一个待执行 thunk)/ 抛错
 *          ⇒ 一律 fail,got 如实记 `undefined` / 'function(从未求值)' / `抛错:…`
 *          —— "取不到"归失败不归通过,这是本出口不成为反假绿帮凶的最后一道锁。
 *
 * 求值时机的坑(消费方必须知道):thunk 形态**只存,不求值** —— 求值点在 `report()` 的
 * 消费循环里。所以 `report()` 必须在它依赖的夹具还在世时调用。先 `cleanup()` 再 `report()`
 * 拿到的是空目录上的读数,而账面记的是绿。
 */

/** 消费点拿到手的东西仍然是个函数 ⇒ 断言从未被判过(沿用既有自诊断字面量)。 */
const NEVER_EVALUATED = 'function(从未求值)'

/**
 * 造一个用例登记器。
 * @returns {{
 *   t: (name: string, verdict: (Function | unknown), detail?: string) => void,
 *   report: () => { pass: number, fail: number, cases: Array<{name: string, pass: boolean, got: string}> }
 * }}
 */
export function makeRegistrar() {
  const cases = []
  /**
   * 登记一条用例。**thunk 只存不求值**(求值点在 `report()` 的消费循环里);
   * 传值(布尔表达式)则是即算即得的结论,登记时已在调用侧求过值 —— 两种形态下
   * 登记侧判据都是"求值后的结论",函数对象永远到不了结论位(`!!fn` 恒真的老洞被结构封死)。
   * 第三参 `detail` 是失败时的诊断文本(如实进 `got`),成功时不用。
   */
  const t = (name, verdict, detail) => cases.push({ name, verdict, detail })
  /** 消费全部用例并结账。thunk 的求值只发生在这里,登记侧结构上无法"忘了调用"。 */
  const report = () => {
    let pass = 0
    let fail = 0
    const rows = []
    for (const c of cases) {
      let value
      try {
        value = typeof c.verdict === 'function' ? c.verdict() : c.verdict
      } catch (e) {
        // 一条用例抛错不许带走其余用例:逐条兜住并记成失败,否则自检本身会变成恒红门。
        fail += 1
        rows.push({ name: c.name, pass: false, got: `抛错:${e?.message ?? e}` })
        continue
      }
      if (value === true) pass += 1
      else fail += 1
      rows.push({
        name: c.name,
        pass: value === true,
        got:
          typeof value === 'function'
            ? NEVER_EVALUATED
            : c.detail !== undefined && c.detail !== null && c.detail !== ''
              ? String(c.detail)
              : String(value),
      })
    }
    return { pass, fail, cases: rows }
  }
  return { t, report }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
