package com.ai.manager.small.domain;

import lombok.*;

@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
@ToString
public class AgentRuleLink {
    private Integer id;
    private String agentId;
    private String ruleId;
}
