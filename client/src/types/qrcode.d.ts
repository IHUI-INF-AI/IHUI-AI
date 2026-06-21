declare module 'qrcode/lib/browser' {
  import { QRCodeToDataURLOptions } from 'qrcode'
  
  export function toDataURL(text: string, options?: QRCodeToDataURLOptions): Promise<string>
  export default {
    toDataURL: (_text: string, _options?: QRCodeToDataURLOptions) => Promise<string>
  }
}
