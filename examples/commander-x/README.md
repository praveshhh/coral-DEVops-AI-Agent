# 🛡️ CommanderX: Autonomous DevOps Incident Commander

**Submission for the Coral Hackathon**

CommanderX is an agentic DevOps companion designed to transform natural language into autonomous infrastructure actions. Built on top of the Coral philosophy, it orchestrates multiple specialized agents to analyze logs, determine root causes, and execute remediation steps in a live terminal environment.

## 🚀 Key Features

- **Chat-First DevOps**: No complex dashboards. Just talk to your infrastructure.
- **Multi-Agent Orchestration**:
  - **Log Analyzer Agent**: Scans logs for patterns (502s, OOMs, Timeouts).
  - **Root Cause Agent**: Correlates findings to specific services.
  - **Severity Agent**: Assesses business impact.
  - **Fix Generator Agent**: Produces actionable, safe remediation commands.
- **Autonomous SSH & RDS Sessions**: Not just a chatbot—CommanderX establishes live SSH tunnels and handles RDS logins with secure credential gating.
- **Live Terminal Console**: A real-time, side-car terminal that shows the agent's work as it happens.

## 🛠️ Technology Stack

- **Framework**: FastAPI (Backend), React + Vite (Frontend)
- **Styling**: Tailwind CSS v4, Framer Motion (Premium Animations)
- **Icons**: Lucide React
- **Logic**: Stateful multi-turn conversation engine for DevOps workflows.

## 🏃 How to Run

1. Navigate to `examples/commander-x`.
2. Run the one-click startup script:
   ```powershell
   ./start.ps1
   ```
3. Open `http://localhost:5173` and start your autonomous session.

---
*Built with ❤️ for the Coral Community.*
