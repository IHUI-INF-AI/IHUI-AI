export interface ExportOptions {
  filename?: string
  backgroundColor?: string
  [key: string]: unknown
}

export function exportElementToPDF(
  element: HTMLElement | string,
  filenameOrOptions?: string | ExportOptions,
  options?: ExportOptions
): Promise<void> {
  return Promise.resolve()
}

export function printElement(
  element: HTMLElement | string,
  options?: ExportOptions
): Promise<void> {
  return Promise.resolve()
}
