# Security Specification - Vila de Rei Complexo Desportivo

## 1. Data Invariants
- **Identity Integrity**: All documents in `/users/{userId}` must have an `id` field matching the document name and `request.auth.uid`.
- **Relational Sync**: All `saude` and `refeicoes` records must belong to the active user.
- **Role Hierarchy**: Only users with `role` in ['admin', 'chefia'] can perform sensitive deletions or view all bug reports.
- **Immutable Fields**: `createdAt` and `userId` must not change after creation.
- **Size Bounds**: `lema` and `desc` strings must be strictly bounded to prevent resource exhaustion attacks.

## 2. The "Dirty Dozen" Payloads

1. **Identity Spoofing**: `setDoc(doc(db, 'users', 'other_uid'), { ... })` -> DENIED.
2. **Privilege Escalation**: `updateDoc(doc(db, 'users', my_uid), { role: 'admin' })` -> DENIED.
3. **State Shortcutting**: `addDoc(collection(db, 'saude'), { peso: -10 })` -> DENIED (invalid value).
4. **Shadow Update**: `updateDoc(doc(db, 'users', my_uid), { verified: true, ghostField: 'hacked' })` -> DENIED.
5. **ID Poisoning**: `setDoc(doc(db, 'artifacts/$(appId)/public/data/users', 'A'.repeat(2000)), { ... })` -> DENIED.
6. **Immutability Breach**: `updateDoc(doc(db, 'users', my_uid), { createdAt: serverTimestamp() })` -> DENIED (must remain unchanged).
7. **Type Poisoning**: `addDoc(collection(db, 'bugs'), { text: 12345 })` -> DENIED (expected string).
8. **Resource Exhaustion**: `updateDoc(doc(db, 'users', my_uid), { lema: 'A'.repeat(200000) })` -> DENIED.
9. **Log Forgery**: `addDoc(collection(db, 'logs'), { ... })` by an `utente` -> DENIED.
10. **Orphaned Writes**: Creating a `message` in a non-existent `conversa` -> DENIED.
11. **PII Leak**: Authenticated user trying to `get` another user's private data -> DENIED.
12. **Blind Scraping**: `getDocs(query(collection(db, 'users')))` without an ID filter -> DENIED.

## 3. The Test Runner
Verified via `firestore.rules.test.ts`.
