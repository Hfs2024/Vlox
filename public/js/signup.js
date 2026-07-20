const signUpBtn = NS("#signup-btn");
const signOutBtn = NS("#signout-btn");
const profileBtn = NS("#profile-btn");
const loggedInGroup = NS("#loggedIn-group");
const loginForm = `
            <h2>Login</h2>
            <input type="username" id="username" placeholder="Username"></br></br>
            <div class='center password-input-container'>
              <input type="password" class="password-input" id="password" placeholder="Password">
              <i class='fas fa-eye password-input-eye'></i>
            </div>
            <div class='forget-password'>
               <p>Forgot your password?</p>
            </div>
            <div class="swal-toggle-text">
                Need an account? <span class="swal-toggle-link" onclick="showSignUpModal()">Sign up</span>
            </div>
        `;
const signupForm = `
            <h2>Sign Up</h2>
            <input type="text" id="username" placeholder="Username"></br></br>
            <div class='center password-input-container'>
              <input type="password" class="password-input" id="password" placeholder="Password">
              <i class='fas fa-eye password-input-eye'></i>
            </div></br>
            <input type="email" id="email" placeholder="Email"></br></br>
            <input type="text" id="bio" placeholder="Bio (Max 20 chars)" autocomplete="off">
            <p class="count-text-wrapper">
                Count:
                <span class="count" id="user-bio-content-count">0/20</span>
            </p>           
            <div class="swal-toggle-text">
                Already have an account? <span class="swal-toggle-link" onclick="showLoginModal()">Log in</span>
            </div>
        `;

function setUpEyeIcon() {
    NS(".password-input-eye").on("click", function () {
        const currentType = NS(".password-input").attr("type");
        const newType = currentType === "password" ? "text" : "password";
        if (currentType === "password") NS(".password-input-eye").replaceClass("fa-eye", "fa-eye-slash");
        else NS(".password-input-eye").replaceClass("fa-eye-slash", "fa-eye");
        NS(".password-input").attr("type", newType);
    });
}

function showResetPasswordModal() {
    Swal.fire({
        html: `
         <h2>Reset your password</h2>
         <input type="text" id="username" placeholder="Username"></br></br>
         <input type="text" id="recovery-code" placeholder="Recovery code"></br></br>
         <div class='center password-input-container'>
            <input type="password" class="password-input" id="new-password" placeholder="New Password">
            <i class='fas fa-eye password-input-eye'></i>
        </div></br>
        `,
        showCancelButton: true,
        confirmButtonText: "Submit",
        preConfirm: () => {
            const username = Swal.getPopup().querySelector('#username').value;
            const newPassword = Swal.getPopup().querySelector('#new-password').value;
            const recoveryCode = Swal.getPopup().querySelector('#recovery-code').value;

            if (!username || !newPassword || !recoveryCode) return Swal.showValidationMessage("You must enter a username, password and one of your recovery code!")
        }
    }).then(async result => {
        if (!result.isConfirmed) return;
        const resetData = await NS.fetch({
            url: "/api/v1/reset/password",
            method: "POST",
            body: {
                recoveryCode: NS("#recovery-code").getVal()[0],
                newPassword: NS("#new-password").getVal()[0],
                username: NS("#username").getVal()[0]
            }
        });

        if (!resetData.success) return Swal.fire(resetData.error);
        Swal.fire("Success", "Password reseted! You can now login", "success");
    });

    setUpEyeIcon();
}

function showModal({
    html,
    type = "login",
    onSuccess,
}) {
    Swal.fire({
        html: html,
        showCancelButton: true,
        confirmButtonText: 'Submit',
        cancelButtonText: 'Cancel',
        focusConfirm: false,
        preConfirm: () => {
            const username = Swal.getPopup().querySelector('#username').value;
            const password = Swal.getPopup().querySelector('#password').value;
            const email = Swal.getPopup().querySelector('#email')?.value;
            const bio = Swal.getPopup().querySelector("#bio")?.value;

            if (type === "signup" && (!username || !password || !email || !bio)) return Swal.showValidationMessage(`Please enter username, email, bio and password`);
            if (type === "signup" && !/.+\@.+\..+/.test(email)) return Swal.showValidationMessage("Invalid email!");
            if (type === "login" && (!username || !password)) return Swal.showValidationMessage(`Please enter both username and password`);
        }
    }).then(async result => {
        if (!result.isConfirmed) return;

        const data = await NS.fetch({
            url: `api/v1/${type}`,
            method: "POST",
            body: {
                username: NS('#username').getVal()[0],
                password: NS('#password').getVal()[0],
                email: NS('#email').getVal()[0],
                bio: NS('#bio').getVal()[0]
            }
        });

        if (!data.success) return Swal.fire(data.error);
        checkUserStatus();
        if (typeof onSuccess === "function") onSuccess(data);
        getQuickInfo();
    });

    // Password eye icon event
    setUpEyeIcon();
}

function showLoginModal() {
    showModal({
        html: loginForm,
        type: "login",
        onSuccess: () => {
            Swal.fire({
                icon: "success",
                title: "Success",
                text: "Logged in successfully!"
            });
        }
    });

    NS(".forget-password").on("click", function () {
        showResetPasswordModal();
    });
}

function showSignUpModal() {
    showModal({
        html: signupForm,
        type: "signup",
        onSuccess: data => {
            Swal.fire({
                icon: "success",
                title: "Success",
                text: "Account created successfully!"
            });

            const link = document.createElement("a");
            const blob = new Blob([data.recoveryCodes.join("\n")], { type: "text/plain" });
            const url = URL.createObjectURL(blob);
            document.body.appendChild(link);
            link.href = url;
            link.download = "recovery-codes.txt";
            link.click();
            link.remove();
            URL.revokeObjectURL(url);
        }
    });

    // Init live counter
    NS.liveCounter({
        element: "#bio",
        counterElement: "#user-bio-content-count",
        showCounter: true,
        max: 20,
        visualFeedback: [
            { value: 10, class: "count-orange", addTo: ["#bio"] },
            { value: 17, class: "count-red", addTo: ["#bio"] },
        ],
        onLimit: () => { }
    });
}

// User status
async function getUserStatus() {
    const status = await NS.fetch({
        url: "api/get/user-status"
    });

    if (!status.success) return Swal.fire("Failed to read your current status: " + status.error);
    return status;
}

async function checkUserStatus() {
    const status = await getUserStatus();
    if (status.loggedIn) {
        signUpBtn.hide();
        loggedInGroup.show();
        cardGeneratorBtn.show();
    } else {
        signUpBtn.show();
        loggedInGroup.hide();
        cardGeneratorBtn.hide();
    }
}

// Attach the events
signUpBtn.on("click", function () {
    showLoginModal();
});

signOutBtn.on("click", async function () {
    const data = await NS.fetch({
        url: "api/v1/signout",
        method: "DELETE"
    });

    if (!data.success) return Swal.fire(data.error);
    checkUserStatus();
    getQuickInfo();
    Swal.fire("Success", "You have been logged out!", "success");
});

profileBtn.on("click", async function () {
    const response = await NS.fetch({
        url: "api/get/user-profile"
    });

    if (!response.success) return Swal.fire(response.error);

    showProfile(response);
});

// Is the user logged in? Then hide the login button
checkUserStatus();