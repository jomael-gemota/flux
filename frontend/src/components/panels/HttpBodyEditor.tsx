import CodeMirror, { EditorView } from '@uiw/react-codemirror';
import { json } from '@codemirror/lang-json';
import { html } from '@codemirror/lang-html';
import { xml } from '@codemirror/lang-xml';
import { Braces, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useState, useRef, useMemo } from 'react';
import { useWorkflowStore } from '../../store/workflowStore';
import type { CanvasNode } from '../../store/workflowStore';
import type { NodeTestResult } from '../../types/workflow';
import { VariablePickerPanel } from './NodeConfigPanel';

// ── CodeMirror base theme tweaks to fit the panel UI ─────────────────────────

const editorBaseTheme = EditorView.theme({
  '&': {
    fontSize: '11px',
    fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
  },
  '.cm-scroller': {
    lineHeight: '1.6',
  },
  '.cm-content': {
    padding: '8px 0',
  },
  '.cm-gutters': {
    borderRight: '1px solid',
    minWidth: '32px',
  },
  '.cm-lineNumbers .cm-gutterElement': {
    padding: '0 6px 0 4px',
    minWidth: '28px',
    fontSize: '10px',
  },
});

const lightTheme = EditorView.theme(
  {
    '&': { background: '#ffffff', color: '#1e293b' },
    '.cm-gutters': { background: '#f8fafc', borderColor: '#e2e8f0', color: '#94a3b8' },
    '.cm-activeLineGutter': { background: '#f1f5f9' },
    '.cm-activeLine': { background: '#f1f5f9' },
    '.cm-selectionBackground, ::selection': { background: '#bfdbfe !important' },
    '.cm-cursor': { borderLeftColor: '#3b82f6' },
    '.cm-matchingBracket': { background: '#bbf7d0', outline: '1px solid #4ade80' },
  },
  { dark: false },
);

const darkTheme = EditorView.theme(
  {
    '&': { background: '#1e293b', color: '#e2e8f0' },
    '.cm-gutters': { background: '#0f172a', borderColor: '#334155', color: '#475569' },
    '.cm-activeLineGutter': { background: '#1e293b' },
    '.cm-activeLine': { background: 'rgba(255,255,255,0.04)' },
    '.cm-selectionBackground, ::selection': { background: '#1d4ed8 !important' },
    '.cm-cursor': { borderLeftColor: '#60a5fa' },
    '.cm-matchingBracket': { background: 'rgba(74,222,128,0.15)', outline: '1px solid #4ade80' },
  },
  { dark: true },
);

// ── JSON syntax highlighting colours ─────────────────────────────────────────

import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';

const lightHighlight = syntaxHighlighting(
  HighlightStyle.define([
    { tag: t.propertyName, color: '#7c3aed' },      // keys — violet
    { tag: t.string, color: '#059669' },              // strings — emerald
    { tag: t.number, color: '#d97706' },              // numbers — amber
    { tag: t.bool, color: '#2563eb' },                // booleans — blue
    { tag: t.null, color: '#64748b' },                // null — slate
    { tag: t.punctuation, color: '#64748b' },
  ]),
);

const darkHighlight = syntaxHighlighting(
  HighlightStyle.define([
    { tag: t.propertyName, color: '#a78bfa' },        // keys — violet
    { tag: t.string, color: '#34d399' },              // strings — emerald
    { tag: t.number, color: '#fbbf24' },              // numbers — amber
    { tag: t.bool, color: '#60a5fa' },                // booleans — blue
    { tag: t.null, color: '#94a3b8' },                // null — slate
    { tag: t.punctuation, color: '#94a3b8' },
  ]),
);

// ── Component ─────────────────────────────────────────────────────────────────

export type BodyLanguage = 'json' | 'text' | 'html' | 'xml';

interface HttpBodyEditorProps {
  value: string;
  onChange: (v: string) => void;
  language: BodyLanguage;
  onLanguageChange: (lang: BodyLanguage) => void;
  onPrettify: () => void;
  jsonStatus: 'valid' | 'invalid' | 'empty';
  nodes: CanvasNode[];
  testResults: Record<string, NodeTestResult>;
}

export function HttpBodyEditor({
  value,
  onChange,
  language,
  onLanguageChange,
  onPrettify,
  jsonStatus,
  nodes,
  testResults,
}: HttpBodyEditorProps) {
  const theme = useWorkflowStore((s) => s.theme);
  const isDark = theme === 'dark';

  const [varOpen, setVarOpen] = useState(false);
  const viewRef = useRef<EditorView | null>(null);

  const extensions = useMemo(() => {
    const langExt =
      language === 'json' ? [json()] :
      language === 'html' ? [html()] :
      language === 'xml'  ? [xml()]  : [];
    return [
      ...langExt,
      editorBaseTheme,
      isDark ? darkHighlight : lightHighlight,
      EditorView.lineWrapping,
    ];
  }, [language, isDark]);

  // Passed to the `theme` prop — this is the correct slot in @uiw/react-codemirror
  // so it doesn't conflict with the default built-in light theme the component applies.
  const cmTheme = isDark ? darkTheme : lightTheme;

  function handleInsert(expr: string) {
    if (viewRef.current) {
      const view = viewRef.current;
      view.dispatch(view.state.replaceSelection(expr));
      view.focus();
    } else {
      onChange(value + expr);
    }
    setVarOpen(false);
  }

  return (
    <div className="space-y-1.5">
      {/* Controls row: language selector + JSON status + Prettify + Insert variable */}
      <div className="flex items-center gap-2">
        <select
          value={language}
          onChange={(e) => onLanguageChange(e.target.value as BodyLanguage)}
          className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-gray-900 dark:text-slate-200 rounded px-2 py-0.5 text-[10px] focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="json">JSON</option>
          <option value="text">Text</option>
          <option value="html">HTML</option>
          <option value="xml">XML</option>
        </select>

        {language === 'json' && jsonStatus === 'valid' && (
          <span className="flex items-center gap-0.5 text-[10px] text-emerald-500">
            <CheckCircle2 className="w-2.5 h-2.5" />
            Valid JSON
          </span>
        )}
        {language === 'json' && jsonStatus === 'invalid' && (
          <span className="flex items-center gap-0.5 text-[10px] text-red-400">
            <AlertCircle className="w-2.5 h-2.5" />
            Invalid JSON
          </span>
        )}

        <div className="ml-auto flex items-center gap-1.5">
          {language === 'json' && (
            <button
              type="button"
              onClick={onPrettify}
              className="text-[10px] text-blue-500 dark:text-blue-400 hover:bg-slate-200 dark:hover:bg-slate-700 px-1.5 py-0.5 rounded transition-colors"
            >
              Prettify
            </button>
          )}
          {nodes.length > 0 && (
            <button
              type="button"
              onClick={() => setVarOpen((p) => !p)}
              className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded transition-colors ${
                varOpen
                  ? 'bg-blue-600 text-white'
                  : 'text-blue-500 dark:text-blue-400 hover:text-gray-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <Braces className="w-2.5 h-2.5" />
              Insert variable
            </button>
          )}
        </div>
      </div>

      {/* CodeMirror editor */}
      <div className="rounded-md overflow-hidden border border-slate-300 dark:border-slate-600 focus-within:ring-1 focus-within:ring-blue-500 focus-within:border-blue-500 transition-shadow">
        <CodeMirror
          value={value}
          height="220px"
          theme={cmTheme}
          extensions={extensions}
          onChange={onChange}
          onCreateEditor={(view) => {
            viewRef.current = view;
          }}
          basicSetup={{
            lineNumbers: true,
            foldGutter: language === 'json' || language === 'html' || language === 'xml',
            indentOnInput: true,
            bracketMatching: true,
            closeBrackets: true,
            autocompletion: false,
            highlightActiveLine: true,
            highlightActiveLineGutter: true,
            tabSize: 2,
          }}
          indentWithTab={false}
        />
      </div>

      {/* Variable picker dropdown */}
      {varOpen && (
        <VariablePickerPanel nodes={nodes} testResults={testResults} onInsert={handleInsert} />
      )}
    </div>
  );
}
