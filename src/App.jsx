import React, { useState, useEffect, useMemo, createContext, useContext } from "react";

/* ============================================================
   RiskFlow360 — Full Platform
   Canada–Mexico Supplier Risk Intelligence
   Modules: Auth/Roles · Suppliers · Documents · Risk Engine ·
            Audits · USMCA Compliance · Alerts · Dashboard · CCBS ·
            Public Risk Assessment Questionnaire · Intake Requests
   Persistent storage via window.storage (swap for real DB in prod)
   ============================================================ */

// ---------- constants ----------
const RISK_CATEGORIES = [
  { key: "foodSafety", label: "Food Safety & Compliance", auto: false },
  { key: "quality", label: "Quality System (IATF/ISO)", auto: true },
  { key: "capacity", label: "Supplier Capacity", auto: true },
  { key: "traceability", label: "Traceability", auto: false },
  { key: "coldChain", label: "Cold Chain", auto: false },
  { key: "logistics", label: "Logistics & Border", auto: true },
  { key: "regulatory", label: "Regulatory / USMCA Docs", auto: true },
  { key: "financial", label: "Financial Stability", auto: true },
  { key: "continuity", label: "Business Continuity", auto: true },
  { key: "geopolitical", label: "Geopolitical / Regional", auto: true },
];

const SECTORS = ["Agriculture / Food", "Automotive", "Electronics", "Chemical", "Packaging", "Textiles", "Other"];
const MX_STATES = ["Baja California", "Chihuahua", "Coahuila", "Nuevo León", "Tamaulipas", "Jalisco", "Guanajuato", "Querétaro", "Estado de México", "Puebla", "Veracruz", "Sinaloa", "Sonora", "Michoacán", "Aguascalientes", "San Luis Potosí", "Other"];
const SUPPLIER_STATUS = ["Prospect", "Under Review", "Approved", "Conditional", "Suspended"];
const AUDIT_TYPES = ["On-site Mexico audit", "Remote document review", "Food safety readiness", "IATF 16949 / APQP-PPAP", "USMCA origin verification", "Continuity assessment"];
const CCBS_LEVELS = ["None", "CCBS Bronze", "CCBS Silver", "CCBS Gold", "CCBS Platinum"];
const CERT_TYPES = ["Primus GFS", "SQF", "BRCGS", "IATF 16949", "ISO 9001", "ISO 14001", "SENASICA", "FDA FSVP", "C-TPAT", "OEA (Mexico)"];
const CONCERN_TYPES = ["Quality issues", "Delivery delays", "Communication gaps", "Financial stability", "Certification / compliance gaps", "Safety or security concerns", "Single-source dependency", "Pricing volatility", "Other"];

const ROLES = {
  admin: "Administrator",
  auditor: "Auditor",
  client: "Canadian Client",
};

const uid = () => Math.random().toString(36).slice(2, 10);
const today = () => new Date().toISOString().slice(0, 10);
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };

// ---------- risk scoring ----------
function computeRisk(scores, weights) {
  const entries = RISK_CATEGORIES.map((c) => ({ v: Number(scores?.[c.key]) || 0, w: (weights?.[c.key] ?? 1) })).filter((e) => e.v > 0);
  if (entries.length === 0) return { score: null, tier: "Unrated", color: "#B4B2A9" };
  const wsum = entries.reduce((a, e) => a + e.w, 0);
  const avg = entries.reduce((a, e) => a + e.v * e.w, 0) / (wsum || 1);
  const score = Math.round(((avg - 1) / 4) * 100);
  let tier, color;
  if (score < 25) { tier = "Low"; color = "#0ca30c"; }
  else if (score < 50) { tier = "Moderate"; color = "#fab219"; }
  else if (score < 75) { tier = "High"; color = "#ec835a"; }
  else { tier = "Critical"; color = "#d03b3b"; }
  return { score, tier, color };
}

const TIER_COLOR = { Critical: "#d03b3b", High: "#ec835a", Moderate: "#fab219", Low: "#0ca30c", Unrated: "#B4B2A9" };
const SCORE_COLOR = { 1: "#0ca30c", 2: "#63991f", 3: "#fab219", 4: "#ec835a", 5: "#d03b3b" };

// ---------- persistence ----------
const DB = {
  async load(key, fallback) {
    try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : fallback; }
    catch { return fallback; }
  },
  async save(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} },
};

// ---------- seed data ----------
function seedData() {
  const s1 = uid(), s2 = uid(), s3 = uid();
  const suppliers = [
    {
      id: s1, name: "Agrícola del Valle S.A.", sector: "Agriculture / Food", product: "Fresh avocados & tomatoes",
      state: "Michoacán", contact: "Ana Ríos", email: "arios@agrivalle.mx", phone: "+52 443 555 0110",
      volume: "1,200 tons/yr", canadianBuyer: "Maple Foods Distributors (ON)", status: "Approved",
      certifications: ["Primus GFS", "SENASICA"], ccbs: "CCBS Silver", ccbsExpiry: addDays(today(), 210),
      scores: { foodSafety: 2, quality: 2, capacity: 2, traceability: 3, coldChain: 4, logistics: 3, regulatory: 2, financial: 2, continuity: 3, geopolitical: 2 },
      notes: "Strong food safety record. Cold-chain gaps flagged during summer months.",
      documents: [{ id: uid(), name: "Primus GFS Certificate 2026.pdf", type: "Certification", uploaded: today(), expiry: addDays(today(), 300) }],
    },
    {
      id: s2, name: "AutoPartes Norte", sector: "Automotive", product: "Stamped metal components (Tier 2)",
      state: "Nuevo León", contact: "Carlos Méndez", email: "cmendez@apnorte.mx", phone: "+52 81 555 0022",
      volume: "480k units/yr", canadianBuyer: "Ontario Drivetrain Systems", status: "Conditional",
      certifications: ["IATF 16949"], ccbs: "CCBS Bronze", ccbsExpiry: addDays(today(), 45),
      scores: { foodSafety: 1, quality: 2, capacity: 3, traceability: 2, coldChain: 1, logistics: 4, regulatory: 3, financial: 4, continuity: 4, geopolitical: 3 },
      notes: "Single-source for two components. Financial stability under review after 2025 downturn.",
      documents: [{ id: uid(), name: "IATF 16949 Cert.pdf", type: "Certification", uploaded: today(), expiry: addDays(today(), 120) }],
    },
    {
      id: s3, name: "Electrónica Bajío", sector: "Electronics", product: "PCB assemblies",
      state: "Guanajuato", contact: "Luisa Fernández", email: "lfernandez@ebajio.mx", phone: "+52 477 555 0088",
      volume: "90k units/yr", canadianBuyer: "Northern Circuits Inc (QC)", status: "Under Review",
      certifications: ["ISO 9001"], ccbs: "None", ccbsExpiry: "",
      scores: { quality: 3, capacity: 2, traceability: 3, logistics: 3, regulatory: 4, financial: 3, continuity: 3, geopolitical: 2 },
      notes: "New prospect. USMCA documentation incomplete — origin certificates pending.",
      documents: [],
    },
  ];
  const audits = [
    { id: uid(), supplierId: s1, date: addDays(today(), -20), type: "On-site Mexico audit", auditor: "L. Martinez", severity: "Minor", findings: "3 minor non-conformances in traceability records.", corrective: "Records digitized; re-check scheduled.", correctiveDue: addDays(today(), 10), status: "Closed" },
    { id: uid(), supplierId: s2, date: addDays(today(), -8), type: "IATF 16949 / APQP-PPAP", auditor: "L. Martinez", severity: "Major", findings: "PPAP documentation gaps on two part numbers.", corrective: "Supplier submitting corrected PPAP package.", correctiveDue: addDays(today(), 6), status: "In Progress" },
  ];
  return { suppliers, audits };
}

// ---------- app context ----------
const AppCtx = createContext(null);
const useApp = () => useContext(AppCtx);

function App() {
  const [loaded, setLoaded] = useState(false);
  const [user, setUser] = useState(null);
  const [suppliers, setSuppliers] = useState([]);
  const [audits, setAudits] = useState([]);
  const [weights, setWeights] = useState({});
  const [leads, setLeads] = useState([]);
  const [tab, setTab] = useState("dashboard");

  useEffect(() => {
    (async () => {
      const sess = await DB.load("rf360:session", null);
      const sup = await DB.load("rf360:suppliers", null);
      const aud = await DB.load("rf360:audits", null);
      const w = await DB.load("rf360:weights", {});
      const lds = await DB.load("rf360:leads", []);
      if (sup) { setSuppliers(sup); setAudits(aud || []); }
      else { const s = seedData(); setSuppliers(s.suppliers); setAudits(s.audits); }
      setWeights(w || {});
      setLeads(lds || []);
      if (sess) setUser(sess);
      setLoaded(true);
    })();
  }, []);

  useEffect(() => { if (loaded) DB.save("rf360:suppliers", suppliers); }, [suppliers, loaded]);
  useEffect(() => { if (loaded) DB.save("rf360:audits", audits); }, [audits, loaded]);
  useEffect(() => { if (loaded) DB.save("rf360:weights", weights); }, [weights, loaded]);
  useEffect(() => { if (loaded) DB.save("rf360:leads", leads); }, [leads, loaded]);

  const login = (u) => { setUser(u); DB.save("rf360:session", u); };
  const logout = () => { setUser(null); DB.save("rf360:session", null); setTab("dashboard"); };

  const ctx = {
    user, suppliers, setSuppliers, audits, setAudits, weights, setWeights, leads, setLeads, tab, setTab, login, logout,
  };

  if (!loaded) return <div style={{ padding: 60, textAlign: "center", color: "#64748B", fontFamily: "Inter, sans-serif" }}>Loading RiskFlow360…</div>;

  return (
    <AppCtx.Provider value={ctx}>
      <style>{GLOBAL_CSS}</style>
      {!user ? <PublicSite /> : <Shell />}
    </AppCtx.Provider>
  );
}

// ---------- public marketing site ----------
function PublicSite() {
  const [view, setView] = useState("home"); // home | how | solutions | pricing | login | assessment
  const go = (v) => { setView(v); window.scrollTo(0, 0); };
  if (view === "login") return <Login onBack={() => go("home")} />;
  if (view === "assessment") return <PubAssessment onBack={() => go("home")} />;
  return (
    <div style={P.page}>
      <PubNav view={view} go={go} />
      {view === "home" && <PubHome go={go} />}
      {view === "how" && <PubHow />}
      {view === "solutions" && <PubSolutions />}
      {view === "pricing" && <PubPricing go={go} />}
      <PubFooter />
    </div>
  );
}

function PubNav({ view, go }) {
  const tabs = [["home", "Home"], ["how", "How It Works"], ["solutions", "Solutions"], ["pricing", "Pricing"]];
  return (
    <nav style={P.nav}>
      <div style={P.navLogo} onClick={() => go("home")}>RiskFlow<span style={{ color: "#1D9E75" }}>360</span></div>
      <div style={P.navTabs}>
        {tabs.map(([k, l]) => (
          <button key={k} onClick={() => go(k)} style={{ ...P.navTab, ...(view === k ? P.navTabActive : {}) }}>{l}</button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <button style={P.navAssessBtn} onClick={() => go("assessment")}>Get Risk Assessment</button>
        <button style={P.navCta} onClick={() => go("login")}>Sign In</button>
      </div>
    </nav>
  );
}

function PubHome({ go }) {
  return (
    <div>
      <section style={P.hero}>
        <div style={P.heroBadge}>Canada–Mexico Supply Chain Intelligence</div>
        <h1 style={P.heroH1}>Know your Mexican suppliers<br /><span style={{ color: "#1D9E75" }}>before they become a risk.</span></h1>
        <p style={P.heroSub}>RiskFlow360 helps Canadian buyers evaluate, score, audit, and monitor Mexico-based suppliers — with real risk intelligence, USMCA compliance tracking, and continuous early-warning alerts in one platform.</p>
        <div style={P.heroBtns}>
          <button style={P.btnPrimary} onClick={() => go("assessment")}>Get a Free Risk Assessment →</button>
          <button style={P.btnGhost} onClick={() => go("login")}>Explore the Platform</button>
        </div>
        <div style={P.statRow}>
          {[["10", "Risk Categories"], ["360°", "Supplier Monitoring"], ["USMCA", "Compliance Ready"], ["CCBS™", "Certification Program"]].map(([n, l]) => (
            <div key={l} style={P.stat}><div style={P.statNum}>{n}</div><div style={P.statLbl}>{l}</div></div>
          ))}
        </div>
      </section>

      <section style={P.section}>
        <div style={P.secEyebrow}>The Problem</div>
        <h2 style={P.secH2}>Canadian buyers are flying blind on Mexican suppliers.</h2>
        <div style={P.cards3}>
          {[
            ["No visibility", "Buyers source from Mexico but have no reliable way to assess supplier risk, compliance, or stability."],
            ["Manual & reactive", "Supplier vetting lives in spreadsheets and email. Problems surface only after they disrupt production."],
            ["Compliance exposure", "USMCA origin documentation is scattered and audit-ready records are hard to produce when it matters."],
          ].map(([t, d]) => (
            <div key={t} style={P.card}><div style={P.cardTitle}>{t}</div><div style={P.cardText}>{d}</div></div>
          ))}
        </div>
      </section>

      <section style={{ ...P.section, background: "#F1F5F9" }}>
        <div style={P.secEyebrow}>The Solution</div>
        <h2 style={P.secH2}>One platform for supplier risk, audits & compliance.</h2>
        <div style={P.cards3}>
          {[
            ["Risk Scoring", "Every supplier scored across 10 weighted categories — food safety, quality, logistics, financial, continuity and more."],
            ["Audit Management", "Track on-site Mexico audits, findings, and corrective actions from a single system of record."],
            ["USMCA Compliance", "Certificate-of-origin tracking with 5-year US / 6-year Mexico retention, audit-ready on demand."],
            ["Early-Warning Alerts", "Automatic alerts when a supplier's risk climbs, a certification expires, or an action goes overdue."],
            ["CCBS™ Certification", "A proprietary Canada-Certified Border Supplier program that turns your standards into licensable IP."],
            ["Executive Dashboards", "A live portfolio view your team — and your Canadian clients — can act on every morning."],
          ].map(([t, d]) => (
            <div key={t} style={P.card}><div style={P.cardTitle}>{t}</div><div style={P.cardText}>{d}</div></div>
          ))}
        </div>
      </section>

      <section style={{ ...P.section, background: "#FFF7ED" }}>
        <div style={P.secEyebrow}>Why It Matters</div>
        <h2 style={P.secH2}>Common risks Canadian buyers face in Mexico right now.</h2>
        <div style={P.cards3}>
          {[
            ["Labor instability", "Wage disputes, turnover, and workforce shortages disrupting production schedules."],
            ["Security exposure", "Regional crime and security incidents affecting logistics routes and facility safety."],
            ["Regulatory shifts", "Changing USMCA origin rules and Mexican compliance requirements."],
            ["Single-source dependency", "Many buyers rely on one supplier per component with no qualified backup."],
          ].map(([t, d]) => (
            <div key={t} style={P.card}><div style={P.cardTitle}>{t}</div><div style={P.cardText}>{d}</div></div>
          ))}
        </div>
        <div style={{ textAlign: "center", marginTop: 30 }}>
          <button style={P.btnPrimary} onClick={() => go("assessment")}>Start Your Free Risk Assessment →</button>
        </div>
      </section>

      <section style={P.cta}>
        <h2 style={{ fontSize: 30, fontWeight: 800, margin: "0 0 12px", letterSpacing: "-0.02em" }}>See the platform in action</h2>
        <p style={{ fontSize: 16, color: "#94A3B8", margin: "0 0 26px" }}>Sign in to explore the full RiskFlow360 platform with live demo data.</p>
        <button style={P.btnPrimary} onClick={() => go("login")}>Explore the Platform →</button>
      </section>
    </div>
  );
}

function PubHow() {
  const steps = [
    ["01", "Onboard suppliers", "Add your Mexican suppliers — products, location, certifications, and the Canadian buyer they serve."],
    ["02", "Assess & score", "Rate each supplier across 10 risk categories. RiskFlow360 computes a weighted 0–100 score and risk tier."],
    ["03", "Audit on the ground", "Auditors log on-site Mexico audits, findings, and corrective actions — building a compliance record over time."],
    ["04", "Monitor & alert", "The platform watches continuously and raises early warnings before small issues become disruptions."],
    ["05", "Certify & report", "Issue CCBS™ certifications and generate executive reports your Canadian clients can rely on."],
  ];
  return (
    <section style={P.section}>
      <div style={P.secEyebrow}>How It Works</div>
      <h2 style={P.secH2}>From supplier onboarding to continuous monitoring.</h2>
      <div style={{ marginTop: 30 }}>
        {steps.map(([n, t, d]) => (
          <div key={n} style={P.stepRow}>
            <div style={P.stepNum}>{n}</div>
            <div><div style={P.cardTitle}>{t}</div><div style={{ ...P.cardText, maxWidth: 620 }}>{d}</div></div>
          </div>
        ))}
      </div>
    </section>
  );
}

function PubSolutions() {
  const secs = [
    ["Agriculture & Food", "Cold-chain integrity, food-safety certification (Primus GFS, SQF), and traceability for Canadian food importers sourcing produce and ingredients from Mexico."],
    ["Automotive", "Tier 1 / Tier 2 supplier risk for Ontario–Mexico supply chains — IATF 16949, PPAP/APQP verification, and single-source continuity monitoring."],
    ["Electronics", "Component supplier qualification, quality-system tracking, and USMCA origin documentation for cross-border electronics manufacturing."],
    ["For Canadian Buyers", "A live view of every supplier's risk, certifications, and audit status — so procurement decisions rest on current data, not last year's assumptions."],
  ];
  return (
    <section style={P.section}>
      <div style={P.secEyebrow}>Solutions</div>
      <h2 style={P.secH2}>Built for the industries that trade across the border.</h2>
      <div style={P.cards2}>
        {secs.map(([t, d]) => (
          <div key={t} style={P.card}><div style={P.cardTitle}>{t}</div><div style={P.cardText}>{d}</div></div>
        ))}
      </div>
    </section>
  );
}

function PubPricing({ go }) {
  const tiers = [
    ["Assessment", "Per-supplier audit", ["On-site Mexico supplier audit", "Full 10-category risk assessment", "Written findings report", "Corrective action plan"], false, "assessment"],
    ["Monitoring", "Monthly retainer", ["Everything in Assessment", "Continuous risk monitoring", "Early-warning alerts", "Quarterly executive reporting"], true, "login"],
    ["Platform", "Enterprise", ["Full RiskFlow360 platform access", "Unlimited suppliers & buyers", "CCBS™ certification program", "Custom risk-model weighting"], false, "login"],
  ];
  return (
    <section style={P.section}>
      <div style={P.secEyebrow}>Pricing</div>
      <h2 style={P.secH2}>Engagement models that grow with you.</h2>
      <p style={{ ...P.cardText, textAlign: "center", maxWidth: 560, margin: "0 auto 30px" }}>From a single supplier audit to a full monitoring platform. Final pricing is tailored to your supplier base and sector.</p>
      <div style={P.cards3}>
        {tiers.map(([name, sub, feats, hot, target]) => (
          <div key={name} style={{ ...P.priceCard, ...(hot ? P.priceCardHot : {}) }}>
            {hot && <div style={P.priceBadge}>Most Popular</div>}
            <div style={P.priceName}>{name}</div>
            <div style={P.priceSub}>{sub}</div>
            <div style={{ marginTop: 16 }}>
              {feats.map((f) => <div key={f} style={P.priceFeat}><span style={{ color: "#1D9E75" }}>✓</span> {f}</div>)}
            </div>
            <button style={{ ...(hot ? P.btnPrimary : P.btnGhost), width: "100%", marginTop: 20 }} onClick={() => go(target)}>Get Started</button>
          </div>
        ))}
      </div>
    </section>
  );
}

function PubFooter() {
  return (
    <footer style={P.footer}>
      <div style={{ fontWeight: 800, fontSize: 16 }}>RiskFlow<span style={{ color: "#1D9E75" }}>360</span></div>
      <div style={{ fontSize: 13, color: "#94A3B8" }}>Canada–Mexico Supplier Risk Intelligence</div>
      <div style={{ fontSize: 12, color: "#64748B" }}>© 2026 RiskFlow360</div>
    </footer>
  );
}

// ---------- public risk assessment questionnaire ----------
function PubAssessment({ onBack }) {
  const { setLeads } = useApp();
  const [f, setF] = useState({
    company: "", contact: "", email: "", phone: "",
    supplierName: "", sector: SECTORS[0], state: MX_STATES[0],
    relationshipLength: "", concerns: [], details: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const toggleConcern = (c) => setF((p) => ({ ...p, concerns: p.concerns.includes(c) ? p.concerns.filter((x) => x !== c) : [...p.concerns, c] }));

  const submit = () => {
    if (!f.company.trim() || !f.email.trim() || !f.supplierName.trim()) {
      setError("Please fill in your company name, email, and the supplier name.");
      return;
    }
    const lead = { id: uid(), submitted: today(), status: "New", ...f };
    setLeads((p) => [...p, lead]);
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div style={P.page}>
        <div style={{ ...P.section, textAlign: "center", maxWidth: 560 }}>
          <div style={P.heroBadge}>Request Received</div>
          <h2 style={{ fontSize: 26, fontWeight: 800, margin: "16px 0 12px" }}>Thanks — we've got your request.</h2>
          <p style={{ ...P.cardText, marginBottom: 26 }}>A RiskFlow360 team member will review the supplier information you provided and follow up at {f.email} within 2 business days to scope the evaluation.</p>
          <button style={P.btnGhost} onClick={onBack}>← Back to home</button>
        </div>
      </div>
    );
  }

  return (
    <div style={P.page}>
      <div style={{ ...P.section, maxWidth: 640 }}>
        <button style={S.back} onClick={onBack}>← Back to home</button>
        <div style={P.secEyebrow}>Free Risk Assessment</div>
        <h2 style={P.secH2}>Tell us about your Mexican supplier.</h2>
        <p style={{ ...P.cardText, textAlign: "center", marginBottom: 30 }}>This takes about 3 minutes. We'll use it to scope your first supplier evaluation — no cost or commitment.</p>
        <div style={P.card}>
          <Row>
            <Field label="Your Company Name"><input style={S.input} value={f.company} onChange={(e) => set("company", e.target.value)} /></Field>
            <Field label="Your Name"><input style={S.input} value={f.contact} onChange={(e) => set("contact", e.target.value)} /></Field>
          </Row>
          <Row>
            <Field label="Email"><input style={S.input} value={f.email} onChange={(e) => set("email", e.target.value)} /></Field>
            <Field label="Phone"><input style={S.input} value={f.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
          </Row>
          <Field label="Supplier Name (Mexico)"><input style={S.input} value={f.supplierName} onChange={(e) => set("supplierName", e.target.value)} /></Field>
          <Row>
            <Field label="Sector"><select style={S.input} value={f.sector} onChange={(e) => set("sector", e.target.value)}>{SECTORS.map((x) => <option key={x}>{x}</option>)}</select></Field>
            <Field label="Mexican State"><select style={S.input} value={f.state} onChange={(e) => set("state", e.target.value)}>{MX_STATES.map((x) => <option key={x}>{x}</option>)}</select></Field>
          </Row>
          <Field label="How long have you worked with this supplier?"><input style={S.input} placeholder="e.g. 2 years" value={f.relationshipLength} onChange={(e) => set("relationshipLength", e.target.value)} /></Field>
          <Field label="What concerns you most? (select all that apply)">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {CONCERN_TYPES.map((c) => (
                <button key={c} onClick={() => toggleConcern(c)} style={{ ...S.chipBtn, ...(f.concerns.includes(c) ? { background: "#1D9E75", color: "#fff", borderColor: "#1D9E75" } : {}) }}>{c}</button>
              ))}
            </div>
          </Field>
          <Field label="Anything else we should know?"><textarea style={{ ...S.input, minHeight: 80, resize: "vertical" }} value={f.details} onChange={(e) => set("details", e.target.value)} /></Field>
          {error && <div style={{ color: "#d03b3b", fontSize: 13, marginBottom: 10 }}>{error}</div>}
          <button style={{ ...S.primary, width: "100%", marginTop: 8 }} onClick={submit}>Submit Assessment Request</button>
        </div>
      </div>
    </div>
  );
}

// ---------- login ----------
function Login({ onBack }) {
  const { login } = useApp();
  const [role, setRole] = useState("admin");
  const [name, setName] = useState("");
  return (
    <div style={LS.wrap}>
      <div style={LS.card}>
        <div style={LS.logo}>RiskFlow<span style={{ color: "#1D9E75" }}>360</span></div>
        <div style={LS.sub}>Canada–Mexico Supplier Risk Intelligence</div>
        <div style={{ marginTop: 28 }}>
          <label style={LS.label}>Your Name</label>
          <input style={LS.input} value={name} placeholder="e.g. Luis Martinez" onChange={(e) => setName(e.target.value)} />
          <label style={LS.label}>Role</label>
          <select style={LS.input} value={role} onChange={(e) => setRole(e.target.value)}>
            {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <button style={LS.btn} onClick={() => login({ id: uid(), name: name.trim() || "Demo User", role })}>
            Sign in
          </button>
        </div>
        <div style={LS.note}>Demo build — role selection is for preview. Production adds real authentication.</div>
        {onBack && <button style={LS.back} onClick={onBack}>← Back to home</button>}
      </div>
    </div>
  );
}

// ---------- shell / navigation ----------
function Shell() {
  const { user, logout, tab, setTab, leads } = useApp();
  const newLeads = leads.filter((l) => l.status === "New").length;
  const nav = [
    { key: "dashboard", label: "Dashboard", roles: ["admin", "auditor", "client"] },
    { key: "intake", label: `Intake Requests${newLeads ? ` (${newLeads})` : ""}`, roles: ["admin", "auditor"] },
    { key: "suppliers", label: "Suppliers", roles: ["admin", "auditor", "client"] },
    { key: "audits", label: "Audits", roles: ["admin", "auditor"] },
    { key: "compliance", label: "USMCA Docs", roles: ["admin", "auditor", "client"] },
    { key: "certification", label: "CCBS Program", roles: ["admin"] },
    { key: "alerts", label: "Alerts", roles: ["admin", "auditor", "client"] },
    { key: "settings", label: "Risk Weights", roles: ["admin"] },
  ].filter((n) => n.roles.includes(user.role));

  return (
    <div style={S.app}>
      <aside style={S.sidebar}>
        <div style={S.logo}>RiskFlow<span style={{ color: "#1D9E75" }}>360</span></div>
        <div style={S.logoSub}>Supplier Risk Intelligence</div>
        <nav style={{ marginTop: 24 }}>
          {nav.map((n) => (
            <button key={n.key} onClick={() => setTab(n.key)} style={{ ...S.navItem, ...(tab === n.key ? S.navActive : {}) }}>{n.label}</button>
          ))}
        </nav>
        <div style={S.userBox}>
          <div style={{ fontWeight: 600, fontSize: 13 }}>{user.name}</div>
          <div style={{ fontSize: 11, color: "#64748B" }}>{ROLES[user.role]}</div>
          <button style={S.logout} onClick={logout}>Sign out</button>
        </div>
      </aside>
      <main style={S.main}>
        {tab === "dashboard" && <Dashboard />}
        {tab === "intake" && <IntakeRequests />}
        {tab === "suppliers" && <Suppliers />}
        {tab === "audits" && <Audits />}
        {tab === "compliance" && <Compliance />}
        {tab === "certification" && <Certification />}
        {tab === "alerts" && <Alerts />}
        {tab === "settings" && <Settings />}
      </main>
    </div>
  );
}

// ---------- alerts engine (derived) ----------
function useAlerts() {
  const { suppliers, audits, weights } = useApp();
  return useMemo(() => {
    const out = [];
    suppliers.forEach((s) => {
      const risk = computeRisk(s.scores, weights);
      if (risk.tier === "Critical") out.push({ id: "r" + s.id, sev: "high", supplier: s.name, msg: `Critical risk score (${risk.score}/100)` });
      if (s.ccbsExpiry && s.ccbs !== "None") {
        const days = Math.round((new Date(s.ccbsExpiry) - new Date()) / 86400000);
        if (days <= 60 && days >= 0) out.push({ id: "c" + s.id, sev: days <= 30 ? "high" : "med", supplier: s.name, msg: `${s.ccbs} expires in ${days} days` });
        if (days < 0) out.push({ id: "cx" + s.id, sev: "high", supplier: s.name, msg: `${s.ccbs} certification expired` });
      }
      (s.documents || []).forEach((d) => {
        if (d.expiry) { const dd = Math.round((new Date(d.expiry) - new Date()) / 86400000);
          if (dd <= 45 && dd >= 0) out.push({ id: "d" + d.id, sev: dd <= 15 ? "high" : "med", supplier: s.name, msg: `${d.name} expires in ${dd} days` }); }
      });
    });
    audits.forEach((a) => {
      if (a.status !== "Closed" && a.correctiveDue) {
        const dd = Math.round((new Date(a.correctiveDue) - new Date()) / 86400000);
        const sup = suppliers.find((s) => s.id === a.supplierId);
        if (dd < 0) out.push({ id: "a" + a.id, sev: "high", supplier: sup?.name || "—", msg: `Corrective action overdue (${a.type})` });
        else if (dd <= 7) out.push({ id: "a" + a.id, sev: "med", supplier: sup?.name || "—", msg: `Corrective action due in ${dd} days` });
      }
    });
    return out;
  }, [suppliers, audits, weights]);
}

// ---------- dashboard ----------
function Dashboard() {
  const { suppliers, audits, weights, setTab, leads } = useApp();
  const alerts = useAlerts();
  const rated = suppliers.map((s) => ({ ...s, risk: computeRisk(s.scores, weights) }));
  const scored = rated.filter((s) => s.risk.score != null);
  const avg = scored.length ? Math.round(scored.reduce((a, s) => a + s.risk.score, 0) / scored.length) : 0;
  const tiers = { Critical: 0, High: 0, Moderate: 0, Low: 0, Unrated: 0 };
  rated.forEach((s) => tiers[s.risk.tier]++);
  const priority = rated.filter((s) => ["Critical", "High"].includes(s.risk.tier)).sort((a, b) => b.risk.score - a.risk.score);
  const openAudits = audits.filter((a) => a.status !== "Closed").length;
  const newLeads = leads.filter((l) => l.status === "New").length;

  return (
    <div>
      <Header title="Executive Dashboard" sub="Portfolio-wide supplier risk overview" />
      <div style={S.kpiRow}>
        <Kpi label="Suppliers" value={suppliers.length} />
        <Kpi label="Avg Risk" value={avg} suffix="/100" tone={avg >= 50 ? "warn" : "good"} />
        <Kpi label="High / Critical" value={tiers.High + tiers.Critical} tone={tiers.High + tiers.Critical ? "warn" : "good"} />
        <Kpi label="Open Audits" value={openAudits} />
        <Kpi label="New Requests" value={newLeads} tone={newLeads ? "warn" : "good"} />
        <Kpi label="Active Alerts" value={alerts.length} tone={alerts.length ? "warn" : "good"} />
      </div>
      <div style={S.grid2}>
        <Card title="Risk Distribution">
          {["Critical", "High", "Moderate", "Low", "Unrated"].map((t) => {
            const c = tiers[t], pct = suppliers.length ? Math.round((c / suppliers.length) * 100) : 0;
            return (
              <div key={t} style={{ marginBottom: 13 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 5 }}>
                  <span style={{ fontWeight: 500 }}>{t}</span><span style={{ color: "#64748B" }}>{c} · {pct}%</span>
                </div>
                <div style={S.track}><div style={{ ...S.fill, width: `${pct}%`, background: TIER_COLOR[t] }} /></div>
              </div>
            );
          })}
        </Card>
        <Card title="Priority Watchlist" right={<Chip>{priority.length}</Chip>}>
          {priority.length === 0 && <Empty text="No high-risk suppliers." />}
          {priority.slice(0, 6).map((s) => (
            <div key={s.id} style={S.row}>
              <div><div style={{ fontWeight: 500, fontSize: 14 }}>{s.name}</div><div style={{ fontSize: 12, color: "#64748B" }}>{s.sector} · {s.state}</div></div>
              <RiskBadge risk={s.risk} />
            </div>
          ))}
          {priority.length > 0 && <button style={S.link} onClick={() => setTab("suppliers")}>View all →</button>}
        </Card>
      </div>
      {newLeads > 0 && (
        <Card title="New Risk Assessment Requests" right={<button style={S.link} onClick={() => setTab("intake")}>Review →</button>}>
          {leads.filter((l) => l.status === "New").slice(0, 5).map((l) => (
            <div key={l.id} style={S.row}>
              <div><div style={{ fontSize: 14 }}>{l.company} — {l.supplierName}</div><div style={{ fontSize: 12, color: "#64748B" }}>submitted {l.submitted}</div></div>
            </div>
          ))}
        </Card>
      )}
      <Card title="Recent Alerts" right={<button style={S.link} onClick={() => setTab("alerts")}>All alerts →</button>}>
        {alerts.length === 0 && <Empty text="No active alerts." />}
        {alerts.slice(0, 5).map((a) => (
          <div key={a.id} style={S.row}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 8, height: 8, borderRadius: 4, background: a.sev === "high" ? "#d03b3b" : "#fab219" }} />
              <div><div style={{ fontSize: 14 }}>{a.msg}</div><div style={{ fontSize: 12, color: "#64748B" }}>{a.supplier}</div></div>
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}

// ---------- intake requests (from public risk assessment questionnaire) ----------
function IntakeRequests() {
  const { leads, setLeads, setSuppliers, setTab, user } = useApp();
  const [detail, setDetail] = useState(null);
  const canAct = user.role === "admin" || user.role === "auditor";

  const markReviewed = (id) => setLeads((p) => p.map((l) => (l.id === id && l.status === "New") ? { ...l, status: "Reviewed" } : l));

  const convert = (lead) => {
    const supplier = {
      id: uid(), name: lead.supplierName, sector: lead.sector, product: "", state: lead.state,
      contact: "", email: "", phone: "", volume: "", canadianBuyer: lead.company, status: "Under Review",
      certifications: [], ccbs: "None", ccbsExpiry: "",
      notes: `Intake from ${lead.company} (${lead.contact || "no name given"}, ${lead.email}). Relationship length: ${lead.relationshipLength || "not given"}. Concerns: ${lead.concerns.join(", ") || "none listed"}. ${lead.details || ""}`.trim(),
      scores: {}, documents: [],
    };
    setSuppliers((p) => [...p, supplier]);
    setLeads((p) => p.map((l) => l.id === lead.id ? { ...l, status: "Converted" } : l));
    setDetail(null);
    setTab("suppliers");
  };

  if (detail) {
    const l = detail;
    return (
      <div>
        <button style={S.back} onClick={() => setDetail(null)}>← Back to intake requests</button>
        <Header title={l.company} sub={`Submitted ${l.submitted}`} action={<StatusPill status={l.status} />} />
        <div style={S.grid2}>
          <Card title="Requester">
            <Meta label="Contact" value={l.contact} />
            <Meta label="Email" value={l.email} />
            <Meta label="Phone" value={l.phone} />
          </Card>
          <Card title="Supplier in Question">
            <Meta label="Supplier Name" value={l.supplierName} />
            <Meta label="Sector" value={l.sector} />
            <Meta label="State" value={l.state} />
            <Meta label="Relationship Length" value={l.relationshipLength} />
          </Card>
        </div>
        <Card title="Concerns & Details">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
            {l.concerns.length === 0 && <span style={{ fontSize: 13, color: "#94A3B8" }}>None specified</span>}
            {l.concerns.map((c) => <Tag key={c}>{c}</Tag>)}
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.6 }}>{l.details || "—"}</div>
        </Card>
        {canAct && (
          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            {l.status !== "Converted" && <button style={S.primary} onClick={() => convert(l)}>Convert to Supplier Evaluation</button>}
            {l.status === "New" && <button style={S.ghost} onClick={() => markReviewed(l.id)}>Mark Reviewed</button>}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <Header title="Intake Requests" sub={`${leads.length} risk assessment requests from the public site`} />
      <div style={S.kpiRow}>
        <Kpi label="Total" value={leads.length} />
        <Kpi label="New" value={leads.filter((l) => l.status === "New").length} tone={leads.some((l) => l.status === "New") ? "warn" : "good"} />
        <Kpi label="Reviewed" value={leads.filter((l) => l.status === "Reviewed").length} />
        <Kpi label="Converted" value={leads.filter((l) => l.status === "Converted").length} tone="good" />
      </div>
      <Card title="All Requests">
        {leads.length === 0 && <Empty text="No requests yet. Submissions from the public site's risk assessment form will appear here." />}
        {leads.slice().reverse().map((l) => (
          <div key={l.id} style={{ ...S.row, cursor: "pointer" }} onClick={() => setDetail(l)}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 500 }}>{l.company} — {l.supplierName}</div>
              <div style={{ fontSize: 12, color: "#64748B" }}>{l.contact} · {l.email} · submitted {l.submitted}</div>
            </div>
            <StatusPill status={l.status} />
          </div>
        ))}
      </Card>
    </div>
  );
}

// ---------- suppliers ----------
function Suppliers() {
  const { suppliers, setSuppliers, setAudits, weights, user } = useApp();
  const [q, setQ] = useState(""); const [sector, setSector] = useState("All"); const [status, setStatus] = useState("All");
  const [editing, setEditing] = useState(null); const [detail, setDetail] = useState(null);
  const canEdit = user.role === "admin" || user.role === "auditor";

  const list = useMemo(() => suppliers.map((s) => ({ ...s, risk: computeRisk(s.scores, weights) }))
    .filter((s) => sector === "All" || s.sector === sector)
    .filter((s) => status === "All" || s.status === status)
    .filter((s) => !q || (s.name + s.product + s.state + (s.canadianBuyer || "")).toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (b.risk.score || 0) - (a.risk.score || 0)), [suppliers, q, sector, status, weights]);

  const save = (s) => { setSuppliers((p) => p.find((x) => x.id === s.id) ? p.map((x) => x.id === s.id ? s : x) : [...p, s]); setEditing(null); };
  const del = (id) => { setSuppliers((p) => p.filter((x) => x.id !== id)); setAudits((p) => p.filter((a) => a.supplierId !== id)); setDetail(null); };

  if (editing) return <SupplierForm initial={editing} onSave={save} onCancel={() => setEditing(null)} />;
  if (detail) { const s = suppliers.find((x) => x.id === detail); if (s) return <SupplierDetail supplier={{ ...s, risk: computeRisk(s.scores, weights) }} onBack={() => setDetail(null)} onEdit={() => { setEditing(s); setDetail(null); }} canEdit={canEdit} />; }

  return (
    <div>
      <Header title="Suppliers" sub={`${suppliers.length} under monitoring`} action={canEdit && <button style={S.primaryInline} onClick={() => setEditing({})}>+ New Supplier</button>} />
      <div style={S.filters}>
        <input style={S.search} placeholder="Search suppliers, products, buyers…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select style={S.select} value={sector} onChange={(e) => setSector(e.target.value)}><option>All</option>{SECTORS.map((x) => <option key={x}>{x}</option>)}</select>
        <select style={S.select} value={status} onChange={(e) => setStatus(e.target.value)}><option>All</option>{SUPPLIER_STATUS.map((x) => <option key={x}>{x}</option>)}</select>
      </div>
      {list.length === 0 && <Empty text="No suppliers match your filters." />}
      <div style={S.cardGrid}>
        {list.map((s) => (
          <div key={s.id} style={S.supCard} onClick={() => setDetail(s.id)}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div><div style={{ fontWeight: 600, fontSize: 15 }}>{s.name}</div><div style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>{s.sector}</div></div>
              <RiskBadge risk={s.risk} />
            </div>
            <div style={S.supMeta}>
              <Meta label="Product" value={s.product} />
              <Meta label="Location" value={`${s.state}, MX`} />
              <Meta label="Buyer" value={s.canadianBuyer} />
              <Meta label="Status" value={<StatusPill status={s.status} />} />
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", borderTop: "1px solid #F1F5F9", paddingTop: 10 }}>
              {s.ccbs !== "None" && <CcbsPill level={s.ccbs} />}
              {(s.certifications || []).slice(0, 2).map((c) => <Tag key={c}>{c}</Tag>)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- PDF report generator (print-to-PDF, no external deps) ----------
function generateSupplierReport(s, sAudits) {
  const risk = computeRisk(s.scores);
  const rows = RISK_CATEGORIES.filter((c) => s.scores[c.key]).map((c) =>
    `<tr><td>${c.label}</td><td style="text-align:right;font-weight:600;color:${SCORE_COLOR[s.scores[c.key]]}">${s.scores[c.key]}/5</td></tr>`
  ).join("");
  const certs = (s.certifications || []).map((c) => `<span class="tag">${c}</span>`).join(" ") || "—";
  const auditRows = sAudits.length ? sAudits.map((a) =>
    `<tr><td>${a.date}</td><td>${a.type}</td><td>${a.severity}</td><td>${a.status}</td><td>${a.findings || ""}</td></tr>`
  ).join("") : `<tr><td colspan="5" style="color:#94A3B8">No audits on record</td></tr>`;
  const docRows = (s.documents || []).length ? (s.documents || []).map((d) =>
    `<tr><td>${d.name}</td><td>${d.type}</td><td>${d.expiry || "—"}</td></tr>`
  ).join("") : `<tr><td colspan="3" style="color:#94A3B8">No documents on file</td></tr>`;

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Supplier Risk Report — ${s.name}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, Inter, Arial, sans-serif; color: #0f172a; padding: 40px; max-width: 800px; margin: 0 auto; }
    .head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #1D9E75; padding-bottom: 16px; margin-bottom: 24px; }
    .logo { font-size: 22px; font-weight: 800; letter-spacing: -0.03em; }
    .logo span { color: #1D9E75; }
    .meta { text-align: right; font-size: 12px; color: #64748B; }
    h1 { font-size: 24px; margin: 0 0 4px; }
    h2 { font-size: 15px; text-transform: uppercase; letter-spacing: 0.05em; color: #1D9E75; margin: 28px 0 10px; border-bottom: 1px solid #E2E8F0; padding-bottom: 6px; }
    .sub { color: #64748B; font-size: 14px; }
    .badge { display: inline-block; padding: 6px 16px; border-radius: 8px; font-weight: 700; font-size: 15px; background: ${risk.color}22; color: ${risk.color}; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 6px; }
    td, th { padding: 7px 10px; border-bottom: 1px solid #F1F5F9; text-align: left; }
    th { background: #F8FAFC; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: #64748B; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 24px; font-size: 13px; }
    .grid div { padding: 4px 0; }
    .grid .k { color: #94A3B8; font-size: 11px; text-transform: uppercase; }
    .tag { display: inline-block; background: #F1F5F9; border: 1px solid #E2E8F0; border-radius: 6px; padding: 2px 8px; font-size: 11px; }
    .scorebox { text-align: center; padding: 20px; background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px; margin: 8px 0; }
    .scorenum { font-size: 42px; font-weight: 800; color: ${risk.color}; }
    .foot { margin-top: 40px; padding-top: 16px; border-top: 1px solid #E2E8F0; font-size: 11px; color: #94A3B8; text-align: center; }
    @media print { body { padding: 20px; } }
  </style></head><body>
    <div class="head">
      <div><div class="logo">RiskFlow<span>360</span></div><div style="font-size:11px;color:#64748B;text-transform:uppercase;letter-spacing:0.08em">Supplier Risk Report</div></div>
      <div class="meta">Generated ${today()}<br>Canada–Mexico Supplier Risk Intelligence</div>
    </div>
    <h1>${s.name}</h1>
    <div class="sub">${s.sector} · ${s.state}, Mexico · Buyer: ${s.canadianBuyer || "—"}</div>
    <div class="scorebox"><div class="scorenum">${risk.score != null ? risk.score : "—"}</div><div class="badge">${risk.tier} Risk</div></div>
    <h2>Supplier Profile</h2>
    <div class="grid">
      <div><div class="k">Product / Service</div>${s.product || "—"}</div>
      <div><div class="k">Annual Volume</div>${s.volume || "—"}</div>
      <div><div class="k">Contact</div>${s.contact || "—"}</div>
      <div><div class="k">Email</div>${s.email || "—"}</div>
      <div><div class="k">Status</div>${s.status || "—"}</div>
      <div><div class="k">CCBS Level</div>${s.ccbs || "None"}</div>
    </div>
    <h2>Risk Assessment</h2>
    <table><tbody>${rows || '<tr><td colspan="2" style="color:#94A3B8">Not yet assessed</td></tr>'}</tbody></table>
    <h2>Certifications</h2>
    <div style="margin-top:6px">${certs}</div>
    <h2>Audit History</h2>
    <table><thead><tr><th>Date</th><th>Type</th><th>Severity</th><th>Status</th><th>Findings</th></tr></thead><tbody>${auditRows}</tbody></table>
    <h2>Documents on File</h2>
    <table><thead><tr><th>Document</th><th>Type</th><th>Expiry</th></tr></thead><tbody>${docRows}</tbody></table>
    ${s.notes ? `<h2>Notes</h2><div style="font-size:13px;line-height:1.6">${s.notes}</div>` : ""}
    <div class="foot">This report was generated by RiskFlow360. Confidential — for the intended recipient only. © 2026 RiskFlow360.</div>
    <script>window.onload = function(){ setTimeout(function(){ window.print(); }, 300); }</script>
  </body></html>`;

  const w = window.open("", "_blank");
  if (w) { w.document.write(html); w.document.close(); }
}

function SupplierDetail({ supplier: s, onBack, onEdit, canEdit }) {
  const { audits, weights } = useApp();
  const sAudits = audits.filter((a) => a.supplierId === s.id);
  return (
    <div>
      <button style={S.back} onClick={onBack}>← Back to suppliers</button>
      <Header title={s.name} sub={`${s.sector} · ${s.state}, Mexico`} action={
        <div style={{ display: "flex", gap: 8 }}>
          <button style={S.ghost} onClick={() => generateSupplierReport(s, sAudits)}>Generate Report</button>
          {canEdit && <button style={S.primaryInline} onClick={onEdit}>Edit</button>}
        </div>
      } />
      <div style={S.grid2}>
        <Card title="Profile">
          <Meta label="Product / Service" value={s.product} />
          <Meta label="Contact" value={`${s.contact || "—"} · ${s.email || ""}`} />
          <Meta label="Phone" value={s.phone} />
          <Meta label="Annual Volume" value={s.volume} />
          <Meta label="Canadian Buyer" value={s.canadianBuyer} />
          <Meta label="Status" value={<StatusPill status={s.status} />} />
          <Meta label="Notes" value={s.notes} />
        </Card>
        <Card title="Risk Profile" right={<RiskBadge risk={s.risk} />}>
          {RISK_CATEGORIES.filter((c) => s.scores[c.key]).map((c) => (
            <div key={c.key} style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                <span>{c.label}</span><span style={{ color: SCORE_COLOR[s.scores[c.key]], fontWeight: 600 }}>{s.scores[c.key]}/5</span>
              </div>
              <div style={S.track}><div style={{ ...S.fill, width: `${(s.scores[c.key] / 5) * 100}%`, background: SCORE_COLOR[s.scores[c.key]] }} /></div>
            </div>
          ))}
        </Card>
      </div>
      <div style={S.grid2}>
        <Card title="Certifications & CCBS">
          <div style={{ marginBottom: 12 }}>{s.ccbs !== "None" ? <CcbsPill level={s.ccbs} /> : <span style={{ fontSize: 13, color: "#94A3B8" }}>No CCBS certification</span>}
            {s.ccbsExpiry && s.ccbs !== "None" && <span style={{ fontSize: 12, color: "#64748B", marginLeft: 8 }}>expires {s.ccbsExpiry}</span>}</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{(s.certifications || []).map((c) => <Tag key={c}>{c}</Tag>)}</div>
        </Card>
        <Card title="Documents" right={<Chip>{(s.documents || []).length}</Chip>}>
          {(s.documents || []).length === 0 && <Empty text="No documents on file." />}
          {(s.documents || []).map((d) => (
            <div key={d.id} style={S.row}>
              <div><div style={{ fontSize: 13, fontWeight: 500 }}>{d.name}</div><div style={{ fontSize: 11, color: "#64748B" }}>{d.type} · uploaded {d.uploaded}</div></div>
              {d.expiry && <span style={{ fontSize: 11, color: new Date(d.expiry) < new Date() ? "#d03b3b" : "#64748B" }}>exp {d.expiry}</span>}
            </div>
          ))}
        </Card>
      </div>
      <Card title="Audit History" right={<Chip>{sAudits.length}</Chip>}>
        {sAudits.length === 0 && <Empty text="No audits recorded." />}
        {sAudits.slice().reverse().map((a) => (
          <div key={a.id} style={{ ...S.row, alignItems: "flex-start" }}>
            <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 500 }}>{a.type}</div>
              <div style={{ fontSize: 12, color: "#64748B", margin: "2px 0" }}>{a.date} · {a.auditor} · <SeverityText sev={a.severity} /></div>
              <div style={{ fontSize: 13 }}>{a.findings}</div></div>
            <StatusPill status={a.status} />
          </div>
        ))}
      </Card>
    </div>
  );
}

function SupplierForm({ initial, onSave, onCancel }) {
  const { weights } = useApp();
  const [f, setF] = useState(() => ({
    id: initial?.id || uid(), name: initial?.name || "", sector: initial?.sector || SECTORS[0], product: initial?.product || "",
    state: initial?.state || MX_STATES[0], contact: initial?.contact || "", email: initial?.email || "", phone: initial?.phone || "",
    volume: initial?.volume || "", canadianBuyer: initial?.canadianBuyer || "", status: initial?.status || "Prospect",
    certifications: initial?.certifications || [], ccbs: initial?.ccbs || "None", ccbsExpiry: initial?.ccbsExpiry || "",
    notes: initial?.notes || "", scores: initial?.scores || {}, documents: initial?.documents || [],
  }));
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const setScore = (k, v) => setF((p) => ({ ...p, scores: { ...p.scores, [k]: v } }));
  const toggleCert = (c) => setF((p) => ({ ...p, certifications: p.certifications.includes(c) ? p.certifications.filter((x) => x !== c) : [...p.certifications, c] }));
  const addDoc = () => setF((p) => ({ ...p, documents: [...p.documents, { id: uid(), name: "New Document.pdf", type: "Certification", uploaded: today(), expiry: "" }] }));
  const setDoc = (id, k, v) => setF((p) => ({ ...p, documents: p.documents.map((d) => d.id === id ? { ...d, [k]: v } : d) }));
  const rmDoc = (id) => setF((p) => ({ ...p, documents: p.documents.filter((d) => d.id !== id) }));
  const risk = computeRisk(f.scores, weights);

  return (
    <div>
      <button style={S.back} onClick={onCancel}>← Cancel</button>
      <Header title={initial?.id ? "Edit Supplier" : "New Supplier"} sub="Profile, risk assessment, certifications & documents" />
      <div style={S.grid2}>
        <Card title="Profile">
          <Field label="Company Name"><input style={S.input} value={f.name} onChange={(e) => set("name", e.target.value)} /></Field>
          <Field label="Sector"><select style={S.input} value={f.sector} onChange={(e) => set("sector", e.target.value)}>{SECTORS.map((x) => <option key={x}>{x}</option>)}</select></Field>
          <Field label="Product / Service"><input style={S.input} value={f.product} onChange={(e) => set("product", e.target.value)} /></Field>
          <Field label="Mexican State"><select style={S.input} value={f.state} onChange={(e) => set("state", e.target.value)}>{MX_STATES.map((x) => <option key={x}>{x}</option>)}</select></Field>
          <Row>
            <Field label="Contact"><input style={S.input} value={f.contact} onChange={(e) => set("contact", e.target.value)} /></Field>
            <Field label="Phone"><input style={S.input} value={f.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
          </Row>
          <Field label="Email"><input style={S.input} value={f.email} onChange={(e) => set("email", e.target.value)} /></Field>
          <Row>
            <Field label="Annual Volume"><input style={S.input} value={f.volume} onChange={(e) => set("volume", e.target.value)} /></Field>
            <Field label="Status"><select style={S.input} value={f.status} onChange={(e) => set("status", e.target.value)}>{SUPPLIER_STATUS.map((x) => <option key={x}>{x}</option>)}</select></Field>
          </Row>
          <Field label="Canadian Buyer"><input style={S.input} value={f.canadianBuyer} onChange={(e) => set("canadianBuyer", e.target.value)} /></Field>
          <Field label="Notes"><textarea style={{ ...S.input, minHeight: 60, resize: "vertical" }} value={f.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
        </Card>

        <div>
          <Card title="Risk Assessment" right={<RiskBadge risk={risk} />}>
            <div style={{ fontSize: 12, color: "#64748B", marginBottom: 14 }}>Rate 1 (low risk) to 5 (high risk).</div>
            {RISK_CATEGORIES.map((c) => (
              <div key={c.key} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 5 }}>{c.label}</div>
                <div style={{ display: "flex", gap: 5 }}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} onClick={() => setScore(c.key, n)} style={{ ...S.dot, ...(Number(f.scores[c.key]) === n ? { background: SCORE_COLOR[n], color: "#fff", borderColor: SCORE_COLOR[n] } : {}) }}>{n}</button>
                  ))}
                </div>
              </div>
            ))}
          </Card>
          <div style={{ height: 16 }} />
          <Card title="Certifications">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
              {CERT_TYPES.map((c) => (
                <button key={c} onClick={() => toggleCert(c)} style={{ ...S.chipBtn, ...(f.certifications.includes(c) ? { background: "#1D9E75", color: "#fff", borderColor: "#1D9E75" } : {}) }}>{c}</button>
              ))}
            </div>
            <Row>
              <Field label="CCBS Level"><select style={S.input} value={f.ccbs} onChange={(e) => set("ccbs", e.target.value)}>{CCBS_LEVELS.map((x) => <option key={x}>{x}</option>)}</select></Field>
              <Field label="CCBS Expiry"><input type="date" style={S.input} value={f.ccbsExpiry} onChange={(e) => set("ccbsExpiry", e.target.value)} /></Field>
            </Row>
          </Card>
        </div>
      </div>
      <Card title="Documents" right={<button style={S.smallBtn} onClick={addDoc}>+ Add Document</button>}>
        {f.documents.length === 0 && <Empty text="No documents. Add certificates, audit evidence, or origin records." />}
        {f.documents.map((d) => (
          <div key={d.id} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr auto", gap: 8, marginBottom: 8, alignItems: "center" }}>
            <input style={S.input} value={d.name} onChange={(e) => setDoc(d.id, "name", e.target.value)} />
            <select style={S.input} value={d.type} onChange={(e) => setDoc(d.id, "type", e.target.value)}>
              <option>Certification</option><option>Audit Evidence</option><option>Origin Record</option><option>USMCA Certificate</option><option>Financial</option>
            </select>
            <input type="date" style={S.input} value={d.expiry} onChange={(e) => setDoc(d.id, "expiry", e.target.value)} />
            <button style={{ ...S.smallBtn, color: "#d03b3b" }} onClick={() => rmDoc(d.id)}>✕</button>
          </div>
        ))}
      </Card>
      <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
        <button style={S.primary} onClick={() => f.name.trim() && onSave(f)}>Save Supplier</button>
        <button style={S.ghost} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

// ---------- audits ----------
function Audits() {
  const { audits, setAudits, suppliers } = useApp();
  const [modal, setModal] = useState(null);
  const save = (a) => { setAudits((p) => p.find((x) => x.id === a.id) ? p.map((x) => x.id === a.id ? a : x) : [...p, a]); setModal(null); };
  return (
    <div>
      <Header title="Audit Tracking" sub={`${audits.length} audits on record`} action={suppliers.length > 0 && <button style={S.primaryInline} onClick={() => setModal({})}>+ Log Audit</button>} />
      {audits.length === 0 && <Empty text="No audits yet. Add a supplier, then log an audit." />}
      {audits.slice().reverse().map((a) => {
        const s = suppliers.find((x) => x.id === a.supplierId);
        const overdue = a.status !== "Closed" && a.correctiveDue && new Date(a.correctiveDue) < new Date();
        return (
          <Card key={a.id} title={a.type} right={<div style={{ display: "flex", gap: 8, alignItems: "center" }}><SeverityText sev={a.severity} /><StatusPill status={a.status} /></div>}>
            <div style={{ fontSize: 13, color: "#64748B", marginBottom: 8 }}>{s?.name || "Unassigned"} · {a.date} · Auditor: {a.auditor}</div>
            <div style={{ fontSize: 14, marginBottom: 8 }}><b style={{ fontWeight: 500 }}>Findings:</b> {a.findings}</div>
            {a.corrective && <div style={{ fontSize: 14, marginBottom: 8 }}><b style={{ fontWeight: 500 }}>Corrective action:</b> {a.corrective}</div>}
            {a.correctiveDue && <div style={{ fontSize: 13, color: overdue ? "#d03b3b" : "#64748B" }}>Due: {a.correctiveDue}{overdue ? " · OVERDUE" : ""}</div>}
            <button style={{ ...S.smallBtn, marginTop: 10 }} onClick={() => setModal(a)}>Edit</button>
          </Card>
        );
      })}
      {modal && <AuditModal initial={modal} suppliers={suppliers} onSave={save} onClose={() => setModal(null)} />}
    </div>
  );
}

function AuditModal({ initial, suppliers, onSave, onClose }) {
  const [a, setA] = useState({
    id: initial?.id || uid(), supplierId: initial?.supplierId || suppliers[0]?.id || null, date: initial?.date || today(),
    type: initial?.type || AUDIT_TYPES[0], auditor: initial?.auditor || "", severity: initial?.severity || "Minor",
    findings: initial?.findings || "", corrective: initial?.corrective || "", correctiveDue: initial?.correctiveDue || addDays(today(), 30), status: initial?.status || "Open",
  });
  const set = (k, v) => setA((p) => ({ ...p, [k]: v }));
  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontWeight: 600, fontSize: 17, marginBottom: 16 }}>{initial?.id ? "Edit Audit" : "Log Audit"}</div>
        <Field label="Supplier"><select style={S.input} value={a.supplierId || ""} onChange={(e) => set("supplierId", e.target.value)}>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
        <Field label="Type"><select style={S.input} value={a.type} onChange={(e) => set("type", e.target.value)}>{AUDIT_TYPES.map((x) => <option key={x}>{x}</option>)}</select></Field>
        <Row>
          <Field label="Date"><input type="date" style={S.input} value={a.date} onChange={(e) => set("date", e.target.value)} /></Field>
          <Field label="Auditor"><input style={S.input} value={a.auditor} onChange={(e) => set("auditor", e.target.value)} /></Field>
        </Row>
        <Row>
          <Field label="Severity"><select style={S.input} value={a.severity} onChange={(e) => set("severity", e.target.value)}><option>None</option><option>Minor</option><option>Major</option><option>Critical</option></select></Field>
          <Field label="Status"><select style={S.input} value={a.status} onChange={(e) => set("status", e.target.value)}><option>Open</option><option>In Progress</option><option>Closed</option></select></Field>
        </Row>
        <Field label="Findings"><textarea style={{ ...S.input, minHeight: 70, resize: "vertical" }} value={a.findings} onChange={(e) => set("findings", e.target.value)} /></Field>
        <Field label="Corrective Action"><textarea style={{ ...S.input, minHeight: 50, resize: "vertical" }} value={a.corrective} onChange={(e) => set("corrective", e.target.value)} /></Field>
        <Field label="Corrective Due"><input type="date" style={S.input} value={a.correctiveDue} onChange={(e) => set("correctiveDue", e.target.value)} /></Field>
        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <button style={S.primary} onClick={() => a.supplierId && onSave(a)}>Save</button>
          <button style={S.ghost} onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ---------- USMCA compliance ----------
function Compliance() {
  const { suppliers } = useApp();
  const docs = [];
  suppliers.forEach((s) => (s.documents || []).forEach((d) => docs.push({ ...d, supplier: s.name, buyer: s.canadianBuyer })));
  const usmca = docs.filter((d) => d.type === "USMCA Certificate" || d.type === "Origin Record");
  return (
    <div>
      <Header title="USMCA Compliance" sub="Certificate of origin tracking & document retention" />
      <div style={S.kpiRow}>
        <Kpi label="Suppliers" value={suppliers.length} />
        <Kpi label="Origin Docs" value={usmca.length} tone={usmca.length ? "good" : "warn"} />
        <Kpi label="Total Documents" value={docs.length} />
        <Kpi label="Missing Origin" value={suppliers.filter((s) => !(s.documents || []).some((d) => d.type === "USMCA Certificate" || d.type === "Origin Record")).length} tone="warn" />
      </div>
      <Card title="USMCA Origin Documentation">
        <div style={{ fontSize: 13, color: "#64748B", marginBottom: 14 }}>
          US filings require 5-year retention; Mexican records require 6 years. Suppliers missing origin documentation are flagged for the compliance team.
        </div>
        {suppliers.map((s) => {
          const has = (s.documents || []).some((d) => d.type === "USMCA Certificate" || d.type === "Origin Record");
          return (
            <div key={s.id} style={S.row}>
              <div><div style={{ fontSize: 14, fontWeight: 500 }}>{s.name}</div><div style={{ fontSize: 12, color: "#64748B" }}>{s.canadianBuyer || "—"} · {s.state}, MX</div></div>
              {has ? <span style={{ ...S.pill, background: "#D1FAE5", color: "#065F46" }}>Origin on file</span> : <span style={{ ...S.pill, background: "#FEE2E2", color: "#991B1B" }}>Missing</span>}
            </div>
          );
        })}
      </Card>
      <Card title="All Compliance Documents" right={<Chip>{docs.length}</Chip>}>
        {docs.length === 0 && <Empty text="No documents on file." />}
        {docs.map((d) => (
          <div key={d.id} style={S.row}>
            <div><div style={{ fontSize: 13, fontWeight: 500 }}>{d.name}</div><div style={{ fontSize: 11, color: "#64748B" }}>{d.supplier} · {d.type}</div></div>
            <div style={{ fontSize: 11, color: "#64748B" }}>{d.expiry ? `exp ${d.expiry}` : "no expiry"}</div>
          </div>
        ))}
      </Card>
    </div>
  );
}

// ---------- CCBS certification program ----------
function Certification() {
  const { suppliers } = useApp();
  const certified = suppliers.filter((s) => s.ccbs !== "None");
  const byLevel = {};
  CCBS_LEVELS.filter((l) => l !== "None").forEach((l) => byLevel[l] = certified.filter((s) => s.ccbs === l).length);
  return (
    <div>
      <Header title="CCBS Certification Program" sub="Canada-Certified Border Supplier — proprietary certification tracking" />
      <div style={S.kpiRow}>
        <Kpi label="Certified Suppliers" value={certified.length} tone="good" />
        <Kpi label="Uncertified" value={suppliers.length - certified.length} />
        <Kpi label="Expiring ≤60d" value={certified.filter((s) => s.ccbsExpiry && (new Date(s.ccbsExpiry) - new Date()) / 86400000 <= 60).length} tone="warn" />
        <Kpi label="Coverage" value={suppliers.length ? Math.round((certified.length / suppliers.length) * 100) : 0} suffix="%" />
      </div>
      <div style={S.grid2}>
        <Card title="Certification Levels">
          {CCBS_LEVELS.filter((l) => l !== "None").map((l) => (
            <div key={l} style={S.row}>
              <CcbsPill level={l} />
              <span style={{ fontSize: 14, fontWeight: 500 }}>{byLevel[l]} suppliers</span>
            </div>
          ))}
          <div style={{ fontSize: 12, color: "#64748B", marginTop: 12, lineHeight: 1.6 }}>
            CCBS is the proprietary certification licensed to suppliers meeting Canada–Mexico trade standards. Sector variants: CCBSAuto, CCBSLogistics, CCBSElectronics.
          </div>
        </Card>
        <Card title="Certified Suppliers" right={<Chip>{certified.length}</Chip>}>
          {certified.length === 0 && <Empty text="No certified suppliers yet." />}
          {certified.map((s) => {
            const days = s.ccbsExpiry ? Math.round((new Date(s.ccbsExpiry) - new Date()) / 86400000) : null;
            return (
              <div key={s.id} style={S.row}>
                <div><div style={{ fontSize: 14, fontWeight: 500 }}>{s.name}</div><div style={{ fontSize: 11, color: "#64748B" }}>{s.sector}</div></div>
                <div style={{ textAlign: "right" }}><CcbsPill level={s.ccbs} />
                  {days != null && <div style={{ fontSize: 11, color: days <= 30 ? "#d03b3b" : "#64748B", marginTop: 3 }}>{days < 0 ? "expired" : `${days}d left`}</div>}</div>
              </div>
            );
          })}
        </Card>
      </div>
      <Card title="Public Verification Preview">
        <div style={{ fontSize: 13, color: "#64748B", marginBottom: 12 }}>Canadian buyers can verify a supplier's CCBS status via a public lookup. Production adds a public verification page.</div>
        {certified.slice(0, 3).map((s) => (
          <div key={s.id} style={{ ...S.row, background: "#F8FAFC", padding: "12px 14px", borderRadius: 8, border: "1px solid #E2E8F0", marginBottom: 8 }}>
            <div><div style={{ fontSize: 14, fontWeight: 600 }}>{s.name}</div><div style={{ fontSize: 12, color: "#64748B" }}>Verified · {s.state}, MX</div></div>
            <CcbsPill level={s.ccbs} />
          </div>
        ))}
      </Card>
    </div>
  );
}

// ---------- alerts ----------
function Alerts() {
  const alerts = useAlerts();
  const high = alerts.filter((a) => a.sev === "high"), med = alerts.filter((a) => a.sev === "med");
  return (
    <div>
      <Header title="Alerts & Early Warnings" sub={`${alerts.length} active alerts`} />
      <div style={S.kpiRow}>
        <Kpi label="Total Alerts" value={alerts.length} tone={alerts.length ? "warn" : "good"} />
        <Kpi label="High Priority" value={high.length} tone={high.length ? "warn" : "good"} />
        <Kpi label="Medium" value={med.length} />
      </div>
      <Card title="Active Alerts">
        {alerts.length === 0 && <Empty text="No active alerts. All suppliers within thresholds." />}
        {alerts.map((a) => (
          <div key={a.id} style={S.row}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ width: 10, height: 10, borderRadius: 5, background: a.sev === "high" ? "#d03b3b" : "#fab219" }} />
              <div><div style={{ fontSize: 14, fontWeight: 500 }}>{a.msg}</div><div style={{ fontSize: 12, color: "#64748B" }}>{a.supplier}</div></div>
            </div>
            <span style={{ ...S.pill, background: a.sev === "high" ? "#FEE2E2" : "#FEF3C7", color: a.sev === "high" ? "#991B1B" : "#92400E" }}>{a.sev === "high" ? "High" : "Medium"}</span>
          </div>
        ))}
      </Card>
      <div style={{ fontSize: 12, color: "#64748B", marginTop: 12 }}>Production adds email + SMS delivery and configurable thresholds per client.</div>
    </div>
  );
}

// ---------- risk weight settings ----------
function Settings() {
  const { weights, setWeights } = useApp();
  const set = (k, v) => setWeights((p) => ({ ...p, [k]: Number(v) }));
  return (
    <div>
      <Header title="Risk Model Weights" sub="Tune how each category contributes to the overall score" />
      <Card title="Category Weights">
        <div style={{ fontSize: 13, color: "#64748B", marginBottom: 16 }}>Higher weight = greater impact on the overall risk score. Auto buyers may weigh quality and continuity higher; food buyers weigh food safety and cold chain.</div>
        {RISK_CATEGORIES.map((c) => (
          <div key={c.key} style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
              <span style={{ fontWeight: 500 }}>{c.label}</span><span style={{ color: "#1D9E75", fontWeight: 600 }}>{(weights[c.key] ?? 1).toFixed(1)}×</span>
            </div>
            <input type="range" min="0.5" max="3" step="0.5" value={weights[c.key] ?? 1} onChange={(e) => set(c.key, e.target.value)} style={{ width: "100%" }} />
          </div>
        ))}
        <button style={{ ...S.ghost, marginTop: 8 }} onClick={() => setWeights({})}>Reset to equal weights</button>
      </Card>
    </div>
  );
}

// ---------- shared components ----------
const Header = ({ title, sub, action }) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 22 }}>
    <div><h1 style={{ fontSize: 23, fontWeight: 700, margin: 0, letterSpacing: "-0.02em" }}>{title}</h1><div style={{ fontSize: 14, color: "#64748B", marginTop: 4 }}>{sub}</div></div>
    {action}
  </div>
);
const Kpi = ({ label, value, suffix, tone }) => (
  <div style={S.kpi}><div style={{ fontSize: 11, color: "#64748B", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
    <div style={{ fontSize: 28, fontWeight: 700, marginTop: 6, color: tone === "warn" ? "#d03b3b" : tone === "good" ? "#0f6e56" : "#0f172a" }}>{value}<span style={{ fontSize: 14, color: "#94A3B8", fontWeight: 500 }}>{suffix || ""}</span></div>
  </div>
);
const Card = ({ title, right, children }) => (
  <div style={S.card}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}><div style={{ fontWeight: 600, fontSize: 15 }}>{title}</div>{right}</div>{children}</div>
);
const Field = ({ label, children }) => (<div style={{ marginBottom: 12, flex: 1 }}><label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#475569", marginBottom: 5 }}>{label}</label>{children}</div>);
const Row = ({ children }) => <div style={{ display: "flex", gap: 10 }}>{children}</div>;
const Meta = ({ label, value }) => (<div style={{ marginBottom: 8 }}><div style={{ fontSize: 11, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</div><div style={{ fontSize: 13, color: "#334155" }}>{value || "—"}</div></div>);
const RiskBadge = ({ risk }) => (<span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: risk.color + "22", color: risk.color, padding: "4px 10px", borderRadius: 8, fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>{risk.score != null ? `${risk.score} · ${risk.tier}` : "Unrated"}</span>);
const StatusPill = ({ status }) => { const map = { Approved: ["#D1FAE5", "#065F46"], Conditional: ["#FEF3C7", "#92400E"], "Under Review": ["#DBEAFE", "#1E40AF"], Prospect: ["#F1F5F9", "#475569"], Suspended: ["#FEE2E2", "#991B1B"], Open: ["#FEF3C7", "#92400E"], "In Progress": ["#DBEAFE", "#1E40AF"], Closed: ["#D1FAE5", "#065F46"], New: ["#DBEAFE", "#1E40AF"], Reviewed: ["#FEF3C7", "#92400E"], Converted: ["#D1FAE5", "#065F46"] }; const [bg, c] = map[status] || ["#F1F5F9", "#475569"]; return <span style={{ ...S.pill, background: bg, color: c }}>{status}</span>; };
const CcbsPill = ({ level }) => { const map = { "CCBS Bronze": "#B45309", "CCBS Silver": "#64748B", "CCBS Gold": "#B8860B", "CCBS Platinum": "#0f766e" }; return <span style={{ ...S.pill, background: (map[level] || "#888") + "22", color: map[level] || "#888", fontWeight: 600 }}>{level}</span>; };
const Tag = ({ children }) => <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 6, background: "#F1F5F9", color: "#475569", border: "1px solid #E2E8F0" }}>{children}</span>;
const Chip = ({ children }) => <span style={{ fontSize: 12, fontWeight: 600, color: "#64748B", background: "#F1F5F9", padding: "2px 10px", borderRadius: 12 }}>{children}</span>;
const SeverityText = ({ sev }) => { const c = { None: "#64748B", Minor: "#fab219", Major: "#ec835a", Critical: "#d03b3b" }[sev] || "#64748B"; return <span style={{ color: c, fontWeight: 600, fontSize: 12 }}>{sev}</span>; };
const Empty = ({ text }) => <div style={{ padding: "22px 0", textAlign: "center", color: "#94A3B8", fontSize: 14 }}>{text}</div>;

const GLOBAL_CSS = `
  * { box-sizing: border-box; }
  input:focus, select:focus, textarea:focus { outline: none; border-color: #1D9E75 !important; }
  button { font-family: inherit; cursor: pointer; }
  input[type=range] { accent-color: #1D9E75; }
  ::-webkit-scrollbar { width: 8px; height: 8px; }
  ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
`;

const LS = {
  wrap: { minHeight: 600, display: "flex", alignItems: "center", justifyContent: "center", background: "#0F172A", fontFamily: "Inter, -apple-system, sans-serif", borderRadius: 12 },
  card: { background: "#fff", borderRadius: 16, padding: "40px 36px", width: 380, boxShadow: "0 20px 60px rgba(0,0,0,0.3)" },
  logo: { fontSize: 26, fontWeight: 800, letterSpacing: "-0.03em", textAlign: "center" },
  sub: { fontSize: 12, color: "#64748B", textAlign: "center", marginTop: 4, textTransform: "uppercase", letterSpacing: "0.08em" },
  label: { display: "block", fontSize: 12, fontWeight: 500, color: "#475569", margin: "14px 0 5px" },
  input: { width: "100%", padding: "10px 12px", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 14 },
  btn: { width: "100%", marginTop: 22, background: "#1D9E75", color: "#fff", border: "none", padding: "12px", borderRadius: 8, fontSize: 14, fontWeight: 600 },
  note: { fontSize: 11, color: "#94A3B8", textAlign: "center", marginTop: 18, lineHeight: 1.5 },
  back: { display: "block", margin: "14px auto 0", background: "none", border: "none", color: "#64748B", fontSize: 13, fontWeight: 500, cursor: "pointer" },
};

const P = {
  page: { fontFamily: "Inter, -apple-system, sans-serif", color: "#0f172a", background: "#fff", minHeight: "100vh" },
  nav: { position: "sticky", top: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 6%", height: 66, background: "rgba(255,255,255,0.92)", backdropFilter: "blur(10px)", borderBottom: "1px solid #E2E8F0" },
  navLogo: { fontSize: 20, fontWeight: 800, letterSpacing: "-0.03em", cursor: "pointer" },
  navTabs: { display: "flex", gap: 8 },
  navTab: { background: "none", border: "none", color: "#475569", fontSize: 14, fontWeight: 500, padding: "8px 14px", borderRadius: 8, cursor: "pointer" },
  navTabActive: { color: "#0f172a", background: "#F1F5F9" },
  navCta: { background: "#1D9E75", color: "#fff", border: "none", padding: "9px 20px", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer" },
  navAssessBtn: { background: "#fff", color: "#0f6e56", border: "1px solid #1D9E7550", padding: "9px 16px", borderRadius: 8, fontSize: 13.5, fontWeight: 600, cursor: "pointer" },
  hero: { textAlign: "center", padding: "90px 6% 70px", background: "linear-gradient(180deg, #F8FAFC 0%, #fff 100%)" },
  heroBadge: { display: "inline-block", background: "#1D9E7515", color: "#0f6e56", border: "1px solid #1D9E7530", borderRadius: 100, padding: "6px 16px", fontSize: 13, fontWeight: 600, letterSpacing: "0.03em", marginBottom: 24 },
  heroH1: { fontSize: "clamp(2.2rem, 5vw, 3.6rem)", fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.1, margin: "0 0 20px" },
  heroSub: { fontSize: 18, color: "#475569", maxWidth: 640, margin: "0 auto 34px", lineHeight: 1.6 },
  heroBtns: { display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" },
  btnPrimary: { background: "#1D9E75", color: "#fff", border: "none", padding: "13px 28px", borderRadius: 10, fontSize: 15, fontWeight: 600, cursor: "pointer" },
  btnGhost: { background: "#fff", color: "#0f172a", border: "1px solid #E2E8F0", padding: "13px 28px", borderRadius: 10, fontSize: 15, fontWeight: 600, cursor: "pointer" },
  statRow: { display: "flex", justifyContent: "center", gap: 0, flexWrap: "wrap", marginTop: 56, maxWidth: 760, marginLeft: "auto", marginRight: "auto", border: "1px solid #E2E8F0", borderRadius: 16, overflow: "hidden" },
  stat: { flex: 1, minWidth: 150, padding: "22px 16px", borderRight: "1px solid #E2E8F0" },
  statNum: { fontSize: 26, fontWeight: 800, color: "#1D9E75", letterSpacing: "-0.02em" },
  statLbl: { fontSize: 12, color: "#64748B", marginTop: 4, textTransform: "uppercase", letterSpacing: "0.05em" },
  section: { padding: "70px 6%", maxWidth: 1100, margin: "0 auto" },
  secEyebrow: { textAlign: "center", fontSize: 13, fontWeight: 700, color: "#1D9E75", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 },
  secH2: { textAlign: "center", fontSize: "clamp(1.6rem, 3vw, 2.4rem)", fontWeight: 800, letterSpacing: "-0.02em", margin: "0 0 8px" },
  cards3: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 18, marginTop: 34 },
  cards2: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 18, marginTop: 34 },
  card: { background: "#fff", border: "1px solid #E2E8F0", borderRadius: 14, padding: 26 },
  cardTitle: { fontSize: 17, fontWeight: 700, marginBottom: 8, letterSpacing: "-0.01em" },
  cardText: { fontSize: 14.5, color: "#475569", lineHeight: 1.6 },
  stepRow: { display: "flex", gap: 24, alignItems: "flex-start", padding: "22px 0", borderBottom: "1px solid #F1F5F9" },
  stepNum: { fontSize: 22, fontWeight: 800, color: "#1D9E75", minWidth: 48 },
  cta: { textAlign: "center", padding: "80px 6%", background: "#0F172A", color: "#fff" },
  priceCard: { position: "relative", background: "#fff", border: "1px solid #E2E8F0", borderRadius: 16, padding: 28 },
  priceCardHot: { border: "2px solid #1D9E75", boxShadow: "0 12px 40px rgba(29,158,117,0.15)" },
  priceBadge: { position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", background: "#1D9E75", color: "#fff", fontSize: 12, fontWeight: 600, padding: "4px 14px", borderRadius: 100 },
  priceName: { fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em" },
  priceSub: { fontSize: 13, color: "#64748B", marginTop: 2 },
  priceFeat: { fontSize: 14, color: "#334155", display: "flex", gap: 8, padding: "6px 0" },
  footer: { display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "40px 6%", borderTop: "1px solid #E2E8F0", textAlign: "center" },
};

const S = {
  app: { display: "flex", minHeight: 600, fontFamily: "Inter, -apple-system, sans-serif", background: "#F8FAFC", color: "#0f172a", borderRadius: 12, overflow: "hidden", border: "1px solid #E2E8F0" },
  sidebar: { width: 210, background: "#0F172A", color: "#fff", padding: "22px 16px", flexShrink: 0, display: "flex", flexDirection: "column" },
  logo: { fontSize: 19, fontWeight: 800, letterSpacing: "-0.03em" },
  logoSub: { fontSize: 10, color: "#64748B", marginTop: 2, textTransform: "uppercase", letterSpacing: "0.08em" },
  navItem: { display: "block", width: "100%", background: "none", border: "none", color: "#94A3B8", padding: "9px 12px", borderRadius: 8, fontSize: 13.5, fontWeight: 500, textAlign: "left", marginBottom: 3 },
  navActive: { background: "rgba(29,158,117,0.15)", color: "#fff" },
  userBox: { marginTop: "auto", paddingTop: 16, borderTop: "1px solid #1E293B" },
  logout: { marginTop: 10, width: "100%", background: "none", border: "1px solid #334155", color: "#94A3B8", padding: "7px", borderRadius: 7, fontSize: 12, fontWeight: 500 },
  main: { flex: 1, padding: "26px 30px", overflowY: "auto", maxHeight: 760 },
  kpiRow: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 12, marginBottom: 20 },
  kpi: { background: "#fff", border: "1px solid #E2E8F0", borderRadius: 12, padding: "14px 16px" },
  grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 },
  card: { background: "#fff", border: "1px solid #E2E8F0", borderRadius: 12, padding: 18, marginBottom: 0 },
  track: { height: 7, background: "#F1F5F9", borderRadius: 4, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 4 },
  row: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: "1px solid #F1F5F9", gap: 10 },
  link: { background: "none", border: "none", color: "#1D9E75", fontSize: 13, fontWeight: 600, padding: "10px 0 0", textAlign: "left" },
  back: { background: "none", border: "none", color: "#64748B", fontSize: 13, fontWeight: 500, padding: "0 0 14px", cursor: "pointer" },
  filters: { display: "flex", gap: 10, marginBottom: 16 },
  search: { flex: 1, padding: "10px 14px", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 14 },
  select: { padding: "10px 14px", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 14, background: "#fff" },
  cardGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 },
  supCard: { background: "#fff", border: "1px solid #E2E8F0", borderRadius: 12, padding: 16, cursor: "pointer" },
  supMeta: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, margin: "12px 0" },
  input: { width: "100%", padding: "9px 12px", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 14, background: "#fff" },
  dot: { flex: 1, padding: "7px 0", border: "1px solid #E2E8F0", background: "#fff", borderRadius: 6, fontSize: 13, fontWeight: 600, color: "#64748B" },
  chipBtn: { padding: "5px 10px", border: "1px solid #E2E8F0", background: "#fff", borderRadius: 20, fontSize: 12, fontWeight: 500, color: "#475569" },
  primary: { background: "#1D9E75", color: "#fff", border: "none", padding: "11px 24px", borderRadius: 8, fontSize: 14, fontWeight: 600 },
  primaryInline: { background: "#1D9E75", color: "#fff", border: "none", padding: "9px 18px", borderRadius: 8, fontSize: 13, fontWeight: 600 },
  ghost: { background: "#fff", color: "#475569", border: "1px solid #E2E8F0", padding: "11px 24px", borderRadius: 8, fontSize: 14, fontWeight: 600 },
  smallBtn: { background: "#F8FAFC", border: "1px solid #E2E8F0", padding: "6px 12px", borderRadius: 6, fontSize: 12, fontWeight: 500 },
  pill: { fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 20, whiteSpace: "nowrap" },
  overlay: { position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20 },
  modal: { background: "#fff", borderRadius: 14, padding: 24, width: "100%", maxWidth: 480, maxHeight: "88vh", overflowY: "auto" },
};

export default App;
