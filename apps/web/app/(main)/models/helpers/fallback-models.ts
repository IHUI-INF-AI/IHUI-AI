import type { Model } from '../types'
import { FALLBACK_MODELS_PART_1 } from './fallback-models-parts/part-1'
import { FALLBACK_MODELS_PART_2 } from './fallback-models-parts/part-2'
import { FALLBACK_MODELS_PART_3 } from './fallback-models-parts/part-3'
import { FALLBACK_MODELS_PART_4 } from './fallback-models-parts/part-4'
import { FALLBACK_MODELS_PART_5 } from './fallback-models-parts/part-5'
import { FALLBACK_MODELS_PART_6 } from './fallback-models-parts/part-6'
import { FALLBACK_MODELS_PART_7 } from './fallback-models-parts/part-7'
import { FALLBACK_MODELS_PART_8 } from './fallback-models-parts/part-8'

export const FALLBACK_MODELS: Model[] = [
  ...FALLBACK_MODELS_PART_1,
  ...FALLBACK_MODELS_PART_2,
  ...FALLBACK_MODELS_PART_3,
  ...FALLBACK_MODELS_PART_4,
  ...FALLBACK_MODELS_PART_5,
  ...FALLBACK_MODELS_PART_6,
  ...FALLBACK_MODELS_PART_7,
  ...FALLBACK_MODELS_PART_8,
]
