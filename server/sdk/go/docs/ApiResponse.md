# ApiResponse

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**Ok** | Pointer to **bool** |  | [optional] [default to true]
**Data** | Pointer to **map[string]interface{}** |  | [optional] [default to {}]

## Methods

### NewApiResponse

`func NewApiResponse() *ApiResponse`

NewApiResponse instantiates a new ApiResponse object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewApiResponseWithDefaults

`func NewApiResponseWithDefaults() *ApiResponse`

NewApiResponseWithDefaults instantiates a new ApiResponse object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetOk

`func (o *ApiResponse) GetOk() bool`

GetOk returns the Ok field if non-nil, zero value otherwise.

### GetOkOk

`func (o *ApiResponse) GetOkOk() (*bool, bool)`

GetOkOk returns a tuple with the Ok field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetOk

`func (o *ApiResponse) SetOk(v bool)`

SetOk sets Ok field to given value.

### HasOk

`func (o *ApiResponse) HasOk() bool`

HasOk returns a boolean if a field has been set.

### GetData

`func (o *ApiResponse) GetData() map[string]interface{}`

GetData returns the Data field if non-nil, zero value otherwise.

### GetDataOk

`func (o *ApiResponse) GetDataOk() (*map[string]interface{}, bool)`

GetDataOk returns a tuple with the Data field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetData

`func (o *ApiResponse) SetData(v map[string]interface{})`

SetData sets Data field to given value.

### HasData

`func (o *ApiResponse) HasData() bool`

HasData returns a boolean if a field has been set.


[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


