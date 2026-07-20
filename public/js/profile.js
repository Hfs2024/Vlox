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
        NS("#user-posts-container").html(""); // Clear the container

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

    // Reset bio
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

    // Set emoji
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

    // Navigation
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