document.addEventListener("DOMContentLoaded", function () {

    // ==============================
    // FIREBASE AUTH
    // ==============================

    // Dùng auth đã được khai báo trong firebase_config.js
    // Nếu config chưa khởi tạo Firebase thì khởi tạo ở đây
    if (typeof firebase !== "undefined" && !firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }

    const auth = firebase.auth();

    const loginForm = document.getElementById("login-form");
    const signupForm = document.getElementById("signup-form");

    const loginBtn = document.getElementById("loginbtn");
    const signupBtn = document.getElementById("signupbtn");
    const googleBtn = document.getElementById("googlebtn");

    const message = document.getElementById("auth-message");

    function showMessage(text, success = false) {
        if (message) {
            message.textContent = text;
            message.style.color = success ? "#8bd0a8" : "#d1a3a3";
        } else {
            alert(text);
        }
    }


    // ==============================
    // 1. SIGN UP
    // ==============================

    if (signupForm) {
        signupForm.addEventListener("submit", function (event) {
            event.preventDefault();

            const email = document.getElementById("email").value.trim();
            const password = document.getElementById("password").value;
            const confirmPassword =
                document.getElementById("confirm-password")?.value;

            if (confirmPassword !== undefined &&
                password !== confirmPassword) {

                showMessage("Passwords do not match!");
                return;
            }

            auth.createUserWithEmailAndPassword(email, password)

                .then((userCredential) => {

                    const user = userCredential.user;

                    showMessage("Account created successfully!", true);

                    console.log("User:", user);

                    setTimeout(() => {
                        window.location.href = "home.html";
                    }, 700);

                })

                .catch((error) => {

                    showMessage(error.message);

                    console.error(error);

                });
        });
    }


    // ==============================
    // 2. LOGIN EMAIL/PASSWORD
    // ==============================

    if (loginForm) {
        loginForm.addEventListener("submit", function (event) {
            event.preventDefault();

            const email = document.getElementById("email").value.trim();
            const password = document.getElementById("password").value;

            auth.signInWithEmailAndPassword(email, password)

                .then((userCredential) => {

                    const user = userCredential.user;

                    showMessage("Login successful!", true);

                    console.log("User:", user);

                    setTimeout(() => {
                        window.location.href = "home.html";
                    }, 500);

                })

                .catch((error) => {

                    showMessage(error.message);

                    console.error(error);

                });
        });
    }


    // ==============================
    // 3. LOGIN GOOGLE
    // ==============================

    if (googleBtn) {
        googleBtn.addEventListener("click", function () {

            const provider = new firebase.auth.GoogleAuthProvider();

            auth.signInWithPopup(provider)

                .then((result) => {

                    const user = result.user;

                    console.log("Google user:", user);

                    showMessage("Google login successful!", true);

                    setTimeout(() => {
                        window.location.href = "/aquarium.html";
                    }, 500);

                })

                .catch((error) => {

                    console.error(error);

                    showMessage(error.message);

                });
        });
    }


    // ==============================
    // 4. AUTH STATE
    // ==============================

    auth.onAuthStateChanged(function (user) {

        const userInfo = document.getElementById("userInfo");
        const userEmail = document.getElementById("userEmail");
        const userUID = document.getElementById("userUID");
        const userProvider = document.getElementById("userProvider");

        if (user) {

            console.log("Logged in:", user);

            // Chỉ hiển thị nếu trang có User Info
            if (userInfo) {
                userInfo.style.display = "block";
            }

            if (userEmail) {
                userEmail.textContent = user.email || "Unknown";
            }

            if (userUID) {
                userUID.textContent = user.uid;
            }

            if (userProvider && user.providerData.length > 0) {
                userProvider.textContent =
                    user.providerData[0].providerId;
            }

        } else {

            console.log("Not logged in");

            if (userInfo) {
                userInfo.style.display = "none";
            }
        }
    });


    // ==============================
    // 5. SIGN OUT
    // ==============================

    const logoutBtn = document.getElementById("logoutBtn");

    if (logoutBtn) {
        logoutBtn.addEventListener("click", function () {

            auth.signOut()

                .then(() => {

                    alert("Logged out successfully!");

                    window.location.href = "/login.html";

                })

                .catch((error) => {

                    console.error(error);

                    alert(error.message);

                });
        });
    }

});
