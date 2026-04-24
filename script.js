// Global variables
let currentUser = null;
let deviceFingerprint = localStorage.getItem('deviceFP') || generateDeviceFP();
let postId = null;

// Initialize app based on admin/user
function initUserApp() {
    checkAutoDeletePost();
    loadHistory();
    loadChannel();
    setInterval(checkAutoDeletePost, 60000); // Check every minute
}

function generateDeviceFP() {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillText('device-fingerprint', 2, 2);
    return canvas.toDataURL();
}

// === AUTH SYSTEM ===
async function loginUser() {
    const phone = document.getElementById('phone').value;
    const password = document.getElementById('password').value;
    const specialCode = document.getElementById('specialCode').value;

    if (!phone || !password || !specialCode) {
        showError('All fields required');
        return;
    }

    // Check special code validity
    const codeRef = db.ref('specialCodes/' + specialCode);
    const codeSnap = await codeRef.once('value');
    
    if (!codeSnap.exists()) {
        showError('Invalid Special Code');
        return;
    }

    const codeData = codeSnap.val();
    const now = Date.now();
    
    if (now > codeData.expiry) {
        showError('Special Code Expired');
        return;
    }

    // Check device
    const userRef = db.ref('users/' + phone);
    const userSnap = await userRef.once('value');
    
    if (userSnap.exists() && userSnap.val().deviceFP !== deviceFingerprint) {
        showError('Device not authorized');
        return;
    }

    // Login success
    currentUser = { phone, specialCode, deviceFP: deviceFingerprint };
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
    localStorage.setItem('deviceFP', deviceFingerprint);
    
    document.getElementById('loginModal').classList.add('hidden');
    document.getElementById('mainApp').classList.remove('hidden');
    
    updateLastActive(phone);
    loadDailyPost();
}

function adminLogin() {
    const pass = document.getElementById('adminPass').value;
    if (pass === ADMIN_PASSWORD) {
        document.getElementById('adminLogin').classList.add('hidden');
        document.getElementById('adminDashboard').classList.remove('hidden');
        loadAdminData();
    } else {
        alert('Wrong Password');
    }
}

function logout() {
    localStorage.removeItem('currentUser');
    location.reload();
}

function logoutAdmin() {
    location.href = 'index.html';
}

// === DAILY POSTS ===
function loadDailyPost() {
    const today = new Date().toDateString();
    const postRef = db.ref('dailyPosts/' + today);
    
    postRef.on('value', (snap) => {
        const post = snap.val();
        const postSection = document.getElementById('todayPost');
        const newUpdate = document.getElementById('newUpdateSoon');
        
        if (post) {
            document.getElementById('postText').textContent = post.text;
            document.getElementById('likeCount').textContent = post.likes || 12;
            document.getElementById('loveCount').textContent = post.loves || 8;
            
            if (post.imageUrl) {
                document.getElementById('postImage').src = post.imageUrl;
                document.getElementById('postImage').classList.remove('hidden');
            }
            
            postSection.classList.remove('hidden');
            newUpdate.classList.add('hidden');
            loadReactUsers(today);
        } else {
            postSection.classList.add('hidden');
            newUpdate.classList.remove('hidden');
        }
    });
}

function reactToPost(type) {
    if (!currentUser) return;
    
    const today = new Date().toDateString();
    const userReactsRef = db.ref(`dailyPosts/${today}/reacts/${currentUser.phone}`);
    
    userReactsRef.set(type).then(() => {
        updateLastActive(currentUser.phone);
    });
}

function loadReactUsers(today) {
    const reactsRef = db.ref(`dailyPosts/${today}/reacts`);
    reactsRef.on('value', (snap) => {
        let html = '';
        snap.forEach((child) => {
            const react = child.val();
            html += `<span class="px-2 py-1 bg-white/20 rounded-full text-xs mr-1">${child.key}: ${react === 'like' ? '👍' : '❤️'}</span>`;
        });
        document.getElementById('reactUsers').innerHTML = html || 'Be first to react!';
    });
}

async function checkAutoDeletePost() {
    const now = new Date();
    if (now.getHours() === 0 && now.getMinutes() === 0) {
        const yesterday = new Date(Date.now() - 86400000).toDateString();
        const oldPost = await db.ref('dailyPosts/' + yesterday).once('value');
        
        if (oldPost.exists()) {
            // Move to history
            const postData = oldPost.val();
            postData.deletedAt = Date.now();
            db.ref('postHistory/' + Date.now()).set(postData);
            db.ref('dailyPosts/' + yesterday).remove();
        }
    }
}

// === HISTORY ===
function loadHistory() {
    const historyRef = db.ref('postHistory');
    historyRef.orderByChild('deletedAt').limitToLast(10).on('value', (snap) => {
        let html = '';
        snap.forEach((child) => {
            const post = child.val();
            html += `
                <div class="bg-white/5 p-4 rounded-2xl border border-white/10">
                    <p class="text-white/80 mb-2">${post.text.substring(0, 100)}...</p>
                    <div class="flex gap-4 text-sm text-white/60">
                        <span>👍 ${post.likes || 0}</span>
                        <span>❤️ ${post.loves || 0}</span>
                        <span>${new Date(post.deletedAt).toLocaleDateString()}</span>
                    </div>
                </div>
            `;
        });
        document.getElementById('historyList').innerHTML = html || '<p class="text-white/50 text-center py-8">No history yet</p>';
    });
}

// === CHANNEL ===
function loadChannel() {
    const channelRef = db.ref('channel');
    channelRef.on('value', (snap) => {
        let html = '';
        snap.forEach((child) => {
            const msg = child.val();
            html += `
                <div class="bg-white/10 p-4 rounded-2xl border border-white/20">
                    <div class="flex items-start gap-3 mb-2">
                        <div class="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                            ${msg.type === 'voice' ? '🎤' : '💬'}
                        </div>
                        <div class="flex-1">
                            <p class="font-bold text-white">${msg.text.substring(0, 80)}...</p>
                            <div class="flex gap-2 text-xs text-white/60 mt-1">
                                <span>👥 ${msg.followers || 1200}</span>
                                <span>❤️ ${msg.likes || 250}</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });
        document.getElementById('channelPosts').innerHTML = html;
    });
}

function followChannel() {
    // Simple follow animation
    const btn = document.getElementById('followBtn');
    btn.textContent = '✅ Following (1.2K)';
    btn.disabled = true;
}

// === ADMIN FUNCTIONS ===
async function createPost() {
    const today = new Date().toDateString();
    const text = document.getElementById('postTextAdmin').value;
    const imageFile = document.getElementById('postImageAdmin').files[0];
    const fakeLikes = parseInt(document.getElementById('fakeLikes').value) || 12;
    const fakeLoves = parseInt(document.getElementById('fakeLoves').value) || 8;
    const fakeFollowers = parseInt(document.getElementById('fakeFollowers').value) || 1200;

    if (!text) return alert('Post text required');

    const postData = {
        text,
        likes: fakeLikes,
        loves: fakeLoves,
        createdAt: Date.now(),
        fakeReacts: true
    };

    // Upload image if exists
    if (imageFile) {
        const storageRef = firebase.storage().ref('posts/' + Date.now() + '.jpg');
        await storageRef.put(imageFile);
        postData.imageUrl = await storageRef.getDownloadURL();
    }

    await db.ref('dailyPosts/' + today).set(postData);
    
    // Add to channel
    db.ref('channel/' + Date.now()).set({
        text: text.substring(0, 100),
        type: 'text',
        followers: fakeFollowers,
        likes: Math.floor(Math.random() * 100) + 200,
        timestamp: Date.now()
    });

    alert('✅ Post Live!');
}

function generateSpecialCode() {
    const duration = document.getElementById('codeDuration').value;
    const code = 'VIP' + Date.now().toString().slice(-6);
    const expiry = Date.now() + (duration * 24 * 60 * 60 * 1000);
    
    db.ref('specialCodes/' + code).set({
        duration: parseInt(duration),
        expiry,
        createdAt: Date.now()
    });
    
    document.getElementById('currentCode').textContent = code;
}

async function loadAdminData() {
    // Load users
    db.ref('users').on('value', (snap) => {
        let html = '';
        snap.forEach((child) => {
            const user = child.val();
            const timeAgo = timeAgoFormat(user.lastActive);
            html += `
                <div class="flex justify-between items-center p-4 bg-white/5 rounded-xl border border-white/10">
                    <span class="font-bold text-white">${child.key}</span>
                    <div class="text-right text-white/70 text-sm">
                        <div>${timeAgo}</div>
                        <div>Device: ${user.deviceFP ? '✅' : '❌'}</div>
                    </div>
                </div>
            `;
        });
        document.getElementById('userList').innerHTML = html;
    });

    // Load history for permanent delete
    loadAdminHistory();
}

function loadAdminHistory() {
    db.ref('postHistory').on('value', (snap) => {
        let html = '';
        snap.forEach((child) => {
            html += `
                <div class="flex justify-between items-center p-4 bg-red-500/10 rounded-xl border border-red-500/20">
                    <div>
                        <p class="text-white font-medium">${child.val().text.substring(0, 50)}...</p>
                        <span class="text-xs text-white/60">${new Date(child.val().deletedAt).toLocaleDateString()}</span>
                    </div>
                    <button onclick="deletePostForever('${child.key}')" class="bg-red-500 text-white px-4 py-1 rounded-lg text-sm hover:bg-red-600">🗑️ Delete</button>
                </div>
            `;
        });
        document.getElementById('historyAdmin').innerHTML = html;
    });
}

async function deletePostForever(postId) {
    if (confirm('Delete forever?')) {
        await db.ref('postHistory/' + postId).remove();
    }
}

function updateLastActive(phone) {
    if (currentUser) {
        db.ref('users/' + phone).update({
            lastActive: Date.now(),
            deviceFP: deviceFingerprint
        });
    }
}

function timeAgoFormat(timestamp) {
    const now = Date.now();
    const diff = Math.floor((now - timestamp) / 1000);
    
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
    return `${Math.floor(diff/86400)}d ago`;
}

function showError(msg) {
    const errorEl = document.getElementById('loginError');
    errorEl.textContent = msg;
    errorEl.classList.remove('hidden');
    setTimeout(() => errorEl.classList.add('hidden'), 3000);
}

function refreshChannel() {
    location.reload();
}

// Auto-check expiry every hour
setInterval(async () => {
    if (currentUser) {
        const codeRef = db.ref('specialCodes/' + currentUser.specialCode);
        const snap = await codeRef.once('value');
        if (snap.exists() && Date.now() > snap.val().expiry) {
            alert('Session expired! Please login again.');
            logout();
        }
    }
}, 3600000);