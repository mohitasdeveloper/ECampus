import { initHotposts } from './hotposts.js';
import { showToast } from './ui.js';
import { timeAgo } from './utils.js';
import { supabase } from './supabase.js';
import { initFeed } from './feed.js';
import { initUpdates } from './updates.js';
import { CLOUDINARY_CLOUD_NAME, CLOUDINARY_AVATARS_PRESET } from './config.js';

let currentUserProfile = null;

document.addEventListener('DOMContentLoaded', async () => {
    // Check user session
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
        // If on a protected page and no session, redirect to login
        if (window.location.pathname.includes('index.html')) {
            window.location.replace('auth/login.html');
        }
        return;
    }

    // Fetch user profile from your 'profiles' table
    const { data: profile, error } = await supabase
        .from('users')
        .select('*')
        .eq('auth_user_id', session.user.id)
        .single();

    if (error) {
        console.error('Error fetching profile:', error);
        showToast('Could not load your profile.', 'error');
        // Optional: sign out if profile is missing
        // await supabase.auth.signOut();
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
    initFeed(profile);
    initUpdates();

    // Setup UI elements
    updateHeaderAvatar(profile.profile_img_url, profile.full_name);
    populateProfileUI(profile);
    setupThemeToggle();
    setupProfileAvatarUpload();
    document.getElementById('sign-out-btn').addEventListener('click', handleSignOut);

    // Initial tab setup
    switchTab('dashboard');
}

function populateProfileUI(profile) {
    if (!profile) return;

    // Main profile card
    document.getElementById('profile-avatar-large').src = profile.profile_img_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.full_name)}&background=e1e3e4`;
    document.getElementById('profile-name').textContent = profile.full_name;
    document.getElementById('profile-email').innerHTML = `<span class="material-symbols-outlined text-[16px]">mail</span> ${profile.email}`;
    document.getElementById('profile-bio').textContent = profile.bio || 'No bio yet. Click "Edit" to add one!';

    // Role badge
    const roleElement = document.getElementById('profile-role');
    if (roleElement) {
        roleElement.textContent = profile.role || 'Student';
    }

    // Details section
    document.getElementById('profile-id').textContent = profile.student_id;
    document.getElementById('profile-course').textContent = profile.course;

    // Feed input avatar
    document.getElementById('feed-input-avatar').src = profile.profile_img_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.full_name)}&background=e1e3e4`;
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

function setupProfileAvatarUpload() {
    const avatarContainer = document.getElementById('profile-avatar-container');
    const avatarInput = document.getElementById('avatar-upload-input');

    if (!avatarContainer || !avatarInput) return;

    avatarContainer.addEventListener('click', () => avatarInput.click());

    avatarInput.addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        showToast('Uploading new avatar...', 'info');
        avatarContainer.style.opacity = '0.6';

        try {
            // 1. Upload to Cloudinary
            const formData = new FormData();
            formData.append('file', file);
            formData.append('upload_preset', CLOUDINARY_AVATARS_PRESET);

            const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
                method: 'POST',
                body: formData,
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error.message);
            const imageUrl = data.secure_url;

            // 2. Update Supabase 'profiles' table
            const { error } = await supabase
                .from('users')
                .update({ profile_img_url: imageUrl })
                .eq('auth_user_id', currentUserProfile.auth_user_id);

            if (error) throw error;

            // 3. Update UI
            currentUserProfile.profile_img_url = imageUrl;
            document.getElementById('profile-avatar-large').src = imageUrl;
            updateHeaderAvatar(imageUrl, currentUserProfile.full_name);
            showToast('Avatar updated successfully!', 'success');

        } catch (error) {
            console.error('Error updating avatar:', error);
            showToast('Failed to update avatar. Please try again.', 'error');
        } finally {
            avatarContainer.style.opacity = '1';
            avatarInput.value = ''; // Reset input
        }
    });
}

async function handleSignOut() {
    await supabase.auth.signOut();
    window.location.replace('auth/login.html');
}

// Make utility functions globally available if they are called from HTML onclick
window.switchTab = switchTab;
window.openProfileModal = openProfileModal;
window.closeProfileModals = closeProfileModals;

function switchTab(tabId) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.add('hidden');
        tab.classList.remove('animate-fadeIn');
    });
    // Show target tab
    const target = document.getElementById(`view-${tabId}`);
    if (target) {
        target.classList.remove('hidden');
        target.classList.add('animate-fadeIn');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // Update Nav colors
    document.querySelectorAll('.nav-item').forEach(nav => {
        nav.classList.remove('bg-primary', 'text-white');
        nav.classList.add('text-gray-500', 'dark:text-gray-400');
    });
    const activeNav = document.getElementById(`nav-${tabId}`);
    if (activeNav) {
        activeNav.classList.remove('text-gray-500', 'dark:text-gray-400');
        activeNav.classList.add('bg-primary', 'text-white');
    }
}

function openProfileModal(type) { /* This can be expanded later */ }
function closeProfileModals() {
    document.querySelectorAll('[id^="modal-profile-"]').forEach(modal => {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    });
}