package com.ai.manager.course.domain;

import com.ai.manager.small.domain.dto.PageBean;
import com.fasterxml.jackson.annotation.JsonFormat;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.*;

import java.util.Date;

@EqualsAndHashCode(callSuper = true)
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@ToString
public class ZhsUserPlatform extends PageBean {
    private static final long serialVersionUID = 1L;

    /**
     * $column.columnComment
     */
    @Schema(description = "唯一标识")
    private Integer id;

    /**
     * 中心库用户id
     */
    @Schema(description = "中心库用户id")
    private String userUuid;

    /**
     * 平台id
     */
    @Schema(description = "平台id")
    private String platformId;

    /**
     * 用户关于平台身份（为空则为游客）
     */
    @Schema(description = "用户关于平台身份（为空则为游客）")
    private String identityId;

    /**
     * 状态 （预留字段）
     */
    @Schema(description = "状态 （预留字段）")
    private Integer status;

    /**
     * 逻辑删除 0保留 | 1删除
     */
    @Schema(description = "逻辑删除 0保留 | 1删除")
    private Integer isDel;

    /**
     * 预留字段
     */
    @Schema(description = "预留字段")
    private String field1;

    /**
     * 注册时间
     */
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    @Schema(description = "注册时间")
    private Date createdAt;

    /**
     * 修改人
     */
    @Schema(description = "修改人")
    private String updator;

    /**
     * 修改时间
     */
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    @Schema(description = "修改时间")
    private Date updatedAt;

}
