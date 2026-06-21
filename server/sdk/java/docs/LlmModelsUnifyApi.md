# LlmModelsUnifyApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**modelsUnifyApiV1LlmModelsUnifyGet**](LlmModelsUnifyApi.md#modelsUnifyApiV1LlmModelsUnifyGet) | **GET** /api/v1/llm/models-unify | 大模型统一列表 (兼容 ihui-ai-api) |


<a id="modelsUnifyApiV1LlmModelsUnifyGet"></a>
# **modelsUnifyApiV1LlmModelsUnifyGet**
> Object modelsUnifyApiV1LlmModelsUnifyGet(name, type, isDel, page, limit)

大模型统一列表 (兼容 ihui-ai-api)

返回前端 AIModelInfo[] 格式，字段映射: - id, name, source, description, icon, status, sort - 前端别名: modelCode, displayName, img, remark, type, category, manufacturer

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.LlmModelsUnifyApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    LlmModelsUnifyApi apiInstance = new LlmModelsUnifyApi(defaultClient);
    String name = "name_example"; // String | 
    Integer type = 56; // Integer | 
    Integer isDel = 0; // Integer | 
    Integer page = 1; // Integer | 
    Integer limit = 100; // Integer | 
    try {
      Object result = apiInstance.modelsUnifyApiV1LlmModelsUnifyGet(name, type, isDel, page, limit);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling LlmModelsUnifyApi#modelsUnifyApiV1LlmModelsUnifyGet");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters

| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **name** | **String**|  | [optional] |
| **type** | **Integer**|  | [optional] |
| **isDel** | **Integer**|  | [optional] [default to 0] |
| **page** | **Integer**|  | [optional] [default to 1] |
| **limit** | **Integer**|  | [optional] [default to 100] |

### Return type

**Object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

