# CozeVariablesApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**createVariableApiV1CozeVariablesVariablesCreatePost**](CozeVariablesApi.md#createVariableApiV1CozeVariablesVariablesCreatePost) | **POST** /api/v1/coze/variables/variables/create | Create Variable |
| [**createVariableApiV1CozeVariablesVariablesCreatePost_0**](CozeVariablesApi.md#createVariableApiV1CozeVariablesVariablesCreatePost_0) | **POST** /api/v1/coze/variables/variables/create | Create Variable |
| [**deleteVariableApiV1CozeVariablesVariablesDeletePost**](CozeVariablesApi.md#deleteVariableApiV1CozeVariablesVariablesDeletePost) | **POST** /api/v1/coze/variables/variables/delete | Delete Variable |
| [**deleteVariableApiV1CozeVariablesVariablesDeletePost_0**](CozeVariablesApi.md#deleteVariableApiV1CozeVariablesVariablesDeletePost_0) | **POST** /api/v1/coze/variables/variables/delete | Delete Variable |
| [**listVariablesApiV1CozeVariablesVariablesListGet**](CozeVariablesApi.md#listVariablesApiV1CozeVariablesVariablesListGet) | **GET** /api/v1/coze/variables/variables/list | List Variables |
| [**listVariablesApiV1CozeVariablesVariablesListGet_0**](CozeVariablesApi.md#listVariablesApiV1CozeVariablesVariablesListGet_0) | **GET** /api/v1/coze/variables/variables/list | List Variables |
| [**retrieveVariableApiV1CozeVariablesVariablesRetrieveGet**](CozeVariablesApi.md#retrieveVariableApiV1CozeVariablesVariablesRetrieveGet) | **GET** /api/v1/coze/variables/variables/retrieve | Retrieve Variable |
| [**retrieveVariableApiV1CozeVariablesVariablesRetrieveGet_0**](CozeVariablesApi.md#retrieveVariableApiV1CozeVariablesVariablesRetrieveGet_0) | **GET** /api/v1/coze/variables/variables/retrieve | Retrieve Variable |
| [**updateVariableApiV1CozeVariablesVariablesUpdatePost**](CozeVariablesApi.md#updateVariableApiV1CozeVariablesVariablesUpdatePost) | **POST** /api/v1/coze/variables/variables/update | Update Variable |
| [**updateVariableApiV1CozeVariablesVariablesUpdatePost_0**](CozeVariablesApi.md#updateVariableApiV1CozeVariablesVariablesUpdatePost_0) | **POST** /api/v1/coze/variables/variables/update | Update Variable |


<a id="createVariableApiV1CozeVariablesVariablesCreatePost"></a>
# **createVariableApiV1CozeVariablesVariablesCreatePost**
> Object createVariableApiV1CozeVariablesVariablesCreatePost(createVarReq)

Create Variable

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CozeVariablesApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CozeVariablesApi apiInstance = new CozeVariablesApi(defaultClient);
    CreateVarReq createVarReq = new CreateVarReq(); // CreateVarReq | 
    try {
      Object result = apiInstance.createVariableApiV1CozeVariablesVariablesCreatePost(createVarReq);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CozeVariablesApi#createVariableApiV1CozeVariablesVariablesCreatePost");
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
| **createVarReq** | [**CreateVarReq**](CreateVarReq.md)|  | |

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

<a id="createVariableApiV1CozeVariablesVariablesCreatePost_0"></a>
# **createVariableApiV1CozeVariablesVariablesCreatePost_0**
> Object createVariableApiV1CozeVariablesVariablesCreatePost_0(createVarReq)

Create Variable

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CozeVariablesApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CozeVariablesApi apiInstance = new CozeVariablesApi(defaultClient);
    CreateVarReq createVarReq = new CreateVarReq(); // CreateVarReq | 
    try {
      Object result = apiInstance.createVariableApiV1CozeVariablesVariablesCreatePost_0(createVarReq);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CozeVariablesApi#createVariableApiV1CozeVariablesVariablesCreatePost_0");
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
| **createVarReq** | [**CreateVarReq**](CreateVarReq.md)|  | |

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

<a id="deleteVariableApiV1CozeVariablesVariablesDeletePost"></a>
# **deleteVariableApiV1CozeVariablesVariablesDeletePost**
> Object deleteVariableApiV1CozeVariablesVariablesDeletePost(deleteVarReq)

Delete Variable

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CozeVariablesApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CozeVariablesApi apiInstance = new CozeVariablesApi(defaultClient);
    DeleteVarReq deleteVarReq = new DeleteVarReq(); // DeleteVarReq | 
    try {
      Object result = apiInstance.deleteVariableApiV1CozeVariablesVariablesDeletePost(deleteVarReq);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CozeVariablesApi#deleteVariableApiV1CozeVariablesVariablesDeletePost");
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
| **deleteVarReq** | [**DeleteVarReq**](DeleteVarReq.md)|  | |

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

<a id="deleteVariableApiV1CozeVariablesVariablesDeletePost_0"></a>
# **deleteVariableApiV1CozeVariablesVariablesDeletePost_0**
> Object deleteVariableApiV1CozeVariablesVariablesDeletePost_0(deleteVarReq)

Delete Variable

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CozeVariablesApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CozeVariablesApi apiInstance = new CozeVariablesApi(defaultClient);
    DeleteVarReq deleteVarReq = new DeleteVarReq(); // DeleteVarReq | 
    try {
      Object result = apiInstance.deleteVariableApiV1CozeVariablesVariablesDeletePost_0(deleteVarReq);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CozeVariablesApi#deleteVariableApiV1CozeVariablesVariablesDeletePost_0");
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
| **deleteVarReq** | [**DeleteVarReq**](DeleteVarReq.md)|  | |

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

<a id="listVariablesApiV1CozeVariablesVariablesListGet"></a>
# **listVariablesApiV1CozeVariablesVariablesListGet**
> Object listVariablesApiV1CozeVariablesVariablesListGet(connectorId, page, size)

List Variables

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CozeVariablesApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CozeVariablesApi apiInstance = new CozeVariablesApi(defaultClient);
    String connectorId = "connectorId_example"; // String | 
    Integer page = 1; // Integer | 
    Integer size = 20; // Integer | 
    try {
      Object result = apiInstance.listVariablesApiV1CozeVariablesVariablesListGet(connectorId, page, size);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CozeVariablesApi#listVariablesApiV1CozeVariablesVariablesListGet");
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
| **connectorId** | **String**|  | |
| **page** | **Integer**|  | [optional] [default to 1] |
| **size** | **Integer**|  | [optional] [default to 20] |

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

<a id="listVariablesApiV1CozeVariablesVariablesListGet_0"></a>
# **listVariablesApiV1CozeVariablesVariablesListGet_0**
> Object listVariablesApiV1CozeVariablesVariablesListGet_0(connectorId, page, size)

List Variables

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CozeVariablesApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CozeVariablesApi apiInstance = new CozeVariablesApi(defaultClient);
    String connectorId = "connectorId_example"; // String | 
    Integer page = 1; // Integer | 
    Integer size = 20; // Integer | 
    try {
      Object result = apiInstance.listVariablesApiV1CozeVariablesVariablesListGet_0(connectorId, page, size);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CozeVariablesApi#listVariablesApiV1CozeVariablesVariablesListGet_0");
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
| **connectorId** | **String**|  | |
| **page** | **Integer**|  | [optional] [default to 1] |
| **size** | **Integer**|  | [optional] [default to 20] |

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

<a id="retrieveVariableApiV1CozeVariablesVariablesRetrieveGet"></a>
# **retrieveVariableApiV1CozeVariablesVariablesRetrieveGet**
> Object retrieveVariableApiV1CozeVariablesVariablesRetrieveGet(connectorId, variableId)

Retrieve Variable

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CozeVariablesApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CozeVariablesApi apiInstance = new CozeVariablesApi(defaultClient);
    String connectorId = "connectorId_example"; // String | 
    String variableId = "variableId_example"; // String | 
    try {
      Object result = apiInstance.retrieveVariableApiV1CozeVariablesVariablesRetrieveGet(connectorId, variableId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CozeVariablesApi#retrieveVariableApiV1CozeVariablesVariablesRetrieveGet");
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
| **connectorId** | **String**|  | |
| **variableId** | **String**|  | |

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

<a id="retrieveVariableApiV1CozeVariablesVariablesRetrieveGet_0"></a>
# **retrieveVariableApiV1CozeVariablesVariablesRetrieveGet_0**
> Object retrieveVariableApiV1CozeVariablesVariablesRetrieveGet_0(connectorId, variableId)

Retrieve Variable

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CozeVariablesApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CozeVariablesApi apiInstance = new CozeVariablesApi(defaultClient);
    String connectorId = "connectorId_example"; // String | 
    String variableId = "variableId_example"; // String | 
    try {
      Object result = apiInstance.retrieveVariableApiV1CozeVariablesVariablesRetrieveGet_0(connectorId, variableId);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CozeVariablesApi#retrieveVariableApiV1CozeVariablesVariablesRetrieveGet_0");
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
| **connectorId** | **String**|  | |
| **variableId** | **String**|  | |

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

<a id="updateVariableApiV1CozeVariablesVariablesUpdatePost"></a>
# **updateVariableApiV1CozeVariablesVariablesUpdatePost**
> Object updateVariableApiV1CozeVariablesVariablesUpdatePost(updateVarReq)

Update Variable

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CozeVariablesApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CozeVariablesApi apiInstance = new CozeVariablesApi(defaultClient);
    UpdateVarReq updateVarReq = new UpdateVarReq(); // UpdateVarReq | 
    try {
      Object result = apiInstance.updateVariableApiV1CozeVariablesVariablesUpdatePost(updateVarReq);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CozeVariablesApi#updateVariableApiV1CozeVariablesVariablesUpdatePost");
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
| **updateVarReq** | [**UpdateVarReq**](UpdateVarReq.md)|  | |

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

<a id="updateVariableApiV1CozeVariablesVariablesUpdatePost_0"></a>
# **updateVariableApiV1CozeVariablesVariablesUpdatePost_0**
> Object updateVariableApiV1CozeVariablesVariablesUpdatePost_0(updateVarReq)

Update Variable

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CozeVariablesApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CozeVariablesApi apiInstance = new CozeVariablesApi(defaultClient);
    UpdateVarReq updateVarReq = new UpdateVarReq(); // UpdateVarReq | 
    try {
      Object result = apiInstance.updateVariableApiV1CozeVariablesVariablesUpdatePost_0(updateVarReq);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CozeVariablesApi#updateVariableApiV1CozeVariablesVariablesUpdatePost_0");
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
| **updateVarReq** | [**UpdateVarReq**](UpdateVarReq.md)|  | |

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

