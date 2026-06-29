// 创建新的配置类文件
package com.ai.manager.core.config;

import com.ai.manager.mcp.websocket.TimbreWebSocket;
import com.ai.manager.mcp.websocket.TtsWebSocket;
import com.ai.manager.small.websocket.AgentStreamWebSocket;
import com.ai.manager.mcp.websocket.TimbreWebSocket;
import org.springframework.context.ApplicationContext;
import org.springframework.context.ApplicationContextAware;
import org.springframework.stereotype.Component;

@Component
public class WebSocketContextConfig implements ApplicationContextAware {

    private static ApplicationContext applicationContext;

    @Override
    public void setApplicationContext(ApplicationContext context) {
        applicationContext = context;
        // 设置所有WebSocket的ApplicationContext
        // 设置 WebSocket 端点可访问 Spring Bean
        TtsWebSocket.setApplicationContext(applicationContext);
        TimbreWebSocket.setApplicationContext(applicationContext);
        TimbreWebSocket.setApplicationContext(applicationContext);
        AgentStreamWebSocket.setApplicationContext(applicationContext);
    }

    public static ApplicationContext getApplicationContext() {
        return applicationContext;
    }
}