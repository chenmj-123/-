import React, { useEffect, useMemo, useState } from 'react';
import {
  Camera,
  Film,
  LogIn,
  LogOut,
  Plus,
  Search,
  Sparkles,
  CheckCircle2,
  X,
} from 'lucide-react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  auth,
  BOOTSTRAPPED_ADMIN_EMAIL,
  db,
  handleFirestoreError,
  OperationType,
  signInWithGoogle,
  signOutUser,
} from './firebase';
import {
  CATEGORY_LABELS,
  ERA_DEFINITIONS,
  formatDisplayDate,
  formatRocDate,
  MEDIA_TYPE_LABELS,
  type AwardCategory,
  type AwardRecord,
  type EraKey,
  type MediaType,
} from './types/archive';
import { HERITAGE_HERO_IMAGE, HERITAGE_SAMPLES } from './data/heritageSamples';
import { MediaViewer } from './components/MediaViewer';
import { AccessionDetailModal } from './components/AccessionDetailModal';
import { CaptureStudioModal } from './components/CaptureStudioModal';
import { SchoolCrest } from './components/SchoolCrest';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);

  const [publicAwards, setPublicAwards] = useState<AwardRecord[]>([]);
  const [privateAwards, setPrivateAwards] = useState<AwardRecord[]>([]);
  const [isLoadingAwards, setIsLoadingAwards] = useState(true);

  // Filter & Search States
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | AwardCategory>('all');
  const [mediaFilter, setMediaFilter] = useState<'all' | MediaType>('all');
  const [eraFilter, setEraFilter] = useState<EraKey>('all');
  const [visibilityFilter, setVisibilityFilter] = useState<'public' | 'all'>('public');

  // Modals & Notifications
  const [selectedAward, setSelectedAward] = useState<AwardRecord | null>(null);
  const [isStudioOpen, setIsStudioOpen] = useState(false);
  const [editingAward, setEditingAward] = useState<AwardRecord | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSeeding, setIsSeeding] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);

  const isAdminUser = Boolean(
    user?.emailVerified && user.email === BOOTSTRAPPED_ADMIN_EMAIL
  );

  // Auth listener + private profile sync
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setAuthReady(true);

      if (currentUser && currentUser.emailVerified) {
        const userDocRef = doc(db, 'users', currentUser.uid);
        const userPath = `users/${currentUser.uid}`;
        try {
          const snap = await getDoc(userDocRef);
          const safeDisplayName = (currentUser.displayName || '校史典藏組').slice(0, 120);
          const safeEmail = (currentUser.email || '').slice(0, 160);
          if (!snap.exists()) {
            await setDoc(userDocRef, {
              uid: currentUser.uid,
              displayName: safeDisplayName,
              email: safeEmail,
              role: 'archivist',
              updatedAt: serverTimestamp(),
            });
          } else {
            await updateDoc(userDocRef, {
              displayName: safeDisplayName,
              email: safeEmail,
              updatedAt: serverTimestamp(),
            });
          }
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, userPath);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // Public exhibition stream (always accessible)
  useEffect(() => {
    const publicQuery = query(collection(db, 'awards'), where('isPublic', '==', true));
    const unsubscribe = onSnapshot(
      publicQuery,
      (snapshot) => {
        const items: AwardRecord[] = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<AwardRecord, 'id'>),
        }));
        setPublicAwards(items);
        setIsLoadingAwards(false);
      },
      (err) => {
        setIsLoadingAwards(false);
        handleFirestoreError(err, OperationType.LIST, 'awards');
      }
    );
    return () => unsubscribe();
  }, []);

  // Signed-in archivist / admin stream (includes private drafts)
  useEffect(() => {
    if (!authReady || !user || !user.emailVerified) {
      setPrivateAwards([]);
      return;
    }

    const q = isAdminUser
      ? query(collection(db, 'awards'))
      : query(collection(db, 'awards'), where('createdBy', '==', user.uid));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items: AwardRecord[] = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<AwardRecord, 'id'>),
        }));
        setPrivateAwards(items);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'awards');
      }
    );

    return () => unsubscribe();
  }, [authReady, user, isAdminUser]);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toastMessage) return;
    const t = window.setTimeout(() => setToastMessage(null), 5000);
    return () => window.clearTimeout(t);
  }, [toastMessage]);

  // Merge public & private records cleanly
  const allAccessibleAwards = useMemo(() => {
    const map = new Map<string, AwardRecord>();
    for (const item of publicAwards) map.set(item.id, item);
    for (const item of privateAwards) map.set(item.id, item);
    return Array.from(map.values()).sort((a, b) =>
      b.awardDate.localeCompare(a.awardDate)
    );
  }, [publicAwards, privateAwards]);

  const filteredAwards = useMemo(() => {
    const eraDef = ERA_DEFINITIONS.find((e) => e.key === eraFilter) || ERA_DEFINITIONS[0];
    const q = searchTerm.trim().toLowerCase();

    return allAccessibleAwards.filter((item) => {
      if (visibilityFilter === 'public' && !item.isPublic) return false;
      if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
      if (mediaFilter !== 'all' && item.mediaType !== mediaFilter) return false;
      if (eraFilter !== 'all') {
        if (item.awardYear < eraDef.min || item.awardYear > eraDef.max) return false;
      }
      if (q) {
        const haystack = `${item.title} ${item.recipientName} ${item.issuingBody} ${item.accessionNumber} ${item.notes}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [
    allAccessibleAwards,
    visibilityFilter,
    categoryFilter,
    mediaFilter,
    eraFilter,
    searchTerm,
  ]);

  const stats = useMemo(() => {
    const visibleSet = publicAwards;
    return {
      total: visibleSet.length,
      trophies: visibleSet.filter((i) => i.category === 'trophy').length,
      certificates: visibleSet.filter((i) => i.category === 'certificate').length,
      medals: visibleSet.filter((i) => i.category === 'medal').length,
      buildings: visibleSet.filter((i) => i.category === 'building').length,
    };
  }, [publicAwards]);

  const timelineGroups = useMemo(() => {
    return ERA_DEFINITIONS.filter((era) => era.key !== 'all').map((era) => ({
      ...era,
      items: publicAwards
        .filter((item) => item.awardYear >= era.min && item.awardYear <= era.max)
        .sort((a, b) => a.awardDate.localeCompare(b.awardDate)),
    }));
  }, [publicAwards]);

  const canManageAward = (award: AwardRecord) => {
    if (!user || !user.emailVerified) return false;
    return isAdminUser || award.createdBy === user.uid;
  };

  const handleDeleteAward = async (award: AwardRecord) => {
    const targetPath = `awards/${award.id}`;
    try {
      await deleteDoc(doc(db, 'awards', award.id));
      setToastMessage(`已從典藏館移除「${award.title}」。`);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, targetPath);
    }
  };

  const handleSeedSamples = async () => {
    if (!user || !user.emailVerified) return;
    setIsSeeding(true);
    try {
      for (const sample of HERITAGE_SAMPLES) {
        await addDoc(collection(db, 'awards'), {
          ...sample,
          createdBy: user.uid,
          createdByName: (user.displayName || user.email || '校史典藏組').slice(0, 120),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      setToastMessage('已成功匯入 5 件新生國小校史示範典藏物件。');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'awards');
    } finally {
      setIsSeeding(false);
    }
  };

  const handleSignIn = async () => {
    try {
      setIsSigningIn(true);
      await signInWithGoogle();
    } catch {
      setToastMessage('Google 登入已取消或未完成，請再試一次。');
    } finally {
      setIsSigningIn(false);
    }
  };

  const openNewCaptureStudio = () => {
    setEditingAward(null);
    setIsStudioOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#FBF9F5] text-[#1C1917] flex flex-col">
      {/* Strict 3-Zone Top Navigation Bar */}
      <header className="sticky top-0 z-30 bg-[#FBF9F5]/95 backdrop-blur-sm border-b border-stone-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-8">
          {/* Zone 1: Single-line Brand Wordmark with School Crest */}
          <a
            href="#exhibition"
            className="inline-flex items-center gap-2.5 text-lg md:text-xl font-serif font-bold tracking-tight text-[#1C1917] whitespace-nowrap shrink-0"
          >
            <SchoolCrest size={30} variant="compact" className="shrink-0" />
            <span>新生國小數位典藏館</span>
          </a>

          {/* Zone 2: 4 Clean Single-Line Nav Links */}
          <nav
            aria-label="主導覽列"
            className="hidden md:flex items-center gap-6 text-sm font-medium text-stone-600"
          >
            <a
              href="#exhibition"
              className="hover:text-[#1C1917] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              典藏展覽
            </a>
            <a
              href="#catalog"
              className="hover:text-[#1C1917] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              分類檢索
            </a>
            <a
              href="#timeline"
              className="hover:text-[#1C1917] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              榮譽編年
            </a>
            <a
              href="#about"
              className="hover:text-[#1C1917] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              關於典藏
            </a>
          </nav>

          {/* Zone 3: Single Primary Action */}
          <div className="shrink-0">
            <button
              type="button"
              onClick={openNewCaptureStudio}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-[#1C1917] text-[#FBF9F5] hover:bg-stone-800 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Camera className="w-4 h-4" />
              數位歸檔
            </button>
          </div>
        </div>
      </header>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-40 max-w-md bg-[#1C1917] text-[#FBF9F5] px-5 py-3.5 shadow-lg flex items-center gap-3 border border-stone-700">
          <CheckCircle2 className="w-4 h-4 text-amber-300 shrink-0" />
          <p className="text-sm">{toastMessage}</p>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            aria-label="關閉通知"
            className="text-stone-400 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <main className="flex-1">
        {/* Section 1: Institutional Exhibition Hero */}
        <section id="exhibition" className="border-b border-stone-200">
          <div className="max-w-7xl mx-auto px-6 py-12 lg:py-16">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch">
              {/* Editorial Masthead */}
              <div className="lg:col-span-6 flex flex-col justify-between py-2">
                <div>
                  <div className="flex items-center gap-4 mb-5">
                    <SchoolCrest size={68} variant="full" className="shrink-0" />
                    <div>
                      <p className="text-xs tracking-widest text-[#854D0E] font-medium">
                        宜蘭縣宜蘭市新生國民小學 · 創校於 1964 年（民國五十三年）
                      </p>
                      <p className="text-xs text-stone-500 mt-1">
                        校訓願景：永遠新生 · 積極健康 · 溫馨和諧 · 卓越創新 · 放眼天下
                      </p>
                    </div>
                  </div>
                  <h1 className="text-3xl sm:text-4xl lg:text-5xl font-serif font-bold text-[#1C1917] leading-[1.2] mb-6">
                    榮譽印記典藏：校史獎盃、獎狀、獎牌與歷史建築數位展示館
                  </h1>
                  <p className="text-base text-stone-600 leading-relaxed max-w-xl mb-8">
                    自 1964 年創校三十餘年來，新生國小師生累積無數榮耀與校園建築記憶。透過即時拍照與立體攝影建檔，記錄得獎人姓名、獲獎日期、獎項名稱及歷史建築風貌，將實體記憶轉化為永續公開的數位校史展覽。
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                  <button
                    type="button"
                    onClick={openNewCaptureStudio}
                    className="inline-flex items-center gap-2 px-6 py-3 text-sm font-medium bg-[#1C1917] text-[#FBF9F5] hover:bg-stone-800 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                    開始拍照攝影歸檔
                  </button>
                  <a
                    href="#catalog"
                    className="inline-flex items-center px-5 py-3 text-sm font-medium border border-stone-300 text-[#1C1917] hover:bg-stone-100 transition-colors whitespace-nowrap shrink-0"
                  >
                    瀏覽公開典藏名錄
                  </a>
                </div>
              </div>

              {/* Museum Exhibition Focal Photograph */}
              <div className="lg:col-span-6">
                <div className="h-full min-h-[280px] lg:min-h-[380px] bg-[#EFEAE0] border border-stone-200 overflow-hidden relative">
                  <img
                    src={HERITAGE_HERO_IMAGE}
                    alt="宜蘭市新生國民小學榮譽獎盃與校史獎狀數位典藏特展"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/35 to-transparent p-5">
                    <p className="text-xs font-serif italic text-stone-100">
                      特展主題 — 民國五十三年創校以來的每一座獎盃、獎狀與獎牌，都是世代學子的共同見證。
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Operational & Archival Metrics Utility Strip */}
            <div className="mt-10 pt-8 border-t border-stone-200 grid grid-cols-2 lg:grid-cols-4 gap-6">
              <div>
                <p className="text-xs text-stone-500 mb-1">創校沿革</p>
                <p className="text-lg font-serif font-bold text-[#1C1917] tabular-nums">
                  1964 年成立（民國 53 年）
                </p>
              </div>
              <div>
                <p className="text-xs text-stone-500 mb-1">公開典藏總件數</p>
                <p className="text-lg font-mono font-medium text-[#1C1917] tabular-nums">
                  {stats.total} 件
                </p>
              </div>
              <div>
                <p className="text-xs text-stone-500 mb-1">分類統計（獎盃 / 獎狀 / 獎牌 / 歷史建築）</p>
                <p className="text-lg font-mono font-medium text-[#1C1917] tabular-nums">
                  {stats.trophies} · {stats.certificates} · {stats.medals} · {stats.buildings}
                </p>
              </div>
              <div>
                <p className="text-xs text-stone-500 mb-1">展示館開放狀態</p>
                <p className="text-lg font-serif font-bold text-[#14532D]">
                  線上常設公開展覽
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Section 2: Multi-Faceted Archive Catalog */}
        <section id="catalog" className="py-14 lg:py-20 border-b border-stone-200">
          <div className="max-w-7xl mx-auto px-6">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
              <div>
                <p className="text-xs tracking-widest text-[#854D0E] font-medium mb-2">
                  公開典藏檢索系統
                </p>
                <h2 className="text-2xl lg:text-3xl font-serif font-bold text-[#1C1917]">
                  校史榮譽數位典藏名錄
                </h2>
              </div>

              {/* Search Input */}
              <div className="relative w-full md:w-80">
                <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="search"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="搜尋得獎人姓名、獎項名稱、編號..."
                  aria-label="搜尋典藏紀錄"
                  className="w-full pl-10 pr-4 py-2.5 text-sm bg-white border border-stone-300 text-[#1C1917] placeholder:text-stone-400 focus:outline-none focus:border-[#1C1917]"
                />
              </div>
            </div>

            {/* Interactive Filter Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-4 pb-8 mb-8 border-b border-stone-200">
              <div className="flex flex-wrap items-center gap-3">
                {/* Category Segmented Tabs */}
                <div className="flex items-center gap-1 p-1 bg-[#EFEAE0]">
                  {(
                    [
                      { key: 'all', label: '全部類別' },
                      { key: 'trophy', label: '獎盃' },
                      { key: 'certificate', label: '獎狀' },
                      { key: 'medal', label: '獎牌' },
                      { key: 'building', label: '歷史建築' },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setCategoryFilter(tab.key)}
                      className={`px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                        categoryFilter === tab.key
                          ? 'bg-[#FBF9F5] text-[#1C1917] shadow-sm'
                          : 'text-stone-600 hover:text-[#1C1917]'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Media Filter */}
                <div className="flex items-center gap-1 p-1 bg-[#EFEAE0]">
                  {(
                    [
                      { key: 'all', label: '全部媒材' },
                      { key: 'photo', label: '照片' },
                      { key: 'video', label: '攝影影片' },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setMediaFilter(tab.key)}
                      className={`px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                        mediaFilter === tab.key
                          ? 'bg-[#FBF9F5] text-[#1C1917] shadow-sm'
                          : 'text-stone-600 hover:text-[#1C1917]'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Era Select */}
                <select
                  aria-label="篩選時期"
                  value={eraFilter}
                  onChange={(e) => setEraFilter(e.target.value as EraKey)}
                  className="px-3 py-2 text-xs font-medium bg-white border border-stone-300 text-[#1C1917] focus:outline-none focus:border-[#1C1917] cursor-pointer"
                >
                  {ERA_DEFINITIONS.map((era) => (
                    <option key={era.key} value={era.key}>
                      {era.label}（{era.range}）
                    </option>
                  ))}
                </select>
              </div>

              {/* Signed-in archivist visibility switch */}
              {user && user.emailVerified && (
                <div className="flex items-center gap-1 p-1 bg-[#EFEAE0]">
                  <button
                    type="button"
                    onClick={() => setVisibilityFilter('public')}
                    className={`px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      visibilityFilter === 'public'
                        ? 'bg-[#FBF9F5] text-[#1C1917] shadow-sm'
                        : 'text-stone-600 hover:text-[#1C1917]'
                    }`}
                  >
                    公開展示中
                  </button>
                  <button
                    type="button"
                    onClick={() => setVisibilityFilter('all')}
                    className={`px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      visibilityFilter === 'all'
                        ? 'bg-[#FBF9F5] text-[#1C1917] shadow-sm'
                        : 'text-stone-600 hover:text-[#1C1917]'
                    }`}
                  >
                    含我的典藏草稿
                  </button>
                </div>
              )}
            </div>

            {/* Catalog Grid */}
            {isLoadingAwards ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {[1, 2, 3].map((idx) => (
                  <div key={idx} className="border border-stone-200 bg-white p-4">
                    <div className="aspect-[4/3] bg-stone-200 mb-4" />
                    <div className="h-4 bg-stone-200 w-1/3 mb-3" />
                    <div className="h-6 bg-stone-200 w-5/6 mb-2" />
                    <div className="h-4 bg-stone-200 w-1/2" />
                  </div>
                ))}
              </div>
            ) : filteredAwards.length === 0 ? (
              <div className="border border-stone-200 bg-white p-10 md:p-16 text-center max-w-2xl mx-auto">
                <p className="text-xs font-mono tracking-widest text-stone-400 mb-3">
                  ARCHIVE CATALOG
                </p>
                <h3 className="text-xl font-serif font-bold text-[#1C1917] mb-3">
                  {allAccessibleAwards.length === 0
                    ? '典藏庫目前尚未登錄任何實體獎項'
                    : '沒有符合目前篩選條件的典藏紀錄'}
                </h3>
                <p className="text-sm text-stone-600 leading-relaxed mb-6">
                  {allAccessibleAwards.length === 0
                    ? '點擊上方「數位歸檔」即可拍攝或錄影上傳第一座獎盃、獎狀或獎牌；若您已登入管理帳號，亦可先匯入校史示範典藏以預覽展覽成效。'
                    : '請嘗試清除關鍵字或調整年份與類別篩選條件。'}
                </p>
                <div className="flex flex-wrap items-center justify-center gap-3">
                  {allAccessibleAwards.length === 0 && user && user.emailVerified && (
                    <button
                      type="button"
                      disabled={isSeeding}
                      onClick={handleSeedSamples}
                      className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium border border-stone-300 bg-[#FBF9F5] text-[#1C1917] hover:bg-stone-100 disabled:opacity-50 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <Sparkles className="w-4 h-4 text-[#854D0E]" />
                      {isSeeding ? '匯入中...' : '匯入校史示範典藏（5 件）'}
                    </button>
                  )}
                  {allAccessibleAwards.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchTerm('');
                        setCategoryFilter('all');
                        setMediaFilter('all');
                        setEraFilter('all');
                      }}
                      className="px-5 py-2.5 text-sm font-medium border border-stone-300 text-[#1C1917] hover:bg-stone-100 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                    >
                      重設所有篩選條件
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={openNewCaptureStudio}
                    className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium bg-[#1C1917] text-[#FBF9F5] hover:bg-stone-800 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <Camera className="w-4 h-4" />
                    新增拍照攝影歸檔
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {filteredAwards.map((award) => (
                  <article
                    key={award.id}
                    className="bg-white border border-stone-200 hover:border-stone-400 transition-colors flex flex-col justify-between group"
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedAward(award)}
                      className="text-left w-full cursor-pointer flex-1 flex flex-col"
                    >
                      <div className="border-b border-stone-200 overflow-hidden">
                        <MediaViewer
                          mediaUrl={award.mediaUrl}
                          mediaType={award.mediaType}
                          category={award.category}
                          title={award.title}
                          aspectClass="aspect-[4/3]"
                          interactiveVideo={false}
                        />
                      </div>

                      <div className="p-5 flex-1 flex flex-col justify-between">
                        <div>
                          {/* Zero-Pill Unboxed Metadata Line */}
                          <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500 mb-2.5">
                            <span className="font-medium text-[#854D0E]">
                              {CATEGORY_LABELS[award.category]}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono tabular-nums">
                              {formatDisplayDate(award.awardDate)}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>{MEDIA_TYPE_LABELS[award.mediaType]}</span>
                            {!award.isPublic && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="text-stone-700 font-medium">內部草稿</span>
                              </>
                            )}
                          </div>

                          <h3 className="text-lg font-serif font-bold text-[#1C1917] leading-snug group-hover:text-[#854D0E] transition-colors mb-3 line-clamp-2">
                            {award.title}
                          </h3>
                        </div>

                        <div className="pt-3 border-t border-stone-100 flex items-center justify-between text-xs text-stone-600 gap-2">
                          <span className="truncate">
                            {award.category === 'building' ? '建築位置：' : '得獎人：'}
                            <strong className="font-medium text-[#1C1917]">{award.recipientName}</strong>
                          </span>
                          <span className="font-mono tabular-nums text-stone-400 shrink-0">
                            {award.accessionNumber}
                          </span>
                        </div>
                      </div>
                    </button>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Section 3: Chronological Honor Timeline */}
        <section id="timeline" className="py-14 lg:py-20 bg-[#F4EFE6] border-b border-stone-200">
          <div className="max-w-7xl mx-auto px-6">
            <div className="max-w-2xl mb-10">
              <p className="text-xs tracking-widest text-[#854D0E] font-medium mb-2">
                1964 年創校榮譽脈絡
              </p>
              <h2 className="text-2xl lg:text-3xl font-serif font-bold text-[#1C1917] mb-3">
                校史榮譽編年紀事
              </h2>
              <p className="text-sm text-stone-600 leading-relaxed">
                依獲獎年代劃分四個校史時期，將散落於校史室與各處室的獎盃、獎狀及獎牌串聯成清晰的時間軸。
              </p>
            </div>

            <div className="space-y-8">
              {timelineGroups.map((group, idx) => (
                <div
                  key={group.key}
                  className="border-t border-stone-300 pt-6 grid grid-cols-1 lg:grid-cols-12 gap-6"
                >
                  <div className="lg:col-span-4">
                    <p className="text-xs font-mono text-stone-500 mb-1">
                      0{idx + 1}. {group.range}
                    </p>
                    <h3 className="text-xl font-serif font-bold text-[#1C1917]">
                      {group.label}
                    </h3>
                    <p className="text-xs text-stone-500 mt-1 tabular-nums">
                      已公開收錄 {group.items.length} 件
                    </p>
                  </div>

                  <div className="lg:col-span-8">
                    {group.items.length === 0 ? (
                      <p className="text-sm text-stone-500 py-2">
                        此時期尚待進一步清點與數位拍攝歸檔。
                      </p>
                    ) : (
                      <ul className="divide-y divide-stone-300/70">
                        {group.items.map((item) => (
                          <li key={item.id}>
                            <button
                              type="button"
                              onClick={() => setSelectedAward(item)}
                              className="w-full py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-left hover:bg-[#FBF9F5]/70 px-2 -mx-2 transition-colors cursor-pointer"
                            >
                              <div className="flex items-baseline gap-4 min-w-0">
                                <span className="text-xs font-mono tabular-nums text-stone-500 shrink-0">
                                  {formatDisplayDate(item.awardDate)}
                                </span>
                                <span className="text-sm font-medium text-[#1C1917] truncate">
                                  {item.title}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 text-xs text-stone-600 shrink-0">
                                <span>{item.recipientName}</span>
                                <span aria-hidden="true">·</span>
                                <span className="text-[#854D0E]">
                                  {CATEGORY_LABELS[item.category]}
                                </span>
                                {item.mediaType === 'video' && (
                                  <Film className="w-3.5 h-3.5 text-stone-500" />
                                )}
                              </div>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Section 4: About & Archivist Studio Access */}
        <section id="about" className="py-14 lg:py-20">
          <div className="max-w-7xl mx-auto px-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
              <div className="lg:col-span-7">
                <p className="text-xs tracking-widest text-[#854D0E] font-medium mb-2">
                  數位化典藏作業規範
                </p>
                <h2 className="text-2xl lg:text-3xl font-serif font-bold text-[#1C1917] mb-6">
                  保存校史記憶的三步驟
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 border-t border-stone-200 pt-6">
                  <div>
                    <p className="text-xs font-mono text-stone-500 mb-2">01. 光影取景</p>
                    <h3 className="text-base font-serif font-bold text-[#1C1917] mb-2">
                      拍照與立體攝影
                    </h3>
                    <p className="text-sm text-stone-600 leading-relaxed">
                      紙本獎狀建議平放並採正面拍照；立體獎盃與獎牌可使用動態攝影環繞錄製銘牌細節。
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-mono text-stone-500 mb-2">02. 校史編目</p>
                    <h3 className="text-base font-serif font-bold text-[#1C1917] mb-2">
                      登錄關鍵資訊
                    </h3>
                    <p className="text-sm text-stone-600 leading-relaxed">
                      完整輸入得獎人姓名、獲獎日期（自動對照民國年份）、獎項名稱及頒獎單位。
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-mono text-stone-500 mb-2">03. 公開展示</p>
                    <h3 className="text-base font-serif font-bold text-[#1C1917] mb-2">
                      永續線上展覽
                    </h3>
                    <p className="text-sm text-stone-600 leading-relaxed">
                      歸檔完成後即時發布至全校與校友公開展示廳，供歷屆師生、家長線上檢索與回顧。
                    </p>
                  </div>
                </div>
              </div>

              {/* Archivist Account Card */}
              <div className="lg:col-span-5 bg-white border border-stone-200 p-6 md:p-8">
                <p className="text-xs tracking-widest text-stone-500 font-medium mb-2">
                  典藏工作人員帳號
                </p>
                {user ? (
                  <div>
                    <h3 className="text-xl font-serif font-bold text-[#1C1917] mb-1">
                      {user.displayName || '校方典藏人員'}
                    </h3>
                    <p className="text-xs font-mono text-stone-500 mb-4">
                      {user.email} · {isAdminUser ? '館藏總管理員' : '已驗證歸檔人員'}
                    </p>
                    <p className="text-sm text-stone-600 leading-relaxed mb-6">
                      您已登入典藏系統，可隨時使用拍照攝影歸檔工具新增物件、編輯歷史資料或管理公開展示狀態。
                    </p>
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={openNewCaptureStudio}
                        className="px-4 py-2 text-sm font-medium bg-[#1C1917] text-[#FBF9F5] hover:bg-stone-800 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                      >
                        開啟歸檔工作坊
                      </button>
                      <button
                        type="button"
                        onClick={() => signOutUser()}
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium border border-stone-300 text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                      >
                        <LogOut className="w-4 h-4" />
                        登出帳號
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <h3 className="text-xl font-serif font-bold text-[#1C1917] mb-2">
                      校方師長與典藏志工登入
                    </h3>
                    <p className="text-sm text-stone-600 leading-relaxed mb-6">
                      公開展覽無需登入即可自由瀏覽。若需拍照、錄影並將新發現的獎盃、獎狀或獎牌登錄至系統，請登入您的 Google 帳號。
                    </p>
                    <button
                      type="button"
                      disabled={isSigningIn}
                      onClick={handleSignIn}
                      className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium bg-[#1C1917] text-[#FBF9F5] hover:bg-stone-800 disabled:opacity-50 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <LogIn className="w-4 h-4" />
                      {isSigningIn ? '登入中...' : 'Google 帳號登入'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Clean Institutional Footer */}
      <footer className="border-t border-stone-200 bg-[#F4EFE6]">
        <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-stone-600">
          <div className="flex items-center gap-3">
            <SchoolCrest size={36} variant="compact" className="shrink-0" />
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-serif font-bold text-sm text-[#1C1917]">
                宜蘭縣宜蘭市新生國民小學數位典藏館
              </span>
              <span aria-hidden="true">·</span>
              <span>創校於 1964 年</span>
              <span aria-hidden="true">·</span>
              <span>校史獎盃、獎狀、獎牌與歷史建築公開展示平台</span>
            </div>
          </div>
          <div className="flex items-center gap-5">
            <a href="#exhibition" className="hover:text-[#1C1917] transition-colors">
              回到頂端
            </a>
            <a href="#catalog" className="hover:text-[#1C1917] transition-colors">
              典藏檢索
            </a>
            <button
              type="button"
              onClick={openNewCaptureStudio}
              className="hover:text-[#1C1917] underline underline-offset-4 cursor-pointer"
            >
              數位歸檔
            </button>
          </div>
        </div>
      </footer>

      {/* Modals */}
      {selectedAward && (
        <AccessionDetailModal
          award={selectedAward}
          canManage={canManageAward(selectedAward)}
          onClose={() => setSelectedAward(null)}
          onEdit={(award) => {
            setSelectedAward(null);
            setEditingAward(award);
            setIsStudioOpen(true);
          }}
          onDelete={handleDeleteAward}
        />
      )}

      {isStudioOpen && (
        <CaptureStudioModal
          user={user}
          editingAward={editingAward}
          onClose={() => {
            setIsStudioOpen(false);
            setEditingAward(null);
          }}
          onSaved={(msg) => setToastMessage(msg)}
        />
      )}
    </div>
  );
}
