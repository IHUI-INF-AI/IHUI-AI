# \CozeAppsAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**ListApiAppsApiV1CozeAppsAppsListApiAppsGet**](CozeAppsAPI.md#ListApiAppsApiV1CozeAppsAppsListApiAppsGet) | **Get** /api/v1/coze/apps/apps/list_api_apps | List Api Apps
[**ListApiAppsApiV1CozeAppsAppsListApiAppsGet_0**](CozeAppsAPI.md#ListApiAppsApiV1CozeAppsAppsListApiAppsGet_0) | **Get** /api/v1/coze/apps/apps/list_api_apps | List Api Apps
[**ListAppEventsApiV1CozeAppsAppsEventsGet**](CozeAppsAPI.md#ListAppEventsApiV1CozeAppsAppsEventsGet) | **Get** /api/v1/coze/apps/apps/events | List App Events
[**ListAppEventsApiV1CozeAppsAppsEventsGet_0**](CozeAppsAPI.md#ListAppEventsApiV1CozeAppsAppsEventsGet_0) | **Get** /api/v1/coze/apps/apps/events | List App Events
[**ListAppsApiV1CozeAppsAppsListGet**](CozeAppsAPI.md#ListAppsApiV1CozeAppsAppsListGet) | **Get** /api/v1/coze/apps/apps/list | List Apps
[**ListAppsApiV1CozeAppsAppsListGet_0**](CozeAppsAPI.md#ListAppsApiV1CozeAppsAppsListGet_0) | **Get** /api/v1/coze/apps/apps/list | List Apps



## ListApiAppsApiV1CozeAppsAppsListApiAppsGet

> interface{} ListApiAppsApiV1CozeAppsAppsListApiAppsGet(ctx).Page(page).Size(size).Execute()

List Api Apps

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
	page := int32(56) // int32 |  (optional) (default to 1)
	size := int32(56) // int32 |  (optional) (default to 20)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CozeAppsAPI.ListApiAppsApiV1CozeAppsAppsListApiAppsGet(context.Background()).Page(page).Size(size).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CozeAppsAPI.ListApiAppsApiV1CozeAppsAppsListApiAppsGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListApiAppsApiV1CozeAppsAppsListApiAppsGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CozeAppsAPI.ListApiAppsApiV1CozeAppsAppsListApiAppsGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListApiAppsApiV1CozeAppsAppsListApiAppsGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int32** |  | [default to 1]
 **size** | **int32** |  | [default to 20]

### Return type

**interface{}**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## ListApiAppsApiV1CozeAppsAppsListApiAppsGet_0

> interface{} ListApiAppsApiV1CozeAppsAppsListApiAppsGet_0(ctx).Page(page).Size(size).Execute()

List Api Apps

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
	page := int32(56) // int32 |  (optional) (default to 1)
	size := int32(56) // int32 |  (optional) (default to 20)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CozeAppsAPI.ListApiAppsApiV1CozeAppsAppsListApiAppsGet_0(context.Background()).Page(page).Size(size).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CozeAppsAPI.ListApiAppsApiV1CozeAppsAppsListApiAppsGet_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListApiAppsApiV1CozeAppsAppsListApiAppsGet_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CozeAppsAPI.ListApiAppsApiV1CozeAppsAppsListApiAppsGet_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListApiAppsApiV1CozeAppsAppsListApiAppsGet_1Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int32** |  | [default to 1]
 **size** | **int32** |  | [default to 20]

### Return type

**interface{}**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## ListAppEventsApiV1CozeAppsAppsEventsGet

> interface{} ListAppEventsApiV1CozeAppsAppsEventsGet(ctx).AppId(appId).Page(page).Size(size).Execute()

List App Events

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
	appId := "appId_example" // string | 
	page := int32(56) // int32 |  (optional) (default to 1)
	size := int32(56) // int32 |  (optional) (default to 20)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CozeAppsAPI.ListAppEventsApiV1CozeAppsAppsEventsGet(context.Background()).AppId(appId).Page(page).Size(size).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CozeAppsAPI.ListAppEventsApiV1CozeAppsAppsEventsGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListAppEventsApiV1CozeAppsAppsEventsGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CozeAppsAPI.ListAppEventsApiV1CozeAppsAppsEventsGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListAppEventsApiV1CozeAppsAppsEventsGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **appId** | **string** |  | 
 **page** | **int32** |  | [default to 1]
 **size** | **int32** |  | [default to 20]

### Return type

**interface{}**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## ListAppEventsApiV1CozeAppsAppsEventsGet_0

> interface{} ListAppEventsApiV1CozeAppsAppsEventsGet_0(ctx).AppId(appId).Page(page).Size(size).Execute()

List App Events

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
	appId := "appId_example" // string | 
	page := int32(56) // int32 |  (optional) (default to 1)
	size := int32(56) // int32 |  (optional) (default to 20)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CozeAppsAPI.ListAppEventsApiV1CozeAppsAppsEventsGet_0(context.Background()).AppId(appId).Page(page).Size(size).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CozeAppsAPI.ListAppEventsApiV1CozeAppsAppsEventsGet_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListAppEventsApiV1CozeAppsAppsEventsGet_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CozeAppsAPI.ListAppEventsApiV1CozeAppsAppsEventsGet_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListAppEventsApiV1CozeAppsAppsEventsGet_2Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **appId** | **string** |  | 
 **page** | **int32** |  | [default to 1]
 **size** | **int32** |  | [default to 20]

### Return type

**interface{}**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## ListAppsApiV1CozeAppsAppsListGet

> interface{} ListAppsApiV1CozeAppsAppsListGet(ctx).Page(page).Size(size).Execute()

List Apps

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
	page := int32(56) // int32 |  (optional) (default to 1)
	size := int32(56) // int32 |  (optional) (default to 20)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CozeAppsAPI.ListAppsApiV1CozeAppsAppsListGet(context.Background()).Page(page).Size(size).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CozeAppsAPI.ListAppsApiV1CozeAppsAppsListGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListAppsApiV1CozeAppsAppsListGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CozeAppsAPI.ListAppsApiV1CozeAppsAppsListGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListAppsApiV1CozeAppsAppsListGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int32** |  | [default to 1]
 **size** | **int32** |  | [default to 20]

### Return type

**interface{}**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## ListAppsApiV1CozeAppsAppsListGet_0

> interface{} ListAppsApiV1CozeAppsAppsListGet_0(ctx).Page(page).Size(size).Execute()

List Apps

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
	page := int32(56) // int32 |  (optional) (default to 1)
	size := int32(56) // int32 |  (optional) (default to 20)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.CozeAppsAPI.ListAppsApiV1CozeAppsAppsListGet_0(context.Background()).Page(page).Size(size).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `CozeAppsAPI.ListAppsApiV1CozeAppsAppsListGet_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListAppsApiV1CozeAppsAppsListGet_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `CozeAppsAPI.ListAppsApiV1CozeAppsAppsListGet_0`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListAppsApiV1CozeAppsAppsListGet_3Request struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **int32** |  | [default to 1]
 **size** | **int32** |  | [default to 20]

### Return type

**interface{}**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)

