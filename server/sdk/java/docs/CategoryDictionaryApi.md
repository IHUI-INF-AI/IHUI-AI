# CategoryDictionaryApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**createDictApiV1CategoryDictionaryPost**](CategoryDictionaryApi.md#createDictApiV1CategoryDictionaryPost) | **POST** /api/v1/category-dictionary | 新增字典 |
| [**createDictApiV1CategoryDictionaryPost_0**](CategoryDictionaryApi.md#createDictApiV1CategoryDictionaryPost_0) | **POST** /api/v1/category-dictionary | 新增字典 |
| [**deleteDictApiV1CategoryDictionaryDidDelete**](CategoryDictionaryApi.md#deleteDictApiV1CategoryDictionaryDidDelete) | **DELETE** /api/v1/category-dictionary/{did} | 删除字典 |
| [**deleteDictApiV1CategoryDictionaryDidDelete_0**](CategoryDictionaryApi.md#deleteDictApiV1CategoryDictionaryDidDelete_0) | **DELETE** /api/v1/category-dictionary/{did} | 删除字典 |
| [**dictTypesApiV1CategoryDictionaryTypeGet**](CategoryDictionaryApi.md#dictTypesApiV1CategoryDictionaryTypeGet) | **GET** /api/v1/category-dictionary/type | 字典类型列表 |
| [**dictTypesApiV1CategoryDictionaryTypeGet_0**](CategoryDictionaryApi.md#dictTypesApiV1CategoryDictionaryTypeGet_0) | **GET** /api/v1/category-dictionary/type | 字典类型列表 |
| [**getDictApiV1CategoryDictionaryDidGet**](CategoryDictionaryApi.md#getDictApiV1CategoryDictionaryDidGet) | **GET** /api/v1/category-dictionary/{did} | 字典详情 |
| [**getDictApiV1CategoryDictionaryDidGet_0**](CategoryDictionaryApi.md#getDictApiV1CategoryDictionaryDidGet_0) | **GET** /api/v1/category-dictionary/{did} | 字典详情 |
| [**listDictApiV1CategoryDictionaryListGet**](CategoryDictionaryApi.md#listDictApiV1CategoryDictionaryListGet) | **GET** /api/v1/category-dictionary/list | 字典列表 |
| [**listDictApiV1CategoryDictionaryListGet_0**](CategoryDictionaryApi.md#listDictApiV1CategoryDictionaryListGet_0) | **GET** /api/v1/category-dictionary/list | 字典列表 |
| [**updateDictApiV1CategoryDictionaryDidPut**](CategoryDictionaryApi.md#updateDictApiV1CategoryDictionaryDidPut) | **PUT** /api/v1/category-dictionary/{did} | 修改字典 |
| [**updateDictApiV1CategoryDictionaryDidPut_0**](CategoryDictionaryApi.md#updateDictApiV1CategoryDictionaryDidPut_0) | **PUT** /api/v1/category-dictionary/{did} | 修改字典 |


<a id="createDictApiV1CategoryDictionaryPost"></a>
# **createDictApiV1CategoryDictionaryPost**
> Object createDictApiV1CategoryDictionaryPost(dictType, code, label, value, sortOrder, isShow, description, parentId, extra)

新增字典

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CategoryDictionaryApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CategoryDictionaryApi apiInstance = new CategoryDictionaryApi(defaultClient);
    String dictType = "dictType_example"; // String | 
    String code = "code_example"; // String | 
    String label = "label_example"; // String | 
    String value = "value_example"; // String | 
    Integer sortOrder = 0; // Integer | 
    Boolean isShow = true; // Boolean | 
    String description = "description_example"; // String | 
    Integer parentId = 0; // Integer | 
    String extra = "extra_example"; // String | 
    try {
      Object result = apiInstance.createDictApiV1CategoryDictionaryPost(dictType, code, label, value, sortOrder, isShow, description, parentId, extra);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CategoryDictionaryApi#createDictApiV1CategoryDictionaryPost");
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
| **dictType** | **String**|  | |
| **code** | **String**|  | |
| **label** | **String**|  | |
| **value** | **String**|  | [optional] |
| **sortOrder** | **Integer**|  | [optional] [default to 0] |
| **isShow** | **Boolean**|  | [optional] [default to true] |
| **description** | **String**|  | [optional] |
| **parentId** | **Integer**|  | [optional] [default to 0] |
| **extra** | **String**|  | [optional] |

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

<a id="createDictApiV1CategoryDictionaryPost_0"></a>
# **createDictApiV1CategoryDictionaryPost_0**
> Object createDictApiV1CategoryDictionaryPost_0(dictType, code, label, value, sortOrder, isShow, description, parentId, extra)

新增字典

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CategoryDictionaryApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CategoryDictionaryApi apiInstance = new CategoryDictionaryApi(defaultClient);
    String dictType = "dictType_example"; // String | 
    String code = "code_example"; // String | 
    String label = "label_example"; // String | 
    String value = "value_example"; // String | 
    Integer sortOrder = 0; // Integer | 
    Boolean isShow = true; // Boolean | 
    String description = "description_example"; // String | 
    Integer parentId = 0; // Integer | 
    String extra = "extra_example"; // String | 
    try {
      Object result = apiInstance.createDictApiV1CategoryDictionaryPost_0(dictType, code, label, value, sortOrder, isShow, description, parentId, extra);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CategoryDictionaryApi#createDictApiV1CategoryDictionaryPost_0");
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
| **dictType** | **String**|  | |
| **code** | **String**|  | |
| **label** | **String**|  | |
| **value** | **String**|  | [optional] |
| **sortOrder** | **Integer**|  | [optional] [default to 0] |
| **isShow** | **Boolean**|  | [optional] [default to true] |
| **description** | **String**|  | [optional] |
| **parentId** | **Integer**|  | [optional] [default to 0] |
| **extra** | **String**|  | [optional] |

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

<a id="deleteDictApiV1CategoryDictionaryDidDelete"></a>
# **deleteDictApiV1CategoryDictionaryDidDelete**
> Object deleteDictApiV1CategoryDictionaryDidDelete(did)

删除字典

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CategoryDictionaryApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CategoryDictionaryApi apiInstance = new CategoryDictionaryApi(defaultClient);
    Integer did = 56; // Integer | 
    try {
      Object result = apiInstance.deleteDictApiV1CategoryDictionaryDidDelete(did);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CategoryDictionaryApi#deleteDictApiV1CategoryDictionaryDidDelete");
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
| **did** | **Integer**|  | |

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

<a id="deleteDictApiV1CategoryDictionaryDidDelete_0"></a>
# **deleteDictApiV1CategoryDictionaryDidDelete_0**
> Object deleteDictApiV1CategoryDictionaryDidDelete_0(did)

删除字典

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CategoryDictionaryApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CategoryDictionaryApi apiInstance = new CategoryDictionaryApi(defaultClient);
    Integer did = 56; // Integer | 
    try {
      Object result = apiInstance.deleteDictApiV1CategoryDictionaryDidDelete_0(did);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CategoryDictionaryApi#deleteDictApiV1CategoryDictionaryDidDelete_0");
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
| **did** | **Integer**|  | |

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

<a id="dictTypesApiV1CategoryDictionaryTypeGet"></a>
# **dictTypesApiV1CategoryDictionaryTypeGet**
> Object dictTypesApiV1CategoryDictionaryTypeGet()

字典类型列表

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CategoryDictionaryApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CategoryDictionaryApi apiInstance = new CategoryDictionaryApi(defaultClient);
    try {
      Object result = apiInstance.dictTypesApiV1CategoryDictionaryTypeGet();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CategoryDictionaryApi#dictTypesApiV1CategoryDictionaryTypeGet");
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

<a id="dictTypesApiV1CategoryDictionaryTypeGet_0"></a>
# **dictTypesApiV1CategoryDictionaryTypeGet_0**
> Object dictTypesApiV1CategoryDictionaryTypeGet_0()

字典类型列表

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CategoryDictionaryApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CategoryDictionaryApi apiInstance = new CategoryDictionaryApi(defaultClient);
    try {
      Object result = apiInstance.dictTypesApiV1CategoryDictionaryTypeGet_0();
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CategoryDictionaryApi#dictTypesApiV1CategoryDictionaryTypeGet_0");
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

<a id="getDictApiV1CategoryDictionaryDidGet"></a>
# **getDictApiV1CategoryDictionaryDidGet**
> Object getDictApiV1CategoryDictionaryDidGet(did)

字典详情

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CategoryDictionaryApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CategoryDictionaryApi apiInstance = new CategoryDictionaryApi(defaultClient);
    Integer did = 56; // Integer | 
    try {
      Object result = apiInstance.getDictApiV1CategoryDictionaryDidGet(did);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CategoryDictionaryApi#getDictApiV1CategoryDictionaryDidGet");
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
| **did** | **Integer**|  | |

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

<a id="getDictApiV1CategoryDictionaryDidGet_0"></a>
# **getDictApiV1CategoryDictionaryDidGet_0**
> Object getDictApiV1CategoryDictionaryDidGet_0(did)

字典详情

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CategoryDictionaryApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CategoryDictionaryApi apiInstance = new CategoryDictionaryApi(defaultClient);
    Integer did = 56; // Integer | 
    try {
      Object result = apiInstance.getDictApiV1CategoryDictionaryDidGet_0(did);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CategoryDictionaryApi#getDictApiV1CategoryDictionaryDidGet_0");
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
| **did** | **Integer**|  | |

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

<a id="listDictApiV1CategoryDictionaryListGet"></a>
# **listDictApiV1CategoryDictionaryListGet**
> Object listDictApiV1CategoryDictionaryListGet(dictType, page, limit)

字典列表

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CategoryDictionaryApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CategoryDictionaryApi apiInstance = new CategoryDictionaryApi(defaultClient);
    String dictType = "dictType_example"; // String | 
    Integer page = 1; // Integer | 
    Integer limit = 100; // Integer | 
    try {
      Object result = apiInstance.listDictApiV1CategoryDictionaryListGet(dictType, page, limit);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CategoryDictionaryApi#listDictApiV1CategoryDictionaryListGet");
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
| **dictType** | **String**|  | [optional] |
| **page** | **Integer**|  | [optional] [default to 1] |
| **limit** | **Integer**|  | [optional] [default to 100] |

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

<a id="listDictApiV1CategoryDictionaryListGet_0"></a>
# **listDictApiV1CategoryDictionaryListGet_0**
> Object listDictApiV1CategoryDictionaryListGet_0(dictType, page, limit)

字典列表

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CategoryDictionaryApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CategoryDictionaryApi apiInstance = new CategoryDictionaryApi(defaultClient);
    String dictType = "dictType_example"; // String | 
    Integer page = 1; // Integer | 
    Integer limit = 100; // Integer | 
    try {
      Object result = apiInstance.listDictApiV1CategoryDictionaryListGet_0(dictType, page, limit);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CategoryDictionaryApi#listDictApiV1CategoryDictionaryListGet_0");
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
| **dictType** | **String**|  | [optional] |
| **page** | **Integer**|  | [optional] [default to 1] |
| **limit** | **Integer**|  | [optional] [default to 100] |

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

<a id="updateDictApiV1CategoryDictionaryDidPut"></a>
# **updateDictApiV1CategoryDictionaryDidPut**
> Object updateDictApiV1CategoryDictionaryDidPut(did, label, value, sortOrder, isShow, description)

修改字典

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CategoryDictionaryApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CategoryDictionaryApi apiInstance = new CategoryDictionaryApi(defaultClient);
    Integer did = 56; // Integer | 
    String label = "label_example"; // String | 
    String value = "value_example"; // String | 
    Integer sortOrder = 56; // Integer | 
    Boolean isShow = true; // Boolean | 
    String description = "description_example"; // String | 
    try {
      Object result = apiInstance.updateDictApiV1CategoryDictionaryDidPut(did, label, value, sortOrder, isShow, description);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CategoryDictionaryApi#updateDictApiV1CategoryDictionaryDidPut");
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
| **did** | **Integer**|  | |
| **label** | **String**|  | [optional] |
| **value** | **String**|  | [optional] |
| **sortOrder** | **Integer**|  | [optional] |
| **isShow** | **Boolean**|  | [optional] |
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

<a id="updateDictApiV1CategoryDictionaryDidPut_0"></a>
# **updateDictApiV1CategoryDictionaryDidPut_0**
> Object updateDictApiV1CategoryDictionaryDidPut_0(did, label, value, sortOrder, isShow, description)

修改字典

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CategoryDictionaryApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CategoryDictionaryApi apiInstance = new CategoryDictionaryApi(defaultClient);
    Integer did = 56; // Integer | 
    String label = "label_example"; // String | 
    String value = "value_example"; // String | 
    Integer sortOrder = 56; // Integer | 
    Boolean isShow = true; // Boolean | 
    String description = "description_example"; // String | 
    try {
      Object result = apiInstance.updateDictApiV1CategoryDictionaryDidPut_0(did, label, value, sortOrder, isShow, description);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CategoryDictionaryApi#updateDictApiV1CategoryDictionaryDidPut_0");
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
| **did** | **Integer**|  | |
| **label** | **String**|  | [optional] |
| **value** | **String**|  | [optional] |
| **sortOrder** | **Integer**|  | [optional] |
| **isShow** | **Boolean**|  | [optional] |
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

