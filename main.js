const sb = window.sb; 
let currentSession = null;

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
            .select('full_name, profile_img_url, role, course, student_id, mobile, email') 
            .eq('auth_user_id', authUserId)
            .single();

        if (error) throw error; 

        if (userProfile) {
            const name = userProfile.full_name || fallbackEmail;
            
            // Header
            const headerNameEl = document.getElementById('header-name');
            if (headerNameEl) headerNameEl.innerText = name;
            
            if (userProfile.profile_img_url) {
                const headerAvatarEl = document.getElementById('header-avatar');
                if (headerAvatarEl) headerAvatarEl.src = userProfile.profile_img_url;
                
                const profileAvatarLargeEl = document.getElementById('profile-avatar-large');
                if (profileAvatarLargeEl) profileAvatarLargeEl.src = userProfile.profile_img_url;
            }

            // Full Profile Tab Data Mapping
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
        }
    } catch (err) {
        console.error("Error fetching profile:", err.message);
        
        // Safely apply fallbacks if elements exist
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

function openApp(path) {
    if (!currentSession) {
        window.location.href = "/EcoCampus/auth/login.html?redirect=" + path;
        return;
    }
    window.location.href = path;
}


// ==========================================
// 2. TAB SWITCHING LOGIC (BOTTOM NAV)
// ==========================================
function switchTab(tabName) {
    // Hide all tab content
    document.querySelectorAll('.tab-content').forEach(el => {
        el.classList.remove('active');
    });
    
    // Reset all nav icons to unselected
    document.querySelectorAll('.nav-item').forEach(el => {
        el.classList.remove('bg-[#006e1c]', 'dark:bg-primary', 'text-white', 'active');
        el.classList.add('text-on-surface-variant', 'hover:bg-surface-variant/40');
        el.querySelector('.material-symbols-outlined').style.fontVariationSettings = "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24";
    });

    // Highlight the clicked nav icon
    const activeNav = document.getElementById('nav-' + tabName);
    if (activeNav) {
        activeNav.classList.remove('text-on-surface-variant', 'hover:bg-surface-variant/40');
        activeNav.classList.add('bg-[#006e1c]', 'dark:bg-primary', 'text-white', 'active');
        activeNav.querySelector('.material-symbols-outlined').style.fontVariationSettings = "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24";
    }

    // Show the target view
    const targetView = document.getElementById('view-' + tabName);
    if (targetView) {
        targetView.classList.add('active');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

// ==========================================
// 3. FULL SCREEN NOTIFICATION LOGIC
// ==========================================
const notifBtn = document.getElementById('notif-btn');
const closeNotifBtn = document.getElementById('close-notif-btn');
const fullNotifPanel = document.getElementById('full-notif-panel');

if(notifBtn && closeNotifBtn && fullNotifPanel) {
    // Open panel
    notifBtn.addEventListener('click', () => {
        fullNotifPanel.classList.remove('translate-x-full');
        document.body.style.overflow = 'hidden'; // Prevent scrolling underneath
    });

    // Close panel
    closeNotifBtn.addEventListener('click', () => {
        fullNotifPanel.classList.add('translate-x-full');
        document.body.style.overflow = 'auto'; // Re-enable scroll
    });
}

// ==========================================
// 4. THEME SWITCH LOGIC (APP SETTINGS)
// ==========================================
const themeCheckbox = document.getElementById('theme-toggle-switch');

function initTheme() {
    const savedTheme = localStorage.getItem('ecoCampusTheme') || 'light';
    // Reverted back to setAttribute logic to correctly swap the root class
    document.documentElement.setAttribute('class', savedTheme);
    
    // Sync switch UI
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
});
