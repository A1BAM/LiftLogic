## 2026-07-08 - Information Disclosure via Console Logging
**Vulnerability:** The logger utility (`utils/logger.ts`) directly outputted messages and parameters to the console using `console.log`, `console.warn`, etc. In a production environment, this could leak sensitive information, such as API keys, PII, or internal system details, into browser console logs or system logs.
**Learning:** Directly wrapping console functions without checking the environment fails to restrict potentially sensitive debug and error information to non-production environments.
**Prevention:** Always implement an environment check (e.g., `process.env.NODE_ENV === 'production'`) to conditionally disable verbose logging or replace it with a secure logging service in production environments.

## 2026-07-10 - Implicit Column Disclosure in SQL Queries
**Vulnerability:** The use of `SELECT *` in database queries (`worker.ts`) implicitly selects all columns from a table. If sensitive data or internal metadata columns are added to the schema in the future, they would be automatically included in API responses, leading to accidental information disclosure.
**Learning:** API contracts should be explicit. Relying on table schema for response structure creates a tight coupling that easily breaks security boundaries when the schema evolves.
**Prevention:** Always explicitly list required columns in SQL queries. This ensures that only intended data is retrieved and exposed, providing a critical layer of defense-in-depth against data leakage.
