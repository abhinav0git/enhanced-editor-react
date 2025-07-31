import React from 'react';
import { useEditor } from '../context/EditorContext';

const Actions = () => {
    const { deleteSelectedElements, duplicateSelectedElements } = useEditor();

    const handleDelete = () => {
        if (window.confirm("Are you sure you want to delete the selected element(s)?")) {
            deleteSelectedElements();
        }
    };

    return (
        <div className="control-block actions-block">
            <h3>Actions</h3>
            <div className="action-buttons">
                {/* bringFront/sendBack will be added with drag mode */}
                <button className="btn btn-secondary" id="bringFrontBtn" disabled>Bring Front</button>
                <button className="btn btn-secondary" id="sendBackBtn" disabled>Send Back</button>
                <button className="btn btn-secondary" id="duplicateBtn" onClick={duplicateSelectedElements}>Duplicate</button>
                <button className="btn btn-danger" id="deleteBtn" onClick={handleDelete}>Delete</button>
            </div>
        </div>
    );
};

export default Actions;
