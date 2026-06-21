# CanaryResponse

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**Ok** | Pointer to **bool** |  | [optional] [default to true]
**Data** | Pointer to **map[string]interface{}** |  | [optional] [default to {}]

## Methods

### NewCanaryResponse

`func NewCanaryResponse() *CanaryResponse`

NewCanaryResponse instantiates a new CanaryResponse object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewCanaryResponseWithDefaults

`func NewCanaryResponseWithDefaults() *CanaryResponse`

NewCanaryResponseWithDefaults instantiates a new CanaryResponse object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetOk

`func (o *CanaryResponse) GetOk() bool`

GetOk returns the Ok field if non-nil, zero value otherwise.

### GetOkOk

`func (o *CanaryResponse) GetOkOk() (*bool, bool)`

GetOkOk returns a tuple with the Ok field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetOk

`func (o *CanaryResponse) SetOk(v bool)`

SetOk sets Ok field to given value.

### HasOk

`func (o *CanaryResponse) HasOk() bool`

HasOk returns a boolean if a field has been set.

### GetData

`func (o *CanaryResponse) GetData() map[string]interface{}`

GetData returns the Data field if non-nil, zero value otherwise.

### GetDataOk

`func (o *CanaryResponse) GetDataOk() (*map[string]interface{}, bool)`

GetDataOk returns a tuple with the Data field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetData

`func (o *CanaryResponse) SetData(v map[string]interface{})`

SetData sets Data field to given value.

### HasData

`func (o *CanaryResponse) HasData() bool`

HasData returns a boolean if a field has been set.


[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


