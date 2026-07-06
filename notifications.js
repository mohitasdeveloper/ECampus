import { supabase } from './supabase.js';
import { showToast } from './ui.js';
import { timeAgo } from './utils.js';
import { handleConnectionAction } from './main.js';

let currentUser = null;

const iconMap = {
    'post_like': { icon: 'favorite', color: 'text-red-500', bg: 'bg-red-500/10' },
    'post_comment': { icon: 'chat_bubble', color: 'text-blue-500', bg: 'bg-blue-500/10' },
    'hotpost_like': { icon: 'local_fire_department', color: 'text-orange-500', bg: 'bg-orange-500/10' },
    'hotpost_reply': { icon: 'reply', color: 'text-purple-500', bg: 'bg-purple-500/10' },
    'connection_request': { icon: 'person_add', color: 'text-primary', bg: 'bg-primary/10' },
    'connection_accepted': { icon: 'handshake', color: 'text-green-500', bg: 'bg-green-500/10' },
};

export function initNotifications(user) {
    currentUser = user;
    fetchNotifications();

    const container = document.getElementById('notifications-container');
    if (container) {
        container.addEventListener('click', (e) => {
            const acceptBtn = e.target.closest('.accept-request-btn');
            const declineBtn = e.target.closest('.decline-request-btn');
            const userLink = e.target.closest('.notif-user-link');

            if (acceptBtn) {
                handleAcceptRequest(acceptBtn.dataset.userId, acceptBtn);
            } else if (declineBtn) {
                handleDeclineRequest(declineBtn.dataset.userId, declineBtn);
            } else if (userLink) {
                document.getElementById('full-notif-panel').classList.add('translate-x-full');
                window.viewUserProfile(userLink.dataset.userId);
            }
        });
    }

    document.getElementById('notif-btn')?.addEventListener('click', () => {
        document.getElementById('full-notif-panel').classList.remove('translate-x-full');
        fetchNotifications();
    });

    document.getElementById('close-notif-btn')?.addEventListener('click', () => {
        document.getElementById('full-notif-panel').classList.add('translate-x-full');
    });

    document.getElementById('mark-read-btn')?.addEventListener('click', markAllAsRead);
}

async function fetchNotifications() {
    const container = document.getElementById('notifications-container');
    if (!container) return;
    container.innerHTML = `<p class="text-sm italic text-center py-10 text-on-surface-variant dark:text-gray-400">Loading activity...</p>`;

    try {
        const { data, error } = await supabase
            .from('notifications')
            .select('id, type, message, is_read, created_at, sender:sender_id(id, full_name, profile_img_url)')
            .eq('user_id', currentUser.id)
            .order('created_at', { ascending: false })
            .limit(30);

        if (error) throw error;

        const unreadCount = data.filter(n => !n.is_read).length;
        const badge = document.getElementById('notif-badge');
        if (badge) badge.classList.toggle('hidden', unreadCount === 0);

        if (data.length === 0) {
            container.innerHTML = `<div class="flex flex-col items-center justify-center py-20 opacity-40 text-on-surface-variant"><span class="material-symbols-outlined text-[48px] mb-2">notifications_off</span><p class="text-sm font-medium">No new activity.</p></div>`;
            return;
        }

        container.innerHTML = data.map(notif => renderNotificationItem(notif)).join('');

    } catch (error) {
        console.error('Error fetching notifications:', error);
        container.innerHTML = `<p class="text-sm italic text-center py-10 text-error">Failed to load activity.</p>`;
    }
}

function renderNotificationItem(notif) {
    const sender = notif.sender;
    const ui = iconMap[notif.type] || { icon: 'notifications', color: 'text-gray-500', bg: 'bg-gray-100' };
    const isUnread = !notif.is_read ? 'bg-primary/5 dark:bg-primary/10' : 'bg-surface dark:bg-[#121212]';

    let textContent = '';
    let actionButtons = '';

    if (notif.type === 'post_like') textContent = 'liked your post.';
    else if (notif.type === 'post_comment') textContent = `commented: "<span class="text-on-surface-variant italic">${notif.message}</span>"`;
    else if (notif.type === 'hotpost_like') textContent = 'liked your Hotpost.';
    else if (notif.type === 'hotpost_reply') textContent = `replied to your Hotpost: "<span class="text-on-surface-variant italic">${notif.message}</span>"`;
    else if (notif.type === 'connection_accepted') textContent = 'accepted your connection request.';
    else if (notif.type === 'connection_request') {
        textContent = 'sent you a connection request.';
        actionButtons = `
            <div class="flex gap-2 mt-2.5">
                <button data-user-id="${sender.id}" class="accept-request-btn bg-primary text-white px-5 py-1.5 rounded-full text-[11px] font-bold active:scale-95 transition-transform shadow-sm">Accept</button>
                <button data-user-id="${sender.id}" class="decline-request-btn bg-surface-variant/50 text-on-surface dark:text-gray-200 px-5 py-1.5 rounded-full text-[11px] font-bold active:scale-95 transition-transform">Decline</button>
            </div>
        `;
    }

    return `
        <div class="p-4 ${isUnread} flex items-start gap-3.5 hover:bg-surface-variant/30 dark:hover:bg-neutral-800/50 transition-colors">
            <div class="relative shrink-0 notif-user-link cursor-pointer" data-user-id="${sender.id}">
                <img src="${sender.profile_img_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(sender.full_name)}&background=e1e3e4`}" class="w-12 h-12 rounded-full object-cover shadow-sm border border-surface-variant/50">
                <div class="absolute -bottom-1 -right-1 w-5 h-5 rounded-full ${ui.bg} flex items-center justify-center border-[1.5px] border-surface dark:border-[#121212]">
                    <span class="material-symbols-outlined text-[10px] ${ui.color}" style="font-variation-settings: 'FILL' 1">${ui.icon}</span>
                </div>
            </div>
            <div class="flex-1 min-w-0">
                <p class="text-[13px] text-on-surface dark:text-gray-200 leading-snug notif-user-link cursor-pointer" data-user-id="${sender.id}">
                    <span class="font-extrabold text-[14px]">${sender.full_name}</span> ${textContent}
                </p>
                <p class="text-[11px] font-medium text-on-surface-variant dark:text-gray-500 mt-0.5">${timeAgo(notif.created_at)}</p>
                ${actionButtons}
            </div>
        </div>
    `;
}

async function handleAcceptRequest(userId, btn) {
    await handleConnectionAction(userId, 'accept', btn);
    fetchNotifications(); 
}

async function handleDeclineRequest(userId, btn) {
    await handleConnectionAction(userId, 'decline', btn);
    fetchNotifications(); 
}

async function markAllAsRead() {
    try {
        const { error } = await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('user_id', currentUser.id)
            .eq('is_read', false);

        if (error) throw error;
        
        const badge = document.getElementById('notif-badge');
        if (badge) badge.classList.add('hidden');
        
        fetchNotifications();
    } catch (error) {
        console.error('Error marking as read:', error);
    }
}
