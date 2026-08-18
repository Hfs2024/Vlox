async function showProfile(data) {
    // Profile code
    let postsSkip = 0;
    const username = capitalizeFirstLetter(data.username);
    const isUsernameMatch = window.currentUserQuickInfo.username === data.username;

    Swal.fire({
        titleText: `${isUsernameMatch ? `Hey, ${data.emoji || "🚀"} ${username}!` : `${data.emoji || "🚀"} ${username}'s profile`}`,
        html: `
          <hr>
          <div class='card'>
            <div class='space-between'>
              <p class='text-overflow'><b>Bio:</b> <span id='user-profile-bio'></span></p>
              ${isUsernameMatch ? "<i class='fas fa-pen-to-square helper-icon' id='user-profile-bio-edit' role='button' tabindex='0'></i>" : ""}
            </div>
            <div class='space-between'>
              <p class='text-overflow'><b>Email:</b> <span>${data.email}</span></p>
              ${isUsernameMatch ? "<i class='fas fa-pen-to-square helper-icon' id='user-profile-email-edit' role='button' tabindex='0'></i>" : ""}
            </div>
            <div class='space-between'>  
              <p class='text-overflow'><b>Visibility:</b> <span>${data.private ? "Private" : "Public"}</span></p>
              ${isUsernameMatch ? `<i class='fas fa-${data.private ? "eye" : "eye-slash"} helper-icon' id='user-profile-visibility-toggle' role='button' tabindex='0'></i>` : ""}
            </div>
            ${isUsernameMatch ? `
            <div class='center'>
              <div class='emoji-container-item'>🚀</div>
              <div class='emoji-container-item'>👦🏻</div>
              <div class='emoji-container-item'>👧🏻</div>
              <div class='emoji-container-item'>🏇🏻</div>
            </div>
            <div class='center'` : ""}
          </div>

          <div class='taskbar'>
            <button class='taskbar-button on-bg-color'>All</button>
            <button class='taskbar-button'>Pinned</button>
          </div><br>

          <div class='taskbar-panel taskbar-panel-chosen'>
            <div id='user-posts-container' class='scroll-container'></div>
            <div class='center'>
              <button id='user-posts-prev-btn'> 
                <i class='fas fa-caret-left'></i>
              </button>
              <button id='user-posts-next-btn'>
                <i class='fas fa-caret-right'></i>
              </button>
            </div>
          </div>
          
          <div class='taskbar-panel'>
            <div id='user-pinned-posts-container' class='scroll-container'></div>
          </div>
        `,
        confirmButtonText: "Close"
    });

    const container = NS("#user-posts-container");
    const renderPosts = () => {
        container.html(""); // Clear the container

        if (!data.posts || data.posts.length === 0) {
            NS(NS.createEl("div", container, { className: "nothing-found" }))
                .html("<b>No posts yet.<b>");
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
        if (!data.pinnedPosts || data.pinnedPosts.length === 0) {
            NS(NS.createEl("div", NS("#user-pinned-posts-container"), { className: "nothing-found" }))
                .html("<b>No pinned posts yet.<b>");
            return;
        }

        data.pinnedPosts.forEach((post, index) => {
            renderProfilePost({
                post: post,
                isUsernameMatch: isUsernameMatch,
                container: "#user-pinned-posts-container"
            });
        });
    }

    // Reset password recovery codes
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

    // Bio
    NS("#user-profile-bio").setText(data.bio ? capitalizeFirstLetter(data.bio) : "No bio found");

    // Update bio/email/visibility
    NS("#user-profile-bio-edit").on("click", function () {
        if (!isUsernameMatch) return;

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
                    url: "/api/v1/update/user",
                    method: "PUT",
                    body: { newBio: result.value }
                });

                if (!updateBioResponse.success) return Swal.fire(updateBioResponse.error);
                Swal.fire("Success", "Bio updated!", "success");
                getQuickInfo();
            }
        });
    });

    NS("#user-profile-email-edit").on("click", function () {
        if (!isUsernameMatch) return;

        Swal.fire({
            title: "Enter new email: ",
            input: "text",
            inputPlaceholder: "Enter new email...",
            showCancelButton: true,
            preConfirm: result => {
                if (!result) return Swal.showValidationMessage("You must enter a new email!");
            }
        }).then(async result => {
            if (result.value && result.isConfirmed) {
                const updateEmailResponse = await NS.fetch({
                    url: "/api/v1/update/user",
                    method: "PUT",
                    body: { newEmail: result.value }
                });

                if (!updateEmailResponse.success) return Swal.fire(updateEmailResponse.error);
                Swal.fire("Success", "Email updated!", "success");
                getQuickInfo();
            }
        });
    });

    NS("#user-profile-visibility-toggle").on("click", async function () {
        const result = await NS.fetch({
            url: "/api/v1/change-visibility/user-profile",
            method: "POST",
            body: { value: !data.private }
        });

        if (!result.success) return Swal.fire(resizeTo.error);
        Swal.fire("Sucess", `Account is ${data.private ? "public" : "private"}`, "success");
    });

    // Set emoji
    NS(".emoji-container-item").each(emoji => {
        emoji = NS(emoji);
        emoji.on("click", function () {
            const updateEmojidata = NS.fetch({
                url: "/api/v1/update/user",
                method: "PUT",
                body: { newEmoji: emoji.getText()[0] }
            });

            if (!updateEmojidata) return Swal.fire(updateEmojidata.error);
            return Swal.fire("Success", "Emoji successfully changed!", "success");
        });
    });

    // Navigation
    NS("#user-posts-prev-btn").on("click", async function () {
        if (postsSkip <= 0) return;
        postsSkip -= 10;

        data = await NS.fetch({
            url: `/api/v1/get/${isUsernameMatch ? "user-profile" : `user-profile/${data.username}`}/?skip=${postsSkip}`
        });

        renderPosts();
    });

    NS("#user-posts-next-btn").on("click", async function () {
        if (container.get(".nothing-found")[0]) return;
        postsSkip += 10;

        data = await NS.fetch({
            url: `/api/v1/get/${isUsernameMatch ? "user-profile" : `user-profile/${data.username}`}/?skip=${postsSkip}`
        });

        renderPosts();
    });

    renderPosts();
    renderPinnedPosts();
    setUpTaskbar();
    runAccessibility();
}