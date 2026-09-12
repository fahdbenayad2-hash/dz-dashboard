# Octomatic authentication adapter

The adapter is covered by mocked tests. On 2026-09-08 it was installed in the live
Apps Script, automatic login was enabled in private Script Properties, and a forced
renewal plus a read request completed with `AUTH_RENEWAL_OK`. CAPTCHA, OTP, a disabled
account, or a provider API change can still require a manual reconnection.

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

On 2026-09-08 the validated shadow generation was atomically promoted to production.
After enabling the hourly `dzSyncTick` trigger, a fresh production generation then
published 9,456 Orders and 16,423 Tracking rows. `SyncStatus` records the completed
generation, `DZ_SYNC_STATE` was cleared, and the prior error state was removed.
Advanced Sheets v4 is enabled. Initialization checkpoints each stage and reuses
deterministic staging names after uncertain timeouts. Review `DZ_SYNC_STATE` before
resuming; do not reset it blindly.

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
only after verifying the published data.

On 2026-09-11 the production feed was found stuck at Orders page 120: the generation
started with 9,530 orders, while the live Octomatic count later changed. The old code
treated a lower `all_count` as a permanent failure and retried the same checkpoint
every hour. Octomatic had already reached order 26,351 and 9,565 visible orders while
the dashboard still ended at order 26,240. The sync now treats `all_count` as a live
observation, finishes on the short final page, and keeps the newest copy when page
boundaries shift. Its default fetch budget is 270 seconds (configurable from 30 to
270 seconds with `DZ_SYNC_BUDGET_MS`) so a normal generation can finish in one Apps
Script execution. Expired or configuration-mismatched checkpoints are released for
the next trigger without changing the last published sheets.

The same incident exposed a second blocker: retained staging sheets had brought the
workbook close to Google Sheets' 10-million-cell limit, so adding another 50 rows
failed on every retry. Stage writes now resize through the Advanced Sheets API and
cap staging width at the 11 columns actually stored, reclaiming unused grid cells
without deleting the published data.

Stage writes combine ten Octomatic pages into one Sheets API batch by default. This
reduces a typical full generation from roughly 430 write requests to about 43 while
remaining below the per-user write-request quota. The setting
`DZ_STAGE_PAGES_PER_WRITE` accepts 1–20. Checkpoints are saved after each successful
batch, so a quota or network failure resumes at the last durable group of rows.

Stage writes also avoid `getMaxRows`, `getMaxColumns`, `insertRowsAfter`, and
`SpreadsheetApp.flush`; those calls repeatedly timed out once the workbook became
large. Each Advanced Sheets request grows the active stage only to its durable
checkpoint and keeps it at 11 columns.

On 2026-09-12 another production incident exposed unbounded staging retention: each
hourly generation created two new sheets and reserved 20,000 rows in each one. The
workbook reached the 10-million-cell limit again, leaving the dashboard at order
26,410 while Octomatic had reached 26,451. Generations now reuse fixed production
stages (`_dz_stage_Orders` and `_dz_stage_Tracking`). Obsolete generation-specific
stages are pruned before fetching, except sheets referenced by an active resumable
checkpoint; migrated active stages are pruned only after atomic publication. This
bounds workbook growth while the published Orders, Tracking, and SyncStatus sheets
remain the durable recovery copy.

The completed migration is recorded once as `DZ_STAGING_MIGRATED=true`. Later hourly
runs skip the expensive workbook-wide staging scan, which otherwise can time out even
after obsolete sheets have already been removed.
