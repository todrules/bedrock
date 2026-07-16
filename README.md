# Bedrock RAG Chatbot

An enterprise-grade **Retrieval-Augmented Generation (RAG)** chatbot built on Amazon Bedrock, featuring a Next.js frontend, serverless Lambda backend, and full Infrastructure-as-Code via AWS CDK.

## ✨ Features

- 🤖 **AI-powered chat** using Anthropic Claude 3.5 Sonnet via Amazon Bedrock
- 📚 **RAG support** – answers backed by your documents via Bedrock Knowledge Bases
- 📎 **Source citations** – every response shows which documents were used
- 💬 **Persistent conversations** – multi-session chat history in DynamoDB
- 🔐 **Authentication** – Amazon Cognito user pool with MFA support
- 📱 **Responsive UI** – ChatGPT-like interface built with Next.js + Tailwind CSS
- 🏗️ **Infrastructure as Code** – entire stack defined in AWS CDK (TypeScript)
- 🚀 **CI/CD** – GitHub Actions pipelines for build, test, and deploy

## 🏛️ Architecture

```
Browser (Next.js)
    │
    ├─ Auth → Amazon Cognito
    │
    └─ API → Amazon API Gateway → AWS Lambda (Node.js 20)
                                        │
                                        ├─ Amazon Bedrock (Claude 3.5 Sonnet)
                                        ├─ Bedrock Knowledge Bases (RAG)
                                        ├─ Amazon S3 (documents)
                                        └─ Amazon DynamoDB (chat history)
```

## 📁 Repository Structure

```
bedrock-rag-chatbot/
├── frontend/              # Next.js 14 + React 19 SPA
│   ├── src/
│   │   ├── app/           # Next.js App Router pages
│   │   ├── components/    # Reusable UI components
│   │   ├── hooks/         # Custom React hooks
│   │   ├── services/      # API service layer
│   │   └── types/         # TypeScript types
│   └── ...
│
├── backend/               # AWS Lambda functions
│   ├── src/
│   │   ├── handlers/      # Lambda entry points (chat, conversations, health)
│   │   ├── services/      # Business logic (Bedrock, conversation)
│   │   ├── repositories/  # DynamoDB data access
│   │   ├── models/        # TypeScript interfaces
│   │   └── utils/         # Logger, response helpers, validation
│   └── ...
│
├── infrastructure/        # AWS CDK (TypeScript)
│   ├── bin/               # CDK app entry point
│   ├── stacks/            # CDK stacks and constructs
│   └── test/              # CDK snapshot tests
│
├── docs/
│   ├── local-development.md
│   └── deployment-guide.md
│
└── .github/workflows/     # CI/CD pipelines
    ├── ci.yml             # Lint, build, test
    └── deploy.yml         # Deploy to AWS
```

## 🚀 Quick Start

```bash
# Install all dependencies
npm install

# Local development (see docs/local-development.md for full setup)
cd frontend && cp .env.example .env.local   # add your values
npm run dev
```

## 📖 Documentation

- [Local Development Guide](docs/local-development.md)
- [Deployment Guide](docs/deployment-guide.md)

## 🔧 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, React 19, TypeScript, Tailwind CSS |
| Backend | AWS Lambda, Node.js 20, TypeScript, AWS SDK v3 |
| AI | Amazon Bedrock, Anthropic Claude 3.5 Sonnet |
| RAG | Amazon Bedrock Knowledge Bases, Amazon Titan Embeddings V2 |
| Database | Amazon DynamoDB (PAY_PER_REQUEST) |
| Storage | Amazon S3 |
| Auth | Amazon Cognito |
| API | Amazon API Gateway REST |
| IaC | AWS CDK v2 (TypeScript) |
| CI/CD | GitHub Actions |
| Monitoring | Amazon CloudWatch |

## 🧪 Tests

```bash
npm run test          # All workspaces
cd backend && npm test            # Backend unit tests (Jest + aws-sdk-client-mock)
cd frontend && npm test           # Frontend component tests (React Testing Library)
cd infrastructure && npm test     # CDK snapshot tests
```

## 📜 License

MIT
