import { supabase } from './supabase.js';
import { showToast } from './ui.js';
import { timeAgo } from './utils.js';
import { handleConnectionAction } from './main.js';

let currentUser = null;
let allNotifications = [];

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
    setupStatusBar(); // Style native status bar safely
    setupEventListeners();
    fetchNotifications();
    setupPushNotifications(); 
}

// -----------------------------------
// NATIVE STATUS BAR MANAGEMENT
// -----------------------------------
async function setupStatusBar() {
    try {
        const core = await import('@capacitor/core');
        if (!core.Capacitor.isNativePlatform()) return;

        const { StatusBar, Style } = await import('@capacitor/status-bar');

        // Pushes the WebView down so it doesn't collide with native icons
        await StatusBar.setOverlaysWebView({ overlay: false });
        
        // Sets a crisp, solid white background color
        await StatusBar.setBackgroundColor({ color: '#FFFFFF' });
        
        // Style.Light ensures the system renders DARK text/icons over the white background
        await StatusBar.setStyle({ style: Style.Light });
        
        console.log('Native Status Bar configured to white background with dark icons.');
    } catch (err) {
        console.warn('Status Bar configuration skipped:', err);
    }
}

function setupEventListeners() {
    const notifBtn = document.getElementById('notif-btn');
    if (notifBtn) {
        const newBtn = notifBtn.cloneNode(true);
        notifBtn.parentNode.replaceChild(newBtn, notifBtn);
        newBtn.addEventListener('click', openNotifications);
    }

    document.getElementById('notif-tab-all')?.addEventListener('click', () => switchNotifTab('all'));
    document.getElementById('notif-tab-requests')?.addEventListener('click', () => switchNotifTab('requests'));

    const lists = ['notifications-list-all', 'notifications-list-requests'];
    lists.forEach(id => {
        const container = document.getElementById(id);
        if (container) {
            container.addEventListener('click', (e) => {
                const notifCard = e.target.closest('.notif-card');
                const acceptBtn = e.target.closest('.accept-request-btn');
                const declineBtn = e.target.closest('.decline-request-btn');
                
                if (acceptBtn) {
                    handleAcceptRequest(acceptBtn.dataset.userId, acceptBtn);
                    return;
                }
                if (declineBtn) {
                    handleDeclineRequest(declineBtn.dataset.userId, declineBtn);
                    return;
                }
                if (notifCard) {
                    const notifId = notifCard.dataset.notifId;
                    const notif = allNotifications.find(n => n.id === notifId);
                    if (notif) handleNotificationClick(notif, notifCard);
                }
            });
        }
    });
}

// -----------------------------------
// PUSH NOTIFICATIONS (Cross-Browser Safe)
// -----------------------------------
async function setupPushNotifications() {
    let Capacitor, PushNotifications;
    
    try {
        const core = await import('@capacitor/core');
        const push = await import('@capacitor/push-notifications');
        Capacitor = core.Capacitor;
        PushNotifications = push.PushNotifications;
    } catch (err) {
        console.log('Running in standard Web Browser. Push notifications bypassed safely.');
        return; 
    }

    if (!Capacitor.isNativePlatform()) {
        console.log('Push notifications bypassed: Running in Web Browser.');
        return; 
    }

    try {
        let permStatus = await PushNotifications.checkPermissions();
        if (permStatus.receive === 'prompt') {
            permStatus = await PushNotifications.requestPermissions();
        }
        if (permStatus.receive !== 'granted') return;

        // CRITICAL FIX: Set up event listeners BEFORE calling .register()
        await PushNotifications.addListener('registration', async (token) => {
            console.log('FCM Token successfully generated:', token.value);
            await saveTokenToSupabase(token.value);
        });

        await PushNotifications.addListener('registrationError', (error) => {
            console.error('FCM Registration Error:', error);
        });

        await PushNotifications.addListener('pushNotificationReceived', (notification) => {
            showToast(`${notification.title}: ${notification.body}`, 'info');
            fetchNotifications(); 
        });

        await PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
            openNotifications();
        });

        // Fire registration request after listeners are bound
        await PushNotifications.register();

    } catch (err) {
        console.error("Error setting up native Push Notifications:", err);
    }
}

async function saveTokenToSupabase(token) {
    try {
        const { error } = await supabase.from('users').update({ fcm_token: token }).eq('id', currentUser.id);
        if (error) throw error;
        console.log("FCM Token saved to Supabase successfully.");
    } catch (err) {
        console.error("Could not save push token:", err);
    }
}

// -----------------------------------
// UI & FETCHING LOGIC
// -----------------------------------
export function openNotifications() {
    const modal = document.getElementById('modal-notifications');
    const bottomNav = document.querySelector('nav'); 
    
    modal.classList.replace('hidden', 'flex');
    if (bottomNav) bottomNav.classList.add('hidden'); 
    
    setTimeout(() => modal.classList.remove('translate-x-full'), 10);
    
    fetchNotifications();

    const badge = document.getElementById('notif-badge');
    if (badge) badge.classList.add('hidden');
    markAllAsReadSilent(); 
}

export function closeNotifications() {
    const modal = document.getElementById('modal-notifications');
    const bottomNav = document.querySelector('nav');
    
    modal.classList.add('translate-x-full');
    setTimeout(() => {
        modal.classList.replace('flex', 'hidden');
        if (bottomNav) bottomNav.classList.remove('hidden'); 
    }, 300);
}

function switchNotifTab(tabName) {
    document.getElementById('notif-content-all').classList.add('hidden');
    document.getElementById('notif-content-requests').classList.add('hidden');
    document.getElementById(`notif-content-${tabName}`).classList.remove('hidden');

    ['all', 'requests'].forEach(t => {
        const btn = document.getElementById(`notif-tab-${t}`);
        btn.classList.remove('border-primary', 'text-primary');
        btn.classList.add('border-transparent', 'text-on-surface-variant', 'dark:text-gray-400');
    });

    const activeBtn = document.getElementById(`notif-tab-${tabName}`);
    activeBtn.classList.add('border-primary', 'text-primary');
    activeBtn.classList.remove('border-transparent', 'text-on-surface-variant', 'dark:text-gray-400');
}

async function fetchNotifications() {
    try {
        const { data, error } = await supabase
            .from('notifications')
            .select('id, type, message, target_id, is_read, created_at, sender:sender_id(id, full_name, profile_img_url)')
            .eq('user_id', currentUser.id)
            .order('created_at', { ascending: false })
            .limit(50);

        if (error) throw error;
        allNotifications = data;

        const requests = data.filter(n => n.type === 'connection_request');
        const general = data.filter(n => n.type !== 'connection_request');

        renderList('notifications-list-all', general, "No recent activity.");
        renderList('notifications-list-requests', requests, "No pending connection requests.");

        const modal = document.getElementById('modal-notifications');
        if (modal && modal.classList.contains('hidden')) {
            const unreadCount = data.filter(n => !n.is_read).length;
            const badge = document.getElementById('notif-badge');
            if (badge) badge.classList.toggle('hidden', unreadCount === 0);
        }

        const reqBadge = document.getElementById('requests-badge');
        if (requests.length > 0) {
            reqBadge.textContent = requests.length;
            reqBadge.classList.remove('hidden');
        } else {
            reqBadge.classList.add('hidden');
        }

    } catch (error) {
        console.error('Error fetching notifications:', error);
    }
}

function renderList(containerId, data, emptyMessage) {
    const container = document.getElementById(containerId);
    if (data.length === 0) {
        container.innerHTML = `<div class="flex flex-col items-center justify-center py-20 opacity-40 text-on-surface-variant"><span class="material-symbols-outlined text-[42px] mb-2">notifications_off</span><p class="text-sm font-medium">${emptyMessage}</p></div>`;
        return;
    }
    container.innerHTML = data.map(notif => renderNotificationItem(notif)).join('');
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
        <div data-notif-id="${notif.id}" class="notif-card p-4 ${isUnread} flex items-start gap-3.5 cursor-pointer hover:bg-surface-variant/30 dark:hover:bg-neutral-800/50 transition-colors">
            <div class="relative shrink-0">
                <img src="${sender.profile_img_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(sender.full_name)}&background=e1e3e4`}" class="w-12 h-12 rounded-full object-cover shadow-sm border border-surface-variant/50">
                <div class="absolute -bottom-1 -right-1 w-5 h-5 rounded-full ${ui.bg} flex items-center justify-center border-[1.5px] border-surface dark:border-[#121212]">
                    <span class="material-symbols-outlined text-[10px] ${ui.color}" style="font-variation-settings: 'FILL' 1">${ui.icon}</span>
                </div>
            </div>
            <div class="flex-1 min-w-0">
                <p class="text-[13px] text-on-surface dark:text-gray-200 leading-snug">
                    <span class="font-extrabold text-[14px]">${sender.full_name}</span> ${textContent}
                </p>
                <p class="text-[11px] font-medium text-on-surface-variant dark:text-gray-500 mt-0.5">${timeAgo(notif.created_at)}</p>
                ${actionButtons}
            </div>
        </div>
    `;
}

// -----------------------------------
// ROUTING & ACTIONS
// -----------------------------------
async function handleNotificationClick(notif, element) {
    element.classList.remove('bg-primary/5', 'dark:bg-primary/10');
    element.classList.add('bg-surface', 'dark:bg-[#121212]');

    if (notif.type.startsWith('post_')) {
        window.openSinglePostView(notif.target_id);
    } 
    else if (notif.type.startsWith('hotpost_')) {
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { data } = await supabase.from('hotposts').select('id')
            .eq('user_id', currentUser.id).eq('is_deleted', false).gt('created_at', twentyFourHoursAgo).limit(1);
        
        if (data && data.length > 0) {
            window.showMyHotposts(); 
        } else {
            showToast('This Hotpost has expired.', 'info');
        }
    } 
    else if (notif.type === 'connection_accepted') {
        closeNotifications();
        window.viewUserProfile(notif.sender.id);
    }
}

async function handleAcceptRequest(userId, btn) {
    await handleConnectionAction(userId, 'accept', btn);
    fetchNotifications(); 
}

async function handleDeclineRequest(userId, btn) {
    await handleConnectionAction(userId, 'decline', btn);
    fetchNotifications(); 
}

async function markAllAsReadSilent() {
    try {
        await supabase.from('notifications').update({ is_read: true })
            .eq('user_id', currentUser.id).eq('is_read', false);
    } catch (error) {
        console.error('Error auto-marking read:', error);
    }
}

// Expose open and close endpoints to window object cleanly
window.openNotifications = openNotifications;
window.closeNotifications = closeNotifications;
