const signUpBtn = NS("#signup-btn");
const signOutBtn = NS("#signout-btn");
const profileBtn = NS("#profile-btn");
const loggedInGroup = NS("#loggedIn-group");

function showResetPasswordModal() {
    Swal.fire({
        html: `
         <h2>Reset your password</h2>
         <input type="text" id="username" placeholder="Username">
         <input type="text" id="recovery-code" placeholder="Recovery code">
         <div class='center password-input-container'>
            <input type="password" id="password" placeholder="New Password">
            <i class='fas fa-eye password-input-eye' role='button' tabindex='0'></i>
         </div>
        `,
        showCancelButton: true,
        confirmButtonText: "Submit",
        preConfirm: () => {
            const username = Swal.getPopup().querySelector('#username').value;
            const newPassword = Swal.getPopup().querySelector('#password').value;
            const recoveryCode = Swal.getPopup().querySelector('#recovery-code').value;

            if (!username || !newPassword || !recoveryCode) return Swal.showValidationMessage("You must enter a username, password and one of your recovery code!");
            if (username.length < 3 || username.length > 10) return Swal.showValidationMessage("Username must be between 3 and 10 chars!");
            if (newPassword.length < 6 || newPassword.length > 12) return Swal.showValidationMessage("Password must be between 6 and 12 chars!");
            if (recoveryCode.length !== 20) return Swal.showValidationMessage("Recovery code must be exactly 20 chars long!");
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

function showLoginModal() {
    Swal.fire({
        html: `<h2>Login</h2>
            <input type="username" id="username" placeholder="Username" />
            <div class='center password-input-container'>
              <input type="password" id="password" placeholder="Password" />
              <i class='fas fa-eye password-input-eye' role='button' tabindex='0'></i>
            </div>
            <div class='forget-password' onclick='showResetPasswordModal()'>
               <p>Forgot your password?</p>
            </div>
            <div class="swal-toggle-text">
                Need an account? <span class="swal-toggle-link" onclick="showSignUpModal()">Sign up</span>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'Submit',
        cancelButtonText: 'Cancel',
        preConfirm: () => {
            const username = Swal.getPopup().querySelector('#username').value;
            const password = Swal.getPopup().querySelector('#password').value;

            if (!username || !password) return Swal.showValidationMessage("You must enter a username and a password!");
            if (username.length < 3 || username.length > 10) return Swal.showValidationMessage("Username must be between 3 and 10 chars!");
            if (password.length < 6 || password.length > 12) return Swal.showValidationMessage("Password must be between 6 and 12 chars!");
        }
    }).then(async result => {
        if (!result.isConfirmed) return;

        const data = await NS.fetch({
            url: `api/v1/login`,
            method: "POST",
            body: {
                username: NS('#username').getVal()[0],
                password: NS('#password').getVal()[0],
            }
        });

        if (!data.success) return Swal.fire(data.error);
        checkUserStatus();
        getQuickInfo();
        Swal.fire("Success", "Successfully logged in!", "success");
    });

    setUpEyeIcon();
    runAccessibility();
}

function showSignUpModal() {
    Swal.fire({
        html: `<h2>Sign Up</h2>
            <input type="text" id="username" placeholder="Username" />
            <div class='center password-input-container'>
              <input type="password" id="password" placeholder="Password" />
              <i class='fas fa-eye password-input-eye' role='button' tabindex='0'></i>
            </div>
            <input type="email" id="email" placeholder="Email" />
            <input type="text" id="bio" placeholder="Bio (Max 20 chars)" autocomplete="off" />
            <p class="count-text-wrapper">
                Count:
                <span class="count" id="user-bio-content-count">0/20</span>
            </p>           
            <div class="swal-toggle-text">
                Already have an account? <span class="swal-toggle-link" onclick="showLoginModal()">Log in</span>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'Submit',
        cancelButtonText: 'Cancel',
        preConfirm: () => {
            const username = Swal.getPopup().querySelector('#username').value;
            const password = Swal.getPopup().querySelector('#password').value;
            const email = Swal.getPopup().querySelector('#email')?.value;
            const bio = Swal.getPopup().querySelector("#bio")?.value;

            if (!username || !password || !email || !bio) return Swal.showValidationMessage("You must enter a username, password, email and bio!");
            if (username.length < 3 || username.length > 10) return Swal.showValidationMessage("Username must be between 3 and 10 chars!");
            if (password.length < 6 || password.length > 12) return Swal.showValidationMessage("Password must be between 6 and 12 chars!");
            if (email.length > 100 || !/.+\@.+\..+/.test(email)) return Swal.showValidationMessage("Email must valid and less than or equal to 100 chars!");
            if (bio.length < 5) return Swal.showValidationMessage("Bio must be higher or equal to 5 chars!");
        }
    }).then(async result => {
        if (!result.isConfirmed) return;

        const data = await NS.fetch({
            url: `api/v1/signup`,
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
        getQuickInfo();
        const blob = new Blob([data.recoveryCodes.join("\n")], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        NS(NS.createEl("a", document.body, {}))
            .attr("href", url)
            .attr("download", "recovery-codes.txt")
            .click()
            .remove();
        URL.revokeObjectURL(url);
        Swal.fire("Success", "Account created successfully!", "success");        
    });

    NS.liveCounter({
        selector: "#bio",
        counterElement: "#user-bio-content-count",
        showCounter: true,
        max: 20
    });

    setUpEyeIcon();
    runAccessibility();
}

// User status
async function getUserStatus() {
    const status = await NS.fetch({
        url: "api/v1/get/user-status"
    });

    if (!status.success) return Swal.fire(status.error);
    return status;
}

async function checkUserStatus() {
    const status = await getUserStatus();
    if (status.loggedIn) {
        signUpBtn.hide();
        loggedInGroup.show();
    } else {
        signUpBtn.show();
        loggedInGroup.hide();
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
    clearGhostState()
    Swal.fire("Success", "You have been logged out!", "success");
});

profileBtn.on("click", async function () {
    const response = await NS.fetch({
        url: `/api/v1/get/user-profile/${window.currentUserQuickInfo._id}/?skip=0`
    });

    if (!response.success) return Swal.fire(response.error);
    showProfile(response);
});

// Is the user logged in? Then hide the login button
checkUserStatus();