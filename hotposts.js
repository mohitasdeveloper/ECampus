import { supabase } from './supabase.js';
import { showToast } from './ui.js';
import { timeAgo } from './utils.js';
import { CLOUDINARY_CLOUD_NAME, CLOUDINARY_HOTPOSTS_PRESET } from './config.js';

let hotpostsByUser = new Map();
let currentUser = null;
let currentPhotoBlob = null; // This will be a Blob object

let currentCameraStream = null;
let currentFacingMode = 'environment'; // 'environment' for back camera, 'user' for front

const CLOUDINARY_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;

export function initHotposts(user) {
    currentUser = user;
    setupEventListeners();
    fetchHotposts();
}

function setupEventListeners() {
    document.getElementById('create-hotpost-btn').addEventListener('click', handleCreateOrViewMyHotposts);
    document.getElementById('close-hotpost-camera-btn')?.addEventListener('click', closeCameraModal);
    document.getElementById('switch-hotpost-camera-btn')?.addEventListener('click', switchCamera);
    document.getElementById('capture-hotpost-btn')?.addEventListener('click', capturePhoto);

    document.getElementById('retake-hotpost-btn')?.addEventListener('click', openCameraModal);
    document.getElementById('close-hotpost-create-btn')?.addEventListener('click', closeCreateHotpostModal);
    document.getElementById('close-my-hotposts-btn').addEventListener('click', closeMyHotpostsModal);
    document.getElementById('submit-hotpost-btn').addEventListener('click', submitHotpost);
    document.getElementById('close-hotpost-viewer-btn').addEventListener('click', closeHotpostViewer);
    document.getElementById('hotpost-nav-next').addEventListener('click', nextStory);
    document.getElementById('hotpost-nav-prev').addEventListener('click', prevStory);
}

async function openCameraModal() {
    closeCreateHotpostModal(); // Close preview modal if open
    const modal = document.getElementById('modal-hotpost-camera');
    const video = document.getElementById('hotpost-camera-feed');
    modal.classList.replace('hidden', 'flex');

    if (currentCameraStream) {
        currentCameraStream.getTracks().forEach(track => track.stop());
    }

    try {
        currentCameraStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: currentFacingMode, width: { ideal: 1920 }, height: { ideal: 1080 } }
        });
        video.srcObject = currentCameraStream;
        video.style.transform = currentFacingMode === 'user' ? 'scaleX(-1)' : 'none';
    } catch (err) {
        console.error("Camera access error:", err);
        showToast('Could not access camera. Please check permissions.', 'error');
        closeCameraModal();
    }
}

function closeCameraModal() {
    const modal = document.getElementById('modal-hotpost-camera');
    if (currentCameraStream) {
        currentCameraStream.getTracks().forEach(track => track.stop());
    }
    modal.classList.replace('flex', 'hidden');
}

function switchCamera() {
    currentFacingMode = currentFacingMode === 'environment' ? 'user' : 'environment';
    openCameraModal();
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
        closeCameraModal();
        document.getElementById('modal-create-hotpost').classList.replace('hidden', 'flex');
    }, 'image/jpeg', 0.9);
}

async function submitHotpost() {
    if (!currentPhotoBlob) {
        showToast('No photo to upload.', 'error');
        return;
    }

    const caption = document.getElementById('hotpost-caption').value.trim();
    const visibility = document.getElementById('hotpost-visibility').value;
    const btn = document.getElementById('submit-hotpost-btn');
    btn.disabled = true;
    btn.textContent = 'Uploading...';

    try {
        // 1. Upload to Cloudinary
        const formData = new FormData();
        formData.append('file', currentPhotoBlob, 'hotpost.jpg'); // Send blob as a file
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
            caption: caption,
            visibility: visibility,
        });

        if (error) throw error;

        showToast('Hotpost created successfully!', 'success');
        closeCreateHotpostModal();
        fetchHotposts(); // Refresh the list

    } catch (error) {
        console.error('Error creating hotpost:', error);
        showToast('Failed to create hotpost. Please try again.', 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Post Hotpost';
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
            hotpost_views ( count )
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
                posts: []
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

    hotpostsByUser.forEach((data, userId) => {
        // Don't show the current user's circle in the main feed
        if (userId === currentUser.id) {
            // Instead, update the 'Create' button to show it's active
            const createBtnDiv = document.querySelector('#create-hotpost-btn > div');
            createBtnDiv.classList.remove('border-dashed', 'border-primary/40', 'bg-primary/5', 'text-primary');
            createBtnDiv.classList.add('p-[2.5px]', 'bg-gradient-to-tr', 'from-yellow-400', 'via-orange-500', 'to-red-500');
            createBtnDiv.innerHTML = `<div class="w-full h-full rounded-full border-2 border-white dark:border-neutral-900 overflow-hidden bg-gray-100 dark:bg-neutral-800"><img src="${currentUser.profile_img_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.full_name)}&background=e1e3e4`}" class="w-full h-full object-cover"></div>`;
            return;
        }

        const user = data.user;
        const circle = document.createElement('div');
        circle.className = 'hotpost-circle flex flex-col items-center gap-1.5 shrink-0 cursor-pointer active:scale-95 transition-transform';
        circle.innerHTML = `
            <div class="w-[68px] h-[68px] rounded-full p-[2.5px] bg-gradient-to-tr from-yellow-400 via-orange-500 to-red-500 shadow-sm">
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
};

function openHotpostViewer(userId) {
    const userData = hotpostsByUser.get(userId);
    if (!userData || userData.posts.length === 0) return;

    // Set the order of users to view, starting with the clicked one
    const allUserIds = Array.from(hotpostsByUser.keys()).filter(id => id !== currentUser.id);
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
    document.getElementById('hotpost-viewer-avatar').src = userData.user.profile_img_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.user.full_name)}&background=e1e3e4`;
    document.getElementById('hotpost-viewer-name').textContent = userData.user.full_name;
    document.getElementById('hotpost-viewer-time').textContent = timeAgo(post.created_at);
    document.getElementById('hotpost-viewer-image').src = post.media_url;
    document.getElementById('hotpost-viewer-caption').textContent = post.caption || '';
    document.getElementById('hotpost-viewer-caption').classList.toggle('hidden', !post.caption);

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
    currentViewerState.storyTimer = setTimeout(nextStory, currentViewerState.storyDuration);
}

function nextStory() {
    const currentUserData = hotpostsByUser.get(currentViewerState.userId);
    if (currentViewerState.postIndex < currentUserData.posts.length - 1) {
        // Go to next post of the same user
        playUserStories(currentViewerState.userIndex, currentViewerState.postIndex + 1);
    } else {
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

async function recordView(hotpostId) {
    // Don't record views on your own posts
    const postOwnerId = Array.from(hotpostsByUser.values()).find(u => u.posts.some(p => p.id === hotpostId))?.user.id;
    if (postOwnerId === currentUser.id) return;

    const { error } = await supabase.from('hotpost_views').insert({
        hotpost_id: hotpostId,
        viewer_id: currentUser.id
    });

    if (error && error.code !== '23505') { // 23505 is unique violation, which is fine
        console.error('Error recording hotpost view:', error);
    }
}

function handleCreateOrViewMyHotposts() {
    const myHotposts = hotpostsByUser.get(currentUser.id);
    if (myHotposts && myHotposts.posts.length > 0) {
        openMyHotpostsModal(myHotposts.posts);
    } else {
        openCameraModal();
    }
}

function openMyHotpostsModal(posts) {
    const list = document.getElementById('my-hotposts-list');
    list.innerHTML = posts.map(post => {
        const viewCount = post.hotpost_views[0]?.count || 0;
        return `
            <div class="flex items-center gap-4 p-3 bg-gray-50 dark:bg-neutral-800/50 rounded-2xl border border-gray-200 dark:border-neutral-800">
                <img src="${post.media_url}" class="w-14 h-14 rounded-xl object-cover">
                <div class="flex-1">
                    <p class="text-sm font-bold text-gray-800 dark:text-gray-100 line-clamp-1">${post.caption || 'No Caption'}</p>
                    <p class="text-xs text-gray-500 dark:text-gray-400">${timeAgo(post.created_at)}</p>
                </div>
                <div class="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
                    <span class="material-symbols-outlined text-[18px]">visibility</span>
                    <span class="text-sm font-bold">${viewCount}</span>
                </div>
            </div>
        `;
    }).join('');

    document.getElementById('modal-my-hotposts').classList.replace('hidden', 'flex');
}

function closeMyHotpostsModal() {
    document.getElementById('modal-my-hotposts').classList.replace('flex', 'hidden');
}

function closeCreateHotpostModal() {
    document.getElementById('modal-create-hotpost').classList.replace('flex', 'hidden');
    document.getElementById('hotpost-caption').value = '';
    currentPhotoBlob = null;
    // Clean up the blob URL to prevent memory leaks
    const preview = document.getElementById('hotpost-preview');
    if (preview.src.startsWith('blob:')) {
        URL.revokeObjectURL(preview.src);
    }
}