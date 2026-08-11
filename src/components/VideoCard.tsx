import { useState, useRef, useEffect } from 'react';
import type { VideoItem } from '@/data/videoData';

interface VideoCardProps {
  video: VideoItem;
}

export default function VideoCard({ video }: VideoCardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Tier 1 — whether the real <video> element should be mounted at all.
  // Mirrors Juno Hair's approach: only cards near the viewport get a real
  // <video>; everything else stays a lightweight <img poster>. This keeps
  // the number of simultaneously-loading <video> elements small, which is
  // what in-app browsers like Zalo's WebView struggle with when many
  // <video> tags try to load metadata at once.
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    // Once mounted, stop watching entirely — never flip back to false.
    // (Unmounting the <video> when a card drifted out of range was what
    // forced iOS/WebKit to rebuild the video element mid-swipe when the
    // user swiped backward, which is what caused the stutter/broken
    // gesture on iPhone.)
    if (!container || mounted) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setMounted(true);
          }
        }
      },
      { threshold: 0, rootMargin: '200px 0px 200px 0px' },
    );

    observer.observe(container);
    return () => observer.disconnect();
  }, [mounted]);

  // Tier 2 — once the real <video> is mounted, play/pause it based on
  // stricter visibility (60%+), same behavior as before.
  useEffect(() => {
    const container = containerRef.current;
    const el = videoRef.current;
    if (!container || !el || !mounted) return;

    // Tracks whether THIS card is intersecting right now. Needed because
    // canplay can fire asynchronously, well after the user has already
    // swiped past this card — without this check, a slow-loading video
    // would call .play() (and get force-fullscreened by iOS) at whatever
    // moment it happens to finish loading, regardless of what card the
    // user is actually looking at.
    let isCurrentlyIntersecting = false;

    const tryPlay = () => {
      if (!isCurrentlyIntersecting) return;
      el.play().catch(() => {});
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          isCurrentlyIntersecting = entry.isIntersecting;
          if (entry.isIntersecting) {
            if (el.readyState >= 2) {
              tryPlay();
            } else {
              el.addEventListener('canplay', tryPlay, { once: true });
            }
          } else {
            el.pause();
            // Cancel any pending "play once loaded" from a moment ago —
            // otherwise it fires later while the user is on a different card.
            el.removeEventListener('canplay', tryPlay);
          }
        }
      },
      { threshold: 0.6 },
    );

    observer.observe(container);

    return () => {
      observer.disconnect();
      el.removeEventListener('canplay', tryPlay);
    };
  }, [mounted]);

  return (
    <div
      ref={containerRef}
      className="group relative h-full w-full overflow-hidden rounded-xl bg-[#f0ebe2] shadow-[0_2px_12px_rgba(42,34,28,0.06)] transition-all duration-500 ease-out hover:-translate-y-1 hover:shadow-[0_12px_32px_rgba(42,34,28,0.12)]"
    >
      {mounted ? (
        <video
          ref={videoRef}
          src={video.src}
          poster={video.poster}
          autoPlay
          muted
          loop
          playsInline
          preload="none"
          disablePictureInPicture
          className="h-full w-full object-cover"
        />
      ) : (
        <img
          src={video.poster}
          alt=""
          aria-hidden="true"
          loading="lazy"
          className="h-full w-full object-cover"
        />
      )}

      {/* Subtle bottom gradient overlay */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-70 transition-opacity duration-500 group-hover:opacity-90" />
    </div>
  );
}
