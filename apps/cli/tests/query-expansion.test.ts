// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 记忆检索前置层 —— 查询扩展(`src/memory/query-expansion.ts`)行为测试 · 第 3 波覆盖面补测·簇 2 之一。
 *
 * 该模块此前**没有任何测试引用**(直调 `extractKeywords` / `isAllStopWords` 的用例数为 0),
 * 而它的输出直接决定 hybrid-search 走"关键词通道"还是"原文回退",是检索质量的分派开关。
 *
 * 钉住的契约:
 *  - 英文按非字母数字切、中文按 2-gram 切(无分词器时的 fallback);
 *  - 停用词(英文 40 词表 + 中文单字表)、纯数字、单字符英文三类 token 一律剔除;
 *  - 结果小写化、保序、去重;
 *  - `isAllStopWords` 对空串/纯停用词为 true(驱动回退),对含有效词为 false。
 */

import { describe, it, expect } from 'vitest';

import { extractKeywords, isAllStopWords } from '../src/memory/query-expansion.js';

describe('extractKeywords — 英文侧', () => {
  it('剔除停用词、保留实义词并小写化', () => {
    expect(extractKeywords('The Quick brown Fox')).toEqual(['quick', 'brown', 'fox']);
  });

  it('标点与连字符都算分隔符(不得把整句当一个 token)', () => {
    expect(extractKeywords('build,test;run')).toEqual(['build', 'test', 'run']);
  });

  it('纯数字 token 被剔除(版本号/错误码不进关键词)', () => {
    expect(extractKeywords('fix 404 error 2.5')).toEqual(['fix', 'error']);
  });

  it('单字符英文 token 被剔除,两字符保留', () => {
    expect(extractKeywords('a b go')).toEqual(['go']);
  });

  it('重复 token 去重且保留首次出现顺序', () => {
    expect(extractKeywords('code test code alpha test')).toEqual(['code', 'test', 'alpha']);
  });

  it('全停用词与空串都得到空数组(交由 isAllStopWords 决定回退)', () => {
    expect(extractKeywords('the is of this')).toEqual([]);
    expect(extractKeywords('')).toEqual([]);
  });
});

describe('extractKeywords — 中文侧 2-gram', () => {
  it('连续中文按 2-gram 滑窗切分', () => {
    expect(extractKeywords('积分商城')).toEqual(['积分', '分商', '商城']);
  });

  it('中英混排两侧都取到 token(分词器先出英文段再出中文 2-gram,顺序即契约)', () => {
    expect(extractKeywords('查询积分 score 42')).toEqual(['score', '查询', '询积', '积分']);
  });

  it('中文单字停用词只在被非中文隔开时才生效(连续中文走 2-gram)', () => {
    expect(extractKeywords('的 了 是')).toEqual([]);
    expect(extractKeywords('猫')).toEqual(['猫']);
    /**
     * 现状钉:连续中文「的了是」被切成 2-gram `的了/了是`,这两个 token
     * 都不在单字停用词表里 ⇒ 照样当关键词用。停用词表对 2-gram 通道无效,
     * 是这条 fallback 的既有分叉;若将来补 2-gram 停用词,此用例应改为正确断言。
     */
    expect(extractKeywords('的了是')).toEqual(['的了', '了是']);
  });

  it('中文与数字粘连时数字不污染中文 token(积分200元)', () => {
    expect(extractKeywords('积分200元')).toEqual(['积分', '元']);
  });

  it('跨标点不拼接成词(逗号把中文切成两段 2-gram)', () => {
    expect(extractKeywords('积分，商城')).toEqual(['积分', '商城']);
  });
});

describe('isAllStopWords — 检索回退开关', () => {
  it.each(['the a is', 'of the to', '', '   ', '的 了 是'])('真:全部命中停用词表 %j', (q) => {
    expect(isAllStopWords(q)).toBe(true);
  });

  it.each(['积分', 'quick', '404', 'a 猫', '的了是'])('假:含至少一个非停用词 token %j', (q) => {
    expect(isAllStopWords(q)).toBe(false);
  });

  /**
   * 两个出口的口径并不等价(现状钉):`isAllStopWords` 只看停用词表,
   * `extractKeywords` 还额外剔纯数字与单字符英文 —— 所以"关键词为空"
   * 不等于"全停用词",回退分支若只认前者会漏掉 `404` / `a b` 这类无信息量查询。
   */
  it('isAllStopWords 真 ⇒ 关键词必空;反向不成立', () => {
    for (const q of ['the is of', '的 了 是', '']) {
      expect(isAllStopWords(q)).toBe(true);
      expect(extractKeywords(q)).toEqual([]);
    }
    for (const q of ['404', 'a b']) {
      expect(extractKeywords(q)).toEqual([]);
      expect(isAllStopWords(q)).toBe(false);
    }
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
