<!DOCTYPE html>
<html class="light" lang="en">
<head>
    <meta charset="utf-8"/>
    <meta content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" name="viewport"/>
    <title>ECampus - App</title>
    
    <link rel="stylesheet" href="style.css">
    <script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet"/>
    <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet"/>
    
    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
    <script src="supabase.js"></script>
    <script src="main.js" defer></script>

    <script id="tailwind-config">
        tailwind.config = {
            darkMode: "class",
            theme: {
                extend: {
                    "colors": {
                        "on-surface-variant": "#3f4a3c",
                        "surface-dim": "#d9dadb",
                        "on-tertiary": "#ffffff",
                        "on-secondary-fixed-variant": "#2f3f92",
                        "inverse-primary": "#78dc77",
                        "secondary-fixed": "#dee0ff",
                        "outline": "#6f7a6b",
                        "surface-container": "#edeeef",
                        "on-primary-container": "#003c0b",
                        "on-primary-fixed-variant": "#005313",
                        "surface-container-high": "#e7e8e9",
                        "primary-fixed": "#94f990",
                        "on-error-container": "#93000a",
                        "on-tertiary-fixed-variant": "#693c00",
                        "on-primary-fixed": "#002204",
                        "tertiary-fixed-dim": "#ffb870",
                        "outline-variant": "#becab9",
                        "error-container": "#ffdad6",
                        "surface": "#f8f9fa",
                        "on-background": "#191c1d",
                        "surface-container-low": "#f3f4f5",
                        "on-secondary": "#ffffff",
                        "secondary-fixed-dim": "#bac3ff",
                        "inverse-on-surface": "#f0f1f2",
                        "surface-bright": "#f8f9fa",
                        "error": "#ba1a1a",
                        "background": "#f8f9fa",
                        "secondary": "#4858ab",
                        "surface-container-lowest": "#ffffff",
                        "primary-fixed-dim": "#78dc77",
                        "on-secondary-fixed": "#00105b",
                        "on-primary": "#ffffff",
                        "tertiary-container": "#e18500",
                        "primary-container": "#4caf50",
                        "surface-tint": "#006e1c",
                        "tertiary-fixed": "#ffdcbe",
                        "on-tertiary-fixed": "#2c1600",
                        "on-error": "#ffffff",
                        "tertiary": "#8b5000",
                        "on-secondary-container": "#27378a",
                        "on-surface": "#191c1d",
                        "on-tertiary-container": "#4d2b00",
                        "inverse-surface": "#2e3132",
                        "secondary-container": "#96a5ff",
                        "surface-variant": "#e1e3e4",
                        "surface-container-highest": "#e1e3e4",
                        "primary": "#006e1c"
                    },
                    "fontFamily": {
                        "headline": ["Inter", "sans-serif"],
                        "body": ["Inter", "sans-serif"],
                        "label": ["Inter", "sans-serif"]
                    }
                },
            },
        }
    </script>
</head>
<body class="bg-surface text-on-surface antialiased mb-24 relative overflow-x-hidden selection:bg-primary/20">

    <header class="fixed top-0 w-full z-[40] bg-surface/80 dark:bg-[#121212]/80 backdrop-blur-xl border-b border-surface-variant/40 shadow-sm transition-colors duration-300">
        <div class="flex items-center px-6 h-16 w-full max-w-screen-xl mx-auto relative">
            <div class="flex-none z-10">
                <div class="w-10 h-10 rounded-full overflow-hidden border-[1.5px] border-primary/30 bg-surface-variant shadow-sm shrink-0">
                    <img id="header-avatar" alt="Profile picture" class="w-full h-full object-cover" src="https://via.placeholder.com/150"/>
                </div>
            </div>
            <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span class="text-2xl font-extrabold tracking-tight bg-gradient-to-r from-[#008a45] via-[#007bb5] to-[#673ab7] bg-clip-text text-transparent pb-[2px]">ECampus</span>
            </div>
            <div class="flex-none ml-auto z-10 relative">
                <button id="notif-btn" class="p-2 rounded-full hover:bg-surface-variant/50 transition-all active:scale-95 duration-200 relative text-on-surface-variant">
                    <span class="material-symbols-outlined">notifications</span>
                    <span id="notif-badge" class="absolute top-2 right-2.5 w-2.5 h-2.5 bg-error rounded-full border-2 border-surface hidden"></span>
                </button>
            </div>
        </div>
    </header>

    <div id="full-notif-panel" class="fixed inset-0 z-[100] bg-surface dark:bg-[#121212] transition-transform duration-300 translate-x-full flex flex-col">
        <div class="h-16 border-b border-surface-variant/50 flex items-center px-4 bg-surface/80 backdrop-blur-xl shrink-0">
            <button id="close-notif-btn" class="p-2 mr-2 rounded-full hover:bg-surface-variant active:scale-95 transition-transform text-on-surface">
                <span class="material-symbols-outlined">arrow_back</span>
            </button>
            <h2 class="text-lg font-bold text-on-surface flex-1">Notifications</h2>
        </div>
        <div id="notifications-container" class="flex-1 overflow-y-auto">
            <p class="text-center text-sm text-on-surface-variant mt-10 italic">Loading notifications...</p>
        </div>
    </div>

    <main class="pt-20 px-5 max-w-screen-md mx-auto relative z-10 pb-6">
        
        <div id="view-dashboard" class="tab-content active">
            <section class="mb-4">
                <h3 class="text-[14px] font-bold text-on-surface mb-3 flex items-center gap-1.5">
                    <span class="material-symbols-outlined text-[#e65100] text-[18px]">local_fire_department</span> Hotposts
                </h3>
                <div class="flex gap-4 overflow-x-auto hide-scrollbar pb-2 pt-1">
                    <div class="flex flex-col items-center gap-1.5 shrink-0 cursor-pointer active:scale-95 transition-transform relative">
                        <div class="w-[68px] h-[68px] rounded-full border-[2.5px] border-dashed border-primary/40 flex items-center justify-center bg-primary/5 text-primary">
                            <span class="material-symbols-outlined text-[26px]">add</span>
                        </div>
                        <span class="text-[11px] font-bold text-on-surface-variant">Your Story</span>
                    </div>
                    <div class="flex flex-col items-center gap-1.5 shrink-0 cursor-pointer active:scale-95 transition-transform">
                        <div class="w-[68px] h-[68px] rounded-full p-[2.5px] bg-gradient-to-tr from-yellow-400 via-orange-500 to-red-500 shadow-sm">
                            <div class="w-full h-full rounded-full border-2 border-surface overflow-hidden bg-surface-variant">
                                <img src="https://i.pravatar.cc/150?img=47" alt="David" class="w-full h-full object-cover">
                            </div>
                        </div>
                        <span class="text-[11px] font-bold text-on-surface">David</span>
                    </div>
                </div>
            </section>

            <section class="mt-4">
                <div class="bg-surface-container-lowest dark:bg-[#1e1e1e] rounded-[32px] p-4 border border-surface-variant/60 shadow-sm mb-6 flex gap-3 items-center cursor-pointer active:scale-[0.98] transition-transform">
                    <div class="w-10 h-10 rounded-full border border-surface-variant shadow-sm overflow-hidden shrink-0">
                        <img src="https://via.placeholder.com/150" alt="You" class="w-full h-full object-cover">
                    </div>
                    <div class="flex-1 bg-surface-variant/30 text-on-surface-variant px-4 py-2.5 rounded-2xl text-[13px] font-medium border border-surface-variant/50">
                        Share an update, ask a question...
                    </div>
                    <button class="w-10 h-10 bg-primary/10 text-primary rounded-full flex items-center justify-center hover:bg-primary/20 transition-colors shrink-0">
                        <span class="material-symbols-outlined text-[20px]">add_photo_alternate</span>
                    </button>
                </div>
                
                <div class="bg-surface-container-lowest dark:bg-[#1e1e1e] rounded-[32px] p-5 border border-surface-variant/60 shadow-sm mb-5">
                    <div class="flex items-center gap-3 mb-3">
                        <img src="https://i.pravatar.cc/150?img=11" alt="Rohan" class="w-10 h-10 rounded-full border border-surface-variant shadow-sm object-cover">
                        <div class="flex-1">
                            <h4 class="font-bold text-[14px] text-on-surface leading-tight">Rohan Sharma</h4>
                            <p class="text-[11px] text-on-surface-variant mt-0.5">2 hours ago</p>
                        </div>
                    </div>
                    <p class="text-[14px] text-on-surface leading-relaxed mb-4 px-1">
                        Does anyone have the notes for yesterday's Environmental Science lecture? I completely missed it due to a fever. Any help would be appreciated! 🤒📚
                    </p>
                    <div class="flex items-center gap-6 border-t border-surface-variant/40 pt-3 px-1">
                        <button class="flex items-center gap-1.5 text-on-surface-variant hover:text-primary transition-colors text-[13px] font-medium active:scale-95">
                            <span class="material-symbols-outlined text-[20px]">favorite</span> 12
                        </button>
                    </div>
                </div>
            </section>
        </div>

        <div id="view-efind" class="tab-content pt-4 hidden">
            <div class="relative mb-6 mt-2">
                <div class="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-on-surface-variant">
                    <span class="material-symbols-outlined text-[20px]">search</span>
                </div>
                <input type="text" class="w-full bg-surface-container-lowest dark:bg-[#1e1e1e] border border-surface-variant/60 text-on-surface text-sm rounded-2xl focus:ring-primary focus:border-primary block pl-11 p-3.5 shadow-sm placeholder-on-surface-variant/70 transition-colors" placeholder="Search apps, students, or resources...">
            </div>

            <div class="mb-8">
                <div class="flex justify-between items-end mb-4">
                    <h3 class="text-lg font-bold text-on-surface">Mini Apps</h3>
                </div>
                <div class="grid grid-cols-4 gap-4">
                    <div class="flex flex-col items-center gap-2 cursor-pointer active:scale-95">
                        <div class="w-14 h-14 rounded-2xl bg-[#e3f2fd] text-[#1565c0] flex items-center justify-center shadow-sm border border-surface-variant/30">
                            <span class="material-symbols-outlined text-[26px]">calendar_month</span>
                        </div>
                        <span class="text-[11px] font-bold text-on-surface text-center">Timetable</span>
                    </div>
                    <div class="flex flex-col items-center gap-2 cursor-pointer active:scale-95">
                        <div class="w-14 h-14 rounded-2xl bg-[#e8f5e9] text-[#2e7d32] flex items-center justify-center shadow-sm border border-surface-variant/30">
                            <span class="material-symbols-outlined text-[26px]">recycling</span>
                        </div>
                        <span class="text-[11px] font-bold text-on-surface text-center">Plastic Log</span>
                    </div>
                </div>
            </div>

            <div>
                <div class="flex justify-between items-end mb-4">
                    <h3 class="text-lg font-bold text-on-surface">Discover Students</h3>
                    <span class="text-[11px] font-bold text-primary cursor-pointer uppercase tracking-wider">Sort: Connections</span>
                </div>
                <div id="discover-students-container" class="space-y-4">
                    <p class="text-sm italic text-center py-4 text-on-surface-variant">Loading real profiles...</p>
                </div>
            </div>
        </div>

        <div id="view-updates" class="tab-content pt-4 hidden">
            <h2 class="text-2xl font-extrabold text-on-surface mb-6">Campus Updates</h2>
            <div class="space-y-4">
                <div class="bg-surface-container-lowest dark:bg-[#1e1e1e] rounded-3xl p-5 border border-surface-variant/60 shadow-sm cursor-pointer active:scale-[0.98] transition-transform duration-200">
                    <div class="flex justify-between items-center mb-3">
                        <span class="bg-primary/10 text-primary text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-widest">Event</span>
                        <span class="text-[11px] text-on-surface-variant font-medium">2 hours ago</span>
                    </div>
                    <h3 class="text-[16px] font-bold text-on-surface mb-1">Annual Tech Symposium 2026</h3>
                    <p class="text-[13px] text-on-surface-variant leading-relaxed">Join us for a 3-day tech extravaganza starting this Friday at the Main Auditorium.</p>
                </div>
            </div>
        </div>

        <div id="view-profile" class="tab-content pt-4 hidden">
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-2xl font-extrabold text-on-surface">My Profile</h2>
                <button class="bg-primary/10 text-primary px-4 py-1.5 rounded-full text-[12px] font-bold tracking-wide active:scale-95 transition-transform">
                    Edit Profile
                </button>
            </div>
            
            <div class="bg-surface-container-lowest dark:bg-[#1e1e1e] rounded-[32px] p-6 shadow-sm border border-surface-variant/60 text-center relative overflow-hidden mb-6">
                <div class="absolute -top-20 -left-10 w-full h-40 bg-gradient-to-b from-primary/10 to-transparent rounded-full blur-2xl"></div>
                <div class="relative z-10 flex flex-col items-center mt-2">
                    
                    <div id="profile-avatar-container" class="w-24 h-24 rounded-full overflow-hidden border-[4px] border-surface shadow-md mb-4 bg-surface-variant relative cursor-pointer active:scale-95 transition-transform group">
                        <img id="profile-avatar-large" alt="User profile" class="w-full h-full object-cover" src="https://via.placeholder.com/150"/>
                        <div class="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <span class="material-symbols-outlined text-white text-[24px]">photo_camera</span>
                        </div>
                        <div class="absolute bottom-0 right-0 bg-primary w-6 h-6 rounded-full border-2 border-surface flex items-center justify-center pointer-events-none">
                            <span class="material-symbols-outlined text-white text-[12px]">edit</span>
                        </div>
                    </div>
                    <input type="file" id="avatar-upload-input" accept="image/*" class="hidden">
                    
                    <h3 id="profile-name" class="text-xl font-extrabold text-on-surface tracking-tight">Loading...</h3>
                    <div class="flex items-center gap-2 mt-2 mb-3">
                        <span id="profile-role" class="bg-primary/10 text-primary text-[10px] font-bold px-3 py-1.5 rounded-full uppercase tracking-widest border border-primary/20">Student</span>
                    </div>
                    <p id="profile-email" class="text-[13px] font-medium text-on-surface-variant flex items-center justify-center gap-1.5 bg-surface-variant/30 px-4 py-2 rounded-xl mb-4">
                        <span class="material-symbols-outlined text-[16px]">mail</span> loading...
                    </p>
                    <p id="profile-bio" class="text-[13px] text-on-surface-variant mb-2 px-4">
                        Loading bio...
                    </p>
                </div>
            </div>

            <div class="bg-surface-container-lowest dark:bg-[#1e1e1e] rounded-[28px] border border-surface-variant/60 overflow-hidden mb-6 shadow-sm p-5">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-[14px] font-bold text-on-surface">Social Profiles</h3>
                    <span onclick="openSocialsModal()" class="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider cursor-pointer hover:text-primary transition-colors">Manage</span>
                </div>
                <div class="flex flex-wrap gap-2" id="profile-social-links">
                    <p class="text-[13px] text-on-surface-variant italic">Loading social links...</p>
                </div>
            </div>

            <div class="bg-surface-container-lowest dark:bg-[#1e1e1e] rounded-[28px] border border-surface-variant/60 overflow-hidden mb-6 shadow-sm">
                <div class="p-5 flex items-center gap-4 border-b border-surface-variant/50">
                    <div class="w-10 h-10 bg-secondary/10 rounded-xl text-secondary flex items-center justify-center">
                        <span class="material-symbols-outlined text-[20px]">badge</span>
                    </div>
                    <div>
                        <p class="text-[10px] uppercase font-bold text-on-surface-variant tracking-widest mb-0.5">Student ID</p>
                        <p id="profile-id" class="text-[15px] font-bold text-on-surface">---</p>
                    </div>
                </div>
                <div class="p-5 flex items-center gap-4">
                    <div class="w-10 h-10 bg-[#e65100]/10 rounded-xl text-[#e65100] flex items-center justify-center">
                        <span class="material-symbols-outlined text-[20px]">menu_book</span>
                    </div>
                    <div>
                        <p class="text-[10px] uppercase font-bold text-on-surface-variant tracking-widest mb-0.5">Course</p>
                        <p id="profile-course" class="text-[15px] font-bold text-on-surface">---</p>
                    </div>
                </div>
            </div>

            <div class="space-y-3 mb-8">
                <div class="w-full bg-surface-container-lowest dark:bg-[#1e1e1e] border border-primary/30 p-4 rounded-2xl flex items-center justify-between shadow-sm bg-primary/5">
                    <div class="flex items-center gap-3.5">
                        <div class="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                            <span class="material-symbols-outlined text-[18px]">lock</span>
                        </div>
                        <div>
                            <span class="font-bold text-[14px] text-on-surface block">Private Account</span>
                            <span class="text-[10px] text-on-surface-variant">Only connections see full profile</span>
                        </div>
                    </div>
                    <label class="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" id="privacy-toggle-switch" class="sr-only peer">
                        <div class="w-11 h-6 bg-surface-variant rounded-full peer peer-checked:bg-primary peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                    </label>
                </div>

                <div class="w-full bg-surface-container-lowest dark:bg-[#1e1e1e] border border-surface-variant/60 p-4 rounded-2xl flex items-center justify-between shadow-sm">
                    <div class="flex items-center gap-3.5">
                        <div class="w-8 h-8 rounded-full bg-surface-variant/50 flex items-center justify-center text-on-surface-variant">
                            <span class="material-symbols-outlined text-[18px]">dark_mode</span>
                        </div>
                        <span class="font-bold text-[14px] text-on-surface">Dark Theme</span>
                    </div>
                    <label class="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" id="theme-toggle-switch" class="sr-only peer">
                        <div class="w-11 h-6 bg-surface-variant rounded-full peer peer-checked:bg-primary peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                    </label>
                </div>

                <button onclick="logout()" class="w-full bg-error/10 border border-error/20 p-4 rounded-2xl flex items-center justify-center gap-2 mt-8 shadow-sm">
                    <span class="material-symbols-outlined text-error text-[20px]">logout</span>
                    <span class="font-bold text-[15px] text-error">Sign Out</span>
                </button>
            </div>
        </div>
    </main>

    <div id="modal-edit-socials" class="fixed inset-0 z-[110] bg-black/40 backdrop-blur-sm hidden flex-col justify-center items-center transition-opacity duration-300 px-4">
        <div class="bg-surface dark:bg-[#1e1e1e] w-full max-w-sm rounded-[32px] p-6 relative">
            <button onclick="closeSocialsModal()" class="absolute top-4 right-5 w-8 h-8 bg-surface-variant rounded-full flex items-center justify-center text-on-surface hover:bg-surface-variant/80 transition-colors">
                <span class="material-symbols-outlined text-[18px]">close</span>
            </button>
            <h3 class="text-xl font-extrabold text-on-surface mb-4">Edit Social Links</h3>
            <div class="space-y-4">
                <div>
                    <label class="text-[12px] font-bold text-on-surface-variant">Instagram URL</label>
                    <input type="url" id="input-social-instagram" class="w-full bg-surface-variant/30 border border-surface-variant/50 rounded-xl p-3 text-sm text-on-surface focus:border-primary focus:ring-1 focus:ring-primary" placeholder="https://instagram.com/yourhandle">
                </div>
                <div>
                    <label class="text-[12px] font-bold text-on-surface-variant">LinkedIn URL</label>
                    <input type="url" id="input-social-linkedin" class="w-full bg-surface-variant/30 border border-surface-variant/50 rounded-xl p-3 text-sm text-on-surface focus:border-primary focus:ring-1 focus:ring-primary" placeholder="https://linkedin.com/in/yourhandle">
                </div>
                <div>
                    <label class="text-[12px] font-bold text-on-surface-variant">GitHub URL</label>
                    <input type="url" id="input-social-github" class="w-full bg-surface-variant/30 border border-surface-variant/50 rounded-xl p-3 text-sm text-on-surface focus:border-primary focus:ring-1 focus:ring-primary" placeholder="https://github.com/yourhandle">
                </div>
                <button onclick="saveSocialLinks()" class="w-full bg-primary text-white py-3.5 rounded-xl font-bold active:scale-95 transition-transform mt-2">
                    Save Links
                </button>
            </div>
        </div>
    </div>

    <div id="modal-profile-private" class="fixed inset-0 z-[110] bg-black/40 backdrop-blur-sm hidden flex-col justify-end transition-opacity duration-300">
        <div class="bg-surface dark:bg-[#1e1e1e] w-full rounded-t-[32px] p-6 pb-12 pt-8 relative animate-[slideUp_0.3s_ease-out]">
            <button onclick="closeProfileModals()" class="absolute top-4 right-5 w-8 h-8 bg-surface-variant rounded-full flex items-center justify-center text-on-surface">
                <span class="material-symbols-outlined text-[18px]">close</span>
            </button>
            <div class="flex flex-col items-center text-center">
                <div class="relative mb-4">
                    <div class="w-24 h-24 rounded-full overflow-hidden border-[4px] border-surface shadow-md bg-surface-variant">
                        <img id="private-profile-avatar" src="https://via.placeholder.com/150" class="w-full h-full object-cover">
                    </div>
                </div>
                <h3 id="private-profile-name" class="text-xl font-extrabold text-on-surface">Loading...</h3>
                <p id="private-profile-course" class="text-[12px] font-medium text-on-surface-variant mb-6">Student</p>
                <div class="w-full bg-surface-variant/20 border border-surface-variant/50 p-5 rounded-2xl mb-6">
                    <span class="material-symbols-outlined text-[32px] text-on-surface-variant opacity-50 mb-2 block">lock</span>
                    <h4 class="text-[14px] font-bold text-on-surface mb-1">This Account is Private</h4>
                    <p class="text-[12px] text-on-surface-variant px-4">Connect with them to see their full profile, bio, and social media links.</p>
                </div>
                <button id="private-connect-btn" class="w-full bg-primary text-white py-3.5 rounded-xl font-bold tracking-wide active:scale-95 transition-transform">
                    Request to Connect
                </button>
            </div>
        </div>
    </div>

    <div id="modal-profile-public" class="fixed inset-0 z-[110] bg-black/40 backdrop-blur-sm hidden flex-col justify-end transition-opacity duration-300">
        <div class="bg-surface dark:bg-[#1e1e1e] w-full rounded-t-[32px] p-6 pb-12 pt-8 relative animate-[slideUp_0.3s_ease-out]">
            <button onclick="closeProfileModals()" class="absolute top-4 right-5 w-8 h-8 bg-surface-variant rounded-full flex items-center justify-center text-on-surface">
                <span class="material-symbols-outlined text-[18px]">close</span>
            </button>
            <div class="flex flex-col items-center text-center">
                <div class="w-24 h-24 rounded-full p-[3px] bg-gradient-to-tr from-primary to-blue-500 mb-4">
                    <div class="w-full h-full rounded-full border-[3px] border-surface overflow-hidden bg-surface-variant">
                        <img id="public-profile-avatar" src="https://via.placeholder.com/150" class="w-full h-full object-cover">
                    </div>
                </div>
                <h3 id="public-profile-name" class="text-xl font-extrabold text-on-surface">Loading...</h3>
                <p id="public-profile-course" class="text-[12px] font-medium text-on-surface-variant mb-4">Student</p>
                <p id="public-profile-bio" class="text-[13px] text-on-surface-variant mb-6 px-4">No bio added.</p>
                
                <div id="public-profile-socials" class="flex gap-4 mb-8">
                    </div>
                
                <div class="flex gap-3 w-full">
                    <button class="flex-1 bg-surface-variant/40 text-on-surface py-3.5 rounded-xl font-bold tracking-wide active:scale-95 transition-transform flex justify-center items-center gap-2">
                        <span class="material-symbols-outlined text-[18px]">mail</span> Message
                    </button>
                    <button id="public-connect-btn" class="flex-1 bg-primary text-white py-3.5 rounded-xl font-bold tracking-wide active:scale-95 transition-transform flex justify-center items-center gap-1">
                        Connect
                    </button>
                </div>
            </div>
        </div>
    </div>

    <nav class="fixed bottom-0 left-0 w-full flex justify-around items-center px-2 pb-6 pt-3 bg-surface/80 dark:bg-[#121212]/90 backdrop-blur-2xl rounded-t-[32px] border-t border-surface-variant/40 shadow-[0_-8px_30px_rgba(0,0,0,0.04)] dark:shadow-[0_-8px_30px_rgba(0,0,0,0.2)] z-[40]">
        <button onclick="switchTab('dashboard')" id="nav-dashboard" class="nav-item active flex flex-col items-center justify-center bg-[#006e1c] dark:bg-primary text-white rounded-2xl px-5 py-2 transition-all active:scale-95">
            <span class="material-symbols-outlined text-[24px]" style="font-variation-settings: 'FILL' 1;">dashboard</span>
            <span class="text-[10px] font-bold font-['Inter'] mt-0.5 tracking-wide">Feed</span>
        </button>
        <button onclick="switchTab('efind')" id="nav-efind" class="nav-item flex flex-col items-center justify-center text-on-surface-variant px-5 py-2 hover:bg-surface-variant/40 rounded-2xl active:scale-95">
            <span class="material-symbols-outlined text-[24px]">search</span>
            <span class="text-[10px] font-bold font-['Inter'] mt-0.5 tracking-wide">Search</span>
        </button>
        <button onclick="switchTab('updates')" id="nav-updates" class="nav-item flex flex-col items-center justify-center text-on-surface-variant px-5 py-2 hover:bg-surface-variant/40 rounded-2xl active:scale-95">
            <span class="material-symbols-outlined text-[24px]">campaign</span>
            <span class="text-[10px] font-bold font-['Inter'] mt-0.5 tracking-wide">Updates</span>
        </button>
        <button onclick="switchTab('profile')" id="nav-profile" class="nav-item flex flex-col items-center justify-center text-on-surface-variant px-5 py-2 hover:bg-surface-variant/40 rounded-2xl active:scale-95">
            <span class="material-symbols-outlined text-[24px]">person</span>
            <span class="text-[10px] font-bold font-['Inter'] mt-0.5 tracking-wide">Profile</span>
        </button>
    </nav>

    <style>
        @keyframes slideUp {
            from { transform: translateY(100%); }
            to { transform: translateY(0); }
        }
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
    </style>
</body>
</html>
