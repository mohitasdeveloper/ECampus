// auth/login.js
import { supabase } from '../supabase.js';
const sb = supabase; // Keep using 'sb' for consistency in the file

// DOM elements
let loginForm;
let loginButton;
let authMessage;

// 🔔 Show message
function showMessage(message, isError = true) {
    if (!authMessage) return;

    authMessage.textContent = message;
    authMessage.className = isError
        ? "text-red-500 text-sm text-center mb-4 h-5"
        : "text-green-500 text-sm text-center mb-4 h-5";
}

// ⏳ Button loading state
function setLoading(button, isLoading) {
    if (!button) return;

    const btnText = button.querySelector(".btn-text");
    const loader = button.querySelector("span:last-child");

    if (isLoading) {
        button.disabled = true;
        if (btnText) btnText.classList.add("hidden");
        if (loader) loader.classList.remove("hidden");
    } else {
        button.disabled = false;
        if (btnText) btnText.classList.remove("hidden");
        if (loader) loader.classList.add("hidden");
    }
}

// 🔐 HANDLE LOGIN
async function handleLogin(event) {
    event.preventDefault();

    const identifier = document.getElementById("login-identifier").value.trim();
    const password = document.getElementById("login-password").value;

    if (!identifier || !password) {
        showMessage("Please enter Email/Student ID and Password");
        return;
    }

    setLoading(loginButton, true);
    showMessage("", false);

    try {
        if (identifier.includes('@')) {
            // 🔥 Email Login
            const { data, error } = await sb.auth.signInWithPassword({
                email: identifier,
                password: password,
            });

            if (error) {
                console.error("Login error:", error);
                showMessage(error.message || "Invalid email or password.");
                return;
            }

            if (data?.session) {
                window.location.href = "../index.html";
                return;
            }
        } else {
            // 🔥 Student ID Login via Edge Function
            const { data, error } = await sb.functions.invoke(
                "hyper-endpoint",
                {
                    body: { studentId: identifier, password }
                }
            );

            if (error) {
                console.error("Function error:", error);
                showMessage("Server error. Try again.");
                return;
            }

            if (data?.error) {
                showMessage(data.error);
                return;
            }

            if (data?.session) {
                // ✅ Set session
                const { error: sessionError } = await sb.auth.setSession(data.session);

                if (sessionError) {
                    console.error("Session error:", sessionError);
                    showMessage("Login failed. Try again.");
                    return;
                }

                // 🎯 Redirect (GitHub Pages safe)
                window.location.href = "../index.html";
                return;
            }
        }

        showMessage("Unexpected error occurred.");

    } catch (err) {
        console.error("Login error:", err);
        showMessage("Something went wrong.");
    } finally {
        setLoading(loginButton, false);
    }
}

// 🔁 Check existing session
async function checkUserSession() {
    try {
        const { data } = await sb.auth.getSession();

        if (data?.session) {
            // already logged in → skip login page
            window.location.href = "../index.html";
        }
    } catch (err) {
        console.error("Session check error:", err);
    }
}

// 🚀 INIT
document.addEventListener("DOMContentLoaded", () => {
    loginForm = document.getElementById("login-form");
    loginButton = document.getElementById("login-button");
    authMessage = document.getElementById("auth-message");

    if (!loginForm) {
        console.error("Login form not found!");
        return;
    }

    loginForm.addEventListener("submit", handleLogin);

    // check if already logged in
    checkUserSession();
});
