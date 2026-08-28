import os
import json
import time
import asyncio
from typing import List, Dict, Any, Optional
from dotenv import load_dotenv

from fastapi import FastAPI, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

import razorpay
from telegram import Bot, InlineKeyboardButton, InlineKeyboardMarkup

from langchain_groq import ChatGroq
from langchain_core.tools import tool
from langchain_core.messages import HumanMessage, SystemMessage, ToolMessage

load_dotenv(override=True)

# ==========================================
# 1. FASTAPI & CLIENT INITIALIZATION
# ==========================================

app = FastAPI(
    title="Autonomous Growth Engine API",
    version="1.0.0",
    description="Backend AI Orchestrator with Financial Gating & Audit Logging"
)

# Enable CORS for Next.js Dashboard
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

telegram_bot = Bot(token=os.getenv("TELEGRAM_BOT_TOKEN"))
razorpay_client = razorpay.Client(
    auth=(os.getenv("RAZORPAY_KEY_ID"), os.getenv("RAZORPAY_KEY_SECRET"))
)

# Shared in-memory state for live Dashboard streaming
audit_logs: List[Dict[str, Any]] = []

def log_event(step: str, agent_phase: str, status: str, detail: str, payload: Optional[Dict] = None):
    """Formats and stores structured events for the frontend audit stream."""
    entry = {
        "id": str(len(audit_logs) + 1),
        "timestamp": time.strftime("%H:%M:%S"),
        "step": step,
        "phase": agent_phase,
        "status": status,  # "INFO", "SUCCESS", "WARN", "INTERCEPTED", "ERROR"
        "detail": detail,
        "payload": payload or {}
    }
    audit_logs.append(entry)
    print(f"[{entry['timestamp']}] [{status}] [{step}] {detail}")

# Mock Catalog & Business Guardrails
DATABASE = {
    "products": {
        "camera_sony": {"name": "Sony Alpha Camera", "price": 80000},
        "lens_50mm": {"name": "50mm f/1.8 Prime Lens", "price": 15000, "cost": 9000, "stock": 0},  
        "tripod_pro": {"name": "Carbon Fiber Pro Tripod", "price": 6000, "cost": 3000, "stock": 12},
        "sd_card_128": {"name": "128GB High-Speed SD Card", "price": 2500, "cost": 1000, "stock": 50}
    },
    "business_rules": {
        "max_discount_percent": 20.0,
        "min_margin_percent": 15.0
    }
}

# ==========================================
# 2. AGENT TOOLS (Gating, Actions & DB Lookups)
# ==========================================

@tool
def fetch_upsell_candidates(item_bought_id: str) -> str:
    """Retrieves potential upsell product recommendations, retail prices, cost prices, and current stock status."""
    log_event(
        step="CATALOG_LOOKUP",
        agent_phase="DISCOVERY",
        status="INFO",
        detail=f"Scanning inventory catalog for complementary items to '{item_bought_id}'"
    )
    
    candidates = ["lens_50mm", "tripod_pro", "sd_card_128"]
    catalog_info = []
    
    for pid in candidates:
        prod = DATABASE["products"][pid]
        catalog_info.append({
            "product_id": pid,
            "name": prod["name"],
            "retail_price": prod["price"],
            "cost_price": prod["cost"],
            "in_stock": prod["stock"] > 0,
            "stock_count": prod["stock"]
        })
    return json.dumps(catalog_info)


@tool
def evaluate_financial_safety_gate(retail_price: float, cost_price: float, proposed_discount_percent: float) -> str:
    """
    MANDATORY FINANCIAL GATE. Validates if a proposed discount meets profitability thresholds:
    1. Maximum discount cap (20%).
    2. Minimum net margin floor (15%).
    """
    rules = DATABASE["business_rules"]
    max_discount = rules["max_discount_percent"]
    min_margin = rules["min_margin_percent"]
    
    capped_discount = min(proposed_discount_percent, max_discount)
    was_discount_capped = proposed_discount_percent > max_discount
    
    discounted_price = retail_price * (1 - capped_discount / 100.0)
    profit = discounted_price - cost_price
    net_margin_percent = (profit / discounted_price) * 100.0 if discounted_price > 0 else 0
    
    passed_margin_check = net_margin_percent >= min_margin
    approved = passed_margin_check
    
    result = {
        "approved": approved,
        "requested_discount": proposed_discount_percent,
        "applied_discount": capped_discount,
        "was_discount_interception_triggered": was_discount_capped,
        "unit_economics": {
            "retail_price": retail_price,
            "cost_price": cost_price,
            "final_price": round(discounted_price, 2),
            "net_margin_percent": round(net_margin_percent, 2),
            "required_margin_floor": min_margin
        }
    }
    
    if was_discount_capped:
        log_event(
            step="SAFETY_GATE_INTERCEPT",
            agent_phase="GATING",
            status="INTERCEPTED",
            detail=f"Proposed discount {proposed_discount_percent}% exceeded ceiling. Intercepted and capped to {max_discount}%.",
            payload=result
        )
    else:
        log_event(
            step="SAFETY_GATE_VERIFICATION",
            agent_phase="GATING",
            status="SUCCESS" if approved else "WARN",
            detail=f"Financial verification result: {'APPROVED' if approved else 'REJECTED'}",
            payload=result
        )
        
    return json.dumps(result)


@tool
def execute_razorpay_order_dispatch(chat_id: int, product_name: str, final_amount_inr: float) -> str:
    """
    MONEY ACTION TOOL. Creates an official Razorpay payment link and dispatches 
    an interactive offer directly to the customer's Telegram chat.
    """
    log_event(
        step="MONEY_ACTION_EXECUTION",
        agent_phase="EXECUTION",
        status="INFO",
        detail=f"Requesting Razorpay payment link for ₹{final_amount_inr:.2f} ({product_name})"
    )
    
    try:
        payment_payload = {
            "amount": int(final_amount_inr * 100),  
            "currency": "INR",
            "accept_partial": False,
            "description": f"Post-Purchase Addon: {product_name}",
            "customer": {
                "name": "Hackathon Demo Evaluator",
                "email": "demo.evaluator@example.com",
                "contact": "+919876543210"
            },
            "notify": {"sms": False, "email": False}
        }
        
        link_response = razorpay_client.payment_link.create(payment_payload)
        payment_url = link_response["short_url"]
        
        log_event(
            step="RAZORPAY_LINK_CREATED",
            agent_phase="EXECUTION",
            status="SUCCESS",
            detail=f"Generated secure payment link: {payment_url}"
        )
        
        message_text = (
            f"⚡ *Exclusive Post-Purchase Offer*\n\n"
            f"Upgrade your order with *{product_name}* for just *₹{final_amount_inr:.2f}*!\n\n"
            f"🛡️ _Validated by AI Risk Engine & Secured by Razorpay._"
        )
        
        keyboard = InlineKeyboardMarkup([
            [InlineKeyboardButton("💳 Complete Checkout Now", url=payment_url)]
        ])
        
        asyncio.run(
            telegram_bot.send_message(
                chat_id=chat_id,
                text=message_text,
                parse_mode="Markdown",
                reply_markup=keyboard
            )
        )
        
        log_event(
            step="TELEGRAM_DISPATCH",
            agent_phase="COMPLETION",
            status="SUCCESS",
            detail=f"Offer message successfully delivered to Telegram chat ID {chat_id}"
        )
        
        return json.dumps({"status": "SUCCESS", "payment_url": payment_url})
        
    except Exception as e:
        log_event(
            step="EXECUTION_FAILURE",
            agent_phase="EXECUTION",
            status="ERROR",
            detail=f"Money action failed: {str(e)}"
        )
        return json.dumps({"status": "ERROR", "message": str(e)})

# ==========================================
# 3. TOOL BINDING & LLM INITIALIZATION
# ==========================================

tools = [fetch_upsell_candidates, evaluate_financial_safety_gate, execute_razorpay_order_dispatch]
tool_map = {t.name: t for t in tools}

llm = ChatGroq(
    model_name="openai/gpt-oss-120b",
    temperature=0
).bind_tools(tools)

# ==========================================
# 4. API REQUEST SCHEMAS & WORKFLOW
# ==========================================

class TriggerPurchaseRequest(BaseModel):
    chat_id: int = Field(..., description="Telegram Numerical Chat ID")
    item_bought: str = Field("Sony Alpha Camera", description="Item bought by customer")

class StockToggleRequest(BaseModel):
    product_id: str
    in_stock: bool

def run_agent_workflow(chat_id: int, item_bought: str):
    log_event(
        step="EVENT_RECEIVED",
        agent_phase="TRIGGER",
        status="INFO",
        detail=f"Webhook received: Customer completed purchase of '{item_bought}'"
    )
    
    system_instruction = (
        "You are an autonomous AI Merchant Growth Engine. "
        "1. Call `fetch_upsell_candidates` for the item bought. "
        "2. Find the first candidate that has in_stock = True (skip any with in_stock = False). "
        "3. Propose a starting 25% discount and ALWAYS call `evaluate_financial_safety_gate` before taking any action. "
        "4. Call `execute_razorpay_order_dispatch` with the final approved amount returned by the safety gate."
    )
    
    messages = [
        SystemMessage(content=system_instruction),
        HumanMessage(content=f"Customer in Chat ID {chat_id} purchased '{item_bought}'. Find an optimal upsell, verify safety gate, and dispatch payment offer.")
    ]

    try:
        for _ in range(5):
            response = llm.invoke(messages)
            messages.append(response)

            if not response.tool_calls:
                break

            for tool_call in response.tool_calls:
                tool_name = tool_call["name"]
                tool_args = tool_call["args"]
                selected_tool = tool_map[tool_name]
                
                tool_output = selected_tool.invoke(tool_args)
                messages.append(
                    ToolMessage(
                        content=str(tool_output),
                        tool_call_id=tool_call["id"]
                    )
                )

        log_event(
            step="WORKFLOW_COMPLETE",
            agent_phase="FINISHED",
            status="SUCCESS",
            detail="Autonomous agent workflow successfully finished."
        )
    except Exception as e:
        log_event(
            step="AGENT_EXCEPTION",
            agent_phase="FAILED",
            status="ERROR",
            detail=f"Unhandled workflow exception: {str(e)}"
        )

@app.post("/api/trigger-upsell")
async def trigger_upsell_endpoint(payload: TriggerPurchaseRequest, background_tasks: BackgroundTasks):
    background_tasks.add_task(run_agent_workflow, payload.chat_id, payload.item_bought)
    return {"status": "ORCHESTRATION_STARTED", "chat_id": payload.chat_id}

@app.get("/api/audit-trail")
async def get_audit_trail():
    """Returns audit_logs directly as a JSON array to prevent frontend mapping crashes[cite: 2]."""
    try:
        if not isinstance(audit_logs, list):
            return []
        return audit_logs
    except Exception:
        return []

@app.post("/api/audit-trail/clear")
async def clear_audit_trail():
    global audit_logs
    audit_logs = []
    return {"status": "CLEARED"}

@app.post("/api/toggle-stock")
async def toggle_stock(payload: StockToggleRequest):
    if payload.product_id in DATABASE["products"]:
        DATABASE["products"][payload.product_id]["stock"] = 10 if payload.in_stock else 0
        status_str = "IN_STOCK" if payload.in_stock else "OUT_OF_STOCK"
        log_event(
            step="INVENTORY_SIMULATION_TOGGLE",
            agent_phase="DEMO_CONTROL",
            status="WARN",
            detail=f"Product '{payload.product_id}' stock toggled to {status_str}"
        )
        return {"status": "UPDATED", "product_id": payload.product_id, "stock": DATABASE["products"][payload.product_id]["stock"]}
    raise HTTPException(status_code=404, detail="Product not found")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)