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
public class ZhsEducationPlatform extends PageBean {
    private static final long serialVersionUID = 1L;

    /**
     * $column.columnComment
     */
    @Schema(description = "平台id")
    private String id;

    /**
     * 平台编码
     */
    @Schema(description = "平台编码")
    private String code;

    /**
     * 平台名称
     */
    @Schema(description = "平台名称")
    private String name;

    /**
     * 平台使用域名
     */
    @Schema(description = "平台使用域名")
    private String domain;

    /**
     * 封面图（logo）
     */
    @Schema(description = "封面图（logo）")
    private String binding;

    /**
     * 文档文件地址
     */
    @Schema(description = "文档文件地址")
    private String filePath;

    /**
     * 平台类型
     */
    @Schema(description = "平台类型")
    private Integer type;

    /**
     * 平台状态
     */
    @Schema(description = "平台状态")
    private Integer status;

    /**
     * 排序
     */
    @Schema(description = "排序")
    private Integer sort;

    /**
     * 是否显示 0显示 | 1隐藏
     */
    @Schema(description = "是否显示 0显示 | 1隐藏")
    private Integer isHidden;

    /**
     * 逻辑删除 0不删除 | 1删除
     */
    @Schema(description = "逻辑删除 0不删除 | 1删除")
    private Integer isDel;

    /**
     * 备用字段1
     */
    @Schema(description = "备用字段1")
    private String field1;

    /**
     * $column.columnComment
     */
    @Schema(description = "备用字段2")
    private String field2;

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

    @Schema(description = "备注")
    private String remark;
}
