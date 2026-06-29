package com.ai.manager.small.service;

import com.ai.manager.small.domain.dto.AgentRequestDTO;
import com.ai.manager.small.domain.dto.AgentUploadDTO;
import com.google.gson.JsonObject;
import org.springframework.http.ResponseEntity;

import java.util.Map;

public interface AgentUploadService {
    ResponseEntity<String> uploadAgent(AgentUploadDTO agentUploadDTO);
    ResponseEntity<String> uploadAgent(String rawPayload);
    AgentRequestDTO buildAgentRequest(String rawPayload);

    Map<String, Object> selectByAgentId(String agentId);

    String processAgentRequest(AgentRequestDTO agentRequestDTO);

    JsonObject processAgentRequestRaw(AgentRequestDTO agentRequestDTO);

    Map<String, Object> processAgentPayload(String rawBody);

    Map<String, Object> processAgentRequestWebsocketBridge(AgentRequestDTO agentRequestDTO);
    Map<String, Object> processAgentRequestStream(AgentRequestDTO agentRequestDTO);

    boolean isAgentStreamEnabled(String agentId);
}
