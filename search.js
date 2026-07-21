import { supabase } from './supabase.js';

let currentUser = null;
let searchTimeout = null;

const LIST_SKELETON = `
    <div class="flex items-center gap-3 py-3 animate-pulse">
        <div class="w-[52px] h-[52px] rounded-full shimmer-bg shrink-0"></div>
        <div class="flex-1">
            <div class="h-3.5 shimmer-bg rounded-md w-1/2 mb-2"></div>
            <div class="h-2.5 shimmer-bg rounded-md w-1/3"></div>
        </div>
    </div>
`.repeat(5);

export function initSearch(user) {
    currentUser = user;
    const searchInput = document.getElementById('search-input');
    const clearBtn = document.getElementById('clear-search-btn');
    
    // Live Debounced Search Listener
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            clearTimeout(searchTimeout);
            
            // Toggle Clear Button Visibility
            if (clearBtn) {
                if (query.length > 0) clearBtn.classList.remove('hidden');
                else clearBtn.classList.add('hidden');
            }

            if (query.length === 0) {
                document.getElementById('search-results-container').classList.add('hidden');
                document.getElementById('explore-users-container').classList.remove('hidden');
            } else {
                document.getElementById('explore-users-container').classList.add('hidden');
                const resultsContainer = document.getElementById('search-results-container');
                resultsContainer.classList.remove('hidden');
                resultsContainer.innerHTML = LIST_SKELETON;
                
                searchTimeout = setTimeout(() => {
                    performSearch(query);
                }, 300);
            }
        });
    }

    // Clear Button Click Handler
    if (clearBtn && searchInput) {
        clearBtn.addEventListener('click', () => {
            searchInput.value = '';
            clearBtn.classList.add('hidden');
            clearTimeout(searchTimeout);
            
            document.getElementById('search-results-container').classList.add('hidden');
            document.getElementById('explore-users-container').classList.remove('hidden');
            
            searchInput.focus(); // Keep keyboard open
        });
    }
    
    fetchExploreUsers();
}

function getTickHtml(tickType) {
    if (!tickType || tickType === 'none') return '';
    const colors = { blue: 'text-[#1d9bf0]', gold: 'text-[#e8b339]', green: 'text-primary', gray: 'text-surface-variant' };
    return `<span class="material-symbols-outlined text-[14px] ${colors[tickType.toLowerCase()] || colors.blue}" style="font-variation-settings: 'FILL' 1;">verified</span>`;
}

// Fetch Top 5 Pages + Top 10 Students for Suggested Section
async function fetchExploreUsers() {
    const container = document.getElementById('explore-users-container');
    if (!container) return;
    
    container.innerHTML = `<h3 class="text-[14px] font-bold text-on-surface dark:text-gray-100 mb-2 mt-1">Suggested for you</h3>` + LIST_SKELETON;

    try {
        // 1. Fetch Top 5 Pages
        const { data: pages, error: pagesError } = await supabase
            .from('users')
            .select('id, full_name, profile_img_url, course, tick_type, role')
            .eq('role', 'page')
            .neq('id', currentUser.id)
            .order('connection_count', { ascending: false })
            .limit(5);

        if (pagesError) throw pagesError;

        // 2. Fetch Top 10 Students (Exclude Pages)
        const { data: students, error: studentsError } = await supabase
            .from('users')
            .select('id, full_name, profile_img_url, course, tick_type, role')
            .neq('role', 'page') 
            .neq('id', currentUser.id)
            .order('connection_count', { ascending: false })
            .limit(10);

        if (studentsError) throw studentsError;
        
        // 3. Combine Arrays (Pages first, then Students)
        const combinedData = [...(pages || []), ...(students || [])];

        let html = `<h3 class="text-[14px] font-bold text-on-surface dark:text-gray-100 mb-2 mt-1">Suggested for you</h3>`;
        
        if (combinedData.length === 0) {
            html += `<p class="text-sm italic text-center py-4 text-on-surface-variant dark:text-gray-400">No suggestions found.</p>`;
        } else {
            html += renderUserList(combinedData);
        }
        
        container.innerHTML = html;

    } catch (err) {
        console.error('Error fetching explore users:', err);
        container.innerHTML = `<p class="text-sm text-center py-4 text-error">Failed to load suggestions.</p>`;
    }
}

// Search across all users and pages
async function performSearch(query) {
    const container = document.getElementById('search-results-container');
    
    try {
        const { data, error } = await supabase
            .from('users')
            .select('id, full_name, profile_img_url, course, tick_type, role')
            .ilike('full_name', `%${query}%`)
            .neq('id', currentUser.id)
            .limit(15);

        if (error) throw error;

        if (data.length === 0) {
            container.innerHTML = `
                <div class="py-12 flex flex-col items-center justify-center opacity-40 text-on-surface-variant">
                    <span class="material-symbols-outlined text-[42px] mb-2">person_search</span>
                    <p class="text-sm font-medium">No results found matching "${query}"</p>
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

// Universal UI Renderer ("Official Page" for pages, course/Student for students)
function renderUserList(users) {
    return users.map(user => {
        const rawAvatarUrl = user.profile_img_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.full_name)}&background=e1e3e4`;
        const optimizedAvatar = typeof window.optimizeImageUrl === 'function' ? window.optimizeImageUrl(rawAvatarUrl, 'avatar') : rawAvatarUrl;
        const fallback = `this.onerror=null; this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(user.full_name)}&background=e1e3e4';`;
        
        const subtitle = user.role === 'page' ? 'Official Page' : (user.course || 'Student');

        return `
        <div onclick="window.viewUserProfile('${user.id}')" class="flex items-center gap-3 py-3 cursor-pointer active:opacity-60 transition-opacity">
            <img loading="lazy" src="${optimizedAvatar}" onerror="${fallback}" class="w-[52px] h-[52px] rounded-full object-cover shrink-0 border border-surface-variant/50">

            <div class="flex-1 min-w-0">
                <div class="flex items-center gap-1">
                    <p class="font-bold text-[14px] text-on-surface dark:text-gray-100 truncate">
                        ${user.full_name}
                    </p>
                    ${getTickHtml(user.tick_type)}
                </div>
                <p class="text-[13px] font-medium text-on-surface-variant dark:text-gray-500 mt-[1px] truncate">
                    ${subtitle}
                </p>
            </div>
        </div>
        `;
    }).join('');
}
