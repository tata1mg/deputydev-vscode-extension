import { ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

type PageTransitionProps = {
  children: ReactNode;
  key?: string;
  direction?: 'left' | 'right';
};

export function PageTransition({ children, key, direction = 'right' }: PageTransitionProps) {
  // Define slide directions more clearly
  // 'right' means sliding from right to left (new content comes from right)
  // 'left' means sliding from left to right (new content comes from left)
  const slideDistance = 50; // Increased for more noticeable effect

  const variants = {
    initial: {
      opacity: 0,
      x: direction === 'right' ? slideDistance : -slideDistance,
    },
    animate: {
      opacity: 1,
      x: 0,
    },
    exit: {
      opacity: 0,
      x: direction === 'right' ? -slideDistance : slideDistance,
    },
  };

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={key}
        variants={variants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={{
          duration: 0.5, // Slower for more visible effect
          ease: [0.22, 1, 0.36, 1], // Better easing for smooth directional movement
        }}
        className="h-full w-full"
        style={{
          position: 'relative',
          willChange: 'transform, opacity',
        }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
