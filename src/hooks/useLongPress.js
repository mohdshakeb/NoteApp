import { useMemo, useRef } from 'react';

const THRESHOLD_MS = 500;
const MOVE_CANCEL_PX = 10;

// Touch-only long-press detection, spread once onto a shared container
// (handlers read `e.currentTarget`/`e.target` at fire time, so this doesn't
// need to be re-instantiated per row). Deliberately ignores mouse pointers —
// desktop uses the hover action row instead, this hook should never engage
// there. Suppresses the synthetic click a touch browser fires right after a
// long-press-then-release, so it doesn't also trigger click-to-edit on the
// element underneath.
export function useLongPress(onLongPress, { threshold = THRESHOLD_MS, moveThreshold = MOVE_CANCEL_PX } = {}) {
    const timerRef = useRef(null);
    const startPosRef = useRef({ x: 0, y: 0 });
    const firedRef = useRef(false);
    const targetRef = useRef(null);
    const lastPointerTypeRef = useRef(null);

    const clearTimer = () => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    };

    return useMemo(() => ({
        onPointerDown: (e) => {
            lastPointerTypeRef.current = e.pointerType;
            if (e.pointerType === 'mouse') return;
            targetRef.current = e.currentTarget;
            startPosRef.current = { x: e.clientX, y: e.clientY };
            firedRef.current = false;
            clearTimer();
            timerRef.current = setTimeout(() => {
                firedRef.current = true;
                onLongPress(targetRef.current);
            }, threshold);
        },
        onPointerMove: (e) => {
            if (!timerRef.current) return;
            const dx = e.clientX - startPosRef.current.x;
            const dy = e.clientY - startPosRef.current.y;
            if (Math.hypot(dx, dy) > moveThreshold) clearTimer();
        },
        onPointerUp: clearTimer,
        onPointerLeave: clearTimer,
        onPointerCancel: clearTimer,
        onClickCapture: (e) => {
            if (firedRef.current) {
                e.preventDefault();
                e.stopPropagation();
                firedRef.current = false;
            }
        },
        onContextMenu: (e) => {
            // Only suppress the native callout for the touch/pen long-press
            // we're already handling — a desktop right-click should keep
            // its normal context menu.
            if (lastPointerTypeRef.current && lastPointerTypeRef.current !== 'mouse') e.preventDefault();
        },
    }), [onLongPress, threshold, moveThreshold]);
}
