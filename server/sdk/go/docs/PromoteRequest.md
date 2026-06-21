# PromoteRequest

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**Actor** | Pointer to **string** | 操作者 | [optional] [default to "api"]
**Reason** | Pointer to **string** | 原因 | [optional] [default to ""]

## Methods

### NewPromoteRequest

`func NewPromoteRequest() *PromoteRequest`

NewPromoteRequest instantiates a new PromoteRequest object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewPromoteRequestWithDefaults

`func NewPromoteRequestWithDefaults() *PromoteRequest`

NewPromoteRequestWithDefaults instantiates a new PromoteRequest object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetActor

`func (o *PromoteRequest) GetActor() string`

GetActor returns the Actor field if non-nil, zero value otherwise.

### GetActorOk

`func (o *PromoteRequest) GetActorOk() (*string, bool)`

GetActorOk returns a tuple with the Actor field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetActor

`func (o *PromoteRequest) SetActor(v string)`

SetActor sets Actor field to given value.

### HasActor

`func (o *PromoteRequest) HasActor() bool`

HasActor returns a boolean if a field has been set.

### GetReason

`func (o *PromoteRequest) GetReason() string`

GetReason returns the Reason field if non-nil, zero value otherwise.

### GetReasonOk

`func (o *PromoteRequest) GetReasonOk() (*string, bool)`

GetReasonOk returns a tuple with the Reason field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetReason

`func (o *PromoteRequest) SetReason(v string)`

SetReason sets Reason field to given value.

### HasReason

`func (o *PromoteRequest) HasReason() bool`

HasReason returns a boolean if a field has been set.


[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


