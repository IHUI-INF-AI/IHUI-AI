// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

export interface User {
  id: string
  phone: string
  email: string
  nickname: string
  avatar: string
  familyId: string
  roleId: number
  status: number
  createdAt: string
  updatedAt: string
}

export interface UserProfile extends User {
  bio: string
  gender: number
  birthday: string
}

export interface AuthToken {
  accessToken: string
  refreshToken: string
  expiresIn: number
  tokenType: string
}
