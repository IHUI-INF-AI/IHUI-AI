import type { CompetitorConfig } from './types'

import { agentFrameworksCompetitorsPart1 } from './agent-frameworks-part1'
import { agentFrameworksCompetitorsPart2 } from './agent-frameworks-part2'

export const agentFrameworksCompetitors: Partial<Record<CompetitorConfig['id'], CompetitorConfig>> =
  {
    ...agentFrameworksCompetitorsPart1,
    ...agentFrameworksCompetitorsPart2,
  }
