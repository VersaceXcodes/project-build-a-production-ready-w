import React, { useState, useEffect, useCallback } from 'react';
import sultanstampLogo from '@/assets/sultanstamp_logo.jpeg';

const SPLASH_SHOWN_KEY = 'sultanstamp_splash_shown';

interface GV_InkSplashOverlayProps {
  onComplete: () => void;
}

// Ink blob configuration for main splash
const mainBlobs = [
  { cx: 50, cy: 50, r: 0, targetR: 80, delay: 0 },
  { cx: 45, cy: 48, r: 0, targetR: 50, delay: 50 },
  { cx: 55, cy: 52, r: 0, targetR: 55, delay: 80 },
  { cx: 40, cy: 55, r: 0, targetR: 35, delay: 120 },
  { cx: 60, cy: 45, r: 0, targetR: 40, delay: 100 },
  { cx: 48, cy: 42, r: 0, targetR: 30, delay: 150 },
  { cx: 52, cy: 58, r: 0, targetR: 32, delay: 180 },
];

// Splatter droplets that fling outward
const splatters = [
  { startX: 50, startY: 50, endX: 20, endY: 25, r: 8, delay: 200 },
  { startX: 50, startY: 50, endX: 75, endY: 20, r: 6, delay: 250 },
  { startX: 50, startY: 50, endX: 85, endY: 55, r: 7, delay: 180 },
  { startX: 50, startY: 50, endX: 15, endY: 60, r: 5, delay: 300 },
  { startX: 50, startY: 50, endX: 80, endY: 75, r: 6, delay: 220 },
  { startX: 50, startY: 50, endX: 25, endY: 80, r: 4, delay: 280 },
  { startX: 50, startY: 50, endX: 70, endY: 30, r: 5, delay: 260 },
  { startX: 50, startY: 50, endX: 30, endY: 35, r: 4, delay: 320 },
  { startX: 50, startY: 50, endX: 65, endY: 70, r: 3, delay: 350 },
  { startX: 50, startY: 50, endX: 35, endY: 70, r: 3, delay: 380 },
  { startX: 50, startY: 50, endX: 10, endY: 45, r: 4, delay: 400 },
  { startX: 50, startY: 50, endX: 90, endY: 40, r: 5, delay: 360 },
];

const GV_InkSplashOverlay: React.FC<GV_InkSplashOverlayProps> = ({ onComplete }) => {
  const [phase, setPhase] = useState<'ink' | 'slide' | 'logo' | 'text' | 'hold' | 'fadeout' | 'done'>('ink');
  const [isFadingOut, setIsFadingOut] = useState(false);

  const handleSkip = useCallback(() => {
    sessionStorage.setItem(SPLASH_SHOWN_KEY, 'true');
    setIsFadingOut(true);
    setTimeout(() => {
      setPhase('done');
      onComplete();
    }, 300);
  }, [onComplete]);

  useEffect(() => {
    // Check if splash has already been shown this session
    if (sessionStorage.getItem(SPLASH_SHOWN_KEY) === 'true') {
      setPhase('done');
      onComplete();
      return;
    }

    // Timeline (adjusted for ink splash with left slide):
    // 0-1.2s: ink drops fall + splash expands
    // 1.2-1.8s: ink settles with wobble, droplets finish
    // 1.8-2.6s: ink slides left, revealing white on right
    // 2.6s: logo appears on revealed white area
    // 3.0s: text reveals
    // 3.6s: hold
    // 4.0s+: fade out

    const timers: ReturnType<typeof setTimeout>[] = [];

    // Phase 1: Start ink slide at 1.8s (after ink settles)
    timers.push(setTimeout(() => setPhase('slide'), 1800));

    // Phase 2: Logo starts appearing at 2.6s (after slide completes)
    timers.push(setTimeout(() => setPhase('logo'), 2600));

    // Phase 3: Text starts revealing at 3.0s
    timers.push(setTimeout(() => setPhase('text'), 3000));

    // Phase 4: Hold at 3.6s
    timers.push(setTimeout(() => setPhase('hold'), 3600));

    // Phase 5: Start fade out at 4.0s
    timers.push(setTimeout(() => {
      setIsFadingOut(true);
      setPhase('fadeout');
    }, 4000));

    // Phase 6: Complete and unmount at 4.5s
    timers.push(setTimeout(() => {
      sessionStorage.setItem(SPLASH_SHOWN_KEY, 'true');
      setPhase('done');
      onComplete();
    }, 4500));

    return () => {
      timers.forEach(timer => clearTimeout(timer));
    };
  }, [onComplete]);

  // Don't render if already done
  if (phase === 'done') {
    return null;
  }

  const showLogo = phase !== 'ink';
  const showText = phase === 'text' || phase === 'hold' || phase === 'fadeout';

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center cursor-pointer transition-opacity duration-500 ${
        isFadingOut ? 'opacity-0' : 'opacity-100'
      }`}
      onClick={handleSkip}
      onTouchStart={handleSkip}
      style={{ backgroundColor: '#f8f8f8' }}
    >
      {/* SVG Ink Splash Layer */}
      <svg 
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          {/* Gooey filter for metaball merging effect - blur kept inside filter only */}
          <filter id="gooey" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur" />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="1 0 0 0 0
                      0 1 0 0 0
                      0 0 1 0 0
                      0 0 0 25 -10"
              result="goo"
            />
            <feComposite in="SourceGraphic" in2="goo" operator="atop" />
          </filter>

          {/* Glossy highlight gradient */}
          <linearGradient id="glossHighlight" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.35)" />
            <stop offset="30%" stopColor="rgba(255,255,255,0.1)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>

          {/* Secondary highlight for wet look */}
          <radialGradient id="wetShine" cx="35%" cy="30%" r="50%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.4)" />
            <stop offset="50%" stopColor="rgba(255,255,255,0.1)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </radialGradient>

          {/* Ink base color with subtle gradient for depth */}
          <radialGradient id="inkBase" cx="40%" cy="40%" r="60%">
            <stop offset="0%" stopColor="#1a1a1a" />
            <stop offset="70%" stopColor="#0d0d0d" />
            <stop offset="100%" stopColor="#000000" />
          </radialGradient>
        </defs>

        {/* Main ink blob group with gooey filter */}
        <g filter="url(#gooey)">
          {/* Main blobs - expand and merge */}
          {mainBlobs.map((blob, i) => (
            <circle
              key={`main-${i}`}
              cx={blob.cx}
              cy={blob.cy}
              r={blob.targetR}
              fill="#000"
              className="ink-blob-main"
              style={{
                animationDelay: `${blob.delay}ms`,
              }}
            />
          ))}

          {/* Splatter droplets - fling outward */}
          {splatters.map((drop, i) => (
            <circle
              key={`splatter-${i}`}
              cx={drop.endX}
              cy={drop.endY}
              r={drop.r}
              fill="#000"
              className="ink-splatter"
              style={{
                '--start-x': `${drop.startX}%`,
                '--start-y': `${drop.startY}%`,
                '--end-x': `${drop.endX}%`,
                '--end-y': `${drop.endY}%`,
                animationDelay: `${drop.delay}ms`,
              } as React.CSSProperties}
            />
          ))}
        </g>

        {/* Glossy highlights layer (on top of ink, no filter) */}
        <g className="ink-highlights">
          {/* Main central highlight */}
          <ellipse
            cx="42"
            cy="42"
            rx="25"
            ry="18"
            fill="url(#glossHighlight)"
            className="highlight-main"
            style={{ opacity: 0 }}
          />
          {/* Secondary specular streaks */}
          <ellipse
            cx="38"
            cy="38"
            rx="12"
            ry="8"
            fill="url(#wetShine)"
            className="highlight-specular"
            style={{ opacity: 0 }}
          />
          <ellipse
            cx="55"
            cy="48"
            rx="8"
            ry="5"
            fill="rgba(255,255,255,0.25)"
            className="highlight-secondary"
            style={{ opacity: 0 }}
          />
          {/* Small bright spots for wet look */}
          <circle cx="36" cy="36" r="3" fill="rgba(255,255,255,0.35)" className="highlight-spot" style={{ opacity: 0 }} />
          <circle cx="58" cy="45" r="2" fill="rgba(255,255,255,0.3)" className="highlight-spot" style={{ opacity: 0, animationDelay: '100ms' }} />
        </g>
      </svg>

      {/* Brand Container - centered above ink */}
      <div className="relative z-10 flex flex-col items-center gap-4">
        {/* Logo with scale/opacity pop */}
        <div
          className={`transition-all duration-500 ease-out ${
            showLogo
              ? 'opacity-100 scale-100'
              : 'opacity-0 scale-75'
          }`}
        >
          <img
            src={sultanstampLogo}
            alt="SultanStamp"
            className="w-24 h-24 md:w-32 md:h-32 object-contain rounded-lg shadow-2xl"
            style={{
              filter: 'drop-shadow(0 0 20px rgba(0,0,0,0.3))'
            }}
          />
        </div>

        {/* Brand name with left-to-right wipe reveal */}
        <div className="relative overflow-hidden">
          <h1
            className="text-3xl md:text-5xl font-bold tracking-wider"
            style={{
              fontFamily: "'Playfair Display', serif",
              color: '#000',
              textShadow: '0 2px 10px rgba(0,0,0,0.1)'
            }}
          >
            <span className="brand-text-reveal" style={{
              display: 'inline-block',
              clipPath: showText 
                ? 'inset(0 0 0 0)' 
                : 'inset(0 100% 0 0)',
              transition: 'clip-path 0.6s cubic-bezier(0.4, 0, 0.2, 1)'
            }}>
              SultanStamp
            </span>
          </h1>
        </div>
      </div>

      {/* Inline styles for ink animation */}
      <style>{`
        /* Main blob expansion animation - 0 to 1.2s */
        @keyframes blobExpand {
          0% {
            transform: scale(0);
            opacity: 0;
          }
          15% {
            opacity: 1;
          }
          60% {
            transform: scale(1.1);
          }
          80% {
            transform: scale(0.95);
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }

        /* Splatter fling animation - drops fly out and settle */
        @keyframes splatterFling {
          0% {
            transform: translate(calc(var(--start-x) - var(--end-x)), calc(var(--start-y) - var(--end-y))) scale(0);
            opacity: 0;
          }
          20% {
            opacity: 1;
            transform: translate(calc((var(--start-x) - var(--end-x)) * 0.3), calc((var(--start-y) - var(--end-y)) * 0.3)) scale(1.3);
          }
          60% {
            transform: translate(0, 0) scale(1.1);
          }
          80% {
            transform: translate(0, 0) scale(0.9);
          }
          100% {
            transform: translate(0, 0) scale(1);
            opacity: 1;
          }
        }

        /* Settle wobble for ink - 1.2s to 1.8s */
        @keyframes settleWobble {
          0%, 100% {
            transform: scale(1);
          }
          25% {
            transform: scale(1.02) rotate(0.5deg);
          }
          50% {
            transform: scale(0.99) rotate(-0.3deg);
          }
          75% {
            transform: scale(1.01) rotate(0.2deg);
          }
        }

        /* Highlight fade in */
        @keyframes highlightFadeIn {
          0% {
            opacity: 0;
          }
          100% {
            opacity: 1;
          }
        }

        .ink-blob-main {
          transform-origin: center;
          animation: blobExpand 1.2s cubic-bezier(0.34, 1.56, 0.64, 1) forwards,
                     settleWobble 0.6s ease-in-out 1.2s;
          opacity: 0;
        }

        .ink-splatter {
          transform-origin: center;
          animation: splatterFling 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
          opacity: 0;
        }

        /* Glossy highlights appear after splash settles */
        .highlight-main {
          animation: highlightFadeIn 0.4s ease-out 0.8s forwards;
        }

        .highlight-specular {
          animation: highlightFadeIn 0.3s ease-out 0.9s forwards;
        }

        .highlight-secondary {
          animation: highlightFadeIn 0.3s ease-out 1s forwards;
        }

        .highlight-spot {
          animation: highlightFadeIn 0.2s ease-out 1.1s forwards;
        }

        /* Premium text styling */
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&display=swap');
      `}</style>
    </div>
  );
};

export default GV_InkSplashOverlay;
export { SPLASH_SHOWN_KEY };
