// Add this at the top of app.js
console.log('App.js loaded');

// Global variables
let currentUser = null;
let userData = null;

// Constants
const REFERRAL_BONUS = 0.05;
const EARNING_PER_AD = 0.01;

// Utility Functions
function showToast({ message, type = "info", duration = 2000 }) {
    const toastContainer = document.getElementById("toastContainer");
    if (!toastContainer) return;
    
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    
    // Add icon based on type
    const icon = document.createElement("i");
    switch (type) {
        case "success":
            icon.className = "fas fa-check-circle";
            break;
        case "error":
            icon.className = "fas fa-exclamation-circle";
            break;
        default:
            icon.className = "fas fa-info-circle";
    }
    
    const messageSpan = document.createElement("span");
    messageSpan.textContent = message;
    
    toast.appendChild(icon);
    toast.appendChild(messageSpan);
    toastContainer.appendChild(toast);
    
    // Remove toast after duration
    setTimeout(() => {
        toast.style.opacity = "0";
        setTimeout(() => {
            toastContainer.removeChild(toast);
        }, 300);
    }, duration);
}

// Authentication Functions
function checkAuthState() {
    const storedUser = localStorage.getItem("currentUser");
    if (storedUser) {
        currentUser = storedUser;
        loadUserData();
        showMainScreen();
    } else {
        showAuthScreen();
    }
}

function showMainScreen() {
    document.getElementById("authScreen").style.display = "none";
    document.getElementById("navScreen").style.display = "block";
    updateUI();
}

function showAuthScreen() {
    document.getElementById("authScreen").style.display = "block";
    document.getElementById("navScreen").style.display = "none";
}

// Login function
async function login() {
    const phoneInput = document.getElementById("usernameInput");
    const contactInput = document.getElementById("contactInput");
    const loginBtn = document.querySelector(".auth-btn");
    
    const phone = phoneInput.value.trim();
    const contactInfo = contactInput.value.trim();
    
    // Validate phone number
    if (!phone) {
        showToast({
            message: "Please enter your phone number",
            type: "error"
        });
        phoneInput.focus();
        return;
    }
    
    if (!/^\d{9,12}$/.test(phone)) {
        showToast({
            message: "Please enter a valid phone number",
            type: "error"
        });
        phoneInput.focus();
        return;
    }

    // Show loading state
    loginBtn.disabled = true;
    document.getElementById("loadingOverlay").style.display = "flex";
    
    try {
        // Check if user exists
        let userExists = localStorage.getItem(`userData_${phone}`);
        let userData = userExists ? JSON.parse(userExists) : {
            phone,
            contactInfo,
            balance: 0,
            adsWatched: 0,
            history: [],
            referrals: 0,
            referralCode: generateReferralCode(phone),
            referredUsers: [],
            totalWithdrawn: 0,
            hasJoinedChannel: false,
            joinDate: new Date().toISOString(),
            lastAdWatch: null,
            todayEarnings: 0
        };

        // Save user data
        localStorage.setItem(`userData_${phone}`, JSON.stringify(userData));
        
        // Set current user
        currentUser = phone;
        localStorage.setItem("currentUser", phone);
        
        // Show success message
        showToast({
            message: userExists ? "Login successful!" : "Account created successfully!",
            type: "success"
        });

        // Connect to Telegram bot
        const botLink = `https://t.me/Ad_Cashbot?start=${userData.referralCode}`;
        
        // Redirect to Telegram bot after a short delay
        setTimeout(() => {
            window.location.href = botLink;
        }, 1500);
        
    } catch (error) {
        console.error('Login error:', error);
        showToast({
            message: "Login failed. Please try again.",
            type: "error"
        });
    } finally {
        // Hide loading overlay
        document.getElementById("loadingOverlay").style.display = "none";
        loginBtn.disabled = false;
    }
}

function logout() {
    currentUser = null;
    localStorage.removeItem("currentUser");
    document.getElementById("authScreen").style.display = "block";
    document.getElementById("navScreen").style.display = "none";
}

// Data Management
function loadUserData() {
    const dataKey = "userData_" + currentUser;
    const data = localStorage.getItem(dataKey);
    if (data) {
        userData = JSON.parse(data);
        // Ensure referral code exists
        if (!userData.referralCode) {
            userData.referralCode = generateReferralCode(currentUser);
            saveUserData();
        }
    } else {
        userData = {
            balance: 0,
            todayEarnings: 0,
            adsWatched: 0,
            history: [],
            referrals: 0,
            referralCode: generateReferralCode(currentUser),
            referredUsers: [],
            referredBy: null,
            totalWithdrawn: 0,
            hasJoinedChannel: false
        };
        saveUserData();
    }
    updateReferralLink(); // Update referral UI when data loads
}

function saveUserData() {
    const dataKey = "userData_" + currentUser;
    localStorage.setItem(dataKey, JSON.stringify(userData));
}

// UI Updates
function updateUI() {
    document.getElementById("balance").textContent = `$${userData.balance.toFixed(2)}`;
    document.getElementById("adsWatched").textContent = userData.adsWatched || 0;
    document.getElementById("todayEarnings").textContent = `$${(userData.todayEarnings || 0).toFixed(2)}`;
    updateAdCooldown();
    updateHistory();
    document.getElementById("referralLink").textContent = "https://t.me/Ad_Cashbot?start=" + encodeURIComponent(currentUser);
    document.getElementById("profileUsername").textContent = currentUser;
    updateReferralLink();
    updateReferralStats();
    document.getElementById("totalEarned").textContent = "$" + (userData.balance + userData.totalWithdrawn || 0).toFixed(2);
    document.getElementById("referralCount").textContent = userData.referrals || 0;
}

function updateHistory() {
    const historyList = document.getElementById("historyList");
    historyList.innerHTML = "";
    userData.history.forEach(item => {
        const div = document.createElement("div");
        div.className = "history-item";
        div.textContent = item;
        historyList.appendChild(div);
    });
}

// Ad Functions
function watchAd() {
    // Check if user has joined channel
    if (!userData.hasJoinedChannel) {
        showToast({
            message: "Please join our Telegram channel first!",
            type: "error"
        });
        showChannelJoinModal();
        return;
    }

    // Show loading overlay
    document.getElementById("loadingOverlay").style.display = "flex";

    // Check cooldown
    const lastAdTime = userData.lastAdWatch ? new Date(userData.lastAdWatch) : null;
    const now = new Date();
    
    if (lastAdTime && (now - lastAdTime) < 30000) { // 30 seconds cooldown
        document.getElementById("loadingOverlay").style.display = "none";
        showToast({
            message: "Please wait 30 seconds between ads",
            type: "warning"
        });
        return;
    }

    // Initialize ad SDK
    try {
        window.show_8980914();
        
        // Update user data after successful ad view
        setTimeout(() => {
            userData.balance = (userData.balance || 0) + 0.01;
            userData.adsWatched = (userData.adsWatched || 0) + 1;
            userData.lastAdWatch = now.toISOString();
            userData.todayEarnings = (userData.todayEarnings || 0) + 0.01;
            
            // Add to history
            if (!userData.history) userData.history = [];
            userData.history.unshift({
                type: 'ad',
                amount: 0.01,
                timestamp: now.toISOString()
            });

            // Save data
            saveUserData();
            updateUI();

            // Show success message
            showToast({
                message: "Earned $0.01 from watching ad!",
                type: "success"
            });
            
            document.getElementById("loadingOverlay").style.display = "none";
        }, 3000);
    } catch (error) {
        console.error("Ad failed to load:", error);
        document.getElementById("loadingOverlay").style.display = "none";
        showToast({
            message: "Failed to load ad. Please try again.",
            type: "error"
        });
    }
}

// Add cooldown timer display
function updateAdCooldown() {
    const watchAdBtn = document.querySelector('.action-button.primary');
    if (!watchAdBtn) return;

    const lastAdTime = userData.lastAdWatch ? new Date(userData.lastAdWatch) : null;
    const now = new Date();
    
    if (lastAdTime && (now - lastAdTime) < 30000) {
        const remainingTime = Math.ceil((30000 - (now - lastAdTime)) / 1000);
        watchAdBtn.disabled = true;
        watchAdBtn.innerHTML = `
            <i class="fas fa-clock"></i>
            Wait ${remainingTime}s
            <small>Cooldown</small>
        `;
    } else {
        watchAdBtn.disabled = false;
        watchAdBtn.innerHTML = `
            <i class="fas fa-play"></i>
            Watch Ad
            <small>Earn $0.01 per ad</small>
        `;
    }
}

// Navigation Functions
function showScreen(screenId) {
    document.getElementById("homeScreen").style.display = "none";
    document.getElementById("profileScreen").style.display = "none";
    document.getElementById("referralScreen").style.display = "none";
    document.getElementById(screenId).style.display = "block";
    updateNavButtons(screenId);
}

function updateNavButtons(activeScreen) {
    document.getElementById("navHome").classList.remove("active");
    document.getElementById("navProfile").classList.remove("active");
    document.getElementById("navReferral").classList.remove("active");
    if (activeScreen === "homeScreen") {
        document.getElementById("navHome").classList.add("active");
    } else if (activeScreen === "profileScreen") {
        document.getElementById("navProfile").classList.add("active");
    } else if (activeScreen === "referralScreen") {
        document.getElementById("navReferral").classList.add("active");
    }
}

// Withdraw Functions
function showWithdrawModal() {
    document.getElementById("withdrawModal").style.display = "flex";
}

function closeWithdrawModal() {
    document.getElementById("withdrawModal").style.display = "none";
}

function processWithdraw() {
    if (!userData.hasJoinedChannel) {
        showChannelJoinModal();
        return;
    }
    const evcNumber = document.getElementById("evcNumber").value.trim();
    const amount = parseFloat(document.getElementById("withdrawAmount").value);
    const amountInput = document.getElementById("withdrawAmount").parentElement;
    
    // Reset validation styles
    amountInput.classList.remove('invalid');
    
    if (evcNumber === "" || isNaN(amount)) {
        showToast({
            message: "Please enter valid withdrawal details.",
            type: "error"
        });
        return;
    }
    
    if (amount < 5) {
        amountInput.classList.add('invalid');
        showToast({
            message: "Minimum withdrawal amount is $5.00.",
            type: "error"
        });
        return;
    }
    
    if (userData.balance < amount) {
        showToast({
            message: "Insufficient balance.",
            type: "error"
        });
        return;
    }
    
    // Process withdrawal
    userData.balance -= amount;
    userData.totalWithdrawn = (userData.totalWithdrawn || 0) + amount;
    
    const timestamp = new Date().toLocaleTimeString();
    userData.history.push(`Withdrew $${amount.toFixed(2)} to ${evcNumber} at ${timestamp}`);
    
    saveUserData();
    updateUI();
    closeWithdrawModal();
    
    showToast({
        message: "Withdrawal successful!",
        type: "success"
    });
}

// Add input validation
function validateWithdrawAmount() {
    const amount = parseFloat(document.getElementById("withdrawAmount").value);
    const amountInput = document.getElementById("withdrawAmount").parentElement;
    const confirmBtn = document.querySelector('.modal-body .primary-btn');
    
    if (isNaN(amount) || amount < 5) {
        amountInput.classList.add('invalid');
        confirmBtn.disabled = true;
    } else {
        amountInput.classList.remove('invalid');
        confirmBtn.disabled = false;
    }
}

// Add event listener for amount input
document.getElementById("withdrawAmount").addEventListener('input', validateWithdrawAmount);

// Referral Functions
function updateReferralLink() {
    const referralLink = document.getElementById("referralLink");
    const currentReferrals = document.getElementById("currentReferrals");
    const referralProgress = document.getElementById("referralProgress");
    
    // Update referral count and progress bar
    const referralCount = userData.referrals || 0;
    currentReferrals.textContent = referralCount;
    referralProgress.style.width = `${(referralCount / 5) * 100}%`;
    
    // Use Telegram bot link with user's referral code
    const telegramBotLink = `https://t.me/Ad_Cashbot?start=${userData.referralCode}`;
    referralLink.value = telegramBotLink;
}

function copyReferral() {
    const referralLink = document.getElementById("referralLink");
    referralLink.select();
    document.execCommand('copy');
    
    // Show success toast
    showToast({
        message: "Referral link copied!",
        type: "success"
    });
}

function shareOnTelegram() {
    const referralLink = document.getElementById("referralLink").value;
    const text = encodeURIComponent(`Join EarnPro and earn money by watching ads! 💰\n\nUse my referral link to get started:\n${referralLink}`);
    const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${text}`;
    window.open(telegramUrl, '_blank');
}

function shareOnWhatsApp() {
    const referralLink = document.getElementById("referralLink").value;
    const text = encodeURIComponent(`Join EarnPro and earn money by watching ads! 💰\n\nUse my referral link to get started:\n${referralLink}`);
    const whatsappUrl = `https://wa.me/?text=${text}`;
    window.open(whatsappUrl, '_blank');
}

function updateReferralStats() {
    document.getElementById("totalReferrals").textContent = userData.referrals || 0;
    document.getElementById("referralEarnings").textContent = 
        "$" + ((userData.referrals || 0) * 0.05).toFixed(2);
}

// Add this function to check channel membership
function checkChannelMembership() {
    if (!userData.hasJoinedChannel) {
        showChannelJoinModal();
    }
}

// Add this function to check for referral code on login/signup
function checkReferral() {
    const urlParams = new URLSearchParams(window.location.search);
    const referralCode = urlParams.get('ref');
    
    if (referralCode) {
        const allUsers = getAllUsers();
        const referrer = allUsers.find(user => user.referralCode === referralCode);
        
        if (referrer && referrer.username !== currentUser) {
            const referrerData = JSON.parse(localStorage.getItem(`userData_${referrer.username}`));
            
            // Check referral limit
            if (referrerData.referrals >= 5) {
                showToast({
                    message: "Referrer has reached maximum referral limit",
                    type: "error"
                });
                return;
            }
            
            // Initialize referral tracking arrays if they don't exist
            if (!referrerData.referredUsers) {
                referrerData.referredUsers = [];
            }
            
            // Check if this user hasn't been counted as a referral before
            if (!referrerData.referredUsers.includes(currentUser)) {
                // Add referral bonus
                referrerData.referrals = (referrerData.referrals || 0) + 1;
                referrerData.balance += 0.05; // Referral bonus
                referrerData.referredUsers.push(currentUser);
                referrerData.lastReferralDate = new Date().toISOString();
                
                // Add to history
                const timestamp = new Date().toLocaleString();
                referrerData.history.push(`Earned $0.05 from referral: ${currentUser} at ${timestamp}`);
                
                // Save referrer's data
                localStorage.setItem(`userData_${referrer.username}`, JSON.stringify(referrerData));
                
                // Mark current user as referred
                userData.referredBy = referrer.username;
                saveUserData();
                
                showToast({
                    message: "Welcome! You were referred by " + referrer.username,
                    type: "success"
                });
            }
        }
    }
}

// Generate a unique referral code
function generateReferralCode(phone) {
    return btoa(phone + '_' + Date.now()).replace(/[^a-zA-Z0-9]/g, '').substr(0, 8);
}

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded');
    checkAuthState();
});

function showChannelJoinModal() {
    const modal = document.getElementById("channelJoinModal");
    modal.style.display = "flex";
}

function verifyChannelJoin() {
    // Here you would typically verify channel membership via Telegram Bot API
    // For now, we'll just accept the user's confirmation
    userData.hasJoinedChannel = true;
    saveUserData();
    
    document.getElementById("channelJoinModal").style.display = "none";
    
    showToast({
        message: "Thank you for joining our channel!",
        type: "success",
        duration: 3000
    });
}

// Add cooldown timer interval
setInterval(updateAdCooldown, 1000); 