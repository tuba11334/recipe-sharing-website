const express = require("express");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "change-this-secret";

app.use(express.json());
app.use(express.static(path.join(__dirname, "../frontend")));

const users = [];
let recipes = [
  {
    id: 1,
    title: "Berry Breakfast Bowl",
    image: "https://images.unsplash.com/photo-1494390248081-4e521a5940db?auto=format&fit=crop&w=900&q=80",
    description: "A quick fruit, yogurt, and oat bowl for busy mornings.",
    rating: 4.8,
    category: "Breakfast",
    difficulty: "Easy",
    cookingTime: 10,
    ingredients: ["Greek yogurt", "Mixed berries", "Rolled oats", "Honey"],
    instructions: ["Add yogurt to a bowl.", "Top with berries and oats.", "Drizzle honey and serve."]
  },
  {
    id: 2,
    title: "Creamy Vegan Pasta",
    image: "https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&w=900&q=80",
    description: "Simple pasta with a silky cashew and herb sauce.",
    rating: 4.6,
    category: "Vegan",
    difficulty: "Medium",
    cookingTime: 25,
    ingredients: ["Pasta", "Cashews", "Garlic", "Lemon", "Basil"],
    instructions: ["Boil pasta until tender.", "Blend soaked cashews, garlic, lemon, and basil.", "Toss pasta with sauce and serve warm."]
  },
  {
    id: 3,
    title: "Chocolate Mug Cake",
    image: "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=900&q=80",
    description: "A soft dessert ready in minutes with pantry basics.",
    rating: 4.9,
    category: "Desserts",
    difficulty: "Easy",
    cookingTime: 8,
    ingredients: ["Flour", "Cocoa powder", "Sugar", "Milk", "Oil"],
    instructions: ["Mix dry ingredients in a mug.", "Stir in milk and oil.", "Microwave for 90 seconds and cool briefly."]
  }
];

function base64url(value) {
  return Buffer.from(value).toString("base64url");
}

function signJwt(payload) {
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64url(JSON.stringify({ ...payload, exp: Date.now() + 24 * 60 * 60 * 1000 }));
  const signature = crypto.createHmac("sha256", JWT_SECRET).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${signature}`;
}

function verifyJwt(token) {
  const [header, body, signature] = token.split(".");
  const expected = crypto.createHmac("sha256", JWT_SECRET).update(`${header}.${body}`).digest("base64url");
  if (signature !== expected) return null;

  const payload = JSON.parse(Buffer.from(body, "base64url").toString());
  return payload.exp > Date.now() ? payload : null;
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(password, salt, 32).toString("hex");
  return `${salt}:${hash}`;
}

function passwordsMatch(password, storedPassword) {
  const [salt] = storedPassword.split(":");
  return hashPassword(password, salt) === storedPassword;
}

function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  const payload = token && verifyJwt(token);
  if (!payload) return res.status(401).json({ message: "Login required." });
  req.user = payload;
  next();
}

function listFromText(text) {
  return String(text || "")
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

app.post("/api/auth/register", (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ message: "Name, email, and password are required." });
  if (users.some((user) => user.email === email)) return res.status(409).json({ message: "Email is already registered." });

  const user = { id: users.length + 1, name, email, password: hashPassword(password) };
  users.push(user);
  res.status(201).json({ token: signJwt({ id: user.id, name: user.name, email: user.email }), user: { id: user.id, name, email } });
});

app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body;
  const user = users.find((item) => item.email === email);
  if (!user || !passwordsMatch(password, user.password)) return res.status(401).json({ message: "Invalid email or password." });
  res.json({ token: signJwt({ id: user.id, name: user.name, email: user.email }), user: { id: user.id, name: user.name, email } });
});

app.get("/api/auth/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

app.get("/api/recipes", (req, res) => {
  const search = String(req.query.search || "").toLowerCase();
  const category = String(req.query.category || "");
  const maxTime = Number(req.query.time || 0);

  const filtered = recipes.filter((recipe) => {
    const matchesSearch =
      !search ||
      recipe.title.toLowerCase().includes(search) ||
      recipe.ingredients.join(" ").toLowerCase().includes(search);
    const matchesCategory = !category || recipe.category === category;
    const matchesTime = !maxTime || recipe.cookingTime <= maxTime;
    return matchesSearch && matchesCategory && matchesTime;
  });

  res.json(filtered);
});

app.get("/api/recipes/:id", (req, res) => {
  const recipe = recipes.find((item) => item.id === Number(req.params.id));
  if (!recipe) return res.status(404).json({ message: "Recipe not found." });
  res.json(recipe);
});

app.post("/api/recipes", requireAuth, (req, res) => {
  const { title, description, category, cookingTime, difficulty, image } = req.body;
  if (!title || !category || !cookingTime) return res.status(400).json({ message: "Title, category, and cooking time are required." });

  const recipe = {
    id: Date.now(),
    title,
    image: image || "https://images.unsplash.com/photo-1543352634-a1c51d9f1fa7?auto=format&fit=crop&w=900&q=80",
    description: description || "A community-submitted recipe.",
    rating: 0,
    category,
    difficulty: difficulty || "Easy",
    cookingTime: Number(cookingTime),
    ingredients: listFromText(req.body.ingredients),
    instructions: listFromText(req.body.instructions)
  };

  recipes.unshift(recipe);
  res.status(201).json(recipe);
});

app.delete("/api/recipes/:id", requireAuth, (req, res) => {
  const before = recipes.length;
  recipes = recipes.filter((item) => item.id !== Number(req.params.id));
  if (recipes.length === before) return res.status(404).json({ message: "Recipe not found." });
  res.json({ message: "Recipe deleted." });
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

app.listen(PORT, () => {
  console.log(`Recipe app running at http://localhost:${PORT}`);
});
