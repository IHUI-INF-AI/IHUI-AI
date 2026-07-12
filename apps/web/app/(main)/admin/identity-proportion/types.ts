export interface IdentityProportion {
  id: string
  identityType: string
  gift: string | null
  tokenProportion: string | null
  vipGift: string | null
  routineProportion: string | null
  beginTime: string | null
  endTime: string | null
  status: number
}

export interface ListData {
  list: IdentityProportion[]
  total: number
}

export interface IdentityProportionForm {
  identityType: string
  gift: string
  tokenProportion: string
  vipGift: string
  routineProportion: string
  beginTime: string
  endTime: string
  status: boolean
}
