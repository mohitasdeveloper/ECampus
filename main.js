import { initHotposts } from './hotposts.js';
import { showToast } from './ui.js';
import { timeAgo } from './utils.js';

const sb = window.sb; // Supabase client from supabase.js
let currentUserProfile = null;

document.addEventListener('DOMContentLoaded', async () => {
    // Check user session
    const { data: { session } } = await sb.auth.getSession();

    if (!session) {
        // If on a protected page and no session, redirect to login
        if (window.location.pathname.includes('index.html')) {
            window.location.replace('auth/login.html');
        }
        return;
    }

    // Fetch user profile from your 'profiles' table
    const { data: profile, error } = await sb
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

    if (error) {
        console.error('Error fetching profile:', error);
        showToast('Could not load your profile.', 'error');
        // Optional: sign out if profile is missing
        // await sb.auth.signOut();
        // window.location.replace('auth/login.html');
        return;
    }

    currentUserProfile = profile;
    initializeApp(profile);
});

function initializeApp(profile) {
    console.log('Welcome to ECampus,', profile.full_name);

    // Initialize features that need the user object
    initHotposts(profile);

    // Setup UI elements
    updateHeaderAvatar(profile.avatar_url, profile.full_name);
    setupThemeToggle();

    // Initial tab setup
    switchTab('dashboard');
}

function updateHeaderAvatar(avatarUrl, fullName) {
    const avatarImg = document.getElementById('header-avatar');
    if (avatarImg) {
        avatarImg.src = avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=e1e3e4`;
    }
}

function setupThemeToggle() {
    const themeToggle = document.getElementById('theme-toggle-switch');
    if (!themeToggle) return;

    // Set initial state from localStorage
    const isDarkMode = localStorage.getItem('theme') === 'dark';
    document.documentElement.classList.toggle('dark', isDarkMode);
    themeToggle.checked = isDarkMode;

    // Add event listener
    themeToggle.addEventListener('change', () => {
        if (themeToggle.checked) {
            document.documentElement.classList.add('dark');
            localStorage.setItem('theme', 'dark');
        } else {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('theme', 'light');
        }
    });
}

// Make utility functions globally available if they are called from HTML onclick
window.switchTab = switchTab;
window.openProfileModal = openProfileModal;
window.closeProfileModals = closeProfileModals;

// Dummy functions for now, you would expand these
function switchTab(tabId) { /* ... from index.html ... */ }
function openProfileModal(type) { /* ... from index.html ... */ }
function closeProfileModals() { /* ... from index.html ... */ }

// You will also need a ui.js for showToast and utils.js for timeAgo
// For now, I'll add placeholder functions.

// In a new file `ui.js`
export function showToast(message, type = 'info') {
    // A real implementation would create a toast element and show it.
    alert(`[${type.toUpperCase()}] ${message}`);
}

// In a new file `utils.js`
export function timeAgo(date) {
    // A real implementation would calculate time difference.
    return new Date(date).toLocaleTimeString();
}