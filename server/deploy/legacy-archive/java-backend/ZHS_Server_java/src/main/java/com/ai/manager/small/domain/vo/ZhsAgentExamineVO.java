package com.ai.manager.small.domain.vo;

import com.ai.manager.small.domain.ZhsAgentCategory;
import com.ai.manager.small.domain.ZhsAgentExamine;
import lombok.*;

/**
 * 开发者智能体审核对象 zhs_agent_examine
 *
 * @author Raindrop_L
 * @date 2025-08-12
 */

@EqualsAndHashCode(callSuper = true)
@Data
@NoArgsConstructor
@AllArgsConstructor
@ToString
public class ZhsAgentExamineVO extends ZhsAgentExamine
{
    private static final long serialVersionUID = 1L;
    private String visitUrl;
    private ZhsAgentCategory agentCategory;
}
