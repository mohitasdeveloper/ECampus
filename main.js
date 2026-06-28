// ==========================================
// GLOBAL CONFIGURATION
// ==========================================
const sb = window.sb; 
let currentSession = null;

const CLOUDINARY_CLOUD_NAME = 'dnia8lb2q'; 
const CLOUDINARY_UPLOAD_PRESET = 'profiles'; 

// ==========================================
// 1. AUTH & INITIALIZATION
// ==========================================
async function checkAuth() {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) {
        window.location.href = "/EcoCampus/auth/login.html";
        return;
    }
    currentSession = session;
    
    // Initialize everything
    fetchUserProfile(session.user.id, session.user.email);
    loadPosts();
    loadDiscoverStudents();
    loadNotifications();
}

// ==========================================
// 2. PROFILE DATA HANDLING
// ==========================================
async function fetchUserProfile(authUserId, fallbackEmail) {
    try {
        const { data: userProfile, error } = await sb
            .from('users')
            .select('full_name, profile_img_url, role, course, student_id, email, bio, social_links, is_private') 
            .eq('auth_user_id', authUserId)
            .single();

        if (error) throw error; 

        if (userProfile) {
            // Header & Feed Avatar
            const avatarUrl = userProfile.profile_img_url || 'https://via.placeholder.com/150';
            document.getElementById('header-avatar').src = avatarUrl;
            document.getElementById('profile-avatar-large').src = avatarUrl;
            document.getElementById('feed-input-avatar').src = avatarUrl;

            // Text Fields
            const fields = {
                'profile-name': userProfile.full_name,
                'profile-role': userProfile.role || 'Student',
                'profile-id': userProfile.student_id,
                'profile-course': userProfile.course,
                'profile-bio': userProfile.bio || 'Add a bio to tell people about yourself! 🌱'
            };
            Object.entries(fields).forEach(([id, val]) => {
                const el = document.getElementById(id);
                if (el) el.innerText = val;
            });

            document.getElementById('profile-email').innerHTML = `<span class="material-symbols-outlined text-[16px]">mail</span> ${userProfile.email || fallbackEmail}`;
            document.getElementById('privacy-toggle-switch').checked = userProfile.is_private;

            renderMySocialLinks(userProfile.social_links);
        }
    } catch (err) {
        console.error("Profile fetch error:", err.message);
    }
}

// ==========================================
// 3. POSTING SYSTEM (TEXT ONLY)
// ==========================================
window.submitPost = async function() {
    const input = document.getElementById('post-input');
    const btn = document.getElementById('send-post-btn');
    const content = input.value.trim();

    if (!content || !currentSession) return;

    btn.disabled = true;
    try {
        const { error } = await sb.from('posts').insert({
            user_id: currentSession.user.id,
            content: content
        });
        if (error) throw error;
        input.value = '';
        await loadPosts();
    } catch (err) {
        alert("Failed to post: " + err.message);
    } finally {
        btn.disabled = false;
    }
};

async function loadPosts() {
    const container = document.getElementById('feed-posts-container');
    const { data: posts, error } = await sb.from('posts').select(`
        id, content, likes, created_at,
        users!posts_user_id_fkey(full_name, profile_img_url)
    `).order('created_at', { ascending: false });

    if (error || !container) return;
    container.innerHTML = posts.map(p => `
        <div class="bg-white dark:bg-neutral-900 rounded-[32px] p-5 border border-gray-200 dark:border-neutral-800 shadow-sm mb-5">
            <div class="flex items-center gap-3 mb-3">
                <img src="${p.users.profile_img_url || 'https://via.placeholder.com/150'}" class="w-10 h-10 rounded-full object-cover">
                <div><h4 class="font-bold text-[14px]">${p.users.full_name}</h4></div>
            </div>
            <p class="text-[14px] leading-relaxed">${p.content}</p>
        </div>
    `).join('');
}

// ==========================================
// 4. CLOUDINARY UPLOAD FIX
// ==========================================
function setupProfileImageUpload() {
    const input = document.getElementById('avatar-upload-input');
    input.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

        try {
            const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
                method: 'POST', body: formData
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error?.message);

            await sb.from('users').update({ profile_img_url: data.secure_url }).eq('auth_user_id', currentSession.user.id);
            fetchUserProfile(currentSession.user.id, currentSession.user.email);
        } catch (err) {
            alert("Upload failed: " + err.message);
        }
    });
    document.getElementById('profile-avatar-container').onclick = () => input.click();
}

// ==========================================
// 5. CONNECTIONS & NOTIFICATIONS
// ==========================================
window.sendConnectionRequest = async function(receiverId, btn) {
    btn.innerText = "Requesting...";
    try {
        await sb.from('connections').insert({ requester_id: currentSession.user.id, receiver_id: receiverId });
        await sb.from('notifications').insert({ user_id: receiverId, sender_id: currentSession.user.id, type: 'connection_request', message: 'sent you a connection request.' });
        btn.innerText = "Requested";
    } catch (err) { alert("Failed."); btn.innerText = "Connect"; }
};

async function loadNotifications() {
    const container = document.getElementById('notifications-container');
    const { data: notifs } = await sb.from('notifications').select(`*, users!notifications_sender_id_fkey(full_name, profile_img_url)`).eq('user_id', currentSession.user.id).order('created_at', { ascending: false });
    
    if (notifs?.length > 0) {
        document.getElementById('notif-badge').classList.remove('hidden');
        container.innerHTML = notifs.map(n => `
            <div class="p-4 border-b border-gray-100 dark:border-neutral-800 flex gap-3 items-center">
                <img src="${n.users.profile_img_url}" class="w-10 h-10 rounded-full object-cover">
                <p class="text-sm"><strong>${n.users.full_name}</strong> ${n.message}</p>
            </div>
        `).join('');
    }
}

// ==========================================
// 6. UTILITIES
// ==========================================
window.switchTab = (tab) => {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.getElementById('view-' + tab).classList.remove('hidden');
};

window.logout = () => { sb.auth.signOut(); window.location.href = "/EcoCampus/auth/login.html"; };

document.addEventListener("DOMContentLoaded", () => {
    checkAuth();
    setupProfileImageUpload();
});
