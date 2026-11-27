import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  Video,
  Upload,
  X,
  RotateCcw,
  RefreshCw,
  Square,
  Circle,
  CheckCircle2,
  LogIn,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, signInWithGoogle } from '../firebase';
import {
  ARCHIVE_LIMITS,
  CATEGORY_LABELS,
  formatRocDate,
  generateAccessionNumber,
  type AwardCategory,
  type AwardRecord,
  type MediaType,
} from '../types/archive';

interface CaptureStudioModalProps {
  user: User | null;
  editingAward: AwardRecord | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}

type CaptureMode = 'photo' | 'video' | 'upload';

export const CaptureStudioModal: React.FC<CaptureStudioModalProps> = ({
  user,
  editingAward,
  onClose,
  onSaved,
}) => {
  const [captureMode, setCaptureMode] = useState<CaptureMode>('photo');
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isStreamActive, setIsStreamActive] = useState(false);

  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);

  // Captured / selected media state
  const [pendingBlob, setPendingBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>(editingAward?.mediaUrl || '');
  const [mediaType, setMediaType] = useState<MediaType>(editingAward?.mediaType || 'photo');

  // Form fields
  const [category, setCategory] = useState<AwardCategory>(editingAward?.category || 'trophy');
  const [title, setTitle] = useState(editingAward?.title || '');
  const [recipientName, setRecipientName] = useState(editingAward?.recipientName || '');
  const [awardDate, setAwardDate] = useState(
    editingAward?.awardDate || new Date().toISOString().slice(0, 10)
  );
  const [issuingBody, setIssuingBody] = useState(editingAward?.issuingBody || '');
  const [notes, setNotes] = useState(editingAward?.notes || '');
  const [isPublic, setIsPublic] = useState(editingAward ? editingAward.isPublic : true);

  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const stopCameraStream = () => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsStreamActive(false);
    setIsRecording(false);
  };

  const startCameraStream = async (withAudio: boolean) => {
    stopCameraStream();
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: withAudio,
      });
      streamRef.current = stream;
      setIsStreamActive(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch {
      setCameraError(
        '無法啟動裝置鏡頭（可能未授權相機權限或環境不支援），您可以切換為「上傳檔案」選擇現有照片或影片。'
      );
    }
  };

  useEffect(() => {
    if (user && !previewUrl && (captureMode === 'photo' || captureMode === 'video')) {
      startCameraStream(captureMode === 'video');
    } else {
      stopCameraStream();
    }
    return () => {
      stopCameraStream();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, captureMode, facingMode, previewUrl]);

  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleCapturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, width, height);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        if (previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
        const objectUrl = URL.createObjectURL(blob);
        setPendingBlob(blob);
        setPreviewUrl(objectUrl);
        setMediaType('photo');
        stopCameraStream();
      },
      'image/jpeg',
      0.92
    );
  };

  const handleStartRecording = () => {
    if (!streamRef.current) return;
    chunksRef.current = [];
    setRecordSeconds(0);

    const preferredMimes = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
      'video/mp4',
    ];
    const mimeType = preferredMimes.find((m) => MediaRecorder.isTypeSupported(m));
    const recorder = mimeType
      ? new MediaRecorder(streamRef.current, { mimeType })
      : new MediaRecorder(streamRef.current);

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      const finalMime = recorder.mimeType || 'video/webm';
      const blob = new Blob(chunksRef.current, { type: finalMime });
      if (previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
      const objectUrl = URL.createObjectURL(blob);
      setPendingBlob(blob);
      setPreviewUrl(objectUrl);
      setMediaType('video');
      stopCameraStream();
    };

    mediaRecorderRef.current = recorder;
    recorder.start(250);
    setIsRecording(true);
    timerRef.current = window.setInterval(() => {
      setRecordSeconds((s) => s + 1);
    }, 1000);
  };

  const handleStopRecording = () => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const handleFileSelect = (file: File | undefined) => {
    if (!file) return;
    setFormError(null);
    const isVideo = file.type.startsWith('video/');
    const isImage = file.type.startsWith('image/');
    if (!isVideo && !isImage) {
      setFormError('請選擇有效的照片（JPG / PNG / WebP）或影片（MP4 / WebM / MOV）檔案。');
      return;
    }
    if (file.size > 100 * 1024 * 1024) {
      setFormError('檔案大小不可超過 100MB。');
      return;
    }
    if (previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
    const objectUrl = URL.createObjectURL(file);
    setPendingBlob(file);
    setPreviewUrl(objectUrl);
    setMediaType(isVideo ? 'video' : 'photo');
  };

  const handleRetake = () => {
    if (previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
    setPendingBlob(null);
    setPreviewUrl('');
  };

  const formatTimer = (sec: number) => {
    const mins = String(Math.floor(sec / 60)).padStart(2, '0');
    const rem = String(sec % 60).padStart(2, '0');
    return `${mins}:${rem}`;
  };

  const handleGoogleLogin = async () => {
    try {
      setIsSigningIn(true);
      setFormError(null);
      await signInWithGoogle();
    } catch {
      setFormError('Google 登入未完成，請再試一次。');
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setFormError('請先登入校方典藏帳號後再儲存歸檔。');
      return;
    }

    const trimmedTitle = title.trim();
    const trimmedRecipient = recipientName.trim();
    const trimmedIssuing = issuingBody.trim();
    const trimmedNotes = notes.trim();

    if (!previewUrl && !pendingBlob) {
      setFormError('請先為獎盃、獎狀或獎牌拍照、攝影或上傳影像檔案。');
      return;
    }
    if (!trimmedTitle || trimmedTitle.length > ARCHIVE_LIMITS.MAX_TITLE_LENGTH) {
      setFormError(`請輸入獎項名稱（1 至 ${ARCHIVE_LIMITS.MAX_TITLE_LENGTH} 字）。`);
      return;
    }
    if (!trimmedRecipient || trimmedRecipient.length > ARCHIVE_LIMITS.MAX_RECIPIENT_LENGTH) {
      setFormError(`請輸入得獎人姓名（1 至 ${ARCHIVE_LIMITS.MAX_RECIPIENT_LENGTH} 字）。`);
      return;
    }
    if (!ARCHIVE_LIMITS.DATE_PATTERN.test(awardDate)) {
      setFormError('獲獎日期格式需為 YYYY-MM-DD。');
      return;
    }
    const awardYear = Number(awardDate.slice(0, 4));
    if (awardYear < ARCHIVE_LIMITS.MIN_YEAR || awardYear > ARCHIVE_LIMITS.MAX_YEAR) {
      setFormError(`獲獎年份須介於 ${ARCHIVE_LIMITS.MIN_YEAR}（創校年）至 ${ARCHIVE_LIMITS.MAX_YEAR} 年之間。`);
      return;
    }
    if (trimmedIssuing.length > ARCHIVE_LIMITS.MAX_ISSUING_LENGTH) {
      setFormError(`頒獎單位不可超過 ${ARCHIVE_LIMITS.MAX_ISSUING_LENGTH} 字。`);
      return;
    }
    if (trimmedNotes.length > ARCHIVE_LIMITS.MAX_NOTES_LENGTH) {
      setFormError(`典藏備註不可超過 ${ARCHIVE_LIMITS.MAX_NOTES_LENGTH} 字。`);
      return;
    }

    setFormError(null);
    setIsSubmitting(true);

    try {
      let finalMediaUrl = previewUrl;
      let finalMediaType: MediaType = mediaType;

      if (pendingBlob) {
        const formData = new FormData();
        const ext = pendingBlob.type.includes('video')
          ? pendingBlob.type.includes('mp4')
            ? 'mp4'
            : 'webm'
          : 'jpg';
        formData.append('media', pendingBlob, `capture.${ext}`);

        const uploadResp = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });
        if (!uploadResp.ok) {
          const errJson = await uploadResp.json().catch(() => ({}));
          throw new Error(errJson.error || '影像上傳伺服器失敗');
        }
        const uploaded = await uploadResp.json();
        finalMediaUrl = uploaded.url;
        finalMediaType = uploaded.mediaType === 'video' ? 'video' : 'photo';
      }

      if (finalMediaUrl.length > ARCHIVE_LIMITS.MAX_MEDIA_URL_LENGTH) {
        throw new Error('影像路徑長度超出規範上限。');
      }

      if (editingAward) {
        const targetPath = `awards/${editingAward.id}`;
        try {
          await updateDoc(doc(db, 'awards', editingAward.id), {
            title: trimmedTitle,
            recipientName: trimmedRecipient,
            awardDate,
            awardYear,
            category,
            mediaType: finalMediaType,
            mediaUrl: finalMediaUrl,
            issuingBody: trimmedIssuing,
            notes: trimmedNotes,
            isPublic,
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, targetPath);
        }
        onSaved('典藏紀錄已更新並同步至展示廳。');
      } else {
        const accessionNumber = generateAccessionNumber(awardYear);
        const targetPath = 'awards';
        try {
          await addDoc(collection(db, 'awards'), {
            title: trimmedTitle,
            recipientName: trimmedRecipient,
            awardDate,
            awardYear,
            category,
            mediaType: finalMediaType,
            mediaUrl: finalMediaUrl,
            accessionNumber,
            issuingBody: trimmedIssuing,
            notes: trimmedNotes,
            isPublic,
            createdBy: user.uid,
            createdByName: (user.displayName || user.email || '校史典藏組').slice(0, 120),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, targetPath);
        }
        onSaved(`已成功歸檔「${trimmedTitle}」（編號 ${accessionNumber}）。`);
      }

      stopCameraStream();
      onClose();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : '儲存失敗，請稍後再試。');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#1C1917]/75 backdrop-blur-[2px] flex items-center justify-center p-4 md:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="studio-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          stopCameraStream();
          onClose();
        }
      }}
    >
      <div className="bg-[#FBF9F5] border border-stone-300 w-full max-w-5xl max-h-[94vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200 bg-[#FBF9F5] sticky top-0 z-10">
          <div>
            <p className="text-xs tracking-widest text-[#854D0E] font-medium">
              {editingAward ? '編輯典藏物件' : '數位拍照攝影歸檔工作坊'}
            </p>
            <h2 id="studio-modal-title" className="text-xl font-serif font-bold text-[#1C1917]">
              {editingAward ? editingAward.title : '新增獎盃、獎狀、獎牌或歷史建築數位典藏'}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => {
              stopCameraStream();
              onClose();
            }}
            aria-label="關閉工作坊"
            className="p-2 text-stone-600 hover:text-[#1C1917] hover:bg-stone-200/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {!user ? (
          <div className="p-8 md:p-14 text-center max-w-lg mx-auto">
            <p className="text-xs font-mono tracking-widest text-stone-500 mb-3">
              ARCHIVIST AUTHENTICATION
            </p>
            <h3 className="text-2xl font-serif font-bold text-[#1C1917] mb-3">
              登入校方典藏帳號以進行歸檔
            </h3>
            <p className="text-sm text-stone-600 leading-relaxed mb-8">
              為確保新生國小校史獎項紀錄的真實性與保存完整性，請使用您的 Google 帳號登入後，即可啟用相機拍照、攝影錄影及登錄編目功能。
            </p>
            {formError && (
              <p className="text-sm text-red-800 bg-red-50 border border-red-200 px-4 py-2.5 mb-5">
                {formError}
              </p>
            )}
            <button
              type="button"
              disabled={isSigningIn}
              onClick={handleGoogleLogin}
              className="inline-flex items-center justify-center gap-2.5 px-6 py-3 text-sm font-medium bg-[#1C1917] text-[#FBF9F5] hover:bg-stone-800 disabled:opacity-50 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <LogIn className="w-4 h-4" />
              {isSigningIn ? '登入驗證中...' : '使用 Google 帳號登入並開始歸檔'}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12">
            {/* Left: Camera / Video / Upload Workbench */}
            <div className="lg:col-span-6 p-6 bg-[#F2EDE4] border-b lg:border-b-0 lg:border-r border-stone-200 flex flex-col justify-between gap-4">
              <div>
                {/* Segmented Mode Control */}
                <div className="flex items-center gap-1 p-1 bg-stone-200/80 mb-4">
                  <button
                    type="button"
                    onClick={() => {
                      handleRetake();
                      setCaptureMode('photo');
                    }}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      captureMode === 'photo'
                        ? 'bg-[#FBF9F5] text-[#1C1917] shadow-sm'
                        : 'text-stone-600 hover:text-[#1C1917]'
                    }`}
                  >
                    <Camera className="w-3.5 h-3.5" />
                    即時拍照
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleRetake();
                      setCaptureMode('video');
                    }}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      captureMode === 'video'
                        ? 'bg-[#FBF9F5] text-[#1C1917] shadow-sm'
                        : 'text-stone-600 hover:text-[#1C1917]'
                    }`}
                  >
                    <Video className="w-3.5 h-3.5" />
                    即時攝影
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      stopCameraStream();
                      setCaptureMode('upload');
                    }}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      captureMode === 'upload'
                        ? 'bg-[#FBF9F5] text-[#1C1917] shadow-sm'
                        : 'text-stone-600 hover:text-[#1C1917]'
                    }`}
                  >
                    <Upload className="w-3.5 h-3.5" />
                    上傳檔案
                  </button>
                </div>

                {/* Viewport Container */}
                <div className="aspect-[4/3] w-full bg-[#1C1917] relative overflow-hidden border border-stone-300 flex items-center justify-center">
                  {previewUrl ? (
                    mediaType === 'video' ? (
                      <video
                        src={previewUrl}
                        controls
                        playsInline
                        className="w-full h-full object-contain bg-[#1C1917]"
                      />
                    ) : (
                      <img
                        src={previewUrl}
                        alt="待歸檔物件預覽"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-contain bg-[#1C1917]"
                      />
                    )
                  ) : captureMode === 'upload' ? (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full h-full bg-[#FBF9F5] flex flex-col items-center justify-center p-6 text-center cursor-pointer hover:bg-stone-100 transition-colors"
                    >
                      <Upload className="w-8 h-8 text-stone-400 mb-3" strokeWidth={1.5} />
                      <p className="text-sm font-medium text-[#1C1917] mb-1">
                        點擊選擇照片或攝影影片
                      </p>
                      <p className="text-xs text-stone-500">
                        支援 JPG、PNG、WebP 照片或 MP4、WebM、MOV 影片（上限 100MB）
                      </p>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime"
                        className="hidden"
                        onChange={(e) => handleFileSelect(e.target.files?.[0])}
                      />
                    </div>
                  ) : cameraError ? (
                    <div className="p-6 text-center text-stone-200 max-w-sm">
                      <p className="text-sm leading-relaxed mb-4">{cameraError}</p>
                      <button
                        type="button"
                        onClick={() => setCaptureMode('upload')}
                        className="px-4 py-2 text-xs font-medium bg-[#FBF9F5] text-[#1C1917] cursor-pointer"
                      >
                        切換為檔案上傳
                      </button>
                    </div>
                  ) : (
                    <>
                      <video
                        ref={videoRef}
                        autoPlay
                        muted
                        playsInline
                        className="w-full h-full object-cover"
                      />
                      {/* Subtle viewfinder framing corner guides */}
                      <div className="pointer-events-none absolute inset-6 border border-white/25" />
                      {isRecording && (
                        <div className="absolute top-3 left-3 px-2.5 py-1 bg-red-800/90 text-white text-xs font-mono tabular-nums">
                          REC {formatTimer(recordSeconds)}
                        </div>
                      )}
                    </>
                  )}
                  <canvas ref={canvasRef} className="hidden" />
                </div>
              </div>

              {/* Camera / Preview Action Controls */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                {previewUrl ? (
                  <>
                    <span className="inline-flex items-center gap-1.5 text-xs text-stone-700 font-medium">
                      <CheckCircle2 className="w-4 h-4 text-[#14532D]" />
                      {mediaType === 'video' ? '已完成攝影紀錄，可右側填寫資料歸檔' : '已擷取影像，可右側填寫資料歸檔'}
                    </span>
                    <button
                      type="button"
                      onClick={handleRetake}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium border border-stone-300 bg-[#FBF9F5] text-[#1C1917] hover:bg-stone-100 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      重新拍攝 / 更換影像
                    </button>
                  </>
                ) : captureMode === 'upload' ? (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full px-4 py-2.5 text-xs font-medium bg-[#1C1917] text-[#FBF9F5] hover:bg-stone-800 transition-colors cursor-pointer"
                  >
                    從裝置選取照片或影片
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      disabled={!isStreamActive || isRecording}
                      onClick={() =>
                        setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'))
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-stone-300 bg-[#FBF9F5] text-[#1C1917] hover:bg-stone-100 disabled:opacity-50 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      切換鏡頭
                    </button>

                    {captureMode === 'photo' ? (
                      <button
                        type="button"
                        disabled={!isStreamActive}
                        onClick={handleCapturePhoto}
                        className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-medium bg-[#1C1917] text-[#FBF9F5] hover:bg-stone-800 disabled:opacity-50 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                      >
                        <Camera className="w-4 h-4" />
                        拍攝典藏照片
                      </button>
                    ) : isRecording ? (
                      <button
                        type="button"
                        onClick={handleStopRecording}
                        className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-medium bg-red-800 text-white hover:bg-red-900 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                      >
                        <Square className="w-3.5 h-3.5 fill-current" />
                        停止攝影（{formatTimer(recordSeconds)}）
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={!isStreamActive}
                        onClick={handleStartRecording}
                        className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-medium bg-[#854D0E] text-white hover:bg-[#713F12] disabled:opacity-50 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                      >
                        <Circle className="w-3.5 h-3.5 fill-current" />
                        開始攝影錄影
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Right: Cataloging Metadata Form */}
            <div className="lg:col-span-6 p-6 space-y-5">
              <div>
                <span className="block text-xs font-medium text-stone-700 mb-2">
                  物件類別 <span className="text-red-800">*</span>
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(['trophy', 'certificate', 'medal', 'building'] as const).map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategory(cat)}
                      className={`py-2 px-3 text-sm font-medium border transition-colors cursor-pointer whitespace-nowrap ${
                        category === cat
                          ? 'bg-[#1C1917] text-[#FBF9F5] border-[#1C1917]'
                          : 'bg-white text-stone-700 border-stone-300 hover:border-stone-500'
                      }`}
                    >
                      {CATEGORY_LABELS[cat]}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label
                  htmlFor="award-title-input"
                  className="block text-xs font-medium text-stone-700 mb-1.5"
                >
                  {category === 'building' ? '建築或遺構名稱' : '獎項名稱'}{' '}
                  <span className="text-red-800">*</span>
                </label>
                <input
                  id="award-title-input"
                  type="text"
                  required
                  maxLength={ARCHIVE_LIMITS.MAX_TITLE_LENGTH}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={
                    category === 'building'
                      ? '例如：創校初期紅磚拱廊校舍、舊禮堂正門'
                      : '例如：宜蘭縣全縣國語文競賽朗讀組第一名'
                  }
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-stone-300 text-[#1C1917] focus:outline-none focus:border-[#1C1917]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="recipient-name-input"
                    className="block text-xs font-medium text-stone-700 mb-1.5"
                  >
                    {category === 'building' ? '建築位置 / 保存者' : '得獎人姓名'}{' '}
                    <span className="text-red-800">*</span>
                  </label>
                  <input
                    id="recipient-name-input"
                    type="text"
                    required
                    maxLength={ARCHIVE_LIMITS.MAX_RECIPIENT_LENGTH}
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    placeholder={
                      category === 'building'
                        ? '例如：校園北側舊校舍區'
                        : '學生、教師或校隊名稱'
                    }
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-stone-300 text-[#1C1917] focus:outline-none focus:border-[#1C1917]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="award-date-input"
                    className="block text-xs font-medium text-stone-700 mb-1.5"
                  >
                    {category === 'building' ? '落成 / 登錄日期' : '獲獎日期'}{' '}
                    <span className="text-red-800">*</span>
                  </label>
                  <input
                    id="award-date-input"
                    type="date"
                    required
                    min="1964-01-01"
                    max="2100-12-31"
                    value={awardDate}
                    onChange={(e) => setAwardDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm font-mono tabular-nums bg-white border border-stone-300 text-[#1C1917] focus:outline-none focus:border-[#1C1917]"
                  />
                  {ARCHIVE_LIMITS.DATE_PATTERN.test(awardDate) && (
                    <p className="text-xs text-stone-500 mt-1">
                      對照：{formatRocDate(awardDate)}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label
                  htmlFor="issuing-body-input"
                  className="block text-xs font-medium text-stone-700 mb-1.5"
                >
                  {category === 'building' ? '興建 / 登錄單位（選填）' : '頒獎單位（選填）'}
                </label>
                <input
                  id="issuing-body-input"
                  type="text"
                  maxLength={ARCHIVE_LIMITS.MAX_ISSUING_LENGTH}
                  value={issuingBody}
                  onChange={(e) => setIssuingBody(e.target.value)}
                  placeholder={
                    category === 'building'
                      ? '例如：宜蘭縣政府教育科、本校校史保存委員會'
                      : '例如：宜蘭縣政府、中華民國田徑協會'
                  }
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-stone-300 text-[#1C1917] focus:outline-none focus:border-[#1C1917]"
                />
              </div>

              <div>
                <label
                  htmlFor="notes-input"
                  className="block text-xs font-medium text-stone-700 mb-1.5"
                >
                  典藏說明與保存紀錄（選填）
                </label>
                <textarea
                  id="notes-input"
                  rows={3}
                  maxLength={ARCHIVE_LIMITS.MAX_NOTES_LENGTH}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={
                    category === 'building'
                      ? '紀錄建築材質、磚瓦結構、修繕沿革或校園歷史意義...'
                      : '紀錄材質、尺寸、銘牌文字或獲獎背景故事...'
                  }
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-stone-300 text-[#1C1917] focus:outline-none focus:border-[#1C1917]"
                />
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-stone-200">
                <label className="inline-flex items-center gap-2.5 cursor-pointer text-sm text-[#1C1917]">
                  <input
                    type="checkbox"
                    checked={isPublic}
                    onChange={(e) => setIsPublic(e.target.checked)}
                    className="w-4 h-4 accent-[#1C1917]"
                  />
                  <span>立即公開於校園展示廳</span>
                </label>
                <span className="text-xs text-stone-500">
                  {isPublic ? '全體訪客可瀏覽' : '僅建檔者與管理員可見'}
                </span>
              </div>

              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 text-xs text-red-800 leading-relaxed">
                  {formError}
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => {
                    stopCameraStream();
                    onClose();
                  }}
                  className="px-4 py-2.5 text-sm font-medium text-stone-600 hover:text-[#1C1917] cursor-pointer whitespace-nowrap shrink-0"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 text-sm font-medium bg-[#1C1917] text-[#FBF9F5] hover:bg-stone-800 disabled:opacity-50 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  {isSubmitting
                    ? '上傳並歸檔中...'
                    : editingAward
                    ? '儲存更新'
                    : '完成數位歸檔'}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
