## Future improvements

This document lists enhancements to consider next, aligned with the current architecture.

### 1) Group/contact metadata refresh (listeners)
- Cache group metadata (recommended by Baileys) via `cachedGroupMetadata` socket config.
- Listen to:
  - `groups.update`
  - `group-participants.update`
- On events, call `sock.groupMetadata(jid)` and update `groups.additional_data`, `subject`, `description`, and `participant_count`.
- Use a small TTL cache (NodeCache or Redis) to reduce network calls.

### 2) Contact enrichment
- Triggers:
  - On first-sight of a new contact (enqueue job) OR
  - Scheduled background job (e.g., every hour fetch N pending) OR
  - Manual admin/API trigger
- Data:
  - `fetchStatus(jid)` -> store into `contacts.description` and `additional_data`
  - `profilePictureUrl(jid, 'image')` -> store into `contacts.additional_data`
  - `getBusinessProfile(jid)` -> set `is_business` and store profile info
- Apply throttling/backoff to avoid WA rate limits.

### 3) Participants table (audit)
- New table `group_participants` with columns:
  - id (UUID), group_id (FK), contact_id (FK), role, joined_at, left_at (nullable)
- Populate from `group-participants.update` and metadata snapshots.

### 4) Delivery/read receipts
- Track `messages.update` events to record read/delivery states and timestamps per message.
- Optional table or columns in `messages.additional_data.statuses`.

### 5) Media persistence
- Current behavior: we do not persist media bytes; only store descriptive metadata (mimetype, size, dimensions).
- Future plan:
  - Implement media download using `downloadMediaMessage` for permitted content.
  - Store to object storage (S3/MinIO/Azure Blob/GCS) with signed URLs.
  - Save storage key + checksum in `messages.additional_data.media_storage`.
  - Add retention policy controls and re-upload via `sock.updateMediaMessage` when needed.

### 6) Backfill controls
- Provide APIs/CLI to manually backfill a specific chat using `sock.fetchMessageHistory` in batches.
- Persist a watermark per chat to avoid duplications.

### 7) Observability & performance
- Add structured logging and metrics around DB timings and event throughput.
- Consider bulk inserts for history batches with transaction + `ignoreDuplicates`.
- Add more targeted indexes once query patterns are observed (e.g., (group_id, timestamp)).
