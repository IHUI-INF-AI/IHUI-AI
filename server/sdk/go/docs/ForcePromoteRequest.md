# ForcePromoteRequest

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**Actor** | Pointer to **string** | 操作者 | [optional] [default to "api"]
**Reason** | **string** | 强制推进原因 (审计必填) | 

## Methods

### NewForcePromoteRequest

`func NewForcePromoteRequest(reason string, ) *ForcePromoteRequest`

NewForcePromoteRequest instantiates a new ForcePromoteRequest object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewForcePromoteRequestWithDefaults

`func NewForcePromoteRequestWithDefaults() *ForcePromoteRequest`

NewForcePromoteRequestWithDefaults instantiates a new ForcePromoteRequest object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetActor

`func (o *ForcePromoteRequest) GetActor() string`

GetActor returns the Actor field if non-nil, zero value otherwise.

### GetActorOk

`func (o *ForcePromoteRequest) GetActorOk() (*string, bool)`

GetActorOk returns a tuple with the Actor field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetActor

`func (o *ForcePromoteRequest) SetActor(v string)`

SetActor sets Actor field to given value.

### HasActor

`func (o *ForcePromoteRequest) HasActor() bool`

HasActor returns a boolean if a field has been set.

### GetReason

`func (o *ForcePromoteRequest) GetReason() string`

GetReason returns the Reason field if non-nil, zero value otherwise.

### GetReasonOk

`func (o *ForcePromoteRequest) GetReasonOk() (*string, bool)`

GetReasonOk returns a tuple with the Reason field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetReason

`func (o *ForcePromoteRequest) SetReason(v string)`

SetReason sets Reason field to given value.



[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


