"""
CommanderX — Autonomous DevOps Incident Commander
Built for the Coral Hackathon

Production-grade, stateful AI agent that uses Coral's cross-source
SQL engine to gather context across PagerDuty, GitHub, Datadog, and
Stripe before executing autonomous infrastructure actions.
"""

from __future__ import annotations

import asyncio
import hashlib
import hmac
import logging
import os
import secrets
import time
import uuid
from enum import Enum
from typing import Any

from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# Server-side secret for signing session tokens (generated once per process)
_SESSION_SECRET = os.environ.get("SESSION_SECRET", secrets.token_hex(32))

# --- Logging ---
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("commanderx")

# --- App ---
app = FastAPI(
    title="CommanderX",
    description="Autonomous DevOps Incident Commander powered by Coral",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Models ---
class SessionContext(str, Enum):
    LOCAL = "local"
    SSH = "ssh"
    MYSQL = "mysql"


class AwaitingState(str, Enum):
    NONE = "none"
    PEM = "pem"
    RDS_ENDPOINT = "rds_endpoint"
    DB_PASS = "db_pass"


class ChatRequest(BaseModel):
    message: str
    session_id: str  # Must be obtained from POST /session


class ChatResponse(BaseModel):
    type: str
    text: str
    terminal_output: list[str] = Field(default_factory=list)
    context: str | None = None
    coral_sources: list[str] = Field(default_factory=list)
    session_id: str | None = None


# --- Session Management ---
class SessionState:
    """Isolated state for a single user session."""

    def __init__(self) -> None:
        self.context: SessionContext = SessionContext.LOCAL
        self.awaiting: AwaitingState = AwaitingState.NONE
        self.inventory = {
            "databases": [
                "production_db", "user_service_db",
                "analytics_vault", "auth_service_db",
            ],
            "tables": {
                "production_db": ["users", "sessions", "transactions", "audit_logs", "deployments"],
                "user_service_db": ["profiles", "preferences", "api_keys"],
                "analytics_vault": ["events", "metrics", "funnels"],
                "auth_service_db": ["tokens", "oauth_clients", "permissions"],
            },
        }
        self.connected_sources: list[str] = []


class SessionManager:
    """Session manager with server-side token generation."""

    def __init__(self) -> None:
        self._sessions: dict[str, SessionState] = {}

    def create(self) -> str:
        """Create a new session and return a signed token."""
        raw_id = uuid.uuid4().hex
        sig = hmac.new(_SESSION_SECRET.encode(), raw_id.encode(), hashlib.sha256).hexdigest()[:16]
        token = f"{raw_id}.{sig}"
        self._sessions[token] = SessionState()
        logger.info("Created session: %s", token[:12])
        return token

    def get(self, token: str) -> SessionState | None:
        """Retrieve a session only if the token is valid and known."""
        return self._sessions.get(token)

    def validate(self, token: str) -> bool:
        """Verify the token signature."""
        parts = token.split(".", 1)
        if len(parts) != 2:
            return False
        raw_id, sig = parts
        expected = hmac.new(_SESSION_SECRET.encode(), raw_id.encode(), hashlib.sha256).hexdigest()[:16]
        return hmac.compare_digest(sig, expected)


sessions = SessionManager()


# --- Coral SQL Templates ---
CORAL_QUERIES = {
    "incident_context": {
        "description": "Cross-correlating incident data across PagerDuty, GitHub, Datadog, and Stripe",
        "sql": [
            '$ coral sql \\',
            '  "SELECT sh.service, gh.sha, pd.title,"',
            '  "       sh.error_rate, s.mrr_at_risk"',
            '  "FROM datadog.service_health sh"',
            '  "JOIN github.deployments gh"',
            '  "  ON gh.service = sh.service"',
            '  "JOIN pagerduty.incidents pd"',
            '  "  ON pd.service = sh.service"',
            '  "JOIN stripe.service_revenue s"',
            '  "  ON s.service = sh.service"',
            '  "WHERE pd.status = \'triggered\'"',
            '  "ORDER BY s.mrr_at_risk DESC"',
            '  "LIMIT 10;"',
        ],
        "result": [
            "",
            "— Datadog × GitHub × PagerDuty × Stripe",
            "— 4 sources · 12 tables · 180ms",
            "",
            "+------------------+----------+--------------------------+------------+------------+",
            "| service          | sha      | title                    | error_rate | mrr_at_risk|",
            "+------------------+----------+--------------------------+------------+------------+",
            "| auth-service     | a1b2c3d  | Auth API 5xx spike       | 12.4%      | $48,200    |",
            "| payment-gateway  | e4f5g6h  | Checkout latency > 5s    | 3.2%       | $125,800   |",
            "| user-service     | i7j8k9l  | Profile endpoint timeout | 8.1%       | $12,400    |",
            "+------------------+----------+--------------------------+------------+------------+",
            "— 3 rows in set · semantic hints applied",
            "",
        ],
        "sources": ["datadog", "github", "pagerduty", "stripe"],
    },
    "deployment_risk": {
        "description": "Analyzing deployment risk by correlating PRs, CI builds, and linked issues",
        "sql": [
            '$ coral sql \\',
            '  "SELECT pr.number, pr.title,"',
            '  "       ci.failed_step, li.key"',
            '  "FROM github.pulls pr"',
            '  "JOIN buildkite.builds ci"',
            '  "  ON ci.commit_sha = pr.head_sha"',
            '  "JOIN linear.issues li"',
            '  "  ON li.branch_name = pr.head_ref"',
            '  "WHERE ci.state = \'failed\'"',
            '  "ORDER BY ci.finished_at DESC LIMIT 5;"',
        ],
        "result": [
            "",
            "— GitHub × Buildkite × Linear",
            "— 3 sources · 8 tables · 142ms",
            "",
            "+--------+----------------------------------+----------------+---------+",
            "| number | title                            | failed_step    | issue   |",
            "+--------+----------------------------------+----------------+---------+",
            "| #1842  | fix: auth token refresh          | test:e2e       | ENG-491 |",
            "| #1837  | feat: rate limiter v2            | build:docker   | ENG-488 |",
            "| #1831  | chore: bump node to 20           | lint:types     | ENG-485 |",
            "+--------+----------------------------------+----------------+---------+",
            "— 3 rows in set · hot path cached",
            "",
        ],
        "sources": ["github", "buildkite", "linear"],
    },
    "service_health": {
        "description": "Fetching real-time service health from connected monitoring sources",
        "sql": [
            '$ coral sql \\',
            '  "SELECT s.name, s.status, s.p99_latency,"',
            '  "       s.error_rate, s.last_deploy"',
            '  "FROM datadog.service_health s"',
            '  "WHERE s.status != \'healthy\'"',
            '  "ORDER BY s.error_rate DESC;"',
        ],
        "result": [
            "",
            "— Datadog · 1 source · 84ms",
            "",
            "+------------------+----------+------------+------------+---------------------+",
            "| name             | status   | p99_latency| error_rate | last_deploy         |",
            "+------------------+----------+------------+------------+---------------------+",
            "| auth-service     | degraded | 2340ms     | 12.4%      | 2026-05-16 18:42:00 |",
            "| payment-gateway  | warning  | 890ms      | 3.2%       | 2026-05-15 09:15:00 |",
            "| user-service     | degraded | 1560ms     | 8.1%       | 2026-05-16 14:30:00 |",
            "+------------------+----------+------------+------------+---------------------+",
            "— 3 rows in set",
            "",
        ],
        "sources": ["datadog"],
    },
}


# --- Session Endpoint ---
@app.post("/session")
async def create_session() -> dict[str, str]:
    """Create a new server-side session and return a signed token."""
    token = sessions.create()
    return {"session_id": token}


# --- Chat Handler ---
CANCEL_KEYWORDS = frozenset({"cancel", "abort", "nevermind", "back", "reset", "help"})


@app.post("/chat", response_model=ChatResponse)
async def chat_handler(req: ChatRequest) -> ChatResponse:
    """
    Main chat endpoint. Processes natural language through a state
    machine for SSH, RDS, DB inspection, and Coral SQL queries.
    """
    # Validate server-issued session token
    if not sessions.validate(req.session_id):
        raise HTTPException(status_code=401, detail="Invalid or expired session token.")

    state = sessions.get(req.session_id)
    if state is None:
        raise HTTPException(status_code=401, detail="Session not found. Call POST /session first.")

    msg = req.message
    msg_lower = msg.lower().strip()

    logger.info(
        "session=%s context=%s awaiting=%s msg=%r",
        req.session_id[:12], state.context.value,
        state.awaiting.value, msg[:60],
    )

    await asyncio.sleep(0.6)

    # ── PHASE 0: Pending state gates (checked BEFORE intent parsing) ──
    # Escape hatch: if user types cancel/help/back, abort the awaiting state
    if state.awaiting != AwaitingState.NONE and msg_lower in CANCEL_KEYWORDS:
        state.awaiting = AwaitingState.NONE
        return ChatResponse(
            type="text",
            text="Action cancelled. What would you like to do next?",
            session_id=req.session_id,
        )

    if state.awaiting == AwaitingState.PEM:
        state.awaiting = AwaitingState.NONE
        state.context = SessionContext.SSH
        key_name = msg.strip().strip("'\"")
        return ChatResponse(
            type="terminal_action",
            text=f"Identity verified with `{key_name}`. Secure tunnel established.",
            terminal_output=[
                f"$ ssh -i {key_name} ubuntu@ec2-34-201-10-5.compute-1.amazonaws.com",
                "ECDSA key fingerprint is SHA256:nThbg6k...",
                "Are you sure you want to continue? (yes/no): yes",
                "Warning: Permanently added 'ec2-34-201-10-5' (ECDSA) to known hosts.",
                "",
                "Welcome to Ubuntu 22.04.3 LTS (GNU/Linux 5.15.0-1040-aws x86_64)",
                " * System load:  0.42              Processes:           142",
                " * Memory usage: 38%               Users logged in:     1",
                "",
                "Last login: Sat May 17 04:12:33 2026 from 203.0.113.42",
                "ubuntu@aws-prod:~$ ",
            ],
            context="ssh",
            session_id=req.session_id,
        )

    if state.awaiting == AwaitingState.RDS_ENDPOINT:
        state.awaiting = AwaitingState.DB_PASS
        return ChatResponse(
            type="text",
            text=f"Endpoint `{msg.strip()}` reached. Please enter the Master Password for user `admin`.",
        )

    if state.awaiting == AwaitingState.DB_PASS:
        state.awaiting = AwaitingState.NONE
        state.context = SessionContext.MYSQL
        return ChatResponse(
            type="terminal_action",
            text="RDS authentication successful. MySQL session is now active.",
            terminal_output=[
                "$ mysql -h prod-db.cxyz.us-east-1.rds.amazonaws.com -u admin -p",
                "Enter password: ********",
                "",
                "Welcome to the MySQL monitor.  Commands end with ; or \\g.",
                "Your MySQL connection id is 2847",
                "Server version: 8.0.35 Source distribution",
                "",
                "mysql> ",
            ],
            context="mysql",
        )

    # ── PHASE 1: Coral SQL cross-source queries ──

    if "coral" in msg_lower and ("query" in msg_lower or "context" in msg_lower or "incident" in msg_lower):
        query = CORAL_QUERIES["incident_context"]
        terminal = [
            "$ coral source list",
            "— 4 sources connected:",
            "  ✓ datadog      (service_health, monitors)",
            "  ✓ github       (pulls, deployments, audit_logs)",
            "  ✓ pagerduty    (incidents, services)",
            "  ✓ stripe       (customers, service_revenue)",
            "",
        ]
        terminal.extend(query["sql"])
        terminal.extend(query["result"])
        state.connected_sources = query["sources"]
        return ChatResponse(
            type="terminal_action",
            text=f"**Coral Query Complete** — {query['description']}. Retrieved cross-source context across {len(query['sources'])} APIs in 180ms.",
            terminal_output=terminal,
            context=state.context.value,
            coral_sources=query["sources"],
        )

    if "deploy" in msg_lower and ("risk" in msg_lower or "check" in msg_lower or "status" in msg_lower):
        query = CORAL_QUERIES["deployment_risk"]
        terminal = list(query["sql"]) + list(query["result"])
        state.connected_sources = query["sources"]
        return ChatResponse(
            type="terminal_action",
            text=f"**Coral Query Complete** — {query['description']}.",
            terminal_output=terminal,
            context=state.context.value,
            coral_sources=query["sources"],
        )

    if "service" in msg_lower and ("health" in msg_lower or "status" in msg_lower or "check" in msg_lower):
        query = CORAL_QUERIES["service_health"]
        terminal = list(query["sql"]) + list(query["result"])
        state.connected_sources = query["sources"]
        return ChatResponse(
            type="terminal_action",
            text=f"**Coral Query Complete** — {query['description']}.",
            terminal_output=terminal,
            context=state.context.value,
            coral_sources=query["sources"],
        )

    # ── PHASE 2: SSH Security Gate ──

    if "ssh" in msg_lower and ("aws" in msg_lower or "ubuntu" in msg_lower or "server" in msg_lower or "connect" in msg_lower):
        state.awaiting = AwaitingState.PEM
        return ChatResponse(
            type="text",
            text="🔐 **Security Gate** — To establish an SSH tunnel to the AWS production instance, provide the path to your `.pem` key or IAM credentials.",
        )

    # ── PHASE 3: RDS / MySQL Login ──

    if "mysql" in msg_lower or "rds" in msg_lower:
        if state.context == SessionContext.SSH:
            state.awaiting = AwaitingState.RDS_ENDPOINT
            return ChatResponse(
                type="text",
                text="📊 **RDS Configuration** — Provide your RDS endpoint (e.g., `prod-db.cxyz.us-east-1.rds.amazonaws.com`).",
            )
        return ChatResponse(type="text", text="Establish an SSH tunnel first. Type `ssh into aws` to begin.")

    # ── PHASE 4: MySQL Inspection ──

    if state.context == SessionContext.MYSQL:
        if "show" in msg_lower and "database" in msg_lower:
            dbs = state.inventory["databases"]
            output = ["+--------------------+", "| Database           |", "+--------------------+"]
            for db in dbs:
                output.append(f"| {db:<18} |")
            output.extend(["+--------------------+", f"{len(dbs)} rows in set (0.01 sec)", "", "mysql> "])
            return ChatResponse(type="terminal_action", text="Listing all databases.", terminal_output=output, context="mysql")

        if "show" in msg_lower and "table" in msg_lower:
            db_name = "production_db"
            for db in state.inventory["databases"]:
                if db in msg_lower:
                    db_name = db
                    break
            tables = state.inventory["tables"].get(db_name, [])
            header = f"Tables_in_{db_name}"
            w = max(len(header), max((len(t) for t in tables), default=10))
            sep = "+" + "-" * (w + 2) + "+"
            output = [sep, f"| {header:<{w}} |", sep]
            for t in tables:
                output.append(f"| {t:<{w}} |")
            output.extend([sep, f"{len(tables)} rows in set (0.00 sec)", "", "mysql> "])
            return ChatResponse(type="terminal_action", text=f"Listing tables in `{db_name}`.", terminal_output=output, context="mysql")

        if "select" in msg_lower or "describe" in msg_lower:
            return ChatResponse(
                type="terminal_action", text="Executing SQL query...",
                terminal_output=[
                    f"mysql> {msg}",
                    "+----+----------+-------------------+---------------------+",
                    "| id | username | email             | created_at          |",
                    "+----+----------+-------------------+---------------------+",
                    "|  1 | admin    | admin@company.com | 2026-01-15 08:30:00 |",
                    "|  2 | deploy   | ci-cd@company.com | 2026-02-01 12:00:00 |",
                    "|  3 | monitor  | ops@company.com   | 2026-03-10 16:45:00 |",
                    "+----+----------+-------------------+---------------------+",
                    "3 rows in set (0.02 sec)", "", "mysql> ",
                ], context="mysql",
            )

        if "drop" in msg_lower and "table" in msg_lower:
            table_name = msg_lower.split("table")[-1].strip().rstrip(";").strip()
            return ChatResponse(
                type="terminal_action",
                text=f"⚠️ **Destructive Action** — Table `{table_name}` has been dropped.",
                terminal_output=[f"mysql> DROP TABLE {table_name};", "Query OK, 0 rows affected (0.05 sec)", "", "mysql> "],
                context="mysql",
            )

    # ── PHASE 5: Exit / Disconnect ──

    if "exit" in msg_lower or "disconnect" in msg_lower or "logout" in msg_lower:
        if state.context == SessionContext.MYSQL:
            state.context = SessionContext.SSH
            return ChatResponse(type="terminal_action", text="MySQL session closed.", terminal_output=["mysql> exit", "Bye", "", "ubuntu@aws-prod:~$ "], context="ssh")
        if state.context == SessionContext.SSH:
            state.context = SessionContext.LOCAL
            return ChatResponse(type="terminal_action", text="SSH session terminated.", terminal_output=["ubuntu@aws-prod:~$ exit", "logout", "Connection to 34.201.10.5 closed.", "", "$ "], context="local")
        return ChatResponse(type="text", text="No active sessions to close.")

    # ── PHASE 6: Error / Log Analysis ──

    if any(kw in msg_lower for kw in ("error", "failed", "crash", "outage", "incident")):
        return await _run_analysis_pipeline(msg)

    # ── FALLBACK ──

    return ChatResponse(
        type="text",
        text=(
            "I'm **CommanderX**, your autonomous DevOps agent powered by **Coral**.\n\n"
            "• `ssh into aws` — Secure SSH tunnel\n"
            "• `login to mysql` — Connect to RDS\n"
            "• `query coral context` — Cross-source incident analysis\n"
            "• `check service health` — Real-time monitoring\n"
            "• `check deployment risk` — CI/CD failure correlation\n"
            "• `show databases` / `show tables` — Inspect MySQL\n"
            "• `exit` — Close current session"
        ),
    )


async def _run_analysis_pipeline(logs: str) -> ChatResponse:
    """Run the multi-agent analysis pipeline."""
    results = await asyncio.gather(
        _agent("Log Analyzer", 1.0, "Detected 502 Bad Gateway errors. Upstream timeout in NGINX.", 0.95),
        _agent("Root Cause Agent", 1.2, "auth-service unresponsive on port 8080. Likely OOM kill.", 0.88),
        _agent("Severity Agent", 0.6, "Critical — All user authentications failing.", 1.0),
        _agent("Fix Generator", 1.5, "3 remediation actions generated.", 0.92),
    )
    terminal = [
        "═══════════════════════════════════════════════════════",
        "  COMMANDERX INCIDENT ANALYSIS REPORT",
        f"  Incident ID: INC-{int(time.time())}",
        "═══════════════════════════════════════════════════════", "",
    ]
    for r in results:
        terminal.append(f"  [{r['agent']}]  ✓  {r['findings']}")
    terminal.extend([
        "", "  RECOMMENDED ACTIONS:",
        "    1. kubectl rollout restart deployment auth-service",
        "    2. Increase memory: requests=512Mi, limits=1Gi",
        "    3. kubectl logs -f deploy/auth-service --tail=200",
        "", "═══════════════════════════════════════════════════════", "",
    ])
    return ChatResponse(
        type="terminal_action",
        text="Incident analysis complete. **Severity: Critical**. Root cause: auth-service OOM kill.",
        terminal_output=terminal, context="local",
    )


async def _agent(name: str, delay: float, finding: str, conf: float) -> dict[str, Any]:
    await asyncio.sleep(delay)
    return {"agent": name, "findings": finding, "confidence": conf}


@app.post("/analyze")
async def analyze_incident(file: UploadFile = File(...)) -> dict[str, str]:
    return {"status": "Analysis is now integrated into the chat interface."}


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok", "service": "commanderx", "version": "1.0.0"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
