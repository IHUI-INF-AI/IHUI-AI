package com.ai.manager.small.domain.dto;
import com.google.gson.JsonObject;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class AgentUploadDTO {
    private String userId;      // VARCHAR类型
    private String connectorUserId; // 同步写入 agents.connector_user_id
    private String agentId;         // VARCHAR类型
    private String agentName;       // VARCHAR类型
    private String agentDescription;// TEXT类型
    private String agentAvatar;     // VARCHAR类型
    private String agentVariablesIn;
    private String agentVariablesOut;
    private String agentN8nJson;   // JSON字符串
    private String publishStatus;    // VARCHAR类型状态字段
    private String agentUrl;        // VARCHAR类型URL字段
    private String chatId;
    private Boolean streamEnabled;  // 是否走流式输出

    // 包含完整的Getter/Setter方法
}
