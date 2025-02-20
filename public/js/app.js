function checkAdminAccess() {
    const password = prompt("Enter admin password:");
    if (password === "admin123") {
        window.location.href = "/admin-dashboard";  // Use absolute path
    } else {
        alert("Invalid admin password");
    }
} 