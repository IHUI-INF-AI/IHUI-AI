package com.ihui.ai.sdk.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.Map;

/**
 * MCP 工具调用请求(POST /v1/tools/call)。
 */
@JsonIgnoreProperties(ignoreUnknown = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ToolCallRequest {

    @JsonProperty("name")
    private String name;

    @JsonProperty("arguments")
    private Map<String, Object> arguments;

    @JsonProperty("server")
    private String server;

    /** @return 工具名称。 */
    public String getName() {
        return name;
    }

    /** @param name 工具名称。 */
    public void setName(String name) {
        this.name = name;
    }

    /** @return 工具参数。 */
    public Map<String, Object> getArguments() {
        return arguments;
    }

    /** @param arguments 工具参数。 */
    public void setArguments(Map<String, Object> arguments) {
        this.arguments = arguments;
    }

    /** @return MCP server 名称。 */
    public String getServer() {
        return server;
    }

    /** @param server MCP server 名称。 */
    public void setServer(String server) {
        this.server = server;
    }
}
