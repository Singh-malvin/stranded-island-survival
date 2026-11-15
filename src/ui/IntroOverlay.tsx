import React, { useEffect, useRef } from 'react';
import { IntroOverlayState } from '../scene/PlaneCrashIntro3D.ts';

interface IntroOverlayProps {
  intro: IntroOverlayState;
}

export const IntroOverlay: React.FC<IntroOverlayProps> = ({ intro }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    if (intro.showVideo) {
      vid.currentTime = 0;
      void vid.play().catch(() => {
        // Fallback smoothly: timer continues even if headless blocks autoplay
      });
    } else {
      vid.pause();
    }
  }, [intro.showVideo]);

  if (!intro.active) return null;

  return (
    <div
      data-testid="plane-crash-intro-overlay"
      className="pointer-events-none fixed inset-0 z-30 select-none overflow-hidden"
    >
      {/* Pre-rendered Blender Exterior Crash Video Cut */}
      {intro.showVideo && (
        <div className="fixed inset-0 z-10 flex items-center justify-center bg-black">
          <video
            ref={videoRef}
            src="./assets/video/flight404_crash.mp4"
            autoPlay
            muted
            playsInline
            className="h-full w-full object-cover"
          />
        </div>
      )}

      {/* Atmospheric purple-gold lightning flash veil inside cabin */}
      {intro.lightningFlashAlpha > 0.01 && (
        <div
          className="fixed inset-0 z-10 bg-purple-400 mix-blend-screen transition-opacity duration-75"
          style={{ opacity: intro.lightningFlashAlpha }}
        />
      )}

      {/* Wake-up disorientation blur layer */}
      {intro.blurPx > 0.15 && (
        <div
          className="fixed inset-0 z-10 transition-all duration-300"
          style={{ backdropFilter: `blur(${intro.blurPx.toFixed(1)}px)` }}
        />
      )}

      {/* Blackout / Smooth fade layer */}
      {intro.fadeBlackAlpha > 0.005 && (
        <div
          className="fixed inset-0 z-20 bg-black transition-opacity duration-150"
          style={{ opacity: Math.min(1, intro.fadeBlackAlpha) }}
        />
      )}

      {/* Cinema Top & Bottom Letterbox Bars */}
      <div className="fixed inset-x-0 top-0 z-30 h-9 bg-black sm:h-12" />
      <div className="fixed inset-x-0 bottom-0 z-30 h-9 bg-black sm:h-12" />

      {/* Blackout / Palm Cove Chapter Title */}
      {intro.bannerTitle && (
        <div className="fixed inset-0 z-30 flex flex-col items-center justify-center px-4 text-center">
          <div className="text-xl font-bold uppercase tracking-[0.35em] text-amber-200 drop-shadow-lg sm:text-2xl">
            {intro.bannerTitle}
          </div>
          {intro.bannerSubtitle && (
            <div className="mt-2 text-xs uppercase tracking-[0.25em] text-stone-400">
              {intro.bannerSubtitle}
            </div>
          )}
        </div>
      )}

      {/* Crisp Centered Subtitles */}
      {intro.subtitle && (
        <div className="fixed inset-x-0 bottom-12 z-40 flex justify-center px-6 sm:bottom-16">
          <div className="max-w-xl rounded-md bg-black/75 px-4 py-1.5 text-center text-xs font-medium tracking-wide text-stone-100 shadow-lg sm:text-sm">
            {intro.subtitle}
          </div>
        </div>
      )}

      {/* Subtle Hold [Space] to Skip pill in bottom-right */}
      <div className="fixed bottom-2.5 right-5 z-40 flex items-center gap-2 sm:bottom-3.5">
        <div className="rounded-full border border-white/20 bg-stone-950/80 px-3 py-1 text-[10.5px] font-medium tracking-wider text-stone-300">
          Hold <span className="font-mono font-bold text-amber-300">[Space]</span> to Skip
        </div>
        {intro.skipHoldProgress > 0.02 && (
          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-white/15">
            <div
              className="h-full bg-amber-400 transition-all duration-75"
              style={{ width: `${Math.round(intro.skipHoldProgress * 100)}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
};
