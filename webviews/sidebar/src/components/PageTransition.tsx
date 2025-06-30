import { ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

type PageTransitionProps = {
  children: ReactNode;
  key?: string;
  direction?: 'left' | 'right';
};

export function PageTransition({ children, key, direction = 'right' }: PageTransitionProps) {
  // For entering animation
  const initialX = direction === 'right' ? 40 : -40; // Increased from 20 to 40 for more noticeable slide
  const exitX = direction === 'right' ? -40 : 40; // Increased from 20 to 40 for more noticeable slide

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={key}
        initial={{ opacity: 0, x: initialX }}
        animate={{
          opacity: 1,
          x: 0,
          transition: {
            duration: 0.4, // Increased from 0.2 to 0.4 seconds
            ease: [0.2, 0, 0.1, 1], // Smoother easing function
          },
        }}
        exit={{
          opacity: 0,
          x: exitX,
          transition: {
            duration: 0.3, // Slightly faster exit
            ease: [0.4, 0, 0.2, 1], // Slightly different easing for exit
          },
        }}
        className="h-full w-full"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
