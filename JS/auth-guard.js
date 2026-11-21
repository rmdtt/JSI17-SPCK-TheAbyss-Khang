document.addEventListener("DOMContentLoaded", () => {
    if (typeof firebase === "undefined" || !firebase.auth) {
        console.error("Firebase Authentication chưa được tải!");
        return;
    }

    const auth = firebase.auth();

    const navAuth = document.getElementById("nav-auth");
    const navUser = document.getElementById("nav-user");
    const navEmail = document.getElementById("nav-user-email");
    const logoutBtn = document.getElementById("logout-btn");

    // Cập nhật Navbar theo trạng thái đăng nhập
    auth.onAuthStateChanged((user) => {
        if (user) {
            if (navAuth) navAuth.style.display = "none";
            if (navUser) navUser.style.display = "flex";

            if (navEmail) {
                navEmail.textContent =
                    user.displayName || user.email || "Explorer";
            }
        } else {
            if (navAuth) navAuth.style.display = "flex";
            if (navUser) navUser.style.display = "none";
        }
    });

    // Đăng xuất
    if (logoutBtn) {
        logoutBtn.addEventListener("click", async () => {
            try {
                await auth.signOut();
                window.location.href = "home.html";
            } catch (error) {
                console.error("Logout error:", error);
            }
        });
    }
});

// Chặn khách truy cập Aquarium và Add Creature
function checkAuthNavigation(event, destination) {
    event.preventDefault();

    if (typeof firebase === "undefined" || !firebase.auth) {
        console.error("Firebase chưa được khởi tạo!");
        return false;
    }

    const user = firebase.auth().currentUser;

    if (user) {
        window.location.href = destination;
    } else {
        alert("Please login or create an account to use this feature!");
        window.location.href = "login.html";
    }

    return false;
}