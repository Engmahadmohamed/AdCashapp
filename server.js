const express = require('express');
const mysql = require('mysql2');
const crypto = require('crypto');
const path = require('path');
const app = express();

// Database connection
const connection = mysql.createConnection({
    host: 'localhost',
    user: 'your_username',
    password: 'your_password',
    database: 'task_manager'
});

app.use(express.json());
app.use(express.static('public'));

// Serve admin files
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin-login.html'));
});

app.get('/admin-dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Get all tasks
app.get('/api/tasks', (req, res) => {
    connection.query('SELECT * FROM tasks', (error, results) => {
        if (error) {
            res.status(500).json({ error: 'Database error' });
            return;
        }
        res.json(results);
    });
});

// Add a new task
app.post('/api/tasks', (req, res) => {
    const { text } = req.body;
    connection.query('INSERT INTO tasks (text) VALUES (?)', [text], (error) => {
        if (error) {
            res.status(500).json({ error: 'Database error' });
            return;
        }
        res.status(201).json({ message: 'Task created' });
    });
});

// Delete a task
app.delete('/api/tasks/:id', (req, res) => {
    const { id } = req.params;
    connection.query('DELETE FROM tasks WHERE id = ?', [id], (error) => {
        if (error) {
            res.status(500).json({ error: 'Database error' });
            return;
        }
        res.json({ message: 'Task deleted' });
    });
});

// Admin authentication middleware
const authenticateAdmin = async (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: 'No token provided' });
    }

    connection.query(
        'SELECT admin_id FROM admin_sessions WHERE session_token = ? AND expires_at > NOW()',
        [token],
        (error, results) => {
            if (error || results.length === 0) {
                return res.status(401).json({ error: 'Invalid or expired token' });
            }
            req.adminId = results[0].admin_id;
            next();
        }
    );
};

// Admin login
app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body;
    
    // For demonstration, using simple password comparison
    // In production, use bcrypt or another hashing algorithm
    if (username === 'admin' && password === 'admin123') {
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

        connection.query(
            'INSERT INTO admin_sessions (admin_id, session_token, expires_at) VALUES (?, ?, ?)',
            [1, token, expiresAt], // Using admin_id = 1 for the default admin
            (error) => {
                if (error) {
                    return res.status(500).json({ error: 'Database error' });
                }
                res.json({ token });
            }
        );
    } else {
        res.status(401).json({ error: 'Invalid credentials' });
    }
});

// Get all users (admin only)
app.get('/api/admin/users', authenticateAdmin, (req, res) => {
    connection.query(
        'SELECT * FROM users ORDER BY created_at DESC',
        (error, results) => {
            if (error) {
                return res.status(500).json({ error: 'Database error' });
            }
            res.json(results);
        }
    );
});

// Get withdrawal requests (admin only)
app.get('/api/admin/withdrawals', authenticateAdmin, (req, res) => {
    connection.query(
        'SELECT w.*, u.phone FROM withdrawals w JOIN users u ON w.user_id = u.id WHERE w.status = "pending" ORDER BY w.created_at DESC',
        (error, results) => {
            if (error) {
                return res.status(500).json({ error: 'Database error' });
            }
            res.json(results);
        }
    );
});

// Process withdrawal (admin only)
app.post('/api/admin/withdrawals/:id/process', authenticateAdmin, (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    
    connection.query(
        'UPDATE withdrawals SET status = ? WHERE id = ?',
        [status, id],
        (error) => {
            if (error) {
                return res.status(500).json({ error: 'Database error' });
            }
            
            // Log admin activity
            connection.query(
                'INSERT INTO admin_activity_log (admin_id, action_type, details) VALUES (?, ?, ?)',
                [req.adminId, 'process_withdrawal', `Processed withdrawal #${id} with status: ${status}`]
            );
            
            res.json({ message: 'Withdrawal processed successfully' });
        }
    );
});

// Get admin statistics
app.get('/api/admin/stats', authenticateAdmin, (req, res) => {
    const queries = {
        totalUsers: 'SELECT COUNT(*) as count FROM users',
        totalWithdrawals: 'SELECT COUNT(*) as count, SUM(amount) as total FROM withdrawals WHERE status = "completed"',
        todaySignups: 'SELECT COUNT(*) as count FROM users WHERE DATE(created_at) = CURDATE()',
        pendingWithdrawals: 'SELECT COUNT(*) as count FROM withdrawals WHERE status = "pending"'
    };

    const stats = {};
    let completed = 0;

    for (const [key, query] of Object.entries(queries)) {
        connection.query(query, (error, results) => {
            if (error) {
                return res.status(500).json({ error: 'Database error' });
            }
            stats[key] = results[0];
            completed++;

            if (completed === Object.keys(queries).length) {
                res.json(stats);
            }
        });
    }
});

// Admin logout
app.post('/api/admin/logout', authenticateAdmin, (req, res) => {
    connection.query(
        'DELETE FROM admin_sessions WHERE admin_id = ?',
        [req.adminId],
        (error) => {
            if (error) {
                return res.status(500).json({ error: 'Database error' });
            }
            res.json({ message: 'Logged out successfully' });
        }
    );
});

// Search users
app.get('/api/admin/users/search', authenticateAdmin, (req, res) => {
    const searchTerm = req.query.term;
    const query = `
        SELECT * FROM users 
        WHERE phone LIKE ? OR contact_info LIKE ?
        ORDER BY created_at DESC
    `;
    const searchPattern = `%${searchTerm}%`;
    
    connection.query(query, [searchPattern, searchPattern], (error, results) => {
        if (error) {
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(results);
    });
});

// Get specific user details
app.get('/api/admin/users/:id', authenticateAdmin, (req, res) => {
    const userId = req.params.id;
    const query = `
        SELECT 
            u.*,
            COUNT(r.id) as referral_count,
            GROUP_CONCAT(DISTINCT r.referred_id) as referred_users,
            (SELECT COUNT(*) FROM withdrawals WHERE user_id = u.id) as withdrawal_count
        FROM users u
        LEFT JOIN referrals r ON r.referrer_id = u.id
        WHERE u.id = ?
        GROUP BY u.id
    `;
    
    connection.query(query, [userId], (error, results) => {
        if (error) {
            return res.status(500).json({ error: 'Database error' });
        }
        if (results.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(results[0]);
    });
});

// Update user balance
app.put('/api/admin/users/:id/balance', authenticateAdmin, (req, res) => {
    const userId = req.params.id;
    const { balance } = req.body;
    
    connection.query(
        'UPDATE users SET balance = ? WHERE id = ?',
        [balance, userId],
        (error) => {
            if (error) {
                return res.status(500).json({ error: 'Database error' });
            }
            
            // Log admin activity
            connection.query(
                'INSERT INTO admin_activity_log (admin_id, action_type, details) VALUES (?, ?, ?)',
                [req.adminId, 'update_balance', `Updated balance for user #${userId} to $${balance}`]
            );
            
            res.json({ message: 'Balance updated successfully' });
        }
    );
});

// Get dashboard stats
app.get('/api/admin/dashboard/stats', authenticateAdmin, (req, res) => {
    const queries = {
        totalUsers: 'SELECT COUNT(*) as count FROM users',
        newUsers: 'SELECT COUNT(*) as count FROM users WHERE DATE(created_at) = CURDATE()',
        totalWithdrawn: 'SELECT SUM(amount) as total FROM withdrawals WHERE status = "completed"',
        pendingWithdrawals: 'SELECT COUNT(*) as count FROM withdrawals WHERE status = "pending"',
        totalAdsWatched: 'SELECT SUM(ads_watched) as total FROM users',
        todayAdsWatched: 'SELECT SUM(ads_watched) as total FROM users WHERE DATE(last_ad_watch) = CURDATE()'
    };

    Promise.all(Object.values(queries).map(query => {
        return new Promise((resolve, reject) => {
            connection.query(query, (error, results) => {
                if (error) reject(error);
                resolve(results[0]);
            });
        });
    }))
    .then(results => {
        const stats = {};
        Object.keys(queries).forEach((key, index) => {
            stats[key] = results[index];
        });
        res.json(stats);
    })
    .catch(error => {
        res.status(500).json({ error: 'Database error' });
    });
});

// Get recent activity
app.get('/api/admin/activity', authenticateAdmin, (req, res) => {
    const query = `
        SELECT 
            'withdrawal' as type,
            w.amount,
            w.status,
            w.created_at,
            u.phone as user
        FROM withdrawals w
        JOIN users u ON w.user_id = u.id
        UNION ALL
        SELECT 
            'ad_watch' as type,
            NULL as amount,
            NULL as status,
            last_ad_watch as created_at,
            phone as user
        FROM users
        WHERE last_ad_watch IS NOT NULL
        ORDER BY created_at DESC
        LIMIT 10
    `;

    connection.query(query, (error, results) => {
        if (error) {
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(results);
    });
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
}); 