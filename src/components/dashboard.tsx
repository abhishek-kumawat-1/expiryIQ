"use client";

import { useMemo, useRef, useState } from "react";
import { getMedicineStatus, normalizeExpiryDate, type MedicineStatus } from "@/lib/dates";
import { tr } from "zod/v4/locales";
import Image from "next/image";

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
  const [sidebarOpen, setSidebarOpen] = useState(false);

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

  if (file.size > 10 * 1024 * 1024) {
    setError("Image too large.");
    return;
  }

  setExtracting(true);

  try {
    const formData = new FormData();

    formData.append("image", file);

    const response = await fetch("/api/extract", {
      method: "POST",
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      setError(data.error || "Extraction failed.");
      return;
    }

    setDraftRows(
      data.rows.length
        ? data.rows
        : [emptyRow()]
    );

    setMessage(
      `Fetched ${data.rows.length} row(s). Review and edit before saving.`
    );
  } catch (error) {
    console.error(error);

    setError(
      "Something went wrong while extracting the image."
    );
  } finally {
    setExtracting(false);
  }
}



  // async function startCamera() {
  //   setError("");
  //   const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
  //   streamRef.current = stream;
  //   setCameraActive(true);
  //   if (videoRef.current) {
  //     videoRef.current.srcObject = stream;
  //   }
  // }

  // function stopCamera() {
  //   streamRef.current?.getTracks().forEach((track) => track.stop());
  //   streamRef.current = null;
  //   setCameraActive(false);
  // }

  // async function capturePhoto() {
  //   const video = videoRef.current;
  //   if (!video) {
  //     return;
  //   }

  //   const canvas = document.createElement("canvas");
  //   canvas.width = video.videoWidth;
  //   canvas.height = video.videoHeight;
  //   canvas.getContext("2d")?.drawImage(video, 0, 0);
  //   const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
  //   if (blob) {
  //     await extractFromFile(new File([blob], "camera-capture.jpg", { type: "image/jpeg" }));
  //   }
  // }

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

  // return (
  //   <main className="app-shell">
  //     <header className="topbar">
  //       <div>
  //         <p className="eyebrow">ExpiryIQ</p>
  //         <h1>Medicine expiry tracker</h1>
  //         <p className="muted">Signed in as {user.name} ({user.email})</p>
  //       </div>
  //       <button className="secondary" onClick={logout}>
  //         Logout
  //       </button>
  //     </header>

  //     <div className="grid two-col">
  //       <section className="panel grid">
  //         <div>
  //           <h2>Capture or upload</h2>
  //           <p className="muted">Fetched rows stay editable until you save them.</p>
  //         </div>
  //         <input
  //           accept="image/*"
  //           type="file"
  //           onChange={(event) => {
  //             const file = event.target.files?.[0];
  //             if (file) {
  //               void extractFromFile(file);
  //             }
  //           }}
  //         />
  //         <video className="camera" ref={videoRef} autoPlay muted playsInline />
  //         <div className="actions">
  //           <button className="secondary" onClick={cameraActive ? stopCamera : startCamera} type="button">
  //             {cameraActive ? "Stop camera" : "Start camera"}
  //           </button>
  //           <button onClick={capturePhoto} disabled={!cameraActive || extracting} type="button">
  //             {extracting ? "Extracting..." : "Capture"}
  //           </button>
  //         </div>
  //       </section>

  //       <section className="panel grid">
  //         <div className="toolbar">
  //           <div>
  //             <h2>Review before saving</h2>
  //             <p className="muted">Edit fetched entries or insert manual rows here.</p>
  //           </div>
  //           <button className="secondary" onClick={() => setDraftRows((rows) => [...rows, emptyRow()])} type="button">
  //             Add row
  //           </button>
  //         </div>
  //         <EditableTable
  //           rows={draftRows}
  //           onChange={updateDraft}
  //           onDelete={(index) => setDraftRows((rows) => rows.filter((_, rowIndex) => rowIndex !== index))}
  //         />
  //         <div className="actions">
  //           <button onClick={saveDraftRows} type="button">
  //             Save reviewed rows
  //           </button>
  //           <button className="secondary" onClick={() => setDraftRows([emptyRow()])} type="button">
  //             Clear draft
  //           </button>
  //         </div>
  //         {message ? <p className="notice">{message}</p> : null}
  //         {error ? <p className="notice error">{error}</p> : null}
  //       </section>
  //     </div>

  //     <section className="panel grid" style={{ marginTop: 16 }}>
  //       <div className="toolbar">
  //         <div>
  //           <h2>Saved medicines</h2>
  //           <p className="muted">Near-expiry and expired medicines are highlighted red.</p>
  //         </div>
  //         <select value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)}>
  //           <option value="all">All</option>
  //           <option value="safe">Safe</option>
  //           <option value="near_expiry">Near expiry</option>
  //           <option value="expired">Expired</option>
  //         </select>
  //       </div>
  //       <SavedTable
  //         rows={visibleMedicines}
  //         onChange={(changed) => setMedicines((rows) => rows.map((row) => (row.id === changed.id ? changed : row)))}
  //         onSave={updateSaved}
  //         onDelete={deleteSaved}
  //       />
  //     </section>
  //   </main>
  // );

return (
  <div className={`dashboard-layout ${ sidebarOpen ? "sidebar-expanded" : "sidebar-collapsed" }`}>
    <aside className={`sidebar ${ sidebarOpen ? "open" : "closed" }`}>
      <div className="sidebar-top">
        <div>
          <p className="eyebrow">ExpiryIQ</p>

          <h2 className="sidebar-title">
            Medicine Tracker
          </h2>

          {/* <p
            className="muted"
            style={{ marginTop: 12 }}
          >
            AI-powered medicine expiry management dashboard.
          </p> */}
        </div>

        <div className="user-card">
          <div className="avatar">
            {user.name.charAt(0).toUpperCase()}
          </div>

          <div>
            <p className="user-name">
              {user.name}
            </p>

            {/* <p className="muted">
              {user.email}
            </p> */}
          </div>
        </div>

        <nav className="sidebar-nav">
          <button className="nav-item active">
            Dashboard
          </button>


          <button className="nav-item">
            Medicines
          </button>

          <button className="nav-item">
            Scanner
          </button>

          <button className="nav-item">
            Analytics
          </button>

          <button className="nav-item">
            Settings
          </button>
        </nav>
      </div>

      <button
        className="secondary logout-btn"
        onClick={logout}
      >
        Logout
      </button>
    </aside>

    <main className="dashboard-main">
     
<header className="dashboard-header">
  <div className="dashboard-header-top">
    <button
      className="sidebar-toggle"
      onClick={() =>
        setSidebarOpen((open) => !open)
      }
      type="button"
    >
      ☰
    </button>

    <div>
      {/* <p className="eyebrow">
        Dashboard
      </p> */}

      <div className="dashboard-title"> <Image src="/logo.png" alt="ExpiryIQ Logo" width={42} height={42} className="dashboard-logo" /> <h1>ExpiryIQ</h1> </div>

      <p className="muted">
        Upload medicine bills & invoices,
        extract expiry information and
        manage inventory.
      </p>
    </div>
  </div>
</header>


      <div
        className="grid two-col"
        style={{
          alignItems: "stretch",
        }}
      >
        <section className="panel grid">
          <div>
            <h2>
              Capture or upload
            </h2>          </div>

          {/* <input
            accept="image/*"
            capture="environment"
            type="file"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];

              if (file) {
                void extractFromFile(file);
              }
            }}
          /> */}


<div className="upload-wrapper">
  {extracting ? (
    <div className="extracting-overlay">
      <div className="spinner" />

      <h3>Extracting medicine details...</h3>

      <p className="muted">
        AI is analyzing the uploaded image.
      </p>
    </div>
  ) : null}


<div className="upload-actions">
  {/* Upload From Device */}
  <label className="upload-option">
    <input
      accept="image/*"
      type="file"
      hidden
      onChange={(event) => {
        const file = event.target.files?.[0];

        if (file) {
          void extractFromFile(file);
        }
      }}
    />

    <div className="upload-option-content">
      <div className="upload-icon">
        📁
      </div>

      <h3>Upload Image</h3>

      <p className="muted">
        Choose image from device
      </p>
    </div>
  </label>

  {/* Capture Using Camera */}
  <label className="upload-option">
    <input
      accept="image/*"
      capture="environment"
      type="file"
      hidden
      onChange={(event) => {
        const file = event.target.files?.[0];

        if (file) {
          void extractFromFile(file);
        }
      }}
    />

    <div className="upload-option-content">
      <div className="upload-icon">
        📸
      </div>

      <h3>Capture Photo</h3>

      <p className="muted">
        Open camera directly
      </p>
    </div>
  </label>
            </div>
            </div>




          {/* <video
            className="camera"
            ref={videoRef}
            autoPlay
            muted
            playsInline
          /> */}

          {/* <div className="actions">
            <button
              className="secondary"
              onClick={
                cameraActive
                  ? stopCamera
                  : startCamera
              }
              type="button"
            >
              {cameraActive
                ? "Stop camera"
                : "Start camera"}
            </button>

            <button
              onClick={capturePhoto}
              disabled={
                !cameraActive || extracting
              }
              type="button"
            >
              {extracting
                ? "Extracting..."
                : "Capture"}
            </button>
          </div> */}
        </section>

        <section className="panel grid">
          <div className="toolbar">
            <div>
              <h2>
                Review before saving
              </h2>

              <p className="muted">
                Review AI extracted rows or add manual medicine entries.
              </p>
            </div>

            <button
              className="secondary"
              onClick={() =>
                setDraftRows((rows) => [
                  ...rows,
                  emptyRow(),
                ])
              }
              type="button"
            >
              Add row
            </button>
          </div>

          <EditableTable
            rows={draftRows}
            onChange={updateDraft}
            onDelete={(index) =>
              setDraftRows((rows) =>
                rows.filter(
                  (_, rowIndex) =>
                    rowIndex !== index
                )
              )
            }
          />

          <div className="actions">
            <button
              onClick={saveDraftRows}
              type="button"
            >
              Save reviewed rows
            </button>

            <button
              className="secondary"
              onClick={() =>
                setDraftRows([emptyRow()])
              }
              type="button"
            >
              Clear draft
            </button>
          </div>

          {message ? (
            <p className="notice">
              {message}
            </p>
          ) : null}

          {error ? (
            <p className="notice error">
              {error}
            </p>
          ) : null}
        </section>
      </div>

      <section
        className="panel grid"
        style={{
          marginTop: 24,
        }}
      >
        <div className="toolbar">
          <div>
            <h2>
              Saved medicines
            </h2>

            <p className="muted">
              Track safe, near-expiry and expired medicines.
            </p>
          </div>

          <select
            value={filter}
            onChange={(event) =>
              setFilter(
                event.target.value as typeof filter
              )
            }
          >
            <option value="all">
              All
            </option>

            <option value="safe">
              Safe
            </option>

            <option value="near_expiry">
              Near expiry
            </option>

            <option value="expired">
              Expired
            </option>
          </select>
        </div>

        <SavedTable
          rows={visibleMedicines}
          onChange={(changed) =>
            setMedicines((rows) =>
              rows.map((row) =>
                row.id === changed.id
                  ? changed
                  : row
              )
            )
          }
          onSave={updateSaved}
          onDelete={deleteSaved}
        />
      </section>
    </main>
  </div>
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
              <td> <input className="medicine-input" value={row.medicineName} onChange={(event) => onChange( index, "medicineName", event.target.value ) } /> </td>
              <td> <input className="batch-input" value={row.batchNo} onChange={(event) => onChange( index, "batchNo", event.target.value ) } /> </td>
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
                  <input className="medicine-input" value={row.medicineName} onChange={(event) => onChange({ ...row, medicineName: event.target.value }) } />
                </td>
                <td>
                  <input className="batch-input" value={row.batchNo} onChange={(event) => onChange({ ...row, batchNo: event.target.value }) } />
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
                  <div className="table-actions">
                    <button className="compact-btn" onClick={() => onSave(row)} type="button">
                      Save
                    </button>
                    <button className="compact-btn danger" onClick={() => onDelete(row.id)} type="button">
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
