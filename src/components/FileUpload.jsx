import React, { useRef } from 'react';
import { useEditor } from '../context/EditorContext';

const FileUpload = () => {
  const { loadHtmlFile, htmlFile } = useEditor();
  const fileInputRef = useRef(null);

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      loadHtmlFile(file);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current.click();
  };

  return (
    <div className="control-block file-upload-block">
      <button onClick={handleUploadClick} className="btn btn-primary">
        Upload HTML
      </button>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".html, .htm"
        hidden
      />
      <span className="file-name-display">
        {htmlFile ? htmlFile.name : 'No file selected.'}
      </span>
    </div>
  );
};

export default FileUpload;