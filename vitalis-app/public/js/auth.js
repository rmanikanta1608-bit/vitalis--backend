let mode = "signin"; // or "signup"

const tabSignin = document.getElementById("tabSignin");
const tabSignup = document.getElementById("tabSignup");
const nameField = document.getElementById("nameField");
const nameInput = document.getElementById("name");
const authTitle = document.getElementById("authTitle");
const authSub = document.getElementById("authSub");
const submitBtn = document.getElementById("submitBtn");
const authFoot = document.getElementById("authFoot");
const switchLink = document.getElementById("switchLink");
const authError = document.getElementById("authError");
const authForm = document.getElementById("authForm");
const passwordInput = document.getElementById("password");

// If already signed in, skip straight to the app.
fetch("/api/auth/me", { credentials: "include" })
  .then((r) => (r.ok ? (window.location.href = "/app.html") : null))
  .catch(() => {});

function setMode(next) {
  mode = next;
  authError.classList.remove("show");
  if (mode === "signin") {
    tabSignin.classList.add("active");
    tabSignup.classList.remove("active");
    nameField.style.display = "none";
    nameInput.required = false;
    authTitle.textContent = "Welcome back";
    authSub.textContent = "Sign in to find help near you.";
    submitBtn.textContent = "Sign in";
    passwordInput.setAttribute("autocomplete", "current-password");
    authFoot.innerHTML = 'Don\'t have an account? <a href="#" id="switchLink" style="color:var(--brand-dark); font-weight:600;">Create one</a>';
  } else {
    tabSignin.classList.remove("active");
    tabSignup.classList.add("active");
    nameField.style.display = "block";
    nameInput.required = true;
    authTitle.textContent = "Create your account";
    authSub.textContent = "Set up VITALIS in a few seconds.";
    submitBtn.textContent = "Create account";
    passwordInput.setAttribute("autocomplete", "new-password");
    authFoot.innerHTML = 'Already have an account? <a href="#" id="switchLink" style="color:var(--brand-dark); font-weight:600;">Sign in</a>';
  }
  document.getElementById("switchLink").addEventListener("click", (e) => {
    e.preventDefault();
    setMode(mode === "signin" ? "signup" : "signin");
  });
}

tabSignin.addEventListener("click", () => setMode("signin"));
tabSignup.addEventListener("click", () => setMode("signup"));
switchLink.addEventListener("click", (e) => {
  e.preventDefault();
  setMode(mode === "signin" ? "signup" : "signin");
});

authForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  authError.classList.remove("show");
  submitBtn.disabled = true;
  submitBtn.textContent = mode === "signin" ? "Signing in…" : "Creating account…";

  const email = document.getElementById("email").value.trim();
  const password = passwordInput.value;
  const name = nameInput.value.trim();

  try {
    const endpoint = mode === "signin" ? "/api/auth/login" : "/api/auth/signup";
    const body = mode === "signin" ? { email, password } : { name, email, password };

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
    const data = await res.json();

    if (!res.ok) {
      authError.textContent = data.error || "Something went wrong. Please try again.";
      authError.classList.add("show");
      submitBtn.disabled = false;
      submitBtn.textContent = mode === "signin" ? "Sign in" : "Create account";
      return;
    }

    window.location.href = "/app.html";
  } catch (err) {
    authError.textContent = "Couldn't reach the server. Please try again.";
    authError.classList.add("show");
    submitBtn.disabled = false;
    submitBtn.textContent = mode === "signin" ? "Sign in" : "Create account";
  }
});
