export interface Template {
  id: string
  name: string
  description: string | null
  awardingOrganization: string | null
  awarderName: string | null
  awardConditions: string | null
  validityPolicy: string | null
  backgroundImage: string | null
  templateConfig: Record<string, unknown> | null
  status: number
  createdAt: string
}

export interface TForm {
  name: string
  description: string
  awardingOrganization: string
  awarderName: string
  awardConditions: string
  validityPolicy: string
  validDays: string
  validFrom: string
  validTo: string
  backgroundImage: string
  templateConfig: string
  status: boolean
}
