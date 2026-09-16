'use client';

import { useState, useRef, type DragEvent } from 'react';

interface FileUploadProps {
  onFileSelect: (file: File | null) => void;
  accept?: string;
  currentFileName?: string | null;
  maxSizeMB?: number;
}

export default function FileUpload({
  onFileSelect,
  accept = '.ppt,.pptx',
  currentFileName,
  maxSizeMB = 50,
}: FileUploadProps) {
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(currentFileName ?? null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File | null) => {
    if (!file) return;
    const maxSize = maxSizeMB * 1024 * 1024;
    if (file.size > maxSize) {
      setError(`File too large. Max ${maxSizeMB}MB.`);
      return;
    }
    setError(null);
    setFileName(file.name);
    onFileSelect(file);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    handleFile(file);
  };

  return (
    <div className="file-upload">
      <div
        className={dragging ? 'drop-zone active' : 'drop-zone'}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        {fileName ? (
          <div className="file-selected">
            <span className="file-icon">📄</span>
            <span className="file-name">{fileName}</span>
            <span className="file-change">Click to change</span>
          </div>
        ) : (
          <div className="file-prompt">
            <span className="upload-icon">⬆</span>
            <span>Drop your file here or click to browse</span>
            <span className="file-hint">Accepted: {accept} · Max {maxSizeMB}MB</span>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="file-input"
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
        />
      </div>
      {error && <span className="form-error">{error}</span>}
    </div>
  );
}
