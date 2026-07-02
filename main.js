// ==========================================
// GLOBAL CONFIGURATION
// ==========================================
const sb = window.sb; 
let currentSession = null;
let currentUserSocialLinks = [];
let tempSocialLinks = [];
let currentUserProfile = null;
let tempProfileImgUrl = '';

// ==========================================
// MOCK CONFIGURATION FOR LOCAL TESTING
// ==========================================
if (window.location.search.includes('mock=true')) {
    console.log("Mocking Supabase client for testing...");
    const mockUser = {
        id: "mock-user-id",
        email: "teststudent@example.com"
    };
    const mockProfile = {
        full_name: "Amrit Sen",
        profile_img_url: "https://ui-avatars.com/api/?name=Amrit+Sen&background=e8f3f9&color=007bb5",
        role: "Student",
        course: "Computer Science & Engineering",
        student_id: "S202648",
        email: "teststudent@example.com",
        bio: "Developing EcoCampus - building premium web applications! 🚀",
        social_links: [
            { platform: "linkedin", url: "https://linkedin.com/in/amritsen" },
            { platform: "instagram", url: "https://instagram.com/amritsen" }
        ],
        is_private: false
    };
    
    const mockDiscover = [
        {
            auth_user_id: "peer-1",
            full_name: "Maya Lin",
            course: "Environmental Science",
            profile_img_url: "https://ui-avatars.com/api/?name=Maya+Lin&background=e1e3e4",
            bio: "Love nature and hiking! 🌲 Let's build a greener campus together.",
            social_links: [
                { platform: "instagram", url: "https://instagram.com/mayalin" },
                { platform: "github", url: "https://github.com/mayalin" }
            ],
            is_private: false,
            connection_count: 42
        },
        {
            auth_user_id: "peer-2",
            full_name: "David K.",
            course: "Business Administration",
            profile_img_url: "https://ui-avatars.com/api/?name=David+K&background=e1e3e4",
            bio: "Entrepreneurial mindset. Let's network! 💼",
            social_links: [
                { platform: "linkedin", url: "https://linkedin.com/in/davidk" }
            ],
            is_private: false,
            connection_count: 24
        }
    ];

    window.sb = {
        auth: {
            getSession: async () => ({ data: { session: { user: mockUser } }, error: null }),
            signOut: async () => { console.log("Mock Sign Out"); }
        },
        from: (table) => ({
            select: (fields) => ({
                eq: (col, val) => ({
                    single: async () => ({ data: mockProfile, error: null })
                }),
                neq: (col, val) => ({
                    order: (col2, opts2) => ({
                        limit: async (limitVal) => ({ data: mockDiscover, error: null })
                    })
                }),
                order: (col, opts) => ({
                    limit: async (limitVal) => ({ data: [
                        {
                            id: "post-1",
                            content: "Check out the new social profiles design! It feels super premium. 🎨✨",
                            likes: 5,
                            created_at: new Date().toISOString(),
                            users: {
                                full_name: "Amrit Sen",
                                profile_img_url: "https://ui-avatars.com/api/?name=Amrit+Sen&background=e8f3f9&color=007bb5"
                            }
                        }
                    ], error: null })
                })
            }),
            update: async (data) => {
                console.log("Mock update table:", table, data);
                Object.assign(mockProfile, data);
                return { error: null };
            }
        })
    };
}


const CLOUDINARY_CLOUD_NAME = 'dnia8lb2q'; 
const CLOUDINARY_UPLOAD_PRESET = 'ecovities_avatars'; 

// ==========================================
// 1. AUTH & INITIALIZATION
// ==========================================
async function checkAuth() {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) {
        window.location.href = "/EcoCampus/auth/login.html";
        return;
    }
    currentSession = session;
    
    // Initialize everything
    fetchUserProfile(session.user.id, session.user.email);
    loadPosts();
    loadDiscoverStudents();
    if(typeof loadNotifications === 'function') loadNotifications();
}

// ==========================================
// 2. PROFILE DATA HANDLING
// ==========================================
async function fetchUserProfile(authUserId, fallbackEmail) {
    try {
        const { data: userProfile, error } = await sb
            .from('users')
            .select('full_name, profile_img_url, role, course, student_id, email, bio, social_links, is_private') 
            .eq('auth_user_id', authUserId)
            .single();

        if (error) throw error; 

        if (userProfile) {
            currentUserProfile = userProfile;
            // FIX: Replaced broken via.placeholder.com with reliable UI-Avatars
            const avatarUrl = userProfile.profile_img_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(userProfile.full_name)}&background=e1e3e4`;
            
            const headerAvatar = document.getElementById('header-avatar');
            if(headerAvatar) headerAvatar.src = avatarUrl;
            
            const profileAvatar = document.getElementById('profile-avatar-large');
            if(profileAvatar) profileAvatar.src = avatarUrl;
            
            const feedAvatar = document.getElementById('feed-avatar');
            if(feedAvatar) feedAvatar.src = avatarUrl;
            
            const feedInputAvatar = document.getElementById('feed-input-avatar');
            if(feedInputAvatar) feedInputAvatar.src = avatarUrl;

            // Text Fields
            const fields = {
                'profile-name': userProfile.full_name,
                'profile-role': userProfile.role || 'Student',
                'profile-id': userProfile.student_id,
                'profile-course': userProfile.course,
                'profile-bio': userProfile.bio || 'Add a bio to tell people about yourself! 🌱'
            };
            Object.entries(fields).forEach(([id, val]) => {
                const el = document.getElementById(id);
                if (el) el.innerText = val;
            });

            const emailEl = document.getElementById('profile-email');
            if(emailEl) emailEl.innerHTML = `<span class="material-symbols-outlined text-[16px]">mail</span> ${userProfile.email || fallbackEmail}`;
            
            const privacyToggle = document.getElementById('privacy-toggle-switch');
            if(privacyToggle) privacyToggle.checked = userProfile.is_private;

            currentUserSocialLinks = normalizeSocialLinks(userProfile.social_links);
            renderSocialLinks('profile-social-links', currentUserSocialLinks, true);
        }
    } catch (err) {
        console.error("Profile fetch error:", err.message);
    }
}

// ==========================================
// 3. POSTING SYSTEM (TEXT ONLY)
// ==========================================
window.submitPost = async function() {
    const input = document.getElementById('post-input');
    const btn = document.getElementById('send-post-btn');
    const content = input.value.trim();

    if (!content || !currentSession) return;

    btn.disabled = true;
    btn.innerHTML = '<span class="material-symbols-outlined text-[20px] animate-spin">sync</span>';

    try {
        const { error } = await sb.from('posts').insert({
            user_id: currentSession.user.id,
            content: content
        });
        if (error) throw error;
        input.value = '';
        await loadPosts();
    } catch (err) {
        console.error("Failed to post:", err.message);
        alert("Failed to post update.");
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<span class="material-symbols-outlined text-[20px] ml-1">send</span>';
    }
};

async function loadPosts() {
    const container = document.getElementById('feed-posts-container');
    if (!container) return;

    const { data: posts, error } = await sb.from('posts').select(`
        id, content, likes, created_at,
        users!posts_user_id_fkey(full_name, profile_img_url)
    `).order('created_at', { ascending: false }).limit(20);

    if (error) { console.error("Error loading posts:", error); return; }

    // FIX: Added dark:text-gray-100 to headings and dark:text-gray-200 to paragraphs
    container.innerHTML = posts.length > 0 ? posts.map(p => `
        <div class="bg-white dark:bg-neutral-900 rounded-[32px] p-5 border border-gray-200 dark:border-neutral-800 shadow-sm mb-5 transition-colors">
            <div class="flex items-center gap-3 mb-3">
                <img src="${p.users.profile_img_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(p.users.full_name)}&background=e1e3e4`}" class="w-10 h-10 rounded-full border border-gray-200 dark:border-neutral-700 shadow-sm object-cover">
                <div class="flex-1">
                    <h4 class="font-bold text-[14px] text-gray-900 dark:text-gray-100">${p.users.full_name}</h4>
                    <p class="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">Just now</p>
                </div>
            </div>
            <p class="text-[14px] text-gray-800 dark:text-gray-200 leading-relaxed mb-4 px-1">
                ${p.content}
            </p>
            <div class="flex items-center gap-6 border-t border-gray-200 dark:border-neutral-800 pt-3 px-1">
                <button class="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 hover:text-primary transition-colors text-[13px] font-medium active:scale-95">
                    <span class="material-symbols-outlined text-[20px]">favorite</span> ${p.likes || 0}
                </button>
            </div>
        </div>
    `).join('') : '<p class="text-sm italic text-center py-4 text-gray-500 dark:text-gray-400">No posts yet. Be the first!</p>';
}

// ==========================================
// 4. CLOUDINARY UPLOAD FIX
// ==========================================
function setupProfileImageUpload() {
    const avatarContainer = document.getElementById('profile-avatar-container');
    const fileInput = document.getElementById('avatar-upload-input');
    const largeAvatarImg = document.getElementById('profile-avatar-large');
    const headerAvatarImg = document.getElementById('header-avatar');

    if (!avatarContainer || !fileInput) return;

    avatarContainer.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        largeAvatarImg.style.opacity = '0.5';

        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

            const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
                method: 'POST',
                body: formData
            });
            
            const cloudinaryData = await uploadRes.json();

            if (!uploadRes.ok) {
                console.error("Cloudinary Error:", cloudinaryData);
                throw new Error(cloudinaryData.error?.message || "Cloudinary rejected the upload.");
            }

            const newImageUrl = cloudinaryData.secure_url;

            // Sync with Supabase
            const { error: dbError } = await sb
                .from('users')
                .update({ profile_img_url: newImageUrl })
                .eq('auth_user_id', currentSession.user.id);

            if (dbError) throw dbError;

            // Update UI
            largeAvatarImg.src = newImageUrl;
            if (headerAvatarImg) headerAvatarImg.src = newImageUrl;
            
        } catch (err) {
            console.error("Profile image upload failed:", err);
            alert(`Upload failed: ${err.message}`);
        } finally {
            largeAvatarImg.style.opacity = '1';
            fileInput.value = '';
        }
    });
}

// ==========================================
// 5. SOCIAL LINKS MANAGEMENT
// ==========================================
const platformConfig = {
    linkedin: { text: 'in', classes: 'bg-[#e8f3f9] dark:bg-[#0077b5]/15 text-[#0077b5] hover:bg-[#0077b5]/25 font-extrabold text-[18px]' },
    instagram: { text: 'IG', classes: 'bg-gradient-to-tr from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] text-white hover:opacity-90 font-extrabold text-[15px]' },
    github: { text: 'GH', classes: 'bg-gray-900 dark:bg-neutral-850 text-white hover:bg-black font-bold text-[14px]' },
    twitter: { text: 'X', classes: 'bg-black dark:bg-neutral-800 text-white hover:bg-neutral-900 font-bold text-[14px] border border-transparent dark:border-neutral-700' },
    youtube: { text: 'YT', classes: 'bg-[#ff0000]/10 text-[#ff0000] hover:bg-[#ff0000]/20 font-bold text-[14px] dark:bg-[#ff0000]/25 dark:text-red-400' },
    discord: { text: 'DC', classes: 'bg-[#5865f2]/10 text-[#5865f2] hover:bg-[#5865f2]/20 font-bold text-[14px] dark:bg-[#5865f2]/25 dark:text-indigo-400' },
    facebook: { text: 'FB', classes: 'bg-[#1877f2]/10 text-[#1877f2] hover:bg-[#1877f2]/20 font-bold text-[15px] dark:bg-[#1877f2]/25 dark:text-blue-400' },
    behance: { text: 'Be', classes: 'bg-[#1769ff]/10 text-[#1769ff] hover:bg-[#1769ff]/20 font-bold text-[15px] dark:bg-[#1769ff]/25 dark:text-blue-400' },
    dribbble: { text: 'Dr', classes: 'bg-[#ea4c89]/10 text-[#ea4c89] hover:bg-[#ea4c89]/20 font-bold text-[15px] dark:bg-[#ea4c89]/25 dark:text-pink-400' },
    website: { text: 'web', classes: 'bg-teal-50 dark:bg-teal-950/20 text-teal-600 dark:text-teal-400 hover:bg-teal-100/50 dark:hover:bg-teal-950/30 font-bold text-[13px]' },
    other: { text: 'link', isIcon: true, classes: 'bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-neutral-700 font-bold text-[14px]' }
};

function normalizeSocialLinks(links) {
    if (!links) return [];
    if (Array.isArray(links)) return links;
    if (typeof links === 'object') {
        return Object.entries(links)
            .filter(([_, url]) => !!url)
            .map(([platform, url]) => ({ platform, url }));
    }
    return [];
}

function renderSocialLinks(containerId, links, allowAdd) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = '';
    const normalized = normalizeSocialLinks(links);
    
    if (normalized.length > 0) {
        normalized.forEach((item) => {
            const config = platformConfig[item.platform] || platformConfig.other;
            const iconHtml = config.isIcon 
                ? `<span class="material-symbols-outlined text-[20px]">${config.text}</span>` 
                : `<span class="uppercase">${config.text}</span>`;
                
            container.innerHTML += `
                <a href="${item.url}" target="_blank" rel="noopener noreferrer" 
                   class="w-12 h-12 rounded-2xl flex items-center justify-center cursor-pointer active:scale-95 transition-all shadow-sm ${config.classes}"
                   title="${item.platform}: ${item.url}">
                    ${iconHtml}
                </a>
            `;
        });
    } else if (!allowAdd) {
        container.innerHTML = `<p class="text-[13px] text-gray-500 dark:text-gray-400 italic">No social links added yet.</p>`;
    }
    
    if (allowAdd) {
        container.innerHTML += `
            <button onclick="openSocialsModal()" class="w-12 h-12 rounded-2xl border border-dashed border-gray-300 dark:border-neutral-700 flex items-center justify-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 active:scale-95 transition-all text-gray-400 dark:text-gray-500 font-medium text-2xl" title="Manage Links">
                +
            </button>
        `;
    }
}

function renderModalSocialsList() {
    const listContainer = document.getElementById('modal-socials-list');
    if (!listContainer) return;
    
    if (tempSocialLinks.length === 0) {
        listContainer.innerHTML = `<p class="text-[12px] text-gray-500 dark:text-gray-400 italic py-4 text-center">No links added yet.</p>`;
        return;
    }
    
    listContainer.innerHTML = tempSocialLinks.map((item, index) => {
        const config = platformConfig[item.platform] || platformConfig.other;
        const iconHtml = config.isIcon 
            ? `<span class="material-symbols-outlined text-[16px]">${config.text}</span>` 
            : `<span class="text-[11px] font-extrabold uppercase">${config.text}</span>`;
            
        return `
            <div class="flex items-center justify-between bg-gray-50 dark:bg-neutral-800/40 border border-gray-150 dark:border-neutral-800/60 p-3 rounded-2xl">
                <div class="flex items-center gap-3 min-w-0 flex-1">
                    <div class="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${config.classes}">
                        ${iconHtml}
                    </div>
                    <div class="min-w-0 flex-1">
                        <p class="text-xs font-bold text-gray-900 dark:text-gray-100 capitalize">${item.platform}</p>
                        <p class="text-[11px] text-gray-500 dark:text-gray-400 truncate pr-2">${item.url}</p>
                    </div>
                </div>
                <button onclick="removeSocialLinkTemp(${index})" class="w-8 h-8 rounded-full bg-error/10 hover:bg-error/20 text-error flex items-center justify-center transition-colors shrink-0 active:scale-90">
                    <span class="material-symbols-outlined text-[16px]">delete</span>
                </button>
            </div>
        `;
    }).join('');
}

window.openSocialsModal = () => {
    tempSocialLinks = [...currentUserSocialLinks];
    renderModalSocialsList();
    const modal = document.getElementById('modal-edit-socials');
    if(modal) { modal.classList.remove('hidden'); modal.classList.add('flex'); }
};

window.closeSocialsModal = () => {
    const modal = document.getElementById('modal-edit-socials');
    if(modal) { modal.classList.add('hidden'); modal.classList.remove('flex'); }
};

window.addSocialLinkTemp = () => {
    const platformSelect = document.getElementById('add-social-platform');
    const urlInput = document.getElementById('add-social-url');
    if (!platformSelect || !urlInput) return;
    
    const platform = platformSelect.value;
    let url = urlInput.value.trim();
    
    if (!url) {
        alert("Please enter a URL.");
        return;
    }
    
    if (!/^https?:\/\//i.test(url)) {
        url = 'https://' + url;
    }
    
    tempSocialLinks.push({ platform, url });
    urlInput.value = '';
    renderModalSocialsList();
};

window.removeSocialLinkTemp = (index) => {
    tempSocialLinks.splice(index, 1);
    renderModalSocialsList();
};

window.saveSocialLinks = async function() {
    if (!currentSession) return;
    
    try {
        const { error } = await sb
            .from('users')
            .update({ social_links: tempSocialLinks })
            .eq('auth_user_id', currentSession.user.id);
            
        if (error) throw error;
        
        currentUserSocialLinks = [...tempSocialLinks];
        renderSocialLinks('profile-social-links', currentUserSocialLinks, true);
        closeSocialsModal();
    } catch (err) {
        console.error("Error saving social links:", err);
        alert("Error saving social links.");
    }
};

// ==========================================
// 5.1 EDIT PROFILE DETAILS MANAGEMENT
// ==========================================
window.openEditProfileModal = () => {
    if (!currentUserProfile) return;
    tempProfileImgUrl = currentUserProfile.profile_img_url || '';
    
    const previewEl = document.getElementById('edit-profile-avatar-preview');
    if (previewEl) {
        previewEl.src = tempProfileImgUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUserProfile.full_name)}&background=e1e3e4`;
    }
    
    const nameEl = document.getElementById('edit-profile-name');
    if (nameEl) nameEl.value = currentUserProfile.full_name || '';
    
    const idEl = document.getElementById('edit-profile-id');
    if (idEl) idEl.value = currentUserProfile.student_id || '';
    
    const courseEl = document.getElementById('edit-profile-course');
    if (courseEl) courseEl.value = currentUserProfile.course || '';
    
    const bioEl = document.getElementById('edit-profile-bio');
    if (bioEl) bioEl.value = currentUserProfile.bio || '';
    
    const modal = document.getElementById('modal-edit-profile');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
};

window.closeEditProfileModal = () => {
    const modal = document.getElementById('modal-edit-profile');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
};

window.triggerEditAvatarUpload = () => {
    const fileInput = document.getElementById('edit-avatar-upload-input');
    if (fileInput) fileInput.click();
};

function setupEditProfileImageUpload() {
    const fileInput = document.getElementById('edit-avatar-upload-input');
    const previewImg = document.getElementById('edit-profile-avatar-preview');
    if (!fileInput || !previewImg) return;
    
    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        previewImg.style.opacity = '0.5';
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
            
            const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
                method: 'POST',
                body: formData
            });
            const data = await uploadRes.json();
            if (!uploadRes.ok) throw new Error(data.error?.message || "Upload failed");
            
            tempProfileImgUrl = data.secure_url;
            previewImg.src = tempProfileImgUrl;
        } catch (err) {
            console.error("Edit profile avatar upload failed:", err);
            alert(`Avatar upload failed: ${err.message}`);
        } finally {
            previewImg.style.opacity = '1';
            fileInput.value = '';
        }
    });
}

window.saveUserProfile = async function() {
    if (!currentSession) return;
    
    const nameInput = document.getElementById('edit-profile-name');
    const idInput = document.getElementById('edit-profile-id');
    const courseInput = document.getElementById('edit-profile-course');
    const bioInput = document.getElementById('edit-profile-bio');
    
    const full_name = nameInput?.value.trim();
    const student_id = idInput?.value.trim();
    const course = courseInput?.value.trim();
    const bio = bioInput?.value.trim();
    
    if (!full_name) {
        alert("Full Name cannot be empty.");
        return;
    }
    if (!student_id) {
        alert("Student ID cannot be empty.");
        return;
    }
    
    const saveBtn = document.getElementById('save-profile-btn');
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<span class="material-symbols-outlined text-[20px] animate-spin">sync</span> Saving...';
    }
    
    try {
        const updates = {
            full_name,
            student_id,
            course,
            bio,
            profile_img_url: tempProfileImgUrl
        };
        
        const { error } = await sb
            .from('users')
            .update(updates)
            .eq('auth_user_id', currentSession.user.id);
            
        if (error) throw error;
        
        // Update local cache
        if (currentUserProfile) {
            currentUserProfile.full_name = full_name;
            currentUserProfile.student_id = student_id;
            currentUserProfile.course = course;
            currentUserProfile.bio = bio;
            currentUserProfile.profile_img_url = tempProfileImgUrl;
        }
        
        // Refresh profile page UI
        const avatarUrl = tempProfileImgUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(full_name)}&background=e1e3e4`;
        
        const headerAvatar = document.getElementById('header-avatar');
        if (headerAvatar) headerAvatar.src = avatarUrl;
        
        const profileAvatar = document.getElementById('profile-avatar-large');
        if (profileAvatar) profileAvatar.src = avatarUrl;
        
        const feedAvatar = document.getElementById('feed-avatar');
        if (feedAvatar) feedAvatar.src = avatarUrl;
        
        const feedInputAvatar = document.getElementById('feed-input-avatar');
        if (feedInputAvatar) feedInputAvatar.src = avatarUrl;
        
        const fields = {
            'profile-name': full_name,
            'profile-id': student_id,
            'profile-course': course || '---',
            'profile-bio': bio || 'Add a bio to tell people about yourself! 🌱'
        };
        Object.entries(fields).forEach(([id, val]) => {
            const el = document.getElementById(id);
            if (el) el.innerText = val;
        });
        
        closeEditProfileModal();
    } catch (err) {
        console.error("Error saving user profile:", err);
        alert(`Error saving profile: ${err.message}`);
    } finally {
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = 'Save Changes';
        }
    }
};

// ==========================================
// 6. PRIVACY & SEARCH SYSTEM
// ==========================================
const privacyToggleEl = document.getElementById('privacy-toggle-switch');
if (privacyToggleEl) {
    privacyToggleEl.addEventListener('change', async (e) => {
        if (!currentSession) return;
        await sb.from('users').update({ is_private: e.target.checked }).eq('auth_user_id', currentSession.user.id);
    });
}

let allDiscoverUsers = []; 

async function loadDiscoverStudents() {
    const container = document.getElementById('discover-students-container'); 
    if (!container) return;

    const { data: users, error } = await sb
        .from('users')
        .select('auth_user_id, full_name, course, profile_img_url, bio, social_links, is_private, connection_count')
        .neq('auth_user_id', currentSession.user.id)
        .order('connection_count', { ascending: false })
        .limit(10);

    if (error) return;

    // FIX: Added dark:text-gray-100 to names in student discovery
    allDiscoverUsers = users;
    container.innerHTML = users.map((u, i) => `
        <div class="bg-white dark:bg-neutral-900 rounded-[24px] p-4 border border-gray-200 dark:border-neutral-800 shadow-sm flex items-center gap-4 cursor-pointer hover:border-primary transition-colors" onclick="viewStudentProfile(${i})">
            <img src="${u.profile_img_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.full_name)}&background=e1e3e4`}" class="w-12 h-12 rounded-full object-cover">
            <div class="flex-1">
                <h4 class="font-bold text-[14px] text-gray-900 dark:text-gray-100">${u.full_name} ${u.is_private ? '🔒' : ''}</h4>
                <p class="text-[12px] text-gray-500 dark:text-gray-400">${u.course || 'Student'} • ${u.connection_count || 0} Conns</p>
            </div>
        </div>
    `).join('');
}

window.viewStudentProfile = function(index) {
    const user = allDiscoverUsers[index];
    const avatarUrl = user.profile_img_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.full_name)}&background=e1e3e4`;
    
    if (user.is_private) {
        const nameEl = document.getElementById('private-profile-name');
        if (nameEl) nameEl.innerText = user.full_name;
        
        const courseEl = document.getElementById('private-profile-course');
        if (courseEl) courseEl.innerText = user.course || 'Student';
        
        const avatarEl = document.getElementById('private-profile-avatar');
        if (avatarEl) avatarEl.src = avatarUrl;
        
        document.getElementById('modal-profile-private').classList.remove('hidden');
        document.getElementById('modal-profile-private').classList.add('flex');
    } else {
        const nameEl = document.getElementById('public-profile-name');
        if (nameEl) nameEl.innerText = user.full_name;
        
        const courseEl = document.getElementById('public-profile-course');
        if (courseEl) courseEl.innerText = user.course || 'Student';
        
        const bioEl = document.getElementById('public-profile-bio');
        if (bioEl) bioEl.innerText = user.bio || 'No bio.';
        
        const avatarEl = document.getElementById('public-profile-avatar');
        if (avatarEl) avatarEl.src = avatarUrl;
        
        renderSocialLinks('public-profile-social-links', user.social_links, false);
        
        document.getElementById('modal-profile-public').classList.remove('hidden');
        document.getElementById('modal-profile-public').classList.add('flex');
    }
};

window.closeProfileModals = () => {
    document.querySelectorAll('[id^="modal-profile-"]').forEach(m => { m.classList.add('hidden'); m.classList.remove('flex'); });
};

// ==========================================
// 7. NOTIFICATIONS SYSTEM
// ==========================================
window.markNotifRead = async function(notifId) {
    try {
        await sb.from('notifications').update({ is_read: true }).eq('id', notifId);
        if(typeof loadNotifications === 'function') loadNotifications();
    } catch (err) {
        console.error("Error marking read:", err);
    }
};

// ==========================================
// 8. UI: TAB SWITCHING & THEME LOGIC
// ==========================================
window.switchTab = (tabName) => {
    document.querySelectorAll('.tab-content').forEach(el => {
        el.classList.add('hidden');
        el.classList.remove('active');
    });
    
    document.querySelectorAll('.nav-item').forEach(el => {
        el.classList.remove('bg-primary', 'text-white');
        el.classList.add('text-gray-500', 'dark:text-gray-400');
    });

    const activeNav = document.getElementById('nav-' + tabName);
    if (activeNav) {
        activeNav.classList.remove('text-gray-500', 'dark:text-gray-400');
        activeNav.classList.add('bg-primary', 'text-white');
    }

    const targetView = document.getElementById('view-' + tabName);
    if (targetView) {
        targetView.classList.remove('hidden');
        targetView.classList.add('active');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
};

const notifBtn = document.getElementById('notif-btn');
const closeNotifBtn = document.getElementById('close-notif-btn');
const fullNotifPanel = document.getElementById('full-notif-panel');

if(notifBtn && closeNotifBtn && fullNotifPanel) {
    notifBtn.addEventListener('click', () => {
        fullNotifPanel.classList.remove('translate-x-full');
        document.body.style.overflow = 'hidden';
    });
    closeNotifBtn.addEventListener('click', () => {
        fullNotifPanel.classList.add('translate-x-full');
        document.body.style.overflow = 'auto';
    });
}

function initTheme() {
    const savedTheme = localStorage.getItem('ecoCampusTheme') || 'light';
    document.documentElement.setAttribute('class', savedTheme);
    const themeCheckbox = document.getElementById('theme-toggle-switch');
    if(themeCheckbox) themeCheckbox.checked = (savedTheme === 'dark');
}

const themeCheckboxEl = document.getElementById('theme-toggle-switch');
if(themeCheckboxEl) {
    themeCheckboxEl.addEventListener('change', (e) => {
        const newTheme = e.target.checked ? 'dark' : 'light';
        document.documentElement.setAttribute('class', newTheme);
        localStorage.setItem('ecoCampusTheme', newTheme);
    });
}

// ==========================================
// INITIALIZATION
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    initTheme();
    checkAuth();
    setupProfileImageUpload();
    setupEditProfileImageUpload();
});
