/* Chef Nova front-end application. All personal data is stored locally in the browser. */
(function () {
  "use strict";

  const KEYS = { users: "chefNova.users", session: "chefNova.session", favorites: "chefNova.favorites", pantry: "chefNova.pantry", plans: "chefNova.mealPlans" };
  const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const MEALS = ["Breakfast", "Lunch", "Dinner"];
  const STARTER = {
    recipes: [
      { id: "r1", name: "Lemon Herb Pasta", emoji: "🍝", time: 25, difficulty: "Easy", description: "Silky pasta brightened with lemon, herbs, and parmesan.", ingredients: ["pasta", "lemon", "garlic", "parmesan", "parsley"], steps: ["Boil pasta until al dente.", "Warm garlic in olive oil.", "Toss with lemon, parmesan, herbs, and pasta water."] },
      { id: "r2", name: "Garden Shakshuka", emoji: "🍳", time: 35, difficulty: "Easy", description: "Eggs gently poached in a warmly spiced tomato and pepper sauce.", ingredients: ["eggs", "tomato", "bell pepper", "onion", "paprika"], steps: ["Soften onion and pepper.", "Simmer tomatoes with spices.", "Add eggs, cover, and cook until set."] },
      { id: "r3", name: "Golden Chickpea Bowl", emoji: "🥗", time: 30, difficulty: "Easy", description: "Crisp spiced chickpeas, greens, grains, and a creamy dressing.", ingredients: ["chickpeas", "rice", "spinach", "yogurt", "cucumber"], steps: ["Roast seasoned chickpeas.", "Cook rice and chop vegetables.", "Assemble and spoon over yogurt dressing."] },
      { id: "r4", name: "Cozy Tomato Soup", emoji: "🥣", time: 40, difficulty: "Easy", description: "A velvety roasted tomato soup for slow, cozy evenings.", ingredients: ["tomato", "onion", "garlic", "vegetable stock", "cream"], steps: ["Roast tomatoes, onion, and garlic.", "Blend with warm stock.", "Finish with cream and seasoning."] },
      { id: "r5", name: "Miso Glazed Salmon", emoji: "🐟", time: 28, difficulty: "Medium", description: "Caramelized salmon with savory miso and ginger.", ingredients: ["salmon", "miso", "ginger", "soy sauce", "rice"], steps: ["Mix the glaze.", "Brush over salmon.", "Roast and serve over rice."] },
      { id: "r6", name: "Apple Cinnamon Oats", emoji: "🍎", time: 12, difficulty: "Easy", description: "Creamy morning oats with warm apples and cinnamon.", ingredients: ["oats", "apple", "milk", "cinnamon", "maple syrup"], steps: ["Simmer oats with milk.", "Cook apple with cinnamon.", "Top oats with apples and maple syrup."] }
    ],
    users: [{ id: "demo", name: "Nova Cook", email: "demo@chefnova.local", password: "demo123" }],
    pantry: [
      { id: "p1", name: "Cherry tomatoes", quantity: "2 cups", category: "Produce", expirationDate: "2026-07-12" },
      { id: "p2", name: "Eggs", quantity: "8", category: "Protein", expirationDate: "2026-07-18" },
      { id: "p3", name: "Pasta", quantity: "500 g", category: "Grains", expirationDate: "2027-01-20" },
      { id: "p4", name: "Parmesan", quantity: "180 g", category: "Dairy", expirationDate: "2026-07-22" }
    ]
  };

  const state = { recipes: [], users: [], pantry: [], favorites: [], mealPlans: {}, currentUser: null, authMode: "login", ruleFilter: "All" };
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const read = (key, fallback) => { try { const value = localStorage.getItem(key); return value ? JSON.parse(value) : fallback; } catch (_) { return fallback; } };
  const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));

  async function loadStarter(path, fallback) {
    try { const response = await fetch(path); if (!response.ok) throw new Error("Unavailable"); return await response.json(); }
    catch (_) { return fallback; }
  }

  async function initialize() {
    const [recipes, users, pantry, plans] = await Promise.all([
      loadStarter("data/recipes.json", STARTER.recipes), loadStarter("data/users.json", STARTER.users),
      loadStarter("data/pantry.json", STARTER.pantry), loadStarter("data/mealPlans.json", {})
    ]);
    state.recipes = recipes;
    state.users = read(KEYS.users, users);
    state.pantry = read(KEYS.pantry, pantry);
    state.favorites = read(KEYS.favorites, []);
    state.mealPlans = read(KEYS.plans, plans);
    state.currentUser = read(KEYS.session, null);
    bindEvents(); renderAll(); navigate(location.hash.slice(1) || "home");
  }

  function bindEvents() {
    document.addEventListener("click", (event) => {
      const pageTarget = event.target.closest("[data-page]");
      if (pageTarget) { event.preventDefault(); navigate(pageTarget.dataset.page); }
      const favorite = event.target.closest("[data-favorite]");
      if (favorite) toggleFavorite(favorite.dataset.favorite);
      const remove = event.target.closest("[data-remove-pantry]");
      if (remove) removePantry(remove.dataset.removePantry);
      const auth = event.target.closest("[data-auth]");
      if (auth) auth.dataset.auth === "logout" ? logout() : openAuth();
    });
    $("#menuButton").addEventListener("click", () => $("#sidebar").classList.toggle("open"));
    $("#recipeSearchButton").addEventListener("click", renderRecipes);
    $("#recipeSearch").addEventListener("input", renderRecipes);
    $("#showPantryForm").addEventListener("click", () => $("#pantryForm").classList.toggle("hidden"));
    $("#pantryForm").addEventListener("submit", addPantry);
    $("#closeAuth").addEventListener("click", closeAuth);
    $("#authModal").addEventListener("click", (e) => { if (e.target.id === "authModal") closeAuth(); });
    $("#authSwitch").addEventListener("click", switchAuthMode);
    $("#authForm").addEventListener("submit", submitAuth);
    window.addEventListener("hashchange", () => navigate(location.hash.slice(1) || "home", false));
  }

  function navigate(page, updateHash = true) {
    if (!$("[data-page-section='" + page + "']")) page = "home";
    $$(".page").forEach((el) => el.classList.toggle("active", el.dataset.pageSection === page));
    $$(".nav-link").forEach((el) => el.classList.toggle("active", el.dataset.page === page));
    if (updateHash && location.hash !== "#" + page) history.pushState(null, "", "#" + page);
    $("#sidebar").classList.remove("open"); window.scrollTo(0, 0);
    if (page === "favorites") renderFavorites();
  }

  function renderAll() { renderAccount(); renderRecipes(); renderPantry(); renderPlanner(); renderFavorites(); renderRules(); }
  function renderAccount() {
    $("#accountArea").innerHTML = state.currentUser
      ? `<span class="user-greeting">Hi, ${escapeHtml(state.currentUser.name.split(" ")[0])}</span><button class="avatar" data-auth="logout" title="Sign out">${escapeHtml(state.currentUser.name.charAt(0).toUpperCase())}</button>`
      : `<button class="button small secondary" data-auth="login">Sign in</button>`;
  }

  function renderRecipes() {
    const query = ($("#recipeSearch").value || "").toLowerCase().split(",").map((s) => s.trim()).filter(Boolean);
    const results = query.length ? state.recipes.map((recipe) => {
      const haystack = (recipe.name + " " + recipe.ingredients.join(" ")).toLowerCase();
      return { ...recipe, matches: query.filter((term) => haystack.includes(term)).length };
    }).filter((r) => r.matches > 0).sort((a, b) => b.matches - a.matches) : state.recipes;
    $("#recipeResults").innerHTML = results.length ? results.map(recipeCard).join("") : emptyState("No recipes found", "Try a broader ingredient or dish name.");
  }

  function recipeCard(recipe) {
    const saved = state.favorites.includes(recipe.id);
    return `<article class="recipe-card"><div class="recipe-image"><span>${recipe.emoji}</span><button class="favorite-button ${saved ? "saved" : ""}" data-favorite="${recipe.id}" aria-label="${saved ? "Remove from" : "Add to"} favorites">${saved ? "♥" : "♡"}</button></div><div class="recipe-body"><div class="recipe-meta"><span>◷ ${recipe.time} min</span><span>${recipe.difficulty}</span></div><h3>${escapeHtml(recipe.name)}</h3><p>${escapeHtml(recipe.description)}</p><div class="ingredient-tags">${recipe.ingredients.slice(0, 3).map((i) => `<span>${escapeHtml(i)}</span>`).join("")}</div></div></article>`;
  }

  function toggleFavorite(id) {
    state.favorites = state.favorites.includes(id) ? state.favorites.filter((item) => item !== id) : [...state.favorites, id];
    write(KEYS.favorites, state.favorites); renderRecipes(); renderFavorites(); toast(state.favorites.includes(id) ? "Saved to favorites" : "Removed from favorites");
  }

  function renderFavorites() {
    const recipes = state.recipes.filter((recipe) => state.favorites.includes(recipe.id));
    $("#favoriteResults").innerHTML = recipes.length ? recipes.map(recipeCard).join("") : emptyState("Your cookbook is waiting", "Save a recipe and it will appear here.", "Discover recipes", "recipes");
  }

  function renderPantry() {
    const soon = state.pantry.filter((item) => daysUntil(item.expirationDate) <= 7).length;
    const categories = new Set(state.pantry.map((item) => item.category)).size;
    $("#pantrySummary").innerHTML = `<div class="summary-card"><span>Pantry items</span><strong>${state.pantry.length}</strong></div><div class="summary-card warning"><span>Use soon</span><strong>${soon}</strong></div><div class="summary-card"><span>Categories</span><strong>${categories}</strong></div>`;
    $("#pantryList").innerHTML = state.pantry.length ? `<div class="pantry-row pantry-head"><span>Ingredient</span><span>Quantity</span><span>Category</span><span>Best before</span><span></span></div>${state.pantry.map((item) => { const days = daysUntil(item.expirationDate); return `<div class="pantry-row"><span><b>${escapeHtml(item.name)}</b></span><span>${escapeHtml(item.quantity)}</span><span><i class="category-dot"></i>${escapeHtml(item.category)}</span><span class="${days <= 7 ? "expiry-soon" : ""}">${item.expirationDate ? formatDate(item.expirationDate) : "—"}</span><button class="remove-button" data-remove-pantry="${item.id}" aria-label="Remove ${escapeHtml(item.name)}">×</button></div>`; }).join("")}` : emptyState("Your pantry is empty", "Add the first ingredient to get started.");
  }

  function addPantry(event) {
    event.preventDefault(); const data = new FormData(event.currentTarget);
    state.pantry.push({ id: "p" + Date.now(), name: data.get("name").trim(), quantity: data.get("quantity").trim(), category: data.get("category"), expirationDate: data.get("expirationDate") });
    write(KEYS.pantry, state.pantry); event.currentTarget.reset(); event.currentTarget.classList.add("hidden"); renderPantry(); toast("Ingredient added");
  }
  function removePantry(id) { state.pantry = state.pantry.filter((item) => item.id !== id); write(KEYS.pantry, state.pantry); renderPantry(); toast("Ingredient removed"); }

  function renderPlanner() {
    $("#mealPlanner").innerHTML = `<div class="planner-grid"><div class="planner-corner">This week</div>${MEALS.map((m) => `<div class="meal-label">${m}</div>`).join("")}${DAYS.map((day) => `<div class="day-label"><b>${day.slice(0, 3)}</b><small>${day}</small></div>${MEALS.map((meal) => `<div class="meal-cell"><input aria-label="${day} ${meal}" data-day="${day}" data-meal="${meal}" value="${escapeHtml((state.mealPlans[day] || {})[meal] || "")}" placeholder="+ Add meal"></div>`).join("")}`).join("")}</div>`;
    $$("#mealPlanner input").forEach((input) => input.addEventListener("change", saveMeal));
  }
  function saveMeal(event) { const { day, meal } = event.target.dataset; state.mealPlans[day] = state.mealPlans[day] || {}; state.mealPlans[day][meal] = event.target.value.trim(); write(KEYS.plans, state.mealPlans); toast("Meal plan saved"); }

  function renderRules() {
    const rules = window.CHEF_NOVA_RULES || []; const categories = ["All", ...new Set(rules.map((r) => r.category))];
    $("#ruleFilters").innerHTML = categories.map((c) => `<button class="filter-button ${c === state.ruleFilter ? "active" : ""}" data-rule-filter="${c}">${c}</button>`).join("");
    const visible = state.ruleFilter === "All" ? rules : rules.filter((r) => r.category === state.ruleFilter);
    $("#ruleList").innerHTML = visible.map((rule) => `<article class="learning-card"><span class="learning-icon">${rule.icon}</span><span class="eyebrow">${rule.category}</span><h3>${escapeHtml(rule.title)}</h3><p>${escapeHtml(rule.text)}</p></article>`).join("");
    $$("[data-rule-filter]").forEach((btn) => btn.addEventListener("click", () => { state.ruleFilter = btn.dataset.ruleFilter; renderRules(); }));
  }

  function openAuth() { $("#authModal").classList.remove("hidden"); $("#authForm input:not(.hidden)").focus(); }
  function closeAuth() { $("#authModal").classList.add("hidden"); $("#authMessage").textContent = ""; }
  function switchAuthMode() { state.authMode = state.authMode === "login" ? "register" : "login"; const register = state.authMode === "register"; $("#authName").classList.toggle("hidden", !register); $("#authName").required = register; $("#authTitle").textContent = register ? "Create your kitchen" : "Welcome back"; $("#authSubtitle").textContent = register ? "A calmer cooking week starts here." : "Sign in to continue your cooking journey."; $("#authSwitch").textContent = register ? "Already have an account? Sign in" : "New here? Create an account"; $("#authMessage").textContent = ""; }
  function submitAuth(event) {
    event.preventDefault(); const data = new FormData(event.currentTarget); const email = data.get("email").trim().toLowerCase(); const password = data.get("password");
    if (state.authMode === "register") {
      if (state.users.some((u) => u.email.toLowerCase() === email)) return showAuthMessage("An account with that email already exists.");
      const user = { id: "u" + Date.now(), name: data.get("name").trim(), email, password }; state.users.push(user); write(KEYS.users, state.users); setSession(user);
    } else { const user = state.users.find((u) => u.email.toLowerCase() === email && u.password === password); if (!user) return showAuthMessage("Email or password not recognized."); setSession(user); }
  }
  function setSession(user) { state.currentUser = { id: user.id, name: user.name, email: user.email }; write(KEYS.session, state.currentUser); renderAccount(); closeAuth(); $("#authForm").reset(); toast("Welcome, " + user.name.split(" ")[0] + "!"); }
  function logout() { state.currentUser = null; localStorage.removeItem(KEYS.session); renderAccount(); toast("Signed out"); }
  function showAuthMessage(message) { $("#authMessage").textContent = message; }

  function daysUntil(date) { if (!date) return Infinity; const today = new Date(); today.setHours(0,0,0,0); return Math.ceil((new Date(date + "T00:00:00") - today) / 86400000); }
  function formatDate(date) { return new Date(date + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }); }
  function emptyState(title, copy, label, page) { return `<div class="empty-state"><span>✦</span><h3>${title}</h3><p>${copy}</p>${label ? `<button class="button primary" data-page="${page}">${label}</button>` : ""}</div>`; }
  function escapeHtml(value) { return String(value == null ? "" : value).replace(/[&<>'"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[c]); }
  let toastTimer; function toast(message) { const el = $("#toast"); el.textContent = message; el.classList.add("show"); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove("show"), 2200); }
  initialize();
})();
