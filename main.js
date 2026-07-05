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
    // Check user sessions
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
        if (window.location.pathname.includes('index.html')) {
            window.location.replace('auth/login.html');
        }
        return;
    }

    // Fetch user profile
    const { data: profile, error } = await supabase
        .from('users')
        .select('*')
        .eq('auth_user_id', session.user.id)
        .single();

    if (error || !profile) {
        console.error('Error fetching profile:', error);
        showToast('Could not load your profile. Please try logging in again.', 'error');
        await supabase.auth.signOut();
        window.location.replace('auth/login.html');
        return;
    }

    currentUserProfile = profile;
    initializeApp(profile);
});

function initializeApp(profile) {
    console.log('Welcome to ECampus,', profile.full_name);

    initHotposts(profile);
    initFeed(profile);
    initSearch(profile);
    initNotifications(profile);
    initUpdates();

    updateHeaderAvatar(profile.profile_img_url, profile.full_name);
    populateProfileUI(profile);
    setupMoreMenuListener();
    setupThemeToggle();
    setupEditProfileAvatarUpload();
    setupProfileAvatarUpload();
    document.getElementById('sign-out-btn').addEventListener('click', handleSignOut);
    setupBlockedUsersListener();

    switchTab('dashboard');
}

function setupMoreMenuListener() {
    const moreMenu = document.getElementById('public-profile-more-menu');
    if (moreMenu) {
        moreMenu.addEventListener('click', (e) => {
            const button = e.target.closest('button');
            if (!button) return;

            const action = button.dataset.action;
            const modal = document.getElementById('modal-profile-public');
            const userId = modal.dataset.userId;
            const userName = document.getElementById('public-profile-name').textContent;

            if (!action || !userId) return;

            moreMenu.classList.add('hidden');

            if (action === 'report') {
                openReportModal(userId, userName);
            } else {
                handleConnectionAction(userId, action, null); 
            }
        });
    }
}

function setupBlockedUsersListener() {
    const list = document.getElementById('blocked-users-list');
    if (!list) return;

    list.addEventListener('click', async (e) => {
        const unblockBtn = e.target.closest('.unblock-btn');
        if (unblockBtn && !unblockBtn.disabled) {
            const userIdToUnblock = unblockBtn.dataset.userId;

            unblockBtn.disabled = true;
            unblockBtn.textContent = '...';

            await handleConnectionAction(userIdToUnblock, 'unblock', null);
            openBlockedUsersModal(); 
        }
    });
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

    targetContainer.innerHTML = ''; 

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
    
    // Header
    document.getElementById('my-profile-header-id').textContent = profile.student_id;
    
    // Stats Row
    document.getElementById('my-profile-avatar').src = profile.profile_img_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.full_name)}&background=e1e3e4`;
    document.getElementById('my-profile-connection-count').textContent = profile.connection_count || 0;
    
    // Bio Section
    document.getElementById('my-profile-name').textContent = profile.full_name;
    document.getElementById('my-profile-course').textContent = profile.course || 'Student';
    document.getElementById('my-profile-bio').textContent = profile.bio || 'No bio yet. Click "Edit Profile" to add one!';
    
    // Feed avatar & Top Navigation avatar updates
    const feedInputAvatar = document.getElementById('feed-input-avatar');
    if (feedInputAvatar) feedInputAvatar.src = profile.profile_img_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.full_name)}&background=e1e3e4`;
    
    // Load Socials & Privacy setting
    renderSocialLinks(profile.social_links, document.getElementById('my-profile-social-links'));
    const privacyToggle = document.getElementById('privacy-toggle-switch');
    if (privacyToggle) privacyToggle.checked = profile.is_private || false;

    // Fetch this user's personal feed
    fetchMyProfileFeed(profile.id);
}

// --- 2. Add these NEW functions anywhere in main.js ---

async function fetchMyProfileFeed(userId) {
    const feedContainer = document.getElementById('my-profile-feed');
    if(!feedContainer) return;

    feedContainer.innerHTML = `<p class="text-xs italic text-center py-6 text-on-surface-variant dark:text-gray-400">Loading posts...</p>`;
    
    try {
        const { data: posts, error } = await supabase
            .from('posts')
            .select('*')
            .eq('user_id', userId)
            .eq('is_deleted', false)
            .order('created_at', { ascending: false });
        
        if (error) throw error;

        // Update post count stat dynamically
        document.getElementById('my-profile-posts-count').textContent = posts.length;

        if (posts.length === 0) {
            feedContainer.innerHTML = `
                <div class="py-12 flex flex-col items-center justify-center opacity-40">
                    <span class="material-symbols-outlined text-[42px] mb-2">photo_camera</span>
                    <p class="text-sm font-medium">No posts yet</p>
                </div>`;
            return;
        }

        // Native Instagram style grid
        const gridHtml = posts.map(post => {
            if (post.post_type === 'image' && post.media_url) {
                return `<div class="aspect-square bg-surface-variant dark:bg-neutral-800 overflow-hidden relative border-[0.5px] border-surface dark:border-[#121212]">
                            <img src="${post.media_url}" class="w-full h-full object-cover">
                        </div>`;
            } else if (post.post_type === 'text') {
                return `<div class="aspect-square bg-surface-variant/40 dark:bg-neutral-800/60 overflow-hidden relative p-3 flex items-center justify-center text-center border-[0.5px] border-surface dark:border-[#121212]">
                            <p class="text-[10px] sm:text-xs text-on-surface dark:text-gray-200 line-clamp-4 leading-tight">${post.content}</p>
                        </div>`;
            } else if (post.post_type === 'event') {
                return `<div class="aspect-square bg-secondary/10 text-secondary overflow-hidden relative flex flex-col items-center justify-center border-[0.5px] border-surface dark:border-[#121212]">
                            <span class="material-symbols-outlined mb-1 text-[24px]">event</span>
                            <span class="text-[9px] font-bold uppercase tracking-widest">Event</span>
                        </div>`;
            } else {
                return `<div class="aspect-square bg-primary/10 text-primary overflow-hidden relative flex flex-col items-center justify-center border-[0.5px] border-surface dark:border-[#121212]">
                            <span class="material-symbols-outlined mb-1 text-[24px]">poll</span>
                            <span class="text-[9px] font-bold uppercase tracking-widest">Poll</span>
                        </div>`;
            }
        }).join('');
        
        feedContainer.innerHTML = `<div class="grid grid-cols-3">${gridHtml}</div>`;

    } catch (err) {
        console.error("Error fetching my feed:", err);
        feedContainer.innerHTML = `<p class="text-xs text-center py-4 text-error">Failed to load posts.</p>`;
    }
}

function openSettingsSidebar() {
    const sidebar = document.getElementById('settings-sidebar');
    const content = document.getElementById('settings-sidebar-content');
    sidebar.classList.remove('hidden');
    sidebar.classList.add('flex');
    
    // Force DOM reflow to allow transition animation
    void sidebar.offsetWidth;
    
    sidebar.classList.remove('opacity-0');
    content.classList.remove('translate-x-full');
}

function closeSettingsSidebar() {
    const sidebar = document.getElementById('settings-sidebar');
    const content = document.getElementById('settings-sidebar-content');
    
    sidebar.classList.add('opacity-0');
    content.classList.add('translate-x-full');
    
    setTimeout(() => {
        sidebar.classList.remove('flex');
        sidebar.classList.add('hidden');
    }, 300);
}

async function togglePrivacy(isPrivate) {
    try {
        const { error } = await supabase
            .from('users')
            .update({ is_private: isPrivate })
            .eq('id', currentUserProfile.id);
        
        if (error) throw error;
        currentUserProfile.is_private = isPrivate;
        showToast(isPrivate ? 'Account is now Private' : 'Account is now Public', 'success');
    } catch (err) {
        console.error("Privacy toggle error:", err);
        showToast('Failed to update privacy settings', 'error');
        // Revert toggle switch UI on failure
        document.getElementById('privacy-toggle-switch').checked = !isPrivate;
    }
}

function shareMyProfile() {
    if (navigator.share) {
        navigator.share({
            title: `${currentUserProfile.full_name}'s Profile`,
            text: `Check out my ECampus profile!`,
            url: window.location.href
        }).catch(console.error);
    } else {
        showToast('Profile link copied to clipboard!', 'success');
    }
}

// Bind new functions to the global window object so HTML onClick attributes can call them
window.openSettingsSidebar = openSettingsSidebar;
window.closeSettingsSidebar = closeSettingsSidebar;
window.togglePrivacy = togglePrivacy;
window.shareMyProfile = shareMyProfile;

function updateHeaderAvatar(avatarUrl, fullName) {
    const avatarImg = document.getElementById('header-avatar');
    if (avatarImg) {
        avatarImg.src = avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=e1e3e4`;
    }
}

function setupThemeToggle() {
    const themeToggle = document.getElementById('theme-toggle-switch');
    if (!themeToggle) return;

    const isDarkMode = localStorage.getItem('theme') === 'dark';
    document.documentElement.classList.toggle('dark', isDarkMode);
    themeToggle.checked = isDarkMode;

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
        preview.src = URL.createObjectURL(file); 

        showToast('Uploading new avatar...', 'info');

        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('upload_preset', CLOUDINARY_AVATARS_PRESET);

            const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, { method: 'POST', body: formData });
            const data = await res.json();
            if (data.error) throw new Error(data.error.message);
            const imageUrl = data.secure_url;

            await saveUserProfile({ profile_img_url: imageUrl }, false); 
            preview.src = imageUrl; 

        } catch (error) {
            console.error('Error updating avatar from edit modal:', error);
            showToast('Failed to update avatar.', 'error');
            preview.src = originalSrc; 
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

            const { error } = await supabase
                .from('users')
                .update({ profile_img_url: imageUrl })
                .eq('auth_user_id', currentUserProfile.auth_user_id);

            if (error) throw error;

            currentUserProfile.profile_img_url = imageUrl;
            document.getElementById('profile-avatar-large').src = imageUrl;
            updateHeaderAvatar(imageUrl, currentUserProfile.full_name);
            showToast('Avatar updated successfully!', 'success');

        } catch (error) {
            console.error('Error updating avatar:', error);
            showToast('Failed to update avatar. Please try again.', 'error');
        } finally {
            avatarContainer.style.opacity = '1';
            avatarInput.value = ''; 
        }
    });
}

async function handleSignOut() {
    await supabase.auth.signOut();
    window.location.replace('auth/login.html');
}

window.switchTab = switchTab;
window.openProfileModal = openProfileModal;
window.closeProfileModals = closeProfileModals;

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
    if (closeModal) { 
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

        currentUserProfile = data; 
        populateProfileUI(currentUserProfile); 
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
    });
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
    const moreMenu = document.getElementById('public-profile-more-menu');
    if (moreMenu) {
        moreMenu.classList.add('hidden');
    }

    if (userId === currentUserProfile.id) {
        switchTab('profile');
        return;
    }

    const { data: user, error } = await supabase.from('users').select('*').eq('id', userId).single();
    if (error || !user) {
        showToast('Could not load profile.', 'error');
        console.error('Error fetching user profile:', error);
        return;
    }

    document.getElementById('modal-profile-public').dataset.userId = userId;
    document.getElementById('modal-profile-private').dataset.userId = userId;

    const { data: connection, error: connError } = await supabase
        .from('connections')
        .select('status, action_user_id')
        .or(`and(user_one_id.eq.${currentUserProfile.id},user_two_id.eq.${user.id}),and(user_one_id.eq.${user.id},user_two_id.eq.${currentUserProfile.id})`)
        .single();

    if (connError && connError.code !== 'PGRST116') { 
        showToast('Could not check connection status.', 'error');
        console.error('Error fetching connection:', connError);
    }

    const isConnected = connection?.status === 'accepted';

    // Core validation routing logic testing database privacy tags explicitly
    if (user.is_private && !isConnected) {
        document.getElementById('private-profile-header-name').textContent = user.full_name;
        document.getElementById('private-profile-avatar').src = user.profile_img_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.full_name)}&background=e1e3e4`;
        document.getElementById('private-profile-name').textContent = user.full_name;
        document.getElementById('private-profile-course').textContent = user.course || 'Student';

        const actionsContainer = document.getElementById('private-profile-actions');
        if (connection?.status === 'pending' && connection.action_user_id === currentUserProfile.id) {
            actionsContainer.innerHTML = `<button class="btn-secondary w-full">Cancel Request</button>`;
            actionsContainer.firstElementChild.onclick = () => handleConnectionAction(user.id, 'cancel', actionsContainer.firstElementChild);
        } else {
            actionsContainer.innerHTML = `<button class="btn-primary w-full">Request to Connect</button>`;
            actionsContainer.firstElementChild.onclick = () => handleConnectionAction(user.id, 'request', actionsContainer.firstElementChild);
        }

        openProfileModal('private');
    } else {
        document.getElementById('public-profile-header-name').textContent = user.full_name;
        document.getElementById('public-profile-avatar').src = user.profile_img_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.full_name)}&background=e1e3e4`;
        document.getElementById('public-profile-name').textContent = user.full_name;
        document.getElementById('public-profile-course').textContent = user.course || 'Student';
        document.getElementById('public-profile-bio').textContent = user.bio || 'No bio available.';
        document.getElementById('public-profile-connection-count').textContent = user.connection_count || 0;
        renderSocialLinks(user.social_links, document.getElementById('public-profile-social-links'));

        renderProfileActions(user, connection);
        openProfileModal('public');

        // Dynamic feed rendering mirroring style, interactive buttons, context from feed.js engine
        const profileFeedContainer = document.getElementById('public-profile-feed');
        profileFeedContainer.innerHTML = `<p class="text-sm italic text-center py-6 text-on-surface-variant dark:text-gray-400">Loading live posts...</p>`;

        try {
            const { data: posts, error: postsError } = await supabase
                .from('posts')
                .select(`
                    *,
                    users ( id, full_name, profile_img_url, role, tick_type ),
                    post_likes ( user_id ),
                    post_comments ( count ),
                    post_poll_votes ( user_id, option_index )
                `)
                .eq('user_id', userId)
                .eq('is_deleted', false)
                .order('created_at', { ascending: false })
                .limit(20);

            if (postsError) throw postsError;

            if (posts.length === 0) {
                profileFeedContainer.innerHTML = `
                    <div class="py-12 flex flex-col items-center justify-center opacity-40 text-on-surface-variant">
                        <span class="material-symbols-outlined text-[42px] mb-2">photo_camera</span>
                        <p class="text-sm font-semibold">No posts yet</p>
                    </div>`;
                return;
            }

            // Map and build feed block leveraging verified components mapping to your specific design guidelines
            profileFeedContainer.innerHTML = posts.map(post => {
                const postUser = post.users;
                if (!postUser) return '';

                const likes = post.post_likes || [];
                const likeCount = likes.length;
                const userHasLiked = likes.some(like => like.user_id === currentUserProfile.id);
                const commentCount = post.post_comments[0]?.count || 0;

                let contentHtml = '';
                
                const getTickHtmlLocal = (tickType) => {
                    if (!tickType || tickType === 'none') return '';
                    const colors = { blue: 'text-[#1d9bf0]', gold: 'text-[#e8b339]', green: 'text-primary', gray: 'text-surface-variant' };
                    return `<span class="material-symbols-outlined text-[14px] ${colors[tickType.toLowerCase()] || colors.blue} ml-1" style="font-variation-settings: 'FILL' 1;">verified</span>`;
                };

                const verifiedBadge = getTickHtmlLocal(postUser.tick_type);
                const headerIcon = `<img src="${postUser.profile_img_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(postUser.full_name)}&background=e1e3e4`}" class="w-10 h-10 rounded-full border border-surface-variant shadow-sm object-cover shrink-0">`;

                if (post.post_type === 'text') {
                    contentHtml = `<p class="text-[14px] text-on-surface dark:text-gray-100 leading-relaxed mb-4 px-1 whitespace-pre-wrap">${post.content}</p>`;
                } else if (post.post_type === 'image') {
                    contentHtml = `
                        <p class="text-[14px] text-on-surface dark:text-gray-100 leading-relaxed mb-3 px-1 whitespace-pre-wrap">${post.content}</p>
                        <div class="w-full mb-4 rounded-2xl overflow-hidden border border-surface-variant/50 dark:border-neutral-800 shadow-inner bg-surface-variant/20 dark:bg-neutral-900 flex items-center justify-center">
                            <img src="${post.media_url}" class="w-full h-auto max-h-[80vh] object-contain">
                        </div>
                    `;
                } else if (post.post_type === 'event') {
                    const eventImgHtml = post.event_image_url ? `<img src="${post.event_image_url}" class="w-full h-auto max-h-[60vh] object-contain bg-black/5 dark:bg-white/5 border-b border-secondary/20">` : '';
                    const btnText = post.event_button_text || 'View Link';
                    const registerHtml = post.event_register_url ? `<a href="${post.event_register_url}" target="_blank" class="block w-full mt-4 bg-secondary text-white text-center py-2.5 rounded-xl text-[13px] font-bold shadow-md shadow-secondary/20">${btnText}</a>` : '';
                    const dateStr = post.event_date ? new Date(post.event_date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'TBA';

                    contentHtml = `
                        <div class="bg-secondary/5 border border-secondary/20 rounded-2xl mb-4 flex flex-col overflow-hidden">
                            ${eventImgHtml}
                            <div class="p-5">
                                <div class="bg-secondary/10 text-secondary w-max px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest mb-3">Upcoming Event</div>
                                <p class="text-[15px] font-semibold text-on-surface dark:text-gray-100 leading-relaxed mb-4 whitespace-pre-wrap">${post.content}</p>
                                <div class="space-y-2">
                                    <p class="text-[13px] text-on-surface-variant dark:text-gray-300 flex items-center gap-2 font-medium">
                                        <span class="material-symbols-outlined text-[18px]">calendar_today</span> ${dateStr}
                                    </p>
                                    ${post.event_location ? `<p class="text-[13px] text-on-surface-variant dark:text-gray-300 flex items-center gap-2 font-medium"><span class="material-symbols-outlined text-[18px]">location_on</span> ${post.event_location}</p>` : ''}
                                </div>
                                ${registerHtml}
                            </div>
                        </div>
                    `;
                } else if (post.post_type === 'poll') {
                    const votes = post.post_poll_votes || [];
                    const totalVotes = votes.length;
                    const myVotes = votes.filter(v => v.user_id === currentUserProfile.id).map(v => v.option_index);
                    const userHasVoted = myVotes.length > 0;
                    const isExpired = post.poll_expires_at && new Date(post.poll_expires_at) < new Date();
                    const showResults = userHasVoted || isExpired || post.poll_is_anon;

                    const optionsHtml = (post.poll_options || []).map((opt, index) => {
                        const optVotes = votes.filter(v => v.option_index === index).length;
                        const percentage = totalVotes === 0 ? 0 : Math.round((optVotes / totalVotes) * 100);
                        const iVotedForThis = myVotes.includes(index);
                        return `
                        <div data-post-id="${post.id}" data-option-index="${index}" data-is-multiple="${post.poll_is_multiple_choice}" class="poll-option-btn ${!isExpired ? 'cursor-pointer active:scale-[0.98]' : 'cursor-default'} relative w-full bg-surface-variant/30 dark:bg-surface-variant/10 border border-surface-variant/50 dark:border-neutral-700 rounded-2xl p-3.5 overflow-hidden mb-2">
                            <div class="poll-progress-bar absolute left-0 top-0 bottom-0 bg-primary/20 rounded-r-xl transition-all duration-700 ease-out" style="width: ${showResults ? percentage : 0}%"></div>
                            <div class="relative flex justify-between items-center text-[13px] font-bold text-on-surface dark:text-gray-100 z-10">
                                <span class="flex items-center gap-2">
                                    <span class="poll-check-circle w-4 h-4 rounded-full border-2 ${iVotedForThis ? 'border-primary flex items-center justify-center' : 'border-surface-variant/80 dark:border-gray-500'}">
                                        ${iVotedForThis ? '<span class="w-2 h-2 rounded-full bg-primary"></span>' : ''}
                                    </span>
                                    ${opt}
                                </span>
                                <span class="poll-percentage ${showResults ? 'opacity-100' : 'opacity-0'} transition-opacity">${percentage}%</span>
                            </div>
                        </div>`;
                    }).join('');

                    const expiryText = isExpired ? 'Poll ended' : (post.poll_expires_at ? `Ends ${timeAgo(post.poll_expires_at)}` : 'Ongoing');
                    contentHtml = `
                        <p class="text-[15px] font-semibold text-on-surface dark:text-gray-100 mb-4 px-1 whitespace-pre-wrap">${post.content}</p>
                        <div class="poll-options-wrapper space-y-2.5 mb-3 px-1">${optionsHtml}</div>
                        <div class="flex justify-between px-2 text-[11px] font-medium text-on-surface-variant dark:text-gray-400 mb-2">
                            <span>${totalVotes} votes • ${post.poll_is_multiple_choice ? 'Multiple' : 'Single'} choice</span>
                            <span>${expiryText}</span>
                        </div>
                    `;
                }

                return `
                <div data-post-id="${post.id}" class="bg-surface-container-lowest dark:bg-[#1e1e1e] rounded-[32px] p-5 border border-surface-variant/60 dark:border-neutral-800 shadow-sm text-left relative">
                    ${post.is_verified ? '<div class="absolute -top-3 -right-3 bg-[#e8b339] text-white px-3 py-1 rounded-full text-[10px] font-extrabold uppercase shadow-md flex items-center gap-1 z-10"><span class="material-symbols-outlined text-[14px]">stars</span> Verified Post</div>' : ''}
                    <div class="flex items-center gap-3 mb-3">
                        ${headerIcon}
                        <div class="flex-1">
                            <h4 class="font-bold text-[14px] text-on-surface dark:text-gray-100 flex items-center gap-1">${postUser.full_name} ${verifiedBadge}</h4>
                            <p class="text-[11px] text-on-surface-variant dark:text-gray-400 mt-0.5">${timeAgo(post.created_at)}</p>
                        </div>
                    </div>
                    ${contentHtml}
                </div>`;
            }).join('');

        } catch (postsErr) {
            console.error('Error fetching profile feed layout:', postsErr);
            profileFeedContainer.innerHTML = `<p class="text-sm text-center py-4 text-error">Failed to load posts feed.</p>`;
        }
    }
}

function renderProfileActions(user, connection) {
    const actionsContainer = document.getElementById('public-profile-actions');
    const moreMenuBtn = document.getElementById('public-profile-more-btn');
    const moreMenu = document.getElementById('public-profile-more-menu');

    actionsContainer.innerHTML = '';
    moreMenu.innerHTML = '';
    moreMenuBtn.classList.remove('hidden'); // Structured safely right next to the connect button inside the flex wrapper
    moreMenu.classList.add('hidden');

    const userId = user.id;
    let mainButtonHtml = '';
    let moreMenuItems = [];

    if (!connection) { 
        mainButtonHtml = `<button class="btn-primary flex-1 !py-2.5 rounded-xl">Connect</button>`;
        actionsContainer.innerHTML = mainButtonHtml;
        actionsContainer.firstElementChild.onclick = () => handleConnectionAction(userId, 'request', actionsContainer.firstElementChild);
        moreMenuItems.push({ label: 'Block User', action: 'block', class: 'text-error' });

    } else if (connection.status === 'pending') {
        if (connection.action_user_id === currentUserProfile.id) { 
            mainButtonHtml = `<button class="btn-secondary flex-1 !py-2.5 rounded-xl">Cancel Request</button>`;
            actionsContainer.innerHTML = mainButtonHtml;
            actionsContainer.firstElementChild.onclick = () => handleConnectionAction(userId, 'cancel', actionsContainer.firstElementChild);
        } else { 
            mainButtonHtml = `
                <button class="btn-primary flex-1 !py-2.5 rounded-xl">Accept</button>
                <button class="btn-secondary flex-1 !py-2.5 rounded-xl">Decline</button>
            `;
            actionsContainer.innerHTML = mainButtonHtml;
            actionsContainer.children[0].onclick = () => handleConnectionAction(userId, 'accept', actionsContainer.children[0]);
            actionsContainer.children[1].onclick = () => handleConnectionAction(userId, 'decline', actionsContainer.children[1]);
        }
        moreMenuItems.push({ label: 'Block User', action: 'block', class: 'text-error' });

    } else if (connection.status === 'accepted') {
        mainButtonHtml = `<button class="btn-secondary flex-1 !py-2.5 rounded-xl" disabled>✓ Connected</button>`;
        actionsContainer.innerHTML = mainButtonHtml;
        moreMenuItems.push({ label: 'Remove connection', action: 'unfriend', class: 'text-error' });
        moreMenuItems.push({ label: 'Block User', action: 'block', class: 'text-error' });

    } else if (connection.status === 'blocked') {
        if (connection.action_user_id === currentUserProfile.id) { 
            mainButtonHtml = `<button class="btn-error flex-1 !py-2.5 rounded-xl">Unblock</button>`;
            actionsContainer.innerHTML = mainButtonHtml;
            actionsContainer.firstElementChild.onclick = () => handleConnectionAction(userId, 'unblock', actionsContainer.firstElementChild);
        } else { 
            mainButtonHtml = `<button class="btn-secondary flex-1 !py-2.5 rounded-xl" disabled>Blocked</button>`;
            actionsContainer.innerHTML = mainButtonHtml;
        }
    }

    if (!(connection?.status === 'blocked' && connection.action_user_id !== currentUserProfile.id)) {
        moreMenuItems.push({ label: 'Report User', action: 'report', class: 'text-warning' });
    }

    if (moreMenuItems.length > 0) {
        moreMenu.innerHTML = moreMenuItems.map(item =>
            `<button data-action="${item.action}" class="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-lg ${item.class}">${item.label}</button>`
        ).join('');
    }
}

export async function handleConnectionAction(targetUserId, action, btn) {
    const originalText = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<span class="material-symbols-outlined text-xl animate-spin">progress_activity</span>`;
    }

    try {
        const { data, error } = await supabase.rpc('manage_connection', {
            p_target_user_id: targetUserId,
            p_action: action
        });

        if (error) throw error;

        showToast(getSuccessMessage(data), 'success');

        if (btn && action === 'request' && data === 'request_sent') {
            btn.textContent = 'Request Sent';
        }

        const modal = document.getElementById('modal-profile-public');
        if (modal && !modal.classList.contains('hidden') && modal.dataset.userId === targetUserId) {
            viewUserProfile(targetUserId);
        }

    } catch (error) {
        console.error(`Error performing action '${action}':`, error);
        showToast(error.message || 'An error occurred.', 'error');
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    }
}

function getSuccessMessage(result) {
    const messages = {
        request_sent: 'Connection request sent!',
        accepted: 'Connection accepted!',
        cancelled: 'Request cancelled.',
        declined: 'Request declined.',
        unfriended: 'Connection removed.',
        blocked: 'User blocked.',
        unblocked: 'User unblocked.'
    };
    return messages[result] || 'Action successful!';
}

function openReportModal(userId, userName) {
    const modal = document.getElementById('modal-report-user');
    modal.classList.replace('hidden', 'flex');
    document.getElementById('report-user-name').textContent = userName;
    document.getElementById('submit-report-btn').dataset.userId = userId;
}

function closeReportModal() {
    const modal = document.getElementById('modal-report-user');
    modal.classList.replace('flex', 'hidden');
    document.getElementById('report-reason').value = '';
    document.getElementById('report-description').value = '';
}

async function submitReport() {
    const btn = document.getElementById('submit-report-btn');
    const userId = btn.dataset.userId;
    const reason = document.getElementById('report-reason').value;
    const description = document.getElementById('report-description').value.trim();

    if (!reason) {
        showToast('Please select a reason for the report.', 'warning');
        return;
    }

    btn.disabled = true;
    btn.textContent = 'Submitting...';

    try {
        const { error } = await supabase.rpc('create_report', {
            p_reported_user_id: userId,
            p_reason: reason,
            p_description: description || null
        });
        if (error) throw error;
        showToast('Report submitted successfully. Our team will review it.', 'success');
        closeReportModal();
        closeProfileModals();
    } catch (error) {
        showToast('Failed to submit report.', 'error');
        console.error('Error submitting report:', error);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Submit Report';
    }
}

window.viewUserProfile = viewUserProfile;

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.add('hidden'));

    const target = document.getElementById(`view-${tabId}`);
    if (target) {
        target.classList.remove('hidden');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // Show header only on Feed (Dashboard)
    const header = document.querySelector('header');
    if (header) {
        header.classList.toggle('hidden', tabId !== 'dashboard');
    }

    const activeClasses = ['bg-primary', 'dark:bg-primary', 'text-white'];
    const inactiveClasses = [
        'text-on-surface-variant',
        'dark:text-gray-400',
        'hover:bg-surface-variant/40',
        'dark:hover:bg-neutral-800'
    ];

    document.querySelectorAll('.nav-item').forEach(nav => {
        nav.classList.remove(...activeClasses);
        nav.classList.add(...inactiveClasses);
        nav.querySelector('span.material-symbols-outlined').style.fontVariationSettings = "'FILL' 0";
    });

    const activeNav = document.getElementById(`nav-${tabId}`);
    if (activeNav) {
        activeNav.classList.remove(...inactiveClasses);
        activeNav.classList.add(...activeClasses);
        activeNav.querySelector('span.material-symbols-outlined').style.fontVariationSettings = "'FILL' 1";
    }
}

function openProfileModal(type) {
    const modal = document.getElementById(`modal-profile-${type}`);
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        setTimeout(() => {
            modal.classList.remove('translate-y-full');
        }, 10);
    }
}

function closeProfileModals() {
    document.querySelectorAll('[id^="modal-profile-"]').forEach(modal => {
        if (!modal.classList.contains('translate-y-full')) {
            modal.classList.add('translate-y-full');
            setTimeout(() => {
                modal.classList.add('hidden');
                modal.classList.remove('flex');
            }, 300);
        }
    });
}

window.openReportModal = openReportModal;
window.closeReportModal = closeReportModal;
window.submitReport = submitReport;
window.toggleMoreMenu = () => {
    document.getElementById('public-profile-more-menu').classList.toggle('hidden');
};

async function openConnectionsModal() {
    const modal = document.getElementById('modal-connections');
    const list = document.getElementById('connections-list');
    if (!modal || !list) return;

    modal.classList.replace('hidden', 'flex');
    list.innerHTML = `<p class="text-sm italic text-center py-8 text-gray-500 dark:text-gray-400">Loading connections...</p>`;

    try {
        const { data, error } = await supabase
            .from('connections')
            .select('status, user_one:user_one_id(id, full_name, profile_img_url, course), user_two:user_two_id(id, full_name, profile_img_url, course)')
            .or(`user_one_id.eq.${currentUserProfile.id},user_two_id.eq.${currentUserProfile.id}`)
            .eq('status', 'accepted');

        if (error) throw error;

        const connections = data.map(conn => {
            return conn.user_one.id === currentUserProfile.id ? conn.user_two : conn.user_one;
        }).filter(Boolean); 

        if (connections.length === 0) {
            list.innerHTML = `<p class="text-sm italic text-center py-8 text-gray-500 dark:text-gray-400">You have no connections yet.</p>`;
            return;
        }

        list.innerHTML = connections.map(user => `
            <div onclick="viewUserProfile('${user.id}'); closeConnectionsModal();" class="flex items-center gap-4 p-3 bg-white dark:bg-neutral-900 rounded-2xl border border-gray-200 dark:border-neutral-800 shadow-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-neutral-800/50 transition-colors">
                <img src="${user.profile_img_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.full_name)}&background=e1e3e4`}" class="w-12 h-12 rounded-full object-cover">
                <div class="flex-1">
                    <p class="font-bold text-sm text-gray-900 dark:text-gray-100">${user.full_name}</p>
                    <p class="text-xs text-gray-500 dark:text-gray-400">${user.course || 'Student'}</p>
                </div>
            </div>
        `).join('');

    } catch (error) {
        console.error('Error fetching connections:', error);
        list.innerHTML = `<p class="text-sm italic text-center py-8 text-red-500">Failed to load connections.</p>`;
    }
}

function closeConnectionsModal() {
    const modal = document.getElementById('modal-connections');
    if (modal) {
        modal.classList.replace('flex', 'hidden');
    }
}

window.openConnectionsModal = openConnectionsModal;
window.closeConnectionsModal = closeConnectionsModal;

async function openBlockedUsersModal() {
    const modal = document.getElementById('modal-blocked-users');
    const list = document.getElementById('blocked-users-list');
    if (!modal || !list) return;

    modal.classList.replace('hidden', 'flex');
    list.innerHTML = `<p class="text-sm italic text-center py-8 text-gray-500 dark:text-gray-400">Loading blocked users...</p>`;

    try {
        const { data, error } = await supabase
            .from('connections')
            .select('user_one:user_one_id(id, full_name, profile_img_url, course), user_two:user_two_id(id, full_name, profile_img_url, course)')
            .eq('status', 'blocked')
            .eq('action_user_id', currentUserProfile.id);

        if (error) throw error;

        const blockedUsers = data.map(conn => {
            return conn.user_one.id === currentUserProfile.id ? conn.user_two : conn.user_one;
        }).filter(Boolean);

        if (blockedUsers.length === 0) {
            list.innerHTML = `<p class="text-sm italic text-center py-8 text-gray-500 dark:text-gray-400">You haven't blocked anyone.</p>`;
            return;
        }

        list.innerHTML = blockedUsers.map(user => `
            <div class="blocked-user-item flex items-center gap-4 p-3 bg-white dark:bg-neutral-900 rounded-2xl border border-gray-200 dark:border-neutral-800 shadow-sm">
                <img src="${user.profile_img_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.full_name)}&background=e1e3e4`}" class="w-12 h-12 rounded-full object-cover">
                <div class="flex-1">
                    <p class="font-bold text-sm text-gray-900 dark:text-gray-100">${user.full_name}</p>
                    <p class="text-xs text-gray-500 dark:text-gray-400">${user.course || 'Student'}</p>
                </div>
                <button data-user-id="${user.id}" class="unblock-btn btn-error !px-4 !py-2 !text-xs">
                    Unblock
                </button>
            </div>
        `).join('');

    } catch (error) {
        console.error('Error fetching blocked users:', error);
        list.innerHTML = `<p class="text-sm italic text-center py-8 text-red-500">Failed to load blocked users.</p>`;
    }
}

function closeBlockedUsersModal() {
    const modal = document.getElementById('modal-blocked-users');
    if (modal) modal.classList.replace('flex', 'hidden');
}

window.openBlockedUsersModal = openBlockedUsersModal;
window.closeBlockedUsersModal = closeBlockedUsersModal;
