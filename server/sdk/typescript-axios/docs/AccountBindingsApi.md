# AccountBindingsApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**listBindingsApiV1AuthAuthBindingsGet**](#listbindingsapiv1authauthbindingsget) | **GET** /api/v1/auth/auth/bindings/ | List all third-party bindings|
|[**listBindingsApiV1AuthAuthBindingsGet_0**](#listbindingsapiv1authauthbindingsget_0) | **GET** /api/v1/auth/auth/bindings/ | List all third-party bindings|
|[**removeByPlatformApiV1AuthAuthBindingsRemovePost**](#removebyplatformapiv1authauthbindingsremovepost) | **POST** /api/v1/auth/auth/bindings/remove | Unbind third-party account by platform|
|[**removeByPlatformApiV1AuthAuthBindingsRemovePost_0**](#removebyplatformapiv1authauthbindingsremovepost_0) | **POST** /api/v1/auth/auth/bindings/remove | Unbind third-party account by platform|
|[**unbindApiV1AuthAuthBindingsBindingIdDelete**](#unbindapiv1authauthbindingsbindingiddelete) | **DELETE** /api/v1/auth/auth/bindings/{binding_id} | Unbind third-party account by ID|
|[**unbindApiV1AuthAuthBindingsBindingIdDelete_0**](#unbindapiv1authauthbindingsbindingiddelete_0) | **DELETE** /api/v1/auth/auth/bindings/{binding_id} | Unbind third-party account by ID|

# **listBindingsApiV1AuthAuthBindingsGet**
> any listBindingsApiV1AuthAuthBindingsGet()

Get all third-party account bindings for the current user.  Matches Java: AuthorizationManagementServlet.getList(uuid)

### Example

```typescript
import {
    AccountBindingsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AccountBindingsApi(configuration);

const { status, data } = await apiInstance.listBindingsApiV1AuthAuthBindingsGet();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **listBindingsApiV1AuthAuthBindingsGet_0**
> any listBindingsApiV1AuthAuthBindingsGet_0()

Get all third-party account bindings for the current user.  Matches Java: AuthorizationManagementServlet.getList(uuid)

### Example

```typescript
import {
    AccountBindingsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AccountBindingsApi(configuration);

const { status, data } = await apiInstance.listBindingsApiV1AuthAuthBindingsGet_0();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **removeByPlatformApiV1AuthAuthBindingsRemovePost**
> any removeByPlatformApiV1AuthAuthBindingsRemovePost(bodyRemoveByPlatformApiV1AuthAuthBindingsRemovePost)

Remove a third-party account binding by uuid + platform.  Matches Java: AuthorizationManagementController.delAuth -> AuthorizationManagementServlet.delAuth(uuid, platform) SQL: DELETE FROM user_third_party_accounts WHERE user_uuid = #{uuid} AND platform = #{platform}

### Example

```typescript
import {
    AccountBindingsApi,
    Configuration,
    BodyRemoveByPlatformApiV1AuthAuthBindingsRemovePost
} from './api';

const configuration = new Configuration();
const apiInstance = new AccountBindingsApi(configuration);

let bodyRemoveByPlatformApiV1AuthAuthBindingsRemovePost: BodyRemoveByPlatformApiV1AuthAuthBindingsRemovePost; //

const { status, data } = await apiInstance.removeByPlatformApiV1AuthAuthBindingsRemovePost(
    bodyRemoveByPlatformApiV1AuthAuthBindingsRemovePost
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **bodyRemoveByPlatformApiV1AuthAuthBindingsRemovePost** | **BodyRemoveByPlatformApiV1AuthAuthBindingsRemovePost**|  | |


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **removeByPlatformApiV1AuthAuthBindingsRemovePost_0**
> any removeByPlatformApiV1AuthAuthBindingsRemovePost_0(bodyRemoveByPlatformApiV1AuthAuthBindingsRemovePost)

Remove a third-party account binding by uuid + platform.  Matches Java: AuthorizationManagementController.delAuth -> AuthorizationManagementServlet.delAuth(uuid, platform) SQL: DELETE FROM user_third_party_accounts WHERE user_uuid = #{uuid} AND platform = #{platform}

### Example

```typescript
import {
    AccountBindingsApi,
    Configuration,
    BodyRemoveByPlatformApiV1AuthAuthBindingsRemovePost
} from './api';

const configuration = new Configuration();
const apiInstance = new AccountBindingsApi(configuration);

let bodyRemoveByPlatformApiV1AuthAuthBindingsRemovePost: BodyRemoveByPlatformApiV1AuthAuthBindingsRemovePost; //

const { status, data } = await apiInstance.removeByPlatformApiV1AuthAuthBindingsRemovePost_0(
    bodyRemoveByPlatformApiV1AuthAuthBindingsRemovePost
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **bodyRemoveByPlatformApiV1AuthAuthBindingsRemovePost** | **BodyRemoveByPlatformApiV1AuthAuthBindingsRemovePost**|  | |


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **unbindApiV1AuthAuthBindingsBindingIdDelete**
> any unbindApiV1AuthAuthBindingsBindingIdDelete()

Remove a third-party account binding by ID.

### Example

```typescript
import {
    AccountBindingsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AccountBindingsApi(configuration);

let bindingId: number; // (default to undefined)

const { status, data } = await apiInstance.unbindApiV1AuthAuthBindingsBindingIdDelete(
    bindingId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **bindingId** | [**number**] |  | defaults to undefined|


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **unbindApiV1AuthAuthBindingsBindingIdDelete_0**
> any unbindApiV1AuthAuthBindingsBindingIdDelete_0()

Remove a third-party account binding by ID.

### Example

```typescript
import {
    AccountBindingsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AccountBindingsApi(configuration);

let bindingId: number; // (default to undefined)

const { status, data } = await apiInstance.unbindApiV1AuthAuthBindingsBindingIdDelete_0(
    bindingId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **bindingId** | [**number**] |  | defaults to undefined|


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

