import { supabase } from './supabase.js';

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
}

async function fetchPopularUsersForSearch() {
    const container = document.getElementById('explore-users-container');
    if (!container) return;
    container.innerHTML = `<p class="text-sm italic text-center py-4 text-on-surface-variant dark:text-gray-400">Loading popular users...</p>`;

    try {
        const { data: users, error } = await supabase
            .from('users')
            .select('id, full_name, profile_img_url, course, connection_count')
            .neq('id', currentUser.id)
            .order('connection_count', { ascending: false, nulls: 'last' })
            .limit(15);

        if (error) throw error;
        renderPopularUsersForSearch(users);

    } catch (error) {
        console.error('Error fetching popular users:', error);
        container.innerHTML = `<p class="text-sm italic text-center py-4 text-error">Could not load popular users.</p>`;
    }
}

function renderPopularUsersForSearch(users) {
    const container = document.getElementById('explore-users-container');
    if (users.length === 0) {
        container.innerHTML = `<p class="text-sm italic text-center py-4 text-on-surface-variant dark:text-gray-400">No popular users to show right now.</p>`;
        return;
    }

    const labelHtml = `<h3 class="text-[14px] font-bold text-on-surface dark:text-gray-100 mb-3 px-1">Popular Users</h3>`;

    const usersHtml = users.map(user => `
        <div onclick="viewUserProfile('${user.id}')" class="flex items-center gap-3.5 p-2 -mx-2 hover:bg-surface-variant/40 dark:hover:bg-neutral-800/50 rounded-xl cursor-pointer active:scale-[0.98] transition-all">
            <img src="${user.profile_img_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.full_name)}&background=e1e3e4`}" class="w-14 h-14 rounded-full object-cover border border-surface-variant/50 shadow-sm shrink-0">
            <div class="flex-1 min-w-0">
                <p class="font-bold text-[14px] text-on-surface dark:text-gray-100 truncate">${user.full_name}</p>
                <p class="text-[12px] text-on-surface-variant dark:text-gray-400 truncate">${user.course || 'Student'} • ${user.connection_count || 0} connections</p>
            </div>
        </div>
    `).join('');

    container.innerHTML = labelHtml + usersHtml;
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
    resultsContainer.innerHTML = `<p class="text-sm italic text-center py-4 text-on-surface-variant dark:text-gray-400">Searching...</p>`;

    try {
        const { data, error } = await supabase
            .from('users')
            .select('id, full_name, profile_img_url, course, connection_count')
            .or(`full_name.ilike.%${query}%,student_id.ilike.%${query}%`)
            .neq('id', currentUser.id)
            .limit(10);

        if (error) throw error;
        renderSearchResults(data);

    } catch (error) {
        console.error('Error searching users:', error);
        resultsContainer.innerHTML = `<p class="text-sm italic text-center py-4 text-error">Error during search.</p>`;
    }
}

function renderSearchResults(users) {
    const container = document.getElementById('search-results-container');
    if (users.length === 0) {
        container.innerHTML = `<p class="text-sm italic text-center py-4 text-on-surface-variant dark:text-gray-400">No students found.</p>`;
        return;
    }

    container.innerHTML = users.map(user => `
        <div onclick="viewUserProfile('${user.id}')" class="flex items-center gap-3.5 p-2 -mx-2 hover:bg-surface-variant/40 dark:hover:bg-neutral-800/50 rounded-xl cursor-pointer active:scale-[0.98] transition-all">
            <img src="${user.profile_img_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.full_name)}&background=e1e3e4`}" class="w-14 h-14 rounded-full object-cover border border-surface-variant/50 shadow-sm shrink-0">
            <div class="flex-1 min-w-0">
                <p class="font-bold text-[14px] text-on-surface dark:text-gray-100 truncate">${user.full_name}</p>
                <p class="text-[12px] text-on-surface-variant dark:text-gray-400 truncate">${user.course || 'Student'} • ${user.connection_count || 0} connections</p>
            </div>
        </div>
    `).join('');
}
