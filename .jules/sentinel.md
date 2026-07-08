## 2026-07-08 - Information Disclosure via Console Logging
**Vulnerability:** The logger utility (`utils/logger.ts`) directly outputted messages and parameters to the console using `console.log`, `console.warn`, etc. In a production environment, this could leak sensitive information, such as API keys, PII, or internal system details, into browser console logs or system logs.
**Learning:** Directly wrapping console functions without checking the environment fails to restrict potentially sensitive debug and error information to non-production environments.
**Prevention:** Always implement an environment check (e.g., `process.env.NODE_ENV === 'production'`) to conditionally disable verbose logging or replace it with a secure logging service in production environments.
