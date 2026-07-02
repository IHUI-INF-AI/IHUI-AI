/**
 * 通用导出服务：DOM 元素 → PDF / 图片
 *
 * 设计原则：业务组件不直接调 html2canvas/jspdf，统一走本工具
 *
 * 使用示例：
 *   import { exportElementToPDF, exportElementToImage, printElement } from '@/utils/exportService'
 *   await exportElementToPDF(elementRef.value, {
 *     filename: 'report.pdf',
 *     backgroundColor: isDark.value ? '#6a6d77' : '#ffffff'
 *   })
 *
 * 暗色模式注意：html2canvas 默认背景透明，PDF 会变黑。
 * 调用方必须根据当前主题显式传入 backgroundColor：
 *   - 浅色: '#ffffff'
 *   - 暗色: '#6a6d77'（项目 darkSurface 主题色，见 _theme-tokens.ts）
 */

import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

export interface ExportOptions {
  /** 输出文件名（含扩展名），默认 'export.pdf' / 'export.png' */
  filename?: string
  /** 背景色，暗色模式必须显式传入，默认 '#ffffff' */
  backgroundColor?: string
  /** 渲染缩放，默认 2（高清） */
  scale?: number
  /** PDF 方向：'p' 纵向（默认）/ 'l' 横向 */
  orientation?: 'p' | 'l'
}

const DEFAULT_BACKGROUND = '#ffffff'
const DEFAULT_SCALE = 2
const A4_WIDTH_MM = 210
const A4_HEIGHT_MM = 297
const PDF_MARGIN_MM = 10

/**
 * 将 DOM 元素导出为图片 dataURL
 * @param element 目标 DOM 元素
 * @param options 导出选项
 * @returns dataURL 字符串（PNG 格式），可用于预览或 <img> 展示
 */
export async function exportElementToImage(
  element: HTMLElement,
  options?: ExportOptions
): Promise<string> {
  const backgroundColor = options?.backgroundColor ?? DEFAULT_BACKGROUND
  const scale = options?.scale ?? DEFAULT_SCALE

  const canvas = await html2canvas(element, {
    backgroundColor,
    scale,
    useCORS: true,
    logging: false,
    windowWidth: element.scrollWidth,
    windowHeight: element.scrollHeight,
  })

  return canvas.toDataURL('image/png')
}

/**
 * 将 DOM 元素导出为 PDF 文件（自动分页，A4 纵向，10mm margin）
 * @param element 目标 DOM 元素
 * @param options 导出选项
 */
export async function exportElementToPDF(
  element: HTMLElement,
  options?: ExportOptions
): Promise<void> {
  const filename = options?.filename ?? 'export.pdf'
  const backgroundColor = options?.backgroundColor ?? DEFAULT_BACKGROUND
  const scale = options?.scale ?? DEFAULT_SCALE
  const orientation = options?.orientation ?? 'p'

  const canvas = await html2canvas(element, {
    backgroundColor,
    scale,
    useCORS: true,
    logging: false,
    windowWidth: element.scrollWidth,
    windowHeight: element.scrollHeight,
  })

  const pdf = new jsPDF({
    orientation,
    unit: 'mm',
    format: 'a4',
  })

  const pageWidth = orientation === 'p' ? A4_WIDTH_MM : A4_HEIGHT_MM
  const pageHeight = orientation === 'p' ? A4_HEIGHT_MM : A4_WIDTH_MM
  const contentWidth = pageWidth - PDF_MARGIN_MM * 2
  const contentHeight = pageHeight - PDF_MARGIN_MM * 2

  // 计算图片在 PDF 中的渲染尺寸（按宽度等比缩放）
  const imgWidth = contentWidth
  const imgHeight = (canvas.height * imgWidth) / canvas.width

  const imgData = canvas.toDataURL('image/png')

  // 单页可容纳
  if (imgHeight <= contentHeight) {
    pdf.addImage(imgData, 'PNG', PDF_MARGIN_MM, PDF_MARGIN_MM, imgWidth, imgHeight)
  } else {
    // 多页分页：把 canvas 按页高切分渲染
    const pageHeightPx = (canvas.width * contentHeight) / contentWidth
    const totalPages = Math.ceil(canvas.height / pageHeightPx)

    // 用临时 canvas 切片
    const sliceCanvas = document.createElement('canvas')
    sliceCanvas.width = canvas.width
    sliceCanvas.height = pageHeightPx
    const ctx = sliceCanvas.getContext('2d')
    if (!ctx) throw new Error('exportService: 无法创建 canvas context')

    for (let i = 0; i < totalPages; i++) {
      if (i > 0) pdf.addPage()

      const startY = i * pageHeightPx
      const drawHeight = Math.min(pageHeightPx, canvas.height - startY)

      // 清空切片 canvas 并填充背景色
      ctx.fillStyle = backgroundColor
      ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height)

      // 从源 canvas 截取一段绘制到切片 canvas
      ctx.drawImage(
        canvas,
        0,
        startY,
        canvas.width,
        drawHeight,
        0,
        0,
        canvas.width,
        drawHeight
      )

      const sliceData = sliceCanvas.toDataURL('image/png')
      const sliceImgHeight = (drawHeight * imgWidth) / canvas.width
      pdf.addImage(sliceData, 'PNG', PDF_MARGIN_MM, PDF_MARGIN_MM, imgWidth, sliceImgHeight)
    }
  }

  pdf.save(filename)
}

/**
 * 打印 DOM 元素（打开新窗口写入图片 + 调用浏览器打印）
 * @param element 目标 DOM 元素
 * @param options 导出选项
 */
export async function printElement(
  element: HTMLElement,
  options?: ExportOptions
): Promise<void> {
  const backgroundColor = options?.backgroundColor ?? DEFAULT_BACKGROUND
  const scale = options?.scale ?? DEFAULT_SCALE

  const canvas = await html2canvas(element, {
    backgroundColor,
    scale,
    useCORS: true,
    logging: false,
    windowWidth: element.scrollWidth,
    windowHeight: element.scrollHeight,
  })

  const imgData = canvas.toDataURL('image/png')
  const printWindow = window.open('', '_blank', 'width=800,height=600')
  if (!printWindow) {
    throw new Error('exportService: 无法打开打印窗口，请检查浏览器弹窗拦截设置')
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>打印</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { background: ${backgroundColor}; display: flex; justify-content: center; padding: 10mm; }
        img { max-width: 100%; height: auto; }
        @media print {
          body { padding: 0; }
          @page { margin: 10mm; }
        }
      </style>
    </head>
    <body>
      <img src="${imgData}" onload="window.focus(); window.print(); window.onafterprint = () => window.close();" />
    </body>
    </html>
  `)
  printWindow.document.close()
}

export default {
  exportElementToImage,
  exportElementToPDF,
  printElement,
}
