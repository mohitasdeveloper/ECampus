import { supabase } from './supabase.js';

let currentUser = null;
let searchTimeout = null;

// Professional Shimmer Skeleton for Search Results
const LIST_SKELETON = `
    <div class="flex items-center gap-4 p-3 mb-3 bg-surface-container-lowest dark:bg-neutral-900/50 rounded-2xl border border-surface-variant/40 dark:border-neutral-800 shadow-sm animate-pulse">
        <div class="w-12 h-12 rounded-full shimmer-bg shrink-0"></div>
        <div class="flex-1">
            <div class="h-3.5 shimmer-bg rounded-md w-1/2 mb-2"></div>
            <div class="h-2.5 shimmer-bg rounded-md w-1/3"></div>
        </div>
    </div>
`.repeat(5);

export function initSearch(user) {
    currentUser = user;
    const searchInput = document.getElementById('search-input');
    
    // Live Debounced Search Listener
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            clearTimeout(searchTimeout);
            
            if (query.length === 0) {
                // If search is empty, show popular users
                document.getElementById('search-results-container').classList.add('hidden');
                document.getElementById('explore-users-container').classList.remove('hidden');
            } else {
                // Hide popular users, show shimmer skeleton while searching
                document.getElementById('explore-users-container').classList.add('hidden');
                const resultsContainer = document.getElementById('search-results-container');
                resultsContainer.classList.remove('hidden');
                resultsContainer.innerHTML = LIST_SKELETON;
                
                // Wait 300ms after user stops typing to hit the database
                searchTimeout = setTimeout(() => {
                    performSearch(query);
                }, 300);
            }
        });
    }
    
    // Load default state (Popular Users)
    fetchExploreUsers();
}

// Global Verified Tick Helper
function getTickHtml(tickType) {
    if (!tickType || tickType === 'none') return '';
    const colors = { blue: 'text-[#1d9bf0]', gold: 'text-[#e8b339]', green: 'text-primary', gray: 'text-surface-variant' };
    return `<span class="material-symbols-outlined text-[14px] ${colors[tickType.toLowerCase()] || colors.blue}" style="font-variation-settings: 'FILL' 1;">verified</span>`;
}

// Fetch default popular users
async function fetchExploreUsers() {
    const container = document.getElementById('explore-users-container');
    if (!container) return;
    
    container.innerHTML = `<h3 class="text-[14px] font-bold text-on-surface dark:text-gray-100 mb-3 ml-1">Popular Users</h3>` + LIST_SKELETON;

    try {
        const { data, error } = await supabase
            .from('users')
            .select('id, full_name, profile_img_url, course, tick_type, connection_count')
            .neq('id', currentUser.id) // Don't show myself
            .order('connection_count', { ascending: false })
            .limit(10);

        if (error) throw error;
        
        let html = `<h3 class="text-[14px] font-bold text-on-surface dark:text-gray-100 mb-3 ml-1">Popular Users</h3>`;
        html += renderUserList(data);
        container.innerHTML = html;

    } catch (err) {
        console.error('Error fetching explore users:', err);
        container.innerHTML = `<p class="text-sm text-center py-4 text-error">Failed to load users.</p>`;
    }
}

// Execute live database search
async function performSearch(query) {
    const container = document.getElementById('search-results-container');
    
    try {
        const { data, error } = await supabase
            .from('users')
            .select('id, full_name, profile_img_url, course, tick_type, connection_count')
            .ilike('full_name', `%${query}%`)
            .neq('id', currentUser.id)
            .limit(15);

        if (error) throw error;

        if (data.length === 0) {
            container.innerHTML = `
                <div class="py-12 flex flex-col items-center justify-center opacity-40 text-on-surface-variant">
                    <span class="material-symbols-outlined text-[42px] mb-2">person_search</span>
                    <p class="text-sm font-medium">No users found matching "${query}"</p>
                </div>
            `;
            return;
        }

        container.innerHTML = renderUserList(data);

    } catch (err) {
        console.error('Search error:', err);
        container.innerHTML = `<p class="text-sm text-center py-4 text-error">Search failed.</p>`;
    }
}

// Universal UI Renderer (Handles plain DP styling & Tick Injection)
function renderUserList(users) {
    return users.map(user => `
        <div onclick="window.viewUserProfile('${user.id}')" class="flex items-center gap-4 p-3 bg-surface-container-lowest dark:bg-neutral-900/50 rounded-2xl border border-surface-variant/40 dark:border-neutral-800 shadow-sm cursor-pointer hover:bg-surface-variant/20 transition-colors active:scale-95">
            
            <div class="w-12 h-12 rounded-full border border-surface-variant/60 dark:border-neutral-700 overflow-hidden bg-surface-variant/50 shrink-0 shadow-sm">
                <img src="${user.profile_img_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.full_name)}&background=e1e3e4`}" class="w-full h-full object-cover">
            </div>

            <div class="flex-1 min-w-0">
                <p class="font-bold text-[14px] text-on-surface dark:text-gray-100 truncate flex items-center gap-1">
                    ${user.full_name} ${getTickHtml(user.tick_type)}
                </p>
                <p class="text-[12px] font-medium text-on-surface-variant dark:text-gray-400 mt-[1px] truncate">
                    ${user.course || 'Student'} • <span class="text-primary font-bold">${user.connection_count || 0} connections</span>
                </p>
            </div>
        </div>
    `).join('');
}
