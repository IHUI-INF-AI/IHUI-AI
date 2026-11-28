// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/** 会话格式版本化的公开类型与注册期错误;迁移逻辑在 `session-format.ts`。 */

export type SessionFormatRecord = Record<string, unknown>;

export interface SessionFormatStep {
  /** 迁移后的版本号,必须恰好是当前版本 + 1 */
  readonly to: number;
  /** 有损声明:true 表示这一步丢掉了旧字段语义,需在会话上留标 */
  readonly lossy: boolean;
  readonly migrate: (value: SessionFormatRecord) => SessionFormatRecord;
}

export interface SessionFormatCodec {
  readonly version: number;
  /** 返回 null 表示通过,否则返回可读原因 */
  readonly validate: (value: SessionFormatRecord) => string | null;
  /** 末版不需要;非末版必须提供且 `to === version + 1` */
  readonly migrateToNext?: SessionFormatStep;
}

export interface SessionFormatParseOk {
  readonly ok: true;
  readonly version: number;
  readonly value: SessionFormatRecord;
}

export interface SessionFormatParseFail {
  readonly ok: false;
  readonly code:
    | 'not-object'
    | 'invalid-version'
    | 'unknown-version'
    | 'invalid-session'
    | 'no-codecs';
  readonly message: string;
  readonly version?: number;
}

export type SessionFormatParseResult = SessionFormatParseOk | SessionFormatParseFail;

export interface SessionFormatMigrateOk {
  readonly ok: true;
  readonly value: SessionFormatRecord;
  readonly fromVersion: number;
  readonly toVersion: number;
  readonly migrated: boolean;
  readonly lossy: boolean;
  /** 实际走过的步骤,如 `0->1`;已是最新版时为空 */
  readonly steps: readonly string[];
}

export interface SessionFormatMigrateFail {
  readonly ok: false;
  readonly code:
    | SessionFormatParseFail['code']
    | 'downgrade-unsupported'
    | 'missing-migration'
    | 'step-failed'
    | 'final-invalid';
  readonly message: string;
  readonly fromVersion?: number;
  readonly toVersion?: number;
}

export type SessionFormatMigrateResult = SessionFormatMigrateOk | SessionFormatMigrateFail;

export type SessionFormatRegistryErrorCode =
  | 'duplicate-version'
  | 'invalid-version'
  | 'invalid-step'
  | 'no-codecs';

export class SessionFormatRegistryError extends Error {
  readonly code: SessionFormatRegistryErrorCode;

  constructor(code: SessionFormatRegistryErrorCode, message: string) {
    super(message);
    this.name = 'SessionFormatRegistryError';
    this.code = code;
  }
}

export function isSessionFormatRecord(value: unknown): value is SessionFormatRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** 缺字段按 v0(历史文件);显式版本只认非负整数。 */
export function readDeclaredFormatVersion(
  value: SessionFormatRecord,
): { ok: true; version: number } | { ok: false; message: string } {
  const raw = value.formatVersion;
  if (raw === undefined) return { ok: true, version: 0 };
  if (typeof raw !== 'number' || !Number.isInteger(raw) || raw < 0) {
    return { ok: false, message: `formatVersion 必须是非负整数,实际是 ${String(raw)}` };
  }
  return { ok: true, version: raw };
}
