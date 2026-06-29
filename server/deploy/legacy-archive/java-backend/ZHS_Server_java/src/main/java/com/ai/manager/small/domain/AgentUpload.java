package com.ai.manager.small.domain;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

//小表
@Data
@AllArgsConstructor
@NoArgsConstructor
public class AgentUpload {
    private String agentId;         // 对应VARCHAR(36)主键
    private String agentName;       // 对应VARCHAR(255)
    private String agentDescription;// 对应TEXT类型
    private String agentAvatar;     // 对应VARCHAR(255)
    private String agentVariablesIn;  // 对应TEXT类型
    private String agentVariablesOut;// 对应TEXT类型
    private String agentN8nJson;    // 对应JSON类型
    private String agentUrl;
    private String publishStatus;
    private Integer countingUnit;
    private String type;        // 对应DATETIME类型
    private Boolean streamEnabled;   // 是否走流式返回
}
