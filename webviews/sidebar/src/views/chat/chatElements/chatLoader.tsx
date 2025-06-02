import React, { useState, useEffect, useRef } from 'react';

interface GeneratingLoaderProps {
  text: string;
  speed?: number;
}

const GeneratingLoader: React.FC<GeneratingLoaderProps> = ({ text, speed = 100 }) => {
  const [displayText, setDisplayText] = useState('');
  const [showDots, setShowDots] = useState(false);
  const [dots, setDots] = useState('');
  const currentIndexRef = useRef(0);

  // Reset when text changes
  useEffect(() => {
    setDisplayText('');
    setShowDots(false);
    currentIndexRef.current = 0;
  }, [text]);

  // Handle text animation
  useEffect(() => {
    if (currentIndexRef.current >= text.length) {
      setShowDots(true);
      return;
    }

    const textInterval = setInterval(() => {
      setDisplayText(prev => {
        if (currentIndexRef.current < text.length) {
          const newText = prev + text[currentIndexRef.current];
          currentIndexRef.current += 1;
          return newText;
        }
        setShowDots(true);
        clearInterval(textInterval);
        return prev;
      });
    }, speed);

    return () => clearInterval(textInterval);
  }, [text, speed]);

  // Handle dots animation (only starts when showDots is true)
  useEffect(() => {
    if (!showDots) return;

    const dotsInterval = setInterval(() => {
      setDots(prev => (prev.length < 3 ? prev + '.' : ''));
    }, 500);

    return () => clearInterval(dotsInterval);
  }, [showDots]);

  return (
    <div className='text-xs text-gray-500' style={{ display: 'inline-flex', alignItems: 'center', fontFamily: 'Arial, sans-serif' }}>
      <span style={{ marginRight: '0.5rem' }}>{displayText}</span>
      {showDots && <span style={{ width: '1.5rem', textAlign: 'left' }}>{dots}</span>}
    </div>
  );
};

export default GeneratingLoader;