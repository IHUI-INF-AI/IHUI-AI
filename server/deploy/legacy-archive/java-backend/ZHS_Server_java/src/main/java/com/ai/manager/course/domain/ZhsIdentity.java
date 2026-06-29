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
public class ZhsIdentity extends PageBean {
    private static final long serialVersionUID = 1L;

    /**
     * 主键 也做排序用
     */
    @Schema(description = "身份id")
    private Integer id;

    /**
     * $column.columnComment
     */
    @Schema(description = "唯一标识")
    private String uuid;

    /**
     * 身份名称
     */
    @Schema(description = "身份名称")
    private String name;

    /**
     * 归属平台id
     */
    @Schema(description = "归属平台id")
    private String platformId;

    /**
     * 归属机构id
     */
    @Schema(description = "归属机构id")
    private String organizationId;

    /**
     * 上级身份id
     */
    @Schema(description = "上级身份id")
    private String parentId;

    /**
     * 封面（logo）
     */
    @Schema(description = "封面（logo）")
    private String binding;

    /**
     * 逻辑隐藏 0显示 | 显示
     */
    @Schema(description = "逻辑隐藏 0显示 | 1隐藏")
    private Integer isHidden;

    /**
     * 逻辑删除 0保留 | 1删除
     */
    @Schema(description = "逻辑删除 0保留 | 1删除")
    private Integer isDel;

    /**
     * 是否允许跨平台管理 0否 | 1是
     */
    @Schema(description = "是否允许跨平台管理 0否 | 1是")
    private Integer isCross;

    /**
     * 创建人
     */
    @Schema(description = "创建人")
    private String creator;

    /**
     * 创建时间
     */
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    @Schema(description = "创建时间")
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
