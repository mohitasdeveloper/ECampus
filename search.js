import { supabase } from './supabase.js';
import { handleConnectionAction } from './main.js';

let currentUser = null;

const debounce = (func, delay) => {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), delay);
    };
};

export function initSearch(user) {
    currentUser = user;
    fetchPopularUsersForSearch();

    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(handleSearch, 300));
    }

    // Use event delegation for connect buttons within the search view
    const viewSearch = document.getElementById('view-search');
    if (viewSearch) {
        viewSearch.addEventListener('click', (e) => {
            const connectBtn = e.target.closest('.connect-btn');
            if (connectBtn && !connectBtn.disabled) handleConnectionAction(connectBtn.dataset.userId, 'request', connectBtn);
        });
    }
}

async function fetchPopularUsersForSearch() {
    const container = document.getElementById('explore-users-container');
    if (!container) return;
    container.innerHTML = `<p class="text-sm italic text-center py-4 text-gray-500 dark:text-gray-400">Loading popular users...</p>`;

    try {
        // 1. Get all user IDs the current user is already connected with or has a pending request with
        const { data: connections, error: connError } = await supabase
            .from('connections')
            .select('user_one_id, user_two_id')
            .or(`user_one_id.eq.${currentUser.id},user_two_id.eq.${currentUser.id}`);
        if (connError) throw connError;

        const connectedUserIds = connections.map(c => {
            return c.user_one_id === currentUser.id ? c.user_two_id : c.user_one_id;
        });
        const allExcludedIds = [currentUser.id, ...connectedUserIds];

        // 2. Fetch top 20 users by connection_count, excluding the excluded list
        const { data: users, error } = await supabase
            .from('users')
            .select('id, full_name, profile_img_url, course, connection_count')
            .not('id', 'in', `(${allExcludedIds.join(',')})`)
            .order('connection_count', { ascending: false, nulls: 'last' })
            .limit(20);

        if (error) throw error;

        renderPopularUsersForSearch(users);

    } catch (error) {
        console.error('Error fetching popular users:', error);
        container.innerHTML = `<p class="text-sm italic text-center py-4 text-red-500">Could not load popular users.</p>`;
    }
}

function renderPopularUsersForSearch(users) {
    const container = document.getElementById('explore-users-container');
    if (users.length === 0) {
        container.innerHTML = `<p class="text-sm italic text-center py-4 text-gray-500 dark:text-gray-400">No new popular users to show right now.</p>`;
        return;
    }

    container.innerHTML = users.map(user => `
        <div class="flex items-center gap-4 p-3 bg-white dark:bg-neutral-900 rounded-2xl border border-gray-200 dark:border-neutral-800 shadow-sm">
            <div onclick="viewUserProfile('${user.id}')" class="flex-1 flex items-center gap-4 cursor-pointer">
                <img src="${user.profile_img_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.full_name)}&background=e1e3e4`}" class="w-12 h-12 rounded-full object-cover">
                <div class="flex-1">
                    <p class="font-bold text-sm text-gray-900 dark:text-gray-100">${user.full_name}</p>
                    <p class="text-xs text-gray-500 dark:text-gray-400">${user.connection_count || 0} connections</p>
                </div>
            </div>
            <button data-user-id="${user.id}" class="connect-btn bg-primary/10 text-primary px-4 py-2 rounded-full text-[12px] font-bold tracking-wide transition-all hover:bg-primary/20 active:scale-95 shrink-0">
                Connect
            </button>
        </div>
    `).join('');
}

async function handleSearch(event) {
    const query = event.target.value.trim();
    const resultsContainer = document.getElementById('search-results-container');
    const exploreContainer = document.getElementById('explore-users-container');

    if (query.length < 2) {
        resultsContainer.classList.add('hidden');
        exploreContainer.classList.remove('hidden');
        resultsContainer.innerHTML = '';
        return;
    }

    exploreContainer.classList.add('hidden');
    resultsContainer.classList.remove('hidden');
    resultsContainer.innerHTML = `<p class="text-sm italic text-center py-4 text-gray-500 dark:text-gray-400">Searching...</p>`;

    try {
        const { data, error } = await supabase
            .from('users')
            .select('id, full_name, profile_img_url, course')
            .or(`full_name.ilike.%${query}%,student_id.ilike.%${query}%`)
            .neq('id', currentUser.id)
            .limit(10);

        if (error) throw error;

        renderSearchResults(data);

    } catch (error) {
        console.error('Error searching users:', error);
        resultsContainer.innerHTML = `<p class="text-sm italic text-center py-4 text-red-500">Error during search.</p>`;
    }
}

function renderSearchResults(users) {
    const container = document.getElementById('search-results-container');
    if (users.length === 0) {
        container.innerHTML = `<p class="text-sm italic text-center py-4 text-gray-500 dark:text-gray-400">No students found.</p>`;
        return;
    }

    container.innerHTML = users.map(user => `
        <div class="flex items-center gap-4 p-3 bg-white dark:bg-neutral-900 rounded-2xl border border-gray-200 dark:border-neutral-800 shadow-sm">
            <div onclick="viewUserProfile('${user.id}')" class="flex-1 flex items-center gap-4 cursor-pointer">
                <img src="${user.profile_img_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.full_name)}&background=e1e3e4`}" class="w-12 h-12 rounded-full object-cover">
                <div class="flex-1">
                    <p class="font-bold text-sm text-gray-900 dark:text-gray-100">${user.full_name}</p>
                    <p class="text-xs text-gray-500 dark:text-gray-400">${user.course || 'Student'}</p>
                </div>
            </div>
            <button data-user-id="${user.id}" class="connect-btn bg-primary/10 text-primary px-4 py-2 rounded-full text-[12px] font-bold tracking-wide transition-all hover:bg-primary/20 active:scale-95 shrink-0">
                Connect
            </button>
        </div>
    `).join('');
}