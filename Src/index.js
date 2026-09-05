import { Hono } from "hono";
import { cors } from "hono/cors";

const app = new Hono();
app.use("*", cors());

const json = (c, body, status=200) => c.json(body, status);

async function sha256(text) {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2,"0")).join("");
}

async function auth(c) {
  const h = c.req.header("Authorization") || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : "";
  if (!token) return null;
  const row = await c.env.DB.prepare(
    "SELECT u.id,u.email,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires_at>datetime('now')"
  ).bind(token).first();
  return row || null;
}

app.get("/api/health", c => json(c,{ok:true}));

app.post("/api/login", async c => {
  const {email,password} = await c.req.json();
  if(!email || !password) return json(c,{error:"Email and password are required"},400);
  const user = await c.env.DB.prepare("SELECT id,email,password_hash,role FROM users WHERE lower(email)=lower(?) AND active=1").bind(email).first();
  if(!user || user.password_hash !== await sha256(password)) return json(c,{error:"Invalid login"},401);
  const token = crypto.randomUUID()+"."+crypto.randomUUID();
  await c.env.DB.prepare("INSERT INTO sessions(token,user_id,expires_at) VALUES(?,?,datetime('now','+12 hours'))").bind(token,user.id).run();
  return json(c,{token,user:{email:user.email,role:user.role}});
});

app.get("/api/me", async c => {
  const u=await auth(c); if(!u) return json(c,{error:"Unauthorized"},401);
  return json(c,{user:u});
});

app.get("/api/patients", async c => {
  const u=await auth(c); if(!u) return json(c,{error:"Unauthorized"},401);
  const {results}=await c.env.DB.prepare("SELECT id,name,mrn,admission_date,diagnosis,created_at FROM patients WHERE active=1 ORDER BY admission_date DESC,created_at DESC").all();
  return json(c,{patients:results});
});

app.post("/api/patients", async c => {
  const u=await auth(c); if(!u) return json(c,{error:"Unauthorized"},401);
  const p=await c.req.json();
  if(!p.name) return json(c,{error:"Patient name/initials are required"},400);
  const id=crypto.randomUUID();
  await c.env.DB.prepare("INSERT INTO patients(id,name,mrn,admission_date,age,weight,diagnosis,background,created_by) VALUES(?,?,?,?,?,?,?,?,?)")
    .bind(id,p.name,p.mrn||"",p.admission_date||"",p.age||"",p.weight||"",p.diagnosis||"",p.background||"",u.id).run();
  return json(c,{patient:{id,...p}});
});

app.get("/api/patients/:id", async c => {
  const u=await auth(c); if(!u) return json(c,{error:"Unauthorized"},401);
  const p=await c.env.DB.prepare("SELECT * FROM patients WHERE id=? AND active=1").bind(c.req.param("id")).first();
  if(!p) return json(c,{error:"Patient not found"},404);
  return json(c,{patient:p});
});

app.post("/api/patients/:id/entries", async c => {
  const u=await auth(c); if(!u) return json(c,{error:"Unauthorized"},401);
  const patientId=c.req.param("id"), e=await c.req.json();
  const exists=await c.env.DB.prepare("SELECT id FROM patients WHERE id=? AND active=1").bind(patientId).first();
  if(!exists) return json(c,{error:"Patient not found"},404);
  const id=crypto.randomUUID();
  await c.env.DB.prepare(`INSERT INTO daily_entries
    (id,patient_id,entry_date,active_issues,checkup,antibiotics,labs,treatment,plan,future_plan,events,documented_by)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(id,patientId,e.entry_date||new Date().toISOString().slice(0,10),e.active_issues||"",e.checkup||"",e.antibiotics||"",e.labs||"",e.treatment||"",e.plan||"",e.future_plan||"",e.events||"",u.id).run();
  return json(c,{ok:true,id});
});

app.get("/api/patients/:id/course", async c => {
  const u=await auth(c); if(!u) return json(c,{error:"Unauthorized"},401);
  const id=c.req.param("id");
  const p=await c.env.DB.prepare("SELECT * FROM patients WHERE id=? AND active=1").bind(id).first();
  if(!p) return json(c,{error:"Patient not found"},404);
  const {results:entries}=await c.env.DB.prepare(`
    SELECT e.*,u.email AS documented_by FROM daily_entries e
    LEFT JOIN users u ON u.id=e.documented_by
    WHERE e.patient_id=? ORDER BY e.entry_date ASC,e.created_at ASC`).bind(id).all();
  const parts=[];
  parts.push(`Hospital Course — ${p.name}`);
  if(p.admission_date) parts.push(`Admission date: ${p.admission_date}`);
  if(p.diagnosis) parts.push(`Diagnosis: ${p.diagnosis}`);
  if(p.background) parts.push(`Relevant background: ${p.background}`);
  for(const e of entries){
    parts.push(`\n${e.entry_date}`);
    const fields=[["Active issues",e.active_issues],["Daily check up",e.checkup],["Antibiotics",e.antibiotics],["Labs / investigations",e.labs],["Treatment",e.treatment],["Daily plan",e.plan],["Future plan",e.future_plan],["Events",e.events]];
    for(const [label,val] of fields) if(val) parts.push(`${label}: ${val}`);
  }
  return json(c,{course:parts.join("\n"),entries});
});

app.get("/api/export", async c => {
  const u=await auth(c); if(!u || u.role!=="admin") return json(c,{error:"Admin only"},403);
  const p=await c.env.DB.prepare("SELECT * FROM patients ORDER BY created_at").all();
  const e=await c.env.DB.prepare("SELECT * FROM daily_entries ORDER BY patient_id,entry_date,created_at").all();
  return json(c,{exported_at:new Date().toISOString(),patients:p.results,entries:e.results});
});

export default app;