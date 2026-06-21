# \RemoteThirdAPI

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**ThirdGroupListApiV1RemoteThirdGroupListGet**](RemoteThirdAPI.md#ThirdGroupListApiV1RemoteThirdGroupListGet) | **Get** /api/v1/remote/third/group/list | Third Group List
[**ThirdGroupListApiV1RemoteThirdGroupListGet_0**](RemoteThirdAPI.md#ThirdGroupListApiV1RemoteThirdGroupListGet_0) | **Get** /api/v1/remote/third/group/list | Third Group List



## ThirdGroupListApiV1RemoteThirdGroupListGet

> interface{} ThirdGroupListApiV1RemoteThirdGroupListGet(ctx).Execute()

Third Group List



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
	resp, r, err := apiClient.RemoteThirdAPI.ThirdGroupListApiV1RemoteThirdGroupListGet(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `RemoteThirdAPI.ThirdGroupListApiV1RemoteThirdGroupListGet``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ThirdGroupListApiV1RemoteThirdGroupListGet`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `RemoteThirdAPI.ThirdGroupListApiV1RemoteThirdGroupListGet`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiThirdGroupListApiV1RemoteThirdGroupListGetRequest struct via the builder pattern


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


## ThirdGroupListApiV1RemoteThirdGroupListGet_0

> interface{} ThirdGroupListApiV1RemoteThirdGroupListGet_0(ctx).Execute()

Third Group List



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
	resp, r, err := apiClient.RemoteThirdAPI.ThirdGroupListApiV1RemoteThirdGroupListGet_0(context.Background()).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `RemoteThirdAPI.ThirdGroupListApiV1RemoteThirdGroupListGet_0``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ThirdGroupListApiV1RemoteThirdGroupListGet_0`: interface{}
	fmt.Fprintf(os.Stdout, "Response from `RemoteThirdAPI.ThirdGroupListApiV1RemoteThirdGroupListGet_0`: %v\n", resp)
}
```

### Path Parameters

This endpoint does not need any parameter.

### Other Parameters

Other parameters are passed through a pointer to a apiThirdGroupListApiV1RemoteThirdGroupListGet_1Request struct via the builder pattern


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

