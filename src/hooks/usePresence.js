import { useEffect, useState } from 'react';

// Keeps a component mounted through its CSS exit transition instead of
// unmounting the instant `isOpen` flips to false. Pair with data-state
// ("open" | "closed") and the .anim-pill / .anim-sheet / .anim-backdrop
// classes in globals.css, and call handleTransitionEnd from onTransitionEnd.
export function usePresence(isOpen) {
  const [shouldRender, setShouldRender] = useState(isOpen);

  useEffect(() => {
    if (isOpen) setShouldRender(true);
  }, [isOpen]);

  const handleTransitionEnd = () => {
    if (!isOpen) setShouldRender(false);
  };

  return { shouldRender, handleTransitionEnd };
}
