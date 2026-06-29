package com.ai.manager.mcp.domain;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.*;

import java.io.Serializable;
import java.util.List;
import java.util.Map;

/**
 * 智能体发布事件内容Bean
 *
 * @author 豆包编程助手
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@ToString
@Schema(name = "tbox自定义参数")
public class TBoxAgentCustomBean implements Serializable {
    private static final long serialVersionUID = 1L;

    @Schema(description = "欢迎语")
    private String welcom;

    @Schema(description = "常用功能1")
    private String question1;

    @Schema(description = "常用功能2")
    private String question2;

    @Schema(description = "当前用户唯一标识")
    private String uuid;

}