# TestApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**docsPageApiV1TestDocsPageGet**](TestApi.md#docsPageApiV1TestDocsPageGet) | **GET** /api/v1/test/docs-page | API文档页面 |
| [**docsPageApiV1TestDocsPageGet_0**](TestApi.md#docsPageApiV1TestDocsPageGet_0) | **GET** /api/v1/test/docs-page | API文档页面 |
| [**healthApiV1TestHealthGet**](TestApi.md#healthApiV1TestHealthGet) | **GET** /api/v1/test/health | 健康检查 |
| [**healthApiV1TestHealthGet_0**](TestApi.md#healthApiV1TestHealthGet_0) | **GET** /api/v1/test/health | 健康检查 |
| [**indexApiV1TestGet**](TestApi.md#indexApiV1TestGet) | **GET** /api/v1/test | 测试页面首页 |
| [**indexApiV1TestGet_0**](TestApi.md#indexApiV1TestGet_0) | **GET** /api/v1/test | 测试页面首页 |


<a id="docsPageApiV1TestDocsPageGet"></a>
# **docsPageApiV1TestDocsPageGet**
> String docsPageApiV1TestDocsPageGet()

API文档页面

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.TestApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    TestApi apiInstance = new TestApi(defaultClient);
    try {
      String result = apiInstance.docsPageApiV1TestDocsPageGet();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling TestApi#docsPageApiV1TestDocsPageGet");
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

**String**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: text/html

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

<a id="docsPageApiV1TestDocsPageGet_0"></a>
# **docsPageApiV1TestDocsPageGet_0**
> String docsPageApiV1TestDocsPageGet_0()

API文档页面

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.TestApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    TestApi apiInstance = new TestApi(defaultClient);
    try {
      String result = apiInstance.docsPageApiV1TestDocsPageGet_0();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling TestApi#docsPageApiV1TestDocsPageGet_0");
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

**String**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: text/html

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

<a id="healthApiV1TestHealthGet"></a>
# **healthApiV1TestHealthGet**
> Object healthApiV1TestHealthGet()

健康检查

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.TestApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    TestApi apiInstance = new TestApi(defaultClient);
    try {
      Object result = apiInstance.healthApiV1TestHealthGet();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling TestApi#healthApiV1TestHealthGet");
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

<a id="healthApiV1TestHealthGet_0"></a>
# **healthApiV1TestHealthGet_0**
> Object healthApiV1TestHealthGet_0()

健康检查

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.TestApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    TestApi apiInstance = new TestApi(defaultClient);
    try {
      Object result = apiInstance.healthApiV1TestHealthGet_0();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling TestApi#healthApiV1TestHealthGet_0");
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

<a id="indexApiV1TestGet"></a>
# **indexApiV1TestGet**
> String indexApiV1TestGet()

测试页面首页

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.TestApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    TestApi apiInstance = new TestApi(defaultClient);
    try {
      String result = apiInstance.indexApiV1TestGet();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling TestApi#indexApiV1TestGet");
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

**String**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: text/html

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

<a id="indexApiV1TestGet_0"></a>
# **indexApiV1TestGet_0**
> String indexApiV1TestGet_0()

测试页面首页

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.TestApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    TestApi apiInstance = new TestApi(defaultClient);
    try {
      String result = apiInstance.indexApiV1TestGet_0();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling TestApi#indexApiV1TestGet_0");
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

**String**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: text/html

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

