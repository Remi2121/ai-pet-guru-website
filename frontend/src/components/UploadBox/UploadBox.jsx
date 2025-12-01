// src/components/UploadBox/UploadBox.jsx
import React, { useRef, useState } from "react";

/**
 * UploadBox
 * Props:
 *  - label: string (button/placeholder text)
 *  - accept: string (e.g. "image/*")
 *  - maxSizeMB: number (default 5)
 *  - onBase64: function(dataUrl: string, file: File) -> void
 *  - disabled: boolean
 */
export default function UploadBox({
  label = "Upload image",
  accept = "image/*",
  maxSizeMB = 5,
  onBase64 = () => {},
  disabled = false,
}) {
  const inputRef = useRef(null);
  const [dragActive, setDragActive] = useState(false);
  const [preview, setPreview] = useState(null); // data URL
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");

  const reset = () => {
    setPreview(null);
    setFileName("");
    setError("");
    if (inputRef.current) inputRef.current.value = "";
    onBase64(null, null);
  };

  const readFileAsDataUrl = (file) =>
    new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.onerror = (e) => reject(e);
      fr.readAsDataURL(file);
    });

  // validateFile used directly inside handleFile (no useCallback) — keeps linter happy
  const validateFile = (file) => {
    if (!file) return "No file selected.";
    if (accept && accept !== "*" && !file.type.match(accept.replace("*", ".*"))) {
      return "Unsupported file type.";
    }
    const maxBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxBytes) {
      return `File too large (max ${maxSizeMB} MB).`;
    }
    return "";
  };

  // NOTE: Not memoized on purpose — avoids dependency mismatch warnings
  const handleFile = async (file) => {
    setError("");
    if (!file) return;
    const v = validateFile(file);
    if (v) {
      setError(v);
      return;
    }
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setPreview(dataUrl);
      setFileName(file.name || "");
      // Send the full data URL (data:image/..;base64,..) — Disease.jsx expects that
      onBase64(dataUrl, file);
    } catch (e) {
      console.error(e);
      setError("Failed to read file.");
    }
  };

  const onInputChange = (e) => {
    const file = e.target.files?.[0];
    handleFile(file);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    handleFile(file);
  };

  const onDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setDragActive(true);
  };

  const onDragLeave = (e) => {
    e.preventDefault();
    setDragActive(false);
  };

  return (
    <div>
      <div
        className={`w-full rounded-lg border-2 transition group ${
          dragActive ? "border-dashed border-purple-400 bg-purple-50/30" : "border-dashed border-slate-200 bg-white"
        }`}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
      >
        <label className="block w-full p-4 cursor-pointer">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              {preview ? (
                <div className="flex items-center gap-3">
                  <img
                    src={preview}
                    alt={fileName || "preview"}
                    className="w-20 h-20 object-cover rounded-md border"
                  />
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-slate-700">{fileName}</span>
                    <span className="text-xs text-slate-500">Click to replace</span>
                  </div>
                </div>
              ) : (
                <div className="text-center text-sm text-slate-500">
                  <div className="mb-2 font-medium text-slate-700">{label}</div>
                  <div className="text-xs">Drag & drop here, or click to choose file</div>
                </div>
              )}
            </div>

            <div className="shrink-0">
              <button
                type="button"
                onClick={(ev) => {
                  ev.preventDefault();
                  if (inputRef.current) inputRef.current.click();
                }}
                disabled={disabled}
                className="px-3 py-2 rounded-md bg-white border text-sm shadow-sm hover:bg-slate-50"
              >
                Choose
              </button>
            </div>
          </div>

          {/* hidden file input */}
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            className="sr-only"
            onChange={onInputChange}
            disabled={disabled}
          />
        </label>
      </div>

      <div className="mt-2 flex items-center justify-between">
        <div className="text-xs text-slate-500">
          {error ? <span className="text-red-600">{error}</span> : <span>Max {maxSizeMB} MB · {accept}</span>}
        </div>

        <div className="flex items-center gap-2">
          {preview && (
            <button
              type="button"
              onClick={() => reset()}
              className="px-3 py-1.5 rounded-md border text-sm text-slate-700 bg-white hover:bg-slate-50"
            >
              Remove
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
