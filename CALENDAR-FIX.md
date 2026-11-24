# Calendar loading and date correction

The calendar reads only the displayed month's logs for the authenticated user, in parallel with that user's protocols. It keeps navigation visible, ends stalled reads after 15 seconds, and offers retry after an error. Late month/account results cannot repaint the current calendar. Logging is unavailable until the requested month is verified; an acknowledged save updates that month locally instead of fetching all history again. An unconfirmed write requires a fresh server read before another attempt.

The account-access wrapper also handles failed reads without granting access. Existing role and profile requirements remain in force. Calendar and dashboard log dates now use the same local-date helper. Existing records and dose schedules are not rewritten.

## Validation

Run `node --test calendar-data.test.mjs` (Node 18 or newer). Nine tests cover Phoenix, Denver and Bangkok date boundaries, leap/DST/year ranges, parallel user-scoped month queries, missing identity, rejected reads and timeout behavior. JSX for Calendar, Dashboard and ProtectedRoute was compiled with esbuild.

The full Create React App build and browser/live Firebase acceptance are still required. This environment could not complete the existing dependency installation (the lockfile has a yaml peer-resolution issue and offline cache is incomplete). A local browser preview was also blocked by environment policy. The live DosiQ session is signed out. No production data was accessed or changed during validation.

## Before release

1. Compare the candidate with the current Firebase-hosted app and verify the build using its normal dependency/toolchain setup.
2. The new bounded log query requires a collection-scoped composite index on `logs`: `userId` ascending, then `date` ascending. `firestore.indexes.json` records this requirement. Inspect the deployed index inventory and merge existing definitions before using the CLI; add this index without deleting or replacing other indexes. Wait until it is ready before releasing the frontend. Do not change Firestore security rules.
3. With a fictional account, test empty and populated months, rapid month changes, offline/timeout/permission errors and retry, single log save/update, uncertain save recovery, sign-out/account changes, and local dates after 5 p.m. Phoenix and around midnight/DST.
4. Release only the verified DosiQ frontend to the `dosiq` hosting target. A GitHub branch or PR does not update Firebase Hosting. Keep the existing deployed version available for rollback.

Historical dates are preserved as saved. This patch does not infer or migrate possibly shifted past logs, change clinical schedules, or create accounts, notifications or charges.
