const config = {
    // Others
    POSTS_LIMIT: 100,
    BOOKMARKS_LIMIT: 10,
    USER_POSTS_LIMIT: 10,

    // Posts and bookmarks
    POST_TITLE_MAX_LENGTH: 20,
    POST_CONTENT_MAX_LENGTH: 1000,
    POST_KEYWORDS_MAX_LENGTH: 5,
    POST_LEVEL_MIN: 1,
    POST_LEVEL_MAX: 10,
    ALLOWED_TAGS: [
        "pre", "code", "b", "i", "br", "span", "em", "strong", "u", "s", "sub", "sup", "small",
        "p", "div", "h1", "h2", "h3", "h4", "h5", "h6", "hr", "ul", "ol", "li",
        "blockquote", "cite", "q", "img", "video", "audio", "source", "a", "#text"
    ],

    // Auth
    USERNAME_MIN_LENGTH: 3,
    USERNAME_MAX_LENGTH: 10,
    PASSWORD_MIN_LENGTH: 12,
    PASSWORD_MAX_LENGTH: 64,
    BIO_MIN_LENGTH: 5,
    BIO_MAX_LENGTH: 20,
    EMAIL_MAX_LENGTH: 100,
    RECOVERY_CODE_LENGTH: 20,
    EMOJIS: ["🚀", "👦🏻", "👧🏻", "🐣", "🏇🏻"],

    // Coins and gifts
    COINS_MIN: 100,
    COINS_MAX: 5000,
    POST_REDEEM_LIKES_REQUIRED: 100,
    POST_REDEEM_PROGRESS_STEP_PERCENT: 20
}

export default config;