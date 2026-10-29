import { renderSafeHtml } from "./utils.js";

const templates = {
  POST_EDITOR: () => `
<input id="post-editor-title" type="text" placeholder="Enter post title...">
<textarea id="post-editor-content" placeholder="Enter post content..."></textarea>
`,

  USER_BOOKMARKS: () => `
<div id="user-bookmarks-container" class="scroll-container"></div>
<div class="center">
  <button id="user-bookmarks-prev-btn"> 
    <i class="fas fa-caret-left"></i>
  </button>
  <button id="user-bookmarks-next-btn">
    <i class="fas fa-caret-right"></i>
  </button>
</div>`,

  POST_COMMENTS: () => `
<div id="comments-container" class="scroll-container"></div>
<div class="center">
  <button id="comments-prev-btn"><i class="fas fa-caret-left"></i></button>
  <button id="comments-next-btn"><i class="fas fa-caret-right"></i></button>
</div>`,

  USER_LOGIN: () => `
<h2>Login</h2>
<input type="text" id="login-username" placeholder="Username">
<input type="password" id="login-password" placeholder="Password">
<p class="link-swal-auth text-forget-password" role="button" tabindex="0" data-target="password_recovery">
  Forgot your password?
</p>
<p class="text-swal-auth">
    Need an account? <span class="link-swal-auth" role="button" tabindex="0" data-target="signup">Sign up</span>
</p>
`,

  USER_SIGNUP: () => `
<h2>Sign Up</h2>
<input type="text" id="signup-username" placeholder="Username">
<input type="password" id="signup-password" placeholder="Password">
<input type="email" id="signup-email" placeholder="Email">
<input type="text" id="signup-bio" placeholder="Bio" autocomplete="off">      
<p class="text-swal-auth">
    Already have an account? <span class="link-swal-auth" role="button" tabindex="0" data-target="login">Log in</span>
</p>
`,

  USER_PROFILE: (state) => `
<div class="card">
  <div class="space-between">
    <p class="center-overflow"><b>Bio:</b> ${renderSafeHtml(state?.user?.bio, false) || "No bio found"}</p>
    ${state?.user?.isLoggedInUser ? '<i class="fas fa-pen-to-square icon-helper" id="profile-bio-edit-btn" role="button" tabindex="0"></i>' : ""}
  </div>
  <div class="space-between">  
    <p><b>Visibility:</b> ${state?.user?.private ? "Private" : "Public"}</p>
    ${state?.user?.isLoggedInUser ? `<i class="fas fa-${state?.user?.private ? "eye" : "eye-slash"} icon-helper" id="profile-visibility-toggle-btn" role="button" tabindex="0"></i>` : ""}
  </div>
  ${state?.user?.isLoggedInUser ? `
  <div class="center">
    <button id="profile-bookmarks-btn" class="w-full">
       <i class="fas fa-bookmark"></i>
    </button>

    <button id="reset-password-recovery-codes-btn" class="w-full">
      <i class="fas fa-arrow-left-rotate"></i>
    </button>
  </div>
` : ""}
</div>

<div id="user-posts-container" class="scroll-container">
  <button id="profile-load-posts-btn" class="w-full">
    <i class="fas fa-download"></i>
    Load Posts
  </button>
</div>

<div class="center" style="margin-top: 10px">
  <button id="profile-posts-prev-btn">
    <i class="fas fa-caret-left"></i>
  </button>
  <button id="profile-posts-next-btn">
    <i class="fas fa-caret-right"></i>
  </button>
</div>
`
};

export default templates;