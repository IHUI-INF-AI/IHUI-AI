# AskCategoryApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**addCategoryApiV1AskCategoryPost**](AskCategoryApi.md#addCategoryApiV1AskCategoryPost) | **POST** /api/v1/ask/category | 添加分类 |
| [**askCategoryAdminList**](AskCategoryApi.md#askCategoryAdminList) | **GET** /api/v1/ask/category/admin/list | 分类列表(管理员) |
| [**changeShowApiV1AskCategoryIsShowPut**](AskCategoryApi.md#changeShowApiV1AskCategoryIsShowPut) | **PUT** /api/v1/ask/category/is-show | 修改显示状态 |
| [**changeShowIndexApiV1AskCategoryIsShowIndexPut**](AskCategoryApi.md#changeShowIndexApiV1AskCategoryIsShowIndexPut) | **PUT** /api/v1/ask/category/is-show-index | 修改首页显示状态 |
| [**deleteCategoryApiV1AskCategoryCatIdDelete**](AskCategoryApi.md#deleteCategoryApiV1AskCategoryCatIdDelete) | **DELETE** /api/v1/ask/category/{cat_id} | 删除分类 |
| [**getCategoryApiV1AskCategoryCatIdGet**](AskCategoryApi.md#getCategoryApiV1AskCategoryCatIdGet) | **GET** /api/v1/ask/category/{cat_id} | 分类详情 |
| [**publicListApiV1AskCategoryPublicApiListGet**](AskCategoryApi.md#publicListApiV1AskCategoryPublicApiListGet) | **GET** /api/v1/ask/category/public-api/list | 分类列表(公开) |
| [**updateCategoryApiV1AskCategoryPut**](AskCategoryApi.md#updateCategoryApiV1AskCategoryPut) | **PUT** /api/v1/ask/category | 修改分类 |


<a id="addCategoryApiV1AskCategoryPost"></a>
# **addCategoryApiV1AskCategoryPost**
> Object addCategoryApiV1AskCategoryPost(categoryCreate)

添加分类

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AskCategoryApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AskCategoryApi apiInstance = new AskCategoryApi(defaultClient);
    CategoryCreate categoryCreate = new CategoryCreate(); // CategoryCreate | 
    try {
      Object result = apiInstance.addCategoryApiV1AskCategoryPost(categoryCreate);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AskCategoryApi#addCategoryApiV1AskCategoryPost");
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
| **categoryCreate** | [**CategoryCreate**](CategoryCreate.md)|  | |

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

<a id="askCategoryAdminList"></a>
# **askCategoryAdminList**
> Object askCategoryAdminList(isShow, isShowIndex)

分类列表(管理员)

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AskCategoryApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AskCategoryApi apiInstance = new AskCategoryApi(defaultClient);
    Boolean isShow = true; // Boolean | 
    Boolean isShowIndex = true; // Boolean | 
    try {
      Object result = apiInstance.askCategoryAdminList(isShow, isShowIndex);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AskCategoryApi#askCategoryAdminList");
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
| **isShow** | **Boolean**|  | [optional] |
| **isShowIndex** | **Boolean**|  | [optional] |

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

<a id="changeShowApiV1AskCategoryIsShowPut"></a>
# **changeShowApiV1AskCategoryIsShowPut**
> Object changeShowApiV1AskCategoryIsShowPut(id, isShow)

修改显示状态

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AskCategoryApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AskCategoryApi apiInstance = new AskCategoryApi(defaultClient);
    Integer id = 56; // Integer | 
    Boolean isShow = true; // Boolean | 
    try {
      Object result = apiInstance.changeShowApiV1AskCategoryIsShowPut(id, isShow);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AskCategoryApi#changeShowApiV1AskCategoryIsShowPut");
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
| **id** | **Integer**|  | |
| **isShow** | **Boolean**|  | |

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

<a id="changeShowIndexApiV1AskCategoryIsShowIndexPut"></a>
# **changeShowIndexApiV1AskCategoryIsShowIndexPut**
> Object changeShowIndexApiV1AskCategoryIsShowIndexPut(id, isShowIndex)

修改首页显示状态

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AskCategoryApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AskCategoryApi apiInstance = new AskCategoryApi(defaultClient);
    Integer id = 56; // Integer | 
    Boolean isShowIndex = true; // Boolean | 
    try {
      Object result = apiInstance.changeShowIndexApiV1AskCategoryIsShowIndexPut(id, isShowIndex);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AskCategoryApi#changeShowIndexApiV1AskCategoryIsShowIndexPut");
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
| **id** | **Integer**|  | |
| **isShowIndex** | **Boolean**|  | |

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

<a id="deleteCategoryApiV1AskCategoryCatIdDelete"></a>
# **deleteCategoryApiV1AskCategoryCatIdDelete**
> Object deleteCategoryApiV1AskCategoryCatIdDelete(catId)

删除分类

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AskCategoryApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AskCategoryApi apiInstance = new AskCategoryApi(defaultClient);
    Integer catId = 56; // Integer | 
    try {
      Object result = apiInstance.deleteCategoryApiV1AskCategoryCatIdDelete(catId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AskCategoryApi#deleteCategoryApiV1AskCategoryCatIdDelete");
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
| **catId** | **Integer**|  | |

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

<a id="getCategoryApiV1AskCategoryCatIdGet"></a>
# **getCategoryApiV1AskCategoryCatIdGet**
> Object getCategoryApiV1AskCategoryCatIdGet(catId)

分类详情

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AskCategoryApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AskCategoryApi apiInstance = new AskCategoryApi(defaultClient);
    Integer catId = 56; // Integer | 
    try {
      Object result = apiInstance.getCategoryApiV1AskCategoryCatIdGet(catId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AskCategoryApi#getCategoryApiV1AskCategoryCatIdGet");
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
| **catId** | **Integer**|  | |

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

<a id="publicListApiV1AskCategoryPublicApiListGet"></a>
# **publicListApiV1AskCategoryPublicApiListGet**
> Object publicListApiV1AskCategoryPublicApiListGet(isShow, isShowIndex)

分类列表(公开)

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AskCategoryApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AskCategoryApi apiInstance = new AskCategoryApi(defaultClient);
    Boolean isShow = true; // Boolean | 
    Boolean isShowIndex = true; // Boolean | 
    try {
      Object result = apiInstance.publicListApiV1AskCategoryPublicApiListGet(isShow, isShowIndex);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AskCategoryApi#publicListApiV1AskCategoryPublicApiListGet");
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
| **isShow** | **Boolean**|  | [optional] |
| **isShowIndex** | **Boolean**|  | [optional] |

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

<a id="updateCategoryApiV1AskCategoryPut"></a>
# **updateCategoryApiV1AskCategoryPut**
> Object updateCategoryApiV1AskCategoryPut(categoryUpdate)

修改分类

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.AskCategoryApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    AskCategoryApi apiInstance = new AskCategoryApi(defaultClient);
    CategoryUpdate categoryUpdate = new CategoryUpdate(); // CategoryUpdate | 
    try {
      Object result = apiInstance.updateCategoryApiV1AskCategoryPut(categoryUpdate);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling AskCategoryApi#updateCategoryApiV1AskCategoryPut");
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
| **categoryUpdate** | [**CategoryUpdate**](CategoryUpdate.md)|  | |

### Return type

**Object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

