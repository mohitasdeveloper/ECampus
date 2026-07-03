import { initHotposts } from './hotposts.js';
import { showToast } from './ui.js';
import { timeAgo } from './utils.js';
import { supabase } from './supabase.js';
import { initFeed } from './feed.js';
import { initDiscover } from './discover.js';
import { initNotifications } from './notifications.js';
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
    initDiscover(profile);
    initNotifications(profile);
    initUpdates();

    // Setup UI elements
    updateHeaderAvatar(profile.profile_img_url, profile.full_name);
    populateProfileUI(profile);
    setupThemeToggle();
    setupEditProfileAvatarUpload();
    setupProfileAvatarUpload();
    document.getElementById('sign-out-btn').addEventListener('click', handleSignOut);

    // Initial tab setup
    switchTab('dashboard');
}

function renderSocialLinks(links) {
    const container = document.getElementById('profile-social-links');
    if (!container) return;

    container.innerHTML = ''; // Clear existing
    if (!links || Object.keys(links).length === 0) {
        container.innerHTML = `<p class="text-xs text-gray-400 italic">No social links added.</p>`;
        return;
    }

    for (const [platform, url] of Object.entries(links)) {
        const linkEl = document.createElement('a');
        linkEl.href = url;
        linkEl.target = '_blank';
        linkEl.title = platform.charAt(0).toUpperCase() + platform.slice(1);
        linkEl.className = 'w-10 h-10 bg-gray-100 dark:bg-neutral-800 rounded-full flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-primary/10 hover:text-primary transition-all text-lg font-bold';
        linkEl.textContent = platform.charAt(0).toUpperCase();
        container.appendChild(linkEl);
    }
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

    // Render social links
    renderSocialLinks(profile.social_links);
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

function setupEditProfileAvatarUpload() {
    const avatarInput = document.getElementById('edit-avatar-upload-input');
    if (!avatarInput) return;

    avatarInput.addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const preview = document.getElementById('edit-profile-avatar-preview');
        const originalSrc = preview.src;
        preview.src = URL.createObjectURL(file); // Show instant preview

        showToast('Uploading new avatar...', 'info');

        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('upload_preset', CLOUDINARY_AVATARS_PRESET);

            const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, { method: 'POST', body: formData });
            const data = await res.json();
            if (data.error) throw new Error(data.error.message);
            const imageUrl = data.secure_url;

            await saveUserProfile({ profile_img_url: imageUrl }, false); // Save only avatar URL, don't close modal
            preview.src = imageUrl; // Update preview with final URL

        } catch (error) {
            console.error('Error updating avatar from edit modal:', error);
            showToast('Failed to update avatar.', 'error');
            preview.src = originalSrc; // Revert preview on error
        } finally {
            avatarInput.value = '';
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

// --- PROFILE EDITING ---
let tempSocialLinks = {};

function openEditProfileModal() {
    if (!currentUserProfile) return;
    document.getElementById('edit-profile-name').value = currentUserProfile.full_name || '';
    document.getElementById('edit-profile-id').value = currentUserProfile.student_id || '';
    document.getElementById('edit-profile-course').value = currentUserProfile.course || '';
    document.getElementById('edit-profile-bio').value = currentUserProfile.bio || '';
    document.getElementById('edit-profile-avatar-preview').src = currentUserProfile.profile_img_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUserProfile.full_name)}&background=e1e3e4`;
    document.getElementById('modal-edit-profile').classList.replace('hidden', 'flex');
}

function closeEditProfileModal() {
    document.getElementById('modal-edit-profile').classList.replace('flex', 'hidden');
}

function triggerEditAvatarUpload() {
    document.getElementById('edit-avatar-upload-input').click();
}

async function saveUserProfile(extraUpdates = {}, closeModal = true) {
    const btn = document.getElementById('save-profile-btn');
    if (closeModal) { // Only show loading state on final save
        btn.disabled = true;
        btn.innerHTML = 'Saving...';
    }

    const updates = {
        full_name: document.getElementById('edit-profile-name').value.trim(),
        student_id: document.getElementById('edit-profile-id').value.trim(),
        course: document.getElementById('edit-profile-course').value.trim(),
        bio: document.getElementById('edit-profile-bio').value.trim(),
        ...extraUpdates
    };

    try {
        const { data, error } = await supabase
            .from('users')
            .update(updates)
            .eq('id', currentUserProfile.id)
            .select()
            .single();

        if (error) throw error;

        currentUserProfile = data; // Update local profile
        populateProfileUI(currentUserProfile); // Re-render UI
        updateHeaderAvatar(currentUserProfile.profile_img_url, currentUserProfile.full_name);
        showToast('Profile updated successfully!', 'success');
        if (closeModal) closeEditProfileModal();

    } catch (error) {
        console.error('Error saving profile:', error);
        showToast('Failed to save profile.', 'error');
    } finally {
        if (closeModal) {
            btn.disabled = false;
            btn.innerHTML = 'Save Changes';
        }
    }
}

// --- SOCIAL LINKS EDITING ---

function openEditSocialsModal() {
    if (!currentUserProfile) return;
    tempSocialLinks = { ...(currentUserProfile.social_links || {}) };
    renderTempSocialsList();
    document.getElementById('modal-edit-socials').classList.replace('hidden', 'flex');
}

function closeSocialsModal() {
    document.getElementById('modal-edit-socials').classList.replace('flex', 'hidden');
}

function renderTempSocialsList() {
    const list = document.getElementById('modal-socials-list');
    list.innerHTML = '';
    if (Object.keys(tempSocialLinks).length === 0) {
        list.innerHTML = `<p class="text-xs text-center text-gray-400 italic py-4">No links added yet.</p>`;
        return;
    }
    for (const [platform, url] of Object.entries(tempSocialLinks)) {
        list.innerHTML += `
            <div class="flex items-center gap-2 bg-gray-50 dark:bg-neutral-800/50 p-2 rounded-lg">
                <span class="font-bold text-xs capitalize text-gray-600 dark:text-gray-300 w-16">${platform}</span>
                <input type="text" value="${url}" class="flex-1 bg-transparent text-xs text-gray-500 dark:text-gray-400 outline-none" readonly>
                <button onclick="removeSocialLinkTemp('${platform}')" class="p-1 text-red-500 hover:bg-red-100 dark:hover:bg-red-500/20 rounded-full">
                    <span class="material-symbols-outlined text-sm">delete</span>
                </button>
            </div>
        `;
    }
}

function addSocialLinkTemp() {
    const platform = document.getElementById('add-social-platform').value;
    const url = document.getElementById('add-social-url').value.trim();
    if (!url) {
        showToast('Please enter a URL.', 'warning');
        return;
    }
    tempSocialLinks[platform] = url;
    renderTempSocialsList();
    document.getElementById('add-social-url').value = '';
}

function removeSocialLinkTemp(platform) {
    delete tempSocialLinks[platform];
    renderTempSocialsList();
}

async function saveSocialLinks() {
    const { error } = await supabase
        .from('users')
        .update({ social_links: tempSocialLinks })
        .eq('id', currentUserProfile.id);

    if (error) {
        showToast('Failed to save social links.', 'error');
        console.error('Error saving social links:', error);
    } else {
        currentUserProfile.social_links = tempSocialLinks;
        populateProfileUI(currentUserProfile);
        showToast('Social links updated!', 'success');
        closeSocialsModal();
    }
}

window.openEditProfileModal = openEditProfileModal;
window.closeEditProfileModal = closeEditProfileModal;
window.triggerEditAvatarUpload = triggerEditAvatarUpload;
window.saveUserProfile = saveUserProfile;
window.openEditSocialsModal = openEditSocialsModal;
window.closeSocialsModal = closeSocialsModal;
window.addSocialLinkTemp = addSocialLinkTemp;
window.removeSocialLinkTemp = removeSocialLinkTemp;
window.saveSocialLinks = saveSocialLinks;

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