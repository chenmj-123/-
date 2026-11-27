# Security Specification & Red Team Verification — Xinsheng Elementary School Digital Award Archive

## 1. Data Invariants
1. **Identity Integrity**: Every `awards/{awardId}` document MUST record `createdBy == request.auth.uid` on creation, and `createdBy` is immutable thereafter.
2. **Temporal Integrity**: `createdAt` and `updatedAt` MUST match `request.time` on creation; `createdAt` is immutable on updates and `updatedAt` MUST match `request.time` on updates.
3. **Verified Authorship**: All write mutations require an authenticated user with `request.auth.token.email_verified == true`.
4. **Privilege Isolation**: Users cannot self-assign `role: "admin"` in `users/{userId}` or write to `admins/{adminId}` unless already a verified administrator.
5. **Public Exhibition Privacy**: Unauthenticated or non-owner `get` and `list` queries on `awards` are strictly bounded to `resource.data.isPublic == true`.
6. **PII Isolation**: `users/{userId}` containing email addresses is strictly readable and writable only by the owner (`request.auth.uid == userId`) or a verified admin.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Unauthenticated Award Creation**: `request.auth == null` creating `/awards/a1` -> `PERMISSION_DENIED`.
2. **Unverified Email Spoofing**: `request.auth.token.email == 'chenmj@tmail.ilc.edu.tw'` with `email_verified: false` -> `PERMISSION_DENIED`.
3. **Identity Spoofing on Create**: User `u1` creating `/awards/a2` with `createdBy: 'u2'` -> `PERMISSION_DENIED`.
4. **Shadow Field Injection on Create**: Valid award payload plus ghost key `isFeatured: true` -> `PERMISSION_DENIED`.
5. **Resource Poisoning via Oversized ID**: Creating `/awards/<150-char-invalid-id!@#>` -> `PERMISSION_DENIED`.
6. **Resource Poisoning via Oversized Title**: Creating `/awards/a3` with `title` > 200 chars -> `PERMISSION_DENIED`.
7. **Invalid Date Format**: Creating `/awards/a4` with `awardDate: '1994/05/18'` (fails `^\\d{4}-\\d{2}-\\d{2}$`) -> `PERMISSION_DENIED`.
8. **Client-Spoofed Timestamp**: Creating `/awards/a5` with `createdAt: Timestamp(1999-01-01)` != `request.time` -> `PERMISSION_DENIED`.
9. **Immutable Field Tampering on Update**: Creator updating `createdBy` or `accessionNumber` -> `PERMISSION_DENIED`.
10. **Unauthorized Cross-User Update**: User `u2` updating `u1`'s award -> `PERMISSION_DENIED`.
11. **Private Draft Leakage via List/Get**: Unauthenticated visitor fetching `/awards/private-1` (`isPublic: false`) -> `PERMISSION_DENIED`.
12. **Self-Escalation in Users/Admins**: User `u1` setting `role: 'admin'` in `/users/u1` or creating `/admins/u1` -> `PERMISSION_DENIED`.
