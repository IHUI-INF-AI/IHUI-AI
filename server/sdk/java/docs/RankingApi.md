# RankingApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**agentRankingApiV1RankingAgentGet**](RankingApi.md#agentRankingApiV1RankingAgentGet) | **GET** /api/v1/ranking/agent | Agent排行榜 |
| [**agentRankingApiV1RankingAgentGet_0**](RankingApi.md#agentRankingApiV1RankingAgentGet_0) | **GET** /api/v1/ranking/agent | Agent排行榜 |
| [**courseRankingApiV1RankingCourseGet**](RankingApi.md#courseRankingApiV1RankingCourseGet) | **GET** /api/v1/ranking/course | 课程排行榜 |
| [**courseRankingApiV1RankingCourseGet_0**](RankingApi.md#courseRankingApiV1RankingCourseGet_0) | **GET** /api/v1/ranking/course | 课程排行榜 |
| [**createRankingApiV1RankingPost**](RankingApi.md#createRankingApiV1RankingPost) | **POST** /api/v1/ranking | 创建榜单 |
| [**createRankingApiV1RankingPost_0**](RankingApi.md#createRankingApiV1RankingPost_0) | **POST** /api/v1/ranking | 创建榜单 |
| [**listRankingsApiV1RankingListGet**](RankingApi.md#listRankingsApiV1RankingListGet) | **GET** /api/v1/ranking/list | 排行榜列表 |
| [**listRankingsApiV1RankingListGet_0**](RankingApi.md#listRankingsApiV1RankingListGet_0) | **GET** /api/v1/ranking/list | 排行榜列表 |
| [**userRankingApiV1RankingUserGet**](RankingApi.md#userRankingApiV1RankingUserGet) | **GET** /api/v1/ranking/user | 用户积分排行榜 |
| [**userRankingApiV1RankingUserGet_0**](RankingApi.md#userRankingApiV1RankingUserGet_0) | **GET** /api/v1/ranking/user | 用户积分排行榜 |


<a id="agentRankingApiV1RankingAgentGet"></a>
# **agentRankingApiV1RankingAgentGet**
> Object agentRankingApiV1RankingAgentGet(period, limit)

Agent排行榜

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.RankingApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    RankingApi apiInstance = new RankingApi(defaultClient);
    String period = "all"; // String | 
    Integer limit = 50; // Integer | 
    try {
      Object result = apiInstance.agentRankingApiV1RankingAgentGet(period, limit);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling RankingApi#agentRankingApiV1RankingAgentGet");
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
| **period** | **String**|  | [optional] [default to all] |
| **limit** | **Integer**|  | [optional] [default to 50] |

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

<a id="agentRankingApiV1RankingAgentGet_0"></a>
# **agentRankingApiV1RankingAgentGet_0**
> Object agentRankingApiV1RankingAgentGet_0(period, limit)

Agent排行榜

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.RankingApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    RankingApi apiInstance = new RankingApi(defaultClient);
    String period = "all"; // String | 
    Integer limit = 50; // Integer | 
    try {
      Object result = apiInstance.agentRankingApiV1RankingAgentGet_0(period, limit);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling RankingApi#agentRankingApiV1RankingAgentGet_0");
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
| **period** | **String**|  | [optional] [default to all] |
| **limit** | **Integer**|  | [optional] [default to 50] |

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

<a id="courseRankingApiV1RankingCourseGet"></a>
# **courseRankingApiV1RankingCourseGet**
> Object courseRankingApiV1RankingCourseGet(limit)

课程排行榜

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.RankingApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    RankingApi apiInstance = new RankingApi(defaultClient);
    Integer limit = 50; // Integer | 
    try {
      Object result = apiInstance.courseRankingApiV1RankingCourseGet(limit);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling RankingApi#courseRankingApiV1RankingCourseGet");
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
| **limit** | **Integer**|  | [optional] [default to 50] |

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

<a id="courseRankingApiV1RankingCourseGet_0"></a>
# **courseRankingApiV1RankingCourseGet_0**
> Object courseRankingApiV1RankingCourseGet_0(limit)

课程排行榜

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.RankingApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    RankingApi apiInstance = new RankingApi(defaultClient);
    Integer limit = 50; // Integer | 
    try {
      Object result = apiInstance.courseRankingApiV1RankingCourseGet_0(limit);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling RankingApi#courseRankingApiV1RankingCourseGet_0");
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
| **limit** | **Integer**|  | [optional] [default to 50] |

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

<a id="createRankingApiV1RankingPost"></a>
# **createRankingApiV1RankingPost**
> Object createRankingApiV1RankingPost(name, code, type, period, description)

创建榜单

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.RankingApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    RankingApi apiInstance = new RankingApi(defaultClient);
    String name = "name_example"; // String | 
    String code = "code_example"; // String | 
    String type = "agent"; // String | 
    String period = "day"; // String | 
    String description = "description_example"; // String | 
    try {
      Object result = apiInstance.createRankingApiV1RankingPost(name, code, type, period, description);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling RankingApi#createRankingApiV1RankingPost");
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
| **name** | **String**|  | |
| **code** | **String**|  | |
| **type** | **String**|  | [optional] [default to agent] |
| **period** | **String**|  | [optional] [default to day] |
| **description** | **String**|  | [optional] |

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

<a id="createRankingApiV1RankingPost_0"></a>
# **createRankingApiV1RankingPost_0**
> Object createRankingApiV1RankingPost_0(name, code, type, period, description)

创建榜单

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.RankingApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    RankingApi apiInstance = new RankingApi(defaultClient);
    String name = "name_example"; // String | 
    String code = "code_example"; // String | 
    String type = "agent"; // String | 
    String period = "day"; // String | 
    String description = "description_example"; // String | 
    try {
      Object result = apiInstance.createRankingApiV1RankingPost_0(name, code, type, period, description);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling RankingApi#createRankingApiV1RankingPost_0");
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
| **name** | **String**|  | |
| **code** | **String**|  | |
| **type** | **String**|  | [optional] [default to agent] |
| **period** | **String**|  | [optional] [default to day] |
| **description** | **String**|  | [optional] |

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

<a id="listRankingsApiV1RankingListGet"></a>
# **listRankingsApiV1RankingListGet**
> Object listRankingsApiV1RankingListGet()

排行榜列表

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.RankingApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    RankingApi apiInstance = new RankingApi(defaultClient);
    try {
      Object result = apiInstance.listRankingsApiV1RankingListGet();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling RankingApi#listRankingsApiV1RankingListGet");
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

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

<a id="listRankingsApiV1RankingListGet_0"></a>
# **listRankingsApiV1RankingListGet_0**
> Object listRankingsApiV1RankingListGet_0()

排行榜列表

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.RankingApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    RankingApi apiInstance = new RankingApi(defaultClient);
    try {
      Object result = apiInstance.listRankingsApiV1RankingListGet_0();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling RankingApi#listRankingsApiV1RankingListGet_0");
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

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

<a id="userRankingApiV1RankingUserGet"></a>
# **userRankingApiV1RankingUserGet**
> Object userRankingApiV1RankingUserGet(period, limit)

用户积分排行榜

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.RankingApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    RankingApi apiInstance = new RankingApi(defaultClient);
    String period = "all"; // String | 
    Integer limit = 50; // Integer | 
    try {
      Object result = apiInstance.userRankingApiV1RankingUserGet(period, limit);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling RankingApi#userRankingApiV1RankingUserGet");
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
| **period** | **String**|  | [optional] [default to all] |
| **limit** | **Integer**|  | [optional] [default to 50] |

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

<a id="userRankingApiV1RankingUserGet_0"></a>
# **userRankingApiV1RankingUserGet_0**
> Object userRankingApiV1RankingUserGet_0(period, limit)

用户积分排行榜

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.RankingApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    RankingApi apiInstance = new RankingApi(defaultClient);
    String period = "all"; // String | 
    Integer limit = 50; // Integer | 
    try {
      Object result = apiInstance.userRankingApiV1RankingUserGet_0(period, limit);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling RankingApi#userRankingApiV1RankingUserGet_0");
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
| **period** | **String**|  | [optional] [default to all] |
| **limit** | **Integer**|  | [optional] [default to 50] |

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

