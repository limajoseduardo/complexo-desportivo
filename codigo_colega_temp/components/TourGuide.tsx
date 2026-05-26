
import React, { useEffect, useState, useRef } from 'react';

export interface TourStep {
  targetId: string;
  title: string;
  content: string;
  position?: 'top' | 'bottom';
}

interface TourGuideProps {
  steps: TourStep[];
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

export const TourGuide: React.FC<TourGuideProps> = ({ steps, isOpen, onClose, onComplete }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      // Small delay to ensure UI is rendered
      setTimeout(() => setIsReady(true), 500);
    } else {
      document.body.style.overflow = '';
      setIsReady(false);
      setCurrentStep(0);
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !isReady) return;

    const updatePosition = () => {
      const step = steps[currentStep];
      const element = document.getElementById(step.targetId);
      
      if (element) {
        // Scroll element into view smoothly
        element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
        
        // Wait for scroll to finish slightly before setting rect
        setTimeout(() => {
            const rect = element.getBoundingClientRect();
            setTargetRect(rect);
        }, 400);
      } else {
        // If element not found, skip or close (safety mechanism)
        console.warn(`Tour target ${step.targetId} not found`);
      }
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    return () => window.removeEventListener('resize', updatePosition);
  }, [currentStep, isOpen, isReady, steps]);

  if (!isOpen || !targetRect) return null;

  const step = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;

  const handleNext = () => {
    if (isLastStep) {
      onComplete();
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] touch-none">
      {/* 
         The "Spotlight" Effect.
         Instead of a complex SVG mask, we use a div with a MASSIVE box-shadow.
         This creates a transparent hole in the middle and dark surroundings.
      */}
      <div 
        className="absolute transition-all duration-500 ease-in-out border-2 border-primary rounded-xl pointer-events-none shadow-[0_0_0_9999px_rgba(0,0,0,0.85)]"
        style={{
          top: targetRect.top - 4, // Padding
          left: targetRect.left - 4,
          width: targetRect.width + 8,
          height: targetRect.height + 8,
          // backdropFilter: 'blur(4px)' // Optional: blur the background behind the shadow (expensive performance)
        }}
      >
         {/* Animated Pulse Ring around the target */}
         <div className="absolute inset-0 rounded-xl border-2 border-primary opacity-50 animate-ping"></div>
      </div>

      {/* Tooltip Box */}
      <div 
        className="absolute left-0 right-0 px-6 transition-all duration-500 ease-in-out flex justify-center"
        style={{
          top: step.position === 'top' 
            ? Math.max(20, targetRect.top - 180) 
            : Math.min(window.innerHeight - 200, targetRect.bottom + 20),
        }}
      >
        <div className="bg-surface border border-main/10 p-5 rounded-2xl shadow-2xl max-w-sm w-full animate-in fade-in zoom-in-95 duration-300 relative">
            {/* Arrow/Tail logic could be added here, simplified for now */}
            
            <div className="flex justify-between items-start mb-2">
                <h3 className="text-lg font-bold text-main">{step.title}</h3>
                <span className="text-[10px] font-bold bg-main/10 px-2 py-1 rounded text-muted">
                    {currentStep + 1} / {steps.length}
                </span>
            </div>
            
            <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
                {step.content}
            </p>

            <div className="flex gap-3">
                <button 
                    onClick={onClose}
                    className="flex-1 py-3 text-xs font-bold text-muted hover:text-main transition-colors"
                >
                    Pular
                </button>
                <button 
                    onClick={handleNext}
                    className="flex-[2] bg-primary text-background py-3 rounded-xl font-bold text-sm hover:brightness-110 shadow-lg shadow-primary/20 transition-all active:scale-95"
                >
                    {isLastStep ? 'Concluir' : 'Próximo'}
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};
