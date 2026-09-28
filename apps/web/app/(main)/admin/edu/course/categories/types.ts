// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

export interface Category {
  id: string
  code: string
  name: string
  prentId?: string
  typeId?: string
  img?: string
  butImg?: string
  isInvalid?: number
  sort?: number
  creator?: string
  createdTime?: string
}

export interface CForm {
  code: string
  name: string
  prentId: string
  typeId: string
  img: string
  butImg: string
  isInvalid: string
  sort: string
}
