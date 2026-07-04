import { supabase } from './supabase.js';
import { showToast } from './ui.js';
import { timeAgo } from './utils.js';

let currentUser = null;

export function initFeed(user) {
    currentUser = user;
    fetchPosts();
    initPullToRefresh();

    // Event delegation for feed interactions
    const feedContainer = document.getElementById('feed-posts-container');
    if (feedContainer) {
        feedContainer.addEventListener('click', (e) => {
            const likeBtn = e.target.closest('.like-btn');
            const commentBtn = e.target.closest('.comment-btn');
            const pollOption = e.target.closest('.poll-option-btn');
            const profileLink = e.target.closest('.profile-link');

            if (likeBtn) handleLike(likeBtn.dataset.postId, likeBtn.dataset.liked === 'true');
            if (commentBtn) openCommentsModal(commentBtn.dataset.postId);
            if (pollOption) handlePollVote(pollOption.dataset.postId, parseInt(pollOption.dataset.optionIndex));
            if (profileLink) window.viewUserProfile(profileLink.dataset.userId);
        });
    }

    // Modal listeners
    document.getElementById('open-create-post-modal')?.addEventListener('click', () => {
        document.getElementById('modal-create-post').classList.replace('hidden', 'flex');
    });
    document.getElementById('close-create-post-modal')?.addEventListener('click', () => {
        document.getElementById('modal-create-post').classList.replace('flex', 'hidden');
    });

    // Create post submission
    document.getElementById('submit-post-btn')?.addEventListener('click', submitPost);

    // Tab switching in create post modal
    document.querySelectorAll('.post-type-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            document.querySelectorAll('.post-type-tab').forEach(t => {
                t.classList.remove('bg-primary', 'text-white');
                t.classList.add('bg-surface-variant', 'text-on-surface-variant');
            });
            e.currentTarget.classList.remove('bg-surface-variant', 'text-on-surface-variant');
            e.currentTarget.classList.add('bg-primary', 'text-white');
            
            document.querySelectorAll('.post-input-section').forEach(sec => sec.classList.add('hidden'));
            document.getElementById(`input-${e.currentTarget.dataset.type}`).classList.remove('hidden');
            document.getElementById('current-post-type').value = e.currentTarget.dataset.type;
        });
    });

    // Comment Modal Listeners
    document.getElementById('close-post-comments-btn')?.addEventListener('click', closeCommentsModal);
    document.getElementById('send-comment-btn')?.addEventListener('click', () => {
        submitComment(document.getElementById('send-comment-btn').dataset.postId);
    });
}

async function fetchPosts() {
    const container = document.getElementById('feed-posts-container');
    if (!container) return;
    container.innerHTML = `<p class="text-sm italic text-center py-4 text-on-surface-variant">Loading live network feed...</p>`;

    try {
        const { data, error } = await supabase
            .from('posts')
            .select(`
                *,
                users ( id, full_name, profile_img_url ),
                post_likes ( user_id ),
                post_comments ( count ),
                post_poll_votes ( user_id, option_index )
            `)
            .order('created_at', { ascending: false })
            .limit(20);

        if (error) throw error;
        renderPosts(data);

    } catch (error) {
        console.error('Error fetching feed posts:', error);
        container.innerHTML = `<p class="text-sm italic text-center py-4 text-error">Failed to load feed.</p>`;
    }
}

function renderPosts(posts) {
    const container = document.getElementById('feed-posts-container');
    if (posts.length === 0) {
        container.innerHTML = `<p class="text-sm italic text-center py-4 text-on-surface-variant">The feed is empty. Be the first to post!</p>`;
        return;
    }

    container.innerHTML = posts.map(post => {
        const user = post.users;
        if (!user) return '';

        const likes = post.post_likes || [];
        const likeCount = likes.length;
        const userHasLiked = likes.some(like => like.user_id === currentUser.id);
        const commentCount = post.post_comments[0]?.count || 0;

        let contentHtml = '';

        // Text Post
        if (post.post_type === 'text') {
            contentHtml = `<p class="text-[14px] text-on-surface leading-relaxed mb-4 px-1">${post.content}</p>`;
        } 
        // Image Post
        else if (post.post_type === 'image') {
            contentHtml = `
                <p class="text-[14px] text-on-surface leading-relaxed mb-3 px-1">${post.content}</p>
                <div class="w-full h-56 rounded-2xl overflow-hidden mb-4 border border-surface-variant/50 shadow-inner">
                    <img src="${post.media_url}" class="w-full h-full object-cover">
                </div>
            `;
        }
        // Event Post
        else if (post.post_type === 'event') {
            contentHtml = `
                <p class="text-[14px] text-on-surface leading-relaxed mb-3 px-1">${post.content}</p>
                <div class="bg-secondary/5 border border-secondary/20 rounded-2xl p-4 mb-4">
                    <div class="flex justify-between items-start mb-2">
                        <div class="bg-secondary/10 text-secondary px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest">Upcoming Event</div>
                    </div>
                    <p class="text-[12px] text-on-surface-variant flex items-center gap-1.5 mb-1.5">
                        <span class="material-symbols-outlined text-[16px]">calendar_today</span> ${new Date(post.event_date).toLocaleString()}
                    </p>
                    <p class="text-[12px] text-on-surface-variant flex items-center gap-1.5">
                        <span class="material-symbols-outlined text-[16px]">location_on</span> ${post.event_location}
                    </p>
                </div>
            `;
        }
        // Poll Post
        else if (post.post_type === 'poll') {
            const votes = post.post_poll_votes || [];
            const totalVotes = votes.length;
            const userVoted = votes.some(v => v.user_id === currentUser.id);

            const optionsHtml = (post.poll_options || []).map((opt, index) => {
                const optVotes = votes.filter(v => v.option_index === index).length;
                const percentage = totalVotes === 0 ? 0 : Math.round((optVotes / totalVotes) * 100);
                const isWinner = percentage > 0 && percentage === Math.max(...(post.poll_options || []).map((_, i) => totalVotes === 0 ? 0 : Math.round((votes.filter(v => v.option_index === i).length / totalVotes) * 100)));

                return `
                <div data-post-id="${post.id}" data-option-index="${index}" class="poll-option-btn relative w-full bg-surface-variant/30 border border-surface-variant/50 rounded-2xl p-3.5 cursor-pointer overflow-hidden group hover:border-primary/50 transition-colors mb-2">
                    <div class="absolute left-0 top-0 bottom-0 bg-primary/20 rounded-r-xl transition-all duration-500" style="width: ${userVoted ? percentage : 0}%"></div>
                    <div class="relative flex justify-between text-[13px] font-medium text-on-surface z-10">
                        <span class="flex items-center gap-2">
                            <span class="w-4 h-4 rounded-full border-2 ${isWinner && userVoted ? 'border-primary flex items-center justify-center' : 'border-surface-variant/80'}">
                                ${isWinner && userVoted ? '<span class="w-2 h-2 rounded-full bg-primary"></span>' : ''}
                            </span>
                            ${opt}
                        </span>
                        <span class="opacity-70 ${!userVoted ? 'hidden' : ''}">${percentage}%</span>
                    </div>
                </div>`;
            }).join('');

            contentHtml = `
                <p class="text-[15px] font-semibold text-on-surface mb-4 px-1">${post.content}</p>
                <div class="space-y-2.5 mb-4 px-1">${optionsHtml}</div>
                <p class="text-[11px] font-medium text-on-surface-variant px-1 mb-2">${totalVotes} votes</p>
            `;
        }

        return `
        <div class="bg-surface-container-lowest dark:bg-[#1e1e1e] rounded-[32px] p-5 border border-surface-variant/60 shadow-sm mb-5 animate-fadeIn">
            <div class="flex items-center gap-3 mb-3">
                <img src="${user.profile_img_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.full_name)}&background=e1e3e4`}" data-user-id="${user.id}" class="profile-link w-10 h-10 rounded-full border border-surface-variant shadow-sm object-cover cursor-pointer hover:opacity-80 transition-opacity">
                <div class="flex-1">
                    <h4 data-user-id="${user.id}" class="profile-link font-bold text-[14px] text-on-surface leading-tight cursor-pointer hover:text-primary transition-colors">${user.full_name}</h4>
                    <p class="text-[11px] text-on-surface-variant mt-0.5">${timeAgo(post.created_at)}</p>
                </div>
                <button class="text-on-surface-variant hover:text-on-surface p-1">
                    <span class="material-symbols-outlined text-[20px]">more_vert</span>
                </button>
            </div>
            
            ${contentHtml}
            
            <div class="flex items-center gap-6 border-t border-surface-variant/40 pt-3 px-1">
                <button data-post-id="${post.id}" data-liked="${userHasLiked}" class="like-btn flex items-center gap-1.5 text-on-surface-variant hover:text-primary transition-colors text-[13px] font-medium active:scale-95 ${userHasLiked ? 'text-primary' : ''}">
                    <span class="material-symbols-outlined text-[20px]" style="font-variation-settings: 'FILL' ${userHasLiked ? 1 : 0};">favorite</span> 
                    <span>${likeCount}</span>
                </button>
                <button data-post-id="${post.id}" class="comment-btn flex items-center gap-1.5 text-on-surface-variant hover:text-secondary transition-colors text-[13px] font-medium active:scale-95">
                    <span class="material-symbols-outlined text-[20px]">chat_bubble</span> 
                    <span>${commentCount}</span>
                </button>
                <button class="flex items-center gap-1.5 text-on-surface-variant hover:text-[#0ea5e9] transition-colors text-[13px] font-medium active:scale-95 ml-auto">
                    <span class="material-symbols-outlined text-[20px]">share</span>
                </button>
            </div>
        </div>
        `;
    }).join('');
}

async function handleLike(postId, isLiked) {
    const likeBtn = document.querySelector(`.like-btn[data-post-id="${postId}"]`);
    if (!likeBtn) return;
    const countSpan = likeBtn.querySelector('span:last-child');
    const iconSpan = likeBtn.querySelector('span:first-child');
    const currentCount = parseInt(countSpan.textContent);

    likeBtn.dataset.liked = (!isLiked).toString();
    countSpan.textContent = isLiked ? currentCount - 1 : currentCount + 1;
    likeBtn.classList.toggle('text-primary', !isLiked);
    iconSpan.style.fontVariationSettings = `'FILL' ${!isLiked ? 1 : 0}`;

    try {
        if (isLiked) {
            await supabase.from('post_likes').delete().match({ post_id: postId, user_id: currentUser.id });
        } else {
            await supabase.from('post_likes').insert({ post_id: postId, user_id: currentUser.id });
        }
    } catch (error) {
        console.error("Like error:", error);
    }
}

async function handlePollVote(postId, optionIndex) {
    try {
        const { error } = await supabase.from('post_poll_votes').insert({
            post_id: postId,
            user_id: currentUser.id,
            option_index: optionIndex
        });
        if (error) {
            if(error.code === '23505') showToast('You already voted on this poll.', 'warning');
            else throw error;
        } else {
            fetchPosts(); // Refresh to show results
        }
    } catch (error) {
        console.error("Poll vote error:", error);
        showToast("Couldn't submit vote.", "error");
    }
}

async function submitPost() {
    const postType = document.getElementById('current-post-type').value;
    const content = document.getElementById('post-content-input').value.trim();
    
    if (!content) {
        showToast('Please write something to post.', 'warning');
        return;
    }

    const btn = document.getElementById('submit-post-btn');
    btn.disabled = true;
    btn.textContent = 'Posting...';

    let payload = { user_id: currentUser.id, post_type: postType, content: content };

    try {
        if (postType === 'image') {
            payload.media_url = document.getElementById('post-image-url').value;
        } else if (postType === 'poll') {
            const opt1 = document.getElementById('poll-opt-1').value;
            const opt2 = document.getElementById('poll-opt-2').value;
            if(!opt1 || !opt2) throw new Error("Polls need at least 2 options");
            payload.poll_options = [opt1, opt2];
        } else if (postType === 'event') {
            payload.event_date = document.getElementById('event-date').value;
            payload.event_location = document.getElementById('event-location').value;
        }

        const { error } = await supabase.from('posts').insert(payload);
        if (error) throw error;

        document.getElementById('modal-create-post').classList.replace('flex', 'hidden');
        document.getElementById('post-content-input').value = '';
        fetchPosts();

    } catch (error) {
        showToast(error.message || 'Failed to create post.', 'error');
        console.error('Error submitting post:', error);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Post';
    }
}

async function openCommentsModal(postId) {
    const modal = document.getElementById('modal-post-comments');
    const list = document.getElementById('post-comments-list');
    document.getElementById('send-comment-btn').dataset.postId = postId;

    modal.classList.replace('hidden', 'flex');
    list.innerHTML = `<p class="text-sm italic text-center py-8 text-on-surface-variant">Loading comments...</p>`;

    try {
        const { data, error } = await supabase
            .from('post_comments')
            .select('*, users(id, full_name, profile_img_url)')
            .eq('post_id', postId)
            .order('created_at', { ascending: true });

        if (error) throw error;

        if (data.length === 0) {
            list.innerHTML = `<p class="text-sm italic text-center py-8 text-on-surface-variant">No comments yet. Be the first!</p>`;
            return;
        }

        list.innerHTML = data.map(comment => `
            <div class="flex items-start gap-3">
                <img onclick="window.viewUserProfile('${comment.users.id}')" src="${comment.users.profile_img_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(comment.users.full_name)}&background=e1e3e4`}" class="w-8 h-8 rounded-full object-cover mt-1 cursor-pointer hover:opacity-80 transition-opacity">
                <div class="flex-1 bg-surface-variant/30 rounded-2xl p-3 border border-surface-variant/50">
                    <div class="flex justify-between items-center mb-1">
                        <p onclick="window.viewUserProfile('${comment.users.id}')" class="text-xs font-bold text-on-surface cursor-pointer hover:text-primary transition-colors">${comment.users.full_name}</p>
                        <p class="text-[10px] text-on-surface-variant">${timeAgo(comment.created_at)}</p>
                    </div>
                    <p class="text-sm text-on-surface leading-relaxed">${comment.content}</p>
                </div>
            </div>
        `).join('');

    } catch (error) {
        console.error('Error fetching comments:', error);
        list.innerHTML = `<p class="text-sm italic text-center py-8 text-error">Failed to load comments.</p>`;
    }
}

function closeCommentsModal() {
    const modal = document.getElementById('modal-post-comments');
    if (modal) modal.classList.replace('flex', 'hidden');
    const input = document.getElementById('post-comment-input');
    if (input) input.value = '';
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
    const pullThreshold = 80;
    let isRefreshing = false;

    document.addEventListener('touchstart', (e) => {
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
            if (e.cancelable) e.preventDefault();
            const pullRatio = Math.min(pullDistance / pullThreshold, 1);
            ptrIndicator.style.opacity = String(pullRatio);
            ptrIndicator.style.transform = `translateY(${Math.min(pullDistance / 1.5, pullThreshold)}px)`;
            ptrIcon.style.transform = `rotate(${pullRatio * 180}deg)`;
        }
    }, { passive: false });

    document.addEventListener('touchend', () => {
        if (isRefreshing || startY === 0 || pullDistance <= 0) return;

        if (pullDistance > pullThreshold) {
            isRefreshing = true;
            ptrIcon.innerHTML = 'progress_activity';
            ptrIcon.classList.add('animate-spin');
            ptrIndicator.style.opacity = '1';
            ptrIndicator.style.transform = `translateY(${pullThreshold - 20}px)`; 

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
