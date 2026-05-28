"use client";

import { useMemo, useRef, useState } from "react";
import { getMedicineStatus, normalizeExpiryDate, type MedicineStatus } from "@/lib/dates";

type User = {
  id: string;
  name: string;
  email: string;
};

export type MedicineRow = {
  id?: string;
  medicineName: string;
  batchNo: string;
  quantity: number | null;
  expiryText: string;
  expiryDate: string;
  confidence: number | null;
  source: "manual" | "openai";
  sourceImageName: string;
  status?: MedicineStatus;
};

type Props = {
  user: User;
  initialMedicines: MedicineRow[];
};

const emptyRow = (): MedicineRow => ({
  medicineName: "",
  batchNo: "",
  quantity: null,
  expiryText: "",
  expiryDate: "",
  confidence: null,
  source: "manual",
  sourceImageName: ""
});

export function Dashboard({ user, initialMedicines }: Props) {
  const [medicines, setMedicines] = useState(initialMedicines);
  const [draftRows, setDraftRows] = useState<MedicineRow[]>([emptyRow()]);
  const [filter, setFilter] = useState<"all" | MedicineStatus>("all");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const visibleMedicines = useMemo(() => {
    return medicines
      .map((row) => ({ ...row, status: getMedicineStatus(row.expiryDate) }))
      .filter((row) => filter === "all" || row.status === filter)
      .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
  }, [filter, medicines]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  async function extractFromFile(file: File) {
    setError("");
    setMessage("");
    setExtracting(true);
    const formData = new FormData();
    formData.append("image", file);
    const response = await fetch("/api/extract", { method: "POST", body: formData });
    setExtracting(false);

    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "Extraction failed.");
      return;
    }

    setDraftRows(data.rows.length ? data.rows : [emptyRow()]);
    setMessage(`Fetched ${data.rows.length} row(s). Review and edit before saving.`);
  }

  async function startCamera() {
    setError("");
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
    streamRef.current = stream;
    setCameraActive(true);
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraActive(false);
  }

  async function capturePhoto() {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
    if (blob) {
      await extractFromFile(new File([blob], "camera-capture.jpg", { type: "image/jpeg" }));
    }
  }

  function updateDraft(index: number, field: keyof MedicineRow, value: string) {
    setDraftRows((rows) =>
      rows.map((row, rowIndex) => {
        if (rowIndex !== index) {
          return row;
        }

        const next = {
          ...row,
          [field]: field === "quantity" ? (value ? Number(value) : null) : value
        };
        if (field === "expiryText" && !next.expiryDate) {
          next.expiryDate = normalizeExpiryDate(value) || "";
        }
        return next;
      })
    );
  }

  async function saveDraftRows() {
    setError("");
    setMessage("");
    const rows = draftRows.filter((row) => row.medicineName.trim() && row.expiryDate);
    if (!rows.length) {
      setError("Add at least one row with medicine name and expiry date.");
      return;
    }

    const response = await fetch("/api/medicines", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows })
    });
    const data = await response.json();
    if (!response.ok) {
      setError("Could not save rows. Check names and dates.");
      return;
    }

    setMedicines((current) => [
      ...data.medicines.map((medicine: any) => ({
        id: medicine.id,
        medicineName: medicine.medicineName,
        batchNo: medicine.batchNo || "",
        quantity: medicine.quantity,
        expiryText: medicine.expiryText || "",
        expiryDate: medicine.expiryDate.slice(0, 10),
        confidence: medicine.confidence,
        source: medicine.source,
        sourceImageName: medicine.sourceImageName || ""
      })),
      ...current
    ]);
    setDraftRows([emptyRow()]);
    setMessage("Saved reviewed rows to the local database.");
  }

  async function updateSaved(row: MedicineRow) {
    if (!row.id) {
      return;
    }

    const response = await fetch(`/api/medicines/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(row)
    });

    if (!response.ok) {
      setError("Could not update saved row.");
      return;
    }

    setMessage("Saved row updated.");
  }

  async function deleteSaved(id?: string) {
    if (!id) {
      return;
    }

    const response = await fetch(`/api/medicines/${id}`, { method: "DELETE" });
    if (!response.ok) {
      setError("Could not delete row.");
      return;
    }

    setMedicines((rows) => rows.filter((row) => row.id !== id));
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">ExpiryIQ</p>
          <h1>Medicine expiry tracker</h1>
          <p className="muted">Signed in as {user.name} ({user.email})</p>
        </div>
        <button className="secondary" onClick={logout}>
          Logout
        </button>
      </header>

      <div className="grid two-col">
        <section className="panel grid">
          <div>
            <h2>Capture or upload</h2>
            <p className="muted">Fetched rows stay editable until you save them.</p>
          </div>
          <input
            accept="image/*"
            type="file"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                void extractFromFile(file);
              }
            }}
          />
          <video className="camera" ref={videoRef} autoPlay muted playsInline />
          <div className="actions">
            <button className="secondary" onClick={cameraActive ? stopCamera : startCamera} type="button">
              {cameraActive ? "Stop camera" : "Start camera"}
            </button>
            <button onClick={capturePhoto} disabled={!cameraActive || extracting} type="button">
              {extracting ? "Extracting..." : "Capture"}
            </button>
          </div>
        </section>

        <section className="panel grid">
          <div className="toolbar">
            <div>
              <h2>Review before saving</h2>
              <p className="muted">Edit fetched entries or insert manual rows here.</p>
            </div>
            <button className="secondary" onClick={() => setDraftRows((rows) => [...rows, emptyRow()])} type="button">
              Add row
            </button>
          </div>
          <EditableTable
            rows={draftRows}
            onChange={updateDraft}
            onDelete={(index) => setDraftRows((rows) => rows.filter((_, rowIndex) => rowIndex !== index))}
          />
          <div className="actions">
            <button onClick={saveDraftRows} type="button">
              Save reviewed rows
            </button>
            <button className="secondary" onClick={() => setDraftRows([emptyRow()])} type="button">
              Clear draft
            </button>
          </div>
          {message ? <p className="notice">{message}</p> : null}
          {error ? <p className="notice error">{error}</p> : null}
        </section>
      </div>

      <section className="panel grid" style={{ marginTop: 16 }}>
        <div className="toolbar">
          <div>
            <h2>Saved medicines</h2>
            <p className="muted">Near-expiry and expired medicines are highlighted red.</p>
          </div>
          <select value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)}>
            <option value="all">All</option>
            <option value="safe">Safe</option>
            <option value="near_expiry">Near expiry</option>
            <option value="expired">Expired</option>
          </select>
        </div>
        <SavedTable
          rows={visibleMedicines}
          onChange={(changed) => setMedicines((rows) => rows.map((row) => (row.id === changed.id ? changed : row)))}
          onSave={updateSaved}
          onDelete={deleteSaved}
        />
      </section>
    </main>
  );
}

function EditableTable({
  rows,
  onChange,
  onDelete
}: {
  rows: MedicineRow[];
  onChange: (index: number, field: keyof MedicineRow, value: string) => void;
  onDelete: (index: number) => void;
}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Medicine</th>
            <th>Batch</th>
            <th>Qty</th>
            <th>Expiry text</th>
            <th>Expiry date</th>
            <th>Confidence</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              <td>
                <input value={row.medicineName} onChange={(event) => onChange(index, "medicineName", event.target.value)} />
              </td>
              <td>
                <input value={row.batchNo} onChange={(event) => onChange(index, "batchNo", event.target.value)} />
              </td>
              <td>
                <input
                  min={1}
                  type="number"
                  value={row.quantity || ""}
                  onChange={(event) => onChange(index, "quantity", event.target.value)}
                />
              </td>
              <td>
                <input value={row.expiryText} onChange={(event) => onChange(index, "expiryText", event.target.value)} />
              </td>
              <td>
                <input type="date" value={row.expiryDate} onChange={(event) => onChange(index, "expiryDate", event.target.value)} />
              </td>
              <td>{row.confidence == null ? "Manual" : `${Math.round(row.confidence * 100)}%`}</td>
              <td>
                <button className="danger" onClick={() => onDelete(index)} type="button">
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SavedTable({
  rows,
  onChange,
  onSave,
  onDelete
}: {
  rows: MedicineRow[];
  onChange: (row: MedicineRow) => void;
  onSave: (row: MedicineRow) => void;
  onDelete: (id?: string) => void;
}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Medicine</th>
            <th>Batch</th>
            <th>Qty</th>
            <th>Expiry</th>
            <th>Status</th>
            <th>Source</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((row) => (
              <tr className={row.status} key={row.id}>
                <td>
                  <input value={row.medicineName} onChange={(event) => onChange({ ...row, medicineName: event.target.value })} />
                </td>
                <td>
                  <input value={row.batchNo} onChange={(event) => onChange({ ...row, batchNo: event.target.value })} />
                </td>
                <td>
                  <input
                    min={1}
                    type="number"
                    value={row.quantity || ""}
                    onChange={(event) => onChange({ ...row, quantity: event.target.value ? Number(event.target.value) : null })}
                  />
                </td>
                <td>
                  <input type="date" value={row.expiryDate} onChange={(event) => onChange({ ...row, expiryDate: event.target.value })} />
                </td>
                <td>
                  <span className={`status-pill ${row.status}`}>{row.status?.replace("_", " ")}</span>
                </td>
                <td>{row.source}</td>
                <td>
                  <div className="actions">
                    <button onClick={() => onSave(row)} type="button">
                      Save
                    </button>
                    <button className="danger" onClick={() => onDelete(row.id)} type="button">
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={7}>No medicines saved yet.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
