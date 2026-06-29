package com.ai.manager.course.service.impl;

import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import com.ai.manager.course.mapper.ZhsCoursePayMapper;
import com.ai.manager.course.domain.ZhsCoursePay;
import com.ai.manager.course.service.IZhsCoursePayService;

/**
 * 课程价格Service业务层处理
 * 
 * @author Raindrop_L
 * @date 2025-08-29
 */
@Service
public class ZhsCoursePayServiceImpl implements IZhsCoursePayService 
{
    @Autowired
    private ZhsCoursePayMapper zhsCoursePayMapper;

    /**
     * 查询课程价格
     * 
     * @param uuid 课程价格主键
     * @return 课程价格
     */
    @Override
    public ZhsCoursePay getByUuid(String uuid)
    {
        return zhsCoursePayMapper.getByUuid(uuid);
    }

    /**
     * 查询课程价格列表
     * 
     * @param zhsCoursePay 课程价格
     * @return 课程价格
     */
    @Override
    public List<ZhsCoursePay> getList(ZhsCoursePay zhsCoursePay)
    {
        return zhsCoursePayMapper.getList(zhsCoursePay);
    }

    /**
     * 新增课程价格
     * 
     * @param zhsCoursePay 课程价格
     * @return 结果
     */
    @Override
    public int add(ZhsCoursePay zhsCoursePay)
    {
        return zhsCoursePayMapper.addZhsCoursePay(zhsCoursePay);
    }

    /**
     * 修改课程价格
     * 
     * @param zhsCoursePay 课程价格
     * @return 结果
     */
    @Override
    public int edit(ZhsCoursePay zhsCoursePay)
    {
        return zhsCoursePayMapper.edit(zhsCoursePay);
    }

    /**
     * 批量删除课程价格
     * 
     * @param uuids 需要删除的课程价格主键
     * @return 结果
     */
    @Override
    public int delByUuids(String[] uuids)
    {
        return zhsCoursePayMapper.delByUuids(uuids);
    }

    /**
     * 删除课程价格信息
     * 
     * @param uuid 课程价格主键
     * @return 结果
     */
    @Override
    public int delByUuid(String uuid)
    {
        return zhsCoursePayMapper.delByUuid(uuid);
    }
}
