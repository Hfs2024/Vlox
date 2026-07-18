const cardGeneratorBtn = NS("#card-generator-btn");

function updatePreview(itemToUpdate) {
  if (itemToUpdate === "age") NS("#card-generator-age").setText(NS("#card-generator-age-input").getVal()[0] || "N/A");
  if (itemToUpdate === "bio") NS("#card-generator-bio").setText(NS("#card-generator-bio-input").getVal()[0] || capitalizeFirstLtter(window.currentUserQuickInfo.bio));
  if (itemToUpdate === "portfolio") {
    const value = NS("#card-generator-website-input").getVal()[0] || "https://example.com";
    NS("#card-generator-website").setText(value);
  }
}

function downloadCard(action, type, targetEl) {
  Swal.fire({
    icon: "info",
    title: "Proccessing...",
    html: "<div id='card-processing-wrapper'></div>"
  });

  NS("#card-processing-wrapper").append(targetEl);

  htmlToImage[action](NS("#card-processing-wrapper")[0], { quality: 1.0 })
    .then(dataUrl => {
      const link = document.createElement("a");
      document.body.appendChild(link);
      link.download = `${window.currentUserQuickInfo.username}-card.${type}`;
      link.href = dataUrl;
      link.click();
      link.remove();
      Swal.clickConfirm();
    })
    .catch(error => {
      console.error('Oops, something went wrong!', error);
      Swal.fire("Error", "Something went wrong. Try again", "error");
      Swal.clickConfirm();
    });
}

cardGeneratorBtn.on("click", async function () {
  if (window.currentUserQuickInfo.error) return Swal.fire(window.currentUserQuickInfo.error);

  Swal.fire({
    title: "Create your mini card!",
    html: `
<hr>
<h3>Preview: </h3>
<div id='card-generator-image-preview'>
  <p class='card-generator-preview-item' id='card-generator-username' data-type='username'>${window.currentUserQuickInfo.emoji} ${capitalizeFirstLtter(window.currentUserQuickInfo.username) || "User"}</p>
  <p class='card-generator-preview-item' data-type='age'>Age: <span id='card-generator-age'>N/A</span></p>
  <p class='card-generator-preview-item' id='card-generator-bio' data-type='bio'>${capitalizeFirstLtter(window.currentUserQuickInfo.bio)}</p>
  <p class='card-generator-preview-item' data-type='website'>Website: <span id='card-generator-website'>https://example.com</span></p>
  <div class='card-generator-preview-skills-container'>
     <p class='card-generator-preview-skill-cell'>Cooking</p>
     <p class='card-generator-preview-skill-cell'>Reading</p>
  </div>
</div></br>

<hr>
<div class='taskbar'>
  <button class='taskbar-button taskbar-button-chosen'>Basic</button>
  <button class='taskbar-button'>Styles</button>
  <button class='taskbar-button'>Skills</button>
</div>

<div class='taskbar-panel taskbar-panel-chosen'>
  <h3>Add data: </h3>
  <input id='card-generator-age-input' class='card-generator-input' type='number' placeholder='Enter your age...'
    data-update='age' /></br></br>
  <input id='card-generator-bio-input' class='card-generator-input' type='text' placeholder='Enter your bio...'
    data-update='bio' /></br></br>
  <input id='card-generator-website-input' class='card-generator-input' type='url'
    placeholder='Enter your portfolio website...' data-update='portfolio' /></br></br>
</div>

<div class='taskbar-panel'>
  <h3 id='card-generator-selected-element'>Styles will apply to preview card</h3>

  <div class='center-overflow'>
    <label>Color: </label>
    <input id='card-generator-color-input' type='color' />
  </div></br>

  <div class='center-overflow'>
    <label>BG Color: </label>
    <input id='card-generator-bg-color-input' type='color' />
  </div></br>

  <div class='center-overflow'>
    <label>Font Family</label>
    <select id='card-generator-font-select'>
      <option value='Merriweather'>Default</option>
      <option value='sans-serif'>Sans-Serif</option>
      <option value='Times New Roman'>Times New Roman</option>
      <option value='Roboto Slab'>Roboto Slab</option>
    </select>
  </div></br>

  <hr>
  
  <div class='center-overflow'>
    <label>Border Radius: </label>
    <input id='card-generator-border-radius-input' type='range' min='0' max='20' step='1' value='20' /></br></br>
  </div>

  <input type='file' id='card-generator-custom-bg-image-upload' style='display: none' accept="image/*" />
</div>

<div class='taskbar-panel'>
  <h3>Add skills:</h3>

  <div class='center'>
     <input type='text' placeholder='Enter skill...' id='card-generator-skills-input' />
     <button style='margin-top: 0' id='card-generator-skills-add-btn'>
       <i class='fas fa-plus'></i>
     </button>
  </div>

  <p id='card-generator-skills-status-message'>Status and issues will appear here</p>
</div>
        `,
    showCancelButton: true,
    confirmButtonText: "Download",
  }).then(result => {
    const targetEl = NS("#card-generator-image-preview")[0];

    if (!result.isConfirmed) return;
    Swal.fire({
      title: "Choose image type: ",
      html: `
          <div class='center'>
            <button class='card-generator-export-image-type-btn' data-action='toPng' data-type='png'>PNG</button>
            <button class='card-generator-export-image-type-btn' data-action='toSvg' data-type='svg'>SVG</button>
          </div>
        `,
      showCancelButton: true,
      showConfirmButton: false
    });

    NS(".card-generator-export-image-type-btn").each(btn => {
      btn = NS(btn);
      btn.on("click", function () {
        downloadCard(btn.getDataSetItem("action")[0], btn.getDataSetItem("type")[0], targetEl);
      });
    });
  });

  // Selected element
  let selectedElement = NS("#card-generator-image-preview")[0];

  // Styles and preview
  NS(".card-generator-input").each(input => {
    input = NS(input);
    input.on("input", function () {
      const itemToUpdate = input.getDataSetItem("update")[0];
      updatePreview(itemToUpdate);
    });
  });

  NS("#card-generator-color-input").on("change", function (e) {
    NS(selectedElement).css({ color: NS("#card-generator-color-input").getVal()[0] });
  });

  NS("#card-generator-bg-color-input").on("change", function (e) {
    NS(selectedElement).css({ backgroundColor: NS("#card-generator-bg-color-input").getVal()[0] });
  });

  NS("#card-generator-font-select").on("change", function () {
    NS(selectedElement).css({ fontFamily: NS("#card-generator-font-select").getVal()[0] });
  });

  NS("#card-generator-border-radius-input").on("input", function () {
    NS("#card-generator-image-preview").css({ borderRadius: `${NS("#card-generator-border-radius-input").getVal()[0]}px` });
  });

  // Custom image background
  NS("#card-generator-image-preview").on("contextmenu", function (e) {
    e.preventDefault();
    NS("#card-generator-custom-bg-image-upload").click();
  }).on("dblclick", function () {
    NS("#card-generator-image-preview").css({
      backgroundImage: "",
      backgroundPosition: "",
      backgroundRepeat: "",
      backgroundSize: ""
    });
  }).on("click", function () {
    selectedElement = this;
    NS("#card-generator-selected-element").setText("Styles will apply to preview card");
  });

  NS("#card-generator-custom-bg-image-upload").on("change", function (e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      NS("#card-generator-image-preview").css({
        backgroundImage: `url(${reader.result})`,
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        backgroundSize: "cover"
      });
    }

    reader.readAsDataURL(file);
  });

  // Custom color styles
  NS("#card-generator-image-preview .card-generator-preview-item").each(item => {
    item = NS(item);
    item.on("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      selectedElement = this;
      NS("#card-generator-selected-element").setText(`Styles will apply to ${item.getDataSetItem("type")}`);
    });
  });

  // Skills
  NS("#card-generator-skills-add-btn").on("click", function () {
    const input = NS("#card-generator-skills-input");
    const status = NS("#card-generator-skills-status-message");
    const setStatusError = (error) => {
      status.css({ color: "red" }).setText(error);
    }

    if (!input.getVal()[0]) return;
    if (input.getVal()[0].length > 10) return setStatusError("Skill can be 10 chars only!")
    if (NS(".card-generator-preview-skill-cell").length >= 3) return setStatusError("You can only have 3 skills!");

    const newSkillCell = NS(NS.createEl("p", NS(".card-generator-preview-skills-container"), { className: "card-generator-preview-skill-cell" }))
      .setText(input.getVal()[0])
      .on("click", function () {
        this.remove();
      });

    // Reset
    input.setVal("");
    status.css({ color: "black" }).setText("Status will appear here");
  });

  NS(".card-generator-preview-skill-cell").each(cell => {
    cell = NS(cell);
    cell.on("click", function () {
      cell.remove();
    });
  });

  setUpTaskbar();
});