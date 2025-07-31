import React from "react";
import FileUpload from "./FileUpload";
import ModeToggle from "./ModeToggle";
import PropertyEditor from "./PropertyEditor";
import Actions from "./Actions";
import MotionSettings from './MotionSettings'; // Import
import { useEditor } from "../context/EditorContext";

const ControlsPanel = () => {
  const { selectedElementPaths, documentState } = useEditor();
  const hasSelection = selectedElementPaths.length > 0;

  // Download button should only be enabled when a file is loaded
  const downloadDisabled = !documentState.current;

  return (
    <aside className="controls">
      <h1 className="title">VISUAL EDITOR PRO</h1>
      <FileUpload />

      {documentState.current && <ModeToggle />}

      <div className={`selection-info ${!hasSelection ? "hidden" : ""}`}>
        <span id="selectionCount">{selectedElementPaths.length}</span> elements
        selected
      </div>

      <MotionSettings /> {/* Add our new component here */}

      {hasSelection && <PropertyEditor />}
      {hasSelection && <Actions />}

      <div className="control-block instructions">
        <h3>Instructions</h3>
        <ul>
          <li>
            <strong>Text Mode:</strong> Click text to edit directly
          </li>
          <li>
            <strong>Select Mode:</strong> Click to select, <kbd>Ctrl</kbd>+Click
            for multi-select
          </li>
          <li>
            <strong>Drag Mode:</strong> Click to select element, then click
            anywhere to move
          </li>
          <li>
            <strong>Motion:</strong> Watch the cursor arrange elements
            automatically!
          </li>
          <li>
            Press <kbd>Delete</kbd> to remove selected
          </li>
          <li>
            Press <kbd>Esc</kbd> to deselect all
          </li>
        </ul>
      </div>

      <div
        className="control-block download-block"
        style={{ marginTop: "auto" }}
      >
        <button
          id="downloadBtn"
          className="btn btn-secondary"
          disabled={downloadDisabled}
        >
          Download Modified HTML
        </button>
      </div>

      <input type="file" id="imageUploadInput" accept="image/*" hidden />
    </aside>
  );
};

export default ControlsPanel;
