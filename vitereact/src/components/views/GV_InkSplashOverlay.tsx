import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import sultanstampLogo from '@/assets/sultanstamp_logo.jpeg';

const SPLASH_SHOWN_KEY = 'sultanstamp_splash_shown';

interface GV_InkSplashOverlayProps {
  onComplete: () => void;
}

// Logo component with fallback
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
          background: 'linear-gradient(135deg, #1a1a1a 0%, #0a0a0a 100%)',
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

// Falling droplet configurations - sharp, irregular shapes
const fallingDroplets = [
  { id: 0, startX: 48, startY: -8, endX: 50, endY: 45, size: 14, delay: 0, rotation: 15 },
  { id: 1, startX: 52, startY: -12, endX: 48, endY: 48, size: 11, delay: 60, rotation: -20 },
  { id: 2, startX: 45, startY: -6, endX: 53, endY: 52, size: 9, delay: 120, rotation: 25 },
  { id: 3, startX: 55, startY: -10, endX: 46, endY: 50, size: 10, delay: 180, rotation: -15 },
  { id: 4, startX: 50, startY: -4, endX: 54, endY: 46, size: 12, delay: 250, rotation: 10 },
  { id: 5, startX: 47, startY: -9, endX: 49, endY: 51, size: 8, delay: 320, rotation: -30 },
];

// Generate an irregular ink drop shape (sharp, organic edges)
const generateInkDropPath = (cx: number, cy: number, baseSize: number, seed: number): string => {
  const points = 16 + Math.floor(seed % 8);
  const pathPoints: string[] = [];
  
  for (let i = 0; i <= points; i++) {
    const angle = (i / points) * Math.PI * 2;
    // Create sharp, irregular edges with varying amplitude
    const noise1 = Math.sin(angle * 3 + seed * 2.7) * 0.35;
    const noise2 = Math.cos(angle * 5 + seed * 1.3) * 0.2;
    const noise3 = Math.sin(angle * 7 + seed * 3.1) * 0.15;
    const noise4 = Math.cos(angle * 2 + seed * 0.7) * 0.25;
    
    // Add occasional sharp protrusions (drips)
    const dripFactor = Math.pow(Math.sin(angle * 4 + seed), 8) * 0.4;
    
    const radiusVariation = 1 + noise1 + noise2 + noise3 + noise4 + dripFactor;
    const radius = baseSize * radiusVariation * (0.85 + (seed % 10) / 30);
    
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    
    if (i === 0) {
      pathPoints.push(`M ${x.toFixed(2)} ${y.toFixed(2)}`);
    } else {
      pathPoints.push(`L ${x.toFixed(2)} ${y.toFixed(2)}`);
    }
  }
  pathPoints.push('Z');
  return pathPoints.join(' ');
};

// Generate organic main splash blob with dripping edges
const generateMainSplashPath = (progress: number, slideOffset: number): string => {
  const basePoints = 32;
  const pathPoints: string[] = [];
  
  const centerX = 50 - slideOffset * 55;
  const centerY = 50;
  const baseRadius = 48 * progress;
  
  for (let i = 0; i <= basePoints; i++) {
    const angle = (i / basePoints) * Math.PI * 2;
    
    // Multiple noise layers for organic look
    const noise1 = Math.sin(angle * 3 + 1.5) * 0.18;
    const noise2 = Math.cos(angle * 5 + 2.3) * 0.12;
    const noise3 = Math.sin(angle * 8 + 0.7) * 0.08;
    const noise4 = Math.cos(angle * 2 + 3.1) * 0.15;
    
    // Create dripping effect on bottom and left edges
    let dripEffect = 0;
    if (angle > Math.PI * 0.3 && angle < Math.PI * 0.8) {
      dripEffect = Math.pow(Math.sin((angle - Math.PI * 0.3) / 0.5 * Math.PI), 3) * 0.25;
    }
    if (angle > Math.PI * 1.1 && angle < Math.PI * 1.6) {
      dripEffect += Math.pow(Math.sin((angle - Math.PI * 1.1) / 0.5 * Math.PI), 4) * 0.2;
    }
    
    // Extra coverage on left side for slide reveal
    let leftExtension = 0;
    if (Math.cos(angle) < -0.3) {
      leftExtension = Math.abs(Math.cos(angle)) * 0.6 * progress;
    }
    
    const radiusVariation = 1 + noise1 + noise2 + noise3 + noise4 + dripEffect + leftExtension;
    const radius = baseRadius * radiusVariation;
    
    const x = centerX + Math.cos(angle) * radius;
    const y = centerY + Math.sin(angle) * radius;
    
    if (i === 0) {
      pathPoints.push(`M ${x.toFixed(2)} ${y.toFixed(2)}`);
    } else {
      pathPoints.push(`L ${x.toFixed(2)} ${y.toFixed(2)}`);
    }
  }
  pathPoints.push('Z');
  return pathPoints.join(' ');
};

// Splatter droplets configuration - various sizes for realistic effect
const splatters = [
  // Large splatters
  { id: 0, endX: 10, endY: 18, size: 7, delay: 420, seedOffset: 0 },
  { id: 1, endX: 88, endY: 12, size: 6, delay: 450, seedOffset: 1 },
  { id: 2, endX: 94, endY: 48, size: 8, delay: 400, seedOffset: 2 },
  { id: 3, endX: 6, endY: 68, size: 5, delay: 480, seedOffset: 3 },
  { id: 4, endX: 90, endY: 82, size: 6, delay: 440, seedOffset: 4 },
  { id: 5, endX: 12, endY: 88, size: 5, delay: 500, seedOffset: 5 },
  { id: 6, endX: 80, endY: 22, size: 5, delay: 470, seedOffset: 6 },
  // Medium splatters
  { id: 7, endX: 20, endY: 28, size: 4, delay: 520, seedOffset: 7 },
  { id: 8, endX: 78, endY: 75, size: 4, delay: 490, seedOffset: 8 },
  { id: 9, endX: 22, endY: 78, size: 3.5, delay: 540, seedOffset: 9 },
  { id: 10, endX: 4, endY: 42, size: 4.5, delay: 410, seedOffset: 10 },
  { id: 11, endX: 96, endY: 35, size: 5, delay: 430, seedOffset: 11 },
  { id: 12, endX: 16, endY: 58, size: 3.5, delay: 510, seedOffset: 12 },
  { id: 13, endX: 84, endY: 65, size: 4, delay: 460, seedOffset: 13 },
  // Small droplets
  { id: 14, endX: 8, endY: 32, size: 2.5, delay: 530, seedOffset: 14 },
  { id: 15, endX: 92, endY: 25, size: 2, delay: 550, seedOffset: 15 },
  { id: 16, endX: 2, endY: 75, size: 2.5, delay: 570, seedOffset: 16 },
  { id: 17, endX: 98, endY: 70, size: 2, delay: 590, seedOffset: 17 },
  { id: 18, endX: 25, endY: 15, size: 2, delay: 560, seedOffset: 18 },
  { id: 19, endX: 75, endY: 88, size: 2.5, delay: 580, seedOffset: 19 },
  // Tiny specks
  { id: 20, endX: 15, endY: 45, size: 1.5, delay: 600, seedOffset: 20 },
  { id: 21, endX: 85, endY: 40, size: 1.5, delay: 610, seedOffset: 21 },
  { id: 22, endX: 30, endY: 92, size: 1.5, delay: 620, seedOffset: 22 },
  { id: 23, endX: 70, endY: 8, size: 1.5, delay: 630, seedOffset: 23 },
  { id: 24, endX: 5, endY: 55, size: 2, delay: 640, seedOffset: 24 },
  { id: 25, endX: 95, endY: 58, size: 2, delay: 650, seedOffset: 25 },
];

// Additional secondary blobs for more coverage
const secondaryBlobs = [
  { id: 0, cx: 35, cy: 45, size: 18, delay: 500, seed: 1.5 },
  { id: 1, cx: 65, cy: 55, size: 16, delay: 520, seed: 2.3 },
  { id: 2, cx: 28, cy: 60, size: 14, delay: 560, seed: 3.1 },
  { id: 3, cx: 72, cy: 40, size: 15, delay: 540, seed: 4.7 },
  { id: 4, cx: 40, cy: 35, size: 12, delay: 580, seed: 5.2 },
  { id: 5, cx: 60, cy: 65, size: 13, delay: 600, seed: 6.8 },
  { id: 6, cx: 25, cy: 50, size: 16, delay: 620, seed: 7.4 },
  { id: 7, cx: 75, cy: 50, size: 14, delay: 640, seed: 8.1 },
  // Extended left coverage for slide
  { id: 8, cx: 15, cy: 45, size: 20, delay: 700, seed: 9.3 },
  { id: 9, cx: 5, cy: 55, size: 22, delay: 720, seed: 10.6 },
  { id: 10, cx: -5, cy: 50, size: 25, delay: 740, seed: 11.2 },
  { id: 11, cx: 10, cy: 30, size: 18, delay: 760, seed: 12.8 },
  { id: 12, cx: 10, cy: 70, size: 18, delay: 780, seed: 13.4 },
  { id: 13, cx: -10, cy: 35, size: 20, delay: 800, seed: 14.9 },
  { id: 14, cx: -10, cy: 65, size: 20, delay: 820, seed: 15.5 },
];

type Phase = 'droplets' | 'splash' | 'settle' | 'slide' | 'reveal' | 'fadeout' | 'done';

const GV_InkSplashOverlay: React.FC<GV_InkSplashOverlayProps> = ({ onComplete }) => {
  const [phase, setPhase] = useState<Phase>('droplets');
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [splashProgress, setSplashProgress] = useState(0);
  const [slideProgress, setSlideProgress] = useState(0);
  const [wobbleOffset, setWobbleOffset] = useState(0);
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  
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

  // Main animation loop using requestAnimationFrame
  const animate = useCallback((timestamp: number) => {
    if (!startTimeRef.current) {
      startTimeRef.current = timestamp;
    }
    
    const elapsed = timestamp - startTimeRef.current;
    
    // Update splash progress (0.4s - 1.2s)
    if (elapsed >= 400 && elapsed < 1200) {
      const splashElapsed = elapsed - 400;
      const progress = Math.min(splashElapsed / 800, 1);
      // Ease out with overshoot for splash effect
      const eased = 1 - Math.pow(1 - progress, 3);
      setSplashProgress(eased);
    } else if (elapsed >= 1200) {
      setSplashProgress(1);
    }
    
    // Wobble during settle phase (1.2s - 1.8s)
    if (elapsed >= 1200 && elapsed < 1800) {
      const wobbleElapsed = elapsed - 1200;
      const wobble = Math.sin(wobbleElapsed / 50) * Math.exp(-wobbleElapsed / 300) * 0.02;
      setWobbleOffset(wobble);
    } else if (elapsed >= 1800) {
      setWobbleOffset(0);
    }
    
    // Slide progress (1.8s - 2.7s)
    if (elapsed >= 1800 && elapsed < 2700) {
      const slideElapsed = elapsed - 1800;
      const progress = Math.min(slideElapsed / 900, 1);
      // Ease out cubic for organic feel
      const eased = 1 - Math.pow(1 - progress, 3);
      setSlideProgress(eased);
    } else if (elapsed >= 2700) {
      setSlideProgress(1);
    }
    
    // Continue animation
    if (elapsed < 3200) {
      animationRef.current = requestAnimationFrame(animate);
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
      setPhase('reveal');
      setSplashProgress(1);
      setSlideProgress(1);
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

    // Start animation loop
    animationRef.current = requestAnimationFrame(animate);

    // Timeline phase transitions
    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(setTimeout(() => setPhase('splash'), 400));
    timers.push(setTimeout(() => setPhase('settle'), 1200));
    timers.push(setTimeout(() => setPhase('slide'), 1800));
    timers.push(setTimeout(() => setPhase('reveal'), 2700));
    timers.push(setTimeout(() => {
      setIsFadingOut(true);
      setPhase('fadeout');
    }, 3200));
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
  }, [onComplete, prefersReducedMotion, animate]);

  // Don't render if already done
  if (phase === 'done') {
    return null;
  }

  const showSplash = phase !== 'droplets';
  const showLogo = phase === 'reveal' || phase === 'fadeout';
  const showSettle = phase === 'settle' || phase === 'slide' || phase === 'reveal' || phase === 'fadeout';

  return (
    <div
      className="fixed inset-0 z-[9999] cursor-pointer overflow-hidden"
      onClick={handleSkip}
      onTouchStart={handleSkip}
      style={{
        backgroundColor: '#ffffff',
        opacity: isFadingOut ? 0 : 1,
        transition: 'opacity 0.5s ease-out',
      }}
    >
      {/* Main SVG Ink Splash */}
      <svg 
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid slice"
        style={{ overflow: 'visible' }}
      >
        <defs>
          {/* Minimal gooey filter - only for blob merging, keeps edges sharp */}
          <filter id="gooey-merge" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="0.8" result="blur" />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="1 0 0 0 0
                      0 1 0 0 0
                      0 0 1 0 0
                      0 0 0 50 -25"
              result="goo"
            />
            <feBlend in="SourceGraphic" in2="goo" />
          </filter>

          {/* Sharp highlight for wet gloss */}
          <linearGradient id="wetGloss1" x1="0%" y1="0%" x2="50%" y2="50%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.7)" />
            <stop offset="30%" stopColor="rgba(255,255,255,0.3)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
          
          <linearGradient id="wetGloss2" x1="20%" y1="0%" x2="70%" y2="70%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.5)" />
            <stop offset="50%" stopColor="rgba(255,255,255,0.15)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>

          {/* Specular highlights */}
          <radialGradient id="specular" cx="30%" cy="25%" r="40%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.8)" />
            <stop offset="40%" stopColor="rgba(255,255,255,0.3)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </radialGradient>
        </defs>

        {/* Ink splash group with gooey merge filter */}
        <g filter="url(#gooey-merge)" transform={`scale(${1 + wobbleOffset})`} style={{ transformOrigin: 'center' }}>
          {/* Falling droplets - phase 0-0.4s */}
          {fallingDroplets.map((drop) => (
            <path
              key={`fall-${drop.id}`}
              d={generateInkDropPath(drop.endX, drop.endY, drop.size, drop.id * 2.7)}
              fill="#0a0a0a"
              className="ink-falling-drop"
              style={{
                '--start-y': `${drop.startY}`,
                '--end-y': `${drop.endY}`,
                '--rotation': `${drop.rotation}deg`,
                animationDelay: `${drop.delay}ms`,
              } as React.CSSProperties}
            />
          ))}

          {/* Main splash blob */}
          {showSplash && (
            <path
              d={generateMainSplashPath(splashProgress, slideProgress)}
              fill="#0a0a0a"
            />
          )}

          {/* Secondary blobs */}
          {showSplash && secondaryBlobs.map((blob) => {
            const blobX = blob.cx - slideProgress * 55;
            return (
              <path
                key={`blob-${blob.id}`}
                d={generateInkDropPath(blobX, blob.cy, blob.size * splashProgress, blob.seed)}
                fill="#0a0a0a"
                className="ink-blob-expand"
                style={{
                  animationDelay: `${blob.delay}ms`,
                }}
              />
            );
          })}

          {/* Splatter droplets */}
          {showSplash && splatters.map((drop) => {
            const dropX = drop.endX - slideProgress * (drop.endX > 50 ? 55 : 20);
            return (
              <path
                key={`splat-${drop.id}`}
                d={generateInkDropPath(dropX, drop.endY, drop.size, drop.seedOffset * 3.7)}
                fill="#0a0a0a"
                className="ink-splatter-drop"
                style={{
                  animationDelay: `${drop.delay}ms`,
                }}
              />
            );
          })}
        </g>

        {/* Wet gloss highlights - sharp, not blurred */}
        {showSettle && (
          <g style={{ transform: `translateX(${-slideProgress * 55}%)` }}>
            {/* Main gloss streaks */}
            <ellipse
              cx="35"
              cy="38"
              rx="12"
              ry="5"
              fill="url(#wetGloss1)"
              className="ink-highlight"
              style={{ opacity: 0.9 }}
            />
            <ellipse
              cx="48"
              cy="45"
              rx="8"
              ry="3"
              fill="url(#wetGloss2)"
              className="ink-highlight"
              style={{ opacity: 0.85, animationDelay: '100ms' }}
            />
            <ellipse
              cx="58"
              cy="52"
              rx="10"
              ry="4"
              fill="url(#wetGloss1)"
              className="ink-highlight"
              style={{ opacity: 0.8, animationDelay: '150ms' }}
            />
            
            {/* Bright specular spots */}
            <circle
              cx="33"
              cy="35"
              r="3"
              fill="url(#specular)"
              className="ink-highlight"
              style={{ animationDelay: '200ms' }}
            />
            <circle
              cx="50"
              cy="43"
              r="2"
              fill="rgba(255,255,255,0.7)"
              className="ink-highlight"
              style={{ animationDelay: '250ms' }}
            />
            <circle
              cx="42"
              cy="50"
              r="1.5"
              fill="rgba(255,255,255,0.65)"
              className="ink-highlight"
              style={{ animationDelay: '300ms' }}
            />
            
            {/* Tiny bright specks for wet texture */}
            <circle cx="30" cy="32" r="1" fill="rgba(255,255,255,0.8)" className="ink-highlight" style={{ animationDelay: '350ms' }} />
            <circle cx="55" cy="48" r="0.8" fill="rgba(255,255,255,0.75)" className="ink-highlight" style={{ animationDelay: '380ms' }} />
            <circle cx="40" cy="42" r="0.9" fill="rgba(255,255,255,0.7)" className="ink-highlight" style={{ animationDelay: '410ms' }} />
            <circle cx="46" cy="55" r="0.7" fill="rgba(255,255,255,0.65)" className="ink-highlight" style={{ animationDelay: '440ms' }} />
            <circle cx="62" cy="45" r="1.1" fill="rgba(255,255,255,0.6)" className="ink-highlight" style={{ animationDelay: '470ms' }} />
          </g>
        )}
      </svg>

      {/* Logo and brand lockup - positioned on LEFT over ink area */}
      <div 
        className="absolute inset-0 flex items-center justify-start z-10 pointer-events-none"
        style={{
          paddingLeft: '8%',
        }}
      >
        <div 
          className="flex items-center gap-4 sm:gap-6"
          style={{
            opacity: showLogo ? 1 : 0,
            transform: showLogo ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.9)',
            transition: 'opacity 0.4s ease-out, transform 0.4s ease-out',
          }}
        >
          {/* Logo image */}
          <LogoWithFallback
            src={sultanstampLogo}
            alt="SultanStamp"
            className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 object-cover rounded-lg"
            style={{
              boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
              border: '2px solid rgba(255,255,255,0.2)',
            }}
          />
          
          {/* Brand wordmark */}
          <h1
            className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-wide"
            style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              color: '#ffffff',
              textShadow: '0 2px 10px rgba(0,0,0,0.6)',
              letterSpacing: '0.05em',
            }}
          >
            SultanStamp
          </h1>
        </div>
      </div>

      {/* Right side - "Sultans" text on revealed white area */}
      {showLogo && (
        <div 
          className="absolute right-0 top-0 bottom-0 flex items-center justify-start z-10 pointer-events-none"
          style={{
            width: '50%',
            paddingLeft: '8%',
          }}
        >
          <h2
            className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-widest"
            style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              color: '#1a1a1a',
              opacity: showLogo ? 1 : 0,
              transform: showLogo ? 'translateX(0)' : 'translateX(-20px)',
              transition: 'opacity 0.5s ease-out 0.15s, transform 0.5s ease-out 0.15s',
              letterSpacing: '0.12em',
            }}
          >
            Sultans
          </h2>
        </div>
      )}

      {/* CSS Animations */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&display=swap');

        /* Falling droplets animation - 0 to 0.4s */
        @keyframes dropletFall {
          0% {
            transform: translateY(calc((var(--start-y) - var(--end-y)) * 1%)) rotate(0deg) scale(0.6);
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          70% {
            transform: translateY(0) rotate(var(--rotation)) scale(1.1);
          }
          85% {
            transform: translateY(0) rotate(calc(var(--rotation) * 0.5)) scale(0.95) scaleY(0.85) scaleX(1.1);
          }
          100% {
            transform: translateY(0) rotate(0deg) scale(1);
            opacity: 1;
          }
        }

        .ink-falling-drop {
          animation: dropletFall 0.38s cubic-bezier(0.4, 0, 0.2, 1) forwards;
          opacity: 0;
        }

        /* Blob expansion animation */
        @keyframes blobExpand {
          0% {
            transform: scale(0);
            opacity: 0;
          }
          15% {
            opacity: 1;
          }
          50% {
            transform: scale(1.1);
          }
          70% {
            transform: scale(0.95);
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }

        .ink-blob-expand {
          animation: blobExpand 0.65s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
          opacity: 0;
        }

        /* Splatter droplets fling outward */
        @keyframes splatterFling {
          0% {
            transform: scale(0) translate(0, 0);
            opacity: 0;
          }
          15% {
            opacity: 1;
          }
          60% {
            transform: scale(1.15);
          }
          80% {
            transform: scale(0.9);
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }

        .ink-splatter-drop {
          animation: splatterFling 0.55s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
          opacity: 0;
        }

        /* Highlight fade in */
        @keyframes highlightAppear {
          0% {
            opacity: 0;
          }
          100% {
            opacity: 1;
          }
        }

        .ink-highlight {
          animation: highlightAppear 0.3s ease-out forwards;
          opacity: 0;
        }

        /* Prefers reduced motion */
        @media (prefers-reduced-motion: reduce) {
          .ink-falling-drop,
          .ink-blob-expand,
          .ink-splatter-drop,
          .ink-highlight {
            animation: none !important;
            opacity: 1 !important;
            transform: none !important;
          }
        }
      `}</style>
    </div>
  );
};

export default GV_InkSplashOverlay;
export { SPLASH_SHOWN_KEY };
