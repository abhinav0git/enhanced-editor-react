import React from 'react';
import { useEditor } from '../context/EditorContext';

const MotionSettings = () => {
    const { motionActive, motionSettings, setMotionSettings } = useEditor();

    if (!motionActive) {
        return null;
    }
    
    const handleChange = (e) => {
        const { id, value } = e.target;
        setMotionSettings(prev => ({ ...prev, [id]: value }));
    };

    return (
        <div className="control-block motion-settings active">
            <h3>Motion Settings</h3>
            <div className="behavior-selector">
                <label htmlFor="pattern">Arrangement Pattern:</label>
                <select id="pattern" value={motionSettings.pattern} onChange={handleChange}>
                    <option value="grid">Grid Layout</option>
                    <option value="columns">Column Stacking</option>
                    <option value="diagonal">Diagonal Cascade</option>
                    <option value="circle">Circular Arrangement</option>
                    <option value="random">Random Placement</option>
                </select>
            </div>
            <div className="slider-control">
                <label htmlFor="speed">Movement Speed:</label>
                <input type="range" id="speed" min="1" max="10" value={motionSettings.speed} onChange={handleChange} />
                <div className="slider-value">{motionSettings.speed}</div>
            </div>
            <div className="slider-control">
                <label htmlFor="pause">Pause Duration (sec):</label>
                <input type="range" id="pause" min="0.5" max="5" step="0.5" value={motionSettings.pause} onChange={handleChange} />
                <div className="slider-value">{motionSettings.pause}s</div>
            </div>
        </div>
    );
};

export default MotionSettings;
