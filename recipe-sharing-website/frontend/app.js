const pages = document.querySelectorAll(".page");
const recipeGrid = document.querySelector("#recipeGrid");
const detail = document.querySelector("#recipeDetail");
const searchInput = document.querySelector("#searchInput");
const categoryFilter = document.querySelector("#categoryFilter");
const timeFilter = document.querySelector("#timeFilter");
const tokenKey = "recipe-token";

const categories = ["Breakfast", "Vegan", "Desserts", "Dinner"];

function showPage(id) {
  pages.forEach((page) => page.classList.toggle("active", page.id === id));
  if (id === "recipes") loadRecipes();
}

function getToken() {
  return localStorage.getItem(tokenKey);
}

async function api(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (getToken()) headers.Authorization = `Bearer ${getToken()}`;

  const response = await fetch(path, { ...options, headers });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Something went wrong.");
  return data;
}

function recipeCard(recipe) {
  return `
    <article class="card">
      <img src="${recipe.image}" alt="${recipe.title}">
      <div class="card-body">
        <h3>${recipe.title}</h3>
        <p>${recipe.description}</p>
        <div class="meta">
          <span class="pill">${recipe.category}</span>
          <span class="pill">${recipe.difficulty}</span>
          <span class="pill">${recipe.cookingTime} min</span>
          <span class="pill">Rating ${recipe.rating || "New"}</span>
        </div>
        <button data-id="${recipe.id}">View Recipe</button>
      </div>
    </article>
  `;
}

async function loadRecipes() {
  const params = new URLSearchParams({
    search: searchInput.value,
    category: categoryFilter.value,
    time: timeFilter.value
  });
  const recipes = await api(`/api/recipes?${params}`);
  recipeGrid.innerHTML = recipes.map(recipeCard).join("") || "<p>No recipes found.</p>";
}

async function loadRecipe(id) {
  const recipe = await api(`/api/recipes/${id}`);
  detail.innerHTML = `
    <img src="${recipe.image}" alt="${recipe.title}">
    <div class="detail-body">
      <h2>${recipe.title}</h2>
      <div class="meta">
        <span class="pill">${recipe.category}</span>
        <span class="pill">${recipe.difficulty}</span>
        <span class="pill">${recipe.cookingTime} min</span>
        <span class="pill">Rating ${recipe.rating || "New"}</span>
      </div>
      <h3>Ingredients</h3>
      <ul>${recipe.ingredients.map((item) => `<li>${item}</li>`).join("")}</ul>
      <h3>Instructions</h3>
      <ol>${recipe.instructions.map((step) => `<li>${step}</li>`).join("")}</ol>
    </div>
  `;
  showPage("detail");
}

document.querySelector("#categoryLinks").innerHTML = categories
  .map((category) => `<a class="category" href="#recipes" data-category="${category}">${category}</a>`)
  .join("");

window.addEventListener("hashchange", () => showPage(location.hash.replace("#", "") || "home"));

document.querySelector("#homeSearch").addEventListener("submit", (event) => {
  event.preventDefault();
  location.hash = "recipes";
  loadRecipes();
});

document.querySelector("#categoryLinks").addEventListener("click", (event) => {
  const category = event.target.dataset.category;
  if (!category) return;
  categoryFilter.value = category;
});

recipeGrid.addEventListener("click", (event) => {
  const id = event.target.dataset.id;
  if (id) loadRecipe(id);
});

document.querySelector("#backToRecipes").addEventListener("click", () => showPage("recipes"));
categoryFilter.addEventListener("change", loadRecipes);
timeFilter.addEventListener("change", loadRecipes);

document.querySelector("#recipeForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = document.querySelector("#submitMessage");
  const body = Object.fromEntries(new FormData(event.target));

  try {
    await api("/api/recipes", { method: "POST", body: JSON.stringify(body) });
    message.textContent = "Recipe submitted successfully.";
    event.target.reset();
  } catch (error) {
    message.textContent = error.message;
  }
});

document.querySelector("#authForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const mode = event.submitter.dataset.mode;
  const message = document.querySelector("#authMessage");
  const body = Object.fromEntries(new FormData(event.target));

  try {
    const data = await api(`/api/auth/${mode}`, { method: "POST", body: JSON.stringify(body) });
    localStorage.setItem(tokenKey, data.token);
    message.textContent = `${mode === "register" ? "Registered" : "Logged in"} as ${data.user.name}.`;
  } catch (error) {
    message.textContent = error.message;
  }
});

showPage(location.hash.replace("#", "") || "home");
