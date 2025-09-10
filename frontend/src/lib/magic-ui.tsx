import React from 'react';
import { motion } from 'framer-motion';
import { Box, BoxProps } from '@chakra-ui/react';

// Magic UI Animated Card Component
interface MagicCardProps extends BoxProps {
  children: React.ReactNode;
  hover?: boolean;
  glow?: boolean;
  delay?: number;
  duration?: number;
}

export function MagicCard({ 
  children, 
  hover = true, 
  glow = true, 
  delay = 0, 
  duration = 0.3,
  ...props 
}: MagicCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ 
        duration: duration,
        delay: delay,
        ease: "easeOut"
      }}
      whileHover={hover ? {
        scale: 1.02,
        y: -5,
        transition: { duration: 0.2 }
      } : {}}
      style={{ position: 'relative' }}
    >
      <Box
        position="relative"
        overflow="hidden"
        _before={glow ? {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'linear-gradient(45deg, transparent, rgba(14, 165, 233, 0.1), transparent)',
          opacity: 0,
          transition: 'opacity 0.3s ease',
          zIndex: 1,
          pointerEvents: 'none'
        } : {}}
        _hover={glow ? {
          _before: {
            opacity: 1
          }
        } : {}}
        {...props}
      >
        {children}
      </Box>
    </motion.div>
  );
}

// Magic UI Floating Animation
interface MagicFloatProps {
  children: React.ReactNode;
  intensity?: number;
  speed?: number;
  delay?: number;
}

export function MagicFloat({ 
  children, 
  intensity = 10, 
  speed = 3, 
  delay = 0 
}: MagicFloatProps) {
  return (
    <motion.div
      animate={{
        y: [0, -intensity, 0],
        rotate: [0, 1, -1, 0]
      }}
      transition={{
        duration: speed,
        repeat: Infinity,
        ease: "easeInOut",
        delay: delay
      }}
    >
      {children}
    </motion.div>
  );
}

// Magic UI Shimmer Effect
interface MagicShimmerProps {
  children: React.ReactNode;
  width?: string;
  height?: string;
  color?: string;
}

export function MagicShimmer({ 
  children, 
  width = "100%", 
  height = "100%",
  color = "linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)"
}: MagicShimmerProps) {
  return (
    <Box position="relative" overflow="hidden" width={width} height={height}>
      {children}
      <motion.div
        style={{
          position: 'absolute',
          top: 0,
          left: '-100%',
          width: '100%',
          height: '100%',
          background: color,
          zIndex: 1
        }}
        animate={{
          left: ['100%', '100%']
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          repeatDelay: 3,
          ease: "easeInOut"
        }}
      />
    </Box>
  );
}

// Magic UI Gradient Border
interface MagicGradientBorderProps extends BoxProps {
  children: React.ReactNode;
  gradient?: string;
  thickness?: number;
  animated?: boolean;
}

export function MagicGradientBorder({ 
  children, 
  gradient = "linear-gradient(45deg, #0F766E, #059669, #0D9488)",
  thickness = 2,
  animated = true,
  ...props 
}: MagicGradientBorderProps) {
  return (
    <Box
      position="relative"
      p={thickness}
      borderRadius="inherit"
      background={animated ? 
        `conic-gradient(from 0deg, #0F766E, #059669, #0D9488, #0F766E)` : 
        gradient
      }
      {...props}
    >
      <Box
        position="relative"
        bg="inherit"
        borderRadius="inherit"
        zIndex={1}
      >
        {children}
      </Box>
      {animated && (
        <motion.div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            borderRadius: 'inherit',
            background: 'conic-gradient(from 0deg, #0F766E, #059669, #0D9488, #0F766E)',
            zIndex: 0
          }}
          animate={{ rotate: 360 }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "linear"
          }}
        />
      )}
    </Box>
  );
}

// Magic UI Reveal Animation
interface MagicRevealProps {
  children: React.ReactNode;
  direction?: 'up' | 'down' | 'left' | 'right';
  delay?: number;
  duration?: number;
  distance?: number;
}

export function MagicReveal({ 
  children, 
  direction = 'up', 
  delay = 0, 
  duration = 0.6,
  distance = 50
}: MagicRevealProps) {
  const directionMap = {
    up: { y: distance, x: 0 },
    down: { y: -distance, x: 0 },
    left: { y: 0, x: distance },
    right: { y: 0, x: -distance }
  };

  return (
    <motion.div
      initial={directionMap[direction]}
      whileInView={{ y: 0, x: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{
        duration: duration,
        delay: delay,
        ease: "easeOut"
      }}
    >
      {children}
    </motion.div>
  );
}

// Magic UI Pulse Animation
interface MagicPulseProps {
  children: React.ReactNode;
  intensity?: number;
  speed?: number;
  color?: string;
}

export function MagicPulse({ 
  children, 
  intensity = 0.1, 
  speed = 2,
  color = "rgba(14, 165, 233, 0.3)"
}: MagicPulseProps) {
  return (
    <motion.div
      animate={{
        scale: [1, 1 + intensity, 1],
        boxShadow: [
          `0 0 0 0 ${color}`,
          `0 0 0 10px ${color}00`,
          `0 0 0 0 ${color}00`
        ]
      }}
      transition={{
        duration: speed,
        repeat: Infinity,
        ease: "easeInOut"
      }}
    >
      {children}
    </motion.div>
  );
}

// Magic UI Typewriter Effect
interface MagicTypewriterProps {
  text: string;
  speed?: number;
  delay?: number;
  onComplete?: () => void;
}

export function MagicTypewriter({ 
  text, 
  speed = 50, 
  delay = 0,
  onComplete
}: MagicTypewriterProps) {
  const [displayText, setDisplayText] = React.useState('');
  const [currentIndex, setCurrentIndex] = React.useState(0);

  React.useEffect(() => {
    if (currentIndex < text.length) {
      const timeout = setTimeout(() => {
        setDisplayText(prev => prev + text[currentIndex]);
        setCurrentIndex(prev => prev + 1);
      }, speed);
      return () => clearTimeout(timeout);
    } else if (onComplete) {
      onComplete();
    }
  }, [currentIndex, text, speed, onComplete]);

  React.useEffect(() => {
    const timeout = setTimeout(() => {
      setCurrentIndex(0);
      setDisplayText('');
    }, delay);
    return () => clearTimeout(timeout);
  }, [delay]);

  return (
    <span>
      {displayText}
      <motion.span
        animate={{ opacity: [1, 0, 1] }}
        transition={{ duration: 0.8, repeat: Infinity }}
      >
        |
      </motion.span>
    </span>
  );
}

// Magic UI Stagger Container
interface MagicStaggerProps {
  children: React.ReactNode;
  stagger?: number;
  delay?: number;
}

export function MagicStagger({ 
  children, 
  stagger = 0.1, 
  delay = 0 
}: MagicStaggerProps) {
  const childrenArray = React.Children.toArray(children);
  
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: {
            staggerChildren: stagger,
            delayChildren: delay
          }
        }
      }}
    >
      {childrenArray.map((child, index) => (
        <motion.div
          key={index}
          variants={{
            hidden: { opacity: 0, y: 20 },
            visible: { opacity: 1, y: 0 }
          }}
        >
          {child}
        </motion.div>
      ))}
    </motion.div>
  );
}
