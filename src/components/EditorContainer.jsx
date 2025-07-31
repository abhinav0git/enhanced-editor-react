import React from 'react';
import ControlsPanel from './ControlsPanel';
import PreviewArea from './PreviewArea';

const EditorContainer = () => {
  return (
    <div className="editor-container">
      <ControlsPanel />
      <PreviewArea />
    </div>
  );
};

export default EditorContainer;