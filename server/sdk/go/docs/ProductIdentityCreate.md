# ProductIdentityCreate

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**Id** | **string** |  | 
**Name** | Pointer to **NullableString** |  | [optional] 
**Description** | Pointer to **NullableString** |  | [optional] 
**Price** | Pointer to **NullableInt32** |  | [optional] 
**TokenAmount** | Pointer to **NullableInt32** |  | [optional] 
**IdentityType** | Pointer to **NullableString** |  | [optional] 
**DurationDays** | Pointer to **NullableInt32** |  | [optional] 
**Status** | Pointer to **NullableInt32** |  | [optional] 
**Sort** | Pointer to **NullableInt32** |  | [optional] 

## Methods

### NewProductIdentityCreate

`func NewProductIdentityCreate(id string, ) *ProductIdentityCreate`

NewProductIdentityCreate instantiates a new ProductIdentityCreate object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewProductIdentityCreateWithDefaults

`func NewProductIdentityCreateWithDefaults() *ProductIdentityCreate`

NewProductIdentityCreateWithDefaults instantiates a new ProductIdentityCreate object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetId

`func (o *ProductIdentityCreate) GetId() string`

GetId returns the Id field if non-nil, zero value otherwise.

### GetIdOk

`func (o *ProductIdentityCreate) GetIdOk() (*string, bool)`

GetIdOk returns a tuple with the Id field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetId

`func (o *ProductIdentityCreate) SetId(v string)`

SetId sets Id field to given value.


### GetName

`func (o *ProductIdentityCreate) GetName() string`

GetName returns the Name field if non-nil, zero value otherwise.

### GetNameOk

`func (o *ProductIdentityCreate) GetNameOk() (*string, bool)`

GetNameOk returns a tuple with the Name field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetName

`func (o *ProductIdentityCreate) SetName(v string)`

SetName sets Name field to given value.

### HasName

`func (o *ProductIdentityCreate) HasName() bool`

HasName returns a boolean if a field has been set.

### SetNameNil

`func (o *ProductIdentityCreate) SetNameNil(b bool)`

 SetNameNil sets the value for Name to be an explicit nil

### UnsetName
`func (o *ProductIdentityCreate) UnsetName()`

UnsetName ensures that no value is present for Name, not even an explicit nil
### GetDescription

`func (o *ProductIdentityCreate) GetDescription() string`

GetDescription returns the Description field if non-nil, zero value otherwise.

### GetDescriptionOk

`func (o *ProductIdentityCreate) GetDescriptionOk() (*string, bool)`

GetDescriptionOk returns a tuple with the Description field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetDescription

`func (o *ProductIdentityCreate) SetDescription(v string)`

SetDescription sets Description field to given value.

### HasDescription

`func (o *ProductIdentityCreate) HasDescription() bool`

HasDescription returns a boolean if a field has been set.

### SetDescriptionNil

`func (o *ProductIdentityCreate) SetDescriptionNil(b bool)`

 SetDescriptionNil sets the value for Description to be an explicit nil

### UnsetDescription
`func (o *ProductIdentityCreate) UnsetDescription()`

UnsetDescription ensures that no value is present for Description, not even an explicit nil
### GetPrice

`func (o *ProductIdentityCreate) GetPrice() int32`

GetPrice returns the Price field if non-nil, zero value otherwise.

### GetPriceOk

`func (o *ProductIdentityCreate) GetPriceOk() (*int32, bool)`

GetPriceOk returns a tuple with the Price field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetPrice

`func (o *ProductIdentityCreate) SetPrice(v int32)`

SetPrice sets Price field to given value.

### HasPrice

`func (o *ProductIdentityCreate) HasPrice() bool`

HasPrice returns a boolean if a field has been set.

### SetPriceNil

`func (o *ProductIdentityCreate) SetPriceNil(b bool)`

 SetPriceNil sets the value for Price to be an explicit nil

### UnsetPrice
`func (o *ProductIdentityCreate) UnsetPrice()`

UnsetPrice ensures that no value is present for Price, not even an explicit nil
### GetTokenAmount

`func (o *ProductIdentityCreate) GetTokenAmount() int32`

GetTokenAmount returns the TokenAmount field if non-nil, zero value otherwise.

### GetTokenAmountOk

`func (o *ProductIdentityCreate) GetTokenAmountOk() (*int32, bool)`

GetTokenAmountOk returns a tuple with the TokenAmount field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetTokenAmount

`func (o *ProductIdentityCreate) SetTokenAmount(v int32)`

SetTokenAmount sets TokenAmount field to given value.

### HasTokenAmount

`func (o *ProductIdentityCreate) HasTokenAmount() bool`

HasTokenAmount returns a boolean if a field has been set.

### SetTokenAmountNil

`func (o *ProductIdentityCreate) SetTokenAmountNil(b bool)`

 SetTokenAmountNil sets the value for TokenAmount to be an explicit nil

### UnsetTokenAmount
`func (o *ProductIdentityCreate) UnsetTokenAmount()`

UnsetTokenAmount ensures that no value is present for TokenAmount, not even an explicit nil
### GetIdentityType

`func (o *ProductIdentityCreate) GetIdentityType() string`

GetIdentityType returns the IdentityType field if non-nil, zero value otherwise.

### GetIdentityTypeOk

`func (o *ProductIdentityCreate) GetIdentityTypeOk() (*string, bool)`

GetIdentityTypeOk returns a tuple with the IdentityType field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetIdentityType

`func (o *ProductIdentityCreate) SetIdentityType(v string)`

SetIdentityType sets IdentityType field to given value.

### HasIdentityType

`func (o *ProductIdentityCreate) HasIdentityType() bool`

HasIdentityType returns a boolean if a field has been set.

### SetIdentityTypeNil

`func (o *ProductIdentityCreate) SetIdentityTypeNil(b bool)`

 SetIdentityTypeNil sets the value for IdentityType to be an explicit nil

### UnsetIdentityType
`func (o *ProductIdentityCreate) UnsetIdentityType()`

UnsetIdentityType ensures that no value is present for IdentityType, not even an explicit nil
### GetDurationDays

`func (o *ProductIdentityCreate) GetDurationDays() int32`

GetDurationDays returns the DurationDays field if non-nil, zero value otherwise.

### GetDurationDaysOk

`func (o *ProductIdentityCreate) GetDurationDaysOk() (*int32, bool)`

GetDurationDaysOk returns a tuple with the DurationDays field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetDurationDays

`func (o *ProductIdentityCreate) SetDurationDays(v int32)`

SetDurationDays sets DurationDays field to given value.

### HasDurationDays

`func (o *ProductIdentityCreate) HasDurationDays() bool`

HasDurationDays returns a boolean if a field has been set.

### SetDurationDaysNil

`func (o *ProductIdentityCreate) SetDurationDaysNil(b bool)`

 SetDurationDaysNil sets the value for DurationDays to be an explicit nil

### UnsetDurationDays
`func (o *ProductIdentityCreate) UnsetDurationDays()`

UnsetDurationDays ensures that no value is present for DurationDays, not even an explicit nil
### GetStatus

`func (o *ProductIdentityCreate) GetStatus() int32`

GetStatus returns the Status field if non-nil, zero value otherwise.

### GetStatusOk

`func (o *ProductIdentityCreate) GetStatusOk() (*int32, bool)`

GetStatusOk returns a tuple with the Status field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetStatus

`func (o *ProductIdentityCreate) SetStatus(v int32)`

SetStatus sets Status field to given value.

### HasStatus

`func (o *ProductIdentityCreate) HasStatus() bool`

HasStatus returns a boolean if a field has been set.

### SetStatusNil

`func (o *ProductIdentityCreate) SetStatusNil(b bool)`

 SetStatusNil sets the value for Status to be an explicit nil

### UnsetStatus
`func (o *ProductIdentityCreate) UnsetStatus()`

UnsetStatus ensures that no value is present for Status, not even an explicit nil
### GetSort

`func (o *ProductIdentityCreate) GetSort() int32`

GetSort returns the Sort field if non-nil, zero value otherwise.

### GetSortOk

`func (o *ProductIdentityCreate) GetSortOk() (*int32, bool)`

GetSortOk returns a tuple with the Sort field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetSort

`func (o *ProductIdentityCreate) SetSort(v int32)`

SetSort sets Sort field to given value.

### HasSort

`func (o *ProductIdentityCreate) HasSort() bool`

HasSort returns a boolean if a field has been set.

### SetSortNil

`func (o *ProductIdentityCreate) SetSortNil(b bool)`

 SetSortNil sets the value for Sort to be an explicit nil

### UnsetSort
`func (o *ProductIdentityCreate) UnsetSort()`

UnsetSort ensures that no value is present for Sort, not even an explicit nil

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


