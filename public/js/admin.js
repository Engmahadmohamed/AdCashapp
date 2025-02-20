// Update navigation paths
function logout() {
    sessionStorage.removeItem('isAdmin');
    window.location.href = "/";  // Use absolute path
}

// Update checkAuth
function checkAuth() {
    const isAdmin = sessionStorage.getItem('isAdmin');
    if (!isAdmin) {
        window.location.href = "/admin";  // Use absolute path
    }
} 