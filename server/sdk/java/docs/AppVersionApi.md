# AppVersionApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**checkUpdateApiV1AppVersionCheckGet**](AppVersionApi.md#checkUpdateApiV1AppVersionCheckGet) | **GET** /api/v1/app-version/check | 检查更新 |
| [**checkUpdateApiV1AppVersionCheckGet_0**](AppVersionApi.md#checkUpdateApiV1AppVersionCheckGet_0) | **GET** /api/v1/app-version/check | 检查更新 |
| [**createVersionApiV1AppVersionPost**](AppVersionApi.md#createVersionApiV1AppVersionPost) | **POST** /api/v1/app-version | 新增版本 |
| [**createVersionApiV1AppVersionPost_0**](AppVersionApi.md#createVersionApiV1AppVersionPost_0) | **POST** /api/v1/app-version | 新增版本 |
| [**deleteVersionApiV1AppVersionVidDelete**](AppVersionApi.md#deleteVersionApiV1AppVersionVidDelete) | **DELETE** /api/v1/app-version/{vid} | 删除版本 |
| [**deleteVersionApiV1AppVersionVidDelete_0**](AppVersionApi.md#deleteVersionApiV1AppVersionVidDelete_0) | **DELETE** /api/v1/app-version/{vid} | 删除版本 |
| [**listVersionsApiV1AppVersionListGet**](AppVersionApi.md#listVersionsApiV1AppVersionListGet) | **GET** /api/v1/app-version/list | 版本列表 |
| [**listVersionsApiV1AppVersionListGet_0**](AppVersionApi.md#listVersionsApiV1AppVersionListGet_0) | **GET** /api/v1/app-version/list | 版本列表 |
| [**updateVersionApiV1AppVersionVidPut**](AppVersionApi.md#updateVersionApiV1AppVersionVidPut) | **PUT** /api/v1/app-version/{vid} | 修改版本 |
| [**updateVersionApiV1AppVersionVidPut_0**](AppVersionApi.md#updateVersionApiV1AppVersionVidPut_0) | **PUT** /api/v1/app-version/{vid} | 修改版本 |


<a id="checkUpdateApiV1AppVersionCheckGet"></a>
# **checkUpdateApiV1AppVersionCheckGet**
> Object checkUpdateApiV1AppVersionCheckGet(platform, currentVersion, build)

检查更新

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AppVersionApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AppVersionApi apiInstance = new AppVersionApi(defaultClient);
    String platform = "platform_example"; // String | 
    String currentVersion = "currentVersion_example"; // String | 
    Integer build = 0; // Integer | 
    try {
      Object result = apiInstance.checkUpdateApiV1AppVersionCheckGet(platform, currentVersion, build);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AppVersionApi#checkUpdateApiV1AppVersionCheckGet");
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
| **platform** | **String**|  | |
| **currentVersion** | **String**|  | |
| **build** | **Integer**|  | [optional] [default to 0] |

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

<a id="checkUpdateApiV1AppVersionCheckGet_0"></a>
# **checkUpdateApiV1AppVersionCheckGet_0**
> Object checkUpdateApiV1AppVersionCheckGet_0(platform, currentVersion, build)

检查更新

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AppVersionApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AppVersionApi apiInstance = new AppVersionApi(defaultClient);
    String platform = "platform_example"; // String | 
    String currentVersion = "currentVersion_example"; // String | 
    Integer build = 0; // Integer | 
    try {
      Object result = apiInstance.checkUpdateApiV1AppVersionCheckGet_0(platform, currentVersion, build);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AppVersionApi#checkUpdateApiV1AppVersionCheckGet_0");
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
| **platform** | **String**|  | |
| **currentVersion** | **String**|  | |
| **build** | **Integer**|  | [optional] [default to 0] |

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

<a id="createVersionApiV1AppVersionPost"></a>
# **createVersionApiV1AppVersionPost**
> Object createVersionApiV1AppVersionPost(platform, version, title, content, build, downloadUrl, isForce, isSilent, minVersion, grayRatio, fileSize, md5)

新增版本

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AppVersionApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AppVersionApi apiInstance = new AppVersionApi(defaultClient);
    String platform = "platform_example"; // String | 
    String version = "version_example"; // String | 
    String title = "title_example"; // String | 
    String content = "content_example"; // String | 
    Integer build = 1; // Integer | 
    String downloadUrl = "downloadUrl_example"; // String | 
    Boolean isForce = false; // Boolean | 
    Boolean isSilent = false; // Boolean | 
    String minVersion = "minVersion_example"; // String | 
    Integer grayRatio = 0; // Integer | 
    Integer fileSize = 0; // Integer | 
    String md5 = "md5_example"; // String | 
    try {
      Object result = apiInstance.createVersionApiV1AppVersionPost(platform, version, title, content, build, downloadUrl, isForce, isSilent, minVersion, grayRatio, fileSize, md5);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AppVersionApi#createVersionApiV1AppVersionPost");
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
| **platform** | **String**|  | |
| **version** | **String**|  | |
| **title** | **String**|  | |
| **content** | **String**|  | |
| **build** | **Integer**|  | [optional] [default to 1] |
| **downloadUrl** | **String**|  | [optional] |
| **isForce** | **Boolean**|  | [optional] [default to false] |
| **isSilent** | **Boolean**|  | [optional] [default to false] |
| **minVersion** | **String**|  | [optional] |
| **grayRatio** | **Integer**|  | [optional] [default to 0] |
| **fileSize** | **Integer**|  | [optional] [default to 0] |
| **md5** | **String**|  | [optional] |

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

<a id="createVersionApiV1AppVersionPost_0"></a>
# **createVersionApiV1AppVersionPost_0**
> Object createVersionApiV1AppVersionPost_0(platform, version, title, content, build, downloadUrl, isForce, isSilent, minVersion, grayRatio, fileSize, md5)

新增版本

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AppVersionApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AppVersionApi apiInstance = new AppVersionApi(defaultClient);
    String platform = "platform_example"; // String | 
    String version = "version_example"; // String | 
    String title = "title_example"; // String | 
    String content = "content_example"; // String | 
    Integer build = 1; // Integer | 
    String downloadUrl = "downloadUrl_example"; // String | 
    Boolean isForce = false; // Boolean | 
    Boolean isSilent = false; // Boolean | 
    String minVersion = "minVersion_example"; // String | 
    Integer grayRatio = 0; // Integer | 
    Integer fileSize = 0; // Integer | 
    String md5 = "md5_example"; // String | 
    try {
      Object result = apiInstance.createVersionApiV1AppVersionPost_0(platform, version, title, content, build, downloadUrl, isForce, isSilent, minVersion, grayRatio, fileSize, md5);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AppVersionApi#createVersionApiV1AppVersionPost_0");
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
| **platform** | **String**|  | |
| **version** | **String**|  | |
| **title** | **String**|  | |
| **content** | **String**|  | |
| **build** | **Integer**|  | [optional] [default to 1] |
| **downloadUrl** | **String**|  | [optional] |
| **isForce** | **Boolean**|  | [optional] [default to false] |
| **isSilent** | **Boolean**|  | [optional] [default to false] |
| **minVersion** | **String**|  | [optional] |
| **grayRatio** | **Integer**|  | [optional] [default to 0] |
| **fileSize** | **Integer**|  | [optional] [default to 0] |
| **md5** | **String**|  | [optional] |

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

<a id="deleteVersionApiV1AppVersionVidDelete"></a>
# **deleteVersionApiV1AppVersionVidDelete**
> Object deleteVersionApiV1AppVersionVidDelete(vid)

删除版本

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AppVersionApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AppVersionApi apiInstance = new AppVersionApi(defaultClient);
    Integer vid = 56; // Integer | 
    try {
      Object result = apiInstance.deleteVersionApiV1AppVersionVidDelete(vid);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AppVersionApi#deleteVersionApiV1AppVersionVidDelete");
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
| **vid** | **Integer**|  | |

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

<a id="deleteVersionApiV1AppVersionVidDelete_0"></a>
# **deleteVersionApiV1AppVersionVidDelete_0**
> Object deleteVersionApiV1AppVersionVidDelete_0(vid)

删除版本

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AppVersionApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AppVersionApi apiInstance = new AppVersionApi(defaultClient);
    Integer vid = 56; // Integer | 
    try {
      Object result = apiInstance.deleteVersionApiV1AppVersionVidDelete_0(vid);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AppVersionApi#deleteVersionApiV1AppVersionVidDelete_0");
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
| **vid** | **Integer**|  | |

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

<a id="listVersionsApiV1AppVersionListGet"></a>
# **listVersionsApiV1AppVersionListGet**
> Object listVersionsApiV1AppVersionListGet(platform, page, limit)

版本列表

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AppVersionApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AppVersionApi apiInstance = new AppVersionApi(defaultClient);
    String platform = "platform_example"; // String | 
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    try {
      Object result = apiInstance.listVersionsApiV1AppVersionListGet(platform, page, limit);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AppVersionApi#listVersionsApiV1AppVersionListGet");
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
| **platform** | **String**|  | [optional] |
| **page** | **Integer**|  | [optional] [default to 1] |
| **limit** | **Integer**|  | [optional] [default to 20] |

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

<a id="listVersionsApiV1AppVersionListGet_0"></a>
# **listVersionsApiV1AppVersionListGet_0**
> Object listVersionsApiV1AppVersionListGet_0(platform, page, limit)

版本列表

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AppVersionApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AppVersionApi apiInstance = new AppVersionApi(defaultClient);
    String platform = "platform_example"; // String | 
    Integer page = 1; // Integer | 
    Integer limit = 20; // Integer | 
    try {
      Object result = apiInstance.listVersionsApiV1AppVersionListGet_0(platform, page, limit);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AppVersionApi#listVersionsApiV1AppVersionListGet_0");
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
| **platform** | **String**|  | [optional] |
| **page** | **Integer**|  | [optional] [default to 1] |
| **limit** | **Integer**|  | [optional] [default to 20] |

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

<a id="updateVersionApiV1AppVersionVidPut"></a>
# **updateVersionApiV1AppVersionVidPut**
> Object updateVersionApiV1AppVersionVidPut(vid, title, content, status, isForce, downloadUrl, grayRatio)

修改版本

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AppVersionApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AppVersionApi apiInstance = new AppVersionApi(defaultClient);
    Integer vid = 56; // Integer | 
    String title = "title_example"; // String | 
    String content = "content_example"; // String | 
    Integer status = 56; // Integer | 
    Boolean isForce = true; // Boolean | 
    String downloadUrl = "downloadUrl_example"; // String | 
    Integer grayRatio = 56; // Integer | 
    try {
      Object result = apiInstance.updateVersionApiV1AppVersionVidPut(vid, title, content, status, isForce, downloadUrl, grayRatio);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AppVersionApi#updateVersionApiV1AppVersionVidPut");
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
| **vid** | **Integer**|  | |
| **title** | **String**|  | [optional] |
| **content** | **String**|  | [optional] |
| **status** | **Integer**|  | [optional] |
| **isForce** | **Boolean**|  | [optional] |
| **downloadUrl** | **String**|  | [optional] |
| **grayRatio** | **Integer**|  | [optional] |

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

<a id="updateVersionApiV1AppVersionVidPut_0"></a>
# **updateVersionApiV1AppVersionVidPut_0**
> Object updateVersionApiV1AppVersionVidPut_0(vid, title, content, status, isForce, downloadUrl, grayRatio)

修改版本

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AppVersionApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AppVersionApi apiInstance = new AppVersionApi(defaultClient);
    Integer vid = 56; // Integer | 
    String title = "title_example"; // String | 
    String content = "content_example"; // String | 
    Integer status = 56; // Integer | 
    Boolean isForce = true; // Boolean | 
    String downloadUrl = "downloadUrl_example"; // String | 
    Integer grayRatio = 56; // Integer | 
    try {
      Object result = apiInstance.updateVersionApiV1AppVersionVidPut_0(vid, title, content, status, isForce, downloadUrl, grayRatio);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AppVersionApi#updateVersionApiV1AppVersionVidPut_0");
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
| **vid** | **Integer**|  | |
| **title** | **String**|  | [optional] |
| **content** | **String**|  | [optional] |
| **status** | **Integer**|  | [optional] |
| **isForce** | **Boolean**|  | [optional] |
| **downloadUrl** | **String**|  | [optional] |
| **grayRatio** | **Integer**|  | [optional] |

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

