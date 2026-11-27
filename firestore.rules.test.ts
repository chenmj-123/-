/**
 * Dirty Dozen Security Test Matrix for Xinsheng Elementary School Digital Award Archive.
 * Intended for verification against @firebase/rules-unit-testing when an emulator is active.
 */

export interface DirtyDozenCase {
  id: number;
  name: string;
  collectionPath: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  expected: 'PERMISSION_DENIED';
  payload?: Record<string, unknown>;
}

export const DIRTY_DOZEN_PAYLOADS: DirtyDozenCase[] = [
  {
    id: 1,
    name: 'Unauthenticated Award Creation',
    collectionPath: 'awards/award_unauth_01',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: { title: 'Test Trophy', createdBy: 'anon' },
  },
  {
    id: 2,
    name: 'Unverified Email Spoofing Admin',
    collectionPath: 'awards/award_spoof_02',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: { title: 'Spoof Trophy', createdBy: 'spoof-uid' },
  },
  {
    id: 3,
    name: 'Identity Spoofing on Create (createdBy mismatch)',
    collectionPath: 'awards/award_id_03',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: { title: 'Valid Title', createdBy: 'victim-uid' },
  },
  {
    id: 4,
    name: 'Shadow Field Injection (ghost key isFeatured)',
    collectionPath: 'awards/award_shadow_04',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: { title: 'Valid Title', isFeatured: true },
  },
  {
    id: 5,
    name: 'Resource Poisoning via Invalid Document ID',
    collectionPath: 'awards/invalid$id!@#',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: { title: 'Valid Title' },
  },
  {
    id: 6,
    name: 'Oversized Title (>200 chars)',
    collectionPath: 'awards/award_long_06',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: { title: 'A'.repeat(201) },
  },
  {
    id: 7,
    name: 'Invalid Date Format (slash instead of hyphen)',
    collectionPath: 'awards/award_date_07',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: { awardDate: '1994/05/18' },
  },
  {
    id: 8,
    name: 'Client-Spoofed Timestamp (createdAt != request.time)',
    collectionPath: 'awards/award_ts_08',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: { createdAt: '1999-01-01T00:00:00Z' },
  },
  {
    id: 9,
    name: 'Immutable Field Tampering (changing createdBy or accessionNumber)',
    collectionPath: 'awards/award_immut_09',
    operation: 'update',
    expected: 'PERMISSION_DENIED',
    payload: { createdBy: 'another-uid', accessionNumber: 'XS-9999-999' },
  },
  {
    id: 10,
    name: 'Unauthorized Cross-User Update',
    collectionPath: 'awards/award_cross_10',
    operation: 'update',
    expected: 'PERMISSION_DENIED',
    payload: { title: 'Hijacked Title' },
  },
  {
    id: 11,
    name: 'Private Draft Leakage to Unauthenticated Visitor',
    collectionPath: 'awards/private_draft_11',
    operation: 'get',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Privilege Self-Escalation in Users/Admins',
    collectionPath: 'users/attacker_uid',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: { uid: 'attacker_uid', role: 'admin' },
  },
];
