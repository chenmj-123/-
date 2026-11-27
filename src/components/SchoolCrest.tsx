import React, { useState } from 'react';

interface SchoolCrestProps {
  size?: number;
  className?: string;
  variant?: 'full' | 'compact';
}

export const SCHOOL_CREST_URL = '/assets/aistudio/_______6a79d738.jpeg';

export const SchoolCrest: React.FC<SchoolCrestProps> = ({
  size = 64,
  className = '',
}) => {
  const [imgError, setImgError] = useState(false);

  if (imgError) {
    return (
      <div
        style={{ width: size, height: size }}
        aria-label="宜蘭縣宜蘭市新生國民小學校徽"
        className={`flex items-center justify-center border border-stone-300 bg-[#F4EFE6] text-xs font-serif font-bold text-[#1C1917] ${className}`}
      >
        新生
      </div>
    );
  }

  return (
    <img
      src={SCHOOL_CREST_URL}
      alt="宜蘭縣宜蘭市新生國民小學校徽"
      width={size}
      height={size}
      referrerPolicy="no-referrer"
      onError={() => setImgError(true)}
      style={{ width: size, height: size }}
      className={`object-contain mix-blend-multiply select-none ${className}`}
    />
  );
};
