/**
 * util/json.ts 单元测试 — 覆盖 tryParseJson / isRecord / isJsonArray 全部边界。
 *
 * 覆盖点:
 *   1. tryParseJson:合法 JSON 各类型往返(对象/数组/字符串/数字/布尔/null)
 *   2. tryParseJson:非法输入返回 undefined(空串/截断 JSON/多余尾随内容)
 *   3. isRecord:对象 true;null/数组/原始类型 false
 *   4. isJsonArray:数组 true(含空数组);null/对象/原始类型 false
 *   5. 组合模式:tryParseJson + isRecord 守卫替代 `JSON.parse as T` 断言
 */
import { describe, expect, it } from 'vitest';
import { tryParseJson, isRecord, isJsonArray } from '../src/util/json.js';

describe('tryParseJson', () => {
  it.each([
    ['{}', {}],
    ['{"a":1}', { a: 1 }],
    ['[]', []],
    ['[1,2,3]', [1, 2, 3]],
    ['"text"', 'text'],
    ['123', 123],
    ['-0.5', -0.5],
    ['true', true],
    ['false', false],
    ['null', null],
    ['{"nested":{"list":[1,{"deep":true}]}}', { nested: { list: [1, { deep: true }] } }],
  ])('合法 JSON %s → 解析成功', (input, expected) => {
    expect(tryParseJson(input)).toEqual(expected);
  });

  it.each([
    [''],
    ['   '],
    ['{'],
    ['{"a":1'],
    ['{"a":1}extra'],
    ['not json'],
    ['undefined'],
    ['NaN'],
    ['{"a": undefined}'],
  ])('非法输入 %j → 返回 undefined 而不抛错', (input) => {
    expect(tryParseJson(input)).toBeUndefined();
  });
});

describe('isRecord', () => {
  it('普通对象返回 true', () => {
    expect(isRecord({})).toBe(true);
    expect(isRecord({ a: 1 })).toBe(true);
    expect(isRecord(Object.create(null))).toBe(true);
  });

  it('null 返回 false(关键边界:JSON.parse("null") 的产物)', () => {
    expect(isRecord(null)).toBe(false);
  });

  it('数组返回 false(关键边界:防止数组被当 Settings/Config 合并)', () => {
    expect(isRecord([])).toBe(false);
    expect(isRecord([1, 2])).toBe(false);
  });

  it.each([
    ['string'],
    [123],
    [true],
    [false],
    [undefined],
    [Symbol('s')],
  ])('原始类型 %s 返回 false', (value) => {
    expect(isRecord(value)).toBe(false);
  });
});

describe('isJsonArray', () => {
  it('数组返回 true(含空数组)', () => {
    expect(isJsonArray([])).toBe(true);
    expect(isJsonArray([1, 'a', null])).toBe(true);
  });

  it.each([
    [null],
    [undefined],
    [{}],
    ['[]'],
    ['abc'],
    [123],
  ])('非数组 %j 返回 false', (value) => {
    expect(isJsonArray(value)).toBe(false);
  });
});

describe('组合守卫模式(替代 JSON.parse as T 断言)', () => {
  it('null JSON 内容不会穿透 isRecord 守卫', () => {
    const parsed = tryParseJson('null');
    expect(isRecord(parsed)).toBe(false);
  });

  it('数组内容不会伪装成 Record', () => {
    const parsed = tryParseJson('[1,2,3]');
    expect(isRecord(parsed)).toBe(false);
    expect(isJsonArray(parsed)).toBe(true);
  });

  it('损坏文件内容安全降级为 undefined', () => {
    const parsed = tryParseJson('{"broken": ');
    expect(parsed).toBeUndefined();
    expect(isRecord(parsed)).toBe(false);
  });
});
