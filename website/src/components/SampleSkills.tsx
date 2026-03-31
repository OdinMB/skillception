import { useState, useEffect } from "react";
import { getSamples, getCached } from "../lib/preloadSamples";
import type { Sample } from "../lib/preloadSamples";

export default function SampleSkills() {
  const [open, setOpen] = useState(false);
  const [samples, setSamples] = useState<Sample[] | null>(getCached());
  const [tab, setTab] = useState(0);
  const [copiedTab, setCopiedTab] = useState<number | null>(null);

  useEffect(() => {
    if (samples) return;
    getSamples().then(setSamples);
  }, [samples]);

  const active = samples?.[tab];
  const copied = copiedTab === tab;

  return (
    <>
      <div
        className="run-detail"
        style={{ cursor: "pointer", marginTop: "24px" }}
      >
        <div
          className="run-header"
          onClick={() => setOpen(!open)}
          style={{ justifyContent: "center", gap: "8px" }}
        >
          <span style={{ color: "var(--color-footnote)" }}>
            {open ? "Collapse" : "Expand"} sample SKILL.md files
          </span>
          <span style={{ fontSize: "10px", color: "var(--color-caption)" }}>
            {open ? "\u25BC" : "\u25B6"}
          </span>
        </div>
      </div>

      {open && (
        <>
          {!samples ? (
            <p
              style={{
                textAlign: "center",
                color: "var(--color-footnote)",
                fontStyle: "italic",
              }}
            >
              Loading&hellip;
            </p>
          ) : (
            <>
              <div className="model-tabs">
                {samples.map((s, i) => (
                  <button
                    key={s.model}
                    className={`model-tab ${i === tab ? "active" : ""}`}
                    onClick={() => {
                      setTab(i);
                      setCopiedTab(null);
                    }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              {active && (
                <div style={{ marginTop: "16px" }}>
                  <p
                    style={{
                      fontSize: "14px",
                      color: "var(--color-footnote)",
                      fontStyle: "italic",
                      marginBottom: "12px",
                    }}
                  >
                    {active.description}
                  </p>
                  <div style={{ position: "relative" }}>
                    <button
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(active.content);
                          setCopiedTab(tab);
                          const capturedTab = tab;
                          setTimeout(
                            () =>
                              setCopiedTab((prev) =>
                                prev === capturedTab ? null : prev,
                              ),
                            2000,
                          );
                        } catch {
                          // clipboard unavailable (non-HTTPS, permissions denied)
                        }
                      }}
                      style={{
                        position: "absolute",
                        top: "8px",
                        right: "8px",
                        padding: "4px 10px",
                        fontSize: "12px",
                        fontFamily: "var(--font-sans)",
                        background: "var(--color-paper)",
                        border: "1px solid var(--color-rule)",
                        cursor: "pointer",
                        color: "var(--color-footnote)",
                      }}
                    >
                      {copied ? "Copied" : "Copy"}
                    </button>
                    <pre
                      style={{
                        background: "var(--color-aged)",
                        border: "1px solid var(--color-rule)",
                        padding: "16px",
                        paddingRight: "80px",
                        overflow: "auto",
                        fontSize: "13px",
                        lineHeight: "1.5",
                        fontFamily:
                          "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                        whiteSpace: "pre-wrap",
                        wordWrap: "break-word",
                        maxHeight: "600px",
                      }}
                    >
                      {active.content}
                    </pre>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </>
  );
}
