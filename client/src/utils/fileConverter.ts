import JSZip from 'jszip'
import ExcelJS from 'exceljs'

export interface ConversionResult {
  success: boolean
  markdown: string
  title: string
  images: { name: string; data: string; type: string }[]
  error?: string
}

export interface MediaFile {
  name: string
  data: string
  type: string
  originalName?: string
}

export async function convertToMarkdown(file: File): Promise<ConversionResult> {
  const fileName = file.name.toLowerCase()
  const title = file.name.replace(/\.[^/.]+$/, '')

  try {
    if (fileName.endsWith('.md')) {
      const content = await file.text()
      return { success: true, markdown: content, title, images: [] }
    }

    if (fileName.endsWith('.txt')) {
      const content = await file.text()
      const markdown = `# ${title}\n\n${content}`
      return { success: true, markdown, title, images: [] }
    }

    if (fileName.endsWith('.docx')) {
      return await convertDocxToMarkdown(file, title)
    }

    if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      return await convertExcelToMarkdown(file, title)
    }

    if (fileName.endsWith('.pptx')) {
      return await convertPptxToMarkdown(file, title)
    }

    if (fileName.endsWith('.pdf')) {
      return await convertPdfToMarkdown(file, title)
    }

    if (isImageFile(fileName)) {
      return await convertImageToMarkdown(file, title)
    }

    if (isVideoFile(fileName)) {
      return await convertVideoToMarkdown(file, title)
    }

    if (isAudioFile(fileName)) {
      return await convertAudioToMarkdown(file, title)
    }

    return {
      success: false,
      markdown: '',
      title,
      images: [],
      error: '不支持的文件格式，支持的格式：Word(.docx)、Excel(.xlsx/.xls)、PPT(.pptx)、PDF、TXT、Markdown、图片、视频、音频',
    }
  } catch (error) {
    return {
      success: false,
      markdown: '',
      title,
      images: [],
      error: `转换失败: ${error instanceof Error ? error.message : '未知错误'}`,
    }
  }
}

function isImageFile(fileName: string): boolean {
  return /\.(png|jpg|jpeg|gif|webp|svg|bmp|ico)$/i.test(fileName)
}

function isVideoFile(fileName: string): boolean {
  return /\.(mp4|webm|ogg|mov|avi|mkv|wmv|flv)$/i.test(fileName)
}

function isAudioFile(fileName: string): boolean {
  return /\.(mp3|wav|ogg|aac|flac|m4a|wma)$/i.test(fileName)
}

async function convertImageToMarkdown(file: File, title: string): Promise<ConversionResult> {
  const base64 = await fileToBase64(file)
  const mimeType = file.type || 'image/png'
  const markdown = `# ${title}\n\n![${title}](${base64})\n\n*图片: ${file.name}*`
  
  return {
    success: true,
    markdown,
    title,
    images: [{ name: file.name, data: base64, type: mimeType }],
  }
}

async function convertVideoToMarkdown(file: File, title: string): Promise<ConversionResult> {
  const base64 = await fileToBase64(file)
  const mimeType = file.type || 'video/mp4'
  const markdown = `# ${title}\n\n<video controls style="max-width: 100%;">\n  <source src="${base64}" type="${mimeType}">\n  您的浏览器不支持视频播放\n</video>\n\n*视频: ${file.name}*`
  
  return {
    success: true,
    markdown,
    title,
    images: [{ name: file.name, data: base64, type: mimeType }],
  }
}

async function convertAudioToMarkdown(file: File, title: string): Promise<ConversionResult> {
  const base64 = await fileToBase64(file)
  const mimeType = file.type || 'audio/mpeg'
  const markdown = `# ${title}\n\n<audio controls style="width: 100%;">\n  <source src="${base64}" type="${mimeType}">\n  您的浏览器不支持音频播放\n</audio>\n\n*音频: ${file.name}*`
  
  return {
    success: true,
    markdown,
    title,
    images: [{ name: file.name, data: base64, type: mimeType }],
  }
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

async function convertDocxToMarkdown(file: File, title: string): Promise<ConversionResult> {
  try {
    const zip = await JSZip.loadAsync(file)
    let markdown = `# ${title}\n\n`
    const images: MediaFile[] = []
    
    const mediaFolder = zip.folder('word/media')
    if (mediaFolder) {
      const mediaFiles: string[] = []
      mediaFolder.forEach((relativePath, zipEntry) => {
        if (!zipEntry.dir) {
          mediaFiles.push(relativePath)
        }
      })
      
      for (const mediaFile of mediaFiles) {
        const fileData = await mediaFolder.file(mediaFile)?.async('base64')
        if (fileData) {
          const ext = mediaFile.split('.').pop()?.toLowerCase() || 'png'
          const mimeType = getMimeType(ext)
          const base64Data = `data:${mimeType};base64,${fileData}`
          images.push({ name: mediaFile, data: base64Data, type: mimeType })
        }
      }
    }
    
    const documentXml = await zip.file('word/document.xml')?.async('string')
    if (!documentXml) {
      return { success: false, markdown: '', title, images: [], error: '无法读取文档内容' }
    }

    const parser = new DOMParser()
    const doc = parser.parseFromString(documentXml, 'application/xml')
    
    const relationshipsXml = await zip.file('word/_rels/document.xml.rels')?.async('string')
    const imageRels: Map<string, string> = new Map()
    
    if (relationshipsXml) {
      const relsDoc = parser.parseFromString(relationshipsXml, 'application/xml')
      const relationships = relsDoc.querySelectorAll('Relationship')
      relationships.forEach((rel) => {
        const id = rel.getAttribute('Id')
        const target = rel.getAttribute('Target')
        if (id && target && target.includes('media/')) {
          imageRels.set(id, target.replace('media/', ''))
        }
      })
    }
    
    const body = doc.querySelector('body')
    if (body) {
      markdown += processDocxNode(body, imageRels, images, parser)
    }

    return { success: true, markdown, title, images }
  } catch (_error) {
    return { success: false, markdown: '', title, images: [], error: 'Word 文档转换失败' }
  }
}

function processDocxNode(
  node: Element,
  imageRels: Map<string, string>,
  images: MediaFile[],
  parser: DOMParser,
  depth: number = 0
): string {
  let result = ''
  
  for (const child of Array.from(node.children)) {
    const tagName = child.tagName.replace(/^w:/, '')
    
    if (tagName === 'p') {
      const pText = processParagraph(child, parser)
      const pStyle = child.querySelector('pStyle')?.getAttribute('w:val') || ''
      
      if (pText.trim()) {
        if (pStyle.startsWith('Heading1') || pStyle === '1') {
          result += `## ${pText}\n\n`
        } else if (pStyle.startsWith('Heading2') || pStyle === '2') {
          result += `### ${pText}\n\n`
        } else if (pStyle.startsWith('Heading3') || pStyle === '3') {
          result += `#### ${pText}\n\n`
        } else {
          result += `${pText}\n\n`
        }
      }
    } else if (tagName === 'tbl') {
      result += processTable(child, parser) + '\n\n'
    } else if (tagName === 'drawing') {
      const blip = child.querySelector('blip')
      const embedId = blip?.getAttribute('r:embed') || blip?.getAttribute('r:id')
      if (embedId) {
        const imageName = imageRels.get(embedId)
        if (imageName) {
          const imageData = images.find((img) => img.name === imageName)
          if (imageData) {
            result += `![图片](${imageData.data})\n\n`
          }
        }
      }
    } else if (child.children.length > 0) {
      result += processDocxNode(child, imageRels, images, parser, depth + 1)
    }
  }
  
  return result
}

function processParagraph(p: Element, _parser: DOMParser): string {
  let text = ''
  const runs = p.querySelectorAll('r')
  
  runs.forEach((run) => {
    const t = run.querySelector('t')
    if (t?.textContent) {
      const isBold = run.querySelector('b') !== null || run.querySelector('bCs') !== null
      const isItalic = run.querySelector('i') !== null || run.querySelector('iCs') !== null
      const isStrike = run.querySelector('strike') !== null
      const underline = run.querySelector('u')
      
      let content = t.textContent
      
      if (isStrike) {
        content = `~~${content}~~`
      }
      if (isBold) {
        content = `**${content}**`
      }
      if (isItalic) {
        content = `*${content}*`
      }
      if (underline) {
        content = `<u>${content}</u>`
      }
      
      text += content
    }
  })
  
  return text
}

function processTable(tbl: Element, parser: DOMParser): string {
  const rows = tbl.querySelectorAll('tr')
  if (rows.length === 0) return ''
  
  let markdown = ''
  const rowData: string[][] = []
  
  rows.forEach((row, _rowIndex) => {
    const cells = row.querySelectorAll('tc')
    const cellTexts: string[] = []
    
    cells.forEach((cell) => {
      let cellText = ''
      const paragraphs = cell.querySelectorAll('p')
      paragraphs.forEach((p) => {
        cellText += processParagraph(p, parser) + ' '
      })
      cellTexts.push(cellText.trim().replace(/\n/g, ' '))
    })
    
    rowData.push(cellTexts)
  })
  
  if (rowData.length > 0) {
    const headerRow = rowData[0]
    markdown += '| ' + headerRow.join(' | ') + ' |\n'
    markdown += '| ' + headerRow.map(() => '---').join(' | ') + ' |\n'
    
    for (let i = 1; i < rowData.length; i++) {
      markdown += '| ' + rowData[i].join(' | ') + ' |\n'
    }
  }
  
  return markdown
}

async function convertExcelToMarkdown(file: File, title: string): Promise<ConversionResult> {
  try {
    const workbook = new ExcelJS.Workbook()
    const arrayBuffer = await file.arrayBuffer()
    await workbook.xlsx.load(arrayBuffer)
    
    let markdown = `# ${title}\n\n`
    const images: MediaFile[] = []
    
    workbook.eachSheet((worksheet, _sheetId) => {
      markdown += `## ${worksheet.name}\n\n`
      
      const tableData: string[][] = []
      worksheet.eachRow((row, _rowNumber) => {
        const rowData: string[] = []
        row.eachCell((cell) => {
          let cellValue = ''
          if (cell.value !== null && cell.value !== undefined) {
            if (typeof cell.value === 'object' && 'text' in cell.value) {
              cellValue = String((cell.value as { text: string }).text)
            } else if (cell.value instanceof Date) {
              cellValue = cell.value.toLocaleDateString()
            } else {
              cellValue = String(cell.value)
            }
          }
          rowData.push(cellValue)
        })
        tableData.push(rowData)
      })
      
      if (tableData.length > 0) {
        const headerRow = tableData[0]
        markdown += '| ' + headerRow.join(' | ') + ' |\n'
        markdown += '| ' + headerRow.map(() => '---').join(' | ') + ' |\n'
        
        for (let i = 1; i < tableData.length; i++) {
          markdown += '| ' + tableData[i].join(' | ') + ' |\n'
        }
        markdown += '\n'
      }
    })

    return { success: true, markdown, title, images }
  } catch (_error) {
    return { success: false, markdown: '', title, images: [], error: 'Excel 文档转换失败' }
  }
}

async function convertPptxToMarkdown(file: File, title: string): Promise<ConversionResult> {
  try {
    const zip = await JSZip.loadAsync(file)
    let markdown = `# ${title}\n\n`
    const images: MediaFile[] = []
    
    const mediaFolder = zip.folder('ppt/media')
    if (mediaFolder) {
      const mediaFiles: string[] = []
      mediaFolder.forEach((relativePath, zipEntry) => {
        if (!zipEntry.dir) {
          mediaFiles.push(relativePath)
        }
      })
      
      for (const mediaFile of mediaFiles) {
        const fileData = await mediaFolder.file(mediaFile)?.async('base64')
        if (fileData) {
          const ext = mediaFile.split('.').pop()?.toLowerCase() || 'png'
          const mimeType = getMimeType(ext)
          const base64Data = `data:${mimeType};base64,${fileData}`
          images.push({ name: mediaFile, data: base64Data, type: mimeType })
        }
      }
    }
    
    const slideFiles: string[] = []
    zip.forEach((relativePath) => {
      if (relativePath.match(/ppt\/slides\/slide\d+\.xml$/)) {
        slideFiles.push(relativePath)
      }
    })
    
    slideFiles.sort((a, b) => {
      const numA = parseInt(a.match(/slide(\d+)/)?.[1] || '0')
      const numB = parseInt(b.match(/slide(\d+)/)?.[1] || '0')
      return numA - numB
    })

    const parser = new DOMParser()
    
    const slideRelsMap = new Map<string, Map<string, string>>()
    void slideRelsMap // 暂未使用，保留以备后续扩展
    
    for (const slideFile of slideFiles) {
      const slideNum = slideFile.match(/slide(\d+)/)?.[1] || ''
      markdown += `## 幻灯片 ${slideNum}\n\n`
      
      const relsFile = slideFile.replace('slides/', 'slides/_rels/') + '.rels'
      const relsXml = await zip.file(relsFile)?.async('string')
      const imageRels: Map<string, string> = new Map()
      
      if (relsXml) {
        const relsDoc = parser.parseFromString(relsXml, 'application/xml')
        const relationships = relsDoc.querySelectorAll('Relationship')
        relationships.forEach((rel) => {
          const id = rel.getAttribute('Id')
          const target = rel.getAttribute('Target')
          if (id && target && target.includes('../media/')) {
            const mediaName = target.replace('../media/', '')
            imageRels.set(id, mediaName)
          }
        })
      }
      
      const slideXml = await zip.file(slideFile)?.async('string')
      if (slideXml) {
        const slideDoc = parser.parseFromString(slideXml, 'application/xml')
        
        const spTree = slideDoc.querySelector('spTree')
        if (spTree) {
          const shapes = spTree.querySelectorAll('sp, pic')
          
          shapes.forEach((shape) => {
            const tagName = shape.tagName.split(':').pop() || shape.tagName
            
            if (tagName === 'pic' || shape.querySelector('pic')) {
              const blip = shape.querySelector('blip') || shape.querySelector('a\\:blip')
              const embedId = blip?.getAttribute('r:embed') || blip?.getAttribute('r:id')
              
              if (embedId) {
                const imageName = imageRels.get(embedId)
                if (imageName) {
                  const imageData = images.find((img) => img.name === imageName)
                  if (imageData) {
                    markdown += `![幻灯片图片](${imageData.data})\n\n`
                  }
                }
              }
            } else {
              const textElements = shape.querySelectorAll('t, a\\:t')
              let shapeText = ''
              textElements.forEach((t) => {
                if (t.textContent?.trim()) {
                  shapeText += t.textContent
                }
              })
              
              if (shapeText.trim()) {
                markdown += `${shapeText}\n\n`
              }
            }
          })
        }
      }
    }

    return { success: true, markdown, title, images }
  } catch (_error) {
    return { success: false, markdown: '', title, images: [], error: 'PPT 文档转换失败' }
  }
}

async function convertPdfToMarkdown(file: File, title: string): Promise<ConversionResult> {
  try {
    const arrayBuffer = await file.arrayBuffer()
    const text = await extractPdfText(arrayBuffer)
    
    let markdown = `# ${title}\n\n`
    markdown += `> 📄 此文档由 PDF 转换而来。PDF 中的图片和复杂格式可能无法完美呈现。\n\n`
    markdown += text
    
    return { success: true, markdown, title, images: [] }
  } catch (_error) {
    return { success: false, markdown: '', title, images: [], error: 'PDF 文档转换失败，请确保 PDF 包含可提取的文本' }
  }
}

async function extractPdfText(arrayBuffer: ArrayBuffer): Promise<string> {
  const decoder = new TextDecoder('utf-8')
  const bytes = new Uint8Array(arrayBuffer)
  let text = ''
  
  const content = decoder.decode(bytes)
  const streamRegex = /stream[\r\n]+([\s\S]*?)[\r\n]+endstream/g
  let match
  
  while ((match = streamRegex.exec(content)) !== null) {
    const streamContent = match[1]
    const textMatches = streamContent.match(/\(([^)]+)\)/g)
    if (textMatches) {
      textMatches.forEach((tm) => {
        const extracted = tm.slice(1, -1)
        if (extracted && !/^[\d\s.-]+$/.test(extracted)) {
          text += extracted + ' '
        }
      })
    }
  }
  
  text = text.replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\t/g, '\t')
  text = text.replace(/\s+/g, ' ').trim()
  
  const paragraphs = text.split(/(?<=[。！？.!?])\s*/)
  return paragraphs.filter(p => p.trim()).join('\n\n')
}

function getMimeType(ext: string): string {
  const mimeTypes: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    bmp: 'image/bmp',
    ico: 'image/x-icon',
    mp4: 'video/mp4',
    webm: 'video/webm',
    ogg: 'video/ogg',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    aac: 'audio/aac',
  }
  return mimeTypes[ext.toLowerCase()] || 'application/octet-stream'
}
