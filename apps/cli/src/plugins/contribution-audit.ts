// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Plugins 贡献审计层 —— **贡献词表的运行期消费方**(goal-b49/S2 立,W2 从 `loader.ts` 拆出)。
 *
 * 词表单源 = `@ihui/types` 的 `EXTENSION_CONTRIBUTION_KINDS`,本文件不得另抄一份名单(§0.6)。
 * 每份清单声明的 `contributes` 逐档裁决,三态都必须**出声**:
 *   - `accepted`   :本宿主持有该档、且该插件声明了能在 capability-catalog 落地的权限;
 *   - `declined`   :本宿主没有该档的落点(如 `nativeModules` 要原生二进制),点名原因;
 *   - `unknown-kind`:不在词表内,点名当前词表全量。
 * "识别到但本宿主不支持"与"根本不认识"是两件事,分开编码,免得一种失效形态伪装成另一种。
 * 权限那一维走 capability-catalog 的**默认拒**:未声明权限的插件拿不到任何数据类,
 * 其贡献一律 declined(详见 classifyContributions)。
 *
 * 本层是纯判定(不读盘、不改状态、永不抛穿);装载侧只把 findings 摊进 diagnostics,
 * 由 `contributionDiagnosticsOf` 一处完成 verdict → 判别码的映射(两条码均 `warning`,
 * 拒档不等于装载失败 ⇒ 刻意不升任何档)。
 */

import {
  EXTENSION_CONTRIBUTION_KINDS,
  extensionDataClassGrant,
  type CapabilityDataClass,
  type ExtensionContributionKind,
} from '@ihui/types';
import type { PluginDiagnostic, PluginDiagnosticCode, PluginManifest } from './types.js';
import { diagnostic } from './manifest-scan.js';

/** 本装载器对某一贡献档的支持结论。 */
export type ContributionSupport = 'wired' | 'no-host';

/**
 * 词表逐档的装载期裁决。
 *
 * 键型写成 `Record<ExtensionContributionKind, …>` 而不是 `Record<string, …>`:
 * 词表加一档而这里没跟上 ⇒ 编译期即红(门 121「声明必须有消费者」里"编译期那一半";
 * 运行期那一半由 classifyContributions 的用例钉住 —— 只靠注释声称"已接"不算接,§0.9)。
 *
 * `no-host` 不是"不支持所以不写":对侧 catalog 把这些档原样声明给宿主,没有任何"本机能不能吃"
 * 的判定;吃不下又不出声 = 静默忽略,用户只看到"插件装了但没东西"。逐档给**可复述的原因**。
 */
const CONTRIBUTION_SUPPORT: Record<ExtensionContributionKind, { support: ContributionSupport; reason: string }> = {
  tools: { support: 'wired', reason: 'loader forwards tools[] to the plugin registry' },
  commands: { support: 'wired', reason: 'loader forwards commands[] to the plugin registry' },
  views: { support: 'no-host', reason: 'no workbench/settings view host in the CLI: a contributed view has nowhere to mount' },
  filePreviewers: { support: 'no-host', reason: 'no file-preview surface in the CLI: nothing consumes filenameSuffixes routing' },
  qoderAgentSdk: { support: 'no-host', reason: 'no agent-SDK injection channel in this host' },
  configuration: { support: 'no-host', reason: 'no settings host in the plugin loader; configuration keys are owned by apps/cli settings' },
  nativeModules: { support: 'no-host', reason: 'requires a native binary (.node) matched to this host ABI; the CLI loader never loads native code' },
  sidebarNavItems: { support: 'no-host', reason: 'no sidebar surface in the CLI' },
  sessionResources: { support: 'no-host', reason: 'no session-resource panel in the CLI' },
  chatMentionProviders: { support: 'no-host', reason: 'no chat mention provider registry in the CLI' },
};

/** 词表档名 → 裁决表的唯一查表出口(不做第二份名单,也不静默回落成 wired)。 */
function supportOf(kind: string): { support: ContributionSupport; reason: string } | null {
  return (CONTRIBUTION_SUPPORT as Record<string, { support: ContributionSupport; reason: string } | undefined>)[
    kind
  ] ?? null;
}

/** 逐档裁决三态:`accepted` / `declined`(本宿主吃不下或拿不到数据类)/ `unknown-kind`(不在词表内)。 */
export type ContributionVerdict = 'accepted' | 'declined' | 'unknown-kind';

/** 一条贡献裁决(ASCII 文案:要进日志,不得被控制台码页吃掉)。 */
export interface ContributionFinding {
  pluginName: string;
  /** 声明该贡献的清单绝对路径 */
  file: string;
  /** 档名(原样照抄清单里的键,便于用户对着自己的文件改) */
  kind: string;
  verdict: ContributionVerdict;
  /** 清单里该档声明了几条(非数组时为 0,并在 reasons 里点名形态问题) */
  itemCount: number;
  /** 判定依据(accepted 给出"为什么算数";declined/unknown-kind 给出"为什么不算") */
  reasons: string[];
  /** 该插件声明的权限映射出的可达数据类;空数组 = 默认拒(任何数据类都拿不到) */
  dataClasses: readonly CapabilityDataClass[];
  /** 声明了但未在 capability-catalog 登记的 scope(逐条点名,不冒充"没限制") */
  unregisteredPermissions: readonly string[];
}

/** 一次装载/一次判定的贡献汇总。 */
export interface PluginContributionAudit {
  findings: ContributionFinding[];
  acceptedCount: number;
  declinedCount: number;
  unknownKindCount: number;
}

/** classifyContributions 的入参(从清单原始对象取,不依赖 PluginManifest 形态) */
export interface ContributionInput {
  pluginName: string;
  file: string;
  permissions?: unknown;
  contributes?: unknown;
}

/** 读 permissions 为字符串数组:非数组/非字符串一律按"未声明"处理,由默认拒兜住。 */
function permissionList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim() !== '');
}

/**
 * 逐档裁决一份清单的 `contributes`。纯函数:不读盘、不改状态、永不抛穿。
 *
 * 默认拒的两道闸(缺一不算默认拒):
 *  1. 档必须落在词表内,否则 unknown-kind 并点名当前词表全量;
 *  2. 落点了也得有数据面 —— 权限集合经 `extensionDataClassGrant` 求出的可达数据类为空
 *     (未声明权限 / 声明了但未登记)⇒ 一律 declined,即使该档本身是 `wired`。
 */
export function classifyContributions(input: ContributionInput): PluginContributionAudit {
  const permissions = permissionList(input.permissions);
  const grant = extensionDataClassGrant({ permissions });
  const findings: ContributionFinding[] = [];

  if (input.contributes !== undefined) {
    if (
      input.contributes === null ||
      typeof input.contributes !== 'object' ||
      Array.isArray(input.contributes)
    ) {
      findings.push({
        pluginName: input.pluginName,
        file: input.file,
        kind: 'contributes',
        verdict: 'unknown-kind',
        itemCount: 0,
        reasons: ['"contributes" must be a plain object of kind -> contribution[]'],
        dataClasses: grant.allowed,
        unregisteredPermissions: grant.unregistered,
      });
    } else {
      for (const [kind, value] of Object.entries(input.contributes as Record<string, unknown>)) {
        const items = Array.isArray(value) ? value : null;
        const support = supportOf(kind);
        const reasons: string[] = [];
        let verdict: ContributionVerdict;
        if (!support) {
          verdict = 'unknown-kind';
          reasons.push(`"${kind}" is not a known contribution kind`);
          reasons.push(`known kinds: ${EXTENSION_CONTRIBUTION_KINDS.join('/')}`);
        } else if (items === null) {
          verdict = 'declined';
          reasons.push(`"contributes.${kind}" must be an array; got ${typeof value}`);
        } else if (support.support === 'no-host') {
          verdict = 'declined';
          reasons.push(support.reason);
        } else if (grant.allowed.length === 0) {
          verdict = 'declined';
          reasons.push(
            permissions.length === 0
              ? 'no permission declared: default deny, no dataClass reachable'
              : 'declared permissions map to no dataClass in capability-catalog: default deny',
          );
          if (grant.unregistered.length > 0) {
            reasons.push(`unregistered scopes: ${grant.unregistered.join('/')}`);
          }
        } else {
          verdict = 'accepted';
          reasons.push(support.reason);
        }
        findings.push({
          pluginName: input.pluginName,
          file: input.file,
          kind,
          verdict,
          itemCount: items ? items.length : 0,
          reasons,
          dataClasses: grant.allowed,
          unregisteredPermissions: grant.unregistered,
        });
      }
    }
  }

  return summarizeContributions(findings);
}

/** 汇总:计数只按 verdict 算一次,单条判定与聚合共用同一实现(不做两遍判据)。 */
export function summarizeContributions(findings: ContributionFinding[]): PluginContributionAudit {
  return {
    findings,
    acceptedCount: findings.filter((f) => f.verdict === 'accepted').length,
    declinedCount: findings.filter((f) => f.verdict === 'declined').length,
    unknownKindCount: findings.filter((f) => f.verdict === 'unknown-kind').length,
  };
}

/**
 * 把清单原始对象摊成 classifyContributions 入参。
 *
 * `PluginManifest`(types.ts 的既有 schema,本席不得改)没有 contributes/permissions 字段,
 * 但 `parseManifestFile` 交回的是 JSON.parse 的完整对象,`normalizeManifest` 才做白名单裁剪 ——
 * 所以这里读的是**裁剪前**的字节。唯一一次加宽集中在这行,不扩散到判定逻辑。
 */
export function contributionInputOf(manifest: PluginManifest, pluginName: string, file: string): ContributionInput {
  const raw = manifest as unknown as Record<string, unknown>;
  return { pluginName, file, permissions: raw.permissions, contributes: raw.contributes };
}

/**
 * findings → 装载诊断(goal-b49/W2 的"接到主通道"那一半)。
 *
 * 一条非 accepted 裁决**恰好**一行,由调用点(`agent.ts` 的 `reportPluginDiagnostics`)按
 * severity 送进 logger ⇒ 用户看得见。判别码的选择只住在这个函数里(不在产出点散落字面量,
 * 也不在两处各挑一档 —— 必漂移):
 *   - `declined`      ⇒ `plugin-contribution-declined`(本宿主吃不下 / 默认拒拿不到数据类)
 *   - `unknown-kind`  ⇒ `plugin-contribution-unknown-kind`(词表里没有这一档)
 * `accepted` 不产诊断:它不是问题,写进日志等于每轮造噪声。两条码在 `DIAGNOSTIC_SEVERITY`
 * 里都是 `warning`,拒档不代表装载失败,**刻意不升 error**(升档会把可整改的提示变成启动红旗)。
 */
export function contributionDiagnosticsOf(findings: readonly ContributionFinding[]): PluginDiagnostic[] {
  const out: PluginDiagnostic[] = [];
  for (const finding of findings) {
    if (finding.verdict === 'accepted') continue;
    const code: PluginDiagnosticCode =
      finding.verdict === 'unknown-kind' ? 'plugin-contribution-unknown-kind' : 'plugin-contribution-declined';
    const label =
      finding.verdict === 'unknown-kind' ? 'rejected (unknown contribution kind)' : 'declined by this host';
    out.push(
      diagnostic(
        code,
        finding.file,
        `Contribution "${finding.kind}" ${label}: ${finding.reasons.join('; ')} (${finding.itemCount} item(s) declared)`,
        { pluginName: finding.pluginName },
      ),
    );
  }
  return out;
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
