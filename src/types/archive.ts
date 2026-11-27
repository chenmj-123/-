export type AwardCategory = 'trophy' | 'certificate' | 'medal' | 'building';
export type MediaType = 'photo' | 'video';

export interface AwardRecord {
  id: string;
  title: string;
  recipientName: string;
  awardDate: string; // YYYY-MM-DD
  awardYear: number;
  category: AwardCategory;
  mediaType: MediaType;
  mediaUrl: string;
  accessionNumber: string;
  issuingBody: string;
  notes: string;
  isPublic: boolean;
  createdBy: string;
  createdByName: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

// Validation constants synchronized verbatim with firebase-blueprint.json & firestore.rules
export const ARCHIVE_LIMITS = {
  MAX_TITLE_LENGTH: 200,
  MAX_RECIPIENT_LENGTH: 120,
  MAX_ISSUING_LENGTH: 160,
  MAX_NOTES_LENGTH: 1000,
  MAX_MEDIA_URL_LENGTH: 1000,
  MAX_ACCESSION_LENGTH: 40,
  MIN_YEAR: 1964,
  MAX_YEAR: 2100,
  DATE_PATTERN: /^\d{4}-\d{2}-\d{2}$/,
  ACCESSION_PATTERN: /^[a-zA-Z0-9_\-]+$/,
} as const;

export const CATEGORY_LABELS: Record<AwardCategory, string> = {
  trophy: '獎盃',
  certificate: '獎狀',
  medal: '獎牌',
  building: '歷史建築',
};

export const MEDIA_TYPE_LABELS: Record<MediaType, string> = {
  photo: '靜態攝影',
  video: '動態錄影',
};

export function toRocYear(year: number): number {
  return year - 1911;
}

export function formatRocDate(isoDate: string): string {
  if (!ARCHIVE_LIMITS.DATE_PATTERN.test(isoDate)) return isoDate;
  const [yStr, mStr, dStr] = isoDate.split('-');
  const year = Number(yStr);
  const month = Number(mStr);
  const day = Number(dStr);
  const rocYear = toRocYear(year);
  if (rocYear <= 0) return isoDate;
  return `民國 ${rocYear} 年 ${month} 月 ${day} 日`;
}

export function formatDisplayDate(isoDate: string): string {
  if (!ARCHIVE_LIMITS.DATE_PATTERN.test(isoDate)) return isoDate;
  return isoDate.replace(/-/g, '.');
}

export function generateAccessionNumber(year: number): string {
  const safeYear = Number.isFinite(year) && year >= 1964 ? year : new Date().getFullYear();
  const suffix = Math.floor(100 + Math.random() * 900);
  const tsTail = String(Date.now()).slice(-3);
  return `XS-${safeYear}-${suffix}${tsTail}`;
}

export type EraKey = 'all' | '1964-1979' | '1980-1989' | '1990-1999' | '2000-now';

export const ERA_DEFINITIONS: { key: EraKey; label: string; range: string; min: number; max: number }[] = [
  { key: 'all', label: '全部時期', range: '1964–至今', min: 1964, max: 2100 },
  { key: '1964-1979', label: '創校奠基時期', range: '1964–1979', min: 1964, max: 1979 },
  { key: '1980-1989', label: '蓬勃成長時期', range: '1980–1989', min: 1980, max: 1989 },
  { key: '1990-1999', label: '榮譽綻放時期', range: '1990–1999', min: 1990, max: 1999 },
  { key: '2000-now', label: '世紀新象時期', range: '2000 迄今', min: 2000, max: 2100 },
];
