package com.ai.manager.course.domain.dto;

import com.ai.manager.course.domain.ZhsCoursePay;
import com.ai.manager.course.domain.vo.ZhsCategoryDictionaryVO;
import com.ai.manager.small.domain.dto.PageBean;
import com.ai.manager.small.domain.vo.AgentCategoryVO;
import com.fasterxml.jackson.annotation.JsonFormat;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.*;

import java.util.Date;
import java.util.List;

/**
 * 课程对象 zhs_course
 * 
 * @author Raindrop_L
 * @date 2025-08-29
 */

@EqualsAndHashCode(callSuper = true)
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@ToString
public class ZhsCourseDTO extends PageBean
{
    private static final long serialVersionUID = 1L;

    /** 唯一标识 */
    @Schema(name =  "id",description = "唯一标识")
    private String id;

    /** 标题 */
    @Schema(name =  "title",description = "标题")
    private String title;

    /** 副标题 */
    @Schema(name =  "subtitle",description = "副标题")
    private String subtitle;

    /** 正文 */
    @Schema(name =  "content",description = "正文")
    private String content;

    /** 描述附件 */
    @Schema(name =  "remarkFile",description = "描述附件")
    private String remarkFile;

    /** 封面 */
    @Schema(name =  "binding",description = "封面")
    private String binding;

    /** 阶段 0入门 | 1进阶 | 2精通 */
    @Schema(name =  "stage",description = "阶段 0入门 | 1进阶 | 2精通")
    private Integer stage;

    /** 逻辑隐藏 0可用 | 1隐藏 */
    @Schema(name =  "isHidden",description = "逻辑隐藏0可用 | 1隐藏")
    private Integer isHidden;

    /** 逻辑删除 0可用 |1删除 */
    @Schema(name =  "isDel",description = "逻辑删除 0可用 |1删除")
    private Integer isDel;

    /** 排序字段 */
    @Schema(name =  "sort",description = "排序字段")
    private Integer sort;

    /** 创建人 */
    @Schema(name =  "creator",description = "创建人")
    private String creator;

    /** 创建时间 */
    @Schema(name =  "createdAt",description = "创建时间")
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:dd")
    private Date createdAt;

    /** 修改人 */
    @Schema(name =  "updator",description = "修改人")
    private String updator;

    /** 修改时间 */
    @Schema(name =  "updatedAt",description = "修改时间")
    private Date updatedAt;

    @Schema(name =  "remark",description = "备注")
    private String remark;

    @Schema(name =  "label",description = "自定义标签")
    private String label;

    /** 价格表 */
    @Schema(name =  "pay",description = "价格表")
    private ZhsCoursePay pay;

    /** 种类 */
    @Schema(name =  "types",description = "种类")
    private String types;
    /** 赛道 */
    @Schema(name =  "categorys",description = "赛道")
    private String categorys;

    @Schema(name =  "platform",description = "平台")
    private String platform;


    @Schema(name =  "typeList",description = "回参标签")
    private List<AgentCategoryVO> typeList;

    @Schema(name =  "categoryList",description = "回参赛道")
    private List<ZhsCategoryDictionaryVO> categoryList;


}
