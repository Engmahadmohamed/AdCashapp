<?php
session_start();
header('Content-Type: application/json');
require_once 'config.php';

// Helper function to validate phone number
function validatePhone($phone) {
    return preg_match('/^\+?[1-9]\d{1,14}$/', $phone);
}

// Helper function to add activity history
function addActivity($conn, $userId, $type, $amount) {
    $stmt = $conn->prepare("INSERT INTO activity_history (user_id, activity_type, amount) VALUES (?, ?, ?)");
    $stmt->bind_param("isd", $userId, $type, $amount);
    $stmt->execute();
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $action = isset($_POST['action']) ? $_POST['action'] : '';
    
    switch($action) {
        case 'login':
            $phone = isset($_POST['phone']) ? $_POST['phone'] : '';
            $contact = isset($_POST['contact']) ? $_POST['contact'] : '';
            
            if (!validatePhone($phone)) {
                echo json_encode(['status' => 'error', 'message' => 'Invalid phone number']);
                exit;
            }
            
            // Check if user exists or create new user
            $stmt = $conn->prepare("SELECT * FROM users WHERE phone = ?");
            $stmt->bind_param("s", $phone);
            $stmt->execute();
            $result = $stmt->get_result();
            
            if ($result->num_rows === 0) {
                // Create new user
                $stmt = $conn->prepare("INSERT INTO users (phone, contact_info) VALUES (?, ?)");
                $stmt->bind_param("ss", $phone, $contact);
                $stmt->execute();
                $userId = $conn->insert_id;
            } else {
                $user = $result->fetch_assoc();
                $userId = $user['id'];
            }
            
            // Get user data
            $stmt = $conn->prepare("SELECT * FROM users WHERE id = ?");
            $stmt->bind_param("i", $userId);
            $stmt->execute();
            $user = $stmt->get_result()->fetch_assoc();
            
            $_SESSION['user_id'] = $userId;
            
            echo json_encode([
                'status' => 'success',
                'data' => [
                    'balance' => number_format($user['balance'], 2),
                    'todayEarnings' => number_format($user['today_earnings'], 2),
                    'adsWatched' => $user['ads_watched'],
                    'totalEarned' => number_format($user['total_earned'], 2)
                ]
            ]);
            break;
            
        case 'watchAd':
            if (!isset($_SESSION['user_id'])) {
                echo json_encode(['status' => 'error', 'message' => 'Please login first']);
                exit;
            }
            
            $userId = $_SESSION['user_id'];
            $earnAmount = 0.01;
            
            // Check last ad watch time
            $stmt = $conn->prepare("SELECT last_ad_watch FROM users WHERE id = ?");
            $stmt->bind_param("i", $userId);
            $stmt->execute();
            $result = $stmt->get_result()->fetch_assoc();
            
            if ($result['last_ad_watch'] && time() - strtotime($result['last_ad_watch']) < 60) {
                echo json_encode(['status' => 'error', 'message' => 'Please wait 1 minute between ads']);
                exit;
            }
            
            // Update user balance and stats
            $stmt = $conn->prepare("UPDATE users SET 
                balance = balance + ?,
                total_earned = total_earned + ?,
                today_earnings = today_earnings + ?,
                ads_watched = ads_watched + 1,
                last_ad_watch = CURRENT_TIMESTAMP
                WHERE id = ?");
            $stmt->bind_param("dddi", $earnAmount, $earnAmount, $earnAmount, $userId);
            $stmt->execute();
            
            // Add activity record
            addActivity($conn, $userId, 'ad_watch', $earnAmount);
            
            echo json_encode([
                'status' => 'success',
                'message' => 'Ad watched successfully!',
                'earnedAmount' => $earnAmount
            ]);
            break;
            
        case 'withdraw':
            if (!isset($_SESSION['user_id'])) {
                echo json_encode(['status' => 'error', 'message' => 'Please login first']);
                exit;
            }
            
            $userId = $_SESSION['user_id'];
            $amount = isset($_POST['amount']) ? floatval($_POST['amount']) : 0;
            $evcNumber = isset($_POST['evcNumber']) ? $_POST['evcNumber'] : '';
            
            if ($amount < 5.00) {
                echo json_encode(['status' => 'error', 'message' => 'Minimum withdrawal amount is $5.00']);
                exit;
            }
            
            // Check user balance
            $stmt = $conn->prepare("SELECT balance FROM users WHERE id = ?");
            $stmt->bind_param("i", $userId);
            $stmt->execute();
            $result = $stmt->get_result()->fetch_assoc();
            
            if ($result['balance'] < $amount) {
                echo json_encode(['status' => 'error', 'message' => 'Insufficient balance']);
                exit;
            }
            
            // Create withdrawal request
            $stmt = $conn->prepare("INSERT INTO withdrawals (user_id, amount, evc_number) VALUES (?, ?, ?)");
            $stmt->bind_param("ids", $userId, $amount, $evcNumber);
            $stmt->execute();
            
            // Update user balance
            $stmt = $conn->prepare("UPDATE users SET balance = balance - ? WHERE id = ?");
            $stmt->bind_param("di", $amount, $userId);
            $stmt->execute();
            
            // Add activity record
            addActivity($conn, $userId, 'withdrawal', -$amount);
            
            echo json_encode([
                'status' => 'success',
                'message' => 'Withdrawal request submitted successfully!'
            ]);
            break;
    }
} else if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $action = isset($_GET['action']) ? $_GET['action'] : '';
    
    switch($action) {
        case 'getUserData':
            if (!isset($_SESSION['user_id'])) {
                echo json_encode(['status' => 'error', 'message' => 'Please login first']);
                exit;
            }
            
            $userId = $_SESSION['user_id'];
            $stmt = $conn->prepare("SELECT * FROM users WHERE id = ?");
            $stmt->bind_param("i", $userId);
            $stmt->execute();
            $user = $stmt->get_result()->fetch_assoc();
            
            // Get referral count
            $stmt = $conn->prepare("SELECT COUNT(*) as count FROM referrals WHERE referrer_id = ?");
            $stmt->bind_param("i", $userId);
            $stmt->execute();
            $referralCount = $stmt->get_result()->fetch_assoc()['count'];
            
            echo json_encode([
                'status' => 'success',
                'data' => [
                    'balance' => number_format($user['balance'], 2),
                    'todayEarnings' => number_format($user['today_earnings'], 2),
                    'adsWatched' => $user['ads_watched'],
                    'totalEarned' => number_format($user['total_earned'], 2),
                    'referralCount' => $referralCount
                ]
            ]);
            break;
    }
}
?> 