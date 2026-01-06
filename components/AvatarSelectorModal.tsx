'use client';

import { useState } from 'react';
import { GOOSE_AVATARS, type GooseAvatarId } from '@/lib/avatars';
import Image from 'next/image';

interface AvatarSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentAvatarUrl: string | null;
  onAvatarSelected: (avatarUrl: string) => void;
}

export default function AvatarSelectorModal({
  isOpen,
  onClose,
  currentAvatarUrl,
  onAvatarSelected,
}: AvatarSelectorModalProps) {
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(currentAvatarUrl);
  const [isUpdating, setIsUpdating] = useState(false);

  if (!isOpen) return null;

  const handleSelect = async (avatarId: GooseAvatarId, avatarUrl: string) => {
    setSelectedAvatar(avatarUrl);
    setIsUpdating(true);

    try {
      const response = await fetch('/api/me/avatar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ avatarId }),
      });

      if (response.ok) {
        const data = await response.json();
        onAvatarSelected(data.avatarUrl);
        setTimeout(() => {
          onClose();
        }, 300);
      } else {
        console.error('Failed to update avatar');
        setSelectedAvatar(currentAvatarUrl);
      }
    } catch (error) {
      console.error('Error updating avatar:', error);
      setSelectedAvatar(currentAvatarUrl);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0a0a0a] border border-white/20 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">Choose Your Goose</h2>
          <button
            onClick={onClose}
            disabled={isUpdating}
            className="text-white/60 hover:text-white transition-colors disabled:opacity-50"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Avatar Grid */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {GOOSE_AVATARS.map((avatar) => {
              const isSelected = selectedAvatar === avatar.url;
              const isCurrent = currentAvatarUrl === avatar.url;

              return (
                <button
                  key={avatar.id}
                  onClick={() => handleSelect(avatar.id, avatar.url)}
                  disabled={isUpdating}
                  className={`
                    relative group
                    aspect-square rounded-full overflow-hidden
                    border-4 transition-all
                    ${
                      isSelected
                        ? 'border-amber-400 shadow-lg shadow-amber-400/50'
                        : 'border-white/20 hover:border-amber-400/50'
                    }
                    disabled:opacity-50 disabled:cursor-not-allowed
                  `}
                >
                  <Image
                    src={avatar.url}
                    alt={avatar.name}
                    width={200}
                    height={200}
                    className="w-full h-full object-cover"
                  />

                  {/* Selected Badge */}
                  {isSelected && (
                    <div className="absolute top-2 right-2 bg-amber-400 rounded-full p-1">
                      <svg
                        className="w-4 h-4 text-gray-900"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/10 flex justify-end">
          <button
            onClick={onClose}
            disabled={isUpdating}
            className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
