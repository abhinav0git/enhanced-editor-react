import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';

export const getElementPath = (el) => {
    if (!(el instanceof Element)) return;
    const path = [];
    while (el.nodeType === Node.ELEMENT_NODE) {
        let selector = el.nodeName.toLowerCase();
        if (el.id) {
            selector += `#${el.id}`;
            path.unshift(selector);
            break; // IDs are unique, no need to go further
        } else {
            let sib = el;
            let nth = 1;
            while (sib = sib.previousElementSibling) {
                if (sib.nodeName.toLowerCase() === selector) nth++;
            }
            if (nth !== 1) selector += `:nth-of-type(${nth})`;
        }
        path.unshift(selector);
        el = el.parentNode;
    }
    return path.join(' > ');
};

const EditorContext = createContext();
export const useEditor = () => useContext(EditorContext);

export const EditorProvider = ({ children }) => {
    // --- All other state is fine ---
    const [htmlFile, setHtmlFile] = useState(null);
    const [editorReady, setEditorReady] = useState(false);
    const [currentMode, setCurrentMode] = useState('text');
    const [selectedElementPaths, setSelectedElementPaths] = useState([]);
    const iframeRef = useRef(null);
    const [documentState, setDocumentState] = useState({ original: '', current: '' });
    // --- (motion state is fine too) ---
    const [motionActive, setMotionActive] = useState(false);
    const [motionSettings, setMotionSettings] = useState({ pattern: 'grid', speed: 5, pause: 2 });
    const [controlledElementPath, setControlledElementPath] = useState(null);
    const isRestoringHistory = useRef(false);
    const MAX_HISTORY = 50;
    
    // --- REFACTORED HISTORY STATE ---
    // We combine the stack and index into one state object.
    const [historyState, setHistoryState] = useState({
        stack: [],
        currentIndex: -1,
    });
    
    // --- REFACTORED HISTORY FUNCTIONS ---
    // This is now immune to stale closures because it uses a functional update.
    const saveStateToHistory = useCallback(() => {
        if (isRestoringHistory.current) return;
        const iframeDoc = iframeRef.current?.contentDocument;
        if (!iframeDoc) return;
    
        const clonedDoc = iframeDoc.cloneNode(true);
        clonedDoc.querySelectorAll('.editor-selected, .editor-hover, .editable-text-hover').forEach(el => {
            el.classList.remove('editor-selected', 'editor-hover', 'editable-text-hover');
        });
        const currentState = clonedDoc.documentElement.outerHTML;
    
        setHistoryState(prevState => {
            const { stack, currentIndex } = prevState;
            
            // Prevent saving identical states based on the *current* state.
            if (stack.length > 0 && stack[currentIndex] === currentState) {
                return prevState; // No change needed
            }
            
            // Slice history correctly from the current position
            const newStack = stack.slice(0, currentIndex + 1);
            newStack.push(currentState);
            
            if (newStack.length > MAX_HISTORY) {
                newStack.shift();
            }
    
            // Return the new, complete state object
            return {
                stack: newStack,
                currentIndex: newStack.length - 1,
            };
        });
    }, []); // Empty dependency array makes this function stable!

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
        if(window.confirm('Are you sure you want to reset all changes?')) {
            isRestoringHistory.current = true;
            setDocumentState(prev => ({...prev, current: prev.original}));
            setHistoryState({ stack: [documentState.original], currentIndex: 0 });
            setSelectedElementPaths([]);
        }
    }, [documentState.original]);


    const loadHtmlFile = (file) => {
        if (file && file.type === 'text/html') {
            const reader = new FileReader();
            reader.onload = (e) => {
                const content = e.target.result;
                setDocumentState({ original: content, current: content });
                // Reset history on new file load
                setHistoryState({ stack: [content], currentIndex: 0 });
                setSelectedElementPaths([]);
            };
            reader.readAsText(file);
            setHtmlFile(file);
        }
    };
    
    // ... all other functions (delete, duplicate, release, etc.) are fine ...
    const updateElementStyle = (property, value) => { 
      const iframeDoc = iframeRef.current?.contentDocument;
      if (!iframeDoc || selectedElementPaths.length === 0) return;

      selectedElementPaths.forEach(path => {
        const el = iframeDoc.querySelector(path);
        if (el) {
          el.style[property] = value;
        }
      });
    };
    
    const deleteSelectedElements = () => {
        const iframeDoc = iframeRef.current?.contentDocument;
        if (!iframeDoc || selectedElementPaths.length === 0) return;
        
        selectedElementPaths.forEach(path => {
            const el = iframeDoc.querySelector(path);
            el?.remove();
        });
        
        setSelectedElementPaths([]);
        // Important: Wait for the DOM to update, then save history
        setTimeout(saveStateToHistory, 0); 
    };

    const duplicateSelectedElements = () => {
      const iframeDoc = iframeRef.current?.contentDocument;
      if (!iframeDoc || selectedElementPaths.length !== 1) {
        alert("Please select exactly one element to duplicate.");
        return;
      }

      const path = selectedElementPaths[0];
      const el = iframeDoc.querySelector(path);
      if (el) {
          const clone = el.cloneNode(true);
          clone.classList.remove('editor-selected');
          el.parentNode.insertBefore(clone, el.nextSibling);
          setTimeout(saveStateToHistory, 0);
      }
    };
    
    const releaseControlledElement = () => {
        const iframeDoc = iframeRef.current?.contentDocument;
        if (!controlledElementPath || !iframeDoc) return;
        
        const el = iframeDoc.querySelector(controlledElementPath);
        el?.classList.remove('element-controlled');

        setControlledElementPath(null);
    };
    
    useEffect(() => {
        if (isRestoringHistory.current) {
            const timer = setTimeout(() => { isRestoringHistory.current = false; }, 100);
            return () => clearTimeout(timer);
        }
    }, [documentState.current]);


    const value = {
        htmlFile, documentState, loadHtmlFile, editorReady, setEditorReady, currentMode, 
        setCurrentMode, selectedElementPaths, setSelectedElementPaths, iframeRef, updateElementStyle, 
        saveStateToHistory, deleteSelectedElements, duplicateSelectedElements,
        undo, redo, resetToOriginal,
        historyState, // Expose the new history state object
        motionActive, setMotionActive, motionSettings, setMotionSettings, controlledElementPath, 
        setControlledElementPath, releaseControlledElement
    };

    return (
        <EditorContext.Provider value={value}>
            {children}
        </EditorContext.Provider>
    );
};