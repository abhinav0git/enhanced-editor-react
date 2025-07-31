import React, { useEffect, useCallback, useRef, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { useEditor, getElementPath } from '../context/EditorContext';
import HistoryControls from './HistoryControls';
import ReleaseButton from './ReleaseButton';
import ElementPicker from './ElementPicker';

// All the interaction styles are defined here.
const editorStyles = `
    .editor-selected {
        outline: 3px solid #c3b3ff !important;
        outline-offset: 2px;
        position: relative;
    }
    
    .editor-hover {
        outline: 2px dashed #ffcce4 !important;
        cursor: pointer !important;
    }
    
    .editor-draggable {
        cursor: move !important;
    }
    
    .editor-draggable:hover {
        outline: 2px dashed #ffd4a3 !important;
    }
    
    .editor-dragging {
        opacity: 0.5 !important;
        cursor: grabbing !important;
        z-index: 9999 !important;
    }
    
    .editable-text-hover {
        outline: 2px dashed #ffcce4 !important;
        cursor: text !important;
        background-color: rgba(255, 204, 228, 0.1) !important;
    }
    
    .editable-image-hover {
        outline: 3px dashed #d4f0df !important;
        cursor: pointer !important;
        opacity: 0.9 !important;
    }
    
    [contenteditable="true"] {
        outline: 2px solid #a2a8d3 !important;
        background-color: #0088ff38 !important;
        box-shadow: 0 0 5px rgba(162, 168, 211, 0.5);
    }
    
    * {
        user-select: none;
        -webkit-user-select: none;
    }
    
    [contenteditable="true"],
    [contenteditable="true"] * {
        user-select: text;
        -webkit-user-select: text;
    }
    
    /* Controlled element styles */
    .element-controlled {
        animation: gentle-pulse 3s ease-in-out infinite;
        outline: 3px solid #ff6b6b !important;
        outline-offset: 3px;
        box-shadow: 0 0 20px rgba(255, 107, 107, 0.4);
        cursor: crosshair !important;
        z-index: 9998 !important;
    }
    
    @keyframes gentle-pulse {
        0%, 100% {
            opacity: 1;
            transform: scale(1);
        }
        50% {
            opacity: 0.85;
            transform: scale(1.02);
        }
    }
    
    /* Motion Mode Styles */
    .motion-physics {
        transition: none !important;
    }
    
    .motion-cursor {
        position: fixed;
        width: 40px;
        height: 40px;
        background: radial-gradient(circle, #ff6b6b 0%, #ff6b6b 30%, transparent 70%);
        border-radius: 50%;
        pointer-events: none;
        z-index: 10000;
        box-shadow: 0 0 20px rgba(255, 107, 107, 0.6);
        transition: all 0.3s ease;
    }
    
    .motion-cursor.grabbing {
        transform: scale(1.2);
        background: radial-gradient(circle, #c3b3ff 0%, #c3b3ff 40%, transparent 70%);
        box-shadow: 0 0 30px rgba(195, 179, 255, 0.8);
    }
    
    .element-grabbed {
        filter: brightness(1.3) drop-shadow(0 0 20px rgba(255, 204, 228, 0.8));
        z-index: 9999 !important;
        transition: all 0.3s ease;
    }
    
    .element-target {
        outline: 3px dashed #ffcce4 !important;
        outline-offset: 5px;
    }

    .element-preview-highlight {
        outline: 4px solid #ff6b6b !important;
        outline-offset: 3px;
        box-shadow: 0 0 20px rgba(255, 107, 107, 0.4);
        transition: all 0.2s ease;
    }
`;
const excludedTags = ['HTML', 'HEAD', 'BODY', 'SCRIPT', 'STYLE', 'META', 'LINK', 'TITLE'];


const PreviewArea = () => {
    // --- CONTEXT & STATE ---
    const {
        documentState, setEditorReady, currentMode, selectedElementPaths,
        setSelectedElementPaths, saveStateToHistory, motionActive, setMotionActive,
        controlledElementPath, setControlledElementPath, releaseControlledElement
    } = useEditor();

    const iframeRef = useRef(null);
    const listenerCleanupRef = useRef(() => {});
    const [pickerState, setPickerState] = useState({ visible: false, elements: [], position: {x: 0, y: 0} });
    
    const htmlContent = documentState.current;

    // --- LISTENER SETUP LOGIC (as useCallback hooks) ---

    const setupSelectListeners = useCallback((iframeDoc) => {
        const handleMouseOver = (e) => {
            if (!excludedTags.includes(e.target.tagName)) {
                e.target.classList.add('editor-hover');
            }
        };
        const handleMouseOut = (e) => e.target.classList.remove('editor-hover');
        const handleClick = (e) => {
            e.preventDefault(); e.stopPropagation();
            const target = e.target;
            if (excludedTags.includes(target.tagName) || target.id === 'element-picker-root') return;
            target.classList.remove('editor-hover');
            const path = getElementPath(target);
            if (!path) return;
            
            if (e.ctrlKey || e.metaKey) {
                setSelectedElementPaths(prev => prev.includes(path) ? prev.filter(p => p !== path) : [...prev, path]);
            } else {
                setSelectedElementPaths([path]);
            }
        };
        iframeDoc.body.addEventListener('mouseover', handleMouseOver);
        iframeDoc.body.addEventListener('mouseout', handleMouseOut);
        iframeDoc.body.addEventListener('click', handleClick);
        return () => {
            iframeDoc.body.removeEventListener('mouseover', handleMouseOver);
            iframeDoc.body.removeEventListener('mouseout', handleMouseOut);
            iframeDoc.body.removeEventListener('click', handleClick);
        };
    }, [setSelectedElementPaths]);

    const setupTextListeners = useCallback((iframeDoc) => {
        console.log("Setting up text listeners");
        const textElements = iframeDoc.querySelectorAll('p, h1, h2, h3, h4, h5, h6, span, a, li, th, td, blockquote, label, button, strong, em');
        
        const makeEditable = (e) => {
            e.preventDefault(); e.stopPropagation();
            const el = e.target;
            const originalContent = el.innerHTML;
            el.setAttribute('contenteditable', 'true');
            el.focus();
            
            const onBlur = () => {
                el.removeAttribute('contenteditable');
                el.classList.remove('editable-text-hover');
                if (el.innerHTML !== originalContent) saveStateToHistory();
                el.removeEventListener('blur', onBlur);
            };
            el.addEventListener('blur', onBlur);
        };
        
        const handleMouseOver = e => {
            if (e.target.closest('[contenteditable=true]')) return;
            if (!excludedTags.includes(e.target.tagName)) {
                 e.target.classList.add('editable-text-hover');
            }
        };
        const handleMouseOut = e => e.target.classList.remove('editable-text-hover');

        textElements.forEach(el => {
            el.addEventListener('click', makeEditable);
            el.addEventListener('mouseover', handleMouseOver);
            el.addEventListener('mouseout', handleMouseOut);
        });

        return () => {
            textElements.forEach(el => {
                el.removeEventListener('click', makeEditable);
                el.removeEventListener('mouseover', handleMouseOver);
                el.removeEventListener('mouseout', handleMouseOut);
                el.removeAttribute('contenteditable');
                el.classList.remove('editable-text-hover');
            });
        };
    }, [saveStateToHistory]);

    const setupDragListeners = useCallback((iframeDoc) => {
        const draggableElements = iframeDoc.querySelectorAll('div,p,h1,h2,h3,h4,h5,h6,section,article,header,footer,img,ul,table,figure');
        draggableElements.forEach(el => el.classList.add('editor-draggable'));
        const getElementsAtPoint = (x, y) => (iframeDoc.elementsFromPoint(x, y) || []).filter(el => !excludedTags.includes(el.tagName)).map(el => ({ el, path: getElementPath(el) }));
        const handleElementMove = (e) => {
            e.preventDefault(); e.stopPropagation();
            const controlledEl = iframeDoc.querySelector(controlledElementPath);
            if (!controlledEl) return;
            const rect = controlledEl.getBoundingClientRect();
            let newX = e.clientX - rect.width / 2;
            let newY = e.clientY - rect.height / 2;
            if (window.getComputedStyle(controlledEl).position === 'static') {
                controlledEl.style.position = 'relative';
            }
            controlledEl.style.position = 'absolute';
            controlledEl.style.left = `${newX}px`;
            controlledEl.style.top = `${newY}px`;
        };
        const handleDragClick = (e) => {
            e.preventDefault(); e.stopPropagation();
            if(e.target.id === 'element-picker-root' || e.target.closest('.element-picker-popup')) return;

            if (controlledElementPath) {
                handleElementMove(e);
                saveStateToHistory();
                return;
            }
            const elements = getElementsAtPoint(e.clientX, e.clientY);
            if (elements.length === 0) return;
            if (elements.length === 1) {
                setControlledElementPath(elements[0].path);
            } else {
                setPickerState({ visible: true, elements, position: { x: e.clientX, y: e.clientY } });
            }
        };
        iframeDoc.body.addEventListener('click', handleDragClick);
        return () => {
            iframeDoc.body.removeEventListener('click', handleDragClick);
            draggableElements.forEach(el => el.classList.remove('editor-draggable'));
        };
    }, [controlledElementPath, saveStateToHistory, setControlledElementPath]);


    // --- EFFECT to Handle MODE Changes ---
    useEffect(() => {
        const iframeDoc = iframeRef.current?.contentDocument;
        if (!iframeDoc || !iframeDoc.body || !htmlContent) return;
        
        releaseControlledElement();
        setSelectedElementPaths([]);

        listenerCleanupRef.current();

        if (currentMode === 'text') listenerCleanupRef.current = setupTextListeners(iframeDoc);
        else if (currentMode === 'select') listenerCleanupRef.current = setupSelectListeners(iframeDoc);
        else if (currentMode === 'drag') listenerCleanupRef.current = setupDragListeners(iframeDoc);
        
    }, [currentMode, htmlContent]); // Depend on htmlContent to re-trigger when file changes


    // --- EFFECT for Iframe INITIALIZATION on load ---
    useEffect(() => {
        const iframe = iframeRef.current;
        if (!iframe) return;

        const handleLoad = () => {
            const iframeDoc = iframe.contentDocument;
            if (!iframeDoc || !iframeDoc.body) return;

            listenerCleanupRef.current(); // Cleanup from any previous state

            // Initial setup
            if (!iframeDoc.getElementById('editor-styles')) {
                const styleTag = iframeDoc.createElement('style');
                styleTag.id = 'editor-styles';
                styleTag.innerHTML = editorStyles;
                iframeDoc.head.appendChild(styleTag);
            }
            if (!iframeDoc.getElementById('element-picker-root')) {
                const pickerRootEl = iframeDoc.createElement('div');
                pickerRootEl.id = 'element-picker-root';
                iframeDoc.body.appendChild(pickerRootEl);
            }
            
            // Setup listeners for the initial/current mode
            if (currentMode === 'text') listenerCleanupRef.current = setupTextListeners(iframeDoc);
            else if (currentMode === 'select') listenerCleanupRef.current = setupSelectListeners(iframeDoc);
            else if (currentMode === 'drag') listenerCleanupRef.current = setupDragListeners(iframeDoc);
            
            setEditorReady(true);
        };
        
        iframe.addEventListener('load', handleLoad);
        return () => iframe.removeEventListener('load', handleLoad);
    }, [setupTextListeners, setupSelectListeners, setupDragListeners, setEditorReady, currentMode]); // Add currentMode here
    
    
    // --- Other Effects (Visuals) ---
    useEffect(() => {
        const iframeDoc = iframeRef.current?.contentDocument;
        if (!iframeDoc) return;
        iframeDoc.querySelectorAll('.editor-selected').forEach(el => el.classList.remove('editor-selected'));
        selectedElementPaths.forEach(path => {
            const el = iframeDoc.querySelector(path);
            if (el) el.classList.add('editor-selected');
        });
    }, [selectedElementPaths, htmlContent]);
    
    useEffect(() => {
        const iframeDoc = iframeRef.current?.contentDocument;
        if (!iframeDoc) return;
        const pickerRootEl = iframeDoc.getElementById('element-picker-root');
        if(!pickerRootEl) return;
        const root = ReactDOM.createRoot(pickerRootEl);
        
        const handleSelect = (el) => {
            setControlledElementPath(getElementPath(el));
            setPickerState({ visible: false, elements: [], position: { x:0, y:0 }});
        };
        const handleHover = (el) => el.classList.add('element-preview-highlight');
        const handleLeave = () => iframeDoc.querySelectorAll('.element-preview-highlight').forEach(el => el.classList.remove('element-preview-highlight'));

        root.render(<ElementPicker elements={pickerState.elements} position={pickerState.position} onSelect={handleSelect} onHover={handleHover} onMouseLeave={handleLeave}/>);

        const handleClickOutside = (e) => {
            if (!pickerRootEl.contains(e.target)) {
                setPickerState(p => ({...p, visible: false}));
            }
        };

        if (pickerState.visible) {
            setTimeout(() => iframeDoc.addEventListener('click', handleClickOutside, { once: true }), 10);
        }
    }, [pickerState, setControlledElementPath]);
    
    useEffect(() => {
        const iframeDoc = iframeRef.current?.contentDocument;
        if (!iframeDoc) return;
        iframeDoc.querySelectorAll('.element-controlled').forEach(el => el.classList.remove('element-controlled'));
        if(controlledElementPath) {
            const el = iframeDoc.querySelector(controlledElementPath);
            el?.classList.add('element-controlled');
        }
    }, [controlledElementPath, htmlContent]);
    
    useEffect(() => {
      if(motionActive) alert("Motion feature animation is stubbed.");
    }, [motionActive]);

    // --- RENDER ---
    return (
        <main className="preview-area">
            {htmlContent && (
              <button 
                  id="motionBtn"
                  className={`motion-button ${motionActive ? 'active' : ''}`}
                  onClick={() => setMotionActive(p => !p)}
              >
                  MOTION
              </button>
            )} 
            
            <HistoryControls />
            <ReleaseButton />

            <div className="preview-wrapper">
                <iframe
                    ref={iframeRef}
                    id="previewFrame"
                    sandbox="allow-same-origin allow-scripts"
                    title="HTML Preview"
                    srcDoc={htmlContent || '<!DOCTYPE html>'}
                />
                {!htmlContent && (
                    <div id="placeholder" className="placeholder-text">
                        Upload an HTML file to start editing.
                    </div>
                )}
            </div>
        </main>
    );
};

export default PreviewArea;