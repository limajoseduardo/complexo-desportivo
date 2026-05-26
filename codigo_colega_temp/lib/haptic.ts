/**
 * Utility to provide haptic feedback on mobile devices using the Vibration API.
 */
export const triggerHaptic = (type: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' = 'light') => {
    if (typeof window === 'undefined' || !window.navigator.vibrate) return;

    switch (type) {
        case 'light':
            window.navigator.vibrate(10);
            break;
        case 'medium':
            window.navigator.vibrate(20);
            break;
        case 'heavy':
            window.navigator.vibrate(50);
            break;
        case 'success':
            window.navigator.vibrate([20, 10, 20]);
            break;
        case 'warning':
            window.navigator.vibrate([50, 50, 50]);
            break;
        case 'error':
            window.navigator.vibrate([100, 50, 100]);
            break;
        default:
            window.navigator.vibrate(10);
    }
};
