// Public coach credential intake (/credentials). No login — one link shared
// with coaches and gym owners for the season.
//
// Files go browser -> SharePoint directly via Graph upload sessions minted by
// /api/credentials. They never pass through Vercel, which caps request bodies
// at 4.5MB, and never touch Supabase.

import { useState, useEffect, useRef } from "react";

const SUPABASE_URL = "https://peylonukcwsqdknchxda.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBleWxvbnVrY3dzcWRrbmNoeGRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5MDQxOTYsImV4cCI6MjA5MzQ4MDE5Nn0.fTgnQxWxBDcHk0Xq-4KQJZH9xi4bYwle27tdrjseQ3k";

const SEASON = "2026-27";
const PRIOR_SEASON = "2025-2026";

const CREDENTIAL_LEVELS = [
  "Novice Level 1",
  "Novice Level 2",
  "Intermediate",
  "Advanced",
  "Other / not listed",
];

const ACCEPT = "image/jpeg,image/png,image/heic,image/heif,image/webp,application/pdf";
const MAX_BYTES = 25 * 1024 * 1024;
// Graph requires chunks in multiples of 320 KiB; 5 MiB keeps the request count
// sane on a venue wifi connection without being a huge retry unit.
const CHUNK = 5 * 320 * 1024;

const card = { background: "#fff", borderRadius: 14, border: "1px solid #e5e7eb", padding: "24px 22px", marginBottom: 16 };
const input = { width: "100%", padding: "12px 14px", border: "1px solid #d1d5db", borderRadius: 10, fontSize: 16, fontFamily: "inherit", boxSizing: "border-box", color: "#1a1a2e", background: "#fff" };
const label = { display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 };
const primary = { width: "100%", background: "#1a1a2e", color: "#fff", border: "none", borderRadius: 12, padding: 15, fontSize: 16, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" };
const ghost = { width: "100%", background: "none", border: "1px solid #d1d5db", borderRadius: 12, padding: 13, fontSize: 15, color: "#374151", fontFamily: "inherit", cursor: "pointer" };

// Whole years — a birthday later this year must not round someone up to 18.
function ageFrom(dateStr) {
  const dob = new Date(`${dateStr}T00:00:00`);
  if (isNaN(dob)) return null;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
  return age;
}

function Choice({ selected, onClick, title, sub }) {
  return (
    <button type="button" onClick={onClick}
      style={{
        display: "block", width: "100%", textAlign: "left", marginBottom: 10,
        padding: "16px 18px", borderRadius: 12, cursor: "pointer", fontFamily: "inherit",
        background: selected ? "#1a1a2e" : "#fff",
        color: selected ? "#fff" : "#1a1a2e",
        border: `1px solid ${selected ? "#1a1a2e" : "#d7dae0"}`,
      }}>
      <div style={{ fontSize: 16, fontWeight: 600 }}>{title}</div>
      {sub && <div style={{ fontSize: 13, opacity: selected ? 0.75 : 0.6, marginTop: 3 }}>{sub}</div>}
    </button>
  );
}

function FileField({ id, title, hint, file, onPick, progress }) {
  const ref = useRef();
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={label}>{title} <span style={{ color: "#ef4444" }}>*</span></div>
      {hint && <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 8 }}>{hint}</div>}
      <div onClick={() => ref.current?.click()}
        style={{
          border: `2px dashed ${file ? "#1a1a2e" : "#d1d5db"}`, borderRadius: 10,
          padding: 16, textAlign: "center", cursor: "pointer", background: "#fafafa",
        }}>
        {file
          ? <div style={{ fontSize: 14, color: "#374151", wordBreak: "break-all" }}>
              {file.type?.startsWith("image/") ? "🖼️" : "📄"} {file.name}
              <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 3 }}>{(file.size / 1024 / 1024).toFixed(1)} MB — tap to change</div>
            </div>
          : <>
              <div style={{ fontSize: 22, marginBottom: 6 }}>📎</div>
              <div style={{ fontSize: 13, color: "#6b7280" }}>Tap to take a photo or choose a file</div>
            </>}
      </div>
      {progress != null && (
        <div style={{ height: 6, background: "#e5e7eb", borderRadius: 99, marginTop: 8, overflow: "hidden" }}>
          <div style={{ width: `${progress}%`, height: "100%", background: "#1a1a2e", transition: "width .2s" }} />
        </div>
      )}
      <input ref={ref} id={id} type="file" accept={ACCEPT} capture="environment"
        style={{ display: "none" }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onPick(f); e.target.value = ""; }} />
    </div>
  );
}

// Uploads one file to its Graph upload session, in chunks, reporting progress.
async function uploadFile(uploadUrl, file, onProgress) {
  let start = 0;
  while (start < file.size) {
    const end = Math.min(start + CHUNK, file.size);
    const chunk = file.slice(start, end);
    const r = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Length": String(end - start),
        "Content-Range": `bytes ${start}-${end - 1}/${file.size}`,
      },
      body: chunk,
    });
    // 202 = more expected, 200/201 = finished.
    if (!r.ok && r.status !== 202) throw new Error(`Upload failed (${r.status})`);
    start = end;
    onProgress(Math.round((start / file.size) * 100));
  }
}

export default function Credentials() {
  const [programs, setPrograms] = useState([]);
  const [loadingPrograms, setLoadingPrograms] = useState(true);
  const [step, setStep] = useState("role");        // role | details | done
  const [role, setRole] = useState(null);          // 'coach' | 'gym_admin'
  const [form, setForm] = useState({
    program: "", firstName: "", lastName: "", email: "",
    birthdate: "", credentialLevel: CREDENTIAL_LEVELS[0],
  });
  const [hadCard, setHadCard] = useState(null);    // coaches only
  const [programQuery, setProgramQuery] = useState("");
  const [files, setFiles] = useState({});          // field -> File
  const [progress, setProgress] = useState({});    // field -> 0..100
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`${SUPABASE_URL}/rest/v1/programs?select=id,name,city,province&active=eq.true&order=name`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    })
      .then((r) => r.json())
      .then((d) => setPrograms(Array.isArray(d) ? d : []))
      .catch(() => setPrograms([]))
      .finally(() => setLoadingPrograms(false));
  }, []);

  const isCoach = role === "coach";
  const age = form.birthdate ? ageFrom(form.birthdate) : null;
  const isMinor = isCoach && age != null && age < 18;
  // Gym admin cards start this season, so no admin can hold a prior card.
  const needsSelfie = isCoach ? hadCard === false : true;

  const setF = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const pick = (field) => (file) => {
    if (file.size > MAX_BYTES) { setError(`${file.name} is over 25MB — please use a smaller photo.`); return; }
    setError("");
    setFiles((p) => ({ ...p, [field]: file }));
  };

  const matches = programQuery.trim().length < 2 ? [] : programs
    .filter((p) => p.name.toLowerCase().includes(programQuery.trim().toLowerCase()))
    .slice(0, 8);

  function requiredFiles() {
    const need = [];
    if (isCoach) {
      need.push("credential");
      need.push(isMinor ? "proofOfAge" : "vsc");
    } else {
      need.push("vsc");
    }
    if (needsSelfie) need.push("selfie");
    return need;
  }

  function validate() {
    if (!form.program) return "Please choose your program from the list.";
    if (!form.firstName.trim() || !form.lastName.trim()) return "Please enter your first and last name.";
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim())) return "Please enter a valid email address.";
    if (isCoach) {
      if (!form.birthdate) return "Please enter your date of birth.";
      if (age == null || age < 5 || age > 100) return "Please check your date of birth.";
      if (hadCard === null) return `Please tell us whether you had a ${PRIOR_SEASON} credential card.`;
    }
    for (const f of requiredFiles()) if (!files[f]) return "Please attach every required document.";
    return null;
  }

  async function submit() {
    const problem = validate();
    if (problem) { setError(problem); return; }
    setBusy(true); setError("");
    try {
      const declared = requiredFiles().map((field) => ({
        field, mimeType: files[field].type || "application/octet-stream", size: files[field].size,
      }));

      const startRes = await fetch("/api/credentials", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "start",
          role, program: form.program,
          firstName: form.firstName, lastName: form.lastName, email: form.email,
          ...(isCoach ? { birthdate: form.birthdate, hadCard2526: hadCard, credentialLevel: form.credentialLevel } : {}),
          files: declared,
        }),
      });
      const start = await startRes.json();
      if (!startRes.ok) throw new Error(start.error || "Could not start the submission");

      for (const u of start.uploads) {
        await uploadFile(u.uploadUrl, files[u.field], (pct) =>
          setProgress((p) => ({ ...p, [u.field]: pct })));
      }

      const finishRes = await fetch("/api/credentials", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "finish",
          itemId: start.itemId, folderPath: start.folderPath,
          files: start.uploads.map((u) => ({ field: u.field, name: u.name })),
        }),
      });
      if (!finishRes.ok) throw new Error((await finishRes.json()).error || "Could not finish the submission");
      setStep("done");
    } catch (e) {
      setError(`${e.message}. Nothing was lost — you can try submitting again.`);
    }
    setBusy(false);
  }

  const wrap = { minHeight: "100vh", background: "#f8f9fb", fontFamily: "'DM Sans','Segoe UI',sans-serif", padding: "28px 16px 60px" };
  const inner = { maxWidth: 560, margin: "0 auto" };

  if (step === "done") return (
    <div style={wrap}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap'); * { box-sizing: border-box; margin: 0; padding: 0; }`}</style>
      <div style={{ ...inner, textAlign: "center", paddingTop: 40 }}>
        <div style={{ ...card, padding: "40px 28px" }}>
          <div style={{ fontSize: 48, marginBottom: 14 }}>✅</div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: "#1a1a2e", marginBottom: 10 }}>Submitted</h2>
          <p style={{ color: "#6b7280", fontSize: 15, lineHeight: 1.55, marginBottom: 22 }}>
            Thanks {form.firstName.trim()} — your documents are with us.{" "}
            {needsSelfie
              ? `You'll collect your ${SEASON} Coaching Credential Card at the first event you attend.`
              : "We'll verify your existing credential card at the first event you attend."}
          </p>
          <p style={{ color: "#9ca3af", fontSize: 13, marginBottom: 22 }}>A confirmation has been sent to {form.email.trim()}.</p>
          <button style={ghost} onClick={() => {
            setStep("role"); setRole(null); setHadCard(null); setFiles({}); setProgress({});
            setForm({ program: "", firstName: "", lastName: "", email: "", birthdate: "", credentialLevel: CREDENTIAL_LEVELS[0] });
            setProgramQuery("");
          }}>Submit for another person</button>
        </div>
      </div>
    </div>
  );

  return (
    <div style={wrap}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap'); * { box-sizing: border-box; margin: 0; padding: 0; }`}</style>
      <div style={inner}>
        <div style={{ textAlign: "center", marginBottom: 22 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1a1a2e", marginBottom: 6 }}>Coach Credentials {SEASON}</h1>
          <p style={{ color: "#6b7280", fontSize: 15 }}>One submission per person, once per season.</p>
        </div>

        {step === "role" && (
          <div style={card}>
            <div style={{ ...label, marginBottom: 12 }}>Who is filling this out?</div>
            <Choice title="I'm a coach" sub="Coaching at events this season"
              selected={role === "coach"} onClick={() => { setRole("coach"); setStep("details"); }} />
            <Choice title="I'm a gym admin" sub="Program owner or administrator"
              selected={role === "gym_admin"} onClick={() => { setRole("gym_admin"); setHadCard(null); setStep("details"); }} />
          </div>
        )}

        {step === "details" && (
          <>
            <div style={card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div style={{ fontWeight: 700, fontSize: 13, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  {isCoach ? "Coach" : "Gym Admin"}
                </div>
                <button type="button" onClick={() => { setStep("role"); setError(""); }}
                  style={{ background: "none", border: "none", color: "#6b7280", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Change</button>
              </div>

              <div style={{ marginBottom: 18, position: "relative" }}>
                <div style={label}>{isCoach ? "Your gym / program" : "Your program"} <span style={{ color: "#ef4444" }}>*</span></div>
                {form.program ? (
                  <div style={{ ...input, display: "flex", justifyContent: "space-between", alignItems: "center", borderColor: "#1a1a2e" }}>
                    <span>{form.program}</span>
                    <button type="button" onClick={() => { setForm((f) => ({ ...f, program: "" })); setProgramQuery(""); }}
                      style={{ background: "none", border: "none", color: "#6b7280", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Change</button>
                  </div>
                ) : (
                  <>
                    <input style={input} value={programQuery} placeholder={loadingPrograms ? "Loading programs…" : "Start typing your gym's name…"}
                      disabled={loadingPrograms} onChange={(e) => setProgramQuery(e.target.value)} />
                    {matches.length > 0 && (
                      <div style={{ border: "1px solid #d1d5db", borderRadius: 10, marginTop: 6, overflow: "hidden" }}>
                        {matches.map((p) => (
                          <div key={p.id} onClick={() => { setForm((f) => ({ ...f, program: p.name })); setProgramQuery(""); }}
                            style={{ padding: "11px 14px", cursor: "pointer", fontSize: 15, borderBottom: "1px solid #f3f4f6" }}>
                            {p.name}
                            {(p.city || p.province) && <span style={{ color: "#9ca3af", fontSize: 13 }}> · {[p.city, p.province].filter(Boolean).join(", ")}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                    {programQuery.trim().length >= 2 && matches.length === 0 && !loadingPrograms && (
                      <div style={{ fontSize: 13, color: "#b45309", marginTop: 8 }}>
                        No program matches that. Check the spelling, or contact us if your gym is missing.
                      </div>
                    )}
                  </>
                )}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 18 }}>
                <div>
                  <div style={label}>First name <span style={{ color: "#ef4444" }}>*</span></div>
                  <input style={input} value={form.firstName} onChange={setF("firstName")} />
                </div>
                <div>
                  <div style={label}>Last name <span style={{ color: "#ef4444" }}>*</span></div>
                  <input style={input} value={form.lastName} onChange={setF("lastName")} />
                </div>
              </div>

              <div style={{ marginBottom: isCoach ? 18 : 0 }}>
                <div style={label}>Email <span style={{ color: "#ef4444" }}>*</span></div>
                <input style={input} type="email" value={form.email} onChange={setF("email")} placeholder="you@example.com" />
              </div>

              {isCoach && (
                <div>
                  <div style={label}>Date of birth <span style={{ color: "#ef4444" }}>*</span></div>
                  <input style={input} type="date" value={form.birthdate} onChange={setF("birthdate")} />
                  {age != null && age >= 5 && age <= 100 && (
                    <div style={{ fontSize: 13, color: isMinor ? "#b45309" : "#059669", marginTop: 8 }}>
                      {isMinor ? `Under 18 — we'll ask for proof of age instead of a vulnerable sector check.` : "18 or over."}
                    </div>
                  )}
                </div>
              )}
            </div>

            {isCoach && (
              <div style={card}>
                <div style={{ ...label, marginBottom: 4 }}>
                  Did you get a Coaching Credential Card during the {PRIOR_SEASON} season?
                </div>
                <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 12 }}>
                  If you already have one we don't need a new photo — we'll verify your card at your first event.
                </div>
                <Choice title="Yes, I have a card" sub="We'll verify it at your first event"
                  selected={hadCard === true} onClick={() => setHadCard(true)} />
                <Choice title="No, this is my first" sub={`You'll need a selfie, and collect your ${SEASON} card at your first event`}
                  selected={hadCard === false} onClick={() => setHadCard(false)} />
              </div>
            )}

            {(!isCoach || hadCard !== null) && (
              <div style={card}>
                <div style={{ fontWeight: 700, fontSize: 13, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 16 }}>Documents</div>

                {isCoach && (
                  <>
                    <div style={{ marginBottom: 18 }}>
                      <div style={label}>Coaching credential level <span style={{ color: "#ef4444" }}>*</span></div>
                      <select style={input} value={form.credentialLevel} onChange={setF("credentialLevel")}>
                        {CREDENTIAL_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                      </select>
                    </div>
                    <FileField id="credential" title="Proof of coaching credential"
                      hint="Minimum Novice Level 1 — a certificate, card or screenshot showing your name and level."
                      file={files.credential} onPick={pick("credential")} progress={progress.credential} />
                  </>
                )}

                {isCoach && isMinor ? (
                  <FileField id="proofOfAge" title="Proof of age"
                    hint="Photo of a government ID, passport or birth certificate showing your date of birth."
                    file={files.proofOfAge} onPick={pick("proofOfAge")} progress={progress.proofOfAge} />
                ) : (
                  <FileField id="vsc" title="Vulnerable Sector Check"
                    hint="A photo or PDF of your current vulnerable sector check."
                    file={files.vsc} onPick={pick("vsc")} progress={progress.vsc} />
                )}

                {needsSelfie && (
                  <FileField id="selfie" title="Photo for your credential card"
                    hint="A current photo that clearly shows your face, looking at the camera, with nothing covering it."
                    file={files.selfie} onPick={pick("selfie")} progress={progress.selfie} />
                )}

                {error && (
                  <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "11px 14px", color: "#dc2626", fontSize: 14, marginBottom: 14 }}>
                    {error}
                  </div>
                )}

                <button style={{ ...primary, opacity: busy ? 0.6 : 1, cursor: busy ? "wait" : "pointer" }}
                  disabled={busy} onClick={submit}>
                  {busy ? "Uploading…" : "Submit"}
                </button>
                {busy && (
                  <div style={{ fontSize: 12, color: "#9ca3af", textAlign: "center", marginTop: 10 }}>
                    Uploading your documents — please keep this page open.
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
