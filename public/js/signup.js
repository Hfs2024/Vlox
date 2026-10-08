import NS from "../nanoscript.min.js";
import config from "/config/shared.js";
import showProfile from "./profile.js";
import {
    sendRequest,
    initQuickInfo,
    initAccessibility,
    lockEvent
} from "./utils.js";

const signUpBtn = NS("#signup-btn");
const signOutBtn = NS("#signout-btn");
const profileBtn = NS("#profile-btn");
const loggedInGroup = NS("#auth-buttons");

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
            if (username.length < config.USERNAME_MIN_LENGTH || username.length > config.USERNAME_MAX_LENGTH) return Swal.showValidationMessage(`Username must be between ${config.USERNAME_MIN_LENGTH} and ${config.USERNAME_MAX_LENGTH} chars!`);
            if (newPassword.length < config.PASSWORD_MIN_LENGTH || newPassword.length > config.PASSWORD_MAX_LENGTH) return Swal.showValidationMessage(`Password must be between ${config.PASSWORD_MIN_LENGTH} and ${config.PASSWORD_MAX_LENGTH} chars!`);
            if (recoveryCode.length !== config.RECOVERY_CODE_LENGTH) return Swal.showValidationMessage(`Recovery code must be exactly ${config.RECOVERY_CODE_LENGTH} chars long!`);

            return { username, newPassword, recoveryCode };
        }
    });

    if (!result.isConfirmed) return;

    // Send request to reset passwords
    const response = await sendRequest({
        url: "/api/v1/reset/password",
        method: "POST",
        body: {
            recoveryCode: result.value.recoveryCode,
            newPassword: result.value.newPassword,
            username: result.value.username
        }
    });

    if (!response.success) return Swal.fire(response.error);
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
            if (username.length < config.USERNAME_MIN_LENGTH || username.length > config.USERNAME_MAX_LENGTH) return Swal.showValidationMessage(`Username must be between ${config.USERNAME_MIN_LENGTH} and ${config.USERNAME_MAX_LENGTH} chars!`);
            if (password.length > config.PASSWORD_MAX_LENGTH) return Swal.showValidationMessage(`Password must be no longer than ${config.PASSWORD_MAX_LENGTH} chars!`);

            return { username, password };
        }
    });

    if (!result.isConfirmed) return;

    // Send request to login
    const response = await sendRequest({
        url: `/api/v1/login`,
        method: "POST",
        body: {
            username: result.value.username,
            password: result.value.password,
        }
    });

    if (!response.success) return Swal.fire(response.error);
    determineAuthButtonsDisplay();
    initQuickInfo();
    Swal.fire("Success", "Successfully logged in!", "success");
}

async function showSignUpModal() {
    const result = await Swal.fire({
        html: `
<h2>Sign Up</h2>
<input type="text" id="username" placeholder="Username">
<input type="password" id="password" placeholder="Password">
<input type="email" id="email" placeholder="Email">
<input type="text" id="bio" placeholder="Bio" autocomplete="off">        
<p class="text-swal-toggle">
    Already have an account? <span class="link-swal-toggle" role="button" tabindex="0">Log in</span>
</p>
        `,
        showCancelButton: true,
        confirmButtonText: 'Submit',
        cancelButtonText: 'Cancel',
        didOpen: () => {
            NS("#bio").attr("maxLength", config.BIO_MAX_LENGTH);
            NS(".link-swal-toggle").on("click", showLoginModal);
            initAccessibility();
        },

        preConfirm: () => {
            const username = NS("#username").value();
            const password = NS("#password").value();
            const email = NS("#email").value();
            const bio = NS("#bio").value();

            if (!username || !password || !email || !bio) return Swal.showValidationMessage("You must enter a username, password, email and bio!");
            if (username.length < config.USERNAME_MIN_LENGTH || username.length > config.USERNAME_MAX_LENGTH) return Swal.showValidationMessage(`Username must be between ${config.USERNAME_MIN_LENGTH} and ${config.USERNAME_MAX_LENGTH} chars!`);
            if (password.length < config.PASSWORD_MIN_LENGTH || password.length > config.PASSWORD_MAX_LENGTH) return Swal.showValidationMessage(`Password must be between ${config.PASSWORD_MIN_LENGTH} and ${config.PASSWORD_MAX_LENGTH} chars!`);
            if (email.length > config.EMAIL_MAX_LENGTH || !/.+\@.+\..+/.test(email)) return Swal.showValidationMessage(`Email must be valid and no longer than ${config.EMAIL_MAX_LENGTH} chars!`);
            if (bio.length < config.BIO_MIN_LENGTH) return Swal.showValidationMessage(`Bio must be at least ${config.BIO_MIN_LENGTH} chars!`);

            return { username, password, email, bio };
        }
    });

    if (!result.isConfirmed) return;

    // Send request to create account
    const response = await sendRequest({
        url: `/api/v1/signup`,
        method: "POST",
        body: {
            username: result.value.username,
            password: result.value.password,
            email: result.value.email,
            bio: result.value.bio
        }
    });

    if (!response.success) return Swal.fire(response.error);
    const recoveryCodes = Array.isArray(response.recoveryCodes) ? response.recoveryCodes : [];
    const blob = new Blob([recoveryCodes.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    NS.createEl("a", document.body, {})
        .attr("href", url)
        .attr("download", "recovery-codes.txt")
        .click()
        .remove();
    URL.revokeObjectURL(url);
    Swal.fire("Success", "Account created successfully!", "success");
    determineAuthButtonsDisplay();
    initQuickInfo();
}

// User status
async function determineAuthButtonsDisplay() {
    const status = await sendRequest({
        url: "/api/v1/get/user-status"
    });

    if (!status.success) return Swal.fire(status.error);

    // Show/hide auth buttons
    if (status.loggedIn) {
        signUpBtn.css("display", "none");
        loggedInGroup.css("display", "");
    } else {
        signUpBtn.css("display", "");
        loggedInGroup.css("display", "none");
    }
}

// Attach the events
signUpBtn.on("click", lockEvent(async function () {
    await showLoginModal();
}));

signOutBtn.on("click", lockEvent(async function () {
    const response = await sendRequest({
        url: "/api/v1/signout",
        method: "DELETE"
    });

    if (!response.success) return Swal.fire(response.error);
    determineAuthButtonsDisplay();
    initQuickInfo();
    Swal.fire("Success", "You have been logged out!", "success");
}));

profileBtn.on("click", lockEvent(async function () {
    await showProfile(window?.quickInfo?._id);
}));

// Init
determineAuthButtonsDisplay();