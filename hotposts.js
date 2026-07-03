import { supabase } from './supabase.js';
import { showToast } from './ui.js';
import { timeAgo } from './utils.js';
import { CLOUDINARY_CLOUD_NAME, CLOUDINARY_HOTPOSTS_PRESET } from './config.js';

let hotpostsByUser = new Map();
let currentUser = null;
let currentPhotoBlob = null; // This will be a Blob object
let currentFilter = 'none';

let currentCameraStream = null;
let currentFacingMode = 'environment'; // 'environment' for back camera, 'user' for front
let sessionViewedPostIds = new Set();

const CLOUDINARY_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;

export function initHotposts(user) {
    currentUser = user;
    setupEventListeners();
    fetchHotposts();
}

function setupEventListeners() {
    document.getElementById('create-hotpost-btn').addEventListener('click', openCameraModal);
    document.getElementById('close-hotpost-camera-btn')?.addEventListener('click', closeCameraModal);
    document.getElementById('switch-hotpost-camera-btn')?.addEventListener('click', switchCamera);
    document.getElementById('capture-hotpost-btn')?.addEventListener('click', capturePhoto);
    document.getElementById('retake-hotpost-btn')?.addEventListener('click', resetCameraUI);
    document.getElementById('submit-hotpost-btn')?.addEventListener('click', submitHotpost);

    document.getElementById('close-my-hotposts-btn').addEventListener('click', closeMyHotpostsModal);
    document.getElementById('close-hotpost-viewer-btn').addEventListener('click', closeHotpostViewer);
    document.getElementById('hotpost-nav-next').addEventListener('click', nextStory);
    document.getElementById('hotpost-nav-prev').addEventListener('click', prevStory);
    document.getElementById('close-story-details-btn')?.addEventListener('click', closeStoryDetailsModal);
    document.getElementById('hotpost-reply-btn')?.addEventListener('click', handleReplyToHotpost);

    // Pause/resume on reply input focus
    const replyInput = document.getElementById('hotpost-reply-input');
    replyInput?.addEventListener('focus', pauseStory);
    replyInput?.addEventListener('blur', resumeStory);

    // New listeners for edits
    document.querySelector('[data-edit="filter"]')?.addEventListener('click', toggleFilterTray);
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', applyFilter);
    });

    // Pause/Resume story on long press
    const navNext = document.getElementById('hotpost-nav-next');
    const navPrev = document.getElementById('hotpost-nav-prev');

    [navNext, navPrev].forEach(navEl => {
        if (navEl) {
            navEl.addEventListener('pointerdown', pauseStory);
            navEl.addEventListener('pointerup', resumeStory);
            navEl.addEventListener('pointerleave', resumeStory);
        }
    });
}

async function openCameraModal() {
    const modal = document.getElementById('modal-hotpost-camera');
    const video = document.getElementById('hotpost-camera-feed');
    modal.classList.replace('hidden', 'flex');

    if (currentCameraStream) {
        currentCameraStream.getTracks().forEach(track => track.stop());
    }

    try {
        // First try the back camera
        currentCameraStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: currentFacingMode, width: { ideal: 1920 }, height: { ideal: 1080 } }
        });
        video.srcObject = currentCameraStream;
        video.style.transform = currentFacingMode === 'user' ? 'scaleX(-1)' : 'none';
    } catch (err) {
        // If back camera fails (e.g., on a laptop), try any available camera
        console.warn(`Camera with facingMode:${currentFacingMode} not found, trying default.`);
        try {
            currentCameraStream = await navigator.mediaDevices.getUserMedia({ video: true });
            video.srcObject = currentCameraStream;
        } catch (finalErr) {
            console.error("Camera access error:", finalErr);
            showToast('Could not access camera. Please check permissions.', 'error');
            closeCameraModal();
        }
    }
}

function closeCameraModal() {
    const modal = document.getElementById('modal-hotpost-camera');
    if (currentCameraStream) {
        currentCameraStream.getTracks().forEach(track => track.stop());
    }
    // Clean up blob URL to prevent memory leaks
    const preview = document.getElementById('hotpost-preview');
    if (preview && preview.src.startsWith('blob:')) {
        URL.revokeObjectURL(preview.src);
    }
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

    document.getElementById('capture-ui').classList.remove('hidden');
    document.getElementById('preview-ui').classList.add('hidden');

    document.getElementById('switch-hotpost-camera-btn').classList.remove('hidden');
    document.getElementById('edit-options-bar').classList.add('hidden');
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
    document.getElementById('edit-options-bar').classList.remove('hidden');
}

function toggleFilterTray() {
    document.getElementById('filter-tray').classList.toggle('hidden');
    document.getElementById('filter-tray').classList.toggle('flex'); // use flex for justify-center
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
        const imageUrl = URL.createObjectURL(blob);
        document.getElementById('hotpost-preview').src = imageUrl;
        showPreviewUI();
    }, 'image/jpeg', 0.9);
}

async function submitHotpost() {
    if (!currentPhotoBlob) {
        showToast('No photo to upload.', 'error');
        return;
    }

    const visibility = document.getElementById('hotpost-visibility')?.value || 'everyone';
    const btn = document.getElementById('submit-hotpost-btn');
    btn.disabled = true;
    btn.innerHTML = `<span class="material-symbols-outlined animate-spin">progress_activity</span>`;

    try {
        // Create a promise that resolves with the edited blob
        const getEditedBlob = () => new Promise((resolve) => {
            if (currentFilter === 'none' || !currentPhotoBlob) {
                resolve(currentPhotoBlob); // No edits or no photo, use original
                return;
            }

            const editCanvas = document.createElement('canvas');
            const editCtx = editCanvas.getContext('2d');
            const img = new Image();

            img.onload = () => {
                editCanvas.width = img.width;
                editCanvas.height = img.height;
                editCtx.filter = currentFilter;
                editCtx.drawImage(img, 0, 0);
                editCanvas.toBlob(resolve, 'image/jpeg', 0.9);
            };
            img.src = URL.createObjectURL(currentPhotoBlob);
        });

        const finalBlob = await getEditedBlob();

        // 1. Upload to Cloudinary
        const formData = new FormData();
        formData.append('file', finalBlob, 'hotpost.jpg');
        formData.append('upload_preset', CLOUDINARY_HOTPOSTS_PRESET);

        const res = await fetch(CLOUDINARY_URL, {
            method: 'POST',
            body: formData,
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error.message);
        const imageUrl = data.secure_url;

        // 2. Save to Supabase
        const { error } = await supabase.from('hotposts').insert({
            user_id: currentUser.id,
            media_url: imageUrl,
            media_type: 'image',
            caption: null, // Caption removed
            visibility: visibility,
        });

        if (error) throw error;

        showToast('Hotpost created successfully!', 'success');
        closeCameraModal();
        fetchHotposts(); // Refresh the list

    } catch (error) {
        console.error('Error creating hotpost:', error);
        showToast('Failed to create hotpost. Please try again.', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<span class="material-symbols-outlined text-3xl">send</span>`;
    }
}

async function fetchHotposts() {
    // Fetch hotposts from the last 24 hours
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
        .from('hotposts')
        .select(`
            id,
            created_at,
            media_url,
            caption,
            users ( id, full_name, profile_img_url ),
            hotpost_views ( count ),
            hotpost_replies ( count )
        `)
        .gt('created_at', twentyFourHoursAgo)
        // .eq('visibility', 'everyone') // Add logic for connections later
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching hotposts:', error);
        return;
    }

    // Group hotposts by user
    hotpostsByUser.clear();
    for (const post of data) {
        const userId = post.users.id;
        if (!hotpostsByUser.has(userId)) {
            hotpostsByUser.set(userId, {
                user: post.users,
                posts: [],
                viewed: false // For "viewed once" logic
            });
        }
        hotpostsByUser.get(userId).posts.push({ ...post, profiles: undefined, users: undefined }); // Clean up the post object
    }

    renderHotpostCircles();
}

function renderHotpostCircles() {
    const container = document.querySelector('#view-dashboard .flex.gap-4.overflow-x-auto');
    // Clear existing circles except the "add" button
    container.querySelectorAll('.hotpost-circle').forEach(el => el.remove());

    // Reset the create button to its default state
    const createBtnDiv = document.querySelector('#create-hotpost-btn > div');
    createBtnDiv.className = 'w-[68px] h-[68px] rounded-full border-[2.5px] border-dashed border-primary/40 flex items-center justify-center bg-primary/5 text-primary';
    createBtnDiv.innerHTML = `<span class="material-symbols-outlined text-[26px]">add</span>`;

    // Separate current user from others
    const otherUserIds = Array.from(hotpostsByUser.keys()).filter(id => id !== currentUser.id);

    // Sort other users: un-viewed first, then viewed
    otherUserIds.sort((a, b) => (hotpostsByUser.get(a).viewed || false) - (hotpostsByUser.get(b).viewed || false));

    const finalSortedIds = [];
    // If the current user has hotposts, add them to the start of the list
    if (hotpostsByUser.has(currentUser.id)) {
        finalSortedIds.push(currentUser.id);
    }
    // Add the sorted other users
    finalSortedIds.push(...otherUserIds);

    finalSortedIds.forEach(userId => {
        const data = hotpostsByUser.get(userId);
        const user = data.user;
        const circle = document.createElement('div');
        circle.className = 'hotpost-circle flex flex-col items-center gap-1.5 shrink-0 cursor-pointer active:scale-95 transition-transform';

        const isSelf = userId === currentUser.id;
        const isViewed = data.viewed;
        let ringClass = 'from-yellow-400 via-orange-500 to-red-500'; // Default un-viewed
        if (isSelf) ringClass = 'from-blue-500 to-primary'; // Self is always special color
        if (isViewed && !isSelf) ringClass = 'from-gray-300 to-gray-500'; // Viewed

        circle.innerHTML = `
            <div class="w-[68px] h-[68px] rounded-full p-[2.5px] bg-gradient-to-tr ${ringClass} shadow-sm">
                <div class="w-full h-full rounded-full border-2 border-white dark:border-neutral-900 overflow-hidden bg-gray-100 dark:bg-neutral-800">
                    <img src="${user.profile_img_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.full_name)}&background=e1e3e4`}" class="w-full h-full object-cover">
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
    userOrder: [], // Array of user IDs with stories
    userIndex: -1,
    postIndex: 0,
    storyTimer: null,
    storyDuration: 5000, // 5 seconds
    animationStartTime: 0,
    remainingDuration: 0,
};

function openHotpostViewer(userId) {
    const userData = hotpostsByUser.get(userId);
    if (!userData || userData.posts.length === 0) return;

    // Set the order of users to view, starting with the clicked one
    const allUserIds = Array.from(hotpostsByUser.keys())
        .filter(id => id !== currentUser.id)
        .sort((a, b) => (hotpostsByUser.get(a).viewed || false) - (hotpostsByUser.get(b).viewed || false));

    // Add current user to the front if they were clicked
    if (userId === currentUser.id) allUserIds.unshift(currentUser.id);

    const clickedUserIndex = allUserIds.indexOf(userId);
    currentViewerState.userOrder = [
        ...allUserIds.slice(clickedUserIndex),
        ...allUserIds.slice(0, clickedUserIndex)
    ];

    document.getElementById('modal-view-hotpost').classList.replace('hidden', 'flex');
    playUserStories(0); // Start with the first user in our new order
}

function closeHotpostViewer() {
    document.getElementById('modal-view-hotpost').classList.replace('flex', 'hidden');
    clearTimeout(currentViewerState.storyTimer);
    // Stop any active progress bar animation
    const activeBar = document.querySelector('#hotpost-progress-bars .progress-bar-inner.active');
    if (activeBar) activeBar.style.animation = 'none';
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

    // Render progress bars
    const progressContainer = document.getElementById('hotpost-progress-bars');
    progressContainer.innerHTML = userData.posts.map((p, index) => `
        <div class="flex-1 bg-white/30 rounded-full overflow-hidden">
            <div class="progress-bar-inner h-full bg-white rounded-full ${index < postIndex ? 'w-full' : ''}" data-index="${index}"></div>
        </div>
    `).join('');

    // Update UI
    const replyContainer = document.getElementById('hotpost-reply-container');
    const isMyStory = currentViewerState.userId === currentUser.id;

    // Hide reply for own story, show for others
    replyContainer.style.display = isMyStory ? 'none' : 'flex';

    document.getElementById('hotpost-viewer-avatar').src = userData.user.profile_img_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.user.full_name)}&background=e1e3e4`;
    document.getElementById('hotpost-viewer-name').textContent = userData.user.full_name;
    document.getElementById('hotpost-viewer-time').textContent = timeAgo(post.created_at);
    document.getElementById('hotpost-viewer-image').src = post.media_url;

    // Record the view
    recordView(post.id);

    // Start animation for the current progress bar
    const activeBar = progressContainer.querySelector(`.progress-bar-inner[data-index="${postIndex}"]`);
    if (activeBar) {
        activeBar.style.animation = `fill-progress ${currentViewerState.storyDuration}ms linear forwards`;
        activeBar.classList.add('active');
    }

    // Auto-advance
    clearTimeout(currentViewerState.storyTimer);
    currentViewerState.animationStartTime = performance.now();
    currentViewerState.storyTimer = setTimeout(nextStory, currentViewerState.storyDuration);
}

function nextStory() {
    const currentUserData = hotpostsByUser.get(currentViewerState.userId);
    if (currentViewerState.postIndex < currentUserData.posts.length - 1) {
        // Go to next post of the same user
        playUserStories(currentViewerState.userIndex, currentViewerState.postIndex + 1);
    } else {
        // Mark current user's stories as viewed (if not self)
        if (currentViewerState.userId !== currentUser.id) hotpostsByUser.get(currentViewerState.userId).viewed = true;
        renderHotpostCircles(); // Re-render to show grayed-out state
        // Go to the first post of the next user
        playUserStories(currentViewerState.userIndex + 1, 0);
    }
}

function prevStory() {
    if (currentViewerState.postIndex > 0) {
        // Go to previous post of the same user
        playUserStories(currentViewerState.userIndex, currentViewerState.postIndex - 1);
    } else if (currentViewerState.userIndex > 0) {
        // Go to the last post of the previous user
        const prevUserIndex = currentViewerState.userIndex - 1;
        const prevUserData = hotpostsByUser.get(currentViewerState.userOrder[prevUserIndex]);
        playUserStories(prevUserIndex, prevUserData.posts.length - 1);
    }
}

function pauseStory() {
    clearTimeout(currentViewerState.storyTimer);
    const activeBar = document.querySelector('#hotpost-progress-bars .progress-bar-inner.active');
    currentViewerState.remainingDuration = currentViewerState.storyDuration - (performance.now() - currentViewerState.animationStartTime);
    if (activeBar) {
        activeBar.style.animationPlayState = 'paused';
    }
}

function resumeStory() {
    // To prevent accidental resume if modal is not open
    if (document.getElementById('modal-view-hotpost').classList.contains('hidden')) return;

    const activeBar = document.querySelector('#hotpost-progress-bars .progress-bar-inner.active');
    if (activeBar) {
        activeBar.style.animationPlayState = 'running';
    }
    currentViewerState.storyTimer = setTimeout(nextStory, currentViewerState.remainingDuration);
}

async function recordView(hotpostId) {
    // Don't record views on your own posts
    const postOwnerId = Array.from(hotpostsByUser.values()).find(u => u.posts.some(p => p.id === hotpostId))?.user.id;
    if (sessionViewedPostIds.has(hotpostId)) return;
    if (postOwnerId === currentUser.id) return;

    const { error } = await supabase.from('hotpost_views').insert({
        hotpost_id: hotpostId,
        viewer_id: currentUser.id
    });

    if (error && error.code !== '23505') { // 23505 is unique violation
        console.error('Error recording hotpost view:', error);
    } else {
        sessionViewedPostIds.add(hotpostId); // Add to session cache to prevent re-insert attempts
    }
}

async function handleReplyToHotpost() {
    const input = document.getElementById('hotpost-reply-input');
    const content = input.value.trim();
    if (!content) return;

    const userData = hotpostsByUser.get(currentViewerState.userId);
    const post = userData.posts[currentViewerState.postIndex];

    const { error } = await supabase.from('hotpost_replies').insert({
        hotpost_id: post.id,
        replier_id: currentUser.id,
        author_id: userData.user.id,
        content: content
    });

    if (error) {
        showToast('Failed to send reply.', 'error');
        console.error('Error sending hotpost reply:', error);
    } else {
        showToast('Reply sent!', 'success');
        input.value = '';
        // Briefly hide input to show it was sent
        document.getElementById('hotpost-reply-container').style.opacity = '0.5';
        setTimeout(() => { document.getElementById('hotpost-reply-container').style.opacity = '1'; }, 1000);
    }
}

function openMyHotpostsModal(posts) {
    const list = document.getElementById('my-hotposts-list');
    list.innerHTML = posts.map(post => {
        const viewCount = post.hotpost_views[0]?.count || 0;
        const replyCount = post.hotpost_replies[0]?.count || 0;
        return `
            <div class="flex items-center gap-4 p-3 bg-gray-50 dark:bg-neutral-800/50 rounded-2xl border border-gray-200 dark:border-neutral-800">
                <img src="${post.media_url}" class="w-14 h-14 rounded-xl object-cover">
                <div class="flex-1 cursor-pointer" onclick="openStoryDetailsModal('${post.id}')">
                    <p class="text-sm font-bold text-gray-800 dark:text-gray-100 line-clamp-1">${post.caption || 'No Caption'}</p>
                    <p class="text-xs text-gray-500 dark:text-gray-400">${timeAgo(post.created_at)}</p>
                </div>
                <div class="flex items-center gap-1.5 text-secondary dark:text-secondary/80 cursor-pointer" onclick="openStoryDetailsModal('${post.id}', 'replies')">
                    <span class="material-symbols-outlined text-[18px]">reply</span>
                    <span class="text-sm font-bold">${replyCount}</span>
                </div>
                <div class="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 cursor-pointer" onclick="openStoryDetailsModal('${post.id}', 'viewers')">
                    <span class="material-symbols-outlined text-[18px]">visibility</span>
                    <span class="text-sm font-bold">${viewCount}</span>
                </div>
                <button onclick="handleDeleteHotpost('${post.id}')" class="p-2 text-red-500 hover:bg-red-100 dark:hover:bg-red-500/20 rounded-full transition-colors">
                    <span class="material-symbols-outlined text-xl">delete</span>
                </button>
            </div>
        `;
    }).join('');

    document.getElementById('modal-my-hotposts').classList.replace('hidden', 'flex');
}

function closeMyHotpostsModal() {
    document.getElementById('modal-my-hotposts').classList.replace('flex', 'hidden');
}

async function handleDeleteHotpost(hotpostId) {
    if (!confirm('Are you sure you want to delete this Hotpost? This cannot be undone.')) {
        return;
    }

    const { error } = await supabase.from('hotposts').delete().eq('id', hotpostId);

    if (error) {
        showToast('Failed to delete Hotpost.', 'error');
        console.error('Error deleting hotpost:', error);
    } else {
        showToast('Hotpost deleted.', 'success');
        fetchHotposts(); // Refresh the list
        closeMyHotpostsModal();
    }
}

async function openStoryDetailsModal(hotpostId, defaultTab = 'viewers') {
    const modal = document.getElementById('modal-story-details');
    modal.classList.replace('hidden', 'flex');

    const viewersList = document.getElementById('hotpost-viewers-list');
    const repliesList = document.getElementById('hotpost-replies-list');
    viewersList.innerHTML = `<p class="text-sm italic text-center py-8 text-gray-500 dark:text-gray-400">Loading...</p>`;
    repliesList.innerHTML = `<p class="text-sm italic text-center py-8 text-gray-500 dark:text-gray-400">Loading...</p>`;

    switchDetailsTab(defaultTab);

    // Fetch Viewers
    fetchStoryViewers(hotpostId, viewersList);
    // Fetch Replies
    fetchStoryReplies(hotpostId, repliesList);
}

async function fetchStoryViewers(hotpostId, list) {
    list.innerHTML = `<p class="text-sm italic text-center py-8 text-gray-500 dark:text-gray-400">Loading viewers...</p>`;

    try {
        const { data, error } = await supabase
            .from('hotpost_views')
            .select('viewed_at, users(full_name, profile_img_url)')
            .eq('hotpost_id', hotpostId)
            .order('viewed_at', { ascending: false });

        if (error) throw error;

        if (data.length === 0) {
            list.innerHTML = `<p class="text-sm italic text-center py-8 text-gray-500 dark:text-gray-400">No views yet.</p>`;
            return;
        }

        list.innerHTML = data.map(view => `
            <div class="flex items-center gap-3 p-2">
                <img src="${view.users.profile_img_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(view.users.full_name)}&background=e1e3e4`}" class="w-10 h-10 rounded-full object-cover">
                <div class="flex-1">
                    <p class="text-sm font-bold text-gray-800 dark:text-gray-100">${view.users.full_name}</p>
                </div>
                <p class="text-xs text-gray-400 dark:text-gray-500">${timeAgo(view.viewed_at)}</p>
            </div>
        `).join('');

    } catch (error) {
        console.error('Error fetching hotpost viewers:', error);
        list.innerHTML = `<p class="text-sm italic text-center py-8 text-red-500">Failed to load viewers.</p>`;
    }
}

async function fetchStoryReplies(hotpostId, list) {
    list.innerHTML = `<p class="text-sm italic text-center py-8 text-gray-500 dark:text-gray-400">Loading replies...</p>`;
    try {
        const { data, error } = await supabase
            .from('hotpost_replies')
            .select('created_at, content, users!hotpost_replies_replier_id_fkey(full_name, profile_img_url)')
            .eq('hotpost_id', hotpostId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (data.length === 0) {
            list.innerHTML = `<p class="text-sm italic text-center py-8 text-gray-500 dark:text-gray-400">No replies yet.</p>`;
            return;
        }

        list.innerHTML = data.map(reply => `
            <div class="flex items-start gap-3">
                <img src="${reply.users.profile_img_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(reply.users.full_name)}&background=e1e3e4`}" class="w-9 h-9 rounded-full object-cover mt-1">
                <div class="flex-1 bg-gray-100 dark:bg-neutral-800 rounded-2xl p-3">
                    <div class="flex justify-between items-center">
                        <p class="text-xs font-bold text-gray-900 dark:text-gray-100">${reply.users.full_name}</p>
                        <p class="text-[10px] text-gray-400 dark:text-gray-500">${timeAgo(reply.created_at)}</p>
                    </div>
                    <p class="text-sm text-gray-700 dark:text-gray-300 mt-1">${reply.content}</p>
                </div>
            </div>
        `).join('');

    } catch (error) {
        console.error('Error fetching hotpost replies:', error);
        list.innerHTML = `<p class="text-sm italic text-center py-8 text-red-500">Failed to load replies.</p>`;
    }
}

function closeStoryDetailsModal() {
    document.getElementById('modal-story-details').classList.replace('flex', 'hidden');
}

function switchDetailsTab(tabName) {
    document.querySelectorAll('.details-content').forEach(el => el.classList.add('hidden'));
    document.getElementById(`details-content-${tabName}`).classList.remove('hidden');

    document.querySelectorAll('.details-tab').forEach(el => {
        el.classList.remove('active', 'border-primary', 'text-primary');
        el.classList.add('border-transparent', 'text-gray-500');
    });
    document.getElementById(`details-tab-${tabName}`).classList.add('active', 'border-primary', 'text-primary');
}

export function showMyHotposts() {
    const myPosts = hotpostsByUser.get(currentUser.id)?.posts;
    if (myPosts && myPosts.length > 0) {
        openMyHotpostsModal(myPosts);
    } else {
        showToast("You have no active Hotposts.", "info");
    }
}

window.handleDeleteHotpost = handleDeleteHotpost;
window.openStoryDetailsModal = openStoryDetailsModal;
window.showMyHotposts = showMyHotposts;