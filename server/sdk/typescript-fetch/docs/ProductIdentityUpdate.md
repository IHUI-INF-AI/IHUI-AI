
# ProductIdentityUpdate


## Properties

Name | Type
------------ | -------------
`id` | string
`name` | string
`description` | string
`price` | number
`tokenAmount` | number
`identityType` | string
`durationDays` | number
`status` | number
`sort` | number

## Example

```typescript
import type { ProductIdentityUpdate } from ''

// TODO: Update the object below with actual values
const example = {
  "id": null,
  "name": null,
  "description": null,
  "price": null,
  "tokenAmount": null,
  "identityType": null,
  "durationDays": null,
  "status": null,
  "sort": null,
} satisfies ProductIdentityUpdate

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as ProductIdentityUpdate
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


