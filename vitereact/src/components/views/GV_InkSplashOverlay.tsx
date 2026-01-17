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

// Generate smooth organic ink drop using cubic Bezier curves
const generateInkDropPath = (cx: number, cy: number, baseSize: number, seed: number): string => {
  const points = 12 + Math.floor(seed % 6); // Number of anchor points
  const anchors: { x: number; y: number; r: number }[] = [];
  
  // Generate anchor points with organic radius variation
  for (let i = 0; i < points; i++) {
    const angle = (i / points) * Math.PI * 2;
    // Smooth noise using multiple sine waves at different frequencies
    const noise1 = Math.sin(angle * 2 + seed * 1.7) * 0.22;
    const noise2 = Math.cos(angle * 3 + seed * 2.3) * 0.15;
    const noise3 = Math.sin(angle * 5 + seed * 0.9) * 0.1;
    
    // Organic lobe bulges (rounded protrusions)
    const lobeFactor = Math.pow(Math.cos(angle * 2 + seed * 0.5), 2) * 0.2;
    
    const radiusVariation = 1 + noise1 + noise2 + noise3 + lobeFactor;
    const radius = baseSize * radiusVariation * (0.9 + (seed % 10) / 40);
    
    anchors.push({
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius,
      r: radius
    });
  }
  
  // Build smooth cubic Bezier path through all anchor points
  const pathParts: string[] = [];
  const tension = 0.35; // Controls curve smoothness (lower = rounder)
  
  for (let i = 0; i < points; i++) {
    const p0 = anchors[(i - 1 + points) % points];
    const p1 = anchors[i];
    const p2 = anchors[(i + 1) % points];
    const p3 = anchors[(i + 2) % points];
    
    if (i === 0) {
      pathParts.push(`M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`);
    }
    
    // Catmull-Rom to Bezier conversion for smooth curves
    const cp1x = p1.x + (p2.x - p0.x) * tension;
    const cp1y = p1.y + (p2.y - p0.y) * tension;
    const cp2x = p2.x - (p3.x - p1.x) * tension;
    const cp2y = p2.y - (p3.y - p1.y) * tension;
    
    pathParts.push(`C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`);
  }
  
  pathParts.push('Z');
  return pathParts.join(' ');
};

// Generate teardrop-shaped droplet (small organic droplet)
const generateTeardropPath = (cx: number, cy: number, size: number, angle: number): string => {
  const tipLength = size * 1.8;
  const bulbRadius = size * 0.6;
  
  // Teardrop pointing in the given angle direction
  const tipX = cx + Math.cos(angle) * tipLength;
  const tipY = cy + Math.sin(angle) * tipLength;
  
  // Perpendicular for bulb sides
  const perpAngle = angle + Math.PI / 2;
  const sideX = Math.cos(perpAngle) * bulbRadius;
  const sideY = Math.sin(perpAngle) * bulbRadius;
  
  // Control points for smooth teardrop shape
  const backAngle = angle + Math.PI;
  const backX = cx + Math.cos(backAngle) * bulbRadius * 0.3;
  const backY = cy + Math.sin(backAngle) * bulbRadius * 0.3;
  
  return `M ${tipX.toFixed(2)} ${tipY.toFixed(2)} 
          Q ${cx.toFixed(2)} ${cy.toFixed(2)} ${(cx + sideX).toFixed(2)} ${(cy + sideY).toFixed(2)}
          Q ${backX.toFixed(2)} ${backY.toFixed(2)} ${(cx - sideX).toFixed(2)} ${(cy - sideY).toFixed(2)}
          Q ${cx.toFixed(2)} ${cy.toFixed(2)} ${tipX.toFixed(2)} ${tipY.toFixed(2)} Z`;
};

// Generate tendril/drip path extending outward
const generateTendrilPath = (startX: number, startY: number, length: number, angle: number, thickness: number, seed: number): string => {
  const segments = 6;
  const points: { x: number; y: number }[] = [];
  
  // Generate tendril centerline with slight curve
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const wobble = Math.sin(t * Math.PI * 2 + seed) * (1 - t) * thickness * 0.5;
    const perpAngle = angle + Math.PI / 2;
    
    points.push({
      x: startX + Math.cos(angle) * length * t + Math.cos(perpAngle) * wobble,
      y: startY + Math.sin(angle) * length * t + Math.sin(perpAngle) * wobble
    });
  }
  
  // Build path with tapering thickness
  const leftSide: string[] = [];
  const rightSide: string[] = [];
  
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const currentThickness = thickness * (1 - t * 0.85); // Taper to thin tip
    const perpAngle = angle + Math.PI / 2;
    
    const lx = points[i].x + Math.cos(perpAngle) * currentThickness;
    const ly = points[i].y + Math.sin(perpAngle) * currentThickness;
    const rx = points[i].x - Math.cos(perpAngle) * currentThickness;
    const ry = points[i].y - Math.sin(perpAngle) * currentThickness;
    
    leftSide.push(`${lx.toFixed(2)} ${ly.toFixed(2)}`);
    rightSide.unshift(`${rx.toFixed(2)} ${ry.toFixed(2)}`);
  }
  
  // Create smooth path using quadratic curves
  let path = `M ${leftSide[0]}`;
  for (let i = 1; i < leftSide.length; i++) {
    const [prevX, prevY] = leftSide[i - 1].split(' ').map(Number);
    const [currX, currY] = leftSide[i].split(' ').map(Number);
    const cpX = (prevX + currX) / 2;
    const cpY = (prevY + currY) / 2;
    path += ` Q ${prevX.toFixed(2)} ${prevY.toFixed(2)} ${cpX.toFixed(2)} ${cpY.toFixed(2)}`;
  }
  path += ` L ${leftSide[leftSide.length - 1]}`;
  
  // Round tip
  const tipIdx = leftSide.length - 1;
  path += ` Q ${points[segments].x.toFixed(2)} ${(points[segments].y + thickness * 0.1).toFixed(2)} ${rightSide[0]}`;
  
  // Right side back
  for (let i = 1; i < rightSide.length; i++) {
    const [prevX, prevY] = rightSide[i - 1].split(' ').map(Number);
    const [currX, currY] = rightSide[i].split(' ').map(Number);
    const cpX = (prevX + currX) / 2;
    const cpY = (prevY + currY) / 2;
    path += ` Q ${prevX.toFixed(2)} ${prevY.toFixed(2)} ${cpX.toFixed(2)} ${cpY.toFixed(2)}`;
  }
  path += ' Z';
  
  return path;
};

// Generate organic main splash blob with smooth Bezier curves
const generateMainSplashPath = (progress: number, slideOffset: number): string => {
  const numPoints = 24; // Anchor points for smooth organic shape
  const anchors: { x: number; y: number }[] = [];
  
  const centerX = 50 - slideOffset * 55;
  const centerY = 50;
  const baseRadius = 48 * progress;
  
  for (let i = 0; i < numPoints; i++) {
    const angle = (i / numPoints) * Math.PI * 2;
    
    // Smooth organic noise using sine waves
    const noise1 = Math.sin(angle * 2 + 1.2) * 0.15;
    const noise2 = Math.cos(angle * 3 + 2.1) * 0.12;
    const noise3 = Math.sin(angle * 5 + 0.5) * 0.08;
    
    // Organic lobe bulges (rounded, not sharp)
    const lobe1 = Math.pow(Math.cos(angle * 1.5 + 0.8), 4) * 0.18;
    const lobe2 = Math.pow(Math.cos(angle * 2 + 2.5), 4) * 0.12;
    
    // Gentle drip extensions (organic rounded protrusions)
    let dripEffect = 0;
    if (angle > Math.PI * 0.4 && angle < Math.PI * 0.7) {
      const t = (angle - Math.PI * 0.4) / (Math.PI * 0.3);
      dripEffect = Math.sin(t * Math.PI) * 0.2;
    }
    if (angle > Math.PI * 1.2 && angle < Math.PI * 1.5) {
      const t = (angle - Math.PI * 1.2) / (Math.PI * 0.3);
      dripEffect += Math.sin(t * Math.PI) * 0.15;
    }
    
    // Extra coverage on left side for slide reveal
    let leftExtension = 0;
    if (Math.cos(angle) < -0.3) {
      leftExtension = Math.abs(Math.cos(angle)) * 0.5 * progress;
    }
    
    const radiusVariation = 1 + noise1 + noise2 + noise3 + lobe1 + lobe2 + dripEffect + leftExtension;
    const radius = baseRadius * radiusVariation;
    
    anchors.push({
      x: centerX + Math.cos(angle) * radius,
      y: centerY + Math.sin(angle) * radius
    });
  }
  
  // Build smooth cubic Bezier path through all anchor points
  const pathParts: string[] = [];
  const tension = 0.3;
  
  for (let i = 0; i < numPoints; i++) {
    const p0 = anchors[(i - 1 + numPoints) % numPoints];
    const p1 = anchors[i];
    const p2 = anchors[(i + 1) % numPoints];
    const p3 = anchors[(i + 2) % numPoints];
    
    if (i === 0) {
      pathParts.push(`M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`);
    }
    
    // Catmull-Rom to Bezier conversion
    const cp1x = p1.x + (p2.x - p0.x) * tension;
    const cp1y = p1.y + (p2.y - p0.y) * tension;
    const cp2x = p2.x - (p3.x - p1.x) * tension;
    const cp2y = p2.y - (p3.y - p1.y) * tension;
    
    pathParts.push(`C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`);
  }
  
  pathParts.push('Z');
  return pathParts.join(' ');
};

// Tendril configurations extending from main splash
const tendrilConfigs = [
  { startX: 50, startY: 75, length: 12, angle: Math.PI * 0.55, thickness: 1.2, seed: 1.2 },
  { startX: 30, startY: 65, length: 10, angle: Math.PI * 0.65, thickness: 1.0, seed: 2.4 },
  { startX: 70, startY: 60, length: 8, angle: Math.PI * 0.35, thickness: 0.9, seed: 3.1 },
  { startX: 25, startY: 50, length: 9, angle: Math.PI * 0.85, thickness: 0.8, seed: 4.5 },
];

// Teardrop droplet configurations (scattered around splash)
const teardropConfigs = [
  { cx: 15, cy: 25, size: 2.5, angle: Math.PI * 1.3 },
  { cx: 85, cy: 20, size: 2.0, angle: Math.PI * 1.7 },
  { cx: 90, cy: 55, size: 2.2, angle: Math.PI * 0.1 },
  { cx: 12, cy: 70, size: 1.8, angle: Math.PI * 1.1 },
  { cx: 88, cy: 78, size: 2.3, angle: Math.PI * 0.3 },
  { cx: 8, cy: 45, size: 1.5, angle: Math.PI * 1.0 },
  { cx: 92, cy: 35, size: 1.6, angle: Math.PI * 1.8 },
  { cx: 20, cy: 85, size: 2.0, angle: Math.PI * 0.7 },
  { cx: 78, cy: 88, size: 1.7, angle: Math.PI * 0.4 },
  { cx: 5, cy: 60, size: 1.4, angle: Math.PI * 1.2 },
  { cx: 95, cy: 65, size: 1.5, angle: Math.PI * 1.9 },
  { cx: 25, cy: 12, size: 1.3, angle: Math.PI * 1.5 },
];

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
          {/* Minimal gooey filter - for organic blob merging with smooth edges */}
          <filter id="gooey-merge" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="0.6" result="blur" />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="1 0 0 0 0
                      0 1 0 0 0
                      0 0 1 0 0
                      0 0 0 60 -30"
              result="goo"
            />
            <feBlend in="SourceGraphic" in2="goo" />
          </filter>

          {/* Wet ink glossy gradient - primary highlight streak */}
          <linearGradient id="wetGloss1" x1="0%" y1="0%" x2="60%" y2="60%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.55)" />
            <stop offset="25%" stopColor="rgba(255,255,255,0.25)" />
            <stop offset="60%" stopColor="rgba(255,255,255,0.08)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
          
          {/* Secondary wet gloss - softer highlight */}
          <linearGradient id="wetGloss2" x1="10%" y1="0%" x2="80%" y2="80%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.4)" />
            <stop offset="40%" stopColor="rgba(255,255,255,0.12)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
          
          {/* Edge rim light for liquid depth */}
          <linearGradient id="rimLight" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(255,255,255,0)" />
            <stop offset="70%" stopColor="rgba(255,255,255,0.05)" />
            <stop offset="90%" stopColor="rgba(255,255,255,0.15)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.25)" />
          </linearGradient>

          {/* Specular highlight spots - bright point reflections */}
          <radialGradient id="specular" cx="35%" cy="30%" r="35%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.65)" />
            <stop offset="35%" stopColor="rgba(255,255,255,0.25)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </radialGradient>
          
          {/* Small sharp specular for wet texture */}
          <radialGradient id="specularSharp" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.8)" />
            <stop offset="20%" stopColor="rgba(255,255,255,0.4)" />
            <stop offset="50%" stopColor="rgba(255,255,255,0.1)" />
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

          {/* Splatter droplets - organic blobs */}
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

          {/* Tendrils/drips extending from main splash */}
          {showSplash && tendrilConfigs.map((tendril, idx) => {
            const tendrilX = tendril.startX - slideProgress * 55;
            return (
              <path
                key={`tendril-${idx}`}
                d={generateTendrilPath(
                  tendrilX,
                  tendril.startY,
                  tendril.length * splashProgress,
                  tendril.angle,
                  tendril.thickness,
                  tendril.seed
                )}
                fill="#0a0a0a"
                className="ink-tendril"
                style={{
                  animationDelay: `${500 + idx * 80}ms`,
                }}
              />
            );
          })}

          {/* Teardrop-shaped scattered droplets */}
          {showSplash && teardropConfigs.map((drop, idx) => {
            const dropX = drop.cx - slideProgress * (drop.cx > 50 ? 55 : 20);
            return (
              <path
                key={`teardrop-${idx}`}
                d={generateTeardropPath(dropX, drop.cy, drop.size * splashProgress, drop.angle)}
                fill="#0a0a0a"
                className="ink-teardrop"
                style={{
                  animationDelay: `${550 + idx * 50}ms`,
                }}
              />
            );
          })}
        </g>

        {/* Wet gloss highlights - glossy liquid effect */}
        {showSettle && (
          <g style={{ transform: `translateX(${-slideProgress * 55}%)` }}>
            {/* Primary gloss streaks - organic curved shapes */}
            <ellipse
              cx="35"
              cy="38"
              rx="14"
              ry="4.5"
              fill="url(#wetGloss1)"
              className="ink-highlight"
              style={{ opacity: 0.85 }}
              transform="rotate(-15 35 38)"
            />
            <ellipse
              cx="48"
              cy="44"
              rx="10"
              ry="3.5"
              fill="url(#wetGloss2)"
              className="ink-highlight"
              style={{ opacity: 0.75, animationDelay: '80ms' }}
              transform="rotate(-10 48 44)"
            />
            <ellipse
              cx="58"
              cy="50"
              rx="11"
              ry="4"
              fill="url(#wetGloss1)"
              className="ink-highlight"
              style={{ opacity: 0.7, animationDelay: '120ms' }}
              transform="rotate(-20 58 50)"
            />
            
            {/* Secondary smaller gloss streaks */}
            <ellipse
              cx="28"
              cy="48"
              rx="6"
              ry="2.5"
              fill="url(#wetGloss2)"
              className="ink-highlight"
              style={{ opacity: 0.6, animationDelay: '160ms' }}
              transform="rotate(-8 28 48)"
            />
            <ellipse
              cx="65"
              cy="42"
              rx="7"
              ry="2.8"
              fill="url(#wetGloss1)"
              className="ink-highlight"
              style={{ opacity: 0.55, animationDelay: '200ms' }}
              transform="rotate(-25 65 42)"
            />
            
            {/* Main specular highlight spots - bright point reflections */}
            <circle
              cx="33"
              cy="36"
              r="2.8"
              fill="url(#specular)"
              className="ink-highlight"
              style={{ animationDelay: '180ms' }}
            />
            <circle
              cx="50"
              cy="42"
              r="2.2"
              fill="url(#specularSharp)"
              className="ink-highlight"
              style={{ animationDelay: '220ms' }}
            />
            <circle
              cx="42"
              cy="49"
              r="1.8"
              fill="url(#specular)"
              className="ink-highlight"
              style={{ animationDelay: '260ms' }}
            />
            
            {/* Small bright specks for wet texture detail */}
            <circle cx="30" cy="33" r="1.2" fill="url(#specularSharp)" className="ink-highlight" style={{ animationDelay: '300ms' }} />
            <circle cx="55" cy="46" r="1.0" fill="rgba(255,255,255,0.6)" className="ink-highlight" style={{ animationDelay: '330ms' }} />
            <circle cx="38" cy="41" r="1.1" fill="rgba(255,255,255,0.55)" className="ink-highlight" style={{ animationDelay: '360ms' }} />
            <circle cx="46" cy="54" r="0.9" fill="rgba(255,255,255,0.5)" className="ink-highlight" style={{ animationDelay: '390ms' }} />
            <circle cx="62" cy="44" r="1.3" fill="url(#specularSharp)" className="ink-highlight" style={{ animationDelay: '420ms' }} />
            <circle cx="25" cy="55" r="0.8" fill="rgba(255,255,255,0.45)" className="ink-highlight" style={{ animationDelay: '450ms' }} />
            <circle cx="70" cy="52" r="0.7" fill="rgba(255,255,255,0.4)" className="ink-highlight" style={{ animationDelay: '480ms' }} />
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

        /* Tendril/drip grow animation */
        @keyframes tendrilGrow {
          0% {
            transform: scaleY(0);
            transform-origin: top center;
            opacity: 0;
          }
          20% {
            opacity: 1;
          }
          100% {
            transform: scaleY(1);
            opacity: 1;
          }
        }

        .ink-tendril {
          animation: tendrilGrow 0.5s cubic-bezier(0.4, 0, 0.2, 1) forwards;
          opacity: 0;
        }

        /* Teardrop droplet animation */
        @keyframes teardropAppear {
          0% {
            transform: scale(0);
            opacity: 0;
          }
          30% {
            opacity: 1;
          }
          70% {
            transform: scale(1.2);
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }

        .ink-teardrop {
          animation: teardropAppear 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
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
          .ink-tendril,
          .ink-teardrop,
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
