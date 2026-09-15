// --- Firebase Initialization Config ---
const firebaseConfig = {
  apiKey: "AIzaSyD_jkbNRyDROTNQaD5vFAVswIN5Ckrp_bM",
  authDomain: "routine-15592.firebaseapp.com",
  databaseURL: "https://routine-15592-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "routine-15592",
  storageBucket: "routine-15592.firebasestorage.app",
  messagingSenderId: "1082510878022",
  appId: "1:1082510878022:web:da64d26cf6fe933ddef147"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.database();

// --- Global Application State Memory ---
let currentUser = null;
let isSignUpMode = false;
let userInitiatedAuth = false;
let expenseChart = null;

let currentData = {
  monthlyBudget: 25000,
  additionalFunds: 0,
  defaultBreakfast: 150,
  defaultLunch: 250,
  defaultDinner: 200,
  todayLogs: [],
  summaryLogs: []
};

// Update active month badge instantly
function updateMonthPill() {
  const monthPill = document.getElementById("activeMonthPill");
  if (monthPill) {
    const now = new Date();
    const monthName = now.toLocaleString("en-US", { month: "long" }).toUpperCase();
    monthPill.textContent = `${monthName} ${now.getFullYear()}`;
  }
}

// --- Time Greeting Logic ---
function updateTimeGreeting() {
  const greetingElement = document.getElementById("timeGreeting");
  if (!greetingElement) return;

  const hour = new Date().getHours();
  let greeting = "GOOD EVENING";

  if (hour >= 5 && hour < 12) {
    greeting = "GOOD MORNING";
  } else if (hour >= 12 && hour < 17) {
    greeting = "GOOD AFTERNOON";
  } else {
    greeting = "GOOD EVENING";
  }

  greetingElement.textContent = greeting;
}

// --- App Navigation Screen Controls ---
function goToAuth() {
  userInitiatedAuth = true;
  document.getElementById("introScreen")?.classList.add("hidden");
  document.getElementById("authScreen")?.classList.remove("hidden");
}

function toggleAuthMode() {
  isSignUpMode = !isSignUpMode;
  const title = document.getElementById("vectorCardTitle");
  const nameWrap = document.getElementById("wrapVectorName");
  const emailWrap = document.getElementById("wrapVectorEmail");
  const primaryBtn = document.getElementById("btnVectorPrimary");
  const secondaryBtn = document.getElementById("btnVectorSecondary");
  const errorMsg = document.getElementById("authErrorMsg");

  if (errorMsg) {
    errorMsg.style.display = "none";
    errorMsg.textContent = "";
  }

  if (isSignUpMode) {
    if (title) title.textContent = "Sign Up";
    if (nameWrap) nameWrap.style.display = "block";
    if (emailWrap) emailWrap.style.display = "block";
    if (primaryBtn) primaryBtn.textContent = "REGISTER";
    if (secondaryBtn) secondaryBtn.textContent = "SIGN IN";
  } else {
    if (title) title.textContent = "Sign In";
    if (nameWrap) nameWrap.style.display = "block";
    if (emailWrap) emailWrap.style.display = "none";
    if (primaryBtn) primaryBtn.textContent = "SIGN IN";
    if (secondaryBtn) secondaryBtn.textContent = "SIGN UP";
  }
}

// Helper to update greeting name and avatar dynamically
function updateHeaderDisplayName(name) {
  const userName = name && name.trim() !== "" ? name : "Student";
  if (document.getElementById("displayUserName")) {
    document.getElementById("displayUserName").textContent = userName;
  }
  if (document.getElementById("avatarInitial")) {
    document.getElementById("avatarInitial").textContent = userName.charAt(0).toUpperCase();
  }
}

// --- Firebase Authentication Handler ---
function handleAuthSubmit(event) {
  event.preventDefault();
  const nameInput = document.getElementById("vectorInputName")?.value.trim() || "";
  const emailInput = document.getElementById("vectorInputEmail")?.value.trim() || "";
  const passwordInput = document.getElementById("vectorInputPassword")?.value || "";
  const errorMsg = document.getElementById("authErrorMsg");

  if (errorMsg) {
    errorMsg.style.display = "none";
    errorMsg.textContent = "";
  }

  if (isSignUpMode) {
    const targetEmail = emailInput || (nameInput ? `${nameInput.replace(/\s+/g, '').toLowerCase()}@student.app` : "");

    if (!targetEmail || !passwordInput || !nameInput) {
      if (errorMsg) {
        errorMsg.textContent = "Please fill in all required fields.";
        errorMsg.style.display = "block";
      }
      return;
    }

    auth.createUserWithEmailAndPassword(targetEmail, passwordInput)
      .then((userCredential) => {
        const user = userCredential.user;
        return user.updateProfile({ displayName: nameInput }).then(() => {
          return db.ref("users/" + user.uid + "/settings").set({
            displayName: nameInput,
            monthlyBudget: 25000,
            additionalFunds: 0,
            defaultBreakfast: 150,
            defaultLunch: 250,
            defaultDinner: 200
          });
        });
      })
      .then(() => {
        updateHeaderDisplayName(nameInput);
      })
      .catch((err) => {
        console.error("Sign Up Error:", err);
        if (errorMsg) {
          errorMsg.textContent = err.message;
          errorMsg.style.display = "block";
        }
      });
  } else {
    let authEmail = emailInput;
    if (!authEmail && nameInput) {
      authEmail = nameInput.includes("@") ? nameInput : `${nameInput.replace(/\s+/g, '').toLowerCase()}@student.app`;
    }

    if (!authEmail || !passwordInput) {
      if (errorMsg) {
        errorMsg.textContent = "Please enter your name/email and password.";
        errorMsg.style.display = "block";
      }
      return;
    }

    auth.signInWithEmailAndPassword(authEmail, passwordInput)
      .catch((err) => {
        console.error("Sign In Error:", err);
        if (errorMsg) {
          errorMsg.textContent = "Invalid account credentials. Please check your details.";
          errorMsg.style.display = "block";
        }
      });
  }
}

function logoutUser() {
  auth.signOut().then(() => {
    window.location.reload();
  });
}

// --- Single Unified Auth State Change Listener ---
auth.onAuthStateChanged((user) => {
  if (user) {
    currentUser = user;
    document.getElementById("authScreen")?.classList.add("hidden");
    document.getElementById("introScreen")?.classList.add("hidden");
    document.getElementById("appMain")?.classList.add("visible");

    // Retrieve display name from Firebase profile or Realtime Database
    db.ref("users/" + user.uid + "/settings/displayName").once("value").then((snapshot) => {
      const dbName = snapshot.val();
      const finalName = user.displayName || dbName || "Student";
      updateHeaderDisplayName(finalName);
    });

    updateTimeGreeting();
    updateMonthPill();
    initChart();
    loadUserData();
  } else {
    currentUser = null;
    document.getElementById("appMain")?.classList.remove("visible");

    if (userInitiatedAuth) {
      document.getElementById("introScreen")?.classList.add("hidden");
      document.getElementById("authScreen")?.classList.remove("hidden");
    } else {
      document.getElementById("introScreen")?.classList.remove("hidden");
      document.getElementById("authScreen")?.classList.add("hidden");
    }
  }
});

// --- Data Synchronization ---
function loadUserData() {
  if (!currentUser) return;

  const userRef = db.ref("users/" + currentUser.uid);

  userRef.on("value", (snapshot) => {
    const data = snapshot.val() || {};
    const settings = data.settings || {};

    currentData.monthlyBudget = parseFloat(settings.monthlyBudget) || 25000;
    currentData.additionalFunds = parseFloat(settings.additionalFunds) || 0;
    currentData.defaultBreakfast = parseFloat(settings.defaultBreakfast) || 150;
    currentData.defaultLunch = parseFloat(settings.defaultLunch) || 250;
    currentData.defaultDinner = parseFloat(settings.defaultDinner) || 200;

    currentData.todayLogs = data.todayLogs ? Object.values(data.todayLogs) : [];
    currentData.summaryLogs = data.summaryLogs ? Object.values(data.summaryLogs) : [];

    if (document.getElementById("monthlyBudgetInput")) {
      document.getElementById("monthlyBudgetInput").value = currentData.monthlyBudget;
    }
    if (document.getElementById("defaultBreakfast")) {
      document.getElementById("defaultBreakfast").value = currentData.defaultBreakfast;
    }
    if (document.getElementById("defaultLunch")) {
      document.getElementById("defaultLunch").value = currentData.defaultLunch;
    }
    if (document.getElementById("defaultDinner")) {
      document.getElementById("defaultDinner").value = currentData.defaultDinner;
    }

    updateMonthPill();
    refreshUI();
  }, (error) => {
    console.error("Firebase read failed:", error);
    updateMonthPill();
    refreshUI();
  });
}

// --- Calculation Helper Functions ---
function calculateTotalSpent() {
  let todaySpent = currentData.todayLogs.reduce((acc, log) => acc + parseFloat(log.amount || 0), 0);
  let historicalSpent = currentData.summaryLogs.reduce((acc, log) => acc + parseFloat(log.dailyTotalSpent || 0), 0);
  return todaySpent + historicalSpent;
}

function calculateCategoryTotals() {
  let totals = { Breakfast: 0, Lunch: 0, Dinner: 0, Other: 0 };

  currentData.todayLogs.forEach((log) => {
    if (totals[log.category] !== undefined) {
      totals[log.category] += parseFloat(log.amount || 0);
    } else {
      totals.Other += parseFloat(log.amount || 0);
    }
  });

  return totals;
}

// --- UI Refresh Engine ---
function refreshUI() {
  const monthlyAllocation = currentData.monthlyBudget || 0;
  const additionalFunds = currentData.additionalFunds || 0;
  const totalPoolBudget = monthlyAllocation + additionalFunds;
  const spent = calculateTotalSpent();
  const remaining = totalPoolBudget - spent;

  let remainingRatio = 0;
  if (monthlyAllocation > 0) {
    remainingRatio = Math.round((remaining / monthlyAllocation) * 100);
    remainingRatio = Math.max(0, remainingRatio);
  }

  if (document.getElementById("remainingBalanceText")) {
    document.getElementById("remainingBalanceText").textContent = `Rs. ${remaining.toFixed(2)}`;
  }
  if (document.getElementById("budgetRatioText")) {
    document.getElementById("budgetRatioText").textContent = `${remainingRatio}%`;
  }

  const levelBar = document.getElementById("budgetLevelBar");
  const statusChip = document.getElementById("budgetStatusChip");

  if (levelBar) levelBar.style.width = `${Math.min(100, remainingRatio)}%`;

  if (statusChip && levelBar) {
    if (remainingRatio < 15) {
      levelBar.style.background = "var(--status-red)";
      statusChip.textContent = "CRITICAL";
      statusChip.className = "status-chip bad";
    } else if (remainingRatio < 40) {
      levelBar.style.background = "var(--status-yellow)";
      statusChip.textContent = "WARNING";
      statusChip.className = "status-chip better";
    } else {
      levelBar.style.background = "linear-gradient(90deg, #38bdf8 0%, #1e40af 50%, #e5c158 100%)";
      statusChip.textContent = "HEALTHY";
      statusChip.className = "status-chip";
    }
  }

  if (document.getElementById("statTotalBudget")) {
    document.getElementById("statTotalBudget").textContent = `Rs. ${totalPoolBudget.toFixed(2)}`;
  }
  if (document.getElementById("statAddedFunds")) {
    document.getElementById("statAddedFunds").textContent = `Rs. ${additionalFunds.toFixed(2)}`;
  }

  if (document.getElementById("statDailyAvg")) {
    const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
    const dailyAllowance = Math.max(0, remaining / daysInMonth);
    document.getElementById("statDailyAvg").textContent = `Rs. ${dailyAllowance.toFixed(2)}/day`;
  }

  if (document.getElementById("totalSpentText")) {
    document.getElementById("totalSpentText").innerHTML = `<span>Rs.</span>${spent.toFixed(0)}`;
  }
  
  const todaySpent = currentData.todayLogs.reduce((acc, log) => acc + parseFloat(log.amount || 0), 0);
  if (document.getElementById("todaySpentText")) {
    document.getElementById("todaySpentText").innerHTML = `<span>Rs.</span>${todaySpent.toFixed(0)}`;
  }

  const otherSpent = currentData.todayLogs
    .filter((log) => log.category === "Other")
    .reduce((acc, log) => acc + parseFloat(log.amount || 0), 0);
  if (document.getElementById("otherSpentText")) {
    document.getElementById("otherSpentText").innerHTML = `<span>Rs.</span>${otherSpent.toFixed(0)}`;
  }

  if (document.getElementById("spentMiniBar")) {
    document.getElementById("spentMiniBar").style.width = `${Math.min(100, (spent / (totalPoolBudget || 1)) * 100)}%`;
  }
  if (document.getElementById("todayMiniBar")) {
    document.getElementById("todayMiniBar").style.width = `${Math.min(100, (todaySpent / (currentData.defaultBreakfast + currentData.defaultLunch + currentData.defaultDinner || 1)) * 100)}%`;
  }
  if (document.getElementById("otherMiniBar")) {
    document.getElementById("otherMiniBar").style.width = `${Math.min(100, (otherSpent / (totalPoolBudget || 1)) * 100)}%`;
  }

  renderTodayLedger();
  renderSummaryLedger();
  updateChartData();
}

// --- Ledger Tables Rendering ---
function renderTodayLedger() {
  const tbody = document.getElementById("todayLedgerTableBody");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (currentData.todayLogs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty-msg">No transactions logged today.</td></tr>`;
    return;
  }

  let runningSpent = 0;
  const totalPoolBudget = (currentData.monthlyBudget || 0) + (currentData.additionalFunds || 0);
  const initialBalance = totalPoolBudget - calculateTotalSpent() + currentData.todayLogs.reduce((a, b) => a + parseFloat(b.amount || 0), 0);

  currentData.todayLogs.forEach((log) => {
    runningSpent += parseFloat(log.amount || 0);
    const rem = initialBalance - runningSpent;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${log.time || "--:--"}</td>
      <td>${log.category}</td>
      <td>${log.name}</td>
      <td>Rs. ${parseFloat(log.amount).toFixed(2)}</td>
      <td>Rs. ${rem.toFixed(2)}</td>
    `;
    tbody.appendChild(tr);
  });
}

function renderSummaryLedger() {
  const tbody = document.getElementById("summaryLedgerTableBody");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (currentData.summaryLogs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="empty-msg">No historical days closed yet.</td></tr>`;
    return;
  }

  currentData.summaryLogs.forEach((log) => {
    const tr = document.createElement("tr");
    tr.className = "summary-row";
    tr.innerHTML = `
      <td>${log.date}</td>
      <td>CLOSED</td>
      <td>Rs. ${parseFloat(log.dailyTotalSpent).toFixed(2)}</td>
      <td>Rs. ${parseFloat(log.remainingBalance).toFixed(2)}</td>
    `;
    tbody.appendChild(tr);
  });
}

// --- Chart.js Data Initialization ---
function initChart() {
  const canvas = document.getElementById("expenseChart");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  if (expenseChart) expenseChart.destroy();

  expenseChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Breakfast", "Lunch", "Dinner", "Other"],
      datasets: [{
        data: [0, 0, 0, 0],
        backgroundColor: [
          "#e5c158",
          "#2563eb",
          "#10b981",
          "#f43f5e"
        ],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      animation: false,
      plugins: {
        legend: {
          labels: {
            color: "#f8fafc",
            font: {
              family: "'Cinzel', serif",
              size: 13
            }
          }
        }
      }
    }
  });
}

function updateChartData() {
  if (!expenseChart) return;

  const totals = calculateCategoryTotals();
  expenseChart.data.datasets[0].data = [
    totals.Breakfast,
    totals.Lunch,
    totals.Dinner,
    totals.Other
  ];
  expenseChart.update();
}

// --- Action Functions ---
function toggleMealOptions() {
  const typeSelect = document.getElementById("expenseTypeSelect");
  const nameInput = document.getElementById("expenseNameInput");
  const amountInput = document.getElementById("expenseAmountInput");

  if (!typeSelect || !nameInput || !amountInput) return;

  const val = typeSelect.value;
  if (val === "Breakfast") {
    nameInput.value = "Morning Breakfast";
    amountInput.value = currentData.defaultBreakfast;
  } else if (val === "Lunch") {
    nameInput.value = "Afternoon Lunch";
    amountInput.value = currentData.defaultLunch;
  } else if (val === "Dinner") {
    nameInput.value = "Night Dinner";
    amountInput.value = currentData.defaultDinner;
  } else {
    nameInput.value = "General Expense";
    amountInput.value = "100";
  }
}

function updateAllocations() {
  const mb = parseFloat(document.getElementById("monthlyBudgetInput")?.value);
  const dbf = parseFloat(document.getElementById("defaultBreakfast")?.value);
  const dl = parseFloat(document.getElementById("defaultLunch")?.value);
  const dd = parseFloat(document.getElementById("defaultDinner")?.value);

  if (isNaN(mb) || isNaN(dbf) || isNaN(dl) || isNaN(dd)) {
    alert("Please enter valid numerical values.");
    return;
  }

  currentData.monthlyBudget = mb;
  currentData.defaultBreakfast = dbf;
  currentData.defaultLunch = dl;
  currentData.defaultDinner = dd;

  if (currentUser) {
    db.ref("users/" + currentUser.uid + "/settings").update({
      monthlyBudget: mb,
      defaultBreakfast: dbf,
      defaultLunch: dl,
      defaultDinner: dd
    }).then(() => alert("Allocations updated successfully!"));
  }
}

function addAdditionalMoney() {
  const addInput = document.getElementById("additionalMoneyInput");
  const amount = parseFloat(addInput?.value);

  if (isNaN(amount) || amount <= 0) {
    alert("Please enter a valid amount to add.");
    return;
  }

  const newAdditional = (currentData.additionalFunds || 0) + amount;

  if (addInput) addInput.value = "";

  if (currentUser) {
    db.ref("users/" + currentUser.uid + "/settings").update({
      additionalFunds: newAdditional
    }).then(() => {
      alert(`Successfully added Rs. ${amount.toFixed(2)} to your balance!`);
    }).catch((error) => console.error("Firebase update failed:", error));
  } else {
    currentData.additionalFunds = newAdditional;
    refreshUI();
  }
}

function addExpense() {
  const typeSelect = document.getElementById("expenseTypeSelect");
  const nameInput = document.getElementById("expenseNameInput");
  const amountInput = document.getElementById("expenseAmountInput");

  if (!typeSelect || !nameInput || !amountInput) return;

  const type = typeSelect.value;
  const name = nameInput.value.trim();
  const amount = parseFloat(amountInput.value);

  if (!name || isNaN(amount) || amount <= 0) {
    alert("Please enter a valid expense description and amount.");
    return;
  }

  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const logEntry = {
    category: type,
    name: name,
    amount: amount,
    time: timeStr,
    timestamp: Date.now()
  };

  if (currentUser) {
    db.ref("users/" + currentUser.uid + "/todayLogs").push(logEntry);
  }
}

function endDayRoutine() {
  if (currentData.todayLogs.length === 0) {
    alert("No expenses recorded today to complete.");
    return;
  }

  if (!confirm("Are you sure you want to complete and end today's routine? Today's active monitor will reset.")) {
    return;
  }

  const todaySpent = currentData.todayLogs.reduce((acc, log) => acc + parseFloat(log.amount || 0), 0);
  const totalPoolBudget = (currentData.monthlyBudget || 0) + (currentData.additionalFunds || 0);
  const remaining = totalPoolBudget - calculateTotalSpent();
  const todayDate = new Date().toLocaleDateString();

  const summaryEntry = {
    date: todayDate,
    dailyTotalSpent: todaySpent,
    remainingBalance: remaining,
    timestamp: Date.now()
  };

  if (currentUser) {
    const userRef = db.ref("users/" + currentUser.uid);
    userRef.child("summaryLogs").push(summaryEntry).then(() => {
      return userRef.child("todayLogs").remove();
    }).then(() => {
      alert("Today's routine completed successfully!");
    });
  }
}

// Mobile Navigation Toggle logic
function toggleMobileMenu() {
  const menuWrapper = document.getElementById("sidebarMenu");
  if (menuWrapper) {
    menuWrapper.classList.toggle("show");
  }
}

// Global Event Listeners Initialization
document.addEventListener("DOMContentLoaded", () => {
  updateTimeGreeting();
  updateMonthPill();

  document.querySelectorAll(".sidebar .nav-item").forEach((item) => {
    item.addEventListener("click", () => {
      document.querySelectorAll(".sidebar .nav-item").forEach((i) => i.classList.remove("active"));
      item.classList.add("active");

      const sectionId = item.getAttribute("data-section");
      const section = document.getElementById(sectionId);
      if (section) {
        section.scrollIntoView({ behavior: "smooth" });
      }

      const menuWrapper = document.getElementById("sidebarMenu");
      if (menuWrapper && window.innerWidth <= 900) {
        menuWrapper.classList.remove("show");
      }
    });
  });
});
