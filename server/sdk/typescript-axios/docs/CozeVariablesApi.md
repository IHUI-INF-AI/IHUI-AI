# CozeVariablesApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**createVariableApiV1CozeVariablesVariablesCreatePost**](#createvariableapiv1cozevariablesvariablescreatepost) | **POST** /api/v1/coze/variables/variables/create | Create Variable|
|[**createVariableApiV1CozeVariablesVariablesCreatePost_0**](#createvariableapiv1cozevariablesvariablescreatepost_0) | **POST** /api/v1/coze/variables/variables/create | Create Variable|
|[**deleteVariableApiV1CozeVariablesVariablesDeletePost**](#deletevariableapiv1cozevariablesvariablesdeletepost) | **POST** /api/v1/coze/variables/variables/delete | Delete Variable|
|[**deleteVariableApiV1CozeVariablesVariablesDeletePost_0**](#deletevariableapiv1cozevariablesvariablesdeletepost_0) | **POST** /api/v1/coze/variables/variables/delete | Delete Variable|
|[**listVariablesApiV1CozeVariablesVariablesListGet**](#listvariablesapiv1cozevariablesvariableslistget) | **GET** /api/v1/coze/variables/variables/list | List Variables|
|[**listVariablesApiV1CozeVariablesVariablesListGet_0**](#listvariablesapiv1cozevariablesvariableslistget_0) | **GET** /api/v1/coze/variables/variables/list | List Variables|
|[**retrieveVariableApiV1CozeVariablesVariablesRetrieveGet**](#retrievevariableapiv1cozevariablesvariablesretrieveget) | **GET** /api/v1/coze/variables/variables/retrieve | Retrieve Variable|
|[**retrieveVariableApiV1CozeVariablesVariablesRetrieveGet_0**](#retrievevariableapiv1cozevariablesvariablesretrieveget_0) | **GET** /api/v1/coze/variables/variables/retrieve | Retrieve Variable|
|[**updateVariableApiV1CozeVariablesVariablesUpdatePost**](#updatevariableapiv1cozevariablesvariablesupdatepost) | **POST** /api/v1/coze/variables/variables/update | Update Variable|
|[**updateVariableApiV1CozeVariablesVariablesUpdatePost_0**](#updatevariableapiv1cozevariablesvariablesupdatepost_0) | **POST** /api/v1/coze/variables/variables/update | Update Variable|

# **createVariableApiV1CozeVariablesVariablesCreatePost**
> any createVariableApiV1CozeVariablesVariablesCreatePost(createVarReq)


### Example

```typescript
import {
    CozeVariablesApi,
    Configuration,
    CreateVarReq
} from './api';

const configuration = new Configuration();
const apiInstance = new CozeVariablesApi(configuration);

let createVarReq: CreateVarReq; //

const { status, data } = await apiInstance.createVariableApiV1CozeVariablesVariablesCreatePost(
    createVarReq
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **createVarReq** | **CreateVarReq**|  | |


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

# **createVariableApiV1CozeVariablesVariablesCreatePost_0**
> any createVariableApiV1CozeVariablesVariablesCreatePost_0(createVarReq)


### Example

```typescript
import {
    CozeVariablesApi,
    Configuration,
    CreateVarReq
} from './api';

const configuration = new Configuration();
const apiInstance = new CozeVariablesApi(configuration);

let createVarReq: CreateVarReq; //

const { status, data } = await apiInstance.createVariableApiV1CozeVariablesVariablesCreatePost_0(
    createVarReq
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **createVarReq** | **CreateVarReq**|  | |


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

# **deleteVariableApiV1CozeVariablesVariablesDeletePost**
> any deleteVariableApiV1CozeVariablesVariablesDeletePost(deleteVarReq)


### Example

```typescript
import {
    CozeVariablesApi,
    Configuration,
    DeleteVarReq
} from './api';

const configuration = new Configuration();
const apiInstance = new CozeVariablesApi(configuration);

let deleteVarReq: DeleteVarReq; //

const { status, data } = await apiInstance.deleteVariableApiV1CozeVariablesVariablesDeletePost(
    deleteVarReq
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **deleteVarReq** | **DeleteVarReq**|  | |


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

# **deleteVariableApiV1CozeVariablesVariablesDeletePost_0**
> any deleteVariableApiV1CozeVariablesVariablesDeletePost_0(deleteVarReq)


### Example

```typescript
import {
    CozeVariablesApi,
    Configuration,
    DeleteVarReq
} from './api';

const configuration = new Configuration();
const apiInstance = new CozeVariablesApi(configuration);

let deleteVarReq: DeleteVarReq; //

const { status, data } = await apiInstance.deleteVariableApiV1CozeVariablesVariablesDeletePost_0(
    deleteVarReq
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **deleteVarReq** | **DeleteVarReq**|  | |


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

# **listVariablesApiV1CozeVariablesVariablesListGet**
> any listVariablesApiV1CozeVariablesVariablesListGet()


### Example

```typescript
import {
    CozeVariablesApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new CozeVariablesApi(configuration);

let connectorId: string; // (default to undefined)
let page: number; // (optional) (default to 1)
let size: number; // (optional) (default to 20)

const { status, data } = await apiInstance.listVariablesApiV1CozeVariablesVariablesListGet(
    connectorId,
    page,
    size
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **connectorId** | [**string**] |  | defaults to undefined|
| **page** | [**number**] |  | (optional) defaults to 1|
| **size** | [**number**] |  | (optional) defaults to 20|


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **listVariablesApiV1CozeVariablesVariablesListGet_0**
> any listVariablesApiV1CozeVariablesVariablesListGet_0()


### Example

```typescript
import {
    CozeVariablesApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new CozeVariablesApi(configuration);

let connectorId: string; // (default to undefined)
let page: number; // (optional) (default to 1)
let size: number; // (optional) (default to 20)

const { status, data } = await apiInstance.listVariablesApiV1CozeVariablesVariablesListGet_0(
    connectorId,
    page,
    size
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **connectorId** | [**string**] |  | defaults to undefined|
| **page** | [**number**] |  | (optional) defaults to 1|
| **size** | [**number**] |  | (optional) defaults to 20|


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **retrieveVariableApiV1CozeVariablesVariablesRetrieveGet**
> any retrieveVariableApiV1CozeVariablesVariablesRetrieveGet()


### Example

```typescript
import {
    CozeVariablesApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new CozeVariablesApi(configuration);

let connectorId: string; // (default to undefined)
let variableId: string; // (default to undefined)

const { status, data } = await apiInstance.retrieveVariableApiV1CozeVariablesVariablesRetrieveGet(
    connectorId,
    variableId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **connectorId** | [**string**] |  | defaults to undefined|
| **variableId** | [**string**] |  | defaults to undefined|


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **retrieveVariableApiV1CozeVariablesVariablesRetrieveGet_0**
> any retrieveVariableApiV1CozeVariablesVariablesRetrieveGet_0()


### Example

```typescript
import {
    CozeVariablesApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new CozeVariablesApi(configuration);

let connectorId: string; // (default to undefined)
let variableId: string; // (default to undefined)

const { status, data } = await apiInstance.retrieveVariableApiV1CozeVariablesVariablesRetrieveGet_0(
    connectorId,
    variableId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **connectorId** | [**string**] |  | defaults to undefined|
| **variableId** | [**string**] |  | defaults to undefined|


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **updateVariableApiV1CozeVariablesVariablesUpdatePost**
> any updateVariableApiV1CozeVariablesVariablesUpdatePost(updateVarReq)


### Example

```typescript
import {
    CozeVariablesApi,
    Configuration,
    UpdateVarReq
} from './api';

const configuration = new Configuration();
const apiInstance = new CozeVariablesApi(configuration);

let updateVarReq: UpdateVarReq; //

const { status, data } = await apiInstance.updateVariableApiV1CozeVariablesVariablesUpdatePost(
    updateVarReq
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **updateVarReq** | **UpdateVarReq**|  | |


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

# **updateVariableApiV1CozeVariablesVariablesUpdatePost_0**
> any updateVariableApiV1CozeVariablesVariablesUpdatePost_0(updateVarReq)


### Example

```typescript
import {
    CozeVariablesApi,
    Configuration,
    UpdateVarReq
} from './api';

const configuration = new Configuration();
const apiInstance = new CozeVariablesApi(configuration);

let updateVarReq: UpdateVarReq; //

const { status, data } = await apiInstance.updateVariableApiV1CozeVariablesVariablesUpdatePost_0(
    updateVarReq
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **updateVarReq** | **UpdateVarReq**|  | |


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

