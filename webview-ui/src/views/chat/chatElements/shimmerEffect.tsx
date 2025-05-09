import React, { useEffect, useState } from 'react';
import { useThemeStore } from '@/stores/useThemeStore';

export function Shimmer() {
  const { themeKind } = useThemeStore();
  const phrases = [
    'Gearing up to assist you',
    'Warming up AI engines',
    'Preparing smarter responses',
    'DeputyDev is almost done',
  ];

  const [selectedPhrase, setSelectedPhrase] = useState('');
  const [activeDots, setActiveDots] = useState(0);
  const [isMounted, setIsMounted] = useState(false);

  const logoUrl = () => {
    const isLightTheme = themeKind.includes('light');
    return isLightTheme
      ? 'https://onemg.gumlet.io/dd_logo_anim_light_theme_09_05.gif'
      : 'https://onemg.gumlet.io/dd_logo_anim_dark_theme_09_05.gif';
  };

  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  useEffect(() => {
    const dotInterval = setInterval(() => {
      setActiveDots((prev) => (prev + 1) % 4);
    }, 400);

    return () => clearInterval(dotInterval);
  }, []);

  useEffect(() => {
    let phraseTimeout: NodeJS.Timeout;
    let currentIndex = 0;

    const updatePhrase = () => {
      if (!isMounted) return;
      const selectedPhrase = phrases[currentIndex];
      setSelectedPhrase(selectedPhrase);
      currentIndex = (currentIndex + 1) % phrases.length;
      phraseTimeout = setTimeout(updatePhrase, 2500);
    };

    updatePhrase();
    return () => clearTimeout(phraseTimeout);
  }, [isMounted]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-4 rounded-lg px-4 py-3 transition-opacity duration-300"
    >
      <style>
        {`@keyframes scale-pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.1); }
          }

          @keyframes dot-bounce {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-2px); }
          }

          .animate-scale-pulse {
            animation: scale-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
          }`}
      </style>

      {/* Animated Logo with subtle glow */}
      <div className="relative h-5 w-5">
        <img
          src={logoUrl()}
          alt="DeputyDev loading"
          className="animate-scale-pulse h-full w-full origin-center object-contain"
          style={{
            imageRendering: 'crisp-edges',
            filter: themeKind.includes('dark')
              ? 'drop-shadow(0 0 4px rgba(255,255,255,0.1))'
              : 'none',
          }}
        />
      </div>

      {/* Text Container */}
      <div className="flex min-h-[28px] items-center">
        <span
          className="text-sm font-medium tracking-tight"
          style={{
            color: 'var(--vscode-foreground)',
            transition: 'opacity 0.3s ease',
            opacity: 0.7
          }}
        >
          {selectedPhrase}
          {/* Animated Dots */}
          <span className="ml-1.5 inline-block space-x-0.5">
            {Array.from({ length: 3 }).map((_, index) => (
              <span
                key={index}
                className={`inline-block ${index < activeDots ? 'opacity-100' : 'opacity-50'}`}
                style={{
                  animation: index < activeDots ? 'dot-bounce 0.4s ease-in-out' : 'none',
                  transition: 'opacity 0.3s ease',
                }}
              >
                .
              </span>
            ))}
          </span>
        </span>
      </div>
    </div>
  );
}
