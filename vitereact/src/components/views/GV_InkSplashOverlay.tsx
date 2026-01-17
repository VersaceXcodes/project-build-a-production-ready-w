import React, { useState, useEffect, useCallback } from 'react';
import sultanstampLogo from '@/assets/sultanstamp_logo.jpeg';

const SPLASH_SHOWN_KEY = 'sultanstamp_splash_shown';

interface GV_InkSplashOverlayProps {
  onComplete: () => void;
}

const GV_InkSplashOverlay: React.FC<GV_InkSplashOverlayProps> = ({ onComplete }) => {
  const [phase, setPhase] = useState<'ink' | 'logo' | 'text' | 'hold' | 'fadeout' | 'done'>('ink');
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

    // Timeline:
    // 0-1.5s: ink animation only
    // 1.2-1.8s: logo appears with scale/opacity pop
    // 1.8-2.4s: text reveals with wipe
    // 2.4-3.2s: hold
    // 3.2s+: fade out

    const timers: ReturnType<typeof setTimeout>[] = [];

    // Phase 1: Logo starts appearing at 1.2s
    timers.push(setTimeout(() => setPhase('logo'), 1200));

    // Phase 2: Text starts revealing at 1.8s
    timers.push(setTimeout(() => setPhase('text'), 1800));

    // Phase 3: Hold at 2.4s
    timers.push(setTimeout(() => setPhase('hold'), 2400));

    // Phase 4: Start fade out at 3.2s
    timers.push(setTimeout(() => {
      setIsFadingOut(true);
      setPhase('fadeout');
    }, 3200));

    // Phase 5: Complete and unmount at 3.7s
    timers.push(setTimeout(() => {
      sessionStorage.setItem(SPLASH_SHOWN_KEY, 'true');
      setPhase('done');
      onComplete();
    }, 3700));

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
      style={{ backgroundColor: '#000' }}
    >
      {/* Ink Animation Layer */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Multiple ink splatter elements with staggered animations */}
        <div className="ink-splash ink-splash-1" />
        <div className="ink-splash ink-splash-2" />
        <div className="ink-splash ink-splash-3" />
        <div className="ink-splash ink-splash-4" />
        <div className="ink-splash ink-splash-5" />
      </div>

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
              filter: 'drop-shadow(0 0 20px rgba(255,255,255,0.3))'
            }}
          />
        </div>

        {/* Brand name with left-to-right wipe reveal */}
        <div className="relative overflow-hidden">
          <h1
            className="text-3xl md:text-5xl font-bold tracking-wider text-white"
            style={{
              fontFamily: "'Playfair Display', serif",
              textShadow: '0 2px 20px rgba(255,255,255,0.2)'
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
        @keyframes inkSplash {
          0% {
            transform: scale(0) translate(-50%, -50%);
            opacity: 0;
          }
          20% {
            opacity: 0.8;
          }
          50% {
            transform: scale(1.2) translate(-50%, -50%);
            opacity: 0.6;
          }
          100% {
            transform: scale(2) translate(-50%, -50%);
            opacity: 0.4;
          }
        }

        @keyframes inkSpread {
          0% {
            transform: scale(0);
            opacity: 0;
            filter: blur(0px);
          }
          30% {
            opacity: 0.9;
            filter: blur(2px);
          }
          70% {
            transform: scale(1.5);
            opacity: 0.5;
            filter: blur(4px);
          }
          100% {
            transform: scale(2.5);
            opacity: 0.3;
            filter: blur(6px);
          }
        }

        @keyframes inkDrip {
          0% {
            transform: translateY(-100%) scaleY(0);
            opacity: 0;
          }
          30% {
            transform: translateY(0%) scaleY(1);
            opacity: 0.8;
          }
          100% {
            transform: translateY(10%) scaleY(1.1);
            opacity: 0.6;
          }
        }

        .ink-splash {
          position: absolute;
          border-radius: 50%;
          background: radial-gradient(
            ellipse at center,
            rgba(30, 30, 30, 0.9) 0%,
            rgba(20, 20, 20, 0.7) 30%,
            rgba(10, 10, 10, 0.4) 60%,
            transparent 100%
          );
        }

        .ink-splash-1 {
          width: 400px;
          height: 400px;
          top: 50%;
          left: 50%;
          animation: inkSplash 1.5s ease-out forwards;
          animation-delay: 0s;
        }

        .ink-splash-2 {
          width: 300px;
          height: 350px;
          top: 45%;
          left: 45%;
          animation: inkSplash 1.3s ease-out forwards;
          animation-delay: 0.1s;
          background: radial-gradient(
            ellipse at center,
            rgba(40, 35, 30, 0.8) 0%,
            rgba(25, 22, 18, 0.5) 50%,
            transparent 100%
          );
        }

        .ink-splash-3 {
          width: 250px;
          height: 280px;
          top: 55%;
          left: 55%;
          animation: inkSplash 1.4s ease-out forwards;
          animation-delay: 0.2s;
          background: radial-gradient(
            ellipse at center,
            rgba(35, 30, 25, 0.85) 0%,
            rgba(20, 18, 15, 0.5) 50%,
            transparent 100%
          );
        }

        .ink-splash-4 {
          width: 350px;
          height: 300px;
          top: 48%;
          left: 52%;
          animation: inkSpread 1.6s ease-out forwards;
          animation-delay: 0.15s;
        }

        .ink-splash-5 {
          width: 500px;
          height: 450px;
          top: 50%;
          left: 50%;
          animation: inkSpread 1.8s ease-out forwards;
          animation-delay: 0.3s;
          background: radial-gradient(
            ellipse at center,
            rgba(25, 25, 25, 0.7) 0%,
            rgba(15, 15, 15, 0.4) 40%,
            transparent 80%
          );
        }

        /* Premium text styling */
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&display=swap');
      `}</style>
    </div>
  );
};

export default GV_InkSplashOverlay;
export { SPLASH_SHOWN_KEY };
