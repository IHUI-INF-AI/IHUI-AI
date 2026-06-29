package com.ai.manager.core.utils;

import java.util.HashMap;
import java.util.Map;

public class MapUtil {
    private Map result;
    public MapUtil of(Object key, Object val){
        if (result==null){
            result = new HashMap();
        }
        result.put(key,val);
        return this;
    }
    public Map getResult(){
        return result;
    }

    public static void main(String[] args) {
        Map result1 = new MapUtil().of("1", "2").of("1", "2").of("1", "2").of("1", "2").getResult();
        for (Object key :result1.keySet()) {
            result1.get(key);
        }
    }
}
