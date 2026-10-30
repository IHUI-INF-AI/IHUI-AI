// 归一判据的成对对照:正例(折行应判等)与反例(不同导出不应判等)
const normAll = (t) =>
  t
    .replace(/\s+/g, ' ')
    .replace(/,\s*(?=[}\])])/g, '')
    .replace(/\s*([{}[\],()])\s*/g, '$1')
    .trim()

const folded =
  "export type {\n  CircleOption,\n  CirclePostImage,\n  CirclePostScreenProps,\n} from './features/community/CirclePostScreen'\n"
const single =
  "export type { CircleOption, CirclePostImage, CirclePostScreenProps } from './features/community/CirclePostScreen'"

console.log('折行归一后:', JSON.stringify(normAll(folded)))
console.log('单行归一后:', JSON.stringify(normAll(single)))
console.log('正例(应命中):', normAll(folded).includes(normAll(single)) ? 'OK' : '⛔ 判不出')
console.log('反例(应不命中):', normAll(folded).includes(normAll("export type { Other } from './x'")) ? '⛔ 误命中' : 'OK')
