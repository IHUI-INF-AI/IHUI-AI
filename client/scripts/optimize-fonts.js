import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import subsetFont from 'subset-font'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const FONTS_DIR = path.resolve(__dirname, '../src/assets/fonts')
const OUTPUT_DIR = path.resolve(__dirname, '../public/fonts-optimized')

const COMMON_CHINESE_CHARS = `的一是在不了有和人这中大为上个国我以要他时来用们生到作地于出就分对成会可主发年动同工也能下过子说产种面而方后多定行学法所民得经十三之进着等部度家电力里如水化高自二理起小物现实加量都两体制机当使点从业本去把性好应开它合还因由其些然前外天政四日那社义事平形相全表间样与关各重新线内数正心反你明看原又么利比或但质气第向道命此变条只没结解问意建月公无系军很情者最立代想已通并提直题党程展五果料象员革位入常文总次品式活设及管特件长求老头基资边流路级少图山统接知较将组见计别她手角期根论运农指几九区强放决西被干做必战先回则任取据处队南给色光门即保治北造百规热领七海口东导器压志世金增争济阶油思术极交受联什认六共权收证改清己美再采转更单风切打白教速花带安场身车例真务具万每目至达走积示议声报斗完类八离华名确才科张信马节话米整空元况今集温传土许步群广石记需段研界拉林律叫且究观越织装影算低持音众书布复容儿须际商非验连断深难近矿千周委素技备半办青省列习响约支般史感劳便团往酸历市克何除消构府称太准精值号率族维划选标写存候毛亲快效斯院查江型眼王按格养易置派层片始却专状育厂京识适属圆包火住调满县局照参红细引听该铁价严`

const COMMON_ENGLISH_CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

const NUMBERS_AND_SYMBOLS = '0123456789!@#$%^&*()_+-=[]{}|;:\'",.<>?/~`'

const SUBSET_CHARS = COMMON_CHINESE_CHARS + COMMON_ENGLISH_CHARS + NUMBERS_AND_SYMBOLS

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

function cleanDir(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true })
  }
  ensureDir(dir)
}

function getFontFiles() {
  const fonts = []
  const extensions = ['.ttf', '.otf', '.woff', '.woff2']
  
  function walk(dir) {
    if (!fs.existsSync(dir)) return
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        walk(fullPath)
      } else {
        const ext = path.extname(entry.name).toLowerCase()
        if (extensions.includes(ext)) {
          fonts.push(fullPath)
        }
      }
    }
  }
  
  walk(FONTS_DIR)
  return fonts
}

async function optimizeFont(inputPath, outputPath, subsetChars) {
  const fontName = path.basename(inputPath, path.extname(inputPath))
  const outputWoff2 = path.join(outputPath, `${fontName}.subset.woff2`)
  
  try {
    console.log(`📦 处理字体: ${fontName}`)
    
    const fontBuffer = fs.readFileSync(inputPath)
    
    const subsetBuffer = await subsetFont(fontBuffer, subsetChars, {
      targetFormat: 'woff2'
    })
    
    fs.writeFileSync(outputWoff2, subsetBuffer)
    
    const originalSize = fs.statSync(inputPath).size
    const optimizedSize = subsetBuffer.byteLength
    const reduction = ((1 - optimizedSize / originalSize) * 100).toFixed(1)
    
    console.log(`   原始大小: ${(originalSize / 1024).toFixed(1)} KB`)
    console.log(`   优化大小: ${(optimizedSize / 1024).toFixed(1)} KB`)
    console.log(`   减少: ${reduction}%`)
    
    return { name: fontName, originalSize, optimizedSize, reduction }
  } catch (error) {
    console.log(`   ❌ 处理失败: ${error.message}`)
    return null
  }
}

async function main() {
  console.log('\n🔧 字体优化工具\n')
  console.log('='.repeat(50))
  
  cleanDir(OUTPUT_DIR)
  
  const mainFonts = [
    path.join(FONTS_DIR, 'HarmonyOS+Sans+字体/HarmonyOS Sans 字体/HarmonyOS_SansSC/HarmonyOS_SansSC_Regular.ttf'),
    path.join(FONTS_DIR, 'HarmonyOS+Sans+字体/HarmonyOS Sans 字体/HarmonyOS_SansSC/HarmonyOS_SansSC_Semibold.ttf'),
    path.join(FONTS_DIR, 'HarmonyOS+Sans+字体/HarmonyOS Sans 字体/HarmonyOS_SansSC/HarmonyOS_SansSC_Bold.ttf'),
    path.join(FONTS_DIR, 'english/EDIX_zitidi.com.ttf'),
    path.join(FONTS_DIR, 'english/AlienSpaceshipAlternative.ttf'),
  ]
  
  const results = []
  
  for (const fontPath of mainFonts) {
    if (fs.existsSync(fontPath)) {
      const result = await optimizeFont(fontPath, OUTPUT_DIR, SUBSET_CHARS)
      if (result) results.push(result)
    } else {
      console.log(`⚠️ 字体文件不存在: ${fontPath}`)
    }
  }
  
  console.log('\n' + '='.repeat(50))
  console.log('\n📊 优化结果汇总:\n')
  
  let totalOriginal = 0
  let totalOptimized = 0
  
  for (const r of results) {
    console.log(`${r.name}: ${r.reduction}% 减少`)
    totalOriginal += r.originalSize
    totalOptimized += r.optimizedSize
  }
  
  const totalReduction = totalOriginal > 0 
    ? ((1 - totalOptimized / totalOriginal) * 100).toFixed(1)
    : '0.0'
  
  console.log(`\n总计:`)
  console.log(`  原始大小: ${(totalOriginal / 1024 / 1024).toFixed(2)} MB`)
  console.log(`  优化大小: ${(totalOptimized / 1024 / 1024).toFixed(2)} MB`)
  console.log(`  总减少: ${totalReduction}%`)
  
  console.log(`\n✅ 优化后的字体已保存到: ${OUTPUT_DIR}`)
  console.log('\n💡 提示: 要使用优化后的字体，请在 CSS 中更新 @font-face 引用路径')
}

main().catch(console.error)
