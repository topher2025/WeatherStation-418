// ========== Auto Logout on Page Unload ==========
// Automatically log out the user when they close the tab/window

console.log('[LOGOUT] Script loaded - auto logout monitoring active');

// Track if logout was already triggered
let logoutTriggered = false;

window.addEventListener('beforeunload', function (event) {
    if (logoutTriggered) {
        console.log('[LOGOUT] Already triggered, skipping');
        return;
    }
    
    logoutTriggered = true;
    console.log('[LOGOUT] beforeunload event fired - attempting auto logout');
    console.log('[LOGOUT] Window/Tab is closing');
    
    try {
        // Send logout beacon - this is fire-and-forget
        // It will attempt to send even after page unload
        console.log('[LOGOUT] Calling navigator.sendBeacon("/logout")');
        const result = navigator.sendBeacon('/logout');
        console.log('[LOGOUT] sendBeacon returned:', result);
        
        if (result === true) {
            console.log('[LOGOUT] ✓ Beacon sent successfully - session will be cleared');
        } else {
            console.log('[LOGOUT] ✗ Beacon send returned false - may not be sent');
        }
    } catch (error) {
        console.error('[LOGOUT] Error sending beacon:', error);
    }
});

// Also log page visibility changes for debugging
document.addEventListener('visibilitychange', function () {
    console.log('[LOGOUT] Visibility changed - hidden:', document.hidden);
});

console.log('[LOGOUT] Event listeners registered for auto logout');






