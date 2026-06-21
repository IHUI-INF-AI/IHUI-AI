import { describe, it, expect } from 'vitest'
import {
  unique,
  uniqueBy,
  groupBy,
  chunk,
  flatten,
  flattenDeep,
  sortBy,
  sortByMultiple,
  difference,
  intersection,
  union,
  partition,
  first,
  last,
  nth,
  take,
  takeRight,
  drop,
  dropRight,
  zip,
  unzip,
  range,
  sum,
  sumBy,
  average,
  averageBy,
  min,
  max,
  minBy,
  maxBy,
  countBy,
  keyBy,
  shuffle,
  sample,
  sampleSize,
} from '../array'

describe('array utils', () => {
  describe('unique', () => {
    it('应该去除重复元素', () => {
      expect(unique([1, 2, 2, 3, 3, 3])).toEqual([1, 2, 3])
    })

    it('应该保留原始顺序', () => {
      expect(unique([3, 1, 2, 1, 3])).toEqual([3, 1, 2])
    })

    it('应该处理空数组', () => {
      expect(unique([])).toEqual([])
    })

    it('应该处理字符串数组', () => {
      expect(unique(['a', 'b', 'a', 'c'])).toEqual(['a', 'b', 'c'])
    })
  })

  describe('uniqueBy', () => {
    it('应该根据keyFn去重', () => {
      const arr = [{ id: 1, name: 'a' }, { id: 2, name: 'b' }, { id: 1, name: 'c' }]
      expect(uniqueBy(arr, item => item.id)).toEqual([{ id: 1, name: 'a' }, { id: 2, name: 'b' }])
    })

    it('应该处理空数组', () => {
      expect(uniqueBy([], (item: { id: number }) => item.id)).toEqual([])
    })
  })

  describe('groupBy', () => {
    it('应该按keyFn分组', () => {
      const arr = [{ type: 'a', val: 1 }, { type: 'b', val: 2 }, { type: 'a', val: 3 }]
      const result = groupBy(arr, item => item.type)
      expect(result.a).toEqual([{ type: 'a', val: 1 }, { type: 'a', val: 3 }])
      expect(result.b).toEqual([{ type: 'b', val: 2 }])
    })

    it('应该处理空数组', () => {
      expect(groupBy([], (item: { type: string }) => item.type)).toEqual({})
    })
  })

  describe('chunk', () => {
    it('应该按大小分割数组', () => {
      expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
    })

    it('应该处理空数组', () => {
      expect(chunk([], 2)).toEqual([])
    })

    it('应该处理size大于数组长度', () => {
      expect(chunk([1, 2], 5)).toEqual([[1, 2]])
    })
  })

  describe('flatten', () => {
    it('应该扁平化一层', () => {
      expect(flatten([1, [2, 3], 4])).toEqual([1, 2, 3, 4])
    })

    it('应该处理空数组', () => {
      expect(flatten([])).toEqual([])
    })
  })

  describe('flattenDeep', () => {
    it('应该深度扁平化', () => {
      expect(flattenDeep([1, [2, [3, [4]]]])).toEqual([1, 2, 3, 4])
    })
  })

  describe('sortBy', () => {
    it('应该升序排序', () => {
      expect(sortBy([3, 1, 2], x => x)).toEqual([1, 2, 3])
    })

    it('应该降序排序', () => {
      expect(sortBy([1, 2, 3], x => x, 'desc')).toEqual([3, 2, 1])
    })

    it('应该按对象属性排序', () => {
      const arr = [{ age: 3 }, { age: 1 }, { age: 2 }]
      expect(sortBy(arr, x => x.age)).toEqual([{ age: 1 }, { age: 2 }, { age: 3 }])
    })
  })

  describe('sortByMultiple', () => {
    it('应该按多个键排序', () => {
      const arr = [
        { name: 'b', age: 1 },
        { name: 'a', age: 2 },
        { name: 'a', age: 1 },
      ]
      const result = sortByMultiple(arr, [
        { key: x => x.name },
        { key: x => x.age },
      ])
      expect(result).toEqual([
        { name: 'a', age: 1 },
        { name: 'a', age: 2 },
        { name: 'b', age: 1 },
      ])
    })
  })

  describe('difference', () => {
    it('应该返回差集', () => {
      expect(difference([1, 2, 3], [2, 3, 4])).toEqual([1])
    })

    it('应该处理空数组', () => {
      expect(difference([], [1, 2])).toEqual([])
      expect(difference([1, 2], [])).toEqual([1, 2])
    })
  })

  describe('intersection', () => {
    it('应该返回交集', () => {
      expect(intersection([1, 2, 3], [2, 3, 4])).toEqual([2, 3])
    })
  })

  describe('union', () => {
    it('应该返回并集', () => {
      expect(union([1, 2], [2, 3], [3, 4])).toEqual([1, 2, 3, 4])
    })
  })

  describe('partition', () => {
    it('应该分区数组', () => {
      const [pass, fail] = partition([1, 2, 3, 4, 5], x => x > 2)
      expect(pass).toEqual([3, 4, 5])
      expect(fail).toEqual([1, 2])
    })
  })

  describe('first', () => {
    it('应该返回第一个元素', () => {
      expect(first([1, 2, 3])).toBe(1)
    })

    it('应该返回undefined当数组为空', () => {
      expect(first([])).toBeUndefined()
    })
  })

  describe('last', () => {
    it('应该返回最后一个元素', () => {
      expect(last([1, 2, 3])).toBe(3)
    })

    it('应该返回undefined当数组为空', () => {
      expect(last([])).toBeUndefined()
    })
  })

  describe('nth', () => {
    it('应该返回第n个元素', () => {
      expect(nth([1, 2, 3], 1)).toBe(2)
    })

    it('应该支持负索引', () => {
      expect(nth([1, 2, 3], -1)).toBe(3)
      expect(nth([1, 2, 3], -2)).toBe(2)
    })
  })

  describe('take', () => {
    it('应该取前n个元素', () => {
      expect(take([1, 2, 3, 4], 2)).toEqual([1, 2])
    })
  })

  describe('takeRight', () => {
    it('应该取后n个元素', () => {
      expect(takeRight([1, 2, 3, 4], 2)).toEqual([3, 4])
    })
  })

  describe('drop', () => {
    it('应该丢弃前n个元素', () => {
      expect(drop([1, 2, 3, 4], 2)).toEqual([3, 4])
    })
  })

  describe('dropRight', () => {
    it('应该丢弃后n个元素', () => {
      expect(dropRight([1, 2, 3, 4], 2)).toEqual([1, 2])
    })
  })

  describe('zip', () => {
    it('应该合并两个数组', () => {
      expect(zip([1, 2, 3], ['a', 'b', 'c'])).toEqual([[1, 'a'], [2, 'b'], [3, 'c']])
    })

    it('应该处理不等长数组', () => {
      expect(zip([1, 2, 3], ['a', 'b'])).toEqual([[1, 'a'], [2, 'b']])
    })
  })

  describe('unzip', () => {
    it('应该解压数组', () => {
      expect(unzip([[1, 'a'], [2, 'b'], [3, 'c']])).toEqual([[1, 2, 3], ['a', 'b', 'c']])
    })
  })

  describe('range', () => {
    it('应该生成范围数组', () => {
      expect(range(0, 5)).toEqual([0, 1, 2, 3, 4])
    })

    it('应该支持单个参数', () => {
      expect(range(5)).toEqual([0, 1, 2, 3, 4])
    })

    it('应该支持步长', () => {
      expect(range(0, 10, 2)).toEqual([0, 2, 4, 6, 8])
    })

    it('应该支持负步长', () => {
      expect(range(5, 0, -1)).toEqual([5, 4, 3, 2, 1])
    })
  })

  describe('sum', () => {
    it('应该计算总和', () => {
      expect(sum([1, 2, 3, 4])).toBe(10)
    })

    it('应该处理空数组', () => {
      expect(sum([])).toBe(0)
    })
  })

  describe('sumBy', () => {
    it('应该按keyFn计算总和', () => {
      const arr = [{ val: 1 }, { val: 2 }, { val: 3 }]
      expect(sumBy(arr, x => x.val)).toBe(6)
    })
  })

  describe('average', () => {
    it('应该计算平均值', () => {
      expect(average([1, 2, 3, 4])).toBe(2.5)
    })

    it('应该处理空数组', () => {
      expect(average([])).toBe(0)
    })
  })

  describe('averageBy', () => {
    it('应该按keyFn计算平均值', () => {
      const arr = [{ val: 1 }, { val: 2 }, { val: 3 }]
      expect(averageBy(arr, x => x.val)).toBe(2)
    })
  })

  describe('min', () => {
    it('应该返回最小值', () => {
      expect(min([3, 1, 2])).toBe(1)
    })

    it('应该返回undefined当数组为空', () => {
      expect(min([])).toBeUndefined()
    })
  })

  describe('max', () => {
    it('应该返回最大值', () => {
      expect(max([3, 1, 2])).toBe(3)
    })

    it('应该返回undefined当数组为空', () => {
      expect(max([])).toBeUndefined()
    })
  })

  describe('minBy', () => {
    it('应该按keyFn返回最小元素', () => {
      const arr = [{ val: 3 }, { val: 1 }, { val: 2 }]
      expect(minBy(arr, x => x.val)).toEqual({ val: 1 })
    })
  })

  describe('maxBy', () => {
    it('应该按keyFn返回最大元素', () => {
      const arr = [{ val: 3 }, { val: 1 }, { val: 2 }]
      expect(maxBy(arr, x => x.val)).toEqual({ val: 3 })
    })
  })

  describe('countBy', () => {
    it('应该按keyFn计数', () => {
      const arr = [{ type: 'a' }, { type: 'b' }, { type: 'a' }]
      expect(countBy(arr, x => x.type)).toEqual({ a: 2, b: 1 })
    })
  })

  describe('keyBy', () => {
    it('应该按keyFn转换为对象', () => {
      const arr = [{ id: 1, name: 'a' }, { id: 2, name: 'b' }]
      expect(keyBy(arr, x => x.id)).toEqual({
        1: { id: 1, name: 'a' },
        2: { id: 2, name: 'b' },
      })
    })
  })

  describe('shuffle', () => {
    it('应该打乱数组', () => {
      const arr = [1, 2, 3, 4, 5]
      const shuffled = shuffle(arr)
      expect(shuffled.length).toBe(arr.length)
      expect(shuffled.sort()).toEqual(arr.sort())
      expect(arr).toEqual([1, 2, 3, 4, 5])
    })
  })

  describe('sample', () => {
    it('应该随机返回一个元素', () => {
      const arr = [1, 2, 3]
      const result = sample(arr)
      expect(arr).toContain(result)
    })

    it('应该返回undefined当数组为空', () => {
      expect(sample([])).toBeUndefined()
    })
  })

  describe('sampleSize', () => {
    it('应该随机返回n个元素', () => {
      const arr = [1, 2, 3, 4, 5]
      const result = sampleSize(arr, 3)
      expect(result.length).toBe(3)
    })

    it('应该处理n大于数组长度', () => {
      const arr = [1, 2, 3]
      const result = sampleSize(arr, 5)
      expect(result.length).toBe(3)
    })
  })
})
