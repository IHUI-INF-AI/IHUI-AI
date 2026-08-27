import type { CompetitorConfig } from './types'
import { COMPETITORS_PART_1 } from './competitors-parts/part-1'
import { COMPETITORS_PART_2 } from './competitors-parts/part-2'
import { COMPETITORS_PART_3 } from './competitors-parts/part-3'
import { COMPETITORS_PART_4 } from './competitors-parts/part-4'
import { COMPETITORS_PART_5 } from './competitors-parts/part-5'
import { COMPETITORS_PART_6 } from './competitors-parts/part-6'
import { COMPETITORS_PART_7 } from './competitors-parts/part-7'
import { COMPETITORS_PART_8 } from './competitors-parts/part-8'
import { COMPETITORS_PART_9 } from './competitors-parts/part-9'
import { COMPETITORS_PART_10 } from './competitors-parts/part-10'
import { COMPETITORS_PART_11 } from './competitors-parts/part-11'
import { COMPETITORS_PART_12 } from './competitors-parts/part-12'

export const COMPETITORS = {
  ...COMPETITORS_PART_1,
  ...COMPETITORS_PART_2,
  ...COMPETITORS_PART_3,
  ...COMPETITORS_PART_4,
  ...COMPETITORS_PART_5,
  ...COMPETITORS_PART_6,
  ...COMPETITORS_PART_7,
  ...COMPETITORS_PART_8,
  ...COMPETITORS_PART_9,
  ...COMPETITORS_PART_10,
  ...COMPETITORS_PART_11,
  ...COMPETITORS_PART_12,
} as Record<CompetitorConfig['id'], CompetitorConfig>
