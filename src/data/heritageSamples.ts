import type { AwardCategory, MediaType } from '../types/archive';

export interface HeritageSampleSeed {
  title: string;
  recipientName: string;
  awardDate: string;
  awardYear: number;
  category: AwardCategory;
  mediaType: MediaType;
  mediaUrl: string;
  accessionNumber: string;
  issuingBody: string;
  notes: string;
  isPublic: boolean;
}

export const HERITAGE_HERO_IMAGE = '/src/assets/images/hero_trophy_exhibition_1795748849877.jpg';

export const HERITAGE_SAMPLES: HeritageSampleSeed[] = [
  {
    title: '宜蘭縣全縣中小學聯合運動會國小男子組田徑總錦標',
    recipientName: '新生國小田徑代表隊',
    awardDate: '1988-11-12',
    awardYear: 1988,
    category: 'trophy',
    mediaType: 'photo',
    mediaUrl: '/src/assets/images/artifact_trophy_brass_1795748850392.jpg',
    accessionNumber: 'XS-1988-001',
    issuingBody: '宜蘭縣政府',
    notes: '純銅鑄造雙耳冠軍獎盃，木質底座刻有「宜蘭縣新生國民小學留念」字樣，保存狀況完整。',
    isPublic: true,
  },
  {
    title: '台灣省北區國民小學國語文競賽朗讀組優等獎狀',
    recipientName: '林佳穎',
    awardDate: '1994-05-18',
    awardYear: 1994,
    category: 'certificate',
    mediaType: 'photo',
    mediaUrl: '/src/assets/images/artifact_certificate_scroll_1795748851238.jpg',
    accessionNumber: 'XS-1994-004',
    issuingBody: '台灣省政府教育廳',
    notes: '手工棉紙印製金邊框獎狀，鈐有教育廳朱文印信，原件典藏於校史室恆溫櫃。',
    isPublic: true,
  },
  {
    title: '全國少年桌球錦標賽個人組銀質獎牌',
    recipientName: '陳志豪',
    awardDate: '1996-03-24',
    awardYear: 1996,
    category: 'medal',
    mediaType: 'photo',
    mediaUrl: '/src/assets/images/artifact_medal_bronze_1795748851930.jpg',
    accessionNumber: 'XS-1996-009',
    issuingBody: '中華民國桌球協會',
    notes: '鑄造金屬獎牌附原裝深紅織帶與別針，背面銘刻賽事屆次與選手姓名。',
    isPublic: true,
  },
  {
    title: '宜蘭市校際合唱比賽甲等榮譽紀念盃',
    recipientName: '新生國小合唱團',
    awardDate: '1976-12-08',
    awardYear: 1976,
    category: 'trophy',
    mediaType: 'photo',
    mediaUrl: '/src/assets/images/hero_trophy_exhibition_1795748849877.jpg',
    accessionNumber: 'XS-1976-002',
    issuingBody: '宜蘭市公所',
    notes: '創校初期重要藝文團體獎項，見證民國六十五年本校音樂社團蓬勃發展歷程。',
    isPublic: true,
  },
  {
    title: '新生英語村與特色歷史建築校舍',
    recipientName: '校園英語村基地',
    awardDate: '2008-09-01',
    awardYear: 2008,
    category: 'building',
    mediaType: 'photo',
    mediaUrl: '/assets/aistudio/_______01_be8cc8f6.jpg',
    accessionNumber: 'XS-2008-001',
    issuingBody: '宜蘭縣政府教育處',
    notes: '新生英語村特色校舍建築，融合雙語情境與美感校園空間，為校園重要代表性建築與歷史地標。',
    isPublic: true,
  },
];
