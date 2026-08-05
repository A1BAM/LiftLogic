🎯 **What:** Removed fallback CORS origin configuration to enforce exact origin matching.

⚠️ **Risk:** Falling back to a valid allowed origin when an invalid origin or no origin is provided could expose endpoints to permissive behaviors in clients or tooling.

🛡️ **Solution:** Only set `Access-Control-Allow-Origin` if the request's origin explicitly matches an origin in the `ALLOWED_ORIGIN` list.
