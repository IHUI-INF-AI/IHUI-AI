import type { PricingConfig } from './types'

export function calculateCost(
  pricing: PricingConfig,
  inputTokens: number,
  outputTokens: number,
  region?: string,
  _quantity: number = 1
): {
  inputCost: number
  outputCost: number
  totalCost: number
  discount: number
  finalCost: number
} {
  let inputTokenPrice = pricing.inputTokenPrice
  let outputTokenPrice = pricing.outputTokenPrice

  if (region && pricing.regionPricing?.[region]) {
    const regionPricing = pricing.regionPricing[region]
    inputTokenPrice = regionPricing.inputTokenPrice
    outputTokenPrice = regionPricing.outputTokenPrice
  }

  const inputCost = (inputTokens / 1000) * inputTokenPrice
  const outputCost = (outputTokens / 1000) * outputTokenPrice
  const totalCost = inputCost + outputCost

  let discount = 0
  if (pricing.bulkDiscounts) {
    const totalTokens = inputTokens + outputTokens
    const { thresholds, discounts: discountRates } = pricing.bulkDiscounts

    for (let i = thresholds.length - 1; i >= 0; i--) {
      if (totalTokens >= thresholds[i] && discountRates[i] !== undefined) {
        discount = discountRates[i]
        break
      }
    }
  }

  const finalCost = totalCost * (1 - discount)

  return {
    inputCost,
    outputCost,
    totalCost,
    discount,
    finalCost,
  }
}

export function formatPrice(price: number, decimals: number = 6): string {
  return `$${price.toFixed(decimals)}`
}

export function formatTokens(tokens: number): string {
  if (tokens >= 1000000) {
    return `${(tokens / 1000000).toFixed(2)}M`
  } else if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(2)}K`
  }
  return tokens.toString()
}

export function validatePricing(pricing: PricingConfig): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  if (pricing.inputTokenPrice < 0) {
    errors.push('输入Token价格不能为负数')
  }
  if (pricing.outputTokenPrice < 0) {
    errors.push('输出Token价格不能为负数')
  }
  if (pricing.imagePrice !== undefined && pricing.imagePrice < 0) {
    errors.push('图像价格不能为负数')
  }
  if (pricing.audioPrice !== undefined && pricing.audioPrice < 0) {
    errors.push('音频价格不能为负数')
  }
  if (pricing.videoPrice !== undefined && pricing.videoPrice < 0) {
    errors.push('视频价格不能为负数')
  }

  if (pricing.bulkDiscounts) {
    const { thresholds, discounts } = pricing.bulkDiscounts
    if (thresholds.length !== discounts.length) {
      errors.push('批量折扣的阈值和折扣率数量必须一致')
    }
    for (let i = 0; i < thresholds.length; i++) {
      if (thresholds[i] < 0) {
        errors.push(`批量折扣阈值${i + 1}不能为负数`)
      }
      if (discounts[i] < 0 || discounts[i] > 1) {
        errors.push(`批量折扣率${i + 1}必须在0-1之间`)
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}
