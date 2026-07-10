#!/usr/bin/env node
/**
 * en-US 美式英语定制化
 *
 * 2026-07-03 创建: 将 en-US 中的英式英语拼写替换为美式英语
 *
 * 转换规则 (British → American):
 *   - -our → -or: colour→color, behaviour→behavior, honour→honor, favour→favor, neighbour→neighbor
 *   - -re → -er: centre→center, fibre→fiber, metre→meter, theatre→theater
 *   - -ise → -ize: organise→organize, realise→realize, optimise→optimize, analyse→analyze
 *   - -ogue → -og: dialogue→dialog, catalogue→catalog, analogue→analog
 *   - double-l → single-l: cancelled→canceled, labelled→labeled, modelling→modeling
 *   - others: programme→program, maths→math, grey→gray, mould→mold, smoulder→smolder
 *
 * 用法: node scripts/customize-en-us.mjs
 *        node scripts/customize-en-us.mjs --dry-run   # 只打印, 不写入
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '..')
const EN_US_DIR = path.join(ROOT, 'src', 'locales', 'modules', 'en-US')

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')

// 英式 → 美式 替换规则
// 注: 排序按长度降序, 避免短词先替换破坏长词 (如 "colour" 在 "colourful" 之前)
const REPLACEMENTS = [
  // -our → -or (注意: "hour", "sour" 不转换, 但本项目 unlikely 出现)
  ['colour', 'color'],
  ['colours', 'colors'],
  ['colourful', 'colorful'],
  ['behaviour', 'behavior'],
  ['behaviours', 'behaviors'],
  ['honour', 'honor'],
  ['honours', 'honors'],
  ['honoured', 'honored'],
  ['honourable', 'honorable'],
  ['favour', 'favor'],
  ['favours', 'favors'],
  ['favoured', 'favored'],
  ['favourite', 'favorite'],
  ['favourites', 'favorites'],
  ['neighbour', 'neighbor'],
  ['neighbours', 'neighbors'],
  ['neighbourhood', 'neighborhood'],
  ['labour', 'labor'],
  ['labours', 'labors'],
  ['vapour', 'vapor'],
  ['rumour', 'rumor'],
  ['humour', 'humor'],
  ['harbour', 'harbor'],
  ['flavour', 'flavor'],
  ['tumour', 'tumor'],
  ['ardour', 'ardor'],
  ['armour', 'armor'],
  ['clangour', 'clangor'],

  // -re → -er
  ['centre', 'center'],
  ['centres', 'centers'],
  ['centred', 'centered'],
  ['fibre', 'fiber'],
  ['fibres', 'fibers'],
  ['metre', 'meter'],
  ['metres', 'meters'],
  ['theatre', 'theater'],
  ['theatres', 'theaters'],
  ['litre', 'liter'],
  ['litres', 'liters'],
  ['calibre', 'caliber'],
  ['manoeuvre', 'maneuver'],
  ['spectre', 'specter'],

  // -ise → -ize / -isation → -ization / -ising → -izing
  ['organise', 'organize'],
  ['organises', 'organizes'],
  ['organised', 'organized'],
  ['organising', 'organizing'],
  ['organisation', 'organization'],
  ['organisations', 'organizations'],
  ['realise', 'realize'],
  ['realises', 'realizes'],
  ['realised', 'realized'],
  ['realising', 'realizing'],
  ['realisation', 'realization'],
  ['optimise', 'optimize'],
  ['optimises', 'optimizes'],
  ['optimised', 'optimized'],
  ['optimising', 'optimizing'],
  ['optimisation', 'optimization'],
  ['recognise', 'recognize'],
  ['recognises', 'recognizes'],
  ['recognised', 'recognized'],
  ['recognising', 'recognizing'],
  ['recognisable', 'recognizable'],
  ['analyse', 'analyze'],
  ['analyses', 'analyzes'], // verb form; noun "analyses" 保留
  ['analysed', 'analyzed'],
  ['analysing', 'analyzing'],
  ['paralyse', 'paralyze'],
  ['paralysed', 'paralyzed'],
  ['paralysing', 'paralyzing'],
  ['minimise', 'minimize'],
  ['maximise', 'maximize'],
  ['normalise', 'normalize'],
  ['normalised', 'normalized'],
  ['normalising', 'normalizing'],
  ['normalisation', 'normalization'],
  ['modernise', 'modernize'],
  ['modernised', 'modernized'],
  ['modernisation', 'modernization'],
  ['commercialise', 'commercialize'],
  ['commercialised', 'commercialized'],
  ['commercialisation', 'commercialization'],
  ['prioritise', 'prioritize'],
  ['prioritised', 'prioritized'],
  ['prioritising', 'prioritizing'],
  ['serialise', 'serialize'],
  ['serialised', 'serialized'],
  ['serialising', 'serializing'],
  ['serialisation', 'serialization'],
  ['deserialise', 'deserialize'],
  ['deserialised', 'deserialized'],
  ['deserialising', 'deserializing'],
  ['deserialisation', 'deserialization'],
  ['synchronise', 'synchronize'],
  ['synchronised', 'synchronized'],
  ['synchronising', 'synchronizing'],
  ['synchronisation', 'synchronization'],
  ['categorise', 'categorize'],
  ['categorised', 'categorized'],
  ['categorising', 'categorizing'],
  ['categorisation', 'categorization'],
  ['localise', 'localize'],
  ['localised', 'localized'],
  ['localising', 'localizing'],
  ['localisation', 'localization'],
  ['globalise', 'globalize'],
  ['globalised', 'globalized'],
  ['globalisation', 'globalization'],

  // -ogue → -og
  ['dialogue', 'dialog'],
  ['dialogues', 'dialogs'],
  ['catalogue', 'catalog'],
  ['catalogues', 'catalogs'],
  ['analogue', 'analog'],
  ['analogue', 'analog'],

  // double-l → single-l (在 -ed, -ing 后缀前)
  ['cancelled', 'canceled'],
  ['cancelling', 'canceling'],
  ['cancellation', 'cancellation'], // 美式也用双 l
  ['labelled', 'labeled'],
  ['labelling', 'labeling'],
  ['modelled', 'modeled'],
  ['modelling', 'modeling'],
  ['travelled', 'traveled'],
  ['travelling', 'traveling'],
  ['traveller', 'traveler'],
  ['travellers', 'travelers'],
  ['counselled', 'counseled'],
  ['counselling', 'counseling'],
  ['fuelled', 'fueled'],
  ['fuelling', 'fueling'],
  ['signalled', 'signaled'],
  ['signalling', 'signaling'],
  ['marvelled', 'marveled'],
  ['marvelling', 'marveling'],
  ['paralleled', 'paralleled'], // 美式也用双 l
  ['revelled', 'reveled'],
  ['revelling', 'reveling'],
  ['worshipped', 'worshiped'],
  ['worshipping', 'worshiping'],
  ['kidnapped', 'kidnaped'],
  ['kidnapping', 'kidnaping'],

  // 其他常见
  ['programme', 'program'],
  ['programmes', 'programs'],
  ['maths', 'math'],
  ['grey', 'gray'],
  ['greys', 'grays'],
  ['greyish', 'grayish'],
  ['mould', 'mold'],
  ['moulds', 'molds'],
  ['moulded', 'molded'],
  ['moulding', 'molding'],
  ['smoulder', 'smolder'],
  ['smouldered', 'smoldered'],
  ['smouldering', 'smoldering'],
  ['plough', 'plow'],
  ['ploughs', 'plows'],
  ['ploughed', 'plowed'],
  ['ploughing', 'plowing'],
  ['sceptre', 'scepter'],
  ['storey', 'story'],
  ['storeys', 'stories'],
  ['tyre', 'tire'],
  ['tyres', 'tires'],
  ['kerb', 'curb'],
  ['kerbs', 'curbs'],
  ['doughnut', 'donut'],
  ['doughnuts', 'donuts'],
  ['manoeuvre', 'maneuver'],
  ['manoeuvres', 'maneuvers'],
  ['omelette', 'omelet'],
  ['omelettes', 'omelets'],

  // -ce → -se (verb forms)
  ['practise', 'practice'], // 英式动词 practise → 美式 practice
  ['practised', 'practiced'],
  ['practising', 'practicing'],
  ['licence', 'license'], // 英式名词 licence → 美式 license
  ['licences', 'licenses'],
  ['defence', 'defense'],
  ['defences', 'defenses'],
  ['offence', 'offense'],
  ['offences', 'offenses'],
  ['pretence', 'pretense'],
  ['pretences', 'pretenses'],
]

// 按长度降序排序, 避免短词先替换破坏长词
REPLACEMENTS.sort((a, b) => b[0].length - a[0].length)

function transform(text) {
  let result = text
  let count = 0
  for (const [brit, amer] of REPLACEMENTS) {
    // 用正则做全词匹配, 不区分大小写
    const re = new RegExp(`\\b${brit}\\b`, 'gi')
    result = result.replace(re, (match) => {
      count++
      // 保留原大小写模式
      if (match === brit.toUpperCase()) return amer.toUpperCase()
      if (match[0] === match[0].toUpperCase()) {
        return amer.charAt(0).toUpperCase() + amer.slice(1)
      }
      return amer
    })
  }
  return { text: result, count }
}

function processObject(obj) {
  let totalChanged = 0
  for (const [k, v] of Object.entries(obj)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      totalChanged += processObject(v)
    } else if (typeof v === 'string') {
      const { text, count } = transform(v)
      if (count > 0) {
        obj[k] = text
        totalChanged += count
      }
    }
  }
  return totalChanged
}

// 主流程
console.log('🇺🇸 en-US 美式英语定制化')
if (dryRun) console.log('   (dry-run 模式: 只打印, 不写入)')
console.log()

if (!fs.existsSync(EN_US_DIR)) {
  console.error(`❌ en-US 目录不存在: ${EN_US_DIR}`)
  process.exit(1)
}

const files = fs.readdirSync(EN_US_DIR).filter((f) => f.endsWith('.json'))
let totalReplacements = 0
const fileStats = []

for (const f of files) {
  const filePath = path.join(EN_US_DIR, f)
  const obj = JSON.parse(fs.readFileSync(filePath, 'utf-8'))

  const changed = processObject(obj)
  if (changed > 0) {
    if (!dryRun) {
      fs.writeFileSync(filePath, JSON.stringify(obj, null, 2) + '\n', 'utf-8')
    }
    totalReplacements += changed
    fileStats.push({ file: f, changed })
  }
}

console.log(`📊 总替换: ${totalReplacements} 处`)
console.log(`   涉及文件: ${fileStats.length} 个`)
console.log()

if (fileStats.length > 0) {
  console.log('替换详情 (Top 20):')
  const top = fileStats.sort((a, b) => b.changed - a.changed).slice(0, 20)
  for (const s of top) {
    console.log(`  ${s.file}: ${s.changed} 处`)
  }
}

console.log()
console.log('✅ en-US 美式英语定制完成')
if (dryRun) {
  console.log('   (dry-run 模式, 未写入文件. 去掉 --dry-run 参数执行实际写入)')
}
