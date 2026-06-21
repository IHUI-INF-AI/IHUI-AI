# UsersApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**getProfileApiV1UserInfoGet**](#getprofileapiv1userinfoget) | **GET** /api/v1/user/info | Get current user profile|
|[**updateProfileApiV1UserUpdatePut**](#updateprofileapiv1userupdateput) | **PUT** /api/v1/user/update | Update user profile|

# **getProfileApiV1UserInfoGet**
> any getProfileApiV1UserInfoGet()


### Example

```typescript
import {
    UsersApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new UsersApi(configuration);

const { status, data } = await apiInstance.getProfileApiV1UserInfoGet();
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

# **updateProfileApiV1UserUpdatePut**
> any updateProfileApiV1UserUpdatePut()


### Example

```typescript
import {
    UsersApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new UsersApi(configuration);

let nickname: string; // (optional) (default to undefined)
let avatar: string; // (optional) (default to undefined)
let gender: number; // (optional) (default to undefined)

const { status, data } = await apiInstance.updateProfileApiV1UserUpdatePut(
    nickname,
    avatar,
    gender
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **nickname** | [**string**] |  | (optional) defaults to undefined|
| **avatar** | [**string**] |  | (optional) defaults to undefined|
| **gender** | [**number**] |  | (optional) defaults to undefined|


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

