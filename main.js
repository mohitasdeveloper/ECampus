import { initHotposts } from './hotposts.js';
import { showToast } from './ui.js';
import { timeAgo } from './utils.js';
import { supabase } from './supabase.js';
import { initFeed } from './feed.js';
import { initSearch } from './search.js';
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
    initSearch(profile);
    initNotifications(profile);
    initUpdates();

    // Setup UI elements
    updateHeaderAvatar(profile.profile_img_url, profile.full_name);
    populateProfileUI(profile);
    setupThemeToggle();
    setupEditProfileAvatarUpload();
    setupProfileAvatarUpload();
    document.getElementById('my-hotposts-btn')?.addEventListener('click', window.showMyHotposts);
    document.getElementById('sign-out-btn').addEventListener('click', handleSignOut);

    // Initial tab setup
    switchTab('dashboard');
}

const socialIconMap = {
    linkedin: { icon: 'fa-linkedin-in', color: 'bg-[#0A66C2]' },
    instagram: { icon: 'fa-instagram', color: 'bg-gradient-to-br from-purple-400 via-pink-500 to-red-500' },
    github: { icon: 'fa-github', color: 'bg-[#181717]' },
    twitter: { icon: 'fa-x-twitter', color: 'bg-[#000000]' },
    youtube: { icon: 'fa-youtube', color: 'bg-[#FF0000]' },
    discord: { icon: 'fa-discord', color: 'bg-[#5865F2]' },
    facebook: { icon: 'fa-facebook-f', color: 'bg-[#1877F2]' },
    behance: { icon: 'fa-behance', color: 'bg-[#053EFF]' },
    dribbble: { icon: 'fa-dribbble', color: 'bg-[#EA4C89]' },
    website: { icon: 'fa-globe', color: 'bg-gray-500' },
    other: { icon: 'fa-link', color: 'bg-gray-500' }
};

function renderSocialLinks(links, container = null) {
    const targetContainer = container || document.getElementById('profile-social-links');
    if (!targetContainer) return;

    targetContainer.innerHTML = ''; // Clear existing

    if (links && links.length > 0) {
        links.forEach(link => {
            const platformInfo = socialIconMap[link.platform] || socialIconMap['other'];
            const linkEl = document.createElement('a');
            linkEl.href = link.url;
            linkEl.target = '_blank';
            linkEl.title = link.platform.charAt(0).toUpperCase() + link.platform.slice(1);
            linkEl.className = `w-[52px] h-[52px] rounded-2xl flex items-center justify-center text-white text-2xl ${platformInfo.color} transition-transform hover:scale-110`;
            linkEl.innerHTML = `<i class="fa-brands ${platformInfo.icon}"></i>`;
            targetContainer.appendChild(linkEl);
        });
    }

    // Only add the '+' button to the user's own profile (when no container is passed)
    if (!container) {
        const addButton = document.createElement('button');
        addButton.onclick = () => openEditSocialsModal();
        addButton.className = 'w-[52px] h-[52px] rounded-2xl flex items-center justify-center bg-gray-100 dark:bg-neutral-800 border-2 border-dashed border-gray-300 dark:border-neutral-700 text-gray-400 dark:text-gray-500 hover:border-primary hover:text-primary transition-colors';
        addButton.innerHTML = `<span class="material-symbols-outlined">add</span>`;
        targetContainer.appendChild(addButton);
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

    // Connection count
    document.getElementById('profile-connection-count').textContent = profile.connection_count || 0;

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
let tempSocialLinks = [];

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
    tempSocialLinks = currentUserProfile.social_links ? JSON.parse(JSON.stringify(currentUserProfile.social_links)) : [];
    renderTempSocialsList();
    document.getElementById('modal-edit-socials').classList.replace('hidden', 'flex');
}

function closeSocialsModal() {
    document.getElementById('modal-edit-socials').classList.replace('flex', 'hidden');
}

function renderTempSocialsList() {
    const list = document.getElementById('modal-socials-list');
    list.innerHTML = '';
    if (tempSocialLinks.length === 0) {
        list.innerHTML = `<p class="text-xs text-center text-gray-400 italic py-4">No links added yet.</p>`;
        return;
    }
    tempSocialLinks.forEach((link, index) => {
        list.innerHTML += `
            <div class="flex items-center gap-2 bg-gray-50 dark:bg-neutral-800/50 p-2 rounded-lg">
                <span class="font-bold text-xs capitalize text-gray-600 dark:text-gray-300 w-16">${link.platform}</span>
                <input type="text" value="${link.url}" class="flex-1 bg-transparent text-xs text-gray-500 dark:text-gray-400 outline-none" readonly>
                <button onclick="removeSocialLinkTemp(${index})" class="p-1 text-red-500 hover:bg-red-100 dark:hover:bg-red-500/20 rounded-full">
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
    const existingLinkIndex = tempSocialLinks.findIndex(link => link.platform === platform);
    if (existingLinkIndex > -1) {
        tempSocialLinks[existingLinkIndex].url = url;
    } else {
        tempSocialLinks.push({ platform, url });
    }
    renderTempSocialsList();
    document.getElementById('add-social-url').value = '';
}

function removeSocialLinkTemp(index) {
    tempSocialLinks.splice(index, 1);
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

async function viewUserProfile(userId) {
    if (userId === currentUserProfile.id) {
        switchTab('profile');
        return;
    }

    // Fetch user data
    const { data: user, error } = await supabase.from('users').select('*').eq('id', userId).single();
    if (error || !user) {
        showToast('Could not load profile.', 'error');
        console.error('Error fetching user profile:', error);
        return;
    }

    // Fetch connection status between current user and the viewed user
    const { data: connection } = await supabase
        .from('connections')
        .select('status, user_one_id')
        .or(`(user_one_id.eq.${currentUserProfile.id},user_two_id.eq.${user.id}),(user_one_id.eq.${user.id},user_two_id.eq.${currentUserProfile.id})`)
        .single();

    const isConnected = connection?.status === 'accepted';

    if (user.is_private && !isConnected) {
        // Show Private Profile Modal
        document.getElementById('private-profile-avatar').src = user.profile_img_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.full_name)}&background=e1e3e4`;
        document.getElementById('private-profile-name').textContent = user.full_name;
        document.getElementById('private-profile-course').textContent = user.course || 'Student';
        const connectBtn = document.getElementById('private-connect-btn');

        if (connection?.status === 'pending') {
            connectBtn.textContent = 'Request Sent';
            connectBtn.disabled = true;
        } else {
            connectBtn.textContent = 'Request to Connect';
            connectBtn.disabled = false;
            connectBtn.onclick = () => handleConnectionRequest(user.id, connectBtn);
        }
        openProfileModal('private');
    } else {
        // Show Public Profile Modal
        document.getElementById('public-profile-avatar').src = user.profile_img_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.full_name)}&background=e1e3e4`;
        document.getElementById('public-profile-name').textContent = user.full_name;
        document.getElementById('public-profile-course').textContent = user.course || 'Student';
        document.getElementById('public-profile-bio').textContent = user.bio || 'No bio available.';
        renderSocialLinks(user.social_links, document.getElementById('public-profile-social-links'));
        const connectBtn = document.getElementById('public-connect-btn');

        if (isConnected) {
            connectBtn.textContent = 'Connected';
            connectBtn.disabled = true;
        } else if (connection?.status === 'pending') {
            connectBtn.textContent = 'Request Sent';
            connectBtn.disabled = true;
        } else {
            connectBtn.textContent = 'Connect';
            connectBtn.disabled = false;
            connectBtn.onclick = () => handleConnectionRequest(user.id, connectBtn);
        }
        openProfileModal('public');
    }
}

async function handleConnectionRequest(targetUserId, btn) {
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Pending...';
    }

    const { error } = await supabase.from('connections').insert({
        user_one_id: currentUserProfile.id, // The sender
        user_two_id: targetUserId, // The receiver
        status: 'pending'
    });

    if (error) {
        showToast('Failed to send request.', 'error');
        console.error('Error sending connection request:', error);
        if (btn) {
            btn.disabled = false;
            btn.textContent = 'Connect';
        }
    } else {
        showToast('Connection request sent!', 'success');
        if (btn) {
            btn.textContent = 'Request Sent';
        }
    }
}

window.viewUserProfile = viewUserProfile;

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

function openProfileModal(type) {
    const modal = document.getElementById(`modal-profile-${type}`);
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
}

function closeProfileModals() {
    document.querySelectorAll('[id^="modal-profile-"]').forEach(modal => {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    });
}