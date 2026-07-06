import { supabase } from './supabase.js';
import { showToast } from './ui.js';
import { timeAgo } from './utils.js';
import { CLOUDINARY_CLOUD_NAME, CLOUDINARY_HOTPOSTS_PRESET } from './config.js';

// ==========================================
// STATE MANAGEMENT
// ==========================================
let hotpostsByUser = new Map();
let currentUser = null;
let sessionViewedPostIds = new Set();

// Camera & Image
let currentCameraStream = null;
let currentFacingMode = 'environment';
let currentPhotoBlob = null;
let baseImageObj = null; 

// Swipe Filters
const FILTER_LIST = [
    { name: 'NORMAL', css: 'none' },
    { name: 'VIVID', css: 'saturate(1.6) contrast(1.1)' },
    { name: 'WARM', css: 'sepia(0.4) saturate(1.2) contrast(1.1)' },
    { name: 'COOL', css: 'hue-rotate(180deg) saturate(1.2)' },
    { name: 'B&W', css: 'grayscale(1) contrast(1.2)' }
];
let currentFilterIndex = 0;

// Editor: Text Tool
let textContent = '';
let textPosX = 0.5; // Normalized center
let textPosY = 0.5;
let textScale = 1.0;
let initialPinchDist = 0;
let initialTextScale = 1.0;

// Editor: Doodle Tool
let isDrawMode = false;
let isDrawing = false;
let currentDoodleColor = '#FFFFFF'; 
let doodlePaths = []; 
let currentPath = [];

// Viewer Physics
let currentViewerState = {
    userId: null, userOrder: [], userIndex: -1, postIndex: 0,
    storyTimer: null, storyDuration: 5000, animationStartTime: 0, remainingDuration: 0,
};

const CLOUDINARY_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;

// ==========================================
// INITIALIZATION
// ==========================================
export function initHotposts(user) {
    currentUser = user;
    setupEventListeners();
    fetchHotposts();
}

function setupEventListeners() {
    // Camera Top Controls
    document.getElementById('close-hotpost-camera-btn')?.addEventListener('click', closeCameraModal);
    document.getElementById('switch-hotpost-camera-btn')?.addEventListener('click', switchCamera);
    document.getElementById('capture-hotpost-btn')?.addEventListener('click', capturePhoto);
    document.getElementById('retake-hotpost-btn')?.addEventListener('click', resetCameraUI);
    document.getElementById('submit-hotpost-btn')?.addEventListener('click', submitHotpost);

    // Editor Tools Activation
    document.getElementById('add-text-hotpost-btn')?.addEventListener('click', activateTextTool);
    document.getElementById('doodle-hotpost-btn')?.addEventListener('click', toggleDrawMode);
    document.getElementById('undo-doodle-btn')?.addEventListener('click', undoLastDoodle);
    
    document.querySelectorAll('.doodle-color-btn').forEach(btn => {
        btn.addEventListener('click', (e) => setDoodleColor(e.target.dataset.color));
    });

    // In-UI Text Editor Overlay actions
    document.getElementById('cancel-text-btn')?.addEventListener('click', () => {
        document.getElementById('hotpost-text-editor-overlay').classList.replace('flex', 'hidden');
    });
    document.getElementById('done-text-btn')?.addEventListener('click', saveTextFromUI);

    // Initialize Touch Engines
    setupEditorTouchPhysics();
    setupViewerTouchPhysics();

    // Viewer Navigation
    document.getElementById('close-hotpost-viewer-btn')?.addEventListener('click', closeHotpostViewer);
    document.getElementById('hotpost-nav-next')?.addEventListener('click', nextStory);
    document.getElementById('hotpost-nav-prev')?.addEventListener('click', prevStory);
    document.getElementById('hotpost-reply-btn')?.addEventListener('click', handleReplyToHotpost);
    document.getElementById('hotpost-like-btn')?.addEventListener('click', handleLikeHotpost);

    const navNext = document.getElementById('hotpost-nav-next');
    const navPrev = document.getElementById('hotpost-nav-prev');
    const replyInput = document.getElementById('hotpost-reply-input');
    
    [navNext, navPrev].forEach(el => {
        if (el) {
            el.addEventListener('pointerdown', pauseStory);
            el.addEventListener('pointerup', resumeStory);
            el.addEventListener('pointerleave', resumeStory);
        }
    });
    
    replyInput?.addEventListener('focus', pauseStory);
    replyInput?.addEventListener('blur', resumeStory);

    // Activity Panel (Self View)
    document.getElementById('details-tab-viewers')?.addEventListener('click', () => switchDetailsTab('viewers'));
    document.getElementById('details-tab-likes')?.addEventListener('click', () => switchDetailsTab('likes'));
    document.getElementById('details-tab-replies')?.addEventListener('click', () => switchDetailsTab('replies'));
    
    // Native Confirm Action
    document.getElementById('delete-hotpost-action-btn')?.addEventListener('click', () => {
        showCustomConfirm("Delete Hotpost?", "This will permanently remove this post from your story.", executeDeleteHotpost);
    });
}

function showCustomConfirm(title, message, onConfirm) {
    pauseStory();
    const modal = document.getElementById('modal-confirm-action');
    if(!modal) return;
    
    document.getElementById('confirm-action-title').textContent = title;
    document.getElementById('confirm-action-message').textContent = message;
    
    modal.classList.replace('hidden', 'flex');
    
    const confirmBtn = document.getElementById('confirm-action-yes');
    const cancelBtn = document.getElementById('confirm-action-no');
    
    // Clone to clear old event listeners
    const newConfirmBtn = confirmBtn.cloneNode(true);
    const newCancelBtn = cancelBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
    
    newCancelBtn.addEventListener('click', () => {
        modal.classList.replace('flex', 'hidden');
        resumeStory();
    });
    
    newConfirmBtn.addEventListener('click', () => {
        modal.classList.replace('flex', 'hidden');
        onConfirm();
    });
}

// ==========================================
// CAMERA ENGINE
// ==========================================
async function openCameraModal() {
    const modal = document.getElementById('modal-hotpost-camera');
    const video = document.getElementById('hotpost-camera-feed');
    modal.classList.replace('hidden', 'flex');
    resetCameraUI();

    if (currentCameraStream) currentCameraStream.getTracks().forEach(track => track.stop());

    try {
        currentCameraStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: currentFacingMode, width: { ideal: 1920 }, height: { ideal: 1080 } }
        });
        video.srcObject = currentCameraStream;
        video.style.transform = currentFacingMode === 'user' ? 'scaleX(-1)' : 'none';
    } catch (err) {
        showToast('Camera access denied.', 'error');
        closeCameraModal();
    }
}

function closeCameraModal() {
    const modal = document.getElementById('modal-hotpost-camera');
    if (currentCameraStream) currentCameraStream.getTracks().forEach(track => track.stop());
    modal.classList.replace('flex', 'hidden');
}

function switchCamera() {
    currentFacingMode = currentFacingMode === 'environment' ? 'user' : 'environment';
    openCameraModal();
}

function capturePhoto() {
    const video = document.getElementById('hotpost-camera-feed');
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');

    if (currentFacingMode === 'user') {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(blob => {
        currentPhotoBlob = blob;
        baseImageObj = new Image();
        baseImageObj.onload = () => {
            document.getElementById('hotpost-preview-img').src = URL.createObjectURL(blob);
            showPreviewUI();
            initDoodleCanvas(); // Must be called after UI is shown to get correct dimensions
        };
        baseImageObj.src = URL.createObjectURL(blob);
    }, 'image/jpeg', 0.9);
}

function resetCameraUI() {
    document.getElementById('hotpost-camera-feed').classList.remove('hidden');
    document.getElementById('hotpost-preview-container').classList.add('hidden');
    document.getElementById('capture-ui').classList.remove('hidden');
    document.getElementById('preview-ui').classList.add('hidden');
    document.getElementById('switch-hotpost-camera-btn').classList.remove('hidden');
    document.getElementById('editor-tools-container').classList.add('hidden');
    
    currentFilterIndex = 0;
    document.getElementById('hotpost-preview-img').style.filter = FILTER_LIST[0].css;
    isDrawMode = false;
    doodlePaths = [];
    document.getElementById('doodle-color-picker').classList.add('hidden');
    document.getElementById('doodle-hotpost-btn').classList.remove('bg-white', 'text-black');
    document.getElementById('doodle-hotpost-btn').classList.add('bg-black/40', 'text-white');
    
    const textLayer = document.getElementById('hotpost-draggable-text');
    textLayer.textContent = '';
    textLayer.classList.add('hidden');
    textContent = '';
    textPosX = 0.5;
    textPosY = 0.5;
    textScale = 1.0;
}

function showPreviewUI() {
    document.getElementById('hotpost-camera-feed').classList.add('hidden');
    document.getElementById('hotpost-preview-container').classList.remove('hidden');
    document.getElementById('capture-ui').classList.add('hidden');
    document.getElementById('preview-ui').classList.remove('hidden');
    document.getElementById('preview-ui').classList.add('flex');
    document.getElementById('switch-hotpost-camera-btn').classList.add('hidden');
    document.getElementById('editor-tools-container').classList.remove('hidden');
    document.getElementById('editor-tools-container').classList.add('flex');
}


// ==========================================
// EDITOR: TEXT & DOODLE TOOLS
// ==========================================

// TEXT
function activateTextTool() {
    const overlay = document.getElementById('hotpost-text-editor-overlay');
    const textarea = document.getElementById('hotpost-in-ui-textarea');
    
    overlay.classList.replace('hidden', 'flex');
    textarea.value = textContent; 
    setTimeout(() => textarea.focus(), 50); // Small delay for iOS keyboard
}

function saveTextFromUI() {
    const textarea = document.getElementById('hotpost-in-ui-textarea');
    textContent = textarea.value.trim();
    
    const textLayer = document.getElementById('hotpost-draggable-text');
    
    if (textContent) {
        textLayer.textContent = textContent;
        textLayer.classList.remove('hidden');
        if(!textLayer.style.left) {
            textPosX = 0.5; textPosY = 0.5; textScale = 1.0; // Default center
        }
        updateTextPosition();
    } else {
        textLayer.classList.add('hidden');
    }
    
    document.getElementById('hotpost-text-editor-overlay').classList.replace('flex', 'hidden');
}

function updateTextPosition() {
    const textLayer = document.getElementById('hotpost-draggable-text');
    textLayer.style.left = `${textPosX * 100}%`;
    textLayer.style.top = `${textPosY * 100}%`;
    textLayer.style.transform = `translate(-50%, -50%) scale(${textScale})`;
}

// DOODLE
function initDoodleCanvas() {
    setTimeout(() => {
        const canvas = document.getElementById('hotpost-doodle-canvas');
        const container = document.getElementById('hotpost-preview-container');
        // Match physical screen space exactly
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }, 100);
}

function toggleDrawMode() {
    isDrawMode = !isDrawMode;
    const colorPicker = document.getElementById('doodle-color-picker');
    const penBtn = document.getElementById('doodle-hotpost-btn');
    
    if (isDrawMode) {
        colorPicker.classList.replace('hidden', 'flex');
        penBtn.classList.replace('bg-black/40', 'bg-white');
        penBtn.classList.replace('text-white', 'text-black');
    } else {
        colorPicker.classList.replace('flex', 'hidden');
        penBtn.classList.replace('bg-white', 'bg-black/40');
        penBtn.classList.replace('text-black', 'text-white');
    }
}

function setDoodleColor(color) {
    currentDoodleColor = color;
    document.querySelectorAll('.doodle-color-btn').forEach(btn => btn.classList.remove('scale-125'));
    const activeBtn = document.querySelector(`.doodle-color-btn[data-color="${color}"]`);
    if(activeBtn) activeBtn.classList.add('scale-125');
}

function undoLastDoodle() {
    if (doodlePaths.length > 0) {
        doodlePaths.pop();
        redrawDoodleCanvas();
    }
}

function redrawDoodleCanvas() {
    const canvas = document.getElementById('hotpost-doodle-canvas');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.lineWidth = 6;

    doodlePaths.forEach(pathObj => {
        ctx.strokeStyle = pathObj.color;
        ctx.shadowColor = pathObj.color;
        ctx.shadowBlur = 4;
        ctx.beginPath();
        pathObj.points.forEach((point, index) => {
            if (index === 0) ctx.moveTo(point.x, point.y);
            else ctx.lineTo(point.x, point.y);
        });
        ctx.stroke();
    });
}


// ==========================================
// UNIFIED TOUCH PHYSICS (EDITOR)
// ==========================================
function setupEditorTouchPhysics() {
    const container = document.getElementById('hotpost-preview-container');
    const textLayer = document.getElementById('hotpost-draggable-text');
    
    let touchMode = 'idle'; // modes: 'draw', 'drag_text', 'zoom_text', 'swipe'
    let startX = 0, startY = 0;

    const getPinchDistance = (touches) => {
        return Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);
    };

    container.addEventListener('touchstart', (e) => {
        // 2-Fingers: Pinch to Zoom Text
        if (e.touches.length === 2 && textContent && !isDrawMode) {
            touchMode = 'zoom_text';
            initialPinchDist = getPinchDistance(e.touches);
            initialTextScale = textScale;
            return;
        }

        if (e.touches.length > 1) return; // Prevent chaos

        // 1-Finger Interactions
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;

        // Check if tapping precisely on the text element
        if (e.target === textLayer && !isDrawMode) {
            touchMode = 'drag_text';
        } 
        else if (isDrawMode) {
            touchMode = 'draw';
            isDrawing = true;
            const rect = container.getBoundingClientRect();
            currentPath = [{ x: startX - rect.left, y: startY - rect.top }];
        } 
        else {
            touchMode = 'swipe';
        }
    }, { passive: false });

    container.addEventListener('touchmove', (e) => {
        if (e.cancelable) e.preventDefault(); // LOCK THE SCREEN
        
        if (touchMode === 'zoom_text' && e.touches.length === 2) {
            const currentDist = getPinchDistance(e.touches);
            const scaleChange = currentDist / initialPinchDist;
            textScale = Math.max(0.5, Math.min(4.0, initialTextScale * scaleChange));
            updateTextPosition();
            return;
        }

        if (e.touches.length > 1) return;

        const currentX = e.touches[0].clientX;
        const currentY = e.touches[0].clientY;
        const rect = container.getBoundingClientRect();

        if (touchMode === 'drag_text') {
            textPosX = (currentX - rect.left) / rect.width;
            textPosY = (currentY - rect.top) / rect.height;
            // Clamp within bounds
            textPosX = Math.max(0.05, Math.min(0.95, textPosX));
            textPosY = Math.max(0.05, Math.min(0.95, textPosY));
            updateTextPosition();
        } 
        else if (touchMode === 'draw' && isDrawing) {
            currentPath.push({ x: currentX - rect.left, y: currentY - rect.top });
            
            const canvas = document.getElementById('hotpost-doodle-canvas');
            const ctx = canvas.getContext('2d');
            ctx.lineJoin = "round"; ctx.lineCap = "round"; ctx.lineWidth = 6;
            ctx.strokeStyle = currentDoodleColor; ctx.shadowColor = currentDoodleColor; ctx.shadowBlur = 4;
            
            ctx.beginPath();
            const prev = currentPath[currentPath.length - 2];
            const curr = currentPath[currentPath.length - 1];
            ctx.moveTo(prev.x, prev.y);
            ctx.lineTo(curr.x, curr.y);
            ctx.stroke();
        }
    }, { passive: false });

    container.addEventListener('touchend', (e) => {
        if (touchMode === 'draw' && isDrawing) {
            isDrawing = false;
            if (currentPath.length > 1) doodlePaths.push({ color: currentDoodleColor, points: [...currentPath] });
            currentPath = [];
        } 
        else if (touchMode === 'swipe' && !isDrawMode) {
            const endX = e.changedTouches[0].clientX;
            const deltaX = endX - startX;

            if (Math.abs(deltaX) > 60) {
                if (deltaX < 0) currentFilterIndex = (currentFilterIndex + 1) % FILTER_LIST.length; 
                else currentFilterIndex = (currentFilterIndex - 1 + FILTER_LIST.length) % FILTER_LIST.length; 
                
                const filter = FILTER_LIST[currentFilterIndex];
                document.getElementById('hotpost-preview-img').style.filter = filter.css;
                showFilterToast(filter.name);
            }
        }
        
        if (e.touches.length === 0) touchMode = 'idle';
    }, { passive: true });
}

function showFilterToast(name) {
    const toast = document.getElementById('filter-name-toast');
    toast.textContent = name;
    toast.classList.remove('hidden');
    toast.style.animation = 'none';
    toast.offsetHeight; 
    toast.style.animation = 'fadeOutUp 1s ease-out forwards';
}


// ==========================================
// THE BAKE COMPILER
// ==========================================
async function submitHotpost() {
    if (!currentPhotoBlob) return;

    const visibilityBtn = document.getElementById('hotpost-send-visibility');
    const visibility = visibilityBtn ? visibilityBtn.dataset.val : 'everyone';
    const btn = document.getElementById('submit-hotpost-btn');
    const originalBtnInner = btn.innerHTML;
    
    btn.disabled = true;
    btn.innerHTML = `<span class="material-symbols-outlined animate-spin text-white">progress_activity</span>`;

    try {
        const getCompiledBlob = () => new Promise((resolve) => {
            const bakeCanvas = document.createElement('canvas');
            bakeCanvas.width = baseImageObj.width;
            bakeCanvas.height = baseImageObj.height;
            const ctx = bakeCanvas.getContext('2d');

            // 1. Draw Base & Filter
            if (FILTER_LIST[currentFilterIndex].css !== 'none') {
                ctx.filter = FILTER_LIST[currentFilterIndex].css;
            }
            ctx.drawImage(baseImageObj, 0, 0, bakeCanvas.width, bakeCanvas.height);
            ctx.filter = 'none'; 

            // 2. Draw Doodles
            const doodleCanvas = document.getElementById('hotpost-doodle-canvas');
            if (doodlePaths.length > 0) {
                // Doodles map 1:1 because they were drawn relatively
                ctx.drawImage(doodleCanvas, 0, 0, bakeCanvas.width, bakeCanvas.height);
            }

            // 3. Draw Text (Apply Pinch-to-Zoom Scaling)
            if (textContent) {
                const baseFontSize = Math.floor(bakeCanvas.width * 0.08); 
                const finalFontSize = Math.floor(baseFontSize * textScale); 
                
                ctx.font = `800 ${finalFontSize}px Inter, sans-serif`;
                ctx.fillStyle = "white";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.shadowColor = "rgba(0,0,0,0.9)";
                ctx.shadowBlur = 20;
                
                // Decode percentages back to absolute pixels
                const finalX = bakeCanvas.width * textPosX;
                const finalY = bakeCanvas.height * textPosY;
                ctx.fillText(textContent, finalX, finalY);
            }

            bakeCanvas.toBlob(resolve, 'image/jpeg', 0.9);
        });

        const finalBlob = await getCompiledBlob();

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

        showToast('Hotpost published!', 'success');
        closeCameraModal();
        fetchHotposts(); 

    } catch (error) {
        showToast('Failed to publish hotpost.', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalBtnInner;
    }
}

window.toggleVisibilitySetting = function() {
    const btn = document.getElementById('hotpost-send-visibility');
    const text = document.getElementById('visibility-text');
    const icon = document.getElementById('visibility-icon');
    
    if(btn.dataset.val === 'everyone') {
        btn.dataset.val = 'connections';
        text.textContent = 'Connections';
        icon.textContent = 'stars';
        btn.classList.replace('bg-black/50', 'bg-green-500/80');
    } else {
        btn.dataset.val = 'everyone';
        text.textContent = 'Everyone';
        icon.textContent = 'public';
        btn.classList.replace('bg-green-500/80', 'bg-black/50');
    }
}


// ==========================================
// DASHBOARD VIEW & CIRCLES
// ==========================================
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

    const unviewedData = data.filter(post => {
        if (post.user_id === currentUser.id) return true; 
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

    // 1. Permanent "Add Story" Button
    const addCircle = document.createElement('div');
    addCircle.className = 'hotpost-circle flex flex-col items-center gap-1.5 shrink-0 cursor-pointer active:scale-95 transition-transform relative z-20';
    addCircle.innerHTML = `
        <div class="w-[68px] h-[68px] rounded-full p-[2.5px] bg-transparent shadow-sm relative">
            <div class="w-full h-full rounded-full border-2 border-surface-variant dark:border-neutral-700 overflow-hidden bg-gray-100 dark:bg-neutral-800">
                <img src="${currentUser.profile_img_url}" class="w-full h-full object-cover opacity-60">
            </div>
            <div class="absolute bottom-0 right-0 w-6 h-6 bg-primary text-white rounded-full border-[2.5px] border-white dark:border-[#121212] flex items-center justify-center z-30 shadow-sm">
                <span class="material-symbols-outlined text-[14px] font-bold">add</span>
            </div>
        </div>
        <span class="text-[11px] font-bold text-gray-900 dark:text-gray-100">Add Story</span>
    `;
    addCircle.addEventListener('click', openCameraModal);
    container.appendChild(addCircle);

    // 2. "Your Story" Ring
    const myData = hotpostsByUser.get(currentUser.id);
    if (myData && myData.posts.length > 0) {
        const myCircle = document.createElement('div');
        myCircle.className = 'hotpost-circle flex flex-col items-center gap-1.5 shrink-0 cursor-pointer active:scale-95 transition-transform relative z-10';
        const ringClass = myData.viewed ? 'from-gray-300 to-gray-400' : 'from-gray-400 to-gray-600';
        myCircle.innerHTML = `
            <div class="w-[68px] h-[68px] rounded-full p-[2.5px] bg-gradient-to-tr ${ringClass} shadow-sm relative">
                <div class="w-full h-full rounded-full border-2 border-white dark:border-neutral-900 overflow-hidden bg-gray-100 dark:bg-neutral-800">
                    <img src="${currentUser.profile_img_url}" class="w-full h-full object-cover">
                </div>
            </div>
            <span class="text-[11px] font-bold text-gray-900 dark:text-gray-100">Your Story</span>
        `;
        myCircle.addEventListener('click', () => openHotpostViewer(currentUser.id));
        container.appendChild(myCircle);
    }

    // 3. Other Users
    const otherUserIds = Array.from(hotpostsByUser.keys()).filter(id => id !== currentUser.id);
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
                    <img src="${user.profile_img_url}" class="w-full h-full object-cover">
                </div>
            </div>
            <span class="text-[11px] font-bold text-gray-900 dark:text-gray-100">${user.full_name.split(' ')[0]}</span>
        `;
        circle.addEventListener('click', () => openHotpostViewer(userId));
        container.appendChild(circle);
    });
}


// ==========================================
// VIEWER ENGINES & PHYSICS
// ==========================================
function setupViewerTouchPhysics() {
    const viewer = document.getElementById('modal-view-hotpost');
    const activityContent = document.getElementById('modal-story-details-sheet');
    
    // Separated variables so Swipe Up and Drag Down don't conflict
    let viewerStartY = 0;
    let panelStartY = 0;
    let isDraggingPanel = false;
    
    // VIEWER TOUCH (Swipe Up/Down on Story)
    viewer?.addEventListener('touchstart', (e) => {
        viewerStartY = e.touches[0].clientY;
    }, { passive: true });

    viewer?.addEventListener('touchend', (e) => {
        // Stop viewer swipe if the activity panel is already open
        if (!document.getElementById('modal-story-details').classList.contains('hidden')) return;

        const deltaY = e.changedTouches[0].clientY - viewerStartY;
        if (e.target.closest('button') || e.target.closest('input')) return;

        // Increased sensitivity: -40px for a quick swipe up, 80px for swipe down
        if (deltaY < -40 && currentViewerState.userId === currentUser.id) {
            openActivityPanel();
        } else if (deltaY > 80) {
            closeHotpostViewer();
        }
    }, { passive: true });

    // ACTIVITY PANEL PHYSICS (Drag Sheet Down)
    activityContent?.addEventListener('touchstart', (e) => {
        const scrollArea = e.target.closest('.overflow-y-auto');
        if (scrollArea && scrollArea.scrollTop > 0) {
            isDraggingPanel = false; 
        } else {
            panelStartY = e.touches[0].clientY;
            isDraggingPanel = true;
            activityContent.style.transition = 'none'; 
            
            const viewerContent = document.getElementById('hotpost-viewer-content');
            if(viewerContent) viewerContent.style.transition = 'none';
        }
    }, { passive: true });

    activityContent?.addEventListener('touchmove', (e) => {
        if (!isDraggingPanel) return;
        const deltaY = e.touches[0].clientY - panelStartY;
        
        if (deltaY > 0) {
            activityContent.style.transform = `translateY(${deltaY}px)`;
            const progress = deltaY / window.innerHeight;
            const viewerContent = document.getElementById('hotpost-viewer-content');
            if(viewerContent) {
                viewerContent.style.transform = `scale(${0.92 + (0.08 * progress)}) translateY(${2 - (2 * progress)}vh)`;
                viewerContent.style.opacity = 0.4 + (0.6 * progress);
            }
        }
        if(e.cancelable) e.preventDefault();
    }, { passive: false });

    activityContent?.addEventListener('touchend', (e) => {
        if (!isDraggingPanel) return;
        isDraggingPanel = false;
        
        activityContent.style.transition = 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)'; 
        const viewerContent = document.getElementById('hotpost-viewer-content');
        
        if(viewerContent) {
            viewerContent.style.transition = 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.4s ease, border-radius 0.4s ease';
        }
        
        const deltaY = e.changedTouches[0].clientY - panelStartY;
        
        if (deltaY > 100) {
            closeActivityPanel();
        } else {
            // Snap back to top and re-apply pushed-back CSS state
            activityContent.style.transform = `translateY(0px)`;
            if (viewerContent) {
                viewerContent.style.transform = '';
                viewerContent.style.opacity = '';
                viewerContent.classList.add('viewer-pushed-back');
            }
        }
    }, { passive: true });
}

function openHotpostViewer(userId) {
    const userData = hotpostsByUser.get(userId);
    if (!userData || userData.posts.length === 0) return;

    const allUserIds = Array.from(hotpostsByUser.keys())
        .filter(id => id !== currentUser.id)
        .sort((a, b) => (hotpostsByUser.get(a).viewed || false) - (hotpostsByUser.get(b).viewed || false));

    if (userId === currentUser.id) allUserIds.unshift(currentUser.id);

    const clickedUserIndex = allUserIds.indexOf(userId);
    currentViewerState.userOrder = [
        ...allUserIds.slice(clickedUserIndex),
        ...allUserIds.slice(0, clickedUserIndex)
    ];

    document.getElementById('modal-view-hotpost').classList.replace('hidden', 'flex');
    playUserStories(0); 
}

function processStoryDisappear() {
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
    
    // FAILSAFE: Wipe all 3D scaling and inline styles when closing the viewer completely
    const viewerContent = document.getElementById('hotpost-viewer-content');
    if (viewerContent) {
        viewerContent.style.transform = '';
        viewerContent.style.opacity = '';
        viewerContent.style.transition = '';
        viewerContent.classList.remove('viewer-pushed-back');
    }
    
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

    const progressContainer = document.getElementById('hotpost-progress-bars');
    progressContainer.innerHTML = userData.posts.map((p, index) => `
        <div class="flex-1 bg-white/30 rounded-full overflow-hidden">
            <div class="progress-bar-inner h-full bg-white rounded-full ${index < postIndex ? 'w-full' : ''}" data-index="${index}"></div>
        </div>
    `).join('');

    const isMyStory = currentViewerState.userId === currentUser.id;
    document.getElementById('hotpost-reply-container').style.display = isMyStory ? 'none' : 'flex';
    document.getElementById('hotpost-activity-btn').style.display = isMyStory ? 'flex' : 'none';
    
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

    const likeBtnIcon = document.querySelector('#hotpost-like-btn span');
    if(likeBtnIcon) {
        likeBtnIcon.style.fontVariationSettings = "'FILL' 0";
        likeBtnIcon.classList.remove('text-red-500');
    }

    document.getElementById('hotpost-viewer-avatar').src = userData.user.profile_img_url;
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
        processStoryDisappear();
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
    if (!document.getElementById('modal-story-details').classList.contains('hidden')) return; 

    const activeBar = document.querySelector('#hotpost-progress-bars .progress-bar-inner.active');
    if (activeBar) activeBar.style.animationPlayState = 'running';
    
    currentViewerState.animationStartTime = performance.now(); 
    clearTimeout(currentViewerState.storyTimer);
    currentViewerState.storyTimer = setTimeout(nextStory, currentViewerState.remainingDuration);
}

// ==========================================
// ENGAGEMENT & ACTIVITY
// ==========================================
async function recordView(hotpostId) {
    if (currentViewerState.userId === currentUser.id) return;
    if (sessionViewedPostIds.has(hotpostId)) return;
    const { error } = await supabase.from('hotpost_views').insert({ hotpost_id: hotpostId, viewer_id: currentUser.id });
    if (!error) sessionViewedPostIds.add(hotpostId); 
}

async function handleLikeHotpost(event) {
    event.stopPropagation(); 
    const icon = event.currentTarget.querySelector('span');
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
    const originalHtml = replyBtn.innerHTML;

    replyBtn.disabled = true;
    replyBtn.innerHTML = `<span class="material-symbols-outlined animate-spin text-white">progress_activity</span>`;

    const { error } = await supabase.from('hotpost_replies').insert({
        hotpost_id: post.id, replier_id: currentUser.id, author_id: userData.user.id, content: content
    });

    if (error) {
        showToast('Failed to send reply.', 'error');
        replyBtn.disabled = false;
        replyBtn.innerHTML = originalHtml;
    } else {
        showToast('Reply sent!', 'success');
        input.value = '';
        replyBtn.classList.add('!bg-green-500', 'border-transparent');
        replyBtn.innerHTML = `<span class="material-symbols-outlined text-white">check</span>`;
        setTimeout(() => {
            replyBtn.disabled = false;
            replyBtn.classList.remove('!bg-green-500', 'border-transparent');
            replyBtn.innerHTML = originalHtml;
            resumeStory();
        }, 1500);
    }
}

function openActivityPanel() {
    pauseStory();
    const modal = document.getElementById('modal-story-details');
    const sheet = document.getElementById('modal-story-details-sheet');
    const viewerContent = document.getElementById('hotpost-viewer-content');
    
    // Ensure perfectly clean state before pushing back
    if (viewerContent) {
        viewerContent.style.transition = 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.4s ease, border-radius 0.4s ease';
        viewerContent.style.transform = '';
        viewerContent.style.opacity = '';
        viewerContent.classList.add('viewer-pushed-back');
    }

    modal.classList.replace('hidden', 'flex');
    setTimeout(() => sheet.style.transform = `translateY(0px)`, 10);

    const post = hotpostsByUser.get(currentUser.id).posts[currentViewerState.postIndex];
    switchDetailsTab('viewers');
    fetchStoryViewers(post.id);
    fetchStoryLikes(post.id);
    fetchStoryReplies(post.id);
}

function closeActivityPanel() {
    const modal = document.getElementById('modal-story-details');
    const sheet = document.getElementById('modal-story-details-sheet');
    const viewerContent = document.getElementById('hotpost-viewer-content');
    
    sheet.style.transform = `translateY(100%)`;
    
    if (viewerContent) {
        // Restore smooth transition and WIPE inline dragging styles
        viewerContent.style.transition = 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.4s ease, border-radius 0.4s ease';
        viewerContent.style.transform = '';
        viewerContent.style.opacity = '';
        viewerContent.classList.remove('viewer-pushed-back');
    }

    setTimeout(() => {
        modal.classList.replace('flex', 'hidden');
        resumeStory();
    }, 400); 
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
    list.innerHTML = `<p class="text-sm italic text-center py-8">Loading...</p>`;
    try {
        const { data, error } = await supabase.from('hotpost_views').select('viewed_at, users!hotpost_views_viewer_id_fkey(full_name, profile_img_url)').eq('hotpost_id', hotpostId).eq('is_deleted', false).order('viewed_at', { ascending: false });
        if (error) throw error;
        document.getElementById('details-tab-viewers').innerHTML = `<span class="material-symbols-outlined text-[16px] mr-1 align-middle">visibility</span> ${data.length}`;
        if (data.length === 0) { list.innerHTML = `<p class="text-sm italic text-center py-8">No views yet.</p>`; return; }
        list.innerHTML = data.map(v => `<div class="flex items-center gap-3 p-3 bg-surface-variant/20 dark:bg-neutral-800/50 rounded-2xl"><img src="${v.users.profile_img_url}" class="w-10 h-10 rounded-full object-cover"><div class="flex-1"><p class="text-sm font-bold text-on-surface dark:text-gray-100">${v.users.full_name}</p></div><p class="text-xs text-on-surface-variant">${timeAgo(v.viewed_at)}</p></div>`).join('');
    } catch (e) { list.innerHTML = `<p class="text-sm text-center py-8 text-error">Failed.</p>`; }
}

async function fetchStoryLikes(hotpostId) {
    const list = document.getElementById('hotpost-likes-list');
    list.innerHTML = `<p class="text-sm italic text-center py-8">Loading...</p>`;
    try {
        const { data, error } = await supabase.from('hotpost_likes').select('created_at, users!hotpost_likes_user_id_fkey(full_name, profile_img_url)').eq('hotpost_id', hotpostId).eq('is_deleted', false).order('created_at', { ascending: false });
        if (error) throw error;
        document.getElementById('details-tab-likes').innerHTML = `<span class="material-symbols-outlined text-[16px] mr-1 align-middle">favorite</span> ${data.length}`;
        if (data.length === 0) { list.innerHTML = `<p class="text-sm italic text-center py-8">No likes yet.</p>`; return; }
        list.innerHTML = data.map(l => `<div class="flex items-center gap-3 p-3 bg-red-500/5 dark:bg-red-500/10 rounded-2xl border border-red-500/10"><img src="${l.users.profile_img_url}" class="w-10 h-10 rounded-full object-cover"><div class="flex-1"><p class="text-sm font-bold text-on-surface dark:text-gray-100">${l.users.full_name}</p></div><span class="material-symbols-outlined text-red-500" style="font-variation-settings: 'FILL' 1;">favorite</span></div>`).join('');
    } catch (e) { list.innerHTML = `<p class="text-sm text-center py-8 text-error">Failed.</p>`; }
}

async function fetchStoryReplies(hotpostId) {
    const list = document.getElementById('hotpost-replies-list');
    list.innerHTML = `<p class="text-sm italic text-center py-8">Loading...</p>`;
    try {
        const { data, error } = await supabase.from('hotpost_replies').select('created_at, content, users!hotpost_replies_replier_id_fkey(full_name, profile_img_url)').eq('hotpost_id', hotpostId).eq('is_deleted', false).order('created_at', { ascending: false });
        if (error) throw error;
        document.getElementById('details-tab-replies').innerHTML = `<span class="material-symbols-outlined text-[16px] mr-1 align-middle">reply</span> ${data.length}`;
        if (data.length === 0) { list.innerHTML = `<p class="text-sm italic text-center py-8">No replies yet.</p>`; return; }
        list.innerHTML = data.map(r => `<div class="flex items-start gap-3 p-3 bg-surface-variant/20 dark:bg-neutral-800/50 rounded-2xl"><img src="${r.users.profile_img_url}" class="w-9 h-9 rounded-full object-cover"><div class="flex-1"><div class="flex justify-between items-center mb-1"><p class="text-[13px] font-bold text-on-surface dark:text-gray-100">${r.users.full_name}</p><p class="text-[10px] text-on-surface-variant">${timeAgo(r.created_at)}</p></div><p class="text-[14px] text-on-surface dark:text-gray-300 whitespace-pre-wrap">${r.content}</p></div></div>`).join('');
    } catch (e) { list.innerHTML = `<p class="text-sm text-center py-8 text-error">Failed.</p>`; }
}

async function executeDeleteHotpost() {
    const post = hotpostsByUser.get(currentUser.id).posts[currentViewerState.postIndex];
    closeActivityPanel(); 
    closeHotpostViewer();
    const { error } = await supabase.from('hotposts').update({ is_deleted: true }).eq('id', post.id);
    if (error) showToast('Failed to delete Hotpost.', 'error');
    else { showToast('Hotpost deleted.', 'success'); fetchHotposts(); }
}

window.openHotpostCamera = openCameraModal;
window.openStoryDetailsModal = openActivityPanel;
