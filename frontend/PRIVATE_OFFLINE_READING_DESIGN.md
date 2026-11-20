# Private offline reading: implementation design (not enabled)

Status: specification only. No private-book offline cache, database migration, API change, or production deployment is included.

## Existing behavior

- The service worker caches only the public application shell, Vite assets, and public illustration paths. It must not cache authenticated API responses, account routes, or private book media.
- Local demo stories may be stored by the existing demo-library mechanism on the user's own device. The interface must never imply server-owned books are downloadable offline.
- Server-backed books are session-scoped. Progress and favorite edits use owner-scoped metadata and a replay queue; these are *not* offline book copies.
- The character template helper is a small, opt-in **sessionStorage** feature for anonymous demo mode; it does not provide account synchronisation or persistent cloud character storage.

## Security boundary for a future private download

1. Require an authenticated parent and an explicit download gesture per book; never pre-download account books. Child-facing mode must not unlock parental storage.
2. Define a stable **opaque account/owner identifier** derived from a validated authenticated account response, not user email. Index downloads by owner and book ID. Do not store bearer tokens.
3. Encrypt complete book contents and optional private images before writing to IndexedDB with WebCrypto AES-GCM and a unique random nonce per record. Encryption is a design requirement, **not a feature currently implemented**.
4. Key management needs product and security review: non-exportable in-memory keys protect current sessions but do not unlock data after a restart. Persistent offline access requires a separate user-unlock mechanism or server-wrapped key; do not silently persist a plaintext key, access token, or login password.
5. On account switch or logout, erase decrypted in-memory book contents immediately; ensure the reader cannot continue showing the previous account. Encrypted downloads may remain only if the user explicitly selected a durable offline mode with a secure unlock policy. Otherwise delete them.
6. Enforce age/profile access, quotas, server revocation and explicit delete semantics when online. Offline data cannot instantly learn server-side revocations; disclose this limitation and define a TTL.
7. Validate storage quota and failures atomically, expose per-book statuses, and provide a manual delete/export policy. Never modify or clear the existing demo-library storage automatically.
8. Use versioned IndexedDB migrations and tests for multiple accounts, stale sessions, interruptions, corrupt ciphertext, deleted books, and iOS Safari eviction.
9. Continue excluding private books from Cache Storage and the service worker. Network requests with Authorization must continue bypassing SW caches.
10. Do not market the feature as secure offline family reading until penetration checks, real-device tests, retention policy, and recovery flows are complete.

## Incremental rollout

- Phase A (current): truthful offline-state UX, public shell cache, local demo reading.
- Phase B: parent-approved explicit download list behind a disabled feature flag, IndexedDB encrypted draft, key-unlock prototype, privacy tests.
- Phase C: server authorization/revocation design (Backend only after separate permission), mobile integration tests and controlled rollout.

No migrations or Backend code should be introduced in this frontend-only branch without a separate security review and authorization.
