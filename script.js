/* ============================================================
   GLOBALS
============================================================ */
let currentUser = null;
let income = {};
let bills = [];
let groceries = [];
let theme = "light";

const db = firebase.firestore(); // Firestore handle

/* ============================================================
   AUTH: SIGNUP / LOGIN / LOGOUT / FORGOT PASSWORD
============================================================ */

// SIGN UP
document.getElementById("signup-btn").onclick = async () => {
  const email = document.getElementById("signup-email").value;
  const pass = document.getElementById("signup-password").value;

  try {
    await auth.createUserWithEmailAndPassword(email, pass);
    alert("Account created!");
  } catch (err) {
    alert(err.message);
  }
};

// LOGIN
document.getElementById("login-btn").onclick = async () => {
  const email = document.getElementById("login-email").value;
  const pass = document.getElementById("login-password").value;

  try {
    await auth.signInWithEmailAndPassword(email, pass);
    alert("Logged in!");
  } catch (err) {
    alert(err.message);
  }
};

// LOGOUT
document.getElementById("logout-btn").onclick = async () => {
  await auth.signOut();
};

// FORGOT PASSWORD
document.getElementById("forgot-btn").onclick = async () => {
  const email =
    document.getElementById("login-email").value ||
    document.getElementById("signup-email").value;

  if (!email) {
    alert("Please type your email in one of the email fields first.");
    return;
  }

  try {
    await auth.sendPasswordResetEmail(email);
    alert("Password reset email sent.");
  } catch (err) {
    alert(err.message);
  }
};

/* ============================================================
   FIREBASE LOAD / SAVE HELPERS
============================================================ */

// ---- Income ----
async function loadIncomeFromDb() {
  const doc = await db
    .collection("users")
    .doc(currentUser.uid)
    .collection("settings")
    .doc("income")
    .get();

  if (doc.exists) {
    income = doc.data();
  } else {
    income = {};
  }
}

async function saveIncomeToDb() {
  if (!currentUser) return;
  await db
    .collection("users")
    .doc(currentUser.uid)
    .collection("settings")
    .doc("income")
    .set(income);
}

// ---- Theme ----
async function loadThemeFromDb() {
  const doc = await db
    .collection("users")
    .doc(currentUser.uid)
    .collection("settings")
    .doc("theme")
    .get();

  if (doc.exists) {
    theme = doc.data().mode || "light";
  } else {
    theme = "light";
  }
}

async function saveThemeToDb() {
  if (!currentUser) return;
  await db
    .collection("users")
    .doc(currentUser.uid)
    .collection("settings")
    .doc("theme")
    .set({ mode: theme });
}

// ---- Bills ----
async function loadBillsFromDb() {
  bills = [];
  const snap = await db
    .collection("users")
    .doc(currentUser.uid)
    .collection("bills")
    .get();

  snap.forEach((doc) => {
    bills.push({ id: doc.id, ...doc.data() });
  });
}

async function addBillToDb(bill) {
  const ref = await db
    .collection("users")
    .doc(currentUser.uid)
    .collection("bills")
    .add(bill);
  bill.id = ref.id;
  bills.push(bill);
}

async function updateBillInDb(bill) {
  await db
    .collection("users")
    .doc(currentUser.uid)
    .collection("bills")
    .doc(bill.id)
    .set(bill);
}

async function deleteBillFromDb(bill) {
  await db
    .collection("users")
    .doc(currentUser.uid)
    .collection("bills")
    .doc(bill.id)
    .delete();

  bills = bills.filter((b) => b.id !== bill.id);
}

// ---- Groceries ----
async function loadGroceriesFromDb() {
  groceries = [];
  const snap = await db
    .collection("users")
    .doc(currentUser.uid)
    .collection("groceries")
    .get();

  snap.forEach((doc) => {
    groceries.push({ id: doc.id, ...doc.data() });
  });
}

async function addGroceryToDb(g) {
  const ref = await db
    .collection("users")
    .doc(currentUser.uid)
    .collection("groceries")
    .add(g);
  g.id = ref.id;
  groceries.push(g);
}

async function deleteGroceryFromDb(g) {
  await db
    .collection("users")
    .doc(currentUser.uid)
    .collection("groceries")
    .doc(g.id)
    .delete();

  groceries = groceries.filter((x) => x.id !== g.id);
}

async function clearGroceriesInDb() {
  const collectionRef = db
    .collection("users")
    .doc(currentUser.uid)
    .collection("groceries");

  const snap = await collectionRef.get();
  const batch = db.batch();
  snap.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();
  groceries = [];
}

/* ============================================================
   AUTH STATE LISTENER
============================================================ */

auth.onAuthStateChanged(async (user) => {
  currentUser = user;

  if (user) {
    // Show app, hide auth
    document.getElementById("signup-box").style.display = "none";
    document.getElementById("login-box").style.display = "none";
    document.getElementById("logout-btn").style.display = "block";
    document.getElementById("app-content").style.display = "block";

    // Load all data from Firestore
    await Promise.all([
      loadIncomeFromDb(),
      loadBillsFromDb(),
      loadGroceriesFromDb(),
      loadThemeFromDb(),
    ]);

    updateMonthlyIncomeBox();
    displayBills();
    displayGroceries();
    applyTheme();
  } else {
    // Show auth, hide app
    document.getElementById("signup-box").style.display = "block";
    document.getElementById("login-box").style.display = "block";
    document.getElementById("logout-btn").style.display = "none";
    document.getElementById("app-content").style.display = "none";

    bills = [];
    groceries = [];
    income = {};
  }
});

/* ============================================================
   DARK MODE
============================================================ */

document.getElementById("theme-toggle").onclick = async () => {
  theme = theme === "dark" ? "light" : "dark";
  applyTheme();
  await saveThemeToDb();
};

function applyTheme() {
  if (theme === "dark") {
    document.body.classList.add("dark");
  } else {
    document.body.classList.remove("dark");
  }
}

/* ============================================================
   INCOME
============================================================ */

function calculateMonthlyIncome(salary, frequency) {
  frequency = frequency.toLowerCase();
  if (frequency === "weekly") return salary * (52 / 12);
  if (frequency === "biweekly") return salary * (26 / 12);
  return salary;
}

function updateMonthlyIncomeBox() {
  if (!income.salary || !income.frequency) return;
  const monthlyIncome = calculateMonthlyIncome(income.salary, income.frequency);
  document.getElementById("monthly-income-display").textContent =
    `Monthly Income: $${monthlyIncome.toFixed(2)}`;
}

document.getElementById("save-income").addEventListener("click", async () => {
  const salary = parseFloat(document.getElementById("salary").value);
  const frequency = document.getElementById("salary-frequency").value;

  if (isNaN(salary)) {
    alert("Please enter your salary.");
    return;
  }

  income = { salary, frequency };
  await saveIncomeToDb();
  updateMonthlyIncomeBox();
  alert("Income saved!");
});

/* ============================================================
   BILLS
============================================================ */

// Add a bill
document.getElementById("add-bill").addEventListener("click", async () => {
  if (!currentUser) {
    alert("Please log in first.");
    return;
  }

  const name = document.getElementById("bill-name").value.trim();
  const amount = parseFloat(document.getElementById("bill-amount").value);
  const dueDate = document.getElementById("bill-due-date").value;
  const frequency = document.getElementById("bill-frequency").value;
  const priority = Number(document.getElementById("bill-priority").value);

  if (!name || isNaN(amount) || !dueDate) {
    alert("Please fill in all bill details.");
    return;
  }

  const bill = { name, amount, dueDate, frequency, priority };
  await addBillToDb(bill);
  displayBills();

  // Clear fields
  document.getElementById("bill-name").value = "";
  document.getElementById("bill-amount").value = "";
  document.getElementById("bill-due-date").value = "";
});

// Helper: days until due
function daysUntilDue(dateString) {
  const today = new Date();
  const due = new Date(dateString);

  const diffTime = due - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return "Past due";
  if (diffDays === 0) return "Due today";

  return `${diffDays} days left`;
}

// Display bills
function displayBills() {
  const list = document.getElementById("bills-list");
  if (!list) return;

  list.innerHTML = "";

  const sorted = [...bills].sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return a.dueDate.localeCompare(b.dueDate);
  });

  sorted.forEach((bill) => {
    const li = document.createElement("li");
    li.classList.add("bill-row");

    const colorStrip = document.createElement("div");
    colorStrip.classList.add(
      bill.priority === 1 ? "high-strip" :
      bill.priority === 2 ? "medium-strip" : "low-strip"
    );

    const info = document.createElement("div");
    info.classList.add("bill-info");
    info.innerHTML = `
      <strong>${bill.name}</strong>
      <span>$${bill.amount}</span>
      <span>Due: ${bill.dueDate}</span>
      <span class="due-days">${daysUntilDue(bill.dueDate)}</span>
    `;

    const editBtn = document.createElement("button");
    editBtn.innerHTML = "✏️";
    editBtn.classList.add("update-btn");
    editBtn.onclick = () => openUpdateForm(bill);

    const deleteBtn = document.createElement("button");
    deleteBtn.innerHTML = "🗑️";
    deleteBtn.classList.add("delete-btn");
    deleteBtn.onclick = async () => {
      await deleteBillFromDb(bill);
      displayBills();
    };

    const btnBox = document.createElement("div");
    btnBox.classList.add("bill-buttons");
    btnBox.appendChild(editBtn);
    btnBox.appendChild(deleteBtn);

    li.appendChild(colorStrip);
    li.appendChild(info);
    li.appendChild(btnBox);

    list.appendChild(li);
  });
}

/* ============================================================
   UPDATE BILL POPUP
============================================================ */

function openUpdateForm(bill) {
  document.getElementById("update-name").value = bill.name;
  document.getElementById("update-amount").value = bill.amount;
  document.getElementById("update-due").value = bill.dueDate;
  document.getElementById("update-frequency").value = bill.frequency;
  document.getElementById("update-priority").value = bill.priority;

  document.getElementById("update-popup").classList.remove("hidden");

  document.getElementById("save-update").onclick = async function () {
    bill.name = document.getElementById("update-name").value;
    bill.amount = parseFloat(document.getElementById("update-amount").value);
    bill.dueDate = document.getElementById("update-due").value;
    bill.frequency = document.getElementById("update-frequency").value;
    bill.priority = parseInt(
      document.getElementById("update-priority").value,
      10
    );

    await updateBillInDb(bill);
    displayBills();
    closePopup();
  };

  document.getElementById("cancel-update").onclick = closePopup;
}

function closePopup() {
  document.getElementById("update-popup").classList.add("hidden");
}

/* ============================================================
   GROCERIES
============================================================ */

document.getElementById("add-grocery").onclick = async () => {
  if (!currentUser) {
    alert("Please log in first.");
    return;
  }

  const qty = document.getElementById("grocery-qty").value.trim();
  const unit = document.getElementById("grocery-unit").value.trim();
  const item = document.getElementById("grocery-item").value.trim();
  const category = document.getElementById("grocery-category").value;

  if (!qty || !item) {
    alert("Please enter at least quantity and item name.");
    return;
  }

  const text = `${qty}${unit ? unit : ""} ${item}`.trim();
  const grocery = { text, category };

  await addGroceryToDb(grocery);
  displayGroceries();

  document.getElementById("grocery-qty").value = 1;
  document.getElementById("grocery-unit").value = "";
  document.getElementById("grocery-item").value = "";
  document.getElementById("grocery-category").value = "Other";
};

function displayGroceries() {
  const list = document.getElementById("grocery-list");
  if (!list) return;

  list.innerHTML = "";

  groceries.forEach((g) => {
    const li = document.createElement("li");
    li.textContent = g.text;

    const delBtn = document.createElement("button");
    delBtn.textContent = "🗑️";
    delBtn.classList.add("delete-btn");

    delBtn.onclick = async () => {
      await deleteGroceryFromDb(g);
      displayGroceries();
    };

    li.appendChild(delBtn);
    list.appendChild(li);
  });
}

document.getElementById("clear-groceries").onclick = async () => {
  if (!currentUser) {
    alert("Please log in first.");
    return;
  }
  if (confirm("Clear your entire grocery list?")) {
    await clearGroceriesInDb();
    displayGroceries();
  }
};
