import { supabase } from './supabase.js';
import { showToast } from './ui.js';

let currentUser = null;

export function initDiscover(user) {
    currentUser = user;
    fetchDiscoverUsers();

    // Use event delegation for connect buttons
    const container = document.getElementById('discover-students-container');
    if (container) {
        container.addEventListener('click', (e) => {
            const connectBtn = e.target.closest('.connect-btn');
            if (connectBtn && !connectBtn.disabled) {
                handleConnectionRequest(connectBtn.dataset.userId);
            }
        });
    }
}

async function fetchDiscoverUsers() {
    const container = document.getElementById('discover-students-container');
    if (!container) return;
    container.innerHTML = `<p class="text-sm italic text-center py-4 text-gray-500 dark:text-gray-400">Finding peers...</p>`;

    try {
        // 1. Fetch all connections for the current user
        const { data: connections, error: connError } = await supabase
            .from('connections')
            .select('*')
            .or(`user_one_id.eq.${currentUser.id},user_two_id.eq.${currentUser.id}`);
        if (connError) throw connError;

        // 2. Get a list of all user IDs the current user is already connected with or has a pending request with
        const connectedUserIds = connections.map(c => {
            return c.user_one_id === currentUser.id ? c.user_two_id : c.user_one_id;
        });
        const allExcludedIds = [currentUser.id, ...connectedUserIds];

        // 3. Fetch users who are NOT in the excluded list
        const { data: users, error: usersError } = await supabase
            .from('users')
            .select('id, full_name, profile_img_url, course')
            .not('id', 'in', `(${allExcludedIds.join(',')})`)
            .limit(10);
        if (usersError) throw usersError;

        renderDiscoverUsers(users);

    } catch (error) {
        console.error('Error fetching discover users:', error);
        container.innerHTML = `<p class="text-sm italic text-center py-4 text-red-500">Could not load users to discover.</p>`;
    }
}

function renderDiscoverUsers(users) {
    const container = document.getElementById('discover-students-container');
    if (users.length === 0) {
        container.innerHTML = `<p class="text-sm italic text-center py-4 text-gray-500 dark:text-gray-400">No new students to discover right now.</p>`;
        return;
    }

    container.innerHTML = users.map(user => `
        <div class="flex items-center gap-4 p-3 bg-white dark:bg-neutral-900 rounded-2xl border border-gray-200 dark:border-neutral-800 shadow-sm">
            <img src="${user.profile_img_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.full_name)}&background=e1e3e4`}" class="w-12 h-12 rounded-full object-cover">
            <div class="flex-1">
                <p class="font-bold text-sm text-gray-900 dark:text-gray-100">${user.full_name}</p>
                <p class="text-xs text-gray-500 dark:text-gray-400">${user.course || 'Student'}</p>
            </div>
            <button data-user-id="${user.id}" class="connect-btn bg-primary/10 text-primary px-4 py-2 rounded-full text-[12px] font-bold tracking-wide transition-all hover:bg-primary/20 active:scale-95">
                Connect
            </button>
        </div>
    `).join('');
}

async function handleConnectionRequest(targetUserId) {
    const btn = document.querySelector(`.connect-btn[data-user-id="${targetUserId}"]`);
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Pending';
    }

    const { error } = await supabase.from('connections').insert({
        user_one_id: currentUser.id, // The sender
        user_two_id: targetUserId, // The receiver
        status: 'pending'
    });

    if (error) {
        showToast('Failed to send request.', 'error');
        console.error('Error sending connection request:', error);
        if (btn) {
            btn.disabled = false;
            btn.textContent = 'Connect';
        }
    } else {
        showToast('Connection request sent!', 'success');
    }
}