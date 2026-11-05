// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 产品形态 → 能力布尔 的**声明式单源**(goal-b49 Y3,2026-11-05 立)。
 *
 * ## 为什么有这一格(取证)
 *
 * 对侧两行取证指向同一格,都判为真缺口:
 * - Trae 席 `docs/benchmark-evidence/2026-11/qoder-trae-workbuddy-rea-20261105/T1-impl.md`
 *   §4 缺口表第 4 行:「**声明式能力开关单源**」—— 对侧把导入期过滤 / 版本跃迁门 / 定价 /
 *   desktopPet 收在一张产品声明表里;本仓当时**无**「产品形态 → 能力」这一维。
 * - Qoder 席 `docs/benchmark-evidence/2026-11/qoder-trae-rea-20261101/T12-mtree-and-hook-host.md`
 *   §5 缺口对撞表第 7 行:「**内嵌 per-product 能力表**」(`products.qoder` vs `products.qoder-cn`,
 *   键含 configDirectory / searchWorkspace / turnRelay / remoteCodeIndexing / indexSettings /
 *   workspaceIndexOrganizationPolicy)—— 对侧**命中即静默降级**。
 *
 * 本仓按**行为**复现,不抄对方任何源码/键名(AGENTS §0.11 红线:不粘专有源码、不破许可、
 * 不绕付费、不取凭据):形态轴取本仓自己的端形态,能力键取本仓 agent 内核真有的执行面,
 * 判定是**纯函数**(形态 + 能力 ⇒ 三态 + 理由),缺键**显式出声**而不是静默降级。
 *
 * ## 形态轴的出处(本仓自有词汇,不是抄对侧)
 *
 * - `packages/types/src/agent-control.ts` 的端形态词表:`'extension' | 'desktop' | 'web' | 'rn' | 'miniapp'`
 *   (`executedBy` / `endpoint` 两处);本表取其中**与共享屏/agent 内核同源的四个自研端形态**
 *   (`web` / `miniapp` / `rn`) 加上 agent 内核端 `cli`。
 * - `packages/types/src/download.ts` 的 `DownloadPlatform` 把 `'cli'` 列为本仓 8 端之一。
 * - `cli` 这一形态与 `apps/cli/src/hooks/index.ts` 的 `HOOK_HOST_PRODUCT_ID = 'ihui-cli'`
 *   是同一件事(本仓 CLI 的产品身份),缺省形态即它。
 *
 * ## 能力键的出处(每个键都有真消费方,§0.9:无宿主语义的档位一律不补)
 *
 * - `localWorkspace` —— 本机工作区面:读写本机文件 / 执行本机命令 / 跑本机 git / 终端 /
 *   语言服务器。消费方 = CLI 工具注册处(`apps/cli/src/tools/index.ts` 的 `registerTools`)。
 * - `localHooks` —— 本机钩子派发面:拉起本机子进程执行钩子脚本。
 *   消费方 = 钩子派发唯一收口(`apps/cli/src/hooks/index.ts` 的 `dispatchHookEntry`)。
 * - `browserRuntime` —— 浏览器自动化面:驱动真实浏览器(CDP 浏览器族)。
 *   消费方 = 同上工具注册处(`browser_*` 工具族)。
 *
 * ## 三态与失效方向(§0.3 / §0.10)
 *
 * 判定三态:`enabled`(该形态开这一面)/ `disabled`(该形态关这一面) /
 * `unjudged`(**没判**:形态未登记 / 能力未登记 / 该形态这一格未登记)。
 * - 「没判」绝不写成「判过」:表里某格**缺席**就是未登记,不是 false。
 * - 缺键方向恒为「**多要一次定向说明**」:消费点必须点名「哪个形态 · 哪个能力」并出声,
 *   绝不静默放行,也绝不静默拒绝(静默拒绝 = 看起来像"这形态没这能力",那是假的)。
 * - 对侧的差别正在这里:对侧缺键按 false 静默降级 ⇒ 我方缺键判 `unjudged` 并出声(超越轴)。
 *
 * ## 边界(不得越界,§0.6:同类判据全仓只许一份)
 *
 * - 本表**不是** `capability-catalog.ts`(对外机器凭据的端点能力目录,dataClass 语义),
 *  **不是** `capability-extensions.ts`(声明式扩展 manifest 校验器),
 *  **不是** `skill-tiers.ts` 的 `MODEL_CAPABILITY_TIERS`(模型能力分档):四者语义互不顶账。
 * - 本表只判「该形态下这个能力面挂不挂」,**不判**权限、档位、审批;权限双轴见 `permission-axis.ts`。
 * - 本表不引入任何平台分支(`Platform.OS` 之类)进共享层(§3):形态是**声明值**,不是运行时探测。
 */

/** 本仓产品形态全集(四个自研端形态;出处见文件头注)。 */
export const PRODUCT_FORMS = ['web', 'miniapp', 'rn', 'cli'] as const

export type ProductForm = (typeof PRODUCT_FORMS)[number]

/** 能力键全集(agent 内核的三块执行面;每个键都有 CLI 消费方,出处见文件头注)。 */
export const PRODUCT_CAPABILITIES = ['localWorkspace', 'localHooks', 'browserRuntime'] as const

export type ProductCapability = (typeof PRODUCT_CAPABILITIES)[number]

/**
 * 单个形态的能力行。
 *
 * **某格缺席 = 该形态未登记这一格**(不是 false)。行类型因此是 Partial:
 * 缺席必须能被表达成"未判定",否则缺键只能被静默折成关闭(§0.3)。
 */
export type ProductCapabilityRow = Readonly<Partial<Record<ProductCapability, boolean>>>

/**
 * 产品形态 → 能力布尔 的**唯一一张表**(§0.6:表与查询函数全仓只许一份)。
 *
 * 每格的判据(逐条):
 * - `cli`(本机 Node 进程,本仓唯一带本机执行面的产品):
 *   三面全开 —— 文件/命令/git/终端工具族在 `apps/cli/src/tools/`,钩子派发在
 *   `apps/cli/src/hooks/index.ts` 的 `dispatchHookEntry`,CDP 浏览器族在 `tools/browser*.ts`。
 * - `web` / `miniapp` / `rn`:这三端是**页面端 / 沙箱端 / 原生壳端**,它们的产品里
 *   不带 CLI 那套本机执行面 ⇒ `localWorkspace` / `localHooks` 判**关**。
 * - `web` 行的 `browserRuntime` **有意留空(未登记)**:web 端自带浏览器(DOM 面),
 *   与 agent 内核侧那套「CDP 浏览器自动化工具面」**不是同一件能力**;它在 web 形态
 *   开不开**尚未判定** ⇒ 按 §0.3 留空,不冒充 false(查它会判 `unjudged` 并由消费点出声)。
 */
export const PRODUCT_FORM_CAPABILITIES: Readonly<Record<ProductForm, ProductCapabilityRow>> = {
  cli: { localWorkspace: true, localHooks: true, browserRuntime: true },
  web: { localWorkspace: false, localHooks: false },
  miniapp: { localWorkspace: false, localHooks: false, browserRuntime: false },
  rn: { localWorkspace: false, localHooks: false, browserRuntime: false },
}

/** 判定三态:`unjudged` = **没判**(不是"关",也不是"开")。 */
export type ProductCapabilityState = 'enabled' | 'disabled' | 'unjudged'

/** 判定回执:形状固定,消费点不许自己拼结论(§0.6)。 */
export interface ProductCapabilityVerdict {
  /** 三态判定结果 */
  readonly state: ProductCapabilityState
  /** 本次判定的形态(未登记时是原样取值,便于点名) */
  readonly form: string
  /** 本次判定的能力键(未登记时是原样取值,便于点名) */
  readonly capability: string
  /** 人可读理由:必须点名形态与能力 */
  readonly reason: string
}

/** 取值是否在本仓形态全集内。 */
export function isProductForm(value: string): value is ProductForm {
  return (PRODUCT_FORMS as readonly string[]).includes(value)
}

/** 取值是否在本仓能力键全集内。 */
export function isProductCapability(value: string): value is ProductCapability {
  return (PRODUCT_CAPABILITIES as readonly string[]).includes(value)
}

/**
 * 判定「形态 × 能力」这一格(**纯函数**:不读 env、不读盘、不带副作用,故可单测、可解释)。
 *
 * 三条失效路径都判 `unjudged` 并点名(绝不静默):
 * 1. 形态不在 `PRODUCT_FORMS` 内 ⇒ 理由点名形态与合法值域;
 * 2. 能力不在 `PRODUCT_CAPABILITIES` 内 ⇒ 理由点名形态、能力与合法值域;
 * 3. 形态合法但该行**没有这一格** ⇒ 理由点名形态与能力,并明说"未登记 ≠ 关闭"。
 *
 * 判成 `disabled` 时理由同样点名形态与能力(消费点据此出声"能力未开")。
 */
export function evaluateProductFormCapability(
  form: string,
  capability: string,
): ProductCapabilityVerdict {
  if (!isProductForm(form)) {
    return {
      state: 'unjudged',
      form,
      capability,
      reason: `产品形态未登记:${form}(合法形态:${PRODUCT_FORMS.join('|')})`,
    }
  }
  if (!isProductCapability(capability)) {
    return {
      state: 'unjudged',
      form,
      capability,
      reason: `能力未登记:${form} · ${capability}(合法能力:${PRODUCT_CAPABILITIES.join('|')})`,
    }
  }
  const row = PRODUCT_FORM_CAPABILITIES[form]
  const cell = row[capability]
  if (cell === undefined) {
    return {
      state: 'unjudged',
      form,
      capability,
      reason: `能力未登记:${form} · ${capability}(该形态这一格未登记;未登记 ≠ 关闭)`,
    }
  }
  return cell
    ? {
        state: 'enabled',
        form,
        capability,
        reason: `能力已开:${form} · ${capability}`,
      }
    : {
        state: 'disabled',
        form,
        capability,
        reason: `能力未开:${form} · ${capability}`,
      }
}

/**
 * 「设置导入期按扩展 ID 过滤」的**在册单源**(goal-b49 Z27b,2026-11-06 立;承 Z4-triage
 * 「T1 §4 #4」行与 Z20 §④ 的「缺宿主」裁决 —— 那一格缺的从来不是判据,是消费它的宿主)。
 *
 * 本表只登记「哪枚扩展 ID 依赖哪个能力面」这一件**事实**;**放行 / 跳过 / 未判定的判定一律仍由
 * 上面那张 `PRODUCT_FORM_CAPABILITIES` 布尔表 + `evaluateProductFormCapability` 现算**。
 * 本表**不写**「某形态放行/屏蔽哪些扩展」的第二份名单(§0.6:同类判据全仓只许一份)。
 *
 * 真消费方(不是只有测试会调的壳):`apps/cli/src/config/layer-policy.ts` 的
 * `filterProjectLayerSettings` —— 项目层(= 仓库内容,别人写的 `<cwd>/.ihui/settings.json`)的
 * `plugins.extensions` 在合入生效配置前,逐枚交本表评价;命中的具名跳过并出声。
 *
 * 取值边界:键是反向域名式扩展 ID(与 `capability-extensions.ts` 的 `EXTENSION_ID_RE` 同族**词汇**,
 * 但本表不 import 那份 —— 声明式 manifest 校验器与能力布尔面语义互不顶账,见文件头注「边界」);
 * 值是 `PRODUCT_CAPABILITIES` 里的能力键(编译期 `ProductCapability` 锁死,加错键即红)。
 */
export const IMPORT_GATED_EXTENSIONS: Readonly<Record<string, ProductCapability>> = {
  // 本机工作区执行面(文件 / 命令 / git / 终端 / 代码图族,出处见 apps/cli tools 面)
  'com.ihui.local-workspace': 'localWorkspace',
  // 本机钩子派发面(dispatchHookEntry)
  'com.ihui.local-hooks': 'localHooks',
  // 浏览器自动化面(CDP browser_* 族)
  'com.ihui.browser-runtime': 'browserRuntime',
}

/** 导入期单枚扩展 ID 的三态裁决:`kept` 放行合入 / `skipped` 判关 / `unjudged` 没判 ⇒ 不放行。 */
export type ExtensionImportGateDecision = 'kept' | 'skipped' | 'unjudged'

export interface ExtensionImportGateVerdict {
  readonly id: string
  readonly decision: ExtensionImportGateDecision
  /** 该扩展归属的能力面;不在名内时为 `(不受能力门管辖)` */
  readonly capability: string
  /** 人可读依据:必须点名扩展 ID(及能力/形态),静默 = 没判(§0.9) */
  readonly reason: string
}

/**
 * 纯函数(不读 env / 不碰盘,故可单测、可解释):判「该形态下,设置导入时这枚扩展 ID 放不放行」。
 *
 * - 名内 ∧ 能力 `enabled` ⇒ `kept`(照常合入);
 * - 名内 ∧ 能力 `disabled` ⇒ `skipped`(具名跳过);
 * - 名内 ∧ 能力 `unjudged`(形态/该格未登记)⇒ `unjudged` ⇒ **不放行**(§0.3:取不到判定绝不记绿);
 * - **名外 ⇒ `kept`(不受产品形态门管辖,零回归)** —— 本表只约束登记过的扩展,没登记的一律不拦。
 *
 * `gate` 形参供调用方注入「现读到的集合」:传 `null`(集合取不到)⇒ 所有名内候选一律 `unjudged`
 * 不放行,绝不误判成「放行」(§0.3 / §0.10 失效方向恒为多拦一次,不是多放一次)。
 */
export function evaluateExtensionImportGate(
  id: string,
  form: string,
  gate: Readonly<Record<string, ProductCapability>> | null = IMPORT_GATED_EXTENSIONS,
): ExtensionImportGateVerdict {
  if (gate === null) {
    return {
      id,
      decision: 'unjudged',
      capability: '(集合取不到)',
      reason: `扩展 ${id}:能力门集合取不到 ⇒ 未判定,不放行(§0.3;修复:确认 @ihui/types 的 IMPORT_GATED_EXTENSIONS 可解析)`,
    }
  }
  const capability = gate[id]
  if (capability === undefined) {
    return {
      id,
      decision: 'kept',
      capability: '(不受能力门管辖)',
      reason: `扩展 ${id} 不在能力门名单内 ⇒ 不受产品形态门管辖,设置导入照常放行`,
    }
  }
  const verdict = evaluateProductFormCapability(form, capability)
  const decision: ExtensionImportGateDecision =
    verdict.state === 'enabled'
      ? 'kept'
      : verdict.state === 'disabled'
        ? 'skipped'
        : 'unjudged'
  return { id, decision, capability, reason: `扩展 ${id} 依赖 ${capability};${verdict.reason}` }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
