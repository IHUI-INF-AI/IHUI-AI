# \WSTimbreAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**CreateTimbreApiV1WsTimbreCreatePost**](WSTimbreAPI.md#CreateTimbreApiV1WsTimbreCreatePost) | **Post** /api/v1/ws/timbre/create | 新增音色
[**CreateTimbreTimbreCreatePost**](WSTimbreAPI.md#CreateTimbreTimbreCreatePost) | **Post** /timbre/create | 新增音色
[**DeleteTimbreApiV1WsTimbreDeletePost**](WSTimbreAPI.md#DeleteTimbreApiV1WsTimbreDeletePost) | **Post** /api/v1/ws/timbre/delete | 删除音色
[**DeleteTimbreTimbreDeletePost**](WSTimbreAPI.md#DeleteTimbreTimbreDeletePost) | **Post** /timbre/delete | 删除音色
[**ListTimbresApiV1WsTimbreListGet**](WSTimbreAPI.md#ListTimbresApiV1WsTimbreListGet) | **Get** /api/v1/ws/timbre/list | 音色列表
[**ListTimbresTimbreListGet**](WSTimbreAPI.md#ListTimbresTimbreListGet) | **Get** /timbre/list | 音色列表
[**UpdateTimbreApiV1WsTimbreUpdatePost**](WSTimbreAPI.md#UpdateTimbreApiV1WsTimbreUpdatePost) | **Post** /api/v1/ws/timbre/update | 更新音色
[**UpdateTimbreTimbreUpdatePost**](WSTimbreAPI.md#UpdateTimbreTimbreUpdatePost) | **Post** /timbre/update | 更新音色



## CreateTimbreApiV1WsTimbreCreatePost

> interface{} CreateTimbreApiV1WsTimbreCreatePost(ctx).Name(name).VoiceId(voiceId).Language(language).Gender(gender).AgeRange(ageRange).Style(style).SampleUrl(sampleUrl).Execute()

新增音色

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
	name := "name_example" // string | 
	voiceId := "voiceId_example" // string | 
	language := "language_example" // string |  (optional) (default to "zh")
	gender := "gender_example" // string |  (optional) (default to "female")
	ageRange := "ageRange_example" // string |  (optional) (default to "")
	style := "style_example" // string |  (optional) (default to "")
	sampleUrl := "sampleUrl_example" // string |  (optional) (default to "")

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.WSTimbreAPI.CreateTimbreApiV1WsTimbreCreatePost(context.Background()).Name(name).VoiceId(voiceId).Language(language).Gender(gender).AgeRange(ageRange).Style(style).SampleUrl(sampleUrl).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `WSTimbreAPI.CreateTimbreApiV1WsTimbreCreatePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CreateTimbreApiV1WsTimbreCreatePost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `WSTimbreAPI.CreateTimbreApiV1WsTimbreCreatePost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCreateTimbreApiV1WsTimbreCreatePostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **name** | **string** |  | 
 **voiceId** | **string** |  | 
 **language** | **string** |  | [default to &quot;zh&quot;]
 **gender** | **string** |  | [default to &quot;female&quot;]
 **ageRange** | **string** |  | [default to &quot;&quot;]
 **style** | **string** |  | [default to &quot;&quot;]
 **sampleUrl** | **string** |  | [default to &quot;&quot;]

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


## CreateTimbreTimbreCreatePost

> interface{} CreateTimbreTimbreCreatePost(ctx).Name(name).VoiceId(voiceId).Language(language).Gender(gender).AgeRange(ageRange).Style(style).SampleUrl(sampleUrl).Execute()

新增音色

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
	name := "name_example" // string | 
	voiceId := "voiceId_example" // string | 
	language := "language_example" // string |  (optional) (default to "zh")
	gender := "gender_example" // string |  (optional) (default to "female")
	ageRange := "ageRange_example" // string |  (optional) (default to "")
	style := "style_example" // string |  (optional) (default to "")
	sampleUrl := "sampleUrl_example" // string |  (optional) (default to "")

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.WSTimbreAPI.CreateTimbreTimbreCreatePost(context.Background()).Name(name).VoiceId(voiceId).Language(language).Gender(gender).AgeRange(ageRange).Style(style).SampleUrl(sampleUrl).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `WSTimbreAPI.CreateTimbreTimbreCreatePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `CreateTimbreTimbreCreatePost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `WSTimbreAPI.CreateTimbreTimbreCreatePost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiCreateTimbreTimbreCreatePostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **name** | **string** |  | 
 **voiceId** | **string** |  | 
 **language** | **string** |  | [default to &quot;zh&quot;]
 **gender** | **string** |  | [default to &quot;female&quot;]
 **ageRange** | **string** |  | [default to &quot;&quot;]
 **style** | **string** |  | [default to &quot;&quot;]
 **sampleUrl** | **string** |  | [default to &quot;&quot;]

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


## DeleteTimbreApiV1WsTimbreDeletePost

> interface{} DeleteTimbreApiV1WsTimbreDeletePost(ctx).TimbreId(timbreId).Execute()

删除音色

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
	timbreId := "timbreId_example" // string | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.WSTimbreAPI.DeleteTimbreApiV1WsTimbreDeletePost(context.Background()).TimbreId(timbreId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `WSTimbreAPI.DeleteTimbreApiV1WsTimbreDeletePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `DeleteTimbreApiV1WsTimbreDeletePost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `WSTimbreAPI.DeleteTimbreApiV1WsTimbreDeletePost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiDeleteTimbreApiV1WsTimbreDeletePostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **timbreId** | **string** |  | 

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


## DeleteTimbreTimbreDeletePost

> interface{} DeleteTimbreTimbreDeletePost(ctx).TimbreId(timbreId).Execute()

删除音色

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
	timbreId := "timbreId_example" // string | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.WSTimbreAPI.DeleteTimbreTimbreDeletePost(context.Background()).TimbreId(timbreId).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `WSTimbreAPI.DeleteTimbreTimbreDeletePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `DeleteTimbreTimbreDeletePost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `WSTimbreAPI.DeleteTimbreTimbreDeletePost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiDeleteTimbreTimbreDeletePostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **timbreId** | **string** |  | 

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


## ListTimbresApiV1WsTimbreListGet

> interface{} ListTimbresApiV1WsTimbreListGet(ctx).Language(language).Gender(gender).Page(page).Limit(limit).Execute()

音色列表

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
	language := "language_example" // string |  (optional)
	gender := "gender_example" // string |  (optional)
	page := int32(56) // int32 |  (optional) (default to 1)
	limit := int32(56) // int32 |  (optional) (default to 20)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.WSTimbreAPI.ListTimbresApiV1WsTimbreListGet(context.Background()).Language(language).Gender(gender).Page(page).Limit(limit).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `WSTimbreAPI.ListTimbresApiV1WsTimbreListGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListTimbresApiV1WsTimbreListGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `WSTimbreAPI.ListTimbresApiV1WsTimbreListGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListTimbresApiV1WsTimbreListGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **language** | **string** |  | 
 **gender** | **string** |  | 
 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 20]

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


## ListTimbresTimbreListGet

> interface{} ListTimbresTimbreListGet(ctx).Language(language).Gender(gender).Page(page).Limit(limit).Execute()

音色列表

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
	language := "language_example" // string |  (optional)
	gender := "gender_example" // string |  (optional)
	page := int32(56) // int32 |  (optional) (default to 1)
	limit := int32(56) // int32 |  (optional) (default to 20)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.WSTimbreAPI.ListTimbresTimbreListGet(context.Background()).Language(language).Gender(gender).Page(page).Limit(limit).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `WSTimbreAPI.ListTimbresTimbreListGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ListTimbresTimbreListGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `WSTimbreAPI.ListTimbresTimbreListGet`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiListTimbresTimbreListGetRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **language** | **string** |  | 
 **gender** | **string** |  | 
 **page** | **int32** |  | [default to 1]
 **limit** | **int32** |  | [default to 20]

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


## UpdateTimbreApiV1WsTimbreUpdatePost

> interface{} UpdateTimbreApiV1WsTimbreUpdatePost(ctx).TimbreId(timbreId).Name(name).SampleUrl(sampleUrl).Status(status).Execute()

更新音色

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
	timbreId := "timbreId_example" // string | 
	name := "name_example" // string |  (optional)
	sampleUrl := "sampleUrl_example" // string |  (optional)
	status := int32(56) // int32 |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.WSTimbreAPI.UpdateTimbreApiV1WsTimbreUpdatePost(context.Background()).TimbreId(timbreId).Name(name).SampleUrl(sampleUrl).Status(status).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `WSTimbreAPI.UpdateTimbreApiV1WsTimbreUpdatePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `UpdateTimbreApiV1WsTimbreUpdatePost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `WSTimbreAPI.UpdateTimbreApiV1WsTimbreUpdatePost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiUpdateTimbreApiV1WsTimbreUpdatePostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **timbreId** | **string** |  | 
 **name** | **string** |  | 
 **sampleUrl** | **string** |  | 
 **status** | **int32** |  | 

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


## UpdateTimbreTimbreUpdatePost

> interface{} UpdateTimbreTimbreUpdatePost(ctx).TimbreId(timbreId).Name(name).SampleUrl(sampleUrl).Status(status).Execute()

更新音色

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
	timbreId := "timbreId_example" // string | 
	name := "name_example" // string |  (optional)
	sampleUrl := "sampleUrl_example" // string |  (optional)
	status := int32(56) // int32 |  (optional)

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.WSTimbreAPI.UpdateTimbreTimbreUpdatePost(context.Background()).TimbreId(timbreId).Name(name).SampleUrl(sampleUrl).Status(status).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `WSTimbreAPI.UpdateTimbreTimbreUpdatePost``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `UpdateTimbreTimbreUpdatePost`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `WSTimbreAPI.UpdateTimbreTimbreUpdatePost`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiUpdateTimbreTimbreUpdatePostRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **timbreId** | **string** |  | 
 **name** | **string** |  | 
 **sampleUrl** | **string** |  | 
 **status** | **int32** |  | 

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

