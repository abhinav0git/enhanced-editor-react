import React from 'react';
import { useEditor } from '../context/EditorContext';

const ReleaseButton = () => {
  const { controlledElementPath, releaseControlledElement } = useEditor();

  if (!controlledElementPath) {
    return null;
  }

  return (
    <button onClick={releaseControlledElement} className="release-button">
      Release Element
    </button>
  );
};

export default ReleaseButton;
