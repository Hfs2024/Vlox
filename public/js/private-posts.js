const privatePostsBtn = NS("#private-posts-btn");
privatePostsBtn.on("click", async function () {
    let privatePostsSkip = 0;
    let response = await NS.fetch({
        url: "/api/v1/get/user-private-posts",
        method: "POST"
    });

    Swal.fire({
        title: "Your private posts: ",
        html: `
          <div id='user-private-posts-container' class='user-container'></div>
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

    const container = NS("#user-private-posts-container");
    const renderPrivatePosts = async () => {
        container.html("");
        if (!response.posts.length || response.posts.length <= 0) {
            const noPrivatePostFound = NS.createEl("h2", container, {
                className: "nothing-found",
            });
            noPrivatePostFound.textContent = "No private posts yet.";
            return;
        }

        response.posts.forEach(post => {
            const postCard = NS.createEl("div", container, { className: "post" });
            const titleEl = NS(NS.createEl("h2", postCard, {})).setText(post.title);
            const contentEl = NS(NS.createEl("div", postCard, {})).html(cleanHTML(post.content) || "Not content found");
            changePostVisibility({
                value: false,
                buttonText: "Set as public",
                container: postCard,
                postId: post._id
            });
        });
    }

    NS("#user-private-posts-next-btn").on("click", async function () {
        if (container.get(".nothing-found")[0]) return;
        privatePostsSkip += 10;

        response = await NS.fetch({
            url: `/api/v1/get/user-private-posts/?skip=${privatePostsSkip}`,
            method: "POST",
        });

        renderPrivatePosts();
    });

    NS("#user-private-posts-prev-btn").on("click", async function () {
        if (privatePostsSkip <= 0) return;
        privatePostsSkip -= 10;

        response = await NS.fetch({
            url: `/api/v1/get/user-private-posts/?skip=${privatePostsSkip}`,
            method: "POST"
        });

        renderPrivatePosts();
    });

    renderPrivatePosts();
});
