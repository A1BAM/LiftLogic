🎯 **What:** Added a unit test to `GlobalHistoryModal` to cover the error handling behavior when importing invalid JSON data.
📊 **Coverage:** Specifically tests the error path (`catch` block) during the import process by injecting malformed text into the import textarea and submitting the form.
✨ **Result:** Improved test coverage and reliability by ensuring the UI properly displays the "Invalid JSON data." error (or equivalent parse errors) and correctly prevents the `onImport` callback from being invoked when malformed data is provided.
