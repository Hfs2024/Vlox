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

// Show profile
async function showProfile(data) {
    // Profile code
    let postsSkip = 0;
    const username = capitalizeFirstLtter(data.username);
    const isUsernameMatch = window.currentUserQuickInfo.username === data.username;
    const pinnedPosts = await NS.fetch({
        url: "/api/get/user-pinned-posts",
        method: "POST",
        body: { ids: data.pinnedPosts }
    });

    if (!pinnedPosts.success) return Swal.fire(pinnedPosts.error);

    Swal.fire({
        title: `${isUsernameMatch ? `Welcome, ${data.emoji || "🏇🏻"} ${username}!` : `${data.emoji || "🏇🏻"} ${username}'s profile`}`,
        html: `
          ${isUsernameMatch ? `<div class='center'>
            <div class='emoji-container-item'>🚀</div>
            <div class='emoji-container-item'>👦🏻</div>
            <div class='emoji-container-item'>👧🏻</div>
            <div class='emoji-container-item'>🏇🏻</div>
          </div>
          <h2 class='user-profile-bio'>${data.bio ? capitalizeFirstLtter(data.bio) : "No bio found"}</h2>
          <button id='reset-password-recovery-codes'>Reset Password Recovery Codes</button></br></br>
          <hr>
          ` : `<hr><h2 class='user-profile-bio'>${data.bio ? capitalizeFirstLtter(data.bio) : "No bio found"}</h2>`
            }
          
          <div class='taskbar'>
            <button class='taskbar-button taskbar-button-chosen'>All</button>
            <button class='taskbar-button'>Pinned</button>
          </div>

          <h2>${isUsernameMatch ? "Your posts" : `${username}'s posts`}: </h2>

          <div class='taskbar-panel taskbar-panel-chosen'>
            <div id='user-posts-container'></div>
            <div class='group'>
              <button id='user-posts-prev-btn'> 
                <i class='fas fa-caret-left'></i>
              </button>
              <button id='user-posts-next-btn'>
                <i class='fas fa-caret-right'></i>
              </button>
            </div>
          </div>
          
          <div class='taskbar-panel'>
            <div id='user-pinned-posts-container'></div>
          </div>
        `,
        confirmButtonText: "Close"
    });

    const renderPosts = () => {
        NS("#user-posts-container").html("") // Clear the container

        if (!data.posts || data.posts.length === 0) {
            const noPostFound = NS.createEl("h2", NS("#user-posts-container"), {
                className: "nothing-found",
                style: "text-align: center"
            });
            noPostFound.textContent = "No posts yet.";
            return;
        }

        data.posts.forEach(post => {
            renderProfilePost({
                post: post,
                pinnedPosts: data.pinnedPosts,
                isUsernameMatch: isUsernameMatch,
                container: "#user-posts-container"
            });
        });
    }

    const renderPinnedPosts = () => {
        // Pinned
        if (!data.pinnedPosts || data.pinnedPosts.length === 0) {
            const noPinnedPostFound = NS.createEl("h2", NS("#user-pinned-posts-container"), {
                className: "nothing-found",
                style: "text-align: center"
            });
            noPinnedPostFound.textContent = "No pinned posts yet.";
            return;
        }

        data.pinnedPosts.forEach((post, index) => {
            renderProfilePost({
                post: pinnedPosts.foundPinnedPosts[index],
                pinnedPosts: data.pinnedPosts,
                isUsernameMatch: isUsernameMatch,
                container: "#user-pinned-posts-container"
            });
        });
    }

    NS("#reset-password-recovery-codes").on("click", async function () {
        const newCodesResponse = await NS.fetch({
            url: "/api/v1/reset/password/recovery-codes",
            method: "POST"
        });

        if (!newCodesResponse.success) return Swal.fire(newCodesResponse.error);
        const link = document.createElement("a");
        const blob = new Blob([newCodesResponse.codes.join("\n")], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        document.body.appendChild(link);
        link.href = url;
        link.download = "recovery-codes.txt";
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
        Swal.fire("Sucesss", "Password Recovery Codes Reseted!", "success");
    });

    NS(".user-profile-bio").on("click", function () {
        Swal.fire({
            title: "Enter new bio: ",
            input: "text",
            inputPlaceholder: "Enter new bio...",
            showCancelButton: true,
            preConfirm: result => {
                if (!result) return Swal.showValidationMessage("You must enter a new bio!");
                if (result.length > 20) return Swal.showValidationMessage("Bio must be less than 20 chars!");
            }
        }).then(async result => {
            if (result.value && result.isConfirmed) {
                const updateBioResponse = await NS.fetch({
                    url: "/api/v1/update/user-bio",
                    method: "PUT",
                    body: { newBio: result.value }
                });

                if (!updateBioResponse.success) return Swal.fire(updateBioResponse.error);
                Swal.fire("Success", "Bio updated!", "success");
                getQuickInfo();
            }
        });
    });

    NS(".emoji-container-item").each(emoji => {
        emoji = NS(emoji);
        emoji.on("click", function () {
            const updateEmojidata = NS.fetch({
                url: "/api/v1/update/emoji",
                method: "PUT",
                body: { emoji: emoji.getText()[0] }
            });

            if (!updateEmojidata) return Swal.fire(updateEmojidata.error);
            return Swal.fire({
                icon: "success",
                title: "Success",
                text: "Emoji successfully changed!"
            });
        });
    });

    NS("#user-posts-prev-btn").on("click", async function () {
        if (postsSkip <= 0) return;
        postsSkip -= 10;

        data = await NS.fetch({
            url: `/api/get/${isUsernameMatch ? "user-profile" : `user-profile/${data.username}`}/?skip=${postsSkip}`
        });

        renderPosts();
    });

    NS("#user-posts-next-btn").on("click", async function () {
        if (NS("#user-posts-container").get(".nothing-found")[0]) return;
        postsSkip += 10;

        data = await NS.fetch({
            url: `/api/get/${isUsernameMatch ? "user-profile" : `user-profile/${data.username}`}/?skip=${postsSkip}`
        });

        renderPosts();
    });

    renderPosts();
    renderPinnedPosts();
    setUpTaskbar();
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