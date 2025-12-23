# Flow Builder - AWS Step Functions Visual Builder

A visual, drag-and-drop workflow builder for AWS Step Functions. Create, deploy, and execute state machines directly from your browser without writing ASL (Amazon States Language) JSON manually.

![Flow Builder](https://img.shields.io/badge/Flow-Builder-blue) ![Next.js](https://img.shields.io/badge/Next.js-16.1-black) ![NestJS](https://img.shields.io/badge/NestJS-11.0-red) ![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)

## ✨ Features

- 🎨 **Visual Flow Builder** - Drag-and-drop interface for creating state machines
- 🚀 **Deploy to AWS** - Deploy state machines directly to AWS Step Functions
- ▶️ **Execute Workflows** - Start executions and monitor their progress in real-time
- 📊 **Execution History** - View and track execution history with detailed status
- 💾 **Database Persistence** - Store state machine definitions and execution metadata in PostgreSQL
- 📝 **ASL Export** - Export your workflows as Amazon States Language JSON
- 🔍 **Real-time Status** - Poll execution status and view results
- 🎯 **Pass State Support** - Create and configure Pass states visually

## 🏗️ Architecture

```
flow-builder/
├── frontend/          # Next.js React application
│   ├── app/          # Next.js app directory
│   ├── components/   # React Flow components
│   └── utils/        # ASL conversion utilities
│
└── backend/          # NestJS API server
    ├── src/
    │   ├── state-machine/  # State machine CRUD operations
    │   ├── database/        # TypeORM database configuration
    │   └── common/         # Shared modules (logger, etc.)
    └── dist/              # Compiled JavaScript
```

## 🛠️ Tech Stack

### Frontend
- **Next.js 16.1** - React framework with App Router
- **React Flow 11** - Interactive node-based flow editor
- **Tailwind CSS 4** - Utility-first CSS framework
- **TypeScript** - Type-safe JavaScript

### Backend
- **NestJS 11** - Progressive Node.js framework
- **TypeORM** - TypeScript ORM for PostgreSQL
- **PostgreSQL** - Relational database
- **AWS SDK v3** - AWS Step Functions integration
- **Swagger** - API documentation

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18 or higher)
- **npm** or **pnpm** or **yarn**
- **PostgreSQL** (or a PostgreSQL service like Neon, Railway, etc.)
- **AWS Account** with Step Functions access
- **AWS IAM Role** for Step Functions execution

## 🚀 Getting Started

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd flow-builder
```

### 2. Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Create .env file
cp .env.example .env  # Or create manually
```

Configure your `.env` file in the `backend` directory:

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:3000

# PostgreSQL Database Connection String (recommended)
DATABASE_URL=postgresql://username:password@host:port/database?sslmode=require

# OR use individual parameters (if DATABASE_URL is not set)
# DB_HOST=localhost
# DB_PORT=5432
# DB_USERNAME=postgres
# DB_PASSWORD=postgres
# DB_NAME=flow_builder

# AWS Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key_id
AWS_SECRET_ACCESS_KEY=your_secret_access_key
AWS_STEP_FUNCTIONS_ROLE_ARN=arn:aws:iam::your-account-id:role/your-role-name
```

### 3. Frontend Setup

```bash
cd ../frontend

# Install dependencies
npm install

# Create .env.local file (optional - defaults to http://localhost:5000)
echo "NEXT_PUBLIC_API_BASE_URL=http://localhost:5000" > .env.local
```

### 4. Start the Development Servers

**Terminal 1 - Backend:**
```bash
cd backend
npm run start:dev
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

The application will be available at:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000
- **API Documentation**: http://localhost:5000/docs

## 📖 Usage

### Creating a State Machine

1. Click **"+ Add Pass State"** to add nodes to your flow
2. Connect nodes by dragging from one node's handle to another
3. Click **"Export to ASL"** to preview the Amazon States Language JSON
4. Click **"Deploy to AWS"** to deploy your state machine
5. Enter a name for your state machine when prompted

### Executing a Workflow

1. After deploying, click **"Start Execution"**
2. Enter JSON input for your execution (e.g., `{"key": "value"}`)
3. Monitor the execution status in real-time
4. View execution history and details

### Viewing Execution History

- Click **"View History"** to see all executions for the deployed state machine
- Click on any execution to view detailed information including:
  - Execution status (RUNNING, SUCCEEDED, FAILED)
  - Input and output data
  - Error messages (if failed)
  - Start and stop timestamps

## 🔌 API Endpoints

The backend provides a RESTful API with Swagger documentation available at `/docs`.

### State Machines

- `POST /state-machines` - Create a new state machine
- `DELETE /state-machines?stateMachineArn=<arn>` - Delete a state machine

### Executions

- `POST /executions` - Start a new execution
- `GET /executions?stateMachineArn=<arn>&maxResults=10` - List executions
- `GET /executions/:executionArn` - Get execution details

## 🗄️ Database Schema

The application uses PostgreSQL to store:

### State Machines
- State machine definitions
- AWS ARNs
- Creation timestamps
- Metadata

### Executions
- Execution ARNs
- Status and results
- Input/output data
- Error information
- Timestamps

The schema is automatically synchronized in development mode. For production, use migrations.

## 🌍 Environment Variables

### Backend

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `5000` |
| `NODE_ENV` | Environment | `development` |
| `FRONTEND_URL` | Allowed CORS origin | `http://localhost:3000` |
| `DATABASE_URL` | PostgreSQL connection string | - |
| `DB_HOST` | Database host (if no DATABASE_URL) | `localhost` |
| `DB_PORT` | Database port | `5432` |
| `DB_USERNAME` | Database username | `postgres` |
| `DB_PASSWORD` | Database password | `postgres` |
| `DB_NAME` | Database name | `flow_builder` |
| `AWS_REGION` | AWS region | `us-east-1` |
| `AWS_ACCESS_KEY_ID` | AWS access key | - |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key | - |
| `AWS_STEP_FUNCTIONS_ROLE_ARN` | IAM role ARN for Step Functions | - |

### Frontend

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_BASE_URL` | Backend API URL | `http://localhost:5000` |

## 🧪 Testing

### Backend Tests

```bash
cd backend

# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
```

### Frontend Tests

```bash
cd frontend

# Run linter
npm run lint
```

## 📦 Building for Production

### Backend

```bash
cd backend

# Build
npm run build

# Start production server
npm run start:prod
```

### Frontend

```bash
cd frontend

# Build
npm run build

# Start production server
npm run start
```

## 🚢 Deployment

### Backend Deployment

1. Set `NODE_ENV=production` in your environment
2. Configure production database (disable `synchronize`, use migrations)
3. Set `FRONTEND_URL` to your production frontend URL
4. Ensure AWS credentials are configured
5. Build and deploy:
   ```bash
   npm run build
   npm run start:prod
   ```

### Frontend Deployment

1. Set `NEXT_PUBLIC_API_BASE_URL` to your production backend URL
2. Build and deploy:
   ```bash
   npm run build
   npm run start
   ```

**Recommended Platforms:**
- **Backend**: AWS ECS, Railway, Render, Heroku
- **Frontend**: Vercel, Netlify, AWS Amplify
- **Database**: Neon, Railway, AWS RDS, Supabase

## 🔒 Security Considerations

- Never commit `.env` files to version control
- Use environment variables for sensitive data
- Configure CORS properly for production
- Use AWS IAM roles with least privilege
- Enable SSL/TLS for database connections
- Use parameterized queries (TypeORM handles this)

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License.

## 🙏 Acknowledgments

- [NestJS](https://nestjs.com/) - Progressive Node.js framework
- [Next.js](https://nextjs.org/) - React framework
- [React Flow](https://reactflow.dev/) - Node-based flow editor
- [AWS Step Functions](https://aws.amazon.com/step-functions/) - Serverless workflow orchestration

## 📞 Support

For issues, questions, or contributions, please open an issue on GitHub.

---

**Built with ❤️ for AWS Step Functions**

