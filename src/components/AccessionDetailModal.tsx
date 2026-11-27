import React, { useState } from 'react';
import { X, Pencil, Trash2, Check } from 'lucide-react';
import {
  CATEGORY_LABELS,
  MEDIA_TYPE_LABELS,
  formatDisplayDate,
  formatRocDate,
  type AwardRecord,
} from '../types/archive';
import { MediaViewer } from './MediaViewer';
import { SchoolCrest } from './SchoolCrest';

interface AccessionDetailModalProps {
  award: AwardRecord;
  canManage: boolean;
  onClose: () => void;
  onEdit: (award: AwardRecord) => void;
  onDelete: (award: AwardRecord) => Promise<void>;
}

export const AccessionDetailModal: React.FC<AccessionDetailModalProps> = ({
  award,
  canManage,
  onClose,
  onEdit,
  onDelete,
}) => {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleConfirmDelete = async () => {
    try {
      setIsDeleting(true);
      await onDelete(award);
      onClose();
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#1C1917]/70 backdrop-blur-[2px] flex items-center justify-center p-4 md:p-8 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="accession-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-[#FBF9F5] border border-stone-300 w-full max-w-5xl max-h-[92vh] overflow-y-auto shadow-2xl">
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200 bg-[#FBF9F5] sticky top-0 z-10">
          <div className="flex items-center gap-3 text-xs text-stone-500 font-mono tabular-nums">
            <span>{award.accessionNumber}</span>
            <span aria-hidden="true">·</span>
            <span>{CATEGORY_LABELS[award.category]}</span>
            <span aria-hidden="true">·</span>
            <span>{award.isPublic ? '公開展覽典藏' : '內部典藏草稿'}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="關閉典藏詳情"
            className="p-2 text-stone-600 hover:text-[#1C1917] hover:bg-stone-200/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content split */}
        <div className="grid grid-cols-1 lg:grid-cols-12">
          {/* Left: Museum Artwork Viewer */}
          <div className="lg:col-span-7 bg-[#F2EDE4] p-6 md:p-8 flex flex-col justify-center border-b lg:border-b-0 lg:border-r border-stone-200">
            <MediaViewer
              mediaUrl={award.mediaUrl}
              mediaType={award.mediaType}
              category={award.category}
              title={award.title}
              aspectClass="aspect-[4/3]"
              enableZoom={award.mediaType === 'photo'}
              interactiveVideo={true}
            />
            <p className="text-xs font-serif italic text-stone-500 mt-3">
              圖錄 {award.accessionNumber} — 宜蘭縣宜蘭市新生國民小學數位典藏影像
              {award.mediaType === 'photo' ? '（點擊影像或右下角按鈕可放大檢視銘文細節）' : ''}
            </p>
          </div>

          {/* Right: Structured Museum Accession Metadata */}
          <div className="lg:col-span-5 p-6 md:p-8 flex flex-col justify-between">
            <div>
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <p className="text-xs tracking-widest text-[#854D0E] font-medium mb-2">
                    典藏品登錄資料
                  </p>
                  <h2
                    id="accession-title"
                    className="text-2xl md:text-3xl font-serif font-bold text-[#1C1917] leading-snug"
                  >
                    {award.title}
                  </h2>
                </div>
                <SchoolCrest size={44} variant="full" className="shrink-0" />
              </div>

              <dl className="divide-y divide-stone-200 border-t border-b border-stone-200 text-sm">
                <div className="py-3.5 grid grid-cols-3 gap-4">
                  <dt className="text-stone-500">典藏編號</dt>
                  <dd className="col-span-2 font-mono tabular-nums text-[#1C1917]">
                    {award.accessionNumber}
                  </dd>
                </div>
                <div className="py-3.5 grid grid-cols-3 gap-4">
                  <dt className="text-stone-500">物件類別</dt>
                  <dd className="col-span-2 text-[#1C1917]">
                    {CATEGORY_LABELS[award.category]}（{MEDIA_TYPE_LABELS[award.mediaType]}）
                  </dd>
                </div>
                <div className="py-3.5 grid grid-cols-3 gap-4">
                  <dt className="text-stone-500">
                    {award.category === 'building' ? '位置 / 保存者' : '得獎人姓名'}
                  </dt>
                  <dd className="col-span-2 font-medium text-[#1C1917]">
                    {award.recipientName}
                  </dd>
                </div>
                <div className="py-3.5 grid grid-cols-3 gap-4">
                  <dt className="text-stone-500">
                    {award.category === 'building' ? '落成 / 登錄日期' : '獲獎日期'}
                  </dt>
                  <dd className="col-span-2 text-[#1C1917]">
                    <span className="font-mono tabular-nums block">
                      {formatDisplayDate(award.awardDate)}
                    </span>
                    <span className="text-xs text-stone-500">
                      {formatRocDate(award.awardDate)}
                    </span>
                  </dd>
                </div>
                {award.issuingBody && (
                  <div className="py-3.5 grid grid-cols-3 gap-4">
                    <dt className="text-stone-500">
                      {award.category === 'building' ? '興建 / 登錄單位' : '頒獎單位'}
                    </dt>
                    <dd className="col-span-2 text-[#1C1917]">{award.issuingBody}</dd>
                  </div>
                )}
                {award.notes && (
                  <div className="py-3.5 grid grid-cols-3 gap-4">
                    <dt className="text-stone-500">典藏備註</dt>
                    <dd className="col-span-2 text-stone-700 leading-relaxed whitespace-pre-line">
                      {award.notes}
                    </dd>
                  </div>
                )}
                <div className="py-3.5 grid grid-cols-3 gap-4">
                  <dt className="text-stone-500">建檔人員</dt>
                  <dd className="col-span-2 text-stone-600">
                    {award.createdByName || '校史典藏組'}
                  </dd>
                </div>
              </dl>
            </div>

            {canManage && (
              <div className="pt-6 mt-6 border-t border-stone-200 flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => onEdit(award)}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium border border-stone-300 text-[#1C1917] hover:bg-stone-100 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Pencil className="w-4 h-4" />
                  編輯典藏資料
                </button>

                {!confirmDelete ? (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-800 hover:bg-red-50 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                    刪除紀錄
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-red-800">確認刪除此筆典藏？</span>
                    <button
                      type="button"
                      disabled={isDeleting}
                      onClick={handleConfirmDelete}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-red-800 text-white hover:bg-red-900 disabled:opacity-50 cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <Check className="w-3.5 h-3.5" />
                      {isDeleting ? '刪除中...' : '確認刪除'}
                    </button>
                    <button
                      type="button"
                      disabled={isDeleting}
                      onClick={() => setConfirmDelete(false)}
                      className="px-3 py-1.5 text-xs font-medium text-stone-600 hover:text-[#1C1917] cursor-pointer whitespace-nowrap shrink-0"
                    >
                      取消
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
