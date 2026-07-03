export function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const typeClasses = {
        info: 'bg-blue-500',
        success: 'bg-primary',
        error: 'bg-error',
        warning: 'bg-orange-500'
    };

    const toast = document.createElement('div');
    toast.className = `w-full ${typeClasses[type]} text-white text-sm font-bold px-4 py-3 rounded-xl shadow-lg transform transition-all duration-300 translate-y-[-20px] opacity-0`;
    toast.textContent = message;

    container.appendChild(toast);

    // Animate in
    requestAnimationFrame(() => {
        toast.classList.remove('translate-y-[-20px]', 'opacity-0');
    });

    // Animate out and remove
    setTimeout(() => {
        toast.classList.add('opacity-0', 'scale-90');
        toast.addEventListener('transitionend', () => toast.remove());
    }, 3000);
}