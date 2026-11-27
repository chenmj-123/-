import React, { useState } from 'react';
import { Award, Film, ZoomIn, ZoomOut } from 'lucide-react';
import type { AwardCategory, MediaType } from '../types/archive';

interface MediaViewerProps {
  mediaUrl: string;
  mediaType: MediaType;
  category: AwardCategory;
  title: string;
  aspectClass?: string;
  enableZoom?: boolean;
  interactiveVideo?: boolean;
}

export const MediaViewer: React.FC<MediaViewerProps> = ({
  mediaUrl,
  mediaType,
  title,
  aspectClass = 'aspect-[4/3]',
  enableZoom = false,
  interactiveVideo = true,
}) => {
  const [hasError, setHasError] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);

  if (hasError || !mediaUrl) {
    return (
      <div
        className={`${aspectClass} w-full bg-[#EFEAE0] border border-stone-200 flex flex-col items-center justify-center p-6 text-center`}
      >
        <Award className="w-8 h-8 text-stone-400 mb-3" strokeWidth={1.5} />
        <p className="text-sm font-serif text-stone-700 line-clamp-2 max-w-xs">{title}</p>
        <p className="text-xs text-stone-500 mt-1">影像典藏讀取中或尚未載入</p>
      </div>
    );
  }

  if (mediaType === 'video') {
    return (
      <div className={`${aspectClass} w-full bg-[#1C1917] relative overflow-hidden`}>
        {interactiveVideo ? (
          <video
            src={mediaUrl}
            controls
            playsInline
            preload="metadata"
            onError={() => setHasError(true)}
            className="w-full h-full object-contain bg-[#1C1917]"
          />
        ) : (
          <div className="w-full h-full relative">
            <video
              src={mediaUrl}
              muted
              playsInline
              preload="metadata"
              onError={() => setHasError(true)}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent flex items-end p-4">
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-white tracking-wide">
                <Film className="w-3.5 h-3.5" strokeWidth={1.75} />
                動態攝影紀錄
              </span>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={`${aspectClass} w-full bg-[#F2EDE4] relative overflow-hidden group`}
    >
      <img
        src={mediaUrl}
        alt={title}
        referrerPolicy="no-referrer"
        onError={() => setHasError(true)}
        className={`w-full h-full transition-transform duration-300 ease-out ${
          isZoomed ? 'object-contain scale-125 cursor-zoom-out' : 'object-cover'
        } ${enableZoom && !isZoomed ? 'cursor-zoom-in' : ''}`}
        onClick={enableZoom ? () => setIsZoomed((prev) => !prev) : undefined}
      />
      {enableZoom && (
        <button
          type="button"
          onClick={() => setIsZoomed((prev) => !prev)}
          aria-label={isZoomed ? '縮小檢視' : '放大檢視'}
          className="absolute bottom-3 right-3 px-3 py-1.5 bg-[#1C1917]/85 text-[#FBF9F5] text-xs font-medium flex items-center gap-1.5 hover:bg-[#1C1917] transition-colors cursor-pointer whitespace-nowrap shrink-0"
        >
          {isZoomed ? (
            <>
              <ZoomOut className="w-3.5 h-3.5" />
              還原比例
            </>
          ) : (
            <>
              <ZoomIn className="w-3.5 h-3.5" />
              細節放大
            </>
          )}
        </button>
      )}
    </div>
  );
};
