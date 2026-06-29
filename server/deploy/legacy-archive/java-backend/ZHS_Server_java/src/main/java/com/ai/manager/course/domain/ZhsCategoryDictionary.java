package com.ai.manager.course.domain;

import java.io.Serializable;
import java.util.Date;
import java.util.List;

import com.fasterxml.jackson.annotation.JsonFormat;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.*;

/**
 * 赛道字典对象 zhs_category_dictionary
 * 
 * @author Raindrop_L
 * @date 2025-09-02
 */

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@ToString
public class ZhsCategoryDictionary implements Serializable
{
    private static final long serialVersionUID = 1L;

    /** UUID */
    @Schema(description = "UUID")
    private String id;

    /** code */
    @Schema(description = "code")
    private String code;

    /** 字段名 */
    @Schema(description = "字段名")
    private String name;

    /** 父ID */
    @Schema(description = "父ID")
    private String prentId;

    /** 使用类型id */
    @Schema(description = "使用类型id")
    private String typeId;

    /** 是否失效 0有效 | 1 失效 */
    @Schema(description = "是否失效 0有效 | 1 失效")
    private Integer isInvalid;

    /** 显示图片 */
    @Schema(description = "显示图片")
    private String img;

    /** 点击后显示图片 */
    @Schema(description = "点击后显示图片")
    private String butImg;

    /** 排序字段 */
    @Schema(description = "排序字段")
    private Integer sort;

    /** 创建人ID */
    @Schema(description = "创建人ID")
    private Long creator;

    /** 创建时间 */
    @Schema(description = "创建时间")
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:dd")
    private Date createdTime;

    /** 修改人id */
    @Schema(description = "修改人id")
    private Long update;

    /** 修改时间 */
    @Schema(description = "修改时间")
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:dd")
    private Date updatedTime;

    List<String> parentIds;

    List<ZhsCategoryDictionary> children;
}
