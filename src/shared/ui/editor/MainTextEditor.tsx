import { markdown } from "@codemirror/lang-markdown";
import CodeMirror, { type ReactCodeMirrorProps } from "@uiw/react-codemirror";
import { EditorView } from "@codemirror/view";

import { cn } from "@/shared/lib/cn";

export type MainTextEditorVariant = "content" | "aux";

export const MAIN_TEXT_EDITOR_BASIC_SETUP: NonNullable<ReactCodeMirrorProps["basicSetup"]> = {
  lineNumbers: true,
  highlightActiveLineGutter: true,
  highlightSpecialChars: false,
  history: true,
  foldGutter: false,
  drawSelection: true,
  dropCursor: true,
  allowMultipleSelections: true,
  indentOnInput: false,
  syntaxHighlighting: true,
  bracketMatching: false,
  closeBrackets: false,
  autocompletion: false,
  rectangularSelection: true,
  crosshairCursor: false,
  highlightActiveLine: true,
  highlightSelectionMatches: true,
  closeBracketsKeymap: false,
  searchKeymap: true,
  foldKeymap: false,
  completionKeymap: false,
  lintKeymap: false,
  tabSize: 2,
};

export const MAIN_TEXT_EDITOR_EXTENSIONS = [
  markdown(),
  EditorView.lineWrapping,
  EditorView.theme(
    {
      "&": {
        height: "100%",
      },
      ".cm-scroller": {
        overflow: "auto",
      },
      ".cm-content": {
        minHeight: "100%",
        paddingBottom: "45vh",
      },
    },
    { dark: true },
  ),
];

export function getMainTextEditorAriaLabel(variant: MainTextEditorVariant): string {
  return variant === "content" ? "正文编辑器" : "辅助文件编辑器";
}

export function MainTextEditor({
  value,
  onChange,
  placeholder,
  readOnly = false,
  variant,
  className,
}: {
  value: string;
  onChange: (_value: string) => void;
  placeholder: string;
  readOnly?: boolean;
  variant: MainTextEditorVariant;
  className?: string;
}) {
  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      readOnly={readOnly}
      editable={!readOnly}
      indentWithTab={false}
      basicSetup={MAIN_TEXT_EDITOR_BASIC_SETUP}
      extensions={MAIN_TEXT_EDITOR_EXTENSIONS}
      theme="none"
      height="100%"
      aria-label={getMainTextEditorAriaLabel(variant)}
      className={cn("main-text-editor min-h-0 flex-1", `main-text-editor--${variant}`, className)}
    />
  );
}
