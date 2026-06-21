# \AgentCacheAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**CacheClearApiV1AgentsClearPost**](AgentCacheAPI.md#CacheClearApiV1AgentsClearPost) | **Post** /api/v1/agents/clear | Clear category cache
[**CacheInfoApiV1AgentsInfoGet**](AgentCacheAPI.md#CacheInfoApiV1AgentsInfoGet) | **Get** /api/v1/agents/info | Get category cache info
[**CacheReloadApiV1AgentsReloadPost**](AgentCacheAPI.md#CacheReloadApiV1AgentsReloadPost) | **Post** /api/v1/agents/reload | Reload category cache from DB
[**CacheSearchApiV1AgentsSearchGet**](AgentCacheAPI.md#CacheSearchApiV1AgentsSearchGet) | **Get** /api/v1/agents/search | Search categories in cache



## CacheClearApiV1AgentsClearPost

> interface{} CacheClearApiV1AgentsClearPost(ctx).Execute()

Clear category cache



### Example

```go
package main

import (
	"context"
	"fmt"
	"os"
	openapiclient "github.com/GIT_USER_ID/GIT_REPO_ID"
)

func main() {

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AgentCacheAPI.CacheClearApiV1AgentsClearPost(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AgentCacheAPI.CacheClearApiV1AgentsClearPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CacheClearApiV1AgentsClearPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AgentCacheAPI.CacheClearApiV1AgentsClearPost`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiCacheClearApiV1AgentsClearPostRequest struct via the builder pattern


### Return type

**interface{}**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## CacheInfoApiV1AgentsInfoGet

> interface{} CacheInfoApiV1AgentsInfoGet(ctx).Execute()

Get category cache info



### Example

```go
package main

import (
	"context"
	"fmt"
	"os"
	openapiclient "github.com/GIT_USER_ID/GIT_REPO_ID"
)

func main() {

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AgentCacheAPI.CacheInfoApiV1AgentsInfoGet(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AgentCacheAPI.CacheInfoApiV1AgentsInfoGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CacheInfoApiV1AgentsInfoGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AgentCacheAPI.CacheInfoApiV1AgentsInfoGet`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiCacheInfoApiV1AgentsInfoGetRequest struct via the builder pattern


### Return type

**interface{}**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## CacheReloadApiV1AgentsReloadPost

> interface{} CacheReloadApiV1AgentsReloadPost(ctx).Execute()

Reload category cache from DB



### Example

```go
package main

import (
	"context"
	"fmt"
	"os"
	openapiclient "github.com/GIT_USER_ID/GIT_REPO_ID"
)

func main() {

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AgentCacheAPI.CacheReloadApiV1AgentsReloadPost(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AgentCacheAPI.CacheReloadApiV1AgentsReloadPost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CacheReloadApiV1AgentsReloadPost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AgentCacheAPI.CacheReloadApiV1AgentsReloadPost`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiCacheReloadApiV1AgentsReloadPostRequest struct via the builder pattern


### Return type

**interface{}**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## CacheSearchApiV1AgentsSearchGet

> interface{} CacheSearchApiV1AgentsSearchGet(ctx).Keyword(keyword).Group(group).Type_(type_).Execute()

Search categories in cache



### Example

```go
package main

import (
	"context"
	"fmt"
	"os"
	openapiclient "github.com/GIT_USER_ID/GIT_REPO_ID"
)

func main() {
	keyword := "keyword_example" // string | Search keyword for agent_id (optional)
	group := int32(56) // int32 | Filter by group (optional)
	type_ := "type__example" // string | Filter by type (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.AgentCacheAPI.CacheSearchApiV1AgentsSearchGet(context.Background()).Keyword(keyword).Group(group).Type_(type_).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `AgentCacheAPI.CacheSearchApiV1AgentsSearchGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CacheSearchApiV1AgentsSearchGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `AgentCacheAPI.CacheSearchApiV1AgentsSearchGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCacheSearchApiV1AgentsSearchGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **keyword** | **string** | Search keyword for agent_id | 
 **group** | **int32** | Filter by group | 
 **type_** | **string** | Filter by type | 

### Return type

**interface{}**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)

