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

    // Use event delegation for likes and comments
    const feedContainer = document.getElementById('feed-posts-container');
    if (feedContainer) {
        feedContainer.addEventListener('click', (e) => {
            const likeBtn = e.target.closest('.like-btn');
            const commentBtn = e.target.closest('.comment-btn');

            if (likeBtn) {
                handleLike(likeBtn.dataset.postId, likeBtn.dataset.liked === 'true');
            } else if (commentBtn) {
                openCommentsModal(commentBtn.dataset.postId);
            }
        });
    }

    // Comment Modal Listeners
    document.getElementById('close-post-comments-btn')?.addEventListener('click', closeCommentsModal);
    document.getElementById('send-comment-btn')?.addEventListener('click', () => {
        submitComment(document.getElementById('send-comment-btn').dataset.postId);
    });
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
                users ( id, full_name, profile_img_url ),
                post_likes ( user_id ),
                post_comments ( count )
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

        const likes = post.post_likes || [];
        const likeCount = likes.length;
        const userHasLiked = likes.some(like => like.user_id === currentUser.id);
        const commentCount = post.post_comments[0]?.count || 0;

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
            <div class="mt-4 pt-3 border-t border-gray-100 dark:border-neutral-800 flex items-center gap-5">
                <button data-post-id="${post.id}" data-liked="${userHasLiked}" class="like-btn flex items-center gap-1.5 text-gray-500 dark:text-gray-400 hover:text-primary dark:hover:text-primary transition-colors">
                    <span class="material-symbols-outlined text-xl ${userHasLiked ? 'text-primary' : ''}" style="font-variation-settings: 'FILL' ${userHasLiked ? 1 : 0};">${userHasLiked ? 'favorite' : 'favorite'}</span>
                    <span class="text-xs font-bold">${likeCount}</span>
                </button>
                <button data-post-id="${post.id}" class="comment-btn flex items-center gap-1.5 text-gray-500 dark:text-gray-400 hover:text-secondary dark:hover:text-secondary transition-colors">
                    <span class="material-symbols-outlined text-xl">chat_bubble</span>
                    <span class="text-xs font-bold">${commentCount}</span>
                </button>
            </div>
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

async function handleLike(postId, isLiked) {
    if (isLiked) {
        // Unlike
        await supabase.from('post_likes').delete().match({ post_id: postId, user_id: currentUser.id });
    } else {
        // Like
        await supabase.from('post_likes').insert({ post_id: postId, user_id: currentUser.id });
    }
    fetchPosts(); // Simple refresh for now
}

async function openCommentsModal(postId) {
    const modal = document.getElementById('modal-post-comments');
    const list = document.getElementById('post-comments-list');
    document.getElementById('send-comment-btn').dataset.postId = postId;

    modal.classList.replace('hidden', 'flex');
    list.innerHTML = `<p class="text-sm italic text-center py-8 text-gray-500 dark:text-gray-400">Loading comments...</p>`;

    try {
        const { data, error } = await supabase
            .from('post_comments')
            .select('*, users(full_name, profile_img_url)')
            .eq('post_id', postId)
            .order('created_at', { ascending: true });

        if (error) throw error;

        if (data.length === 0) {
            list.innerHTML = `<p class="text-sm italic text-center py-8 text-gray-500 dark:text-gray-400">No comments yet. Be the first!</p>`;
            return;
        }

        list.innerHTML = data.map(comment => `
            <div class="flex items-start gap-3">
                <img src="${comment.users.profile_img_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(comment.users.full_name)}&background=e1e3e4`}" class="w-8 h-8 rounded-full object-cover mt-1">
                <div class="flex-1 bg-gray-100 dark:bg-neutral-800 rounded-2xl p-3">
                    <div class="flex justify-between items-center">
                        <p class="text-xs font-bold text-gray-900 dark:text-gray-100">${comment.users.full_name}</p>
                        <p class="text-[10px] text-gray-400 dark:text-gray-500">${timeAgo(comment.created_at)}</p>
                    </div>
                    <p class="text-sm text-gray-700 dark:text-gray-300 mt-1">${comment.content}</p>
                </div>
            </div>
        `).join('');

    } catch (error) {
        console.error('Error fetching comments:', error);
        list.innerHTML = `<p class="text-sm italic text-center py-8 text-red-500">Failed to load comments.</p>`;
    }
}

function closeCommentsModal() {
    document.getElementById('modal-post-comments').classList.replace('flex', 'hidden');
    document.getElementById('post-comment-input').value = '';
}

async function submitComment(postId) {
    const input = document.getElementById('post-comment-input');
    const content = input.value.trim();
    if (!content) return;

    const { error } = await supabase.from('post_comments').insert({
        post_id: postId,
        user_id: currentUser.id,
        content: content
    });

    if (error) {
        showToast('Failed to post comment.', 'error');
        console.error('Error submitting comment:', error);
    } else {
        input.value = '';
        openCommentsModal(postId); // Refresh the comments list
        fetchPosts(); // Refresh the main feed to update comment count
    }
}