package com.ai.manager.small.domain.vo;

import com.ai.manager.small.domain.AgentCategory;
import lombok.*;

/**
 * 智能体类型对象 agent_category
 * 
 * @author Raindrop_L
 * @date 2025-08-07
 */

@EqualsAndHashCode(callSuper = true)
@Data
@NoArgsConstructor
@AllArgsConstructor
@ToString
public class AgentCategoryVO extends AgentCategory
{
    private String agentId;
}
