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
window.addEventListener('load', () => {
    // 1. Initialize the Pull-to-Refresh Engine
    // This allows the user to drag down to refresh the feed
    if (typeof initPullToRefresh === 'function') {
        initPullToRefresh();
    }

    // 2. Splash Screen Logic
    // This removes the loading screen after the app is ready
    setTimeout(() => {
        const splash = document.getElementById('app-splash-screen');
        if (splash) {
            // Fade it out
            splash.style.opacity = '0';
            
            // Re-enable scrolling on the main body
            document.body.classList.remove('overflow-hidden');
            
            // Remove it completely from the DOM after the fade animation finishes
            setTimeout(() => {
                splash.remove();
            }, 500); 
        }
    }, 600); 
});

// ========================================================
// BULLETPROOF PULL-TO-REFRESH ENGINE
// ========================================================
function initPullToRefresh() {
    if (window._ptrActive) return;
    window._ptrActive = true;

    // 1. DYNAMICALLY INJECT CSS & UI BUBBLE
    const style = document.createElement('style');
    style.innerHTML = `
        /* Force kill native browser overscroll completely */
        html, body { overscroll-behavior: none !important; }
        
        #smart-ptr {
            position: fixed; top: 0; left: 50%; z-index: 2147483647; /* Maximum z-index */
            transform: translate(-50%, -150px);
            display: flex; align-items: center; gap: 8px;
            background: #ffffff; padding: 10px 20px;
            border-radius: 50px; box-shadow: 0 4px 15px rgba(0,0,0,0.2);
            transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.3s ease;
            opacity: 0; pointer-events: none;
        }
        html.dark #smart-ptr { background: #1e1e1e; border: 1px solid rgba(255,255,255,0.1); }
        #smart-ptr-icon { color: #10B981; font-size: 24px; transition: transform 0.1s; }
        #smart-ptr-text { font-size: 14px; font-weight: 700; color: #000; }
        html.dark #smart-ptr-text { color: #fff; }
        .ptr-spin { animation: ptrSpin 1s linear infinite; }
        @keyframes ptrSpin { 100% { transform: rotate(360deg); } }
    `;
    document.head.appendChild(style);

    const ptrContainer = document.createElement('div');
    ptrContainer.id = 'smart-ptr';
    ptrContainer.innerHTML = `
        <span id="smart-ptr-icon" class="material-symbols-outlined">refresh</span>
        <span id="smart-ptr-text">Pull to refresh</span>
    `;
    document.body.appendChild(ptrContainer);

    const icon = document.getElementById('smart-ptr-icon');
    const text = document.getElementById('smart-ptr-text');

    let startY = 0;
    let isDragging = false;
    let isRefreshing = false;
    let lastVisualDist = 0;
    const triggerPoint = 80;

    // 2. ULTRA-SAFE TOP DETECTOR
    // This accurately climbs the DOM to ensure you are at the absolute top of the feed!
    function isAtAbsoluteTop(node) {
        let current = node;
        while (current && current !== document.body && current !== document.documentElement) {
            if (current.scrollTop > 2) return false; 
            current = current.parentNode;
        }
        if ((window.scrollY || document.documentElement.scrollTop) > 2) return false;
        return true;
    }

    document.addEventListener('touchstart', (e) => {
        if (isRefreshing) return;
        
        // Block if swiping on a modal or camera
        if (e.target.closest('[id^="modal-"]:not(.hidden), [id^="view-create-post"]:not(.hidden)')) return;

        if (isAtAbsoluteTop(e.target)) {
            startY = e.touches[0].clientY;
            isDragging = true;
            lastVisualDist = 0;
            ptrContainer.style.transition = 'none'; 
            icon.classList.remove('ptr-spin');
        }
    }, { passive: true });

    document.addEventListener('touchmove', (e) => {
        if (!isDragging || isRefreshing) return;

        const distance = e.touches[0].clientY - startY;

        if (distance < 0) {
            isDragging = false; // Cancel drag if they scroll upwards
            return;
        }

        if (distance > 0 && isAtAbsoluteTop(e.target)) {
            if (e.cancelable) e.preventDefault(); // 🛑 KILLS NATIVE BROWSER SCROLL

            lastVisualDist = distance * 0.45;
            
            ptrContainer.style.opacity = '1';
            ptrContainer.style.transform = `translate(-50%, ${Math.min(lastVisualDist, triggerPoint + 20)}px)`;
            icon.style.transform = `rotate(${lastVisualDist * 3}deg)`;

            if (lastVisualDist >= triggerPoint) {
                text.innerText = "Release to refresh";
                if (navigator.vibrate && text.dataset.vibrated !== 'true') {
                    navigator.vibrate(10);
                    text.dataset.vibrated = 'true';
                }
            } else {
                text.innerText = "Pull to refresh";
                text.dataset.vibrated = 'false';
            }
        }
    }, { passive: false }); // 🛑 MUST BE FALSE FOR PREVENT DEFAULT TO WORK

    const handleTouchEnd = async () => {
        if (!isDragging) return;
        isDragging = false;

        ptrContainer.style.transition = 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.3s ease';
        
        if (lastVisualDist >= triggerPoint && !isRefreshing) {
            isRefreshing = true;
            
            // Snap to loading position
            ptrContainer.style.transform = `translate(-50%, 60px)`;
            text.innerText = "Refreshing...";
            icon.style.transform = '';
            icon.classList.add('ptr-spin');

            try {
                if (window.executeContextualRefresh) await window.executeContextualRefresh();
            } catch(e) { console.error(e); }

            // Hide bubble after loading completes
            isRefreshing = false;
            ptrContainer.style.transform = `translate(-50%, -150px)`;
            ptrContainer.style.opacity = '0';
            setTimeout(() => icon.classList.remove('ptr-spin'), 300);

        } else {
            // Did not pull far enough, cancel
            ptrContainer.style.transform = `translate(-50%, -150px)`;
            ptrContainer.style.opacity = '0';
        }
        lastVisualDist = 0;
    };

    document.addEventListener('touchend', handleTouchEnd, { passive: true });
    document.addEventListener('touchcancel', handleTouchEnd, { passive: true });
}

window.executeContextualRefresh = async function() {
    const activeTab = document.querySelector('.tab-content:not(.hidden)');
    if (!activeTab) return;

    try {
        if (activeTab.id === 'view-dashboard') {
            if (typeof window.refreshMainFeed === 'function') await window.refreshMainFeed();
            if (typeof window.refreshHotposts === 'function') await window.refreshHotposts();
        } 
        else if (activeTab.id === 'view-search') {
            if (typeof window.refreshDiscover === 'function') await window.refreshDiscover();
        }
        else if (activeTab.id === 'view-updates') {
            if (typeof window.refreshUpdates === 'function') await window.refreshUpdates();
        }
        else if (activeTab.id === 'view-profile') {
            if (typeof window.fetchMyProfileFeed === 'function' && typeof currentUserProfile !== 'undefined') {
                await window.fetchMyProfileFeed(currentUserProfile.id);
            }
        }
        await new Promise(res => setTimeout(res, 800)); // Minimum time for visual effect
    } catch (e) {
        console.error("Contextual Refresh Error:", e);
    }
};

// ========================================================
// IMAGE OPTIMIZATION ENGINE
// ========================================================
window.optimizeImageUrl = function(url, type = 'feed') {
    if (!url || !url.includes('cloudinary.com')) return url;
    if (url.includes('/upload/q_auto')) return url; 
    
    let params = 'q_auto,f_auto,w_800'; 
    if (type === 'avatar') params = 'q_auto:eco,f_auto,w_150,h_150,c_fill'; 
    else if (type === 'hotpost') params = 'q_auto:eco,f_auto,w_600'; 

    return url.replace('/upload/', `/upload/${params}/`);
};

// ========================================================
// CLIENT-SIDE IMAGE COMPRESSOR
// ========================================================
window.compressImage = function(file, maxSize = 800, quality = 0.8) {
    return new Promise((resolve, reject) => {
        if (!file.type.match(/image.*/)) {
            resolve(file);
            return;
        }

        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = event => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > maxSize) {
                        height = Math.round((height *= maxSize / width));
                        width = maxSize;
                    }
                } else {
                    if (height > maxSize) {
                        width = Math.round((width *= maxSize / height));
                        height = maxSize;
                    }
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                canvas.toBlob(blob => {
                    if (!blob) {
                        reject(new Error('Canvas compression failed'));
                        return;
                    }
                    const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".webp", {
                        type: 'image/webp',
                        lastModified: Date.now()
                    });
                    resolve(compressedFile);
                }, 'image/webp', quality);
            };
            img.onerror = error => reject(error);
        };
        reader.onerror = error => reject(error);
    });
};

// ========================================================
// PROFESSIONAL SKELETON LOADERS
// ========================================================
const FEED_SKELETON = `
    <div class="bg-surface-container-lowest dark:bg-[#1e1e1e] rounded-[32px] p-5 border border-surface-variant/60 dark:border-neutral-800 shadow-sm mb-5">
        <div class="flex items-center gap-3 mb-4">
            <div class="w-10 h-10 rounded-full shimmer-bg shrink-0"></div>
            <div class="flex-1">
                <div class="h-3.5 shimmer-bg rounded-md w-1/3 mb-2.5"></div>
                <div class="h-2.5 shimmer-bg rounded-md w-1/4"></div>
            </div>
        </div>
        <div class="h-3 shimmer-bg rounded-md w-3/4 mb-2.5"></div>
        <div class="h-3 shimmer-bg rounded-md w-full mb-2.5"></div>
        <div class="h-3 shimmer-bg rounded-md w-5/6 mb-4"></div>
        <div class="w-full h-48 shimmer-bg rounded-2xl mb-4"></div>
        <div class="flex items-center gap-6 border-t border-surface-variant/40 dark:border-neutral-800 pt-4 mt-2">
            <div class="h-5 w-12 shimmer-bg rounded-md"></div>
            <div class="h-5 w-12 shimmer-bg rounded-md"></div>
        </div>
    </div>
`.repeat(3);

const LIST_SKELETON = `
    <div class="flex items-center gap-4 p-3 mb-3 bg-white dark:bg-neutral-900 rounded-2xl border border-gray-200 dark:border-neutral-800">
        <div class="w-12 h-12 rounded-full shimmer-bg shrink-0"></div>
        <div class="flex-1">
            <div class="h-3.5 shimmer-bg rounded-md w-1/2 mb-2.5"></div>
            <div class="h-2.5 shimmer-bg rounded-md w-1/3"></div>
        </div>
    </div>
`.repeat(5);

// ========================================================
// APP INITIALIZATION & LAYOUT
// ========================================================
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Check user sessions
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
        window.location.href = "./auth/login.html";
        return;
    }

    // 2. Fetch user profile
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

    setupAppBackButton();
    initPullToRefresh(); 

    // ------------------------------------------------------------------
    // COLD START PENDING ROUTE SYSTEM (Push Notification Deep-Linking)
    // ------------------------------------------------------------------
    const pendingRoute = localStorage.getItem('pending_notification_route');
    if (pendingRoute) {
        localStorage.removeItem('pending_notification_route');
        try {
            const routeData = JSON.parse(pendingRoute);
            
            if (routeData.type.startsWith('post_')) {
                // Keep Dashboard running in background, but slide Post View over it
                switchTab('dashboard'); 
                setTimeout(() => window.openSinglePostView(routeData.target_id), 300);
            } 
            else if (routeData.type === 'connection_accepted' || routeData.type === 'connection_request') {
                switchTab('dashboard');
                setTimeout(() => window.viewUserProfile(routeData.sender_id), 300);
            } 
            else if (routeData.type.startsWith('hotpost_')) {
                switchTab('dashboard');
                setTimeout(() => {
                    if (typeof window.showMyHotposts === 'function') window.showMyHotposts();
                    else if (typeof window.openHotpostViewer === 'function') window.openHotpostViewer(profile.id);
                }, 300);
            } else {
                switchTab('dashboard');
            }
        } catch(e) {
            console.error("Route parsing error", e);
            switchTab('dashboard');
        }
    } else {
        switchTab('dashboard'); // Normal App Boot
    }
}

async function updateNativeStatusBar(isDark) {
    try {
        if (window.Capacitor && window.Capacitor.isNativePlatform()) {
            const { StatusBar, Style } = await import('@capacitor/status-bar');
            const bgColor = isDark ? '#121212' : '#f8f9fa';
            const textStyle = isDark ? Style.Dark : Style.Light; 
            
            await StatusBar.setOverlaysWebView({ overlay: false });
            await StatusBar.setBackgroundColor({ color: bgColor });
            await StatusBar.setStyle({ style: textStyle });
        }
    } catch (error) {
        console.warn('Status bar configuration bypassed.');
    }
}

function setupThemeToggle() {
    const themeToggle = document.getElementById('theme-toggle-switch');
    if (!themeToggle) return;

    const isDarkMode = localStorage.getItem('theme') === 'dark';
    document.documentElement.classList.toggle('dark', isDarkMode);
    themeToggle.checked = isDarkMode;
    updateNativeStatusBar(isDarkMode); 

    themeToggle.addEventListener('change', () => {
        if (themeToggle.checked) {
            document.documentElement.classList.add('dark');
            localStorage.setItem('theme', 'dark');
            updateNativeStatusBar(true);
        } else {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('theme', 'light');
            updateNativeStatusBar(false);
        }
    });
}

function getTickHtmlLocal(tickType) {
    if (!tickType || tickType === 'none') return '';
    const colors = { blue: 'text-[#1d9bf0]', gold: 'text-[#e8b339]', green: 'text-primary', gray: 'text-surface-variant' };
    return `<span class="material-symbols-outlined text-[16px] shrink-0 relative -top-[1px] ${colors[tickType.toLowerCase()] || colors.blue}" style="font-variation-settings: 'FILL' 1;">verified</span>`;
}

// ========================================================
// CORE PROFILE UI & SOCIALS
// ========================================================
function setupMoreMenuListener() {
    const moreMenu = document.getElementById('public-profile-more-menu');
    const moreBtn = document.getElementById('public-profile-more-btn');

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

    document.addEventListener('click', (e) => {
        if (moreMenu && !moreMenu.classList.contains('hidden')) {
            if (moreBtn && !moreBtn.contains(e.target) && !moreMenu.contains(e.target)) {
                moreMenu.classList.add('hidden');
            }
        }
    });
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
    linkedin: { icon: 'fa-brands fa-linkedin-in', color: 'bg-[#0A66C2]' },
    instagram: { icon: 'fa-brands fa-instagram', color: 'bg-gradient-to-br from-purple-400 via-pink-500 to-red-500' },
    github: { icon: 'fa-brands fa-github', color: 'bg-[#181717] dark:bg-white dark:!text-black' },
    twitter: { icon: 'fa-brands fa-x-twitter', color: 'bg-[#000000] dark:bg-white dark:!text-black' },
    youtube: { icon: 'fa-brands fa-youtube', color: 'bg-[#FF0000]' },
    discord: { icon: 'fa-brands fa-discord', color: 'bg-[#5865F2]' },
    facebook: { icon: 'fa-brands fa-facebook-f', color: 'bg-[#1877F2]' },
    whatsapp: { icon: 'fa-brands fa-whatsapp', color: 'bg-[#25D366]' },
    snapchat: { icon: 'fa-brands fa-snapchat', color: 'bg-[#FFFC00] !text-black' }, 
    telegram: { icon: 'fa-brands fa-telegram', color: 'bg-[#229ED9]' },
    spotify: { icon: 'fa-brands fa-spotify', color: 'bg-[#1DB954]' },
    reddit: { icon: 'fa-brands fa-reddit-alien', color: 'bg-[#FF4500]' },
    website: { icon: 'fa-solid fa-globe', color: 'bg-primary' }, 
    other: { icon: 'fa-solid fa-link', color: 'bg-gray-500' }
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
            linkEl.className = `w-[52px] h-[52px] rounded-2xl flex items-center justify-center text-white text-2xl ${platformInfo.color} transition-transform hover:scale-110 shrink-0 shadow-sm`;
            linkEl.innerHTML = `<i class="${platformInfo.icon}"></i>`;
            targetContainer.appendChild(linkEl);
        });
    }

    if (!container) {
        const addButton = document.createElement('button');
        addButton.onclick = () => openEditSocialsModal();
        addButton.className = 'w-[52px] h-[52px] rounded-2xl flex items-center justify-center bg-gray-100 dark:bg-neutral-800 border-2 border-dashed border-gray-300 dark:border-neutral-700 text-gray-400 dark:text-gray-500 hover:border-primary hover:text-primary transition-colors shrink-0';
        addButton.innerHTML = `<span class="material-symbols-outlined">add</span>`;
        targetContainer.appendChild(addButton);
    }
}

function populateProfileUI(profile) {
    if (!profile) return;
    
    const headerNameEl = document.getElementById('my-profile-header-name');
    if (headerNameEl) headerNameEl.textContent = profile.full_name;
    
    const tickEl = document.getElementById('my-profile-header-tick');
    if (tickEl) {
        if (profile.tick_type && profile.tick_type !== 'none') {
            const colors = { blue: 'text-[#1d9bf0]', gold: 'text-[#e8b339]', green: 'text-primary', gray: 'text-surface-variant' };
            tickEl.className = `material-symbols-outlined text-[18px] ${colors[profile.tick_type.toLowerCase()] || colors.blue}`;
            tickEl.style.fontVariationSettings = "'FILL' 1";
            tickEl.classList.remove('hidden');
        } else {
            tickEl.classList.add('hidden');
        }
    }
    
    const avatarEl = document.getElementById('my-profile-avatar');
    if (avatarEl) avatarEl.src = profile.profile_img_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.full_name)}&background=e1e3e4`;
    
    const connCountEl = document.getElementById('my-profile-connection-count');
    if (connCountEl) connCountEl.textContent = profile.connection_count || 0;
    
    const courseEl = document.getElementById('my-profile-course');
    if (courseEl) courseEl.textContent = profile.course || 'Student';
    
    const bioEl = document.getElementById('my-profile-bio');
    if (bioEl) bioEl.textContent = profile.bio || 'No bio yet. Click "Edit Profile" to add one!';
    
    const feedInputAvatar = document.getElementById('feed-input-avatar');
    if (feedInputAvatar) feedInputAvatar.src = profile.profile_img_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.full_name)}&background=e1e3e4`;
    
    renderSocialLinks(profile.social_links, document.getElementById('my-profile-social-links'));
    const privacyToggle = document.getElementById('privacy-toggle-switch');
    if (privacyToggle) privacyToggle.checked = profile.is_private || false;

    if (typeof fetchMyProfileFeed === 'function') {
        fetchMyProfileFeed(profile.id);
    }
}

// ========================================================
// PROFILE FEED RENDER ENGINE
// ========================================================
window.fetchMyProfileFeed = async function(userId) {
    const feedContainer = document.getElementById('my-profile-feed');
    if(!feedContainer) return;

    feedContainer.innerHTML = FEED_SKELETON; 
    
    try {
        const { data: posts, error } = await supabase
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
            .order('created_at', { ascending: false });
        
        if (error) throw error;

        const countEl = document.getElementById('my-profile-posts-count');
        if (countEl) countEl.textContent = posts.length;

        if (posts.length === 0) {
            feedContainer.innerHTML = `
                <div class="py-12 flex flex-col items-center justify-center opacity-40 text-on-surface-variant">
                    <span class="material-symbols-outlined text-[42px] mb-2">menu_book</span>
                    <p class="text-sm font-medium">No posts yet</p>
                </div>`;
            return;
        }

        feedContainer.innerHTML = generatePostHTML(posts, currentUserProfile.id);

    } catch (err) {
        console.error("Error fetching my feed:", err);
        feedContainer.innerHTML = `<p class="text-xs text-center py-4 text-error">Failed to load posts.</p>`;
    }
}

function generatePostHTML(posts, currentUserId) {
    return posts.map(post => {
        const user = post.users;
        if (!user) return '';

        const likes = post.post_likes || [];
        const likeCount = likes.length;
        const userHasLiked = likes.some(like => like.user_id === currentUserId);
        const commentCount = post.post_comments[0]?.count || 0;

        let contentHtml = '';
        const verifiedBadge = getTickHtmlLocal(user.tick_type);
        
        const rawAvatarUrl = user.profile_img_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.full_name)}&background=e1e3e4`;
        const optimizedAvatar = typeof optimizeImageUrl === 'function' ? optimizeImageUrl(rawAvatarUrl, 'avatar') : rawAvatarUrl;
        
        const headerIcon = `<img loading="lazy" onclick="openPublicProfile('${user.id}')" src="${optimizedAvatar}" data-user-id="${user.id}" class="profile-link w-10 h-10 rounded-full border border-surface-variant shadow-sm object-cover cursor-pointer hover:opacity-80 transition-opacity shrink-0">`;

        if (post.post_type === 'text') {
            contentHtml = `<p class="text-[14px] text-on-surface dark:text-gray-100 leading-relaxed mb-4 px-1 whitespace-pre-wrap">${post.content}</p>`;
        } 
        else if (post.post_type === 'image') {
            const optimizedMedia = typeof optimizeImageUrl === 'function' ? optimizeImageUrl(post.media_url, 'feed') : post.media_url;
            contentHtml = `
                <p class="text-[14px] text-on-surface dark:text-gray-100 leading-relaxed mb-3 px-1 whitespace-pre-wrap">${post.content}</p>
                <div class="w-full mb-4 rounded-2xl overflow-hidden border border-surface-variant/50 dark:border-neutral-800 shadow-inner bg-surface-variant/20 dark:bg-neutral-900 flex items-center justify-center">
                    <img loading="lazy" src="${optimizedMedia}" class="w-full h-auto max-h-[80vh] object-contain">
                </div>
            `;
        }
        else if (post.post_type === 'event') {
            const optimizedEventMedia = typeof optimizeImageUrl === 'function' ? optimizeImageUrl(post.event_image_url, 'feed') : post.event_image_url;
            const eventImgHtml = post.event_image_url ? `<img loading="lazy" src="${optimizedEventMedia}" class="w-full h-auto max-h-[60vh] object-contain bg-black/5 dark:bg-white/5 border-b border-secondary/20">` : '';
            const btnText = post.event_button_text || 'View Link';
            const registerHtml = post.event_register_url ? `<a href="${post.event_register_url}" target="_blank" class="block w-full mt-4 bg-secondary text-white text-center py-2.5 rounded-xl text-[13px] font-bold active:scale-95 transition-transform shadow-md shadow-secondary/20">${btnText}</a>` : '';
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
        }
        else if (post.post_type === 'poll') {
            const votes = post.post_poll_votes || [];
            const totalVotes = votes.length;
            const myVotes = votes.filter(v => v.user_id === currentUserId).map(v => v.option_index);
            const userHasVoted = myVotes.length > 0;
            
            const isExpired = post.poll_expires_at && new Date(post.poll_expires_at) < new Date();
            const showResults = userHasVoted || isExpired || post.poll_is_anon;

            const optionsHtml = (post.poll_options || []).map((opt, index) => {
                const optVotes = votes.filter(v => v.option_index === index).length;
                const percentage = totalVotes === 0 ? 0 : Math.round((optVotes / totalVotes) * 100);
                const iVotedForThis = myVotes.includes(index);
                const viewVotersBtn = (!post.poll_is_anon && optVotes > 0) ? `<span onclick="event.stopPropagation(); window.openPollVoters('${post.id}', ${index})" class="material-symbols-outlined text-[16px] ml-1.5 text-on-surface-variant hover:text-primary transition-colors cursor-pointer" title="View Voters">visibility</span>` : '';

                return `
                <div data-post-id="${post.id}" data-option-index="${index}" data-is-multiple="${post.poll_is_multiple_choice}" class="poll-option-btn ${!isExpired ? 'cursor-pointer active:scale-[0.98]' : 'cursor-default'} relative w-full bg-surface-variant/30 dark:bg-surface-variant/10 border border-surface-variant/50 dark:border-neutral-700 rounded-2xl p-3.5 overflow-hidden group hover:border-primary/50 transition-all mb-2">
                    <div class="poll-progress-bar absolute left-0 top-0 bottom-0 bg-primary/20 rounded-r-xl transition-all duration-700 ease-out" style="width: ${showResults ? percentage : 0}%"></div>
                    <div class="relative flex justify-between items-center text-[13px] font-bold text-on-surface dark:text-gray-100 z-10">
                        <span class="flex items-center gap-2">
                            <span class="poll-check-circle w-4 h-4 rounded-full border-2 ${iVotedForThis ? 'border-primary flex items-center justify-center' : 'border-surface-variant/80 dark:border-gray-500'}">
                                ${iVotedForThis ? '<span class="w-2 h-2 rounded-full bg-primary"></span>' : ''}
                            </span>
                            ${opt}
                        </span>
                        <span class="flex items-center">
                            <span class="poll-percentage ${showResults ? 'opacity-100' : 'opacity-0'} transition-opacity">${percentage}%</span>
                            ${viewVotersBtn}
                        </span>
                    </div>
                </div>`;
            }).join('');

            const expiryText = isExpired ? 'Poll ended' : (post.poll_expires_at ? `Ends ${timeAgo(post.poll_expires_at)}` : 'Ongoing');
            const typeText = post.poll_is_multiple_choice ? 'Multiple choice' : 'Single choice';

            contentHtml = `
                <p class="text-[15px] font-semibold text-on-surface dark:text-gray-100 mb-4 px-1 whitespace-pre-wrap">${post.content}</p>
                <div class="poll-options-wrapper space-y-2.5 mb-3 px-1">${optionsHtml}</div>
                <div class="flex justify-between px-2 text-[11px] font-medium text-on-surface-variant dark:text-gray-400 mb-2">
                    <span class="poll-footer-text"><span class="poll-total-votes">${totalVotes}</span> votes • ${typeText} ${post.poll_is_anon ? 'Anonymous' : 'Public'}</span>
                    <span>${expiryText}</span>
                </div>
            `;
        }

        return `
        <div data-post-id="${post.id}" class="bg-surface-container-lowest dark:bg-[#1e1e1e] rounded-[32px] p-5 border border-surface-variant/60 dark:border-neutral-800 shadow-sm mb-5 animate-fadeIn relative">
            
            ${post.is_verified ? '<div class="absolute -top-3 -right-3 bg-[#e8b339] text-white px-3 py-1 rounded-full text-[10px] font-extrabold uppercase shadow-lg shadow-[#e8b339]/30 flex items-center gap-1 z-10"><span class="material-symbols-outlined text-[14px]">stars</span> Verified Post</div>' : ''}

            <div class="flex items-center gap-3 mb-3">
                ${headerIcon}
                <div class="flex-1">
                    <h4 onclick="openPublicProfile('${user.id}')" class="font-bold text-[14.5px] cursor-pointer hover:text-primary transition-colors flex items-center gap-1">
                        ${user.full_name} ${verifiedBadge}
                    </h4>
                    <p class="text-[11px] text-on-surface-variant dark:text-gray-400 mt-0.5">${timeAgo(post.created_at)}</p>
                </div>
                <button data-post-id="${post.id}" data-user-id="${user.id}" data-is-verified="${post.is_verified}" class="post-options-btn text-on-surface-variant hover:text-on-surface dark:text-gray-400 dark:hover:text-gray-100 p-1 rounded-full hover:bg-surface-variant/50 transition-colors">
                    <span class="material-symbols-outlined text-[20px]">more_vert</span>
                </button>
            </div>
            
            ${contentHtml}
            
            <div class="flex items-center gap-6 border-t border-surface-variant/40 dark:border-neutral-800 pt-3 px-1 mt-2">
                
                <div class="flex items-center gap-1.5">
                    <!-- Cleaned classes! -->
                    <button data-post-id="${post.id}" data-liked="${userHasLiked}" class="like-btn flex items-center justify-center transition-colors active:scale-95 ${userHasLiked ? 'text-red-500' : 'text-on-surface-variant dark:text-gray-400 hover:text-red-500'}">
                        <span class="material-symbols-outlined text-[22px]" style="font-variation-settings: 'FILL' ${userHasLiked ? 1 : 0};">favorite</span> 
                    </button>
                    <span onclick="event.stopPropagation(); window.openLikesModal('${post.id}')" class="like-count-text text-[13px] font-bold cursor-pointer hover:underline text-on-surface-variant dark:text-gray-400 active:opacity-70 px-1 py-0.5">
                        ${likeCount}
                    </span>
                </div>

                <div class="flex items-center gap-1.5">
                    <button data-post-id="${post.id}" class="comment-btn flex items-center gap-1.5 text-on-surface-variant dark:text-gray-400 hover:text-secondary transition-colors text-[13px] font-medium active:scale-95">
                        <span class="material-symbols-outlined text-[20px]">chat_bubble</span> 
                    </button>
                    <span class="text-[13px] font-bold text-on-surface-variant dark:text-gray-400">
                        ${commentCount}
                    </span>
                </div>

            </div>
        </div>
        `;
    }).join('');
}

// ========================================================
// SIDEBAR & SETTINGS
// ========================================================
function openSettingsSidebar() {
    const sidebar = document.getElementById('settings-sidebar');
    const content = document.getElementById('settings-sidebar-content');
    const bottomNav = document.querySelector('nav'); 
    
    sidebar.classList.remove('hidden');
    sidebar.classList.add('flex');
    if (bottomNav) bottomNav.classList.add('hidden');
    
    void sidebar.offsetWidth;
    sidebar.classList.remove('opacity-0');
    content.classList.remove('translate-x-full');
}

function closeSettingsSidebar() {
    const sidebar = document.getElementById('settings-sidebar');
    const content = document.getElementById('settings-sidebar-content');
    const bottomNav = document.querySelector('nav');
    
    sidebar.classList.add('opacity-0');
    content.classList.add('translate-x-full');
    
    setTimeout(() => {
        sidebar.classList.remove('flex');
        sidebar.classList.add('hidden');
        if (bottomNav) bottomNav.classList.remove('hidden');
    }, 300);
}

async function togglePrivacy(isPrivate) {
    try {
        const { error } = await supabase.from('users').update({ is_private: isPrivate }).eq('id', currentUserProfile.id);
        if (error) throw error;
        currentUserProfile.is_private = isPrivate;
        showToast(isPrivate ? 'Account is now Private' : 'Account is now Public', 'success');
    } catch (err) {
        console.error("Privacy toggle error:", err);
        showToast('Failed to update privacy settings', 'error');
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

window.openSettingsSidebar = openSettingsSidebar;
window.closeSettingsSidebar = closeSettingsSidebar;
window.togglePrivacy = togglePrivacy;
window.shareMyProfile = shareMyProfile;

function updateHeaderAvatar(avatarUrl, fullName) {
    const avatarImg = document.getElementById('header-avatar');
    if (avatarImg) avatarImg.src = avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=e1e3e4`;
}

// ========================================================
// UPLOADS & USER ACTIONS 
// ========================================================

function setupEditProfileAvatarUpload() {
    const avatarInput = document.getElementById('edit-avatar-upload-input');
    if (!avatarInput) return;

    avatarInput.addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const preview = document.getElementById('edit-profile-avatar-preview');
        const mainProfileAvatar = document.getElementById('my-profile-avatar');
        const originalSrc = preview.src;

        const tempUrl = URL.createObjectURL(file);
        preview.src = tempUrl;
        preview.style.opacity = '0.5';
        preview.style.filter = 'blur(3px)';
        preview.style.transition = 'all 0.3s ease';
        if (mainProfileAvatar) mainProfileAvatar.src = tempUrl;

        try {
            const formData = new FormData();
            const fileToUpload = typeof compressImage === 'function' ? await compressImage(file, 500, 0.8) : file;
            formData.append('file', fileToUpload);
            formData.append('upload_preset', CLOUDINARY_AVATARS_PRESET);

            const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, { method: 'POST', body: formData });
            const data = await res.json();
            if (data.error) throw new Error(data.error.message);

            await saveUserProfile({ profile_img_url: data.secure_url }, false);

            preview.src = data.secure_url;
            preview.style.opacity = '1';
            preview.style.filter = 'blur(0px)';
            if (mainProfileAvatar) mainProfileAvatar.src = data.secure_url;
            updateHeaderAvatar(data.secure_url, currentUserProfile.full_name);

            showToast('Profile picture updated!', 'success');

        } catch (error) {
            console.error('Error updating avatar:', error);
            showToast('Failed to update avatar.', 'error');
            preview.src = originalSrc; 
            preview.style.opacity = '1';
            preview.style.filter = 'blur(0px)';
            if (mainProfileAvatar) mainProfileAvatar.src = originalSrc;
        } finally {
            avatarInput.value = '';
        }
    });
}

function setupProfileAvatarUpload() {
    const avatarInput = document.getElementById('avatar-upload-input');
    if (!avatarInput) return;

    avatarInput.addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const preview = document.getElementById('my-profile-avatar');
        const editPreview = document.getElementById('edit-profile-avatar-preview');
        const originalSrc = preview.src;

        const tempUrl = URL.createObjectURL(file);
        preview.src = tempUrl;
        preview.style.opacity = '0.5';
        preview.style.filter = 'blur(3px)';
        preview.style.transition = 'all 0.3s ease';
        if (editPreview) editPreview.src = tempUrl;

        try {
            const formData = new FormData();
           const fileToUpload = typeof compressImage === 'function' ? await compressImage(file, 500, 0.8) : file;
            formData.append('file', fileToUpload);
            formData.append('upload_preset', CLOUDINARY_AVATARS_PRESET);

            const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, { method: 'POST', body: formData });
            const data = await res.json();
            if (data.error) throw new Error(data.error.message);

            const { error } = await supabase.from('users').update({ profile_img_url: data.secure_url }).eq('id', currentUserProfile.id);
            if (error) throw error;

            currentUserProfile.profile_img_url = data.secure_url;

            preview.src = data.secure_url;
            preview.style.opacity = '1';
            preview.style.filter = 'blur(0px)';
            if (editPreview) editPreview.src = data.secure_url;
            updateHeaderAvatar(data.secure_url, currentUserProfile.full_name);

            showToast('Avatar updated successfully!', 'success');
        } catch (error) {
            console.error('Error updating avatar:', error);
            showToast('Failed to update avatar. Please try again.', 'error');
            preview.src = originalSrc;
            preview.style.opacity = '1';
            preview.style.filter = 'blur(0px)';
            if (editPreview) editPreview.src = originalSrc;
        } finally {
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

window.openEditProfileModal = function() {
    if (!currentUserProfile) return;

    document.getElementById('edit-profile-name').value = currentUserProfile.full_name || '';
    document.getElementById('edit-profile-id').value = currentUserProfile.student_id || '';
    document.getElementById('edit-profile-course').value = currentUserProfile.course || '';
    document.getElementById('edit-profile-bio').value = currentUserProfile.bio || '';
    document.getElementById('edit-profile-avatar-preview').src = currentUserProfile.profile_img_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUserProfile.full_name)}&background=e1e3e4`;

    const modal = document.getElementById('modal-edit-profile');
    const bottomNav = document.querySelector('nav');

    modal.classList.remove('hidden');
    modal.classList.add('flex');
    if (bottomNav) bottomNav.classList.add('hidden'); 

    setTimeout(() => {
        modal.classList.remove('translate-x-full');
    }, 10);
};

window.closeEditProfileModal = function() {
    const modal = document.getElementById('modal-edit-profile');
    const bottomNav = document.querySelector('nav');

    modal.classList.add('translate-x-full');

    setTimeout(() => {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        if (bottomNav) bottomNav.classList.remove('hidden'); 
    }, 300);
};

window.triggerEditAvatarUpload = function() {
    document.getElementById('edit-avatar-upload-input').click();
};

window.saveUserProfile = async function(extraUpdates = {}, closeModal = true) {
    const btn = document.getElementById('save-profile-btn');
    if (closeModal && btn) {
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
        const { data, error } = await supabase.from('users').update(updates).eq('id', currentUserProfile.id).select().single();
        if (error) throw error;

        currentUserProfile = data;
        populateProfileUI(currentUserProfile);
        updateHeaderAvatar(currentUserProfile.profile_img_url, currentUserProfile.full_name);

        if (closeModal) {
            showToast('Profile updated!', 'success');
            closeEditProfileModal();
        }

    } catch (error) {
        console.error('Error saving profile:', error);
        showToast('Failed to save profile.', 'error');
    } finally {
        if (closeModal && btn) {
            btn.disabled = false;
            btn.innerHTML = 'Save';
        }
    }
};
// ========================================================
// SOCIAL LINKS EDITOR (Native Full-Screen Engine)
// ========================================================
function openEditSocialsModal() {
    if (!currentUserProfile) return;
    
    let links = currentUserProfile.social_links;
    if (typeof links === 'string') {
        try { links = JSON.parse(links); } catch(e) { links = []; }
    }
    tempSocialLinks = Array.isArray(links) ? JSON.parse(JSON.stringify(links)) : [];
    
    renderTempSocialsList();
    
    const modal = document.getElementById('modal-edit-socials');
    const bottomNav = document.querySelector('nav');
    
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    if (bottomNav) bottomNav.classList.add('hidden');
    
    setTimeout(() => {
        modal.classList.remove('translate-x-full');
    }, 10);
}

function closeSocialsModal() {
    const modal = document.getElementById('modal-edit-socials');
    const bottomNav = document.querySelector('nav');
    
    modal.classList.add('translate-x-full');
    
    setTimeout(() => {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        if (bottomNav) bottomNav.classList.remove('hidden');
    }, 300);
}

function renderTempSocialsList() {
    const list = document.getElementById('modal-socials-list');
    list.innerHTML = '';
    
    if (!Array.isArray(tempSocialLinks) || tempSocialLinks.length === 0) {
        list.innerHTML = `
            <div class="py-10 flex flex-col items-center justify-center opacity-40 text-on-surface-variant">
                <span class="material-symbols-outlined text-[42px] mb-2">link_off</span>
                <p class="text-sm font-medium">No links added yet.</p>
            </div>`;
        return;
    }

    const platformStyles = {
        linkedin: { icon: 'fa-brands fa-linkedin-in', color: 'text-[#0A66C2]' },
        instagram: { icon: 'fa-brands fa-instagram', color: 'text-pink-500' },
        github: { icon: 'fa-brands fa-github', color: 'text-on-surface dark:text-white' },
        twitter: { icon: 'fa-brands fa-x-twitter', color: 'text-on-surface dark:text-white' },
        youtube: { icon: 'fa-brands fa-youtube', color: 'text-[#FF0000]' },
        discord: { icon: 'fa-brands fa-discord', color: 'text-[#5865F2]' },
        whatsapp: { icon: 'fa-brands fa-whatsapp', color: 'text-[#25D366]' },
        snapchat: { icon: 'fa-brands fa-snapchat', color: 'text-[#FFFC00] drop-shadow-sm' },
        telegram: { icon: 'fa-brands fa-telegram', color: 'text-[#229ED9]' },
        spotify: { icon: 'fa-brands fa-spotify', color: 'text-[#1DB954]' },
        reddit: { icon: 'fa-brands fa-reddit-alien', color: 'text-[#FF4500]' },
        website: { icon: 'fa-solid fa-globe', color: 'text-primary' }
    };

    tempSocialLinks.forEach((link, index) => {
        const style = platformStyles[link.platform] || { icon: 'fa-solid fa-link', color: 'text-gray-500' };
        
        list.innerHTML += `
            <div class="flex items-center gap-3 bg-surface-container-lowest dark:bg-[#1e1e1e] p-3.5 rounded-2xl border border-surface-variant/50 dark:border-neutral-800 shadow-sm animate-fadeIn">
                <div class="w-10 h-10 rounded-full bg-surface-variant/30 dark:bg-neutral-800 flex items-center justify-center ${style.color} shrink-0">
                    <i class="${style.icon} text-[18px]"></i>
                </div>
                <div class="flex-1 min-w-0">
                    <p class="font-extrabold text-[13px] text-on-surface dark:text-gray-100 uppercase tracking-wide">${link.platform}</p>
                    <p class="text-[12px] text-on-surface-variant dark:text-gray-400 truncate mt-0.5">${link.url}</p>
                </div>
                <button onclick="removeSocialLinkTemp(${index})" class="w-8 h-8 rounded-full bg-error/10 text-error flex items-center justify-center active:scale-95 transition-transform shrink-0">
                    <span class="material-symbols-outlined text-[18px]">delete</span>
                </button>
            </div>
        `;
    });
}

function addSocialLinkTemp() {
    const platformId = document.getElementById('add-social-platform').value;
    let val = document.getElementById('add-social-url').value.trim();
    
    if (!val) {
        showToast('Please enter your username, number, or link.', 'warning');
        return;
    }

    const config = socialPlatformsConfig[platformId];
    let finalUrl = val;

    if (!val.startsWith('http://') && !val.startsWith('https://')) {
        if (val.startsWith('@') && platformId !== 'youtube') {
            val = val.substring(1);
        }
        if (platformId === 'youtube' && !val.startsWith('@') && !val.includes('/')) {
            val = '@' + val;
        }
        finalUrl = config.prefix + val;
    }

    const existingLinkIndex = tempSocialLinks.findIndex(link => link.platform === platformId);
    if (existingLinkIndex > -1) {
        tempSocialLinks[existingLinkIndex].url = finalUrl;
    } else {
        tempSocialLinks.push({ platform: platformId, url: finalUrl });
    }
    
    renderTempSocialsList();
    document.getElementById('add-social-url').value = '';
}

function removeSocialLinkTemp(index) {
    tempSocialLinks.splice(index, 1);
    renderTempSocialsList();
}

async function saveSocialLinks() {
    const { error } = await supabase.from('users').update({ social_links: tempSocialLinks }).eq('id', currentUserProfile.id);

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

// ========================================================
// PUBLIC/PRIVATE PROFILE VIEWS 
// ========================================================
async function viewUserProfile(userId) {
    if (window.isLongPressing) return; 

    const moreMenu = document.getElementById('public-profile-more-menu');
    if (moreMenu) moreMenu.classList.add('hidden');

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

    const getTickHtmlLocal = (tickType) => {
        if (!tickType || tickType === 'none') return '';
        const colors = { blue: 'text-[#1d9bf0]', gold: 'text-[#e8b339]', green: 'text-primary', gray: 'text-surface-variant' };
        return `<span class="material-symbols-outlined text-[14px] ${colors[tickType.toLowerCase()] || colors.blue}" style="font-variation-settings: 'FILL' 1;">verified</span>`;
    };

    if (user.is_private && !isConnected) {
        document.getElementById('private-profile-header-name').innerHTML = `<span class="flex items-center gap-1">${user.full_name} ${getTickHtmlLocal(user.tick_type)}</span>`;
        document.getElementById('private-profile-avatar').src = user.profile_img_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.full_name)}&background=e1e3e4`;
        document.getElementById('private-profile-name').innerHTML = `<span class="flex items-center justify-center gap-1">${user.full_name} ${getTickHtmlLocal(user.tick_type)}</span>`;
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
        document.getElementById('public-profile-header-name').innerHTML = `<span class="flex items-center gap-1">${user.full_name} ${getTickHtmlLocal(user.tick_type)}</span>`;
        document.getElementById('public-profile-avatar').src = user.profile_img_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.full_name)}&background=e1e3e4`;
        document.getElementById('public-profile-name').innerHTML = `<span class="flex items-center justify-center gap-1">${user.full_name} ${getTickHtmlLocal(user.tick_type)}</span>`;
        document.getElementById('public-profile-course').textContent = user.course || 'Student';
        document.getElementById('public-profile-bio').textContent = user.bio || 'No bio available.';
        document.getElementById('public-profile-connection-count').textContent = user.connection_count || 0;
        renderSocialLinks(user.social_links, document.getElementById('public-profile-social-links'));

        renderProfileActions(user, connection);
        openProfileModal('public');

        const profileFeedContainer = document.getElementById('public-profile-feed');
        profileFeedContainer.innerHTML = FEED_SKELETON; 

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

            profileFeedContainer.innerHTML = generatePostHTML(posts, currentUserProfile.id);

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
    moreMenuBtn.classList.remove('hidden'); 
    moreMenu.classList.add('hidden');

    const userId = user.id;
    let mainButtonHtml = '';
    let moreMenuItems = [];

    if (!connection) { 
        mainButtonHtml = `<button class="btn-primary flex-1 !py-2.5 rounded-xl text-sm">Connect</button>`;
        actionsContainer.innerHTML = mainButtonHtml;
        actionsContainer.firstElementChild.onclick = () => handleConnectionAction(userId, 'request', actionsContainer.firstElementChild);
        moreMenuItems.push({ label: 'Block User', action: 'block', class: 'text-error' });

    } else if (connection.status === 'pending') {
        if (connection.action_user_id === currentUserProfile.id) { 
            mainButtonHtml = `<button class="btn-secondary flex-1 !py-2.5 rounded-xl text-sm">Cancel Request</button>`;
            actionsContainer.innerHTML = mainButtonHtml;
            actionsContainer.firstElementChild.onclick = () => handleConnectionAction(userId, 'cancel', actionsContainer.firstElementChild);
        } else { 
            mainButtonHtml = `
                <button class="btn-primary flex-1 !py-2.5 rounded-xl text-sm">Accept</button>
                <button class="btn-secondary flex-1 !py-2.5 rounded-xl text-sm">Decline</button>
            `;
            actionsContainer.innerHTML = mainButtonHtml;
            actionsContainer.children[0].onclick = () => handleConnectionAction(userId, 'accept', actionsContainer.children[0]);
            actionsContainer.children[1].onclick = () => handleConnectionAction(userId, 'decline', actionsContainer.children[1]);
        }
        moreMenuItems.push({ label: 'Block User', action: 'block', class: 'text-error' });

    } else if (connection.status === 'accepted') {
        mainButtonHtml = `<button class="btn-secondary flex-1 !py-2.5 rounded-xl text-sm" disabled>✓ Connected</button>`;
        actionsContainer.innerHTML = mainButtonHtml;
        moreMenuItems.push({ label: 'Remove connection', action: 'unfriend', class: 'text-error' });
        moreMenuItems.push({ label: 'Block User', action: 'block', class: 'text-error' });

    } else if (connection.status === 'blocked') {
        if (connection.action_user_id === currentUserProfile.id) { 
            mainButtonHtml = `<button class="btn-error flex-1 !py-2.5 rounded-xl text-sm">Unblock</button>`;
            actionsContainer.innerHTML = mainButtonHtml;
            actionsContainer.firstElementChild.onclick = () => handleConnectionAction(userId, 'unblock', actionsContainer.firstElementChild);
        } else { 
            mainButtonHtml = `<button class="btn-secondary flex-1 !py-2.5 rounded-xl text-sm" disabled>Blocked</button>`;
            actionsContainer.innerHTML = mainButtonHtml;
        }
    }

    if (!(connection?.status === 'blocked' && connection.action_user_id !== currentUserProfile.id)) {
        moreMenuItems.push({ label: 'Report User', action: 'report', class: 'text-orange-500' });
    }

    if (moreMenuItems.length > 0) {
        moreMenu.innerHTML = moreMenuItems.map(item =>
            `<button data-action="${item.action}" class="w-full text-left px-4 py-2.5 text-sm font-bold hover:bg-surface-variant/30 dark:hover:bg-neutral-800 rounded-lg ${item.class} transition-colors">${item.label}</button>`
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

        if (btn && action === 'request' && data === 'request_sent') btn.textContent = 'Request Sent';

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
    const messages = { request_sent: 'Connection request sent!', accepted: 'Connection accepted!', cancelled: 'Request cancelled.', declined: 'Request declined.', unfriended: 'Connection removed.', blocked: 'User blocked.', unblocked: 'User unblocked.' };
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
        const { error } = await supabase.rpc('create_report', { p_reported_user_id: userId, p_reason: reason, p_description: description || null });
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
    document.querySelectorAll(".tab-content").forEach(tab => tab.classList.add("hidden"));
    
    const activeView = document.getElementById(`view-${tabId}`);
    if (activeView) activeView.classList.remove("hidden");

    const header = document.querySelector("header");
    if (tabId === "dashboard") header.classList.remove("hidden");
    else header.classList.add("hidden");

    const bottomNav = document.querySelector('nav');
    if (bottomNav) bottomNav.classList.remove('hidden');

    document.querySelectorAll(".nav-item").forEach(btn => {
        btn.classList.remove("bg-primary", "text-white");
        btn.classList.add("text-on-surface-variant", "dark:text-gray-400");
        const icon = btn.querySelector(".material-symbols-outlined");
        if (icon) icon.style.fontVariationSettings = "'FILL' 0";
    });

    const activeBtn = document.getElementById(`nav-${tabId}`);
    if (activeBtn) {
        activeBtn.classList.remove("text-on-surface-variant", "dark:text-gray-400");
        activeBtn.classList.add("bg-primary", "text-white");
        const icon = activeBtn.querySelector(".material-symbols-outlined");
        if (icon) icon.style.fontVariationSettings = "'FILL' 1";
    }

    window.scrollTo({ top: 0, behavior: "instant" });
}

function openProfileModal(type) {
    const modal = document.getElementById(`modal-profile-${type}`);
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        setTimeout(() => modal.classList.remove('translate-y-full'), 10);
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
window.toggleMoreMenu = () => document.getElementById('public-profile-more-menu').classList.toggle('hidden');

// ========================================================
// LIST MODALS (CONNECTIONS / BLOCKED) WITH SKELETONS
// ========================================================
async function openConnectionsModal() {
    const modal = document.getElementById('modal-connections');
    const list = document.getElementById('connections-list');
    if (!modal || !list) return;

    modal.classList.replace('hidden', 'flex');
    list.innerHTML = LIST_SKELETON; 

    try {
        const { data, error } = await supabase
            .from('connections')
            .select('status, user_one:user_one_id(id, full_name, profile_img_url, course), user_two:user_two_id(id, full_name, profile_img_url, course)')
            .or(`user_one_id.eq.${currentUserProfile.id},user_two_id.eq.${currentUserProfile.id}`)
            .eq('status', 'accepted');

        if (error) throw error;

        const connections = data.map(conn => conn.user_one.id === currentUserProfile.id ? conn.user_two : conn.user_one).filter(Boolean); 

        if (connections.length === 0) {
            list.innerHTML = `<p class="text-sm italic text-center py-8 text-on-surface-variant dark:text-gray-400">You have no connections yet.</p>`;
            return;
        }

        list.innerHTML = connections.map(user => `
            <div onclick="viewUserProfile('${user.id}'); closeConnectionsModal();" class="flex items-center gap-4 p-3 bg-surface-container-lowest dark:bg-neutral-900/50 rounded-2xl border border-surface-variant/40 dark:border-neutral-800 shadow-sm cursor-pointer hover:bg-surface-variant/20 transition-colors">
                <img src="${user.profile_img_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.full_name)}&background=e1e3e4`}" class="w-12 h-12 rounded-full object-cover border border-surface-variant/50">
                <div class="flex-1">
                    <p class="font-bold text-sm text-on-surface dark:text-gray-100">${user.full_name}</p>
                    <p class="text-[11px] text-on-surface-variant dark:text-gray-400 mt-0.5">${user.course || 'Student'}</p>
                </div>
            </div>
        `).join('');

    } catch (error) {
        console.error('Error fetching connections:', error);
        list.innerHTML = `<p class="text-sm italic text-center py-8 text-error">Failed to load connections.</p>`;
    }
}

function closeConnectionsModal() {
    const modal = document.getElementById('modal-connections');
    if (modal) modal.classList.replace('flex', 'hidden');
}

window.openConnectionsModal = openConnectionsModal;
window.closeConnectionsModal = closeConnectionsModal;

async function openBlockedUsersModal() {
    const modal = document.getElementById('modal-blocked-users');
    const list = document.getElementById('blocked-users-list');
    if (!modal || !list) return;

    modal.classList.replace('hidden', 'flex');
    list.innerHTML = LIST_SKELETON; 

    try {
        const { data, error } = await supabase
            .from('connections')
            .select('user_one:user_one_id(id, full_name, profile_img_url, course), user_two:user_two_id(id, full_name, profile_img_url, course)')
            .eq('status', 'blocked')
            .eq('action_user_id', currentUserProfile.id);

        if (error) throw error;

        const blockedUsers = data.map(conn => conn.user_one.id === currentUserProfile.id ? conn.user_two : conn.user_one).filter(Boolean);

        if (blockedUsers.length === 0) {
            list.innerHTML = `<p class="text-sm italic text-center py-8 text-on-surface-variant dark:text-gray-400">You haven't blocked anyone.</p>`;
            return;
        }

        list.innerHTML = blockedUsers.map(user => `
            <div class="flex items-center gap-4 p-3 bg-surface-container-lowest dark:bg-neutral-900/50 rounded-2xl border border-surface-variant/40 dark:border-neutral-800 shadow-sm">
                <img src="${user.profile_img_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.full_name)}&background=e1e3e4`}" class="w-12 h-12 rounded-full object-cover border border-surface-variant/50">
                <div class="flex-1">
                    <p class="font-bold text-sm text-on-surface dark:text-gray-100">${user.full_name}</p>
                    <p class="text-[11px] text-on-surface-variant dark:text-gray-400 mt-0.5">${user.course || 'Student'}</p>
                </div>
                <button data-user-id="${user.id}" class="unblock-btn bg-error/10 text-error px-4 py-2 rounded-xl text-xs font-bold active:scale-95 transition-transform hover:bg-error/20">
                    Unblock
                </button>
            </div>
        `).join('');

    } catch (error) {
        console.error('Error fetching blocked users:', error);
        list.innerHTML = `<p class="text-sm italic text-center py-8 text-error">Failed to load blocked users.</p>`;
    }
}

function closeBlockedUsersModal() {
    const modal = document.getElementById('modal-blocked-users');
    if (modal) modal.classList.replace('flex', 'hidden');
}

window.openBlockedUsersModal = openBlockedUsersModal;
window.closeBlockedUsersModal = closeBlockedUsersModal;

// ========================================================
// SINGLE POST VIEWER ENGINE
// ========================================================
window.openSinglePostView = async function(postId) {
    const modal = document.getElementById('modal-single-post');
    const container = document.getElementById('single-post-container');
    const bottomNav = document.querySelector('nav');
    
    modal.classList.replace('hidden', 'flex');
    if (bottomNav) bottomNav.classList.add('hidden');
    setTimeout(() => modal.classList.remove('translate-x-full'), 10);
    
    container.innerHTML = FEED_SKELETON; 
    
    try {
        const { data: posts, error } = await supabase
            .from('posts')
            .select(`
                *,
                users ( id, full_name, profile_img_url, role, tick_type ),
                post_likes ( user_id ),
                post_comments ( count ),
                post_poll_votes ( user_id, option_index )
            `)
            .eq('id', postId)
            .eq('is_deleted', false);
            
        if (error) throw error;
        
        if (!posts || posts.length === 0) {
            container.innerHTML = `
                <div class="py-16 flex flex-col items-center justify-center opacity-40 text-on-surface-variant">
                    <span class="material-symbols-outlined text-[48px] mb-2">delete</span>
                    <p class="text-sm font-semibold">Post no longer available</p>
                </div>`;
            return;
        }
        
        container.innerHTML = generatePostHTML(posts, currentUserProfile.id);

    } catch (error) {
        console.error('Error fetching single post:', error);
        container.innerHTML = `<p class="text-sm text-center py-10 text-error">Failed to load post.</p>`;
    }
}

window.closeSinglePostView = function() {
    const modal = document.getElementById('modal-single-post');
    modal.classList.add('translate-x-full');
    
    const notifModal = document.getElementById('modal-notifications');
    if (notifModal && notifModal.classList.contains('hidden')) {
        const bottomNav = document.querySelector('nav');
        if (bottomNav) bottomNav.classList.remove('hidden');
    }
    
    setTimeout(() => modal.classList.replace('flex', 'hidden'), 300);

    };
// ========================================================
// NATIVE ANDROID BACK BUTTON ROUTER (The Waterfall)
// ========================================================
function setupAppBackButton() {
    
    const checkAndCloseTopLayer = () => {
        const modalHierarchy = [
            { id: 'modal-confirm-action', close: () => document.getElementById('confirm-action-no')?.click() },
            { id: 'modal-action-sheet', close: () => window.closeActionSheet() },
            { id: 'modal-story-details', close: () => document.getElementById('activity-backdrop-close')?.click() },
            { id: 'modal-post-comments', close: () => document.getElementById('close-post-comments-btn')?.click() },
            { id: 'modal-poll-voters', close: () => document.getElementById('modal-poll-voters').classList.replace('flex','hidden') },
            { id: 'modal-report-post', close: () => window.closeReportPostModal() },
            { id: 'modal-report-user', close: () => window.closeReportModal() },
            { id: 'modal-edit-socials', close: () => window.closeSocialsModal() },
            { id: 'modal-edit-profile', close: () => window.closeEditProfileModal() },
            { id: 'modal-connections', close: () => window.closeConnectionsModal() },
            { id: 'modal-blocked-users', close: () => window.closeBlockedUsersModal() },
            { id: 'modal-single-post', close: () => window.closeSinglePostView() },
            { id: 'modal-notifications', close: () => window.closeNotifications() },
            { id: 'settings-sidebar', close: () => window.closeSettingsSidebar() },
            { id: 'view-create-post', close: () => window.closeCreatePostView() },
            { id: 'modal-profile-public', close: () => window.closeProfileModals() },
            { id: 'modal-profile-private', close: () => window.closeProfileModals() },
            { id: 'modal-hotpost-camera', close: () => document.getElementById('close-hotpost-camera-btn')?.click() },
            { id: 'modal-view-hotpost', close: () => document.getElementById('close-hotpost-viewer-btn')?.click() },
            { id: 'modal-course-picker', close: () => window.closeCoursePicker() }
        ];

        for (const modal of modalHierarchy) {
            const el = document.getElementById(modal.id);
            if (el && !el.classList.contains('hidden')) {
                modal.close(); 
                return true; 
            }
        }

        const dashboardView = document.getElementById('view-dashboard');
        if (dashboardView && dashboardView.classList.contains('hidden')) {
            if (window.switchTab) window.switchTab('dashboard'); 
            return true; 
        }

        return false; 
    };

    if (window.Capacitor && window.Capacitor.isNativePlatform()) {
        try {
            const App = window.Capacitor.Plugins.App;
            if (App) {
                App.addListener('backButton', () => {
                    const handled = checkAndCloseTopLayer();
                    if (!handled) {
                        App.exitApp(); 
                    }
                });
            }
        } catch (err) {
            console.warn('Capacitor App plugin bypassed.', err);
        }
    } 
    
    window.history.pushState({ app_active: true }, "");
    
    window.addEventListener('popstate', () => {
        const handled = checkAndCloseTopLayer();
        if (handled) {
            window.history.pushState({ app_active: true }, "");
        } 
    });
}
// ========================================================
// CUSTOM COURSE PICKER ENGINE
// ========================================================
window.openCoursePicker = function() {
    const picker = document.getElementById('modal-course-picker');
    picker.classList.replace('hidden', 'flex');
};

window.closeCoursePicker = function() {
    const picker = document.getElementById('modal-course-picker');
    picker.classList.replace('flex', 'hidden');
};

window.selectCourse = function(courseName) {
    document.getElementById('edit-profile-course').value = courseName;
    closeCoursePicker();
};

// ========================================================
// SMART SOCIAL PLATFORM PICKER ENGINE
// ========================================================
const socialPlatformsConfig = {
    instagram: { name: 'Instagram', icon: 'fa-brands fa-instagram', color: 'bg-gradient-to-br from-purple-400 via-pink-500 to-red-500 text-white', placeholder: 'Username (e.g. johndoe)', type: 'text', prefix: 'https://instagram.com/' },
    snapchat: { name: 'Snapchat', icon: 'fa-brands fa-snapchat', color: 'bg-[#FFFC00] text-black', placeholder: 'Snapchat Username', type: 'text', prefix: 'https://snapchat.com/add/' },
    whatsapp: { name: 'WhatsApp', icon: 'fa-brands fa-whatsapp', color: 'bg-[#25D366] text-white', placeholder: 'Phone Number (e.g. 919876543210)', type: 'tel', prefix: 'https://wa.me/' },
    linkedin: { name: 'LinkedIn', icon: 'fa-brands fa-linkedin-in', color: 'bg-[#0A66C2] text-white', placeholder: 'LinkedIn Username', type: 'text', prefix: 'https://linkedin.com/in/' },
    twitter: { name: 'X (Twitter)', icon: 'fa-brands fa-x-twitter', color: 'bg-black dark:bg-white text-white dark:text-black', placeholder: 'X Username', type: 'text', prefix: 'https://x.com/' },
    spotify: { name: 'Spotify', icon: 'fa-brands fa-spotify', color: 'bg-[#1DB954] text-white', placeholder: 'Spotify Profile URL', type: 'url', prefix: '' },
    telegram: { name: 'Telegram', icon: 'fa-brands fa-telegram', color: 'bg-[#229ED9] text-white', placeholder: 'Telegram Username', type: 'text', prefix: 'https://t.me/' },
    discord: { name: 'Discord', icon: 'fa-brands fa-discord', color: 'bg-[#5865F2] text-white', placeholder: 'Discord Username', type: 'text', prefix: 'https://discord.com/users/' },
    reddit: { name: 'Reddit', icon: 'fa-brands fa-reddit-alien', color: 'bg-[#FF4500] text-white', placeholder: 'Reddit Username', type: 'text', prefix: 'https://reddit.com/user/' },
    github: { name: 'GitHub', icon: 'fa-brands fa-github', color: 'bg-[#181717] dark:bg-white text-white dark:text-black', placeholder: 'GitHub Username', type: 'text', prefix: 'https://github.com/' },
    youtube: { name: 'YouTube', icon: 'fa-brands fa-youtube', color: 'bg-[#FF0000] text-white', placeholder: 'Channel URL or @handle', type: 'text', prefix: 'https://youtube.com/' },
    website: { name: 'Website', icon: 'fa-solid fa-globe', color: 'bg-primary text-white', placeholder: 'example.com', type: 'url', prefix: 'https://' }
};

window.openSocialPicker = function() {
    const list = document.getElementById('social-picker-list');
    list.innerHTML = '';
    
    Object.keys(socialPlatformsConfig).forEach(key => {
        const config = socialPlatformsConfig[key];
        list.innerHTML += `
            <button onclick="selectSocialPlatform('${key}')" class="w-full flex items-center gap-4 p-3.5 rounded-2xl hover:bg-surface-variant/30 dark:hover:bg-neutral-800 transition-colors active:scale-[0.98] text-left border border-transparent hover:border-surface-variant/50 dark:hover:border-neutral-700">
                <div class="w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-sm ${config.color}">
                    <i class="${config.icon} text-[18px]"></i>
                </div>
                <span class="font-extrabold text-[15px] text-on-surface dark:text-gray-100 tracking-wide">${config.name}</span>
            </button>
        `;
    });
    
    document.getElementById('modal-social-picker').classList.replace('hidden', 'flex');
};

window.closeSocialPicker = function() {
    document.getElementById('modal-social-picker').classList.replace('flex', 'hidden');
};

window.selectSocialPlatform = function(id) {
    const config = socialPlatformsConfig[id];
    
    document.getElementById('add-social-platform').value = id;
    document.getElementById('selected-social-name').textContent = config.name;
    document.getElementById('selected-social-icon').className = config.icon + ' text-[16px]';
    document.getElementById('selected-social-icon-box').className = `w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm ${config.color}`;
    
    const input = document.getElementById('add-social-url');
    input.type = config.type;
    input.placeholder = config.placeholder;
    input.value = ''; 
    
    closeSocialPicker();
};


// ========================================================
// NATIVE LONG-PRESS ENGINE (Profile Peek)
// ========================================================
let longPressTimer;
window.isLongPressing = false; 

document.addEventListener('touchstart', handleTouchStart, { passive: true });
document.addEventListener('touchend', handleTouchEnd);
document.addEventListener('touchmove', handleTouchMove, { passive: true });

document.addEventListener('mousedown', handleTouchStart);
document.addEventListener('mouseup', handleTouchEnd);
document.addEventListener('mousemove', handleTouchMove);

function handleTouchStart(e) {
    const target = e.target.closest('.profile-link');
    if (!target) return;
    
    const userId = target.dataset.userId;
    if (!userId) return;

    window.isLongPressing = false;
    
    longPressTimer = setTimeout(() => {
        window.isLongPressing = true;
        if (navigator.vibrate) navigator.vibrate(50);
        openProfilePeek(userId, target);
    }, 400); 
}

function handleTouchMove() {
    clearTimeout(longPressTimer);
}

function handleTouchEnd(e) {
    clearTimeout(longPressTimer);
    
    if (window.isLongPressing) {
        if (e.cancelable) e.preventDefault();
        setTimeout(() => { window.isLongPressing = false; }, 300);
    }
}

window.openProfilePeek = async function(userId, imgEl) {
    const modal = document.getElementById('modal-profile-peek');
    const card = document.getElementById('peek-card');
    
    if (imgEl && imgEl.tagName === 'IMG') {
        document.getElementById('peek-avatar').src = imgEl.src;
    }
    
    document.getElementById('peek-name').innerHTML = 'Loading...';
    document.getElementById('peek-course').textContent = 'Fetching details...';
    
    modal.classList.replace('hidden', 'flex');
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        card.classList.remove('scale-90');
    }, 10);

    try {
        const { data: user, error } = await supabase.from('users').select('full_name, profile_img_url, course, tick_type').eq('id', userId).single();
        if (error) throw error;
        
        const optimizedAvatar = typeof optimizeImageUrl === 'function' ? optimizeImageUrl(user.profile_img_url, 'avatar') : user.profile_img_url;
        document.getElementById('peek-avatar').src = optimizedAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.full_name)}&background=e1e3e4`;
        
        const verifiedBadge = typeof getTickHtmlLocal === 'function' ? getTickHtmlLocal(user.tick_type) : '';
        document.getElementById('peek-name').innerHTML = `${user.full_name} ${verifiedBadge}`;
        document.getElementById('peek-course').textContent = user.course || 'Campus Member';
        
        document.getElementById('peek-view-profile-btn').onclick = () => {
            closeProfilePeek();
            setTimeout(() => viewUserProfile(userId), 200); 
        };
    } catch (err) {
        document.getElementById('peek-name').textContent = 'User Details Unavailable';
        document.getElementById('peek-course').textContent = '';
    }
}

window.closeProfilePeek = function() {
    const modal = document.getElementById('modal-profile-peek');
    const card = document.getElementById('peek-card');
    
    modal.classList.add('opacity-0');
    card.classList.add('scale-90');
    
    setTimeout(() => {
        modal.classList.replace('flex', 'hidden');
    }, 300);
}
