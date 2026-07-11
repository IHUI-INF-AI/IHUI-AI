declare module 'html2canvas' {
  interface Html2CanvasOptions {
    scale?: number
    backgroundColor?: string | null
    useCORS?: boolean
    logging?: boolean
    width?: number
    height?: number
    [key: string]: unknown
  }

  interface Html2CanvasResult {
    toDataURL(type?: string, quality?: number): string
  }

  function html2canvas(
    element: HTMLElement,
    options?: Html2CanvasOptions,
  ): Promise<Html2CanvasResult>

  export default html2canvas
}
