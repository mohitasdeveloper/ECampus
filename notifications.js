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
        const { data, error } = await supabase
            .from('connections')
            .select('id, created_at, users!connections_user_one_id_fkey(id, full_name, profile_img_url)')
            .eq('user_two_id', currentUser.id)
            .eq('status', 'pending');

        if (error) throw error;

        document.getElementById('notif-badge').classList.toggle('hidden', data.length === 0);

        if (data.length === 0) {
            container.innerHTML = `<p class="text-sm italic text-center py-10 text-gray-500 dark:text-gray-400">No new notifications.</p>`;
            return;
        }

        container.innerHTML = data.map(req => {
            const user = req.users;
            return `
                <div class="p-4 border-b border-gray-200 dark:border-neutral-800 flex items-center gap-4">
                    <img src="${user.profile_img_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.full_name)}&background=e1e3e4`}" class="w-12 h-12 rounded-full object-cover">
                    <div class="flex-1">
                        <p class="text-sm"><span class="font-bold">${user.full_name}</span> sent you a connection request.</p>
                        <p class="text-xs text-gray-500 dark:text-gray-400">${timeAgo(req.created_at)}</p>
                        <div class="flex gap-2 mt-2">
                            <button data-user-id="${user.id}" class="accept-request-btn bg-primary text-white px-4 py-1 rounded-full text-xs font-bold">Accept</button>
                            <button data-user-id="${user.id}" class="decline-request-btn bg-gray-200 dark:bg-neutral-700 text-gray-800 dark:text-gray-200 px-4 py-1 rounded-full text-xs font-bold">Decline</button>
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