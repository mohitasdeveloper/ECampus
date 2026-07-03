export function showToast(message, type = 'info') {
    // A real implementation would create and show a toast element.
    alert(`[${type.toUpperCase()}] ${message}`);
}