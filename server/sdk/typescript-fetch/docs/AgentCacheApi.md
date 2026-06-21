# AgentCacheApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**cacheClearApiV1AgentsClearPost**](AgentCacheApi.md#cacheclearapiv1agentsclearpost) | **POST** /api/v1/agents/clear | Clear category cache |
| [**cacheInfoApiV1AgentsInfoGet**](AgentCacheApi.md#cacheinfoapiv1agentsinfoget) | **GET** /api/v1/agents/info | Get category cache info |
| [**cacheReloadApiV1AgentsReloadPost**](AgentCacheApi.md#cachereloadapiv1agentsreloadpost) | **POST** /api/v1/agents/reload | Reload category cache from DB |
| [**cacheSearchApiV1AgentsSearchGet**](AgentCacheApi.md#cachesearchapiv1agentssearchget) | **GET** /api/v1/agents/search | Search categories in cache |



## cacheClearApiV1AgentsClearPost

> any cacheClearApiV1AgentsClearPost()

Clear category cache

Clear the in-memory category cache.

### Example

```ts
import {
  Configuration,
  AgentCacheApi,
} from '';
import type { CacheClearApiV1AgentsClearPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AgentCacheApi(config);

  try {
    const data = await api.cacheClearApiV1AgentsClearPost();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## cacheInfoApiV1AgentsInfoGet

> any cacheInfoApiV1AgentsInfoGet()

Get category cache info

Return cache metadata: size, last reload time, version.

### Example

```ts
import {
  Configuration,
  AgentCacheApi,
} from '';
import type { CacheInfoApiV1AgentsInfoGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AgentCacheApi(config);

  try {
    const data = await api.cacheInfoApiV1AgentsInfoGet();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## cacheReloadApiV1AgentsReloadPost

> any cacheReloadApiV1AgentsReloadPost()

Reload category cache from DB

Force-reload agent categories from database into memory cache.

### Example

```ts
import {
  Configuration,
  AgentCacheApi,
} from '';
import type { CacheReloadApiV1AgentsReloadPostRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AgentCacheApi(config);

  try {
    const data = await api.cacheReloadApiV1AgentsReloadPost();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## cacheSearchApiV1AgentsSearchGet

> any cacheSearchApiV1AgentsSearchGet(keyword, group, type)

Search categories in cache

Search cached agent categories with optional filters.

### Example

```ts
import {
  Configuration,
  AgentCacheApi,
} from '';
import type { CacheSearchApiV1AgentsSearchGetRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: HTTPBearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AgentCacheApi(config);

  const body = {
    // string | Search keyword for agent_id (optional)
    keyword: keyword_example,
    // number | Filter by group (optional)
    group: 56,
    // string | Filter by type (optional)
    type: type_example,
  } satisfies CacheSearchApiV1AgentsSearchGetRequest;

  try {
    const data = await api.cacheSearchApiV1AgentsSearchGet(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **keyword** | `string` | Search keyword for agent_id | [Optional] [Defaults to `undefined`] |
| **group** | `number` | Filter by group | [Optional] [Defaults to `undefined`] |
| **type** | `string` | Filter by type | [Optional] [Defaults to `undefined`] |

### Return type

**any**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Successful Response |  -  |
| **422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

