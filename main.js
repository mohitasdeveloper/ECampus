// ==========================================
// ECampus SuperApp Initialization Controller
// ==========================================

// Ensure Supabase is instantiated safely
const SUPABASE_URL = "https://rreczghlcgsrcmfjpzdo.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_TsYRWSpXaEnvopMDdzd36Q_N4TbMymz";

// Fallback initialization if supabase.js isn't injected globally properly
if (window.supabase) {
    window.sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
const sb = window.sb;
let globalSession = null;
let currentUserProfile = null;

// ==========================================
// Core Operations
// ==========================================
async function initApp() {
    initTheme();
    
    if (!sb) {
        console.warn("Supabase client not loaded. Running entirely in Mock Mode.");
        injectFallbackData();
        return;
    }

    try {
        const { data: { session } } = await sb.auth.getSession();
        if (session) {
            globalSession = session;
            await loadProfileData(session.user.id);
            loadFeedPosts();
            loadDiscoverNetwork();
        } else {
            console.warn("No active session. Injecting Mock Data for prototype display.");
            injectFallbackData();
        }
    } catch (e) {
        console.error("Auth check failed:", e);
        injectFallbackData();
    }

    // Load EcoVities Apps (Robust fallback architecture)
    loadEcoStore();
    loadEcoLeaderboard();
    loadEcoChallenges();
}

// ==========================================
// Profile & User Data
// ==========================================
async function loadProfileData(authId) {
    try {
        const { data, error } = await sb.from('users').select('*').eq('auth_user_id', authId).single();
        if (error) throw error;
        if (data) {
            currentUserProfile = data;
            bindProfileToUI(data);
        }
    } catch (err) {
        console.error("Profile load failed:", err);
    }
}

function bindProfileToUI(user) {
    const avatar = user.profile_img_url || `https://placehold.co/150x150/e2e8f0/1e293b?text=${user.full_name.charAt(0)}`;
    
    ['header-avatar', 'profile-avatar-large', 'feed-avatar'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.src = avatar;
    });

    setText('profile-name', user.full_name);
    setText('profile-course', user.course || 'Enrolled Student');
    setText('stat-points', user.lifetime_points || user.current_points || Math.floor(Math.random() * 500));
    setText('stat-conns', user.connection_count || 0);
    setText('header-points', user.lifetime_points || user.current_points || 0);

    const privacyEl = document.getElementById('privacy-toggle');
    if (privacyEl) {
        privacyEl.checked = user.is_private || false;
        privacyEl.addEventListener('change', async (e) => {
            if (globalSession) await sb.from('users').update({ is_private: e.target.checked }).eq('auth_user_id', globalSession.user.id);
        });
    }
}

function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.innerText = val;
}

// ==========================================
// Feed & Social Posting
// ==========================================
async function loadFeedPosts() {
    const container = document.getElementById('feed-container');
    try {
        const { data, error } = await sb.from('posts').select(`id, content, likes, created_at, users!posts_user_id_fkey(full_name, profile_img_url)`).order('created_at', { ascending: false }).limit(20);
        
        if (error) throw error;
        
        if (data && data.length > 0) {
            container.innerHTML = data.map(p => createPostHTML(p)).join('');
        } else {
            container.innerHTML = `<p class="text-center text-sm text-gray-500 py-10">Network is quiet. Be the first to post!</p>`;
        }
    } catch (e) {
        // Fallback to avoid empty UI
        container.innerHTML = createPostHTML({
            content: "Welcome to the unified ECampus platform! Share an update above.",
            likes: 42,
            users: { full_name: "Admin Team", profile_img_url: "https://placehold.co/150x150/006e1c/ffffff?text=A" }
        });
    }
}

function createPostHTML(post) {
    const img = post.users?.profile_img_url || `https://placehold.co/150x150/e2e8f0/1e293b?text=${(post.users?.full_name || 'U').charAt(0)}`;
    return `
    <div class="bg-white dark:bg-neutral-900 rounded-[32px] p-5 border border-gray-200 dark:border-neutral-800 shadow-sm mb-5 animate-fadeIn">
        <div class="flex items-center gap-3 mb-3">
            <img src="${img}" class="w-10 h-10 rounded-full border border-gray-200 dark:border-neutral-700 shadow-sm object-cover">
            <div class="flex-1">
                <h4 class="font-bold text-[14px] text-gray-900 dark:text-gray-100">${post.users?.full_name || 'Anonymous'}</h4>
                <p class="text-[11px] text-gray-500 mt-0.5">Stream Update</p>
            </div>
        </div>
        <p class="text-[14px] text-gray-800 dark:text-gray-200 leading-relaxed mb-4 px-1">${post.content}</p>
        <div class="flex items-center gap-6 border-t border-gray-100 dark:border-neutral-800 pt-3 px-1">
            <button class="flex items-center gap-1.5 text-gray-500 hover:text-red-500 transition-colors text-[13px] font-bold">
                <span class="material-symbols-outlined text-[20px]">favorite</span> ${post.likes || 0}
            </button>
        </div>
    </div>`;
}

window.submitPost = async function() {
    const input = document.getElementById('post-input');
    const btn = document.getElementById('send-post-btn');
    if (!input.value.trim() || !globalSession) return;

    btn.innerHTML = '<span class="material-symbols-outlined text-[20px] animate-spin">sync</span>';
    try {
        await sb.from('posts').insert({ user_id: globalSession.user.id, content: input.value.trim() });
        input.value = '';
        await loadFeedPosts();
    } catch (e) {
        console.error(e);
    } finally {
        btn.innerHTML = '<span class="material-symbols-outlined text-[20px] ml-1">send</span>';
    }
}

// ==========================================
// Discover & Network 
// ==========================================
async function loadDiscoverNetwork() {
    const container = document.getElementById('discover-students-container');
    try {
        const { data, error } = await sb.from('users').select('full_name, course, profile_img_url, is_private, connection_count').neq('auth_user_id', globalSession.user.id).limit(5);
        if (error) throw error;
        
        container.innerHTML = data.map(u => `
            <div class="bg-white dark:bg-neutral-900 rounded-[24px] p-4 border border-gray-200 dark:border-neutral-800 shadow-sm flex items-center gap-4 cursor-pointer active:scale-95 transition-transform">
                <img src="${u.profile_img_url || `https://placehold.co/150x150/e2e8f0/1e293b?text=${u.full_name.charAt(0)}`}" class="w-12 h-12 rounded-full object-cover border border-gray-100 dark:border-neutral-700">
                <div class="flex-1">
                    <h4 class="text-[14px] font-bold">${u.full_name} ${u.is_private ? '🔒' : ''}</h4>
                    <p class="text-[11px] text-gray-500 mt-0.5">${u.course || 'Student'} • ${u.connection_count || 0} Peers</p>
                </div>
                <button class="bg-primary/10 text-primary px-4 py-2 rounded-xl text-[12px] font-bold">Connect</button>
            </div>
        `).join('');
    } catch (e) {}
}

// ==========================================
// EcoVities Mini-Apps (Safe Integrations)
// ==========================================
function loadEcoStore() {
    const grid = document.getElementById('store-grid');
    if(!grid) return;
    const items = [
        { name: "Canteen Coffee", pts: 50, img: "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=300&q=80" },
        { name: "Eco Notebook", pts: 150, img: "https://images.unsplash.com/photo-1531346878377-a541e4a115fd?w=300&q=80" }
    ];
    grid.innerHTML = items.map(i => `
        <div class="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl overflow-hidden shadow-sm">
            <img src="${i.img}" class="w-full h-24 object-cover">
            <div class="p-3">
                <h4 class="text-sm font-bold truncate">${i.name}</h4>
                <div class="flex items-center text-green-600 font-bold text-xs mt-1">
                    <span class="material-symbols-outlined text-[14px] mr-1">eco</span> ${i.pts}
                </div>
            </div>
        </div>
    `).join('');
}

function loadEcoLeaderboard() {
    const list = document.getElementById('leaderboard-list');
    if(!list) return;
    const leaders = ["Sarah Jenkins", "David Kim", "Maya Lin"];
    list.innerHTML = leaders.map((name, i) => `
        <div class="bg-white dark:bg-neutral-900 p-4 rounded-2xl flex items-center justify-between border border-gray-200 dark:border-neutral-800">
            <div class="flex items-center gap-3">
                <span class="font-black text-gray-400">#${i+1}</span>
                <span class="font-bold text-sm">${name}</span>
            </div>
            <span class="text-green-600 font-bold text-sm">${(3-i)*100} pts</span>
        </div>
    `).join('');
}

function loadEcoChallenges() {
    const list = document.getElementById('challenges-list');
    if(!list) return;
    list.innerHTML = `
        <div class="bg-white dark:bg-neutral-900 p-4 rounded-2xl flex items-start gap-4 border border-gray-200 dark:border-neutral-800">
            <div class="w-10 h-10 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center shrink-0"><span class="material-symbols-outlined">camera_alt</span></div>
            <div>
                <h4 class="font-bold text-sm">Snap a Recyclable</h4>
                <p class="text-xs text-gray-500 mt-1">Upload a photo of you recycling plastic correctly.</p>
                <button class="mt-3 bg-primary text-white px-4 py-2 rounded-xl text-xs font-bold w-full">Upload Photo (+20 Pts)</button>
            </div>
        </div>
    `;
}

// ==========================================
// Utilities & Themes
// ==========================================
function initTheme() {
    const isDark = localStorage.getItem('theme') === 'dark';
    document.documentElement.className = isDark ? 'dark' : 'light';
    const toggle = document.getElementById('theme-toggle');
    if(toggle) {
        toggle.checked = isDark;
        toggle.addEventListener('change', (e) => {
            const mode = e.target.checked ? 'dark' : 'light';
            document.documentElement.className = mode;
            localStorage.setItem('theme', mode);
        });
    }
}

function injectFallbackData() {
    bindProfileToUI({ full_name: "Guest User", course: "Preview Mode", current_points: 120, connection_count: 5 });
    loadEcoStore();
    loadEcoLeaderboard();
    loadEcoChallenges();
}

document.addEventListener("DOMContentLoaded", initApp);
