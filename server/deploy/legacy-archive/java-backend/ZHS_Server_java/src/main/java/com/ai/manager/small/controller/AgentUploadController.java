package com.ai.manager.small.controller;

import com.ai.manager.core.annotation.SkipLogin;
import com.ai.manager.small.domain.dto.AgentUploadDTO;
import com.ai.manager.small.service.AgentUploadService;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@SkipLogin
@RestController
@RequestMapping("/api/agent")
@RequiredArgsConstructor
public class AgentUploadController {

    private final AgentUploadService agentUploadService;

    @PostMapping("/upload")
    public ResponseEntity<String> uploadAgent(@RequestBody AgentUploadDTO agentUploadDTO) {
        return agentUploadService.uploadAgent(agentUploadDTO);
    }

    @GetMapping("/select")
    public ResponseEntity<Map<String, Object>> selectAgentVariables(@RequestParam String agentId) {
        Map<String, Object> agentVariables = agentUploadService.selectByAgentId(agentId);
        if (agentVariables == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(agentVariables);
    }

    @PostMapping(value = "/process", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> processAgent(@RequestBody String rawBody) {
        try {
            return ResponseEntity.ok(agentUploadService.processAgentPayload(rawBody));
        } catch (IllegalArgumentException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, ex.getMessage(), ex);
        }
    }

}
