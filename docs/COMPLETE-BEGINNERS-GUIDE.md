# Complete Beginner's Guide

## Detroit Memorial Park Cemetery Management System

*Everything you need to know to run and understand this application — no prior experience required.*

---

## Quick Reference (For Returning Users)

> **Already set up? Here's the daily startup sequence:**

| Step | Command                        |
| ---- | ------------------------------ |
| 1    | Open **PowerShell**            |
| 2    | `cd C:\Users\ChristianHug_hhxqjwq\dev\dmpgrants` |
| 3    | `docker-compose up -d`         |
| 4    | `npm run server`               |
| 5    | Open **new** PowerShell window |
| 6    | `cd C:\Users\ChristianHug_hhxqjwq\dev\dmpgrants` |
| 7    | `npm run dev`                  |
| 8    | Open <http://localhost:5173>   |
| 9    | Login: `admin@dmp.com` / `admin123` |

---

## Table of Contents

1. [What Device Do I Need?](#1-what-device-do-i-need)
2. [Which Terminal App Should I Use?](#2-which-terminal-app-should-i-use)
3. [Understanding the Application](#3-understanding-the-application)
4. [Installing Required Software](#4-installing-required-software)
5. [First-Time Setup](#5-first-time-setup)
6. [Daily Startup](#6-daily-startup)
7. [Using the Application](#7-using-the-application)
8. [How It All Works](#8-how-it-all-works)
9. [Troubleshooting](#9-troubleshooting)
10. [Command Reference](#10-command-reference)
11. [Glossary](#11-glossary)

---

## 1. What Device Do I Need?

### Supported Operating Systems

This application can run on:

| Operating System | Supported? | Notes |
| ---------------- | ---------- | ----- |
| **Windows 10/11** | Yes | Primary development environment |
| **macOS** | Yes | Works with minor command differences |
| **Linux (Ubuntu, etc.)** | Yes | Works with minor command differences |
| **Chromebook** | No | Cannot run Docker |
| **iPad/Tablet** | No | Cannot run development tools |
| **Phone** | No | Cannot run development tools |

### Minimum Computer Requirements

| Component | Minimum | Recommended |
| --------- | ------- | ----------- |
| **RAM** | 8 GB | 16 GB |
| **Storage** | 10 GB free | 20 GB free |
| **Processor** | Any modern CPU | Intel i5/AMD Ryzen 5 or better |
| **Internet** | Required for setup | Required for setup |

### Which Device Is This Guide Written For?

**This guide is written for Windows 10/11** because that's what the development computer uses.

If you're using **macOS** or **Linux**, most commands are the same, but there are a few differences noted throughout this guide with special callout boxes.

---

## 2. Which Terminal App Should I Use?

### What Is a Terminal?

A **terminal** (also called command line, console, or shell) is a text-based way to control your computer. Instead of clicking icons, you type commands.

### Terminal Options on Windows

Windows has several terminal applications. Here's what each one is:

| Terminal App | What It Is | Should You Use It? |
| ------------ | ---------- | ------------------ |
| **PowerShell** | Modern Windows command line | **YES - Use this one** |
| **Windows Terminal** | Newer app that can run PowerShell | **YES - This is also good** |
| **Command Prompt (cmd)** | Old Windows command line | No - outdated |
| **Git Bash** | Unix-like terminal from Git | No - not needed |
| **WSL/Ubuntu** | Linux inside Windows | No - adds complexity |

### Recommendation: Use PowerShell

**For this guide, use PowerShell.** It comes pre-installed on Windows 10 and 11.

> **Why not WSL or Git Bash?**
> While these work, they use different file paths (like `/mnt/c/` instead of `C:\`) and can cause confusion. PowerShell uses native Windows paths, making everything simpler.

### How to Open PowerShell

**Method 1: Keyboard Shortcut (Fastest)**

1. Press `Windows key + X` (hold Windows key, tap X)
2. Click **Windows Terminal** or **Windows PowerShell**

**Method 2: Start Menu**

1. Click the **Start button** (Windows icon, bottom-left)
2. Type `powershell`
3. Click **Windows PowerShell**

**Method 3: Right-Click in File Explorer**

1. Open File Explorer
2. Navigate to any folder
3. Right-click in empty space
4. Click **Open in Terminal** or **Open PowerShell window here**

### What PowerShell Looks Like

When you open PowerShell, you'll see a window like this:

```
Windows PowerShell
Copyright (C) Microsoft Corporation. All rights reserved.

PS C:\Users\YourName>
```

The `PS C:\Users\YourName>` part is called the **prompt**. It shows:

- `PS` = You're in PowerShell
- `C:\Users\YourName` = Your current folder location
- `>` = Where you type commands

### Terminal Options on macOS

| Terminal App | What It Is | Should You Use It? |
| ------------ | ---------- | ------------------ |
| **Terminal** | Built-in macOS terminal | **YES - Use this one** |
| **iTerm2** | Popular third-party terminal | Yes - also good |

**How to open Terminal on Mac:**

1. Press `Cmd + Space` to open Spotlight
2. Type `terminal`
3. Press Enter

### Terminal Options on Linux

| Terminal App | What It Is | Should You Use It? |
| ------------ | ---------- | ------------------ |
| **Terminal/Konsole/GNOME Terminal** | Built-in terminal | **YES - Use this one** |

**How to open Terminal on Linux:**

1. Press `Ctrl + Alt + T`, or
2. Search for "Terminal" in your applications menu

---

## 3. Understanding the Application

### What Is This Application?

This is a **web application** — software that runs in your web browser (Chrome, Edge, Firefox, Safari). It helps Detroit Memorial Park manage cemetery operations:

- **Work Orders** — Track maintenance tasks and staff assignments
- **Burials** — Record and search burial information
- **Inventory** — Manage caskets, urns, markers, and supplies
- **Customers** — Maintain contact information and relationships
- **Contracts** — Handle pre-need and at-need agreements
- **Financials** — Deposits, invoicing, accounts receivable/payable

### How Web Applications Work

Think of it like a restaurant:

```
┌───────────────────────────────────────────────────────────────────────┐
│                                                                       │
│    YOU                    WAITER                   KITCHEN            │
│   (Browser)              (Server)                (Database)           │
│                                                                       │
│   ┌─────────┐           ┌─────────┐             ┌─────────┐          │
│   │         │  Request  │         │   Query     │         │          │
│   │ Chrome  │ ────────► │ Backend │ ──────────► │PostgreSQL│         │
│   │  Edge   │           │ Server  │             │         │          │
│   │ Firefox │ ◄──────── │         │ ◄────────── │  Data   │          │
│   │         │  Response │         │    Results  │ Storage │          │
│   └─────────┘           └─────────┘             └─────────┘          │
│                                                                       │
│   FRONTEND               BACKEND                  DATABASE            │
│   What you see           The brain               Where data lives     │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

**The three parts:**

- **Frontend** — The visual interface (buttons, forms, tables)
- **Backend** — The logic that processes requests and enforces rules
- **Database** — Permanent storage for all your data

---

## 4. Installing Required Software

Before running the application, you need to install some software. This is a one-time process.

### Required Software Checklist

| Software | Purpose | Status |
| -------- | ------- | ------ |
| **Node.js** | Runs JavaScript code | ☐ Not installed |
| **Docker Desktop** | Runs the database | ☐ Not installed |
| **Git** (optional) | Version control | ☐ Not installed |

### Installing Node.js

**What is Node.js?**
Node.js lets your computer run JavaScript code outside of a web browser. It's required to run this application.

#### Windows Installation

1. Open your web browser
2. Go to: **<https://nodejs.org>**
3. Click the **LTS** button (the one that says "Recommended For Most Users")
4. The installer will download (file named like `node-v20.x.x-x64.msi`)
5. Double-click the downloaded file
6. Click **Next** through the installer, accepting defaults
7. Click **Install** (you may need to enter your admin password)
8. Click **Finish**

#### macOS Installation

1. Open your web browser
2. Go to: **<https://nodejs.org>**
3. Click the **LTS** button
4. The installer will download (file named like `node-v20.x.x.pkg`)
5. Double-click the downloaded file
6. Follow the installer prompts
7. Enter your password when asked

#### Linux (Ubuntu/Debian) Installation

Open Terminal and run:

```bash
sudo apt update
sudo apt install nodejs npm
```

#### Verify Installation

Open a **new** terminal window (important — must be new!) and type:

```
node --version
```

You should see something like: `v20.11.0`

If you see an error like "command not found", restart your computer and try again.

### Installing Docker Desktop

**What is Docker?**
Docker runs the PostgreSQL database in an isolated "container". Think of it as a virtual computer inside your computer that runs the database.

#### Windows Installation

1. Open your web browser
2. Go to: **<https://www.docker.com/products/docker-desktop/>**
3. Click **Download for Windows**
4. Double-click the downloaded `Docker Desktop Installer.exe`
5. Follow the installer prompts
6. **Restart your computer** when prompted
7. After restart, Docker Desktop will start automatically
8. Accept the terms of service
9. You may be asked to update WSL — click **Update** if prompted

#### macOS Installation

1. Open your web browser
2. Go to: **<https://www.docker.com/products/docker-desktop/>**
3. Click **Download for Mac**
   - Choose **Apple Chip** if you have M1/M2/M3 Mac
   - Choose **Intel Chip** if you have an older Mac
4. Open the downloaded `.dmg` file
5. Drag Docker to your Applications folder
6. Open Docker from Applications
7. Accept the terms of service

#### Linux (Ubuntu) Installation

Open Terminal and run these commands one at a time:

```bash
sudo apt-get update
sudo apt-get install docker.io docker-compose
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker $USER
```

Then log out and log back in.

#### Verify Docker Installation

Look for the **Docker whale icon** in your system tray:

- **Windows**: Bottom-right corner of screen, near the clock
- **macOS**: Top-right corner of screen, in the menu bar

The whale should be **still** (not animating). If it's animating, Docker is still starting up — wait for it to finish.

**Test in terminal:**

```
docker --version
```

You should see something like: `Docker version 24.0.7`

### Installing Git (Optional)

Git is used for version control. It's optional but recommended.

#### Windows Installation

1. Go to: **<https://git-scm.com/download/win>**
2. The download should start automatically
3. Run the installer with default options

#### macOS Installation

Git usually comes pre-installed. Test it:

```
git --version
```

If not installed, you'll be prompted to install Xcode Command Line Tools. Click **Install**.

#### Linux Installation

```bash
sudo apt install git
```

---

## 5. First-Time Setup

> **Prerequisites:** Complete Section 4 first. You need Node.js and Docker installed.

### Step 1: Open PowerShell

**Windows:**

1. Press `Windows + X`
2. Click **Windows Terminal** or **Windows PowerShell**

**macOS/Linux:**

1. Open **Terminal**

### Step 2: Navigate to the Project Folder

Type this command and press Enter:

**Windows:**

```powershell
cd C:\Users\ChristianHug_hhxqjwq\dev\dmpgrants
```

**macOS/Linux:**

```bash
cd ~/dev/dmpgrants
```

> **What does this do?**
> `cd` means "change directory" — it's like double-clicking a folder to go inside it.

**Verify you're in the right place:**

```
dir
```

(On macOS/Linux, use `ls` instead of `dir`)

You should see files like `package.json`, `server/`, `src/`, etc.

### Step 3: Ensure Docker is Running

Look for the Docker whale icon in your system tray. It should be still, not animating.

**If Docker isn't running:**

- **Windows**: Open Start menu, search for "Docker Desktop", click to open it
- **macOS**: Open Applications folder, double-click Docker
- **Linux**: Run `sudo systemctl start docker`

Wait until the whale icon stops animating (about 30 seconds).

### Step 4: Start the Database

Run this command:

```
docker-compose up -d
```

**What does this do?**

- `docker-compose` — Tool that manages Docker containers
- `up` — Start the containers defined in docker-compose.yml
- `-d` — "Detached" mode — runs in background

**First time takes longer** because Docker downloads the PostgreSQL image (about 400MB).

**Verify it's running:**

```
docker ps
```

You should see output like:

```
CONTAINER ID   IMAGE         STATUS          PORTS                    NAMES
abc123def      postgres:15   Up 30 seconds   0.0.0.0:5432->5432/tcp   dmpgrants-postgres-1
```

The important part is `Up` in the STATUS column.

### Step 5: Install Dependencies

Run this command:

```
npm install
```

**What does this do?**
Downloads all the code libraries (packages) the application needs. Creates a `node_modules` folder with hundreds of packages.

This takes 1-3 minutes. You'll see a progress bar and lots of text.

**When complete**, you'll see something like:

```
added 847 packages in 45s
```

### Step 6: Create Environment File

**Windows (PowerShell):**

```powershell
copy .env.example .env
```

**macOS/Linux:**

```bash
cp .env.example .env
```

**What does this do?**
Creates your local configuration file with database connection details and other settings.

### Step 7: Set Up Database Tables

Run this command:

```
npm run db:migrate
```

**What does this do?**
Creates all the database tables (users, work_orders, burials, customers, etc.).

You should see output like:

```
Running migrations...
Created table: users
Created table: work_orders
...
Migrations complete!
```

### Step 8: Start the Backend Server

Run this command:

```
npm run server
```

**What does this do?**
Starts the backend API server on port 3000.

You should see:

```
Server running on port 3000
```

**Leave this terminal window open!** The server needs to keep running.

### Step 9: Open a Second Terminal Window

**Windows:**

1. Press `Windows + X`
2. Click **Windows Terminal** or **Windows PowerShell**
3. A new window opens

**macOS:**

1. Press `Cmd + N` in Terminal, or
2. Press `Cmd + T` for a new tab

**Linux:**

1. Press `Ctrl + Shift + N` for new window, or
2. Press `Ctrl + Shift + T` for new tab

### Step 10: Navigate and Start the Frontend

In the **new** terminal window:

**Windows:**

```powershell
cd C:\Users\ChristianHug_hhxqjwq\dev\dmpgrants
npm run dev
```

**macOS/Linux:**

```bash
cd ~/dev/dmpgrants
npm run dev
```

You should see:

```
  VITE v5.x.x  ready in 1234 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: http://192.168.x.x:5173/
```

### Step 11: Open the Application

1. Open your web browser (Chrome, Edge, Firefox)
2. Go to: **<http://localhost:5173>**
3. You should see the login page!

### Step 12: Log In

**Demo credentials:**

- **Email:** `admin@dmp.com`
- **Password:** `admin123`

Or click **Preview Demo** to explore without logging in.

**Congratulations! The application is running!**

---

## 6. Daily Startup

Each time you want to use the application, follow these steps.

### Quick Version (Copy-Paste Commands)

**Terminal 1:**

```powershell
cd C:\Users\ChristianHug_hhxqjwq\dev\dmpgrants
docker-compose up -d
npm run server
```

**Terminal 2 (new window):**

```powershell
cd C:\Users\ChristianHug_hhxqjwq\dev\dmpgrants
npm run dev
```

**Browser:** <http://localhost:5173>

### Step-by-Step Version

```
┌───────────────────────────────────────────────────────────────────────┐
│                        DAILY STARTUP SEQUENCE                         │
├───────────────────────────────────────────────────────────────────────┤
│                                                                       │
│   Step 1: Open PowerShell                                             │
│   ─────────────────────────                                           │
│   Press Windows+X → Click "Windows Terminal"                          │
│                                                                       │
│   Step 2: Navigate to project                                         │
│   ────────────────────────────                                        │
│   cd C:\Users\ChristianHug_hhxqjwq\dev\dmpgrants                     │
│                                                                       │
│   Step 3: Start database                                              │
│   ──────────────────────                                              │
│   docker-compose up -d                                                │
│                                                                       │
│   Step 4: Start backend                                               │
│   ─────────────────────                                               │
│   npm run server                                                      │
│   (Leave this window running!)                                        │
│                                                                       │
│   Step 5: Open NEW terminal window                                    │
│   ─────────────────────────────────                                   │
│   Press Windows+X → Click "Windows Terminal"                          │
│                                                                       │
│   Step 6: Navigate and start frontend                                 │
│   ─────────────────────────────────────                               │
│   cd C:\Users\ChristianHug_hhxqjwq\dev\dmpgrants                     │
│   npm run dev                                                         │
│                                                                       │
│   Step 7: Open browser                                                │
│   ────────────────────                                                │
│   Go to http://localhost:5173                                         │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

### Shutting Down

When you're done for the day:

1. Go to the terminal running the frontend (`npm run dev`)
2. Press `Ctrl + C` to stop it
3. Go to the terminal running the backend (`npm run server`)
4. Press `Ctrl + C` to stop it
5. (Optional) Stop the database: `docker-compose down`

> **Note:** You can leave Docker running — it uses minimal resources when idle. The database container will restart automatically next time you run `docker-compose up -d`.

---

## 7. Using the Application

### Logging In

**Default demo account:**

- **Email:** `admin@dmp.com`
- **Password:** `admin123`

### Navigation

After logging in, you'll see the Dashboard with a sidebar menu:

```
┌───────────────────────────────────────────────────────────────────────┐
│  Detroit Memorial Park                               [User] [Logout]  │
├────────────────┬──────────────────────────────────────────────────────┤
│                │                                                      │
│  Dashboard     │   Dashboard                                         │
│                │                                                      │
│  Work Orders   │   ┌─────────────┐  ┌─────────────┐  ┌────────────┐  │
│                │   │ Active Work │  │   Burials   │  │  Revenue   │  │
│  Burials       │   │   Orders    │  │  This Month │  │   Today    │  │
│                │   │     12      │  │      3      │  │  $4,250    │  │
│  Inventory     │   └─────────────┘  └─────────────┘  └────────────┘  │
│                │                                                      │
│  Customers     │   Recent Activity                                   │
│                │   ────────────────                                   │
│  Contracts     │   - Work order #47 completed                        │
│                │   - New burial scheduled                            │
│  Financial     │   - Invoice #1023 paid                              │
│                │                                                      │
│  Reports       │                                                      │
│                │                                                      │
└────────────────┴──────────────────────────────────────────────────────┘
```

### Common Tasks

**Creating a Work Order:**

1. Click **Work Orders** in the sidebar
2. Click **+ New Work Order** button
3. Fill in: title, description, priority, assigned staff
4. Click **Save**

**Recording a Burial:**

1. Click **Burials** in the sidebar
2. Click **+ New Burial**
3. Enter: deceased information, plot location, date
4. Link to customer/contract if applicable
5. Click **Save**

**Managing Inventory:**

1. Click **Inventory** in the sidebar
2. View current stock levels
3. Click an item to update quantity or add new stock

---

## 8. How It All Works

### Project Structure

```
dmpgrants/
│
├── src/                       FRONTEND (React/TypeScript)
│   ├── components/            Reusable UI pieces (buttons, cards)
│   ├── pages/                 Full screen views (Dashboard, Login)
│   ├── hooks/                 Reusable logic
│   ├── lib/                   Utilities
│   └── App.tsx                Main entry point
│
├── server/                    BACKEND (Node.js/Express)
│   ├── routes/                API endpoints
│   ├── middleware/            Request processing
│   ├── db/                    Database setup
│   └── app.js                 Server configuration
│
├── package.json               Dependencies and scripts
├── .env                       Environment configuration
├── docker-compose.yml         Database container setup
└── vite.config.ts             Frontend build configuration
```

### The Three Servers

When the application is running, three things are active:

| Server | Port | Started By | Purpose |
| ------ | ---- | ---------- | ------- |
| **PostgreSQL** | 5432 | `docker-compose up -d` | Database storage |
| **Backend** | 3000 | `npm run server` | API and business logic |
| **Frontend** | 5173 | `npm run dev` | User interface |

### What Are Ports?

Ports are like apartment numbers in a building. Your computer (the building) can run many services, and each gets a unique port number.

- Port **5432** — Database (PostgreSQL)
- Port **3000** — Backend API server
- Port **5173** — Frontend development server

---

## 9. Troubleshooting

### Quick Fixes

| Problem | Solution |
| ------- | -------- |
| Page won't load | Make sure both servers are running |
| "Connection refused" | Run `docker-compose up -d` |
| Login doesn't work | Use `admin@dmp.com` / `admin123` |
| Blank white screen | Press F12, check Console for errors |

### "npm: command not found"

**Cause:** Node.js isn't installed or terminal wasn't restarted

**Fix:**

1. Install Node.js from <https://nodejs.org>
2. **Close and reopen your terminal** (important!)
3. Test: `node --version`

### "docker-compose: command not found"

**Cause:** Docker Desktop isn't installed or running

**Fix:**

1. Install Docker Desktop from <https://docker.com>
2. Start Docker Desktop
3. Wait for whale icon to stop animating
4. Test: `docker --version`

### "Connection refused" / "ECONNREFUSED"

**Cause:** Database isn't running

**Fix:**

```
docker-compose up -d
```

Wait 10 seconds, then try again.

### "Port 3000 already in use"

**Cause:** Another application is using that port

**Fix (Windows):**

```powershell
netstat -ano | findstr :3000
taskkill /PID <number shown> /F
```

### "Cannot find module"

**Cause:** Dependencies need reinstalling

**Fix (Windows PowerShell):**

```powershell
Remove-Item -Recurse -Force node_modules
Remove-Item package-lock.json
npm install
```

**Fix (macOS/Linux):**

```bash
rm -rf node_modules package-lock.json
npm install
```

---

## 10. Command Reference

### Startup Commands

| Command | What It Does |
| ------- | ------------ |
| `docker-compose up -d` | Start database |
| `npm run server` | Start backend (port 3000) |
| `npm run dev` | Start frontend (port 5173) |

### First-Time Setup

| Command | What It Does |
| ------- | ------------ |
| `npm install` | Download dependencies |
| `copy .env.example .env` | Create config file (Windows) |
| `cp .env.example .env` | Create config file (Mac/Linux) |
| `npm run db:migrate` | Create database tables |

### Utility Commands

| Command | What It Does |
| ------- | ------------ |
| `docker ps` | List running containers |
| `docker-compose down` | Stop database |
| `docker-compose logs` | View database logs |
| `npm run build` | Build for production |

### Navigation Commands

| Command | What It Does |
| ------- | ------------ |
| `cd <folder>` | Change directory |
| `cd ..` | Go up one folder |
| `dir` (Windows) | List files |
| `ls` (Mac/Linux) | List files |
| `pwd` | Show current folder |
| `Ctrl + C` | Stop running command |

---

## 11. Glossary

| Term | Meaning |
| ---- | ------- |
| **API** | Application Programming Interface — how frontend talks to backend |
| **Backend** | Server code that handles logic and database operations |
| **Container** | Isolated environment running an application (like the database) |
| **Database** | Permanent storage for all application data |
| **Docker** | Tool that runs applications in containers |
| **Frontend** | The visual interface you see in the browser |
| **Node.js** | Lets you run JavaScript outside a browser |
| **npm** | Node Package Manager — downloads code libraries |
| **Port** | Number identifying a service (like apartment numbers) |
| **PostgreSQL** | The database system storing all data |
| **PowerShell** | Windows command-line terminal |
| **Terminal** | Text-based interface to control your computer |

---

## Need Help?

- **Application Issues:** Check the Troubleshooting section above
- **Feature Requests:** Contact the development team
- **Bug Reports:** Note the exact error message and steps to reproduce

---

Last updated: February 2026
