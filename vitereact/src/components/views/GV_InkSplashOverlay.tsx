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

// Seeded random for consistent splatter generation
const seededRandom = (seed: number): number => {
  const x = Math.sin(seed * 9999) * 10000;
  return x - Math.floor(x);
};

// Perlin-like smooth noise for organic edges
const smoothNoise = (angle: number, seed: number, frequency: number = 1): number => {
  const n1 = Math.sin(angle * frequency + seed * 1.7) * 0.5;
  const n2 = Math.cos(angle * (frequency * 0.7) + seed * 2.3) * 0.3;
  const n3 = Math.sin(angle * (frequency * 1.5) + seed * 0.9) * 0.2;
  return n1 + n2 + n3;
};

// Generate smooth organic main body using cubic bezier curves
// This creates an amoeba/ink blot shape with undulating edges
const generateOrganicMainBody = (
  cx: number,
  cy: number,
  baseRadius: number,
  seed: number,
  numPoints: number = 36
): string => {
  const points: { x: number; y: number }[] = [];
  
  for (let i = 0; i < numPoints; i++) {
    const angle = (i / numPoints) * Math.PI * 2;
    
    // Multiple low-frequency noise layers for smooth organic undulation
    const noise = smoothNoise(angle, seed, 2) * 0.25 +
                  smoothNoise(angle, seed + 10, 3) * 0.15 +
                  smoothNoise(angle, seed + 20, 1.5) * 0.1;
    
    const radius = baseRadius * (0.7 + noise * 0.5);
    
    points.push({
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius
    });
  }
  
  // Close the loop smoothly
  points.push(points[0]);
  
  // Build smooth cubic bezier path
  let path = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? points.length - 2 : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[(i + 2) % (points.length - 1)];
    
    // Catmull-Rom to Bezier control points
    const tension = 0.4;
    const cp1x = p1.x + (p2.x - p0.x) * tension / 6;
    const cp1y = p1.y + (p2.y - p0.y) * tension / 6;
    const cp2x = p2.x - (p3.x - p1.x) * tension / 6;
    const cp2y = p2.y - (p3.y - p1.y) * tension / 6;
    
    path += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)} ${cp2x.toFixed(2)} ${cp2y.toFixed(2)} ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  
  return path + ' Z';
};

// Generate a smooth curved tendril with bulbous rounded tip (like dripping honey/syrup)
// Uses cubic bezier curves - NO straight segments
const generateFluidTendril = (
  startX: number,
  startY: number,
  angle: number,
  length: number,
  baseWidth: number,
  seed: number
): string => {
  // Curve variation for organic flow
  const curveOffset = length * 0.3 * (seededRandom(seed) - 0.5);
  const curveOffset2 = length * 0.2 * (seededRandom(seed + 1) - 0.5);
  
  const perpAngle = angle + Math.PI / 2;
  
  // Points along the tendril
  const t1 = 0.33;
  const t2 = 0.66;
  
  // Mid points with curve
  const mid1X = startX + Math.cos(angle) * length * t1 + Math.cos(perpAngle) * curveOffset * t1;
  const mid1Y = startY + Math.sin(angle) * length * t1 + Math.sin(perpAngle) * curveOffset * t1;
  
  const mid2X = startX + Math.cos(angle) * length * t2 + Math.cos(perpAngle) * (curveOffset + curveOffset2) * t2;
  const mid2Y = startY + Math.sin(angle) * length * t2 + Math.sin(perpAngle) * (curveOffset + curveOffset2) * t2;
  
  // End point (center of bulbous tip)
  const endX = startX + Math.cos(angle) * length + Math.cos(perpAngle) * (curveOffset + curveOffset2);
  const endY = startY + Math.sin(angle) * length + Math.sin(perpAngle) * (curveOffset + curveOffset2);
  
  // Widths that taper then bulge
  const width1 = baseWidth * 0.85;
  const width2 = baseWidth * 0.5;
  const bulbSize = baseWidth * (0.7 + seededRandom(seed + 2) * 0.4); // Bulbous rounded tip
  
  // Calculate perpendicular offsets for the edges
  const perpCos = Math.cos(perpAngle);
  const perpSin = Math.sin(perpAngle);
  
  // Left edge points (going outward)
  const startL = { x: startX + perpCos * baseWidth, y: startY + perpSin * baseWidth };
  const mid1L = { x: mid1X + perpCos * width1, y: mid1Y + perpSin * width1 };
  const mid2L = { x: mid2X + perpCos * width2, y: mid2Y + perpSin * width2 };
  
  // Right edge points (going outward)
  const startR = { x: startX - perpCos * baseWidth, y: startY - perpSin * baseWidth };
  const mid1R = { x: mid1X - perpCos * width1, y: mid1Y - perpSin * width1 };
  const mid2R = { x: mid2X - perpCos * width2, y: mid2Y - perpSin * width2 };
  
  // Bulbous tip points (rounded water droplet shape)
  const tipExtend = bulbSize * 0.6;
  const tipX = endX + Math.cos(angle) * tipExtend;
  const tipY = endY + Math.sin(angle) * tipExtend;
  
  const bulbL = { x: endX + perpCos * bulbSize * 0.8, y: endY + perpSin * bulbSize * 0.8 };
  const bulbR = { x: endX - perpCos * bulbSize * 0.8, y: endY - perpSin * bulbSize * 0.8 };
  
  // Build the smooth path with cubic beziers
  return `
    M ${startL.x.toFixed(2)} ${startL.y.toFixed(2)}
    C ${startL.x.toFixed(2)} ${startL.y.toFixed(2)} ${mid1L.x.toFixed(2)} ${mid1L.y.toFixed(2)} ${mid1L.x.toFixed(2)} ${mid1L.y.toFixed(2)}
    C ${mid1L.x.toFixed(2)} ${mid1L.y.toFixed(2)} ${mid2L.x.toFixed(2)} ${mid2L.y.toFixed(2)} ${mid2L.x.toFixed(2)} ${mid2L.y.toFixed(2)}
    Q ${mid2L.x.toFixed(2)} ${mid2L.y.toFixed(2)} ${bulbL.x.toFixed(2)} ${bulbL.y.toFixed(2)}
    C ${(bulbL.x + tipX) / 2} ${(bulbL.y + tipY) / 2} ${tipX.toFixed(2)} ${tipY.toFixed(2)} ${tipX.toFixed(2)} ${tipY.toFixed(2)}
    C ${tipX.toFixed(2)} ${tipY.toFixed(2)} ${(bulbR.x + tipX) / 2} ${(bulbR.y + tipY) / 2} ${bulbR.x.toFixed(2)} ${bulbR.y.toFixed(2)}
    Q ${mid2R.x.toFixed(2)} ${mid2R.y.toFixed(2)} ${mid2R.x.toFixed(2)} ${mid2R.y.toFixed(2)}
    C ${mid2R.x.toFixed(2)} ${mid2R.y.toFixed(2)} ${mid1R.x.toFixed(2)} ${mid1R.y.toFixed(2)} ${mid1R.x.toFixed(2)} ${mid1R.y.toFixed(2)}
    C ${mid1R.x.toFixed(2)} ${mid1R.y.toFixed(2)} ${startR.x.toFixed(2)} ${startR.y.toFixed(2)} ${startR.x.toFixed(2)} ${startR.y.toFixed(2)}
    Z
  `;
};

// Generate smooth satellite droplet - perfect circle or soft teardrop with tail
const generateSatelliteDroplet = (
  cx: number,
  cy: number,
  size: number,
  seed: number,
  hasTail: boolean = false,
  tailAngle: number = Math.PI / 4
): string => {
  if (hasTail) {
    // Teardrop with flying tail
    const tailLength = size * (1.5 + seededRandom(seed) * 1.5);
    const tailWidth = size * 0.25;
    
    // Main droplet body (circular)
    const kappa = 0.5522847498;
    const ox = size * kappa;
    const oy = size * kappa;
    
    // Tail points
    const tailEndX = cx + Math.cos(tailAngle) * tailLength;
    const tailEndY = cy + Math.sin(tailAngle) * tailLength;
    const tailPerpAngle = tailAngle + Math.PI / 2;
    
    const tailStartL = cx + Math.cos(tailPerpAngle) * tailWidth + Math.cos(tailAngle) * size * 0.5;
    const tailStartLY = cy + Math.sin(tailPerpAngle) * tailWidth + Math.sin(tailAngle) * size * 0.5;
    const tailStartR = cx - Math.cos(tailPerpAngle) * tailWidth + Math.cos(tailAngle) * size * 0.5;
    const tailStartRY = cy - Math.sin(tailPerpAngle) * tailWidth + Math.sin(tailAngle) * size * 0.5;
    
    return `
      M ${cx.toFixed(2)} ${(cy - size).toFixed(2)}
      C ${(cx + ox).toFixed(2)} ${(cy - size).toFixed(2)} ${(cx + size).toFixed(2)} ${(cy - oy).toFixed(2)} ${(cx + size).toFixed(2)} ${cy.toFixed(2)}
      C ${(cx + size).toFixed(2)} ${(cy + oy).toFixed(2)} ${(cx + ox).toFixed(2)} ${(cy + size).toFixed(2)} ${cx.toFixed(2)} ${(cy + size).toFixed(2)}
      C ${(cx - ox).toFixed(2)} ${(cy + size).toFixed(2)} ${(cx - size).toFixed(2)} ${(cy + oy).toFixed(2)} ${(cx - size).toFixed(2)} ${cy.toFixed(2)}
      C ${(cx - size).toFixed(2)} ${(cy - oy).toFixed(2)} ${(cx - ox).toFixed(2)} ${(cy - size).toFixed(2)} ${cx.toFixed(2)} ${(cy - size).toFixed(2)}
      Z
      M ${tailStartL.toFixed(2)} ${tailStartLY.toFixed(2)}
      Q ${tailEndX.toFixed(2)} ${tailEndY.toFixed(2)} ${tailEndX.toFixed(2)} ${tailEndY.toFixed(2)}
      Q ${tailEndX.toFixed(2)} ${tailEndY.toFixed(2)} ${tailStartR.toFixed(2)} ${tailStartRY.toFixed(2)}
      Z
    `;
  }
  
  // Perfect circle/oval using cubic bezier approximation
  const aspectRatio = 0.9 + seededRandom(seed) * 0.2;
  const rx = size;
  const ry = size * aspectRatio;
  const rotation = seededRandom(seed + 1) * 20 - 10;
  
  const kappa = 0.5522847498;
  const ox = rx * kappa;
  const oy = ry * kappa;
  
  const rotRad = rotation * Math.PI / 180;
  const cos = Math.cos(rotRad);
  const sin = Math.sin(rotRad);
  
  const transform = (x: number, y: number) => ({
    x: cx + x * cos - y * sin,
    y: cy + x * sin + y * cos
  });
  
  const top = transform(0, -ry);
  const right = transform(rx, 0);
  const bottom = transform(0, ry);
  const left = transform(-rx, 0);
  
  const topRight = transform(ox, -ry);
  const rightTop = transform(rx, -oy);
  const rightBottom = transform(rx, oy);
  const bottomRight = transform(ox, ry);
  const bottomLeft = transform(-ox, ry);
  const leftBottom = transform(-rx, oy);
  const leftTop = transform(-rx, -oy);
  const topLeft = transform(-ox, -ry);
  
  return `
    M ${top.x.toFixed(2)} ${top.y.toFixed(2)}
    C ${topRight.x.toFixed(2)} ${topRight.y.toFixed(2)} ${rightTop.x.toFixed(2)} ${rightTop.y.toFixed(2)} ${right.x.toFixed(2)} ${right.y.toFixed(2)}
    C ${rightBottom.x.toFixed(2)} ${rightBottom.y.toFixed(2)} ${bottomRight.x.toFixed(2)} ${bottomRight.y.toFixed(2)} ${bottom.x.toFixed(2)} ${bottom.y.toFixed(2)}
    C ${bottomLeft.x.toFixed(2)} ${bottomLeft.y.toFixed(2)} ${leftBottom.x.toFixed(2)} ${leftBottom.y.toFixed(2)} ${left.x.toFixed(2)} ${left.y.toFixed(2)}
    C ${leftTop.x.toFixed(2)} ${leftTop.y.toFixed(2)} ${topLeft.x.toFixed(2)} ${topLeft.y.toFixed(2)} ${top.x.toFixed(2)} ${top.y.toFixed(2)}
    Z
  `;
};

// Generate thin connecting strand (surface tension thread)
const generateConnectingStrand = (
  x1: number, y1: number,
  x2: number, y2: number,
  seed: number
): string => {
  const midX = (x1 + x2) / 2 + (seededRandom(seed) - 0.5) * 10;
  const midY = (y1 + y2) / 2 + (seededRandom(seed + 1) - 0.5) * 10;
  
  // Slight bulge in the middle
  const thickness = 0.3 + seededRandom(seed + 2) * 0.3;
  
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const perpAngle = angle + Math.PI / 2;
  
  const bulgeX = midX + Math.cos(perpAngle) * thickness;
  const bulgeY = midY + Math.sin(perpAngle) * thickness;
  
  return `
    M ${x1.toFixed(2)} ${y1.toFixed(2)}
    Q ${bulgeX.toFixed(2)} ${bulgeY.toFixed(2)} ${x2.toFixed(2)} ${y2.toFixed(2)}
  `;
};

// Configuration for tendrils
interface TendrilConfig {
  angle: number;
  length: number;
  width: number;
  seed: number;
}

// Generate the complete liquid paint splatter
const generateLiquidSplatter = (
  cx: number,
  cy: number,
  progress: number,
  slideOffset: number = 0
): { mainPath: string; tendrils: TendrilConfig[]; tendrilPaths: string[] } => {
  const centerX = cx - slideOffset * 55;
  const centerY = cy;
  const baseRadius = 35 * progress;
  
  // Generate main organic body
  const mainPath = generateOrganicMainBody(centerX, centerY, baseRadius, 42);
  
  // Generate 14 tendrils with varying characteristics
  const numTendrils = 14;
  const tendrils: TendrilConfig[] = [];
  const tendrilPaths: string[] = [];
  
  for (let i = 0; i < numTendrils; i++) {
    const baseAngle = (i / numTendrils) * Math.PI * 2;
    const angleJitter = (seededRandom(i * 13 + 7) - 0.5) * 0.3;
    const angle = baseAngle + angleJitter;
    
    // Varied lengths - some longer, some shorter
    const lengthVariation = 0.5 + seededRandom(i * 17 + 3) * 0.8;
    const length = baseRadius * lengthVariation * progress;
    
    // Width tapering from thick to thin
    const width = baseRadius * (0.08 + seededRandom(i * 23 + 11) * 0.06);
    
    const startDist = baseRadius * 0.65;
    const startX = centerX + Math.cos(angle) * startDist;
    const startY = centerY + Math.sin(angle) * startDist;
    
    tendrils.push({ angle, length, width, seed: i * 31 + 5 });
    tendrilPaths.push(generateFluidTendril(startX, startY, angle, length, width, i * 31 + 5));
  }
  
  return { mainPath, tendrils, tendrilPaths };
};

// Satellite droplets configuration
const satelliteDroplets = [
  // Large droplets
  { id: 0, x: 15, y: 28, size: 3.2, seed: 1, hasTail: true, tailAngle: -0.3 },
  { id: 1, x: 82, y: 22, size: 2.8, seed: 2, hasTail: true, tailAngle: 0.5 },
  { id: 2, x: 88, y: 55, size: 3.5, seed: 3, hasTail: false, tailAngle: 0 },
  { id: 3, x: 10, y: 65, size: 2.5, seed: 4, hasTail: true, tailAngle: -0.7 },
  { id: 4, x: 85, y: 72, size: 2.9, seed: 5, hasTail: false, tailAngle: 0 },
  // Medium droplets
  { id: 5, x: 7, y: 42, size: 2.0, seed: 6, hasTail: true, tailAngle: -0.4 },
  { id: 6, x: 93, y: 38, size: 2.2, seed: 7, hasTail: true, tailAngle: 0.6 },
  { id: 7, x: 20, y: 82, size: 2.4, seed: 8, hasTail: false, tailAngle: 0 },
  { id: 8, x: 75, y: 85, size: 2.1, seed: 9, hasTail: true, tailAngle: 0.3 },
  // Small droplets
  { id: 9, x: 5, y: 32, size: 1.5, seed: 10, hasTail: false, tailAngle: 0 },
  { id: 10, x: 95, y: 60, size: 1.6, seed: 11, hasTail: false, tailAngle: 0 },
  { id: 11, x: 18, y: 88, size: 1.4, seed: 12, hasTail: true, tailAngle: -0.2 },
  { id: 12, x: 80, y: 12, size: 1.3, seed: 13, hasTail: true, tailAngle: 0.4 },
  // Tiny dots
  { id: 13, x: 25, y: 15, size: 0.9, seed: 14, hasTail: false, tailAngle: 0 },
  { id: 14, x: 72, y: 10, size: 0.8, seed: 15, hasTail: false, tailAngle: 0 },
  { id: 15, x: 12, y: 75, size: 1.0, seed: 16, hasTail: false, tailAngle: 0 },
  { id: 16, x: 88, y: 80, size: 0.9, seed: 17, hasTail: false, tailAngle: 0 },
  { id: 17, x: 28, y: 90, size: 0.7, seed: 18, hasTail: false, tailAngle: 0 },
  { id: 18, x: 68, y: 92, size: 0.8, seed: 19, hasTail: false, tailAngle: 0 },
  // Micro specks
  { id: 19, x: 16, y: 38, size: 0.5, seed: 20, hasTail: false, tailAngle: 0 },
  { id: 20, x: 84, y: 32, size: 0.6, seed: 21, hasTail: false, tailAngle: 0 },
  { id: 21, x: 24, y: 70, size: 0.5, seed: 22, hasTail: false, tailAngle: 0 },
  { id: 22, x: 76, y: 65, size: 0.4, seed: 23, hasTail: false, tailAngle: 0 },
];

// Connecting strands between tendrils
const connectingStrands = [
  { x1: 35, y1: 30, x2: 45, y2: 25, seed: 100 },
  { x1: 55, y1: 28, x2: 65, y2: 32, seed: 101 },
  { x1: 32, y1: 65, x2: 42, y2: 72, seed: 102 },
  { x1: 58, y1: 68, x2: 68, y2: 65, seed: 103 },
  { x1: 28, y1: 48, x2: 22, y2: 55, seed: 104 },
  { x1: 72, y1: 50, x2: 78, y2: 45, seed: 105 },
];

// Falling droplets configuration
const fallingDroplets = [
  { id: 0, startX: 48, startY: -8, endX: 50, endY: 45, size: 3.5, delay: 0, seed: 1 },
  { id: 1, startX: 52, startY: -12, endX: 48, endY: 48, size: 3.0, delay: 60, seed: 2 },
  { id: 2, startX: 45, startY: -6, endX: 53, endY: 52, size: 2.5, delay: 120, seed: 3 },
  { id: 3, startX: 55, startY: -10, endX: 46, endY: 50, size: 2.8, delay: 180, seed: 4 },
  { id: 4, startX: 50, startY: -4, endX: 54, endY: 46, size: 3.2, delay: 250, seed: 5 },
  { id: 5, startX: 47, startY: -9, endX: 49, endY: 51, size: 2.2, delay: 320, seed: 6 },
];

type Phase = 'droplets' | 'splash' | 'settle' | 'slide' | 'reveal' | 'fadeout' | 'done';

const GV_InkSplashOverlay: React.FC<GV_InkSplashOverlayProps> = ({ onComplete }) => {
  const [phase, setPhase] = useState<Phase>('droplets');
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [splashProgress, setSplashProgress] = useState(0);
  const [slideProgress, setSlideProgress] = useState(0);
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  
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

  const animate = useCallback((timestamp: number) => {
    if (!startTimeRef.current) {
      startTimeRef.current = timestamp;
    }
    
    const elapsed = timestamp - startTimeRef.current;
    
    if (elapsed >= 400 && elapsed < 1200) {
      const splashElapsed = elapsed - 400;
      const progress = Math.min(splashElapsed / 800, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setSplashProgress(eased);
    } else if (elapsed >= 1200) {
      setSplashProgress(1);
    }
    
    if (elapsed >= 1800 && elapsed < 2700) {
      const slideElapsed = elapsed - 1800;
      const progress = Math.min(slideElapsed / 900, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setSlideProgress(eased);
    } else if (elapsed >= 2700) {
      setSlideProgress(1);
    }
    
    if (elapsed < 3200) {
      animationRef.current = requestAnimationFrame(animate);
    }
  }, []);

  useEffect(() => {
    if (sessionStorage.getItem(SPLASH_SHOWN_KEY) === 'true') {
      setPhase('done');
      onComplete();
      return;
    }

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

    animationRef.current = requestAnimationFrame(animate);

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

  // Generate splatter paths
  const splatterData = useMemo(() => {
    return generateLiquidSplatter(50, 50, splashProgress, slideProgress);
  }, [splashProgress, slideProgress]);

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
      <svg 
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid slice"
        style={{ overflow: 'visible' }}
      >
        <defs>
          {/* Gradient for 3D depth on paint surface - dark gray to pure black */}
          <radialGradient id="paintDepth" cx="40%" cy="35%" r="60%">
            <stop offset="0%" stopColor="#2a2a2a" />
            <stop offset="40%" stopColor="#151515" />
            <stop offset="100%" stopColor="#050505" />
          </radialGradient>
          
          {/* Specular highlight gradient for wet glossy look */}
          <radialGradient id="wetSpecular1" cx="30%" cy="25%" r="35%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.95)" />
            <stop offset="20%" stopColor="rgba(255,255,255,0.7)" />
            <stop offset="50%" stopColor="rgba(255,255,255,0.25)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </radialGradient>
          
          {/* Secondary softer specular */}
          <radialGradient id="wetSpecular2" cx="60%" cy="40%" r="40%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.7)" />
            <stop offset="30%" stopColor="rgba(255,255,255,0.35)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </radialGradient>
          
          {/* Edge highlight for rim lighting */}
          <radialGradient id="rimLight" cx="50%" cy="50%" r="50%">
            <stop offset="70%" stopColor="rgba(255,255,255,0)" />
            <stop offset="90%" stopColor="rgba(255,255,255,0.15)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.35)" />
          </radialGradient>
          
          {/* Gray mid-tone for depth */}
          <radialGradient id="grayDepth" cx="45%" cy="45%" r="50%">
            <stop offset="0%" stopColor="rgba(100,100,100,0.5)" />
            <stop offset="40%" stopColor="rgba(60,60,60,0.25)" />
            <stop offset="100%" stopColor="rgba(30,30,30,0)" />
          </radialGradient>
          
          {/* Clip path for highlights to stay on paint */}
          <clipPath id="paintClip">
            <path d={splatterData.mainPath} />
            {splatterData.tendrilPaths.map((p, i) => <path key={i} d={p} />)}
          </clipPath>
        </defs>

        {/* Paint splatter group */}
        <g>
          {/* Falling droplets */}
          {fallingDroplets.map((drop) => (
            <path
              key={`fall-${drop.id}`}
              d={generateSatelliteDroplet(drop.endX, drop.endY, drop.size, drop.seed, false, 0)}
              fill="url(#paintDepth)"
              className="paint-falling-drop"
              style={{
                '--start-y': `${drop.startY}`,
                '--end-y': `${drop.endY}`,
              } as React.CSSProperties}
            />
          ))}

          {/* Main splatter body */}
          {showSplash && (
            <g>
              {/* Base paint layer with depth gradient */}
              <path
                d={splatterData.mainPath}
                fill="url(#paintDepth)"
              />
              
              {/* Tendrils with bulbous tips */}
              {splatterData.tendrilPaths.map((tendrilPath, idx) => (
                <path
                  key={`tendril-${idx}`}
                  d={tendrilPath}
                  fill="url(#paintDepth)"
                  className="paint-splatter-expand"
                  style={{ animationDelay: `${idx * 30}ms` }}
                />
              ))}
              
              {/* Thin connecting strands for surface tension effect */}
              {showSettle && connectingStrands.map((strand, idx) => {
                const adjustedX1 = strand.x1 - slideProgress * 55;
                const adjustedX2 = strand.x2 - slideProgress * 55;
                return (
                  <path
                    key={`strand-${idx}`}
                    d={generateConnectingStrand(adjustedX1, strand.y1, adjustedX2, strand.y2, strand.seed)}
                    fill="none"
                    stroke="#0a0a0a"
                    strokeWidth="0.4"
                    strokeLinecap="round"
                    className="paint-strand"
                    style={{ animationDelay: `${500 + idx * 50}ms` }}
                  />
                );
              })}
            </g>
          )}

          {/* Satellite droplets - smooth circles and teardrops */}
          {showSplash && satelliteDroplets.map((drop) => {
            const dropX = drop.x - slideProgress * (drop.x > 50 ? 55 : 20);
            return (
              <g key={`satellite-${drop.id}`}>
                {/* Droplet body */}
                <path
                  d={generateSatelliteDroplet(dropX, drop.y, drop.size * splashProgress, drop.seed, drop.hasTail, drop.tailAngle)}
                  fill="url(#paintDepth)"
                  className="paint-satellite"
                  style={{ animationDelay: `${400 + drop.id * 25}ms` }}
                />
                {/* Tiny specular highlight on each droplet */}
                <circle
                  cx={dropX - drop.size * 0.3}
                  cy={drop.y - drop.size * 0.3}
                  r={drop.size * 0.25 * splashProgress}
                  fill="rgba(255,255,255,0.85)"
                  className="paint-highlight"
                  style={{ animationDelay: `${600 + drop.id * 30}ms` }}
                />
              </g>
            );
          })}
        </g>

        {/* Glossy wet surface - specular highlights DIRECTLY ON the paint surface */}
        {showSettle && (
          <g style={{ transform: `translateX(${-slideProgress * 55}%)` }}>
            {/* Main specular highlight - bright spot like light reflecting off wet paint */}
            <ellipse
              cx="38"
              cy="38"
              rx="8"
              ry="4"
              fill="url(#wetSpecular1)"
              className="paint-highlight"
              transform="rotate(-15 38 38)"
            />
            
            {/* Secondary highlight area */}
            <ellipse
              cx="55"
              cy="45"
              rx="6"
              ry="3"
              fill="url(#wetSpecular2)"
              className="paint-highlight"
              style={{ animationDelay: '50ms' }}
              transform="rotate(-10 55 45)"
            />
            
            {/* Tertiary soft glow */}
            <ellipse
              cx="45"
              cy="55"
              rx="5"
              ry="2.5"
              fill="url(#wetSpecular2)"
              className="paint-highlight"
              style={{ animationDelay: '100ms' }}
              transform="rotate(-20 45 55)"
            />
            
            {/* Gray mid-tones showing depth/volume */}
            <ellipse
              cx="32"
              cy="50"
              rx="4"
              ry="2"
              fill="url(#grayDepth)"
              className="paint-highlight"
              style={{ animationDelay: '120ms' }}
            />
            <ellipse
              cx="62"
              cy="48"
              rx="3.5"
              ry="1.8"
              fill="url(#grayDepth)"
              className="paint-highlight"
              style={{ animationDelay: '150ms' }}
            />
            
            {/* Sharp bright specular points - like light hitting glossy black nail polish */}
            <circle cx="36" cy="36" r="1.5" fill="rgba(255,255,255,0.95)" className="paint-highlight" style={{ animationDelay: '180ms' }} />
            <circle cx="52" cy="42" r="1.2" fill="rgba(255,255,255,0.9)" className="paint-highlight" style={{ animationDelay: '200ms' }} />
            <circle cx="42" cy="48" r="1.0" fill="rgba(255,255,255,0.85)" className="paint-highlight" style={{ animationDelay: '220ms' }} />
            <circle cx="60" cy="52" r="0.9" fill="rgba(255,255,255,0.8)" className="paint-highlight" style={{ animationDelay: '240ms' }} />
            
            {/* Scattered smaller bright specks for wet texture */}
            <circle cx="30" cy="42" r="0.7" fill="rgba(255,255,255,0.75)" className="paint-highlight" style={{ animationDelay: '260ms' }} />
            <circle cx="48" cy="38" r="0.6" fill="rgba(255,255,255,0.7)" className="paint-highlight" style={{ animationDelay: '280ms' }} />
            <circle cx="56" cy="55" r="0.8" fill="rgba(255,255,255,0.72)" className="paint-highlight" style={{ animationDelay: '300ms' }} />
            <circle cx="38" cy="52" r="0.5" fill="rgba(255,255,255,0.65)" className="paint-highlight" style={{ animationDelay: '320ms' }} />
            <circle cx="65" cy="45" r="0.6" fill="rgba(255,255,255,0.6)" className="paint-highlight" style={{ animationDelay: '340ms' }} />
            <circle cx="28" cy="55" r="0.4" fill="rgba(255,255,255,0.55)" className="paint-highlight" style={{ animationDelay: '360ms' }} />
            
            {/* Gray highlight dots for viscous paint depth */}
            <circle cx="40" cy="40" r="0.6" fill="rgba(180,180,180,0.5)" className="paint-highlight" style={{ animationDelay: '380ms' }} />
            <circle cx="58" cy="50" r="0.5" fill="rgba(160,160,160,0.45)" className="paint-highlight" style={{ animationDelay: '400ms' }} />
            <circle cx="34" cy="48" r="0.4" fill="rgba(140,140,140,0.4)" className="paint-highlight" style={{ animationDelay: '420ms' }} />
            
            {/* Edge rim highlights showing volume */}
            <ellipse
              cx="50"
              cy="50"
              rx="32"
              ry="28"
              fill="none"
              stroke="url(#rimLight)"
              strokeWidth="0.8"
              className="paint-highlight"
              style={{ animationDelay: '150ms' }}
            />
          </g>
        )}
      </svg>

      {/* Logo and brand lockup */}
      <div 
        className="absolute inset-0 flex items-center justify-start z-10 pointer-events-none"
        style={{ paddingLeft: '8%' }}
      >
        <div 
          className="flex items-center gap-4 sm:gap-6"
          style={{
            opacity: showLogo ? 1 : 0,
            transform: showLogo ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.9)',
            transition: 'opacity 0.4s ease-out, transform 0.4s ease-out',
          }}
        >
          <LogoWithFallback
            src={sultanstampLogo}
            alt="SultanStamp"
            className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 object-cover rounded-lg"
            style={{
              boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
              border: '2px solid rgba(255,255,255,0.2)',
            }}
          />
          
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

      {/* Right side - "Sultans" text */}
      {showLogo && (
        <div 
          className="absolute right-0 top-0 bottom-0 flex items-center justify-start z-10 pointer-events-none"
          style={{ width: '50%', paddingLeft: '8%' }}
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

        /* Falling droplets animation */
        @keyframes dropletFall {
          0% {
            transform: translateY(calc((var(--start-y) - var(--end-y)) * 1%)) scale(0.5);
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          75% {
            transform: translateY(0) scale(1.15);
          }
          90% {
            transform: translateY(0) scale(0.9) scaleY(0.8) scaleX(1.15);
          }
          100% {
            transform: translateY(0) scale(1);
            opacity: 1;
          }
        }

        .paint-falling-drop {
          animation: dropletFall 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards;
          opacity: 0;
        }

        /* Splatter expansion animation */
        @keyframes splatterExpand {
          0% {
            transform: scale(0);
            opacity: 0;
          }
          15% {
            opacity: 1;
          }
          55% {
            transform: scale(1.08);
          }
          75% {
            transform: scale(0.96);
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }

        .paint-splatter-expand {
          animation: splatterExpand 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
          opacity: 0;
        }

        /* Satellite droplet animation */
        @keyframes satelliteFling {
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
            transform: scale(0.92);
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }

        .paint-satellite {
          animation: satelliteFling 0.45s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
          opacity: 0;
        }

        /* Strand appear animation */
        @keyframes strandAppear {
          0% {
            stroke-dashoffset: 20;
            opacity: 0;
          }
          50% {
            opacity: 1;
          }
          100% {
            stroke-dashoffset: 0;
            opacity: 1;
          }
        }

        .paint-strand {
          stroke-dasharray: 20;
          animation: strandAppear 0.4s ease-out forwards;
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

        .paint-highlight {
          animation: highlightAppear 0.3s ease-out forwards;
          opacity: 0;
        }

        /* Prefers reduced motion */
        @media (prefers-reduced-motion: reduce) {
          .paint-falling-drop,
          .paint-splatter-expand,
          .paint-satellite,
          .paint-strand,
          .paint-highlight {
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
