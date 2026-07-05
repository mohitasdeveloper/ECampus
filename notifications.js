import { supabase } from './supabase.js';
import { showToast } from './ui.js';
import { timeAgo } from './utils.js';
import { handleConnectionAction } from './main.js';

let currentUser = null;

export function initNotifications(user) {
    currentUser = user;
    fetchNotifications();

    // Event delegation for accept/decline buttons
    const container = document.getElementById('notifications-container');
    if (container) {
        container.addEventListener('click', (e) => {
            const acceptBtn = e.target.closest('.accept-request-btn');
            const declineBtn = e.target.closest('.decline-request-btn');

            if (acceptBtn) {
                handleAcceptRequest(acceptBtn.dataset.userId, acceptBtn);
            } else if (declineBtn) {
                handleDeclineRequest(declineBtn.dataset.userId, declineBtn);
            }
        });
    }

    // Also listen for the main notification button click
    document.getElementById('notif-btn')?.addEventListener('click', () => {
        document.getElementById('full-notif-panel').classList.remove('translate-x-full');
        fetchNotifications(); // Refresh on open
    });
    document.getElementById('close-notif-btn')?.addEventListener('click', () => {
        document.getElementById('full-notif-panel').classList.add('translate-x-full');
    });
}

async function fetchNotifications() {
    const container = document.getElementById('notifications-container');
    if (!container) return;
    container.innerHTML = `<p class="text-sm italic text-center py-10 text-gray-500 dark:text-gray-400">Loading alerts...</p>`;

    try {
        // Find pending requests where I am involved, but I didn't initiate the action.
        const { data, error } = await supabase
            .from('connections')
            .select('id, created_at, user_one:user_one_id(id, full_name, profile_img_url), user_two:user_two_id(id, full_name, profile_img_url)')
            .or(`user_one_id.eq.${currentUser.id},user_two_id.eq.${currentUser.id}`)
            .eq('status', 'pending')
            .neq('action_user_id', currentUser.id)
            .order('created_at', { ascending: false });

        if (error) throw error;

        document.getElementById('notif-badge').classList.toggle('hidden', data.length === 0);

        if (data.length === 0) {
            container.innerHTML = `<p class="text-sm italic text-center py-10 text-gray-500 dark:text-gray-400">No new notifications.</p>`;
            return;
        }

        container.innerHTML = data.map(req => {
            // The sender is the user in the row who is NOT the current user
            const sender = req.user_one.id === currentUser.id ? req.user_two : req.user_one;
            
            return `
                <div class="p-4 border-b border-gray-200 dark:border-neutral-800 flex items-center gap-4">
                    <img src="${sender.profile_img_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(sender.full_name)}&background=e1e3e4`}" class="w-12 h-12 rounded-full object-cover border border-surface-variant shadow-sm">
                    <div class="flex-1">
                        <p class="text-sm text-on-surface dark:text-gray-100"><span class="font-bold">${sender.full_name}</span> sent you a connection request.</p>
                        <p class="text-xs text-on-surface-variant dark:text-gray-400">${timeAgo(req.created_at)}</p>
                        <div class="flex gap-2 mt-3">
                            <button data-user-id="${sender.id}" class="accept-request-btn bg-primary hover:bg-primary/90 text-white px-5 py-1.5 rounded-full text-xs font-bold active:scale-95 transition-all">Accept</button>
                            <button data-user-id="${sender.id}" class="decline-request-btn bg-surface-variant/50 hover:bg-surface-variant dark:bg-neutral-800 dark:hover:bg-neutral-700 text-on-surface dark:text-gray-200 px-5 py-1.5 rounded-full text-xs font-bold active:scale-95 transition-all">Decline</button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

    } catch (error) {
        console.error('Error fetching notifications:', error);
        container.innerHTML = `<p class="text-sm italic text-center py-10 text-red-500">Failed to load notifications.</p>`;
    }
}

async function handleAcceptRequest(userId, btn) {
    await handleConnectionAction(userId, 'accept', btn);
    fetchNotifications(); // Refresh the notification list
}

async function handleDeclineRequest(userId, btn) {
    await handleConnectionAction(userId, 'decline', btn);
    fetchNotifications(); // Refresh the notification list
}
