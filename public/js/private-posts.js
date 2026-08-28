NS("#private-posts-btn").on("click", lockEvent(async function () {
    let skip = 0;
    let data = await NS.fetch({
        url: `/api/v1/get/user-private-posts/?skip=${skip}`,
        method: "POST"
    });

    if (!data.success) return Swal.fire(data.error);

    Swal.fire({
        title: "Your private posts: ",
        html: `
          <div id='user-private-posts-container' class='scroll-container'></div>
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
        if (!data.posts.length || data.posts.length <= 0) {
            NS(NS.createEl("div", container, { className: "nothing-found" }))
                .html("<b>No private posts yet.<b>");
            return;
        }

        data.posts.forEach(post => {
            const postCard = NS.createEl("div", container, { className: "post" });
            NS(NS.createEl("h2", postCard, { className: "overflow" })).setText(post.title);
            changePostVisibility({
                value: false,
                buttonText: "Set as public",
                container: postCard,
                postId: post._id
            });
        });
    }

    // Navigation
    NS("#user-private-posts-next-btn").on("click", lockEvent(async function () {
        if (container.get(".nothing-found")[0]) return;
        skip += 10;

        data = await NS.fetch({
            url: `/api/v1/get/user-private-posts/?skip=${skip}`,
            method: "POST",
        });

        renderPrivatePosts();
    }));

    NS("#user-private-posts-prev-btn").on("click", lockEvent(async function () {
        if (skip <= 0) return;
        skip -= 10;

        data = await NS.fetch({
            url: `/api/v1/get/user-private-posts/?skip=${skip}`,
            method: "POST"
        });

        renderPrivatePosts();
    }));

    renderPrivatePosts();
}));
