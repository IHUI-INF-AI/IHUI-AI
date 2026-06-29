package com.ai.manager.small.controller;

import com.ai.manager.core.annotation.SkipLogin;
import com.ai.manager.small.domain.ZhsDictionary;
import com.ai.manager.small.domain.ZhsInformation;
import com.ai.manager.small.service.IZhsInformationService;
import com.alibaba.druid.support.json.JSONUtils;
import com.google.common.collect.Maps;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.apache.commons.beanutils.BeanUtils;
import org.apache.commons.io.IOUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import javax.servlet.ServletInputStream;
import javax.servlet.http.HttpServletRequest;
import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

/**
 * AI资讯库Controller
 * 
 * @author ljd
 * @date 2025-05-27
 */
@RestController
@RequestMapping("/information")
@Tag(name = "资讯相关")
@SkipLogin
public class ZhsInformationController
{
    private static final Logger log = LoggerFactory.getLogger(ZhsInformationController.class);

    @Autowired
    private IZhsInformationService zhsInformationService;

    /**
     * 新增AI资讯类型
     */
    @GetMapping("/dictionary")
    public String getDictionary(ZhsDictionary zhsInformationList)
    {
        List<ZhsDictionary> dictionaryList = zhsInformationService.getDictionary(zhsInformationList);
        Map<String, Object> resultMap = Maps.newHashMap();
        resultMap.put("code",200);
        resultMap.put("msg","success");
        List<Map<String, String>> collect = dictionaryList.stream().map(item -> {
            try {
                return BeanUtils.describe(item);
            } catch (Exception e) {
                throw new RuntimeException(e);
            }
        }).collect(Collectors.toList());
        resultMap.put("data", collect);
        return JSONUtils.toJSONString(resultMap);
    }
    /**
     * 新增AI资讯库
     */
    @PostMapping
    public String add(@RequestBody List<ZhsInformation> zhsInformationList, HttpServletRequest request)
    {
        Map<String, Object> resultMap = Maps.newHashMap();
        try {
            String msg ="数据成功添加%s条记录！";
            Integer i = zhsInformationService.insertZhsInformationList(zhsInformationList);
            resultMap.put("code",200);
            resultMap.put("msg",String.format(msg,i));
        }catch (Exception e) {
            throw new RuntimeException(e);
        } finally {
            ServletInputStream inputStream = null;
            try {
                inputStream = request.getInputStream();
                log.info(IOUtils.toString(request.getInputStream()));
            } catch (IOException e) {
                throw new RuntimeException(e);
            }finally {
                if(Objects.nonNull(inputStream)) {
                    try {
                        inputStream.close();
                    } catch (IOException e) {
                        throw new RuntimeException(e);
                    }
                }
            }
        }
        return JSONUtils.toJSONString(resultMap);
    }

    @GetMapping("/list")
    public String list(ZhsInformation zhsInformation)
    {
        List<ZhsInformation> list = zhsInformationService.selectZhsInformationList(zhsInformation);
        Map<String, Object> resultMap = Maps.newHashMap();
        resultMap.put("code",200);
        resultMap.put("msg","success");
        List<Map<String, String>> collect = list.stream().map(item -> {
            try {
                return BeanUtils.describe(item);
            } catch (Exception e) {
                throw new RuntimeException(e);
            }
        }).collect(Collectors.toList());
        resultMap.put("data", collect);
        return JSONUtils.toJSONString(resultMap);
    }

}
