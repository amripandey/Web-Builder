"use client"

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import dynamic from 'next/dynamic';

// Dynamically import Monaco Editor to prevent SSR issues
const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false });

interface ResizableDividerProps {
    percentage: number;
    onResize: (p: number) => void;
    containerRef: React.RefObject<HTMLDivElement | null>;
}

function ResizableDivider({
    percentage,
    onResize,
    containerRef
}: ResizableDividerProps) {
    const [isDragging, setIsDragging] = React.useState(false);
    const [isDisabled, setIsDisabled] = React.useState(false);
    const offsetRef = React.useRef(0);

    /** ------------------ Drag Start ------------------ **/
    const handleMouseDown = (e: React.MouseEvent) => {
        if (isDisabled) return;

        e.preventDefault();
        setIsDragging(true);

        const rect = (e.target as HTMLElement).getBoundingClientRect();
        offsetRef.current = e.clientX - rect.left;

        const handleMove = (me: MouseEvent) => {
            if (!containerRef.current) return;

            const containerRect = containerRef.current.getBoundingClientRect();
            const width = containerRect.width;

            const mouseX = me.clientX - containerRect.left;
            const correctedX = mouseX - offsetRef.current + rect.width / 2;

            let p = (correctedX / width) * 100;
            p = Math.max(10, Math.min(90, p));
            onResize(p);
        };

        const handleUp = () => {
            setIsDragging(false);
            document.removeEventListener("mousemove", handleMove);
            document.removeEventListener("mouseup", handleUp);
        };

        document.addEventListener("mousemove", handleMove);
        document.addEventListener("mouseup", handleUp);
    };

    /** ------------------ SINGLE CLICK ------------------ **/
    const handleClick = () => {
        // Toggle enabled/disabled
        setIsDisabled(prev => !prev);
    };

    /** ------------------ DOUBLE CLICK ------------------ **/
    const handleDoubleClick = () => {
        // Industry standard: double-click resets to default position
        onResize(50);
        setIsDisabled(false);
    };

    return (
        <div
            onMouseDown={handleMouseDown}
            onClick={handleClick}
            onDoubleClick={handleDoubleClick}
            role="separator"
            style={{
                cursor: isDisabled ? "not-allowed" : "col-resize",
                width: "6px",
                position: "absolute",
                top: 0,
                bottom: 0,
                left: `calc(${percentage}% - 3px)`,
                zIndex: 10,
                backgroundColor: isDisabled
                    ? "#9ca3af"  // gray-400
                    : isDragging
                        ? "#d1d5db"  // lighter gray
                        : "#6b7280", // gray-500
                transition: isDragging ? "none" : "background-color 0.15s"
            }}
        />
    );
}

// --- Builder Page Component ---
type TabType = 'html' | 'css' | 'js';

interface EditorConfig {
    language: string;
    value: string;
    onChange: (value: string) => void;
}

const BuilderPage: React.FC = () => {
    // --- State for Editor Content ---
    const [html, setHtml] = useState('<h1>Hello World!</h1>');
    const [css, setCss] = useState('body { margin: 0; font-family: sans-serif; } h1 { color: #4F46E5; }');
    const [js, setJs] = useState('// JavaScript code here\nconsole.log("Script loaded!");');
    const [activeTab, setActiveTab] = useState<TabType>('html');

    // --- State for Resizable Panel ---
    const INITIAL_WIDTH_PERCENT = 50;
    const [previewWidth, setPreviewWidth] = useState(INITIAL_WIDTH_PERCENT);
    const containerRef = useRef<HTMLDivElement>(null);
    const iframeRef = useRef<HTMLIFrameElement>(null);

    // --- Code Execution Logic (Iframe Content) ---
    const iframeContent = useMemo(() => {
        return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>${css}</style>
</head>
<body>
  ${html}
  <script>
    try {
      ${js}
    } catch (error) {
      console.error('JS Execution Error:', error);
    }
  </script>
</body>
</html>`;
    }, [html, css, js]);

    // --- State for Floating Sidebar ---
    const [isSidebarVisible, setIsSidebarVisible] = useState(false);
    const sidebarRef = useRef<HTMLElement>(null);
    const HOVER_ZONE_WIDTH = 50; // Pixels from the left edge to trigger the sidebar

    // --- Mouse Movement Handler for Sidebar Visibility ---
    const handleMouseMove = useCallback((event: any) => {
        const xPos = event.clientX;
        const isOverZone = xPos < HOVER_ZONE_WIDTH;

        // Check if the mouse is outside the sidebar area
        const isMouseOutsideSidebar = sidebarRef.current && !sidebarRef.current.contains(event.target);

        // Logic to show sidebar when mouse is near the edge AND it's not already visible
        if (isOverZone && !isSidebarVisible) {
            setIsSidebarVisible(true);
        }
        // Logic to hide sidebar when it's visible AND the mouse moves away from the sidebar/zone
        else if (isSidebarVisible && xPos > (sidebarRef.current?.offsetWidth || HOVER_ZONE_WIDTH + 10) && isMouseOutsideSidebar) {
            setIsSidebarVisible(false);
        }
    }, [isSidebarVisible]);

    useEffect(() => {
        // Attach event listener to the window when the component mounts
        window.addEventListener('mousemove', handleMouseMove);

        // Cleanup the event listener when the component unmounts
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
        };
    }, [handleMouseMove]); // Re-run effect when handleMouseMove changes


    // --- Handle Preview Width Change ---
    const handleResizePreview = useCallback((newPercentage: number) => {
        setPreviewWidth(newPercentage);
    }, []);

    // --- Editor Configuration ---
    const editors: Record<TabType, EditorConfig> = useMemo(() => ({
        html: { language: 'html', value: html, onChange: setHtml },
        css: { language: 'css', value: css, onChange: setCss },
        js: { language: 'javascript', value: js, onChange: setJs },
    }), [html, css, js]);

    const activeEditor = editors[activeTab];

    const editorOptions = useMemo(() => ({
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        fontSize: 14,
        wordWrap: 'on' as const,
        automaticLayout: true,
    }), []);

    return (
        <div className="flex flex-col h-screen bg-gray-900">

            {/* --- FLOATING SIDEBAR --- */}
            <aside
                ref={sidebarRef}
                className={`
    fixed 
    top-20               /* float it down from the top */
    left-4               /* space from left edge instead of touching it */
    w-64 
    bg-gray-700 
    shadow-2xl 
    rounded-2xl         /* round corners */
    transform 
    transition-transform 
    duration-300 
    ease-in-out 
    z-20 
    pt-6 
    ${isSidebarVisible ? "translate-x-0" : "-translate-x-[120%]"}
  `}
                onMouseLeave={() => setIsSidebarVisible(false)}
            >
                <div className="p-4 text-white">
                    <h3 className="text-lg font-bold mb-4 border-b border-gray-600 pb-2">
                        <span role="img" aria-label="toolbox">🔧</span> Components
                    </h3>
                    <ul className="space-y-2 text-sm">
                        <li>Drag & Drop Component 1</li>
                        <li>Drag & Drop Component 2</li>
                        <li>Settings Panel</li>
                    </ul>
                </div>
            </aside>

            {/* Main Builder Container */}
            <div
                ref={containerRef}
                className="flex flex-grow relative overflow-hidden"
            >
                {/* LEFT PARTITION: PREVIEW PANEL */}
                <div
                    className="preview-panel bg-white overflow-hidden p-2"
                    style={{
                        width: `${previewWidth}%`,
                        minWidth: '10%',
                        maxWidth: '90%'
                    }}
                >
                    <h2 className="text-lg font-bold mb-2 text-gray-800">Live Preview</h2>
                    <iframe
                        ref={iframeRef}
                        title="Code Preview"
                        srcDoc={iframeContent}
                        sandbox="allow-scripts allow-forms allow-popups allow-modals allow-same-origin"
                        className="w-full h-[calc(100%-2rem)] bg-white border border-gray-300 rounded"
                    />
                </div>

                {/* RESIZABLE DIVIDER */}
                <ResizableDivider
                    percentage={previewWidth}
                    onResize={handleResizePreview}
                    containerRef={containerRef}
                />

                {/* RIGHT PARTITION: CODE EDITOR PANEL */}
                <div
                    className="editor-panel flex flex-col bg-gray-900 overflow-hidden"
                    style={{ width: `${100 - previewWidth}%` }}
                >
                    {/* Tab System */}
                    <div className="flex border-b border-gray-700" role="tablist">
                        {(Object.keys(editors) as TabType[]).map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                role="tab"
                                aria-selected={activeTab === tab}
                                aria-controls={`${tab}-panel`}
                                className={`px-4 py-2 text-sm font-medium ${activeTab === tab
                                    ? 'bg-gray-700 text-white border-b-2 border-indigo-500'
                                    : 'text-gray-400 hover:bg-gray-800'
                                    } transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                            >
                                {tab.toUpperCase()}
                            </button>
                        ))}
                    </div>

                    {/* Monaco Editor */}
                    <div
                        className="flex-grow overflow-hidden"
                        role="tabpanel"
                        id={`${activeTab}-panel`}
                    >
                        <MonacoEditor
                            height="100%"
                            language={activeEditor.language}
                            value={activeEditor.value}
                            onChange={(value) => activeEditor.onChange(value || '')}
                            theme="vs-dark"
                            options={editorOptions}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BuilderPage;