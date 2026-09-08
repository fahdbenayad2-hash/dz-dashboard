# Octomatic authentication adapter

The adapter is covered by mocked tests. On 2026-09-08 its manual-token path was
installed in the live Apps Script and verified with the read-only pagination
diagnostic. The login request and token response shape were observed in the public
Octomatic frontend; a real automatic renewal still requires a controlled credential
test and may be blocked by CAPTCHA or OTP.

Automatic-mode setup after a controlled account test:

1. Save a private backup/version of the existing Apps Script.
2. Keep existing `CONFIG`, `getXAuth`, and the current `JWT_TOKEN`/`X_AUTH_KEY`
   Script Properties. The live project has the adapter embedded in its main file;
   do not add a second definition of `apiGet_`.
3. Keep `OCTO_AUTO_LOGIN` unset for manual-token mode. Automatic mode requires the
   owner to enter `OCTO_LOGIN_ACCOUNT`, `OCTO_LOGIN_PASSWORD`, `OCTO_STORE_NAME` and
   set `OCTO_AUTO_LOGIN=true` in the server's private Script Properties.
4. Use a dedicated account with the minimum supported read permissions. Script
   editors can access Script Properties; limit project editors. Never put credentials
   in a sheet, the dashboard frontend, source control, or chat.
5. Verify one controlled renewal, including whether existing sessions are invalidated.
   CAPTCHA/OTP or a disabled account requires human reconnection. Disabling auto-login
   restores manual token use; revoke/remove stored login credentials if abandoning it.

The adapter fails closed for missing configuration, unexpected stores/domains, bad
HTTP responses, or malformed data. It validates a new token at the configured store
before replacing the old token, and suppresses rapid repeated login attempts. JWT
expiry is a scheduling hint, not signature verification. Credentials are not logged.

This does **not** fix full-refresh data loss in the existing sync loops. Do not enable
an aggressive trigger until resumable staging and complete-run publication replace
the current `break → resetSheet` path. Never activate this file alone as a claim that
the entire synchronization pipeline has been repaired.

## Resumable synchronization (installed and promoted)

On 2026-09-08 the validated shadow generation was atomically promoted to production:
9,412 Orders and 16,386 Tracking rows with no blank or duplicate IDs in either
published target. `SyncStatus` records the completed generation. Advanced Sheets v4
is enabled. Initialization checkpoints each stage and reuses deterministic staging
names after uncertain timeouts. Review `DZ_SYNC_STATE` before resuming; do not reset
it blindly. The module rejects target changes during an unfinished run.

Live diagnostic on 2026-09-07: added and ran `PaginationDiagnostic.gs` with
`dzCheckPagination` in the existing bound project. Five small read requests per
endpoint compared overlapping windows and repeated the first window to detect
source changes. Execution completed with `{"Orders":"page","Tracking":"page"}`.
No spreadsheet cells, tokens, properties or triggers were modified by the diagnostic.
Use `DZ_PAGINATION_MODE=page` for this observed provider; the property has not yet
been applied. This sample establishes pagination behavior, not complete-run counts
or uniqueness across the full tracking history.

`ResumableSync.gs` adds `dzSyncTick`, checkpoints, staging sheets, and one Sheets
batch update to publish Orders, Tracking and SyncStatus together. Unit tests use
mocked Google services; they do not validate the provider's pagination behavior.

Before live installation:

1. Use a private copy of the bound spreadsheet and preserve the original script.
2. Verify whether the provider offset counts pages or records, then set
   `DZ_PAGINATION_MODE` to `page` or `offset` in Script Properties.
3. Add Authentication.gs as described above and ResumableSync.gs. Keep CONFIG and
   getXAuth, and enable the Advanced Google Sheets service.
4. Run dzSyncTick until a complete generation is published. Verify counts, duplicate
   order IDs, amounts and sample source dates. Tracking may contain multiple events
   per order; resolve that model before relaxing duplicate rejection.
5. Verify a resumed run after interruption and that a failed fetch preserves the
   previously published sheets. Do not manually fabricate SyncStatus for old data.
6. Disable legacy updateAll/syncOrders/syncTracking triggers before switching the
   live trigger to dzSyncTick. Do not run both pipelines concurrently.

Staging sheets are retained for recovery. Review and remove obsolete generations
only after verifying the published data. Source changes or a run older than 24 hours
require a reviewed restart; do not silently discard its recovery state.
