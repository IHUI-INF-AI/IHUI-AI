# CanaryApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**getCanaryStageApiV1CanaryCanaryStageGet**](CanaryApi.md#getCanaryStageApiV1CanaryCanaryStageGet) | **GET** /api/v1/canary/canary/stage | Get Canary Stage |
| [**getCanaryStageApiV1CanaryCanaryStageGet_0**](CanaryApi.md#getCanaryStageApiV1CanaryCanaryStageGet_0) | **GET** /api/v1/canary/canary/stage | Get Canary Stage |
| [**postCanaryFailureApiV1CanaryCanaryFailurePost**](CanaryApi.md#postCanaryFailureApiV1CanaryCanaryFailurePost) | **POST** /api/v1/canary/canary/failure | Post Canary Failure |
| [**postCanaryFailureApiV1CanaryCanaryFailurePost_0**](CanaryApi.md#postCanaryFailureApiV1CanaryCanaryFailurePost_0) | **POST** /api/v1/canary/canary/failure | Post Canary Failure |
| [**postCanaryPromoteApiV1CanaryCanaryPromotePost**](CanaryApi.md#postCanaryPromoteApiV1CanaryCanaryPromotePost) | **POST** /api/v1/canary/canary/promote | Post Canary Promote |
| [**postCanaryPromoteApiV1CanaryCanaryPromotePost_0**](CanaryApi.md#postCanaryPromoteApiV1CanaryCanaryPromotePost_0) | **POST** /api/v1/canary/canary/promote | Post Canary Promote |
| [**postCanaryResetApiV1CanaryCanaryResetPost**](CanaryApi.md#postCanaryResetApiV1CanaryCanaryResetPost) | **POST** /api/v1/canary/canary/reset | Post Canary Reset |
| [**postCanaryResetApiV1CanaryCanaryResetPost_0**](CanaryApi.md#postCanaryResetApiV1CanaryCanaryResetPost_0) | **POST** /api/v1/canary/canary/reset | Post Canary Reset |
| [**postCanaryRollbackApiV1CanaryCanaryRollbackPost**](CanaryApi.md#postCanaryRollbackApiV1CanaryCanaryRollbackPost) | **POST** /api/v1/canary/canary/rollback | Post Canary Rollback |
| [**postCanaryRollbackApiV1CanaryCanaryRollbackPost_0**](CanaryApi.md#postCanaryRollbackApiV1CanaryCanaryRollbackPost_0) | **POST** /api/v1/canary/canary/rollback | Post Canary Rollback |
| [**postCanaryTrafficApiV1CanaryCanaryTrafficPost**](CanaryApi.md#postCanaryTrafficApiV1CanaryCanaryTrafficPost) | **POST** /api/v1/canary/canary/traffic | Post Canary Traffic |
| [**postCanaryTrafficApiV1CanaryCanaryTrafficPost_0**](CanaryApi.md#postCanaryTrafficApiV1CanaryCanaryTrafficPost_0) | **POST** /api/v1/canary/canary/traffic | Post Canary Traffic |


<a id="getCanaryStageApiV1CanaryCanaryStageGet"></a>
# **getCanaryStageApiV1CanaryCanaryStageGet**
> CanaryResponse getCanaryStageApiV1CanaryCanaryStageGet()

Get Canary Stage

查询当前 canary 阶段状态 (建议 133: 需 admin 角色).

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CanaryApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    CanaryApi apiInstance = new CanaryApi(defaultClient);
    try {
      CanaryResponse result = apiInstance.getCanaryStageApiV1CanaryCanaryStageGet();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CanaryApi#getCanaryStageApiV1CanaryCanaryStageGet");
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

[**CanaryResponse**](CanaryResponse.md)

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

<a id="getCanaryStageApiV1CanaryCanaryStageGet_0"></a>
# **getCanaryStageApiV1CanaryCanaryStageGet_0**
> CanaryResponse getCanaryStageApiV1CanaryCanaryStageGet_0()

Get Canary Stage

查询当前 canary 阶段状态 (建议 133: 需 admin 角色).

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CanaryApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    CanaryApi apiInstance = new CanaryApi(defaultClient);
    try {
      CanaryResponse result = apiInstance.getCanaryStageApiV1CanaryCanaryStageGet_0();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CanaryApi#getCanaryStageApiV1CanaryCanaryStageGet_0");
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

[**CanaryResponse**](CanaryResponse.md)

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

<a id="postCanaryFailureApiV1CanaryCanaryFailurePost"></a>
# **postCanaryFailureApiV1CanaryCanaryFailurePost**
> CanaryResponse postCanaryFailureApiV1CanaryCanaryFailurePost(failureRequest)

Post Canary Failure

标记一次失败 (累计达阈值自动回滚, 建议 133: 需 admin 角色).

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CanaryApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    CanaryApi apiInstance = new CanaryApi(defaultClient);
    FailureRequest failureRequest = new FailureRequest(); // FailureRequest | 
    try {
      CanaryResponse result = apiInstance.postCanaryFailureApiV1CanaryCanaryFailurePost(failureRequest);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CanaryApi#postCanaryFailureApiV1CanaryCanaryFailurePost");
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
| **failureRequest** | [**FailureRequest**](FailureRequest.md)|  | |

### Return type

[**CanaryResponse**](CanaryResponse.md)

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

<a id="postCanaryFailureApiV1CanaryCanaryFailurePost_0"></a>
# **postCanaryFailureApiV1CanaryCanaryFailurePost_0**
> CanaryResponse postCanaryFailureApiV1CanaryCanaryFailurePost_0(failureRequest)

Post Canary Failure

标记一次失败 (累计达阈值自动回滚, 建议 133: 需 admin 角色).

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CanaryApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    CanaryApi apiInstance = new CanaryApi(defaultClient);
    FailureRequest failureRequest = new FailureRequest(); // FailureRequest | 
    try {
      CanaryResponse result = apiInstance.postCanaryFailureApiV1CanaryCanaryFailurePost_0(failureRequest);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CanaryApi#postCanaryFailureApiV1CanaryCanaryFailurePost_0");
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
| **failureRequest** | [**FailureRequest**](FailureRequest.md)|  | |

### Return type

[**CanaryResponse**](CanaryResponse.md)

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

<a id="postCanaryPromoteApiV1CanaryCanaryPromotePost"></a>
# **postCanaryPromoteApiV1CanaryCanaryPromotePost**
> CanaryResponse postCanaryPromoteApiV1CanaryCanaryPromotePost(promoteRequest)

Post Canary Promote

提升到下一阶段 (受 cooldown 约束, 建议 133: 需 admin 角色).

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CanaryApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    CanaryApi apiInstance = new CanaryApi(defaultClient);
    PromoteRequest promoteRequest = new PromoteRequest(); // PromoteRequest | 
    try {
      CanaryResponse result = apiInstance.postCanaryPromoteApiV1CanaryCanaryPromotePost(promoteRequest);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CanaryApi#postCanaryPromoteApiV1CanaryCanaryPromotePost");
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
| **promoteRequest** | [**PromoteRequest**](PromoteRequest.md)|  | |

### Return type

[**CanaryResponse**](CanaryResponse.md)

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

<a id="postCanaryPromoteApiV1CanaryCanaryPromotePost_0"></a>
# **postCanaryPromoteApiV1CanaryCanaryPromotePost_0**
> CanaryResponse postCanaryPromoteApiV1CanaryCanaryPromotePost_0(promoteRequest)

Post Canary Promote

提升到下一阶段 (受 cooldown 约束, 建议 133: 需 admin 角色).

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CanaryApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    CanaryApi apiInstance = new CanaryApi(defaultClient);
    PromoteRequest promoteRequest = new PromoteRequest(); // PromoteRequest | 
    try {
      CanaryResponse result = apiInstance.postCanaryPromoteApiV1CanaryCanaryPromotePost_0(promoteRequest);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CanaryApi#postCanaryPromoteApiV1CanaryCanaryPromotePost_0");
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
| **promoteRequest** | [**PromoteRequest**](PromoteRequest.md)|  | |

### Return type

[**CanaryResponse**](CanaryResponse.md)

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

<a id="postCanaryResetApiV1CanaryCanaryResetPost"></a>
# **postCanaryResetApiV1CanaryCanaryResetPost**
> CanaryResponse postCanaryResetApiV1CanaryCanaryResetPost(resetRequest)

Post Canary Reset

重置到 STAGE_0 (新灰度周期, 建议 133: 需 admin 角色).

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CanaryApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    CanaryApi apiInstance = new CanaryApi(defaultClient);
    ResetRequest resetRequest = new ResetRequest(); // ResetRequest | 
    try {
      CanaryResponse result = apiInstance.postCanaryResetApiV1CanaryCanaryResetPost(resetRequest);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CanaryApi#postCanaryResetApiV1CanaryCanaryResetPost");
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
| **resetRequest** | [**ResetRequest**](ResetRequest.md)|  | |

### Return type

[**CanaryResponse**](CanaryResponse.md)

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

<a id="postCanaryResetApiV1CanaryCanaryResetPost_0"></a>
# **postCanaryResetApiV1CanaryCanaryResetPost_0**
> CanaryResponse postCanaryResetApiV1CanaryCanaryResetPost_0(resetRequest)

Post Canary Reset

重置到 STAGE_0 (新灰度周期, 建议 133: 需 admin 角色).

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CanaryApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    CanaryApi apiInstance = new CanaryApi(defaultClient);
    ResetRequest resetRequest = new ResetRequest(); // ResetRequest | 
    try {
      CanaryResponse result = apiInstance.postCanaryResetApiV1CanaryCanaryResetPost_0(resetRequest);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CanaryApi#postCanaryResetApiV1CanaryCanaryResetPost_0");
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
| **resetRequest** | [**ResetRequest**](ResetRequest.md)|  | |

### Return type

[**CanaryResponse**](CanaryResponse.md)

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

<a id="postCanaryRollbackApiV1CanaryCanaryRollbackPost"></a>
# **postCanaryRollbackApiV1CanaryCanaryRollbackPost**
> CanaryResponse postCanaryRollbackApiV1CanaryCanaryRollbackPost(rollbackRequest)

Post Canary Rollback

回滚到上一阶段 (不受 cooldown 限制, 建议 133: 需 admin 角色).

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CanaryApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    CanaryApi apiInstance = new CanaryApi(defaultClient);
    RollbackRequest rollbackRequest = new RollbackRequest(); // RollbackRequest | 
    try {
      CanaryResponse result = apiInstance.postCanaryRollbackApiV1CanaryCanaryRollbackPost(rollbackRequest);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CanaryApi#postCanaryRollbackApiV1CanaryCanaryRollbackPost");
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
| **rollbackRequest** | [**RollbackRequest**](RollbackRequest.md)|  | |

### Return type

[**CanaryResponse**](CanaryResponse.md)

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

<a id="postCanaryRollbackApiV1CanaryCanaryRollbackPost_0"></a>
# **postCanaryRollbackApiV1CanaryCanaryRollbackPost_0**
> CanaryResponse postCanaryRollbackApiV1CanaryCanaryRollbackPost_0(rollbackRequest)

Post Canary Rollback

回滚到上一阶段 (不受 cooldown 限制, 建议 133: 需 admin 角色).

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CanaryApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    CanaryApi apiInstance = new CanaryApi(defaultClient);
    RollbackRequest rollbackRequest = new RollbackRequest(); // RollbackRequest | 
    try {
      CanaryResponse result = apiInstance.postCanaryRollbackApiV1CanaryCanaryRollbackPost_0(rollbackRequest);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CanaryApi#postCanaryRollbackApiV1CanaryCanaryRollbackPost_0");
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
| **rollbackRequest** | [**RollbackRequest**](RollbackRequest.md)|  | |

### Return type

[**CanaryResponse**](CanaryResponse.md)

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

<a id="postCanaryTrafficApiV1CanaryCanaryTrafficPost"></a>
# **postCanaryTrafficApiV1CanaryCanaryTrafficPost**
> CanaryResponse postCanaryTrafficApiV1CanaryCanaryTrafficPost(trafficRequest)

Post Canary Traffic

报告阶段内流量数 (建议 133: 需 admin 角色).

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CanaryApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    CanaryApi apiInstance = new CanaryApi(defaultClient);
    TrafficRequest trafficRequest = new TrafficRequest(); // TrafficRequest | 
    try {
      CanaryResponse result = apiInstance.postCanaryTrafficApiV1CanaryCanaryTrafficPost(trafficRequest);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CanaryApi#postCanaryTrafficApiV1CanaryCanaryTrafficPost");
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
| **trafficRequest** | [**TrafficRequest**](TrafficRequest.md)|  | |

### Return type

[**CanaryResponse**](CanaryResponse.md)

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

<a id="postCanaryTrafficApiV1CanaryCanaryTrafficPost_0"></a>
# **postCanaryTrafficApiV1CanaryCanaryTrafficPost_0**
> CanaryResponse postCanaryTrafficApiV1CanaryCanaryTrafficPost_0(trafficRequest)

Post Canary Traffic

报告阶段内流量数 (建议 133: 需 admin 角色).

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.auth.*;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CanaryApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");
    
    // Configure HTTP bearer authorization: HTTPBearer
    HttpBearerAuth HTTPBearer = (HttpBearerAuth) defaultClient.getAuthentication("HTTPBearer");
    HTTPBearer.setBearerToken("BEARER TOKEN");

    CanaryApi apiInstance = new CanaryApi(defaultClient);
    TrafficRequest trafficRequest = new TrafficRequest(); // TrafficRequest | 
    try {
      CanaryResponse result = apiInstance.postCanaryTrafficApiV1CanaryCanaryTrafficPost_0(trafficRequest);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CanaryApi#postCanaryTrafficApiV1CanaryCanaryTrafficPost_0");
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
| **trafficRequest** | [**TrafficRequest**](TrafficRequest.md)|  | |

### Return type

[**CanaryResponse**](CanaryResponse.md)

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

