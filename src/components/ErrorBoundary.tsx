import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error.message || '系統發生未預期的錯誤。',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Uncaught ErrorBoundary exception:', error, info);
  }

  render() {
    if (this.state.hasError) {
      let friendlyText = '典藏資料庫連線或存取權限發生異常，請重新整理頁面後再試。';
      try {
        const parsed = JSON.parse(this.state.errorMessage);
        if (parsed?.error?.includes('Quota exceeded')) {
          friendlyText = '今日資料庫讀取或寫入配額已達上限，請於明日重置後再試。';
        } else if (parsed?.error?.includes('permission')) {
          friendlyText = '您目前的帳號權限無法執行此典藏操作，請確認是否已使用授權的校方 Google 帳號登入。';
        }
      } catch {
        // Non-JSON error message
      }

      return (
        <div className="min-h-screen bg-[#FBF9F5] text-[#1C1917] flex items-center justify-center p-6">
          <div className="max-w-lg w-full border border-stone-300 bg-white p-8">
            <p className="text-xs font-mono tracking-widest text-stone-500 mb-3">
              ARCHIVE SYSTEM NOTICE
            </p>
            <h1 className="text-2xl font-serif font-bold text-[#1C1917] mb-3">
              典藏系統暫時無法回應
            </h1>
            <p className="text-sm text-stone-600 leading-relaxed mb-6">
              {friendlyText}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-5 py-2.5 text-sm font-medium bg-[#1C1917] text-[#FBF9F5] hover:bg-stone-800 transition-colors cursor-pointer"
            >
              重新載入頁面
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
