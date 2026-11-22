// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * b75-4#4:Windows 子进程输出编码回退链测试。
 *
 * 票面验收对号:
 *   - gb18030 中文正确解码(真 TextDecoder + 已知字节向量,不是假桩);
 *   - chcp 不可用按 locale 回退(probe 注入 null/抛错);
 *   - 跨 chunk 截断多字节不死锁(流式状态机 + 分刀字节向量)。
 * 全部注入面(不派生真实 cmd、不依赖真机码页);真解码用 WHATWG TextDecoder 真向量。
 */
import { describe, expect, it } from 'vitest';
import {
  analyzeUtf8Buffer,
  applyPythonUtf8Env,
  canDecode,
  createStreamDecoder,
  decodeBufferWithFallback,
  inferLegacyEncodingFromLocale,
  readActiveCodePageEncoding,
  resolveLegacyEncoding,
  WINDOWS_OUTPUT_ENCODING_OVERRIDE_ENV,
  type LegacyEncodingResolution,
} from '../src/tools/sandbox/platform/output-encoding.js';

const fixedLegacy = (encoding: string | null): () => LegacyEncodingResolution => () => ({ encoding, source: 'override' });

describe('① UTF-8 三态分析(analyzeUtf8Buffer)', () => {
  it('纯 ASCII ⇒ hasNonAscii=false 且 valid(无需回退,零成本)', () => {
    expect(analyzeUtf8Buffer(Buffer.from('plain ascii 123'))).toEqual({
      hasNonAscii: false,
      incomplete: false,
      valid: true,
    });
  });

  it('合法中文 ⇒ hasNonAscii=true 且 valid(锁 utf-8 档)', () => {
    expect(analyzeUtf8Buffer(Buffer.from('中文输出', 'utf8'))).toEqual({
      hasNonAscii: true,
      incomplete: false,
      valid: true,
    });
  });

  it('尾部截了多字节 ⇒ incomplete(流式面继续等下一块,不死锁也不误判)', () => {
    const full = Buffer.from('汉', 'utf8'); // E6 B1 89
    expect(analyzeUtf8Buffer(full.subarray(0, 2))).toEqual({ hasNonAscii: true, incomplete: true, valid: true });
  });

  it('裸 0xFF/0xFE ⇒ invalid(切 legacy)', () => {
    const a = analyzeUtf8Buffer(Buffer.from([0xff, 0xfe, 0x41]));
    expect(a.valid).toBe(false);
    expect(a.incomplete).toBe(false);
  });

  it('过短编码(C0/C1)、码点越界(F5+)、代理区、码点过短 ⇒ 全部 invalid', () => {
    expect(analyzeUtf8Buffer(Buffer.from([0xc0, 0x80])).valid).toBe(false); // 过短编码
    expect(analyzeUtf8Buffer(Buffer.from([0xf5, 0x80, 0x80, 0x80])).valid).toBe(false); // > U+10FFFF
    expect(analyzeUtf8Buffer(Buffer.from([0xed, 0xa0, 0x80])).valid).toBe(false); // U+D800 代理区
    expect(analyzeUtf8Buffer(Buffer.from([0xe0, 0x80, 0x80])).valid).toBe(false); // 码点 < 0x800
  });

  it('incomplete 里混非法续字节 ⇒ 直接 invalid(不是等下一块)', () => {
    const full = Buffer.from('汉', 'utf8'); // E6 B1 89
    const torn = Buffer.concat([full.subarray(0, 1), Buffer.from([0x41])]); // E6 41
    const a = analyzeUtf8Buffer(torn);
    expect(a.valid).toBe(false);
    expect(a.incomplete).toBe(false);
  });
});

describe('② 覆盖 → ③ chcp → ④ locale 回退链', () => {
  it('canDecode:gb18030 可解;cp437 不在 WHATWG 标号表 ⇒ 显式 false(降级可判,不静默)', () => {
    expect(canDecode('gb18030')).toBe(true);
    expect(canDecode('cp437')).toBe(false);
    expect(canDecode(null)).toBe(false);
  });

  it('覆盖键优先:IHUI_WINDOWS_OUTPUT_ENCODING 可解 ⇒ source=override', () => {
    expect(resolveLegacyEncoding({ [WINDOWS_OUTPUT_ENCODING_OVERRIDE_ENV]: 'gb18030' }, null)).toEqual({
      encoding: 'gb18030',
      source: 'override',
    });
  });

  it('覆盖值解不了 ⇒ 落到 chcp 级,不把坏值当结论', () => {
    expect(resolveLegacyEncoding({ [WINDOWS_OUTPUT_ENCODING_OVERRIDE_ENV]: 'not-a-codepage' }, () => 'Active code page: 936')).toEqual({
      encoding: 'gb18030',
      source: 'chcp',
    });
  });

  it('chcp 936 ⇒ gb18030;chcp 65001(UTF-8)⇒ null ⇒ 落 locale', () => {
    expect(readActiveCodePageEncoding(() => 'Active code page: 936')).toBe('gb18030');
    expect(readActiveCodePageEncoding(() => 'Active code page: 65001')).toBeNull();
    expect(resolveLegacyEncoding({ LC_ALL: 'zh_CN.UTF-8' }, () => 'Active code page: 65001')).toEqual({
      encoding: 'gb18030',
      source: 'locale',
    });
  });

  it('chcp 不可用(probe null)⇒ locale 推断五档(zh/ja/ko/ru/其余)', () => {
    expect(readActiveCodePageEncoding(() => null)).toBeNull();
    expect(inferLegacyEncodingFromLocale({ LANG: 'zh_CN.GBK' })).toBe('gb18030');
    expect(inferLegacyEncodingFromLocale({ LC_ALL: 'ja_JP.UTF-8' })).toBe('cp932');
    expect(inferLegacyEncodingFromLocale({ LANG: 'ko_KR.EUC' })).toBe('cp949');
    expect(inferLegacyEncodingFromLocale({ LANG: 'ru_RU.KOI8-R' })).toBe('cp866');
    expect(inferLegacyEncodingFromLocale({ LANG: 'en_US.UTF-8' })).toBe('cp437');
    // cp932 在 WHATWG 里叫 shift_jis:解码标号映射要跟着换,不能拿 cp932 去撞解码器
    expect(resolveLegacyEncoding({ LANG: 'ja_JP.UTF-8' }, null)).toEqual({ encoding: 'shift_jis', source: 'locale' });
  });

  it('env 全空兜底到 Intl locale;显式 env 判到 cp437(无 WHATWG 标号)⇒ source=none(不假装修出编码)', () => {
    expect(inferLegacyEncodingFromLocale({}, 'zh-Hans-CN')).toBe('gb18030');
    // resolveLegacyEncoding 内部以默认参数取本机 Intl locale,注入不了 —— 要触发 none
    // 必须给显式 env:en_US 判到 cp437 ⇒ 标号表无对应 ⇒ 如实报 none,不冒充解得动
    expect(resolveLegacyEncoding({ LC_ALL: 'en_US.UTF-8' }, null)).toEqual({ encoding: null, source: 'none' });
  });
});

describe('解码出口(整读 + 流式状态机)', () => {
  it('整读:合法 UTF-8 中文原样直出(不花探测的钱);gb18030 字节经回退链正确解码', () => {
    expect(decodeBufferWithFallback(Buffer.from('中文', 'utf8'), fixedLegacy('gb18030'))).toBe('中文');
    const gbBytes = Buffer.from([0xd6, 0xd0, 0xce, 0xc4]); // "中文" 的 gb18030 编码
    expect(decodeBufferWithFallback(gbBytes, fixedLegacy('gb18030'))).toBe('中文');
  });

  it('整读:legacy 判不出(cp437 无标号)⇒ utf-8 replacement 兜底,不抛错', () => {
    const gbBytes = Buffer.from([0xd6, 0xd0, 0xce, 0xc4]);
    const out = decodeBufferWithFallback(gbBytes, fixedLegacy('cp437'));
    expect(out).toContain('\uFFFD');
  });

  it('流式:跨 chunk 截断的多字节序列不死锁也不误判(把"汉A"切三刀)', () => {
    const full = Buffer.from('汉A', 'utf8'); // E6 B1 89 41
    const dec = createStreamDecoder(fixedLegacy('gb18030'));
    let out = '';
    out += dec.write(full.subarray(0, 1)); // E6 → incomplete ⇒ ''(继续等)
    out += dec.write(full.subarray(1, 3)); // B1 89 → 凑齐"汉";41 尾随 ASCII
    out += dec.write(full.subarray(3));
    out += dec.end();
    expect(out).toBe('汉A');
  });

  it('流式:整段非法字节切 legacy 后,后续 chunk 按 legacy 解码(gb18030 "测试")', () => {
    const dec = createStreamDecoder(fixedLegacy('gb18030'));
    let out = dec.write(Buffer.from([0xb2, 0xe2])); // "测" 的 gb18030;0xB2 在 UTF-8 是过短编码 ⇒ invalid → legacy
    expect(out).toBe('测');
    out += dec.write(Buffer.from([0xca, 0xd4])); // "试" 的 gb18030
    out += dec.end();
    expect(out).toBe('测试');
  });

  it('流式 end:legacy 档残留按 legacy 冲刷,坏字节给 replacement(不二次抛错)', () => {
    const dec = createStreamDecoder(fixedLegacy('gb18030'));
    let out = dec.write(Buffer.from([0xff])); // 非法 ⇒ legacy 档
    out += dec.write(Buffer.from([0xce, 0xc4])); // gb18030 "文"
    out += dec.end();
    expect(out).toBe('\uFFFD文');
  });

  it('流式纯 ASCII:直接出文本且档位不动(判据开销摊到真需要时)', () => {
    const dec = createStreamDecoder(fixedLegacy('gb18030'));
    expect(dec.write(Buffer.from('ok '))).toBe('ok ');
    expect(dec.write(Buffer.from('good'))).toBe('good');
    expect(dec.end()).toBe('');
  });
});

describe('PYTHONUTF8 patch(applyPythonUtf8Env)', () => {
  it('注入 PYTHONUTF8=1 与 PYTHONIOENCODING=utf-8,不改写其余键', () => {
    const env: Record<string, string> = { PATH: 'x', PYTHONIOENCODING: 'gbk' };
    applyPythonUtf8Env(env);
    expect(env).toEqual({ PATH: 'x', PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8' });
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
