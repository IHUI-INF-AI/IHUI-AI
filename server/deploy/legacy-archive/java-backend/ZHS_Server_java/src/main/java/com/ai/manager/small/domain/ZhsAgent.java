package com.ai.manager.small.domain;

import lombok.*;

import java.io.Serializable;
import java.util.Date;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@ToString
public class ZhsAgent implements Serializable {
    private static final long serialVersionUID = 1L;

    /** 主键 */
    private String id;

    /** 智能体名称 */
    private String name;

    /** 单次点击消耗token数量 */
    private Integer consume;

    /** 图片路径 */
    private String image;

    /** 智能体路径 */
    private String url;

    /** 说明 */
    private String info;

    /** 页面展示排序 */
    private Integer seqencing;

    /** 智能体价格 单位分 */
    private Integer price;

    /** 智能体类型 0文本 | 1图片 | 2视频 | 3音频 | 4其他 */
    private Integer type;

    /** 是否隐藏 0隐藏 | 1显示 */
    private Integer isHidden;

    /** 是否开启 0 关闭 | 1启用 */
    private Integer isOpen;

    /** 热度 */
    private Integer heat;

    /** 备用字段 */
    private String field1;

    /** 备用字段 */
    private String field2;

    /** 备用字段 */
    private String field3;

    /** 创建人id */
    private String creator;

    /** 创建时间 */
    private Date createdTime;

    /** 修改人id */
    private String updator;

    /** 修改时间 */
    private Date updatedTime;

    private String remark;

} 