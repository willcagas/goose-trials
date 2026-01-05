'use client';

import { useState } from 'react';
import { useMe } from '@/app/providers/MeContext';

interface ShareProfileButtonProps {
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  showIcon?: boolean;
}

export default function ShareProfileButton({
  variant = 'secondary',
  size = 'md',
  className = '',
  showIcon = true,
}: ShareProfileButtonProps) {
  const { me } = useMe();
  const [copied, setCopied] = useState(false);

  // Only show if user is logged in and has a username
  if (!me?.isLoggedIn || !me?.username) {
    return null;
  }

  const profileUrl = typeof window !== 'undefined' 
    ? `${window.location.origin}/u/${me.username}`
    : `/u/${me.username}`;

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${me.username} on Goose Trials`,
          text: `Check out my profile on Goose Trials!`,
          url: profileUrl,
        });
      } catch (err) {
        // User cancelled or error - fall back to clipboard
        await copyToClipboard();
      }
    } else {
      await copyToClipboard();
    }
  };

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(profileUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  const variantClasses = {
    primary: 'bg-amber-400 hover:bg-amber-300 text-black font-bold',
    secondary: 'bg-[#0a0a0a]/10 hover:bg-[#0a0a0a]/20 text-[#0a0a0a] font-semibold border border-[#0a0a0a]/20',
    outline: 'bg-white/5 hover:bg-white/10 text-white font-semibold border border-white/20',
  };

  return (
    <button
      onClick={handleShare}
      className={`
        inline-flex items-center justify-center gap-2 
        rounded-xl transition-colors
        ${sizeClasses[size]}
        ${variantClasses[variant]}
        ${className}
      `}
    >
      {showIcon && (
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
          />
        </svg>
      )}
      {copied ? 'Link Copied!' : 'Share Public Profile'}
    </button>
  );
}

