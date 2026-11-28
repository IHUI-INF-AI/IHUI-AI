// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/** 宿主 API 契约(W4-07)的公开类型;校验在 `host-api-contract.ts`,比对在 `-serde.ts`。 */

export interface HostApiType {
  readonly name: string;
  /** 形状说明只在契约面,真正字段校验留给生成器;本轮先钉住“类型存在且被引用”。 */
  readonly shape: 'object' | 'string' | 'number' | 'boolean' | 'array' | 'union' | 'void';
}

export interface HostApiMethod {
  readonly name: string;
  readonly requestType: string;
  readonly responseType: string;
}

export interface HostApiEvent {
  readonly name: string;
  /** 事件不是自由字符串:必须引用 `types` 里的一个 payload 类型 */
  readonly payloadType: string;
}

export interface HostApiService {
  readonly name: string;
  readonly methods: readonly HostApiMethod[];
  readonly events: readonly HostApiEvent[];
}

export interface HostApiContract {
  readonly version: number;
  readonly services: readonly HostApiService[];
  readonly types: readonly HostApiType[];
}

export type HostApiIssueCode =
  | 'invalid-contract'
  | 'invalid-version'
  | 'duplicate-service'
  | 'duplicate-method'
  | 'duplicate-event'
  | 'duplicate-type'
  | 'empty-service'
  | 'missing-type'
  | 'missing-event-payload'
  | 'invalid-name';

export interface HostApiIssue {
  readonly path: string;
  readonly code: HostApiIssueCode;
  readonly message: string;
}

export interface HostApiValidateOk {
  readonly ok: true;
  readonly contract: HostApiContract;
}

export interface HostApiValidateFail {
  readonly ok: false;
  readonly issues: readonly HostApiIssue[];
}

export type HostApiValidateResult = HostApiValidateOk | HostApiValidateFail;

export type HostApiDriftKind =
  | 'version-changed'
  | 'service-added'
  | 'service-removed'
  | 'method-added'
  | 'method-removed'
  | 'method-signature-changed'
  | 'event-added'
  | 'event-removed'
  | 'event-payload-changed'
  | 'type-added'
  | 'type-removed';

export interface HostApiDrift {
  readonly kind: HostApiDriftKind;
  readonly path: string;
  readonly message: string;
}

export class HostApiContractError extends Error {
  readonly issues: readonly HostApiIssue[];

  constructor(issues: readonly HostApiIssue[]) {
    super(`宿主 API 契约不合法: ${issues.map((i) => `${i.path}(${i.code})`).join(', ')}`);
    this.name = 'HostApiContractError';
    this.issues = issues;
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
