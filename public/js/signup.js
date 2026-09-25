import NS from "../nanoscript.min.js";
import { sendRequest, getQuickInfo, initAccessibility, initLiveCounter, lockEvent } from "./helpers.js";
import { showProfile } from "./profile.js";

const signUpBtn = NS("#signup-btn");
const signOutBtn = NS("#signout-btn");
const profileBtn = NS("#profile-btn");
const loggedInGroup = NS("#loggedIn-group");

async function showResetPasswordModal() {
    const result = await Swal.fire({
        html: `
<h2>Reset your password</h2>
<input type="text" id="username" placeholder="Username">
<input type="password" id="recovery-code" placeholder="Recovery code">
<input type="password" id="password" placeholder="New password">
        `,
        showCancelButton: true,
        confirmButtonText: "Submit",
        preConfirm: () => {
            const username = NS("#username").value();
            const newPassword = NS("#password").value();
            const recoveryCode = NS("#recovery-code").value();

            if (!username || !newPassword || !recoveryCode) return Swal.showValidationMessage("You must enter a username, password and one of your recovery code!");
            if (username.length < 3 || username.length > 10) return Swal.showValidationMessage("Username must be between 3 and 10 chars!");
            if (newPassword.length < 12 || newPassword.length > 64) return Swal.showValidationMessage("Password must be between 12 and 64 chars!");
            if (recoveryCode.length !== 20) return Swal.showValidationMessage("Recovery code must be exactly 20 chars long!");

            return { username, newPassword, recoveryCode };
        }
    });

    if (!result.isConfirmed) return;
    const resetData = await sendRequest({
        url: "/api/v1/reset/password",
        method: "POST",
        body: {
            recoveryCode: result.value.recoveryCode,
            newPassword: result.value.newPassword,
            username: result.value.username
        }
    });

    if (!resetData.success) return Swal.fire(resetData.error);
    Swal.fire("Success", "Password reseted! You can now login", "success");
}

async function showLoginModal() {
    const result = await Swal.fire({
        html: `
<h2>Login</h2>
<input type="text" id="username" placeholder="Username">
<input type="password" id="password" placeholder="Password">
<p class="text-forget-password" role="button" tabindex="0">
  Forgot your password?
</p>
<p class="text-swal-toggle">
    Need an account? <span class="link-swal-toggle" role="button" tabindex="0">Sign up</span>
</p>
        `,
        showCancelButton: true,
        confirmButtonText: 'Submit',
        cancelButtonText: 'Cancel',
        didOpen: () => {
            initAccessibility();
            NS(".text-forget-password").on("click", showResetPasswordModal);
            NS(".link-swal-toggle").on("click", showSignUpModal);
        },
        preConfirm: () => {
            const username = NS("#username").value();
            const password = NS("#password").value();

            if (!username || !password) return Swal.showValidationMessage("You must enter a username and a password!");
            if (username.length < 3 || username.length > 10) return Swal.showValidationMessage("Username must be between 3 and 10 chars!");
            if (password.length > 64) return Swal.showValidationMessage("Password must be between 12 and 64 chars!");

            return { username, password };
        }
    });

    if (!result.isConfirmed) return;
    const data = await sendRequest({
        url: `/api/v1/login`,
        method: "POST",
        body: {
            username: result.value.username,
            password: result.value.password,
        }
    });

    if (!data.success) return Swal.fire(data.error);
    checkUserStatus();
    getQuickInfo();
    Swal.fire("Success", "Successfully logged in!", "success");
}

async function showSignUpModal() {
    const result = await Swal.fire({
        html: `
<h2>Sign Up</h2>
<input type="text" id="username" placeholder="Username">
<input type="password" id="password" placeholder="Password">
<input type="email" id="email" placeholder="Email">
<input type="text" id="bio" placeholder="Bio (Max 20 chars)" maxlength="20" autocomplete="off">
<p class="text-count">
  Count: <span class="count" id="user-bio-content-count">0</span>
</p>           
<p class="text-swal-toggle">
    Already have an account? <span class="link-swal-toggle" role="button" tabindex="0">Log in</span>
</p>
        `,
        showCancelButton: true,
        confirmButtonText: 'Submit',
        cancelButtonText: 'Cancel',
        didOpen: () => {
            initLiveCounter("#bio", "#user-bio-content-count", 20);
            NS(".link-swal-toggle").on("click", showLoginModal);
            initAccessibility();
        },

        preConfirm: () => {
            const username = NS("#username").value();
            const password = NS("#password").value();
            const email = NS("#email").value();
            const bio = NS("#bio").value();

            if (!username || !password || !email || !bio) return Swal.showValidationMessage("You must enter a username, password, email and bio!");
            if (username.length < 3 || username.length > 10) return Swal.showValidationMessage("Username must be between 3 and 10 chars!");
            if (password.length < 12 || password.length > 64) return Swal.showValidationMessage("Password must be between 12 and 64 chars!");
            if (email.length > 100 || !/.+\@.+\..+/.test(email)) return Swal.showValidationMessage("Email must valid and less than or equal to 100 chars!");
            if (bio.length < 5) return Swal.showValidationMessage("Bio must be higher or equal to 5 chars!");

            return { username, password, email, bio };
        }
    });

    if (!result.isConfirmed) return;
    const data = await sendRequest({
        url: `/api/v1/signup`,
        method: "POST",
        body: {
            username: result.value.username,
            password: result.value.password,
            email: result.value.email,
            bio: result.value.bio
        }
    });

    if (!data.success) return Swal.fire(data.error);
    const recoveryCodes = Array.isArray(data.recoveryCodes) ? data.recoveryCodes : [];
    const blob = new Blob([recoveryCodes.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    NS.createEl("a", document.body, {})
        .attr("href", url)
        .attr("download", "recovery-codes.txt")
        .click()
        .remove();
    URL.revokeObjectURL(url);
    Swal.fire("Success", "Account created successfully!", "success");
    checkUserStatus();
    getQuickInfo();
}

// User status
async function getUserStatus() {
    const status = await sendRequest({
        url: "/api/v1/get/user-status"
    });

    if (!status.success) return Swal.fire(status.error);
    return status;
}

async function checkUserStatus() {
    const status = await getUserStatus();
    if (status && status.loggedIn) {
        signUpBtn.css("display", "none");
        loggedInGroup.css("display", "");
    } else {
        signUpBtn.css("display", "");
        loggedInGroup.css("display", "none");
    }
}

// Attach the events
signUpBtn.on("click", function () {
    showLoginModal();
});

signOutBtn.on("click", lockEvent(async function () {
    const response = await sendRequest({
        url: "/api/v1/signout",
        method: "DELETE"
    });

    if (!response.success) return Swal.fire(response.error);
    checkUserStatus();
    getQuickInfo();
    Swal.fire("Success", "You have been logged out!", "success");
}));

profileBtn.on("click", lockEvent(async function () {
    const response = await sendRequest({
        url: `/api/v1/get/user-profile/${window?.quickInfo?._id}`
    });

    if (!response.success) return Swal.fire(response.error);
    showProfile(response);
}));

// Is the user logged in? Then hide the login button
checkUserStatus();