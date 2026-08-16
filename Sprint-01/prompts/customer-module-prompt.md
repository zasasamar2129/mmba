# MMBA — Customer Module Coding Prompt

Read first:
- docs/database/customers.md
- docs/business/customer-rules.md
- docs/api/customers.md
- docs/ui/customer-ui.md

Tech:
- Next.js + React + TypeScript
- Node.js backend
- MySQL
- Docker

Rules:
1. Do not invent conflicting business rules.
2. Do not duplicate customer identity data.
3. Enforce authorization server-side.
4. Use migrations.
5. Validate client and server input.
6. Normalize Iranian mobile numbers before uniqueness checks.
7. Never hard-delete customers.
8. Test duplicate mobile, create, search, update, archive and authorization.
9. Keep modules maintainable and production-oriented.
10. If an architectural decision conflicts with the docs, document the conflict before changing it.

Deliver:
- migration
- backend model/service/controller/routes
- validation
- frontend list/search
- customer form
- customer profile
- tests
- concise implementation notes

Do not implement future features unless needed for the MVP.
