async function showProfile(data) {
    // Profile code
    let skip = 0;
    const username = capitalizeFirstLetter(data.username);
    const isUser = window.currentUserQuickInfo.username === data.username;
    const emojis = ["🚀", "👦🏻", "👧🏻", "👩🏻", "👨🏻", "🐣", "🏇🏻"];
    const greetings = ["Hello", "Hola", "Bonjour", "Ciao", "Hallo", "Olá", "Привет", "你好", "こんにちは", "안녕하세요", "مرحبا", "नमस्ते", "Merhaba", "Shalom", "Sawubona"];
    const greeting = greetings[Math.floor(Math.random() * greetings.length)];

    Swal.fire({
        titleText: `${isUser ? `${greeting}, ${data.emoji || "🚀"} ${username}!` : `${data.emoji || "🚀"} ${username}'s profile`}`,
        html: `
          <div class='card'>
            <div class='space-between'>
              <p class='center-overflow'><b>Bio:</b> ${capitalizeFirstLetter(data.bio) || "No bio found"}</p>
              ${isUser ? "<i class='fas fa-pen-to-square helper-icon' id='user-profile-bio-edit' role='button' tabindex='0'></i>" : ""}
            </div>
            <div class='space-between'>
              <p class='center-overflow'><b>Email:</b> ${data.email}</p>
              ${isUser ? "<i class='fas fa-pen-to-square helper-icon' id='user-profile-email-edit' role='button' tabindex='0'></i>" : ""}
            </div>
            <div class='space-between'>  
              <p class='center-overflow'><b>Visibility:</b> ${data.private ? "Private" : "Public"}</p>
              ${isUser ? `<i class='fas fa-${data.private ? "eye" : "eye-slash"} helper-icon' id='user-profile-visibility-toggle' role='button' tabindex='0'></i>` : ""}
            </div>
            ${isUser ? `
            <div class='center-overflow emoji-container'></div>
            <div class='center-overflow'>
              <button id='reset-password-recovery-codes-btn' class='w-full'>Reset Recovery Codes</button>
              <input id='insert-many-posts-input' type='file' style='display: none' accept=".json" />
              <button id='insert-many-posts-btn' class='w-full'>Insert Many Posts</button>
            </div>` : ""}
          </div>

          <div class='taskbar'>
            <button class='taskbar-button is-on-bg-color'>All</button>
            <button class='taskbar-button'>Pinned</button>
          </div>

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
                isUser: isUser,
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
                isUser: isUser,
                container: "#user-pinned-posts-container"
            });
        });
    }

    // Reset password recovery codes
    NS("#reset-password-recovery-codes-btn").on("click", lockEvent(async function () {
        const newCodesResponse = await NS.fetch({
            url: "/api/v1/reset/password/recovery-codes",
            method: "POST"
        });

        if (!newCodesResponse.success) return Swal.fire(newCodesResponse.error);
        const blob = new Blob([newCodesResponse.codes.join("\n")], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        NS(NS.createEl("a", document.body, {}))
            .attr("href", url)
            .attr("download", "recovery-codes.txt")
            .click()
            .remove();
        Swal.fire("Sucesss", "Password Recovery Codes Reseted!", "success");
    }));

    // Insert many posts
    NS("#insert-many-posts-btn").on("click", function () {
        NS("#insert-many-posts-input").click(1);
    });

    NS("#insert-many-posts-input").on("change", function (e) {
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = async () => {
            try {
                const posts = JSON.parse(reader.result);
                if (!Array.isArray(posts)) return Swal.fire("Invalid Data!");
                if (posts.length > 10) return Swal.fire("Posts count must be less than or equal to 10!");
                const insertManyPostsData = await NS.fetch({
                    url: "/api/v1/posts/bulk",
                    method: "POST",
                    body: { posts: posts }
                });

                if (!insertManyPostsData.success) return Swal.fire(insertManyPostsData.error);
                Swal.fire("Success!", "Posts inserted!", "success");
            } catch (e) {
                Swal.fire("Something went wrong!");
            }
        }

        reader.readAsText(file);
    });

    // Update bio/email/visibility
    NS("#user-profile-bio-edit").on("click", async function () {
        const result = await Swal.fire({
            title: "Enter new bio: ",
            input: "text",
            inputPlaceholder: "Enter new bio...",
            showCancelButton: true,
            preConfirm: result => {
                if (!result) return Swal.showValidationMessage("You must enter a new bio!");
                if (result.length < 5 || result.length > 20) return Swal.showValidationMessage("Bio must be between 5 and 20 chars!");
            }
        });

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

    NS("#user-profile-email-edit").on("click", async function () {
        const result = await Swal.fire({
            title: "Enter new email: ",
            input: "text",
            inputPlaceholder: "Enter new email...",
            showCancelButton: true,
            preConfirm: result => {
                if (!result) return Swal.showValidationMessage("You must enter a new email!");
                if (result.length > 100) return Swal.showValidationMessage("Email must be less than or equal to 100 chars!");
            }
        });

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

    NS("#user-profile-visibility-toggle").on("click", lockEvent(async function () {
        const updatevisibilityResponse = await NS.fetch({
            url: "/api/v1/change-visibility/user-profile",
            method: "PUT",
            body: { value: !data.private }
        });

        if (!updatevisibilityResponse.success) return Swal.fire(updatevisibilityResponse.error);
        Swal.fire("Sucess", `Account is ${data.private ? "public" : "private"}`, "success");
    }));

    // Emojis
    emojis.forEach(emoji => {
        NS(NS.createEl("button", NS(".emoji-container"), { className: "emoji-container-button" })).setText(emoji).on("click", lockEvent(async function () {
            const updateEmojidata = await NS.fetch({
                url: "/api/v1/update/user",
                method: "PUT",
                body: { newEmoji: emoji }
            });

            if (!updateEmojidata.success) return Swal.fire(updateEmojidata.error);
            return Swal.fire("Success", "Emoji successfully changed!", "success");
        }));
    });

    // Navigation
    NS("#user-posts-prev-btn").on("click", lockEvent(async function () {
        if (skip <= 0) return;
        skip -= 10;

        data = await NS.fetch({
            url: `/api/v1/get/user-profile/${window.currentUserQuickInfo._id}/?skip=${skip}`
        });

        renderPosts();
    }));

    NS("#user-posts-next-btn").on("click", lockEvent(async function () {
        if (container.get(".nothing-found")[0]) return;
        skip += 10;

        data = await NS.fetch({
            url: `/api/v1/get/user-profile/${window.currentUserQuickInfo._id}/?skip=${skip}`
        });

        renderPosts();
    }));

    renderPosts();
    renderPinnedPosts();
    setUpTaskbar();
    runAccessibility();
}