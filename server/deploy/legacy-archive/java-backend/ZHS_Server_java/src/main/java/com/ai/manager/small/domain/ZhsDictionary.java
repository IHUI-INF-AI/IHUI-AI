package com.ai.manager.small.domain;

import lombok.Data;
import lombok.ToString;

import java.io.Serializable;
import java.util.Date;

/**
 * 字典对象 zhs_dictionary
 * 
 * @author ljd
 * @date 2025-05-27
 */
@Data
@ToString
public class ZhsDictionary implements Serializable
{
    private static final long serialVersionUID = 1L;

    /** UUID */
    private String id;

    /** code */
    private String code;

    /** 字段名 */
    private String name;

    /** 父ID */
    private String prentId;

    /** 使用类型id */
    private String typeId;

    /** 是否失效 0有效 | 1 失效 */
    private Long isInvalid;

    /** 创建人ID */
    private Long creator;

    /** 创建时间 */
    private Date createdTime;

    /** 修改人id */
    private Long update;

    /** 修改时间 */
    private Date updatedTime;
}
