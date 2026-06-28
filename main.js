const sb = window.sb; 
let currentSession = null;

// Cloudinary Configuration
const CLOUDINARY_CLOUD_NAME = 'dnia8lb2q'; 
const CLOUDINARY_UPLOAD_PRESET = 'profiles';

// ==========================================
// 1. SUPABASE AUTH & PROFILE LOADING
// ==========================================
async function checkAuth() {
    const { data: { session } } = await sb.auth.getSession();
    
    if (!session) {
        window.location.href = "/EcoCampus/auth/login.html";
        return;
    }
    
    currentSession = session;
    fetchUserProfile(session.user.id, session.user.email);
}

async function fetchUserProfile(authUserId, fallbackEmail) {
    try {
        const { data: userProfile, error } = await sb
            .from('users')
            .select('full_name, profile_img_url, role, course, student_id, mobile, email, bio, social_links') 
            .eq('auth_user_id', authUserId)
            .single();

        if (error) throw error; 

        if (userProfile) {
            const name = userProfile.full_name || fallbackEmail;
            
            // --- Map Header Data (Null Safe) ---
            const headerNameEl = document.getElementById('header-name');
            if (headerNameEl) headerNameEl.innerText = name;

            if (userProfile.profile_img_url) {
                const headerAvatarEl = document.getElementById('header-avatar');
                if (headerAvatarEl) headerAvatarEl.src = userProfile.profile_img_url;
                
                const profileAvatarLargeEl = document.getElementById('profile-avatar-large');
                if (profileAvatarLargeEl) profileAvatarLargeEl.src = userProfile.profile_img_url;
            }

            // --- Map Profile Tab Data (Null Safe) ---
            const profileNameEl = document.getElementById('profile-name');
            if (profileNameEl) profileNameEl.innerText = name;
            
            const profileRoleEl = document.getElementById('profile-role');
            if (profileRoleEl) profileRoleEl.innerText = userProfile.role || 'Student';
            
            const profileEmailEl = document.getElementById('profile-email');
            if (profileEmailEl) profileEmailEl.innerHTML = `<span class="material-symbols-outlined text-[16px]">mail</span> ${userProfile.email || fallbackEmail}`;
            
            const profileIdEl = document.getElementById('profile-id');
            if (profileIdEl) profileIdEl.innerText = userProfile.student_id || 'Not Assigned';
            
            const profileCourseEl = document.getElementById('profile-course');
            if (profileCourseEl) profileCourseEl.innerText = userProfile.course || 'Not Assigned';
            
            const profileBioEl = document.getElementById('profile-bio');
            if (profileBioEl) profileBioEl.innerText = userProfile.bio || 'Add a bio to tell people about yourself! 🌱';

            // --- Render Dynamic Social Links ---
            const socialLinksContainer = document.getElementById('profile-social-links');
            if (socialLinksContainer) {
                socialLinksContainer.innerHTML = ''; 
                
                if (userProfile.social_links && Object.keys(userProfile.social_links).length > 0) {
                    Object.entries(userProfile.social_links).forEach(([platform, url]) => {
                        if (url) {
                            const linkHTML = `
                                <a href="${url}" target="_blank" rel="noopener noreferrer" 
                                   class="px-4 py-2 bg-surface border border-outline/20 rounded-xl text-sm font-bold text-on-surface hover:bg-primary/10 hover:text-primary transition-colors capitalize flex items-center gap-1.5 shadow-sm">
                                    <span class="material-symbols-outlined text-[18px]">link</span>
                                    ${platform}
                                </a>
                            `;
                            socialLinksContainer.innerHTML += linkHTML;
                        }
                    });
                } else {
                    socialLinksContainer.innerHTML = `<p class="text-[13px] text-on-surface-variant italic">No social links added yet.</p>`;
                }
            }
        }
    } catch (err) {
        console.error("Error fetching profile:", err.message);
        
        // Fallbacks if fetch fails
        const headerNameEl = document.getElementById('header-name');
        if (headerNameEl) headerNameEl.innerText = fallbackEmail;
        
        const profileNameEl = document.getElementById('profile-name');
        if (profileNameEl) profileNameEl.innerText = fallbackEmail;
    }
}

async function logout() {
    await sb.auth.signOut();
    window.location.href = "/EcoCampus/auth/login.html";
}

// ==========================================
// 2. CLOUDINARY UPLOAD & PROFILE SYNC
// ==========================================
function setupProfileImageUpload() {
    const avatarContainer = document.getElementById('profile-avatar-container');
    const fileInput = document.getElementById('avatar-upload-input');
    const largeAvatarImg = document.getElementById('profile-avatar-large');
    const headerAvatarImg = document.getElementById('header-avatar');

    if (!avatarContainer || !fileInput) return;

    avatarContainer.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        largeAvatarImg.style.opacity = '0.5';

        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

            const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
                method: 'POST',
                body: formData
            });
            const cloudinaryData = await uploadRes.json();

            if (!cloudinaryData.secure_url) {
                throw new Error("Failed to upload image to Cloudinary");
            }

            const newImageUrl = cloudinaryData.secure_url;

            // Sync with Supabase
            const { error: dbError } = await sb
                .from('users')
                .update({ profile_img_url: newImageUrl })
                .eq('auth_user_id', currentSession.user.id);

            if (dbError) throw dbError;

            // Update UI
            largeAvatarImg.src = newImageUrl;
            if (headerAvatarImg) headerAvatarImg.src = newImageUrl;
            
        } catch (err) {
            console.error("Profile image upload failed:", err);
            alert("Could not update profile picture. Please try again.");
        } finally {
            largeAvatarImg.style.opacity = '1';
            fileInput.value = '';
        }
    });
}

// ==========================================
// 3. TAB SWITCHING LOGIC (BOTTOM NAV)
// ==========================================
function switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(el => {
        el.classList.remove('active');
    });
    
    document.querySelectorAll('.nav-item').forEach(el => {
        el.classList.remove('bg-[#006e1c]', 'dark:bg-primary', 'text-white', 'active');
        el.classList.add('text-on-surface-variant', 'hover:bg-surface-variant/40');
        el.querySelector('.material-symbols-outlined').style.fontVariationSettings = "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24";
    });

    const activeNav = document.getElementById('nav-' + tabName);
    if (activeNav) {
        activeNav.classList.remove('text-on-surface-variant', 'hover:bg-surface-variant/40');
        activeNav.classList.add('bg-[#006e1c]', 'dark:bg-primary', 'text-white', 'active');
        activeNav.querySelector('.material-symbols-outlined').style.fontVariationSettings = "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24";
    }

    const targetView = document.getElementById('view-' + tabName);
    if (targetView) {
        targetView.classList.add('active');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

// ==========================================
// 4. FULL SCREEN NOTIFICATION LOGIC
// ==========================================
const notifBtn = document.getElementById('notif-btn');
const closeNotifBtn = document.getElementById('close-notif-btn');
const fullNotifPanel = document.getElementById('full-notif-panel');

if(notifBtn && closeNotifBtn && fullNotifPanel) {
    notifBtn.addEventListener('click', () => {
        fullNotifPanel.classList.remove('translate-x-full');
        document.body.style.overflow = 'hidden';
    });

    closeNotifBtn.addEventListener('click', () => {
        fullNotifPanel.classList.add('translate-x-full');
        document.body.style.overflow = 'auto';
    });
}

// ==========================================
// 5. THEME SWITCH LOGIC (APP SETTINGS)
// ==========================================
const themeCheckbox = document.getElementById('theme-toggle-switch');

function initTheme() {
    const savedTheme = localStorage.getItem('ecoCampusTheme') || 'light';
    document.documentElement.setAttribute('class', savedTheme);
    
    if(themeCheckbox) {
        themeCheckbox.checked = (savedTheme === 'dark');
    }
}

if(themeCheckbox) {
    themeCheckbox.addEventListener('change', (e) => {
        const newTheme = e.target.checked ? 'dark' : 'light';
        document.documentElement.setAttribute('class', newTheme);
        localStorage.setItem('ecoCampusTheme', newTheme);
    });
}

// ==========================================
// INITIALIZATION
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    initTheme();
    checkAuth();
    setupProfileImageUpload();
});
