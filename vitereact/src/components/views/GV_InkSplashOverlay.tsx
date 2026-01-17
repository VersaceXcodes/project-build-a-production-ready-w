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

// Generate smooth catmull-rom spline through points (returns SVG cubic bezier commands)
const catmullRomToBezier = (points: { x: number; y: number }[], tension: number = 0.5): string => {
  if (points.length < 2) return '';
  
  const result: string[] = [];
  
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? points.length - 1 : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2 >= points.length ? (i + 2) % points.length : i + 2];
    
    // Calculate control points
    const cp1x = p1.x + (p2.x - p0.x) * tension / 6;
    const cp1y = p1.y + (p2.y - p0.y) * tension / 6;
    const cp2x = p2.x - (p3.x - p1.x) * tension / 6;
    const cp2y = p2.y - (p3.y - p1.y) * tension / 6;
    
    if (i === 0) {
      result.push(`M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`);
    }
    result.push(`C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)} ${cp2x.toFixed(2)} ${cp2y.toFixed(2)} ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`);
  }
  
  return result.join(' ');
};

// Generate smooth organic liquid paint splatter with curved edges and flowing tendrils
const generateSplatterPath = (
  cx: number,
  cy: number,
  baseSize: number,
  seed: number,
  tendrilCount: number = 8
): string => {
  const paths: string[] = [];
  
  // Main body - smooth organic blob using low-frequency noise
  const mainPoints: { x: number; y: number }[] = [];
  const segments = 24;
  
  for (let i = 0; i < segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    
    // Low-frequency smooth noise for organic edges (like viscous liquid)
    const noise1 = Math.sin(angle * 2 + seed * 1.7) * 0.18;
    const noise2 = Math.cos(angle * 3 + seed * 2.1) * 0.12;
    const noise3 = Math.sin(angle * 1.5 + seed * 0.9) * 0.08;
    
    // Gentle undulations for tendril emergence points (smooth, not sharp)
    const tendrilPhase = (angle * tendrilCount) / (Math.PI * 2);
    const bulge = Math.pow(Math.cos(tendrilPhase * Math.PI), 2) * 0.15;
    
    const radiusVariation = 0.75 + noise1 + noise2 + noise3 + bulge;
    const radius = baseSize * Math.max(0.5, radiusVariation);
    
    mainPoints.push({
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius
    });
  }
  
  // Build smooth curved main body using catmull-rom splines
  const mainPath = catmullRomToBezier(mainPoints, 0.5) + ' Z';
  paths.push(mainPath);
  
  // Generate smooth curved tendrils with bulbous ends (like honey or syrup)
  for (let t = 0; t < tendrilCount; t++) {
    const tendrilAngle = (t / tendrilCount) * Math.PI * 2 + seededRandom(seed + t) * 0.2;
    const tendrilLength = baseSize * (0.4 + seededRandom(seed + t * 2) * 0.6);
    const tendrilWidth = baseSize * (0.12 + seededRandom(seed + t * 3) * 0.1);
    
    const startRadius = baseSize * 0.65;
    const startX = cx + Math.cos(tendrilAngle) * startRadius;
    const startY = cy + Math.sin(tendrilAngle) * startRadius;
    
    // Smooth curved tendrils with tapered bulbous ends
    const tendrilPath = generateSmoothTendril(
      startX, startY, tendrilLength, tendrilAngle, tendrilWidth, seed + t * 7
    );
    paths.push(tendrilPath);
  }
  
  return paths.join(' ');
};

// Generate smooth curved paint tendril with tapered bulbous end (like dripping honey)
const generateSmoothTendril = (
  startX: number,
  startY: number,
  length: number,
  angle: number,
  width: number,
  seed: number
): string => {
  const perpAngle = angle + Math.PI / 2;
  
  // Gentle curve offset for organic flow
  const curveAmount = length * 0.2 * (seededRandom(seed) - 0.5);
  
  // End point with curve
  const endX = startX + Math.cos(angle) * length + Math.cos(perpAngle) * curveAmount;
  const endY = startY + Math.sin(angle) * length + Math.sin(perpAngle) * curveAmount;
  
  // Mid control point for smooth S-curve
  const midT = 0.5;
  const midCurve = curveAmount * 0.6;
  const midX = startX + Math.cos(angle) * length * midT + Math.cos(perpAngle) * midCurve;
  const midY = startY + Math.sin(angle) * length * midT + Math.sin(perpAngle) * midCurve;
  
  // Bulbous end - rounded teardrop shape
  const bulbRadius = width * (0.8 + seededRandom(seed + 1) * 0.4);
  
  // Start points (wide base)
  const startLeft = {
    x: startX + Math.cos(perpAngle) * width,
    y: startY + Math.sin(perpAngle) * width
  };
  const startRight = {
    x: startX - Math.cos(perpAngle) * width,
    y: startY - Math.sin(perpAngle) * width
  };
  
  // Mid points (tapered)
  const midWidth = width * 0.5;
  const midLeft = {
    x: midX + Math.cos(perpAngle) * midWidth,
    y: midY + Math.sin(perpAngle) * midWidth
  };
  const midRight = {
    x: midX - Math.cos(perpAngle) * midWidth,
    y: midY - Math.sin(perpAngle) * midWidth
  };
  
  // Bulb control points for rounded end
  const bulbLeft = {
    x: endX + Math.cos(perpAngle) * bulbRadius,
    y: endY + Math.sin(perpAngle) * bulbRadius
  };
  const bulbRight = {
    x: endX - Math.cos(perpAngle) * bulbRadius,
    y: endY - Math.sin(perpAngle) * bulbRadius
  };
  const bulbTip = {
    x: endX + Math.cos(angle) * bulbRadius * 0.8,
    y: endY + Math.sin(angle) * bulbRadius * 0.8
  };
  
  // Build smooth path with cubic beziers
  return `M ${startLeft.x.toFixed(2)} ${startLeft.y.toFixed(2)}
    Q ${midLeft.x.toFixed(2)} ${midLeft.y.toFixed(2)} ${bulbLeft.x.toFixed(2)} ${bulbLeft.y.toFixed(2)}
    Q ${(bulbLeft.x + bulbTip.x) / 2} ${(bulbLeft.y + bulbTip.y) / 2} ${bulbTip.x.toFixed(2)} ${bulbTip.y.toFixed(2)}
    Q ${(bulbRight.x + bulbTip.x) / 2} ${(bulbRight.y + bulbTip.y) / 2} ${bulbRight.x.toFixed(2)} ${bulbRight.y.toFixed(2)}
    Q ${midRight.x.toFixed(2)} ${midRight.y.toFixed(2)} ${startRight.x.toFixed(2)} ${startRight.y.toFixed(2)}
    Z`;
};

// Generate smooth teardrop drip with rounded bulbous end (like dripping paint)
const generateTeardropDrip = (
  cx: number,
  cy: number,
  size: number,
  _angle: number
): string => {
  // Smooth teardrop with rounded tip (surface tension effect)
  const tipY = cy + size * 2.0;
  const bulbRadius = size * 0.8;
  const tipRounding = size * 0.25; // Rounded tip, not sharp
  
  // Smooth rounded teardrop using cubic beziers
  return `M ${cx.toFixed(2)} ${(tipY - tipRounding).toFixed(2)}
          C ${(cx - tipRounding).toFixed(2)} ${tipY.toFixed(2)} ${(cx + tipRounding).toFixed(2)} ${tipY.toFixed(2)} ${cx.toFixed(2)} ${(tipY - tipRounding).toFixed(2)}
          C ${(cx - bulbRadius * 0.4).toFixed(2)} ${(cy + size * 0.7).toFixed(2)} ${(cx - bulbRadius).toFixed(2)} ${(cy + size * 0.2).toFixed(2)} ${(cx - bulbRadius).toFixed(2)} ${cy.toFixed(2)}
          C ${(cx - bulbRadius).toFixed(2)} ${(cy - bulbRadius * 0.7).toFixed(2)} ${(cx - bulbRadius * 0.7).toFixed(2)} ${(cy - bulbRadius).toFixed(2)} ${cx.toFixed(2)} ${(cy - bulbRadius).toFixed(2)}
          C ${(cx + bulbRadius * 0.7).toFixed(2)} ${(cy - bulbRadius).toFixed(2)} ${(cx + bulbRadius).toFixed(2)} ${(cy - bulbRadius * 0.7).toFixed(2)} ${(cx + bulbRadius).toFixed(2)} ${cy.toFixed(2)}
          C ${(cx + bulbRadius).toFixed(2)} ${(cy + size * 0.2).toFixed(2)} ${(cx + bulbRadius * 0.4).toFixed(2)} ${(cy + size * 0.7).toFixed(2)} ${cx.toFixed(2)} ${(tipY - tipRounding).toFixed(2)}
          Z`;
};

// Generate smooth satellite droplet - perfect circle or soft oval (like liquid drops)
const generateSatelliteDroplet = (
  cx: number,
  cy: number,
  size: number,
  seed: number
): string => {
  // Slight oval variation for organic feel, but always smooth
  const aspectRatio = 0.85 + seededRandom(seed) * 0.3; // 0.85 to 1.15
  const rx = size;
  const ry = size * aspectRatio;
  
  // Slight rotation for natural look
  const rotation = seededRandom(seed + 1) * 30 - 15;
  
  // Use ellipse approximation with cubic beziers (4-point circle)
  const kappa = 0.5522847498; // Magic number for circle approximation
  const ox = rx * kappa;
  const oy = ry * kappa;
  
  // Transform points with rotation
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
  
  return `M ${top.x.toFixed(2)} ${top.y.toFixed(2)}
          C ${topRight.x.toFixed(2)} ${topRight.y.toFixed(2)} ${rightTop.x.toFixed(2)} ${rightTop.y.toFixed(2)} ${right.x.toFixed(2)} ${right.y.toFixed(2)}
          C ${rightBottom.x.toFixed(2)} ${rightBottom.y.toFixed(2)} ${bottomRight.x.toFixed(2)} ${bottomRight.y.toFixed(2)} ${bottom.x.toFixed(2)} ${bottom.y.toFixed(2)}
          C ${bottomLeft.x.toFixed(2)} ${bottomLeft.y.toFixed(2)} ${leftBottom.x.toFixed(2)} ${leftBottom.y.toFixed(2)} ${left.x.toFixed(2)} ${left.y.toFixed(2)}
          C ${leftTop.x.toFixed(2)} ${leftTop.y.toFixed(2)} ${topLeft.x.toFixed(2)} ${topLeft.y.toFixed(2)} ${top.x.toFixed(2)} ${top.y.toFixed(2)}
          Z`;
};

// Generate smooth organic main splash with flowing curved tendrils
const generateMainSplashPath = (progress: number, slideOffset: number): string => {
  const centerX = 50 - slideOffset * 55;
  const centerY = 50;
  const baseRadius = 42 * progress;
  
  const numTendrils = 10; // Fewer, more prominent organic tendrils
  const paths: string[] = [];
  
  // Main central mass - smooth organic blob with gentle undulations
  const mainSegments = 32;
  const mainPoints: { x: number; y: number }[] = [];
  
  for (let i = 0; i < mainSegments; i++) {
    const angle = (i / mainSegments) * Math.PI * 2;
    
    // Low-frequency smooth noise for organic liquid edges
    const n1 = Math.sin(angle * 2 + 1.7) * 0.15;
    const n2 = Math.cos(angle * 3 + 2.3) * 0.12;
    const n3 = Math.sin(angle * 1.5 + 3.1) * 0.08;
    
    // Gentle bulges where tendrils emerge (smooth, not sharp)
    const fingerPhase = (angle * numTendrils) / (Math.PI * 2);
    const bulge = Math.pow(Math.cos(fingerPhase * Math.PI), 2) * 0.12;
    
    // Extra smooth coverage on left for slide
    let leftExtension = 0;
    if (Math.cos(angle) < -0.2) {
      leftExtension = Math.pow(Math.abs(Math.cos(angle)), 1.5) * 0.35 * progress;
    }
    
    const radiusVar = 0.72 + n1 + n2 + n3 + bulge + leftExtension;
    const radius = baseRadius * Math.max(0.5, radiusVar);
    
    mainPoints.push({
      x: centerX + Math.cos(angle) * radius,
      y: centerY + Math.sin(angle) * radius
    });
  }
  
  // Build smooth curved main body using catmull-rom splines
  const mainPath = catmullRomToBezier(mainPoints, 0.5) + ' Z';
  paths.push(mainPath);
  
  // Smooth flowing tendrils with bulbous ends (like honey or thick paint)
  for (let t = 0; t < numTendrils; t++) {
    const baseAngle = (t / numTendrils) * Math.PI * 2;
    const angleJitter = (seededRandom(t * 7) - 0.5) * 0.15;
    const tendrilAngle = baseAngle + angleJitter;
    
    const tendrilLength = baseRadius * (0.5 + seededRandom(t * 3) * 0.6) * progress;
    const tendrilWidth = baseRadius * (0.1 + seededRandom(t * 5) * 0.08);
    
    const startDist = baseRadius * 0.6;
    const startX = centerX + Math.cos(tendrilAngle) * startDist;
    const startY = centerY + Math.sin(tendrilAngle) * startDist;
    
    paths.push(generateSmoothTendril(startX, startY, tendrilLength, tendrilAngle, tendrilWidth, t * 11));
  }
  
  return paths.join(' ');
};

// Satellite droplets configuration - scattered around main splash
const satelliteDroplets = [
  // Near the main splash
  { id: 0, x: 15, y: 25, size: 2.8, seed: 1.2 },
  { id: 1, x: 82, y: 18, size: 2.4, seed: 2.5 },
  { id: 2, x: 88, y: 52, size: 3.0, seed: 3.8 },
  { id: 3, x: 12, y: 68, size: 2.2, seed: 4.1 },
  { id: 4, x: 85, y: 75, size: 2.6, seed: 5.4 },
  { id: 5, x: 8, y: 45, size: 1.8, seed: 6.7 },
  { id: 6, x: 92, y: 38, size: 2.0, seed: 7.0 },
  // Further out
  { id: 7, x: 5, y: 30, size: 1.5, seed: 8.3 },
  { id: 8, x: 95, y: 62, size: 1.6, seed: 9.6 },
  { id: 9, x: 20, y: 85, size: 2.1, seed: 10.9 },
  { id: 10, x: 78, y: 88, size: 1.9, seed: 11.2 },
  { id: 11, x: 3, y: 55, size: 1.4, seed: 12.5 },
  { id: 12, x: 97, y: 45, size: 1.3, seed: 13.8 },
  // Tiny specks
  { id: 13, x: 25, y: 12, size: 1.0, seed: 14.1 },
  { id: 14, x: 75, y: 8, size: 0.9, seed: 15.4 },
  { id: 15, x: 10, y: 78, size: 1.1, seed: 16.7 },
  { id: 16, x: 90, y: 82, size: 1.0, seed: 17.0 },
  { id: 17, x: 30, y: 92, size: 0.8, seed: 18.3 },
  { id: 18, x: 70, y: 95, size: 0.9, seed: 19.6 },
  // Micro droplets
  { id: 19, x: 18, y: 35, size: 0.6, seed: 20.9 },
  { id: 20, x: 82, y: 30, size: 0.7, seed: 21.2 },
  { id: 21, x: 22, y: 72, size: 0.6, seed: 22.5 },
  { id: 22, x: 78, y: 68, size: 0.5, seed: 23.8 },
  { id: 23, x: 35, y: 15, size: 0.5, seed: 24.1 },
  { id: 24, x: 65, y: 12, size: 0.6, seed: 25.4 },
];

// Drip configurations at tendril ends
const dripConfigs = [
  { x: 25, y: 78, size: 1.8, angle: Math.PI * 0.55, delay: 600 },
  { x: 68, y: 82, size: 1.5, angle: Math.PI * 0.48, delay: 650 },
  { x: 35, y: 85, size: 1.3, angle: Math.PI * 0.52, delay: 700 },
  { x: 72, y: 78, size: 1.6, angle: Math.PI * 0.45, delay: 720 },
  { x: 45, y: 88, size: 1.2, angle: Math.PI * 0.5, delay: 750 },
  { x: 58, y: 86, size: 1.4, angle: Math.PI * 0.47, delay: 780 },
];

// Falling droplets - irregular shapes
const fallingDroplets = [
  { id: 0, startX: 48, startY: -8, endX: 50, endY: 45, size: 3.5, delay: 0, seed: 1.1 },
  { id: 1, startX: 52, startY: -12, endX: 48, endY: 48, size: 3.0, delay: 60, seed: 2.2 },
  { id: 2, startX: 45, startY: -6, endX: 53, endY: 52, size: 2.5, delay: 120, seed: 3.3 },
  { id: 3, startX: 55, startY: -10, endX: 46, endY: 50, size: 2.8, delay: 180, seed: 4.4 },
  { id: 4, startX: 50, startY: -4, endX: 54, endY: 46, size: 3.2, delay: 250, seed: 5.5 },
  { id: 5, startX: 47, startY: -9, endX: 49, endY: 51, size: 2.2, delay: 320, seed: 6.6 },
];

// Secondary splatter blobs
const secondarySplatters = [
  { id: 0, cx: 35, cy: 42, size: 12, delay: 500, seed: 1.5, tendrils: 8 },
  { id: 1, cx: 65, cy: 55, size: 10, delay: 520, seed: 2.3, tendrils: 7 },
  { id: 2, cx: 28, cy: 58, size: 9, delay: 560, seed: 3.1, tendrils: 6 },
  { id: 3, cx: 72, cy: 42, size: 10, delay: 540, seed: 4.7, tendrils: 7 },
  { id: 4, cx: 42, cy: 35, size: 8, delay: 580, seed: 5.2, tendrils: 5 },
  { id: 5, cx: 58, cy: 62, size: 9, delay: 600, seed: 6.8, tendrils: 6 },
  // Extended left coverage
  { id: 6, cx: 18, cy: 45, size: 14, delay: 700, seed: 7.4, tendrils: 9 },
  { id: 7, cx: 8, cy: 55, size: 16, delay: 720, seed: 8.1, tendrils: 10 },
  { id: 8, cx: -2, cy: 50, size: 18, delay: 740, seed: 9.3, tendrils: 11 },
  { id: 9, cx: 12, cy: 32, size: 12, delay: 760, seed: 10.6, tendrils: 8 },
  { id: 10, cx: 12, cy: 68, size: 12, delay: 780, seed: 11.2, tendrils: 8 },
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
          {/* Wet paint glossy gradient - strong specular */}
          <linearGradient id="wetPaintGloss1" x1="0%" y1="0%" x2="70%" y2="70%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.75)" />
            <stop offset="15%" stopColor="rgba(255,255,255,0.45)" />
            <stop offset="40%" stopColor="rgba(255,255,255,0.15)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
          
          {/* Secondary gloss - softer reflection */}
          <linearGradient id="wetPaintGloss2" x1="20%" y1="0%" x2="80%" y2="90%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.5)" />
            <stop offset="30%" stopColor="rgba(255,255,255,0.2)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
          
          {/* Rim light for liquid depth */}
          <linearGradient id="paintRimLight" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(255,255,255,0)" />
            <stop offset="75%" stopColor="rgba(255,255,255,0.08)" />
            <stop offset="92%" stopColor="rgba(255,255,255,0.2)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.35)" />
          </linearGradient>

          {/* Sharp specular highlight - bright point reflections */}
          <radialGradient id="specularSharp" cx="40%" cy="35%" r="40%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.9)" />
            <stop offset="15%" stopColor="rgba(255,255,255,0.5)" />
            <stop offset="40%" stopColor="rgba(255,255,255,0.15)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </radialGradient>
          
          {/* Soft specular for wet sheen */}
          <radialGradient id="specularSoft" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.7)" />
            <stop offset="25%" stopColor="rgba(255,255,255,0.35)" />
            <stop offset="60%" stopColor="rgba(255,255,255,0.1)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </radialGradient>

          {/* Gray highlight for viscous paint look */}
          <radialGradient id="grayShine" cx="45%" cy="40%" r="45%">
            <stop offset="0%" stopColor="rgba(180,180,180,0.6)" />
            <stop offset="30%" stopColor="rgba(140,140,140,0.3)" />
            <stop offset="100%" stopColor="rgba(100,100,100,0)" />
          </radialGradient>
        </defs>

        {/* Paint splatter group */}
        <g>
          {/* Falling droplets */}
          {fallingDroplets.map((drop) => (
            <path
              key={`fall-${drop.id}`}
              d={generateSatelliteDroplet(drop.endX, drop.endY, drop.size, drop.seed)}
              fill="#0a0a0a"
              className="paint-falling-drop"
              style={{
                '--start-y': `${drop.startY}`,
                '--end-y': `${drop.endY}`,
              } as React.CSSProperties}
            />
          ))}

          {/* Main splatter */}
          {showSplash && (
            <path
              d={generateMainSplashPath(splashProgress, slideProgress)}
              fill="#0a0a0a"
            />
          )}

          {/* Secondary splatters with radiating fingers */}
          {showSplash && secondarySplatters.map((splat) => {
            const splatX = splat.cx - slideProgress * 55;
            return (
              <path
                key={`splat-${splat.id}`}
                d={generateSplatterPath(splatX, splat.cy, splat.size * splashProgress, splat.seed, splat.tendrils)}
                fill="#0a0a0a"
                className="paint-splatter-expand"
                style={{ animationDelay: `${splat.delay}ms` }}
              />
            );
          })}

          {/* Satellite droplets - flat irregular shapes */}
          {showSplash && satelliteDroplets.map((drop) => {
            const dropX = drop.x - slideProgress * (drop.x > 50 ? 55 : 20);
            return (
              <path
                key={`satellite-${drop.id}`}
                d={generateSatelliteDroplet(dropX, drop.y, drop.size * splashProgress, drop.seed)}
                fill="#0a0a0a"
                className="paint-satellite"
                style={{ animationDelay: `${400 + drop.id * 30}ms` }}
              />
            );
          })}

          {/* Teardrop drips showing gravity effect */}
          {showSplash && dripConfigs.map((drip, idx) => {
            const dripX = drip.x - slideProgress * 55;
            return (
              <path
                key={`drip-${idx}`}
                d={generateTeardropDrip(dripX, drip.y, drip.size * splashProgress, drip.angle)}
                fill="#0a0a0a"
                className="paint-drip"
                style={{ animationDelay: `${drip.delay}ms` }}
              />
            );
          })}
        </g>

        {/* Glossy wet appearance - specular highlights */}
        {showSettle && (
          <g style={{ transform: `translateX(${-slideProgress * 55}%)` }}>
            {/* Primary gloss streaks - elongated reflections */}
            <ellipse
              cx="38"
              cy="40"
              rx="12"
              ry="3.5"
              fill="url(#wetPaintGloss1)"
              className="paint-highlight"
              style={{ opacity: 0.9 }}
              transform="rotate(-18 38 40)"
            />
            <ellipse
              cx="52"
              cy="46"
              rx="9"
              ry="2.8"
              fill="url(#wetPaintGloss2)"
              className="paint-highlight"
              style={{ opacity: 0.8, animationDelay: '60ms' }}
              transform="rotate(-12 52 46)"
            />
            <ellipse
              cx="62"
              cy="52"
              rx="10"
              ry="3"
              fill="url(#wetPaintGloss1)"
              className="paint-highlight"
              style={{ opacity: 0.75, animationDelay: '100ms' }}
              transform="rotate(-22 62 52)"
            />
            
            {/* Gray/white shine spots for viscous look */}
            <ellipse
              cx="30"
              cy="50"
              rx="5"
              ry="2"
              fill="url(#grayShine)"
              className="paint-highlight"
              style={{ opacity: 0.65, animationDelay: '140ms' }}
              transform="rotate(-8 30 50)"
            />
            <ellipse
              cx="68"
              cy="44"
              rx="6"
              ry="2.2"
              fill="url(#grayShine)"
              className="paint-highlight"
              style={{ opacity: 0.6, animationDelay: '180ms' }}
              transform="rotate(-28 68 44)"
            />
            
            {/* Sharp specular spots - bright point reflections */}
            <circle
              cx="36"
              cy="38"
              r="2.5"
              fill="url(#specularSharp)"
              className="paint-highlight"
              style={{ animationDelay: '150ms' }}
            />
            <circle
              cx="54"
              cy="44"
              r="2.0"
              fill="url(#specularSharp)"
              className="paint-highlight"
              style={{ animationDelay: '200ms' }}
            />
            <circle
              cx="44"
              cy="51"
              r="1.6"
              fill="url(#specularSoft)"
              className="paint-highlight"
              style={{ animationDelay: '240ms' }}
            />
            
            {/* Smaller bright specks for wet texture */}
            <circle cx="32" cy="35" r="1.1" fill="rgba(255,255,255,0.85)" className="paint-highlight" style={{ animationDelay: '280ms' }} />
            <circle cx="58" cy="48" r="0.9" fill="rgba(255,255,255,0.75)" className="paint-highlight" style={{ animationDelay: '310ms' }} />
            <circle cx="40" cy="43" r="1.0" fill="rgba(255,255,255,0.7)" className="paint-highlight" style={{ animationDelay: '340ms' }} />
            <circle cx="48" cy="56" r="0.8" fill="rgba(255,255,255,0.65)" className="paint-highlight" style={{ animationDelay: '370ms' }} />
            <circle cx="64" cy="46" r="1.2" fill="url(#specularSharp)" className="paint-highlight" style={{ animationDelay: '400ms' }} />
            <circle cx="28" cy="56" r="0.7" fill="rgba(255,255,255,0.55)" className="paint-highlight" style={{ animationDelay: '430ms' }} />
            <circle cx="72" cy="54" r="0.6" fill="rgba(255,255,255,0.5)" className="paint-highlight" style={{ animationDelay: '460ms' }} />
            
            {/* Additional gray shine for depth */}
            <circle cx="42" cy="38" r="0.8" fill="rgba(200,200,200,0.5)" className="paint-highlight" style={{ animationDelay: '380ms' }} />
            <circle cx="56" cy="52" r="0.7" fill="rgba(180,180,180,0.45)" className="paint-highlight" style={{ animationDelay: '420ms' }} />
            <circle cx="35" cy="48" r="0.6" fill="rgba(160,160,160,0.4)" className="paint-highlight" style={{ animationDelay: '450ms' }} />
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
            transform: scale(1.12);
          }
          75% {
            transform: scale(0.95);
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }

        .paint-splatter-expand {
          animation: splatterExpand 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
          opacity: 0;
        }

        /* Satellite droplet animation */
        @keyframes satelliteFling {
          0% {
            transform: scale(0) translate(0, 0);
            opacity: 0;
          }
          20% {
            opacity: 1;
          }
          65% {
            transform: scale(1.2);
          }
          85% {
            transform: scale(0.88);
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }

        .paint-satellite {
          animation: satelliteFling 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
          opacity: 0;
        }

        /* Drip animation */
        @keyframes dripAppear {
          0% {
            transform: scaleY(0);
            transform-origin: top center;
            opacity: 0;
          }
          25% {
            opacity: 1;
          }
          70% {
            transform: scaleY(1.1);
          }
          100% {
            transform: scaleY(1);
            opacity: 1;
          }
        }

        .paint-drip {
          animation: dripAppear 0.55s cubic-bezier(0.4, 0, 0.2, 1) forwards;
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
          animation: highlightAppear 0.35s ease-out forwards;
          opacity: 0;
        }

        /* Prefers reduced motion */
        @media (prefers-reduced-motion: reduce) {
          .paint-falling-drop,
          .paint-splatter-expand,
          .paint-satellite,
          .paint-drip,
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
