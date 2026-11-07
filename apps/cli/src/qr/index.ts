// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 自写 QR 编码器(byte 模式 · 纠错等级 M · 版本 1–10)的唯一对外出口。
 *
 * 为什么是自写而不是装库(2026-11-05,goal-b49 / Z6 代裁):
 *   - 分享页的立身之本是「零外链、断网可读」,为一个二维码新增运行时依赖与它冲突;
 *   - `apps/cli` 的依赖面是发布物 `ihui-cli` 的安装面,单为本机快照加一枚 qr 库不值;
 *   - API 侧那把尺(apps/api/src/services/mfa-service.ts 的 generateQRCodeURI/generateQRCodeDataUrl)
 *     只是 `qrcode` npm 包的转手,且只产 otpauth 场景的 PNG data URL —— 跨端不可复用(见交付件①)。
 *
 * 失败方向:一律抛具名 `QrEncodeError`,不返回半成品矩阵、不静默截断载荷。
 */
import { buildFinalCodewords, toUtf8Bytes } from './encode-data.js';
import { buildBaseGrid, type QrGrid } from './patterns.js';
import { maskedSymbol, scoreMaskCandidates, selectMaskPattern, type MaskCandidate } from './mask.js';
import { pickMinimumVersion, QR_MAX_VERSION, versionSpec, type VersionSpec } from './tables.js';

export type QrEncodeReason = 'empty-input' | 'too-long' | 'unsupported-version' | 'internal';

/** 具名拒绝:调用方据 reason 决定「未生成」的措辞,不得当作成功 */
export class QrEncodeError extends Error {
  readonly reason: QrEncodeReason;
  readonly byteLength: number;
  readonly capacity: number;

  constructor(reason: QrEncodeReason, message: string, byteLength = 0, capacity = 0) {
    super(message);
    this.name = 'QrEncodeError';
    this.reason = reason;
    this.byteLength = byteLength;
    this.capacity = capacity;
  }
}

/** 一次编码的完整结果(矩阵 + 选中的版本/掩码,供用例逐维断言) */
export interface QrCodeResult {
  readonly text: string;
  readonly version: number;
  readonly maskPattern: number;
  readonly grid: QrGrid;
  readonly codewords: Uint8Array;
  readonly candidates: readonly MaskCandidate[];
}

export interface EncodeQrOptions {
  /** 指定版本(1–QR_MAX_VERSION);不指定则取能装下的最小版本 */
  readonly version?: number;
}

/**
 * 文本 → 掩码选定后的最终矩阵。
 * 空串、超容量、指定版本装不下 ⇒ 抛 QrEncodeError(不产出任何半成品)。
 */
export function encodeQr(text: string, options: EncodeQrOptions = {}): QrCodeResult {
  if (typeof text !== 'string' || text.length === 0) {
    throw new QrEncodeError('empty-input', 'QR 编码输入为空:不产出二维码');
  }
  const payload = toUtf8Bytes(text);
  let spec: VersionSpec | undefined;
  if (options.version !== undefined) {
    spec = versionSpec(options.version);
    if (!spec) {
      throw new QrEncodeError(
        'unsupported-version',
        `QR 版本只支持 1–${QR_MAX_VERSION},收到 ${options.version}`,
      );
    }
  } else {
    spec = pickMinimumVersion(payload.length);
    if (!spec) {
      const maxCapacity = versionSpec(QR_MAX_VERSION)?.byteCapacity ?? 0;
      throw new QrEncodeError(
        'too-long',
        `QR 载荷 ${payload.length} 字节超出 v${QR_MAX_VERSION} M 档 byte 容量 ${maxCapacity}`,
        payload.length,
        maxCapacity,
      );
    }
  }
  if (payload.length > spec.byteCapacity) {
    throw new QrEncodeError(
      'too-long',
      `QR 载荷 ${payload.length} 字节超出 v${spec.version} M 档容量 ${spec.byteCapacity}`,
      payload.length,
      spec.byteCapacity,
    );
  }

  const codewords = buildFinalCodewords(payload, spec);
  if (codewords.length !== spec.totalCodewords) {
    throw new QrEncodeError(
      'internal',
      `QR 码字流长度异常:期望 ${spec.totalCodewords},实得 ${codewords.length}`,
      payload.length,
      spec.byteCapacity,
    );
  }

  const base = buildBaseGrid(spec);
  const candidates = scoreMaskCandidates(base, codewords);
  const maskPattern = selectMaskPattern(candidates);
  return { text, version: spec.version, maskPattern, grid: maskedSymbol(base, codewords, maskPattern), codewords, candidates };
}

/** 只关心「能不能扫」的调用侧用这个:失败返回 null,不抛、不半成品 */
export function tryEncodeQr(text: string, options: EncodeQrOptions = {}): QrCodeResult | null {
  try {
    return encodeQr(text, options);
  } catch (error) {
    if (error instanceof QrEncodeError) return null;
    throw error;
  }
}

export { QR_LIGHT_COLOR, renderQrSvg, renderQrSvgDataUrl } from './render-svg.js';
export type { QrGrid } from './patterns.js';
export type { MaskCandidate } from './mask.js';
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
