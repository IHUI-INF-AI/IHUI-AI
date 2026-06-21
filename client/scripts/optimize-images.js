import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const SRC_DIR = path.resolve(__dirname, '../src/assets')
const OUTPUT_DIR = path.resolve(__dirname, '../src/assets-optimized')

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg']

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

function getImageFiles(dir) {
  const files = []
  
  function walk(currentDir) {
    if (!fs.existsSync(currentDir)) return
    const entries = fs.readdirSync(currentDir, { withFileTypes: true })
    
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name)
      if (entry.isDirectory()) {
        walk(fullPath)
      } else {
        const ext = path.extname(entry.name).toLowerCase()
        if (IMAGE_EXTENSIONS.includes(ext)) {
          files.push(fullPath)
        }
      }
    }
  }
  
  walk(dir)
  return files
}

function formatSize(bytes) {
  return (bytes / 1024).toFixed(2) + ' KB'
}

async function convertToWebP(inputPath, outputDir) {
  const relativePath = path.relative(SRC_DIR, inputPath)
  const outputSubDir = path.dirname(path.join(outputDir, relativePath))
  const baseName = path.basename(inputPath, path.extname(inputPath))
  const outputPath = path.join(outputSubDir, `${baseName}.webp`)
  
  ensureDir(outputSubDir)
  
  try {
    await sharp(inputPath)
      .webp({ quality: 80 })
      .toFile(outputPath)
    
    const originalSize = fs.statSync(inputPath).size
    const optimizedSize = fs.statSync(outputPath).size
    const reduction = ((1 - optimizedSize / originalSize) * 100).toFixed(1)
    
    return {
      original: inputPath,
      optimized: outputPath,
      originalSize,
      optimizedSize,
      reduction
    }
  } catch (error) {
    console.log(`   ❌ 转换失败: ${relativePath} - ${error.message}`)
    return null
  }
}

async function main() {
  console.log('\n🖼️ 图片优化工具\n')
  console.log('='.repeat(50))
  
  const imageFiles = getImageFiles(SRC_DIR)
  
  if (imageFiles.length === 0) {
    console.log('未找到需要优化的图片')
    return
  }
  
  console.log(`找到 ${imageFiles.length} 张图片需要优化\n`)
  
  const results = []
  let processed = 0
  
  for (const file of imageFiles) {
    processed++
    const relativePath = path.relative(SRC_DIR, file)
    console.log(`[${processed}/${imageFiles.length}] 处理: ${relativePath}`)
    
    const result = await convertToWebP(file, OUTPUT_DIR)
    if (result) {
      results.push(result)
      console.log(`   原始: ${formatSize(result.originalSize)} → 优化: ${formatSize(result.optimizedSize)} (${result.reduction}% 减少)`)
    }
  }
  
  console.log('\n' + '='.repeat(50))
  console.log('\n📊 优化结果汇总:\n')
  
  let totalOriginal = 0
  let totalOptimized = 0
  
  for (const r of results) {
    totalOriginal += r.originalSize
    totalOptimized += r.optimizedSize
  }
  
  const totalReduction = totalOriginal > 0 
    ? ((1 - totalOptimized / totalOriginal) * 100).toFixed(1)
    : '0.0'
  
  console.log(`处理图片: ${results.length} 张`)
  console.log(`原始大小: ${(totalOriginal / 1024 / 1024).toFixed(2)} MB`)
  console.log(`优化大小: ${(totalOptimized / 1024 / 1024).toFixed(2)} MB`)
  console.log(`总减少: ${totalReduction}%`)
  
  console.log(`\n✅ 优化后的图片已保存到: ${OUTPUT_DIR}`)
  console.log('\n💡 提示: 要使用优化后的图片，请更新引用路径或在 vite.config.ts 中配置别名')
}

main().catch(console.error)
