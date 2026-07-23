import { useEffect, useState } from 'react';

// Keeps a component mounted through its CSS exit animation instead of
// unmounting the instant `isOpen` flips to false. Pair with data-state
// ("open" | "closed") and the .anim-pill / .anim-sheet / .anim-backdrop
// classes in globals.css, and call handleAnimationEnd from onAnimationEnd.
export function usePresence(isOpen) {
  const [shouldRender, setShouldRender] = useState(isOpen);

  useEffect(() => {
    if (isOpen) setShouldRender(true);
  }, [isOpen]);

  const handleAnimationEnd = () => {
    if (!isOpen) setShouldRender(false);
  };

  return { shouldRender, handleAnimationEnd };
}
