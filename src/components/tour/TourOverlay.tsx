import { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTour } from '../../lib/tourContext';
import { X, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import Button from '../shared/Button';

type TargetRect = {
  top: number;
  left: number;
  width: number;
  height: number;
  bottom: number;
  right: number;
};

export default function TourOverlay() {
  const {
    isActive,
    currentStep,
    currentStepData,
    totalSteps,
    nextStep,
    previousStep,
    skipTour,
  } = useTour();

  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const [isReady, setIsReady] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const prevStepRef = useRef(currentStep);
  const prevRouteRef = useRef(currentStepData?.route);

  useEffect(() => {
    if (!isActive) {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.top = '';
      return;
    }

    const scrollY = window.scrollY;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';
    document.body.style.overflow = 'hidden';

    return () => {
      const scrollY = document.body.style.top;
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      document.body.style.overflow = '';
      if (scrollY) {
        window.scrollTo(0, parseInt(scrollY || '0') * -1);
      }
    };
  }, [isActive]);

  const findAndPositionTarget = useCallback(() => {
    if (!currentStepData) {
      setTargetRect(null);
      setIsReady(false);
      return;
    }

    // Center the tour-complete step
    if (currentStepData.id === 'tour-complete') {
      setTargetRect(null);
      setIsReady(true);
      return;
    }

    let attempts = 0;
    const maxAttempts = 30;

    const tryFind = () => {
      const target = document.querySelector(currentStepData.targetSelector) as HTMLElement;

      if (target && target.offsetParent !== null && target.offsetWidth > 0 && target.offsetHeight > 0) {
        const scrollY = parseInt(document.body.style.top || '0') * -1;

        const rect = target.getBoundingClientRect();
        const absoluteTop = rect.top + scrollY;

        const viewportHeight = window.innerHeight;
        const padding = 12;

        // Calculate final height - use actual element height unless maxHeight is set
        let finalHeight = rect.height;
        if (currentStepData.maxHeight && rect.height > currentStepData.maxHeight) {
          finalHeight = currentStepData.maxHeight;
        }

        const targetTop = rect.top;
        const targetBottom = targetTop + finalHeight;

        const needsScroll = targetTop < 80 || targetBottom > viewportHeight - 80;

        if (needsScroll) {
          document.body.style.position = '';
          document.body.style.top = '';

          const desiredTop = absoluteTop - 100;
          const scrollToY = Math.max(0, desiredTop);

          window.scrollTo({
            top: scrollToY,
            behavior: 'smooth'
          });

          setTimeout(() => {
            const newScrollY = window.scrollY;
            document.body.style.position = 'fixed';
            document.body.style.top = `-${newScrollY}px`;
            document.body.style.width = '100%';

            const updatedRect = target.getBoundingClientRect();

            let finalHeightAfterScroll = updatedRect.height;
            if (currentStepData.maxHeight && updatedRect.height > currentStepData.maxHeight) {
              finalHeightAfterScroll = currentStepData.maxHeight;
            }

            setTargetRect({
              top: updatedRect.top - padding,
              left: updatedRect.left - padding,
              width: updatedRect.width + padding * 2,
              height: finalHeightAfterScroll + padding * 2,
              bottom: updatedRect.top + finalHeightAfterScroll + padding,
              right: updatedRect.right + padding,
            });

            setIsReady(true);
          }, 600);
        } else {
          setTargetRect({
            top: rect.top - padding,
            left: rect.left - padding,
            width: rect.width + padding * 2,
            height: finalHeight + padding * 2,
            bottom: rect.top + finalHeight + padding,
            right: rect.right + padding,
          });

          setIsReady(true);
        }
      } else if (attempts < maxAttempts) {
        attempts++;
        setTimeout(tryFind, 100);
      } else {
        console.warn(`Tour: Could not find element ${currentStepData.targetSelector} after ${maxAttempts} attempts`);
        setTargetRect(null);
        setIsReady(true);
      }
    };

    setTimeout(tryFind, 50);
  }, [currentStepData]);

  useEffect(() => {
    if (isActive && currentStepData) {
      const isRouteChange = prevRouteRef.current !== currentStepData.route;
      const isStepChange = prevStepRef.current !== currentStep;

      if (isStepChange) {
        setIsReady(false);
        setTargetRect(null);
        setIsTransitioning(true);

        // Use longer delay for route changes to allow page to fully render
        const delay = isRouteChange ? 1500 : 300;

        setTimeout(() => {
          prevStepRef.current = currentStep;
          prevRouteRef.current = currentStepData.route;
          findAndPositionTarget();

          // Ensure transition state persists slightly longer to prevent flash
          setTimeout(() => {
            setIsTransitioning(false);
          }, isRouteChange ? 300 : 0);
        }, delay);
      } else {
        findAndPositionTarget();
      }
    }
  }, [isActive, currentStepData, currentStep, findAndPositionTarget]);

  useEffect(() => {
    if (!tooltipRef.current || !currentStepData || !isReady) return;

    const tooltip = tooltipRef.current;
    const tooltipWidth = 320;
    const tooltipHeight = tooltip.offsetHeight || 300;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    if (!targetRect) {
      setTooltipPosition({
        top: (viewportHeight - tooltipHeight) / 2,
        left: (viewportWidth - tooltipWidth) / 2,
      });
      return;
    }

    const gap = 32;
    const minMargin = 20;
    let top = 0;
    let left = 0;

    const targetCenterX = targetRect.left + targetRect.width / 2;
    const targetCenterY = targetRect.top + targetRect.height / 2;

    // Helper function to check if tooltip overlaps with target
    const checkOverlap = (tooltipTop: number, tooltipLeft: number) => {
      const tooltipRight = tooltipLeft + tooltipWidth;
      const tooltipBottom = tooltipTop + tooltipHeight;

      return !(
        tooltipRight < targetRect.left ||
        tooltipLeft > targetRect.right ||
        tooltipBottom < targetRect.top ||
        tooltipTop > targetRect.bottom
      );
    };

    // Try each position in order of preference
    let positioned = false;

    switch (currentStepData.position) {
      case 'bottom':
        top = targetRect.bottom + gap;
        left = targetCenterX - tooltipWidth / 2;

        // Check if it fits below
        if (top + tooltipHeight > viewportHeight - minMargin) {
          // Try above instead
          top = targetRect.top - tooltipHeight - gap;
          if (top < minMargin) {
            // Try right
            top = targetCenterY - tooltipHeight / 2;
            left = targetRect.right + gap;
            if (left + tooltipWidth > viewportWidth - minMargin) {
              // Try left
              left = targetRect.left - tooltipWidth - gap;
            }
          }
        }
        break;
      case 'top':
        top = targetRect.top - tooltipHeight - gap;
        left = targetCenterX - tooltipWidth / 2;

        // Check if it fits above
        if (top < minMargin) {
          // Try below instead
          top = targetRect.bottom + gap;
          if (top + tooltipHeight > viewportHeight - minMargin) {
            // Try right
            top = targetCenterY - tooltipHeight / 2;
            left = targetRect.right + gap;
            if (left + tooltipWidth > viewportWidth - minMargin) {
              // Try left
              left = targetRect.left - tooltipWidth - gap;
            }
          }
        }
        break;
      case 'left':
        top = targetCenterY - tooltipHeight / 2;
        left = targetRect.left - tooltipWidth - gap;

        // Check if it fits to the left
        if (left < minMargin) {
          // Try right instead
          left = targetRect.right + gap;
          if (left + tooltipWidth > viewportWidth - minMargin) {
            // Try below
            top = targetRect.bottom + gap;
            left = targetCenterX - tooltipWidth / 2;
            if (top + tooltipHeight > viewportHeight - minMargin) {
              // Try above
              top = targetRect.top - tooltipHeight - gap;
            }
          }
        }
        break;
      case 'right':
        top = targetCenterY - tooltipHeight / 2;
        left = targetRect.right + gap;

        // Check if it fits to the right
        if (left + tooltipWidth > viewportWidth - minMargin) {
          // Try left instead
          left = targetRect.left - tooltipWidth - gap;
          if (left < minMargin) {
            // Try below
            top = targetRect.bottom + gap;
            left = targetCenterX - tooltipWidth / 2;
            if (top + tooltipHeight > viewportHeight - minMargin) {
              // Try above
              top = targetRect.top - tooltipHeight - gap;
            }
          }
        }
        break;
    }

    // Final bounds checking and overlap prevention
    if (left < minMargin) left = minMargin;
    if (left + tooltipWidth > viewportWidth - minMargin) {
      left = viewportWidth - tooltipWidth - minMargin;
    }
    if (top < minMargin) top = minMargin;
    if (top + tooltipHeight > viewportHeight - minMargin) {
      top = viewportHeight - tooltipHeight - minMargin;
    }

    // If still overlapping, force it to the side with most space
    if (checkOverlap(top, left)) {
      const spaceAbove = targetRect.top;
      const spaceBelow = viewportHeight - targetRect.bottom;
      const spaceLeft = targetRect.left;
      const spaceRight = viewportWidth - targetRect.right;

      const maxSpace = Math.max(spaceAbove, spaceBelow, spaceLeft, spaceRight);

      if (maxSpace === spaceRight) {
        left = targetRect.right + gap;
        top = Math.max(minMargin, Math.min(targetCenterY - tooltipHeight / 2, viewportHeight - tooltipHeight - minMargin));
      } else if (maxSpace === spaceBelow) {
        top = targetRect.bottom + gap;
        left = Math.max(minMargin, Math.min(targetCenterX - tooltipWidth / 2, viewportWidth - tooltipWidth - minMargin));
      } else if (maxSpace === spaceLeft) {
        left = targetRect.left - tooltipWidth - gap;
        top = Math.max(minMargin, Math.min(targetCenterY - tooltipHeight / 2, viewportHeight - tooltipHeight - minMargin));
      } else {
        top = targetRect.top - tooltipHeight - gap;
        left = Math.max(minMargin, Math.min(targetCenterX - tooltipWidth / 2, viewportWidth - tooltipWidth - minMargin));
      }
    }

    setTooltipPosition({ top, left });
  }, [targetRect, currentStepData, isReady]);

  if (!isActive || !currentStepData) return null;

  const getPageName = (route: string) => {
    const routeNames: { [key: string]: string } = {
      '/dashboard': 'Dashboard',
      '/journal': 'Journal',
      '/analytics': 'Analytics',
      '/settings': 'Settings',
      '/nova': 'Nova Assistant',
    };
    return routeNames[route] || 'Next Step';
  };

  const isRouteChange = currentStepData && prevRouteRef.current &&
                        prevRouteRef.current !== currentStepData.route;

  return (
    <AnimatePresence>
      <div ref={overlayRef} className="fixed inset-0 z-[9998]" style={{ pointerEvents: 'auto' }}>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="absolute inset-0"
        >
          {targetRect && isReady && !isTransitioning ? (
            <>
              <div
                className="absolute bg-black/90 transition-all duration-500 ease-out"
                style={{
                  top: 0,
                  left: 0,
                  right: 0,
                  height: Math.max(0, targetRect.top),
                }}
              />
              <div
                className="absolute bg-black/90 transition-all duration-500 ease-out"
                style={{
                  top: targetRect.bottom,
                  left: 0,
                  right: 0,
                  bottom: 0,
                }}
              />
              <div
                className="absolute bg-black/90 transition-all duration-500 ease-out"
                style={{
                  top: targetRect.top,
                  left: 0,
                  width: Math.max(0, targetRect.left),
                  height: targetRect.height,
                }}
              />
              <div
                className="absolute bg-black/90 transition-all duration-500 ease-out"
                style={{
                  top: targetRect.top,
                  left: targetRect.right,
                  right: 0,
                  height: targetRect.height,
                }}
              />

              <motion.div
                key={`highlight-${currentStep}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="absolute rounded-2xl pointer-events-none transition-all duration-500 ease-out"
                style={{
                  top: targetRect.top,
                  left: targetRect.left,
                  width: targetRect.width,
                  height: targetRect.height,
                  border: '3px solid rgba(59, 130, 246, 0.8)',
                  boxShadow: `
                    0 0 0 4px rgba(59, 130, 246, 0.2),
                    0 0 40px rgba(59, 130, 246, 0.6),
                    0 0 80px rgba(59, 130, 246, 0.4)
                  `,
                }}
              />
            </>
          ) : (
            <div className="absolute inset-0 bg-black/90" />
          )}
        </motion.div>

        {isTransitioning && isRouteChange && currentStepData && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[10001]"
          >
            <div
              className="bg-[#0A0A0A] rounded-2xl p-6 border"
              style={{
                borderColor: 'rgba(59, 130, 246, 0.4)',
                boxShadow: `
                  0 0 40px rgba(59, 130, 246, 0.3),
                  0 25px 50px -12px rgba(0, 0, 0, 0.8)
                `,
              }}
            >
              <div className="flex items-center gap-4">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{
                    background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.3) 0%, rgba(59, 130, 246, 0.1) 100%)',
                    boxShadow: '0 0 25px rgba(59, 130, 246, 0.4)',
                  }}
                >
                  <Sparkles className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-400 mb-1">Moving to</p>
                  <h3 className="text-lg font-semibold text-white">{getPageName(currentStepData.route)}</h3>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {isReady && currentStepData && !isTransitioning && (
          <motion.div
            ref={tooltipRef}
            key={currentStep}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed z-[10000] w-80"
            style={{
              top: tooltipPosition.top,
              left: tooltipPosition.left,
            }}
          >
            <div
              className="bg-[#0A0A0A] rounded-2xl overflow-hidden"
              style={{
                border: '1px solid rgba(59, 130, 246, 0.4)',
                boxShadow: `
                  0 0 40px rgba(59, 130, 246, 0.2),
                  0 25px 50px -12px rgba(0, 0, 0, 0.6)
                `,
              }}
            >
              <div
                className="p-4 border-b border-white/5"
                style={{
                  background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, transparent 100%)',
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{
                      background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.3) 0%, rgba(59, 130, 246, 0.1) 100%)',
                      boxShadow: '0 0 25px rgba(59, 130, 246, 0.4)',
                    }}
                  >
                    <Sparkles className="w-5 h-5 text-blue-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-white">{currentStepData.title}</h3>
                    <p className="text-xs text-gray-400">Step {currentStep + 1} of {totalSteps}</p>
                  </div>
                  <button
                    onClick={skipTour}
                    className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              <div className="p-4">
                {!targetRect && currentStepData.id !== 'tour-complete' && (
                  <div className="mb-3 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                    <p className="text-xs text-yellow-400">
                      This element is not currently visible on the page. The content may still be helpful!
                    </p>
                  </div>
                )}
                <p className="text-sm text-gray-300 leading-relaxed">
                  {currentStepData.content}
                </p>
              </div>

              <div className="p-4 pt-0 space-y-3">
                <div className="flex justify-center">
                  <div className="flex gap-1 flex-wrap justify-center max-w-[200px]">
                    {Array.from({ length: totalSteps }).map((_, i) => (
                      <div
                        key={i}
                        className="w-1.5 h-1.5 rounded-full transition-all duration-300"
                        style={{
                          backgroundColor: i === currentStep
                            ? 'rgb(59, 130, 246)'
                            : i < currentStep
                              ? 'rgba(59, 130, 246, 0.5)'
                              : 'rgba(255, 255, 255, 0.2)',
                          boxShadow: i === currentStep
                            ? '0 0 12px rgba(59, 130, 246, 0.6)'
                            : 'none',
                        }}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex justify-between gap-2">
                  <div>
                    {currentStep > 0 && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={previousStep}
                        icon={<ChevronLeft size={14} />}
                      >
                        Back
                      </Button>
                    )}
                  </div>
                  <button
                    onClick={nextStep}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-all hover:scale-[1.02]"
                    style={{
                      background: 'linear-gradient(135deg, rgb(59, 130, 246) 0%, rgb(37, 99, 235) 100%)',
                      boxShadow: '0 0 25px rgba(59, 130, 246, 0.5)',
                      color: 'white',
                    }}
                  >
                    {currentStep === totalSteps - 1 ? 'Get Started' : 'Next'}
                    {currentStep !== totalSteps - 1 && <ChevronRight size={14} />}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </AnimatePresence>
  );
}
