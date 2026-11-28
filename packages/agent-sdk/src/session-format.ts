// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 会话格式版本注册表(W4-13)—— 旧会话能不能被新版本读,由“逐版本迁移器”回答,
 * 而不是由“字段看着还在”猜。
 *
 * 三条硬规矩:
 *   1. 版本只认 `formatVersion: 非负整数`;缺字段按 v0(历史文件),字符串/负数一律拒;
 *   2. 没注册的版本直接 `unknown-version` 拒,不往上猜、不往下压;
 *   3. 每一步迁移必须声明 `lossy`;链条里只要有一损,结果打 `formatLossy: true`。
 *
 * 迁移是**纯数据变换**:不读文件、不写文件、不看时钟;持久化由调用方决定。
 */
export * from './session-format-types.js';
import {
  SessionFormatRegistryError,
  isSessionFormatRecord,
  readDeclaredFormatVersion,
  type SessionFormatCodec,
  type SessionFormatMigrateResult,
  type SessionFormatParseResult,
  type SessionFormatRecord,
} from './session-format-types.js';

export class SessionFormatRegistry {
  private readonly codecs = new Map<number, SessionFormatCodec>();

  register(codec: SessionFormatCodec): this {
    if (!Number.isInteger(codec.version) || codec.version < 0) {
      throw new SessionFormatRegistryError('invalid-version', `非法会话格式版本: ${codec.version}`);
    }
    if (this.codecs.has(codec.version)) {
      throw new SessionFormatRegistryError('duplicate-version', `会话格式 v${codec.version} 已注册`);
    }
    if (codec.migrateToNext !== undefined) {
      if (
        !Number.isInteger(codec.migrateToNext.to) ||
        codec.migrateToNext.to !== codec.version + 1 ||
        typeof codec.migrateToNext.lossy !== 'boolean' ||
        typeof codec.migrateToNext.migrate !== 'function'
      ) {
        throw new SessionFormatRegistryError(
          'invalid-step',
          `v${codec.version} 的迁移必须指向 v${codec.version + 1},并显式声明 lossy`,
        );
      }
    }
    this.codecs.set(codec.version, codec);
    return this;
  }

  knownVersions(): number[] {
    return [...this.codecs.keys()].sort((a, b) => a - b);
  }

  currentVersion(): number {
    if (this.codecs.size === 0) {
      throw new SessionFormatRegistryError('no-codecs', '会话格式注册表为空');
    }
    return Math.max(...this.codecs.keys());
  }

  /** 只做“识别版本 + 该版本校验”,不迁移、不改写。 */
  parse(input: unknown): SessionFormatParseResult {
    if (!isSessionFormatRecord(input)) {
      return { ok: false, code: 'not-object', message: '会话内容不是 JSON 对象' };
    }
    if (this.codecs.size === 0) {
      return { ok: false, code: 'no-codecs', message: '会话格式注册表为空' };
    }
    const declared = readDeclaredFormatVersion(input);
    if (!declared.ok) {
      return { ok: false, code: 'invalid-version', message: declared.message };
    }
    const codec = this.codecs.get(declared.version);
    if (!codec) {
      return {
        ok: false,
        code: 'unknown-version',
        message: `未注册的会话格式 v${declared.version};拒绝猜测`,
        version: declared.version,
      };
    }
    let reason: string | null;
    try {
      reason = codec.validate(input);
    } catch (error) {
      return {
        ok: false,
        code: 'invalid-session',
        message: `v${declared.version} 校验抛错: ${error instanceof Error ? error.message : String(error)}`,
        version: declared.version,
      };
    }
    if (reason !== null) {
      return {
        ok: false,
        code: 'invalid-session',
        message: `v${declared.version} 校验失败: ${reason}`,
        version: declared.version,
      };
    }
    return { ok: true, version: declared.version, value: input };
  }

  /** 逐版本升到 `target`(缺省最新);不支持降级,不跳步。 */
  migrate(input: unknown, target?: number): SessionFormatMigrateResult {
    const parsed = this.parse(input);
    if (!parsed.ok) return parsed;
    const toVersion = target ?? this.currentVersion();
    if (toVersion < parsed.version) {
      return {
        ok: false,
        code: 'downgrade-unsupported',
        message: `不支持从 v${parsed.version} 降到 v${toVersion};降级会丢字段`,
        fromVersion: parsed.version,
        toVersion,
      };
    }
    if (toVersion === parsed.version) {
      return {
        ok: true,
        value: parsed.value,
        fromVersion: parsed.version,
        toVersion,
        migrated: false,
        lossy: parsed.value.formatLossy === true,
        steps: [],
      };
    }

    let value = parsed.value;
    let lossy = value.formatLossy === true;
    const steps: string[] = [];
    for (let version = parsed.version; version < toVersion; version++) {
      const step = this.codecs.get(version)?.migrateToNext;
      if (!step || step.to !== version + 1) {
        return {
          ok: false,
          code: 'missing-migration',
          message: `缺少 v${version} -> v${version + 1} 的迁移器;不允许跳步`,
          fromVersion: parsed.version,
          toVersion,
        };
      }
      try {
        const next = step.migrate(value);
        if (!isSessionFormatRecord(next)) {
          return {
            ok: false,
            code: 'step-failed',
            message: `v${version} -> v${version + 1} 迁移结果不是对象`,
            fromVersion: parsed.version,
            toVersion,
          };
        }
        value = next;
      } catch (error) {
        return {
          ok: false,
          code: 'step-failed',
          message: `v${version} -> v${version + 1} 迁移抛错: ${error instanceof Error ? error.message : String(error)}`,
          fromVersion: parsed.version,
          toVersion,
        };
      }
      if (step.lossy) lossy = true;
      steps.push(`${version}->${version + 1}`);
    }

    const nextValue: SessionFormatRecord = { ...value, formatVersion: toVersion };
    if (lossy) nextValue.formatLossy = true;
    const finalCodec = this.codecs.get(toVersion);
    if (!finalCodec) {
      return {
        ok: false,
        code: 'missing-migration',
        message: `迁移目标 v${toVersion} 没有注册校验器`,
        fromVersion: parsed.version,
        toVersion,
      };
    }
    let reason: string | null;
    try {
      reason = finalCodec.validate(nextValue);
    } catch (error) {
      return {
        ok: false,
        code: 'final-invalid',
        message: `v${toVersion} 终检抛错: ${error instanceof Error ? error.message : String(error)}`,
        fromVersion: parsed.version,
        toVersion,
      };
    }
    if (reason !== null) {
      return {
        ok: false,
        code: 'final-invalid',
        message: `v${toVersion} 终检失败: ${reason}`,
        fromVersion: parsed.version,
        toVersion,
      };
    }
    return {
      ok: true,
      value: nextValue,
      fromVersion: parsed.version,
      toVersion,
      migrated: true,
      lossy,
      steps,
    };
  }
}

/** 0 = 旧文件(无 formatVersion);1 = 现行格式。 */
export const SESSION_FORMAT_V0 = 0;
export const SESSION_FORMAT_CURRENT_VERSION = 1;

function validateSessionShape(value: SessionFormatRecord): string | null {
  if (typeof value.id !== 'string' || value.id.length === 0) return '缺少非空字符串 id';
  if (!Array.isArray(value.history)) return '缺少 history 数组';
  return null;
}

/**
 * 生产注册表:v0(历史文件)→ v1(盖上 formatVersion)。
 * 这一步是**无损**的——只补版本字段,不改任何会话内容。
 */
export function createSessionFormatRegistry(): SessionFormatRegistry {
  return new SessionFormatRegistry()
    .register({
      version: SESSION_FORMAT_V0,
      validate: validateSessionShape,
      migrateToNext: {
        to: SESSION_FORMAT_V0 + 1,
        lossy: false,
        migrate: (value) => ({ ...value }),
      },
    })
    .register({
      version: SESSION_FORMAT_CURRENT_VERSION,
      validate: (value) =>
        value.formatVersion === SESSION_FORMAT_CURRENT_VERSION
          ? validateSessionShape(value)
          : `formatVersion 必须是 ${SESSION_FORMAT_CURRENT_VERSION}`,
    });
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
