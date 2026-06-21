# AgentCacheApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**cacheClearApiV1AgentsClearPost**](#cacheclearapiv1agentsclearpost) | **POST** /api/v1/agents/clear | Clear category cache|
|[**cacheInfoApiV1AgentsInfoGet**](#cacheinfoapiv1agentsinfoget) | **GET** /api/v1/agents/info | Get category cache info|
|[**cacheReloadApiV1AgentsReloadPost**](#cachereloadapiv1agentsreloadpost) | **POST** /api/v1/agents/reload | Reload category cache from DB|
|[**cacheSearchApiV1AgentsSearchGet**](#cachesearchapiv1agentssearchget) | **GET** /api/v1/agents/search | Search categories in cache|

# **cacheClearApiV1AgentsClearPost**
> any cacheClearApiV1AgentsClearPost()

Clear the in-memory category cache.

### Example

```typescript
import {
    AgentCacheApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AgentCacheApi(configuration);

const { status, data } = await apiInstance.cacheClearApiV1AgentsClearPost();
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

# **cacheInfoApiV1AgentsInfoGet**
> any cacheInfoApiV1AgentsInfoGet()

Return cache metadata: size, last reload time, version.

### Example

```typescript
import {
    AgentCacheApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AgentCacheApi(configuration);

const { status, data } = await apiInstance.cacheInfoApiV1AgentsInfoGet();
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

# **cacheReloadApiV1AgentsReloadPost**
> any cacheReloadApiV1AgentsReloadPost()

Force-reload agent categories from database into memory cache.

### Example

```typescript
import {
    AgentCacheApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AgentCacheApi(configuration);

const { status, data } = await apiInstance.cacheReloadApiV1AgentsReloadPost();
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

# **cacheSearchApiV1AgentsSearchGet**
> any cacheSearchApiV1AgentsSearchGet()

Search cached agent categories with optional filters.

### Example

```typescript
import {
    AgentCacheApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AgentCacheApi(configuration);

let keyword: string; //Search keyword for agent_id (optional) (default to undefined)
let group: number; //Filter by group (optional) (default to undefined)
let type: string; //Filter by type (optional) (default to undefined)

const { status, data } = await apiInstance.cacheSearchApiV1AgentsSearchGet(
    keyword,
    group,
    type
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **keyword** | [**string**] | Search keyword for agent_id | (optional) defaults to undefined|
| **group** | [**number**] | Filter by group | (optional) defaults to undefined|
| **type** | [**string**] | Filter by type | (optional) defaults to undefined|


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

