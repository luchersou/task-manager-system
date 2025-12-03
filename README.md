# Task Manager System API

A robust project and task management REST API built with Node.js, Express, Prisma ORM, and PostgreSQL (Supabase).

## 🌐 Live Demo

The API is deployed and available at:
```
https://task-manager-system-uqus.onrender.com
```

**Base API URL**: `https://task-manager-system-uqus.onrender.com/api/v1`

> **Note**: The application is hosted on Render's free tier, so the first request may take a few seconds as the server spins up from sleep mode.

## 📋 Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [API Documentation](#api-documentation)
- [Project Structure](#project-structure)
- [Environment Variables](#environment-variables)
- [Contributing](#contributing)

## ✨ Features

### 🔐 Authentication
- User registration and login
- JWT-based authentication (access & refresh tokens)
- Cookie-based token management
- Password change functionality
- Account deletion
- Protected routes with middleware

### 📁 Project Management
- Create, read, update, and delete projects
- Role-based access control (Owner, Admin, Manager, Contributor, Viewer)
- Team collaboration with member management
- Add/remove project members
- Update member roles
- Permission-based operations

### ✅ Task Management
- Create and organize tasks within projects
- Subtask support for better task breakdown
- Full CRUD operations on tasks and subtasks
- Role-based task permissions
- Task filtering and retrieval

## 🛠 Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js v5
- **Database**: PostgreSQL (Supabase)
- **ORM**: Prisma
- **Authentication**: JWT + bcryptjs
- **Validation**: Zod
- **HTTP Logging**: Morgan
- **Security**: CORS, cookie-parser
- **Deployment**: Render

## 🚀 Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- PostgreSQL database (Supabase account)

### Installation

1. Clone the repository
```bash
git clone https://github.com/yourusername/task-manager-system.git
cd task-manager-system
```

2. Install dependencies
```bash
npm install
```

3. Set up environment variables
```bash
cp .env.example .env
```
Edit `.env` with your configuration (see [Environment Variables](#environment-variables))

4. Generate Prisma Client
```bash
npx prisma generate
```

5. Run database migrations
```bash
npx prisma migrate dev
```

6. Start the development server
```bash
npm run dev
```

The API will be available at `http://localhost:8000`

## 📚 API Documentation

### Base URL

**Production**: `https://task-manager-system-uqus.onrender.com/api/v1`

**Local Development**: `http://localhost:8000/api/v1`

### Endpoints

#### Health Check
- `GET /healthcheck` - Check API status

#### Authentication Routes (`/auth`)
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/register` | Register new user | No |
| POST | `/login` | Login user | No |
| POST | `/refresh-token` | Refresh access token | No |
| POST | `/logout` | Logout user | Yes |
| GET | `/me` | Get current user | Yes |
| DELETE | `/me` | Delete account | Yes |
| PATCH | `/me/change-password` | Change password | Yes |

#### Project Routes (`/projects`)
| Method | Endpoint | Description | Required Role |
|--------|----------|-------------|---------------|
| GET | `/` | Get all projects | Authenticated |
| POST | `/` | Create project | Authenticated |
| GET | `/:projectId` | Get project by ID | Member |
| PATCH | `/:projectId` | Update project | Manager+ |
| DELETE | `/:projectId` | Delete project | Owner |
| POST | `/:projectId/members` | Add members | Manager+ |
| GET | `/:projectId/members` | Get members | Member |
| DELETE | `/:projectId/members/:userId` | Remove member | Admin+ |
| PATCH | `/:projectId/members/:userId/role` | Update member role | Admin+ |

#### Task Routes (`/tasks`)
| Method | Endpoint | Description | Required Role |
|--------|----------|-------------|---------------|
| GET | `/projects/:projectId/tasks` | Get all tasks | Member |
| POST | `/projects/:projectId/tasks` | Create task | Contributor+ |
| GET | `/:projectId/tasks/:taskId` | Get task by ID | Member |
| PATCH | `/:projectId/tasks/:taskId` | Update task | Contributor+ |
| DELETE | `/:projectId/tasks/:taskId` | Delete task | Manager+ |
| POST | `/:taskId/subtasks` | Create subtask | Contributor+ |
| PATCH | `/:taskId/subtasks/:subTaskId` | Update subtask | Contributor+ |
| DELETE | `/:taskId/subtasks/:subTaskId` | Delete subtask | Manager+ |

### Role Hierarchy

The system uses five distinct user roles with hierarchical permissions:

- **Owner**: Full control over the project (can delete project, manage all members)
- **Admin**: Can manage members and all project content
- **Manager**: Can manage tasks and project settings
- **Member**: Can contribute to tasks (create, edit tasks and subtasks)
- **Viewer**: Read-only access to project and tasks

#### Permission Groups

**Project Operations:**
- `ADMIN_ROLES`: Owner, Admin
- `MANAGER_ROLES`: Owner, Admin, Manager

**Task Operations:**
- `CONTRIBUTOR_ROLES`: Owner, Admin, Manager, Member
- `MANAGER_ROLES`: Owner, Admin, Manager

## 📁 Project Structure

```
task-manager-system/
├── src/
│   ├── controllers/      # Request handlers
│   │   ├── auth.controller.js
│   │   ├── healthchecker.routes
│   │   ├── project.controller.js
│   │   └── task.controller.js
│   ├── middlewares/      # Custom middleware
│   │   ├── auth.middleware.js
│   │   ├── error-handler.middleware.js
│   │   ├── validate.middleware.js
│   ├── routes/          # API routes
│   │   ├── auth.routes.js
│   │   ├── healthchecker.routes
│   │   ├── project.routes.js
│   │   └── task.routes.js
│   ├── schemas/         # Zod validation schemas
│   ├── utils/           # Utility functions
│   └── app.js           # Express app setup
├── prisma/
│   └── schema.prisma    # Database schema
├── .env                 # Environment variables
├── .gitignore
└── package.json
```

## 🔐 Environment Variables

Create a `.env` file in the root directory:

```env
# Server
PORT=
NODE_ENV=

# Database
DATABASE_URL=
DIRECT_URL=

# JWT
REFRESH_TOKEN_SECRET=
ACCESS_TOKEN_SECRET=

JWT_EXPIRY=
JWT_REFRESH_

# CORS
CORS_ORIGIN=
```

## 🔒 Security Features

- JWT-based authentication with access and refresh tokens
- Password hashing with bcryptjs
- HTTP-only cookies for token storage
- CORS protection
- Input validation with Zod schemas
- Role-based access control (RBAC)
- Protected routes with authentication middleware

## 🧪 Middleware

### Authentication Middleware (`verifyJWT`)
Validates JWT tokens and attaches user to request object.

### Validation Middleware (`validate`)
Validates request data against Zod schemas.

### Project Permission Middleware (`validateProjectPermission`)
Checks user's role and permissions for project operations.

### Error Handler Middleware
Centralized error handling with consistent response format.

## 📦 Dependencies

```json
{
  "@prisma/client": "^6.19.0",
  "bcryptjs": "^3.0.3",
  "cookie-parser": "^1.4.7",
  "cors": "^2.8.5",
  "dotenv": "^17.2.3",
  "express": "^5.1.0",
  "jsonwebtoken": "^9.0.2",
  "morgan": "^1.10.1",
  "prisma": "^6.19.0",
  "zod": "^4.1.12"
}
```

## 🚀 Deployment

This application is deployed on [Render](https://render.com) with the following configuration:

- **Platform**: Render Web Service
- **Database**: Supabase PostgreSQL
- **Build Command**: `npm install && npx prisma generate && npx prisma migrate deploy`
- **Start Command**: `npm start`

### Deploying Your Own Instance

1. Fork this repository
2. Create a new Web Service on Render
3. Connect your GitHub repository
4. Set up environment variables in Render dashboard
5. Deploy!

## 📄 License

This project is licensed under the MIT License.

## 👤 Author

Lucas Herzinger Souza