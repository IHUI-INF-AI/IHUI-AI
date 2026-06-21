# CozeWorkspacesApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**createMembersApiV1CozeWorkspacesWorkspacesMembersCreatePost**](CozeWorkspacesApi.md#createMembersApiV1CozeWorkspacesWorkspacesMembersCreatePost) | **POST** /api/v1/coze/workspaces/workspaces/members/create | Create Members |
| [**createMembersApiV1CozeWorkspacesWorkspacesMembersCreatePost_0**](CozeWorkspacesApi.md#createMembersApiV1CozeWorkspacesWorkspacesMembersCreatePost_0) | **POST** /api/v1/coze/workspaces/workspaces/members/create | Create Members |
| [**deleteMembersApiV1CozeWorkspacesWorkspacesMembersDeletePost**](CozeWorkspacesApi.md#deleteMembersApiV1CozeWorkspacesWorkspacesMembersDeletePost) | **POST** /api/v1/coze/workspaces/workspaces/members/delete | Delete Members |
| [**deleteMembersApiV1CozeWorkspacesWorkspacesMembersDeletePost_0**](CozeWorkspacesApi.md#deleteMembersApiV1CozeWorkspacesWorkspacesMembersDeletePost_0) | **POST** /api/v1/coze/workspaces/workspaces/members/delete | Delete Members |
| [**listWorkspacesApiV1CozeWorkspacesWorkspacesListGet**](CozeWorkspacesApi.md#listWorkspacesApiV1CozeWorkspacesWorkspacesListGet) | **GET** /api/v1/coze/workspaces/workspaces/list | List Workspaces |
| [**listWorkspacesApiV1CozeWorkspacesWorkspacesListGet_0**](CozeWorkspacesApi.md#listWorkspacesApiV1CozeWorkspacesWorkspacesListGet_0) | **GET** /api/v1/coze/workspaces/workspaces/list | List Workspaces |


<a id="createMembersApiV1CozeWorkspacesWorkspacesMembersCreatePost"></a>
# **createMembersApiV1CozeWorkspacesWorkspacesMembersCreatePost**
> Object createMembersApiV1CozeWorkspacesWorkspacesMembersCreatePost(membersReq)

Create Members

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CozeWorkspacesApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CozeWorkspacesApi apiInstance = new CozeWorkspacesApi(defaultClient);
    MembersReq membersReq = new MembersReq(); // MembersReq | 
    try {
      Object result = apiInstance.createMembersApiV1CozeWorkspacesWorkspacesMembersCreatePost(membersReq);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CozeWorkspacesApi#createMembersApiV1CozeWorkspacesWorkspacesMembersCreatePost");
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
| **membersReq** | [**MembersReq**](MembersReq.md)|  | |

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

<a id="createMembersApiV1CozeWorkspacesWorkspacesMembersCreatePost_0"></a>
# **createMembersApiV1CozeWorkspacesWorkspacesMembersCreatePost_0**
> Object createMembersApiV1CozeWorkspacesWorkspacesMembersCreatePost_0(membersReq)

Create Members

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CozeWorkspacesApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CozeWorkspacesApi apiInstance = new CozeWorkspacesApi(defaultClient);
    MembersReq membersReq = new MembersReq(); // MembersReq | 
    try {
      Object result = apiInstance.createMembersApiV1CozeWorkspacesWorkspacesMembersCreatePost_0(membersReq);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CozeWorkspacesApi#createMembersApiV1CozeWorkspacesWorkspacesMembersCreatePost_0");
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
| **membersReq** | [**MembersReq**](MembersReq.md)|  | |

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

<a id="deleteMembersApiV1CozeWorkspacesWorkspacesMembersDeletePost"></a>
# **deleteMembersApiV1CozeWorkspacesWorkspacesMembersDeletePost**
> Object deleteMembersApiV1CozeWorkspacesWorkspacesMembersDeletePost(deleteMembersReq)

Delete Members

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CozeWorkspacesApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CozeWorkspacesApi apiInstance = new CozeWorkspacesApi(defaultClient);
    DeleteMembersReq deleteMembersReq = new DeleteMembersReq(); // DeleteMembersReq | 
    try {
      Object result = apiInstance.deleteMembersApiV1CozeWorkspacesWorkspacesMembersDeletePost(deleteMembersReq);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CozeWorkspacesApi#deleteMembersApiV1CozeWorkspacesWorkspacesMembersDeletePost");
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
| **deleteMembersReq** | [**DeleteMembersReq**](DeleteMembersReq.md)|  | |

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

<a id="deleteMembersApiV1CozeWorkspacesWorkspacesMembersDeletePost_0"></a>
# **deleteMembersApiV1CozeWorkspacesWorkspacesMembersDeletePost_0**
> Object deleteMembersApiV1CozeWorkspacesWorkspacesMembersDeletePost_0(deleteMembersReq)

Delete Members

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CozeWorkspacesApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CozeWorkspacesApi apiInstance = new CozeWorkspacesApi(defaultClient);
    DeleteMembersReq deleteMembersReq = new DeleteMembersReq(); // DeleteMembersReq | 
    try {
      Object result = apiInstance.deleteMembersApiV1CozeWorkspacesWorkspacesMembersDeletePost_0(deleteMembersReq);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CozeWorkspacesApi#deleteMembersApiV1CozeWorkspacesWorkspacesMembersDeletePost_0");
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
| **deleteMembersReq** | [**DeleteMembersReq**](DeleteMembersReq.md)|  | |

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

<a id="listWorkspacesApiV1CozeWorkspacesWorkspacesListGet"></a>
# **listWorkspacesApiV1CozeWorkspacesWorkspacesListGet**
> Object listWorkspacesApiV1CozeWorkspacesWorkspacesListGet(page, size)

List Workspaces

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CozeWorkspacesApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CozeWorkspacesApi apiInstance = new CozeWorkspacesApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer size = 20; // Integer | 
    try {
      Object result = apiInstance.listWorkspacesApiV1CozeWorkspacesWorkspacesListGet(page, size);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CozeWorkspacesApi#listWorkspacesApiV1CozeWorkspacesWorkspacesListGet");
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

<a id="listWorkspacesApiV1CozeWorkspacesWorkspacesListGet_0"></a>
# **listWorkspacesApiV1CozeWorkspacesWorkspacesListGet_0**
> Object listWorkspacesApiV1CozeWorkspacesWorkspacesListGet_0(page, size)

List Workspaces

### Example
```java
// Import classes:
import org.openapitools.client.ApiClient;
import org.openapitools.client.ApiException;
import org.openapitools.client.Configuration;
import org.openapitools.client.models.*;
import org.openapitools.client.api.CozeWorkspacesApi;

public class Example {
  public static void main(String[] args) {
    ApiClient defaultClient = Configuration.getDefaultApiClient();
    defaultClient.setBasePath("http://localhost");

    CozeWorkspacesApi apiInstance = new CozeWorkspacesApi(defaultClient);
    Integer page = 1; // Integer | 
    Integer size = 20; // Integer | 
    try {
      Object result = apiInstance.listWorkspacesApiV1CozeWorkspacesWorkspacesListGet_0(page, size);
      System.out.println(result);
    } catch (ApiException e) {
      System.err.println("Exception when calling CozeWorkspacesApi#listWorkspacesApiV1CozeWorkspacesWorkspacesListGet_0");
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

