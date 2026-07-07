import { supabase } from './supabase.js';
import { showToast } from './ui.js';
import { timeAgo } from './utils.js';
import { CLOUDINARY_CLOUD_NAME } from './config.js';

let currentUser = null;
let isVoting = false; // Lock to prevent rapid clicking on polls

export function initFeed(user) {
    currentUser = user;
    
    // Check permission to show advanced post tabs
    setupCreatePostPermissions();
    
    fetchPosts();
    setupImagePreviews();

    // Fill user info in Create Post modal when opened
    document.addEventListener('openCreatePostView', () => {
        if(currentUser) {
            document.getElementById('create-post-avatar').src = currentUser.profile_img_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.full_name)}&background=e1e3e4`;
            document.getElementById('create-post-name').innerHTML = `${currentUser.full_name} ${getTickHtml(currentUser.tick_type)}`;
        }
    });

    // 1. Event Delegation for Feed Interactions
    const feedContainer = document.getElementById('feed-posts-container');
    if (feedContainer) {
        feedContainer.addEventListener('click', (e) => {
            const likeBtn = e.target.closest('.like-btn');
            const commentBtn = e.target.closest('.comment-btn');
            const pollOption = e.target.closest('.poll-option-btn');
            const profileLink = e.target.closest('.profile-link');
            const optionsBtn = e.target.closest('.post-options-btn');
            if (likeBtn) handleLike(likeBtn.dataset.postId, likeBtn.dataset.liked === 'true');
            if (commentBtn) openCommentsModal(commentBtn.dataset.postId);
            if (pollOption) handlePollVote(pollOption.dataset.postId, parseInt(pollOption.dataset.optionIndex), pollOption.dataset.isMultiple === 'true');
            if (profileLink) window.viewUserProfile(profileLink.dataset.userId);
            if (optionsBtn) openPostOptions(optionsBtn.dataset.postId, optionsBtn.dataset.userId, optionsBtn.dataset.isVerified === 'true');
        });
    }

    // 2. Event Delegation for Comment Interactions
    const commentsList = document.getElementById('post-comments-list');
    if (commentsList) {
        commentsList.addEventListener('click', (e) => {
            const optionsBtn = e.target.closest('.comment-options-btn');
            if (optionsBtn) openCommentOptions(optionsBtn.dataset.commentId, optionsBtn.dataset.userId);
        });
    }

    // 3. Modals and Submissions
    document.getElementById('submit-post-btn')?.addEventListener('click', submitPost);
    document.getElementById('send-comment-btn')?.addEventListener('click', () => {
        submitComment(document.getElementById('send-comment-btn').dataset.postId);
    });
    
    document.getElementById('submit-report-post-btn')?.addEventListener('click', submitPostReport);
    document.getElementById('close-post-comments-btn')?.addEventListener('click', closeCommentsModal);

    // 4. Tab switching in create post modal
    document.querySelectorAll('.post-type-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            document.querySelectorAll('.post-type-tab').forEach(t => {
                t.classList.remove('bg-primary', 'text-white');
                t.classList.add('bg-surface-variant/50', 'dark:bg-surface-variant/10', 'text-on-surface-variant', 'dark:text-gray-300');
            });
            e.currentTarget.classList.remove('bg-surface-variant/50', 'dark:bg-surface-variant/10', 'text-on-surface-variant', 'dark:text-gray-300');
            e.currentTarget.classList.add('bg-primary', 'text-white');
            
            document.querySelectorAll('.post-input-section').forEach(sec => {
                sec.classList.remove('block');
                sec.classList.add('hidden');
            });
            const targetSection = document.getElementById(`input-${e.currentTarget.dataset.type}`);
            if(targetSection) {
                targetSection.classList.remove('hidden');
                targetSection.classList.add('block');
            }
            document.getElementById('current-post-type').value = e.currentTarget.dataset.type;
        });
    });
}

function getTickHtml(tickType) {
    if (!tickType || tickType === 'none') return '';
    const colors = {
        blue: 'text-[#1d9bf0]',
        gold: 'text-[#e8b339]',
        green: 'text-primary',
        gray: 'text-surface-variant'
    };
    const colorClass = colors[tickType.toLowerCase()] || colors.blue;
    return `<span class="material-symbols-outlined text-[14px] ${colorClass} ml-1" style="font-variation-settings: 'FILL' 1;">verified</span>`;
}

function setupCreatePostPermissions() {
    if (currentUser?.special_post) {
        document.querySelectorAll('.post-type-tab').forEach(tab => tab.classList.remove('hidden'));
    } else {
        document.querySelectorAll('.post-type-tab:not([data-type="text"])').forEach(tab => tab.classList.add('hidden'));
    }
}

function setupImagePreviews() {
    const attachPreview = (inputId, containerId, iconId, textId) => {
        const input = document.getElementById(inputId);
        const container = document.getElementById(containerId);
        if(!input || !container) return;
        
        input.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    container.innerHTML = `
                        <img src="${event.target.result}" class="w-full h-auto max-h-[60vh] object-contain rounded-xl">
                        <button type="button" class="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1 hover:bg-black/80 transition-colors z-10" onclick="event.stopPropagation(); document.getElementById('${inputId}').value=''; document.getElementById('${containerId}').innerHTML='<span class=\\'material-symbols-outlined text-[32px] mb-2\\'>${iconId}</span><span class=\\'text-sm font-medium\\'>${textId}</span>';">
                            <span class="material-symbols-outlined text-[18px]">close</span>
                        </button>
                    `;
                };
                reader.readAsDataURL(file);
            }
        });
    };

    attachPreview('post-image-upload', 'post-image-preview-container', 'add_photo_alternate', 'Tap to upload image');
    attachPreview('event-image-upload', 'event-image-preview-container', 'wallpaper', 'Add Event Cover Photo');
}

async function uploadToCloudinary(file) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', 'ecampus_posts');

    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
        method: 'POST',
        body: formData,
    });
    
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    return data.secure_url;
}

// ==========================================
// POST CREATION
// ==========================================

async function submitPost() {
    const postType = document.getElementById('current-post-type').value;
    const content = document.getElementById('post-content-input').value.trim();
    
    if (!content) {
        showToast('Please write something to post.', 'warning');
        return;
    }

    const btn = document.getElementById('submit-post-btn');
    btn.disabled = true;
    btn.textContent = 'Publishing...';

    let payload = { user_id: currentUser.id, post_type: postType, content: content };

    try {
        if (postType === 'image') {
            const fileInput = document.getElementById('post-image-upload');
            if (!fileInput.files[0]) throw new Error("Please select an image to upload.");
            payload.media_url = await uploadToCloudinary(fileInput.files[0]);
        } 
        else if (postType === 'poll') {
            const inputs = document.querySelectorAll('.poll-opt-input');
            const options = Array.from(inputs).map(inp => inp.value.trim()).filter(val => val !== '');
            if(options.length < 2) throw new Error("Polls need at least 2 options.");
            
            payload.poll_options = options;
            payload.poll_is_anon = document.getElementById('poll-is-anon').checked;
            payload.poll_is_multiple_choice = document.getElementById('poll-is-multiple').checked;
            
            const expiry = document.getElementById('poll-expiry').value;
            if (expiry) payload.poll_expires_at = new Date(expiry).toISOString();
        } 
        else if (postType === 'event') {
            const fileInput = document.getElementById('event-image-upload');
            if (fileInput.files[0]) {
                payload.event_image_url = await uploadToCloudinary(fileInput.files[0]);
            }
            payload.event_date = document.getElementById('event-date').value || null;
            payload.event_location = document.getElementById('event-location').value.trim();
            payload.event_register_url = document.getElementById('event-register-url').value.trim();
            // Capture the new custom button text, defaulting to 'View Link'
            const customBtnInput = document.getElementById('event-button-text');
            payload.event_button_text = (customBtnInput && customBtnInput.value.trim()) ? customBtnInput.value.trim() : 'View Link';
        }

        const { error } = await supabase.from('posts').insert(payload);
        if (error) throw error;

        // Reset and close view
        window.closeCreatePostView();
        document.getElementById('post-content-input').value = '';
        if (document.getElementById('post-image-upload')) document.getElementById('post-image-upload').value = '';
        if (document.getElementById('event-image-upload')) document.getElementById('event-image-upload').value = '';
        if (document.getElementById('event-button-text')) document.getElementById('event-button-text').value = '';
        
        showToast('Post published successfully!', 'success');
        fetchPosts();

    } catch (error) {
        showToast(error.message || 'Failed to create post.', 'error');
        console.error('Error submitting post:', error);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Publish';
    }
}

// ==========================================
// FETCHING & RENDERING POSTS
// ==========================================

async function fetchPosts() {
    const container = document.getElementById('feed-posts-container');
    if (!container) return;
    container.innerHTML = `<p class="text-sm italic text-center py-4 text-on-surface-variant dark:text-gray-400">Loading live network feed...</p>`;

    try {
        const { data, error } = await supabase
            .from('posts')
            .select(`
                *,
                users ( id, full_name, profile_img_url, role, tick_type ),
                post_likes ( user_id ),
                post_comments ( count ),
                post_poll_votes ( user_id, option_index )
            `)
            .eq('is_deleted', false)
            .order('created_at', { ascending: false })
            .limit(30);

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
        container.innerHTML = `<p class="text-sm italic text-center py-4 text-on-surface-variant dark:text-gray-400">The feed is empty. Be the first to post!</p>`;
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
        const verifiedBadge = getTickHtml(user.tick_type);
        
        // Consistent DP Header for ALL post types
        const headerIcon = `<img src="${user.profile_img_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.full_name)}&background=e1e3e4`}" data-user-id="${user.id}" class="profile-link w-10 h-10 rounded-full border border-surface-variant shadow-sm object-cover cursor-pointer hover:opacity-80 transition-opacity shrink-0">`;

        // Text Post
        if (post.post_type === 'text') {
            contentHtml = `<p class="text-[14px] text-on-surface dark:text-gray-100 leading-relaxed mb-4 px-1 whitespace-pre-wrap">${post.content}</p>`;
        } 
        // Image Post
        else if (post.post_type === 'image') {
            contentHtml = `
                <p class="text-[14px] text-on-surface dark:text-gray-100 leading-relaxed mb-3 px-1 whitespace-pre-wrap">${post.content}</p>
                <div class="w-full mb-4 rounded-2xl overflow-hidden border border-surface-variant/50 dark:border-neutral-800 shadow-inner bg-surface-variant/20 dark:bg-neutral-900 flex items-center justify-center">
                    <img src="${post.media_url}" class="w-full h-auto max-h-[80vh] object-contain">
                </div>
            `;
        }
        // Event Post
        else if (post.post_type === 'event') {
            const eventImgHtml = post.event_image_url ? `<img src="${post.event_image_url}" class="w-full h-auto max-h-[60vh] object-contain bg-black/5 dark:bg-white/5 border-b border-secondary/20">` : '';
            const btnText = post.event_button_text || 'View Link';
            const registerHtml = post.event_register_url ? `<a href="${post.event_register_url}" target="_blank" class="block w-full mt-4 bg-secondary text-white text-center py-2.5 rounded-xl text-[13px] font-bold active:scale-95 transition-transform shadow-md shadow-secondary/20">${btnText}</a>` : '';
            const dateStr = post.event_date ? new Date(post.event_date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'TBA';

            contentHtml = `
                <div class="bg-secondary/5 border border-secondary/20 rounded-2xl mb-4 flex flex-col overflow-hidden">
                    ${eventImgHtml}
                    <div class="p-5">
                        <div class="bg-secondary/10 text-secondary w-max px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest mb-3">Upcoming Event</div>
                        <p class="text-[15px] font-semibold text-on-surface dark:text-gray-100 leading-relaxed mb-4 whitespace-pre-wrap">${post.content}</p>
                        
                        <div class="space-y-2">
                            <p class="text-[13px] text-on-surface-variant dark:text-gray-300 flex items-center gap-2 font-medium">
                                <span class="material-symbols-outlined text-[18px]">calendar_today</span> ${dateStr}
                            </p>
                            ${post.event_location ? `<p class="text-[13px] text-on-surface-variant dark:text-gray-300 flex items-center gap-2 font-medium"><span class="material-symbols-outlined text-[18px]">location_on</span> ${post.event_location}</p>` : ''}
                        </div>
                        ${registerHtml}
                    </div>
                </div>
            `;
        }
        // Poll Post
        else if (post.post_type === 'poll') {
            const votes = post.post_poll_votes || [];
            const totalVotes = votes.length;
            const myVotes = votes.filter(v => v.user_id === currentUser.id).map(v => v.option_index);
            const userHasVoted = myVotes.length > 0;
            
            const isExpired = post.poll_expires_at && new Date(post.poll_expires_at) < new Date();
            const showResults = userHasVoted || isExpired || post.poll_is_anon;

            const optionsHtml = (post.poll_options || []).map((opt, index) => {
                const optVotes = votes.filter(v => v.option_index === index).length;
                const percentage = totalVotes === 0 ? 0 : Math.round((optVotes / totalVotes) * 100);
                const isWinner = percentage > 0 && percentage === Math.max(...(post.poll_options || []).map((_, i) => totalVotes === 0 ? 0 : Math.round((votes.filter(v => v.option_index === i).length / totalVotes) * 100)));
                const iVotedForThis = myVotes.includes(index);
                
                // Show voters button if public
                const viewVotersBtn = (!post.poll_is_anon && optVotes > 0) ? `<span onclick="event.stopPropagation(); window.openPollVoters('${post.id}', ${index})" class="material-symbols-outlined text-[16px] ml-1.5 text-on-surface-variant hover:text-primary transition-colors cursor-pointer" title="View Voters">visibility</span>` : '';

                return `
                <div data-post-id="${post.id}" data-option-index="${index}" data-is-multiple="${post.poll_is_multiple_choice}" class="poll-option-btn ${!isExpired ? 'cursor-pointer active:scale-[0.98]' : 'cursor-default'} relative w-full bg-surface-variant/30 dark:bg-surface-variant/10 border border-surface-variant/50 dark:border-neutral-700 rounded-2xl p-3.5 overflow-hidden group hover:border-primary/50 transition-all mb-2">
                    <div class="poll-progress-bar absolute left-0 top-0 bottom-0 bg-primary/20 rounded-r-xl transition-all duration-700 ease-out" style="width: ${showResults ? percentage : 0}%"></div>
                    <div class="relative flex justify-between items-center text-[13px] font-bold text-on-surface dark:text-gray-100 z-10">
                        <span class="flex items-center gap-2">
                            <span class="poll-check-circle w-4 h-4 rounded-full border-2 ${iVotedForThis ? 'border-primary flex items-center justify-center' : 'border-surface-variant/80 dark:border-gray-500'}">
                                ${iVotedForThis ? '<span class="w-2 h-2 rounded-full bg-primary"></span>' : ''}
                            </span>
                            ${opt}
                        </span>
                        <span class="flex items-center">
                            <span class="poll-percentage ${showResults ? 'opacity-100' : 'opacity-0'} transition-opacity">${percentage}%</span>
                            ${viewVotersBtn}
                        </span>
                    </div>
                </div>`;
            }).join('');

            const expiryText = isExpired ? 'Poll ended' : (post.poll_expires_at ? `Ends ${timeAgo(post.poll_expires_at)}` : 'Ongoing');
            const typeText = post.poll_is_multiple_choice ? 'Multiple choice' : 'Single choice';

            contentHtml = `
                <p class="text-[15px] font-semibold text-on-surface dark:text-gray-100 mb-4 px-1 whitespace-pre-wrap">${post.content}</p>
                <div class="poll-options-wrapper space-y-2.5 mb-3 px-1">${optionsHtml}</div>
                <div class="flex justify-between px-2 text-[11px] font-medium text-on-surface-variant dark:text-gray-400 mb-2">
                    <span class="poll-footer-text"><span class="poll-total-votes">${totalVotes}</span> votes • ${typeText} ${post.poll_is_anon ? 'Anonymous' : 'Public'}</span>
                    <span>${expiryText}</span>
                </div>
            `;
        }

        return `
        <div data-post-id="${post.id}" class="bg-surface-container-lowest dark:bg-[#1e1e1e] rounded-[32px] p-5 border border-surface-variant/60 dark:border-neutral-800 shadow-sm mb-5 animate-fadeIn relative">
            
            ${post.is_verified ? '<div class="absolute -top-3 -right-3 bg-[#e8b339] text-white px-3 py-1 rounded-full text-[10px] font-extrabold uppercase shadow-lg shadow-[#e8b339]/30 flex items-center gap-1 z-10"><span class="material-symbols-outlined text-[14px]">stars</span> Verified Post</div>' : ''}

            <div class="flex items-center gap-3 mb-3">
                ${headerIcon}
                <div class="flex-1">
                    <h4 data-user-id="${user.id}" class="profile-link font-bold text-[14px] text-on-surface dark:text-gray-100 leading-tight cursor-pointer hover:text-primary transition-colors flex items-center gap-1">
                        ${user.full_name} ${verifiedBadge}
                    </h4>
                    <p class="text-[11px] text-on-surface-variant dark:text-gray-400 mt-0.5">${timeAgo(post.created_at)}</p>
                </div>
                <button data-post-id="${post.id}" data-user-id="${user.id}" data-is-verified="${post.is_verified}" class="post-options-btn text-on-surface-variant hover:text-on-surface dark:text-gray-400 dark:hover:text-gray-100 p-1 rounded-full hover:bg-surface-variant/50 transition-colors">
                    <span class="material-symbols-outlined text-[20px]">more_vert</span>
                </button>
            </div>
            
            ${contentHtml}
            
            <div class="flex items-center gap-6 border-t border-surface-variant/40 dark:border-neutral-800 pt-3 px-1 mt-2">
                <button data-post-id="${post.id}" data-liked="${userHasLiked}" class="like-btn flex items-center gap-1.5 text-on-surface-variant hover:text-primary transition-colors text-[13px] font-medium active:scale-95 ${userHasLiked ? 'text-primary' : 'dark:text-gray-400'}">
                    <span class="material-symbols-outlined text-[20px]" style="font-variation-settings: 'FILL' ${userHasLiked ? 1 : 0};">favorite</span> 
                    <span>${likeCount}</span>
                </button>
                <button data-post-id="${post.id}" class="comment-btn flex items-center gap-1.5 text-on-surface-variant dark:text-gray-400 hover:text-secondary transition-colors text-[13px] font-medium active:scale-95">
                    <span class="material-symbols-outlined text-[20px]">chat_bubble</span> 
                    <span>${commentCount}</span>
                </button>
            </div>
        </div>
        `;
    }).join('');
}

// ==========================================
// INTERACTIONS & ACTIONS
// ==========================================

async function handleLike(postId, isLiked) {
    const likeBtn = document.querySelector(`.like-btn[data-post-id="${postId}"]`);
    if (!likeBtn) return;
    const countSpan = likeBtn.querySelector('span:last-child');
    const iconSpan = likeBtn.querySelector('span:first-child');
    const currentCount = parseInt(countSpan.textContent);

    likeBtn.dataset.liked = (!isLiked).toString();
    countSpan.textContent = isLiked ? currentCount - 1 : currentCount + 1;
    
    if(!isLiked) {
        likeBtn.classList.add('text-primary');
        likeBtn.classList.remove('dark:text-gray-400');
    } else {
        likeBtn.classList.remove('text-primary');
        likeBtn.classList.add('dark:text-gray-400');
    }
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

// Fixed Poll Voting with Local DOM Update and UI state locking
async function handlePollVote(postId, optionIndex, isMultipleChoice) {
    if (isVoting) return; // Prevent rapid clicking while processing
    isVoting = true;
    
    try {
        // We now rely on the database trigger for single-choice overwrite logic
        // But we still attempt an insert or toggle.
        const { error } = await supabase.from('post_poll_votes').insert({
            post_id: postId,
            user_id: currentUser.id,
            option_index: optionIndex
        });

        // If they click an option they already voted for (conflict), untoggle it
        if (error && error.code === '23505') {
            await supabase.from('post_poll_votes').delete().match({ post_id: postId, user_id: currentUser.id, option_index: optionIndex });
        }
        
        // Fetch just the votes for this post to update math locally
        const { data: votes } = await supabase.from('post_poll_votes').select('user_id, option_index').eq('post_id', postId);
        
        updatePollDOM(postId, votes);

    } catch (error) {
        console.error("Poll vote error:", error);
    } finally {
        isVoting = false; // Release the lock
    }
}

function updatePollDOM(postId, votes) {
    const postEl = document.querySelector(`div[data-post-id="${postId}"]`);
    if (!postEl) return;
    
    const options = postEl.querySelectorAll('.poll-option-btn');
    const totalVotes = votes.length;
    const myVotes = votes.filter(v => v.user_id === currentUser.id).map(v => v.option_index);
    const userHasVoted = myVotes.length > 0;
    
    // Find max votes for winning highlight
    let maxVotes = 0;
    const voteCounts = [];
    options.forEach((opt, idx) => {
        const count = votes.filter(v => v.option_index === idx).length;
        voteCounts.push(count);
        if (count > maxVotes) maxVotes = count;
    });

    options.forEach((opt, idx) => {
        const count = voteCounts[idx];
        const percentage = totalVotes === 0 ? 0 : Math.round((count / totalVotes) * 100);
        const iVotedForThis = myVotes.includes(idx);
        
        // Update bar
        const bar = opt.querySelector('.poll-progress-bar');
        if (bar) bar.style.width = `${userHasVoted ? percentage : 0}%`;
        
        // Update circle
        const circle = opt.querySelector('.poll-check-circle');
        if (circle) {
            if (iVotedForThis) {
                circle.className = 'poll-check-circle w-4 h-4 rounded-full border-2 border-primary flex items-center justify-center';
                circle.innerHTML = '<span class="w-2 h-2 rounded-full bg-primary"></span>';
            } else {
                circle.className = 'poll-check-circle w-4 h-4 rounded-full border-2 border-surface-variant/80 dark:border-gray-500';
                circle.innerHTML = '';
            }
        }
        
        // Update text
        const percSpan = opt.querySelector('.poll-percentage');
        if (percSpan) {
            percSpan.textContent = `${percentage}%`;
            percSpan.className = `poll-percentage ${userHasVoted ? 'opacity-100' : 'opacity-0'} transition-opacity`;
        }
    });
    
    // Update footer votes text
    const votesCountSpan = postEl.querySelector('.poll-total-votes');
    if (votesCountSpan) votesCountSpan.textContent = totalVotes;
}

// Fetch and display voters for public polls
window.openPollVoters = async (postId, optionIndex) => {
    const modal = document.getElementById('modal-poll-voters');
    const list = document.getElementById('poll-voters-list');
    if (!modal || !list) return;

    modal.classList.remove('hidden');
    modal.classList.add('flex');
    list.innerHTML = `<p class="text-sm italic text-center py-8 text-on-surface-variant dark:text-gray-400">Loading voters...</p>`;

    try {
        const { data, error } = await supabase
            .from('post_poll_votes')
            .select('users(id, full_name, profile_img_url, tick_type)')
            .eq('post_id', postId)
            .eq('option_index', optionIndex);

        if (error) throw error;
        if (data.length === 0) {
            list.innerHTML = `<p class="text-sm italic text-center py-8 text-on-surface-variant dark:text-gray-400">No votes yet.</p>`;
            return;
        }

        list.innerHTML = data.map(v => `
            <div class="flex items-center gap-3 p-3 bg-surface-variant/10 dark:bg-neutral-800 rounded-2xl border border-surface-variant/30 dark:border-neutral-700">
                <img onclick="window.viewUserProfile('${v.users.id}')" src="${v.users.profile_img_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(v.users.full_name)}`}" class="w-10 h-10 rounded-full object-cover cursor-pointer">
                <p onclick="window.viewUserProfile('${v.users.id}')" class="font-bold text-sm text-on-surface dark:text-gray-100 flex items-center gap-1 cursor-pointer hover:text-primary transition-colors">${v.users.full_name} ${getTickHtml(v.users.tick_type)}</p>
            </div>
        `).join('');
    } catch (e) {
        list.innerHTML = `<p class="text-sm italic text-center py-8 text-error">Failed to load voters.</p>`;
        console.error("Voters load error:", e);
    }
};


// ==========================================
// ACTION SHEETS & SOFT DELETES 
// ==========================================

function openPostOptions(postId, postOwnerId, isVerified) {
    const isOwner = currentUser.id === postOwnerId;
    let buttonsHtml = '';

    if (isOwner) {
        buttonsHtml = `
            <button onclick="deletePost('${postId}')" class="w-full flex items-center gap-3 p-4 bg-error/10 text-error rounded-2xl font-bold active:scale-95 transition-transform">
                <span class="material-symbols-outlined">delete</span> Delete Post
            </button>
        `;
    } else {
        if (isVerified) {
            buttonsHtml = `<p class="text-sm text-center text-on-surface-variant font-medium py-4">Official Verified Posts cannot be reported.</p>`;
        } else {
            buttonsHtml = `
                <button onclick="openReportPostModal('${postId}')" class="w-full flex items-center gap-3 p-4 bg-orange-500/10 text-orange-500 rounded-2xl font-bold active:scale-95 transition-transform">
                    <span class="material-symbols-outlined">flag</span> Report Post
                </button>
            `;
        }
    }

    window.openActionSheet(buttonsHtml);
}

function openCommentOptions(commentId, commentOwnerId) {
    const isOwner = currentUser.id === commentOwnerId;
    let buttonsHtml = '';

    if (isOwner) {
        buttonsHtml = `
            <button onclick="deleteComment('${commentId}')" class="w-full flex items-center gap-3 p-4 bg-error/10 text-error rounded-2xl font-bold active:scale-95 transition-transform">
                <span class="material-symbols-outlined">delete</span> Delete Comment
            </button>
        `;
    } else {
        buttonsHtml = `<p class="text-sm text-center text-on-surface-variant">No actions available.</p>`;
    }

    window.openActionSheet(buttonsHtml);
}

window.deletePost = async (postId) => {
    if (!confirm('Are you sure you want to delete this post?')) return;
    window.closeActionSheet();

    // Optimistic UI update: hide the post immediately for a better user experience
    const postElement = document.querySelector(`div[data-post-id="${postId}"]`);
    if (postElement) postElement.style.display = 'none';
    
    // SOFT DELETE
    const { error } = await supabase.from('posts').update({ is_deleted: true }).eq('id', postId);
    
    if (error) {
        if (postElement) postElement.style.display = 'block'; // Revert if failed
        showToast('Failed to delete post.', 'error');
        console.error(error);
    } else {
        showToast('Post deleted.', 'success');
        // We removed it from the DOM already, but we can refetch in background if needed
    }
};

window.deleteComment = async (commentId) => {
    window.closeActionSheet();
    
    // SOFT DELETE
    const { error } = await supabase.from('post_comments').update({ is_deleted: true }).eq('id', commentId);
    
    if (error) {
        showToast('Failed to delete comment.', 'error');
        console.error(error);
    } else {
        showToast('Comment deleted.', 'success');
        closeCommentsModal();
        fetchPosts(); 
    }
};

window.openReportPostModal = (postId) => {
    window.closeActionSheet();
    const modal = document.getElementById('modal-report-post');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    document.getElementById('submit-report-post-btn').dataset.postId = postId;
};

window.closeReportPostModal = () => {
    const modal = document.getElementById('modal-report-post');
    modal.classList.remove('flex');
    modal.classList.add('hidden');
    document.getElementById('report-post-reason').value = '';
    document.getElementById('report-post-description').value = '';
};

async function submitPostReport() {
    const btn = document.getElementById('submit-report-post-btn');
    const postId = btn.dataset.postId;
    const reason = document.getElementById('report-post-reason').value;
    const desc = document.getElementById('report-post-description').value.trim();

    if (!reason) {
        showToast('Please select a reason.', 'warning');
        return;
    }

    btn.disabled = true;
    btn.textContent = 'Submitting...';

    try {
        const { error } = await supabase.rpc('report_post', {
            p_reported_post_id: postId,
            p_reason: reason,
            p_description: desc || null
        });
        if (error) throw error;
        
        showToast('Report submitted. Our team will review it.', 'success');
        window.closeReportPostModal();
    } catch (error) {
        showToast(error.message || 'Failed to submit report.', 'error');
        console.error('Report error:', error);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Submit Report';
    }
}

// ==========================================
// COMMENTS 
// ==========================================

async function openCommentsModal(postId) {
    const modal = document.getElementById('modal-post-comments');
    const list = document.getElementById('post-comments-list');
    document.getElementById('send-comment-btn').dataset.postId = postId;

    modal.classList.replace('hidden', 'flex');
    list.innerHTML = `<p class="text-sm italic text-center py-8 text-on-surface-variant dark:text-gray-400">Loading comments...</p>`;

    try {
        const { data, error } = await supabase
            .from('post_comments')
            .select('*, users(id, full_name, profile_img_url, tick_type)')
            .eq('post_id', postId)
            .eq('is_deleted', false)
            .order('created_at', { ascending: true });

        if (error) throw error;

        if (data.length === 0) {
            list.innerHTML = `<p class="text-sm italic text-center py-8 text-on-surface-variant dark:text-gray-400">No comments yet. Be the first!</p>`;
            return;
        }

        list.innerHTML = data.map(comment => `
            <div class="flex items-start gap-3 group">
                <img onclick="window.viewUserProfile('${comment.users.id}')" src="${comment.users.profile_img_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(comment.users.full_name)}&background=e1e3e4`}" class="w-8 h-8 rounded-full object-cover mt-1 cursor-pointer hover:opacity-80 transition-opacity">
                <div class="flex-1 bg-surface-variant/30 dark:bg-surface-variant/10 rounded-2xl p-3 border border-surface-variant/50 dark:border-neutral-700 relative">
                    <div class="flex justify-between items-center mb-1">
                        <p onclick="window.viewUserProfile('${comment.users.id}')" class="text-xs font-bold text-on-surface dark:text-gray-100 cursor-pointer hover:text-primary transition-colors flex items-center gap-1">${comment.users.full_name} ${getTickHtml(comment.users.tick_type)}</p>
                        <p class="text-[10px] text-on-surface-variant dark:text-gray-400">${timeAgo(comment.created_at)}</p>
                    </div>
                    <p class="text-sm text-on-surface dark:text-gray-200 leading-relaxed pr-6">${comment.content}</p>
                    
                    <button data-comment-id="${comment.id}" data-user-id="${comment.user_id}" class="comment-options-btn absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1 text-on-surface-variant hover:text-on-surface dark:hover:text-white transition-all">
                        <span class="material-symbols-outlined text-[18px]">more_vert</span>
                    </button>
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

    const btn = document.getElementById('send-comment-btn');
    btn.disabled = true;

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
        openCommentsModal(postId); 

        const commentBtn = document.querySelector(`.comment-btn[data-post-id="${postId}"]`);
        if (commentBtn) {
            const countSpan = commentBtn.querySelector('span:last-child');
            const currentCount = parseInt(countSpan.textContent);
            countSpan.textContent = currentCount + 1;
        }
    }
    btn.disabled = false;
}
