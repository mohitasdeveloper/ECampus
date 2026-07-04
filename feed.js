import { supabase } from './supabase.js';
import { showToast } from './ui.js';
import { timeAgo } from './utils.js';

let currentUser = null;

export function initFeed(user) {
    currentUser = user;
    fetchPosts();
    initPullToRefresh();

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
        <div class="bg-white dark:bg-neutral-900 rounded-[28px] p-5 border border-gray-200 dark:border-neutral-800 shadow-sm animate-fadeIn">
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

    const btn = document.getElementById('send-post-btn');
    btn.disabled = true;

    try {
        const { data, error } = await supabase
            .from('posts')
            .insert({ user_id: currentUser.id, content: content })
            .select()
            .single();

        if (error) throw error;

        // Optimistic UI update
        input.value = '';
        const container = document.getElementById('feed-posts-container');
        const newPostHtml = `
        <div class="bg-white dark:bg-neutral-900 rounded-[28px] p-5 border border-gray-200 dark:border-neutral-800 shadow-sm animate-fadeIn">
            <div onclick="window.viewUserProfile('${currentUser.id}')" class="flex items-center gap-3 mb-4 cursor-pointer group">
                <img src="${currentUser.profile_img_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.full_name)}&background=e1e3e4`}" class="w-10 h-10 rounded-full object-cover border border-gray-200 dark:border-neutral-700">
                <div>
                    <p class="font-bold text-sm text-gray-900 dark:text-gray-100 group-hover:text-primary transition-colors">${currentUser.full_name}</p>
                    <p class="text-xs text-gray-500 dark:text-gray-400">Just now</p>
                </div>
            </div>
            <p class="text-[15px] text-gray-800 dark:text-gray-200 leading-relaxed">${content}</p>
            <div class="mt-4 pt-3 border-t border-gray-100 dark:border-neutral-800 flex items-center gap-5">
                <button data-post-id="${data.id}" data-liked="false" class="like-btn flex items-center gap-1.5 text-gray-500 dark:text-gray-400 hover:text-primary dark:hover:text-primary transition-colors">
                    <span class="material-symbols-outlined text-xl" style="font-variation-settings: 'FILL' 0;">favorite</span>
                    <span class="text-xs font-bold">0</span>
                </button>
                <button data-post-id="${data.id}" class="comment-btn flex items-center gap-1.5 text-gray-500 dark:text-gray-400 hover:text-secondary dark:hover:text-secondary transition-colors">
                    <span class="material-symbols-outlined text-xl">chat_bubble</span>
                    <span class="text-xs font-bold">0</span>
                </button>
            </div>
        </div>`;

        const emptyMsg = container.querySelector('p.italic');
        if (emptyMsg) {
            container.innerHTML = newPostHtml;
        } else {
            container.insertAdjacentHTML('afterbegin', newPostHtml);
        }

    } catch (error) {
        showToast('Failed to create post.', 'error');
        console.error('Error submitting post:', error);
    } finally {
        btn.disabled = false;
    }
}

async function handleLike(postId, isLiked) {
    // Optimistic UI update
    const likeBtn = document.querySelector(`.like-btn[data-post-id="${postId}"]`);
    if (!likeBtn) return;

    const countSpan = likeBtn.querySelector('span:last-child');
    const iconSpan = likeBtn.querySelector('span:first-child');
    const currentCount = parseInt(countSpan.textContent);

    // Toggle liked state
    likeBtn.dataset.liked = (!isLiked).toString();
    countSpan.textContent = isLiked ? currentCount - 1 : currentCount + 1;
    iconSpan.classList.toggle('text-primary', !isLiked);
    iconSpan.style.fontVariationSettings = `'FILL' ${!isLiked ? 1 : 0}`;

    try {
        if (isLiked) {
            await supabase.from('post_likes').delete().match({ post_id: postId, user_id: currentUser.id });
        } else {
            await supabase.from('post_likes').insert({ post_id: postId, user_id: currentUser.id });
        }
    } catch (error) {
        console.error("Like error:", error);
        showToast("Couldn't update like.", "error");
        // Revert UI on error
        likeBtn.dataset.liked = isLiked.toString();
        countSpan.textContent = currentCount;
        iconSpan.classList.toggle('text-primary', isLiked);
        iconSpan.style.fontVariationSettings = `'FILL' ${isLiked ? 1 : 0}`;
    }
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
            .select('*, users(id, full_name, profile_img_url)')
            .eq('post_id', postId)
            .order('created_at', { ascending: true });

        if (error) throw error;

        if (data.length === 0) {
            list.innerHTML = `<p class="text-sm italic text-center py-8 text-gray-500 dark:text-gray-400">No comments yet. Be the first!</p>`;
            return;
        }

        list.innerHTML = data.map(comment => `
            <div class="flex items-start gap-3">
                <img onclick="window.viewUserProfile('${comment.users.id}')" src="${comment.users.profile_img_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(comment.users.full_name)}&background=e1e3e4`}" class="w-8 h-8 rounded-full object-cover mt-1 cursor-pointer">
                <div class="flex-1 bg-gray-100 dark:bg-neutral-800 rounded-2xl p-3">
                    <div class="flex justify-between items-center">
                        <p onclick="window.viewUserProfile('${comment.users.id}')" class="text-xs font-bold text-gray-900 dark:text-gray-100 cursor-pointer hover:text-primary transition-colors">${comment.users.full_name}</p>
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

        // Optimistically update comment count on the feed
        const commentBtn = document.querySelector(`.comment-btn[data-post-id="${postId}"]`);
        if (commentBtn) {
            const countSpan = commentBtn.querySelector('span:last-child');
            const currentCount = parseInt(countSpan.textContent);
            countSpan.textContent = currentCount + 1;
        }
    }
}

function initPullToRefresh() {
    const ptrIndicator = document.getElementById('pull-to-refresh-indicator');
    const ptrIcon = document.getElementById('ptr-icon');
    const mainContent = document.getElementById('view-dashboard');

    if (!ptrIndicator || !ptrIcon || !mainContent) return;

    let startY = 0;
    let pullDistance = 0;
    const pullThreshold = 80; // pixels to pull down to trigger refresh
    let isRefreshing = false;

    // Listen on the document for touch events, as the body is the scroll container
    document.addEventListener('touchstart', (e) => {
        // Only track pulls if we are on the feed tab, at the top, and not already refreshing
        if (window.scrollY === 0 && !isRefreshing && mainContent.classList.contains('active')) {
            startY = e.touches[0].pageY;
        }
    }, { passive: true });

    document.addEventListener('touchmove', (e) => {
        if (startY === 0 || isRefreshing) return;

        const currentY = e.touches[0].pageY;
        pullDistance = currentY - startY;

        if (pullDistance > 0) {
            // Prevent the whole page from bouncing on iOS/Android
            e.preventDefault();
            const pullRatio = Math.min(pullDistance / pullThreshold, 1);
            ptrIndicator.style.opacity = String(pullRatio);
            ptrIndicator.style.transform = `translateY(${Math.min(pullDistance / 1.5, pullThreshold)}px)`;
            ptrIcon.style.transform = `rotate(${pullRatio * 180}deg)`;
        }
    }, { passive: false }); // passive:false is needed for preventDefault()

    document.addEventListener('touchend', () => {
        if (isRefreshing || startY === 0 || pullDistance <= 0) return;

        if (pullDistance > pullThreshold) {
            isRefreshing = true;
            ptrIcon.innerHTML = 'progress_activity';
            ptrIcon.classList.add('animate-spin');
            ptrIndicator.style.opacity = '1';
            ptrIndicator.style.transform = `translateY(${pullThreshold - 20}px)`; // Settle position

            fetchPosts().finally(() => {
                isRefreshing = false;
                ptrIndicator.style.opacity = '0';
                ptrIcon.classList.remove('animate-spin');
                ptrIcon.innerHTML = 'arrow_downward';
            });
        } else {
            ptrIndicator.style.opacity = '0';
        }
        startY = 0;
        pullDistance = 0;
    });
}