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
public class ZhsOrganization extends PageBean {
    private static final long serialVersionUID = 1L;

    /**
     * 主键 也做排序使用
     */
    @Schema(description = "机构id")
    private Integer id;

    /**
     * 唯一标识
     */
    @Schema(description = "唯一标识")
    private String uuid;

    /**
     * 平台id
     */
    @Schema(description = "平台id")
    private String platformId;

    /**
     * 机构名称
     */
    @Schema(description = "机构名称")
    private String name;

    /**
     * 机构文件存储路径 逗号分割
     */
    @Schema(description = "机构文件存储路径 逗号分割")
    private String filePath;

    /**
     * 封面图 （logo）
     */
    @Schema(description = "封面图 （logo）")
    private String binding;

    /**
     * 逻辑隐藏 0显示 | 1隐藏
     */
    @Schema(description = "逻辑隐藏 0显示 | 1隐藏")
    private Integer isHidden;

    /**
     * 逻辑删除 0使用 | 1删除
     */
    @Schema(description = "逻辑删除 0使用 | 1删除")
    private Integer isDel;

    /**
     * 创建者
     */
    @Schema(description = "创建者")
    private String creator;

    /**
     * 创建时间
     */
    @JsonFormat(pattern = "yyyy-MM-dd")
    @Schema(description = "创建时间")
    private Date createdAt;

    /**
     * 修改者
     */
    @Schema(description = "修改者")
    private String updator;

    /**
     * 修改时间
     */
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    @Schema(description = "修改时间")
    private Date updatedAt;

}
