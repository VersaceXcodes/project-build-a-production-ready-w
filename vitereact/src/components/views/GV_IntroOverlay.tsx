import React, { useState, useRef, useEffect } from 'react';

const VIDEO_URL = 'https://pub-3b7303b412294731aa17afb2c3dff192.r2.dev/8833a50a-5293-4e99-9814-e2c654d742a5/project-build-a-production-ready-w/intro-reveal.mp4';

const GV_IntroOverlay: React.FC = () => {
  const [isVisible, setIsVisible] = useState(true);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' && window.innerWidth < 768
  );
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    // Handle responsive detection
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    // Check if user has already seen the intro (session storage)
    const hasSeenIntro = sessionStorage.getItem('hasSeenIntro');
    if (hasSeenIntro) {
      setIsVisible(false);
      return;
    }

    // Try to play the video
    if (videoRef.current) {
      videoRef.current.play().catch((error) => {
        // If autoplay fails (e.g., due to browser policy), hide the overlay
        console.warn('Autoplay blocked:', error);
        handleVideoEnd();
      });
    }
  }, []);

  const handleVideoEnd = () => {
    // Mark intro as seen
    sessionStorage.setItem('hasSeenIntro', 'true');
    
    // Start fade out animation
    setIsFadingOut(true);
    
    // After fade out completes, remove from DOM
    setTimeout(() => {
      setIsVisible(false);
    }, 500); // Match the CSS transition duration
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 9999,
        backgroundColor: '#000000', // Black background to match video and fill empty space
        opacity: isFadingOut ? 0 : 1,
        transition: 'opacity 0.5s ease-out',
        pointerEvents: isFadingOut ? 'none' : 'auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <video
        ref={videoRef}
        src={VIDEO_URL}
        autoPlay
        muted
        playsInline
        onEnded={handleVideoEnd}
        style={{
          width: '100%',
          height: '100%',
          objectFit: isMobile ? 'contain' : 'cover',
        }}
      />
    </div>
  );
};

export default GV_IntroOverlay;
