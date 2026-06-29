package com.ai.manager.small.domain;

import com.ai.manager.small.domain.dto.PageBean;
import com.fasterxml.jackson.annotation.JsonFormat;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.*;

import java.util.Date;

/**
 * 用户形象对象 zhs_user_agent_image
 * 
 * @author Raindrop_L
 * @date 2025-09-30
 */

@EqualsAndHashCode(callSuper = true)
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@ToString
public class ZhsUserAgentImage extends PageBean
{
    private static final long serialVersionUID = 1L;

    /** $column.columnComment */
    private Long id;

    /** $column.columnComment */
    @Schema(description = "用户id")
    private String userUuid;

    /** 形象Id */
    @Schema(description = "形象Id")
    private String imageId;

    /** 形象原始文件 */
    @Schema(description = "形象原始文件")
    private String imagePath;

    /** 形象名称 */
    @Schema(description = "形象名称")
    private String imageName;

    /** 形象类型 0音频 | 1图片 | 2图片 */
    @Schema(description = "形象类型 0音频 | 1图片 | 2图片")
    private Integer type;

    /** 来源平台 */
    @Schema(description = "来源平台")
    private String platform;

    /** 来源模型名 */
    @Schema(description = "来源模型名")
    private String modelName;

    /** 创建时间 */
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:dd")
    @Schema(description = "创建时间")
    private Date createdAt;

    /** 修改时间 */
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:dd")
    @Schema(description = "修改时间")
    private Date updatedAt;

}
