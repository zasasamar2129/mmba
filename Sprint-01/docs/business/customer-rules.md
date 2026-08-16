# MMBA — Customer Business Rules

## Registration
1. Search the mobile first.
2. If a match exists, open that customer.
3. If no match exists, create a customer.
4. MVP required fields: first name, last name, mobile.
5. Generate a customer code automatically.

## Search
Search must support mobile, name, customer code, national code and phone.
Mobile and customer code are high-priority matches. Name search supports partial matching.

## Duplicate prevention
Never silently create a duplicate for an existing primary mobile number.

## History
The profile will eventually expose a chronological timeline of calls, visits, tasks, contracts, payments, attachments and other interactions.

## Archiving
Archive is reversible. Historical records remain intact.

## Credit
`credit_level` is informational in MVP and never authorizes a financial transaction by itself.

## Permissions
RBAC controls who may view or edit customers. Customer editing never implies financial approval.
