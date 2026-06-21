# AiTencentApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**getActiveJobsApiV1AiTencentHunyuan3dActiveJobsGet**](AiTencentApi.md#getActiveJobsApiV1AiTencentHunyuan3dActiveJobsGet) | **GET** /api/v1/ai/tencent/hunyuan3d/active-jobs | 查看当前活跃任务 |
| [**queryHunyuan3dApiV1AiTencentHunyuan3dTaskTaskIdGet**](AiTencentApi.md#queryHunyuan3dApiV1AiTencentHunyuan3dTaskTaskIdGet) | **GET** /api/v1/ai/tencent/hunyuan3d/task/{task_id} | 查询混元3D任务状态 |
| [**queryHunyuan3dPostApiV1AiTencentHunyuan3dQueryPost**](AiTencentApi.md#queryHunyuan3dPostApiV1AiTencentHunyuan3dQueryPost) | **POST** /api/v1/ai/tencent/hunyuan3d/query | 查询混元3D任务状态 |
| [**submitHunyuan3dApiV1AiTencentHunyuan3dSubmitPost**](AiTencentApi.md#submitHunyuan3dApiV1AiTencentHunyuan3dSubmitPost) | **POST** /api/v1/ai/tencent/hunyuan3d/submit | 提交混元3D任务 |


<a id="getActiveJobsApiV1AiTencentHunyuan3dActiveJobsGet"></a>
# **getActiveJobsApiV1AiTencentHunyuan3dActiveJobsGet**
> Object getActiveJobsApiV1AiTencentHunyuan3dActiveJobsGet()

查看当前活跃任务

View currently active polling jobs.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AiTencentApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    AiTencentApi apiInstance = new AiTencentApi(defaultClient);
    try {
      Object result = apiInstance.getActiveJobsApiV1AiTencentHunyuan3dActiveJobsGet();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AiTencentApi#getActiveJobsApiV1AiTencentHunyuan3dActiveJobsGet");
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

<a id="queryHunyuan3dApiV1AiTencentHunyuan3dTaskTaskIdGet"></a>
# **queryHunyuan3dApiV1AiTencentHunyuan3dTaskTaskIdGet**
> Object queryHunyuan3dApiV1AiTencentHunyuan3dTaskTaskIdGet(taskId)

查询混元3D任务状态

Query the status and result of a Hunyuan 3D task via path parameter.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AiTencentApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    AiTencentApi apiInstance = new AiTencentApi(defaultClient);
    String taskId = "taskId_example"; // String | 
    try {
      Object result = apiInstance.queryHunyuan3dApiV1AiTencentHunyuan3dTaskTaskIdGet(taskId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AiTencentApi#queryHunyuan3dApiV1AiTencentHunyuan3dTaskTaskIdGet");
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
| **taskId** | **String**|  | |

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

<a id="queryHunyuan3dPostApiV1AiTencentHunyuan3dQueryPost"></a>
# **queryHunyuan3dPostApiV1AiTencentHunyuan3dQueryPost**
> Object queryHunyuan3dPostApiV1AiTencentHunyuan3dQueryPost(queryHunyuan3DRequest)

查询混元3D任务状态

Query the status and result of a Hunyuan 3D task via POST body.

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AiTencentApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    AiTencentApi apiInstance = new AiTencentApi(defaultClient);
    QueryHunyuan3DRequest queryHunyuan3DRequest = new QueryHunyuan3DRequest(); // QueryHunyuan3DRequest | 
    try {
      Object result = apiInstance.queryHunyuan3dPostApiV1AiTencentHunyuan3dQueryPost(queryHunyuan3DRequest);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AiTencentApi#queryHunyuan3dPostApiV1AiTencentHunyuan3dQueryPost");
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
| **queryHunyuan3DRequest** | [**QueryHunyuan3DRequest**](QueryHunyuan3DRequest.md)|  | |

### Return type

**Object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="submitHunyuan3dApiV1AiTencentHunyuan3dSubmitPost"></a>
# **submitHunyuan3dApiV1AiTencentHunyuan3dSubmitPost**
> Object submitHunyuan3dApiV1AiTencentHunyuan3dSubmitPost(submitHunyuan3DRequest)

提交混元3D任务

Submit a Hunyuan 3D model generation task (text-to-3D or image-to-3D).

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AiTencentApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    AiTencentApi apiInstance = new AiTencentApi(defaultClient);
    SubmitHunyuan3DRequest submitHunyuan3DRequest = new SubmitHunyuan3DRequest(); // SubmitHunyuan3DRequest | 
    try {
      Object result = apiInstance.submitHunyuan3dApiV1AiTencentHunyuan3dSubmitPost(submitHunyuan3DRequest);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AiTencentApi#submitHunyuan3dApiV1AiTencentHunyuan3dSubmitPost");
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
| **submitHunyuan3DRequest** | [**SubmitHunyuan3DRequest**](SubmitHunyuan3DRequest.md)|  | |

### Return type

**Object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

