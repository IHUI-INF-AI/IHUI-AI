# ResourceApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**addAgentFreeTimeApiV1ResourceAgentFreeTimePost**](ResourceApi.md#addAgentFreeTimeApiV1ResourceAgentFreeTimePost) | **POST** /api/v1/resource/agent/free-time | 添加用户 Agent 免费次数 |
| [**createShareApiV1ResourceSharePost**](ResourceApi.md#createShareApiV1ResourceSharePost) | **POST** /api/v1/resource/share | 生成分享链接 |
| [**developerPriceApiV1ResourceDeveloperPriceGet**](ResourceApi.md#developerPriceApiV1ResourceDeveloperPriceGet) | **GET** /api/v1/resource/developer/price | 查询 Agent 开发者价格 |
| [**fileUploadApiV1ResourceFileUploadPost**](ResourceApi.md#fileUploadApiV1ResourceFileUploadPost) | **POST** /api/v1/resource/file/upload | 上传文件到 MinIO |
| [**getAgentFreeTimeApiV1ResourceAgentFreeTimeGet**](ResourceApi.md#getAgentFreeTimeApiV1ResourceAgentFreeTimeGet) | **GET** /api/v1/resource/agent/free-time | 获取用户 Agent 免费次数 |
| [**getCozeAccessTokenApiV1ResourceCozeAccessTokenGet**](ResourceApi.md#getCozeAccessTokenApiV1ResourceCozeAccessTokenGet) | **GET** /api/v1/resource/coze-access-token | 获取 Coze AccessToken |
| [**goodsListApiV1ResourceGoodsGet**](ResourceApi.md#goodsListApiV1ResourceGoodsGet) | **GET** /api/v1/resource/goods | 商品及汇率列表 |
| [**homeResourcesApiV1ResourceHomeGet**](ResourceApi.md#homeResourcesApiV1ResourceHomeGet) | **GET** /api/v1/resource/home | 首页资源聚合 |
| [**planetsCourseApiV1ResourcePlanetsCourseGet**](ResourceApi.md#planetsCourseApiV1ResourcePlanetsCourseGet) | **GET** /api/v1/resource/planets/course | 课程星球列表 |
| [**planetsKnowledgeApiV1ResourcePlanetsKnowledgeGet**](ResourceApi.md#planetsKnowledgeApiV1ResourcePlanetsKnowledgeGet) | **GET** /api/v1/resource/planets/knowledge | 知识星球列表 |
| [**rechargeCheckApiV1ResourceRechargeGet**](ResourceApi.md#rechargeCheckApiV1ResourceRechargeGet) | **GET** /api/v1/resource/recharge | 判断是否为会员 |
| [**tokenCountApiV1ResourceTokenCountGet**](ResourceApi.md#tokenCountApiV1ResourceTokenCountGet) | **GET** /api/v1/resource/token/count | 获取用户 token 余量 |


<a id="addAgentFreeTimeApiV1ResourceAgentFreeTimePost"></a>
# **addAgentFreeTimeApiV1ResourceAgentFreeTimePost**
> Object addAgentFreeTimeApiV1ResourceAgentFreeTimePost(agentId, freeCount)

添加用户 Agent 免费次数

为指定用户增加 Agent 免费使用次数。

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ResourceApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    ResourceApi apiInstance = new ResourceApi(defaultClient);
    String agentId = "agentId_example"; // String | Agent ID
    Integer freeCount = 56; // Integer | 免费次数
    try {
      Object result = apiInstance.addAgentFreeTimeApiV1ResourceAgentFreeTimePost(agentId, freeCount);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ResourceApi#addAgentFreeTimeApiV1ResourceAgentFreeTimePost");
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
| **agentId** | **String**| Agent ID | |
| **freeCount** | **Integer**| 免费次数 | |

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

<a id="createShareApiV1ResourceSharePost"></a>
# **createShareApiV1ResourceSharePost**
> Object createShareApiV1ResourceSharePost(targetType, targetId)

生成分享链接

生成一次性分享 token 短链。

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ResourceApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    ResourceApi apiInstance = new ResourceApi(defaultClient);
    String targetType = "targetType_example"; // String | agent/course/chat
    String targetId = "targetId_example"; // String | 
    try {
      Object result = apiInstance.createShareApiV1ResourceSharePost(targetType, targetId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ResourceApi#createShareApiV1ResourceSharePost");
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
| **targetType** | **String**| agent/course/chat | |
| **targetId** | **String**|  | |

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

<a id="developerPriceApiV1ResourceDeveloperPriceGet"></a>
# **developerPriceApiV1ResourceDeveloperPriceGet**
> Object developerPriceApiV1ResourceDeveloperPriceGet(agentId)

查询 Agent 开发者价格

返回该 Agent 的开发者列表及价格档位。

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ResourceApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    ResourceApi apiInstance = new ResourceApi(defaultClient);
    String agentId = "agentId_example"; // String | 
    try {
      Object result = apiInstance.developerPriceApiV1ResourceDeveloperPriceGet(agentId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ResourceApi#developerPriceApiV1ResourceDeveloperPriceGet");
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
| **agentId** | **String**|  | |

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="fileUploadApiV1ResourceFileUploadPost"></a>
# **fileUploadApiV1ResourceFileUploadPost**
> Object fileUploadApiV1ResourceFileUploadPost(_file, bucket)

上传文件到 MinIO

上传文件，返回可访问的 URL。

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ResourceApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    ResourceApi apiInstance = new ResourceApi(defaultClient);
    File _file = new File("/path/to/file"); // File | 
    String bucket = "bucket_example"; // String | 存储桶，不传则用默认
    try {
      Object result = apiInstance.fileUploadApiV1ResourceFileUploadPost(_file, bucket);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ResourceApi#fileUploadApiV1ResourceFileUploadPost");
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
| **_file** | **File**|  | |
| **bucket** | **String**| 存储桶，不传则用默认 | [optional] |

### Return type

**Object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: multipart/form-data
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="getAgentFreeTimeApiV1ResourceAgentFreeTimeGet"></a>
# **getAgentFreeTimeApiV1ResourceAgentFreeTimeGet**
> Object getAgentFreeTimeApiV1ResourceAgentFreeTimeGet(agentId)

获取用户 Agent 免费次数

查询指定用户在指定 Agent 上剩余的免费次数。

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ResourceApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    ResourceApi apiInstance = new ResourceApi(defaultClient);
    String agentId = "agentId_example"; // String | Agent ID
    try {
      Object result = apiInstance.getAgentFreeTimeApiV1ResourceAgentFreeTimeGet(agentId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ResourceApi#getAgentFreeTimeApiV1ResourceAgentFreeTimeGet");
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
| **agentId** | **String**| Agent ID | |

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

<a id="getCozeAccessTokenApiV1ResourceCozeAccessTokenGet"></a>
# **getCozeAccessTokenApiV1ResourceCozeAccessTokenGet**
> Object getCozeAccessTokenApiV1ResourceCozeAccessTokenGet()

获取 Coze AccessToken

通过 Coze OAuth2 JWT 方式获取 access_token。

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ResourceApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    ResourceApi apiInstance = new ResourceApi(defaultClient);
    try {
      Object result = apiInstance.getCozeAccessTokenApiV1ResourceCozeAccessTokenGet();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ResourceApi#getCozeAccessTokenApiV1ResourceCozeAccessTokenGet");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters
This endpoint does not need any parameter.

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

<a id="goodsListApiV1ResourceGoodsGet"></a>
# **goodsListApiV1ResourceGoodsGet**
> Object goodsListApiV1ResourceGoodsGet()

商品及汇率列表

查询 zhs_product 表全部商品以及 exchange_rate 汇率表。

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ResourceApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    ResourceApi apiInstance = new ResourceApi(defaultClient);
    try {
      Object result = apiInstance.goodsListApiV1ResourceGoodsGet();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ResourceApi#goodsListApiV1ResourceGoodsGet");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters
This endpoint does not need any parameter.

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

<a id="homeResourcesApiV1ResourceHomeGet"></a>
# **homeResourcesApiV1ResourceHomeGet**
> Object homeResourcesApiV1ResourceHomeGet()

首页资源聚合

返回首页所需的全部资源：banner、推荐 Agent、热门课程、公告。

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ResourceApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    ResourceApi apiInstance = new ResourceApi(defaultClient);
    try {
      Object result = apiInstance.homeResourcesApiV1ResourceHomeGet();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ResourceApi#homeResourcesApiV1ResourceHomeGet");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters
This endpoint does not need any parameter.

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

<a id="planetsCourseApiV1ResourcePlanetsCourseGet"></a>
# **planetsCourseApiV1ResourcePlanetsCourseGet**
> Object planetsCourseApiV1ResourcePlanetsCourseGet()

课程星球列表

返回 type&#x3D;course 的知识星球列表。

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ResourceApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    ResourceApi apiInstance = new ResourceApi(defaultClient);
    try {
      Object result = apiInstance.planetsCourseApiV1ResourcePlanetsCourseGet();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ResourceApi#planetsCourseApiV1ResourcePlanetsCourseGet");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters
This endpoint does not need any parameter.

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

<a id="planetsKnowledgeApiV1ResourcePlanetsKnowledgeGet"></a>
# **planetsKnowledgeApiV1ResourcePlanetsKnowledgeGet**
> Object planetsKnowledgeApiV1ResourcePlanetsKnowledgeGet()

知识星球列表

返回 type&#x3D;knowledge 的知识星球列表。

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ResourceApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    ResourceApi apiInstance = new ResourceApi(defaultClient);
    try {
      Object result = apiInstance.planetsKnowledgeApiV1ResourcePlanetsKnowledgeGet();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ResourceApi#planetsKnowledgeApiV1ResourcePlanetsKnowledgeGet");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters
This endpoint does not need any parameter.

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

<a id="rechargeCheckApiV1ResourceRechargeGet"></a>
# **rechargeCheckApiV1ResourceRechargeGet**
> Object rechargeCheckApiV1ResourceRechargeGet()

判断是否为会员

查询 user_vip 表判断当前用户是否为会员。

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ResourceApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    ResourceApi apiInstance = new ResourceApi(defaultClient);
    try {
      Object result = apiInstance.rechargeCheckApiV1ResourceRechargeGet();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ResourceApi#rechargeCheckApiV1ResourceRechargeGet");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters
This endpoint does not need any parameter.

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

<a id="tokenCountApiV1ResourceTokenCountGet"></a>
# **tokenCountApiV1ResourceTokenCountGet**
> Object tokenCountApiV1ResourceTokenCountGet()

获取用户 token 余量

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.ResourceApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    ResourceApi apiInstance = new ResourceApi(defaultClient);
    try {
      Object result = apiInstance.tokenCountApiV1ResourceTokenCountGet();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling ResourceApi#tokenCountApiV1ResourceTokenCountGet");
      System.err.println("Status code: " + e.getCode());
      System.err.println("Reason: " + e.getResponseBody());
      System.err.println("Response headers: " + e.getResponseHeaders());
      e.printStackTrace();
    }
  }
}
```

### Parameters
This endpoint does not need any parameter.

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

