// Admin Authentication
const ADMIN_PASSWORD = "615102410"; // Admin password set to 615102410

// Admin authentication state
let adminToken = null;

function checkAdminAuth() {
    const storedAuth = localStorage.getItem("adminAuth");
    if (!storedAuth) {
        const password = prompt("Enter admin password:");
        if (password !== ADMIN_PASSWORD) {
            alert("Invalid password");
            window.location.href = "index.html";
            return false;
        }
        localStorage.setItem("adminAuth", "true");
    }
    return true;
}

// Check if admin is logged in
function checkAuth() {
    const isAdmin = sessionStorage.getItem('isAdmin');
    if (!isAdmin) {
        window.location.href = 'index.html';
    }
}

// Admin login
async function adminLogin(event) {
    event.preventDefault();
    
    const username = document.getElementById('adminUsername').value;
    const password = document.getElementById('adminPassword').value;

    try {
        const response = await fetch('/api/admin/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();
        
        if (response.ok) {
            adminToken = data.token;
            sessionStorage.setItem('adminToken', adminToken);
            window.location.href = '/admin-dashboard';
        } else {
            showError(data.error);
        }
    } catch (error) {
        showError('Login failed');
    }
}

// Load and display all users
async function loadAllUsers() {
    if (!checkAuth()) return;

    try {
        const response = await fetch('/api/admin/users', {
            headers: {
                'Authorization': `Bearer ${adminToken}`
            }
        });
        const users = await response.json();
        displayUsers(users);
        updateAdminStats(users);
    } catch (error) {
        showError('Failed to load users');
    }
}

function getAllUsers() {
    const users = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith("userData_")) {
            const username = key.replace("userData_", "");
            const userData = JSON.parse(localStorage.getItem(key));
            
            // Store in admin storage
            const adminStorage = JSON.parse(localStorage.getItem('adminStorage'));
            if (!adminStorage.users[username]) {
                adminStorage.users[username] = {
                    joinDate: userData.joinDate || new Date().toISOString(),
                    lastActive: new Date().toISOString()
                };
                localStorage.setItem('adminStorage', JSON.stringify(adminStorage));
            }
            
            users.push({ username, ...userData });
        }
    }
    return users;
}

function updateAdminStats(users) {
    const totalUsers = users.length;
    const totalWithdrawn = users.reduce((sum, user) => sum + (user.totalWithdrawn || 0), 0);
    const totalAdsWatched = users.reduce((sum, user) => sum + (user.adsWatched || 0), 0);

    document.getElementById("totalUsers").textContent = totalUsers;
    document.getElementById("totalWithdrawn").textContent = `$${totalWithdrawn.toFixed(2)}`;
    document.getElementById("totalAdsWatched").textContent = totalAdsWatched;
}

function displayUsers(users) {
    const tbody = document.getElementById("usersTableBody");
    tbody.innerHTML = "";

    users.forEach(user => {
        const tr = document.createElement("tr");
        const joinDate = formatDate(new Date(user.created_at));
        
        tr.innerHTML = `
            <td>
                ${user.phone}
                ${user.contact_info ? `
                    <div class="contact-info">
                        <i class="fas fa-address-card"></i>
                        ${user.contact_info}
                    </div>
                ` : ''}
            </td>
            <td>$${user.balance.toFixed(2)}</td>
            <td>$${user.total_earned.toFixed(2)}</td>
            <td>${user.ads_watched}</td>
            <td>${user.referral_count || 0}</td>
            <td>${joinDate}</td>
            <td>
                <button onclick="viewUserDetails('${user.id}')" class="admin-btn">
                    <i class="fas fa-eye"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

async function viewUserDetails(userId) {
    try {
        const response = await fetch(`/api/admin/users/${userId}`, {
            headers: {
                'Authorization': `Bearer ${adminToken}`
            }
        });
        const userData = await response.json();
        
        // Display user details in modal
        displayUserModal(userData);
    } catch (error) {
        showError('Failed to load user details');
    }
}

async function updateUserBalance(userId, newBalance) {
    try {
        const response = await fetch(`/api/admin/users/${userId}/balance`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${adminToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ balance: newBalance })
        });

        if (response.ok) {
            showSuccess('Balance updated successfully');
            loadAllUsers();
        } else {
            showError('Failed to update balance');
        }
    } catch (error) {
        showError('Failed to update balance');
    }
}

async function processWithdrawal(withdrawalId, status) {
    try {
        const response = await fetch(`/api/admin/withdrawals/${withdrawalId}/process`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${adminToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status })
        });

        if (response.ok) {
            showSuccess('Withdrawal processed successfully');
            loadWithdrawals();
        } else {
            showError('Failed to process withdrawal');
        }
    } catch (error) {
        showError('Failed to process withdrawal');
    }
}

// Admin logout
async function adminLogout() {
    if (!adminToken) return;

    try {
        await fetch('/api/admin/logout', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${adminToken}`
            }
        });
        sessionStorage.removeItem('adminToken');
        window.location.href = '/admin';
    } catch (error) {
        showError('Logout failed');
    }
}

// Helper functions
function formatDate(date) {
    return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }).format(date);
}

function showError(message) {
    // Implement your error display logic
    console.error(message);
}

function showSuccess(message) {
    // Implement your success message display logic
    console.log(message);
}

// Initialize admin panel
document.addEventListener('DOMContentLoaded', () => {
    adminToken = sessionStorage.getItem('adminToken');
    
    if (window.location.pathname.includes('admin-dashboard')) {
        loadAllUsers();
        loadWithdrawals();
        
        // Set up search functionality
        const searchInput = document.getElementById("searchUser");
        if (searchInput) {
            searchInput.addEventListener("input", async (e) => {
                const searchTerm = e.target.value;
                try {
                    const response = await fetch(`/api/admin/users/search?term=${encodeURIComponent(searchTerm)}`, {
                        headers: {
                            'Authorization': `Bearer ${adminToken}`
                        }
                    });
                    const users = await response.json();
                    displayUsers(users);
                } catch (error) {
                    showError('Search failed');
                }
            });
        }
    }
});

// Navigation handling
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        const section = item.dataset.section;
        showSection(section);
    });
});

function showSection(sectionId) {
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });
    document.getElementById(sectionId + 'Section').classList.add('active');
    
    // Load section data
    if (sectionId === 'users') loadUsers();
    if (sectionId === 'withdrawals') loadWithdrawals();
}

// Dashboard functions
async function loadDashboard() {
    try {
        const [stats, activity] = await Promise.all([
            fetch('/api/admin/dashboard/stats', {
                headers: { 'Authorization': `Bearer ${adminToken}` }
            }).then(res => res.json()),
            fetch('/api/admin/activity', {
                headers: { 'Authorization': `Bearer ${adminToken}` }
            }).then(res => res.json())
        ]);

        updateDashboardStats(stats);
        updateActivityList(activity);
    } catch (error) {
        showError('Failed to load dashboard data');
    }
}

function updateDashboardStats(stats) {
    document.getElementById('totalUsers').textContent = stats.totalUsers.count;
    document.getElementById('newUsers').textContent = `${stats.newUsers.count} today`;
    document.getElementById('totalWithdrawn').textContent = `$${(stats.totalWithdrawn.total || 0).toFixed(2)}`;
    document.getElementById('pendingWithdrawals').textContent = `${stats.pendingWithdrawals.count} pending`;
    document.getElementById('totalAdsWatched').textContent = stats.totalAdsWatched.total || 0;
    document.getElementById('todayAds').textContent = `${stats.todayAdsWatched.total || 0} today`;
}

function updateActivityList(activities) {
    const activityList = document.getElementById('activityList');
    activityList.innerHTML = activities.map(activity => `
        <div class="activity-item ${activity.type}">
            <div class="activity-icon">
                <i class="fas ${activity.type === 'withdrawal' ? 'fa-money-bill' : 'fa-play-circle'}"></i>
            </div>
            <div class="activity-details">
                <div class="activity-text">
                    ${activity.type === 'withdrawal' 
                        ? `Withdrawal request of $${activity.amount} by ${activity.user}`
                        : `Ad watched by ${activity.user}`}
                </div>
                <div class="activity-time">${formatDate(new Date(activity.created_at))}</div>
            </div>
            ${activity.type === 'withdrawal' && activity.status === 'pending' ? `
                <button class="process-btn" onclick="processWithdrawal(${activity.id}, 'completed')">
                    Process
                </button>
            ` : ''}
        </div>
    `).join('');
}

// Withdrawals functions
async function loadWithdrawals() {
    try {
        const response = await fetch('/api/admin/withdrawals', {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        const withdrawals = await response.json();
        
        const withdrawalsList = document.getElementById('withdrawalsList');
        withdrawalsList.innerHTML = withdrawals.map(withdrawal => `
            <div class="withdrawal-card">
                <div class="withdrawal-header">
                    <div class="user-info">
                        <i class="fas fa-user"></i>
                        <span>${withdrawal.phone}</span>
                    </div>
                    <div class="amount">$${withdrawal.amount.toFixed(2)}</div>
                </div>
                <div class="withdrawal-details">
                    <div class="detail-item">
                        <span>Contact:</span>
                        <strong>${withdrawal.contact_info || 'Not provided'}</strong>
                    </div>
                    <div class="detail-item">
                        <span>Requested:</span>
                        <strong>${formatDate(new Date(withdrawal.created_at))}</strong>
                    </div>
                </div>
                <div class="withdrawal-actions">
                    <button onclick="processWithdrawal(${withdrawal.id}, 'completed')" class="approve-btn">
                        <i class="fas fa-check"></i> Approve
                    </button>
                    <button onclick="processWithdrawal(${withdrawal.id}, 'rejected')" class="reject-btn">
                        <i class="fas fa-times"></i> Reject
                    </button>
                </div>
            </div>
        `).join('');
    } catch (error) {
        showError('Failed to load withdrawals');
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    adminToken = sessionStorage.getItem('adminToken');
    if (!adminToken) {
        window.location.href = '/admin-login.html';
        return;
    }
    loadDashboard();
});

// Show different sections
function showSection(sectionId) {
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });
    document.getElementById(sectionId + 'Section').classList.add('active');
    
    // Load section data
    if (sectionId === 'users') loadUsers();
    if (sectionId === 'withdrawals') loadWithdrawals();
}

// Load users
function loadUsers() {
    const users = getAllUsers();
    const tbody = document.getElementById('usersTableBody');
    tbody.innerHTML = '';
    
    users.forEach(user => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${user.phone}</td>
            <td>$${user.balance.toFixed(2)}</td>
            <td>${user.adsWatched}</td>
            <td>
                <button onclick="editUser('${user.phone}')">Edit</button>
                <button onclick="deleteUser('${user.phone}')">Delete</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Load withdrawals
function loadWithdrawals() {
    const withdrawals = getAllWithdrawals();
    const container = document.getElementById('withdrawalsList');
    container.innerHTML = '';
    
    withdrawals.forEach(withdrawal => {
        const div = document.createElement('div');
        div.className = 'withdrawal-card';
        div.innerHTML = `
            <h3>$${withdrawal.amount}</h3>
            <p>Phone: ${withdrawal.phone}</p>
            <p>Status: ${withdrawal.status}</p>
            <button onclick="processWithdrawal('${withdrawal.id}')">Process</button>
        `;
        container.appendChild(div);
    });
}

// Logout function
function logout() {
    sessionStorage.removeItem('isAdmin');
    window.location.href = 'index.html';
}

// Initialize admin panel
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    showSection('dashboard');
}); 