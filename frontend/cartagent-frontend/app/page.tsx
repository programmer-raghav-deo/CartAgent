"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  CheckCircle2, AlertTriangle, XCircle, ArrowRight, 
  ShieldCheck, RefreshCw, Terminal, CreditCard, 
  Activity, Server, Lock, Loader2 
} from "lucide-react";

interface AuditLog {
  id: string;
  timestamp: string;
  step: string;
  phase: string;
  status: string;
  detail: string;
  payload?: any;
}

export default function Dashboard() {
  const [chatId, setChatId] = useState("8779946329");
  const [selectedItem, setSelectedItem] = useState("Sony Alpha Camera");
  const [simulateStockOut, setSimulateStockOut] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const terminalEndRef = useRef<HTMLDivElement>(null);
  
  // Track previous log length to prevent redundant scroll jumps on polling updates
  const prevLogsLengthRef = useRef(0);

  // Poll audit logs safely
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch("http://localhost:8000/api/audit-trail");
        const data = await res.json();
        if (Array.isArray(data)) {
          setLogs(data);
        }
      } catch (err) {
        // Silent catch for polling
      }
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Smooth scroll ONLY when a new log entry is appended
  useEffect(() => {
    if (logs.length > prevLogsLengthRef.current) {
      terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    prevLogsLengthRef.current = logs.length;
  }, [logs]);

  const handleCheckout = async () => {
    setIsLoading(true);
    try {
      if (simulateStockOut) {
        await fetch("http://localhost:8000/api/toggle-stock", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ product_id: "lens_50mm", in_stock: false }),
        });
      }

      await fetch("http://localhost:8000/api/trigger-upsell", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, item_bought: selectedItem }),
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const clearConsole = async () => {
    await fetch("http://localhost:8000/api/audit-trail/clear", { method: "POST" });
    setLogs([]);
    prevLogsLengthRef.current = 0;
  };

  return (
    <div className="min-h-screen bg-[#F4F5F8] text-slate-800 font-sans antialiased">
      {/* Premium SaaS Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-3 flex justify-between items-center sticky top-0 z-50 shadow-sm">
        <div className="flex items-center space-x-4">
          <div className="flex items-center justify-center w-8 h-8 bg-blue-600 rounded-lg shadow-inner">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 leading-tight tracking-tight">CARTAGENT</h1>
            <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Agentic Commerce Runtime</p>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 text-[13px] font-medium text-slate-600 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-200">
            <Lock className="w-3.5 h-3.5 text-slate-400" />
            <span>Test Mode</span>
          </div>
          <div className="flex items-center space-x-2 text-[13px] font-medium text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-200">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span>Razorpay Connected</span>
          </div>
        </div>
      </header>

      {/* Main Dashboard Grid */}
      <main className="max-w-[1400px] mx-auto p-6 md:p-8 grid grid-cols-1 xl:grid-cols-12 gap-8">
        
        {/* Left Column: Config & Metrics */}
        <section className="xl:col-span-4 space-y-6">
          
          {/* Order Emulator Card */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-[0_2px_10px_rgba(0,0,0,0.02)] overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center space-x-2">
              <CreditCard className="w-4 h-4 text-blue-600" />
              <h2 className="text-sm font-semibold text-slate-800">Checkout Emulator</h2>
            </div>

            <div className="p-5 space-y-5">
              <div className="space-y-1.5">
                <label className="block text-[13px] font-semibold text-slate-700">
                  Telegram Chat ID
                </label>
                <input
                  type="text"
                  value={chatId}
                  onChange={(e) => setChatId(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-slate-50 hover:bg-slate-100/50"
                  placeholder="Enter Recipient ID"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[13px] font-semibold text-slate-700">
                  Trigger Event (Purchase)
                </label>
                <select
                  value={selectedItem}
                  onChange={(e) => setSelectedItem(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-slate-50 cursor-pointer"
                >
                  <option value="Sony Alpha Camera">Sony Alpha Camera (₹80,000)</option>
                </select>
              </div>

              {/* iOS Style Toggle */}
              <div className="pt-2">
                <label className="flex items-start justify-between p-4 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100/50 transition-colors group">
                  <div className="pr-4">
                    <span className="block text-[13px] font-semibold text-slate-800 group-hover:text-blue-600 transition-colors">
                      Simulate Primary Stock-Out
                    </span>
                    <span className="block text-[12px] text-slate-500 mt-1 leading-relaxed">
                      Force agent to handle inventory failure and fallback to alternative cross-sell.
                    </span>
                  </div>
                  <div className="relative inline-flex items-center cursor-pointer mt-1">
                    <input 
                      type="checkbox" 
                      checked={simulateStockOut}
                      onChange={(e) => setSimulateStockOut(e.target.checked)}
                      className="sr-only peer" 
                    />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                  </div>
                </label>
              </div>

              <button
                onClick={handleCheckout}
                disabled={isLoading}
                className="w-full mt-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-3 px-4 rounded-xl text-sm transition-all shadow-[0_2px_10px_rgba(37,99,235,0.2)] flex items-center justify-center space-x-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Executing Protocol...</span>
                  </>
                ) : (
                  <>
                    <span>Dispatch Agent Workflow</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Active Guardrails Card */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-[0_2px_10px_rgba(0,0,0,0.02)] overflow-hidden">
             <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center space-x-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <h2 className="text-sm font-semibold text-slate-800">Financial Guardrails</h2>
              </div>
              <span className="text-[10px] font-bold tracking-wider bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full uppercase">Active</span>
            </div>
            
            <div className="p-5 grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Max Discount</span>
                <div className="text-2xl font-bold text-slate-900 tracking-tight">20.0%</div>
                <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
                  <div className="bg-blue-600 h-1.5 rounded-full w-[20%]"></div>
                </div>
              </div>
              <div className="space-y-1 border-l border-slate-100 pl-4">
                <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Margin Floor</span>
                <div className="text-2xl font-bold text-slate-900 tracking-tight">15.0%</div>
                <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
                  <div className="bg-emerald-500 h-1.5 rounded-full w-[15%]"></div>
                </div>
              </div>
            </div>
          </div>

        </section>

        {/* Right Column: Sleek Terminal */}
        <section className="xl:col-span-8">
          <div className="bg-[#0A0D1E] rounded-2xl shadow-xl flex flex-col h-[740px] border border-slate-800/60 overflow-hidden ring-1 ring-white/10">
            
            {/* macOS / Browser style Header */}
            <div className="px-4 py-3 border-b border-slate-800/80 bg-[#0F132C] flex justify-between items-center">
              <div className="flex items-center space-x-4">
                <div className="flex space-x-1.5">
                  <div className="w-3 h-3 rounded-full bg-slate-700"></div>
                  <div className="w-3 h-3 rounded-full bg-slate-700"></div>
                  <div className="w-3 h-3 rounded-full bg-slate-700"></div>
                </div>
                <div className="flex items-center space-x-2 px-3 py-1 bg-[#1A1F3D] rounded-md border border-slate-700/50">
                  <Terminal className="w-3.5 h-3.5 text-blue-400" />
                  <span className="text-[11px] font-mono text-slate-300 tracking-wider">agent_runtime.log</span>
                </div>
              </div>
              
              <button
                onClick={clearConsole}
                className="text-[11px] font-medium text-slate-400 hover:text-white flex items-center space-x-1.5 transition-colors bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-md"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Clear Output</span>
              </button>
            </div>

            {/* Terminal Output Area */}
            <div className="p-5 overflow-y-auto font-mono text-[13px] space-y-4 flex-1 bg-[#0A0D1E] custom-scrollbar">
              {!Array.isArray(logs) || logs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-600 space-y-3">
                  <Server className="w-8 h-8 opacity-20" />
                  <p className="italic text-xs">Awaiting webhook trigger from checkout...</p>
                </div>
              ) : (
                logs.map((log) => (
                  <div key={log.id} className="group flex flex-col space-y-1 hover:bg-white/[0.02] -mx-2 px-2 py-1 rounded transition-colors">
                    <div className="flex items-start justify-between text-slate-400">
                      <div className="flex items-center space-x-3 flex-wrap">
                        <span className="text-slate-500 text-[11px]">{log.timestamp}</span>
                        <span className="text-blue-400 font-semibold">[{log.phase}]</span>
                        <span className="text-slate-200">{log.step}</span>
                      </div>
                      
                      {/* Status Indicators */}
                      <div className="flex-shrink-0 ml-4">
                        {log.status === "SUCCESS" && (
                          <span className="inline-flex items-center space-x-1 text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded text-[10px] font-bold border border-emerald-400/20">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>SUCCESS</span>
                          </span>
                        )}
                        {log.status === "GATED & CAPPED" && (
                          <span className="inline-flex items-center space-x-1 text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded text-[10px] font-bold border border-amber-400/20">
                            <AlertTriangle className="w-3 h-3" />
                            <span>INTERCEPTED</span>
                          </span>
                        )}
                        {log.status === "FAILED" && (
                          <span className="inline-flex items-center space-x-1 text-rose-400 bg-rose-400/10 px-2 py-0.5 rounded text-[10px] font-bold border border-rose-400/20">
                            <XCircle className="w-3 h-3" />
                            <span>FAILED</span>
                          </span>
                        )}
                        {log.status === "INFO" && (
                          <span className="inline-flex items-center text-slate-400 bg-slate-800 px-2 py-0.5 rounded text-[10px] font-bold">
                            INFO
                          </span>
                        )}
                      </div>
                    </div>

                    <p className="text-slate-300 pl-4 border-l-2 border-slate-800/80 ml-[18px] py-1 leading-relaxed">
                      {log.detail}
                    </p>
                  </div>
                ))
              )}
              <div ref={terminalEndRef} />
            </div>

            {/* Footer Bar */}
            <div className="px-4 py-2 bg-[#0F132C] border-t border-slate-800/80 text-[10px] font-mono text-slate-500 flex justify-between uppercase tracking-wider">
              <span className="flex items-center space-x-2">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                <span>Worker: Active</span>
              </span>
              <span>Memory: 24MB / Latency: 12ms</span>
            </div>

          </div>
        </section>

      </main>
    </div>
  );
}