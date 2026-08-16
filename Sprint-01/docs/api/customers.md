# MMBA — Customer API Specification

Base path: `/api/v1/customers`

## POST /
Create a customer.

Required:
- first_name
- last_name
- mobile

Behavior:
- normalize mobile
- reject duplicate mobile with HTTP 409
- generate customer_code
- set created_by from authenticated user

## GET /
List/search customers.

Query parameters:
- `q`
- `page`
- `pageSize`
- `status`
- `archived`

`q` searches mobile, customer code, first name, last name, national code and phone.

Default pageSize: 25. Maximum: 100.

## GET /:id
Return one customer profile.

## PATCH /:id
Update editable fields. Set `updated_by` and `updated_at`.

## POST /:id/archive
Soft-archive a customer.

## POST /:id/unarchive
Restore an archived customer.

## Error contract
```json
{
  "error": {
    "code": "CUSTOMER_MOBILE_EXISTS",
    "message": "A customer with this mobile number already exists.",
    "details": {}
  }
}
```

MVP error codes:
- CUSTOMER_NOT_FOUND
- CUSTOMER_MOBILE_EXISTS
- VALIDATION_ERROR
- FORBIDDEN
- UNAUTHORIZED
- INTERNAL_ERROR

## Security
All endpoints require authentication except future login endpoints. Authorization must be enforced server-side.
