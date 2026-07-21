const privatePostsBtn = NS("#private-posts-btn");
privatePostsBtn.on("click", async function () {
    let privatePostsSkip = 0;
    let response = await NS.fetch({
        url: "/api/get/user-private-posts",
        method: "POST"
    });

    Swal.fire({
        title: "Your private posts: ",
        html: `
          <div id='user-private-posts-container'></div>
          <div class='group'>
            <button id='user-private-posts-prev-btn'> 
              <i class='fas fa-caret-left'></i>
            </button>
            <button id='user-private-posts-next-btn'>
              <i class='fas fa-caret-right'></i>
            </button>
          </div>
        `,
        confirmButtonText: "Close"
    });

    const renderPrivatePosts = async () => {
        NS("#user-private-posts-container").html("");
        if (!response.posts.length || response.posts.length <= 0) {
            const noPrivatePostFound = NS.createEl("h2", NS("#user-private-posts-container"), {
                className: "nothing-found",
                style: "text-align: center"
            });
            noPrivatePostFound.textContent = "No private posts yet.";
            return;
        }

        response.posts.forEach(post => {
            const postCard = NS.createEl("div", NS("#user-private-posts-container"), { className: "post" });
            const titleEl = NS.createEl("h2", postCard, {});
            titleEl.textContent = decodeHTML(post.title);
            const contentEl = NS.createEl("p", postCard, {});
            contentEl.textContent = decodeHTML(post.content);
            changeVisibility({
                value: false,
                buttonText: "Set as public",
                container: postCard,
                postId: post._id
            });
        });
    }

    NS("#user-private-posts-next-btn").on("click", async function () {
        if (NS("#user-private-posts-container").get(".nothing-found")[0]) return;
        privatePostsSkip += 10;

        response = await NS.fetch({
            url: `/api/get/user-private-posts/?skip=${privatePostsSkip}`,
            method: "POST",
        });

        renderPrivatePosts();
    });

    NS("#user-private-posts-prev-btn").on("click", async function () {
        if (privatePostsSkip <= 0) return;
        privatePostsSkip -= 10;

        response = await NS.fetch({
            url: `/api/get/user-private-posts/?skip=${privatePostsSkip}`,
            method: "POST"
        });

        renderPrivatePosts();
    });

    renderPrivatePosts();
});
