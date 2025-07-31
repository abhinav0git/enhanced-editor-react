import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';

// A utility function to get a unique CSS selector for an element.
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

// Create the context
const EditorContext = createContext();

// Custom hook to use the editor context
export const useEditor = () => useContext(EditorContext);

// The provider component that wraps the application
export const EditorProvider = ({ children }) => {
    // --- STATE MANAGEMENT ---
    const [htmlFile, setHtmlFile] = useState(null);
    const [editorReady, setEditorReady] = useState(false); // Crucial flag for iframe readiness
    const [currentMode, setCurrentMode] = useState('text');
    const [selectedElementPaths, setSelectedElementPaths] = useState([]);
    const [documentState, setDocumentState] = useState({ original: '', current: '' });
    const [historyState, setHistoryState] = useState({ stack: [], currentIndex: -1 });
    const [controlledElementPath, setControlledElementPath] = useState(null);
    
    // --- REFS ---
    const iframeRef = useRef(null);
    const isRestoringHistory = useRef(false); // Prevents feedback loop on undo/redo
    const MAX_HISTORY = 50;

    // --- HISTORY MANAGEMENT ---

    /**
     * Loads a new HTML file, resets the editor, and initializes the history stack.
     */
    const loadHtmlFile = (file) => {
        if (file && file.type === 'text/html') {
            const reader = new FileReader();
            reader.onload = (e) => {
                const content = e.target.result;
                console.log("📄 [HISTORY] File loaded. Resetting history stack with initial content.");
                setDocumentState({ original: content, current: content });
                setHistoryState({ stack: [content], currentIndex: 0 });
                setSelectedElementPaths([]);
                setEditorReady(false); // Set to false until iframe reloads
            };
            reader.readAsText(file);
            setHtmlFile(file);
        }
    };

    /**
     * Saves the current state of the iframe's HTML to the history stack.
     * This function is memoized with useCallback to be stable.
     * It depends on `editorReady` to ensure it doesn't run before the iframe is loaded.
     */
    const saveStateToHistory = useCallback(() => {
        // Gatekeeper: Don't save if the editor isn't ready or if we are in the middle of an undo/redo.
        if (!editorReady || isRestoringHistory.current) {
            console.warn(`🎨 [HISTORY] Save blocked. EditorReady: ${editorReady}, IsRestoring: ${isRestoringHistory.current}`);
            return;
        }

        const iframeDoc = iframeRef.current?.contentDocument;
        if (!iframeDoc) {
             console.error("🎨 [HISTORY] Save failed: iframe document not found.");
             return;
        }

        // Clone the document and clean up editor-specific classes before saving.
        const clonedDoc = iframeDoc.cloneNode(true);
        clonedDoc.querySelectorAll('.editor-selected, .editor-hover, .editable-text-hover').forEach(el => {
            el.classList.remove('editor-selected', 'editor-hover', 'editable-text-hover');
        });
        const currentState = clonedDoc.documentElement.outerHTML;

        // Use a functional update to safely modify the history state.
        setHistoryState(prevState => {
            // Prevent saving identical states consecutively.
            if (prevState.stack.length > 0 && prevState.stack[prevState.currentIndex] === currentState) {
                console.log("🎨 [HISTORY] Save skipped: content is identical to the current state.");
                return prevState;
            }

            // If we are undoing, we need to slice the "future" states off the stack.
            const newStack = prevState.stack.slice(0, prevState.currentIndex + 1);
            newStack.push(currentState);

            // Trim the history stack if it exceeds the maximum size.
            if (newStack.length > MAX_HISTORY) {
                newStack.shift();
            }
            
            const newIndex = newStack.length - 1;
            console.log(`🎨 [HISTORY] State saved. New index: ${newIndex}, Stack size: ${newStack.length}`);

            return {
                stack: newStack,
                currentIndex: newIndex,
            };
        });
    }, [editorReady]); // Dependency: Re-create this function only when editorReady changes.

    /**
     * Moves back one step in the history stack.
     */
    const undo = useCallback(() => {
        setHistoryState(prevState => {
            if (prevState.currentIndex > 0) {
                console.log(`⏪ [HISTORY] Undo to index: ${prevState.currentIndex - 1}`);
                isRestoringHistory.current = true; // Set flag to prevent immediate re-saving
                const newIndex = prevState.currentIndex - 1;
                setDocumentState(doc => ({ ...doc, current: prevState.stack[newIndex] }));
                setSelectedElementPaths([]);
                return { ...prevState, currentIndex: newIndex };
            }
            console.warn("⏪ [HISTORY] Undo blocked: at the beginning of the stack.");
            return prevState;
        });
    }, []);

    /**
     * Moves forward one step in the history stack.
     */
    const redo = useCallback(() => {
        setHistoryState(prevState => {
            if (prevState.currentIndex < prevState.stack.length - 1) {
                console.log(`⏩ [HISTORY] Redo to index: ${prevState.currentIndex + 1}`);
                isRestoringHistory.current = true; // Set flag
                const newIndex = prevState.currentIndex + 1;
                setDocumentState(doc => ({ ...doc, current: prevState.stack[newIndex] }));
                setSelectedElementPaths([]);
                return { ...prevState, currentIndex: newIndex };
            }
            console.warn("⏩ [HISTORY] Redo blocked: at the end of the stack.");
            return prevState;
        });
    }, []);

    /**
     * Resets the document to its original state when first loaded.
     */
    const resetToOriginal = useCallback(() => {
        if (window.confirm('Are you sure you want to reset all changes?')) {
            console.log("🔄 [HISTORY] Resetting to original content.");
            isRestoringHistory.current = true; // Set flag
            setDocumentState(prev => ({ ...prev, current: prev.original }));
            setHistoryState({ stack: [documentState.original], currentIndex: 0 });
            setSelectedElementPaths([]);
        }
    }, [documentState.original]);

    // This effect resets the `isRestoringHistory` flag after a state restoration is complete.
    useEffect(() => {
        if (isRestoringHistory.current) {
            // We use a short timeout to allow React to finish its render cycle.
            const timer = setTimeout(() => {
                console.log("🛠️ [HISTORY] Restoration complete. Re-enabling history saving.");
                isRestoringHistory.current = false;
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [documentState.current]); // This effect runs whenever the iframe content changes.


    // --- OTHER EDITOR FUNCTIONS ---

    const updateElementStyle = (property, value) => {
        const iframeDoc = iframeRef.current?.contentDocument;
        if (!iframeDoc || selectedElementPaths.length === 0) return;
        selectedElementPaths.forEach(path => {
            const el = iframeDoc.querySelector(path);
            if (el) el.style[property] = value;
        });
        // Note: We might want to debounce this before saving
        setTimeout(saveStateToHistory, 50);
    };

    const deleteSelectedElements = () => {
        const iframeDoc = iframeRef.current?.contentDocument;
        if (!iframeDoc || selectedElementPaths.length === 0) return;
        selectedElementPaths.forEach(path => {
            iframeDoc.querySelector(path)?.remove();
        });
        setSelectedElementPaths([]);
        setTimeout(saveStateToHistory, 0);
    };

    const duplicateSelectedElements = () => {
        const iframeDoc = iframeRef.current?.contentDocument;
        if (!iframeDoc || selectedElementPaths.length !== 1) {
            alert("Please select exactly one element to duplicate.");
            return;
        }
        const el = iframeDoc.querySelector(selectedElementPaths[0]);
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
        iframeDoc.querySelector(controlledElementPath)?.classList.remove('element-controlled');
        setControlledElementPath(null);
    };

    // --- CONTEXT VALUE ---
    // The value that will be available to all consumer components.
    const value = {
        htmlFile, documentState, loadHtmlFile, editorReady, setEditorReady, currentMode,
        setCurrentMode, selectedElementPaths, setSelectedElementPaths, iframeRef, updateElementStyle,
        saveStateToHistory, deleteSelectedElements, duplicateSelectedElements,
        undo, redo, resetToOriginal,
        historyState,
        controlledElementPath, setControlledElementPath, releaseControlledElement
    };

    return (
        <EditorContext.Provider value={value}>
            {children}
        </EditorContext.Provider>
    );
};
