from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
import time
import asyncio
from typing import List, Dict

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Advanced Session State
session_state = {
    "current_context": "local", 
    "awaiting": None, # pem, rds_endpoint, db_creds
    "inventory": {
        "databases": ["production_db", "user_service_db", "analytics_vault"],
        "tables": ["users", "sessions", "transactions", "audit_logs"]
    }
}

@app.post("/chat")
async def chat_handler(data: Dict):
    message = data.get("message", "")
    message_lower = message.lower()
    global session_state
    
    await asyncio.sleep(0.8)

    # --- 1. HANDLE SECURITY GATE (SSH) ---
    if "ssh" in message_lower and "aws" in message_lower:
        session_state["awaiting"] = "pem"
        return {
            "type": "text",
            "text": "🔐 SECURITY GATE: To establish an SSH connection to the AWS Ubuntu instance, please provide the name of your private key (.pem) or your IAM Access Key ID."
        }

    if session_state["awaiting"] == "pem":
        session_state["awaiting"] = None
        session_state["current_context"] = "ssh"
        return {
            "type": "terminal_action",
            "text": f"Identity verified using {message}. Establishing secure tunnel...",
            "terminal_output": [
                f"ssh -i {message} ubuntu@ec2-prod-instance.aws.com",
                "ECDSA key fingerprint is SHA256:7yHn/...",
                "Are you sure you want to continue connecting (yes/no)? yes",
                "Warning: Permanently added 'ec2-prod-instance' to the list of known hosts.",
                "Welcome to Ubuntu 22.04 LTS",
                "ubuntu@aws-prod:~$ "
            ],
            "context": "ssh"
        }

    # --- 2. HANDLE RDS LOGIN ---
    if "mysql" in message_lower or "rds" in message_lower:
        if session_state["current_context"] == "ssh":
            session_state["awaiting"] = "rds_endpoint"
            return {
                "type": "text",
                "text": "📊 RDS CONFIG: Please provide your RDS Endpoint (e.g., prod-db.cxyz.us-east-1.rds.amazonaws.com) to initialize the MySQL monitor."
            }
        else:
            return {"type": "text", "text": "Please SSH into the server first before attempting to connect to RDS."}

    if session_state["awaiting"] == "rds_endpoint":
        session_state["awaiting"] = "db_pass"
        return {
            "type": "text",
            "text": f"Endpoint {message} reached. Please enter the Master Password for 'admin' user."
        }

    if session_state["awaiting"] == "db_pass":
        session_state["awaiting"] = None
        session_state["current_context"] = "mysql"
        return {
            "type": "terminal_action",
            "text": "Authentication successful. MySQL Session Active.",
            "terminal_output": [
                "mysql -h prod-rds-instance.aws.com -u admin -p",
                "Enter password: ****",
                "Welcome to the MySQL monitor. Commands end with ; or \\g.",
                "mysql> "
            ],
            "context": "mysql"
        }

    # --- 3. DATABASE INSPECTION ---
    if session_state["current_context"] == "mysql":
        if "show" in message_lower and "database" in message_lower:
            dbs = session_state["inventory"]["databases"]
            output = ["+--------------------+", "| Database           |", "+--------------------+"]
            for db in dbs: output.append(f"| {db:<18} |")
            output.append("+--------------------+")
            output.append("3 rows in set (0.01 sec)")
            output.append("mysql> ")
            return {"type": "terminal_action", "text": "Fetching databases...", "terminal_output": output, "context": "mysql"}
        
        if "show" in message_lower and "table" in message_lower:
            tables = session_state["inventory"]["tables"]
            output = ["+-------------------+", "| Tables_in_prod_db |", "+-------------------+"]
            for t in tables: output.append(f"| {t:<17} |")
            output.append("+-------------------+")
            output.append("4 rows in set (0.00 sec)")
            output.append("mysql> ")
            return {"type": "terminal_action", "text": "Listing tables...", "terminal_output": output, "context": "mysql"}

        if "drop" in message_lower and "table" in message_lower:
            table_name = message_lower.split("table")[-1].strip()
            return {
                "type": "terminal_action",
                "text": f"⚠️ EXECUTING DROP: Table '{table_name}' has been deleted.",
                "terminal_output": [f"DROP TABLE {table_name};", "Query OK, 0 rows affected (0.05 sec)", "mysql> "],
                "context": "mysql"
            }

    # --- 4. EXIT LOGIC ---
    if "exit" in message_lower:
        if session_state["current_context"] == "mysql":
            session_state["current_context"] = "ssh"
            return {"type": "terminal_action", "text": "RDS connection closed.", "terminal_output": ["bye", "ubuntu@aws-prod:~$ "], "context": "ssh"}
        else:
            session_state["current_context"] = "local"
            return {"type": "terminal_action", "text": "SSH Logout.", "terminal_output": ["logout", "Connection closed.", "$ "], "context": "local"}

    return {
        "type": "text",
        "text": "I am CommanderX. I'm ready to handle your infrastructure. Type 'ssh into aws' to begin."
    }

async def log_analyzer_agent(logs: str):
    await asyncio.sleep(1.5); return {"agent": "Log Analyzer", "findings": "Detected 502 Bad Gateway."}
async def rca_agent(f: str):
    await asyncio.sleep(2); return {"agent": "Root Cause Agent", "findings": "Auth-service unresponsive."}
async def severity_agent(r: str):
    await asyncio.sleep(1); return {"agent": "Severity Agent", "severity": "Critical"}
async def fix_generator_agent(r: str):
    await asyncio.sleep(2.5); return {"agent": "Fix Generator", "suggestions": ["kubectl restart deployment auth-service"]}

@app.post("/analyze")
async def analyze_incident(file: UploadFile = File(...)):
    # Legacy upload logic preserved
    return {"status": "Analysis feature is now integrated into chat for a better experience."}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
