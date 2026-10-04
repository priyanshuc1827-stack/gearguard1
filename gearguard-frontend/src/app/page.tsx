"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import {
  Shield,
  Activity,
  Zap,
  Trello,
  HardDrive,
  BarChart3,
  Calendar,
  Users,
  ClipboardList,
  ChevronRight,
  ArrowRight,
  CheckCircle2,
  Cpu,
  Wrench,
  AlertTriangle,
  TrendingUp,
  Lock,
  Globe,
  Star,
  PlayCircle,
} from "lucide-react";

/* ─── useInView hook ─────────────────────────────────────────── */
function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setInView(true); },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, inView };
}

/* ─── AnimatedCounter ────────────────────────────────────────── */
function AnimatedCounter({ end, suffix = "", duration = 2000 }: { end: number; suffix?: string; duration?: number }) {
  const [count, setCount] = useState(0);
  const { ref, inView } = useInView();
  useEffect(() => {
    if (!inView) return;
    let start = 0;
    const step = end / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= end) { setCount(end); clearInterval(timer); }
      else setCount(Math.floor(start));
    }, 16);
    return () => clearInterval(timer);
  }, [inView, end, duration]);
  return <span ref={ref}>{count.toLocaleString()}{suffix}</span>;
}

/* ─── FeatureCard ────────────────────────────────────────────── */
function FeatureCard({ icon: Icon, color, title, desc, delay = 0 }: { icon: React.ElementType; color: string; title: string; desc: string; delay?: number }) {
  const { ref, inView } = useInView();
  return (
    <div
      ref={ref}
      className="glass-card p-6 flex flex-col gap-4 group cursor-default"
      style={{ opacity: inView ? 1 : 0, transform: inView ? "translateY(0)" : "translateY(24px)", transition: `opacity 0.5s ease ${delay}ms, transform 0.5s ease ${delay}ms` }}
    >
      <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${color}18`, border: `1px solid ${color}30` }}>
        <Icon size={20} style={{ color }} />
      </div>
      <div>
        <h3 className="font-bold text-base mb-1" style={{ color: "#e8eaf2" }}>{title}</h3>
        <p className="text-sm leading-relaxed" style={{ color: "#64748b" }}>{desc}</p>
      </div>
      <div className="mt-auto flex items-center gap-1 text-xs font-semibold opacity-0 group-hover:opacity-100" style={{ color, transition: "opacity 0.25s" }}>
        Learn more <ChevronRight size={12} />
      </div>
    </div>
  );
}

/* ─── RoleBadge ──────────────────────────────────────────────── */
function RoleBadge({ role, color, desc }: { role: string; color: string; desc: string }) {
  return (
    <div className="flex items-start gap-3 p-4 rounded-xl" style={{ background: `${color}0d`, border: `1px solid ${color}20` }}>
      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: `${color}20` }}>
        <Lock size={14} style={{ color }} />
      </div>
      <div>
        <p className="font-bold text-sm" style={{ color }}>{role}</p>
        <p className="text-xs mt-0.5" style={{ color: "#64748b" }}>{desc}</p>
      </div>
    </div>
  );
}

/* ─── WorkflowStep ───────────────────────────────────────────── */
function WorkflowStep({ num, title, desc, color }: { num: string; title: string; desc: string; color: string }) {
  const { ref, inView } = useInView();
  return (
    <div ref={ref} className="flex gap-5 items-start" style={{ opacity: inView ? 1 : 0, transform: inView ? "translateX(0)" : "translateX(-24px)", transition: "opacity 0.5s ease, transform 0.5s ease" }}>
      <div className="w-10 h-10 rounded-full flex items-center justify-center font-black text-sm flex-shrink-0" style={{ background: `${color}20`, color, border: `2px solid ${color}40` }}>
        {num}
      </div>
      <div>
        <h4 className="font-bold text-sm mb-1" style={{ color: "#e8eaf2" }}>{title}</h4>
        <p className="text-sm" style={{ color: "#64748b" }}>{desc}</p>
      </div>
    </div>
  );
}

/* ─── StatCard ───────────────────────────────────────────────── */
function StatCard({ end, suffix, label, color }: { end: number; suffix: string; label: string; color: string }) {
  return (
    <div className="text-center p-6 glass-card">
      <p className="text-3xl md:text-4xl font-black mb-1" style={{ color }}>
        <AnimatedCounter end={end} suffix={suffix} />
      </p>
      <p className="text-xs uppercase tracking-widest font-semibold" style={{ color: "#64748b" }}>{label}</p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   LANDING PAGE
═══════════════════════════════════════════════════════════════ */
export default function LandingPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const user = localStorage.getItem("user");
    setIsLoggedIn(!!user);
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const features = [
    { icon: HardDrive,     color: "#10b981", title: "Smart Equipment Catalog",   desc: "Centralized inventory with serial numbers, warranty dates, technician assignments, and live status tracking." },
    { icon: Trello,        color: "#6366f1", title: "Kanban Workflow Board",      desc: "Interactive drag-and-drop board to transition requests across New → In Progress → Repaired → Scrap stages." },
    { icon: Calendar,      color: "#06b6d4", title: "Maintenance Calendar",       desc: "Visual timeline scheduler for preventive checkups, technician assignments, and recurring maintenance cycles." },
    { icon: BarChart3,     color: "#f59e0b", title: "Analytics & Reporting",      desc: "Real-time MTTR, MTBF, downtime expense distribution, and high-risk equipment performance charts." },
    { icon: Users,         color: "#f43f5e", title: "Role-Based Access Control",  desc: "Tailored dashboards for Admin, Manager, Technician, Operator, and Auditor — each with scoped permissions." },
    { icon: ClipboardList, color: "#10b981", title: "Audit Trail",                desc: "Tamper-evident logging of every status transition, equipment allocation, and technician action." },
    { icon: Wrench,        color: "#06b6d4", title: "Corrective Maintenance",     desc: "Log emergency breakdowns, assign technicians instantly, and track resolution time end-to-end." },
    { icon: AlertTriangle, color: "#f59e0b", title: "Preventive Maintenance",     desc: "Automate recurring maintenance schedules and receive proactive alerts before failures occur." },
  ];

  const roles = [
    { role: "Admin",      color: "#f43f5e", desc: "Full system access — team & user management, equipment creation" },
    { role: "Manager",    color: "#6366f1", desc: "Asset approvals, maintenance request triage, analytics dashboard" },
    { role: "Technician", color: "#10b981", desc: "Kanban task transitions, request updates, time tracking" },
    { role: "Operator",   color: "#06b6d4", desc: "Asset breakdown reporting, self-service maintenance requests" },
    { role: "Auditor",    color: "#f59e0b", desc: "Read-only compliance audits, system log inspections, reports" },
  ];

  const workflow = [
    { num: "01", color: "#10b981", title: "Register Equipment",      desc: "Add machines with serial numbers, warranty terms, work-center locations, and assigned maintenance teams." },
    { num: "02", color: "#6366f1", title: "Log Maintenance Request",  desc: "Create a corrective breakdown report or schedule a routine preventive checkup in minutes." },
    { num: "03", color: "#06b6d4", title: "Kanban Lifecycle",         desc: "Drag & drop tasks across stages: New Request → In Progress → Repaired or Scrap." },
    { num: "04", color: "#f59e0b", title: "Auto Status Sync",         desc: "Moving to Repaired auto-updates last_maintenance_date. Scrap flags the machine across inventory." },
    { num: "05", color: "#f43f5e", title: "Analytics & CI",           desc: "Review MTTR, breakdown frequencies, and team efficiency to optimize plant reliability continuously." },
  ];

  const trustItems = [
    { icon: CheckCircle2, label: "RBAC Security",      color: "#10b981" },
    { icon: TrendingUp,   label: "Real-time MTTR",     color: "#06b6d4" },
    { icon: Globe,        label: "Odoo-Inspired ERP",  color: "#6366f1" },
    { icon: Star,         label: "Built for Industry", color: "#f59e0b" },
  ];

  const techStack = [
    { name: "Next.js 15",    color: "#e8eaf2" },
    { name: "FastAPI",       color: "#10b981" },
    { name: "MongoDB",       color: "#4db33d" },
    { name: "TypeScript",    color: "#3178c6" },
    { name: "Tailwind CSS",  color: "#06b6d4" },
    { name: "Radix UI",      color: "#6366f1" },
    { name: "TanStack Query",color: "#f59e0b" },
    { name: "Recharts",      color: "#f43f5e" },
  ];

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#0b0f19", overflowX: "hidden" }}>

      {/* ─── NAVBAR ──────────────────────────────────────────── */}
      <nav
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-12 h-16"
        style={{
          background: scrolled ? "rgba(11,15,25,0.92)" : "transparent",
          backdropFilter: scrolled ? "blur(20px)" : "none",
          borderBottom: scrolled ? "1px solid rgba(148,163,184,0.08)" : "none",
          transition: "background 0.3s, border-bottom 0.3s",
        }}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.3)" }}>
            <Zap size={16} style={{ color: "#10b981" }} />
          </div>
          <span className="font-black text-lg tracking-tight" style={{ color: "#e8eaf2" }}>
            Gear<span style={{ color: "#10b981" }}>Guard</span>
          </span>
        </div>

        <div className="hidden md:flex items-center gap-8">
          {["Features", "Workflow", "Roles", "Stats"].map((item) => (
            <a key={item} href={`#${item.toLowerCase()}`} className="text-sm font-medium" style={{ color: "#64748b" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#10b981")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#64748b")}
            >{item}</a>
          ))}
        </div>

        <div className="flex items-center gap-3">
          {!isLoggedIn && (
            <Link href="/login">
              <button className="hidden sm:block text-sm font-semibold px-4 py-2 rounded-lg" style={{ color: "#10b981", border: "1px solid rgba(16,185,129,0.3)", background: "transparent" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(16,185,129,0.1)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
              >Sign In</button>
            </Link>
          )}
          <Link href={isLoggedIn ? "/dashboard" : "/login"}>
            <button className="btn-glow text-sm font-bold px-5 py-2 rounded-lg">{isLoggedIn ? "Dashboard →" : "Get Started →"}</button>
          </Link>
        </div>
      </nav>

      {/* ─── HERO ────────────────────────────────────────────── */}
      <section className="relative flex flex-col items-center justify-center min-h-screen px-6 pt-24 pb-16 text-center">
        {/* Glow orbs */}
        <div className="absolute pointer-events-none" style={{ top: "15%", left: "50%", transform: "translateX(-50%)", width: "700px", height: "350px", background: "radial-gradient(ellipse, rgba(16,185,129,0.1) 0%, transparent 70%)", filter: "blur(60px)" }} />
        <div className="absolute pointer-events-none" style={{ top: "40%", left: "20%", width: "300px", height: "300px", background: "radial-gradient(ellipse, rgba(99,102,241,0.06) 0%, transparent 70%)", filter: "blur(40px)" }} />
        <div className="absolute pointer-events-none" style={{ top: "30%", right: "15%", width: "250px", height: "250px", background: "radial-gradient(ellipse, rgba(6,182,212,0.06) 0%, transparent 70%)", filter: "blur(40px)" }} />

        <div className="relative w-full max-w-5xl space-y-8 animate-fade-in-up">
          {/* Badge */}
          <div className="flex items-center justify-center">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-widest" style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.25)", color: "#10b981" }}>
              <div className="beacon beacon-green" style={{ width: 6, height: 6 }} />
              Intelligent Asset Maintenance Platform
            </div>
          </div>

          {/* Heading */}
          <h1 className="text-5xl md:text-7xl xl:text-8xl font-black tracking-tight leading-none" style={{ color: "#e8eaf2" }}>
            The Control Panel
            <br />
            <span style={{ background: "linear-gradient(135deg, #10b981, #06b6d4)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              Your Plant Deserves
            </span>
          </h1>

          {/* Subheading */}
          <p className="text-lg md:text-xl max-w-2xl mx-auto leading-relaxed" style={{ color: "#64748b" }}>
            GearGuard bridges physical machinery, plant technicians, managers, and repair workflows.
            Eliminate downtime. Optimize maintenance. Operate with confidence.
          </p>

          {/* CTA row */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-2">
            <Link href={isLoggedIn ? "/dashboard" : "/login"}>
              <button className="btn-glow inline-flex items-center gap-2 px-8 text-sm font-bold rounded-xl" style={{ height: "3.25rem" }}>
                {isLoggedIn ? "Resume Dashboard" : "Access Control Panel"}
                <ArrowRight size={16} />
              </button>
            </Link>
            <a href="#features">
              <button className="inline-flex items-center gap-2 px-8 text-sm font-semibold rounded-xl transition-all"
                style={{ height: "3.25rem", border: "1px solid rgba(148,163,184,0.15)", color: "#94a3b8", background: "rgba(148,163,184,0.05)" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(16,185,129,0.3)"; (e.currentTarget as HTMLButtonElement).style.color = "#10b981"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(148,163,184,0.15)"; (e.currentTarget as HTMLButtonElement).style.color = "#94a3b8"; }}
              >
                <PlayCircle size={16} /> Explore Features
              </button>
            </a>
          </div>

          {/* Trust strip */}
          <div className="flex flex-wrap items-center justify-center gap-6" style={{ borderTop: "1px solid rgba(148,163,184,0.07)", marginTop: "1.5rem", paddingTop: "1.5rem" }}>
            {trustItems.map(({ icon: Icon, label, color }, i) => (
              <div key={i} className="flex items-center gap-2">
                <Icon size={14} style={{ color }} />
                <span className="text-xs font-semibold" style={{ color: "#64748b" }}>{label}</span>
              </div>
            ))}
          </div>
        </div>

      </section>

      {/* ─── STATS ───────────────────────────────────────────── */}
      <section id="stats" className="px-6 md:px-12 py-20">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard end={1200} suffix="+"      label="Assets Tracked"  color="#10b981" />
          <StatCard end={98}   suffix="%"      label="Uptime Accuracy" color="#06b6d4" />
          <StatCard end={5}    suffix=" Roles" label="RBAC Profiles"   color="#6366f1" />
          <StatCard end={2450} suffix=" hrs"   label="Avg MTBF"        color="#f59e0b" />
        </div>
      </section>

      {/* ─── FEATURES ────────────────────────────────────────── */}
      <section id="features" className="px-6 md:px-12 py-20">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest mb-4" style={{ background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)", color: "#6366f1" }}>
              <Cpu size={10} /> Platform Capabilities
            </div>
            <h2 className="text-3xl md:text-4xl font-black mb-3" style={{ color: "#e8eaf2" }}>
              Everything you need to <span style={{ color: "#10b981" }}>run a smart plant</span>
            </h2>
            <p className="text-base max-w-xl mx-auto" style={{ color: "#64748b" }}>
              From breakdown logging to audit compliance — GearGuard covers the full maintenance lifecycle.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {features.map((f, i) => <FeatureCard key={i} {...f} delay={i * 60} />)}
          </div>
        </div>
      </section>

      {/* ─── WORKFLOW ────────────────────────────────────────── */}
      <section id="workflow" className="px-6 md:px-12 py-20">
        <div className="max-w-5xl mx-auto rounded-2xl p-8 md:p-14 relative overflow-hidden" style={{ background: "#0d1525", border: "1px solid rgba(148,163,184,0.08)" }}>
          <div className="absolute pointer-events-none" style={{ top: "-60px", right: "-60px", width: "300px", height: "300px", background: "radial-gradient(ellipse, rgba(16,185,129,0.06) 0%, transparent 70%)", filter: "blur(40px)" }} />
          <div className="grid md:grid-cols-2 gap-12 items-start relative">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest mb-5" style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)", color: "#10b981" }}>
                <Activity size={10} /> Core Workflow
              </div>
              <h2 className="text-3xl md:text-4xl font-black mb-4" style={{ color: "#e8eaf2" }}>
                From breakdown to<br /><span style={{ color: "#10b981" }}>resolution — fast.</span>
              </h2>
              <p className="text-base mb-8" style={{ color: "#64748b" }}>
                GearGuard automates every step of the maintenance lifecycle so your team focuses on fixing, not filing.
              </p>
              <Link href={isLoggedIn ? "/kanban" : "/login"}>
                <button className="btn-glow inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold">
                  Open Kanban Board <ArrowRight size={14} />
                </button>
              </Link>
            </div>
            <div className="flex flex-col gap-6">
              {workflow.map((step) => <WorkflowStep key={step.num} {...step} />)}
            </div>
          </div>
        </div>
      </section>

      {/* ─── ROLES ───────────────────────────────────────────── */}
      <section id="roles" className="px-6 md:px-12 py-20">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest mb-4" style={{ background: "rgba(244,63,94,0.1)", border: "1px solid rgba(244,63,94,0.2)", color: "#f43f5e" }}>
              <Shield size={10} /> Access Control
            </div>
            <h2 className="text-3xl md:text-4xl font-black mb-3" style={{ color: "#e8eaf2" }}>
              Built for every <span style={{ color: "#6366f1" }}>team member</span>
            </h2>
            <p className="text-base max-w-xl mx-auto" style={{ color: "#64748b" }}>
              Role-based dashboards ensure each team member sees exactly what they need — nothing more, nothing less.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {roles.map((r) => <RoleBadge key={r.role} {...r} />)}
            <div className="flex flex-col items-center justify-center p-6 rounded-xl text-center" style={{ background: "rgba(16,185,129,0.05)", border: "1px dashed rgba(16,185,129,0.2)" }}>
              <p className="text-sm font-bold mb-2" style={{ color: "#10b981" }}>Try any role now</p>
              <p className="text-xs mb-4" style={{ color: "#64748b" }}>Use demo accounts with pre-seeded data</p>
              <Link href="/login">
                <button className="btn-glow text-xs font-bold px-5 py-2 rounded-lg">View Demo →</button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ─── TECH STACK ──────────────────────────────────────── */}
      <section className="px-6 md:px-12 py-12">
        <div className="max-w-5xl mx-auto py-8 px-8 rounded-2xl" style={{ background: "rgba(13,21,37,0.7)", border: "1px solid rgba(148,163,184,0.07)" }}>
          <p className="text-center text-[10px] uppercase tracking-widest font-bold mb-8" style={{ color: "#1e2840" }}>Powered By</p>
          <div className="flex flex-wrap items-center justify-center gap-8 md:gap-12">
            {techStack.map((tech) => (
              <span key={tech.name} className="text-sm font-bold tracking-tight" style={{ color: tech.color, opacity: 0.7 }}>{tech.name}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FINAL CTA ───────────────────────────────────────── */}
      <section className="px-6 md:px-12 py-24">
        <div className="max-w-4xl mx-auto text-center rounded-3xl p-12 md:p-16 relative overflow-hidden"
          style={{ background: "linear-gradient(135deg, rgba(16,185,129,0.08) 0%, rgba(99,102,241,0.08) 100%)", border: "1px solid rgba(16,185,129,0.15)" }}
        >
          <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(16,185,129,0.1) 0%, transparent 60%)" }} />
          <div className="relative">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-widest mb-6" style={{ background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.25)", color: "#10b981" }}>
              <Zap size={10} /> Ready to Deploy
            </div>
            <h2 className="text-3xl md:text-5xl font-black mb-4" style={{ color: "#e8eaf2" }}>
              Take control of your{" "}
              <span style={{ background: "linear-gradient(135deg, #10b981, #06b6d4)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                industrial assets
              </span>
            </h2>
            <p className="text-base md:text-lg mb-8 max-w-xl mx-auto" style={{ color: "#64748b" }}>
              Join teams that trust GearGuard to eliminate unplanned downtime, reduce repair costs, and keep every machine running at peak performance.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href={isLoggedIn ? "/dashboard" : "/login"}>
                <button className="btn-glow inline-flex items-center gap-2 px-10 py-3.5 rounded-xl text-sm font-bold">
                  {isLoggedIn ? "Open Dashboard" : "Access Control Panel"} <ArrowRight size={16} />
                </button>
              </Link>
              <a href="#features">
                <button className="inline-flex items-center gap-2 px-10 py-3.5 rounded-xl text-sm font-semibold transition-all"
                  style={{ border: "1px solid rgba(148,163,184,0.15)", color: "#94a3b8", background: "transparent" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(16,185,129,0.3)"; (e.currentTarget as HTMLButtonElement).style.color = "#10b981"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(148,163,184,0.15)"; (e.currentTarget as HTMLButtonElement).style.color = "#94a3b8"; }}
                >Explore Features</button>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ─── FOOTER ──────────────────────────────────────────── */}
      <footer className="px-6 md:px-12 py-8" style={{ borderTop: "1px solid rgba(148,163,184,0.06)" }}>
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.3)" }}>
              <Zap size={12} style={{ color: "#10b981" }} />
            </div>
            <span className="font-black text-sm" style={{ color: "#e8eaf2" }}>
              Gear<span style={{ color: "#10b981" }}>Guard</span>
            </span>
          </div>
          <div className="flex items-center gap-6">
            {["Features", "Workflow", "Roles", "Dashboard"].map((item) => (
              <a key={item} href={item === "Dashboard" ? (isLoggedIn ? "/dashboard" : "/login") : `#${item.toLowerCase()}`}
                className="text-xs font-medium" style={{ color: "#1e2840" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#10b981")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#1e2840")}
              >{item}</a>
            ))}
          </div>
          <p className="text-[10px] uppercase tracking-widest" style={{ color: "#1e2840" }}>
            GearGuard &copy; 2026 &middot; Secure Terminal v4.0
          </p>
        </div>
      </footer>

    </div>
  );
}