import { supabase } from './supabase.js';
import { showToast } from './ui.js';
import { timeAgo } from './utils.js';

let currentUser = null;

export function initFeed(user) {
    currentUser = user;
    fetchPosts();

    const sendBtn = document.getElementById('send-post-btn');
    if (sendBtn) {
        sendBtn.addEventListener('click', submitPost);
    }
}

async function fetchPosts() {
    const container = document.getElementById('feed-posts-container');
    if (!container) return;
    container.innerHTML = `<p class="text-sm italic text-center py-4 text-gray-500 dark:text-gray-400">Loading live network feed...</p>`;

    try {
        const { data, error } = await supabase
            .from('posts')
            .select(`
                id,
                content,
                created_at,
                users ( full_name, profile_img_url )
            `)
            .order('created_at', { ascending: false })
            .limit(20);

        if (error) throw error;

        renderPosts(data);

    } catch (error) {
        console.error('Error fetching feed posts:', error);
        container.innerHTML = `<p class="text-sm italic text-center py-4 text-red-500">Failed to load feed.</p>`;
    }
}

function renderPosts(posts) {
    const container = document.getElementById('feed-posts-container');
    if (posts.length === 0) {
        container.innerHTML = `<p class="text-sm italic text-center py-4 text-gray-500 dark:text-gray-400">The feed is empty. Be the first to post!</p>`;
        return;
    }

    container.innerHTML = posts.map(post => {
        const user = post.users;
        if (!user) return ''; // Skip posts with no user data

        return `
        <div class="bg-white dark:bg-neutral-900 rounded-[28px] p-5 border border-gray-200 dark:border-neutral-800 shadow-sm">
            <div class="flex items-center gap-3 mb-4">
                <img src="${user.profile_img_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.full_name)}&background=e1e3e4`}" class="w-10 h-10 rounded-full object-cover border border-gray-200 dark:border-neutral-700">
                <div>
                    <p class="font-bold text-sm text-gray-900 dark:text-gray-100">${user.full_name}</p>
                    <p class="text-xs text-gray-500 dark:text-gray-400">${timeAgo(post.created_at)}</p>
                </div>
            </div>
            <p class="text-[15px] text-gray-800 dark:text-gray-200 leading-relaxed">${post.content}</p>
        </div>
        `;
    }).join('');
}

async function submitPost() {
    const input = document.getElementById('post-input');
    const content = input.value.trim();

    if (!content) {
        showToast('Please write something to post.', 'warning');
        return;
    }

    const { error } = await supabase.from('posts').insert({ user_id: currentUser.id, content: content });

    if (error) {
        showToast('Failed to create post.', 'error');
        console.error('Error submitting post:', error);
    } else {
        input.value = '';
        fetchPosts(); // Refresh the feed
    }
}