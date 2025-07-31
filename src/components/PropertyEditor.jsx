import React, { useState, useEffect } from 'react';
import { useEditor } from '../context/EditorContext';

const propertyConfig = [
  { label: 'Width', property: 'width', type: 'text' },
  { label: 'Height', property: 'height', type: 'text' },
  { label: 'Margin', property: 'margin', type: 'text' },
  { label: 'Padding', property: 'padding', type: 'text' },
  { label: 'BG Color', property: 'backgroundColor', type: 'color' },
  { label: 'Text Color', property: 'color', type: 'color' },
  { label: 'Font Size', property: 'fontSize', type: 'text' },
  { label: 'Z-Index', property: 'zIndex', type: 'text' },
];

const rgbToHex = (rgb) => {
    if (!rgb || rgb.startsWith('#')) return rgb;
    if (rgb === 'transparent' || rgb.includes('rgba(0, 0, 0, 0)')) return '#ffffff';
    const result = rgb.match(/\d+/g);
    if (!result || result.length < 3) return '#000000';
    return `#${result.map(c => parseInt(c).toString(16).padStart(2, '0')).join('')}`;
};

const PropertyField = ({ config, value, onStyleChange }) => {
  const [currentValue, setCurrentValue] = useState(value);

  useEffect(() => {
    setCurrentValue(config.type === 'color' ? rgbToHex(value) : value);
  }, [value, config.type]);
  
  const handleInputChange = (e) => {
    setCurrentValue(e.target.value);
    onStyleChange(config.property, e.target.value);
  };

  if (config.type === 'color') {
    return (
      <div className="property-row">
        <label className="property-label">{config.label}:</label>
        <div className="color-input-wrapper">
          <input 
            type="color" 
            className="color-preview"
            value={currentValue}
            onChange={handleInputChange}
            style={{padding: 0, border: 'none', width: '30px', height: '30px'}}
          />
          <input 
            type="text" 
            className="color-value" 
            value={currentValue}
            onChange={handleInputChange}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="property-row">
      <label className="property-label">{config.label}:</label>
      <input
        type="text"
        className="property-input"
        value={currentValue}
        onChange={handleInputChange}
      />
    </div>
  );
};


const PropertyEditor = () => {
    const { iframeRef, selectedElementPaths, updateElementStyle } = useEditor();
    const [elementStyles, setElementStyles] = useState({});

    useEffect(() => {
        const iframeDoc = iframeRef.current?.contentDocument;
        if (!iframeDoc || selectedElementPaths.length !== 1) {
            setElementStyles({});
            return;
        }

        const el = iframeDoc.querySelector(selectedElementPaths[0]);
        if (el) {
            const computedStyle = window.getComputedStyle(el);
            const styles = {};
            propertyConfig.forEach(config => {
                styles[config.property] = computedStyle[config.property];
            });
            setElementStyles(styles);
        }
    }, [selectedElementPaths, iframeRef]);
    
    // We only show the property editor for single selections for simplicity
    if (selectedElementPaths.length !== 1) {
      return null;
    }

    return (
        <div className="control-block property-editor-block">
            <h3>Properties</h3>
            <div className="property-editor">
                {propertyConfig.map(config => (
                    <PropertyField
                        key={config.property}
                        config={config}
                        value={elementStyles[config.property] || ''}
                        onStyleChange={updateElementStyle}
                    />
                ))}
            </div>
        </div>
    );
};

export default PropertyEditor;
