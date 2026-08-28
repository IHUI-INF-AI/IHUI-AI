import type { CompetitorConfig } from './types'

import { agentFrameworksCompetitors } from './agent-frameworks'
import { domesticAiPlatformsCompetitors } from './domestic-ai-platforms'
import { internationalSaasCompetitors } from './international-saas'
import { aiCodingAssistantsCompetitors } from './ai-coding-assistants'

export const COMPETITORS = {
  ...agentFrameworksCompetitors,
  ...domesticAiPlatformsCompetitors,
  ...internationalSaasCompetitors,
  ...aiCodingAssistantsCompetitors,
} as Record<CompetitorConfig['id'], CompetitorConfig>
