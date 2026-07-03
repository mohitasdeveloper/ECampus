import { supabase } from './supabase.js';
import { showToast } from './ui.js';
import { timeAgo } from './utils.js';
import { CLOUDINARY_CLOUD_NAME, CLOUDINARY_HOTPOSTS_PRESET } from './config.js';

let hotpostsByUser = new Map();
let currentUser = null;
let currentPhotoBlob = null;

let currentCameraStream = null;
let currentFacingMode = 'environment'; // 'environment' for back camera, 'user' for front

const CLOUDINARY_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;

export function initHotposts(user) {
    currentUser = user;
    setupEventListeners();
    fetchHotposts();
}

function setupEventListeners() {
    document.getElementById('create-hotpost-btn').addEventListener('click', openCameraModal);
    document.getElementById('close-hotpost-camera-btn').addEventListener('click', closeCameraModal);
    document.getElementById('switch-hotpost-camera-btn').addEventListener('click', switchCamera);
    document.getElementById('capture-hotpost-btn').addEventListener('click', capturePhoto);

    document.getElementById('retake-hotpost-btn').addEventListener('click', openCameraModal);
    document.getElementById('close-hotpost-create-btn').addEventListener('click', closeCreateHotpostModal);
    document.getElementById('submit-hotpost-btn').addEventListener('click', submitHotpost);
    document.getElementById('close-hotpost-viewer-btn').addEventListener('click', closeHotpostViewer);
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

function closeCreateHotpostModal() {
    document.getElementById('modal-create-hotpost').classList.replace('flex', 'hidden');
    document.getElementById('hotpost-caption').value = '';
    currentPhotoBlob = null;
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
        formData.append('file', currentPhotoBlob, 'hotpost.jpg');
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
            users ( id, full_name, profile_img_url )
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
    postIndex: 0,
    timeoutId: null,
};

function openHotpostViewer(userId) {
    const userData = hotpostsByUser.get(userId);
    if (!userData || userData.posts.length === 0) return;

    currentViewerState.userId = userId;
    currentViewerState.postIndex = 0;

    document.getElementById('modal-view-hotpost').classList.replace('hidden', 'flex');
    showCurrentHotpost();
}

function closeHotpostViewer() {
    document.getElementById('modal-view-hotpost').classList.replace('flex', 'hidden');
    clearTimeout(currentViewerState.timeoutId);
}

function showCurrentHotpost() {
    const userData = hotpostsByUser.get(currentViewerState.userId);
    const post = userData.posts[currentViewerState.postIndex];

    // Update UI
    document.getElementById('hotpost-viewer-avatar').src = userData.user.profile_img_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.user.full_name)}&background=e1e3e4`;
    document.getElementById('hotpost-viewer-name').textContent = userData.user.full_name;
    document.getElementById('hotpost-viewer-time').textContent = timeAgo(post.created_at);
    document.getElementById('hotpost-viewer-image').src = post.media_url;
    document.getElementById('hotpost-viewer-caption').textContent = post.caption || '';
    document.getElementById('hotpost-viewer-caption').classList.toggle('hidden', !post.caption);

    // Auto-advance after 5 seconds
    clearTimeout(currentViewerState.timeoutId);
    currentViewerState.timeoutId = setTimeout(() => {
        // Logic to move to next post or close
        closeHotpostViewer(); // Simple for now
    }, 5000);
}