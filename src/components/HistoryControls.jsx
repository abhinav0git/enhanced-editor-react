import React from 'react';
import { useEditor } from '../context/EditorContext';

const HistoryControls = () => {
    const { 
        documentState, 
        historyState, // Use the new state object
        undo, 
        redo, 
        resetToOriginal 
    } = useEditor();

    if (!documentState.current) {
        return null;
    }

    // Update conditions to use the new state structure
    const canUndo = historyState.currentIndex > 0;
    const canRedo = historyState.currentIndex < historyState.stack.length - 1;

    return (
        <div className="history-controls visible">
            <button className="history-btn" onClick={resetToOriginal} title="Reset to original">
                Reset
            </button>
            <button className="history-btn" onClick={undo} title="Step back" disabled={!canUndo}>
                Undo
            </button>
            <button className="history-btn" onClick={redo} title="Step forward" disabled={!canRedo}>
                Redo
            </button>
        </div>
    );
};

export default HistoryControls;
