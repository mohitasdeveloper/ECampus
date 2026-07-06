import { supabase } from './supabase.js';
import { showToast } from './ui.js';
import { timeAgo } from './utils.js';
import { CLOUDINARY_CLOUD_NAME, CLOUDINARY_HOTPOSTS_PRESET } from './config.js';

let hotpostsByUser = new Map();
let currentUser = null;
let currentPhotoBlob = null; 
let currentFilter = 'none';

let currentCameraStream = null;
let currentFacingMode = 'environment'; 
let sessionViewedPostIds = new Set();

const CLOUDINARY_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;

export function initHotposts(user) {
    currentUser = user;
    setupEventListeners();
    fetchHotposts();
}

function setupEventListeners() {
    document.getElementById('close-hotpost-camera-btn')?.addEventListener('click', closeCameraModal);
    document.getElementById('switch-hotpost-camera-btn')?.addEventListener('click', switchCamera);
    document.getElementById('capture-hotpost-btn')?.addEventListener('click', capturePhoto);
    document.getElementById('retake-hotpost-btn')?.addEventListener('click', resetCameraUI);
    document.getElementById('submit-hotpost-btn')?.addEventListener('click', submitHotpost);

    document.getElementById('add-text-hotpost-btn')?.addEventListener('click', () => {
        const textInput = document.getElementById('hotpost-text-input');
        textInput.classList.remove('hidden');
        textInput.focus();
    });

    document.getElementById('close-hotpost-viewer-btn').addEventListener('click', closeHotpostViewer);
    document.getElementById('hotpost-nav-next').addEventListener('click', nextStory);
    document.getElementById('hotpost-nav-prev').addEventListener('click', prevStory);
    
    // Activity Panel (Self View)
    document.getElementById('hotpost-activity-btn')?.addEventListener('click', openStoryDetailsModal);
    document.getElementById('close-story-details-handle')?.addEventListener('click', closeStoryDetailsModal);
    document.getElementById('delete-hotpost-action-btn')?.addEventListener('click', handleDeleteHotpost);

    document.getElementById('hotpost-reply-btn')?.addEventListener('click', (e) => handleReplyToHotpost(e));
    document.getElementById('hotpost-like-btn')?.addEventListener('click', (e) => handleLikeHotpost(e));

    // Tabs
    document.getElementById('details-tab-viewers')?.addEventListener('click', () => switchDetailsTab('viewers'));
    document.getElementById('details-tab-likes')?.addEventListener('click', () => switchDetailsTab('likes'));
    document.getElementById('details-tab-replies')?.addEventListener('click', () => switchDetailsTab('replies'));

    const replyInput = document.getElementById('hotpost-reply-input');
    replyInput?.addEventListener('focus', pauseStory);
    replyInput?.addEventListener('blur', resumeStory);

    document.querySelector('[data-edit="filter"]')?.addEventListener('click', toggleFilterTray);
    document.querySelectorAll('.filter-btn').forEach(btn => btn.addEventListener('click', applyFilter));

    const navNext = document.getElementById('hotpost-nav-next');
    const navPrev = document.getElementById('hotpost-nav-prev');

    [navNext, navPrev].forEach(navEl => {
        if (navEl) {
            navEl.addEventListener('pointerdown', pauseStory);
            navEl.addEventListener('pointerup', resumeStory);
            navEl.addEventListener('pointerleave', resumeStory);
        }

    // --- NATIVE SWIPE GESTURES ---
    let startY = 0;
    
    // 1. Viewer Gestures (Swipe Up for Activity, Swipe Down to Close)
    const viewer = document.getElementById('modal-view-hotpost');
    if (viewer) {
        viewer.addEventListener('touchstart', (e) => {
            startY = e.touches[0].clientY;
        }, { passive: true });
        
        viewer.addEventListener('touchend', (e) => {
            const endY = e.changedTouches[0].clientY;
            const deltaY = endY - startY;
            
            // Ignore if swiping on the reply input or buttons
            if (e.target.closest('button') || e.target.closest('input')) return;

            if (deltaY < -50 && currentViewerState.userId === currentUser.id) {
                // Swipe Up on Own Story -> Open Activity Panel
                openStoryDetailsModal();
            } else if (deltaY > 100) {
                // Swipe Down -> Close Viewer
                closeHotpostViewer();
            }
        }, { passive: true });
    }

    // 2. Activity Panel Gestures (Swipe Down to Close Activity)
    const activityPanel = document.getElementById('modal-story-details');
    if (activityPanel) {
        activityPanel.addEventListener('touchstart', (e) => {
            // Only track swipe if we aren't currently scrolling down inside the lists
            const scrollArea = e.target.closest('.overflow-y-auto');
            if (scrollArea && scrollArea.scrollTop > 0) {
                startY = -1; // disable swipe close if scrolled down
            } else {
                startY = e.touches[0].clientY;
            }
        }, { passive: true });

        activityPanel.addEventListener('touchend', (e) => {
            if (startY === -1) return;
            const endY = e.changedTouches[0].clientY;
            if (endY - startY > 80) {
                // Swipe Down -> Close Activity Panel and resume story
                closeStoryDetailsModal();
            }
        }, { passive: true });
    }
    });
}

async function openCameraModal() {
    const modal = document.getElementById('modal-hotpost-camera');
    const video = document.getElementById('hotpost-camera-feed');
    modal.classList.replace('hidden', 'flex');

    if (currentCameraStream) currentCameraStream.getTracks().forEach(track => track.stop());

    try {
        currentCameraStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: currentFacingMode, width: { ideal: 1920 }, height: { ideal: 1080 } }
        });
        video.srcObject = currentCameraStream;
        video.style.transform = currentFacingMode === 'user' ? 'scaleX(-1)' : 'none';
    } catch (err) {
        console.warn(`Camera error:`, err);
        showToast('Could not access camera. Please check permissions.', 'error');
        closeCameraModal();
    }
}

function closeCameraModal() {
    const modal = document.getElementById('modal-hotpost-camera');
    if (currentCameraStream) currentCameraStream.getTracks().forEach(track => track.stop());
    resetCameraUI();
    modal.classList.replace('flex', 'hidden');
}

function switchCamera() {
    currentFacingMode = currentFacingMode === 'environment' ? 'user' : 'environment';
    openCameraModal();
}

function resetCameraUI() {
    document.getElementById('hotpost-camera-feed').classList.remove('hidden');
    document.getElementById('hotpost-preview')?.classList.add('hidden');
    
    const textInput = document.getElementById('hotpost-text-input');
    if(textInput) {
        textInput.classList.add('hidden');
        textInput.value = ''; 
    }

    document.getElementById('capture-ui').classList.remove('hidden');
    document.getElementById('preview-ui').classList.add('hidden');
    document.getElementById('switch-hotpost-camera-btn').classList.remove('hidden');
    
    document.getElementById('add-text-hotpost-btn')?.classList.add('hidden');
    document.getElementById('filter-hotpost-btn')?.classList.add('hidden');
    document.getElementById('filter-tray').classList.add('hidden');

    currentFilter = 'none';
    const preview = document.getElementById('hotpost-preview');
    if (preview) preview.style.filter = 'none';
}

function showPreviewUI() {
    document.getElementById('hotpost-camera-feed').classList.add('hidden');
    document.getElementById('hotpost-preview')?.classList.remove('hidden');
    
    document.getElementById('capture-ui').classList.add('hidden');
    document.getElementById('preview-ui').classList.remove('hidden');
    document.getElementById('switch-hotpost-camera-btn').classList.add('hidden');
    
    document.getElementById('add-text-hotpost-btn')?.classList.remove('hidden');
    document.getElementById('filter-hotpost-btn')?.classList.remove('hidden');
}

function toggleFilterTray() {
    document.getElementById('filter-tray').classList.toggle('hidden');
    document.getElementById('filter-tray').classList.toggle('flex'); 
}

function applyFilter(event) {
    currentFilter = event.target.dataset.filter;
    document.getElementById('hotpost-preview').style.filter = currentFilter;
}

function capturePhoto() {
    const video = document.getElementById('hotpost-camera-feed');
    const canvas = document.getElementById('hotpost-camera-canvas');
    const context = canvas.getContext('2d');

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    if (currentFacingMode === 'user') {
        context.translate(canvas.width, 0);
        context.scale(-1, 1);
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(blob => {
        currentPhotoBlob = blob;
        document.getElementById('hotpost-preview').src = URL.createObjectURL(blob);
        showPreviewUI();
    }, 'image/jpeg', 0.9);
}

async function submitHotpost() {
    if (!currentPhotoBlob) return;

    const visibility = document.getElementById('hotpost-visibility')?.value || 'everyone';
    const textOverlay = document.getElementById('hotpost-text-input')?.value.trim();
    const btn = document.getElementById('submit-hotpost-btn');
    
    btn.disabled = true;
    btn.innerHTML = `<span class="material-symbols-outlined animate-spin text-white">progress_activity</span>`;

    try {
        const getEditedBlob = () => new Promise((resolve) => {
            if (currentFilter === 'none' && !textOverlay) {
                resolve(currentPhotoBlob); 
                return;
            }

            const editCanvas = document.createElement('canvas');
            const editCtx = editCanvas.getContext('2d');
            const img = new Image();

            img.onload = () => {
                editCanvas.width = img.width;
                editCanvas.height = img.height;
                if(currentFilter !== 'none') editCtx.filter = currentFilter;
                editCtx.drawImage(img, 0, 0);

                if (textOverlay) {
                    const fontSize = Math.floor(editCanvas.width * 0.08); 
                    editCtx.font = `800 ${fontSize}px Inter, sans-serif`;
                    editCtx.fillStyle = "white";
                    editCtx.textAlign = "center";
                    editCtx.textBaseline = "middle";
                    editCtx.shadowColor = "rgba(0,0,0,0.9)";
                    editCtx.shadowBlur = 15;
                    editCtx.fillText(textOverlay, editCanvas.width / 2, editCanvas.height / 2);
                }
                editCanvas.toBlob(resolve, 'image/jpeg', 0.9);
            };
            img.src = URL.createObjectURL(currentPhotoBlob);
        });

        const finalBlob = await getEditedBlob();

        const formData = new FormData();
        formData.append('file', finalBlob, 'hotpost.jpg');
        formData.append('upload_preset', CLOUDINARY_HOTPOSTS_PRESET);

        const res = await fetch(CLOUDINARY_URL, { method: 'POST', body: formData });
        const data = await res.json();
        if (data.error) throw new Error(data.error.message);

        const { error } = await supabase.from('hotposts').insert({
            user_id: currentUser.id,
            media_url: data.secure_url,
            media_type: 'image',
            visibility: visibility,
        });

        if (error) throw error;

        showToast('Hotpost created successfully!', 'success');
        closeCameraModal();
        fetchHotposts(); 

    } catch (error) {
        showToast('Failed to create hotpost.', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<span class="material-symbols-outlined text-[24px]">send</span>`;
    }
}

async function fetchHotposts() {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
        .from('hotposts')
        .select(`
            id, created_at, media_url, visibility, user_id,
            users ( id, full_name, profile_img_url ),
            hotpost_views ( viewer_id )
        `)
        .gt('created_at', twentyFourHoursAgo)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });

    if (error) return;

    // Filter out posts the user has already viewed (Snapchat style)
    const unviewedData = data.filter(post => {
        if (post.user_id === currentUser.id) return true; // Keep own posts until 24h expires
        const hasViewed = post.hotpost_views.some(v => v.viewer_id === currentUser.id);
        return !hasViewed;
    });

    hotpostsByUser.clear();
    for (const post of unviewedData) {
        const userId = post.users.id;
        if (!hotpostsByUser.has(userId)) {
            hotpostsByUser.set(userId, { user: post.users, posts: [], viewed: false });
        }
        hotpostsByUser.get(userId).posts.unshift({ ...post, users: undefined }); 
    }

    renderHotpostCircles();
}

function renderHotpostCircles() {
    const container = document.querySelector('#view-dashboard .flex.gap-4.overflow-x-auto');
    if (!container) return;
    container.innerHTML = ''; 

    // 1. ALWAYS render the Current User's circle first
    const myData = hotpostsByUser.get(currentUser.id);
    const hasMyActiveStories = myData && myData.posts.length > 0;
    
    const myCircle = document.createElement('div');
    // Added relative and z-20 to ensure it is clickable on mobile
    myCircle.className = 'hotpost-circle flex flex-col items-center gap-1.5 shrink-0 cursor-pointer active:scale-95 transition-transform relative z-20';
    
    if (hasMyActiveStories) {
        // Has stories: Show ring, click to view
        const isViewed = myData.viewed || false;
        const ringClass = isViewed ? 'from-gray-300 to-gray-400' : 'from-gray-400 to-gray-600';
        myCircle.innerHTML = `
            <div class="w-[68px] h-[68px] rounded-full p-[2.5px] bg-gradient-to-tr ${ringClass} shadow-sm relative">
                <div class="w-full h-full rounded-full border-2 border-white dark:border-neutral-900 overflow-hidden bg-gray-100 dark:bg-neutral-800">
                    <img src="${currentUser.profile_img_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.full_name)}`}" class="w-full h-full object-cover">
                </div>
            </div>
            <span class="text-[11px] font-bold text-gray-900 dark:text-gray-100">Your Story</span>
        `;
        myCircle.addEventListener('click', () => openHotpostViewer(currentUser.id));
    } else {
        // No stories: Show "+" icon, click to open camera
        myCircle.innerHTML = `
            <div class="w-[68px] h-[68px] rounded-full p-[2.5px] bg-transparent shadow-sm relative">
                <div class="w-full h-full rounded-full border-2 border-surface-variant dark:border-neutral-700 overflow-hidden bg-gray-100 dark:bg-neutral-800">
                    <img src="${currentUser.profile_img_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.full_name)}`}" class="w-full h-full object-cover opacity-80">
                </div>
                <div class="absolute bottom-0 right-0 w-6 h-6 bg-primary text-white rounded-full border-[2.5px] border-white dark:border-[#121212] flex items-center justify-center z-30 shadow-sm">
                    <span class="material-symbols-outlined text-[14px] font-bold">add</span>
                </div>
            </div>
            <span class="text-[11px] font-bold text-gray-900 dark:text-gray-100">Add Story</span>
        `;
        myCircle.addEventListener('click', () => window.openHotpostCamera());
    }
    container.appendChild(myCircle);

    // 2. Render all OTHER users' circles
    const otherUserIds = Array.from(hotpostsByUser.keys()).filter(id => id !== currentUser.id);
    
    // Sort by unviewed first, then viewed
    otherUserIds.sort((a, b) => (hotpostsByUser.get(a).viewed || false) - (hotpostsByUser.get(b).viewed || false));

    otherUserIds.forEach(userId => {
        const data = hotpostsByUser.get(userId);
        const user = data.user;
        const circle = document.createElement('div');
        circle.className = 'hotpost-circle flex flex-col items-center gap-1.5 shrink-0 cursor-pointer active:scale-95 transition-transform relative z-10';

        const ringClass = data.viewed ? 'from-gray-300 to-gray-400' : 'from-yellow-400 via-orange-500 to-red-500';

        circle.innerHTML = `
            <div class="w-[68px] h-[68px] rounded-full p-[2.5px] bg-gradient-to-tr ${ringClass} shadow-sm">
                <div class="w-full h-full rounded-full border-2 border-white dark:border-neutral-900 overflow-hidden bg-gray-100 dark:bg-neutral-800">
                    <img src="${user.profile_img_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.full_name)}`}" class="w-full h-full object-cover">
                </div>
            </div>
            <span class="text-[11px] font-bold text-gray-900 dark:text-gray-100">${user.full_name.split(' ')[0]}</span>
        `;
        circle.addEventListener('click', () => openHotpostViewer(userId));
        container.appendChild(circle);
    });
}

let currentViewerState = {
    userId: null,
    userOrder: [], 
    userIndex: -1,
    postIndex: 0,
    storyTimer: null,
    storyDuration: 5000,
    animationStartTime: 0,
    remainingDuration: 0,
};

function openHotpostViewer(userId) {
    const userData = hotpostsByUser.get(userId);
    if (!userData || userData.posts.length === 0) return;

    const allUserIds = Array.from(hotpostsByUser.keys())
        .filter(id => id !== currentUser.id)
        .sort((a, b) => (hotpostsByUser.get(a).viewed || false) - (hotpostsByUser.get(b).viewed || false));

    if (userId === currentUser.id) {
        allUserIds.unshift(currentUser.id);
    }

    const clickedUserIndex = allUserIds.indexOf(userId);
    currentViewerState.userOrder = [
        ...allUserIds.slice(clickedUserIndex),
        ...allUserIds.slice(0, clickedUserIndex)
    ];

    document.getElementById('modal-view-hotpost').classList.replace('hidden', 'flex');
    playUserStories(0); 
}

function processStoryDisappear() {
    // Snapchat logic: If user swiped away or story finished, destroy from DOM instantly
    const lastViewedUser = currentViewerState.userId;
    if (lastViewedUser && lastViewedUser !== currentUser.id) {
        hotpostsByUser.delete(lastViewedUser);
        renderHotpostCircles();
    }
}

function closeHotpostViewer() {
    document.getElementById('modal-view-hotpost').classList.replace('flex', 'hidden');
    clearTimeout(currentViewerState.storyTimer);
    const activeBar = document.querySelector('#hotpost-progress-bars .progress-bar-inner.active');
    if (activeBar) activeBar.style.animation = 'none';
    
    processStoryDisappear();
}

function playUserStories(userIndex, postIndex = 0) {
    if (userIndex >= currentViewerState.userOrder.length) {
        closeHotpostViewer();
        return;
    }

    currentViewerState.userIndex = userIndex;
    currentViewerState.postIndex = postIndex;
    currentViewerState.userId = currentViewerState.userOrder[userIndex];

    const userData = hotpostsByUser.get(currentViewerState.userId);
    const post = userData.posts[currentViewerState.postIndex];

    // Build progress bars
    const progressContainer = document.getElementById('hotpost-progress-bars');
    progressContainer.innerHTML = userData.posts.map((p, index) => `
        <div class="flex-1 bg-white/30 rounded-full overflow-hidden">
            <div class="progress-bar-inner h-full bg-white rounded-full ${index < postIndex ? 'w-full' : ''}" data-index="${index}"></div>
        </div>
    `).join('');

    // Configure Bottom UI based on ownership
    const isMyStory = currentViewerState.userId === currentUser.id;
    document.getElementById('hotpost-reply-container').style.display = isMyStory ? 'none' : 'flex';
    document.getElementById('hotpost-activity-btn').style.display = isMyStory ? 'flex' : 'none';
    
    // Visibility Badge (Globe or Green Star)
    const visIcon = document.getElementById('hotpost-viewer-visibility');
    if (post.visibility === 'connections') {
        visIcon.textContent = 'stars';
        visIcon.classList.add('text-green-400');
        visIcon.classList.remove('text-white/80');
    } else {
        visIcon.textContent = 'public';
        visIcon.classList.remove('text-green-400');
        visIcon.classList.add('text-white/80');
    }

    // Reset Like button state
    const likeBtnIcon = document.querySelector('#hotpost-like-btn span');
    if(likeBtnIcon) {
        likeBtnIcon.style.fontVariationSettings = "'FILL' 0";
        likeBtnIcon.classList.remove('text-red-500');
    }

    document.getElementById('hotpost-viewer-avatar').src = userData.user.profile_img_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.user.full_name)}`;
    document.getElementById('hotpost-viewer-name').textContent = isMyStory ? 'Your Story' : userData.user.full_name;
    document.getElementById('hotpost-viewer-time').textContent = timeAgo(post.created_at);
    document.getElementById('hotpost-viewer-image').src = post.media_url;

    recordView(post.id);

    const activeBar = progressContainer.querySelector(`.progress-bar-inner[data-index="${postIndex}"]`);
    if (activeBar) {
        activeBar.style.animation = `fill-progress ${currentViewerState.storyDuration}ms linear forwards`;
        activeBar.classList.add('active');
    }

    clearTimeout(currentViewerState.storyTimer);
    currentViewerState.remainingDuration = currentViewerState.storyDuration; 
    currentViewerState.animationStartTime = performance.now();
    currentViewerState.storyTimer = setTimeout(nextStory, currentViewerState.storyDuration);
}

function nextStory() {
    const currentUserData = hotpostsByUser.get(currentViewerState.userId);
    if (currentViewerState.postIndex < currentUserData.posts.length - 1) {
        playUserStories(currentViewerState.userIndex, currentViewerState.postIndex + 1);
    } else {
        processStoryDisappear(); // Immediately destroy from DOM before moving to next
        playUserStories(currentViewerState.userIndex + 1, 0);
    }
}

function prevStory() {
    if (currentViewerState.postIndex > 0) {
        playUserStories(currentViewerState.userIndex, currentViewerState.postIndex - 1);
    } else if (currentViewerState.userIndex > 0) {
        const prevUserIndex = currentViewerState.userIndex - 1;
        const prevUserData = hotpostsByUser.get(currentViewerState.userOrder[prevUserIndex]);
        playUserStories(prevUserIndex, prevUserData.posts.length - 1);
    }
}

function pauseStory() {
    clearTimeout(currentViewerState.storyTimer);
    const activeBar = document.querySelector('#hotpost-progress-bars .progress-bar-inner.active');
    if (activeBar) {
        const elapsedTime = performance.now() - currentViewerState.animationStartTime;
        currentViewerState.remainingDuration -= elapsedTime;
        activeBar.style.animationPlayState = 'paused';
    }
}

function resumeStory() {
    if (document.getElementById('modal-view-hotpost').classList.contains('hidden')) return;
    if (!document.getElementById('modal-story-details').classList.contains('hidden')) return; // Dont resume if activity panel is open

    const activeBar = document.querySelector('#hotpost-progress-bars .progress-bar-inner.active');
    if (activeBar) activeBar.style.animationPlayState = 'running';
    
    currentViewerState.animationStartTime = performance.now(); 
    clearTimeout(currentViewerState.storyTimer);
    currentViewerState.storyTimer = setTimeout(nextStory, currentViewerState.remainingDuration);
}

async function recordView(hotpostId) {
    if (currentViewerState.userId === currentUser.id) return;
    if (sessionViewedPostIds.has(hotpostId)) return;

    const { error } = await supabase.from('hotpost_views').insert({ hotpost_id: hotpostId, viewer_id: currentUser.id });
    if (!error) sessionViewedPostIds.add(hotpostId); 
}

async function handleLikeHotpost(event) {
    event.stopPropagation(); 
    const btn = event.currentTarget;
    const icon = btn.querySelector('span');
    
    icon.style.fontVariationSettings = "'FILL' 1";
    icon.classList.add('text-red-500');
    
    const post = hotpostsByUser.get(currentViewerState.userId).posts[currentViewerState.postIndex];
    await supabase.from('hotpost_likes').insert({ hotpost_id: post.id, user_id: currentUser.id });
}

async function handleReplyToHotpost(event) {
    event.stopPropagation(); 

    const input = document.getElementById('hotpost-reply-input');
    const content = input.value.trim();
    if (!content) return;

    const userData = hotpostsByUser.get(currentViewerState.userId);
    const post = userData.posts[currentViewerState.postIndex];
    const replyBtn = document.getElementById('hotpost-reply-btn');
    const originalBtnContent = replyBtn.innerHTML;

    replyBtn.disabled = true;
    replyBtn.innerHTML = `<span class="material-symbols-outlined animate-spin text-white">progress_activity</span>`;

    const { error } = await supabase.from('hotpost_replies').insert({
        hotpost_id: post.id, replier_id: currentUser.id, author_id: userData.user.id, content: content
    });

    if (error) {
        showToast('Failed to send reply.', 'error');
        replyBtn.disabled = false;
        replyBtn.innerHTML = originalBtnContent;
    } else {
        showToast('Reply sent!', 'success');
        input.value = '';
        replyBtn.classList.add('!bg-green-500', 'transition-colors', 'border-transparent');
        replyBtn.innerHTML = `<span class="material-symbols-outlined text-white">check</span>`;

        setTimeout(() => {
            replyBtn.disabled = false;
            replyBtn.classList.remove('!bg-green-500', 'border-transparent');
            replyBtn.innerHTML = originalBtnContent;
            resumeStory();
        }, 1500);
    }
}

// =====================================
// ACTIVITY PANEL (Self View)
// =====================================

async function openStoryDetailsModal() {
    pauseStory();
    const modal = document.getElementById('modal-story-details');
    modal.classList.replace('hidden', 'flex');

    const post = hotpostsByUser.get(currentUser.id).posts[currentViewerState.postIndex];

    switchDetailsTab('viewers');
    fetchStoryViewers(post.id);
    fetchStoryLikes(post.id);
    fetchStoryReplies(post.id);
}

function closeStoryDetailsModal() {
    document.getElementById('modal-story-details').classList.replace('flex', 'hidden');
    resumeStory();
}

function switchDetailsTab(tabName) {
    document.querySelectorAll('.details-content').forEach(el => el.classList.add('hidden'));
    document.getElementById(`details-content-${tabName}`).classList.remove('hidden');

    document.querySelectorAll('.details-tab').forEach(el => {
        el.classList.remove('active', 'border-primary', 'text-primary');
        el.classList.add('border-transparent', 'text-on-surface-variant', 'dark:text-gray-400');
    });
    document.getElementById(`details-tab-${tabName}`).classList.add('active', 'border-primary', 'text-primary');
    document.getElementById(`details-tab-${tabName}`).classList.remove('text-on-surface-variant', 'dark:text-gray-400');
}

async function fetchStoryViewers(hotpostId) {
    const list = document.getElementById('hotpost-viewers-list');
    list.innerHTML = `<p class="text-sm italic text-center py-8 text-on-surface-variant dark:text-gray-400">Loading...</p>`;
    try {
        const { data, error } = await supabase.from('hotpost_views').select('viewed_at, users!hotpost_views_viewer_id_fkey(full_name, profile_img_url)')
            .eq('hotpost_id', hotpostId).eq('is_deleted', false).order('viewed_at', { ascending: false });
        if (error) throw error;
        
        document.getElementById('details-tab-viewers').innerHTML = `<span class="material-symbols-outlined text-[16px] mr-1 align-middle">visibility</span> ${data.length}`;
        if (data.length === 0) { list.innerHTML = `<p class="text-sm italic text-center py-8">No views yet.</p>`; return; }

        list.innerHTML = data.map(v => `
            <div class="flex items-center gap-3 p-3 bg-surface-variant/20 dark:bg-neutral-800/50 rounded-2xl">
                <img src="${v.users.profile_img_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(v.users.full_name)}`}" class="w-10 h-10 rounded-full object-cover">
                <div class="flex-1"><p class="text-sm font-bold text-on-surface dark:text-gray-100">${v.users.full_name}</p></div>
                <p class="text-xs text-on-surface-variant dark:text-gray-500">${timeAgo(v.viewed_at)}</p>
            </div>
        `).join('');
    } catch (e) { list.innerHTML = `<p class="text-sm text-center py-8 text-error">Failed.</p>`; }
}

async function fetchStoryLikes(hotpostId) {
    const list = document.getElementById('hotpost-likes-list');
    list.innerHTML = `<p class="text-sm italic text-center py-8 text-on-surface-variant dark:text-gray-400">Loading...</p>`;
    try {
        const { data, error } = await supabase.from('hotpost_likes').select('created_at, users!hotpost_likes_user_id_fkey(full_name, profile_img_url)')
            .eq('hotpost_id', hotpostId).eq('is_deleted', false).order('created_at', { ascending: false });
        if (error) throw error;
        
        document.getElementById('details-tab-likes').innerHTML = `<span class="material-symbols-outlined text-[16px] mr-1 align-middle">favorite</span> ${data.length}`;
        if (data.length === 0) { list.innerHTML = `<p class="text-sm italic text-center py-8">No likes yet.</p>`; return; }

        list.innerHTML = data.map(l => `
            <div class="flex items-center gap-3 p-3 bg-red-500/5 dark:bg-red-500/10 rounded-2xl border border-red-500/10">
                <img src="${l.users.profile_img_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(l.users.full_name)}`}" class="w-10 h-10 rounded-full object-cover">
                <div class="flex-1"><p class="text-sm font-bold text-on-surface dark:text-gray-100">${l.users.full_name}</p></div>
                <span class="material-symbols-outlined text-red-500" style="font-variation-settings: 'FILL' 1;">favorite</span>
            </div>
        `).join('');
    } catch (e) { list.innerHTML = `<p class="text-sm text-center py-8 text-error">Failed.</p>`; }
}

async function fetchStoryReplies(hotpostId) {
    const list = document.getElementById('hotpost-replies-list');
    list.innerHTML = `<p class="text-sm italic text-center py-8 text-on-surface-variant dark:text-gray-400">Loading...</p>`;
    try {
        const { data, error } = await supabase.from('hotpost_replies').select('created_at, content, users!hotpost_replies_replier_id_fkey(full_name, profile_img_url)')
            .eq('hotpost_id', hotpostId).eq('is_deleted', false).order('created_at', { ascending: false });
        if (error) throw error;
        
        document.getElementById('details-tab-replies').innerHTML = `<span class="material-symbols-outlined text-[16px] mr-1 align-middle">reply</span> ${data.length}`;
        if (data.length === 0) { list.innerHTML = `<p class="text-sm italic text-center py-8">No replies yet.</p>`; return; }

        list.innerHTML = data.map(r => `
            <div class="flex items-start gap-3 p-3 bg-surface-variant/20 dark:bg-neutral-800/50 rounded-2xl">
                <img src="${r.users.profile_img_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(r.users.full_name)}`}" class="w-9 h-9 rounded-full object-cover">
                <div class="flex-1">
                    <div class="flex justify-between items-center mb-1">
                        <p class="text-[13px] font-bold text-on-surface dark:text-gray-100">${r.users.full_name}</p>
                        <p class="text-[10px] text-on-surface-variant dark:text-gray-500">${timeAgo(r.created_at)}</p>
                    </div>
                    <p class="text-[14px] text-on-surface dark:text-gray-300 whitespace-pre-wrap">${r.content}</p>
                </div>
            </div>
        `).join('');
    } catch (e) { list.innerHTML = `<p class="text-sm text-center py-8 text-error">Failed.</p>`; }
}

async function handleDeleteHotpost() {
    if (!confirm('Are you sure you want to delete this Hotpost?')) return;
    
    const post = hotpostsByUser.get(currentUser.id).posts[currentViewerState.postIndex];
    closeStoryDetailsModal(); 
    closeHotpostViewer();

    const { error } = await supabase.from('hotposts').update({ is_deleted: true }).eq('id', post.id);

    if (error) {
        showToast('Failed to delete Hotpost.', 'error');
    } else {
        showToast('Hotpost deleted.', 'success');
        fetchHotposts(); 
    }
}

window.openHotpostCamera = openCameraModal;
