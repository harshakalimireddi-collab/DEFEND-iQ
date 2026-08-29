const initSqlJs = require("sql.js")
const fs = require("fs")
const path = require("path")
const bcrypt = require("bcryptjs")
const { nanoid } = require("nanoid")
const readline = require("readline")

const dbPath = path.join(__dirname, "data", "soc-beacon.db")
const passwordsFilePath = path.join(__dirname, "data", "demo-passwords.json")

function getStoredPasswords() {
  try {
    if (fs.existsSync(passwordsFilePath)) {
      return JSON.parse(fs.readFileSync(passwordsFilePath, "utf8"))
    }
  } catch {}
  return {
    admin: "admin",
    defense_lead: "myadminpassword",
    client: "client123",
  }
}

function saveStoredPassword(username, password) {
  try {
    const passwords = getStoredPasswords()
    passwords[username.toLowerCase()] = password
    fs.writeFileSync(passwordsFilePath, JSON.stringify(passwords, null, 2), "utf8")
  } catch {}
}

function removeStoredPassword(username) {
  try {
    const passwords = getStoredPasswords()
    delete passwords[username.toLowerCase()]
    fs.writeFileSync(passwordsFilePath, JSON.stringify(passwords, null, 2), "utf8")
  } catch {}
}

async function getDbInstance() {
  const SQL = await initSqlJs()
  if (!fs.existsSync(dbPath)) {
    console.error("Database file not found at " + dbPath)
    process.exit(1)
  }
  const fileBuffer = fs.readFileSync(dbPath)
  return { SQL, db: new SQL.Database(fileBuffer) }
}

function saveDbInstance(db) {
  const data = db.export()
  fs.writeFileSync(dbPath, Buffer.from(data))
}

function stmtToObjects(db, sql, params = []) {
  const stmt = db.prepare(sql)
  if (params.length) stmt.bind(params)
  const results = []
  while (stmt.step()) {
    results.push(stmt.getAsObject())
  }
  stmt.free()
  return results
}

function ask(questionText) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })
  return new Promise((resolve) => {
    rl.question(questionText, (answer) => {
      rl.close()
      resolve(answer.trim())
    })
  })
}

async function listUsers() {
  const { db } = await getDbInstance()
  const users = stmtToObjects(db, "SELECT id, username, role, created_at FROM users ORDER BY role, username")
  const storedPasswords = getStoredPasswords()

  const formattedUsers = users.map((u) => ({
    Username: u.username,
    Role: u.role,
    Password: storedPasswords[String(u.username).toLowerCase()] || "(Hash in DB)",
    "Created At": u.created_at || "N/A",
  }))

  console.log("\n================ CURRENT USERS & ROLES ================")
  if (formattedUsers.length === 0) {
    console.log("No users found.")
  } else {
    console.table(formattedUsers)
  }
  console.log("========================================================\n")
}

async function createUser(username, password, role = "admin") {
  const r = String(role).toLowerCase()
  let validRole = "admin"
  if (r === "analyst" || r === "2") validRole = "analyst"
  if (r === "client" || r === "3") validRole = "client"

  const cleanUsername = username.trim().toLowerCase()
  const cleanPassword = password.trim()

  const { db } = await getDbInstance()
  const existing = stmtToObjects(db, "SELECT id FROM users WHERE username = ?", [cleanUsername])
  if (existing.length > 0) {
    console.log(`\n❌ Error: User "${cleanUsername}" already exists.`)
    return
  }

  const id = nanoid()
  const hash = bcrypt.hashSync(cleanPassword, 10)

  db.run("INSERT INTO users (id, username, password_hash, role) VALUES (?, ?, ?, ?)", [
    id,
    cleanUsername,
    hash,
    validRole,
  ])
  saveDbInstance(db)
  saveStoredPassword(cleanUsername, cleanPassword)

  console.log(`\n✅ [SUCCESS] Created new user:`)
  console.log(`   - Username: ${cleanUsername}`)
  console.log(`   - Role:     ${validRole}`)
  console.log(`   - Password: ${cleanPassword}\n`)
}

async function setPassword(username, newPassword) {
  const cleanUsername = username.trim().toLowerCase()
  const cleanPassword = newPassword.trim()
  const { db } = await getDbInstance()
  const existing = stmtToObjects(db, "SELECT id FROM users WHERE username = ?", [cleanUsername])

  if (existing.length === 0) {
    console.log(`\nUser "${cleanUsername}" does not exist. Creating it now...`)
    await createUser(cleanUsername, cleanPassword, "admin")
    return
  }

  const hash = bcrypt.hashSync(cleanPassword, 10)
  db.run("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE username = ?", [
    hash,
    cleanUsername,
  ])
  saveDbInstance(db)
  saveStoredPassword(cleanUsername, cleanPassword)

  console.log(`\n✅ [SUCCESS] Password updated for user "${cleanUsername}" to: "${cleanPassword}"\n`)
}

async function setRole(username, role) {
  const cleanUsername = username.trim().toLowerCase()
  const r = String(role).toLowerCase()
  let validRole = "admin"
  if (r === "analyst" || r === "2") validRole = "analyst"
  if (r === "client" || r === "3") validRole = "client"

  const { db } = await getDbInstance()
  const existing = stmtToObjects(db, "SELECT id FROM users WHERE username = ?", [cleanUsername])
  if (existing.length === 0) {
    console.log(`\n❌ Error: User "${cleanUsername}" does not exist.\n`)
    return
  }

  db.run("UPDATE users SET role = ? WHERE username = ?", [validRole, cleanUsername])
  saveDbInstance(db)

  console.log(`\n✅ [SUCCESS] Updated role for "${cleanUsername}" to: "${validRole}"\n`)
}

async function deleteUser(username) {
  const cleanUsername = username.trim().toLowerCase()
  const { db } = await getDbInstance()
  const existing = stmtToObjects(db, "SELECT id, role FROM users WHERE username = ?", [cleanUsername])

  if (existing.length === 0) {
    console.log(`\n❌ Error: User "${cleanUsername}" does not exist.\n`)
    return
  }

  db.run("DELETE FROM users WHERE username = ?", [cleanUsername])
  saveDbInstance(db)
  removeStoredPassword(cleanUsername)

  console.log(`\n✅ [SUCCESS] Deleted user "${cleanUsername}".\n`)
}

async function interactiveMenu() {
  while (true) {
    console.log("\n=============================================")
    console.log("   🛡️  SOC BEACON - USER MANAGEMENT MENU")
    console.log("=============================================")
    console.log("1. ➕ Create New User (Admin, Analyst, or Client)")
    console.log("2. 🔑 Change / Reset a User Password")
    console.log("3. 🔄 Change a User Role (Admin, Analyst, Client)")
    console.log("4. 📋 List All Users, Roles & Passwords")
    console.log("5. 🗑️  Delete a User")
    console.log("6. 🚪 Exit")
    console.log("=============================================")

    const choice = await ask("Select an option (1-6): ")

    switch (choice) {
      case "1": {
        console.log("\n--- Create New User ---")
        let username = await ask("Enter Username: ")
        while (!username) {
          username = await ask("Username cannot be empty. Enter Username: ")
        }

        let password = await ask("Enter Password: ")
        while (!password) {
          password = await ask("Password cannot be empty. Enter Password: ")
        }

        console.log("\nSelect Role:")
        console.log("1. Admin   (Master Command & Full System Control)")
        console.log("2. Analyst (Cyber Threat Triage & Investigation)")
        console.log("3. Client  (Defense Submitter / Cyber Attack Uploader)")
        const roleChoice = await ask("Choose role [1=Admin, 2=Analyst, 3=Client] (default 1): ")
        let role = "admin"
        if (roleChoice === "2") role = "analyst"
        if (roleChoice === "3") role = "client"

        await createUser(username, password, role)
        break
      }

      case "2": {
        console.log("\n--- Change User Password ---")
        let username = await ask("Enter Username to change password for: ")
        while (!username) {
          username = await ask("Username cannot be empty. Enter Username: ")
        }

        let newPassword = await ask("Enter New Password: ")
        while (!newPassword) {
          newPassword = await ask("Password cannot be empty. Enter New Password: ")
        }

        await setPassword(username, newPassword)
        break
      }

      case "3": {
        console.log("\n--- Change User Role ---")
        let username = await ask("Enter Username to change role for: ")
        while (!username) {
          username = await ask("Username cannot be empty. Enter Username: ")
        }

        console.log("\nSelect New Role:")
        console.log("1. Admin   (Master Command & Full System Control)")
        console.log("2. Analyst (Cyber Threat Triage & Investigation)")
        console.log("3. Client  (Defense Submitter / Cyber Attack Uploader)")
        const roleChoice = await ask("Choose role [1=Admin, 2=Analyst, 3=Client]: ")
        let role = "admin"
        if (roleChoice === "2") role = "analyst"
        if (roleChoice === "3") role = "client"

        await setRole(username, role)
        break
      }

      case "4": {
        await listUsers()
        break
      }

      case "5": {
        console.log("\n--- Delete User ---")
        let username = await ask("Enter Username to delete: ")
        if (username) {
          const confirm = await ask(`Are you sure you want to delete "${username}"? (y/n): `)
          if (confirm.toLowerCase() === "y") {
            await deleteUser(username)
          } else {
            console.log("Cancelled.")
          }
        }
        break
      }

      case "6":
        console.log("Goodbye!\n")
        process.exit(0)

      default:
        console.log("Invalid option selected. Choose 1-6.")
        break
    }
  }
}

async function main() {
  const args = process.argv.slice(2)
  if (args.length === 0) {
    await interactiveMenu()
  } else {
    const command = args[0].toLowerCase()
    switch (command) {
      case "list":
        await listUsers()
        break
      case "create": {
        let username = args[1] || (await ask("Enter Username: "))
        let password = args[2] || (await ask("Enter Password: "))
        let role = args[3] || (await ask("Enter Role (admin/analyst/client, default admin): ")) || "admin"
        await createUser(username, password, role)
        break
      }
      case "set-role": {
        let username = args[1] || (await ask("Enter Username: "))
        let role = args[2] || (await ask("Enter Role (admin/analyst/client): "))
        await setRole(username, role)
        break
      }
      case "set-password":
      case "reset": {
        let username = args[1] || (await ask("Enter Username: "))
        let newPassword = args[2] || (await ask("Enter New Password: "))
        await setPassword(username, newPassword)
        break
      }
      case "delete": {
        let username = args[1] || (await ask("Enter Username to delete: "))
        await deleteUser(username)
        break
      }
      default:
        await interactiveMenu()
        break
    }
  }
}

main().catch(console.error)
