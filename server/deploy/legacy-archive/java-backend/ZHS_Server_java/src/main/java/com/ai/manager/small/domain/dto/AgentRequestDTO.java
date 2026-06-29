package com.ai.manager.small.domain.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AgentRequestDTO {
    private int countingUnit;//单位
    private String agentId;
    private String userUuid;
    private String problem;
    private String chatId;
    private String userUrl;
//    private Map problem;

    // getters/setters
}