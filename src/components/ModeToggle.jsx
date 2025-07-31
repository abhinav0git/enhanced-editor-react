import React from 'react';
import { useEditor } from '../context/EditorContext';

const MODES = ['text', 'select', 'drag'];

const ModeToggle = () => {
  const { currentMode, setCurrentMode } = useEditor();

  return (
    <div className="control-block">
      <h3>Edit Mode</h3>
      <div className="mode-toggle">
        {MODES.map(mode => (
          <button
            key={mode}
            className={`mode-btn ${currentMode === mode ? 'active' : ''}`}
            onClick={() => setCurrentMode(mode)}
          >
            {mode}
          </button>
        ))}
      </div>
    </div>
  );
};

export default ModeToggle;