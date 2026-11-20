# ADR-001: Storage path — local-first with encrypted sync (Option B)

**Date:** 2026-10-29  
**Status:** Decided  
**Deciders:** Founder + lead developer

## Context

The brief offers three options:
- A. Local-first only (device, no server sync)
- B. Local-first + encrypted sync (recommended)
- C. Server-side plain database (contradicts the privacy promise)

## Decision

**Option B.** The device is the source of truth. The server stores encrypted change logs for backup and multi-device sync (a Plus feature). Envelope names, notes, lender names and goals are encrypted with AES-256-GCM on the device before they leave the phone. The server never holds plaintext for user-written fields.

## Consequences

- Phase 1 ships with local storage (IndexedDB) and no sync — fastest to get to 20 real users.
- Sync is added in Phase 2 as a Plus feature.
- Key recovery requires a printed recovery code shown once at signup.
- The server holds amounts and timestamps (needed for ledger rules and admin counts) but only ciphertext for names and notes.
- If a user loses their phone and their recovery code, encrypted data cannot be recovered. This must be stated plainly in the app.

## Rejected alternatives

- Option A: no backup, no multi-device — acceptable for MVP but limits growth.
- Option C: contradicts "only you can see how your money is split" and would make the bank-partner promise false.
