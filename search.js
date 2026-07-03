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
    fetchExplorePosts();

    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(handleSearch, 300));
    }
}

async function fetchExplorePosts() {
    const container = document.getElementById('explore-grid-container');
    if (!container) return;
    container.innerHTML = `<p class="col-span-3 text-sm italic text-center py-4 text-gray-500 dark:text-gray-400">Loading explore feed...</p>`;

    try {
        const { data, error } = await supabase
            .from('hotposts')
            .select('id, media_url, users!inner(is_private)')
            .eq('users.is_private', false)
            .neq('user_id', currentUser.id)
            .order('created_at', { ascending: false })
            .limit(21);

        if (error) throw error;

        renderExploreGrid(data);

    } catch (error) {
        console.error('Error fetching explore posts:', error);
        container.innerHTML = `<p class="col-span-3 text-sm italic text-center py-4 text-red-500">Could not load explore feed.</p>`;
    }
}

function renderExploreGrid(posts) {
    const container = document.getElementById('explore-grid-container');
    if (posts.length === 0) {
        container.innerHTML = `<p class="col-span-3 text-sm italic text-center py-4 text-gray-500 dark:text-gray-400">Nothing to explore right now.</p>`;
        return;
    }

    container.innerHTML = posts.map(post => `
        <div class="aspect-square bg-gray-100 dark:bg-neutral-800">
            <img src="${post.media_url}" class="w-full h-full object-cover" loading="lazy">
        </div>
    `).join('');
}

async function handleSearch(event) {
    const query = event.target.value.trim();
    const resultsContainer = document.getElementById('search-results-container');
    const exploreContainer = document.getElementById('explore-grid-container');

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
        <div onclick="viewUserProfile('${user.id}')" class="flex items-center gap-4 p-3 bg-white dark:bg-neutral-900 rounded-2xl border border-gray-200 dark:border-neutral-800 shadow-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-neutral-800/50 transition-colors">
            <img src="${user.profile_img_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.full_name)}&background=e1e3e4`}" class="w-12 h-12 rounded-full object-cover">
            <div class="flex-1">
                <p class="font-bold text-sm text-gray-900 dark:text-gray-100">${user.full_name}</p>
                <p class="text-xs text-gray-500 dark:text-gray-400">${user.course || 'Student'}</p>
            </div>
        </div>
    `).join('');
}