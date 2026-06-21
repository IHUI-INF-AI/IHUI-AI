# UserSKApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**createSkApiV1AuthUserSkCreatePost**](#createskapiv1authuserskcreatepost) | **POST** /api/v1/auth/user-sk/create | Create a secret key|
|[**createSkApiV1AuthUserSkCreatePost_0**](#createskapiv1authuserskcreatepost_0) | **POST** /api/v1/auth/user-sk/create | Create a secret key|
|[**deleteSkApiV1AuthUserSkSkIdDelete**](#deleteskapiv1authuserskskiddelete) | **DELETE** /api/v1/auth/user-sk/{sk_id} | Delete a secret key|
|[**deleteSkApiV1AuthUserSkSkIdDelete_0**](#deleteskapiv1authuserskskiddelete_0) | **DELETE** /api/v1/auth/user-sk/{sk_id} | Delete a secret key|
|[**listSksApiV1AuthUserSkListGet**](#listsksapiv1authusersklistget) | **GET** /api/v1/auth/user-sk/list | List user secret keys|
|[**listSksApiV1AuthUserSkListGet_0**](#listsksapiv1authusersklistget_0) | **GET** /api/v1/auth/user-sk/list | List user secret keys|
|[**updateSkApiV1AuthUserSkSkIdPut**](#updateskapiv1authuserskskidput) | **PUT** /api/v1/auth/user-sk/{sk_id} | Update a secret key|
|[**updateSkApiV1AuthUserSkSkIdPut_0**](#updateskapiv1authuserskskidput_0) | **PUT** /api/v1/auth/user-sk/{sk_id} | Update a secret key|

# **createSkApiV1AuthUserSkCreatePost**
> any createSkApiV1AuthUserSkCreatePost(body)

Generate a new secret key for the authenticated user.

### Example

```typescript
import {
    UserSKApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new UserSKApi(configuration);

let body: object; //

const { status, data } = await apiInstance.createSkApiV1AuthUserSkCreatePost(
    body
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **body** | **object**|  | |


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **createSkApiV1AuthUserSkCreatePost_0**
> any createSkApiV1AuthUserSkCreatePost_0(body)

Generate a new secret key for the authenticated user.

### Example

```typescript
import {
    UserSKApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new UserSKApi(configuration);

let body: object; //

const { status, data } = await apiInstance.createSkApiV1AuthUserSkCreatePost_0(
    body
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **body** | **object**|  | |


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **deleteSkApiV1AuthUserSkSkIdDelete**
> any deleteSkApiV1AuthUserSkSkIdDelete()

Delete a secret key owned by the authenticated user.

### Example

```typescript
import {
    UserSKApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new UserSKApi(configuration);

let skId: number; // (default to undefined)

const { status, data } = await apiInstance.deleteSkApiV1AuthUserSkSkIdDelete(
    skId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **skId** | [**number**] |  | defaults to undefined|


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

# **deleteSkApiV1AuthUserSkSkIdDelete_0**
> any deleteSkApiV1AuthUserSkSkIdDelete_0()

Delete a secret key owned by the authenticated user.

### Example

```typescript
import {
    UserSKApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new UserSKApi(configuration);

let skId: number; // (default to undefined)

const { status, data } = await apiInstance.deleteSkApiV1AuthUserSkSkIdDelete_0(
    skId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **skId** | [**number**] |  | defaults to undefined|


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

# **listSksApiV1AuthUserSkListGet**
> any listSksApiV1AuthUserSkListGet()

List all secret keys for the authenticated user with pagination.

### Example

```typescript
import {
    UserSKApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new UserSKApi(configuration);

let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)

const { status, data } = await apiInstance.listSksApiV1AuthUserSkListGet(
    page,
    limit
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 20|


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

# **listSksApiV1AuthUserSkListGet_0**
> any listSksApiV1AuthUserSkListGet_0()

List all secret keys for the authenticated user with pagination.

### Example

```typescript
import {
    UserSKApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new UserSKApi(configuration);

let page: number; // (optional) (default to 1)
let limit: number; // (optional) (default to 20)

const { status, data } = await apiInstance.listSksApiV1AuthUserSkListGet_0(
    page,
    limit
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] |  | (optional) defaults to 1|
| **limit** | [**number**] |  | (optional) defaults to 20|


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

# **updateSkApiV1AuthUserSkSkIdPut**
> any updateSkApiV1AuthUserSkSkIdPut(sKUpdateBody)

Update secret key name or status.

### Example

```typescript
import {
    UserSKApi,
    Configuration,
    SKUpdateBody
} from './api';

const configuration = new Configuration();
const apiInstance = new UserSKApi(configuration);

let skId: number; // (default to undefined)
let sKUpdateBody: SKUpdateBody; //

const { status, data } = await apiInstance.updateSkApiV1AuthUserSkSkIdPut(
    skId,
    sKUpdateBody
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **sKUpdateBody** | **SKUpdateBody**|  | |
| **skId** | [**number**] |  | defaults to undefined|


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **updateSkApiV1AuthUserSkSkIdPut_0**
> any updateSkApiV1AuthUserSkSkIdPut_0(sKUpdateBody)

Update secret key name or status.

### Example

```typescript
import {
    UserSKApi,
    Configuration,
    SKUpdateBody
} from './api';

const configuration = new Configuration();
const apiInstance = new UserSKApi(configuration);

let skId: number; // (default to undefined)
let sKUpdateBody: SKUpdateBody; //

const { status, data } = await apiInstance.updateSkApiV1AuthUserSkSkIdPut_0(
    skId,
    sKUpdateBody
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **sKUpdateBody** | **SKUpdateBody**|  | |
| **skId** | [**number**] |  | defaults to undefined|


### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

