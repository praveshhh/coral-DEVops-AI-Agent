# 🛡️ CommanderX: Autonomous DevOps Incident Commander

**Submission for the Coral Hackathon**

CommanderX is a **proof-of-concept** agentic DevOps companion that demonstrates how natural language can drive infrastructure workflows through a simulated multi-agent pipeline. Built on the Coral philosophy of cross-source data access, it shows how a DevOps agent would use Coral SQL to gather context across PagerDuty, GitHub, Datadog, and Stripe before taking action.

> **Note:** This is a hackathon prototype. SSH tunneling, RDS connections, and database operations are **simulated** with realistic terminal output to demonstrate the intended user experience. In a production deployment, these would be backed by real `paramiko` SSH sessions, MySQL client connections, and live Coral SQL queries.

## 🚀 Key Features

- **Chat-First DevOps**: No complex dashboards. Conversational interface for infrastructure tasks.
- **Coral SQL Integration (Simulated)**: Cross-source queries joining Datadog, GitHub, PagerDuty, and Stripe data — demonstrating how Coral's unified SQL layer enables richer incident context.
- **Multi-Agent Orchestration (Simulated)**:
  - **Log Analyzer Agent**: Scans logs for patterns (502s, OOMs, Timeouts).
  - **Root Cause Agent**: Correlates findings to specific services.
  - **Severity Agent**: Assesses business impact.
  - **Fix Generator Agent**: Produces actionable remediation commands.
- **Stateful Session Management**: Server-side HMAC-signed session tokens with per-user isolation. Secure credential gating workflow for SSH and RDS.
- **Live Terminal Console**: A real-time side-panel that renders simulated command output as it happens.

## 🛠️ Technology Stack

- **Backend**: FastAPI, Pydantic models, HMAC-signed sessions, structured logging
- **Frontend**: React + Vite, Tailwind CSS v4, Framer Motion, Lucide React
- **Design**: Coral-inspired ocean theme with syntax-highlighted terminal

## 🏃 How to Run

1. Navigate to the repository root.
2. Run the one-click startup script:
   ```powershell
   ./start.ps1
   ```
3. Open `http://localhost:5173` and start your session.

## 🗺️ Roadmap to Production

- Replace simulated SSH with `paramiko` or `asyncssh` for real connections
- Replace simulated MySQL with `aiomysql` for live RDS queries
- Integrate live Coral CLI (`coral sql`) for real cross-source queries
- Add WebSocket streaming for real-time terminal output
- Add LLM-backed intent parsing (OpenAI/Groq) for true NLU

---
*Built with ❤️ for the Coral Community.*
