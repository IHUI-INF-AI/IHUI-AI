// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 自写 QR 编码器的真值用例(goal-b49 / Z6)。
 *
 * 这把牙分四层,缺一不可:
 *   ① 真值矩阵:三枚「已知输入 → 已知模块矩阵」夹具**逐行等值**(不是断言长度)。
 *      夹具的独立来历:与仓内已装的参照编码器 qrcode@1.5.4(apps/api 的既有依赖,本票**没有**
 *      给 CLI 加依赖)在强制 byte 段下逐掩码 0–7 比对得 64/64 全等,并由参照解码器
 *      qrcode-reader@1.0.4 把自写矩阵渲染成位图后回读原文 8/8 命中
 *      (取证件 .ihui-agent/tmp/rea-goal-b49/z6-qr-oracle.mjs,仓外件、不进提交链)。
 *   ② 标准公布值:RS 生成多项式(degree 10 / 26)的 α 指数形态与 ISO/IEC 18004 Annex A 逐位等值。
 *   ③ 结构自证:每块码字多项式被生成多项式整除(校验子全 0)+ 数据区格数 == 8 × 总码字 + 余数比特
 *      + M 档容量表逐版本等值 —— 这几条都不依赖任何外部库。
 *   ④ 失败方向:空串 / 超容量 / 非法版本 ⇒ 具名拒绝且不产出半成品(§0.3「没判」不写成「判过」)。
 */

import { describe, expect, it } from 'vitest';
import { encodeQr, QrEncodeError, tryEncodeQr } from '../src/qr/index.js';
import { pickMinimumVersion, QR_MAX_VERSION, VERSION_SPECS, type VersionSpec, versionSpec } from '../src/qr/tables.js';
import {
  buildBaseGrid,
  darkModuleCount,
  dataRegionModuleCount,
  formatBitPositions,
  formatInformationBits,
  moduleAt,
  type QrGrid,
} from '../src/qr/patterns.js';
import { maskedSymbol, penaltyScore, scoreMaskCandidates, selectMaskPattern } from '../src/qr/mask.js';
import { buildDataCodewords, splitIntoBlocks, toUtf8Bytes } from '../src/qr/encode-data.js';
import { gfMultiply, gfPow, gfTables, rsGeneratorPolynomial, rsSyndromes } from '../src/qr/gf256.js';
import { darkModuleRuns, renderQrSvg, renderQrSvgDataUrl, svgModuleExtent } from '../src/qr/render-svg.js';

function specAt(version: number): VersionSpec {
  const spec = versionSpec(version);
  if (!spec) throw new Error(`夹具里的版本号越界:${version}`);
  return spec;
}

/** 矩阵摊平成行串(夹具与实测都按这个形态比) */
function matrixRows(grid: QrGrid): string[] {
  const rows: string[] = [];
  for (let y = 0; y < grid.size; y += 1) {
    let row = '';
    for (let x = 0; x < grid.size; x += 1) row += grid.modules[y * grid.size + x] ? '1' : '0';
    rows.push(row);
  }
  return rows;
}

const FIXTURES: ReadonlyArray<{ input: string; version: number; maskPattern: number; rows: string[] }> = [
  {
    input: 'A',
    version: 1,
    maskPattern: 3,
    rows: [
      '111111101001001111111',
      '100000101111101000001',
      '101110100010101011101',
      '101110101101101011101',
      '101110100111001011101',
      '100000100101101000001',
      '111111101010101111111',
      '000000001101100000000',
      '101101110011101001011',
      '010110010101111001000',
      '110011101101000001101',
      '101101000001001111100',
      '100111100100100100100',
      '000000001011001001001',
      '111111101001100101000',
      '100000101100000110110',
      '101110100110111110001',
      '101110101111001111110',
      '101110101010101100000',
      '100000100010010100101',
      '111111101000010010000',
    ],
  },
  {
    input: 'https://aizhs.top',
    version: 2,
    maskPattern: 2,
    rows: [
      '1111111000111101001111111',
      '1000001000011111001000001',
      '1011101010110101001011101',
      '1011101010011011101011101',
      '1011101011111000101011101',
      '1000001010101001101000001',
      '1111111010101010101111111',
      '0000000010010010100000000',
      '1011111001110000001111100',
      '0010100110001110100100010',
      '1111001001010111000101011',
      '1101000100000101111000001',
      '0011111000111011111010111',
      '1010110010000000110101010',
      '1011101110011001000111011',
      '1010000101010010100110001',
      '1011111100010000111110100',
      '0000000011001111100011000',
      '1111111000000110101010111',
      '1000001010101101100011011',
      '1011101011101011111110101',
      '1011101011000000111011111',
      '1011101010111001000001101',
      '1000001001110010100111001',
      '1111111011110000001111111',
    ],
  },
  {
    input: '断网可读会话快照 · 中文载荷',
    version: 3,
    maskPattern: 2,
    rows: [
      '11111110001001100010001111111',
      '10000010001100101001101000001',
      '10111010101101111101101011101',
      '10111010110011101110001011101',
      '10111010111111000011101011101',
      '10000010101100000101101000001',
      '11111110101010101010101111111',
      '00000000110001010001000000000',
      '10111110001110000111001111100',
      '11100000000011001011011101011',
      '10111110101110101011100101101',
      '00010001010011101111110000100',
      '10010011010011010001111101101',
      '10101100111110110011001001111',
      '10100110001101100111101101011',
      '10100001010100101110110100111',
      '01101111000000011110011001000',
      '11011000000111010001100000000',
      '10001110111001100101111011011',
      '10100000101111001000111001111',
      '10011110011100110111111110100',
      '00000000101110001011100011011',
      '11111110011000001010101011001',
      '10000010111010111110100010110',
      '10111010100010000101111110011',
      '10111010101011100011101001111',
      '10111010110000000001111101110',
      '10000010010100010110111100110',
      '11111110111011001110110100100',
    ],
  },
];

/** ISO/IEC 18004 Annex A 公布的生成多项式 α 指数形态(度数 10 与 26 两行) */
const PUBLISHED_GENERATORS: Readonly<Record<number, readonly number[]>> = {
  10: [0, 251, 67, 46, 61, 118, 70, 64, 94, 32, 45],
  26: [0, 173, 125, 158, 2, 103, 182, 118, 17, 145, 201, 111, 28, 165, 53, 161, 21, 245, 142, 13, 102, 48, 227, 153, 145, 218, 70],
};

describe('① 真值矩阵:已知输入 → 已知模块矩阵,逐行等值', () => {
  for (const fixture of FIXTURES) {
    it(`${fixture.input} ⇒ v${fixture.version}/mask${fixture.maskPattern} 全矩阵逐行等值`, () => {
      const result = encodeQr(fixture.input);
      expect(result.version).toBe(fixture.version);
      expect(result.maskPattern).toBe(fixture.maskPattern);
      const rows = matrixRows(result.grid);
      expect(rows.length).toBe(fixture.rows.length);
      rows.forEach((row, index) => {
        expect(row).toBe(fixture.rows[index] ?? `<夹具缺第 ${index} 行>`);
      });
    });
  }

  it('夹具不是「跑出来就是这样」的自证:同一输入在掩码 0–7 下是七张以上互不相同的图', () => {
    const base = buildBaseGrid(specAt(1));
    const words = encodeQr('A').codewords;
    const perMask = new Set(
      Array.from({ length: 8 }, (_, mask) => matrixRows(maskedSymbol(base, words, mask)).join('\n')),
    );
    expect(perMask.size).toBe(8);
  });
});

describe('② 标准公布值与代数结构', () => {
  it('RS 生成多项式的 α 指数形态逐位等于 ISO Annex A 公布行(度数 10 / 26)', () => {
    const { log } = gfTables();
    for (const [degreeText, expected] of Object.entries(PUBLISHED_GENERATORS)) {
      const degree = Number(degreeText);
      const poly = rsGeneratorPolynomial(degree);
      expect(poly.length).toBe(degree + 1);
      expect(poly[0]).toBe(1);
      const exponents = Array.from(poly).map((value) => (value === 0 ? -1 : log[value] ?? -1));
      expect(exponents).toEqual([...expected]);
    }
  });

  it('每块码字多项式都被生成多项式整除:校验子全 0(版本 1–10 全覆盖)', () => {
    for (const spec of VERSION_SPECS) {
      const blocks = splitIntoBlocks(buildDataCodewords(toUtf8Bytes('u'.repeat(spec.byteCapacity)), spec), spec);
      expect(blocks.length).toBe(spec.group1Blocks + spec.group2Blocks);
      for (const block of blocks) {
        const codeword = new Uint8Array([...block.data, ...block.ecc]);
        expect(codeword.length).toBe(block.data.length + spec.ecCodewordsPerBlock);
        expect(rsSyndromes(codeword, spec.ecCodewordsPerBlock).every((s) => s === 0)).toBe(true);
      }
    }
  });

  it('数据区格数:够放全部码字位、且余量不足一字节(v1–v6 另按手算值逐版本钉死)', () => {
    // 逐版本手算(v1:441 − 3×64 定位+分隔符 − 10 定时 − 31 格式信息 = 208 = 8×26)
    const handDerived: Readonly<Record<number, number>> = { 1: 208, 2: 359, 3: 567, 4: 807, 5: 1079, 6: 1383 };
    for (const spec of VERSION_SPECS) {
      const grid = buildBaseGrid(spec);
      expect(grid.size).toBe(4 * spec.version + 17);
      const free = dataRegionModuleCount(grid);
      const needed = spec.totalCodewords * 8;
      expect(free).toBeGreaterThanOrEqual(needed); // 一位码字都不许没处放
      expect(free - needed).toBeLessThan(8); // 多出来的是标准的「余数比特」,不足一字节
      const byHand = handDerived[spec.version];
      if (byHand !== undefined) expect(free).toBe(byHand);
    }
  });

  it('M 档 byte 容量表逐版本等值,选版本取「能装下的最小档」', () => {
    expect(VERSION_SPECS.map((s) => s.byteCapacity)).toEqual([14, 26, 42, 62, 84, 106, 122, 152, 180, 213]);
    expect(pickMinimumVersion(14)?.version).toBe(1);
    expect(pickMinimumVersion(15)?.version).toBe(2);
    expect(pickMinimumVersion(213)?.version).toBe(QR_MAX_VERSION);
    expect(pickMinimumVersion(214)).toBeUndefined();
    expect(pickMinimumVersion(-1)).toBeUndefined();
  });

  it('GF(256):乘法单位元、α^0 = 1(全 255 个非零元素都走一遍)', () => {
    for (let a = 1; a < 256; a += 1) {
      expect(gfMultiply(a, 1)).toBe(a);
      expect(gfMultiply(0, a)).toBe(0);
    }
    expect(gfPow(0)).toBe(1);
    expect(gfPow(255)).toBe(1);
  });

  it('格式信息:M 档 mask 0 == 101010000010010,且写位序与读位序不漂移', () => {
    expect(formatInformationBits(0)).toBe(0b101010000010010);
    for (let mask = 0; mask <= 7; mask += 1) {
      const data = (formatInformationBits(mask) ^ 0x5412) >>> 10;
      expect(data & 0b111).toBe(mask);
      expect((data >>> 3) & 0b11).toBe(0b00); // 00 = M 档
    }
    const grid = maskedSymbol(buildBaseGrid(specAt(2)), buildDataCodewords(toUtf8Bytes('ab'), specAt(2)), 5);
    const bits = formatInformationBits(5);
    const slots = formatBitPositions(grid.size);
    expect(slots.length).toBe(30); // 15 位 × 两副本(按位序交错:第 i 位 = slots[2i] 与 slots[2i+1])
    for (let i = 0; i < 15; i += 1) {
      const expected = ((bits >>> i) & 1) === 1 ? 1 : 0;
      const first = slots[2 * i] ?? [0, 0];
      const second = slots[2 * i + 1] ?? [0, 0];
      expect(moduleAt(grid, first[0], first[1])).toBe(expected);
      expect(moduleAt(grid, second[0], second[1])).toBe(expected);
    }
  });

  it('暗模块恒在 (x=8, y=size-8);三枚定位图形中心行是 1:1:3:1:1,内侧一圈分隔符为浅', () => {
    for (const spec of VERSION_SPECS) {
      const grid = buildBaseGrid(spec);
      expect(moduleAt(grid, 8, spec.size - 8)).toBe(1);
      const finders: ReadonlyArray<readonly [number, number, number]> = [
        [3, 3, 1], // [中心 x, 中心 y, 分隔符方向(朝内)]
        [spec.size - 4, 3, -1],
        [3, spec.size - 4, 1],
      ];
      for (const [cx, cy, inward] of finders) {
        // 过中心的整行:7 枚模块应是 深-浅-深-深-深-浅-深(标准定位图形的 1:1:3:1:1)
        const row = [];
        for (let dx = -3; dx <= 3; dx += 1) row.push(moduleAt(grid, cx + dx, cy));
        expect(row).toEqual([1, 0, 1, 1, 1, 0, 1]);
        expect(moduleAt(grid, cx + 4 * inward, cy)).toBe(0); // 分隔符
      }
    }
  });

  it('掩码评分:8 个候选都出分,选中的就是最低分;同分取掩码号小者;空候选集判未判定', () => {
    const spec = specAt(2);
    const base = buildBaseGrid(spec);
    const words = encodeQr('https://aizhs.top').codewords;
    const candidates = scoreMaskCandidates(base, words);
    expect(candidates.map((c) => c.maskPattern)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    for (const candidate of candidates) {
      expect(candidate.penalty).toBe(penaltyScore(maskedSymbol(base, words, candidate.maskPattern)));
    }
    expect(selectMaskPattern(candidates)).toBe(encodeQr('https://aizhs.top').maskPattern);
    expect(
      selectMaskPattern([
        { maskPattern: 3, penalty: 7 },
        { maskPattern: 1, penalty: 7 },
        { maskPattern: 6, penalty: 9 },
      ]),
    ).toBe(1);
    expect(() => selectMaskPattern([])).toThrow(RangeError);
  });
});

describe('③ 渲染形态:零外链 + 静区 + 两种形态同源', () => {
  it('SVG 不含 script / img / link / url() / @import / 事件属性', () => {
    const result = encodeQr('file:///G:/IHUI-AI/.ihui-agent/shared/abcd1234.html');
    const svg = renderQrSvg(result.grid, { label: '快照二维码' });
    for (const banned of ['<script', '<img', '<link ', 'url(', '@import', 'onclick', 'onload', 'href']) {
      expect(svg, `SVG 不应含 ${banned}`).not.toContain(banned);
    }
    expect(svg).toContain('shape-rendering="crispEdges"');
    expect(svg).toContain('aria-label="快照二维码"');
    expect(svgModuleExtent(result.grid)).toBe(result.grid.size + 8); // 静区 4 模块 × 两侧
    expect(darkModuleRuns(result.grid).length).toBeGreaterThan(0);
    expect(darkModuleCount(result.grid)).toBeGreaterThan(0);
  });

  it('data URL 形态:前缀正确、纯 ASCII、补 standalone 需要的 xmlns', () => {
    const grid = encodeQr('https://aizhs.top/s/z6').grid;
    const dataUrl = renderQrSvgDataUrl(grid);
    expect(dataUrl.startsWith('data:image/svg+xml,')).toBe(true);
    expect(dataUrl).toMatch(/^[\x20-\x7e]+$/);
    expect(dataUrl).toContain('xmlns%3D');
    // 解回来必须与 standalone 形态的内联 SVG 逐字节同一张图(两形态不各画一张)
    expect(decodeURIComponent(dataUrl.slice('data:image/svg+xml,'.length))).toBe(
      renderQrSvg(grid, { standalone: true }),
    );
  });

  it('同一枚矩阵两种形态行程数一致(内联与 data URL 同源)', () => {
    const grid = encodeQr('https://aizhs.top/s/z6').grid;
    const inline = renderQrSvg(grid);
    const viaData = renderQrSvg(encodeQr('https://aizhs.top/s/z6').grid, { standalone: true });
    const subpaths = (value: string) => (value.match(/M\d+ \d+h\d+v1h-\d+z/g) ?? []).length;
    expect(subpaths(viaData)).toBe(subpaths(inline));
    expect(subpaths(inline)).toBe(darkModuleRuns(grid).length); // 行程数 == 子路径数(每行连续深段一条)
  });
});

describe('④ 失败方向:具名拒绝,不产出半成品', () => {
  it('空串输入 ⇒ reason=empty-input,不落任何图形', () => {
    expect(() => encodeQr('')).toThrow(QrEncodeError);
    try {
      encodeQr('');
      expect.unreachable('空输入必须抛具名错误');
    } catch (error) {
      expect((error as QrEncodeError).reason).toBe('empty-input');
    }
    expect(tryEncodeQr('')).toBeNull();
    expect(tryEncodeQr('A')).not.toBeNull();
  });

  it('容量溢出 ⇒ reason=too-long(213 通过 / 214 拒绝),拒绝时不返回残缺矩阵', () => {
    expect(encodeQr('y'.repeat(213)).version).toBe(QR_MAX_VERSION);
    try {
      encodeQr('y'.repeat(214));
      expect.unreachable('超容量必须抛具名错误');
    } catch (error) {
      const e = error as QrEncodeError;
      expect(e.reason).toBe('too-long');
      expect(e.byteLength).toBe(214);
      expect(e.capacity).toBe(213);
    }
    expect(tryEncodeQr('y'.repeat(500))).toBeNull();
  });

  it('指定版本装不下 ⇒ too-long;非法版本 ⇒ unsupported-version', () => {
    try {
      encodeQr('https://aizhs.top', { version: 1 });
      expect.unreachable('v1 装不下 17 字节');
    } catch (error) {
      expect((error as QrEncodeError).reason).toBe('too-long');
    }
    for (const bad of [0, 11, 40]) {
      try {
        encodeQr('A', { version: bad });
        expect.unreachable(`版本 ${bad} 必须被拒`);
      } catch (error) {
        expect((error as QrEncodeError).reason).toBe('unsupported-version');
      }
    }
  });

  it('码字流长度对账:每版本实得 == 该版本总码字数', () => {
    for (const spec of VERSION_SPECS) {
      const result = encodeQr('q'.repeat(Math.min(14, spec.byteCapacity)), { version: spec.version });
      expect(result.codewords.length).toBe(spec.totalCodewords);
    }
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
