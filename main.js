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
            document.getElementById('header-name').innerText = name;
            if (userProfile.profile_img_url) {
                document.getElementById('header-avatar').src = userProfile.profile_img_url;
                document.getElementById('profile-avatar-large').src = userProfile.profile_img_url;
            }

            // Full Profile Tab Data Mapping
            document.getElementById('profile-name').innerText = name;
            document.getElementById('profile-role').innerText = userProfile.role || 'Student';
            document.getElementById('profile-email').innerHTML = `<span class="material-symbols-outlined text-[16px]">mail</span> ${userProfile.email || fallbackEmail}`;
            document.getElementById('profile-id').innerText = userProfile.student_id || 'Not Assigned';
            document.getElementById('profile-course').innerText = userProfile.course || 'Not Assigned';
        }
    } catch (err) {
        console.error("Error fetching profile:", err.message);
        document.getElementById('header-name').innerText = fallbackEmail;
        document.getElementById('profile-name').innerText = fallbackEmail;
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
    
    // Reset all nav icons to unselected (Updated for new UI)
    document.querySelectorAll('.nav-item').forEach(el => {
        el.classList.remove('bg-[#006e1c]', 'dark:bg-primary', 'text-white', 'active');
        el.classList.add('text-on-surface-variant', 'hover:bg-surface-variant/40');
        el.querySelector('.material-symbols-outlined').style.fontVariationSettings = "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24";
    });

    // Highlight the clicked nav icon (Updated for new UI)
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
    
    // Fixed: safely add/remove the dark class instead of overwriting all classes
    if (savedTheme === 'dark') {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
    
    // Sync switch UI
    if(themeCheckbox) {
        themeCheckbox.checked = (savedTheme === 'dark');
    }
}

if(themeCheckbox) {
    themeCheckbox.addEventListener('change', (e) => {
        if (e.target.checked) {
            document.documentElement.classList.add('dark');
            localStorage.setItem('ecoCampusTheme', 'dark');
        } else {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('ecoCampusTheme', 'light');
        }
    });
}

// ==========================================
// INITIALIZATION
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    initTheme();
    checkAuth();
});
