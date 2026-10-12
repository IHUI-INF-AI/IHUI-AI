// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Windows 子进程输出编码回退链(b75-4#4,机制出处:上游 outputEncoding.ts,降维适配)。
 *
 * 问题:沙箱子进程经重定向文件吐出的字节**不承诺是 UTF-8**。cmd/PowerShell 批处理里写死
 * `chcp 65001` 只改控制台码页,对「输出进了管道/文件」的原生程序无效 —— 它们按自身 CRT
 * locale(系统 ANSI/OEM 码页)编码,gb18030/cp932 等控制台下中文/日文输出必然乱码。
 *
 * 回退链(每级只在上一级判不了时才花钱):
 *   ① UTF-8 三态分析:valid(可整段按 utf-8 解)/ incomplete(尾部截了多字节序列,等下一块)
 *      / invalid(不是合法 UTF-8);
 *   ② 环境变量显式覆盖 IHUI_WINDOWS_OUTPUT_ENCODING(验证是本机可解码的标号);
 *   ③ chcp 探测(1s 硬超时,拿 OEM 码页 → cpXXX);
 *   ④ locale 推断(gb18030/cp932/cp949/cp866/cp437 —— chcp 都问不到时的最后兜底);
 *   ⑤ 解码出口统一走 WHATWG TextDecoder(仓内零新依赖;上游 iconv 的 cp437 不在
 *      WHATWG 标号表内,降维为"解不了就按 utf-8 replacement 吐出",由 canDecode 显式可判)。
 *
 * 流式面:createStreamDecoder 状态机 —— unknown 档攒 pending 直到能判定 utf-8/legacy,
 * 跨 chunk 被截断的多字节序列**不死锁也不误判**(incomplete ⇒ 继续等,invalid ⇒ 切 legacy)。
 * PYTHONUTF8/PYTHONIOENCODING patch(上游 C/POSIX 注入的降维)见 applyPythonUtf8Env。
 */

import { execFileSync } from 'node:child_process';
import { isSurrogateCodePoint } from '../../../utils/prompt-boundary.js';

/** 环境变量显式覆盖键(Windows 大小写不敏感读取) */
export const WINDOWS_OUTPUT_ENCODING_OVERRIDE_ENV = 'IHUI_WINDOWS_OUTPUT_ENCODING';

/** chcp 探测硬超时(上游同款 1s:探测是诊断手段,不许它变成新的挂起点) */
export const CHCP_PROBE_TIMEOUT_MS = 1_000;

/** locale → legacy 码页的推断表(上游五档全保留;cp437 经 canDecode 显式降级) */
export type WindowsLegacyEncoding = 'gb18030' | 'cp932' | 'cp949' | 'cp866' | 'cp437';

/** WHATWG TextDecoder 标号映射(cp437 无对应标号 ⇒ null = 解不了,如实可判) */
const LEGACY_DECODER_LABELS: Record<WindowsLegacyEncoding, string | null> = {
  gb18030: 'gb18030',
  cp932: 'shift_jis',
  cp949: 'euc-kr',
  cp866: 'cp866',
  cp437: null,
};

/** chcp 数字码页 → 五档 legacy(936/932/949/866/437 与 inferLegacyEncodingFromLocale 的五档一一对应)。 */
const CHCP_CODEPAGE_TO_LEGACY: Record<string, WindowsLegacyEncoding> = {
  '936': 'gb18030',
  '932': 'cp932',
  '949': 'cp949',
  '866': 'cp866',
  '437': 'cp437',
};

/** 本机能不能用内置解码器解这个标号(生产与测试共用的唯一判据,不在调用点各自 try/catch) */
export function canDecode(label: string | null): boolean {
  if (!label) return false;
  try {
    new TextDecoder(label);
    return true;
  } catch {
    return false;
  }
}

// ==================== ① UTF-8 三态分析 ====================

export interface Utf8BufferAnalysis {
  /** 出现过非 ASCII 字节(纯 ASCII 无论按什么码页解都一样,无需回退) */
  hasNonAscii: boolean;
  /** 尾部截了多字节序列(流式面:继续等下一块;整读面:按 incomplete 处置) */
  incomplete: boolean;
  /** 是否整段合法 UTF-8 */
  valid: boolean;
}

/**
 * 逐字节 UTF-8 结构分析(不建解码器、零拷贝)。
 * 领导字节分档 C2-DF/1 续、E0-EF/2 续、F0-F4/3 续,并校验码点过短/越界/代理区。
 */
export function analyzeUtf8Buffer(buffer: Buffer): Utf8BufferAnalysis {
  let hasNonAscii = false;
  let i = 0;
  while (i < buffer.length) {
    const lead = buffer[i]!;
    if (lead <= 0x7f) {
      i += 1;
      continue;
    }
    hasNonAscii = true;
    let needed: number;
    let minCodePoint: number;
    let codePoint: number;
    if (lead >= 0xc2 && lead <= 0xdf) {
      needed = 1;
      minCodePoint = 0x80;
      codePoint = lead & 0x1f;
    } else if (lead >= 0xe0 && lead <= 0xef) {
      needed = 2;
      minCodePoint = 0x800;
      codePoint = lead & 0x0f;
    } else if (lead >= 0xf0 && lead <= 0xf4) {
      needed = 3;
      minCodePoint = 0x10000;
      codePoint = lead & 0x07;
    } else {
      // 0x80-0xC1(过短编码)与 0xF5-0xFF(越界)都是确定的非法
      return { hasNonAscii, incomplete: false, valid: false };
    }
    if (i + needed >= buffer.length) {
      // 尾部序列跨了边界:已到位的续字节必须合法,合法 ⇒ incomplete(等下一块),非法 ⇒ 直接 invalid
      for (let o = 1; i + o < buffer.length; o += 1) {
        if ((buffer[i + o]! & 0xc0) !== 0x80) return { hasNonAscii, incomplete: false, valid: false };
      }
      return { hasNonAscii, incomplete: true, valid: true };
    }
    for (let o = 1; o <= needed; o += 1) {
      const cont = buffer[i + o]!;
      if ((cont & 0xc0) !== 0x80) return { hasNonAscii, incomplete: false, valid: false };
      codePoint = (codePoint << 6) | (cont & 0x3f);
    }
    if (codePoint < minCodePoint || codePoint > 0x10ffff || isSurrogateCodePoint(codePoint)) {
      return { hasNonAscii, incomplete: false, valid: false };
    }
    i += needed + 1;
  }
  return { hasNonAscii, incomplete: false, valid: true };
}

// ==================== legacy 标号解析(②→③→④ 回退链) ====================

/** env 大小写不敏感取值(Windows 的 env 键大小写不敏感,见上游 execution-command 同判据) */
function getEnvValue(env: NodeJS.ProcessEnv, key: string): string | undefined {
  const hit = Object.keys(env).find((k) => k.toLowerCase() === key.toLowerCase());
  return hit ? env[hit] : undefined;
}

/**
 * chcp 探测:返回**当前活动码页**对应的 legacy 标号;65001(UTF-8)/问不到 ⇒ null。
 * probe 注入面:测试不真派生 cmd;生产缺省走 execFileSync(1s 硬超时 + windowsHide)。
 */
export function readActiveCodePageEncoding(
  probe: ((comspec: string) => string | null) | null = defaultChcpProbe,
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  if (probe === null) return null;
  const comspec = getEnvValue(env, 'ComSpec') ?? 'cmd.exe';
  const output = probe(comspec);
  const codePage = output?.match(/(\d{3,5})/)?.[1];
  if (!codePage) return null;
  if (codePage === '65001') return null;
  // chcp 只报数字,WHATWG 标号表里没有 'cp936' 这种写法 —— 直接 canDecode('cp936') 恒 false,
  // 会把中文系统可解的 OEM 码页白白拒掉。先映射到五档标号再验可解性;未收录码页 ⇒ null 落 locale。
  const guessed = CHCP_CODEPAGE_TO_LEGACY[codePage];
  if (!guessed) return null;
  const label = LEGACY_DECODER_LABELS[guessed];
  return label !== null && canDecode(label) ? label : null;
}

function defaultChcpProbe(comspec: string): string | null {
  try {
    return execFileSync(comspec, ['/d', '/s', '/c', 'chcp'], {
      encoding: 'utf8',
      timeout: CHCP_PROBE_TIMEOUT_MS,
      windowsHide: true,
    });
  } catch {
    return null;
  }
}

/** 单段 locale 文本 → 五档 legacy;判不出 ⇒ null(由调用方决定落 cp437 默认)。 */
function classifyLocaleToLegacy(text: string): WindowsLegacyEncoding | null {
  if (/(zh|chinese|cn|hans|hant)/.test(text)) return 'gb18030';
  if (/(ja|japanese|jp)/.test(text)) return 'cp932';
  // ru 必须先于 ko 判:KOI8-R 是俄文码页,子串 'ko' 会把 ru_RU.KOI8-R 误判成韩文
  if (/(ru|russian)/.test(text)) return 'cp866';
  if (/(ko|korean|kr)/.test(text)) return 'cp949';
  return null;
}

/**
 * locale 推断(chcp 都问不到时的兜底):LC_ALL → LC_CTYPE → LANG → Intl locale 逐级找,
 * 中文系 gb18030 / 日文 cp932 / 韩文 cp949 / 俄文 cp866 / 其余 cp437。
 */
export function inferLegacyEncodingFromLocale(
  env: NodeJS.ProcessEnv = process.env,
  intlLocale: string = Intl.DateTimeFormat().resolvedOptions().locale,
): WindowsLegacyEncoding {
  // POSIX locale 优先级链逐级短评:LC_ALL → LC_CTYPE → LANG 任一已设,即以该级为准。
  // 旧写法把四级拼成一串再跑 zh 正则 —— 本机 Intl 是 zh 时,显式 LANG=ko_JP 会被压成
  // gb18030:显式 env 声明必须压过本机默认,否则推断结果与本机环境纠缠不清。
  for (const raw of [getEnvValue(env, 'LC_ALL'), getEnvValue(env, 'LC_CTYPE'), getEnvValue(env, 'LANG')]) {
    if (!raw) continue;
    return classifyLocaleToLegacy(raw.toLowerCase()) ?? 'cp437';
  }
  return classifyLocaleToLegacy(intlLocale.toLowerCase()) ?? 'cp437';
}

export interface LegacyEncodingResolution {
  /** null = 判定"不必回退"(UTF-8 码页/纯 ASCII);字符串 = WHATWG/内置可判的 legacy 标号 */
  encoding: string | null;
  /** 回退链走到哪一级(诊断与单测问责用) */
  source: 'override' | 'chcp' | 'locale' | 'none';
}

/** 组装完整回退链(②覆盖 → ③chcp → ④locale);chcpProbe 传 null 可跳过探测(测试/禁用) */
export function resolveLegacyEncoding(
  env: NodeJS.ProcessEnv = process.env,
  chcpProbe: ((comspec: string) => string | null) | null = defaultChcpProbe,
): LegacyEncodingResolution {
  const override = getEnvValue(env, WINDOWS_OUTPUT_ENCODING_OVERRIDE_ENV)?.trim();
  if (override) {
    const label = override.toLowerCase();
    if (canDecode(label)) return { encoding: label, source: 'override' };
  }
  const fromChcp = readActiveCodePageEncoding(chcpProbe, env);
  if (fromChcp) return { encoding: fromChcp, source: 'chcp' };
  const guessed = inferLegacyEncodingFromLocale(env);
  const label = LEGACY_DECODER_LABELS[guessed];
  if (label && canDecode(label)) return { encoding: label, source: 'locale' };
  return { encoding: null, source: 'none' };
}

// ==================== 解码出口(整读 + 流式状态机) ====================

/**
 * 整读面:一段完整输出按「UTF-8 valid 或纯 ASCII ⇒ utf-8;否则走 legacy 回退链」解码。
 * resolveLegacy 惰性注入:只有 buffer 真的判不出 UTF-8 时才花探测的钱(1s 上限)。
 */
export function decodeBufferWithFallback(
  buffer: Buffer,
  resolveLegacy: () => LegacyEncodingResolution,
): string {
  if (buffer.length === 0) return '';
  const analysis = analyzeUtf8Buffer(buffer);
  if (!analysis.hasNonAscii || (analysis.valid && !analysis.incomplete)) {
    return buffer.toString('utf8');
  }
  const legacy = resolveLegacy();
  if (legacy.encoding && canDecode(legacy.encoding)) {
    try {
      return new TextDecoder(legacy.encoding).decode(buffer);
    } catch {
      // 解码器摆了不肯解 ⇒ 落回 utf-8 replacement,不因诊断路径二次抛错
    }
  }
  return buffer.toString('utf8');
}

/**
 * 流式面:unknown → utf8/legacy 三态状态机,pending 缓冲跨 chunk 截断的多字节序列。
 *   - unknown 档:攒 pending,valid+非 ASCII ⇒ 锁 utf8;invalid ⇒ 锁 legacy(整段 pending 交给它);
 *     纯 ASCII ⇒ 直接出文本,档位不动(下一个 chunk 再判 —— 上游同款:判据开销摊到真需要时);
 *     incomplete ⇒ 继续 pending,既不死锁也不误判;
 *   - end():终态冲刷,unknown 档残留按「legacy 可判且 invalid/incomplete ⇒ legacy,否则 utf-8」处置。
 */
export interface ExecutionOutputStreamDecoder {
  write(chunk: Buffer): string;
  end(): string;
}

export function createStreamDecoder(
  resolveLegacy: () => LegacyEncodingResolution,
  legacyEncoding: string | null = null,
): ExecutionOutputStreamDecoder {
  let mode: 'unknown' | 'utf8' | 'legacy' = 'unknown';
  let pending: Buffer = Buffer.alloc(0);
  const utf8Decoder = new TextDecoder('utf-8');
  let legacyDecoder: TextDecoder | null = null;

  const legacyForStream = (): TextDecoder | null => {
    if (legacyDecoder) return legacyDecoder;
    const label = legacyEncoding ?? resolveLegacy().encoding;
    legacyDecoder = label && canDecode(label) ? new TextDecoder(label) : null;
    return legacyDecoder;
  };

  return {
    write(chunk: Buffer): string {
      if (mode === 'utf8') return utf8Decoder.decode(chunk, { stream: true });
      if (mode === 'legacy') return legacyForStream()?.decode(chunk, { stream: true }) ?? chunk.toString('utf8');

      const combined = pending.length > 0 ? Buffer.concat([pending, chunk]) : chunk;
      const analysis = analyzeUtf8Buffer(combined);
      if (!analysis.valid) {
        mode = 'legacy';
        pending = Buffer.alloc(0);
        return legacyForStream()?.decode(combined) ?? combined.toString('utf8');
      }
      if (analysis.incomplete) {
        pending = combined;
        return '';
      }
      pending = Buffer.alloc(0);
      if (analysis.hasNonAscii) {
        mode = 'utf8';
        return utf8Decoder.decode(combined, { stream: true });
      }
      return combined.toString('utf8');
    },
    end(): string {
      let tail = '';
      if (mode === 'utf8') {
        tail = utf8Decoder.decode();
      } else if (mode === 'legacy') {
        tail = legacyForStream()?.decode() ?? '';
      } else if (pending.length > 0) {
        const analysis = analyzeUtf8Buffer(pending);
        const legacy = legacyForStream();
        if (!analysis.valid || analysis.incomplete) {
          tail = legacy?.decode(pending) ?? pending.toString('utf8');
        } else {
          tail = pending.toString('utf8');
        }
        pending = Buffer.alloc(0);
      }
      return tail;
    },
  };
}

// ==================== 子进程 env 的 UTF-8 倾向 patch ====================

/**
 * 上游 applyExecutionTextEnv 的降维:C/POSIX locale 的 Python 子进程在 Windows 上
 * 默认按 ANSI 码页写 stdout ⇒ 注入 PYTHONUTF8/PYTHONIOENCODING 让 Python 系工具直接吐 UTF-8
 * (Python 吐得出 UTF-8,回退链就不必花钱)。只 patch Python 系,不改写其余 env。
 */
export function applyPythonUtf8Env(env: Record<string, string>): void {
  env['PYTHONUTF8'] = '1';
  env['PYTHONIOENCODING'] = 'utf-8';
}