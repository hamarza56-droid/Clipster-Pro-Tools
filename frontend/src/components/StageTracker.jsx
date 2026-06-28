import React from "react";

const STAGES = [
  { key: "uploaded", label: "Uploaded" },
  { key: "logo-checked", label: "Logo check" },
  { key: "processed", label: "Background" },
  { key: "posted", label: "Posted" },
  { key: "submitted", label: "Submitted" },
];

function stageIndex(status) {
  const idx = STAGES.findIndex((s) => s.key === status);
  return idx === -1 ? 0 : idx;
}

export default function StageTracker({ status }) {
  const activeIdx = stageIndex(status);

  return (
    <div style={styles.row}>
      {STAGES.map((stage, i) => {
        const done = i < activeIdx;
        const current = i === activeIdx;
        return (
          <React.Fragment key={stage.key}>
            <div style={styles.nodeWrap}>
              <div
                style={{
                  ...styles.node,
                  ...(done ? styles.nodeDone : {}),
                  ...(current ? styles.nodeCurrent : {}),
                }}
              />
              <span
                style={{
                  ...styles.label,
                  ...(current ? { color: "var(--text)" } : {}),
                }}
              >
                {stage.label}
              </span>
            </div>
            {i < STAGES.length - 1 && (
              <div
                style={{
                  ...styles.connector,
                  ...(i < activeIdx ? styles.connectorDone : {}),
                }}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

const styles = {
  row: {
    display: "flex",
    alignItems: "center",
    gap: "0",
    padding: "6px 0",
  },
  nodeWrap: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "6px",
    minWidth: "64px",
  },
  node: {
    width: "10px",
    height: "10px",
    borderRadius: "50%",
    background: "var(--border-light)",
    border: "2px solid var(--border-light)",
  },
  nodeDone: {
    background: "var(--accent)",
    border: "2px solid var(--accent)",
  },
  nodeCurrent: {
    background: "var(--bg)",
    border: "2px solid var(--pink)",
    boxShadow: "0 0 0 3px rgba(236, 72, 153, 0.2)",
  },
  label: {
    fontSize: "11px",
    color: "var(--text-faint)",
    whiteSpace: "nowrap",
  },
  connector: {
    height: "2px",
    flex: 1,
    background: "var(--border-light)",
    marginBottom: "18px",
    minWidth: "16px",
  },
  connectorDone: {
    background: "var(--accent)",
  },
};
