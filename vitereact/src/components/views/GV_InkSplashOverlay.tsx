import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import sultanstampLogo from '@/assets/sultanstamp_logo.jpeg';

const SPLASH_SHOWN_KEY = 'sultanstamp_splash_shown';

interface GV_InkSplashOverlayProps {
  onComplete: () => void;
}

// Check if logo loaded correctly
const LogoWithFallback: React.FC<{
  src: string;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
}> = ({ src, alt, className, style }) => {
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return (
      <span
        className={className}
        style={{
          ...style,
          fontFamily: "'Playfair Display', serif",
          fontWeight: 700,
          fontSize: '2rem',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #333 0%, #111 100%)',
          borderRadius: '12px',
          padding: '0.5rem 1rem',
        }}
      >
        SultanStamp
      </span>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      style={style}
      onError={() => setHasError(true)}
    />
  );
};

// Droplet configuration for initial "fall in" phase (0-0.4s)
const fallingDroplets = [
  { id: 0, startX: 48, startY: -10, endX: 50, endY: 45, r: 12, delay: 0 },
  { id: 1, startX: 52, startY: -15, endX: 48, endY: 48, r: 10, delay: 80 },
  { id: 2, startX: 45, startY: -8, endX: 52, endY: 52, r: 8, delay: 150 },
  { id: 3, startX: 55, startY: -12, endX: 47, endY: 50, r: 9, delay: 220 },
  { id: 4, startX: 50, startY: -5, endX: 53, endY: 47, r: 11, delay: 300 },
];

// Main blob configuration for splash expansion (0.4-1.2s)
const mainBlobs = [
  { id: 0, cx: 50, cy: 50, targetR: 45, delay: 400 },
  { id: 1, cx: 42, cy: 48, targetR: 38, delay: 450 },
  { id: 2, cx: 58, cy: 52, targetR: 36, delay: 480 },
  { id: 3, cx: 35, cy: 55, targetR: 28, delay: 520 },
  { id: 4, cx: 65, cy: 45, targetR: 30, delay: 500 },
  { id: 5, cx: 45, cy: 40, targetR: 25, delay: 560 },
  { id: 6, cx: 55, cy: 60, targetR: 26, delay: 580 },
  { id: 7, cx: 30, cy: 50, targetR: 22, delay: 600 },
  { id: 8, cx: 70, cy: 50, targetR: 24, delay: 620 },
  { id: 9, cx: 50, cy: 35, targetR: 20, delay: 640 },
  { id: 10, cx: 50, cy: 65, targetR: 22, delay: 660 },
];

// Splatter droplets that fling outward during splash (0.4-1.2s)
const splatters = [
  { id: 0, startX: 50, startY: 50, endX: 12, endY: 20, r: 6, delay: 450 },
  { id: 1, startX: 50, startY: 50, endX: 85, endY: 15, r: 5, delay: 480 },
  { id: 2, startX: 50, startY: 50, endX: 92, endY: 50, r: 7, delay: 420 },
  { id: 3, startX: 50, startY: 50, endX: 8, endY: 65, r: 4, delay: 520 },
  { id: 4, startX: 50, startY: 50, endX: 88, endY: 80, r: 5, delay: 460 },
  { id: 5, startX: 50, startY: 50, endX: 15, endY: 85, r: 4, delay: 540 },
  { id: 6, startX: 50, startY: 50, endX: 78, endY: 25, r: 4, delay: 500 },
  { id: 7, startX: 50, startY: 50, endX: 22, endY: 30, r: 3, delay: 560 },
  { id: 8, startX: 50, startY: 50, endX: 75, endY: 72, r: 3, delay: 580 },
  { id: 9, startX: 50, startY: 50, endX: 25, endY: 75, r: 3, delay: 600 },
  { id: 10, startX: 50, startY: 50, endX: 5, endY: 45, r: 4, delay: 440 },
  { id: 11, startX: 50, startY: 50, endX: 95, endY: 38, r: 5, delay: 470 },
  { id: 12, startX: 50, startY: 50, endX: 18, endY: 55, r: 3, delay: 530 },
  { id: 13, startX: 50, startY: 50, endX: 82, endY: 62, r: 4, delay: 510 },
  // Tiny droplets for extra detail
  { id: 14, startX: 50, startY: 50, endX: 10, endY: 35, r: 2, delay: 550 },
  { id: 15, startX: 50, startY: 50, endX: 90, endY: 28, r: 2, delay: 570 },
  { id: 16, startX: 50, startY: 50, endX: 3, endY: 70, r: 2, delay: 590 },
  { id: 17, startX: 50, startY: 50, endX: 97, endY: 68, r: 2, delay: 610 },
];

// Irregular edge path for the main ink blob (organic, not circular)
const generateIrregularPath = (cx: number, cy: number, r: number, seed: number): string => {
  const points = 24;
  const pathPoints: string[] = [];
  
  for (let i = 0; i < points; i++) {
    const angle = (i / points) * Math.PI * 2;
    // Add randomness based on seed for irregular edges
    const variance = 0.15 + 0.1 * Math.sin(seed * 7 + i * 3);
    const radius = r * (1 + variance * Math.sin(angle * 3 + seed) * Math.cos(angle * 2 + seed * 0.5));
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    
    if (i === 0) {
      pathPoints.push(`M ${x} ${y}`);
    } else {
      // Use smooth curves for organic look
      const prevAngle = ((i - 1) / points) * Math.PI * 2;
      const prevVariance = 0.15 + 0.1 * Math.sin(seed * 7 + (i - 1) * 3);
      const prevRadius = r * (1 + prevVariance * Math.sin(prevAngle * 3 + seed) * Math.cos(prevAngle * 2 + seed * 0.5));
      const cpRadius = (radius + prevRadius) / 2;
      const cpAngle = (angle + prevAngle) / 2;
      const cpX = cx + Math.cos(cpAngle) * cpRadius * 1.02;
      const cpY = cy + Math.sin(cpAngle) * cpRadius * 1.02;
      pathPoints.push(`Q ${cpX} ${cpY} ${x} ${y}`);
    }
  }
  pathPoints.push('Z');
  return pathPoints.join(' ');
};

type Phase = 'droplets' | 'splash' | 'settle' | 'slide' | 'reveal' | 'fadeout' | 'done';

const GV_InkSplashOverlay: React.FC<GV_InkSplashOverlayProps> = ({ onComplete }) => {
  const [phase, setPhase] = useState<Phase>('droplets');
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [slideProgress, setSlideProgress] = useState(0); // 0 to 1 for slide animation
  const animationRef = useRef<number | null>(null);
  const slideStartRef = useRef<number | null>(null);
  
  // Check for reduced motion preference
  const prefersReducedMotion = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  const handleSkip = useCallback(() => {
    sessionStorage.setItem(SPLASH_SHOWN_KEY, 'true');
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    setIsFadingOut(true);
    setTimeout(() => {
      setPhase('done');
      onComplete();
    }, 300);
  }, [onComplete]);

  // Slide animation using requestAnimationFrame for smooth performance
  const animateSlide = useCallback((timestamp: number) => {
    if (!slideStartRef.current) {
      slideStartRef.current = timestamp;
    }
    
    const elapsed = timestamp - slideStartRef.current;
    const duration = 900; // 0.9s for slide (1.8-2.7s in timeline)
    const progress = Math.min(elapsed / duration, 1);
    
    // Ease out cubic for organic feel
    const eased = 1 - Math.pow(1 - progress, 3);
    setSlideProgress(eased);
    
    if (progress < 1) {
      animationRef.current = requestAnimationFrame(animateSlide);
    }
  }, []);

  useEffect(() => {
    // Check if splash has already been shown this session
    if (sessionStorage.getItem(SPLASH_SHOWN_KEY) === 'true') {
      setPhase('done');
      onComplete();
      return;
    }

    // Handle reduced motion preference
    if (prefersReducedMotion) {
      // Skip animation, show logo briefly then fade out
      setPhase('reveal');
      const timer = setTimeout(() => {
        setIsFadingOut(true);
        setTimeout(() => {
          sessionStorage.setItem(SPLASH_SHOWN_KEY, 'true');
          setPhase('done');
          onComplete();
        }, 500);
      }, 1500);
      return () => clearTimeout(timer);
    }

    // Timeline:
    // 0.0–0.4s: droplets fall in
    // 0.4–1.2s: splash expands
    // 1.2–1.8s: settle/wobble
    // 1.8–2.7s: slide left
    // 2.7–3.2s: reveal logo + fade out

    const timers: ReturnType<typeof setTimeout>[] = [];

    // Phase 1: Droplets -> Splash at 0.4s
    timers.push(setTimeout(() => setPhase('splash'), 400));

    // Phase 2: Splash -> Settle at 1.2s
    timers.push(setTimeout(() => setPhase('settle'), 1200));

    // Phase 3: Settle -> Slide at 1.8s
    timers.push(setTimeout(() => {
      setPhase('slide');
      animationRef.current = requestAnimationFrame(animateSlide);
    }, 1800));

    // Phase 4: Slide -> Reveal at 2.7s
    timers.push(setTimeout(() => setPhase('reveal'), 2700));

    // Phase 5: Start fade out at 3.2s
    timers.push(setTimeout(() => {
      setIsFadingOut(true);
      setPhase('fadeout');
    }, 3200));

    // Phase 6: Complete and unmount at 3.7s
    timers.push(setTimeout(() => {
      sessionStorage.setItem(SPLASH_SHOWN_KEY, 'true');
      setPhase('done');
      onComplete();
    }, 3700));

    return () => {
      timers.forEach(timer => clearTimeout(timer));
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [onComplete, prefersReducedMotion, animateSlide]);

  // Don't render if already done
  if (phase === 'done') {
    return null;
  }

  const isSliding = phase === 'slide' || phase === 'reveal' || phase === 'fadeout';
  const showLogo = phase === 'reveal' || phase === 'fadeout';
  const showSplash = phase !== 'droplets';
  const showSettle = phase === 'settle' || phase === 'slide' || phase === 'reveal' || phase === 'fadeout';

  // Calculate slide transform - organic edge movement
  const slideTransform = isSliding ? `translateX(${-55 * slideProgress}%)` : 'translateX(0)';

  return (
    <div
      className={`fixed inset-0 z-[9999] cursor-pointer overflow-hidden`}
      onClick={handleSkip}
      onTouchStart={handleSkip}
      style={{
        backgroundColor: '#ffffff',
        opacity: isFadingOut ? 0 : 1,
        transition: 'opacity 0.5s ease-out',
      }}
    >
      {/* SVG Ink Splash Layer */}
      <svg 
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid slice"
        style={{
          transform: slideTransform,
          transition: phase === 'slide' ? 'none' : 'transform 0.1s ease-out',
        }}
      >
        <defs>
          {/* Gooey filter - ONLY for merging blobs, keeps edges crisp */}
          <filter id="gooey-ink" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="1.8" result="blur" />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="1 0 0 0 0
                      0 1 0 0 0
                      0 0 1 0 0
                      0 0 0 35 -15"
              result="goo"
            />
            <feComposite in="SourceGraphic" in2="goo" operator="atop" />
          </filter>

          {/* Wet highlight gradient for gloss effect */}
          <linearGradient id="inkGloss1" x1="0%" y1="0%" x2="60%" y2="60%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.5)" />
            <stop offset="40%" stopColor="rgba(255,255,255,0.15)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>

          <linearGradient id="inkGloss2" x1="20%" y1="10%" x2="80%" y2="90%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.35)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>

          {/* Specular highlight for wet look */}
          <radialGradient id="specular1" cx="30%" cy="25%" r="35%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.6)" />
            <stop offset="50%" stopColor="rgba(255,255,255,0.2)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </radialGradient>

          {/* Organic edge mask for slide reveal */}
          <clipPath id="organicEdge">
            <path d={`
              M 100 0 
              L 100 100 
              L ${55 + slideProgress * 50} 100 
              Q ${50 + slideProgress * 50} 85 ${52 + slideProgress * 50} 70
              Q ${48 + slideProgress * 50} 55 ${53 + slideProgress * 50} 40
              Q ${47 + slideProgress * 50} 25 ${50 + slideProgress * 50} 10
              Q ${52 + slideProgress * 50} 0 ${55 + slideProgress * 50} 0
              Z
            `} />
          </clipPath>
        </defs>

        {/* Main ink group with gooey filter for merging */}
        <g filter="url(#gooey-ink)">
          {/* Falling droplets - phase 0-0.4s */}
          {fallingDroplets.map((drop) => (
            <circle
              key={`fall-${drop.id}`}
              cx={drop.endX}
              cy={drop.endY}
              r={drop.r}
              fill="#0a0a0a"
              className="ink-falling-drop"
              style={{
                '--start-y': `${drop.startY}%`,
                '--end-y': `${drop.endY}%`,
                animationDelay: `${drop.delay}ms`,
              } as React.CSSProperties}
            />
          ))}

          {/* Main blobs - expand during splash phase */}
          {showSplash && mainBlobs.map((blob) => (
            <path
              key={`main-${blob.id}`}
              d={generateIrregularPath(blob.cx, blob.cy, blob.targetR, blob.id * 1.5)}
              fill="#0a0a0a"
              className={`ink-blob-expand ${showSettle ? 'ink-settle' : ''}`}
              style={{
                animationDelay: `${blob.delay}ms`,
                transformOrigin: `${blob.cx}% ${blob.cy}%`,
              }}
            />
          ))}

          {/* Splatter droplets - fling outward during splash */}
          {showSplash && splatters.map((drop) => (
            <circle
              key={`splat-${drop.id}`}
              cx={drop.endX}
              cy={drop.endY}
              r={drop.r}
              fill="#0a0a0a"
              className="ink-splatter-drop"
              style={{
                '--start-x': `${drop.startX}`,
                '--start-y': `${drop.startY}`,
                '--end-x': `${drop.endX}`,
                '--end-y': `${drop.endY}`,
                animationDelay: `${drop.delay}ms`,
              } as React.CSSProperties}
            />
          ))}

          {/* Extended ink coverage to the left for slide */}
          {showSplash && (
            <>
              <path
                d={generateIrregularPath(20, 50, 35, 2.5)}
                fill="#0a0a0a"
                className="ink-blob-expand"
                style={{ animationDelay: '700ms', transformOrigin: '20% 50%' }}
              />
              <path
                d={generateIrregularPath(0, 50, 40, 3.5)}
                fill="#0a0a0a"
                className="ink-blob-expand"
                style={{ animationDelay: '750ms', transformOrigin: '0% 50%' }}
              />
              <path
                d={generateIrregularPath(-15, 50, 35, 4.5)}
                fill="#0a0a0a"
                className="ink-blob-expand"
                style={{ animationDelay: '800ms', transformOrigin: '-15% 50%' }}
              />
              <path
                d={generateIrregularPath(10, 25, 28, 5.5)}
                fill="#0a0a0a"
                className="ink-blob-expand"
                style={{ animationDelay: '780ms', transformOrigin: '10% 25%' }}
              />
              <path
                d={generateIrregularPath(10, 75, 28, 6.5)}
                fill="#0a0a0a"
                className="ink-blob-expand"
                style={{ animationDelay: '820ms', transformOrigin: '10% 75%' }}
              />
            </>
          )}
        </g>

        {/* Wet gloss highlights (on top of ink, no filter) */}
        {showSettle && (
          <g className="ink-highlights">
            {/* Main gloss streak */}
            <ellipse
              cx="38"
              cy="38"
              rx="18"
              ry="10"
              fill="url(#inkGloss1)"
              className="ink-highlight-fade"
              style={{ transformOrigin: '38% 38%' }}
            />
            {/* Secondary gloss */}
            <ellipse
              cx="55"
              cy="52"
              rx="12"
              ry="6"
              fill="url(#inkGloss2)"
              className="ink-highlight-fade"
              style={{ animationDelay: '100ms', transformOrigin: '55% 52%' }}
            />
            {/* Specular spots for wet look */}
            <circle
              cx="35"
              cy="35"
              r="5"
              fill="url(#specular1)"
              className="ink-highlight-fade"
              style={{ animationDelay: '150ms' }}
            />
            <circle
              cx="52"
              cy="48"
              r="3"
              fill="rgba(255,255,255,0.45)"
              className="ink-highlight-fade"
              style={{ animationDelay: '200ms' }}
            />
            <circle
              cx="42"
              cy="55"
              r="2.5"
              fill="rgba(255,255,255,0.4)"
              className="ink-highlight-fade"
              style={{ animationDelay: '250ms' }}
            />
            {/* Tiny bright specks */}
            <circle cx="33" cy="32" r="1.5" fill="rgba(255,255,255,0.55)" className="ink-highlight-fade" style={{ animationDelay: '300ms' }} />
            <circle cx="58" cy="45" r="1" fill="rgba(255,255,255,0.5)" className="ink-highlight-fade" style={{ animationDelay: '350ms' }} />
            <circle cx="45" cy="40" r="1.2" fill="rgba(255,255,255,0.45)" className="ink-highlight-fade" style={{ animationDelay: '400ms' }} />
          </g>
        )}
      </svg>

      {/* Logo reveal on white area - positioned on LEFT (over ink) */}
      <div 
        className="absolute inset-0 flex items-center z-10"
        style={{
          justifyContent: 'flex-start',
          paddingLeft: '5%',
        }}
      >
        <div 
          className="flex flex-col items-center gap-3"
          style={{
            opacity: showLogo ? 1 : 0,
            transform: showLogo ? 'scale(1) translateY(0)' : 'scale(0.8) translateY(20px)',
            transition: 'opacity 0.5s ease-out, transform 0.5s ease-out',
          }}
        >
          {/* Logo */}
          <LogoWithFallback
            src={sultanstampLogo}
            alt="SultanStamp"
            className="w-20 h-20 sm:w-24 sm:h-24 md:w-32 md:h-32 object-contain rounded-xl"
            style={{
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
            }}
          />
          
          {/* Brand text "SultanStamp" */}
          <h1
            className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-wide"
            style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              color: '#ffffff',
              textShadow: '0 2px 8px rgba(0,0,0,0.5)',
            }}
          >
            SultanStamp
          </h1>
        </div>
      </div>

      {/* Right side content - "Sultans" text on white area */}
      {showLogo && (
        <div 
          className="absolute right-0 top-0 bottom-0 flex items-center z-10"
          style={{
            width: '45%',
            paddingLeft: '5%',
          }}
        >
          <h2
            className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-wider"
            style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              color: '#1a1a1a',
              opacity: showLogo ? 1 : 0,
              transform: showLogo ? 'translateX(0)' : 'translateX(-30px)',
              transition: 'opacity 0.5s ease-out 0.2s, transform 0.5s ease-out 0.2s',
            }}
          >
            Sultans
          </h2>
        </div>
      )}

      {/* CSS Animations */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&display=swap');

        /* Falling droplets - 0 to 0.4s */
        @keyframes dropletFall {
          0% {
            transform: translateY(calc(var(--start-y) - var(--end-y)));
            opacity: 0;
          }
          15% {
            opacity: 1;
          }
          85% {
            transform: translateY(0);
            opacity: 1;
          }
          100% {
            transform: translateY(0) scaleY(0.85) scaleX(1.15);
            opacity: 1;
          }
        }

        .ink-falling-drop {
          animation: dropletFall 0.4s cubic-bezier(0.4, 0, 0.6, 1) forwards;
          opacity: 0;
        }

        /* Blob expansion - 0.4s to 1.2s */
        @keyframes blobExpand {
          0% {
            transform: scale(0);
            opacity: 0;
          }
          20% {
            opacity: 1;
          }
          60% {
            transform: scale(1.15);
          }
          80% {
            transform: scale(0.95);
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }

        .ink-blob-expand {
          animation: blobExpand 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
          opacity: 0;
        }

        /* Settle wobble - 1.2s to 1.8s */
        @keyframes settleWobble {
          0%, 100% {
            transform: scale(1) rotate(0deg);
          }
          20% {
            transform: scale(1.02) rotate(0.5deg);
          }
          40% {
            transform: scale(0.98) rotate(-0.4deg);
          }
          60% {
            transform: scale(1.01) rotate(0.3deg);
          }
          80% {
            transform: scale(0.99) rotate(-0.2deg);
          }
        }

        .ink-settle {
          animation: blobExpand 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards,
                     settleWobble 0.6s ease-in-out 0.8s;
        }

        /* Splatter fling - droplets fly out */
        @keyframes splatterFling {
          0% {
            cx: var(--start-x);
            cy: var(--start-y);
            r: 0;
            opacity: 0;
          }
          15% {
            opacity: 1;
          }
          40% {
            r: attr(r);
          }
          70% {
            cx: var(--end-x);
            cy: var(--end-y);
          }
          85% {
            transform: scale(1.2);
          }
          100% {
            cx: var(--end-x);
            cy: var(--end-y);
            transform: scale(1);
            opacity: 1;
          }
        }

        .ink-splatter-drop {
          animation: splatterFling 0.7s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
          opacity: 0;
        }

        /* Highlight fade in */
        @keyframes highlightFadeIn {
          0% {
            opacity: 0;
            transform: scale(0.8);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }

        .ink-highlight-fade {
          animation: highlightFadeIn 0.4s ease-out forwards;
          opacity: 0;
        }

        /* Prefers reduced motion */
        @media (prefers-reduced-motion: reduce) {
          .ink-falling-drop,
          .ink-blob-expand,
          .ink-splatter-drop,
          .ink-highlight-fade {
            animation: none !important;
            opacity: 1 !important;
            transform: scale(1) !important;
          }
        }
      `}</style>
    </div>
  );
};

export default GV_InkSplashOverlay;
export { SPLASH_SHOWN_KEY };
