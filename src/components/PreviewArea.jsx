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
    [contenteditable="true"] {
        outline: 2px solid #a2a8d3 !important;
        background-color: #0088ff38 !important;
    }
    .editable-text-hover {
        outline: 2px dashed #ffcce4 !important;
        cursor: text !important;
        background-color: rgba(255, 204, 228, 0.1) !important;
    }
    .element-controlled {
        animation: gentle-pulse 3s ease-in-out infinite;
        outline: 3px solid #ff6b6b !important;
        box-shadow: 0 0 20px rgba(255, 107, 107, 0.4);
        cursor: crosshair !important;
    }
    @keyframes gentle-pulse {
        50% { opacity: 0.85; transform: scale(1.02); }
    }
    .element-preview-highlight {
        outline: 4px solid #ff6b6b !important;
        box-shadow: 0 0 20px rgba(255, 107, 107, 0.4);
    }
`;
const excludedTags = ['HTML', 'HEAD', 'BODY', 'SCRIPT', 'STYLE', 'META', 'LINK', 'TITLE'];


const PreviewArea = () => {
    const {
        documentState, setEditorReady, currentMode, selectedElementPaths,
        setSelectedElementPaths, saveStateToHistory,
        controlledElementPath, setControlledElementPath, releaseControlledElement,
        editorReady, // Get the readiness flag from context
        iframeRef // Get the ref from context
    } = useEditor();

    const listenerCleanupRef = useRef(() => {});
    const [pickerState, setPickerState] = useState({ visible: false, elements: [], position: {x: 0, y: 0} });
    
    const htmlContent = documentState.current;

    // --- LISTENER SETUP LOGIC ---

    const setupSelectListeners = useCallback((iframeDoc) => {
        const handleMouseOver = (e) => {
            if (!excludedTags.includes(e.target.tagName)) e.target.classList.add('editor-hover');
        };
        const handleMouseOut = (e) => e.target.classList.remove('editor-hover');
        const handleClick = (e) => {
            e.preventDefault(); e.stopPropagation();
            const target = e.target;
            if (excludedTags.includes(target.tagName) || target.id === 'element-picker-root') return;
            
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
        const textElements = iframeDoc.querySelectorAll('p, h1, h2, h3, h4, h5, h6, span, a, li, th, td, blockquote, label, button, strong, em');
        
        const makeEditable = (e) => {
            e.preventDefault(); e.stopPropagation();
            const el = e.target;
            const originalContent = el.innerHTML;
            el.setAttribute('contenteditable', 'true');
            el.focus();
            
            const onBlur = () => {
                el.removeAttribute('contenteditable');
                if (el.innerHTML !== originalContent) {
                    console.log("📝 Text changed, saving to history.");
                    saveStateToHistory();
                }
                el.removeEventListener('blur', onBlur);
            };
            el.addEventListener('blur', onBlur);
        };
        
        const handleMouseOver = e => {
            if (!e.target.closest('[contenteditable=true]')) e.target.classList.add('editable-text-hover');
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
            if (window.getComputedStyle(controlledEl).position === 'static') {
                controlledEl.style.position = 'relative';
            }
            controlledEl.style.position = 'absolute';
            controlledEl.style.left = `${e.clientX - rect.width / 2}px`;
            controlledEl.style.top = `${e.clientY - rect.height / 2}px`;
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


    // --- EFFECT for Iframe INITIALIZATION on load ---
    useEffect(() => {
        const iframe = iframeRef.current;
        if (!iframe) return;

        const handleLoad = () => {
            const iframeDoc = iframe.contentDocument;
            if (!iframeDoc || !iframeDoc.body) return;
            
            console.log("✅ Iframe has loaded. Editor is now READY.");

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
            
            // This is the "green light". It will trigger the mode-handling effect below.
            setEditorReady(true);
        };
        
        iframe.addEventListener('load', handleLoad);
        return () => {
            iframe.removeEventListener('load', handleLoad);
            // When the iframe is about to be unmounted or reloaded, we are no longer ready.
            setEditorReady(false);
        };
    }, [htmlContent, setEditorReady, iframeRef]); // Re-run when htmlContent changes
    
    // --- EFFECT to Handle MODE Changes (THE FIX IS HERE) ---
    useEffect(() => {
        // GATEKEEPER: Do not run this effect until the iframe is loaded and ready.
        if (!editorReady || !htmlContent) {
            console.log(`🔌 Mode listeners paused. EditorReady: ${editorReady}`);
            return;
        }

        const iframeDoc = iframeRef.current?.contentDocument;
        if (!iframeDoc || !iframeDoc.body) return;
        
        console.log(`🔌 Setting up listeners for "${currentMode}" mode.`);
        
        releaseControlledElement();
        setSelectedElementPaths([]);

        // Cleanup any listeners from the previous mode.
        listenerCleanupRef.current();

        // Attach new listeners based on the current mode.
        if (currentMode === 'text') listenerCleanupRef.current = setupTextListeners(iframeDoc);
        else if (currentMode === 'select') listenerCleanupRef.current = setupSelectListeners(iframeDoc);
        else if (currentMode === 'drag') listenerCleanupRef.current = setupDragListeners(iframeDoc);
        
    // **** THE FIX ****
    // The dependency array is now stable. It only re-runs when the *data* (mode, content, readiness) changes.
    }, [currentMode, htmlContent, editorReady]);

    
    // --- Other Effects (Visuals) ---
    useEffect(() => {
        if (!editorReady) return;
        const iframeDoc = iframeRef.current?.contentDocument;
        if (!iframeDoc) return;
        iframeDoc.querySelectorAll('.editor-selected').forEach(el => el.classList.remove('editor-selected'));
        selectedElementPaths.forEach(path => {
            const el = iframeDoc.querySelector(path);
            if (el) el.classList.add('editor-selected');
        });
    }, [selectedElementPaths, htmlContent, editorReady, iframeRef]);
    
    useEffect(() => {
        if (!editorReady) return;
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
    }, [pickerState, setControlledElementPath, editorReady, iframeRef]);
    
    useEffect(() => {
        if (!editorReady) return;
        const iframeDoc = iframeRef.current?.contentDocument;
        if (!iframeDoc) return;
        iframeDoc.querySelectorAll('.element-controlled').forEach(el => el.classList.remove('element-controlled'));
        if(controlledElementPath) {
            const el = iframeDoc.querySelector(controlledElementPath);
            el?.classList.add('element-controlled');
        }
    }, [controlledElementPath, htmlContent, editorReady, iframeRef]);

    return (
        <main className="preview-area">
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
