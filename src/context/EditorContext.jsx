import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';

export const getElementPath = (el) => {
    // THE FIX IS HERE:
    // We now check `nodeType` instead of `instanceof Element`.
    // An element node will always have a nodeType of 1. This works across iframe boundaries.
    if (!el || el.nodeType !== 1) { 
        console.error("[getElementPath] Invalid target received. Not an element node.", el);
        return null;
    }
    
    if (el.tagName === 'BODY' || el.tagName === 'HTML') {
        return 'body';
    }

    const path = [];
    let currentEl = el;

    while (currentEl && currentEl.nodeType === Node.ELEMENT_NODE) {
        let selector = currentEl.nodeName.toLowerCase();

        if (selector === 'body') {
            path.unshift(selector);
            break;
        }

        if (currentEl.id) {
            selector += `#${currentEl.id}`;
            path.unshift(selector);
            break; 
        } else {
            let sib = currentEl;
            let nth = 1;
            while (sib = sib.previousElementSibling) {
                if (sib.nodeName.toLowerCase() === selector) nth++;
            }
            if (nth !== 1) selector += `:nth-of-type(${nth})`;
        }
        path.unshift(selector);
        currentEl = currentEl.parentNode;
    }

    if (path.length === 0) {
        console.warn("[getElementPath] Could not generate a path for element:", el);
        return null;
    }

    return path.join(' > ');
};


const EditorContext = createContext();
export const useEditor = () => useContext(EditorContext);

export const EditorProvider = ({ children }) => {
    const [htmlFile, setHtmlFile] = useState(null);
    const [editorReady, setEditorReady] = useState(false);
    const [currentMode, setCurrentMode] = useState('text');
    const [selectedElementPaths, setSelectedElementPaths] = useState([]);
    const [documentState, setDocumentState] = useState({ original: '', current: '' });
    const [historyState, setHistoryState] = useState({ stack: [], currentIndex: -1 });
    const [controlledElementPath, setControlledElementPath] = useState(null);
    const [motionActive, setMotionActive] = useState(false);
    const [motionSettings, setMotionSettings] = useState({ pattern: 'grid', speed: 5, pause: 2 });
    const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0 });

    const iframeRef = useRef(null);
    const isRestoringHistory = useRef(false);
    const MAX_HISTORY = 50;
    
    const logSetContextMenu = (valueOrFn) => {
        if (typeof valueOrFn === 'function') {
            setContextMenu(prevState => {
                const newState = valueOrFn(prevState);
                console.log("🍔 [CONTEXT] Setting context menu state (using function):", newState);
                return newState;
            });
        } else {
            console.log("🍔 [CONTEXT] Setting context menu state:", valueOrFn);
            setContextMenu(valueOrFn);
        }
    };

    const saveStateToHistory = useCallback(() => {
        if (!editorReady || isRestoringHistory.current) return;
        const iframeDoc = iframeRef.current?.contentDocument;
        if (!iframeDoc) return;
        const clonedDoc = iframeDoc.cloneNode(true);
        clonedDoc.querySelectorAll('.editor-selected, .editor-hover, .editable-text-hover').forEach(el => {
            el.classList.remove('editor-selected', 'editor-hover', 'editable-text-hover');
        });
        const currentState = clonedDoc.documentElement.outerHTML;
        setHistoryState(prevState => {
            if (prevState.stack.length > 0 && prevState.stack[prevState.currentIndex] === currentState) return prevState;
            const newStack = prevState.stack.slice(0, prevState.currentIndex + 1);
            newStack.push(currentState);
            if (newStack.length > MAX_HISTORY) newStack.shift();
            return { stack: newStack, currentIndex: newStack.length - 1 };
        });
    }, [editorReady]);

    const undo = useCallback(() => {
        setHistoryState(prevState => {
            if (prevState.currentIndex > 0) {
                isRestoringHistory.current = true;
                const newIndex = prevState.currentIndex - 1;
                setDocumentState(doc => ({ ...doc, current: prevState.stack[newIndex] }));
                setSelectedElementPaths([]);
                return { ...prevState, currentIndex: newIndex };
            }
            return prevState;
        });
    }, []);
    
    const redo = useCallback(() => {
        setHistoryState(prevState => {
            if (prevState.currentIndex < prevState.stack.length - 1) {
                isRestoringHistory.current = true;
                const newIndex = prevState.currentIndex + 1;
                setDocumentState(doc => ({ ...doc, current: prevState.stack[newIndex] }));
                setSelectedElementPaths([]);
                return { ...prevState, currentIndex: newIndex };
            }
            return prevState;
        });
    }, []);

    const resetToOriginal = useCallback(() => {
        if (window.confirm('Are you sure you want to reset all changes?')) {
            isRestoringHistory.current = true;
            setDocumentState(prev => ({ ...prev, current: prev.original }));
            setHistoryState({ stack: [documentState.original], currentIndex: 0 });
            setSelectedElementPaths([]);
        }
    }, [documentState.original]);

    useEffect(() => {
        if (isRestoringHistory.current) {
            const timer = setTimeout(() => { isRestoringHistory.current = false; }, 100);
            return () => clearTimeout(timer);
        }
    }, [documentState.current]);

    const loadHtmlFile = (file) => {
        if (file && file.type === 'text/html') {
            const reader = new FileReader();
            reader.onload = (e) => {
                const content = e.target.result;
                setDocumentState({ original: content, current: content });
                setHistoryState({ stack: [content], currentIndex: 0 });
                setSelectedElementPaths([]);
                setEditorReady(false);
            };
            reader.readAsText(file);
            setHtmlFile(file);
        }
    };
    
    const deleteSelectedElements = () => {
        if (selectedElementPaths.length === 0) return;
        if (window.confirm(`Delete ${selectedElementPaths.length} element(s)?`)) {
            const iframeDoc = iframeRef.current?.contentDocument;
            if (!iframeDoc) return;
            selectedElementPaths.forEach(path => iframeDoc.querySelector(path)?.remove());
            setSelectedElementPaths([]);
            setTimeout(saveStateToHistory, 0);
        }
    };

    const duplicateSelectedElements = () => {
        if (selectedElementPaths.length !== 1) {
            alert("Please select exactly one element to duplicate.");
            return;
        }
        const iframeDoc = iframeRef.current?.contentDocument;
        if (!iframeDoc) return;
        const el = iframeDoc.querySelector(selectedElementPaths[0]);
        if (el) {
            const clone = el.cloneNode(true);
            clone.classList.remove('editor-selected');
            el.parentNode.insertBefore(clone, el.nextSibling);
            setTimeout(saveStateToHistory, 0);
        }
    };

    const bringToFront = () => {
        const iframeDoc = iframeRef.current?.contentDocument;
        if (!iframeDoc || selectedElementPaths.length === 0) return;
        const allElements = Array.from(iframeDoc.querySelectorAll('body *'));
        const maxZ = allElements.reduce((max, el) => {
            const z = parseInt(window.getComputedStyle(el).zIndex, 10);
            return isNaN(z) ? max : Math.max(max, z);
        }, 0);
        console.log(`🎬 Action: Bring to Front. New z-index will be ${maxZ + 1}`);
        selectedElementPaths.forEach(path => {
            const el = iframeDoc.querySelector(path);
            if (el) el.style.zIndex = maxZ + 1;
        });
        setTimeout(saveStateToHistory, 0);
    };

    const sendToBack = () => {
        const iframeDoc = iframeRef.current?.contentDocument;
        if (!iframeDoc || selectedElementPaths.length === 0) return;
        console.log(`🎬 Action: Send to Back. New z-index will be 0`);
        selectedElementPaths.forEach(path => {
            const el = iframeDoc.querySelector(path);
            if (el) el.style.zIndex = 0;
        });
        setTimeout(saveStateToHistory, 0);
    };

    const updateElementStyle = (property, value) => { 
        const iframeDoc = iframeRef.current?.contentDocument;
        if (!iframeDoc || selectedElementPaths.length === 0) return;
        selectedElementPaths.forEach(path => {
            const el = iframeDoc.querySelector(path);
            if (el) el.style[property] = value;
        });
        setTimeout(saveStateToHistory, 50);
    };
    
    const releaseControlledElement = () => {
        const iframeDoc = iframeRef.current?.contentDocument;
        if (!controlledElementPath || !iframeDoc) return;
        iframeDoc.querySelector(controlledElementPath)?.classList.remove('element-controlled');
        setControlledElementPath(null);
    };

    const value = {
        htmlFile, documentState, loadHtmlFile, editorReady, setEditorReady, currentMode,
        setCurrentMode, selectedElementPaths, setSelectedElementPaths, iframeRef, updateElementStyle,
        saveStateToHistory, deleteSelectedElements, duplicateSelectedElements,
        undo, redo, resetToOriginal,
        historyState,
        motionActive, setMotionActive, motionSettings, setMotionSettings, controlledElementPath, 
        setControlledElementPath, releaseControlledElement,
        contextMenu, 
        setContextMenu: logSetContextMenu,
        bringToFront, sendToBack,
    };

    return (
        <EditorContext.Provider value={value}>
            {children}
        </EditorContext.Provider>
    );
};