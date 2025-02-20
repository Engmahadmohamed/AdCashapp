// Global variables
let currentUser = null;
let userData = null;

// Initialize Telegram WebApp and Ad Settings
const tg = window.Telegram.WebApp;
tg.expand();

// Initialize OneSignal
window.OneSignal = window.OneSignal || [];
OneSignal.push(function() {
    OneSignal.init({
        appId: "YOUR_ONESIGNAL_APP_ID",
    });
});

// Initialize In-App Interstitial Ads
function initializeInAppAds() {
    show_8980914({ 
        type: 'inApp', 
        inAppSettings: { 
            frequency: 2,     // Show 2 ads
            capping: 0.1,     // Within 6 minutes
            interval: 30,     // 30 seconds between ads
            timeout: 5,       // 5 second delay before first ad
            everyPage: false  // Don't reset on page navigation
        } 
    }).catch(error => {
        console.error('Failed to initialize in-app ads:', error);
    });
}

// Constants for Ad System
const EARNING_PER_AD = 0.1; // $0.1 per ad instead of $0.01
const REFERRAL_BONUS = 0.1; // $0.1 per referral instead of $0.05
const WITHDRAWAL_THRESHOLD = 5.00; // $5 minimum withdrawal
const MAX_REFERRALS = 5; // 5 referrals maximum
const AD_DURATION = 30000; // 30 seconds
const POPUP_INTERVAL = 120000; // Show popup every 2 minutes
const MAX_AD_RETRIES = 2; // Maximum number of ad retry attempts

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
    const storedUser = localStorage.getItem("username");
    if (storedUser) {
        currentUser = storedUser;
        loadUserData();
        document.getElementById("authScreen").style.display = "none";
        document.getElementById("navScreen").style.display = "block";
        updateUI();
        showScreen("homeScreen");
    } else {
        document.getElementById("authScreen").style.display = "block";
        document.getElementById("navScreen").style.display = "none";
    }
}

function login() {
    const phoneInput = document.getElementById("usernameInput");
    const contactInput = document.getElementById("contactInput");
    const phoneNumber = phoneInput.value.trim();
    const contactInfo = contactInput.value.trim();
    
    // Basic phone number validation
    if (phoneNumber === "") {
        showToast({
            message: "Please enter your phone number.",
            type: "error"
        });
        return;
    }
    
    if (!/^\d{9,12}$/.test(phoneNumber)) {
        showToast({
            message: "Please enter a valid phone number.",
            type: "error"
        });
        return;
    }
    
    currentUser = phoneNumber;
    localStorage.setItem("username", currentUser);
    
    // Generate unique referral code for new user
    const userData = {
        balance: 0,
        adsWatched: 0,
        history: [],
        referrals: 0,
        referralCode: generateReferralCode(phoneNumber),
        referredUsers: [],
        totalWithdrawn: 0,
        hasJoinedChannel: false,
        joinDate: new Date().toISOString(),
        contactInfo: contactInfo
    };
    
    localStorage.setItem(`userData_${currentUser}`, JSON.stringify(userData));
    loadUserData();
    checkReferral(); // Check if user came from referral link
    checkAuthState();
    checkChannelMembership();
}

function logout() {
    currentUser = null;
    localStorage.removeItem("username");
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
    updateHistory();
    document.getElementById("referralLink").textContent = "https://t.me/Ad_Cashbot?start=" + encodeURIComponent(currentUser);
    document.getElementById("profileUsername").textContent = currentUser;
    updateReferralLink();
    updateReferralStats();
    document.getElementById("totalEarned").textContent = "$" + (userData.balance + userData.totalWithdrawn || 0).toFixed(2);
    document.getElementById("referralCount").textContent = userData.referrals || 0;
    
    // Update Watch Ad button to show $0.1
    const watchAdBtn = document.querySelector('.action-button.primary');
    if (watchAdBtn) {
        watchAdBtn.disabled = false;
        watchAdBtn.innerHTML = `
            <i class="fas fa-play"></i>
            Watch Ad
            <small>Earn $${EARNING_PER_AD.toFixed(2)} per ad</small>
        `;
    }
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

    // Show loading overlay with message
    // const loadingOverlay = document.getElementById("loadingOverlay");
    // const loadingText = loadingOverlay.querySelector(".loading-text");
    // loadingOverlay.classList.remove('error');
    // loadingOverlay.style.display = "flex";
    // loadingText.textContent = "Loading ad...";

    // Check cooldown
    const lastAdTime = userData.lastAdWatch ? new Date(userData.lastAdWatch) : null;
    const now = new Date();
    
    if (lastAdTime && (now - lastAdTime) < 30000) { // 30 seconds cooldown
        loadingOverlay.classList.add('error');
        loadingText.textContent = "Please wait...";
        
        setTimeout(() => {
            loadingOverlay.style.display = "none";
            loadingOverlay.classList.remove('error');
        }, 1500);
        
        showToast({
            message: "Please wait 30 seconds between ads",
            type: "warning"
        });
        return;
    }

    // Initialize ad SDK
    try {
        window.show_8980914();
        
        setTimeout(() => {
            userData.balance = (userData.balance || 0) + 0.01;
            userData.adsWatched = (userData.adsWatched || 0) + 1;
            userData.lastAdWatch = now.toISOString();
            userData.todayEarnings = (userData.todayEarnings || 0) + 0.01;
            
            if (!userData.history) userData.history = [];
            userData.history.unshift({
                type: 'ad',
                amount: 0.01,
                timestamp: now.toISOString()
            });

            saveUserData();
            updateUI();

            // Hide loading overlay
            loadingOverlay.style.display = "none";

            // Hide all screens first
            document.getElementById("homeScreen").style.display = "none";
            document.getElementById("profileScreen").style.display = "none";
            document.getElementById("referralScreen").style.display = "none";
            
            // Show home screen and update nav
            document.getElementById("homeScreen").style.display = "block";
            updateNavButtons("homeScreen");
            
            // Show success message
            showToast({
                message: "Earned $0.01 from watching ad!",
                type: "success"
            });
        }, 3000);
    } catch (error) {
        console.error("Ad failed to load:", error);
        
        // Show error state
        loadingOverlay.classList.add('error');
        loadingText.textContent = "Loading failed...";
        
        setTimeout(() => {
            loadingOverlay.style.display = "none";
            loadingOverlay.classList.remove('error');
        }, 1500);
        
        showToast({
            message: "Failed to load ad. Please try again.",
            type: "error"
        });
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
        "$" + ((userData.referrals || 0) * REFERRAL_BONUS).toFixed(2);
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
                referrerData.balance += REFERRAL_BONUS; // Now $0.1 bonus
                referrerData.referredUsers.push(currentUser);
                referrerData.lastReferralDate = new Date().toISOString();
                
                // Add to history
                const timestamp = new Date().toLocaleString();
                referrerData.history.push(`Earned $${REFERRAL_BONUS.toFixed(2)} from referral: ${currentUser} at ${timestamp}`);
                
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
function generateReferralCode(username) {
    return btoa(username + '_' + Date.now()).replace(/[^a-zA-Z0-9]/g, '').substr(0, 8);
}

// Initialize app with new ad system
document.addEventListener("DOMContentLoaded", () => {
    checkAuthState();
    initializeInAppAds();
    
    // Add event listeners for buttons
    const watchAdBtn = document.querySelector('.action-button.primary');
    if (watchAdBtn) {
        watchAdBtn.addEventListener('click', watchAd);
    }
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

// Add this utility function
function safeLocalStorage(action, key, value) {
    try {
        switch(action) {
            case 'get':
                return localStorage.getItem(key);
            case 'set':
                localStorage.setItem(key, value);
                return true;
            case 'remove':
                localStorage.removeItem(key);
                return true;
            default:
                return false;
        }
    } catch (error) {
        console.error('LocalStorage error:', error);
        showToast({
            message: "Storage error occurred. Please try again.",
            type: "error"
        });
        return null;
    }
}

// Add this validation function
function validateUserData(userData) {
    if (!userData) return false;
    
    const requiredFields = ['balance', 'adsWatched', 'history', 'referrals'];
    const isValid = requiredFields.every(field => field in userData);
    
    if (!isValid) {
        // Reset to default if data is invalid
        return {
            balance: 0,
            adsWatched: 0,
            history: [],
            referrals: 0,
            referralCode: generateReferralCode(currentUser),
            referredUsers: [],
            totalWithdrawn: 0,
            hasJoinedChannel: false,
            joinDate: new Date().toISOString()
        };
    }
    
    return userData;
}

// Add this cleanup function
function cleanupOldData() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith('userData_')) {
            const userData = JSON.parse(localStorage.getItem(key));
            if (userData.history && userData.history.length > 100) {
                userData.history = userData.history.slice(0, 100);
                localStorage.setItem(key, JSON.stringify(userData));
            }
        }
    }
}

// Add these helper functions
function ensureValidAmount(amount) {
    return parseFloat(parseFloat(amount).toFixed(2)) || 0;
}

function ensureValidDate(date) {
    return date instanceof Date && !isNaN(date) ? date : new Date();
}

function sanitizeUsername(username) {
    return username.replace(/[^a-zA-Z0-9]/g, '');
}

// Admin access function
function checkAdminAccess() {
    const password = prompt("Enter admin password:");
    if (password === "admin123") {
        window.location.href = "admin.html";
    } else {
        alert("Invalid admin password");
    }
} 