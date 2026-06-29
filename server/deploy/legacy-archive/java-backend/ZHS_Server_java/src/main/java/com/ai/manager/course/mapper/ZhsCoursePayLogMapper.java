package com.ai.manager.course.mapper;

import java.util.List;
import com.ai.manager.course.domain.ZhsCoursePayLog;
import com.baomidou.dynamic.datasource.annotation.DS;
import org.apache.ibatis.annotations.Param;

/**
 * 用户购买课程记录Mapper接口
 * 
 * @author Raindrop_L
 * @date 2025-08-29
 */
@DS("course")
public interface ZhsCoursePayLogMapper 
{
    /**
     * 查询用户购买课程记录
     * 
     * @param id 用户购买课程记录主键
     * @return 用户购买课程记录
     */
    public ZhsCoursePayLog getById(String id);

    /**
     * 查询用户购买课程记录列表
     * 
     * @param zhsCoursePayLog 用户购买课程记录
     * @return 用户购买课程记录集合
     */
    public List<ZhsCoursePayLog> getList(ZhsCoursePayLog zhsCoursePayLog);

    /**
     * 新增用户购买课程记录
     * 
     * @param zhsCoursePayLog 用户购买课程记录
     * @return 结果
     */
    public int addZhsCoursePayLog(ZhsCoursePayLog zhsCoursePayLog);

    /**
     * 修改用户购买课程记录
     * 
     * @param zhsCoursePayLog 用户购买课程记录
     * @return 结果
     */
    public int edit(ZhsCoursePayLog zhsCoursePayLog);

    /**
     * 删除用户购买课程记录
     * 
     * @param id 用户购买课程记录主键
     * @return 结果
     */
    public int delById(String id);

    /**
     * 批量删除用户购买课程记录
     * 
     * @param ids 需要删除的数据主键集合
     * @return 结果
     */
    public int delByIds(String[] ids);

    ZhsCoursePayLog getByOutBillNo(@Param("outBillOn") String outBillOn);
}
