# Changelog

All notable changes to this fork of WuzAPI for LivChat.

## 2025-12-22

### Fixed
- **pushName fallback for Business accounts** - Uses `BusinessName` when `PushName` is empty
  - `handlers.go:777-790` - Added fallback logic
  - Problem: `Store.PushName` is synced via `PushNameSetting` event which may not occur after restart
  - Solution: For business accounts, `Store.BusinessName` is more reliable (always persisted in DB)
  - Now works correctly for both personal and business WhatsApp accounts

## 2025-12-20

### Added
- **pushName in /session/status** - Real WhatsApp user name now exposed in API
  - `handlers.go:777-790` - Gets pushName from `waClient.Store.PushName` with BusinessName fallback
  - Returns both `name` (instance ID) and `pushName` (WhatsApp display name)
  - Example response:
    ```json
    {
      "name": "livchat_xxx",
      "pushName": "Pedro Nascimento",
      "connected": true,
      "loggedIn": true
    }
    ```
  - Performance: O(1) memory access, zero overhead
  - Thread-safe: Uses existing RWMutex pattern from ClientManager

### Why This Change
The upstream WuzAPI does not expose the user's WhatsApp display name (pushName) in the `/session/status` endpoint. This is needed for LivChat to show the real WhatsApp name instead of a generic "WhatsApp" label.

The pattern already exists in the codebase:
- `wmiau.go:659` - Checks `Store.PushName` for presence status
- `wmiau.go:1616` - Uses `Store.Contacts.GetContact()` for history sync

---

## Upstream

Based on [asternic/wuzapi](https://github.com/asternic/wuzapi) v1.0.5

### Key Differences from Upstream
| Feature | Upstream | LivChat Fork |
|---------|----------|--------------|
| pushName in /session/status | ❌ | ✅ |

See upstream [API.md](./API.md) for original documentation.
